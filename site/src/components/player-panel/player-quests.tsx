import { useState, type ReactElement } from "react";
import type { QuestData } from "../../data/quest-data";
import type { Quests } from "../../data/api";
import { SearchElement } from "../search-element/search-element";

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
    ?.values()
    .filter(({ name }) => name.toLowerCase().includes(nameFilter?.toLowerCase()))
    .map(({ name, difficulty, member, points, miniquest }) => (
      <div>
        {name} {difficulty} {member} {points} {miniquest}
      </div>
    ));

  return (
    <div className="player-quests">
      <div className="player-quests__top">
        <SearchElement className="player-quests__filter" onChange={setNameFilter} placeholder="Filter Quests" />
        <div className="player-quests__points">
          <span className="player-quests__current-points">{currentPoints}</span> / {possiblePoints}
        </div>
      </div>
      <div className="player-quests__list">{questList}</div>
    </div>
  );
};
