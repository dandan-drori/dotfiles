# dotfiles

Config files + one-shot setup for a new Mac.

## Usage

```bash
git clone https://github.com/dandan-drori/dotfiles.git ~/dev/personal/dotfiles
cd ~/dev/personal/dotfiles
chmod +x install.sh
./install.sh
```

Safe to re-run. Existing dotfiles are backed up as `<file>.bak.<timestamp>`. The script prints a summary of failed/manual steps at the end.

After install:
- Edit `~/.gitconfig` (placeholder name/email).
- Put machine-local secrets in `~/.zshrc.local` (sourced by `.zshrc`, not tracked).
- `claude` login, `gh auth login`, `gcloud init`.

## What gets installed

**Base:** Xcode Command Line Tools, Homebrew, Xcode (opens App Store link), oh-my-zsh, powerlevel10k, zsh-autosuggestions, zsh-syntax-highlighting

**Brew formulae:** ampli, cocoapods, colima, docker, docker-compose, gh, git, jpeg, kubernetes-cli, lima, minikube, nvm, pipx, pkg-config, postgresql@18, python@3.13, qemu, redis, ruby, stripe, uv, wget

**Brew casks:** iTerm2, Raycast, Visual Studio Code Insiders, WebStorm, Postman, MongoDB Compass, Redis Insight, Figma, Flycut, Google Chrome, Google Drive, Slack, Zoom

**Other CLIs:** Node 24 (via nvm), `@angular/cli`, `@nestjs/cli`, Claude Code, opencode, graphify (`uv tool`), Google Cloud SDK

**VS Code Insiders:** extensions from `vscode/extensions.txt`, settings, keybindings

## Config files (symlinked / copied)

| Repo | Target |
|---|---|
| `zsh/.zshrc`, `.zprofile`, `.p10k.zsh` | `~/` |
| `git/.gitconfig` | `~/.gitconfig` |
| `vscode/settings.json`, `keybindings.json` | `~/Library/Application Support/Code - Insiders/User/` |
| `claude-personal/settings.json` (copied) , `local-plugins/` | `~/.claude-personal/` |

## Never commit
`~/.ssh`, tokens, `~/.zshrc.local`, VS Code `mcp.json`.
