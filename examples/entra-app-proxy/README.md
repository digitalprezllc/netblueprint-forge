# Contoso partner portal published through Microsoft Entra Application Proxy

The primary reference example shipped with the skill. Adapted from Microsoft's Entra Application Proxy architecture documentation (https://learn.microsoft.com/entra/identity/app-proxy/overview-what-is-app-proxy) and using Microsoft's sample organization, **Contoso**.

What it shows:

- **Internet side:** a partner (B2B guest), a bad actor, the Entra ID tenant (marked **out of scope**, so drawn greyed out) and the Application Proxy service, which is the only public endpoint.
- **Azure landing zone:** a connector VNet with the App Proxy connector group (two VMs, outbound 443 only), an NSG on the Internet-facing edge and an ExpressRoute gateway on the corporate-facing edge (`serves: ["corp"]`).
- **Contoso corporate network** behind a core firewall (deny-all inbound): AD DS, employees, and an application segment with the internal portal (IIS site plus a **legacy report component marked out of scope**) and SQL-01.
- 12 flows: pre-authentication, the outbound connector tunnel (mTLS), Kerberos constrained delegation over ExpressRoute, database access, employee access on its own layer, and three paths a bad actor tries (credential stuffing, direct proxy access, direct inbound), two of them blocked by design.
- Every flow that matters carries the full detail: connection type and initiator, what each side sends, data sensitivity and labels, transport security and what it provides, how client and server authenticate and where their credentials live, logging.
- **Service profiles** on the connector, portal, SQL, AD DS and the proxy service: ownership, platform and support status, location, device authentication, elevated access model, patching, hardening baseline, sourcing (COTS / custom / SaaS).
- A nine-step story and four **illustrative threats** with a vulnerability category, a threat statement, consequence, inherent / current / projected risk, **as-is and future-state controls** and suggested mitigations.

Files:

- `entra-app-proxy.model.json`: the model (source of truth; a copy ships in `skills/netblueprint-forge/assets/examples/`).
- `entra-app-proxy.html`: rendered with `node skills/netblueprint-forge/scripts/build.mjs examples/entra-app-proxy/entra-app-proxy.model.json`. Self-contained; open it in any browser.
