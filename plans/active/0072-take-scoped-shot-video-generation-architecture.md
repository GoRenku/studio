# 0072 Take-Scoped Shot Video Generation Architecture

Status: proposed
Date: 2026-06-16

## Summary

The first multi-shot video-take implementation modeled shot grouping as global
Scene Shot List state. That made the UI and data model harder to reason about:
grouping Shots 2-4 for one video take changed the shot-list document itself,
even though the user was really defining the source shots for one take
generation attempt.

This plan changes the ownership model:

- Scene Shot Lists own the ordered shots, shot design fields, and storyboard
  images.
- Shot Video Take Generations own the selected shot membership, production
  settings, references, generated dependency inputs, prompt drafts, and
  compatibility snapshot for one take-generation workspace.
- Shot Video Takes own generated/imported video outputs and preserve the shot
  membership used by that specific output.
- The Takes tab lists video takes and take-generation workspaces; it is not the
  place for global shot grouping.

This is an architecture and data-model slice. It intentionally does not try to
finish the final polished Takes UI. The current shot video UI may be partially
broken or visually awkward while this lands. That is acceptable for this
pre-customer stage as long as the new architecture has one thin end-to-end path:

1. create a Shot Video Take Generation from the active Scene Shot List;
2. open a minimal take-generation workspace using the current shot editing
   surface as much as practical;
3. create or import a final Shot Video Take under that generation;
4. list that take in a minimal Takes tab;
5. report whether the generation is editable or view-only based on the current
   shot-list and storyboard compatibility snapshot.

Do not keep the old global shot grouping model as a compatibility layer.

## Product Correction

The user model should be:

1. The scene has an active Scene Shot List. This is the canonical list of shots
   generated for the narrative scene.
2. The user chooses one or more shots for a take generation.
3. Studio opens a Take Generation workspace for that selected shot set.
4. The left pane can still show all shots for context, but only the selected
   take-generation shots are part of the editable take group.
5. Non-selected shots are visible context until a future interaction adds them
   to the take generation.
6. The Takes tab shows generated/imported video takes and take-generation
   workspaces, not global shot groups.

The current global group behavior is misleading because it turns a take-local
choice into a persistent property of the shot list.

Example:

- Scene has Shots 1-6.
- The user generates a take from Shots 2-4.
- Later the user wants a separate take from Shots 3-5.

Those are two take-generation choices. The Scene Shot List should not be
mutated from a global `2-4` group to a global `3-5` group just because the user
is trying a different video take.

## Goals

- Add a durable `SceneShotVideoTakeGeneration` concept in Core.
- Move shot-video production settings out of `SceneShotListDocument`.
- Remove `videoTakeRailGroups` and `videoTakeProductionGroups` from the active
  shot-list ownership model.
- Make generated/imported video takes reference their owning take generation.
- Preserve each final take's ordered shot ids independently from the take
  generation's current selected shot ids.
- Add compatibility snapshots so Studio can decide whether a take generation is
  editable or view-only.
- Keep one minimal Studio path for creating a take generation, opening it, and
  seeing generated/imported takes.
- Update CLI, Studio server routes, tests, and agent-facing contracts directly
  to the new model.
- Delete obsolete global grouping code instead of keeping wrappers, aliases,
  or fallback branches.

## Non-Goals

- Do not build the final polished take editor in this slice.
- Do not implement full add/remove-shot interactions in the UI in this slice.
- Do not preserve old `productionGroupId` routes as compatibility endpoints.
- Do not keep old shot-list JSON fields as aliases.
- Do not add migration code that reconstructs old global groups into the new
  model. Existing pre-customer projects may need regeneration or reset.
- Do not add a historical shot-list reconstruction system.
- Do not store full copies of every prior Scene Shot List and storyboard image
  just to edit old takes.
- Do not redesign the provider model catalog or pricing architecture.
- Do not add dependencies.

## Current State To Replace

Current shot-video grouping lives inside `SceneShotListDocument`:

- `videoTakeRailGroups`
- `videoTakeProductionGroups`
- `ShotVideoTakeProductionGroup`
- `ShotVideoTakeRailGroup`

The current database tables also scope shot-video inputs and final video takes
through:

- `sceneId`
- `shotListId`
- `productionGroupId`
- ordered `shotIds`

The problematic part is not that final takes remember shot ids. That part is
good. The problematic part is that `productionGroupId` is stored as if it were a
shot-list-owned grouping concept.

Current behavior to remove:

- click-to-group shot rail behavior in the Shots tab;
- `updateShotVideoTakeRailGroups`;
- `carryProductionPlanForShotMembership` as a global shot-list group mutation
  helper;
- route contracts that infer the shot-video context only from the active
  shot-list and a global production group;
- tests that assert global rail group persistence.

## New Domain Model

### Scene Shot List

The Scene Shot List remains the source of truth for:

- ordered shots;
- shot ids;
- shot description and shot spec fields;
- per-shot cast/location/reference design;
- storyboard image ownership;
- active shot list per scene.

It must not own take-generation shot grouping.

Remove from `SceneShotListDocument`:

```ts
videoTakeRailGroups?: ShotVideoTakeRailGroup[];
videoTakeProductionGroups?: ShotVideoTakeProductionGroup[];
```

Remove or replace the related public contracts:

- `ShotVideoTakeProductionGroup`
- `ShotVideoTakeRailGroup`
- `ShotVideoTakeProductionPlan` as a shot-list nested type

The production plan itself should survive under the new take-generation owner,
but it should no longer be nested in the shot-list document.

### Shot Video Take Generation

Add a durable project object:

```ts
interface SceneShotVideoTakeGeneration {
  takeGenerationId: string;
  sceneId: string;
  shotListId: string;
  title: string;
  shotIds: string[];
  production: ShotVideoTakeGenerationProduction;
  compatibility: SceneShotVideoTakeGenerationCompatibility;
  createdAt: string;
  updatedAt: string;
}
```

Use the public name `SceneShotVideoTakeGeneration` because the object is
scene-owned and represents a durable take-generation workspace.

It owns:

- the current ordered shot ids selected for that generation;
- input mode, model choice, route parameters, custom prompt notes, requested
  inputs, prepared inputs, and agent proposals;
- generated/imported dependency inputs scoped to this generation;
- a compatibility snapshot captured when the generation is created or when its
  selected shot set is deliberately changed.

The implementation may split the public contract into more focused types if the
final names stay domain-specific. Avoid `Setup`, `Record`, or `Data` for public
contract objects unless the naming guidelines clearly call for an internal
boundary shape.

### Shot Video Take

A Shot Video Take is a generated/imported video output.

It should reference:

- `takeGenerationId`;
- `sceneId` for efficient scene listing;
- asset and asset file ids;
- optional media generation run id;
- ordered shot ids captured at the moment this output was created;
- selected state;
- created and updated timestamps.

The final take must preserve its own `shotIds` even if a future UI allows the
owning take generation to add or remove shots later. This prevents a take output
from silently changing meaning after it exists.

## Compatibility Model

Compatibility answers one user-facing question:

> Can this take generation still be edited against the current scene shot list?

Add a compatibility snapshot to the take-generation record.

The snapshot should include:

- active shot list id at creation time;
- ordered full shot-list shot ids;
- full shot-list content fingerprint;
- storyboard state fingerprint;
- selected shot ids;
- selected shot content fingerprint;
- selected storyboard state fingerprint;
- optional scene narrative fingerprint if the current core helpers can compute
  it cleanly without bloating this slice.

The full shot-list fingerprint is intentionally conservative. The user model is
"editable only if the shot list is still the same," including added/removed
shots and storyboard image changes. A future product decision can loosen this,
but this slice should keep the rule simple and easy to explain.

Compatibility states:

```ts
type SceneShotVideoTakeGenerationEditState =
  | 'editable'
  | 'view-only';

type SceneShotVideoTakeGenerationIncompatibilityReason =
  | 'active-shot-list-changed'
  | 'shot-list-content-changed'
  | 'storyboard-images-changed'
  | 'selected-shots-missing'
  | 'selected-shot-content-changed'
  | 'selected-storyboard-images-changed'
  | 'scene-narrative-changed';
```

The read model should expose:

```ts
interface SceneShotVideoTakeGenerationCompatibility {
  editState: SceneShotVideoTakeGenerationEditState;
  reasons: SceneShotVideoTakeGenerationIncompatibilityReason[];
  message: string;
}
```

Use structured reason values in Core and let Studio map them to compact UI
copy.

Suggested UI copy:

- `editable`
  - "This take generation matches the current shot list."
- `active-shot-list-changed`
  - "This take was created from a different shot list."
- `shot-list-content-changed`
  - "The shot list has changed since this take was created."
- `storyboard-images-changed`
  - "Storyboard images changed since this take was created."
- `selected-shots-missing`
  - "One or more selected shots no longer exist."

Do not infer editability in React by comparing partial client fields. Core must
own the compatibility projection.

## Database Shape

Before implementation, re-check
`docs/architecture/reference/drizzle-migrations.md` and use the current Drizzle
Kit workflow. The TypeScript Drizzle schema remains the source of truth.

Add a table for take-generation workspaces:

```text
scene_shot_video_take_generation
```

Recommended columns:

```text
id
scene_id
shot_list_id
title
production_json
compatibility_snapshot_json
created_at
updated_at
```

Add a membership table:

```text
scene_shot_video_take_generation_shot
```

Recommended columns:

```text
take_generation_id
shot_id
shot_order
shot_content_fingerprint
storyboard_image_id
storyboard_asset_file_id
storyboard_content_fingerprint
```

The membership table stores the selected shot set. The snapshot JSON stores the
full shot-list and storyboard fingerprints needed for editability.

Update final take rows:

```text
scene_shot_video_take
```

Replace `shot_list_id` and `production_group_id` ownership with
`take_generation_id`.

Keep or add:

```text
scene_id
asset_id
asset_file_id
media_generation_run_id
is_selected
created_at
updated_at
```

Keep the final take shot membership table:

```text
scene_shot_video_take_shot
```

It remains necessary because each generated/imported output must preserve the
ordered shot ids used for that output.

Update generated/imported dependency input rows:

```text
scene_shot_video_take_input
```

Replace `shot_list_id` and `production_group_id` ownership with
`take_generation_id`.

Keep:

```text
input_kind
subject_kind
subject_id
asset_id
asset_file_id
media_generation_run_id
selection
created_at
updated_at
```

The unique selected-input constraint should become:

```text
take_generation_id, input_kind, subject_kind, subject_id
where selection = 'select'
```

Delete `scene_shot_video_take_input_shot` unless implementation finds a real
current need that is not already covered by take-generation membership and
input subject fields. Do not keep it merely because the old model had it.

## JSON Contracts

Move production settings into a take-generation-owned JSON shape. A possible
public contract:

```ts
interface ShotVideoTakeGenerationProduction {
  inputModeId?: ShotVideoTakeInputModeId;
  modelChoice?: ShotVideoTakeModelChoice;
  parameterValues?: ShotVideoTakeParameterValues;
  requestedInputs?: ShotVideoTakeRequestedInput[];
  preparedInputs?: ShotVideoTakePreparedInput[];
  agentProposal?: ShotVideoTakeAgentProposal;
  customPromptNote?: string;
}
```

This is structurally close to the current `ShotVideoTakeProductionPlan`, but
the owner and naming should change to make the architecture clear.

Persisted JSON must be validated with AJV schemas before writes and after
reads. Do not parse `production_json` or `compatibility_snapshot_json` with
ad hoc guards.

## Core Service Contract

Add purpose-specific service operations for take generations:

```ts
createSceneShotVideoTakeGeneration
readSceneShotVideoTakeGeneration
listSceneShotVideoTakeGenerations
updateSceneShotVideoTakeGenerationProduction
updateSceneShotVideoTakeGenerationShots
readSceneShotVideoTakeGenerationPlan
estimateSceneShotVideoTakeGeneration
previewSceneShotVideoTakeGeneration
```

The first implementation may defer `updateSceneShotVideoTakeGenerationShots` if
the minimal UI does not yet support add/remove. Still design the table and
contract so shot membership belongs to the take generation, not the shot list.

Replace context input:

```ts
sceneId
shotListId
shotIds
productionGroupId
```

with:

```ts
takeGenerationId
```

Context builders may still read `sceneId`, `shotListId`, and `shotIds` from the
take-generation row after the row is loaded.

The context should include:

- take generation id;
- current generation shot ids;
- current compatibility state;
- selected shots;
- all shots in the source shot list for display/context;
- generated/imported inputs for this take generation;
- existing final takes for this take generation.

Do not keep a fallback path that accepts old global production group inputs.

## Media Generation Specs And Runs

Update `SceneShotMediaGenerationTarget`.

Current target identity is built around:

```ts
sceneId
shotListId
productionGroupId
shotIds
```

The new target should be take-generation owned:

```ts
interface SceneShotVideoTakeGenerationTarget {
  kind: 'sceneShotVideoTakeGeneration';
  id: string;
  sceneId: string;
  takeGenerationId: string;
  shotIds: string[];
}
```

If keeping `kind: 'sceneShotGroup'` creates confusion, rename it in this slice
and update callers directly. Do not keep both target kinds.

Generation specs should bind to `takeGenerationId` and carry the ordered shot
ids used when the spec is created. Validation should fail fast if the spec shot
ids no longer match the take-generation context being prepared.

Generation runs already store spec snapshots and provider payload snapshots.
Keep that behavior.

## Import Behavior

Update shot-video input imports:

- `shot.first-frame`
- `shot.last-frame`
- `shot.reference-image`
- `shot.multi-shot-storyboard-sheet`

They should import into a `takeGenerationId`, not a global production group.

Update final `shot.video-take` import so the imported video take references the
owning `takeGenerationId`.

Final video take imports must continue to store the output's own ordered
`shotIds`.

## Studio Server Routes

Replace the active-shot-list-only production routes with take-generation routes.

Current pattern to retire:

```text
/screenplay/scenes/:sceneId/video-take-production
```

New route family:

```text
/screenplay/scenes/:sceneId/take-generations
/screenplay/scenes/:sceneId/take-generations/:takeGenerationId
/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/plan
/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/estimate
/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/select
/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/clear
/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/inputs/:inputId
```

The create route should accept:

```ts
{
  shotListId: string;
  shotIds: string[];
  title?: string;
}
```

Core must validate that:

- the shot list belongs to the scene;
- the shot ids exist;
- shot ids are ordered by the shot list;
- grouped shot ids are contiguous if the selected route requires contiguity.

The minimal Studio route may use the active shot list by default when creating
from the UI, but the persisted take-generation record must store the explicit
`shotListId`.

## Minimal Studio UI Slice

This plan does not require the final UI, but it does require one thin working
surface.

Minimum acceptable UI:

- Scene panel includes a `Takes` tab.
- `Takes` tab lists take generations and generated/imported final takes for
  the scene.
- Empty state has a `Generate Take` action.
- `Generate Take` creates a take generation from the active shot list and an
  explicit ordered shot selection.
- If full shot multi-select is too large for this slice, default to the current
  selected shot from the scene route or the first shot in the active shot list.
- Opening a take generation renders a minimal workspace that can reuse the
  current shot detail/AI Production UI where practical.
- The workspace must be wired by `takeGenerationId`, not by global
  `productionGroupId`.
- View-only state is visible when Core reports incompatible compatibility.

Important UI constraints:

- Use local shadcn UI controls only.
- Do not add raw HTML form or interactive controls.
- Do not optimize mobile behavior.
- Do not invent decorative card-heavy layout work in this slice.

It is acceptable if:

- the old global group editing rail disappears;
- the current Shots tab no longer includes AI Production controls;
- the take-generation workspace looks like a rough reuse of the existing shot
  detail surface;
- add/remove selected shots is deferred to the next UI iteration.

It is not acceptable if:

- a take generation is secretly implemented as shot-list global grouping;
- React infers editability without Core compatibility data;
- the old routes remain as compatibility wrappers.

## CLI And Agent Surface

Update CLI commands that currently accept shot-video `--shot-list`,
`--shots`, and `--production-group` for production update/preflight/input
selection.

New shot-video production commands should accept a take-generation id:

```bash
renku generation context --purpose shot.video-take --take-generation <id> --json
renku generation production update --purpose shot.video-take --take-generation <id> --file <json> --json
renku generation preflight --purpose shot.video-take --take-generation <id> --json
renku generation input list --purpose shot.video-take --take-generation <id> --json
renku generation input select --purpose shot.video-take --take-generation <id> --input <id> --json
renku generation input clear --purpose shot.video-take --take-generation <id> --kind <kind> --subject-kind <kind> --subject-id <id> --json
```

Add or update a command to create take generations:

```bash
renku generation take create --target scene:<scene-id> --shot-list <id> --shots <ids> --json
```

The exact command name may be adjusted during implementation, but the public
command must be named deliberately in the implementation before code is written.
Do not hide creation behind a generic helper command.

Update Renku Studio skills after the architecture lands so agents create take
generations before authoring shot-video prompts or importing shot-video media.

The source skill tree to update is outside this repo:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Do not only patch generated plugin cache copies. Update the source skills and
then refresh/reinstall through the normal local plugin workflow if the runtime
skill cache needs to pick up the changes.

Likely affected files from a first scan:

- `media-producer/SKILL.md`
- `media-producer/references/shot-video-take.md`
- `media-producer/references/shot-multi-shot-storyboard-sheet.md`
- `media-producer/references/shot-first-last-frame.md`
- `media-producer/references/shot-reference-images.md`
- `media-producer/samples/shot-video-take-final-spec.json`
- `media-producer/samples/shot-video-take-production-group.json`
- `media-producer/samples/shot-first-frame-spec.json`
- `media-producer/samples/shot-last-frame-spec.json`
- `media-producer/samples/shot-reference-image-spec.json`
- `media-producer/samples/shot-multi-shot-storyboard-sheet-spec.json`
- `movie-director/references/workflow-playbooks.md`
- `movie-director/references/department-map.md`
- `movie-director/references/cli-coverage-and-gaps.md`

The implementation should re-run a search over that source tree for
`productionGroupId`, `production group`, `shot.video-take`,
`shot.multi-shot-storyboard-sheet`, `--shot-list`, and `--shots` before calling
the skill update complete.

## Implementation Slices

### Slice 1: Contracts And Schema

- Add public client contracts for take generations.
- Remove shot-list-owned video take rail and production groups from public
  contracts.
- Add Drizzle schema for take generation and membership tables.
- Update shot-video input and final take schemas to reference
  `takeGenerationId`.
- Generate migrations with Drizzle Kit.
- Add AJV schemas for take-generation production and compatibility snapshot
  JSON.

### Slice 2: Core Data Access And Compatibility

- Add data access for creating, reading, listing, and updating take
  generations.
- Add fingerprint builders for shot-list content and storyboard state.
- Add compatibility projection.
- Update input listing/selection/import behavior to scope by take generation.
- Update final take import behavior to scope by take generation.
- Delete global rail group mutation code.

### Slice 3: Shot Video Generation Context

- Update shot-video context input to use `takeGenerationId`.
- Update dependency inventory, reference sections, preflight, estimate, plan,
  spec validation, provider payloads, and run behavior to read from the take
  generation context.
- Update resource keys to include take-generation ids.
- Update tests around stale shot groups so they assert take-generation
  compatibility and spec/context mismatch behavior.

### Slice 4: Studio Server And Minimal Studio UI

- Add take-generation HTTP routes.
- Remove old global production group routes.
- Add minimal Takes tab.
- Add minimal create/open path.
- Wire the existing AI Production surface through `takeGenerationId` where
  practical.
- Show view-only state from Core compatibility.

### Slice 5: CLI, Skills, Docs, And Cleanup

- Update CLI command handlers.
- Update agent-facing media generation docs.
- Update source skills under
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills` that mention
  shot-video production groups or old shot-video CLI arguments.
- Delete obsolete tests and code paths.
- Add architecture tests that reject reintroduction of shot-list video take
  grouping fields.

## Validation Strategy

Focused Core tests:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/shot-video-take --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/database --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/scene-shot-list-json --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/architecture.test.ts --no-file-parallelism
```

Focused Studio tests:

```bash
pnpm --dir packages/studio exec vitest run src/features/movie-studio/scenes --no-file-parallelism
pnpm --dir packages/studio exec vitest run server/routes --no-file-parallelism
```

Focused CLI tests:

```bash
pnpm --dir packages/cli exec vitest run src/commands/generation-command-handlers.test.ts --no-file-parallelism
pnpm --dir packages/cli exec vitest run src/commands/media-import-command-handlers.test.ts --no-file-parallelism
```

Final verification:

```bash
pnpm build:core
pnpm test:core
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm check
```

Adjust exact test file names to the implementation if existing tests have
different owners. Do not skip Core architecture checks.

## Review Guidance

Reject an implementation if it:

- keeps `videoTakeRailGroups` or `videoTakeProductionGroups` on
  `SceneShotListDocument`;
- keeps `productionGroupId` as the owner of shot-video production state;
- adds compatibility wrappers for old routes or old CLI flags;
- stores take grouping in React-only state without a durable take-generation
  row;
- makes final takes derive their shot ids from the current generation instead
  of preserving output-time shot ids;
- lets Studio decide editability without Core compatibility reasons;
- hand-writes Drizzle migration SQL without an explicit documented reason;
- adds raw browser controls in Studio feature code;
- adds generic helper/barrel files to avoid updating callers.

Accept an implementation if it:

- leaves some existing UI rough while the model is corrected;
- removes old tests rather than preserving obsolete behavior;
- uses direct caller updates instead of aliases;
- keeps the minimal Takes tab plain and utilitarian;
- defers polished add/remove-shot UI to the next plan while preserving the data
  model needed for it.

## Completion Notes

Implemented in this slice. Automated verification passed for Core, CLI, Studio,
architecture checks, builds, and repository `pnpm check`. Browser smoke testing
opened the real Studio dev server at `http://localhost:5173/`, rendered the
Project Library, and opened the sample project with no browser console errors.
Scene-level manual take checks were blocked by existing local sample-project
shot-list JSON that now fails the intentionally stricter obsolete-field
validation; those paths are covered by the updated Core, Studio server, Studio
UI, and CLI tests.

## Completion Checklist

### Review Area

- [x] Confirm this plan supersedes global shot-video rail grouping from
      `0047-shot-rail-grouping-click-behavior.md`.
- [x] Confirm this plan supersedes shot-list-owned AI Production grouping from
      `0041-shot-ai-production-studio-ui.md` where those details conflict.
- [x] Confirm the Scene Shot List remains the source of truth for ordered shots
      and storyboard images.
- [x] Confirm Shot Video Take Generation is the owner of selected shot
      membership and production settings.
- [x] Confirm final Shot Video Takes preserve output-time shot membership.
- [x] Confirm no compatibility shims, old route aliases, old CLI aliases, or
      re-export stubs are planned.
- [x] Confirm naming follows `docs/architecture/naming-guidelines.md`.

### Architecture And Contracts

- [x] Add public client contracts for `SceneShotVideoTakeGeneration`.
- [x] Add public client contracts for take-generation compatibility state.
- [x] Rename or replace `SceneShotMediaGenerationTarget` so shot-video targets
      are take-generation owned.
- [x] Move production settings out of shot-list contract ownership.
- [x] Remove `ShotVideoTakeRailGroup` from public contracts.
- [x] Remove `ShotVideoTakeProductionGroup` from public contracts.
- [x] Keep a take-generation-owned production contract with deliberate naming.
- [x] Update public import/export entrypoints directly.
- [x] Confirm no non-index local re-export files are added.

### Drizzle Schema And Migration

- [x] Re-read `docs/architecture/reference/drizzle-migrations.md` before
      implementation.
- [x] Add `scene_shot_video_take_generation`.
- [x] Add `scene_shot_video_take_generation_shot`.
- [x] Update `scene_shot_video_take` to reference `take_generation_id`.
- [x] Update `scene_shot_video_take_input` to reference
      `take_generation_id`.
- [x] Replace selected-input unique constraint with a take-generation-scoped
      selected-input constraint.
- [x] Delete `scene_shot_video_take_input_shot` if no current owner remains.
- [x] Generate SQL migrations with Drizzle Kit.
- [x] Apply migrations with Drizzle Kit in validation.
- [x] Confirm no hand-written TypeScript migration registry is introduced.

### Persisted JSON Validation

- [x] Add AJV schema for take-generation production JSON.
- [x] Add AJV schema for compatibility snapshot JSON.
- [x] Validate production JSON before writes.
- [x] Validate production JSON after reads.
- [x] Validate compatibility snapshot JSON before writes.
- [x] Validate compatibility snapshot JSON after reads.
- [x] Use structured `ProjectDataError` or diagnostics for invalid persisted
      JSON.

### Core Data Access

- [x] Add create take-generation data access.
- [x] Add read take-generation data access.
- [x] Add list take-generations for scene data access.
- [x] Add update take-generation production data access.
- [x] Add update take-generation selected shots data access if included in this
      slice.
- [x] Add list final takes for take generation.
- [x] Add list final takes for scene.
- [x] Add select final take behavior scoped to take generation.
- [x] Update shot-video input listing to use take generation.
- [x] Update shot-video input selection to use take generation.
- [x] Update shot-video input clearing to use take generation.
- [x] Update shot-video input deletion to use take generation.

### Compatibility Projection

- [x] Add full shot-list content fingerprint builder.
- [x] Add selected shot content fingerprint builder.
- [x] Add storyboard state fingerprint builder.
- [x] Include active shot list id in the compatibility snapshot.
- [x] Include ordered full shot-list shot ids in the snapshot.
- [x] Include ordered selected shot ids in the snapshot.
- [x] Include latest storyboard image identity or missing state in the snapshot.
- [x] Add compatibility projection for editable/view-only state.
- [x] Add structured incompatibility reasons.
- [x] Add tests for active shot list changed.
- [x] Add tests for added shot.
- [x] Add tests for removed shot.
- [x] Add tests for reordered shot.
- [x] Add tests for selected shot content changed.
- [x] Add tests for storyboard image added, removed, or replaced.

### Shot Video Context And Planning

- [x] Replace shot-video context input with `takeGenerationId`.
- [x] Load scene, shot list, selected shots, and all display shots from the
      take-generation row.
- [x] Include compatibility state in context.
- [x] Scope available inputs to take generation.
- [x] Scope existing final takes to take generation.
- [x] Update model list behavior to use take-generation context.
- [x] Update dependency inventory to use take-generation context.
- [x] Update reference sections to use take-generation context.
- [x] Update preflight to use take-generation context.
- [x] Update estimate to use take-generation context.
- [x] Update plan report to use take-generation context.
- [x] Update final spec construction to bind `takeGenerationId`.
- [x] Update final spec validation to reject stale take-generation shot ids.

### Imports, Specs, And Runs

- [x] Update first-frame input import to use `takeGenerationId`.
- [x] Update last-frame input import to use `takeGenerationId`.
- [x] Update reference-image input import to use `takeGenerationId`.
- [x] Update multi-shot storyboard sheet input import to use
      `takeGenerationId`.
- [x] Update final video take import to use `takeGenerationId`.
- [x] Preserve final video take shot ids at import time.
- [x] Update media generation spec creation for take-generation targets.
- [x] Update media generation spec listing for take-generation targets.
- [x] Update media generation run preparation for take-generation targets.
- [x] Confirm generation run snapshots remain unchanged in principle.

### Obsolete Code Removal

- [x] Delete global shot rail group mutation code.
- [x] Delete `updateShotVideoTakeRailGroups`.
- [x] Delete route request readers for rail group updates.
- [x] Delete frontend shot rail grouping draft/cycling behavior or move only
      genuinely reusable visual projection to a take-generation owner.
- [x] Delete tests that only assert obsolete global group behavior.
- [x] Remove shot-list JSON validation for `videoTakeRailGroups`.
- [x] Remove shot-list JSON validation for `videoTakeProductionGroups`.
- [x] Add architecture tests rejecting these fields on Scene Shot List JSON.
- [x] Confirm `rg "videoTakeRailGroups|videoTakeProductionGroups|productionGroupId"`
      has only valid remaining references or no references after implementation.

### Studio Server

- [x] Add list take generations route.
- [x] Add create take generation route.
- [x] Add read take generation route.
- [x] Add update take generation production route.
- [x] Add plan route for take generation.
- [x] Add estimate route for take generation.
- [x] Add input selection route for take generation.
- [x] Add input clear route for take generation.
- [x] Add input delete route for take generation.
- [x] Add final take file route if needed by the minimal Takes tab.
- [x] Remove old `/video-take-production` route family.
- [x] Update request validation with structured diagnostics.
- [x] Confirm server responses serialize compatibility state.

### Minimal Studio UI

- [x] Add `Takes` scene tab.
- [x] Add minimal take-generation/take list.
- [x] Add empty state for no take generations or takes.
- [x] Add `Generate Take` action using local shadcn controls.
- [x] Create a take generation from explicit shot ids.
- [x] Open a take generation by id.
- [x] Wire existing AI Production controls to take-generation production state.
- [x] Show selected shots more prominently than non-selected context shots if
      the current shot rail is reused.
- [x] Show non-selected shots as context only.
- [x] Show Core-provided view-only state and reason.
- [x] Avoid raw `<button>`, `<input>`, `<select>`, `<textarea>`, or similar
      controls in feature code.
- [x] Do not test or optimize mobile behavior.

### CLI And Agent Workflows

- [x] Add CLI command to create take generations.
- [x] Update generation context command to accept take-generation id.
- [x] Update production update command to accept take-generation id.
- [x] Update preflight command to accept take-generation id.
- [x] Update input list/select/clear commands to accept take-generation id.
- [x] Update spec list/create/update behavior for take-generation targets.
- [x] Update media import command handlers for take-generation targets.
- [x] Remove old `--production-group` requirement for shot-video workflows.
- [x] Update agent-facing media generation docs.
- [x] Search `/Users/keremk/Projects/aitinkerbox/studio-skills/skills` for
      old shot-video take-generation language.
- [x] Update `media-producer/SKILL.md`.
- [x] Update `media-producer/references/shot-video-take.md`.
- [x] Update `media-producer/references/shot-multi-shot-storyboard-sheet.md`.
- [x] Update `media-producer/references/shot-first-last-frame.md`.
- [x] Update `media-producer/references/shot-reference-images.md`.
- [x] Update shot-video media-producer sample specs to use take-generation
      targets instead of `productionGroupId`.
- [x] Update movie-director workflow references that describe shot-video take
      generation handoffs.
- [x] Refresh/reinstall the local Renku skill/plugin cache if required by the
      normal plugin workflow.

### Tests

- [x] Add Core tests for take-generation create/read/list/update.
- [x] Add Core tests for final take import under take generation.
- [x] Add Core tests for input import and selection under take generation.
- [x] Add Core tests for compatibility projection.
- [x] Add Core tests for shot-video context by take generation id.
- [x] Update dependency inventory tests.
- [x] Update preflight tests.
- [x] Update final spec validation tests.
- [x] Update Studio server route tests.
- [x] Update minimal Studio UI tests.
- [x] Update CLI generation command tests.
- [x] Update CLI media import command tests.
- [x] Delete obsolete global rail group tests.

### Documentation

- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/architecture/data-model-and-storage.md`.
- [x] Update `docs/architecture/reference/domain-vocabulary.md` if
      `SceneShotVideoTakeGeneration` becomes a durable vocabulary term.
- [x] Add an ADR if the implementation changes durable ownership rules beyond
      this plan.
- [x] Do not edit historical plans only to rename obsolete fields.
- [x] Document the final minimal UI limitation and next planned UI iteration.

### Final Verification

- [x] Run focused Core tests.
- [x] Run focused Studio tests.
- [x] Run focused CLI tests.
- [x] Run Core architecture tests.
- [x] Run Drizzle migration generation and application checks.
- [x] Run `pnpm build:core`.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm --filter @gorenku/studio test`.
- [x] Run `pnpm check`.
- [ ] Manually verify creating a take generation from Studio. Blocked locally: the available sample project opens, but its stored shot-list JSON now fails the stricter validation after obsolete fields were removed; automated Studio route/UI coverage passed.
- [ ] Manually verify opening a take generation from Studio. Blocked by the same local sample-project validation issue; automated Studio route/UI coverage passed.
- [ ] Manually verify a generated/imported final take appears in Takes. Blocked by the same local sample-project validation issue; Core import and Studio API tests passed.
- [ ] Manually verify compatibility changes to view-only after a shot-list or
      storyboard change. Blocked by the same local sample-project validation issue; Core compatibility tests passed.
