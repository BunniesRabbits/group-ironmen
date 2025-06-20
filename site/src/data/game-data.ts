import { type ItemData } from "./item-data";
import { type QuestData } from "./quest-data";
import { type DiaryData } from "./diary-data";
import { createContext } from "react";
import type { GEPrices } from "./api";

export interface GameData {
  items?: ItemData;
  quests?: QuestData;
  diaries?: DiaryData;
  gePrices?: GEPrices;
}
export const GameDataContext = createContext<GameData>({});
