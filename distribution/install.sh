#!/bin/sh
set -eu

BASE_URL="${RENKU_DOWNLOAD_BASE_URL:-https://downloads.gorenku.com}"
INSTALL_ROOT="${RENKU_INSTALL_ROOT:-$HOME/.local/share/renku}"
BIN_ROOT="${RENKU_BIN_ROOT:-$HOME/.local/bin}"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

git_is_ready() {
  # Avoid invoking Apple's Git stub before its developer tools are installed.
  if [ "$(command -v git || true)" = '/usr/bin/git' ]; then
    xcode-select -p >/dev/null 2>&1 || return 1
  fi
  git --version >/dev/null 2>&1
}

install_agent_skills() {
  npx_entry="$destination/runtime/node/lib/node_modules/npm/bin/npx-cli.js"
  [ -f "$npx_entry" ] || fail 'INSTALL006 Bundled npm is missing. Renku is installed, but skills setup cannot continue.'
  # curl | sh supplies the script on stdin; interactive prompts need the terminal.
  if ! (exec </dev/tty) 2>/dev/null; then
    fail 'INSTALL007 Run the installer in Terminal to choose your agents. Renku is installed; rerun this installer there to finish skills setup.'
  fi
  if ! git_is_ready; then
    printf '%s\n' 'Git is needed to download the skills. Opening Apple Command Line Tools installation.'
    xcode-select --install || fail 'INSTALL008 Could not start Apple Command Line Tools installation. Complete it, then rerun this installer.'
    printf '%s\n' 'Finish the Apple installation dialog, then press Return here to continue.'
    IFS= read -r completed </dev/tty || fail 'INSTALL008 Git setup was interrupted. Rerun this installer to continue.'
    git_is_ready || fail 'INSTALL008 Git is not ready. Complete Apple Command Line Tools installation, then rerun this installer.'
  fi
  printf '\n%s\n' 'Choose the agents that should receive the Renku skills.'
  PATH="$(dirname "$node_command"):$PATH" "$node_command" "$npx_entry" --yes skills add GoRenku/studio-skills --global --skill '*' --copy </dev/tty ||
    fail 'INSTALL009 Skills setup did not complete. Renku is installed; rerun this installer to try again.'
}

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) target='darwin-arm64' ;;
  Darwin-x86_64) target='darwin-x64' ;;
  *) fail "INSTALL001 Unsupported operating system or architecture. Beta supports macOS arm64 and x64." ;;
esac

temporary="$(mktemp -d "${TMPDIR:-/tmp}/renku-install.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
if [ "${RENKU_UPDATE_SCOPE:-}" = 'skills' ]; then
  destination="${RENKU_INSTALLED_PRODUCT:?Installed Renku runtime is required}"
  node_command="$destination/runtime/node/bin/node"
  install_agent_skills
  printf '%s\n' 'Renku skills updated. Restart your agent and start a new conversation.'
  exit 0
fi
archive_url="$BASE_URL/studio/channels/beta/$target/renku.tar.gz"

curl -fsSL "$archive_url" -o "$temporary/renku.tar.gz" || fail "INSTALL002 Could not download $archive_url"
curl -fsSL "$archive_url.sha256" -o "$temporary/renku.tar.gz.sha256" || fail 'INSTALL002 Could not download the Renku checksum.'
expected="$(cut -d' ' -f1 "$temporary/renku.tar.gz.sha256")"
if command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$temporary/renku.tar.gz" | cut -d' ' -f1)"
elif command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$temporary/renku.tar.gz" | cut -d' ' -f1)"
else
  fail 'INSTALL003 No SHA-256 verification tool is available.'
fi
[ "$expected" = "$actual" ] || fail 'INSTALL003 Renku archive SHA-256 mismatch.'

mkdir -p "$temporary/extracted"
tar -xzf "$temporary/renku.tar.gz" -C "$temporary/extracted" || fail 'INSTALL004 Could not extract the Renku archive.'
[ -f "$temporary/extracted/renku/RELEASE.json" ] || fail 'INSTALL004 Extracted archive is not a Renku product.'
version="$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$temporary/extracted/renku/RELEASE.json" | head -n 1)"
[ -n "$version" ] || fail 'INSTALL004 RELEASE.json has no version.'

smoke_node_command="$temporary/extracted/renku/runtime/node/bin/node"
"$smoke_node_command" "$temporary/extracted/renku/app/dist/cli.js" about >/dev/null || fail 'INSTALL004 Renku CLI smoke validation failed.'

mkdir -p "$INSTALL_ROOT/versions" "$BIN_ROOT"
destination="$INSTALL_ROOT/versions/$version"
backup="$INSTALL_ROOT/versions/.previous-$version-$$"
if [ "${RENKU_UPDATE_SCOPE:-}" = 'all' ] && [ "$destination" = "${RENKU_INSTALLED_PRODUCT:-}" ]; then
  printf 'Renku %s is already installed. Updating skills.\n' "$version"
else
  if [ -e "$destination" ]; then
    mv "$destination" "$backup"
  fi
  if ! mv "$temporary/extracted/renku" "$destination"; then
    [ ! -e "$backup" ] || mv "$backup" "$destination"
    fail 'INSTALL004 Could not activate the Renku version.'
  fi
  rm -rf "$backup"
fi
ln -sfn "$destination" "$INSTALL_ROOT/current"

node_command="$destination/runtime/node/bin/node"
"$node_command" --input-type=commonjs -e 'require("node:fs").writeFileSync(process.argv[1], JSON.stringify({installRoot:process.argv[2],binRoot:process.argv[3]}))' "$destination/INSTALLATION.json" "$INSTALL_ROOT" "$BIN_ROOT"

write_launcher() {
  launcher="$1"
  entry="$2"
  {
    printf '%s\n' '#!/bin/sh'
    printf 'exec "%s" "%s" "$@"\n' "$node_command" "$entry"
  } > "$launcher"
  chmod 755 "$launcher"
}
write_launcher "$BIN_ROOT/renku" "$destination/app/dist/cli.js"

case ":$PATH:" in
  *":$BIN_ROOT:"*) ;;
  *)
    case "${SHELL:-}" in
      */zsh) profile="${ZDOTDIR:-$HOME}/.zprofile" ;;
      */bash) profile="$HOME/.bash_profile" ;;
      *) profile="$HOME/.profile" ;;
    esac
    marker='# >>> Renku PATH >>>'
    if [ ! -f "$profile" ] || ! grep -F "$marker" "$profile" >/dev/null 2>&1; then
      {
        printf '\n%s\n' "$marker"
        printf 'export PATH="%s:$PATH"\n' "$BIN_ROOT"
        printf '%s\n' '# <<< Renku PATH <<<'
      } >> "$profile"
    fi
    printf '%s\n' "INSTALL005 PATH was updated in $profile. Restart terminals and agent desktop apps."
    ;;
esac

printf '\nRenku %s installed.\n' "$version"
install_agent_skills
printf 'Start Studio: %s/renku studio start\n' "$BIN_ROOT"
printf '%s\n' 'Studio will guide you through choosing its recommended Project Library on first launch.'
printf '%s\n' 'For a custom location, run renku init <storage-root> before completing setup.'
printf '%s\n' 'Restart your agent and start a new conversation to load the Renku skills.'
