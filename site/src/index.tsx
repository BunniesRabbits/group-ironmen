import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";

import { MenHomepage } from "./components/men-homepage/men-homepage.tsx";

import "./main.css";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions.tsx";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <div className="wrap-routes unauthed-section" style={{ display: "flex", flexDirection: "column" }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MenHomepage />} />
          <Route path="/setup-instructions" element={<SetupInstructions />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  </StrictMode>,
);
