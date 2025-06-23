import { Fragment, useContext, type ReactElement } from "react";
import { type Collection } from "../../data/member";
import { GameDataContext } from "../../data/game-data";

export const CollectionLog = ({ collection }: { collection: Collection }): ReactElement => {
  const { items: itemDatabase } = useContext(GameDataContext);

  const pages = [
    ...collection.entries().map(([pageName, page]) => (
      <div key={pageName}>
        {pageName}: <br />
        Completed {page.completions} <br />
        {page.items.entries().map(([id, quantity]) => (
          <Fragment key={`${id} ${quantity}`}>{`${itemDatabase?.get(id)?.name} ${quantity}x, `}</Fragment>
        ))}
      </div>
    )),
  ];
  return <div style={{ width: "600px", height: "600px", overflowY: "auto" }}>{pages}</div>;
};
