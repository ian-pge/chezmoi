sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin" chezmoi init --source "$PWD" --apply
