<#
.SYNOPSIS
  Install the netblueprint-forge skill for every supported AI tool.

.DESCRIPTION
  Creates directory junctions (no admin rights needed) from each tool's skill
  folder to skills/netblueprint-forge in this repository, so one source serves
  Claude Code, Codex/ChatGPT, GitHub Copilot, Kiro, Cursor, Gemini CLI and
  Windsurf/Devin. See docs/PLATFORMS.md for why these three paths are enough.

.PARAMETER Target
  Repository to install into. Defaults to the current directory.

.PARAMETER Global
  Install user-level instead (~/.agents/skills, ~/.claude/skills, ~/.kiro/skills).

.PARAMETER Copy
  Copy the skill folder instead of linking it (for filesystems or tools that
  cannot follow junctions). Re-run after changing the skill.

.PARAMETER Uninstall
  Remove the links/copies created by this script.

.EXAMPLE
  .\platforms\install.ps1
  .\platforms\install.ps1 -Target C:\src\my-app
  .\platforms\install.ps1 -Global -Copy
#>
[CmdletBinding()]
param(
  [string]$Target = (Get-Location).Path,
  [switch]$Global,
  [switch]$Copy,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$skillName = 'netblueprint-forge'
$source = Join-Path (Split-Path -Parent $PSScriptRoot) "skills\$skillName"
if (-not (Test-Path (Join-Path $source 'SKILL.md'))) { throw "Skill source not found: $source" }

$base = if ($Global) { $HOME } else { (Resolve-Path $Target).Path }
$roots = @('.agents\skills', '.claude\skills', '.kiro\skills')

foreach ($root in $roots) {
  $dir  = Join-Path $base $root
  $link = Join-Path $dir $skillName

  if ($Uninstall) {
    if (Test-Path $link) {
      $item = Get-Item $link -Force
      if ($item.LinkType) { $item.Delete() } else { Remove-Item $link -Recurse -Force -Confirm:$false }
      Write-Host "removed  $link"
    }
    continue
  }

  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  if (Test-Path $link) {
    $item = Get-Item $link -Force
    if ($item.LinkType -eq 'Junction' -and -not $Copy) { Write-Host "exists   $link"; continue }
    if ($item.LinkType) { $item.Delete() } else { Remove-Item $link -Recurse -Force -Confirm:$false }
  }

  if ($Copy) {
    Copy-Item $source $link -Recurse
    Write-Host "copied   $link"
  } else {
    New-Item -ItemType Junction -Path $link -Target $source | Out-Null
    Write-Host "linked   $link -> $source"
  }
}

if (-not $Uninstall) {
  Write-Host ''
  Write-Host "Done. Restart your AI tool if the skill does not appear. Invoke with /$skillName (Claude, Copilot, Kiro, Cursor), `$$skillName (Codex) or @$skillName (ChatGPT, Windsurf)."
}
