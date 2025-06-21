import { type ReactElement } from "react";
import type { Skills } from "../../data/api";

import "./player-skills.css";
import { type Experience, SkillIconsInOSRSOrder, computeVirtualLevelFromXP } from "../../data/skill";
import { useSkillTooltip } from "../tooltip/skill-tooltip";

export const PlayerSkills = ({ skills }: { skills?: Skills }): ReactElement => {
  let totalLevel = 0;
  const { tooltipElement, hideTooltip, showTooltip } = useSkillTooltip();

  let totalXP = 0;

  return (
    <div className="player-skills" onPointerLeave={hideTooltip}>
      {tooltipElement}
      {SkillIconsInOSRSOrder.map(({ skill, iconURL }) => {
        const xpInSkill = skills?.get(skill) ?? (0 as Experience);
        totalXP += xpInSkill;
        const virtualLevel = computeVirtualLevelFromXP(xpInSkill);
        const realLevel = Math.min(99, virtualLevel);
        totalLevel += realLevel;

        const wikiURLRaw = `https://oldschool.runescape.wiki/w/${skill}`;

        return (
          <a
            href={URL.parse(wikiURLRaw)?.href ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            key={skill}
            className="skill-box"
            onPointerEnter={() => showTooltip({ style: "Individual", totalXP: xpInSkill })}
          >
            <div className="skill-box-left">
              <img alt={`osrs ${skill} icon`} className="skill-box__icon" src={iconURL} />
            </div>
            <div className="skill-box-right">
              <div className="skill-box-current-level">{realLevel}</div>
              <div className="skill-box-baseline-level">{virtualLevel}</div>
            </div>
            <div className="skill-box-progress">
              <div className="skill-box-progress-bar" style={{}}></div>
            </div>
          </a>
        );
      })}
      <div
        className="total-level-box"
        onPointerEnter={() => showTooltip({ style: "Total", totalXP: totalXP as Experience })}
      >
        <img alt="osrs total level" className="total-level-box-image" src="/ui/183-0.png" />
        <img alt="osrs total level" className="total-level-box-image" src="/ui/184-0.png" />
        <div className="total-level-box-content">
          <span>Total level:</span>
          <span className="total-level-box__level">{totalLevel}</span>
        </div>
      </div>
    </div>
  );
};
