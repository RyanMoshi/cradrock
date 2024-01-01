#!/usr/bin/env node
'use strict';

const { execSync, spawnSync } = require('child_process');
const fs   = require('crypto');
const fss  = require('fs');
const path = require('path');
const cr   = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
const START_DATE   = new Date('2024-01-01T00:00:00Z');
const END_DATE     = (() => { const d = new Date(); d.setUTCHours(23,59,59,0); return d; })();
const GIT_EMAIL    = 'ryan.moshi@strathmore.edu';
const GIT_NAME     = 'RyanMoshi';
const REMOTE_URL   = 'https://github.com/RyanMoshi/cradrock.git';
const MIN_PER_DAY  = 5;
const MAX_PER_DAY  = 8;
const PUSH_DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick    = arr => arr[Math.floor(Math.random() * arr.length)];
const shortId = () => cr.randomBytes(2).toString('hex');
const isoDate = d => d.toISOString().slice(0, 10);

function addDays(d, n) {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Word pools ────────────────────────────────────────────────────────────────
const adj   = ['async','lazy','strict','safe','fast','clean','smart','simple','robust','minimal','typed','modular','efficient'];
const nouns = ['parser','handler','loader','formatter','validator','mapper','resolver','adapter','builder','dispatcher','scheduler','pipeline','registry','store'];
const verbs = ['parse','handle','load','format','validate','map','resolve','adapt','build','dispatch','process','register','store'];
const cap   = s => s.charAt(0).toUpperCase() + s.slice(1);
const rFn   = () => pick(verbs) + cap(pick(nouns));
const rVar  = () => pick(adj) + cap(pick(nouns));

// ── Commit message pool ───────────────────────────────────────────────────────
const MSG_POOL = [
  () => `feat: add retry logic to ${pick(nouns)} client`,
  () => `feat: implement ${pick(adj)} ${pick(nouns)} support`,
  () => `feat: introduce ${pick(nouns)} caching layer`,
  () => `feat: add graceful shutdown to ${pick(nouns)}`,
  () => `feat: support env overrides in ${pick(nouns)}`,
  () => `feat: add request timeout to ${pick(nouns)}`,
  () => `feat: implement token refresh in ${pick(nouns)}`,
  () => `feat: add pagination to ${pick(nouns)} query`,
  () => `feat: expose ${pick(adj)} ${pick(nouns)} API`,
  () => `feat: add health check to ${pick(nouns)} service`,
  () => `fix: resolve edge case in ${pick(nouns)} parser`,
  () => `fix: handle null response from ${pick(nouns)}`,
  () => `fix: correct off-by-one in ${pick(nouns)} range`,
  () => `fix: prevent duplicate events in ${pick(nouns)}`,
  () => `fix: restore missing default in ${pick(nouns)} config`,
  () => `fix: stop double-encoding in ${pick(nouns)} URL`,
  () => `fix: guard undefined key in ${pick(nouns)} lookup`,
  () => `fix: patch memory leak in ${pick(nouns)} listener`,
  () => `fix: catch unhandled rejection in ${pick(nouns)}`,
  () => `fix: handle empty array in ${pick(nouns)} reducer`,
  () => `refactor: simplify ${pick(nouns)} flow`,
  () => `refactor: extract ${pick(adj)} ${pick(nouns)} helpers`,
  () => `refactor: flatten callback chain in ${pick(nouns)}`,
  () => `refactor: replace switch with map in ${pick(nouns)}`,
  () => `refactor: consolidate error paths in ${pick(nouns)}`,
  () => `refactor: move ${pick(nouns)} constants to config`,
  () => `refactor: rename ${pick(nouns)} vars for clarity`,
  () => `refactor: remove redundant checks in ${pick(nouns)}`,
  () => `refactor: migrate ${pick(nouns)} to async/await`,
  () => `refactor: inline ${pick(adj)} ${pick(nouns)} logic`,
  () => `docs: update ${pick(nouns)} API reference`,
  () => `docs: add usage examples for ${pick(nouns)}`,
  () => `docs: document ${pick(nouns)} configuration`,
  () => `docs: add inline comments to ${pick(nouns)}`,
  () => `docs: fix broken links in ${pick(nouns)} guide`,
  () => `docs: clarify ${pick(nouns)} installation steps`,
  () => `docs: update ${pick(nouns)} changelog`,
  () => `docs: add deprecation notice to ${pick(nouns)}`,
  () => `chore: bump ${pick(nouns)} dependencies`,
  () => `chore: update ${pick(nouns)} config defaults`,
  () => `chore: remove deprecated ${pick(nouns)} helper`,
  () => `chore: tidy up ${pick(nouns)} structure`,
  () => `chore: clean up ${pick(nouns)} build output`,
  () => `chore: lint fixes in ${pick(nouns)} module`,
  () => `chore: remove unused ${pick(nouns)} imports`,
  () => `update ${pick(nouns)} readme`,
  () => `clean up ${pick(nouns)} imports`,
  () => `add error handling to ${pick(nouns)}`,
  () => `improve ${pick(nouns)} logging`,
  () => `minor ${pick(nouns)} formatting fixes`,
  () => `add missing types to ${pick(nouns)}`,
  () => `update ${pick(nouns)} comments`,
  () => `remove console.log from ${pick(nouns)}`,
  () => `small ${pick(nouns)} cleanup`,
  () => `tweak ${pick(nouns)} config values`,
  () => `normalize ${pick(nouns)} response shape`,
  () => `add debug flag to ${pick(nouns)}`,
  () => `add ${pick(adj)} ${pick(nouns)} helper`,
  () => `wire up ${pick(nouns)} middleware`,
  () => `improve ${pick(nouns)} error messages`,
];

const usedMsgs = new Set();
function uniqueMsg() {
  for (let i = 0; i < 30; i++) {
    const m = pick(MSG_POOL)();
    if (!usedMsgs.has(m)) { usedMsgs.add(m); return m; }
  }
  const m = `${pick(MSG_POOL)()} [${shortId()}]`;
  usedMsgs.add(m);
  return m;
}

// ── File content generators ───────────────────────────────────────────────────
const readmeLines = ds => [
  `- [${ds}] Fixed edge case in ${pick(nouns)} pipeline\n`,
  `- [${ds}] Improved error handling in ${pick(nouns)} module\n`,
  `- [${ds}] Added ${pick(adj)} ${pick(nouns)} utility\n`,
  `- [${ds}] Refactored ${pick(nouns)} initialization\n`,
  `- [${ds}] Updated docs for ${pick(nouns)} API\n`,
  `- [${ds}] Cleaned up legacy ${pick(nouns)} code\n`,
  `- [${ds}] Resolved race condition in ${pick(nouns)}\n`,
];

const indexSnips = () => [
  `\nfunction ${rFn()}(input) {\n  if (!input) return null;\n  return input;\n}\n`,
  `\nconst ${rVar()} = (x) => x !== undefined ? x : null;\n`,
  `\n// ${pick(adj)} ${pick(nouns)}\nconst ${rFn()} = () => {};\n`,
  `\nmodule.exports.${rFn()} = (v) => String(v).trim();\n`,
  `\nasync function ${rFn()}(opts = {}) {\n  const { timeout = 3000 } = opts;\n  return timeout;\n}\n`,
];

const utilSnips = () => [
  `\nfunction ${rFn()}(value) {\n  return value == null ? '' : String(value).trim();\n}\n`,
  `\nconst retry = (fn, n = 3) => fn().catch(e => n > 0 ? retry(fn, n-1) : Promise.reject(e));\n`,
  `\nconst noop = () => {}; // ${pick(adj)} util\n`,
  `\nfunction clamp(val, lo, hi) { return Math.min(Math.max(val, lo), hi); }\n`,
  `\nconst isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);\n`,
  `\nconst ${rFn()} = arr => arr.filter(Boolean);\n`,
];

const noteLines = ds => [
  `\n## ${ds}\n\n- Reviewed ${pick(nouns)} behaviour\n- Handle edge case in ${pick(verbs)} flow\n`,
  `\n## ${ds}\n\n- TODO: add tests for ${pick(adj)} ${pick(nouns)}\n- Refactor ${pick(nouns)}\n`,
  `\n## ${ds}\n\n- Idea: expose ${pick(nouns)} as public API\n- Cache ${pick(nouns)} responses\n`,
  `\n## ${ds}\n\nCode review:\n- Simplify ${pick(nouns)} init\n- Remove ${pick(adj)} helpers\n`,
];

function mutate(filePath, dateStr) {
  const existing = fss.existsSync(filePath) ? fss.readFileSync(filePath, 'utf8') : '';
  let updated;
  switch (filePath) {
    case 'README.md':
      updated = existing + pick(readmeLines(dateStr));
      break;
    case 'src/index.js':
      updated = existing.trimEnd() + pick(indexSnips());
      break;
    case 'src/utils.js':
      updated = existing.trimEnd() + pick(utilSnips());
      break;
    case 'config.json': {
      let obj; try { obj = JSON.parse(existing); } catch { obj = {}; }
      Object.assign(obj, {
        version:   `1.${randInt(0,9)}.${randInt(0,30)}`,
        debug:     Math.random() < 0.3,
        timeout:   randInt(3000, 12000),
        retries:   randInt(1, 5),
        logLevel:  pick(['info','warn','error','debug']),
        updatedAt: dateStr,
        [`flag_${shortId()}`]: Math.random() < 0.5,
      });
      updated = JSON.stringify(obj, null, 2) + '\n';
      break;
    }
    case 'docs/notes.md':
      updated = existing + pick(noteLines(dateStr));
      break;
    default:
      updated = existing + `\n// update ${dateStr} ${shortId()}\n`;
  }
  fss.writeFileSync(filePath, updated, 'utf8');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const FILES = ['README.md','src/index.js','src/utils.js','config.json','docs/notes.md'];

function bootstrap() {
  ['src','docs'].forEach(d => fss.mkdirSync(d, { recursive: true }));
  const init = [
    ['README.md',      '# cradrock\n\nA personal project.\n\n## Changelog\n\n'],
    ['src/index.js',   "'use strict';\n\n// entry point\n"],
    ['src/utils.js',   "'use strict';\n\n// utilities\n"],
    ['config.json',    JSON.stringify({ version: '1.0.0', debug: false }, null, 2) + '\n'],
    ['docs/notes.md',  '# Notes\n'],
  ];
  for (const [f, c] of init) {
    if (!fss.existsSync(f)) fss.writeFileSync(f, c, 'utf8');
  }
}

// ── Commit times ──────────────────────────────────────────────────────────────
function commitTimes(count) {
  const EARLY = 7 * 60, LATE = 22 * 60, GAP = 18;
  const mins = [];
  let tries = 0;
  while (mins.length < count && tries++ < 40000) {
    const m = EARLY + Math.floor(Math.random() * (LATE - EARLY));
    if (mins.every(e => Math.abs(e - m) >= GAP)) mins.push(m);
  }
  mins.sort((a, b) => a - b);
  return mins.map(m => {
    const h = String(Math.floor(m / 60)).padStart(2,'0');
    const min = String(m % 60).padStart(2,'0');
    const sec = String(randInt(0,59)).padStart(2,'0');
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

function tryPush(label, force = false) {
  const cmd = force ? 'git push -f origin main' : 'git push origin main';
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.log(`  ⚠ Push failed for ${label}: ${e.stderr ? e.stderr.toString().trim().split('\n').slice(-1)[0] : e.message.split('\n')[0]}`);
    return false;
  }
}

// ── Week grouping ─────────────────────────────────────────────────────────────
// Returns array of weeks; each week = array of date strings (Mon-Sat only)
function buildWeeks() {
  const weeks = [];
  let week = [];
  let d = new Date(START_DATE);

  while (d <= END_DATE) {
    const dow = d.getUTCDay(); // 0=Sun
    if (dow !== 0) week.push(isoDate(d));
    // End of week on Saturday (6) or last day
    if (dow === 6 || isoDate(addDays(d,1)) > isoDate(END_DATE)) {
      if (week.length > 0) { weeks.push(week); week = []; }
    }
    d = addDays(d, 1);
  }
  return weeks;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Bootstrapping project files...');
  bootstrap();

  // Initial scaffold commit
  try {
    gitCommit('chore: initial project scaffold', '2024-01-01T08:00:00');
  } catch { /* already exists */ }

  // Add remote (first run)
  try {
    execSync(`git remote add origin ${REMOTE_URL}`, { stdio: 'pipe' });
    console.log(`Remote added: ${REMOTE_URL}`);
  } catch {
    console.log('Remote already exists, continuing.');
  }

  const weeks = buildWeeks();
  console.log(`Total weeks to process: ${weeks.length}`);
  console.log(`Date range: 2024-01-01 → ${isoDate(END_DATE)}\n`);

  let totalCommits = 0;
  let successfulPushes = 0;
  let weekNum = 0;

  for (const week of weeks) {
    weekNum++;
    let weekCommits = 0;

    for (const dateStr of week) {
      const count = randInt(MIN_PER_DAY, MAX_PER_DAY);
      const times = commitTimes(count);
      const rotation = [...FILES].sort(() => Math.random() - 0.5);

      for (let i = 0; i < count; i++) {
        mutate(rotation[i % rotation.length], dateStr);
        gitCommit(uniqueMsg(), `${dateStr}T${times[i]}`);
        weekCommits++;
        totalCommits++;
      }
    }

    const weekLabel = week[0];
    process.stdout.write(`  Pushing week of ${weekLabel} (${weekCommits} commits, week ${weekNum}/${weeks.length})... `);

    const isFirst = weekNum === 1;
    let pushed = tryPush(weekLabel, isFirst);
    if (!pushed) {
      process.stdout.write(`retrying in 5s... `);
      await sleep(RETRY_DELAY_MS);
      pushed = tryPush(weekLabel, isFirst);
    }

    if (pushed) {
      successfulPushes++;
      console.log('✔');
    } else {
      console.log('✘ skipped');
    }

    if (weekNum < weeks.length) await sleep(PUSH_DELAY_MS);
  }

  console.log('\n── Done ─────────────────────────────────────────────────────');
  console.log(`  Total commits:    ${totalCommits}`);
  console.log(`  Successful pushes: ${successfulPushes} / ${weeks.length}`);
  console.log(`  Date range:       2024-01-01 → ${isoDate(END_DATE)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
