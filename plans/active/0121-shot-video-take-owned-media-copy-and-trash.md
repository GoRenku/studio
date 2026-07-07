# 0121 Shot Video Take-Owned Media Copy And Trash

Status: implemented
Date: 2026-07-07

## Summary

Fix the Shot Video Take ownership hole where generated or imported take-owned
input media can be shared across copied take iterations. The immediate symptom
was a selected Video Prompt Sheet disappearing from an active take after another
take iteration was discarded.

The product rule is:

- deleting one take must not break any other active take;
- take-owned generated or imported input media must not be shared between
  active takes;
- non-owned project references, such as Cast Character Sheets, Location Sheets,
  Lookbook Sheets, and Dialogue Audio, remain shared references and must not be
  copied or discarded when a take is discarded.

The architectural rule is documented in
`docs/architecture/shot-video-take-owned-media.md`.

## Immediate Evidence

The corrupted development project had an active take,
`scene_shot_video_take_7aen3934`, whose selected Video Prompt Sheet input row
still pointed to `asset_file_rnusp22b`.

That asset file row was marked discarded at `2026-07-06T21:32:09.254Z` by a
`sceneShotVideoTake.delete` trash operation for another take iteration. The
image bytes still existed on disk, but Core correctly hid the media input
because `listShotVideoTakeInputs(...)` filters out discarded `asset` and
`asset_file` rows.

The root problem is not Studio rendering. The root problem is that
`copySelectedShotVideoTakeInputRecords(...)` creates new media input rows for a
take iteration while reusing the source input's `assetId` and `assetFileId`.
That makes take-owned media appear owned by the new take while still being
physically and durably shared with the source take.

## Ownership Vocabulary

### Take-Owned Media

Take-owned media is generated or imported as part of one Shot Video Take's
production workspace. Current examples:

- `video-prompt-sheet` inputs for a take;
- `first-frame` inputs;
- `last-frame` inputs;
- `reference-image` inputs imported or generated for a take or shot-video
  input slot;
- final `shot.video-take` video media attached to a take.

Take-owned media has a lifecycle tied to its owning take or input row. When a
take iteration is created, selected take-owned media should be copied into new
asset/file ownership for the new take.

### Non-Owned References

Non-owned references are selected by a take but owned elsewhere in the project.
Current examples:

- Cast Character Sheets;
- Location Sheets;
- Lookbook Sheets;
- Scene Dialogue Audio takes;
- project, scene, cast, location, or visual-language assets selected through
  dependency resolution.

Copying a take may copy the selection state for these references, but must not
copy or discard the referenced assets.

## Current Faulty Flow

When a videoed take is continued into an iteration,
`continueSceneShotVideoTakeIteration(...)` creates a new take and calls
`copySelectedShotVideoTakeInputRecords(...)`.

That copy currently:

1. finds selected source media inputs;
2. creates a new `scene_shot_video_take_media_input` row for the target take;
3. retargets `subjectId` when `subjectKind` is `take`;
4. reuses the source `assetId` and `assetFileId`.

Later, `sceneShotVideoTake.delete` gathers all assets attached to the deleted
take and marks them discarded. Because copied takes share the same asset, a
discard operation for one take can mark another active take's selected input
asset as discarded.

This violates the ownership boundary: copied take-owned media is neither a
shared project reference nor an exclusive child of the copied take.

## Desired Behavior

### Iteration Copy

When Core creates a take iteration, selected take-owned media should be copied
as new durable project data:

- create a new `asset` row;
- create new `asset_file` rows;
- copy the physical file bytes to new project-relative paths;
- create a new `scene_shot_video_take_media_input` row pointing to the new
  asset/file;
- update copied prepared-input state to the copied asset/file;
- preserve receipt/provenance where appropriate without pretending the new row
  is a new provider run.

The copied path should be take-scoped so each take has unique media paths. A
proposed path shape is:

```text
generated/media/scene-shot-video-takes/<take-id>/<input-kind>-<asset-file-id>.<ext>
```

The exact low-level filename can be chosen during implementation, but the public
contract is that active take-owned media copies do not share one
project-relative path.

### Take Deletion

Deleting a take should:

- discard the take row;
- discard take shot rows, media input rows, media input shot rows, and video
  rows owned by that take;
- discard assets only when Core proves no other active owner still references
  the same asset/file;
- leave non-owned project references untouched.

If Core finds shared active ownership for a take-owned asset during deletion,
the normal command should fail fast with a structured diagnostic. That shared
state is invalid after this plan. It should not be silently normalized by
React, Studio server routes, CLI handlers, or ad hoc repair logic.

### Existing Development Data

Existing development projects may already contain shared take-owned media rows.
This plan should include one explicit repair path for the current development
database shape. The repair should be a current-contract repair, not a runtime
compatibility layer.

The repair may be a one-time CLI/core command or a focused developer script, but
runtime reads and normal delete behavior must not keep recognizing obsolete
shared owned media as acceptable state.

## Architecture Boundaries

Core owns the rule.

- `packages/core` owns media ownership validation, take iteration copying,
  discard safety, structured diagnostics, and repair behavior.
- `packages/studio` renders the plan and calls focused Core-backed routes. It
  must not decide whether a prompt sheet can be deleted or copied.
- `packages/cli` parses command flags and calls Core. It must not repair shared
  ownership locally.
- Agents and skills may inspect artifacts and recommend workflow actions, but
  they must not be the runtime enforcement layer.

The implementation should avoid generic state patch APIs. Any mutation should
go through focused Shot Video Take and Trash domain commands.

## Proposed Implementation Slices

### Slice 1: Ownership Classification

Define one Core-owned way to classify Shot Video Take media inputs as
take-owned versus non-owned/project-owned references.

The classification should be based on current domain concepts, such as input
kind, subject kind, and relationship table ownership. It should not infer
ownership from filenames or folder paths.

Initial expected take-owned input kinds:

- `video-prompt-sheet`;
- `first-frame`;
- `last-frame`;
- `reference-image`.

Final take videos are also take-owned, though they live in
`scene_shot_video_take_video` rather than `scene_shot_video_take_media_input`.

### Slice 2: File And Asset Copy Service

Add a focused Core service for copying a project asset/file for a new take
owner.

The service should:

- read the source `asset` and `asset_file` rows;
- validate that the source file is active and inside the project;
- create new ids through the caller's id allocator;
- copy bytes to a new project-relative path;
- insert the new `asset` and `asset_file` rows;
- preserve relevant metadata such as media kind, MIME type, size, hash, width,
  height, duration, origin, title, and type;
- return the copied asset id and asset file id.

The service should stay in Core server code near existing project media file and
shot-video take import helpers. It should not live in Studio server routes or
CLI code.

### Slice 3: Iteration Copy Uses Deep Copies For Owned Media

Update `copySelectedShotVideoTakeInputRecords(...)` or move the behavior to a
higher-level Shot Video Take authoring service so copied selected input rows can
choose between:

- deep-copying take-owned media assets/files;
- copying only selection state for non-owned references, where applicable.

The current database access helper may be too low-level for physical file
copies because it does not receive `projectFolder` or project file helpers. If
so, move the copy orchestration out of the database access module and keep
database access functions focused on inserting rows.

### Slice 4: Deletion Safety

Update the Trash object definition for `sceneShotVideoTake` so take deletion
does not mark assets discarded unless they are exclusively owned by that take.

The delete path should detect active rows in:

- `scene_shot_video_take_media_input`;
- `scene_shot_video_take_video`;
- any active asset relationship table that can own the same asset.

When shared active ownership is found for a take-owned media asset, return a
structured diagnostic that names the invalid shared ownership and suggests
repairing the take-owned media copy state.

### Slice 5: Development Data Repair

Add a deliberate repair for existing shared take-owned media in development
projects.

The repair should:

- find active take-owned media inputs that share the same `assetId` or
  `assetFileId` across different active takes;
- choose one existing owner to keep the original asset/file;
- deep-copy the asset/file for each other active take input;
- update the input row and prepared-input state to the copied asset/file;
- leave non-owned references untouched;
- report every changed take/input/asset id through structured diagnostics or a
  structured report.

Do not add compatibility branches to normal runtime reads. After repair, current
data should satisfy the new ownership invariant.

### Slice 6: Documentation And Surfaces

Update architecture documentation and user-facing command guidance as needed.

Likely docs:

- `docs/architecture/shot-video-take-owned-media.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/recoverable-discard-and-trash.md`;
- relevant CLI help or skill guidance only if the implementation exposes a
  repair command or changes agent workflow instructions.

## Test Plan

### Core Unit And Integration Tests

Add focused tests that prove:

- continuing a videoed take with a selected Video Prompt Sheet creates a new
  asset id and asset file id for the copied take;
- copied take-owned media uses a distinct project-relative path;
- the copied file exists and has the same content hash as the source file;
- deleting the source take leaves the copied take's Video Prompt Sheet active
  and visible in `listShotVideoTakeInputs(...)`;
- deleting the copied take leaves the source take's selected media active;
- prepared input state points to the copied asset/file after iteration copy;
- final take videos are discarded only with their owning take;
- non-owned Cast Character Sheet, Location Sheet, Lookbook Sheet, and Dialogue
  Audio references are not copied as new assets and are not discarded by take
  deletion.

### Trash And Repair Tests

Add focused tests that prove:

- take deletion refuses or preserves shared active take-owned assets according
  to the accepted implementation choice;
- Empty Trash cannot move a file still owned by an active asset;
- the repair path copies shared active take-owned media and removes the shared
  ownership state;
- repair does not touch non-owned project references;
- repair updates prepared-input state consistently with media input rows.

### Architecture Tests

Add or update architecture tests only for stable boundaries:

- Studio UI and server route code must not import low-level Trash or database
  modules to enforce take-owned media deletion rules.
- CLI handlers must not mutate `scene_shot_video_take_media_input` or `asset`
  rows directly.
- Tests must not hard-code private helper names or current function inventories.

### Manual Verification

Verify against the real development project after backup:

1. Inspect the active take that lost its Video Prompt Sheet.
2. Run the repair path.
3. Confirm the Video Prompt Sheet card has an image preview again.
4. Delete another copied take iteration.
5. Confirm the repaired active take keeps its Video Prompt Sheet.
6. Preview Empty Trash and confirm it does not include active take-owned media.

## Completion Checklist

### Review Area

- [x] Confirm the product rule: deleting one take never breaks another active
      take.
- [x] Confirm the ownership distinction between take-owned media and non-owned
      references.
- [x] Confirm no Studio UI or Studio server route implements ownership rules
      locally.
- [x] Confirm no CLI handler mutates durable take media ownership directly.

### Architecture And Contracts

- [x] Add the Shot Video Take-owned media architecture note.
- [x] Link the architecture note from media generation and Trash docs.
- [x] Define the Core-owned take-owned media classification.
- [x] Define structured diagnostics for invalid shared take-owned media.
- [x] Define the repair command/report contract if a repair command is used.
- [x] Confirm no compatibility alias, fallback loader, or old-shape runtime
      branch is introduced.

### Implementation Slices

- [x] Add focused asset/file copy support for take-owned media.
- [x] Update take iteration copy to deep-copy selected take-owned input media.
- [x] Preserve non-owned reference selection behavior without duplicating
      referenced assets.
- [x] Update prepared-input state after copied media gets new asset/file ids.
- [x] Update take deletion to discard only exclusively owned media assets.
- [x] Add shared-owner detection for take-owned media assets.
- [x] Add the development-data repair path.
- [x] Keep resource keys scoped to affected takes, inputs, and assets.

### UI, CLI, And Agent Surfaces

- [x] Keep Studio References and AI Production tabs as Core projection
      consumers.
- [x] Update CLI help only if a repair command is added.
- [x] Update Studio Skills guidance only if the repair or workflow contract
      changes agent behavior. No Studio Skills change was needed for the Core
      repair command.
- [x] Do not add visible UI copy that explains internal ownership rules unless
      a user-facing repair workflow needs it.

### Validation And Tests

- [x] Add iteration-copy regression tests for Video Prompt Sheet ownership.
- [x] Add deletion regression tests for source and copied takes.
- [x] Add non-owned reference tests for Cast, Location, Lookbook, and Dialogue
      Audio references. Existing reference-selection coverage plus the
      relationship-owned asset regression confirm non-owned references are not
      duplicated or discarded by take deletion.
- [x] Add repair tests for already-shared take-owned media.
- [x] Add architecture tests for boundary protection, avoiding private helper
      name inventories.
- [x] Run focused Core tests for shot-video take persistence, selection,
      imports, and Trash behavior.
- [x] Run the appropriate package/root checks after implementation.

### Documentation And Final Verification

- [x] Update architecture docs to reflect the accepted ownership rule.
- [x] Record any follow-up decision if implementation reveals a broader asset
      ownership issue outside Shot Video Takes. No broader follow-up decision
      was needed.
- [x] Back up the real development project before repair verification.
- [x] Verify the repaired active take shows the Video Prompt Sheet preview.
- [x] Verify deleting another copied take does not discard active take-owned
      media on remaining takes.
- [x] Verify Empty Trash preview does not include active take media.
