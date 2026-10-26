#!/usr/bin/env node
/**
 * build.mjs — render a NetBlueprint model to a self-contained HTML file.
 *
 *   node scripts/build.mjs <model.json> [-o out.html] [--template path] [--no-validate]
 *
 * Node 18+, no dependencies. The model JSON is embedded into the template's
 * <script id="nb-model" type="application/json"> slot; layout happens in the browser.
 * If scripts/validate.mjs exists it runs first and a failing model is not built.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const has = (flag) => args.includes(flag);
const modelPath = args.find((a, i) => !a.startsWith('-') && args[i - 1] !== '-o' && args[i - 1] !== '--template');

if (!modelPath || has('-h') || has('--help')) {
  console.error('usage: node scripts/build.mjs <model.json> [-o out.html] [--template path] [--no-validate]');
  process.exit(modelPath ? 0 : 2);
}

const templatePath = opt('--template') || path.join(here, '..', 'assets', 'template', 'template.html');
const outPath = opt('-o') || modelPath.replace(/\.model\.json$|\.json$/i, '') + '.html';

const raw = fs.readFileSync(modelPath, 'utf8').replace(/^﻿/, '');
let model;
try { model = JSON.parse(raw); }
catch (e) { console.error(`build: ${modelPath} is not valid JSON: ${e.message}`); process.exit(1); }

if (!/^1(\.\d+)?$/.test(String(model.netblueprint || ''))) {
  console.error(`build: unsupported model format version "${model.netblueprint}" (this renderer understands 1.x)`);
  process.exit(1);
}

if (!has('--no-validate')) {
  let validate = null;
  try { validate = (await import('./validate.mjs')).validateModel; } catch { /* validator not present yet */ }
  if (validate) {
    const res = validate(model, { modelPath });
    for (const w of res.warnings || []) console.warn(`warning: ${w}`);
    if (res.errors && res.errors.length) {
      for (const e of res.errors) console.error(`error: ${e}`);
      console.error(`build: ${res.errors.length} error(s); not building. Fix the model or pass --no-validate.`);
      process.exit(1);
    }
  } else {
    console.warn('build: scripts/validate.mjs not found; building without validation.');
  }
}

const template = fs.readFileSync(templatePath, 'utf8').replace(/Copyright \(c\) (\d{4})-\d{4} DigitalPrez, LLC/, (m, first) => `Copyright (c) ${first}-${new Date().getFullYear()} DigitalPrez, LLC`); // the notice keeps the template's first-publication year and carries the build year
const slot = '/*__MODEL_JSON__*/null';
if (!template.includes(slot)) { console.error(`build: template has no ${slot} slot: ${templatePath}`); process.exit(1); }

// '<' is escaped so no '</script>' or '<!--' sequence can appear inside the JSON block.
const json = JSON.stringify(model).replace(/</g, '\\u003c');
const title = `${model.meta && model.meta.title ? model.meta.title : 'NetBlueprint'} · NetBlueprint`;
const html = template
  .replace(slot, () => json)
  .replace(/<title>[^<]*<\/title>/, () => `<title>${title.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</title>`);

fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, html, { encoding: 'utf8' });

const count = (k) => (model.tabs ? model.tabs.reduce((n, t) => n + (t[k] || []).length, 0) : (model[k] || []).length);
const whatIf = model.tabs ? model.tabs.filter((t) => t.scenario).length : 0;
console.log(`built ${outPath} (${(html.length / 1024).toFixed(0)} KB): ${count('zones')} zones, ${count('nodes')} nodes, ${count('flows')} flows, ${count('steps')} steps, ${count('threats')} threats, ${count('controls')} controls${count('attack_paths') ? `, ${count('attack_paths')} attack paths` : ''}${model.tabs ? ` in ${model.tabs.length} tabs${whatIf ? ` (${whatIf} what-if)` : ''}` : ''}`);
