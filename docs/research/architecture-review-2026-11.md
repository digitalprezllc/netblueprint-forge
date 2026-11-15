# Architecture, service model and integrations: a review

November 2026, at skill 0.11.0 with renderer 1.11.0 in the working tree. The facts below were measured on the repository; the recommendations are judgments, each with an effort in days and a priority. Nothing here changes what the product is. The properties that make it different, one JSON model written by name, one self-contained page, no dependencies, no network calls of its own, a deterministic archive and a source-available licence, are the things to protect while making the rest easier to use and to keep.

## 1. What is there

| Measured | Value |
|---|---|
| Scripts in the skill | 15, Node.js, no dependencies; 9 of them parse their arguments with their own `opt()` and `has()` helpers; 12 answer `--help` or print a usage line, 3 do not |
| Renderer | one file, `template.html`, 1,351 lines; 144 lines longer than 300 characters, the longest 3,064 |
| Validator | `validate.mjs`, 529 lines; 22 lines longer than 300 characters |
| Schema | 4,079 lines; its `$id` was `https://digitalprez.com/netblueprint/schema/1/netblueprint.schema.json`, which returned 404; it now names `https://bifrost.digitalprez.com/netblueprint/schema/1/netblueprint.schema.json`, where the schema is published |
| Context the agent loads | `SKILL.md` about 5,500 tokens on every use; references about 70,000 tokens in total, loaded on demand, the largest being the model reference (13,900), the component cards (11,000) and the interview (5,200) |
| Checks | nine, in two CI jobs; the layout check carries a font-dependent baseline compared locally |
| Page features | 15 ARIA attributes, 7 roles, 4 tab stops; no print stylesheet, no export or copy-link control |
| Distribution | GitHub Releases from `master`, the same archive on bifrost by hand, install scripts that link the folder for Claude Code, Cursor and Kiro, a Claude Code marketplace manifest, Codex display metadata |
| Integrations in place | the official Azure, AWS and Google Cloud icon libraries shipped, product logos fetched on demand; a framework crosswalk extensible by `frameworks.json`; display switches extensible by `attributes.json`; ingest of Terraform, Bicep, CloudFormation, Kubernetes and OpenAPI as written guidance for the agent, not as a script; issue forms, automatic closing of outside pull requests, private vulnerability reporting, a release workflow |

## 2. Recommendations

### A. For the person reading a page

| # | Recommendation | Why | Effort | Priority |
|---|---|---|---|---|
| A1 | **Export from the page itself**: Download SVG and PNG buttons (the SVG is already in the page; a canvas renders the PNG), a print stylesheet so Ctrl+P gives a usable PDF, and a Copy link button for the current tab, step or hop. | Today a picture needs Node and Chrome on the machine. Auditors and architects want an artefact from the page they were sent, and the page's self-contained promise should cover its exports. | 3 | High |
| A2 | **Sharing presets**: ship `attributes.json` presets (`external-review`, `executive`, `auditor`) that combine the new display switches with `settings.show`, and document "building a page for outside readers". | The switches exist as of this release; presets turn them into a two-word instruction to the agent and a safe default for defence buyers. | 1 | High |
| A3 | **Accessibility pass**: focus order and a visible focus ring for every clickable element, `role="img"` with a title on nodes and flows, keyboard access to the Layers card and the register's eyes, and a colour-blind check of the five bands (they already carry numbers, which helps). | The page is used in reviews with many people on it; keyboard and screen-reader access is also a procurement checkbox at large buyers. | 3 | Medium |
| A4 | **Register state in the link**: `&q=` and `&bands=` in the hash, like `&sections=`. | A colleague gets the filtered view you are looking at. | 0.5 | Medium |
| A5 | **Find an element**: a search box on the toolbar that jumps to and selects a node, zone, flow or threat by name. | Diagrams at 1,900 pixels wide need scrolling; the register finds threats but nothing finds elements. | 1 | Medium |

### B. For the person authoring models

| # | Recommendation | Why | Effort | Priority |
|---|---|---|---|---|
| B1 | **Publish the schema at its `$id`** (on bifrost, with the `digitalprez.com` address redirecting) and put `"$schema"` in the examples and the scaffold. | The `$id` returns 404 today, which is a defect. Once it resolves, VS Code and every JSON-aware editor validate and complete a model as it is typed, with no tooling from us. | 0.5 | High |
| B2 | **One front door, `nb`**: `scripts/nb.mjs` dispatching to the fifteen scripts with one argument parser, `--help` everywhere, `--json` where output is data, `--version`, and documented exit codes. The scripts stay callable as they are. | Nine scripts parse arguments in nine ways; CI pipelines and support instructions get shorter and consistent. | 2 | High |
| B3 | **`nb doctor`**: Node version, browser found and where, skill and renderer versions, icon indexes present, write access, and the checks it can run locally; the bug report form asks for its output. | Half of a support conversation is establishing the environment. It must stay offline. | 1 | High |
| B4 | **`nb diff`**: an element-level difference between any two model files, the same engine the archive changelog and `scenario.mjs` use. | Change review of a model today means reading JSON; the engine exists twice in pieces. | 2 | Medium |
| B5 | **`nb new`**: a scaffold with `$schema`, meta, settings and one zone, commented. | A start without the interview, for a human or for an agent that follows instructions loosely. | 0.5 | Medium |
| B6 | **Deterministic ingest** for the two inputs with stable structure: OpenAPI to components and flows, Terraform plan JSON to zones and nodes, emitting `suggested` elements. | Ingest is guidance today, so results depend on the agent; a script gives the same proposal every time and the agent then does the judgment. | 5 | Medium |

### C. Serviceability of the code

| # | Recommendation | Why | Effort | Priority |
|---|---|---|---|---|
| C1 | **Split the renderer into source modules** under `assets/template/src/` with a concatenating build (`scripts/build-template.mjs`) that writes the single `template.html`, plus a line-length rule. The product stays one file. | Every renderer change today is a text patch against lines of up to 3,000 characters; the legend, the eyes and the attribute switches each took exact-match surgery. This is the largest risk to the pace of change and to onboarding anyone else. | 5 | High |
| C2 | **Split the validator's lint** into named checks in a `lint/` folder, one per concern, with the same entry point. | 22 long lines hold most of the rules; adding one means finding the right clause in a 678-character line. | 3 | Medium |
| C3 | **A `package.json` with scripts and `engines`, no dependencies**: `npm test` runs the nine checks, `npm run build:examples`, `npm run pictures`. | Everyone knows `npm test`; the engines field states Node 18 or later in the one place tools read it. | 0.5 | High |
| C4 | **`node --test` as the harness**: each check becomes a test file with TAP output and per-assertion names; the check scripts remain as entry points. | Built into Node since 18, no dependency; CI shows which assertion failed instead of a log tail. | 2 | Medium |
| C5 | **Golden files for generated output**: the three reports, the coverage Markdown and the self-check report's attribute ids per example, stored like the layout baseline and diffed by a check. | Catches silent drift in output that humans paste into evidence packs. | 2 | Medium |
| C6 | **One vocabulary file**: labels, kinds, strengths and the skip lists now live in the template, in `normalize.mjs` and, as of this release, in `attributes.mjs`, kept equal by tests; generate them from one `vocab.json` inlined at template build (C1 makes this natural). | Three hand-kept copies is one too many; the test that guards them is a symptom. | 2 | Medium |

### D. Service model and operations

| # | Recommendation | Why | Effort | Priority |
|---|---|---|---|---|
| D1 | **Let the release workflow publish to bifrost**: on a new version, upload the archive and the five pages over SFTP or rsync with a deploy key held as a repository secret, then fetch them back and compare hashes. | Publication is a manual step after every release and every renderer change, with a standing instruction to stage files by hand. A deterministic archive makes the verification trivial. | 1 | High |
| D2 | **Keep the version in one place and check the rest**: `SKILL.md` is the truth; the packaging check should fail when the two plugin manifests or the README status line disagree with it. | The cut of 0.10.1 and 0.11.0 each edited five files by hand. | 0.5 | High |
| D3 | **Write the compatibility policy**: model format `netblueprint: 1` and what a 2 would mean, renderer semver, the promise that a built page opens unchanged forever, field deprecation through validator warnings for one minor version, and a `migrate` command when a format change ever comes. | Buyers of a source-available tool ask this on day one; the answer exists in practice but not on paper. | 1 | Medium |
| D4 | **An update path**: `install.sh --update` and `install.ps1 -Update` (fetch, verify the archive hash, relink), and `nb doctor` showing the installed version beside the latest it was told about. | The install scripts have no update or upgrade path today; offline by design, so the check works from a file or a pasted changelog, never a call home. | 1 | Medium |
| D5 | **`SUPPORT.md`**: what comes free (issue forms, documented checks), what a commercial grant includes (response time, a named contact, which versions are supported), and a known-issues note per release. | The grant template covers terms; the repository should say in one page what a licensee can expect, which also sets expectations for everyone else. | 0.5 | Medium |
| D6 | **Richer marketplace manifests**: `homepage`, `repository` and `bugs` fields, the slash commands the plugin offers, and a one-paragraph listing description. | The manifests carry a name and a sentence; marketplace listings are read before the README. | 0.5 | High |

### E. Integrations to add

| # | Recommendation | Why | Effort | Priority |
|---|---|---|---|---|
| E1 | **A GitHub Action for the policy gate**: `uses: digitalprezllc/netblueprint-forge/.github/actions/validate@v0.11.0` running `validate --strict`, building the page as an artefact, and failing the job on policy; plus a pre-commit snippet. | "CI gates on the model with one command" becomes a copy-paste rather than an instruction. | 2 | High |
| E2 | **SARIF from `validate --strict` and `suggest`**: findings appear in GitHub code scanning and Azure DevOps with file positions. | The output format large security teams already route; it also makes the rules' findings countable across repositories. | 2 | High |
| E3 | **Open Threat Model export, then import**: the open JSON threat-model format that IriusRisk originated; export first, import second. | The single strongest interoperability signal to an enterprise buyer with an incumbent, and a migration path for the free tiers of the competitors named in the pricing research. | 3 export, 5 import | High |
| E4 | **An MCP server** exposing validate, build, suggest, report and coverage as tools over stdio. | Claude Desktop, Cursor and other MCP clients then call the scripts without the skill's folder conventions; one competitor already ships one. | 3 | Medium |
| E5 | **Ticket links**: `settings.links.ticket_base` so a control's `ticket` renders as a link; the same for a `repository` base on components. | The fields exist; one setting makes them clickable. | 0.5 | Medium |
| E6 | **Importers for Threat Dragon, pytm and Threagile** files into proposed elements. | The free tools' users are the likeliest first adopters; a converter costs them nothing to try. | 3 each | Low to Medium |
| E7 | **Crosswalk additions that are free to ship**: the FedRAMP Moderate and High baselines (selections of SP 800-53, public), and CSA CCM mappings if their terms allow. | FedRAMP is the next question after CMMC from federal-facing buyers; it is a baseline over controls the crosswalk already keys on. | 1 | Medium |

## 3. A sequence that pays for itself

1. **Week one, the cheap foundations:** C3 `package.json`, B2 the `nb` front door, B3 `nb doctor`, B1 the published schema, D2 the version check, D6 the manifests. Six items, about five days, and every later item lands on them.
2. **Week two, operations and sharing:** D1 publication from the release workflow, A2 the presets, E1 the GitHub Action, E2 SARIF.
3. **Week three, the renderer's future:** C1 the source split, done before the next large renderer feature rather than after it, then A1 export and print.
4. **Then, by demand from the conversations under way:** E3 OTM export, E4 the MCP server, A3 accessibility, D3 the compatibility policy.

## 4. What not to change

- No dependencies in the scripts and none in the page. The single most repeated reason buyers in the research preferred local tools.
- The model written by name, never by coordinates, with the renderer owning layout and checking its own geometry.
- One file per document, with the model embedded, that opens the same way in ten years.
- No network calls of the skill's own, and the honest statement of what the AI host does.
- The deterministic archive with one hash per version, and the practice of recording it in the changelog.
- Reports and feature requests through forms, code written here, and the licence as it stands.
