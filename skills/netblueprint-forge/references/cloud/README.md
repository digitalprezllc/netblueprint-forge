# Cloud service cards

When the user names a cloud service for a node, component or appliance, find its card: `aws.md`, `azure.md`, `gcp.md` (12 services each), or fall back to `generic.md`. A component that is not a cloud service (a web server, a database, a directory, a VPN gateway, a jump host, a firewall …) has its card in `../components.md`, in the same format. Card ids (`aws-s3`, `azure-app-service`, `gcp-cloud-run` …) go into `cloud.card`.

Each card has the same sections:

| Section | What it gives you |
| - | - |
| **What** | One line, so you can confirm you and the user mean the same thing |
| **Attaches to** | VPC/VNet + subnet, public endpoint, private endpoint (PrivateLink / Private Endpoint / Private Service Connect), service endpoint |
| **Default exposure** | Internet-reachable by default? Which ports/protocols? Recent default changes that older resources do not have |
| **Disable unless needed** | Legacy or insecure defaults, as **bold** ids for `cloud.disabled_protocols` (confirmed off) or `cloud.enabled_risky_protocols` (still on) |
| **Depends on** | Identity, DNS, key management, logging, and the other services it needs: propose each as a `depends_on` entry on the node (`kind`, `ref` when the provider is on the diagram) and a `dependency` flow when no flow connects them yet |
| **Ask** | The exposure questions, in order. Stop asking once the answers settle the attachment and exposure |
| **Propose** | Zones, nodes and boundary appliances to add, with suggested types |
| **Threats** | Each with STRIDE, `vulnerability.category`, CWE / ATT&CK / OWASP refs and the control that addresses it, ready to pre-fill as `suggested` |

## Rules

1. Everything you add from a card is `suggested: true` with `suggested_from: "<card id>"` until the user confirms it. Say what you added and why.
2. Internet-routed services go on the Internet side with the provider's public endpoint as the node; private-only services go inside the VPC/VNet zone. "Hybrid" (public endpoint kept open next to a private endpoint) is itself a finding to raise.
3. Each **enabled_risky_protocols** entry becomes a suggested threat: exposed management plane → elevation-of-privilege / `security-misconfiguration`; public data access → information-disclosure / `security-misconfiguration`; weak TLS or plaintext → `missing-or-weak-encryption`; shared keys / SAS / function keys in apps → `credential-exposure`.
4. The caller's identity from the card ("managed identity", "workload identity", "service account") goes into the flow's `auth` and `authentication.client.method`; stored secrets go into `credential_storage`.
5. A service the catalogue does not have: if your tool can search the web, research it (provider docs first, then CIS Benchmarks and the provider's security baseline), record the sources in `provenance.references`, and proceed as if it were a card. Otherwise use `generic.md`.
6. Never put live-fetched content into the rendered HTML as a dependency. Text only.

Background and sources: `docs/research/cloud-service-catalogue.md` in the repository.

## Icons

Every card carries an **Icon** line, the vendor's official icon for that service (`azure/key-vaults`, `aws/lambda`, `gcp/cloud-sql`). A node whose `cloud.card` names the card shows that icon on the page automatically; set `icon` only to choose another. For a service without a card, `node scripts/icons.mjs search "<service>"` finds the id to put in `icon`. The icons are the vendors' and are used under their terms (`THIRD-PARTY-NOTICES.md`): only on the product they depict, never altered.
