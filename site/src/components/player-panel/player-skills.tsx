import { type ReactElement } from "react";
import type { Skills } from "../../data/api";

import "./player-skills.css";
import { type Experience, SkillIconsInOSRSOrder, decomposeExperience } from "../../data/skill";
import { useSkillTooltip } from "../tooltip/skill-tooltip";

export const PlayerSkills = ({ skills }: { skills?: Skills }): ReactElement => {
  const { tooltipElement, hideTooltip, showTooltip } = useSkillTooltip();

  let levelTotal = 0;
  let xpTotal = 0;

  return (
    <div className="player-skills" onPointerLeave={hideTooltip}>
      {tooltipElement}
      {SkillIconsInOSRSOrder.map(({ skill, iconURL }) => {
        const xp = skills?.get(skill) ?? (0 as Experience);
        xpTotal += xp;

        const { xpDeltaFromMax, levelReal, levelVirtual, xpMilestoneOfNext } = decomposeExperience(xp);

        levelTotal += levelReal;

        const wikiURLRaw = `https://oldschool.runescape.wiki/w/${skill}`;

        return (
          <a
            href={URL.parse(wikiURLRaw)?.href ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            key={skill}
            className="skill-box"
            onPointerEnter={() =>
              showTooltip({
                style: "Individual",
                xp,
                untilMax: Math.max(0, xpDeltaFromMax - xp) as Experience,
                untilMaxRatio: Math.min(xp / xpDeltaFromMax, 1.0),
                untilNext: (xpMilestoneOfNext - xp) as Experience,
                untilNextRatio: Math.min(xp / xpMilestoneOfNext, 1.0),
              })
            }
          >
            <div className="skill-box-left">
              <img alt={`osrs ${skill} icon`} className="skill-box__icon" src={iconURL} />
            </div>
            <div className="skill-box-right">
              <div className="skill-box-current-level">{levelReal}</div>
              <div className="skill-box-baseline-level">{levelVirtual}</div>
            </div>
            <div className="skill-box-progress">
              <div className="skill-box-progress-bar" style={{}}></div>
            </div>
          </a>
        );
      })}
      <div
        className="total-level-box"
        onPointerEnter={() => showTooltip({ style: "Total", xp: xpTotal as Experience })}
      >
        <img alt="osrs total level" className="total-level-box-image" src="/ui/183-0.png" />
        <img alt="osrs total level" className="total-level-box-image" src="/ui/184-0.png" />
        <div className="total-level-box-content">
          <span>Total level:</span>
          <span className="total-level-box__level">{levelTotal}</span>
        </div>
      </div>
    </div>
  );
};
