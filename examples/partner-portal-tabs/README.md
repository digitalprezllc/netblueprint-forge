# Contoso partner portal: access paths on two tabs

The same portal as the Entra Application Proxy example, drawn as two diagrams of one document (`tabs[]`):

- **Partner Access**: the published path. Partner, Entra ID pre-authentication, the Application Proxy service, the connector group in Azure, ExpressRoute, the core firewall and the internal portal, with the bad actor's attempts and the employee path on its own layer.
- **Admin Access**: how IT administrators maintain the connector servers and the portal. A privileged access workstation unlocked with a FIDO2 key, an RDP session to a jump host in a management segment behind its own ACL, Kerberos from there to the connector and portal servers, and direct RDP from the office network dropped by the application ACL. Its own phases (Sign In, Broker, Maintain) and two threats of its own.

What it shows:

- Each tab has its own zones, nodes, flows, steps, threats and controls; threat numbers continue across tabs (THR-0001 to THR-0004 on Partner Access, THR-0005 and THR-0006 on Admin Access), and the Threat Register lists both diagrams with a Diagram column.
- Partner Access carries the same dependencies and evidence as the Entra Application Proxy example: the connector group depends on AD DS and on the proxy service, Entra Connect sync is a dashed `dependency` flow on its own layer, and the five verified controls cite their configuration exports, scan result and audit finding. On Admin Access the jump host's Credential Guard and session recording control is verified with a configuration export.
- The tab strip under the canvas; PageUp / PageDown switch tabs; `partner-portal-tabs.html#tab=admin-access` opens the second tab directly, `#tab=admin-access&step=2` opens it at its second step.

Files:

- `partner-portal-tabs.model.json`: the model (a copy ships in `skills/netblueprint-forge/assets/examples/`).
- `partner-portal-tabs.html`: rendered with `node skills/netblueprint-forge/scripts/build.mjs examples/partner-portal-tabs/partner-portal-tabs.model.json`. Self-contained; open it in any browser.
