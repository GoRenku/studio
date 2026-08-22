# 0186 Global Provider Credentials Settings Dialog

Status: implemented with accepted UX revision
Date: 2026-08-21
Updated: 2026-08-22

## Accepted UX Revision — Authoritative Current Contract

The user rejected the original secret-administration presentation and the
environment-over-saved precedence rule after inspecting the first
implementation. This section is the authoritative contract for the completed
revision and supersedes conflicting environment-source, badge, helper-copy,
removal, and browser-resource details in the original implementation record
below.

### Current product behavior

- Renku-saved provider keys in `~/.config/renku/.env` are the sole credential
  source for production, live-provider E2E tests, and provider catalog tooling.
  Exported shell values do not override them.
- The Settings dialog manages exactly fal.ai, ElevenLabs, and World Labs.
- A configured provider renders an empty password input with the fixed-length
  placeholder `••••••••••••••••` and a **Replace** action; the mask is a status
  treatment and never a secret value or a reflection of the real key length.
- A missing provider renders the placeholder **Enter API key**.
- The selected desktop composition uses the existing compact Renku
  dialog-header treatment without a redundant icon or section heading, a 660 px
  frame, and one subtly elevated credential surface with aligned provider/field
  rows and quiet separators.
- Provider names stand alone without media-capability subtitles. Provider
  capabilities overlap and change as integrations expand, so the Settings UI
  does not classify fal.ai or future providers as image, video, audio, or 3D.
- Configured-field Replace actions remain neutral until hover or focus. Amber
  is reserved for active focus and an enabled Save action; disabled Save uses a
  neutral treatment.
- Initial focus lands on the first missing provider key. When every key is
  configured, focus remains on the dialog container rather than making one
  provider or header control look selected.
- Typing stages a replacement. Untouched configured fields remain unchanged.
- The eye control appears only for a newly typed draft and never reveals a
  stored value.
- The dialog contains no global-scope description, environment-variable copy,
  status badges, visible hidden-key explanation, or credential-removal action.
- Cancel and every non-saving dismissal discard drafts. Save remains explicit,
  sends only changed provider/value pairs, and applies replacements atomically.
- The reusable `ProviderCredentialsFields` component remains independent from
  Settings dialog chrome so onboarding can compose the same field behavior.

### Current public contracts

```ts
interface ProviderCredentialStatus {
  provider: string;
  label: string;
  configured: boolean;
}

interface ProviderCredentialsUpdate {
  changes: Array<{
    provider: string;
    value: string;
  }>;
}
```

Existing key values, fragments, hashes, environment-variable names, and file
paths never cross the browser boundary.

### Revision completion checklist

- [x] Remove exported-process-environment precedence from the production
  resolver and owning tests.
- [x] Reduce the sanitized browser resource to provider, label, and configured
  state.
- [x] Reduce updates to replacement-only provider/value pairs.
- [x] Remove deletion from Core, HTTP, draft, and UI contracts.
- [x] Replace status badges and explanatory copy with fixed masked fields.
- [x] Remove visible environment-variable names and global-scope description.
- [x] Preserve explicit Save, Cancel, loading, failure, and draft-retention
  behavior.
- [x] Keep provider fields reusable for future onboarding.
- [x] Verify focused Engines, Core, Studio route, service, and component tests.
- [x] Inspect dark and light desktop renders, focus treatment, field rhythm,
  action hierarchy, and console output.

## Original Implementation Record

The sections below document the first implementation that prompted the UX
revision. They are retained as review evidence, not as the current contract.

## Review Attention

| Attention item | What this plan does | Why it is here |
| --- | --- | --- |
| New global UI | Add a Settings icon immediately left of the theme switcher in both the Project Library header and the selected-Project sidebar. It opens one desktop dialog titled **Settings** with a **Provider API keys** section, Cancel, and explicit Save. | Explicit user request; the control must be available with or without an open Project. |
| Reusable onboarding boundary | Build the provider-credential fields and draft controller separately from the Settings dialog chrome. A future onboarding step can reuse the same fields, loading, validation, status, and save operation while supplying its own step navigation and footer. This plan does not build onboarding. | Explicit user request for later onboarding reuse without speculative wizard infrastructure. |
| Secret-safe reads | The browser receives provider name, environment-variable name, configured source, and whether a Renku-saved value exists. It never receives an existing API key, masked fragment, fingerprint, or filesystem path. Existing saved rows use an empty replacement field. | Hard security boundary: a Settings GET must not serialize durable secrets into the browser, logs, caches, or test snapshots. |
| Explicit persistence | Editing is local to the open dialog. Blank untouched fields preserve their existing state; a typed value stages a set/replace operation; Remove stages deletion of the Renku-saved value. Only Save sends one authenticated update. Cancel, Escape, close, or outside dismissal discard the draft. | Explicit user requirement that this dialog must save, not autosave. |
| Existing environment precedence | Exported process environment variables remain higher priority than `~/.config/renku/.env`. A row whose effective key comes from the process environment is visibly marked **Environment** and cannot be replaced from Studio; a Renku-saved shadow value may still be removed explicitly. | Preserves the existing override contract and avoids a Save action that appears to work but cannot become effective. |
| Runtime resolver correction | Replace the production load-once `process.env` mutation with one shared Engines credential resolver that checks the process environment first and reads the current Renku credential file for each new provider client/request. A saved replacement or removal therefore takes effect on the next provider operation without restarting Studio. | Necessary implementation detail exposed by the current loader; persistence without runtime freshness would make Save misleading. |
| Storage and permissions | Continue to store UI-managed provider keys in `~/.config/renku/.env`, not `config.yaml`, a Project database, or browser storage. Update only registered credential assignments, preserve unrelated lines/comments, write atomically, and create/replace the file with owner-only `0600` permissions. | Reuses the existing global secret location while adding required data-integrity and secret-file safety. The current local file is `0644`; the first successful Settings save replaces it with `0600`. |
| New contracts and route | Add a Core-owned browser-safe status/update contract, an Engines-owned provider credential descriptor/store/resolver, and token-protected `GET`/`PATCH /studio-api/provider-credentials`. Both responses use `Cache-Control: no-store`. | A global, non-Project resource needs a focused owning boundary and a thin local HTTP adapter. |
| Providers in this slice | Expose exactly fal.ai, ElevenLabs, and World Labs from one Engines descriptor catalog. The UI does not maintain a second provider list. | This is the user-confirmed product credential surface; repository integrations do not automatically belong in Settings. |
| Existing behavior kept | Keep Project Settings, `config.yaml` and `storageRoot`, CLI generation commands, provider/model selection, live-run approval, provider-specific errors, and manually exported environment variables unchanged. Existing OpenAI, Vercel AI Gateway, Replicate, and Wavespeed integrations remain unlisted and receive no provider-specific changes. | This is global credential management for the three providers Renku currently uses, not a redesign or cleanup of other provider integrations. |
| Explicit non-scope | Add no credentials for OpenAI, Vercel AI Gateway, Replicate, or Wavespeed; provider login/OAuth; remote key test; balance check; model enable/disable switch; default-provider choice; keychain integration; credential sync; CLI Settings command; onboarding screens; Project schema change; or automatic generation retry. | These are outside the accepted provider set or are separate product and security choices, not prerequisites for storing the three current API keys. |
| Migration and destructive effects | Add no Drizzle migration, database change, Project data rewrite, file move, or compatibility layer. Removing a saved key is an explicit staged operation committed only by Save. Unknown `.env` entries are preserved. | Keeps the blast radius global, focused, and reversible by entering the key again. |

No additional product decision was required for this implementation. The plan
treats exported environment variables as externally managed and read-only,
keeps the existing Renku `.env` file as the persisted UI store, and includes
only fal.ai, ElevenLabs, and World Labs in the provider list.

## Summary

Renku has Project-local workflow Settings, but it has no application-wide UI
for provider credentials. Provider adapters currently obtain secrets from
exported environment variables or `~/.config/renku/.env`; users must therefore
leave Studio and edit shell or filesystem configuration before a live provider
operation can work.

The smallest useful outcome is:

1. the user can open **Settings** from the same icon position in the Project
   Library and Movie Studio;
2. the dialog reports whether fal.ai, ElevenLabs, and World Labs are missing,
   saved by Renku, or supplied by the environment without disclosing secret
   values;
3. the user can stage new/replacement keys and removals in one reusable editor;
4. Cancel discards the staged draft and Save performs one authenticated,
   atomic global update; and
5. the next provider operation resolves the newly saved state without a Studio
   restart.

This surface is application-wide provider authentication. It is deliberately
separate from the Project Settings document accepted by Decision 0074, which
continues to own Project-specific workflow preferences.

## Requirement Ledger

| Id | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | A Settings icon appears immediately left of the theme switcher in both global shell locations. | Explicit user request and current shell evidence. | Studio app header and Movie Studio sidebar actions. | Component tests and desktop visual verification. |
| R2 | The Settings icon opens a consistent desktop dialog for application-wide provider API keys. | Explicit user request and Studio design guidelines. | Studio Settings feature. | Component and desktop accessibility checks. |
| R3 | The dialog uses a local draft and persists only through Save; dismissal or Cancel discards unsaved edits. | Explicit user request. | Settings dialog and draft controller. | Interaction tests for every dismissal/submission path. |
| R4 | The credential editor is reusable by a later onboarding dialog without reusing Settings-specific header, trigger, or footer chrome. | Explicit user request. | Controlled provider fields plus feature-local draft controller. | Component contract test and architecture inspection. |
| R5 | UI-managed credentials apply to all Projects and remain in the existing global Renku `.env` store. | User context and current implementation. | Core global credential command plus Engines credential store. | Isolated-home Core/Engines tests and no Project database writes. |
| R6 | Existing keys never cross the HTTP/browser boundary; callers receive sanitized status only. | Security boundary. | Core resource projection and authenticated Studio route. | Response-shape tests, negative secret scans, and no-store headers. |
| R7 | Exported environment variables remain the effective higher-priority source and are not modified by Studio. | Existing runtime contract. | Engines resolver and Settings presentation. | Resolver precedence tests and disabled environment-source UI state. |
| R8 | Set, replace, and explicit remove operations validate before write, update registered keys atomically, preserve unrelated `.env` content, and use `0600` permissions. | Direct settings behavior plus security/data-integrity boundaries. | Core validation and Engines file owner. | Owning-layer invalid/update/permission/rollback tests. |
| R9 | A successful Save affects the next provider request without restarting Studio. | Expected impact of explicit Save and current loader defect. | Engines runtime credential resolver. | Replace/remove runtime tests around consecutive resolutions. |
| R10 | One Engines-owned descriptor catalog defines provider order, display name, and environment-variable name for fal.ai, ElevenLabs, and World Labs only. | User-confirmed provider scope and no-duplication rule. | Engines provider credential module. | Descriptor and managed-consumer consistency tests. |
| R11 | The Studio server exposes a focused token-protected global read/update resource and delegates without reading files or validating provider semantics itself. | Server and security architecture. | Core client/server contracts and Studio Hono adapter. | Route tests for authentication, parsing, delegation, headers, and error mapping. |
| R12 | Loading, saving, validation, empty, environment-managed, and failure states are accessible, retain safe drafts when appropriate, and never log key values. | Direct reliability/accessibility/security edge cases. | Settings feature and all owning boundaries. | Component tests and secret-safe error/log assertions. |
| R13 | Project Settings, provider/model catalogs, generation approval, CLI commands, and onboarding remain otherwise unchanged. | Scope boundary. | Entire slice. | Diff inspection and focused regression tests. |

Every planned public concept maps to R1-R13. There is no requirement for a
generic global Settings document, provider account model, credential database,
OAuth framework, or onboarding state machine.

## Product Behavior

### Entry points

The Project Library keeps its current header. Its right-side action order is:

```text
[Project title when present]  [Settings icon]  [Theme switcher]
```

The selected-Project sidebar keeps its current header and uses the same action
order:

```text
[Renku Studio]  [Settings icon]  [Theme switcher]
```

The icon is the Lucide `Settings` glyph inside the local shadcn `Button` with
`variant='ghost'` and icon sizing aligned to the 28px-high theme switcher. It
has a local `Tooltip` labelled **Settings** and the accessible name **Open
Settings**. No visible text is added to the compact shell headers.

Both shell locations compose the same `AppSettingsDialog`; there is never more
than one instance visible on a screen. Opening the dialog does not change the
URL, selected Project, Project Settings tab, or theme.

### Dialog composition and copy

Use the existing local shadcn `Dialog`, `Button`, `Input`, `Alert`, `Badge`,
and `Tooltip` primitives. The dialog follows the established header/body/footer
anatomy with `p-0 gap-0 overflow-hidden`, soft `border-border/40` dividers,
panel tokens, and a fixed footer outside the scrollable body.

Desktop dimensions and hierarchy:

- width: approximately `680px`, capped by the existing viewport-safe dialog
  width;
- maximum height: `calc(100vh - 2rem)` so all three providers remain reachable
  at the supported desktop viewport;
- title: **Settings**;
- description: **Settings apply to every Renku project on this device.**;
- body section label: **Provider API keys**;
- section helper: **Environment variables take priority over keys saved by
  Renku. Existing keys are never shown.**;
- footer actions: secondary **Cancel**, primary **Save**.

The body uses one quiet list rather than nested cards, provider logos, tabs, or
an empty Settings navigation rail. Each provider is one row with:

- provider display name;
- the exact environment-variable name in small muted monospace copy;
- a status badge: **Not set**, **Saved**, or **Environment**;
- one password input when the effective source is not the environment;
- an Eye/Eye Off shadcn icon Button for a newly typed value only; and
- a quiet **Remove saved key** / **Undo remove** action when a Renku-saved
  value exists.

Rows use soft dividers rather than card borders. Provider names remain primary;
environment-variable names are shown because they are meaningful setup terms,
not raw internal identifiers. No fake provider logos or generated descriptions
are introduced.

The provider order and exact initial labels are:

| Provider label | Environment variable |
| --- | --- |
| fal.ai | `FAL_KEY` |
| ElevenLabs | `ELEVENLABS_API_KEY` |
| World Labs | `WLT_API_KEY` |

This table is documentation of the accepted initial catalog, not a second UI
registry. Studio renders the ordered descriptors returned by Core/Engines.

### Safe credential states

The browser never receives the current key. Each row is projected from a
sanitized status:

| Effective state | Visible treatment | Editable behavior |
| --- | --- | --- |
| No environment value and no Renku-saved value | **Not set** badge; empty password field with **Enter API key** placeholder. | Typing stages `set`. Leaving the field untouched stages nothing. |
| Renku-saved value is effective | **Saved** badge; empty password field with **Saved — enter a new key to replace** placeholder. | Typing stages replacement. **Remove saved key** stages removal. |
| Exported environment value is effective | **Environment** badge; disabled field with **Provided by environment** placeholder and helper **Managed outside Renku Studio.** | Studio cannot set or replace the effective value. If a shadow Renku-saved value also exists, **Remove saved key** may stage deletion of that stored copy. |
| A value is typed in this dialog | **Unsaved** muted state beside the field; password characters hidden by default. | Eye/Eye Off changes presentation only. Emptying the typed value returns to unchanged state; deletion always uses the explicit Remove action. |
| Removal is staged | **Will be removed when saved** helper and **Undo remove** action. | Input is disabled until removal is undone. |

The status resource therefore carries both effective source and stored
presence. This lets Studio distinguish an externally managed environment key
from a Renku-saved key hidden behind it without exposing either value.

### Draft, Save, and dismissal behavior

Opening the dialog starts one status read. While loading, the body uses the
existing inline spinner and keeps Save disabled. A load failure renders a
dialog-level destructive Alert with a **Retry** shadcn Button; the user can
still close the dialog.

The reusable draft controller represents only user intent:

- unchanged provider: no operation;
- typed non-empty key: `set` with the typed value;
- explicit removal: `remove`;
- removal undone: unchanged.

The primary Save action is disabled when loading, saving, there are no staged
changes, or any staged value is invalid. Pressing Enter inside a credential
field submits the dialog when the draft is valid. Save sends every staged
operation in one request. It does not send placeholder text, statuses, existing
secret values, or unchanged providers.

While saving:

- all fields and row actions are disabled;
- Cancel, close, Escape, and outside dismissal are blocked;
- Save shows the existing `Loader2` spinner and **Saving…**; and
- duplicate submission is impossible.

On success:

1. the sanitized returned resource becomes the committed baseline;
2. all secret input values are cleared from React state;
3. the dialog closes;
4. a concise **Settings saved.** toast is shown; and
5. the next provider operation reads the updated credential state.

On failure, the dialog remains open, the staged values remain in memory for
correction/retry, and one secret-safe Alert shows the structured error. The
error must never echo the submitted value.

Cancel, the close button, Escape, or outside dismissal clear the in-memory
draft and close immediately when no save is running. No discard-confirmation
dialog is added. Reopening performs a fresh sanitized read.

### Validation and file behavior

Studio may disable Save for obvious empty staged values, but Core is the
authoritative validation boundary. Core accepts one operation per registered
provider:

- `set` requires a non-empty value after trimming surrounding whitespace;
- carriage return, newline, and NUL are rejected before any write;
- the normalized persisted value is the trimmed value;
- `remove` carries no value;
- unknown providers and duplicate operations are rejected together with
  structured field locations; and
- no provider-specific prefix, length, account, network, or billing check is
  performed.

The Engines file owner updates only assignments for registered environment
variables. It preserves comments, blank lines, and unknown assignments in
their existing order. Registered assignments are canonicalized to at most one
line each in descriptor order so duplicate managed entries cannot remain
ambiguous.

The write is all-or-nothing:

1. read and parse the current file;
2. apply the complete validated operation set in memory;
3. write a sibling temporary file with `0600` mode;
4. flush/close it;
5. atomically rename it over `.env`; and
6. confirm the resulting file mode is `0600`.

If any step fails, Core returns a structured error, no partial update is
reported, and the previous file remains the effective source. An absent config
directory may be created through the existing Renku config-path owner. A path
that is not a regular file and access-denied/read/write failures fail clearly;
they do not fall back to another repository `.env`.

### Reuse by future onboarding

This plan prepares reuse but does not implement onboarding.

The reusable boundary consists of:

- `ProviderCredentialsFields`: controlled presentation for the ordered rows,
  statuses, password inputs, reveal controls, and staged removals;
- `useProviderCredentialsDraft`: loading, normalized draft operations, dirty
  state, safe validation, update submission, and secret-state clearing; and
- `readProviderCredentials` / `updateProviderCredentials`: the browser service
  functions used by both containers.

`AppSettingsDialog` alone owns the Settings icon trigger, dialog header,
Cancel/Save footer, dismissal policy, and success toast. A later onboarding
step will compose the same fields and controller under its own **Back**,
**Continue**, or skip behavior. No onboarding prop, step number, generic wizard
component, or unused callback is added now.

### Explicit non-goals

This plan does not:

- put secrets in `config.yaml`, SQLite, localStorage, sessionStorage, URL state,
  Studio coordination events, logs, analytics, or generated artifacts;
- return existing key values, suffixes, hashes, or fingerprints to the browser;
- reveal a previously saved key;
- mutate exported environment variables;
- add OAuth, provider login, browser redirects, account linking, or OS keychain
  integration;
- call providers to test credentials or discover balances/models;
- enable/disable providers or choose default providers/models;
- change Project Settings or generation workflow policy;
- weaken estimate, approval-token, or live-run confirmation behavior;
- add a `renku settings` or credential CLI command;
- implement first-run detection or onboarding;
- add a generic global Settings JSON document or database;
- add a Project/database migration; or
- add mobile behavior or verification.

## Context And Current Evidence

### Accepted product and architecture constraints

- `AGENTS.md` requires Core-owned durable mutations, thin HTTP and React
  adapters, structured diagnostics, shadcn controls, intentional copy, desktop
  verification, and obvious scope expansion.
- `docs/product/design-guidelines.md` defines the current dialog anatomy,
  typography, spacing, soft borders, form controls, button hierarchy, status
  colors, dark mode, and Lucide icon usage.
- `docs/architecture/reference/front-end-guidelines.md` reserves
  `src/features/settings/` for application/Project configuration surfaces and
  requires feature/service/UI layering.
- `docs/architecture/reference/studio-server-hono.md` requires resource route
  modules, local runtime-token protection for mutations, Core delegation, and
  no filesystem ownership in routes.
- `docs/architecture/core-design-principles.md` requires one source of truth,
  structured failures, explicit mutation boundaries, and no silent fallback.
- Decision 0074 keeps Project workflow Settings in each Project database. The
  provider credential resource must remain global and separate.
- Decision 0043's provider authentication and live-run approval boundaries
  remain unchanged.
- Plan 0171 and its implementation establish the visual difference between
  autosaved Project Settings and this explicitly saved global dialog.
- Plan 0175 and the current Create Project dialog establish the selected
  desktop Dialog header/body/footer, in-flight dismissal, field error, and
  success patterns.

### Current implementation evidence

- `packages/studio/src/app/studio-app-header.tsx` renders `ThemeToggle` as the
  final Project Library header action.
- `packages/studio/src/features/movie-studio/studio-sidebar/studio-sidebar-actions.tsx`
  renders the same `ThemeToggle` in Movie Studio. These are the two required
  insertion points.
- `packages/studio/src/ui/dialog.tsx`, `button.tsx`, `input.tsx`, `alert.tsx`,
  `badge.tsx`, and `tooltip.tsx` already provide every required primitive. No
  new `src/ui` primitive is needed.
- `packages/core/src/server/renku-config.ts` owns
  `~/.config/renku/config.yaml`, its config directory, and the configured
  `storageRoot`; it currently has no provider-secret contract.
- `packages/engines/src/provider-env-files.ts` reads only
  `~/.config/renku/.env`, applies its values to `process.env`, and preserves
  already exported environment values. It has no write or sanitized status
  contract.
- `packages/engines/src/registry.ts` calls that loader once per provider
  registry secret resolver. Because the loader mutates `process.env`, a later
  replacement/removal can keep a stale prior file value alive.
- fal.ai, ElevenLabs, and World Labs currently name their credential
  environment variables in separate adapters/clients. The Settings UI needs
  one descriptor catalog and those three runtime sites need consistency with
  it. Other provider integrations present in the repository are not part of
  the user-confirmed Settings surface and are not changed by this plan.
- The current local `/Users/keremk/.config/renku/.env` is a regular file with
  mode `0644`; its contents were not inspected. New Settings writes must replace
  that permissive mode with `0600` without exposing values.
- `packages/studio/server/app.ts` mounts Project and Studio-event resources but
  no global Settings or provider-credential resource.
- Existing Studio browser mutations use the bootstrapped
  `X-Renku-Studio-Token` and structured `StudioApiError`; the new global route
  can reuse those boundaries.

### Overlapping plans

- Plan 0171 is implemented and remains authoritative for Project-local workflow
  Settings. This plan neither revises nor reopens it.
- Plans 0182, 0184, and 0185 use `WLT_API_KEY` for the implemented World Labs
  Location World path. This plan adds that existing credential to the shared
  descriptor catalog; it does not change World generation behavior.
- No current active plan owns a top-level credential UI, a provider `.env`
  writer, or a sanitized provider-credential resource.

### Right-sized change decision

1. **Reuse the existing loader unchanged:** rejected. It has no write/status
   contract, leaks source provenance into mutable process state, and cannot make
   replacement/removal reliably effective without restart.
2. **Refactor the existing provider secret owner and add thin Core/HTTP/UI
   surfaces:** chosen. It preserves the `.env` location and environment
   precedence while adding the smallest safe read/update contract.
3. **Introduce a keychain, encrypted database, or generic global Settings
   subsystem:** rejected. Those add platform, recovery, packaging, migration,
   and product choices not required for this local pre-customer application.

The selected option introduces one bounded provider-credential concept. It
does not normalize each key into a database record or turn credentials into a
generic Settings framework.

## Architecture Shape Gate

### Ownership

`packages/engines` owns provider authentication metadata, `.env` document
mechanics, and effective secret resolution because it already owns provider
adapters and secret lookup.

`packages/core` owns the application command boundary: sanitized resource
projection, accepted update operations, validation, and structured errors. The
browser and HTTP server do not call Engines directly.

`packages/studio/server` owns only the authenticated HTTP resource and error
serialization. `packages/studio/src/services` owns browser fetch mechanics.
`packages/studio/src/features/settings` owns presentation and local draft
interaction.

### Intended module shape

```text
packages/engines/src/
  provider-credentials/
    catalog.ts
    env-file.ts
    resolver.ts
    index.ts
  provider-env-files.ts
  registry.ts
  sdk/fal/*
  sdk/elevenlabs/*
  sdk/world-labs/*
  index.ts

packages/core/src/
  client/
    provider-credentials.ts
    index.ts
  server/
    provider-credentials/
      service.ts
    index.ts

packages/studio/server/
  app.ts
  errors.ts
  routes/
    provider-credentials.ts
  http/
    provider-credentials-request.ts

packages/studio/src/
  services/
    studio-provider-credentials-api.ts
  features/
    settings/
      app-settings-dialog.tsx
      app-settings-dialog.test.tsx
      provider-credentials-fields.tsx
      provider-credentials-fields.test.tsx
      use-provider-credentials-draft.ts
      use-provider-credentials-draft.test.tsx
  app/
    studio-app-header.tsx
  features/movie-studio/studio-sidebar/
    studio-sidebar-actions.tsx
```

Responsibilities:

- `provider-credentials/catalog.ts` is the single ordered descriptor catalog.
  It owns provider id, display label, and environment-variable name only.
- `provider-credentials/env-file.ts` owns parsing the Renku `.env`, sanitized
  presence inspection, registered-entry rewriting, atomic replacement, and
  file permissions. It does not know HTTP or React contracts.
- `provider-credentials/resolver.ts` owns environment-first runtime lookup and
  current-file freshness. It returns secret values only to provider execution.
- the Engines module `index.ts` is a thin entrypoint. The root package
  `index.ts` explicitly exports only the focused descriptor/store/resolver
  capabilities Core and the provider runtime need.
- existing `provider-env-files.ts` is reduced to explicit test/e2e environment
  bootstrap use or deleted if no remaining caller needs process mutation. It
  must not remain on a production provider path.
- Core `service.ts` owns `readProviderCredentials` and
  `updateProviderCredentials`, validates all operations before invoking one
  Engines write, and returns only sanitized contracts.
- Studio `routes/provider-credentials.ts` contains the two adjacent Hono
  handlers and token middleware composition. It does not parse `.env` or list
  providers.
- `provider-credentials-request.ts` validates the JSON envelope and passes the
  Core-owned request through without semantic provider validation.
- `studio-provider-credentials-api.ts` owns exact fetch paths, runtime token,
  JSON parsing, no-store request behavior, and structured error conversion.
- `ProviderCredentialsFields` is controlled, does not fetch or save, and has no
  Dialog or onboarding chrome.
- `useProviderCredentialsDraft` owns the reusable asynchronous editor state but
  no visible copy.
- `AppSettingsDialog` composes the trigger, Dialog, fields/controller, footer,
  and toast.

### Public entrypoints

Engines package entrypoint:

```ts
listProviderCredentialDescriptors(): readonly ProviderCredentialDescriptor[];
readProviderCredentialEnvironment(
  options?: ProviderCredentialEnvironmentOptions
): Promise<ProviderCredentialEnvironment>;
updateProviderCredentialEnvironment(
  changes: readonly ProviderCredentialEnvironmentChange[],
  options?: ProviderCredentialEnvironmentOptions
): Promise<ProviderCredentialEnvironment>;
createRenkuProviderSecretResolver(
  options?: ProviderCredentialEnvironmentOptions
): SecretResolver;
```

Core server entrypoint:

```ts
readProviderCredentials(
  input?: ReadProviderCredentialsInput
): Promise<ProviderCredentialsResource>;

updateProviderCredentials(
  input: UpdateProviderCredentialsInput
): Promise<ProviderCredentialsResource>;
```

Browser service entrypoint:

```ts
readProviderCredentials(): Promise<ProviderCredentialsResource>;
updateProviderCredentials(
  request: ProviderCredentialsUpdate
): Promise<ProviderCredentialsResource>;
```

### Bounded branching

No provider switch is needed in Core, HTTP, or React. Engines uses the ordered
descriptor catalog for lookup and presentation metadata. The only tagged-union
branch is the two-operation `set | remove` update contract.

Provider adapters continue to own provider-specific authentication headers and
clients. They reference credential names from the shared descriptor module
where practical; the descriptor catalog must not become a general provider
adapter dispatcher. The catalog gates which keys the Settings resource may
inspect or update; it does not turn the generic `SecretResolver` into a
provider allowlist. Existing unlisted consumers retain their current
environment/file lookup behavior without appearing in Settings.

### Files expected to shrink, disappear, or remain thin

- `packages/engines/src/provider-env-files.ts` must leave the production path
  and may disappear after its test/e2e callers move to an explicit bootstrap.
- `packages/engines/src/registry.ts` replaces its load-once resolver with the
  shared resolver and remains a registry, not a credential store.
- the fal.ai, ElevenLabs, and World Labs adapter/client files change only
  enough to consume shared credential names or the injected resolver.
- Core client/server `index.ts` files add exports only.
- Studio `app.ts`, server `app.ts`, `studio-app-header.tsx`, and
  `studio-sidebar-actions.tsx` remain thin composition files.
- `AppSettingsDialog` must not absorb `.env` parsing, provider catalog data, or
  onboarding branches.

### Forbidden shapes and stop conditions

Do not implement:

- a generic `GlobalSettings`, `SettingsManager`, arbitrary config patch, or
  catch-all `/settings` mutation;
- provider-secret values in a client contract, GET response, React initial
  state, toast, diagnostic, log, test snapshot, or coordination event;
- direct filesystem access from Hono or React;
- provider lists, labels, or environment-variable mappings duplicated in
  Core, HTTP, and Studio;
- process-environment mutation as the production refresh mechanism;
- silent `.env` fallback to a repository or Project file;
- per-provider HTTP routes, React components, or validation switches;
- remote provider validation on Save;
- raw HTML interactive controls in feature code;
- an unused wizard/onboarding abstraction; or
- a broad refactor of Project Settings, generation selection, or provider
  adapters beyond credential resolution for the three managed providers.

Stop and revise before implementation continues if:

- any existing secret must be returned to render the form;
- environment precedence cannot be represented without mutating externally
  supplied values;
- the writer cannot preserve unknown `.env` content and atomically replace the
  file;
- Core or Studio starts branching by individual provider;
- `service.ts`, `env-file.ts`, or `app-settings-dialog.tsx` mixes catalog,
  storage, HTTP, and UI concerns; or
- future onboarding behavior begins entering this slice instead of reusing the
  completed editor boundary later.

## Contracts

### Engines provider descriptor and environment state

```ts
export interface ProviderCredentialDescriptor {
  provider: string;
  label: string;
  environmentVariable: string;
}

export interface ProviderCredentialEnvironmentEntry {
  provider: string;
  effectiveSource: 'environment' | 'renku' | null;
  stored: boolean;
}

export interface ProviderCredentialEnvironment {
  providers: ProviderCredentialEnvironmentEntry[];
}

export type ProviderCredentialEnvironmentChange =
  | { provider: string; operation: 'set'; value: string }
  | { provider: string; operation: 'remove' };
```

This is a server-only secret-store contract. It may carry submitted values into
the write boundary, but read results never contain values. The descriptor
catalog is immutable application code, not user configuration.

`effectiveSource` means:

- `environment`: `process.env[environmentVariable]` is non-empty;
- `renku`: no environment override exists and a non-empty registered value is
  stored in the Renku `.env`; or
- `null`: neither source provides a value.

`stored` reports only whether the registered assignment exists with a usable
value in the Renku `.env`, including when an environment value overrides it.

### Core browser-safe resource

```ts
export interface ProviderCredentialStatus {
  provider: string;
  label: string;
  environmentVariable: string;
  effectiveSource: 'environment' | 'renku' | null;
  stored: boolean;
}

export interface ProviderCredentialsResource {
  providers: ProviderCredentialStatus[];
}

export type ProviderCredentialUpdate =
  | { provider: string; operation: 'set'; value: string }
  | { provider: string; operation: 'remove' };

export interface ProviderCredentialsUpdate {
  changes: ProviderCredentialUpdate[];
}
```

The resource contains no revision token because this local app has one Settings
writer and the operation list is explicit. The writer re-reads the current
`.env` immediately before applying changes, so unknown and unchanged content is
not overwritten from a stale browser snapshot. There is no generic resource
key or Studio coordination event.

### HTTP resource

```text
GET /studio-api/provider-credentials
X-Renku-Studio-Token: <runtime token>
Cache-Control: no-store
```

Success:

```json
{
  "resource": {
    "providers": [
      {
        "provider": "fal-ai",
        "label": "fal.ai",
        "environmentVariable": "FAL_KEY",
        "effectiveSource": "renku",
        "stored": true
      }
    ]
  }
}
```

Update:

```text
PATCH /studio-api/provider-credentials
X-Renku-Studio-Token: <runtime token>
Content-Type: application/json
Cache-Control: no-store
```

```json
{
  "changes": [
    { "provider": "fal-ai", "operation": "set", "value": "<submitted-secret>" },
    { "provider": "world-labs", "operation": "remove" }
  ]
}
```

Success returns `{ "resource": ProviderCredentialsResource }` after the atomic
write. The server never includes the request body in logs or errors. Both read
and update require the runtime token because credential presence is sensitive
local configuration and the read is used only by the bootstrapped Studio UI.

### Diagnostics

- `PROVIDER_CREDENTIALS001`: invalid update operations. Issues identify
  `changes[index].provider`, `.operation`, or `.value` without echoing values.
- `PROVIDER_CREDENTIALS002`: Renku credential path is not a regular file or
  cannot be read safely.
- `PROVIDER_CREDENTIALS003`: atomic credential write or permission update
  failed; the message contains no secret value.
- `STUDIO_SERVER050`: malformed provider-credential HTTP envelope, with the
  existing request field/type issue codes nested at exact JSON locations.

`PROVIDER_CREDENTIALS001` maps to HTTP 400. Storage failures map to HTTP 500.
No diagnostic is created for provider account validity, obsolete key names, or
an environment-managed value that Studio correctly leaves unchanged.

### Runtime resolution

`createRenkuProviderSecretResolver` implements the accepted order on every
lookup:

1. return the current non-empty exported process environment value;
2. otherwise read the current registered value from
   `~/.config/renku/.env`; and
3. otherwise return `null` and let the current provider boundary raise its
   existing missing-key diagnostic.

The resolver does not cache secret values across calls, write into
`process.env`, fall back to the repository, or return source metadata to
providers. A provider client may still cache its initialized SDK client for one
request/registry lifetime; each new provider operation obtains a fresh
resolver/client path as it does today.

The resolver may look up any environment-variable name requested by an
existing provider consumer so the shared refactor does not silently disable an
unlisted integration. Only the three catalog descriptors are exposed by the
status resource or accepted by the Settings update operation.

## Implementation Slices

### Slice 1: Establish the provider credential catalog and fresh resolver

Files:

- `packages/engines/src/provider-credentials/*`;
- `packages/engines/src/provider-env-files.ts` and tests;
- `packages/engines/src/registry.ts` and focused credential consumers;
- `packages/engines/src/index.ts`.

Work:

- add the three accepted descriptors once;
- move shared `.env` parsing and exact Renku config path handling under the
  credential module;
- add environment-first, non-mutating fresh resolution;
- move fal.ai registry, ElevenLabs voice-sample, and World Labs resolution onto
  that boundary;
- keep explicit test/e2e env bootstrapping separate if still needed; and
- test successive set/replace/remove reads without process restart.

Exit: every credential name for the three managed providers is represented
once, and none of those production provider paths depends on load-once `.env`
mutation.

### Slice 2: Add atomic global credential storage and the Core command

Files:

- Engines `env-file.ts` and focused tests;
- `packages/core/src/client/provider-credentials.ts`;
- `packages/core/src/server/provider-credentials/service.ts`;
- thin Core client/server entrypoints and tests.

Work:

- implement sanitized source/stored inspection;
- validate the complete operation list in Core before write;
- preserve unmanaged `.env` content while canonicalizing registered entries;
- atomically replace with `0600` permissions;
- return the post-write sanitized resource; and
- prove no Project database/config YAML/browser storage is touched.

Exit: one Core operation safely owns the complete durable update and returns no
secret material.

### Slice 3: Expose the authenticated global HTTP and browser service boundary

Files:

- `packages/studio/server/routes/provider-credentials.ts`;
- `packages/studio/server/http/provider-credentials-request.ts`;
- `packages/studio/server/app.ts` and `errors.ts`;
- `packages/studio/src/services/studio-provider-credentials-api.ts` and tests.

Work:

- mount the top-level resource;
- require the Studio runtime token for GET and PATCH;
- parse the exact update envelope;
- delegate to Core and serialize sanitized resources;
- send `Cache-Control: no-store`; and
- preserve structured errors without request-body logging.

Exit: Studio has one secret-safe global API boundary with no route-local
provider or filesystem rules.

### Slice 4: Build the reusable provider credential editor

Files:

- `packages/studio/src/features/settings/provider-credentials-fields.tsx`;
- `packages/studio/src/features/settings/use-provider-credentials-draft.ts`;
- focused component/hook tests.

Work:

- render the ordered sanitized provider states with local shadcn controls;
- implement set/replace/remove/undo/reveal presentation;
- keep existing values absent from UI state;
- implement load, dirty, validation, save, retry, and secure draft clearing;
- keep visible dialog/onboarding chrome outside the fields and hook; and
- use no raw interactive HTML.

Exit: the editor can be composed by Settings now and onboarding later without
forking provider rows or persistence behavior.

### Slice 5: Compose the Settings dialog in both shell locations

Files:

- `packages/studio/src/features/settings/app-settings-dialog.tsx` and tests;
- `packages/studio/src/app/studio-app-header.tsx`;
- `packages/studio/src/features/movie-studio/studio-sidebar/studio-sidebar-actions.tsx`;
- any existing shell component tests that assert action order.

Work:

- add the Settings trigger directly left of each ThemeToggle;
- compose the exact title, helper copy, scrollable body, Cancel, and Save;
- block dismissal only during Save;
- clear drafts on every non-saving dismissal and after success;
- show safe errors and one success toast; and
- preserve existing shell dimensions, Project title, home behavior, and theme
  behavior.

Exit: Settings works from both global contexts with consistent interaction and
visual language.

### Slice 6: Record the accepted global credential boundary and verify shape

Files:

- new Decision 0084;
- current fal.ai, ElevenLabs, and World Labs credential/Engine setup docs plus
  the relevant server, frontend, and CLI setup docs;
- this plan's status/checklist after implementation.

Work:

- document global-vs-Project Settings ownership, environment precedence,
  sanitized reads, `.env` storage, permissions, and runtime freshness;
- update current manual setup guidance without adding a CLI command;
- run focused/root verification and desktop Product Design inspection; and
- remove any duplicate provider list or stale load-once production path found
  in the final diff.

Exit: accepted docs and implementation describe one current contract.

## Tests And Guardrails

### Engines owning-layer coverage

- descriptor order, label, and environment-variable mapping for fal.ai,
  ElevenLabs, and World Labs;
- managed adapter/client credential-name consistency without a source-text
  inventory of private helper names;
- environment value wins over a different saved value;
- saved value resolves when no environment override exists;
- missing value returns `null`;
- a saved replacement is returned on the next lookup;
- a saved removal returns `null` on the next lookup;
- the resolver never mutates an externally supplied environment value;
- no repository `.env` or `.env.local` fallback occurs;
- an unlisted existing secret name retains environment/file resolution but is
  absent from descriptors, status, and managed updates;
- comments, blanks, and unknown assignments survive registered updates;
- duplicate registered assignments become one canonical assignment;
- set and remove operations apply together;
- failed temporary write/rename leaves the original file intact;
- new/replaced files have `0600`; and
- existing explicit e2e bootstrap still works without entering the production
  resolver path.

### Core owning-layer coverage

Cover the complete update validation matrix once:

- valid set, replacement, removal, and multi-provider update;
- trim-only/empty, CR, LF, and NUL values fail before write;
- unknown provider, duplicate provider operation, malformed operation, and
  remove-with-value collect precise issues before write;
- environment-managed status plus shadow stored presence projects correctly;
- read and update resources never include secret values;
- Engine storage failures become stable structured diagnostics; and
- isolated-home updates do not touch `config.yaml`, storageRoot, or any Project
  database.

Do not repeat this matrix at HTTP and React layers.

### Studio server and browser service coverage

- GET and PATCH both require the runtime token;
- valid GET returns the exact sanitized resource with `Cache-Control: no-store`;
- valid PATCH parses and delegates the exact operation list once;
- malformed/missing/unknown HTTP fields return `STUDIO_SERVER050` and no Core
  call;
- representative Core validation and storage failures preserve code, issues,
  suggestion, and correct 400/500 mapping;
- no response or captured log contains submitted test-secret values;
- browser functions use the exact path, method, token, body, and no-store
  behavior; and
- browser functions preserve `StudioApiError`.

### Reusable fields and draft coverage

- ordered Not set, Saved, and Environment rows render from sanitized resource;
- existing secret values are never required as props;
- typed values are hidden by default and reveal toggles only the current draft;
- environment-effective rows cannot stage replacement;
- saved and shadow-saved rows can stage/undo explicit removal;
- blank untouched fields remain unchanged rather than removing keys;
- dirty/valid state maps to the exact `set | remove` operation list;
- load retry works;
- save success clears secret drafts;
- save failure retains drafts without putting them in error copy; and
- the fields can render under a non-Dialog test harness, proving the onboarding
  composition boundary.

### Settings dialog and shell coverage

- both shell contexts render Settings immediately before ThemeToggle;
- the icon has tooltip and accessible name;
- opening loads once and focuses the first editable credential field, or the
  first footer action when none is editable;
- loading/error/retry states keep Save disabled appropriately;
- Save is disabled for a clean draft and enabled for a valid change;
- Enter submits one valid request;
- in-flight state prevents duplicate Save and dismissal;
- Cancel, close, Escape, and outside dismissal clear an unsaved draft;
- successful Save closes, clears, and emits one safe toast;
- failed Save stays open with one safe Alert;
- Project Library search/header and Movie Studio sidebar behavior remain
  unchanged; and
- ThemeToggle still works from both contexts.

### Stable architecture and security guardrails

Use stable capability/import/runtime checks, not private-name source needles:

- Studio feature code imports browser services and `src/ui`, not Node,
  Engines, server, or filesystem modules;
- Studio server imports Core server contracts and does not access `.env` or
  `process.env`;
- Core remains the only application update/validation boundary;
- Engines is the only provider descriptor/file/resolution owner;
- GET/PATCH response snapshots contain only sanctioned status fields;
- no production credential lookup mutates `process.env` from the Renku file;
- no raw `button`, `input`, or `dialog` is added to Settings feature code; and
- the complete diff is searched for accidental test-secret literals outside
  controlled fixtures and for duplicated production provider mappings.

## Documentation And ADR Effects

Add Decision 0084, **Use Global Renku Provider Credential Storage**, recording:

- provider credentials are application-global and separate from Project
  Settings;
- Engines owns the provider descriptor, `.env` document, and runtime resolver;
- Core owns sanitized read/update commands and validation;
- exported environment variables override Renku-saved values;
- existing values never cross the browser boundary;
- Settings writes are atomic and `0600`; and
- provider account testing, OAuth, and keychain storage remain separate future
  decisions.

Update current documentation:

- `docs/architecture/core-design-principles.md` for the global secret mutation
  boundary;
- `docs/architecture/reference/studio-server-hono.md` for the token-protected
  top-level provider-credentials resource;
- `docs/architecture/reference/front-end-guidelines.md` and
  `docs/architecture/frontend.md` for the Settings feature, reusable editor,
  and two shell entry points;
- `packages/engines/README.md` for credential descriptors, precedence, and
  current-file resolution;
- `docs/cli/commands.md` only where setup for the three managed providers is
  described, making clear that CLI/provider runs consume the same global
  environment/`.env` values even though no new CLI command is added; and
- `docs/product/design-guidelines.md` only if implementation establishes a
  durable reusable credential-row pattern beyond this one feature.

Do not edit Decision 0074's historical body. Cross-link it from the new ADR to
clarify that Project workflow Settings remain Project-local. No Studio Skills
change is needed until the separate onboarding workflow is designed.

## Final Verification

### Focused automated checks

Use the final test paths created during implementation, then run:

```bash
pnpm --dir packages/engines test
pnpm --dir packages/core exec vitest run \
  src/server/provider-credentials
pnpm --dir packages/studio exec vitest run \
  server/routes/provider-credentials.test.ts \
  src/services/studio-provider-credentials-api.test.ts \
  src/features/settings
pnpm build:engines
pnpm build:core
pnpm build:studio
```

Do not run dependency installation or broad formatting.

### Root verification

Because the change crosses Engines, Core, the local server, and both Studio
shells, run:

```bash
pnpm check
pnpm test
pnpm lint
pnpm build
```

Run the existing desktop Studio E2E smoke project with an isolated temporary
home/config directory. Never write test credentials to the user's real
`/Users/keremk/.config/renku/.env`.

### Isolated credential-store verification

In a temporary home directory:

1. create a `.env` with comments, blank lines, unknown assignments, and two
   registered test values;
2. read statuses and confirm no values are returned;
3. set one missing key, replace one saved key, and remove another in one Save;
4. inspect that unknown content and comments remain, managed entries are
   canonical, and mode is `0600`;
5. resolve the changed keys without process restart;
6. set an exported environment override and confirm it remains effective and
   unchanged after another file update; and
7. inject write/rename failure and confirm the prior file remains intact.

Do not call any live provider.

### Desktop Product Design verification

At the existing supported desktop viewport (approximately 1440x1024), inspect
both Project Library and Urban Basilica Movie Studio:

- Settings is immediately left of ThemeToggle without changing header height,
  title truncation, home target, or sidebar spacing;
- icon hover, tooltip, focus ring, and accessible label are consistent with
  nearby shell actions;
- dialog width, maximum height, overlay, header/body/footer bands, scrolling,
  and action hierarchy match current Studio tokens;
- provider rows remain quiet and scannable without nested card noise;
- long environment-variable labels do not collide with fields or actions;
- Not set, Saved, Environment, Unsaved, and staged-remove states are visually
  distinct without relying on color alone;
- password hide/reveal, keyboard order, Enter, Escape, Cancel, outside click,
  Retry, Save, and in-flight dismissal behavior work;
- loading and errors do not shift or clip the footer;
- light and dark themes preserve contrast, soft borders, focus, status, and
  destructive-alert visibility; and
- no mobile viewport is tested or reported.

Capture the dialog from each shell in light mode and one representative dark
mode state. Compare the captures with the existing Create Project dialog and
Studio header/sidebar anatomy, not with an invented external design system.

### Security and architecture-shape review

1. inspect `git diff --stat` and the complete diff;
2. inspect every new or materially enlarged credential, server route, and
   Settings feature file;
3. confirm no response type, JSX prop, fixture snapshot, log, toast, diagnostic,
   or documentation example contains a real secret;
4. confirm all tests use isolated temporary homes and unmistakably fake keys;
5. confirm both HTTP methods are token-protected and no-store;
6. confirm `.env` updates are atomic, preserve unmanaged content, and result in
   `0600`;
7. confirm runtime resolution is fresh and environment-first without production
   `process.env` mutation;
8. confirm provider descriptors exist once and do not become a broad adapter
   registry;
9. confirm Core validation, Engines storage, Hono parsing, browser fetch, and
   React presentation remain separate;
10. confirm `index.ts` files contain only intentional exports;
11. confirm no generic Settings framework, onboarding logic, Project migration,
    CLI command, remote key test, or provider-selection behavior entered the
    diff; and
12. confirm no checklist item was satisfied by accepting a god file, catch-all
    helper, or broad dispatcher.

## Implementation Evidence

- Engines now owns the exact three-provider descriptor catalog, atomic Renku
  `.env` document update, and fresh environment-first resolver. Production
  fal.ai, ElevenLabs, and World Labs paths use that resolver without mutating
  `process.env` from the saved file.
- Core owns the browser-safe status projection and complete set/remove
  validation. The token-protected Studio GET/PATCH route delegates to Core and
  returns no-store sanitized resources only.
- `ProviderCredentialsFields` and `useProviderCredentialsDraft` are reusable
  independently of `AppSettingsDialog`, leaving the later onboarding container
  free to supply its own navigation and footer.
- The Settings trigger is immediately before ThemeToggle in Project Library
  and Movie Studio. Explicit Save, cancellation, saved-key removal, status
  reloading, and `0600` file creation were verified in an isolated Playwright
  home.
- Desktop browser inspection covered both shells at 1440x1024, light and dark
  themes, missing and saved states, staged removal, explicit Save, Cancel, and
  theme continuity. No mobile viewport was tested.
- Focused Engines/Core/Studio tests, `pnpm check`, `pnpm test`, `pnpm lint`,
  `pnpm build`, and the complete five-test `pnpm test:e2e:studio:smoke` suite
  pass. Lint retains the pre-existing `packages/studio/server/bin.ts` console
  warning; production build retains the pre-existing large-chunk warning.
- Every credential-writing test and browser journey used an isolated temporary
  home. No live provider was called and the real local credential file was not
  read or written.

## Completion Checklist

### Review Area

- [x] Confirm every implementation concept maps to R1-R13.
- [x] Confirm the UI is application-global and remains separate from Project Settings.
- [x] Confirm the three initial credential descriptors are exactly fal.ai, ElevenLabs, and World Labs.
- [x] Confirm unlisted provider integrations receive no provider-specific changes and cannot appear in or be updated through Settings.
- [x] Confirm exported environment values remain higher priority and read-only in Studio.
- [x] Confirm current secret values never cross the browser boundary.
- [x] Confirm future onboarding itself was not implemented.
- [x] Confirm no provider login, remote validation, balance, enablement, default selection, or keychain work entered scope.
- [x] Confirm no Project database/config YAML migration or data rewrite was added.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.

### Architecture And Contracts

- [x] Add the ordered Engines `ProviderCredentialDescriptor` catalog with fal.ai, ElevenLabs, and World Labs only.
- [x] Add sanitized Engines environment-state and explicit set/remove contracts.
- [x] Add the environment-first, non-mutating fresh secret resolver.
- [x] Remove `loadProviderEnvFiles` from every production credential path.
- [x] Update the fal.ai, ElevenLabs, and World Labs credential consumers to use the shared descriptor/resolver boundary.
- [x] Add browser-safe Core `ProviderCredentialStatus`, `ProviderCredentialsResource`, and update contracts with no secret read fields.
- [x] Add focused Core `readProviderCredentials` and `updateProviderCredentials` entrypoints.
- [x] Validate every change in Core before one write and collect precise structured issues.
- [x] Add token-protected GET/PATCH `/studio-api/provider-credentials` with no-store responses.
- [x] Add the exact browser service functions and reuse `StudioApiError`.
- [x] Add no compatibility aliases, re-export stubs, arbitrary config patch, or generic Settings document.
- [x] Keep root/module `index.ts` files thin.

### Engines And Core Implementation

- [x] Read only the global Renku `.env`; never fall back to repository or Project env files.
- [x] Preserve environment-over-file precedence without changing exported values.
- [x] Re-read saved state so set/replace/remove is effective on the next provider operation.
- [x] Preserve generic secret resolution for existing unlisted consumers without exposing their keys in Settings.
- [x] Project effective source and shadow stored presence without values.
- [x] Preserve comments, blank lines, and unknown `.env` assignments.
- [x] Canonicalize registered assignments to at most one line in descriptor order.
- [x] Apply multi-provider operations in memory before any write.
- [x] Reject empty/line-breaking/NUL values, unknown providers, duplicate operations, and malformed remove operations before write.
- [x] Write through a sibling temporary file and atomic rename.
- [x] Create/replace the credential file with `0600` permissions.
- [x] Leave the original file intact when update cannot complete.
- [x] Return the post-write sanitized resource.
- [x] Keep secrets out of diagnostics, logs, receipts, events, and resource keys.
- [x] Touch no Project SQLite database, `config.yaml`, storageRoot, or browser storage.

### Studio Server And Browser Service

- [x] Add the focused provider-credentials request parser and resource route.
- [x] Require the runtime token for both read and update.
- [x] Parse only the accepted update envelope and reject unknown HTTP fields.
- [x] Delegate semantic validation and persistence to Core.
- [x] Return only `{ resource }` with `Cache-Control: no-store`.
- [x] Map validation to 400 and credential-store failures to 500 without secret echo.
- [x] Prevent request-body/credential logging.
- [x] Add browser fetch functions with exact path, method, token, body, no-store, and structured error behavior.
- [x] Keep server `app.ts`, `errors.ts`, and route composition thin.

### Reusable Settings UI

- [x] Add controlled `ProviderCredentialsFields` with no fetch, save, Dialog, or onboarding chrome.
- [x] Add `useProviderCredentialsDraft` for load, status, draft operations, dirty/valid state, save, retry, and secret clearing.
- [x] Render provider names, environment-variable labels, and Not set/Saved/Environment statuses from the resource.
- [x] Render password inputs with reveal controls only for current typed drafts.
- [x] Keep environment-effective values non-replaceable in Studio.
- [x] Support explicit staged removal and undo for a Renku-saved value, including a shadow saved value.
- [x] Treat blank untouched/re-cleared inputs as unchanged, never implicit removal.
- [x] Disable all editor controls during save.
- [x] Clear secret draft state after success and every non-saving dismissal.
- [x] Prove the fields render correctly outside a Dialog container for later onboarding reuse.
- [x] Use only local shadcn-style controls and Lucide icons.
- [x] Add no generic form/wizard framework or unused onboarding props.

### Settings Dialog And Shell Entry Points

- [x] Add `AppSettingsDialog` with the exact title, description, section copy, loading/error states, footer, and toast.
- [x] Place the Settings icon immediately left of ThemeToggle in `StudioAppHeader`.
- [x] Place the same Settings icon immediately left of ThemeToggle in `StudioSidebarActions`.
- [x] Match the existing compact shell button/tooltip/focus treatment and preserve header dimensions.
- [x] Use a scrollable dialog body with fixed header/footer and viewport-safe desktop height.
- [x] Disable Save when clean, invalid, loading, or saving.
- [x] Submit every staged change once through explicit Save.
- [x] Block duplicate submission and dismissal during save.
- [x] Keep safe staged values after failure; close, clear, and toast after success.
- [x] Make Cancel, close, Escape, and outside dismissal discard without autosave.
- [x] Preserve Project Library, Movie Studio selection, home navigation, and theme behavior.

### Tests And Guardrails

- [x] Add Engines descriptor, precedence, freshness, document-preservation, atomicity, and permission tests.
- [x] Add complete Core validation and sanitized projection tests once at the owning layer.
- [x] Add route authentication, envelope, delegation, no-store, status-mapping, and secret-negative tests.
- [x] Add browser service request/response/error tests.
- [x] Add reusable fields and draft-controller state/secret-clearing tests.
- [x] Add Settings dialog dismissal, Save, error, success, focus, and duplicate-submit tests.
- [x] Add shell action-order and ThemeToggle regression tests.
- [x] Add one representative desktop E2E journey using an isolated temporary home.
- [x] Do not duplicate the complete Core invalid-operation matrix at HTTP, React, and E2E layers.
- [x] Use no architecture test that freezes private helper/function inventories.
- [x] Verify Studio features do not import Node, Engines, server, or filesystem modules.
- [x] Verify Studio server contains no provider/file business logic.
- [x] Verify production credential resolution does not mutate `process.env` from the Renku file.
- [x] Verify Settings feature code contains no raw interactive HTML controls.

### Documentation And ADRs

- [x] Add Decision 0084 for the global credential store, precedence, sanitized resource, ownership, permissions, and non-goals.
- [x] Cross-link Decision 0074 without rewriting its historical body.
- [x] Update Core design principles for the global secret mutation boundary.
- [x] Update Hono reference documentation with the authenticated global resource.
- [x] Update frontend references with the Settings feature and reusable editor boundary.
- [x] Update Engines README with descriptor/store/resolver ownership and precedence.
- [x] Update setup documentation for fal.ai, ElevenLabs, and World Labs while adding no CLI command.
- [x] Update Product Design guidance only if a durable credential-row pattern is established.
- [x] Make no Studio Skills/onboarding changes in this plan.
- [x] Mark this plan complete only after implementation and verification evidence is recorded.

### Final Verification

- [x] Run focused Engines, Core, Studio server, browser service, fields, hook, and dialog tests.
- [x] Run `pnpm build:engines`, `pnpm build:core`, and `pnpm build:studio`.
- [x] Run root `pnpm check`, `pnpm test`, `pnpm lint`, and `pnpm build`.
- [x] Run the focused desktop E2E journey only against an isolated temporary home/config.
- [x] Verify set/replace/remove and environment override behavior without any live provider call.
- [x] Verify unmanaged `.env` content survives and the resulting file is `0600`.
- [x] Verify no operation touched the real local credential file during automated tests.
- [x] Inspect Project Library and Urban Basilica Settings entry points at the supported desktop viewport.
- [x] Inspect loading, missing, saved, environment, unsaved, staged-remove, saving, and error dialog states.
- [x] Inspect light and dark themes, keyboard focus/order, tooltips, and dialog scrolling.
- [x] Review `git diff --stat` and the complete diff.
- [x] Inspect all new or heavily modified files for size and responsibility drift.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no god file, broad dispatcher, catch-all helper, duplicated provider list, or generic Settings framework was added.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [x] Confirm no unrelated user changes were reformatted or overwritten.
- [x] Only then mark the plan complete.
