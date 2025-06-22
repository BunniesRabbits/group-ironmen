import { type QuestDatabase } from "./quests";
import { type DiaryDatabase } from "./diaries";
import { createContext } from "react";
import type { ItemsDatabase } from "./items";
import type { GEPrices } from "./requests/ge-prices";

export interface GameData {
  items?: ItemsDatabase;
  quests?: QuestDatabase;
  diaries?: DiaryDatabase;
  gePrices?: GEPrices;
}
export const GameDataContext = createContext<GameData>({});
