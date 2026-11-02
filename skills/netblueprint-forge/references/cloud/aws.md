# AWS service cards

Format per card: What · Attaches to · Default exposure · Disable unless needed · Depends on · Ask · Propose · Threats. Ids in `cloud.disabled_protocols` / `enabled_risky_protocols` are the kebab-case tokens shown in **bold**. Threat rows give STRIDE, `vulnerability.category`, refs and the control to pre-fill. Everything proposed is `suggested: true` until confirmed.

---

## `aws-ec2` — Amazon EC2 (virtual machines)
- **Icon:** `aws/ec2`
- **What:** VMs in a VPC subnet with security groups.
- **Attaches to:** VPC + subnet; public IP optional; security groups (stateful allow lists) and NACLs; private egress via NAT gateway or VPC endpoints.
- **Default exposure:** no inbound allowed by a new security group; a public IP appears only if the subnet auto-assigns one or the launch asks for it. IMDSv1 is accepted unless IMDSv2 is required.
- **Disable unless needed:** **public-ip**, **ssh-from-internet**, **rdp-from-internet**, **imdsv1** (require IMDSv2, hop limit 1), **unrestricted-egress**, **default-security-group**, **public-ami**, **smbv1**, **tls1.0**, **tls1.1**.
- **Depends on:** IAM instance profile (role), KMS (EBS encryption), SSM Agent (admin, patching), CloudWatch / CloudTrail, VPC endpoints for AWS APIs.
- **Ask:** Internet-facing or private? Public IP? Which ports open to whom? IMDSv2 required? Admin via SSM Session Manager or SSH/RDP from where? Patching via SSM Patch Manager? EBS encrypted? Any secrets in user data?
- **Propose:** zone `vpc` › `subnet`; node `server` with `profile.platform.category: virtual-machine`; security group as an appliance (`type: firewall`, label "Security group") on the subnet edge; `ssm-session-manager` as a service node on the Internet side with the admin flow; a blocked `rdp-from-internet` flow when the user confirms it is closed.
- **Threats:** SSRF to IMDSv1 steals the instance role credentials · Elevation of privilege · `ssrf` · CWE-918, T1552.005 · control: require IMDSv2 (preventive) ‖ Management port exposed to the Internet · Elevation of privilege · `security-misconfiguration` · T1133 · control: no inbound SG rule, SSM only ‖ Secrets in user data or on disk · Information disclosure · `credential-exposure` · CWE-798 · control: Secrets Manager + instance role ‖ Unpatched OS / agent · Elevation of privilege · `vulnerable-components` · CWE-1104 · control: SSM Patch Manager with SLA.

## `aws-s3` — Amazon S3 (object storage)
- **Icon:** `aws/simple-storage-service`
- **What:** Object storage with bucket policies.
- **Attaches to:** Regional public endpoint by default; private via gateway or interface VPC endpoint with an endpoint policy.
- **Default exposure:** new buckets are private: Block Public Access on and ACLs disabled (bucket owner enforced); default encryption SSE-S3. Buckets created before 2023 may differ.
- **Disable unless needed:** **public-access** (keep Block Public Access on), **acls**, **http** (enforce `aws:SecureTransport`), **cross-account-wildcards**, **unversioned** (for data you cannot lose).
- **Depends on:** IAM / bucket policies, KMS (SSE-KMS), CloudTrail data events, S3 access logs, VPC endpoint.
- **Ask:** Is anything in it meant to be public (website, downloads)? Block Public Access on at account and bucket level? HTTPS enforced? Who writes, who reads (roles, other accounts)? Encryption key: S3-managed or KMS? Versioning and Object Lock for backups?
- **Propose:** node `storage` with `cloud.exposure: private` and `endpoint: private` when a VPC endpoint is used, else `internet`/`public`; flows from workloads with `auth: managed-identity` (IAM role); a blocked `anonymous read` flow from the bad actor.
- **Threats:** Bucket or object made public · Information disclosure · `security-misconfiguration` · CWE-284, A01:2025 · control: Block Public Access + SCP/RCP deny ‖ Data read in transit over HTTP · Information disclosure · `missing-or-weak-encryption` · CWE-319 · control: bucket policy denies non-TLS ‖ Over-broad bucket policy / cross-account `*` · Information disclosure · `unauthorized-access` · CWE-284 · control: least-privilege policy, Access Analyzer ‖ Ransomware / deletion · Tampering, Denial of service · `insider-misuse` · T1485 · control: versioning + Object Lock + MFA delete.

## `aws-rds` — Amazon RDS / Aurora (managed relational database)
- **Icon:** `aws/rds`
- **What:** Managed PostgreSQL / MySQL / SQL Server / Oracle / Aurora.
- **Attaches to:** VPC subnet group; optional public accessibility gives a public DNS/IP; security group on the instance.
- **Default exposure:** private within the VPC unless "Publicly accessible" is set; security group controls the port.
- **Disable unless needed:** **public-access**, **password-only-auth** (prefer IAM database authentication or Kerberos), **tls-optional** (require SSL: `rds.force_ssl` / `require_secure_transport`), **default-port-from-anywhere**, **tls1.0**, **tls1.1**.
- **Depends on:** KMS (storage encryption), Secrets Manager (managed master password rotation), CloudWatch logs, IAM.
- **Ask:** Publicly accessible flag? Which subnets and security groups? Authentication: IAM, Kerberos, native passwords (where stored)? TLS required? Encryption at rest? Backups and retention? Who administers it and from where?
- **Propose:** zone `subnet` (data); node `database` with `data_classification`; flows from the app tier with `auth` per the answer and `transport.security_protocol: tls-1.2`; a blocked flow from the Internet when public access is off.
- **Threats:** Database reachable from the Internet · Information disclosure · `security-misconfiguration` · CWE-284 · control: public access off + SG from app subnet only ‖ Credentials in app config · Spoofing · `credential-exposure` · CWE-798 · control: Secrets Manager / IAM auth ‖ Unencrypted connections · Information disclosure · `missing-or-weak-encryption` · CWE-319 · control: force SSL ‖ SQL injection via the app · Tampering · `injection` · CWE-89, A05:2025 · control: parameterized queries, least-privilege DB user.

## `aws-lambda` — AWS Lambda (serverless functions)
- **Icon:** `aws/lambda`
- **What:** Event-driven functions.
- **Attaches to:** Runs in the AWS service network by default; optional VPC attachment (ENIs in your subnets); invoked by triggers, API Gateway, ALB, or a function URL.
- **Default exposure:** not reachable from the Internet unless a function URL (auth `NONE`) or an open API Gateway / ALB fronts it.
- **Disable unless needed:** **function-url-auth-none**, **public-layer**, **broad-resource-policy**, **secrets-in-environment-variables**, **wildcard-execution-role**.
- **Depends on:** IAM execution role, Secrets Manager / Parameter Store, KMS (env var encryption), CloudWatch Logs, VPC endpoints when VPC-attached.
- **Ask:** How is it invoked (API Gateway, ALB, function URL, events)? If a function URL: IAM auth or none? VPC-attached, and does it need Internet egress? Where do secrets live? What can the execution role do?
- **Propose:** node `service` (`icon: function`); the fronting service as its own node or appliance; flows from triggers with `auth` (`request-signing-hmac` for IAM-auth URLs, `bearer-token-oauth2` for a JWT authorizer, `none` for open URLs → weak).
- **Threats:** Open function URL / API · Spoofing, Information disclosure · `broken-authentication` · CWE-306 · control: IAM or JWT authorizer ‖ Secrets in environment variables · Information disclosure · `credential-exposure` · CWE-798 · control: Secrets Manager at runtime ‖ Over-permissive execution role · Elevation of privilege · `privilege-escalation` · CWE-250 · control: least-privilege role per function ‖ Event injection through untrusted payloads · Tampering · `improper-input-validation` · CWE-20 · control: schema validation.

## `aws-api-gateway` — Amazon API Gateway
- **Icon:** `aws/api-gateway`
- **What:** Managed REST / HTTP / WebSocket API front door.
- **Attaches to:** Edge-optimized or regional public endpoint; private API via interface VPC endpoint with a resource policy.
- **Default exposure:** public endpoint; methods without an authorizer are open.
- **Disable unless needed:** **unauthenticated-methods**, **public-endpoint** (when only VPC clients call it), **no-throttling**, **no-waf**, **tls1.0**, **tls1.1** (custom-domain security policy).
- **Depends on:** Lambda / ALB / VPC Link back ends, Cognito or JWT authorizers, WAF, CloudWatch / X-Ray, ACM certificates.
- **Ask:** Public or private API? Which authorizer (IAM, Cognito, Lambda/JWT, API keys only)? WAF attached? Throttling and quotas? mTLS for partners? Minimum TLS version on the custom domain?
- **Propose:** Internet-side node `public-endpoint` (or `service` with `cloud.exposure: internet`); WAF as an appliance in front; flows from clients with the authorizer's `auth`; back-end flows to Lambda / VPC Link.
- **Threats:** Methods callable without authentication · Spoofing · `broken-authentication` · CWE-306, API2:2023 · control: authorizer on every method ‖ Broken object-level authorization in back ends · Information disclosure · `unauthorized-access` · CWE-639, API1:2023 · control: ownership checks ‖ Resource exhaustion · Denial of service · `resource-exhaustion` · API4:2023 · control: throttling + WAF rate rules ‖ API keys treated as authentication · Spoofing · `broken-authentication` · control: keys for metering only.

## `aws-alb` — Application Load Balancer (+ AWS WAF)
- **Icon:** `aws/elastic-load-balancing`
- **What:** Layer-7 load balancer for HTTP(S).
- **Attaches to:** Internet-facing (public subnets, public IPs) or internal; security group on the ALB; targets in private subnets.
- **Default exposure:** internet-facing ALBs listen publicly; HTTP listeners pass plaintext unless redirected.
- **Disable unless needed:** **http-listener** (redirect to HTTPS), **tls1.0**, **tls1.1** (use a TLS 1.2+/1.3 policy), **no-waf**, **target-sg-open** (targets should accept only the ALB's SG), **desync-permissive**.
- **Depends on:** ACM certificates, AWS WAF, target groups (EC2 / ECS / Lambda / IP), access logs to S3, Cognito/OIDC authentication action (optional).
- **Ask:** Internet-facing or internal? TLS policy and certificate source? WAF web ACL attached (managed rules, rate limits)? Do targets accept traffic only from the ALB? Any ALB-level authentication (Cognito/OIDC)?
- **Propose:** ALB as a node `service` (`icon: load-balancer`) in the public subnet with WAF as a `waf` appliance on the VPC edge; flows client → ALB (`auth` per app) and ALB → targets (`transport` end-to-end TLS or plain if offloaded).
- **Threats:** Web attacks reach the application · Tampering, Information disclosure · `injection` · A05:2025 · control: WAF managed rules in block mode ‖ Plaintext HTTP accepted · Information disclosure · `missing-or-weak-encryption` · CWE-319 · control: HTTPS-only listeners ‖ Targets reachable around the ALB · Elevation of privilege · `security-misconfiguration` · control: target SG allows ALB SG only ‖ Volumetric / L7 DoS · Denial of service · `resource-exhaustion` · control: Shield + WAF rate-based rules.

## `aws-eks` — Amazon EKS (Kubernetes)
- **Icon:** `aws/elastic-kubernetes-service`
- **What:** Managed Kubernetes control plane with node groups or Fargate.
- **Attaches to:** Cluster endpoint public and/or private; nodes in VPC subnets; pods via VPC CNI.
- **Default exposure:** the API endpoint is public (authenticated) unless set to private or CIDR-restricted; Services of type LoadBalancer create public load balancers.
- **Disable unless needed:** **public-api-endpoint**, **public-load-balancer-services**, **imdsv1** on nodes, **anonymous-auth**, **default-namespace-wildcards**, **privileged-pods**.
- **Depends on:** IAM (cluster access entries / IRSA / Pod Identity), ECR, KMS (secrets encryption), CloudWatch Container Insights, OIDC provider.
- **Ask:** API endpoint public, private, or restricted CIDRs? How do pods get AWS credentials (IRSA / Pod Identity)? Ingress controller and WAF? Network policies between namespaces? Image source and scanning? Secrets encrypted with KMS?
- **Propose:** zone `vpc` › `subnet` per node group; node `service` (`icon: kubernetes`) for the control plane and workloads as components or separate nodes; ingress as a `load-balancer` appliance; a flow admin → API endpoint with `auth: managed-identity` (IAM).
- **Threats:** Exposed API server · Elevation of privilege · `security-misconfiguration` · T1190 · control: private endpoint / CIDR allow-list ‖ Pod steals node role via IMDS · Elevation of privilege · `ssrf` · T1552.005 · control: IMDSv2 hop limit 1 + IRSA ‖ Lateral movement between namespaces · Elevation of privilege · `excessive-trust-or-flat-network` · control: NetworkPolicy default deny ‖ Vulnerable images · Elevation of privilege · `supply-chain` · A03:2025 · control: ECR scanning, admission policy.

## `aws-dynamodb` — Amazon DynamoDB (NoSQL)
- **Icon:** `aws/dynamodb`
- **What:** Serverless key-value / document database.
- **Attaches to:** Public regional endpoint; private via gateway VPC endpoint with endpoint policy.
- **Default exposure:** reachable only with IAM credentials; no network allow-list unless a VPC endpoint policy is used.
- **Disable unless needed:** **public-endpoint-from-vpc** (prefer the gateway endpoint), **wildcard-table-policies**, **unencrypted-backups**, **pitr-off** (for important data).
- **Depends on:** IAM, KMS, CloudTrail, Streams / Kinesis consumers.
- **Ask:** Who reads/writes (roles)? Fine-grained access (item/attribute conditions)? VPC endpoint? Encryption key? Point-in-time recovery?
- **Propose:** node `database`; flows from services with `auth: managed-identity`; `cloud.exposure: private` when endpoint policies restrict to the VPC.
- **Threats:** Over-broad IAM on tables · Information disclosure · `unauthorized-access` · CWE-284 · control: least privilege, condition keys ‖ Credential leak gives full access from anywhere · Spoofing · `credential-exposure` · CWE-522 · control: roles only, VPC endpoint policy ‖ Table deletion / corruption · Denial of service · `insider-misuse` · control: PITR, deletion protection.

## `aws-secrets-kms` — AWS Secrets Manager and KMS
- **Icon:** `aws/secrets-manager`
- **What:** Secret storage with rotation; key management.
- **Attaches to:** Public regional endpoints; interface VPC endpoints for private access.
- **Default exposure:** IAM-controlled; KMS key policies decide who can use a key.
- **Disable unless needed:** **secrets-in-code**, **long-lived-static-secrets** (enable rotation), **wildcard-key-policy**, **cross-account-key-grants** (review).
- **Depends on:** IAM, CloudTrail, Lambda rotation functions, VPC endpoints.
- **Ask:** Which services read which secrets, with what role? Rotation enabled? Customer-managed keys or AWS-managed? Who administers keys (separation of duties)? VPC endpoint?
- **Propose:** node `service` (`icon: key`) in the account zone; control flows from workloads with `auth: managed-identity`; mark flows that still carry static secrets with `authentication.client.credential_storage` of wherever they live.
- **Threats:** Secret readable by too many roles · Information disclosure · `unauthorized-access` · CWE-284 · control: resource policy + least privilege ‖ Static credentials never rotated · Spoofing · `credential-exposure` · control: automatic rotation ‖ Key policy lets a compromised role decrypt everything · Information disclosure · `privilege-escalation` · control: key policy scoped per workload.

## `aws-cloudfront` — Amazon CloudFront (CDN) with WAF and Shield
- **Icon:** `aws/cloudfront`
- **What:** Global CDN and TLS termination in front of S3, ALB, API Gateway, custom origins.
- **Attaches to:** Internet edge; origins can be made private (S3 Origin Access Control, ALB restricted to CloudFront prefix list / custom header).
- **Default exposure:** public; origins stay reachable directly unless locked to CloudFront.
- **Disable unless needed:** **origin-directly-reachable**, **http-allowed** (redirect to HTTPS), **tls1.0**, **tls1.1** (security policy TLSv1.2_2021+), **no-waf**, **geo-unrestricted** (when a region restriction applies).
- **Depends on:** ACM (us-east-1), WAF, Shield, S3 OAC, origin certificates, logging to S3 / Kinesis.
- **Ask:** Which origins, and are they locked to CloudFront? Viewer protocol policy and TLS policy? WAF web ACL? Signed URLs / cookies for private content? Logging on?
- **Propose:** Internet-side node `public-endpoint` (`icon: globe`) with the WAF as an appliance; flows viewer → CloudFront and CloudFront → origin (`via` none, `transport` TLS); a blocked flow from the bad actor straight to the origin.
- **Threats:** Origin bypass · Information disclosure · `security-misconfiguration` · control: OAC / origin header checks ‖ Cache poisoning / header manipulation · Tampering · `improper-input-validation` · CWE-444 · control: cache key policy, WAF ‖ Volumetric DoS · Denial of service · `resource-exhaustion` · control: Shield Advanced, rate rules.

## `aws-sqs-sns` — Amazon SQS / SNS (messaging)
- **Icon:** `aws/simple-queue-service`
- **What:** Queues and pub/sub topics.
- **Attaches to:** Public regional endpoints; interface VPC endpoints for private access.
- **Default exposure:** IAM-controlled; a resource policy with `Principal: *` makes a queue/topic world-writable or readable.
- **Disable unless needed:** **wildcard-resource-policy**, **unencrypted-at-rest** (use SSE-KMS), **http-subscriptions** (SNS over HTTP), **no-dead-letter-queue**.
- **Depends on:** IAM, KMS, CloudWatch, consumers (Lambda, ECS).
- **Ask:** Who publishes and who consumes (roles, accounts)? Encryption key? Subscription endpoints and their TLS? Message contents (PII?)? Retention and DLQ?
- **Propose:** node `service` (`icon: queue`); flows producer → queue → consumer with `connection.type: message-queue`, `auth: managed-identity`, `data` per content.
- **Threats:** World-writable queue lets anyone inject messages · Tampering · `unauthorized-access` · CWE-284 · control: resource policy by principal ‖ Sensitive payloads unencrypted · Information disclosure · `missing-or-weak-encryption` · control: SSE-KMS, HTTPS subscriptions ‖ Poison messages exhaust consumers · Denial of service · `improper-input-validation` · control: validation + DLQ.

## `aws-elasticache` — Amazon ElastiCache (Redis / Valkey / Memcached)
- **Icon:** `aws/elasticache`
- **What:** In-memory cache.
- **Attaches to:** VPC subnets only (no public endpoint); security groups.
- **Default exposure:** private; but a permissive security group or a peered network exposes an unauthenticated cache.
- **Disable unless needed:** **no-auth** (enable AUTH / RBAC users), **in-transit-unencrypted**, **at-rest-unencrypted**, **sg-open-to-vpc-wide**.
- **Depends on:** VPC, KMS, Secrets Manager (AUTH tokens), CloudWatch.
- **Ask:** Which subnets and SGs? AUTH / RBAC enabled? TLS in transit? What is cached (sessions, tokens, PII)?
- **Propose:** node `service` (`icon: cache`) in the data subnet; flows from app tier with `auth: password` (AUTH token) or `managed-identity` (IAM auth where supported), `transport.security_protocol: tls-1.2`.
- **Threats:** Unauthenticated cache readable from the VPC · Information disclosure · `broken-authentication` · CWE-306 · control: AUTH + SG from app subnet only ‖ Session tokens stolen from cache · Spoofing · `sensitive-data-exposure` · control: encrypt, short TTL ‖ Cache poisoning · Tampering · `unauthorized-access` · control: RBAC users with least privilege.
