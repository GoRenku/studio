# 0085 Use Platform Config Paths And First-Run Setup

Date: 2026-08-22

Status: accepted

## Context

Renku previously required every user to create
`~/.config/renku/config.yaml` with `renku init <storage-root>` before Studio
could load. That Unix path is correct for the existing macOS CLI workflow but
is not an appropriate native Windows location. Configuration and provider
credential paths were also chosen independently by Core and Engines.

The built-in Visual Language Catalog is installed application content. Copying
it into a writable user configuration directory blurred that boundary with
Project-authored Visual Language data, which already belongs under each Project.

## Decision

Core is the single owner of Renku configuration paths. It resolves:

```text
macOS:   $HOME/.config/renku
Windows: %LOCALAPPDATA%\Renku\Studio
Linux:  ${XDG_CONFIG_HOME:-$HOME/.config}/renku
```

Linux uses `XDG_CONFIG_HOME` only when it is absolute. Native Windows requires
an absolute `LOCALAPPDATA` and does not fall back to a Unix home layout. The
existing macOS location remains unchanged.

When `config.yaml` is absent, Studio presents first-run setup before mounting
Project Library resources. The user confirms one read-only recommended Project
Library:

```text
macOS:   $HOME/Movies/Renku
Windows: %USERPROFILE%\Videos\Renku
Linux:   $HOME/Videos/Renku
```

The setup mutation accepts no path. Core creates that directory and persists
the existing `version: 0.1.0` and `storageRoot` YAML contract. Users who need a
custom location run `renku init <storage-root>` before completing onboarding.
There is no folder picker or post-setup relocation control.

After initialization, Studio offers the existing fal.ai, ElevenLabs, and World
Labs credential editor as an optional session-only step. Saving uses the
Core-owned global credential store; skipping writes nothing. Configuration
existence is the only setup marker, so no onboarding-completion state is stored.

Valid existing configuration skips onboarding. Invalid existing configuration
remains a blocking structured error and is never overwritten. No config,
Project, or Visual Language files are moved or deleted.

Core also owns the filesystem-backed provider secret resolver and injects it
into live Engines operations. Engines retains provider descriptors and
adapters, but no longer discovers Renku user files.

The built-in Visual Language Catalog is read directly from packaged Core
content and is never copied into user configuration. Project-authored Visual
Language records, guidance, Inspiration, analyses, Lookbooks, and media remain
Project-local.

## Consequences

- `config.yaml`, `.env`, current-project state, and Studio runtime/coordination
  files share one platform-correct Core-owned directory.
- Installers install the product and direct users to `renku studio start`; they
  do not choose a Project Library or write configuration.
- The first-run UI can initialize only the product recommendation. Advanced
  custom setup remains an explicit CLI operation.
- A missing packaged Visual Language Catalog is an installation error, not a
  reason to create an empty writable catalog.
- Renku adds no compatibility reads, migration, native app shell, Linux
  installer, or Project database change.

