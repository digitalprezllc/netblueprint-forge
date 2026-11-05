# Contoso web workload on Azure: hub-spoke with hybrid admin access

The reference example shipped with the skill, on two tabs: **Baseline**, the architecture as deployed, and **What-If: Public Redis Cache**, a proposed change evaluated beside it. It is adapted from two public Microsoft reference architectures and uses Microsoft's sample organization, **Contoso**:

- Hub-spoke network topology in Azure: https://learn.microsoft.com/azure/architecture/networking/architecture/hub-spoke
- Baseline highly available zone-redundant web application (App Service): https://learn.microsoft.com/azure/architecture/web-apps/app-service/architectures/baseline-zone-redundant

What it shows:

- **Internet side:** a customer, an opportunistic attacker and the Entra ID tenant.
- **Azure landing zone** (one subscription) with a **hub VNet** (Application Gateway WAF, Azure Bastion, VPN/ExpressRoute gateway on the boundary) and a **spoke VNet** behind the **Azure Firewall** (boundary appliance on the spoke) with three subnets: App (App Service as a host with `web` and `api` components), Data (Azure SQL and Key Vault behind an NSG) and Management (a jump VM behind an NSG).
- **Contoso on-premises** behind an edge firewall: an administrator with a FIDO2 key and the AD DS domain controller that syncs to Entra ID.
- 17 flows on the Baseline tab covering every kind (data, auth, trust, dependency, blocked) and every auth strength (strong, moderate, weak, none), three of them blocked by design.
- A nine-step story in four phases (Connect, Identity, Access, Operate).
- Five **illustrative threats** and ten controls on the layer `illustrative-threats`: credential stuffing (scored with OWASP Risk Rating), SQL injection, SSRF to the instance metadata service, NSG drift exposing RDP, and saved database connections on the jump VM. They are plausible for this design, not findings; hide the layer for the plain architecture.
- **Attack path AP-0001**, exposed jump host to database exfiltration, walked as a red phase: a drifted NSG rule exposes RDP on the jump VM, a password spray lands a session, the saved SSMS connection opens the Orders database and the results leave through the RDP session.
- **The What-If tab** (`whatif-redis`, derived from `main`): the same workload with an Azure Cache for Redis in front of SQL for read-through caching, deployed as proposed with its public endpoint enabled and access-key authentication. It adds the cache and its two access-key flows, two threats (a public Redis endpoint with a shared key, cached order records bypassing SQL row-level security and auditing), three new controls (private endpoint only and Entra ID authentication with access keys disabled, both planned; caching only non-sensitive projections, proposed) and **attack path AP-0002**, leaked cache key to customer data. The Baseline tab stays untouched; `node skills/netblueprint-forge/scripts/scenario.mjs examples/azure-hub-spoke/azure-hub-spoke.model.json --tab whatif-redis` prints the delta.
- **Requirements** REQ-0001 to REQ-0003 on both tabs, each with its source, status, the threats it answers, the controls that satisfy it and framework clauses: administrative access only through Bastion (a Contoso privileged access standard, verified; NIST SP 800-53 AC-17, ISO/IEC 27001 A.8.5), customer sign-in resists credential stuffing (from the threat model, implemented; IA-2(1)) and secrets never live in app settings (from the CIS Microsoft Azure Foundations Benchmark, implemented; SC-12). The Threat Register lists them under the attack paths, with a Framework Coverage table of the clauses the model cites.
- **Dependencies as structure:** App Service depends on Entra ID (identity), Key Vault (secrets) and Log Analytics (logging, degraded without it), Azure SQL on Log Analytics, and Entra ID on AD DS through Entra Connect sync. The four flows that carry them (secrets, diagnostics, auditing, sync) are `dependency` flows, dashed on their own layer; the Attributes card lists what each element depends on and what depends on it.
- **Evidence and references on controls:** the two verified controls cite a penetration test and a configuration export; every control names the ATT&CK mitigations it applies, most the D3FEND techniques too. App Service carries `custom` metadata (a CMDB id and a service tier) as an example of fields the schema does not define.
- Cloud fields on every Azure node (`exposure`, `endpoint`, `disabled_protocols`) as the cloud-guidance feature will prompt for them.

Files:

- `azure-hub-spoke.model.json`: the model (source of truth; a copy ships in `skills/netblueprint-forge/assets/examples/`).
- `azure-hub-spoke.html`: the rendered diagram, built with `node skills/netblueprint-forge/scripts/build.mjs examples/azure-hub-spoke/azure-hub-spoke.model.json`. Open it in any browser; it has no external dependencies. `azure-hub-spoke.html#tab=whatif-redis` opens the What-If tab directly; `azure-hub-spoke.html#path=AP-0001&hop=1` opens the Baseline tab on its attack path.
