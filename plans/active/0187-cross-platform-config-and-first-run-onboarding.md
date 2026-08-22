# 0187 Cross-Platform Config And First-Run Onboarding

Status: implemented; native installed-runtime verification pending
Date: 2026-08-22

Implementation verification: all source, isolated browser, configured-browser,
architecture, build, test, lint, and release-contract checks pass on macOS. The
remaining unchecked items require a native Windows installed product or an
explicit normal-start/read-only smoke against the developer's real Project
Library; neither is simulated or replaced with WSL.

The config-related cases in the broad CLI workflow integration file pass. Four
unrelated assertions in that same file still disagree with current Lookbook
reference projection, Cast Voice file allocation, and Studio server-policy
output; this implementation does not alter those product areas to make the
broad file green.

## Review Attention

| Attention item | Accepted behavior | Impact |
| --- | --- | --- |
| macOS config location | Keep `~/.config/renku/` exactly as it is today. Renku is a CLI-distributed local web application, not a native Mac app, so it continues to follow the existing Unix-style convention on macOS. | The current development config, credentials, runtime descriptor, coordination state, and `/Users/keremk/renku-movies` Project Library remain in place and are not moved or rewritten. |
| Windows config location | Use `%LOCALAPPDATA%\Renku\Studio\` for Renku configuration and local runtime files on native Windows. Do not assume WSL, a Unix home layout, or `~/.config`. | New native Windows installs write `config.yaml`, `.env`, `current-project.json`, `studio-runtime.json`, and `studio-events.jsonl` beneath the Windows-local application-data directory. |
| Linux config location | Use `${XDG_CONFIG_HOME:-$HOME/.config}/renku/`. Relative `XDG_CONFIG_HOME` values are invalid and ignored as required by the XDG Base Directory specification. | Linux path resolution follows the CLI/Unix convention without adding Linux packaging to the current beta. |
| First-run Project Library | When no `config.yaml` exists, Studio shows onboarding and offers one read-only recommended Project Library location: `$HOME/Movies/Renku` on macOS, `%USERPROFILE%\Videos\Renku` on Windows, and `$HOME/Videos/Renku` on Linux/other Unix. Clicking **Use this Project Library** creates the directory and config. | The product-chosen directory name contains no spaces. The first-run UI has no folder picker, path input, browse button, drag-and-drop target, or browser filesystem API. A custom location remains an advanced pre-setup operation through `renku init <storage-root>`. |
| Optional provider setup | After required Project Library initialization succeeds in the current browser session, offer the existing fal.ai, ElevenLabs, and World Labs credential editor as an optional step. The user can save entered keys or skip. | Reuses the implemented credential controls and exact managed provider catalog; it adds no providers, key testing, OAuth, deletion, or durable onboarding-state record. |
| Existing configs | A valid existing config skips onboarding entirely. An invalid existing config produces a blocking structured error and is never overwritten or treated as a fresh install. | Existing users and the current macOS development setup keep their exact configured Project Library. No migration, fallback read, dual path, or compatibility layer is added. |
| Single path owner | Refactor global configuration and credential file access so Core owns platform path resolution and passes a secret resolver into Engines. Engines continues to own the supported provider descriptor catalog and provider adapters. | This is required to prevent Core and Engines from independently choosing different Windows or XDG paths. It directly updates production callers and removes the duplicate Engines filesystem resolver. |
| Visual Language storage | Stop copying or creating the immutable built-in Visual Language Catalog under the user config directory. Read built-in entries from the packaged Core catalog only. Project-authored Visual Languages, Inspiration folders, analyses, Lookbooks, guidance, prompt templates, and related media remain Project-local. | No global `visual-language/` directory is created. No Project data, bundled catalog assets, or local user files are moved or deleted. |
| New public surface | Add a Core setup resource and initialization command plus token-protected `GET` and `POST /studio-api/setup`. | Studio learns whether setup is required before mounting Project Library code and initializes only the Core-owned recommended location. |
| Deliberately unchanged | Keep the `RenkuConfig` YAML shape, `renku init <storage-root>` argument contract, current Project creation behavior, Project Settings, provider list, installed binary layout, foreground local server, and browser UI architecture. | There is no Project database migration, installer behavior redesign, Linux release, native app shell, Project Library relocation command, or general Settings UI for changing the library. |

No further product choice is hidden in this plan. The recommended first-run
Project Library paths above are the initial defaults accepted for this slice.
Users who need a different location configure it from the command line before
completing Studio onboarding. Changing or moving an already configured library
is a separate future workflow.

## Summary

Renku installation currently leaves a new user without `config.yaml`. The
foreground Studio server can start, but the browser immediately attempts to
read the Project Library, Core reports `CONFIG002`, and the user is told to run
`renku init <storage-root>` outside the application. At the same time, Core and
Engines independently hard-code `~/.config/renku`, which does not satisfy the
native Windows distribution contract.

Implement the smallest complete first-run workflow:

1. resolve the one Renku config directory from the current operating system;
2. let Studio inspect configuration before loading any Project resource;
3. when configuration is missing, display the recommended Project Library and
   initialize it through one Core command after explicit confirmation;
4. offer the existing managed provider keys as an optional second step; and
5. enter the normal Project Library without persisting a second onboarding
   flag.

The config directory remains application-global and contains only global
configuration, credentials, and local coordination/runtime state. All durable
Project data remains beneath the configured Project Library and individual
Project folders. The packaged Visual Language Catalog is application content,
not mutable global user state, and is no longer copied into the config
directory.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Preserve `~/.config/renku/` on macOS and make no change to the current development config or Project Library. | Explicit user decision. | Core config paths and no-migration boundary. | Core path tests plus read-only verification of the existing macOS config and Urban Basilica path. |
| R2 | Use `%LOCALAPPDATA%\Renku\Studio\` on native Windows without WSL assumptions. | Explicit user request and accepted Windows beta distribution. | Core config paths. | Win32 path tests and native Windows installed-runtime smoke. |
| R3 | Use `${XDG_CONFIG_HOME:-$HOME/.config}/renku/` on Linux/other Unix while keeping Linux distribution out of scope. | Explicit user decision to follow CLI/Unix practice and platform recommendations. | Core config paths. | XDG set, unset, empty, and relative-value tests. |
| R4 | Make Core the only production owner of Renku config-directory and provider-credential file resolution. | Hard architecture/no-duplication boundary. | Core config and provider-credential modules; Engines dependency injection. | Import/runtime boundary tests and complete production-caller inspection. |
| R5 | Show onboarding before Project Library loading when `config.yaml` is missing. | Explicit post-install onboarding request. | Core setup resource, Studio setup route, app setup gate. | Core, route, component, and desktop E2E tests. |
| R6 | Initialize one visible recommended Project Library named `Renku` after explicit confirmation, without spaces, a folder picker, or an editable UI path. | Explicit user decision. | Core recommended path and initialization; Studio onboarding. | Exact platform-default tests and onboarding interaction assertions proving no path control exists. |
| R7 | Keep custom Project Library selection as an advanced pre-setup CLI operation through the existing `renku init <storage-root>` command. | Explicit user decision and ADR 0004 CLI contract. | Existing CLI init command and onboarding guidance. | CLI regression tests and setup E2E using a CLI-created custom config. |
| R8 | Offer the existing fal.ai, ElevenLabs, and World Labs fields as optional onboarding after library initialization; allow skip. | Initial onboarding proposal accepted without correction; ADR 0084 reuse boundary. | Studio onboarding composed with existing credential fields/controller. | Component tests for save, skip, retry, and draft preservation. |
| R9 | Skip onboarding for every valid existing config and never overwrite an invalid existing config. | Explicit development-preservation request and fail-fast boundary. | Core setup inspection and initialization. | Owning-layer existing/missing/invalid tests plus current-development smoke. |
| R10 | Do not create or copy a global writable Visual Language Catalog; keep Project Visual Language data Project-local. | Explicit user correction and project-storage architecture. | Core bundled catalog resolver and current Project data owners. | Catalog tests, config-directory negative assertion, and Project storage documentation. |
| R11 | Add no migration, file move, local cleanup, compatibility path, or Project database change. | Explicit user decision and pre-customer no-shim rule. | Entire implementation. | Diff inspection, isolated-home tests, and unchanged Urban Basilica verification. |
| R12 | Report unavailable config roots, failed Project Library creation, invalid existing config, and credential failures through structured owning-layer errors without secret values. | Hard diagnostics, data-integrity, and security boundary. | Core configuration/provider services and thin HTTP mapping. | Owning-layer invalid-state tests and secret-safe route assertions. |
| R13 | Persist no `onboardingCompleted` flag or second global settings document. Configuration existence remains the setup gate. | Smallest useful implementation and no-parallel-state boundary. | Core setup resource and Studio setup gate. | Contract inspection and repeat-launch E2E. |
| R14 | Use only local shadcn controls and verify the desktop surface; do not add mobile behavior. | Repository UI architecture. | Studio onboarding feature. | Component accessibility checks and desktop E2E/screenshots. |

Every planned concept maps to R1-R14. There is no requirement for a native app
wrapper, folder-selection bridge, general application Settings schema, global
Visual Language user library, onboarding history, Project relocation, cloud
sync, or provider account system.

## Product Behavior

### Platform config directories

The production resolver returns these directories:

```text
macOS
  $HOME/.config/renku

Windows
  %LOCALAPPDATA%\Renku\Studio

Linux and other supported Unix-like CLI environments
  $XDG_CONFIG_HOME/renku
  or $HOME/.config/renku when XDG_CONFIG_HOME is unset or empty
```

`XDG_CONFIG_HOME` is used only when it is absolute. A relative value is ignored
and the `$HOME/.config` fallback is used. On Windows, `LOCALAPPDATA` must resolve
to an absolute path. Renku fails with a structured configuration error when the
native Windows location cannot be resolved; it does not fall back to
`%USERPROFILE%\.config\renku`.

The resolved directory continues to contain:

```text
config.yaml                 required global Project Library config
.env                        managed and preserved unmanaged provider credentials
current-project.json        generated current CLI authoring state
studio-runtime.json         generated live-server descriptor
studio-events.jsonl         generated live Studio coordination state
```

This plan does not create all files during onboarding. Setup creates only the
directory, recommended Project Library, and `config.yaml`; `.env` is created
only when credentials are saved, and generated state appears only when its
existing owner needs it.

Old files that happen to exist locally, including `cli-config.json`,
`config-setting.json`, `env.sh`, backups, and updater logs, are neither read nor
deleted by this work. The plan does not introduce diagnostics or cleanup logic
for obsolete files.

### Recommended first Project Library

When config is missing, Core reports one recommendation:

```text
macOS:  $HOME/Movies/Renku
Windows: %USERPROFILE%\Videos\Renku
Linux/other Unix: $HOME/Videos/Renku
```

Every product-chosen default ends in the single whitespace-free directory name
`Renku`. The recommendation is shown as read-only product information. Studio must not
render an `Input`, file control, directory picker, browse button, drag target,
or browser File System Access API for this value.

The first step contains:

- the Renku identity and **Welcome to Renku** heading;
- a **Project Library** label;
- concise copy explaining that Projects and their media will live at the shown
  location;
- the complete recommended path in a quiet read-only path treatment;
- the primary action **Use this Project Library**; and
- a concise advanced note: to use another location, close Studio, run
  `renku init <storage-root>`, and start Studio again before continuing.

The primary action calls the authenticated setup initialization endpoint. Core
creates or verifies the recommended directory and writes the unchanged config
shape:

```yaml
version: 0.1.0
storageRoot: /absolute/recommended/path
```

If directory creation or config persistence fails, the step remains visible,
shows the structured error and suggestion, and allows retry. It never proceeds
with in-memory configuration that was not durably written.

### Existing and invalid configuration

A valid existing `config.yaml` returns `configured` and mounts the current
Studio application immediately. The onboarding UI is not shown, even when the
Project Library is empty or provider credentials are missing.

This preserves the current development setup exactly:

```text
config directory: /Users/keremk/.config/renku
Project Library:  /Users/keremk/renku-movies
Project:          /Users/keremk/renku-movies/urban-basilica
```

An existing config that is unreadable, malformed, unsupported, or missing its
required `storageRoot` remains an error. Core does not report it as
`setupRequired`, and initialization does not overwrite it. Studio displays a
blocking error with the existing structured suggestion. Repairing manually
edited or damaged config remains a CLI/filesystem operation outside this UI.

### Optional provider credentials

After `config.yaml` is created in the current onboarding session, Studio shows
an optional **Provider API keys** step using the existing
`ProviderCredentialsFields` and `useProviderCredentialsDraft` behavior.

The step exposes exactly:

- fal.ai;
- ElevenLabs; and
- World Labs.

Existing write-only secret behavior remains unchanged: previously saved values
never enter the browser, blank fields preserve existing values, entered values
are staged, and Save performs one authenticated atomic update. The onboarding
container supplies these actions:

- **Save and continue** when one or more valid replacements are staged;
- **Continue** when no changes are staged; and
- **Skip for now** while loading or after a recoverable credential load/save
  failure.

Skip writes nothing and opens the Project Library. A failed credential save
preserves the draft and remains retryable; because credentials are optional,
the user may still choose **Skip for now** and configure them later through the
existing global Settings dialog.

No durable onboarding completion value is stored. If the browser closes after
the Project Library step, the next launch sees valid config and opens the
Project Library normally. The optional credential step is not replayed.

### Advanced custom Project Library setup

The existing command remains:

```text
renku init <storage-root>
```

It still requires an explicit argument, creates config only when none exists,
and reports an existing config without changing it. An advanced user can run it
before completing Studio onboarding; the next Studio start or setup-status
refresh sees the valid config and skips onboarding.

This plan does not add:

- a `renku config` command family;
- a command to change an existing `storageRoot`;
- Project copy or move behavior;
- a Settings control for Project Library location; or
- manual config editing instructions beyond the existing documented CLI.

### Visual Language boundary

The built-in Visual Language Catalog assets remain installed package content
under `packages/core/catalog/visual-language/`. Core reads that bundled catalog
directly and never copies it into the Renku config directory.

The distinction is:

```text
installed Core catalog
  immutable application content; not Project data and not user config

<Project folder>
  Project SQLite Visual Language records
  Project-owned Markdown guidance and prompt templates
  Inspiration folders and images
  Inspiration Analysis JSON
  Lookbooks and Visual Language media
```

Remove the global writable catalog-root contract from public Core inputs and
responses. Tests may call an internal reader with an explicit fixture root, but
production callers cannot redirect the system catalog to arbitrary global user
content. If packaged catalog content is missing or invalid, Core fails with its
existing structured Visual Language Catalog diagnostics and suggests repairing
the installed Renku product; it does not create an empty global catalog.

No existing `~/.config/renku/visual-language/` directory is deleted. The
runtime simply stops treating that location as a current source.

## Context And Current Evidence

### Accepted architecture and product constraints

- `docs/decisions/0004-use-human-first-cli-guidelines.md` owns the current
  `renku init <storage-root>` contract, YAML/camelCase format, and required
  `storageRoot`; its fixed all-platform path and CLI-only initialization clauses
  require a narrow supersession notice.
- `docs/decisions/0077-use-self-contained-agent-first-beta-distribution.md`
  requires native Windows x64 PowerShell without WSL and keeps Studio as a
  foreground local Node server plus browser UI.
- `docs/decisions/0084-use-global-renku-provider-credential-storage.md` owns the
  exact three-provider surface, write-only browser contract, atomic `.env`
  behavior, and reusable onboarding controls; its fixed macOS-style credential
  path requires a narrow supersession notice.
- `docs/architecture/reference/project-storage-boundaries.md` correctly makes
  Project SQLite and Project files authoritative for durable Project data but
  still says the system Visual Language Catalog is copied through the config
  directory. That sentence conflicts with the user-confirmed boundary.
- `docs/architecture/reference/front-end-guidelines.md` places onboarding-like
  product surfaces under `src/features/` and explicitly keeps reusable provider
  fields separate from Settings dialog chrome.
- `docs/architecture/reference/structured-diagnostics.md` reserves the
  `CONFIG...` namespace for global configuration failures and requires package
  boundary errors to remain structured.
- `plans/active/0175-studio-empty-project-creation-dialog.md` keeps the
  configured Project Library visible and immutable inside ordinary Project
  creation. Onboarding initializes the global library before that dialog can be
  reached and does not change Project creation.
- `plans/active/0176-self-contained-beta-distribution-and-agent-installation.md`
  already defines `%LOCALAPPDATA%\Renku` as the Windows installed-product root.
  `%LOCALAPPDATA%\Renku\Studio` keeps mutable Studio state distinct from
  `versions`, `bin`, and `current.txt` without changing installer layout.
- `plans/active/0186-global-provider-credentials-settings-dialog.md` is an
  implemented historical record. This plan composes its current reusable
  editor; it does not rewrite that plan.

### Current implementation evidence

- `packages/core/src/server/renku-config.ts` owns config parsing,
  initialization, `storageRoot`, and `CONFIG001`-`CONFIG013`, but hard-codes
  `<home>/.config/renku` and combines paths, validation, persistence, and
  directory effects in one growing file.
- `packages/engines/src/provider-credentials/env-file.ts` independently
  hard-codes the same directory for `.env`. The default Engines registry and
  direct ElevenLabs/World Labs entrypoints can create a filesystem-backed secret
  resolver without Core, so changing only Core would break credentials on
  Windows.
- `packages/engines/src/provider-env-files.ts` is not used by production code;
  it exists for provider E2E setup and repeats the global path again.
- `packages/core/src/server/studio-coordination/`, current-project lifecycle,
  CLI project selection, and all Project resource owners already call Core's
  `resolveRenkuConfigDir`. They will inherit platform behavior without copying
  platform branches.
- `packages/cli/src/commands/initialize-config-command.ts` is already a thin
  adapter over `initRenkuConfig`; no new CLI business rule is required.
- `packages/cli/src/commands/studio/start-command.ts` starts the server before
  reading `config.yaml`, while `packages/studio/src/app/use-project-session.ts`
  unconditionally requests the Project Library. That existing separation makes
  a browser setup gate possible without changing the installer or server
  lifecycle.
- `packages/studio/src/features/settings/` already provides reusable credential
  fields and draft/save behavior, as required by ADR 0084.
- `packages/core/src/server/catalog/visual-language/paths.ts` copies bundled
  catalog files to `resolveRenkuConfigDir()/visual-language` or creates an empty
  writable directory. The public catalog DTO also exposes `catalogRoot`, and
  public inputs accept `homeDir`/`catalogRoot`, despite there being no current
  Studio or CLI consumer of this global redirectable catalog.
- Studio E2E setup currently prewrites `<isolatedHome>/.config/renku/config.yaml`,
  so it never exercises missing-config onboarding.

### Right-sized change decision

1. **Reuse current config and Project Library contracts unchanged:** rejected.
   It cannot initialize a new install from Studio and continues to resolve an
   inappropriate Windows path.
2. **Refactor the existing Core config owner and extend the current Studio
   startup plus credential editor:** selected. It introduces one setup resource
   and one initialization intent while reusing `RenkuConfig`, `initRenkuConfig`,
   `renku init`, Project Library, and provider credential behavior.
3. **Add a generic global Settings document, native app shell, folder picker,
   onboarding state database, or Project relocation service:** rejected. None
   is required for the accepted first iteration.

## Architecture Shape Gate

### Ownership

- `packages/core/src/server/config/` owns platform config paths, the unchanged
  YAML document, required/recommended Project Library paths, config inspection,
  initialization, and config-related structured errors.
- `packages/core/src/server/provider-credentials/` owns `.env` filesystem
  parsing, atomic persistence, the browser-safe resource/command, and creation
  of the filesystem-backed `SecretResolver` passed into Engines.
- `packages/engines/src/provider-credentials/catalog.ts` continues to own the
  closed ordered provider descriptor catalog. Engines provider adapters consume
  an injected `SecretResolver` and do not locate application config files.
- `packages/core/src/server/catalog/visual-language/` owns validation and reads
  of immutable bundled catalog content. Project Visual Language persistence
  remains in its existing Project-owned modules.
- `packages/studio/server/routes/setup.ts` owns only authenticated HTTP
  delegation and serialization for setup status/initialization.
- `packages/studio/src/features/onboarding/` owns the two first-run steps and
  composes the existing provider credential controller and fields.
- `packages/studio/src/app/` owns the setup gate that prevents Project resource
  hooks from mounting before configuration is ready.
- `packages/cli` retains its current thin `renku init` adapter; installers only
  update their completion guidance.

### Public entrypoints and contracts

Callers use these deliberately named Core server entrypoints:

```ts
resolveRenkuConfigDir(options?)
resolveRenkuConfigPath(options?)
resolveRecommendedRenkuStorageRoot(options?)
readRenkuConfig(options?)
initRenkuConfig(storageRoot, options?)
readRenkuSetup(options?)
initializeRenkuSetup(options?)
createRenkuProviderSecretResolver(options?)
```

The package public server entrypoint remains
`packages/core/src/server/index.ts`. It re-exports only the bounded public
contracts above and remains a thin export surface.

Studio uses:

```text
GET  /studio-api/setup
POST /studio-api/setup
```

Both routes require the existing browser mutation token and return `Cache-Control:
no-store`. The POST accepts no storage path or generic config object; it invokes
the exact Core-owned recommended initialization intent.

### Intended Core module shape

```text
packages/core/src/
  client/
    renku-setup.ts                  browser-safe setup resource/report
    visual-language-catalog.ts      entries only; no absolute catalog root/input

  server/
    config/
      index.ts                      thin bounded config exports
      paths.ts                      platform config and recommended library paths
      document.ts                   YAML parse, validation, read, and persistence
      setup.ts                      missing/configured inspection and initialization
      errors.ts                     RenkuConfigError and CONFIG diagnostics
      paths.test.ts
      document.test.ts
      setup.test.ts

    provider-credentials/
      index.ts                      thin bounded exports
      store.ts                      exact .env parsing and atomic owner-safe writes
      resolver.ts                   SecretResolver backed by the Core-owned store
      service.ts                    sanitized resource/update command

    catalog/visual-language/
      bundled-catalog.ts            installed package catalog resolution only
      reader.ts                     existing entry validation/read behavior
      file-resolution.ts            existing contained relative-file rules
      frontmatter.ts                existing catalog envelope validation
      errors.ts                     existing structured catalog failures
```

Delete `packages/core/src/server/renku-config.ts` after updating all imports
directly to the new bounded config module. Do not leave a re-export stub at the
old path.

Move the provider `.env` store/resolver implementation out of Engines rather
than retaining two file owners. Keep only the provider descriptor catalog under
`packages/engines/src/provider-credentials/`; update its `index.ts` to remain a
thin entrypoint for that catalog. Delete the unused production-default
`packages/engines/src/provider-env-files.ts` and make provider E2E setup receive
the Core-owned filesystem resolver through explicit test injection. E2E tests
must not load API keys into `process.env` or accept exported API-key values.

### Intended Studio module shape

```text
packages/studio/
  server/
    app.ts                          shallow route composition
    routes/
      setup.ts                      thin GET/POST adapter
      setup.test.ts

  src/
    app/
      app.tsx                       app-wide providers only
      studio-setup-gate.tsx         load setup; choose onboarding/configured app
      configured-studio-app.tsx     current Project session and Studio composition

    features/
      onboarding/
        onboarding-screen.tsx       step composition and session-only progression
        project-library-step.tsx    required recommended-library confirmation
        provider-credentials-step.tsx optional reuse of credential editor
        onboarding-screen.test.tsx

    services/
      studio-setup-api.ts           token-protected setup read/initialize client
      studio-setup-api.test.ts
```

Use the existing local `Button`, `Alert`, and other shadcn primitives. The
read-only Project Library path is semantic text/code presentation, not a
disabled form input pretending to be editable.

### Bounded branching

The only setup states are the closed Core union `setupRequired` and
`configured`. The only session-local onboarding steps are `projectLibrary` and
`providerCredentials`. A discriminated union or two-case branch is sufficient;
no registry, workflow engine, reducer framework, step plug-in system, route
namespace, or persisted state machine is permitted.

Platform branching is confined to `config/paths.ts`. No CLI command, Studio
route, React component, provider adapter, coordination module, or Visual
Language reader may switch on `process.platform`, inspect `LOCALAPPDATA`, or
read `XDG_CONFIG_HOME`.

### Files expected to shrink, disappear, or remain thin

- `packages/core/src/server/renku-config.ts` disappears after its focused
  responsibilities move under `server/config/`.
- `packages/engines/src/provider-credentials/env-file.ts` and `resolver.ts`
  disappear after Core owns the filesystem-backed store/resolver.
- `packages/engines/src/provider-env-files.ts` disappears from production
  exports; its E2E convenience must not survive as another default path owner.
- `packages/core/src/server/catalog/visual-language/paths.ts` disappears; the
  replacement bundled resolver never writes.
- `packages/core/src/server/index.ts`, `packages/engines/src/index.ts`, and
  bounded module `index.ts` files remain thin exports.
- `packages/studio/server/app.ts` remains shallow route composition.
- `packages/studio/src/app/app.tsx` shrinks by moving the configured Project
  session into `configured-studio-app.tsx`; it does not absorb onboarding
  controls.
- `use-project-session.ts` remains responsible only for configured Project
  navigation and library state. It does not learn setup states.
- `app-settings-dialog.tsx` remains Settings-specific dialog chrome and is not
  reused as the onboarding screen.

### Forbidden shapes and stop conditions

Do not:

- add a Windows fallback to `.config/renku`, a macOS Application Support path,
  or dual-read old/new config locations;
- read platform environment variables outside Core `config/paths.ts`;
- let Engines locate, load, or mutate a Renku user config file by default;
- put config validation or recommended Project Library rules in HTTP, CLI, or
  React code;
- accept a path, arbitrary YAML, generic patch, or config object through the
  onboarding HTTP mutation;
- add a folder picker, text input, browser directory handle, native bridge,
  PowerShell picker, AppleScript picker, Electron/Tauri shell, or OS dialog;
- add a durable onboarding flag, completed-step list, tour state, or global
  Settings property bag;
- treat an empty library, missing provider key, or missing global Visual
  Language folder as an invalid setup;
- copy bundled Visual Language catalog content into user config or a Project
  before a focused Project-owned command explicitly creates Project data;
- move, delete, rewrite, or recognize legacy local files during startup;
- add a Project schema migration or a library move/copy operation; or
- duplicate the full config invalid-state matrix in Core, HTTP, React, CLI, and
  E2E tests.

Stop and revise before implementation continues if:

- platform path logic appears in more than `config/paths.ts`;
- a provider live path still creates its own filesystem-backed resolver inside
  Engines;
- the setup route begins accepting user-chosen paths or generic configuration;
- `app.tsx`, `onboarding-screen.tsx`, or one Core config file begins combining
  path resolution, validation, persistence, credential mutation, and UI/result
  formatting;
- supporting Windows requires a native desktop wrapper or WSL;
- Visual Language cleanup starts moving/deleting Project or user files instead
  of removing the runtime global-copy contract; or
- implementation can pass only by preserving the old config module/path as a
  compatibility facade.

## Contracts

### Core platform path options

`RenkuConfigPathOptions` remains server-only and retains `homeDir` and
`storageRoot` for existing isolated tests and explicit command overrides. Add a
focused internal dependency shape in `config/paths.ts` so platform behavior can
be tested without mutating `process.platform` or the developer environment:

```ts
interface RenkuPlatformPathContext {
  platform: NodeJS.Platform;
  homeDir: string;
  localAppData?: string;
  xdgConfigHome?: string;
}
```

Production builds this context from `process.platform`, `os.homedir()`,
`process.env.LOCALAPPDATA`, and `process.env.XDG_CONFIG_HOME`. Existing
`homeDir` options remain explicit isolated-test roots and resolve to
`<homeDir>/.config/renku` so Studio/CLI/Core tests never write into a real user
directory on any host. Tests of native platform behavior call the focused
internal resolver with a complete context.

No general environment map, path registry, or platform service is introduced.

### Setup resource

Add the complete browser-safe contract in
`packages/core/src/client/renku-setup.ts`:

```ts
export type RenkuSetup =
  | {
      status: 'setupRequired';
      recommendedStorageRoot: string;
    }
  | {
      status: 'configured';
      storageRoot: string;
    };

export interface RenkuSetupInitializationReport {
  status: 'created' | 'existing';
  setup: {
    status: 'configured';
    storageRoot: string;
  };
}
```

`readRenkuSetup(options?)` distinguishes only a genuinely absent `config.yaml`
from configured state. It reads and validates an existing file through
`readRenkuConfig`; parse, version, unknown-key, and required-field errors remain
errors.

`initializeRenkuSetup(options?)` resolves the recommended storage root and
calls the existing Core initialization behavior. It is safe to repeat: when a
valid config already exists, it returns `existing` and its configured
`storageRoot`; it never replaces the existing value with the recommendation.

### Global configuration and diagnostics

The YAML document remains exactly:

```ts
interface RenkuConfig {
  version: '0.1.0';
  storageRoot: string;
}
```

Preserve existing `CONFIG001`-`CONFIG013` meanings. Add:

- `CONFIG014`: the native Renku config directory cannot be resolved, including
  missing or non-absolute `LOCALAPPDATA` on Windows;
- `CONFIG015`: the recommended Project Library could not be created or made
  readable/writable before config persistence.

Initialization collects the actionable config-directory and storage-root issue
where possible, performs no config write after a blocking error, and keeps the
existing explicit conflict error when a required directory path is a file.

### Studio setup HTTP contract

`GET /studio-api/setup` returns:

```json
{
  "setup": {
    "status": "setupRequired",
    "recommendedStorageRoot": "/Users/alex/Movies/Renku"
  }
}
```

or:

```json
{
  "setup": {
    "status": "configured",
    "storageRoot": "/Users/alex/renku-movies"
  }
}
```

`POST /studio-api/setup` accepts no body and returns:

```json
{
  "report": {
    "status": "created",
    "setup": {
      "status": "configured",
      "storageRoot": "/Users/alex/Movies/Renku"
    }
  }
}
```

Both endpoints require `X-Renku-Studio-Token`, use `Cache-Control: no-store`,
delegate to Core, and serialize structured errors through the existing Studio
error response. The server does not inspect files, choose paths, create
directories, or interpret config error codes beyond the existing prefix-based
HTTP mapping.

### Provider credential storage and resolution

Keep the accepted `.env` document behavior from ADR 0084:

- exact managed provider assignments are read and atomically replaced;
- unmanaged lines and assignments are preserved;
- existing secret values never cross the Core client or HTTP boundary;
- a written file uses owner-only `0600` permissions where POSIX modes apply;
- Windows relies on the current user's LocalAppData ACL and never writes under
  the installed version directory; and
- every new provider operation reads current saved state without caching it in
  `process.env`.

Move the file store and filesystem-backed resolver into
`packages/core/src/server/provider-credentials/`. The resolver receives the
Core config path options and reads `<resolveRenkuConfigDir(options)>/.env`.

Change Engines live entrypoints to require or receive `SecretResolver` from
their owning Core workflow:

- managed `runGeneration` passes it into the live provider registry;
- Location World generation passes it to World Labs;
- ElevenLabs Cast Voice sample attachment passes it to the sample fetcher; and
- any other production provider entrypoint found during implementation must be
  updated directly before the Engines default resolver is deleted.

Simulated generation does not require a resolver. Provider unit tests inject
test resolvers. Provider E2E tests use the Core-owned filesystem resolver and
must not discover a user config path inside Engines, load API keys into
`process.env`, or accept exported API-key values.

### Bundled Visual Language Catalog

Change the public catalog contract to:

```ts
export interface VisualLanguageCatalog {
  entries: VisualLanguageCatalogEntry[];
  warnings: DiagnosticIssue[];
}
```

Remove `catalogRoot` from the response and remove
`ReadVisualLanguageCatalogInput` plus `ReadVisualLanguageCatalogEntryInput`
path overrides from `packages/core/src/client/visual-language-catalog.ts`.
Public server reads become:

```ts
readVisualLanguageCatalog()
readVisualLanguageCatalogEntry({ id })
```

The internal reader may accept an explicit fixture root from its test module,
but that function is not exported through `@gorenku/studio-core/server`.
`resolveBundledVisualLanguageCatalogRoot` resolves only installed package
content and fails when it is absent. It performs no `mkdir`, `cp`, fallback to
the config directory, or empty-catalog creation.

## Implementation Slices

### Slice 1: Record the cross-platform setup decision

- Add ADR 0085 for platform config paths, first-run recommended Project Library
  initialization, CLI-only custom location, Core-owned credential path, and the
  packaged-only Visual Language Catalog.
- Add concise supersession notices to ADR 0004 and ADR 0084 without rewriting
  their historical bodies.
- Update current storage/config references to use the platform table and
  Project-local Visual Language boundary.

This slice locks the changed direction before production callers are updated.

### Slice 2: Refactor the Core configuration owner

- Split `renku-config.ts` into the intended `server/config/` module and delete
  the old path after updating every caller.
- Implement the platform resolver and recommended Project Library resolver.
- Preserve the current YAML validation and `renku init` semantics.
- Add setup inspection/initialization and `CONFIG014`/`CONFIG015` failures.
- Update current-project, runtime descriptor, coordination store, catalog
  callers, Project service wiring, CLI tests, and E2E test injection to reach
  the new module directly.

This slice must leave the package compiling with one path owner and no
compatibility export.

### Slice 3: Move credential file access behind Core paths

- Move `.env` store and resolver behavior from Engines into the existing Core
  provider-credentials module.
- Keep the three-provider descriptor catalog in Engines.
- Require injected `SecretResolver` at Engines live boundaries and update every
  Core production call site, including managed generation, Location Worlds,
  ElevenLabs Cast Voice samples, and any current live-provider caller found by
  the final search.
- Delete Engines' default filesystem resolver and unused production path loader.
- Preserve the current credential UI/API resource and atomic secret behavior.

This slice is complete only when no Engines production module reads
`LOCALAPPDATA`, `XDG_CONFIG_HOME`, `os.homedir()/.config/renku`, or a Renku
credential file.

### Slice 4: Remove the global writable Visual Language Catalog

- Replace config-directory copy/create resolution with packaged-catalog-only
  resolution.
- Remove global catalog root fields and public path override inputs.
- Keep existing entry validation and packaged catalog assets.
- Update catalog tests to use the internal fixture-root reader and prove the
  public reader performs no config-directory write.
- Correct current domain/storage documentation; do not edit implemented Plan
  0007 merely to rewrite history.

No Project data or local config file is moved or deleted in this slice.

### Slice 5: Expose the thin Studio setup API

- Add the setup route and register it in the shallow server app.
- Pass isolated config options through development/E2E server construction so
  tests never touch the real config directory.
- Add the browser service for setup reads and initialization.
- Prove token enforcement, no-store headers, delegation, response shapes, and
  structured error mapping without repeating Core's config validation matrix.

### Slice 6: Gate Studio startup and compose onboarding

- Split configured Studio composition out of `app.tsx`.
- Load the setup resource before mounting `useProjectSession` or coordination
  hooks.
- Build the required read-only Project Library step and initialize through the
  focused setup endpoint.
- Compose the existing optional provider fields/controller as the second
  session-only step with save, continue, skip, retry, and secret-safe failure
  behavior.
- Enter the existing Project Library after completion without adding a durable
  onboarding flag or changing Project creation.

### Slice 7: Complete distribution, docs, and desktop verification

- Update installer completion copy to tell users to start Studio to finish
  setup; do not make installers write config or launch a new native process.
- Update CLI help/docs and current architecture references with platform paths,
  first-run behavior, CLI custom setup, and no folder picker.
- Add representative unconfigured/configured Studio E2E journeys.
- Run the native Windows installed-runtime smoke without WSL and verify the
  LocalAppData path.
- Verify the existing macOS development config and Urban Basilica remain
  unchanged.

## Tests And Guardrails

### Core config ownership

Owning-layer tests cover the complete matrix once:

- macOS resolves `<home>/.config/renku` and ignores Application Support;
- Windows resolves `<LOCALAPPDATA>\Renku\Studio` with native separators and
  never creates `<home>\.config\renku`;
- missing, empty, relative, or unusable Windows LocalAppData fails with
  `CONFIG014` before writes;
- Linux/Unix uses an absolute XDG config home and falls back to
  `<home>/.config` for unset, empty, or relative values;
- recommended Project Library paths exactly match the three accepted,
  whitespace-free defaults ending in `Renku`;
- missing config returns `setupRequired` without creating any file;
- initialization creates the library and YAML, then returns configured;
- repeated initialization returns existing and preserves its `storageRoot`;
- malformed, unsupported, or incomplete existing config remains a structured
  error and is not overwritten;
- a conflicting file, unavailable parent, or unreadable/unwritable recommended
  library fails before config persistence; and
- explicit isolated test roots never touch the real user config.

### Provider credential ownership

- Core store tests retain the current parse, preserve, validation, atomic
  replace, permission, and secret-safe error coverage after the move.
- Core resolver tests prove consecutive reads observe saved replacements and use
  the platform-resolved config directory.
- Engines tests prove live registries and direct provider SDK entrypoints use an
  injected resolver and do not discover filesystem credentials.
- Representative Core generation, Location World, and ElevenLabs Cast Voice
  tests prove the resolver is passed through the owning workflow.
- A stable import/runtime guardrail prevents Engines production code from
  importing Node home/config path capabilities for provider credential lookup;
  it must protect the capability/import boundary rather than private helper
  names.

### Visual Language Catalog

- Public bundled catalog reads return the current packaged entries without
  exposing an absolute root.
- Missing or invalid packaged content fails with structured catalog diagnostics
  and creates no directory.
- An isolated config directory remains free of `visual-language/` after a
  public catalog read.
- Fixture-root tests retain current frontmatter, containment, missing-file, and
  duplicate-id coverage at the catalog owner.
- Existing Project Visual Language, Inspiration, and Lookbook tests remain
  unchanged except for imports genuinely affected by the config refactor.

### HTTP and browser adapters

- Setup route tests cover token requirements, exact GET/POST response shapes,
  no request-body path contract, no-store headers, delegation, and one
  representative structured failure.
- Browser service tests cover setup resource/report parsing and structured API
  errors.
- Onboarding component tests prove the recommended path is visible and there is
  no textbox, file input, browse button, or folder-picker invocation.
- Component tests cover initialization loading/error/retry, optional credential
  load, Save and continue, Continue with no changes, Skip for now, failed save
  with retained draft, and entry into the configured app.
- Existing-config app tests prove Project Library behavior is unchanged and
  onboarding components never mount.
- Invalid-config app tests prove Studio shows the blocking error and does not
  call setup initialization or Project Library APIs.

### Integration and desktop E2E

Use representative journeys instead of repeating owning-layer edge cases:

1. An isolated missing-config launch shows the accepted default, initializes
   it, skips provider credentials, and reaches an empty Project Library.
2. A missing-config launch initializes the library, saves one provider key in
   the isolated config, and reaches Project Library without exposing the key in
   browser responses or traces.
3. An isolated config created beforehand by `renku init <custom-root>` skips
   onboarding and shows the custom empty library.
4. The existing configured Project Library smoke still creates, opens, and
   deletes a disposable Project.
5. A native Windows installed-product smoke sets an isolated
   `%LOCALAPPDATA%`, starts Studio without WSL, completes required setup, and
   verifies config under `Renku\Studio` and the Project Library under the
   Windows user Videos folder.

Desktop verification uses the supported desktop viewport only. No mobile
viewport, responsive redesign, touch behavior, or mobile report is required.

## Documentation And ADR Effects

### New decision

Add:

```text
docs/decisions/0085-use-platform-config-paths-and-first-run-setup.md
```

The ADR records:

- macOS CLI config remains `~/.config/renku`;
- Windows uses `%LOCALAPPDATA%\Renku\Studio` without WSL;
- Linux honors `XDG_CONFIG_HOME`;
- Studio uses config existence as the first-run gate and initializes the shown,
  whitespace-free `Renku` Project Library only after confirmation;
- custom location remains a pre-setup CLI operation;
- no folder picker or durable onboarding state exists;
- Core owns the config and credential file path while Engines owns the
  provider catalog/adapters; and
- built-in Visual Language Catalog content stays packaged while all authored
  Visual Language state stays Project-local.

Add concise notices near the top of:

- `docs/decisions/0004-use-human-first-cli-guidelines.md`, superseding only its
  all-platform fixed path and CLI-only initialization statements; and
- `docs/decisions/0084-use-global-renku-provider-credential-storage.md`,
  superseding only the literal credential path and filesystem-owner detail.

Do not rewrite their historical reasoning.

### Current references

Update at minimum:

- `docs/cli/commands.md`;
- `docs/architecture/reference/project-create-from-yaml.md`;
- `docs/architecture/reference/project-storage-boundaries.md`;
- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `README.md` and `packages/engines/README.md` where they name the fixed path;
- installer/user setup guidance owned by the current distribution docs; and
- current E2E documentation when setup fixture behavior changes.

Do not edit implemented Plan 0007, Plan 0176, or Plan 0186 merely to make their
historical prose match the new direction. Link current accepted documentation
to ADR 0085 instead.

No Studio Skills change is required. Skills already call the installed CLI and
operate on configured Project folders; onboarding adds no agent command or
contract beyond the existing `renku init` path.

## Final Verification

### Automated verification

Run focused checks while implementing:

```bash
pnpm --dir packages/core exec vitest run \
  src/server/config/paths.test.ts \
  src/server/config/document.test.ts \
  src/server/config/setup.test.ts \
  src/server/provider-credentials/service.test.ts \
  src/server/catalog/visual-language/reader.test.ts

pnpm --dir packages/engines exec vitest run \
  src/provider-credentials/catalog.test.ts \
  src/registry.test.ts \
  src/sdk/elevenlabs/voice-samples.test.ts \
  src/sdk/world-labs/location-world-generation.test.ts

pnpm --dir packages/cli exec vitest run \
  src/commands/initialize-config-command.test.ts \
  tests/integration/cli-workflows.test.ts

pnpm --dir packages/studio exec vitest run \
  server/routes/setup.test.ts \
  src/services/studio-setup-api.test.ts \
  src/features/onboarding/onboarding-screen.test.tsx \
  src/app/app.e2e.test.tsx

pnpm --dir packages/studio test:e2e:smoke
```

Then run package and root checks proportionate to the cross-package change:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Run the existing installed-product verification and a native Windows x64
PowerShell smoke from the released/assembled tree. The Windows run must not use
WSL and must assert the actual config file path and successful first-run Studio
transition.

### Manual and read-only verification

- Start Studio with an isolated missing config and capture the Project Library
  and provider credential onboarding steps at the standard desktop viewport.
- Confirm the Project Library path is read-only and no folder-selection UI or
  browser permission prompt exists.
- Confirm credential values never appear in network responses, DOM snapshots,
  logs, or screenshots.
- Start Studio normally on the development machine and confirm it opens the
  existing `/Users/keremk/renku-movies` library without onboarding.
- Open Urban Basilica read-only and confirm its Project information and current
  Visual Language/Inspiration/Lookbook surfaces still load from the Project.
- Record checksums or modification times for
  `/Users/keremk/.config/renku/config.yaml` and the Urban Basilica Project
  database before and after the normal-start smoke; confirm they are unchanged
  by startup/read verification.
- Confirm no `visual-language/` directory is created in a fresh isolated config
  root after reading the bundled catalog.
- Inspect the config root after onboarding and confirm only files whose owners
  ran were created; do not expect legacy placeholder files.

### Architecture-shape verification

- Inspect `git diff --stat`, the complete diff, and all deleted/moved files.
- Inspect every newly large or heavily modified Core config, credential, and
  Studio onboarding file.
- Confirm `packages/core/src/server/index.ts`, Engines entrypoints, module
  `index.ts` files, and Studio server app remain thin exports/composition.
- Search production code for `.config/renku`, `LOCALAPPDATA`,
  `XDG_CONFIG_HOME`, `visual-language` config-root joins, and provider `.env`
  path construction; every platform path branch must terminate in Core
  `config/paths.ts`, and every Visual Language catalog path must terminate in
  installed package content.
- Confirm no provider adapter or Engines registry creates a production default
  filesystem credential resolver.
- Confirm `use-project-session.ts` contains no setup/onboarding logic and
  onboarding components contain no Project/config business rules.
- Confirm no checklist item was satisfied by moving all responsibilities into
  one Core file, route, hook, or React component.
- Run `git diff --check` and inspect unrelated working-tree changes without
  modifying them.

## Completion Checklist

### Review Area

- [x] Confirm every implemented concept still traces to R1-R14.
- [x] Confirm macOS keeps `~/.config/renku` and the current development setup is unchanged.
- [x] Confirm Windows uses LocalAppData natively with no WSL or Unix-home assumption.
- [x] Confirm Linux honors absolute XDG config home values without adding Linux distribution scope.
- [x] Confirm the first-run UI has no folder picker, editable path, or hidden path-selection mechanism.
- [x] Confirm custom Project Library selection remains a pre-setup CLI operation only.
- [x] Confirm provider onboarding remains optional and exposes only the accepted three providers.
- [x] Confirm Project data, including authored Visual Language state, remains inside Project storage.
- [x] Confirm no migration, file move, cleanup, Project schema change, or compatibility layer was added.
- [x] Confirm no unresolved product decision or scope expansion was hidden in implementation detail.

### Architecture And Contracts

- [x] Add ADR 0085 and narrow supersession notices to ADR 0004 and ADR 0084.
- [x] Make Core `server/config/` the single platform config path owner.
- [x] Preserve the exact `RenkuConfig` version and `storageRoot` YAML contract.
- [x] Add the exact `RenkuSetup` and `RenkuSetupInitializationReport` client contracts.
- [x] Add `readRenkuSetup` and `initializeRenkuSetup` as focused Core entrypoints.
- [x] Add `CONFIG014` and `CONFIG015` with structured issues/suggestions and no partial writes.
- [x] Preserve `renku init <storage-root>` parsing, explicit argument, idempotent existing-config behavior, human output, and JSON output.
- [x] Move provider `.env` filesystem ownership and resolver creation to Core.
- [x] Keep the provider descriptor catalog and provider adapters in Engines.
- [x] Require injected provider secrets at every Engines live-production boundary.
- [x] Remove the absolute/global root from the public Visual Language Catalog contract.
- [x] Make the public Visual Language Catalog resolver packaged-only and write-free.
- [x] Add the token-protected no-store setup GET/POST contract with no path/body mutation input.
- [x] Update all callers directly and leave no re-export facade at `server/renku-config.ts`.
- [x] Keep package-boundary diagnostics structured and secret-safe.

### Core Configuration Slice

- [x] Create the focused `server/config/` module shape from the Architecture Shape Gate.
- [x] Resolve macOS config to `<home>/.config/renku`.
- [x] Resolve Windows config to `<LOCALAPPDATA>\Renku\Studio` and reject unavailable/invalid LocalAppData.
- [x] Resolve Linux/Unix config through absolute XDG config home or the `.config` fallback.
- [x] Resolve the three exact recommended Project Library paths, each ending in the whitespace-free `Renku` directory name.
- [x] Inspect missing config without creating config or Project Library directories.
- [x] Initialize the recommended Project Library only after the focused command is invoked.
- [x] Preserve valid existing config and reject invalid existing config without overwrite.
- [x] Update current-project, Studio runtime, coordination, Project data, CLI, server, and test callers to the new Core config module.
- [x] Delete the old `renku-config.ts` implementation after direct caller updates.

### Provider Credential Slice

- [x] Move exact `.env` parsing and atomic persistence into Core provider credentials.
- [x] Move the filesystem-backed `SecretResolver` into Core and resolve the file through Core config paths.
- [x] Inject the resolver into managed generation, Location World, ElevenLabs Cast Voice, and every other production live-provider call.
- [x] Delete Engines' config-file store, resolver, and unused default provider env loader.
- [x] Preserve unmanaged `.env` lines, current write-only API behavior, fresh per-operation reads, and POSIX `0600` writes.
- [x] Preserve the existing Settings dialog behavior after the filesystem-owner move.
- [x] Keep provider unit-test credentials explicit and isolated; make live E2E tests use the same Core-owned saved-credential resolver as production.

### Visual Language Slice

- [x] Replace config-directory catalog copy/create behavior with bundled-catalog-only reads.
- [x] Keep the current packaged catalog assets and existing semantic envelope validation.
- [x] Remove public `catalogRoot`, `homeDir`, and arbitrary catalog-root inputs from the production catalog boundary.
- [x] Keep explicit fixture-root access internal to catalog tests.
- [x] Prove catalog reads create no global config folder or `visual-language/` child.
- [x] Keep Project Visual Language, Inspiration, Analysis, Lookbook, and media persistence unchanged.
- [x] Delete no existing user or Project Visual Language files.

### Studio Server And Browser Slice

- [x] Add the focused authenticated setup route and shallow app registration.
- [x] Add the setup browser service with typed structured error handling.
- [x] Split configured Studio composition from the app-wide setup gate.
- [x] Prevent Project Library/session/coordination hooks from mounting while setup is required.
- [x] Render the accepted read-only Project Library step with intentional copy and the exact primary action.
- [x] Show the advanced `renku init <storage-root>` instruction without adding a UI path control.
- [x] Initialize through Core and remain on the step after a structured failure.
- [x] Compose the current provider credential fields/controller as the optional second step.
- [x] Implement Save and continue, Continue, Skip for now, retry, and retained-draft failure behavior.
- [x] Enter the existing Project Library after completion without writing onboarding state.
- [x] Skip onboarding entirely for valid existing config.
- [x] Show invalid existing config as blocking failure without initialization or Project Library calls.
- [x] Use local shadcn controls only and keep the feature desktop-only.

### CLI, Distribution, And User Surfaces

- [x] Keep the `renku init` command shape and behavior unchanged apart from platform config-path output.
- [x] Update macOS/Windows installer completion guidance to direct first launch into setup.
- [x] Keep installers from creating config, selecting a library, or saving credentials.
- [x] Add no Linux installer or native app packaging.
- [x] Update current CLI help and setup documentation with platform-specific config paths.
- [x] Document that a custom Project Library must be configured before completing onboarding.
- [x] Add no post-setup library relocation or global Settings control.

### Tests And Guardrails

- [x] Cover the full platform path and config invalid-state matrix in Core once.
- [x] Cover credential store/resolver behavior at the new Core owner.
- [x] Cover injected-resolver behavior at representative Engines/Core live boundaries.
- [x] Add a stable capability/import guardrail preventing Engines production config-file discovery.
- [x] Cover packaged-only Visual Language Catalog behavior and no-write assertions.
- [x] Cover setup route authentication, delegation, serialization, headers, and one representative error.
- [x] Cover browser service resource/report parsing.
- [x] Cover onboarding visibility, no path controls, initialization, optional credentials, skip, failure, and configured entry.
- [x] Cover one invalid-existing-config browser case without duplicating Core's full matrix.
- [x] Add the three representative isolated Studio onboarding/configured E2E journeys.
- [x] Preserve the existing configured Project create/open/delete smoke.
- [ ] Run native Windows installed-runtime setup verification without WSL.

### Documentation And ADR Work

- [x] Add ADR 0085 with the complete accepted platform/setup/storage decision.
- [x] Add concise supersession notices to ADR 0004 and ADR 0084; preserve their historical bodies.
- [x] Correct Project storage boundaries so authored Visual Language is Project-local and bundled catalog content is installed application content.
- [x] Update current config, coordination, CLI, frontend, vocabulary, README, Engines, distribution, and E2E references.
- [x] Do not rewrite implemented Plans 0007, 0176, or 0186.
- [x] Confirm Studio Skills require no contract update.

### Final Verification

- [x] Run all focused Core, Engines, CLI, Studio route/service/component, and E2E commands listed above.
- [x] Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [ ] Run installed-product verification and native Windows PowerShell smoke without WSL.
- [x] Capture and inspect both onboarding steps at the supported desktop viewport.
- [x] Verify no credential value appears in browser, network, logs, snapshots, or screenshots.
- [ ] Verify normal macOS Studio startup reads the existing config and skips onboarding.
- [ ] Verify Urban Basilica opens read-only and its Project-owned Visual Language surfaces remain intact.
- [x] Verify the current macOS config and Urban Basilica database are not modified by verification.
- [x] Verify no global `visual-language/` directory is created in an isolated config.
- [x] Inspect `git diff --stat`, the complete diff, deleted/moved files, and every newly large file.
- [x] Confirm all `index.ts` files remain thin and no god file, broad dispatcher, catch-all helper, or compatibility facade was added.
- [x] Confirm platform branches exist only in Core `config/paths.ts` and no Engines production path discovers config files.
- [x] Confirm `app.tsx`, setup route, onboarding feature, and Core config owner match the Architecture Shape Gate.
- [x] Run `git diff --check` and remove any formatting-only churn.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [ ] Only then change plan status from `proposed` to `complete`.
