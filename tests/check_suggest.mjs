// Threat rules check: every rule fires on tests/fixtures/rules.model.json, the examples get few suggestions and none that
// duplicate a threat they already have, and --apply writes threats the validator accepts and the rules then recognise as covered.
//   node tests/check_suggest.mjs
// No browser, no network. Exit 0 pass, 1 fail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, RULE_IDS } from '../skills/netblueprint-forge/scripts/rules.mjs';
import { suggestModel, applySuggestions } from '../skills/netblueprint-forge/scripts/suggest.mjs';
import { validateModel } from '../skills/netblueprint-forge/scripts/validate.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
let fails = 0;
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => { console.log('FAIL  ' + m); fails++; };

// 1. The rules themselves: unique ids, every field a threat needs
const ids = new Set(RULE_IDS);
if (ids.size === RULES.length && RULES.every((r) => /^R\d{3}$/.test(r.id))) pass(`${RULES.length} rules with unique ids`); else fail('rule ids are not unique or not Rnnn');
const incomplete = RULES.filter((r) => !r.name || !r.why || !r.stride.length || !r.category || !r.adversary || !r.adversary.type || !r.likelihood || !r.impact || typeof r.applies !== 'function');
if (!incomplete.length) pass('every rule has a name, a reason, STRIDE, a category, an adversary, default likelihood and impact, and an applies function'); else fail(`incomplete rules: ${incomplete.map((r) => r.id).join(', ')}`);

// 2. The fixture triggers every rule, and the counts are the ones the fixture was built for
const fixture = read(path.join(root, 'tests', 'fixtures', 'rules.model.json'));
const v0 = validateModel(JSON.parse(JSON.stringify(fixture)));
if (!v0.errors.length) pass('rules.model.json is valid'); else fail(`rules.model.json has ${v0.errors.length} error(s): ${v0.errors[0]}`);
const res = suggestModel(fixture);
const fired = {}; res[0].suggestions.forEach((s) => { fired[s.rule] = (fired[s.rule] || 0) + 1; });
const missing = RULE_IDS.filter((id) => !fired[id]);
if (!missing.length) pass(`every rule fires on the fixture (${res[0].suggestions.length} suggestions)`); else fail(`rules that did not fire: ${missing.join(', ')}`);
const expected = { R004: 3, R013: 2, R019: 2, R023: 2 };
const off = Object.entries(expected).filter(([id, n]) => fired[id] !== n);
if (!off.length) pass('the multi-hit rules fire the expected number of times (R004 ×3, R013 ×2, R019 ×2, R023 ×2)'); else fail(`unexpected counts: ${off.map(([id, n]) => `${id} ${fired[id]} (expected ${n})`).join(', ')}`);
if (!res[0].skipped.length) pass('nothing is skipped on a model with no threats'); else fail(`${res[0].skipped.length} suggestion(s) skipped on an empty model`);
const bad = res[0].suggestions.filter((s) => !s.title || !s.description || !s.mitigation || !s.targets.length || !s.stride.length);
if (!bad.length) pass('every suggestion has a title, a description, a mitigation, targets and STRIDE'); else fail(`${bad.length} suggestion(s) incomplete (${bad[0].rule})`);

// 3. --apply: the written threats validate, carry the provenance, and the rules then report them as covered
const applied = JSON.parse(JSON.stringify(fixture));
const added = applySuggestions(applied, res);
const v1 = validateModel(JSON.parse(JSON.stringify(applied)));
if (added.length === res[0].suggestions.length && !v1.errors.length) pass(`--apply writes ${added.length} threats that validate with 0 errors`); else fail(`--apply: ${added.length} added, ${v1.errors.length} error(s): ${v1.errors[0] || ''}`);
const prov = added.every(({ threat: t }) => t.suggested === true && /^rule:R\d{3}$/.test(t.suggested_from) && t.provenance && t.provenance.discovered_by === 'rule' && t.status === 'identified' && t.treatment && t.treatment.decision === 'undecided' && t.risk && t.risk.rating);
if (prov) pass('added threats are suggested, carry rule provenance, start identified and undecided, and have a computed rating'); else fail('an added threat lacks the suggested flag, the rule provenance, the status or the rating');
const nums = added.map(({ threat: t }) => t.number);
if (nums.every((n, i) => n === nums[0] + i) && added.every(({ threat: t }) => t.id === `THR-${String(t.number).padStart(4, '0')}`)) pass('numbers continue from the last one and ids match them'); else fail('numbering of the added threats is not contiguous or ids do not match');
const again = suggestModel(applied);
if (!again[0].suggestions.length && again[0].skipped.length === added.length && again[0].skipped.every((s) => s.reason === 'already applied')) pass('a second run suggests nothing: every rule hit is already applied'); else fail(`second run: ${again[0].suggestions.length} suggestion(s), ${again[0].skipped.length} skipped`);

// 4. The examples: no crash, few suggestions, and no suggestion that duplicates an existing threat's target and weakness
const examples = ['entra-app-proxy', 'azure-hub-spoke', 'partner-portal-tabs', 'aws-three-tier', 'gcp-serverless-web'];
for (const ex of examples) {
  const model = read(path.join(root, 'examples', ex, `${ex}.model.json`));
  const r = suggestModel(model);
  const n = r.reduce((k, x) => k + x.suggestions.length, 0);
  const dup = r.flatMap((x) => x.suggestions).filter((s) => { const scope = model.tabs ? model.tabs.find((t) => t.name === r.find((y) => y.suggestions.includes(s)).tab) : model; return (scope.threats || []).some((t) => (t.targets || []).some((tg) => tg.ref === s.target) && t.vulnerability && t.vulnerability.category === s.category); });
  const scen = r.filter((x) => x.scenario);
  if (n <= 4 && !dup.length && scen.every((x) => !x.suggestions.length)) pass(`${ex}: ${n} suggestion(s), none duplicating an existing threat${scen.length ? ', scenario tab skipped' : ''}`);
  else fail(`${ex}: ${n} suggestion(s), ${dup.length} duplicate(s)`);
}

// 5. The what-if tab is skipped and named
const hub = read(path.join(root, 'examples', 'azure-hub-spoke', 'azure-hub-spoke.model.json'));
const hr = suggestModel(hub);
if (hr.some((x) => x.tab === 'whatif-redis' && x.scenario)) pass('the hub-spoke what-if tab is reported as skipped'); else fail('the what-if tab was not recognised as a scenario');

console.log(fails ? `check_suggest: ${fails} failure(s)` : 'check_suggest: all checks passed');
process.exit(fails ? 1 : 0);
