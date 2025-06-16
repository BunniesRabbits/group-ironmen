import { Routes, Route, useLocation } from "react-router-dom";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { Navigate } from "react-router-dom";
import { useEffect, useState, type ReactElement } from "react";

import "./app.css";
import { CanvasMap } from "./components/canvas-map/canvas-map";
import Api, { loadValidatedCredentials } from "./data/api";

export const App = (): ReactElement => {
  const location = useLocation();
  const [api, setApi] = useState<Api>();

  useEffect(() => {
    if (api === undefined) return;

    api.queueGetGroupData();
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
        <Route path="/logout" element={<LogoutPage callback={() => setApi(undefined)} />} />
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
