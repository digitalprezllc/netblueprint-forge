# Ingesting architecture sources (IaC, OpenAPI, text specs)

The interview is the default way in. When the user hands you a source instead (Terraform, Bicep, ARM, CloudFormation, Kubernetes manifests, an OpenAPI document, a design document, a described network diagram), read it into a draft model and let the interview fill what the files cannot say. Everything derived from a file is a proposal: mark it `suggested: true` with `suggested_from: "<file or resource name>"`, show it, and drop `suggested` only when the user confirms it. Never invent what the source does not state (who initiates, how a call authenticates, what data it carries, which risk method): ask.

## Mapping

| Source construct | Model element | Notes |
| - | - | - |
| VPC / VNet, subnet, account or tenant boundary, Kubernetes namespace | `zones[]` nested as the source nests them (`parent`) | A subnet is `kind: "subnet"`; an account, tenant or environment boundary is a zone with `trust_boundary: true` |
| Security group, NSG, network ACL, firewall, WAF, API gateway, load balancer with rules | `zones[].appliances[]` on the edge the rules guard (`edge`, `filters`) | Paths the rules deny are worth drawing as `blocked` flows (Internet → database, RDP from the Internet) |
| VM, instance, App Service, function, container, pod, managed database, storage account, queue, secret store | `nodes[]` with `type`, `cloud { provider, service, exposure, endpoint }` and the cloud card's exposure questions (`cloud/README.md`) | Several services on one host are `components[]` of that node |
| Public IP, public endpoint, ingress, listener, `publicNetworkAccess: Enabled` | the node's `cloud.exposure: "internet"` and, when an actor reaches it, a flow from that actor | A public endpoint with no actor drawn is still a finding to raise |
| Peering, VPN, ExpressRoute / Direct Connect, private endpoint, PrivateLink | `tunnel` or `data` flows between the zones' edges; the gateway is an appliance | |
| IAM role, managed identity, service account A uses to call B | the flow's `auth` (`managed-identity`, or a declared `auth_types[]` entry) and `authentication.client.method` | Access keys and connection strings in configuration are `api-key` / `password` with `credential_storage` recorded, and a threat to raise |
| OpenAPI `servers`, `paths`, `securitySchemes` | one `api` node or component; one flow per calling client; `auth` from the scheme (`oauth2`, `oidc`, `api-key`, HTTP basic → `basic`); `data` from request and response schemas (PII fields → `data_tags`) | Routes without a security scheme are a `broken-authentication` threat |
| Logging and monitoring sinks | `control` flows to a monitoring node, `data_classification: "internal"` | |
| A sentence in a spec: "A calls B over HTTPS with a client certificate" | a flow with `protocol`, `auth: "mtls"`, `encrypted: true` | Quote the sentence in `info` so the source stays traceable |

## Order of work

1. Zones and boundaries first, then nodes with their cloud blocks, then flows (ask who initiates), then what is blocked.
2. `validate.mjs`: every reference must resolve. Build and show the draft before the threat pass.
3. Run the interview sections the source cannot answer: Section 5 for authentication and data classification, Section 6 for the story, Section 7 and 7b for threats and attack paths.
4. Record in `meta.revision_note` (or the changelog) which files were read and their version or commit.

## Limits

- Infrastructure code states intent, not reality: drift, manual rules and emergency changes are not in it. Say so in `meta.assumptions`.
- Never copy a secret found in a file into the model; record that one was present (`credential_storage: "source-code"`) and tell the user.
- A diagram image is read like a text spec: list what you see, confirm each element, then proceed as above.
