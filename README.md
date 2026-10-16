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

## After install: required changes

**Git identity** (placeholders in `~/.gitconfig`):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

**Secrets** (not in repo, add manually):

| Secret / login | Where |
|---|---|
| Any env-var secrets / API keys (`export FOO_API_KEY=...`) | `~/.zshrc.local` (create; `chmod 600`; auto-sourced by `.zshrc`) |
| Figma API key (Figma MCP) | `~/Library/Application Support/Code/User/mcp.json` (create; not tracked) |
| Claude Code login | run `claude` |
| GitHub | `gh auth login` |
| Docker registry | `docker login` |

Example `~/.zshrc.local`:

```bash
echo 'export SOME_API_KEY="..."' >> ~/.zshrc.local
chmod 600 ~/.zshrc.local
```

Then open a new terminal. Run `p10k configure` to re-theme if wanted.

## What gets installed

**Base:** Xcode Command Line Tools, Homebrew, Xcode (opens App Store link), oh-my-zsh, powerlevel10k, zsh-autosuggestions, zsh-syntax-highlighting

**Brew formulae:** cocoapods, colima, docker, docker-compose, gh, git, jpeg, kubernetes-cli, lima, minikube, nvm, pipx, pkg-config, postgresql@18, python@3.13, qemu, redis, ruby, uv, wget

**Brew casks:** iTerm2, Visual Studio Code, Postman, MongoDB Compass, Redis Insight, Figma, Flycut, Google Chrome, Google Drive, Zoom

**Other CLIs:** Node 24 (via nvm), `@angular/cli`, `@nestjs/cli`, Claude Code, opencode, graphify (`uv tool`)

**VS Code:** extensions from `vscode/extensions.txt`, settings, keybindings

## Config files (symlinked / copied)

| Repo | Target |
|---|---|
| `zsh/.zshrc`, `.zprofile`, `.p10k.zsh` | `~/` |
| `git/.gitconfig` | `~/.gitconfig` |
| `vscode/settings.json`, `keybindings.json` | `~/Library/Application Support/Code/User/` |
| `claude/settings.json` (copied), `local-plugins/` | `~/.claude/` |

## Never commit
`~/.ssh`, tokens, `~/.zshrc.local`, VS Code `mcp.json`.
