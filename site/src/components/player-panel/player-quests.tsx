import { useState, type ReactElement } from "react";
import type { QuestData } from "../../data/quest-data";
import type { Quests } from "../../data/api";
import { SearchElement } from "../search-element/search-element";

export const PlayerQuests = ({ questData, quests }: { questData?: QuestData; quests?: Quests }): ReactElement => {
  const [nameFilter, setNameFilter] = useState<string>("");

  if (questData !== undefined && quests !== undefined && questData.size !== quests.length) {
    console.warn("questData and quests are different sizes.");
    // TODO: Before we get to this point, validate lengths and resolve quest IDs
    // so we don't need to rely on raw indices lining up and everything being sorted.
    // Because of this issue, all this indexing is a mess
  }

  const questIDs = [...(questData?.keys() ?? [])];

  let possiblePoints = 0;
  questData?.forEach(({ points }) => (possiblePoints += points));
  let currentPoints = 0;
  quests?.forEach((progress, index) => {
    if (progress !== "FINISHED" || questIDs === undefined) return;
    currentPoints += questData?.get(questIDs[index] ?? -1)?.points ?? 0;
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
