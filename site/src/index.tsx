import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app";
import { BrowserRouter } from "react-router-dom";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <div className="wrap-routes unauthed-section" style={{ display: "flex", flexDirection: "column" }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </div>
  </StrictMode>,
);
