// Bug Hunt bot — called by .github/workflows/bughunt.yml for every issue titled "bughunt|check|<A-H>".
//
// The workflow passes ALL open bughunt issues (--issues file.json), so no move is lost
// even when several people play at once. BUG_SALT (repository secret) keeps the bug's desk private.
//
// Usage: node scripts/bughunt.mjs --issues issues.json --replies replies-dir/
//        ISSUE_TITLE='bughunt|check|C' ISSUE_AUTHOR=octocat node scripts/bughunt.mjs   (local test)
//        node scripts/bughunt.mjs            (just re-render board + README)
//        node scripts/bughunt.mjs --reset    (fresh game)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { root, readJson, writeFile, loadRenderers } from './lib.mjs';

const DESKS = 'ABCDEFGH'.split('');
const STATE = 'bughunt/state.json';
const salt = process.env.BUG_SALT || 'public-fallback-salt';
if (!process.env.BUG_SALT) console.warn('BUG_SALT is not set — the bug location can be brute-forced from state.json.');

const hash = (round, d) => crypto.createHash('sha256').update(`${salt}:${round}:${d}`).digest('hex');
const where = (state) => DESKS.find((d) => hash(state.round, d) === state.bugHash);
const pos = (d) => [DESKS.indexOf(d) % 4, Math.floor(DESKS.indexOf(d) / 4)];
const dist = (a, b) => Math.abs(pos(a)[0] - pos(b)[0]) + Math.abs(pos(a)[1] - pos(b)[1]);
const hintFor = (a, b) => (dist(a, b) <= 1 ? 'hot' : dist(a, b) === 2 ? 'warm' : 'cold');
const charFor = (login) => crypto.createHash('md5').update(login.toLowerCase()).digest()[0] % 10;

function newRound(state, avoid) {
  const options = DESKS.filter((d) => d !== avoid);
  const desk = options[crypto.randomInt(options.length)];
  state.bugHash = hash(state.round, desk);
  state.checked = {};
}

function freshState() {
  const state = { round: 1, bugHash: '', checked: {}, moves: [], guests: [], scores: {}, totalMoves: 0, lastFound: null };
  newRound(state);
  return state;
}

/** Apply one move. Returns a markdown reply for the issue. */
export function play(state, login, deskRaw) {
  const desk = String(deskRaw || '').trim().toUpperCase();
  if (!DESKS.includes(desk)) return { ok: false, reply: `🤔 Unknown desk \`${deskRaw}\`. Pick one of ${DESKS.join(', ')}.` };
  const bug = where(state);
  if (!bug) newRound(state); // salt changed or state corrupted — start over quietly
  const char = charFor(login);
  const move = { login, desk, char, round: state.round, at: new Date().toISOString() };
  let reply;

  if (state.checked[desk]) {
    move.result = 'already';
    move.hint = state.checked[desk];
    reply = `🔁 Desk **${desk}** was already checked this round (*${move.hint}*). Try another one!`;
  } else if (desk === where(state)) {
    move.result = 'found';
    state.scores[login] = (state.scores[login] ?? 0) + 1;
    state.lastFound = { login, desk, round: state.round };
    reply = `🎉 **BUG FOUND** at desk **${desk}**! +1 for @${login} (total: ${state.scores[login]}). A new bug is already hiding — round ${state.round + 1} starts now.`;
    state.round += 1;
    newRound(state, desk);
  } else {
    move.result = 'clean';
    move.hint = hintFor(desk, where(state));
    state.checked[desk] = move.hint;
    const tip = { hot: '🔥 the bug is right next door', warm: '🌤️ getting warmer', cold: '🧊 cold — the bug is far away' }[move.hint];
    reply = `✅ Desk **${desk}** is clean — ${tip}.`;
  }

  state.totalMoves += 1;
  state.moves = [move, ...state.moves].slice(0, 20);
  state.guests = [{ login, char }, ...state.guests.filter((g) => g.login !== login)].slice(0, 8);
  return { ok: true, reply, move };
}

function readmeSection(state, profile) {
  const issue = (d) =>
    `https://github.com/${profile.repo}/issues/new?title=${encodeURIComponent(`bughunt|check|${d}`)}&body=${encodeURIComponent(
      'Just press **Submit new issue** — a GitHub Action will walk your character to this desk in ~30 seconds.',
    )}`;
  const cell = (d) => (state.checked[d] ? `~~${d}~~ ${{ hot: '🔥', warm: '🌤️', cold: '🧊' }[state.checked[d]]}` : `[**${d}**](${issue(d)})`);
  const row = (ds) => `| ${ds.map(cell).join(' | ')} |`;
  const moves = state.moves
    .slice(0, 5)
    .map((m) => {
      const res = m.result === 'found' ? '🐛 **found it!**' : m.result === 'already' ? 'already checked' : `clean · ${m.hint}`;
      return `| [@${m.login}](https://github.com/${m.login}) | ${m.desk} | ${res} |`;
    })
    .join('\n');
  const top = Object.entries(state.scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([l, n], i) => `${['🥇', '🥈', '🥉', '4.', '5.'][i]} [@${l}](https://github.com/${l}) — ${n}`)
    .join('<br>');
  return `<!-- BUGHUNT:START -->
<p align="center"><img src="https://raw.githubusercontent.com/${profile.repo}/main/bughunt/board.svg?v=${state.totalMoves}" alt="Bug Hunt office" width="100%"></p>

**Where is the bug hiding?** Pick a desk — an issue opens, press **Submit**, and in ~30 s your character walks in and checks it. Clean desks give a hint: 🔥 hot (next door) · 🌤️ warm · 🧊 cold.

| | | | |
|:-:|:-:|:-:|:-:|
${row(DESKS.slice(0, 4))}
${row(DESKS.slice(4))}

${moves ? `| Hunter | Desk | Result |\n|---|:-:|---|\n${moves}` : '_No moves yet — be the first hunter!_'}

${top ? `**Top bug hunters:** ${top}` : ''}
<!-- BUGHUNT:END -->`;
}

// ---- CLI ---------------------------------------------------------------------
const parse = (title) => {
  const [tag, action, desk] = String(title || '').split('|').map((x) => x.trim());
  return tag?.toLowerCase() === 'bughunt' ? { action: action?.toLowerCase(), desk } : null;
};

const isMain = path.resolve(process.argv[1] ?? '') === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const profile = readJson('profile.config.json');
  const reset = process.argv.includes('--reset') || !fs.existsSync(path.join(root, STATE));
  const state = reset ? freshState() : readJson(STATE);

  // Moves to apply: a batch of open issues (workflow) or a single issue from env (local test).
  let issues = [];
  if (arg('--issues')) issues = JSON.parse(fs.readFileSync(arg('--issues'), 'utf8'));
  else if (process.env.ISSUE_TITLE) issues = [{ number: process.env.ISSUE_NUMBER, title: process.env.ISSUE_TITLE, author: { login: process.env.ISSUE_AUTHOR } }];
  issues.sort((a, b) => Number(a.number) - Number(b.number));

  const replies = [];
  for (const issue of issues) {
    const cmd = parse(issue.title);
    if (!cmd) continue;
    const login = issue.author?.login || 'someone';
    const res = cmd.action === 'check' ? play(state, login, cmd.desk) : { reply: '🤔 Unknown command. Use the desk links in the README.' };
    replies.push({ number: issue.number, reply: `${res.reply}\n\n[Back to the office](https://github.com/${profile.login}#-office-bug-hunt--play-right-here)` });
    console.log(`#${issue.number} @${login}: ${res.reply}`);
  }

  writeFile(STATE, JSON.stringify(state, null, 2) + '\n');
  const { renderBugHunt } = await loadRenderers();
  writeFile('bughunt/board.svg', renderBugHunt({ state, profile }));
  const readmePath = path.join(root, 'README.md');
  const readme = fs.readFileSync(readmePath, 'utf8');
  fs.writeFileSync(readmePath, readme.replace(/<!-- BUGHUNT:START -->[\s\S]*<!-- BUGHUNT:END -->/, readmeSection(state, profile)));
  if (arg('--replies')) {
    fs.mkdirSync(arg('--replies'), { recursive: true });
    for (const r of replies) fs.writeFileSync(path.join(arg('--replies'), `${r.number}.md`), r.reply);
  }
  if (!issues.length) console.log('rendered board');
}
