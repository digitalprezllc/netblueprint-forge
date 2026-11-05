# NetBlueprint Forge: Requirements

This is the source of truth for scope. Change it here first, then change the code.

## 1. Purpose

A context model steers an AI tool through a structured interview with the user. The answers populate a JSON model of a network, application or data flow. A renderer turns that model into a single self-contained HTML file: an interactive diagram with a guided walkthrough, threats and layers.

Three parts:

| Part | What it is |
| - | - |
| **Context model** | JSON, validated by a JSON Schema. The single source of truth. Unique names are its keys. |
| **Skill** | Portable `SKILL.md` + references + scripts. Runs the interview, validates, renders, archives. |
| **Renderer** | One HTML template. Takes the model JSON and computes layout at load time. |

The reference example is [examples/azure-hub-spoke/](../examples/azure-hub-spoke/), built from Microsoft's published hub-spoke network topology and App Service baseline reference architectures. It exercises nested zones with boundary appliances, Internet-side actors, a host with components, flows of every kind and auth strength, a nine-step story, threats and controls. The renderer must render it with no overlaps.

## 2. Context model

### 2.1 Zones
- Nest to any depth (e.g. Azure subscription › Spoke VNet › App subnet / Data subnet).
- Each zone has a unique name, label, sub-label, colour (user-overridable), optional dashed border and optional icon.
- **Boundary appliances.** A zone may have one or more filtering appliances on its edge (firewall, WAF, gateway, proxy). All traffic into the zone's inner zones passes through it. Inner zones may have their own appliances for segmentation. Appliances are attached to a zone boundary, never given coordinates. Connections that cross a boundary are routed through its appliance.
- A firewall is drawn as in the sample: a narrow vertical bar on the boundary with a rotated label and the firewall glyph.

### 2.2 Placement: Internet vs private
- Anything marked SaaS or publicly reachable sits on the **Internet** side with a cloud icon.
- Everything else sits under a top-level label naming the private network ("Corporate Network", "Private Network", the organisation's name).
- The seam between the two sides is drawn only when the model has both. An all-private model shows only its network label.

### 2.3 Nodes and components
- A **node** is either a simple box (one server/service) or a **host container** that lists the components running on it (web server, SQL Server, another service process).
- Each component has a type that sets its icon and lets flows and threats attach to it ("SQL Server on HOST-01", not just "HOST-01").
- **Node names must be unique** across the model. They are the stable identifiers used in later updates ("move SQL-01 into DMZ").
- Supported icon types (minimum): server, database, service, connector, cloud, shield, firewall, lock, user, remote user, bad actor (hostile styling), laptop, workstation, mobile device, IoT/OT device.
- Nodes carry an `info` text shown on click, an optional data classification (PII, PCI, mission critical…), and optional layout hints (see 3.2).

### 2.4 Flows and authentication
- A **flow** has a source, a destination (node or component, by unique name), a direction, and an **authentication type**.
- Authentication types carry a **strength** that changes how the line is drawn:
  - Weak (anonymous, username/password, basic auth, API key): warning colour, dashed line or caution marker.
  - Strong (MFA, mTLS, certificate, Kerberos, phishing-resistant): secure colour, solid line, lock/shield marker.
- The list of auth types and their strengths is defined in the model so it can be extended.
- Flows may carry protocol/port and other attributes.
- Flow kinds from the sample stay available: control, auth, token, data, blocked (red ✕), trust (dotted), tunnel (animated).

### 2.5 Steps (the story)
- The author writes steps as a guided walkthrough, in their own order and words.
- Each step references one or more flows, highlights nodes, animates packets, and may mark tunnels, badges and an outcome.
- Steps are grouped into phases (as the sample's Connect / Identity / Authorize / Access).
- A step may call out the threats relevant to that flow.

### 2.6 Threats
- A threat is its own object with a **permanent number** (the digit in the circle) and a formal id (`THR-0042`). Numbers are never reused; a removed threat is marked `retired`.
- One threat can target many places: zones, nodes, components, flows and boundary crossings. Its circle appears at each target unless the target is marked `marker: false`.
- **Risk method is the user's choice per threat**, after a short comparison:
  - *Likelihood × Impact (5×5)*: two questions, quick, good for design-stage triage.
  - *OWASP Risk Rating*: 8 likelihood + 8 impact factors rated 0–9; slower, more defensible and repeatable.
  - Both map onto the same severity bands so the circle colours stay consistent.
- Draft object shape: see Appendix A. Enumerations for every prompted field are in [research/threat-attributes.md](research/threat-attributes.md) (STRIDE, LINDDUN, ATT&CK v20 tactics, STIX adversary vocabularies, NIST 800-30 scales, OWASP RR factors, ISO 27005 treatments, control types, status lifecycle, reference-ID patterns).
- **Controls are first-class objects**: a threat has a treatment decision (Mitigate / Accept / Transfer / Avoid) and zero or more controls with type, status, effectiveness, owner, ticket and verification. Residual risk is recorded after controls.

### 2.7 Layers
- Like Visio: a layer list in the diagram with a show/hide toggle per layer.
- Built-in layers: zones, boundary appliances, nodes, components, Internet resources, flows by auth strength, blocked paths, threat markers, controls, labels.
- Custom layers defined by the author ("Phase 2", "Proposed", "Legacy", "OT Network").
- An element may belong to several layers; it hides only when all of its layers are off.
- Hiding a node hides its flows and threat circles. No line may point at nothing.
- Layers and their default visibility live in the model.

### 2.8 Signature block
- Logo (embedded as a data URI), author, date, title of the flow/model, description, model version and renderer version.
- Fixed position; never overlaps nodes or paths; visible when printed.

### 2.9 Other model content
- Assumptions and out-of-scope lists.
- Legend definitions are derived from the model, never hand-written; the legend is grouped (Flows, Authentication, Elements, Threats) with a caption per group, and every entry stays on one line.
- Colour overrides for any zone or node.

### 2.10 Service profile
Nodes, components and appliances carry an optional `profile`: ownership, platform (with support status), location, device authentication (single/multi-factor, methods, assurance, credential storage), elevated access (model, MFA, pathway, local admin, plane), patching, hardening baseline, and software sourcing (COTS, GOTS, open source, custom, SaaS). Option lists in [research/service-flow-threat-attributes.md](research/service-flow-threat-attributes.md).

### 2.11 Flow detail
Flows carry optional `connection` (type, initiator, session), `data` (what each side sends, sensitivity, industry labels such as NPI, CUI, FCI, MNPI, PII, TLP), `transport` (protocol, security protocol, implicit/explicit, what it provides: confidentiality, integrity, authentication, forward secrecy, replay protection; certificate validation), `authentication` for client and server (method, factors, MFA type, where the credential or key lives, rotation, issuer, pinning), `path_controls` (logged, rate limited, inspected) and `availability`.

### 2.12 Threat detail
Threats carry a normalized `vulnerability` category (with CWE and free text), a `risk.consequence`, three ratings (inherent, current with today's controls, projected with planned controls), `treatment.current_controls` / `planned_controls` (as-is and future state) and `treatment.suggested_mitigations`. Threat statements follow "A [adversary] could [action] on [target] by exploiting [weakness], causing [consequence]"; STRIDE is described to users who do not know it.

### 2.13 Scope
Zones, appliances, nodes, components and flows accept `out_of_scope` with `scope_reason`. Out-of-scope elements stay on the diagram with all metadata, drawn greyed out.

### 2.14 Normalization
Whatever the user types for an enumerated field is matched to the model's options (synonyms + fuzzy match) and confirmed when the match is uncertain. Applies to every enumerated field.

### 2.15 Tabs
A document may hold several diagrams, each its own flow and threat model, as `tabs[]`. Each tab has `name`, `label`, optional summary fields (description, objective, flow_summary, path_summary, access_summary) that override `meta` for that tab, and its own zones, nodes, flows, phases, steps, threats and controls. `meta`, `settings`, `auth_types` and `layers` are shared. Names are unique within a tab; threat ids and numbers and control ids are unique across the whole document. A model without `tabs[]` is one diagram (the format is unchanged).

### 2.16 Capitalization
Labels of zones, appliances, nodes, components, flows, phases, layers, tabs and auth types, the document title and subtitle, the side labels, threat titles and control names are Title Case (AP style: "Bad Actor", "Edge Firewall", "Blocked by Policy"; mixed-case words such as mTLS and acronyms stay as written). Step titles and all descriptions are sentences. The validator warns and `--fix` rewrites. The renderer shows enumerated ids and attribute names the same way ("Out of Scope", "Credential Storage", "MFA Required").

### 2.17 Arrow direction
The arrow leaves the initiator: `from` opens the connection, `to` answers. A request/response flow is one-way even though data flows back; `direction: two-way` is only for flows where either side initiates (`connection.initiator: either`). The validator rejects `initiator: to` (swap from/to) and warns on two-way request/response flows.

### 2.18 Attack paths
- `attack_paths[]` per diagram (tab): id `AP-nnnn`, permanent number, title, description, adversary, entry, ordered `hops[]` (threat, via flow and/or to, from, gain, note, bypasses), impact, assets at risk, the chain's own risk (inherent, residual, projected; computed bands written back by `--fix`), `breaks_at` controls, ATT&CK ids, layers, suggested.
- Lint: ids and numbers unique across the document (a scenario tab may repeat its baseline's); every hop's threat exists in the diagram; a hop has a flow or a destination; the chain is continuous (warning); the hop's threat targets something on the hop (warning); a mitigated path has an implemented or verified `breaks_at` control; Title Case titles (`--fix`).

### 2.19 What-if scenario tabs
- A tab with `scenario: { baseline, change, date, author, assumptions[] }` is a copy of its baseline tab with one change applied. It is the only tab allowed to repeat another tab's threat, control and attack path ids. The baseline must exist and must not itself be a scenario (warning).
- `scripts/scenario.mjs` prints the delta: elements added / removed / changed, new or altered trust-boundary crossings, new Internet-facing paths, weakened flows, invalidated controls, threats and attack paths added / removed / moved (status and bands). Markdown by default, `--json` for the data.

### 2.20 Classification and remediation lints
- Every flow that is not `trust` or `blocked` has a data classification (`data_classification` or `data.sensitivity`); the validator warns otherwise.
- An open threat (identified, investigating, open) with no current or planned control and no suggested mitigation is flagged; controls are written as engineering actions.

### 2.21 Vendor icons
- The skill ships the official Microsoft Azure (with Microsoft Entra), AWS and Google Cloud architecture icons as one index file per provider in `assets/icons/`, imported from the vendors' packages by `scripts/icons.mjs` without dependencies and without changing colour, shape or proportion; ids and CSS classes are prefixed so icons can share a page. The vendors' terms are reproduced in `THIRD-PARTY-NOTICES.md` (root and skill folder) and the LICENSE says the icons are not licensed by DigitalPrez.
- `icon` accepts, besides the built-in names, `<provider>/<id>` (`azure/key-vaults`, `aws/lambda`, `gcp/cloud-sql`), with aliases (`aws/s3`, `azure/key-vault`); appliances can carry an icon too. Every cloud card declares its icon; a cloud node with a card and no icon gets the card's icon unless `settings.icons.vendor` is false. The validator warns about an icon the library lacks and about a provider mismatch.
- AWS: service and resource icons, group and category icons. Google: the 2025 product and category icons plus the legacy per-product icons, product first. `tests/check_icons.mjs` checks the library, the cards and the examples' pages.
- Product logos on demand: `icon: "dashboard/<name>"` names a logo from the Dashboard Icons collection; `node scripts/icons.mjs fetch` downloads it (jsDelivr, then GitHub), refuses scripts, event handlers, foreign objects and external references, normalizes it and stores it in `icons.json` beside the model, which `build.mjs`, `validate.mjs` and `icons.mjs check` read; `search --provider dashboard` queries the collection's catalogue. The skill ships no logo; the notices file states the collection's licence and its trademark disclaimer; `tests/check_icons.mjs` exercises the fetch offline from a folder.

### 2.22 Dependencies
- Any node, component or appliance lists what it needs to work in `depends_on[]`: `kind` (identity, directory, dns, pki, kms, secrets, logging, monitoring, time, package-registry, update-service, backup, licensing, messaging, storage, database, api, network, other), `ref` to the provider on the diagram or `label` for one off it, `criticality` (required, degraded, optional), `note`. A flow of kind `dependency` (thin, dashed, its own layer) or the real auth or data flow connects the two; the validator errors on a provider that does not exist or an element depending on itself, and warns on a dependency with no flow or a dependency flow nobody declares. The cloud cards' "Depends on" lines become proposals.

### 2.23 Requirements and evidence
- `requirements[]` (top level or per tab; `REQ-nnnn`, permanent numbers, unique across the document like threats): `title`, `statement`, `kind`, `priority`, `status` (proposed, approved, implemented, verified, waived, retired; the last two need a reason), `source` and `source_ref`, the `threats[]` answered, the `controls[]` that satisfy it, `attack_paths[]`, `frameworks[]` clauses, `owner`, `due_date`. `implemented` and `verified` need an implemented or verified control behind them.
- Controls gain `evidence[]` (kind, reference, date, by, note), ATT&CK mitigation ids, D3FEND technique ids, ISO 27001 Annex A ids and `frameworks[]` clauses; the validator warns on a verified control without evidence.

### 2.24 Policy and strict validation
- `settings.policy` states what `validate --strict` fails on: open threats at or above a band without a planned control on track, open threats without a treatment decision, overdue controls, verified controls without evidence (opt in), approved requirements without controls, suggested elements, flows without classification (opt in), accepted risks past their review date. Defaults apply to rules left unset; every failure is reported as `error: policy: …` with exit 1. The policy is part of the model so that CI runs one command and no configuration.

### 2.25 Custom metadata
- Every element, threat, control, requirement, attack path, tab and the meta block accept a `custom` object (up to 40 keys) for organisation metadata with no field of its own; the schema validates the key names, the validator leaves the values alone, the Attributes card lists them under Custom.

### 2.26 Threat rules
- `scripts/suggest.mjs` runs the rules of `scripts/rules.mjs` (23 at 0.9.0: STRIDE per interaction over flows and elements) and lists candidate threats with targets, STRIDE, the weakness and its CWE, ATT&CK tactics and techniques, an adversary, default likelihood and impact, a boundary where one is crossed and a mitigation written as an engineering action. A candidate already covered (a threat with `suggested_from: "rule:<id>"` on the same target, or any threat on the same target with the same weakness or an overlapping STRIDE category) is reported as skipped. `--apply` appends the rest with the next free THR numbers as `suggested: true`, `provenance.discovered_by: "rule"`, status identified, treatment undecided; what-if scenario tabs are skipped. Rules are code, not a rules language, so each is testable; `tests/fixtures/rules.model.json` triggers every one.

### 2.27 Reports and portfolio
- `scripts/report.mjs` writes Markdown from the model for three readers: executive (risk at a glance by band for inherent, current and projected; open threats in order; attack paths; accepted risks with review dates; requirements and controls by status; the policy result), developer (planned and in-progress controls by owner with due date, ticket, the threats they close and the requirements they satisfy; suggested mitigations not converted; open threats with no plan; validator warnings) and audit (verified controls with verification and evidence; implemented-but-unverified controls; requirements and controls by framework clause; accepted risks; every threat with status and controls; policy). `scripts/portfolio.mjs` finds every model under a folder and tabulates threats by band, open threats at high or above, attack paths, planned and overdue controls, requirements verified, policy and validator results, with totals.

### 2.28 Frameworks and coverage
- Controls and requirements cite framework clauses directly (`frameworks[]`, `iso_27001`, `nist_800_53`). `assets/frameworks/crosswalk.json` is DigitalPrez's working crosswalk from NIST SP 800-53 Rev. 5 control ids to ISO/IEC 27001:2022, PCI DSS 4.0, SOC 2 (2017), HIPAA Security Rule and NIST CSF 2.0 clauses, with short clause titles for navigation; it carries no CIS Controls mapping (licence) and a `frameworks.json` beside a model extends or overrides it. `scripts/coverage.mjs` lists, per framework, the clauses the model touches, the controls (direct or "via crosswalk") and requirements behind each, and the best control status; `--gaps` lists the clauses the crosswalk knows that nothing touches. A control that touches a clause contributes to it; satisfaction is the assessor's call, and every output says so.
- OT: a zone carries `security_level` (IEC 62443 SL-T 1 to 4); the validator warns when a flow enters a higher level through a zone with no appliance. Kubernetes: zone kinds `cluster` and `namespace`. AI: component types `llm`, `vector-store`, `ai-agent`, `tool-server`; `attack.atlas[]` for MITRE ATLAS ids.

## 3. Renderer

### 3.1 Output
- One HTML file, no external dependencies (no CDN fonts or libraries). Logo embedded. Works offline and in air-gapped environments.
- Model JSON embedded in the file; layout computed at load.
- Renderer template kept separate from data (one `template.html` + a build step). Versioned independently of the model.

### 3.2 Layout
- Computed, never hand-placed. The model carries **hints by name only**: `order` within a zone, column/row preference, "keep X next to Y". No pixels in the model.
- Zones and nodes evenly spaced. No overlapping boxes, text or icons.
- Boundary appliances sit on the zone edge.

### 3.3 Routing
- Orthogonal (right-angle) paths only. No curves.
- Lines never overlap. Where several leave or arrive at the same side they **fan out / step-ladder** into separate lanes.
- Paths crossing a zone boundary route through that boundary's appliance.

### 3.4 Interaction
- Collapsible info band. Expanded: title, controls, phase chips, summary (objective/flow/path/access folded into one or two lines) and the current step. Collapsed: a compact strip showing the current step's description, source → destination with direction, auth type and strength.
- Reset / Back / Next, phase chips, keyboard shortcuts, zoom/pan, reduced-motion support (all as in the sample).
- **Attributes card**: clicking a zone, node, component, appliance, flow or threat circle opens a floating card that can be dragged anywhere over the page, closed and resized; it scrolls when long, lists the element's attributes alphabetically and has a filter box. A threat click also highlights every target.
- **Threat Register** button next to Layers, left of the severity chips: a sortable table with vulnerability, STRIDE, targets, inherent / current / projected bands, status and controls.
- **Severity filter** to show/hide threat markers by band.
- **Layers card** (2.7): floating, draggable anywhere, minimizable; the Layers button opens and closes it.
- Threat circles sit on the service's own box (a component's on its host), starting at the top-right corner and stacking right to left. Arrowheads are small relative to the boxes. No browser focus rectangle on selection.
- Zone titles and sub-labels keep at least 10px clearance from everything inside the zone.

### 3.5 Severity palette
- Bands from green through amber/orange to red; the highest band is **black with a bold red number**.
- Colour-blind safe: each band also differs by ring pattern or thickness and is distinguishable in grayscale/print.

### 3.6 Sizing
- Minimum width and height for the diagram canvas (defaults 1280 × 640, set per model); below that the page scrolls rather than squashing the diagram.
- Above the minimum the page fills the full browser width and height with a **10px padding around the whole page**; the canvas takes all remaining space (no max-width cap).
- The header band (title, controls, summary, current step) and the footer areas (detail line, register, legend, signature block) adapt to the width and take only the height they need, so the canvas gets the rest.

### 3.7 Tabs, register, markers, signature block
- Tab strip at the bottom of the canvas area, left to right in model order, hidden for a single diagram; the active tab is kept in the URL hash (`#tab=<name>`); PageUp / PageDown switch tabs. Switching re-renders the canvas, band, legend, severity counts and the Layers card body; layer and severity toggles persist across tabs.
- Threat Register: one table for every tab (a Tab column when there is more than one), a search box (id, number, title, STRIDE, vulnerability, target, control, tab), sortable columns, a minimize button that collapses it to its title strip, and close. Clicking a row from another tab switches to that tab and highlights the threat.
- Threat circles on a tall zone (height > 1.2 × width) stack upward from the lower-left corner instead of leftward from the top-right, clear of a left or bottom bar.
- Signature block as a title block: brand rule, logo and organization, subtitle / title / description, labelled cells (Document No., Revision, Date, Prepared By, Reviewed By, Approved By, Status), classification badge and renderer version. New meta fields: `document_id`, `status`, `reviewed_by`, `approved_by`.

### 3.8 Layout refinements
- Internet-side nodes ordered and placed level with the private-side rows they talk to (barycentre of partners), unless the model orders them.
- Ports snap to the partner's centre line: adjacent boxes get a straight line; remaining ports spread 20 px apart from the middle of the side.
- Components are entered from the host's side at the row's height, never through the host's title.
- Zone and host title rows are routing obstacles; pass-through ports avoid a bar's label.
- Zone corners are square on a side with a boundary bar and along the top of a tall zone; vertical bars have square top corners; bars are 40 px thick and span the zone.
- Control badges continue the threat-circle stack on the same corner (lower-left stacking up on tall zones; upward on vertical bars).
- Attributes card: right-edge drag to widen, wider key column, 12 px text; signature block cells top-aligned; the page grows with its content so the signature block is never clipped.
- Selection is a soft shadow in the element's own colour (superseded the short-lived pulse the same day).
- A bar with pass-through lines shortens its label so the lines keep off the text (full text in the tooltip and the Attributes card).
- Flow attributes read Source / Destination, shown as "source ⇒ destination" with the relevant end in bold.
- Example metadata carries no "(fictional)" marker; the skill never adds one.

### 3.9 Register tab, selection, routing rules
- The Threat Register is the last tab of every document (full-size table across all diagrams, search, sort, severity-chip filter, row → diagram + threat). The collapsible panel under the canvas is gone.
- Selection: a soft shadow in the element's own colour (no pulse, no red).
- Hover bubble: one styled tooltip for the page (heading + detail, arrow, flips near the bottom edge) replaces every native title tooltip: nodes, components, zone titles, bars, flows, auth badges, threat circles, control shields, severity dots, buttons and tabs.
- The Threat Register tab follows the last diagram tab (not pinned to the far right).
- A mitigated threat's circle carries a small green shield-with-check at its top-right (hover: status as a bold colour-coded pill, Open on amber / Mitigated on green; controls in place listed); open threats never do. The standalone shield (smaller, 9.5 px radius) sits at the bottom-left corner of horizontal elements and the top-left of vertical ones, and remains only for controls not shown on a mitigated threat's circle there. The Attributes row is "Controls" (was "Controls here").
- Bars never deflect a line: the pass-through port takes the arriving line's coordinate and the bar label moves to the longest free stretch. Component-side ports sit on the host edge so arrowheads stay visible.
- Glyph clearance: the auth badge, the blocked ✕, threat circles and control shields of a flow all sit on its line, each at its own spot (middle, else start, else end) where no other line passes (≥ 16–20 px) and never on a bend; bar stacks sit at the lower-left of a vertical bar and the top-right of a horizontal bar, and pass-through lines keep off those stretches. Arrowheads are a fixed 9 px with the tip on the box edge. A pair whose straight corridor is blocked by another box connects with a U on a free side.
- Routing rules: centre-line locking for near-level pairs (midpoint port, 0 bends), zero-deflection transit through bars (the bar takes the arriving line's coordinate), no micro-jogs, swimlane bias in the Internet column (identity up, bad actors down), badges and markers on the longest straight span offset off the line, 30 px gutters along zone edges.
- The canvas is positioned absolutely inside its frame, so a tab's aspect ratio never changes the page height; a collapsed band stays collapsed across tabs.

### 3.10 Centre-line locking and bus channels
- Step-path partners in different zones share one centre line: the higher one's row is lifted at the highest nesting level that moves only that chain; data flows first, one lift per pass, reverted when it breaks an earlier alignment, capped at 260 px. Plain nodes centre on the component they talk to within a row.
- Z-shaped lines run their middle segment in the free gap between rows / columns of boxes (bus channels).
- The Internet column never pulls nodes off their partners' rows; the canvas grows instead. Identity / bad-actor band bias is a tie-breaker.
- Bars keep 12 px clear of neighbours and never run past their zone's far edge; zones are wide enough for title + bar. Seam labels are routing obstacles.

### 3.11 Routing engine
- Lines are routed by an orthogonal visibility-graph search (after Wybrow, Marriott and Stuckey, GD 2009): obstacles are every box, bar, title row, glyph corner and seam label with a buffer (12 / 8 / 4 px); cost = length + 70 per bend + 45 per crossing or same-lane overlap + 60 % inside a foreign zone + 30 % along a node's flank; the story's flows first; deterministic tie-breaks.
- A boundary bar is crossed where the router decides: any free lane of its band (off its glyph stacks, ≥ 8 px from another line), chosen with a look-ahead along the route so the line is level with the port behind the bar and bends in the gutter before it. The entry face follows where the line really comes from.
- Endpoint ports are lanes assigned in route priority (20 px apart, 10 px on short sides); a port aims at its real partner through bars; a straight-topology route gets both ends on one coordinate; an endpoint next to a perpendicular bar aims at the bar's band.
- Alley centring and lane spreading move a segment only when it and its connectors stay a full buffer from every box.
- Precedence (hard H1–H4, soft S1–S6) is written down in `docs/research/layout-routing.md` §5 and summarised in `references/layout-hints.md` rule 10.
- Diagnostics: `window.__nb.nearMisses`, `routes[].fallback`, `router` (grid).

### 3.12 Automated layout checks
- The page checks its own geometry: `window.__nbTabs.check()` returns a report for every diagram tab (collisions, near misses, unrouted legs, lines over text, text overlaps, glyph clashes, jogs, shared lanes, crossings, bends per flow); `?nbcheck=1` appends it to the page as a JSON script element.
- `scripts/check.mjs` (in the skill) opens a built page headless in any Chromium-based browser found on the machine (Playwright's, Chrome, Chromium, Brave; `--browser` / `NB_BROWSER`), reads that report and fails on the hard checks; `--max-crossings` / `--max-bends` add limits. No npm dependency.
- `tests/check_layout.mjs` (repository) builds the examples, runs the check on each and fails when crossings or the longest flow's bends grow past `tests/layout-baseline.json` (`--update` rewrites it).
- Still manual: the page fits the user's screen; the diagram reads well.

### 3.13 Attack paths and what-if tabs on the page
- Each attack path is a red phase appended to the walkthrough; its steps are the hops: the hop's flow is highlighted and animated, numbered red hop markers sit on every hop of the active path (on the flow, else at the landing box), the current hop is ringed, the band shows the gain, note, bypassed controls and the hop's threat, the last hop ends with the impact. Clicking a marker jumps to that hop.
- The Threat Register gains an Attack Paths table (chain as numbered threat + gain lines, entry, impact, current risk, status, breaks-at controls); a row opens the path on its diagram and starts the walk. The register label counts paths.
- A threat's hover bubble and Attributes card name the paths it belongs to; a path has its own Attributes card with linked hops, risk rows and breaking controls.
- A scenario tab carries a What-If tag in the tab strip and a banner in the band with the change statement and a link to its baseline.
- Layout and routing refinements that came with it: a bar's corridor widens with the number of flows through it (10 px per flow beyond three); glyph reserves match the drawn circle (±18 px, 6 px buffer); lanes that endpoint ports hold or aim at on a bar count as taken for other routes (endpoints aiming at one bar take lanes 20 px apart, in route order); a stretch shared with another line in the same lane costs three times its length; a bend costs slightly more the further along the route it comes, so a lane change happens at the stub; same-host component flows are 40 px brackets on the side with fewer partners; an overloaded box side spreads its ports evenly.

### 3.14 Deep links and pictures
- The URL hash opens a page at a point: `#tab=<name>` a tab, `&step=<n | step name>` the walkthrough at that step (n counts the story's steps, then the attack-path hops; a hop is named `AP-nnnn-hop-<n>`), `&path=AP-nnnn[&hop=n]` an attack path at a hop. Once the page has settled on a tab the hash is rewritten to the tab alone.
- `scripts/screenshot.mjs` renders one such view to a PNG with the same headless browser as the check: by default the whole page, band to signature block, at the diagram's natural size (the self-check report carries the document's natural size as `page`, measured once the walkthrough has settled), or a fixed height; `--scale` for high-resolution pictures. `tests/readme_screenshots.mjs` regenerates the README's pictures from the examples.

### 3.15 Vendor icons on the page
- `build.mjs` injects one `<symbol>` per distinct vendor icon the model uses into the page's `<defs>`, plus the ref-to-symbol map and the cards' icons; the page stays self-contained and grows by a few kilobytes per icon.
- The renderer draws a vendor icon with `<use>` in the same 24 × 22 slot as a line icon (22 × 22, centred, never stretched), on nodes, host title rows, component rows, appliance bars and zone titles; an out-of-scope element dims it. A vendor icon the page does not carry falls back to the built-in icon and is listed in the self-check report (`missingIcons`, informational). A comment at the top of the page's source names the icon sets the page carries, so the notice travels with the file without showing on the page; the Attributes card shows the icon id. A fetched logo is embedded from `icons.json` beside the model like any vendor icon, and the comment names the collection.

### 3.16 Dependencies, requirements and custom fields on the page
- A `dependency` flow is drawn thin and dashed in grey-blue, routed with the control flows, on the built-in layer `flows-dependency` ("Dependencies"), with its auth badge and a legend entry; it carries hop markers and threat circles like any flow.
- The Attributes card of a node, component or appliance lists Depends on (each entry with a link to its provider, its criticality and note) and Depended on by; `custom` fields appear under Custom on every element and threat. A threat's card lists the requirements that answer it.
- The Threat Register gains a Requirements table under the attack paths (kind, status, the threats answered, the controls that satisfy it, framework clauses); a row opens the requirement's record in the Attributes card; the band counts requirements with the threats and paths; a what-if tab repeats its baseline's requirements like its threats.

### 3.17 Framework coverage on the page
- The Threat Register gains a Framework Coverage table under the requirements: every clause a control or requirement cites directly, with what cites it and the best control status (verified, implemented, planned, none). Crosswalk-derived coverage stays in the script, so the page shows only what the model states.
- Every register section has an eye button in the register's head, blue while the section shows and grey while it is hidden; Threats and Attack Paths start shown, Requirements and Framework Coverage hidden; the browser's storage remembers the choice per document, and `&sections=` in the URL hash (`all`, `none` or a comma list of `threats`, `paths`, `requirements`, `coverage`) sets it for a link.

## 4. Skill (interview)

- Steers a structured interview in roughly this order: network and zones → boundaries and appliances → nodes and services → users, devices and actors → flows and auth → story steps → threats and controls → layers → signature details.
- Asks follow-ups wherever the model has gaps. Keeps the mandatory set small; everything else is optional and skippable.
- Enforces unique names, that every flow and threat reference points at a real element, every step references a defined flow, every referenced layer exists.
- Saves the draft model after each section so progress is never lost; renders previews often.
- Supports later edits by unique name.
- Prompts the risk-scoring method with a short comparison (2.6).
- Runs validate → build after each change.

### 4.1 Cloud service guidance (AWS, Azure, GCP)

Many users know they are deploying "an App Service" or "an S3 bucket" without knowing what that exposes. When a node or component is a cloud service, the skill guides them:

- **Service catalogue.** `references/cloud/aws.md`, `azure.md`, `gcp.md` hold a card per common service: what it is; how it attaches to the network (VPC/VNet and subnet, public endpoint, private endpoint / PrivateLink / Private Service Connect); default exposure; typical ports and protocols; insecure defaults and legacy protocols to disable (FTP/FTPS on App Service, public bucket/blob access, SSH/RDP open to 0.0.0.0/0, TLS 1.0/1.1, basic auth on deployment endpoints, IMDSv1); typical dependencies (identity, DNS, KMS/Key Vault, logging); common threats with CWE / ATT&CK references and the control that addresses each.
- **Exposure questions.** The card tells the skill what to ask: internet-routed or RFC 1918 / private only; public or private endpoint; which legacy protocols are disabled; which identity governs access; where logs go; whether encryption at rest/in transit is on.
- **Proposals from the answers.** The skill proposes zones and nodes (a VPC/VNet zone with subnets, a public load balancer or gateway on the Internet side, a private endpoint, a NAT gateway) and pre-fills threats and controls from the card. Everything proposed is marked `suggested: true` until the user confirms it.
- **Live research fallback.** If a service is not in the catalogue and the AI tool has web access, the skill researches it and records the sources in the model's provenance; otherwise it falls back to `references/cloud/generic.md`. The output HTML stays dependency-free either way.
- **v1 breadth:** the 10–12 most common services per provider. Others through live research.

### 4.2 Input modes
- **Mode A, baseline:** the interview, or sources the user hands over (Terraform, Bicep, ARM, CloudFormation, Kubernetes manifests, OpenAPI, design documents) read per `references/ingest.md` into `suggested` elements, then the interview for what files cannot say.
- **Mode B, what-if:** a change statement against an existing model becomes a scenario tab (`references/what-if.md`): copy the baseline, apply the change, re-run threats and attack paths on what changed, print the delta, promote or drop.
- The persona traces assets across boundaries and chains threats (SKILL.md, persona point 4); Section 7b of the interview asks for attack paths after the threats.

### 4.3 Component cards
- `references/components.md` holds cards for the common self-managed components (web server, reverse proxy, application server, API gateway, relational database, cache, message broker, file share, identity provider, directory, VPN gateway, jump host, mail, DNS, CI/CD runner, secrets vault, backup, workstation, SIEM, firewall, WAF) in the cloud-card format: icon, what, attaches to, default exposure, disable unless needed, depends on (as `depends_on` proposals), ask, propose, threats with STRIDE, category, CWE, ATT&CK and a control. The skill routes to them as it routes to cloud cards; everything proposed stays `suggested` until confirmed.

### 4.4 Kubernetes, AI and OT cards
- `references/kubernetes.md` (control plane, node pool, namespace, ingress, service mesh, registry, secrets, workload identity), `references/ai.md` (model endpoint, agent with tools, tool server, vector store, RAG pipeline, training data; OWASP LLM Top 10 and MITRE ATLAS references) and `references/ot.md` (controller, HMI and SCADA, historian, engineering workstation, OT DMZ and jump host, safety system, vendor remote access, protocol gateway; IEC 62443 zones, conduits and security levels, ATT&CK for ICS) in the card format of 4.1 and 4.3.

## 5. Revisions and archive

- Before any update, the current model JSON and rendered HTML are copied into `archive/` next to the model.
- Revision names carry version and timestamp: `<name>-v1.0.16_2026-10-23T1430.html`.
- Each revision records what changed, by unique name.
- The skill bumps the version and updates the signature block's date and version on every change. No edit without archiving first.

## 6. Platforms

The skill must install into Claude Code, OpenAI Codex / ChatGPT, GitHub Copilot (VS Code, CLI, cloud agent, Visual Studio), Kiro, Cursor, Gemini CLI and Windsurf/Devin. See [PLATFORMS.md](PLATFORMS.md).

Releases: every version is also published as `netblueprint-forge-<version>.zip` on the GitHub Releases page, one top-level folder with `SKILL.md` inside, the shape claude.ai and the Claude API accept as a skill upload and the offline install for every other tool. The release number is `metadata.version` in `SKILL.md`; `CHANGELOG.md` holds the notes per version; `platforms/package.mjs` builds the archive without dependencies and `.github/workflows/release.yml` publishes it when a merge to `master` raises the version; the same archive is published at https://bifrost.digitalprez.com/download/netblueprint-forge/releases/ beside the live example pages. The archive is reproducible: every entry carries the date of the version's `CHANGELOG.md` heading rather than a file time, so the same version gives the same bytes and hash on any machine, and `tests/check_package.mjs` checks it.

Feedback: the repository takes bug reports and feature requests through issue forms (blank issues off) and declines code. A pull request from outside the organization is closed on arrival by `.github/workflows/pull-requests.yml`, `CONTRIBUTING.md` says why, `SECURITY.md` asks for vulnerabilities in private, and no contributor agreement exists (D40).

## 7. Scope

### Version 1 (in)
1. Renderer separated from data, with a build step.
2. A public reference architecture (Azure hub-spoke) as the first JSON model (proof, regression fixture, worked example).
3. Validate/lint script run after each interview section.
4. Layout hints by name instead of coordinates.
5. Controls/mitigations as first-class objects with residual risk.
6. Permanent threat numbers; `retired` instead of delete.
7. Dependency-free, offline output.
8. Assumptions, out-of-scope and data classification in the model and the band.
9. Colour-blind-safe severity palette.
10. Cloud service guidance for AWS, Azure and GCP (4.1) with a catalogue of the most common services.
11. Everything in sections 2–5.

### Later
- Print and presentation modes.
- Auto-generated change log by diffing model revisions.
- Dark theme.
- Export to standalone SVG/PNG.
- Import from Visio, Nmap, cloud inventory.

## 8. Open questions

- Severity band names. Research recommends the NIST five: Very Low (light green), Low (yellow), Moderate (orange), High (red), Very High (black, bold red number), because both risk methods and CVSS map onto them 1:1 (see [research/threat-attributes.md §4.4](research/threat-attributes.md)). Display labels configurable per model. **Settled:** the five bands are what the renderer, the register and the validator use.
- Whether Codex plugin packaging (beyond `agents/openai.yaml`) is needed for ChatGPT web/mobile.
- Minimum diagram size in pixels. **Settled:** 1280 × 640 are the defaults of `settings.layout.min_width` and `min_height`; below them the page scrolls.

## Appendix A: Draft threat object

> Superseded by the schema at `skills/netblueprint-forge/assets/schema/netblueprint.schema.json`. Differences: enum values are kebab-case ids (`information-disclosure`, `very-high`); controls are top-level objects referenced by id ([D11](DECISIONS.md)); `risk.method` is `likelihood-impact` or `owasp-rr`; `boundary_crossed` is an object; `classification.kill_chain_phase` became `classification.attack_tactics` (ATT&CK ids). Kept for the narrative.

```json
{
  "id": "THR-0042",
  "number": 42,
  "title": "Unauthenticated BOLA on Customer Profile API",
  "description": "Attacker enumerates profile IDs and reads other customers' records.",
  "status": "Mitigated",
  "retired": false,
  "classification": {
    "stride": ["Tampering", "Information Disclosure"],
    "linddun": ["Disclosure of information"],
    "kill_chain_phase": "Exploitation"
  },
  "targets": [
    { "kind": "component", "ref": "svc-profile-api" },
    { "kind": "flow", "ref": "flow-ingress-to-profile" },
    { "kind": "zone", "ref": "DMZ", "marker": false }
  ],
  "boundary_crossed": "Internet-to-DMZ",
  "assets_at_risk": ["Customer PII"],
  "data_classification": "PII",
  "adversary": {
    "type": "External Attacker",
    "motivation": "Financial",
    "capability": "Medium",
    "required_privileges": "None",
    "access_vector": "Network",
    "authentication_required": false
  },
  "attack": {
    "scenario": "Attacker calls GET /profile/{id} with sequential IDs...",
    "prerequisites": ["API reachable from Internet", "Predictable object IDs"],
    "mitre_attack": ["T1190"],
    "capec": ["CAPEC-1"]
  },
  "risk": {
    "method": "likelihood_impact",
    "likelihood": "High",
    "impact": "High",
    "score": 16,
    "rating": "High",
    "rating_override": null,
    "owasp_rr": null,
    "cvss": { "version": "3.1", "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", "base_score": 7.5 },
    "residual": { "likelihood": "Low", "impact": "High", "rating": "Medium" }
  },
  "standards": {
    "cwe": ["CWE-639"],
    "owasp": ["API1:2023"],
    "nist_800_53": ["AC-3", "AC-6"],
    "compliance": ["PCI-DSS 7.1", "GDPR Art. 32"]
  },
  "treatment": {
    "decision": "Mitigate",
    "acceptance": null,
    "controls": [
      {
        "id": "CTL-0007",
        "name": "Object-level ownership check in auth middleware",
        "type": "Preventive",
        "status": "Implemented",
        "effectiveness": "High",
        "owner": "Identity Team",
        "due_date": null,
        "ticket": "SEC-1234",
        "verified_by": "Pen test 2026-09"
      }
    ]
  },
  "provenance": {
    "discovered_by": "Threat modelling workshop",
    "created": "2026-10-23",
    "updated": "2026-10-23",
    "references": ["https://owasp.org/API-Security/"]
  },
  "layers": ["Threats", "API Security"]
}
```
