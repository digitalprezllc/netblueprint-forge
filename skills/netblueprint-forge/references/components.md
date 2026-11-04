# Component cards: the common on-premises and self-managed building blocks

Cards for the components that are not cloud services: the web server, the reverse proxy, the database, the queue, the directory, the VPN gateway, the jump host and the rest. Use one the moment a node, component or appliance is "an IIS box", "the Postgres server", "our Okta", "the FortiGate", exactly as `cloud/README.md` says to use a cloud card: run the card's questions, propose what it proposes with `suggested: true` and `suggested_from: "<card id>"`, and pre-fill its threats for the user to confirm. A node that is both a product and a cloud service (a managed PostgreSQL) takes the cloud card; a product with no card here takes `cloud/generic.md`'s questions.

Format per card: Icon · What · Attaches to · Default exposure · Disable unless needed · Depends on (the entries to propose as `depends_on`) · Ask · Propose · Threats (STRIDE · `vulnerability.category` · CWE and ATT&CK · the control, ready to pre-fill). Ids in bold are the names to use in `profile` and in notes. Sources: the vendors' hardening guides, the CIS Benchmarks and ATT&CK; `scripts/suggest.mjs` raises the generic cases (weak auth, plaintext, unguarded crossings, end-of-life platforms) by rule, so a card lists what is specific to the component.

---

## `web-server` — Web server (IIS, nginx, Apache, Tomcat front end)
- **Icon:** `server` (component type `web-server`)
- **What:** Serves pages and static content; terminates TLS; often fronts an application server.
- **Attaches to:** A DMZ or web tier, behind a reverse proxy, load balancer or WAF; listens on 443 (80 only to redirect).
- **Default exposure:** Internet-facing when published; default pages, server banners, directory listing and sample applications ship enabled on most distributions.
- **Disable unless needed:** **http-listener** (redirect only), **directory-listing**, **server-banner**, **default-pages**, **trace-method**, **weak-ciphers**, **tls-1.0-1.1**, **webdav**, **cgi**.
- **Depends on:** `pki` (certificates), `dns`, `logging` (access and error logs to the SIEM), `identity` when it authenticates users itself, `time`.
- **Ask:** What sits in front (WAF, proxy)? Which TLS versions and ciphers? Where do access logs go? Does it run as a low-privilege account? Is the application on the same host (then a component) or behind it (then a flow)?
- **Propose:** node `server` in the DMZ with a `web-server` component; an appliance of type `waf` or `reverse-proxy` on the zone edge when one exists; `data` flows from users with the real `auth`; `dependency` flows to the certificate authority and the log collector.
- **Threats:** Request smuggling or header injection through the front end · Tampering · `improper-input-validation` · CWE-444, T1190 · control: one HTTP parser (same proxy and server versions), WAF rules for smuggling, strict header normalisation ‖ Path traversal or misconfigured virtual directory exposes files · Information disclosure · `security-misconfiguration` · CWE-22, T1083 · control: web root isolated, no symlink following, directory listing off, hardening baseline verified ‖ Denial of service by slow or oversized requests · Denial of service · `resource-exhaustion` · CWE-400, T1499 · control: request and header limits, connection timeouts, rate limiting at the proxy or WAF.

## `reverse-proxy` — Reverse proxy or load balancer (nginx, HAProxy, F5, Citrix ADC, Traefik)
- **Icon:** `load-balancer` (appliance type `reverse-proxy` or `load-balancer`)
- **What:** Terminates client connections, routes them to back ends, often adds authentication, TLS and rate limiting.
- **Attaches to:** The zone edge between users and the web or application tier; it is an appliance of that zone.
- **Default exposure:** Internet-facing by design; the management interface is a second, more dangerous listener.
- **Disable unless needed:** **management-on-data-interface**, **default-admin-account**, **http-backend** (re-encrypt to back ends), **open-proxy-rules**, **x-forwarded-for-trust-all**, **weak-ciphers**.
- **Depends on:** `pki`, `dns`, `identity` when it pre-authenticates users, `logging`, `monitoring` (health checks).
- **Ask:** Does it re-encrypt to the back end? Does it authenticate users (then an `auth` flow to the IdP)? Where is management reachable from? Is the back-end trust based on the proxy's source address alone?
- **Propose:** appliance `reverse-proxy` (or `load-balancer`) with `edge: left`, `filters: inbound`; a `control` or `dependency` flow from administrators through the management network; `encrypted: true` on the back-end flows.
- **Threats:** Back end trusts the proxy's source address and is reached directly · Spoofing · `excessive-trust-or-flat-network` · CWE-290, T1090 · control: mTLS or a shared secret header between proxy and back end; back-end security group admits only the proxy ‖ Management interface exposed to users or the Internet · Elevation of privilege · `security-misconfiguration` · CWE-284, T1133 · control: management on a dedicated interface and network, MFA, allow-list ‖ Open or misrouted proxy rule relays to internal services · Elevation of privilege · `ssrf` · CWE-918, T1090.001 · control: explicit route table, no wildcard upstreams, egress filtering from the proxy.

## `app-server` — Application server (.NET, Java, Node, Python runtimes)
- **Icon:** `server` (component type `app-server` or `api`)
- **What:** Runs the application code; holds the connection strings, keys and tokens the application uses.
- **Attaches to:** An application tier behind the web tier; talks to the database, the cache, the queue, the identity provider and third-party APIs.
- **Default exposure:** Private; exposed indirectly through the web tier and through any debug, metrics or management endpoint it opens.
- **Disable unless needed:** **debug-endpoints**, **remote-debugging**, **actuator-or-admin-endpoints**, **stack-traces-to-clients**, **sample-apps**, **jmx-or-rmi**, **outbound-unrestricted**.
- **Depends on:** `secrets` (connection strings, API keys), `identity` (token validation), `database`, `messaging`, `logging`, `package-registry` (build-time), `pki`.
- **Ask:** Where do its secrets live? Does it run as its own low-privilege identity? Which outbound destinations does it need (egress allow-list)? Is dependency scanning in the pipeline? Does it validate tokens with the IdP's keys?
- **Propose:** node `host` with `app-server`/`api` components; `data` flows to the database with the real `auth`; a `dependency` flow to the vault; `profile.software` with sourcing and SBOM; `depends_on` for secrets and identity.
- **Threats:** Server-side request forgery from a URL the application fetches · Elevation of privilege · `ssrf` · CWE-918, T1190 · control: allow-list of outbound destinations, no fetches of user-supplied URLs without validation, egress filtering ‖ Compromised dependency runs with the application's identity · Tampering · `supply-chain` · CWE-1357, T1195.001 · control: pinned, scanned dependencies from an internal registry; signed builds; least-privilege runtime identity ‖ Secrets in configuration files or environment variables · Information disclosure · `credential-exposure` · CWE-798, T1552.001 · control: vault or managed identity; no secrets in the image or the repository; rotation.

## `api-gateway` — API gateway (Kong, Apigee on-prem, Azure APIM self-hosted, NGINX Plus, Tyk)
- **Icon:** `api` (appliance type `api-gateway`)
- **What:** Fronts APIs with authentication, schema validation, rate limiting and routing.
- **Attaches to:** The zone edge between API consumers and the services; an appliance.
- **Default exposure:** Internet-facing when the APIs are; its admin API and developer portal are separate listeners.
- **Disable unless needed:** **admin-api-on-data-plane**, **anonymous-routes**, **wildcard-cors**, **request-size-unlimited**, **deprecated-api-versions**.
- **Depends on:** `identity` (token introspection, JWKS), `pki`, `logging`, `monitoring`, `secrets` (upstream credentials).
- **Ask:** Which routes are anonymous and why? Are tokens validated at the gateway or only upstream? Is there a schema (OpenAPI) enforced? Rate limits per consumer? Where is the admin API reachable?
- **Propose:** appliance `api-gateway` with `filters: inbound`; one flow per consumer with `auth` `oauth2` or `oidc`; `encrypted: true` upstream; an `auth` flow to the IdP for introspection.
- **Threats:** Broken object-level authorisation passes the gateway unseen · Elevation of privilege · `unauthorized-access` · CWE-639, T1190 · control: object ownership checks in the service; gateway enforces scopes per route ‖ Unauthenticated or over-scoped route exposed · Information disclosure · `security-misconfiguration` · CWE-306, T1190 · control: deny-by-default routes, token validation on every route, scope mapping reviewed ‖ Abuse without limits exhausts the back end · Denial of service · `resource-exhaustion` · CWE-770, T1499 · control: per-consumer rate limits and quotas, request size limits, spike arrest.

## `relational-database` — Relational database (SQL Server, PostgreSQL, MySQL, Oracle)
- **Icon:** `database` (node type `database`, component `sql-server` or `database`)
- **What:** The system of record; where the restricted data lives.
- **Attaches to:** A data tier reachable only from the application tier and the administration path; listens on 1433, 5432, 3306 or 1521.
- **Default exposure:** Private; the listener may bind every interface and accept unencrypted connections; local accounts and sample databases ship by default.
- **Disable unless needed:** **mixed-mode-or-local-accounts** (prefer identity-based auth), **unencrypted-connections** (require TLS), **sa-or-root-login**, **xp_cmdshell-or-os-shell**, **public-role-grants**, **sample-databases**, **linked-servers**.
- **Depends on:** `identity` or `directory` (Kerberos, IAM), `kms` (TDE, column encryption keys), `backup`, `logging` (audit), `storage`, `time`.
- **Ask:** How do applications authenticate (service account, Kerberos, managed identity)? Is TLS required? Who holds sysadmin and from where? Is auditing on and shipped out? Encryption at rest and who holds the key? Backups tested?
- **Propose:** node `database` with `data_classification: restricted` and tags; `data` flows from each application identity with their real `auth`; a `dependency` flow to the KMS and the backup target; `profile.elevated_access` for DBAs.
- **Threats:** Application identity with database-owner rights reads and alters every table · Elevation of privilege · `privilege-escalation` · CWE-250, T1078 · control: least-privilege role per application; no owner or sysadmin for services; separate migration identity ‖ Backups or snapshots copied without the key or the controls of the source · Information disclosure · `sensitive-data-exposure` · CWE-312, T1530 · control: encrypted backups with managed keys; restricted backup storage; restore tests ‖ Audit off or local only: a theft of records cannot be reconstructed · Repudiation · `insufficient-logging-monitoring` · CWE-778, T1070 · control: server audit to the SIEM, alerts on bulk reads and privilege changes.

## `cache` — In-memory cache (Redis, Memcached, Valkey)
- **Icon:** `cache` (component type `cache`)
- **What:** Fast key-value store for sessions, tokens and hot data; often holds copies of restricted records.
- **Attaches to:** The application tier; listens on 6379 or 11211; many deployments have no authentication at all.
- **Default exposure:** Private but unauthenticated by default (Memcached always; Redis without `requirepass` or ACLs) and unencrypted.
- **Disable unless needed:** **no-auth**, **plaintext-port**, **dangerous-commands** (`CONFIG`, `DEBUG`, `FLUSHALL` renamed or disabled), **bind-all-interfaces**, **persistence-to-shared-disk**.
- **Depends on:** `network` (the application subnet), `secrets` (the AUTH credential or certificates), `monitoring`.
- **Ask:** Is authentication on, and is it a shared string or per-client identities? TLS? What is cached: sessions, tokens, personal data? Who can reach the port?
- **Propose:** `cache` component or node with `data_classification` matching what it holds; `data` flows with `auth` (`password` for a shared AUTH string is honest); a firewall or security group as the appliance that admits only the application subnet.
- **Threats:** Unauthenticated cache reachable from the network dumps sessions and tokens · Information disclosure · `broken-authentication` · CWE-306, T1552 · control: ACLs with per-client credentials, TLS, bind to the private interface, firewall to the application subnet ‖ Cached copies bypass the database's row-level security and audit · Information disclosure · `insecure-design` · CWE-668, T1005 · control: cache only non-sensitive projections, short TTLs, encrypt or exclude restricted fields ‖ Shared AUTH string in every application's configuration · Spoofing · `credential-exposure` · CWE-798, T1552.001 · control: per-application identities, rotation, secrets in a vault.

## `message-queue` — Message broker (RabbitMQ, Kafka, ActiveMQ, MSMQ, NATS)
- **Icon:** `queue` (component type `queue`)
- **What:** Decouples producers from consumers; messages often carry orders, personal data or commands.
- **Attaches to:** The application tier; listens on 5672, 9092, 61616 and a management port; clusters replicate between nodes.
- **Default exposure:** Private; default guest or anonymous accounts, an unauthenticated management UI and plaintext listeners ship on several brokers.
- **Disable unless needed:** **guest-or-default-accounts**, **plaintext-listener**, **management-ui-open**, **anonymous-publish**, **unrestricted-vhosts-or-topics**.
- **Depends on:** `identity` (SASL, mTLS certificates), `pki`, `storage` (persistent queues), `monitoring`, `logging`.
- **Ask:** How do producers and consumers authenticate (per service)? Are topics or queues authorised per identity? TLS between clients and brokers and between brokers? What data is in the messages and how long does it persist?
- **Propose:** `queue` component or node; one `data` flow per producer and consumer with its `auth`; `connection.type: message-queue`; `data_classification` from the message content.
- **Threats:** Any client that can connect publishes commands another service executes · Tampering · `broken-authentication` · CWE-287, T1565 · control: per-service credentials or certificates, publish and subscribe ACLs per topic, schema validation in consumers ‖ Messages persisted in the clear hold personal data for days · Information disclosure · `sensitive-data-exposure` · CWE-312, T1005 · control: encryption at rest, minimised payloads, retention limits ‖ Management interface reachable from the user network · Elevation of privilege · `security-misconfiguration` · CWE-284, T1133 · control: management on the admin network only, MFA, default accounts removed.

## `file-share` — File share (SMB on Windows Server, NFS, NAS)
- **Icon:** `storage` (component type `file-share`)
- **What:** Shared folders for users and applications; a classic place for restricted documents and for ransomware.
- **Attaches to:** The user or application network; SMB 445, NFS 2049.
- **Default exposure:** Private; SMB 1, unsigned SMB, anonymous or Everyone permissions and NFS exports without `root_squash` are the common defaults to remove.
- **Disable unless needed:** **smb1**, **unsigned-smb**, **everyone-full-control**, **anonymous-access**, **nfs-no-root-squash**, **nfs-export-to-any**.
- **Depends on:** `directory` (permissions, Kerberos), `backup`, `kms` (encryption at rest), `logging` (file access auditing), `monitoring`.
- **Ask:** Who can reach the share (users, servers, both)? SMB signing and encryption? Which groups hold write access? Is file auditing on? Are backups offline or immutable?
- **Propose:** `file-share` component or `storage` node with `data_classification`; `data` flows with `auth: kerberos` (or `ssh-key`, `certificate`); a `dependency` flow to the backup target; the user-network appliance that admits 445.
- **Threats:** Ransomware encrypts the share from one infected workstation · Tampering · `malware-execution` · CWE-732, T1486 · control: least-privilege write access, immutable or offline backups, canary files and alerts, EDR on endpoints ‖ Over-broad share permissions expose restricted documents · Information disclosure · `unauthorized-access` · CWE-732, T1039 · control: group-based access reviewed quarterly, no Everyone or Authenticated Users on restricted folders, access auditing ‖ SMB relay or unsigned traffic lets an insider impersonate a user · Spoofing · `missing-or-weak-encryption` · CWE-294, T1557.001 · control: SMB signing and encryption required, SMB 1 removed, LLMNR and NetBIOS disabled.

## `identity-provider` — Identity provider (Entra ID, Okta, Ping, Keycloak, AD FS)
- **Icon:** `shield` (node type `identity-provider`)
- **What:** Issues the tokens and assertions every other flow trusts; the crown jewel of the diagram.
- **Attaches to:** The Internet side for a cloud IdP (`zone: internet`), the corporate network for AD FS or Keycloak; every application has an `auth` or `trust` flow to it.
- **Default exposure:** Internet-facing sign-in by design; legacy protocols, basic authentication and self-service registration are the defaults to question.
- **Disable unless needed:** **legacy-auth** (basic, IMAP/POP, older protocols), **password-only-sign-in**, **self-service-registration**, **implicit-flow**, **long-lived-tokens**, **unverified-redirect-uris**.
- **Depends on:** `directory` (hybrid identity, sync), `pki` (signing certificates), `logging` (sign-in and audit logs to the SIEM), `time`.
- **Ask:** MFA for everyone or only administrators, and is it phishing-resistant? Conditional access by device and location? Which legacy protocols are still allowed? How long do tokens and sessions live? Who administers the tenant and from where?
- **Propose:** node `identity-provider` (Internet side for a cloud tenant); `auth` flows from each user population; `trust` flows to relying applications; a `dependency` flow from the directory for synchronisation; `profile.elevated_access` for tenant administrators.
- **Threats:** Credential stuffing and MFA fatigue against the sign-in page · Spoofing · `broken-authentication` · CWE-307, T1110 · control: MFA with number matching or passkeys, smart lockout, risk-based policies ‖ Tenant administrator compromised through a phished session · Elevation of privilege · `phishing-social-engineering` · CWE-308, T1566 · control: phishing-resistant MFA and privileged access workstations for administrators, break-glass accounts sealed ‖ Token forged or replayed after a signing key leak · Spoofing · `credential-exposure` · CWE-321, T1606 · control: HSM-backed signing keys, rotation, short token lifetimes, audience and issuer validation in every relying party.

## `directory` — Directory (Active Directory Domain Services, OpenLDAP, FreeIPA)
- **Icon:** `directory` (node type `server`, component type `directory`)
- **What:** Accounts, groups, policy and Kerberos for the estate; the target of every lateral-movement playbook.
- **Attaches to:** The corporate network, usually its own segment; 88, 389/636, 445, 135 and dynamic RPC.
- **Default exposure:** Private; LDAP without signing or channel binding, NTLM, unconstrained delegation and legacy Kerberos ciphers are the defaults to remove.
- **Disable unless needed:** **ldap-unsigned**, **ntlm** (or at least NTLMv1), **unconstrained-delegation**, **rc4-kerberos**, **anonymous-ldap-bind**, **print-spooler-on-dcs**, **smb1**.
- **Depends on:** `dns` (integrated), `time` (Kerberos skew), `pki` (LDAPS), `backup` (system state), `logging` (security events to the SIEM).
- **Ask:** Where do domain administrators sign in from (PAW, tier model)? Is LDAP signing and channel binding enforced? Any accounts with unconstrained delegation or service principal names with weak passwords? Is the domain controller its own tier with no other roles?
- **Propose:** node `server` (or a `directory` component on it) in its own segment with an appliance admitting only directory ports; `auth` flows from domain members; `dependency` flows to DNS and time; `profile.elevated_access` for domain administrators.
- **Threats:** Kerberoasting of service accounts with weak passwords · Elevation of privilege · `credential-exposure` · CWE-521, T1558.003 · control: group managed service accounts or 25+ character passwords, AES-only Kerberos, monitoring for TGS requests ‖ Domain controller administered from an ordinary workstation · Elevation of privilege · `excessive-trust-or-flat-network` · CWE-250, T1078.002 · control: tiered administration, PAWs, no domain admin sign-in on tier-1 or tier-2 hosts ‖ Directory replication abused to extract every hash · Information disclosure · `privilege-escalation` · CWE-269, T1003.006 · control: replication rights limited to domain controllers, alerts on DCSync, privileged group membership monitored.

## `vpn-gateway` — VPN gateway (IPsec or SSL VPN appliance, Always On VPN)
- **Icon:** `lock` (appliance type `vpn`)
- **What:** Brings remote users or sites onto the private network; the most attacked edge device of recent years.
- **Attaches to:** The perimeter; an appliance of the corporate zone with `serves` listing the remote populations.
- **Default exposure:** Internet-facing by design; its management interface, local accounts and web portal are the usual findings.
- **Disable unless needed:** **management-from-internet**, **local-admin-accounts**, **split-tunnel-to-corporate-dns**, **weak-ike-or-ssl-ciphers**, **password-only-vpn**, **unsupported-firmware**.
- **Depends on:** `identity` (RADIUS, SAML, certificates), `pki` (device certificates), `logging`, `update-service` (firmware), `monitoring`.
- **Ask:** How do users authenticate (certificate plus MFA, or password)? Device compliance checked? What can a connected user reach: everything, or a segment? Firmware current and who patches it? Management reachable only from inside?
- **Propose:** appliance `vpn` with `edge: left`, `filters: inbound`, `serves` set to the remote user or site nodes; a `tunnel` flow from the remote user to the gateway with `auth` `certificate` or `mfa`; `profile.patching` on the appliance.
- **Threats:** Unpatched gateway exploited for code execution on the perimeter · Elevation of privilege · `vulnerable-components` · CWE-1395, T1190 · control: vendor advisories tracked, emergency patch SLA, management isolated, configuration backups ‖ Connected user reaches the whole network · Elevation of privilege · `excessive-trust-or-flat-network` · CWE-923, T1021 · control: per-group access policies, a VPN zone with a firewall between it and the servers, zero-trust broker for applications ‖ Password-only VPN sign-in sprayed from the Internet · Spoofing · `broken-authentication` · CWE-307, T1110.003 · control: certificate plus MFA, lockout, geo and risk policies, alerts on new source countries.

## `jump-host` — Jump host, bastion or privileged access workstation
- **Icon:** `server` (node type `server`; a PAW is `workstation`)
- **What:** The one place administrators sign in before reaching servers; concentrates privilege, so it concentrates risk.
- **Attaches to:** A management segment reachable from the administrators' network only; reaches servers on their management ports.
- **Default exposure:** Private; the findings are RDP or SSH open too widely, saved credentials and sessions nobody records.
- **Disable unless needed:** **rdp-or-ssh-from-user-network**, **saved-credentials-and-connections**, **clipboard-and-drive-redirection**, **internet-browsing**, **local-admin-for-users**, **shared-accounts**.
- **Depends on:** `directory` or `identity` (sign-in), `logging` (session recording, security events), `pki`, `update-service`.
- **Ask:** Who may sign in and with what (phishing-resistant MFA)? Are sessions recorded? Are credentials saved on it? Can it browse the Internet or read mail? Is it hardened and patched like a server?
- **Propose:** node `server` in a management segment with an appliance admitting only the administrators' zone; `data` flows from administrators (`protocol: RDP` or `SSH`, `connection.type: remote-session`, strong `auth`); `data` flows to the servers it manages; `profile.elevated_access` with session recording.
- **Threats:** Foothold on the jump host turns into every saved connection · Elevation of privilege · `credential-exposure` · CWE-522, T1552 · control: no saved credentials, Credential Guard or equivalent, just-in-time access, MFA on every hop ‖ Administrative session without a record · Repudiation · `insufficient-logging-monitoring` · CWE-778, T1070 · control: session recording to the PAM vault, privileged command logging, alerts ‖ Jump host reachable from the user network or the Internet · Elevation of privilege · `security-misconfiguration` · CWE-284, T1021.001 · control: firewall admits only the administrators' zone (or a bastion service), no public address, conditional access.

## `mail-server` — Mail server or gateway (Exchange, Postfix, a mail security gateway)
- **Icon:** `mail` (component type `mail`)
- **What:** Receives and sends mail; the delivery vehicle for phishing and the exfiltration channel of choice.
- **Attaches to:** The perimeter for inbound SMTP (25) through a gateway; the user network for client access (443, 993, 587).
- **Default exposure:** Internet-facing SMTP by design; open relays, basic authentication, missing SPF, DKIM and DMARC, and unpatched web access are the findings.
- **Disable unless needed:** **open-relay**, **basic-auth-for-clients**, **plaintext-smtp-submission**, **auto-forwarding-to-external**, **legacy-pop-imap**, **anonymous-relay-connectors**.
- **Depends on:** `dns` (MX, SPF, DKIM, DMARC), `identity`, `pki`, `logging`, `monitoring`, `storage`.
- **Ask:** Is there a mail security gateway in front? SPF, DKIM and DMARC enforced? MFA on client access? Auto-forwarding to external domains blocked? Is the server patched promptly (Exchange especially)?
- **Propose:** appliance `gateway` ("Mail gateway") on the perimeter; a `mail` component on the server; `data` flows for inbound SMTP (`auth: anonymous`, by design), outbound SMTP, and client access with the real `auth`; `connection.type: email`.
- **Threats:** Phishing delivered to users through the gateway · Spoofing · `phishing-social-engineering` · CWE-451, T1566.001 · control: gateway with URL and attachment detonation, DMARC enforcement, user reporting, MFA so a stolen password is not enough ‖ Mailbox rules forward mail to an external address after an account compromise · Information disclosure · `data-exfiltration` · CWE-284, T1114.003 · control: external auto-forwarding blocked, alerts on new inbox rules, conditional access ‖ Unpatched mail server exploited from the Internet · Elevation of privilege · `vulnerable-components` · CWE-1395, T1190 · control: emergency patch SLA for the mail platform, web access behind a WAF or the gateway, EDR on the server.

## `dns-server` — DNS server (Windows DNS, BIND, Unbound, Infoblox)
- **Icon:** `dns` (component type `dns`)
- **What:** Resolves names for the estate; everything depends on it and most exfiltration can ride it.
- **Attaches to:** The corporate network; 53/udp and 53/tcp; internal resolvers forward to the Internet.
- **Default exposure:** Private resolvers should not be reachable from the Internet; open recursion, unsigned zone transfers and dynamic updates from anyone are the defaults to close.
- **Disable unless needed:** **open-recursion**, **zone-transfer-to-any**, **unsecured-dynamic-updates**, **recursion-on-authoritative-servers**, **version-banner**.
- **Depends on:** `directory` (integrated zones), `time`, `logging` (query logs), `network` (forwarders).
- **Ask:** Which resolvers do clients use and are they the only ones allowed outbound on 53? Is DNSSEC validated? Are query logs kept and analysed? Are zone transfers restricted? Is DNS filtering (malicious domains) in place?
- **Propose:** `dns` component (or a node) in the server segment; `dependency` flows from servers and workstations with `connection.type: dns`; an egress rule on the perimeter admitting 53 only from the resolvers.
- **Threats:** Cache poisoning or forged responses redirect clients · Spoofing · `missing-or-weak-encryption` · CWE-350, T1557 · control: DNSSEC validation, source port randomisation, patched resolver, DoT or DoH to forwarders ‖ Data exfiltration tunnelled over DNS · Information disclosure · `data-exfiltration` · CWE-200, T1048.003 · control: only the resolvers may send 53 outbound, query logging and analytics for tunnelling patterns, DNS filtering ‖ Zone transfer or dynamic update from any host maps or alters the estate · Tampering · `security-misconfiguration` · CWE-284, T1590.002 · control: transfers limited to secondaries, secure dynamic updates only, zone changes audited.

## `ci-cd-runner` — CI/CD runner or build server (Jenkins, GitLab Runner, Azure DevOps agent, GitHub runner)
- **Icon:** `service` (component type `agent` or `process`)
- **What:** Builds and deploys the code; holds deployment credentials to every environment it serves.
- **Attaches to:** A build segment with access to the repository, the package registry and the targets it deploys to.
- **Default exposure:** Private, but it executes code from pull requests and plugins and reaches production; a shared runner is a bridge between every project that uses it.
- **Disable unless needed:** **shared-runners-across-trust-levels**, **long-lived-deployment-credentials**, **pull-request-builds-with-secrets**, **unpinned-actions-or-plugins**, **docker-socket-mounted**, **internet-egress-unrestricted**.
- **Depends on:** `package-registry`, `secrets` (deployment credentials), `identity` (OIDC federation to the targets), `logging`, `storage` (artefacts).
- **Ask:** Are deployment credentials short-lived (OIDC federation) or stored on the runner? Do pull-request builds get secrets? Are runners ephemeral? Which registries and destinations may they reach? Are actions and plugins pinned by hash?
- **Propose:** node `server` (or `container`) in a build segment; `dependency` flows to the registry and the vault; `control` flows to the deployment targets with `auth: managed-identity` or `oidc`; `profile.software` with SBOM availability.
- **Threats:** Malicious pull request or dependency runs on the runner and reads its secrets · Elevation of privilege · `supply-chain` · CWE-829, T1195.002 · control: no secrets for untrusted builds, ephemeral runners, pinned dependencies and actions, egress allow-list ‖ Runner's standing credentials deploy anything to production · Tampering · `credential-exposure` · CWE-798, T1552 · control: OIDC federation with short-lived tokens, environment approvals, separate runners per trust level ‖ Build artefacts tampered with between build and deploy · Tampering · `supply-chain` · CWE-494, T1195 · control: signed artefacts and provenance (SLSA), verification at deploy, immutable registry tags.

## `secrets-vault` — Secrets vault (HashiCorp Vault, CyberArk, Thycotic, a self-hosted KMS)
- **Icon:** `key` (component type `secrets`)
- **What:** Holds the credentials, keys and certificates everything else uses; a compromise is every other compromise at once.
- **Attaches to:** A restricted segment reachable from the application tier and the administrators; 8200 (Vault) or the product's port.
- **Default exposure:** Private; root tokens left active, broad policies, an unsealed vault on a single node and audit off are the findings.
- **Disable unless needed:** **root-token-active**, **wildcard-policies**, **audit-device-off**, **unauthenticated-metrics**, **single-node-no-ha**, **ui-on-user-network**.
- **Depends on:** `kms` or an HSM (auto-unseal, master key), `identity` (authentication methods), `storage` (backend), `backup`, `logging` (audit device), `time`.
- **Ask:** How do applications authenticate to it (workload identity, AppRole, Kubernetes auth)? Are policies per application and least-privilege? Is the audit device on and shipped out? Is the unseal key in an HSM or cloud KMS? Who holds root and is it revoked?
- **Propose:** `secrets` component or node in its own segment with an appliance admitting only the application subnets and the administrators; `dependency` flows from every application that reads secrets; `profile.elevated_access` for vault administrators.
- **Threats:** Application policy reads every secret, not its own · Information disclosure · `privilege-escalation` · CWE-269, T1552 · control: per-application policies with path-level scope, dynamic short-lived secrets, access reviews ‖ Vault administrator or root token compromised · Elevation of privilege · `credential-exposure` · CWE-250, T1078 · control: root token revoked after setup, MFA and PAM for vault administrators, audit alerts on policy changes ‖ Unseal or master key kept where the vault's storage is · Information disclosure · `missing-or-weak-encryption` · CWE-321, T1552.004 · control: auto-unseal with an HSM or cloud KMS, key shares held by separate people, tested recovery.

## `backup-server` — Backup server and repository (Veeam, Commvault, Veritas, Bacula)
- **Icon:** `storage` (node type `storage`)
- **What:** Holds copies of everything; the last line against ransomware and the first target of it.
- **Attaches to:** A backup segment with access to the systems it protects; repositories on disk, object storage or tape.
- **Default exposure:** Private; the findings are a repository writable from the production network, domain-joined backup servers administered with domain credentials, and backups that are neither offline nor immutable.
- **Disable unless needed:** **repository-writable-from-production**, **domain-admin-service-account**, **backup-console-on-user-network**, **unencrypted-backups**, **single-copy-no-offsite**, **no-immutability**.
- **Depends on:** `storage` (repositories), `kms` (backup encryption), `identity` (separate from the production directory ideally), `logging`, `time`, `network` (to the sources).
- **Ask:** Are backups immutable or offline, and for how long? Is the backup server outside the production domain or administered with separate credentials? Are restores tested and how fast? Are backups encrypted and who holds the key?
- **Propose:** node `storage` ("Backup repository") in a backup segment with an appliance admitting only the backup server; `dependency` flows from the protected servers (or from the backup server to them, as the product works); `profile.elevated_access` with a separate identity.
- **Threats:** Ransomware deletes or encrypts the backups before the production data · Tampering · `malware-execution` · CWE-732, T1490 · control: immutable or offline copies (3-2-1-1-0), separate credentials, MFA on the console, deletion delay ‖ Backup copies restored or read outside the production controls · Information disclosure · `sensitive-data-exposure` · CWE-312, T1530 · control: encrypted backups, restricted restore rights, access logging ‖ Backup service account holds domain administrator rights · Elevation of privilege · `privilege-escalation` · CWE-250, T1078.002 · control: least-privilege backup identity, agent-based access, backup server outside the production domain.

## `workstation` — Managed workstation or laptop (Windows, macOS, Linux endpoints)
- **Icon:** `workstation` or `laptop` (node types `workstation`, `laptop`)
- **What:** Where users read mail and browse; the usual entry point of a compromise.
- **Attaches to:** The office network or the Internet (remote work); reaches everything the user is allowed to.
- **Default exposure:** Private when in the office, Internet-facing when remote; local administrator rights, macros, unpatched browsers and no EDR are the findings.
- **Disable unless needed:** **local-admin-for-users**, **office-macros-from-internet**, **unmanaged-browser-extensions**, **usb-storage**, **llmnr-netbios**, **legacy-office-file-formats**.
- **Depends on:** `directory` or `identity` (sign-in, device compliance), `update-service`, `pki` (device certificates), `dns`, `monitoring` (EDR), `backup` (user data).
- **Ask:** Are users local administrators? EDR deployed and monitored? Patch SLA for the OS and browser? Disk encryption? Device compliance required by conditional access? Which networks can it reach directly?
- **Propose:** node `workstation` or `laptop` in the office zone (or `zone: internet` when remote); `data` flows to the applications with the real `auth`; `profile.device_authentication` with the device certificate; `profile.patching` and `profile.hardening`.
- **Threats:** Phished user runs malware with local administrator rights · Elevation of privilege · `malware-execution` · CWE-250, T1204.002 · control: standard user accounts with LAPS for local admin, application control, EDR, macro policies ‖ Stolen or lost laptop with unencrypted disk · Information disclosure · `physical-access` · CWE-311, T1200 · control: full-disk encryption with TPM, remote wipe, conditional access by device compliance ‖ Workstation reaches servers directly on management ports · Elevation of privilege · `excessive-trust-or-flat-network` · CWE-923, T1021 · control: user VLAN with a firewall to the server segments, administration only through the jump host.

## `siem` — SIEM, log collector or monitoring platform (Splunk, Sentinel data connectors, Elastic, Graylog)
- **Icon:** `monitor` (component type `monitoring`)
- **What:** Receives every log the diagram produces; the evidence base of every investigation and the dependency of every detective control.
- **Attaches to:** A management segment reachable from every log source; agents or syslog (514, 6514), HTTPS ingestion.
- **Default exposure:** Private; the findings are plaintext syslog, open ingestion endpoints, analysts with the same rights as administrators, and retention shorter than the investigation window.
- **Disable unless needed:** **plaintext-syslog**, **unauthenticated-ingestion**, **analyst-admin-rights**, **short-retention**, **sources-without-time-sync**.
- **Depends on:** `time` (correlation), `storage` (retention), `identity` (analyst sign-in), `pki` (TLS ingestion), `network` (collectors).
- **Ask:** Which sources send logs and which do not? Is transport encrypted and authenticated? Retention versus the investigation window? Who can edit or delete events? Are alerts routed to someone on call?
- **Propose:** `monitoring` component or node; `dependency` flows from every source that ships logs (`data_classification: internal`); `profile.elevated_access` for the platform administrators.
- **Threats:** Attacker stops or tampers with log forwarding before acting · Repudiation · `insufficient-logging-monitoring` · CWE-778, T1562.001 · control: forwarding health alerts, write-once storage, source-side buffering, agent tamper protection ‖ Logs carry credentials and personal data readable by every analyst · Information disclosure · `sensitive-data-exposure` · CWE-532, T1552 · control: redaction at ingestion, role-based access to indexes, retention per data class ‖ Plaintext syslog across the network is read or spoofed · Tampering · `missing-or-weak-encryption` · CWE-319, T1557 · control: TLS syslog or agents with mutual authentication, collectors per segment.

## `firewall` — Firewall or next-generation firewall (FortiGate, Palo Alto, Check Point, Sophos, pfSense)
- **Icon:** `firewall` (appliance type `firewall` or `ngfw`)
- **What:** Enforces the zone boundaries of the diagram; an appliance, never a node.
- **Attaches to:** The edge of the zone it guards (`edge`, `filters`, `serves`); several zones can share one physical device.
- **Default exposure:** Internet-facing on the perimeter; its management plane is the risk: web UI or SSH reachable from the wrong side, local accounts, unpatched firmware.
- **Disable unless needed:** **management-on-untrusted-interface**, **local-admin-without-mfa**, **any-any-rules**, **unused-services** (HTTP admin, SNMP v1/v2, telnet), **ssl-vpn-portal-when-unused**, **unsupported-firmware**.
- **Depends on:** `identity` (administrator sign-in, RADIUS or SAML), `logging` (rule hits to the SIEM), `update-service` (firmware, threat signatures), `time`, `pki`.
- **Ask:** Which rules admit what between which zones (each becomes a flow through the appliance)? Where is management reachable from, with what MFA? Are rule changes under change control and reviewed? Is firmware current? Does it inspect TLS, and where are the keys?
- **Propose:** appliance `firewall` or `ngfw` on the zone edge; `via` on flows only when automatic routing is wrong; a `control` flow from administrators through the management network; `profile.patching` and `profile.elevated_access` on the appliance; the product's logo as `dashboard/<name>` (`icons.md`).
- **Threats:** Management interface reached from the Internet or the user network · Elevation of privilege · `security-misconfiguration` · CWE-284, T1133 · control: management on a dedicated interface and network, MFA, allow-list, no local admin accounts ‖ Rule drift opens an any-any or a forgotten exception · Elevation of privilege · `security-misconfiguration` · CWE-284, T1562.004 · control: change control with a ticket per rule, periodic rule review, automated drift detection ‖ Firewall firmware vulnerability exploited at the perimeter · Elevation of privilege · `vulnerable-components` · CWE-1395, T1190 · control: vendor advisories tracked, emergency patching, unused services off, configuration backups.

## `waf` — Web application firewall (ModSecurity, F5 ASM, Imperva, a cloud WAF in front of on-premises)
- **Icon:** `shield` (appliance type `waf`)
- **What:** Filters HTTP requests for injection, scanners and bots before they reach the web tier.
- **Attaches to:** The edge of the web zone, between users and the web server or load balancer; an appliance.
- **Default exposure:** Internet-facing by design; the findings are detection-only mode, a rule set never tuned, and back ends reachable around it.
- **Disable unless needed:** **detection-only-mode**, **excluded-paths-without-review**, **direct-backend-access**, **default-rule-set-untuned**, **no-bot-or-rate-rules**.
- **Depends on:** `pki` (TLS termination), `logging` (blocked and allowed requests), `update-service` (rule set updates), `monitoring`.
- **Ask:** Prevention or detection mode? Which rule set and when was it tuned? Can the back end be reached without going through it? Rate limiting and bot protection on? Where do its logs go?
- **Propose:** appliance `waf` with `edge: left`, `filters: inbound` on the web zone; back-end security group or firewall that admits only the WAF; `data` flows from users pass through it automatically.
- **Threats:** Back end reachable directly, bypassing the WAF · Tampering · `excessive-trust-or-flat-network` · CWE-923, T1190 · control: back end admits only the WAF's addresses or a shared header secret, no public address on the back end ‖ Rule set in detection mode or with broad exclusions · Tampering · `security-misconfiguration` · CWE-693, T1190 · control: prevention mode with a tuned managed rule set, exclusions reviewed, regression tests ‖ Volumetric or application-layer flood exhausts the site · Denial of service · `resource-exhaustion` · CWE-400, T1498 · control: rate limiting, bot management, upstream DDoS protection, autoscaling or caching at the edge.
