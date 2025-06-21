import { useRef, useState, type ReactElement } from "react";

import "./tooltip.css";
import { createPortal } from "react-dom";
import { decomposeExperience, type Experience } from "../../data/skill";
import { StatBar } from "../player-panel/stat-bar";

export interface SkillTooltipProps {
  style: "Individual" | "Total";
  totalXP: Experience;
}

/**
 * A hook to utilize the global tooltip with experience data, such as name, current level, remaining xp, etc.
 */
export const useSkillTooltip = (): {
  tooltipElement: ReactElement;
  hideTooltip: () => void;
  showTooltip: (item: SkillTooltipProps) => void;
} => {
  const [skillProps, setSkillProps] = useState<SkillTooltipProps>();
  const tooltipRef = useRef<HTMLDivElement>(document.body.querySelector<HTMLDivElement>("div#tooltip")!);

  const hideTooltip = (): void => {
    setSkillProps(undefined);
    tooltipRef.current.style.visibility = "hidden";
  };
  const showTooltip = (item: SkillTooltipProps): void => {
    setSkillProps(item);
    tooltipRef.current.style.visibility = "visible";
  };

  let element = undefined;
  if (skillProps?.style === "Total") {
    element = <>Total XP: {skillProps.totalXP.toLocaleString()}</>;
  } else if (skillProps?.style === "Individual") {
    const { xpUntilMax, xpUntilLevelFromFresh, xpOverLevel, xpRequiredForMax, xpUntilLevel } = decomposeExperience(
      skillProps.totalXP,
    );

    const ratioUntilCurrent = xpOverLevel / xpUntilLevelFromFresh;
    const ratioUntilMax = skillProps.totalXP / xpRequiredForMax;

    element = (
      <>
        Total XP: {skillProps.totalXP.toLocaleString()}
        <br />
        Until Level: {xpUntilLevel.toLocaleString()}
        <StatBar color={`hsl(${107 * ratioUntilCurrent}, 100%, 41%)`} bgColor="#222222" ratio={ratioUntilCurrent} />
        Until Max: {xpUntilMax.toLocaleString()}
        <StatBar color={`hsl(${107 * ratioUntilMax}, 100%, 41%)`} bgColor="#222222" ratio={ratioUntilMax} />
      </>
    );
  }

  const tooltipElement = createPortal(element, tooltipRef.current);

  return { tooltipElement, hideTooltip, showTooltip };
};
