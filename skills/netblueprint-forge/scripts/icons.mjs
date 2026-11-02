#!/usr/bin/env node
// Vendor icon library: the official Microsoft Azure, AWS and Google Cloud architecture icons, imported from the packages the vendors
// publish into one index file per provider (assets/icons/<provider>.json) that ships with the skill, plus product logos fetched one by one
// from the Dashboard Icons collection into icons.json beside a model. A model names an icon as "<provider>/<id>" (azure/key-vaults,
// aws/lambda, gcp/cloud-sql, dashboard/fortinet); build.mjs injects only the icons a page uses, as <symbol> elements.
//
//   node scripts/icons.mjs import <provider> <package.zip> [more.zip ...] [--retrieved YYYY-MM-DD]
//   node scripts/icons.mjs list [provider] [--kind service|resource|group|category|product|product-legacy]
//   node scripts/icons.mjs search <text> [--provider p] [--limit 12]      --provider dashboard searches the online logo catalogue
//   node scripts/icons.mjs fetch dashboard/<name> [dashboard/<name> ...] --model <model.json>   a logo into icons.json beside the model
//   node scripts/icons.mjs check <model.json>        every icon the model names (and every card's icon) resolves
//   node scripts/icons.mjs stats
//
// The importer reads the vendor ZIP itself (no dependency: inflate from node:zlib), keeps one size per icon, and normalizes each SVG
// without touching colour, shape or proportion: the XML prolog, comments, <title> and the root's width/height go; the viewBox stays; every
// id, url(#…) and href="#…" reference, and every CSS class, is prefixed with the icon's own name so hundreds of icons can share one page.
// `fetch` downloads one SVG at a time (jsDelivr, then GitHub), refuses markup a page must not embed (scripts, event handlers, external
// references), normalizes it the same way and writes it to icons.json beside the model, where build.mjs and validate.mjs look for it.
// Node 18+. Exit codes: 0 ok, 1 bad arguments or a failed check, 2 I/O.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.join(here, '..');
export const ICON_DIR = path.join(SKILL, 'assets', 'icons');
export const PROVIDERS = ['azure', 'aws', 'gcp'];          // ship with the skill in assets/icons/
export const FETCHED_PROVIDERS = ['dashboard'];             // fetched one icon at a time into icons.json beside the model
export const LOCAL_INDEX = 'icons.json';
export const REF_PATTERN = /^(aws|azure|gcp|dashboard)\/[a-z0-9][a-z0-9.-]*$/;

export const SOURCES = {
  azure: {
    name: 'Microsoft Azure architecture icons (with the Microsoft Entra architecture icons)', url: 'https://learn.microsoft.com/azure/architecture/icons/',
    terms: 'Microsoft permits the use of these icons in architectural diagrams, training materials, or documentation. You can copy, distribute, and display the icons only for the permitted use unless granted explicit permission by Microsoft. Microsoft reserves all other rights. Do: use the icons to illustrate how products can work together; include the product name near the icon; use the icons as they appear within Azure. Do not: crop, flip or rotate icons; distort or change their shape; use Microsoft product icons to represent your own product or service; use them in marketing communications. The Microsoft Entra architecture icons (learn.microsoft.com/entra/architecture/architecture-icons) carry the same terms and are included under the azure provider.',
  },
  aws: {
    name: 'AWS Architecture Icons', url: 'https://aws.amazon.com/architecture/icons/',
    terms: 'AWS allows customers and partners to use these toolkits and assets to create architecture diagrams, and to put icons in materials like whitepapers, presentations, data sheets and posters. Use icons at their predefined size, color and format in diagrams; do not crop service icons, flip or rotate icons, or change icon shapes; icon colors are accessibility tested and should not be altered. Check for the latest icon release: packages are released quarterly.',
  },
  gcp: {
    name: 'Google Cloud product icons', url: 'https://cloud.google.com/icons',
    terms: 'Google publishes these icons as "the Google Cloud product icons you need for your diagrams, technical documentation, and more". The icon library page and the packages carry no separate licence text; Google\'s site terms and brand guidelines apply. The icons are used here unmodified, to represent the Google Cloud products they were designed for.',
  },
  dashboard: {
    name: 'Dashboard Icons (homarr-labs)', url: 'https://dashboardicons.com/',
    cdn: 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons', mirror: 'https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main',
    terms: 'A community collection of product logos, published on GitHub under the Apache License 2.0 with this disclaimer: "All product names, trademarks, and registered trademarks are the property of their respective owners. Icons are used for identification purposes only and do not imply endorsement." The skill ships none of these files: `icons.mjs fetch` downloads a logo at the user\'s request into the model\'s own folder, unmodified except for the prefixes the normalizer adds, to identify the product it depicts.',
  },
};

/* ---------- zip reader (store and deflate; the three vendor packages need nothing else) ---------- */
export function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error(`${path.basename(file)} is not a zip file`);
  const count = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  const entries = []; let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`${path.basename(file)}: bad central directory`);
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    entries.push({ name: buf.toString('utf8', p + 46, p + 46 + nlen), method, csize, usize, lho });
    p += 46 + nlen + elen + clen;
  }
  const read = (e) => {
    if (buf.readUInt32LE(e.lho) !== 0x04034b50) throw new Error(`bad local header for ${e.name}`);
    const start = e.lho + 30 + buf.readUInt16LE(e.lho + 26) + buf.readUInt16LE(e.lho + 28);
    const data = buf.subarray(start, start + e.csize);
    if (e.method === 0) return Buffer.from(data);
    if (e.method === 8) return zlib.inflateRawSync(data);
    throw new Error(`unsupported compression method ${e.method} for ${e.name}`);
  };
  return { entries: entries.filter((e) => !e.name.endsWith('/') && !e.name.includes('__MACOSX/') && !e.name.includes('/.')), read };
}

/* ---------- SVG normalization ---------- */
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Returns {viewBox, body}: the inner markup of the icon with ids and classes prefixed, minified, nothing else changed. */
export function normalizeSvg(text, prefix) {
  let s = String(text).replace(/^﻿/, '').replace(/<\?xml[^>]*\?>/g, '').replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const open = /<svg\b([^>]*)>/i.exec(s);
  const close = s.lastIndexOf('</svg>');
  if (!open || close < 0) throw new Error('no <svg> root');
  const attr = (n) => { const m = new RegExp(`(?:^|\\s)${n}="([^"]*)"`).exec(open[1]); return m ? m[1].trim() : null; };
  let viewBox = attr('viewBox');
  if (!viewBox) { const w = parseFloat(attr('width')), h = parseFloat(attr('height')); if (!(w > 0 && h > 0)) throw new Error('no viewBox and no usable width/height'); viewBox = `0 0 ${w} ${h}`; }
  let body = s.slice(open.index + open[0].length, close)
    .replace(/<title>[\s\S]*?<\/title>/gi, '').replace(/<desc>[\s\S]*?<\/desc>/gi, '').replace(/<metadata>[\s\S]*?<\/metadata>/gi, '');
  const safe = (id) => `${prefix}-${id.replace(/[^\w-]/g, '_')}`;
  const ids = new Set(); body.replace(/\bid="([^"]+)"/g, (m, id) => { ids.add(id); return m; });
  for (const id of ids) {
    const e = escRe(id);
    body = body.replace(new RegExp(`\\bid="${e}"`, 'g'), `id="${safe(id)}"`)
      .replace(new RegExp(`url\\(['"]?#${e}['"]?\\)`, 'g'), `url(#${safe(id)})`)
      .replace(new RegExp(`href="#${e}"`, 'g'), `href="#${safe(id)}"`);
  }
  // classes: rename inside <style> rules and class attributes only, never in path data
  const classes = new Set();
  body.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (m, css) => { css.replace(/\.([A-Za-z_][\w-]*)/g, (mm, c) => { classes.add(c); return mm; }); return m; });
  body.replace(/\bclass="([^"]+)"/g, (m, c) => { c.split(/\s+/).forEach((x) => x && classes.add(x)); return m; });
  if (classes.size) {
    const ren = (c) => `${prefix}-${c}`;
    body = body.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, css) => `<style${a}>${css.replace(/\.([A-Za-z_][\w-]*)/g, (mm, c) => classes.has(c) ? '.' + ren(c) : mm)}</style>`)
      .replace(/\bclass="([^"]+)"/g, (m, c) => `class="${c.split(/\s+/).filter(Boolean).map(ren).join(' ')}"`);
  }
  body = body.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  return { viewBox, body };
}

/* ---------- naming ---------- */
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ACRONYM = { sql: 'SQL', gke: 'GKE', api: 'API', apis: 'APIs', iam: 'IAM', vpc: 'VPC', ai: 'AI', ml: 'ML', iot: 'IoT', dns: 'DNS', cdn: 'CDN', kms: 'KMS', hsm: 'HSM', tpu: 'TPU', gpu: 'GPU', vm: 'VM', vms: 'VMs', id: 'ID', ip: 'IP', vpn: 'VPN', nat: 'NAT', tcp: 'TCP', http: 'HTTP', https: 'HTTPS', ssl: 'SSL', tls: 'TLS', grpc: 'gRPC', bigquery: 'BigQuery', bigtable: 'Bigtable', pubsub: 'Pub/Sub', sdk: 'SDK', sdks: 'SDKs', ocr: 'OCR', nlp: 'NLP', gcs: 'GCS', beyondcorp: 'BeyondCorp', automl: 'AutoML', alloydb: 'AlloyDB', firestore: 'Firestore', dataflow: 'Dataflow', dataproc: 'Dataproc', apigee: 'Apigee', looker: 'Looker', vmware: 'VMware', os: 'OS', cli: 'CLI', ui: 'UI', vlan: 'VLAN', waf: 'WAF', ddos: 'DDoS', nfs: 'NFS', smb: 'SMB', ad: 'AD', mfa: 'MFA', sso: 'SSO', jwt: 'JWT', saml: 'SAML', oidc: 'OIDC', ipv6: 'IPv6', ipv4: 'IPv4', ssh: 'SSH', rdp: 'RDP', gpus: 'GPUs', tpus: 'TPUs', ids: 'IDS', ips: 'IPS', cicd: 'CI/CD', ci: 'CI', cd: 'CD' };
const titleWords = (s) => s.split(/[_\s-]+/).filter(Boolean).map((w) => ACRONYM[w.toLowerCase()] || (w[0].toUpperCase() + w.slice(1))).join(' ');

/* ---------- importers: one function per provider, each returns {entries: {id -> entry}, package} ---------- */
function importAzure(zips) {
  const out = {}; const late = {};
  const take = (name, read, into) => {
    let m = /^Azure_Public_Service_Icons\/Icons\/([^/]+)\/(\d+)-icon-service-(.+)\.svg$/i.exec(name);
    if (m) {
      const [, category, number, raw] = m; const id = slug(raw);
      if (into[id]) return; // first file for a name wins; the "menu" and "new icons" folders only fill gaps
      into[id] = { title: raw.replace(/-/g, ' ').replace(/\s+/g, ' ').trim(), category: category.toLowerCase(), kind: 'service', file: path.basename(name), number, svg: read().toString('utf8') };
      return;
    }
    // the Microsoft Entra architecture icons package (same terms): colour icons only, "Microsoft Entra ID color icon.svg" -> microsoft-entra-id
    m = /\/Microsoft Entra color icons SVG\/(.+?)(?: color icon)?\.svg$/i.exec(name);
    if (m) { const raw = m[1].trim(); const id = slug(raw); if (!into[id]) into[id] = { title: raw, category: 'identity', kind: 'service', file: path.basename(name), svg: read().toString('utf8') }; }
  };
  for (const z of zips) {
    const main = z.entries.filter((e) => !/\/Icons\/(menu|new icons)\//i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
    const rest = z.entries.filter((e) => /\/Icons\/(menu|new icons)\//i.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));
    main.forEach((e) => take(e.name, () => z.read(e), out)); rest.forEach((e) => take(e.name, () => z.read(e), late));
  }
  for (const [id, e] of Object.entries(late)) if (!out[id]) out[id] = e;
  const aliases = { 'entra-id': 'microsoft-entra-id', 'active-directory': 'microsoft-entra-id', aad: 'microsoft-entra-id', 'key-vault': 'key-vaults', 'app-service': 'app-services', 'function-app': 'function-apps', functions: 'function-apps', aks: 'kubernetes-services', vm: 'virtual-machine', vms: 'virtual-machine', 'virtual-machines': 'virtual-machine', vnet: 'virtual-networks', 'virtual-network': 'virtual-networks', nsg: 'network-security-groups', firewall: 'firewalls', 'azure-firewall': 'firewalls', 'application-gateway': 'application-gateways', 'app-gateway': 'application-gateways', 'front-door': 'front-door-and-cdn-profiles', 'sql': 'sql-database', 'azure-sql': 'sql-database', 'storage-account': 'storage-accounts', storage: 'storage-accounts', 'cosmos-db': 'azure-cosmos-db', 'service-bus': 'azure-service-bus', 'event-hub': 'event-hubs', redis: 'cache-redis', 'cache-for-redis': 'cache-redis', bastion: 'bastions', 'log-analytics': 'log-analytics-workspaces', 'private-endpoint': 'private-link', 'load-balancer': 'load-balancers', 'vpn-gateway': 'virtual-network-gateways', 'expressroute': 'expressroute-circuits', 'container-registry': 'container-registries', 'container-app': 'container-apps-environments', 'managed-identity': 'managed-identities', 'api-management': 'api-management-services', monitor: 'monitor', 'defender': 'microsoft-defender-for-cloud', 'sentinel': 'microsoft-sentinel', 'subscription': 'subscriptions', 'resource-group': 'resource-groups', 'subnet': 'subnet', 'route-table': 'route-tables', 'dns-zone': 'dns-zones', 'nat-gateway': 'nat', 'ddos': 'ddos-protection-plans', 'waf': 'web-application-firewall-policies-waf' };
  return { entries: out, aliases, packages: zips.map((z) => z.file) };
}

function importAws(zips) {
  const out = {}; const strip = (raw) => raw.replace(/^(Amazon|AWS)[-_]/i, '');
  const add = (id, entry) => { if (out[id]) return false; out[id] = entry; return true; };
  const svcs = [], ress = [], resLight = [], groups = [], cats = [];
  for (const z of zips) for (const e of z.entries) {
    let m;
    if ((m = /\/Arch_([^/]+)\/48\/Arch_(.+)_48\.svg$/.exec(e.name))) svcs.push({ e, z, category: slug(m[1]), raw: m[2] });
    else if ((m = /Resource-Icons[^/]*\/Res_([^/]+)\/Res_(.+)_48\.svg$/.exec(e.name))) ress.push({ e, z, category: slug(m[1]), raw: m[2] });
    else if ((m = /Resource-Icons[^/]*\/Res_([^/]+)\/Res_(.+)_48_Light\.svg$/.exec(e.name))) resLight.push({ e, z, category: slug(m[1]), raw: m[2] });
    else if ((m = /Architecture-Group-Icons[^/]*\/(.+)_32\.svg$/.exec(e.name))) groups.push({ e, z, category: 'group', raw: m[1] });
    else if ((m = /Category-Icons[^/]*\/Arch-Category_48\/Arch-Category_(.+)_48\.svg$/.exec(e.name))) cats.push({ e, z, category: 'category', raw: m[1] });
  }
  const sortBy = (a, b) => a.e.name.localeCompare(b.e.name);
  for (const s of svcs.sort(sortBy)) {
    const id = slug(strip(s.raw)); const entry = { title: s.raw.replace(/[-_]+/g, ' '), category: s.category, kind: 'service', file: path.basename(s.e.name), svg: s.z.read(s.e).toString('utf8') };
    if (!add(id, entry)) add(slug(s.raw), entry); // Amazon-X and AWS-X both exist for two names: the second keeps its prefix
  }
  const seenRes = new Set();
  for (const r of ress.sort(sortBy)) { seenRes.add(r.raw); const id = slug(strip(r.raw)); const entry = { title: r.raw.replace(/[-_]+/g, ' '), category: r.category, kind: 'resource', file: path.basename(r.e.name), svg: r.z.read(r.e).toString('utf8') }; if (!add(id, entry)) add('res-' + id, entry); }
  for (const r of resLight.sort(sortBy)) { if (seenRes.has(r.raw)) continue; const id = slug(strip(r.raw)); const entry = { title: r.raw.replace(/[-_]+/g, ' '), category: r.category, kind: 'resource', file: path.basename(r.e.name), svg: r.z.read(r.e).toString('utf8') }; if (!add(id, entry)) add('res-' + id, entry); }
  for (const g of groups.sort(sortBy)) add('group-' + slug(g.raw), { title: g.raw.replace(/[-_]+/g, ' '), category: 'group', kind: 'group', file: path.basename(g.e.name), svg: g.z.read(g.e).toString('utf8') });
  for (const c of cats.sort(sortBy)) add('category-' + slug(c.raw), { title: c.raw.replace(/[-_]+/g, ' ') + ' (category)', category: 'category', kind: 'category', file: path.basename(c.e.name), svg: c.z.read(c.e).toString('utf8') });
  const aliases = { s3: 'simple-storage-service', ec2: 'ec2', rds: 'rds', lambda: 'lambda', eks: 'elastic-kubernetes-service', ecs: 'elastic-container-service', ecr: 'elastic-container-registry', alb: 'elastic-load-balancing', elb: 'elastic-load-balancing', nlb: 'elastic-load-balancing', sqs: 'simple-queue-service', sns: 'simple-notification-service', kms: 'key-management-service', iam: 'identity-and-access-management', vpc: 'virtual-private-cloud', route53: 'route-53', acm: 'certificate-manager', ses: 'simple-email-service', efs: 'efs', ebs: 'elastic-block-store', msk: 'managed-streaming-for-apache-kafka', opensearch: 'opensearch-service', 'step-functions': 'step-functions', 'secrets-manager': 'secrets-manager', 'api-gateway': 'api-gateway', cloudfront: 'cloudfront', dynamodb: 'dynamodb', elasticache: 'elasticache', cognito: 'cognito', eventbridge: 'eventbridge', cloudwatch: 'cloudwatch', cloudtrail: 'cloudtrail', guardduty: 'guardduty', shield: 'shield', 'security-hub': 'security-hub', inspector: 'inspector', macie: 'macie', 'transit-gateway': 'transit-gateway', 'direct-connect': 'direct-connect', vpn: 'site-to-site-vpn', privatelink: 'privatelink', 'network-firewall': 'network-firewall', waf: 'waf', 'systems-manager': 'systems-manager', bedrock: 'bedrock', sagemaker: 'sagemaker', redshift: 'redshift', athena: 'athena', glue: 'glue', kinesis: 'kinesis', 'ec2-instance': 'ec2-instance', 'rds-instance': 'rds-instance', 'vpc-group': 'group-virtual-private-cloud-vpc', 'aws-cloud': 'group-aws-cloud', 'public-subnet': 'group-public-subnet', 'private-subnet': 'group-private-subnet', region: 'group-region', 'availability-zone': 'group-availability-zone' };
  return { entries: out, aliases, packages: zips.map((z) => z.file) };
}

function importGcp(zips) {
  const out = {}; const legacy = {};
  for (const z of zips) for (const e of z.entries.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    let m;
    if ((m = /^Unique Icons\/([^/]+)\/SVG\/[^/]+\.svg$/.exec(e.name))) { const id = slug(m[1]); if (!out[id]) out[id] = { title: m[1], category: 'product', kind: 'product', file: path.basename(e.name), svg: z.read(e).toString('utf8') }; }
    else if ((m = /^Category Icons\/([^/]+)\/SVG\/[^/]+\.svg$/.exec(e.name))) { const name = m[1].replace(/ _ /g, ' & '); const id = 'category-' + slug(name); if (!out[id]) out[id] = { title: name + ' (category)', category: 'category', kind: 'category', file: path.basename(e.name), svg: z.read(e).toString('utf8') }; }
    else if ((m = /^([a-z0-9_]+)\/\1\.svg$/.exec(e.name))) { const id = slug(m[1]); if (!legacy[id]) legacy[id] = { title: titleWords(m[1]), category: 'legacy', kind: 'product-legacy', file: path.basename(e.name), svg: z.read(e).toString('utf8') }; }
  }
  for (const [id, e] of Object.entries(legacy)) if (!out[id]) out[id] = e; // the 2025 product icon wins where both exist
  const aliases = { gcs: 'cloud-storage', gce: 'compute-engine', bq: 'bigquery', 'cloud-functions': 'cloud-functions', functions: 'cloud-functions', 'cloud-run-functions': 'cloud-functions', iap: 'identity-aware-proxy', kms: 'key-management-service', 'cloud-kms': 'key-management-service', 'secret-manager': 'secret-manager', 'cloud-armor': 'cloud-armor', 'load-balancing': 'cloud-load-balancing', 'external-load-balancer': 'cloud-load-balancing', 'cloud-nat': 'cloud-nat', 'cloud-dns': 'cloud-dns', 'cloud-cdn': 'cloud-cdn', memorystore: 'memorystore', 'cloud-iam': 'identity-and-access-management', iam: 'identity-and-access-management', 'pub-sub': 'pubsub', vpc: 'virtual-private-cloud', 'cloud-vpn': 'cloud-vpn', interconnect: 'cloud-interconnect', 'artifact-registry': 'artifact-registry', 'cloud-build': 'cloud-build', 'cloud-logging': 'cloud-logging', 'cloud-monitoring': 'cloud-monitoring', 'security-command-center': 'security-command-center', firestore: 'firestore', spanner: 'cloud-spanner', 'app-engine': 'app-engine', 'cloud-sql': 'cloud-sql' };
  return { entries: out, aliases, packages: zips.map((z) => z.file) };
}

const IMPORTERS = { azure: importAzure, aws: importAws, gcp: importGcp };

/** Imports one provider's package(s) and writes assets/icons/<provider>.json. Returns the index. */
export function importProvider(provider, zipFiles, { retrieved } = {}) {
  if (!IMPORTERS[provider]) throw new Error(`unknown provider "${provider}" (${PROVIDERS.join(', ')})`);
  const zips = zipFiles.map((f) => Object.assign(readZip(f), { file: path.basename(f) }));
  const { entries, aliases, packages } = IMPORTERS[provider](zips);
  const icons = {}; const problems = [];
  for (const [id, e] of Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) {
    try { const { viewBox, body } = normalizeSvg(e.svg, `vi-${provider}-${id}`); icons[id] = { title: e.title, category: e.category, kind: e.kind, file: e.file, viewBox, body }; }
    catch (err) { problems.push(`${id}: ${err.message}`); }
  }
  const validAliases = {}; for (const [a, t] of Object.entries(aliases)) if (icons[t] && !icons[a] && a !== t) validAliases[a] = t;
  const index = { provider, name: SOURCES[provider].name, url: SOURCES[provider].url, packages, retrieved: retrieved || new Date().toISOString().slice(0, 10), terms: SOURCES[provider].terms, count: Object.keys(icons).length, aliases: validAliases, icons };
  fs.mkdirSync(ICON_DIR, { recursive: true });
  fs.writeFileSync(path.join(ICON_DIR, `${provider}.json`), JSON.stringify(index) + '\n', 'utf8');
  return { index, problems };
}

/* ---------- library access (used by build.mjs, validate.mjs and the CLI) ---------- */
const cache = {};
export function loadIndex(provider) {
  if (cache[provider] !== undefined) return cache[provider];
  const file = path.join(ICON_DIR, `${provider}.json`);
  cache[provider] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  return cache[provider];
}
/* The project-local index: logos fetched on demand live in icons.json beside the model, keyed by their full reference. */
let LOCAL = null, LOCAL_FILE = null;
/** Points the library at the icons.json beside a model (the model's path or its folder); returns that index or null when there is none. */
export function useLocalIndex(where) {
  LOCAL = null; LOCAL_FILE = null;
  if (!where) return null;
  const dir = fs.existsSync(where) && fs.statSync(where).isDirectory() ? where : path.dirname(where);
  LOCAL_FILE = path.join(path.resolve(dir), LOCAL_INDEX);
  if (!fs.existsSync(LOCAL_FILE)) return null;
  const idx = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8').replace(/^\uFEFF/, ''));
  if (!idx || typeof idx !== 'object' || !idx.icons || typeof idx.icons !== 'object') throw new Error(`${LOCAL_FILE} is not an icons.json file (no "icons" object)`);
  LOCAL = idx; return LOCAL;
}
export const localIndex = () => LOCAL;
/** "azure/key-vault" -> {provider, id, entry} with aliases resolved (local: true for a fetched logo), or null when the icon is nowhere. */
export function resolveIcon(ref) {
  if (typeof ref !== 'string' || !ref.includes('/')) return null;
  const [provider, ...rest] = ref.split('/'); const key = rest.join('/');
  const idx = loadIndex(provider);
  if (idx) { const id = idx.icons[key] ? key : idx.aliases[key]; if (id && idx.icons[id]) return { provider, id, entry: idx.icons[id] }; }
  if (LOCAL && LOCAL.icons[ref] && LOCAL.icons[ref].body) return { provider, id: key, entry: LOCAL.icons[ref], local: true };
  return null;
}
export const isVendorRef = (ref) => typeof ref === 'string' && ref.includes('/');
export const symbolId = (provider, id) => `vi-${provider}-${id}`;
export const symbolMarkup = (provider, id, entry) => `<symbol id="${symbolId(provider, id)}" viewBox="${entry.viewBox}">${entry.body}</symbol>`;

/** The icon each cloud card declares ("- **Icon:** `azure/key-vaults`"), by card id, read from references/cloud/*.md. */
export function cardIcons() {
  const out = {}; const dir = path.join(SKILL, 'references', 'cloud');
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    if (!/^(aws|azure|gcp)\.md$/.test(f)) continue;
    let card = null;
    for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
      const h = /^## `([a-z0-9-]+)`/.exec(line); if (h) { card = h[1]; continue; }
      const i = /^- \*\*Icon:\*\* `([^`]+)`/.exec(line); if (i && card) out[card] = i[1];
    }
  }
  return out;
}

/** Every vendor icon reference a model uses: explicit `icon` values with a "/" on zones, appliances, nodes and components, plus the card
 *  icon of cloud nodes that set none (unless settings.icons.vendor is false). Returns {refs: Map ref -> [where], missing: [ref]}. */
export function collectIcons(model, cards = cardIcons()) {
  const refs = new Map(); const vendorOn = !(model.settings && model.settings.icons && model.settings.icons.vendor === false);
  const note = (ref, where) => { if (!isVendorRef(ref)) return; if (!refs.has(ref)) refs.set(ref, []); refs.get(ref).push(where); };
  const scope = (t, label) => {
    (t.zones || []).forEach((z) => { note(z.icon, `${label}zone ${z.name}`); (z.appliances || []).forEach((a) => note(a.icon, `${label}appliance ${a.name}`)); });
    (t.nodes || []).forEach((n) => {
      let ref = n.icon; if (!isVendorRef(ref) && vendorOn && n.cloud && n.cloud.card && cards[n.cloud.card]) ref = cards[n.cloud.card];
      note(ref, `${label}node ${n.name}`); (n.components || []).forEach((c) => note(c.icon, `${label}component ${n.name}/${c.name}`));
    });
  };
  if (model.tabs) model.tabs.forEach((t) => scope(t, `tab ${t.name}: `)); else scope(model, '');
  const missing = [...refs.keys()].filter((r) => !resolveIcon(r));
  return { refs, missing };
}

/* ---------- fetch on demand: product logos from Dashboard Icons into icons.json beside the model ---------- */
const UNSAFE = [
  ['a <script> element', /<script\b/i],
  ['a <foreignObject> element', /<foreignObject\b/i],
  ['an event handler attribute', /\son[a-z]+\s*=/i],
  ['a javascript: URL', /javascript:/i],
  ['an external reference', /(?:href|src)\s*=\s*["'](?:https?:|\/\/)/i],
  ['an external stylesheet or resource', /@import|url\(\s*["']?(?:https?:|\/\/)/i],
];
/** Refuses markup an untrusted SVG must not bring onto a page. */
export function assertSafeSvg(text, what = 'the SVG') { for (const [label, re] of UNSAFE) if (re.test(text)) throw new Error(`${what}: refused, the SVG carries ${label}`); }

function getText(url, { timeout = 20000, hops = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'netblueprint-forge/icons.mjs' } }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && hops > 0) { res.resume(); return resolve(getText(new URL(res.headers.location, url).href, { timeout, hops: hops - 1 })); }
      if (res.statusCode !== 200) { res.resume(); return reject(Object.assign(new Error(`HTTP ${res.statusCode} for ${url}`), { status: res.statusCode })); }
      const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8'))); res.on('error', reject);
    });
    req.on('error', reject); req.setTimeout(timeout, () => req.destroy(new Error(`timeout after ${timeout} ms for ${url}`)));
  });
}
/** The collection's catalogue (every icon's aliases, categories and base format), cached in the OS temp folder for a day. */
export async function dashboardCatalogue({ maxAgeMs = 24 * 3600 * 1000 } = {}) {
  const file = path.join(os.tmpdir(), 'netblueprint-dashboard-icons-metadata.json'); const src = SOURCES.dashboard;
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxAgeMs) return JSON.parse(fs.readFileSync(file, 'utf8'));
  let text; try { text = await getText(`${src.cdn}/metadata.json`); } catch { text = await getText(`${src.mirror}/metadata.json`); }
  const meta = JSON.parse(text); if (!meta || typeof meta !== 'object') throw new Error('metadata.json is not an object');
  fs.writeFileSync(file, text, 'utf8'); return meta;
}
/** Names in the catalogue that match a query, best first: {id, aliases, categories, svg}. */
export function searchCatalogue(meta, query, limit = 12) {
  const q = String(query).toLowerCase().trim(); const words = q.split(/\s+/).filter(Boolean); const hits = [];
  for (const [id, e] of Object.entries(meta)) {
    const aliases = (e && Array.isArray(e.aliases)) ? e.aliases : []; const hay = [id, ...aliases].join(' ').toLowerCase(); let score = 0;
    if (id === q) score = 100; else if (hay.includes(q)) score = 60 - Math.min(40, hay.indexOf(q)); else { const n = words.filter((w) => hay.includes(w)).length; if (n) score = 20 * n / words.length; }
    if (score) hits.push({ score, id, aliases, categories: (e && e.categories) || [], svg: !e || !e.base || e.base === 'svg' });
  }
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
/** Downloads logos ("dashboard/<name>") into icons.json beside the model (or in dir), safety-checked and normalized; returns {fetched, file}.
 *  source: another base URL, or a folder of <name>.svg files (tests, offline mirrors). An existing icons.json keeps its other entries. */
export async function fetchIcons(refs, { model, dir, source } = {}) {
  const where = model ? path.dirname(path.resolve(model)) : path.resolve(dir || '.');
  const file = path.join(where, LOCAL_INDEX);
  const index = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : { netblueprint_icons: 1, note: 'Icons fetched by scripts/icons.mjs fetch for the model in this folder; keep the file beside the model. The logos belong to their owners (see the sources below and THIRD-PARTY-NOTICES.md in the skill).', sources: {}, icons: {} };
  if (!index.icons || typeof index.icons !== 'object') throw new Error(`${file} is not an icons.json file (no "icons" object)`);
  index.sources = index.sources || {};
  const fromFolder = source && fs.existsSync(source) && fs.statSync(source).isDirectory();
  const fetched = [];
  for (const ref of refs) {
    if (!REF_PATTERN.test(ref)) throw new Error(`"${ref}" is not a <provider>/<name> icon reference`);
    const [provider, name] = ref.split('/');
    if (!FETCHED_PROVIDERS.includes(provider)) throw new Error(`"${ref}": only ${FETCHED_PROVIDERS.join(', ')} icons are fetched; ${PROVIDERS.join(', ')} icons ship with the skill (node scripts/icons.mjs search "${name.replace(/-/g, ' ')}")`);
    const src = SOURCES[provider]; let text, from;
    if (fromFolder) { from = path.join(source, `${name}.svg`); if (!fs.existsSync(from)) throw Object.assign(new Error(`${ref}: no ${name}.svg in ${source}`), { status: 404, ref }); text = fs.readFileSync(from, 'utf8'); }
    else {
      from = `${source || src.cdn}/svg/${name}.svg`;
      try { text = await getText(from); }
      catch (e) { if (e.status === 404 || source) throw Object.assign(e, { ref }); from = `${src.mirror}/svg/${name}.svg`; try { text = await getText(from); } catch (e2) { throw Object.assign(e2, { ref }); } }
    }
    assertSafeSvg(text, ref);
    const { viewBox, body } = normalizeSvg(text, symbolId(provider, name));
    index.sources[provider] = { name: src.name, url: src.url, terms: src.terms };
    index.icons[ref] = { title: titleWords(name), kind: 'logo', source: from, retrieved: new Date().toISOString().slice(0, 10), viewBox, body };
    fetched.push({ ref, bytes: text.length, source: from });
  }
  fs.mkdirSync(where, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(index, null, 1) + '\n', 'utf8');
  if (!LOCAL_FILE || LOCAL_FILE === file) { LOCAL = index; LOCAL_FILE = file; }
  return { fetched, file };
}

/* ---------- CLI ---------- */
async function main() {
  const args = process.argv.slice(2); const cmd = args[0];
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const usage = () => { console.error('usage: node scripts/icons.mjs import <provider> <package.zip> [more.zip ...] [--retrieved YYYY-MM-DD]\n       node scripts/icons.mjs list [provider] [--kind k] | search <text> [--provider p] [--limit n] | check <model.json> | stats\n       node scripts/icons.mjs fetch dashboard/<name> [dashboard/<name> ...] --model <model.json> | --dir <folder>   [--source <url or folder>]'); process.exit(1); };
  try {
    if (cmd === 'import') {
      const provider = args[1]; const zips = args.slice(2).filter((a, i, all) => !a.startsWith('-') && all[i - 1] !== '--retrieved'); if (!provider || !zips.length) usage();
      const { index, problems } = importProvider(provider, zips, { retrieved: opt('--retrieved') });
      const kinds = {}; Object.values(index.icons).forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
      console.log(`${provider}: ${index.count} icons (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}), ${Object.keys(index.aliases).length} aliases, ${(fs.statSync(path.join(ICON_DIR, provider + '.json')).size / 1024).toFixed(0)} KB -> assets/icons/${provider}.json`);
      problems.forEach((p) => console.warn(`  skipped ${p}`));
    } else if (cmd === 'list') {
      const provs = args[1] && !args[1].startsWith('-') ? [args[1]] : PROVIDERS; const kind = opt('--kind');
      for (const p of provs) { const idx = loadIndex(p); if (!idx) { console.log(`${p}: no index`); continue; } for (const [id, e] of Object.entries(idx.icons)) if (!kind || e.kind === kind) console.log(`${p}/${id}\t${e.title}\t${e.category}\t${e.kind}`); }
    } else if (cmd === 'search') {
      const q = (args[1] || '').toLowerCase(); if (!q) usage(); const limit = +(opt('--limit') || 12);
      if (FETCHED_PROVIDERS.includes(opt('--provider'))) {
        const prov = opt('--provider'); const hits = searchCatalogue(await dashboardCatalogue(), q, limit);
        hits.forEach((h) => console.log(`${prov}/${h.id}\t${h.aliases.join(', ') || '-'}\t${h.categories.join(', ') || '-'}\t${h.svg ? 'svg' : 'png only, cannot be fetched'}`));
        console.log(hits.length ? `fetch one with: node scripts/icons.mjs fetch ${prov}/<name> --model <model.json>` : 'no icon matches'); return;
      }
      const provs = opt('--provider') ? [opt('--provider')] : PROVIDERS; const hits = [];
      if (opt('--model')) { useLocalIndex(opt('--model')); const loc = localIndex(); if (loc) for (const [ref, e] of Object.entries(loc.icons)) if (`${ref} ${e.title}`.toLowerCase().includes(q)) hits.push({ score: 70, line: `${ref}\t${e.title}\t${e.kind}\t(fetched, ${LOCAL_INDEX})` }); }
      for (const p of provs) { const idx = loadIndex(p); if (!idx) continue;
        for (const [id, e] of Object.entries(idx.icons)) { const hay = `${id} ${e.title}`.toLowerCase(); let score = 0; if (id === q) score = 100; else if (hay.includes(q)) score = 60 - Math.min(40, hay.indexOf(q)); else { const words = q.split(/\s+/).filter(Boolean); const hitWords = words.filter((w) => hay.includes(w)).length; if (hitWords) score = 20 * hitWords / words.length; } if (score) hits.push({ score, line: `${p}/${id}\t${e.title}\t${e.category}\t${e.kind}` }); }
        for (const [a, t] of Object.entries(idx.aliases)) if (a.includes(q)) hits.push({ score: 50, line: `${p}/${a}\t(alias of ${p}/${t})` }); }
      hits.sort((a, b) => b.score - a.score).slice(0, limit).forEach((h) => console.log(h.line)); if (!hits.length) console.log(`no icon matches (product logos: node scripts/icons.mjs search "${q}" --provider ${FETCHED_PROVIDERS[0]})`);
    } else if (cmd === 'check') {
      const file = args[1]; if (!file) usage(); const model = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); useLocalIndex(file);
      const cards = cardIcons(); const badCards = Object.entries(cards).filter(([, r]) => !resolveIcon(r)); const { refs, missing } = collectIcons(model, cards);
      const local = [...refs.keys()].filter((r) => { const x = resolveIcon(r); return x && x.local; }).length;
      console.log(`${path.basename(file)}: ${refs.size} vendor icon(s) used${local ? ` (${local} fetched, in ${LOCAL_INDEX})` : ''}${missing.length ? `, ${missing.length} missing: ${missing.join(', ')}` : ''}`);
      missing.filter((m) => FETCHED_PROVIDERS.includes(m.split('/')[0])).forEach((m) => console.log(`fetch it: node scripts/icons.mjs fetch ${m} --model ${file}`));
      badCards.forEach(([c, r]) => console.log(`card ${c}: icon ${r} is not in the library`));
      process.exit(missing.length || badCards.length ? 1 : 0);
    } else if (cmd === 'fetch') {
      const valued = ['--model', '--dir', '--source']; const refs = args.slice(1).filter((a, i, all) => !a.startsWith('-') && !valued.includes(all[i - 1])); if (!refs.length) usage();
      try {
        const { fetched, file } = await fetchIcons(refs, { model: opt('--model'), dir: opt('--dir'), source: opt('--source') });
        fetched.forEach((f) => console.log(`fetched ${f.ref} (${(f.bytes / 1024).toFixed(1)} KB from ${f.source})`));
        console.log(`-> ${file}: keep it beside the model; build.mjs embeds these logos from it. They belong to their owners (THIRD-PARTY-NOTICES.md).`);
      } catch (e) {
        if (e.status === 404 && e.ref && !opt('--source')) {
          const name = e.ref.split('/')[1]; let hits = []; try { const meta = await dashboardCatalogue(); const q = name.replace(/-/g, ' '); for (let k = q.length; k >= 4 && !hits.length; k--) hits = searchCatalogue(meta, q.slice(0, k).trim(), 6); } catch { /* offline: no suggestions */ }
          console.error(`icons: ${e.ref} is not in the collection${hits.length ? `; did you mean: ${hits.map((h) => `${e.ref.split('/')[0]}/${h.id}${h.svg ? '' : ' (png only)'}`).join(', ')}` : ''}`); process.exit(1);
        }
        throw e;
      }
    } else if (cmd === 'stats') {
      for (const p of PROVIDERS) { const idx = loadIndex(p); if (!idx) { console.log(`${p}: no index`); continue; } const kinds = {}; let bytes = 0; Object.values(idx.icons).forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; bytes += e.body.length; }); console.log(`${p}: ${idx.count} icons (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}), ${Object.keys(idx.aliases).length} aliases, bodies ${(bytes / 1024).toFixed(0)} KB, retrieved ${idx.retrieved} from ${idx.packages.join(' + ')}`); }
    } else usage();
  } catch (e) { console.error(`icons: ${e.message}`); process.exit(2); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
