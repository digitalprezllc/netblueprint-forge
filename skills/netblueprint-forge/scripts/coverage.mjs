#!/usr/bin/env node
/**
 * coverage.mjs — which controls and requirements of a model touch which clause of a framework.
 *
 *   node scripts/coverage.mjs <model.json> [--framework <id>] [--gaps] [--json] [-o out.md] [--quiet]
 *   node scripts/coverage.mjs --frameworks                       list the frameworks the crosswalk knows
 *
 * Two sources feed a clause: what the model says directly (a control's or requirement's frameworks[] entries, a control's
 * iso_27001 ids, its nist_800_53 ids for the NIST framework itself) and what the crosswalk derives (a control's nist_800_53
 * ids mapped to the other frameworks' clauses by assets/frameworks/crosswalk.json). A frameworks.json beside the model, of the
 * same shape, extends or overrides the crosswalk: its controls and clauses are merged by id. The output, per framework, is one
 * table: clause, title, the controls that touch it with their status, the requirements that cite it, and the coverage level
 * (verified, implemented, planned, none). --gaps adds the clauses the crosswalk knows for which the model has nothing; --framework
 * limits the output to one framework (default: every framework something touches). Coverage says a control contributes to a clause;
 * whether the clause is satisfied is the assessor's call. Node 18+, no dependencies. Exit 0, 1 bad arguments, 2 I/O.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CROSSWALK_PATH = path.join(here, '..', 'assets', 'frameworks', 'crosswalk.json');
export const LOCAL_NAME = 'frameworks.json';
const LEVEL = { verified: 3, implemented: 2, 'in-progress': 1, planned: 1, proposed: 1 };
const LEVEL_LABEL = ['none', 'planned', 'implemented', 'verified'];
const pretty = (s) => String(s || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));

/** The crosswalk, with a model's frameworks.json merged in when one sits beside the model. */
export function loadCrosswalk(modelPath) {
  const base = readJson(CROSSWALK_PATH);
  const local = modelPath ? path.join(path.dirname(path.resolve(modelPath)), LOCAL_NAME) : null;
  if (local && fs.existsSync(local)) {
    const extra = readJson(local);
    base.frameworks = { ...base.frameworks, ...(extra.frameworks || {}) };
    for (const [fw, clauses] of Object.entries(extra.clauses || {})) base.clauses[fw] = { ...(base.clauses[fw] || {}), ...clauses };
    for (const [id, entry] of Object.entries(extra.controls || {})) base.controls[id] = { ...(base.controls[id] || {}), ...entry };
    base.local = local;
  }
  return base;
}

/** Coverage of a model: { frameworks: { <id>: { title, clauses: { <clause>: { title, controls: [{id,name,status,via}], requirements: [{id,title,status}], level } } } } }. */
export function coverageOf(model, cw) {
  const scopes = model.tabs || [model];
  const out = {};
  const fwOf = (id) => { if (!out[id]) out[id] = { title: (cw.frameworks[id] || {}).title || id, clauses: {} }; return out[id]; };
  const clauseOf = (fw, clause) => { const f = fwOf(fw); if (!f.clauses[clause]) f.clauses[clause] = { title: ((cw.clauses[fw] || {})[clause]) || '', controls: [], requirements: [], level: 0 }; return f.clauses[clause]; };
  const addControl = (fw, clause, c, via) => { const cl = clauseOf(fw, clause); if (!cl.controls.some((x) => x.id === c.id)) cl.controls.push({ id: c.id, name: c.name, status: c.status, via }); };
  for (const s of scopes) {
    for (const c of s.controls || []) {
      if (c.status === 'retired') continue;
      for (const f of c.frameworks || []) addControl(f.framework, f.clause, c, 'direct');
      for (const id of c.iso_27001 || []) addControl('iso-27001-2022', id, c, 'direct');
      for (const id of c.nist_800_53 || []) {
        addControl('nist-800-53-r5', id, c, 'direct');
        const entry = cw.controls[id];
        if (!entry) continue;
        for (const [fw, clauses] of Object.entries(entry)) { if (fw === 'title' || !Array.isArray(clauses)) continue; for (const clause of clauses) addControl(fw, clause, c, `crosswalk from ${id}`); }
      }
    }
    for (const r of (s.requirements || []).filter((x) => x.status !== 'retired')) {
      for (const f of r.frameworks || []) { const cl = clauseOf(f.framework, f.clause); if (!cl.requirements.some((x) => x.id === r.id)) cl.requirements.push({ id: r.id, title: r.title, status: r.status }); }
    }
  }
  for (const fw of Object.values(out)) for (const cl of Object.values(fw.clauses)) cl.level = cl.controls.reduce((m, c) => Math.max(m, LEVEL[c.status] || 0), 0);
  for (const [id, fw] of Object.entries(out)) if (cw.clauses[id]) for (const [clause, title] of Object.entries(cw.clauses[id])) if (fw.clauses[clause] && !fw.clauses[clause].title) fw.clauses[clause].title = title;
  if (out['nist-800-53-r5']) for (const [id, cl] of Object.entries(out['nist-800-53-r5'].clauses)) if (!cl.title && cw.controls[id]) cl.title = cw.controls[id].title;
  return { frameworks: out, local: cw.local || null };
}

const clauseSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function formatMarkdown(model, cov, cw, { framework = null, gaps = false } = {}) {
  const out = [`# Framework coverage: ${model.meta.title}`, '', `Generated on ${new Date().toISOString().slice(0, 10)} from the model's controls and requirements${cov.local ? ` and the crosswalk extended by ${path.basename(cov.local)}` : ''}. A control listed under a clause contributes to it; "via crosswalk" means the link comes from the control's NIST SP 800-53 ids through DigitalPrez's working crosswalk, not from the model itself. Coverage is the best status among the controls: verified, implemented, planned or none.`, ''];
  const ids = Object.keys(cov.frameworks).filter((id) => !framework || id === framework).sort();
  if (framework && !ids.length) out.push(`_Nothing in the model touches ${framework}${cw.frameworks[framework] ? '' : ', which the crosswalk does not know either'}._`, '');
  for (const id of ids) {
    const fw = cov.frameworks[id];
    const clauses = Object.keys(fw.clauses);
    const known = Object.keys(cw.clauses[id] || {});
    const missing = gaps ? known.filter((c) => !fw.clauses[c]) : [];
    const levels = [0, 0, 0, 0]; clauses.forEach((c) => levels[fw.clauses[c].level]++);
    out.push(`## ${fw.title} (${id})`, '', `${clauses.length} clause${clauses.length === 1 ? '' : 's'} touched: ${levels[3]} verified, ${levels[2]} implemented, ${levels[1]} planned, ${levels[0]} with requirements only${known.length ? `; the crosswalk knows ${known.length} clauses of this framework${gaps ? `, ${missing.length} of them untouched` : ''}` : ''}.`, '');
    out.push('| Clause | Title | Controls | Requirements | Coverage |', '| - | - | - | - | - |');
    for (const c of [...clauses].sort(clauseSort)) {
      const cl = fw.clauses[c];
      out.push(`| ${c} | ${cl.title} | ${cl.controls.map((k) => `${k.id} (${pretty(k.status)}${k.via === 'direct' ? '' : ', via crosswalk'})`).join('; ')} | ${cl.requirements.map((r) => `${r.id} (${pretty(r.status)})`).join('; ')} | ${LEVEL_LABEL[cl.level]} |`);
    }
    if (missing.length) { out.push('', `Untouched clauses of ${id}: ` + missing.sort(clauseSort).map((c) => `${c} ${cw.clauses[id][c]}`).join('; ') + '.'); }
    out.push('');
  }
  return out.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--frameworks')) { const cw = loadCrosswalk(null); Object.entries(cw.frameworks).forEach(([id, f]) => console.log(`${id.padEnd(22)} ${f.title} (${f.publisher}; ${f.terms}); ${id === 'nist-800-53-r5' ? Object.keys(cw.controls).length : Object.keys(cw.clauses[id] || {}).length} ${id === 'nist-800-53-r5' ? 'controls' : 'clauses'} known`)); console.log(`${Object.keys(cw.controls).length} NIST SP 800-53 controls in the crosswalk`); process.exit(0); }
  const file = args.find((a, i) => !a.startsWith('-') && !['--framework', '-o'].includes(args[i - 1]));
  if (!file || args.includes('-h') || args.includes('--help')) { console.error('usage: node scripts/coverage.mjs <model.json> [--framework <id>] [--gaps] [--json] [-o out.md] | --frameworks'); process.exit(file ? 0 : 1); }
  let model, cw;
  try { model = readJson(file); cw = loadCrosswalk(file); } catch (e) { console.error(`coverage: ${e.message}`); process.exit(2); }
  const cov = coverageOf(model, cw);
  if (args.includes('--json')) { console.log(JSON.stringify(cov, null, 2)); process.exit(0); }
  const text = formatMarkdown(model, cov, cw, { framework: opt('--framework'), gaps: args.includes('--gaps') });
  const out = opt('-o');
  if (out) { fs.writeFileSync(out, text, 'utf8'); if (!args.includes('--quiet')) console.log(`wrote ${out}`); } else process.stdout.write(text);
}
