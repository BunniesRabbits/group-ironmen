import type { ReactElement } from "react";

import "./player-panel.css";
import type { NPCInteraction } from "../../data/api";

// Shows a stat like hp/prayer
const StatBar = ({ barColor, className }: { barColor: string; className?: string }): ReactElement => {
  return <div style={{ background: barColor }} className={`stat-bar ${className}`} />;
};

// Shows what the player is interacting with, like attacking/talking to an npc
const PlayerInteracting = ({ npcName }: { npcName?: string }): ReactElement => {
  return (
    <div className="player-interacting">
      <StatBar barColor="#A41623" />
      <div className="player-interacting-name" style={{ visibility: npcName === undefined ? "hidden" : "visible" }}>
        {npcName}
      </div>
    </div>
  );
};

interface Stat {
  current: number;
  max: number;
}

const XpDropper = (): ReactElement => {
  return <></>;
};

const PlayerStats = ({
  name,
  hitpoints,
  prayer,
  interacting,
}: {
  name: string;
  hitpoints: Stat;
  prayer: Stat;
  interacting?: NPCInteraction;
}): ReactElement => {
  const hueDegrees = 75;

  const interactionBar = interacting !== undefined ? <PlayerInteracting npcName={interacting.name} /> : undefined;

  return (
    <div className="player-stats">
      <div className="player-stats-hitpoints">
        <StatBar className="player-stats-hitpoints-bar" barColor="#157145" />
        {interactionBar}
        <div className="player-stats-name">
          <img
            alt={`Player icon for ${name}`}
            src="/ui/player-icon.webp"
            style={{ filter: `hue-rotate(${hueDegrees}deg) saturate(75%)` }}
            width="12"
            height="15"
          />
          {name} -<span className="player-stats-world">W404</span>
        </div>
        <div className="player-stats-hitpoints-numbers">
          {hitpoints.current} / {hitpoints.max}
        </div>
      </div>
      <div className="player-stats-prayer">
        <StatBar className="player-stats-prayer-bar" barColor="#336699" />
        <div className="player-stats-prayer-numbers">
          {prayer.current} / {prayer.max}
        </div>
      </div>
      <div className="player-stats-energy">
        <StatBar className="player-stats-energy-bar" barColor="#a9a9a9" />
      </div>
      <XpDropper player-name="${this.playerName}" />
    </div>
  );
};

export const PlayerPanel = ({ name, interacting }: { name: string; interacting?: NPCInteraction }): ReactElement => {
  return (
    <div className="player-panel rsborder rsbackground">
      <PlayerStats
        interacting={interacting}
        name={name}
        hitpoints={{ current: 50, max: 99 }}
        prayer={{ current: 45, max: 70 }}
      />
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
