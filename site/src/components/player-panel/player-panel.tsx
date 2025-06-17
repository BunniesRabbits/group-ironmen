import type { ReactElement } from "react";

import "./player-panel.css";
import type { NPCInteraction, Stats } from "../../data/api";

// Shows a stat like hp/prayer
interface StatBarProps {
  className?: string;
  color: string;
  bgColor: string;
  ratio?: number;
}
const StatBar = ({ className, color, bgColor, ratio }: StatBarProps): ReactElement => {
  let background = bgColor;
  if (ratio === 1) {
    background = color;
  } else if (ratio !== undefined && ratio >= 0) {
    const percentage = ratio * 100;
    background = `linear-gradient(90deg, ${color}, ${percentage}%, ${bgColor} ${percentage}%)`;
  }

  return <div style={{ background }} className={`stat-bar ${className}`} />;
};

// Shows what the player is interacting with, like attacking/talking to an npc
const PlayerInteracting = ({ npcName, healthRatio }: { npcName: string; healthRatio?: number }): ReactElement => {
  const isNonCombatNPC = healthRatio === undefined;

  const COMBAT_COLOR = "#A41623";
  const COMBAT_BG_COLOR = "#383838";

  const NONCOMBAT_COLOR = "#333355";

  return (
    <div className="player-interacting">
      <StatBar
        color={isNonCombatNPC ? NONCOMBAT_COLOR : COMBAT_COLOR}
        bgColor={isNonCombatNPC ? NONCOMBAT_COLOR : COMBAT_BG_COLOR}
        ratio={healthRatio}
      />
      <div className="player-interacting-name">{npcName}</div>
    </div>
  );
};

const XpDropper = (): ReactElement => {
  return <></>;
};

const PlayerStats = ({
  name,
  stats,
  interacting,
}: {
  name: string;
  stats?: Stats;
  interacting?: NPCInteraction;
}): ReactElement => {
  const hueDegrees = 75;

  const interactionBar =
    interacting !== undefined ? (
      <PlayerInteracting healthRatio={interacting.healthRatio} npcName={interacting.name} />
    ) : undefined;

  const healthRatio = (stats?.health?.current ?? 0) / (stats?.health?.max ?? 1);
  const prayerRatio = (stats?.prayer?.current ?? 0) / (stats?.prayer?.max ?? 1);
  const runRatio = (stats?.run?.current ?? 0) / (stats?.run?.max ?? 1);

  return (
    <div className="player-stats">
      <div className="player-stats-hitpoints">
        <StatBar className="player-stats-hitpoints-bar" color="#157145" bgColor="#073823" ratio={healthRatio} />
        {interactionBar}
        <div className="player-stats-name">
          <img
            alt={`Player icon for ${name}`}
            src="/ui/player-icon.webp"
            style={{ filter: `hue-rotate(${hueDegrees}deg) saturate(75%)` }}
            width="12"
            height="15"
          />
          {name} - <span className="player-stats-world">W{stats?.world}</span>
        </div>
        <div className="player-stats-hitpoints-numbers">
          {stats?.health.current} / {stats?.health.max}
        </div>
      </div>
      <div className="player-stats-prayer">
        <StatBar className="player-stats-prayer-bar" color="#336699" bgColor="#112233" ratio={prayerRatio} />
        <div className="player-stats-prayer-numbers">
          {stats?.prayer.current} / {stats?.prayer.max}
        </div>
      </div>
      <div className="player-stats-energy">
        <StatBar className="player-stats-energy-bar" color="#a9a9a9" bgColor="#383838" ratio={runRatio} />
      </div>
      <XpDropper player-name="${this.playerName}" />
    </div>
  );
};

export const PlayerPanel = ({
  name,
  interacting,
  stats,
}: {
  name: string;
  interacting?: NPCInteraction;
  stats?: Stats;
}): ReactElement => {
  return (
    <div className="player-panel rsborder rsbackground">
      <PlayerStats interacting={interacting} name={name} stats={stats} />
      <div className="player-panel-minibar">
        <button aria-label="inventory" type="button">
          <img alt="osrs inventory icon" src="/ui/777-0.png" width="26" height="28" />
        </button>
        <button aria-label="equipment" type="button">
          <img alt="osrs t-posing knight" src="/ui/778-0.png" width="27" height="32" />
        </button>
        <button aria-label="skills" type="button">
          <img alt="osrs stats icon" src="/ui/3579-0.png" width="23" height="22" />
        </button>
        <button aria-label="quests" type="button">
          <img alt="osrs quest icon" src="/ui/776-0.png" width="22" height="22" />
        </button>
        <button aria-label="diaries" type="button">
          <img alt="osrs diary icon" src="/ui/1298-0.png" width="22" height="22" />
        </button>
        <button aria-label="collection-log" type="button">
          <img alt="osrs collection log icon" src="/icons/items/22711.webp" width="32" />
        </button>
      </div>
      <div className="player-panel-content"></div>
    </div>
  );
};
