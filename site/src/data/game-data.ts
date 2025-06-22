import { type QuestData } from "./quest-data";
import { type DiaryData } from "./diary-data";
import { createContext } from "react";
import type { GEPrices } from "./api";
import type { ItemsDatabase } from "./items";

export interface GameData {
  items?: ItemsDatabase;
  quests?: QuestData;
  diaries?: DiaryData;
  gePrices?: GEPrices;
}
export const GameDataContext = createContext<GameData>({});
