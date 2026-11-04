// Canvas renderer: pixel-perfect sprites at an integer scale, y-sorted for depth.
import { T, W, H, COLS, ROWS, WALL_ROWS, PROD, FURNITURE, WALL_DECOR, COFFEE_PICKUP, floorAt } from './map.js';
import { ANIM, comboMult, flakyVisible, FLAKY_CYCLE, FLAKY_ON, COMBO_WINDOW } from './engine.js';

const ROW = { down: 0, up: 1, right: 2, left: 2 };
const FONT = '"Pixelify Sans", monospace';

export function draw(ctx, g, A, S, labels) {
  const snap = (v) => Math.round(v * S) / S;
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (g.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));

  // floor
  for (let r = WALL_ROWS; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) ctx.drawImage(A.floors[floorAt(c, r)], c * T, r * T);

  // PROD zone
  const px = PROD.c0 * T;
  const py = PROD.r0 * T;
  const pw = (PROD.c1 - PROD.c0 + 1) * T;
  const ph = (PROD.r1 - PROD.r0 + 1) * T;
  ctx.fillStyle = 'rgba(248,81,73,0.28)';
  ctx.fillRect(px, py, pw, ph);
  for (let i = 0; i < pw + ph; i += 8) {
    ctx.fillStyle = i % 16 ? '#1b1b28' : '#f2cc60';
    ctx.fillRect(px + Math.min(i, pw - 4), py, 4, 3);
    ctx.fillRect(px, py + Math.min(i, ph - 4), 3, 4);
  }
  // server racks
  for (let k = 0; k < 3; k++) {
    const rx = px + 14 + k * 16;
    const ry = py + 20;
    ctx.fillStyle = '#161b22';
    ctx.fillRect(rx, ry, 12, 34);
    ctx.fillStyle = '#30363d';
    ctx.fillRect(rx + 1, ry + 1, 10, 32);
    for (let l = 0; l < 6; l++) {
      const on = Math.floor(g.time * 4 + k * 3 + l * 7) % 5 !== 0;
      ctx.fillStyle = on ? (g.flash > 0 ? '#ff7b72' : '#3fb950') : '#0d1117';
      ctx.fillRect(rx + 2, ry + 3 + l * 5, 2, 2);
      ctx.fillStyle = '#8b949e';
      ctx.fillRect(rx + 5, ry + 3 + l * 5, 5, 1);
    }
  }
  text(ctx, 'PROD', px + pw / 2, py + 14, { size: 11, weight: 700, color: '#ff7b72', align: 'center', outline: '#1b1b28' });

  // walls
  ctx.fillStyle = '#26304a';
  ctx.fillRect(0, 0, W, WALL_ROWS * T);
  ctx.fillStyle = '#171e30';
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, WALL_ROWS * T - 3, W, 3);
  for (const [name, x, y] of WALL_DECOR) ctx.drawImage(A.furn[name], x, y);

  // y-sorted scene
  const list = [];
  FURNITURE.forEach((f, i) => list.push({ z: f.z, f, i }));
  for (const n of g.npcs) list.push({ z: n.y + (n.anim === 'type' || n.anim === 'read' ? 26 : 30), ch: n });
  list.push({ z: g.player.y + 30, ch: g.player, me: true });
  for (const b of g.bugs) list.push({ z: b.y + 4, bug: b });
  list.sort((a, b) => a.z - b.z);

  for (const it of list) {
    if (it.f) {
      const f = it.f;
      if (f.pc) {
        const frame = 1 + (Math.floor(g.time / 0.25 + it.i) % 3);
        ctx.drawImage(A.furn[`PC_FRONT_ON_${frame}`], f.x, f.y);
      } else ctx.drawImage(A.furn[f.sprite], f.x, f.y);
    } else if (it.ch) {
      drawChar(ctx, A, it.ch, snap);
    } else if (it.bug) {
      drawBug(ctx, A, it.bug, snap);
    }
  }

  // coffee sparkle
  if (g.coffee.available) {
    // pulsing pixel sparkle over the coffee mug
    const k = Math.floor(g.time * 6) % 4;
    const cx = COFFEE_PICKUP.x - 6;
    const cy = COFFEE_PICKUP.y - 30;
    ctx.fillStyle = k === 3 ? '#fff4c2' : '#ffd36b';
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    if (k > 0) {
      ctx.fillRect(cx, cy - 1 - k, 1, k);
      ctx.fillRect(cx, cy + 2, 1, k);
      ctx.fillRect(cx - 1 - k, cy, k, 1);
      ctx.fillRect(cx + 2, cy, k, 1);
    }
  }

  // overlays: name tag, bubbles, effects
  const p = g.player;
  tag(ctx, labels.you, snap(p.x) + 8, snap(p.y) - 1, p.boost > 0 ? '#ffa657' : '#ffd36b');
  for (const n of g.npcs) if (n.bubble) bubble(ctx, n.bubble.text, snap(n.x) + 8, snap(n.y) + (n.anim === 'type' ? 2 : 0));
  if (p.bubble) bubble(ctx, p.bubble.text, snap(p.x) + 8, snap(p.y) - 11, 'ok');

  for (const f of g.fx) {
    const k = f.t / f.life;
    ctx.globalAlpha = 1 - k * k;
    if (f.kind === 'text') text(ctx, f.text, f.x, f.y - k * 14, { size: 9, weight: 700, color: f.color, align: 'center', outline: '#0d1117' });
    else ctx.drawImage(A.check, Math.round(f.x), Math.round(f.y - k * 6));
    ctx.globalAlpha = 1;
  }

  if (g.flash > 0) {
    ctx.fillStyle = `rgba(248,81,73,${(g.flash / 0.45) * 0.28})`;
    ctx.fillRect(-4, -4, W + 8, H + 8);
  }

  // combo meter (top-left, on the wall)
  const mult = comboMult(g.combo);
  if (mult > 1 && g.comboTimer > 0) {
    text(ctx, `COMBO x${mult}`, 6, 42, { size: 11, weight: 700, color: '#ffa657', outline: '#0d1117' });
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(6, 44, 60, 3);
    ctx.fillStyle = '#ffa657';
    ctx.fillRect(6, 44, Math.round((60 * g.comboTimer) / COMBO_WINDOW), 3);
  }

  // sprint banner — on the wall, so it never hides the floor where bugs run
  if (g.banner && !g.over) {
    const b = g.banner;
    const left = b.until - g.time;
    const bw = 236;
    const bx = Math.round(W / 2 - bw / 2);
    ctx.globalAlpha = Math.min(1, left / 0.4);
    ctx.fillStyle = '#1b1b28';
    ctx.fillRect(bx - 1, 3, bw + 2, 42);
    ctx.fillStyle = '#26304a';
    ctx.fillRect(bx, 4, bw, 40);
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(bx, 4, bw, 2);
    text(ctx, `${labels.sprint} ${b.n}`, W / 2, b.n > 1 ? 24 : 30, { size: 18, weight: 700, color: '#ffd36b', align: 'center', outline: '#1b1b28' });
    if (b.n > 1) {
      const sub = `${labels.shipped} +${b.bonus}${b.restored ? ` · ${labels.restored} ♥` : ''}`;
      text(ctx, sub, W / 2, 38, { size: 9, color: '#7ee787', align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}

function drawChar(ctx, A, ch, snap) {
  const spec = ANIM[ch.anim] ?? ANIM.idle;
  const frame = spec.frames[Math.floor(ch.t / spec.dur) % spec.frames.length];
  const img = A.chars[ch.char];
  const x = snap(ch.x);
  const y = snap(ch.y);
  if (ch.dir === 'left') {
    ctx.save();
    ctx.translate(x + 16, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, frame * 16, ROW.left * 32, 16, 32, 0, 0, 16, 32);
    ctx.restore();
  } else ctx.drawImage(img, frame * 16, ROW[ch.dir] * 32, 16, 32, x, y, 16, 32);
}

const BUG_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
function drawBug(ctx, A, b, snap) {
  const img = A.bugs[b.kind][Math.floor(b.t / 0.12) % 2];
  ctx.save();
  if (b.kind === 'flaky') {
    // flaky bugs flicker before vanishing and leave a faint ghost while gone
    const k = (b.t + b.phase) % FLAKY_CYCLE;
    if (!flakyVisible(b)) ctx.globalAlpha = 0.12;
    else if (k > FLAKY_ON - 0.35) ctx.globalAlpha = Math.floor(b.t * 20) % 2 ? 0.35 : 1;
  }
  ctx.translate(snap(b.x), snap(b.y));
  ctx.rotate(BUG_ANGLE[b.dir]);
  if (b.dir === 'left') ctx.scale(1, -1);
  ctx.drawImage(img, -4.5, -4);
  ctx.restore();
}

export function text(ctx, str, x, y, { size = 8, weight = 400, color = '#fff', align = 'left', outline } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.fillStyle = outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.fillText(str, x + dx * 0.75, y + dy * 0.75);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function bubble(ctx, str, cx, top, tone) {
  ctx.font = `400 8px ${FONT}`;
  const w = Math.ceil(ctx.measureText(str).width) + 6;
  const x = Math.round(cx - w / 2);
  const y = top - 12;
  ctx.fillStyle = tone === 'ok' ? '#1a7f37' : '#1b1b28';
  ctx.fillRect(x - 1, y - 1, w + 2, 12);
  ctx.fillStyle = tone === 'ok' ? '#dafbe1' : '#ffffff';
  ctx.fillRect(x, y, w, 10);
  ctx.fillRect(cx - 2, y + 10, 4, 1);
  ctx.fillRect(cx - 1, y + 11, 2, 1);
  text(ctx, str, cx, y + 8, { color: tone === 'ok' ? '#0f5323' : '#1b1b28', align: 'center' });
}

function tag(ctx, str, cx, y, color) {
  ctx.font = `700 7px ${FONT}`;
  const w = Math.ceil(ctx.measureText(str).width) + 4;
  ctx.fillStyle = 'rgba(13,17,23,0.75)';
  ctx.fillRect(Math.round(cx - w / 2), y - 8, w, 9);
  text(ctx, str, cx, y - 1.5, { size: 7, weight: 700, color, align: 'center' });
}
