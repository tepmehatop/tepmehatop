// Game rules: developers push bugs, bugs crawl toward PROD, the QA (player) catches them.
import { T, W, H, SEATS, COFFEE_SPOTS, COFFEE_PICKUP, inProd, isBlocked, prodDistance, findPath, neighbors } from './map.js';

export const ANIM = {
  walk: { frames: [0, 1, 2, 1], dur: 0.15 },
  type: { frames: [3, 4], dur: 0.3 },
  read: { frames: [5, 6], dur: 0.6 },
  idle: { frames: [1], dur: 1 },
};

const PUSH_LINES = ['git push', 'push -f', 'deploy!', 'hotfix', 'YOLO', 'merge!', 'works on my machine', 'quick fix', 'LGTM'];
const CATCH_LINES = ['gotcha!', 'caught!', 'repro!', 'ticket filed', 'nope'];
const PLAYER_SPEED = 72;
const NPC_SPEED = 40;
export const SPRINT_LEN = 30; // seconds per sprint
export const COMBO_WINDOW = 2.5; // seconds to catch the next bug and keep the combo
export const FLAKY_CYCLE = 2.4; // flaky bugs: visible for FLAKY_ON of every cycle
export const FLAKY_ON = 1.5;
const POINTS = { normal: 10, flaky: 15, critical: 25 };

/** Score multiplier for a combo count: 1–2 → x1, 3–4 → x2, … up to x5. */
export const comboMult = (combo) => Math.min(5, 1 + Math.floor(Math.max(0, combo - 1) / 2));
/** Flaky bugs blink in and out of existence (and can't be caught while gone). */
export const flakyVisible = (b) => b.kind !== 'flaky' || (b.t + b.phase) % FLAKY_CYCLE < FLAKY_ON;

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const standPos = ([c, r]) => ({ x: c * T, y: r * T - 14 });

export function createGame({ playerChar, rnd = Math.random, demo = false }) {
  const dist = prodDistance();
  const pool = [...Array(10).keys()].filter((c) => c !== playerChar).sort(() => rnd() - 0.5);
  const npcs = SEATS.map((seat, i) => ({
    char: pool[i % pool.length],
    x: seat.x,
    y: seat.y,
    dir: 'up',
    anim: 'type',
    t: rnd() * 2,
    seat,
    state: 'work',
    path: [],
    bubble: null,
  }));
  return {
    rnd,
    dist,
    time: 0,
    score: 0,
    lives: 3,
    caught: 0,
    escaped: 0,
    over: false,
    npcs,
    player: { char: playerChar, x: 18 * T, y: 8 * T - 14, dir: 'down', anim: 'idle', t: 0, boost: 0, bubble: null },
    bugs: [],
    pending: [],
    fx: [],
    events: [],
    shake: 0,
    flash: 0,
    nextSpawn: 1.6,
    nextCoffeeRun: 7,
    coffee: { available: true, respawnAt: 0 },
    demo,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    sprint: 1,
    banner: demo ? null : { n: 1, bonus: 0, restored: false, until: 1.8 },
  };
}

const say = (ch, text, now, dur = 1.4) => (ch.bubble = { text, until: now + dur });

// ---- Player --------------------------------------------------------------------
function boxBlocked(x, y) {
  const l = x + 3;
  const r = x + 12.9;
  const top = y + 24;
  const bot = y + 30.9;
  if (l < 0 || r >= W || bot >= H) return true;
  for (const px of [l, r]) for (const py of [top, bot]) if (isBlocked(Math.floor(px / T), Math.floor(py / T))) return true;
  return false;
}

function movePlayer(g, dt, input) {
  const p = g.player;
  let vx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let vy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (!vx && !vy && input.target) {
    const dx = input.target.x - (p.x + 8);
    const dy = input.target.y - (p.y + 27);
    if (Math.hypot(dx, dy) > 3) {
      vx = dx;
      vy = dy;
    }
  }
  const len = Math.hypot(vx, vy);
  if (len === 0) {
    p.anim = 'idle';
    return;
  }
  vx /= len;
  vy /= len;
  const speed = PLAYER_SPEED * (p.boost > 0 ? 1.55 : 1) * dt;
  const nx = p.x + vx * speed;
  if (!boxBlocked(nx, p.y)) p.x = nx;
  const ny = p.y + vy * speed;
  if (!boxBlocked(p.x, ny)) p.y = ny;
  p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';
  p.anim = 'walk';
}

// ---- Bugs ------------------------------------------------------------------------
function spawnBug(g, seat) {
  const d = Math.min(g.time / 60, 2);
  const roll = g.rnd();
  const critical = g.time > 20 && roll < Math.min(0.35, 0.1 + 0.15 * d);
  // flaky bugs join from sprint 2: "works on my machine" — now you see them, now you don't
  const flaky = !critical && g.sprint >= 2 && roll < Math.min(0.35, 0.1 + 0.15 * d) + 0.22;
  const kind = critical ? 'critical' : flaky ? 'flaky' : 'normal';
  const [c, r] = seat.spawn;
  const bug = {
    kind,
    phase: g.rnd() * FLAKY_CYCLE,
    x: c * T + 8,
    y: r * T + 8,
    c,
    r,
    pc: c,
    pr: r - 1,
    tc: c,
    tr: r,
    speed: Math.min(48, 21 + 12 * d) * (critical ? 1.45 : flaky ? 1.1 : 1),
    wander: critical ? 0.12 : flaky ? 0.25 : 0.3,
    dir: 'down',
    t: 0,
  };
  chooseNext(g, bug);
  g.bugs.push(bug);
  g.events.push('spawn');
}

function chooseNext(g, b) {
  const here = g.dist[b.c][b.r];
  let opts = neighbors(b.c, b.r).filter(([c, r]) => !isBlocked(c, r) && g.dist[c][r] !== Infinity);
  const forward = opts.filter(([c, r]) => !(c === b.pc && r === b.pr));
  if (forward.length) opts = forward;
  let next;
  if (g.rnd() < b.wander) {
    const ok = opts.filter(([c, r]) => g.dist[c][r] <= here + 1);
    next = pick(ok.length ? ok : opts, g.rnd);
  } else {
    const best = Math.min(...opts.map(([c, r]) => g.dist[c][r]));
    next = pick(opts.filter(([c, r]) => g.dist[c][r] === best), g.rnd);
  }
  [b.tc, b.tr] = next;
  b.dir = b.tc > b.c ? 'right' : b.tc < b.c ? 'left' : b.tr > b.r ? 'down' : 'up';
}

function moveBug(g, b, dt) {
  let move = b.speed * dt;
  b.t += dt;
  while (move > 0) {
    const tx = b.tc * T + 8;
    const ty = b.tr * T + 8;
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d > move) {
      b.x += (dx / d) * move;
      b.y += (dy / d) * move;
      return false;
    }
    b.x = tx;
    b.y = ty;
    move -= d;
    b.pc = b.c;
    b.pr = b.r;
    b.c = b.tc;
    b.r = b.tr;
    if (inProd(b.c, b.r) && g.dist[b.c][b.r] === 0) return true;
    chooseNext(g, b);
  }
  return false;
}

// ---- NPCs ---------------------------------------------------------------------------
function updateNpc(g, n, dt) {
  n.t += dt;
  if (n.path.length) {
    const goal = n.path[0];
    const dx = goal.x - n.x;
    const dy = goal.y - n.y;
    const d = Math.hypot(dx, dy);
    const step = NPC_SPEED * dt;
    n.anim = 'walk';
    if (Math.abs(dx) > Math.abs(dy)) n.dir = dx > 0 ? 'right' : 'left';
    else if (dy) n.dir = dy > 0 ? 'down' : 'up';
    if (d <= step) {
      n.x = goal.x;
      n.y = goal.y;
      n.path.shift();
    } else {
      n.x += (dx / d) * step;
      n.y += (dy / d) * step;
    }
    if (!n.path.length) {
      if (n.state === 'toCoffee') {
        n.state = 'coffee';
        n.until = g.time + 3 + g.rnd() * 2.5;
        n.anim = 'idle';
        n.dir = n.spot.dir;
        if (g.rnd() < 0.6) say(n, pick(['coffee!', 'standup?', 'brb', 'lunch?'], g.rnd), g.time, 1.6);
      } else if (n.state === 'back') {
        n.state = 'work';
        n.x = n.seat.x;
        n.y = n.seat.y;
        n.dir = 'up';
        n.anim = 'type';
      }
    }
    return;
  }
  if (n.state === 'coffee' && g.time >= n.until) {
    n.state = 'back';
    n.path = [...findPath(n.spot.tile, n.seat.tile).map(standPos)];
    n.path.push({ x: n.seat.x, y: n.seat.y });
  }
}

function startCoffeeRun(g) {
  const free = COFFEE_SPOTS.filter((s) => !g.npcs.some((n) => n.spot === s && n.state !== 'work'));
  const workers = g.npcs.filter((n) => n.state === 'work' && !n.bubble);
  if (!free.length || !workers.length) return;
  const n = pick(workers, g.rnd);
  n.spot = pick(free, g.rnd);
  n.state = 'toCoffee';
  n.path = findPath(n.seat.tile, n.spot.tile).map(standPos);
}

// ---- Main update --------------------------------------------------------------------
export function update(g, dt, input) {
  for (const f of g.fx) f.t += dt;
  g.fx = g.fx.filter((f) => f.t < f.life);
  g.shake = Math.max(0, g.shake - dt);
  g.flash = Math.max(0, g.flash - dt);
  g.player.t += dt;
  for (const ch of [g.player, ...g.npcs]) if (ch.bubble && g.time > ch.bubble.until) ch.bubble = null;
  if (g.banner && g.time > g.banner.until) g.banner = null;
  if (g.over) {
    for (const n of g.npcs) n.t += dt;
    return;
  }
  g.time += dt;
  const d = Math.min(g.time / 60, 2);

  // combo expires if you don't catch the next bug quickly
  g.comboTimer = Math.max(0, g.comboTimer - dt);
  if (g.comboTimer === 0) g.combo = 0;

  // sprints: every SPRINT_LEN seconds you survive, the release ships — bonus points and one prod life back
  const sprint = 1 + Math.floor(g.time / SPRINT_LEN);
  if (!g.demo && sprint > g.sprint) {
    g.sprint = sprint;
    const bonus = 50 * (sprint - 1);
    const restored = g.lives < 3;
    g.score += bonus;
    if (restored) g.lives += 1;
    g.banner = { n: sprint, bonus, restored, until: g.time + 2.4 };
    g.events.push('sprint');
  }

  // developers push code → bugs
  g.nextSpawn -= dt;
  if (g.nextSpawn <= 0) {
    const workers = g.npcs.filter((n) => n.state === 'work');
    if (workers.length) {
      const n = pick(workers, g.rnd);
      say(n, pick(PUSH_LINES, g.rnd), g.time, 1.3);
      g.pending.push({ at: g.time + 0.6, seat: n.seat });
    }
    g.nextSpawn = Math.max(1.0, 3.2 - 1.2 * d) * (0.75 + g.rnd() * 0.5);
  }
  g.pending = g.pending.filter((s) => (g.time >= s.at ? (spawnBug(g, s.seat), false) : true));

  // coffee runs keep the office alive
  g.nextCoffeeRun -= dt;
  if (g.nextCoffeeRun <= 0) {
    startCoffeeRun(g);
    g.nextCoffeeRun = 10 + g.rnd() * 10;
  }
  for (const n of g.npcs) updateNpc(g, n, dt);

  // player + coffee boost
  const p = g.player;
  movePlayer(g, dt, input);
  p.boost = Math.max(0, p.boost - dt);
  const fx = p.x + 8;
  const fy = p.y + 27;
  if (!g.coffee.available && g.time >= g.coffee.respawnAt) g.coffee.available = true;
  if (g.coffee.available && Math.hypot(fx - COFFEE_PICKUP.x, fy - COFFEE_PICKUP.y) < 18) {
    g.coffee.available = false;
    g.coffee.respawnAt = g.time + 20;
    p.boost = 6;
    say(p, 'coffee boost!', g.time, 1.2);
    g.events.push('coffee');
  }

  // bugs
  for (const b of g.bugs) {
    if (moveBug(g, b, dt)) {
      b.dead = true;
      g.lives -= 1;
      g.escaped += 1;
      g.shake = 0.35;
      g.flash = 0.45;
      g.fx.push({ kind: 'text', text: 'INCIDENT!', x: b.x, y: b.y - 6, color: '#ff7b72', t: 0, life: 1.1 });
      say(p, pick(['noooo', 'prod!!', 'rollback!'], g.rnd), g.time, 1.1);
      g.combo = 0;
      g.comboTimer = 0;
      g.events.push('escape');
      if (g.lives <= 0) {
        g.over = true;
        g.events.push('over');
      }
      continue;
    }
    if (flakyVisible(b) && Math.hypot(fx - b.x, fy - b.y) < 12.5) {
      b.dead = true;
      const before = comboMult(g.combo);
      g.combo += 1;
      g.comboTimer = COMBO_WINDOW;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      const mult = comboMult(g.combo);
      const pts = POINTS[b.kind] * mult;
      g.score += pts;
      g.caught += 1;
      const color = { critical: '#d2a8ff', flaky: '#f2cc60', normal: '#7ee787' }[b.kind];
      g.fx.push({ kind: 'text', text: mult > 1 ? `+${pts} x${mult}` : `+${pts}`, x: b.x, y: b.y - 6, color, t: 0, life: 0.9 });
      g.fx.push({ kind: 'check', x: b.x - 4, y: b.y - 3, t: 0, life: 0.6 });
      if (mult > before) say(p, `combo x${mult}!`, g.time, 1.0);
      else if (g.rnd() < 0.35) say(p, pick(CATCH_LINES, g.rnd), g.time, 0.9);
      g.events.push(mult > before ? 'combo' : 'catch');
    }
  }
  g.bugs = g.bugs.filter((b) => !b.dead);
}
