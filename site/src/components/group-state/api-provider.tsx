import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from "react";
import type { GameData, GroupState } from "../../data/api";
import { GroupStateContext } from "./group-state-context";
import Api from "../../data/api";
import { useLocation } from "react-router-dom";
import { GameDataContext } from "./game-data-context";
import { loadValidatedCredentials } from "../../data/credentials";
import { APIContext } from "./api-context";

export const APIProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const location = useLocation();
  const [group, setGroup] = useState<GroupState>();
  const [gameData, setGameData] = useState<GameData>({});
  const [api, setApi] = useState<Api>();

  useEffect(() => {
    if (api === undefined) return;

    api.startFetchingEverything();

    return (): void => {
      api.close();
    };
  }, [api]);

  useEffect(() => {
    if (api === undefined) return;

    api.setUpdateCallbacks({
      onGroupUpdate: (group) => setGroup(structuredClone(group)),
      onGameDataUpdate: (data) => setGameData(structuredClone(data)),
    });
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

  return (
    <APIContext value={{ close }}>
      <GameDataContext value={gameData}>
        <GroupStateContext value={group}>{children}</GroupStateContext>
      </GameDataContext>
    </APIContext>
  );
};
