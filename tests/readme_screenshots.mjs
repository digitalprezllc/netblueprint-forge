#!/usr/bin/env node
// Regenerates the pictures the README shows (docs/images/*.png) from the built examples, with the skill's scripts/screenshot.mjs.
//
//   node tests/readme_screenshots.mjs [--browser <exe>]
//
// Build the examples first (node tests/check_layout.mjs does; so does build.mjs on each model). Every picture is the whole page, band to
// signature block, with the diagram at its natural size; the list below says which tab, step or attack-path hop each one shows.
// Needs a Chromium-based browser on the machine, like the layout check. Exit codes: 0 all written, 2 a picture could not be made.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser } from '../skills/netblueprint-forge/scripts/check.mjs';
import { screenshot } from '../skills/netblueprint-forge/scripts/screenshot.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = [
  { page: 'examples/entra-app-proxy/entra-app-proxy.html', out: 'docs/images/entra-app-proxy.png', step: 'kcd', width: 1600,
    shows: 'Entra Application Proxy: the Kerberos constrained delegation step' },
  { page: 'examples/azure-hub-spoke/azure-hub-spoke.html', out: 'docs/images/azure-hub-spoke-attack-path.png', tab: 'main', path: 'AP-0001', hop: 2, width: 1900,
    shows: 'Azure hub-spoke Baseline: attack path AP-0001 at hop 2' },
  { page: 'examples/azure-hub-spoke/azure-hub-spoke.html', out: 'docs/images/azure-hub-spoke-whatif.png', tab: 'whatif-redis', step: 'cache', width: 1900,
    shows: 'Azure hub-spoke What-If tab: the cache step of the proposed change' },
  { page: 'examples/azure-hub-spoke/azure-hub-spoke.html', out: 'docs/images/threat-register.png', tab: 'threat-register', width: 1600,
    shows: 'Threat Register tab of the hub-spoke document' },
  { page: 'examples/partner-portal-tabs/partner-portal-tabs.html', out: 'docs/images/partner-portal-admin-access.png', tab: 'admin-access', step: 'jump', width: 1600,
    shows: 'Partner Portal, Admin Access tab: the jump host step' },
];

async function main() {
  const args = process.argv.slice(2);
  const bi = args.indexOf('--browser');
  let browser;
  try { browser = await findBrowser(bi >= 0 ? args[bi + 1] : undefined); } catch (e) { console.error(`readme_screenshots: ${e.message}`); process.exit(2); }
  if (!browser) { console.error('readme_screenshots: no Chromium-based browser found (install Chrome or Chromium, or pass --browser <path> / set NB_BROWSER)'); process.exit(2); }
  let code = 0;
  for (const s of SHOTS) {
    try {
      const r = screenshot(browser, path.join(ROOT, s.page), { out: path.join(ROOT, s.out), tab: s.tab, step: s.step, path: s.path, hop: s.hop, width: s.width, height: s.height || 'auto' });
      console.log(`${s.out}  ${r.width}×${r.height}  ${s.shows}`);
    } catch (e) { console.error(`readme_screenshots: ${s.out}: ${e.message}`); code = 2; }
  }
  console.log(code ? 'readme_screenshots: some pictures were not written' : `readme_screenshots: ${SHOTS.length} pictures written (browser: ${path.basename(browser)})`);
  process.exit(code);
}
main();
