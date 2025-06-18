import { useState, type ReactElement } from "react";

import "./player-panel.css";
import type { Equipment, Inventory, NPCInteraction, Skills, Stats } from "../../data/api";
import { PlayerSkills } from "./player-skills";
import { PlayerInventory } from "./player-inventory";
import { PlayerEquipment } from "./player-equipment";
import { PlayerStats } from "./player-stats";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlayerPanelSubcategories = ["Inventory", "Equipment", "Skills", "Quests", "Diaries", "Collection Log"] as const;
type PlayerPanelSubcategory = (typeof PlayerPanelSubcategories)[number];

export const PlayerPanel = ({
  name,
  stats,
  lastUpdated,
  interacting,
  inventory,
  equipment,
  skills,
}: {
  name: string;
  stats?: Stats;
  lastUpdated?: Date;
  interacting?: NPCInteraction;
  inventory?: Inventory;
  equipment?: Equipment;
  skills?: Skills;
}): ReactElement => {
  const [subcategory, setSubcategory] = useState<PlayerPanelSubcategory>();

  const buttons = (
    [
      {
        category: "Inventory",
        ariaLabel: "inventory",
        alt: "osrs inventory",
        src: "/ui/777-0.png",
        width: 26,
        height: 28,
      },
      {
        category: "Equipment",
        ariaLabel: "equipment",
        alt: "osrs t-posing knight",
        src: "/ui/778-0.png",
        width: 27,
        height: 32,
      },
      { category: "Skills", ariaLabel: "stats", alt: "osrs stats", src: "/ui/3579-0.png", width: 23, height: 22 },
      { category: "Quests", ariaLabel: "quests", alt: "osrs quest", src: "/ui/776-0.png", width: 22, height: 22 },
      {
        category: "Diaries",
        ariaLabel: "diaries",
        alt: "osrs diary",
        src: "/ui/1298-0.png",
        width: 22,
        height: 22,
      },
      {
        category: "Collection Log",
        ariaLabel: "collection-log",
        alt: "osrs collection log",
        src: "/icons/items/22711.webp",
        width: 32,
        height: 32,
        class: "player-panel-collection-log",
      },
    ] satisfies {
      category: PlayerPanelSubcategory;
      ariaLabel: string;
      alt: string;
      src: string;
      width: number;
      height: number;
      class?: string;
    }[]
  ).map((props) => (
    <button
      key={props.category}
      className={`${props.category === subcategory ? "player-panel-tab-active" : ""} ${props.class}`}
      aria-label={props.ariaLabel}
      type="button"
      onClick={() => {
        const alreadySelected = props.category === subcategory;
        if (alreadySelected) setSubcategory(undefined);
        else setSubcategory(props.category);
      }}
    >
      <img alt={props.alt} src={props.src} width={props.width} height={props.height} />
    </button>
  ));

  let content = undefined;
  switch (subcategory) {
    case "Inventory":
      content = <PlayerInventory items={inventory} />;
      break;
    case "Equipment":
      content = <PlayerEquipment items={equipment} />;
      break;
    case "Skills":
      content = <PlayerSkills skills={skills} />;
      break;
  }

  return (
    <div className={`player-panel rsborder rsbackground ${content !== undefined ? "expanded" : ""}`}>
      <PlayerStats lastUpdated={lastUpdated} interacting={interacting} name={name} stats={stats} />
      <div className="player-panel-minibar">{buttons}</div>
      <div className="player-panel-content">{content}</div>
    </div>
  );
};
