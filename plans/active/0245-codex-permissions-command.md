# 0245 Codex Permissions Command

Date: 2026-10-25

Status: active, awaiting the remaining decision on the review page

## Summary

Give Codex the permissions Renku needs only inside the Project Library, set
up automatically when the Project Library is created, with a
`renku codex permissions` command for existing installs. It writes a
Renku-owned `.codex/config.toml` in the Project Library folder. Codex loads that
file only for that folder once the user trusts it, so every other Codex
project keeps the user's own defaults. Renku never edits the user's personal
Codex settings.

When Renku sets up the Project Library (Studio's first-launch setup or
`renku init`), and the Codex plugin was installed, Core writes the file. `renku
update` refreshes a Renku-owned file so its content stays current. Existing
installs run `renku codex permissions set` once. The website guide starts with
the command; the manual steps stay below it.

## Decisions

Confirmed by the user on 2026-10-25:
- the command name `renku codex permissions status|set|remove`;
- the file is written automatically at Project Library setup, because it
  only touches Renku's own folder; the command stays for existing installs;
- Renku must not change the user's default profile: the permissions apply
  only when Codex works in Renku folders.

The per-folder design removes three earlier choices: Renku no longer edits
`default_permissions` or `sandbox_mode` in the user's file, and needs no TOML
library.

Project Library only (confirmed 2026-10-25). The website page is reference
documentation (`/codex-permissions/`), not a tutorial, because Renku sets the
file up itself.

## Evidence

Tested with Codex CLI 0.164.0, `codex sandbox`, a throwaway `CODEX_HOME`, and
a write target outside temp folders:

| Codex opened in | Settings file present | Folder trusted | Renku state folder |
|---|---|---|---|
| Project Library | yes | yes | writable |
| a project subfolder | yes | no | refused |
| a project subfolder | yes | yes | writable |
| any other folder | no | yes | refused (user default) |

The library and the trusted subfolder stayed writable even when the personal
settings contained `sandbox_mode`. Without a `.git` folder, a subfolder does
not inherit the library's file: Codex's project root is the folder it opened.

## Command

- `renku codex permissions status` (read-only):
  - whether the Renku file exists in the Project Library and is current;
  - the result of a sandbox write check run from the library, when the
    `codex` CLI is found. A refusal usually means the folder is not trusted
    yet; the message says to open it in Codex and trust it.
- `renku codex permissions set`:
  - shows the file it will write and asks for confirmation; non-interactive
    runs need `--yes`;
  - writes the file atomically;
  - runs the sandbox check.
  - An existing `.codex/config.toml` without Renku's header is never
    overwritten; the command stops and explains.
  - A file with Renku's header is replaced (refreshing paths after a move).
- `renku codex permissions remove`: deletes the file only if it carries
  Renku's header, after confirmation.

## The File

The file is fully Renku-owned and generated from Renku's resolvers. Paths are
written as TOML literal strings.

```toml
# Managed by `renku codex permissions`. Applies only when Codex works in this folder.
default_permissions = "renku-studio"

[permissions.renku-studio]
description = "Renku: films, settings, state and Studio."
extends = ":workspace"

[permissions.renku-studio.filesystem]
'<Renku config folder>' = "read"
'<Renku state folder>' = "write"

[permissions.renku-studio.network]
enabled = true
allow_local_binding = true
```

`workspace_roots` is not needed: the folder Codex opened is already the
workspace.

## Architecture Shape Gate

- `core/src/server/installation/codex-permissions/`:
  - `renku-codex-file.ts`: build the file text from the config and state
    folders, and recognise Renku's header.
  - `codex-permissions.ts`: read, write, refresh, set up and remove, with
    structured `CODEX_PERMISSIONS` errors.
  - Exported from `server/index.ts` directly; no folder index.
- `core/src/server/config/document.ts` `initRenkuConfig` calls
  `setUpCodexPermissions` when it creates a new Project Library and reports
  it as `codexPermissions`.
- `distribution/install-codex-plugin.mjs` refreshes the file after a
  successful plugin install or update, and hints at the command when the file
  is missing.
- `cli/src/commands/codex-permissions-command.ts`:
  - parses `status|set|remove`, `--yes` and `--json`;
  - shows the file and asks for confirmation;
  - calls Core.
- `cli/src/commands/codex-sandbox-check.ts`: runs `codex sandbox` from the
  Project Library, using `codex` on PATH.
- `core/src/server/config/setup.ts` (`initializeRenkuSetup`, the shared
  Project Library setup used by Studio and `renku init`) writes the file when
  `readCodexPluginInstallation()` is true and no foreign file exists. Setup
  never fails because of this file: a foreign file is reported as a warning
  naming the command.
- `renku update` rewrites the file only when it carries Renku's header.
- Forbidden:
  - edits to `~/.codex/config.toml` or Codex profile files;
  - agents running `set` or `remove`.

## Documentation

- Website guide:
  - first section "Set it up with one command": `renku codex permissions set`,
    trust the Project Library when Codex asks, open Codex at the library;
  - manual steps follow as "Set it up by hand", now using the same per-folder
    file instead of personal settings.
- CLI commands doc, the studio-skills permissions doc and the installer hint.

## Completion Checklist

- [x] Remaining decision confirmed.
- [x] Core module and tests:
  - fresh write;
  - refresh of a Renku-owned file;
  - refusal for a foreign file;
  - remove;
  - Windows literal paths.
- [x] CLI command with confirmation, `--yes` and sandbox check, plus tests.
- [x] Project Library setup writes the file when Codex is installed; tests
      for Codex installed, not installed, and a foreign file.
- [x] `renku update` refreshes a Renku-owned file only.
- [ ] The installer's closing text mentions Codex trust for the Project
      Library.
- [x] Website guide rewritten to lead with the command; docs updated.
- [ ] Run `set` on Urban Basilica's Project Library and check a new Codex
      thread generates without approval prompts.
- [ ] Build, tests and lint; diff inspected.
