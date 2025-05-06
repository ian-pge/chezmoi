#!/usr/bin/env bash
set -euo pipefail

CHEZ="$HOME/.local/bin/chezmoi"
SRC="$HOME/.local/share/chezmoi"   # chezmoi’s managed repo

# 1. Make sure the CLI is present (harmless if it’s already installed)
if [[ ! -x $CHEZ ]]; then
  sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin"
fi

# 2. First‑run bootstrap vs. subsequent update
if [[ ! -d $SRC ]]; then
  # DevPod just cloned your dotfiles into $PWD; initialise from there
  "$CHEZ" init --source="$PWD" --apply      # one‑time bootstrap
else
  # The repo already exists => just pull & apply new commits
  "$CHEZ" update -v                         # git pull + apply in one step
fi
