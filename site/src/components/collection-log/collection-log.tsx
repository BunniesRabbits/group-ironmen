import { useContext, useState, type ReactElement } from "react";
import { GameDataContext } from "../../data/game-data";
import { type Collection, type CollectionPageProgress } from "../../data/member";
import * as CollectionLog from "../../data/collection-log";

import "./collection-log.css";
import { useCollectionLogItemTooltip } from "./collection-log-tooltip";

const CollectionLogPage = ({
  page,
  progress,
}: {
  page: CollectionLog.Page;
  progress: CollectionPageProgress | undefined;
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
        <h2 className="rstext">{pageName}</h2>
        {completions}
      </div>
      <div onPointerLeave={hideTooltip} className="collection-log-page-items">
        {drops}
      </div>
      {tooltipElement}
    </>
  );
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
  const [visibleTab, setVisibleTab] = useState<CollectionLog.TabName>("Bosses");
  const [pageIndex, setPageIndex] = useState<number>(0);

  const tabButtons = CollectionLog.TabName.map((tab) => (
    <button
      key={tab}
      className={`${tab === visibleTab ? "collection-log-tab-button-active" : ""}`}
      onClick={() => {
        if (tab === visibleTab) return;
        setPageIndex(0);
        setVisibleTab(tab);
      }}
    >
      {tab}
    </button>
  ));

  const pageDirectory = [collectionLogInfo?.tabs.get(visibleTab) ?? []].map((pages) =>
    pages.map(({ name: pageName }, index) => {
      return (
        <button onClick={() => setPageIndex(index)} key={pageName}>
          {pageName}
        </button>
      );
    }),
  );

  const visiblePage = collectionLogInfo?.tabs.get(visibleTab)?.[pageIndex];
  const visiblePageProgress = visiblePage?.name ? collection.get(visiblePage?.name) : undefined;

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
          <div className="collection-log-page-container">
            {visiblePage ? <CollectionLogPage page={visiblePage} progress={visiblePageProgress} /> : undefined}
          </div>
        </div>
      </div>
    </div>
  );
};
