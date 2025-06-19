import { type ReactElement } from "react";
import type { Skills } from "../../data/api";

import "./player-skills.css";
import type { Skill } from "../../data/skill";

const levelLookup = new Map<number, number>();
{
  let xp = 0;
  for (let L = 1; L <= 126; L++) {
    // https://oldschool.runescape.wiki/w/Experience
    levelLookup.set(L, Math.floor(xp));
    xp += 0.25 * Math.floor(L + 300 * 2 ** (L / 7));
  }
}

// Row-major order, like how the skills are laid out in OSRS
const SkillIconsInOSRSOrder: { skill: Skill; iconURL: string }[] = [
  { skill: "Attack", iconURL: "/ui/197-0.png" },
  { skill: "Hitpoints", iconURL: "/ui/203-0.png" },
  { skill: "Mining", iconURL: "/ui/209-0.png" },
  { skill: "Strength", iconURL: "/ui/198-0.png" },
  { skill: "Agility", iconURL: "/ui/204-0.png" },
  { skill: "Smithing", iconURL: "/ui/210-0.png" },
  { skill: "Defence", iconURL: "/ui/199-0.png" },
  { skill: "Herblore", iconURL: "/ui/205-0.png" },
  { skill: "Fishing", iconURL: "/ui/211-0.png" },
  { skill: "Ranged", iconURL: "/ui/200-0.png" },
  { skill: "Thieving", iconURL: "/ui/206-0.png" },
  { skill: "Cooking", iconURL: "/ui/212-0.png" },
  { skill: "Prayer", iconURL: "/ui/201-0.png" },
  { skill: "Crafting", iconURL: "/ui/207-0.png" },
  { skill: "Firemaking", iconURL: "/ui/213-0.png" },
  { skill: "Magic", iconURL: "/ui/202-0.png" },
  { skill: "Fletching", iconURL: "/ui/208-0.png" },
  { skill: "Woodcutting", iconURL: "/ui/214-0.png" },
  { skill: "Runecraft", iconURL: "/ui/215-0.png" },
  { skill: "Slayer", iconURL: "/ui/216-0.png" },
  { skill: "Farming", iconURL: "/ui/217-0.png" },
  { skill: "Construction", iconURL: "/ui/221-0.png" },
  { skill: "Hunter", iconURL: "/ui/220-0.png" },
];
export const PlayerSkills = ({ skills }: { skills?: Skills }): ReactElement => {
  let totalLevel = 0;
  return (
    <div className="player-skills">
      {SkillIconsInOSRSOrder.map(({ skill, iconURL }) => {
        const xp = skills?.get(skill) ?? 0;
        let virtualLevel = 1;
        while (xp >= (levelLookup.get(virtualLevel + 1) ?? Infinity)) virtualLevel += 1;
        const realLevel = Math.min(99, virtualLevel);
        totalLevel += realLevel;

        return (
          <div key={skill} className="skill-box">
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
          </div>
        );
      })}
      <div className="total-level-box">
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
