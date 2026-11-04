# The interview: from conversation to model

You are building `model.json` section by section. The user answers in their own words; you translate into the schema (`model-reference.md`) and keep the file valid at every step.

## How to run it

- **Ask in small batches**, one section at a time, three to five questions per message. Lead with what you already know ("You said the API talks to SQL; is that over the private endpoint?").
- **Offer defaults and accept "skip".** Only the fields marked **must** below are mandatory. Everything else gets a sensible default or stays empty.
- **Names are ids.** Propose a short `name` for each element (`web-01`, `snet-data`, `f-api-sql`) and confirm it once; the user refers to it later. Labels carry the human wording. Names are unique across their kind; never rename one silently.
- **Write after every section.** Save `model.json`, run `node scripts/validate.mjs model.json --fix`, fix what it reports before moving on. From section 5 onward, build and show the diagram whenever something meaningful changed (`render.md`).
- **Cloud services trigger the card workflow.** The moment a node is "an App Service", "an S3 bucket", "Cloud SQL", open `cloud/README.md` and run that card's questions before continuing the section. A common self-managed component (IIS, Postgres, AD DS, Okta, a FortiGate, a jump host) has a card in `components.md`; Kubernetes parts, AI building blocks and OT systems have theirs in `kubernetes.md`, `ai.md` and `ot.md`; use them the same way.
- **Never invent facts.** If the user does not know how something authenticates, leave `auth` out; the diagram shows "?" and the register will prompt for it later.

## Where the files go

`netblueprint/<model-name>/model.json`, the rendered `netblueprint/<model-name>/<model-name>.html`, and `netblueprint/<model-name>/archive/`. `<model-name>` is kebab-case from the title. Ask before using another location.

Start from this skeleton:

```json
{
  "$schema": "<relative path to assets/schema/netblueprint.schema.json>",
  "netblueprint": "1",
  "meta": { "title": "", "author": "", "date": "<today>", "version": "0.1.0" },
  "settings": { "layout": { "min_width": 1280, "min_height": 640 } },
  "layers": [], "zones": [], "nodes": [], "flows": [], "phases": [], "steps": [], "controls": [], "threats": []
}
```

## Section 0: What are we modelling?

Ask: the title; who the author is (and organization); the one-sentence purpose; whether the audience is architecture, security review, or both; document classification.

Write: `meta.title` **must**, `meta.author` **must**, `meta.date` (today), `meta.organization`, `meta.objective`, `meta.description`, `meta.document_classification`, `meta.tags`. `meta.subtitle` is the eyebrow shown before the title ("Use case", "Reference architecture", "Threat model").

If the user hands you Terraform, Bicep, ARM, CloudFormation, Kubernetes manifests, an OpenAPI document or a design document instead of answers, read `ingest.md` first: it maps those sources onto zones, appliances, nodes and flows (all `suggested` until confirmed); then come back here for what the files cannot say.

## Section 0b: One diagram or several tabs?

Ask once the subject is clear: "Is this one diagram, or several views of the same system (partner access, admin access, backup and restore …) that should sit on tabs?" One diagram: the top-level collections, as below. Several: `tabs[]`, each with `name` (stable id, e.g. `admin-access`), `label` ("Admin Access"), a one-line `description`, optionally its own objective / flow_summary / path_summary / access_summary, and then every section below is asked **per tab**. Shared across tabs: title and signature block, settings, auth types, layers. Threat numbers continue across tabs (THR-0005 in the second tab when the first ended at 4); control ids too. Element names only have to be unique within a tab, but reusing a name for a different thing in another tab confuses later edits: say "in tab admin-access" whenever you refer to one.

## Section 0c: A what-if of an existing model?

"What if we changed X?" about a model that exists is a scenario, not an edit: a copy of the baseline tab with the change applied, its own threats and attack paths, and a delta report. Follow `what-if.md`.

## Section 1: Network shape and zones

Ask:
1. Is anything reachable from the public Internet, or do users come from the Internet? (If yes, there is an Internet side; otherwise the diagram shows only the private network.)
2. What is the private network called? (`settings.network_label`, e.g. "Contoso corporate network", "Azure landing zone".)
3. Which boundaries exist, from the outside in? Sites, data centres, cloud subscriptions, VPC/VNets, subnets, enclaves, DMZs, OT networks. Nesting is natural: "the spoke VNet is inside the Azure subscription".
4. Anything that is out of scope but should still be drawn for context?

Write: one `zones[]` entry per boundary with `name`, `label`, `sub` (one line: CIDR, purpose), `kind`, `parent` (omit for top level; `"internet"` for a provider cloud that sits on the Internet side), `out_of_scope`, `data_classification` when the zone as a whole is restricted. A plant network is `kind: ot` with `security_level` (IEC 62443 SL-T 1 to 4; `ot.md`); a Kubernetes cluster is `kind: cluster` with `namespace` zones inside (`kubernetes.md`). `color` only if the user asks; kinds have defaults.

Checkpoint: `zones` must have no parent loops and every `parent` must exist; the validator tells you.

## Section 2: Boundaries and their appliances

For each zone, ask: "What filters traffic into or out of it?" Firewall, NGFW, WAF, API gateway, proxy, load balancer, NAT, bastion, VPN/ExpressRoute gateway, IDS/IPS, NSG/security group, SD-WAN.

For each appliance: its label and one-line `sub`; which edge it sits on (`edge`: left faces the Internet side by default, right faces an on-premises site, top faces a parent/hub above); whether it filters `inbound`, `outbound` or `both`; and **whose traffic** it carries (`serves`: a VPN gateway serves `["onprem"]`; a WAF serves everyone, so omit).

Write: `zones[].appliances[]` with `name`, `label`, `sub`, `type`, `edge`, `filters`, `serves`, `info`.

Tip: an NSG or security group on a subnet is an appliance of that subnet (`type: "firewall"`, `label: "NSG"`), and a flow into the subnet routes through it automatically.

## Section 3: Nodes, servers, services

Walk zone by zone: "What runs here?" For each node, ask for: label, what it is (`type`), one-line `sub`, whether it is a host running several services (then each service is a **component** with a type and ports), the data it holds (`data_classification`, `data_tags`), and whether it is a cloud service (provider and service name → cloud card).

Write: `nodes[]` with `name`, `label`, `sub`, `type`, `zone`, `info` (two or three sentences a reviewer would want), `components[]` (`name`, `label`, `type`, `ports`, `info`), `data_classification`, `data_tags`, `cloud`, `stack` (for N identical instances), `out_of_scope` + `scope_reason`.

Rules: a `database` or `storage` node on the Internet side gets a warning; SaaS and public endpoints go in `zone: "internet"` with `type: "saas"` or `"public-endpoint"`.

**Service profile** (`profile`, on any node, component or appliance; offer it in one batch per block and accept "skip"):
- Ownership: business owner, technical owner, team, contact, support tier (24x7 / business-hours / best-effort / unsupported).
- Platform: category (physical server, VM, container, Kubernetes, serverless, PaaS, SaaS, network appliance, mainframe, workstation, mobile, IoT/OT), OS or runtime and version, support status (supported / extended / end-of-life), EOL date.
- Location: hosting (on-premises DC, colocation, public or private cloud, edge/branch, home, third-party, mobile), site, region, country, data-residency constraint.
- Device authentication ("how does it prove who it is to others?"): single or multi-factor; methods (password, shared secret, API key, certificate/mTLS, hardware-bound certificate, workload or managed identity, Kerberos machine account, SSH key, OAuth client credentials, FIDO2 token, 802.1X, device compliance); assurance (AAL1/2/3); where its credential is stored.
- Elevated access: model (none, standing admin, shared admin account, just-in-time, PAM-vaulted, break-glass only), MFA required and phishing-resistant, pathway (bastion, PAW, VPN, direct, console, cloud portal, pipeline only), local admin (disabled, LAPS-managed …), session recording, plane (control / management / workload / user access).
- Patching: responsibility, cadence, auto-update, SLA days (critical/high/medium), KEV SLA, last patched, unsupported components.
- Hardening: baseline (CIS L1, CIS L2, DISA STIG, vendor, organisation, none), verified by (scanner, configuration management, manual review, not verified), last assessed, exceptions.
- Software: sourcing (COTS, COTS customized, GOTS, open source, custom developed, SaaS, hybrid), vendor, product, version, support contract, SBOM available.

Normalize every typed answer with `scripts/normalize.mjs` (fields `platform_category`, `hosting`, `factors`, `credential_storage`, `elevated_access_model`, `hardening_baseline`, `sourcing`).

**Dependencies** (`depends_on`, on any node, component or appliance): ask "what does it need to work?" and list each as `kind` (identity, directory, dns, pki, kms, secrets, logging, monitoring, time, package-registry, update-service, backup, licensing, messaging, storage, database, api, network, other; `normalize.mjs dependency_kind`), `ref` when the provider is on the diagram (a node, `node/component` or appliance) or `label` when it is not ("Let's Encrypt", "corporate NTP"), `criticality` (required, degraded, optional) and a `note`. A cloud card's "Depends on" line is the list to start from. Every dependency with a `ref` wants a flow between the two elements: the real auth or data flow when one exists, otherwise a flow of kind `dependency` (Section 5), which the renderer draws thin and dashed on its own layer. The validator warns about a dependency with no flow.

## Section 4: Users, devices and actors

Ask: who initiates the flows (customers, employees, administrators, partners, batch jobs); from where (Internet, office, branch, home); on what device (managed laptop, workstation, mobile, IoT/OT); and whether to draw a **bad actor** (recommended whenever a threat model is wanted; it anchors adversaries and blocked paths).

Write: nodes of type `user`, `remote-user`, `admin`, `laptop`, `workstation`, `mobile`, `iot`, `ot`, `bad-actor`. Internet-side actors use `zone: "internet"`; office users sit in the office zone. An identity provider is a node too (`type: "identity-provider"`).

## Section 5: Flows and authentication

For every interaction worth drawing, ask: from → to (by name; components as `node/component`), direction (`one-way` or `two-way`), what kind of traffic (`data`, `control`, `auth`, `token`, `trust`, `blocked`, `tunnel`, `dependency` for a standing dependency such as a secrets read at start-up, log shipping or directory synchronisation), protocol and port, and **how it authenticates**. Offer the auth list with strengths; weak and absent authentication are drawn as warnings on purpose:

- none: anonymous · weak: password, basic, api-key · moderate: ssh-key, oauth2, saml, oidc · strong: kerberos, mfa, mtls, certificate, fido2 (phishing-resistant), managed-identity.
- If the user's environment uses other names ("Entra ID + MFA"), declare `auth_types[]` with ids, labels and strengths and use those.

Also ask: which paths are **blocked by design** and worth showing with a red ✕ (direct Internet to database, RDP from the Internet); and which standing **trust** relationships exist (federation, certificate trust).

Write: `flows[]` with `name` (`f-<from>-<to>` works), `label`, `from`, `to`, `direction`, `kind`, `auth`, `protocol`, `port`, `encrypted`, `info`, `blocked_reason`. Set `via` only when automatic routing through boundary appliances would be wrong (`[]` means "no appliance"). Ask, with the authentication question, **what the flow carries and how sensitive it is**: every flow that is not `trust` or `blocked` gets `data_classification` (public, internal, confidential, restricted) and the `data_tags` that apply (pii, pci, phi, credentials …); the validator warns when one is missing.

**Flow detail** (for the flows that matter to the threat model; one batch per flow, "skip" allowed):
- Connection: type (request/response, streaming, batch file transfer, message queue, replication, management, remote session, tunnel, DNS, email), who initiates (`from`, `to` for pull/callback, `either`), session (persistent / ephemeral / scheduled), frequency, volume.
- Data: what the client sends and what the server sends (credentials, tokens, session cookies, personal data, payment data, health data, commands, configuration, queries, query results, files, documents, telemetry, logs, keys/certificates, code, email, media), sensitivity (public / internal / confidential / restricted), labels the user uses (PII, sensitive PII, PHI, PCI, NPI, MNPI, FCI, CUI, export-controlled, proprietary, trade secret, credentials, IP), TLP.
- Transport: application protocol; security protocol (TLS 1.3 / 1.2, deprecated TLS 1.1 / 1.0 / SSL 3, SSH, IPsec ESP or AH, WireGuard, DTLS, QUIC, SMB 3 encryption or signing, Kerberos, application-layer, none); implicit or explicit (STARTTLS); what it provides (confidentiality, integrity, server authentication, mutual authentication, forward secrecy, replay protection; defaults follow the protocol); certificate validation.
- Authentication: client method (none, Basic, password, API key, OAuth bearer, OIDC, SAML, client certificate/mTLS, hardware-bound certificate, SSH key, Kerberos, NTLM, HMAC signing, workload or managed identity, IP allow-list), single/multi-factor and MFA type, **where the client credential lives** (HSM, TPM, smart card, cloud key vault, secrets manager, OS certificate store, container secret, encrypted file, file on disk, environment variable, plaintext config, source code), rotation; server method (X.509, SSH host key, Kerberos SPN, PSK, none), certificate issuer (public CA, private PKI, cloud-managed CA, self-signed), **where the server key lives**, pinning.
- Path controls: logged and where, rate limited, input validated, DLP / TLS / WAF inspected. Availability: timeout, retries, single point of failure.

Normalize with `normalize.mjs` (`connection_type`, `initiator`, `classification`, `data_tag`, `security_protocol`, `client_auth`, `server_auth`, `credential_storage`, `factors`). The validator warns on deprecated TLS, sensitive data without confidentiality, weak credential storage, disabled certificate validation and unlogged flows.

Build and show the diagram here; the shape of the network is now visible and it is the right moment to add layout hints (`layout-hints.md`). Then run `node scripts/suggest.mjs model.json`: the rules read the flows just captured and list the threats they imply (an unauthenticated crossing, data in the clear, a boundary with no appliance …); tell the user what they found, and keep the list for Section 7, where `--apply` writes the ones they want as suggested threats (`threats.md`, "Suggested threats from cards and rules").

## Section 6: The story (phases and steps)

Ask the user to tell the flow as a story: "Walk me through what happens, from the first request to the last log line." Then propose phases (three to five: Connect, Identity, Access, Operate, or their own words) and steps (one per meaningful hop or decision; 6 to 12 is typical).

For each step, write: `name`, `phase`, `short` (chip, ≤ 24 characters), `title` (one line), `description` (two to four sentences in the user's voice), `details` (2–4 bullets), `flows` (what the step is about), `highlight` (nodes, components, appliances to light up), `packets` (default: one packet per flow in the step; add a `reverse` token/data packet for responses), `tunnel` (flows that stay lit as established tunnels), `badge` on the node that got what it wanted, and an `outcome` sentence on the final step.

## Section 7: Threats and controls

Open `threats.md` and `risk-scoring.md`. Ask whether the user wants threats now; for a pure architecture diagram, skip and offer to add them later. Order per threat: statement → STRIDE → weakness → targets → adversary → consequence → controls in place → current risk → inherent risk → treatment, planned controls and projected risk → suggested mitigations → status.

## Section 7b: Attack paths

Once the threats are in, ask how they chain (`threats.md`, "Attack paths"): where an adversary enters, what the first threat gains them, which flow or system that opens next, and so on to the asset and its impact. Write `attack_paths[]` with permanent AP numbers, one hop per move, the control that breaks the chain today and the one that would. Skip when the user wants the diagram only; offer it again when a threat's consequence reads like "and from there …".

## Section 7c: Requirements and evidence

After the threats and paths, ask what must be true (`threats.md`, "Requirements and evidence"): "What must hold for THR-0004 not to matter?" Write `requirements[]` with permanent REQ numbers: a testable `statement`, the threats it answers, the controls that satisfy it, its source (a policy, a standard, a regulation, a contract, this threat model) and the framework clauses it serves. For every `verified` control ask what showed it works and record it in `evidence[]` (kind, reference, by). Skip when the user wants the diagram only; offer it again before the summary, since the register and the reports rest on it.

## Scope, at any point

Any zone, appliance, node, component or flow can be marked `out_of_scope: true` with a `scope_reason`. It stays on the diagram with all its attributes but is drawn greyed out; threats may still target it. Ask "is this in scope for the review?" whenever the user mentions something they only want shown for context.

## Section 8: Layers

Ask: "Should anything be toggleable as a group: a future phase, a proposed change, legacy paths, observability, OT?" Write `layers[]` (`name`, `label`, `description`, `visible`) and add the layer name to the `layers` list of each element that belongs. Built-in layers (zones, nodes, flows by auth strength, threats, controls …) exist without declaration.

## Section 9: Summary and signature

Ask for: a logo file (embed as a `data:` URI in `meta.logo`; keep it under 200 KB), the one-line `flow_summary`, the `path_summary` hops for the chips, the `access_summary`, `assumptions[]` and `out_of_scope[]`. Confirm `settings.layout.min_width/min_height` (defaults 1280 × 640) and whether the register, layer panel, legend and signature block should show (`settings.show`).

Offer a **policy** (`settings.policy`): what `validate --strict` should fail on when this model is checked in CI. The defaults are sensible (an open threat at high or above with no planned control on track, an open threat with no treatment decision, an overdue control, an approved requirement with no control, a suggested element, an accepted risk past its review date); the user can move the band, require evidence on every verified control, or require a classification on every flow. The policy travels with the model, so CI only runs `node scripts/validate.mjs model.json --strict`.

Organisation metadata that fits no field (a CMDB id, a cost code, a register link) goes in `custom` on the element.

## Finish

1. `node scripts/validate.mjs model.json --fix` with zero errors; read the warnings aloud and resolve what the user wants resolved. If the model carries a policy, run `--strict` too and report what it would fail on in CI.
2. `node scripts/build.mjs model.json`, open the HTML, run the layout checklist in `render.md`.
3. Tell the user what the model contains (counts), where the files are, and what is still open (flows without auth, suggested elements, threats to add).
4. Offer the reports: `node scripts/report.mjs model.json --kind exec` for the executive summary, `--kind developer` for the to-do list by owner, `--kind audit` for the evidence view (`-o report.md` writes the file); and `node scripts/portfolio.mjs <folder>` when the user keeps several models. For an audit, `node scripts/coverage.mjs model.json --framework <id>` lists which controls and requirements touch which clause (say that the crosswalk-derived rows are DigitalPrez's working aid, not the publisher's mapping).
