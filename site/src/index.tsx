import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { MenHomepage } from "./components/men-homepage/men-homepage.tsx";
import { CanvasMap } from "./components/canvas-map/canvas-map.tsx";

import "./main.css";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions.tsx";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <div className="wrap-routes unauthed-section" style={{ display: "flex", flexDirection: "column" }}>
      <BrowserRouter>
        <Routes>
          <Route path="/map" element={<CanvasMap interactive={true} />} />
          <Route
            index
            element={
              <>
                <CanvasMap interactive={false} />
                <MenHomepage />
              </>
            }
          />
          <Route
            path="/setup-instructions"
            element={
              <>
                <CanvasMap interactive={false} />
                <SetupInstructions />
              </>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  </StrictMode>,
);
