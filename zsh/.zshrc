# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

export NVM_DIR="$HOME/.nvm"
    [ -s "$HOMEBREW_PREFIX/opt/nvm/nvm.sh" ] && \. "$HOMEBREW_PREFIX/opt/nvm/nvm.sh" # This loads nvm
    [ -s "$HOMEBREW_PREFIX/opt/nvm/etc/bash_completion.d/nvm" ] && \. "$HOMEBREW_PREFIX/opt/nvm/etc/bash_completion.d/nvm" # This loads nvm bash_completion

#// If .nvmrc file exists - install and use the node version specified.
if [ -s ".nvmrc" ]; then
  nvm use --silent || nvm i > /dev/null 2>&1
fi

# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Add global npm packages to start of path
export PATH="$HOME/.npm-global/bin:$PATH"

# Disable bell sound
unsetopt BEEP

ZSH_THEME="powerlevel10k/powerlevel10k"

zstyle ':omz:update' mode reminder  # just remind me to update when it's time

# Which plugins would you like to load?
plugins=(git zsh-autosuggestions zsh-syntax-highlighting)

source $ZSH/oh-my-zsh.sh

# The next line updates PATH for the Google Cloud SDK.
if [ -f "$HOME/google-cloud-sdk/path.zsh.inc" ]; then . "$HOME/google-cloud-sdk/path.zsh.inc"; fi

# The next line enables shell command completion for gcloud.
if [ -f "$HOME/google-cloud-sdk/completion.zsh.inc" ]; then . "$HOME/google-cloud-sdk/completion.zsh.inc"; fi

# aliases
alias ga='git add .'
alias gp='git push'
alias gs='git status'
alias gcpb="git show-branch | grep '*' | grep -v \"\$(git rev-parse --abbrev-ref HEAD)\" | head -n1 | sed 's/.*\[\(.*\)\].*/\1/' | sed 's/[\^~].*//' > git checkout"
alias gchm='git checkout $(git remote show origin | grep "HEAD branch" | sed "s/.*: //")'
unalias gc
gc() { git commit -m "$1"; }
alias mem="export NODE_OPTIONS=--max-old-space-size=16384"

export PATH="/opt/homebrew/opt/jpeg/bin:$PATH"

# Load Angular CLI autocompletion.
if command -v ng &> /dev/null; then
  source <(ng completion script)
fi

# prompt
PROMPT='%{$fg[yellow]%}[%*] '$PROMPT
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Machine-local secrets (not in git)
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local

# Claude Code Set-Up
export PATH="$HOME/.local/bin:$PATH"

# To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# opencode
export PATH=$HOME/.opencode/bin:$PATH

# Claude Code personal profile (bypasses work proxy env vars)
claude-personal() {
  env -u ANTHROPIC_BASE_URL -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_MODEL -u CLAUDE_FORCE_LOGIN_METHOD \
    CLAUDE_CONFIG_DIR="$HOME/.claude-personal" claude "$@"
}

# Wait 1.5 seconds, turn off the display, run claude-personal in the foreground, and cacffeinate to make sure the system stays awake for up to 1.5 hours.
# Can remotely use "pmset sleepnow" to put the Mac to sleep at any point.
alias bedtime="(sleep 1.5 && pmset displaysleepnow && caffeinate -t 5400) &! claude-personal rc"
alias goodnight="sudo pmset sleepnow"
alias addtime="caffeinate -t 3600 &!"
