# Any cloud service without a card

Use these questions when a service has no card in `aws.md`, `azure.md` or `gcp.md` and you cannot research it live. Write the answers into the element's `cloud` block and its `info`.

1. **What is it?** Provider and exact service name (`cloud.provider`, `cloud.service`), region (`cloud.region`).
2. **How is it reached?** Public endpoint on the Internet, a private endpoint inside your VPC/VNet, or both? (`cloud.exposure`: internet / private / hybrid; `cloud.endpoint`: public / private / both / none.) If it has a public endpoint, is public network access actually enabled?
3. **Which network does it attach to?** VPC/VNet and subnet, CIDR (`cloud.network`). Does traffic to it stay on the provider backbone or cross the Internet?
4. **Which protocols and ports does it listen on?** Put them on the component or in `info`.
5. **What is switched off?** Walk the usual list and record each answer: legacy protocols (FTP/FTPS, Telnet, SMBv1), TLS below 1.2, basic or password-only authentication to the management/deployment plane, anonymous or public access to data, instance metadata v1, public IPs on compute, default or sample credentials. Confirmed-off items go in `cloud.disabled_protocols`; anything still on goes in `cloud.enabled_risky_protocols` and becomes a suggested threat.
6. **How do callers authenticate?** Managed/workload identity, access keys, OAuth tokens, certificates, passwords? That sets the `auth` of the flows into it.
7. **What does it depend on?** Identity provider, DNS, key management, logging/monitoring, storage. Each dependency is probably a node or a flow.
8. **Who administers it and from where?** Portal/console over the Internet, a bastion, a CI pipeline? That is an admin flow worth drawing.
9. **Where do its logs go?** A monitoring node and a control flow.
10. **Is it encrypted at rest and in transit, with whose keys?**

Then propose, marked `suggested: true`: the zone it lives in (VPC/VNet/subnet) if missing, a public endpoint node on the Internet side when `exposure` is internet or hybrid, flows for administration and logging, and one threat per item in `enabled_risky_protocols` (STRIDE from the protocol: exposed management plane → elevation-of-privilege; public data access → information-disclosure; weak TLS → tampering/information-disclosure).
