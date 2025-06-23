import type { Distinct } from "../util";
import type { ItemID } from "./items";

export const Tab = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
export type Tab = (typeof Tab)[number];
export type PageName = Distinct<string, "CollectionLog.PageName">;
export interface CollectionLogInfo {
  tabs: Map<
    Tab,
    {
      name: PageName;
      completionLabels: string[];
      items: ItemID[];
    }[]
  >;
}
