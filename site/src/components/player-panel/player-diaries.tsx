import { useContext, type ReactElement, type ReactNode } from "react";
import { StatBar } from "./stat-bar";
import { DiaryRegion, DiaryTier } from "../../data/diaries";
import { useModal } from "../modal/modal";
import { computeVirtualLevelFromXP, SkillIconsBySkill, type Level, type Skill } from "../../data/skill";
import { GameDataContext } from "../../data/game-data";
import type * as Member from "../../data/member";

import "./player-diaries.css";

const TierTasksDisplay = ({ tasks }: { tasks: DiaryTaskView[] }): ReactElement => {
  const elements = tasks.map(({ complete, description, quests, skills }) => {
    const skillElements = skills.map(({ skill, required, current }) => {
      const complete = current >= required;
      return (
        <span
          key={`${skill} ${required} ${current}`}
          className={`diary-dialog-skill-icon ${complete ? "diary-dialog-skill-complete" : ""}`}
        >
          {` ${current} / ${required} `}
          <img alt={skill} src={SkillIconsBySkill.get(skill)?.href ?? ""} />
        </span>
      );
    });

    const questElements = quests.map(({ name, complete }) => (
      <span
        key={`${name} ${complete}`}
        className={`diary-dialog-skill-icon ${complete ? "diary-dialog-skill-complete" : ""}`}
      >
        {name}
      </span>
    ));
    const allRequirements = [...skillElements, ...questElements];
    let withSeparators: ReactNode[] = allRequirements.flatMap((element, index) => {
      if (index < allRequirements.length - 1) {
        return [element, ","];
      }
      return [element];
    });
    if (withSeparators.length > 0) withSeparators = [" (", ...allRequirements, ")"];

    return (
      <div
        key={`${complete} ${description} ${quests.length} ${skills.length}`}
        className={`diary-dialog-task ${complete ? "diary-dialog-task-complete" : ""}`}
      >
        {description}
        {withSeparators}
      </div>
    );
  });

  return <>{elements}</>;
};

const DiaryRegionWindow = ({
  region,
  player,
  progress,
  onCloseModal,
}: {
  player: Member.Name;
  region: DiaryRegion;
  progress: DiaryRegionView;
  onCloseModal: () => void;
}): ReactElement => {
  const regionHref = `https://oldschool.runescape.wiki/w/${region.replace(/ /g, "_")}_Diary`;
  return (
    <div className="dialog-container rsborder rsbackground">
      <div className="diary-dialog-header rsborder-tiny">
        <div>
          <h3>
            <a className="diary-dialog-title" href={regionHref} target="_blank" rel="noopener noreferrer">
              {region} Achievement Diary
            </a>
          </h3>
          <h4>{player}</h4>
        </div>
        <button className="dialog-close" onClick={onCloseModal}>
          <img src="/ui/1731-0.png" alt="Close dialog" title="Close dialog" />
        </button>
      </div>
      <div className="diary-dialog-scroll-container">
        {[
          ...progress.entries().map(([tier, tierProgress]) => {
            const href = `${regionHref}#${tier}`;
            const complete = tierProgress.reduce((complete, task) => {
              return (complete &&= task.complete);
            }, true);
            return (
              <div
                key={tier}
                className={`diary-dialog-section rsborder-tiny ${complete ? "diary-dialog-tier-complete" : ""}`}
              >
                <h4>
                  <a className="diary-dialog-section-title" href={href} target="_blank" rel="noopener noreferrer">
                    {tier}
                  </a>
                </h4>
                <TierTasksDisplay tasks={tierProgress} />
              </div>
            );
          }),
        ]}
      </div>
    </div>
  );
};

const DiarySummary = ({
  player,
  region,
  progress,
}: {
  player: Member.Name;
  region: DiaryRegion;
  progress: DiaryRegionView;
}): ReactElement => {
  const { open: openModal, modal } = useModal({
    Children: DiaryRegionWindow,
    otherProps: { region, player, progress },
  });

  let total = 0;
  let completeTotal = 0;
  const ratioPerTier = new Map<DiaryTier, number>();

  progress.forEach((tasks, tier) => {
    let totalForTier = 0;
    let completeTotalForTier = 0;
    tasks.forEach(({ complete }) => {
      if (complete) completeTotalForTier += 1;
      totalForTier += 1;
    });

    ratioPerTier.set(tier, completeTotalForTier / totalForTier);
    total += totalForTier;
    completeTotal += completeTotalForTier;
  });

  return (
    <>
      <button className={`rsborder-tiny diary-completion`} onClick={openModal}>
        <div className="diary-completion-top">
          <span>{region}</span>
          <span>
            {completeTotal}/{total}
          </span>
        </div>
        <div className="diary-completion-bottom">
          {DiaryTier.map((tier) => {
            /*
             * With CSS's HSL color model, 0-107 is a gradient from red, orange,
             * yellow, then green. So we can multiply the hue to get the effect of
             * more complete diaries becoming redder.
             */
            const ratio = ratioPerTier.get(tier) ?? 0;
            const hue = 107 * ratio;
            return <StatBar key={tier} color={`hsl(${hue}, 100%, 41%)`} bgColor="rgba(0, 0, 0, 0.5)" ratio={ratio} />;
          })}
        </div>
      </button>
      {modal}
    </>
  );
};

interface DiaryTaskView {
  complete: boolean;
  description: string;
  skills: { skill: Skill; required: Level; current: Level }[];
  quests: { name: string; complete: boolean }[];
}
type DiaryRegionView = Map<DiaryTier, DiaryTaskView[]>;

export const PlayerDiaries = ({
  player,
  skills,
  diaries,
  quests,
}: {
  player: Member.Name;
  skills: Member.Skills | undefined;
  diaries: Member.Diaries | undefined;
  quests: Member.Quests | undefined;
}): ReactElement => {
  const { quests: questData, diaries: diaryData } = useContext(GameDataContext);

  if (diaryData === undefined) return <></>;

  const display = diaryData.entries().map(([region, tasksByTier]) => {
    const progressForRegion = diaries?.[region];

    const displayForRegion = new Map<DiaryTier, DiaryTaskView[]>();

    tasksByTier.forEach((tasks, tier) => {
      const progressForTier = progressForRegion?.[tier];

      const progressForTasks = tasks.map<DiaryTaskView>(
        ({ task, requirements: { quests: taskQuests, skills: taskSkills } }, index) => ({
          complete: progressForTier?.at(index) ?? false,
          description: task,
          quests: taskQuests.map((id) => ({
            name: questData?.get(id)?.name ?? "Summer's End",
            complete: quests?.get(id) === "FINISHED",
          })),
          skills: taskSkills.map(({ skill, level }) => ({
            skill,
            required: level as Level,
            current: computeVirtualLevelFromXP(skills?.[skill] ?? 0),
          })),
        }),
      );

      displayForRegion.set(tier, progressForTasks);
    });

    return <DiarySummary player={player} key={region} region={region} progress={displayForRegion} />;
  });

  return (
    <div className="player-diaries">
      <h2 className="player-diaries-title">Achievement Diaries</h2>
      <div className="player-diaries-completions">{[...display]}</div>
    </div>
  );
};
