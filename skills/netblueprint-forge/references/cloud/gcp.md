# Google Cloud service cards

Same format as `aws.md`. Bold tokens are the ids for `cloud.disabled_protocols` / `enabled_risky_protocols`. Everything proposed is `suggested: true` until confirmed.

---

## `gcp-compute-engine` — Compute Engine (virtual machines)
- **Icon:** `gcp/compute-engine`
- **What:** VMs in a VPC subnet with firewall rules and service accounts.
- **Attaches to:** VPC + regional subnet; optional external IP; VPC firewall rules (tags / service accounts); Cloud NAT for private egress; Private Google Access for Google APIs.
- **Default exposure:** the default network ships with permissive rules (`default-allow-ssh/rdp` from anywhere); custom networks deny inbound. The metadata server (169.254.169.254) needs the `Metadata-Flavor: Google` header.
- **Disable unless needed:** **external-ip**, **ssh-from-internet**, **rdp-from-internet**, **default-network**, **project-wide-ssh-keys** (use OS Login), **legacy-metadata-endpoints**, **default-compute-service-account** (with Editor), **serial-port-access**, **smbv1**, **tls1.0**, **tls1.1**.
- **Depends on:** IAM service account per VM with scopes/roles, OS Login, IAP TCP forwarding (admin), Cloud KMS (CMEK), Cloud Logging / Ops Agent, OS Config (patching), Shielded VM.
- **Ask:** External IP? Firewall sources for 22/3389? OS Login + IAP instead of exposed SSH? Which service account and roles? Patching via OS Config? Shielded VM / disk CMEK?
- **Propose:** zone `vpc` › `subnet`; node `server` with `profile`; firewall rules as an appliance (`type: firewall`); IAP as an Internet-side `service` node with the admin flow; blocked direct SSH flow.
- **Threats:** SSH/RDP open to the Internet · Elevation of privilege · `security-misconfiguration` · T1133 · control: IAP TCP forwarding + firewall from IAP range only ‖ SSRF to metadata server steals service-account token · Elevation of privilege · `ssrf` · T1552.005 · control: least-privilege SA, block metadata from app, no legacy endpoints ‖ Default SA with Editor role · Elevation of privilege · `privilege-escalation` · control: dedicated SA, minimal roles ‖ Unpatched images · Elevation of privilege · `vulnerable-components` · control: OS Config patch policy.

## `gcp-cloud-storage` — Cloud Storage (buckets)
- **Icon:** `gcp/cloud-storage`
- **What:** Object storage.
- **Attaches to:** Global public endpoint; Private Google Access / Private Service Connect from VPCs; VPC Service Controls perimeters.
- **Default exposure:** private unless an IAM binding grants `allUsers` / `allAuthenticatedUsers`; secure-by-default posture enforces public access prevention and uniform bucket-level access (no per-object ACLs). Older buckets may use fine-grained ACLs.
- **Disable unless needed:** **public-access** (public access prevention enforced), **fine-grained-acls** (uniform bucket-level access), **allauthenticatedusers**, **http** (clients should use HTTPS; signed URLs over HTTPS), **versioning-off** / **retention-off** for critical data.
- **Depends on:** IAM, Cloud KMS (CMEK), Cloud Audit Logs (data access), VPC Service Controls.
- **Ask:** Anything meant to be public? Public access prevention and uniform access on? Who reads/writes (service accounts)? CMEK? Versioning / retention lock? Inside a VPC Service Controls perimeter?
- **Propose:** node `storage`; flows from workloads `auth: workload-identity` / `managed-identity` (service account); blocked anonymous read.
- **Threats:** Bucket granted to allUsers · Information disclosure · `security-misconfiguration` · CWE-284 · control: org policy `storage.publicAccessPrevention` ‖ Over-broad IAM at project level · Information disclosure · `unauthorized-access` · control: bucket-level least privilege ‖ Data exfiltration to another project · Information disclosure · `data-exfiltration` · control: VPC Service Controls ‖ Deletion · Denial of service · `insider-misuse` · control: versioning, retention policy.

## `gcp-cloud-sql` — Cloud SQL (PostgreSQL / MySQL / SQL Server)
- **Icon:** `gcp/cloud-sql`
- **What:** Managed relational database.
- **Attaches to:** Public IP with authorized networks and/or private IP (private services access / PSC); Cloud SQL Auth Proxy or connectors with IAM authentication.
- **Default exposure:** instances can be created with a public IP; authorized networks `0.0.0.0/0` is a common mistake. SSL is optional unless required.
- **Disable unless needed:** **public-ip**, **authorized-networks-any**, **ssl-optional** (require SSL / trusted client certs), **password-only-auth** (IAM database authentication), **cross-region-replica-public**, **tls1.0**, **tls1.1**.
- **Depends on:** IAM, Cloud SQL Auth Proxy / connectors, Cloud KMS (CMEK), Secret Manager, Cloud Audit Logs, private services access.
- **Ask:** Public or private IP? If public, which authorized networks? Connections via Auth Proxy with IAM auth? SSL required? CMEK? Backups and PITR? Admin path?
- **Propose:** node `database` in the data subnet (private IP); flows from apps with `auth: managed-identity` (IAM DB auth via proxy) or `password`; `transport.security_protocol: tls-1.2`; blocked Internet flow.
- **Threats:** Public IP with wide authorized networks · Information disclosure · `security-misconfiguration` · CWE-284 · control: private IP only, org policy restrict public IP ‖ Passwords in app config · Spoofing · `credential-exposure` · control: IAM DB auth + Secret Manager ‖ Unencrypted client connections · Information disclosure · `missing-or-weak-encryption` · control: require SSL / Auth Proxy ‖ SQL injection via the app · Tampering · `injection` · CWE-89 · control: parameterized queries.

## `gcp-cloud-run` — Cloud Run (services and jobs)
- **Icon:** `gcp/cloud-run`
- **What:** Serverless containers.
- **Attaches to:** Public `run.app` URL; ingress `all` / `internal` / `internal-and-cloud-load-balancing`; Serverless VPC Access or Direct VPC egress; behind an external HTTP(S) LB with Cloud Armor and IAP.
- **Default exposure:** URL is public when ingress is `all`; authentication is separate: `allUsers` invoker makes it anonymous, otherwise callers need an IAM-signed ID token.
- **Disable unless needed:** **allow-unauthenticated** (`allUsers` roles/run.invoker), **ingress-all** (when only internal or LB traffic is expected), **default-compute-service-account**, **secrets-in-env-vars** (mount Secret Manager), **egress-unrestricted**.
- **Depends on:** IAM (invoker), service account per service, Secret Manager, Artifact Registry (+ Binary Authorization), Cloud Load Balancing / Cloud Armor / IAP, Cloud Logging.
- **Ask:** Ingress setting? Unauthenticated invokers allowed? Fronted by a load balancer with Cloud Armor / IAP? Which service account? Secrets via Secret Manager? Image provenance (Binary Authorization)?
- **Propose:** node `service` (`icon: container`); the LB / Cloud Armor as an Internet-side node or `waf` appliance; flows caller → service (`auth: bearer-token-oauth2` ID token, or `none` when unauthenticated → weak); egress flows via VPC connector.
- **Threats:** Service invokable anonymously · Spoofing · `broken-authentication` · CWE-306 · control: remove allUsers, require ID tokens / IAP ‖ Direct URL bypasses Cloud Armor · Tampering · `security-misconfiguration` · control: ingress internal-and-cloud-load-balancing ‖ Secrets in environment variables · Information disclosure · `credential-exposure` · control: Secret Manager volumes ‖ Over-privileged runtime SA · Elevation of privilege · `privilege-escalation` · control: dedicated SA, least privilege.

## `gcp-cloud-functions` — Cloud Run functions (Cloud Functions)
- **Icon:** `gcp/cloud-functions`
- **What:** Event-driven functions (now on the Cloud Run platform).
- **Attaches to:** HTTPS endpoint or event triggers (Pub/Sub, Storage, Eventarc); ingress settings as Cloud Run.
- **Default exposure:** HTTP functions need `roles/cloudfunctions.invoker` / `run.invoker`; `allUsers` makes them public.
- **Disable unless needed:** **allow-unauthenticated**, **ingress-all**, **default-service-account**, **secrets-in-env-vars**, **egress-unrestricted**.
- **Depends on:** IAM, Eventarc / Pub/Sub, Secret Manager, VPC connector, Cloud Logging.
- **Ask:** Trigger type? Invoker bindings? Ingress? Service account and roles? Secrets source?
- **Propose:** node `service` (`icon: function`); flows from triggers; downstream flows with `auth: workload-identity`.
- **Threats:** Public HTTP function · Spoofing · `broken-authentication` · control: IAM invoker ‖ Event payload injection · Tampering · `improper-input-validation` · control: schema validation ‖ Over-privileged SA · Elevation of privilege · `privilege-escalation` · control: least privilege.

## `gcp-gke` — Google Kubernetes Engine
- **Icon:** `gcp/gke`
- **What:** Managed Kubernetes (Standard / Autopilot).
- **Attaches to:** Control plane endpoint public (authenticated) or private; authorized networks; nodes in a VPC subnet (VPC-native); ingress via GCLB.
- **Default exposure:** public control-plane endpoint unless private cluster / authorized networks; legacy ABAC off by default; Autopilot enforces Workload Identity and Shielded nodes.
- **Disable unless needed:** **public-control-plane**, **legacy-metadata-endpoints**, **node-sa-default-editor**, **public-load-balancer-services**, **basic-auth-client-certs** (disabled on new clusters), **privileged-pods**.
- **Depends on:** IAM + Workload Identity Federation for GKE, Artifact Registry + Binary Authorization, Cloud KMS (secrets encryption), Cloud Logging / Monitoring, Cloud Armor on ingress.
- **Ask:** Private cluster and authorized networks? Workload Identity for pods? Network policy / Dataplane V2? Ingress with Cloud Armor? Image policy? Node auto-upgrade?
- **Propose:** zone `vpc` › `subnet`; node `service` (`icon: kubernetes`); ingress as `load-balancer` / `waf` appliance; admin flow to the control plane with `auth` IAM.
- **Threats:** Exposed control plane · Elevation of privilege · `security-misconfiguration` · T1190 · control: private endpoint + authorized networks ‖ Pod steals node SA token · Elevation of privilege · `ssrf` · T1552.005 · control: Workload Identity, metadata concealment ‖ Flat pod network · Elevation of privilege · `excessive-trust-or-flat-network` · control: network policy default deny ‖ Vulnerable images · Elevation of privilege · `supply-chain` · control: Binary Authorization.

## `gcp-secret-manager-kms` — Secret Manager and Cloud KMS
- **Icon:** `gcp/secret-manager`
- **What:** Secret storage with versions and rotation reminders; key management (software, HSM, external).
- **Attaches to:** Global API endpoints; Private Google Access / PSC from VPCs; VPC Service Controls.
- **Default exposure:** IAM-controlled; project-level roles (Editor) grant far more than intended.
- **Disable unless needed:** **secrets-in-code**, **project-wide-secret-accessor**, **no-rotation**, **key-without-separation-of-duties**.
- **Depends on:** IAM, Cloud Audit Logs, VPC Service Controls, KMS key rings per environment.
- **Ask:** Which service accounts can access which secrets? Rotation? CMEK key hierarchy and who administers keys? Inside a perimeter?
- **Propose:** node `service` (`icon: key`); control flows from workloads `auth: workload-identity`; set consumers' `credential_storage: cloud-key-vault`.
- **Threats:** Secret accessible to broad roles · Information disclosure · `unauthorized-access` · control: per-secret IAM ‖ Static secrets never rotated · Spoofing · `credential-exposure` · control: rotation schedule ‖ Key admin equals key user · Information disclosure · `privilege-escalation` · control: separate admin and encrypter/decrypter roles.

## `gcp-external-lb-cloud-armor` — External HTTP(S) Load Balancer with Cloud Armor (and IAP)
- **Icon:** `gcp/cloud-load-balancing`
- **What:** Global L7 entry point with WAF (Cloud Armor), optional Identity-Aware Proxy.
- **Attaches to:** Internet anycast IP; back ends (instance groups, NEGs for Cloud Run / GKE / on-prem).
- **Default exposure:** public; back ends remain directly reachable unless they only accept the LB (Cloud Run ingress setting, firewall from LB ranges).
- **Disable unless needed:** **http-frontend** (redirect to HTTPS), **tls1.0**, **tls1.1** (SSL policy MODERN/RESTRICTED), **no-cloud-armor**, **backend-directly-reachable**, **iap-off** (for internal apps published externally).
- **Depends on:** Google-managed certificates, Cloud Armor policies, IAP + Identity (Google / Workforce Identity Federation), Cloud Logging.
- **Ask:** Cloud Armor policy (preconfigured WAF rules, rate limiting, adaptive protection)? SSL policy? IAP in front of internal apps? Back ends locked to the LB?
- **Propose:** Internet-side `public-endpoint` node with `waf` appliance; flows viewer → LB → back end; blocked direct-to-back-end flow.
- **Threats:** Web attacks reach back ends · Tampering · `injection` · control: Cloud Armor preconfigured WAF rules ‖ Back-end bypass · Information disclosure · `security-misconfiguration` · control: firewall from LB ranges / Cloud Run ingress ‖ L7 DoS · Denial of service · `resource-exhaustion` · control: rate limiting + adaptive protection ‖ Internal app published without identity · Spoofing · `broken-authentication` · control: IAP.

## `gcp-pubsub` — Pub/Sub (messaging)
- **Icon:** `gcp/pubsub`
- **What:** Global pub/sub messaging.
- **Attaches to:** Global API endpoint; Private Google Access; VPC Service Controls.
- **Default exposure:** IAM-controlled; `allUsers` publisher/subscriber bindings make topics public.
- **Disable unless needed:** **allusers-bindings**, **unauthenticated-push-endpoints** (push with OIDC token), **no-dead-letter-topic**, **cmek-off** for sensitive data.
- **Depends on:** IAM, Cloud KMS, push endpoints (Cloud Run), Cloud Logging.
- **Ask:** Publishers and subscribers (service accounts)? Push endpoints authenticated with OIDC tokens? Message contents? Retention and dead-letter?
- **Propose:** node `service` (`icon: queue`); flows with `connection.type: message-queue`, `auth: workload-identity`.
- **Threats:** Public topic accepts injected messages · Tampering · `unauthorized-access` · control: IAM per principal ‖ Push endpoint accepts unauthenticated posts · Spoofing · `broken-authentication` · control: OIDC push auth ‖ Poison messages · Denial of service · `improper-input-validation` · control: validation + dead-letter topic.

## `gcp-bigquery` — BigQuery (analytics warehouse)
- **Icon:** `gcp/bigquery`
- **What:** Serverless data warehouse.
- **Attaches to:** Global API; Private Google Access; VPC Service Controls perimeter.
- **Default exposure:** IAM-controlled; dataset sharing with `allAuthenticatedUsers` / public domains is a common leak; authorized views and row/column policies refine access.
- **Disable unless needed:** **allauthenticatedusers-datasets**, **public-datasets** (when unintended), **cmek-off** for regulated data, **no-column-level-security** for PII.
- **Depends on:** IAM, Data Catalog policy tags, Cloud KMS, Cloud Audit Logs, VPC Service Controls.
- **Ask:** Who queries which datasets? Row/column-level security for PII? Exports allowed to where? Perimeter?
- **Propose:** node `database` (`data_classification` per content); flows from analysts/services `auth: workload-identity` or user identity with MFA.
- **Threats:** Dataset shared too widely · Information disclosure · `unauthorized-access` · control: dataset-level IAM, policy tags ‖ Exfiltration via export · Information disclosure · `data-exfiltration` · control: VPC Service Controls ‖ PII visible in analytics · Information disclosure · `sensitive-data-exposure` · control: column-level security / masking.

## `gcp-iap` — Identity-Aware Proxy (TCP forwarding and HTTPS resources)
- **Icon:** `gcp/beyondcorp`
- **What:** Identity-based access to VMs (SSH/RDP tunnels) and web apps without public exposure.
- **Attaches to:** Google front end; TCP forwarding reaches VMs through firewall rules from `35.235.240.0/20`; HTTPS IAP sits on the external LB.
- **Default exposure:** nothing until IAM `IAP-secured Tunnel User` / `IAP-secured Web App User` is granted.
- **Disable unless needed:** **direct-ssh-rdp** (firewall should allow only the IAP range), **broad-iap-bindings** (project-wide tunnel users), **context-unaware-access** (use access levels / device policy).
- **Depends on:** IAM, Access Context Manager (BeyondCorp), OS Login, Cloud Audit Logs.
- **Ask:** Which users/groups have tunnel or web-app access? Access levels (device, IP, MFA)? Firewall restricted to the IAP range? OS Login enforced?
- **Propose:** Internet-side node `service` (`icon: lock`) "IAP"; admin flow user → IAP (`auth` Google identity + MFA) → VM (`protocol: SSH/RDP`); blocked direct SSH flow.
- **Threats:** Firewall still allows direct SSH · Elevation of privilege · `security-misconfiguration` · control: allow IAP range only ‖ Over-broad tunnel grants · Elevation of privilege · `unauthorized-access` · control: per-instance / group bindings ‖ Stolen Google session · Spoofing · `broken-authentication` · control: MFA + access levels.

## `gcp-memorystore` — Memorystore (Redis / Valkey / Memcached)
- **Icon:** `gcp/memorystore`
- **What:** Managed in-memory cache.
- **Attaches to:** Private IP in a VPC (private services access / PSC); no public endpoint.
- **Default exposure:** reachable from the whole authorized VPC unless AUTH and in-transit encryption are enabled.
- **Disable unless needed:** **no-auth**, **in-transit-unencrypted**, **vpc-wide-reachability** (restrict with firewall / PSC).
- **Depends on:** VPC, Cloud KMS (CMEK where supported), Secret Manager (AUTH string), Cloud Logging.
- **Ask:** AUTH enabled? TLS in transit? Which subnets can reach it? Contents (sessions, tokens)?
- **Propose:** node `service` (`icon: cache`); flows from apps `auth: password` (AUTH) with `transport.security_protocol: tls-1.2`.
- **Threats:** Unauthenticated cache readable from the VPC · Information disclosure · `broken-authentication` · control: AUTH + firewall ‖ Session tokens exposed · Spoofing · `sensitive-data-exposure` · control: TLS, short TTL ‖ Cache poisoning · Tampering · `unauthorized-access` · control: AUTH, least-privilege clients.
