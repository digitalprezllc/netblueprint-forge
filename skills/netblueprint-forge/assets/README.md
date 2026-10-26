# assets/

| Path | Purpose | Status |
| - | - | - |
| `schema/netblueprint.schema.json` | JSON Schema (draft 2020-12) for the context model. Uses `unevaluatedProperties`, `if/then` and patterns; cross-references are checked by `scripts/validate.mjs` | done 2026-10-23; checked with `tests/check_schema.py` |
| `template/template.html` | The renderer (renderer version 0.1.0). Computes layout (zone tree with outer margins for boundary bars, host containers, Internet column), routes flows orthogonally (ports per box side, shared pass-through ports on appliances, lane channels, obstacle detours along corridors, a lane-spread pass for collinear segments), draws auth badges, threat markers, control badges, legend, signature block, layer panel, severity filter, register, collapsible band, step engine, zoom/pan. `window.__nb` exposes routes and collision counts for checks | done 2026-10-23 |
| `icons/icons.json` | SVG path registry keyed by icon name | to do |
| `examples/entra-app-proxy.model.json` | Primary worked example: Entra Application Proxy publishing an internal portal (Contoso), with service profiles, flow detail, as-is / future controls and out-of-scope elements. Source of truth is `examples/entra-app-proxy/` at the repo root | done 2026-10-24 |
| `examples/azure-hub-spoke.model.json` | Second example: Microsoft hub-spoke + App Service baseline (busier). Source of truth is `examples/azure-hub-spoke/` | done 2026-10-23 |
