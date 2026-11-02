# Icons

Every node, component, appliance and zone can carry an `icon`. Most never need one: the type picks a sensible default. Set `icon` only to override.

## Icon names

| Icon | Depicts | Typical use |
| - | - | - |
| `server` | Rack unit with LEDs | Servers, VMs, web/app servers |
| `database` | Cylinder | Databases |
| `service` | Gear | Services, daemons, schedulers, agents |
| `api` | Braces | APIs, gateways' back ends |
| `connector` | Hexagon with dot | Connectors, routers, proxies, NAT |
| `cloud` | Cloud | SaaS, cloud services, PaaS hosts |
| `shield` | Shield with tick | Identity providers, WAF, security services |
| `firewall` | Brick wall | Firewalls, NGFW, NSG |
| `lock` | Padlock | Bastion, VPN, vaults, restricted zones |
| `key` | Key | Key Vault, secrets, certificates |
| `user` | Badge with person | Users on the private network |
| `remote-user` | Person with signal | Remote users, customers |
| `admin` | Person with key | Administrators |
| `bad-actor` | Hooded figure (red accent) | Attackers |
| `laptop` | Laptop | Managed laptops |
| `workstation` | Monitor | Desktops, jump hosts |
| `mobile` | Phone | Mobile devices |
| `iot` | Chip | IoT devices |
| `ot` | Gear with bolt | OT / industrial controllers |
| `storage` | Bucket | Object storage, file shares |
| `queue` | Stacked bars | Queues, message brokers, switches |
| `cache` | Lightning bolt | Caches |
| `container` | Cube | Containers |
| `kubernetes` | Heptagon with hub | Kubernetes clusters |
| `function` | Lambda | Serverless functions |
| `load-balancer` | Fork | Load balancers, application gateways |
| `dns` / `globe` | Globe | DNS, public endpoints, SD-WAN |
| `mail` | Envelope | Mail servers |
| `directory` | Tree | Directory services (AD DS, LDAP) |
| `monitor` | Eye | Monitoring, logging, IDS/IPS |
| `building` | Building | Sites, offices |
| `generic` | Rounded square | Anything else |

## Defaults by type

Node types: server, host → `server`; service → `service`; database → `database`; storage → `storage`; api → `api`; connector → `connector`; saas → `cloud`; public-endpoint → `globe`; user → `user`; remote-user → `remote-user`; admin → `admin`; bad-actor → `bad-actor`; laptop, workstation, mobile, iot, ot → same name; identity-provider → `shield`; generic → `generic`.

Component types: web-server, app-server → `server`; api → `api`; database, sql-server → `database`; cache → `cache`; queue → `queue`; file-share, storage → `storage`; directory → `directory`; dns → `dns`; mail → `mail`; container → `container`; function → `function`; agent, scheduler, process → `service`; secrets → `key`; monitoring → `monitor`; identity → `shield`; custom → `generic`.

Appliance types: firewall, ngfw → `firewall`; waf → `shield`; gateway, proxy, reverse-proxy, nat, zero-trust-broker, router → `connector`; api-gateway → `api`; load-balancer → `load-balancer`; bastion, vpn → `lock`; ids-ips → `monitor`; sd-wan → `globe`; switch → `queue`; other → `generic`.

Zones have no default icon; `lock` or `building` are the usual choices when one is wanted.

## Vendor icons

Besides the names above, `icon` accepts the official icon of a cloud service as `<provider>/<id>`: `azure/key-vaults`, `aws/lambda`, `gcp/cloud-sql`. The library ships with the skill in `assets/icons/` (Microsoft Azure with Microsoft Entra, AWS, Google Cloud) and the icons are drawn exactly as the vendors publish them, in the same slot a line icon uses.

- **Finding an id:** `node scripts/icons.mjs search "<service>"` prints matching ids with their titles; aliases such as `aws/s3`, `azure/key-vault` or `gcp/gcs` resolve to the canonical id. `node scripts/icons.mjs check <model.json>` lists a model's vendor icons and any the library lacks.
- **Automatic on cloud nodes:** a node with `cloud.card` shows the card's icon without an `icon` field. Set `icon` only to choose another, to put a vendor icon on a zone (`azure/virtual-networks`, `azure/subnet`, `aws/group-virtual-private-cloud-vpc`), an appliance (`azure/firewalls`, `azure/network-security-groups`, `aws/waf`) or a component, or to force a line icon (a built-in name) on one element. `settings.icons.vendor: false` keeps line icons for the whole model.
- **What the AWS ids mean:** service icons are named after the service without the "Amazon" or "AWS" prefix (`aws/lambda`, `aws/simple-storage-service`); resource icons name the resource (`aws/ec2-instance`, `aws/simple-storage-service-bucket`); `aws/group-…` are the group icons (VPC, subnets, Region, AWS Cloud) and `aws/category-…` the category icons. Google ids follow the product name (`gcp/cloud-run`, `gcp/compute-engine`); `gcp/category-…` are Google's 2025 category icons for products that have no icon of their own.
- **Rules that come with the icons** (the vendors' terms, reproduced in `THIRD-PARTY-NOTICES.md`): an icon represents only the product it was designed for, so never put a vendor icon on something else; the service name stays beside the icon, which the label does; nothing is recoloured, cropped, flipped or rotated, which the renderer never does. An icon the library lacks is reported by the validator and the build, and the element falls back to its line icon.

## Product logos (fetched on demand)

A product that is not a cloud service, such as a Fortinet or Palo Alto firewall, a Sophos agent, a Check Point gateway or an Okta tenant, can carry its logo from the [Dashboard Icons](https://dashboardicons.com/) collection as `dashboard/<name>`. The skill ships none of these: one command fetches one logo into `icons.json` beside the model, and the build embeds it from there, so the page stays self-contained and the model folder carries everything it needs.

- **Finding a name:** `node scripts/icons.mjs search "palo alto" --provider dashboard` searches the collection's catalogue online and prints names (`dashboard/palo-alto`), aliases, categories and whether an SVG exists; a few logos are PNG only and cannot be fetched. The name is the file name on dashboardicons.com without `.svg`. Never guess a name: search, then fetch.
- **Fetching:** `node scripts/icons.mjs fetch dashboard/fortinet dashboard/check-point --model netblueprint/<model-name>/model.json` downloads each SVG from the collection's CDN (jsDelivr, then GitHub), refuses one that carries a script, an event handler, a foreign object or an external reference, normalizes it like a vendor icon and writes it to `icons.json` next to the model. Keep that file with the model and commit it with the model: a build on another machine needs no network. A name the collection lacks prints the closest names.
- **Using it:** `icon: "dashboard/fortinet"` on a firewall bar, a node, a component or a zone. `settings.icons.vendor: false` does not switch logos off, since each one was asked for by name. A logo the model names but `icons.json` lacks falls back to the line icon, and the validator and the build print the fetch command that restores it.
- **Dark variants and wordmarks:** a logo made for dark backgrounds is a separate name (`dashboard/sophos-dark`); the plain name is the one for the white page. A wide logo is scaled to fit the slot, never cropped.
- **Terms:** the collection is published under the Apache License 2.0 and states that the logos stay the property of their owners and serve identification only; `THIRD-PARTY-NOTICES.md` repeats it. Use a logo only for the product it depicts, and prefer the shipped vendor icon for a cloud service.
