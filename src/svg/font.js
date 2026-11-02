// Pixel text → SVG path data using Pixelify Sans (OFL). Server-side only.
// Glyph outlines are baked into the SVG, so the README image needs no web fonts.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const fontDir = path.join(process.cwd(), 'assets/fonts');
const cache = new Map();

function load(subset, weight) {
  const key = `${subset}-${weight}`;
  if (!cache.has(key)) {
    const buf = fs.readFileSync(path.join(fontDir, `pixelify-sans-${subset}-${weight}-normal.woff`));
    cache.set(key, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return cache.get(key);
}

function glyphFor(ch, weight) {
  for (const subset of ['latin', 'cyrillic']) {
    const font = load(subset, weight);
    const g = font.charToGlyph(ch);
    if (g && g.index !== 0) return { font, g };
  }
  const font = load('latin', weight);
  return { font, g: font.charToGlyph('?') };
}

/**
 * Measure and outline a string. Size 11 ≈ one font pixel per SVG unit (cap height 7).
 * Returns { d, width }. `x`/`y` is the baseline origin; `anchor` = start|middle|end.
 */
export function textPath(str, { size = 11, weight = 400, x = 0, y = 0, anchor = 'start', spacing = 0 } = {}) {
  const glyphs = [...String(str)].map((ch) => glyphFor(ch, weight));
  const scale = size / 1000;
  const width = glyphs.reduce((w, { g }) => w + g.advanceWidth * scale + spacing, 0) - spacing;
  let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  let d = '';
  for (const { g } of glyphs) {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += g.advanceWidth * scale + spacing;
  }
  return { d, width };
}

export const textWidth = (str, opts) => textPath(str, opts).width;
