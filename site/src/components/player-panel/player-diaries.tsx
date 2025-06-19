import { type ReactElement } from "react";
import { StatBar } from "./stat-bar";
import type { Diaries, MemberName } from "../../data/api";
import { DiaryRegion, DiaryTier, type DiaryData, type DiaryEntry } from "../../data/diary-data";

import "./player-diaries.css";
import { useModal } from "../modal/modal.tsx";

const DiaryFull = ({
  region,
  player,
  tasks,
  progress,
  onCloseModal,
}: {
  region: DiaryRegion;
  player: MemberName;
  tasks?: Map<DiaryTier, DiaryEntry[]>;
  progress?: Map<DiaryTier, boolean[]>;
  onCloseModal: () => void;
}): ReactElement => {
  const entries = DiaryTier.map(
    (tier) =>
      [
        tier,
        tasks?.get(tier)?.map(({ task, requirements }, index) => {
          let requirementsElements = undefined;
          if (requirements !== undefined) {
            const skills = Object.entries(requirements.skills ?? {}).map(([skill, level]) => `${skill}:${level}`);
            const quests = requirements.quests?.map((quest) => quest);
            requirementsElements = (
              <div className="diary-dialog-requirements">
                {"("}
                {skills}
                {quests}
                {")"}
              </div>
            );
          }

          const complete = progress?.get(tier)?.[index];

          return (
            <div className={`diary-dialog-task ${complete ? "diary-dialog-task-complete" : ""}`}>
              {task}
              {requirementsElements}
            </div>
          );
        }),
      ] as [DiaryTier, ReactElement[]],
  );
  const elementsByTier = new Map(entries);

  return (
    <div className="dialog-container rsborder rsbackground">
      <div className="diary-dialog-header rsborder-tiny">
        <h2 className="diary-dialog-title">
          Achievement Diary - {region} - {player}
        </h2>
        <button className="dialog-close" onClick={onCloseModal}>
          <img src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <div className="diary-dialog-scroll-container">
        <div className="diary-dialog-section rsborder-tiny" diary-tier="Easy">
          <h2>Easy</h2>
          {elementsByTier.get("Easy")}
        </div>
        <div className="diary-dialog-section rsborder-tiny" diary-tier="Medium">
          <h2>Medium</h2>
          {elementsByTier.get("Medium")}
        </div>
        <div className="diary-dialog-section rsborder-tiny" diary-tier="Hard">
          <h2>Hard</h2>
          {elementsByTier.get("Hard")}
        </div>
        <div className="diary-dialog-section rsborder-tiny" diary-tier="Elite">
          <h2>Elite</h2>
          {elementsByTier.get("Elite")}
        </div>
      </div>
    </div>
  );
};

const countTrue = (flags: boolean[]): number =>
  flags.reduce((count, flag) => {
    if (flag) return count + 1;
    return count;
  }, 0);

const getDiaryProgressRatio = (flags?: boolean[]): number => {
  if (flags === undefined) return 1;

  const total = flags.length;
  const complete = flags.reduce((count, flag) => {
    if (flag) return count + 1;
    return count;
  }, 0);
  return complete / total;
};

const DiaryCompletion = ({
  player,
  region,
  progress,
  tasks,
}: {
  player: MemberName;
  region: DiaryRegion;
  progress: Map<DiaryTier, boolean[]>;
  tasks?: Map<DiaryTier, DiaryEntry[]>;
}): ReactElement => {
  const { open: openModal, modal } = useModal({
    Children: DiaryFull,
    otherProps: { region, tasks, player, progress },
  });

  let total = 0;
  let complete = 0;
  progress.forEach((flags) => {
    total += flags.length;
    complete += countTrue(flags);
  });

  return (
    <>
      <button
        className={`rsborder-tiny diary-completion ${tasks !== undefined ? "clickable" : ""}`}
        onClick={openModal}
      >
        <div className="diary-completion-top">
          <span>{region}</span>
          <span>
            {total}/{complete}
          </span>
        </div>
        <div className="diary-completion-bottom">
          {DiaryTier.map((tier) => {
            const ratio = getDiaryProgressRatio(progress.get(tier));
            /*
             * With CSS's HSL color model, 0-107 is a gradient from red, orange,
             * yellow, then green. So we can multiply the hue to get the effect of
             * more complete diaries becoming redder.
             */
            const hue = 107 * ratio;
            return <StatBar key={tier} color={`hsl(${hue}, 100%, 41%)`} bgColor="rgba(0, 0, 0, 0.5)" ratio={ratio} />;
          })}
        </div>
      </button>
      {modal}
    </>
  );
};

export const PlayerDiaries = ({
  player,
  diaries,
  diaryData,
}: {
  player: MemberName;
  diaries?: Diaries;
  diaryData?: DiaryData;
}): ReactElement => {
  if (diaries === undefined) return <></>;

  return (
    <div className="player-diaries">
      <h2 className="player-diaries-title">Achievement Diaries</h2>
      <div className="player-diaries-completions">
        {DiaryRegion.map((region) => {
          const progress = diaries.get(region);
          if (progress === undefined) return undefined;
          return (
            <DiaryCompletion
              tasks={diaryData?.get(region)}
              player={player}
              key={region}
              region={region}
              progress={progress}
            />
          );
        })}
      </div>
    </div>
  );
};
