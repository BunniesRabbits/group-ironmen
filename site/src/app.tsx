import { Routes, Route, useLocation } from "react-router-dom";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { Navigate } from "react-router-dom";
import { useCallback, useEffect, useState, type ReactElement } from "react";

import "./app.css";
import { useCanvasMap } from "./components/canvas-map/canvas-map";
import Api, {
  type DiariesView,
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
import { type ItemData } from "./data/item-data";
import { type QuestData } from "./data/quest-data";
import { type DiaryData } from "./data/diary-data";

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
  diaries: DiariesView;
  questData: QuestData;
  itemData: ItemData;
  diaryData: DiaryData;
  knownMembers: MemberName[];
}

/**
 * A hook that provides access to the backend network API, but also game data, wrapped and processed somewhat.
 *
 * For example, loading quests over the network requires resolving their IDs from the quests information themselves.
 * But that information is loaded from a json file, so processing quests requires synchronization which this hook provides.
 *
 * Data is only provided when it is ready to be used.
 */
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
  const [diaries, setDiaries] = useState<DiariesView>();
  const [itemData, setItemData] = useState<ItemData>();
  const [questData, setQuestData] = useState<QuestData>();
  const [diaryData, setDiaryData] = useState<DiaryData>();

  const knownMembers = api?.getKnownMembers();

  useEffect(() => {
    if (api === undefined) return;

    api.setUpdateCallbacks({
      onInventoryUpdate: setInventoryView,
      onEquipmentUpdate: setEquipmentView,
      onItemsUpdate: setItemsView,
      onNPCInteractionsUpdate: setNPCInteractions,
      onStatsUpdate: setStats,
      onLastUpdatedUpdate: setLastUpdated,
      onSkillsUpdate: setSkills,
      onQuestsUpdate: setQuests,
      onDiariesUpdate: setDiaries,
      onItemDataUpdate: setItemData,
      onQuestDataUpdate: setQuestData,
      onDiaryDataUpdate: setDiaryData,
    });

    api.queueGetGroupData();
    api
      .fetchGEPrices()
      .then(setGEPrices)
      .catch((error) => console.error(error));
    return (): void => {
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
    diaries,
    questData,
    itemData,
    diaryData,
  };
};

export const App = (): ReactElement => {
  const location = useLocation();

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
    diaries,
    knownMembers,
    questData,
    diaryData,
    itemData,
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
        diaries={diaries?.get(name)}
        questData={questData}
        diaryData={diaryData}
        player={name}
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
