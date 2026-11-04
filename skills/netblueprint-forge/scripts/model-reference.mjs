#!/usr/bin/env node
/**
 * model-reference.mjs — generate references/model-reference.md from the JSON Schema,
 * so the field reference the skill reads never drifts from what validate.mjs enforces.
 *
 *   node scripts/model-reference.mjs            (writes the file)
 *   node scripts/model-reference.mjs --stdout   (prints instead)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(fs.readFileSync(path.join(here, '..', 'assets', 'schema', 'netblueprint.schema.json'), 'utf8').replace(/^﻿/, ''));
const OUT = path.join(here, '..', 'references', 'model-reference.md');
const defs = schema.$defs;

// objects become sections; everything else is rendered inline as a type
const SECTION_ORDER = ['meta', 'settings', 'authType', 'layer', 'tab', 'zone', 'appliance', 'node', 'component', 'flow', 'phase', 'step', 'packet', 'threat', 'target', 'adversary', 'riskAssessmentCore', 'owaspRiskRating', 'cvss', 'control', 'evidence', 'frameworkRef', 'requirement', 'dependency', 'policy', 'cloud', 'layoutHints'];
const TITLE = { meta: 'meta (signature block)', authType: 'auth_types[] entry', layer: 'layers[] entry', tab: 'tabs[] entry (one diagram per tab; omit tabs for a single diagram)', zone: 'zones[] entry', appliance: 'zone.appliances[] entry', node: 'nodes[] entry', component: 'node.components[] entry', flow: 'flows[] entry', phase: 'phases[] entry', step: 'steps[] entry', packet: 'step.packets[] entry', threat: 'threats[] entry', target: 'threat.targets[] / control.implemented_on[] entry', adversary: 'threat.adversary', riskAssessmentCore: 'threat.risk and threat.risk.residual', owaspRiskRating: 'risk.owasp_rr', cvss: 'risk.cvss', control: 'controls[] entry', evidence: 'control.evidence[] entry', frameworkRef: 'control.frameworks[] and requirement.frameworks[] entry', requirement: 'requirements[] entry', dependency: 'depends_on[] entry (nodes, components, appliances)', policy: 'settings.policy (what validate --strict enforces)', cloud: 'cloud block (zones, nodes, components, appliances)', layoutHints: 'node.layout' };
const isSection = (name) => defs[name] && defs[name].properties;
const refName = (s) => s && s.$ref ? s.$ref.split('/').pop() : null;
const esc = (t) => String(t || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (v) => '`' + String(v) + '`';

function typeOf(s, depth = 0) {
  if (!s) return '';
  const r = refName(s);
  if (r) return isSection(r) ? `[${r}](#${r.toLowerCase()})` : inlineType(r);
  if (s.enum) return s.enum.map(code).join(', ');
  if ('const' in s) return code(JSON.stringify(s.const));
  if (s.oneOf) return s.oneOf.map((x) => typeOf(x, depth + 1)).join(' or ');
  if (s.anyOf) return s.anyOf.map((x) => typeOf(x, depth + 1)).join(' or ');
  if (s.allOf) return s.allOf.map((x) => typeOf(x, depth + 1)).join(' + ') + (s.properties ? ' + ' + Object.keys(s.properties).map(code).join(', ') : '');
  if (s.type === 'array') return `array of ${typeOf(s.items, depth + 1)}${s.uniqueItems ? ' (unique)' : ''}${s.minItems ? `, min ${s.minItems}` : ''}`;
  if (s.type === 'object') return s.additionalProperties && typeof s.additionalProperties === 'object' ? `map of ${typeOf(s.additionalProperties, depth + 1)}` : 'object';
  let t = Array.isArray(s.type) ? s.type.join('/') : s.type || '';
  if (s.pattern) t += ` matching ${code(s.pattern)}`;
  if (s.format) t += ` (${s.format})`;
  if (s.minimum != null || s.maximum != null) t += ` ${s.minimum ?? ''}–${s.maximum ?? ''}`;
  if (s.maxLength) t += ` ≤${s.maxLength} chars`;
  return t;
}
function inlineType(name) {
  const d = defs[name];
  const t = typeOf({ ...d, $ref: undefined });
  const short = { name: 'name: letters, digits, `_ . -`, ≤64, unique', ref: 'ref: `node` or `node/component`', nameList: 'list of names (unique)', refList: 'list of refs (unique)', shortText: 'text ≤200', longText: 'text ≤4000', date: 'date YYYY-MM-DD', semver: 'version MAJOR.MINOR.PATCH', url: 'URL', color: 'hex colour or palette name (blue, teal, green, slate, red, grey, purple, gold, orange, navy)', dataUriImage: 'image as data: URI (png/jpeg/gif/webp/svg)', fiveLevel: '`very-low` · `low` · `moderate` · `high` · `very-high`', classification: '`public` · `internal` · `confidential` · `restricted`', dataTags: 'list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other`', suggested: 'boolean (proposed by the skill, not yet confirmed)', suggestedFrom: 'text: card id or source', threatId: '`THR-0000` to `THR-9999`', controlId: '`CTL-0000` to `CTL-9999`', requirementId: '`REQ-0000` to `REQ-9999`', custom: 'object of your own keys (up to 40; letters, digits, space, _ . -), listed in the Attributes card under Custom and left alone by the validator', icon: 'icon name or `provider/id` vendor icon (see icons.md)' };
  return short[name] || `${name}: ${t}`;
}
function section(name) {
  const d = defs[name];
  const req = new Set(d.required || []);
  const lines = [`## ${TITLE[name] || name}`, '', `<a id="${name.toLowerCase()}"></a>`];
  if (d.description) lines.push('', d.description);
  lines.push('', '| Field | Type / allowed values | Required | Notes |', '| - | - | - | - |');
  for (const [k, s] of Object.entries(d.properties)) {
    const notes = [s.description, s.default !== undefined ? `Default ${code(JSON.stringify(s.default))}.` : ''].filter(Boolean).join(' ');
    lines.push(`| ${code(k)} | ${esc(typeOf(s))} | ${req.has(k) ? 'yes' : ''} | ${esc(notes)} |`);
  }
  const rules = [];
  (d.allOf || []).forEach((r) => { if (r.if && r.then) rules.push(`when ${cond(r.if)} then ${cond(r.then)}`); });
  if (d.if && d.then) rules.push(`when ${cond(d.if)} then ${cond(d.then)}`);
  if (d.anyOf) rules.push('at least one of: ' + d.anyOf.map((a) => (a.required || []).map(code).join(' + ')).join(' or '));
  if (rules.length) lines.push('', 'Rules: ' + rules.join('; ') + '.');
  return lines.join('\n');
}
function cond(s) {
  const parts = [];
  if (s.properties) for (const [k, v] of Object.entries(s.properties)) { if ('const' in v) parts.push(`${code(k)} is ${code(v.const)}`); else if (v.enum) parts.push(`${code(k)} is ${v.enum.map(code).join(' or ')}`); else if (v.not && 'const' in v.not) parts.push(`${code(k)} is not ${code(v.not.const)}`); }
  if (s.required) parts.push(`${s.required.map(code).join(', ')} ${s.required.length > 1 ? 'are' : 'is'} required`);
  return parts.join(' and ');
}

const out = [];
out.push('# Model reference', '', `Generated from \`assets/schema/netblueprint.schema.json\` by \`scripts/model-reference.mjs\` on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand; change the schema and regenerate.`, '', schema.description, '');
out.push('## Top level', '', '| Field | Type / allowed values | Required | Notes |', '| - | - | - | - |');
const rootReq = new Set(schema.required || []);
for (const [k, s] of Object.entries(schema.properties)) if (k !== '$schema') out.push(`| ${code(k)} | ${esc(typeOf(s))} | ${rootReq.has(k) ? 'yes' : ''} | ${esc(s.description || '')} |`);
out.push('', '## Shared types', '', '| Type | Meaning |', '| - | - |');
for (const name of Object.keys(defs)) if (!isSection(name) && name !== 'icon' && name !== 'owaspFactor0to9') out.push(`| ${code(name)} | ${esc(inlineType(name))} |`);
const iconEnum = defs.icon.enum || (defs.icon.anyOf || []).flatMap((x) => x.enum || []);
out.push(`| ${code('icon')} | ${iconEnum.map(code).join(', ')}, or a vendor icon as ${code('provider/id')} from the icon library (${code('azure/key-vaults')}, ${code('aws/lambda')}, ${code('gcp/cloud-sql')}; see icons.md) |`);
const order = [...SECTION_ORDER, ...Object.keys(defs).filter((n) => isSection(n) && !SECTION_ORDER.includes(n) && n !== 'riskAssessment')];
for (const name of order) if (isSection(name)) out.push('', section(name));
out.push('', '## Reserved names and conventions', '', '- `internet` is a reserved zone name: nodes with `zone: "internet"` and zones with `parent: "internet"` sit on the Internet side; it is never declared.', '- Components are referenced as `node/component` in flows, steps, targets and `implemented_on`.', '- Threat numbers and ids are permanent. Retire a threat (`status: "retired"`, `retired: true`, `status_reason`) instead of deleting it.', '- `validate.mjs --fix` writes `risk.rating`, `risk.score` and the OWASP averages/levels from the inputs; do not hand-edit them.', '- Built-in layers that need no declaration: zones, appliances, nodes, components, internet, flows-strong, flows-moderate, flows-weak, flows-unspecified, flows-blocked, flows-trust, flows-dependency, threats, controls, labels. An element is visible when its kind layer is on and (it has no custom layers or any of them is on).', '- Requirement ids and numbers (`REQ-0001`) are permanent like threat numbers; `waived` and `retired` need a `status_reason`. A `depends_on` entry with a `ref` expects a flow between the two elements (kind `dependency`, or the real auth or data flow).', '- `validate.mjs --strict` applies `settings.policy` over its defaults (an open threat at high or above with no planned control on track, an open threat without a treatment decision, an overdue control, an approved requirement without a control, a suggested element, an accepted risk past its review date) and exits 1 on any failure.', '- Built-in auth types when `auth_types` is omitted: anonymous (none), password, basic, api-key (weak), ssh-key, oauth2, saml, oidc (moderate), kerberos, mfa, mtls, certificate, fido2 (phishing-resistant), managed-identity (strong). Declaring `auth_types` replaces this list.', '');
const text = out.join('\n');
if (process.argv.includes('--stdout')) process.stdout.write(text);
else { fs.writeFileSync(OUT, text, 'utf8'); console.log(`wrote ${path.relative(process.cwd(), OUT)} (${text.split('\n').length} lines)`); }
