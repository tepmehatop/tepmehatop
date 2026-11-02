// Shared helpers for the render/bot scripts.
import fs from 'node:fs';
import path from 'node:path';

export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
export const writeFile = (p, content) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
  fs.writeFileSync(path.join(root, p), content);
};

export async function loadRenderers() {
  const file = path.join(root, 'dist-ssr/render.js');
  if (!fs.existsSync(file)) throw new Error('dist-ssr/render.js missing — run `npm run build:ssr` first');
  return import(file);
}

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

/** Contribution calendar via GraphQL (works with the Actions GITHUB_TOKEN). */
export async function fetchContributions(login, token) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{
    totalContributions weeks{contributionDays{contributionLevel}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json();
  const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) throw new Error(`GraphQL failed: ${JSON.stringify(json).slice(0, 300)}`);
  return {
    total: cal.totalContributions,
    weeks: cal.weeks.map((w) => {
      const days = w.contributionDays.map((d) => LEVELS[d.contributionLevel] ?? 0);
      while (days.length < 7) days.push(0);
      return days;
    }),
  };
}

/** Deterministic fake calendar for local previews. */
export function mockContributions(seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let total = 0;
  const weeks = Array.from({ length: 53 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const busy = Math.sin(w / 6) + (d > 0 && d < 6 ? 0.6 : -0.4) + rnd() * 1.4;
      const level = busy < 0.5 ? 0 : busy < 1.0 ? 1 : busy < 1.5 ? 2 : busy < 1.9 ? 3 : 4;
      total += [0, 1, 3, 6, 11][level];
      return level;
    }),
  );
  return { total, weeks };
}
