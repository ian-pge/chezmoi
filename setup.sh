#!/usr/bin/env bash
set -euo pipefail

CHEZ="$HOME/.local/bin/chezmoi"
SRC="$HOME/.local/share/chezmoi"
REPO="https://github.com/ian-pge/chezmoi.git"   # <— your dot‑files repo

# 1. Ensure chezmoi CLI exists
if [[ ! -x $CHEZ ]]; then
  sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin"
fi

# 2. First run: clone from remote; later runs: pull+apply
if [[ ! -d $SRC ]]; then
  # one‑time bootstrap straight from GitHub (remote is set automatically)
  "$CHEZ" init --apply "$REPO"                # --apply does the first apply
else
  # make sure there's an origin (handles the earlier local‑path case)
  if ! git -C "$SRC" remote get-url origin >/dev/null 2>&1; then
    git -C "$SRC" remote add origin "$REPO"
  fi
  # fetch & apply any new commits; falls back to plain apply if pull fails
  "$CHEZ" update -v || "$CHEZ" apply -v
fi
