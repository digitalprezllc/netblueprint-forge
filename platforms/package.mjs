#!/usr/bin/env node
// Packages the skill folder into a release archive: dist/netblueprint-forge-<version>.zip, where <version> is metadata.version in
// skills/netblueprint-forge/SKILL.md. The archive holds one top-level folder, netblueprint-forge/, with SKILL.md, LICENSE, references,
// scripts and assets inside, which is the shape claude.ai and the Claude API accept as a skill upload and the shape to unzip into
// any tool's skills folder.
//
//   node platforms/package.mjs [--out <dir | file.zip>] [--quiet]   build the archive (default: dist/ at the repository root)
//   node platforms/package.mjs --version                            print the skill version and exit
//   node platforms/package.mjs --notes                              print this version's section of CHANGELOG.md and exit
//
// Node 18+, no dependencies: the ZIP container is written here (deflate from node:zlib, CRC-32 computed below), entries sorted by
// path so the same tree gives the same archive apart from file times. Exit 0 written, 1 bad arguments or a missing version, 2 I/O.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'netblueprint-forge';
const SKILL_DIR = path.join(ROOT, 'skills', SKILL_NAME);
const SKIP = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** The versions SKILL.md declares: {version, renderer}. */
export function skillVersion() {
  const text = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8').replace(/^﻿/, '');
  const fm = text.split(/^---\r?$/m)[1] || '';
  const v = /^\s+version:\s*"?([0-9][\w.+-]*)"?\s*$/m.exec(fm);
  const r = /^\s+renderer-version:\s*"?([0-9][\w.+-]*)"?\s*$/m.exec(fm);
  if (!v) throw new Error('metadata.version not found in SKILL.md');
  return { version: v[1], renderer: r ? r[1] : null };
}

/** The CHANGELOG.md section for a version ('' when the file or the section is missing). */
export function changelogNotes(version) {
  const file = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(file)) return '';
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const head = new RegExp('^## \\[?' + version.replace(/[.+-]/g, '\\$&') + '\\]?(\\s|$)');
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return '';
  let end = lines.slice(start + 1).findIndex((l) => /^## /.test(l));
  end = end < 0 ? lines.length : start + 1 + end;
  return lines.slice(start + 1, end).join('\n').trim() + '\n';
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const dosDateTime = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2), date: (((Math.max(1980, d.getFullYear()) - 1980) & 0x7F) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });

/** Every regular file under dir, as {abs, rel} with forward slashes, sorted by rel. */
export function listFiles(dir) {
  const out = [];
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (SKIP.has(e.name)) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else if (e.isFile()) out.push({ abs: path.join(d, e.name), rel: r });
    }
  })(dir, '');
  return out.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** Writes a ZIP of dir, every entry under topName/, and returns {out, files, bytes, sha256}. */
export function zipDirectory(dir, topName, outFile) {
  const files = listFiles(dir);
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const name = Buffer.from(topName + '/' + f.rel, 'utf8');
    const crc = crc32(data);
    let method = 8, body = zlib.deflateRawSync(data, { level: 9 });
    if (body.length >= data.length) { method = 0; body = data; }
    const { time, date } = dosDateTime(fs.statSync(f.abs).mtime);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(0x031E, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32); cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE((0o100644 << 16) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    parts.push(local, name, body); central.push(cen, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  const bytes = Buffer.concat([...parts, directory, end]);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, bytes);
  return { out: outFile, files: files.length, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

/** Builds dist/netblueprint-forge-<version>.zip (or the --out target) and returns the result with the versions. */
export function packageSkill(out) {
  const { version, renderer } = skillVersion();
  const fileName = `${SKILL_NAME}-${version}.zip`;
  let target = out ? path.resolve(out) : path.join(ROOT, 'dist', fileName);
  if (!/\.zip$/i.test(target)) target = path.join(target, fileName);
  return { version, renderer, ...zipDirectory(SKILL_DIR, SKILL_NAME, target) };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('-h') || args.includes('--help')) { console.error('usage: node platforms/package.mjs [--out <dir | file.zip>] [--quiet] | --version | --notes'); process.exit(0); }
  try {
    if (args.includes('--version')) { console.log(skillVersion().version); return; }
    if (args.includes('--notes')) { process.stdout.write(changelogNotes(skillVersion().version)); return; }
    const r = packageSkill(opt('--out'));
    if (!args.includes('--quiet')) console.log(`wrote ${path.relative(process.cwd(), r.out) || r.out} (skill ${r.version}, renderer ${r.renderer || '?'}; ${r.files} files, ${(r.bytes / 1024).toFixed(0)} KB, sha256 ${r.sha256})`);
  } catch (e) {
    console.error(`package: ${e.message}`);
    process.exit(/not found in SKILL\.md/.test(e.message) ? 1 : 2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
