// Attribute display check: the switches in settings.attributes (and an attributes.json beside the model) hide rows of the page's
// Attributes card, and nothing else.
//   1. the renderer's fixed row ids and scripts/attributes.mjs agree, so the listing names exactly what the card can show;
//   2. the validator warns on a switch that names nothing, the schema rejects a malformed one, and attributes.json merges by union;
//   3. with a browser: a built page's self-check report lists, per element, the ids its card shows and hides; the hub-spoke example hides
//      nothing by default, and a copy with switches in its model and in an attributes.json beside it hides exactly those rows.
//   node tests/check_attributes.mjs [--browser <exe>]
// Parts 1 and 2 need no browser; part 3 is skipped with a notice when none is found. Exit 0 pass, 1 fail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KINDS, knownIds, allKnown, attributesCheck, mergeAttributes, matches } from '../skills/netblueprint-forge/scripts/attributes.mjs';
import { validateModel } from '../skills/netblueprint-forge/scripts/validate.mjs';
import { findBrowser, runReport } from '../skills/netblueprint-forge/scripts/check.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skill = path.join(root, 'skills', 'netblueprint-forge');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
let fails = 0;
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => { console.log('FAIL  ' + m); fails++; };

// 1. the template's fixed row ids and the catalogue agree
const tpl = fs.readFileSync(path.join(skill, 'assets', 'template', 'template.html'), 'utf8');
const inTemplate = new Set([...tpl.matchAll(/\{id:'([a-z0-9_.]+)',k:'/g)].map((m) => m[1]));
for (const m of tpl.matchAll(/,'(risk\.(?:inherent|residual|projected))'\)/g)) inTemplate.add(m[1]);
if (tpl.includes("{id:'custom.'+k,k:'Custom · '+k")) inTemplate.add('custom.*');
const explicitAll = new Set(Object.values(allKnown()).flat());
const unlisted = [...inTemplate].filter((id) => !explicitAll.has(id));
if (!unlisted.length) pass(`every fixed row id in the renderer (${inTemplate.size}) is in the catalogue`); else fail(`renderer row ids missing from scripts/attributes.mjs: ${unlisted.join(', ')}`);
const catalogueExplicit = KINDS.filter((k) => k !== 'all').flatMap((k) => knownIds(k)).filter((id) => !id.includes('.') || /^(risk|treatment|adversary\.actor_node)/.test(id) || id === 'custom.*');
const stale = [...new Set(catalogueExplicit)].filter((id) => !inTemplate.has(id) && !/^(custom)$/.test(id) && !schemaField(id));
function schemaField(id) { // a plain field the renderer flattens from the model is not a fixed row; only fixed rows must appear as literals
  const fixed = new Set(['name', 'type', 'icon', 'sub', 'info', 'scope', 'host', 'ports', 'zone', 'instances', 'components', 'layers', 'flows', 'threats', 'controls', 'boundary_of', 'edge', 'filters', 'serves', 'flows_through', 'kind', 'inside', 'trust_boundary', 'appliances', 'zones', 'nodes', 'source', 'destination', 'direction', 'auth', 'label', 'protocol', 'encrypted', 'blocked_reason', 'through', 'id', 'title', 'status', 'description', 'stride', 'linddun', 'attack_tactics', 'vulnerability', 'consequence', 'targets', 'boundary_crossed', 'requirements', 'suggested', 'attack_paths', 'entry', 'hops', 'impact', 'assets_at_risk', 'breaks_at', 'mitre_attack', 'statement', 'priority', 'owner', 'due_date', 'frameworks', 'depends_on', 'depended_on_by']);
  return !fixed.has(id) && !id.startsWith('risk.') && !id.startsWith('treatment.') && id !== 'adversary.actor_node';
}
if (!stale.length) pass('every fixed row the catalogue lists exists in the renderer'); else fail(`catalogue rows the renderer no longer has: ${stale.join(', ')}`);
const counts = Object.fromEntries(KINDS.filter((k) => k !== 'all').map((k) => [k, knownIds(k).length]));
if (Object.values(counts).every((n) => n >= 10) && knownIds('node').filter((id) => id.startsWith('profile.')).length >= 5 && knownIds('flow').filter((id) => id.includes('.')).length >= 5 && knownIds('threat').filter((id) => id.startsWith('adversary.')).length >= 5) pass(`the listing derives field paths from the schema (${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ')})`); else fail(`the listing looks incomplete: ${JSON.stringify(counts)}`);
if (matches('cloud.*', 'cloud.exposure') && matches('cloud.*', 'cloud') && !matches('cloud.*', 'cloudy') && matches('encrypted', 'encrypted') && !matches('encrypted', 'encrypted.x')) pass('a hide entry matches its id, and a group entry matches the group and everything under it'); else fail('matching rules');

// 2. the validator and the merge
const minimal = read(path.join(root, 'tests', 'fixtures', 'minimal.model.json'));
const withSwitches = JSON.parse(JSON.stringify(minimal));
withSwitches.settings = Object.assign({}, withSwitches.settings, { attributes: { all: { hide: ['custom.*'] }, node: { hide: ['cloud.*', 'no_such_row'] }, flow: { hide: ['transport.*', 'encrypted'] }, threat: { hide: ['adversary.resources'] } } });
const res = validateModel(withSwitches);
const warned = (res.warnings || []).filter((w) => w.includes('settings.attributes'));
if (!res.errors.length && warned.length === 1 && warned[0].includes('"no_such_row"') && warned[0].includes('node')) pass('valid switches pass, and the one that names nothing draws a warning that names it'); else fail(`validator: errors ${JSON.stringify(res.errors)} warnings ${JSON.stringify(warned)}`);
const direct = attributesCheck({ settings: { attributes: { all: { hide: ['custom.*', 'profile.*', 'nothing.*'] }, widget: { hide: ['x'] } } } });
if (direct.length === 2 && direct.some((w) => w.includes('"widget"')) && direct.some((w) => w.includes('"nothing.*"'))) pass('attributesCheck flags an unknown kind and an unknown group, and accepts custom.* and profile.*'); else fail(`attributesCheck: ${JSON.stringify(direct)}`);
const bad = JSON.parse(JSON.stringify(minimal)); bad.settings = Object.assign({}, bad.settings, { attributes: { node: { hide: ['Bad Id'] }, widget: { hide: ['x'] } } });
const resBad = validateModel(bad);
if (resBad.errors.length >= 2 && resBad.stage === 'schema') pass('the schema rejects a malformed id and an unknown kind'); else fail(`schema accepted bad switches: ${JSON.stringify(resBad.errors)}`);
const merged = mergeAttributes({ node: { hide: ['cloud.*'] } }, { attributes: { node: { hide: ['cloud.*', 'profile.*'] }, all: { hide: ['custom.*'] } } });
if (JSON.stringify(merged) === JSON.stringify({ node: { hide: ['cloud.*', 'profile.*'] }, all: { hide: ['custom.*'] } })) pass('attributes.json merges by union, wrapped or bare'); else fail(`merge: ${JSON.stringify(merged)}`);

// 3. the page: what the card shows and hides, from the self-check report
const bi = process.argv.indexOf('--browser');
let browser = null;
try { browser = await findBrowser(bi >= 0 ? process.argv[bi + 1] : undefined); } catch (e) { console.log(`SKIP  no browser for the page check (${e.message}); parts 1 and 2 ran`); }
if (browser) {
  const hub = path.join(root, 'examples', 'azure-hub-spoke', 'azure-hub-spoke.html');
  const plain = runReport(browser, hub);
  const tab0 = plain.tabs[0] || {};
  const hiddenAnywhere = Object.values(tab0.attributes || {}).flatMap((m) => Object.values(m)).flatMap((e) => e.hidden || []);
  const sampled = Object.values(tab0.attributes || {}).reduce((n, m) => n + Object.keys(m).length, 0);
  if (tab0.attributes && sampled > 40 && !hiddenAnywhere.length && plain.requirements && plain.requirements.hidden.length === 0) pass(`the hub-spoke page hides nothing by default (${sampled} elements sampled, requirement ${plain.requirements.ref})`); else fail(`default page: attributes sampled ${sampled}, hidden ${hiddenAnywhere.length}, requirements ${JSON.stringify(plain.requirements)}`);
  const node0 = (tab0.attributes || { node: {} }).node['app-service'] || { shown: [] };
  if (node0.shown.includes('name') && node0.shown.includes('zone') && node0.shown.some((id) => id.startsWith('cloud.')) && node0.shown.some((id) => id.startsWith('custom.'))) pass('App Service shows its cloud and custom rows by default'); else fail(`App Service rows: ${JSON.stringify(node0.shown)}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-attrs-'));
  try {
    const model = read(path.join(root, 'examples', 'azure-hub-spoke', 'azure-hub-spoke.model.json'));
    model.settings = Object.assign({}, model.settings, { attributes: { node: { hide: ['cloud.*'] }, component: { hide: ['ports'] }, appliance: { hide: ['flows_through'] }, zone: { hide: ['inside'] }, flow: { hide: ['encrypted'] }, threat: { hide: ['adversary.*', 'treatment.decision'] }, path: { hide: ['hops'] }, requirement: { hide: ['frameworks'] } } });
    const modelPath = path.join(tmp, 'hub.model.json');
    fs.writeFileSync(modelPath, JSON.stringify(model));
    fs.writeFileSync(path.join(tmp, 'attributes.json'), JSON.stringify({ attributes: { all: { hide: ['custom.*'] } } }));
    const out = execFileSync(process.execPath, [path.join(skill, 'scripts', 'build.mjs'), modelPath], { encoding: 'utf8' });
    if (/attributes\.json: 1 display switch\(es\) merged/.test(out)) pass('build.mjs merges attributes.json beside the model'); else fail(`build output: ${out.trim().split('\n').slice(0, 3).join(' | ')}`);
    const embedded = JSON.parse(fs.readFileSync(path.join(tmp, 'hub.html'), 'utf8').match(/<script id="nb-model"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/^\s*\/\*__MODEL_JSON__\*\//, ''));
    if (embedded.settings.attributes.all && embedded.settings.attributes.all.hide.includes('custom.*') && embedded.settings.attributes.node.hide.includes('cloud.*') && read(modelPath).settings.attributes.all === undefined) pass('the page carries the merged switches and the model file is unchanged'); else fail('the merged switches are not in the page as expected');
    const rep = runReport(browser, path.join(tmp, 'hub.html'));
    const A = rep.tabs[0].attributes;
    const check = (kind, ref, hiddenPrefixes, shownIds) => {
      const e = A[kind][ref]; if (!e) { fail(`${kind} ${ref} was not sampled`); return; }
      const badShown = e.shown.filter((id) => hiddenPrefixes.some((p) => matches(p, id)));
      const missing = hiddenPrefixes.filter((p) => !e.hidden.some((id) => matches(p, id)));
      const lost = shownIds.filter((id) => !e.shown.includes(id));
      if (!badShown.length && !missing.length && !lost.length) pass(`${kind} ${ref}: hides ${hiddenPrefixes.join(', ')} and still shows ${shownIds.join(', ')}`);
      else fail(`${kind} ${ref}: shown but hidden ${badShown.join(', ') || 'none'}; switches without effect ${missing.join(', ') || 'none'}; lost ${lost.join(', ') || 'none'}`);
    };
    check('node', 'app-service', ['cloud.*', 'custom.*'], ['name', 'type', 'zone', 'depends_on']);
    check('component', 'app-service/api', ['ports'], ['name', 'host']);
    const appl = Object.keys(A.appliance)[0]; check('appliance', appl, ['flows_through'], ['name', 'boundary_of']);
    check('zone', 'snet-app', ['inside'], ['name', 'kind', 'nodes']);
    const encFlow = Object.entries(A.flow).find(([, e]) => e.hidden.includes('encrypted') || e.shown.includes('encrypted'));
    if (encFlow) check('flow', encFlow[0], ['encrypted'], ['name', 'source', 'destination']); else fail('no flow carries an encrypted row');
    check('threat', 'THR-0001', ['adversary.*', 'treatment.decision'], ['id', 'title', 'stride', 'risk.residual', 'treatment.current_controls']);
    check('path', 'AP-0001', ['hops'], ['id', 'title', 'entry']);
    const rq = rep.requirements;
    if (rq && rq.ref === 'REQ-0001' && rq.hidden.includes('frameworks') && !rq.shown.includes('frameworks') && rq.shown.includes('statement')) pass('requirement REQ-0001: hides frameworks and still shows its statement'); else fail(`requirement: ${JSON.stringify(rq)}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

console.log(fails ? `check_attributes: ${fails} failure(s)` : 'check_attributes: all checks passed');
process.exit(fails ? 1 : 0);
