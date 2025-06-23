import { Fragment, useContext, useState, type ReactElement } from "react";
import { type Collection } from "../../data/member";
import { GameDataContext } from "../../data/game-data";
import * as CollectionLog from "../../data/collection-log";

import "./collection-log.css";

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
  const { items: itemDatabase, collectionLogInfo } = useContext(GameDataContext);
  const [visibleTab, setVisibleTab] = useState<CollectionLog.Tab>("Bosses");

  const tabButtons = CollectionLog.Tab.map((tab) => (
    <button
      key={tab}
      className={`${tab === visibleTab ? "collection-log-tab-button-active" : ""}`}
      onClick={() => setVisibleTab(tab)}
    >
      {tab}
    </button>
  ));

  const pages = [collectionLogInfo?.tabs.get(visibleTab) ?? []].map((pages) =>
    pages.map(({ name: pageName, completionLabels, items: possibleItems }) => {
      const progress = collection.get(pageName);

      const completions = completionLabels.map((label, index) => (
        <Fragment key={label}>
          {label}: {progress?.completions[index] ?? 0}
          <br />
        </Fragment>
      ));
      const drops = possibleItems.map((itemID) => (
        <Fragment
          key={itemID}
        >{` ${itemDatabase?.get(itemID)?.name ?? itemID}: ${progress?.items.get(itemID) ?? 0} `}</Fragment>
      ));

      return (
        <div key={pageName}>
          {pageName}: <br />
          {completions}
          {drops}
        </div>
      );
    }),
  );

  return (
    <div className="collection-log-container dialog-container metal-border rsbackground">
      <div className="collection-log-header">
        <h2 className="collection-log-title">Collection Log</h2>
        <button className="collection-log-close dialog__close" onClick={onCloseModal}>
          <img src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>

      <div className="collection-log-title-border"></div>

      <div className="collection-log-main">
        <div className="collection-log-tab-buttons">{tabButtons}</div>

        <div className="collection-log-tab-container">{pages}</div>
      </div>
    </div>
  );
};
