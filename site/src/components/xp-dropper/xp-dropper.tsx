import { useEffect, useRef, useState, type ReactElement } from "react";

import "./xp-dropper.css";
import type { Experience, Skill } from "../../data/skill";

interface XpDrop {
  /**
   * A unique ID for the drop. This is used as a key for the DOM nodes, so they
   * are tracked uniquely and have their own CSS animations.
   */
  id: number;

  /**
   * The skill to display the icon for.
   */
  skill: Skill;

  /**
   * The amount of xp in the drop.
   */
  amount: Experience;

  /**
   * Age of the drop, for deleting when it gets old
   */
  createTimestamp: Date;
}

// Should match animation-duration in the CSS
const ANIMATION_TIME_MS = 4000;

/**
 * Displays rising XP drops in the style of OSRS. Automatically cleans up old drops.
 */
export const XpDropper = (): ReactElement => {
  const dropCounterRef = useRef<number>(0);
  const [drops, setDrops] = useState<XpDrop[]>([]);

  useEffect(() => {
    const handle = window.setInterval(
      () =>
        setDrops((old) => {
          const livingDrops = old.filter(
            ({ createTimestamp }) => Date.now() - createTimestamp.getTime() < ANIMATION_TIME_MS,
          );
          const newDrop: XpDrop = {
            id: dropCounterRef.current,
            skill: "Woodcutting",
            amount: 500 as Experience,
            createTimestamp: new Date(Date.now()),
          };
          dropCounterRef.current += 1;
          return [...livingDrops, newDrop];
        }),
      1000,
    );
    return (): void => window.clearInterval(handle);
  }, []);

  return (
    <div className="xp-dropper">
      {drops.map(({ id, skill, amount }) => (
        <div key={id} className="xp-dropper-drop">
          {skill}:{amount}
        </div>
      ))}
    </div>
  );
};
