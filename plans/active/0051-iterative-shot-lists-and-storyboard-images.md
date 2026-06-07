# 0051 Iterative Shot Lists And Per-Shot Storyboard Images

Status: implemented
Date: 2026-06-07

## Summary

Scene Shot Lists are no longer a one-time artifact. Users need to iterate on
shots the same way they iterate on screenplay scenes:

- expand one shot into several shots;
- expand a shot range such as shots 2-4;
- replace one shot or a group of shots;
- delete shots;
- regenerate a full shot list as a new version;
- update shots after the narrative changes, so the visual plan does not drift
  away from the screenplay.

Every resulting shot still needs a storyboard image. The current architecture
can write a whole shot list and can generate/import storyboard sheets, but it
does not yet have a first-class operation model for iterative shot-list edits or
a durable storage model where the cropped shot images are the only kept
storyboard assets.

This plan changes the architecture from "save a storyboard sheet asset, then
look up cropped images through that sheet" to "use sheets only as temporary
generation batches, then durably store per-shot storyboard images."

The practical product result is:

- agents can update shot lists in small, reviewable operations;
- shot-list edits create new history versions and activate them only when
  requested;
- every edit targets explicit scene and shot-list ids, not transient Studio
  focus or the current active selection at write time;
- users can restore previous narrative or shot-list iterations through CLI and
  skill workflows;
- unchanged shots can carry forward existing storyboard images;
- new or changed shots are reported as needing storyboard images;
- storyboard sheets generated for `scene.storyboard-sheet` are never imported as
  Assets;
- Studio sequence cards show a 2x2 grid of actual shot images instead of the
  original sheet image;
- narrative scene revisions report which shot lists now need sync work.

## What Was Inspected

The inspected skill files live in:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

The installed local Renku skill cache currently matches the external skill
copies for the relevant files:

- `scene-shot-designer/SKILL.md`
- `scene-shot-designer/references/shot-list-cli-workflow.md`
- `scene-shot-designer/references/scene-shot-list-json-contract.md`
- `scene-shot-designer/references/shot-design-guidelines.md`
- `media-producer/SKILL.md`
- `media-producer/references/scene-storyboard-sheet.md`
- `screenplay-drafter/SKILL.md`
- `screenplay-drafter/references/screenplay-json-workflow.md`
- `screenplay-drafter/references/screenplay-json-contract.md`

The inspected CLI and core support includes:

- `packages/cli/src/commands/screenplay-command.ts`
- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/cli/src/commands/generation-purpose-command-registry.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/client/media-generation.ts`
- `packages/core/src/client/resources.ts`
- `packages/core/src/server/commands/scene-shot-list-commands.ts`
- `packages/core/src/server/media-generation/scene-storyboard-sheet.ts`
- `packages/core/src/server/resources/scene-storyboard-ui.ts`
- `packages/core/src/server/resources/screenplay-ui.ts`
- `packages/core/src/server/schema/scene-shot-lists.ts`
- `packages/core/src/server/database/access/scene-shot-lists.ts`
- `packages/studio/src/features/movie-studio/sequences/sequence-panel.tsx`
- `packages/studio/src/features/movie-studio/sequences/sequence-storyboard-layout.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shots-tab.tsx`

## Current State

### What Works Today

Agents can design and save a complete Scene Shot List:

```bash
renku screenplay shot-list context --scene <scene-id> --json
renku screenplay shot-list validate --file <shot-list-json> --json
renku screenplay shot-list write --file <shot-list-json> --json
renku screenplay shot-list show --active --scene <scene-id> --json
```

Every `write` creates a new scene-owned history row and marks it active.

Storyboard generation already supports one to four selected shot ids per
`scene.storyboard-sheet` spec:

```bash
renku generation context \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --json

renku generation spec create --file <spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
```

The generation spec shape already contains:

```json
{
  "purpose": "scene.storyboard-sheet",
  "target": { "kind": "scene", "id": "scene_control_room" },
  "shotListId": "scene_shot_list_control_room_v1",
  "shotIds": ["shot_001", "shot_002", "shot_003", "shot_004"],
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A clean storyboard sheet.",
  "takeCount": 1,
  "sheetFrame": "4:3",
  "shotFrame": "project",
  "detail": "standard",
  "outputFormat": "png"
}
```

The current Studio scene shot resource already exposes both:

- `storyboardSheet`
- `storyboardImagesByShotId`

That means the browser can migrate from sheet display to per-shot image display
without inventing file-name based lookup.

### What Does Not Work Yet

The current shot-list skill can only save a complete replacement document. It
does not have an agent-facing operation contract for:

- "expand this shot";
- "expand shots 2-4";
- "replace shots 2-4";
- "delete shots 5 and 7";
- "regenerate the full list from scratch";
- "update the shots after I revised the scene."

The current storyboard import path still requires sheet files:

```json
{
  "kind": "sceneStoryboardSheetImport",
  "sheets": [
    {
      "source": "generated/media/sheet.png",
      "shots": [
        { "shotId": "shot_001", "source": "generated/media/shot-001.png" }
      ]
    }
  ]
}
```

Core then stores:

- an Asset with `type: "scene_storyboard_sheet"`;
- an Asset File with `role: "sheet"`;
- one or more Asset Files with `role: "shot"`;
- a `scene_shot_storyboard_sheet` row;
- `scene_shot_storyboard_image` rows pointing back to the sheet row.

That conflicts with the new product direction. For this specific scene shot-list
storyboard workflow, the sheet is a temporary cost-saving generation artifact.
It should not be a durable Studio Asset.

This plan applies only to scene shot-list storyboard sheets. It must not change
the storage policy for:

- cast character sheets;
- location environment sheets;
- Lookbook sheets;
- `shot.multi-shot-storyboard-sheet` assets used as shot video take
  dependencies.

## Goals

1. Make shot-list iteration a first-class agent and CLI workflow.
2. Keep shot-list versions reviewable by creating a new history row for
   agent-driven structural edits.
3. Preserve or carry forward storyboard images only when the same shot remains
   valid.
4. Mark changed, inserted, expanded, or narrative-impacted shots as needing new
   storyboard images.
5. Keep `scene.storyboard-sheet` as the temporary batch-generation purpose for
   one to four storyboard panels, including one-shot cases.
6. Use the same sheet-generation-and-slicing workflow for every storyboard
   request so visual style stays deterministic.
7. Replace durable storyboard sheet assets with durable per-shot storyboard
   image records.
8. Update sequence cards to show actual shot images in a 2x2 card preview.
9. Give screenplay scene revisions an agent-friendly way to report impacted
   shot lists.
10. Add CLI and skill support for undoing narrative and shot-list iterations.
11. Update external skills so agents can use the new commands safely.

## Non-Goals

- Do not preserve old storyboard sheet import behavior as a compatibility path.
- Do not keep aliases for obsolete import document kinds.
- Do not introduce crop boxes, grid cells, extraction confidence, OCR results,
  rough quadrant slicing metadata, or other crop diagnostics into app state.
- Do not store generated storyboard image paths inside Scene Shot List JSON.
- Do not make Studio perform sheet slicing.
- Do not add a direct per-shot storyboard generation purpose in this slice.
- Do not change storage policy for character sheets, location sheets, Lookbook
  sheets, or `shot.multi-shot-storyboard-sheet`.
- Do not make mobile layout changes. Renku Studio is desktop-first.
- Do not add a generic media-purpose framework.
- Do not add final edit timeline behavior. Scene Shot Lists remain coverage
  planning, not the cut.

## Product Workflows

### Expand One Shot

User intent:

```text
Expand Shot 3 into a wider reveal, a close-up of Urban, and an insert of the
coins.
```

Agent workflow:

1. Resolve the target scene and base shot list once, using explicit ids from the
   user, Studio context, or a read command.
2. Read that deterministic base shot list by `shotListId`.
3. Resolve "Shot 3" to the durable `shotId` at index 3 in the base list.
4. Draft a `sceneShotListOperations` document that replaces that one shot with
   several new shots.
5. Validate and dry-run against the same `sceneId` and `baseShotListId`.
6. Apply, creating a new shot-list version derived from the base list.
7. Read storyboard status for the new shot-list id returned by apply.
8. Generate storyboard sheets for the inserted shots, even if only one image is
   needed.
9. Import only the cropped shot images.
10. Read back the new shot list and storyboard status.

Expected impact:

- the old shot is absent from the new target shot list;
- any old image for that removed `shotId` is not shown on the new target list;
- each replacement shot has a storyboard image before the agent calls the task
  complete.
- the write does not depend on what scene, sequence, or shot list is active in
  Studio while the agent is working.

### Expand A Range

User intent:

```text
Expand shots 2-4 into a more detailed negotiation beat.
```

Agent workflow:

1. Resolve display indexes 2-4 to ordered durable shot ids.
2. Replace that contiguous range with the authored replacement shots.
3. Preserve storyboard images for unchanged shots outside the range.
4. Generate storyboard sheets for the replacement shots.

Expected impact:

- unchanged shots before and after the range keep their existing images when
  their shot ids and content are still valid;
- inserted replacement shots are reported as missing storyboard images until
  generation/import finishes.

### Replace Shots

User intent:

```text
Replace shots 5 and 6 with one stronger two-shot.
```

Agent workflow:

1. Resolve the selected shots.
2. Replace those shot ids with one new shot.
3. Mark old production groups and video dependencies that reference removed
   shot ids as stale or prune them.
4. Generate one storyboard sheet with one filled panel for the new shot.

Expected impact:

- the new target shot list is internally valid;
- shot video take groups do not keep deleted shot ids;
- Studio does not show images for removed shots.

### Create A Full New Shot List Version

User intent:

```text
Give me a new version of the whole shot list with more restrained coverage.
```

Agent workflow:

1. Resolve the target scene and any source/base shot list explicitly.
2. Draft a full replacement list.
3. Validate through the current shot-list validator.
4. Write as a new history row and activate it only when requested.
5. Generate storyboard sheets for every shot in the new target list.

Expected impact:

- this can keep using `renku screenplay shot-list write`;
- the operation path may also support `shotList.replace`;
- existing images are not assumed valid unless the same shot ids are
  deliberately preserved and the operation asks to reuse them.

### Delete Shots

User intent:

```text
Delete shots 7 and 8.
```

Agent workflow:

1. Resolve shot indexes or names to durable shot ids.
2. Apply a delete operation.
3. Create a derived shot-list version from the explicit base list.
4. Carry forward images for remaining shots.
5. Report that no storyboard generation is needed if no remaining shot is
   missing an image.

Expected impact:

- removed shot ids disappear from shot-list, storyboard status, and preview
  grids;
- production groups and selected inputs referencing removed shot ids are pruned
  or reported stale.

### Update Shots After Narrative Changes

User intent:

```text
I rewrote the scene. Update the shots so they match the new narrative.
```

Agent workflow:

1. Use the screenplay drafter workflow to revise the scene.
2. Save the narrative through the screenplay CLI.
3. Read an impact report that identifies affected scenes and active shot lists.
4. Compare old shot coverage to the new scene blocks.
5. Apply shot-list operations to insert, delete, or regenerate shots.
6. Generate/import storyboard sheet crops for every missing or stale shot.

Expected impact:

- screenplay remains the source of narrative truth;
- shot lists can be revised without changing the narrative when the user wants
  purely visual iteration;
- when the narrative does change, stale shot coverage is not silently ignored.

## Deterministic Targeting

Shot-list and narrative mutation commands must not depend on transient state at
write time.

Transient state includes:

- the currently focused Studio surface;
- the scene, sequence, or shot selected in the browser;
- the current active shot list for a scene;
- the active sequence or act in the sidebar;
- any focus returned by `renku studio current`.

Agents may use transient state only during target discovery. For example, if the
user says "the selected scene," the agent may read Studio focus once to discover
the scene id. After that point, every mutation document and command must carry
explicit durable ids.

Required mutation inputs:

- shot-list operations include `sceneId` and `baseShotListId`;
- shot-list writes include `sceneId` in the document and may include
  `sourceShotListId` in the command/report when they are a deliberate new
  version of a known list;
- storyboard generation specs include `sceneId`, `shotListId`, and `shotIds`;
- storyboard imports include `sceneId`, `shotListId`, and `shotIds`;
- screenplay scene revisions include `sceneId` and the full replacement scene.

The active shot list may change while an agent is working because the user
browsed elsewhere or another workflow completed. That must not change what the
agent writes. Applying operations against `baseShotListId` creates a new
derived shot-list version from that base, regardless of which shot list is
currently active for the scene.

Activation is explicit. A shot-list operation document says whether the new
derived list should become active for its scene. If it activates the new list,
it only changes the active shot list for `sceneId`; it must never use current
Studio focus to choose a scene.

## Domain Model Direction

### Scene Shot List Operations

Add a new browser-safe operation document:

```ts
export interface SceneShotListOperationDocument {
  kind: 'sceneShotListOperations';
  sceneId: string;
  baseShotListId: string;
  activate: boolean;
  title?: string;
  summary?: string;
  coverageStrategy?: string;
  lookbookInfluence?: string;
  operations: SceneShotListOperation[];
  openQuestions?: string[];
}
```

Operation types:

```ts
export type SceneShotListOperation =
  | SceneShotListInsertShotsOperation
  | SceneShotListReplaceShotsOperation
  | SceneShotListUpdateShotOperation
  | SceneShotListDeleteShotsOperation
  | SceneShotListReplaceAllShotsOperation;
```

Proposed shapes:

```ts
export interface SceneShotListInsertShotsOperation {
  operation: 'shots.insert';
  placement:
    | { position: 'start' }
    | { position: 'end' }
    | { position: 'before'; shotId: string }
    | { position: 'after'; shotId: string };
  shots: SceneShot[];
  storyboardPolicy?: SceneShotListStoryboardPolicy;
}

export interface SceneShotListReplaceShotsOperation {
  operation: 'shots.replace';
  shotIds: string[];
  shots: SceneShot[];
  storyboardPolicy?: SceneShotListStoryboardPolicy;
}

export interface SceneShotListUpdateShotOperation {
  operation: 'shot.update';
  shot: SceneShot;
  storyboardPolicy?: SceneShotListStoryboardPolicy;
}

export interface SceneShotListDeleteShotsOperation {
  operation: 'shots.delete';
  shotIds: string[];
}

export interface SceneShotListReplaceAllShotsOperation {
  operation: 'shotList.replace';
  shots: SceneShot[];
  storyboardPolicy?: SceneShotListStoryboardPolicy;
}

export type SceneShotListStoryboardPolicy =
  | 'generate'
  | 'reuse-if-unchanged'
  | 'missing-only';
```

Rules:

- operations use durable `shotId` values, never display labels such as `Shot 3`;
- agents may translate user-facing shot numbers into durable ids after reading
  the explicit base shot list;
- `baseShotListId` is the deterministic source version for the edit; it does not
  have to be the current active shot list at apply time;
- the resulting shot list records `baseShotListId` or equivalent provenance so
  history can show what it was derived from;
- `activate` controls whether the derived list becomes active for `sceneId`;
- default storyboard policy is `generate` for inserted/replaced/updated shots
  and `reuse-if-unchanged` for untouched shots;
- updated shots regenerate by default; reusing an old image for changed shot
  content is out of scope until a deliberate pin/reuse UX exists;
- validation runs against the resulting full `SceneShotListDocument`;
- apply creates a new history row and activates it only when requested;
- existing UI autosave for structured shot specs can keep its in-place update
  path because that is a direct UI tuning flow, not agent structural editing.

### Shot Storyboard Image Records

Replace durable sheet-centered storage with shot-image-centered storage.

Current tables:

```text
scene_shot_storyboard_sheet
scene_shot_storyboard_image
```

New durable table direction:

```text
scene_shot_storyboard_image
```

Proposed fields:

```text
id
scene_id
shot_list_id
shot_id
asset_id
asset_file_id
source_purpose
shot_content_fingerprint
created_at
updated_at
```

Notes:

- `scene_id` makes scene queries direct and avoids requiring a sheet join.
- `shot_list_id` ties the image to one version of the shot list.
- `shot_id` ties the image to one shot inside that shot list.
- `asset_id` points at a durable image Asset for the cropped shot image.
- `asset_file_id` points at the actual image file.
- `source_purpose` records that the image came from temporary
  `scene.storyboard-sheet` slicing.
- `shot_content_fingerprint` lets core detect whether a carried-forward image
  still matches the shot text/specs it was created for.

The exact Drizzle migration must be generated through Drizzle Kit during
implementation. Do not hand-write migration SQL unless the architecture
explicitly accepts a custom migration first.

### Asset Policy

For `scene.storyboard-sheet`:

- generation specs and run records may remain as generation history;
- generated composite sheet files may exist as provider run output or temporary
  files;
- the sheet file must not be copied into screenplay storyboard asset folders;
- the sheet file must not become an Asset;
- the sheet file must not appear in Studio sequence cards, act overviews, or
  scene shot resources as the scene's storyboard image;
- import commands must reject sheet sources for this purpose after the new
  contract lands.

For per-shot storyboard images:

- each imported shot image becomes durable project media;
- the imported image is attached to the scene and mapped to `shotListId` plus
  `shotId`;
- latest ready image for a shot is the one Studio uses;
- older images can remain as history but must not appear for inactive shot
  lists unless that inactive list is explicitly restored.

## Media Generation Direction

### Temporary Sheet Generation

Keep `scene.storyboard-sheet` as the only storyboard image generation purpose
for scene shot-list storyboards.

Use it for every storyboard request, including one-shot requests. This keeps
prompt shape, visual style, generation behavior, and slicing behavior
deterministic.

The spec continues to require:

- `purpose: "scene.storyboard-sheet"`
- `target.kind: "scene"`
- `shotListId`
- `shotIds` with one to four ids
- `sheetFrame: "4:3"`
- `shotFrame`
- fixed `takeCount: 1`

The skill batches selected missing shots in groups of four. A partially filled
sheet leaves unused panel slots empty; it does not switch to a different direct
image generation purpose.

- 1 missing shot -> one sheet with one filled shot panel;
- 4 missing shots -> one sheet;
- 5 missing shots -> one four-shot sheet plus one one-shot sheet;
- 8 missing shots -> two sheets;
- 9 missing shots -> two sheets plus one one-shot sheet.

The point is cost and speed, not durable storage. A sheet is a temporary
generation helper that gets visually inspected and sliced by the agent.

### Import Per-Shot Images

Add a durable import document:

```ts
export interface SceneStoryboardImagesImportDocument {
  kind: 'sceneStoryboardImagesImport';
  title?: string;
  shotListId: string;
  shots: Array<{
    shotId: string;
    source: string;
    title?: string;
    sourcePurpose?: 'scene.storyboard-sheet';
    sourceSpecId?: string;
    sourceRunId?: string;
  }>;
}
```

CLI shape for one cropped shot image:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id> \
  --source generated/media/shot-005.png \
  --json
```

CLI shape for multiple sliced images:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --file scene-storyboard-images-import.json \
  --json
```

Rules:

- the import document lists only shot image files;
- sheet source fields are invalid;
- duplicate `shotId` values are invalid;
- every imported shot must belong to the target shot list;
- the command may cover only a subset of the shot list;
- source paths must be project-relative and inside the project;
- imported files become durable shot storyboard image assets;
- resource keys include the scene shot surface and every changed shot id.

## CLI Contracts

### Shot-List Edit Commands

Add:

```bash
renku screenplay shot-list apply --file <operations-json> --json
renku screenplay shot-list apply --file <operations-json> --dry-run --json
renku screenplay shot-list validate-operations --file <operations-json> --json
```

`apply` report:

```ts
export interface SceneShotListApplyReport extends SceneShotListCommandReport {
  sceneId: string;
  baseShotListId: string;
  createdShotListId: string;
  activatedShotListId: string | null;
  shotList: SceneShotListSummary;
  changes: SceneShotListApplyChange[];
  storyboard: SceneShotListStoryboardStatus;
}
```

Required report details:

- created shot-list id;
- inserted shot ids;
- removed shot ids;
- updated shot ids;
- carried-forward storyboard image ids;
- stale storyboard images;
- missing storyboard images;
- pruned or stale video take rail groups;
- resource keys.

### Storyboard Status Command

Add:

```bash
renku screenplay shot-list storyboard status \
  --scene <scene-id> \
  --shot-list <shot-list-id> \
  --json
```

Report:

```ts
export interface SceneShotListStoryboardStatus {
  sceneId: string;
  shotListId: string;
  shots: Array<{
    shotId: string;
    image: null | {
      storyboardImageId: string;
      assetId: string;
      assetFileId: string;
      sourcePurpose: string;
      isCurrentForShot: boolean;
    };
    needsStoryboardImage: boolean;
    reason?: 'missing' | 'shot-changed' | 'narrative-changed';
  }>;
  missingShotIds: string[];
  staleShotIds: string[];
  readyShotIds: string[];
}
```

The command is read-only. It lets agents decide exactly which shots need image
generation after an edit.

### Generation Purpose Registry

Do not add a direct shot storyboard generation purpose.

Keep `scene.storyboard-sheet` as the single generation purpose for this
workflow. Ensure generation parsing and validation keep accepting one to four
explicit `shotIds` for that purpose, including a one-shot sheet where unused
panel slots remain empty.

### Media Import Registry

Change `scene.storyboard-sheet` import behavior:

- remove support for importing durable sheet Assets for scene shot-list
  storyboards;
- do not keep the old `sceneStoryboardSheetImport` document kind;
- do not accept `--source` or `--file` shapes that include sheet source files;
- replace the durable import document with `sceneStoryboardImagesImport`;
- keep the CLI purpose as `scene.storyboard-sheet`, because these shot images
  come from sliced temporary scene storyboard sheets.

This is not a compatibility migration. It is a direct contract change in a
pre-customer codebase.

### Screenplay Scene Revision Helper

Current narrative mutation support exists through:

```bash
renku screenplay show --json
renku screenplay scene show <scene-id> --json
renku screenplay validate --file <operations-json> --json
renku screenplay apply --file <operations-json> --json
```

That is sufficient for broad screenplay changes, but it is not ergonomic for
scene-by-scene agent edits that must immediately synchronize shot lists.

Add a focused scene revision command:

```bash
renku screenplay scene revise \
  --scene <scene-id> \
  --file <scene-revision-json> \
  --json

renku screenplay scene revise \
  --scene <scene-id> \
  --file <scene-revision-json> \
  --dry-run \
  --json
```

Input:

```ts
export interface ScreenplaySceneRevisionDocument {
  kind: 'screenplaySceneRevision';
  scene: Scene;
}
```

Rules:

- this is not a compatibility wrapper around `screenplay apply`;
- it owns scene-specific validation, impact reporting, and Studio resource
  keys;
- the scene must include the full `setting` and full `blocks` array, matching
  the current `scene.update` contract;
- it must use the same core screenplay operation engine internally to avoid
  separate mutation semantics;
- it returns an impact report for active shot lists on the revised scene.

Report addition:

```ts
export interface ScreenplayShotListImpact {
  sceneId: string;
  activeShotListId: string | null;
  changedBlockIndexes: number[];
  deletedBlockIndexes: number[];
  insertedBlockIndexes: number[];
  uncoveredBlockIndexes: number[];
  shotsReferencingChangedBlocks: string[];
  shotsReferencingDeletedBlocks: string[];
  suggestedNextCommand: string | null;
}
```

Also enhance `screenplay apply --dry-run` and `screenplay apply` reports to
include the same impact data whenever scene operations are present.

### History And Undo Commands

Shot-list history already exists as scene-owned shot-list rows. The CLI and
skills should treat that as the undo mechanism:

```bash
renku screenplay shot-list list --scene <scene-id> --json
renku screenplay shot-list show --shot-list <shot-list-id> --json
renku screenplay shot-list set-active --scene <scene-id> --shot-list <shot-list-id> --json
```

Required improvements:

- `shot-list apply` reports `baseShotListId`, `createdShotListId`, and
  `activatedShotListId`;
- `shot-list list` should expose enough created/updated/provenance information
  for a skill to identify the previous iteration;
- the `scene-shot-designer` skill should use `set-active` when the user asks to
  go back to a previous shot-list version;
- undo should restore the selected shot list as active for its own scene only,
  not for the current Studio focus.

Narrative history is not equivalent today because screenplay mutations replace
the current screenplay document. Add a durable screenplay revision history:

```text
screenplay_revision
```

Proposed fields:

```text
id
screenplay_document
source_command
summary
created_at
```

Every successful screenplay mutation should record a full canonical screenplay
revision:

- initial screenplay create;
- broad `screenplay apply`;
- focused `screenplay scene revise`;
- future restore operations.

Add CLI commands:

```bash
renku screenplay revision list --json
renku screenplay revision show --revision <revision-id> --json
renku screenplay revision restore --revision <revision-id> --json
```

Restore rules:

- restore replaces the current screenplay with the selected revision;
- restore itself creates a new revision entry so undo history remains auditable;
- restore returns shot-list impact reports for scenes whose narrative changed
  relative to the previously current screenplay;
- restore emits resource keys for screenplay, affected scenes, and affected
  shot-list surfaces;
- skills should use restore for "go back to the previous narrative version" and
  must not reconstruct old narrative state from chat memory.

The future visual history browser is out of scope for this plan. The required
surface for now is CLI plus skill support.

## Studio UI Direction

### Sequence Cards

Current behavior:

- `readSequenceResource` attaches `storyboardSheet` to each scene row.
- `SequencePanel` passes that single image to `ScreenplayImageCard`.
- The visible card shows the full sheet or "Storyboard image pending."

New behavior:

- sequence resources expose a `storyboardPreview` for each scene;
- `storyboardPreview` contains the first two and last two shot images from the
  scene's active shot list, in shot-list order, with duplicates removed;
- if the preferred first-two/last-two shots are missing images, the preview
  selects the nearest available shot images while preserving shot-list order;
- if fewer than four images are available, the remaining grid slots stay empty
  and quiet; they do not show placeholder text, placeholder icons, raw filenames,
  ids, or generated labels;
- the card keeps the same outer size as today;
- the image area renders a stable 2x2 grid inside the card.

Proposed resource type:

```ts
export interface SequenceSceneStoryboardPreview {
  shotListId: string;
  images: Array<{
    shotId: string;
    image: ScreenplayImageReference | null;
  }>;
}

export interface SequenceSceneRow extends SceneNavigationRow {
  storyboardPreview?: SequenceSceneStoryboardPreview;
}
```

Selection rule:

```text
1 shot:  [1]
2 shots: [1, 2]
3 shots: [1, 2, 3]
4 shots: [1, 2, 3, 4]
5+ shots: [1, 2, last - 1, last]
```

When one of those preferred shots has no image, walk toward the nearest shot in
shot-list order that does have an image. Do not duplicate a selected image.

### Scene Shots Tab

The Scene Shots tab already consumes `storyboardImagesByShotId`. It should keep
doing that, but the resource no longer needs `storyboardSheet` once the storage
model changes.

The scene shot rail should:

- show the current per-shot image when one exists;
- show a quiet placeholder for shots that need images;
- refresh when `scene-shot-list:<shot-list-id>:shot:<shot-id>` resource keys
  change;
- never infer storyboard state from filenames.

### Act Storyboard Overview

The act overview already renders one thumbnail per shot from per-shot images.
It should stop requiring a sheet reference before rendering shots. The current
projection returns no shots when there is no `sheetReference`; that must change
to use per-shot image coverage directly.

## Skill Updates

### `scene-shot-designer`

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/scene-shot-designer/SKILL.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/scene-shot-designer/references/shot-list-cli-workflow.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/scene-shot-designer/references/scene-shot-list-json-contract.md
```

Required behavior:

- classify user intent as brainstorm, full write, structural edit, active-state
  change, storyboard status, or storyboard media handoff;
- use `shot-list apply` for expand/replace/delete/range edits;
- use `shot-list write` for full new versions when a complete replacement is
  clearer;
- always read storyboard status after a shot-list mutation;
- hand missing storyboard images to `media-producer`;
- never call a task complete while the target shot list has missing images
  unless the user explicitly asked for text-only shot-list work;
- keep using durable shot ids in JSON, not display labels.

The skill should explain that user phrases such as "shots 2-4" are translated
to durable shot ids by reading the explicit base shot list first. It must not
re-read Studio focus or the current active shot list before a write and silently
change the target.

### `media-producer`

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/scene-storyboard-sheet.md
```

Add:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/scene-storyboard-images-import.json
```

Required behavior:

- treat `scene.storyboard-sheet` outputs as temporary sheets;
- inspect and crop temporary sheets with vision;
- import only cropped shot files through `scene.storyboard-sheet` with the new
  `sceneStoryboardImagesImport` document;
- use `scene.storyboard-sheet` generation for a single missing shot, leaving the
  unused sheet slots empty;
- use sheets for every batch of one to four shots;
- for five or nine missing shots, use full four-shot sheets plus another
  partially filled sheet for the leftover single;
- do not import sheet files as Assets;
- do not use `shot.first-frame` as a substitute for storyboard image creation.

### `screenplay-drafter`

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/SKILL.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/screenplay-drafter/references/screenplay-json-workflow.md
```

Required behavior:

- for scene-by-scene narrative edits, prefer
  `renku screenplay scene revise --scene <scene-id> --file <scene-revision-json> --json`;
- for broad screenplay edits, continue to use `renku screenplay apply`, but
  expect the same shot-list impact reports when scene operations are present;
- after any scene revision or broad scene-affecting apply, read or use the
  returned shot-list impact report;
- when the user asks for shots to stay synchronized with the narrative, hand off
  to `scene-shot-designer` with the impacted scene and active shot list;
- do not mutate shot lists inside the screenplay drafter skill;
- do not silently leave stale shot coverage after a narrative edit when the user
  asked for visual sync.

## Narrative And Shot-List Sync

Screenplay blocks are referenced in shot lists by `coveredBlockIndexes` and
dialogue block/line indexes. Narrative edits can make those references stale.

The sync workflow needs to detect:

- newly inserted action or dialogue blocks with no shot coverage;
- deleted blocks still referenced by shots;
- dialogue line count changes;
- cast speaker changes;
- scene setting location changes;
- cast/location references removed from the scene but still used by shots;
- scene title or story function changes that alter the coverage intent.

When a screenplay scene is revised, core should return an impact report. The
agent then chooses a shot-list operation strategy:

- keep existing shots and adjust coverage indexes;
- insert new shots for new blocks;
- delete shots that only covered deleted material;
- replace stale shots whose story beat changed;
- regenerate storyboard images for changed shots;
- preserve images for unchanged shots.

This keeps narrative as the source of truth without removing the user's ability
to do purely visual shot-list edits.

## Edge Cases To Handle

- User says "Shot 3" based on an old UI screenshot. The agent must resolve the
  durable shot id from an explicit `baseShotListId`, not from the current active
  list at write time.
- The user browses to another scene while the agent is working. The pending
  mutation must still target the explicit `sceneId` and `baseShotListId` in the
  operation document.
- Another workflow changes the active shot list for the same scene while the
  agent is working. Applying operations against `baseShotListId` should still
  create a deterministic derived version from that base; it should not silently
  rebase onto the new active list.
- `baseShotListId` belongs to a different scene than `sceneId`. Validation must
  fail before mutation.
- `baseShotListId` no longer exists. Validation must fail with a structured
  diagnostic.
- A command tries to infer target scene, sequence, or shot list from current
  Studio focus during apply/import/generation. Tests should catch and reject
  that code path.
- User names a non-contiguous set such as "shots 2, 4, and 7." The operation
  can delete or update non-contiguous ids, but a replacement range should keep
  replacement placement deterministic.
- User expands a shot that already has a storyboard image. The removed original
  image must not appear on the new target list unless one replacement shot
  deliberately reuses the same shot id and image.
- User edits a shot but preserves its `shotId`. Core should compare the
  storyboard image fingerprint with the updated shot content and report the
  image stale. The default is regeneration; reusing the old image requires a
  future pin/reuse UX that is outside this slice.
- User deletes every shot in a list. Validation should reject an empty active
  shot list unless the command is explicitly a draft-only operation that is not
  persisted.
- User inserts shots with duplicate `shotId` values. Validation must fail before
  mutation.
- User replaces a range with shots that reference cast or location ids no longer
  used by the scene. Validation should report structured warnings or errors
  according to the existing shot-list rules.
- User changes scene location in the screenplay. Existing shots that point to
  old locations should be reported as impacted.
- User changes dialogue lines. Dialogue references with out-of-range
  `lineIndexes` must be reported.
- User updates the Lookbook after storyboard images exist. The images are not
  automatically stale unless the user asks to regenerate for the new Lookbook,
  but storyboard status should be able to include a future Lookbook mismatch
  warning.
- User changes project aspect ratio. Existing images may remain viewable, but
  new generation should use the current project aspect ratio.
- A generated sheet has only three clean crop-ready panels for four requested
  shots. The import should cover only clean cropped files and status should keep
  the missing shot marked as needing an image.
- A one-shot sheet generation returns a bad panel. The agent should not import
  the crop; storyboard status remains missing for that shot.
- A generation spec was created for an older shot-list id. Estimate/run should
  fail fast if the shot list no longer exists or the selected shot ids are not
  in it.
- A media import references a shot id from a different shot list. Import must
  fail with a structured diagnostic.
- A media import includes a temporary sheet source. Import must fail after the
  new contract lands.
- A media import includes fewer than all selected shots from a sheet because
  some panels were not clean enough to crop. Import should accept clean crops and
  storyboard status should keep the omitted shots missing.
- An inactive shot list is restored. Storyboard images tied to that shot-list id
  should become visible again.
- Existing shot video production groups reference removed shot ids. Apply should
  prune invalid groups or report them as stale, not leave broken groups hidden
  in the document.
- Multi-shot video dependencies such as `shot.multi-shot-storyboard-sheet`
  should not be confused with scene shot-list storyboard images. Their durable
  storage policy remains unchanged.
- Two agents apply operations from the same base shot list. Both creates can be
  deterministic derived versions because neither mutates the base row; activation
  should follow each operation's explicit `activate` flag and resource events
  should identify the created shot-list ids.
- The user says "undo that shot-list change." The skill should restore the
  previous shot-list version through the CLI rather than trying to reverse-patch
  the latest document by hand.
- The user says "undo that screenplay change." The skill should restore a saved
  screenplay revision through the CLI rather than reconstructing the previous
  screenplay from chat memory.

## Testing Expectations

Do not treat tests as a thin smoke layer for this work. Shot-list iteration,
storyboard image import, deterministic targeting, and undo are stateful features
where regressions can silently corrupt user work.

Implementation should prefer integration-style core and CLI tests that exercise
real project data services, real command handlers, real SQLite project state,
and real resource projections. Use mocks only where external provider calls or
browser-only rendering boundaries make them necessary.

Every edge case above should either have a direct test or be covered by a
clearly named broader test. Tests should assert concrete outcomes, including:

- created shot-list ids;
- activated shot-list ids;
- unchanged active state when activation is false;
- exact shot order after insert, replace, update, delete, and replace-all;
- carried-forward storyboard image ids;
- stale and missing storyboard image status;
- absence of sheet files in durable Assets;
- resource keys emitted by CLI mutations;
- screenplay revision ids;
- restored screenplay content;
- shot-list impact reports after scene revise, broad apply, and revision
  restore;
- sequence preview image selection and empty slot rendering.

## Package Responsibilities

### Core

Core owns:

- operation document types and JSON schemas;
- operation application against explicit `sceneId` and `baseShotListId`;
- validation of the resulting full shot-list document;
- shot image carry-forward rules;
- storyboard status reports;
- shot image import storage;
- sequence and act storyboard projections;
- screenplay scene revision impact reports;
- screenplay and shot-list history restoration support;
- structured diagnostics for invalid operations, stale bases, and broken media
  imports.

### CLI

The CLI owns:

- thin command parsing;
- reading JSON input;
- passing structured command requests to core;
- writing JSON reports;
- Studio resource-change events after successful mutations.

Keep command handlers focused and aligned with
`plans/active/0044-cli-command-architecture-refactor.md`. Do not put a long
shot-list operation dispatcher inside the top-level CLI command body.

### Studio

Studio owns:

- rendering per-shot storyboard images;
- sequence card 2x2 preview layout;
- quiet missing-image states;
- refreshing on scoped resource keys.

Studio does not own:

- sheet slicing;
- crop detection;
- image-storage decisions;
- operation application;
- shot id generation.

### Skills

Skills own:

- intent interpretation;
- creative shot design;
- translating user-facing shot numbers into durable shot ids;
- batching storyboard generation into temporary sheets;
- vision inspection and local crop decisions;
- deciding whether a generated image is good enough to import;
- using CLI commands for every project metadata mutation.

## Implementation Phases

### Phase 1: Contracts And Plan Review

Finalize public names:

- `sceneShotListOperations`
- `renku screenplay shot-list apply`
- `renku screenplay shot-list validate-operations`
- `renku screenplay shot-list storyboard status`
- `sceneStoryboardImagesImport`
- `renku screenplay scene revise`
- `screenplaySceneRevision`
- `renku screenplay revision list`
- `renku screenplay revision show`
- `renku screenplay revision restore`

Add browser-safe types and schemas before implementation code.

### Phase 2: Shot-List Operations

Implement core operation validation and application:

- read the explicit base shot list by id;
- verify `baseShotListId` belongs to `sceneId`;
- apply operations to a draft;
- validate the full resulting document;
- create a new shot-list row;
- set it active only when `activate` is true;
- carry forward valid storyboard image records for unchanged shots;
- report missing/stale shot images.

### Phase 3: Per-Shot Storyboard Image Storage

Update Drizzle schema and access helpers:

- remove sheet-centered storyboard storage for scene shot-list storyboards;
- add shot-image-centered records;
- update import behavior;
- update resource projections.

Follow the accepted Drizzle Kit workflow from
`docs/architecture/drizzle-migrations.md` before changing migrations.

### Phase 4: Media Generation And Import

Change scene storyboard sheet import policy:

- generation stays;
- sheet asset import goes away;
- cropped shot image import becomes the durable path.

### Phase 5: Narrative Revision Impact

Add the scene revision helper and impact reporting:

- dry-run support;
- apply support;
- impacted shot-list status;
- resource keys for scene and shot surfaces.

### Phase 6: History And Undo

Add screenplay revision history and wire skills to use existing shot-list
history for undo.

Acceptance criteria:

- screenplay create/apply/scene-revise/restore record revision rows;
- revision list/show/restore commands work through structured reports;
- shot-list undo uses `shot-list set-active` with explicit scene and shot-list
  ids;
- restore commands emit resource keys and shot-list impact reports.

### Phase 7: Studio Resources And UI

Update:

- `SequenceResource` and Studio contracts;
- sequence card rendering;
- act storyboard projection;
- scene shot resource shape if `storyboardSheet` is removed;
- tests.

Use local shadcn-style primitives for any interactive controls. Do not add raw
browser controls in feature code.

### Phase 8: Skill And Documentation Updates

Update external Studio Skills after the CLI and architecture docs are accepted.

Update:

- `docs/architecture/reference/studio-skills.md`
- `docs/architecture/reference/media-generation.md`
- `docs/cli/commands.md`
- external skill references and samples.

### Phase 9: Validation

Run focused package checks during implementation, then broader workspace checks
when the slice is complete:

```bash
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio test
pnpm build
pnpm test
pnpm lint
pnpm check
```

## Acceptance Criteria

- Agents can apply shot-list expand, replace, delete, and full-replacement
  workflows without hand-writing a complete replacement document for every
  small edit.
- Every structural agent edit creates a new shot-list history row and activates
  it only when requested.
- Storyboard status reports missing and stale shot images.
- Sheet generation is used for every storyboard image request, including one
  missing shot.
- A five-shot missing-image set uses one four-shot temporary sheet plus one
  one-shot temporary sheet, not a different direct generation path.
- `scene.storyboard-sheet` imports no longer save sheet files as Assets.
- Durable scene shot-list storyboard media consists of per-shot images only.
- Sequence cards show a 2x2 grid of actual cropped shot images from the
  first two and last two shots.
- Sequence card missing preview images select nearest available images and leave
  unused slots visually empty.
- Act overview and Scene Shots tab render from per-shot images without requiring
  a sheet reference.
- Scene narrative revisions report impacted shot lists.
- Broad `screenplay apply` reports the same scene/shot-list impacts when scene
  operations are present.
- Narrative and shot-list undo are possible through CLI and skill workflows.
- Skills explain and use the new operation, storyboard status, and image import
  commands.

## Resolved Review Decisions

1. Do not add `shot.storyboard-image` generation. Use
   `scene.storyboard-sheet` for every storyboard image request, including
   one-shot cases.
2. Updated shots regenerate by default. Reusing a previous image for changed
   shot content requires a future pin/reuse UX and is out of scope for this
   implementation slice.
3. Leave temporary sheet output files as generation-run artifacts. Future
   garbage collection can decide whether and when to clean them up.
4. Sequence previews should select nearest available shot images when preferred
   first/last images are missing. If fewer than four images are available, keep
   the remaining slots visually empty and uncluttered.
5. Add both impact paths: `screenplay scene revise` is the preferred focused
   scene-edit command, and broad `screenplay apply` returns the same impact
   reports whenever scene operations are present.

## Open UX Follow-Up

The future image pin/reuse UX needs product design before implementation. The
initial behavior is intentionally simple: if shot content changes, its existing
storyboard image is stale and the agent regenerates through a temporary sheet.

## Completion Checklist

### Review And Architecture

- [x] Confirm this plan is accepted for implementation.
- [x] Confirm the public command names:
      `shot-list apply`, `shot-list validate-operations`,
      `shot-list storyboard status`, and `screenplay scene revise`.
- [x] Confirm the public document names:
      `sceneShotListOperations`, `sceneStoryboardImagesImport`, and
      `screenplaySceneRevision`.
- [x] Confirm `scene.storyboard-sheet` remains a temporary batch generation
      purpose for scene shot-list storyboards.
- [x] Confirm no direct per-shot storyboard generation purpose is introduced.
- [x] Confirm temporary sheet files are not imported as Assets.
- [x] Confirm character sheets, location environment sheets, Lookbook sheets,
      and `shot.multi-shot-storyboard-sheet` keep their current durable storage
      policies.
- [x] Confirm agent structural shot-list edits create new history rows rather
      than mutating the active row in place.
- [x] Confirm existing Studio shot-spec UI autosave can keep its current
      in-place update path.
- [x] Confirm screenplay revision history is required for CLI/skill undo.
- [x] Confirm shot-list undo uses existing shot-list history and `set-active`.

### Core Contracts

- [x] Add browser-safe `SceneShotListOperationDocument` types.
- [x] Add operation-specific TypeScript types for insert, replace, update,
      delete, and replace-all operations.
- [x] Add `SceneShotListStoryboardPolicy`.
- [x] Add `SceneShotListApplyReport`.
- [x] Add `SceneShotListStoryboardStatus`.
- [x] Add browser-safe `SceneStoryboardImagesImportDocument`.
- [x] Add browser-safe `ScreenplaySceneRevisionDocument`.
- [x] Add `ScreenplayShotListImpact` report types.
- [x] Add browser-safe screenplay revision summary and read report types.
- [x] Add JSON schemas for every new document.
- [x] Add schema tests for valid documents.
- [x] Add schema tests for unknown fields, missing required fields, duplicate
      shot ids, invalid placements, and invalid storyboard policies.

### Shot-List Operation Implementation

- [x] Add core validation for `sceneShotListOperations`.
- [x] Verify `baseShotListId` belongs to the requested scene.
- [x] Apply against `baseShotListId` even when another shot list is currently
      active for that scene.
- [x] Ensure no apply path reads current Studio focus to choose scene, sequence,
      shot list, or shot ids.
- [x] Record base/provenance on the derived shot-list version.
- [x] Resolve placements against durable shot ids.
- [x] Apply insert operations.
- [x] Apply replace operations for one shot, contiguous ranges, and
      non-contiguous groups.
- [x] Apply update operations.
- [x] Apply delete operations.
- [x] Apply full shot-list replacement operations.
- [x] Validate the resulting full `SceneShotListDocument` with the existing
      semantic validator.
- [x] Create a new `scene_shot_list` row on apply.
- [x] Set the new row active only when `activate` is true.
- [x] Leave active state unchanged when `activate` is false.
- [x] Return inserted, removed, updated, and preserved shot ids.
- [x] Prune or report shot video rail groups that reference deleted shot ids.
- [x] Prune or report shot video production groups that reference deleted shot
      ids.
- [x] Return scoped resource keys for scene shot surfaces and changed shots.
- [x] Add dry-run support that performs no mutation.
- [x] Add tests proving a user browsing to another scene during agent work does
      not change the apply target.
- [x] Add tests proving a changed current active shot list does not alter the
      explicit `baseShotListId` operation target.
- [x] Add tests for `activate: true` and `activate: false`.
- [x] Add tests for base shot list from another scene failing before mutation.

### Storyboard Status And Carry-Forward

- [x] Define a stable shot content fingerprint for storyboard image freshness.
- [x] Store the fingerprint on imported storyboard image records.
- [x] Carry forward image records for unchanged shots when applying operations.
- [x] Mark inserted shots as missing storyboard images.
- [x] Mark replaced shots as missing storyboard images.
- [x] Mark updated shots as stale by default.
- [x] Keep old-image reuse for changed shots out of scope until a pin/reuse UX
      exists.
- [x] Preserve remaining shot images after delete operations.
- [x] Add `shot-list storyboard status` core service.
- [x] Report ready, missing, and stale shot ids.
- [x] Add tests for carry-forward after inserting before a shot.
- [x] Add tests for carry-forward after deleting neighboring shots.
- [x] Add tests for stale image detection after `shot.update`.
- [x] Add tests for restored inactive shot lists showing their own images.

### Storage And Migrations

- [x] Re-read `docs/architecture/drizzle-migrations.md` before changing schema.
- [x] Look up current Drizzle Kit migration documentation before changing
      migrations.
- [x] Redesign `scene_shot_storyboard_image` as shot-list-owned storage.
- [x] Remove durable sheet-centered storage for scene shot-list storyboard
      sheets.
- [x] Generate the migration with Drizzle Kit.
- [x] Update database access helpers.
- [x] Update asset relationship insertion for per-shot storyboard images.
- [x] Ensure imported shot images are attached to the scene target.
- [x] Ensure sheet files are not copied into durable screenplay storyboard
      folders.
- [x] Ensure sheet files are not inserted into `asset_file`.
- [x] Ensure sheet files are not represented as `Asset` records.
- [x] Add database tests for import, latest image selection, and deletion
      behavior.

### Media Generation

- [x] Keep `scene.storyboard-sheet` generation support for one to four selected
      shots.
- [x] Ensure one selected shot generates a temporary sheet with one filled panel
      and unused slots left empty.
- [x] Ensure five selected/missing shots are planned as two sheet specs: four
      shots plus one shot.
- [x] Ensure nine selected/missing shots are planned as three sheet specs: four
      shots, four shots, plus one shot.
- [x] Ensure provider prompts for partially filled sheets explicitly ask for
      empty unused panel slots, not invented filler shots.
- [x] Ensure estimates and runs continue to use the persisted
      `scene.storyboard-sheet` specs.
- [x] Ensure generation output sheet files remain generation-run artifacts and
      are not imported as Assets.
- [x] Update `scene.storyboard-sheet` docs to say sheets are temporary for this
      workflow.

### Media Import

- [x] Update the `scene.storyboard-sheet` media import handler to import only
      cropped shot images.
- [x] Support `--source` plus `--shots` for a single cropped shot image.
- [x] Support `--file` with `sceneStoryboardImagesImport` for multiple sliced
      images.
- [x] Reject import documents that include sheet source files.
- [x] Reject duplicate shot ids in one import.
- [x] Reject shot ids outside the selected shot list.
- [x] Reject absolute paths and paths outside the project.
- [x] Copy imported shot image files to durable project media folders.
- [x] Insert per-shot storyboard image records.
- [x] Return resource keys for every imported shot.
- [x] Remove the old `sceneStoryboardSheetImport` path.
- [x] Update CLI tests that currently expect imported files with role `sheet`.

### Screenplay Scene Revision

- [x] Add `screenplaySceneRevision` JSON contract.
- [x] Add `screenplay scene revise --scene <scene-id> --file <file> --json`.
- [x] Add `--dry-run` support.
- [x] Validate full scene replacement documents.
- [x] Apply through the existing screenplay operation engine.
- [x] Return scene-specific resource keys.
- [x] Add shot-list impact calculation for revised scenes.
- [x] Add the same impact calculation to `screenplay apply` when scene
      operations are present.
- [x] Detect changed, inserted, and deleted block indexes.
- [x] Detect shots covering deleted blocks.
- [x] Detect dialogue line references made stale by narrative edits.
- [x] Detect active shot lists that need visual sync.
- [x] Add CLI tests for scene revise success, dry-run, invalid scene id, and
      impact reporting.

### History And Undo

- [x] Add durable screenplay revision storage.
- [x] Record a screenplay revision after initial screenplay create.
- [x] Record a screenplay revision after broad `screenplay apply`.
- [x] Record a screenplay revision after focused `screenplay scene revise`.
- [x] Record a screenplay revision after revision restore.
- [x] Add `renku screenplay revision list --json`.
- [x] Add `renku screenplay revision show --revision <revision-id> --json`.
- [x] Add `renku screenplay revision restore --revision <revision-id> --json`.
- [x] Ensure restore creates a new revision entry rather than deleting history.
- [x] Ensure restore returns shot-list impact reports for affected scenes.
- [x] Ensure restore emits screenplay, scene, and shot-list resource keys.
- [x] Ensure shot-list undo uses `shot-list list`, `shot-list show`, and
      `shot-list set-active` with explicit scene and shot-list ids.
- [x] Update skills so "go back to the previous shot-list version" uses
      `shot-list set-active`.
- [x] Update skills so "go back to the previous narrative version" uses
      `screenplay revision restore`.
- [x] Add tests for screenplay revision list/show/restore.
- [x] Add tests proving narrative restore does not rely on Studio focus.
- [x] Add tests proving shot-list restore does not rely on Studio focus.

### Studio Resources

- [x] Replace sequence scene `storyboardSheet` with `storyboardPreview`.
- [x] Add first-two/last-two preview selection in core.
- [x] Select nearest available shot images when preferred first/last preview
      shots are missing.
- [x] Return fewer than four images when fewer are available, rather than
      placeholder records with invented copy.
- [x] Update Studio service contracts.
- [x] Update scene shot resource shape if `storyboardSheet` is removed.
- [x] Update act storyboard projection so it no longer requires a sheet
      reference before returning shots.
- [x] Ensure resource keys refresh sequence, act, and scene shot surfaces.
- [x] Add core resource tests for sequence previews.
- [x] Add core resource tests for scenes with no active shot list.
- [x] Add core resource tests for scenes with active shot list but partial
      image coverage.

### Studio UI

- [x] Add a sequence storyboard preview component for the 2x2 grid.
- [x] Keep sequence cards the same outer size as the current card.
- [x] Render first-two/last-two shot images in shot-list order.
- [x] Render one to four shots without duplicate preview cells.
- [x] Render empty preview slots as visually quiet cells with no placeholder
      text, icons, raw filenames, or ids.
- [x] Use local shadcn primitives for any interactive controls.
- [x] Do not introduce raw HTML form or interactive controls in feature code.
- [x] Update `SequencePanel` tests.
- [x] Update Act Storyboard Overview tests.
- [x] Update Scene Shots tab tests if the resource shape changes.
- [x] Verify desktop layout in the browser.

### Skill Updates

- [x] Update `scene-shot-designer/SKILL.md` for iterative operations.
- [x] Update `scene-shot-designer/references/shot-list-cli-workflow.md`.
- [x] Update `scene-shot-designer/references/scene-shot-list-json-contract.md`.
- [x] Add a `sceneShotListOperations` sample.
- [x] Add examples for expand one shot, expand a range, replace a range, delete
      shots, and full replacement.
- [x] Update `media-producer/SKILL.md` with temporary sheet policy.
- [x] Update `media-producer/references/scene-storyboard-sheet.md`.
- [x] Add `scene-storyboard-images-import.json` sample.
- [x] Add media-producer examples for one-shot, five-shot, and nine-shot
      sheet batching.
- [x] Update `screenplay-drafter/SKILL.md` with scene revision and shot-list
      impact workflow.
- [x] Update `screenplay-drafter/references/screenplay-json-workflow.md`.
- [x] Update skills with shot-list undo through `shot-list set-active`.
- [x] Update skills with narrative undo through `screenplay revision restore`.
- [x] Regenerate or update any skill index/manifest required by the external
      Studio Skills project.

### Documentation

- [x] Update `docs/architecture/reference/studio-skills.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/cli/commands.md`.
- [x] Update data model/storage documentation for per-shot storyboard images.
- [x] Update documentation for screenplay revision history and restore.
- [x] Update documentation for shot-list history restore through `set-active`.
- [x] Add or update an ADR if reviewers accept the storage policy change.
- [x] Remove current-document claims that scene storyboard sheets are durable
      Assets for shot-list storyboards.
- [x] Keep documentation explicit that other sheet asset types are unaffected.

### Validation And Final Verification

- [x] Add core tests for operation validation and application.
- [x] Add core tests for storyboard status.
- [x] Add core tests for per-shot image import.
- [x] Add core tests for one-shot, five-shot, and nine-shot sheet planning.
- [x] Add CLI tests for all new commands and import shapes.
- [x] Add CLI tests for deterministic ids when Studio focus changes between
      read and write.
- [x] Add CLI tests for applying against a non-active but valid base shot list.
- [x] Add CLI tests for rejecting base shot lists from another scene.
- [x] Add CLI tests for screenplay revision restore and shot-list set-active
      undo.
- [x] Add Studio tests for sequence 2x2 previews.
- [x] Add Studio tests for nearest available preview image selection.
- [x] Add Studio tests proving empty preview slots do not show placeholder
      labels, icons, filenames, or ids.
- [x] Add skill sample validation checks where practical.
- [x] Prefer integration-style core/CLI tests over heavy mocks for operation,
      import, history, and restore behavior.
- [x] Assert returned resource keys, created ids, activated ids, carried-forward
      images, missing/stale statuses, and persisted database state in tests.
- [x] Run `pnpm --filter @gorenku/studio-core test`.
- [x] Run `pnpm --filter @gorenku/studio-cli test`.
- [x] Run `pnpm --filter @gorenku/studio test`.
- [x] Run `pnpm build`.
- [x] Run `pnpm test`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Open the Urban Basilica sequence page on desktop and confirm sequence
      cards show per-shot image grids instead of saved sheets.
- [x] Confirm a one-shot addition uses a temporary `scene.storyboard-sheet` with
      one filled panel and imports only the cropped shot image.
- [x] Confirm a five-shot missing-image set uses one four-shot temporary sheet
      plus one one-shot temporary sheet.
- [x] Confirm a narrative scene revision reports shot-list impacts and the agent
      workflow can update the shot list without narrative drift.
- [x] Confirm "undo the previous shot-list change" works through CLI and skill
      instructions.
- [x] Confirm "undo the previous narrative change" works through CLI and skill
      instructions.
