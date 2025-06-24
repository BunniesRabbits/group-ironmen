import { type ReactElement } from "react";
import type * as Member from "../../data/member";

import "./xp-dropper.css";

/**
 * Displays rising XP drops in the style of OSRS.
 */
export const XpDropper = ({ xpDrops }: { xpDrops: Member.ExperienceDrop[] | undefined }): ReactElement => {
  return (
    <div className="xp-dropper">
      {xpDrops?.map(({ id, skill, amount }) => (
        <div key={id} className="xp-dropper-drop">
          {skill}:{amount}
        </div>
      ))}
    </div>
  );
};
