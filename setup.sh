#!/usr/bin/env bash
set -euo pipefail

if [[ ! -x $CHEZ ]]; then
   sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin"
   "$HOME/.local/bin/chezmoi" init https://github.com/ian-pge/chezmoi.git
 fi

