# 0125 Project Asset Storage Conventions And Urban Basilica Migration

Status: implemented
Date: 2026-07-08

## Summary

Renku Studio project files are currently hard to locate from the app because
many generated outputs and imported assets pass through broad dump folders such
as `generated/media/`, `generated/specs/`, and `generated/qa/`. The same project
also has a root-level sibling `generated/` folder outside the movie project.
Those folders mix durable assets, staged generation outputs, receipts,
temporary QA images, manual JSON snapshots, and old workflow leftovers.

The cleanup has two parts:

1. Add one core-owned asset path allocation convention that writes durable media
   beside the domain object that owns it.
2. One-time migrate `/Users/keremk/renku-movies/urban-basilica` into the new
   convention, then remove both `generated/` dump folders.

This is not a compatibility migration. Renku Studio is pre-customer software.
After the cleanup, runtime code should create current paths only, update callers
directly, and reject or report invalid current data instead of keeping fallback
support for old folder shapes.

Implementation began after review approval on 2026-07-08. The runtime cleanup,
architecture docs, CLI/agent guidance updates, and one-time
`urban-basilica` migration have been completed. Remaining unchecked items in
the checklist are verification tasks that were not run in this implementation
pass.

Implementation notes:

- The one-time migration manifest is
  `/Users/keremk/renku-movies/urban-basilica/tmp/asset-storage-cleanup-manifest-20260708.json`.
- The SQLite backup is
  `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-asset-storage-cleanup-20260708T131106803Z.sqlite`.
- Scene Dialogue Audio remains scene-owned in the current data model and now
  stores generated files under `scene-dialogue-audio/`. Take-owned dialogue
  audio should move under `shots/` only when the product model actually makes
  those audio files take-owned.

## Product Rules

- Durable generated or imported assets must live under the folder for the
  product object that owns them.
- Cast Member assets stay under `cast/<cast-handle>/character-sheets/`,
  `cast/<cast-handle>/profiles/`, and
  `cast/<cast-handle>/voice-samples/`.
- Location Environment Sheets stay under
  `locations/<location-handle>/environment-sheets/`, but the sheet image files
  are flat in that folder. Do not create one folder per environment sheet.
- Location Hero Images stay under `locations/<location-handle>/heroes/` as
  flat files. Do not create one folder per hero image.
- Location Hero Image filenames use a kebab-case name in the `heroes/` folder,
  not a per-image folder. The default hero image name is `hero.png`; edited or
  regenerated versions become `hero-v01.png`, `hero-v02.png`, and so on.
- Flat single-image durable assets use the same version suffix convention when
  a filename collision represents another version of the same asset concept.
  That includes Location Environment Sheets, Location Hero Images, and image
  edits.
- Do not create a generated-name folder whose only durable content is one
  primary asset file. Put the generated kebab-case name and version in the
  filename instead. Folders remain valid when they group multiple workflow
  files, such as scene storyboard folders and shot-video take folders.
- All folder and file names that Renku creates must be kebab-case. Do not use
  capitalized words in generated folder names; the current storyboard iteration
  form is `00-iteration`.
- Lookbook images and sheets stay under `visual-language/lookbook/`.
- Scene storyboard images move to top-level
  `storyboards/<sequence-name>/<scene-name>/`.
- Each scene storyboard folder has a `tmp/` subfolder for temporary generated
  storyboard sheets used during slicing or review.
- Each imported storyboard iteration gets a folder named `<nn>-iteration`,
  where `<nn>` starts at `00` and is zero-padded so filesystem sort order matches
  iteration order.
- A storyboard iteration folder contains only the shot images created by that
  iteration, named `shot-01.png`, `shot-02.png`, and so on. It is not a
  cumulative copy of every current storyboard image for the scene.
- Shot-video take-owned media moves to top-level
  `shots/<sequence-name>/<scene-name>/<take-folder>/`.
- The take folder is `<take-name>-<take-number>`, for example
  `urban-reads-the-metal-01`. The take number is two digits and scene-local.
- A take folder contains the generated video and take-owned generated or
  imported inputs for that take: video prompt sheets, first frames, last frames,
  reference images, and any dialogue audio that is generated as take-owned shot
  production media.
- When a new take is based on an old take, take-owned files are copied into the
  new take folder. Shared references such as Cast Character Sheets, Location
  Sheets, Lookbook Sheets, and other non-owned project references remain where
  their owner stores them.
- Generated JSON files, draft specs, receipts copied out for agent inspection,
  operation documents, and similar non-durable files go under top-level
  `tmp/`.
- Temporary QA pictures also go under top-level `tmp/`.
- Storyboard temporary source sheets are the one specific temporary class that
  lives under `storyboards/<sequence-name>/<scene-name>/tmp/` so they stay near
  the scene storyboard workflow.
- `research/` is user-owned scratch space for external references. Agents may
  read from it when instructed. Generation specs may carry one-off
  project-relative reference file inputs from `research/`, but Renku Studio must
  not register those files as SQLite asset files unless a current domain object
  owns them.
- After this cleanup, no new project-relative path may start with
  `generated/`, and there should be no `generated/` folder under
  `/Users/keremk/renku-movies` or
  `/Users/keremk/renku-movies/urban-basilica`.
- `image.edit` outputs use the source image's base filename plus a version
  suffix. The original file is unchanged. For example, editing `shot-01.png`
  creates `shot-01-v01.png`, then `shot-01-v02.png`.

## Current Evidence From `urban-basilica`

Read-only inspection on 2026-07-08 found:

- `/Users/keremk/renku-movies/generated/`
- `/Users/keremk/renku-movies/urban-basilica/generated/`
- project-local `generated/audio/`, `generated/designs/`, `generated/media/`,
  `generated/qa/`, and `generated/specs/`
- 11 active SQLite asset files under `generated/media/`
- 34 active SQLite storyboard asset files under `screenplay/storyboards/`
- durable active take-owned media under
  `generated/media/scene-shot-video-takes/<take-id>/`
- Location Environment Sheet assets under nested folders such as
  `locations/ottoman-siege-camp/environment-sheets/ottoman-siege-camp-environment-sheet/composite.png`
- one active SQLite asset file at `research/helmet.jpg`, attached to a Cast
  Member as a generic reference image and selected by two Cast Character Sheet
  generation specs. This is evidence that the current `reference.image` import
  contract incorrectly modeled a one-off accessory reference as a durable asset.
  It should become a one-off generation reference file input instead.

The project database already has durable generation records:

- 56 `media_generation_spec` rows
- 47 `media_generation_run` rows

So the generated JSON snapshots under `generated/specs/` are not the primary
source of truth for generation specs. They are agent/debug files and should move
to `tmp/` or be deleted after backup. The audit also found durable
`media_generation_run.outputs_json` and some persisted spec/run JSON that refer
to `generated/media/` paths. The migration must update those JSON references
when they point to moved durable outputs, or report them if they are only
historical run receipts that should no longer claim a live file path.

## Target Folder Shape

```text
<project>/
  .renku/
    project.sqlite

  tmp/
    specs/
    receipts/
    operations/
    qa/
    scratch/

  research/

  cast/
    <cast-handle>/
      character-sheets/
      profiles/
      voice-samples/

  locations/
    <location-handle>/
      environment-sheets/
        <sheet-name>.png
        <sheet-name>-v01.png
      heroes/
        hero.png
        hero-v01.png

  visual-language/
    inspiration/
    lookbook/

  storyboards/
    <sequence-name>/
      <scene-name>/
        tmp/
          <storyboard-sheet-name>.png
        00-iteration/
          shot-01.png
          shot-02.png
        01-iteration/
          shot-03.png

  shots/
    <sequence-name>/
      <scene-name>/
        <take-name>-01/
          video-prompt-sheet.png
          first-frame.png
          reference-image-01.png
          dialogue-audio.mp3
          video.mp4
```

Folder names are human labels. SQLite remains the source of truth for asset ids,
asset-file ids, owner relationships, take membership, selects, and current
storyboard/take state. Code must not infer ownership from path segments.

## Naming And Allocation Rules

Core owns every durable asset destination path. CLI handlers, Studio server
routes, React components, and agents must call core operations instead of
building final destination paths themselves.

Use these current allocation rules:

- `locations/<handle>/environment-sheets/<sheet-name>.<ext>`
- `locations/<handle>/environment-sheets/<sheet-name>-v<nn>.<ext>` when the
  same sheet name is edited, regenerated, or otherwise collides with an
  existing sheet filename
- `locations/<handle>/heroes/hero.<ext>` for the default hero image
- `locations/<handle>/heroes/<hero-name>.<ext>` only when the product has
  multiple named hero images for the same location
- `locations/<handle>/heroes/<hero-name>-v<nn>.<ext>` when a hero image is
  edited, regenerated, or otherwise collides with an existing hero filename
- `storyboards/<sequence-name>/<scene-name>/<nn>-iteration/shot-<nn>.<ext>`
  for imported durable storyboard images
- `storyboards/<sequence-name>/<scene-name>/tmp/<sheet-name>.<ext>` for
  temporary source storyboard sheets
- `shots/<sequence-name>/<scene-name>/<take-name>-<nn>/<role>.<ext>` for
  single-file take-owned roles such as `video-prompt-sheet`, `first-frame`,
  `last-frame`, `dialogue-audio`, and `video`
- `shots/<sequence-name>/<scene-name>/<take-name>-<nn>/reference-image-<mm>.<ext>`
  when a take owns multiple ad hoc reference images
- `<source-basename>-v<nn>.<ext>` beside the source file for `image.edit`
  outputs

Generated folder and file names are lowercase kebab-case. The storyboard
iteration folder word is exactly `iteration`, lowercase. The number is always
two digits: `00-iteration`, `01-iteration`, `02-iteration`.

The take number is also two digits. For new paths, core allocates the next
scene-local take folder number from existing `shots/<sequence-name>/<scene-name>/`
folders and active take-owned asset paths. It must not recompute existing
folder names from the current take list on every read.

## Architecture Boundaries

`packages/core` owns:

- destination path allocation;
- kebab-case name normalization and collision handling;
- copying source files into durable owner folders;
- `asset_file.project_relative_path` updates;
- take-owned media copy behavior;
- storyboard iteration folder allocation;
- validation that new durable asset paths do not start with `generated/`;
- validation that SQLite asset files do not point into `research/`;
- validation and execution mapping for one-off project-relative generation
  reference files, including files under `research/`, without registering them
  as assets;
- migration-time structured reports for files moved, JSON references updated,
  and files left in `tmp/`.

`packages/engines` may persist provider outputs into the output root that core
passes for the current purpose. It must not choose the project-level asset
folder convention.

`packages/cli` parses flags/files and calls core. It may accept a source path
from `research/` for an import or generation source. Durable asset imports must
copy the source file to the owner folder before registering the asset file.
One-off generation references must remain generation input files and must not be
registered as assets.

`packages/studio` displays assets and media URLs from core projections. It must
not decide where a generated image or video belongs.

Agents and Studio skills may stage temporary files under `tmp/` and may read
user-provided files from `research/` when instructed. They must import or attach
through core before treating a file as a durable project asset. They may pass a
`research/` file as a one-off generation reference when the file is not meant to
be reusable project state.

## Implementation Slices

### Slice 0: One-Off Generation Reference Files

Correct the current generic reference-image behavior before adding the broader
storage guardrails.

The current `reference.image` import path lets callers turn arbitrary external
reference files into asset rows attached to Cast Members, Locations, or other
targets. That was convenient for the Cast Character Sheet reference UI, but it
conflates two different product concepts:

- a reusable, domain-owned asset that belongs in SQLite;
- a one-off file supplied as an input to one generation.

Add a core-owned one-off generation reference contract. The public spec shape
should be deliberate and media-agnostic enough for future audio/video support,
while only image references need to be implemented in this slice:

```ts
interface GenerationReferenceFileInput {
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image' | 'audio' | 'video';
  role: string;
  label?: string;
}
```

Purpose specs that accept arbitrary one-off references should expose a
purpose-owned field rather than overloading asset dependency selections:

- Cast Character Sheet: `referenceFiles?: GenerationReferenceFileInput[]`
- Generic Image Create: `referenceFiles?: GenerationReferenceFileInput[]`

Core validation must:

- normalize the project-relative path;
- reject absolute paths and parent traversal;
- require the file to exist under the project folder;
- require a supported media kind for the current generation purpose;
- reject unsupported media kinds with structured diagnostics;
- pass accepted files to `PreparedMediaGeneration.generation.request.inputFiles`;
- avoid creating `asset`, `asset_file`, or asset relationship rows for those
  inputs.

Existing asset-backed references remain valid only when the reference is a
modeled reusable project asset. For example, a prior Cast Character Sheet may be
selected as character continuity. A future Prop model could make "Helmet" a
reusable Prop asset. Until that model exists, `research/helmet.jpg` is just a
one-off reference file.

The generic `reference.image` import path should be removed or narrowed so it
cannot be used as a shortcut for one-off generation inputs. If a caller wants to
turn a source file into a durable asset, it must call the import command for the
domain object that will own the asset.

### Slice 1: Central Path Allocation

Add a core-owned project asset path allocation module close to existing
project-relative path helpers and media import services.

The allocator should expose focused functions for current domains instead of a
generic "give me any folder" API:

- allocate Cast Character Sheet path
- allocate Cast Profile path
- allocate Cast Voice Sample path
- allocate Location Environment Sheet path
- allocate Location Hero path
- allocate Lookbook image or sheet path
- allocate Scene Storyboard temporary sheet path
- allocate Scene Storyboard iteration folder and shot image paths
- allocate Shot Video Take media path
- allocate Image Edit output path beside the source asset file
- allocate project temporary artifact paths under `tmp/`

The allocator should receive domain ids/titles/handles from core state, not
derive owner identity from caller-provided path segments.

### Slice 2: Remove `generated/media` As A Generation Output Root

Update media generation preparation so each purpose passes an output root that
matches the destination owner:

- Cast image purposes write under the relevant `cast/<handle>/...` folder.
- Lookbook purposes write under `visual-language/lookbook/`.
- Location Environment Sheets write directly under the flat
  `locations/<handle>/environment-sheets/` folder.
- Location Hero Images write as flat files under
  `locations/<handle>/heroes/`.
- Scene Storyboard Sheets write temporary source sheets under
  `storyboards/<sequence-name>/<scene-name>/tmp/`.
- Shot-video take-owned images, audio, and videos write under
  `shots/<sequence-name>/<scene-name>/<take-folder>/`.
- Generic `image.create` outputs with no durable owner write under `tmp/` until
  imported into an owner folder.
- `image.edit` writes beside the source asset file using the `-v<nn>` naming rule
  when the source asset has a concrete durable owner.

The engine runner can keep receiving `outputRoot` and
`outputProjectRelativeRoot`; core should be the layer that chooses those values.

### Slice 3: Import Copies Into Current Owner Folders

Update every media import path so the source can be any valid project-relative
file, including a file in `tmp/` or `research/`, but the registered asset file
is always written to the owner folder for the purpose.

This affects:

- `lookbook.image`
- `lookbook.sheet`
- `cast.character-sheet`
- `cast.profile`
- `cast.voice-sample` attachment
- `location.environment-sheet`
- `location.hero`
- `scene.storyboard-sheet`
- `shot.input`
- `shot.video-take`
- `image.edit` destination imports

If the source is already the allocated destination, core can avoid copying the
bytes. It must still register the destination path, not a caller-provided
scratch path.

### Slice 4: Storyboards Become Top-Level Iterations

Update Scene Storyboard Sheet import so it allocates:

```text
storyboards/<sequence-name>/<scene-name>/<nn>-iteration/
```

The import should continue to register one `scene_storyboard_image` asset per
shot and write direct `scene_shot_storyboard_image` rows. It should not import
the temporary composite sheet as an asset. It should not duplicate older
storyboard shots into the new iteration folder unless those shot images were
created by this import.

The logical current storyboard remains a SQLite projection from active
storyboard image relationships and shot ids, not the filesystem contents of the
latest folder.

### Slice 5: Shots Folder And Take-Owned Media

Update shot-video take media import, generation output allocation, and take
iteration copy so all take-owned files live under:

```text
shots/<sequence-name>/<scene-name>/<take-name>-<take-number>/
```

When a take iteration is created from an old take, selected take-owned media is
deep-copied into the new take folder. The new take receives new asset/file
ownership and new paths.

This slice must update the older path suggestion from plan `0121`, which used:

```text
generated/media/scene-shot-video-takes/<take-id>/
```

That path is no longer accepted.

This slice should also reconcile dialogue audio ownership:

- dialogue audio generated as take-owned shot production media belongs in the
  take folder and is copied with take-owned media;
- reusable non-owned references remain with their actual owner and are not
  copied into the take folder;
- if the current scene dialogue audio model still treats all dialogue audio as
  reusable scene-owned media, implementation must either update that model to
  current product ownership or explicitly report the remaining owner mismatch
  before the migration is called complete.

### Slice 6: Temporary Files Move To `tmp/`

Move agent/debug JSON files and QA images out of `generated/`.

Use top-level folders such as:

```text
tmp/specs/
tmp/receipts/
tmp/operations/
tmp/qa/
tmp/scratch/
```

Do not add SQLite asset rows for those files. If a JSON document is durable
project state, it belongs in SQLite or in a current domain document file, not in
`tmp/`.

Media generation specs and runs already exist in SQLite. The filesystem JSON
copies are temporary snapshots unless a specific audit proves that a current
workflow reads one as the source of truth. Any such workflow is a bug to fix in
core or CLI before removing `generated/specs/`.

### Slice 7: Research Folder Guardrail

Add validation and tests so new durable asset files cannot be registered under
`research/`.

Allowed behavior:

- agents may read `research/` files when the user explicitly asks;
- import commands may accept a source in `research/`;
- generation preview or execution may use a `research/` file as a one-off
  reference file input without copying it into a durable owner folder.

Forbidden behavior:

- `asset_file.project_relative_path` starts with `research/`;
- a run receipt or project relationship treats a `research/` file as a managed
  asset.

One-off generation reference files are allowed in durable generation spec/run
records because they describe the exact inputs used for that generation. They
must remain clearly typed as `referenceFiles` or equivalent execution input
metadata, not as asset ids, asset files, dependency selections, or ownership
relationships.

### Slice 8: Remove `generated/` Creation And Test Fixtures

Remove or update code and current tests that create `generated/media`,
`generated/specs`, `generated/audio`, or `generated/qa` as accepted current
paths.

Tests may create arbitrary files in a fixture project, but when they exercise
current media generation or import behavior they should assert the current
owner folders. Do not add architecture tests that hard-code private helper
names or function inventories.

## One-Time `urban-basilica` Migration

This migration is a one-off development-project cleanup. Do not build a formal
reusable migration command unless implementation reveals that core needs a
focused current-contract repair operation for its own tests.

### Migration Preparation

1. Stop Studio and any agents that might write to
   `/Users/keremk/renku-movies/urban-basilica`.
2. Back up `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite`.
3. Create a filesystem backup or archive of:
   - `/Users/keremk/renku-movies/generated/`
   - `/Users/keremk/renku-movies/urban-basilica/generated/`
   - `/Users/keremk/renku-movies/urban-basilica/screenplay/storyboards/`
   - `/Users/keremk/renku-movies/urban-basilica/locations/*/environment-sheets/`
4. Generate a migration manifest with one row per moved file:
   - old project-relative path
   - new project-relative path
   - asset id, when one exists
   - asset file id, when one exists
   - media generation run id, when one exists
   - reason: durable asset, run output, tmp JSON, QA image, research scratch,
     duplicate, or obsolete leftover
5. Fail before moving anything if two active files would map to the same new
   destination.

### Durable Asset Moves

Move active `asset_file` rows into current paths and update
`asset_file.project_relative_path` in one SQLite transaction per migration run.

Expected categories:

- `generated/media/*.png` lookbook images -> `visual-language/lookbook/`
- `generated/media/*.png` cast sheets/profiles -> matching `cast/<handle>/...`
- `generated/media/*.mp3` cast voice samples -> matching
  `cast/<handle>/voice-samples/` when owned by a Cast Voice
- `generated/media/*.png` location sheets -> flat
  `locations/<handle>/environment-sheets/`
- `generated/media/*.png` location heroes ->
  `locations/<handle>/heroes/hero.png` for the default hero image, or
  `locations/<handle>/heroes/<hero-name>.png` only when there are multiple named
  hero images for the same location; repeated versions use `-v<nn>` suffixes
- `screenplay/storyboards/...` -> `storyboards/<sequence-name>/<scene-name>/<nn>-iteration>/`
- `generated/media/scene-shot-video-takes/...` and other shot-video take
  inputs/videos -> `shots/<sequence-name>/<scene-name>/<take-folder>/`
- `generated/media/scene_dialogue_*.mp3` and
  `generated/media/scene-dialogue-audio/*.mp3` -> take folders if they are
  take-owned dialogue audio, or reported as unresolved if the current data model
  still makes them scene-owned
- `research/helmet.jpg` active asset row -> remove from SQLite asset tracking
  and rewrite the two affected Cast Character Sheet specs from
  `referenceSelections.dependencyInclusions` using
  `cast-reference-image:<castMemberId>:<assetId>` to a one-off `referenceFiles`
  entry for `research/helmet.jpg`

### JSON And Run References

For durable generation records:

- update `media_generation_run.outputs_json` paths when the run output is also
  the moved durable asset file;
- update `media_generation_run.spec_snapshot_json`,
  `media_generation_run.provider_payload_json`, and `media_generation_spec.spec_json`
  only when they contain current project-relative paths that must stay
  executable;
- leave provider source URLs and historical external receipt metadata intact;
- report any remaining `generated/` path in persisted SQLite JSON after the
  migration.
- report any remaining cast character sheet spec or run snapshot that still
  references the removed helmet asset id or asset-file id.

For filesystem JSON snapshots:

- move useful human/debug files from `generated/specs/` and
  `generated/media/*.{json,txt}` to `tmp/specs/`, `tmp/receipts/`, or
  `tmp/operations/`;
- delete duplicates only after the backup and manifest prove the data exists in
  SQLite or another moved file;
- never make those JSON files the source of truth for media generation specs.

### Temporary And Leftover Files

Move temporary QA images to `tmp/qa/`.

Move old crop overlays, contact sheets, run receipts, import documents, and
operation files to `tmp/` unless they are attached as durable assets.

After all active SQLite references have moved, remove:

- `/Users/keremk/renku-movies/generated/`
- `/Users/keremk/renku-movies/urban-basilica/generated/`

Do not remove the backup archive.

## Validation And Tests

Focused tests should prove:

- new Location Environment Sheet imports register flat
  `locations/<handle>/environment-sheets/<sheet-name>.<ext>` paths;
- new Location Hero imports register flat `heroes/hero.<ext>` paths by default,
  or flat `heroes/<hero-name>.<ext>` paths when multiple named hero images are
  modeled, and repeated hero names use `-v<nn>` suffixes;
- new Scene Storyboard imports register top-level
  `storyboards/<sequence-name>/<scene-name>/<nn>-iteration>/shot-<nn>.<ext>` paths;
- storyboard temporary sheets are not registered as assets;
- new Shot Video Take media imports and generation outputs register
  `shots/<sequence-name>/<scene-name>/<take-folder>/...` paths;
- copied take-owned media receives new asset ids, asset-file ids, and copied
  file bytes under the new take folder;
- non-owned Cast Character Sheets, Location Sheets, Lookbook Sheets, and other
  shared references are not copied into the take folder;
- `image.edit` names edited outputs with `-v01`, `-v02`, and so on beside the
  original file, without renaming the original;
- durable asset imports never register `generated/` paths;
- one-off generation reference files may point at `research/` without creating
  SQLite asset rows;
- durable asset imports never register `research/` paths;
- temporary JSON/spec/QA outputs go under `tmp/`;
- migration verification finds no active `asset_file.project_relative_path`
  starting with `generated/`, `screenplay/storyboards/`, or `research/`;
- migration verification finds no remaining project `generated/` folders.

Manual verification against `urban-basilica`:

1. Open the project in Studio.
2. Pick several visible images from Cast, Locations, Lookbook, Storyboards, and
   Takes.
3. Confirm the image can be located in the filesystem by following the domain
   folder visible from the app context.
4. Confirm storyboard images are under top-level `storyboards/`, not
   `screenplay/storyboards/`.
5. Confirm shot-video take media is under top-level `shots/`.
6. Confirm `research/` still contains user scratch files but none are active
   SQLite asset files.
7. Confirm generation specs and run records still load from SQLite.

## Architecture Decision Scope

After this plan is approved, write an ADR in `docs/architecture/` that records
the accepted storage convention. The ADR should be short and decision-focused,
not a duplicate of this implementation plan.

It must capture:

- core owns durable asset path allocation;
- generated folder and file names are kebab-case;
- no generated-name folder should be created solely to hold one durable file;
- Location Environment Sheets are flat under `environment-sheets/`;
- Location Hero Images are flat under `heroes/` and use `-v<nn>` version
  suffixes for edits or regenerations;
- Storyboards are top-level under
  `storyboards/<sequence-name>/<scene-name>/`;
- storyboard iterations are `<nn>-iteration` folders containing only the shot
  images created by that iteration;
- Shot Video Take media is under
  `shots/<sequence-name>/<scene-name>/<take-folder>/`;
- temporary specs, receipts, operations, and QA images are under project
  `tmp/`;
- `research/` is user-owned scratch space and is not tracked as durable SQLite
  asset files;
- arbitrary one-off generation references are represented as reference file
  inputs, not asset rows, until a domain object such as a future Prop model owns
  them;
- project paths must not start with `generated/` after the cleanup;
- the `urban-basilica` migration is a one-time development-project migration,
  not a reusable compatibility layer.

## Completion Checklist

### Review Area

- [x] Confirm the new folder convention matches the product rules in this plan.
- [x] Confirm the convention does not infer identity or ownership from paths.
- [x] Confirm durable project metadata remains in SQLite.
- [x] Confirm temporary files are clearly separated from durable assets.
- [x] Confirm the plan updates older `generated/media` guidance instead of
      preserving it as a compatibility path.
- [x] Confirm the one-time migration is scoped only to
      `/Users/keremk/renku-movies/urban-basilica`.

### Architecture And Contracts

- [x] Add and link the asset storage ADR under `docs/architecture/` after this
      plan is approved.
- [x] Update `docs/architecture/reference/project-files-and-assets.md`.
- [x] Update media generation references that currently direct agents or code
      to `generated/media/`.
- [x] Update Shot Video Take-owned media docs to replace the older
      `generated/media/scene-shot-video-takes/<take-id>/` suggestion.
- [x] Define core-owned path allocation functions for every current durable
      asset purpose.
- [x] Define the project-root `tmp/` contract and keep `.renku/tmp/` for hidden
      Renku-internal state only.
- [x] Define the `research/` guardrail in core asset-file validation.
- [x] Define the one-off generation reference file contract in core.
- [x] Add Cast Character Sheet `referenceFiles` support for arbitrary
      project-relative image references.
- [x] Add Generic Image Create `referenceFiles` support for arbitrary
      project-relative image references.
- [x] Define how take folder numbers are allocated and preserved.
- [x] Define how storyboard iteration numbers are allocated and preserved.
- [x] Define how `image.edit` finds the next `-v<nn>` suffix.

### Implementation Slices

- [x] Replace generation output roots for cast image purposes.
- [x] Replace generation output roots for location sheet and hero purposes.
- [x] Replace generation output roots for Lookbook image and sheet purposes.
- [x] Replace generation output roots for Scene Storyboard Sheets.
- [x] Replace generation output roots for Shot Video Take inputs and videos.
- [x] Replace generic image creation output roots when there is no durable
      owner.
- [x] Replace image edit output naming and roots.
- [x] Update all import paths to copy into owner folders before asset
      registration.
- [x] Update storyboard import destination allocation.
- [x] Update take iteration copy to use `shots/` paths.
- [x] Move temporary QA/spec/receipt/operation writes to `tmp/`.
- [x] Remove or narrow the generic `reference.image` import command so one-off
      references are not modeled as durable assets.
- [x] Remove code paths that create top-level `generated/` folders.

### Urban Basilica Migration

- [x] Stop all writers to the project.
- [x] Back up the project SQLite database.
- [x] Back up current generated, storyboard, and location-sheet folders.
- [x] Build the migration manifest.
- [x] Fail on destination collisions before moving files.
- [x] Move durable asset files to owner folders.
- [x] Update `asset_file.project_relative_path` rows.
- [x] Update durable generation run/spec JSON paths that must keep pointing to
      moved files.
- [x] Move temporary JSON/spec/receipt/operation files to `tmp/`.
- [x] Move temporary QA/contact/overlay files to `tmp/qa/`.
- [x] Remove the active `research/helmet.jpg` asset row and relationships.
- [x] Rewrite affected Cast Character Sheet specs and runs to use one-off
      `referenceFiles` for `research/helmet.jpg`.
- [x] Resolve or report scene dialogue audio ownership.
- [x] Remove both `generated/` folders after verification.

### Validation And Tests

- [x] Add focused core tests for every new path allocator.
- [x] Add media import tests for owner-folder registration.
- [x] Add generation run tests showing core passes purpose-specific output
      roots to engines.
- [x] Add storyboard iteration import tests.
- [x] Add shot-video take-owned media copy tests using `shots/` paths.
- [x] Add `image.edit` version suffix tests.
- [x] Add `research/` asset-file guardrail tests.
- [x] Add one-off generation reference file tests that use `research/` without
      creating SQLite assets.
- [x] Add migration verification checks for the real development project.
- [x] Run focused package tests.
- [ ] Run root `pnpm check` or the current equivalent verification before
      calling implementation complete.

### Documentation And Final Verification

- [x] Update Studio Skills guidance if any skill still tells agents to stage
      generated media under `generated/media/`.
- [x] Update CLI examples that show `generated/media/` as the normal staging
      path.
- [x] Update architecture docs so Location Environment Sheets are flat under
      `environment-sheets/`.
- [x] Update architecture docs so Storyboards are top-level.
- [x] Update architecture docs so Shot Video Take media is under `shots/`.
- [x] Record the `urban-basilica` migration manifest location in the final
      implementation notes.
- [ ] Verify in Studio that visible assets can be located in the filesystem by
      following the new domain folders.
- [x] Verify no active SQLite asset file points into `generated/`,
      `screenplay/storyboards/`, or `research/`.
- [x] Verify no Cast Character Sheet spec references the removed helmet asset
      id or asset-file id.
- [x] Verify no project `generated/` folder remains outside the backup archive.
