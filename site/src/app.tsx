import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { type ReactElement } from "react";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { CanvasMap } from "./components/canvas-map/canvas-map";
import { ItemsPage } from "./components/items-page/items-page";
import { Tooltip } from "./components/tooltip/tooltip";
import { PanelsPage } from "./components/panels-page/panels-page";
import { SkillGraph } from "./components/skill-graph/skill-graph";
import { CreateGroupPage } from "./components/create-group-page/create-group-page";

import "./app.css";

export const App = (): ReactElement => {
  const location = useLocation();

  return (
    <>
      <CanvasMap interactive={location.pathname === "/group/map"} />
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
          path="/create-group"
          element={
            <UnauthedLayout>
              <CreateGroupPage />
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
              <AuthedLayout showPanels={true}>
                <ItemsPage />
              </AuthedLayout>
            }
          />
          <Route path="map" element={<AuthedLayout showPanels={true} />} />
          <Route
            path="graphs"
            element={
              <AuthedLayout showPanels={true}>
                <SkillGraph />
              </AuthedLayout>
            }
          />
          <Route
            path="panels"
            element={
              <AuthedLayout showPanels={false}>
                <PanelsPage />
              </AuthedLayout>
            }
          />
          <Route path="settings" element={<AuthedLayout showPanels={true} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Tooltip />
    </>
  );
};
