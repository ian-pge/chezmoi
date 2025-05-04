setup.sh is for devpod 

sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin" init --apply https://github.com/ian-pge/chezmoi.git
