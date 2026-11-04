// Packaging check: the release archive is the same bytes wherever and whenever it is built, and it holds the skill folder exactly.
//   node tests/check_package.mjs
// Builds the archive twice, from skills/netblueprint-forge and from a copy of it whose file times were moved, and requires the same
// sha256; a build with another stamp must differ, which shows the stamp is what the entries carry. Then reads the archive back
// without unzip: entries sorted and unique, all under netblueprint-forge/, the folder's files and no others, one and the same time
// on every entry, and for each the stored CRC and the inflated bytes equal to the file on disk. Temporary folders only; nothing in
// the repository is written. No dependencies. Exit 0 pass, 1 fail.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { packageSkill, zipDirectory, entryDate, listFiles, crc32, dosDateTime } from '../platforms/package.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKILL = 'netblueprint-forge';
const skillDir = path.join(root, 'skills', SKILL);
let fails = 0;
const pass = (m) => console.log('PASS  ' + m);
const fail = (m) => { console.log('FAIL  ' + m); fails++; };
const short = (h) => h.slice(0, 16) + '…';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-package-'));
try {
  // 1. The archive as the release workflow builds it.
  const a = packageSkill(path.join(tmp, 'a'));
  const stamp = entryDate(a.version);
  pass(`built ${path.basename(a.out)}: ${a.files} files, ${a.bytes} bytes, sha256 ${short(a.sha256)}, entries dated ${stamp.date.toISOString().slice(0, 10)} (${stamp.source})`);

  // 2. The same tree with other file times, in another folder: the same bytes.
  const copy = path.join(tmp, 'copy', SKILL);
  fs.cpSync(skillDir, copy, { recursive: true });
  const moved = new Date(Date.now() - 400 * 86400e3);
  for (const f of listFiles(copy)) fs.utimesSync(f.abs, moved, moved);
  const b = zipDirectory(copy, SKILL, path.join(tmp, 'b', path.basename(a.out)), stamp.date);
  if (b.sha256 === a.sha256 && b.bytes === a.bytes) pass('a copy with every file time moved by 400 days gives the same bytes');
  else fail(`a copy with other file times gives another archive (${short(b.sha256)} vs ${short(a.sha256)})`);

  // 3. Another stamp gives another archive, so the entries carry the stamp and not the files' own times.
  const c = zipDirectory(copy, SKILL, path.join(tmp, 'c', path.basename(a.out)), new Date(Date.UTC(2001, 0, 1)));
  if (c.sha256 !== a.sha256) pass('another stamp gives another archive'); else fail('the stamp has no effect on the archive');

  // 4. Read the archive back and compare it with the folder, entry by entry.
  const buf = fs.readFileSync(a.out);
  const eocd = buf.length - 22;
  if (buf.readUInt32LE(eocd) !== 0x06054b50) throw new Error('no end-of-central-directory record in the last 22 bytes');
  const count = buf.readUInt16LE(eocd + 10), cdSize = buf.readUInt32LE(eocd + 12), cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`bad central directory signature at ${p}`);
    const n = buf.readUInt16LE(p + 28), e = buf.readUInt16LE(p + 30), k = buf.readUInt16LE(p + 32);
    entries.push({
      name: buf.toString('utf8', p + 46, p + 46 + n), method: buf.readUInt16LE(p + 10), time: buf.readUInt16LE(p + 12), date: buf.readUInt16LE(p + 14),
      crc: buf.readUInt32LE(p + 16), csize: buf.readUInt32LE(p + 20), usize: buf.readUInt32LE(p + 24), local: buf.readUInt32LE(p + 42),
    });
    p += 46 + n + e + k;
  }
  if (p === cdOffset + cdSize) pass(`central directory: ${count} entries, size as declared`); else fail('central directory size does not match its entries');
  const names = entries.map((x) => x.name);
  const sorted = [...names].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  if (names.join('\n') === sorted.join('\n') && new Set(names).size === names.length) pass('entries sorted by path and unique'); else fail('entries not sorted by path, or not unique');
  if (names.every((x) => x.startsWith(SKILL + '/'))) pass(`every entry under ${SKILL}/`); else fail(`an entry outside ${SKILL}/`);
  const expected = listFiles(skillDir).map((f) => f.rel);
  const rels = names.map((x) => x.slice(SKILL.length + 1));
  if (rels.join('\n') === expected.join('\n')) pass(`the entries are the folder's ${expected.length} files, no more and no fewer`);
  else fail(`the entries differ from the folder (${rels.length} entries, ${expected.length} files)`);
  const want = dosDateTime(stamp.date);
  const stamps = new Set(entries.map((x) => `${x.date}:${x.time}`));
  if (stamps.size === 1 && entries[0].time === want.time && entries[0].date === want.date) pass('one and the same time on every entry, the stamp');
  else fail(`entry times vary or differ from the stamp (${[...stamps].slice(0, 3).join(' ')})`);
  let bad = 0;
  for (const x of entries) {
    if (buf.readUInt32LE(x.local) !== 0x04034b50) { bad++; fail(`${x.name}: bad local header`); continue; }
    const n = buf.readUInt16LE(x.local + 26), e = buf.readUInt16LE(x.local + 28), start = x.local + 30 + n + e;
    const stored = buf.subarray(start, start + x.csize);
    const data = x.method === 8 ? zlib.inflateRawSync(stored) : x.method === 0 ? stored : null;
    const disk = fs.readFileSync(path.join(skillDir, x.name.slice(SKILL.length + 1)));
    if (!data || data.length !== x.usize || !data.equals(disk) || crc32(data) !== x.crc) { bad++; fail(`${x.name}: content or CRC differs from the file on disk`); }
  }
  if (!bad) pass('every entry inflates to the file on disk, with the stored CRC');

  // 5. Where the stamp came from.
  if (stamp.source === 'CHANGELOG.md') pass(`the stamp is the date of the CHANGELOG.md heading for ${a.version}`);
  else console.log(`note  no dated CHANGELOG.md heading for ${a.version}: the entries carry ${stamp.date.toISOString().slice(0, 10)} (${stamp.source})`);
} catch (e) {
  fail(e.message);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails ? `check_package: ${fails} failure(s)` : 'check_package: all checks passed');
process.exit(fails ? 1 : 0);
