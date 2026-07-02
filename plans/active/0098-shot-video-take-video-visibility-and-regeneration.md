# 0098 Shot Video Take Video Visibility And Regeneration

Status: proposed
Date: 2026-07-02

## Summary

The Takes surface has three related problems:

1. A generated Shot Video Take video can exist in project data, but the Studio
   take editor and Takes grid still show storyboard images and the placeholder
   "No shot video yet."
2. Agent/CLI updates to AI Production prompt state can reach core and the
   Studio server, but the open AI Production panel can stay stale until the user
   refreshes the browser.
3. The current model stores generated video outputs as hidden candidates under
   one editable Shot Video Take. That is the wrong product model for AI video
   iteration. A regenerated video should be a new Shot Video Take copied from
   the previous take's settings, with its own video and history.

This plan fixes the ownership model first:

- A `SceneShotVideoTake` remains the take-owned editable state for one video
  attempt.
- A take can have at most one final video.
- If the take has no video yet, importing or finalizing the first video attaches
  the video to that take.
- If the source take already has a video, regeneration copies the take-owned
  settings into a new take and attaches the new video to the new take.
- The Takes grid and take editor render the take-owned video when it exists,
  and only fall back to storyboard previews for draft takes that have no video
  yet.
- Studio refresh subscriptions reload the visible take, AI Production prompt
  plan, and Takes grid when core reports take, input, prompt, or video resource
  changes.

This plan deliberately supersedes the part of
`plans/active/0075-take-owned-state-and-shot-list-history.md` that says
generated/imported video outputs are candidates under a Shot Video Take. That
candidate model makes good AI iteration invisible. The current product model is
one generated video attempt equals one take.

Amendment: `plans/active/0100-shot-video-take-automatic-iteration-and-migration-repair.md`
supersedes the manual regeneration-button direction from this plan. Do not add
a user-visible duplicate, copy, or regenerate button to Take-Edit. Repeat
generation should continue automatically through core-owned iteration and
finalization.

## Confirmed Investigation Findings

### Urban Basilica Already Has The Missing Video

The project database at:

```text
/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite
```

already contains a selected generated video output for the take visible in the
user report:

```text
take id: scene_shot_video_take_cdstd9w8
output id: scene_shot_video_take_output_g8zd7djs
asset id: asset_rxfp4c8x
asset file id: asset_file_pswjngdy
media generation run id: media_generation_run_8d6bthsd
project path: generated/media/bombardment-continuous-aerial-opening-with-timed-narration.mp4
mime type: video/mp4
selected: true
```

The file exists on disk:

```text
/Users/keremk/renku-movies/urban-basilica/generated/media/bombardment-continuous-aerial-opening-with-timed-narration.mp4
```

The output is linked to the four-shot take:

```text
shot_001
shot_001b
shot_001c
shot_002
```

So the primary failure is not that the generated video disappeared. The data
exists. The failure is that the current Studio projection and UI do not expose
that take-owned video as the visible take media.

### The Take Editor Cannot Render Output Videos

`packages/core` already returns `outputs` from `ShotVideoTakeProductionContext`
and `SceneShotVideoTakeEditContext`.

However, `packages/studio` does not render them:

- `SceneShotVideoStage` is a static placeholder and never reads
  `editContext.outputs`.
- `SceneTakesTab` reduces the edit context to
  `TakeEditingShotListContext`, which keeps the take, source shot list,
  display shots, and storyboard images, but drops `outputs`.
- `SceneTakeCard` builds its image from storyboard images only.
- `toSceneShotVideoTakeOverviewResponse`,
  `toShotVideoTakeProductionContextResponse`, and
  `toSceneShotVideoTakeEditContextResponse` add URLs for storyboard images only.
  They do not add browser URLs for take output videos.
- The Studio server has a file route for take media inputs:

```text
/screenplay/scenes/:sceneId/takes/:takeId/inputs/:inputId/files/:assetFileId
```

  but there is no corresponding route for a take-owned final video file.

Expected impact:

- A video can be correctly imported into the project and still show as
  "No shot video yet."
- The Takes grid can show the shot-list storyboard collage instead of the
  generated video that the user actually needs to review.
- The UI can make a generated take look like an ungenerated shot grouping.

### The Takes List Is Showing Shot-List Imagery Instead Of Take Media

The current Takes grid card uses:

- the first shot title from the source shot list;
- `overviewShotIds`;
- storyboard images from the source shot list.

That makes a take card look like a shot-list group, even when the take has an
actual video.

For the user's example, the card labeled "City smoke before the wall" should
show the generated video preview when video exists. The storyboard collage is
only appropriate as a draft placeholder for a take that has no final video yet.

### AI Production Does Not Subscribe To Take Resource Changes

`useShotVideoTakeProduction` loads:

- the take production context;
- model rows;
- estimate;
- production plan, including the final prompt.

It refreshes when local React state changes, but it does not subscribe through
`useStudioResourceRefresh`.

That means a CLI or agent command can update take prompt state and emit correct
resource keys, while the already-open AI Production panel keeps its previous
`productionPlan` until a full page refresh or a local edit forces a reload.

The broader `SceneTakesTab` does subscribe to resource changes, but it currently
uses `matchesSceneShotsResource`, which is too broad for shot-list surfaces and
not precise enough for take-owned video, prompt, and input changes. It also
reloads the list resource without forcing the open edit context and AI
Production plan to reload when the parent take `updatedAt` does not change.

Expected impact:

- The user can watch an agent generate or apply prompts and see no visible
  prompt update in the open AI Production panel.
- The user learns to manually refresh, which hides whether the data contract or
  UI subscription is broken.

### Generation Run And Import Are Still Separate

Current architecture says generated files remain temporary generation outputs
until an explicit media import registers and attaches them as project assets.
That is still the right boundary.

The issue is not that `generation run` must become a generic auto-import for
all purposes. The issue is that the shot-video workflow must make finalization
explicit and reliable:

1. run the paid or simulated `shot.video-take` generation;
2. inspect/select the output file;
3. explicitly import/finalize that video as a take-owned video;
4. notify Studio with take-specific resource keys.

Studio and the agent workflow may perform those steps as one user-facing
"Create video" flow, but core must still model the import/finalization as the
durable metadata mutation.

## Product Decision

### One Generated Video Attempt Equals One Take

The product model should be:

1. The user creates or opens a Shot Video Take.
2. The take owns the selected shots, structure mode, composition, motion,
   references, dialogue choices, AI Production settings, prompt state, selected
   prepared inputs, and optional final video.
3. The first successful video finalizes an empty draft take by attaching the
   video to that take.
4. If the user generates again from a take that already has a video, core creates
   a copied take and attaches the new video to that copied take.
5. The copied take appears in the Takes grid as a separate take.
6. The user can tweak settings on either take independently before generating
   again.

Concrete example:

- Take A covers Shots 1-4 and has model, prompt, prompt sheet, audio, location,
  and lookbook choices.
- The first generation attaches a video to Take A.
- The user tweaks duration or prompt on Take A and regenerates.
- Core creates Take B, copied from Take A at generation time, attaches the new
  video to Take B, and returns Take B in mutation output.
- The Takes tab now shows Take A and Take B as separate reviewable videos.

There must not be a hidden list of multiple final video candidates under one
take. Multiple generated attempts are separate takes.

### Draft Takes Are Allowed

A take can exist before it has a video. That is the current authoring
experience and should remain:

- New Take creates an editable draft take.
- Draft take cards may use storyboard previews because there is no video yet.
- Once a video exists, the video becomes the first visual signal in both the
  card and the editor stage.

Draft status is not compatibility behavior. It is the current authoring model:
the user needs a place to prepare settings before spending money on generation.

## Non-Goals

- Do not make `generation run` silently import outputs for every media purpose.
- Do not keep multiple final video outputs hidden under one take.
- Do not add a generic arbitrary take-state patch API.
- Do not add route-local or React-local business rules for whether a generated
  video belongs to a take.
- Do not preserve old output-candidate contracts as aliases.
- Do not add compatibility DTO fields to keep old callers working.
- Do not use raw HTML form or interactive controls in `packages/studio` feature
  code.
- Do not optimize or test mobile behavior.
- Do not use the stale in-repository sample project.

## Architecture Boundaries

### Core

`packages/core` owns:

- the one-video-per-take rule;
- take copying for regeneration;
- take video import/finalization;
- copying selected prepared inputs and take-owned state into regenerated takes;
- validation that a take video asset and file belong to the take;
- resource keys for take video, take list, take prompt, and take input changes;
- migration of current development data out of output-candidate storage.

Core must return structured diagnostics when:

- the source take does not exist;
- the source take belongs to another scene;
- the video file is not a video asset file;
- the generation receipt does not match the imported file or purpose;
- a caller tries to attach a second video to an existing take without using the
  regeneration/fork behavior;
- copied selected media inputs no longer resolve.

### Studio Server

`packages/studio/server` remains a thin adapter:

- parse HTTP params and request bodies;
- call core read or mutation commands;
- serialize core responses;
- add HTTP URLs to video files through a validated file route;
- translate structured errors.

The server must not decide whether to create a copied take. That decision
belongs in core.

### Studio Browser

`packages/studio/src` owns rendering and user intent:

- show the generated video in the editor stage when the take has video;
- show video previews in the Takes grid when a take has video;
- fall back to storyboard previews only for draft takes without video;
- subscribe to take-specific resource changes through the shared resource
  refresh system;
- reload production plan/prompt state after external take changes;
- send regeneration intent to core through focused services.

React must not infer video ownership from raw assets, filenames, generation run
ids, or local route state.

### CLI And Agent Workflows

The CLI remains a thin wrapper over core:

- `renku media import --purpose shot.video-take --target take:<take-id> ...`
  finalizes a take video through core.
- If the source take already has video, the import result is a new copied take.
- The JSON report must clearly say which take received the video.
- Agent skills must treat `shot.video-take` finalization as required after a
  generation run.

The media-producer workflow should use the same core contract Studio uses. It
should not write SQLite, duplicate settings manually, or invent a local "copy
take" file.

## Data Model

### Replace Output Candidates With Take Video

Replace the public output-candidate concept:

```ts
SceneShotVideoTakeOutput
```

with a take-owned optional video value:

```ts
export interface SceneShotVideoTakeVideo {
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId?: string;
  projectRelativePath: ProjectRelativePath;
  mimeType: string | null;
  createdAt: string;
}

export interface SceneShotVideoTake {
  takeId: string;
  sceneId: string;
  sourceShotListId: string;
  title: string;
  shotIds: string[];
  picked: boolean;
  video: SceneShotVideoTakeVideo | null;
  regeneratedFromTakeId?: string;
  state: SceneShotVideoTakeState;
  status: SceneShotVideoTakeStatus;
  createdAt: string;
  updatedAt: string;
}
```

Use a separate one-to-one table for the video relationship so draft takes do not
carry nullable asset columns directly on the take row. The public contract still
exposes one optional `video`, not an array of hidden outputs.

Table:

```text
scene_shot_video_take_video
```

Columns:

```text
take_id
asset_id
asset_file_id
media_generation_run_id
created_at
updated_at
```

Add this column to `scene_shot_video_take`:

```text
regenerated_from_take_id
```

Constraints:

- `scene_shot_video_take_video.take_id` is unique.
- `asset_file.media_kind` must resolve to `video` before core writes the
  relationship.
- `regenerated_from_take_id` is nullable and points at the source take copied
  for regeneration.

Delete the current runtime output-candidate contracts and access functions:

```text
SceneShotVideoTakeOutput
scene_shot_video_take_output
scene_shot_video_take_output_shot
listShotVideoTakes
insertShotVideoTakeRecord
requireShotVideoTake as output read
```

If the implementation keeps any internal filename temporarily during a Drizzle
migration, it must not remain as a runtime compatibility surface.

### One-Way Development Data Migration

Use the Drizzle Kit workflow from
`docs/architecture/reference/drizzle-migrations.md` before changing schema.

The migration may mention the old output table names because it is a one-way
conversion of existing development data. Runtime code after the migration must
not recognize the old output-candidate shape.

Migration behavior:

- For a take with exactly one existing output, move that output into
  `scene_shot_video_take_video`.
- For a take with multiple existing outputs, keep the newest or selected output
  on the original take and create copied take rows for the remaining outputs.
- Preserve each copied take's shot membership, state JSON, source shot list,
  selected prepared inputs, media generation run id, asset id, asset file id,
  and created timestamp.
- Set `regenerated_from_take_id` on copied takes.
- Drop old output tables after data is converted.

The current Urban Basilica data has one output for
`scene_shot_video_take_cdstd9w8`, so it should migrate into that take's
`video` without creating a sibling.

## Core Commands And Contracts

### Copy For Regeneration

Add a focused core mutation:

```ts
copySceneShotVideoTakeForRegeneration(input): SceneShotVideoTakeCreateReport
```

Input:

```ts
{
  projectName: string;
  sceneId?: string;
  sourceTakeId: string;
  title?: string;
}
```

Behavior:

- require the source take;
- validate the optional scene id matches;
- copy ordered `shotIds`;
- copy `SceneShotVideoTakeState`;
- copy selected and take-owned media input relationships that are part of the
  current settings;
- do not copy non-selected prepared input history, because those older
  alternatives are not part of the settings being regenerated and would clutter
  the copied take;
- clear video on the copied take;
- set `regeneratedFromTakeId` to the source take id;
- return resource keys for the source take, copied take, and scene Takes
  surface.

This command is used when the user wants to tweak settings before running
another generation.

### Finalize Take Video

Replace output insertion with:

```ts
finalizeSceneShotVideoTakeVideo(input): ShotVideoTakeMediaImportReport
```

Input:

```ts
{
  projectName: string;
  sceneId?: string;
  sourceTakeId: string;
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
}
```

Behavior:

- import/register the video file as a project asset;
- if the source take has no video, attach the video to the source take;
- if the source take already has video, create a copied take from the source and
  attach the video to the copied take;
- return the take that received the video;
- return whether the operation finalized the source take or created a
  regenerated take;
- return resource keys for the scene Takes surface, the source take, the target
  take, the take video, and the asset.

Proposed report shape:

```ts
export interface ShotVideoTakeMediaImportReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: {
    id: string;
    name: string;
    projectFolder: string;
  };
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  sourceTake: SceneShotVideoTake;
  take: SceneShotVideoTake;
  createdRegeneratedTake: boolean;
  imported: Asset;
  video: SceneShotVideoTakeVideo;
  receipt?: unknown;
  resourceKeys: string[];
}
```

`importShotVideoTake` can remain the service method name only if its behavior is
updated directly to call the finalization path above. Do not keep the old
output insertion behavior as a second path.

### Resource Keys

Update the core resource key helper so take video and prompt changes can be
matched precisely:

```text
scene:<scene-id>
surface:scene:<scene-id>:takes
scene-shot-video-take:<take-id>
scene-shot-video-take-video:<take-id>
scene-shot-video-take-prompt:<take-id>
scene-shot-video-take-input:<input-id>
asset:<asset-id>
```

Use the same key family from:

- take create;
- take copy for regeneration;
- take authoring apply;
- take production update;
- take input select/clear/delete;
- shot-video input import;
- shot-video final video import/finalization;
- recoverable take delete/restore.

Do not assemble take resource keys in React.

## Studio API And Browser Rendering

### File Route

Add a validated final video file route:

```text
GET /studio-api/projects/:projectName/screenplay/scenes/:sceneId/takes/:takeId/video/files/:assetFileId
```

Server behavior:

- call a core-owned resolver such as `resolveSceneShotVideoTakeVideoFile`;
- validate the file belongs to `take.video`;
- return the file with `Content-Type: video/mp4` or the stored MIME type;
- return structured errors for mismatched scene, take, or asset file ids.

### HTTP Responses

Add a browser URL to the take video in:

- `SceneShotVideoTakeOverviewResponse`;
- `SceneShotVideoTakeCreateReportResponse`;
- `ShotVideoTakeProductionContextResponse`;
- `SceneShotVideoTakeEditContextResponse`;
- `ShotVideoTakeMediaImportReport` responses when surfaced through Studio.

Recommended browser response shape:

```ts
type SceneShotVideoTakeVideoWithHttp = SceneShotVideoTakeVideo & {
  url: string;
};
```

The core client type stays URL-free. Studio HTTP response types add URLs.

### Take Grid

Update `SceneTakeCard` so:

- if `take.video` exists, the card preview uses the video;
- if `take.video` does not exist, the card falls back to storyboard previews;
- the card title remains meaningful domain text such as the take title or first
  shot title;
- no raw file names, asset ids, output ids, or generation run ids are shown on
  the card;
- the pick control still picks the take, not the video asset.

Use shared UI primitives for controls. Add `VideoPreview` and `VideoPlayer`
under `packages/studio/src/ui`, then consume those primitives from feature
code.

### Take Editor Stage

Update `SceneShotVideoStage` so:

- it receives the active take video from the edit context;
- it renders the video when present;
- it keeps the existing quiet placeholder only when no video exists;
- playback controls use local UI primitives such as `Button` and `Slider`;
- any raw `<video>` element is wrapped in a domain-neutral UI component without
  native `controls`, so feature code still follows the local Shadcn control
  rule;
- duration/current-time display is derived from the media element state.

### Regeneration UI

Superseded by
`plans/active/0100-shot-video-take-automatic-iteration-and-migration-repair.md`.

Do not add a manual regeneration, duplicate, or copy button to
`SceneShotVideoStage`.

The accepted product behavior is automatic iteration:

- Take-Edit shows the active take video or the no-video placeholder.
- The user or agent can ask for another generation without pressing a Studio
  copy button.
- If a generation-authoring mutation targets a take that already has a video,
  core creates the next editable take automatically and returns it as the active
  take.
- If another video is finalized from a videoed take without prior edits, core
  creates the next take during finalization.
- Studio follows the take id returned by core or requested through Studio
  coordination, so the editor feels in-place while finalized take provenance is
  preserved.

## Studio Refresh

### Take-Specific Matcher

Add a take-specific matcher in `use-studio-resource-refresh.ts`:

```ts
matchesSceneTakesResource({
  resourceKeys,
  sceneId,
  takeId,
})
```

It should match:

- `scene:<sceneId>`;
- `surface:scene:<sceneId>:takes`;
- `scene-shot-video-take:<takeId>` when a take id is provided;
- any `scene-shot-video-take:` key for the scene list when no take id is
  provided;
- `scene-shot-video-take-video:<takeId>`;
- `scene-shot-video-take-prompt:<takeId>`;
- `scene-shot-video-take-input:`.

Keep `matchesSceneShotsResource` focused on shot-list and storyboard resources.
Do not make the shot-list matcher responsible for take-video refresh.

### Scene Takes Tab

`SceneTakesTab` should:

- subscribe through `matchesSceneTakesResource`;
- reload the Takes list when the scene Takes surface changes;
- reload the open edit context when the active take key changes or when a
  matching take resource event arrives;
- update `takeEditingContext` from refreshed edit context, including video;
- avoid depending only on parent take `updatedAt`, because video finalization may
  write a take-video row without changing every take-owned state field.

### AI Production Hook

`useShotVideoTakeProduction` should:

- subscribe to matching take resource events when `takeId` is present;
- reload production context, model rows if needed, estimate, and production plan;
- update `productionPlan.finalPrompt` when an agent applies a new prompt;
- refresh after selected prepared inputs are imported, selected, cleared, or
  deleted;
- refresh after take video finalization so the estimate/plan and stage are
  consistent;
- avoid overwriting unsaved local edits silently.

Dirty-edit behavior:

- If the user has unsaved local AI Production edits, flush autosave before
  applying an external refresh.
- If the flush fails, keep the local edit visible and show the existing save
  error state instead of replacing it with external data.
- If there are no unsaved local edits, reload immediately.

## CLI And Agent Workflow Updates

### Media Import

Update:

```bash
renku media import --purpose shot.video-take --target take:<take-id> --source <video>
```

Expected behavior:

- if `<take-id>` has no video, attach the imported video to that take;
- if `<take-id>` already has video, create a copied take and attach the imported
  video to that copied take;
- print the take id that received the video;
- include `createdRegeneratedTake` in JSON;
- emit resource keys that refresh the visible Takes grid and open take editor.

The old mental model "import a video output under this take" must disappear from
current code, CLI help, and skill guidance.

### Generation Run Finalization

Keep these steps explicit:

```bash
renku generation run --spec <spec-id> --approval-token <token> --json
renku media import --purpose shot.video-take --target take:<take-id> --source <run-output-path> --receipt <run-json> --json
```

Agent-facing guidance may wrap those steps in one workflow, but it must still
use the explicit media import/finalization command before telling the user the
take exists in Studio.

### Skills Repository

Update the sister project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

Required guidance changes:

- `media-producer` must say final video generation is incomplete until the
  generated video is finalized/imported as a Shot Video Take video.
- `media-producer` must report whether finalization updated the source draft
  take or created a regenerated take.
- `movie-director` should describe regeneration as "copy the take settings,
  tweak if needed, then generate/finalize a new take."
- Skills must never write output rows or copy take settings themselves.

## Testing Plan

### Core Tests

Add focused tests for:

- finalizing a video onto a draft take attaches `take.video`;
- finalizing a second video from a videoed take creates a copied take;
- copied take preserves ordered shot ids;
- copied take preserves structure mode;
- copied take preserves direction state;
- copied take preserves AI Production settings;
- copied take preserves prompt state needed for generation traceability;
- copied take preserves selected prepared inputs;
- copied take does not share mutable state objects with the source take;
- list/read take projections expose `video`;
- old output-candidate public contracts are gone;
- resource keys include scene Takes, source take, target take, take video, and
  asset keys;
- invalid video asset files produce structured diagnostics;
- mismatched scene/take ids produce structured diagnostics.

### Migration Tests

Add migration or storage tests for:

- one existing output becomes `take.video`;
- multiple existing outputs become multiple takes;
- output shot membership is preserved through copied take shot membership;
- media generation run ids survive conversion;
- selected output status drives which migrated video remains on the original
  take when multiple outputs exist;
- obsolete output tables are not read by runtime code after migration.

### Studio Server Tests

Add route tests for:

- list takes includes video URL when video exists;
- edit context includes video URL when video exists;
- video file route serves the take video;
- video file route rejects an asset file from another take;
- video file route rejects an asset file from the same take's prepared input;
- shot-video media import response returns the take that received the video.

### Studio Browser Tests

Add component/hook tests for:

- `SceneTakeCard` renders video preview when `take.video` exists;
- `SceneTakeCard` falls back to storyboard preview only when no video exists;
- `SceneShotVideoStage` renders video when present;
- `SceneShotVideoStage` shows "No shot video yet" only for draft takes;
- `SceneTakesTab` reloads list and edit context after take-video resource keys;
- `useShotVideoTakeProduction` reloads final prompt after a take resource event;
- `useShotVideoTakeProduction` refreshes after prepared input resource events;
- dirty AI Production edits flush before external refresh;
- failed dirty flush preserves local state and reports save error.

### CLI Tests

Add CLI tests for:

- `media import --purpose shot.video-take --target take:<draft>` attaches video
  to the draft take;
- importing another video to a take with video creates a copied take;
- JSON output includes `createdRegeneratedTake`;
- resource notification includes scene Takes and take-video keys;
- human output names the take that received the video without exposing raw asset
  ids as primary copy.

### Manual Desktop Verification

Use the real project:

```text
/Users/keremk/renku-movies/urban-basilica
```

Manual checks:

1. Open Bombardment, Takes tab.
2. Confirm the "City smoke before the wall" take shows the generated video, not
   the storyboard collage, after migration.
3. Open the take.
4. Confirm the stage plays
   `generated/media/bombardment-continuous-aerial-opening-with-timed-narration.mp4`.
5. Apply or import a new prompt from the CLI or agent workflow.
6. Confirm AI Production updates without a browser refresh.
7. Regenerate from a take that already has video.
8. Confirm a copied take appears in the Takes grid with the new video.
9. Confirm the original take still has its original video and settings.

Do not run paid generation for verification unless the user explicitly approves
that separate action.

## Implementation Slices

### Slice 1: Core Contract And Migration Design

- Add `SceneShotVideoTakeVideo`.
- Add `video` and `regeneratedFromTakeId` to `SceneShotVideoTake`.
- Replace public `outputs` arrays in take read contexts with the optional take
  video.
- Design the Drizzle migration from output candidates to one video per take.
- Update resource key helpers for take video.

### Slice 2: Core Finalization And Copy Commands

- Add `copySceneShotVideoTakeForRegeneration`.
- Add `finalizeSceneShotVideoTakeVideo`.
- Update `importShotVideoTake` to use the finalization path.
- Copy selected prepared input relationships into copied takes.
- Add structured diagnostics for invalid finalization.

### Slice 3: CLI And Skills

- Update `renku media import --purpose shot.video-take`.
- Update CLI JSON and human output.
- Update CLI resource notification tests.
- Update `studio-skills` media-producer and movie-director guidance.

### Slice 4: Studio Server Projection And File Route

- Add the validated video file route.
- Add video URLs to take list, create, edit, and production context responses.
- Keep server handlers thin.

### Slice 5: Studio Video Rendering

- Add `VideoPreview` and `VideoPlayer` domain-neutral UI primitives under
  `packages/studio/src/ui`.
- Wire `SceneTakeCard` to render take video previews.
- Wire `SceneShotVideoStage` to render the active take video.
- Keep storyboard previews as draft-only fallback.

### Slice 6: Studio Refresh

- Add `matchesSceneTakesResource`.
- Update `SceneTakesTab` to reload list and open edit context on take resource
  changes.
- Update `useShotVideoTakeProduction` to refresh on take, prompt, input, and
  video resource changes.
- Add dirty-edit handling around external refresh.

### Slice 7: Verification

- Run focused core tests.
- Run focused CLI tests.
- Run focused Studio tests.
- Run package or root checks appropriate for touched packages.
- Manually verify Urban Basilica in desktop Studio without mobile testing.

## Completion Checklist

### Review Area

- [ ] Confirm one generated video attempt equals one Shot Video Take.
- [ ] Confirm draft takes without video remain valid authoring workspaces.
- [ ] Confirm first finalization attaches to an empty draft take.
- [ ] Confirm regeneration from a videoed take creates a copied take.
- [ ] Confirm hidden output candidates are removed from the product model.
- [ ] Confirm the output-candidate part of plan 0075 is superseded by this plan.
- [ ] Confirm generation and import remain separate durable operations.
- [ ] Confirm Studio and agent workflows may still present generation plus
      finalization as one user-facing flow.
- [ ] Confirm no mobile verification is required.

### Architecture And Contracts

- [ ] Add `SceneShotVideoTakeVideo`.
- [ ] Add `video: SceneShotVideoTakeVideo | null` to `SceneShotVideoTake`.
- [ ] Add `regeneratedFromTakeId?: string` to `SceneShotVideoTake`.
- [ ] Remove public `SceneShotVideoTakeOutput` usage.
- [ ] Remove `outputs` arrays from take production and edit contexts.
- [ ] Add `scene_shot_video_take_video` as the one-to-one take video storage
      table.
- [ ] Add the `copySceneShotVideoTakeForRegeneration` core command.
- [ ] Add the `finalizeSceneShotVideoTakeVideo` core command.
- [ ] Update `importShotVideoTake` directly to use the finalization behavior.
- [ ] Keep server and CLI adapters thin over core commands.
- [ ] Keep React as a projection consumer and intent sender.
- [ ] Avoid a generic take-state patch API.
- [ ] Avoid compatibility aliases for old output-candidate names.

### Database And Migration

- [ ] Re-read `docs/architecture/reference/drizzle-migrations.md` before schema
      work begins.
- [ ] Re-check current Drizzle Kit migration docs before implementation changes
      schema.
- [ ] Generate the migration through Drizzle Kit.
- [ ] Add `scene_shot_video_take_video`.
- [ ] Add `regenerated_from_take_id`.
- [ ] Migrate one existing output to `take.video`.
- [ ] Migrate multiple existing outputs into copied takes.
- [ ] Preserve shot membership during migration.
- [ ] Preserve state JSON during migration.
- [ ] Preserve selected prepared inputs during migration.
- [ ] Preserve media generation run ids during migration.
- [ ] Drop obsolete output-candidate tables after conversion.
- [ ] Ensure runtime code does not read obsolete output tables.

### Core Implementation

- [ ] Copy ordered shot ids from source take to regenerated take.
- [ ] Copy source shot list id from source take to regenerated take.
- [ ] Copy `SceneShotVideoTakeState` without shared mutable references.
- [ ] Copy selected prepared input relationships.
- [ ] Do not copy non-selected prepared input history into regenerated takes.
- [ ] Attach first video to a draft take with no video.
- [ ] Create copied take when finalizing from a take that already has video.
- [ ] Set `regeneratedFromTakeId` on copied takes.
- [ ] Validate video asset file ownership and media kind.
- [ ] Validate scene/take ownership.
- [ ] Return structured diagnostics for invalid finalization.
- [ ] Return resource keys for scene Takes, source take, target take, take video,
      and asset.

### Studio Server

- [ ] Add core resolver for take video files.
- [ ] Add Studio server video file route.
- [ ] Add video URLs to take overview responses.
- [ ] Add video URLs to take create responses.
- [ ] Add video URLs to take production context responses.
- [ ] Add video URLs to take edit context responses.
- [ ] Keep HTTP handlers free of video ownership business logic.
- [ ] Add structured error responses for mismatched video file route params.

### Studio Browser

- [ ] Add `VideoPreview` under `packages/studio/src/ui`.
- [ ] Add `VideoPlayer` under `packages/studio/src/ui`.
- [ ] Update `SceneTakeCard` to prefer take video over storyboard preview.
- [ ] Keep storyboard collage as draft-only fallback.
- [ ] Update `SceneShotVideoStage` to render the active take video.
- [ ] Wire custom playback controls with local UI primitives.
- [ ] Avoid native browser controls in feature code.
- [ ] Avoid showing raw filenames, asset ids, output ids, or generation run ids.
- [ ] Do not add a manual regenerate, duplicate, or copy button to
      `SceneShotVideoStage`.
- [ ] Follow the automatic iteration direction in
      `plans/active/0100-shot-video-take-automatic-iteration-and-migration-repair.md`.
- [ ] Open the active iteration take returned by core or requested through
      Studio coordination.

### Studio Refresh

- [ ] Add `matchesSceneTakesResource`.
- [ ] Update `SceneTakesTab` to use the take matcher.
- [ ] Reload take list on scene Takes resource events.
- [ ] Reload open edit context on active take resource events.
- [ ] Reload open edit context on take-video events.
- [ ] Reload AI Production context and plan on take resource events.
- [ ] Reload AI Production prompt after authoring apply events.
- [ ] Match `scene-shot-video-take-prompt:<takeId>` in the AI Production hook.
- [ ] Reload AI Production after prepared input import/select/clear/delete.
- [ ] Flush dirty AI Production autosave before applying external refresh.
- [ ] Preserve local dirty state and show error when flush fails.

### CLI And Agent Surfaces

- [ ] Update `renku media import --purpose shot.video-take` semantics.
- [ ] Update JSON report with `sourceTake`, `take`, `video`, and
      `createdRegeneratedTake`.
- [ ] Update human output to name the take that received the video.
- [ ] Emit take-video resource keys after shot-video import/finalization.
- [ ] Update generation workflow docs to require explicit finalization after
      `generation run`.
- [ ] Update media-producer skill guidance in `studio-skills`.
- [ ] Update movie-director regeneration guidance in `studio-skills`.
- [ ] Ensure skills never copy take state manually.

### Tests

- [ ] Add core finalization tests for draft takes.
- [ ] Add core finalization tests for regeneration copies.
- [ ] Add core copied-state tests for structure, production, prompt, references,
      and selected inputs.
- [ ] Add core structured diagnostic tests for invalid video finalization.
- [ ] Add migration tests for one output.
- [ ] Add migration tests for multiple outputs.
- [ ] Add Studio server route tests for video URLs and video file serving.
- [ ] Add Studio browser tests for video cards.
- [ ] Add Studio browser tests for video stage rendering.
- [ ] Add Studio browser tests for take resource refresh.
- [ ] Add Studio browser tests for AI Production prompt refresh.
- [ ] Add CLI tests for draft finalization.
- [ ] Add CLI tests for regenerated take finalization.
- [ ] Add CLI notification tests for take-video resource keys.

### Manual Verification

- [ ] Verify Urban Basilica migrated `scene_shot_video_take_cdstd9w8` has a
      visible video.
- [ ] Verify the Takes grid shows the generated video preview.
- [ ] Verify the take editor stage plays the generated video.
- [ ] Verify AI Production prompt updates after CLI/agent prompt changes.
- [ ] Verify regenerating from a videoed take creates a new take.
- [ ] Verify the original take keeps its original video.
- [ ] Verify the new take keeps copied settings and can be edited separately.
- [ ] Verify no paid generation was run unless explicitly approved.

## Success Criteria

This plan is complete when:

- the existing Urban Basilica "City smoke before the wall" generated video is
  visible in the Takes grid and take editor;
- the take editor stage no longer says "No shot video yet" when `take.video`
  exists;
- the Takes grid uses storyboard previews only for draft takes without video;
- AI Production prompt changes made by an agent or CLI appear without a browser
  refresh;
- finalizing a second video from a take creates a copied take, not a hidden
  output under the first take;
- users can compare regenerated videos as separate takes;
- all durable decisions about take video ownership, regeneration, and copied
  settings are enforced by core.
