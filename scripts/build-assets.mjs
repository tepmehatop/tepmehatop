// Converts PNG sprite sheets into vector path data (for crisp SVG output)
// and writes colorized floor tiles as PNGs (for the canvas game).
//
// Usage: node scripts/build-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SPR = path.join(root, 'assets/sprites');
const OUT_JSON = path.join(root, 'src/lib/generated/sprites.json');
const OUT_PNG = path.join(root, 'src/game/gen');

const readPng = (file) => PNG.sync.read(fs.readFileSync(file));

const hex = (n) => n.toString(16).padStart(2, '0');

/** Region of a PNG → [[fill, pathData], ...] using merged horizontal runs per color. */
function toLayers(png, x0 = 0, y0 = 0, w = png.width, h = png.height) {
  const byColor = new Map();
  for (let y = 0; y < h; y++) {
    let runColor = null;
    let runStart = 0;
    const flush = (xEnd) => {
      if (runColor === null) return;
      const len = xEnd - runStart;
      const d = `M${runStart} ${y}h${len}v1h-${len}z`;
      byColor.set(runColor, (byColor.get(runColor) || '') + d);
      runColor = null;
    };
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * png.width + (x0 + x)) * 4;
      const a = png.data[i + 3];
      const key = a < 8 ? null : `#${hex(png.data[i])}${hex(png.data[i + 1])}${hex(png.data[i + 2])}${a < 250 ? hex(a) : ''}`;
      if (key !== runColor) {
        flush(x);
        if (key !== null) {
          runColor = key;
          runStart = x;
        }
      }
    }
    flush(w);
  }
  return [...byColor.entries()];
}

// ---- Characters: 112x96 sheets, 7 frames (16x32) x 3 rows (down, up, right)
const ROWS = ['down', 'up', 'right'];
const characters = [];
for (let c = 0; c < 10; c++) {
  const png = readPng(path.join(SPR, `characters/char_${c}.png`));
  const frames = {};
  ROWS.forEach((row, r) => {
    frames[row] = [];
    for (let f = 0; f < 7; f++) frames[row].push(toLayers(png, f * 16, r * 32, 16, 32));
  });
  characters.push(frames);
}

// ---- Furniture
const furniture = {};
for (const file of fs.readdirSync(path.join(SPR, 'furniture')).filter((f) => f.endsWith('.png'))) {
  const png = readPng(path.join(SPR, 'furniture', file));
  furniture[file.replace('.png', '')] = { w: png.width, h: png.height, layers: toLayers(png) };
}

// ---- Floors: Photoshop-style colorize (same algorithm as Pixel Agents)
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [r, g, b].map((v) => Math.round((v + m) * 255));
}
function colorize(png, { h, s, b, c }) {
  const out = new PNG({ width: png.width, height: png.height });
  for (let i = 0; i < png.data.length; i += 4) {
    let l = (0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2]) / 255;
    l = 0.5 + (l - 0.5) * ((100 + c) / 100);
    l = Math.max(0, Math.min(1, l + b / 200));
    const [r, g, bb] = hslToRgb(h, s / 100, l);
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = bb;
    out.data[i + 3] = png.data[i + 3];
  }
  return out;
}
const FLOORS = {
  wood: { file: 'floor_6', color: { h: 25, s: 48, b: -43, c: -88 } },
  woodNight: { file: 'floor_6', color: { h: 25, s: 40, b: -62, c: -88 } },
  carpet: { file: 'floor_0', color: { h: 209, s: 39, b: -25, c: -80 } },
  carpetNight: { file: 'floor_0', color: { h: 220, s: 35, b: -48, c: -80 } },
  checker: { file: 'floor_8', color: { h: 209, s: 0, b: -16, c: -8 } },
  tiles: { file: 'floor_3', color: { h: 200, s: 12, b: -20, c: -70 } },
};
fs.mkdirSync(OUT_PNG, { recursive: true });
const floors = {};
for (const [name, { file, color }] of Object.entries(FLOORS)) {
  const png = colorize(readPng(path.join(SPR, `floors/${file}.png`)), color);
  fs.writeFileSync(path.join(OUT_PNG, `floor_${name}.png`), PNG.sync.write(png));
  floors[name] = { w: png.width, h: png.height, layers: toLayers(png) };
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify({ characters, furniture, floors }));
const kb = (fs.statSync(OUT_JSON).size / 1024).toFixed(0);
console.log(`sprites.json: ${characters.length} characters, ${Object.keys(furniture).length} furniture, ${Object.keys(floors).length} floors (${kb} KB)`);
