# AnyCompany web application on AWS: three-tier architecture in a VPC

Adapted from the AWS Architecture Center's web application hosting reference architecture (https://aws.amazon.com/architecture/) and set at AWS's sample organization, **AnyCompany**. The first example that uses the AWS icon library: every service, subnet and gateway carries its official icon.

What it shows:

- **Internet side:** a customer, a Cognito user pool, CloudFront with AWS WAF as the only public entry point, an opportunistic attacker, IAM Identity Center and an operations engineer with a FIDO2 key.
- **AWS account** (one production account under Organizations) with a **VPC** of three subnet tiers across two Availability Zones: public subnets (Application Load Balancer, NAT gateway) behind a network ACL, private application subnets (EC2 Auto Scaling group with `web` and `api` components) behind the app security group, and isolated data subnets (Amazon RDS) behind the database security group, plus a **regional services** zone (S3, Secrets Manager with KMS, CloudWatch with CloudTrail, Systems Manager) reached through VPC endpoints.
- 17 flows: the request path from the edge to the database, the instance role's calls to Secrets Manager, S3 and CloudWatch over endpoints, CloudFront's origin access to S3, unfiltered egress through the NAT gateway, Session Manager administration with no inbound port, and two paths blocked by design. Every flow carries its authentication and a data classification.
- A nine-step story in four phases (Connect, Identity, Access, Operate), ending with what the attacker cannot do.
- Six **illustrative threats** and eleven controls on the layer `illustrative-threats`: credential stuffing against Cognito, bypassing CloudFront to reach the load balancer, SSRF to the instance metadata service, a public bucket grant, an over-broad instance role, and unfiltered egress; four are mitigated with verified controls, two are open with planned controls and suggested mitigations.
- **Attack path AP-0001**, SSRF to role credentials to database exfiltration, walked as a red phase: four hops from the attacker to the NAT gateway, broken by IMDSv2 enforcement today and by per-secret policies and egress filtering once they land.
- Cloud fields on every AWS node (`exposure`, `endpoint`, `disabled_protocols`) and the catalogue cards (`aws-cloudfront`, `aws-alb`, `aws-ec2`, `aws-rds`, `aws-secrets-kms`, `aws-s3`) that give the nodes their icons.

Files:

- `aws-three-tier.model.json`: the model (source of truth; a copy ships in `skills/netblueprint-forge/assets/examples/`).
- `aws-three-tier.html`: the rendered diagram, built with `node skills/netblueprint-forge/scripts/build.mjs examples/aws-three-tier/aws-three-tier.model.json`. Open it in any browser; it has no external dependencies. `aws-three-tier.html#path=AP-0001&hop=1` opens it on the attack path.
