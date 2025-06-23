import type { Distinct } from "../util";

export const Tab = ["Bosses", "Raids", "Clues", "Minigames", "Other"] as const;
export type Tab = (typeof Tab)[number];
export type PageName = Distinct<string, "CollectionLog.PageName">;
