import { useState, type ReactElement } from "react";
import type { QuestData, QuestDifficulty } from "../../data/quest-data";
import type { Quests, QuestStatus } from "../../data/api";
import { SearchElement } from "../search-element/search-element";

import "./player-quests.css";

const getDifficultyIconURL = (difficulty: QuestDifficulty): string => {
  switch (difficulty) {
    case "Novice":
      return "/icons/3399-0.png";
    case "Intermediate":
      return "/icons/3400-0.png";
    case "Experienced":
      return "/icons/3402-0.png";
    case "Master":
      return "/icons/3403-0.png";
    case "Grandmaster":
      return "/icons/3404-0.png";
    case "Special":
      return "/icons/3404-0.png";
  }
};

const getQuestWikiLinkURL = (name: string): string => {
  const wikiName = name.replaceAll(" ", "_");
  return `https://oldschool.runescape.wiki/w/${wikiName}/Quick_guide`;
};

const getClassForQuestStatus = (status: QuestStatus): string => {
  switch (status) {
    case "NOT_STARTED":
      return "player-quests-not-started";
    case "IN_PROGRESS":
      return "player-quests-in-progress";
    case "FINISHED":
      return "player-quests-finished";
  }
};

export const PlayerQuests = ({ questData, quests }: { questData?: QuestData; quests?: Quests }): ReactElement => {
  const [nameFilter, setNameFilter] = useState<string>("");

  let possiblePoints = 0;
  questData?.forEach(({ points }) => (possiblePoints += points));
  let currentPoints = 0;
  quests?.forEach((progress, id) => {
    if (progress !== "FINISHED") return;
    currentPoints += questData?.get(id)?.points ?? 0;
  });

  const questList = questData
    ?.entries()
    .filter(([, { name }]) => name.toLowerCase().includes(nameFilter?.toLowerCase()))
    .map(([id, { name, difficulty }]) => {
      const status = quests?.get(id) ?? "NOT_STARTED";
      return (
        <a
          href={getQuestWikiLinkURL(name)}
          className={getClassForQuestStatus(status)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div className="player-quests-quest">
            <img className="player-quests-difficulty-icon" src={getDifficultyIconURL(difficulty)} alt={difficulty} />
            {name}
          </div>
        </a>
      );
    });

  return (
    <div className="player-quests">
      <div className="player-quests-top">
        <SearchElement className="player-quests-filter" onChange={setNameFilter} placeholder="Filter Quests" />
        <div className="player-quests-points">
          <span className="player-quests-current-points">{currentPoints}</span> / {possiblePoints}
        </div>
      </div>
      <div className="player-quests-list">{questList}</div>
    </div>
  );
};
