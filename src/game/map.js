// The office: tile grid, furniture and walkability for the canvas game.
export const T = 16;
export const COLS = 30;
export const ROWS = 18;
export const W = COLS * T;
export const H = ROWS * T;
export const WALL_ROWS = 3;

/** PROD zone — bugs that crawl in here "escape to production". */
export const PROD = { c0: 26, r0: 14, c1: 29, r1: 17 };
export const inProd = (c, r) => c >= PROD.c0 && c <= PROD.c1 && r >= PROD.r0 && r <= PROD.r1;

/** Floor tile names (see scripts/build-assets.mjs) per cell. */
export function floorAt(c, r) {
  if (inProd(c, r)) return 'checker';
  return c >= 20 ? 'carpet' : 'wood';
}

/** Developer desks: tile of desk top-left. */
export const DESKS = [
  [2, 4],
  [8, 4],
  [14, 4],
  [2, 10],
  [8, 10],
  [14, 10],
];

// Furniture: sprite name, pixel position, blocked tiles. z = sort key (bottom edge).
const items = [];
const blocked = new Set();
const key = (c, r) => `${c},${r}`;
const block = (c0, r0, c1 = c0, r1 = r0) => {
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) blocked.add(key(c, r));
};
const add = (sprite, x, y, z, extra = {}) => items.push({ sprite, x, y, z: z ?? y + 32, ...extra });

for (const [c, r] of DESKS) {
  add('DESK_FRONT', c * T, r * T, r * T + 32);
  add(null, (c + 1) * T, r * T - 4, r * T + 32.5, { pc: true });
  add('CUSHIONED_CHAIR_BACK', (c + 1) * T, r * T + 28, r * T + 44);
  block(c, r, c + 2, r + 1);
  block(c + 1, r + 2);
}

// Lounge
add('COFFEE_TABLE', 23 * T, 5 * T - 4, 5 * T + 27);
block(23, 5, 24, 6);
add('COFFEE', 23 * T + 2, 5 * T + 4, 5 * T + 27.5);
add('SOFA_FRONT', 22 * T, 9 * T, 10 * T);
add('SOFA_FRONT', 24 * T, 9 * T, 10 * T);
block(22, 9, 25, 9);
add('LARGE_PLANT', 27 * T + 8, 3 * T - 6, 6 * T - 6);
block(28, 3, 29, 4);
add('PLANT', 19 * T, 3 * T - 10, 5 * T - 10);
block(19, 3);
add('PLANT_2', 0, 15 * T, 17 * T);
block(0, 16);
add('CACTUS', 19 * T, 15 * T, 17 * T);
block(19, 16);
add('BIN', 6 * T, 7 * T, 8 * T);
block(6, 7);
add('SMALL_TABLE_FRONT', 21 * T, 13 * T, 15 * T);
block(21, 14, 22, 14);

// Wall decor (no collision — walls block anyway)
export const WALL_DECOR = [
  ['HANGING_PLANT', 2, 0],
  ['WHITEBOARD', 40, 10],
  ['SMALL_PAINTING', 104, 6],
  ['CLOCK', 152, 4],
  ['LARGE_PAINTING', 200, 10],
  ['SMALL_PAINTING_2', 252, 6],
  ['DOUBLE_BOOKSHELF', 336, 16],
  ['BOOKSHELF', 400, 32],
  ['HANGING_PLANT', 460, 0],
];

export const FURNITURE = items;
export const isBlocked = (c, r) => r < WALL_ROWS || c < 0 || r < 0 || c >= COLS || r >= ROWS || blocked.has(key(c, r));

/** Seat (sprite top-left) and bug spawn tile for each desk. */
export const SEATS = DESKS.map(([c, r]) => ({ x: (c + 1) * T, y: r * T + 14, tile: [c + 1, r + 2], spawn: [c + 1, r + 3] }));

/** Where coffee-runners stand in the lounge (tile + facing). */
export const COFFEE_SPOTS = [
  { tile: [22, 6], dir: 'right' },
  { tile: [25, 5], dir: 'left' },
  { tile: [23, 7], dir: 'up' },
  { tile: [24, 7], dir: 'up' },
];
export const COFFEE_PICKUP = { x: 23 * T + 16, y: 7 * T + 8 };

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** BFS distance field to the PROD zone over walkable tiles (bugs). */
export function prodDistance() {
  const dist = Array.from({ length: COLS }, () => new Array(ROWS).fill(Infinity));
  const q = [];
  for (let c = PROD.c0; c <= PROD.c1; c++)
    for (let r = PROD.r0; r <= PROD.r1; r++) {
      dist[c][r] = 0;
      q.push([c, r]);
    }
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      if (isBlocked(nc, nr) || dist[nc][nr] !== Infinity) continue;
      dist[nc][nr] = dist[c][r] + 1;
      q.push([nc, nr]);
    }
  }
  return dist;
}

/** BFS path between tiles (start may be a blocked seat). Returns tiles excluding start. */
export function findPath([sc, sr], [gc, gr]) {
  const prev = new Map([[key(sc, sr), null]]);
  const q = [[sc, sr]];
  while (q.length) {
    const [c, r] = q.shift();
    if (c === gc && r === gr) break;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc;
      const nr = r + dr;
      const k = key(nc, nr);
      if (prev.has(k) || (isBlocked(nc, nr) && !(nc === gc && nr === gr))) continue;
      prev.set(k, [c, r]);
      q.push([nc, nr]);
    }
  }
  if (!prev.has(key(gc, gr))) return [];
  const path = [];
  for (let cur = [gc, gr]; cur && !(cur[0] === sc && cur[1] === sr); cur = prev.get(key(...cur))) path.unshift(cur);
  return path;
}

export const neighbors = (c, r) => DIRS.map(([dc, dr]) => [c + dc, r + dr]);
