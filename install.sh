#!/usr/bin/env bash
# Single-shot Mac setup. Safe to re-run.
set -uo pipefail

DOTFILES="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_VERSION="24"
FAILED=()
MANUAL=()

log()  { printf '\n==> %s\n' "$*"; }
fail() { FAILED+=("$1"); echo "!! failed: $1"; }
# manual "Tool" "url" "instructions": opens browser tab, records for summary
manual() { MANUAL+=("$1|$2|$3"); open "$2" 2>/dev/null || true; }
have() { command -v "$1" >/dev/null 2>&1; }

link() { # link <src> <dest>; backs up existing non-symlink dest
  mkdir -p "$(dirname "$2")"
  if [ -e "$2" ] && [ ! -L "$2" ]; then mv "$2" "$2.bak.$(date +%s)"; fi
  ln -sfn "$1" "$2"
}

# ---------- Xcode CLT ----------
log "Xcode Command Line Tools"
if ! xcode-select -p >/dev/null 2>&1; then
  xcode-select --install
  echo "Finish the CLT installer dialog, then press Enter."; read -r _
fi

# ---------- Homebrew ----------
log "Homebrew"
if ! have brew && [ ! -x /opt/homebrew/bin/brew ]; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || fail "Homebrew"
fi
eval "$(/opt/homebrew/bin/brew shellenv)"

log "brew bundle"
brew bundle --file="$DOTFILES/Brewfile" || fail "brew bundle (some formulae/casks; rerun to see which)"

# ---------- Xcode (App Store) ----------
if [ ! -d /Applications/Xcode.app ]; then
  manual "Xcode" "macappstore://apps.apple.com/app/xcode/id497799835" "Install from App Store (large, needs Apple ID). Then: sudo xcodebuild -license accept"
fi

# ---------- Shell: oh-my-zsh, p10k, plugins ----------
log "oh-my-zsh"
if [ ! -d "$HOME/.oh-my-zsh" ]; then
  RUNZSH=no CHSH=no KEEP_ZSHRC=yes sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || fail "oh-my-zsh"
fi
ZSH_CUSTOM="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}"
clone() { [ -d "$2" ] || git clone --depth=1 "$1" "$2" || fail "$(basename "$2")"; }
clone https://github.com/romkatv/powerlevel10k.git "$ZSH_CUSTOM/themes/powerlevel10k"
clone https://github.com/zsh-users/zsh-autosuggestions "$ZSH_CUSTOM/plugins/zsh-autosuggestions"
clone https://github.com/zsh-users/zsh-syntax-highlighting "$ZSH_CUSTOM/plugins/zsh-syntax-highlighting"

# ---------- Dotfiles ----------
log "Dotfiles"
link "$DOTFILES/zsh/.zshrc"     "$HOME/.zshrc"
link "$DOTFILES/zsh/.zprofile"  "$HOME/.zprofile"
link "$DOTFILES/zsh/.p10k.zsh"  "$HOME/.p10k.zsh"
link "$DOTFILES/git/.gitconfig" "$HOME/.gitconfig"

VSC="$HOME/Library/Application Support/Code - Insiders/User"
link "$DOTFILES/vscode/settings.json"    "$VSC/settings.json"
link "$DOTFILES/vscode/keybindings.json" "$VSC/keybindings.json"
[ -d "$DOTFILES/vscode/snippets" ] && link "$DOTFILES/vscode/snippets" "$VSC/snippets"

# Claude personal profile (CLAUDE_CONFIG_DIR=~/.claude-personal, see claude-personal() in .zshrc)
CP="$HOME/.claude-personal"
mkdir -p "$CP"
sed "s#__HOME__#$HOME#g" "$DOTFILES/claude-personal/settings.json" > "$CP/settings.json"
link "$DOTFILES/claude-personal/local-plugins" "$CP/local-plugins"

# ---------- Node (nvm) ----------
log "Node $NODE_VERSION via nvm"
export NVM_DIR="$HOME/.nvm"; mkdir -p "$NVM_DIR"
# shellcheck disable=SC1091
. "$(brew --prefix nvm)/nvm.sh"
nvm install "$NODE_VERSION" && nvm alias default "$NODE_VERSION" || fail "node $NODE_VERSION"

log "Global npm packages"
# zshrc puts ~/.npm-global/bin first on PATH
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
npm i -g @angular/cli @nestjs/cli || fail "npm globals (@angular/cli @nestjs/cli)"

# ---------- Other CLIs ----------
log "Claude Code"
have claude || curl -fsSL https://claude.ai/install.sh | bash || fail "Claude Code CLI"

log "opencode"
have opencode || curl -fsSL https://opencode.ai/install | bash || fail "opencode"

log "graphify (uv tool)"
have graphify || uv tool install graphifyy || fail "graphify (uv tool install graphifyy)"

log "Google Cloud SDK"
if [ ! -d "$HOME/google-cloud-sdk" ]; then
  curl -fsSL https://sdk.cloud.google.com | bash -s -- --disable-prompts --install-dir="$HOME" || fail "Google Cloud SDK"
fi

# ---------- VS Code Insiders extensions ----------
log "VS Code Insiders extensions"
CODE="/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code-insiders"
if [ -x "$CODE" ]; then
  while read -r ext; do
    [ -n "$ext" ] && { "$CODE" --install-extension "$ext" --force >/dev/null || fail "vscode ext: $ext"; }
  done < "$DOTFILES/vscode/extensions.txt"
else
  fail "VS Code extensions (Insiders app not found)"
fi

# ---------- Summary ----------
echo; echo "=============== SUMMARY ==============="
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "FAILED (rerun script or install by hand):"
  printf '  - %s\n' "${FAILED[@]}"
fi
if [ ${#MANUAL[@]} -gt 0 ]; then
  echo "MANUAL STEPS:"
  for m in "${MANUAL[@]}"; do
    IFS='|' read -r name url how <<<"$m"
    echo "  - $name: $how"
    [ "$url" != "-" ] && echo "      link: $url"
  done
fi
echo "Next: chsh -s /bin/zsh (if needed), open a new terminal, edit ~/.gitconfig (name/email), run 'claude' and log in, 'gh auth login', 'gcloud init'."
