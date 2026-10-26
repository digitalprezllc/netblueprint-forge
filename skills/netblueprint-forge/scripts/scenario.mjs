#!/usr/bin/env node
/**
 * scenario.mjs — the delta of a what-if scenario tab against its baseline tab (Mode B: "what if we changed X?").
 *
 *   node scripts/scenario.mjs <model.json>                 every scenario tab, as Markdown
 *   node scripts/scenario.mjs <model.json> --tab <name>    one scenario tab
 *   node scripts/scenario.mjs <model.json> --json          the same as JSON
 *
 * A scenario tab is a tab with `scenario: { baseline, change }`: a copy of its baseline diagram with one change applied. The report lists
 * what the change added, removed and altered; the new boundary crossings and Internet-facing elements it creates; the controls it
 * invalidates (a control whose element is gone, or that a surviving threat still cites but the scenario dropped); how each threat's and
 * attack path's status and risk moved; and the attack paths the scenario adds. Paste the Markdown into the scenario tab's description or
 * the archive's changelog. Node 18+, no dependencies. Exit 0 ok, 1 the scenario is inconsistent (baseline missing), 2 usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILTIN_STRENGTH = { anonymous: 'none', none: 'none', password: 'weak', basic: 'weak', 'api-key': 'weak', 'ssh-key': 'moderate', oauth2: 'moderate', saml: 'moderate', oidc: 'moderate', kerberos: 'strong', mfa: 'strong', mtls: 'strong', certificate: 'strong', fido2: 'strong', 'managed-identity': 'strong' };
const STRENGTH_RANK = { none: 0, unspecified: 0, weak: 1, moderate: 2, strong: 3 };
const CLASS_RANK = { public: 0, internal: 1, confidential: 2, restricted: 3 };
const BANDS = ['very-low', 'low', 'moderate', 'high', 'very-high'];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const index = (list, key) => new Map((list || []).map((x) => [x[key], x]));
const ratingOf = (r) => (r ? r.rating_override || r.rating || null : null);
const curBand = (x) => (x.risk ? ratingOf(x.risk.residual) || ratingOf(x.risk) : null);
const projBand = (x) => (x.risk ? ratingOf(x.risk.projected) : null);
const owner = (ref) => (ref || '').split('/')[0];

/** Elements of a tab: zones, appliances (with their zone), nodes, components (as node/component), flows, phases, steps, threats, controls, attack paths. */
function collections(tab) {
  const zones = tab.zones || [], nodes = tab.nodes || [];
  return {
    zone: [zones, 'name'],
    appliance: [zones.flatMap((z) => (z.appliances || []).map((a) => ({ ...a, _zone: z.name }))), 'name'],
    node: [nodes, 'name'],
    component: [nodes.flatMap((n) => (n.components || []).map((c) => ({ ...c, _ref: `${n.name}/${c.name}` }))), '_ref'],
    flow: [tab.flows || [], 'name'],
    phase: [tab.phases || [], 'name'],
    step: [tab.steps || [], 'name'],
    threat: [tab.threats || [], 'id'],
    control: [tab.controls || [], 'id'],
    'attack path': [tab.attack_paths || [], 'id'],
  };
}
function labelOf(x) { return x.label || x.title || x.name || x.id; }
function diffKind(prevList, nextList, key) {
  const P = index(prevList, key), N = index(nextList, key);
  const added = [], removed = [], changed = [];
  N.forEach((x, k) => { if (!P.has(k)) added.push(x); else if (!same(P.get(k), x)) changed.push({ key: k, prev: P.get(k), next: x, fields: [...new Set([...Object.keys(P.get(k)), ...Object.keys(x)])].filter((f) => !same(P.get(k)[f], x[f])) }); });
  P.forEach((x, k) => { if (!N.has(k)) removed.push(x); });
  return { added, removed, changed };
}

/** The zone of an element ref (node, component or appliance) in a tab; 'internet' for Internet-side nodes; null when unknown. */
function zoneOfRef(tab, ref) {
  const n = (tab.nodes || []).find((x) => x.name === owner(ref)); if (n) return n.zone;
  for (const z of tab.zones || []) if ((z.appliances || []).some((a) => a.name === ref)) return z.name;
  return null;
}
function chain(tab, zn) { const out = []; let cur = zn, guard = 0; while (cur && guard++ < 50) { out.push(cur); const z = (tab.zones || []).find((x) => x.name === cur); cur = z ? z.parent || null : null; } return out; }
/** Zones a flow leaves and enters (the boundaries it crosses), by name. */
function crossings(tab, f) {
  const a = zoneOfRef(tab, f.from), b = zoneOfRef(tab, f.to); if (!a || !b || a === b) return [];
  const ca = chain(tab, a), cb = chain(tab, b); const common = ca.find((z) => cb.includes(z));
  const exits = common ? ca.slice(0, ca.indexOf(common)) : ca, enters = common ? cb.slice(0, cb.indexOf(common)) : cb;
  return [...exits.map((z) => `leaves ${z}`), ...enters.reverse().map((z) => `enters ${z}`)];
}
function strengthOf(model, authId) {
  if (!authId) return 'unspecified';
  const t = (model.auth_types || []).find((a) => a.id === authId);
  return t ? t.strength : BUILTIN_STRENGTH[authId] || 'unspecified';
}
function targetExists(tab, t) {
  const Z = new Set((tab.zones || []).map((z) => z.name)), F = new Set((tab.flows || []).map((f) => f.name)), N = new Set((tab.nodes || []).map((n) => n.name));
  const APP = new Set((tab.zones || []).flatMap((z) => (z.appliances || []).map((a) => a.name))), COMP = new Set((tab.nodes || []).flatMap((n) => (n.components || []).map((c) => `${n.name}/${c.name}`)));
  if (t.kind === 'zone') return Z.has(t.ref); if (t.kind === 'flow') return F.has(t.ref); if (t.kind === 'appliance') return APP.has(t.ref); if (t.kind === 'component') return COMP.has(t.ref); if (t.kind === 'node') return N.has(t.ref);
  if (t.kind === 'boundary') { const m = /^(.+)-to-(.+)$/.exec(t.ref); return !!m && (m[1] === 'internet' || Z.has(m[1])) && (m[2] === 'internet' || Z.has(m[2])); }
  return false;
}

/** The delta of one scenario tab against its baseline. */
export function scenarioDelta(model, scenarioTab) {
  const base = (model.tabs || []).find((t) => t.name === scenarioTab.scenario.baseline);
  if (!base) throw new Error(`tab "${scenarioTab.name}": baseline "${scenarioTab.scenario.baseline}" is not a tab`);
  const out = { scenario: scenarioTab.name, scenarioLabel: scenarioTab.label, baseline: base.name, baselineLabel: base.label, change: scenarioTab.scenario.change, date: scenarioTab.scenario.date || null, author: scenarioTab.scenario.author || null, assumptions: scenarioTab.scenario.assumptions || [], elements: {}, boundaries: [], exposure: [], weakened: [], controls: { invalidated: [], orphaned: [] }, threats: { added: [], removed: [], moved: [] }, paths: { added: [], removed: [], moved: [] } };
  const B = collections(base), S = collections(scenarioTab);
  for (const kind of Object.keys(B)) {
    const [pl, key] = B[kind], [nl] = S[kind];
    const d = diffKind(pl, nl, key);
    out.elements[kind] = { added: d.added.map((x) => ({ key: x[key], label: labelOf(x) })), removed: d.removed.map((x) => ({ key: x[key], label: labelOf(x) })), changed: d.changed.map((c) => ({ key: c.key, label: labelOf(c.next), fields: c.fields })) };
  }
  // boundary crossings that are new (new flow, or a changed flow that crosses differently) and Internet exposure
  const baseFlows = index(base.flows, 'name');
  for (const f of scenarioTab.flows || []) {
    const cr = crossings(scenarioTab, f); if (!cr.length) continue;
    const pf = baseFlows.get(f.name); const before = pf ? crossings(base, pf) : null;
    if (!pf || !same(before, cr)) out.boundaries.push({ flow: f.name, from: f.from, to: f.to, kind: f.kind || 'data', auth: f.auth || null, strength: strengthOf(model, f.auth), classification: f.data_classification || (f.data && f.data.sensitivity) || null, crosses: cr, isNew: !pf });
    const fromZone = zoneOfRef(scenarioTab, f.from);
    if (fromZone === 'internet' && (f.kind || 'data') !== 'blocked' && (f.kind || 'data') !== 'trust' && (!pf || (pf.kind || 'data') === 'blocked')) out.exposure.push({ flow: f.name, target: f.to, auth: f.auth || null, strength: strengthOf(model, f.auth), classification: f.data_classification || (f.data && f.data.sensitivity) || null, wasBlocked: !!pf });
  }
  // flows whose authentication weakened, encryption dropped, or data classification rose
  for (const f of scenarioTab.flows || []) {
    const pf = baseFlows.get(f.name); if (!pf) continue; const notes = [];
    const s0 = STRENGTH_RANK[strengthOf(model, pf.auth)] ?? 0, s1 = STRENGTH_RANK[strengthOf(model, f.auth)] ?? 0; if (s1 < s0) notes.push(`authentication ${pf.auth || 'unspecified'} → ${f.auth || 'unspecified'}`);
    if (pf.encrypted === true && f.encrypted === false) notes.push('encryption dropped');
    const c0 = CLASS_RANK[pf.data_classification || (pf.data && pf.data.sensitivity)] ?? -1, c1 = CLASS_RANK[f.data_classification || (f.data && f.data.sensitivity)] ?? -1; if (c1 > c0) notes.push(`carries more sensitive data (${f.data_classification || f.data.sensitivity})`);
    if (notes.length) out.weakened.push({ flow: f.name, from: f.from, to: f.to, notes });
  }
  // controls: invalidated (an element they sit on is gone or they vanished) and orphaned (a threat still cites them but the scenario dropped them)
  const sControls = index(scenarioTab.controls, 'id'), bControls = index(base.controls, 'id');
  for (const c of scenarioTab.controls || []) { const gone = (c.implemented_on || []).filter((t) => !targetExists(scenarioTab, t)); if (gone.length) out.controls.invalidated.push({ id: c.id, name: c.name, reason: `implemented on ${gone.map((t) => `${t.kind} ${t.ref}`).join(', ')}, which the scenario removed` }); }
  for (const c of base.controls || []) { if (sControls.has(c.id)) continue; const citers = (scenarioTab.threats || []).filter((t) => ((t.treatment || {}).controls || []).includes(c.id)).map((t) => t.id); out.controls.invalidated.push({ id: c.id, name: c.name, reason: citers.length ? `dropped by the scenario while ${citers.join(', ')} still cite it` : 'dropped by the scenario' }); if (citers.length) out.controls.orphaned.push({ id: c.id, threats: citers }); }
  // threats and attack paths: added, removed, moved (status or band)
  const move = (kind, pl, nl, key, label) => {
    const P = index(pl, key), N = index(nl, key);
    N.forEach((x, k) => { if (!P.has(k)) { out[kind].added.push({ id: k, title: label(x), status: x.status || null, current: curBand(x), projected: projBand(x) }); return; } const p = P.get(k); const notes = [];
      if ((p.status || null) !== (x.status || null)) notes.push(`status ${p.status || 'unset'} → ${x.status || 'unset'}`);
      const b0 = curBand(p), b1 = curBand(x); if (b0 !== b1) notes.push(`current ${b0 || 'unrated'} → ${b1 || 'unrated'}`);
      const i0 = ratingOf(p.risk), i1 = ratingOf(x.risk); if (i0 !== i1) notes.push(`inherent ${i0 || 'unrated'} → ${i1 || 'unrated'}`);
      const j0 = projBand(p), j1 = projBand(x); if (j0 !== j1) notes.push(`projected ${j0 || 'unrated'} → ${j1 || 'unrated'}`);
      if (kind === 'paths' && !same((p.hops || []).map((h) => h.threat), (x.hops || []).map((h) => h.threat))) notes.push(`hops ${(p.hops || []).map((h) => h.threat).join(' → ')} → ${(x.hops || []).map((h) => h.threat).join(' → ')}`);
      if (kind === 'threats' && !same(((p.treatment || {}).controls || []).slice().sort(), ((x.treatment || {}).controls || []).slice().sort())) notes.push(`controls ${((p.treatment || {}).controls || []).join(', ') || 'none'} → ${((x.treatment || {}).controls || []).join(', ') || 'none'}`);
      if (notes.length) out[kind].moved.push({ id: k, title: label(x), notes }); });
    P.forEach((x, k) => { if (!N.has(k)) out[kind].removed.push({ id: k, title: label(x) }); });
  };
  move('threats', base.threats, scenarioTab.threats, 'id', (t) => t.title);
  move('paths', base.attack_paths, scenarioTab.attack_paths, 'id', (p) => p.title);
  const worse = (list) => list.filter((m) => m.notes.some((n) => { const mm = /current (\S+) → (\S+)/.exec(n); return mm && BANDS.indexOf(mm[2]) > BANDS.indexOf(mm[1]); })).length;
  out.summary = { added: Object.values(out.elements).reduce((n, e) => n + e.added.length, 0), removed: Object.values(out.elements).reduce((n, e) => n + e.removed.length, 0), changed: Object.values(out.elements).reduce((n, e) => n + e.changed.length, 0), newCrossings: out.boundaries.length, newExposure: out.exposure.length, weakenedFlows: out.weakened.length, invalidatedControls: out.controls.invalidated.length, newThreats: out.threats.added.length, threatsWorse: worse(out.threats.moved), newPaths: out.paths.added.length, pathsWorse: worse(out.paths.moved) };
  return out;
}

export function toMarkdown(d) {
  const L = [];
  const band = (b) => (b ? b.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'unrated');
  L.push(`## What-if: ${d.change}`);
  L.push(`Scenario tab \`${d.scenario}\` (${d.scenarioLabel}) against baseline \`${d.baseline}\` (${d.baselineLabel})${d.date ? `, ${d.date}` : ''}${d.author ? `, by ${d.author}` : ''}.`);
  if (d.assumptions.length) { L.push(''); L.push('Assumptions:'); d.assumptions.forEach((a) => L.push(`- ${a}`)); }
  const s = d.summary;
  L.push(''); L.push(`**In one line:** ${s.added} element(s) added, ${s.removed} removed, ${s.changed} changed; ${s.newCrossings} new or altered boundary crossing(s); ${s.newExposure} new Internet-facing path(s); ${s.weakenedFlows} weakened flow(s); ${s.invalidatedControls} control(s) invalidated; ${s.newThreats} new threat(s), ${s.threatsWorse} rated worse; ${s.newPaths} new attack path(s), ${s.pathsWorse} rated worse.`);
  L.push(''); L.push('### Elements');
  let any = false;
  for (const [kind, e] of Object.entries(d.elements)) { e.added.forEach((x) => { any = true; L.push(`- added ${kind} \`${x.key}\` (${x.label})`); }); e.removed.forEach((x) => { any = true; L.push(`- removed ${kind} \`${x.key}\` (${x.label})`); }); e.changed.forEach((x) => { any = true; L.push(`- changed ${kind} \`${x.key}\`: ${x.fields.join(', ')}`); }); }
  if (!any) L.push('- no element differs from the baseline');
  L.push(''); L.push('### New or altered trust-boundary crossings');
  if (!d.boundaries.length) L.push('- none'); d.boundaries.forEach((b) => L.push(`- ${b.isNew ? 'new' : 'altered'} flow \`${b.flow}\` ${b.from} → ${b.to} (${b.kind}; auth ${b.auth || 'unspecified'}, ${b.strength}; data ${b.classification || 'unclassified'}): ${b.crosses.join(', ')}`));
  L.push(''); L.push('### New Internet-facing paths');
  if (!d.exposure.length) L.push('- none'); d.exposure.forEach((x) => L.push(`- \`${x.flow}\` reaches ${x.target} from the Internet side${x.wasBlocked ? ' (was blocked in the baseline)' : ''}; auth ${x.auth || 'unspecified'} (${x.strength}); data ${x.classification || 'unclassified'}`));
  L.push(''); L.push('### Weakened flows');
  if (!d.weakened.length) L.push('- none'); d.weakened.forEach((w) => L.push(`- \`${w.flow}\` ${w.from} → ${w.to}: ${w.notes.join('; ')}`));
  L.push(''); L.push('### Controls invalidated');
  if (!d.controls.invalidated.length) L.push('- none'); d.controls.invalidated.forEach((c) => L.push(`- ${c.id} ${c.name}: ${c.reason}`));
  L.push(''); L.push('### Threats');
  if (!d.threats.added.length && !d.threats.removed.length && !d.threats.moved.length) L.push('- unchanged');
  d.threats.added.forEach((t) => L.push(`- new ${t.id} ${t.title}: ${t.status || 'identified'}, current ${band(t.current)}${t.projected ? `, projected ${band(t.projected)}` : ''}`));
  d.threats.removed.forEach((t) => L.push(`- removed ${t.id} ${t.title}`));
  d.threats.moved.forEach((t) => L.push(`- ${t.id} ${t.title}: ${t.notes.join('; ')}`));
  L.push(''); L.push('### Attack paths');
  if (!d.paths.added.length && !d.paths.removed.length && !d.paths.moved.length) L.push('- unchanged');
  d.paths.added.forEach((p) => L.push(`- new ${p.id} ${p.title}: ${p.status || 'identified'}, current ${band(p.current)}${p.projected ? `, projected ${band(p.projected)}` : ''}`));
  d.paths.removed.forEach((p) => L.push(`- removed ${p.id} ${p.title}`));
  d.paths.moved.forEach((p) => L.push(`- ${p.id} ${p.title}: ${p.notes.join('; ')}`));
  return L.join('\n') + '\n';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const file = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '--tab');
  if (!file || args.includes('-h') || args.includes('--help')) { console.error('usage: node scripts/scenario.mjs <model.json> [--tab <scenario-tab>] [--json]'); process.exit(file ? 0 : 2); }
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { console.error(`scenario: ${file} is not valid JSON: ${e.message}`); process.exit(2); }
  const want = args[args.indexOf('--tab') + 1];
  const tabs = (model.tabs || []).filter((t) => t.scenario && (!args.includes('--tab') || t.name === want));
  if (!tabs.length) { console.error(args.includes('--tab') ? `scenario: tab "${want}" is not a scenario tab (it needs scenario.baseline and scenario.change)` : 'scenario: the model has no scenario tab; add `scenario: { baseline, change }` to the what-if tab'); process.exit(2); }
  let code = 0; const all = [];
  for (const t of tabs) {
    try { const d = scenarioDelta(model, t); all.push(d); if (!args.includes('--json')) process.stdout.write(toMarkdown(d) + '\n'); } catch (e) { console.error(`scenario: ${e.message}`); code = 1; }
  }
  if (args.includes('--json')) console.log(JSON.stringify(all.length === 1 ? all[0] : all, null, 2));
  process.exit(code);
}
