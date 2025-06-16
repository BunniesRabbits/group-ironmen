import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { MenHomepage } from "./components/men-homepage/men-homepage.tsx";

import { SetupInstructions } from "./components/setup-instructions/setup-instructions.tsx";
import { LoginPage } from "./components/login-page/login-page.tsx";
import { UnauthedLayout } from "./layout.tsx";

import "./main.css";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <div className="wrap-routes unauthed-section" style={{ display: "flex", flexDirection: "column" }}>
      <BrowserRouter>
        <Routes>
          <Route
            index
            element={
              <UnauthedLayout>
                <MenHomepage />
              </UnauthedLayout>
            }
          />
          <Route path="/map" element={<UnauthedLayout isMapPage />} />
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
          <Route path="/group">
            <Route index element={<Navigate to="items" replace />} />
            <Route path="items" element={<UnauthedLayout>{localStorage.getItem("groupName")}</UnauthedLayout>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  </StrictMode>,
);
