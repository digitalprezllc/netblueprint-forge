# Changelog

Releases of NetBlueprint Forge, newest first. The release number is the skill's `metadata.version` in `skills/netblueprint-forge/SKILL.md`; the renderer carries its own version inside the template. Every merge to `master` that raises the skill version publishes `netblueprint-forge-<version>.zip` on the Releases page with that version's section below as its notes. `node platforms/package.mjs` builds the same archive locally.

## Unreleased

Nothing yet.

## 0.6.1 (2026-10-25)

First published release. Renderer 1.7.1.

- The interview, section by section, with its references: threats and controls, risk scoring (Likelihood × Impact, OWASP Risk Rating, CVSS), what-if scenarios, ingest from infrastructure code and OpenAPI, revise-and-archive, layout hints, render, icons, the generated model reference, and 36 cloud service cards for AWS, Azure and GCP.
- The context model: JSON Schema (draft 2020-12), the validator with its cross-reference lint and `--fix`, Title Case labels, arrows that leave the initiator, data classification on every flow, remediation on every open threat, attack paths with permanent numbers, what-if tabs that may repeat their baseline's ids.
- The renderer: layout with centre-line locking, the orthogonal visibility-graph router with a written precedence, the page's own geometry check, multi-tab documents with one Threat Register, floating Layers and Attributes cards, hover bubbles, attack paths walked as a red phase with hop markers, What-If tags and banners, deep links to a tab, a step or a hop, the title-block signature footer.
- The scripts: validate, build, archive, normalize, scenario (what-if delta), check (headless geometry check in any Chromium on the machine), screenshot (PNG of one view, whole page at natural size), model-reference, and this packager.
- Three examples rendered from their models: Entra Application Proxy, Azure hub-spoke with a Baseline and a What-If tab, Partner Portal on two tabs; pictures of them in the README.
- Checks: the validator suite, the schema check and the headless layout check with a crossings-and-bends baseline, run by CI on `develop` and `master`.
- License: PolyForm Noncommercial 1.0.0 with DigitalPrez's additional terms (output exception, commercial licenses per organization, trademarks, notices).
