#!/usr/bin/env node
/**
 * validate.mjs — check a NetBlueprint model before it is rendered.
 *
 *   node scripts/validate.mjs <model.json> [--fix] [--json] [--quiet]
 *
 * 1. Schema: the model is checked against assets/schema/netblueprint.schema.json
 *    (a built-in validator for the draft 2020-12 subset the schema uses; no dependencies).
 * 2. Lint: unique names, every reference resolves, risk ratings match their inputs,
 *    status rules (a mitigated threat needs an implemented control, ...).
 * 3. --fix writes computed values back into the file: risk.rating / risk.score and the
 *    OWASP averages and levels, for inherent and residual assessments.
 *
 * Exit 0 = valid (warnings allowed), 1 = errors, 2 = usage or I/O problem.
 * Exported for build.mjs: validateModel(model, { fix }) -> { errors, warnings, fixed }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suggest } from './normalize.mjs';
import { resolveIcon, useLocalIndex, PROVIDERS as SHIPPED_ICON_PROVIDERS, FETCHED_PROVIDERS } from './icons.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, '..', 'assets', 'schema', 'netblueprint.schema.json');

/* ---------- schema validator (draft 2020-12 subset) ---------- */
const typeOf = (v) => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;
const matchesType = (t, v) => { const tv = typeOf(v); return t === 'number' ? (tv === 'number' || tv === 'integer') : tv === t; };
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmtPath = (p) => p.length ? p.map((k, i) => typeof k === 'number' ? `[${k}]` : (i ? '.' + k : k)).join('') : '(root)';
const trunc = (s) => { s = String(s); return s.length > 40 ? s.slice(0, 37) + '…' : s; };
const resolveRef = (ref, root) => {
  if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
  return ref.slice(2).split('/').reduce((o, k) => o[k.replace(/~1/g, '/').replace(/~0/g, '~')], root);
};
const describe = (sch, root) => {
  if (sch.$ref) return describe(resolveRef(sch.$ref, root), root);
  if (sch.enum) return 'one of ' + sch.enum.map((e) => JSON.stringify(e)).join(', ');
  if ('const' in sch) return JSON.stringify(sch.const);
  if (sch.pattern) return `a string matching ${sch.pattern}`;
  if (sch.type) return Array.isArray(sch.type) ? sch.type.join(' or ') : sch.type;
  return 'the expected form';
};

function check(sch, data, p, root) {
  const errors = [];
  const evaluated = new Set();
  const err = (msg) => errors.push({ path: fmtPath(p), msg });
  if (sch === true) return { errors, evaluated };
  if (sch === false) { err('not allowed here'); return { errors, evaluated }; }
  const sub = (s) => { const r = check(s, data, p, root); r.evaluated.forEach((k) => evaluated.add(k)); return r; };

  if (sch.$ref) errors.push(...sub(resolveRef(sch.$ref, root)).errors);
  if (sch.type) {
    const ts = Array.isArray(sch.type) ? sch.type : [sch.type];
    if (!ts.some((t) => matchesType(t, data))) { err(`expected ${ts.join(' or ')}, got ${typeOf(data)}`); return { errors, evaluated }; }
  }
  if (sch.enum && !sch.enum.some((e) => deepEq(e, data))) {
    const best = typeof data === 'string' && sch.enum.every((e) => typeof e === 'string') ? suggest(sch.enum, data)[0] : null;
    err(`${JSON.stringify(data)} is not allowed${best && best.score >= 0.5 ? `; did you mean "${best.value}"?` : ''} Options: ${sch.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }
  if ('const' in sch && !deepEq(sch.const, data)) err(`must be ${JSON.stringify(sch.const)}`);

  if (typeof data === 'string') {
    if (sch.minLength != null && data.length < sch.minLength) err(`must be at least ${sch.minLength} characters`);
    if (sch.maxLength != null && data.length > sch.maxLength) err(`must be at most ${sch.maxLength} characters (is ${data.length})`);
    if (sch.pattern && !new RegExp(sch.pattern).test(data)) err(`"${trunc(data)}" does not match the required form ${sch.pattern}`);
    if (sch.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data)))) err(`"${data}" is not a date (YYYY-MM-DD)`);
    if (sch.format === 'uri' && !/^[a-z][a-z0-9+.-]*:/i.test(data)) err(`"${trunc(data)}" is not a URL`);
  }
  if (typeof data === 'number') {
    if (sch.minimum != null && data < sch.minimum) err(`must be at least ${sch.minimum}`);
    if (sch.maximum != null && data > sch.maximum) err(`must be at most ${sch.maximum}`);
  }
  if (Array.isArray(data)) {
    if (sch.minItems != null && data.length < sch.minItems) err(sch.minItems === 1 ? 'must not be empty' : `needs at least ${sch.minItems} items`);
    if (sch.maxItems != null && data.length > sch.maxItems) err(`at most ${sch.maxItems} items allowed`);
    if (sch.uniqueItems) { const seen = new Set(); data.forEach((v) => { const k = JSON.stringify(v); if (seen.has(k)) err(`duplicate entry ${k}`); seen.add(k); }); }
    if (sch.items) data.forEach((v, i) => errors.push(...check(sch.items, v, [...p, i], root).errors));
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    (sch.required || []).forEach((k) => { if (!(k in data)) err(`missing required property "${k}"`); });
    if (sch.properties) for (const k in sch.properties) if (k in data) { evaluated.add(k); errors.push(...check(sch.properties[k], data[k], [...p, k], root).errors); }
    if (sch.additionalProperties === false) { for (const k in data) if (!(sch.properties && k in sch.properties)) err(`unexpected property "${k}"`); }
    else if (sch.additionalProperties && typeof sch.additionalProperties === 'object') {
      for (const k in data) if (!(sch.properties && k in sch.properties)) { evaluated.add(k); errors.push(...check(sch.additionalProperties, data[k], [...p, k], root).errors); }
    }
  }
  if (sch.allOf) sch.allOf.forEach((s) => errors.push(...sub(s).errors));
  if (sch.anyOf) {
    const rs = sch.anyOf.map((s) => check(s, data, p, root));
    const ok = rs.find((r) => !r.errors.length);
    if (ok) ok.evaluated.forEach((k) => evaluated.add(k));
    else err(`does not satisfy any allowed form (${rs.map((r) => r.errors[0] ? r.errors[0].msg : '').filter(Boolean).join(' | ')})`);
  }
  if (sch.oneOf) {
    const rs = sch.oneOf.map((s) => check(s, data, p, root));
    const oks = rs.filter((r) => !r.errors.length);
    if (oks.length === 1) oks[0].evaluated.forEach((k) => evaluated.add(k));
    else if (!oks.length) err(`must be ${sch.oneOf.map((s) => describe(s, root)).join(' or ')}`);
    else err('matches more than one allowed form');
  }
  if (sch.not && !check(sch.not, data, p, root).errors.length) err(`${JSON.stringify(data)} is not allowed here`);
  if (sch.if) {
    const cond = check(sch.if, data, p, root);
    if (!cond.errors.length) { if (sch.then) errors.push(...sub(sch.then).errors); }
    else if (sch.else) errors.push(...sub(sch.else).errors);
  }
  if (sch.unevaluatedProperties === false && data && typeof data === 'object' && !Array.isArray(data)) {
    for (const k in data) if (!evaluated.has(k)) err(`unexpected property "${k}"`);
  }
  return { errors, evaluated };
}

export function schemaErrors(model, schema) {
  const seen = new Set();
  return check(schema, model, [], schema).errors.filter((e) => { const k = e.path + '|' + e.msg; if (seen.has(k)) return false; seen.add(k); return true; }).map((e) => `${e.path}: ${e.msg}`);
}

/* ---------- risk computation (shared with the renderer's rules) ---------- */
export const BANDS = ['very-low', 'low', 'moderate', 'high', 'very-high'];
const BAND_SCORE = { 'very-low': 0, low: 2, moderate: 5, high: 8, 'very-high': 10 };
const NIST = { 'very-high': ['very-low', 'low', 'moderate', 'high', 'very-high'], high: ['very-low', 'low', 'moderate', 'high', 'very-high'], moderate: ['very-low', 'low', 'moderate', 'moderate', 'high'], low: ['very-low', 'low', 'low', 'low', 'moderate'], 'very-low': ['very-low', 'very-low', 'very-low', 'low', 'low'] };
const OWASP_MATRIX = { low: ['note', 'low', 'medium'], medium: ['low', 'medium', 'high'], high: ['medium', 'high', 'critical'] }; // [impact][likelihood]
const OWASP_TO_BAND = { note: 'very-low', low: 'low', medium: 'moderate', high: 'high', critical: 'very-high' };
const lvl = (x) => x < 3 ? 'low' : x < 6 ? 'medium' : 'high';
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round2 = (x) => Math.round(x * 100) / 100;

export function computeAssessment(r) {
  if (!r || !r.method) return null;
  if (r.method === 'likelihood-impact') {
    if (!r.likelihood || !r.impact) return null;
    const rating = NIST[r.likelihood][BANDS.indexOf(r.impact)];
    return { rating, score: BAND_SCORE[rating] };
  }
  if (r.method === 'owasp-rr') {
    const o = r.owasp_rr; if (!o) return null;
    const L = ['skill_level', 'motive', 'opportunity', 'size', 'ease_of_discovery', 'ease_of_exploit', 'awareness', 'intrusion_detection'].map((k) => o[k]);
    if (L.some((v) => typeof v !== 'number')) return null;
    const tech = ['loss_of_confidentiality', 'loss_of_integrity', 'loss_of_availability', 'loss_of_accountability'].map((k) => o[k]);
    const bus = ['financial_damage', 'reputation_damage', 'non_compliance', 'privacy_violation'].map((k) => o[k]);
    const hasTech = tech.every((v) => typeof v === 'number'), hasBus = bus.every((v) => typeof v === 'number');
    const basis = o.impact_basis === 'business' && hasBus ? 'business' : hasTech ? 'technical' : hasBus ? 'business' : null;
    if (!basis) return null;
    const likelihood_avg = round2(avg(L)), impact_avg = round2(avg(basis === 'business' ? bus : tech));
    const likelihood_level = lvl(likelihood_avg), impact_level = lvl(impact_avg);
    const severity = OWASP_MATRIX[impact_level][['low', 'medium', 'high'].indexOf(likelihood_level)];
    const rating = OWASP_TO_BAND[severity];
    return { rating, score: BAND_SCORE[rating], owasp: { likelihood_avg, impact_avg, likelihood_level, impact_level, severity, impact_basis: basis } };
  }
  return null;
}

/* ---------- lint ---------- */
const BUILTIN_AUTH = ['anonymous', 'password', 'basic', 'api-key', 'ssh-key', 'oauth2', 'saml', 'oidc', 'kerberos', 'mfa', 'mtls', 'certificate', 'fido2', 'managed-identity'];
const BUILTIN_LAYERS = ['zones', 'appliances', 'nodes', 'components', 'internet', 'flows-strong', 'flows-moderate', 'flows-weak', 'flows-unspecified', 'flows-blocked', 'flows-trust', 'threats', 'controls', 'labels'];

// Labels are Title Case ("Bad Actor", "Edge Firewall"): AP style, articles / conjunctions / short prepositions stay lower case except as first or last word (so "Sign In" keeps its capital).
const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'with', 'from', 'into', 'onto']);
const ACRONYMS = Object.fromEntries('id mfa sso cis stig tls ssl ssh api oidc saml ip dns vpn waf nsg acl cwe cve kev url uri http https ftp ftps rdp sql vm os iot ot pii phi pci npi cui fci mnpi hsm tpm kms iam pam jit eol sla aal1 aal2 aal3 stride linddun owasp nist cvss capec soc siem edr b2b b2c ca ad saas paas iaas mtls fido2 json xml ldap smb nfs smtp imap ssrf xss csrf bola rbac abac otp totp laps kcd spn iis vnet cidr nat vpc'.split(' ').map((a) => [a, a === 'saas' ? 'SaaS' : a === 'paas' ? 'PaaS' : a === 'iaas' ? 'IaaS' : a === 'mtls' ? 'mTLS' : a === 'iot' ? 'IoT' : a.toUpperCase()]));
Object.assign(ACRONYMS, { smbv1: 'SMBv1', smbv2: 'SMBv2', smbv3: 'SMBv3', 'tls1.0': 'TLS 1.0', 'tls1.1': 'TLS 1.1', 'tls1.2': 'TLS 1.2', 'tls1.3': 'TLS 1.3', ssl3: 'SSL 3', ipv4: 'IPv4', ipv6: 'IPv6', http2: 'HTTP/2', http3: 'HTTP/3', imdsv1: 'IMDSv1', imdsv2: 'IMDSv2', wpa2: 'WPA2', wpa3: 'WPA3', oauth2: 'OAuth 2.0', ntlmv1: 'NTLMv1', ntlmv2: 'NTLMv2' });
export function titleCase(s) {
  const words = String(s).split(' ');
  return words.map((w, i) => {
    if (!w) return w;
    if (/[A-Z]/.test(w.slice(1))) return w; // mTLS, OIDC, IIS, iPhone: mixed or upper case is deliberate
    const core = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toLowerCase();
    if (ACRONYMS[core]) return w.replace(new RegExp(core.replace(/[.]/g, '\.'), 'i'), ACRONYMS[core]); // tls1.2 → TLS 1.2, before the digit rule
    if (/^[0-9]/.test(core)) return w; // 24x7, 2fa, 3rd
    if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(core)) return w.toLowerCase();
    return w.split('-').map((part) => {
      const pc = part.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
      if (ACRONYMS[pc]) return part.replace(new RegExp(pc, 'i'), ACRONYMS[pc]);
      return part.replace(/^([^A-Za-z]*)([a-z])/, (m, p, c) => p + c.toUpperCase());
    }).join('-');
  }).join(' ');
}

/**
 * Lint the whole model. A model is either one scope (top-level zones, nodes, flows, …) or a list of tabs that each hold a scope.
 * Shared across tabs: meta, settings, auth_types, layers. Unique across tabs: threat ids and numbers, control ids, attack path ids and numbers
 * (a what-if scenario tab may repeat its baseline tab's). Names are unique within a tab.
 */
export function lintModel(model, { fix = false } = {}) {
  const errors = [], warnings = [];
  let fixed = false;
  const merge = (r, pre = '') => { errors.push(...r.errors.map((e) => pre + e)); warnings.push(...r.warnings.map((w) => pre + w)); fixed = fixed || r.fixed; };
  const tcase = (x, what) => { if (x && typeof x.label === 'string' && x.label && titleCase(x.label) !== x.label) { if (fix) { x.label = titleCase(x.label); fixed = true; } else warnings.push(`${what} label "${x.label}" should be Title Case ("${titleCase(x.label)}"); run validate --fix`); } };
  (model.layers || []).forEach((l) => tcase(l, `layer "${l.name}"`));
  (model.auth_types || []).forEach((a) => tcase(a, `auth type "${a.id}"`));
  // headings are Title Case too: the document title and subtitle, the side labels
  const tfield = (obj, key, what) => { const v = obj && obj[key]; if (typeof v === 'string' && v && titleCase(v) !== v) { if (fix) { obj[key] = titleCase(v); fixed = true; } else warnings.push(`${what} "${v}" should be Title Case ("${titleCase(v)}"); run validate --fix`); } };
  tfield(model.meta, 'title', 'meta.title'); tfield(model.meta, 'subtitle', 'meta.subtitle'); tfield(model.settings, 'network_label', 'settings.network_label'); tfield(model.settings, 'internet_label', 'settings.internet_label');
  const topLevel = ['zones', 'nodes', 'flows', 'phases', 'steps', 'threats', 'controls', 'attack_paths'].filter((k) => model[k] !== undefined);
  if (model.tabs) {
    if (topLevel.length) errors.push(`a model with tabs[] keeps ${topLevel.join(', ')} inside each tab, not at the top level`);
    if (!model.tabs.length) errors.push('tabs[] is empty; add at least one tab or remove it');
    const names = new Map();
    model.tabs.forEach((t, i) => { if (names.has(t.name)) errors.push(`tab "${t.name}" is defined twice (entries ${names.get(t.name) + 1} and ${i + 1})`); names.set(t.name, i); tcase(t, `tab "${t.name}"`); });
    // what-if scenarios: a scenario tab repeats its baseline (the same ids are allowed between them, and between two scenarios of one baseline)
    const scen = new Map(model.tabs.filter((t) => t.scenario).map((t) => [t.name, t.scenario.baseline]));
    model.tabs.forEach((t) => { if (!t.scenario) return; const b = t.scenario.baseline; if (b === t.name) errors.push(`tab "${t.name}": a scenario cannot be its own baseline`); else if (!names.has(b)) errors.push(`tab "${t.name}": scenario.baseline "${b}" is not a tab`); else if (scen.has(b)) warnings.push(`tab "${t.name}": its baseline "${b}" is itself a scenario; derive scenarios from the baseline diagram so each delta reads against the real system`); });
    const related = (a, b) => scen.get(a) === b || scen.get(b) === a || (!!scen.get(a) && scen.get(a) === scen.get(b));
    const seen = { threat: new Map(), 'threat number': new Map(), control: new Map(), 'attack path': new Map(), 'attack path number': new Map() };
    const across = (what, key, tab) => { const m = seen[what]; if (key == null) return; if (m.has(key) && m.get(key) !== tab && !related(m.get(key), tab)) errors.push(`${what} ${key} appears in tabs "${m.get(key)}" and "${tab}"; ${what}s are unique across the whole model (only a what-if scenario repeats its baseline's)`); if (!m.has(key)) m.set(key, tab); };
    model.tabs.forEach((t) => { (t.threats || []).forEach((th) => { across('threat', th.id, t.name); across('threat number', th.number, t.name); }); (t.controls || []).forEach((c) => across('control', c.id, t.name)); (t.attack_paths || []).forEach((p) => { across('attack path', p.id, t.name); across('attack path number', p.number, t.name); }); });
    model.tabs.forEach((t) => merge(lintScope({ ...t, auth_types: model.auth_types, layers: model.layers }, { fix }), `tab "${t.name}": `));
  } else {
    if (!model.zones || !model.nodes) errors.push('a model needs zones[] and nodes[] at the top level, or a tabs[] array whose entries have them');
    merge(lintScope(model, { fix }));
  }
  return { errors, warnings, fixed };
}

function lintScope(model, { fix = false } = {}) {
  const errors = [], warnings = [];
  let fixed = false;
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const zones = model.zones || [], nodes = model.nodes || [], flows = model.flows || [], steps = model.steps || [], threats = model.threats || [], controls = model.controls || [], layers = model.layers || [], phases = model.phases || [], paths = model.attack_paths || [];

  // uniqueness
  const uniq = (list, key, what) => { const seen = new Map(); list.forEach((x, i) => { const v = x[key]; if (v == null) return; if (seen.has(v)) err(`${what} "${v}" is defined twice (entries ${seen.get(v) + 1} and ${i + 1}); names must be unique`); seen.set(v, i); }); return seen; };
  const Z = uniq(zones, 'name', 'zone'), N = uniq(nodes, 'name', 'node'), F = uniq(flows, 'name', 'flow');
  uniq(steps, 'name', 'step'); uniq(phases, 'name', 'phase'); const L = uniq(layers, 'name', 'layer');
  const T = uniq(threats, 'id', 'threat'); const C = uniq(controls, 'id', 'control');
  uniq(threats, 'number', 'threat number'); uniq(paths, 'id', 'attack path'); uniq(paths, 'number', 'attack path number');
  const APP = new Map(); zones.forEach((z) => (z.appliances || []).forEach((a) => { if (APP.has(a.name)) err(`appliance "${a.name}" is defined twice; names must be unique across zones`); APP.set(a.name, { a, zone: z.name }); if (N.has(a.name)) err(`appliance "${a.name}" has the same name as a node`); }));
  if (Z.has('internet')) err('"internet" is a reserved zone name; it needs no declaration');
  const COMP = new Map(); nodes.forEach((n) => { const seen = new Set(); (n.components || []).forEach((c) => { if (seen.has(c.name)) err(`node "${n.name}" has two components named "${c.name}"`); seen.add(c.name); COMP.set(`${n.name}/${c.name}`, c); }); });
  const authIds = new Set((model.auth_types && model.auth_types.length ? model.auth_types.map((a) => a.id) : BUILTIN_AUTH));
  const layerNames = new Set([...BUILTIN_LAYERS, ...layers.map((l) => l.name)]);

  // references
  const refOk = (ref) => N.has(ref) || COMP.has(ref) || APP.has(ref);
  const checkLayers = (list, where) => (list || []).forEach((l) => { if (!layerNames.has(l)) err(`${where}: layer "${l}" is not declared in layers[]`); });
  zones.forEach((z) => { if (z.parent && z.parent !== 'internet' && !Z.has(z.parent)) err(`zone "${z.name}": parent zone "${z.parent}" does not exist`); if (z.parent === z.name) err(`zone "${z.name}" cannot be its own parent`); checkLayers(z.layers, `zone "${z.name}"`); (z.appliances || []).forEach((a) => { checkLayers(a.layers, `appliance "${a.name}"`); (a.serves || []).forEach((s) => { if (s !== 'internet' && !Z.has(s)) err(`appliance "${a.name}": serves zone "${s}" does not exist`); }); }); });
  // cycles
  zones.forEach((z) => { const seen = new Set(); let cur = z; while (cur && cur.parent && cur.parent !== 'internet') { if (seen.has(cur.name)) { err(`zone "${z.name}" is inside a parent loop`); break; } seen.add(cur.name); cur = zones.find((k) => k.name === cur.parent); } });
  nodes.forEach((n) => { if (n.zone !== 'internet' && !Z.has(n.zone)) err(`node "${n.name}": zone "${n.zone}" does not exist (use "internet" for Internet-side nodes)`); checkLayers(n.layers, `node "${n.name}"`); (n.components || []).forEach((c) => checkLayers(c.layers, `component "${n.name}/${c.name}"`)); if (n.zone === 'internet' && ['database', 'storage'].includes(n.type) && !n.cloud) warn(`node "${n.name}" is a ${n.type} on the Internet side; if it is a cloud service add a cloud block, otherwise check it is really public`); });
  // vendor icons: a "provider/id" icon must be in the icon library (the renderer falls back to the built-in icon otherwise) and should match the element's cloud provider
  const iconLint = (ref, what, cloud) => { if (typeof ref !== 'string' || !ref.includes('/')) return; const r = resolveIcon(ref); if (!r) { const [p, n] = ref.split('/'); const hint = FETCHED_PROVIDERS.includes(p) ? `fetch it beside the model: node scripts/icons.mjs fetch ${ref} --model <model.json>` : `try: node scripts/icons.mjs search "${n.replace(/-/g, ' ')}"`; warn(`${what}: icon "${ref}" is not in the icon library; the built-in icon will be drawn (${hint})`); return; } if (cloud && cloud.provider && SHIPPED_ICON_PROVIDERS.includes(r.provider) && cloud.provider !== r.provider) warn(`${what}: icon "${ref}" is a ${r.provider} icon on a ${cloud.provider} service`); };
  zones.forEach((z) => { iconLint(z.icon, `zone "${z.name}"`, z.cloud); (z.appliances || []).forEach((a) => iconLint(a.icon, `appliance "${a.name}"`, a.cloud)); });
  nodes.forEach((n) => { iconLint(n.icon, `node "${n.name}"`, n.cloud); (n.components || []).forEach((c) => iconLint(c.icon, `component "${n.name}/${c.name}"`, null)); });
  flows.forEach((f) => {
    if (!refOk(f.from)) err(`flow "${f.name}": from "${f.from}" is not a node, component (node/component) or appliance`);
    if (!refOk(f.to)) err(`flow "${f.name}": to "${f.to}" is not a node, component (node/component) or appliance`);
    if (f.from === f.to) err(`flow "${f.name}" starts and ends at the same place`);
    if (f.auth && !authIds.has(f.auth)) err(`flow "${f.name}": auth "${f.auth}" is not a known auth type (${[...authIds].join(', ')})`);
    // the arrow points from the initiator: one-way = from initiates; two-way only when either side opens connections
    const init = f.connection && f.connection.initiator;
    if (init === 'to') err(`flow "${f.name}": connection.initiator is "to" but the arrow is drawn from "${f.from}"; swap from/to so the arrow leaves the initiator`);
    if (f.direction === 'two-way' && (init === 'from' || (f.connection && f.connection.type && f.connection.type !== 'peer-to-peer' && init !== 'either'))) warn(`flow "${f.name}": direction two-way draws arrowheads at both ends, which reads as both sides initiating; a ${(f.connection && f.connection.type) || 'request-response'} flow initiated by "${f.from}" is one-way (the response is implied). Use two-way only when either side initiates (connection.initiator: either)`);
    if (!f.auth && f.kind !== 'trust' && f.kind !== 'blocked') warn(`flow "${f.name}" (${f.from} → ${f.to}) has no auth; the diagram will show "?" until you set one`);
    if (!f.data_classification && !(f.data && f.data.sensitivity) && f.kind !== 'trust' && f.kind !== 'blocked') warn(`flow "${f.name}" (${f.from} → ${f.to}) has no data classification; say what it carries (public, internal, confidential, restricted) and the labels that apply (pii, pci, credentials …)`);
    (f.via || []).forEach((v) => { if (!APP.has(v)) err(`flow "${f.name}": via "${v}" is not an appliance`); });
    checkLayers(f.layers, `flow "${f.name}"`);
  });
  const phaseNames = new Set(phases.map((p) => p.name));
  steps.forEach((s) => {
    if (s.phase && phases.length && !phaseNames.has(s.phase)) err(`step "${s.name}": phase "${s.phase}" is not in phases[]`);
    (s.flows || []).forEach((n) => { if (!F.has(n)) err(`step "${s.name}": flow "${n}" does not exist`); });
    (s.tunnel || []).forEach((n) => { if (!F.has(n)) err(`step "${s.name}": tunnel flow "${n}" does not exist`); });
    (s.packets || []).forEach((p, i) => { if (!F.has(p.flow)) err(`step "${s.name}": packet ${i + 1} uses flow "${p.flow}" which does not exist`); });
    (s.highlight || []).forEach((r) => { if (!refOk(r)) err(`step "${s.name}": highlight "${r}" is not a node, component or appliance`); });
    if (s.badge && !refOk(s.badge)) err(`step "${s.name}": badge "${s.badge}" is not a node, component or appliance`);
    if (s.pulse && !refOk(s.pulse)) err(`step "${s.name}": pulse "${s.pulse}" is not a node, component or appliance`);
    (s.threats || []).forEach((id) => { if (!T.has(id)) err(`step "${s.name}": threat "${id}" does not exist`); });
    checkLayers(s.layers, `step "${s.name}"`);
  });
  controls.forEach((c) => {
    (c.implemented_on || []).forEach((t) => { if (!targetOk(t)) err(`control "${c.id}": implemented_on ${t.kind} "${t.ref}" does not exist`); });
    checkLayers(c.layers, `control "${c.id}"`);
    if (c.due_date && ['proposed', 'planned', 'in-progress'].includes(c.status) && c.due_date < new Date().toISOString().slice(0, 10)) warn(`control "${c.id}" (${c.name}) is ${c.status} and past its due date ${c.due_date}`);
  });
  function targetOk(t) {
    if (t.kind === 'zone') return Z.has(t.ref);
    if (t.kind === 'flow') return F.has(t.ref);
    if (t.kind === 'appliance') return APP.has(t.ref);
    if (t.kind === 'component') return COMP.has(t.ref);
    if (t.kind === 'node') return N.has(t.ref);
    if (t.kind === 'boundary') { const m = /^(.+)-to-(.+)$/.exec(t.ref); return !!m && (m[1] === 'internet' || Z.has(m[1])) && (m[2] === 'internet' || Z.has(m[2])); }
    return false;
  }
  threats.forEach((t) => {
    const where = `threat ${t.id}`;
    const n = parseInt((t.id || '').replace('THR-', ''), 10);
    if (Number.isInteger(n) && n !== t.number) warn(`${where}: number ${t.number} does not match the id digits (${n}); fine if numbers were assigned separately, otherwise align them`);
    (t.targets || []).forEach((tg) => { if (!targetOk(tg)) err(`${where}: target ${tg.kind} "${tg.ref}" does not exist`); });
    if (t.adversary && t.adversary.actor_node && !N.has(t.adversary.actor_node)) err(`${where}: adversary.actor_node "${t.adversary.actor_node}" is not a node`);
    if (t.boundary_crossed) { ['from', 'to'].forEach((k) => { const v = t.boundary_crossed[k]; if (v && v !== 'internet' && !Z.has(v)) err(`${where}: boundary_crossed.${k} "${v}" is not a zone`); }); }
    const tr = t.treatment || {};
    const cur = tr.current_controls || [], plan = tr.planned_controls || [];
    // as-is / future-state consistency; `controls` is the union and --fix keeps it so
    cur.forEach((id) => { const c = controls.find((x) => x.id === id); if (!c) err(`${where}: current control "${id}" does not exist`); else if (!['implemented', 'verified'].includes(c.status)) err(`${where}: current control "${id}" has status ${c.status}; a current (as-is) control must be implemented or verified, or move it to planned_controls`); });
    plan.forEach((id) => { const c = controls.find((x) => x.id === id); if (!c) err(`${where}: planned control "${id}" does not exist`); else if (!['proposed', 'planned', 'in-progress'].includes(c.status)) err(`${where}: planned control "${id}" has status ${c.status}; a planned (future-state) control must be proposed, planned or in-progress, or move it to current_controls`); if (cur.includes(id)) err(`${where}: control "${id}" is listed as both current and planned`); });
    const union = [...new Set([...(tr.controls || []), ...cur, ...plan])];
    const ctl = union;
    if ((cur.length || plan.length) && JSON.stringify([...(tr.controls || [])].sort()) !== JSON.stringify([...union].sort())) { if (fix) { tr.controls = union; fixed = true; } else err(`${where}: treatment.controls must list every current and planned control (${union.join(', ')}); run validate --fix`); }
    ctl.forEach((id) => { if (!C.has(id)) err(`${where}: control "${id}" does not exist`); });
    (tr.suggested_mitigations || []).forEach((m, i) => { if (m.control_id && !C.has(m.control_id)) err(`${where}: suggested mitigation ${i + 1} points at control "${m.control_id}" which does not exist`); if (m.status === 'converted' && !m.control_id) warn(`${where}: suggested mitigation ${i + 1} is converted but has no control_id`); });
    const decision = tr.decision;
    if (decision === 'mitigate' && !ctl.length) warn(`${where}: treatment is mitigate but no controls are listed`);
    if (t.status === 'mitigated') { const impl = ctl.map((id) => controls.find((c) => c.id === id)).filter(Boolean).some((c) => ['implemented', 'verified'].includes(c.status)); if (!impl) err(`${where}: status is mitigated but none of its controls is implemented or verified`); }
    if (cur.length && !(t.risk && t.risk.residual)) warn(`${where}: has current controls but no risk.residual (the as-is risk with those controls); the circle will show the no-controls rating`);
    if (plan.length && !(t.risk && t.risk.projected)) warn(`${where}: has planned controls but no risk.projected (future-state risk)`);
    if (!t.vulnerability) warn(`${where}: no vulnerability category; say what weakness is exploited (unauthorized-access, injection, misconfiguration …)`);
    if (t.status === 'accepted' && !(t.treatment && t.treatment.acceptance)) err(`${where}: status is accepted but treatment.acceptance (approver, date, rationale) is missing`);
    if (!t.description) warn(`${where}: no description; one sentence on what could happen helps every reader`);
    checkLayers(t.layers, where);
    // computed ratings
    const assess = assessor(where);
    assess(t.risk, 'inherent risk');
    if (t.risk && t.risk.residual) assess(t.risk.residual, 'residual (current) risk');
    if (t.risk && t.risk.projected) assess(t.risk.projected, 'projected risk');
    // remediation: an open threat needs a control (as-is or planned) or at least a suggested mitigation written as an engineering action
    if (['identified', 'investigating', 'open'].includes(t.status) && !ctl.length && !(tr.suggested_mitigations || []).length) warn(`${where}: no remediation recorded; add a planned control or a suggested mitigation that names the engineering change (header validation, rate limit, token binding, mTLS, parameterized query …)`);
  });
  // computed ratings, shared by threats and attack paths: the band and score are derived from the inputs and written back by --fix
  function assessor(where) {
    return (r, label) => {
      if (!r) return;
      const c = computeAssessment(r);
      if (!c) { if (!r.rating) err(`${where}: ${label} has no rating and its inputs are incomplete for method ${r.method}`); return; }
      const apply = () => { r.rating = c.rating; r.score = c.score; if (c.owasp) Object.assign(r.owasp_rr, c.owasp); fixed = true; };
      if (!r.rating || r.score == null) { if (fix) apply(); else err(`${where}: ${label} is missing rating/score (computed: ${c.rating}, ${c.score}); run validate --fix`); return; }
      if (r.rating !== c.rating || r.score !== c.score) { if (fix) apply(); else err(`${where}: ${label} rating ${r.rating}/${r.score} does not match its inputs (computed ${c.rating}/${c.score}); run validate --fix or change the inputs`); }
      if (c.owasp) { const o = r.owasp_rr; const drift = ['likelihood_avg', 'impact_avg', 'likelihood_level', 'impact_level', 'severity'].filter((k) => o[k] !== undefined && o[k] !== c.owasp[k]); if (drift.length) { if (fix) apply(); else err(`${where}: ${label} OWASP fields ${drift.join(', ')} do not match the factors; run validate --fix`); } }
    };
  }
  // attack paths: every hop names a threat of this diagram and lands somewhere; the chain is continuous; the threat belongs on its hop
  const owner = (ref) => (ref || '').split('/')[0];
  paths.forEach((p) => {
    const where = `attack path ${p.id}`;
    const n = parseInt((p.id || '').replace('AP-', ''), 10);
    if (Number.isInteger(n) && n !== p.number) warn(`${where}: number ${p.number} does not match the id digits (${n})`);
    if (p.entry && !refOk(p.entry)) err(`${where}: entry "${p.entry}" is not a node, component or appliance`);
    if (p.adversary && p.adversary.actor_node && !N.has(p.adversary.actor_node)) err(`${where}: adversary.actor_node "${p.adversary.actor_node}" is not a node`);
    let landed = p.entry || null;
    (p.hops || []).forEach((hp, i) => {
      const h = `${where} hop ${i + 1}`;
      const via = hp.via ? flows.find((f) => f.name === hp.via) : null;
      if (hp.via && !via) err(`${h}: via "${hp.via}" is not a flow`);
      if (!hp.via && !hp.to) err(`${h}: needs a flow (via) or a destination (to)`);
      ['from', 'to'].forEach((k) => { if (hp[k] && !refOk(hp[k])) err(`${h}: ${k} "${hp[k]}" is not a node, component or appliance`); });
      const start = hp.from || (via ? via.from : landed), end = hp.to || (via ? via.to : null);
      if (via && hp.to && end !== via.to && owner(end) !== owner(via.to)) warn(`${h}: lands on "${hp.to}" but flow "${hp.via}" ends at "${via.to}"`);
      if (landed && start && start !== landed && owner(start) !== owner(landed)) warn(`${h}: the chain breaks: the previous hop landed on "${landed}" but this one starts from "${start}"`);
      const t = threats.find((x) => x.id === hp.threat);
      if (!t) err(`${h}: threat "${hp.threat}" does not exist in this diagram`);
      else {
        const refs = new Set([hp.via, start, end, owner(start), owner(end)].filter(Boolean));
        const onHop = (t.targets || []).some((tg) => tg.kind === 'boundary' || refs.has(tg.ref) || refs.has(owner(tg.ref)));
        if (!onHop) warn(`${h}: threat ${hp.threat} targets ${(t.targets || []).map((tg) => tg.ref).join(', ') || 'nothing'}, none of which is on this hop (${[hp.via, start, end].filter(Boolean).join(', ')})`);
        if (t.status === 'mitigated' && p.status !== 'mitigated' && !(p.breaks_at || []).length) warn(`${h}: threat ${hp.threat} is mitigated; if its control cuts the chain, list it in breaks_at and set the path's status`);
      }
      (hp.bypasses || []).forEach((id) => { if (!C.has(id)) err(`${h}: bypasses control "${id}" which does not exist`); });
      if (end) landed = end;
    });
    (p.breaks_at || []).forEach((id) => { if (!C.has(id)) err(`${where}: breaks_at control "${id}" does not exist`); });
    if (p.status === 'mitigated') { const impl = (p.breaks_at || []).map((id) => controls.find((c) => c.id === id)).filter(Boolean).some((c) => ['implemented', 'verified'].includes(c.status)); if (!impl) err(`${where}: status is mitigated but no breaks_at control is implemented or verified`); }
    if (!p.impact) warn(`${where}: no impact; say what the adversary ends up with`);
    if (!p.risk) warn(`${where}: no risk rating for the chain as a whole`);
    checkLayers(p.layers, where);
    const assess = assessor(where);
    if (p.risk) { assess(p.risk, 'path risk'); if (p.risk.residual) assess(p.risk.residual, 'residual (current) path risk'); if (p.risk.projected) assess(p.risk.projected, 'projected path risk'); }
  });
  // service profiles and flow detail
  const DEPRECATED_TLS = ['tls-1.1', 'tls-1.0', 'ssl-3'], WEAK_STORE = ['config-file-plaintext', 'source-code', 'environment-variable', 'file-on-disk'];
  const profiled = [...nodes.map((n) => ['node', n.name, n]), ...nodes.flatMap((n) => (n.components || []).map((c) => ['component', `${n.name}/${c.name}`, c])), ...zones.flatMap((z) => (z.appliances || []).map((a) => ['appliance', a.name, a]))];
  profiled.forEach(([kind, ref, x]) => {
    const p = x.profile; if (!p) return; const w = `${kind} "${ref}"`;
    if (p.platform && p.platform.support_status === 'end-of-life') warn(`${w}: platform is end-of-life; that is a finding (vulnerable-components)`);
    if (p.patching && p.patching.cadence === 'none') warn(`${w}: patching cadence is none`);
    if (p.patching && p.patching.unsupported_components) warn(`${w}: has unsupported components`);
    if (p.hardening && ['none', 'unknown'].includes(p.hardening.baseline)) warn(`${w}: hardening baseline is ${p.hardening.baseline}`);
    if (p.device_authentication && WEAK_STORE.includes(p.device_authentication.credential_storage)) warn(`${w}: its own credential is stored in ${p.device_authentication.credential_storage}`);
    if (p.elevated_access && ['standing-admin', 'shared-admin-account'].includes(p.elevated_access.model)) warn(`${w}: elevated access model is ${p.elevated_access.model}`);
    if (p.elevated_access && p.elevated_access.mfa_required === false && p.elevated_access.model !== 'none') warn(`${w}: administrators are not required to use MFA`);
  });
  flows.forEach((f) => {
    const w = `flow "${f.name}"`; const tp = f.transport || {}, au = f.authentication || {}, d = f.data || {};
    if (DEPRECATED_TLS.includes(tp.security_protocol)) warn(`${w}: ${tp.security_protocol} is deprecated (RFC 8996)`);
    const conf = tp.provides && tp.provides.confidentiality;
    const sens = d.sensitivity && d.sensitivity !== 'public';
    if ((tp.security_protocol === 'none' || conf === false) && (sens || (d.categories || []).length)) warn(`${w}: carries ${d.sensitivity || (d.categories || []).join('/')} data without confidentiality (encryption)`);
    if (f.encrypted === true && (tp.security_protocol === 'none' || conf === false)) err(`${w}: encrypted is true but transport says no confidentiality; make them agree`);
    if (f.encrypted === false && (conf === true)) err(`${w}: encrypted is false but transport.provides.confidentiality is true; make them agree`);
    if (tp.certificate_validation === 'disabled') warn(`${w}: certificate validation is disabled (missing-or-weak-encryption / spoofing)`);
    if (au.client && WEAK_STORE.includes(au.client.credential_storage)) warn(`${w}: the client credential is stored in ${au.client.credential_storage}`);
    if (au.server && WEAK_STORE.includes(au.server.key_storage)) warn(`${w}: the server private key is stored in ${au.server.key_storage}`);
    if (au.client && au.client.method === 'ip-allow-list') warn(`${w}: an IP allow-list is not authentication; record the real method too`);
    if (au.client && ['ntlm', 'basic-auth'].includes(au.client.method)) warn(`${w}: client authentication ${au.client.method} is legacy`);
    if (au.server && au.server.certificate_issuer === 'self-signed' && tp.certificate_validation !== 'pinned') warn(`${w}: self-signed server certificate without pinning`);
    if (f.path_controls && f.path_controls.logged === false) warn(`${w}: not logged (insufficient-logging-monitoring)`);
  });
  // labels in Title Case (Bad Actor, Edge Firewall); --fix rewrites them
  const tcase = (x, what) => { if (x && typeof x.label === 'string' && x.label && titleCase(x.label) !== x.label) { if (fix) { x.label = titleCase(x.label); fixed = true; } else warn(`${what} label "${x.label}" should be Title Case ("${titleCase(x.label)}"); run validate --fix`); } };
  zones.forEach((z) => { tcase(z, `zone "${z.name}"`); (z.appliances || []).forEach((a) => tcase(a, `appliance "${a.name}"`)); });
  nodes.forEach((n) => { tcase(n, `node "${n.name}"`); (n.components || []).forEach((c) => tcase(c, `component "${n.name}/${c.name}"`)); });
  flows.forEach((f) => tcase(f, `flow "${f.name}"`));
  phases.forEach((p) => tcase(p, `phase "${p.name}"`));
  // threat titles and control names are headings in the register; step titles are narrative sentences and stay as written
  const theading = (x, key, what) => { const v = x && x[key]; if (typeof v === 'string' && v && titleCase(v) !== v) { if (fix) { x[key] = titleCase(v); fixed = true; } else warn(`${what} ${key} "${v}" should be Title Case ("${titleCase(v)}"); run validate --fix`); } };
  threats.forEach((t) => theading(t, 'title', `threat ${t.id}`));
  controls.forEach((c) => theading(c, 'name', `control ${c.id}`));
  paths.forEach((p) => theading(p, 'title', `attack path ${p.id}`));
  // zones with nothing in them
  zones.forEach((z) => { if (!nodes.some((n) => n.zone === z.name) && !zones.some((k) => k.parent === z.name)) warn(`zone "${z.name}" contains no nodes or zones`); });
  // suggested elements
  const sugg = [...zones, ...nodes, ...flows, ...threats, ...controls, ...paths].filter((x) => x.suggested).length + zones.reduce((s, z) => s + (z.appliances || []).filter((a) => a.suggested).length, 0);
  if (sugg) warn(`${sugg} element(s) are still marked suggested; confirm or remove them with the user`);
  if (!steps.length) warn('no steps: the diagram will have no walkthrough');
  if (steps.length && !steps.some((s) => s.outcome)) warn('no step has an outcome; the last step usually states what the flow achieved');
  return { errors, warnings, fixed };
}

/* ---------- entry points ---------- */
export function loadSchema() { return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8').replace(/^﻿/, '')); }

export function validateModel(model, { fix = false, schema } = {}) {
  schema = schema || loadSchema();
  const errors = schemaErrors(model, schema);
  if (errors.length) return { errors, warnings: [], fixed: false, stage: 'schema' };
  const r = lintModel(model, { fix });
  return { errors: r.errors, warnings: r.warnings, fixed: r.fixed, stage: 'lint' };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('-'));
  try { useLocalIndex(file); } catch (e) { console.warn(`warning: ${e.message}`); }
  if (!file || args.includes('-h') || args.includes('--help')) { console.error('usage: node scripts/validate.mjs <model.json> [--fix] [--json] [--quiet]'); process.exit(file ? 0 : 2); }
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); }
  catch (e) { console.error(`validate: ${file} is not valid JSON: ${e.message}`); process.exit(2); }
  const fix = args.includes('--fix');
  const res = validateModel(model, { fix });
  if (res.fixed) fs.writeFileSync(file, JSON.stringify(model, null, 2) + '\n', 'utf8');
  if (args.includes('--json')) { console.log(JSON.stringify(res, null, 2)); process.exit(res.errors.length ? 1 : 0); }
  if (!args.includes('--quiet')) {
    res.errors.forEach((e) => console.error(`error: ${e}`));
    res.warnings.forEach((w) => console.warn(`warning: ${w}`));
  }
  const name = path.basename(file);
  if (res.errors.length) console.error(`${name}: ${res.errors.length} error(s)${res.warnings.length ? `, ${res.warnings.length} warning(s)` : ''} (${res.stage})`);
  else console.log(`${name}: valid${res.warnings.length ? ` with ${res.warnings.length} warning(s)` : ''}${res.fixed ? '; computed ratings written back' : ''}`);
  process.exit(res.errors.length ? 1 : 0);
}
