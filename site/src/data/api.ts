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

export interface InventoryItem {
  itemID: ItemID;
  quantity: number;
}
const INVENTORY_SIZE = 28;
const InventoryFromBackend = z
  .array(z.uint32())
  .length(2 * INVENTORY_SIZE)
  .transform((flat) =>
    flat.reduce<(InventoryItem | undefined)[]>((inventory, _, index, flat) => {
      if (index % 2 !== 0) return inventory;

      const itemID = flat[index] as ItemID;
      const quantity = flat[index + 1];

      if (quantity === 0) inventory.push(undefined);
      else inventory.push({ itemID, quantity });
      return inventory;
    }, []),
  );
export type Inventory = z.infer<typeof InventoryFromBackend>;

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

export interface MemberData {
  bank: MemberItems;
  equipment: MemberItems;
  inventory: Inventory;
  runePouch: MemberItems;
  seedVault: MemberItems;
  interacting?: NPCInteraction;
  stats?: Stats;
  lastUpdated: Date;
  skills?: Skills;
}

export type InventoryView = Map<MemberName, Inventory>;
export type ItemsView = Map<ItemID, Map<MemberName, number>>;
export type NPCInteractionsView = Map<MemberName, NPCInteraction>;
export type StatsView = Map<MemberName, Stats>;
export type LastUpdatedView = Map<MemberName, Date>;
export type SkillsView = Map<MemberName, Skills>;

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
  equipment: z.optional(MemberItemsFromBackend),
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
    let updatedInventory = false;
    let updatedNPCInteractions = false;
    let updatedStats = false;
    let updatedLastUpdated = false;
    let updatedSkills = false;

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
        updatedItems = true;
      }

      if (equipment !== undefined) {
        memberData.equipment = new Map(equipment);
        updatedItems = true;
      }

      if (inventory !== undefined) {
        memberData.inventory = structuredClone(inventory);
        updatedInventory = true;
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
    }

    if (updatedItems || updatedInventory) {
      const itemsView: ItemsView = new Map();
      this.groupData.forEach(({ bank, equipment, inventory, runePouch, seedVault }, memberName) => {
        [bank, equipment, runePouch, seedVault].forEach((storageArea) =>
          storageArea.forEach((quantity, itemID) => {
            if (!itemsView.has(itemID)) itemsView.set(itemID, new Map<MemberName, number>());
            const itemView = itemsView.get(itemID)!;

            const oldQuantity = itemView.get(memberName) ?? 0;
            itemView.set(memberName, oldQuantity + quantity);
          }),
        );
        inventory
          .filter((item) => item !== undefined)
          .forEach(({ itemID, quantity }) => {
            if (!itemsView.has(itemID)) itemsView.set(itemID, new Map<MemberName, number>());
            const itemView = itemsView.get(itemID)!;

            const oldQuantity = itemView.get(memberName) ?? 0;
            itemView.set(memberName, oldQuantity + quantity);
          });
      });

      this.onItemsUpdate?.(itemsView);
    }

    if (updatedInventory) {
      const inventoryView: InventoryView = new Map();
      this.groupData.forEach(({ inventory }, memberName) => {
        inventoryView.set(memberName, structuredClone(inventory));
      });

      this.onInventoryUpdate?.(inventoryView);
    }

    if (updatedNPCInteractions) {
      const npcInteractionsView: NPCInteractionsView = new Map();
      this.groupData.forEach(({ interacting }, name) => {
        if (interacting === undefined) return;
        npcInteractionsView.set(name, interacting);
      });
      this.onNPCInteractionsUpdate?.(npcInteractionsView);
    }

    if (updatedStats) {
      const statsView: StatsView = new Map();
      this.groupData.forEach(({ stats }, name) => {
        if (stats === undefined) return;
        statsView.set(name, stats);
      });
      this.onStatsUpdate?.(statsView);
    }

    if (updatedLastUpdated) {
      const lastUpdatedView: LastUpdatedView = new Map();
      this.groupData.forEach(({ lastUpdated }, name) => {
        if (lastUpdated === undefined) return;
        lastUpdatedView.set(name, lastUpdated);
      });
      this.onLastUpdatedUpdate?.(lastUpdatedView);
    }

    if (updatedSkills) {
      const skillsView: SkillsView = new Map();
      this.groupData.forEach(({ skills }, name) => {
        if (skills === undefined) return;
        skillsView.set(name, skills);
      });
      this.onSkillsUpdate?.(skillsView);
    }
  }

  public onSkillsUpdate?: (skills: SkillsView) => void;
  public onInventoryUpdate?: (inventory: InventoryView) => void;
  public onItemsUpdate?: (items: ItemsView) => void;
  public onNPCInteractionsUpdate?: (interactions: NPCInteractionsView) => void;
  public onStatsUpdate?: (stats: StatsView) => void;
  public onLastUpdatedUpdate?: (lastUpdated: LastUpdatedView) => void;

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
