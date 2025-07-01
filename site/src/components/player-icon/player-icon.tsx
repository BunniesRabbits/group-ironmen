import type { ReactElement } from "react";
import * as Member from "../../game/member";

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

const stringToHueDegrees = (string: string): number => cyrb53(string) % 360;

export const PlayerIcon = ({ name }: { name: Member.Name }): ReactElement => (
  <img
    alt={`Player icon for ${name}`}
    src="/ui/player-icon.webp"
    style={{ filter: `hue-rotate(${stringToHueDegrees(name)}deg) saturate(75%)` }}
    width="12"
    height="15"
  />
);
