# How this profile works

Three experiments live in this repository. All of them are drawn by Svelte components.

| | What | Where it runs | Source |
|---|---|---|---|
| 1 | **Bug Hunt game** — playable pixel game | GitHub Pages (`.github/workflows/pages.yml`) | `src/game/` |
| 2 | **Living banner** — animated office + real contribution graph | SVG redrawn daily by an Action (`banner.yml`) | `src/svg/Banner.svelte` |
| 3 | **Office Bug Hunt** — visitors play through issues | Action on every new issue (`bughunt.yml`) | `src/svg/BugHunt.svelte`, `scripts/bughunt.mjs` |

## Why SVG + CSS animations

GitHub strips JavaScript, iframes and `<style>` from READMEs, but an SVG shown as an image keeps
its own CSS animations. So the Svelte components are rendered **on the server** (`svelte/server`)
into a standalone SVG: every sprite frame is baked into vector paths, and walking, typing and
speech bubbles are CSS keyframes generated from small scripts (`src/svg/anim.js`).

## Local commands

```bash
npm ci
npm run assets        # PNG sprites → vector paths + colorized floor tiles
npm run build:ssr     # compile the SVG renderers
npm run banner -- --mock          # render profile/*.svg with fake contribution data
node scripts/bughunt.mjs          # re-render the Bug Hunt board + README section
ISSUE_TITLE='bughunt|check|C' ISSUE_AUTHOR=octocat node scripts/bughunt.mjs   # simulate a move
npm run dev           # play the game locally (http://localhost:5173, add ?demo for autopilot)
```

## Settings

- `profile.config.json` — login, subtitle, game URL.
- Repository secret `BUG_SALT` — any random string. It keeps the bug's desk secret
  (only a salted hash is stored in `bughunt/state.json`).
- Pages: *Settings → Pages → Source: GitHub Actions*.
