/**
 * rules.mjs — the threat rules behind scripts/suggest.mjs: STRIDE per interaction, written down.
 *
 * Each rule looks at the model through a small context (flows with their sides, strengths and boundary crossings; elements with
 * their profiles) and returns candidate threats. A candidate carries everything a threat needs (targets, STRIDE, the weakness and
 * its CWE, ATT&CK references, an adversary, default likelihood and impact, a mitigation written as an engineering action), so that
 * suggest.mjs can list it or write it into the model as `suggested: true` with `suggested_from: "rule:<id>"`. Nothing here decides;
 * the user confirms or retires every suggestion, like a cloud card's.
 *
 * Conventions: `title` is Title Case (validate --fix fixes it anyway); `cwe` is one id or null; `tactics` are ATT&CK v20 tactic ids;
 * `techniques` are ATT&CK technique ids; likelihood and impact use the five bands; `position` is where the adversary stands.
 */

const WEAK_STORE = ['config-file-plaintext', 'source-code', 'environment-variable', 'file-on-disk'];
const DEPRECATED_TLS = { 'tls-1.1': 'TLS 1.1', 'tls-1.0': 'TLS 1.0', 'ssl-3': 'SSL 3' };
const SENSITIVE = ['confidential', 'restricted'];
const DATA_STORE = ['database', 'storage'];
const WEB_TARGET = ['service', 'api', 'server', 'host', 'public-endpoint', 'saas', 'connector', 'generic'];
const ADMIN_PROTO = /\b(rdp|ssh|winrm|vnc|telnet|psremoting|powershell remoting)\b/i;
const cap = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

/** Rules in the order they are reported. `applies(ctx)` returns candidates: { subject, targets, title, description, mitigation, ...overrides }. */
export const RULES = [
  {
    id: 'R001', name: 'Unauthenticated flow from the Internet', stride: ['spoofing', 'elevation-of-privilege'], category: 'broken-authentication', cwe: 'CWE-306',
    tactics: ['TA0001'], techniques: ['T1190'], adversary: { type: 'hacker', position: 'external' }, likelihood: 'high', impact: 'high',
    why: 'A flow from the Internet side into the private side with no authentication, or none recorded, lets anyone who can reach the endpoint use it as the intended client would.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.crossesInternet && f.fromSide === 'internet' && !f.fromBadActor && ['none', 'unspecified'].includes(f.strength) && !['auth', 'token'].includes(f.kind) && f.classification !== 'public')
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], boundary: { type: 'internet', from: 'internet', to: f.toZone },
        title: `Unauthenticated Access to ${f.toLabel} from the Internet`,
        description: `${f.fromLabel} reaches ${f.toLabel} over ${f.proto || 'the network'} with ${f.strength === 'none' ? 'no authentication' : 'no authentication recorded'}; anyone who can reach the endpoint can do what ${f.fromLabel} does.`,
        mitigation: `Require authentication on ${f.name} (an identity-aware proxy, OIDC or mTLS in front of ${f.toLabel}) and deny anonymous requests at the boundary; if the flow is authenticated today, record how.` })),
  },
  {
    id: 'R002', name: 'Password-only sign-in from the Internet', stride: ['spoofing'], category: 'broken-authentication', cwe: 'CWE-307',
    tactics: ['TA0006', 'TA0001'], techniques: ['T1110', 'T1078'], adversary: { type: 'automated-bot', position: 'external' }, likelihood: 'high', impact: 'moderate',
    why: 'Weak authentication (a password, Basic auth, an API key) on an Internet-facing flow is what credential stuffing, password spraying and MFA fatigue are built for.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.crossesInternet && f.fromSide === 'internet' && !f.fromBadActor && f.strength === 'weak')
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], boundary: { type: 'internet', from: 'internet', to: f.toZone },
        title: `Credential Stuffing Against ${f.toLabel}: ${cap(f.authLabel)} Only`,
        description: `${f.fromLabel} signs in to ${f.toLabel} with ${f.authLabel} and nothing stronger; leaked password lists and bots try every account at machine speed.`,
        mitigation: `MFA on ${f.name} (phishing-resistant for administrators), lockout and rate limits per account and per source, breached-password checks, and sign-in risk evaluation.` })),
  },
  {
    id: 'R003', name: 'Sensitive data over an unencrypted flow', stride: ['information-disclosure', 'tampering'], category: 'missing-or-weak-encryption', cwe: 'CWE-319',
    tactics: ['TA0009'], techniques: ['T1040'], adversary: { type: 'hacker' }, likelihood: 'moderate', impact: 'high',
    why: 'Confidential or restricted data in the clear can be read or changed by anyone on the path: a shared network, a cloud provider edge, a compromised neighbour.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.plain && f.sensitive && !f.fromBadActor)
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], position: f.crossesInternet ? 'external' : 'internal',
        title: `Unencrypted ${cap(f.classification || 'Sensitive')} Data Between ${f.fromLabel} and ${f.toLabel}`,
        description: `${f.name} carries ${f.classification || 'sensitive'} data${f.tags.length ? ' (' + f.tags.join(', ') + ')' : ''} without confidentiality on the wire.`,
        mitigation: `TLS 1.2 or later (or IPsec, SSH) on ${f.name} with server certificate validation; disable the plaintext listener on ${f.toLabel}.` })),
  },
  {
    id: 'R004', name: 'Boundary crossed without a filtering appliance', stride: ['tampering', 'elevation-of-privilege'], category: 'excessive-trust-or-flat-network', cwe: 'CWE-923',
    tactics: ['TA0008'], techniques: ['T1021'], adversary: { type: 'hacker' }, likelihood: 'moderate', impact: 'moderate',
    why: 'A flow that enters a zone no appliance guards, with nothing stronger than a password on it, means the zone trusts its neighbours entirely: whatever compromises the source reaches the destination unfiltered.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.crossesZone && f.toSide === 'private' && !f.guarded && !f.fromEdge && f.strength !== 'strong' && !f.fromBadActor && !['auth', 'token', 'trust'].includes(f.kind))
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], boundary: { type: f.crossesInternet ? 'internet' : 'corporate-network', from: f.fromZone || 'internet', to: f.toZone },
        likelihood: f.crossesInternet ? 'high' : 'moderate', impact: f.crossesInternet ? 'high' : 'moderate', position: f.crossesInternet ? 'external' : 'internal',
        title: `${f.toZoneLabel} Admits ${f.name === f.label ? 'Traffic' : f.label || 'Traffic'} from ${f.fromZoneLabel} Without Inspection`,
        description: `${f.name} enters ${f.toZoneLabel} from ${f.fromZoneLabel} and no firewall, security group or gateway on the way filters it; a compromise of ${f.fromLabel} reaches ${f.toLabel} directly.`,
        mitigation: `A firewall, NSG or gateway on the edge of ${f.toZoneLabel} that admits only ${f.proto || 'this flow'} from ${f.fromLabel} and denies the rest; model it as an appliance of the zone.` })),
  },
  {
    id: 'R005', name: 'Administrative session without phishing-resistant MFA', stride: ['spoofing', 'elevation-of-privilege'], category: 'broken-authentication', cwe: 'CWE-308',
    tactics: ['TA0001', 'TA0004'], techniques: ['T1078', 'T1021'], adversary: { type: 'compromised-credential-holder' }, likelihood: 'moderate', impact: 'high',
    why: 'An administrative session is the highest-value sign-in on the diagram; a stolen or phished credential without strong MFA is a full compromise of the target.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.admin && !f.fromBadActor && f.strength !== 'strong' && !['trust', 'blocked'].includes(f.kind))
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `Administrative Session to ${f.toLabel} Without Phishing-Resistant MFA`,
        description: `${f.fromLabel} administers ${f.toLabel} over ${f.proto || 'a remote session'} with ${f.authLabel || 'unspecified authentication'}; a phished or replayed credential gives full control.`,
        mitigation: `Phishing-resistant MFA (FIDO2 or certificate) for every administrative sign-in on ${f.name}, through a bastion or a privileged access workstation; no standing credentials on the target.` })),
  },
  {
    id: 'R006', name: 'Administrative actions not recorded', stride: ['repudiation'], category: 'insufficient-logging-monitoring', cwe: 'CWE-778',
    tactics: ['TA0005'], techniques: ['T1070'], adversary: { type: 'insider-disgruntled', position: 'internal' }, likelihood: 'moderate', impact: 'moderate',
    why: 'Without a session record, a harmful administrative action cannot be attributed, reconstructed or proven, and an insider knows it.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.admin && !f.fromBadActor && (f.logged === false || (f.toProfile && f.toProfile.elevated_access && f.toProfile.elevated_access.session_recording === false)))
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `Administrative Actions on ${f.toLabel} Leave No Attributable Record`,
        description: `${f.name} is ${f.logged === false ? 'not logged' : 'not session-recorded'}; what an administrator did on ${f.toLabel}, and who, cannot be shown afterwards.`,
        mitigation: `Session recording on the bastion or PAM for ${f.name}, privileged command logging shipped to the SIEM, and alerts on out-of-hours or unusual use.` })),
  },
  {
    id: 'R007', name: 'Sensitive or boundary-crossing flow not logged', stride: ['repudiation'], category: 'insufficient-logging-monitoring', cwe: 'CWE-778',
    tactics: ['TA0005'], techniques: ['T1070'], adversary: { type: 'unknown' }, likelihood: 'moderate', impact: 'moderate',
    why: 'A flow that carries sensitive data or crosses a boundary without a log cannot be investigated after misuse, and misuse of it will not be noticed.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.logged === false && !f.admin && !f.fromBadActor && (f.sensitive || f.crossesInternet))
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `No Log of ${f.label || f.name} to Detect or Investigate Misuse`,
        description: `${f.name} (${f.fromLabel} to ${f.toLabel}) is not logged although it ${f.sensitive ? 'carries ' + (f.classification || 'sensitive') + ' data' : 'crosses the Internet boundary'}.`,
        mitigation: `Log ${f.name} at ${f.toLabel} or at the appliance on its path, with the caller's identity and the request, retained per policy and searchable in the SIEM.` })),
  },
  {
    id: 'R008', name: 'Data store reachable from the Internet', stride: ['information-disclosure'], category: 'security-misconfiguration', cwe: 'CWE-284',
    tactics: ['TA0009', 'TA0010'], techniques: ['T1530'], adversary: { type: 'hacker', position: 'external' }, likelihood: 'high', impact: 'high',
    why: 'A database or storage service with an Internet path is one misconfigured rule or one leaked credential away from a bulk disclosure.',
    applies: (ctx) => ctx.elements.filter((e) => e.kind === 'node' && DATA_STORE.includes(e.type) && (e.exposure === 'internet' || e.exposure === 'hybrid' || ctx.flows.some((f) => f.live && f.toOwner === e.name && f.fromSide === 'internet' && !f.fromBadActor && f.kind !== 'blocked')))
      .map((e) => ({ subject: e, targets: [{ kind: 'node', ref: e.name }], boundary: { type: 'internet', from: 'internet', to: e.zone },
        title: `${e.label} Is Reachable from the Internet`,
        description: `${e.label} (${e.type}) ${e.exposure ? 'has ' + e.exposure + ' exposure' : 'receives a flow from the Internet side'}; a misconfigured rule or a leaked credential exposes every record.`,
        mitigation: `Private endpoint or VPC-only access for ${e.label}; public network access disabled; a firewall allow-list limited to the application subnets; keep it off the Internet side of the diagram once done.` })),
  },
  {
    id: 'R009', name: 'Sensitive data entrusted to a third party', stride: ['information-disclosure'], category: 'third-party-dependency', cwe: null,
    tactics: [], techniques: [], adversary: { type: 'third-party', position: 'trusted-third-party' }, likelihood: 'low', impact: 'high',
    why: 'Data sent to a SaaS or partner is protected by their controls and their contract, not yours; a breach or a subpoena there is a breach here.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.sensitive && f.toType === 'saas' && !f.fromBadActor).filter((f, i, a) => a.findIndex((g) => g.toOwner === f.toOwner) === i)
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }, { kind: 'node', ref: f.toOwner, marker: false }], boundary: { type: 'third-party', from: f.fromZone || 'internet', to: 'internet' },
        title: `${cap(f.classification || 'Sensitive')} Data Entrusted to ${f.toLabel}`,
        description: `${f.name} sends ${f.classification || 'sensitive'} data${f.tags.length ? ' (' + f.tags.join(', ') + ')' : ''} to ${f.toLabel}, a third party whose controls this model cannot see.`,
        mitigation: `A data processing agreement and minimisation on ${f.name}; tenant-level encryption keys where ${f.toLabel} offers them; a vendor assessment, breach notification terms and an exit plan.` })),
  },
  {
    id: 'R010', name: 'Single point of failure', stride: ['denial-of-service'], category: 'availability-failure', cwe: null,
    tactics: ['TA0040'], techniques: [], adversary: { type: 'non-adversarial' }, likelihood: 'moderate', impact: 'moderate',
    why: 'A flow marked as a single point of failure stops the service when its link, zone or instance fails, whether by accident or by attack.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.availability && f.availability.single_point_of_failure === true)
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `Outage of ${f.label || f.name} Stops the Service`,
        description: `${f.name} (${f.fromLabel} to ${f.toLabel}) is a single point of failure: there is no second path and no failover.`,
        mitigation: `A redundant path for ${f.name} (a second link, zone or instance) with a tested failover and a health check that switches automatically.` })),
  },
  {
    id: 'R011', name: 'Deprecated transport security', stride: ['information-disclosure'], category: 'missing-or-weak-encryption', cwe: 'CWE-326',
    tactics: ['TA0009'], techniques: ['T1557'], adversary: { type: 'hacker' }, likelihood: 'moderate', impact: 'moderate',
    why: 'TLS 1.0, TLS 1.1 and SSL 3 are deprecated (RFC 8996) and downgrade or decryption attacks against them are practical.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.transport && DEPRECATED_TLS[f.transport.security_protocol])
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `Deprecated ${DEPRECATED_TLS[f.transport.security_protocol]} on ${f.label || f.name}`,
        description: `${f.name} is protected by ${DEPRECATED_TLS[f.transport.security_protocol]}, which is deprecated and attackable.`,
        mitigation: `TLS 1.2 or later only on both ends of ${f.name}; disable the legacy protocol versions and weak cipher suites on ${f.toLabel}.` })),
  },
  {
    id: 'R012', name: 'Server certificate not validated', stride: ['spoofing'], category: 'missing-or-weak-encryption', cwe: 'CWE-295',
    tactics: ['TA0009'], techniques: ['T1557'], adversary: { type: 'hacker' }, likelihood: 'moderate', impact: 'high',
    why: 'A client that does not validate the server certificate, or trusts a self-signed one without pinning, cannot tell the real server from an impostor on the path.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.transport && (f.transport.certificate_validation === 'disabled' || (f.authentication && f.authentication.server && f.authentication.server.certificate_issuer === 'self-signed' && f.transport.certificate_validation !== 'pinned')))
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `${f.fromLabel} Cannot Tell ${f.toLabel} from an Impostor`,
        description: `${f.name} ${f.transport.certificate_validation === 'disabled' ? 'does not validate the server certificate' : 'trusts a self-signed certificate without pinning it'}; an adversary on the path can present their own.`,
        mitigation: `Validate the server certificate on ${f.name} against a trusted CA, or pin the self-signed certificate; fail closed on a mismatch.` })),
  },
  {
    id: 'R013', name: 'Credential stored in plaintext', stride: ['information-disclosure', 'spoofing'], category: 'credential-exposure', cwe: 'CWE-522',
    tactics: ['TA0006'], techniques: ['T1552'], adversary: { type: 'compromised-credential-holder' }, likelihood: 'moderate', impact: 'high',
    why: 'A credential in a configuration file, an environment variable, source code or a file on disk is read by anyone who reads the host, the repository or the image.',
    applies: (ctx) => [
      ...ctx.flows.filter((f) => f.live && f.authentication && f.authentication.client && WEAK_STORE.includes(f.authentication.client.credential_storage)).map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], cwe: f.authentication.client.credential_storage === 'source-code' ? 'CWE-798' : 'CWE-522',
        title: `Credential for ${f.label || f.name} Stored in ${cap(f.authentication.client.credential_storage.replace(/-/g, ' '))}`,
        description: `The credential ${f.fromLabel} uses on ${f.name} lives in ${f.authentication.client.credential_storage.replace(/-/g, ' ')}; a read of the host or the repository is a read of the credential.`,
        mitigation: `Move the credential for ${f.name} to a vault or a managed identity, rotate it now, and scan the repository and images for the old value.` })),
      ...ctx.elements.filter((e) => e.profile && e.profile.device_authentication && WEAK_STORE.includes(e.profile.device_authentication.credential_storage)).map((e) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }], cwe: e.profile.device_authentication.credential_storage === 'source-code' ? 'CWE-798' : 'CWE-522',
        title: `${e.label}'s Own Credential Stored in ${cap(e.profile.device_authentication.credential_storage.replace(/-/g, ' '))}`,
        description: `${e.label} proves who it is with a credential kept in ${e.profile.device_authentication.credential_storage.replace(/-/g, ' ')}; whoever reads the host can impersonate it.`,
        mitigation: `A hardware-bound or vaulted credential for ${e.label} (TPM, HSM, key vault, managed identity); rotate the current one.` })),
    ],
  },
  {
    id: 'R014', name: 'End-of-life platform', stride: ['elevation-of-privilege'], category: 'vulnerable-components', cwe: 'CWE-1104',
    tactics: ['TA0001', 'TA0004'], techniques: ['T1190', 'T1068'], adversary: { type: 'hacker' }, likelihood: 'high', impact: 'high',
    why: 'An end-of-life platform receives no security fixes; every new vulnerability stays open for as long as it runs.',
    applies: (ctx) => ctx.elements.filter((e) => e.profile && e.profile.platform && e.profile.platform.support_status === 'end-of-life')
      .map((e) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }],
        title: `${e.label} Runs an End-of-Life Platform`,
        description: `${e.label} runs ${[e.profile.platform.os, e.profile.platform.runtime, e.profile.platform.version].filter(Boolean).join(' ') || 'a platform'} that no longer receives security fixes.`,
        mitigation: `Upgrade or replace the platform of ${e.label}; until then isolate it (its own segment, no inbound from user zones) and add compensating monitoring.` })),
  },
  {
    id: 'R015', name: 'No patching cadence', stride: ['elevation-of-privilege'], category: 'vulnerable-components', cwe: 'CWE-1395',
    tactics: ['TA0001'], techniques: ['T1190'], adversary: { type: 'hacker' }, likelihood: 'high', impact: 'moderate',
    why: 'A system that is never patched accumulates every published vulnerability of its platform.',
    applies: (ctx) => ctx.elements.filter((e) => e.profile && e.profile.patching && e.profile.patching.cadence === 'none')
      .map((e) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }],
        title: `${e.label} Is Never Patched`,
        description: `${e.label} has no patching cadence; published vulnerabilities in its platform stay exploitable.`,
        mitigation: `Put ${e.label} on the monthly patch cycle with SLAs by severity, and patch entries of the CISA Known Exploited Vulnerabilities catalogue within the KEV SLA.` })),
  },
  {
    id: 'R016', name: 'Standing or shared administrative access', stride: ['elevation-of-privilege', 'repudiation'], category: 'privilege-escalation', cwe: 'CWE-250',
    tactics: ['TA0004'], techniques: ['T1078'], adversary: { type: 'insider-disgruntled', position: 'internal' }, likelihood: 'moderate', impact: 'high',
    why: 'Standing administrative rights are usable by whoever holds the credential at any hour, and a shared administrator account cannot be attributed to a person.',
    applies: (ctx) => ctx.elements.filter((e) => e.profile && e.profile.elevated_access && ['standing-admin', 'shared-admin-account'].includes(e.profile.elevated_access.model))
      .map((e) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }], stride: e.profile.elevated_access.model === 'shared-admin-account' ? ['elevation-of-privilege', 'repudiation'] : ['elevation-of-privilege'],
        title: e.profile.elevated_access.model === 'shared-admin-account' ? `Shared Administrator Account on ${e.label}` : `Standing Administrative Access on ${e.label}`,
        description: e.profile.elevated_access.model === 'shared-admin-account' ? `${e.label} is administered with a shared account; actions cannot be attributed and the password is known to several people.` : `Administrators of ${e.label} hold their rights permanently; a stolen credential is an immediate full compromise.`,
        mitigation: `Just-in-time elevation through PAM with approval and expiry for ${e.label}; a named account per administrator; break-glass accounts sealed and monitored.` })),
  },
  {
    id: 'R017', name: 'Administrators without MFA', stride: ['spoofing', 'elevation-of-privilege'], category: 'broken-authentication', cwe: 'CWE-308',
    tactics: ['TA0001'], techniques: ['T1078'], adversary: { type: 'compromised-credential-holder' }, likelihood: 'high', impact: 'high',
    why: 'An administrator password without MFA is the single most common path from a phishing email to domain or tenant compromise.',
    applies: (ctx) => ctx.elements.filter((e) => e.profile && e.profile.elevated_access && e.profile.elevated_access.mfa_required === false && e.profile.elevated_access.model !== 'none')
      .map((e) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }],
        title: `Administrators Sign In to ${e.label} Without MFA`,
        description: `Administrative access to ${e.label} does not require MFA; a phished or reused password is enough.`,
        mitigation: `Phishing-resistant MFA for every administrative sign-in to ${e.label}, with conditional access by device compliance and location.` })),
  },
  {
    id: 'R018', name: 'No hardening baseline', stride: ['tampering', 'elevation-of-privilege'], category: 'security-misconfiguration', cwe: 'CWE-1188',
    tactics: ['TA0003'], techniques: [], adversary: { type: 'hacker' }, likelihood: 'moderate', impact: 'moderate',
    why: 'Vendor defaults leave services, accounts and protocols enabled that the system does not need; a baseline turns them off and keeps them off.',
    applies: (ctx) => ctx.elements.filter((e) => e.profile && e.profile.hardening && ['none', 'unknown'].includes(e.profile.hardening.baseline))
      .map((e) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }],
        title: `${e.label} Has No Hardening Baseline`,
        description: `${e.label} runs ${e.profile.hardening.baseline === 'none' ? 'without' : 'with an unknown'} hardening baseline; unneeded services and defaults widen its attack surface.`,
        mitigation: `Apply CIS Level 1 (or the vendor baseline) to ${e.label}, verify it with a scanner or configuration management, and record the exceptions.` })),
  },
  {
    id: 'R019', name: 'Risky protocol still enabled', stride: ['elevation-of-privilege'], category: 'security-misconfiguration', cwe: 'CWE-16',
    tactics: ['TA0001'], techniques: ['T1190'], adversary: { type: 'hacker', position: 'external' }, likelihood: 'moderate', impact: 'moderate',
    why: 'A legacy or insecure protocol a cloud card says to disable is still on; the card’s exposure questions were answered and this is the answer.',
    applies: (ctx) => ctx.elements.flatMap((e) => ((e.cloud && e.cloud.enabled_risky_protocols) || []).map((p) => {
      const k = p.toLowerCase();
      const m = /public|anonymous|allusers|blob public|bucket/.test(k) ? { stride: ['information-disclosure'], category: 'security-misconfiguration', cwe: 'CWE-284' }
        : /tls|ssl|plaintext|unencrypted|http(?!s)|ftp(?!s)|telnet/.test(k) ? { stride: ['information-disclosure'], category: 'missing-or-weak-encryption', cwe: 'CWE-319' }
        : /key|sas|token|secret|password/.test(k) ? { stride: ['spoofing', 'information-disclosure'], category: 'credential-exposure', cwe: 'CWE-522' }
        : { stride: ['elevation-of-privilege'], category: 'security-misconfiguration', cwe: 'CWE-16' };
      return { subject: e, targets: [{ kind: e.kind, ref: e.ref }], ...m,
        title: `${cap(p.replace(/[-_]/g, ' '))} Still Enabled on ${e.label}`,
        description: `${e.label} still has ${p} enabled although its service card lists it as a protocol to disable unless needed.`,
        mitigation: `Disable ${p} on ${e.label}, or record why it must stay on and the compensating control; move it to cloud.disabled_protocols once done.` };
    })),
  },
  {
    id: 'R020', name: 'Required dependency on a third party', stride: ['denial-of-service'], category: 'third-party-dependency', cwe: null,
    tactics: ['TA0040'], techniques: [], adversary: { type: 'non-adversarial' }, likelihood: 'moderate', impact: 'moderate',
    why: 'A required dependency on a SaaS, a partner or something off the diagram stops the service when that provider has an outage, a breach or a contract dispute.',
    applies: (ctx) => ctx.elements.flatMap((e) => (e.depends_on || []).filter((d) => (d.criticality || 'required') === 'required' && (!d.ref || ctx.typeOf(d.ref) === 'saas'))
      .map((d) => ({ subject: e, targets: [{ kind: e.kind, ref: e.ref }], dep: d,
        title: `${e.label} Stops When ${d.ref ? ctx.label(d.ref) : (d.label || 'Its ' + d.kind + ' Provider')} Is Unavailable`,
        description: `${e.label} needs ${d.ref ? ctx.label(d.ref) : (d.label || 'a ' + d.kind + ' provider')} (${d.kind}) to work, and that provider is ${d.ref ? 'a third party on the Internet side' : 'outside this diagram'}.`,
        mitigation: `Degrade gracefully or cache when ${d.ref ? ctx.label(d.ref) : (d.label || 'the provider')} is down; a second provider or a local fallback for ${d.kind}; an SLA, status monitoring and an exit plan.` }))),
  },
  {
    id: 'R021', name: 'Weak authentication to a data store', stride: ['elevation-of-privilege', 'information-disclosure'], category: 'broken-authentication', cwe: 'CWE-287',
    tactics: ['TA0006', 'TA0009'], techniques: ['T1078', 'T1005'], adversary: { type: 'malicious-user', position: 'internal' }, likelihood: 'moderate', impact: 'high',
    why: 'A database or storage service that accepts a password, a shared key or nothing at all is open to anyone who reaches its port from inside.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && DATA_STORE.includes(f.toType) && f.fromSide !== 'internet' && !f.fromBadActor && ['none', 'weak', 'unspecified'].includes(f.strength) && f.kind === 'data')
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }],
        title: `Weak Authentication to ${f.toLabel}`,
        description: `${f.fromLabel} opens ${f.toLabel} with ${f.authLabel || 'unspecified authentication'}; anyone who reaches the port from inside and holds or guesses the credential reads the data.`,
        mitigation: `Identity-based authentication on ${f.name} (Kerberos, managed identity, IAM) with a least-privilege role per caller; no shared logins; rotate the current credential.` })),
  },
  {
    id: 'R022', name: 'IT traffic into the OT zone', stride: ['tampering', 'denial-of-service'], category: 'excessive-trust-or-flat-network', cwe: 'CWE-923',
    tactics: [], techniques: [], adversary: { type: 'nation-state' }, likelihood: 'moderate', impact: 'very-high',
    why: 'A flow from an IT zone into an OT zone carries IT compromises onto the controllers; IEC 62443 expects every such conduit to be explicit, filtered and few.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.toOT && !f.fromOT && !f.fromBadActor && ['data', 'control', 'dependency'].includes(f.kind))
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], boundary: { type: 'ot-iot', from: f.fromZone || 'internet', to: f.toZone },
        title: `IT Traffic Reaches the OT Zone: ${f.label || f.name}`,
        description: `${f.name} crosses from ${f.fromZoneLabel} into ${f.toZoneLabel} (OT); a compromise on the IT side can reach ${f.toLabel}.`,
        mitigation: `A conduit for ${f.name} with a firewall (and a data diode or unidirectional gateway where the direction allows), only the historian or jump path crossing, and IEC 62443 zones and conduits recorded in the model.` })),
  },
  {
    id: 'R023', name: 'Internet requests without a WAF or API gateway', stride: ['tampering', 'denial-of-service'], category: 'improper-input-validation', cwe: 'CWE-20',
    tactics: ['TA0001'], techniques: ['T1190'], adversary: { type: 'hacker', position: 'external' }, likelihood: 'moderate', impact: 'moderate',
    why: 'A web or API endpoint that takes Internet requests with no WAF or gateway in front relies on its own input handling against every scanner and bot on the Internet.',
    applies: (ctx) => ctx.flows.filter((f) => f.live && f.crossesInternet && f.fromSide === 'internet' && !f.fromBadActor && f.kind === 'data' && WEB_TARGET.includes(f.toType) && f.toType !== 'saas' && !f.webGuarded && !f.fromEdge && !f.toEdge)
      .map((f) => ({ subject: f, targets: [{ kind: 'flow', ref: f.name }], boundary: { type: 'internet', from: 'internet', to: f.toZone },
        title: `${f.toLabel} Takes Internet Requests Without a WAF or API Gateway`,
        description: `${f.name} brings Internet requests to ${f.toLabel} with no WAF, API gateway or reverse proxy on the way to filter payloads, rate or bots.`,
        mitigation: `A WAF (managed rule set, rate limiting, bot protection) or an API gateway with schema validation in front of ${f.toLabel}; model it as an appliance on the zone's edge.` })),
  },
];

export const RULE_IDS = RULES.map((r) => r.id);
