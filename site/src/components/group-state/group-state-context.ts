import { createContext, useContext } from "react";
import type { GroupState } from "../../data/api";

type GroupStateSelector<T> = (state: GroupState) => T;

export const GroupStateContext = createContext<GroupState | undefined>(undefined);
export const useGroupStateContext = <T>(selector: GroupStateSelector<T>): T | undefined => {
  const state = useContext(GroupStateContext);

  if (!state) return undefined;

  return selector(state);
};
