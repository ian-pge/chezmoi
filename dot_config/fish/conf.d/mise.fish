# Initialize Mise
if test -x "$HOME/.local/bin/mise"
    if status is-interactive
        command $HOME/.local/bin/mise activate fish | source
    else
        command $HOME/.local/bin/mise activate fish --shims | source
    end
end
