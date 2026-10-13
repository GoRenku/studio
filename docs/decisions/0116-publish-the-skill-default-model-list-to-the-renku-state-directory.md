# 0116 Publish The Skill Default Model List To The Renku State Directory

Date: 2026-10-12

Status: accepted

Extends [ADR 0100](0100-use-personal-media-model-libraries.md) and records the
Renku state directory.

## Context

The Settings page runs in Studio, separate from any agent, yet a model select
needs the trusted model families per lane and provider. That list belongs to
studio-skills, which the harness installs into a plugin cache Studio cannot
locate. Separately, the CLI wrote caches and runtime files into the
user-authored config directory, which Codex permission profiles grant
read-only, so every Codex generation escalated and the approvals reviewer
refused the follow-up.

## Decision

- Mutable Renku state lives in the **Renku state directory**,
  `${XDG_STATE_HOME:-~/.local/state}/renku` (Windows:
  `%LOCALAPPDATA%\Renku\Studio\State`): `current-project.json`,
  `studio-runtime.json`, `studio-events.jsonl`, `cache/provider-metadata/`
  and `default-models.json`. `~/.config/renku` keeps only user-authored
  files: `config.yaml`, `.env`, `codex-plugin.json` and `model-library/`.
  Old state files are not read; users select the current Project once more.
- studio-skills owns `media-producer/references/default-models.json`: per
  lane, the model families a user may pick, the providers that carry each,
  and at most one recommendation per provider.
- The agent publishes it with `renku generation default-models sync --file
  <path>` beside its credentials check. Core validates the envelope (lane
  names, unique keys, provider ids, recommendations within providers, a
  256 KiB limit) and writes the copy atomically; unchanged content is a no-op.
- Studio reads the copy through `GET /studio-api/default-models` for the
  per-lane model select; the Route Chooser reads it on the server. Before the
  first sync the select offers only "Recommended".

## Consequences

- The list is written once, in Skills; Studio only lists names from it.
- Codex permission profiles grant `~/.local/state/renku` write access, so the
  CLI never writes outside the profile during generation.
