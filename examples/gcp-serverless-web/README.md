# Cymbal Shop on Google Cloud: serverless web application with Cloud Run

Adapted from the Google Cloud Architecture Center's guidance for serverless web applications on Cloud Run with Cloud SQL and Memorystore (https://cloud.google.com/architecture) and set at Google's sample organization, **Cymbal**. The first example that uses the Google Cloud icon library: products carry their product icon, the project and VPC theirs, and the VPC Service Controls perimeter a category icon.

What it shows:

- **Internet side:** a customer, Identity Platform for customer sign-in, the global external HTTPS load balancer with Cloud Armor and Cloud CDN as the only public entry point, an opportunistic attacker, Cloud Identity and a site reliability engineer with a security key.
- **Google Cloud project** with three parts: **Cloud Run (managed)** running the storefront, the Orders API and the admin console as separate services with ingress restricted to the load balancer and the VPC; the **production VPC** with the Serverless VPC Access connector subnet and the Private Service Access range where Cloud SQL and Memorystore answer on private IPs, behind VPC firewall rules; and the **Google Cloud APIs** column (Cloud Storage, Secret Manager with Cloud KMS, Cloud Logging, Identity-Aware Proxy) inside a VPC Service Controls perimeter.
- 18 flows: the request path from the load balancer to the storefront, ID tokens between services, the connector into the VPC and on to the database and the cache, Secret Manager and logging with the service account, static assets through Cloud CDN, uploads with signed URLs, the SRE's path through Identity-Aware Proxy to the admin console, and two paths blocked by design. Every flow carries its authentication and a data classification.
- A nine-step story in four phases (Connect, Identity, Access, Operate), ending with what the attacker cannot do.
- Six **illustrative threats** and twelve controls on the layer `illustrative-threats`: credential stuffing against Identity Platform, direct calls to the run.app URL, a compromised dependency in the Orders API, the shared Memorystore AUTH string, one service account for every service, and a public bucket grant; three are mitigated with verified controls, three are open with planned controls and suggested mitigations.
- **Attack path AP-0001**, dependency compromise to secrets to customer data, walked as a red phase: four hops from the attacker to the service's own Internet egress, broken by Binary Authorization and per-service accounts once they land.
- Cloud fields on every Google Cloud node and the catalogue cards (`gcp-external-lb-cloud-armor`, `gcp-cloud-run`, `gcp-cloud-sql`, `gcp-memorystore`, `gcp-secret-manager-kms`, `gcp-cloud-storage`, `gcp-iap`) that give the nodes their icons.

Files:

- `gcp-serverless-web.model.json`: the model (source of truth; a copy ships in `skills/netblueprint-forge/assets/examples/`).
- `gcp-serverless-web.html`: the rendered diagram, built with `node skills/netblueprint-forge/scripts/build.mjs examples/gcp-serverless-web/gcp-serverless-web.model.json`. Open it in any browser; it has no external dependencies. `gcp-serverless-web.html#path=AP-0001&hop=1` opens it on the attack path.
