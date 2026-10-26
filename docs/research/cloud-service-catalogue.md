# Cloud service catalogue: what the cards are built from

Research note, 2026-10-24. Backs `skills/netblueprint-forge/references/cloud/{aws,azure,gcp}.md`. Each card answers the same questions for one service: how it attaches to the network, what is exposed by default, what should be switched off, what it depends on, what to ask, what to propose, which threats are typical. The cards are the skill's offline knowledge; anything not covered is researched live (`cloud/README.md`).

## Method

- Scope: the 12 most common services per provider for workloads that end up in threat models: compute (VM, container, serverless, PaaS), storage (object, database, cache/queue), edge (load balancer / WAF / CDN), identity-adjacent (secrets/keys, bastion/IAP).
- Each card's "default exposure" and "disable unless needed" come from the provider's own documentation of the current defaults; where a default changed recently the card says so, because older resources keep the old default.
- Threats per card are expressed in the model's vocabulary: STRIDE, the `vulnerability.category` ids from `service-flow-threat-attributes.md`, CWE / ATT&CK / OWASP refs, and the control that addresses each.

## Defaults worth knowing (changed in recent years)

| Provider / service | Current default | Old resources |
| - | - | - |
| AWS S3 | New buckets: Object Ownership "bucket owner enforced" (ACLs disabled) and Block Public Access on; objects encrypted (SSE-S3). | Buckets created before April 2023 may still have ACLs enabled and Block Public Access off. |
| AWS EC2 IMDS | Each instance can be set to require IMDSv2 (session tokens, hop limit 1); account-level and AMI-level defaults can enforce it. | Instances launched with the old default accept IMDSv1, which SSRF can reach. |
| Azure Storage | Anonymous blob access is prohibited by default on new accounts (`allowBlobPublicAccess=false`); a container setting cannot override it. Shared Key can be disabled per account. | Accounts created before November 2023 may allow anonymous access to be configured per container. |
| Azure App Service | Basic-auth publishing (FTP/FTPS and SCM) is disabled by default for new apps; FTP and SCM have separate flags. | Older apps may have both on. |
| Google Cloud Storage | Secure-by-default posture: public access prevention enforced and uniform bucket-level access (no per-object ACLs). New buckets are not public unless an IAM binding grants `allUsers`. | Older buckets may still use fine-grained ACLs. |

## Cross-provider patterns the cards reuse

- **Private connectivity** (AWS PrivateLink / VPC endpoints; Azure Private Endpoint and Private Link; GCP Private Service Connect / Private Google Access) replaces the public endpoint for PaaS; the card asks whether the public endpoint is then disabled.
- **Identity for workloads** (AWS IAM roles / instance profiles; Azure managed identities; GCP service accounts with Workload Identity) replaces stored secrets; the card asks what the caller uses and writes it into the flow's `authentication.client`.
- **Metadata services** (169.254.169.254) are the SSRF target on every provider; the mitigations differ (IMDSv2, Azure IMDS requires the `Metadata: true` header and managed-identity endpoints, GCP requires `Metadata-Flavor: Google` and OS Login).
- **Administrative access**: SSM Session Manager / Azure Bastion / IAP TCP forwarding replace exposed SSH/RDP; the card proposes the broker as a node and the direct path as a blocked flow.
- **Perimeter**: AWS WAF on ALB/CloudFront/API Gateway; Azure Application Gateway WAF / Front Door WAF; Google Cloud Armor on the external load balancer; each becomes a boundary appliance or an Internet-side node.
- **Logging**: CloudTrail + CloudWatch; Azure Monitor diagnostic settings + Log Analytics; Cloud Logging / Cloud Audit Logs; every card proposes the monitoring flow.

## Common misconfigurations the threats encode

Public storage with sensitive data, databases with public endpoints, security groups / NSGs open to the Internet on management ports, over-permissive IAM (privilege escalation paths), secrets in user data / app settings / environment variables / task definitions, metadata-service credential theft via SSRF, disabled TLS enforcement on storage, missing key rotation, and unpatched compute. Industry reports from 2025–2026 (Tenable Cloud Security Risk Report; Intruder's Cloud Security Index) rank these consistently, with provider-specific leaders (S3 buckets without HTTPS enforcement and IAM escalation paths on AWS; missing key rotation on Azure storage accounts).

## Sources

- AWS: S3 Object Ownership and ACL defaults https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html ; S3 Block Public Access https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html ; EC2 IMDS https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html ; RDS public accessibility https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html ; Lambda function URLs auth https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html ; EKS endpoint access https://docs.aws.amazon.com/eks/latest/userguide/cluster-endpoint.html ; Systems Manager Session Manager https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html ; CIS AWS Foundations Benchmark https://www.cisecurity.org/benchmark/amazon_web_services
- Azure: anonymous blob access https://learn.microsoft.com/azure/storage/blobs/anonymous-read-access-prevent ; Shared Key authorization https://learn.microsoft.com/azure/storage/common/shared-key-authorization-prevent ; App Service basic auth https://learn.microsoft.com/azure/app-service/configure-basic-auth-disable ; App Service networking https://learn.microsoft.com/azure/app-service/networking-features ; Azure SQL network access https://learn.microsoft.com/azure/azure-sql/database/network-access-controls-overview ; Entra-only authentication https://learn.microsoft.com/azure/azure-sql/database/authentication-azure-ad-only-authentication ; Key Vault network security https://learn.microsoft.com/azure/key-vault/general/network-security ; AKS private clusters https://learn.microsoft.com/azure/aks/private-clusters ; Azure Bastion https://learn.microsoft.com/azure/bastion/bastion-overview ; Azure IMDS https://learn.microsoft.com/azure/virtual-machines/instance-metadata-service ; CIS Azure Foundations Benchmark https://www.cisecurity.org/benchmark/azure
- Google Cloud: secure-by-default posture (public access prevention, uniform bucket-level access) https://docs.cloud.google.com/security-command-center/docs/security-posture-essentials-secure-default-template ; Cloud SQL connectivity and Auth Proxy https://cloud.google.com/sql/docs/mysql/connect-overview ; Cloud Run ingress and authentication https://docs.cloud.google.com/run/docs/securing/ingress ; GKE private clusters https://cloud.google.com/kubernetes-engine/docs/concepts/private-cluster-concept ; Compute Engine metadata server https://cloud.google.com/compute/docs/metadata/overview ; OS Login https://cloud.google.com/compute/docs/oslogin ; IAP TCP forwarding https://cloud.google.com/iap/docs/using-tcp-forwarding ; Cloud Armor https://cloud.google.com/armor/docs ; CIS Google Cloud Foundations Benchmark https://www.cisecurity.org/benchmark/google_cloud_computing_platform
- Reports: Tenable Cloud Security Risk Report 2025 https://www.tenable.com/cyber-exposure/cloud-security-risk-report ; Intruder 2026 Cloud Security Index (via CSA) https://cloudsecurityalliance.org/articles/2026-cloud-security-index-how-risk-differs-across-aws-azure-and-google-cloud-csa ; Wiz, secure defaults on AWS https://www.wiz.io/blog/how-to-set-secure-defaults-on-aws
