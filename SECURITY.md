# Security policy

## What to report

NetBlueprint Forge is a skill plus a few Node.js scripts with no dependencies, and its output is a self-contained HTML page. The things worth a private report:

- A model, an icon, a layout hint or any other input that makes a rendered page run script that is not the renderer's own, or load anything from the network.
- A fetched product logo that gets past the checks in `scripts/icons.mjs` (scripts, event handlers, foreign objects, external references) into `icons.json` and from there into a page.
- A script (`validate`, `build`, `archive`, `icons`, `scenario`, `check`, `screenshot`, `normalize`, `model-reference`) that reads or writes outside the model's folder, or runs anything a model told it to.
- An install script (`platforms/install.ps1`, `platforms/install.sh`) or the packager doing more than the README says.
- Anything in the repository that should not be there: a credential, a token, data from a real network.

What is not a vulnerability here: the renderer embeds the model in the page by design, so a page shows whatever its model holds, and a model that describes a real network is sensitive because of its content, not because of the skill. Keep such models out of issues, and out of reports unless the report needs them; then redact them first.

## How to report

Privately, not as an issue:

- On GitHub: the Security tab, then "Report a vulnerability", which opens a draft advisory that only the maintainers see.
- By email: subscriptions@digitalprez.com with "NetBlueprint Forge security" in the subject line.

Say which version (the skill version from `SKILL.md` or the zip name, and the renderer version from the page footer), what the input was and what happened. A minimal model that reproduces it is the most useful thing you can send; replace real names first.

You will get an acknowledgement, a fix in the next release when the report holds up, and credit in the changelog if you want it. There is no bounty programme.

## Supported versions

The current release on the [Releases page](https://github.com/digitalprezllc/netblueprint-forge/releases) and the tip of `master`. Earlier versions are not patched; update instead. A rendered page carries its renderer version in the footer and keeps working on its own; a renderer fix reaches a page when its model is built again with `node scripts/build.mjs`.
