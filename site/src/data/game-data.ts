import { type QuestData } from "./quest-data";
import { type DiaryDatabase } from "./diaries";
import { createContext } from "react";
import type { GEPrices } from "./api";
import type { ItemsDatabase } from "./items";

export interface GameData {
  items?: ItemsDatabase;
  quests?: QuestData;
  diaries?: DiaryDatabase;
  gePrices?: GEPrices;
}
export const GameDataContext = createContext<GameData>({});
