import { fetchItemDataJSON, type ItemID, type ItemsDatabase, type ItemStack } from "./items";
import { fetchQuestDataJSON, type QuestDatabase } from "./quests";
import { fetchDiaryDataJSON, type DiaryDatabase } from "./diaries";
import type { GroupCredentials } from "./credentials";
import type * as Member from "./member";
import { fetchGEPrices, type GEPrices } from "./requests/ge-prices";
import { fetchGroupData, type Response as GetGroupDataResponse } from "./requests/group-data";
import { fetchGroupCollectionLogs, type Response as GetGroupCollectionLogsResponse } from "./requests/collection-log";
import type { CollectionLogInfo } from "./collection-log";
import { fetchCollectionLogInfo } from "./requests/collection-log-info";

function makeAmILoggedInURL(args: { baseURL: string; groupName: string }): string {
  return `${args.baseURL}/group/${args.groupName}/am-i-logged-in`;
}

export interface GroupState {
  items: Map<ItemID, Map<Member.Name, number>>;
  members: Map<Member.Name, Member.State>;
}

interface UpdateCallbacks {
  onGroupUpdate: (group: GroupState) => void;
  onItemDataUpdate: (itemData: ItemsDatabase) => void;
  onQuestDataUpdate: (questData: QuestDatabase) => void;
  onDiaryDataUpdate: (diaryData: DiaryDatabase) => void;
  onGEDataUpdate: (geData: GEPrices) => void;
  onCollectionLogInfoUpdate: (info: CollectionLogInfo) => void;
}
export default class Api {
  private baseURL: string;
  private closed: boolean;
  private credentials: GroupCredentials;

  private getGroupDataPromise?: Promise<void>;
  private getGroupCollectionLogsPromise?: Promise<void>;

  private groupDataValidUpToDate?: Date;
  private itemDatabase?: ItemsDatabase;
  private group: GroupState;

  private questData?: QuestDatabase;
  private diaryData?: DiaryDatabase;
  private geData?: GEPrices;
  private collectionLogInfo?: CollectionLogInfo;

  private updateGroupData(response: GetGroupDataResponse): void {
    let updatedItems = false;
    let updatedAny = false;

    // Backend always sends the entirety of the items, in each category that changes.
    // So to simplify and avoid desync, we rebuild the entirety of the items view whenever there is an update.
    // In the future, we may want to diff the amounts and try to update sparingly.

    for (const {
      name,
      bank,
      equipment,
      inventory,
      runePouch,
      seedVault,
      interacting,
      stats,
      last_updated,
      skills,
      quests,
      diary_vars,
    } of response) {
      if (!this.group.members.has(name))
        this.group.members.set(name, {
          bank: new Map(),
          equipment: new Map(),
          inventory: [],
          runePouch: new Map(),
          seedVault: new Map(),
          lastUpdated: new Date(0),
        });
      const memberData = this.group.members.get(name)!;

      if (bank !== undefined) {
        memberData.bank = new Map(bank);
        updatedItems = true;
      }

      if (equipment !== undefined) {
        memberData.equipment = structuredClone(equipment);
        updatedItems = true;
      }

      if (inventory !== undefined) {
        memberData.inventory = structuredClone(inventory);
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
        updatedAny = true;
      }

      if (stats !== undefined) {
        memberData.stats = structuredClone(stats);
        updatedAny = true;
      }

      if (last_updated !== undefined) {
        memberData.lastUpdated = structuredClone(last_updated);
        updatedAny = true;
      }

      if (skills !== undefined) {
        memberData.skills = structuredClone(skills);
        updatedAny = true;
      }

      if (quests !== undefined && this.questData !== undefined) {
        if (this.questData.size !== quests.length) {
          console.warn(
            "Quest data and quest progress have mismatched length. This indicates the network sent bad data, or the quest_data.json is out of date.",
          );
        } else {
          const questsByID = new Map();
          // Resolve the IDs for the flattened quest progress sent by the backend
          this.questData.entries().forEach(([id, _], index) => {
            questsByID.set(id, quests[index]);
          });
          memberData.quests = questsByID;
          updatedAny = true;
        }
      }

      if (diary_vars !== undefined) {
        memberData.diaries = structuredClone(diary_vars);
        updatedAny = true;
      }
    }

    if (updatedItems) {
      const sumOfAllItems = new Map<ItemID, Map<Member.Name, number>>();
      const incrementItemCount = (memberName: Member.Name, { itemID, quantity }: ItemStack): void => {
        if (!sumOfAllItems.has(itemID)) sumOfAllItems.set(itemID, new Map<Member.Name, number>());
        const itemView = sumOfAllItems.get(itemID)!;

        const oldQuantity = itemView.get(memberName) ?? 0;
        itemView.set(memberName, oldQuantity + quantity);
      };

      this.group.members.forEach(({ bank, equipment, inventory, runePouch, seedVault }, memberName) => {
        // Each item storage is slightly different, so we need to iterate them different.
        [bank, runePouch, seedVault].forEach((storageArea) =>
          storageArea.forEach((quantity, itemID) => {
            incrementItemCount(memberName, { quantity, itemID });
          }),
        );
        inventory
          .filter((item) => item !== undefined)
          .forEach((item) => {
            incrementItemCount(memberName, item);
          });
        equipment.forEach((item) => {
          incrementItemCount(memberName, item);
        });
      });

      this.group.items = sumOfAllItems;
    }

    if (updatedAny || updatedItems) {
      this.callbacks?.onGroupUpdate(this.group);
    }
  }

  private updateGroupCollectionLogs(response: GetGroupCollectionLogsResponse): void {
    let updatedLogs = false;

    Object.entries(response).forEach(([member, collection]) => {
      if (!this.group.members.has(member as Member.Name)) {
        return;
      }

      // TODO: Don't do shallow copy (does it matter?)
      this.group.members.get(member as Member.Name)!.collection = new Map(collection);
      updatedLogs = true;
    });

    if (updatedLogs) {
      this.callbacks?.onGroupUpdate(this.group);
    }
  }

  private callbacks?: UpdateCallbacks;

  public setUpdateCallbacks(callbacks: UpdateCallbacks): void {
    this.callbacks = callbacks;
  }

  private queueGetGameData(): void {
    if (this.questData === undefined) {
      fetchQuestDataJSON()
        .then((data) => {
          this.questData = data;
          this.callbacks?.onQuestDataUpdate(data);
        })
        .catch((reason) => console.error("Failed to get quest data for API", reason));
    }
    if (this.itemDatabase === undefined) {
      fetchItemDataJSON()
        .then((data) => {
          this.itemDatabase = data;
          this.callbacks?.onItemDataUpdate(data);
        })
        .catch((reason) => console.error("Failed to get item data for API", reason));
    }
    if (this.diaryData === undefined) {
      fetchDiaryDataJSON()
        .then((data) => {
          this.diaryData = data;
          this.callbacks?.onDiaryDataUpdate(data);
        })
        .catch((reason) => console.error("Failed to get diary data for API", reason));
    }
    if (this.geData === undefined) {
      fetchGEPrices({ baseURL: this.baseURL })
        .then((data) => {
          this.geData = data;
          this.callbacks?.onGEDataUpdate(data);
        })
        .catch((reason) => console.error("Failed to get grand exchange data for API", reason));
    }
    if (this.collectionLogInfo === undefined) {
      fetchCollectionLogInfo({ baseURL: this.baseURL })
        .then((response) => {
          this.collectionLogInfo = {
            tabs: response,
          };
          this.callbacks?.onCollectionLogInfoUpdate(this.collectionLogInfo);
        })
        .catch((reason) => console.error("Failed to get collection log info for API", reason));
    }
  }

  private queueFetchGroupData(): void {
    const FETCH_INTERVAL_MS = 1000;
    const fetchDate = new Date((this.groupDataValidUpToDate?.getTime() ?? 0) + 1);

    this.getGroupDataPromise ??= fetchGroupData({
      baseURL: this.baseURL,
      credentials: this.credentials,
      fromTime: fetchDate,
    })
      .then((response) => {
        this.updateGroupData(response);

        const mostRecentLastUpdatedTimestamp = response.reduce<Date>((previousNewest, { last_updated }) => {
          if (last_updated === undefined) return previousNewest;
          const memberDate = new Date(last_updated);
          if (memberDate < previousNewest) return previousNewest;
          return memberDate;
        }, new Date(0));

        this.groupDataValidUpToDate = mostRecentLastUpdatedTimestamp;
      })
      .then(() => {
        if (this.closed) return;

        window.setTimeout(() => {
          this.getGroupDataPromise = undefined;
          this.queueFetchGroupData();
        }, FETCH_INTERVAL_MS);
      });
  }

  private queueFetchGroupCollectionLogs(): void {
    const FETCH_INTERVAL_MS = 10000;

    this.getGroupCollectionLogsPromise ??= fetchGroupCollectionLogs({
      baseURL: this.baseURL,
      credentials: this.credentials,
    })
      .then((response) => {
        this.updateGroupCollectionLogs(response);
      })
      .then(() => {
        if (this.closed) return;

        window.setTimeout(() => {
          this.getGroupCollectionLogsPromise = undefined;
          this.queueFetchGroupCollectionLogs();
        }, FETCH_INTERVAL_MS);
      });
  }

  /**
   * WARNING: Make sure callbacks (all named `on*****Update`) are set up to receive the data!
   * Some callbacks may only be called once and data can be missed.
   *
   * Kicks off fetching the group data once a second from the backend.
   * Only queues a new fetch when the old fetch resolves,
   * so with slow internet speeds the updates will be slower.
   * Call close() to stop further queuing.
   */
  public startFetchingEverything(): void {
    if (!this.questData || !this.itemDatabase || !this.diaryData) this.queueGetGameData();

    this.queueFetchGroupData();
    void this.getGroupDataPromise!.then(() => this.queueFetchGroupCollectionLogs());
  }

  close(): void {
    this.callbacks = undefined;
    this.closed = true;
  }
  constructor(credentials: GroupCredentials) {
    this.baseURL = __API_URL__;
    this.credentials = credentials;
    this.closed = false;
    this.group = { items: new Map(), members: new Map() };
  }

  async fetchAmILoggedIn(): Promise<Response> {
    if (this.credentials === undefined) return Promise.reject(new Error("No active API connection."));

    return fetch(makeAmILoggedInURL({ baseURL: this.baseURL, groupName: this.credentials.name }), {
      headers: { Authorization: this.credentials.token },
    });
  }
}
