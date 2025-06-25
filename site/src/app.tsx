import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { type ReactElement } from "react";

import type * as Member from "./data/member";

import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { useCanvasMap } from "./components/canvas-map/canvas-map";
import { ItemsPage } from "./components/items-page/items-page";
import { PlayerPanel } from "./components/player-panel/player-panel";
import { Tooltip } from "./components/tooltip/tooltip";
import { useGroupStateContext } from "./components/group-state/group-state-context";

import "./app.css";

export const App = (): ReactElement => {
  const location = useLocation();

  const group = useGroupStateContext((state) => state);

  /*
   * The collection page shows the other member's items too, so unlike the rest
   * of the member state, we need to aggregate the collection log.
   */
  const collections = [...(group?.members.entries().filter(([name]) => name !== "@SHARED") ?? [])].reduce(
    (collections, [name, { collection }]) => {
      if (!collection) return collections;

      collections.set(name, collection);
      return collections;
    },
    new Map<Member.Name, Member.Collection>(),
  );

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
          xpDrops={group?.xpDrops?.get(name)}
          collections={collections}
        />
      )) ?? [],
  );

  const { coordinateIndicator, controls, backgroundMap } = useCanvasMap({
    interactive: location.pathname === "/group/map",
  });

  return (
    <>
      {backgroundMap}
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
        <Route path="/logout" element={<LogoutPage />} />
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
                {controls}
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
    </>
  );
};
