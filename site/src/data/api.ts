import { z } from "zod/v4";
import { type Distinct } from "../util";
import { fetchItemDataJSON, type ItemData } from "./item-data";
import { fetchQuestDataJSON, type QuestData, type QuestID } from "./quest-data";

/*
 * TODO: This entire file is a bit of a behemoth, and needs to be broken up.
 * Disparate types are all entangled.
 */

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
export type MemberItems = z.infer<typeof MemberItemsFromBackend>;

export interface ItemStack {
  itemID: ItemID;
  quantity: number;
}

const INVENTORY_SIZE = 28;
const InventoryFromBackend = z
  .array(z.uint32())
  .length(2 * INVENTORY_SIZE)
  .transform((flat) =>
    flat.reduce<(ItemStack | undefined)[]>((inventory, _, index, flat) => {
      if (index % 2 !== 0) return inventory;

      const itemID = flat[index] as ItemID;
      const quantity = flat[index + 1];

      if (quantity === 0) inventory.push(undefined);
      else inventory.push({ itemID, quantity });
      return inventory;
    }, []),
  );
export type Inventory = z.infer<typeof InventoryFromBackend>;

/**
 * Backend obeys this order:
 * https://github.com/runelite/runelite/blob/a8bdd510971fc8974959e2c9b34b6b88b46bb0fd/runelite-api/src/main/java/net/runelite/api/EquipmentInventorySlot.java#L37
 * We use the names from runelite source.
 */
const EquipmentSlotInBackendOrder = [
  "Head",
  "Cape",
  "Amulet",
  "Weapon",
  "Body",
  "Shield",
  "Arms",
  "Legs",
  "Hair",
  "Gloves",
  "Boots",
  "Jaw",
  "Ring",
  "Ammo",
] as const;
export type EquipmentSlot = (typeof EquipmentSlotInBackendOrder)[number];

const NUMBER_OF_EQUIPMENT_SLOTS = EquipmentSlotInBackendOrder.length;
const EquipmentFromBackend = z
  .array(z.uint32())
  .length(2 * NUMBER_OF_EQUIPMENT_SLOTS)
  .transform((equipmentFlat) => {
    return equipmentFlat.reduce<Map<EquipmentSlot, ItemStack>>((equipment, _, index, equipmentFlat) => {
      if (index % 2 !== 0 || index + 1 >= equipmentFlat.length) return equipment;

      const itemID = equipmentFlat[index] as ItemID;
      const quantity = equipmentFlat[index + 1];

      if (quantity < 1) return equipment;

      const slot = EquipmentSlotInBackendOrder[index / 2];
      equipment.set(slot, { itemID, quantity });
      return equipment;
    }, new Map());
  });

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

const StatsFromBackend = z
  .array(z.uint32())
  .length(7)
  .refine((stats) => stats[5] === 100) // Plugin reports max run energy as 100, when it actually is 10000.
  .transform((args) => {
    return {
      health: {
        current: args[0],
        max: args[1],
      },
      prayer: {
        current: args[2],
        max: args[3],
      },
      run: {
        current: args[4],
        max: 10000,
      },
      world: args[6],
    };
  });
export type Stats = z.infer<typeof StatsFromBackend>;

const DateFromBackend = z.iso
  .datetime()
  .transform((date: string) => date.split(/\D+/))
  .refine((fragments) => {
    // console.log(fragments);
    return fragments.length === 8;
  })
  .transform((fragments) => {
    return new Date(
      Date.UTC(
        parseInt(fragments[0]),
        parseInt(fragments[1]) - 1,
        parseInt(fragments[2]),
        parseInt(fragments[3]),
        parseInt(fragments[4]),
        parseInt(fragments[5]),
        parseFloat(`${fragments[6].slice(0, 3)}.${fragments[6].slice(3)}`),
      ),
    );
  });

const NPCInteractionFromBackend = z
  .object({
    /**
     * Name of the NPC.
     */
    name: z.string(),
    /**
     * Relative size of the NPC's hp bar. It is not the actual HP of the monster.
     * I.e. "max" in "current / max" for a traditional stat bar.
     * See runelite source for comments:
     * https://github.com/runelite/runelite/blob/a8bdd510971fc8974959e2c9b34b6b88b46bb0fd/runelite-api/src/main/java/net/runelite/api/Actor.java#L102
     * This number is 30 for most actors, but larger for other things. -1 when health info does not exist.
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
    last_updated: DateFromBackend,
  })
  .refine((interaction) => {
    const noHP = interaction.scale === -1 && interaction.ratio === -1;
    const hasHP = interaction.scale > 0 && interaction.ratio >= 0;
    return noHP || hasHP;
  })
  .transform(({ name, scale, ratio, location, last_updated }) => ({
    name,
    healthRatio: scale > 0 ? ratio / scale : undefined,
    location,
    last_updated: new Date(last_updated),
  }));
export type NPCInteraction = z.infer<typeof NPCInteractionFromBackend>;

export const SkillsInBackendOrder = [
  "Agility",
  "Attack",
  "Construction",
  "Cooking",
  "Crafting",
  "Defence",
  "Farming",
  "Firemaking",
  "Fishing",
  "Fletching",
  "Herblore",
  "Hitpoints",
  "Hunter",
  "Magic",
  "Mining",
  "Prayer",
  "Ranged",
  "Runecraft",
  "Slayer",
  "Smithing",
  "Strength",
  "Thieving",
  "Woodcutting",
] as const;
export type Skill = (typeof SkillsInBackendOrder)[number];

const SkillsFromBackend = z
  .array(z.uint32())
  .length(SkillsInBackendOrder.length)
  .transform((xpFlat) => new Map(xpFlat.map((xp, index) => [SkillsInBackendOrder[index], xp])));
export type Skills = z.infer<typeof SkillsFromBackend>;

const QuestStatus = ["NOT_STARTED", "IN_PROGRESS", "FINISHED"] as const;
export type QuestStatus = (typeof QuestStatus)[number];

/**
 * Quests are sent by the backend without IDs. They are sorted by ascending ID order.
 * Thus, if there is a mismatch in length, it is impossible to tell which quests are missing.
 */
const QuestsFromBackend = z
  .uint32()
  .refine((progress) => progress === 0 || progress === 1 || progress === 2)
  .transform((progress) => QuestStatus[progress])
  .array();
export type Quests = Map<QuestID, QuestStatus>;

export interface MemberData {
  bank: MemberItems;
  equipment: Equipment;
  inventory: Inventory;
  runePouch: MemberItems;
  seedVault: MemberItems;
  interacting?: NPCInteraction;
  stats?: Stats;
  lastUpdated: Date;
  skills?: Skills;
  quests?: Quests;
}

export type Equipment = z.infer<typeof EquipmentFromBackend>;

export type InventoryView = Map<MemberName, Inventory>;
export type EquipmentView = Map<MemberName, Equipment>;
export type ItemsView = Map<ItemID, Map<MemberName, number>>;
export type NPCInteractionsView = Map<MemberName, NPCInteraction>;
export type StatsView = Map<MemberName, Stats>;
export type LastUpdatedView = Map<MemberName, Date>;
export type SkillsView = Map<MemberName, Skills>;
export type QuestsView = Map<MemberName, Quests>;

const MemberDataUpdate = z.object({
  /**
   * The name of the player
   */
  name: z.string().transform((arg) => arg as MemberName),
  /**
   * The last time the player sent an update
   */
  last_updated: DateFromBackend.optional(),
  /**
   * The items in the player's bank.
   * When defined, it always contains all of the items.
   */
  bank: z.optional(MemberItemsFromBackend),
  /**
   * The items in the player's equipment.
   * When defined, it always contains all of the items.
   */
  equipment: z.optional(EquipmentFromBackend),
  /**
   * The items in the player's inventory.
   * When defined, it always contains all of the items.
   */
  inventory: z.optional(InventoryFromBackend),
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
  /**
   * Stats of the player, including the last known world they were on.
   */
  stats: StatsFromBackend.optional(),
  /**
   * Skills of the player, given in XP amount.
   */
  skills: SkillsFromBackend.optional(),
  /**
   * Quest progress/completion status per quest.
   */
  quests: QuestsFromBackend.optional(),
});
type MemberDataUpdate = z.infer<typeof MemberDataUpdate>;

const GetGroupDataResponse = z.array(MemberDataUpdate);
type GetGroupDataResponse = z.infer<typeof GetGroupDataResponse>;

interface UpdateCallbacks {
  onSkillsUpdate: (skills: SkillsView) => void;
  onInventoryUpdate: (inventory: InventoryView) => void;
  onEquipmentUpdate: (equipment: EquipmentView) => void;
  onItemsUpdate: (items: ItemsView) => void;
  onNPCInteractionsUpdate: (interactions: NPCInteractionsView) => void;
  onStatsUpdate: (stats: StatsView) => void;
  onLastUpdatedUpdate: (lastUpdated: LastUpdatedView) => void;
  onQuestsUpdate: (quests: QuestsView) => void;
  onItemDataUpdate: (itemData: ItemData) => void;
  onQuestDataUpdate: (questData: QuestData) => void;
}
export default class Api {
  private baseURL: string;
  private credentials: ApiCredentials;
  private groupDataValidUpToDate?: Date;
  private getGroupDataPromise?: Promise<void>;
  private closed: boolean;
  private groupData: Map<MemberName, MemberData>;
  private knownMembers: MemberName[];
  private itemData?: ItemData;
  private questData?: QuestData;

  private getDateOfNewestMemberUpdate(response: GetGroupDataResponse): Date {
    return response.reduce<Date>((previousNewest, { last_updated }) => {
      if (last_updated === undefined) return previousNewest;
      const memberDate = new Date(last_updated);
      if (memberDate < previousNewest) return previousNewest;
      return memberDate;
    }, new Date(0));
  }
  private updateGroupData(response: GetGroupDataResponse): void {
    let updatedBankVaultPouch = false;
    let updatedInventory = false;
    let updatedEquipment = false;
    let updatedNPCInteractions = false;
    let updatedStats = false;
    let updatedLastUpdated = false;
    let updatedSkills = false;
    let updatedQuests = false;

    this.knownMembers = [];

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
    } of response) {
      if (!this.groupData.has(name))
        this.groupData.set(name, {
          bank: new Map(),
          equipment: new Map(),
          inventory: [],
          runePouch: new Map(),
          seedVault: new Map(),
          lastUpdated: new Date(0),
        });
      const memberData = this.groupData.get(name)!;

      this.knownMembers.push(name);

      if (bank !== undefined) {
        memberData.bank = new Map(bank);
        updatedBankVaultPouch = true;
      }

      if (equipment !== undefined) {
        memberData.equipment = structuredClone(equipment);
        updatedEquipment = true;
      }

      if (inventory !== undefined) {
        memberData.inventory = structuredClone(inventory);
        updatedInventory = true;
      }

      if (runePouch !== undefined) {
        memberData.runePouch = new Map(runePouch);
        updatedBankVaultPouch = true;
      }

      if (seedVault !== undefined) {
        memberData.seedVault = new Map(seedVault);
        updatedBankVaultPouch = true;
      }

      if (interacting !== undefined) {
        memberData.interacting = structuredClone(interacting);
        updatedNPCInteractions = true;
      }

      if (stats !== undefined) {
        memberData.stats = structuredClone(stats);
        updatedStats = true;
      }

      if (last_updated !== undefined) {
        memberData.lastUpdated = structuredClone(last_updated);
        updatedLastUpdated = true;
      }

      if (skills !== undefined) {
        memberData.skills = structuredClone(skills);
        updatedSkills = true;
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
          updatedQuests = true;
        }
      }
    }

    if (updatedBankVaultPouch || updatedInventory || updatedEquipment) {
      const sumOfAllItems: ItemsView = new Map();
      const incrementItemCount = (memberName: MemberName, { itemID, quantity }: ItemStack): void => {
        if (!sumOfAllItems.has(itemID)) sumOfAllItems.set(itemID, new Map<MemberName, number>());
        const itemView = sumOfAllItems.get(itemID)!;

        const oldQuantity = itemView.get(memberName) ?? 0;
        itemView.set(memberName, oldQuantity + quantity);
      };

      this.groupData.forEach(({ bank, equipment, inventory, runePouch, seedVault }, memberName) => {
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

      this.callbacks?.onItemsUpdate(sumOfAllItems);
    }

    if (updatedInventory) {
      const inventoryView: InventoryView = new Map();
      this.groupData.forEach(({ inventory }, memberName) => {
        inventoryView.set(memberName, structuredClone(inventory));
      });

      this.callbacks?.onInventoryUpdate(inventoryView);
    }

    if (updatedEquipment) {
      const equipmentView: EquipmentView = new Map();
      this.groupData.forEach(({ equipment }, memberName) => {
        equipmentView.set(memberName, new Map(equipment));
      });

      this.callbacks?.onEquipmentUpdate(equipmentView);
    }

    if (updatedNPCInteractions) {
      const npcInteractionsView: NPCInteractionsView = new Map();
      this.groupData.forEach(({ interacting }, name) => {
        if (interacting === undefined) return;
        npcInteractionsView.set(name, interacting);
      });
      this.callbacks?.onNPCInteractionsUpdate(npcInteractionsView);
    }

    if (updatedStats) {
      const statsView: StatsView = new Map();
      this.groupData.forEach(({ stats }, name) => {
        if (stats === undefined) return;
        statsView.set(name, stats);
      });
      this.callbacks?.onStatsUpdate(statsView);
    }

    if (updatedLastUpdated) {
      const lastUpdatedView: LastUpdatedView = new Map();
      this.groupData.forEach(({ lastUpdated }, name) => {
        if (lastUpdated === undefined) return;
        lastUpdatedView.set(name, lastUpdated);
      });
      this.callbacks?.onLastUpdatedUpdate(lastUpdatedView);
    }

    if (updatedSkills) {
      const skillsView: SkillsView = new Map();
      this.groupData.forEach(({ skills }, name) => {
        if (skills === undefined) return;
        skillsView.set(name, skills);
      });
      this.callbacks?.onSkillsUpdate(skillsView);
    }

    if (updatedQuests) {
      const questsView: QuestsView = new Map();
      this.groupData.forEach(({ quests }, name) => {
        if (quests === undefined) return;
        questsView.set(name, quests);
      });
      this.callbacks?.onQuestsUpdate(questsView);
    }
  }

  private callbacks?: UpdateCallbacks;

  public setUpdateCallbacks(callbacks: UpdateCallbacks): void {
    this.callbacks = callbacks;
  }

  public getKnownMembers(): MemberName[] {
    return [...this.knownMembers];
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
    if (this.itemData === undefined) {
      fetchItemDataJSON()
        .then((data) => {
          this.itemData = data;
          this.callbacks?.onItemDataUpdate(data);
        })
        .catch((reason) => console.error("Failed to get item data for API", reason));
    }
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
  public queueGetGroupData(): void {
    if (this.getGroupDataPromise !== undefined) return;

    if (this.questData === undefined || this.itemData === undefined) this.queueGetGameData();

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
    this.callbacks = undefined;
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
