import { useContext, useState, type ReactElement } from "react";
import { GameDataContext } from "../../data/game-data";
import { type Collection, type CollectionPageProgress } from "../../data/member";
import * as CollectionLog from "../../data/collection-log";

import "./collection-log.css";
import { useCollectionLogItemTooltip } from "./collection-log-tooltip";

const CollectionLogPage = ({
  page,
  progress,
  wikiLink,
}: {
  page: CollectionLog.Page;
  progress: CollectionPageProgress | undefined;
  wikiLink?: URL;
}): ReactElement => {
  const { tooltipElement, showTooltip, hideTooltip } = useCollectionLogItemTooltip();
  const { items: itemDatabase } = useContext(GameDataContext);

  const { name: pageName, items: possibleItems, completionLabels } = page;

  const completions = completionLabels.map((label, index) => (
    <div key={label}>
      <span className=".collection-log-count">
        {label}: {progress?.completions[index] ?? 0}
        <br />
      </span>
    </div>
  ));

  const drops = possibleItems.map((itemID) => {
    const wikiLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${itemID}`;
    const quantity = progress?.items.get(itemID) ?? 0;
    const itemName = itemDatabase?.get(itemID)?.name;

    const itemImage = (
      <img
        className={`${quantity === 0 ? "collection-log-page-item-missing" : ""}`}
        alt={itemName ?? "osrs item"}
        src={`/icons/items/${itemID}.webp`}
      />
    );
    const quantityLabel =
      quantity > 0 ? <span className="collection-log-page-item-quantity">{quantity}</span> : undefined;

    return (
      <a
        key={itemID}
        onPointerEnter={() => {
          if (!itemName) {
            hideTooltip();
            return;
          }
          showTooltip({ name: itemName });
        }}
        className="collection-log-page-item"
        href={wikiLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        {itemImage}
        {quantityLabel}
      </a>
    );
  });

  return (
    <>
      <div className="collection-log-page-top">
        <h2 className="collection-log-page-name-link">
          <a href={wikiLink?.href ?? ""} target="_blank" rel="noopener noreferrer">
            {pageName}
          </a>
        </h2>
        {completions}
      </div>
      <div onPointerLeave={hideTooltip} className="collection-log-page-items">
        {drops}
      </div>
      {tooltipElement}
    </>
  );
};

const ResolvePageWikiLink = ({
  tab,
  page,
}: {
  tab: CollectionLog.TabName;
  page: CollectionLog.PageName;
}): URL | undefined => {
  let urlRaw = `https://oldschool.runescape.wiki/w/Special:Lookup?type=npc&name=${page}`;
  if (tab === "Clues") {
    if (page.startsWith("Shared")) {
      urlRaw = "https://oldschool.runescape.wiki/w/Collection_log#Shared_Treasure_Trail_Rewards";
    } else {
      const difficulty = page.split(" ")[0].toLowerCase();
      urlRaw = `https://oldschool.runescape.wiki/w/Clue_scroll_(${difficulty})`;
    }
  }

  if (!URL.canParse(urlRaw)) return undefined;

  return new URL(urlRaw);
};

/**
 * Display a single member's collection log.
 */
export const CollectionLogWindow = ({
  collection,
  onCloseModal,
}: {
  collection: Collection;
  onCloseModal: () => void;
}): ReactElement => {
  // TODO: display entire group's collection, but only focused on one.
  const { collectionLogInfo } = useContext(GameDataContext);
  const [currentTabName, setCurrentTabName] = useState<CollectionLog.TabName>("Bosses");
  const [pageIndex, setPageIndex] = useState<number>(0);

  const tabButtons = CollectionLog.TabName.map((tab) => (
    <button
      key={tab}
      className={`${tab === currentTabName ? "collection-log-tab-button-active" : ""}`}
      onClick={() => {
        if (tab === currentTabName) return;
        setPageIndex(0);
        setCurrentTabName(tab);
      }}
    >
      {tab}
    </button>
  ));

  const pageDirectory = [collectionLogInfo?.tabs.get(currentTabName) ?? []].map((pages) =>
    pages.map(({ name: pageName }, index) => {
      return (
        <button onClick={() => setPageIndex(index)} key={pageName}>
          {pageName}
        </button>
      );
    }),
  );

  let pageElement = undefined;
  const page = collectionLogInfo?.tabs.get(currentTabName)?.at(pageIndex);
  if (page) {
    const pageWikiLink = ResolvePageWikiLink({ page: page.name, tab: currentTabName });
    const pageProgress = page?.name ? collection.get(page.name) : undefined;
    pageElement = <CollectionLogPage wikiLink={pageWikiLink} page={page} progress={pageProgress} />;
  }

  return (
    <div className="collection-log-container dialog-container metal-border rsbackground">
      <div className="collection-log-header">
        <h2 className="collection-log-title">Collection Log</h2>
        <button className="collection-log-close dialog__close" onClick={onCloseModal}>
          <img src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <div className="collection-log-title-border" />
      <div className="collection-log-main">
        <div className="collection-log-tab-buttons">{tabButtons}</div>
        <div className="collection-log-tab-container">
          <div className="collection-log-tab-list">{pageDirectory}</div>
          <div className="collection-log-page-container">{pageElement}</div>
        </div>
      </div>
    </div>
  );
};
