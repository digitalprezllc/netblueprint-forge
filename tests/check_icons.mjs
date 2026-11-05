#!/usr/bin/env node
// Checks the vendor icon library and its use (no dependencies, no browser):
//   1. the shipped index files in skills/netblueprint-forge/assets/icons parse, hold real icons, and every alias points at one;
//   2. every cloud card declares an icon that resolves;
//   3. every example model's icons resolve, no example carries an icons.json of fetched logos, and each built example page carries one <symbol> per distinct icon it uses, with unique ids,
//      every <style> inside a symbol scoped to prefixed class names, and the symbols within a size budget; the comment at the top of the
//      file names every icon set the page carries and nothing about them shows on the page;
//   4. the normalizer prefixes ids, url(#) references and classes, and leaves colours alone;
//   5. fetch on demand (offline, from a folder): a logo lands in icons.json beside the model, normalized and prefixed, and resolves from
//      there; an SVG with a script and a name the source lacks are refused.
//   node tests/check_icons.mjs            exit 0 when everything passes, 1 otherwise
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVIDERS, SOURCES, REF_PATTERN, loadIndex, resolveIcon, cardIcons, collectIcons, normalizeSvg, symbolId, fetchIcons, useLocalIndex } from '../skills/netblueprint-forge/scripts/icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => { console.log('FAIL  ' + m); fails++; };

// 1. indexes
for (const p of PROVIDERS) {
  const idx = loadIndex(p);
  if (!idx) { fail(`${p}: assets/icons/${p}.json is missing`); continue; }
  const ids = Object.keys(idx.icons);
  const bad = ids.filter((id) => !REF_PATTERN.test(`${p}/${id}`) || !idx.icons[id].viewBox || !idx.icons[id].body);
  const badAlias = Object.entries(idx.aliases || {}).filter(([, t]) => !idx.icons[t]);
  if (ids.length < 100) fail(`${p}: only ${ids.length} icons`); else if (bad.length) fail(`${p}: ${bad.length} malformed entries (${bad.slice(0, 3).join(', ')})`); else if (badAlias.length) fail(`${p}: aliases without a target: ${badAlias.map(([a]) => a).join(', ')}`);
  else pass(`${p}: ${ids.length} icons, ${Object.keys(idx.aliases || {}).length} aliases, terms recorded (${idx.terms ? 'yes' : 'no'}), retrieved ${idx.retrieved}`);
}

// 2. cards
const cards = cardIcons();
const cardIds = Object.keys(cards);
const unresolved = cardIds.filter((c) => !resolveIcon(cards[c]));
if (cardIds.length < 36) fail(`only ${cardIds.length} cloud cards declare an icon`);
else if (unresolved.length) fail(`card icons not in the library: ${unresolved.map((c) => `${c} -> ${cards[c]}`).join(', ')}`);
else pass(`${cardIds.length} cloud cards declare an icon and every one resolves`);

// 3. examples and their built pages
const examples = fs.readdirSync(path.join(ROOT, 'examples')).map((d) => ({ d, model: path.join(ROOT, 'examples', d, `${d}.model.json`), page: path.join(ROOT, 'examples', d, `${d}.html`) })).filter((e) => fs.existsSync(e.model));
for (const e of examples) {
  const model = JSON.parse(fs.readFileSync(e.model, 'utf8').replace(/^﻿/, ''));
  if (fs.existsSync(path.join(path.dirname(e.model), 'icons.json'))) { fail(`${e.d}: carries an icons.json; the shipped examples hold no fetched logos (D39)`); continue; }
  useLocalIndex(e.model);
  const { refs, missing } = collectIcons(model, cards);
  if (missing.length) { fail(`${e.d}: icons not in the library: ${missing.join(', ')}`); continue; }
  const want = new Set([...refs.keys()].map((r) => { const x = resolveIcon(r); return symbolId(x.provider, x.id); }));
  if (!fs.existsSync(e.page)) { pass(`${e.d}: ${refs.size} icon references resolve (page not built, symbols not checked)`); continue; }
  const html = fs.readFileSync(e.page, 'utf8');
  const symbols = [...html.matchAll(/<symbol id="(vi-[^"]+)" viewBox="[^"]+">([\s\S]*?)<\/symbol>/g)];
  const got = symbols.map((m) => m[1]);
  const dup = got.filter((id, i) => got.indexOf(id) !== i);
  const missingSym = [...want].filter((id) => !got.includes(id)), extra = got.filter((id) => !want.has(id));
  const unscoped = symbols.filter((m) => [...m[2].matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].some((s) => /\.(?!vi-)[A-Za-z_]/.test(s[1])));
  const bytes = symbols.reduce((n, m) => n + m[0].length, 0);
  if (dup.length) fail(`${e.d}: duplicate symbols ${dup.join(', ')}`);
  else if (missingSym.length || extra.length) fail(`${e.d}: symbols differ from the model's icons (missing ${missingSym.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'})`);
  else if (unscoped.length) fail(`${e.d}: ${unscoped.length} symbol(s) carry an unscoped <style>`);
  else if (bytes > 200 * 1024) fail(`${e.d}: symbols take ${(bytes / 1024).toFixed(0)} KB (budget 200 KB)`);
  else pass(`${e.d}: ${got.length} symbols for ${refs.size} icon references, ${(bytes / 1024).toFixed(0)} KB, ids unique, styles scoped`);
  const used = new Set([...refs.keys()].map((r) => resolveIcon(r).provider));
  const notice = (html.match(/^<!--\n  Service icons in this page: ([^\n]*)\.\n/m) || [])[1] || '';
  const onPage = /Service icons|belong to their owners/.test(html.slice(html.indexOf('<body')));
  if (used.size && [...used].every((p) => notice.includes(SOURCES[p].name)) && !onPage) pass(`${e.d}: the comment at the top of the file names ${used.size} icon set(s); nothing about them shows on the page`);
  else if (!used.size && !notice && !onPage) pass(`${e.d}: no vendor icons, no icon notice`);
  else fail(`${e.d}: icon notice ${notice ? JSON.stringify(notice) : 'missing'} for ${[...used].join(', ') || 'no icons'}${onPage ? '; the page shows an icon credit' : ''}`);
}

// 4. the normalizer
try {
  const { viewBox, body } = normalizeSvg('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><!-- c --><title>T</title><defs><style>.a{fill:#123456}</style><linearGradient id="g1"><stop stop-color="#abcdef"/></linearGradient></defs><path class="a" d="M0 0h18v18H0z" fill="url(#g1)"/></svg>', 'vi-t-x');
  const ok = viewBox === '0 0 18 18' && body.includes('id="vi-t-x-g1"') && body.includes('url(#vi-t-x-g1)') && body.includes('class="vi-t-x-a"') && body.includes('.vi-t-x-a{fill:#123456}') && body.includes('#abcdef') && !body.includes('<title>') && !body.includes('<!--');
  if (ok) pass('normalizer: viewBox from width/height, ids, url(#) and classes prefixed, colours and comments handled'); else fail(`normalizer output unexpected: ${body}`);
} catch (err) { fail(`normalizer threw: ${err.message}`); }

// 5. fetch on demand, offline: a folder stands in for the CDN
try {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-icons-')); const src = path.join(tmp, 'source'); const proj = path.join(tmp, 'model'); fs.mkdirSync(src); fs.mkdirSync(proj);
  fs.writeFileSync(path.join(src, 'acme-firewall.svg'), '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><title>Acme</title><defs><linearGradient id="g"><stop stop-color="#c00"/></linearGradient></defs><rect width="32" height="24" rx="4" fill="url(#g)"/></svg>');
  fs.writeFileSync(path.join(src, 'evil.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script></svg>');
  const model = path.join(proj, 'model.json'); fs.writeFileSync(model, '{}');
  const { fetched, file } = await fetchIcons(['dashboard/acme-firewall'], { model, source: src });
  const idx = JSON.parse(fs.readFileSync(file, 'utf8')); const e = idx.icons['dashboard/acme-firewall'];
  useLocalIndex(model); const r = resolveIcon('dashboard/acme-firewall');
  let refused = false; try { await fetchIcons(['dashboard/evil'], { model, source: src }); } catch (err) { refused = /<script>/.test(err.message); }
  let missing = false; try { await fetchIcons(['dashboard/nope'], { model, source: src }); } catch (err) { missing = err.status === 404; }
  let shippedRefused = false; try { await fetchIcons(['azure/firewalls'], { model, source: src }); } catch (err) { shippedRefused = /ship with the skill/.test(err.message); }
  const again = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ok = fetched.length === 1 && path.basename(file) === 'icons.json' && path.dirname(file) === proj && e && e.viewBox === '0 0 32 24' && e.kind === 'logo' && e.body.includes('id="vi-dashboard-acme-firewall-g"') && e.body.includes('url(#vi-dashboard-acme-firewall-g)') && !e.body.includes('<title>')
    && idx.sources && idx.sources.dashboard && /property of their respective owners/.test(idx.sources.dashboard.terms) && r && r.local && r.id === 'acme-firewall' && symbolId(r.provider, r.id) === 'vi-dashboard-acme-firewall'
    && refused && missing && shippedRefused && !again.icons['dashboard/evil'] && again.icons['dashboard/acme-firewall'] && REF_PATTERN.test('dashboard/acme-firewall');
  if (ok) pass('fetch: a logo lands in icons.json beside the model, normalized and prefixed, and resolves from there; a script-bearing SVG, a missing name and a shipped provider are refused'); else fail(`fetch: unexpected result ${JSON.stringify({ fetched, file, e: e && { viewBox: e.viewBox, kind: e.kind }, local: !!(r && r.local), refused, missing, shippedRefused })}`);
  useLocalIndex(null); fs.rmSync(tmp, { recursive: true, force: true });
} catch (err) { fail(`fetch threw: ${err.message}`); }

console.log(fails ? `check_icons: ${fails} check(s) failed` : 'check_icons: all checks passed');
process.exit(fails ? 1 : 0);
