// Turns little "scripts" for pixel characters into CSS keyframe animations
// that run inside a standalone SVG (no JavaScript needed — works in GitHub READMEs).

const pct = (t, L) => `${Math.min(100, Math.max(0, (t / L) * 100)).toFixed(3)}%`;
const r1 = (v) => Math.round(v * 100) / 100;

/** Frame layout of the Pixel Agents / Metro City character sheets. */
export const ANIMS = {
  walk: { frames: [0, 1, 2, 1], dur: 0.15 },
  type: { frames: [3, 4], dur: 0.3 },
  read: { frames: [5, 6], dur: 0.6 },
  idle: { frames: [1], dur: 1 },
};

/** Sprite definition id for a character frame. */
export const frameId = (char, row, frame) => `c${char}_${row}_${frame}`;

/**
 * Compile an actor script into timed segments.
 *
 * actor = {
 *   id, char (0-9), start: [x, y] (top-left of the 16x32 sprite), speed (px/s),
 *   steps: [
 *     { walk: [[x, y], ...] }               // straight moves, one axis at a time ideally
 *     { do: 'type'|'read'|'idle', dir, t, say? }
 *     { hide: t }                           // invisible for t seconds
 *     { teleport: [x, y] }                  // instant move (use while hidden)
 *   ],
 *   tag?: '@name'                           // label above the head
 * }
 */
export function compileActor(actor, loop) {
  const speed = actor.speed ?? 30;
  let [x, y] = actor.start;
  let t = 0;
  let dir = actor.dir ?? 'down';
  const points = [{ t: 0, x, y }];
  const windows = new Map(); // clipKey -> [[t0, t1]]
  const bubbles = [];
  const addWindow = (key, t0, t1) => {
    if (t1 - t0 <= 0) return;
    if (!windows.has(key)) windows.set(key, []);
    windows.get(key).push([t0, t1]);
  };

  for (const step of actor.steps) {
    if (step.walk) {
      for (const [nx, ny] of step.walk) {
        const dx = nx - x;
        const dy = ny - y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) continue;
        dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        const dt = dist / (step.speed ?? speed);
        addWindow(`walk_${dir}`, t, t + dt);
        if (step.say) bubbles.push({ text: step.say, t0: t, t1: t + dt, tone: step.tone });
        t += dt;
        x = nx;
        y = ny;
        points.push({ t, x, y });
      }
    } else if (step.do) {
      dir = step.dir ?? dir;
      const dt = step.until !== undefined ? step.until - t : step.t;
      addWindow(`${step.do}_${dir}`, t, t + dt);
      if (step.say) {
        const t0 = t + (step.sayDelay ?? 0);
        bubbles.push({ text: step.say, t0, t1: step.sayFor ? t0 + step.sayFor : t + dt, tone: step.tone });
      }
      t += dt;
      points.push({ t, x, y });
    } else if (step.hide !== undefined || step.hideUntil !== undefined) {
      t += step.hide ?? step.hideUntil - t;
      points.push({ t, x, y });
    } else if (step.teleport) {
      [x, y] = step.teleport;
      points.push({ t, x, y });
    }
  }
  if (loop !== undefined && t < loop) {
    addWindow(`idle_${dir}`, t, loop);
    t = loop;
    points.push({ t, x, y });
  }
  return { ...actor, duration: t, points, windows, bubbles };
}

/** Movement keyframes for an actor's outer group. */
export function moveKeyframes(name, points, L) {
  const lines = points.map((p) => `${pct(p.t, L)}{transform:translate(${r1(p.x)}px,${r1(p.y)}px)}`);
  return `@keyframes ${name}{${lines.join('')}}`;
}

/** Visibility keyframes (step-end) for a list of [t0, t1] windows inside a loop of length L. */
export function visKeyframes(name, wins, L) {
  const visible = (t) => (wins.some(([a, b]) => t >= a - 1e-6 && t < b - 1e-6) ? 1 : 0);
  const keys = [...new Set([0, ...wins.flat().filter((t) => t > 0 && t < L)])].sort((p, q) => p - q);
  const frames = keys.map((k) => `${pct(k, L)}{opacity:${visible(k)}}`);
  frames.push(`100%{opacity:${visible(0)}}`);
  return `@keyframes ${name}{${frames.join('')}}`;
}

/** Shared frame-cycling keyframes: frame i of n is visible for 1/n of the cycle. */
export function frameCycleCss(ns) {
  return [...new Set(ns)]
    .filter((n) => n > 1)
    .map((n) => `@keyframes fc${n}{0%{opacity:1}${(100 / n).toFixed(3)}%{opacity:0}100%{opacity:0}}`)
    .join('');
}

/** Inline style for frame i of an n-frame cycle with per-frame duration d. */
export const frameStyle = (i, n, d) =>
  n > 1 ? `animation:fc${n} ${r1(n * d)}s step-end ${r1(i * d - n * d)}s infinite` : '';

/**
 * Build everything an SVG needs to render a list of actors:
 * returns { css, actors: [{ id, char, tag, clips: [{ key, flip, frames: [{ref, style}] , style }], bubbles, style }], refs: Set }
 */
export function buildActors(actorDefs, L, prefix = 'a') {
  const css = [];
  const refs = new Set();
  const cycles = [];
  const out = actorDefs.map((def, idx) => {
    const a = compileActor(def, L);
    const id = `${prefix}${idx}`;
    css.push(moveKeyframes(`${id}m`, a.points, L));
    const clips = [];
    for (const [key, wins] of a.windows) {
      const [anim, dir] = key.split('_');
      const visName = `${id}${key}`;
      css.push(visKeyframes(visName, wins, L));
      const style = `animation:${visName} ${L}s step-end infinite`;
      if (a.kind === 'bug' || a.kind === 'fx') {
        // Non-character sprites: one frame set, oriented by transform.
        const ids = a.kind === 'bug' ? (anim === 'walk' ? ['bug_0', 'bug_1'] : ['bug_0']) : [a.sprite];
        const n = ids.length;
        cycles.push(n);
        const tf = { right: undefined, left: 'translate(9 0) scale(-1 1)', down: 'translate(8 0) rotate(90)', up: 'translate(0 9) rotate(-90)' };
        clips.push({
          key,
          transform: a.kind === 'bug' ? tf[dir] : undefined,
          style,
          frames: ids.map((ref, i) => ({ ref, style: frameStyle(i, n, 0.12) })),
        });
        continue;
      }
      const spec = ANIMS[anim];
      const row = dir === 'left' ? 'right' : dir;
      const n = spec.frames.length;
      cycles.push(n);
      clips.push({
        key,
        transform: dir === 'left' ? 'translate(16 0) scale(-1 1)' : undefined,
        style,
        frames: spec.frames.map((f, i) => {
          const ref = frameId(a.char, row, f);
          refs.add(ref);
          return { ref, style: frameStyle(i, n, spec.dur) };
        }),
      });
    }
    const bubbles = a.bubbles.map((b, j) => {
      const name = `${id}b${j}`;
      css.push(visKeyframes(name, [[b.t0, b.t1]], L));
      return { ...b, style: `animation:${name} ${L}s step-end infinite` };
    });
    return {
      id,
      char: a.char,
      tag: a.tag,
      tagColor: a.tagColor,
      clips,
      bubbles,
      style: `animation:${id}m ${L}s linear infinite`,
    };
  });
  css.push(frameCycleCss(cycles));
  return { css: css.join('\n'), actors: out, refs };
}
