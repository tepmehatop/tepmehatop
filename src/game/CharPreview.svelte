<!-- Animated character from a sprite sheet using only CSS (walk cycle, facing down). -->
<script>
  let { url, scale = 3, selected = false, onclick } = $props();
</script>

<button class="pick" class:selected {onclick} aria-pressed={selected} type="button">
  <span
    class="sprite"
    style="--url: url({url}); --s: {scale}; animation-play-state: {selected ? 'running' : 'paused'}"
  ></span>
</button>

<style>
  .pick {
    flex: 0 0 auto;
    padding: 4px 2px 1px;
    border: 2px solid transparent;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    cursor: pointer;
    line-height: 0;
  }
  .pick:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  .selected {
    border-color: #ffd36b;
    background: rgba(255, 211, 107, 0.12);
  }
  .sprite {
    display: inline-block;
    width: calc(16px * var(--s));
    height: calc(32px * var(--s));
    background-image: var(--url);
    background-size: calc(112px * var(--s)) calc(96px * var(--s));
    background-position: calc(-16px * var(--s)) 0;
    image-rendering: pixelated;
    animation: walk 0.6s step-end infinite;
  }
  @keyframes walk {
    0% {
      background-position: 0 0;
    }
    25% {
      background-position: calc(-16px * var(--s)) 0;
    }
    50% {
      background-position: calc(-32px * var(--s)) 0;
    }
    75% {
      background-position: calc(-16px * var(--s)) 0;
    }
  }
</style>
