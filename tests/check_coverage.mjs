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

// 1b. SP 800-171 Rev. 2 and CMMC 2.0: the 110 requirements, the CMMC identifiers over them, NIST's mapping inverted
const r171 = cw.clauses['nist-800-171-r2'] || {}, cmmc = cw.clauses['cmmc-2.0'] || {};
const FAM = { '3.1': 'AC', '3.2': 'AT', '3.3': 'AU', '3.4': 'CM', '3.5': 'IA', '3.6': 'IR', '3.7': 'MA', '3.8': 'MP', '3.9': 'PS', '3.10': 'PE', '3.11': 'RA', '3.12': 'CA', '3.13': 'SC', '3.14': 'SI' };
const reqIds = Object.keys(r171);
if (reqIds.length === 110 && reqIds.every((n) => /^3\.(?:[1-9]|1[0-4])\.(?:[1-9]|1\d|2[0-2])$/.test(n) && r171[n].length > 8)) pass('SP 800-171 Rev. 2: 110 requirements, each with a short title'); else fail(`SP 800-171 Rev. 2: ${reqIds.length} requirements`);
const l2 = Object.keys(cmmc).filter((id) => /\.L2-/.test(id)), l1 = Object.keys(cmmc).filter((id) => /\.L1-/.test(id));
const l2Ok = l2.length === 110 && l2.every((id) => { const n = id.split('-')[1]; return r171[n] && id === `${FAM[n.split('.').slice(0, 2).join('.')]}.L2-${n}` && cmmc[id] === r171[n]; });
if (l2Ok) pass('CMMC 2.0: 110 Level 2 identifiers, each the family and number of its SP 800-171 requirement, with the same title'); else fail('CMMC 2.0 Level 2 identifiers do not match SP 800-171');
const L1 = { 'AC.L1-b.1.i': ['3.1.1'], 'AC.L1-b.1.ii': ['3.1.2'], 'AC.L1-b.1.iii': ['3.1.20'], 'AC.L1-b.1.iv': ['3.1.22'], 'IA.L1-b.1.v': ['3.5.1'], 'IA.L1-b.1.vi': ['3.5.2'], 'MP.L1-b.1.vii': ['3.8.3'], 'PE.L1-b.1.viii': ['3.10.1'], 'PE.L1-b.1.ix': ['3.10.3', '3.10.4', '3.10.5'], 'SC.L1-b.1.x': ['3.13.1'], 'SC.L1-b.1.xi': ['3.13.5'], 'SI.L1-b.1.xii': ['3.14.1'], 'SI.L1-b.1.xiii': ['3.14.2'], 'SI.L1-b.1.xiv': ['3.14.4'], 'SI.L1-b.1.xv': ['3.14.5'] };
const l1Ok = l1.length === 15 && Object.entries(L1).every(([id, reqs]) => cmmc[id] && Object.values(cw.controls).every((e) => !(e['cmmc-2.0'] || []).includes(id) || reqs.some((n) => (e['nist-800-171-r2'] || []).includes(n))));
if (l1Ok) pass('CMMC 2.0: the 15 Level 1 identifiers follow Table 2 to 32 CFR 170.15(c)(1)(ii), each on the controls of its SP 800-171 requirements'); else fail('CMMC 2.0 Level 1 identifiers are not as the rule maps them');
const reached = new Set(); for (const e of Object.values(cw.controls)) (e['nist-800-171-r2'] || []).forEach((n) => reached.add(n));
const unreached = reqIds.filter((n) => !reached.has(n));
if (unreached.length === 1 && unreached[0] === '3.13.14') pass('every SP 800-171 requirement except 3.13.14 (SC-19, withdrawn in Rev. 5) is reachable from an SP 800-53 control'); else fail(`SP 800-171 requirements with no SP 800-53 path: ${unreached.join(', ') || 'none, but 3.13.14 was expected'}`);
const pairs = [['IA-2(1)', '3.5.3'], ['AC-17', '3.1.1'], ['SC-7', '3.13.1'], ['SI-3', '3.14.2'], ['IA-5(1)', '3.5.10'], ['SC-45(1)', '3.3.7']];
const pairsOk = pairs.every(([c, n]) => cw.controls[c] && cw.controls[c]['nist-800-171-r2'].includes(n));
if (pairsOk) pass("spot checks of NIST's Appendix D mapping hold (IA-2(1) 3.5.3, AC-17 3.1.1, SC-7 3.13.1, SI-3 3.14.2, IA-5(1) 3.5.10, SC-45(1) 3.3.7)"); else fail('a spot check of the SP 800-171 mapping failed');

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
const c171 = cov.frameworks['nist-800-171-r2'], ccm = cov.frameworks['cmmc-2.0'];
if (c171 && c171.clauses['3.5.3'] && c171.clauses['3.5.3'].controls.some((c) => c.id === 'CTL-0001' && c.via !== 'direct') && ccm && ccm.clauses['IA.L2-3.5.3'] && ccm.clauses['IA.L2-3.5.3'].controls.some((c) => c.id === 'CTL-0001')) pass('SP 800-171 3.5.3 and CMMC IA.L2-3.5.3 carry CTL-0001 through the crosswalk from IA-2(1)'); else fail('SP 800-171 / CMMC coverage of the MFA control is not as expected');
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
