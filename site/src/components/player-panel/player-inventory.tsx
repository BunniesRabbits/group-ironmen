import { useContext, type ReactElement } from "react";
import type { Inventory } from "../../data/api";
import { useItemTooltip } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../data/game-data";

import "./player-inventory.css";

export const PlayerInventory = ({ items }: { items?: Inventory }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();
  const { items: itemData, gePrices: geData } = useContext(GameDataContext);

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

                showTooltip({
                  name: itemDatum.name,
                  quantity: item.quantity,
                  highAlch: itemDatum.highalch,
                  gePrice: geData?.get(item.itemID) ?? 0,
                });
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
