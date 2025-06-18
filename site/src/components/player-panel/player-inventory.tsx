import { type ReactElement } from "react";
import type { Inventory } from "../../data/api";

import "./player-inventory.css";

export const PlayerInventory = ({ items }: { items?: Inventory }): ReactElement => {
  return (
    <div className="player-inventory">
      <div className="player-inventory-background">
        {(items ?? Array<undefined>(28).fill(undefined)).map((item, index) => {
          if (item === undefined) return <span className="player-inventory-item-box" key={index} />;
          return (
            <img
              key={`${item.itemID} ${item.quantity}`}
              alt="osrs item"
              className="player-inventory-item-box"
              src={`/icons/items/${item.itemID}.webp`}
            />
          );
        })}
      </div>
    </div>
  );
};
