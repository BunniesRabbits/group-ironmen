import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app";
import { APIProvider } from "./context/api-provider";
import { GroupStateProvider } from "./context/group-state-provider";
import { GameDataProvider } from "./context/game-data-provider";

const root = document.getElementById("root")!;

createRoot(root).render(
  <StrictMode>
    <APIProvider>
      <GameDataProvider>
        <GroupStateProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </GroupStateProvider>
      </GameDataProvider>
    </APIProvider>
  </StrictMode>,
);
