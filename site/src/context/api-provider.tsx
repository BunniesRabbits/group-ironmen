import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import Api from "../api/api";
import type { GameData } from "../api/api";
import { GameDataContext } from "./game-data-context";
import { loadValidatedCredentials, type GroupCredentials } from "../api/credentials";
import { APIContext } from "./api-context";
import * as RequestSkillData from "../api/requests/skill-data";

export const APIProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [gameData, setGameData] = useState<GameData>({});
  const [credentials, setCredentials] = useState<GroupCredentials | undefined>(loadValidatedCredentials());
  const [api, setApi] = useState<Api>();

  useEffect(() => {
    if (!credentials) return;
    const newApi = new Api(credentials);

    newApi.overwriteSomeUpdateCallbacks({
      onGameDataUpdate: (data) => setGameData(structuredClone(data)),
    });

    setApi(newApi);

    return (): void => {
      newApi.close();
    };
  }, [credentials]);

  const apiContext: APIContext = {
    logOut: (): void => setCredentials(undefined),
    logIn: (credentials: GroupCredentials): void => setCredentials(credentials),
  };

  if (api?.isOpen()) {
    apiContext.fetchSkillData = (period: RequestSkillData.AggregatePeriod): ReturnType<Api["fetchSkillData"]> => {
      return api.fetchSkillData(period);
    };
    apiContext.setUpdateCallbacks = (callbacks: Parameters<Api["overwriteSomeUpdateCallbacks"]>[0]): void => {
      api.overwriteSomeUpdateCallbacks(callbacks);
    };
  }

  return (
    <APIContext value={apiContext}>
      <GameDataContext value={gameData}>{children}</GameDataContext>
    </APIContext>
  );
};
