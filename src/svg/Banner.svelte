<!--
  Variant 2 — the living banner: a pixel QA office where people type, drink coffee
  and a QA engineer chases a bug, with your real contribution graph on the wall screen.
-->
<script>
  import Office from './Office.svelte';
  import { buildActors } from './anim.js';
  import { CONTRIB } from './sprites.js';

  let { theme = 'dark', contrib, profile } = $props();

  const W = 480;
  const H = 184;
  const L = 30; // loop length, seconds

  const dark = theme === 'dark';
  const palette = {
    wall: dark ? '#26304a' : '#b9c6dc',
    wallTop: dark ? '#171e30' : '#8d9bb5',
    sign: dark ? '#ffd36b' : '#5b3a00',
    sub: dark ? '#a8b3cf' : '#2c3a55',
    screen: dark ? '#0b0f17' : '#f6f8fa',
    bezel: dark ? '#46557a' : '#59667f',
    ink: dark ? '#7ee787' : '#1a7f37',
    cells: CONTRIB[theme],
  };

  // ---- Room ------------------------------------------------------------------
  const floors = [
    { x: 0, y: 64, w: 312, h: H - 64, tile: dark ? 'woodNight' : 'wood' },
    { x: 312, y: 64, w: W - 312, h: H - 64, tile: dark ? 'carpetNight' : 'carpet' },
  ];
  const walls = [{ x: 0, y: 0, w: W, h: 64 }];

  const PC = ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'];
  const back = [
    { id: 'HANGING_PLANT', x: 2, y: 0 },
    { id: 'CLOCK', x: 174, y: 2 },
    // desks
    { id: 'DESK_FRONT', x: 16, y: 72 },
    { frames: PC, dur: 0.25, x: 32, y: 68 },
    { id: 'DESK_FRONT', x: 104, y: 72 },
    { frames: PC, dur: 0.3, x: 120, y: 68 },
    { id: 'BIN', x: 74, y: 96 },
    { id: 'PLANT', x: 292, y: 50 },
    { id: 'CACTUS', x: 4, y: 144 },
    // lounge
    { id: 'COFFEE_TABLE', x: 372, y: 84 },
    { id: 'COFFEE', x: 372, y: 92 },
    { id: 'COFFEE', x: 384, y: 98 },
    { id: 'SOFA_FRONT', x: 372, y: 152 },
  ];
  const front = [
    { id: 'CUSHIONED_CHAIR_BACK', x: 32, y: 100 },
    { id: 'CUSHIONED_CHAIR_BACK', x: 120, y: 100 },
    { id: 'SMALL_TABLE_FRONT', x: 216, y: 116 },
    { id: 'COFFEE', x: 232, y: 125 },
    { id: 'LARGE_PLANT', x: 444, y: 132 },
  ];

  // ---- People (sprite top-left) ----------------------------------------------
  const QA = [224, 107];
  const DEV2 = [120, 86];
  const actors = [
    // dev 1 — types, pushes, gets a thank-you
    {
      char: 4,
      start: [32, 86],
      steps: [
        { do: 'type', dir: 'up', t: 3.5 },
        { do: 'type', dir: 'up', t: 2.4, say: 'git push' },
        { do: 'type', dir: 'up', until: 15 },
        { do: 'type', dir: 'up', t: 2.2, say: 'thx QA!', tone: 'ok' },
        { do: 'type', dir: 'up', until: L },
      ],
    },
    // dev 2 — coffee run
    {
      char: 2,
      start: DEV2,
      speed: 34,
      steps: [
        { do: 'type', dir: 'up', t: 1 },
        { walk: [[120, 146], [346, 146], [346, 70]] },
        { do: 'idle', dir: 'right', until: 16.5, say: 'coffee?', sayDelay: 0.5, sayFor: 2 },
        { walk: [[346, 146], [120, 146], DEV2] },
        { do: 'type', dir: 'up', until: L },
      ],
    },
    // colleague at the coffee table
    {
      char: 6,
      start: [406, 70],
      steps: [
        { do: 'read', dir: 'left', until: 14.4 },
        { do: 'idle', dir: 'left', t: 2.2, say: 'standup!' },
        { do: 'read', dir: 'left', until: L },
      ],
    },
    // reviewer on the sofa
    {
      char: 3,
      start: [380, 134],
      steps: [
        { do: 'read', dir: 'down', until: 21 },
        { do: 'read', dir: 'down', t: 2.4, say: 'LGTM' },
        { do: 'read', dir: 'down', until: L },
      ],
    },
    // the QA engineer — you
    {
      char: 0,
      start: QA,
      tag: `@${profile.login}`,
      tagColor: '#ffd36b',
      speed: 30,
      steps: [
        { do: 'read', dir: 'down', t: 6.4 },
        { do: 'idle', dir: 'down', t: 1.4, say: 'BUG!', tone: 'bug' },
        { walk: [[198, 107], [198, 128]] },
        { do: 'idle', dir: 'left', until: 12.9 },
        { do: 'type', dir: 'down', t: 1.8, say: 'caught!', tone: 'ok' },
        { walk: [[198, 107], QA] },
        { do: 'read', dir: 'down', until: L },
      ],
    },
    // the bug
    {
      kind: 'bug',
      start: [36, 116],
      speed: 28,
      steps: [{ hide: 6 }, { walk: [[36, 156], [190, 156]] }, { hideUntil: L }],
    },
    // "caught" check mark
    {
      kind: 'fx',
      sprite: 'check',
      start: [191, 147],
      steps: [{ hide: 13 }, { do: 'idle', t: 1.8 }, { hideUntil: L }],
    },
  ];

  const built = buildActors(actors, L, 'b');

  // ---- Contribution screen -----------------------------------------------------
  const SX = W - 238;
  const SY = 5;
  const weeks = contrib.weeks.slice(-53);
  const gx = SX + 10;
  const gy = SY + 17;
  const sw = W - SX - 6;
  const cells = weeks.flatMap((week, wi) =>
    week.map((level, di) => ({ x: gx + wi * 4, y: gy + di * 4, level })),
  );
  const fmt = (n) => n.toLocaleString('en-US');

  const css = [
    built.css,
    `@keyframes scan{0%{transform:translateX(0)}100%{transform:translateX(${weeks.length * 4}px)}}`,
    '.scan{animation:scan 6s linear infinite}',
    '@keyframes glow{0%,100%{opacity:1}50%{opacity:.55}}',
    '.hot{animation:glow 2.4s ease-in-out infinite}',
    '@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}',
    '.cursor{animation:blink 1s step-end infinite}',
  ].join('\n');

  const texts = [
    { text: profile.login, size: 22, weight: 700, x: 22, y: 31, fill: palette.sign },
    { text: profile.subtitle, size: 11, x: 23, y: 47, fill: palette.sub },
    {
      text: `${fmt(contrib.total)} contributions in the last year`,
      size: 11,
      x: gx,
      y: SY + 12,
      fill: palette.ink,
    },
  ];
</script>

<Office
  {W}
  {H}
  title="{profile.login} — pixel QA office"
  {floors}
  {walls}
  wallColor={palette.wall}
  wallTop={palette.wallTop}
  {back}
  {front}
  actors={built.actors}
  refs={built.refs}
  {css}
  {texts}
>
  <!-- wall screen with the contribution graph -->
  <rect x={SX - 1} y={SY - 1} width={sw + 2} height="52" fill={palette.bezel} />
  <rect x={SX} y={SY} width={sw} height="50" fill={palette.screen} />
  {#each cells as c}
    <rect x={c.x} y={c.y} width="3" height="3" fill={palette.cells[c.level]} class={c.level === 4 ? 'hot' : undefined} />
  {/each}
  <g clip-path="url(#screenClip)">
    <rect class="scan" x={gx - 8} y={gy - 1} width="6" height="29" fill={dark ? '#ffffff' : '#0969da'} opacity="0.13" />
  </g>
  <clipPath id="screenClip"><rect x={gx} y={gy - 1} width={weeks.length * 4} height="29" /></clipPath>
  <rect class="cursor" x={W - 16} y={SY + 6} width="4" height="7" fill={palette.ink} />
</Office>
