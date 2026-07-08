# 0127 Complete Project Asset File Storage Module

Status: completed
Date: 2026-07-08

## Summary

Plan `0126-project-asset-file-storage-module.md` established the correct target:
durable project asset files should be persisted through
`packages/core/src/server/project-asset-files/`, and feature/purpose modules
should not choose durable folders, copy durable files, or insert `asset_file`
rows directly.

The current implementation is a valuable partial pass, but it is not complete.
Several flows now use the storage module, while other production paths still
own durable persistence locally. There are also a few new storage-module
contract gaps that must be fixed before this work is review-ready:

- Scene Storyboard imports still allocate and copy storyboard shot files inside
  `scene-storyboard-sheet.ts`.
- Scene Dialogue Audio still stores files through a local copy helper and
  directly inserts `asset_file`.
- Cast Voice Sample attachment still copies or writes durable audio files in
  `cast-voice-commands.ts`.
- `registerAsset` still exposes a public caller-chosen durable
  `projectRelativePath`.
- Purpose-specific run paths still compute output roots and output filenames in
  several modules.
- Cleanup is not consistently scoped across "copy file, insert asset file,
  insert relationship, update selects" command flows.

This follow-up plan records the exact remaining work from the current working
tree so the implementation can resume without losing the important details.

## Current Working Tree State

The current uncommitted implementation has already added or changed these core
pieces:

- Added `packages/core/src/server/project-asset-files/index.ts`.
- Added `ProjectAssetFileDestination` with cases for Cast images, Cast voice
  samples, Location sheets/heroes, Lookbook assets, Scene Storyboard shots, Shot
  Video Take media, Scene Dialogue Audio, and Image Edit outputs.
- Added `ProjectTemporaryFileDestination`.
- Added `validateProjectReferenceFileInput`.
- Added `persistProjectAssetFile`.
- Added `resolveProjectAssetGenerationOutput`.
- Added `resolveTemporaryFileRoot`.
- Added Shot Video Take media-folder helpers:
  `resolveShotVideoTakeMediaFolder`,
  `resolveShotVideoTakeMediaFolderSync`,
  `copyTakeOwnedProjectAssetFile`,
  `copyTakeOwnedProjectAssetFileSync`,
  `removeCopiedProjectAssetFile`, and
  `removeCopiedProjectAssetFileSync`.
- Added `allocateImageEditOutputNames`.
- Added storage-specific database access in
  `packages/core/src/server/database/access/project-asset-file-storage.ts`.
- Added nullable `scene_shot_video_take.media_folder_project_relative_path` in
  `packages/core/src/server/schema/scene-shot-lists.ts`.
- Added Drizzle migration
  `packages/core/drizzle/0048_shot_video_take_media_folder.sql` and metadata
  snapshots.
- Updated `run-service.ts` so the shared media-generation runner asks the
  storage module for output placement.
- Updated `image-edit.ts` so multi-output edit names reserve
  `source-v01`, `source-v02`, and so on.
- Updated Shot Video Take media imports to validate sources before creating a
  regenerated take and to persist imported take media through the storage
  module.
- Updated take-owned media copying to call storage-module copy helpers.
- Updated Cast image import/output handling to use the storage module.
- Updated Lookbook image and sheet imports to use `persistProjectAssetFile`.
- Updated Location Environment Sheet and Location Hero imports to use
  `persistProjectAssetFile`.
- Updated docs:
  `docs/architecture/project-asset-storage-conventions.md` and
  `docs/architecture/reference/project-files-and-assets.md`.

Focused checks that were run during the partial pass:

- `pnpm --dir packages/core type-check`
- focused Image Edit and Shot Video Take import tests
- focused Cast image/lifecycle tests
- focused Location Hero and Location Environment Sheet tests
- focused core architecture test

Important verification caveat: a root `pnpm check` passed before some later
Location/Lookbook edits. It must be run again after the remaining implementation
is complete.

## Remaining Direct Durable Persistence

The remaining production direct durable persistence scan is:

```bash
rg -n "insertAssetFileRecord|copyFile|copyFileSync|hashFile\(" \
  packages/core/src/server/media-generation \
  packages/core/src/server/commands \
  packages/core/src/server/project-asset-files \
  -g '*.ts'
```

As of this plan, the production offenders outside
`project-asset-files/index.ts` are:

- `packages/core/src/server/media-generation/purposes/scene-storyboard-sheet.ts`
  - imports `insertAssetFileRecord`;
  - copies storyboard images with `fs.copyFile`;
  - computes content hashes locally;
  - inserts `asset_file` rows inside `insertImportedSceneStoryboardImages`;
  - allocates `destinationFolder` and `shot-<nn>.<ext>` paths locally.
- `packages/core/src/server/media-generation/purposes/scene-dialogue-audio.ts`
  - imports `insertAssetFileRecord`;
  - inserts an audio `asset_file` row around the generated take materialization;
  - uses `persistDialogueAudioTakeFile` to copy from a generated source file to
    `scene-dialogue-audio/<dialogueId>-<takeId>.<ext>`;
  - deletes the source file itself.
- `packages/core/src/server/commands/cast-voice-commands.ts`
  - imports `insertAssetFileRecord`;
  - copies file-based Cast Voice samples directly;
  - writes ElevenLabs-fetched provider sample bytes directly into the durable
    `cast/<handle>/voice-samples/` folder;
  - computes durable file hash locally;
  - inserts the voice sample `asset_file` row locally;
  - allocates Cast Voice sample paths with `allocateCastVoiceSamplePath`.
- `packages/core/src/server/commands/register-asset.ts`
  - imports `insertAssetFileRecord`;
  - accepts public `RegisterAssetInput.projectRelativePath`;
  - inserts an `asset_file` row for that caller-provided durable path.

Test files may continue to use low-level accessors when they are explicitly
constructing fixtures, but production code must not.

## Remaining Output Placement Drift

Several purpose-specific paths still compute output roots or output filenames
outside the storage module:

- `packages/core/src/server/media-generation/lifecycle/run-service.ts`
  currently derives `outputCount` from
  `specRecord.spec.parameterValues.num_images`. That is too narrow. The shared
  runner should pass `prepared.generation.policy.outputCount` to
  `resolveProjectAssetGenerationOutput`.
- `packages/core/src/server/media-generation/purposes/lookbook-image.ts`
  still has `resolveLookbookImageGenerationOutputPaths` returning
  `LOOKBOOK_ROOT`, plus local `outputNames`.
- `packages/core/src/server/media-generation/purposes/lookbook-sheet.ts`
  still has `resolveLookbookSheetGenerationOutputPaths` returning
  `LOOKBOOK_ROOT`, plus local `outputNames`.
- `packages/core/src/server/media-generation/purposes/location-environment-sheet.ts`
  still has `resolveLocationGenerationOutputPaths` constructing
  `locations/<handle-or-placeholder>/environment-sheets`, with a fallback
  placeholder `location`, plus local output naming.
- `packages/core/src/server/media-generation/purposes/location-hero.ts`
  still has `resolveLocationGenerationOutputPaths` constructing
  `locations/<handle-or-placeholder>/heroes`, with a fallback placeholder
  `location`, plus local output naming.
- `packages/core/src/server/media-generation/purposes/scene-storyboard-sheet.ts`
  still has `resolveSceneGenerationOutputPaths` and local storyboard sheet
  output naming.
- `packages/core/src/server/media-generation/purposes/scene-dialogue-audio.ts`
  still provides a local `outputName`.
- `packages/core/src/server/media-generation/purposes/cast-voice-sample.ts`
  still provides a local `outputName`, although shared `run-service.ts` now
  overrides output names for shared-runner purposes.
- `packages/core/src/server/media-generation/purposes/shot-video-take/provider/generation-output-paths.ts`
  resolves the take output folder through the persisted take media folder,
  which is good, but
  `packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.ts`
  still names the generated video from prompt/title text. The storage module's
  durable take-media convention expects role-based output names such as
  `video.mp4`.
- `packages/core/src/server/media-generation/purposes/image-create.ts` can
  remain temporary because generic Image Create does not have a durable owner
  destination. It should still use explicit `tmp/` placement when run through
  the shared runner.

## Contract Corrections Needed Before Finishing

### Storage Write Set

Add a rollback-aware storage write set so commands can copy/write multiple
durable files and insert several relationship rows without leaving orphaned
files if a later step fails.

Use these public server-internal names:

```ts
type ProjectAssetFileWriteSet;

function createProjectAssetFileWriteSet(input: {
  projectFolder: string;
}): ProjectAssetFileWriteSet;

function commitProjectAssetFileWriteSet(
  writeSet: ProjectAssetFileWriteSet
): void;

async function rollbackProjectAssetFileWriteSet(
  writeSet: ProjectAssetFileWriteSet
): Promise<void>;

function rollbackProjectAssetFileWriteSetSync(
  writeSet: ProjectAssetFileWriteSet
): void;
```

`persistProjectAssetFile`, `persistProjectAssetFileSync`,
`copyTakeOwnedProjectAssetFileSync`, and storyboard batch persistence should
accept an optional `writeSet`. When a destination file is created, storage
records that path in the write set. If the caller rolls the write set back,
storage removes only those recorded copied files.

The write set is not a generic path deletion API. Callers must not add
arbitrary paths to it. Only the storage module records paths that it created.

### Synchronous Durable Persistence

Add a sync variant for DB-transaction materialization:

```ts
function persistProjectAssetFileSync(input: PersistProjectAssetFileInput & {
  writeSet?: ProjectAssetFileWriteSet;
}): AssetFileRecord;
```

Use it inside synchronous SQLite transactions so these operations can be in one
transaction:

- insert `asset`;
- persist/insert `asset_file`;
- insert relationship rows;
- update selection state;
- insert purpose-specific rows such as storyboard image records or dialogue
  audio take records.

Async preparation can still happen before the transaction, but durable file
copy and `asset_file` insertion should be transaction-scoped where possible.

### Temporary File Writes

Cast Voice provider samples are fetched bytes, not an existing project-relative
source file. Do not let `cast-voice-commands.ts` write those bytes directly to
the durable voice-sample folder.

Add a storage-owned temporary write API:

```ts
async function writeProjectTemporaryFile(input: {
  projectFolder: string;
  destination: ProjectTemporaryFileDestination;
  fileNameHint: string;
  contents: Uint8Array;
}): Promise<{
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
}>;
```

Cast Voice provider sample flow should:

1. fetch bytes from ElevenLabs;
2. write them under a temporary storage destination such as
   `{ kind: 'generation.media', purpose: 'cast.voice-sample' }`;
3. probe duration from that temporary file;
4. persist the temporary file into
   `{ kind: 'cast.voiceSample', castMemberId, castVoiceId, referenceName }`
   through `persistProjectAssetFileSync`;
5. remove the temporary file after successful durable materialization.

### Destination Shape Refinements

Update the destination contract before converting the remaining callers:

```ts
type ProjectAssetFileDestination =
  | { kind: 'cast.characterSheet'; castMemberId: string; titleHint?: string }
  | { kind: 'cast.profile'; castMemberId: string; titleHint?: string }
  | {
      kind: 'cast.voiceSample';
      castMemberId: string;
      castVoiceId: string;
      referenceName: string;
    }
  | { kind: 'location.environmentSheet'; locationId: string; titleHint?: string }
  | { kind: 'location.hero'; locationId: string; heroName?: string }
  | { kind: 'visualLanguage.lookbookImage'; titleHint?: string }
  | { kind: 'visualLanguage.lookbookSheet'; titleHint?: string }
  | { kind: 'shotVideoTake.media'; takeId: string; role: ShotVideoTakeMediaRole }
  | {
      kind: 'scene.dialogueAudio';
      sceneId: string;
      dialogueId: string;
      sceneDialogueAudioId: string;
      dialogueAudioTakeId: string;
    }
  | { kind: 'image.editOutput'; sourceAssetId: string; sourceAssetFileId?: string };
```

Replace the current one-shot-at-a-time `scene.storyboardShot` destination with
a batch storyboard API instead of keeping it as a normal destination case. A
Scene Storyboard import needs one shared iteration folder for all shots in the
same import, not one folder allocation per shot.

Use this batch API:

```ts
function persistSceneStoryboardShotFilesSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet?: ProjectAssetFileWriteSet;
  sceneId: string;
  files: Array<{
    assetId: string;
    assetFileId: string;
    shotId: string;
    shotOrdinal: number;
    sourceProjectRelativePath: ProjectRelativePath;
  }>;
  now: string;
}): Array<{
  shotId: string;
  assetFile: AssetFileRecord;
}>;
```

The storage module should allocate exactly one folder:

```text
storyboards/<sequence-name>/<scene-name>/<nn>-iteration/
```

and write all files in that batch as:

```text
shot-<nn>.<ext>
```

### Scene Dialogue Audio Path Decision

Scene Dialogue Audio should stay scene/dialogue-owned in this finishing slice,
but it should not be stored in one giant flat top-level folder. Use a hierarchy
that is parallel to `shots/` and `storyboards/`, with a short top-level
`audio/` root:

```text
audio/<sequence-name>/<scene-name>/<dialogue-order-key>-<character-name>-<take-number>.<ext>
```

Example:

```text
audio/the-emporor-without-coin/the-first-patron/0100-mara-00.mp3
```

Rules:

- Scene Dialogue Audio remains scene-owned in the current data model.
- The storage module derives `<sequence-name>` and `<scene-name>` from the
  screenplay hierarchy for `sceneId`.
- `<dialogue-order-key>` is a stable persisted order key on the dialogue block,
  formatted as four digits.
- New dialogue blocks default to order-key increments of `0100`, `0200`,
  `0300`, and so on.
- Inserting a new dialogue before `0100` can allocate `0050`; inserting between
  `0100` and `0200` can allocate `0150`. Existing dialogue order keys must not
  be renumbered merely because a dialogue is inserted, deleted, edited, or
  regenerated.
- The storage module derives `<character-name>` from the dialogue speaker's
  Cast Member handle/name. If the dialogue has no cast member, use `dialogue`.
- `<take-number>` is the next unused zero-based take number for that
  scene/dialogue audio filename prefix, padded to two digits. It must not be
  derived from the opaque `scene_dialogue_audio_take.id`.
- Take-owned dialogue audio moves under `shots/<sequence>/<scene>/<take-folder>/`
  only when it is materialized as Shot Video Take-owned media.

Therefore `ProjectAssetFileDestination.scene.dialogueAudio` should map to:

```text
audio/<sequence-name>/<scene-name>/<dialogue-order-key>-<character-name>-<take-number>.<ext>
```

Do not silently move scene-owned dialogue audio into
`storyboards/<sequence>/<scene>/dialogue-audio/` in this refactor. Storyboards
are not the generic scene asset folder. Also do not store scene-owned dialogue
audio under a Shot Video Take folder until a take workflow explicitly copies or
materializes it as take-owned media.

The order key must be assigned and preserved by screenplay/dialogue editing, not
invented by the storage module from the current block index. The storage module
may fail fast if a dialogue block has no order key, because recomputing an
ordinal would make durable asset filenames unstable.

## Implementation Slices

### Slice 1: Stabilize The Storage Module Contract

Update `packages/core/src/server/project-asset-files/index.ts`:

- add `ProjectAssetFileWriteSet` and write-set commit/rollback helpers;
- add `persistProjectAssetFileSync`;
- make async `persistProjectAssetFile` optionally register copied files in a
  write set;
- add `writeProjectTemporaryFile`;
- update `cast.voiceSample` destination to require `referenceName`;
- update `scene.dialogueAudio` destination to require
  `sceneDialogueAudioId` and `dialogueAudioTakeId`;
- add or require a stable `dialogueOrderKey` on screenplay dialogue blocks
  before Scene Dialogue Audio can be materialized;
- remove normal `scene.storyboardShot` destination handling;
- add `persistSceneStoryboardShotFilesSync`;
- map scene-owned dialogue audio to the
  `audio/<sequence>/<scene>/<dialogue-order-key>-<character>-<take-number>.<ext>`
  convention;
- keep `assertDurableProjectAssetFilePath` rejecting `generated/` and
  `research/`;
- keep temporary files out of `asset_file`.

Add focused storage-module tests for:

- Cast Voice sample filename allocation from `referenceName`;
- Scene Dialogue Audio filename allocation from screenplay hierarchy, speaker
  name, stable dialogue order key, and next unused take number;
- Scene Dialogue Audio storage fails fast when the dialogue block is missing a
  stable order key;
- batch storyboard iteration allocation, proving all shots in one import share
  one `<nn>-iteration` folder;
- sync persistence inserts `asset_file` and cleans up copied bytes when an
  exception occurs later in the write set;
- temporary file writes stay under `tmp/` and are not registered as asset files;
- `generated/`, `research/`, absolute paths, and parent traversal fail as
  durable destinations.

### Slice 2: Finish Generation Output Placement

Update shared and purpose-specific generation run flows:

- In `run-service.ts`, call `resolveProjectAssetGenerationOutput` with
  `prepared.generation.policy.outputCount` instead of reading
  `parameterValues.num_images` from the raw spec.
- In `lookbook-image.ts` and `lookbook-sheet.ts`, replace local
  `resolveLookbook*GenerationOutputPaths` with storage placement, and pass
  storage-provided `outputNames` into `runGeneration`.
- In `location-environment-sheet.ts` and `location-hero.ts`, remove local
  `LOCATIONS_ROOT` output path construction and the placeholder `location`
  fallback. Missing specs or missing Location owners must fail through
  storage-owned structured errors.
- In `scene-storyboard-sheet.ts`, route temporary storyboard sheet output
  placement through
  `{ kind: 'scene.storyboardSourceSheet', sceneId }`.
- In Shot Video Take generation, use storage-provided output names for the
  target take. The output file for final generated video should be `video.mp4`
  or the collision-resolved storage equivalent, not a prompt/title slug.
- Keep Image Create as temporary output unless/until a durable owner is added.

Remove local output naming helpers that become unused after this slice.

### Slice 3: Convert Scene Storyboard Import Materialization

Update `scene-storyboard-sheet.ts`:

- delete local `copySceneStoryboardImageFiles`;
- delete local `copyStoryboardFile`;
- delete local `hashFile`;
- remove `insertAssetFileRecord` import;
- allocate asset ids and asset-file ids before persistence;
- insert `asset` rows in the transaction as before;
- call `persistSceneStoryboardShotFilesSync` once for the whole import so all
  shot images share one iteration folder;
- insert `scene_shot_storyboard_image` and scene asset relationship rows using
  the returned asset-file records;
- wrap the transaction in a `ProjectAssetFileWriteSet` and rollback the write
  set if any later row insert fails.

Regression tests:

- a multi-shot storyboard import writes exactly one iteration folder;
- shot files are named `shot-01.png`, `shot-02.png`, etc.;
- a failed relationship insert does not leave copied storyboard files behind;
- no `asset_file.project_relative_path` for storyboard images starts with
  `generated/`, `screenplay/storyboards/`, or `research/`.

### Slice 4: Convert Scene Dialogue Audio Materialization

Update `scene-dialogue-audio.ts`:

- remove `insertAssetFileRecord` import;
- remove `persistDialogueAudioTakeFile`;
- remove local copy/unlink behavior;
- route the generated source file through `persistProjectAssetFileSync` with
  destination `{ kind: 'scene.dialogueAudio', sceneId, dialogueId,
  sceneDialogueAudioId, dialogueAudioTakeId }`;
- use the scene-owned storage convention
  `audio/<sequence>/<scene>/<dialogue-order-key>-<character>-<take-number>.<ext>`;
- preserve the existing dialogue order key when dialogue text, speaker, setup,
  or generated takes change;
- assign midpoint-style order keys for newly inserted dialogue blocks rather
  than renumbering existing dialogue keys;
- keep take-owned dialogue audio movement under Shot Video Take import/copy
  flows only;
- wrap durable persistence and dialogue-audio row/relationship writes in a
  write set.

Regression tests:

- generated scene dialogue audio persists under `audio/<sequence>/<scene>/`;
- generated scene dialogue audio filenames use
  `<dialogue-order-key>-<character>-<take-number>.<ext>`;
- inserting a new dialogue before an existing dialogue does not change the
  existing dialogue's future audio filename prefix;
- missing generated source fails before inserting a dialogue-audio take;
- a DB failure after file copy cleans up the copied audio file;
- Shot Video Take planning still sees scene-owned dialogue audio references.

### Slice 5: Convert Cast Voice Sample Attachment

Update `cast-voice-commands.ts`:

- remove `insertAssetFileRecord` import;
- remove `allocateCastVoiceSamplePath`;
- remove local durable `fs.copyFile`;
- remove local durable `fs.writeFile` for ElevenLabs provider samples;
- remove local durable `hashFile`;
- route file-based samples through `persistProjectAssetFileSync` with
  `{ kind: 'cast.voiceSample', castMemberId, castVoiceId, referenceName }`;
- route ElevenLabs provider bytes through `writeProjectTemporaryFile`, probe the
  temporary file, then persist it through the same Cast Voice sample
  destination;
- keep Cast Voice registration, provider capability validation, relationship
  role, and `cast_voice` row ownership in `cast-voice-commands.ts`;
- wrap asset, asset-file, relationship, cast voice, and provider sample rows in
  one transaction plus write-set rollback.

Regression tests:

- file-based samples still land under
  `cast/<handle>/voice-samples/<sample-name>.<ext>`;
- duplicate sample names allocate a collision suffix through storage;
- ElevenLabs provider samples still land under `cast/<handle>/voice-samples/`;
- a failure after durable copy/write does not leave an orphaned sample file;
- invalid source sample paths fail before any Cast Voice row is inserted.

### Slice 6: Finish Location, Lookbook, And Cast Image Transaction Safety

The current partial conversion for Location and Lookbook imports uses
`persistProjectAssetFile`, but some flows are not transaction/cleanup safe.

Update the converted import flows to use the new sync persistence plus write
sets:

- `cast-image-common.ts`
- `lookbook-image.ts`
- `lookbook-sheet.ts`
- `location-environment-sheet.ts`
- `location-hero.ts`

Specific fixes:

- Do not insert asset/relationship/select rows in one transaction and persist
  the asset file afterward, as `location-hero.ts` currently does.
- Do not insert asset rows, then persist files, then insert relationships
  without cleanup, as `location-environment-sheet.ts` currently does.
- For each import, use a transaction and rollback the write set if any later
  relationship or selection mutation fails.
- Keep selection semantics in the domain module. The storage module only
  persists files and `asset_file` rows.

Regression tests:

- Location Hero select replacement still works;
- Location Environment Sheet imports still create flat
  `locations/<handle>/environment-sheets/<name>.<ext>` files;
- Lookbook imports still land under `visual-language/lookbook/`;
- simulated failures after file persistence clean up copied files and leave no
  orphaned asset rows.

### Slice 7: Remove Or Narrow Generic Asset Registration

The current production command is an architecture escape hatch:

- `packages/core/src/client/assets.ts` exposes
  `RegisterAssetInput.projectRelativePath`;
- `packages/core/src/server/commands/register-asset.ts` inserts
  `asset_file` directly for that path;
- `packages/cli/src/commands/asset-command.ts` exposes
  `renku asset register --file <path>`.

For this finishing slice, remove the public durable generic register command
rather than adding a compatibility wrapper.

Required changes:

- Remove `registerAsset` from `ProjectDataService` contracts and wiring.
- Remove `RegisterAssetInput` from the client public contract if no remaining
  production caller needs it.
- Remove `renku asset register` dispatch, help text, and docs.
- Keep asset reference update/list/select commands only if they operate on
  already-created domain assets.
- Replace production tests that use `projectData.registerAsset` with
  domain-specific import commands where the asset owner is known.
- For tests that only need fixture rows, add a test-only helper under
  `packages/core/src/server/testing/asset-fixture-helpers.ts`. That helper must
  not be exported through production service contracts or CLI.

If a real product workflow still needs user-created generic reference media,
do not keep `registerAsset` as-is. Add a new explicit domain command and a new
closed storage destination in a separate reviewed plan.

### Slice 8: Add Architecture Boundary Tests

Add architecture tests that protect stable boundaries without freezing private
helper names.

Tests should check:

- production files outside `packages/core/src/server/project-asset-files/`,
  `packages/core/src/server/database/access/`, migrations, and test fixtures do
  not import `../database/access/asset-files.js` or equivalent relative paths;
- media-generation purpose modules do not import durable root constants such as
  `CAST_ROOT`, `LOCATIONS_ROOT`, `STORYBOARDS_ROOT`, `SHOTS_ROOT`, or
  `VISUAL_LANGUAGE_ROOT`;
- production media-generation purpose modules and production command modules do
  not use filesystem copy operations for durable asset persistence;
- runtime source files do not create `generated/` project folders for current
  durable media paths;
- the storage module is the only production module allowed to insert new
  `asset_file` rows for durable media.

Do not make these tests brittle by listing every current allowed command or
private helper name. Prefer import-path and capability checks.

### Slice 9: Documentation Updates

Update documentation after the implementation, not before, so docs match the
actual final contract:

- `docs/architecture/project-asset-storage-conventions.md`
  - add the scene-owned Dialogue Audio folder rule explicitly:
    `audio/<sequence>/<scene>/<dialogue-order-key>-<character>-<take-number>.<ext>`;
  - document that dialogue order keys default to spaced `0100`, `0200`,
    `0300` values and are not recomputed from current scene array position;
  - explain that Shot Video Take-owned dialogue audio belongs under the take
    folder only after it becomes take-owned media;
  - document the write-set cleanup responsibility at a high level.
- `docs/architecture/reference/project-files-and-assets.md`
  - update the storage module section with the final destination cases;
  - clarify that callers do not precompute durable destination folders.
- `docs/cli/commands.md`
  - remove or update `renku asset register` documentation according to Slice 7.
- Do not edit old historical plans merely to rename old paths.
- If Studio Skills outside this repository still instruct agents to construct
  durable asset paths directly, update them in the separate writable workspace
  when available.

## Non-Goals

- Do not reintroduce `generated/media/` as a durable asset destination.
- Do not store scene-owned Dialogue Audio under `storyboards/` or a Shot Video
  Take folder in this finishing slice.
- Do not add compatibility aliases for old paths, old register commands, or old
  destination shapes.
- Do not infer domain ownership from folder segments.
- Do not make the storage module decide relationship roles, selected asset
  state, Cast Voice provider capability rules, or storyboard/take business
  semantics.
- Do not parse or validate AI artifact contents.
- Do not add source-text architecture tests that hard-code private helper names
  or full service inventories.

## Final Verification Commands

Run these before calling 0126/0127 complete:

```bash
pnpm --dir packages/core type-check
pnpm --filter @gorenku/studio-core exec vitest run src/server/project-asset-files src/server/architecture.test.ts --pool=forks --reporter=basic
pnpm --filter @gorenku/studio-core exec vitest run src/server/media-generation/purposes/cast-image.test.ts src/server/commands/cast-voice-commands.test.ts src/server/media-generation/purposes/lookbook-image.test.ts src/server/media-generation/purposes/lookbook-sheet.test.ts src/server/media-generation/purposes/location-environment-sheet.test.ts src/server/media-generation/purposes/location-hero.test.ts --pool=forks --reporter=basic
pnpm --filter @gorenku/studio-core exec vitest run src/server/media-generation/purposes/scene-storyboard-sheet.test.ts src/server/media-generation/purposes/scene-dialogue-audio.test.ts src/server/media-generation/purposes/shot-video-take/imports/media-imports.test.ts src/server/media-generation/purposes/shot-video-take/persistence/takes.test.ts --pool=forks --reporter=basic
pnpm check
```

Also run these inspections:

```bash
rg -n "insertAssetFileRecord|copyFile|copyFileSync|hashFile\(" \
  packages/core/src/server/media-generation \
  packages/core/src/server/commands \
  -g '*.ts'

rg -n "LOCATIONS_ROOT|LOOKBOOK_ROOT|CAST_ROOT|STORYBOARDS_ROOT|SHOTS_ROOT|VISUAL_LANGUAGE_ROOT|joinProjectRelativePath" \
  packages/core/src/server/media-generation/purposes \
  packages/core/src/server/commands \
  -g '*.ts'

rg -n "generated/media|screenplay/storyboards|scene-dialogue-audio/" \
  packages/core/src/server \
  docs \
  -g '*.ts' \
  -g '*.md'
```

The first inspection should have no production offenders outside the storage
module. The second should show only temporary/reference path usage or modules
where path construction is not durable asset-file persistence. The third should
be manually reviewed so current docs/tests do not keep stale durable asset
instructions.

Finally, verify the real project database:

```bash
sqlite3 /Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite \
  "select id, project_relative_path from asset_file where project_relative_path like 'generated/%' or project_relative_path like 'research/%' or project_relative_path like 'screenplay/storyboards/%';"
```

Expected result: no rows.

## Completion Checklist

Completion note, 2026-07-08: checklist reviewed after implementation. The
storage module owns the remaining durable file materialization paths, focused
tests and root checks passed, production direct-persistence scans are clean, and
the `urban-basilica` project database no longer has asset files under
`generated/`, `research/`, or `screenplay/storyboards/`.

### Review Area

- [ ] Confirm this follow-up preserves the accepted 0125 folder convention.
- [ ] Confirm Scene Dialogue Audio remains scene-owned under
      `audio/<sequence>/<scene>/`.
- [ ] Confirm Scene Dialogue Audio filenames use
      `<dialogue-order-key>-<character>-<take-number>.<ext>`.
- [ ] Confirm dialogue order keys use spaced stable numbering such as `0100`,
      `0200`, and `0300`, with midpoint insertions such as `0050` or `0150`.
- [ ] Confirm existing dialogue order keys are not renumbered merely because a
      dialogue is inserted, deleted, edited, or regenerated.
- [ ] Confirm Shot Video Take-owned dialogue audio remains take-owned under
      `shots/<sequence>/<scene>/<take-folder>/`.
- [ ] Confirm no caller outside the storage module can choose an arbitrary
      durable destination path.
- [ ] Confirm no temporary file API inserts `asset_file` rows.
- [ ] Confirm storage write sets can only roll back files created by storage.
- [ ] Confirm `registerAsset` is removed or replaced by explicit domain-owned
      commands, with no compatibility path.

### Storage Module Contracts

- [ ] Add `ProjectAssetFileWriteSet`.
- [ ] Add `createProjectAssetFileWriteSet`.
- [ ] Add `commitProjectAssetFileWriteSet`.
- [ ] Add async and sync rollback helpers for write sets.
- [ ] Add `persistProjectAssetFileSync`.
- [ ] Add `writeProjectTemporaryFile`.
- [ ] Update `cast.voiceSample` destination to require `referenceName`.
- [ ] Update `scene.dialogueAudio` destination to require
      `sceneDialogueAudioId` and `dialogueAudioTakeId`.
- [ ] Add or require stable `dialogueOrderKey` values on screenplay dialogue
      blocks before Scene Dialogue Audio materialization.
- [ ] Ensure screenplay/dialogue editing preserves existing `dialogueOrderKey`
      values across text edits, speaker edits, insertions, deletions, and audio
      regeneration.
- [ ] Remove normal `scene.storyboardShot` destination handling.
- [ ] Add `persistSceneStoryboardShotFilesSync`.
- [ ] Keep `generated/` and `research/` destination guardrails.
- [ ] Keep path traversal and absolute-path protections.

### Generation Output Placement

- [ ] Change shared `run-service.ts` to use
      `prepared.generation.policy.outputCount`.
- [ ] Replace Lookbook Image output root and output name helpers.
- [ ] Replace Lookbook Sheet output root and output name helpers.
- [ ] Replace Location Environment Sheet output root and output name helpers.
- [ ] Replace Location Hero output root and output name helpers.
- [ ] Remove Location placeholder folder fallback `location`.
- [ ] Replace Scene Storyboard temporary sheet output placement.
- [ ] Replace Scene Dialogue Audio output placement where applicable.
- [ ] Replace Shot Video Take generated video output name with storage-owned
      role-based naming.
- [ ] Keep Image Create temporary and explicit.

### Import And Materialization Flows

- [ ] Convert Scene Storyboard image imports to batch storage persistence.
- [ ] Convert Scene Dialogue Audio take persistence to storage persistence.
- [ ] Convert file-based Cast Voice sample attachment to storage persistence.
- [ ] Convert ElevenLabs provider sample attachment through temporary file plus
      storage persistence.
- [ ] Update Cast image imports to use write-set rollback.
- [ ] Update Lookbook image imports to use write-set rollback.
- [ ] Update Lookbook sheet imports to use write-set rollback.
- [ ] Update Location Environment Sheet imports to use write-set rollback.
- [ ] Update Location Hero imports to use write-set rollback.
- [ ] Ensure Shot Video Take take-owned media copy uses write-set rollback for
      multi-step transactions.

### Generic Asset Registration

- [ ] Remove `RegisterAssetInput.projectRelativePath` from production public
      contracts, or remove `RegisterAssetInput` entirely.
- [ ] Remove `registerAsset` from `ProjectDataService` wiring/contracts.
- [ ] Remove `renku asset register` CLI dispatch and help text.
- [ ] Update production tests to use domain-specific import commands.
- [ ] Add test-only fixture helpers only where needed.
- [ ] Verify no production code imports `commands/register-asset.ts`.

### Tests

- [ ] Add storage-module unit tests for every remaining destination case.
- [ ] Add temporary file write tests.
- [ ] Add write-set rollback tests.
- [ ] Add storyboard batch iteration tests.
- [ ] Add Scene Dialogue Audio storage path tests.
- [ ] Add Cast Voice sample storage path and provider-byte tests.
- [ ] Add output placement tests for Lookbook, Location, Storyboard, Dialogue
      Audio, Shot Video Take, and shared-runner output counts.
- [ ] Add failed-import cleanup tests for storyboard, dialogue audio, cast voice,
      location hero, and location sheet.
- [ ] Add architecture tests for direct asset-file accessor imports.
- [ ] Add architecture tests for durable root constant imports in purpose
      modules.
- [ ] Add architecture tests for durable filesystem copy operations outside
      storage.

### Documentation

- [ ] Update project asset storage conventions with final Scene Dialogue Audio
      wording.
- [ ] Update project files/assets reference with final storage-module contract.
- [ ] Update CLI docs after removing or replacing `asset register`.
- [ ] Do not edit historical plans for naming sweeps.
- [ ] Note any separate Studio Skills update that must happen outside this
      repository.

### Final Verification

- [ ] Run `pnpm --dir packages/core type-check`.
- [ ] Run focused storage-module and architecture tests.
- [ ] Run focused media-generation purpose tests listed in this plan.
- [ ] Run focused Shot Video Take import/persistence tests.
- [ ] Run root `pnpm check`.
- [ ] Run the direct-persistence `rg` inspection and resolve all production
      offenders.
- [ ] Run the durable-root/import `rg` inspection and resolve all production
      offenders.
- [ ] Query `/Users/keremk/renku-movies/urban-basilica` SQLite asset files and
      confirm no active rows remain under forbidden durable prefixes.
- [ ] Only then mark `0126` and this follow-up complete.
