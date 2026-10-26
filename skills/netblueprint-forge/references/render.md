# Validate, build, check

```bash
node scripts/validate.mjs <model.json> --fix     # schema + cross-reference lint; writes computed ratings
node scripts/build.mjs <model.json>              # -> <model-name>.html next to the model (runs validate first)
node scripts/check.mjs <model-name>.html         # headless geometry check of every tab; needs Chrome / Chromium on the machine
node scripts/screenshot.mjs <model-name>.html --tab <name> --step <n>   # PNG of one view (whole page, natural size); same browser
```

Open the HTML in a browser (it is self-contained; file:// works). `build.mjs` refuses a model with errors. `check.mjs` opens the page headless, lets it check its own geometry on every diagram tab and fails (exit 1) when a line passes through or within 8 px of a box it does not touch, runs over text, clashes with a glyph, jogs, shares a lane with another line, or could not be routed; it prints crossings and the longest flow's bends per tab (`--max-crossings N` / `--max-bends N` make them limits). Exit 2 means no Chromium-based browser was found (Chrome, Chromium, Brave or Playwright's; `--browser <exe>` or `NB_BROWSER` for an unusual path; Edge on Windows prints nothing while it is open). Run it after every build that changed geometry, before showing the page.

`screenshot.mjs` renders one view of a built page to a PNG for a document or a deck, with the same browser: `--tab <name>`, `--step <n or step name>` (n counts the story's steps, then the attack-path hops) or `--path AP-nnnn --hop <n>` pick what the band and the canvas show; the picture holds the whole page, band to signature block, at the diagram's natural size (`--height auto`, the default, measures it first) unless `--height <px>` fixes it, and `--scale 2` doubles the pixels. The default name is `<page>-<tab>-<step>.png` next to the page; `-o` sets another.

## Reading validator output

- `error:` lines with a path (`threats[2].risk.likelihood: …`) are **schema** problems: wrong value, missing required field, unexpected property. Fix the JSON.
- `error:` lines in words (`flow "f-api-sql": to "sql-02" is not a node…`) are **lint** problems: a reference that does not resolve, a duplicate name, a status rule, a rating that does not match its inputs. Fix the reference or run `--fix` for ratings.
- `warning:` lines never block a build: flows without auth, mitigate without controls, empty zones, suggested elements, overdue controls, a missing outcome. Tell the user about the ones that matter and offer to resolve them.
- Exit code 1 means errors; 2 means the file could not be read.

## What the diagram offers (tell the user once)

- **Band** at the top: title, Reset / Back / Next, phase chips, summary, current step with its flows and auth strength. **Collapse** (or key `C`) shrinks it to one strip. Arrow keys step; `R` resets.
- **Toolbar**: Layers card, a Threat Register button that jumps to the register tab, severity chips that hide threat bands on the canvas and filter the register, zoom controls (Ctrl+wheel, double-click, drag when zoomed).
- **Click** a node, component, zone label, appliance, flow or threat circle: the element gets a soft shadow in its own colour and the **Attributes card** opens; **hovering** any element, badge, circle, shield, chip or button shows a styled bubble (heading + detail) instead of a browser tooltip (a flow lists Source / Destination as "source ⇒ destination", the relevant end in bold): a floating, draggable card (drag its right edge to widen it, its corner to resize both ways; it remembers the size) listing every attribute alphabetically, Title Case, with a filter box; a threat click also highlights every target. Out-of-scope elements are greyed out but keep their attributes. `Esc` clears the highlight.
- A **mitigated** threat's circle carries a small green shield-with-check at its top-right (its hover bubble shows the status as a bold pill: Open on amber, Mitigated on green, In Progress on blue, Accepted / Transferred neutral, Retired struck through; and lists the controls in place); an open threat never does, whatever controls it lists. The standalone green shield (controls in place on an element) sits at the element's bottom-left corner (top-left on a vertical bar or tall zone) and is drawn only for controls not already shown on a mitigated threat's circle there.
- **Attack paths**: each path is a red phase at the end of the walkthrough; Next walks its hops with numbered red markers on the chain's flows, the band shows the hop's gain, note and threat, and the last hop ends with the impact. Click a hop marker to jump to it; a threat's bubble and card name the paths it is part of; the path's own Attributes card lists its hops with links. The **Threat Register** has an Attack Paths table under the threats; a row opens the path on its diagram.
- **What-if tabs** carry a What-If tag in the tab strip and open with the change statement and a link back to the baseline tab; `scripts/scenario.mjs` prints the delta between the two.
- **Legend** lists only what the model uses; the **signature block** shows title, author, organization, date, model and renderer versions, classification and logo.

## Layout checklist (run after every build that changed geometry)

Look at the whole diagram once, then check:

1. Every zone label is readable and no bar covers it.
2. No line passes through a box it does not connect to; no two lines run on top of each other for more than a few pixels.
3. Blocked paths show their ✕; flows show an auth badge (lock = strong, dot = moderate, ! = weak/none, ? = unspecified).
4. Threat circles sit on the right targets (top-right of nodes / zones / horizontal bars, lower-left of tall zones / vertical bars, on the line for flows), mitigated ones carry the small shield, control shields sit bottom-left (top-left on vertical bars); no badge, circle or ✕ touches another line; the Threat Register tab lists every threat and its search and sort work.
5. At the user's screen size the page fits without scrolling; below `settings.layout.min_width × min_height` it scrolls.

For an exact check run `node scripts/check.mjs <page.html>` (above). Without a browser available to Node, open the page and run `window.__nbTabs.check()` in its console (or open it with `?nbcheck=1` and read the `#nb-report` element): the same report, per tab, with collisions, near misses, unrouted legs, lines over text, text overlaps, glyph clashes, jogs, shared lanes, crossings and bends.

## Fixing what you see

| Symptom | Fix |
| - | - |
| A flow runs through the wrong appliance, or none | `flow.via` (explicit list, `[]` for none), or the appliance's `filters` / `serves` |
| A bar sits on the wrong edge | `appliance.edge` |
| Nodes in a zone wrap into an awkward grid | `zone.layout.arrange` (`row`, `column`, `grid`) and `columns` |
| A zone should sit between two rows of nodes, or beside another zone | `zone.layout.row` / `order`; `node.layout.row` / `order` |
| Long lines cross the whole diagram | put the far-apart elements in the same row, or accept the top/bottom corridor the router chose |
| The canvas is cramped on the user's screen | raise `settings.layout.min_width/min_height`; the page then scrolls on smaller screens |
| Labels truncated with … | shorten `label`/`sub`; the boxes have fixed widths |
| A line bends between two boxes that sit side by side | the renderer locks step-path partners onto one centre line by lifting rows; a flow outside the story, a lift above 260 px, or a lift that would break an earlier alignment is left bent. Add the flow to a step, or give the pair the same `row` in zones of the same shape |
| A line crosses a bar far from the box it goes to, or takes a detour | the bar's band is used up there (its control shield takes the first 24 px, its threat stack the last 30 px per circle, and two lines never cross within 8 px of each other) or the straight lane would end in a box; the router then bends in the gutter before the bar. Give the far element a `row` level with the bar's free band, or move the threat to the zone instead of the bar |
| Two lines run 10 px apart along a component row | a component row is 28 px tall, so two flows into the same row can only be 10 px apart; put one of them on a different component or on the host itself |
| Internet nodes are in the wrong order | remove `layout.order` from them so they follow their private-side partners, or set `order` on all of them |
| A line crosses a zone title or a host title | should not happen (titles are obstacles); if it does, move the far element with `row`/`order` so a corridor exists, and report it |

See `layout-hints.md` for the full list of hints and the **Layout principles** (tiered zoning, declaration order, primary vs secondary flows, anchoring, short labels) to apply before reaching for hints.

## Tabs, the register and the signature block

- A model with `tabs[]` renders a tab strip under the canvas (left to right in model order). PageUp / PageDown switch tabs. Everything above the strip (band, canvas, legend, severity counts) is the current tab's; layer and severity toggles persist across tabs.
- **Deep links.** The URL hash opens the page at a point: `#tab=<name>` a tab, `&step=<n or step name>` the walkthrough at that step (n counts the story's steps, then the attack-path hops; a hop's name is `AP-nnnn-hop-<n>`), `&path=AP-nnnn&hop=<n>` an attack path at a hop. `page.html#tab=main&step=5` or `page.html#path=AP-0001&hop=2` is a link to paste for a colleague; once the page has settled the hash shows the tab alone. `scripts/screenshot.mjs` turns the same link into a PNG.
- **Threat Register** is always the last tab (also in a single-diagram document): one full-size table of every diagram's threats (Diagram column, description under the title), a search box, sortable columns, and the severity chips filter it like the canvas. Inherent, Current and Projected are plain text; the numbered circle in the first column carries the current band's colour. Clicking a row opens the threat on its diagram. The toolbar button jumps to that tab; "Threat Register (n)" counts all diagrams.
- Threat circles on a tall zone stack up from its lower-left corner (see layout-hints).
- The signature block is a title block: organization and logo, subtitle / title / description, then Document No. (`meta.document_id`), Revision (`version`), Date, Prepared By (`author`), Reviewed By, Approved By, Status, and the classification badge. Fill those meta fields for a client-ready footer.
- Capitalization: labels, titles, attribute names and enumerated values are shown Title Case; run `validate --fix` to normalize the model's own labels and titles.
- A bar's label moves to the stretch no line crosses; a line always crosses a bar straight at the height it arrives. If a label reads "…", hover the bar or open its attributes for the full text.
- Arrows leave the initiator. If an arrow points the wrong way, swap `from`/`to`; do not use `two-way` to paper over it.
- `window.__nb.LIFT` lists the row lifts the centre-line pass applied (`zone#row: px`); `window.__nb.collisions` (a segment through a box) and `window.__nb.nearMisses` (within 8 px of one) are measured on the final geometry and should be empty; `window.__nb.routes[i].fallback` counts legs the router could not route (should be 0); `window.__nb.router` exposes the routing grid (`XS`, `YS`, `nodeOk`, `edgeOk`, `INFL`); `window.__nbTabs` lists tab names and switches tabs from the console.

## Logo

Embed the user's logo as a `data:` URI in `meta.logo` (PNG, JPEG, SVG or WebP, ideally under 200 KB). On Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('logo.png'))` prefixed with `data:image/png;base64,`.
