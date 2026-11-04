#!/usr/bin/env node
/**
 * suggest.mjs — threat enumeration by rule: STRIDE per interaction, run over the model.
 *
 *   node scripts/suggest.mjs <model.json>                 list the suggestions (Markdown)
 *   node scripts/suggest.mjs <model.json> --json          the same as JSON
 *   node scripts/suggest.mjs <model.json> --apply         write them into the model as suggested threats (then validate --fix)
 *   node scripts/suggest.mjs --rules                      list the rules
 *   options: --rule R003,R011   only these rules   ·   --tab <name>   only this tab   ·   --quiet
 *
 * The rules (scripts/rules.mjs) look at flows and elements: an unauthenticated flow from the Internet, sensitive data in the clear,
 * a boundary crossed without an appliance, an administrative session without strong MFA or a record, a data store on the Internet
 * side, deprecated TLS, a credential in plaintext, an end-of-life platform, standing admin rights, a risky protocol a cloud card
 * said to disable, a required third-party dependency, IT traffic into OT, and so on. Each hit becomes a candidate threat with
 * STRIDE, the weakness and its CWE, ATT&CK references, an adversary, default likelihood and impact and a mitigation written as an
 * engineering action. A candidate is dropped when the model already has it: a threat with `suggested_from: "rule:<id>"` on the same
 * target, or any threat on the same target with the same weakness category. --apply appends the rest with the next free THR numbers,
 * `suggested: true`, `suggested_from: "rule:<id>"` and `provenance.discovered_by: "rule"`, status identified, treatment undecided;
 * the user confirms or retires each one, like a cloud card's proposals. What-if scenario tabs are skipped: apply to the baseline and
 * copy. Node 18+, no dependencies. Exit 0 (with --apply: 0 written or nothing to write), 1 bad arguments, 2 I/O.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from './rules.mjs';
import { computeAssessment } from './validate.mjs';

const BUILTIN_STRENGTH = { anonymous: 'none', password: 'weak', basic: 'weak', 'api-key': 'weak', 'ssh-key': 'moderate', oauth2: 'moderate', saml: 'moderate', oidc: 'moderate', kerberos: 'strong', mfa: 'strong', mtls: 'strong', certificate: 'strong', fido2: 'strong', 'managed-identity': 'strong' };
const BUILTIN_LABEL = { anonymous: 'anonymous', password: 'password', basic: 'Basic authentication', 'api-key': 'an API key', 'ssh-key': 'an SSH key', oauth2: 'OAuth 2.0', saml: 'SAML', oidc: 'OIDC', kerberos: 'Kerberos', mfa: 'MFA', mtls: 'mTLS', certificate: 'a certificate', fido2: 'FIDO2', 'managed-identity': 'a managed identity' };
const ADMIN_PROTO = /\b(rdp|ssh|winrm|vnc|telnet)\b/i;
const WEB_GUARDS = ['waf', 'api-gateway', 'reverse-proxy', 'zero-trust-broker'];
const SENSITIVE = ['confidential', 'restricted'];
const EDGE = /(waf|armor|front door|cloudfront|application gateway|app gateway|api gateway|api management|load balancer|gateway|reverse proxy|cdn)/i;
const MANAGED_ZONE = ['cloud', 'provider', 'tenant'];

/** Builds the view of one scope (the model, or one tab) that the rules read. */
export function buildContext(scope, shared) {
  const zones = scope.zones || [], nodes = scope.nodes || [], flows = scope.flows || [], threats = scope.threats || [];
  const Z = {}; zones.forEach((z) => Z[z.name] = z);
  const N = {}; nodes.forEach((n) => N[n.name] = n);
  const APP = {}; zones.forEach((z) => (z.appliances || []).forEach((a) => APP[a.name] = { ...a, _zone: z.name }));
  const COMP = {}; nodes.forEach((n) => (n.components || []).forEach((c) => COMP[`${n.name}/${c.name}`] = { ...c, _node: n.name }));
  const auth = {}; (shared.auth_types && shared.auth_types.length ? shared.auth_types : Object.keys(BUILTIN_STRENGTH).map((id) => ({ id, label: BUILTIN_LABEL[id], strength: BUILTIN_STRENGTH[id] }))).forEach((a) => auth[a.id] = a);
  const own = (ref) => String(ref || '').split('/')[0];
  const chain = (zn) => { const out = []; let cur = zn, g = 0; while (cur && cur !== 'internet' && Z[cur] && g++ < 50) { out.push(cur); cur = Z[cur].parent; } if (cur === 'internet') out.push('internet'); return out; };
  const zoneOf = (ref) => { const o = own(ref); if (N[o]) return N[o].zone; if (APP[o]) return APP[o]._zone; return null; };
  const sideOf = (ref) => { const zn = zoneOf(ref); if (!zn || zn === 'internet') return 'internet'; const c = chain(zn); return c[c.length - 1] === 'internet' ? 'internet' : 'private'; };
  const typeOf = (ref) => { const o = own(ref); if (N[o]) return N[o].type; if (APP[o]) return 'appliance'; return null; };
  const label = (ref) => { if (COMP[ref]) return `${COMP[ref].label} on ${N[COMP[ref]._node].label}`; const o = own(ref); if (N[o]) return N[o].label; if (APP[o]) return APP[o].label; if (Z[o]) return Z[o].label; return ref; };
  const zoneLabel = (zn) => zn === 'internet' || !zn ? (shared.settings && shared.settings.internet_label) || 'the Internet' : (Z[zn] ? Z[zn].label : zn);
  const zoneKind = (zn) => (zn && Z[zn] && Z[zn].kind) || null;
  const isOT = (ref) => { const zn = zoneOf(ref); return ['ot', 'iot'].includes(typeOf(ref)) || chain(zn || '').some((z) => zoneKind(z) === 'ot'); };
  const edgeLike = (ref) => { const o = own(ref); const n = N[o]; if (!n) return !!APP[o]; return n.type === 'public-endpoint' || EDGE.test(`${n.label || ''} ${n.sub || ''} ${(n.cloud && (n.cloud.card || n.cloud.service)) || ''}`); };
  const profileOf = (ref) => (COMP[ref] && COMP[ref].profile) || (N[own(ref)] && N[own(ref)].profile) || (APP[own(ref)] && APP[own(ref)].profile) || null;
  // appliances guarding the way into a zone: on the destination's chain, below the common ancestor with the source
  const guards = (fromRef, toRef, types) => {
    const ca = chain(zoneOf(fromRef) || 'internet'), cb = chain(zoneOf(toRef) || 'internet');
    const common = cb.find((z) => ca.includes(z));
    const below = common ? cb.slice(0, cb.indexOf(common)) : cb.filter((z) => z !== 'internet');
    if (!below.length) return true; // the destination is the source's own zone or an ancestor of it: nothing is crossed inward
    if (below.some((zn) => Z[zn] && MANAGED_ZONE.includes(Z[zn].kind))) return true; // a managed platform zone has no appliance of its own
    return below.some((zn) => Z[zn] && (Z[zn].appliances || []).some((a) => (!types || types.includes(a.type)) && ['inbound', 'both', undefined].includes(a.filters)));
  };
  const F = flows.map((f) => {
    const a = f.auth ? auth[f.auth] : null;
    const strength = f.auth ? (a ? a.strength : 'unspecified') : 'unspecified';
    const fromZone = zoneOf(f.from), toZone = zoneOf(f.to);
    const fromSide = sideOf(f.from), toSide = sideOf(f.to);
    const tp = f.transport || {}, d = f.data || {};
    const classification = f.data_classification || d.sensitivity || null;
    const tags = [...(f.data_tags || []), ...(d.categories || [])];
    const fromType = typeOf(f.from), toType = typeOf(f.to);
    const conn = f.connection || {};
    return {
      ...f, kind: f.kind || 'data', live: !f.out_of_scope, strength, authLabel: f.auth ? ((a && a.label) || f.auth) : null,
      fromZone, toZone, fromSide, toSide, fromType, toType, fromOwner: own(f.from), toOwner: own(f.to),
      fromLabel: label(f.from), toLabel: label(f.to), fromZoneLabel: zoneLabel(fromZone), toZoneLabel: zoneLabel(toZone),
      fromBadActor: fromType === 'bad-actor', crossesInternet: fromSide !== toSide, crossesZone: fromZone !== toZone,
      guarded: guards(f.from, f.to, null), webGuarded: guards(f.from, f.to, WEB_GUARDS), fromEdge: edgeLike(f.from), toEdge: edgeLike(f.to),
      plain: f.encrypted === false || tp.security_protocol === 'none' || (tp.provides && tp.provides.confidentiality === false),
      classification, tags, sensitive: SENSITIVE.includes(classification) || tags.length > 0,
      admin: fromType === 'admin' || ['remote-session', 'management'].includes(conn.type) || ADMIN_PROTO.test(`${f.protocol || ''} ${f.label || ''}`),
      logged: f.path_controls ? f.path_controls.logged : undefined, toProfile: profileOf(f.to), proto: f.protocol ? f.protocol + (f.port ? ' ' + f.port : '') : null,
      toOT: isOT(f.to), fromOT: isOT(f.from),
    };
  });
  const E = [
    ...nodes.map((n) => ({ kind: 'node', ref: n.name, name: n.name, label: n.label, type: n.type, zone: n.zone, profile: n.profile, cloud: n.cloud, exposure: n.cloud && n.cloud.exposure, depends_on: n.depends_on, out_of_scope: n.out_of_scope })),
    ...nodes.flatMap((n) => (n.components || []).map((c) => ({ kind: 'component', ref: `${n.name}/${c.name}`, name: c.name, label: `${c.label} on ${n.label}`, type: c.type, zone: n.zone, profile: c.profile, cloud: c.cloud, exposure: c.cloud && c.cloud.exposure, depends_on: c.depends_on, out_of_scope: c.out_of_scope || n.out_of_scope }))),
    ...zones.flatMap((z) => (z.appliances || []).map((a) => ({ kind: 'appliance', ref: a.name, name: a.name, label: a.label, type: 'appliance', zone: z.name, profile: a.profile, cloud: a.cloud, exposure: a.cloud && a.cloud.exposure, depends_on: a.depends_on, out_of_scope: a.out_of_scope }))),
  ].filter((e) => !e.out_of_scope);
  return { zones, nodes, flows: F, elements: E, threats, label, zoneOf, sideOf, typeOf, own };
}

/** Runs the rules over one scope and returns { suggestions, skipped } after removing what the model already covers. */
export function suggestScope(scope, shared, { rules = RULES } = {}) {
  const ctx = buildContext(scope, shared);
  const existing = (scope.threats || []).filter((t) => t.status !== 'retired');
  const primary = (c) => c.targets[0].ref;
  const suggestions = [], skipped = [];
  for (const rule of rules) {
    let hits = [];
    try { hits = rule.applies(ctx) || []; } catch (e) { throw new Error(`rule ${rule.id}: ${e.message}`); }
    for (const h of hits) {
      const category = h.category || rule.category;
      const applied = existing.find((t) => t.suggested_from === `rule:${rule.id}` && (t.targets || []).some((tg) => tg.ref === primary(h)));
      const stride = h.stride || rule.stride;
      const covered = applied || existing.find((t) => (t.targets || []).some((tg) => tg.ref === primary(h)) && ((t.vulnerability && t.vulnerability.category === category) || (t.classification && (t.classification.stride || []).some((x) => stride.includes(x)))));
      const entry = {
        rule: rule.id, rule_name: rule.name, why: rule.why, target: primary(h), targets: h.targets, title: h.title, description: h.description,
        stride: h.stride || rule.stride, category, cwe: h.cwe === undefined ? rule.cwe : h.cwe, tactics: rule.tactics, techniques: rule.techniques,
        adversary: { ...rule.adversary, ...(h.position ? { position: h.position } : {}) }, likelihood: h.likelihood || rule.likelihood, impact: h.impact || rule.impact,
        boundary: h.boundary || null, mitigation: h.mitigation,
      };
      if (covered) skipped.push({ ...entry, covered_by: covered.id, reason: applied ? 'already applied' : 'a threat on the same target already covers this weakness or STRIDE category' });
      else suggestions.push(entry);
    }
  }
  return { suggestions, skipped };
}

/** Turns a suggestion into a threat object with the given id and number. */
export function toThreat(s, id, number) {
  const risk = { method: 'likelihood-impact', likelihood: s.likelihood, impact: s.impact };
  const c = computeAssessment(risk); if (c) { risk.rating = c.rating; risk.score = c.score; }
  const t = {
    id, number, title: s.title, description: s.description, status: 'identified',
    classification: { stride: s.stride, ...(s.tactics && s.tactics.length ? { attack_tactics: s.tactics } : {}) },
    vulnerability: { category: s.category, ...(s.cwe ? { cwe: s.cwe } : {}), description: s.why },
    targets: s.targets,
    ...(s.boundary ? { boundary_crossed: s.boundary } : {}),
    adversary: s.adversary,
    ...(s.techniques && s.techniques.length ? { attack: { mitre_attack: s.techniques } } : {}),
    risk,
    treatment: { decision: 'undecided', suggested_mitigations: [{ text: s.mitigation, source: 'rule', status: 'suggested' }] },
    provenance: { discovered_by: 'rule', notes: `Rule ${s.rule} (${s.rule_name}): ${s.why}` },
    suggested: true, suggested_from: `rule:${s.rule}`,
  };
  return t;
}

/** Suggestions for a whole model, per scope: [{ tab, suggestions, skipped, scenario }]. */
export function suggestModel(model, opts = {}) {
  const shared = { auth_types: model.auth_types, settings: model.settings };
  const scopes = model.tabs ? model.tabs.map((t) => ({ tab: t.name, scope: t, scenario: !!t.scenario })) : [{ tab: null, scope: model, scenario: false }];
  return scopes.filter((s) => !opts.tab || s.tab === opts.tab).map((s) => s.scenario ? { tab: s.tab, scenario: true, suggestions: [], skipped: [] } : { tab: s.tab, scenario: false, ...suggestScope(s.scope, shared, opts) });
}

/** Writes the suggestions into the model (mutates). Returns the threats added. */
export function applySuggestions(model, results) {
  const all = model.tabs ? model.tabs.flatMap((t) => t.threats || []) : (model.threats || []);
  let next = all.reduce((m, t) => Math.max(m, t.number || 0), 0) + 1;
  const added = [];
  for (const r of results) {
    const scope = r.tab == null ? model : model.tabs.find((t) => t.name === r.tab);
    scope.threats = scope.threats || [];
    for (const s of r.suggestions) { const t = toThreat(s, `THR-${String(next).padStart(4, '0')}`, next); next++; scope.threats.push(t); added.push({ tab: r.tab, threat: t, rule: s.rule }); }
  }
  return added;
}

export function formatMarkdown(name, results) {
  const out = [];
  const total = results.reduce((n, r) => n + r.suggestions.length, 0), skippedN = results.reduce((n, r) => n + r.skipped.length, 0);
  out.push(`# ${total} suggestion${total === 1 ? '' : 's'} for ${name}${skippedN ? ` (${skippedN} already covered)` : ''}`, '');
  for (const r of results) {
    if (r.tab != null) out.push(`## Tab ${r.tab}${r.scenario ? ' (what-if scenario: skipped, apply to its baseline and copy)' : ''}`, '');
    if (r.scenario) continue;
    if (!r.suggestions.length) out.push('No suggestion: every rule that applies is already covered by a threat.', '');
    r.suggestions.forEach((s, i) => {
      out.push(`${i + 1}. **${s.rule} · ${s.title}** on \`${s.target}\`${s.targets.length > 1 ? ' (+' + (s.targets.length - 1) + ')' : ''}`);
      out.push(`   - ${s.description}`);
      out.push(`   - STRIDE ${s.stride.join(', ')} · ${s.category}${s.cwe ? ' · ' + s.cwe : ''}${s.techniques.length ? ' · ' + s.techniques.join(', ') : ''} · ${s.likelihood} likelihood × ${s.impact} impact · adversary ${s.adversary.type}`);
      out.push(`   - Mitigation: ${s.mitigation}`);
    });
    if (r.skipped.length) { out.push('', 'Already covered:'); r.skipped.forEach((s) => out.push(`- ${s.rule} on \`${s.target}\`: ${s.reason} (${s.covered_by})`)); }
    out.push('');
  }
  return out.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--rules')) { RULES.forEach((r) => console.log(`${r.id}  ${r.name}\n      ${r.why}\n      STRIDE ${r.stride.join(', ')} · ${r.category}${r.cwe ? ' · ' + r.cwe : ''}${r.techniques.length ? ' · ' + r.techniques.join(', ') : ''}`)); process.exit(0); }
  const file = args.find((a) => !a.startsWith('-') && !['--rule', '--tab'].includes(args[args.indexOf(a) - 1]));
  if (!file || args.includes('-h') || args.includes('--help')) { console.error('usage: node scripts/suggest.mjs <model.json> [--apply] [--json] [--rule R001,R002] [--tab <name>] [--quiet] | --rules'); process.exit(file ? 0 : 1); }
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { console.error(`suggest: ${file}: ${e.message}`); process.exit(2); }
  const only = opt('--rule') ? opt('--rule').split(',').map((s) => s.trim().toUpperCase()) : null;
  const rules = only ? RULES.filter((r) => only.includes(r.id)) : RULES;
  if (only && rules.length !== only.length) { console.error(`suggest: unknown rule in ${only.join(',')}; --rules lists them`); process.exit(1); }
  const results = suggestModel(model, { rules, tab: opt('--tab') });
  if (args.includes('--apply')) {
    const added = applySuggestions(model, results);
    if (added.length) fs.writeFileSync(file, JSON.stringify(model, null, 2) + '\n', 'utf8');
    if (!args.includes('--quiet')) { added.forEach((a) => console.log(`added ${a.threat.id} (${a.rule})${a.tab ? ' in tab ' + a.tab : ''}: ${a.threat.title}`)); console.log(added.length ? `${added.length} suggested threat(s) written to ${path.basename(file)}; run validate --fix, then confirm or retire each with the user` : 'nothing to add'); }
    process.exit(0);
  }
  if (args.includes('--json')) { console.log(JSON.stringify(results, null, 2)); process.exit(0); }
  if (!args.includes('--quiet')) console.log(formatMarkdown(path.basename(file), results));
  process.exit(0);
}
