# Project Asset Storage Conventions

Date: 2026-07-08

Status: accepted

Role: architecture decision

## Context

Renku Studio stores durable project metadata in SQLite and media bytes on disk.
That boundary is correct, but the current filesystem shape became difficult to
use. Many generated outputs and imported assets pass through broad folders such
as `generated/media/`, `generated/specs/`, and `generated/qa/`. A user can see
an image in Studio but cannot reasonably find it in the filesystem because the
folder does not reveal the asset's product owner.

The real development project also contains two generated dump folders:

```text
/Users/keremk/renku-movies/generated/
/Users/keremk/renku-movies/urban-basilica/generated/
```

Those folders mix durable asset files, temporary generated sheets, debug JSON,
operation files, receipts, QA images, and old workflow leftovers. This makes
asset ownership harder to inspect and makes future garbage collection harder to
design.

Existing architecture already says SQLite owns identity and relationships while
the filesystem owns content. This decision keeps that boundary. It changes the
path allocation convention so durable files live where a human would look for
them.

## Decision

Renku Studio will store durable generated and imported assets under the folder
for the product object that owns them.

There must be no current project-relative durable asset path that starts with
`generated/`. New runtime code must not create `generated/media/`,
`generated/specs/`, `generated/audio/`, or `generated/qa/`.

Path segments are labels only. SQLite remains the source of truth for:

- asset ids;
- asset-file ids;
- owner relationships;
- scene, shot, and take membership;
- generation specs and runs;
- selects and active state;
- file availability and trash state.

Code must not infer business relationships from folder names.

## Canonical Folders

Current durable folders are:

```text
cast/<cast-handle>/character-sheets/
cast/<cast-handle>/profiles/
cast/<cast-handle>/voice-samples/

locations/<location-handle>/environment-sheets/
locations/<location-handle>/heroes/<hero-slug>/

visual-language/lookbook/

storyboards/<sequence-slug>/<scene-slug>/

shots/<sequence-slug>/<scene-slug>/<take-folder>/
```

Temporary project files use:

```text
tmp/
storyboards/<sequence-slug>/<scene-slug>/tmp/
```

User scratch references use:

```text
research/
```

## Asset Rules

Cast Member assets stay under the cast member:

```text
cast/<cast-handle>/character-sheets/<asset-slug>.<ext>
cast/<cast-handle>/profiles/<asset-slug>.<ext>
cast/<cast-handle>/voice-samples/<asset-slug>.<ext>
```

Location Environment Sheets are flat files under `environment-sheets/`:

```text
locations/<location-handle>/environment-sheets/<sheet-slug>.<ext>
locations/<location-handle>/environment-sheets/<sheet-slug>-01.<ext>
```

Renku Studio must not create one folder per Location Environment Sheet.

Location Hero Images keep the existing hero folder shape:

```text
locations/<location-handle>/heroes/<hero-slug>/hero.<ext>
```

Lookbook images and sheets stay under:

```text
visual-language/lookbook/<asset-slug>.<ext>
```

Scene Storyboard images are top-level project assets, not screenplay files:

```text
storyboards/<sequence-slug>/<scene-slug>/<NN>-Iteration/shot-<NN>.<ext>
```

The storyboard iteration number starts at `00` and is zero-padded so normal
filesystem sorting preserves iteration order. Each iteration folder contains
only the shot images created in that iteration. It is not a full materialized
snapshot of every current storyboard image for the scene.

Temporary generated storyboard sheets live beside the scene's storyboard work:

```text
storyboards/<sequence-slug>/<scene-slug>/tmp/<sheet-slug>.<ext>
```

Shot Video Take-owned media lives under:

```text
shots/<sequence-slug>/<scene-slug>/<take-slug>-<take-number>/
```

The take number is two digits and scene-local. Example:

```text
shots/the-sound-that-opens-stone/bombardment/city-smoke-before-the-wall-01/
```

Take-owned files include generated or imported media whose lifecycle belongs to
one take:

- video prompt sheets;
- first frames;
- last frames;
- ad hoc reference images;
- generated shot/take dialogue audio when it is take-owned production media;
- final generated take videos.

When a new take is based on an old take, Core must copy take-owned files into
the new take folder and create new asset/file ownership for the new take.
Shared project references such as Cast Character Sheets, Location Sheets,
Lookbook Sheets, and other non-owned references stay with their original owner.

`image.edit` writes edited outputs beside the source image with a version
suffix:

```text
shot-01.png
shot-01-v01.png
shot-01-v02.png
```

The original file name is not changed and does not receive a `-v00` suffix.

## Temporary Files

Generated JSON files, draft specs copied out for agent inspection, receipts,
operation documents, provider payload snapshots, and QA pictures are not
durable assets by default. They belong under top-level `tmp/`:

```text
tmp/specs/
tmp/receipts/
tmp/operations/
tmp/qa/
tmp/scratch/
```

Media generation specs and runs are durable SQLite records. Files under
`tmp/specs/` or `tmp/receipts/` are human/agent inspection artifacts only. A
runtime workflow must not depend on them as the source of truth.

`.renku/tmp/` remains reserved for hidden Renku-internal operational state such
as backups or repair work. Media generation staging and agent scratch files
must not use `.renku/tmp/` as their normal project-visible location.

## Research

`research/` is user-owned scratch space for external material.

Agents may read files from `research/` when the user instructs them to use an
external reference. Generation specs may carry project-relative one-off
reference file inputs, including files under `research/`, when those files are
only inputs to that generation. Those one-off references are execution inputs;
they are not managed assets and must not create SQLite asset rows or ownership
relationships.

Import commands may accept a `research/` file as a source. When a research file
becomes a durable project asset, Core must copy it into the relevant owner
folder and register that destination path. A file should become a structured
SQLite asset only when Renku has a domain object that owns it, such as a Cast
Member Character Sheet, Location Sheet, Lookbook Sheet, Shot Video Take-owned
input, or a future Prop. Until Prop support exists, a helmet image used once as
an accessory reference for a cast generation remains a one-off reference file,
not a database asset.

## Ownership Boundary

Core owns path allocation.

`packages/core` owns:

- destination folder selection;
- slugification and collision handling;
- copying files from scratch/source folders into owner folders;
- asset-file path updates;
- validation that new durable asset paths do not start with `generated/`;
- validation that durable asset files are not registered under `research/`;
- take-owned media copy behavior;
- storyboard iteration allocation.

`packages/engines` persists provider outputs only into the output root supplied
by Core.

CLI handlers, Studio server routes, Studio React components, and agents must
not build durable destination paths themselves.

## Superseded Guidance

This decision supersedes older current or plan text that recommends:

- `generated/media/` as the normal staging directory for imported assets;
- `generated/media/scene-shot-video-takes/<take-id>/` for take-owned media;
- `screenplay/storyboards/` for durable storyboard images;
- `locations/<handle>/environment-sheets/<sheet-slug>/` for Location
  Environment Sheets;
- registering `research/` files as asset files.
- using generic `reference.image` imports to model one-off generation reference
  inputs as durable project assets.

Existing historical plans may still mention those paths. They are not current
direction.

## Implementation Plan

The implementation and one-time development project migration are planned in:

```text
plans/active/0125-project-asset-storage-conventions-and-urban-basilica-migration.md
```

The migration is intentionally one-time for:

```text
/Users/keremk/renku-movies/urban-basilica
```

It should not become a broad compatibility layer or reusable legacy loader.

## Consequences

- A user can locate visible Studio assets by following the product owner folder.
- The root and project-local `generated/` dump folders disappear after the
  one-time migration.
- Temporary JSON and QA files become easier to garbage collect later because
  they are under `tmp/`.
- Import and generation code must use core-owned allocation instead of caller
  supplied final paths.
- Tests and examples need to stop treating `generated/media/` as the normal
  current path.
- Development data with old paths must be moved once and then treated as
  current data.
