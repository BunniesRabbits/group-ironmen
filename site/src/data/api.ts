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

const MemberItemsFromBackend = z
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
type MemberItems = z.infer<typeof MemberItemsFromBackend>;

const GEPricesFromBackend = z
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
export type GEPrices = z.infer<typeof GEPricesFromBackend>;

const NPCInteractionFromBackend = z
  .object({
    /**
     * Name of the NPC.
     */
    name: z.string(),
    /**
     * Relative size of the NPC's hp bar. It is not the actual HP of the monster.
     * I.e. "max" in "current / max" for a traditional stat bar.
     */
    scale: z.uint32().or(z.literal(-1)),
    /**
     * Amount of the NPC's hp bar that is filled.
     * I.e. "current" in "current / max" for a traditional stat bar.
     */
    ratio: z.uint32().or(z.literal(-1)),
    /**
     * Where the NPC is in the world
     */
    location: z.object({ x: z.number(), y: z.number(), plane: z.number() }),
    /**
     * The last time the player reported interacting with the NPC.
     */
    last_updated: z.iso.datetime(),
  })
  .refine((interaction) => {
    const noHP = interaction.scale === -1 && interaction.ratio === -1;
    const hasHP = interaction.scale > 0 && interaction.ratio >= 0;
    return noHP || hasHP;
  })
  .transform(({ name, scale, ratio, location, last_updated }) => ({
    name,
    healthRatio: scale > 0 ? scale / ratio : undefined,
    location,
    last_updated,
  }));
export type NPCInteraction = z.infer<typeof NPCInteractionFromBackend>;

export interface MemberData {
  bank: MemberItems;
  equipment: MemberItems;
  inventory: MemberItems;
  runePouch: MemberItems;
  seedVault: MemberItems;
  interacting?: NPCInteraction;
}

export type ItemsView = Map<ItemID, Map<MemberName, number>>;
export type NPCInteractionsView = Map<MemberName, NPCInteraction>;

const MemberDataUpdate = z.object({
  /**
   * The name of the player
   */
  name: z.string().transform((arg) => arg as MemberName),
  /**
   * The last time the player sent an update
   */
  last_updated: z.iso.datetime().optional(),
  /**
   * The items in the player's bank.
   * When defined, it always contains all of the items.
   */
  bank: z.optional(MemberItemsFromBackend),
  /**
   * The items in the player's equipment.
   * When defined, it always contains all of the items.
   */
  equipment: z.optional(MemberItemsFromBackend),
  /**
   * The items in the player's inventory.
   * When defined, it always contains all of the items.
   */
  inventory: z.optional(MemberItemsFromBackend),
  /**
   * The items in the player's rune pouch.
   * When defined, it always contains all of the items.
   */
  runePouch: z.optional(MemberItemsFromBackend),
  /**
   * The items in the player's farming guild seed vault.
   * When defined, it always contains all of the items.
   */
  seedVault: z.optional(MemberItemsFromBackend),
  /**
   * Information on NPC the player last interacted with.
   */
  interacting: NPCInteractionFromBackend.optional(),
});
type MemberDataUpdate = z.infer<typeof MemberDataUpdate>;

const GetGroupDataResponse = z.array(MemberDataUpdate);
type GetGroupDataResponse = z.infer<typeof GetGroupDataResponse>;

export default class Api {
  private baseURL: string;
  private credentials: ApiCredentials;
  private groupDataValidUpToDate?: Date;
  private getGroupDataPromise?: Promise<void>;
  private closed: boolean;
  private groupData: Map<MemberName, MemberData>;
  private knownMembers: MemberName[];

  private getDateOfNewestMemberUpdate(response: GetGroupDataResponse): Date {
    return response.reduce<Date>((previousNewest, { last_updated }) => {
      if (last_updated === undefined) return previousNewest;
      const memberDate = new Date(last_updated);
      if (memberDate < previousNewest) return previousNewest;
      return memberDate;
    }, new Date(0));
  }
  private updateGroupData(response: GetGroupDataResponse): void {
    let updatedItems = false;
    let updatedNPCInteractions = false;

    this.knownMembers = [];

    // Backend always sends the entirety of the items, in each category that changes.
    // So to simplify and avoid desync, we rebuild the entirety of the items view whenever there is an update.
    // In the future, we may want to diff the amounts and try to update sparingly.

    for (const { name, bank, equipment, inventory, runePouch, seedVault, interacting } of response) {
      if (!this.groupData.has(name))
        this.groupData.set(name, {
          bank: new Map(),
          equipment: new Map(),
          inventory: new Map(),
          runePouch: new Map(),
          seedVault: new Map(),
        });
      const memberData = this.groupData.get(name)!;

      this.knownMembers.push(name);

      if (bank !== undefined) {
        memberData.bank = new Map(bank);
        updatedItems = true;
      }

      if (equipment !== undefined) {
        memberData.equipment = new Map(equipment);
        updatedItems = true;
      }

      if (inventory !== undefined) {
        memberData.inventory = new Map(inventory);
        updatedItems = true;
      }

      if (runePouch !== undefined) {
        memberData.runePouch = new Map(runePouch);
        updatedItems = true;
      }

      if (seedVault !== undefined) {
        memberData.seedVault = new Map(seedVault);
        updatedItems = true;
      }

      if (interacting !== undefined) {
        memberData.interacting = structuredClone(interacting);
        updatedNPCInteractions = true;
      }
    }

    if (updatedItems) {
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

    if (updatedNPCInteractions) {
      const npcInteractionsView: NPCInteractionsView = new Map();
      this.groupData.forEach(({ interacting }, name) => {
        if (interacting === undefined) return;
        npcInteractionsView.set(name, interacting);
      });
      this.onNPCInteractionsUpdate?.(npcInteractionsView);
    }
  }

  public onItemsUpdate?: (items: ItemsView) => void;
  public onNPCInteractionsUpdate?: (interactions: NPCInteractionsView) => void;

  public getKnownMembers(): MemberName[] {
    return [...this.knownMembers];
  }

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
    this.knownMembers = [];

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
      .then((json) => GEPricesFromBackend.safeParseAsync(json))
      .then((parseResult) => {
        if (!parseResult.success) throw new Error("Failed to parse GEPrices response", { cause: parseResult.error });
        return parseResult.data;
      });
  }
}
