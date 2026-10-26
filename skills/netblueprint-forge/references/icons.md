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
