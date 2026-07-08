# 0126 Project Asset File Storage Module

Status: completed
Date: 2026-07-08

## Summary

Plan `0125-project-asset-storage-conventions-and-urban-basilica-migration.md`
correctly established the product rule that durable asset files live beside the
domain object that owns them. Its implementation, however, changed many purpose
modules, lifecycle modules, import helpers, ownership repair code, tests, and
docs. That spread is an architecture smell: the storage convention is now
documented centrally, but the runtime responsibility for choosing paths,
copying files, naming generation outputs, and registering `asset_file` rows is
still distributed across the media-generation purpose tree.

This plan centralizes project asset file persistence into one core-owned server
module with focused APIs. Purpose modules should say what asset they are
creating and which domain object owns it. The storage module should be the only
runtime code that decides where durable asset bytes are persisted in the
project filesystem.

This is not a compatibility plan. The current post-0125 storage convention
remains the target behavior. The work here is to move the responsibility behind
a better boundary and remove local path decisions.

## Investigation Findings

The current uncommitted implementation proves the new folder convention, but it
does not yet prove the desired ownership boundary.

Evidence from the diff:

- `git diff --stat` shows 36 changed files, with roughly 979 insertions and 490
  deletions, for a change whose central rule is "where do project asset files
  live?"
- `packages/core/src/server/files/asset-paths.ts` now exposes useful path
  primitives such as `CAST_ROOT`, `LOCATIONS_ROOT`, `STORYBOARDS_ROOT`,
  `SHOTS_ROOT`, `PROJECT_TMP_ROOT`, kebab-case helpers, versioned filename
  allocation, storyboard iteration allocation, and take folder construction.
  These are still primitives rather than an asset-file persistence API.
- Generation output roots are selected in more than one place:
  `packages/core/src/server/media-generation/lifecycle/run-service.ts` now has
  a purpose switch for shared generation output roots, while several purpose
  modules still have local `resolve*GenerationOutputPaths` functions.
- Purpose modules still allocate destination paths and copy files locally. Current
  examples include Cast images, Lookbook images and sheets, Location Environment
  Sheets, Location Heroes, Scene Storyboards, Scene Dialogue Audio, Shot Video
  Take imports, and take-owned media copying.
- Some path decisions fail soft instead of fail fast. For example, local output
  root resolvers can fall back to placeholder path segments such as `cast` or
  `location` when the target cannot be resolved. That creates a plausible path
  for invalid state instead of reporting the missing owner.
- There are now overlapping allocation helpers with similar names in
  `packages/core/src/server/files/asset-paths.ts` and
  `packages/core/src/server/visual-language-paths.ts`.
- `insertAssetFileRecord` now rejects `generated/` and `research/`, which is a
  good final invariant, but it is late in the call chain. Callers can still
  decide arbitrary destinations until the database accessor catches a forbidden
  prefix.
- `registerAsset` still accepts a caller-provided `projectRelativePath` and
  inserts an `asset_file` row for that path. That is a broad escape hatch unless
  it is narrowed or routed through the same owner-aware storage module.
- Review found three correctness bugs in the current implementation that this
  refactor must fix, not merely make prettier:
  - Shot Video Take media folders are recomputed from the active take list and
    mutable take title, so discarding or renaming takes can make future writes
    target a different folder.
  - Shot Video Take imports can create an iteration/regenerated take before the
    import source has been proven readable and copyable, leaving partial take
    records and copied owned inputs after a failed import.
  - Multi-output `image.edit` generation allocates names from modified basenames
    such as `source-01.png`, bypassing the accepted `source-vNN.png` versioning
    convention.

The issue is not that 0125 changed many call sites once. The issue is that new
asset-file destinations will continue to require edits across unrelated
purpose modules unless the destination contract is centralized.

## Target Architecture

Add a core server module:

```text
packages/core/src/server/project-asset-files/
```

This module owns durable project asset file persistence.

It owns:

- destination folder and filename allocation for durable asset files;
- generation output roots and output filenames when outputs are intended to
  become current durable assets;
- temporary output roots for project-visible generation staging, such as
  `tmp/media/`;
- source file validation for imports and one-off generation reference files;
- copying or moving source files into durable owner folders;
- file stat, MIME type, content hash, and project-boundary checks;
- `asset_file.project_relative_path` insertion and update behavior;
- cleanup of copied files when a later persistence step fails;
- final runtime guardrails for `generated/`, `research/`, and parent traversal;
- take-owned media deep-copy behavior;
- stable Shot Video Take media folder allocation and persistence;
- image-edit version suffix allocation;
- storyboard iteration folder and shot-image path allocation.

It does not own:

- whether a Cast Member, Location, Scene, Shot, Take, Lookbook, or Cast Voice
  exists;
- asset type selection;
- asset titles, descriptions, origin, availability, and selection state;
- relationship rows, sort order, take/select semantics, and Studio resource
  invalidation;
- provider payload semantics;
- prompt or generated artifact content validation.

The domain/purpose module remains responsible for the product decision:

```text
"Create a Location Hero asset for location loc_123 and select it."
```

The asset-file storage module becomes responsible for the filesystem decision:

```text
"Persist the primary image file at locations/<handle>/heroes/hero-v01.png and
register that destination as the asset file."
```

## Public Module Interfaces

The module should expose focused server-internal APIs. It must not expose a
generic "write this file under this arbitrary parent folder" function to callers
outside the module.

### Durable Destination Contract

Use a closed destination contract that names current product owners rather than
filesystem folders:

```ts
type ProjectAssetFileDestination =
  | { kind: 'cast.characterSheet'; castMemberId: string; titleHint?: string }
  | { kind: 'cast.profile'; castMemberId: string; titleHint?: string }
  | { kind: 'cast.voiceSample'; castMemberId: string; castVoiceId: string }
  | { kind: 'location.environmentSheet'; locationId: string; titleHint?: string }
  | { kind: 'location.hero'; locationId: string; heroName?: string }
  | { kind: 'visualLanguage.lookbookImage'; titleHint?: string }
  | { kind: 'visualLanguage.lookbookSheet'; titleHint?: string }
  | { kind: 'scene.storyboardShot'; sceneId: string; shotOrdinal: number }
  | { kind: 'shotVideoTake.media'; takeId: string; role: ShotVideoTakeMediaRole }
  | { kind: 'scene.dialogueAudio'; sceneId: string; dialogueId: string }
  | { kind: 'image.editOutput'; sourceAssetId: string; sourceAssetFileId?: string };
```

These TypeScript names are the proposed public contract for the refactor. The
shape must stay closed, owner-aware, and unable to carry arbitrary path
segments. If a new asset owner appears, the storage module gets a new explicit
destination case.

Shot Video Take destinations must resolve through a persisted take media folder.
Add current storage metadata to `scene_shot_video_take` using the Drizzle Kit
workflow documented in `docs/architecture/drizzle-migrations.md`:

```text
scene_shot_video_take.media_folder_project_relative_path
```

Use the TypeScript property name `mediaFolderProjectRelativePath` inside server
record shapes. This value is allocated once when the take is created or, for an
existing take that has no media yet, before its first take-owned media write.
After it is stored, all take-owned media, generation output roots, iteration
copies, and cleanup code reuse the stored folder. Runtime code must not
recompute a take folder from the current active take list, mutable take title,
or discarded-take-filtered ordering.

### Persisting An Asset File

The main durable-file operation should look conceptually like:

```ts
persistProjectAssetFile({
  session,
  projectFolder,
  assetId,
  assetFileId,
  sourceProjectRelativePath,
  destination,
  fileRole,
  mediaKind,
  mimeType,
  now,
});
```

Expected behavior:

- normalize and validate the source project-relative path;
- allow sources in `tmp/`, `research/`, owner folders, or other valid project
  paths;
- resolve the destination from the owner-aware destination contract;
- allocate collisions according to the accepted convention;
- create parent folders;
- copy the file if source and destination differ;
- stat and hash the persisted destination file;
- insert the `asset_file` row with the destination path;
- clean up the copied destination if the operation fails after the copy;
- return the inserted asset-file record or a public-safe file summary.

Domain code may still insert `asset` and relationship rows in the same command
flow, but it must not insert `asset_file` rows directly.

For commands that may create additional durable domain state before importing a
file, such as Shot Video Take regeneration, source validation must run before
the take or iteration is created. If the command must copy existing take-owned
inputs into a new take, that copy and all database mutations must be covered by
one transaction/cleanup unit so a failed source copy, asset insert, asset-file
insert, or relationship insert cannot leave a partial take behind.

### Generation Output Locations

Generation execution should ask the module for output placement:

```ts
resolveProjectAssetGenerationOutput({
  session,
  projectFolder,
  specRecord,
  outputCount,
});
```

The response should contain:

```ts
{
  projectRelativeRoot: ProjectRelativePath;
  absoluteRoot: string;
  outputNames: string[];
  persistenceIntent:
    | { kind: 'temporary' }
    | { kind: 'durableAsset'; destination: ProjectAssetFileDestination };
}
```

Purpose code should no longer build output roots with `joinProjectRelativePath`
or make local decisions such as `locations/<handle>/heroes`. Provider payload
builders can still decide provider-specific parameters, but output filenames
for durable assets come from the storage module.

`image.edit` output names must be allocated as versions of the source basename
for every output in the request. Editing `source.png` with `num_images = 2`
must reserve names such as `source-v01.png` and `source-v02.png`, not
`source-01.png` and `source-02.png`. Multi-output allocation must reserve all
candidate names in one call so the second generated output cannot reuse the
first name merely because the first file has not been written yet.

### Temporary Project Files

Temporary files should use a separate explicit contract:

```ts
type ProjectTemporaryFileDestination =
  | { kind: 'generation.media'; purpose: MediaGenerationPurpose }
  | { kind: 'generation.spec' }
  | { kind: 'generation.receipt' }
  | { kind: 'operation' }
  | { kind: 'qa' }
  | { kind: 'scratch' }
  | { kind: 'scene.storyboardSourceSheet'; sceneId: string };
```

Temporary output APIs may allocate under `tmp/` or
`storyboards/<sequence>/<scene>/tmp/`, but they must never insert `asset_file`
rows.

### One-Off Reference Files

One-off generation references should be validated through the same module as
source files:

```ts
validateProjectReferenceFileInput({
  projectFolder,
  projectRelativePath,
  mediaKind,
  role,
});
```

This keeps `research/` handling consistent:

- a `research/` file can be a source or one-off reference input;
- a `research/` file cannot be a durable registered asset file;
- importing from `research/` copies to the owner folder before registration.

## Implementation Slices

### Slice 1: Introduce The Module Without Behavior Changes

Create `packages/core/src/server/project-asset-files/` with tests that encode
the current accepted 0125 conventions.

Move low-level storage-only helpers behind the module boundary:

- kebab-case path segment creation;
- extension normalization;
- collision allocation;
- project path existence checks;
- file stat and content hash helpers;
- source path validation;
- durable path guardrails.

Keep non-asset Visual Language Inspiration folder behavior separate. Inspiration
folder images are plain project files, not asset files, so they should not be
forced through durable asset-file persistence.

### Slice 2: Centralize Generation Output Roots And Names

Replace the shared generation output switch in `run-service.ts` and the local
purpose-specific `resolve*GenerationOutputPaths` functions with calls into
`resolveProjectAssetGenerationOutput`.

Requirements:

- no local purpose module builds canonical folders such as `cast/`,
  `locations/`, `storyboards/`, `shots/`, or `visual-language/lookbook/`;
- missing Cast Member, Location, Scene, Take, source asset, or source file data
  fails with structured errors;
- no placeholder folder segments such as `cast` or `location` are used as
  fallbacks;
- durable output names for Location Heroes, Location Environment Sheets,
  image edits, storyboard shots, and take-owned media come from the storage
  module;
- Shot Video Take output roots use the persisted
  `mediaFolderProjectRelativePath` for the target take;
- multi-output image edits reserve sequential `-v<nn>` names from the original
  source basename;
- temporary outputs use explicit `tmp/` or storyboard-temp destinations.

### Slice 3: Centralize Import Materialization

Update current import flows to create `asset` and relationship rows as before,
but call `persistProjectAssetFile` for file persistence.

Affected flows:

- Cast Character Sheet import;
- Cast Profile import;
- Cast Voice Sample attachment and generated voice sample persistence;
- Lookbook Image import;
- Lookbook Sheet import;
- Location Environment Sheet import;
- Location Hero import;
- Scene Storyboard image import;
- Scene Dialogue Audio take persistence;
- Shot Video Take input import;
- Shot Video Take final video import;
- Image Edit output import.

After this slice, feature code should not call `fs.copyFile`,
`fs.copyFileSync`, `fs.mkdir`, `fs.mkdirSync`, `hashFile`, or
`insertAssetFileRecord` for durable asset files.

Shot Video Take imports need an additional ordering guarantee:

- validate `sourceProjectRelativePath` before calling
  `continueSceneShotVideoTakeIteration` or creating a regenerated take;
- create the iteration/regenerated take, copied owned inputs, imported asset,
  asset file, video/input rows, and relationship rows inside one database
  transaction where possible;
- track every file copied during the command and remove those copied files if a
  later database or filesystem step fails;
- add a regression test where a missing final video source does not create a new
  regenerated take and does not leave copied take-owned input files behind.

### Slice 4: Centralize Take-Owned Media Copy And Cleanup

Move take-owned media copying out of
`media-generation/purposes/shot-video-take/ownership/`.

The storage module should own:

- allocating and storing `mediaFolderProjectRelativePath` once per take;
- resolving the target take folder from the persisted take storage metadata;
- allocating role-specific filenames such as `first-frame.png`,
  `video-prompt-sheet.png`, `reference-image-01.png`, and `video.mp4`;
- copying selected take-owned files into a new take folder;
- creating the new `asset_file` rows for copied files;
- removing copied files on rollback.

The take media folder number must be stable. It may be allocated from the
current scene-local folders and active take-owned asset paths when the folder is
first created, but once persisted it must survive later title edits, take
discarding, reordered lists, or regenerated-take creation. Existing development
data should be transformed by the current migration/repair path, not handled by
a runtime compatibility fallback.

Do not validate deletions with a broad `startsWith('shots/')` check. The caller
should delete only files returned by the storage module or files proven by
current asset-file metadata to belong to the take-owned destination being
cleaned up.

### Slice 5: Narrow Generic Asset Registration

Remove or narrow `registerAsset` so it cannot register a caller-provided
durable `projectRelativePath` directly.

Acceptable end states:

- delete the generic command if current domain-specific import commands cover
  active use cases;
- or change it to require a `ProjectAssetFileDestination` and route through
  `persistProjectAssetFile`;
- or restrict it to non-durable/plain project references only if a current
  product command truly needs that.

Do not keep a broad compatibility path for `reference.image` or any old
caller-supplied asset-file destination.

### Slice 6: Keep Database Guardrails As Final Invariants

Keep the `asset_file` accessor checks that reject `generated/` and `research/`.
They are a useful last line of defense, but they should no longer be the main
place where path correctness is enforced.

Add import-boundary tests that protect stable boundaries rather than private
helper names:

- production code outside `project-asset-files/` must not import the asset-file
  database accessor directly, except narrowly approved database maintenance or
  migration code;
- media-generation purpose modules must not import canonical durable asset root
  constants;
- media-generation purpose modules must not use filesystem copy operations for
  durable asset persistence;
- current runtime code must not create `generated/` project folders.

These tests should check import paths and capabilities, not local helper
function names or implementation inventories.

### Slice 7: Documentation And Agent Guidance

Update architecture docs to describe the module boundary, not only the folder
convention.

Update agent and CLI guidance so future workflows say:

- agents may place scratch outputs in `tmp/`;
- agents and CLI commands import through domain-owned commands;
- domain commands route source files through core asset-file persistence;
- no workflow should instruct callers to precompute durable destination paths.

## Non-Goals

- Do not change the accepted 0125 folder convention.
- Do not reintroduce `generated/media/` as a supported destination.
- Do not add compatibility aliases for old paths.
- Do not infer asset ownership from path segments.
- Do not parse, validate, or score AI-generated artifact contents.
- Do not move asset relationship selection rules into the storage module.
- Do not turn the storage module into a generic filesystem facade.

## Review Risks

The main risk is over-centralizing product semantics. The module should know
the allowed destination cases and how to map them to filesystem paths, but it
should not decide that a Location Hero should become selected, that a Cast
Character Sheet belongs to a specific relationship role, or that a storyboard
image should attach to a particular shot. Those remain domain rules.

The second risk is creating a generic escape hatch. Any API that accepts
`parent`, `folder`, `baseName`, or `projectRelativePath` as the durable
destination from outside the module should be treated as suspect. Source paths
are caller-supplied; destination paths are module-owned.

The third risk is adding brittle architecture tests. Tests should protect import
boundaries and runtime behavior, not freeze private helper names.

## Completion Checklist

### Review Area

- [ ] Confirm this plan preserves the accepted 0125 folder convention.
- [ ] Confirm the storage module owns destination paths without owning
      relationship or selection semantics.
- [ ] Confirm all public storage APIs are owner-aware and cannot accept an
      arbitrary durable destination folder.
- [ ] Confirm temporary project files and durable asset files use different
      contracts.
- [ ] Confirm `research/` remains valid as a source/reference input but invalid
      as an asset-file destination.
- [ ] Confirm the plan removes broad asset-file registration escape hatches.

### Architecture And Contracts

- [ ] Add `packages/core/src/server/project-asset-files/`.
- [ ] Define a closed durable destination contract for current asset owners.
- [ ] Define an explicit temporary file destination contract.
- [ ] Add `scene_shot_video_take.media_folder_project_relative_path` through the
      Drizzle Kit migration workflow.
- [ ] Add `mediaFolderProjectRelativePath` to server take record handling where
      the storage module needs it.
- [ ] Define generation output resolution that returns root, output names, and
      persistence intent.
- [ ] Define source/reference file validation for imports and one-off generation
      references.
- [ ] Define copy, move, stat, hash, MIME, and cleanup behavior inside the
      module.
- [ ] Keep low-level path allocation helpers private to the module unless they
      are non-asset project-file helpers.
- [ ] Keep `insertAssetFileRecord` guarded and route normal production callers
      through the storage module.

### Implementation Slices

- [ ] Move accepted 0125 path allocation behavior into the new module.
- [ ] Replace shared generation output root selection with the storage module.
- [ ] Replace local Cast image output and import path handling.
- [ ] Replace local Cast Voice Sample file attachment handling.
- [ ] Replace local Lookbook image and sheet output/import path handling.
- [ ] Replace local Location Environment Sheet output/import path handling.
- [ ] Replace local Location Hero output/import path handling.
- [ ] Replace local Scene Storyboard temporary sheet and iteration path
      handling.
- [ ] Replace local Scene Dialogue Audio file persistence.
- [ ] Replace local Shot Video Take input and video import persistence.
- [ ] Validate Shot Video Take import sources before creating regenerated or
      iteration takes.
- [ ] Make Shot Video Take import mutations and file copies rollback-safe so a
      failed import leaves no partial take.
- [ ] Replace local take-owned media copy and cleanup behavior.
- [ ] Persist and reuse Shot Video Take media folders instead of recomputing
      from active take ordering or mutable titles.
- [ ] Replace local Image Edit output naming and persistence.
- [ ] Allocate multi-output Image Edit files as sequential versions of the
      original source basename.
- [ ] Remove or narrow generic `registerAsset` so it cannot register arbitrary
      durable paths.
- [ ] Remove duplicate asset-file allocation helpers outside the module.
- [ ] Remove placeholder folder fallbacks such as `cast` or `location`.

### Tests

- [ ] Add unit tests for every current durable destination case.
- [ ] Add unit tests for temporary destination cases.
- [ ] Add source validation tests for `tmp/`, `research/`, owner folders,
      absolute paths, and parent traversal.
- [ ] Add collision tests for normal numeric suffixes and `-v<nn>` suffixes.
- [ ] Add generation output tests proving root and output names come from the
      storage module.
- [ ] Add Shot Video Take tests proving a discarded earlier take does not change
      a later take's persisted media folder.
- [ ] Add Shot Video Take tests proving take title edits do not change the
      persisted media folder.
- [ ] Add Shot Video Take failed-import tests proving no regenerated take,
      copied owned inputs, or asset rows remain after a missing or failing
      source file.
- [ ] Add import tests proving sources are copied into owner folders before
      `asset_file` registration.
- [ ] Add take-owned media copy tests proving copied files receive new
      asset-file ids and owner-folder paths.
- [ ] Add rollback/cleanup tests for failed persistence after file copy.
- [ ] Add Image Edit tests proving `num_images > 1` produces `source-v01`,
      `source-v02`, and later available version names from the same original
      basename.
- [ ] Add import-boundary tests that block direct durable asset-file
      persistence outside the storage module.
- [ ] Add tests proving no current runtime path creates `generated/`.

### Documentation And Guidance

- [ ] Update `docs/architecture/project-asset-storage-conventions.md` with the
      storage module boundary.
- [ ] Update `docs/architecture/reference/project-files-and-assets.md` with the
      module responsibility split.
- [ ] Update CLI docs so examples pass source files to domain commands rather
      than constructing durable destination paths.
- [ ] Update Studio Skills guidance in `studio-skills/` if any skill still
      describes durable destination path construction.
- [ ] Update any active plan that still describes direct purpose-local
      asset-file persistence.

### Verification

- [ ] Run `pnpm --dir packages/core type-check`.
- [ ] Run focused core tests for project asset file storage.
- [ ] Run focused media-generation import and output tests.
- [ ] Run focused Shot Video Take tests.
- [ ] Run root `pnpm check` or the current agreed verification command before
      calling the refactor complete.
- [ ] Verify `/Users/keremk/renku-movies/urban-basilica` still has no active
      SQLite asset files under `generated/`, `screenplay/storyboards/`, or
      `research/`.
