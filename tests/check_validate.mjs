// Runs scripts/validate.mjs against every fixture and the shipped example.
// Fixtures named invalid-*.model.json must fail; everything else must pass (warnings allowed).
//   node tests/check_validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModel, computeAssessment } from '../skills/netblueprint-forge/scripts/validate.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = [
  ...fs.readdirSync(path.join(root, 'tests', 'fixtures')).filter((f) => f.endsWith('.model.json')).map((f) => path.join(root, 'tests', 'fixtures', f)),
  path.join(root, 'examples', 'azure-hub-spoke', 'azure-hub-spoke.model.json'),
  path.join(root, 'examples', 'entra-app-proxy', 'entra-app-proxy.model.json'),
  path.join(root, 'examples', 'partner-portal-tabs', 'partner-portal-tabs.model.json'),
  path.join(root, 'examples', 'aws-three-tier', 'aws-three-tier.model.json'),
  path.join(root, 'examples', 'gcp-serverless-web', 'gcp-serverless-web.model.json'),
];
let failures = 0;
for (const file of files) {
  const name = path.basename(file);
  const expectInvalid = name.startsWith('invalid-');
  const model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const res = validateModel(model);
  const ok = (res.errors.length > 0) === expectInvalid;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${res.errors.length} error(s), ${res.warnings.length} warning(s) [${res.stage}]${expectInvalid ? ' (errors expected)' : ''}`);
  if (expectInvalid || !ok) res.errors.slice(0, 30).forEach((e) => console.log('      - ' + e));
  if (!ok) failures++;
}
// risk computation spot checks (values from docs/research/threat-attributes.md)
const cases = [
  [{ method: 'likelihood-impact', likelihood: 'moderate', impact: 'very-high' }, 'high'],
  [{ method: 'likelihood-impact', likelihood: 'low', impact: 'high' }, 'low'],
  [{ method: 'likelihood-impact', likelihood: 'very-low', impact: 'very-high' }, 'low'],
  [{ method: 'owasp-rr', owasp_rr: { skill_level: 3, motive: 9, opportunity: 9, size: 9, ease_of_discovery: 9, ease_of_exploit: 9, awareness: 9, intrusion_detection: 3, loss_of_confidentiality: 6, loss_of_integrity: 3, loss_of_availability: 1, loss_of_accountability: 7 } }, 'high'],
  [{ method: 'owasp-rr', owasp_rr: { skill_level: 1, motive: 1, opportunity: 0, size: 2, ease_of_discovery: 1, ease_of_exploit: 1, awareness: 1, intrusion_detection: 1, loss_of_confidentiality: 2, loss_of_integrity: 1, loss_of_availability: 1, loss_of_accountability: 1 } }, 'very-low'],
];
for (const [r, expected] of cases) {
  const c = computeAssessment(r);
  const ok = c && c.rating === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  computeAssessment(${r.method}) → ${c ? c.rating : 'null'} (expected ${expected})`);
  if (!ok) failures++;
}
process.exit(failures ? 1 : 0);
