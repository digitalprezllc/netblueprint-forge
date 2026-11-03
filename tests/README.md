# tests/

## Validator suite (no dependencies)

```bash
node tests/check_validate.mjs
```

Runs `scripts/validate.mjs` on every fixture and on the shipped examples (`invalid-*` must fail, the rest must pass), then spot-checks `computeAssessment` against the matrices in `docs/research/threat-attributes.md`. `invalid-refs.model.json` covers the cross-reference lint: duplicate names, dangling zone/node/flow/step/threat/control references, unknown auth types and layers, a mitigated threat without an implemented control, and a rating that contradicts its inputs.

## Schema fixtures

`fixtures/*.model.json` are small models. A file named `invalid-*.model.json` is expected to **fail** validation; every other fixture is expected to pass.

- `tabs-minimal.model.json`: two diagram tabs plus a what-if scenario tab (`front-cache`, derived from `front`) that repeats the baseline's threat and attack path ids, which the lint allows only for a scenario; `front` carries attack path `AP-0001`.
- `invalid-lint-attack-path.model.json`: a hop whose threat does not exist, a hop whose flow does not exist, a hop with neither flow nor destination, a mitigated path whose breaking control does not exist, a duplicate path id. Expected: 7 errors.
- `minimal.model.json`: exercises every top-level section once: nested zones with boundary appliances, a host with components, Internet-side actors and SaaS, flows of several kinds and auth strengths, two phases and steps, a mitigated threat with both inherent and residual Likelihood × Impact plus CVSS, an open threat scored with OWASP RR, a shared control, a custom layer.
- `invalid-enums.model.json`: bad names, unknown enums, empty required arrays, conditional rules (retired without reason, override without reason, verified control without verification). Expected: 13 errors (12 real ones plus one `unevaluatedProperties` cascade on the already-invalid `risk` object; `validate.mjs` must report only root causes).

```bash
pip install jsonschema
python -I tests/check_schema.py
```

Or, with jsonschema installed somewhere else: `python -I tests/check_schema.py --lib <dir>`.

This is a development check of the schema itself. The validator users run is `skills/netblueprint-forge/scripts/validate.mjs` (Node, no dependencies), which also does the cross-reference lint the schema cannot express: unique names, dangling references, auth type ids, layer names, threat/control ids, computed ratings.

## Layout checks (automated)

```bash
node tests/check_layout.mjs              # builds the five examples, checks every diagram tab, compares with the baseline
node tests/check_layout.mjs --no-build   # check the HTML files as they are
node tests/check_layout.mjs --update     # rewrite tests/layout-baseline.json from the current numbers (after looking at the diagrams)
node tests/check_layout.mjs --font "DejaVu Sans"   # what a Linux runner sees: the examples built with that font instead of "Segoe UI", hard checks only, nothing overwritten
```

The script needs a Chromium-based browser on the machine (Chrome, Chromium, Brave, or Playwright's Chromium when that package is installed; pass `--browser <exe>` or set `NB_BROWSER` for an unusual location) and nothing else: no npm install. It runs `skills/netblueprint-forge/scripts/check.mjs`, which opens each page headless with `?nbcheck=1`; the page then runs its own geometry check on every diagram tab and appends the report as a `<script type="application/json" id="nb-report">` element, which the script reads from `--dump-dom`. Microsoft Edge on Windows hands the page to its running instance and prints nothing, so prefer Chrome there. Exit codes: 0 pass, 1 fail, 2 no browser or no report (CI should treat 2 as a failure too).

A tab **fails** when any of these is non-empty (the "hard" checks, also listed in the page as `window.__nbTabs.hardChecks`):

| Report key | Meaning |
| - | - |
| `collisions` | a line segment passes through a box it does not connect to (its 12 px port stubs excepted) |
| `nearMisses` | a segment within 8 px of such a box |
| `fallback` | a leg the router could not route (drawn as a plain L / Z) |
| `lineOverText` | a line crosses a text element on screen |
| `textOverlaps` | two visible texts overlap by more than 2 px |
| `glyphsNear` | an auth badge, ✕, threat circle or shield sits within 11 px of another flow's line |
| `jogs` | a middle segment shorter than 20 px between two bends |
| `sharedStretches` | two different flows share one lane for more than 1 px |

It also reports, per tab, the number of perpendicular **crossings** between flows and the **longest flow's bends** (`maxBends`, with `bends` per flow). `tests/layout-baseline.json` records those for every example tab; the test fails when either number grows, so a routing change that adds crossings or bends is visible even though it breaks no hard rule. Baseline on 2026-10-25 (renderer 1.7.0): Entra Application Proxy 6 crossings / 2 bends, Azure hub-spoke Baseline 33 / 7 and What-If 51 / 7, Partner Access 6 / 2, Admin Access 2 / 4. The hub-spoke numbers grew with the second threat marker on the jump VM, the control shield on its SQL flow and the what-if tab's extra node and flows; the checks above stay at zero. Added on 2026-11-01 (renderer 1.8.0): AnyCompany on AWS 8 crossings / 3 bends, Cymbal on Google Cloud 17 / 4 (two more than its first cut: the subnet captions were shortened so the connector route holds on the wider fonts of a Linux runner).

Without a browser available to Node, the same report is one call away in any browser: open the built page, press F12 and run `window.__nbTabs.check()` in the console (it switches through the tabs and comes back), or open the page with `?nbcheck=1` and read the `#nb-report` element. The page also exposes `window.__nb` for the current tab (`model` with computed `_box` geometry, `routes` with points and a `fallback` count, `markers`, `VB`, `collisions`, `nearMisses`, `router` with the routing grid) and `window.__nbTabs.show(i)` to switch tabs.

Two checks stay manual: that the page fits the user's screen without scrolling at their resolution (below `settings.layout.min_width / min_height` it scrolls by design), and that the diagram reads well: the checker proves the geometry is clean, not that the story is told in the right order.

## README pictures

```bash
node tests/readme_screenshots.mjs
```

Regenerates `docs/images/*.png`, the pictures the README shows, from the built examples with `skills/netblueprint-forge/scripts/screenshot.mjs` and the same browser as the layout check. Each entry in the script names the page, the tab and the step or attack-path hop to show; every picture is the whole page, band to signature block, at the diagram's natural size. Run it after a renderer change that is visible, look at the pictures, and commit them with the change.

## Continuous integration

`.github/workflows/checks.yml` runs on every push and pull request to `develop` and `master` (and by hand from the Actions tab): three jobs on `ubuntu-24.04`, one per check above. The image is pinned rather than `ubuntu-latest` because the layout check measures text with the fonts the image substitutes for "Segoe UI": a new image can move a route without any change in the repository, so the pin moves on purpose, after a run of `check_layout --font` with the new image's fonts (`ubuntu-latest` began moving to Ubuntu 26 in October 2026). The actions are the Node 24 generation: `actions/checkout`, `setup-node`, `setup-python` and `upload-artifact` at v7, `browser-actions/setup-chrome` at v2, which installs Chrome for Testing. The validator suite needs only Node; the schema check installs `jsonschema` with pip; the layout check gets Chrome from `browser-actions/setup-chrome`, builds the examples and runs `node tests/check_layout.mjs --hard-only`, then uploads the rendered pages as a build artifact (14 days) so a failure can be looked at.

`--hard-only` is deliberate: the renderer measures text with the browser's fonts ("Segoe UI", then Arial), and a Linux runner substitutes them, so boxes come out a few pixels wider or narrower and crossings or bends can move by one. The hard checks (nothing through or hugging a box, nothing over text, no glyph clashes, no jogs, no shared lanes, nothing unrouted) are meant to hold on any font, but a route that squeaks past a caption by a few pixels with Segoe UI can fail with a wider font, so run `node tests/check_layout.mjs --font "DejaVu Sans"` before pushing an example: it builds the pages with that font, the closest thing on a Windows machine to what the runner substitutes, into a temporary folder and runs the hard checks there. `--font Verdana` is a harsher stress test that the hub-spoke and partner portal examples do not pass today; the runner's fonts are not that wide. The crossings and bends baseline is compared where it was taken, on a developer machine, with the plain `node tests/check_layout.mjs`.

`.github/workflows/release.yml` is the second workflow: on every push to `master` it runs the validator suite, builds `netblueprint-forge-<version>.zip` with `platforms/package.mjs`, tests the archive with Python's `zipfile`, keeps it as a workflow artifact, and publishes a GitHub Release tagged `v<version>` when that tag does not exist yet. The archive was checked locally with Python's `zipfile -t` and with PowerShell's `Expand-Archive`, whose extraction matched the skill folder file for file by SHA-256.

`.github/workflows/pull-requests.yml` is the third: on `pull_request_target` it closes a pull request opened from outside the organization with a note, because the repository takes bug reports and feature requests and not code (`CONTRIBUTING.md`). It runs with the repository's own token on the base branch and checks nothing out, so nothing from the pull request runs. Pull requests from the owner, members and collaborators are left alone, and `checks.yml` still runs on those.

## Icon library check

```bash
node tests/check_icons.mjs
```

Checks the vendor icon library and its use without a browser: the three index files in `skills/netblueprint-forge/assets/icons` parse, hold real icons and have aliases that resolve; every cloud card's icon resolves; every example's icons resolve and each built example page carries exactly one `<symbol>` per distinct icon it uses, with unique ids, every `<style>` inside a symbol scoped to prefixed class names, and the symbols within a 200 KB budget; and the normalizer prefixes ids, `url(#…)` references and classes while leaving colours alone; and the fetch path, offline, with a folder standing in for the CDN: a logo lands in `icons.json` beside the model, normalized and prefixed, and resolves from there, while an SVG that carries a script, a name the source lacks and a shipped provider are refused. CI runs it in the validator job.
