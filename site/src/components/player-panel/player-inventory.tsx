import { useContext, type ReactElement } from "react";
import { useItemTooltip } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../data/game-data";
import type { Inventory } from "../../data/member";

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

          const href = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`;

          return (
            <a
              key={`${item.itemID} ${item.quantity} ${index}`}
              href={href}
              className="player-inventory-item-box player-inventory-item-box-filled"
              target="_blank"
              rel="noopener noreferrer"
            >
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
                alt="osrs item"
                src={`/icons/items/${item.itemID}.webp`}
              />
            </a>
          );
        })}
      </div>
      {tooltipElement}
    </div>
  );
};
