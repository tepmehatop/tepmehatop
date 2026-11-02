<!--
  Generic pixel-office renderer → one standalone, self-animating SVG.
  Rendered on the server (svelte/server) by scripts/render-*.mjs; no JS runs in the README.
-->
<script>
  import { sprite, floorTile } from './sprites.js';
  import { textPath } from './font.js';
  import { frameStyle, frameCycleCss } from './anim.js';

  let {
    W,
    H,
    scale = 2,
    title = 'Pixel office',
    frame = null,
    floors = [],
    walls = [],
    wallColor = '#2b3650',
    wallTop = '#1c2438',
    back = [],
    front = [],
    actors = [],
    refs = new Set(),
    css = '',
    texts = [],
    children,
    overlay,
  } = $props();

  const furnitureIds = (items) =>
    items.flatMap((it) => (it.frames ? it.frames : [it.id]));

  const allIds = $derived([...new Set([...refs, ...furnitureIds(back), ...furnitureIds(front), 'bug_0', 'bug_1', 'check'])]);
  const defs = $derived(allIds.map((id) => ({ id, ...sprite(id) })).filter((d) => d.layers));
  const floorNames = $derived([...new Set(floors.map((f) => f.tile))]);
  const animatedItems = $derived([...back, ...front].filter((it) => it.frames));
  const allCss = $derived(
    [
      'svg{shape-rendering:crispEdges}',
      '.txt{shape-rendering:geometricPrecision}',
      frameCycleCss(animatedItems.map((it) => it.frames.length)),
      css,
    ].join('\n'),
  );

  const T = (t) => ({ ...t, ...textPath(t.text, t) });
  const textItems = $derived(texts.map(T));

  const bubbleTone = {
    ok: { fill: '#dafbe1', stroke: '#1a7f37', ink: '#0f5323' },
    bug: { fill: '#ffebe9', stroke: '#cf222e', ink: '#82071e' },
    info: { fill: '#ffffff', stroke: '#1b1b28', ink: '#1b1b28' },
  };
  function bubble(b) {
    const t = textPath(b.text, { size: 11, x: 0, y: 0 });
    const w = Math.ceil(t.width) + 6;
    const x = Math.round(8 - w / 2);
    const tone = bubbleTone[b.tone ?? 'info'];
    return { ...b, w, x, tone, d: textPath(b.text, { size: 11, x: x + 3, y: -9 }).d };
  }
  function tag(a) {
    const t = textPath(a.tag, { size: 11, x: 8, y: -3, anchor: 'middle' });
    const w = Math.ceil(t.width) + 4;
    return { d: t.d, w, x: Math.round(8 - w / 2) };
  }
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 {W} {H}"
  width={W * scale}
  height={H * scale}
  role="img"
  aria-label={title}
>
  <title>{title}</title>
  {@html `<style>${allCss}</style>`}
  <defs>
    {#each floorNames as name}
      {@const tile = floorTile(name)}
      <pattern id="fl_{name}" width={tile.w} height={tile.h} patternUnits="userSpaceOnUse">
        {#each tile.layers as [fill, d]}<path {fill} {d} />{/each}
      </pattern>
    {/each}
    {#each defs as s}
      <g id={s.id}>{#each s.layers as [fill, d]}<path {fill} {d} />{/each}</g>
    {/each}
  </defs>

  {#if frame}
    <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={frame.rx ?? 0} fill={frame.fill} stroke={frame.stroke ?? 'none'} />
  {/if}

  {#each floors as f}
    <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="url(#fl_{f.tile})" />
    {#if f.tint}<rect x={f.x} y={f.y} width={f.w} height={f.h} fill={f.tint} />{/if}
  {/each}

  {#each walls as w}
    <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={wallColor} />
    <rect x={w.x} y={w.y} width={w.w} height="3" fill={wallTop} />
    <rect x={w.x} y={w.y + w.h - 3} width={w.w} height="3" fill={wallTop} />
  {/each}

  {#snippet item(it)}
    <g transform="translate({it.x} {it.y}){it.flip ? ` translate(${sprite(it.frames?.[0] ?? it.id).w} 0) scale(-1 1)` : ''}">
      {#if it.frames}
        {#each it.frames as id, i}<use href="#{id}" style={frameStyle(i, it.frames.length, it.dur ?? 0.3)} />{/each}
      {:else}
        <use href="#{it.id}" />
      {/if}
    </g>
  {/snippet}

  {@render children?.()}

  {#each back as it}{@render item(it)}{/each}

  {#each textItems as t}
    <path class="txt" d={t.d} fill={t.fill ?? '#fff'} opacity={t.opacity ?? 1} style={t.style} />
  {/each}

  {#each actors as a (a.id)}
    <g style={a.style}>
      {#each a.clips as c (c.key)}
        <g style={c.style} opacity="0">
          <g transform={c.transform}>
            {#each c.frames as f}<use href="#{f.ref}" style={f.style} />{/each}
          </g>
        </g>
      {/each}
      {#if a.tag}
        {@const t = tag(a)}
        <rect x={t.x} y="-12" width={t.w} height="12" rx="2" fill="#0d1117" opacity="0.72" />
        <path class="txt" d={t.d} fill={a.tagColor ?? '#e6edf3'} />
      {/if}
      {#each a.bubbles.map(bubble) as b}
        <g style={b.style} opacity="0" transform={a.tag ? 'translate(0 -13)' : undefined}>
          <rect x={b.x} y="-20" width={b.w} height="14" fill={b.tone.fill} stroke={b.tone.stroke} />
          <path d="M6 -6.5h5l-3 4z" fill={b.tone.fill} stroke={b.tone.stroke} />
          <rect x="6.6" y="-7.5" width="3.8" height="1.5" fill={b.tone.fill} />
          <path class="txt" d={b.d} fill={b.tone.ink} />
        </g>
      {/each}
    </g>
  {/each}

  {#each front as it}{@render item(it)}{/each}

  {@render overlay?.()}
</svg>
