import type { Distinct } from "../util";
import type { ItemID } from "./items";

export const TabName = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
export type TabName = (typeof TabName)[number];
export type PageName = Distinct<string, "CollectionLog.PageName">;
export interface Page {
  name: PageName;
  completionLabels: string[];
  items: ItemID[];
}
export interface CollectionLogInfo {
  /**
   * This is the total amount of unlockable slots.
   *
   * This is different than going through and totalling each page's items!
   * Duplicate item IDs across pages (such as the dragon pickaxe in all the
   * wilderness posses) are not double counted. Also, there are some unique item
   * IDs that count for each other, such as Motherlode Mine vs Volcanic
   * Mine prospector's gear.
   */
  uniqueSlots: number;
  tabs: Map<TabName, Page[]>;
}
