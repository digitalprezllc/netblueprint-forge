// Coverage check: the framework crosswalk is well formed and free of what it must not carry, every NIST control the examples cite
// is in it, coverage.mjs derives the right clauses for the hub-spoke model, and a frameworks.json beside a model extends it.
//   node tests/check_coverage.mjs
// No browser, no network; temporary folders only. Exit 0 pass, 1 fail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CROSSWALK_PATH, loadCrosswalk, coverageOf, formatMarkdown } from '../skills/netblueprint-forge/scripts/coverage.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
let fails = 0;
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => { console.log('FAIL  ' + m); fails++; };

// 1. The crosswalk: shape, patterns, internal consistency, and no CIS (its licence forbids redistribution here)
const cw = read(CROSSWALK_PATH);
if (cw.netblueprint_crosswalk === 1 && cw.frameworks && cw.clauses && cw.controls && typeof cw.note === 'string' && cw.note.length > 100) pass('crosswalk.json has the expected shape and a note'); else fail('crosswalk.json shape');
const NIST = /^(AC|AT|AU|CA|CM|CP|IA|IR|MA|MP|PE|PL|PM|PS|PT|RA|SA|SC|SI|SR)-[0-9]+(\([0-9]+\))?$/;
const badIds = Object.keys(cw.controls).filter((id) => !NIST.test(id));
if (!badIds.length) pass(`${Object.keys(cw.controls).length} NIST control ids, all well formed`); else fail(`malformed control ids: ${badIds.join(', ')}`);
const fwIds = Object.keys(cw.frameworks);
const unknownFw = [], danglingClauses = [];
for (const [id, entry] of Object.entries(cw.controls)) {
  if (!entry.title) fail(`${id} has no title`);
  for (const [fw, clauses] of Object.entries(entry)) {
    if (fw === 'title') continue;
    if (!fwIds.includes(fw)) unknownFw.push(`${id}:${fw}`);
    for (const c of clauses) if (!(cw.clauses[fw] || {})[c]) danglingClauses.push(`${id}:${fw}:${c}`);
  }
}
if (!unknownFw.length) pass('every control maps only to frameworks the crosswalk declares'); else fail(`controls mapped to undeclared frameworks: ${unknownFw.slice(0, 5).join(', ')}`);
if (!danglingClauses.length) pass('every clause a control maps to has a title in the clauses table'); else fail(`clauses without a title: ${danglingClauses.slice(0, 8).join(', ')}${danglingClauses.length > 8 ? ' …' : ''}`);
const cis = JSON.stringify({ frameworks: cw.frameworks, clauses: cw.clauses, controls: cw.controls }).match(/\bCIS\b|cis-controls|"cis-/g); // the note may say why CIS is absent; the data may not carry it
if (!cis) pass('no CIS Controls mapping in the crosswalk (its licence does not allow redistribution here)'); else fail(`the crosswalk mentions CIS: ${cis.length} time(s)`);
if (fwIds.every((id) => cw.frameworks[id].title && cw.frameworks[id].publisher && cw.frameworks[id].terms)) pass(`${fwIds.length} frameworks, each with title, publisher and terms`); else fail('a framework lacks title, publisher or terms');

// 2. Every NIST id the examples cite is in the crosswalk, so coverage can derive the other frameworks for them
const examples = ['entra-app-proxy', 'azure-hub-spoke', 'partner-portal-tabs', 'aws-three-tier', 'gcp-serverless-web'];
const cited = new Set();
for (const ex of examples) { const m = read(path.join(root, 'examples', ex, `${ex}.model.json`)); (m.tabs || [m]).forEach((s) => (s.controls || []).forEach((c) => (c.nist_800_53 || []).forEach((id) => cited.add(id)))); }
const notInCw = [...cited].filter((id) => !cw.controls[id]);
if (!notInCw.length) pass(`all ${cited.size} NIST ids the examples cite are in the crosswalk`); else fail(`NIST ids cited by the examples but missing from the crosswalk: ${notInCw.join(', ')}`);

// 3. Coverage of the hub-spoke model: direct and derived links, levels, the Markdown
const hubFile = path.join(root, 'examples', 'azure-hub-spoke', 'azure-hub-spoke.model.json');
const hub = read(hubFile);
const cov = coverageOf(hub, loadCrosswalk(hubFile));
const iso = cov.frameworks['iso-27001-2022'];
if (iso && iso.clauses['A.8.5'] && iso.clauses['A.8.5'].requirements.some((r) => r.id === 'REQ-0001') && iso.clauses['A.8.5'].controls.some((c) => c.id === 'CTL-0001' && c.via !== 'direct')) pass('ISO A.8.5 carries REQ-0001 directly and CTL-0001 through the crosswalk from IA-2(1)'); else fail('ISO A.8.5 coverage is not as expected');
const nist = cov.frameworks['nist-800-53-r5'];
if (nist && nist.clauses['AC-17'] && nist.clauses['AC-17'].controls.some((c) => c.id === 'CTL-0008' && c.via === 'direct') && nist.clauses['AC-17'].title) pass('NIST AC-17 lists CTL-0008 directly, with the control title'); else fail('NIST AC-17 coverage is not as expected');
const pci = cov.frameworks['pci-dss-4.0'];
if (pci && pci.clauses['8.4.2'] && pci.clauses['8.4.2'].level === 2) pass('PCI DSS 8.4.2 is implemented through the MFA controls'); else fail(`PCI DSS 8.4.2: ${pci && pci.clauses['8.4.2'] ? 'level ' + pci.clauses['8.4.2'].level : 'absent'}`);
const levelsOk = Object.values(cov.frameworks).every((fw) => Object.values(fw.clauses).every((cl) => cl.level >= 0 && cl.level <= 3));
if (levelsOk) pass('every clause has a coverage level between none and verified'); else fail('a clause has an out-of-range level');
const md = formatMarkdown(hub, cov, loadCrosswalk(hubFile), { gaps: true });
if (md.includes('## ISO/IEC 27001:2022 Annex A (iso-27001-2022)') && md.includes('via crosswalk') && md.includes('Untouched clauses of iso-27001-2022:') && md.includes('| A.8.5 | Secure authentication |')) pass('the Markdown names the frameworks, marks crosswalk links and lists the gaps'); else fail('the Markdown lacks a framework heading, a crosswalk mark, the gaps or the A.8.5 row');
const one = formatMarkdown(hub, cov, loadCrosswalk(hubFile), { framework: 'soc2-2017' });
if (one.includes('(soc2-2017)') && !one.includes('(iso-27001-2022)')) pass('--framework limits the output to one framework'); else fail('--framework did not limit the output');

// 4. A frameworks.json beside a model extends the crosswalk: a new framework, a clause title, a control mapping
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-coverage-'));
try {
  const modelPath = path.join(tmp, 'hub.model.json');
  fs.writeFileSync(modelPath, JSON.stringify(hub));
  fs.writeFileSync(path.join(tmp, 'frameworks.json'), JSON.stringify({ frameworks: { 'acme-policy': { title: 'Acme Security Policy', publisher: 'Acme', terms: 'internal' } }, clauses: { 'acme-policy': { 'SP-4': 'Administrative access' }, 'iso-27001-2022': { 'A.8.5': 'Secure authentication (as Acme reads it)' } }, controls: { 'AC-17': { 'acme-policy': ['SP-4'] } } }));
  const cw2 = loadCrosswalk(modelPath);
  const cov2 = coverageOf(hub, cw2);
  const acme = cov2.frameworks['acme-policy'];
  if (cw2.local && acme && acme.title === 'Acme Security Policy' && acme.clauses['SP-4'] && acme.clauses['SP-4'].controls.some((c) => c.id === 'CTL-0008') && acme.clauses['SP-4'].title === 'Administrative access') pass('frameworks.json beside the model adds a framework, its clause and a mapping from AC-17'); else fail('frameworks.json was not merged as expected');
  if (cw2.controls['AC-17']['iso-27001-2022'] && cw2.controls['AC-17']['iso-27001-2022'].includes('A.6.7')) pass('the merge keeps the shipped mappings of a control it extends'); else fail('the merge dropped the shipped mappings of AC-17');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

console.log(fails ? `check_coverage: ${fails} failure(s)` : 'check_coverage: all checks passed');
process.exit(fails ? 1 : 0);
