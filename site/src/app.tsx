import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { type ReactElement } from "react";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { useCanvasMap } from "./components/canvas-map/canvas-map";
import { ItemsPage } from "./components/items-page/items-page";
import { PlayerPanel } from "./components/player-panel/player-panel";
import { Tooltip } from "./components/tooltip/tooltip";
import { useGroupListMembersContext } from "./context/group-state-context";

import "./app.css";

export const App = (): ReactElement => {
  const location = useLocation();

  const groupMembers = useGroupListMembersContext();

  const panels = groupMembers
    .filter((member) => member !== "@SHARED")
    .map<ReactElement>((member) => <PlayerPanel key={member} member={member} />);

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
                <ItemsPage />
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
