<script>
  import { onMount } from 'svelte';
  import { loadAssets, charSheetUrls } from './assets.js';
  import { createGame, update, comboMult } from './engine.js';
  import { draw } from './draw.js';
  import { W, H } from './map.js';
  import { play } from './sound.js';
  import { STRINGS } from './i18n.js';
  import CharPreview from './CharPreview.svelte';

  const PROFILE = 'https://github.com/tepmehatop';
  const store = {
    get: (k, d) => {
      try {
        const v = localStorage.getItem(`bughunt:${k}`);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(`bughunt:${k}`, JSON.stringify(v));
      } catch {
        /* storage unavailable */
      }
    },
  };

  let screen = $state('loading'); // loading | menu | play | over
  let lang = $state(store.get('lang', navigator.language?.startsWith('ru') ? 'ru' : 'en'));
  let muted = $state(store.get('muted', false));
  let charIdx = $state(store.get('char', 0));
  let paused = $state(false);
  let best = $state(store.get('best', 0));
  let hud = $state({ score: 0, lives: 3, time: 0, sprint: 1, mult: 1 });
  let result = $state(null);
  let stageW = $state(480);

  const t = $derived(STRINGS[lang]);

  let canvas;
  let stage;
  let ctx;
  let assets;
  let game;
  let S = 2;
  const input = { up: false, down: false, left: false, right: false, target: null };
  // ?demo — autopilot chases the nearest bug (handy for recordings)
  const demo = new URLSearchParams(location.search).has('demo');
  function autopilot() {
    const p = game.player;
    let best = Infinity;
    input.target = null;
    for (const b of game.bugs) {
      const d = Math.hypot(b.x - p.x - 8, b.y - p.y - 27);
      if (d < best) {
        best = d;
        input.target = { x: b.x, y: b.y };
      }
    }
  }

  function newGame(isDemo) {
    game = createGame({ playerChar: charIdx, demo: isDemo });
    if (isDemo) game.nextSpawn = Infinity;
    hud = { score: 0, lives: 3, time: 0, sprint: 1, mult: 1 };
  }

  function start() {
    store.set('char', charIdx);
    newGame(false);
    paused = false;
    result = null;
    screen = 'play';
  }

  function finish() {
    const isBest = game.score > best;
    if (isBest) {
      best = game.score;
      store.set('best', best);
    }
    result = {
      score: game.score,
      caught: game.caught,
      escaped: game.escaped,
      time: Math.floor(game.time),
      sprint: game.sprint,
      bestCombo: game.bestCombo,
      isBest,
    };
    screen = 'over';
  }

  // Stage width comes from CSS (fits the viewport); the canvas renders at an integer scale of it.
  let maxW = $state(W * 2);
  function resize() {
    const fit = Math.min(W * 3, document.documentElement.clientWidth - 20, ((window.innerHeight - 110) * W) / H);
    // whole-number zoom keeps pixels crisp on big screens; small screens just fit
    maxW = Math.max(280, fit >= W * 2 ? Math.floor(fit / W) * W : fit);
  }
  function fitCanvas(width) {
    stageW = width;
    S = Math.max(1, Math.round((width * (window.devicePixelRatio || 1)) / W));
    if (canvas && canvas.width !== W * S) {
      canvas.width = W * S;
      canvas.height = H * S;
    }
  }

  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  function onKey(e, down) {
    if (KEYS[e.code]) {
      input[KEYS[e.code]] = down;
      e.preventDefault();
    }
    if (!down) return;
    if (e.code === 'KeyP' && screen === 'play') paused = !paused;
    if ((e.code === 'Enter' || e.code === 'Space') && screen !== 'play') {
      e.preventDefault();
      start();
    }
  }

  function pointer(e) {
    if (screen !== 'play') return;
    if (paused) {
      paused = false;
      return;
    }
    if (e.type === 'pointerdown') canvas.setPointerCapture(e.pointerId);
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      input.target = null;
      return;
    }
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const r = canvas.getBoundingClientRect();
    input.target = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  onMount(() => {
    let raf;
    let last = performance.now();
    ctx = canvas.getContext('2d');
    resize();
    const ro = new ResizeObserver(([entry]) => fitCanvas(entry.contentRect.width));
    ro.observe(stage);
    Promise.all([loadAssets(), document.fonts?.load('8px "Pixelify Sans"')]).then(([a]) => {
      assets = a;
      newGame(true);
      screen = 'menu';
    });

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (game && assets) {
        if (screen === 'menu' || screen === 'over') update(game, dt, {});
        else if (screen === 'play' && !paused) {
          if (demo) autopilot();
          update(game, dt, input);
          for (const ev of game.events) play(ev, muted);
          game.events.length = 0;
          const next = { score: game.score, lives: game.lives, time: Math.floor(game.time), sprint: game.sprint, mult: comboMult(game.combo) };
          if (Object.keys(next).some((k) => next[k] !== hud[k])) hud = next;
          if (game.over) finish();
        }
        draw(ctx, game, assets, S, { you: t.you, sprint: t.sprint, shipped: t.shipped, restored: t.restored });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const vis = () => document.hidden && screen === 'play' && (paused = true);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', vis);
    };
  });

  $effect(() => store.set('lang', lang));
  $effect(() => store.set('muted', muted));
</script>

<svelte:window onresize={resize} onkeydown={(e) => onKey(e, true)} onkeyup={(e) => onKey(e, false)} />

<main style="--sw: min(calc(100vw - 20px), {maxW}px)">
  <header>
    <div class="stats">
      <span>{t.score} <b>{hud.score}</b></span>
      <span>{t.best} <b>{best}</b></span>
      <span>{t.sprint} <b>{hud.sprint}</b></span>
      <span>{t.lives} <b class="hearts">{'♥'.repeat(Math.max(0, hud.lives))}<i>{'♥'.repeat(3 - Math.max(0, hud.lives))}</i></b></span>
    </div>
    <div class="tools">
      <button type="button" onclick={() => (lang = lang === 'ru' ? 'en' : 'ru')}>{lang === 'ru' ? 'EN' : 'RU'}</button>
      <button type="button" onclick={() => (muted = !muted)} aria-label="sound">{muted ? '🔇' : '🔊'}</button>
      {#if screen === 'play'}<button type="button" onclick={() => (paused = !paused)}>{paused ? '▶' : '❚❚'}</button>{/if}
    </div>
  </header>

  <div class="stage" bind:this={stage}>
    <canvas
      bind:this={canvas}
      onpointerdown={pointer}
      onpointermove={pointer}
      onpointerup={pointer}
      onpointercancel={pointer}
    ></canvas>

    {#if screen === 'loading'}
      <div class="overlay"><p>Loading…</p></div>
    {:else if screen === 'menu'}
      <div class="overlay">
        <h1>{t.title}</h1>
        <p class="tag">{t.tagline}</p>
        <p class="label">{t.choose}</p>
        <div class="picker">
          {#each charSheetUrls as url, i}
            <CharPreview {url} scale={stageW < 420 ? 1.25 : stageW < 640 ? 1.75 : 2.25} selected={i === charIdx} onclick={() => (charIdx = i)} />
          {/each}
        </div>
        <button class="primary" type="button" onclick={start}>▶ {t.start}</button>
        <p class="hint">{t.controls}</p>
        <p class="hint">{t.rules}</p>
      </div>
    {:else if screen === 'over' && result}
      <div class="overlay">
        <h1 class="red">{t.over}</h1>
        <p class="big">{result.score}</p>
        <p>{t.stats(result)}</p>
        <p class="muted">{t.stats2(result)}</p>
        {#if result.isBest}<p class="gold">★ {t.newBest}</p>{/if}
        <div class="row">
          <button class="primary" type="button" onclick={start}>↻ {t.again}</button>
          <button type="button" onclick={() => { newGame(true); screen = 'menu'; }}>{t.menu}</button>
        </div>
        <a href={PROFILE}>{t.profile} →</a>
      </div>
    {:else if paused}
      <div class="overlay dim"><p>{t.paused}</p></div>
    {/if}
  </div>

  <footer>
    <a href={PROFILE}>@tepmehatop</a> · Svelte {'·'} <span>{t.credits}</span>
  </footer>
</main>

<style>
  :global(html, body) {
    margin: 0;
    min-height: 100%;
    background: #0d1117;
    color: #e6edf3;
    font-family: 'Pixelify Sans', ui-monospace, monospace;
    overscroll-behavior: none;
  }
  main {
    box-sizing: border-box;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 8px 16px;
    gap: 8px;
    touch-action: none;
  }
  header,
  footer {
    width: var(--sw);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 15px;
  }
  .stats {
    display: flex;
    gap: 4px 12px;
    min-width: 0;
    flex-wrap: wrap;
  }
  .stats b {
    color: #ffd36b;
  }
  .hearts {
    color: #ff7b72 !important;
    letter-spacing: 2px;
  }
  .hearts i {
    color: #30363d;
    font-style: normal;
  }
  .tools {
    display: flex;
    gap: 6px;
  }
  .stage {
    position: relative;
    width: var(--sw);
    aspect-ratio: 480 / 288;
    border: 2px solid #30363d;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    cursor: crosshair;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px;
    text-align: center;
    background: rgba(13, 17, 23, 0.72);
    backdrop-filter: blur(1px);
  }
  .overlay.dim {
    background: rgba(13, 17, 23, 0.55);
  }
  h1 {
    margin: 0;
    font-size: clamp(28px, 6vw, 52px);
    color: #ffd36b;
    letter-spacing: 2px;
    text-shadow: 3px 3px 0 #1b1b28;
  }
  h1.red {
    color: #ff7b72;
  }
  p {
    margin: 2px 0;
  }
  .tag {
    color: #a8b3cf;
  }
  .label {
    margin-top: 6px;
    color: #8b949e;
    font-size: 13px;
  }
  .picker {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: auto;
    justify-content: center;
    gap: 4px;
    max-width: 100%;
  }
  .hint {
    color: #8b949e;
    font-size: 12px;
  }
  @media (max-width: 520px) {
    header {
      font-size: 13px;
    }
    .overlay {
      gap: 2px;
      padding: 6px;
    }
    .tag,
    .hint {
      font-size: 11px;
    }
    button.primary {
      font-size: 15px;
      padding: 4px 14px;
    }
  }
  .big {
    font-size: 44px;
    color: #ffd36b;
  }
  .gold {
    color: #ffd36b;
  }
  .muted {
    color: #8b949e;
    font-size: 13px;
  }
  .row {
    display: flex;
    gap: 8px;
    margin: 6px 0;
  }
  button {
    font: inherit;
    color: #e6edf3;
    background: #21262d;
    border: 2px solid #30363d;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
  }
  button:hover {
    border-color: #8b949e;
  }
  button.primary {
    background: #238636;
    border-color: #2ea043;
    font-size: 18px;
    padding: 6px 18px;
    margin-top: 6px;
  }
  a {
    color: #58a6ff;
  }
  footer {
    font-size: 12px;
    color: #8b949e;
    justify-content: center;
  }
</style>
