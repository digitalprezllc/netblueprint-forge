# Service, flow and threat attributes: options the skill offers

Research note, 2026-10-24. Settles the option lists for the second wave of attributes: a **service profile** on nodes, components and appliances; **flow detail** (connection, data, transport security, authentication on both ends, credential storage); **threat detail** (vulnerability category, threat statements, as-is and future controls, suggested mitigations, consequence); and **scope** on every element. Values are kebab-case ids in the schema; the labels and one-line descriptions below are what the skill reads to the user. **(NB)** marks values NetBlueprint adds beyond the cited source.

Normalization rule for all of these: the user may type anything; `scripts/normalize.mjs` maps the text to the closest id using the synonyms listed with each option and confirms when confidence is low.

---

## Part A: service profile (`profile` on node, component, appliance)

Name and description are the existing `label` and `info`.

### A.1 Ownership
| Field | Options / form |
| - | - |
| `business_owner`, `technical_owner`, `team`, `contact` | free text |
| `support_tier` | `24x7` · `business-hours` · `best-effort` · `unsupported` |
| `cost_center` | free text |

### A.2 Platform
| Field | Options |
| - | - |
| `category` | `physical-server` · `virtual-machine` · `container` · `kubernetes` · `serverless` · `paas` · `saas` · `network-appliance` · `mainframe` · `workstation` · `mobile` · `iot-ot` · `other` |
| `os` / `runtime`, `version` | free text ("Windows Server 2022", "Ubuntu 24.04", ".NET 8") |
| `support_status` | `supported` · `extended-support` · `end-of-life` · `unknown` (EOL software is a finding in itself) |
| `eol_date` | date |

### A.3 Location
| Field | Options |
| - | - |
| `hosting` | `on-premises-datacenter` · `colocation` · `public-cloud` · `private-cloud` · `edge-branch` · `home` · `third-party-hosted` · `mobile` |
| `site`, `region`, `availability_zone`, `country` | free text |
| `data_residency` | free text constraint ("EU only") |

### A.4 Device / service authentication (how this thing proves who it is)
Based on NIST SP 800-63B authenticator types and assurance levels, applied to machines and services as well as people.

| Field | Options |
| - | - |
| `factors` | `single` (one authenticator) · `multi` (two factors from different categories: something known, held, inherent) |
| `methods[]` | `password` (memorized secret) · `shared-secret` (pre-shared key, service account password) · `api-key` · `x509-certificate-mtls` (single-factor cryptographic software: key on disk) · `hardware-bound-certificate` (single-factor cryptographic device: key in TPM/HSM/smart card, non-exportable) · `workload-identity` (SPIFFE/SVID, cloud managed identity, Kubernetes service account token, no stored secret) · `kerberos-machine-account` (computer account / gMSA) · `ssh-key` · `oauth2-client-credentials` (secret or certificate) · `fido2-hardware-token` (multi-factor cryptographic device) · `802.1x-eap-tls` (network port authentication) · `device-compliance-posture` (MDM/EDR attestation added to a session) · `none` |
| `assurance` | `aal1` (any single authenticator) · `aal2` (two factors, or one multi-factor authenticator) · `aal3` (hardware-based cryptographic authenticator, verifier-impersonation resistant, e.g. client-authenticated TLS) · `not-applicable` |

Prompt wording: "When this service connects to others, how does it prove its identity: a password or key it stores, a certificate (where is the private key?), a cloud/workload identity with no stored secret, or a hardware-bound credential? Is a second factor involved?"

### A.5 Elevated access (how administrators get in)
Based on Microsoft's enterprise access model (control / management / data-workload planes, the successor of Tier 0/1/2) and common PAM practice.

| Field | Options |
| - | - |
| `model` | `none` (no interactive admin) · `standing-admin` (permanent admin rights) · `shared-admin-account` (shared credential) · `just-in-time` (time-boxed elevation with approval, e.g. PIM) · `pam-vaulted` (credentials vaulted and rotated, sessions brokered) · `break-glass-only` (emergency accounts only) |
| `mfa_required` / `phishing_resistant_mfa` | booleans (FIDO2 / certificate / smart card count as phishing-resistant; push and OTP do not) |
| `pathway` | `bastion` · `privileged-access-workstation` · `vpn` · `direct` · `console-or-ilo` · `cloud-portal` · `pipeline-only` |
| `local_admin` | `disabled` · `laps-managed` (unique, rotated) · `managed` · `unmanaged` · `unknown` |
| `session_recording` | boolean |
| `plane` | `control-plane` (identity, directory, network policy; old Tier 0) · `management-plane` (enterprise IT management; old Tier 1) · `workload-plane` (per-application admin) · `user-access` · `not-applicable` |

### A.6 Patching
NIST SP 800-40r4 (plan, prioritise, maintain) and CISA BOD 22-01 (KEV deadlines: two weeks for new CVEs, six months for pre-2021) as the reference points; day counts are organisation policy.

| Field | Options |
| - | - |
| `responsibility` | `vendor-managed` (SaaS/PaaS) · `platform-team` · `application-team` · `self` · `none` |
| `cadence` | `continuous` · `weekly` · `monthly` · `quarterly` · `ad-hoc` · `none` |
| `auto_update` | boolean |
| `sla_days` | object `{ critical, high, medium }` (typical practice: 14–15 / 30 / 90; KEV-listed often 14 or less) |
| `kev_sla_days` | integer |
| `last_patched` | date |
| `unsupported_components` | boolean (EOL libraries, runtimes, firmware present) |

### A.7 Hardening
| Field | Options |
| - | - |
| `baseline` | `cis-level-1` (practical, no functional loss) · `cis-level-2` (defence in depth, may cost function) · `disa-stig` (DoD standard; CIS accepted as an alternative at IL2) · `vendor-baseline` (e.g. Microsoft Security Baseline, cloud provider hardened image) · `organization-baseline` · `none` · `unknown` |
| `verified_by` | `scanner` (CIS-CAT, SCAP, cloud posture tool) · `configuration-management` (enforced by policy/IaC) · `manual-review` · `not-verified` |
| `last_assessed` | date |
| `exceptions` | free text |

### A.8 Software sourcing (COTS and friends)
FAR 2.101 defines COTS as commercial items sold in substantial quantities and used without modification; GOTS, open source and custom are the usual neighbours.

| Field | Options |
| - | - |
| `sourcing` | `cots` (commercial off-the-shelf, unmodified) · `cots-customized` (NB) · `gots` (government off-the-shelf) · `open-source` · `custom-developed` · `saas` · `hybrid` |
| `vendor`, `product`, `version` | free text |
| `licensed_support` | boolean (a support contract exists) |
| `sbom_available` | boolean |

---

## Part B: flow detail (`flows[]`)

### B.1 Connection
| Field | Options |
| - | - |
| `type` | `request-response` · `streaming` · `batch-file-transfer` · `message-queue` · `replication` · `management` · `remote-session` · `tunnel` · `dns` · `email` · `other` |
| `initiator` | `from` (the source opens the connection) · `to` (the destination calls back / pulls) · `either` |
| `session` | `persistent` · `ephemeral` · `scheduled` |
| `frequency`, `volume` | free text ("every 5 min", "2 GB nightly") |

Directionality is drawn from `direction` (arrowheads) and `initiator` (who opens it); the two differ for pull-style flows.

### B.2 Data exchanged
| Field | Options |
| - | - |
| `client_sends[]`, `server_sends[]` | `credentials` · `tokens` · `session-cookies` · `personal-data` · `payment-data` · `health-data` · `commands` · `configuration` · `queries` · `query-results` · `files` · `documents` · `telemetry` · `logs` · `keys-certificates` · `code-artifacts` · `email` · `media` · `none` |
| `sensitivity` | the four-tier level: `public` · `internal` · `confidential` · `restricted` |
| `categories[]` | industry / regulatory labels (B.3) |
| `tlp` | `clear` · `green` · `amber` · `amber-strict` · `red` (FIRST TLP 2.0) |

### B.3 Sensitivity labels (industry terms the user may say)
| Id | Term | Meaning and source |
| - | - | - |
| `public` | Public Information | Approved for release; no harm if disclosed |
| `internal` / `proprietary` | Internal, Proprietary Information | Business use only; disclosure gives competitors an advantage. Trade secrets are the strongest form (`trade-secret`) |
| `confidential` | Confidential | Need-to-know; harm if disclosed |
| `restricted` | Restricted / Highly Confidential | Severe harm; the strongest level |
| `npi` | Non-Public Information (NPI) | GLBA, 16 CFR 313.3(n): personally identifiable financial information a consumer provides to obtain a financial product or service, results from such a transaction, or is otherwise obtained while providing it; excludes publicly available information |
| `mnpi` | Material Non-Public Information | Securities law term: information a reasonable investor would consider important that is not public |
| `pii` / `sensitive-pii` | Personal data; sensitive personal data | PII generally; sensitive = CPRA "sensitive personal information" / GDPR Art. 9 special categories (health, biometrics, race, religion, sexual orientation, precise location, government ids) |
| `phi` | Protected Health Information | HIPAA |
| `pci` | Cardholder data | PCI DSS |
| `fci` | Federal Contract Information | FAR 52.204-21: information provided by or generated for the Government under contract, not intended for public release; excludes simple transactional information |
| `cui` | Controlled Unclassified Information | 32 CFR 2002 / NARA CUI Registry: information the Government creates or possesses, or an entity creates for it, that law, regulation or policy requires to be safeguarded; categories such as CUI//SP-PRVCY, CUI//SP-EXPT |
| `export-controlled` | ITAR / EAR | Export-controlled technical data |
| `credentials` | Credentials and secrets | Passwords, keys, tokens |
| `intellectual-property` | IP | Source, designs |
| `classified` | Classified national security information | Out of scope for this tool; noted so the user can say so |
| `tlp-*` | TLP 2.0 | Sharing restriction, orthogonal to the above |

### B.4 Transport security
| Field | Options |
| - | - |
| `protocol` | free text application protocol: HTTPS, HTTP, TDS, SMB, LDAP(S), RDP, SSH, SFTP, FTPS, FTP, SMTP(S), MQTT(S), gRPC, AMQP, NFS, DNS … |
| `security_protocol` | `tls-1.3` · `tls-1.2` · `tls-1.1` (deprecated, RFC 8996) · `tls-1.0` (deprecated) · `ssl-3` (broken) · `ssh-2` · `ipsec-esp` (confidentiality + integrity) · `ipsec-ah` (integrity only, no confidentiality) · `wireguard` · `dtls` · `quic` (TLS 1.3 built in) · `smb3-encryption` · `smb-signing` (integrity only) · `kerberos-encryption` · `application-layer-encryption` (payload encrypted by the app) · `none` · `unknown` |
| `mode` | `implicit` (TLS from the first byte: HTTPS, FTPS implicit) · `explicit` (STARTTLS / AUTH TLS upgrade: SMTP, LDAP, FTPS explicit; downgrade risk) |
| `provides` | `{ confidentiality, integrity, server_authentication, mutual_authentication, forward_secrecy, replay_protection }` booleans; defaults derived from `security_protocol` (TLS 1.2/1.3, SSH, ESP, WireGuard, SMB3 encryption: confidentiality + integrity; AH, SMB signing: integrity only; TLS 1.3, SSH, WireGuard: forward secrecy; `none`: nothing) |
| `certificate_validation` | `full-chain` · `pinned` · `self-signed-trusted` · `disabled` (a finding) · `unknown` |
| `cipher_notes` | free text |

NIST SP 800-52r2 requires TLS 1.2 and supports 1.3; RFC 8996 deprecates 1.0 and 1.1; SFTP runs over SSH, FTPS is FTP over TLS; SMB 3 signing gives integrity and SMB 3 encryption gives both.

### B.5 Authentication on each end
| Side | Field | Options |
| - | - | - |
| client | `method` | `none` · `basic-auth` · `password` · `api-key` · `bearer-token-oauth2` · `oidc-id-token` · `saml-assertion` · `x509-certificate-mtls` · `hardware-bound-certificate` · `ssh-key` · `kerberos-ticket` · `ntlm` (legacy) · `request-signing-hmac` (e.g. SigV4) · `workload-identity` · `managed-identity` · `ip-allow-list` (not authentication; recorded because people say it) · `other` |
| client | `factors` | `single` · `multi` |
| client | `mfa_type` | `none` · `otp` · `push` · `push-number-matching` · `fido2-passkey` · `smart-card-piv` · `certificate` |
| client | `credential_storage` | see B.6 |
| client | `rotation` | `automatic-short-lived` · `scheduled` · `manual` · `never` · `unknown` |
| server | `method` | `x509-certificate` · `ssh-host-key` · `kerberos-spn` · `pre-shared-key` · `none` · `other` |
| server | `certificate_issuer` | `public-ca` · `private-pki` · `cloud-managed-ca` · `self-signed` · `none` |
| server | `key_storage` | see B.6 |
| server | `pinning` | boolean |

### B.6 Where keys, certificates and passwords live (strongest first)
From the OWASP Secrets Management Cheat Sheet (HSM for the most sensitive; cloud key vaults and secrets managers recommended; Kubernetes secrets only as safe as their backend; environment variables discouraged because every process and crash dump can read them; plaintext config and hardcoded secrets are the common failure) and NIST SP 800-63B's hardware-bound authenticators.

| Id | Where | Strength |
| - | - | - |
| `hsm` | Hardware security module (FIPS 140-2/3), key never leaves | very high |
| `tpm` | TPM / secure enclave on the host; non-exportable | very high |
| `smart-card-token` | Smart card, PIV, FIDO2 key | very high |
| `cloud-key-vault` | Azure Key Vault, AWS KMS/Secrets Manager, GCP Secret Manager (access by identity, audited) | high |
| `secrets-manager-vault` | HashiCorp Vault, CyberArk, Conjur; dynamic short-lived secrets | high |
| `os-certificate-store` | Windows certificate store (DPAPI/CNG), macOS Keychain, Linux kernel keyring | moderate |
| `container-secret` | Kubernetes/Docker secret mounted at runtime (as safe as its backend) | moderate |
| `encrypted-file-passphrase` | PFX/PEM protected by a passphrase | moderate |
| `file-on-disk` | Unencrypted key file, restricted permissions | low |
| `environment-variable` | Process environment | low |
| `config-file-plaintext` | Plaintext in configuration | very low |
| `source-code` | Hardcoded in code or repository | very low |
| `unknown` | | |

### B.7 Other flow attributes useful for threat models
`path_controls`: `logged` (bool) and `log_destination` (text), `rate_limited`, `input_validated`, `dlp_inspected`, `tls_inspected`, `waf_inspected`; `availability`: `timeout_s`, `retries`, `single_point_of_failure` (bool). Trust-boundary crossing is derived from the zones.

---

## Part C: threats

### C.1 Vulnerability / weakness category (`vulnerability.category`)
A normalized list drawn from CWE classes and the OWASP Top 10:2025, worded the way reviewers talk. Each has a default STRIDE mapping used as a suggestion.

| Id | Term the user may use | Typical STRIDE | Refs |
| - | - | - | - |
| `unauthorized-access` | unauthorized access, broken access control, missing authorization, IDOR/BOLA | Elevation of privilege, Information disclosure | CWE-284, CWE-639, A01:2025 |
| `broken-authentication` | weak/missing authentication, credential stuffing, no MFA, session fixation | Spoofing | CWE-287, CWE-307, A07:2025 |
| `credential-exposure` | hardcoded secrets, plaintext passwords, leaked keys | Spoofing, Information disclosure | CWE-798, CWE-522 |
| `injection` | SQL/command/LDAP injection, XSS | Tampering, Information disclosure | CWE-74, CWE-89, CWE-79, A05:2025 |
| `improper-input-validation` | unvalidated input, deserialization | Tampering | CWE-20, CWE-502, A08:2025 |
| `security-misconfiguration` | default settings, open ports, verbose errors, public bucket | Information disclosure, Elevation of privilege | CWE-16, A02:2025 |
| `missing-or-weak-encryption` | cleartext transmission/storage, weak cipher, TLS 1.0 | Information disclosure, Tampering | CWE-311, CWE-319, CWE-327, A04:2025 |
| `sensitive-data-exposure` | data leak, over-exposure, excessive data in responses | Information disclosure | CWE-200 |
| `insufficient-logging-monitoring` | no audit trail, logs not reviewed | Repudiation | CWE-778, A09:2025 |
| `insecure-design` | missing control by design, no rate limit, trust in client | any | A06:2025 |
| `vulnerable-components` | outdated library/OS, unpatched CVE, EOL | Elevation of privilege | CWE-1104, A03:2025 |
| `supply-chain` | compromised dependency, build pipeline, vendor update | Tampering | CWE-1357, A03:2025 |
| `ssrf` | server-side request forgery, metadata service | Information disclosure, Elevation of privilege | CWE-918, A01:2025 |
| `privilege-escalation` | local/vertical escalation, excessive permissions | Elevation of privilege | CWE-269, CWE-250 |
| `excessive-trust-or-flat-network` | lateral movement, no segmentation, implicit trust | Elevation of privilege | CWE-923 (NB wording) |
| `resource-exhaustion` | DoS, DDoS, unbounded consumption | Denial of service | CWE-400, API4:2023 |
| `availability-failure` | single point of failure, outage, no backup | Denial of service | NB (non-adversarial) |
| `improper-error-handling` | crash on bad input, fail-open | Denial of service, Information disclosure | CWE-755, A10:2025 |
| `malware-execution` | malicious code, ransomware | Tampering, Denial of service | ATT&CK T1204 |
| `phishing-social-engineering` | phishing, pretexting, MFA fatigue | Spoofing | ATT&CK T1566, T1621 |
| `insider-misuse` | abuse of legitimate access | Information disclosure, Tampering | NB |
| `physical-access` | theft, tailgating, console access | any | NB |
| `data-exfiltration` | data leaving by an unapproved path | Information disclosure | ATT&CK TA0010 |
| `third-party-dependency` | partner/SaaS failure or breach | any | NB |
| `race-condition` | TOCTOU | Tampering | CWE-362 |
| `memory-safety` | buffer overflow | Elevation of privilege | CWE-119 |
| `other` | | | |

`vulnerability.cwe` (CWE-###) and `vulnerability.description` (free text, "the API builds SQL with string concatenation") refine it.

### C.2 Threat statements
A threat is articulated as a sentence the user writes or assembles from parts:

> **A** [adversary type] **could** [action] **on** [target] **by exploiting** [vulnerability] **, causing** [consequence].

Action verbs by STRIDE: Spoofing — impersonate, replay, forge; Tampering — modify, inject, corrupt; Repudiation — deny, erase evidence of; Information disclosure — read, exfiltrate, infer; Denial of service — exhaust, crash, flood; Elevation of privilege — escalate, bypass authorization, execute as. The skill offers 2–3 ready sentences per target type when the user hesitates (see `references/threats.md`).

### C.3 Controls: as-is and future state
`treatment.current_controls[]` (in place now: status implemented or verified) and `treatment.planned_controls[]` (future state: proposed, planned, in-progress). `risk.residual` is the risk with current controls; `risk.projected` is the risk once planned controls are in place. `treatment.suggested_mitigations[]` holds suggestions that are not yet controls (text, source, status suggested / accepted / rejected / converted, and the control id once converted).

### C.4 Consequence, likelihood, risk
`risk.consequence` is the plain-language outcome ("customer order history exposed"); `risk.likelihood`, `risk.impact` and the computed `risk.rating` use the five bands; the interview prompts them as words (Low, Moderate, High …) and normalizes synonyms (Medium → moderate, Critical → very-high, Severe → very-high, Negligible → very-low).

### C.5 Scope
`out_of_scope` (boolean) and `scope_reason` (text) on zones, appliances, nodes, components and flows. Out-of-scope elements stay on the diagram with their data and are drawn greyed out; threats may still target them, and the register notes the scope.

---

## Sources
- FIRST TLP 2.0: https://www.first.org/tlp/
- GLBA NPI definition, 16 CFR 313.3: https://www.law.cornell.edu/cfr/text/16/313.3
- CUI, 32 CFR 2002 and the NARA CUI Registry: https://www.archives.gov/cui ; FCI, FAR 52.204-21: https://www.acquisition.gov/far/52.204-21 ; COTS, FAR 2.101: https://www.acquisition.gov/far/2.101
- NIST SP 800-63B authenticator types and AALs: https://pages.nist.gov/800-63-3/sp800-63b.html (superseded by 800-63-4 in 2025; types unchanged for this purpose)
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- Microsoft enterprise access model: https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-access-model
- NIST SP 800-40r4 patch management: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-40r4.pdf ; CISA BOD 22-01: https://www.cisa.gov/news-events/directives/bod-22-01-reducing-significant-risk-known-exploited-vulnerabilities
- CIS Benchmarks levels and DISA STIGs: https://www.cisecurity.org/cis-benchmarks ; https://public.cyber.mil/stigs/
- RFC 8996 (TLS 1.0/1.1 deprecated): https://www.rfc-editor.org/rfc/rfc8996 ; NIST SP 800-52r2: https://csrc.nist.gov/pubs/sp/800/52/r2/final ; IPsec ESP RFC 4303 / AH RFC 4302; SMB signing and encryption: https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-security
- OWASP Top 10:2025: https://owasp.org/Top10/2025/ ; CWE: https://cwe.mitre.org/
- CPRA sensitive personal information, Cal. Civ. Code 1798.140(ae); GDPR Art. 9 special categories
