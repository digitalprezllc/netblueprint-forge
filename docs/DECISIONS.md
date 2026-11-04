# Decisions

Short records of choices that are not obvious from the code. Newest last.

## D1. Portable skill, single installable folder
One skill, `skills/netblueprint-forge/`, written to the [Agent Skills](https://agentskills.io/specification) spec. The interview, threat modelling, rendering and revision workflows live inside it as reference files that `SKILL.md` routes to, rather than as separate skills.

**Why:** a skill must be self-contained (file references one level deep from the skill root). Splitting into several skills would make them depend on each other's scripts and template, which breaks when a user installs only one. One folder is also the simplest thing to copy into eight different tools. It can be split later if `SKILL.md` outgrows the 500-line guidance.

## D2. `.agents/skills/` as the cross-tool install path
Install targets are `.agents/skills/` (Codex, Cursor, Gemini CLI, Copilot, Windsurf/Devin), `.claude/skills/` (Claude Code; also read by Copilot, Cursor, Windsurf) and `.kiro/skills/` (Kiro). `.github/skills/` is not needed because Copilot reads the other two.

**Why:** fewest links that cover every target. See [PLATFORMS.md](PLATFORMS.md) for the evidence.

## D3. Links, not copies, on this machine
`platforms/install.ps1` creates directory **junctions** (no admin rights needed on Windows) from each install path to `skills/netblueprint-forge/`. `install.sh` uses symlinks. `-Copy` is available for tools or filesystems that cannot follow links.

**Why:** one source of truth while developing; an edit is live in every tool at once.

## D4. Repo doubles as a Claude Code plugin and marketplace
`.claude-plugin/plugin.json` and `marketplace.json` at the repo root, with the skill discovered from the default `skills/` folder.

**Why:** lets Claude Code users install with `/plugin marketplace add` instead of cloning. Costs two small files.

## D5. Scripts in Node.js with no dependencies
`validate`, `build` and `archive` are plain `.mjs` files using only the Node standard library.

**Why:** Node is present wherever these AI tools run, and zero dependencies means no install step inside an air-gapped network. JSON Schema validation is implemented in-script for the subset of the spec the schema uses.

## D6. Model is JSON + JSON Schema; HTML embeds the JSON
**Why:** strict and validatable; the renderer stays a pure function of the model; any archived revision can be re-rendered with a newer template.

## D7. Risk method chosen per threat by the user
Likelihood × Impact (5×5) or OWASP Risk Rating, after the skill summarises the difference. Both map to the same severity bands.

**Why:** the user asked for it; teams differ in how much rigour they want per threat.

## D8. Threat numbers are permanent
Never reused; deletion is `retired: true`.

**Why:** archived revisions and change logs must keep agreeing with each other.

## D9. Cloud guidance is a bundled catalogue plus live research
Service cards for the most common AWS, Azure and GCP services ship inside the skill; anything else is researched live when the tool has web access, with sources recorded in the model. Proposed elements carry `suggested: true` until confirmed.

**Why:** the catalogue works offline and gives consistent, reviewed questions for the services most users actually deploy; live research keeps the long tail covered without bloating the skill. Marking proposals keeps the user the author of the model.

## D10. The shipped example is a public reference architecture, not the prior project
The example that started this project came from a customer engagement. It was removed from the repository entirely (files, model, docs, term maps) and replaced by `examples/azure-hub-spoke/`, built from Microsoft's published hub-spoke network topology and App Service baseline reference architectures, using Microsoft's fictional "Contoso".

**Why:** the repository must not carry anything that could identify that customer or their deployment, and a published reference architecture gives readers a design they can look up.

## D11. Controls are top-level objects referenced by id
`controls[]` lives at the top of the model with ids `CTL-0001…`; a threat's `treatment.controls` lists ids. Appendix A of the requirements showed controls nested inside the threat; the schema supersedes that.

**Why:** one control (an NGFW rule, MFA on the IdP) usually addresses several threats. Sharing by id keeps one owner, status and verification per control and lets the register answer "what does this control cover?".

## D12. Element names are ids; labels are for display
Every zone, node, component, flow, step, layer and appliance has a `name` matching `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$` that is unique within its kind and never shown, plus a free-text `label`. Components are referenced as `node/component`. The reserved zone name `internet` needs no declaration.

**Why:** the user refers to elements by name in later edits and the renderer uses names as DOM ids and CSS hooks, so they must be stable and safe; labels can then carry spaces, punctuation and later renames without breaking references.

## D13. Routing is heuristic with verification, not a full channel router
Flows get a port per box side (spread evenly, sorted by where the other end is), one shared pass-through port per appliance touch, a Z/L shape with a lane-offset channel, obstacle detours along free corridors (canvas edges, zone edges, just outside a blocking box), and a final pass that spreads collinear segments of different flows into 10px lanes without moving ports or creating diagonals. Zones reserve outer margins on the sides that carry boundary bars so corridors exist. The page exposes its geometry (`window.__nb`) and a checklist in `tests/README.md` verifies no box crossings, no diagonals, no text overlaps.

**Why:** a complete orthogonal channel router is a project in itself; this gets clean results on the reference example and degrades gracefully (a leftover collision is counted, never hidden). Appliances also declare `filters` (inbound/outbound/both) and `serves` (which far-end zones use them) so auto-routing through boundaries matches the architecture rather than pure geometry.

## D14. Typed answers are normalized to option lists
`scripts/normalize.mjs` holds one vocabulary per enumerated field (ids, labels, synonyms, one-line descriptions) and a matcher (exact → synonym → token overlap and edit distance). The skill runs it on every typed answer and confirms below 0.8 confidence; the validator uses it for "did you mean" on enum errors.

**Why:** the user asked that people can type freely while the model stays normalized, across the board. One place to add a synonym beats scattering heuristics through the interview.

## D15. Three risk ratings, current first
`risk.residual` is the rating with today's controls and drives the circle; `risk` is inherent (without them); `risk.projected` follows the planned controls. `treatment.current_controls` and `planned_controls` are the as-is and future state; `controls` is their union, kept by `validate --fix`.

**Why:** the user wants the rating that reflects what is in place today to be the one that is prompted and shown, with inherent and future-state ratings around it, and the register to make the as-is/to-be split visible.

## D16. The UI chrome is floating cards
Layers and Attributes are draggable cards over the whole page (minimize, close, remembered position; the Attributes card is resizable, scrolls, lists attributes alphabetically with a filter). Nothing element-specific is shown in the header band or below the canvas.

**Why:** the user's request, from working with Visio-style layer panels; it also frees the canvas height for the diagram.

## D17. Entra Application Proxy is the primary example
`examples/entra-app-proxy/` replaces hub-spoke as the first example the skill shows; hub-spoke stays as a second, busier one.

**Why:** fewer elements, and it is exactly the pattern the tool is for: Internet users, pre-authentication, an outbound-only connector brokering to an internal application, a corporate firewall, ExpressRoute, and a bad actor trying the same door.

## D18. Tabs are a list of whole scopes, not views over one inventory
`tabs[]` entries each carry their own zones, nodes, flows, steps, threats and controls; only meta, settings, auth types and layers are shared. Threat ids and numbers and control ids are unique across the document; other names are unique per tab.

**Why:** each tab is "its own data flow / threat model" (the user's words). A shared inventory with per-tab selections would make every edit by name ambiguous and the layout of one tab depend on another. Numbering threats across tabs keeps the register one table and the circle numbers permanent.

## D19. Title Case for labels, headings and enumerated values
AP-style Title Case (articles, conjunctions and short prepositions lower case except as first or last word; mixed-case words left alone; a short acronym list upper-cased) for every label and heading; sentences stay sentences. One function, kept identical in `validate.mjs` and the renderer.

**Why:** consistency between hand-typed labels ("Bad actor" vs "Bad Actor") and generated text; the user asked for grammatical capitalization in attribute names, titles and values as well.

## D20. The arrow leaves the initiator
One-way is the default and means "from initiates"; two-way is reserved for either-side initiation.

**Why:** the examples drew request/response flows two-way, so the employee → portal arrow looked as if the server opened the connection. From/to and the arrowhead now agree by rule, and the validator enforces it.

## D21. Persona and layout principles live in the skill, translated to this renderer
The persona (Principal Security Architect; data plane apart from control plane; a trust-boundary crossing needs inspection, authentication or transport security) is in SKILL.md; the tiered-zoning / declaration-order / secondary-flow / anchoring rules are in `layout-hints.md` as renderer-neutral principles.

**Why:** the source prompts were written for Mermaid and DOT (invisible edges, rank constraints). Here placement comes from zone nesting, declaration order and hints, and flows never move boxes, so the mechanics differ while the intent is kept.

## D22. Alignment comes from the renderer, not from hints
Internet nodes follow their private-side partners, ports snap to the partner's centre line, components are entered sideways, titles are obstacles. Hints (`order`, `row`) remain for the cases the rules get wrong.

**Why:** the user pointed at bends between adjacent boxes, lines over zone titles and an Internet column whose order forced detours. Fixing those in each model with hints would recur in every new model; rules in the renderer fix them once and the examples drop their manual `order` on Internet nodes.

## D23. The Threat Register is a tab, not a drawer
Every document ends with a Threat Register tab: one table across all diagrams, full height, searchable, filtered by the same severity chips as the canvas.

**Why:** a drawer under the canvas competed with the diagram for height and hid most of the table; as a tab it gets the whole canvas area and the same navigation as the diagrams, and single-diagram documents get it too.

## D24. Routing rules are enforced in the renderer, documented as rules
The user's six geometric rules (centre-line locking, zero-deflection transit, anti-dogleg, swimlanes, badge placement, perimeter gutters) are implemented where the renderer can decide alone (ports, bars, badges, corridors, Internet column) and documented as `row` guidance where the model must decide (private-side swimlanes). Full cross-zone centre-line locking that moves boxes is a later item.

**Why:** moving boxes to lock centre lines across zones with different paddings changes zone sizes and can undo other rules; port-level locking removes almost every dogleg already, and the remaining cases are visible and fixable with `row`.

## D25. Flow glyphs live on the line; bars yield, labels move
Everything that belongs to a flow (auth badge, ✕, threat circles, shield) sits on the line at a spot no other line touches. A bar never deflects a line: its pass-through port takes the arriving line's coordinate and the bar label relocates to the longest free stretch (or hides). Control shields take the bottom-left corner (top-left on vertical elements); the mitigated shield sits on the threat circle itself.

**Why:** the user's review pointed at a ✕ that read as blocking a neighbouring green path, badges floating beside their lines, a line jogging round a firewall label, and a "control in place" shield that looked like a second mark for the same threat. Each is now a renderer rule, so no future model needs a hint for it.

## D26. Centre lines are locked by lifting rows, never by moving boxes sideways
Alignment across zones is achieved by adding vertical space above a row (at the highest nesting level that moves only the chain in question), one lift per pass, data plane first, with any lift that breaks an earlier alignment reverted.

**Why:** a lift only adds space, so it cannot create overlaps or change left-to-right order; climbing to the highest single-item level keeps sub-zones compact (the whole Connector VNet moves inside the landing zone rather than the connector sinking inside its VNet); reverting keeps the first-aligned, highest-priority pairs straight when two goals conflict. The "quantised grid with one Y for the primary path" from the external suggestions is what this produces, without taking coordinates from the model or the LLM.

## D27. Lines come from a search with a stated precedence, and bars are crossed where the search decides
The router is an orthogonal visibility-graph A\* with an explicit cost order (bends, crossings, straight primary path, length, foreign zones, box flanks) instead of a fixed Z/L shape with patches. Boundary bars no longer get a pass-through port before routing; the bar is a set of candidate lanes and the router picks one by looking ahead to the stop behind it.

**Why:** every visual review produced a new special case for the Z/L heuristic (doglegs, hugging, crossings) and each fix moved the problem; the literature (Wybrow, Marriott and Stuckey; libavoid; yFiles) solves the whole class with one objective. Pre-assigned bar lanes were the last source of 10–20 px jogs: the lane was chosen from one side of the bar without knowing what the line had to reach on the other side. Letting the search choose the lane, with the rest of the route priced in, removed the jogs in all three examples. The precedence is written down so a future rule is added to the cost function, not as a new branch.

## D28. The page checks itself; the headless runner is any Chromium already on the machine
The geometry checks live in the renderer (`window.__nbTabs.check()`, `?nbcheck=1`), and `scripts/check.mjs` only launches a browser with `--dump-dom` and reads the report. No Playwright or jsdom dependency is added; Playwright's Chromium is used when it happens to be installed.

**Why:** the checks need real text metrics and SVG geometry (`getBoundingClientRect`, `getTotalLength`), which jsdom does not have, and a browser download in every environment the skill is installed into is not acceptable for a dependency-free skill. Putting the check in the page means the same report is available to a person in the console, to the skill's agent after a build, and to CI, with one implementation. Edge on Windows is the known gap (it hands the page to its running instance); the script says so and points at Chrome.

## D29. Source-available under the PolyForm Noncommercial License, with commercial grants per organization
The repository and the skill are licensed under the PolyForm Noncommercial License 1.0.0 with four additional terms from DigitalPrez: an output exception (generated diagrams, including the renderer copy embedded in them, are free for anyone to use and share), commercial licenses granted in writing per organization with or without a fee, a trademark reservation, and the notice rule. The verbatim license text and the terms sit in `LICENSE` at the repository root and in a copy inside the skill folder, so an installed skill carries it; a short form of the notice sits in a comment at the top of `assets/template/template.html`, so every generated HTML, which embeds the renderer, carries it without the user doing anything. The copyright line on the software reads 2025 to the current year: NetBlueprint Forge was first published in April 2025, and the build stamps the current year into each generated page; 1998, the company's founding year, belongs only where DigitalPrez itself is described, not on this work.

**Why:** the owner wants to keep control over who uses the skill commercially, choosing which organizations use it free and which pay, while letting anyone evaluate and learn from it. A permissive license would give that control away (anyone could resell the skill with the notice kept). PolyForm Noncommercial is a standard, readable text that forbids commercial use by default, so the written grant is the only way in and the owner decides case by case; the output exception is needed because every delivered diagram embeds the renderer and clients must be free to open it. Alternatives weighed: permissive licenses (no control over commercial use), the Business Source License (forces the code open on a date), the Elastic License (lets everyone use it commercially), and all-rights-reserved (nobody could evaluate it from a public repository). GitHub's license detection does not know PolyForm, so the repository shows "View license"; the README states the license in words and the plugin manifest carries the SPDX identifier.

## D30. Attack paths are their own collection, walked as a phase of the story
A chain is `attack_paths[]` with ordered hops that reference threats, flows and elements by name, not links hung on threats. On the page each path is a red phase whose steps are its hops, reusing the walkthrough (highlighting, packets, outcome) with numbered hop markers added.

**Why:** a chain has its own adversary, entry, impact, risk and breaking control, none of which belong to any single threat; one threat sits in several chains at different hops. Reusing the walkthrough means the reader already knows how to follow it (Next, Back, the band), and the register gets one more table instead of a new view. Numbers are permanent like threats' so a path can be cited across revisions.

## D31. A what-if is a scenario tab, and only a scenario may repeat ids
A change proposal is modelled as a copy of the baseline tab with `scenario: { baseline, change }`, kept in the same document, with the same threat, control and attack path ids as the baseline plus whatever the change adds. The cross-tab uniqueness rule is relaxed for exactly that pair (and for two scenarios of one baseline).

**Why:** the reader needs the two side by side with one register; a separate file would lose that and the delta script would need two inputs. Repeating ids is what makes "THR-0003 moved from High to Low under the scenario" expressible; new numbers for unchanged threats would read as new threats. Scenarios derive from the baseline only, so every delta reads against the real system.

## D32. Two lints raise the floor: classification on every flow, remediation on every open threat
Warnings, not errors, so an architecture-only diagram still builds; the examples carry both so the floor is visible.

**Why:** the ASPM framing the user brought in asks for payload sensitivity on every edge and an engineering remediation for every finding; a warning at validate time is the cheapest place to ask for both, and the interview now asks for them where they belong (Section 5, Section 7).

## D33. Two branches: develop is the working branch, master is the released state
The repository was initialised with `master` as the first branch and `develop` created from it; `develop` is checked out and is the default branch. Work lands on `develop` (directly or through feature branches) and `master` only ever receives merges from `develop`. Text files are normalised to LF through `.gitattributes`; the tool-specific install links (`.agents/`, `.claude/skills/`, `.kiro/`) stay untracked.

**Why:** the user asked for exactly this model: a stable `master` that is always a merge of `develop`, so a tagged release is a known state and day-to-day work never touches it. LF normalisation keeps the renderer and models byte-identical across the platforms the skill installs into; the install links are per-machine junctions.

## D34. CI runs the three checks; the layout job compares hard checks only
One workflow, three jobs: the validator suite (Node only), the schema check (Python with jsonschema), the headless layout check (Chrome from setup-chrome, `--hard-only`, rendered pages kept as an artifact). Triggers: pushes and pull requests to `develop` and `master`. The jobs run on a pinned image, `ubuntu-24.04`, and on the Node 24 generation of the actions (checkout, setup-node, setup-python and upload-artifact at v7, setup-chrome at v2); the pin moves on purpose, not with `ubuntu-latest`.

**Why:** the three commands already exist and need nothing beyond Node, Python and a browser, so the workflow installs nothing else and runs in about a minute. The crossings and bends baseline is font-dependent (the renderer measures text with the browser's fonts and Linux runners substitute "Segoe UI"), so CI enforces the hard geometric rules, which hold on any font, and leaves the baseline comparison to the developer machine where it was recorded; a baseline check in CI would fail for reasons that are not regressions. The image is pinned for the same reason: a migration of `ubuntu-latest` (to Ubuntu 26 from October 2026) would change the substituted fonts under the hard checks without any change in the repository, and the GCP example has already shown that a few pixels of font width can turn a clean route into an unroutable one.

## D35. The commercial grant document stays outside the repository
The one-page grant that gives an organization and its affiliates a commercial license (who is covered, internal or service-provider use, fee or no fee, term, ownership of output, warranty and liability) is kept in a private folder beside the repository and sent on request. `LICENSE` and the README say only that commercial licenses are available from subscriptions@digitalprez.com, and `.gitignore` lists the file name so a copy dropped into the working tree is never committed.

**Why:** a contract template drafted before counsel has reviewed it should not sit in a public history, where every revision stays visible. Publishing it would also fix the fee options, the liability cap and the affiliate rule as standard terms, while a document sent privately stays a starting point adjusted per organization. Nothing is lost for a prospective licensee, who gets the current version by email.

## D36. Pictures come from the renderer itself, through deep links
The README's pictures are PNGs of the built examples, taken by `scripts/screenshot.mjs` with the same headless Chromium the layout check uses, at the tab, step or attack-path hop a URL hash names (`#tab=…&step=…`, `&path=…&hop=…`); `tests/readme_screenshots.mjs` lists the views and regenerates them. No picture is drawn or edited by hand.

**Why:** a picture rendered from the current examples never lags behind the renderer, and the command that made it is in the repository, so anyone can reproduce it. The deep links came with it because a picture of "step 5" needs a way to open the page at step 5 without clicking, and the same links let a user send a colleague to one step or one hop of a chain. The page reports its own natural size so a picture holds the whole document, band to signature block, at the diagram's natural scale, instead of a viewport crop.

## D37. Releases are versioned zips of the skill folder, built without dependencies and published from master
A release is `netblueprint-forge-<version>.zip`, one top-level folder with `SKILL.md` inside, built by `platforms/package.mjs` (a small ZIP writer on `node:zlib`, no package) and published as a GitHub Release tagged `v<version>` by `.github/workflows/release.yml` whenever a merge to `master` carries a skill version that has no tag yet; the notes come from that version's section of `CHANGELOG.md`. The version is read from `SKILL.md`, never typed twice. The packager stamps every entry with the date of the version's `CHANGELOG.md` heading (`SOURCE_DATE_EPOCH` overrides it) instead of the files' own times, so a version's archive is the same bytes, and the same sha256, on any machine; `tests/check_package.mjs` checks it.

**Why:** claude.ai and the Claude API take a skill as a zip upload, and for every other tool a zip from the Releases page is the offline install, so the archive is the one artefact that serves all of them. Building it in the repository's own Node script keeps the "no dependencies" rule and makes the archive reproducible from any checkout; a GitHub Release, not a committed binary, is where a versioned artefact belongs. Tying the release to the skill version on `master` matches the branch model (develop always goes to master): a merge that does not raise the version publishes nothing, so releasing is a deliberate act, the version bump. The fixed stamp came after 0.7.0, whose local and CI archives differed in hash although every file inside was identical: the entries carried the files' modification times, which a git checkout sets to the checkout time. A fixed time removes the only machine-dependent field; the changelog date was preferred to the commit date because it is known before the release commit exists, which is when the hash is written into the changelog.

## D38. The vendors' own icons ship with the skill, as one index per provider, and reach the page through the build
The official Microsoft Azure (with Microsoft Entra), AWS and Google Cloud icon packages are imported by `scripts/icons.mjs` into `assets/icons/<provider>.json`, one file per provider holding each icon's markup, title, category, aliases and the vendor's terms. A model names an icon as `provider/id`; a cloud card declares its icon so cloud nodes get it without a field; `build.mjs` injects only the `<symbol>`s a page uses; the renderer draws them in the line icon's slot and names the vendors in the legend. The importer changes nothing in an icon but the ids and class names it prefixes.

**Why:** all three vendors publish SVG for exactly this use, so there is nothing to convert, and a diagram that shows Azure Key Vault with the Key Vault icon reads faster than one with a key glyph. One index file per provider instead of a thousand SVG files keeps the skill folder small in file count (claude.ai's skill upload is reported to refuse archives over about 200 files) and readable; embedding only the icons a page uses keeps pages self-contained and a few kilobytes larger per icon. Shipping all three sets, service and resource icons for AWS and both the 2025 and the legacy Google sets, was the owner's call, with the vendors' terms reproduced in `THIRD-PARTY-NOTICES.md` and a licence clause saying the icons are not DigitalPrez's; using the icons in diagrams is the permitted use Microsoft and AWS state and the use Google describes, and the renderer complies with the vendors' guidelines by construction (to scale, unaltered, name beside the icon, only on the product it depicts). Vendor icons are on by default for cloud nodes because a model that names a service should look like one; a single setting restores line icons.

## D39. Product logos are fetched one at a time into the model's folder, never shipped
A logo from the Dashboard Icons collection (dashboardicons.com, homarr-labs on GitHub) is named `dashboard/<name>` and fetched by `scripts/icons.mjs fetch` into `icons.json` beside the model; the build, the validator and the icon check read that file, so pages stay self-contained and a model folder carries what it needs. The fetch refuses markup a page must not embed (scripts, event handlers, foreign objects, external references) and normalizes the rest like a vendor icon.

**Why:** the collection holds about 2,250 SVG logos and the firewall vendors the owner asked about (Sophos, Fortinet, Palo Alto, Check Point) are among them, but most users will never place most of them, so shipping the set would add megabytes for nothing. Fetching on request also keeps the licensing footing clean: the Apache licence covers the collection, not the trademarks, and placing one's own vendor's mark on one's own diagram is ordinary identification, so the choice stays with the person making the document and the skill redistributes nothing. Builds never touch the network because the fetched file travels with the model; a build on a machine without it falls back to the line icon and prints the command that restores the logo. Fetching inside the build was rejected because it would make builds depend on the network and stop them being reproducible.

## D40. Reports are welcome, code is not: issue forms on, pull requests closed on arrival, vulnerabilities in private
The repository takes bug reports and feature requests through two issue forms (blank issues off) and declines code: `CONTRIBUTING.md` says so, a pull request template repeats it, and `.github/workflows/pull-requests.yml` closes a pull request from outside the organization on arrival with a note that points at the forms. `SECURITY.md` asks for vulnerabilities in private, through GitHub's private vulnerability reporting once the repository is public and by email meanwhile. No contributor agreement exists because nothing is contributed.

**Why:** the owner wants to hear from the people who use the skill without sponsoring a seat for each of them and without taking on outside code. A report describes behaviour and carries no copyright worth speaking of; a pull request is a copyrighted contribution, which GitHub's terms license under the repository's licence, and PolyForm Noncommercial, received that way, would not let DigitalPrez use the contribution commercially. Declining code keeps every line DigitalPrez's, which is what the commercial licence sells, and it is simpler than a contributor licence agreement, which would have to be signed, stored and explained. GitHub can switch issues off but not pull requests on a public repository, so the workflow does the next best thing: nothing is merged without the owner, and the sender hears why at once instead of waiting. Discussions stay off; a question is an issue.

## D41. Dependencies are structure: `depends_on` on the element, a `dependency` flow on the canvas
What an element needs to work (identity, directory, DNS, PKI, keys, secrets, logging, monitoring, time, a package registry, a backup target …) is a list on the element, `depends_on[]`, with a reference to the provider when it is on the diagram; a flow between the two, of kind `dependency` for a standing dependency or the real auth or data flow, puts it on the canvas, and the validator asks for the flow when it is missing. Dependency flows are routed with the control flows, drawn thin and dashed on their own layer, and keep their authentication badge.

**Why:** the cloud cards already knew the dependencies as prose, so the skill could ask about them but nothing could check them. As structure they let the validator catch "authenticates with Entra but has no flow to Entra", let the Attributes card answer "what breaks if this goes down" from both sides (Depends on, Depended on by), and let an attack path ride a dependency by rule rather than by hand. A separate flow kind, rather than lines generated from `depends_on`, keeps the rule that the model is the diagram's code: nothing is drawn that the model does not list. Routing dependencies with the control flows, not after them, kept every example's crossing count unchanged.

## D42. Requirements and evidence close the loop between a threat and an audit
`requirements[]` (`REQ-nnnn`, permanent numbers like threats) state what must hold, name the threats they answer, the controls that satisfy them and the framework clauses they serve; an implemented or verified requirement must rest on an implemented or verified control. Controls gain `evidence[]` (what showed the control works), ATT&CK mitigation and D3FEND ids, ISO 27001 ids and `frameworks[]` clauses. The register lists requirements beside the threats.

**Why:** a threat says what could go wrong, a control says what was built; an auditor asks what had to be true and how it was shown. Without a requirement object the model could not say "which controls satisfy PCI DSS 8.4.2 here", and without evidence a verified control was a claim. Requirements are their own objects, numbered and retired like threats, because they outlive the threats that raised them and are referenced from several. Evidence lives on the control, not the requirement, because that is where it is produced. Taxonomies on controls give the register a defensive vocabulary that matches the offensive one on threats.

## D43. Policy lives in the model; `validate --strict` enforces it
`settings.policy` states what must not ship: an open threat at or above a band with no planned control on track, an open threat without a treatment decision, an overdue control, a verified control without evidence, an approved requirement without a control, a suggested element, an unclassified flow, an accepted risk past its review date. `validate --strict` reports each as a policy failure with exit 1; the plain validator still only warns.

**Why:** CI needs one lever to fail a build on the model's security state, and the lever belongs with the model so that a customer's policy travels with the document and the pipeline needs no configuration. Keeping the plain validator unchanged matters: a model with open high threats is a true account of a system, and the interview must be able to save it; only the gate says it cannot ship like this. Defaults apply when no policy is written, so `--strict` means something on day one.

## D44. Custom metadata has one home, `custom`
Every element, threat, control, requirement, attack path, tab and the meta block accept a `custom` object (up to 40 keys with sane names) that the schema validates only by its key names, the validator ignores and the Attributes card lists under Custom.

**Why:** the schema is strict on purpose, so organisation fields (a CMDB id, a cost code, a register link) had been landing in description fields where nothing could find them. One named object admits them without loosening validation anywhere else and keeps them visible on the page.
