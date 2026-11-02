# references/

Loaded on demand by `SKILL.md`. Keep each file focused; the agent reads only what the current workflow needs.

| File | Purpose | Status |
| - | - | - |
| `interview.md` | The guided interview, section by section: what to ask, what to write, when to validate and render | done |
| `model-reference.md` | Every model field, allowed values, rules. **Generated** from the schema by `scripts/model-reference.mjs`; regenerate after any schema change | generated |
| `threats.md` | Threat questions in order, option lists, ids and numbers, controls, adversary prompts, how threats appear | done |
| `risk-scoring.md` | The method comparison to read to the user, both methods' tables, the band mapping, residual risk and overrides | done |
| `layout-hints.md` | How the canvas is built and every hint by name | done |
| `revise-and-archive.md` | Archive → edit by name → validate → build → log the diff; the rules | done |
| `render.md` | Commands, reading validator output, what the diagram offers, the layout checklist, fixes | done |
| `icons.md` | Icon names, what they depict, defaults by type; the vendor icon library (`provider/id`, cards, aliases, the vendors' rules); product logos fetched on demand (`dashboard/<name>`, `icons.json` beside the model) | done; vendor icons and product logos 2026-11-01 |
| `what-if.md` | Mode B: derive a scenario tab from a baseline, apply the change, re-run threats and attack paths, print the delta with `scenario.mjs`, promote or drop it | done 2026-10-25 |
| `ingest.md` | Mode A from files: map Terraform / Bicep / CloudFormation / Kubernetes / OpenAPI / design documents onto zones, appliances, nodes and flows, all `suggested` until confirmed | done 2026-10-25 |
| `cloud/README.md` | How to use a service card | done |
| `cloud/generic.md` | Fallback questions for any cloud service | done |
| `cloud/aws.md`, `cloud/azure.md`, `cloud/gcp.md` | 12 cards per provider: compute, storage, databases, serverless, Kubernetes, messaging, secrets/keys, edge/WAF, admin brokers | done 2026-10-24 |
