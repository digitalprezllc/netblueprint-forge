# Kubernetes cards: clusters, namespaces, workloads and what surrounds them

Cards for the parts of a Kubernetes platform, managed (AKS, EKS, GKE) or self-run, in the same format as the cloud and component cards: use one the moment a node is "the cluster", "the ingress", "the registry", run its questions, propose with `suggested: true` and `suggested_from: "<card id>"`, and pre-fill its threats for the user to confirm. A managed cluster also has its provider's card (`cloud/azure.md` AKS, `cloud/aws.md` EKS, `cloud/gcp.md` GKE) for the control plane's exposure; these cards cover what runs inside and around it.

Model shape: the cluster is a zone of kind `cluster` (inside the VPC or subscription zone), each namespace a zone of kind `namespace` inside it, the control plane a `service` node (managed) or `server` nodes (self-run), workloads as `service` nodes with `container` components, the ingress controller an appliance of the cluster zone (`type: reverse-proxy` or `api-gateway`), the registry a `storage` or `saas` node outside. Sources: the CIS Kubernetes Benchmark, ATT&CK for Containers, the Microsoft Kubernetes threat matrix, the providers' hardening guides. `scripts/suggest.mjs` raises the generic cases; the cards hold what is specific.

---

## `k8s-control-plane` — Cluster control plane (API server, etcd, scheduler, controllers)
- **Icon:** `service` (node type `service`; zone kind `cluster`)
- **What:** The API every kubectl, pipeline and controller talks to; etcd holds every secret and manifest.
- **Attaches to:** Managed: the provider's endpoint, public by default on most providers with an optional private endpoint and authorised IP ranges; self-run: a node in the cluster's management subnet on 6443.
- **Default exposure:** A public API endpoint, anonymous authentication off but discovery open, legacy ABAC off, audit logging off on several providers until enabled.
- **Disable unless needed:** **public-api-endpoint** (private endpoint or authorised ranges), **anonymous-auth**, **legacy-abac**, **insecure-port**, **unencrypted-etcd**, **cluster-admin-for-humans**, **audit-logging-off**.
- **Depends on:** `identity` (OIDC or the provider's IAM for users and workloads), `pki` (cluster CA), `kms` (etcd encryption at rest), `logging` (audit log), `time`.
- **Ask:** Is the API endpoint private or limited to known ranges? How do humans authenticate (OIDC with MFA, or static tokens and kubeconfigs)? Who holds cluster-admin? Is etcd encrypted with a managed key? Is the audit log on and shipped out? Which version, and is it still supported?
- **Propose:** zone `cluster` inside the VPC/VNet zone; node `service` ("API server") with `cloud` set for a managed cluster; `auth` flows from administrators and pipelines with `auth: oidc` or `managed-identity`; `profile.elevated_access` for cluster administrators; `security_level` is not for Kubernetes, leave it.
- **Threats:** Kubeconfig or static token with cluster-admin leaked · Elevation of privilege · `credential-exposure` · CWE-798, T1552.001, T1078.004 · control: OIDC sign-in with MFA and short-lived tokens, no static tokens, cluster-admin only through just-in-time elevation ‖ Public API endpoint reached by scanners and exploited · Elevation of privilege · `security-misconfiguration` · CWE-284, T1190 · control: private endpoint or authorised IP ranges, supported version, anonymous access off ‖ etcd read from a snapshot or a backup exposes every secret · Information disclosure · `sensitive-data-exposure` · CWE-312, T1552 · control: etcd encryption with a managed key, backups encrypted and access-controlled, secrets in an external vault with the CSI driver.

## `k8s-node-pool` — Worker nodes (node pools, node groups)
- **Icon:** `server` (node type `server` or `host`, `stack` for N nodes)
- **What:** The VMs that run the pods; kubelet, container runtime, the node's cloud identity.
- **Attaches to:** A private subnet of the cluster's network; kubelet on 10250; outbound to the control plane, the registry and the cloud APIs.
- **Default exposure:** Private on managed providers; a public IP on nodes, SSH open, and an unrestricted node identity (instance role or managed identity) are the findings.
- **Disable unless needed:** **public-ip-on-nodes**, **ssh-to-nodes**, **kubelet-anonymous-auth**, **kubelet-read-only-port**, **node-identity-over-broad**, **imdsv1-or-metadata-from-pods**, **unsupported-node-image**.
- **Depends on:** `identity` (node identity), `package-registry` (images), `update-service` (node image upgrades), `logging`, `monitoring`, `kms` (disk encryption).
- **Ask:** Is the node image maintained by the provider and auto-upgraded? Can pods reach the instance metadata endpoint? Is SSH to nodes needed at all? Are nodes in a private subnet? Is the node identity scoped to what kubelet needs?
- **Propose:** node `host` ("Node pool", `stack` = count) inside the cluster zone with `profile.platform.category: kubernetes` and `profile.patching`; `dependency` flows to the registry and the metadata or identity service; a security group as the subnet's appliance.
- **Threats:** Pod reaches the node's metadata endpoint and takes the node's cloud identity · Elevation of privilege · `ssrf` · CWE-918, T1552.005 · control: metadata access blocked for pods (network policy or the provider's metadata concealment), workload identity per pod, node identity scoped to kubelet ‖ Container escape to the node through a kernel or runtime vulnerability · Elevation of privilege · `vulnerable-components` · CWE-1395, T1611 · control: supported node image auto-upgraded, no privileged pods, seccomp and AppArmor profiles, sandboxed runtimes for untrusted workloads ‖ SSH to nodes with a shared key · Elevation of privilege · `credential-exposure` · CWE-798, T1021.004 · control: no SSH; node debugging through the provider's session tooling with MFA, nodes replaced not repaired.

## `k8s-namespace` — Namespace with RBAC, quotas and network policy
- **Icon:** none (zone kind `namespace`)
- **What:** The tenancy unit: who may do what, how much it may use, who may talk to it.
- **Attaches to:** Inside the cluster zone; one per application or team.
- **Default exposure:** Flat by default: every pod can reach every pod in every namespace until a network policy says otherwise; the default service account is mounted into every pod.
- **Disable unless needed:** **default-service-account-token-automount**, **no-network-policy**, **cluster-wide-roles-for-apps**, **privileged-pod-security**, **no-resource-quotas**.
- **Depends on:** the cluster's `identity` (RBAC bindings), `monitoring` (quotas, policy violations), `logging`.
- **Ask:** Is there a default-deny network policy with explicit allows? Which roles are bound in it, and to whom? Pod Security Standards level (restricted, baseline, privileged)? Resource quotas? Is the default service account's token automounted?
- **Propose:** zone `namespace` with `trust_boundary: true` inside the cluster; a network policy as an appliance of the namespace (`type: firewall`, label "Network policy"); `data` flows between namespaces with their real `auth` (mTLS from a mesh, or none, honestly).
- **Threats:** Compromised pod reaches every service in every namespace · Elevation of privilege · `excessive-trust-or-flat-network` · CWE-923, T1021 · control: default-deny network policies per namespace with explicit allows, a service mesh with mTLS and authorisation policies ‖ Application role bound at cluster scope escalates to the whole cluster · Elevation of privilege · `privilege-escalation` · CWE-269, T1078.004 · control: namespace-scoped roles, no wildcard verbs, RBAC reviewed, admission policy that refuses cluster-wide bindings for applications ‖ Privileged or host-mounting pod admitted · Elevation of privilege · `security-misconfiguration` · CWE-250, T1611 · control: Pod Security Standards restricted (or baseline) enforced by admission, no hostPath, no hostNetwork, no privileged.

## `k8s-ingress` — Ingress controller or gateway (NGINX Ingress, Traefik, the provider's gateway, Gateway API)
- **Icon:** `load-balancer` (appliance type `reverse-proxy` or `api-gateway` on the cluster or namespace zone)
- **What:** The one door from outside into the cluster's services; TLS termination, routing, often a WAF integration.
- **Attaches to:** The cluster zone's edge; backed by the provider's load balancer with a public or internal address.
- **Default exposure:** Internet-facing when the load balancer is public; a default backend, permissive annotations and TLS to the pods off are the findings.
- **Disable unless needed:** **public-load-balancer-when-internal-would-do**, **plaintext-to-backends**, **wildcard-hosts**, **snippet-annotations**, **default-backend-exposed**, **admission-webhook-off**.
- **Depends on:** `pki` (certificates, cert-manager), `dns`, `logging`, a WAF (`waf` appliance or the provider's) when Internet-facing.
- **Ask:** Public or internal load balancer? Is a WAF in front? TLS re-encrypted to the pods or terminated only at the edge? Which hosts and paths are routed and are any unauthenticated? Is the controller patched (its CVEs are frequent)?
- **Propose:** appliance `reverse-proxy` ("Ingress controller") with `edge: left`, `filters: inbound` on the cluster zone; a `waf` appliance outside it when one exists; `data` flows from users to the services through it.
- **Threats:** Ingress controller vulnerability or snippet annotation gives code execution in the cluster · Elevation of privilege · `vulnerable-components` · CWE-1395, T1190 · control: controller patched promptly, snippet annotations disabled, admission webhook on, least-privilege controller service account ‖ Internet requests reach the services without a WAF or rate limit · Tampering · `improper-input-validation` · CWE-20, T1190 · control: a WAF (provider's or in-cluster) with rate limiting in front of the ingress, authentication at the gateway for anything not public ‖ Plaintext between the ingress and the pods · Information disclosure · `missing-or-weak-encryption` · CWE-319, T1040 · control: TLS or mesh mTLS to the backends, certificates automated.

## `k8s-service-mesh` — Service mesh (Istio, Linkerd, Cilium mesh)
- **Icon:** `connector` (component type `agent` as a sidecar, or a `service` node for the control plane)
- **What:** mTLS, identity and authorisation between services, with telemetry; the mesh's control plane becomes a dependency of every call.
- **Attaches to:** Every pod in the mesh; the mesh control plane in its own namespace.
- **Default exposure:** mTLS in permissive mode by default (plaintext still accepted); authorisation policies absent until written; the control plane reachable by every pod.
- **Disable unless needed:** **permissive-mtls**, **no-authorization-policies**, **mesh-control-plane-reachable-by-workloads**, **telemetry-with-payloads**.
- **Depends on:** `pki` (mesh CA), the cluster's `identity`, `monitoring`, `logging`.
- **Ask:** Is mTLS strict everywhere, or permissive somewhere? Are authorisation policies default-deny? Which services are outside the mesh? Is the mesh CA's root key protected?
- **Propose:** `data` flows between services with `auth: mtls` and `transport.security_protocol: tls-1.3`; a `dependency` flow from workloads to the mesh control plane; the mesh CA as a `pki` dependency.
- **Threats:** Permissive mode leaves plaintext accepted beside mTLS · Spoofing · `missing-or-weak-encryption` · CWE-319, T1557 · control: strict mTLS cluster-wide, permissive only as a migration step with an end date ‖ No authorisation policy: any pod with a mesh identity calls any service · Elevation of privilege · `unauthorized-access` · CWE-862, T1021 · control: default-deny authorisation policies with per-service allows, identity-based not IP-based ‖ Mesh CA key compromised issues identities for anyone · Spoofing · `credential-exposure` · CWE-321, T1552 · control: CA key in a KMS or HSM, short certificate lifetimes, control plane isolated from workloads.

## `k8s-registry` — Container registry (ACR, ECR, Artifact Registry, Harbor, Docker Hub)
- **Icon:** `storage` (node type `storage` or `saas`)
- **What:** Where images come from; what it serves is what runs.
- **Attaches to:** Outside the cluster, private endpoint or public; the nodes pull with the node identity or a pull secret.
- **Default exposure:** Public registries are public; a private registry with anonymous pull, admin pull secrets in every namespace and no scanning are the findings.
- **Disable unless needed:** **anonymous-pull**, **mutable-tags-in-production**, **pull-from-public-registries**, **admin-credentials-as-pull-secret**, **no-vulnerability-scanning**.
- **Depends on:** `identity` (push and pull), `storage`, `kms`, `logging`, `pki` (signing keys).
- **Ask:** May nodes pull from any registry or only this one? Are images scanned and signed? Are tags immutable for production? How do nodes authenticate (node identity, workload identity, pull secret)? Who can push?
- **Propose:** node `storage` ("Container registry") with `cloud` when managed; `dependency` flows from the node pool and the CI/CD runner (`auth: managed-identity` or `api-key`, honestly); admission policy as a control.
- **Threats:** Image from an unapproved registry or a mutable tag runs in production · Tampering · `supply-chain` · CWE-494, T1525 · control: admission policy allows only this registry and signed images (Binary Authorization, Sigstore, Notary), immutable tags, digests pinned ‖ Vulnerable base image deployed and never rebuilt · Elevation of privilege · `vulnerable-components` · CWE-1395, T1190 · control: scanning on push and on schedule, rebuild on base image updates, deploy gates on critical findings ‖ Pull or push credential with push rights leaks from a pipeline · Tampering · `credential-exposure` · CWE-798, T1552 · control: workload identity for pulls, short-lived push credentials for the pipeline only, audit on pushes.

## `k8s-secrets` — Secrets in the cluster (Kubernetes Secrets, external secrets, CSI driver)
- **Icon:** `key` (component type `secrets`)
- **What:** How workloads get their credentials: a Secret object (base64 in etcd), an external vault through the CSI driver or an operator, or environment variables baked into images.
- **Attaches to:** The namespace; mounted as files or environment variables into pods.
- **Default exposure:** Secrets readable by anyone with get on secrets in the namespace, visible in etcd unless encrypted, and in environment variables to anyone who can exec into the pod.
- **Disable unless needed:** **secrets-in-environment-variables**, **secrets-in-images-or-manifests**, **get-secrets-for-humans**, **unencrypted-etcd**, **secrets-in-git**.
- **Depends on:** `secrets` (the external vault), `kms` (etcd encryption), the cluster's `identity` (workload identity to the vault).
- **Ask:** Where do secrets live, in etcd or an external vault? Who can read them (RBAC on secrets)? Are they mounted as files or environment variables? Are manifests in git free of secrets? Is etcd encrypted?
- **Propose:** `secrets` component on the workload node, or a `dependency` flow from the workload to the external vault node with `auth: managed-identity` / `workload-identity`; `depends_on` kind `secrets`.
- **Threats:** Any user with read on secrets dumps every credential of the namespace · Information disclosure · `credential-exposure` · CWE-522, T1552.007 · control: external vault with the CSI driver, RBAC that grants secrets read to nothing human, etcd encryption ‖ Secret committed to git with the manifests · Information disclosure · `credential-exposure` · CWE-540, T1552.001 · control: sealed secrets or external references in git, pre-commit scanning, rotation on exposure ‖ Secret in an environment variable read by a compromised process or a crash dump · Information disclosure · `sensitive-data-exposure` · CWE-526, T1552 · control: file mounts with restrictive modes, short-lived credentials fetched at start, no secrets in logs.

## `k8s-workload-identity` — Workload identity and RBAC (service accounts, IRSA, workload identity federation, pod identity)
- **Icon:** `shield` (component type `identity`)
- **What:** How a pod proves who it is to the cloud and to the cluster; the alternative to credentials in secrets.
- **Attaches to:** Each workload's service account, federated to a cloud identity with a scoped role.
- **Default exposure:** One service account per namespace by default, often with a broad cloud role attached "for now"; tokens automounted into every pod.
- **Disable unless needed:** **shared-service-account-across-workloads**, **cloud-role-with-wildcard**, **long-lived-service-account-tokens**, **token-automount-where-unneeded**.
- **Depends on:** the provider's `identity` (OIDC federation), the cluster's `identity` (RBAC), `logging` (cloud audit).
- **Ask:** Does each workload have its own service account and cloud role? Are roles scoped to the resources the workload uses? Are tokens short-lived and projected? Can a pod use another pod's identity on the same node?
- **Propose:** `auth: managed-identity` (or a declared `workload-identity` auth type) on the workload's flows to cloud services; `depends_on` kind `identity`; a control for per-workload identities.
- **Threats:** Shared service account gives every workload every other workload's rights · Elevation of privilege · `excessive-trust-or-flat-network` · CWE-250, T1078.004 · control: one service account and one cloud role per workload, least privilege, reviewed ‖ Over-broad cloud role attached to the pod identity · Elevation of privilege · `privilege-escalation` · CWE-269, T1078.004 · control: resource-scoped roles, policy that refuses wildcards, access analyser findings reviewed ‖ Long-lived service account token exfiltrated and reused outside the cluster · Spoofing · `credential-exposure` · CWE-798, T1528 · control: projected tokens with audience and short lifetime, token automount off, audit on token use from unexpected sources.
