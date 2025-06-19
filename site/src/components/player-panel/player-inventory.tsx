import { useRef, type ReactElement } from "react";
import type { Inventory } from "../../data/api";

import "./player-inventory.css";
import type { ItemData } from "../../data/item-data";

export const PlayerInventory = ({ items, itemData }: { items?: Inventory; itemData?: ItemData }): ReactElement => {
  const tooltip = useRef<HTMLElement>(document.querySelector("#tooltip"));

  return (
    <div className="player-inventory">
      <div
        onPointerLeave={() => {
          if (!tooltip.current) return;
          tooltip.current.innerHTML = "";
          tooltip.current.style.visibility = "hidden";
        }}
        className="player-inventory-background"
      >
        {(items ?? Array<undefined>(28).fill(undefined)).map((item, index) => {
          if (item === undefined)
            return (
              <span
                onPointerEnter={() => {
                  if (!tooltip.current) return;
                  tooltip.current.style.visibility = "hidden";
                }}
                className="player-inventory-item-box"
                key={index}
              />
            );
          return (
            <img
              onPointerEnter={() => {
                if (!tooltip.current) return;
                const itemDatum = itemData?.get(item.itemID);
                if (!itemDatum) return;

                tooltip.current.style.visibility = "visible";

                if (item.quantity > 1) {
                  tooltip.current.innerHTML = `${itemDatum.name} x ${item.quantity}`;
                } else {
                  tooltip.current.innerHTML = `${itemDatum.name}`;
                }

                if (itemDatum.highalch > 0) {
                  tooltip.current.innerHTML += `<br/>HA: ${itemDatum.highalch}`;
                }
              }}
              key={`${item.itemID} ${item.quantity} ${index}`}
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
