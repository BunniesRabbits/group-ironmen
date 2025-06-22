import { z } from "zod/v4";
import { type Distinct } from "../util";
import { fetchItemDataJSON, type ItemID, type ItemsDatabase, type ItemStack } from "./items";
import { fetchQuestDataJSON, type QuestData, type QuestID } from "./quest-data";
import { type Experience, type Skill } from "./skill";
import { type DiaryRegion, fetchDiaryDataJSON, type DiaryData, type DiaryTier } from "./diary-data";

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
export type Equipment = z.infer<typeof EquipmentFromBackend>;

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

const SkillsInBackendOrder: Skill[] = [
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
];
const SkillsFromBackend = z
  .array(z.uint32())
  .length(SkillsInBackendOrder.length)
  .transform((xpFlat) => new Map(xpFlat.map((xp, index) => [SkillsInBackendOrder[index], xp as Experience])));
export type Skills = z.infer<typeof SkillsFromBackend>;

const QuestStatusInBackendOrder = ["IN_PROGRESS", "NOT_STARTED", "FINISHED"] as const;
export type QuestStatus = (typeof QuestStatusInBackendOrder)[number];

/**
 * Quests are sent by the backend without IDs. They are sorted by ascending ID order.
 * Thus, if there is a mismatch in length, it is impossible to tell which quests are missing.
 */
const QuestsFromBackend = z
  .uint32()
  .refine((progress) => progress === 0 || progress === 1 || progress === 2)
  .transform((progress) => QuestStatusInBackendOrder[progress])
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
  diaries?: Diaries;
}

const isBitSet = (value: number, offset: number): boolean => {
  return (value & (1 << offset)) !== 0;
};
/**
 * The diaries are stored in a series of 32-bit bitmasks, where different regions/tiers bleed together.
 * I don't think there's an easy way around this, besides storing things differently in the backend.
 * It is unfortunate that we have to hardcode this. For now, the backend sends the data as the raw varbits/varps that OSRS uses.
 */
const DiariesFromBackend = z
  .int32()
  .array()
  .transform((diaryVars) => {
    const result = new Map<DiaryRegion, Map<DiaryTier, boolean[]>>();

    const ardougne = new Map<DiaryTier, boolean[]>();
    const desert = new Map<DiaryTier, boolean[]>();
    const falador = new Map<DiaryTier, boolean[]>();
    const fremennik = new Map<DiaryTier, boolean[]>();
    const kandarin = new Map<DiaryTier, boolean[]>();
    const karamja = new Map<DiaryTier, boolean[]>();
    const kourendKebos = new Map<DiaryTier, boolean[]>();
    const lumbridgeDraynor = new Map<DiaryTier, boolean[]>();
    const morytania = new Map<DiaryTier, boolean[]>();
    const varrock = new Map<DiaryTier, boolean[]>();
    const westernProvinces = new Map<DiaryTier, boolean[]>();
    const wilderness = new Map<DiaryTier, boolean[]>();
    result.set("Ardougne", ardougne);
    result.set("Desert", desert);
    result.set("Falador", falador);
    result.set("Fremennik", fremennik);
    result.set("Kandarin", kandarin);
    result.set("Karamja", karamja);
    result.set("Kourend & Kebos", kourendKebos);
    result.set("Lumbridge & Draynor", lumbridgeDraynor);
    result.set("Morytania", morytania);
    result.set("Varrock", varrock);
    result.set("Western Provinces", westernProvinces);
    result.set("Wilderness", wilderness);

    // Thank you to the original creator for doing the hard part of this.
    ardougne.set("Easy", [
      isBitSet(diaryVars[0], 0),
      isBitSet(diaryVars[0], 1),
      isBitSet(diaryVars[0], 2),
      isBitSet(diaryVars[0], 4),
      isBitSet(diaryVars[0], 5),
      isBitSet(diaryVars[0], 6),
      isBitSet(diaryVars[0], 7),
      isBitSet(diaryVars[0], 9),
      isBitSet(diaryVars[0], 11),
      isBitSet(diaryVars[0], 12),
    ]);
    ardougne.set("Medium", [
      isBitSet(diaryVars[0], 13),
      isBitSet(diaryVars[0], 14),
      isBitSet(diaryVars[0], 15),
      isBitSet(diaryVars[0], 16),
      isBitSet(diaryVars[0], 17),
      isBitSet(diaryVars[0], 18),
      isBitSet(diaryVars[0], 19),
      isBitSet(diaryVars[0], 20),
      isBitSet(diaryVars[0], 21),
      isBitSet(diaryVars[0], 23),
      isBitSet(diaryVars[0], 24),
      isBitSet(diaryVars[0], 25),
    ]);
    ardougne.set("Hard", [
      isBitSet(diaryVars[0], 26),
      isBitSet(diaryVars[0], 27),
      isBitSet(diaryVars[0], 28),
      isBitSet(diaryVars[0], 29),
      isBitSet(diaryVars[0], 30),
      isBitSet(diaryVars[0], 31),
      isBitSet(diaryVars[1], 0),
      isBitSet(diaryVars[1], 1),
      isBitSet(diaryVars[1], 2),
      isBitSet(diaryVars[1], 3),
      isBitSet(diaryVars[1], 4),
      isBitSet(diaryVars[1], 5),
    ]);
    ardougne.set("Elite", [
      isBitSet(diaryVars[1], 6),
      isBitSet(diaryVars[1], 7),
      isBitSet(diaryVars[1], 9),
      isBitSet(diaryVars[1], 8),
      isBitSet(diaryVars[1], 10),
      isBitSet(diaryVars[1], 11),
      isBitSet(diaryVars[1], 12),
      isBitSet(diaryVars[1], 13),
    ]);
    desert.set("Easy", [
      isBitSet(diaryVars[2], 1),
      isBitSet(diaryVars[2], 2),
      isBitSet(diaryVars[2], 3),
      isBitSet(diaryVars[2], 4),
      isBitSet(diaryVars[2], 5),
      isBitSet(diaryVars[2], 6),
      isBitSet(diaryVars[2], 7),
      isBitSet(diaryVars[2], 8),
      isBitSet(diaryVars[2], 9),
      isBitSet(diaryVars[2], 10),
      isBitSet(diaryVars[2], 11),
    ]);
    desert.set("Medium", [
      isBitSet(diaryVars[2], 12),
      isBitSet(diaryVars[2], 13),
      isBitSet(diaryVars[2], 14),
      isBitSet(diaryVars[2], 15),
      isBitSet(diaryVars[2], 16),
      isBitSet(diaryVars[2], 17),
      isBitSet(diaryVars[2], 18),
      isBitSet(diaryVars[2], 19),
      isBitSet(diaryVars[2], 20),
      isBitSet(diaryVars[2], 21),
      isBitSet(diaryVars[2], 22) || isBitSet(diaryVars[3], 9),
      isBitSet(diaryVars[2], 23),
    ]);
    desert.set("Hard", [
      isBitSet(diaryVars[2], 24),
      isBitSet(diaryVars[2], 25),
      isBitSet(diaryVars[2], 26),
      isBitSet(diaryVars[2], 27),
      isBitSet(diaryVars[2], 28),
      isBitSet(diaryVars[2], 29),
      isBitSet(diaryVars[2], 30),
      isBitSet(diaryVars[2], 31),
      isBitSet(diaryVars[3], 0),
      isBitSet(diaryVars[3], 1),
    ]);
    desert.set("Elite", [
      isBitSet(diaryVars[3], 2),
      isBitSet(diaryVars[3], 4),
      isBitSet(diaryVars[3], 5),
      isBitSet(diaryVars[3], 6),
      isBitSet(diaryVars[3], 7),
      isBitSet(diaryVars[3], 8),
    ]);
    falador.set("Easy", [
      isBitSet(diaryVars[4], 0),
      isBitSet(diaryVars[4], 1),
      isBitSet(diaryVars[4], 2),
      isBitSet(diaryVars[4], 3),
      isBitSet(diaryVars[4], 4),
      isBitSet(diaryVars[4], 5),
      isBitSet(diaryVars[4], 6),
      isBitSet(diaryVars[4], 7),
      isBitSet(diaryVars[4], 8),
      isBitSet(diaryVars[4], 9),
      isBitSet(diaryVars[4], 10),
    ]);
    falador.set("Medium", [
      isBitSet(diaryVars[4], 11),
      isBitSet(diaryVars[4], 12),
      isBitSet(diaryVars[4], 13),
      isBitSet(diaryVars[4], 14),
      isBitSet(diaryVars[4], 15),
      isBitSet(diaryVars[4], 16),
      isBitSet(diaryVars[4], 17),
      isBitSet(diaryVars[4], 18),
      isBitSet(diaryVars[4], 20),
      isBitSet(diaryVars[4], 21),
      isBitSet(diaryVars[4], 22),
      isBitSet(diaryVars[4], 23),
      isBitSet(diaryVars[4], 24),
      isBitSet(diaryVars[4], 25),
    ]);
    falador.set("Hard", [
      isBitSet(diaryVars[4], 26),
      isBitSet(diaryVars[4], 27),
      isBitSet(diaryVars[4], 28),
      isBitSet(diaryVars[4], 29),
      isBitSet(diaryVars[4], 30),
      isBitSet(diaryVars[4], 31),
      isBitSet(diaryVars[5], 0),
      isBitSet(diaryVars[5], 1),
      isBitSet(diaryVars[5], 2),
      isBitSet(diaryVars[5], 3),
      isBitSet(diaryVars[5], 4),
    ]);
    falador.set("Elite", [
      isBitSet(diaryVars[5], 5),
      isBitSet(diaryVars[5], 6),
      isBitSet(diaryVars[5], 7),
      isBitSet(diaryVars[5], 8),
      isBitSet(diaryVars[5], 9),
      isBitSet(diaryVars[5], 10),
    ]);
    fremennik.set("Easy", [
      isBitSet(diaryVars[6], 1),
      isBitSet(diaryVars[6], 2),
      isBitSet(diaryVars[6], 3),
      isBitSet(diaryVars[6], 4),
      isBitSet(diaryVars[6], 5),
      isBitSet(diaryVars[6], 6),
      isBitSet(diaryVars[6], 7),
      isBitSet(diaryVars[6], 8),
      isBitSet(diaryVars[6], 9),
      isBitSet(diaryVars[6], 10),
    ]);
    fremennik.set("Medium", [
      isBitSet(diaryVars[6], 11),
      isBitSet(diaryVars[6], 12),
      isBitSet(diaryVars[6], 13),
      isBitSet(diaryVars[6], 14),
      isBitSet(diaryVars[6], 15),
      isBitSet(diaryVars[6], 17),
      isBitSet(diaryVars[6], 18),
      isBitSet(diaryVars[6], 19),
      isBitSet(diaryVars[6], 20),
    ]);
    fremennik.set("Hard", [
      isBitSet(diaryVars[6], 21),
      isBitSet(diaryVars[6], 23),
      isBitSet(diaryVars[6], 24),
      isBitSet(diaryVars[6], 25),
      isBitSet(diaryVars[6], 26),
      isBitSet(diaryVars[6], 27),
      isBitSet(diaryVars[6], 28),
      isBitSet(diaryVars[6], 29),
      isBitSet(diaryVars[6], 30),
    ]);
    fremennik.set("Elite", [
      isBitSet(diaryVars[6], 31),
      isBitSet(diaryVars[7], 0),
      isBitSet(diaryVars[7], 1),
      isBitSet(diaryVars[7], 2),
      isBitSet(diaryVars[7], 3),
      isBitSet(diaryVars[7], 4),
    ]);
    kandarin.set("Easy", [
      isBitSet(diaryVars[8], 1),
      isBitSet(diaryVars[8], 2),
      isBitSet(diaryVars[8], 3),
      isBitSet(diaryVars[8], 4),
      isBitSet(diaryVars[8], 5),
      isBitSet(diaryVars[8], 6),
      isBitSet(diaryVars[8], 7),
      isBitSet(diaryVars[8], 8),
      isBitSet(diaryVars[8], 9),
      isBitSet(diaryVars[8], 10),
      isBitSet(diaryVars[8], 11),
    ]);
    kandarin.set("Medium", [
      isBitSet(diaryVars[8], 12),
      isBitSet(diaryVars[8], 13),
      isBitSet(diaryVars[8], 14),
      isBitSet(diaryVars[8], 15),
      isBitSet(diaryVars[8], 16),
      isBitSet(diaryVars[8], 17),
      isBitSet(diaryVars[8], 18),
      isBitSet(diaryVars[8], 19),
      isBitSet(diaryVars[8], 20),
      isBitSet(diaryVars[8], 21),
      isBitSet(diaryVars[8], 22),
      isBitSet(diaryVars[8], 23),
      isBitSet(diaryVars[8], 24),
      isBitSet(diaryVars[8], 25),
    ]);
    kandarin.set("Hard", [
      isBitSet(diaryVars[8], 26),
      isBitSet(diaryVars[8], 27),
      isBitSet(diaryVars[8], 28),
      isBitSet(diaryVars[8], 29),
      isBitSet(diaryVars[8], 30),
      isBitSet(diaryVars[8], 31),
      isBitSet(diaryVars[9], 0),
      isBitSet(diaryVars[9], 1),
      isBitSet(diaryVars[9], 2),
      isBitSet(diaryVars[9], 3),
      isBitSet(diaryVars[9], 4),
    ]);
    kandarin.set("Elite", [
      isBitSet(diaryVars[9], 5),
      isBitSet(diaryVars[9], 6),
      isBitSet(diaryVars[9], 7),
      isBitSet(diaryVars[9], 8),
      isBitSet(diaryVars[9], 9),
      isBitSet(diaryVars[9], 10),
      isBitSet(diaryVars[9], 11),
    ]);
    karamja.set("Easy", [
      diaryVars[23] === 5,
      diaryVars[24] === 1,
      diaryVars[25] === 1,
      diaryVars[26] === 1,
      diaryVars[27] === 1,
      diaryVars[28] === 1,
      diaryVars[29] === 1,
      diaryVars[30] === 5,
      diaryVars[31] === 1,
      diaryVars[32] === 1,
    ]);
    karamja.set("Medium", [
      diaryVars[33] === 1,
      diaryVars[34] === 1,
      diaryVars[35] === 1,
      diaryVars[36] === 1,
      diaryVars[37] === 1,
      diaryVars[38] === 1,
      diaryVars[39] === 1,
      diaryVars[40] === 1,
      diaryVars[41] === 1,
      diaryVars[42] === 1,
      diaryVars[43] === 1,
      diaryVars[44] === 1,
      diaryVars[45] === 1,
      diaryVars[46] === 1,
      diaryVars[47] === 1,
      diaryVars[48] === 1,
      diaryVars[49] === 1,
      diaryVars[50] === 1,
      diaryVars[51] === 1,
    ]);
    karamja.set("Hard", [
      diaryVars[52] === 1,
      diaryVars[53] === 1,
      diaryVars[54] === 1,
      diaryVars[55] === 1,
      diaryVars[56] === 1,
      diaryVars[57] === 1,
      diaryVars[58] === 1,
      diaryVars[59] === 5,
      diaryVars[60] === 1,
      diaryVars[61] === 1,
    ]);
    karamja.set("Elite", [
      isBitSet(diaryVars[10], 1),
      isBitSet(diaryVars[10], 2),
      isBitSet(diaryVars[10], 3),
      isBitSet(diaryVars[10], 4),
      isBitSet(diaryVars[10], 5),
    ]);
    kourendKebos.set("Easy", [
      isBitSet(diaryVars[11], 1),
      isBitSet(diaryVars[11], 2),
      isBitSet(diaryVars[11], 3),
      isBitSet(diaryVars[11], 4),
      isBitSet(diaryVars[11], 5),
      isBitSet(diaryVars[11], 6),
      isBitSet(diaryVars[11], 7),
      isBitSet(diaryVars[11], 8),
      isBitSet(diaryVars[11], 9),
      isBitSet(diaryVars[11], 10),
      isBitSet(diaryVars[11], 11),
      isBitSet(diaryVars[11], 12),
    ]);
    kourendKebos.set("Medium", [
      isBitSet(diaryVars[11], 25),
      isBitSet(diaryVars[11], 13),
      isBitSet(diaryVars[11], 14),
      isBitSet(diaryVars[11], 15),
      isBitSet(diaryVars[11], 21),
      isBitSet(diaryVars[11], 16),
      isBitSet(diaryVars[11], 17),
      isBitSet(diaryVars[11], 18),
      isBitSet(diaryVars[11], 19),
      isBitSet(diaryVars[11], 22),
      isBitSet(diaryVars[11], 20),
      isBitSet(diaryVars[11], 23),
      isBitSet(diaryVars[11], 24),
    ]);
    kourendKebos.set("Hard", [
      isBitSet(diaryVars[11], 26),
      isBitSet(diaryVars[11], 27),
      isBitSet(diaryVars[11], 28),
      isBitSet(diaryVars[11], 29),
      isBitSet(diaryVars[11], 31),
      isBitSet(diaryVars[11], 30),
      isBitSet(diaryVars[12], 0),
      isBitSet(diaryVars[12], 1),
      isBitSet(diaryVars[12], 2),
      isBitSet(diaryVars[12], 3),
    ]);
    kourendKebos.set("Elite", [
      isBitSet(diaryVars[12], 4),
      isBitSet(diaryVars[12], 5),
      isBitSet(diaryVars[12], 6),
      isBitSet(diaryVars[12], 7),
      isBitSet(diaryVars[12], 8),
      isBitSet(diaryVars[12], 9),
      isBitSet(diaryVars[12], 10),
      isBitSet(diaryVars[12], 11),
    ]);
    lumbridgeDraynor.set("Easy", [
      isBitSet(diaryVars[13], 1),
      isBitSet(diaryVars[13], 2),
      isBitSet(diaryVars[13], 3),
      isBitSet(diaryVars[13], 4),
      isBitSet(diaryVars[13], 5),
      isBitSet(diaryVars[13], 6),
      isBitSet(diaryVars[13], 7),
      isBitSet(diaryVars[13], 8),
      isBitSet(diaryVars[13], 9),
      isBitSet(diaryVars[13], 10),
      isBitSet(diaryVars[13], 11),
      isBitSet(diaryVars[13], 12),
    ]);
    lumbridgeDraynor.set("Medium", [
      isBitSet(diaryVars[13], 13),
      isBitSet(diaryVars[13], 14),
      isBitSet(diaryVars[13], 15),
      isBitSet(diaryVars[13], 16),
      isBitSet(diaryVars[13], 17),
      isBitSet(diaryVars[13], 18),
      isBitSet(diaryVars[13], 19),
      isBitSet(diaryVars[13], 20),
      isBitSet(diaryVars[13], 21),
      isBitSet(diaryVars[13], 22),
      isBitSet(diaryVars[13], 23),
      isBitSet(diaryVars[13], 24),
    ]);
    lumbridgeDraynor.set("Hard", [
      isBitSet(diaryVars[13], 25),
      isBitSet(diaryVars[13], 26),
      isBitSet(diaryVars[13], 27),
      isBitSet(diaryVars[13], 28),
      isBitSet(diaryVars[13], 29),
      isBitSet(diaryVars[13], 30),
      isBitSet(diaryVars[13], 31),
      isBitSet(diaryVars[14], 0),
      isBitSet(diaryVars[14], 1),
      isBitSet(diaryVars[14], 2),
      isBitSet(diaryVars[14], 3),
    ]);
    lumbridgeDraynor.set("Elite", [
      isBitSet(diaryVars[14], 4),
      isBitSet(diaryVars[14], 5),
      isBitSet(diaryVars[14], 6),
      isBitSet(diaryVars[14], 7),
      isBitSet(diaryVars[14], 8),
      isBitSet(diaryVars[14], 9),
    ]);
    morytania.set("Easy", [
      isBitSet(diaryVars[15], 1),
      isBitSet(diaryVars[15], 2),
      isBitSet(diaryVars[15], 3),
      isBitSet(diaryVars[15], 4),
      isBitSet(diaryVars[15], 5),
      isBitSet(diaryVars[15], 6),
      isBitSet(diaryVars[15], 7),
      isBitSet(diaryVars[15], 8),
      isBitSet(diaryVars[15], 9),
      isBitSet(diaryVars[15], 10),
      isBitSet(diaryVars[15], 11),
    ]);
    morytania.set("Medium", [
      isBitSet(diaryVars[15], 12),
      isBitSet(diaryVars[15], 13),
      isBitSet(diaryVars[15], 14),
      isBitSet(diaryVars[15], 15),
      isBitSet(diaryVars[15], 16),
      isBitSet(diaryVars[15], 17),
      isBitSet(diaryVars[15], 18),
      isBitSet(diaryVars[15], 19),
      isBitSet(diaryVars[15], 20),
      isBitSet(diaryVars[15], 21),
      isBitSet(diaryVars[15], 22),
    ]);
    morytania.set("Hard", [
      isBitSet(diaryVars[15], 23),
      isBitSet(diaryVars[15], 24),
      isBitSet(diaryVars[15], 25),
      isBitSet(diaryVars[15], 26),
      isBitSet(diaryVars[15], 27),
      isBitSet(diaryVars[15], 28),
      isBitSet(diaryVars[15], 29),
      isBitSet(diaryVars[15], 30),
      isBitSet(diaryVars[16], 1),
      isBitSet(diaryVars[16], 2),
    ]);
    morytania.set("Elite", [
      isBitSet(diaryVars[16], 3),
      isBitSet(diaryVars[16], 4),
      isBitSet(diaryVars[16], 5),
      isBitSet(diaryVars[16], 6),
      isBitSet(diaryVars[16], 7),
      isBitSet(diaryVars[16], 8),
    ]);
    varrock.set("Easy", [
      isBitSet(diaryVars[17], 1),
      isBitSet(diaryVars[17], 2),
      isBitSet(diaryVars[17], 3),
      isBitSet(diaryVars[17], 4),
      isBitSet(diaryVars[17], 5),
      isBitSet(diaryVars[17], 6),
      isBitSet(diaryVars[17], 7),
      isBitSet(diaryVars[17], 8),
      isBitSet(diaryVars[17], 9),
      isBitSet(diaryVars[17], 10),
      isBitSet(diaryVars[17], 11),
      isBitSet(diaryVars[17], 12),
      isBitSet(diaryVars[17], 13),
      isBitSet(diaryVars[17], 14),
    ]);
    varrock.set("Medium", [
      isBitSet(diaryVars[17], 15),
      isBitSet(diaryVars[17], 16),
      isBitSet(diaryVars[17], 18),
      isBitSet(diaryVars[17], 19),
      isBitSet(diaryVars[17], 20),
      isBitSet(diaryVars[17], 21),
      isBitSet(diaryVars[17], 22),
      isBitSet(diaryVars[17], 23),
      isBitSet(diaryVars[17], 24),
      isBitSet(diaryVars[17], 25),
      isBitSet(diaryVars[17], 26),
      isBitSet(diaryVars[17], 27),
      isBitSet(diaryVars[17], 28),
    ]);
    varrock.set("Hard", [
      isBitSet(diaryVars[17], 29),
      isBitSet(diaryVars[17], 30),
      isBitSet(diaryVars[17], 31),
      isBitSet(diaryVars[18], 0),
      isBitSet(diaryVars[18], 1),
      isBitSet(diaryVars[18], 2),
      isBitSet(diaryVars[18], 3),
      isBitSet(diaryVars[18], 4),
      isBitSet(diaryVars[18], 5),
      isBitSet(diaryVars[18], 6),
    ]);
    varrock.set("Elite", [
      isBitSet(diaryVars[18], 7),
      isBitSet(diaryVars[18], 8),
      isBitSet(diaryVars[18], 9),
      isBitSet(diaryVars[18], 10),
      isBitSet(diaryVars[18], 11),
    ]);
    westernProvinces.set("Easy", [
      isBitSet(diaryVars[19], 1),
      isBitSet(diaryVars[19], 2),
      isBitSet(diaryVars[19], 3),
      isBitSet(diaryVars[19], 4),
      isBitSet(diaryVars[19], 5),
      isBitSet(diaryVars[19], 6),
      isBitSet(diaryVars[19], 7),
      isBitSet(diaryVars[19], 8),
      isBitSet(diaryVars[19], 9),
      isBitSet(diaryVars[19], 10),
      isBitSet(diaryVars[19], 11),
    ]);
    westernProvinces.set("Medium", [
      isBitSet(diaryVars[19], 12),
      isBitSet(diaryVars[19], 13),
      isBitSet(diaryVars[19], 14),
      isBitSet(diaryVars[19], 15),
      isBitSet(diaryVars[19], 16),
      isBitSet(diaryVars[19], 17),
      isBitSet(diaryVars[19], 18),
      isBitSet(diaryVars[19], 19),
      isBitSet(diaryVars[19], 20),
      isBitSet(diaryVars[19], 21),
      isBitSet(diaryVars[19], 22),
      isBitSet(diaryVars[19], 23),
      isBitSet(diaryVars[19], 24),
    ]);
    westernProvinces.set("Hard", [
      isBitSet(diaryVars[19], 25),
      isBitSet(diaryVars[19], 26),
      isBitSet(diaryVars[19], 27),
      isBitSet(diaryVars[19], 28),
      isBitSet(diaryVars[19], 29),
      isBitSet(diaryVars[19], 30),
      isBitSet(diaryVars[19], 31),
      isBitSet(diaryVars[20], 0),
      isBitSet(diaryVars[20], 1),
      isBitSet(diaryVars[20], 2),
      isBitSet(diaryVars[20], 3),
      isBitSet(diaryVars[20], 4),
      isBitSet(diaryVars[20], 5),
    ]);
    westernProvinces.set("Elite", [
      isBitSet(diaryVars[20], 6),
      isBitSet(diaryVars[20], 7),
      isBitSet(diaryVars[20], 8),
      isBitSet(diaryVars[20], 9),
      isBitSet(diaryVars[20], 12),
      isBitSet(diaryVars[20], 13),
      isBitSet(diaryVars[20], 14),
    ]);
    wilderness.set("Easy", [
      isBitSet(diaryVars[21], 1),
      isBitSet(diaryVars[21], 2),
      isBitSet(diaryVars[21], 3),
      isBitSet(diaryVars[21], 4),
      isBitSet(diaryVars[21], 5),
      isBitSet(diaryVars[21], 6),
      isBitSet(diaryVars[21], 7),
      isBitSet(diaryVars[21], 8),
      isBitSet(diaryVars[21], 9),
      isBitSet(diaryVars[21], 10),
      isBitSet(diaryVars[21], 11),
      isBitSet(diaryVars[21], 12),
    ]);
    wilderness.set("Medium", [
      isBitSet(diaryVars[21], 13),
      isBitSet(diaryVars[21], 14),
      isBitSet(diaryVars[21], 15),
      isBitSet(diaryVars[21], 16),
      isBitSet(diaryVars[21], 18),
      isBitSet(diaryVars[21], 19),
      isBitSet(diaryVars[21], 20),
      isBitSet(diaryVars[21], 21),
      isBitSet(diaryVars[21], 22),
      isBitSet(diaryVars[21], 23),
      isBitSet(diaryVars[21], 24),
    ]);
    wilderness.set("Hard", [
      isBitSet(diaryVars[21], 25),
      isBitSet(diaryVars[21], 26),
      isBitSet(diaryVars[21], 27),
      isBitSet(diaryVars[21], 28),
      isBitSet(diaryVars[21], 29),
      isBitSet(diaryVars[21], 30),
      isBitSet(diaryVars[21], 31),
      isBitSet(diaryVars[22], 0),
      isBitSet(diaryVars[22], 1),
      isBitSet(diaryVars[22], 2),
    ]);
    wilderness.set("Elite", [
      isBitSet(diaryVars[22], 3),
      isBitSet(diaryVars[22], 5),
      isBitSet(diaryVars[22], 7),
      isBitSet(diaryVars[22], 8),
      isBitSet(diaryVars[22], 9),
      isBitSet(diaryVars[22], 10),
      isBitSet(diaryVars[22], 11),
    ]);

    return result;
  });
export type Diaries = z.infer<typeof DiariesFromBackend>;

export type InventoryView = Map<MemberName, Inventory>;
export type EquipmentView = Map<MemberName, Equipment>;
export type ItemsView = Map<ItemID, Map<MemberName, number>>;
export type NPCInteractionsView = Map<MemberName, NPCInteraction>;
export type StatsView = Map<MemberName, Stats>;
export type LastUpdatedView = Map<MemberName, Date>;
export type SkillsView = Map<MemberName, Skills>;
export type QuestsView = Map<MemberName, Quests>;
export type DiariesView = Map<MemberName, Diaries>;

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
  /**
   * Achievement diary progression
   */
  diary_vars: DiariesFromBackend.optional(),
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
  onDiariesUpdate: (diaries: DiariesView) => void;
  onItemDataUpdate: (itemData: ItemsDatabase) => void;
  onQuestDataUpdate: (questData: QuestData) => void;
  onDiaryDataUpdate: (diaryData: DiaryData) => void;
  onGEDataUpdate: (geData: GEPrices) => void;
}
export default class Api {
  private baseURL: string;
  private credentials: ApiCredentials;
  private groupDataValidUpToDate?: Date;
  private getGroupDataPromise?: Promise<void>;
  private closed: boolean;
  private groupData: Map<MemberName, MemberData>;
  private knownMembers: MemberName[];
  private itemDatabase?: ItemsDatabase;
  private questData?: QuestData;
  private diaryData?: DiaryData;
  private geData?: GEPrices;

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
    let updatedDiaries = false;

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
      diary_vars,
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

      if (diary_vars !== undefined) {
        memberData.diaries = new Map(diary_vars);
        updatedDiaries = true;
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

    if (updatedDiaries) {
      const diariesView: DiariesView = new Map();
      this.groupData.forEach(({ diaries }, name) => {
        if (diaries === undefined) return;
        diariesView.set(name, diaries);
      });
      this.callbacks?.onDiariesUpdate(diariesView);
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
      fetch(makeGetGEPricesURL({ baseURL: this.baseURL }))
        .then((response) => response.json())
        .then((json) => GEPricesFromBackend.safeParseAsync(json))
        .then((parseResult) => {
          if (!parseResult.success) throw new Error("Failed to parse GEPrices response", { cause: parseResult.error });
          return parseResult.data;
        })
        .then((data) => {
          this.geData = data;
          this.callbacks?.onGEDataUpdate(data);
        })
        .catch((reason) => console.error("Failed to get grand exchange data for API", reason));
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
  public startFetchingEverything(): void {
    if (this.getGroupDataPromise !== undefined) return;

    if (this.questData === undefined || this.itemDatabase === undefined) this.queueGetGameData();

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
          this.startFetchingEverything();
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
}
