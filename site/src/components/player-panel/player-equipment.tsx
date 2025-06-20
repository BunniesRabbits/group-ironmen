import { useContext, type ReactElement } from "react";
import type { Equipment, EquipmentSlot } from "../../data/api";

import "./player-equipment.css";
import { useItemTooltip } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../data/game-data";

const VisibleEquipmentSlots: EquipmentSlot[] = [
  "Head",
  "Cape",
  "Amulet",
  "Weapon",
  "Body",
  "Shield",
  // "Arms",
  "Legs",
  // "Hair",
  "Gloves",
  "Boots",
  // "Jaw",
  "Ring",
  "Ammo",
];
const EquipmentSlotEmptyIcons = new Map<EquipmentSlot, string>([
  ["Head", "156-0.png"],
  ["Cape", "157-0.png"],
  ["Amulet", "158-0.png"],
  ["Weapon", "159-0.png"],
  ["Body", "161-0.png"],
  ["Shield", "162-0.png"],
  ["Legs", "163-0.png"],
  ["Gloves", "164-0.png"],
  ["Boots", "165-0.png"],
  ["Ring", "160-0.png"],
  ["Ammo", "166-0.png"],
]);

export const PlayerEquipment = ({ items }: { items?: Equipment }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();
  const { items: itemData } = useContext(GameDataContext);

  return (
    <div className="player-equipment">
      {VisibleEquipmentSlots.map((slot) => {
        const item = items?.get(slot);
        let className = "equipment-slot-empty";
        let iconURL = `/ui/${EquipmentSlotEmptyIcons.get(slot) ?? ""}`;
        let onPointerEnter = undefined;
        if (item !== undefined) {
          className = "equipment-slot-item";
          iconURL = `/icons/items/${item.itemID}.webp`;
          onPointerEnter = (): void => {
            const itemDatum = itemData?.get(item.itemID);
            if (!itemDatum) return;

            showTooltip({ name: itemDatum.name, quantity: item.quantity, highalch: itemDatum.highalch });
          };
        }
        return (
          <div
            key={slot}
            onPointerEnter={onPointerEnter}
            onPointerLeave={hideTooltip}
            className={`equipment-${slot.toLowerCase()} equipment-slot ${item !== undefined ? "filled" : ""}`}
          >
            <img
              alt="osrs item" // TODO: get name of item
              className={className}
              src={iconURL}
            />
          </div>
        );
      })}
      {tooltipElement}
    </div>
  );
};
