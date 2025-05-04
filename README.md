# chezmoi

sudo mkdir -p /run/user/1000
sudo chown zed:zed /run/user/1000
sudo chmod 700 /run/user/1000

sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin"

export PATH="$HOME/.local/bin:$PATH"

chezmoi init https://github.com/ian-pge/chezmoi.git

chezmoi apply


sh -c "$(curl -fsLS get.chezmoi.io)" -- -b "$HOME/.local/bin" init --apply https://github.com/ian-pge/chezmoi.git
