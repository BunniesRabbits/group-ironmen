import { useState, type ReactElement, type ReactNode } from "react";

import "./player-panel.css";
import type { Inventory, NPCInteraction, Stats } from "../../data/api";

/**
 * cyrb53 (c) 2018 bryc (github.com/bryc)
 * License: Public domain (or MIT if needed). Attribution appreciated.
 * A fast and simple 53-bit string hash function with decent collision resistance.
 * Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
 */
const cyrb53 = (str: string, seed = 0): number => {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/**
 * Time in milliseconds before a player is considered offline/inactive.
 * When that is, they are displayed as all grey.
 */
const INACTIVE_TIMER_MS = 300 * 1000;
/**
 * Time in milliseconds before an npc interaction is considered stale and shouldn't be shown.
 */
const INTERACTION_TIMER_MS = 30 * 1000;
/**
 * Static colors to use for various stat bars.
 */
const COLORS = {
  player: {
    hitpoints: "#157145",
    hitpointsBG: "#073823",
    prayer: "#336699",
    prayerBG: "#112233",
    energy: "#a9a9a9",
    energyBG: "#383838",
  },
  interaction: {
    combat: "#A41623",
    combatBG: "#383838",
    nonCombat: "#333355",
  },
};

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

  return (
    <div className="player-interacting">
      <StatBar
        color={isNonCombatNPC ? COLORS.interaction.nonCombat : COLORS.interaction.combat}
        bgColor={isNonCombatNPC ? COLORS.interaction.nonCombat : COLORS.interaction.combatBG}
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
  lastUpdated,
  interacting,
}: {
  name: string;
  stats?: Stats;
  lastUpdated?: Date;
  interacting?: NPCInteraction;
}): ReactElement => {
  const hueDegrees = cyrb53(name) % 360;

  const now = new Date();
  const online = now.getTime() - (lastUpdated ?? new Date(0)).getTime() < INACTIVE_TIMER_MS;

  let interactionBar: ReactNode = undefined;
  if (online && interacting !== undefined) {
    if (now.getTime() - interacting.last_updated.getTime() < INTERACTION_TIMER_MS) {
      const { healthRatio, name } = interacting;
      interactionBar = <PlayerInteracting healthRatio={healthRatio} npcName={name} />;
    }
  }

  let status: ReactNode = undefined;
  if (online && stats?.world !== undefined) {
    status = (
      <>
        - <span className="player-stats-world">{`W${stats.world}`}</span>
      </>
    );
  } else if (!online && lastUpdated !== undefined) {
    status = <> - {lastUpdated.toISOString()}</>;
  }

  const healthRatio = (stats?.health?.current ?? 0) / (stats?.health?.max ?? 1);
  const prayerRatio = (stats?.prayer?.current ?? 0) / (stats?.prayer?.max ?? 1);
  const runRatio = (stats?.run?.current ?? 0) / (stats?.run?.max ?? 1);

  return (
    <div className={`player-stats ${online ? "" : "greyscale"}`}>
      <div className="player-stats-hitpoints">
        <StatBar
          className="player-stats-hitpoints-bar"
          color={COLORS.player.hitpoints}
          bgColor={COLORS.player.hitpointsBG}
          ratio={healthRatio}
        />
        {interactionBar}
        <div className="player-stats-name">
          <img
            alt={`Player icon for ${name}`}
            src="/ui/player-icon.webp"
            style={{ filter: `hue-rotate(${hueDegrees}deg) saturate(75%)` }}
            width="12"
            height="15"
          />
          {name} {status}
        </div>
        <div className="player-stats-hitpoints-numbers">
          {stats?.health.current} / {stats?.health.max}
        </div>
      </div>
      <div className="player-stats-prayer">
        <StatBar
          className="player-stats-prayer-bar"
          color={COLORS.player.prayer}
          bgColor={COLORS.player.prayerBG}
          ratio={prayerRatio}
        />
        <div className="player-stats-prayer-numbers">
          {stats?.prayer.current} / {stats?.prayer.max}
        </div>
      </div>
      <div className="player-stats-energy">
        <StatBar
          className="player-stats-energy-bar"
          color={COLORS.player.energy}
          bgColor={COLORS.player.energyBG}
          ratio={runRatio}
        />
      </div>
      <XpDropper player-name="${this.playerName}" />
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlayerPanelSubcategories = ["Inventory", "Equipment", "Stats", "Quests", "Diaries", "Collection Log"] as const;
type PlayerPanelSubcategory = (typeof PlayerPanelSubcategories)[number];

const PlayerInventory = ({ items }: { items?: Inventory }): ReactElement => {
  return (
    <div className="player-inventory">
      <div className="player-inventory-background">
        {items?.map((item) => {
          if (item === undefined) return <span />;
          return <img alt="osrs item" className="player-inventory-item-box" src={`/icons/items/${item.itemID}.webp`} />;
        })}
      </div>
    </div>
  );
};

export const PlayerPanel = ({
  name,
  stats,
  lastUpdated,
  interacting,
  inventory,
}: {
  name: string;
  stats?: Stats;
  lastUpdated?: Date;
  interacting?: NPCInteraction;
  inventory?: Inventory;
}): ReactElement => {
  const [subcategory, setSubcategory] = useState<PlayerPanelSubcategory>();

  const buttons = (
    [
      {
        category: "Inventory",
        ariaLabel: "inventory",
        alt: "osrs inventory",
        src: "/ui/777-0.png",
        width: 26,
        height: 28,
      },
      {
        category: "Equipment",
        ariaLabel: "equipment",
        alt: "osrs t-posing knight",
        src: "/ui/778-0.png",
        width: 27,
        height: 32,
      },
      { category: "Stats", ariaLabel: "skills", alt: "osrs stats", src: "/ui/3579-0.png", width: 23, height: 22 },
      { category: "Quests", ariaLabel: "quests", alt: "osrs quest", src: "/ui/776-0.png", width: 22, height: 22 },
      {
        category: "Diaries",
        ariaLabel: "diaries",
        alt: "osrs diary",
        src: "/ui/1298-0.png",
        width: 22,
        height: 22,
      },
      {
        category: "Collection Log",
        ariaLabel: "collection-log",
        alt: "osrs collection log",
        src: "/icons/items/22711.webp",
        width: 32,
        height: 32,
        class: "player-panel-collection-log",
      },
    ] satisfies {
      category: PlayerPanelSubcategory;
      ariaLabel: string;
      alt: string;
      src: string;
      width: number;
      height: number;
      class?: string;
    }[]
  ).map((props) => (
    <button
      className={`${props.category === subcategory ? "player-panel-tab-active" : ""} ${props.class}`}
      aria-label={props.ariaLabel}
      type="button"
      onClick={() => {
        const alreadySelected = props.category === subcategory;
        if (alreadySelected) setSubcategory(undefined);
        else setSubcategory(props.category);
      }}
    >
      <img alt={props.alt} src={props.src} width={props.width} height={props.height} />
    </button>
  ));

  let content = undefined;
  switch (subcategory) {
    case "Inventory":
      content = <PlayerInventory items={inventory} />;
      break;
  }

  return (
    <div className={`player-panel rsborder rsbackground ${content !== undefined ? "" : ""}`}>
      <PlayerStats lastUpdated={lastUpdated} interacting={interacting} name={name} stats={stats} />
      <div className="player-panel-minibar">{buttons}</div>
      <div className="player-panel-content">{content}</div>
    </div>
  );
};
