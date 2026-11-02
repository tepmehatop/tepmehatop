// Sprite lookup for SVG rendering: characters, furniture, floors + a few original sprites.
import data from '../lib/generated/sprites.json';

// ---- Original sprites (drawn for this project) -------------------------------
import { BUG_FRAMES, CHECK_ART, PALETTES } from '../lib/bugArt.js';
const PALETTE = { ...PALETTES.normal, ...PALETTES.check };
const BUG = BUG_FRAMES;
const CHECK = CHECK_ART;

function asciiLayers(rows) {
  const byColor = new Map();
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let len = 1;
      while (row[x + len] === ch) len++;
      const fill = PALETTE[ch];
      byColor.set(fill, (byColor.get(fill) || '') + `M${x} ${y}h${len}v1h-${len}z`);
      x += len;
    }
  });
  return [...byColor.entries()];
}

const EXTRA = {
  bug_0: { w: 9, h: 8, layers: asciiLayers(BUG[0]) },
  bug_1: { w: 9, h: 8, layers: asciiLayers(BUG[1]) },
  check: { w: 8, h: 6, layers: asciiLayers(CHECK) },
};

/** Resolve a sprite id to { w, h, layers }. */
export function sprite(id) {
  const m = /^c(\d+)_(down|up|right)_(\d)$/.exec(id);
  if (m) return { w: 16, h: 32, layers: data.characters[+m[1]][m[2]][+m[3]] };
  return data.furniture[id] ?? EXTRA[id] ?? null;
}

export const floorTile = (name) => data.floors[name];

/** GitHub contribution colours. */
export const CONTRIB = {
  dark: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
};
