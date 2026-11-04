# Threats and controls

A threat is its own object with a permanent number (the digit in its circle). One threat can apply to many places. Controls are shared objects; a threat lists which of them are in place now (as-is) and which are planned (future state).

## Normalize what the user types

For every enumerated field, the user may answer in their own words. Run `node scripts/normalize.mjs <field> "<text>"` (fields: `stride`, `band`, `vulnerability`, `adversary`, `threat_status`, `treatment`, `control_type`, `control_status`, `classification`, `data_tag`, `security_protocol`, `client_auth`, `server_auth`, `credential_storage`, `factors`, `platform_category`, `hosting`, `elevated_access_model`, `hardening_baseline`, `sourcing`, `connection_type`, `initiator`, `scope`, `dependency_kind`, `criticality`, `requirement_kind`, `requirement_status`, `requirement_source`, `evidence_kind`). Use the value when `ask` is false; otherwise show the top candidates and confirm. `--describe <field>` prints the options with one-line descriptions to read to the user. Never store free text in an enumerated field; put nuance in the adjacent free-text field (`vulnerability.description`, `risk.rationale`, `notes`).

## The questions, in order

Items marked **must** are required by the schema; everything else can be skipped.

1. **The threat, in one sentence** (`title` **must**, `description`). If the user hesitates, assemble it:
   > **A** [adversary] **could** [action] **on** [target] **by exploiting** [weakness]**, causing** [consequence].
   Action verbs by STRIDE: Spoofing impersonate / replay / forge · Tampering modify / inject / corrupt · Repudiation deny / erase evidence of · Information disclosure read / exfiltrate / infer · Denial of service exhaust / crash / flood · Elevation of privilege escalate / bypass authorization / execute as.
2. **STRIDE, one or more** (`classification.stride` **must**). Describe them when the user does not know:
   - Spoofing: pretending to be another user, device or service.
   - Tampering: changing data or code without authorization.
   - Repudiation: denying an action because it cannot be proven (no log, no attribution).
   - Information disclosure: data reaching someone who should not see it.
   - Denial of service: making something unavailable or degraded.
   - Elevation of privilege: doing more than allowed.
3. **What weakness is exploited** (`vulnerability.category`, `cwe`, `description`). Offer the list: unauthorized access · broken authentication · credential exposure · injection · improper input validation · security misconfiguration · missing or weak encryption · sensitive data exposure · insufficient logging and monitoring · insecure design · vulnerable or outdated components · supply chain · SSRF · privilege escalation · excessive trust / flat network · resource exhaustion · availability failure · improper error handling · malware execution · phishing / social engineering · insider misuse · physical access · data exfiltration · third-party dependency · race condition · memory safety · other. Each has a default STRIDE suggestion (`normalize.mjs --describe vulnerability`).
4. **Where it applies** (`targets[]` **must**): zone, node, component (`node/component`), flow, appliance or boundary (`<from>-to-<to>`). Each target gets a circle unless `marker: false`; a component's circle sits on its host's top-right corner.
5. **Who** (`adversary.type` **must**): external types (activist, competitor, crime-syndicate, criminal, hacker, nation-state, sensationalist, spy, terrorist), insiders (insider-accidental, insider-disgruntled, malicious-user), compromised-credential-holder, third-party, automated-bot, non-adversarial, unknown. Point `adversary.actor_node` at the diagram's bad-actor or user node.
6. **Consequence** (`risk.consequence`): one plain sentence on what happens if it is realised.
7. **Controls as they are today** (`treatment.current_controls[]`): what is already in place that bears on this threat. Reuse existing control ids; create new ones with status `implemented` or `verified`.
8. **Risk, with those controls considered** (`risk.residual`, method per `risk-scoring.md`). This is the rating people mean when they say "how bad is it": prompt likelihood and impact as words (Low, Medium, High …) and normalize them. The circle and the register's **Current** column show this value.
9. **Inherent risk** (`risk`, **must** have a method and inputs): the rating as if the current controls were absent. Ask it right after the current rating ("and without those controls?"); if the user does not want to assess it, use the current values and say so in `risk.rationale`.
10. **Treatment and future state** (`treatment.decision`; `treatment.planned_controls[]`; `risk.projected`): mitigate / accept / avoid / transfer. For planned controls (status proposed, planned, in-progress) ask for owner and due date, then the projected rating once they are in place. Accepting a risk needs `treatment.acceptance` (approver, date, rationale, review date).
11. **Suggested mitigations** (`treatment.suggested_mitigations[]`): ideas that are not controls yet, with source and status (suggested / accepted / rejected / converted → `control_id`).
12. **Status** (`status`, default `identified`): identified → investigating → open → mitigated / accepted / transferred / avoided; `not-applicable` and `retired` need a `status_reason`. `mitigated` requires at least one current control.

Optional: `classification.linddun[]`, `classification.attack_tactics[]` (ATT&CK v20 tactic ids; TA0005 is Stealth, TA0112 Defense Impairment), `attack.scenario` / `prerequisites` / `mitre_attack[]` / `capec[]` / `atlas[]` (MITRE ATLAS ids for AI systems), `boundary_crossed`, `assets_at_risk[]`, `data_classification` / `data_tags`, `adversary` detail (motivation, capability, intent, targeting, resources, position, required_privileges, access_vector, authentication_required), `standards` (cwe, owasp A01:2025 / API1:2023 / LLM01:2025, nist_800_53, cis_controls, iso_27001, compliance), `risk.cvss`, `provenance`, `layers`.

`validate.mjs --fix` computes every `rating` and `score`, keeps `treatment.controls` equal to current + planned, and refuses a current control that is not implemented/verified or a planned one that already is.

## Controls

Ask: name; type (preventive, detective, corrective, deterrent, recovery, compensating, directive); status (proposed, planned, in-progress, implemented, verified, not-implemented, retired); owner; due date and ticket for anything not yet implemented; how it was verified (`verification`: design-review, code-review, test, penetration-test, scanner, audit, continuous-monitoring, not-yet-verified; `verified` needs one) and when; effectiveness (very-low … very-high); where it lives on the diagram (`implemented_on[]`, same shape as targets; draws a green shield badge); references: NIST 800-53 (`nist_800_53`), CIS Controls (`cis_controls`), ISO 27001 Annex A (`iso_27001`), ATT&CK mitigations (`mitre_mitigations`: M1032 Multi-factor Authentication, M1030 Network Segmentation …), D3FEND techniques (`d3fend`: D3-MFA, D3-NTF, D3-UAP …) and clauses of other frameworks (`frameworks[]`: `{ framework: "pci-dss-4.0", clause: "8.4.2" }`). One control usually treats several threats; reuse ids.

**Evidence.** A `verified` control says how it was verified; `evidence[]` says what showed it: `kind` (test-report, scan-result, penetration-test, audit-finding, configuration-export, screenshot, log-sample, ticket, attestation, design-document, other), `reference` (a URL, document id, ticket or file name), `date`, `by`, `note`. Ask for one record per artefact; the validator warns on a verified control without any, and `validate --strict` can fail on it.

## Requirements and evidence

A requirement says what must be true; a threat says what could go wrong, a control says what was built, and the control's evidence says it was checked. Requirements are `requirements[]` on the diagram (tab): `id` `REQ-0001`…, `number` (permanent), Title Case `title`, `statement` (one testable sentence: "Administrative sessions to the jump host authenticate with phishing-resistant MFA"), `kind` (security, privacy, resilience, compliance, operational, safety), `priority` (must, should, could), `status` (proposed → approved → implemented → verified; `waived` and `retired` need a `status_reason`), `source` and `source_ref` (threat-model, policy, standard, regulation, contract, customer, architecture, incident), `threats[]` it answers, `controls[]` that satisfy it, `attack_paths[]` it cuts, `frameworks[]` clauses it serves, `owner`, `due_date`.

Ask, after the threats: "What must be true for this threat not to matter?" One requirement often answers several threats and is satisfied by several controls. `implemented` needs an implemented or verified control behind it; `verified` needs a verified one (the validator enforces the first and warns on the second). Requirements that come from a policy, a standard or a contract carry their clause in `frameworks[]`, so the register can answer "which controls satisfy PCI DSS 8.4.2 here". Ids and numbers are unique across the document; a what-if tab repeats its baseline's.

On the page the Threat Register lists every requirement under the attack paths (kind, status, the threats it answers, the controls that satisfy it, the framework clauses); a row opens its record in the Attributes card, and a threat's card lists the requirements that answer it.

## Ids, numbers, scope

- `THR-0001`…, `number` equals the id's digits. Assign the next unused number; never reuse one. Removing a threat means `status: "retired"`, `retired: true`, `status_reason`.
- Controls are `CTL-0001`…, same rule. Requirements are `REQ-0001`…, same rule.
- Any zone, appliance, node, component or flow can be `out_of_scope: true` with a `scope_reason`. It stays on the diagram, greyed out, with all its attributes; threats may still target it.

## Where threats show up

A numbered circle at each target coloured by the **current** band (residual if present, else inherent): very-low light green, low yellow, moderate orange, high red, very-high black with a red number. Click a circle for the full record in the Attributes card and to highlight every target; the **Threat Register** (toolbar, next to Layers) lists all threats with vulnerability, STRIDE, targets, inherent / current / projected bands, status and controls, sortable; the severity chips hide bands; the **Threat markers** layer hides them all. Steps can name their threats (`steps[].threats`); those circles are emphasised while the step plays.

## Attack paths (chains)

After the threats, ask how they chain: "If THR-0004 succeeds and the attacker has a session on the jump VM, what do they hold, and where can they go next?" One answer per hop. An attack path is an entry of `attack_paths[]` on the diagram (tab): `id` `AP-0001`…, `number` (permanent, like a threat's), Title Case `title`, `description` (the chain as the adversary would tell it), `adversary`, `entry` (the bad actor's node, or the element already compromised), `hops[]`, `impact`, `assets_at_risk`, `risk` (the chain as a whole: the likelihood that every hop succeeds × the impact of the end state; `residual` with the controls in place, `projected` after the planned ones; `validate --fix` writes the bands), `breaks_at` (the controls that cut the chain; a mitigated path needs one implemented or verified), `mitre_attack`.

Each hop: `threat` (a threat of this diagram), `via` (the flow it rides) or `to` (where it lands; a local escalation has no flow), optionally `from`, `gain` (foothold, credentials, token, session, network-access, code-execution, data-access, data-exfiltration, privilege, persistence, lateral-movement, denial-of-service, impact; `normalize.mjs gain "<text>"`), `note` (one sentence: how it works and which control is missing or bypassed), `bypasses` (control ids it defeats). The next hop starts where the previous one landed. The validator warns when the chain breaks, when a hop's threat targets nothing on that hop, and when a hop's threat is mitigated but the path does not name the control that breaks it. Ids and numbers are unique across the document; a what-if tab repeats its baseline's.

Questions, in order: entry point and adversary → the first threat exploited and what it gains → from there, the next flow or system and the threat that opens it → … until the asset → impact → which existing control breaks the chain today → which planned control would → the path's risk. Typical gains per hop: a foothold, then credentials or a token, then network access or lateral movement, then data access, then exfiltration or impact.

On the diagram each path is a red phase at the end of the walkthrough: Next walks the hops, every hop carries a numbered red marker on its flow (or at the box it lands on), the chain's flows are drawn red and the hop's threat circle is emphasised; the band shows the gain and the note; the last hop ends with the impact. The register has an Attack Paths table under the threats; a threat's bubble and card name the paths it belongs to; the Attributes card of a path lists its hops with links.

## Remediation that can be built

Every open threat needs a way out: a current control, a planned control with an owner, or at least an entry in `treatment.suggested_mitigations[]`. Write controls as engineering actions a team can pick up ("Entra ID authentication for Redis; access keys disabled", "parameterized queries and a least-privilege SQL role for the API identity", "rate limit of 10 sign-ins per minute per account and source", "token binding on the refresh token", "mTLS between the gateway and the API"), not categories ("improve authentication"). The validator warns about an open threat with no remediation recorded.

## Suggested threats from cards and rules

From a cloud card, a component card (`components.md`) or a Kubernetes, AI or OT card (`kubernetes.md`, `ai.md`, `ot.md`): add them with `suggested: true`, `suggested_from: "<card id>"`, `provenance.discovered_by: "cloud-catalogue"`, and ask the user to confirm each one. Drop `suggested` once confirmed; retire what the user rejects.

From the rules: `node scripts/suggest.mjs model.json` runs 23 rules over the flows and elements (STRIDE per interaction: an unauthenticated or password-only flow from the Internet, sensitive data in the clear, a boundary crossed without an appliance, an administrative session without strong MFA or a record, a data store reachable from the Internet, sensitive data sent to a third party, a single point of failure, deprecated TLS, a certificate not validated, a credential in plaintext, an end-of-life platform, no patching, standing or shared admin access, administrators without MFA, no hardening baseline, a risky protocol a card said to disable, a required third-party dependency, weak authentication to a data store, IT traffic into OT, Internet requests without a WAF; `--rules` lists them). Each hit is a candidate with STRIDE, the weakness and its CWE, ATT&CK references, an adversary, a default rating and a mitigation written as an engineering action; a threat the model already has on the same target with the same weakness or STRIDE category is not proposed again. Read the list to the user, rule by rule; `--apply` writes the ones they keep as `suggested: true`, `suggested_from: "rule:Rnnn"`, `provenance.discovered_by: "rule"`, status identified and treatment undecided, with the next free THR numbers; then run `validate --fix`, and confirm or retire each one as with a card's. What-if scenario tabs are skipped: apply to the baseline and copy. Run it after the flows (Section 5) and again after the threats; it is deterministic, so running it twice costs nothing.
