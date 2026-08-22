# 0084 Use Global Renku Provider Credential Storage

Date: 2026-08-22

Status: accepted

> **Path ownership update:** [Decision 0085](./0085-use-platform-config-paths-and-first-run-setup.md)
> makes Core the platform config and credential-file owner and adds optional
> reuse of this credential editor during first-run onboarding. The provider
> catalog and write-only browser contract remain unchanged.

## Context

Provider API keys apply to every Project on one device, but Renku previously
required users to export environment variables or edit
`~/.config/renku/.env` outside Studio. The production loader copied file values
into `process.env` once, so replacing a saved value could remain stale until
Studio restarted.

Project workflow Settings remain Project-local under
[Decision 0074](./0074-use-core-owned-project-workflow-settings.md). Provider
credentials need a separate application-global boundary because they are
secrets used by Engines rather than Project preferences or Project metadata.

## Decision

Renku Studio exposes one top-level Settings dialog for the current managed
provider credential set: fal.ai (`FAL_KEY`), ElevenLabs
(`ELEVENLABS_API_KEY`), and World Labs (`WLT_API_KEY`). Engines owns that exact
ordered descriptor catalog. Repository integrations outside the catalog do not
appear in Settings and cannot be updated through its resource.

UI-managed credentials remain in `~/.config/renku/.env`. That file is the sole
production source for provider keys managed by Renku; exported process
environment values do not override it. Engines reads the current saved value
for each new provider operation without copying values into `process.env` or
caching secrets across operations.

Core owns the sanitized read and explicit replacement command. Browser
responses contain only provider identity, display label, and whether a
Renku-saved value exists. Existing secret values, fragments, hashes,
environment-variable names, and file paths never cross the HTTP boundary.

The Settings editor stages changes in memory and writes only through Save.
Blank untouched inputs preserve their current state. One Save validates every
replacement before writing, preserves unmanaged `.env` content, atomically
replaces the file, and applies owner-only `0600` permissions. Cancel and other
non-saving dismissal paths discard the draft. The dialog does not expose
credential deletion.

The controlled credential fields and draft controller are separate from the
Settings trigger and dialog footer so a later onboarding flow can reuse the
same status, validation, and persistence behavior without adding onboarding
state now.

## Consequences

- Provider credentials are application-global and are not stored in a Project
  database, `config.yaml`, browser storage, logs, or coordination events.
- The local Studio route is token-protected and uses `Cache-Control: no-store`
  for both reads and updates.
- Saving a replacement affects the next provider operation without restarting
  Studio.
- Unknown `.env` assignments and unlisted provider integrations remain outside
  the Settings contract and are not deleted by managed updates.
- Remote credential validation, provider login/OAuth, account balances,
  keychain storage, sync, default-provider selection, and a credential CLI
  command remain separate product decisions.
- This decision does not change
  [Decision 0074](./0074-use-core-owned-project-workflow-settings.md)'s
  Project-local workflow Settings document or
  [Decision 0043](./0043-use-explicit-live-provider-run-approval.md)'s
  live-run approval boundary.
