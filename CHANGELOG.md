# Changelog

Releases of NetBlueprint Forge, newest first. The release number is the skill's `metadata.version` in `skills/netblueprint-forge/SKILL.md`; the renderer carries its own version inside the template. Every merge to `master` that raises the skill version publishes `netblueprint-forge-<version>.zip` on the Releases page with that version's section below as its notes. `node platforms/package.mjs` builds the same archive locally, byte for byte: every entry is stamped with the date in the version's heading here, not with file times, so a version's archive has one sha256 wherever it is built (from the next release on; the two 0.7.0 archives differ only in file times).

## Unreleased

- The release archive is deterministic: `platforms/package.mjs` stamps every entry with the date of the version's section in this file (`SOURCE_DATE_EPOCH` overrides it) instead of the files' own times, so the same version gives the same bytes and the same sha256 on a developer machine and in CI. `tests/check_package.mjs` builds it twice and reads it back against the skill folder; CI runs it.
- The repository takes bug reports and feature requests through issue forms and declines pull requests; `CONTRIBUTING.md` and `SECURITY.md` say how. The workflows run on the Node 24 generation of the actions and a pinned `ubuntu-24.04` image.

## 0.7.0 (2026-11-01)

Skill 0.7.0, renderer 1.8.0. Download: [netblueprint-forge-0.7.0.zip](https://bifrost.digitalprez.com/download/netblueprint-forge/releases/netblueprint-forge-0.7.0.zip), sha256 `faf8cca44c8cc85c0dda4a575875efc3b2eaf3fcfef618d76fa9c87747831af6`.

- Vendor icons: the official Microsoft Azure (with Microsoft Entra), AWS and Google Cloud architecture icons ship with the skill as one index per provider (`assets/icons/`), imported unmodified from the vendors' packages by the new `scripts/icons.mjs`. A cloud node with a card shows its vendor icon automatically; `icon: "<provider>/<id>"` puts one on any zone, appliance, node or component; `settings.icons.vendor: false` keeps line icons. `build.mjs` embeds only the icons a page uses; the legend names the vendors; the validator and `tests/check_icons.mjs` check the references. Terms in `THIRD-PARTY-NOTICES.md`.
- The Azure examples show Azure icons on their services, VNets, subnets, firewalls, gateways and the Entra tenant.
- Two new examples, one per remaining vendor: AnyCompany on AWS (a three-tier web application in a VPC: CloudFront with WAF, ALB, EC2, RDS, Secrets Manager, S3 and CloudWatch over VPC endpoints, Session Manager; six threats and an SSRF-to-exfiltration attack path) and Cymbal on Google Cloud (a serverless web application: Cloud Armor and the external load balancer, Cloud Run, a VPC connector to Cloud SQL and Memorystore, Secret Manager, Cloud Storage, Identity-Aware Proxy, a VPC Service Controls perimeter; six threats and a dependency-compromise attack path), both with their vendor's icons, in the layout baseline and in the README with pictures.
- Product logos on demand: `icon: "dashboard/<name>"` plus `node scripts/icons.mjs fetch dashboard/<name> --model <model.json>` puts a logo from the Dashboard Icons collection (Fortinet, Palo Alto, Sophos, Check Point, Cisco, Okta and about 2,250 others) in `icons.json` beside the model; the build embeds it from there, so pages stay self-contained and the skill ships no logo. `search "<name>" --provider dashboard` finds names; a fetched SVG is refused when it carries a script, an event handler or an external reference. Terms in `THIRD-PARTY-NOTICES.md`.
- Fixed: a document without tabs now shows its attack paths (the red phase in the band, the paths in the Threat Register, the `#path=` deep link). Renderer 1.7.1 dropped them when the model kept `attack_paths` at the top level instead of on a tab.

## 0.6.1 (2026-10-25)

First published release. Renderer 1.7.1. Download: [netblueprint-forge-0.6.1.zip](https://bifrost.digitalprez.com/download/netblueprint-forge/releases/netblueprint-forge-0.6.1.zip), sha256 `6e629c5e9b0fd43594cfd4bb316abfa40f69d092fbd002ec50c11252bcc4da2c`.

- The interview, section by section, with its references: threats and controls, risk scoring (Likelihood × Impact, OWASP Risk Rating, CVSS), what-if scenarios, ingest from infrastructure code and OpenAPI, revise-and-archive, layout hints, render, icons, the generated model reference, and 36 cloud service cards for AWS, Azure and GCP.
- The context model: JSON Schema (draft 2020-12), the validator with its cross-reference lint and `--fix`, Title Case labels, arrows that leave the initiator, data classification on every flow, remediation on every open threat, attack paths with permanent numbers, what-if tabs that may repeat their baseline's ids.
- The renderer: layout with centre-line locking, the orthogonal visibility-graph router with a written precedence, the page's own geometry check, multi-tab documents with one Threat Register, floating Layers and Attributes cards, hover bubbles, attack paths walked as a red phase with hop markers, What-If tags and banners, deep links to a tab, a step or a hop, the title-block signature footer.
- The scripts: validate, build, archive, normalize, scenario (what-if delta), check (headless geometry check in any Chromium on the machine), screenshot (PNG of one view, whole page at natural size), model-reference, and this packager.
- Three examples rendered from their models: Entra Application Proxy, Azure hub-spoke with a Baseline and a What-If tab, Partner Portal on two tabs; pictures of them in the README.
- Checks: the validator suite, the schema check and the headless layout check with a crossings-and-bends baseline, run by CI on `develop` and `master`.
- License: PolyForm Noncommercial 1.0.0 with DigitalPrez's additional terms (output exception, commercial licenses per organization, trademarks, notices).
