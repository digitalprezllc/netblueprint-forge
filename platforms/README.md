# platforms/

Install helpers. The skill itself lives in `../skills/netblueprint-forge/` and is identical for every tool; these scripts only put it where each tool looks.

- `install.ps1`: Windows. Creates junctions (no admin needed). `-Global`, `-Copy`, `-Uninstall`, `-Target <repo>`.
- `install.sh`: macOS / Linux. Symlinks. `--global`, `--copy`, `--uninstall`, `<repo>`.
- `package.mjs`: builds the release archive `dist/netblueprint-forge-<version>.zip` (one top-level folder, `netblueprint-forge/`, the shape claude.ai and the Claude API accept as a skill upload and the shape to unzip into any tool's skills folder). The version is `metadata.version` in SKILL.md; `--version` prints it, `--notes` prints that version's CHANGELOG section. Node 18+, no dependencies: the ZIP is written by the script itself. `.github/workflows/release.yml` runs it on every merge to `master` and publishes a GitHub Release when the version is new.

Both install scripts link into `.agents/skills/`, `.claude/skills/` and `.kiro/skills/`. [../docs/PLATFORMS.md](../docs/PLATFORMS.md) explains which tool reads which path and lists the optional per-platform extras (Claude plugin manifest, Codex `agents/openai.yaml`).
