import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Client build = the game (GitHub Pages). SSR build (--ssr src/svg/render.js) = SVG renderers.
export default defineConfig(({ isSsrBuild }) => ({
  base: process.env.BASE_PATH ?? './',
  plugins: [svelte()],
  build: isSsrBuild
    ? { outDir: 'dist-ssr', emptyOutDir: true, target: 'node20' }
    : { outDir: 'dist', emptyOutDir: true, assetsInlineLimit: 0 },
}));
