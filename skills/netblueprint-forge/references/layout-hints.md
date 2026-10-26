# Layout hints

The renderer computes every position. The model only says how things relate, by name. Hints are advice; the renderer ignores a hint it cannot honour without overlap.

## How the canvas is built

- **Internet side** (left): a column of Internet nodes (`zone: "internet"`), then a column of zones nested on the Internet side (`parent: "internet"`, e.g. a provider cloud). Present only when the model has Internet-side elements.
- **Seam** with the labels `settings.internet_label` ◄ ► `settings.network_label`, only when both sides exist.
- **Private side** (right): top-level zones side by side, each laid out recursively.
- Inside a zone: rows. Nodes fill rows first (wrapping at `columns`), child zones follow on the next row side by side, unless hints say otherwise. Appliance bars sit on the zone's edges and the zone keeps a margin outside those edges so lines can pass.

## What the renderer does on its own

Rules that need no hint; know them so you do not fight them with `order` / `row`.

- **Internet column follows the private side.** Internet-side nodes are ordered and placed level with the private-side rows they talk to (the average of their partners' heights; a node with only Internet partners takes the mean of those; identity providers and bad actors only win ties toward the top and bottom bands). A user sits beside the service it reaches, a bad actor beside what it attacks. The canvas grows if the column runs below the private side; nodes are never pulled off their partners' rows. Setting `layout.order` or `row` on any Internet node keeps the model's sequence instead; the heights still align.
- **Centre-line locking across zones.** For the flows the story walks (data flows first, then tunnels, auth, token and control flows, in story order), two partners that sit side by side in different zones are brought onto one centre line: the higher one's row is given extra space above it, at the highest nesting level that moves only that chain, so sub-zones stay compact. One lift per pass; a lift that would break an alignment made earlier is undone and that pair is left as it is; lifts above 260 px are not attempted. Inside one zone row, a plain node centres on the component it talks to.
- **The router.** Lines are found by a search over the lines of sight between boxes (an orthogonal visibility graph), not by a fixed shape: every box, bar, title row, glyph corner and seam label is an obstacle with a buffer (12 px, 8 px for text rows, 4 px for glyph corners), and the cheapest route wins where cost is length plus 70 per bend, 45 per crossing of a line already routed (or per stretch shared with one in the same lane), 60 % more inside a zone that is neither endpoint's and 30 % more along a node's flank. The story's flows are routed first, so later ones route around them. A free middle segment is then centred in its alley and parallel lines are spread a lane apart.
- **Bars are crossed where the router decides.** A boundary bar offers every free lane of its usable band (inside its ends, off its glyph stacks, not within 8 px of another line through it); the router picks the lane by looking ahead along the route, so a line crosses a bar level with the port behind it when it can, and bends in the gutter before the bar rather than inside the zone after it. The endpoint's port adopts that lane when its side has room.
- **Clearance.** A boundary bar keeps 12 px clear of whatever lies outside its zone, a top or bottom bar never runs past the zone's far edge, and a zone is wide enough for its title plus such a bar.
- **Corridors grow with load.** A boundary bar that many flows pass through gets a wider corridor inside its zone (10 px per flow beyond three), so the lines that turn behind it have lanes of their own instead of sharing one. The count comes from the model (`via`, or the automatic route through the zones' bars), so it is known before layout.
- **Same-host component flows are brackets.** A flow between two rows of one host leaves and re-enters on the host side where those two rows have fewer partners (ties go right), 40 px out, so its badge sits on a stub clear of the rows' other lines. A component row's ports may use the row gap either side of the row, so a 28 px row carries up to four lanes.
- **Straight lines between neighbours.** A port aims at its real partner, looking through bars: near-level partners (within 40 px) meet at the midpoint when both sides can reach it, else at the centre the shorter side (a component row) can reach; a far partner on the same axis is aimed at when the side reaches it, else the port sits at the middle of the side; a partner whose side runs the other way gets an L-corner just past its box. A route whose ends face along one axis and whose bars are all crossed straight is made one line when a coordinate exists that both sides have room for and every bar accepts. Ports on one side are lanes 20 px apart (10 px on a short side): the story's flows take theirs first, a later flow moves, never the first.
- **Components are entered sideways.** A flow to or from a component (a row inside a host) uses the host's left or right side at that row's height, never the host's top or bottom, so it never runs down through the host's title or sibling rows.
- **Text is an obstacle.** Zone title rows, host title rows, node boxes and bars are avoided; pass-through ports on a bar keep off the bar's label.
- **Corners.** A zone is square-cornered on a side that carries a boundary bar and along its top when it is tall (height > 1.2 × width); the other corners stay rounded. Vertical bars have square top corners.
- **Bars span the zone.** A side bar runs the zone's height below the title; a top or bottom bar runs from the end of the title to the far edge. Bars are 40 px thick.
- **Two corners.** Threat circles: top-right stacking left on nodes, zones and horizontal bars; lower-left stacking up on tall zones and vertical bars. A mitigated threat carries a small green shield on its own circle. Control shields for everything else: bottom-left corner of a horizontal element (node, zone, horizontal bar), top-left corner of a vertical one (tall zone, vertical bar), stepping right / down when there are several.
- **The page grows, the canvas does not shrink.** Below the minimum canvas size (`settings.layout.min_width / min_height`) the page scrolls; the signature block is always reachable.

## Routing rules

The renderer applies these on every build. They are the "data highway / chokepoint / anti-dogleg / swimlane / badge / gutter" rules in this renderer's terms; where a rule needs the model's help, the hint is named.

1. **Centre-line locking (data highways).** Two boxes that connect across the axis and sit within 40 px of level meet at one shared coordinate: both ports take the midpoint, so the line is straight (0 bends). Beyond that, step-path partners in different zones are locked by lifting rows (see "What the renderer does on its own"), so the primary path is one straight vector wherever the topology allows; `row` remains for the cases the rules get wrong.
2. **Zero-deflection transit.** A boundary bar has one shared port per crossing: the line enters and leaves at the same coordinate. The router chooses it: level with the arriving line when nothing stands in the way, else level with the port the line is going to (the bend then happens in the gutter before the bar), never within 8 px of another line through the same bar and never on its glyph stacks. A bar adds no jog of its own; its label steps aside (rule 8).
3. **Anti-dogleg.** No micro-jog near a box: a near-level pair (|Δ| ≤ 40 px) is straightened by rule 1, a straight-topology route gets both ends on one coordinate, an endpoint next to a perpendicular bar aims at the bar's band, and a port whose partner is off-axis sits at the middle of the side (or at an L-corner past the partner's box) so the single bend happens mid-span, away from both boxes. Each end leaves and enters straight for at least 12 px.
4. **Swimlanes.** The Internet column is ordered by partners with a bias: identity providers rise to the top band, bad actors sink to the bottom band, users and services sit between. On the private side the bands are yours to set with `row`: identity and admin clients on row 0, the data path on row 1, monitoring / SIEM / out-of-band on the last row or in a flank zone. A blocked path from the bottom band stays low until its point of impact because its ports and corridors are chosen from the bottom.
5. **Badges off the vertices and off other lines.** Everything that belongs to a flow sits **on** its line: the auth badge, the ✕ of a blocked path, its threat circles and its control shield, each at its own spot (middle of the longest straight span, else just after the start, else just before the arrowhead, else the point with the most room). Each takes the first spot that is at least 16–20 px from every other line and from the flow's own bends; the other side of the line and a tighter clearance are tried before any overlap is accepted. Arrowheads are one size (9 px) whatever the stroke width, with the tip exactly on the box edge.
6. **Perimeter gutters.** Long cross-boundary lines travel in the gutters between zones (grid lines 16 px outside every zone edge, a lane 36 px above the seam labels across the top), stay out of zones that are neither endpoint's (60 % surcharge) and off the flanks of boxes (30 % surcharge within 7 px of a node's buffer), and never hug a container's border.
7. **Blocked corridor → U-turn.** When another box sits in the straight corridor between two endpoints, the line leaves and arrives on one free side (a U around the obstacle) instead of taking a port it cannot use straight; a component's own host never counts as an obstacle.
8. **Bars never deflect a line; their labels move.** With the crossing lanes fixed by rule 2, the bar's label and sub-label are drawn in the longest stretch of the bar that no line crosses, shortened with … if that stretch is small, and hidden altogether when no stretch of 36 px remains (the icon and the hover bubble carry the name).
9. **Component entries end on the host edge.** A line into or out of a component (a row inside a host) ends on the host's left or right border at the row's height, so the arrowhead is never hidden under the host.
10. **Precedence.** When goals conflict the renderer decides in this order. Never traded: boxes never overlap and bars keep 12 px clear (H1); a line never passes through or hugs a box, a title row, a glyph corner or the seam labels (H2); lines are orthogonal and leave or enter through the port's side, straight, for 12 px (H3); parallel lines stay a lane apart and glyphs sit where no other line passes (H4). Then weighed, in order: fewest bends (S1), fewest crossings (S2), a straight primary path (S3), shortest length (S4), out of foreign zones and off box flanks (S5), centred in the alley with deterministic tie-breaks, straight before right before left (S6). The full argument and the sources are in `docs/research/layout-routing.md` of the repository.

## Zone hints: `zone.layout`

| Hint | Effect |
| - | - |
| `arrange` | `grid` (default: nodes wrap at `columns`, child zones on the next row), `row` (everything side by side), `column` (everything stacked) |
| `columns` | Nodes per row for `grid` (default 3, fewer when there are fewer nodes) |
| `row` | Which row of the parent this zone occupies, 0-based. Lets a zone sit between rows of sibling nodes (hub on row 0, spoke on row 1, a monitoring node beside the hub with `node.layout.row: 0`) |
| `order` | Left-to-right order among siblings in the same row (lower first) |

## Node hints: `node.layout`

| Hint | Effect |
| - | - |
| `order` | Order among siblings in the same row |
| `row` | Row inside the zone, 0-based |
| `column` | Preferred column (sorts before `order`) |
| `align` | `start`, `center`, `end` within the zone width |
| `next_to` | Reserved for a later renderer version; accepted, not yet honoured |

Hosts with components are taller; put them first in a row or in their own row.

## Appliance hints

| Hint | Effect |
| - | - |
| `edge` | `left` (default on the private side), `right` (default on the Internet side), `top`, `bottom`. Side bars are vertical with rotated labels; top/bottom bars are horizontal and start just after the zone label |
| `filters` | `inbound`, `outbound` or `both` (default): which crossings route through the bar automatically |
| `serves` | Zone names (or `internet`) whose traffic uses this bar; a VPN gateway serves `["onprem"]`, a WAF serves everyone (omit) |

## Flow hints

| Hint | Effect |
| - | - |
| `via` | Explicit appliance list in order from source to destination; `[]` disables automatic routing through boundaries |
| `direction` | The arrow leaves the initiator (`from`). Leave unset for request/response flows; `two-way` (arrowheads at both ends) only when either side initiates |
| `kind: "trust"` | Dotted, never routed through appliances, no auth badge |

## Threat markers

Placed by the renderer, never by the model. Nodes and hosts: the top-right corner, stacking left; a component's circles sit on its host. Zones: inside the title row at the top-right; a tall zone (height > 1.2 × width) stacks them upward from the lower-left corner, clear of a left or bottom bar. Vertical bars: from the lower-left corner upward; horizontal bars: from the top-right corner leftward (pass-through lines keep off those stretches). Flows: on the line, at a spot clear of other lines and bends. Boundaries: on the zone's first bar, same stack. `marker: false` on a target hides that circle (the threat still lists the target).

## Common shapes

- **Hub-spoke cloud**: parent zone `arrange: "column"`; hub `row: 0`, spoke `row: 1`; hub's gateway `edge: "right"`, `serves: ["onprem"]`; the firewall as a `top` appliance of the spoke with `filters: "both"`; subnets inside the spoke in a row.
- **Three-tier on-prem**: zones DMZ → App → Data as children of the site, `arrange: "row"`; firewall on the site's left edge; NSG-like appliances on the left edge of App and Data.
- **Office + SaaS**: office zone on the private side; SaaS as `type: "saas"` nodes on the Internet side; identity provider on the Internet side; the office firewall `edge: "left"`.
- **OT network**: an `ot` zone with its own firewall, `trust_boundary: true`; devices of type `iot`/`ot`.

## Layout principles

The model should follow these so the computed layout comes out clean. They are the renderer-neutral form of the tiered-subgraph / invisible-rank-edge / non-constraining-edge discipline used with Mermaid and DOT; here the equivalents are zone nesting, declaration order, flow kinds and the hints above.

1. **Tiered zoning.** Every trust boundary (Internet, DMZ/ingress, internal network, data tier, secure enclave, out-of-band management) is its own zone, nested where the real network nests. Order sibling zones strictly by tier along the main axis: Internet side → perimeter → workloads → data. `arrange: "row"` reads the tiers west → east; `arrange: "column"` reads them north → south.
2. **Declaration order is visual order.** Siblings without `order` / `row` are placed in the order they appear in the model, so write zones, nodes and components west → east, north → south exactly as they should appear. Set `order` / `row` only for a tie the sequence cannot express.
3. **Primary and secondary flows.** The flows the `steps` walk are primary: they run along the main axis and get the routing lanes. Telemetry, logging, IAM and token calls, backups and administrative access are secondary: give them `kind: "control"`, `"auth"` or `"token"` (`"trust"` for a standing trust relationship, drawn dotted and never routed through appliances) and put their destinations (SIEM, identity provider, key vault, bastion) in a dedicated flank zone or on the Internet side, never between two tiers. Flows never move boxes in this renderer; a secondary flow can only clutter, so keep its endpoints out of the main path.
4. **Anchoring.** Where Mermaid uses `A ~~~ B` or DOT `style=invis` to lock two elements together, use the same `row` (and consecutive `order`) on the pair, or give them a parent zone with `arrange: "row"` / `"column"`. Nothing unrelated should sit between two zones that hand traffic to each other.
5. **Structure before connections.** Keep `zones` and `nodes` complete before `flows` in the file; a flow never implies an element. The validator rejects a reference to anything not declared.
6. **Short labels.** Keep `label` to two or three words and move the rest to `sub` or `description`; boxes have fixed widths and long labels truncate with "…". Zone titles wrap, node labels do not.
7. **Stores and auxiliaries at the base or flank.** Data stores sit in the last tier (east, or south in a column layout); auxiliary services (monitoring, identity, key management, admin brokers) flank the main path in their own zone rather than interrupting it.

## Settings

`settings.layout.min_width` / `min_height` (defaults 1280 × 640): the canvas never gets smaller than this; the page scrolls instead. `settings.layout.flow_direction` is accepted but only `left-to-right` is rendered today.
