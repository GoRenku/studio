# Shot Video Take-Owned Media Ownership

Date: 2026-07-07

Status: accepted

Role: architecture decision

## Context

Shot Video Takes can use several kinds of media during production:

- take-owned generated or imported inputs, such as Video Prompt Sheets, first
  frames, last frames, and shot reference images;
- final generated take videos;
- non-owned project references, such as Cast Character Sheets, Location Sheets,
  Lookbook Sheets, and Scene Dialogue Audio takes.

These concepts must not share one lifecycle. A user expects deleting one take
to delete that take's own workspace, not to remove references from another
active take.

A development-project failure exposed the boundary problem. A copied take
iteration had its own `scene_shot_video_take_media_input` row for a Video
Prompt Sheet, but the row reused the source take's `assetId` and `assetFileId`.
When another copied take was discarded, the Trash lifecycle marked that shared
asset/file discarded. The active take still had a selected input row, but Core
correctly hid it because active media reads reject discarded assets and files.

The file bytes still existed. The durable ownership graph was wrong.

## Decision

Shot Video Take-owned media must not be shared between active takes.

When a take iteration copies selected take-owned media, Core must create new
asset/file ownership for the new take. That copy includes:

- a new `asset` row;
- new `asset_file` rows;
- distinct project-relative file paths;
- copied file bytes;
- media input or video rows pointing to the copied asset/file ids.

The copied asset can preserve provenance metadata from the source media, but it
is not the same owned asset. It belongs to the new take's production workspace.

Deleting a take may discard only media that is exclusively owned by that take.
If Core detects that a take-owned media asset or file is still referenced by
another active take input or take video, normal deletion must not discard that
shared asset. Shared active ownership of take-owned media is invalid state and
must be reported through structured diagnostics or repaired through a deliberate
current-contract repair path.

Non-owned project references are different. Copying a take may copy selection
state for Cast Character Sheets, Location Sheets, Lookbook Sheets, Dialogue
Audio, and other project-owned references. It must not copy or discard the
underlying referenced assets.

## Ownership Rules

### Take-Owned Media

Take-owned media is part of a single Shot Video Take's production workspace.
Current examples include:

- `video-prompt-sheet` inputs;
- `first-frame` inputs;
- `last-frame` inputs;
- `reference-image` inputs created for shot-video production;
- generated dialogue audio when it is take-owned shot production media;
- final `shot.video-take` video media.

Take-owned media can be discarded with its owning take only when no other active
owner references the same asset/file.

### Non-Owned References

Non-owned references are selected or included by a take, but owned elsewhere in
the project. Current examples include:

- Cast Character Sheets;
- Location Sheets;
- Lookbook Sheets;
- Scene Dialogue Audio takes;
- project, scene, cast, location, and visual-language assets resolved through
  dependency selectors.

Deleting a take removes only the take's selection or inclusion state for these
references. It must not discard the referenced assets or files.

## Ownership Boundary

This rule belongs in `packages/core`.

Core owns:

- take-owned media classification;
- take iteration copy behavior;
- project file copy behavior for take-owned media;
- prepared-input state updates when copied media receives new asset/file ids;
- Trash lifecycle safety checks;
- structured diagnostics for invalid shared ownership;
- deliberate repair for already-corrupted development data.

Studio server handlers, Studio React components, CLI handlers, and agents must
not implement their own take-owned media deletion rules. They should call
focused Core commands and render or format Core responses.

## Consequences

- A copied take iteration with a selected Video Prompt Sheet receives its own
  prompt-sheet asset/file.
- Deleting a source take cannot make a copied take lose its prompt-sheet
  preview.
- Deleting a copied take cannot discard the source take's prompt-sheet media.
- Empty Trash can safely move discarded take-owned files because active takes
  keep distinct file paths.
- Non-owned references remain shared project assets and are not duplicated per
  take.
- Existing development data with shared take-owned assets requires a deliberate
  repair. Runtime code should not keep compatibility branches that treat shared
  take-owned assets as a supported shape.

The current repair surface is `renku take repair-owned-media`. It scans active
Shot Video Take-owned input rows, deep-copies shared active take-owned
asset/files for every owner except one retained original owner, updates input
rows and prepared input state, and returns a structured report of changed input,
take, asset, and asset file ids.

Project file paths for take-owned media are governed by
`project-asset-storage-conventions.md`. The current path shape is:

```text
shots/<sequence-slug>/<scene-slug>/<take-slug>-<take-number>/
```

Older references to `generated/media/scene-shot-video-takes/<take-id>/` are
superseded by that decision.

## Implementation Guidance

The implementation plan is
`../../plans/active/0121-shot-video-take-owned-media-copy-and-trash.md`.

Relevant current architecture references:

- `media-generation.md`
- `reference/media-generation.md`
- `reference/recoverable-discard-and-trash.md`
- `shot-video-take-structure-modes.md`
- `project-asset-storage-conventions.md`
