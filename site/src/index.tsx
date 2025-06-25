import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import { APIProvider } from "./components/group-state/api-provider";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <APIProvider>
        <App />
      </APIProvider>
    </BrowserRouter>
  </StrictMode>,
);
