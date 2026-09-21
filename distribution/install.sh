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

installed_runtime_is_ready() {
  [ "$(plutil -extract version raw -o - "$destination/RELEASE.json" 2>/dev/null)" = "$release_version" ] || return 1
  [ "$(plutil -extract target raw -o - "$destination/RELEASE.json" 2>/dev/null)" = "$target" ] || return 1
  [ -f "$destination/app/node_modules/skills/bin/cli.mjs" ] || return 1
  "$destination/runtime/node/bin/node" "$destination/app/dist/cli.js" about >/dev/null 2>&1 || return 1
  "$destination/runtime/node/bin/node" "$destination/app/node_modules/skills/bin/cli.mjs" --version >/dev/null 2>&1
}

install_agent_skills() {
  skills_entry="$destination/app/node_modules/skills/bin/cli.mjs"
  [ -f "$skills_entry" ] || fail 'INSTALL006 Bundled skills installer is missing. Reinstall Renku to restore it.'
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
  PATH="$(dirname "$node_command"):$PATH" "$node_command" "$skills_entry" add GoRenku/studio-skills --global --skill '*' --copy </dev/tty ||
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
manifest="$temporary/release.json"
curl -fsSL "$BASE_URL/studio/channels/beta/release.json" -o "$manifest" || fail 'INSTALL002 Could not download the Renku release manifest.'
release_version="$(plutil -extract version raw -o - "$manifest")" || fail 'INSTALL002 Release manifest has no version.'
printf '%s\n' "$release_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || fail 'INSTALL002 Release manifest has an invalid version.'
artifact_index=0
while :; do
  artifact_target="$(plutil -extract "artifacts.$artifact_index.target" raw -o - "$manifest" 2>/dev/null)" || fail "INSTALL002 Release manifest has no artifact for $target."
  [ "$artifact_target" = "$target" ] && break
  artifact_index=$((artifact_index + 1))
done
version_key="$(plutil -extract "artifacts.$artifact_index.versionKey" raw -o - "$manifest")" || fail 'INSTALL002 Release manifest has no archive path.'
[ "$version_key" = "studio/releases/$release_version/$target/renku.tar.gz" ] || fail 'INSTALL002 Release manifest has an invalid archive path.'
expected="$(plutil -extract "artifacts.$artifact_index.sha256" raw -o - "$manifest")" || fail 'INSTALL002 Release manifest has no checksum.'
printf '%s\n' "$expected" | grep -Eq '^[0-9a-f]{64}$' || fail 'INSTALL002 Release manifest has an invalid checksum.'
archive_url="$BASE_URL/$version_key"
version="$release_version"
destination="$INSTALL_ROOT/versions/$version"

if installed_runtime_is_ready; then
  printf 'Renku %s is already installed. Skipping download and continuing to skills setup.\n' "$version"
else
  if [ "$destination" = "${RENKU_INSTALLED_PRODUCT:-}" ]; then
    fail 'INSTALL004 The running Renku installation is incomplete. Stop Studio and rerun the installer in a new terminal to repair it.'
  fi
  curl -fsSL "$archive_url" -o "$temporary/renku.tar.gz" || fail "INSTALL002 Could not download $archive_url"
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
  [ "$(plutil -extract version raw -o - "$temporary/extracted/renku/RELEASE.json")" = "$version" ] || fail 'INSTALL004 Extracted release does not match the requested version.'

  smoke_node_command="$temporary/extracted/renku/runtime/node/bin/node"
  "$smoke_node_command" "$temporary/extracted/renku/app/dist/cli.js" about >/dev/null || fail 'INSTALL004 Renku CLI smoke validation failed.'

  mkdir -p "$INSTALL_ROOT/versions" "$BIN_ROOT"
  backup="$INSTALL_ROOT/versions/.previous-$version-$$"
  if [ -e "$destination" ]; then
    mv "$destination" "$backup"
  fi
  if ! mv "$temporary/extracted/renku" "$destination"; then
    [ ! -e "$backup" ] || mv "$backup" "$destination"
    fail 'INSTALL004 Could not activate the Renku version.'
  fi
  rm -rf "$backup"
fi
mkdir -p "$BIN_ROOT"
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
