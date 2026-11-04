// Loads sprite sheets for the canvas game.
import { BUG_FRAMES, CHECK_ART, PALETTES } from '../lib/bugArt.js';

const charUrls = import.meta.glob('../../assets/sprites/characters/*.png', { eager: true, query: '?url', import: 'default' });
const furnUrls = import.meta.glob('../../assets/sprites/furniture/*.png', { eager: true, query: '?url', import: 'default' });
const floorUrls = import.meta.glob('./gen/*.png', { eager: true, query: '?url', import: 'default' });

const baseName = (p) => p.split('/').pop().replace('.png', '');

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

function asciiCanvas(rows, palette) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (palette[ch]) {
        ctx.fillStyle = palette[ch];
        ctx.fillRect(x, y, 1, 1);
      }
    }),
  );
  return c;
}

export const charSheetUrls = Object.keys(charUrls)
  .sort((a, b) => parseInt(baseName(a).split('_')[1]) - parseInt(baseName(b).split('_')[1]))
  .map((k) => charUrls[k]);

export async function loadAssets() {
  const chars = await Promise.all(charSheetUrls.map(loadImage));
  const furn = Object.fromEntries(
    await Promise.all(Object.entries(furnUrls).map(async ([p, url]) => [baseName(p), await loadImage(url)])),
  );
  const floors = Object.fromEntries(
    await Promise.all(Object.entries(floorUrls).map(async ([p, url]) => [baseName(p).replace('floor_', ''), await loadImage(url)])),
  );
  const bugs = {
    normal: BUG_FRAMES.map((f) => asciiCanvas(f, PALETTES.normal)),
    critical: BUG_FRAMES.map((f) => asciiCanvas(f, PALETTES.critical)),
    flaky: BUG_FRAMES.map((f) => asciiCanvas(f, PALETTES.flaky)),
  };
  const check = asciiCanvas(CHECK_ART, PALETTES.check);
  return { chars, furn, floors, bugs, check };
}
