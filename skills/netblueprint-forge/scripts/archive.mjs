#!/usr/bin/env node
/**
 * archive.mjs — keep a revision of a model (and its rendered HTML) before it changes.
 *
 *   node scripts/archive.mjs <model.json> [--note "what is about to change"] [--bump patch|minor|major] [--html path] [--dry-run]
 *     Copies <model> and its HTML into <dir>/archive/ as <name>-v<version>_<timestamp>.*, then bumps
 *     meta.version (patch by default), sets meta.date to today, stores the note in meta.revision_note,
 *     writes the model back, and opens a new entry in archive/CHANGELOG.md.
 *
 *   node scripts/archive.mjs <model.json> --diff
 *     After the edit: compares the model with its latest snapshot and appends the differences,
 *     element by element, under the open CHANGELOG entry.
 *
 * Rule for the skill: never edit a model without running the first form first.
 * Node 18+, no dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const has = (f) => args.includes(f);
const file = args.find((a, i) => !a.startsWith('-') && !['--note', '--bump', '--html'].includes(args[i - 1]));

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}${z(d.getMinutes())}`; };
const today = () => new Date().toISOString().slice(0, 10);
export function bump(version, part = 'patch') {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || '0.0.0'); if (!m) throw new Error(`meta.version "${version}" is not MAJOR.MINOR.PATCH`);
  let [maj, min, pat] = m.slice(1).map(Number);
  if (part === 'major') { maj++; min = 0; pat = 0; } else if (part === 'minor') { min++; pat = 0; } else pat++;
  return `${maj}.${min}.${pat}`;
}
const baseName = (p) => path.basename(p).replace(/\.model\.json$|\.json$/i, '');

/* ---------- diff ---------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function diffList(prev, next, key, what, lines, labelOf = (x) => x.label || x.title || x.name || x.id) {
  const P = new Map((prev || []).map((x) => [x[key], x])), N = new Map((next || []).map((x) => [x[key], x]));
  N.forEach((x, k) => { if (!P.has(k)) lines.push(`- added ${what} \`${k}\`${labelOf(x) && labelOf(x) !== k ? ` (${labelOf(x)})` : ''}`); });
  P.forEach((x, k) => { if (!N.has(k)) lines.push(`- removed ${what} \`${k}\``); });
  N.forEach((x, k) => { const p = P.get(k); if (!p || same(p, x)) return; const keys = [...new Set([...Object.keys(p), ...Object.keys(x)])].filter((f) => !same(p[f], x[f])); lines.push(`- changed ${what} \`${k}\`: ${keys.join(', ')}`); });
}
const COLLECTIONS = ['zones', 'nodes', 'flows', 'phases', 'steps', 'threats', 'controls', 'attack_paths'];
export function diffCollections(prev, next, lines, pre = '') {
  diffList(prev.zones, next.zones, 'name', pre + 'zone', lines);
  const apps = (m) => (m.zones || []).flatMap((z) => (z.appliances || []).map((a) => ({ ...a, _zone: z.name })));
  diffList(apps(prev), apps(next), 'name', pre + 'appliance', lines);
  diffList(prev.nodes, next.nodes, 'name', pre + 'node', lines);
  const comps = (m) => (m.nodes || []).flatMap((n) => (n.components || []).map((c) => ({ ...c, _ref: `${n.name}/${c.name}` })));
  diffList(comps(prev), comps(next), '_ref', pre + 'component', lines);
  diffList(prev.flows, next.flows, 'name', pre + 'flow', lines);
  diffList(prev.phases, next.phases, 'name', pre + 'phase', lines);
  diffList(prev.steps, next.steps, 'name', pre + 'step', lines);
  diffList(prev.threats, next.threats, 'id', pre + 'threat', lines);
  diffList(prev.controls, next.controls, 'id', pre + 'control', lines);
  diffList(prev.attack_paths, next.attack_paths, 'id', pre + 'attack path', lines);
}
export function diffModels(prev, next) {
  const lines = [];
  const metaKeys = [...new Set([...Object.keys(prev.meta || {}), ...Object.keys(next.meta || {})])].filter((k) => !['version', 'date', 'revision_note'].includes(k) && !same((prev.meta || {})[k], (next.meta || {})[k]));
  if (metaKeys.length) lines.push(`- changed meta: ${metaKeys.join(', ')}`);
  if (!same(prev.settings, next.settings)) lines.push('- changed settings');
  diffList(prev.auth_types, next.auth_types, 'id', 'auth type', lines);
  diffList(prev.layers, next.layers, 'name', 'layer', lines);
  if (prev.tabs || next.tabs) {
    // tabs: added / removed / renamed at tab level, then each tab's collections with the tab name as prefix
    const shell = (t) => { const s = { ...t }; COLLECTIONS.forEach((k) => delete s[k]); return s; };
    diffList((prev.tabs || []).map(shell), (next.tabs || []).map(shell), 'name', 'tab', lines);
    (next.tabs || []).forEach((t) => { const p = (prev.tabs || []).find((x) => x.name === t.name); if (p) diffCollections(p, t, lines, `tab ${t.name} › `); });
  } else diffCollections(prev, next, lines);
  return lines;
}

/* ---------- snapshot / log ---------- */
function latestSnapshot(dir, name) {
  if (!fs.existsSync(dir)) return null;
  const re = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-v(\\d+\\.\\d+\\.\\d+)_(\\d{4}-\\d{2}-\\d{2}T\\d{4})\\.model\\.json$`);
  const found = fs.readdirSync(dir).map((f) => { const m = re.exec(f); return m ? { f, version: m[1], stamp: m[2] } : null; }).filter(Boolean).sort((a, b) => a.stamp.localeCompare(b.stamp) || a.version.localeCompare(b.version, undefined, { numeric: true }));
  return found.length ? found[found.length - 1] : null;
}

export function snapshot(modelPath, { note = '', part = 'patch', htmlPath = null, dryRun = false } = {}) {
  const dir = path.dirname(path.resolve(modelPath)), name = baseName(modelPath), arch = path.join(dir, 'archive');
  const raw = fs.readFileSync(modelPath, 'utf8').replace(/^﻿/, '');
  const model = JSON.parse(raw);
  const version = model.meta && model.meta.version; if (!version) throw new Error('meta.version is missing');
  const st = stamp();
  const base = `${name}-v${version}_${st}`;
  const html = htmlPath || path.join(dir, `${name}.html`);
  const actions = [`copy ${path.basename(modelPath)} → archive/${base}.model.json`];
  if (fs.existsSync(html)) actions.push(`copy ${path.basename(html)} → archive/${base}.html`);
  const next = bump(version, part);
  actions.push(`meta.version ${version} → ${next}, meta.date → ${today()}${note ? `, revision_note set` : ''}`);
  actions.push(`append entry "v${next}" to archive/CHANGELOG.md`);
  if (dryRun) return { actions, next, dryRun: true };
  fs.mkdirSync(arch, { recursive: true });
  fs.writeFileSync(path.join(arch, `${base}.model.json`), raw, 'utf8');
  if (fs.existsSync(html)) fs.copyFileSync(html, path.join(arch, `${base}.html`));
  model.meta.version = next; model.meta.date = today(); if (note) model.meta.revision_note = note;
  fs.writeFileSync(modelPath, JSON.stringify(model, null, 2) + '\n', 'utf8');
  const log = path.join(arch, 'CHANGELOG.md');
  const head = fs.existsSync(log) ? '' : `# ${model.meta.title || name}: change log\n\nOne entry per revision. Snapshots live next to this file; \`archive.mjs --diff\` fills in the element-by-element changes after each edit.\n`;
  fs.appendFileSync(log, `${head}\n## v${next} · ${today()} · ${note || '(no note)'}\n\nSnapshot of v${version} saved as \`${base}.model.json\`${fs.existsSync(html) ? ` and \`${base}.html\`` : ''}.\n`, 'utf8');
  return { actions, next, snapshot: `${base}.model.json` };
}

export function logDiff(modelPath, { dryRun = false } = {}) {
  const dir = path.dirname(path.resolve(modelPath)), name = baseName(modelPath), arch = path.join(dir, 'archive');
  const latest = latestSnapshot(arch, name);
  if (!latest) throw new Error(`no snapshot for ${name} in ${arch}; run archive.mjs without --diff before editing`);
  const prev = readJson(path.join(arch, latest.f)), next = readJson(modelPath);
  const lines = diffModels(prev, next);
  const text = lines.length ? lines.join('\n') : '- no element changes detected';
  if (!dryRun) fs.appendFileSync(path.join(arch, 'CHANGELOG.md'), `\nChanges since v${latest.version}:\n\n${text}\n`, 'utf8');
  return { since: latest.version, lines };
}

if (isMain) {
  if (!file || has('-h') || has('--help')) { console.error('usage: node scripts/archive.mjs <model.json> [--note "..."] [--bump patch|minor|major] [--html path] [--dry-run]\n       node scripts/archive.mjs <model.json> --diff [--dry-run]'); process.exit(file ? 0 : 2); }
  try {
    if (has('--diff')) {
      const r = logDiff(file, { dryRun: has('--dry-run') });
      console.log(`changes since v${r.since}:${has('--dry-run') ? ' (dry run, not written)' : ''}`);
      (r.lines.length ? r.lines : ['- no element changes detected']).forEach((l) => console.log(l));
    } else {
      const r = snapshot(file, { note: opt('--note') || '', part: opt('--bump') || 'patch', htmlPath: opt('--html'), dryRun: has('--dry-run') });
      r.actions.forEach((a) => console.log((r.dryRun ? 'would ' : '') + a));
      if (!r.dryRun) console.log(`now at v${r.next}; make the change, then validate --fix, build, and archive.mjs --diff`);
    }
  } catch (e) { console.error(`archive: ${e.message}`); process.exit(2); }
}
