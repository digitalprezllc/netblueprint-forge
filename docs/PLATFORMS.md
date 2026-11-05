# Platform install matrix

Checked 2026-10-23 against each vendor's documentation. Every tool below reads the same `SKILL.md` format defined by the [Agent Skills specification](https://agentskills.io/specification): a folder named after the skill, a `SKILL.md` with YAML frontmatter (`name` ≤ 64 chars, lowercase/digits/hyphens, must match the folder; `description` ≤ 1024 chars; optional `license`, `compatibility`, `metadata`, `allowed-tools`), and optional `scripts/`, `references/`, `assets/`.

## Where each tool looks

| Tool | Project-level | User-level | Also reads | Invoke |
| - | - | - | - | - |
| **Claude Code** | `.claude/skills/` | `~/.claude/skills/` | plugins: `<plugin>/skills/` | auto, or `/netblueprint-forge` |
| **OpenAI Codex / ChatGPT** | `.agents/skills/` (CWD, parents up to repo root, repo root) | `~/.agents/skills/` | `/etc/codex/skills` (admin) | auto, `$netblueprint-forge` in Codex, `@` in ChatGPT |
| **GitHub Copilot** (VS Code, CLI, cloud agent, Visual Studio) | `.github/skills/`, `.claude/skills/`, `.agents/skills/` | `~/.copilot/skills/`, `~/.claude/skills/`, `~/.agents/skills/` | | auto, or `/netblueprint-forge` |
| **Kiro** | `.kiro/skills/` | `~/.kiro/skills/` | import from GitHub folder URL or local folder in *Agent Steering & Skills* | auto, or `/netblueprint-forge` |
| **Cursor** | `.agents/skills/`, `.cursor/skills/` | `~/.agents/skills/`, `~/.cursor/skills/` | `.claude/skills/`, `.codex/skills/` | auto, or `/netblueprint-forge`; Alt+Enter as a Custom Mode |
| **Gemini CLI** (Antigravity CLI) | `.agents/skills/`, `.gemini/skills/` | `~/.agents/skills/`, `~/.gemini/skills/` | | auto via `activate_skill`, with a consent prompt |
| **Windsurf / Devin Desktop** | `.devin/skills/`, legacy `.windsurf/skills/`, `.agents/skills/` | `~/.config/devin/skills/`, `~/.codeium/windsurf/skills/`, `~/.agents/skills/` | `.claude/skills/` if Claude config reading is enabled | auto, or `@netblueprint-forge` |

**Conclusion:** linking `skills/netblueprint-forge/` to **`.agents/skills/`**, **`.claude/skills/`** and **`.kiro/skills/`** covers every tool above. `platforms/install.ps1` and `install.sh` do exactly that.

## Platform-specific extras (optional)

| Tool | File | Purpose |
| - | - | - |
| Claude Code | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` at repo root | Install this repo as a plugin: `/plugin marketplace add digitalprezllc/netblueprint-forge` then `/plugin install netblueprint-forge@netblueprint` (the marketplace is named `netblueprint` in `marketplace.json`). Validate with `claude plugin validate .` |
| Codex / ChatGPT | `skills/netblueprint-forge/agents/openai.yaml` | Display name, icon, brand colour, default prompt in the ChatGPT desktop app; `policy.allow_implicit_invocation`; tool dependencies. Standalone skills work in ChatGPT desktop, Codex CLI and the IDE extension; web/mobile need plugin packaging (not yet done). |
| Cursor | frontmatter `paths`, `disable-model-invocation`, `icon`, `color` | Scope the skill to file globs or make it explicit-only. Not used; the skill should trigger on intent, not file type. |
| Kiro | `.kiro/steering/*.md` | Always-on project context. Not needed; skills load on demand. Custom Kiro agents must list `skill://.kiro/skills/*/SKILL.md` in `resources`. |
| Gemini CLI | none | Skills discovered automatically; manage with `/skills enable|disable|reload`. |

## Release archive

Every release on the repository's Releases page carries `netblueprint-forge-<version>.zip`, built by `platforms/package.mjs`: one top-level folder, `netblueprint-forge/`, with `SKILL.md`, `LICENSE`, `references/`, `scripts/`, `assets/` and `agents/` inside. That is the shape claude.ai accepts when a custom skill is uploaded in its Skills settings and the shape the Claude API takes for a skill; for the tools above it is the offline alternative to the install scripts: unzip it into the folder the table names. The release number is the skill version from `SKILL.md`. Every archive is also published at https://bifrost.digitalprez.com/download/netblueprint-forge/releases/ beside the live example pages.

## Other tools

Amp, OpenCode, Goose, Roo Code, JetBrains Junie, Factory and others also read `.agents/skills/`, so they are covered by the same link. Microsoft 365 Copilot / Copilot Studio declarative agents use a different packaging (manifest + instructions) and are out of scope; GitHub Copilot in Visual Studio is covered by the Copilot row.

## Sample sessions

Two sessions in the same shape as the README's payments example: what you want, what you say, which interview sections carry it, what the page shows, and the next move. The skill is the same folder in every tool; output lands in `netblueprint/<model-name>/` in your project whichever tool you use.

### Cursor: a second tab added to an existing model

The portal model `hr-portal` exists; operations wants a view of how administrators reach the servers from the office network.

```text
You:    /netblueprint-forge add a tab admin-access to hr-portal: how operators reach the portal servers from the office.

Skill:  Archived v1.2.0 -> now v1.3.0 (note: add the admin-access tab). The new tab has its own zones, nodes, flows
        and steps; threat numbers continue at THR-0007. Who are the operators, and from which device? …
        Is the direct RDP path from the office blocked or allowed? Blocked paths are drawn with a ✕. …
        Built hr-portal.html: two diagram tabs and the Threat Register; the geometry check passed on both.
        Logged to archive/CHANGELOG.md: +1 tab, +3 zones, +4 nodes, +5 flows, +4 steps, +2 threats, +3 controls.
```

- **Interview path:** [revise and archive](../skills/netblueprint-forge/references/revise-and-archive.md): archive first, Section 0b for the tab, the usual sections for its contents, validate with `--fix`, build, log the diff. Every edit is by name.
- **The page:** a tab strip under the canvas, the new tab with its own phases (Sign In, Broker, Maintain), the jump host behind its own ACL, and one register across both tabs, as in the [Partner Portal example](../examples/partner-portal-tabs/README.md).
- **Next:** `hr-portal.html#tab=admin-access&step=2` is the link to send the operators' lead.

### Kiro: a what-if scenario beside a baseline

An analytics vendor asks for a public endpoint on the orders database. Nobody wants to edit the baseline to find out what that would cost.

```text
You:    /netblueprint-forge what if the orders database gets a public endpoint for the analytics vendor?

Skill:  Deriving the scenario tab whatif-public-db from main (archived v1.4.0 -> now v1.5.0). The change, in one
        sentence? … The vendor: an actor on the Internet side; how does it authenticate to the database? …
        Re-running the threats on the change: a new boundary crossing (Internet → Data), a weakened flow
        (SQL login over the Internet), two threats, one attack path to the orders data. Keep them? …
        Delta: +1 node, +1 flow, +2 threats, +1 attack path; CTL-0003 (private endpoint only) is invalidated.
```

- **Interview path:** [what-if](../skills/netblueprint-forge/references/what-if.md): the scenario tab names its baseline and the change, repeats only what the change touches, and re-runs threats and attack paths on it; the baseline stays untouched.
- **The page:** a What-If tag on the tab, a banner with the change statement and a link back to the baseline, the vendor's weak-auth flow with a `!` badge, new threat circles on the database, and the new path as a red phase.
- **Next:** promote the scenario into the baseline once the change is approved, or drop the tab; either way `scenario.mjs` has written the delta.

## Sources

- Agent Skills specification: https://agentskills.io/specification
- OpenAI Codex / ChatGPT skills: https://learn.chatgpt.com/docs/build-skills
- GitHub Copilot in VS Code: https://code.visualstudio.com/docs/agent-customization/agent-skills
- GitHub Copilot cloud agent: https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-skills
- Visual Studio: https://devblogs.microsoft.com/visualstudio/agent-skills-in-visual-studio
- Kiro: https://kiro.dev/docs/skills/
- Cursor: https://www.cursor.com/docs/context/skills
- Gemini CLI: https://geminicli.com/docs/cli/skills/
- Windsurf / Devin Desktop: https://docs.devin.ai/desktop/cascade/skills
- Claude Code plugin manifest: https://code.claude.com/docs/en/plugins-reference
