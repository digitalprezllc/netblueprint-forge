#!/usr/bin/env node
// doctor: an environment report for a bug report or a first install. Offline: it reads this folder and the machine, calls nothing.
//
//   node scripts/doctor.mjs            the report as text
//   node scripts/doctor.mjs --json     the same as JSON
//
// Reports Node, the skill and renderer versions and whether they agree, the schema and its published address, the icon indexes
// and the crosswalk, a Chromium-based browser if one is found (for check.mjs and screenshot.mjs), the skill links each tool reads
// in this folder and in the home folder, and write access here. Exit 0 when nothing blocks the skill; 1 when something does
// (Node too old, a missing schema or template). A missing browser is a note, not a failure.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { versions } from './nb.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.resolve(here, '..');
const json = process.argv.includes('--json');
const rep = { ok: true, problems: [], notes: [], node: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, skill_folder: skill };

const major = +process.versions.node.split('.')[0];
if (major < 18) { rep.ok = false; rep.problems.push(`Node ${process.version} is older than 18; the scripts need 18 or later`); }

// versions
try {
  const v = versions(); rep.versions = v;
  if (v.declared !== v.renderer) { rep.ok = false; rep.problems.push(`SKILL.md declares renderer ${v.declared} but the template is ${v.renderer}`); }
} catch (e) { rep.ok = false; rep.problems.push(`versions unreadable: ${e.message}`); }

// schema and template
const schemaPath = path.join(skill, 'assets', 'schema', 'netblueprint.schema.json');
try {
  const s = JSON.parse(fs.readFileSync(schemaPath, 'utf8').replace(/^﻿/, ''));
  rep.schema = { file: 'assets/schema/netblueprint.schema.json', id: s.$id || null, defs: Object.keys(s.$defs || {}).length };
} catch (e) { rep.ok = false; rep.problems.push(`schema missing or unreadable: ${e.message}`); }
if (!fs.existsSync(path.join(skill, 'assets', 'template', 'template.html'))) { rep.ok = false; rep.problems.push('assets/template/template.html is missing; build.mjs cannot render'); }

// icon indexes and the crosswalk
try {
  const dir = path.join(skill, 'assets', 'icons');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  rep.icon_indexes = files.map((f) => { try { const idx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '')); const n = Object.keys(idx.icons || idx.entries || idx).length; return `${f} (${n})`; } catch { return `${f} (unreadable)`; } });
  if (!files.length) rep.notes.push('no icon indexes under assets/icons: pages fall back to the built-in line icons');
} catch (e) { rep.notes.push(`icon indexes: ${e.message}`); }
try {
  const cw = JSON.parse(fs.readFileSync(path.join(skill, 'assets', 'frameworks', 'crosswalk.json'), 'utf8').replace(/^﻿/, ''));
  rep.crosswalk = { frameworks: Object.keys(cw.frameworks || {}).length, controls: Object.keys(cw.controls || {}).length };
} catch (e) { rep.notes.push(`crosswalk missing: coverage.mjs derives nothing (${e.message})`); }

// a browser for the geometry check and screenshots
try {
  const { findBrowser } = await import('./check.mjs');
  const b = await findBrowser(process.env.NB_BROWSER);
  rep.browser = b;
} catch (e) { rep.browser = null; rep.notes.push(`no Chromium-based browser found (${e.message}); check.mjs and screenshot.mjs are unavailable, everything else works`); }

// the links each tool reads, here and in the home folder
const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const mine = real(skill);
rep.links = [];
for (const base of [process.cwd(), os.homedir()]) {
  for (const rel of ['.agents/skills/netblueprint-forge', '.claude/skills/netblueprint-forge', '.kiro/skills/netblueprint-forge']) {
    const p = path.join(base, rel);
    if (!fs.existsSync(p)) continue;
    const target = real(p);
    rep.links.push({ path: p, points_here: !!(target && mine && target.toLowerCase() === mine.toLowerCase()), target });
  }
}
if (!rep.links.length) rep.notes.push('no skill links found in this folder or the home folder (platforms/install.sh or install.ps1 create them); a tool reads the skill from wherever it was copied');

// write access where models would be written
try { fs.accessSync(process.cwd(), fs.constants.W_OK); rep.writable_cwd = true; } catch { rep.writable_cwd = false; rep.notes.push(`${process.cwd()} is not writable; models and pages cannot be written here`); }

if (json) { console.log(JSON.stringify(rep, null, 2)); process.exit(rep.ok ? 0 : 1); }
const v = rep.versions || {};
console.log(`NetBlueprint Forge doctor`);
console.log(`  Node            ${rep.node} on ${rep.platform}`);
console.log(`  Skill           ${v.skill} at ${rep.skill_folder}`);
console.log(`  Renderer        ${v.renderer}${v.declared !== v.renderer ? ` (SKILL.md says ${v.declared})` : ''}`);
if (rep.schema) console.log(`  Schema          ${rep.schema.defs} definitions; published address ${rep.schema.id}`);
if (rep.icon_indexes) console.log(`  Icon indexes    ${rep.icon_indexes.join(', ') || 'none'}`);
if (rep.crosswalk) console.log(`  Crosswalk       ${rep.crosswalk.frameworks} frameworks, ${rep.crosswalk.controls} SP 800-53 controls`);
console.log(`  Browser         ${rep.browser || 'none found'}`);
for (const l of rep.links) console.log(`  Link            ${l.path} ${l.points_here ? '(this skill)' : `(another copy: ${l.target || 'broken'})`}`);
console.log(`  Writable here   ${rep.writable_cwd ? 'yes' : 'no'}`);
for (const n of rep.notes) console.log(`  Note            ${n}`);
for (const p of rep.problems) console.log(`  PROBLEM         ${p}`);
console.log(rep.ok ? (rep.problems.length ? '' : '  No problems found.') : '  Fix the problems above before using the skill.');
process.exit(rep.ok ? 0 : 1);
