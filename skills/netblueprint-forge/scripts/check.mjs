#!/usr/bin/env node
// Headless layout check for a built NetBlueprint page.
//
//   node scripts/check.mjs <built.html> [more.html ...] [--browser <exe>] [--max-crossings N] [--max-bends N]
//                          [--width 1900] [--height 1150] [--json] [--quiet]
//
// Opens each page in a Chromium-based browser (Playwright's Chromium when the package is installed, else Chrome, Edge, Chromium or Brave
// found on the machine, else --browser / NB_BROWSER), lets the page run its own geometry check (?nbcheck=1) and reads the report it
// appends. A page passes when, on every diagram tab, no line crosses or hugs a box it does not touch, no line runs over text, no two texts
// overlap, no glyph sits within 11 px of another line, no middle segment is a jog under 20 px, no two lines share a lane, and every leg was
// routed. Crossings and the longest flow's bends are reported; --max-crossings / --max-bends turn them into limits.
//
// Exit codes: 0 every page passed, 1 a check failed, 2 no browser found or a page produced no report.
// Nothing to install: Node 18+ and any Chromium-based browser already on the machine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HARD_CHECKS = ['collisions', 'nearMisses', 'fallback', 'lineOverText', 'textOverlaps', 'glyphsNear', 'jogs', 'sharedStretches'];
export const HARD_LABELS = {
  collisions: 'line through a box', nearMisses: 'line within 8 px of a box', fallback: 'leg the router could not route',
  lineOverText: 'line over text', textOverlaps: 'texts overlapping', glyphsNear: 'glyph within 11 px of another line',
  jogs: 'jog under 20 px', sharedStretches: 'two lines in one lane',
};

const exists = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };

function onPath(names) {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const n of names) for (const d of dirs) for (const e of exts) { const p = path.join(d, n + e); if (exists(p)) return p; }
  return null;
}

async function playwrightChromium() {
  for (const pkg of ['playwright', 'playwright-core']) {
    try { const m = await import(pkg); const p = m.chromium && m.chromium.executablePath(); if (exists(p)) return p; } catch { /* not installed */ }
  }
  return null;
}

/** Finds a Chromium-based browser executable, or null. Order: explicit path, NB_BROWSER, Playwright's Chromium, well-known install paths, PATH. */
export async function findBrowser(explicit) {
  if (explicit) { if (exists(explicit)) return explicit; throw new Error(`browser not found: ${explicit}`); }
  if (process.env.NB_BROWSER) { if (exists(process.env.NB_BROWSER)) return process.env.NB_BROWSER; throw new Error(`NB_BROWSER not found: ${process.env.NB_BROWSER}`); }
  const pw = await playwrightChromium(); if (pw) return pw;
  const env = process.env, candidates = [];
  if (process.platform === 'win32') {
    const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LocalAppData].filter(Boolean);
    for (const r of roots) candidates.push(
      path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(r, 'Chromium', 'Application', 'chrome.exe'), path.join(r, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'));
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser');
  } else {
    candidates.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
      '/usr/bin/microsoft-edge-stable', '/usr/bin/brave-browser', '/snap/bin/chromium', '/opt/google/chrome/chrome');
  }
  for (const c of candidates) if (exists(c)) return c;
  return onPath(['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'msedge', 'chrome', 'brave-browser']);
}

/** Runs one page headless and returns its report ({renderer, title, tabs:[...], ok, page:{w,h}}). Throws when the page produced none.
 *  `hash` opens the page at a tab, step or attack-path hop (`#tab=…&step=…`, as the page reads it); `page` is then the document's natural
 *  size with that state shown, which scripts/screenshot.mjs uses to size its window. */
export function runReport(browser, htmlPath, { width = 1900, height = 1150, timeout = 120000, hash = '' } = {}) {
  const file = path.resolve(htmlPath);
  if (!exists(file)) throw new Error(`not found: ${htmlPath}`);
  const url = pathToFileURL(file).href + '?nbcheck=1' + (hash ? (hash.startsWith('#') ? hash : '#' + hash) : '');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-check-'));
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`, '--virtual-time-budget=10000', '--dump-dom', url];
  let dom = '';
  try {
    dom = execFileSync(browser, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  } catch (e) {
    if (e.stdout && /id="nb-report"/.test(e.stdout)) dom = e.stdout; // the browser complained about something else but the page ran
    else throw new Error(`browser failed on ${path.basename(file)}: ${(e.stderr || e.message || '').toString().trim().split('\n').slice(-3).join(' | ')}`);
  } finally {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold a file for a moment */ }
  }
  if (!dom.trim()) throw new Error(`${path.basename(browser)} printed nothing for ${path.basename(file)}. Microsoft Edge on Windows hands the page to its already running instance; close Edge, or point --browser (or NB_BROWSER) at Chrome or Chromium`);
  const all = [...dom.matchAll(/<script type="application\/json" id="nb-report">([\s\S]*?)<\/script>/g)];
  const m = all[all.length - 1]; // the report is appended last; the renderer's own source may mention the tag
  if (!m) throw new Error(`no report in ${path.basename(file)} (is it a page built by renderer 1.6.1 or later?)`);
  return JSON.parse(m[1]);
}

/** Applies the pass/fail rules to a report. Returns {ok, failures:[string], lines:[string]} (lines = one summary per tab). */
export function judge(report, { maxCrossings = null, maxBends = null } = {}) {
  const failures = [], lines = [];
  for (const t of report.tabs || []) {
    const bad = HARD_CHECKS.filter((k) => (t[k] || []).length);
    bad.forEach((k) => failures.push(`${t.tab}: ${t[k].length} × ${HARD_LABELS[k]}: ${t[k].slice(0, 6).join('; ')}${t[k].length > 6 ? ' …' : ''}`));
    if (maxCrossings != null && t.crossings > maxCrossings) failures.push(`${t.tab}: ${t.crossings} crossings (limit ${maxCrossings})`);
    if (maxBends != null && t.maxBends > maxBends) failures.push(`${t.tab}: a flow bends ${t.maxBends} times (limit ${maxBends})`);
    const n = (k) => (t[k] || []).length;
    lines.push(`${bad.length ? 'FAIL' : 'PASS'}  ${t.tab}: ${n('collisions')} through boxes, ${n('nearMisses')} near boxes, ${n('lineOverText')} over text, ${n('glyphsNear')} glyph clashes, ${n('jogs')} jogs, ${n('sharedStretches')} shared lanes, ${n('fallback')} unrouted; ${t.crossings} crossings, longest flow ${t.maxBends} bends, canvas ${t.canvas.w}×${t.canvas.h}`);
  }
  if (!(report.tabs || []).length) failures.push('the page has no diagram tab');
  return { ok: failures.length === 0, failures, lines };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const files = args.filter((a, i) => !a.startsWith('-') && !['--browser', '--max-crossings', '--max-bends', '--width', '--height'].includes(args[i - 1]));
  if (!files.length || args.includes('-h') || args.includes('--help')) {
    console.error('usage: node scripts/check.mjs <built.html> [more.html ...] [--browser <exe>] [--max-crossings N] [--max-bends N] [--width 1900] [--height 1150] [--json] [--quiet]');
    process.exit(files.length ? 0 : 2);
  }
  let browser;
  try { browser = await findBrowser(opt('--browser')); } catch (e) { console.error(`check: ${e.message}`); process.exit(2); }
  if (!browser) {
    console.error('check: no Chromium-based browser found. Install Chrome, Edge or Chromium, or pass --browser <path> (or set NB_BROWSER). Without one, open the page with ?nbcheck=1 and read the <script id="nb-report"> element, or run window.__nbTabs.check() in its console.');
    process.exit(2);
  }
  const quiet = args.includes('--quiet'), json = args.includes('--json');
  const limits = { maxCrossings: opt('--max-crossings') != null ? +opt('--max-crossings') : null, maxBends: opt('--max-bends') != null ? +opt('--max-bends') : null };
  const size = { width: +(opt('--width') || 1900), height: +(opt('--height') || 1150) };
  let code = 0; const all = {};
  for (const f of files) {
    let report;
    try { report = runReport(browser, f, size); } catch (e) { console.error(`check: ${e.message}`); code = Math.max(code, 2); continue; }
    all[f] = report;
    const v = judge(report, limits);
    if (!quiet) { console.log(`${path.basename(f)} (renderer ${report.renderer})`); v.lines.forEach((l) => console.log('  ' + l)); v.failures.forEach((l) => console.log('  ✗ ' + l)); }
    if (!v.ok) code = Math.max(code, 1);
  }
  if (json) console.log(JSON.stringify(files.length === 1 ? all[files[0]] : all, null, 2));
  if (!quiet) console.log(code === 0 ? `check: ${files.length} page(s) passed (browser: ${path.basename(browser)})` : code === 1 ? 'check: failed' : 'check: could not run on every page');
  process.exit(code);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
