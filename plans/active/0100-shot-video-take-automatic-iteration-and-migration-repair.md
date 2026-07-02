# 0100 Shot Video Take Automatic Iteration And Migration Repair

Status: implemented
Date: 2026-07-02

Implementation note, 2026-07-02: the code, migrations, CLI/agent guidance, and
automated verification for this plan are complete. The live Urban Basilica
database is now at schema generation 36. It has the schema-generation-35
`regenerated_from_take_id ON DELETE SET NULL` repair and the
schema-generation-36 shot-video-take relationship repair added after live data
showed the July 1 take state was intact but its take-owned relationship rows
were missing. The affected take `scene_shot_video_take_cdstd9w8` was recovered
from current durable state, current generation runs, and current asset files;
no June 30 project rollback was used. The already running Studio dev server may
need a restart because it can cache the previously expected schema generation;
do not restart the user's server from Codex without explicit permission.

## Summary

This plan resolves the two review findings from the Shot Video Take video
visibility and regeneration slice, while correcting the product direction for
regeneration.

The database finding is valid: changing `0044_shot_video_take_video.sql` is not
enough for project databases that already applied migration 0044 and are already
at `PRAGMA user_version = 34`. Add a follow-up Drizzle migration that runs for
those existing databases, repairs the `regenerated_from_take_id` foreign key,
preserves the current take-video table behavior, and advances the project store
schema generation.

The UI finding correctly notices that there is no longer a manual
copy-before-regeneration button, but the proposed remedy is not the product
direction. Do not restore a manual duplicate, copy, or regenerate button in the
take video stage. The correct product flow is automatic iteration:

1. The user opens a Shot Video Take in Take-Edit.
2. The AI agent generates and finalizes a video.
3. The successful video appears in the preview area automatically.
4. The user or agent can change settings, or generate again without changes.
5. If a new generation is started from a take that already has a video, core
   preserves the existing video take and creates the next take automatically at
   the correct domain boundary.
6. The Take-Edit UI stays on the latest active iteration, with no manual
   duplicate step.
7. Closing Take-Edit reveals the finalized video takes in the Takes tab.
8. Video take cards play on hover so the user can compare attempts quickly.
9. Reopening any take shows the configuration that generated that take's video.

The core rule is:

```text
one finalized generated video attempt = one Shot Video Take
```

The browser may feel like one continuous editing session, but durable project
data must still preserve one reviewable take per generated video.

## Relationship To Existing Plans

This plan amends `plans/active/0098-shot-video-take-video-visibility-and-regeneration.md`.

Keep these decisions from 0098:

- generated take videos are visible in the editor stage and Takes grid;
- draft takes without videos are valid editable workspaces;
- final video output belongs to a take-owned `video`, not a hidden output
  candidate list;
- finalizing a second video from an already-videoed source must create a
  separate take;
- Studio server and CLI remain thin adapters over core.

Supersede this 0098 direction:

- do not add a `RotateCcw` or other manual stage button for "Regenerate from
  this take";
- do not require the user to create a copied draft before generation;
- do not expose "copy for regeneration" as a primary user action in Take-Edit.

The product surface should behave as if generation simply continues in place.
The persistence layer should still create a new take automatically when needed
to preserve the configuration and video for each attempt.

## Review Finding Resolutions

### P1: Add A New Migration For The FK Fix

The review is correct.

Current problem:

- migration 0044 was edited after at least one development project database may
  already have applied the older 0044;
- Drizzle will not re-run an edited migration for a database that already
  recorded it in `__drizzle_migrations`;
- those databases can stay at `user_version = 34` with the old
  `regenerated_from_take_id` foreign key behavior;
- deleting a source take with regenerated children can still fail if the
  already-applied foreign key is `NO ACTION`;
- tests that execute the edited 0044 SQL directly only prove a fresh
  generation-33-to-34 migration path, not a real generation-34-to-current repair.

Required fix:

- add a new Drizzle migration after 0044;
- bump `PRAGMA user_version` from 34 to 35 in that migration;
- rebuild or otherwise repair `scene_shot_video_take` so
  `regenerated_from_take_id` has `ON DELETE SET NULL`;
- preserve all existing take rows, take lifecycle columns, shot memberships,
  take videos, selected inputs, indexes, and constraints;
- keep 0044 as historical migration input, not the only place where the fix
  lives;
- add tests that simulate an already-applied 0044 database and prove the new
  migration repairs it.

This is a one-way project database migration. It is not a compatibility layer.
The migration may mention historical column and table names only to transform
existing development data into the current model.

### P2: Keep Copy-Before-Regeneration Path

The review identifies a real preservation requirement but proposes the wrong
product shape.

What must be preserved:

- once a take has a video, that take represents the configuration that generated
  that video;
- generating another video must not silently overwrite the first take's
  generation configuration;
- the user must be able to compare both generated videos later in the Takes tab;
- opening either take must show the settings that produced that take's video.

What must not return:

- no manual duplicate button;
- no manual copy-before-regeneration button;
- no stage-level "Regenerate from this take" action;
- no user-visible copied draft step before the agent can run generation.

Correct resolution:

- core owns automatic continuation of an iteration;
- when a generation-affecting mutation targets a take that already has a video,
  core automatically creates the next editable take and applies the mutation
  there;
- when generation finalization targets a take that already has a video and no
  new draft was created first, core automatically creates the new take during
  finalization and attaches the video there;
- Studio updates the open Take-Edit selection to the active take returned by
  core or requested through Studio coordination;
- the UI continues to feel in-place, but project data still stores separate
  take/video attempts.

Concrete example:

1. Take A has Composition X, AI Production settings X, and Video A.
2. The user asks the agent to make it tighter and generate again.
3. The first generation-affecting write to Take A automatically creates Take B
   copied from Take A, then applies the tighter settings to Take B.
4. Studio stays in Take-Edit but is now editing Take B.
5. When Video B is finalized, it attaches to Take B.
6. The Takes tab shows Take A with Video A and settings X, plus Take B with
   Video B and the tighter settings.

If the user asks to generate again without any setting changes, finalization can
create Take B at import time. Take A and Take B then share the same copied
configuration, but each owns its own video.

## Product Workflow

### Open Draft Take

A draft take has `video: null`.

Expected behavior:

- Take-Edit shows the current composition, references, dialogue, and AI
  Production settings;
- the preview stage shows the quiet no-video placeholder;
- user and agent edits mutate the draft take directly through core-owned
  commands;
- successful generation finalization attaches the first video to that same take;
- Studio refreshes the open editor and shows the video automatically.

### Continue From A Finalized Take

A finalized take has `video != null`.

Expected behavior:

- opening the take shows the video and the configuration that generated it;
- pick, delete, and inspect actions still operate on that finalized take;
- generation-authoring changes do not overwrite that take in place;
- the first generation-authoring change automatically creates the next take,
  copies the finalized take's current generation settings, applies the change
  to the new take, and returns the new take as the active edit target;
- Studio moves the route and local state to the new take without a manual copy
  button;
- if the user asks the agent to generate again without edits, finalization
  creates the new take and attaches the new video.

Generation-authoring changes include:

- shot membership changes;
- structure mode changes;
- Composition, Motion, Dialogues, and References changes;
- reference selection and inclusion changes;
- selected prepared input changes;
- AI Production settings changes;
- prompt state and agent authoring document application;
- final generation spec updates that would affect the next video run.

Review actions that do not affect generation provenance, such as picking a take
or deleting a take, do not need to create a new iteration take.

### Takes Tab Review

The Takes tab should be the comparison surface.

Expected behavior:

- finalized takes show video cards first, not shot-grid cards;
- draft takes still use storyboard previews as a fallback because no video
  exists yet;
- hovering a finalized take card plays the video in the card;
- when hover ends, the card pauses and returns to a stable preview frame;
- keyboard focus should also start playback where practical, so the behavior is
  not pointer-only;
- card copy remains intentional domain copy, such as the take title or first
  shot label;
- do not show filenames, asset ids, generation run ids, or generated role names
  as card copy.

## Architecture Boundaries

### Core

`packages/core` owns:

- the one-video-per-take invariant;
- automatic iteration continuation for finalized takes;
- copying take-owned generation settings into the next take;
- deciding whether finalization attaches to the source take or creates a new
  take;
- validating scene, take, asset, and file ownership;
- preserving generation provenance for each finalized take;
- emitting resource keys for source take, target take, take video, inputs,
  prompt state, and scene Takes surfaces;
- Drizzle schema and migrations.

Core must not expose a broad arbitrary state patch API to make automatic
iteration easier.

### Studio Server

`packages/studio/server` remains a thin HTTP adapter:

- parse route params and request bodies;
- call core commands;
- serialize core responses;
- add browser URLs to validated video files;
- translate structured diagnostics;
- notify Studio coordination after successful mutations when the caller expects
  visible Studio refresh or focus.

The server must not decide whether a take should be copied. That belongs in
core.

### Studio Browser

`packages/studio/src` owns rendering and user intent:

- render the active take video in the preview stage;
- render hover-play video cards in the Takes tab;
- fall back to storyboard previews only for draft takes;
- update route selection when core returns a different active take id after an
  automatic iteration;
- respond to Studio coordination focus requests from agent/CLI finalization;
- keep Take-Edit visually continuous for the user.

React must not infer generation ownership from filenames, assets, generation
run ids, or local route state.

### CLI And Agent Workflows

CLI and skills must present generation as one smooth workflow:

```text
prepare or update current take settings
run generation
finalize/import the generated video
Studio refreshes and focuses the active take
```

They must not tell the user to click a manual duplicate, copy, or regenerate
button.

Agent-facing guidance must say:

- final generation is incomplete until the generated video is finalized/imported
  as a Shot Video Take video;
- finalization may attach to the current draft take or create the next take;
- after finalization, use the returned take id as the active take;
- if Studio is running, request focus to the returned take in Take-Edit.

## Core Contract Changes

### Automatic Iteration Helper

Add a core-owned helper for mutation commands:

```ts
continueSceneShotVideoTakeIteration(input): SceneShotVideoTakeIterationTarget
```

Proposed return shape:

```ts
export interface SceneShotVideoTakeIterationTarget {
  sourceTake: SceneShotVideoTake;
  take: SceneShotVideoTake;
  createdIterationTake: boolean;
  resourceKeys: string[];
}
```

Behavior:

- load and validate the requested source take;
- if the source take has no video, return it as the mutation target;
- if the source take has a video, insert a copied take;
- copy ordered shot ids;
- copy `sourceShotListId`;
- copy `SceneShotVideoTakeState`;
- copy selected prepared input relationships;
- do not copy non-selected prepared input history;
- set `regeneratedFromTakeId` on the copied take;
- return resource keys for both source and target when a new take is created.

The helper is internal to core server implementation unless a future accepted
plan needs a public CLI command. It is not a user-visible duplicate feature.

### Mutation Commands That Use Automatic Iteration

Update generation-authoring mutations to call
`continueSceneShotVideoTakeIteration` before writing:

- `updateSceneShotVideoTakeProduction`;
- `updateSceneShotVideoTakeDirection`;
- `updateSceneShotVideoTakeStructureMode`;
- `updateSceneShotVideoTakeShots`;
- `updateSceneShotVideoTakeCharacterSheetSelection`;
- `updateSceneShotVideoTakeLocationSheetSelection`;
- `updateSceneShotVideoTakeLookbookSheetSelection`;
- `updateSceneShotVideoTakeDialogueAudioSelection`;
- `updateSceneShotVideoTakeReferenceInclusion`;
- prepared input import, selection, clear, delete, and replace paths;
- shot-video input generation spec updates;
- final shot-video take spec updates;
- `applySceneShotVideoTakeAuthoringDocument`.

Each command should return the context/report for the actual active take after
the mutation. If a copied take was created, the returned `context.take.takeId`
must be the new take id.

Studio and CLI callers should update their active target from the returned take
id. They should not continue sending later writes to the finalized source take.

### Final Video Finalization

Keep `importShotVideoTake` or rename it directly as the current finalization
command, but do not keep two parallel behaviors.

Behavior:

- if the requested source take has no video, attach the imported video to it;
- if the requested source take has a video, create the next take and attach the
  imported video there;
- if the requested take is an automatically created iteration draft with no
  video, attach the video to that draft;
- return `sourceTake`, `take`, `video`, `createdRegeneratedTake`, and
  `resourceKeys`;
- include resource keys for the scene Takes surface, source take, target take,
  target take video, selected inputs when copied, and imported asset;
- do not leave hidden output candidates under the source take.

The finalization path is the backstop for "generate again without changing
anything." Automatic iteration on authoring writes covers the "tweak settings,
then generate" path.

### Structured Diagnostics

Use structured project data errors when:

- the source take does not exist;
- the source take belongs to another scene;
- the source take is read-only for lifecycle reasons;
- a non-video file is finalized as a take video;
- an asset file does not belong to the finalized take video;
- selected prepared inputs cannot be copied into an iteration take;
- an authoring document targets a stale take after an automatic iteration has
  already moved the active target.

Do not add diagnostics that recognize obsolete output-candidate runtime shapes.

## Database And Migration Plan

### Drizzle Workflow

Before implementation:

1. Re-read `docs/architecture/reference/drizzle-migrations.md`.
2. Check the current Drizzle Kit migration docs.
3. Use Drizzle Kit from `packages/core`.

Because the TypeScript schema already expresses the intended
`regenerated_from_take_id` behavior, this is expected to be a custom repair
migration:

```bash
pnpm drizzle-kit generate --config drizzle.config.ts --custom --name shot_video_take_regenerated_fk_repair
```

The generated migration should become the next ordered migration after 0044,
for example:

```text
packages/core/drizzle/0045_shot_video_take_regenerated_fk_repair.sql
```

The migration must set:

```sql
PRAGMA user_version = 35;
```

### Migration Behavior

The new migration must repair databases that already applied the old 0044.

Required behavior:

- preserve every row in `scene_shot_video_take`;
- preserve `id`, `scene_id`, `source_shot_list_id`, `title`, `state_json`,
  `is_picked`, `regenerated_from_take_id`, `history_snapshot_json`,
  timestamps, and discard lifecycle columns;
- recreate `regenerated_from_take_id` with `ON DELETE SET NULL`;
- recreate indexes on `scene_shot_video_take`;
- preserve all rows in `scene_shot_video_take_video`;
- preserve discard lifecycle columns on take videos;
- leave `scene_shot_video_take_video.take_id` cascading when the owning take is
  deleted;
- leave `media_generation_run_id` as `ON DELETE SET NULL`;
- keep runtime code reading only the current take-video tables.

Implementation may use the SQLite table-rebuild pattern for
`scene_shot_video_take`, because changing an existing foreign key usually
requires rebuilding the table.

### Migration Tests

Add tests for both migration paths:

- generation 33 to current, which applies 0044 and then 0045;
- generation 34 to current, where 0044 is already recorded and only 0045 runs.

The generation-34 fixture should simulate the already-applied old 0044 shape:

- `scene_shot_video_take` exists with `regenerated_from_take_id`;
- the foreign key is `NO ACTION`;
- `scene_shot_video_take_video` exists;
- `__drizzle_migrations` records 0044;
- `PRAGMA user_version = 34`.

Assertions:

- after migration, `PRAGMA user_version = currentProjectStoreSchemaGeneration()`;
- `currentProjectStoreSchemaGeneration()` is 35;
- `pragma foreign_key_list('scene_shot_video_take')` shows
  `regenerated_from_take_id` with `on_delete = SET NULL`;
- deleting the source take sets regenerated children to `NULL` rather than
  failing;
- take video rows and discard lifecycle values survive;
- fresh generation-33 projects still migrate successfully.

## Studio Browser Plan

### Take Video Stage

Keep `SceneShotVideoStage` focused:

- render `VideoPlayer` when the active take has `video`;
- render the quiet placeholder when the active take has no video;
- do not add a manual duplicate, copy, or regenerate button;
- do not show raw filenames, asset ids, or run ids;
- rely on agent/CLI generation plus resource refresh to update the stage.

### Take Card Hover Playback

Update `packages/studio/src/ui/video-preview.tsx` so it supports card preview
behavior:

- muted;
- plays inline;
- preload enough data for responsive hover;
- play on pointer hover;
- play on keyboard focus where practical;
- pause on pointer leave and blur;
- reset to a stable frame when playback stops;
- fail quietly if browser autoplay policy blocks playback.

Update `SceneTakeCard` and `ImageOverlayCard` only as needed to let preview
content receive hover/focus state cleanly.

Expected card behavior:

- finalized take cards show the generated video;
- hovering the card plays the video in place;
- draft take cards keep storyboard fallback;
- pick/delete controls continue to work through local shadcn UI primitives.

### In-Place Active Take Updates

When a Studio-initiated mutation returns a different active take id:

- update the active edit context from the returned context;
- update the Takes list so the new take appears;
- route to the new take id in Take-Edit;
- keep the selected shot and active tab when they still exist;
- default to AI Production after agent-driven generation setup when the caller
  explicitly requests that focus.

When an agent/CLI finalization creates a new take:

- notify Studio with project resource keys for source and target takes;
- request focus to the returned target take when the command's purpose is to
  keep the user on the latest generation;
- Studio applies the focus request and reloads the edit context.

## Studio Coordination Plan

Use existing Studio coordination event types:

- `studio.projectResourcesChanged` for invalidation;
- `studio.focusRequested` when an agent or CLI command should move the open UI
  to the target take.

Do not add a domain-event log.

If current `StudioSelection` documentation does not include the active Takes
selection shape, update the architecture reference and tests directly to match
the current browser route model:

```ts
{
  type: 'scene';
  id: string;
  sceneTab: 'takes';
  takeWorkspaceMode: 'edit';
  takeId: string;
  shotId?: string;
  shotTab?: SceneShotDetailTab;
}
```

This selection is ephemeral UI focus. It must not be stored in project SQLite.

## CLI And Skill Plan

### CLI

Update `renku media import --purpose shot.video-take` output:

- human output names the take that received the video;
- JSON output includes `sourceTake.takeId`, `take.takeId`,
  `createdRegeneratedTake`, `video`, and `resourceKeys`;
- when Studio is running, notify resource changes;
- when the command is part of an agent "generate and show me the result" flow,
  request focus to the returned take.

Update any generation commands or spec commands that mutate finalized takes so
they use the automatic iteration target returned by core.

### Studio Skills

Update `/Users/keremk/Projects/aitinkerbox/studio-skills` where agent-facing
guidance talks about shot video generation.

Required guidance:

- no manual duplicate or regenerate button exists;
- agents should work from the current take context;
- if they change settings on a finalized take, core may return a new active
  take id;
- agents must continue subsequent generation steps against the returned active
  take id;
- successful final video generation must be finalized/imported;
- after finalization, report the returned take id and request Studio focus when
  useful.

## Implementation Slices

### Slice 1: Migration Repair

- Re-read local Drizzle migration architecture.
- Check current Drizzle Kit docs.
- Generate a custom 0045 migration.
- Rebuild `scene_shot_video_take` to repair
  `regenerated_from_take_id ON DELETE SET NULL`.
- Set `PRAGMA user_version = 35`.
- Update schema-generation tests and migration fixtures.

### Slice 2: Core Automatic Iteration

- Add `SceneShotVideoTakeIterationTarget`.
- Add `continueSceneShotVideoTakeIteration`.
- Route generation-authoring mutations through the automatic iteration helper.
- Ensure mutation results return the actual active take.
- Keep pick/delete behavior attached to the selected finalized take.
- Keep structured diagnostics at package boundaries.

### Slice 3: Finalization And Coordination

- Verify finalization attaches first video to a draft take.
- Verify finalization creates a new take when targeting a videoed take.
- Ensure finalization uses the automatic iteration draft when one already
  exists.
- Return target take metadata in CLI and server responses.
- Emit resource keys for source and target take surfaces.
- Add or wire focus requests for agent/CLI workflows that should keep Studio on
  the latest take.

### Slice 4: Studio In-Place UX

- Remove any remaining manual regeneration-button plan or code references.
- Update Take-Edit mutation handlers to follow returned active take ids.
- Keep selected shot and tab stable when switching to the new active take.
- Keep the stage simple: video or placeholder.
- Add hover-play card preview behavior.
- Keep storyboard fallback for draft takes only.

### Slice 5: Skills And Documentation

- Update active plan 0098 or mark its manual regeneration-button section as
  superseded by this plan.
- Update Studio coordination selection docs if the Takes route shape is missing.
- Update `studio-skills` media producer and movie director guidance.
- Avoid compatibility language or obsolete output-candidate runtime guidance.

### Slice 6: Verification

- Run focused core migration tests.
- Run focused core shot-video take tests.
- Run focused CLI media import tests.
- Run focused Studio server route tests.
- Run focused Studio browser tests for Take-Edit and Takes cards.
- Use the real Urban Basilica project for manual desktop verification.
- Do not run paid generation unless separately approved.

## Completion Checklist

### Review Area

- [x] Confirm the P1 review finding is fixed by a new migration after 0044.
- [x] Confirm edited 0044 is not the only repair path.
- [x] Confirm generation-34 databases are tested directly.
- [x] Confirm P2 is resolved without restoring a manual duplicate/regenerate
      button.
- [x] Confirm the UI flow matches automatic agent/user iteration.
- [x] Confirm one finalized generated video attempt equals one Shot Video Take.
- [x] Confirm opening any finalized take shows the configuration that generated
      that take's video.

### Product Behavior

- [x] Draft take can be edited directly before first generation.
- [x] First successful finalization attaches video to the draft take.
- [x] Generated video appears in Take-Edit automatically after finalization.
- [x] User can ask the agent to generate again without pressing a Studio copy
      button.
- [x] Tweaking settings after a take has video automatically moves editing to a
      new take.
- [x] Generating again without setting changes creates the new take at
      finalization time.
- [x] Closing Take-Edit reveals multiple finalized video takes in the Takes tab.
- [x] Hovering a finalized take card plays the video preview.
- [x] Draft take cards still show storyboard fallback.

### Architecture And Contracts

- [x] Add `SceneShotVideoTakeIterationTarget`.
- [x] Add `continueSceneShotVideoTakeIteration`.
- [x] Keep automatic iteration in `packages/core`.
- [x] Keep Studio server handlers thin.
- [x] Keep CLI handlers thin.
- [x] Keep React as a projection consumer and intent sender.
- [x] Avoid a generic take-state patch API.
- [x] Avoid runtime compatibility aliases for obsolete output candidates.
- [x] Avoid user-visible copy/regenerate commands as the primary flow.

### Database And Migration

- [x] Re-read `docs/architecture/reference/drizzle-migrations.md`.
- [x] Check current Drizzle Kit migration docs.
- [x] Generate a custom migration after 0044.
- [x] Add `PRAGMA user_version = 35`.
- [x] Add follow-up `PRAGMA user_version = 36` relationship repair after live
      data showed missing take-owned shot, input, and video rows.
- [x] Update `currentProjectStoreSchemaGeneration()` expectations through the
      current schema generation 36.
- [x] Repair `regenerated_from_take_id` to `ON DELETE SET NULL`.
- [x] Preserve all `scene_shot_video_take` rows.
- [x] Preserve all take lifecycle columns.
- [x] Preserve all `scene_shot_video_take_video` rows.
- [x] Preserve take-video discard lifecycle columns.
- [x] Recreate required indexes.
- [x] Test generation 33 to current.
- [x] Test generation 34 to current.
- [x] Test generation 35 to current relationship repair.
- [x] Prove deleting a source take sets regenerated children to `NULL`.

### Core Implementation

- [x] Automatic iteration copies ordered shot ids.
- [x] Automatic iteration copies source shot list id.
- [x] Automatic iteration copies `SceneShotVideoTakeState`.
- [x] Automatic iteration copies selected prepared inputs.
- [x] Automatic iteration does not copy non-selected prepared input history.
- [x] Automatic iteration sets `regeneratedFromTakeId`.
- [x] Generation-authoring mutations write to the active iteration target.
- [x] Mutation reports return the actual active take.
- [x] Finalization attaches first video to draft take.
- [x] Finalization creates a take for repeat generation when needed.
- [x] Finalization returns source take, target take, video, and resource keys.
- [x] Structured diagnostics cover invalid scene, take, file, and copy cases.

### Studio Server And Coordination

- [x] Studio server serializes target take ids from core mutation responses.
- [x] Resource notifications include source and target take keys.
- [x] Agent/CLI finalization can request focus to the returned take.
- [x] Browser focus handling supports the Takes edit route shape.
- [x] Coordination events remain UI-only and do not store project history.

### Studio Browser

- [x] `SceneShotVideoStage` has no manual regenerate/copy button.
- [x] `SceneShotVideoStage` renders active take video when present.
- [x] `SceneShotVideoStage` renders placeholder only for no-video drafts.
- [x] `VideoPreview` plays on hover.
- [x] `VideoPreview` pauses and resets on hover end.
- [x] `SceneTakeCard` uses video preview for finalized takes.
- [x] `SceneTakeCard` uses storyboard fallback for draft takes.
- [x] Take-Edit route updates when mutation response returns a new take id.
- [x] Active selected shot and tab are preserved when possible.
- [x] No raw HTML form or interactive controls are introduced in feature code.
- [x] No mobile verification is required.

### CLI And Skills

- [x] `renku media import --purpose shot.video-take` reports the target take.
- [x] CLI JSON includes `createdRegeneratedTake`.
- [x] CLI notifications refresh Studio take surfaces.
- [x] CLI or agent flows request focus to the returned take when appropriate.
- [x] `studio-skills` guidance removes manual button assumptions.
- [x] Agents continue against returned active take ids.
- [x] Agents always finalize/import successful final video generations.

### Tests

- [x] Core migration test for 33 to current.
- [x] Core migration test for already-applied 34 to current.
- [x] Core automatic iteration test for production edits.
- [x] Core automatic iteration test for composition/direction edits.
- [x] Core automatic iteration test for reference selection edits.
- [x] Core automatic iteration test for authoring document apply.
- [x] Core finalization test for draft take.
- [x] Core finalization test for already-videoed take.
- [x] Core provenance test showing original take settings survive repeat
      generation.
- [x] Studio browser test for no manual stage regenerate button.
- [x] Studio browser test for hover-play take card video.
- [x] Studio browser test for active take id switching after automatic
      iteration.
- [x] CLI test for target take reporting.
- [x] Skill or fixture validation for updated agent guidance where available.

### Manual Desktop Verification

- [x] Migrate `/Users/keremk/renku-movies/urban-basilica`.
- [ ] Open the relevant scene in Studio desktop.
- [ ] Confirm existing generated video takes still show video.
- [ ] Confirm an already-migrated generation-34 database no longer fails when a
      source take with regenerated children is deleted.
- [ ] Generate or simulate finalization for a draft take and confirm the video
      appears automatically.
- [ ] Generate or simulate finalization again from the finalized take and
      confirm a second take appears.
- [ ] Hover each finalized take card and confirm video playback.
- [ ] Open each take and confirm it shows the configuration for its own video.
- [x] Confirm no paid generation was run unless separately approved.

Manual desktop verification note: the Urban Basilica database was verified
directly with SQLite. It is at `PRAGMA user_version = 36`, `PRAGMA
integrity_check` returns `ok`, and the affected take
`scene_shot_video_take_cdstd9w8` has four active shot rows, one active video
row, one active selected prompt-sheet input row, and four active input-shot
rows. The restored shot ids are `shot_001`, `shot_001b`, `shot_001c`, and
`shot_002`. The running Studio dev server at `http://localhost:5173` rejected
the schema-generation-36 project because that server process still expected
schema generation 35. The remaining desktop UI checks should be run after the
user restarts Studio with this implementation.

## Success Criteria

This work is complete when:

- already-applied 0044 project databases are repaired by a new migration;
- the project store schema generation advances beyond 34;
- deleting a source take no longer fails because of regenerated children;
- users never need a manual duplicate or regenerate button to continue a take;
- generated videos appear automatically in the open Take-Edit preview;
- repeated generations become separate video take cards;
- hover playback works for finalized take cards;
- reopening any take shows the settings that generated that take's video;
- core, not React or Studio routes, owns the automatic iteration rule.
