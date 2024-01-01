#!/usr/bin/env node
'use strict';

/**
 * fill-graph.js — Safe to run multiple times.
 * Each run stacks ~2,000 more commits/year onto the repo,
 * increasing green intensity on the GitHub contribution graph.
 *
 * FIRST-TIME SETUP (one time only):
 *   mkdir cradrock && cd cradrock
 *   git init -b main
 *   git config user.email "ryan.moshi@strathmore.edu"
 *   git config user.name "RyanMoshi"
 *   git remote add origin https://github.com/RyanMoshi/cradrock.git
 *
 * USAGE:
 *   node fill-graph.js        ← run once, twice, three times to stack intensity
 */

const { execSync } = require('child_process');
const fss  = require('fs');
const cr   = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
const START_DATE     = new Date('2024-01-01T00:00:00Z');
const END_DATE       = (() => { const d = new Date(); d.setUTCHours(23,59,59,0); return d; })();
const GIT_EMAIL      = 'ryan.moshi@strathmore.edu';
const GIT_NAME       = 'RyanMoshi';
const MIN_PER_DAY    = 5;
const MAX_PER_DAY    = 8;
const PUSH_DELAY_MS  = 2000;
const RETRY_DELAY_MS = 5000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick    = arr    => arr[Math.floor(Math.random() * arr.length)];
const uid     = ()     => cr.randomBytes(2).toString('hex');   // e.g. "3a9f"
const isoDate = d      => d.toISOString().slice(0, 10);

function addDays(d, n) {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Word pools ────────────────────────────────────────────────────────────────
const adj   = ['async','lazy','strict','safe','fast','clean','smart','simple','robust','minimal','typed','modular','efficient','idiomatic','lightweight'];
const nouns = ['parser','handler','loader','formatter','validator','mapper','resolver','adapter','builder','dispatcher','scheduler','pipeline','registry','store','emitter','watcher','logger','cache','router','client'];
const verbs = ['parse','handle','load','format','validate','map','resolve','adapt','build','dispatch','process','register','store','emit','watch','cache','route','fetch','retry','serialize'];
const areas = ['auth','config','api','core','db','queue','session','token','middleware','utils','events','errors','types','tests','build','deploy','lint','ci','docs','schema'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const rFn = () => pick(verbs) + cap(pick(nouns));
const rVar = () => pick(adj) + cap(pick(nouns));

// ── 80+ commit message templates ─────────────────────────────────────────────
// Each template is a function so word-pool picks happen at call time,
// giving natural variety without requiring a static list.
const TEMPLATES = [
  // feat (12)
  () => `feat: add retry logic to ${pick(areas)} ${pick(nouns)}`,
  () => `feat: implement ${pick(adj)} ${pick(nouns)} in ${pick(areas)}`,
  () => `feat: introduce ${pick(nouns)} caching in ${pick(areas)}`,
  () => `feat: expose ${pick(areas)} config via ${pick(nouns)}`,
  () => `feat: add graceful shutdown to ${pick(areas)} ${pick(nouns)}`,
  () => `feat: support env overrides for ${pick(areas)} ${pick(nouns)}`,
  () => `feat: add request timeout to ${pick(areas)} ${pick(nouns)}`,
  () => `feat: implement token refresh in ${pick(areas)} ${pick(nouns)}`,
  () => `feat: add pagination support to ${pick(areas)} ${pick(nouns)}`,
  () => `feat: expose ${pick(adj)} ${pick(nouns)} API in ${pick(areas)}`,
  () => `feat: add health check to ${pick(areas)} service`,
  () => `feat: wire up ${pick(nouns)} middleware in ${pick(areas)}`,

  // fix (16)
  () => `fix: resolve edge case in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: handle null response in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: correct off-by-one in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: prevent duplicate events in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: restore missing default in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: stop double-encoding in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: guard undefined key in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: patch memory leak in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: catch unhandled rejection in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: handle empty array in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: correct status code in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: resolve race condition in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: escape special chars in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: normalize ${pick(nouns)} response in ${pick(areas)}`,
  () => `fix: unwrap nested error in ${pick(areas)} ${pick(nouns)}`,
  () => `fix: retry on timeout in ${pick(areas)} ${pick(nouns)}`,

  // refactor (12)
  () => `refactor: simplify ${pick(areas)} ${pick(nouns)} flow`,
  () => `refactor: extract ${pick(adj)} helpers from ${pick(areas)}`,
  () => `refactor: flatten callback chain in ${pick(areas)} ${pick(nouns)}`,
  () => `refactor: replace switch with map in ${pick(areas)} ${pick(nouns)}`,
  () => `refactor: consolidate error paths in ${pick(areas)}`,
  () => `refactor: move ${pick(areas)} constants to config`,
  () => `refactor: rename ${pick(areas)} vars for clarity`,
  () => `refactor: remove redundant checks in ${pick(areas)} ${pick(nouns)}`,
  () => `refactor: migrate ${pick(areas)} ${pick(nouns)} to async/await`,
  () => `refactor: inline ${pick(adj)} logic in ${pick(areas)}`,
  () => `refactor: split ${pick(areas)} ${pick(nouns)} into smaller units`,
  () => `refactor: unify response shape in ${pick(areas)}`,

  // docs (10)
  () => `docs: update ${pick(areas)} API reference`,
  () => `docs: add usage examples for ${pick(areas)} ${pick(nouns)}`,
  () => `docs: document ${pick(areas)} configuration options`,
  () => `docs: add inline comments to ${pick(areas)} ${pick(nouns)}`,
  () => `docs: fix broken links in ${pick(areas)} guide`,
  () => `docs: clarify ${pick(areas)} installation steps`,
  () => `docs: update ${pick(areas)} changelog`,
  () => `docs: add deprecation notice to ${pick(areas)} ${pick(nouns)}`,
  () => `docs: expand troubleshooting for ${pick(areas)}`,
  () => `docs: add ${pick(areas)} architecture diagram note`,

  // chore (10)
  () => `chore: bump ${pick(areas)} dependencies`,
  () => `chore: update ${pick(areas)} config defaults`,
  () => `chore: remove deprecated ${pick(areas)} ${pick(nouns)}`,
  () => `chore: tidy up ${pick(areas)} project structure`,
  () => `chore: clean up ${pick(areas)} build output`,
  () => `chore: lint fixes in ${pick(areas)} module`,
  () => `chore: remove unused ${pick(areas)} imports`,
  () => `chore: update ${pick(areas)} lock file`,
  () => `chore: enforce ${pick(adj)} code style in ${pick(areas)}`,
  () => `chore: upgrade ${pick(areas)} tooling`,

  // test (8)
  () => `test: add coverage for ${pick(areas)} edge case`,
  () => `test: fix flaky assertion in ${pick(areas)} suite`,
  () => `test: add integration test for ${pick(areas)} ${pick(nouns)}`,
  () => `test: increase timeout in ${pick(areas)} test`,
  () => `test: add snapshot test for ${pick(areas)} ${pick(nouns)}`,
  () => `test: cover null path in ${pick(areas)} ${pick(nouns)}`,
  () => `test: mock ${pick(nouns)} in ${pick(areas)} unit test`,
  () => `test: assert correct shape in ${pick(areas)} response`,

  // casual (16)
  () => `update ${pick(areas)} readme`,
  () => `clean up ${pick(areas)} imports`,
  () => `add error handling to ${pick(areas)} ${pick(nouns)}`,
  () => `improve ${pick(areas)} logging`,
  () => `minor formatting fixes in ${pick(areas)}`,
  () => `add missing types to ${pick(areas)} ${pick(nouns)}`,
  () => `update ${pick(areas)} comments`,
  () => `remove console.log from ${pick(areas)}`,
  () => `small cleanup in ${pick(areas)} ${pick(nouns)}`,
  () => `tweak ${pick(areas)} config values`,
  () => `normalize ${pick(areas)} response shape`,
  () => `add debug flag to ${pick(areas)} ${pick(nouns)}`,
  () => `add ${pick(adj)} ${pick(nouns)} to ${pick(areas)}`,
  () => `improve ${pick(areas)} error messages`,
  () => `adjust retry backoff in ${pick(areas)}`,
  () => `wire up ${pick(areas)} ${pick(nouns)} hook`,
];

// Generate a unique message; append a uid suffix only as last resort
const usedMsgs = new Set();
function uniqueMsg() {
  for (let i = 0; i < 40; i++) {
    const m = pick(TEMPLATES)();
    if (!usedMsgs.has(m)) { usedMsgs.add(m); return m; }
  }
  // Extremely rare fallback — looks like a natural clarification, not a number
  const base = pick(TEMPLATES)();
  const ctx  = pick(areas);
  const m    = `${base} (${ctx})`;
  usedMsgs.add(m);
  return m;
}

// ── File content generators ───────────────────────────────────────────────────
function makeReadmeLine(ds) {
  const items = [
    `- [${ds}] Fixed edge case in ${pick(areas)} ${pick(nouns)}`,
    `- [${ds}] Improved error handling in ${pick(areas)} module`,
    `- [${ds}] Added ${pick(adj)} ${pick(nouns)} to ${pick(areas)}`,
    `- [${ds}] Refactored ${pick(areas)} ${pick(nouns)} initialization`,
    `- [${ds}] Updated docs for ${pick(areas)} API`,
    `- [${ds}] Cleaned up legacy ${pick(areas)} code`,
    `- [${ds}] Resolved race condition in ${pick(areas)} ${pick(nouns)}`,
    `- [${ds}] Bumped ${pick(areas)} dependency versions`,
  ];
  return pick(items) + '\n';
}

function makeIndexSnip() {
  const snips = [
    `\nfunction ${rFn()}(input) {\n  if (!input) return null;\n  return input;\n}\n`,
    `\nconst ${rVar()} = (x) => x !== undefined ? x : null;\n`,
    `\n// ${pick(adj)} ${pick(nouns)} — ${pick(areas)}\nconst ${rFn()} = () => {};\n`,
    `\nmodule.exports.${rFn()} = (v) => String(v).trim();\n`,
    `\nasync function ${rFn()}(opts = {}) {\n  const { timeout = 3000 } = opts;\n  return timeout;\n}\n`,
    `\nconst ${rFn()} = (items) => items.filter(Boolean);\n`,
  ];
  return pick(snips);
}

function makeUtilSnip() {
  const snips = [
    `\nfunction ${rFn()}(value) {\n  return value == null ? '' : String(value).trim();\n}\n`,
    `\nconst retry = (fn, n = 3) => fn().catch(e => n > 0 ? retry(fn, n-1) : Promise.reject(e));\n`,
    `\nconst noop = () => {}; // ${pick(adj)} ${pick(nouns)} util\n`,
    `\nfunction clamp(val, lo, hi) { return Math.min(Math.max(val, lo), hi); }\n`,
    `\nconst isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);\n`,
    `\nconst memoize = fn => { const c = new Map(); return x => c.has(x) ? c.get(x) : (c.set(x, fn(x)), c.get(x)); };\n`,
    `\nconst ${rFn()} = (arr, key) => arr.reduce((m, v) => ({ ...m, [v[key]]: v }), {});\n`,
  ];
  return pick(snips);
}

function makeNoteLine(ds) {
  const items = [
    `\n## ${ds}\n\n- Reviewed ${pick(areas)} ${pick(nouns)} behaviour\n- Handle edge case in ${pick(verbs)} flow\n`,
    `\n## ${ds}\n\n- TODO: add tests for ${pick(adj)} ${pick(areas)} ${pick(nouns)}\n- Consider refactoring ${pick(areas)}\n`,
    `\n## ${ds}\n\n- Idea: expose ${pick(areas)} ${pick(nouns)} as public API\n- Cache ${pick(areas)} responses\n`,
    `\n## ${ds}\n\nCode review notes:\n- Simplify ${pick(areas)} ${pick(nouns)} init\n- Remove unused ${pick(adj)} helpers\n`,
    `\n## ${ds}\n\n- Investigated ${pick(areas)} performance\n- Spike: migrate ${pick(areas)} ${pick(nouns)} to streaming\n`,
  ];
  return pick(items);
}

// ── Bootstrap: create dirs and files only if missing ─────────────────────────
const FILES = ['README.md', 'src/index.js', 'src/utils.js', 'config.json', 'docs/notes.md'];

function ensureFiles() {
  ['src', 'docs'].forEach(d => fss.mkdirSync(d, { recursive: true }));

  const defaults = [
    ['README.md',     '# cradrock\n\nA personal project.\n\n## Changelog\n\n'],
    ['src/index.js',  "'use strict';\n\n// entry point\n"],
    ['src/utils.js',  "'use strict';\n\n// utilities\n"],
    ['config.json',   JSON.stringify({ version: '1.0.0', buildNumber: 0, debug: false }, null, 2) + '\n'],
    ['docs/notes.md', '# Notes\n'],
  ];
  for (const [f, c] of defaults) {
    if (!fss.existsSync(f)) fss.writeFileSync(f, c, 'utf8');
  }
}

// ── Append-only file mutator ──────────────────────────────────────────────────
function mutate(filePath, dateStr) {
  const existing = fss.readFileSync(filePath, 'utf8');

  let updated;
  switch (filePath) {
    case 'README.md':
      updated = existing + makeReadmeLine(dateStr);
      break;

    case 'src/index.js':
      updated = existing.trimEnd() + makeIndexSnip();
      break;

    case 'src/utils.js':
      updated = existing.trimEnd() + makeUtilSnip();
      break;

    case 'config.json': {
      let obj;
      try { obj = JSON.parse(existing); } catch { obj = {}; }
      obj.buildNumber = (obj.buildNumber || 0) + 1;
      // bump patch version
      const parts = String(obj.version || '1.0.0').split('.').map(Number);
      parts[2] = (parts[2] || 0) + 1;
      obj.version   = parts.join('.');
      obj.updatedAt = dateStr;
      obj.debug     = Math.random() < 0.25;
      obj.timeout   = randInt(3000, 12000);
      obj[`flag_${uid()}`] = Math.random() < 0.5;
      updated = JSON.stringify(obj, null, 2) + '\n';
      break;
    }

    case 'docs/notes.md':
      updated = existing + makeNoteLine(dateStr);
      break;

    default:
      updated = existing + `\n// update ${dateStr} ${uid()}\n`;
  }

  fss.writeFileSync(filePath, updated, 'utf8');
}

// ── Commit times: sorted, min 15-min gap, 07:00–22:00 ────────────────────────
function commitTimes(count) {
  const EARLY = 7 * 60, LATE = 22 * 60, GAP = 15;
  const mins  = [];
  let tries   = 0;
  while (mins.length < count && tries++ < 50000) {
    const m = EARLY + Math.floor(Math.random() * (LATE - EARLY));
    if (mins.every(e => Math.abs(e - m) >= GAP)) mins.push(m);
  }
  mins.sort((a, b) => a - b);
  return mins.map(m => {
    const h   = String(Math.floor(m / 60)).padStart(2, '0');
    const min = String(m % 60).padStart(2, '0');
    const sec = String(randInt(0, 59)).padStart(2, '0');
    return `${h}:${min}:${sec}`;
  });
}

// ── Git helpers ───────────────────────────────────────────────────────────────
function gitCommit(message, isoTimestamp) {
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE:     isoTimestamp,
    GIT_COMMITTER_DATE:  isoTimestamp,
    GIT_AUTHOR_NAME:     GIT_NAME,
    GIT_AUTHOR_EMAIL:    GIT_EMAIL,
    GIT_COMMITTER_NAME:  GIT_NAME,
    GIT_COMMITTER_EMAIL: GIT_EMAIL,
  };
  execSync('git add -A', { env, stdio: 'pipe' });
  execSync(`git commit -m ${JSON.stringify(message)}`, { env, stdio: 'pipe' });
}

function tryPush(label) {
  try {
    execSync('git push origin main', { stdio: 'pipe' });
    return true;
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString().trim().split('\n').pop() : e.message.split('\n')[0];
    console.log(`  ⚠  Push failed for ${label}: ${msg}`);
    return false;
  }
}

// ── Build list of weeks (each week = Mon-Sat date strings) ────────────────────
function buildWeeks() {
  const weeks = [];
  let week = [];
  let d = new Date(START_DATE);

  while (d <= END_DATE) {
    const dow = d.getUTCDay();
    week.push(isoDate(d));                  // Mon–Sun, every day
    const next = addDays(d, 1);
    if (dow === 0 || next > END_DATE) {     // end week on Sunday
      if (week.length) { weeks.push(week); week = []; }
    }
    d = next;
  }
  if (week.length) weeks.push(week);
  return weeks;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Sanity-check: make sure we're in a git repo
  try {
    execSync('git rev-parse --git-dir', { stdio: 'pipe' });
  } catch {
    console.error('ERROR: Not inside a git repository.');
    console.error('Run the first-time setup:\n');
    console.error('  git init -b main');
    console.error('  git config user.email "ryan.moshi@strathmore.edu"');
    console.error('  git config user.name "RyanMoshi"');
    console.error('  git remote add origin https://github.com/RyanMoshi/cradrock.git\n');
    process.exit(1);
  }

  console.log('Ensuring project files exist...');
  ensureFiles();

  const weeks       = buildWeeks();
  const totalDays   = weeks.flat().length;
  const estPerRun   = Math.round(totalDays * ((MIN_PER_DAY + MAX_PER_DAY) / 2));

  console.log(`Weeks to process : ${weeks.length}`);
  console.log(`Mon–Sat days     : ${totalDays}`);
  console.log(`Est. commits/run : ~${estPerRun}`);
  console.log(`Date range       : 2024-01-01 → ${isoDate(END_DATE)}\n`);

  let totalCommits    = 0;
  let successfulPushes = 0;

  for (let wi = 0; wi < weeks.length; wi++) {
    const week      = weeks[wi];
    const weekLabel = week[0];
    let weekCommits = 0;

    for (const dateStr of week) {
      const count    = randInt(MIN_PER_DAY, MAX_PER_DAY);
      const times    = commitTimes(count);
      const rotation = [...FILES].sort(() => Math.random() - 0.5);

      for (let i = 0; i < count; i++) {
        mutate(rotation[i % rotation.length], dateStr);
        gitCommit(uniqueMsg(), `${dateStr}T${times[i]}`);
        weekCommits++;
        totalCommits++;
      }
    }

    process.stdout.write(`  Pushing week of ${weekLabel} (${weekCommits} commits, week ${wi + 1}/${weeks.length})... `);

    let pushed = tryPush(weekLabel);
    if (!pushed) {
      process.stdout.write(`  retrying in 5s... `);
      await sleep(RETRY_DELAY_MS);
      pushed = tryPush(weekLabel);
    }

    if (pushed) {
      successfulPushes++;
      console.log('✔');
    } else {
      console.log('✘ skipped');
    }

    if (wi < weeks.length - 1) await sleep(PUSH_DELAY_MS);
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  // Estimate total commits on remote by checking git log count
  let remoteTotal = '?';
  try {
    remoteTotal = execSync('git rev-list --count HEAD', { stdio: 'pipe' }).toString().trim();
  } catch { /* ignore */ }

  console.log('\n── Done ─────────────────────────────────────────────────────');
  console.log(`  Commits this run    : ${totalCommits}`);
  console.log(`  Successful pushes   : ${successfulPushes} / ${weeks.length}`);
  console.log(`  Total commits on remote (approx): ${remoteTotal}`);
  console.log(`  Date range          : 2024-01-01 → ${isoDate(END_DATE)}`);
  console.log('\n  Run again to increase green intensity on the graph.');
  console.log('  Recommended: 2–3 runs for medium-dark green.');
}

main().catch(err => { console.error(err); process.exit(1); });
