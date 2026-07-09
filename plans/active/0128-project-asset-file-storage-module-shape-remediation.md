# 0128 Project Asset File Storage Module Shape Remediation

Status: completed
Date: 2026-07-08

## Summary

Plan `0127-complete-project-asset-file-storage-module.md` completed the
behavioral ownership goal: durable project asset files now flow through
`packages/core/src/server/project-asset-files/` instead of feature modules
choosing folders, copying durable files, and inserting `asset_file` rows
directly.

However, the implementation concentrated too much unrelated code in
`packages/core/src/server/project-asset-files/index.ts`. The file is currently
about 2,000 lines and mixes public contracts, write-set state, validation,
filesystem operations, durable persistence, temporary-file writes, destination
path rules, generation output placement, image-edit naming, scene hierarchy
lookup, take folder allocation, hashing, MIME inference, and large
destination/purpose switches.

That fixes one architecture boundary by creating a new internal architecture
problem. This plan remediates the module shape without changing the accepted
storage behavior from plans `0125`, `0126`, and `0127`.

The intended outcome is:

- `project-asset-files/index.ts` becomes a thin public entrypoint;
- storage ownership remains centralized in `packages/core/src/server/project-asset-files/`;
- implementation is split into focused internal modules;
- domain-specific destination logic lives in per-destination modules;
- broad switch statements are replaced by bounded typed registries;
- behavior and public contracts remain stable unless this plan explicitly names
  a contract correction;
- architecture tests prevent this module from becoming a god file again.

## Context

This plan is constrained by:

- `AGENTS.md`, especially Architecture Is A Hard Gate, Keep Code Structure
  Reviewable, No Shims, Naming Is Architecture, and No Re-Export Stubs Or
  Compatibility Barrels.
- `docs/architecture/coding-practices.md`.
- `docs/architecture/project-asset-storage-conventions.md`.
- `docs/architecture/reference/project-files-and-assets.md`.
- `plans/active/0125-project-asset-storage-conventions-and-urban-basilica-migration.md`.
- `plans/active/0126-project-asset-file-storage-module.md`.
- `plans/active/0127-complete-project-asset-file-storage-module.md`.
- `plans/PLAN_TEMPLATE.md`, especially the Architecture Shape Gate.

Current problem file:

- `packages/core/src/server/project-asset-files/index.ts`
  - about 2,000 lines;
  - exports the public API;
  - also owns private implementation for every storage destination and helper;
  - contains destination and generation-purpose switch statements that invite
    future growth in one file.

Current test file:

- `packages/core/src/server/project-asset-files/project-asset-files.test.ts`
  - focused behavior tests;
  - should be split or supplemented when destination modules are split, so test
    organization mirrors the new implementation shape.

## Architecture Shape Gate

`packages/core/src/server/project-asset-files/` continues to own durable project
asset file placement and materialization. Centralized ownership must not mean
centralized implementation.

### Public Entrypoint

`packages/core/src/server/project-asset-files/index.ts` is the only public
entrypoint for callers outside the folder.

It may contain only:

- `export type { ... } from './types.js';`
- `export { ... } from './persistence.js';`
- `export { ... } from './temporary-files.js';`
- `export { ... } from './generation-output/index.js';`
- `export { ... } from './write-set.js';`
- other direct public exports from focused internal modules.

It must not contain:

- `function` or `class` declarations;
- `node:fs`, `node:path`, `node:crypto`, database access, screenplay, cast,
  location, lookbook, or media-generation imports;
- destination-specific path rules;
- switch statements;
- filesystem side effects;
- database writes.

This is an intentional public barrel. It is allowed by the repository rule that
permits `index.ts` files as deliberate public entrypoints, but it must not be a
compatibility facade or implementation dumping ground.

### Internal Module Layout

Create this concrete internal layout:

```text
packages/core/src/server/project-asset-files/
  index.ts
  types.ts
  write-set.ts
  reference-validation.ts
  persistence.ts
  temporary-files.ts
  file-operations.ts
  path-allocation.ts
  path-guards.ts
  owner-lookups.ts
  destinations/
    registry.ts
    types.ts
    cast.ts
    location.ts
    lookbook.ts
    scene-dialogue-audio.ts
    scene-storyboard.ts
    shot-video-take.ts
    image-edit.ts
  generation-output/
    index.ts
    registry.ts
    types.ts
    cast.ts
    location.ts
    lookbook.ts
    scene-storyboard.ts
    scene-dialogue-audio.ts
    shot-video-take.ts
    image-edit.ts
    image-create.ts
```

Responsibilities:

- `types.ts`
  - public type contracts only:
    `ProjectAssetFileDestination`, `ProjectTemporaryFileDestination`,
    `PersistProjectAssetFileInput`, `ProjectAssetGenerationOutputPlacement`,
    `ProjectReferenceFileValidation`, and related public types.
- `write-set.ts`
  - `ProjectAssetFileWriteSet` state and commit/rollback helpers.
- `reference-validation.ts`
  - `validateProjectReferenceFileInput` and reference-file envelope checks.
- `persistence.ts`
  - `persistProjectAssetFile`, `persistProjectAssetFileSync`,
    `copyTakeOwnedProjectAssetFile`, `copyTakeOwnedProjectAssetFileSync`,
    `removeCopiedProjectAssetFile`, and sync/async shared persistence flow.
  - It may call destination resolvers and file operations.
  - It owns `asset_file` insertion because this folder owns durable
    materialization.
- `temporary-files.ts`
  - `writeProjectTemporaryFile` and `resolveTemporaryFileRoot`.
  - Must not insert `asset_file` rows.
- `file-operations.ts`
  - filesystem-only helpers: copy, remove, stat, hash, MIME inference, source
    file assertions.
  - Must not import database accessors.
- `path-allocation.ts`
  - collision-safe file/folder allocation helpers.
  - Must not know about Cast, Location, Lookbook, Scene, or Shot Video Take
    business rules.
- `path-guards.ts`
  - project-relative path validation, durable-prefix guardrails, path traversal
    checks.
- `owner-lookups.ts`
  - shared owner lookup helpers used by destination modules, such as reading
    Cast Member, Location, Scene hierarchy, active image source, and take storage
    records.
  - Must stay read-only.
- `destinations/*`
  - durable destination path allocation for one domain family per file.
  - Example: `destinations/cast.ts` owns Cast image and voice sample path
    derivation only.
  - Example: `destinations/scene-dialogue-audio.ts` owns
    `audio/<sequence>/<scene>/<dialogue-order-key>-<character>-<take-number>`.
  - Example: `destinations/scene-storyboard.ts` owns storyboard batch folder
    allocation and `persistSceneStoryboardShotFilesSync`.
- `destinations/registry.ts`
  - a bounded typed resolver registry keyed by
    `ProjectAssetFileDestination['kind']`.
  - It may dispatch by destination kind through the registry.
  - It must not contain destination path construction itself.
- `generation-output/*`
  - generation output placement for one purpose family per file.
  - `generation-output/registry.ts` is a bounded typed registry keyed by
    generation purpose.
  - Registry entries call focused purpose modules; the registry does not own
    path logic.

### Registry Shape

Use registries instead of growing switch statements.

Destination registry shape:

```ts
type DestinationResolver<K extends ProjectAssetFileDestination['kind']> =
  (input: DestinationResolverInput<K>) => ProjectAssetFileDestinationAllocation;

const destinationResolvers = {
  'cast.characterSheet': resolveCastCharacterSheetDestination,
  'cast.profile': resolveCastProfileDestination,
  'cast.voiceSample': resolveCastVoiceSampleDestination,
  // ...
} satisfies DestinationResolverRegistry;
```

Generation output registry shape:

```ts
type GenerationOutputResolver<P extends MediaGenerationPurpose> =
  (input: GenerationOutputResolverInput<P>) => GenerationOutputAllocation;

const generationOutputResolvers = {
  'cast.character-sheet': resolveCastCharacterSheetGenerationOutput,
  // ...
} satisfies GenerationOutputResolverRegistry;
```

The public resolver may do one small keyed lookup and call the registered
resolver. It must not accumulate branch-specific business logic.

If TypeScript makes perfect discriminated inference too noisy, prefer a small
well-tested typed adapter inside `registry.ts`; do not move path rules back into
the registry to appease the type system.

### Explicitly Forbidden Shapes

This remediation must not:

- leave `project-asset-files/index.ts` as an implementation file;
- create a new `storage.ts`, `helpers.ts`, `utils.ts`, `manager.ts`, or
  `service.ts` catch-all file that becomes the same monolith under another
  name;
- move the large destination switch into a single `destinations.ts`;
- move the large generation-purpose switch into a single
  `generation-output.ts`;
- duplicate durable path rules in purpose modules, commands, CLI, Studio UI, or
  tests;
- add compatibility exports or alias files for old internal paths;
- introduce route-local, CLI-local, React-local, or agent-local durable storage
  rules;
- weaken the 0127 architecture tests just to make the refactor easier.

### Stop Conditions

Stop and revise this plan before continuing implementation if:

- any new internal file grows past roughly 400 lines during the refactor;
- a new file owns more than one domain family without a clear shared technical
  reason;
- a registry starts containing path construction or database writes;
- `persistence.ts` starts branching by every destination or generation purpose;
- `index.ts` needs anything other than public re-exports;
- a test can pass only by importing a private implementation module from
  outside `project-asset-files/`;
- behavior is preserved but the diff creates another broad catch-all module.

The 400-line number is not a global style rule. It is a local tripwire for this
remediation because the explicit bug is a 2,000-line god file.

## Contracts

Public caller-facing contracts should remain stable:

- `ProjectAssetFileDestination`
- `ProjectTemporaryFileDestination`
- `ProjectReferenceFileValidation`
- `PersistProjectAssetFileInput`
- `ProjectAssetFileWriteSet`
- `ProjectAssetGenerationOutputPlacement`
- `validateProjectReferenceFileInput`
- `persistProjectAssetFile`
- `persistProjectAssetFileSync`
- `writeProjectTemporaryFile`
- `persistSceneStoryboardShotFilesSync`
- `resolveProjectAssetGenerationOutput`
- `resolveTemporaryFileRoot`
- `resolveShotVideoTakeMediaFolder`
- `resolveShotVideoTakeMediaFolderSync`
- `copyTakeOwnedProjectAssetFile`
- `copyTakeOwnedProjectAssetFileSync`
- `removeCopiedProjectAssetFile`
- `removeCopiedProjectAssetFileSync`
- `allocateImageEditOutputNames`

Allowed internal contract changes:

- introduce internal resolver input/output types under `destinations/types.ts`
  and `generation-output/types.ts`;
- move private helpers into focused files;
- rename private helpers when the new name is clearer;
- update tests to use public entrypoints or same-folder private helpers only
  when the helper is deliberately local to the module under test.

Disallowed contract changes:

- no public alias for old private helper locations;
- no compatibility path for the monolithic `index.ts` internals;
- no new public generic path-writing API;
- no broad public "register destination" escape hatch;
- no caller-provided durable destination folder.

## Implementation Slices

### Slice 1: Establish Public Types And Write Set Modules

Create:

- `types.ts`
- `write-set.ts`
- `path-guards.ts`

Move only the relevant public type declarations and write-set implementation.

Update `index.ts` to re-export those symbols, but do not move behavior yet.
This slice should compile with duplicated private imports removed as needed.

Acceptance:

- `index.ts` starts shrinking immediately;
- write-set tests still pass;
- no destination behavior changes.

### Slice 2: Extract File Operations And Path Allocation

Create:

- `file-operations.ts`
- `path-allocation.ts`

Move:

- copy/remove/stat/hash/MIME helpers;
- path existence checks;
- collision-safe file/folder allocation helpers.

Rules:

- `file-operations.ts` may use `node:fs`, `node:crypto`, and path guards.
- `path-allocation.ts` may check project path existence and allocate names.
- Neither file may import database accessors or domain owner accessors.

Acceptance:

- no domain-specific path strings such as `cast`, `locations`,
  `visual-language`, `storyboards`, `audio`, or `shots` appear in these files
  unless part of a test fixture string.

### Slice 3: Extract Owner Lookups

Create `owner-lookups.ts`.

Move read-only helpers:

- `requireCastMember`;
- `requireLocation`;
- `requireSceneHierarchy`;
- `readSceneShotVideoTakeStorageRecord`;
- `stableTakeNumber`;
- `imageEditSourceFile`;
- `singleActiveImageFile`.

Rules:

- this file may import read-only database accessors;
- this file must not copy files, insert rows, or allocate destination paths.

Acceptance:

- owner lookup code is read-only and domain-named;
- destination modules consume these helpers instead of duplicating lookups.

### Slice 4: Extract Durable Destination Modules

Create destination modules:

- `destinations/types.ts`
- `destinations/cast.ts`
- `destinations/location.ts`
- `destinations/lookbook.ts`
- `destinations/scene-dialogue-audio.ts`
- `destinations/scene-storyboard.ts`
- `destinations/shot-video-take.ts`
- `destinations/image-edit.ts`
- `destinations/registry.ts`

Move domain-specific durable placement logic:

- Cast character sheet/profile/voice sample roots and filename allocation;
- Location environment sheet/hero roots and filename allocation;
- Lookbook image/sheet roots and filename allocation;
- Scene Dialogue Audio root, base prefix, order-key requirement, and take
  number allocation;
- Scene Storyboard batch iteration allocation and
  `persistSceneStoryboardShotFilesSync`;
- Shot Video Take media folder resolution and role-based base names;
- Image Edit output co-location and versioned output names.

Rules:

- one domain family per destination file;
- `destinations/registry.ts` owns dispatch but not path construction;
- `persistence.ts` calls the registry rather than branching by destination;
- storage-owned batch persistence for Scene Storyboard may live in
  `destinations/scene-storyboard.ts` because it is a destination-specific
  materialization API.

Acceptance:

- no durable destination switch remains in `index.ts` or `persistence.ts`;
- adding a new destination would require a new destination module plus one
  registry entry, not editing a god file.

### Slice 5: Extract Persistence And Temporary Files

Create:

- `persistence.ts`
- `temporary-files.ts`
- `reference-validation.ts`

Move:

- `persistProjectAssetFile`;
- `persistProjectAssetFileSync`;
- `copyTakeOwnedProjectAssetFile`;
- `copyTakeOwnedProjectAssetFileSync`;
- `removeCopiedProjectAssetFile`;
- `removeCopiedProjectAssetFileSync`;
- `writeProjectTemporaryFile`;
- `resolveTemporaryFileRoot`;
- `validateProjectReferenceFileInput`.

Rules:

- persistence may insert `asset_file` rows;
- persistence must not know the path rules for every destination;
- temporary files must not insert `asset_file` rows;
- reference validation must stay focused on envelope safety and source file
  checks.

Acceptance:

- durable copy/write lifecycle remains in storage;
- write-set rollback behavior remains unchanged;
- temporary-file behavior remains unchanged.

### Slice 6: Extract Generation Output Placement

Create generation-output modules:

- `generation-output/index.ts`
- `generation-output/types.ts`
- `generation-output/cast.ts`
- `generation-output/location.ts`
- `generation-output/lookbook.ts`
- `generation-output/scene-storyboard.ts`
- `generation-output/scene-dialogue-audio.ts`
- `generation-output/shot-video-take.ts`
- `generation-output/image-edit.ts`
- `generation-output/image-create.ts`
- `generation-output/registry.ts`

Move:

- `resolveProjectAssetGenerationOutput`;
- durable generation destination allocation;
- temporary output naming;
- source project-relative path extraction from generation specs;
- media-kind and output-format hints.

Rules:

- purpose-specific generation placement lives in purpose-family modules;
- `registry.ts` dispatches by purpose but does not contain placement logic;
- Image Create remains explicit temporary output placement;
- Shot Video Take generated video name remains role-owned as `video.mp4`.

Acceptance:

- no generation-purpose switch remains in the package root;
- adding a new generation purpose requires a focused generation-output module
  plus one registry entry.

### Slice 7: Thin Public Entrypoint

Rewrite `index.ts` so it only re-exports public symbols from the focused
modules.

Rules:

- no implementation code in `index.ts`;
- no imports from outside `./...` in `index.ts`;
- no private helper exports that exist only to make internal refactoring easier.

Acceptance:

- `index.ts` is small enough to review at a glance;
- production callers continue to import from
  `../../project-asset-files/index.js`;
- no external caller imports from internal project-asset-files modules.

### Slice 8: Test Organization And Architecture Guardrails

Reorganize or supplement tests so storage module tests mirror the new shape:

- keep public behavior coverage through `project-asset-files.test.ts` if useful;
- add focused tests for destination modules where the behavior is domain-heavy:
  Cast Voice sample naming, Scene Dialogue Audio naming, Storyboard batch
  iteration, Shot Video Take folder allocation, Image Edit output names;
- add architecture tests that enforce:
  - `project-asset-files/index.ts` only re-exports from local modules;
  - `index.ts` contains no function/class declarations;
  - production code outside `project-asset-files/` still cannot insert
    `asset_file` rows directly;
  - destination registry files do not import filesystem APIs;
  - file-operation modules do not import database accessors;
  - generation-output registry files do not contain purpose-specific path
    strings.

Avoid brittle tests that list every private helper. The stable boundary is file
role and import capability, not helper names.

## Tests And Guardrails

Required focused commands:

```bash
pnpm --dir packages/core type-check
pnpm --filter @gorenku/studio-core exec vitest run src/server/project-asset-files src/server/architecture.test.ts --pool=forks --reporter=basic
pnpm --filter @gorenku/studio-core exec vitest run src/server/media-generation/purposes/cast-image.test.ts src/server/commands/cast-voice-commands.test.ts src/server/media-generation/purposes/lookbook-image.test.ts src/server/media-generation/purposes/lookbook-sheet.test.ts src/server/media-generation/purposes/location-environment-sheet.test.ts src/server/media-generation/purposes/location-hero.test.ts --pool=forks --reporter=basic
pnpm --filter @gorenku/studio-core exec vitest run src/server/media-generation/purposes/scene-dialogue-audio.test.ts src/server/media-generation/purposes/shot-video-take/imports/media-imports.test.ts src/server/media-generation/purposes/shot-video-take/persistence/takes.test.ts --pool=forks --reporter=basic
```

Required root command:

```bash
pnpm check
```

Required inspections:

```bash
wc -l packages/core/src/server/project-asset-files/*.ts \
  packages/core/src/server/project-asset-files/destinations/*.ts \
  packages/core/src/server/project-asset-files/generation-output/*.ts

rg -n "insertAssetFileRecord|copyFile|copyFileSync|hashFile\\(" \
  packages/core/src/server/media-generation \
  packages/core/src/server/commands \
  -g '*.ts'

rg -n "from 'node:fs|from 'node:crypto|insertAssetFileRecord" \
  packages/core/src/server/project-asset-files/destinations \
  packages/core/src/server/project-asset-files/generation-output \
  -g '*.ts'
```

Expected inspection results:

- no project-asset-files implementation file is a new monolith;
- `index.ts` is a thin entrypoint;
- production purpose/command modules still have no direct durable asset-file
  persistence;
- destination and generation-output modules do not own raw durable filesystem
  copy logic;
- file-operation helpers do not own database writes;
- registries do not own domain path construction.

## Documentation

Update:

- `docs/architecture/project-asset-storage-conventions.md`
  - add a short "Implementation Shape" subsection explaining that the public
    storage module is centralized but internally split by destination family and
    generation output family.
- `docs/architecture/reference/project-files-and-assets.md`
  - clarify that callers import public APIs from
    `project-asset-files/index.ts`, while destination internals are private.

Do not edit historical plans just to describe this refactor. This plan itself
records the remediation.

## Non-Goals

- Do not change durable folder conventions.
- Do not add new storage destinations.
- Do not add compatibility exports for private helper moves.
- Do not move storage rules back into commands, media-generation purpose
  modules, CLI handlers, Studio server routes, React components, or skills.
- Do not change the public CLI surface.
- Do not perform another `urban-basilica` data repair unless a verification
  check proves this refactor broke or exposed current data.
- Do not use file size as a global project rule. The line-count tripwire here
  is local to this remediation.

## Final Verification

Before marking this plan complete:

1. Run all focused commands in Tests And Guardrails.
2. Run `pnpm check`.
3. Run all required inspections.
4. Inspect `git diff --stat`.
5. Inspect every changed file under
   `packages/core/src/server/project-asset-files/`.
6. Confirm `index.ts` only contains public re-exports.
7. Confirm no new file became a broad catch-all module.
8. Confirm no registry contains destination or purpose path construction.
9. Confirm no production caller imports from project-asset-files internals.
10. Confirm behavior was not fixed by moving the monolith to a different file.

## Completion Checklist

### Review Area

- [x] Confirm this plan preserves the 0125/0126/0127 durable storage behavior.
- [x] Confirm centralized storage ownership no longer means monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.
- [x] Confirm public callers still import only from
      `project-asset-files/index.ts`.

### Architecture And Contracts

- [x] Keep public storage APIs stable unless a correction is explicitly
      documented in this plan.
- [x] Keep `index.ts` as a thin public entrypoint.
- [x] Add `types.ts` for public storage contracts.
- [x] Add `write-set.ts` for write-set state and rollback helpers.
- [x] Add `reference-validation.ts` for reference file validation.
- [x] Add `persistence.ts` for durable materialization and `asset_file`
      insertion.
- [x] Add `temporary-files.ts` for temporary writes and temporary root
      resolution.
- [x] Add `file-operations.ts` for filesystem operations only.
- [x] Add `path-allocation.ts` for collision-safe path allocation.
- [x] Add `path-guards.ts` for durable path and traversal guards.
- [x] Add `owner-lookups.ts` for read-only owner lookups.
- [x] Ensure no internal file is a compatibility re-export facade.

### Destination Modules

- [x] Add `destinations/types.ts`.
- [x] Add `destinations/registry.ts`.
- [x] Add `destinations/cast.ts`.
- [x] Add `destinations/location.ts`.
- [x] Add `destinations/lookbook.ts`.
- [x] Add `destinations/scene-dialogue-audio.ts`.
- [x] Add `destinations/scene-storyboard.ts`.
- [x] Add `destinations/shot-video-take.ts`.
- [x] Add `destinations/image-edit.ts`.
- [x] Move all durable destination path rules out of `index.ts`.
- [x] Ensure destination registry dispatches but does not construct paths.

### Generation Output Modules

- [x] Add `generation-output/types.ts`.
- [x] Add `generation-output/registry.ts`.
- [x] Add `generation-output/index.ts`.
- [x] Add generation output modules for Cast, Location, Lookbook, Scene
      Storyboard, Scene Dialogue Audio, Shot Video Take, Image Edit, and Image
      Create.
- [x] Move all generation output placement rules out of `index.ts`.
- [x] Ensure generation-output registry dispatches but does not construct paths.

### Implementation Slices

- [x] Complete Slice 1 without changing behavior.
- [x] Complete Slice 2 without domain imports in generic filesystem helpers.
- [x] Complete Slice 3 with read-only owner lookups.
- [x] Complete Slice 4 with one domain family per destination module.
- [x] Complete Slice 5 without persistence branching by every destination.
- [x] Complete Slice 6 with one purpose family per generation-output module.
- [x] Complete Slice 7 with thin `index.ts`.
- [x] Complete Slice 8 with tests and architecture guardrails.

### Tests And Guardrails

- [x] Update storage behavior tests after module split.
- [x] Add architecture tests for thin `project-asset-files/index.ts`.
- [x] Add architecture tests for forbidden imports by module role.
- [x] Add architecture tests or scans that prevent the monolith from returning.
- [x] Run focused storage and architecture tests.
- [x] Run focused media-generation purpose tests listed in this plan.
- [x] Run focused Shot Video Take import/persistence tests.
- [x] Run `pnpm --dir packages/core type-check`.
- [x] Run `pnpm check`.

### Documentation

- [x] Update project asset storage conventions with the implementation shape.
- [x] Update project files/assets reference with public entrypoint guidance.
- [x] Do not edit historical plans merely for naming sweeps.

### Final Verification

- [x] Run `wc -l` inspection for project-asset-files implementation files.
- [x] Run direct-persistence `rg` inspection for production commands/purposes.
- [x] Run forbidden-import inspections for destination and generation-output
      modules.
- [x] Review `git diff --stat`.
- [x] Manually inspect all changed project-asset-files files.
- [x] Confirm no final file violates this plan's stop conditions.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code.
- [x] Only then mark this plan complete.
