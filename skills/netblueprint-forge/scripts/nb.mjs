#!/usr/bin/env node
// nb: one front door to the skill's scripts. Each script still runs on its own; this one lists them, prints any script's usage,
// answers --version, runs doctor, and otherwise hands the arguments through unchanged.
//
//   node scripts/nb.mjs                          list the commands
//   node scripts/nb.mjs <command> [args]         run a script (validate, build, suggest, report, coverage, …) with its own arguments
//   node scripts/nb.mjs <command> --help         that script's usage, from its header
//   node scripts/nb.mjs --version                skill and renderer versions
//   node scripts/nb.mjs doctor [--json]          environment report, offline
//   node scripts/nb.mjs build a.model.json b.model.json   several models in one call (build, validate, check, screenshot accept lists)
//
// Node 18+, no dependencies. Exit codes: the script's own; 2 unknown command or bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skill = path.join(here, '..');

export const COMMANDS = [
  ['validate', 'validate.mjs', 'Schema check plus cross-reference lint; --fix writes computed values back; --strict applies settings.policy'],
  ['build', 'build.mjs', 'Validate, then render the self-contained page next to the model'],
  ['suggest', 'suggest.mjs', 'What the threat rules find; --apply writes them as suggested threats'],
  ['report', 'report.mjs', 'Executive, developer or audit report as Markdown'],
  ['portfolio', 'portfolio.mjs', 'One table across every model under a folder'],
  ['coverage', 'coverage.mjs', 'Which controls and requirements touch which framework clause; --gaps lists the untouched'],
  ['attributes', 'attributes.mjs', 'The attribute ids the Attributes card can show, for settings.attributes'],
  ['archive', 'archive.mjs', 'Snapshot and version bump before an edit; --diff logs the change after it'],
  ['scenario', 'scenario.mjs', 'The delta of a what-if tab against its baseline'],
  ['normalize', 'normalize.mjs', 'Map a typed answer onto an option list'],
  ['icons', 'icons.mjs', 'The vendor icon library: list, search, import; fetch a product logo for a model'],
  ['check', 'check.mjs', 'Headless geometry check of a built page (needs a Chromium-based browser)'],
  ['screenshot', 'screenshot.mjs', 'A PNG of one view of a built page'],
  ['model-reference', 'model-reference.mjs', 'Regenerate references/model-reference.md from the schema'],
  ['doctor', 'doctor.mjs', 'Environment report: versions, browser, links, write access; offline'],
];
const MULTI = new Set(['build', 'validate', 'check', 'screenshot']); // commands nb repeats per file when given several

export function versions() {
  const skillMd = fs.readFileSync(path.join(skill, 'SKILL.md'), 'utf8');
  const tpl = fs.readFileSync(path.join(skill, 'assets', 'template', 'template.html'), 'utf8');
  return {
    skill: (skillMd.match(/^\s*version:\s*"([^"]+)"/m) || [])[1] || '?',
    renderer: (tpl.match(/RENDERER_VERSION='([^']+)'/) || [])[1] || '?',
    declared: (skillMd.match(/^\s*renderer-version:\s*"([^"]+)"/m) || [])[1] || '?',
  };
}

/** The usage lines of a script, taken from the comment block at its head. */
export function usageOf(file) {
  const head = fs.readFileSync(file, 'utf8').split('\n').slice(0, 40);
  const out = [];
  let inUsage = false;
  for (const raw of head) {
    const m = /^(?:\/\/|\s?\*)(.*)$/.exec(raw);
    if (!m) { if (out.length) break; continue; }
    const line = m[1];
    if (/^\s{2,}node scripts\//.test(line)) { out.push(line.trim()); inUsage = true; continue; }
    if (inUsage && /^\s{12,}\S/.test(line)) { out.push('    ' + line.trim()); continue; }
    inUsage = false;
  }
  return out;
}

function list() {
  const v = versions();
  console.log(`NetBlueprint Forge ${v.skill}, renderer ${v.renderer}\n`);
  console.log('Usage: node scripts/nb.mjs <command> [args]   (nb <command> --help for a command\'s own options)\n');
  const w = Math.max(...COMMANDS.map((c) => c[0].length));
  for (const [name, , desc] of COMMANDS) console.log(`  ${name.padEnd(w)}  ${desc}`);
  console.log('\n  --version      skill and renderer versions');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { list(); process.exit(cmd ? 0 : 0); }
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') { const v = versions(); console.log(`NetBlueprint Forge skill ${v.skill}, renderer ${v.renderer}`); process.exit(0); }
  const entry = COMMANDS.find((c) => c[0] === cmd);
  if (!entry) { console.error(`nb: unknown command "${cmd}"\n`); list(); process.exit(2); }
  const file = path.join(here, entry[1]);
  if (rest.includes('--help') || rest.includes('-h')) {
    const lines = usageOf(file);
    console.log(`${cmd}: ${entry[2]}\n`);
    console.log(lines.length ? lines.join('\n') : `  node scripts/${entry[1]} (see the header of the file for its options)`);
    process.exit(0);
  }
  const files = MULTI.has(cmd) ? rest.filter((a) => !a.startsWith('-') && /\.(json|html)$/i.test(a)) : [];
  const flags = MULTI.has(cmd) ? rest.filter((a) => !files.includes(a)) : rest;
  let code = 0;
  if (files.length > 1) {
    for (const f of files) {
      const r = spawnSync(process.execPath, [file, f, ...flags], { stdio: 'inherit' });
      code = Math.max(code, r.status ?? 1);
    }
  } else {
    const r = spawnSync(process.execPath, [file, ...rest], { stdio: 'inherit' });
    code = r.status ?? 1;
  }
  process.exit(code);
}
