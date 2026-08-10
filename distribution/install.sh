#!/bin/sh
set -eu

BASE_URL="${RENKU_DOWNLOAD_BASE_URL:-https://downloads.gorenku.com}"
INSTALL_ROOT="${RENKU_INSTALL_ROOT:-$HOME/.local/share/renku}"
BIN_ROOT="${RENKU_BIN_ROOT:-$HOME/.local/bin}"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) target='darwin-arm64' ;;
  Darwin-x86_64) target='darwin-x64' ;;
  *) fail "INSTALL001 Unsupported operating system or architecture. Beta supports macOS arm64 and x64." ;;
esac

node_command=''
flavor='bundled-node24'
if command -v node >/dev/null 2>&1; then
  node_version="$(node -p 'process.versions.node' 2>/dev/null || true)"
  node_major="$(printf '%s' "$node_version" | cut -d. -f1)"
  node_minor="$(printf '%s' "$node_version" | cut -d. -f2)"
  if [ "$node_major" = '24' ]; then
    flavor='node24'
    node_command="$(command -v node)"
  elif [ "$node_major" = '22' ] && [ "${node_minor:-0}" -ge 12 ] 2>/dev/null; then
    flavor='node22'
    node_command="$(command -v node)"
  fi
fi

if [ "$flavor" = 'bundled-node24' ]; then
  printf '%s\n' 'INSTALL006 No supported system Node was found; Renku will use its private Node 24 runtime.'
fi

temporary="$(mktemp -d "${TMPDIR:-/tmp}/renku-install.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
archive_url="$BASE_URL/studio/channels/beta/$target/$flavor/renku.tar.gz"

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

smoke_node_command="$node_command"
if [ "$flavor" = 'bundled-node24' ]; then
  smoke_node_command="$temporary/extracted/renku/runtime/node/bin/node"
fi
"$smoke_node_command" "$temporary/extracted/renku/app/dist/cli.js" about >/dev/null || fail 'INSTALL004 Renku CLI smoke validation failed.'

mkdir -p "$INSTALL_ROOT/versions" "$BIN_ROOT"
destination="$INSTALL_ROOT/versions/$version"
backup="$INSTALL_ROOT/versions/.previous-$version-$$"
if [ -e "$destination" ]; then
  mv "$destination" "$backup"
fi
if ! mv "$temporary/extracted/renku" "$destination"; then
  [ ! -e "$backup" ] || mv "$backup" "$destination"
  fail 'INSTALL004 Could not activate the Renku version.'
fi
rm -rf "$backup"
ln -sfn "$destination" "$INSTALL_ROOT/current"

if [ "$flavor" = 'bundled-node24' ]; then
  node_command="$destination/runtime/node/bin/node"
fi

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
printf 'Start Studio: %s/renku studio start\n' "$BIN_ROOT"
printf '%s\n' 'INSTALL007 Enable the bundled Renku plugin in Codex or Claude Code.'
printf 'Bundled plugin marketplace: %s/plugin\n' "$destination"
