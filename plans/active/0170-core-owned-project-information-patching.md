# 0170 Core-Owned Project Information Patching

Status: complete
Date: 2026-08-05

## Summary

Make Core's partial Project Information mutation the only production write
boundary used by Studio and CLI, replace the multi-locale editor with one
Project Language selector, and preserve the existing multi-locale Core/database
model for CLI, import, Asset, and future post-production workflows.

The observed Studio failure has two causes at different boundaries:

- `urban-basilica` has no `project_locale` rows even though current creation and
  validation require a default base locale; and
- the Studio `PATCH /information` route parses a reduced full-replacement
  object and calls `ProjectDataService.updateProjectInformation`, so a
  successful edit would write omitted Project Information fields as `NULL`.

Core already has the correct public concept, `patchProjectInformation`, but the
implementation and adapters do not consistently use it. The smallest complete
architecture correction is to:

- keep `ProjectInformationPatch` and ordered language operations as the one
  Core-owned mutation document;
- move the supported locale catalog and default `en-US` definition to the
  browser-safe Core client boundary so creation, validation, and Studio use one
  source;
- refactor `patchProjectInformation` so read, merge, final-state validation,
  dependency checks, and persistence happen through one Core-owned database
  session and transaction;
- remove the public full-replacement service method and its adapter-only
  request copies;
- make the Studio server parse a patch envelope and delegate directly to Core;
- make the Project Information editor contain the five visible scalar fields
  plus one `Project language` selector and derive a minimal patch from the last
  persisted resource and latest draft;
- remove add/remove controls, locale rows, base/audio/subtitle toggles, and all
  multi-locale management from Project Details;
- keep exactly one base locale as the Core invariant and backfill only empty
  development databases with the accepted `en-US` default;
- preserve structured Core issues through the browser API error boundary; and
- leave the locale table, Asset locale reference, Core resource projections,
  multi-locale operations, and CLI language commands intact.

This plan does not add a generic database patch API, a route-local merge, a
React fallback, runtime repair, or a locale-model redesign.

## Requirement Ledger

| Id | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Editing Title, Aspect Ratio, Logline, Synopsis, or Premise in Project Details persists successfully without clearing Project Information fields that are not displayed on the screen. | User request and data-integrity boundary. | Core `patchProjectInformation`; Studio draft-to-patch projection. | Core preservation test, server delegation test, Studio autosave test, and real-project before/after ledger. |
| R2 | Durable Project Information mutation remains owned by `packages/core`; HTTP and React send intent and do not merge, validate, repair, or write project state themselves. | User request and repository hard architecture gate. | `@gorenku/studio-core` Project Information module. | Architecture shape inspection, server route test, and Studio tests that assert only patch projection. |
| R3 | A Project Information patch is resolved against current persisted state, validated as one complete aggregate, dependency-checked, and written atomically. | Accepted partial-update architecture and data-integrity boundary. | Core patch command and database transaction. | Core owning-layer tests prove preservation and rollback before writes. |
| R4 | Project Details shows one Project Language selector for the current base locale. The user can choose one supported locale but cannot add, remove, enumerate, or configure multiple locales. | User's revised product direction. | Studio Project Information feature. | Component and desktop verification. |
| R5 | `en-US` is the canonical default when no locale was explicitly supplied. New projects continue to receive it, and existing empty development databases receive it once without changing non-empty locale data. | User's explicit default decision and current Core creation rule. | Core client catalog/default contract and Drizzle data migration. | Creation/catalog tests, focused migration test, and real-project verification. |
| R6 | Studio receives and preserves Core diagnostic issues and suggestions so an autosave failure can show the first actionable issue rather than only a wrapper message. | Structured-diagnostics architecture and observed `PROJECT_DATA056` UI. | Studio API error adapter consuming Core diagnostic contracts. | Service error parsing test and Project Information error-state test. |
| R7 | The cutover removes obsolete full-replacement callers and DTOs directly; no alias, compatibility request reader, or dual route behavior remains. | Pre-customer no-compatibility rule. | Core service contract, Studio server, and Studio browser service. | Typecheck, import inspection, and full-repository search. |

Every proposed production concept maps to one of these requirements. No new
revision protocol, generic mutation framework, locale-management subsystem, or
background repair service is justified by this change.

## Product Behavior

### Scalar Project Details autosave

When a user changes an editable scalar field:

1. the Project Information panel keeps the latest local draft;
2. the latest-only autosave queue serializes draft saves as it does today;
3. when a queued draft begins saving, the feature derives a
   `ProjectInformationPatch` from the last successfully persisted resource and
   that draft;
4. unchanged fields are omitted;
5. an emptied optional text field is sent as `null`;
6. the Studio server validates only the HTTP envelope and delegates the patch;
7. Core reads the current complete Project Information state, applies the
   patch, validates the resulting aggregate, and writes in one transaction; and
8. Studio receives the updated `ProjectInformationResource`, advances its
   persisted baseline, and refreshes the project shell for title/sidebar
   projection.

Fields absent from the patch remain unchanged. In particular, editing Title
must preserve Intended Audience, Format, Target Runtime, genres, tones, rating,
creative boundaries, conflict, dramatic question, themes, historical basis,
dramatized elements, draft status, research sources, assumptions, open
questions, and next steps.

The editor keeps the current latest-only behavior:

- one request runs at a time for the surface;
- only the latest pending draft is retained;
- a successful intermediate request advances the non-rendered persisted
  baseline even when a newer draft is waiting; and
- only the latest completed result may update visible shared UI state.

This preserves ADR 0005's latest-intent behavior without adding a second queue.

### Single Project Language selector

Project Details shows one shadcn `Select` labelled `Project language`. Its value
is the one `ProjectLanguage` with `isBase: true`; option labels use the Core-owned
supported locale catalog, for example `English (en-US)`.

The screen does not show the stored locale list, add/remove actions,
base-language toggles, or audio/subtitle capability controls. Changing the
selection emits one deterministic Core patch intent:

- when the selected locale already exists in the resource, emit `setBase`;
- when it is not configured, emit `add` with `isBase: true` and the catalog's
  display name, omitting capability flags so Core applies its existing `true`
  defaults.

Other stored locales remain untouched and hidden. The UI therefore selects one
base project locale without constraining or deleting the backend's multi-locale
model. Core continues to validate supported tags, uniqueness, exactly one base,
and Asset dependencies.

### Default locale and existing empty data

The canonical default is the existing BCP 47 tag `en-US`—not the underscore
form `en_US`—with display name `English`, both capability flags `true`, and
position `0`. New project creation continues to persist it when no locale was
explicitly supplied.

A narrow Drizzle custom data migration inserts that same row only when
`project_locale` is empty. It does not touch a non-empty locale list, choose a
different base, or run during project open/read/save. After migration, the UI
always receives a durable base locale rather than synthesizing a fallback in
React or HTTP.

### Error presentation

The server response remains the accepted structured envelope:

```json
{
  "error": {
    "code": "PROJECT_DATA056",
    "message": "Project information failed validation.",
    "issues": [
      {
        "code": "PROJECT_DATA050",
        "message": "Project title cannot be empty.",
        "severity": "error"
      }
    ],
    "suggestion": "Fix the highlighted project information fields and save again."
  }
}
```

`StudioApiError` retains `code`, `status`, `issues`, `suggestion`, and the
wrapper summary. Its inherited `Error.message` is the first actionable error
issue when one exists, otherwise the wrapper summary. The generic autosave hook
therefore remains domain-neutral while showing useful Core guidance.

## Explicit Non-Goals

This plan does not:

- add editing for the Project Information fields that are not currently shown;
- redesign the Project Details screen beyond preserving the current uncommitted
  cleanup;
- add project-name editing;
- add optimistic concurrency versions, ETags, or multi-user conflict
  resolution;
- introduce a generic JSON Patch, arbitrary database state patch, or state
  writer;
- add route-local or React-local domain validation;
- redesign or remove the persisted locale model;
- remove locale fields from Core resources or Asset contracts;
- accept `en_US` as a second stored spelling or compatibility alias;
- change or remove CLI language commands;
- remove or rewrite additional non-base locales when the UI selection changes;
- expose multi-locale management, capability toggles, or locale deletion in
  Project Details;
- add migration-at-read, silent repair, fallback readers, or compatibility
  request shapes;
- change the project database schema or schema generation;
- add mobile behavior or mobile verification; or
- run an automatic plan review.

## Context And Evidence

### Accepted architecture

The following current documents constrain the implementation:

- `AGENTS.md` requires durable metadata mutation and validation to remain in
  Core, with thin Studio server and React adapters.
- `docs/architecture/reference/studio-coordination-events.md` already states
  that Project Information callers send partial updates and Core must read,
  apply, validate, and transactionally write the final complete state.
- `docs/architecture/reference/studio-server-hono.md` limits
  `http/project-information-request.ts` to raw HTTP-to-Core input translation.
- `docs/architecture/reference/front-end-guidelines.md` keeps browser fetch and
  HTTP error conversion in `src/services` and business rules out of React.
- `docs/architecture/reference/structured-diagnostics.md` requires HTTP to
  serialize structured issues and callers to retain actionable diagnostics.
- ADR `0005-use-latest-only-save-queues-for-autosave.md` requires one serialized
  latest-only queue for autosave surfaces.
- `docs/architecture/reference/project-create-from-yaml.md` already defines
  `en-US` as the default when `languages` is omitted, but it also says an
  explicit list with no base may succeed. That conflicts with the current Core
  exactly-one-base invariant and with a UI that must always project one Project
  Language. This plan corrects the current reference to require exactly one base
  when an explicit list is supplied; it does not add import implementation.

No accepted decision authorizes the Studio full-replacement path. This plan
aligns implementation with the already accepted partial-update direction and
does not require a new ADR.

### Current Core contract

`ProjectDataService` currently exposes both:

```ts
updateProjectInformation(input: UpdateProjectInformationInput)
patchProjectInformation(input: PatchProjectInformationInput)
```

The CLI already calls `patchProjectInformation`. The only production caller of
the public full-replacement method is the Studio Project Information route;
`patchProjectInformation` also calls it internally after opening and closing a
separate read session.

The existing patch type already represents all current scalar fields and
ordered locale operations. The gap is not a missing mutation concept; it is
inconsistent use, duplicated locale catalog ownership, missing default data in
the real development project, and an internal transaction boundary that does
not cover the whole read/merge/write cycle.

### Current Studio path

The current browser/server chain is:

```text
ProjectInformationPanel
  -> ProjectInformationUpdateRequest (Studio-local full shape)
  -> updateProjectInformation() browser service
  -> PATCH /studio-api/projects/:projectName/information
  -> readProjectInformationRequest() as ProjectInformationUpdate
  -> ProjectDataService.updateProjectInformation()
```

The panel sends only Title, Aspect Ratio, Logline, Synopsis, Premise, and
Languages. The server reader fills every other optional full-update property
with `undefined`. The Core full update converts those values to `NULL`, so the
method name `PATCH` does not match its data effect. The panel also contains a
Studio-local language catalog and multi-row management controls when the
current product surface needs only one base-locale selector.

### Real `urban-basilica` evidence

Read-only inspection of:

```text
/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite
```

shows:

- `project_locale` contains zero rows;
- all 18 Project Information fields omitted by the current visible form are
  non-null;
- 90 Assets exist and none has a `locale_id`; and
- current creation code already persists `en-US` as the default for new
  projects.

That evidence explains both observed risks:

1. any current edit sends `languages: []` and fails final-state validation with
   inner issue `PROJECT_DATA052`, wrapped by `PROJECT_DATA056`; and
2. bypassing that failure through the current full-update path would allow the
   next save to erase the 18 omitted metadata fields.

The accepted response is one explicit pre-customer data conversion for the
empty table, followed by normal Core-owned mutation. Runtime code does not
invent a locale during read or scalar save.

### Existing tests and gaps

- Core resource tests exercise both full replacement and patching, but they do
  not prove that a partial patch preserves every omitted Project Information
  field.
- The Core patch currently opens one session to read, closes it, then opens a
  second session through the full-update command to validate/write.
- Studio route tests claim to test patching but fake
  `updateProjectInformation` and send the full request shape.
- Project Information panel tests cover external refresh and draft
  preservation, not the exact scalar/language patch document or the new
  single-selector behavior.
- The server already serializes `issues` and `suggestion`, but
  `readStudioApiError` discards both.

### Overlapping work and working tree

No active plan owns this correction. Completed Plan `0003` and the accepted
coordination reference established partial Project Information mutation, while
completed Plan `0050` established the save notification slot.

The working tree already contains the user-requested Project Details visual
cleanup in:

```text
packages/studio/src/features/movie-studio/project-information/
  project-information-panel.tsx
```

Implementation must preserve that layout work, make narrow behavioral edits,
and avoid reformatting the file.

## Right-Sized Change Decision

Three choices were compared:

1. **Reuse the existing contracts unchanged.** Rejected. Studio demonstrably
   bypasses the patch command, Core's patch read/write is split across sessions,
   the browser uses a full-update DTO, the supported catalog is duplicated, and
   the real project is missing its default locale row.
2. **Refactor the existing Core Project Information owner.** Accepted. Keep the
   current patch concept and locale-operation vocabulary, make it the sole
   service mutation, correct its transaction boundary, share the catalog, and
   cut Studio over to a scalar-plus-base-locale projection.
3. **Introduce a new editor command, generic patch framework, or runtime repair
   service.** Rejected. The current Core patch already represents the user
   intent. One Drizzle-owned data conversion is still required because the real
   pre-customer database contradicts the accepted default and cannot be
   corrected safely by limiting the UI alone.

The plan adds one focused Core implementation module boundary and one
feature-local draft module. It removes a public mutation path and multi-locale
UI behavior instead of adding a third mutation path.

## Canonical Contracts

### Core client Project Information contracts

Move the existing `ProjectInformationPatch` and
`ProjectLanguagePatchOperation` declarations unchanged to:

```text
packages/core/src/client/project-information.ts
```

This makes the Core-owned mutation vocabulary safe for Studio to import without
creating a Studio-local copy. The language operation remains the closed union:

```ts
interface ProjectInformationPatch {
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  premise?: string | null;
  intendedAudience?: string | null;
  format?: string | null;
  targetRuntimeMinutes?: number | null;
  primaryGenre?: string | null;
  secondaryGenres?: string[] | null;
  tones?: string[] | null;
  contentRatingIntent?: string | null;
  creativeBoundaries?: string[] | null;
  centralConflict?: string | null;
  dramaticQuestion?: string | null;
  themes?: string[] | null;
  historicalBasis?: string[] | null;
  dramatizedElements?: string[] | null;
  screenplayDraftStatus?: string | null;
  researchSources?: string[] | null;
  assumptions?: string[] | null;
  openQuestions?: string[] | null;
  nextSteps?: string[] | null;
  languages?: ProjectLanguagePatchOperation[];
}

type ProjectLanguagePatchOperation =
  | {
      operation: 'add';
      localeTag: string;
      displayName?: string;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | {
      operation: 'update';
      localeTag: string;
      displayName?: string | null;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | { operation: 'remove'; localeTag: string }
  | { operation: 'setBase'; localeTag: string };
```

`packages/core/src/client/project-languages.ts` remains the owner of
`ProjectLanguage` and adds:

```ts
export const DEFAULT_PROJECT_LOCALE_TAG = 'en-US' as const;

export const SUPPORTED_PROJECT_LOCALES = [
  { localeTag: 'en-US', displayName: 'English' },
  { localeTag: 'es-ES', displayName: 'Spanish' },
  { localeTag: 'de-DE', displayName: 'German' },
  { localeTag: 'fr-FR', displayName: 'French' },
  { localeTag: 'zh-CN', displayName: 'Chinese' },
  { localeTag: 'ja-JP', displayName: 'Japanese' },
  { localeTag: 'tr-TR', displayName: 'Turkish' },
] as const;
```

Core creation, Core validation, and Studio selector options consume these
declarations. The historical migration necessarily contains SQL literals, and
its focused test verifies that they match the client default/catalog.
`client/index.ts` exports the runtime declarations as a thin package entrypoint.

The scalar semantics remain:

- an omitted scalar property preserves the persisted value;
- `null` explicitly clears an optional field;
- `aspectRatio: null` resets to Core's effective default aspect ratio;
- `title` is required only in the final resolved aggregate and cannot be
  cleared; and
- a supplied string-array property replaces that complete scalar metadata
  array, while `null` clears it.

Existing language operations remain available to Core, CLI, and Studio callers
with their current shape and behavior. Final validation continues to require at
least one locale and exactly one base locale.

### Core internal resolved state

Add the internal type `ResolvedProjectInformation` under:

```text
packages/core/src/server/project-information/contracts.ts
```

It contains the same scalar properties as `ProjectInformationResource`, uses
`undefined` for cleared optional values, and contains the current resolved
language list. Each resolved language contains:

```ts
interface ResolvedProjectLanguage {
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}
```

This type is Core-internal. It is the complete value validated and written by
the command; callers never submit it.

### Core service entrypoint

`ProjectDataService` retains only:

```ts
patchProjectInformation(
  input: PatchProjectInformationInput
): Promise<ProjectInformationResource>;
```

`PatchProjectInformationInput` remains:

```ts
interface PatchProjectInformationInput extends RenkuConfigPathOptions {
  projectName: string;
  patch: ProjectInformationPatch;
}
```

Delete from the public service and server package exports:

- `updateProjectInformation`;
- `UpdateProjectInformationInput`;
- `ProjectInformationUpdate`; and
- `ProjectInformationLanguageUpdate`.

The internal resolved state replaces the last two as implementation details.
There is no alias or deprecated export.

### HTTP contract

The route remains:

```text
PATCH /studio-api/projects/:projectName/information
```

Its request body is the Core client `ProjectInformationPatch`. The Studio screen
emits only its five scalar fields and at most one language operation per save.
The request reader:

- preserves omitted properties;
- accepts explicit `null` only for clearable fields;
- reports malformed envelopes through existing
  `STUDIO_SERVER010`/`STUDIO_SERVER013` diagnostics;
- retains `STUDIO_SERVER011` for project-name mutation attempts;
- parses the closed language-operation union without interpreting it; and
- does not validate title, aspect ratio, locale state, or any other domain
  rule.

The route calls `projectData.patchProjectInformation({ projectName, patch })`
and returns the current resource/resource-key response unchanged.

### Studio Project Information draft

`project-information-draft.ts` owns this feature-local shape:

```ts
interface ProjectInformationDraft {
  title: string;
  aspectRatio: string;
  logline: string;
  synopsis: string;
  premise: string;
  projectLocaleTag: string;
}
```

`projectLocaleTag` is projected from the resource's sole base language. The
draft-to-patch function omits it when unchanged, emits `setBase` when the new
tag is already configured, and emits one base `add` operation using the catalog
display name when it is not. It never projects the complete locale list and
never emits remove, capability-update, or non-base operations.

### Core diagnostics

Retain current Project Information diagnostics `PROJECT_DATA050` through
`PROJECT_DATA058` and their wrapper behavior. Empty locale lists remain invalid
under `PROJECT_DATA052`; the one-way conversion prevents current development
projects from reaching Studio in that state. No new locale diagnostic, runtime
repair warning, or obsolete-shape diagnostic is introduced.

## Architecture Shape Gate

### Ownership

- `packages/core/src/client/project-information.ts` owns the browser-safe patch
  document, while `client/project-languages.ts` owns the supported catalog and
  default tag.
- `packages/core/src/server/project-information/` owns patch resolution,
  complete-state validation, existing language-operation semantics, dependency
  checks, and command transaction composition.
- existing Core database access modules own SQL reads and focused writes.
- Core Drizzle history owns the one-time empty-locale data conversion.
- `packages/studio/server/http` owns only raw HTTP envelope parsing.
- `packages/studio/server/routes` owns HTTP parameter extraction, one Core call,
  and response serialization/resource keys.
- `packages/studio/src/services` owns browser fetch and structured HTTP error
  conversion.
- the Project Information feature owns draft projection and visual state, not
  durable validity.
- CLI continues to call the same Core patch service and requires no production
  change.

### Intended Core module layout

```text
packages/core/src/client/
  project-information.ts
  project-languages.ts
  index.ts

packages/core/src/server/project-information/
  index.ts
  contracts.ts
  patch-command.ts
  patch-persistence.ts
  patch-resolution.ts
  validation.ts

packages/core/src/server/database/access/
  project-information.ts
  project-locales.ts
  project.ts
```

File responsibilities:

- `client/project-information.ts`: public patch and language-operation types;
- `client/project-languages.ts`: `ProjectLanguage`, supported catalog, and
  default tag;
- `client/index.ts`: exports only;
- `server/project-information/index.ts`: thin module entrypoint exporting the
  command; no validation, SQL, or branching;
- `contracts.ts`: Core-internal complete resolved-state types;
- `patch-command.ts`: open one project session, compose one transaction, call
  focused resolution/validation/dependency/persistence functions, and return
  the resource;
- `patch-persistence.ts`: map only supplied scalar patch fields to the focused
  database update contract so omitted values remain byte-for-byte untouched;
- `patch-resolution.ts`: pure scalar merge and existing language-operation
  application; no database access;
- `validation.ts`: complete aggregate validation using the Core client catalog;
  no HTTP or React concepts; and
- existing database access files: focused reads and writes only.

Delete:

```text
packages/core/src/server/commands/update-project-information.ts
```

Its full-replacement command disappears. Relevant logic moves into the focused
Project Information module rather than being copied.

`packages/core/src/server/index.ts` remains the sole server package entrypoint
and exports only the retained public service types. It must not contain command
logic.

### Intended Studio module layout

```text
packages/studio/server/http/
  project-information-request.ts

packages/studio/server/routes/
  project-information.ts
  projects.ts

packages/studio/src/services/
  studio-projects-api.ts
  studio-project-contracts.ts
  studio-api-errors.ts

packages/studio/src/features/movie-studio/project-information/
  project-information-panel.tsx
  project-information-draft.ts
  project-information-panel.test.tsx
  project-information-draft.test.ts
```

- `project-information-draft.ts` owns the feature-local draft shape,
  resource-to-draft projection, and pure previous/next-to-patch projection.
- `project-information-panel.tsx` remains responsible for component state,
  autosave wiring, and current shadcn controls. It must shrink by moving pure
  conversion/signature logic into the draft module.
- `studio-project-contracts.ts` deletes the full-update/language request copies;
  it does not re-export Core contracts under Studio names.
- `studio-projects-api.ts` exposes `patchProjectInformation`, accepting the Core
  client patch directly and returning the current resource.
- `studio-api-errors.ts` remains the generic structured HTTP error adapter.

### Transaction shape

`patchProjectInformation` uses one opened `DatabaseSession`. Inside one
`session.db.transaction` callback it:

1. reads the project row and complete current Project Information state through
   the transaction session;
2. resolves the patch;
3. validates the complete resolved aggregate;
4. when language operations are present, checks removed locales against current
   Asset references;
5. updates Project Information scalars and replaces locale rows only when the
   corresponding part of the patch is present; and
6. returns or makes available the committed resource projection.

Validation or dependency failure occurs before either write. The public command
must not call another public command to persist the result and must not open a
second project session.

Centralized Core ownership must not produce one monolithic function. The
command composes pure resolution/validation and focused database access.

### Data conversion shape

Generate one custom Drizzle migration from `packages/core` with the descriptive
name `backfill_missing_project_base_language`. With the current journal it is:

```text
packages/core/drizzle/0074_backfill_missing_project_base_language.sql
packages/core/src/server/database/lifecycle/migration-0074.test.ts
```

Its SQL inserts `locale_baseenxx` / `en-US` / `English` with base, audio, and
subtitle flags set to true and position `0`, only when `project_locale` has no
rows. If another migration lands first, use the next Drizzle-generated number
without renaming or overwriting that migration.

The migration updates Drizzle's journal, retains Drizzle Kit's generated
snapshot for the unchanged schema shape, does not change runtime generation,
and does not modify any non-empty locale table. Its literal default values must
match `DEFAULT_PROJECT_LOCALE_TAG` and the corresponding catalog entry in a
focused migration test. Runtime code must not call it as a fallback.

### Files expected to shrink or remain thin

- `project-data-service-contracts.ts` loses the public full-update method/input
  and imports the patch type from the Core client module.
- `project-data-service-wiring/project-administration.ts` loses full-update
  wiring and points only to the Project Information patch module.
- `server/index.ts` loses full-update exports and remains an export entrypoint.
- Studio's `project-information-request.ts` becomes a partial patch parser, not
  a full-object reader.
- Studio's `project-information-panel.tsx` loses multi-row locale controls,
  Studio-local catalog, capability toggles, and locale removal logic.
- `routes/project-information.ts` remains a thin Hono resource route.
- `routes/projects.ts` changes its `ProjectDataService` pick from update to
  patch without other routing changes.

### Forbidden implementation shapes

Do not:

- keep `updateProjectInformation` as an alias or compatibility method;
- let the Studio route read current Project Information and merge fields;
- make the browser submit hidden fields merely to protect them from deletion;
- add a generic state-replacement or JSON Patch API;
- show more than one language control or expose add/remove/capability actions in
  Project Details;
- let React validate locale state or dependencies;
- call the public patch command from inside another public update command or
  vice versa;
- perform patch read and write through separate project sessions;
- infer or repair locale rows during Project Details render, project open,
  project read, or scalar patch handling;
- replace locale rows when `patch.languages` is omitted;
- delete or rewrite non-base locale rows when the user selects a base locale;
- add source-text architecture tests that freeze function or helper names;
- turn `project-information-panel.tsx`, `patch-command.ts`, or `validation.ts`
  into a catch-all Project module; or
- reformat the current Project Details design cleanup.

### Stop conditions

Stop and revise the plan before implementation continues if:

- the Studio adapter needs to understand current database state;
- Core's patch cannot be completed in one session/transaction without changing
  the accepted database lifecycle boundary;
- a new generic mutation abstraction appears necessary;
- a new schema column/table or schema-generation bump appears necessary;
- preserving omitted metadata requires the browser to send fields it does not
  own;
- browser, HTTP, CLI, and Core language-operation shapes drift;
- changing the Project Language selection would require the UI or route to read
  Asset dependencies or delete/reconfigure unrelated locale rows;
- one Core file begins accumulating unrelated Project creation, import,
  resource, and mutation behavior;
- implementation would discard the existing uncommitted visual cleanup; or
- a checklist item can pass only by accepting a broad or unreviewable file.

## Implementation Slices

### Slice 1 — Establish the client-safe patch and locale catalog

Files:

- `packages/core/src/client/project-information.ts`;
- `packages/core/src/client/project-languages.ts`;
- `packages/core/src/client/index.ts`;
- `packages/core/src/server/project-data-service-contracts.ts`;
- `packages/core/src/server/index.ts`;
- `packages/core/src/server/commands/create-movie-project.ts`;
- affected Core imports/tests.

Work:

- move the current patch and language-operation contracts to the Core client
  boundary;
- move the supported catalog/default tag out of Studio and Core command-local
  constants into `client/project-languages.ts`;
- make creation and validation consume the shared values;
- remove public full-update inputs/types/method from the service contract and
  package exports;
- update direct callers rather than adding re-exports or aliases.

Exit:

- Studio, CLI, creation, and validation use one catalog/patch vocabulary;
- `ProjectDataService` exposes only the patch mutation.

### Slice 2 — Make the Core patch command the atomic owner

Files:

- new `packages/core/src/server/project-information/*` module;
- delete `packages/core/src/server/commands/update-project-information.ts`;
- `packages/core/src/server/database/access/project-information.ts`;
- `packages/core/src/server/project-data-service-wiring/project-administration.ts`;
- `packages/core/src/server/resources/project-information.test.ts`, moved or
  split into focused module tests when appropriate.

Work:

- introduce the internal complete resolved-state contract;
- split pure patch resolution and validation from transaction composition;
- preserve existing language-operation behavior;
- retain the at-least-one-language and exactly-one-base validation rules;
- perform read, validate, dependency check, and write in one session and
  transaction;
- do not replace locale rows when `patch.languages` is omitted;
- reuse focused database access rather than embedding SQL in the command; and
- delete full-update test cases or rewrite them as current patch behavior.

Exit:

- scalar patches preserve every omitted field;
- explicit clears persist;
- existing valid locale operations and dependency protection remain unchanged;
- invalid final states and dependency failures perform no writes;
- no production code calls a full-replacement Project Information service.

### Slice 3 — Backfill the missing default once

Files:

- Drizzle Kit-generated custom migration and journal entry under
  `packages/core/drizzle/`;
- focused Core migration test; and
- `docs/architecture/reference/drizzle-migrations.md`.

Work:

- generate `backfill_missing_project_base_language` through Drizzle Kit;
- insert the canonical `en-US` base row only for an empty `project_locale`;
- verify the literal migration values match the Core catalog/default;
- prove every non-empty locale table is unchanged; and
- keep the schema shape and runtime generation unchanged while retaining the
  Drizzle Kit-generated snapshot.

Exit:

- empty development databases receive one durable default;
- valid single- and multi-locale projects are untouched;
- no runtime fallback or repair path exists.

### Slice 4 — Cut the Studio HTTP boundary over to Core patching

Files:

- `packages/studio/server/http/project-information-request.ts`;
- `packages/studio/server/routes/project-information.ts`;
- `packages/studio/server/routes/projects.ts`;
- `packages/studio/server/testing/fake-project-data-service.ts`;
- `packages/studio/server/routes/project-information.test.ts`; and
- request-validation tests as needed.

Work:

- parse the Core client patch fields and closed language-operation union;
- preserve omitted versus explicit-null semantics;
- delegate once to `patchProjectInformation`;
- delete the full-request parser behavior and fake update method; and
- keep response resource keys and structured error serialization unchanged.

Exit:

- the route passes the exact parsed patch to Core;
- malformed HTTP shapes fail at the adapter;
- domain-invalid but well-formed patches reach Core and return Core issues.

### Slice 5 — Replace multi-locale UI with one Project Language selector

Files:

- `packages/studio/src/services/studio-projects-api.ts`;
- `packages/studio/src/services/studio-project-contracts.ts`;
- `packages/studio/src/services/studio-api-errors.ts`;
- their focused tests;
- `packages/studio/src/features/movie-studio/project-information/project-information-draft.ts`;
- `packages/studio/src/features/movie-studio/project-information/project-information-draft.test.ts`;
- `packages/studio/src/features/movie-studio/project-information/project-information-panel.tsx`;
- `packages/studio/src/features/movie-studio/project-information/project-information-panel.test.tsx`; and
- representative app E2E coverage.

Work:

- rename the browser write function to `patchProjectInformation` and accept the
  Core client patch type;
- delete the Studio-local full-update/language DTOs and catalog;
- extract draft/resource/signature/patch projection from the panel;
- maintain a persisted-resource ref that advances after every successful queue
  request, including a superseded intermediate save;
- emit minimal scalar differences and at most one base-locale operation;
- replace the Languages rows and add/remove/base/audio/subtitle actions with one
  shadcn `Select` labelled `Project language`;
- map a configured selection to `setBase` and a new supported selection to
  `add` with `isBase: true`, without deleting other locales;
- retain the latest local draft on failure or external refresh;
- preserve structured error issues/suggestion and show the first actionable
  issue through `Error.message`; and
- preserve the current cleaned visual layout and shadcn controls.

Exit:

- a Title-only edit sends only `title`;
- Project Details renders exactly one Project Language control;
- changing the selection sends exactly one language operation and preserves
  hidden locale rows;
- external refresh does not clobber a local draft;
- error UI displays the Core issue when available.

### Slice 6 — Migrate and verify `urban-basilica`

Work:

1. record a read-only ledger for all Project Information scalar columns,
   `project_locale`, and Asset `locale_id` references;
2. apply the Core migration through `renku project migrate urban-basilica` and
   record its verified backup/report;
3. verify exactly one `en-US` base locale exists;
4. start Studio and confirm Project Details shows one Project Language selector
   set to `English (en-US)`;
5. change it to another supported locale, wait for Saved, reload, and confirm
   the new base selection persists;
6. edit each visible scalar field and confirm persistence after reload;
7. compare all 18 hidden metadata fields against the ledger; and
8. verify Asset locale references and all non-base locale rows remain unchanged.

Do not modify the real database directly with `sqlite3`; read-only inspection
is allowed, while migration and editing must use Core-owned command paths.

Exit:

- the real screen saves successfully;
- hidden metadata is unchanged;
- the default is durable and the single selector changes only base selection.

## Tests And Guardrails

### Core owning-layer tests

Core owns the complete behavior matrix:

- a patch changing only each supported scalar field preserves every omitted
  scalar and all locales;
- `null` clears each clearable scalar and resets Aspect Ratio to the effective
  default;
- string-array patches replace or clear only the named metadata array;
- title cannot resolve empty;
- supported/unsupported Aspect Ratio validation remains;
- zero locales and zero/multiple base locales remain invalid at runtime;
- supported tags, uniqueness, and exactly one base remain enforced;
- representative existing language operations and referenced-locale protection
  remain covered as regression behavior;
- a multi-field patch with any invalid field writes none of its fields; and
- returned `ProjectInformationResource` matches the committed aggregate.

Keep this matrix in Core. Do not repeat it in HTTP, React, CLI, and E2E tests.

### Migration tests

`migration-0074.test.ts` executes the generated SQL against focused SQLite
fixtures and proves:

- an empty table receives exactly the canonical `en-US` base row;
- valid single- and multi-locale tables are unchanged;
- non-empty tables with invalid base counts are not guessed or repaired;
- applying the migration history again does not add another row; and
- foreign-key and quick checks remain clean.

### Studio server tests

Server tests cover only adapter responsibilities:

- omitted fields and explicit nulls are preserved in the parsed patch;
- every language-operation variant is parsed without domain interpretation;
- malformed scalar/operation fields return `STUDIO_SERVER013` with issues;
- project-name mutation remains rejected;
- the exact patch is delegated once to Core; and
- Core structured errors are serialized unchanged.

### Studio browser tests

Feature/service tests cover:

- resource-to-draft projection;
- minimal scalar patch projection;
- optional-field clear projection;
- projection of the base locale into one selector;
- configured selection producing `setBase` and a new selection producing one
  base `add` operation;
- hidden non-base locales never rendering and never being removed by the draft
  projection;
- successful queue requests advancing the persisted baseline;
- a failed request retaining the draft/baseline needed for retry;
- external refresh preserving an unsaved local draft;
- `StudioApiError` retaining issues and suggestion; and
- the visible save error preferring the first actionable issue.

### CLI and integration tests

- Existing CLI Project Information tests remain the adapter-level proof that
  `renku info set`, `clear`, and language commands delegate patches to Core.
- No CLI production change is planned; language commands remain regression
  coverage for the untouched locale model.
- One representative Studio E2E journey changes the Project Language, edits a
  scalar, and reloads. It verifies the one-control UI, persistence, and resource
  refresh.

### Architecture guardrails

- TypeScript compilation protects removal of the full-update service from all
  callers.
- Existing package/import boundary rules protect Studio from Core server and
  database imports.
- Do not add source-text tests for retired function names, private helper names,
  or a fixed service inventory.
- The stable runtime guardrail is that a well-formed partial HTTP request calls
  the Core patch service and invalid final state fails before a write.

## Documentation And ADR Effects

Update:

- `docs/architecture/reference/studio-coordination-events.md` to replace the
  remaining allowance for a server-converted full form with the accepted direct
  Core patch request and replace multi-locale UI parity with one base Project
  Language selector while retaining Core/CLI multi-locale operations;
- `docs/architecture/reference/front-end-guidelines.md` examples from
  `updateProjectInformation` to `patchProjectInformation` and note that
  feature-local draft projection sends Core-owned intent;
- `docs/architecture/reference/drizzle-migrations.md` with the scope of the
  empty-locale default conversion; and
- `docs/architecture/reference/project-create-from-yaml.md` so omitted
  languages default to `en-US` and an explicitly supplied list identifies
  exactly one base locale; and
- `docs/cli/commands.md` only if contract wording incorrectly implies full
  replacement after implementation inspection.

No new ADR is required: no existing ADR establishes multi-locale Project
Details UI as a lasting product decision. The coordination reference owns this
surface contract. ADR 0005 remains current because the latest-only queue still
owns save ordering.

No Studio Skills change is required because agent-facing CLI commands and their
semantics remain unchanged.

## Final Verification

Run focused verification while implementing:

```bash
pnpm build:core
pnpm test:core
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio test:typecheck
pnpm --filter @gorenku/studio lint
```

Run the migration-history gate from `packages/core`:

```bash
pnpm drizzle-kit check --config drizzle.config.ts
```

Before real-project migration, record all Project Information columns, locale
rows, and Asset locale references read-only, then apply the migration through
the Core backup gate. After focused verification and the real-project save pass,
run root gates:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Desktop verification uses the real Project Details screen only; do not test or
report mobile behavior.

Final architecture-shape review must:

- inspect `git diff --stat` and the complete diff;
- inspect the new Core Project Information module and any heavily modified
  Studio file;
- confirm `client/index.ts`, `server/index.ts`, and
  `server/project-information/index.ts` are thin entrypoints;
- confirm the old full-update service/caller/DTO path is absent without adding
  an implementation-name architecture test;
- confirm the HTTP route contains no read/merge/domain-validation logic;
- confirm the React feature contains one locale selector, no multi-locale
  controls, no local catalog, and no locale validation;
- confirm the Core command did not become a monolithic Project god file;
- confirm the Drizzle migration changes only empty locale tables, introduces no
  schema change, and leaves Asset locale references untouched;
- confirm the existing Project Details visual cleanup has no formatting churn;
  and
- confirm no checklist item was satisfied by accepting an unreviewable file or
  catch-all helper.

## Completion Evidence

Completed on 2026-08-05.

- Core now exposes only the client-safe `ProjectInformationPatch` mutation
  contract. One focused Project Information module owns resolution, complete
  validation, dependency checks, partial persistence, locale persistence, and
  the single-session transaction. The former public full-replacement command,
  service method, DTOs, wiring, and callers were removed directly.
- Drizzle Kit generated migration `0074`, its journal entry, and its unchanged
  schema-shape snapshot. Focused migration tests prove canonical `en-US`
  insertion for an existing Project with an empty locale table, idempotence,
  non-empty-table preservation, and clean SQLite integrity checks. `drizzle-kit
  check` passes.
- Studio HTTP now parses the Core patch envelope and delegates once. The browser
  service forwards the same contract, structured Core issues survive as
  `StudioApiError`, and the Project Details feature derives minimal patches
  from a successfully persisted baseline.
- Project Details retains the cleaned desktop layout and shows exactly one
  accessible shadcn Project Language selector. Hidden locales remain a Core/CLI
  concern. The focused Playwright regression changes the language, edits
  Project Information, reloads, and passes.
- Core owning tests cover every scalar independently, every explicit clear,
  array replacement/clear behavior, locale invariants and operations,
  referenced-locale protection, and rollback of scalar writes on validation or
  dependency failure. Studio tests cover patch parsing/delegation, draft
  projection, structured errors, and persisted-baseline success/failure
  ordering.
- The supported migration gate was exercised against `urban-basilica` with a
  verified backup at
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-59-to-59-20260805T092752531Z-ddc53e.sqlite`.
  Desktop UI edits to all five visible scalars and the base language survived
  reload during the proof. The project was then restored to its original
  creative content and migrated again, leaving one canonical `en-US` base
  locale. The 18-field hidden metadata ledger hash remained
  `7eb001b43cf7221e13d5056fac6bc949dd8f032a1c8531a97727ba3531fd6b49`,
  all 90 Assets remained present with zero locale references, and foreign-key
  and quick checks remained clean.
- Final gates pass: root commands `pnpm build`, `pnpm test`, `pnpm lint`, and
  `pnpm check`; the representative desktop Playwright test; and the Drizzle
  migration history check. Lint reports only pre-existing unrelated warnings.

## Completion Checklist

### Review Area

- [x] Confirm all seven requirements remain explicit in behavior, ownership,
      tests, and completion evidence.
- [x] Confirm the implementation uses the existing Core patch concept rather
      than adding a new mutation abstraction.
- [x] Confirm centralized Core ownership did not become one monolithic
      implementation.
- [x] Confirm the final file/module shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, generic patch API, route merge, React
      validator, or runtime repair was added.
- [x] Confirm the existing Project Details design cleanup was preserved.

### Architecture And Public Contracts

- [x] Move the existing Core-owned `ProjectInformationPatch` and language
      operation declarations to the Core client boundary without changing their
      shape.
- [x] Add the supported locale catalog and canonical `en-US` default to
      `client/project-languages.ts` and consume them from creation, validation,
      and Studio.
- [x] Keep `ProjectInformationPatch` omitted/null/array semantics exactly as
      specified.
- [x] Remove `updateProjectInformation` from `ProjectDataService`, wiring, and
      package exports.
- [x] Remove `UpdateProjectInformationInput`, `ProjectInformationUpdate`, and
      `ProjectInformationLanguageUpdate` from the public server contract.
- [x] Add the Core-internal `ResolvedProjectInformation` contract without
      exposing it to adapters.
- [x] Keep all package-boundary failures structured.

### Core Implementation

- [x] Create the focused `server/project-information/` module with thin index,
      contracts, patch command, patch resolution, and validation files.
- [x] Delete `commands/update-project-information.ts` after moving only current
      behavior into the new owner.
- [x] Resolve scalar patches without changing omitted fields.
- [x] Apply explicit clears and effective Aspect Ratio reset correctly.
- [x] Retain at-least-one-locale and exactly-one-base validation.
- [x] Preserve existing language-operation and Asset dependency behavior.
- [x] Do not replace locale rows when `patch.languages` is omitted.
- [x] Perform read, merge, validation, dependency checks, and writes through
      one project session and transaction.
- [x] Return the committed `ProjectInformationResource`.
- [x] Keep database access files focused on reads/writes and free of HTTP/UI
      concerns.

### One-Way Data Conversion

- [x] Generate `0074_backfill_missing_project_base_language.sql` through
      Drizzle Kit, or use the next generated number if another migration lands
      first.
- [x] Insert the canonical default only when `project_locale` is empty.
- [x] Preserve every non-empty locale table without guessing or repairing it.
- [x] Keep the schema shape and runtime generation unchanged while retaining
      the Drizzle Kit-generated snapshot.
- [x] Verify the migration literals against the Core default/catalog.
- [x] Add no runtime fallback, migration registry, or project-open repair.

### Studio Server

- [x] Change `project-information-request.ts` to parse the Core patch, including
      every closed language operation.
- [x] Preserve omitted properties and explicit nulls.
- [x] Keep locale support, uniqueness, base, and dependency rules out of the
      request reader.
- [x] Change the route and Projects service pick to
      `patchProjectInformation`.
- [x] Keep the route to parameter/body reading, one Core call, resource keys,
      and response serialization.
- [x] Delete full-update fake service behavior and request tests.
- [x] Cover malformed HTTP input and exact patch delegation without repeating
      Core's validation matrix.

### Studio Browser And UI

- [x] Rename the browser API mutation to `patchProjectInformation`.
- [x] Delete Studio-local full-update/language DTOs and consume the Core client
      patch contract directly.
- [x] Add `project-information-draft.ts` for draft/resource/patch projection.
- [x] Emit only changed scalar fields and explicit null clears.
- [x] Replace locale rows and add/remove/base/audio/subtitle actions with one
      shadcn Project Language selector.
- [x] Emit `setBase` for a configured locale and base `add` for a new supported
      locale.
- [x] Preserve every hidden non-base locale when the selection changes.
- [x] Advance the persisted baseline after every successful queue request,
      including superseded intermediate requests.
- [x] Retain the local draft and prior baseline after failure.
- [x] Preserve external-refresh protection for unsaved drafts.
- [x] Preserve structured issue/suggestion data in `StudioApiError`.
- [x] Show the first actionable Core issue through the existing autosave status
      without adding domain logic to the hook.
- [x] Preserve the cleaned desktop layout and shadcn-only controls.

### CLI And Agent Surfaces

- [x] Keep `renku info set`, `clear`, and `language` command behavior unchanged.
- [x] Confirm the CLI continues to delegate to the sole Core patch command.
- [x] Confirm no Studio Skills changes or compatibility guidance are needed.

### Tests And Guardrails

- [x] Add the complete Core scalar preservation/clear behavior matrix.
- [x] Prove zero locales and invalid base counts still fail at Core.
- [x] Retain locale operation and dependency regression tests at Core.
- [x] Prove the custom migration adds exactly one `en-US` base only to an empty
      table and leaves every non-empty table unchanged.
- [x] Prove invalid scalar patches fail before writes.
- [x] Add Studio server envelope/delegation tests only.
- [x] Add Studio draft-to-patch and queue-baseline tests.
- [x] Add Studio structured error parsing/presentation tests.
- [x] Retain relevant CLI patch delegation tests.
- [x] Add one representative desktop E2E journey without duplicating Core's
      edge-case matrix.
- [x] Do not add source-text tests for current function/helper names or a fixed
      service inventory.

### Documentation

- [x] Update the coordination reference to require the direct patch envelope.
- [x] Document one Project Language selector while preserving backend/CLI
      multi-locale behavior.
- [x] Update frontend service examples and ownership guidance.
- [x] Document the one-way default-locale migration.
- [x] Align the create-from-YAML reference with the canonical default and
      exactly-one-base invariant without adding importer scope.
- [x] Update CLI docs only if implementation evidence finds inaccurate
      replacement wording.
- [x] Record no new ADR; leave ADR 0005 history unchanged.
- [x] Do not edit historical plans merely to replace names.

### Real Project And Final Verification

- [x] Record a read-only `urban-basilica` Project Information, locale-row, and
      Asset-locale ledger.
- [x] Apply the migration through the Core backup gate and verify its
      backup/report.
- [x] Confirm exactly one `en-US` base locale is persisted after migration.
- [x] Confirm Project Details renders one Project Language selector and no
      multi-locale management controls.
- [x] Change the selected locale, reload, and verify the new base persists.
- [x] Edit and reload each visible scalar field on the real desktop screen.
- [x] Verify all 18 omitted metadata fields remain unchanged.
- [x] Confirm hidden non-base locale rows and Asset locale references remain
      unchanged.
- [x] Run focused Core, CLI, server, Studio, typecheck, and lint commands.
- [x] Run the Drizzle migration-history check.
- [x] Run root `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [x] Inspect `git diff --stat` and the complete diff.
- [x] Inspect newly large or heavily modified files and split them before
      completion if responsibilities have accumulated.
- [x] Confirm all `index.ts` files remain thin entrypoints.
- [x] Confirm no full-update compatibility path, multi-locale UI, adapter domain
      rule, runtime repair, or schema change remains.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then change this plan's status to complete and add concise completion
      evidence.
