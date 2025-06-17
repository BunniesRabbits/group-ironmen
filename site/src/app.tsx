import { Routes, Route, useLocation } from "react-router-dom";
import { UnauthedLayout, AuthedLayout } from "./layout";
import { MenHomepage } from "./components/men-homepage/men-homepage";
import { SetupInstructions } from "./components/setup-instructions/setup-instructions";
import { LoginPage } from "./components/login-page/login-page";
import { LogoutPage } from "./components/logout-page/logout-page";
import { Navigate } from "react-router-dom";
import { useEffect, useRef, useState, type ReactElement } from "react";

import "./app.css";
import { CanvasMap } from "./components/canvas-map/canvas-map";
import Api, { type GEPrices, type ItemsView, loadValidatedCredentials } from "./data/api";
import { ItemsPage } from "./components/items-page/items-page";
import { ItemData } from "./data/item-data";

const fetchItemDataJSON = (): Promise<ItemData> =>
  import("/src/assets/item_data.json")
    .then((data) => {
      return ItemData.safeParseAsync(data.default);
    })
    .then((parseResult) => {
      if (!parseResult.success) throw new Error("Failed to parse item-data.json", { cause: parseResult.error });

      return parseResult.data;
    });

const useItemData = (): { itemData?: ItemData } => {
  // We don't need to worry about cache invalidation since this data is a static asset that is updated rarely.
  // Users can refresh if they want to see a game update reflected.
  const [data, setData] = useState<ItemData>();
  const promiseRef = useRef<Promise<void>>(undefined);

  useEffect(() => {
    if (promiseRef.current !== undefined) return;

    promiseRef.current = fetchItemDataJSON()
      .then((itemData) => setData(itemData))
      .catch((error) => console.error("Failed to get item data", error))
      .finally(() => {
        promiseRef.current = undefined;
      });
  }, []);

  return { itemData: data };
};

export const App = (): ReactElement => {
  const location = useLocation();
  const [api, setApi] = useState<Api>();
  const { itemData } = useItemData();
  const [itemsView, setItemsView] = useState<ItemsView>();
  const [gePrices, setGEPrices] = useState<GEPrices>();

  useEffect(() => {
    if (api === undefined) return;

    api.onItemsUpdate = setItemsView;
    api.queueGetGroupData();
    api
      .fetchGEPrices()
      .then(setGEPrices)
      .catch((error) => console.error(error));
    return (): void => {
      api.onItemsUpdate = undefined;
      api.close();
    };
  }, [api, setItemsView]);
  useEffect(() => {
    if (api !== undefined) return;

    const credentials = loadValidatedCredentials();
    if (credentials === undefined) return;

    setApi(new Api(credentials));
  }, [location, api]);

  const panels = api?.getKnownMembers().filter((name) => name !== "@SHARED");

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
          <Route
            path="items"
            element={
              <AuthedLayout panels={panels}>
                <ItemsPage
                  memberNames={api?.getKnownMembers()}
                  items={itemsView}
                  itemData={itemData}
                  gePrices={gePrices}
                />
              </AuthedLayout>
            }
          />
          <Route path="map" element={<AuthedLayout panels={panels} />} />
          <Route path="graphs" element={<AuthedLayout panels={panels} />} />
          <Route path="panels" element={<AuthedLayout panels={undefined}>{panels}</AuthedLayout>} />
          <Route path="settings" element={<AuthedLayout panels={panels} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
