<!-- Variant 1 preview — animated card that links to the playable Svelte game on GitHub Pages. -->
<script>
  import Office from './Office.svelte';
  import { buildActors } from './anim.js';
  import { textPath } from './font.js';

  let { profile } = $props();

  const W = 480;
  const H = 96;
  const L = 8;

  const actors = [
    {
      char: 4,
      start: [24, 38],
      steps: [{ do: 'type', dir: 'up', t: 1.2, say: 'push -f', sayDelay: 0.2 }, { do: 'type', dir: 'up', until: L }],
    },
    { kind: 'bug', start: [40, 74], speed: 40, steps: [{ hide: 0.8 }, { walk: [[300, 74]] }, { hideUntil: L }] },
    {
      char: 0,
      start: [-20, 52],
      speed: 46,
      tag: `@${profile.login}`,
      tagColor: '#ffd36b',
      steps: [{ hide: 1.4 }, { walk: [[286, 52]] }, { do: 'type', dir: 'right', t: 1.2, say: 'gotcha', tone: 'ok' }, { do: 'idle', dir: 'right', until: L }],
    },
    { kind: 'fx', sprite: 'check', start: [298, 68], steps: [{ hide: 7.4 }, { do: 'idle', t: 0.6 }, { hideUntil: L }] },
  ];
  const built = buildActors(actors, L, 'g');

  const title = textPath('PLAY BUG HUNT', { size: 11, weight: 700, x: 410, y: 48, anchor: 'middle' });
  const sub = textPath('Svelte · in your browser', { size: 11, x: 406, y: 64, anchor: 'middle' });
  const css = `${built.css}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
.pulse{animation:pulse 1.2s ease-in-out infinite}`;
</script>

<Office
  {W}
  {H}
  title="Play Bug Hunt — a pixel game made with Svelte"
  floors={[{ x: 0, y: 24, w: W, h: H - 24, tile: 'woodNight' }]}
  walls={[{ x: 0, y: 0, w: W, h: 24 }]}
  back={[
    { id: 'DESK_FRONT', x: 8, y: 26 },
    { frames: ['PC_FRONT_ON_1', 'PC_FRONT_ON_2', 'PC_FRONT_ON_3'], dur: 0.25, x: 24, y: 22 },
    { id: 'PLANT', x: 318, y: 8 },
  ]}
  actors={built.actors}
  refs={built.refs}
  {css}
>
  {#snippet overlay()}
    <rect x="340" y="28" width="132" height="48" rx="3" fill="#238636" stroke="#2ea043" stroke-width="2" />
    <path class="txt" d={title.d} fill="#ffffff" />
    <path class="txt" d={sub.d} fill="#d2f4d8" />
    <path class="pulse" d="M348 42l6 4.5l-6 4.5z" fill="#ffffff" />
  {/snippet}
</Office>
