# Revising an existing model

Every change follows the same five steps. Do not skip the first one.

```bash
node scripts/archive.mjs netblueprint/<name>/model.json --note "<what you are about to change>"
#   edit model.json by element name
node scripts/validate.mjs netblueprint/<name>/model.json --fix
node scripts/build.mjs netblueprint/<name>/model.json
node scripts/archive.mjs netblueprint/<name>/model.json --diff
```

1. **Archive first.** `archive.mjs` copies the current `model.json` and the rendered HTML into `archive/` as `<name>-v<version>_<timestamp>.*`, bumps `meta.version` (patch; `--bump minor|major` for bigger changes), sets `meta.date`, stores your note in `meta.revision_note`, and opens an entry in `archive/CHANGELOG.md`. If the user is unsure, show `--dry-run` first.
2. **Edit by name.** The user says "move SQL-01 into the data subnet", "rename the jump VM", "add a flow from the API to the queue", "the WAF now serves the partner site too". Find the element by its `name`/`id`, change only what was asked, keep names stable (change `label` to rename what people see). New elements get new names; confirm them.
3. **Validate and fix.** Zero errors before building. The validator recomputes ratings; read its warnings to the user when they are relevant to the change.
4. **Build** and look at the result (`render.md` checklist). If the change moved things, layout hints may need adjusting (`layout-hints.md`).
5. **Log the diff.** `--diff` compares the model with the latest snapshot and appends "added / removed / changed" lines per element to the changelog. Read that list back to the user as the confirmation of what changed.

## Rules

- Never delete a threat or control; retire it (`status: "retired"`, `retired: true`, `status_reason`). Numbers and ids are never reused.
- Never hand-edit `risk.rating`, `risk.score` or the OWASP averages; change the inputs and run `--fix`.
- Removing a node, zone or flow: first look for references (flows, steps, targets, `implemented_on`, `via`, `serves`, `parent`); the validator lists any you missed. Steps that lose their last flow should be rewritten or removed, not left empty.
- Changing a name breaks references; prefer changing `label`. If a name must change, update every reference in the same edit and say so in the note.
- A model whose `netblueprint` version the build script refuses needs a migration, not a hack; stop and tell the user.
- Keep the user informed in element names and versions: "Archived v1.0.3; now v1.0.4: moved `sql-01` from `snet-app` to `snet-data`, re-routed `f-api-sql` through `nsg-data`."

## Reading the changelog

`archive/CHANGELOG.md` has one `## v<version> · <date> · <note>` entry per revision with the snapshot file names and, after `--diff`, the element-level changes. To compare two older revisions, diff their snapshot files.

## Tabs

In a tabbed model every edit names the tab: "in tab `admin-access`, add node `jump-host` …". `archive.mjs` snapshots the whole file; `--diff` prefixes each change with `tab <name> ›`. Adding a tab: append it to `tabs[]` (its position is its place in the strip), continue the threat and control numbering from the highest across all tabs, validate, build. Removing a tab: retire its threats (keep their numbers) rather than deleting them when any other document cites them. A what-if scenario is a tab too (`scenario.baseline` names the tab it copies, and it may repeat that tab's ids): see `what-if.md` for deriving, promoting and dropping one.
