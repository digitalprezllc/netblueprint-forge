#!/usr/bin/env node
/**
 * normalize.mjs — map what a user typed onto the model's option lists.
 *
 *   node scripts/normalize.mjs <field> "<text>"        -> JSON { value, confidence, candidates[] }
 *   node scripts/normalize.mjs --fields                 -> list the vocabularies
 *   node scripts/normalize.mjs --describe <field>       -> options with one-line descriptions
 *
 * Exported: normalize(field, text) and suggest(options[], text) for validate.mjs's "did you mean".
 * Matching: exact id → label/synonym → token overlap and edit distance. Confidence < 0.6 means ask the user.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V = (id, label, syn = [], desc = '') => ({ id, label, syn, desc });
export const VOCAB = {
  stride: [
    V('spoofing', 'Spoofing', ['impersonate', 'impersonation', 'identity', 'pretend', 'fake user', 'forged identity', 'authentication bypass', 'credential stuffing', 'phishing'], 'Pretending to be another user, device or service'),
    V('tampering', 'Tampering', ['modify', 'modification', 'integrity', 'inject', 'injection', 'corrupt', 'alter', 'manipulate'], 'Changing data or code without authorization'),
    V('repudiation', 'Repudiation', ['deny', 'denial of action', 'no audit', 'no logs', 'non-repudiation', 'accountability'], 'Denying an action because it cannot be proven'),
    V('information-disclosure', 'Information disclosure', ['disclosure', 'leak', 'leakage', 'exposure', 'confidentiality', 'data breach', 'read data', 'exfiltration'], 'Data reaching someone who should not see it'),
    V('denial-of-service', 'Denial of service', ['dos', 'ddos', 'availability', 'outage', 'exhaust', 'flood', 'crash'], 'Making something unavailable or degraded'),
    V('elevation-of-privilege', 'Elevation of privilege', ['privilege escalation', 'escalation', 'eop', 'authorization bypass', 'admin access', 'root', 'unauthorized access', 'lateral movement'], 'Doing more than allowed'),
  ],
  band: [
    V('very-low', 'Very Low', ['negligible', 'minimal', 'informational', 'info', 'trivial', 'none', 'vl'], 'Negligible effect / highly unlikely'),
    V('low', 'Low', ['minor', 'limited', 'unlikely', 'l'], 'Limited effect / unlikely'),
    V('moderate', 'Moderate', ['medium', 'med', 'serious', 'possible', 'somewhat likely', 'm'], 'Serious effect / somewhat likely'),
    V('high', 'High', ['severe', 'major', 'likely', 'significant', 'h'], 'Severe effect / highly likely'),
    V('very-high', 'Very High', ['critical', 'catastrophic', 'extreme', 'almost certain', 'certain', 'vh'], 'Catastrophic effect / almost certain'),
  ],
  threat_status: [V('identified', 'Identified', ['new', 'raised', 'logged']), V('investigating', 'Investigating', ['under review', 'analysing', 'analyzing', 'needs investigation']), V('open', 'Open', ['confirmed', 'active', 'untreated']), V('mitigated', 'Mitigated', ['fixed', 'remediated', 'resolved', 'closed']), V('accepted', 'Accepted', ['risk accepted', 'tolerated', 'retained']), V('transferred', 'Transferred', ['shared', 'insured', 'outsourced']), V('avoided', 'Avoided', ['eliminated', 'removed']), V('not-applicable', 'Not applicable', ['n/a', 'na', 'does not apply']), V('retired', 'Retired', ['deleted', 'withdrawn', 'archived'])],
  treatment: [V('mitigate', 'Mitigate', ['modify', 'reduce', 'control', 'remediate', 'fix']), V('accept', 'Accept', ['retain', 'tolerate', 'live with']), V('avoid', 'Avoid', ['eliminate', 'remove the activity', 'stop']), V('transfer', 'Transfer', ['share', 'insure', 'outsource', 'contract']), V('undecided', 'Undecided', ['tbd', 'unknown', 'open'])],
  control_type: [V('preventive', 'Preventive', ['prevent', 'preventative', 'blocks', 'stops']), V('detective', 'Detective', ['detect', 'monitoring', 'alert', 'logging']), V('corrective', 'Corrective', ['correct', 'contain', 'respond']), V('deterrent', 'Deterrent', ['deter', 'discourage', 'warning']), V('recovery', 'Recovery', ['restore', 'backup', 'recover']), V('compensating', 'Compensating', ['compensate', 'alternative', 'workaround']), V('directive', 'Directive', ['policy', 'mandate', 'procedure', 'standard'])],
  control_status: [V('proposed', 'Proposed', ['idea', 'suggested']), V('planned', 'Planned', ['scheduled', 'roadmap', 'future']), V('in-progress', 'In progress', ['implementing', 'underway', 'wip']), V('implemented', 'Implemented', ['in place', 'done', 'deployed', 'live', 'current', 'existing', 'as is']), V('verified', 'Verified', ['tested', 'validated', 'audited', 'confirmed']), V('not-implemented', 'Not implemented', ['missing', 'absent', 'none']), V('retired', 'Retired', ['removed', 'decommissioned'])],
  adversary: [V('activist', 'Activist', ['hacktivist', 'protest']), V('competitor', 'Competitor', ['rival', 'competition']), V('crime-syndicate', 'Crime syndicate', ['organised crime', 'organized crime', 'ransomware gang', 'cartel']), V('criminal', 'Criminal', ['fraudster', 'thief']), V('hacker', 'Hacker', ['attacker', 'external attacker', 'opportunist', 'script kiddie']), V('insider-accidental', 'Accidental insider', ['careless employee', 'negligent', 'mistake', 'human error']), V('insider-disgruntled', 'Disgruntled insider', ['malicious insider', 'rogue employee', 'angry employee']), V('nation-state', 'Nation state', ['state sponsored', 'apt', 'government actor', 'foreign intelligence']), V('sensationalist', 'Sensationalist', ['attention seeker', 'publicity']), V('spy', 'Spy', ['espionage', 'industrial espionage']), V('terrorist', 'Terrorist', ['terror']), V('malicious-user', 'Malicious user', ['abusive customer', 'authenticated attacker', 'legitimate user abusing']), V('compromised-credential-holder', 'Compromised credential holder', ['stolen credentials', 'account takeover', 'phished account', 'hijacked account']), V('third-party', 'Third party / supply chain', ['vendor', 'supplier', 'partner', 'supply chain', 'contractor']), V('automated-bot', 'Automated bot', ['bot', 'scanner', 'botnet', 'automation', 'crawler']), V('non-adversarial', 'Non-adversarial', ['outage', 'disaster', 'failure', 'accident', 'weather']), V('unknown', 'Unknown', ['unsure', 'not known'])],
  gain: [
    V('foothold', 'Foothold', ['initial access', 'landed', 'session on', 'code runs', 'shell', 'beachhead', 'interactive session'], 'A session or running code on the target'),
    V('credentials', 'Credentials', ['password', 'passwords', 'secret', 'secrets', 'key', 'hash', 'creds', 'saved login'], 'Secrets usable elsewhere'),
    V('token', 'Token', ['bearer', 'jwt', 'access token', 'oauth token', 'managed identity token', 'imds', 'sas token'], 'A token usable elsewhere'),
    V('session', 'Session', ['cookie', 'session cookie', 'hijack', 'hijacked session'], 'A live session'),
    V('network-access', 'Network Access', ['reachability', 'can reach', 'network path', 'pivot', 'port open', 'line of sight', 'route to'], 'New reachability'),
    V('code-execution', 'Code Execution', ['rce', 'execute', 'run code', 'command execution', 'arbitrary code'], 'Runs code on the target'),
    V('data-access', 'Data Access', ['read data', 'query', 'dump', 'access database', 'read the table', 'read'], 'Can read the asset in place'),
    V('data-exfiltration', 'Data Exfiltration', ['exfil', 'exfiltrate', 'steal data', 'copy out', 'leak', 'download the data'], 'Data leaves'),
    V('privilege', 'Privilege', ['escalate', 'escalation', 'admin', 'root', 'elevated', 'eop', 'system'], 'Higher rights on the same system'),
    V('persistence', 'Persistence', ['backdoor', 'implant', 'scheduled task', 'persist', 'stays', 'survives reboot'], 'Stays after reboot or cleanup'),
    V('lateral-movement', 'Lateral Movement', ['move laterally', 'next host', 'another system', 'pivot host', 'hop to'], 'A position on another system'),
    V('denial-of-service', 'Denial of Service', ['dos', 'outage', 'crash', 'ransom', 'ransomware', 'unavailable'], 'Takes something down'),
    V('impact', 'Impact', ['business impact', 'fraud', 'damage', 'end state', 'money', 'fines'], 'The business effect itself'),
  ],
  vulnerability: [
    V('unauthorized-access', 'Unauthorized access', ['broken access control', 'access control', 'missing authorization', 'idor', 'bola', 'unauthorised access', 'bypass authorization'], 'Reaching data or functions without being allowed to'),
    V('broken-authentication', 'Broken authentication', ['weak authentication', 'missing authentication', 'no mfa', 'credential stuffing', 'session fixation', 'weak password'], 'Authentication that can be bypassed or brute-forced'),
    V('credential-exposure', 'Credential exposure', ['hardcoded secret', 'plaintext password', 'leaked key', 'secret in code', 'exposed key'], 'Secrets stored or transmitted where they can be taken'),
    V('injection', 'Injection', ['sql injection', 'sqli', 'command injection', 'xss', 'cross-site scripting', 'ldap injection'], 'Untrusted input interpreted as code or query'),
    V('improper-input-validation', 'Improper input validation', ['unvalidated input', 'deserialization', 'insecure deserialization', 'bad input'], 'Input accepted without checks'),
    V('security-misconfiguration', 'Security misconfiguration', ['misconfiguration', 'default settings', 'default password', 'open port', 'public bucket', 'verbose errors', 'drift'], 'Insecure or default settings'),
    V('missing-or-weak-encryption', 'Missing or weak encryption', ['cleartext', 'plaintext transmission', 'unencrypted', 'weak cipher', 'tls 1.0', 'no tls', 'http'], 'Data unprotected in transit or at rest'),
    V('sensitive-data-exposure', 'Sensitive data exposure', ['data leak', 'over-exposure', 'excessive data', 'information exposure'], 'More data exposed than necessary'),
    V('insufficient-logging-monitoring', 'Insufficient logging and monitoring', ['no logging', 'no audit trail', 'logs not reviewed', 'no alerting', 'blind spot'], 'Attacks go unnoticed'),
    V('insecure-design', 'Insecure design', ['design flaw', 'missing control', 'no rate limit', 'trusts the client', 'business logic'], 'A control missing by design'),
    V('vulnerable-components', 'Vulnerable or outdated components', ['outdated', 'unpatched', 'cve', 'end of life', 'eol', 'old library', 'known vulnerability'], 'Known-vulnerable or unsupported software'),
    V('supply-chain', 'Supply chain', ['compromised dependency', 'malicious package', 'build pipeline', 'vendor update', 'software supply chain'], 'Compromise through what you depend on'),
    V('ssrf', 'Server-side request forgery', ['server side request forgery', 'metadata service', 'imds', 'internal fetch'], 'The server fetches attacker-chosen URLs'),
    V('privilege-escalation', 'Privilege escalation', ['excessive permissions', 'over-privileged', 'local escalation', 'vertical escalation', 'sudo'], 'Gaining higher rights than granted'),
    V('excessive-trust-or-flat-network', 'Excessive trust / flat network', ['lateral movement', 'no segmentation', 'flat network', 'implicit trust', 'trust relationship'], 'Once in, everything is reachable'),
    V('resource-exhaustion', 'Resource exhaustion', ['dos', 'ddos', 'denial of service', 'unbounded consumption', 'flood', 'rate limit'], 'Capacity consumed until unavailable'),
    V('availability-failure', 'Availability failure', ['single point of failure', 'spof', 'outage', 'no backup', 'no redundancy', 'no dr'], 'Non-malicious loss of service'),
    V('improper-error-handling', 'Improper error handling', ['fail open', 'crash', 'exception', 'stack trace', 'error message'], 'Failures that expose data or open access'),
    V('malware-execution', 'Malware execution', ['malware', 'ransomware', 'virus', 'malicious code', 'trojan'], 'Malicious code runs on the target'),
    V('phishing-social-engineering', 'Phishing / social engineering', ['phishing', 'social engineering', 'pretexting', 'mfa fatigue', 'push bombing', 'vishing'], 'People tricked into granting access'),
    V('insider-misuse', 'Insider misuse', ['insider abuse', 'abuse of access', 'privilege abuse'], 'Legitimate access used for the wrong ends'),
    V('physical-access', 'Physical access', ['theft', 'tailgating', 'console', 'stolen laptop', 'physical'], 'Hands on the hardware'),
    V('data-exfiltration', 'Data exfiltration', ['exfiltration', 'data theft', 'unapproved transfer', 'dlp'], 'Data leaving by an unapproved path'),
    V('third-party-dependency', 'Third-party dependency', ['vendor outage', 'saas breach', 'partner compromise', 'dependency on provider'], 'A partner or provider fails or is breached'),
    V('race-condition', 'Race condition', ['toctou', 'timing', 'concurrency'], 'Timing windows between check and use'),
    V('memory-safety', 'Memory safety', ['buffer overflow', 'overflow', 'use after free', 'memory corruption'], 'Memory corruption bugs'),
    V('other', 'Other', ['n/a', 'unknown'], 'Anything else; describe it'),
  ],
  classification: [V('public', 'Public', ['public information', 'open', 'unclassified']), V('internal', 'Internal', ['internal use', 'proprietary', 'business use only', 'internal only']), V('confidential', 'Confidential', ['need to know', 'sensitive', 'private']), V('restricted', 'Restricted', ['highly confidential', 'secret', 'top secret', 'strictly confidential', 'highly sensitive'])],
  data_tag: [V('pii', 'PII', ['personal data', 'personally identifiable', 'personal information', 'gdpr']), V('sensitive-pii', 'Sensitive PII', ['special category', 'biometric', 'sensitive personal information', 'spi']), V('phi', 'PHI', ['health', 'medical', 'hipaa', 'patient']), V('pci', 'PCI cardholder data', ['card data', 'payment card', 'cardholder', 'credit card', 'pan']), V('financial', 'Financial', ['financial records', 'banking', 'accounts']), V('npi', 'NPI', ['non-public information', 'nonpublic personal information', 'glba']), V('mnpi', 'MNPI', ['material non-public', 'insider information', 'sec']), V('fci', 'FCI', ['federal contract information']), V('cui', 'CUI', ['controlled unclassified', 'nist 800-171', 'cmmc']), V('export-controlled', 'Export controlled', ['itar', 'ear', 'export']), V('proprietary', 'Proprietary', ['proprietary information', 'company confidential']), V('trade-secret', 'Trade secret', ['trade secrets', 'formula', 'recipe']), V('credentials', 'Credentials', ['secrets', 'passwords', 'keys', 'tokens']), V('intellectual-property', 'Intellectual property', ['ip', 'source code', 'designs', 'patents']), V('mission-critical', 'Mission critical', ['business critical', 'critical', 'tier 0 data']), V('classified', 'Classified', ['national security', 'secret', 'top secret']), V('other', 'Other', [])],
  security_protocol: [V('tls-1.3', 'TLS 1.3', ['tls1.3', 'tls 13']), V('tls-1.2', 'TLS 1.2', ['tls1.2', 'tls', 'https', 'ssl/tls', 'ftps', 'ldaps', 'smtps']), V('tls-1.1', 'TLS 1.1', ['tls1.1']), V('tls-1.0', 'TLS 1.0', ['tls1.0', 'tls1']), V('ssl-3', 'SSL 3.0', ['ssl3', 'sslv3', 'ssl']), V('ssh-2', 'SSH', ['ssh', 'sftp', 'scp']), V('ipsec-esp', 'IPsec ESP', ['ipsec', 'esp', 'vpn', 'ikev2']), V('ipsec-ah', 'IPsec AH', ['ah']), V('wireguard', 'WireGuard', []), V('dtls', 'DTLS', []), V('quic', 'QUIC', ['http/3', 'http3']), V('smb3-encryption', 'SMB 3 encryption', ['smb encryption', 'smb3']), V('smb-signing', 'SMB signing', ['signing']), V('kerberos-encryption', 'Kerberos encryption', ['kerberos']), V('application-layer-encryption', 'Application-layer encryption', ['payload encryption', 'end-to-end encryption', 'e2ee', 'jwe']), V('none', 'None', ['plaintext', 'cleartext', 'http', 'ftp', 'telnet', 'unencrypted']), V('unknown', 'Unknown', ['unsure'])],
  client_auth: [V('none', 'None', ['anonymous', 'no auth', 'unauthenticated']), V('basic-auth', 'HTTP Basic', ['basic']), V('password', 'Password', ['username password', 'user/pass', 'credentials']), V('api-key', 'API key', ['apikey', 'key header']), V('bearer-token-oauth2', 'OAuth 2.0 bearer token', ['bearer', 'oauth', 'oauth2', 'jwt', 'access token']), V('oidc-id-token', 'OIDC ID token', ['oidc', 'openid']), V('saml-assertion', 'SAML assertion', ['saml']), V('x509-certificate-mtls', 'Client certificate (mTLS)', ['mtls', 'mutual tls', 'client cert', 'x509', 'certificate']), V('hardware-bound-certificate', 'Hardware-bound certificate', ['tpm cert', 'smart card', 'piv', 'hardware certificate']), V('ssh-key', 'SSH key', ['ssh']), V('kerberos-ticket', 'Kerberos ticket', ['kerberos', 'windows auth', 'integrated auth']), V('ntlm', 'NTLM', ['ntlmv2']), V('request-signing-hmac', 'Request signing (HMAC)', ['sigv4', 'hmac', 'signed request']), V('workload-identity', 'Workload identity', ['spiffe', 'svid', 'service account token', 'federated identity']), V('managed-identity', 'Managed identity', ['msi', 'instance role', 'iam role', 'service identity']), V('ip-allow-list', 'IP allow-list', ['ip whitelist', 'allowlist', 'source ip']), V('other', 'Other', [])],
  server_auth: [V('x509-certificate', 'X.509 certificate', ['tls certificate', 'server cert', 'certificate']), V('ssh-host-key', 'SSH host key', ['host key']), V('kerberos-spn', 'Kerberos SPN', ['spn']), V('pre-shared-key', 'Pre-shared key', ['psk', 'shared key']), V('none', 'None', ['no server auth']), V('other', 'Other', [])],
  credential_storage: [V('hsm', 'HSM', ['hardware security module', 'cloudhsm', 'luna']), V('tpm', 'TPM / secure enclave', ['tpm', 'secure enclave', 'trusted platform module']), V('smart-card-token', 'Smart card / hardware token', ['yubikey', 'smart card', 'piv', 'fido key']), V('cloud-key-vault', 'Cloud key vault / KMS', ['key vault', 'kms', 'secrets manager', 'secret manager', 'akv']), V('secrets-manager-vault', 'Secrets manager (Vault)', ['hashicorp vault', 'cyberark', 'conjur', 'vault']), V('os-certificate-store', 'OS certificate store', ['windows certificate store', 'dpapi', 'keychain', 'cert store', 'keyring']), V('container-secret', 'Container secret', ['kubernetes secret', 'k8s secret', 'docker secret']), V('encrypted-file-passphrase', 'Encrypted file with passphrase', ['pfx', 'p12', 'encrypted pem', 'passphrase']), V('file-on-disk', 'File on disk', ['pem file', 'key file', 'on disk', 'unencrypted file']), V('environment-variable', 'Environment variable', ['env var', 'env']), V('config-file-plaintext', 'Config file (plaintext)', ['config file', 'appsettings', 'web.config', 'properties file', 'ini']), V('source-code', 'Source code', ['hardcoded', 'in code', 'repo', 'git']), V('unknown', 'Unknown', [])],
  factors: [V('single', 'Single factor', ['one factor', '1fa', 'sfa', 'password only']), V('multi', 'Multi-factor', ['mfa', '2fa', 'two factor', 'multifactor', 'second factor'])],
  platform_category: [V('physical-server', 'Physical server', ['bare metal', 'physical']), V('virtual-machine', 'Virtual machine', ['vm', 'virtual', 'ec2', 'azure vm']), V('container', 'Container', ['docker']), V('kubernetes', 'Kubernetes', ['k8s', 'aks', 'eks', 'gke', 'openshift']), V('serverless', 'Serverless', ['lambda', 'functions', 'faas']), V('paas', 'PaaS', ['app service', 'platform service', 'managed service']), V('saas', 'SaaS', ['cloud app', 'subscription service']), V('network-appliance', 'Network appliance', ['firewall', 'router', 'switch', 'load balancer', 'appliance']), V('mainframe', 'Mainframe', ['z/os', 'ibm i', 'as/400']), V('workstation', 'Workstation', ['desktop', 'laptop', 'pc']), V('mobile', 'Mobile', ['phone', 'tablet', 'ios', 'android']), V('iot-ot', 'IoT / OT', ['iot', 'ot', 'plc', 'scada', 'sensor', 'controller']), V('other', 'Other', [])],
  hosting: [V('on-premises-datacenter', 'On-premises data centre', ['on-prem', 'on premise', 'datacenter', 'data center', 'dc']), V('colocation', 'Colocation', ['colo']), V('public-cloud', 'Public cloud', ['aws', 'azure', 'gcp', 'cloud']), V('private-cloud', 'Private cloud', ['vmware cloud', 'openstack']), V('edge-branch', 'Edge / branch', ['branch', 'edge', 'store', 'factory']), V('home', 'Home', ['remote', 'home office']), V('third-party-hosted', 'Third-party hosted', ['hosted', 'msp', 'outsourced']), V('mobile', 'Mobile', ['in transit'])],
  elevated_access_model: [V('none', 'None', ['no admin', 'no interactive']), V('standing-admin', 'Standing admin', ['permanent admin', 'always admin', 'persistent privileges']), V('shared-admin-account', 'Shared admin account', ['shared account', 'shared credential', 'root shared']), V('just-in-time', 'Just-in-time', ['jit', 'pim', 'time-boxed', 'eligible']), V('pam-vaulted', 'PAM vaulted', ['pam', 'vaulted', 'cyberark', 'brokered session']), V('break-glass-only', 'Break-glass only', ['emergency account', 'break glass'])],
  hardening_baseline: [V('cis-level-1', 'CIS Level 1', ['cis l1', 'cis 1', 'cis benchmark']), V('cis-level-2', 'CIS Level 2', ['cis l2', 'cis 2']), V('disa-stig', 'DISA STIG', ['stig']), V('vendor-baseline', 'Vendor baseline', ['microsoft baseline', 'security baseline', 'hardened image']), V('organization-baseline', 'Organization baseline', ['our baseline', 'internal standard', 'company standard']), V('none', 'None', ['not hardened', 'default']), V('unknown', 'Unknown', [])],
  sourcing: [V('cots', 'COTS', ['commercial off the shelf', 'commercial', 'off the shelf', 'vendor product']), V('cots-customized', 'COTS, customized', ['customized cots', 'configured product']), V('gots', 'GOTS', ['government off the shelf']), V('open-source', 'Open source', ['oss', 'foss', 'open-source']), V('custom-developed', 'Custom developed', ['in-house', 'bespoke', 'custom', 'built by us', 'homegrown']), V('saas', 'SaaS', ['subscription', 'cloud service']), V('hybrid', 'Hybrid', ['mixed'])],
  connection_type: [V('request-response', 'Request / response', ['api call', 'http', 'rest', 'rpc', 'query']), V('streaming', 'Streaming', ['stream', 'websocket', 'event stream']), V('batch-file-transfer', 'Batch file transfer', ['file transfer', 'sftp', 'batch', 'nightly job', 'ftp']), V('message-queue', 'Message queue', ['queue', 'pub/sub', 'topic', 'kafka', 'service bus', 'amqp']), V('replication', 'Replication', ['sync', 'mirror', 'replica', 'backup']), V('management', 'Management', ['admin', 'management plane', 'control']), V('remote-session', 'Remote session', ['rdp', 'ssh session', 'vnc', 'remote desktop']), V('tunnel', 'Tunnel', ['vpn', 'ipsec', 'wireguard']), V('dns', 'DNS', ['name resolution']), V('email', 'Email', ['smtp', 'mail']), V('other', 'Other', [])],
  initiator: [V('from', 'Source initiates', ['client', 'source', 'push', 'caller', 'outbound']), V('to', 'Destination initiates', ['server', 'destination', 'pull', 'callback', 'polls']), V('either', 'Either side', ['both', 'bidirectional', 'peer'])],
  scope: [V('in', 'In scope', ['in', 'included', 'yes', 'modelled']), V('out', 'Out of scope', ['out', 'excluded', 'no', 'not in scope', 'context only'])],
};

const canon = (s) => String(s || '').toLowerCase().replace(/[_\-./]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => new Set(canon(s).split(' ').filter(Boolean));
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
const ratio = (a, b) => { if (!a.length && !b.length) return 1; return 1 - lev(a, b) / Math.max(a.length, b.length); };
function scoreAgainst(text, phrase) {
  const t = canon(text), p = canon(phrase); if (!t || !p) return 0;
  if (t === p) return 1;
  if (t.includes(p) || p.includes(t)) return 0.85 + 0.1 * Math.min(t.length, p.length) / Math.max(t.length, p.length);
  const A = tokens(t), B = tokens(p); const inter = [...A].filter((x) => B.has(x)).length; const jac = inter / (A.size + B.size - inter || 1);
  return Math.max(jac * 0.9, ratio(t, p) * 0.8);
}
export function suggest(options, text) {
  // options: array of ids (strings) or vocab entries
  const entries = options.map((o) => typeof o === 'string' ? { id: o, label: o.replace(/-/g, ' '), syn: [] } : o);
  const scored = entries.map((e) => { let s = scoreAgainst(text, e.id); s = Math.max(s, scoreAgainst(text, e.label)); for (const y of e.syn || []) s = Math.max(s, scoreAgainst(text, y) * 0.98); return { value: e.id, label: e.label, score: Math.round(s * 100) / 100 }; }).sort((a, b) => b.score - a.score);
  return scored;
}
export function normalize(field, text) {
  const vocab = VOCAB[field]; if (!vocab) throw new Error(`unknown field "${field}"; one of ${Object.keys(VOCAB).join(', ')}`);
  const candidates = suggest(vocab, text).slice(0, 3);
  const best = candidates[0];
  const confidence = best ? best.score : 0;
  return { field, input: text, value: confidence >= 0.6 ? best.value : null, confidence, candidates, ask: confidence < 0.8 };
}
export function describe(field) { const v = VOCAB[field]; if (!v) throw new Error(`unknown field "${field}"`); return v.map((e) => ({ id: e.id, label: e.label, description: e.desc || '' })); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const a = process.argv.slice(2);
  if (!a.length || a.includes('-h') || a.includes('--help')) { console.error('usage: node scripts/normalize.mjs <field> "<text>" | --fields | --describe <field>'); process.exit(a.length ? 0 : 2); }
  if (a[0] === '--fields') { console.log(Object.keys(VOCAB).join('\n')); process.exit(0); }
  if (a[0] === '--describe') { describe(a[1]).forEach((e) => console.log(`${e.id.padEnd(34)} ${e.label}${e.description ? ' — ' + e.description : ''}`)); process.exit(0); }
  try { console.log(JSON.stringify(normalize(a[0], a.slice(1).join(' ')), null, 2)); } catch (e) { console.error(`normalize: ${e.message}`); process.exit(2); }
}
