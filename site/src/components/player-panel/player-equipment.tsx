import { type ReactElement } from "react";
import type { Equipment, EquipmentSlot } from "../../data/api";

import "./player-equipment.css";

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
  return (
    <div className="player-equipment">
      {VisibleEquipmentSlots.map((slot) => {
        const item = items?.get(slot);
        let className = "equipment-slot-empty";
        let iconURL = `/ui/${EquipmentSlotEmptyIcons.get(slot) ?? ""}`;
        if (item !== undefined) {
          className = "equipment-slot-item";
          iconURL = `/icons/items/${item.itemID}.webp`;
        }
        return (
          <div
            key={slot}
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
    </div>
  );
};
