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

interface ApiURLArguments {
  baseURL: string;
  groupName: string;
}

function makeAmILoggedInURL(args: ApiURLArguments): string {
  return `${args.baseURL}/group/${args.groupName}/am-i-logged-in`;
}
function makeGetGroupDataURL(args: ApiURLArguments, fromTime: Date): string {
  return `${args.baseURL}/group/${args.groupName}/get-group-data?from_time=${fromTime.toISOString()}`;
}

export type ItemID = Distinct<number, "ItemID">;
export type MemberName = Distinct<string, "MemberName">;

// TODO: I am unsure what to name these types to make it clear they come from the network

const MemberItems = z
  .array(z.uint32())
  .refine((arg) => arg.length % 2 === 0)
  .transform((arg: number[]) =>
    arg.reduce<Map<ItemID, number>>((items, _, index, flatItems) => {
      if (index % 2 !== 0 || index + 1 >= flatItems.length) return items;

      const itemID = flatItems[index] as ItemID;
      const itemQuantity = flatItems[index + 1];

      items.set(itemID, itemQuantity + (items.get(itemID) ?? 0));

      return items;
    }, new Map<ItemID, number>()),
  );
type MemberItems = z.infer<typeof MemberItems>;

export interface MemberData {
  bank: MemberItems;
}
export type ItemsView = Map<ItemID, Map<MemberName, number>>;

const MemberDataUpdate = z.object({
  name: z.string().transform((arg) => arg as MemberName),
  last_updated: z.iso.datetime(),
  bank: z.optional(MemberItems),
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

    for (const { name, bank } of response) {
      if (!this.groupData.has(name)) this.groupData.set(name, { bank: new Map() });
      const memberData = this.groupData.get(name)!;

      if (bank === undefined) continue;
      memberData.bank = new Map(bank);
      updated = true;
    }

    if (!updated) return;

    const itemsView: ItemsView = new Map();
    this.groupData.forEach(({ bank }, memberName) => {
      bank.forEach((quantity, itemID) => {
        if (!itemsView.has(itemID)) itemsView.set(itemID, new Map<MemberName, number>());
        const itemView = itemsView.get(itemID)!;

        itemView.set(memberName, quantity);
      });
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
      makeGetGroupDataURL({ baseURL: this.baseURL, groupName: this.credentials.groupName }, fetchDate),
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
}
