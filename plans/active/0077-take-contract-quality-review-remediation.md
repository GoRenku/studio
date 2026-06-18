# 0077 Take Contract Quality Review Remediation

Status: implemented
Date: 2026-06-18

## Summary

This plan captures the combined code-quality review of the last commit plus the
current working tree. The review used the `renku-code-quality-review` rubric and
treated the current working tree as the end state.

The earlier duplicate-production issue is fixed in the current tree:

- `scene_shot_video_take.production_json` is removed from the current schema;
- `SceneShotVideoTake.production` is removed from the public contract;
- production state is read from `SceneShotVideoTake.state.production`;
- migration `0032_remove_take_legacy.sql` drops the duplicate column.

The remaining issues are architectural contract issues around take ownership,
scene scoping, CLI automation shape, migration safety, and fail-fast request
validation.

Implemented on 2026-06-18:

- Take-scoped reads, mutations, input selection, input file serving, planning,
  estimation, and media import now carry scene ownership into core.
- Durable take reference selections are mutated through focused core commands
  with semantic validation instead of broad route-local state patches.
- Shot-video CLI generation targets use the scene plus take contract and derive
  shot membership from the take.
- Migration `0032_remove_take_legacy.sql` now preflights legacy id rewrites
  through a checked mapping table before mutating rows.
- Invalid `ShotVideoTakeInputPolicy` values are rejected through shared core
  validation before planning.

## Lead Finding That Must Not Be Downgraded

**P1: Current tree: reference-selection routes bypass core-owned validation.**

Source anchors:

- `packages/studio/server/routes/screenplay.ts:693`
- `packages/core/src/server/media-generation/shot-video-take/takes.ts:144`

This is an architectural boundary violation, not a mere route correctness bug.
The Studio server must not construct durable take-state reference-selection maps
and pass them through a broad patch API. Core owns metadata mutation rules,
semantic validation, and project relationship checks.

This boundary is hard. The implementation must not "fix" this issue by adding
more route-local validation, route-local ownership checks, or route-local state
normalization in `packages/studio/server`. The server is an HTTP adapter. It may
read route params and request bodies, pass those values to core, and serialize
the core response. It must not decide whether a character sheet belongs to a
Cast Member, whether a Location sheet belongs to a Location, whether a Lookbook
sheet is selectable for the take, whether a dialogue audio take belongs to a
dialogue, or how those facts are represented in durable take state.

This finding remains active even when the JSON shape validates and even when a
specific route happens to check the URL scene before calling the state patch.
The problem is that the HTTP adapter is still deciding how durable take
reference state is written instead of delegating that domain mutation to focused
core commands.

## Confirmed Findings To Preserve

### 1. Reference-selection routes bypass core-owned validation

Severity: P1

Primary files:

- `packages/studio/server/routes/screenplay.ts:693`
- `packages/core/src/server/media-generation/shot-video-take/takes.ts:144`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/cli/src/commands/take-command.ts`

The Studio HTTP layer directly edits durable take-state maps and then calls the
broad `updateSceneShotVideoTakeState` patch method. The affected maps include:

- `selectedCharacterSheetAssetIds`;
- `selectedLocationSheetAssetIds`;
- `selectedLocationViewIds`;
- `selectedLookbookSheetIds`;
- `selectedDialogueAudioTakeIds`;
- `dependencyInclusions`.

This violates the Renku Studio boundary that core owns metadata mutation rules
and semantic validation. The current JSON schema validates the state shape, but
it does not prove that a selected asset belongs to the cast member, location,
Lookbook, dialogue, or take context being mutated.

Concrete failure example:

- a stale browser tab posts a character-sheet `assetId` from another Cast
  Member to the current take's character-sheet selection route;
- the route writes
  `selectedCharacterSheetAssetIds[castMemberId] = assetId` into SQLite as
  valid take state because the JSON shape is structurally valid;
- later the Reference panel or preflight has to interpret broken project data
  instead of the mutation being rejected at the package boundary.

The same risk exists for the public `renku take update --file` command because
it forwards arbitrary JSON to the same broad state-patch method.

Target fix:

- replace every route-local reference-selection map edit with focused core
  commands, including:
  - `updateSceneShotVideoTakeCharacterSheetSelection`;
  - `updateSceneShotVideoTakeLocationSheetSelection`;
  - `updateSceneShotVideoTakeLocationViewSelection`;
  - `updateSceneShotVideoTakeLookbookSheetSelection`;
  - `updateSceneShotVideoTakeDialogueAudioSelection`;
  - `updateSceneShotVideoTakeReferenceInclusion`;
- those commands must validate ownership against the prepared take context
  before writing:
  - character-sheet asset belongs to the requested Cast Member;
  - location sheet asset belongs to the requested Location;
  - location view ids are valid for the selected Location sheet;
  - Lookbook sheet belongs to the active/current Lookbook context accepted for
    the take;
  - dialogue audio take belongs to the requested dialogue and scene;
  - dependency inclusion ids are known dependency ids for the prepared take
    inventory/reference context;
- invalid ids must fail with structured `PROJECT_DATA...` diagnostics, with
  locations pointing at the request field and suggestions that tell the caller
  which selection to refresh or replace;
- keep `updateSceneShotVideoTakeState` private, remove it from
  `ProjectDataService`, or narrow it so HTTP code and CLI code cannot use it as
  a generic metadata escape hatch;
- add tests proving invalid cast, location, Lookbook, dialogue, dependency, and
  off-take shot-design state cannot be persisted.

### 2. Scene-scoped take routes mutate and serve by take id without validating the URL scene first

Severity: P1

Primary files:

- `packages/studio/server/routes/screenplay.ts`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/core/src/server/media-generation/shot-video-take/takes.ts`
- `packages/core/src/server/media-generation/shot-video-take/input-selection.ts`

Several HTTP routes are nested under
`/screenplay/scenes/:sceneId/takes/:takeId`, but the route or core operation
uses only `takeId`. Some routes do not check `sceneId` at all. The shot-design
route checks after calling the mutation, which is too late.

Concrete failure example:

- a stale browser tab posts to `scene_A/takes/take_B`;
- `take_B` belongs to `scene_B`;
- core updates `take_B` because the service input carries only `takeId`;
- the route can return an error after mutation, or return a context for the
  wrong scene.

The file-serving route also receives `sceneId` and `takeId` in the URL but asks
core to resolve the file only by `inputId` and `assetFileId`.

Target fix:

- add `sceneId` or `expectedSceneId` to `ShotVideoTakeContextInput` and every
  take mutation/input/file contract;
- validate scene ownership in core before reads, mutations, plan/estimate, and
  file resolution;
- update the Studio server to pass the URL scene id through every take route;
- add tests for wrong-scene production update, shot membership update, shot
  design update, plan, estimate, input select, input clear, input delete, input
  file serving, and reference selection.

### 3. CLI shot-video commands still duplicate take-owned shot membership

Severity: P1

Primary files:

- `packages/cli/src/commands/generation-purpose-command-registry.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`
- `docs/architecture/reference/media-generation.md`
- `docs/cli/commands.md`

The current architecture documentation says shot-video generation commands
identify the scene and take:

```text
renku generation context --purpose shot.video-take --target scene:<id> --take <take-id> --json
```

The CLI parser still requires caller-supplied `--shots` for
`sceneShotVideoTake` targets, even though the take row now owns ordered shot
membership. Core immediately converts the parsed target back to a
`ShotVideoTakeContextInput` that keeps only `takeId`, so the caller-supplied
`sceneId` and `shotIds` are not enforcing the contract.

Concrete failure example:

- an agent follows the current media-generation architecture doc and omits
  `--shots`;
- the CLI rejects the command even though the take owns the shot ids;
- if the agent supplies stale `--shots`, core ignores them for context/model
  listing, creating a confusing automation contract.

Target fix:

- change shot-video CLI target parsing so take-scoped commands require
  `--target scene:<id>` and `--take <take-id>` only;
- pass the parsed scene id to core for ownership validation;
- derive shot ids from the take context in core;
- update `docs/cli/commands.md` to remove old `--shot-list`, `--shots`, and
  `--production-group` examples for take-owned shot-video commands;
- add CLI tests that current documented commands work and wrong-scene
  scene/take combinations fail.

### 4. Migration 0032 rewrites legacy take ids without a collision preflight

Severity: P2

Primary files:

- `packages/core/drizzle/0032_remove_take_legacy.sql`
- `packages/core/src/server/commands/migrate-database.test.ts`
- `plans/active/0076-remove-take-legacy-compatibility.md`

Plan 0076 required the custom id-prefix cleanup to build an old-id to new-id
mapping and fail before mutation if a mapped target id already exists. The
current migration directly applies `REPLACE(...)` updates to child rows, parent
rows, generation specs, and generation runs.

Concrete failure example:

- a database contains both `scene_shot_video_take_generation_abc` and
  `scene_shot_video_take_abc`;
- the mapped new id collides;
- the migration fails late or depends on transaction boundaries to undo
  already-attempted child rewrites;
- the failure does not clearly report the collision before mutation begins.

Target fix:

- add a custom migration preflight using a temp mapping table;
- assert no mapped new id already exists;
- assert the mapping is one-to-one;
- only then update child tables, generation records, and parent take ids;
- add a migration test for the collision failure case.

### 5. Shot-video `inputPolicy` is cast from HTTP JSON instead of validated

Severity: P2

Primary files:

- `packages/studio/server/http/scene-shot-video-take-production-request.ts`
- `packages/core/src/server/media-generation/shot-video-take/production-plan.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-inventory.ts`
- `packages/core/src/server/media-generation/dependency-inventory.ts`

The HTTP reader casts `record.inputPolicy` to `ShotVideoTakeInputPolicy`. The
dependency planner later treats only exact `regenerate` specially. Invalid
strings therefore become "not regenerate" behavior instead of structured
diagnostics.

Concrete failure example:

- a request sends `{ "inputPolicy": { "defaultMode": "reuse-ish" } }`;
- the HTTP reader accepts it;
- the planner does not see `regenerate`, so it can reuse existing selections;
- the caller gets a plausible plan for an invalid policy.

Target fix:

- add a core-owned validator for `ShotVideoTakeInputPolicy`;
- reject invalid `defaultMode` and `slotModes` values with structured
  diagnostics before planning;
- add Studio server tests for invalid policy payloads.

### 6. A live helper still uses old `GenerationContext` naming

Severity: P3

Primary file:

- `packages/core/src/server/media-generation/shot-video-take/context.ts`

`shotVideoTakeEditContextFromGenerationContext` accepts
`ShotVideoTakeProductionContext`. The helper name is a small residue from the
old take-generation wording.

Target fix:

- rename it to a current take/production-context name;
- update callers directly without adding an alias.

## Remediation Approach

Fix the P1 boundary issues before polishing lower-risk naming cleanup.

1. Tighten the take context contract around scene ownership.
2. Replace public raw state patching with focused core mutation commands.
3. Align CLI take-scoped generation commands with the current take-owned model.
4. Harden the migration id-prefix cleanup.
5. Validate `inputPolicy` as a package-boundary contract.
6. Sweep the remaining helper name.

## Completion Checklist

### Review Scope And Preservation

- [x] Preserve the confirmed duplicate-production fix as fixed, not active.
- [x] Preserve the reference-selection architecture finding as P1.
- [x] Include both architecture and correctness issues in this plan.
- [x] Re-run the code-quality review after implementation and update this plan.

### Core Contracts

- [x] Add `sceneId` or `expectedSceneId` to take read/mutation/input/file
      service inputs.
- [x] Validate scene ownership in core before every take-scoped operation.
- [x] Replace broad public take-state patching with focused mutation commands.
- [x] Add focused commands for character sheet, location sheet, location view,
      Lookbook sheet, dialogue audio, and reference inclusion updates.
- [x] Add semantic validation for every reference-selection mutation.
- [x] Restrict or remove public `updateSceneShotVideoTakeState`.
- [x] Prove no Studio server route calls `updateSceneShotVideoTakeState`.
- [x] Prove no CLI command exposes arbitrary take-state patching.
- [x] Validate `ShotVideoTakeInputPolicy` before dependency planning.

### Studio Server

- [x] Pass route `sceneId` into all take-scoped core calls.
- [x] Ensure shot-design validation happens before mutation.
- [x] Ensure input file serving validates both scene and take ownership.
- [x] Replace route-local reference-selection map assembly with focused core
      commands.
- [x] Keep route handlers as HTTP adapters only.
- [x] Do not add route-local business validation as the fix for reference
      selection ownership. The route must delegate ownership decisions to core.

### CLI And Agent Contract

- [x] Remove caller-owned `--shots` from take-scoped shot-video context/model
      commands.
- [x] Pass parsed scene id to core for take-scoped generation commands.
- [x] Derive shot ids from the take context in core.
- [x] Remove raw `renku take update --file` state patching or replace it with
      focused subcommands.
- [x] Update `docs/cli/commands.md` to the current take-owned command surface.
- [x] Add CLI tests for documented commands and wrong-scene failures.

### Migration

- [x] Replace direct id `REPLACE(...)` updates with a checked old-id/new-id
      mapping step.
- [x] Fail before mutation when a mapped id collides.
- [x] Add migration test coverage for collision failure.
- [x] Keep old-prefix references limited to the one-way migration.

### Tests

- [x] Add Studio route tests for wrong-scene production update, shot membership,
      shot design, plan, estimate, input select, input clear, input delete, and
      input file serving.
- [x] Add tests proving invalid reference selections cannot be persisted.
- [x] Add tests proving `inputPolicy` invalid values fail with structured
      diagnostics.
- [x] Add tests proving broad state-patch entry points no longer bypass core
      validation.
- [x] Run focused core, CLI, Studio server, and Studio frontend tests.
- [x] Run `pnpm build`.
- [x] Run `pnpm check`.

### Final Verification

- [x] `rg` finds no current runtime use of old take-generation helper names.
- [x] Current media-generation docs and CLI docs agree.
- [x] Current take-scoped routes fail before mutation on scene mismatch.
- [x] Current take reference selections are persisted only through core-owned
      focused commands.
- [x] Migration 0032 cannot begin id rewrites when mapped ids collide.
