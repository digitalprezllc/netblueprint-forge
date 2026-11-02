# Azure service cards

Same format as `aws.md`. Bold tokens are the ids for `cloud.disabled_protocols` / `enabled_risky_protocols`. Everything proposed is `suggested: true` until confirmed.

---

## `azure-vm` — Azure Virtual Machines
- **Icon:** `azure/virtual-machine`
- **What:** VMs in a VNet subnet with NSGs.
- **Attaches to:** VNet + subnet; optional public IP; NSG on NIC and/or subnet; egress via NAT Gateway, Azure Firewall or default outbound (being retired for new subnets).
- **Default exposure:** NSG default rules deny inbound from the Internet; a public IP exposes whatever the NSG allows. The Azure IMDS (169.254.169.254) requires the `Metadata: true` header and is not routable, but SSRF with header control can still reach it.
- **Disable unless needed:** **public-ip**, **rdp-from-internet**, **ssh-from-internet**, **smbv1**, **tls1.0**, **tls1.1**, **basic-auth-winrm**, **default-outbound-access**.
- **Depends on:** managed identity, Key Vault (disk encryption keys, certificates), Azure Monitor agent / Log Analytics, Update Manager, Bastion, Defender for Servers.
- **Ask:** Public IP? NSG rules and sources? Admin via Bastion, JIT access, or direct RDP/SSH? Managed identity used instead of stored credentials? Disk encryption (SSE with CMK / host encryption)? Patching via Update Manager? Domain-joined?
- **Propose:** zone `vpc` (VNet) › `subnet`; node `server` with `profile`; NSG as an appliance (`type: firewall`, label "NSG"); Bastion as a node in its own subnet with the admin flow; blocked `rdp-from-internet` flow.
- **Threats:** RDP/SSH exposed to the Internet · Elevation of privilege · `security-misconfiguration` · T1133 · control: no inbound NSG rule, Bastion / JIT ‖ SSRF reaches IMDS managed-identity token · Elevation of privilege · `ssrf` · T1552.005 · control: egress allow-list, least-privilege identity ‖ Unpatched OS · Elevation of privilege · `vulnerable-components` · control: Update Manager SLA ‖ Credentials in custom script / extensions · Information disclosure · `credential-exposure` · CWE-798 · control: Key Vault references.

## `azure-storage` — Azure Storage account (blob, file, queue, table)
- **Icon:** `azure/storage-accounts`
- **What:** Object, file and queue storage.
- **Attaches to:** Public endpoint per service; private endpoints per sub-service; service endpoints; firewall with allow-listed VNets/IPs.
- **Default exposure:** public endpoint reachable, but anonymous blob access is prohibited by default on new accounts; Shared Key is enabled unless disabled.
- **Disable unless needed:** **anonymous-blob-access** (`allowBlobPublicAccess=false`), **shared-key-auth** (Entra RBAC only), **sas-without-expiry**, **public-network-access** (use private endpoints + firewall), **http** (require secure transfer), **tls1.0**, **tls1.1**, **cross-tenant-replication**, **soft-delete-off**.
- **Depends on:** Entra ID (RBAC), Key Vault (CMK), Private DNS zones, diagnostic settings, Defender for Storage.
- **Ask:** Anything meant to be public (static site)? Public network access, firewall, or private endpoints? Shared Key disabled / SAS policy? Secure transfer required and minimum TLS? Encryption key: Microsoft- or customer-managed? Soft delete, versioning, immutability?
- **Propose:** node `storage` with `cloud.exposure`/`endpoint` per the answer; flows with `auth: managed-identity` (RBAC) or `api-key` (SAS/Shared Key → weak); a blocked anonymous read from the bad actor.
- **Threats:** Container made public · Information disclosure · `security-misconfiguration` · CWE-284 · control: account-level disallow + policy deny ‖ Leaked SAS or account key · Spoofing · `credential-exposure` · CWE-522 · control: disable Shared Key, short SAS, rotation ‖ Public endpoint reachable from anywhere · Information disclosure · `excessive-trust-or-flat-network` · control: private endpoints + firewall ‖ Ransomware / deletion · Tampering · `insider-misuse` · control: soft delete, versioning, immutability.

## `azure-sql` — Azure SQL Database / Managed Instance
- **Icon:** `azure/sql-database`
- **What:** Managed SQL Server.
- **Attaches to:** Public endpoint with server firewall (incl. "Allow Azure services"), service endpoint, or private endpoint; Managed Instance lives in a delegated subnet.
- **Default exposure:** public endpoint exists; firewall rules decide; "Allow Azure services" opens it to all Azure tenants.
- **Disable unless needed:** **public-network-access**, **allow-azure-services**, **sql-password-auth** (Entra-only authentication), **tls1.0**, **tls1.1** (minimum TLS 1.2), **tde-off**, **auditing-off**.
- **Depends on:** Entra ID, Key Vault (TDE CMK), Private DNS, Log Analytics (auditing), Defender for SQL.
- **Ask:** Public endpoint, firewall rules, or private endpoint only? Entra-only authentication? Who connects with what identity (managed identity for apps, Entra users for DBAs)? Minimum TLS? TDE key? Auditing destination? Admin path (jump host, Bastion)?
- **Propose:** node `database` in the data subnet (private endpoint) with `data_classification`; flows from apps `auth: managed-identity`, from DBAs `auth: entra-mfa`-style custom type; blocked flow from the Internet.
- **Threats:** Server open to all Azure services / Internet · Information disclosure · `security-misconfiguration` · CWE-284 · control: private endpoint, public access off ‖ SQL logins with passwords in app settings · Spoofing · `credential-exposure` · CWE-798 · control: Entra-only auth + managed identity ‖ SQL injection via the app · Tampering · `injection` · CWE-89, A05:2025 · control: parameterized queries ‖ No audit trail · Repudiation · `insufficient-logging-monitoring` · CWE-778 · control: auditing to Log Analytics.

## `azure-app-service` — Azure App Service (web apps, APIs)
- **Icon:** `azure/app-services`
- **What:** PaaS web hosting (Windows/Linux, containers).
- **Attaches to:** Public hostname by default; inbound private endpoint; outbound regional VNet integration; access restrictions (IP / service tag / VNet rules); Application Gateway or Front Door in front.
- **Default exposure:** public endpoint; the SCM (Kudu) site is also public unless restricted; basic-auth publishing (FTP/FTPS, SCM) is disabled by default for new apps, older apps may have it on.
- **Disable unless needed:** **ftp**, **ftps**, **basic-auth** (SCM and FTP publishing credentials), **public-access** (private endpoint + access restrictions), **scm-public-access**, **http** (HTTPS only), **tls1.0**, **tls1.1**, **remote-debugging**, **client-cert-ignored** (when mTLS is intended).
- **Depends on:** Entra ID (Easy Auth / app registration), managed identity, Key Vault references, App Insights / Log Analytics, Application Gateway WAF or Front Door, Private DNS.
- **Ask:** Reached directly or only through App Gateway / Front Door (and is direct access blocked)? Private endpoint and VNet integration? Authentication: Easy Auth / app code / none? FTP and basic auth off? HTTPS only and TLS 1.2+? Secrets via Key Vault references and managed identity? Deployment method (pipeline identity vs publishing profile)?
- **Propose:** node `host` (`icon: cloud`) with components per app (`web-server`, `api`); the front door as an Internet-side node or `waf` appliance; flows client → front door → app (`transport` end-to-end TLS); app → SQL / Key Vault with `auth: managed-identity`; blocked direct-to-app flow when access restrictions deny it.
- **Threats:** Direct access bypasses the WAF · Tampering · `security-misconfiguration` · control: access restrictions allow only the front door ‖ Publishing credentials leaked · Spoofing · `credential-exposure` · CWE-522 · control: basic auth off, pipeline identity ‖ SSRF to IMDS token · Elevation of privilege · `ssrf` · CWE-918 · control: least-privilege identity, egress allow-list ‖ Secrets in app settings · Information disclosure · `credential-exposure` · control: Key Vault references ‖ Legacy TLS / FTP · Information disclosure · `missing-or-weak-encryption` · control: HTTPS-only, TLS 1.2+, FTP off.

## `azure-functions` — Azure Functions
- **Icon:** `azure/function-apps`
- **What:** Serverless functions on App Service infrastructure (Consumption / Flex / Premium).
- **Attaches to:** Public hostname; HTTP triggers at `/api/*`; private endpoint and VNet integration on Flex/Premium; event triggers from Storage, Service Bus, Event Grid.
- **Default exposure:** HTTP triggers with authorization level `anonymous` are open; `function`/`admin` keys are shared secrets.
- **Disable unless needed:** **anonymous-http-trigger**, **function-keys-as-auth** (use Easy Auth / Entra), **basic-auth**, **ftp**, **public-access** (on plans that support private endpoints), **secrets-in-app-settings**, **tls1.0**, **tls1.1**.
- **Depends on:** Storage account (host), managed identity, Key Vault references, Entra ID, App Insights, Event Grid / Service Bus.
- **Ask:** Which triggers? For HTTP: auth level and whether Easy Auth is on? Networking: public, private endpoint, VNet integration? Host storage account locked down (identity-based connections)? Secrets source?
- **Propose:** node `service` (`icon: function`); flows from triggers; host storage as a `storage` node with a control flow; downstream flows with `auth: managed-identity`.
- **Threats:** Anonymous HTTP trigger · Spoofing · `broken-authentication` · CWE-306 · control: Easy Auth / Entra ‖ Function key leak · Spoofing · `credential-exposure` · control: identity-based auth, rotation ‖ Host storage account exposed · Information disclosure · `security-misconfiguration` · control: identity-based connections, private endpoint ‖ Over-permissive identity · Elevation of privilege · `privilege-escalation` · control: least-privilege RBAC.

## `azure-aks` — Azure Kubernetes Service
- **Icon:** `azure/kubernetes-services`
- **What:** Managed Kubernetes.
- **Attaches to:** API server public (authenticated) or private cluster / API Server VNet Integration; nodes in a VNet subnet; Azure CNI or overlay; ingress via Application Gateway for Containers / NGINX + public LB.
- **Default exposure:** public API server unless private; `LoadBalancer` services get public IPs by default.
- **Disable unless needed:** **public-api-server**, **local-accounts** (Entra + Azure RBAC only), **public-load-balancer-services**, **imds-reachable-from-pods** (use Workload Identity, block IMDS via network policy), **privileged-pods**, **default-namespace-wildcards**.
- **Depends on:** Entra ID (Workload Identity, cluster RBAC), ACR, Key Vault CSI driver, Azure Policy for AKS, Defender for Containers, Log Analytics.
- **Ask:** Private cluster or authorized IP ranges? Entra + Azure RBAC, local accounts disabled? How do pods get Azure credentials (Workload Identity)? Ingress and WAF? Network policies? Image registry and scanning?
- **Propose:** zone `vpc` › `subnet`; node `service` (`icon: kubernetes`) with workloads as components; ingress as `load-balancer` / `waf` appliance; admin flow to the API server with `auth` Entra.
- **Threats:** Exposed API server · Elevation of privilege · `security-misconfiguration` · T1190 · control: private cluster / authorized IPs ‖ Pod steals node identity via IMDS · Elevation of privilege · `ssrf` · T1552.005 · control: Workload Identity + block IMDS ‖ Flat pod network · Elevation of privilege · `excessive-trust-or-flat-network` · control: network policy default deny ‖ Vulnerable images · Elevation of privilege · `supply-chain` · A03:2025 · control: ACR scanning, admission policy.

## `azure-key-vault` — Azure Key Vault (secrets, keys, certificates)
- **Icon:** `azure/key-vaults`
- **What:** Secret/key/certificate store (Standard, Premium HSM-backed, Managed HSM).
- **Attaches to:** Public endpoint with firewall and trusted-services bypass; private endpoint.
- **Default exposure:** public endpoint reachable, access governed by RBAC (or legacy access policies).
- **Disable unless needed:** **public-network-access**, **access-policies** (use RBAC), **soft-delete-off** / **purge-protection-off**, **trusted-services-bypass** (when not needed), **secrets-in-app-settings** elsewhere.
- **Depends on:** Entra ID, Private DNS, diagnostic logs, managed identities of consumers.
- **Ask:** RBAC or access policies? Private endpoint and public access off? Who can read which secrets (per identity)? Purge protection? Logging of secret access? Premium/HSM for signing keys?
- **Propose:** node `service` (`icon: key`) in the data/platform subnet; control flows from workloads `auth: managed-identity`; set consumers' `authentication.client.credential_storage: cloud-key-vault`.
- **Threats:** Secrets readable by too many identities · Information disclosure · `unauthorized-access` · CWE-284 · control: RBAC least privilege per secret ‖ Vault reachable from the Internet · Information disclosure · `security-misconfiguration` · control: private endpoint ‖ Accidental or malicious deletion · Denial of service · `insider-misuse` · control: soft delete + purge protection.

## `azure-app-gateway` — Application Gateway (WAF v2)
- **Icon:** `azure/application-gateways`
- **What:** Regional L7 load balancer with WAF.
- **Attaches to:** Its own subnet; public and/or private frontend; back-end pools (VMs, App Service, private endpoints).
- **Default exposure:** public frontend when a public IP is attached; HTTP listeners pass plaintext unless redirected.
- **Disable unless needed:** **http-listener**, **tls1.0**, **tls1.1** (predefined TLS policy 2022+), **waf-detection-mode** (use prevention), **backend-not-locked** (back ends should accept only the gateway), **no-end-to-end-tls**.
- **Depends on:** Key Vault (certificates), NSG on its subnet, WAF policy, diagnostic logs, back-end health probes.
- **Ask:** Public or private frontend? WAF policy mode and rule set (OWASP CRS 3.2 / DRS 2.1)? TLS policy and certificate source? End-to-end TLS to back ends? Are back ends reachable only from the gateway?
- **Propose:** appliance `type: waf` on the hub/spoke edge, or a node `service` (`icon: load-balancer`) when flows terminate there; flows client → gateway → app.
- **Threats:** Web attacks reach the app · Tampering · `injection` · A05:2025 · control: WAF prevention mode ‖ Back-end reachable around the gateway · Elevation of privilege · `security-misconfiguration` · control: back-end allows gateway subnet only ‖ Legacy TLS · Information disclosure · `missing-or-weak-encryption` · control: TLS 1.2+ policy.

## `azure-front-door` — Azure Front Door (global entry, CDN, WAF)
- **Icon:** `azure/front-door-and-cdn-profiles`
- **What:** Global anycast HTTP(S) entry point with WAF and caching.
- **Attaches to:** Internet edge; origins public or via Private Link (Premium).
- **Default exposure:** public; origins remain directly reachable unless locked (Private Link or `X-Azure-FDID` / service tag checks).
- **Disable unless needed:** **origin-directly-reachable**, **http-allowed**, **tls1.0**, **tls1.1**, **waf-detection-mode**, **no-rate-limiting**.
- **Depends on:** WAF policy, Key Vault certificates, origins (App Service, Storage, AKS ingress), diagnostic logs.
- **Ask:** Which origins and are they locked to Front Door? WAF mode and managed rules? Minimum TLS? Caching of anything sensitive?
- **Propose:** Internet-side node `public-endpoint` with `waf` appliance; flows viewer → Front Door → origin; blocked direct-to-origin flow.
- **Threats:** Origin bypass · Information disclosure · `security-misconfiguration` · control: Private Link origin / header check ‖ L7 DoS · Denial of service · `resource-exhaustion` · control: WAF rate limiting + DDoS protection ‖ Bot abuse of sign-in · Spoofing · `broken-authentication` · control: bot manager rules.

## `azure-service-bus` — Service Bus / Event Hubs (messaging)
- **Icon:** `azure/azure-service-bus`
- **What:** Enterprise messaging (queues, topics) and event streaming.
- **Attaches to:** Public namespace endpoint; private endpoint; IP firewall / VNet rules (Premium).
- **Default exposure:** public endpoint; SAS policies with `Manage` rights are common and over-broad.
- **Disable unless needed:** **public-network-access**, **local-auth** (SAS; use Entra RBAC), **root-manage-sas-in-apps**, **tls1.0**, **tls1.1**, **amqp-plain** (use AMQPS).
- **Depends on:** Entra ID, Key Vault (CMK, Premium), Private DNS, diagnostic logs.
- **Ask:** Who sends and receives, with what identity? SAS or Entra? Public or private endpoint? Message contents (PII?)? Dead-lettering?
- **Propose:** node `service` (`icon: queue`); flows producer → namespace → consumer with `connection.type: message-queue`, `auth: managed-identity`.
- **Threats:** Leaked SAS with Manage rights · Tampering · `credential-exposure` · control: Entra RBAC, local auth off ‖ Namespace reachable from the Internet · Information disclosure · `excessive-trust-or-flat-network` · control: private endpoint ‖ Poison messages · Denial of service · `improper-input-validation` · control: validation + DLQ.

## `azure-cosmos-db` — Azure Cosmos DB
- **Icon:** `azure/azure-cosmos-db`
- **What:** Globally distributed NoSQL database.
- **Attaches to:** Public endpoint with IP firewall / VNet rules; private endpoint.
- **Default exposure:** public endpoint; account keys grant full access; "Allow access from Azure portal / Azure datacenters" widen it.
- **Disable unless needed:** **public-network-access**, **key-based-auth** (`disableLocalAuth`, use Entra RBAC data plane), **allow-azure-datacenters**, **tls1.0**, **tls1.1**, **backup-periodic-short**.
- **Depends on:** Entra ID, Key Vault (CMK), Private DNS, diagnostic logs, Defender for Cosmos DB.
- **Ask:** Public or private endpoint? Keys disabled, RBAC roles per identity? Consistency and backup mode? Data classification?
- **Propose:** node `database`; flows from apps `auth: managed-identity`; blocked Internet flow when public access is off.
- **Threats:** Account key leak · Spoofing · `credential-exposure` · CWE-522 · control: local auth off, RBAC ‖ Public endpoint open · Information disclosure · `security-misconfiguration` · control: private endpoint ‖ NoSQL injection · Tampering · `injection` · CWE-943 · control: parameterized queries.

## `azure-bastion` — Azure Bastion
- **Icon:** `azure/bastions`
- **What:** Managed RDP/SSH broker over TLS 443 from the portal or native client.
- **Attaches to:** `AzureBastionSubnet` in the VNet (or peered hub); public IP on the Bastion host (Developer SKU without).
- **Default exposure:** public 443 for the Bastion service only; target VMs need no public IP.
- **Disable unless needed:** **vm-public-ips**, **nsg-rdp-ssh-from-anywhere** (allow only AzureBastionSubnet), **shareable-links** (unless intended), **copy-paste-file-transfer** (per policy).
- **Depends on:** Entra ID + Azure RBAC on target VMs, NSGs, diagnostic logs (session logs), Key Vault (SSH keys).
- **Ask:** SKU and features (native client, IP connect, session recording)? Which VMs are reachable and by which RBAC roles? NSGs on targets allow only the Bastion subnet? MFA on the portal sign-in?
- **Propose:** node `service` (`icon: lock`) in the hub; admin flow user → Bastion (`auth` Entra MFA) and Bastion → VM (`protocol: RDP/SSH`, `auth: kerberos` / `ssh-key`); blocked direct RDP flow.
- **Threats:** Target VM also reachable directly · Elevation of privilege · `security-misconfiguration` · control: NSG allows Bastion subnet only, policy denies public IPs ‖ Portal account compromise gives RDP everywhere · Spoofing · `broken-authentication` · control: phishing-resistant MFA, PIM for VM login roles ‖ No session evidence · Repudiation · `insufficient-logging-monitoring` · control: session recording / diagnostic logs.
