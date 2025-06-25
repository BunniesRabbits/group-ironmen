import { createContext } from "react";
import type { GameData } from "../data/api";

export const GameDataContext = createContext<GameData>({});
