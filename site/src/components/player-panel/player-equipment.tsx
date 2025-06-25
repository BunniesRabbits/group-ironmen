import { useContext, type ReactElement } from "react";
import { useItemTooltip } from "../tooltip/item-tooltip";
import { GameDataContext } from "../../context/game-data-context";
import { EquipmentSlot } from "../../data/equipment";
import type * as Member from "../../data/member";
import { useMemberEquipmentContext } from "../../context/group-state-context";

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

export const PlayerEquipment = ({ member }: { member: Member.Name }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useItemTooltip();
  const { items: itemData, gePrices: geData } = useContext(GameDataContext);
  const equipment = useMemberEquipmentContext(member);

  return (
    <div className="player-equipment">
      {VisibleEquipmentSlots.map((slot) => {
        const item = equipment?.get(slot);
        if (item !== undefined) {
          const wikiLink = `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${item.itemID}`;
          const iconURL = `/icons/items/${item.itemID}.webp`;
          const itemDatum = itemData?.get(item.itemID);
          const onPointerEnter = (): void => {
            if (!itemDatum) return;

            showTooltip({
              name: itemDatum.name,
              quantity: item.quantity,
              highAlch: itemDatum.highalch,
              gePrice: geData?.get(item.itemID) ?? 0,
            });
          };
          return (
            <a
              href={wikiLink}
              target="_blank"
              rel="noopener noreferrer"
              key={slot}
              onPointerEnter={onPointerEnter}
              onPointerLeave={hideTooltip}
              className={`equipment-${slot.toLowerCase()} equipment-slot ${item !== undefined ? "filled" : ""}`}
            >
              <img alt={itemDatum?.name ?? "equipment"} className="equipment-slot-item" src={iconURL} />
            </a>
          );
        } else {
          return (
            <div
              key={slot}
              className={`equipment-${slot.toLowerCase()} equipment-slot ${item !== undefined ? "filled" : ""}`}
            >
              <img
                alt={`empty equipment ${slot} slot`}
                className="equipment-slot-empty"
                src={`/ui/${EquipmentSlotEmptyIcons.get(slot) ?? ""}`}
              />
            </div>
          );
        }
      })}
      {tooltipElement}
    </div>
  );
};
