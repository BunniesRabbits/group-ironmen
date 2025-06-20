import { type ReactElement } from "react";
import type { Inventory } from "../../data/api";
import { useItemTooltip } from "../tooltip/item-tooltip";
import type { ItemData } from "../../data/item-data";

import "./player-inventory.css";

export const PlayerInventory = ({ items, itemData }: { items?: Inventory; itemData?: ItemData }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();

  return (
    <div className="player-inventory">
      <div onPointerLeave={hideTooltip} className="player-inventory-background">
        {(items ?? Array<undefined>(28).fill(undefined)).map((item, index) => {
          if (item === undefined)
            return <span onPointerEnter={hideTooltip} className="player-inventory-item-box" key={index} />;
          return (
            <img
              onPointerEnter={() => {
                const itemDatum = itemData?.get(item.itemID);
                if (!itemDatum) return;

                showTooltip({ name: itemDatum.name, quantity: item.quantity, highalch: itemDatum.highalch });
              }}
              key={`${item.itemID} ${item.quantity} ${index}`}
              alt="osrs item"
              className="player-inventory-item-box"
              src={`/icons/items/${item.itemID}.webp`}
            />
          );
        })}
      </div>
      {tooltipElement}
    </div>
  );
};
