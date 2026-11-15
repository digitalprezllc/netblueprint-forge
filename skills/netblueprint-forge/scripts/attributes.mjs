#!/usr/bin/env node
// Attribute display switches: the ids a model's settings.attributes (or an attributes.json beside the model) can hide from the
// page's Attributes card, per element kind. The renderer gives every row of the card an id: the model field path for a field it shows
// (profile.owner_business, transport.tls_version, adversary.type), or a fixed name for a row it derives (flows_through, depended_on_by,
// risk.residual). This module lists them from the schema and the renderer's fixed rows, checks a model's switches against the list,
// and merges an attributes.json into a model's settings.
//
//   node scripts/attributes.mjs                 list every id the card can show, by kind
//   node scripts/attributes.mjs --kind threat   one kind
//   node scripts/attributes.mjs --json          the same as JSON
//
// Node 18+, no dependencies. Exit 0.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = path.join(here, '..', 'assets', 'schema', 'netblueprint.schema.json');
export const KINDS = ['all', 'zone', 'node', 'component', 'appliance', 'flow', 'threat', 'path', 'requirement'];
export const ID_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*(\.\*)?$/;

/* What the renderer does with each kind: the model fields it skips when it flattens the element, the groups it flattens under a
   prefix, and the rows it adds by hand. Kept in step with template.html by tests/check_attributes.mjs. */
const BASE_SKIP = ['_box', '_zone', '_node', '_id', '_orient', 'name', 'label', 'layout', 'layers'];
const KIND = {
  zone: { def: 'zone', skip: ['appliances', 'info', 'out_of_scope', 'scope_reason', 'cloud', 'sub', 'kind', 'parent', 'dashed', 'icon', 'color', 'trust_boundary'], groups: { cloud: 'cloud' },
    explicit: ['name', 'kind', 'sub', 'info', 'scope', 'inside', 'trust_boundary', 'appliances', 'zones', 'nodes', 'threats'] },
  node: { def: 'node', skip: ['components', 'info', 'out_of_scope', 'scope_reason', 'profile', 'cloud', 'ports', 'sub', 'type', 'icon', 'zone', 'stack', 'depends_on'], groups: { cloud: 'cloud', profile: 'profile' },
    explicit: ['name', 'type', 'icon', 'sub', 'info', 'scope', 'zone', 'instances', 'components', 'depends_on', 'depended_on_by', 'layers', 'flows', 'threats', 'controls'] },
  component: { def: 'component', skip: ['components', 'info', 'out_of_scope', 'scope_reason', 'profile', 'cloud', 'ports', 'sub', 'type', 'icon', 'zone', 'stack', 'depends_on'], groups: { cloud: 'cloud', profile: 'profile' },
    explicit: ['name', 'type', 'icon', 'sub', 'info', 'scope', 'host', 'ports', 'depends_on', 'depended_on_by', 'layers', 'flows', 'threats', 'controls'] },
  appliance: { def: 'appliance', skip: ['info', 'out_of_scope', 'scope_reason', 'profile', 'cloud', 'sub', 'type', 'edge', 'filters', 'serves', 'depends_on'], groups: { cloud: 'cloud', profile: 'profile' },
    explicit: ['name', 'type', 'boundary_of', 'edge', 'filters', 'serves', 'sub', 'info', 'scope', 'depends_on', 'depended_on_by', 'flows_through', 'threats', 'controls'] },
  flow: { def: 'flow', skip: ['from', 'to', 'via', 'info', 'out_of_scope', 'scope_reason', 'kind', 'auth', 'direction', 'protocol', 'port', 'encrypted', 'blocked_reason'], groups: {},
    explicit: ['name', 'source', 'destination', 'direction', 'kind', 'auth', 'label', 'info', 'protocol', 'encrypted', 'blocked_reason', 'scope', 'through', 'threats', 'controls'] },
  threat: { def: 'threat', skip: ['id', 'number', 'title', 'description', 'status', 'status_reason', 'retired', 'risk', 'treatment', 'targets', 'classification', 'vulnerability', 'adversary', 'attack', 'standards', 'provenance', 'boundary_crossed', 'suggested', 'suggested_from'],
    groups: { adversary: 'adversary', attack: 'attack', standards: 'standards', provenance: 'provenance' },
    explicit: ['id', 'title', 'status', 'description', 'stride', 'linddun', 'attack_tactics', 'vulnerability', 'consequence', 'risk.inherent', 'risk.residual', 'risk.projected', 'risk.cvss', 'targets', 'boundary_crossed', 'adversary.actor_node',
      'treatment.decision', 'treatment.current_controls', 'treatment.planned_controls', 'treatment.controls', 'treatment.suggested_mitigations', 'requirements', 'suggested', 'attack_paths'] },
  path: { def: 'attackPath', skip: null, groups: { adversary: 'adversary' },
    explicit: ['id', 'title', 'status', 'description', 'entry', 'adversary.actor_node', 'hops', 'impact', 'assets_at_risk', 'risk.inherent', 'risk.residual', 'risk.projected', 'breaks_at', 'mitre_attack', 'layers', 'suggested'] },
  requirement: { def: 'requirement', skip: null, groups: {},
    explicit: ['id', 'title', 'statement', 'kind', 'priority', 'status', 'source', 'owner', 'due_date', 'threats', 'controls', 'attack_paths', 'frameworks'] },
};

let schemaCache = null;
function schema() { if (!schemaCache) schemaCache = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8').replace(/^﻿/, '')); return schemaCache; }
function resolve(s, depth = 0) {
  if (!s || typeof s !== 'object' || depth > 8) return s;
  if (s.$ref && s.$ref.startsWith('#/$defs/')) return resolve(schema().$defs[s.$ref.slice(8)], depth + 1);
  return s;
}
/** The object properties a schema node describes, looking through $ref, allOf, anyOf and oneOf. */
function propertiesOf(s, depth = 0) {
  s = resolve(s, depth); if (!s || depth > 8) return {};
  const out = Object.assign({}, s.properties || {});
  for (const k of ['allOf', 'anyOf', 'oneOf']) for (const b of s[k] || []) Object.assign(out, propertiesOf(b, depth + 1));
  return out;
}
/** Field paths under a schema node, dotted, the way the renderer flattens an object. */
function paths(s, prefix, out, depth = 0) {
  const props = propertiesOf(s, depth);
  for (const [k, v] of Object.entries(props)) {
    const id = prefix ? `${prefix}.${k}` : k;
    const r = resolve(v);
    const nested = r && Object.keys(propertiesOf(r)).length && !(r.type === 'array');
    const items = r && r.type === 'array' && r.items && Object.keys(propertiesOf(r.items)).length;
    if (nested && depth < 6) paths(r, id, out, depth + 1);
    else if (items && depth < 6) { out.add(id); paths(r.items, id, out, depth + 1); }
    else out.add(id);
  }
  return out;
}

/** Every id the card can show for a kind: the renderer's own rows plus the model fields it flattens, custom.* included. */
export function knownIds(kind) {
  const k = KIND[kind]; if (!k) return [];
  const out = new Set(k.explicit);
  const def = schema().$defs[k.def];
  if (k.skip) {
    const skip = new Set([...BASE_SKIP, ...k.skip]);
    const props = propertiesOf(def);
    for (const [key, v] of Object.entries(props)) if (!skip.has(key)) paths({ properties: { [key]: v } }, '', out);
  }
  for (const [id, prop] of Object.entries(k.groups)) { const props = propertiesOf(def); if (props[prop]) paths(props[prop], id, out); }
  if (k.skip && propertiesOf(def).custom) out.add('custom.*');
  if (kind === 'requirement') out.add('custom.*');
  return [...out].sort();
}
export function allKnown() { const out = {}; for (const kind of KINDS) if (kind !== 'all') out[kind] = knownIds(kind); return out; }

/** Does an id match a hide entry: the id itself, or a group named with a trailing .* */
export function matches(entry, id) { return entry === id || (entry.endsWith('.*') && (id === entry.slice(0, -2) || id.startsWith(entry.slice(0, -1)))); }
function knownEntry(entry, ids) {
  if (entry.startsWith('custom.') || entry === 'custom.*') return true;
  if (entry.endsWith('.*')) { const p = entry.slice(0, -2); return ids.some((id) => id === p || id.startsWith(p + '.')); }
  return ids.includes(entry);
}

/** Warnings for a model's settings.attributes: entries that name nothing the card shows. Shape errors are the schema's. */
export function attributesCheck(model) {
  const cfg = model && model.settings && model.settings.attributes; const out = [];
  if (!cfg || typeof cfg !== 'object') return out;
  const universe = Object.values(allKnown()).flat();
  for (const [kind, v] of Object.entries(cfg)) {
    if (!KINDS.includes(kind)) { out.push(`settings.attributes: "${kind}" is not an element kind (${KINDS.join(', ')})`); continue; }
    const ids = kind === 'all' ? universe : knownIds(kind);
    for (const entry of (v && v.hide) || []) {
      if (typeof entry !== 'string' || !ID_PATTERN.test(entry)) { out.push(`settings.attributes.${kind}: "${entry}" is not an attribute id (a.b.c or a.b.*)`); continue; }
      if (!knownEntry(entry, ids)) out.push(`settings.attributes.${kind}: "${entry}" names no attribute the card shows for ${kind === 'all' ? 'any kind' : kind}; node scripts/attributes.mjs lists them`);
    }
  }
  return out;
}

/** attributes.json merged into settings.attributes: hide lists are unioned per kind; the file may wrap its map in {"attributes": …}. */
export function mergeAttributes(current, extra) {
  const out = JSON.parse(JSON.stringify(current || {}));
  const src = extra && extra.attributes && typeof extra.attributes === 'object' ? extra.attributes : (extra || {});
  for (const [kind, v] of Object.entries(src)) {
    if (!v || typeof v !== 'object') continue;
    out[kind] = out[kind] || {};
    const hide = new Set([...(out[kind].hide || []), ...(v.hide || [])]);
    out[kind].hide = [...hide];
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const ki = args.indexOf('--kind'); const kind = ki >= 0 ? args[ki + 1] : null;
  const data = kind ? { [kind]: knownIds(kind) } : allKnown();
  if (kind && !KIND[kind]) { console.error(`attributes: unknown kind "${kind}"; one of ${Object.keys(KIND).join(', ')}`); process.exit(1); }
  if (args.includes('--json')) { console.log(JSON.stringify(data, null, 2)); }
  else for (const [k, ids] of Object.entries(data)) { console.log(`${k} (${ids.length})`); console.log('  ' + ids.join('  ')); }
}
