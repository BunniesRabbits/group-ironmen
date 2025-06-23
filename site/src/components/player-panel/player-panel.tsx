import { useCallback, useState, type ReactElement } from "react";
import { PlayerSkills } from "./player-skills";
import { PlayerInventory } from "./player-inventory";
import { PlayerEquipment } from "./player-equipment";
import { PlayerStats } from "./player-stats";
import { PlayerQuests } from "./player-quests";
import { PlayerDiaries } from "./player-diaries";
import * as Member from "../../data/member";
import { useModal } from "../modal/modal";
import { CollectionLog } from "../collection-log/collection-log";

import "./player-panel.css";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlayerPanelSubcategories = ["Inventory", "Equipment", "Skills", "Quests", "Diaries", "Collection Log"] as const;
type PlayerPanelSubcategory = (typeof PlayerPanelSubcategories)[number];

interface PlayerPanelButtonProps {
  category: PlayerPanelSubcategory;
  ariaLabel: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  class?: string;
  onClick: () => void;
}

// TODO: all of these props being nullable is inconvenient, they should probably be coalesced earlier.

export const PlayerPanel = ({
  player,
  stats,
  lastUpdated,
  interacting,
  inventory,
  equipment,
  skills,
  quests,
  diaries,
  collection,
}: {
  player: Member.Name;
  stats?: Member.Stats;
  lastUpdated?: Date;
  interacting?: Member.NPCInteraction;
  inventory?: Member.Inventory;
  equipment?: Member.Equipment;
  skills?: Member.Skills;
  quests?: Member.Quests;
  diaries?: Member.Diaries;
  collection?: Member.Collection;
}): ReactElement => {
  const [subcategory, setSubcategory] = useState<PlayerPanelSubcategory>();
  const { open: openCollectionLogModal, modal: collectionLogModal } = useModal({
    Children: CollectionLog,
    otherProps: { collection: collection ?? new Map() },
  });

  const toggleCategory = useCallback(
    (newSubcategory: PlayerPanelSubcategory) => {
      const alreadySelected = newSubcategory === subcategory;
      if (alreadySelected) setSubcategory(undefined);
      else setSubcategory(newSubcategory);
    },
    [subcategory],
  );

  const buttons = (
    [
      {
        category: "Inventory",
        ariaLabel: "inventory",
        alt: "osrs inventory",
        src: "/ui/777-0.png",
        width: 26,
        height: 28,
        onClick: (): void => {
          toggleCategory("Inventory");
        },
      },
      {
        category: "Equipment",
        ariaLabel: "equipment",
        alt: "osrs t-posing knight",
        src: "/ui/778-0.png",
        width: 27,
        height: 32,
        onClick: (): void => {
          toggleCategory("Equipment");
        },
      },
      {
        category: "Skills",
        ariaLabel: "skills",
        alt: "osrs skills",
        src: "/ui/3579-0.png",
        width: 23,
        height: 22,
        onClick: (): void => {
          toggleCategory("Skills");
        },
      },
      {
        category: "Quests",
        ariaLabel: "quests",
        alt: "osrs quest",
        src: "/ui/776-0.png",
        width: 22,
        height: 22,
        onClick: (): void => {
          toggleCategory("Quests");
        },
      },
      {
        category: "Diaries",
        ariaLabel: "diaries",
        alt: "osrs diary",
        src: "/ui/1298-0.png",
        width: 22,
        height: 22,
        onClick: (): void => {
          toggleCategory("Diaries");
        },
      },
      {
        category: "Collection Log",
        ariaLabel: "collection-log",
        alt: "osrs collection log",
        src: "/icons/items/22711.webp",
        width: 32,
        height: 32,
        class: "player-panel-collection-log",
        onClick: (): void => {
          openCollectionLogModal();
        },
      },
    ] satisfies PlayerPanelButtonProps[]
  ).map((props) => (
    <button
      key={props.category}
      className={`${props.category === subcategory ? "player-panel-tab-active" : ""} ${props.class}`}
      aria-label={props.ariaLabel}
      type="button"
      onClick={props.onClick}
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
    case "Quests":
      content = <PlayerQuests quests={quests} />;
      break;
    case "Diaries":
      content = <PlayerDiaries {...{ quests, player, diaries, skills }} />;
      break;
  }

  return (
    <>
      {collectionLogModal}
      <div className={`player-panel rsborder rsbackground ${content !== undefined ? "expanded" : ""}`}>
        <PlayerStats lastUpdated={lastUpdated} interacting={interacting} name={player} stats={stats} />
        <div className="player-panel-minibar">{buttons}</div>
        <div className="player-panel-content">{content}</div>
      </div>
    </>
  );
};
