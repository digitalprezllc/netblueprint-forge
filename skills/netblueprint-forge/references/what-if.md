# What-if scenarios (Mode B)

A what-if is a change statement applied to an existing diagram: *"What if we replace the direct SQL read with a public-facing Redis cache for read-through caching?"* The answer is a second tab of the same document that shows the system with the change applied, plus a delta: what the change adds, removes and alters; the trust boundaries it newly crosses; the controls it invalidates; how threats and attack paths move. The baseline stays untouched, so the two can be read side by side and the register lists both.

## When to run it

- The user asks "what if …", "if we changed …", "suppose we …", "compare with …", or hands you a proposed design change for a model that exists.
- Not for a change that has been decided and made: that is a revision (`revise-and-archive.md`). An accepted scenario becomes the new baseline by promotion (below).

## Steps

1. **Archive first** (`archive.mjs --note "what-if: <change>"`), as for any edit.
2. **Name the baseline tab.** A single-diagram model first becomes a tabbed one: move its collections into `tabs[0]` (`name: "main"`, `label: "Baseline"`) so the scenario has something to sit beside. Nothing else changes; `#tab=main` opens it.
3. **Copy the baseline tab** to a new tab at the end of `tabs[]`: `name` from the change (`whatif-redis`), `label` "What-If: <Short Change>", and `scenario: { baseline: "main", change: "<the user's words>", date, author, assumptions[] }`. The copy keeps every element, threat, control and attack path with the same ids: the validator allows a scenario to repeat its baseline's ids (and only a scenario).
4. **Apply the change** to the copy, by name: add, remove or alter zones, appliances, nodes, flows and steps. Give every new flow its `auth`, `data_classification` and `data_tags`. Draw what the change makes reachable as it is: a public endpoint anyone can reach is a `data` flow from the bad actor with the real credential, not a `blocked` one.
5. **Re-run the threat pass on what changed** (`threats.md`): new elements and flows get threats with the next free numbers across the whole document (THR-0006 when the baseline ended at 5); threats whose targets changed are re-rated (`risk`, `residual`, `projected`); controls the change removes or defeats are dropped or re-pointed; new controls are `proposed` or `planned` with an owner.
6. **Trace the cascades** (`threats.md`, "Attack paths"): does the change open a new chain or lengthen one? Add `attack_paths[]` with the next free AP numbers; keep the baseline's paths in the copy, re-rated if a hop changed.
7. **Validate `--fix`, build, check.**
8. **Write the delta.** `node scripts/scenario.mjs <model.json> --tab <name>` prints it as Markdown (`--json` for the data): elements added, removed and changed; new or altered trust-boundary crossings; new Internet-facing paths; weakened flows (authentication, encryption, more sensitive data); controls invalidated (an element they sit on is gone, or a threat still cites a control the scenario dropped); threats and attack paths added, removed or moved (status, current, inherent and projected bands, hops, controls). Put the "In one line" summary in the scenario tab's `description`, the full report in the changelog or the user's notes, and tell the user the delta in those terms, worst first.

## Promoting or dropping a scenario

- **Accepted:** archive, replace the baseline tab's collections with the scenario's, remove the scenario tab, bump the minor version, log it ("promoted what-if: <change>").
- **Rejected:** archive, remove the scenario tab (its threat and path numbers are not reused by anything else, so nothing needs retiring), log it.
- Several scenarios of one baseline may coexist; each derives from the baseline, never from another scenario (the validator warns).

## What the reader sees

The tab strip marks the scenario with a What-If tag; its band opens with the change statement and a link back to the baseline tab; the register lists both tabs' threats and attack paths with the Diagram column telling them apart; the walkthrough, hop markers and attributes cards work as on any tab.
