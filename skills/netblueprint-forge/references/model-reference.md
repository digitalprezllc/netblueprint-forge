# Model reference

Generated from `assets/schema/netblueprint.schema.json` by `scripts/model-reference.mjs` on 2026-10-25. Do not edit by hand; change the schema and regenerate.

A network / application flow and threat model. The renderer computes layout from this; nothing here is a pixel coordinate. Names are stable ids that the user refers to in later edits; labels are what the diagram shows. Cross-references (zone parents, flow endpoints, step flows, threat targets, control ids, auth type ids, layer names) are checked by scripts/validate.mjs, not by this schema.

## Top level

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `tabs` | array of [tab](#tab), min 1 |  | Several diagrams in one document, shown as tabs under the canvas (left to right in this order). Each tab holds its own zones, nodes, flows, phases, steps, threats and controls; meta, settings, auth_types and layers are shared. With tabs[] the top-level collections stay empty (validate.mjs enforces this). Threat ids and numbers, control ids and attack path ids and numbers are unique across all tabs (a scenario tab may repeat those of its baseline tab); other names are unique within a tab. |
| `netblueprint` | string matching `^1(\.[0-9]+)?$` | yes | Model format version. The build script refuses a major version it does not know. |
| `meta` | [meta](#meta) | yes |  |
| `settings` | [settings](#settings) |  |  |
| `auth_types` | array of [authType](#authtype) |  | Authentication types a flow may use. Omit to get the built-in set (anonymous, password, basic, api-key, oauth2, saml, oidc, kerberos, mfa, mtls, certificate, fido2, managed-identity, ssh-key). Listing any replaces the built-in set entirely. |
| `layers` | array of [layer](#layer) |  | Custom layers. Built-in layers (zones, appliances, nodes, components, internet, flows-weak, flows-moderate, flows-strong, flows-blocked, threats, controls, labels) exist without being declared and can be hidden by default through settings.layers_hidden. |
| `zones` | array of [zone](#zone) |  |  |
| `nodes` | array of [node](#node), min 1 |  |  |
| `flows` | array of [flow](#flow) |  |  |
| `phases` | array of [phase](#phase) |  | Ordered phases of the story. Omit to derive them from steps in order of first appearance. |
| `steps` | array of [step](#step) |  |  |
| `threats` | array of [threat](#threat) |  |  |
| `controls` | array of [control](#control) |  |  |
| `attack_paths` | array of [attackPath](#attackpath) |  | Attack paths (multi-hop chains) of this diagram. |

## Shared types

| Type | Meaning |
| - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique |
| `ref` | ref: `node` or `node/component` |
| `nameList` | list of names (unique) |
| `refList` | list of refs (unique) |
| `shortText` | text ≤200 |
| `longText` | text ≤4000 |
| `date` | date YYYY-MM-DD |
| `semver` | version MAJOR.MINOR.PATCH |
| `url` | URL |
| `color` | hex colour or palette name (blue, teal, green, slate, red, grey, purple, gold, orange, navy) |
| `dataUriImage` | image as data: URI (png/jpeg/gif/webp/svg) |
| `fiveLevel` | `very-low` · `low` · `moderate` · `high` · `very-high` |
| `classification` | `public` · `internal` · `confidential` · `restricted` |
| `dataTags` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |
| `credentialStorage` | credentialStorage: `hsm`, `tpm`, `smart-card-token`, `cloud-key-vault`, `secrets-manager-vault`, `os-certificate-store`, `container-secret`, `encrypted-file-passphrase`, `file-on-disk`, `environment-variable`, `config-file-plaintext`, `source-code`, `unknown` |
| `flowDataType` | flowDataType: `credentials`, `tokens`, `session-cookies`, `personal-data`, `payment-data`, `health-data`, `commands`, `configuration`, `queries`, `query-results`, `files`, `documents`, `telemetry`, `logs`, `keys-certificates`, `code-artifacts`, `email`, `media`, `none` |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |
| `suggestedFrom` | text: card id or source |
| `threatId` | `THR-0000` to `THR-9999` |
| `controlId` | `CTL-0000` to `CTL-9999` |
| `riskAssessment` | riskAssessment: [riskAssessmentCore](#riskassessmentcore) |
| `attackPathId` | attackPathId: string matching `^AP-[0-9]{4}$` |
| `hopGain` | hopGain: `foothold`, `credentials`, `token`, `session`, `network-access`, `code-execution`, `data-access`, `data-exfiltration`, `privilege`, `persistence`, `lateral-movement`, `denial-of-service`, `impact` |
| `icon` | `server`, `database`, `service`, `api`, `connector`, `cloud`, `shield`, `firewall`, `lock`, `key`, `user`, `remote-user`, `admin`, `bad-actor`, `laptop`, `workstation`, `mobile`, `iot`, `ot`, `storage`, `queue`, `cache`, `container`, `kubernetes`, `function`, `load-balancer`, `dns`, `mail`, `directory`, `monitor`, `globe`, `building`, `generic` |

## meta (signature block)

<a id="meta"></a>

Signature block and document metadata. Title, subtitle and organization are Title Case.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `title` | text ≤200 | yes |  |
| `subtitle` | text ≤200 |  |  |
| `description` | text ≤4000 |  |  |
| `author` | text ≤200 | yes | Prepared by. |
| `reviewed_by` | text ≤200 |  |  |
| `approved_by` | text ≤200 |  |  |
| `organization` | text ≤200 |  |  |
| `document_id` | text ≤200 |  | Document number shown in the signature block, e.g. 'SEC-TM-0042'. |
| `status` | `draft`, `in-review`, `approved`, `final`, `superseded` |  |  |
| `date` | date YYYY-MM-DD | yes |  |
| `version` | version MAJOR.MINOR.PATCH | yes | Model version. archive.mjs bumps the patch on every change. |
| `revision_note` | text ≤4000 |  | What changed in this version, by element name. |
| `logo` | image as data: URI (png/jpeg/gif/webp/svg) |  |  |
| `document_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `objective` | text ≤4000 |  |  |
| `flow_summary` | text ≤200 |  | One line, e.g. 'Customer to web app'. |
| `path_summary` | array of text ≤200 |  | Ordered hop labels for the path chips, e.g. ['Customer', 'WAF', 'App Service', 'SQL']. |
| `access_summary` | text ≤4000 |  |  |
| `assumptions` | array of text ≤4000 |  |  |
| `out_of_scope` | array of text ≤4000 |  |  |
| `tags` | array of string ≤40 chars (unique) |  |  |

## settings

<a id="settings"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `network_label` | text ≤200 |  | Label over the private side, e.g. 'Contoso corporate network'. Default 'Corporate Network'. |
| `internet_label` | text ≤200 |  | Default 'Internet'. |
| `labels` | object |  | Display labels for enumerated values; ids never change. |
| `layout` | object |  |  |
| `layers_hidden` | list of names (unique) |  | Layer names (built-in or custom) that start hidden. |
| `show` | object |  |  |
| `severity_filter_default` | `very-low` · `low` · `moderate` · `high` · `very-high` |  | Minimum band shown when the diagram opens. |
| `theme` | object |  |  |

## auth_types[] entry

<a id="authtype"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `id` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `strength` | `none`, `weak`, `moderate`, `strong` | yes | Drives line style and legend: none/weak = warning, moderate = neutral, strong = secure. |
| `phishing_resistant` | boolean |  |  |
| `description` | text ≤4000 |  |  |

## layers[] entry

<a id="layer"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `description` | text ≤4000 |  |  |
| `visible` | boolean |  | Default `true`. |

## tabs[] entry (one diagram per tab; omit tabs for a single diagram)

<a id="tab"></a>

One diagram of a multi-tab document. `name` is the stable id (used in the URL hash and in edits: 'in tab admin-access, add node …'); `label` is the tab text. The summary fields override meta's for this tab when present. `attack_paths` are the tab's chains; `scenario` marks a what-if tab derived from another tab.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `description` | text ≤4000 |  |  |
| `objective` | text ≤4000 |  |  |
| `flow_summary` | text ≤200 |  |  |
| `path_summary` | array of text ≤200 |  |  |
| `access_summary` | text ≤4000 |  |  |
| `zones` | array of [zone](#zone) | yes |  |
| `nodes` | array of [node](#node), min 1 | yes |  |
| `flows` | array of [flow](#flow) |  |  |
| `phases` | array of [phase](#phase) |  |  |
| `steps` | array of [step](#step) |  |  |
| `threats` | array of [threat](#threat) |  |  |
| `controls` | array of [control](#control) |  |  |
| `attack_paths` | array of [attackPath](#attackpath) |  | Attack paths (multi-hop chains) of this diagram. |
| `scenario` | [scenario](#scenario) |  |  |

## zones[] entry

<a id="zone"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `sub` | text ≤200 |  |  |
| `parent` | name: letters, digits, `_ . -`, ≤64, unique or null |  | Name of the enclosing zone. Omit (or null) for a top-level zone on the private side. Use the reserved name 'internet' to nest a boundary on the Internet side (e.g. a provider cloud). |
| `kind` | `network`, `site`, `enclave`, `segment`, `dmz`, `vpc`, `subnet`, `cloud`, `tenant`, `provider`, `ot`, `other` |  | Default `"network"`. |
| `trust_boundary` | boolean |  | Draw as a trust boundary (dashed) regardless of kind. |
| `color` | hex colour or palette name (blue, teal, green, slate, red, grey, purple, gold, orange, navy) |  |  |
| `dashed` | boolean |  |  |
| `icon` | icon name (see icons.md) |  |  |
| `info` | text ≤4000 |  |  |
| `data_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `data_tags` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |  |  |
| `appliances` | array of [appliance](#appliance) |  |  |
| `layout` | object |  |  |
| `cloud` | [cloud](#cloud) |  |  |
| `layers` | list of names (unique) |  |  |
| `out_of_scope` | boolean |  | Still drawn and documented, but greyed out. |
| `scope_reason` | text ≤4000 |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

## zone.appliances[] entry

<a id="appliance"></a>

A filtering device on a zone boundary. Drawn as a narrow bar on the zone edge; flows that cross the boundary route through it.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `sub` | text ≤200 |  |  |
| `type` | `firewall`, `ngfw`, `waf`, `gateway`, `api-gateway`, `proxy`, `reverse-proxy`, `load-balancer`, `nat`, `bastion`, `vpn`, `ids-ips`, `zero-trust-broker`, `sd-wan`, `router`, `switch`, `other` | yes |  |
| `edge` | `auto`, `left`, `right`, `top`, `bottom` |  | Which edge of the zone it sits on. auto puts it on the edge facing the Internet side. Default `"auto"`. |
| `filters` | `inbound`, `outbound`, `both` |  | Which crossings route through it automatically: inbound (flows entering the zone), outbound (flows leaving), or both. A flow's explicit via list overrides this. Default `"both"`. |
| `serves` | list of names (unique) |  | Only flows whose far endpoint is inside one of these zones (or 'internet') route through this appliance automatically, e.g. a VPN gateway that serves ['onprem']. Omit for all crossings. |
| `color` | hex colour or palette name (blue, teal, green, slate, red, grey, purple, gold, orange, navy) |  |  |
| `info` | text ≤4000 |  |  |
| `data_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `cloud` | [cloud](#cloud) |  |  |
| `profile` | [profile](#profile) |  |  |
| `out_of_scope` | boolean |  | Still drawn and documented, but greyed out. |
| `scope_reason` | text ≤4000 |  |  |
| `layers` | list of names (unique) |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

## nodes[] entry

<a id="node"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `sub` | text ≤200 |  |  |
| `type` | `server`, `host`, `service`, `database`, `storage`, `api`, `connector`, `saas`, `public-endpoint`, `user`, `remote-user`, `admin`, `bad-actor`, `laptop`, `workstation`, `mobile`, `iot`, `ot`, `identity-provider`, `generic` | yes | What the node is; sets the default icon and some lint rules (a bad-actor cannot be a flow destination for data, a database should not sit on the Internet side unmarked). |
| `icon` | icon name (see icons.md) |  | Override the icon implied by type. |
| `zone` | name: letters, digits, `_ . -`, ≤64, unique | yes | Zone name, or the reserved name 'internet' for SaaS, public endpoints, remote users and external actors. |
| `color` | hex colour or palette name (blue, teal, green, slate, red, grey, purple, gold, orange, navy) |  |  |
| `stack` | integer 1–9 |  | Draw as a stack of this many instances. |
| `info` | text ≤4000 |  |  |
| `components` | array of [component](#component) |  | Present when the node is a host that runs several services. Each is referenced as node/component. |
| `data_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `data_tags` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |  |  |
| `cloud` | [cloud](#cloud) |  |  |
| `profile` | [profile](#profile) |  |  |
| `layout` | [layoutHints](#layouthints) |  |  |
| `layers` | list of names (unique) |  |  |
| `out_of_scope` | boolean |  | Still drawn and documented, but greyed out. |
| `scope_reason` | text ≤4000 |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

## node.components[] entry

<a id="component"></a>

A service or process running on a host node.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |
| `type` | `web-server`, `app-server`, `api`, `database`, `sql-server`, `cache`, `queue`, `file-share`, `directory`, `dns`, `mail`, `container`, `function`, `agent`, `scheduler`, `process`, `storage`, `secrets`, `monitoring`, `identity`, `custom` | yes |  |
| `icon` | icon name (see icons.md) |  |  |
| `ports` | array of string matching `^[0-9]{1,5}(-[0-9]{1,5})?(/(tcp\|udp\|sctp))?$` (unique) |  |  |
| `info` | text ≤4000 |  |  |
| `data_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `data_tags` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |  |  |
| `cloud` | [cloud](#cloud) |  |  |
| `profile` | [profile](#profile) |  |  |
| `out_of_scope` | boolean |  | Still drawn and documented, but greyed out. |
| `scope_reason` | text ≤4000 |  |  |
| `layers` | list of names (unique) |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

## flows[] entry

<a id="flow"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 |  |  |
| `from` | ref: `node` or `node/component` | yes |  |
| `to` | ref: `node` or `node/component` | yes |  |
| `direction` | `one-way`, `two-way` |  | one-way: from → to. two-way: request and response both drawn; packets may run either way. Default `"one-way"`. |
| `kind` | `data`, `control`, `auth`, `token`, `trust`, `blocked`, `tunnel` |  | data: application traffic. control: policy / control plane. auth: authentication exchange. token: credential or token issuance. trust: a standing trust relationship (dotted). blocked: denied by policy (red ✕). tunnel: an established encrypted tunnel. Default `"data"`. |
| `auth` | name: letters, digits, `_ . -`, ≤64, unique |  | Id of an auth type. Sets the strength styling and legend entry. |
| `protocol` | text ≤200 |  | HTTPS, TLS 1.3, SSH, RDP, SMB, SQL/TDS … |
| `port` | string matching `^[0-9]{1,5}(-[0-9]{1,5})?(/(tcp\|udp\|sctp))?$` |  |  |
| `encrypted` | boolean |  |  |
| `via` | list of names (unique) |  | Appliance names the flow must pass through, in order. Omit to route through each boundary's appliance automatically. |
| `blocked_reason` | text ≤200 |  |  |
| `info` | text ≤4000 |  |  |
| `data_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `data_tags` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |  |  |
| `connection` | [flowConnection](#flowconnection) |  |  |
| `data` | [flowData](#flowdata) |  |  |
| `transport` | [flowTransport](#flowtransport) |  |  |
| `authentication` | [flowAuthentication](#flowauthentication) |  | Detail behind `auth`: how each end authenticates and where its credentials live. |
| `path_controls` | [pathControls](#pathcontrols) |  |  |
| `availability` | [flowAvailability](#flowavailability) |  |  |
| `out_of_scope` | boolean |  | Still drawn and documented, but greyed out. |
| `scope_reason` | text ≤4000 |  |  |
| `layers` | list of names (unique) |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

## phases[] entry

<a id="phase"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `label` | text ≤200 | yes |  |

## steps[] entry

<a id="step"></a>

One step of the guided story.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `name` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `phase` | name: letters, digits, `_ . -`, ≤64, unique |  |  |
| `short` | string ≤24 chars |  | Chip label; defaults to title. |
| `title` | text ≤200 | yes |  |
| `description` | text ≤4000 | yes |  |
| `details` | array of text ≤200 |  |  |
| `flows` | list of names (unique) |  | Flows this step is about. Used for the collapsed band (source → destination, direction, auth) and highlighted during the step. |
| `highlight` | list of refs (unique) |  | Nodes, components or appliances to mark active. |
| `pulse` | ref: `node` or `node/component` |  |  |
| `packets` | array of [packet](#packet) |  |  |
| `tunnel` | list of names (unique) |  | Flows drawn as an established tunnel once the step finishes. |
| `badge` | ref: `node` or `node/component` |  | Node or component that gets a ✓ badge when the step finishes. |
| `outcome` | text ≤200 |  | Shown as the step's outcome line when set. |
| `annotation` | text ≤200 |  |  |
| `threats` | array of `THR-0000` to `THR-9999` (unique) |  | Threat ids relevant to this step; their circles are emphasised while the step is active. |
| `layers` | list of names (unique) |  |  |

## step.packets[] entry

<a id="packet"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `flow` | name: letters, digits, `_ . -`, ≤64, unique | yes |  |
| `direction` | `forward`, `reverse` |  | Default `"forward"`. |
| `kind` | `data`, `control`, `auth`, `token`, `blocked` |  | Override the flow's kind for this packet (e.g. a token returning over a control flow). |
| `delay_ms` | integer 0–20000 |  |  |
| `duration_ms` | integer 100–20000 |  |  |

## threats[] entry

<a id="threat"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `id` | `THR-0000` to `THR-9999` | yes |  |
| `number` | integer 1–9999 | yes | The digit in the circle. Permanent; never reused. |
| `title` | text ≤200 | yes |  |
| `description` | text ≤4000 |  |  |
| `status` | `identified`, `investigating`, `open`, `mitigated`, `accepted`, `transferred`, `avoided`, `not-applicable`, `retired` | yes | Default `"identified"`. |
| `status_reason` | text ≤4000 |  | Required for not-applicable and retired. |
| `retired` | boolean |  | Default `false`. |
| `classification` | object | yes |  |
| `vulnerability` | [vulnerability](#vulnerability) |  |  |
| `targets` | array of [target](#target), min 1 | yes |  |
| `boundary_crossed` | object |  |  |
| `assets_at_risk` | array of text ≤200 |  |  |
| `data_classification` | `public` · `internal` · `confidential` · `restricted` |  |  |
| `data_tags` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |  |  |
| `adversary` | [adversary](#adversary) | yes |  |
| `attack` | object |  |  |
| `risk` | [riskAssessmentCore](#riskassessmentcore) + `consequence`, `cvss`, `residual`, `projected` | yes |  |
| `standards` | object |  |  |
| `treatment` | object |  |  |
| `provenance` | object |  |  |
| `layers` | list of names (unique) |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

Rules: when `status` is `not-applicable` or `retired` then `status_reason` is required; when `status` is `retired` then `retired` is `true` and `retired` is required.

## threat.targets[] / control.implemented_on[] entry

<a id="target"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `kind` | `zone`, `node`, `component`, `flow`, `appliance`, `boundary` | yes |  |
| `ref` | string matching `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}(/[A-Za-z0-9][A-Za-z0-9_.-]{0,63})?(-to-[A-Za-z0-9][A-Za-z0-9_.-]{0,63})?$` | yes | The element's name (node/component for a component; '<from-zone>-to-<to-zone>' for a boundary). |
| `marker` | boolean |  | Draw the numbered circle at this target. Default true. Default `true`. |
| `note` | text ≤200 |  |  |

## threat.adversary

<a id="adversary"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `type` | `activist`, `competitor`, `crime-syndicate`, `criminal`, `hacker`, `insider-accidental`, `insider-disgruntled`, `nation-state`, `sensationalist`, `spy`, `terrorist`, `unknown`, `malicious-user`, `compromised-credential-holder`, `third-party`, `automated-bot`, `non-adversarial` | yes | STIX 2.1 threat-actor-type-ov plus NetBlueprint additions. |
| `source_class` | `individual-outsider`, `individual-insider`, `individual-trusted-insider`, `individual-privileged-insider`, `group-ad-hoc`, `group-established`, `organization-competitor`, `organization-supplier`, `organization-partner`, `organization-customer`, `nation-state`, `accidental-user`, `accidental-privileged-user`, `structural-it-equipment`, `structural-environmental-controls`, `structural-software`, `environmental-disaster`, `environmental-unusual-natural-event`, `environmental-infrastructure-outage` |  | NIST SP 800-30 Table D-2. |
| `motivation` | array of `accidental`, `coercion`, `dominance`, `ideology`, `notoriety`, `organizational-gain`, `personal-gain`, `personal-satisfaction`, `revenge`, `unpredictable` (unique) |  | STIX 2.1 attack-motivation-ov. |
| `capability` | `very-low` · `low` · `moderate` · `high` · `very-high` |  | NIST Table D-3. |
| `intent` | `very-low` · `low` · `moderate` · `high` · `very-high` |  | NIST Table D-4. |
| `targeting` | `very-low` · `low` · `moderate` · `high` · `very-high` |  | NIST Table D-5. |
| `resources` | `individual`, `club`, `contest`, `team`, `organization`, `government` |  | STIX 2.1 attack-resource-level-ov. |
| `position` | `external`, `internal`, `trusted-third-party` |  |  |
| `required_privileges` | `none`, `low`, `high` |  | CVSS v4 PR. |
| `access_vector` | `network`, `adjacent`, `local`, `physical` |  | CVSS v4 AV. |
| `authentication_required` | boolean |  |  |
| `actor_node` | name: letters, digits, `_ . -`, ≤64, unique |  | Node name of the actor on the diagram (a bad-actor, user or device node), if drawn. |

## threat.risk and threat.risk.residual

<a id="riskassessmentcore"></a>

One assessment: inherent (threat.risk) or after controls (threat.risk.residual). Left open here so threat.risk can add cvss and residual; the wrappers close it with unevaluatedProperties.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `method` | `likelihood-impact`, `owasp-rr` | yes |  |
| `likelihood` | `very-low` · `low` · `moderate` · `high` · `very-high` |  |  |
| `impact` | `very-low` · `low` · `moderate` · `high` · `very-high` |  |  |
| `owasp_rr` | [owaspRiskRating](#owaspriskrating) |  |  |
| `rating` | `very-low` · `low` · `moderate` · `high` · `very-high` |  | Canonical band. Computed by validate.mjs from the inputs; written back so the file stands alone. |
| `score` | number 0–10 |  | Sort key: NIST semi-quantitative value of the band (0, 2, 5, 8, 10). |
| `rating_override` | `very-low` · `low` · `moderate` · `high` · `very-high` |  |  |
| `rating_override_reason` | text ≤4000 |  |  |
| `rationale` | text ≤4000 |  |  |

Rules: when `method` is `likelihood-impact` then `likelihood`, `impact` are required; when `method` is `owasp-rr` then `owasp_rr` is required; when `rating_override` is required then `rating_override_reason` is required.

## risk.owasp_rr

<a id="owaspriskrating"></a>

OWASP Risk Rating Methodology inputs. Each factor takes one of the fixed option values listed in references/risk-scoring.md.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `skill_level` | `1`, `3`, `5`, `6`, `9` | yes |  |
| `motive` | `1`, `4`, `9` | yes |  |
| `opportunity` | `0`, `4`, `7`, `9` | yes |  |
| `size` | `2`, `4`, `5`, `6`, `9` | yes |  |
| `ease_of_discovery` | `1`, `3`, `7`, `9` | yes |  |
| `ease_of_exploit` | `1`, `3`, `5`, `9` | yes |  |
| `awareness` | `1`, `4`, `6`, `9` | yes |  |
| `intrusion_detection` | `1`, `3`, `8`, `9` | yes |  |
| `loss_of_confidentiality` | `2`, `6`, `7`, `9` |  |  |
| `loss_of_integrity` | `1`, `3`, `5`, `7`, `9` |  |  |
| `loss_of_availability` | `1`, `5`, `7`, `9` |  |  |
| `loss_of_accountability` | `1`, `7`, `9` |  |  |
| `financial_damage` | `1`, `3`, `7`, `9` |  |  |
| `reputation_damage` | `1`, `4`, `5`, `9` |  |  |
| `non_compliance` | `2`, `5`, `7` |  |  |
| `privacy_violation` | `3`, `5`, `7`, `9` |  |  |
| `impact_basis` | `technical`, `business` |  | Which impact average sets the band. OWASP: use business when the information is good, otherwise technical. Default `"technical"`. |
| `likelihood_avg` | number 0–9 |  |  |
| `impact_avg` | number 0–9 |  |  |
| `likelihood_level` | `low`, `medium`, `high` |  |  |
| `impact_level` | `low`, `medium`, `high` |  |  |
| `severity` | `note`, `low`, `medium`, `high`, `critical` |  |  |

Rules: at least one of: `loss_of_confidentiality` + `loss_of_integrity` + `loss_of_availability` + `loss_of_accountability` or `financial_damage` + `reputation_damage` + `non_compliance` + `privacy_violation`.

## risk.cvss

<a id="cvss"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `version` | `3.1`, `4.0` | yes |  |
| `vector` | string matching `^CVSS:(3\.1\|4\.0)/[A-Z]{1,3}:[A-Z](/[A-Z]{1,3}:[A-Z])+$` | yes |  |
| `base_score` | number 0–10 |  |  |
| `severity` | `none`, `low`, `medium`, `high`, `critical` |  |  |

## controls[] entry

<a id="control"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `id` | `CTL-0000` to `CTL-9999` | yes |  |
| `name` | text ≤200 | yes |  |
| `description` | text ≤4000 |  |  |
| `type` | `preventive`, `detective`, `corrective`, `deterrent`, `recovery`, `compensating`, `directive` | yes |  |
| `status` | `proposed`, `planned`, `in-progress`, `implemented`, `verified`, `not-implemented`, `retired` | yes |  |
| `effectiveness` | `very-low` · `low` · `moderate` · `high` · `very-high` |  |  |
| `verification` | `design-review`, `code-review`, `test`, `penetration-test`, `scanner`, `audit`, `continuous-monitoring`, `not-yet-verified` |  |  |
| `verified_on` | date YYYY-MM-DD |  |  |
| `owner` | text ≤200 |  |  |
| `due_date` | date YYYY-MM-DD |  |  |
| `ticket` | text ≤200 |  |  |
| `implemented_on` | array of [target](#target) |  | Where the control lives on the diagram (an appliance, node, component or flow), if anywhere. |
| `nist_800_53` | array of string matching `^(AC\|AT\|AU\|CA\|CM\|CP\|IA\|IR\|MA\|MP\|PE\|PL\|PM\|PS\|PT\|RA\|SA\|SC\|SI\|SR)-[0-9]+(\([0-9]+\))?$` (unique) |  |  |
| `cis_controls` | array of string matching `^CIS-([1-9]\|1[0-8])(\.[0-9]{1,2})?$` (unique) |  |  |
| `layers` | list of names (unique) |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

Rules: when `status` is `verified` then `verification` is not `not-yet-verified` and `verification` is required.

## cloud block (zones, nodes, components, appliances)

<a id="cloud"></a>

Set when the element is a cloud service. Drives the cloud-guidance questions and the placement rules.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `provider` | `aws`, `azure`, `gcp`, `oci`, `other` | yes |  |
| `service` | text ≤200 |  | Provider service name, e.g. 'App Service', 'S3', 'Cloud SQL'. |
| `card` | string ≤80 chars |  | Catalogue card id in references/cloud/<provider>.md. |
| `region` | text ≤200 |  |  |
| `exposure` | `internet`, `private`, `hybrid`, `unknown` |  | internet: reachable from the public Internet; private: RFC 1918 / private network only; hybrid: both endpoints exist. |
| `endpoint` | `public`, `private`, `both`, `none`, `unknown` |  |  |
| `network` | object |  |  |
| `disabled_protocols` | array of string ≤40 chars (unique) |  | Insecure or legacy protocols the user confirmed are off (ftp, ftps, telnet, smbv1, tls1.0, tls1.1, basic-auth, imdsv1, public-access, anonymous-access …). |
| `enabled_risky_protocols` | array of string ≤40 chars (unique) |  | Insecure or legacy protocols the user confirmed are still on. Each becomes a suggested threat. |
| `notes` | text ≤4000 |  |  |

## node.layout

<a id="layouthints"></a>

Hints by name only. The renderer may ignore a hint it cannot honour without overlap.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `order` | integer 0– |  | Sort key among siblings in the same zone (lower first). |
| `column` | integer 0– |  | Preferred column within the zone, 0-based. |
| `row` | integer 0– |  | Preferred row within the zone, 0-based. |
| `next_to` | name: letters, digits, `_ . -`, ≤64, unique |  | Keep adjacent to this sibling. |
| `align` | `start`, `center`, `end` |  |  |

## profile

<a id="profile"></a>

Service profile for a node, component or appliance: who owns it, what it runs on, where it is, how it authenticates itself, how administrators reach it, how it is patched and hardened, and how it was sourced. Every block is optional.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `ownership` | object |  |  |
| `platform` | object |  |  |
| `location` | object |  |  |
| `device_authentication` | object |  | How this service or device proves its own identity to others (NIST SP 800-63B authenticator types applied to machines). |
| `elevated_access` | object |  | How administrators get privileged access (Microsoft enterprise access model planes; PAM practice). |
| `patching` | object |  |  |
| `hardening` | object |  |  |
| `software` | object |  |  |

## flowConnection

<a id="flowconnection"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `type` | `request-response`, `streaming`, `batch-file-transfer`, `message-queue`, `replication`, `management`, `remote-session`, `tunnel`, `dns`, `email`, `other` |  |  |
| `initiator` | `from`, `to`, `either` |  | Who opens the connection: from (the source), to (the destination pulls / calls back), either. |
| `session` | `persistent`, `ephemeral`, `scheduled` |  |  |
| `frequency` | text ≤200 |  |  |
| `volume` | text ≤200 |  |  |

## flowData

<a id="flowdata"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `client_sends` | array of flowDataType: `credentials`, `tokens`, `session-cookies`, `personal-data`, `payment-data`, `health-data`, `commands`, `configuration`, `queries`, `query-results`, `files`, `documents`, `telemetry`, `logs`, `keys-certificates`, `code-artifacts`, `email`, `media`, `none` (unique) |  |  |
| `server_sends` | array of flowDataType: `credentials`, `tokens`, `session-cookies`, `personal-data`, `payment-data`, `health-data`, `commands`, `configuration`, `queries`, `query-results`, `files`, `documents`, `telemetry`, `logs`, `keys-certificates`, `code-artifacts`, `email`, `media`, `none` (unique) |  |  |
| `sensitivity` | `public` · `internal` · `confidential` · `restricted` |  | Highest classification level in transit. |
| `categories` | list of `pii` `phi` `pci` `financial` `credentials` `intellectual-property` `mission-critical` `export-controlled` `other` |  |  |
| `tlp` | `clear`, `green`, `amber`, `amber-strict`, `red` |  | FIRST TLP 2.0 sharing label. |

## flowTransport

<a id="flowtransport"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `protocol` | text ≤200 |  | Application protocol: HTTPS, TDS, SMB, LDAPS, RDP, SSH, SFTP, FTPS, SMTP, MQTT, gRPC … |
| `security_protocol` | `tls-1.3`, `tls-1.2`, `tls-1.1`, `tls-1.0`, `ssl-3`, `ssh-2`, `ipsec-esp`, `ipsec-ah`, `wireguard`, `dtls`, `quic`, `smb3-encryption`, `smb-signing`, `kerberos-encryption`, `application-layer-encryption`, `none`, `unknown` |  | tls-1.1, tls-1.0 and ssl-3 are deprecated (RFC 8996); ipsec-ah and smb-signing give integrity only. |
| `mode` | `implicit`, `explicit` |  | implicit: encrypted from the first byte; explicit: STARTTLS-style upgrade (downgrade risk). |
| `provides` | object |  |  |
| `certificate_validation` | `full-chain`, `pinned`, `self-signed-trusted`, `disabled`, `unknown` |  |  |
| `cipher_notes` | text ≤200 |  |  |

## flowAuthentication

<a id="flowauthentication"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `client` | object |  |  |
| `server` | object |  |  |

## pathControls

<a id="pathcontrols"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `logged` | boolean |  |  |
| `log_destination` | text ≤200 |  |  |
| `rate_limited` | boolean |  |  |
| `input_validated` | boolean |  |  |
| `dlp_inspected` | boolean |  |  |
| `tls_inspected` | boolean |  |  |
| `waf_inspected` | boolean |  |  |

## flowAvailability

<a id="flowavailability"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `timeout_s` | integer 0– |  |  |
| `retries` | integer 0– |  |  |
| `single_point_of_failure` | boolean |  |  |

## vulnerability

<a id="vulnerability"></a>

The weakness the threat exploits, normalized to one category (CWE classes and OWASP Top 10:2025 wording), with an optional CWE id and a free-text specific.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `category` | `unauthorized-access`, `broken-authentication`, `credential-exposure`, `injection`, `improper-input-validation`, `security-misconfiguration`, `missing-or-weak-encryption`, `sensitive-data-exposure`, `insufficient-logging-monitoring`, `insecure-design`, `vulnerable-components`, `supply-chain`, `ssrf`, `privilege-escalation`, `excessive-trust-or-flat-network`, `resource-exhaustion`, `availability-failure`, `improper-error-handling`, `malware-execution`, `phishing-social-engineering`, `insider-misuse`, `physical-access`, `data-exfiltration`, `third-party-dependency`, `race-condition`, `memory-safety`, `other` | yes |  |
| `cwe` | string matching `^CWE-[0-9]+$` |  |  |
| `description` | text ≤4000 |  |  |

## suggestedMitigation

<a id="suggestedmitigation"></a>

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `text` | text ≤4000 | yes |  |
| `source` | `user`, `reviewer`, `cloud-catalogue`, `live-research`, `standard`, `other` |  |  |
| `status` | `suggested`, `accepted`, `rejected`, `converted` |  | Default `"suggested"`. |
| `control_id` | `CTL-0000` to `CTL-9999` |  | Set when the suggestion became a control. |
| `notes` | text ≤4000 |  |  |

## attackHop

<a id="attackhop"></a>

One move of an attack path: the threat exploited, where the adversary comes from and lands, the flow ridden, and what is gained. The next hop starts where this one lands.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `threat` | `THR-0000` to `THR-9999` | yes | The threat exploited in this hop (same diagram). |
| `from` | ref: `node` or `node/component` |  | Where the adversary acts from: a node, component or appliance. Defaults to the previous hop's `to` (or the path's `entry` for the first hop). |
| `to` | ref: `node` or `node/component` |  | Where the hop lands. Defaults to the flow's destination when `via` is set. |
| `via` | name: letters, digits, `_ . -`, ≤64, unique |  | The flow the hop rides, when it rides one (a local escalation has none). |
| `gain` | hopGain: `foothold`, `credentials`, `token`, `session`, `network-access`, `code-execution`, `data-access`, `data-exfiltration`, `privilege`, `persistence`, `lateral-movement`, `denial-of-service`, `impact` | yes |  |
| `note` | text ≤4000 |  | One sentence: how the hop works and why it succeeds (the control that is missing or bypassed). |
| `bypasses` | array of `CTL-0000` to `CTL-9999` (unique) |  | Controls this hop defeats or does not meet (ids). |

## attackPath

<a id="attackpath"></a>

A multi-hop attack path (cascade): how a failure at one place lets the adversary cross boundaries and reach an asset. Each hop names a threat of this diagram; the renderer walks the hops as a red phase of the story and the register lists the path. Ids and numbers are unique across the whole document (a scenario tab may repeat its baseline's).

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `id` | attackPathId: string matching `^AP-[0-9]{4}$` | yes |  |
| `number` | integer 1–9999 | yes | The digit in the hop markers' legend; permanent, never reused. |
| `title` | text ≤200 | yes | Title Case: "Exposed Jump Host to Database Exfiltration". |
| `description` | text ≤4000 |  | The chain in one paragraph, as the adversary would tell it. |
| `status` | `identified`, `open`, `mitigated`, `accepted`, `retired` |  | Default `"identified"`. |
| `status_reason` | text ≤4000 |  |  |
| `adversary` | [adversary](#adversary) |  |  |
| `entry` | ref: `node` or `node/component` |  | Where the path starts: usually the adversary's node (a bad actor on the Internet side) or the element already compromised. |
| `hops` | array of [attackHop](#attackhop), min 1 | yes |  |
| `impact` | text ≤4000 |  | What the adversary ends up with and what it means for the business. |
| `assets_at_risk` | array of text ≤200 |  |  |
| `risk` | [riskAssessmentCore](#riskassessmentcore) + `residual`, `projected` |  | The path's own rating: likelihood that the whole chain succeeds × impact of the end state. Residual = with the controls in place, projected = after the planned ones. Computed fields are written back by validate --fix like a threat's. |
| `breaks_at` | array of `CTL-0000` to `CTL-9999` (unique) |  | Controls that cut the chain (current or planned), by id. A mitigated path needs one that is implemented or verified. |
| `mitre_attack` | array of string matching `^T[0-9]{4}(\.[0-9]{3})?$` (unique) |  | ATT&CK technique ids used along the chain. |
| `layers` | list of names (unique) |  |  |
| `suggested` | boolean (proposed by the skill, not yet confirmed) |  |  |
| `suggested_from` | text: card id or source |  |  |

## scenario

<a id="scenario"></a>

Marks a tab as a what-if scenario of another tab: the same diagram with one change applied. The scenario repeats its baseline's elements, threats, controls and attack paths (the same ids are allowed between the two) plus whatever the change adds or alters; scripts/scenario.mjs prints the delta.

| Field | Type / allowed values | Required | Notes |
| - | - | - | - |
| `baseline` | name: letters, digits, `_ . -`, ≤64, unique | yes | The tab this scenario was derived from (its `name`). |
| `change` | text ≤4000 | yes | The change statement, as the user put it: "Replace the direct SQL read with a public-facing Redis cache for read-through caching." |
| `date` | date YYYY-MM-DD |  |  |
| `author` | text ≤200 |  |  |
| `assumptions` | array of text ≤200 |  |  |

## Reserved names and conventions

- `internet` is a reserved zone name: nodes with `zone: "internet"` and zones with `parent: "internet"` sit on the Internet side; it is never declared.
- Components are referenced as `node/component` in flows, steps, targets and `implemented_on`.
- Threat numbers and ids are permanent. Retire a threat (`status: "retired"`, `retired: true`, `status_reason`) instead of deleting it.
- `validate.mjs --fix` writes `risk.rating`, `risk.score` and the OWASP averages/levels from the inputs; do not hand-edit them.
- Built-in layers that need no declaration: zones, appliances, nodes, components, internet, flows-strong, flows-moderate, flows-weak, flows-unspecified, flows-blocked, flows-trust, threats, controls, labels. An element is visible when its kind layer is on and (it has no custom layers or any of them is on).
- Built-in auth types when `auth_types` is omitted: anonymous (none), password, basic, api-key (weak), ssh-key, oauth2, saml, oidc (moderate), kerberos, mfa, mtls, certificate, fido2 (phishing-resistant), managed-identity (strong). Declaring `auth_types` replaces this list.
