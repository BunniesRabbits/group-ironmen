import { type QuestDatabase } from "./quests";
import { type DiaryDatabase } from "./diaries";
import { createContext } from "react";
import type { GEPrices } from "./api";
import type { ItemsDatabase } from "./items";

export interface GameData {
  items?: ItemsDatabase;
  quests?: QuestDatabase;
  diaries?: DiaryDatabase;
  gePrices?: GEPrices;
}
export const GameDataContext = createContext<GameData>({});
