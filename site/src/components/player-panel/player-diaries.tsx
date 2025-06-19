import type { ReactElement } from "react";
import { StatBar } from "./stat-bar";
import type { Diaries } from "../../data/api";
import { DiaryRegion, DiaryTier } from "../../data/diary-data";

import "./player-diaries.css";

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

const DiaryCompletion = ({ name, progress }: { name: string; progress: Map<DiaryTier, boolean[]> }): ReactElement => {
  let total = 0;
  let complete = 0;
  progress.forEach((flags) => {
    total += flags.length;
    complete += countTrue(flags);
  });

  return (
    <div className="rsborder-tiny diary-completion">
      <div className="diary-completion-top">
        <span>{name}</span>
        <span>
          {total}/{complete}
        </span>
      </div>
      <div className="diary-completion-bottom">
        {DiaryTier.map((tier) => {
          const ratio = getDiaryProgressRatio(progress.get(tier));
          // With CSS's HSL color model, 0-107 is a gradient from red, orange, yellow, then green.
          // So we can multiply the hue to get the effect of more complete diaries becoming redder.
          const hue = 107 * ratio;
          return <StatBar key={tier} color={`hsl(${hue}, 100%, 41%)`} bgColor="rgba(0, 0, 0, 0.5)" ratio={ratio} />;
        })}
      </div>
    </div>
  );
};

export const PlayerDiaries = ({ diaries }: { diaries?: Diaries }): ReactElement => {
  if (diaries === undefined) return <></>;

  return (
    <div className="player-diaries">
      <h2 className="player-diaries-title">Achievement Diaries</h2>
      <div className="player-diaries-completions">
        {DiaryRegion.map((region) => {
          const progress = diaries.get(region);
          if (progress === undefined) return undefined;
          return <DiaryCompletion key={region} name={region} progress={progress} />;
        })}
      </div>
    </div>
  );
};
