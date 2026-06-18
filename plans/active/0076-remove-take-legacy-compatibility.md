# 0076 Remove Take Legacy Compatibility

Status: completed
Date: 2026-06-18

## Implementation Result

Completed on 2026-06-18.

The cleanup was implemented directly without runtime compatibility shims:

- project database schema generation is `23`;
- the known project database at
  `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` was
  migrated and verified;
- development auto-migration remains enabled;
- current code, accepted architecture docs, and Studio skills no longer contain
  targeted legacy take-generation or `shotSpecs` names;
- validation passed with `pnpm build`, `pnpm check`, and package test suites.

`pnpm test` was run through the root command until the sandbox blocked CLI
localhost listener tests with `listen EPERM`. The affected CLI suite was then
rerun with localhost binding allowed and passed. The remaining package suites
were run directly and passed.

## Summary

Plan `0075` moved the product model in the right direction: a Shot Video Take
owns editable take state, selected shot membership, production setup, media
inputs, and output candidates. A follow-up audit found that the codebase still
contains compatibility behavior and residual old data-model names from the
previous "take generation" model.

This plan removes the remaining legacy behavior directly. Renku Studio is
pre-customer software, and there is one known project database:

```text
/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite
```

That database has already been structurally migrated to schema generation `22`.
It no longer contains old `scene_shot_video_take_generation*` tables, but it
still has legacy residue:

- `scene_shot_video_take.production_json` still duplicates
  `scene_shot_video_take.state_json.production`;
- `scene_shot_video_take.shot_list_id` still uses the old ambiguous column name
  instead of `source_shot_list_id`;
- nine existing take ids still use the
  `scene_shot_video_take_generation_*` prefix;
- code still accepts, validates, projects, and sometimes writes
  `SceneShot.shotSpecs`;
- UI and server paths still fall back to mutating Scene Shot List state when no
  take is open;
- normal project open can still auto-run project database migrations, and that
  behavior is intentionally retained for development convenience;
- many live APIs, filenames, variables, diagnostics, and tests still use
  "take generation" for the take workspace.

The cleanup target is not merely "rename strings." The target is one current
model:

- Scene Shot Lists own coverage history and storyboard history only.
- Shot Video Takes own editable shot design, reference selections, dialogue
  selections, production state, prompts, media inputs, and output candidates.
- Development runtime project open may auto-migrate known Studio project
  databases until a separate shipping-readiness decision replaces that
  convenience.
- Explicit `renku project migrate` remains available and must keep working.
- No runtime code reads or writes obsolete take-generation tables, columns,
  command paths, request shapes, or `SceneShot.shotSpecs`.

## Cleanup Rule

Implement the current model as if the old one never existed.

That means:

- no compatibility shims;
- no aliases for old names;
- no convenience fields that duplicate canonical state;
- no wrapper modules or re-export files to preserve old import paths;
- no fallback branches that read or write old structures;
- no targeted warnings, diagnostics, or errors for old take-generation or
  `shotSpecs` shapes in runtime code;
- no tests whose purpose is to prove an obsolete shape is rejected, warned
  about, repaired, or translated.

One-way database migrations are the only place that may mention old table names,
old column names, or old id prefixes. Even there, the migration should transform
the known development database to the current clean shape and then disappear
from runtime behavior. Current code, current tests, and accepted docs should
describe only the current model.

## Audit Method

The audit used repository searches, targeted code reads, and direct SQLite
inspection of the known project database.

Representative scans:

```bash
rg -n "take[- ]generation|takeGeneration|TakeGeneration|sceneShotVideoTakeGeneration|scene_shot_video_take_generation|--take-generation|generation take|take generation" packages docs
rg -n "shotSpecs|SceneShotWithLegacyShotSpecs|updateSceneShotListRecordDocument|view-only|read-only|fallback|compat|legacy" packages/core/src packages/cli/src packages/studio/src packages/studio/server docs/architecture
rg -n "autoMigrate|canAutoMigrate|auto migrate|auto-migrate|auto migration" packages docs
rg -n "production_json|compatibility_snapshot_json|source_shot_list_id|shot_list_id" packages/core/src/server/schema packages/core/src/server/database/access packages/core/drizzle docs/architecture
```

Known database checks:

```bash
sqlite3 /Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite \
  "PRAGMA user_version;
   SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'scene_shot_video_take%';"
```

Result:

- `PRAGMA user_version` is `22`.
- Current take tables are:
  - `scene_shot_video_take`
  - `scene_shot_video_take_shot`
  - `scene_shot_video_take_media_input`
  - `scene_shot_video_take_media_input_shot`
  - `scene_shot_video_take_output`
  - `scene_shot_video_take_output_shot`
- No old `scene_shot_video_take_generation*` tables remain.
- Current row counts are:
  - 10 takes;
  - 15 take-shot rows;
  - 0 take media inputs;
  - 0 take outputs.
- The take table still has `production_json`, `shot_list_id`, and
  `state_json`.
- The first nine take ids still start with
  `scene_shot_video_take_generation_`.
- No project files outside SQLite contain old take-generation ids or filenames.
- `media_generation_spec` and `media_generation_run` do not currently contain
  take-generation target references in this known database.

## Findings

### 1. Runtime project open auto-migration is intentional development behavior

`packages/core/src/server/database/lifecycle/store.ts` accepts `autoMigrate`
and defaults it to `true` when opening an existing project. If schema assertion
fails and `canAutoMigrateProjectStore` returns true, normal project open runs
Drizzle migrations and reopens the database.

This is not a legacy behavior to remove during development. It is an intentional
local workflow because the project is pre-customer, the database is changing
often, and the developer needs Studio/project open to keep working without a
manual migration step after every schema change.

Keep this behavior until a separate shipping-readiness plan decides how project
upgrades should work for durable customer data.

Target behavior for this plan:

- do not remove `autoMigrate`;
- do not remove `canAutoMigrateProjectStore`;
- keep normal development project open able to migrate an older valid Studio
  database to the current schema generation;
- keep `renku project migrate` as an explicit command path;
- keep invalid/non-Studio databases failing with structured project data errors;
- document the development-only exception clearly so future cleanup work does
  not remove it by accident.

### 2. The current take table still has two production owners

`packages/core/src/server/schema/scene-shot-lists.ts` still defines:

```ts
production: text('production_json').notNull()
stateJson: text('state_json').notNull()
```

`packages/core/src/server/database/access/scene-shot-video-take-generations.ts`
keeps those fields in sync on create, production update, shot membership update,
and state patch update.

That preserves old behavior:

- `production_json` was the old take-generation production owner;
- `state_json.production` is the new take-owned production owner;
- keeping both requires sync code and a validator for the old standalone
  production JSON;
- reads still project `take.production` from `production_json`, not directly
  from `state_json.production`.

Target behavior:

- `scene_shot_video_take.state_json` is the only persisted owner of take
  production state;
- remove the public `SceneShotVideoTake.production` convenience field;
- callers read production state from `SceneShotVideoTake.state.production`;
- no schema, validator, access code, or tests mention standalone
  `production_json`.

### 3. The take source shot-list column name is still ambiguous

Plan `0075` explicitly chose `source_shot_list_id` for
`scene_shot_video_take`, because a take resolves against the shot-list version it
was created from. Current schema and database still use `shot_list_id`.

Impact example:

- `shot_list_id` reads like a normal current relationship, while
  `source_shot_list_id` states the history relationship.
- The code has to explain the intended meaning in variable names and indexes
  instead of the schema carrying the contract.

Target behavior:

- table column is `source_shot_list_id`;
- Drizzle property is `sourceShotListId`;
- public client field is `sourceShotListId`;
- current read-model code uses `sourceShotListId` everywhere.

### 4. Known project data still leaks old take-generation ids

The known project database is migrated structurally, but existing rows include
ids such as:

```text
scene_shot_video_take_generation_bb3uu536
scene_shot_video_take_generation_0be7b53f3d21
```

No filesystem references were found outside SQLite, and generation specs/runs in
the known database do not currently target shot-video takes. Because this is
pre-customer software and there is one known project, we should rewrite these
ids instead of preserving a compatibility story around them.

Target behavior:

- all take ids use the current `scene_shot_video_take_*` prefix;
- all child references are updated in the same migration or explicit database
  cleanup operation;
- no code recognizes old prefixes as valid aliases.

### 5. Scene Shot Lists still accept and validate `shotSpecs`

Current `SceneShot` no longer declares `shotSpecs`, but the code keeps a
compatibility type:

```ts
export type SceneShotWithLegacyShotSpecs = SceneShot & {
  shotSpecs?: ShotSpecs;
};
```

The JSON schema still allows `shotSpecs` on scene shot-list shots. The scene
shot-list validator still performs semantic validation for legacy shot specs.
`shotContentFingerprint` still includes legacy shot specs through
`SceneShotWithLegacyShotSpecs`.

Impact example:

- an agent can still submit a Scene Shot List JSON document with `shotSpecs`;
- the validator treats that obsolete shape as accepted current data;
- shot-list fingerprints can still change because of take-tab data that should
  no longer live on the shot list;
- old shot-list mutation paths remain viable because the schema accepts the
  old field.

Target behavior:

- `SceneShot` has no `shotSpecs` field or legacy carrier type;
- Scene Shot List JSON schema does not name or model `shotSpecs`;
- runtime code does not recognize `shotSpecs` well enough to warn about,
  repair, migrate, reject by name, or translate it;
- generic current-schema validation may treat it the same as any other unknown
  field, but there must be no `shotSpecs`-specific diagnostic;
- shot-list fingerprints are based only on coverage/history fields owned by the
  Scene Shot List.

### 6. Studio still has fallback branches that write to the old owner

The clearest fallback is in `packages/studio/src/features/movie-studio/scenes/use-shot-specs.ts`:

```ts
takeId
  ? updateSceneShotVideoTakeShotSpecs(...)
  : updateSceneShotSpecs(...)
```

Reference and dialogue tabs also use fallback behavior:

- when a take exists, reference inclusion updates call take routes;
- when no take exists, they write reference inclusion to the scene shot list;
- dialogue audio selection still calls the scene-level
  `pickSceneDialogueAudioTake` path, even though take state has
  `selectedDialogueAudioTakeIds`.

Impact example:

- editing a shot before a take exists silently mutates the active Scene Shot
  List;
- creating a second take can inherit or observe values that were accidentally
  written globally;
- dialogue audio picks remain scene-global instead of take-specific.

Target behavior:

- take-owned tabs require a take;
- the UI either creates a take before enabling take-owned edits or shows a
  disabled state for take-owned controls;
- no feature code falls back from a missing take to Scene Shot List mutation;
- dialogue audio choices used by shot-video production are stored in
  `SceneShotVideoTakeState.referenceSelections.selectedDialogueAudioTakeIds`;
- scene-level `pickedTakeId` remains only for scene dialogue audio authoring,
  not for shot-video take production selection.

### 7. Take state is still converted through `ShotSpecs`

`packages/core/src/server/media-generation/shot-video-take/take-state.ts`
currently converts between `SceneShotVideoTakeShotDesign` and `ShotSpecs`.
`applyTakeStateToShot` attaches a legacy `shotSpecs` object back onto
`SceneShot` for downstream code.

Studio mirrors this with `ShotSpecsProvider`, `useShotSpecs`, and tab controls
that operate on a `ShotSpecs` object.

Impact example:

- the new state contract exists, but the working representation is still the
  old bag of fields;
- reference selection helpers still read from `shot.shotSpecs`;
- provider prompt strings are derived from a legacy carrier rather than the
  take-owned `SceneShotVideoTakeShotDesign`.

Target behavior:

- Studio tabs edit `SceneShotVideoTakeShotDesign` directly;
- core prompt labels are derived from `SceneShotVideoTakeShotDesign`;
- reference projection reads from `context.take.state`, not from a synthetic
  `shotSpecs` attached to `SceneShot`;
- no function name, request body, or helper type says `ShotSpecs` for take
  state.

### 8. "Take generation" remains as a public workspace name

Live non-test code still uses "take generation" for the take workspace in
several places:

- `packages/core/src/client/shot-video-take-generation.ts`
- `packages/core/src/server/database/access/scene-shot-video-take-generations.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-generations.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-generation-context.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-generation-production.ts`
- Studio state names such as `activeTakeGeneration`, `setTakeGenerations`, and
  `onCreateTakeGeneration`;
- UI component `SceneShotAiProductionTakeGenerationTag`;
- route/service helpers named `sendTakeGenerationMutation`;
- diagnostics that say "different take generation" or "Take generation does not
  belong to the requested scene."

Some "Generation" names are legitimate because media generation specs and runs
are real domain concepts. The cleanup rule is:

- "generation" is allowed when the object is a media generation context, spec,
  estimate, run, provider payload, or generated dependency;
- "take generation" is not allowed as a name for the take workspace, take row,
  take editor context, selected shot group, mutation response, or UI state.

Target public names:

- `SceneShotVideoTakeEditContext` for the take editor/read model.
- `SceneShotVideoTakeProductionState` for take-owned production setup.
- `ShotVideoTakeOutputGenerationSpec` for the final video generation spec.
- `ShotVideoTakeOutputGenerationPlan` for final video preflight/plan output.
- `ShotVideoTakeMediaInputGenerationSpec` for generated first-frame,
  last-frame, reference-image, and multi-shot storyboard-sheet dependencies.
- `SceneShotVideoTakeOutput` for generated/imported video candidates.

### 9. Current architecture docs still describe old surfaces

Current docs still contain old wording:

- `docs/architecture/data-model-and-storage.md` still says take generations own
  selected-shot membership.
- `docs/architecture/reference/media-generation.md` still documents
  `renku generation take create`.
- `docs/architecture/media-generation.md` still mentions "production group
  mutation" in shot-video module responsibilities.

Target behavior:

- accepted docs describe `renku take create/list/show/update`;
- accepted docs describe `SceneShotVideoTake`, `SceneShotVideoTakeOutput`, and
  `SceneShotVideoTakeMediaInput`;
- accepted docs do not mention obsolete take-generation commands or production
  groups as current behavior.

## Target State

After this plan is implemented:

- normal development project open still auto-migrates older valid Studio
  databases when `openProjectStore` uses its development default;
- unsupported or invalid databases still fail with a structured error when they
  cannot be safely recognized and migrated;
- explicit project migration still works through `renku project migrate`;
- `scene_shot_video_take` has `source_shot_list_id`, `state_json`,
  `history_snapshot_json`, `created_at`, and `updated_at`, but no
  `production_json`;
- `state_json.production` is the single source of truth for take production;
- `SceneShotVideoTake` has no duplicate `production` convenience field;
- current known project take ids use `scene_shot_video_take_*`;
- Scene Shot List documents cannot carry `shotSpecs`;
- Studio take tabs never write to Scene Shot List fallback paths;
- dialogue audio choices for shot-video generation are take-owned;
- take editor code uses `SceneShotVideoTakeShotDesign`, not `ShotSpecs`;
- all live take-workspace code names use "take," not "take generation";
- old migration files and old Drizzle snapshots may still contain historical
  names, but current schema, current snapshots, current code, current tests, and
  accepted docs do not.

## Implementation Plan

### Slice 1: Lock the current target with failing checks

Add focused tests or architecture checks that will fail until the cleanup is
complete.

Checks should scan current source and docs while explicitly excluding:

- historical Drizzle SQL migrations before the final cleanup migration;
- historical Drizzle meta snapshots before the final cleanup snapshot;
- historical plans and exploration documents;
- generated third-party output.

The checks should reject:

- `takeGeneration`, `TakeGeneration`, `take-generation`, and
  `sceneShotVideoTakeGeneration` in live workspace/take code;
- `scene_shot_video_take_generation` outside historical migrations/snapshots;
- `SceneShotWithLegacyShotSpecs`;
- `shotSpecs` in Scene Shot List schemas, validators, server routes, service
  APIs, and take-tab request bodies;
- `SceneShotVideoTake.production` as a duplicate convenience projection;
- `production_json` in current schema and live access code;
- accidental removal of development auto-migration coverage.

Keep the allowlist narrow. If a use of "generation" remains, it should be
because it is plainly a media generation spec, estimate, run, or provider
payload, not because it is a compatibility alias.

### Slice 2: Preserve development auto-migration

Update `packages/core/src/server/database/lifecycle/store.ts`:

- keep `autoMigrate` on `openProjectStore`;
- keep the default behavior that opening an existing project can auto-migrate
  when the database is a recognizable older Renku Studio database;
- keep `canAutoMigrateProjectStore` or an equivalently focused predicate that
  prevents accidental migration attempts on invalid/non-Studio databases;
- keep explicit `migrateProjectDatabase` support through `renku project
  migrate`;
- add comments or documentation only where needed to make clear that this is a
  development convenience, not a shipping upgrade policy.

Update tests:

- `packages/core/src/server/database/lifecycle/store.test.ts` should assert
  that opening an older-but-migratable Studio database auto-migrates to the
  current schema generation;
- the same test area should assert that invalid or unrecognized SQLite files do
  not auto-migrate and still fail with a structured project data error;
- `packages/core/src/server/commands/migrate-database.test.ts` should remain
  the explicit migration coverage;
- CLI tests should continue to cover `renku project migrate`.

### Slice 3: Make take schema single-owner

Before changing the schema, follow the accepted Drizzle Kit workflow in
`docs/architecture/reference/drizzle-migrations.md`.

Schema edits:

- in `packages/core/src/server/schema/scene-shot-lists.ts`, rename
  `shotListId: text('shot_list_id')` on `sceneShotVideoTakes` to
  `sourceShotListId: text('source_shot_list_id')`;
- remove `production: text('production_json').notNull()`;
- keep `historySnapshot: text('history_snapshot_json').notNull()`;
- keep the source shot-list index, renamed around `sourceShotListId`.

Migration requirements:

- generate a new Drizzle migration from `packages/core`;
- increment project store schema generation to `23`;
- set `PRAGMA user_version = 23`;
- copy no data out of `production_json`; `state_json.production` is already the
  target owner, so the migration should drop the duplicate column instead of
  preserving, comparing, or reporting old standalone production state;
- rename `shot_list_id` to `source_shot_list_id`;
- update latest Drizzle snapshot and journal through Drizzle Kit.

Because this cleanup also rewrites legacy take ids, document and add a custom
data-migration step in the same migration or in an adjacent custom migration.
The custom step should:

- build an old-id to new-id mapping for
  `scene_shot_video_take_generation_%` rows;
- fail before mutation if any mapped new id already exists;
- update child tables:
  - `scene_shot_video_take_shot.take_id`;
  - `scene_shot_video_take_media_input.take_id`;
  - `scene_shot_video_take_output.take_id`;
- update `media_generation_spec.target_id` and
  `media_generation_run.target_id` where `target_kind = 'sceneShotVideoTake'`;
- apply a text replacement to current generation spec/run JSON columns only
  where those JSON columns contain the old ids;
- update `scene_shot_video_take.id`;
- never add old-prefix lookup behavior in application code.
- never add runtime diagnostics for old id prefixes.

Known project verification after migration:

```bash
sqlite3 /Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite \
  "PRAGMA user_version;
   PRAGMA table_info(scene_shot_video_take);
   SELECT COUNT(*) FROM scene_shot_video_take WHERE id LIKE 'scene_shot_video_take_generation_%';
   SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'scene_shot_video_take_generation%';"
```

Expected:

- `user_version` is `23`;
- `source_shot_list_id` exists;
- `production_json` does not exist;
- old-prefixed take id count is `0`;
- old table count is `0`.

### Slice 4: Remove standalone production JSON from access code

Update the take record access layer:

- rename `packages/core/src/server/database/access/scene-shot-video-take-generations.ts`
  to a current take-owned name, such as
  `packages/core/src/server/database/access/scene-shot-video-takes.ts`;
- rename the current output access module
  `packages/core/src/server/database/access/shot-video-takes.ts` to something
  explicit, such as
  `packages/core/src/server/database/access/scene-shot-video-take-outputs.ts`,
  so the workspace take and output candidate are not confused;
- update imports directly; do not add re-export stubs;
- remove `parseShotVideoTakeGenerationProduction` and
  `serializeShotVideoTakeGenerationProduction`;
- remove `SceneShotVideoTake.production`;
- update every caller to read `take.state.production`;
- ensure every mutation writes only `state_json` for production changes.

Update validators:

- rename `shot-video-take-generation-json/validator.ts` to a current name, such
  as `shot-video-take-json/validator.ts`;
- keep state and history snapshot validation;
- remove standalone production JSON validation;
- update diagnostic messages to say "Shot Video Take state" or "Shot Video Take
  history snapshot."

### Slice 5: Delete Scene Shot List `shotSpecs`

Core contract cleanup:

- delete `ShotSpecs` and `SceneShotWithLegacyShotSpecs` from
  `packages/core/src/client/scene-shot-list.ts`;
- if controlled vocabulary types are still needed, keep the vocabulary ids
  under take design names, not under `ShotSpecs`;
- remove `shotSpecs` from `sceneShotSchema()` in
  `packages/core/src/client/scene-shot-list-json-schemas.ts`;
- remove `shotSpecsSchema()` as a Scene Shot List concept;
- move any reusable sub-schemas needed by take state to a take-owned schema
  section.

Server cleanup:

- remove `validateShotSpecsSemantics` and `legacyShotSpecs` from
  `packages/core/src/server/scene-shot-list-json/validator.ts`;
- remove `shotSpecs` from `shotContentFingerprint`;
- remove `updateSceneShotSpecs` and any Scene Shot List mutation whose only
  purpose is to store take-owned design or reference state;
- keep Scene Shot List operations for coverage fields such as shot title,
  narrative purpose, covered blocks, baseline cast ids, and baseline location
  ids only when they create/update the Scene Shot List document as coverage
  history, not take tab state.

Studio server cleanup:

- remove `PATCH /screenplay/scenes/:sceneId/shots/:shotId` if it only writes
  `shotSpecs`;
- remove request parser `scene-shot-specs-request.ts`;
- remove route-level fallback branches that update the Scene Shot List when a
  take id is missing.

### Slice 6: Make take shot design first-class

Public types:

- keep `SceneShotVideoTakeState`;
- keep `SceneShotVideoTakeShotDesign`;
- rename production type to `SceneShotVideoTakeProductionState`;
- add a focused request type for updating one shot design, for example:

```ts
interface UpdateSceneShotVideoTakeShotDesignInput {
  takeId: string;
  shotId: string;
  shotDesign: SceneShotVideoTakeShotDesign | null;
}
```

Core operations:

- replace `updateSceneShotVideoTakeShotSpecs` with
  `updateSceneShotVideoTakeShotDesign`;
- replace conversion through `ShotSpecs` with direct updates to
  `state.shotDesignByShotId`;
- derive prompt strings from `SceneShotVideoTakeShotDesign` through a new helper
  such as `deriveTakeShotDesignPromptStrings`;
- update reference selection helpers so they read from:
  - `state.shotDesignByShotId`;
  - `state.referenceSelections`;
  - baseline `SceneShot.castMemberIds` and `SceneShot.locationIds` only as
    default narrative scope.

Studio UI:

- rename `ShotSpecsProvider` to a take-owned design provider;
- rename `useShotSpecs` to a take-shot-design hook;
- remove the fallback save path to `updateSceneShotSpecs`;
- make take-owned tabs require `takeId`;
- update Composition, Motion, Cast, Location, Lookbook, References, and Dialogue
  controls to edit the explicit take design/reference-selection fields.

Routes and services:

- rename `/shots/:shotId/specs` to a current route such as
  `/shots/:shotId/design`;
- request body should be `{ "shotDesign": ... }`, not `{ "shotSpecs": ... }`;
- route should fail fast if the take does not own the shot id.

### Slice 7: Move dialogue audio selection into take state

Current shot-video production resolves the scene-global picked dialogue audio
take. That leaves `selectedDialogueAudioTakeIds` in take state mostly unused.

Update the shot-video take reference flow:

- add a take-owned mutation for selecting or clearing dialogue audio per
  dialogue id;
- write the selected take id to
  `state.referenceSelections.selectedDialogueAudioTakeIds[dialogueId]`;
- resolve dialogue audio references using the take-owned selection first;
- report a structured runnability diagnostic when the take-selected dialogue
  audio take no longer exists or its asset file is missing;
- stop using scene-global `pickedTakeId` for shot-video generation choices;
- keep scene-global `pickedTakeId` only for the scene dialogue audio authoring
  surface outside shot-video take production.

Update Studio:

- the Dialogue tab in a take should call the take-owned mutation;
- if there is no take, dialogue reference controls should not mutate scene-level
  picks for shot-video production;
- after mutation, refresh the take context and production plan.

### Slice 8: Rename take-workspace code directly

Rename current take-workspace names without compatibility barrels or aliases.

Suggested direct renames:

- `packages/core/src/client/shot-video-take-generation.ts` to
  `packages/core/src/client/shot-video-take.ts`;
- `ShotVideoTakeGenerationContext` to `SceneShotVideoTakeEditContext`;
- `ShotVideoTakeGenerationProduction` to
  `SceneShotVideoTakeProductionState`;
- final video spec/plan names to `ShotVideoTakeOutputGenerationSpec` and
  `ShotVideoTakeOutputGenerationPlan`;
- dependency input spec names to `ShotVideoTakeMediaInputGenerationSpec`;
- `take-generations.ts` to `takes.ts` or `take-edit-context.ts`, depending on
  the operation grouping;
- `take-generation-context.ts` to `take-edit-context.ts`;
- `take-generation-production.ts` to `take-production-state.ts`;
- UI variables such as `activeTakeGeneration` to `activeTake`;
- UI setters such as `setTakeGenerations` to `setTakes`;
- `createShotGroupDraftsFromTakeGenerations` to
  `createShotGroupDraftsFromTakes`;
- `sourceTakeGenerationId` to `sourceTakeId`;
- `mergePartnerTakeGenerationId` to `mergePartnerTakeId`;
- `SceneShotAiProductionTakeGenerationTag` to a current name such as
  `SceneShotAiProductionTakeTag`;
- `sendTakeGenerationMutation` to `sendTakeMutation`.

Do not add compatibility exports from the old filenames. Update every caller.

### Slice 9: Remove command and documentation residue

CLI/docs cleanup:

- ensure `renku take create/list/show/update` is the only take workspace command
  family;
- remove any remaining `renku generation take create` documentation;
- update `docs/architecture/data-model-and-storage.md` so it says Shot Video
  Takes own selected-shot membership and take production state;
- update `docs/architecture/reference/media-generation.md` command examples;
- update `docs/architecture/media-generation.md` to remove "production group
  mutation" wording;
- update CLI error labels from "Shot video take generation" to "Shot Video
  Take" where they refer to a take workspace.

Historical plan files should not be edited just to replace names. The current
accepted docs and current active implementation plan should carry the direction.

### Slice 10: Update tests around the new behavior only

Delete tests whose only purpose is to preserve obsolete formats or command
paths.

Do not add tests that assert old shapes produce old-name-specific warnings or
errors. If an obsolete field appears in a current JSON document, the only
acceptable behavior is whatever the generic current-schema validation does for
any unknown field.

Add or update tests for:

- runtime development project open auto-migrates a recognizable stale Studio
  database;
- runtime project open rejects invalid or unrecognized SQLite databases instead
  of trying to migrate them;
- explicit project migration still migrates a known old test database;
- take production writes only `state_json.production`;
- current schema has no `production_json`;
- current schema uses `source_shot_list_id`;
- Scene Shot List contracts, schemas, validators, tests, and projections contain
  no `shotSpecs` model;
- Studio take design autosave requires a take and sends `shotDesign`;
- take reference inclusion writes `state.referenceSelections`;
- take dialogue audio selection writes
  `state.referenceSelections.selectedDialogueAudioTakeIds`;
- changing the active Scene Shot List does not lock or rewrite an existing take;
- missing take-owned assets become resolvability/runnability diagnostics, not
  broad edit locks;
- current-model term scan passes for live source and accepted docs.

## Completion Checklist

### Review Area

- [x] Confirm this plan is the accepted follow-up to `0075`.
- [x] Confirm historical plans and old Drizzle migrations are out of scope for
      pure naming edits.
- [x] Confirm the implementation will update callers directly, with no
      re-export shims or compatibility aliases.
- [x] Confirm the known project database path before applying the migration:
      `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite`.

### Architecture And Contracts

- [x] Define the final public names for take edit context, production state,
      media input generation specs, and output generation specs.
- [x] Remove `SceneShotWithLegacyShotSpecs` from public contracts.
- [x] Remove `ShotSpecs` as a public Scene Shot List or take-tab state object.
- [x] Keep controlled vocabulary ids only under current take-shot-design names.
- [x] Update project data service contracts to use take-owned design and
      reference-selection mutations.
- [x] Remove `SceneShotVideoTake.production`; callers use
      `take.state.production`.

### Database And Migrations

- [x] Review the current Drizzle Kit migration workflow before schema changes.
- [x] Edit Drizzle schema so `scene_shot_video_take` uses
      `source_shot_list_id`.
- [x] Remove `production_json` from the current schema.
- [x] Generate the migration with Drizzle Kit.
- [x] Add the documented custom data migration for old take id prefix cleanup.
- [x] Increment runtime project store schema generation to `23`.
- [x] Set `PRAGMA user_version = 23` in the migration.
- [x] Apply the migration to the known project database.
- [x] Verify the known database has no old take-generation tables.
- [x] Verify the known database has no old-prefixed take ids.
- [x] Verify the known database has no `production_json` column.
- [x] Verify existing take state JSON remains valid.
- [x] Verify migrations are the only place that mention old table, column, or
      id-prefix names.

### Core Implementation

- [x] Keep runtime development `autoMigrate` support in project store open.
- [x] Keep explicit migration command support.
- [x] Add or keep tests proving auto-migration still works for recognizable
      older Studio databases.
- [x] Add or keep tests proving invalid/non-Studio databases do not
      auto-migrate.
- [x] Rename take workspace access modules directly.
- [x] Rename take output access modules directly.
- [x] Remove standalone production JSON parsing and serialization.
- [x] Read take production from `state_json.production`.
- [x] Remove the duplicate public `SceneShotVideoTake.production` field.
- [x] Remove Scene Shot List `shotSpecs` schema support.
- [x] Remove Scene Shot List `shotSpecs` semantic validation.
- [x] Remove `shotSpecs` from shot content fingerprints.
- [x] Do not add `shotSpecs`-specific warnings, errors, repair paths, or tests.
- [x] Replace `updateSceneShotVideoTakeShotSpecs` with
      `updateSceneShotVideoTakeShotDesign`.
- [x] Update reference selection helpers to read from take state.
- [x] Update dialogue audio reference resolution to use take-owned selection.
- [x] Update preflight diagnostics to point at take-state paths.

### CLI

- [x] Keep `renku take create/list/show/update` as the only take workspace
      command family.
- [x] Remove any remaining `renku generation take` path or docs.
- [x] Update CLI labels and suggestions that say "take generation" for a
      workspace take.
- [x] Update CLI tests to use current take ids and current command names.

### Studio Server

- [x] Remove `scene-shot-specs-request.ts`.
- [x] Rename take shot design route from `/specs` to `/design`.
- [x] Remove Scene Shot List fallback routes for take-owned tab values.
- [x] Update reference inclusion route to mutate take state directly.
- [x] Add take-owned dialogue audio selection route.
- [x] Update fake project data service to match current contracts only.

### Studio Frontend

- [x] Rename `ShotSpecsProvider` and `useShotSpecs`.
- [x] Make take-owned tabs require a take.
- [x] Remove fallback saves to `updateSceneShotSpecs`.
- [x] Send `{ shotDesign }` request bodies.
- [x] Rename take-generation UI state variables and components.
- [x] Update reference and dialogue tabs to mutate take state only.
- [x] Keep all feature controls on local shadcn UI primitives.

### Documentation

- [x] Update `docs/architecture/data-model-and-storage.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/architecture/media-generation.md`.
- [x] Document that runtime auto-migration remains an intentional development
      convenience until a separate shipping-readiness decision replaces it.
- [x] Add or update a decision note if the custom id-prefix data cleanup needs
      durable explanation beyond this plan.
- [x] Do not edit old plans solely for terminology cleanup.

### Validation And Tests

- [x] Run focused core tests for schema lifecycle, take records, production
      planning, preflight, reference selection, and dialogue audio references.
- [x] Run focused CLI tests for `take` and generation command surfaces.
- [x] Run focused Studio server and frontend tests for take routes and take tabs.
- [x] Run the current-model architecture scan.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run `pnpm check`.

### Final Verification

- [x] `rg` finds no obsolete take-workspace names in live code or accepted docs.
- [x] `rg` finds no `SceneShotWithLegacyShotSpecs` in live code.
- [x] `rg` finds no `SceneShotVideoTake.production` duplicate convenience
      projection in live code.
- [x] `rg` finds no `production_json` in current schema or access code.
- [x] Runtime development auto-migration still works for a recognizable stale
      Studio database.
- [x] Invalid/non-Studio SQLite databases still fail without attempted
      migration.
- [x] Known project opens successfully after explicit migration.
- [x] Known project take list works through `renku take list --scene <scene-id> --json`.
- [x] Studio can open an existing take after the active shot list changes.
- [x] Take-owned tab edits do not mutate `scene_shot_list.document`.
- [x] Shot-video preflight uses take-owned production, references, and dialogue
      audio choices.
