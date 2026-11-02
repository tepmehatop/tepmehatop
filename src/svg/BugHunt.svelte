<!--
  Variant 3 — Bug Hunt board. Re-rendered by a GitHub Action after every issue "move".
  The latest player's character walks to the desk they picked; previous players hang out below.
-->
<script>
  import Office from './Office.svelte';
  import { buildActors } from './anim.js';
  import { textPath } from './font.js';

  let { state, profile } = $props();

  const W = 480;
  const H = 232;
  const L = 16;
  const DESKS = 'ABCDEFGH'.split('');

  const desk = (id) => {
    const i = DESKS.indexOf(id);
    return { id, col: i % 4, row: Math.floor(i / 4), x: 24 + (i % 4) * 112, y: i < 4 ? 56 : 120 };
  };
  const desks = DESKS.map(desk);
  const HINT = {
    hot: { fill: '#ff7b72', ink: '#3d0a07', label: 'hot' },
    warm: { fill: '#f2cc60', ink: '#3b2300', label: 'warm' },
    cold: { fill: '#79c0ff', ink: '#05264c', label: 'cold' },
  };

  const PC = ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'];
  const back = desks.flatMap((d) => [
    { id: 'DESK_FRONT', x: d.x, y: d.y },
    state.checked[d.id] ? { id: 'PC_FRONT_OFF', x: d.x + 16, y: d.y - 4 } : { frames: PC, dur: 0.25 + d.col * 0.03, x: d.x + 16, y: d.y - 4 },
  ]);
  back.push({ id: 'HANGING_PLANT', x: W - 18, y: 0 }, { id: 'PLANT', x: 4, y: 40 }, { id: 'CLOCK', x: 300, y: 2 });

  // ---- Characters ------------------------------------------------------------
  const last = state.moves[0];
  const actors = [];
  if (last) {
    const d = desk(last.desk);
    const seat = [d.x + 16, d.y + 14];
    const aisle = d.x - 22;
    const found = last.result === 'found';
    actors.push({
      char: last.char,
      start: [-18, 164],
      speed: 46,
      tag: `@${last.login}`,
      tagColor: '#ffd36b',
      steps: [
        { walk: [[aisle, 164], [aisle, seat[1]], seat] },
        { do: 'type', dir: 'up', t: 2.2, say: 'checking…', sayFor: 2.2 },
        found
          ? { do: 'idle', dir: 'down', t: 3, say: 'BUG FOUND!', tone: 'ok' }
          : { do: 'read', dir: 'up', t: 3, say: last.result === 'already' ? 'already clean' : `clean · ${last.hint}`, tone: 'info' },
        { do: found ? 'idle' : 'type', dir: found ? 'down' : 'up', until: L },
      ],
    });
    if (found) {
      actors.push({ kind: 'bug', start: [d.x + 30, d.y + 26], steps: [{ hide: 7 }, { do: 'idle', dir: 'right', until: L }] });
    }
  }
  // the office owner studies the WANTED poster
  actors.push({
    char: 0,
    start: [W - 120, 21],
    steps: [
      { do: 'idle', dir: 'right', t: 9 },
      { do: 'idle', dir: 'down', t: 4, say: 'who did it?' },
      { do: 'idle', dir: 'right', until: L },
    ],
  });
  // previous visitors hang out in the corridor
  const guests = state.guests.filter((g) => g.login !== last?.login).slice(0, 6);
  guests.forEach((g, i) => {
    const x = 36 + i * 74;
    const anim = i % 3 === 0 ? 'read' : i % 3 === 1 ? 'idle' : 'type';
    actors.push({
      char: g.char,
      start: [x, i % 2 ? 198 : 186],
      tag: `@${g.login.length > 13 ? g.login.slice(0, 12) + '…' : g.login}`,
      steps: [{ do: anim, dir: i % 2 ? 'up' : 'down', until: L }],
    });
  });

  const built = buildActors(actors, L, 'h');

  // ---- Labels ----------------------------------------------------------------
  const checkedCount = Object.keys(state.checked).length;
  const texts = [
    { text: 'BUG HUNT', size: 22, weight: 700, x: 14, y: 26, fill: '#ffd36b' },
    {
      text: `round ${state.round} · ${checkedCount}/8 desks checked · ${state.totalMoves} moves`,
      size: 11,
      x: 15,
      y: 41,
      fill: '#a8b3cf',
    },
  ];
  const chips = desks.map((d) => {
    const h = state.checked[d.id];
    const label = h ? `${d.id} · ${HINT[h].label}` : d.id;
    const t = textPath(label, { size: 11, weight: 700, x: d.x + 24, y: d.y + 41, anchor: 'middle' });
    const w = Math.ceil(t.width) + 8;
    return { ...t, w, x: d.x + 24 - w / 2, y: d.y + 32, fill: h ? HINT[h].fill : '#e6edf3', ink: h ? HINT[h].ink : '#0d1117' };
  });
  const wanted = textPath('WANTED', { size: 11, weight: 700, x: W - 70, y: 16, anchor: 'middle' });
</script>

<Office
  {W}
  {H}
  title="Bug Hunt — round {state.round}"
  floors={[{ x: 0, y: 48, w: W, h: H - 48, tile: 'woodNight' }]}
  walls={[{ x: 0, y: 0, w: W, h: 48 }]}
  {back}
  actors={built.actors}
  refs={built.refs}
  css={built.css}
  {texts}
>
  <!-- wanted poster -->
  <rect x={W - 96} y="4" width="52" height="40" fill="#f3e6c4" stroke="#8a6d3b" />
  <path class="txt" d={wanted.d} fill="#5b3a00" />
  <g transform="translate({W - 79} 21) scale(2)"><use href="#bug_0" /></g>
  {#each chips as c}
    <rect x={c.x} y={c.y} width={c.w} height="12" rx="2" fill={c.fill} />
    <path class="txt" d={c.d} fill={c.ink} />
  {/each}
</Office>
