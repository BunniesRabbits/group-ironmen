import { useCallback, useRef, useState, type ReactElement } from "react";
import type { Inventory } from "../../data/api";

import "./player-inventory.css";
import type { ItemData } from "../../data/item-data";
import { createPortal } from "react-dom";

export const PlayerInventory = ({ items, itemData }: { items?: Inventory; itemData?: ItemData }): ReactElement => {
  const [selectedItem, setSelectedItem] = useState<{ name: string; quantity: number; highalch: number }>();
  const tooltipRef = useRef<HTMLDivElement>(document.body.querySelector<HTMLDivElement>("div#tooltip")!);

  const hideTooltip = useCallback(() => {
    setSelectedItem(undefined);
    tooltipRef.current.style.visibility = "hidden";
  }, []);

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

                setSelectedItem({ name: itemDatum.name, quantity: item.quantity, highalch: itemDatum.highalch });
                tooltipRef.current.style.visibility = "visible";
              }}
              key={`${item.itemID} ${item.quantity} ${index}`}
              alt="osrs item"
              className="player-inventory-item-box"
              src={`/icons/items/${item.itemID}.webp`}
            />
          );
        })}
      </div>
      {createPortal(
        selectedItem ? (
          <div>
            {selectedItem?.name ?? ""} x {selectedItem?.quantity}
            <br />
            HA: {selectedItem?.highalch}
          </div>
        ) : (
          <></>
        ),
        tooltipRef.current,
      )}
    </div>
  );
};
