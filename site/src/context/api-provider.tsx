import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import Api from "../api/api";
import type { GameData, GroupState } from "../api/api";
import { GroupStateContext } from "./group-state-context";
import { useLocation } from "react-router-dom";
import { GameDataContext } from "./game-data-context";
import { loadValidatedCredentials } from "../api/credentials";
import { APIContext } from "./api-context";
import * as RequestSkillData from "../api/requests/skill-data";

export const APIProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const location = useLocation();
  const [group, setGroup] = useState<GroupState>();
  const [gameData, setGameData] = useState<GameData>({});
  const [api, setApi] = useState<Api>();

  useEffect(() => {
    if (api === undefined) return;

    api.startFetchingEverything();
    api.setUpdateCallbacks({
      onGroupUpdate: (group) => setGroup(structuredClone(group)),
      onGameDataUpdate: (data) => setGameData(structuredClone(data)),
    });

    return (): void => {
      api.close();
    };
  }, [api]);

  useEffect(() => {
    if (api !== undefined) return;

    const credentials = loadValidatedCredentials();
    if (credentials === undefined) return;

    setApi(new Api(credentials));
  }, [location, api]);

  const close = useCallback(() => {
    setApi(undefined);
  }, [setApi]);

  const fetchSkillData = useCallback(
    (period: RequestSkillData.AggregatePeriod) => {
      if (!api) return Promise.reject(new Error("No existing API connection."));

      return api.fetchSkillData(period);
    },
    [api],
  );

  return (
    <APIContext value={{ close, fetchSkillData: api ? fetchSkillData : undefined }}>
      <GameDataContext value={gameData}>
        <GroupStateContext value={group}>{children}</GroupStateContext>
      </GameDataContext>
    </APIContext>
  );
};
