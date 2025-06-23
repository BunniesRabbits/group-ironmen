import { Routes, Route, useLocation } from "react-router-dom";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { Navigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";

import "./app.css";
import { useCanvasMap } from "./components/canvas-map/canvas-map";
import Api, { type GroupState } from "./data/api";
import { ItemsPage } from "./components/items-page/items-page";
import { PlayerPanel } from "./components/player-panel/player-panel";
import { Tooltip } from "./components/tooltip/tooltip";
import { GameDataContext, type GameData } from "./data/game-data";
import { loadValidatedCredentials } from "./data/credentials";

interface APIConnectionWithDataViews {
  close: () => void;
  group: GroupState;
}

/**
 * A hook that provides access to the backend network API, but also game data, wrapped and processed somewhat.
 *
 * For example, loading quests over the network requires resolving their IDs from the quests information themselves.
 * But that information is loaded from a json file, so processing quests requires synchronization which this hook provides.
 *
 * Data is only provided when it is ready to be used.
 */
const useAPI = (): Partial<APIConnectionWithDataViews> & { gameData: GameData } => {
  const location = useLocation();
  const [api, setApi] = useState<Api>();
  const [group, setGroup] = useState<GroupState>();

  const gameDataRef = useRef<GameData>({});

  useEffect(() => {
    if (api === undefined) return;

    api.setUpdateCallbacks({
      onGroupUpdate: (group) => setGroup(structuredClone(group)),
      onItemDataUpdate: (data) => {
        gameDataRef.current.items = data;
      },
      onQuestDataUpdate: (data) => {
        gameDataRef.current.quests = data;
      },
      onDiaryDataUpdate: (data) => {
        gameDataRef.current.diaries = data;
      },
      onGEDataUpdate: (data) => {
        gameDataRef.current.gePrices = data;
      },
    });

    api.startFetchingEverything();

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

  return {
    close,
    group,
    gameData: gameDataRef.current,
  };
};

export const App = (): ReactElement => {
  const location = useLocation();

  const { close: closeAPI, group, gameData } = useAPI();

  const panels = Array.from(
    group?.members
      .entries()
      .filter(([name]) => name !== "@SHARED")
      .map<ReactElement>(([name, state]) => (
        <PlayerPanel
          key={name}
          interacting={state.interacting}
          inventory={state.inventory}
          equipment={state.equipment}
          skills={state.skills}
          quests={state.quests}
          diaries={state.diaries}
          player={name}
          lastUpdated={state.lastUpdated}
          stats={state.stats}
          collection={state.collection}
        />
      )) ?? [],
  );

  const { coordinateIndicator, planeSelect, backgroundMap } = useCanvasMap({
    interactive: location.pathname === "/group/map",
  });

  return (
    <>
      {backgroundMap}
      <GameDataContext value={gameData}>
        <Routes>
          <Route
            index
            element={
              <UnauthedLayout>
                <MenHomepage />
              </UnauthedLayout>
            }
          />
          <Route
            path="/setup-instructions"
            element={
              <UnauthedLayout>
                <SetupInstructions />
              </UnauthedLayout>
            }
          />
          <Route
            path="/login"
            element={
              <UnauthedLayout>
                <LoginPage />
              </UnauthedLayout>
            }
          />
          <Route path="/logout" element={<LogoutPage callback={closeAPI} />} />
          <Route path="/group">
            <Route index element={<Navigate to="items" replace />} />
            <Route
              path="items"
              element={
                <AuthedLayout panels={panels}>
                  <ItemsPage memberNames={[...(group?.members.keys() ?? [])]} items={group?.items} />
                </AuthedLayout>
              }
            />
            <Route
              path="map"
              element={
                <AuthedLayout panels={panels}>
                  {planeSelect}
                  {coordinateIndicator}
                </AuthedLayout>
              }
            />
            <Route path="graphs" element={<AuthedLayout panels={panels} />} />
            <Route
              path="panels"
              element={
                <AuthedLayout panels={undefined}>
                  <div id="panels-page-container">{panels}</div>
                </AuthedLayout>
              }
            />
            <Route path="settings" element={<AuthedLayout panels={panels} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Tooltip />
      </GameDataContext>
    </>
  );
};
