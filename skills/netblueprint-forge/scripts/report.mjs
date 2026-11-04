#!/usr/bin/env node
/**
 * report.mjs — the model as a document for its readers: executive summary, developer list, audit evidence.
 *
 *   node scripts/report.mjs <model.json> [--kind exec|developer|audit|all] [-o out.md] [--quiet]
 *
 * exec:      the risk picture: threats by current band (inherent and projected beside it), the open threats in order, the attack
 *            paths, accepted risks and their review dates, requirements and controls by status, the policy result.
 * developer: what to build: planned and in-progress controls by owner with due date, ticket, the threats they close and the
 *            requirements they satisfy; suggested mitigations not yet converted; open threats with no plan; validator warnings.
 * audit:     what was shown: verified controls with their verification and evidence, implemented-but-unverified controls, the
 *            requirements grouped by the framework clauses they serve, accepted risks with approver and rationale, every threat
 *            with its status and controls, the policy result.
 * all (default): the three in one document. Markdown on stdout, or to -o. Node 18+, no dependencies. Exit 0, 1 bad arguments, 2 I/O.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANDS, computeAssessment, policyCheck, validateModel } from './validate.mjs';

const BAND_LABEL = { 'very-low': 'Very Low', low: 'Low', moderate: 'Moderate', high: 'High', 'very-high': 'Very High' };
const OPEN = ['identified', 'investigating', 'open'];
const pretty = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const bandOf = (r) => { if (!r) return null; if (r.rating_override) return r.rating_override; if (r.rating) return r.rating; const c = computeAssessment(r); return c ? c.rating : null; };
const inherent = (t) => bandOf(t.risk) || 'moderate';
const current = (t) => (t.risk && t.risk.residual && bandOf(t.risk.residual)) || inherent(t);
const projected = (t) => (t.risk && t.risk.projected && bandOf(t.risk.projected)) || null;
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const table = (head, rows) => rows.length ? ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '-').join(' | ') + ' |', ...rows.map((r) => '| ' + r.map(esc).join(' | ') + ' |')].join('\n') : '_None._';
const list = (items) => items.length ? items.map((i) => '- ' + i).join('\n') : '_None._';

/** The scopes of a model with their labels: [{ tab, label, scenario, zones, nodes, flows, threats, controls, requirements, attack_paths }]. */
export function scopesOf(model) {
  return model.tabs ? model.tabs.map((t) => ({ tab: t.name, label: t.label, scenario: !!t.scenario, ...t })) : [{ tab: null, label: null, scenario: false, ...model }];
}
const live = (list) => (list || []).filter((x) => x.status !== 'retired');
const tag = (s) => s.tab ? ` (${s.label})` : '';

/** Everything the three reports read, computed once. */
export function gather(model) {
  const scopes = scopesOf(model);
  const threats = scopes.flatMap((s) => live(s.threats).map((t) => ({ s, t })));
  const paths = scopes.flatMap((s) => live(s.attack_paths).map((p) => ({ s, p })));
  const controls = scopes.flatMap((s) => (s.controls || []).map((c) => ({ s, c })));
  const reqs = scopes.flatMap((s) => live(s.requirements).map((r) => ({ s, r })));
  const ctl = (s, id) => (s.controls || []).find((c) => c.id === id);
  const thr = (s, id) => (s.threats || []).find((t) => t.id === id);
  const today = new Date().toISOString().slice(0, 10);
  const policy = policyCheck(model);
  const v = validateModel(JSON.parse(JSON.stringify(model)));
  return { scopes, threats, paths, controls, reqs, ctl, thr, today, policy, warnings: v.warnings, errors: v.errors };
}

function header(model, kind) {
  const m = model.meta;
  const facts = [['Document', m.document_id], ['Version', m.version], ['Date', m.date], ['Status', m.status], ['Prepared by', m.author], ['Reviewed by', m.reviewed_by], ['Approved by', m.approved_by], ['Classification', m.document_classification], ['Organization', m.organization]].filter(([, v]) => v);
  return [`# ${m.title}`, '', `${kind} report generated from the NetBlueprint model on ${new Date().toISOString().slice(0, 10)}.`, '', table(['Field', 'Value'], facts.map(([k, v]) => [k, v])), ''].join('\n');
}

export function execReport(model, G) {
  const out = ['## Risk at a glance', ''];
  const count = (f) => BANDS.map((b) => G.threats.filter((x) => f(x.t) === b).length);
  const ci = count(inherent), cc = count(current), cp = BANDS.map((b) => G.threats.filter((x) => (projected(x.t) || current(x.t)) === b).length);
  out.push(table(['Band', 'Inherent (no controls)', 'Current (controls in place)', 'Projected (after planned controls)'], [...BANDS].reverse().map((b, i) => { const k = BANDS.length - 1 - i; return [BAND_LABEL[b], ci[k], cc[k], cp[k]]; })), '');
  out.push(`${G.threats.length} threat${G.threats.length === 1 ? '' : 's'} across ${G.scopes.length} diagram${G.scopes.length === 1 ? '' : 's'}${G.scopes.some((s) => s.scenario) ? ' (what-if scenario tabs included)' : ''}; ${G.paths.length} attack path${G.paths.length === 1 ? '' : 's'}; ${G.reqs.length} requirement${G.reqs.length === 1 ? '' : 's'}; ${G.controls.length} control${G.controls.length === 1 ? '' : 's'}.`, '');
  out.push('## Open threats, highest current rating first', '');
  const open = G.threats.filter((x) => OPEN.includes(x.t.status)).sort((a, b) => BANDS.indexOf(current(b.t)) - BANDS.indexOf(current(a.t)) || a.t.number - b.t.number);
  out.push(table(['#', 'Threat', 'Current', 'Inherent', 'Projected', 'Decision', 'Planned controls', 'Diagram'], open.map(({ s, t }) => { const tr = t.treatment || {}; const planned = [...new Set([...(tr.planned_controls || []), ...(tr.controls || [])])].map((id) => G.ctl(s, id)).filter((c) => c && ['proposed', 'planned', 'in-progress'].includes(c.status)); return [t.number, `${t.id} ${t.title}`, BAND_LABEL[current(t)], BAND_LABEL[inherent(t)], projected(t) ? BAND_LABEL[projected(t)] : '', pretty(tr.decision || 'undecided'), planned.map((c) => `${c.id}${c.due_date ? ' (due ' + c.due_date + ')' : ''}`).join(', '), s.label || 'main']; })), '');
  out.push('## Attack paths', '');
  out.push(table(['#', 'Attack path', 'Current', 'Status', 'Hops', 'Broken by', 'Diagram'], G.paths.map(({ s, p }) => [p.number, `${p.id} ${p.title}`, p.risk ? (BAND_LABEL[(p.risk.residual && bandOf(p.risk.residual)) || bandOf(p.risk)] || '') : '', pretty(p.status || 'identified'), (p.hops || []).length, (p.breaks_at || []).map((id) => { const c = G.ctl(s, id); return c ? `${id} (${pretty(c.status)})` : id; }).join(', '), s.label || 'main'])), '');
  out.push('## Accepted risks', '');
  const acc = G.threats.filter((x) => x.t.status === 'accepted');
  out.push(table(['#', 'Threat', 'Current', 'Approved by', 'On', 'Review by', 'Rationale'], acc.map(({ t }) => { const a = (t.treatment || {}).acceptance || {}; return [t.number, `${t.id} ${t.title}`, BAND_LABEL[current(t)], a.approved_by || '', a.date || '', a.review_by ? (a.review_by < G.today ? a.review_by + ' (overdue)' : a.review_by) : '', a.rationale || '']; })), '');
  out.push('## Requirements and controls by status', '');
  const byStatus = (items, key, order) => order.map((st) => [pretty(st), items.filter((x) => x[key].status === st).length]).filter(([, n]) => n);
  out.push('Requirements: ' + (byStatus(G.reqs, 'r', ['proposed', 'approved', 'implemented', 'verified', 'waived']).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ') || 'none') + '.', '');
  out.push('Controls: ' + (byStatus(G.controls, 'c', ['proposed', 'planned', 'in-progress', 'implemented', 'verified', 'not-implemented', 'retired']).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ') || 'none') + '.', '');
  const overdue = G.controls.filter(({ c }) => ['proposed', 'planned', 'in-progress'].includes(c.status) && c.due_date && c.due_date < G.today);
  if (overdue.length) out.push('Overdue: ' + overdue.map(({ c }) => `${c.id} ${c.name} (due ${c.due_date}${c.owner ? ', ' + c.owner : ''})`).join('; ') + '.', '');
  out.push('## Policy', '', G.policy.length ? list(G.policy) : '_Within policy (`validate --strict` passes)._', '');
  return out.join('\n');
}

export function developerReport(model, G) {
  const out = ['## Planned and in-progress controls, by owner', ''];
  const todo = G.controls.filter(({ c }) => ['proposed', 'planned', 'in-progress'].includes(c.status));
  const owners = [...new Set(todo.map(({ c }) => c.owner || 'Unassigned'))].sort();
  if (!todo.length) out.push('_Nothing planned: every control is implemented, verified or retired._', '');
  owners.forEach((o) => {
    out.push(`### ${o}`, '');
    out.push(table(['Control', 'Status', 'Due', 'Ticket', 'Closes', 'Satisfies', 'Where'], todo.filter(({ c }) => (c.owner || 'Unassigned') === o).sort((a, b) => (a.c.due_date || '9999') < (b.c.due_date || '9999') ? -1 : 1).map(({ s, c }) => {
      const closes = live(s.threats).filter((t) => [...((t.treatment || {}).controls || []), ...((t.treatment || {}).planned_controls || [])].includes(c.id)).map((t) => `${t.id} (${BAND_LABEL[current(t)]})`);
      const sat = live(s.requirements).filter((r) => (r.controls || []).includes(c.id)).map((r) => r.id);
      return [`${c.id} ${c.name}`, pretty(c.status), c.due_date ? (c.due_date < G.today ? c.due_date + ' (overdue)' : c.due_date) : '', c.ticket || '', closes.join(', '), sat.join(', '), (c.implemented_on || []).map((x) => x.ref).join(', ')];
    })), '');
  });
  out.push('## Suggested mitigations not yet converted into controls', '');
  const sugg = G.threats.flatMap(({ s, t }) => ((t.treatment || {}).suggested_mitigations || []).filter((m) => ['suggested', 'accepted'].includes(m.status || 'suggested')).map((m) => `${t.id} ${t.title} (${BAND_LABEL[current(t)]}): ${m.text}${m.status === 'accepted' ? ' _(accepted)_' : ''}`));
  out.push(list(sugg), '');
  out.push('## Open threats with no planned control', '');
  const noplan = G.threats.filter(({ s, t }) => OPEN.includes(t.status) && ![...((t.treatment || {}).controls || []), ...((t.treatment || {}).planned_controls || [])].some((id) => { const c = G.ctl(s, id); return c && ['proposed', 'planned', 'in-progress', 'implemented', 'verified'].includes(c.status); }));
  out.push(list(noplan.map(({ t }) => `${t.id} ${t.title} (${BAND_LABEL[current(t)]}, ${pretty(t.status)})`)), '');
  out.push('## What the validator still warns about', '', list(G.warnings), '');
  return out.join('\n');
}

export function auditReport(model, G) {
  const out = ['## Verified controls and their evidence', ''];
  const ver = G.controls.filter(({ c }) => c.status === 'verified');
  out.push(table(['Control', 'Verification', 'Verified on', 'Evidence', 'Owner'], ver.map(({ c }) => [`${c.id} ${c.name}`, pretty(c.verification), c.verified_on || '', (c.evidence || []).map((e) => `${pretty(e.kind)}: ${e.reference || ''}${e.by ? ' (' + e.by + ')' : ''}${e.date ? ', ' + e.date : ''}`).join('; ') || '_none recorded_', c.owner || ''])), '');
  out.push('## Implemented but not verified', '');
  out.push(list(G.controls.filter(({ c }) => c.status === 'implemented').map(({ c }) => `${c.id} ${c.name}${c.owner ? ' (' + c.owner + ')' : ''}`)), '');
  out.push('## Requirements by framework clause', '');
  const rows = [];
  G.reqs.forEach(({ s, r }) => (r.frameworks || []).forEach((f) => rows.push([f.framework, f.clause, `${r.id} ${r.title}`, pretty(r.status), (r.controls || []).map((id) => { const c = G.ctl(s, id); return c ? `${id} (${pretty(c.status)})` : id; }).join(', ')])));
  G.controls.forEach(({ s, c }) => (c.frameworks || []).forEach((f) => rows.push([f.framework, f.clause, `control ${c.id} ${c.name}`, pretty(c.status), ''])));
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1], undefined, { numeric: true }));
  out.push(table(['Framework', 'Clause', 'Requirement or control', 'Status', 'Satisfied by'], rows), '');
  out.push('## Requirements', '');
  out.push(table(['#', 'Requirement', 'Kind', 'Status', 'Answers', 'Satisfied by', 'Owner'], G.reqs.map(({ s, r }) => [r.number, `${r.id} ${r.title}: ${r.statement}`, pretty(r.kind || 'security'), pretty(r.status), (r.threats || []).join(', '), (r.controls || []).map((id) => { const c = G.ctl(s, id); return c ? `${id} (${pretty(c.status)})` : id; }).join(', '), r.owner || ''])), '');
  out.push('## Accepted risks', '');
  out.push(table(['Threat', 'Current', 'Approved by', 'On', 'Rationale', 'Review by'], G.threats.filter(({ t }) => t.status === 'accepted').map(({ t }) => { const a = (t.treatment || {}).acceptance || {}; return [`${t.id} ${t.title}`, BAND_LABEL[current(t)], a.approved_by || '', a.date || '', a.rationale || '', a.review_by || '']; })), '');
  out.push('## Every threat and its controls', '');
  out.push(table(['#', 'Threat', 'Status', 'Current', 'Controls', 'Diagram'], [...G.threats].sort((a, b) => a.t.number - b.t.number).map(({ s, t }) => [t.number, `${t.id} ${t.title}`, pretty(t.status), BAND_LABEL[current(t)], ((t.treatment || {}).controls || []).map((id) => { const c = G.ctl(s, id); return c ? `${id} (${pretty(c.status)})` : id; }).join(', '), s.label || 'main'])), '');
  out.push('## Policy', '', G.policy.length ? list(G.policy) : '_Within policy (`validate --strict` passes)._', '');
  return out.join('\n');
}

export function report(model, kind = 'all') {
  const G = gather(model);
  const parts = [];
  if (kind === 'exec' || kind === 'all') parts.push(header(model, 'Executive'), execReport(model, G));
  if (kind === 'developer' || kind === 'all') parts.push(kind === 'all' ? '# Developer view\n' : header(model, 'Developer'), developerReport(model, G));
  if (kind === 'audit' || kind === 'all') parts.push(kind === 'all' ? '# Audit view\n' : header(model, 'Audit'), auditReport(model, G));
  return parts.join('\n') + '\n';
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const file = args.find((a, i) => !a.startsWith('-') && !['--kind', '-o'].includes(args[i - 1]));
  const kind = opt('--kind') || 'all';
  if (!file || args.includes('-h') || args.includes('--help') || !['exec', 'developer', 'audit', 'all'].includes(kind)) { console.error('usage: node scripts/report.mjs <model.json> [--kind exec|developer|audit|all] [-o out.md] [--quiet]'); process.exit(file ? 0 : 1); }
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { console.error(`report: ${file}: ${e.message}`); process.exit(2); }
  const text = report(model, kind);
  const out = opt('-o');
  if (out) { fs.writeFileSync(out, text, 'utf8'); if (!args.includes('--quiet')) console.log(`wrote ${out} (${text.split('\n').length} lines, ${kind})`); }
  else process.stdout.write(text);
}
