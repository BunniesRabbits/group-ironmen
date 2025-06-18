import { Routes, Route, useLocation } from "react-router-dom";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { Navigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";

import "./app.css";
import { useCanvasMap } from "./components/canvas-map/canvas-map";
import Api, {
  type EquipmentView,
  type GEPrices,
  type InventoryView,
  type ItemsView,
  type LastUpdatedView,
  loadValidatedCredentials,
  type MemberName,
  type NPCInteractionsView,
  type QuestsView,
  type SkillsView,
  type StatsView,
} from "./data/api";
import { ItemsPage } from "./components/items-page/items-page";
import { PlayerPanel } from "./components/player-panel/player-panel";
import { fetchItemDataJSON, type ItemData } from "./data/item-data";
import { fetchQuestDataJSON, type QuestData } from "./data/quest-data";

interface GameData {
  items: ItemData;
  quests: QuestData;
}
/**
 * Asynchronously loads game assets such as item/quest descriptions.
 * Values are individually undefined until loading succeeds.
 */
const useGameData = (): Partial<GameData> => {
  const [itemData, setItemData] = useState<ItemData>();
  const itemPromiseRef = useRef<Promise<void>>(undefined);

  const [questData, setQuestData] = useState<QuestData>();
  const questPromiseRef = useRef<Promise<void>>(undefined);

  /*
   * We don't need to worry about cache invalidation since this data is a static asset that is updated rarely.
   * Users can refresh if they want to see a game update reflected.
   * Thus, we do a simple fetch with promise.
   */

  useEffect(() => {
    // Promises will try infinitely to load, not good for long run but ok for now

    if (questData === undefined) {
      questPromiseRef.current ??= fetchQuestDataJSON()
        .then((questData) => setQuestData(questData))
        .catch((error) => console.error("Failed to get quest data", error))
        .finally(() => {
          questPromiseRef.current = undefined;
        });
    }

    if (itemData === undefined) {
      itemPromiseRef.current ??= fetchItemDataJSON()
        .then((itemData) => setItemData(itemData))
        .catch((error) => console.error("Failed to get item data", error))
        .finally(() => {
          itemPromiseRef.current = undefined;
        });
    }
  }, [itemData, questData]);

  return { items: itemData, quests: questData };
};

interface APIConnectionWithDataViews {
  close: () => void;
  itemsView: ItemsView;
  gePrices: GEPrices;
  npcInteractions: NPCInteractionsView;
  stats: StatsView;
  lastUpdated: LastUpdatedView;
  inventoryView: InventoryView;
  equipmentView: EquipmentView;
  skills: SkillsView;
  quests: QuestsView;
  knownMembers: MemberName[];
}
const useAPI = (): Partial<APIConnectionWithDataViews> => {
  const location = useLocation();
  const [api, setApi] = useState<Api>();
  const [itemsView, setItemsView] = useState<ItemsView>();
  const [gePrices, setGEPrices] = useState<GEPrices>();
  const [npcInteractions, setNPCInteractions] = useState<NPCInteractionsView>();
  const [stats, setStats] = useState<StatsView>();
  const [lastUpdated, setLastUpdated] = useState<LastUpdatedView>();
  const [inventoryView, setInventoryView] = useState<InventoryView>();
  const [equipmentView, setEquipmentView] = useState<EquipmentView>();
  const [skills, setSkills] = useState<SkillsView>();
  const [quests, setQuests] = useState<QuestsView>();

  const knownMembers = api?.getKnownMembers();

  useEffect(() => {
    if (api === undefined) return;

    api.onInventoryUpdate = setInventoryView;
    api.onEquipmentUpdate = setEquipmentView;
    api.onItemsUpdate = setItemsView;
    api.onNPCInteractionsUpdate = setNPCInteractions;
    api.onStatsUpdate = setStats;
    api.onLastUpdatedUpdate = setLastUpdated;
    api.onSkillsUpdate = setSkills;
    api.onQuestsUpdate = setQuests;
    api.queueGetGroupData();
    api
      .fetchGEPrices()
      .then(setGEPrices)
      .catch((error) => console.error(error));
    return (): void => {
      api.onInventoryUpdate = undefined;
      api.onEquipmentUpdate = undefined;
      api.onItemsUpdate = undefined;
      api.onNPCInteractionsUpdate = undefined;
      api.onStatsUpdate = undefined;
      api.onLastUpdatedUpdate = undefined;
      api.onSkillsUpdate = undefined;
      api.close();
    };
  }, [api, setItemsView]);
  useEffect(() => {
    if (api !== undefined) return;

    const credentials = loadValidatedCredentials();
    if (credentials === undefined) return;

    setApi(new Api(credentials));
  }, [location, api]);
  const close = useCallback(() => {
    setApi(undefined);
  }, [setApi]);

  return {
    close,
    itemsView,
    gePrices,
    npcInteractions,
    stats,
    lastUpdated,
    inventoryView,
    equipmentView,
    skills,
    knownMembers,
    quests,
  };
};

export const App = (): ReactElement => {
  const location = useLocation();
  const { items: itemData, quests: questData } = useGameData();

  const {
    close: closeAPI,
    itemsView,
    gePrices,
    npcInteractions,
    stats,
    lastUpdated,
    inventoryView,
    equipmentView,
    skills,
    quests,
    knownMembers,
  } = useAPI();

  const panels = knownMembers
    ?.filter((name) => name !== "@SHARED")
    .map<ReactElement>((name) => (
      <PlayerPanel
        interacting={npcInteractions?.get(name)}
        inventory={inventoryView?.get(name)}
        equipment={equipmentView?.get(name)}
        skills={skills?.get(name)}
        quests={quests?.get(name)}
        questData={questData}
        name={name}
        lastUpdated={lastUpdated?.get(name)}
        stats={stats?.get(name)}
        key={name}
      />
    ));

  const { coordinateIndicator, planeSelect, backgroundMap } = useCanvasMap({
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
        <Route path="/logout" element={<LogoutPage callback={closeAPI} />} />
        <Route path="/group">
          <Route index element={<Navigate to="items" replace />} />
          <Route
            path="items"
            element={
              <AuthedLayout panels={panels}>
                <ItemsPage memberNames={knownMembers} items={itemsView} itemData={itemData} gePrices={gePrices} />
              </AuthedLayout>
            }
          />
          <Route
            path="map"
            element={
              <AuthedLayout panels={panels}>
                {planeSelect}
                {coordinateIndicator}
              </AuthedLayout>
            }
          />
          <Route path="graphs" element={<AuthedLayout panels={panels} />} />
          <Route path="panels" element={<AuthedLayout panels={undefined}>{panels}</AuthedLayout>} />
          <Route path="settings" element={<AuthedLayout panels={panels} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
