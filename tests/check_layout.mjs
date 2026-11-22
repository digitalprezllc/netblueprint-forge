// Builds the shipped examples and runs the headless layout check on each (scripts/check.mjs), then compares crossings and the longest
// flow's bends with tests/layout-baseline.json: a page fails when any hard check is non-empty or when those two numbers grow.
//   node tests/check_layout.mjs [--no-build] [--update] [--hard-only] [--browser <exe>] [--font <name>]
// --update rewrites the baseline from the current numbers (do this deliberately, after looking at the diagrams).
// --hard-only fails on the hard checks alone and only reports crossings and bends: text is measured with the browser's fonts, so a
//   machine without the fonts the baseline was taken with (a Linux CI runner) lays out a few pixels differently and the counts can move.
// --font <name> builds the examples with that font in place of "Segoe UI" into a temporary folder and runs the hard checks on those
//   pages (the shipped pages and the baseline are not touched): a preview of what a Linux runner sees, for example --font "DejaVu Sans".
// Exit: 0 pass, 1 fail, 2 no browser on this machine (prints how to get one) or a page produced no report.
import fs from 'node:fs';
import os from 'node:os';
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
const font = opt('--font'); const hardOnly = args.includes('--hard-only') || !!font;
let fontDir = null;
if (font) {
  const tplPath = path.join(root, 'skills', 'netblueprint-forge', 'assets', 'template', 'template.html');
  const tpl = fs.readFileSync(tplPath, 'utf8');
  if (!tpl.includes('Segoe UI')) { console.error('SKIP  the template no longer names "Segoe UI"; update --font in this script'); process.exit(2); }
  fontDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-layout-font-'));
  fs.writeFileSync(path.join(fontDir, 'template.html'), tpl.split('Segoe UI').join(font), 'utf8');
  console.log(`font: "${font}" in place of "Segoe UI"; pages built in ${fontDir}; hard checks only`);
}
const pageOf = (ex) => fontDir ? path.join(fontDir, `${ex}.html`) : path.join(root, 'examples', ex, `${ex}.html`);

if (!args.includes('--no-build') || fontDir) {
  for (const ex of examples) {
    const model = path.join(root, 'examples', ex, `${ex}.model.json`);
    const extra = fontDir ? ['--template', path.join(fontDir, 'template.html'), '-o', pageOf(ex)] : [];
    execFileSync(process.execPath, [path.join(root, 'skills', 'netblueprint-forge', 'scripts', 'build.mjs'), model, ...extra], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
}

let browser = null;
try { browser = await findBrowser(opt('--browser')); } catch (e) { console.error(`SKIP  ${e.message}`); process.exit(2); }
if (!browser) { console.error('SKIP  no Chromium-based browser found (Chrome, Edge, Chromium, Brave or Playwright). Pass --browser <exe> or set NB_BROWSER.'); process.exit(2); }

let failures = 0, code = 0; const next = {};
for (const ex of examples) {
  const html = pageOf(ex);
  let report;
  try { report = runReport(browser, html); } catch (e) { console.log(`FAIL  ${ex}: ${e.message}`); code = 2; failures++; continue; }
  const v = judge(report);
  next[ex] = {};
  for (const t of report.tabs) {
    const base = (baseline[ex] || {})[t.tab];
    next[ex][t.tab] = { crossings: t.crossings, maxBends: t.maxBends };
    const grew = [];
    if (hardOnly) { /* numbers are reported, not compared */ } else if (base) {
      if (t.crossings > base.crossings) grew.push(`crossings ${base.crossings} → ${t.crossings}`);
      if (t.maxBends > base.maxBends) grew.push(`longest flow ${base.maxBends} → ${t.maxBends} bends`);
    } else if (!args.includes('--update')) grew.push('no baseline for this tab (run with --update once it looks right)');
    if (grew.length) v.failures.push(`${t.tab}: ${grew.join(', ')}`);
    const silent = (t.walk || []).filter((s) => s.flows && !s.packets.length).map((s) => s.step);
    if (!t.walk) v.failures.push(`${t.tab}: the report has no walk entry`); else if (silent.length) v.failures.push(`${t.tab}: steps with flows but no moving packet: ${silent.join(', ')}`);
  }
  const ok = v.failures.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${ex} (renderer ${report.renderer})`);
  v.lines.forEach((l) => console.log('      ' + l));
  v.failures.forEach((l) => console.log('      ✗ ' + l));
  if (!ok) failures++;
}
// A step that lists flows and names no packets still moves: the page sends one packet per flow, in the order of step.flows.
// tests/fixtures/tabs-minimal.model.json has such a step on each of its two tabs.
{
  const fixture = path.join(root, 'tests', 'fixtures', 'tabs-minimal.model.json');
  const model = JSON.parse(fs.readFileSync(fixture, 'utf8').replace(/^﻿/, ''));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-walk-'));
  const html = path.join(dir, 'tabs-minimal.html');
  try {
    execFileSync(process.execPath, [path.join(root, 'skills', 'netblueprint-forge', 'scripts', 'build.mjs'), fixture, '-o', html, ...(fontDir ? ['--template', path.join(fontDir, 'template.html')] : [])], { stdio: ['ignore', 'ignore', 'inherit'] });
    const report = runReport(browser, html);
    const wrong = [];
    for (const tab of model.tabs) {
      const t = report.tabs.find((x) => x.tab === tab.name);
      for (const s of tab.steps || []) {
        const w = t && (t.walk || []).find((x) => x.step === s.name);
        const want = (s.packets && s.packets.length ? s.packets : (s.flows || []).map((f) => ({ flow: f }))).map((p) => p.flow);
        if (!w || w.named !== !!(s.packets && s.packets.length) || JSON.stringify(w.packets) !== JSON.stringify(want)) wrong.push(`${tab.name}/${s.name}: ${w ? JSON.stringify(w.packets) : 'missing'} (expected ${JSON.stringify(want)})`);
      }
    }
    const fallback = model.tabs.flatMap((tab) => (tab.steps || []).filter((s) => (s.flows || []).length && !(s.packets || []).length));
    if (!wrong.length && fallback.length) console.log(`PASS  a step with flows and no packets sends one packet per flow (${fallback.length} such steps in tabs-minimal)`);
    else { console.log(`FAIL  walkthrough packets: ${wrong.join('; ') || 'the fixture has no step without packets'}`); failures++; }
  } catch (e) { console.log(`FAIL  walkthrough packets: ${e.message}`); failures++; code = code || 2; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
if (fontDir) fs.rmSync(fontDir, { recursive: true, force: true });
if (args.includes('--update') && !fontDir) { fs.writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8' }); console.log(`baseline written: ${path.relative(root, baselinePath)}`); }
console.log(`${failures ? failures + ' example(s) failed' : 'all examples passed'} (browser: ${path.basename(browser)}${hardOnly ? '; hard checks only, baseline not compared' : ''}${font ? `; font "${font}"` : ''})`);
process.exit(code || (failures ? 1 : 0));
