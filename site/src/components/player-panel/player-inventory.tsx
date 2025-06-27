import { useContext, type ReactElement } from "react";
import { useItemTooltip, type ItemTooltipProps } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../context/game-data-context";
import * as Member from "../../data/member";
import { useMemberInventoryContext, useMemberRunePouchContext } from "../../context/group-state-context";
import { ItemID } from "../../data/items";

import "./player-inventory.css";

export const PlayerInventory = ({ member }: { member: Member.Name }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();

  const { items: itemData, gePrices: geData } = useContext(GameDataContext);
  const items = useMemberInventoryContext(member);
  const runePouch = useMemberRunePouchContext(member);

  const itemElements = [];
  for (let index = 0; index < 28; index++) {
    const item = items?.at(index);
    if (!item) {
      itemElements.push(<span onPointerEnter={hideTooltip} className="player-inventory-item-box" key={index} />);
      continue;
    }

    const { itemID, quantity } = item;

    const itemDatum = itemData?.get(itemID);

    const overlayItemIcons = [];
    let tooltipProps: ItemTooltipProps | undefined = undefined;
    const href = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`;

    if (itemDatum && ItemID.isRunePouch(itemID) && runePouch) {
      let totalHighAlch = 0;
      let totalGePrice = 0;
      const runes: { name: string; quantity: number }[] = [];
      for (const [runeID, runeQuantity] of runePouch) {
        const runeDatum = itemData?.get(runeID);
        if (runeDatum) {
          totalGePrice += (geData?.get(runeID) ?? 0) * runeQuantity;
          totalHighAlch += runeDatum.highalch * runeQuantity;
          runes.push({ name: runeDatum.name, quantity: runeQuantity });
        }

        overlayItemIcons.push(<img alt="osrs item" src={`/icons/items/${runeID}.webp`} />);
      }
      tooltipProps = {
        type: "Rune Pouch",
        name: itemDatum.name,
        totalHighAlch,
        totalGePrice,
        runes,
      };
    } else if (itemDatum) {
      tooltipProps = {
        type: "Item",
        name: itemDatum.name,
        quantity: quantity,
        highAlch: itemDatum.highalch,
        gePrice: geData?.get(itemID) ?? 0,
      };
    }

    itemElements.push(
      <a
        key={`${itemID} ${quantity} ${index}`}
        href={href}
        className="player-inventory-item-box player-inventory-item-box-filled"
        target="_blank"
        rel="noopener noreferrer"
        onPointerEnter={() => {
          if (!tooltipProps) return;
          showTooltip(tooltipProps);
        }}
      >
        <img alt="osrs item" src={`/icons/items/${itemID}.webp`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", inset: 0, position: "absolute" }}>
          {overlayItemIcons}
        </div>
      </a>,
    );
  }

  return (
    <div className="player-inventory">
      <div onPointerLeave={hideTooltip} className="player-inventory-background">
        {itemElements}
      </div>
      {tooltipElement}
    </div>
  );
};
