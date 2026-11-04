// Reports check: report.mjs writes the three views with the sections and counts the model warrants, and portfolio.mjs
// lists every example with the right numbers. No browser, no network; temporary folders only.
//   node tests/check_reports.mjs
// Exit 0 pass, 1 fail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { report, gather } from '../skills/netblueprint-forge/scripts/report.mjs';
import { findModels, rowFor, formatMarkdown } from '../skills/netblueprint-forge/scripts/portfolio.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
let fails = 0;
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => { console.log('FAIL  ' + m); fails++; };
const section = (text, heading) => { const i = text.indexOf(heading + '\n'); if (i < 0) return ''; const rest = text.slice(i + heading.length); const j = rest.indexOf('\n## '); return j < 0 ? rest : rest.slice(0, j); };

// 1. The hub-spoke document: every section of the three views, with the counts the model holds
const hubFile = path.join(root, 'examples', 'azure-hub-spoke', 'azure-hub-spoke.model.json');
const hub = read(hubFile);
const G = gather(hub);
const all = report(hub, 'all');
const sections = ['## Risk at a glance', '## Open threats, highest current rating first', '## Attack paths', '## Accepted risks', '## Requirements and controls by status', '## Policy', '# Developer view', '## Planned and in-progress controls, by owner', '## Suggested mitigations not yet converted into controls', '## Open threats with no planned control', '## What the validator still warns about', '# Audit view', '## Verified controls and their evidence', '## Implemented but not verified', '## Requirements by framework clause', '## Requirements', '## Every threat and its controls'];
const absent = sections.filter((s) => !all.includes(s + '\n'));
if (!absent.length) pass(`all three views present with ${sections.length} sections`); else fail(`missing sections: ${absent.join(', ')}`);
if (all.startsWith('# ' + hub.meta.title)) pass('the document opens with the model title'); else fail('the document does not open with the model title');
const threatRows = section(all, '## Every threat and its controls').split('\n').filter((l) => /^\| \d+ \| THR-/.test(l)).length;
if (threatRows === G.threats.length) pass(`the audit view lists every live threat (${threatRows})`); else fail(`audit view lists ${threatRows} threats, model has ${G.threats.length}`);
const verifiedRows = section(all, '## Verified controls and their evidence').split('\n').filter((l) => /^\| CTL-/.test(l)).length;
const verified = G.controls.filter(({ c }) => c.status === 'verified').length;
if (verifiedRows === verified) pass(`the audit view lists every verified control (${verified}) with its evidence`); else fail(`verified controls: ${verifiedRows} listed, ${verified} in the model`);
const clauseRows = section(all, '## Requirements by framework clause').split('\n').filter((l) => /^\| [a-z0-9][a-z0-9.-]* \| /.test(l)).length;
const clauses = G.reqs.reduce((n, { r }) => n + (r.frameworks || []).length, 0) + G.controls.reduce((n, { c }) => n + (c.frameworks || []).length, 0);
if (clauseRows === clauses) pass(`every framework clause is listed (${clauses})`); else fail(`framework clauses: ${clauseRows} listed, ${clauses} in the model`);
const execOnly = report(hub, 'exec');
if (execOnly.includes('## Risk at a glance') && !execOnly.includes('# Developer view') && !execOnly.includes('## Verified controls')) pass('--kind exec holds only the executive view'); else fail('--kind exec holds more than the executive view');
const dev = report(hub, 'developer');
const planned = G.controls.filter(({ c }) => ['proposed', 'planned', 'in-progress'].includes(c.status));
const plannedRows = dev.split('\n').filter((l) => /^\| CTL-/.test(l)).length;
if (plannedRows === planned.length) pass(`the developer view lists every planned control (${planned.length})`); else fail(`planned controls: ${plannedRows} listed, ${planned.length} in the model`);
if (!/\|\s*undefined\s*\|/.test(all) && !all.includes('[object Object]') && !all.includes('NaN')) pass('no undefined, object or NaN leaked into the tables'); else fail('a table cell shows undefined, [object Object] or NaN');

// 2. Every example renders all three views without throwing, and the policy section is there
for (const ex of ['entra-app-proxy', 'partner-portal-tabs', 'aws-three-tier', 'gcp-serverless-web']) {
  try { const t = report(read(path.join(root, 'examples', ex, `${ex}.model.json`)), 'all'); if (t.includes('## Policy')) pass(`${ex}: report renders (${t.split('\n').length} lines)`); else fail(`${ex}: no policy section`); }
  catch (e) { fail(`${ex}: report threw ${e.message}`); }
}

// 3. Portfolio over the examples folder: five rows, the right counts, totals, and a Markdown table that parses
const files = findModels([path.join(root, 'examples')]);
if (files.length === 5) pass('portfolio finds the five example models (archive folders skipped)'); else fail(`portfolio found ${files.length} model(s): ${files.map((f) => path.basename(f)).join(', ')}`);
const rows = files.map(rowFor);
const hubRow = rows.find((r) => r.file === path.resolve(hubFile));
if (hubRow && !hubRow.error && hubRow.threats === G.threats.length && hubRow.attack_paths === G.paths.length && hubRow.requirements === G.reqs.length && hubRow.diagrams === 2 && hubRow.scenarios === 1 && hubRow.validator_errors === 0) pass(`hub-spoke row: ${hubRow.threats} threats, ${hubRow.attack_paths} paths, ${hubRow.requirements} requirements, 2 diagrams (1 what-if)`);
else fail(`hub-spoke row wrong: ${JSON.stringify(hubRow)}`);
if (rows.every((r) => !r.error && r.validator_errors === 0 && typeof r.policy_failures === 'number')) pass('every example row validates and carries a policy result'); else fail('an example row has an error or no policy result');
const md = formatMarkdown(rows, path.join(root, 'examples'));
const lines = md.split('\n').filter((l) => l.startsWith('|'));
const widths = new Set(lines.map((l) => l.split(' | ').length));
if (lines.length === rows.length + 3 && widths.size === 1) pass(`the Markdown table has ${rows.length} rows plus header and totals, all of one width`); else fail(`table rows ${lines.length}, widths ${[...widths].join('/')}`);

// 4. A folder with no model: findModels returns nothing (the CLI exits 2)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-portfolio-'));
try { if (findModels([tmp]).length === 0) pass('an empty folder yields no rows'); else fail('an empty folder yielded rows'); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(fails ? `check_reports: ${fails} failure(s)` : 'check_reports: all checks passed');
process.exit(fails ? 1 : 0);
