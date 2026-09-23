#!/bin/sh
set -eu

BASE_URL="${RENKU_DOWNLOAD_BASE_URL:-https://downloads.gorenku.com}"
INSTALL_ROOT="${RENKU_INSTALL_ROOT:-$HOME/.local/share/renku}"
BIN_ROOT="${RENKU_BIN_ROOT:-$HOME/.local/bin}"
TERMS_VERSION='2026-09-23'
TERMS_ACCEPTANCE="$INSTALL_ROOT/TERMS_ACCEPTANCE.txt"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

accept_terms() {
  if [ -f "$TERMS_ACCEPTANCE" ]; then
    IFS= read -r accepted_version < "$TERMS_ACCEPTANCE" || accepted_version=''
    [ "$accepted_version" = "$TERMS_VERSION" ] && return
  fi
  if ! (exec </dev/tty) 2>/dev/null; then
    fail 'INSTALL010 Open the installer in an interactive Terminal to review and accept the Renku Terms of Use.'
  fi
  printf '\n%s\n' 'Renku Terms of Use (23 September 2026): https://gorenku.com/terms/2026-09-23/'
  printf '%s\n' 'These terms cover the official installer, Studio, CLI, and agent Skills.'
  printf 'Do you accept these Terms of Use? [y/N]: '
  IFS= read -r terms_response </dev/tty || fail 'INSTALL010 Terms acceptance was interrupted. Nothing was installed.'
  case "$terms_response" in
    y|Y|yes|YES|Yes) ;;
    *) fail 'INSTALL010 Terms were not accepted. Nothing was installed.' ;;
  esac
  mkdir -p "$INSTALL_ROOT" || fail 'INSTALL004 Cannot create the installation folder. Choose a folder you can write to.'
  printf '%s\n' "$TERMS_VERSION" > "$TERMS_ACCEPTANCE" || fail 'INSTALL010 Could not save Terms acceptance in the installation folder.'
}

shell_quote() {
  printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

download() {
  curl -fsSL --retry 2 --connect-timeout 20 --max-time 1800 "$1" -o "$2" ||
    fail "INSTALL002 Could not download $1. Check your connection and rerun the installer."
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
  printf '%s\n' 'If you cancel, Renku stays installed. Rerun this installer to choose agents again without downloading the same runtime.'
  PATH="$(dirname "$node_command"):$PATH" "$node_command" "$skills_entry" add GoRenku/studio-skills --global --skill '*' --copy </dev/tty ||
    fail 'INSTALL009 Skills setup did not complete. Renku is installed; rerun this installer to try again.'
}

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) target='darwin-arm64' ;;
  Darwin-x86_64)
    if [ "$(sysctl -in sysctl.proc_translated 2>/dev/null || true)" = '1' ]; then
      target='darwin-arm64'
    else
      target='darwin-x64'
    fi
    ;;
  *) fail "INSTALL001 Unsupported operating system or architecture. Beta supports macOS arm64 and x64." ;;
esac

macos_version="$(sw_vers -productVersion)"
printf '%s\n' "$macos_version" | awk -F. '{ exit !($1 > 13 || ($1 == 13 && $2 >= 5)) }' ||
  fail 'INSTALL001 Renku requires macOS 13.5 or newer.'

case "$INSTALL_ROOT:$BIN_ROOT" in
  /*:/*) ;;
  *) fail 'INSTALL004 Installation and launcher folders must be absolute paths.' ;;
esac
accept_terms
mkdir -p "$INSTALL_ROOT" "$BIN_ROOT" || fail 'INSTALL004 Cannot create the installation folders. Choose folders you can write to.'
temporary="$(mktemp -d "$INSTALL_ROOT/.install.XXXXXX")" || fail 'INSTALL004 Cannot write to the installation folder.'
trap 'rm -rf "$temporary"' EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM
if [ "${RENKU_UPDATE_SCOPE:-}" = 'skills' ]; then
  destination="${RENKU_INSTALLED_PRODUCT:?Installed Renku runtime is required}"
  node_command="$destination/runtime/node/bin/node"
  install_agent_skills
  printf '%s\n' 'Skills setup finished. If you confirmed installation, restart your agent and start a new conversation.'
  exit 0
fi
manifest="$temporary/release.json"
printf '%s\n' 'Checking the latest Renku release.'
download "$BASE_URL/studio/channels/beta/release.json" "$manifest"
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
  printf 'Downloading Renku %s for %s. This can take a few minutes.\n' "$version" "$target"
  download "$archive_url" "$temporary/renku.tar.gz"
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$temporary/renku.tar.gz" | cut -d' ' -f1)"
  elif command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$temporary/renku.tar.gz" | cut -d' ' -f1)"
  else
    fail 'INSTALL003 No SHA-256 verification tool is available.'
  fi
  [ "$expected" = "$actual" ] || fail 'INSTALL003 Renku archive SHA-256 mismatch.'

  mkdir -p "$temporary/extracted"
  printf '%s\n' 'Download verified. Extracting Renku.'
  tar -xzf "$temporary/renku.tar.gz" -C "$temporary/extracted" || fail 'INSTALL004 Could not extract the Renku archive.'
  [ -f "$temporary/extracted/renku/RELEASE.json" ] || fail 'INSTALL004 Extracted archive is not a Renku product.'
  [ "$(plutil -extract version raw -o - "$temporary/extracted/renku/RELEASE.json")" = "$version" ] || fail 'INSTALL004 Extracted release does not match the requested version.'
  [ "$(plutil -extract target raw -o - "$temporary/extracted/renku/RELEASE.json")" = "$target" ] || fail 'INSTALL004 Extracted release does not match this platform.'

  smoke_node_command="$temporary/extracted/renku/runtime/node/bin/node"
  "$smoke_node_command" "$temporary/extracted/renku/app/dist/cli.js" about >/dev/null || fail 'INSTALL004 Renku CLI smoke validation failed.'
  "$smoke_node_command" "$temporary/extracted/renku/app/node_modules/skills/bin/cli.mjs" --version >/dev/null || fail 'INSTALL006 Bundled skills installer failed verification.'

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
    printf 'exec %s %s "$@"\n' "$(shell_quote "$node_command")" "$(shell_quote "$entry")"
  } > "$launcher"
  chmod 755 "$launcher"
}
write_launcher "$BIN_ROOT/renku" "$destination/app/dist/cli.js"

case "${SHELL:-}" in
  */zsh) profile="${ZDOTDIR:-$HOME}/.zprofile" ;;
  */bash) profile="$HOME/.bash_profile" ;;
  *) profile="$HOME/.profile" ;;
esac
mkdir -p "$(dirname "$profile")"
"$node_command" --input-type=commonjs -e '
const fs = require("node:fs");
const [profile, entry] = process.argv.slice(1);
const start = "# >>> Renku PATH >>>";
const end = "# <<< Renku PATH <<<";
const text = fs.existsSync(profile) ? fs.readFileSync(profile, "utf8") : "";
const block = start + "\nexport PATH=" + entry + ":\"$PATH\"\n" + end;
const first = text.indexOf(start);
const last = text.indexOf(end, first);
if (first >= 0 && last < 0) process.exit(1);
const updated = first < 0 ? text + "\n" + block + "\n" : text.slice(0, first) + block + text.slice(last + end.length);
if (updated !== text) fs.writeFileSync(profile, updated);
' "$profile" "$(shell_quote "$BIN_ROOT")" || fail "INSTALL005 Could not save PATH in $profile. Renku is installed; use the full-path launcher in $BIN_ROOT."
printf '%s\n' "INSTALL005 PATH was saved in $profile. The launch command below works in this terminal now."

printf '\nRenku %s installed.\n' "$version"
printf 'Start Studio: %s studio start\n' "$(shell_quote "$BIN_ROOT/renku")"
install_agent_skills
printf '%s\n' 'Studio will guide you through choosing its recommended Project Library on first launch.'
printf '%s\n' 'For a custom location, run renku init <storage-root> before completing setup.'
printf '%s\n' 'If you confirmed skills installation, restart your agent and start a new conversation to load the Renku skills.'
