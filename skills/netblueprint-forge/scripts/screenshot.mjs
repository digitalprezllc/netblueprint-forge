#!/usr/bin/env node
// Renders one view of a built NetBlueprint page to a PNG, with a Chromium-based browser already on the machine.
//
//   node scripts/screenshot.mjs <built.html> [-o out.png] [--tab <name>] [--step <n | step name>] [--path AP-nnnn [--hop n]]
//                               [--width 1600] [--height auto | N] [--scale 1] [--browser <exe>] [--quiet]
//
// The page opens at the tab, walkthrough step or attack-path hop asked for (the deep links any browser understands: #tab=…&step=… or
// &path=…&hop=…), at the width given. With --height auto (the default) the page is measured first, so the picture holds the whole document,
// band to signature block, with the diagram at its natural size; a fixed --height crops or stretches to that many CSS pixels instead.
// --scale 2 doubles the pixels for crisp pictures in documents and decks. The default output name is <page>[-<tab>][-<step>].png next
// to the page. Nothing to install: Node 18+ and Chrome, Chromium, Brave or Playwright's Chromium (--browser / NB_BROWSER for other paths).
// Exit codes: 0 written, 1 bad arguments, 2 no browser, no report or no picture.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findBrowser, runReport } from './check.mjs';

const BASE_ARGS = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--disable-sync', '--hide-scrollbars', '--allow-file-access-from-files'];

/** The URL hash for a tab / step / attack-path hop, as the page reads it ('' when nothing is asked for). */
export function deepLinkHash({ tab, step, path: attackPath, hop } = {}) {
  const parts = [];
  if (tab) parts.push('tab=' + encodeURIComponent(tab));
  if (attackPath) { parts.push('path=' + encodeURIComponent(attackPath)); if (hop) parts.push('hop=' + encodeURIComponent(hop)); }
  else if (step) parts.push('step=' + encodeURIComponent(step));
  return parts.length ? '#' + parts.join('&') : '';
}

function defaultName(file, { tab, step, path: attackPath, hop }) {
  const base = path.basename(file).replace(/\.html?$/i, '');
  const tag = [tab, attackPath ? attackPath + (hop ? '-hop-' + hop : '') : step].filter(Boolean).map((s) => String(s).replace(/[^\w.-]+/g, '-')).join('-');
  return path.join(path.dirname(file), base + (tag ? '-' + tag : '') + '.png');
}

/** Writes the PNG and returns {out, width, height, scale, hash}. height 'auto' measures the page first (one extra browser run). */
export function screenshot(browser, htmlPath, { out, tab, step, path: attackPath, hop, width = 1600, height = 'auto', scale = 1, timeout = 120000 } = {}) {
  const file = path.resolve(htmlPath);
  if (!fs.existsSync(file)) throw new Error(`not found: ${htmlPath}`);
  const hash = deepLinkHash({ tab, step, path: attackPath, hop });
  let w = Math.round(width), h;
  if (height === 'auto' || height == null || height === '') {
    const rep = runReport(browser, file, { width: w, height: 480, timeout, hash });
    if (!rep.page) throw new Error(`${path.basename(file)} reports no page size (is it a page built by renderer 1.7.1 or later?)`);
    w = Math.max(w, rep.page.w); h = rep.page.h;
  } else {
    h = Math.round(+height);
    if (!(h > 0)) throw new Error(`--height must be "auto" or a number of pixels, not "${height}"`);
  }
  const outPath = path.resolve(out || defaultName(file, { tab, step, path: attackPath, hop }));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-shot-'));
  const args = [...BASE_ARGS, `--window-size=${w},${h}`, `--force-device-scale-factor=${scale}`, `--user-data-dir=${profile}`, '--virtual-time-budget=10000',
    `--screenshot=${outPath}`, pathToFileURL(file).href + hash];
  let stderr = '';
  try { execFileSync(browser, args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
  catch (e) { stderr = (e.stderr || e.message || '').toString(); }
  finally { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold a file for a moment */ } }
  if (!fs.existsSync(outPath)) {
    const tail = stderr.trim().split('\n').slice(-3).join(' | ');
    throw new Error(`${path.basename(browser)} wrote no picture for ${path.basename(file)}${tail ? ': ' + tail : ''}. Microsoft Edge on Windows hands the page to its already running instance; close Edge, or point --browser (or NB_BROWSER) at Chrome or Chromium`);
  }
  return { out: outPath, width: w, height: h, scale, hash };
}

async function main() {
  const args = process.argv.slice(2);
  const valued = new Set(['-o', '--out', '--tab', '--step', '--path', '--hop', '--width', '--height', '--scale', '--browser']);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const files = args.filter((a, i) => !a.startsWith('-') && !valued.has(args[i - 1]));
  if (files.length !== 1 || args.includes('-h') || args.includes('--help')) {
    console.error('usage: node scripts/screenshot.mjs <built.html> [-o out.png] [--tab <name>] [--step <n | step name>] [--path AP-nnnn [--hop n]] [--width 1600] [--height auto|N] [--scale 1] [--browser <exe>] [--quiet]');
    process.exit(files.length === 1 ? 0 : 1);
  }
  let browser;
  try { browser = await findBrowser(opt('--browser')); } catch (e) { console.error(`screenshot: ${e.message}`); process.exit(2); }
  if (!browser) { console.error('screenshot: no Chromium-based browser found. Install Chrome, Edge or Chromium, or pass --browser <path> (or set NB_BROWSER).'); process.exit(2); }
  try {
    const r = screenshot(browser, files[0], { out: opt('-o') || opt('--out'), tab: opt('--tab'), step: opt('--step'), path: opt('--path'), hop: opt('--hop'),
      width: +(opt('--width') || 1600), height: opt('--height') || 'auto', scale: +(opt('--scale') || 1) });
    if (!args.includes('--quiet')) console.log(`wrote ${r.out} (${r.width}×${r.height}${r.scale !== 1 ? ` at ${r.scale}×` : ''}${r.hash ? '; ' + decodeURIComponent(r.hash.slice(1)).replace(/&/g, ', ') : ''})`);
  } catch (e) { console.error(`screenshot: ${e.message}`); process.exit(2); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
