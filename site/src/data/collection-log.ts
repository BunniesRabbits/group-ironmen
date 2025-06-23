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
  tabs: Map<TabName, Page[]>;
}
