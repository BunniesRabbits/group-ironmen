import { Routes, Route, useLocation } from "react-router-dom";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";

import "./app.css";
import { CanvasMap } from "./components/canvas-map/canvas-map";

export const App = (): ReactElement => {
  const location = useLocation();

  return (
    <>
      <CanvasMap interactive={location.pathname === "/map" || location.pathname === "/group/map"} />
      <Routes>
        <Route
          index
          element={
            <UnauthedLayout>
              <MenHomepage />
            </UnauthedLayout>
          }
        />
        <Route path="/map" element={<UnauthedLayout></UnauthedLayout>} />
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
          <Route path="items" element={<AuthedLayout />} />
          <Route path="map" element={<AuthedLayout />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
