# Contoso web workload on Azure: hub-spoke with hybrid admin access

The reference example shipped with the skill. It is adapted from two public Microsoft reference architectures and uses Microsoft's sample organization, **Contoso**:

- Hub-spoke network topology in Azure: https://learn.microsoft.com/azure/architecture/networking/architecture/hub-spoke
- Baseline highly available zone-redundant web application (App Service): https://learn.microsoft.com/azure/architecture/web-apps/app-service/architectures/baseline-zone-redundant

What it shows:

- **Internet side:** a customer, an opportunistic attacker and the Entra ID tenant.
- **Azure landing zone** (one subscription) with a **hub VNet** (Application Gateway WAF, Azure Bastion, VPN/ExpressRoute gateway on the boundary) and a **spoke VNet** behind the **Azure Firewall** (boundary appliance on the spoke) with three subnets: App (App Service as a host with `web` and `api` components), Data (Azure SQL and Key Vault behind an NSG) and Management (a jump VM behind an NSG).
- **Contoso on-premises** behind an edge firewall: an administrator with a FIDO2 key and the AD DS domain controller that syncs to Entra ID.
- 17 flows covering every kind (data, control, auth, trust, blocked) and every auth strength (strong, moderate, weak, none), three of them blocked by design.
- A nine-step story in four phases (Connect, Identity, Access, Operate).
- Four **illustrative threats** and nine controls on the layer `illustrative-threats`: credential stuffing (scored with OWASP Risk Rating), SQL injection, SSRF to the instance metadata service, and NSG drift exposing RDP. They are plausible for this design, not findings; hide the layer for the plain architecture.
- Cloud fields on every Azure node (`exposure`, `endpoint`, `disabled_protocols`) as the cloud-guidance feature will prompt for them.

Files:

- `azure-hub-spoke.model.json`: the model (source of truth; a copy ships in `skills/netblueprint-forge/assets/examples/`).
- `azure-hub-spoke.html`: the rendered diagram, built with `node skills/netblueprint-forge/scripts/build.mjs examples/azure-hub-spoke/azure-hub-spoke.model.json`. Open it in any browser; it has no external dependencies.
