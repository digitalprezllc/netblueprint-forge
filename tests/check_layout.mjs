// Builds the shipped examples and runs the headless layout check on each (scripts/check.mjs), then compares crossings and the longest
// flow's bends with tests/layout-baseline.json: a page fails when any hard check is non-empty or when those two numbers grow.
//   node tests/check_layout.mjs [--no-build] [--update] [--hard-only] [--browser <exe>]
// --update rewrites the baseline from the current numbers (do this deliberately, after looking at the diagrams).
// --hard-only fails on the hard checks alone and only reports crossings and bends: text is measured with the browser's fonts, so a
//   machine without the fonts the baseline was taken with (a Linux CI runner) lays out a few pixels differently and the counts can move.
// Exit: 0 pass, 1 fail, 2 no browser on this machine (prints how to get one) or a page produced no report.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBrowser, runReport, judge } from '../skills/netblueprint-forge/scripts/check.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const examples = ['entra-app-proxy', 'azure-hub-spoke', 'partner-portal-tabs', 'aws-three-tier', 'gcp-serverless-web'];
const baselinePath = path.join(root, 'tests', 'layout-baseline.json');
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : {};

if (!args.includes('--no-build')) {
  for (const ex of examples) {
    const model = path.join(root, 'examples', ex, `${ex}.model.json`);
    execFileSync(process.execPath, [path.join(root, 'skills', 'netblueprint-forge', 'scripts', 'build.mjs'), model], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
}

let browser = null;
try { browser = await findBrowser(opt('--browser')); } catch (e) { console.error(`SKIP  ${e.message}`); process.exit(2); }
if (!browser) { console.error('SKIP  no Chromium-based browser found (Chrome, Edge, Chromium, Brave or Playwright). Pass --browser <exe> or set NB_BROWSER.'); process.exit(2); }

let failures = 0, code = 0; const next = {};
for (const ex of examples) {
  const html = path.join(root, 'examples', ex, `${ex}.html`);
  let report;
  try { report = runReport(browser, html); } catch (e) { console.log(`FAIL  ${ex}: ${e.message}`); code = 2; failures++; continue; }
  const v = judge(report);
  next[ex] = {};
  for (const t of report.tabs) {
    const base = (baseline[ex] || {})[t.tab];
    next[ex][t.tab] = { crossings: t.crossings, maxBends: t.maxBends };
    const grew = [];
    if (args.includes('--hard-only')) { /* numbers are reported, not compared */ } else if (base) {
      if (t.crossings > base.crossings) grew.push(`crossings ${base.crossings} → ${t.crossings}`);
      if (t.maxBends > base.maxBends) grew.push(`longest flow ${base.maxBends} → ${t.maxBends} bends`);
    } else if (!args.includes('--update')) grew.push('no baseline for this tab (run with --update once it looks right)');
    if (grew.length) v.failures.push(`${t.tab}: ${grew.join(', ')}`);
  }
  const ok = v.failures.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${ex} (renderer ${report.renderer})`);
  v.lines.forEach((l) => console.log('      ' + l));
  v.failures.forEach((l) => console.log('      ✗ ' + l));
  if (!ok) failures++;
}
if (args.includes('--update')) { fs.writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8' }); console.log(`baseline written: ${path.relative(root, baselinePath)}`); }
console.log(`${failures ? failures + ' example(s) failed' : 'all examples passed'} (browser: ${path.basename(browser)}${args.includes('--hard-only') ? '; hard checks only, baseline not compared' : ''})`);
process.exit(code || (failures ? 1 : 0));
