#!/usr/bin/env node
/**
 * portfolio.mjs — one table across many models: where the risk is, what is overdue, which documents fail their policy.
 *
 *   node scripts/portfolio.mjs <folder | model.json ...> [--no-recursive] [--json] [-o out.md] [--quiet]
 *
 * Finds every *.model.json and model.json under the folders given (archive/ and node_modules/ are skipped), validates each,
 * and prints one row per document: id, version, date, status, diagrams, threats by current band, open threats at high or above,
 * attack paths, controls planned (overdue), requirements verified of total, policy failures, validator errors. Totals at the
 * bottom. Markdown by default; --json gives the rows. Node 18+, no dependencies. Exit 0, 1 bad arguments, 2 nothing found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANDS, computeAssessment, policyCheck, validateModel } from './validate.mjs';

const OPEN = ['identified', 'investigating', 'open'];
const SKIP_DIRS = new Set(['archive', 'node_modules', '.git']);
const bandOf = (r) => { if (!r) return null; if (r.rating_override) return r.rating_override; if (r.rating) return r.rating; const c = computeAssessment(r); return c ? c.rating : null; };
const current = (t) => (t.risk && t.risk.residual && bandOf(t.risk.residual)) || bandOf(t.risk) || 'moderate';

/** Model files under the paths given. */
export function findModels(paths, { recursive = true } = {}) {
  const out = [];
  const walk = (dir, depth) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && (recursive || depth === 0)) walk(p, depth + 1); }
      else if (e.isFile() && (e.name.endsWith('.model.json') || e.name === 'model.json')) out.push(p);
    }
  };
  for (const p of paths) { const st = fs.statSync(p); if (st.isDirectory()) walk(p, 0); else out.push(p); }
  return [...new Set(out.map((p) => path.resolve(p)))];
}

/** One row of the portfolio for a model file. */
export function rowFor(file) {
  let model;
  try { model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) { return { file, error: `not valid JSON: ${e.message}` }; }
  const v = validateModel(JSON.parse(JSON.stringify(model)));
  const scopes = model.tabs || [model];
  const live = (l) => (l || []).filter((x) => x.status !== 'retired');
  const threats = scopes.flatMap((s) => live(s.threats)), paths = scopes.flatMap((s) => live(s.attack_paths)), controls = scopes.flatMap((s) => s.controls || []), reqs = scopes.flatMap((s) => live(s.requirements));
  const today = new Date().toISOString().slice(0, 10);
  const byBand = Object.fromEntries(BANDS.map((b) => [b, threats.filter((t) => current(t) === b).length]));
  const planned = controls.filter((c) => ['proposed', 'planned', 'in-progress'].includes(c.status));
  const m = model.meta || {};
  return {
    file, title: m.title || path.basename(file), document_id: m.document_id || '', version: m.version || '', date: m.date || '', status: m.status || '',
    diagrams: scopes.length, scenarios: scopes.filter((s) => s.scenario).length, threats: threats.length, by_band: byBand,
    open_high: threats.filter((t) => OPEN.includes(t.status) && BANDS.indexOf(current(t)) >= BANDS.indexOf('high')).length,
    attack_paths: paths.length, controls: controls.length, controls_planned: planned.length, controls_overdue: planned.filter((c) => c.due_date && c.due_date < today).length,
    requirements: reqs.length, requirements_verified: reqs.filter((r) => r.status === 'verified').length,
    policy_failures: v.errors.length ? null : policyCheck(model).length, validator_errors: v.errors.length, validator_warnings: v.warnings.length,
  };
}

const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
const rel = (root, file) => path.relative(root, file).split(path.sep).join('/');
export function formatMarkdown(rows, root) {
  const head = ['Document', 'ID', 'Version', 'Date', 'Status', 'Diagrams', 'Threats (VH/H/M/L/VL)', 'Open ≥ High', 'Paths', 'Controls planned (overdue)', 'Requirements verified', 'Policy', 'Validator'];
  const line = (r) => r.error ? [`${rel(root, r.file)}`, '', '', '', '', '', '', '', '', '', '', '', `error: ${r.error}`]
    : [r.title + (root ? ` (${rel(root, r.file)})` : ''), r.document_id, r.version, r.date, r.status, r.diagrams + (r.scenarios ? ` (${r.scenarios} what-if)` : ''), `${r.threats} (${['very-high', 'high', 'moderate', 'low', 'very-low'].map((b) => r.by_band[b]).join('/')})`, r.open_high, r.attack_paths, `${r.controls_planned}${r.controls_overdue ? ` (${r.controls_overdue} overdue)` : ''} of ${r.controls}`, `${r.requirements_verified} of ${r.requirements}`, r.policy_failures == null ? 'not checked' : r.policy_failures ? `${r.policy_failures} failure${r.policy_failures === 1 ? '' : 's'}` : 'within policy', r.validator_errors ? `${r.validator_errors} error(s)` : `ok${r.validator_warnings ? `, ${r.validator_warnings} warning(s)` : ''}`];
  const ok = rows.filter((r) => !r.error);
  const sum = (k) => ok.reduce((n, r) => n + (r[k] || 0), 0);
  const totals = ['**Total**', '', '', '', '', sum('diagrams'), `${sum('threats')} (${['very-high', 'high', 'moderate', 'low', 'very-low'].map((b) => ok.reduce((n, r) => n + r.by_band[b], 0)).join('/')})`, sum('open_high'), sum('attack_paths'), `${sum('controls_planned')}${sum('controls_overdue') ? ` (${sum('controls_overdue')} overdue)` : ''} of ${sum('controls')}`, `${sum('requirements_verified')} of ${sum('requirements')}`, `${ok.filter((r) => r.policy_failures).length} document${ok.filter((r) => r.policy_failures).length === 1 ? '' : 's'} failing`, `${ok.filter((r) => r.validator_errors).length} with errors`];
  return [`# Portfolio: ${rows.length} document${rows.length === 1 ? '' : 's'}`, '', `Generated on ${new Date().toISOString().slice(0, 10)}. Threats are counted at their current rating (controls in place); Open ≥ High counts open threats rated high or very high; Policy is \`validate --strict\` against each model's own settings.policy.`, '',
    '| ' + head.join(' | ') + ' |', '| ' + head.map(() => '-').join(' | ') + ' |', ...rows.map((r) => '| ' + line(r).map(esc).join(' | ') + ' |'), '| ' + totals.map(esc).join(' | ') + ' |', ''].join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const targets = args.filter((a, i) => !a.startsWith('-') && args[i - 1] !== '-o');
  if (!targets.length || args.includes('-h') || args.includes('--help')) { console.error('usage: node scripts/portfolio.mjs <folder | model.json ...> [--no-recursive] [--json] [-o out.md] [--quiet]'); process.exit(targets.length ? 0 : 1); }
  let files;
  try { files = findModels(targets, { recursive: !args.includes('--no-recursive') }); } catch (e) { console.error(`portfolio: ${e.message}`); process.exit(2); }
  if (!files.length) { console.error('portfolio: no *.model.json or model.json found'); process.exit(2); }
  const rows = files.map(rowFor);
  if (args.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  const root = targets.length === 1 && fs.statSync(targets[0]).isDirectory() ? path.resolve(targets[0]) : process.cwd();
  const text = formatMarkdown(rows, root);
  const out = opt('-o');
  if (out) { fs.writeFileSync(out, text, 'utf8'); if (!args.includes('--quiet')) console.log(`wrote ${out} (${rows.length} document(s))`); }
  else process.stdout.write(text);
}
