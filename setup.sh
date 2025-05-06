#!/usr/bin/env bash
set -euo pipefail

CHEZ="$HOME/.local/bin/chezmoi"
DOTFILES_DIR="$HOME/dotfiles"           # DevPod clones here
SRC="$HOME/.local/share/chezmoi"        # chezmoi’s own repo
REMOTE_URL="https://github.com/ian-pge/chezmoi.git"  # <— your repo URL

# 1 · Ensure the CLI is present (harmless if already installed)
[[ -x $CHEZ ]] || sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin"

# 2 · Bootstrap once, then update on every later start
if [[ ! -d $SRC ]]; then
  # First container start: seed chezmoi from the freshly‑cloned repo
  "$CHEZ" init --source="$DOTFILES_DIR" --apply          # applies immediately :contentReference[oaicite:2]{index=2}
else
  # Make sure there *is* a remote; add one if the first run used a local path
  if ! git -C "$SRC" remote get-url origin >/dev/null 2>&1; then
    git -C "$SRC" remote add origin "$REMOTE_URL"        # any valid Git URL works :contentReference[oaicite:3]{index=3}
  fi
  # Pull and apply new commits (falls back to plain apply if pull fails)
  "$CHEZ" update -v || "$CHEZ" apply -v                  # update = pull + apply :contentReference[oaicite:4]{index=4}
fi

