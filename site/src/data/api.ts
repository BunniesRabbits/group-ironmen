import { z } from "zod/v4";
import { type Distinct } from "../util";

export interface ApiCredentials {
  groupName: string;
  groupToken: string;
}

const LOCAL_STORAGE_KEY_GROUP_NAME = "groupName";
const LOCAL_STORAGE_KEY_GROUP_TOKEN = "groupToken";

export const loadValidatedCredentials = (): ApiCredentials | undefined => {
  const name = localStorage.getItem(LOCAL_STORAGE_KEY_GROUP_NAME);
  const token = localStorage.getItem(LOCAL_STORAGE_KEY_GROUP_TOKEN);

  if (!name || name === "") return undefined;
  if (!token || token === "") return undefined;

  return { groupName: name, groupToken: token };
};
export const wipeCredentials = (): void => {
  localStorage.removeItem(LOCAL_STORAGE_KEY_GROUP_NAME);
  localStorage.removeItem(LOCAL_STORAGE_KEY_GROUP_TOKEN);
};

function makeAmILoggedInURL(args: { baseURL: string; groupName: string }): string {
  return `${args.baseURL}/group/${args.groupName}/am-i-logged-in`;
}
function makeGetGroupDataURL(args: { baseURL: string; groupName: string; fromTime: Date }): string {
  return `${args.baseURL}/group/${args.groupName}/get-group-data?from_time=${args.fromTime.toISOString()}`;
}
function makeGetGEPricesURL(args: { baseURL: string }): string {
  return `${args.baseURL}/ge-prices`;
}

export type ItemID = Distinct<number, "ItemID">;
export type MemberName = Distinct<string, "MemberName">;

// TODO: I am unsure what to name these types to make it clear they come from the network

const MemberItems = z
  .array(z.uint32().or(z.literal(-1)))
  .refine((arg) => arg.length % 2 === 0)
  .transform((arg: number[]) =>
    arg.reduce<Map<ItemID, number>>((items, _, index, flatItems) => {
      if (index % 2 !== 0 || index + 1 >= flatItems.length) return items;

      const itemID = flatItems[index] as ItemID;

      // -1 seems to be a sentinel for empty rune pouch spots
      if (itemID < 0) return items;

      const itemQuantity = flatItems[index + 1];

      items.set(itemID, itemQuantity + (items.get(itemID) ?? 0));

      return items;
    }, new Map<ItemID, number>()),
  );
type MemberItems = z.infer<typeof MemberItems>;

const GEPrices = z
  .record(
    z
      .string()
      .transform((id) => Number.parseInt(id))
      .refine(Number.isInteger)
      .refine((id) => id >= 0),
    z.uint32(),
  )
  .transform((record) => {
    const prices = new Map<ItemID, number>();
    Object.entries(record).forEach(([itemIDString, price]) => {
      const itemID = parseInt(itemIDString) as ItemID;
      prices.set(itemID, price);
    });
    return prices;
  });
export type GEPrices = z.infer<typeof GEPrices>;

export interface MemberData {
  bank: MemberItems;
  equipment: MemberItems;
  inventory: MemberItems;
  runePouch: MemberItems;
  seedVault: MemberItems;
}
export type ItemsView = Map<ItemID, Map<MemberName, number>>;

const MemberDataUpdate = z.object({
  name: z.string().transform((arg) => arg as MemberName),
  last_updated: z.iso.datetime().optional(),
  bank: z.optional(MemberItems),
  equipment: z.optional(MemberItems),
  inventory: z.optional(MemberItems),
  runePouch: z.optional(MemberItems),
  seedVault: z.optional(MemberItems),
});
type MemberDataUpdate = z.infer<typeof MemberDataUpdate>;

const GetGroupDataResponse = z.array(MemberDataUpdate);
type GetGroupDataResponse = z.infer<typeof GetGroupDataResponse>;

export default class Api {
  // This is overwritten in docker-entrypoint.sh.
  // The "/api" string is substituted with HOST_PROTOCOL + HOST_URL to construct the deployed URL
  private baseURL: string;
  private credentials: ApiCredentials;
  private groupDataValidUpToDate?: Date;
  private getGroupDataPromise?: Promise<void>;
  private closed: boolean;
  private groupData: Map<MemberName, MemberData>;

  private getDateOfNewestMemberUpdate(response: GetGroupDataResponse): Date {
    return response.reduce<Date>((previousNewest, { last_updated }) => {
      if (last_updated === undefined) return previousNewest;
      const memberDate = new Date(last_updated);
      if (memberDate < previousNewest) return previousNewest;
      return memberDate;
    }, new Date(0));
  }
  private updateGroupData(response: GetGroupDataResponse): void {
    let updated = false;

    // Backend always sends the entirety of the items, in each category that changes.
    // So to simplify and avoid desync, we rebuild the entirety of the items view whenever there is an update.
    // In the future, we may want to diff the amounts and try to update sparingly.

    for (const { name, bank, equipment, inventory, runePouch, seedVault } of response) {
      if (!this.groupData.has(name))
        this.groupData.set(name, {
          bank: new Map(),
          equipment: new Map(),
          inventory: new Map(),
          runePouch: new Map(),
          seedVault: new Map(),
        });
      const memberData = this.groupData.get(name)!;

      if (bank !== undefined) {
        memberData.bank = new Map(bank);
        updated = true;
      }

      if (equipment !== undefined) {
        memberData.equipment = new Map(equipment);
        updated = true;
      }

      if (inventory !== undefined) {
        memberData.inventory = new Map(inventory);
        updated = true;
      }

      if (runePouch !== undefined) {
        memberData.runePouch = new Map(runePouch);
        updated = true;
      }

      if (seedVault !== undefined) {
        memberData.seedVault = new Map(seedVault);
        updated = true;
      }
    }

    if (!updated) return;

    const itemsView: ItemsView = new Map();
    this.groupData.forEach(({ bank, equipment, inventory, runePouch, seedVault }, memberName) => {
      [bank, equipment, inventory, runePouch, seedVault].forEach((storageArea) =>
        storageArea.forEach((quantity, itemID) => {
          if (!itemsView.has(itemID)) itemsView.set(itemID, new Map<MemberName, number>());
          const itemView = itemsView.get(itemID)!;

          const oldQuantity = itemView.get(memberName) ?? 0;
          itemView.set(memberName, oldQuantity + quantity);
        }),
      );
    });

    this.onItemsUpdate?.(itemsView);
  }

  public onItemsUpdate?: (items: ItemsView) => void;

  /**
   * Kicks off fetching the group data once a second from the backend.
   * Only queues a new fetch when the old fetch resolves,
   * so with slow internet speeds the updates will be slower.
   * Call close() to stop further queuing.
   */
  public queueGetGroupData(): void {
    if (this.getGroupDataPromise !== undefined) return;

    const fetchDate = new Date((this.groupDataValidUpToDate?.getTime() ?? 0) + 1);

    this.getGroupDataPromise = fetch(
      makeGetGroupDataURL({ baseURL: this.baseURL, groupName: this.credentials.groupName, fromTime: fetchDate }),
      {
        headers: { Authorization: this.credentials.groupToken },
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("GetGroupData response was not OK");
        }

        return response.json();
      })
      .then((json) => {
        return GetGroupDataResponse.safeParseAsync(json);
      })
      .then((parseResult) => {
        if (!parseResult?.success) {
          throw new Error("GetGroupData response was malformed.", { cause: parseResult.error });
        }

        this.updateGroupData(parseResult.data);
        this.groupDataValidUpToDate = this.getDateOfNewestMemberUpdate(parseResult.data);
      })
      .then(() => {
        if (this.closed) return;

        window.setTimeout(() => {
          this.getGroupDataPromise = undefined;
          this.queueGetGroupData();
        }, 1000);
      });
  }

  close(): void {
    this.closed = true;
  }
  constructor(credentials: ApiCredentials) {
    this.baseURL = __API_URL__;
    this.credentials = credentials;
    this.closed = false;

    this.groupData = new Map();
  }

  async fetchAmILoggedIn(): Promise<Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));

    return fetch(makeAmILoggedInURL({ baseURL: this.baseURL, groupName: this.credentials.groupName }), {
      headers: { Authorization: this.credentials.groupToken },
    });
  }
  async fetchGEPrices(): Promise<GEPrices> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));

    return fetch(makeGetGEPricesURL({ baseURL: this.baseURL }))
      .then((response) => response.json())
      .then((json) => GEPrices.safeParseAsync(json))
      .then((parseResult) => {
        if (!parseResult.success) throw new Error("Failed to parse GEPrices response", { cause: parseResult.error });
        return parseResult.data;
      });
  }
}
