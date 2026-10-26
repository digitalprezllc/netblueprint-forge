#!/usr/bin/env sh
# Install the netblueprint-forge skill for every supported AI tool.
# Symlinks skills/netblueprint-forge into .agents/skills, .claude/skills and
# .kiro/skills (project-level by default). See docs/PLATFORMS.md.
#
#   platforms/install.sh                 # into the current repo
#   platforms/install.sh /path/to/repo   # into another repo
#   platforms/install.sh --global        # into $HOME
#   platforms/install.sh --copy          # copy instead of symlink
#   platforms/install.sh --uninstall
set -eu

skill=netblueprint-forge
here=$(cd "$(dirname "$0")/.." && pwd)
source="$here/skills/$skill"
[ -f "$source/SKILL.md" ] || { echo "Skill source not found: $source" >&2; exit 1; }

base=$(pwd); mode=link; uninstall=0
for arg in "$@"; do
  case "$arg" in
    --global) base=$HOME ;;
    --copy) mode=copy ;;
    --uninstall) uninstall=1 ;;
    -*) echo "unknown option $arg" >&2; exit 2 ;;
    *) base=$(cd "$arg" && pwd) ;;
  esac
done

for root in .agents/skills .claude/skills .kiro/skills; do
  dir="$base/$root"; link="$dir/$skill"
  if [ "$uninstall" = 1 ]; then
    [ -e "$link" ] || [ -L "$link" ] && { rm -rf "$link"; echo "removed  $link"; }
    continue
  fi
  mkdir -p "$dir"
  if [ -L "$link" ] && [ "$mode" = link ]; then echo "exists   $link"; continue; fi
  rm -rf "$link"
  if [ "$mode" = copy ]; then cp -R "$source" "$link"; echo "copied   $link"
  else ln -s "$source" "$link"; echo "linked   $link -> $source"; fi
done

[ "$uninstall" = 1 ] || echo "
Done. Restart your AI tool if the skill does not appear."
