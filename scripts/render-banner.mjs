// Renders the living banner (dark + light) and the game card into profile/.
// Usage: node scripts/render-banner.mjs [--mock]
import { readJson, writeFile, loadRenderers, fetchContributions, mockContributions } from './lib.mjs';

const profile = readJson('profile.config.json');
const token = process.env.GITHUB_TOKEN;
const mock = process.argv.includes('--mock') || !token;

let contrib;
try {
  contrib = mock ? mockContributions() : await fetchContributions(profile.login, token);
} catch (err) {
  console.warn(`Falling back to mock data: ${err.message}`);
  contrib = mockContributions();
}

const { renderBanner, renderGameCard } = await loadRenderers();
for (const theme of ['dark', 'light']) {
  const svg = renderBanner({ theme, contrib, profile });
  writeFile(`profile/banner-${theme}.svg`, svg);
  console.log(`profile/banner-${theme}.svg  ${(svg.length / 1024).toFixed(0)} KB  (${contrib.total} contributions${mock ? ', mock' : ''})`);
}
const card = renderGameCard({ profile });
writeFile('profile/game-card.svg', card);
console.log(`profile/game-card.svg  ${(card.length / 1024).toFixed(0)} KB`);
