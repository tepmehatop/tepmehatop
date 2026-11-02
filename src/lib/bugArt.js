// Original pixel bug (drawn for this project). Shared by the SVG renderers and the canvas game.
// Each string row is one pixel row; '.' = transparent. Facing right.
export const BUG_FRAMES = [
  ['.k...k...', '..k.k..k.', '.kkRRRkyk', 'kRwRrRkkk', 'kRRrRRkyk', '.kkRRRk..', '..k.k..k.', '.k...k...'],
  ['..k.k....', '...k.k.k.', '.kkRRRkyk', 'kRwRrRkkk', 'kRRrRRkyk', '.kkRRRk..', '...k.k.k.', '..k.k....'],
];

export const CHECK_ART = ['......gg', '.....gG.', 'g...gG..', 'Gg.gG...', '.GgG....', '..G.....'];

export const PALETTES = {
  normal: { k: '#1b1b28', R: '#e5484d', r: '#a1262c', w: '#ffd6d6', y: '#ffe066' },
  critical: { k: '#1b1b28', R: '#a371f7', r: '#6e40c9', w: '#eadcff', y: '#ff7b72' },
  check: { g: '#3fb950', G: '#1a7f37' },
};
