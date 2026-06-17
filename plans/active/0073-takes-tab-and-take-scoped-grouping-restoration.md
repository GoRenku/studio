# 0073 Takes Tab And Take-Scoped Grouping Restoration

Status: proposed
Date: 2026-06-17

## Summary

This plan corrects the current take-scoped shot-video implementation without
walking back the new ownership model from
`0072-take-scoped-shot-video-generation-architecture.md`.

The data model direction from 0072 remains correct:

- Scene Shot Lists own ordered shots, shot design fields, and storyboard images.
- Scene Shot Video Take Generations own the selected shot membership and AI
  Production setup for one take-generation workspace.
- Scene Shot Video Takes own final generated or imported video outputs.

The product and UI direction in 0072 is incomplete and must be corrected:

- The old grouping interaction must not disappear.
- The deleted grouping tests must be restored first and used as the behavioral
  source of truth.
- The grouping logic must be ported to the take-generation owner instead of
  being rewritten or replaced.
- The scene UI must expose `Narrative`, `Shots`, and `Takes`.
- The `Shots` tab is a review surface for the active production-numbered scene
  shot list; it is not where shot-video grouping or AI Production lives.
- The `Takes` tab must list prior final take videos as overlay cards and open
  the take edit or new-take workspace inside the same tab.
- Core, the CLI, Studio, and the Renku skills must share one production-style
  scene/shot/take reference language. Do not expose an act/sequence/scene
  shortcut as the public take-generation addressing model.

This plan supersedes the parts of 0072 that said it was acceptable for the old
global group editing rail to disappear or for add/remove-shot interactions to be
deferred. Those statements are no longer acceptable for this implementation
slice.

## Current Worktree Findings

The current worktree has already removed the core grouping files and the Studio
grouping files that held the hard-won behavior:

- Deleted core files:
  - `packages/core/src/server/media-generation/shot-video-take/production-groups.ts`
  - `packages/core/src/server/media-generation/shot-video-take/production-groups.test.ts`
  - `packages/core/src/server/media-generation/shot-video-take/shot-group.ts`
- Deleted Studio files:
  - `packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.ts`
  - `packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.test.ts`
  - `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-group-tag.tsx`

The current implementation has take-generation routes and records:

- `SceneShotVideoTakeGeneration`
- `updateSceneShotVideoTakeGenerationShots`
- `updateSceneShotVideoTakeGenerationProduction`
- `listSceneShotVideoTakeGenerations`
- `/screenplay/scenes/:sceneId/take-generations/:takeGenerationId/shots`

The current implementation does not restore the old grouping behavior:

- `ScenePanel` still exposes only `Narrative` and the current overloaded
  `Shots` surface.
- `SceneShotsTab` creates a single-shot take generation from the selected shot
  instead of keeping shot review separate from take creation/editing.
- The left rail no longer has the grouping cycle button or grouped segments.
- The old draft grouping review/apply flow is gone.
- `updateSceneShotVideoTakeGenerationShotMembershipRecord` updates membership
  but does not carry production settings with the same semantics as the deleted
  `carryProductionPlanForShotMembership`.
- There is no scene-level final take card read model for the Takes grid.
- There is no Studio route for final take video files comparable to the existing
  dialogue-audio take file route.
- There is no UI/API path to pick or unpick a final shot-video take from the
  Takes grid.
- Production scene numbers are not yet a Core-owned addressing contract for
  CLI, Studio, and agent workflows.

## Non-Negotiable Restoration Rule

Do not design a new grouping interaction.

The implementation must restore the deleted tests from git and adapt them to
the new take-generation owner. The scenario coverage, edge cases, and expected
state transitions must come from those tests. New tests may be added only after
the old coverage is back.

The restored behavior must include, at minimum:

- creating one-shot groups at the first and last shot boundaries;
- joining direct neighbor groups at either boundary;
- creating and clearing isolated one-shot groups;
- extending adjacent one-shot groups;
- joining and leaving direct groups above or below;
- cycling an ambiguous gap through above, below, merged, and none;
- removing top and bottom edge shots without empty groups;
- leaving a one-shot group behind when a two-shot edge leaves;
- splitting middle shots into upper and lower groups;
- splitting a three-shot group into two one-shot groups;
- cycling the middle shot after a split through above, below, merged, and none;
- dropping stale shot ids before applying a local click;
- keeping representative cycle outputs ordered and non-overlapping;
- preserving production settings when membership changes;
- marking copied prompt plans stale when shot membership changes;
- dropping prepared inputs when shot membership changes;
- keeping prepared inputs when shot membership does not change;
- preserving single-shot production settings when a visible one-shot grouping
  draft is cleared;
- keeping the open take's production settings when local draft groups merge;
- rejecting overlapping and non-contiguous grouped shot ids with structured
  core errors.

## Ownership Rules

Do not restore global Scene Shot List grouping fields.

The following fields must stay removed from `SceneShotListDocument`:

```ts
videoTakeRailGroups
videoTakeProductionGroups
```

Do not restore old public contracts as compatibility aliases:

```ts
ShotVideoTakeRailGroup
ShotVideoTakeProductionGroup
productionGroupId
```

The restored behavior is take-scoped:

- One edit workspace is backed by one `SceneShotVideoTakeGeneration`.
- The generation's current `shotIds` are the durable selected shot membership.
- The left rail may show local draft group states while editing, but saving must
  update only the open take generation.
- If a local draft split creates two visible groups, only the draft group that
  is associated with the open take generation is persisted.
- Sibling groups created by split/cycle behavior are local edit context only.
  They must not create global shot-list groups and must not silently create
  extra take generations.
- Final `SceneShotVideoTake` rows must continue to preserve their own output-time
  `shotIds`.

## Production Scene, Shot, And Take References

Public UI, CLI, and skill language must follow production-facing film terms:

- Scene number
- Shot number or setup reference
- Take number

Do not make `act:sequence:scene` the public reference language. Acts and
sequences may remain useful navigation context inside Studio, but the
production-facing address must be scene/shot/take.

Examples the user and agents must be able to express:

```text
Scene 23, shots 1-3
Scene 23, shot 2
Scene 23, take 3
Scene 23, shots 1-3, take 2
```

Core must own production scene numbering as screenplay data. This cannot be a
take UI helper, Studio-only derived count, CLI-only parser, or skill-only
convention.

Add a Core-owned production scene number contract:

```ts
interface SceneProductionNumber {
  sceneId: string;
  number: string;
  state: 'draft' | 'locked' | 'omitted';
  sortKey: string;
}
```

The exact storage shape may be integrated into the current `Scene` contract or
stored as a scene-number table, but the public contract must be deliberate and
Core-owned.

Scene numbers must be strings. Real production scene numbers may include
letters and insertion forms; treating them as integers would make standard
revision behavior impossible.

Core numbering behavior:

- Draft numbering may be generated from current screenplay order before the
  shooting-script numbering is locked.
- Locked production scene numbers must not change automatically when scenes are
  reordered.
- Existing locked numbers must remain stable because they are referenced by
  shot lists, takes, notes, skills, CLI commands, and future production reports.
- Deleted locked scenes should become `omitted` instead of freeing and reusing
  the number.
- Inserted scenes near locked numbers should receive an inserted scene number
  according to the configured production numbering standard.
- Explicit renumbering after lock must be a deliberate Core command with
  structured diagnostics and no silent cascading changes.

Initial numbering standard:

- Use a single documented default standard for this slice.
- Prefer the shooting-script/slating convention that keeps scene numbers stable
  and uses lettered inserted numbers instead of renumbering existing scenes.
- Do not support multiple regional numbering standards until Core has an
  explicit project-level setting and tests for each standard.

Industry references used for this direction:

- Shooting scripts assign production scene numbers, and revised scripts keep
  existing scene numbers stable by using inserted or omitted scene numbers
  instead of casually renumbering the whole script:
  <https://en.wikipedia.org/wiki/Shooting_script>
- Slating commonly addresses footage by scene/setup/take information, with the
  exact slate format varying by production convention:
  <https://en.wikipedia.org/wiki/Clapperboard>
- Script supervision and shot logging both depend on stable scene, slate/setup,
  and take references that survive through production and editorial:
  <https://en.wikipedia.org/wiki/Script_supervisor>
  <https://en.wikipedia.org/wiki/Shot_logging>

Shot numbers:

- Shot numbers are visible ordered references within one active/source Scene
  Shot List.
- Shot numbers must be displayed prominently on shot cards and take cards.
- CLI and skills must resolve shot numbers against a specific scene number and
  active/source shot list before mutating anything.
- Final takes must keep durable `shotIds` internally, even when the user-facing
  label is `Shots 1-3`.

Take numbers:

- Final video takes need a user-facing take number within the scene, or within
  the scene plus shot range if Core decides that is the clearer production
  contract.
- The take number must be returned by Core list/show APIs so Studio and skills
  do not invent it from array indexes.
- Picking/unpicking a final take must not change its take number.

Production reference resolution must fail fast:

- If a scene number is unknown, report a structured error.
- If a scene number is omitted, report a structured error.
- If a scene number is ambiguous, report all candidates and ask the caller to
  resolve the ambiguity.
- If shot numbers are out of range for the resolved shot list, report a
  structured error.
- If a shot range is non-contiguous where contiguity is required, report the
  existing structured non-contiguous-shot error.

## Grouping Logic Port

Restore the pure grouping algorithm from:

```text
packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.ts
packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.test.ts
```

Port it to take-generation terminology without changing the algorithm.

The local UI draft type should replace old persisted production group language
with take-generation language:

```ts
interface TakeScopedShotGroupDraft {
  draftGroupId: string;
  takeGenerationId?: string;
  sourceTakeGenerationId?: string;
  mergePartnerTakeGenerationId?: string;
  mergePartnerDraft?: TakeScopedShotGroupDraft;
  mergePivotShotId?: string;
  shotIds: string[];
}
```

The exact private name may be local, but it must not use `productionGroupId`.
The old `cycleShotRailGroupMembership` behavior should remain recognizable and
test-covered. Keeping "rail" in a private UI helper name is acceptable because
the rail is a visible UI concept; keeping old production-group ownership names
is not acceptable.

When a draft is applied:

- locate the draft associated with the open `takeGenerationId`;
- update the generation with that draft's ordered `shotIds`;
- do not persist other draft groups;
- if the open take's draft was split from a source draft, carry production
  settings from the original generation exactly as the old split behavior did;
- if a local merge draft has a partner, keep the open take generation's
  production settings as the winner, matching the old "upper group wins" rule
  when the open take is the upper durable group;
- if the draft clears a visible one-shot group, do not delete the generation or
  its production settings.

The implementation must not reduce this to "replace shot ids with a new array".
That is the current regression.

## Production Carry Semantics

Restore the deleted `carryProductionPlanForShotMembership` behavior under the
new `ShotVideoTakeGenerationProduction` owner.

The function should live near the take-generation data access or media
generation owner, for example:

```text
packages/core/src/server/media-generation/shot-video-take/take-generation-production.ts
```

It must preserve the old behavior:

- copy `inputModeId`;
- copy `modelChoice`;
- shallow-copy `parameterValues`;
- copy `customPromptNote`;
- filter `requestedInputs` so shot-subject inputs for removed shots are removed;
- keep `preparedInputs` only when membership did not change;
- drop `preparedInputs` when membership changed;
- copy `agentProposal`;
- clone `dependencyDrafts`;
- clone `finalPromptDraft`;
- when membership changed, set `agentProposal.basedOnShotIds` to the previous
  shot ids if the proposal did not already have `basedOnShotIds`.

`updateSceneShotVideoTakeGenerationShotMembershipRecord` must read the current
generation production before membership is replaced, run the carry helper, and
write both the new membership and the updated production in the same operation.

This is required for the old stale-prompt diagnostics to keep working. For
example, after changing a generation from shots 1-3 to shot 3, the final prompt
draft may still exist, but Core must be able to report that it was based on the
old shot membership.

## Restored Core Tests

Restore the coverage from:

```text
packages/core/src/server/media-generation/shot-video-take/production-groups.test.ts
```

Move or rename the file only if the new name reflects the current owner, such
as:

```text
packages/core/src/server/media-generation/shot-video-take/take-generation-shot-membership.test.ts
```

Preserve the original scenario matrix:

- one-shot grouping can be cleared without deleting single-shot production
  settings;
- split copies settings and marks copied prompts stale for new shot ids;
- merge keeps the winning group's settings;
- overlapping groups fail with a structured error;
- non-contiguous groups fail with a structured error.

Adapt the assertions to the new owner:

- inspect `SceneShotVideoTakeGeneration.production` instead of
  `videoTakeProductionGroups`;
- inspect `SceneShotVideoTakeGeneration.shotIds` instead of
  `videoTakeRailGroups`;
- call `updateSceneShotVideoTakeGenerationShots` instead of
  `updateShotVideoTakeRailGroups`;
- preserve the structured error expectations for duplicate and non-contiguous
  shot membership.

Do not rewrite these tests from memory. Start from the deleted file and make the
minimum owner/name changes needed for the new model.

## Restored Studio Grouping Tests

Restore the coverage from:

```text
packages/studio/src/features/movie-studio/scenes/shot-video-take-grouping.test.ts
```

The restored test file must continue to verify:

- projection entries;
- stale shot id filtering;
- all click-cycle edge cases;
- split and merge state;
- ordered, non-overlapping outputs;
- save projection;
- labels such as `Shot 3` and `Shot 3-4`.

Adapt only the contract names:

- use take-generation ids instead of production group ids;
- use source take-generation ids instead of source production group ids;
- use merge partner take-generation ids instead of merge partner production
  group ids.

The tests should remain pure unit tests. Do not replace them with broader React
tests.

## Scene Tab Contract

The scene panel must expose:

- `Narrative`
- `Shots`
- `Takes`

The `Shots` tab and `Takes` tab must stay separate:

- `Shots` is for reviewing the current scene shot list and storyboard images.
- `Takes` is for creating, editing, grouping, generating, previewing, and
  picking final shot-video takes.

The scene selection type should be updated directly:

```ts
export type ScenePanelTab = 'narrative' | 'shots' | 'takes';

export type SceneTakeWorkspaceMode = 'list' | 'new' | 'edit';

export type StudioSelection =
  | ...
  | {
      type: 'scene';
      id: string;
      sceneTab?: ScenePanelTab;
      shotId?: string;
      takeWorkspaceMode?: SceneTakeWorkspaceMode;
      takeId?: string;
      takeGenerationId?: string;
      shotTab?: SceneShotDetailTab;
    };
```

Do not use `shots` as a compatibility alias for old AI Production behavior.
The `shots` tab is an intentional review surface with a narrower product
contract.

Takes tab label behavior:

- list mode: `Takes`;
- edit mode: `Takes - Edit`;
- new mode: `Takes - New`.

The take edit/new state must persist as UI navigation state. Switching from
Takes to Narrative or Shots and back to Takes should return to the selected edit
or new workspace, not reset to the list.

The tab header must include a close button at the rightmost side only in
`Takes - Edit` or `Takes - New`. Closing returns to the Takes list for the same
scene.

Use local shadcn UI components for the close button. Do not use raw browser
interactive controls in feature code.

## Shots Review Tab

Add a `SceneShotsTab` that only reviews the active Scene Shot List.

It must not:

- create take generations;
- edit take-generation membership;
- show grouping controls;
- show AI Production;
- import or generate shot-video media.

The tab layout:

- left/main area: grid of storyboard shot cards;
- right pane: selected shot description/details;
- first shot selected by default;
- clicking another shot card updates the right pane;
- grid lays out horizontally first and wraps to new rows;
- desktop behavior only.

Shot card requirements:

- card image is the latest storyboard image for the shot;
- use the same image-card visual language as other Studio cards;
- bottom gradient overlay is part of the card, not a separate blank footer;
- first overlay row is the shot title, truncated;
- second overlay row is `Shot N`, truncated if needed;
- production scene number is visible in the surrounding scene header or tab
  context, so users can refer to `Scene 23, Shot 2`;
- do not show raw shot ids, asset ids, filenames, or generated role names.

The right pane should show meaningful shot review fields that already exist on
`SceneShot`, such as description, story beat, narrative purpose, subject,
action, dialogue, cast labels, and location labels. It should not expose editing
controls in this slice unless the existing shot-description editing contract is
explicitly preserved and covered by tests.

## Takes List Read Model

Add a scene-level final take list read model. The Takes grid should not have to
open every generation context just to render cards.

Add a public client contract similar to:

```ts
interface SceneShotVideoTakeCard {
  takeId: string;
  takeGenerationId: string;
  sceneId: string;
  productionSceneNumber: string;
  takeNumber: string;
  assetId: string;
  assetFileId: string;
  fileUrl: string;
  shotIds: string[];
  shotTitle: string;
  shotNumberLabel: string;
  selected: boolean;
  compatibility: SceneShotVideoTakeGenerationCompatibility;
  createdAt: string;
}
```

The UI copy should use the user-facing term "picked" where helpful, but the
contract may keep `selected` if that is the existing Core term. Do not rename the
database column just for UI wording.

The card read model must derive:

- production scene number from Core's scene-number contract;
- take number from Core's take-number contract;
- first row overlay text from the first shot title in the take's `shotIds`;
- second row overlay text from the shot number or contiguous shot number range;
- file URL from a Studio HTTP route for the final take video file;
- compatibility from the owning take generation.

If a referenced shot no longer exists, Core should still return a structured
card with the stored shot ids and the owning generation compatibility reasons.
The UI should not infer compatibility from partial client data.

Add or update service operations:

```ts
resolveProductionSceneReference
listSceneShotProductionReferences
listSceneShotVideoTakeCards
updateSceneShotVideoTakeSelection
```

Add Studio routes:

```text
GET /screenplay/scenes/:sceneId/takes
PATCH /screenplay/scenes/:sceneId/takes/:takeId/selection
GET /screenplay/scenes/:sceneId/takes/:takeId/files/:assetFileId
```

The selection mutation accepts:

```ts
{ selected: boolean }
```

When selecting a take, preserve the existing Core invariant that only one final
take can be selected for a generation. Do not make the UI responsible for
clearing sibling takes.

## Takes List UI

Replace the current minimal take-generation list with a `SceneTakesTab`.

List mode renders a responsive desktop grid:

- cards lay out horizontally first;
- as many cards as fit in the available width are shown in a row;
- additional cards wrap to new rows;
- the grid grows vertically;
- do not optimize or report mobile behavior.

Use the existing overlay-card visual language:

- reuse or extend `packages/studio/src/ui/image-overlay-card.tsx` for video
  cards if possible;
- reuse `ImageSelectionControl` for the lower-right pick/unpick control;
- use the same bottom gradient overlay pattern;
- keep card radius consistent with existing cards;
- do not add a separate blank footer row below the media;
- the video must be the main card content.

Each final take card shows:

- a video filling the card;
- center play/stop button;
- first overlay row: first shot title, truncated;
- second overlay row: shot number/range plus take number, for example
  `Shots 1-3 / Take 2`, truncated;
- lower-right pick/unpick control using the existing checkbox-style card
  control.

Interaction:

- clicking the center play/stop button toggles preview playback and does not
  open edit mode;
- clicking the pick/unpick control toggles selection and does not open edit
  mode;
- clicking anywhere else on the card opens `Takes - Edit` for that take;
- if a card is playing and another card starts, stop the previous one.

Sorting:

- when the list is first shown, selected takes sort before unselected takes;
- within each selected/unselected group, use the current product ordering from
  Core, preferably newest first unless an existing take ordering contract says
  otherwise;
- after the user picks or unpicks a card, do not resort the rendered list;
- update only that card's selected state in place.

The final card is always the create-new-take card:

- it has the same movie aspect ratio as take cards;
- it is the same size as the video cards;
- it uses a local shadcn `Button`;
- it opens `Takes - New`;
- if no takes exist, it is the only card.

The movie aspect ratio should come from the project identity. Do not silently
invent a different visual aspect ratio for this grid.

## Take Edit And New Workspace

Edit and new workspaces open inside the Takes tab, not in a Shots tab.

Shared editable workspace requirements:

- left pane shows all shots from the active/source shot list;
- left pane restores the old grouping affordance and grouped segment visuals;
- the user can add and remove shots from the current take group with the old
  cycle semantics;
- the right pane reuses the existing shot detail surface:
  - Description;
  - Composition;
  - Motion;
  - Dialogs;
  - References;
  - AI Production.
- AI Production is bound by `takeGenerationId`;
- autosave and plan refresh behavior stay take-generation scoped;
- grouping save notifications continue to participate in the scene save
  notification slot.

For `Takes - Edit`:

- open from a final take card;
- use the final take's `takeGenerationId`;
- the stage/video preview should show the final take video;
- the left rail and tabs are shown only if Core reports the generation as
  editable.

For `Takes - New`:

- clicking the create card creates a new take-generation workspace for the
  active scene shot list;
- because the take-generation contract requires at least one shot id, the
  generic create-card entry point seeds the generation with the first shot in
  the active shot list by shot-list order;
- the user can immediately change the selected membership with the restored
  grouping controls before running generation;
- if the active scene has no active shot list or no shots, show a clear notice
  and do not create a hidden fallback generation.

This explicit first-shot seed is the create-card contract, not a compatibility
fallback. Other future entry points may pass explicit shot ids, but this slice
does not need additional entry points.

## View-Only Workspace

If editing is not possible, the workspace is view-only.

Core remains the source of editability through:

```ts
takeGeneration.compatibility.editState
takeGeneration.compatibility.reasons
takeGeneration.compatibility.message
```

View-only UI:

- show the final take video preview;
- show a notice below it using Core-provided compatibility information;
- do not show the shot left pane;
- do not show Composition, Motion, Dialogs, References, or AI Production;
- do not expose any action that creates a new generation from this incompatible
  take;
- Description may be shown read-only if the current context can safely provide
  meaningful shot description data.

If selected shots are missing, Description should not invent replacement text or
guess old shot content.

## File And Component Direction

Prefer direct renames or replacements over wrapper components.

Expected Studio files:

- update `packages/studio/src/features/movie-studio/movie-studio-selection.ts`;
- update `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`;
- keep `scene-shots-tab.tsx` or rename it only if it remains the review-only
  Shots surface;
- add a take-owned surface such as `scene-takes-tab.tsx`;
- restore and adapt `shot-video-take-grouping.ts`;
- restore and adapt `shot-video-take-grouping.test.ts`;
- restore grouping support in `scene-shot-rail.tsx`;
- restore grouping support in `scene-shot-rail-row.tsx`;
- adapt `scene-shot-detail.tsx` so it can be used by an editable take
  workspace;
- add focused take-card components only where they own real UI, for example
  `scene-take-card.tsx` and `scene-take-create-card.tsx`.

Expected Core files:

- update `packages/core/src/client/shot-video-take-generation.ts`;
- update `packages/core/src/server/project-data-service-contracts.ts`;
- update `packages/core/src/server/database/access/scene-shot-video-take-generations.ts`;
- update `packages/core/src/server/database/access/shot-video-takes.ts`;
- add the production carry helper under the shot-video-take media-generation
  owner;
- restore the deleted core test coverage under take-generation names.

Expected Studio service/server files:

- update `packages/studio/src/services/studio-shot-video-takes-api.ts`;
- update `packages/studio/server/routes/screenplay.ts`;
- update request readers under `packages/studio/server/http/` only if the new
  route needs request validation;
- update fake project data service and route tests directly.

Do not add compatibility barrels, re-export stubs, route aliases, or temporary
wrapper modules.

## UI Copy Rules

Card overlay copy:

- first row is the first shot title;
- shot cards use `Shot N` for the second row;
- take cards use `Shots N-M / Take T` or `Shot N / Take T` for the second row;
- each row truncates if it does not fit;
- do not show raw ids, filenames, generated role names, or kebab-case values.

Buttons and controls:

- use icons where an icon exists;
- use tooltips for icon-only controls that are not obvious;
- use local shadcn `Button`, `LineTabs`, `Dialog`, and related UI primitives;
- do not use raw browser form or interactive controls in feature code.

## CLI And Skill Contract

The CLI and Renku skills must establish a working
`SceneShotVideoTakeGeneration` before drafting prompts, generating dependency
inputs, estimating, preflighting, creating final specs, running generation, or
importing a final video take.

The public CLI should use production references. Durable ids remain supported
where they are the explicit object being addressed, but user/agent workflows
should not require raw ids when a production reference is available.

Add or update CLI commands with these public names:

```bash
renku studio current --json

renku screenplay scene-number list --json
renku screenplay scene-number assign --scene <scene-id> --number <scene-number> --json
renku screenplay scene-number lock --json
renku screenplay scene-number omit --scene <scene-id> --json
renku screenplay scene-number resolve --scene-number <scene-number> --json

renku generation take create --purpose shot.video-take --scene-number <scene-number> --shots <shot-number-list-or-range> --json
renku generation take list --scene-number <scene-number> --json
renku generation take show --scene-number <scene-number> --take <take-number> --json
renku generation take show --take <take-id> --json
renku generation take show --take-generation <take-generation-id> --json
renku generation take update-shots --take-generation <take-generation-id> --shots <shot-number-list-or-range> --json
```

`renku studio current --json` is the agent focus contract. When Studio is open
and has a focused scene, shot, take, or take workspace, the command should return
both durable ids and production references, for example:

```json
{
  "sceneId": "scene_...",
  "productionSceneNumber": "23",
  "sceneTab": "takes",
  "takeWorkspaceMode": "edit",
  "shotId": "shot_...",
  "shotNumber": "2",
  "takeId": "scene_shot_video_take_...",
  "takeNumber": "3",
  "takeGenerationId": "scene_shot_video_take_generation_..."
}
```

If Studio is not open, has no project loaded, or has no focused production
context, the command must fail with a structured diagnostic rather than
inventing context from the last command.

For shot-video generation commands after the take generation is established,
`--take-generation` should be sufficient. Do not require repeated `--shots`
when Core can read the membership from the take generation:

```bash
renku generation context --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation model list --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation production update --purpose shot.video-take --take-generation <take-generation-id> --file <production.json> --json
renku generation preflight --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation input list --purpose shot.video-take --take-generation <take-generation-id> --json
renku generation input select --purpose shot.video-take --take-generation <take-generation-id> --input <input-id> --json
renku generation input clear --purpose shot.video-take --take-generation <take-generation-id> --kind <kind> --subject-kind <kind> --subject-id <id> --json
renku media import --purpose shot.video-take --take-generation <take-generation-id> --source <project-relative-video-path> --json
```

`--scene-number` resolves the production scene number. Existing `--scene` should
continue to mean durable `sceneId`; do not overload it with production numbers.

`--shots` in `generation take create` and `generation take update-shots` means
visible shot numbers/ranges, such as:

```text
1
1,2,3
1-3
1,3
```

Core resolves those visible references to durable `shotIds` before writing. If a
future command needs durable shot ids directly, add an explicit `--shot-ids`
flag rather than guessing from one flag.

Skill resolution order for shot-video work:

1. Explicit `takeGenerationId`.
2. Explicit `takeId`, resolved to its owning `takeGenerationId`.
3. Explicit production scene/shot/take reference, such as `Scene 23, shots 1-3`
   or `Scene 23, Take 2`.
4. Studio focus from `renku studio current --json`, confirmed with the user
   before mutating project state or preparing paid generation.
5. Ask for clarification.

Focus is a candidate, not the only addressing mechanism.

Examples:

- User says: "For scene 23, take shots 1, 2, and 3."
  - Resolve `Scene 23`.
  - Resolve shots `1,2,3`.
  - Create or select the take generation.
  - Continue using `takeGenerationId`.
- User says: "Use this take and make it more handheld."
  - Read Studio focus.
  - If focus is `Scene 23, Take 3`, respond:
    "I see you are currently on Scene 23, Take 3. Should I use that take?"
  - Continue only after confirmation for mutating or paid work.
- User says: "Use take 3."
  - If Studio focus is in Scene 23, resolve `Scene 23, Take 3` and confirm.
  - If no scene focus exists, ask which scene number.
- User says: "Use take generation scene_shot_video_take_generation_x."
  - Treat it as an explicit durable id and verify context.

Update the source skill tree, not just the installed plugin cache:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Likely skill files to update:

- `media-producer/SKILL.md`
- `media-producer/references/shot-video-take.md`
- `media-producer/references/shot-multi-shot-storyboard-sheet.md`
- `media-producer/references/shot-first-last-frame.md`
- `media-producer/references/shot-reference-images.md`
- `movie-director/references/workflow-playbooks.md`
- `movie-director/references/department-map.md`
- any samples that still use old `--shot-list`, `--shots <shot-id>`, or
  production-group wording for shot-video take workflows.

The media-producer skill must state that shot-video work starts by establishing
the working take generation. Prompt drafting, dependency generation, final spec
creation, and final video import all use that take generation.

## Implementation Slices

### Slice 1: Core Production References

- Add Core-owned production scene number contracts.
- Add production scene number assignment, lock, omit, and resolve operations.
- Add structured diagnostics for unknown, omitted, and ambiguous scene numbers.
- Add shot-number resolution against an explicit scene number and shot list.
- Add take-number projection for final shot-video takes.
- Add CLI commands for scene-number list/assign/lock/omit/resolve.
- Add tests for locked scene numbers staying stable after scene reorder.
- Add tests for omitted scene numbers not being reused.
- Add tests for inserted scene numbering under the chosen standard.

### Slice 2: Restore Tests Before Behavior

- Restore the deleted Studio pure grouping test file from git.
- Adapt names from production-group ownership to take-generation ownership.
- Restore the deleted Core production group test file from git.
- Adapt assertions to `SceneShotVideoTakeGeneration`.
- Run the restored tests and confirm they fail for the current regression before
  implementation work proceeds.

### Slice 3: Restore Core Membership Carry

- Add a take-generation-owned production carry helper.
- Update membership writes to carry production settings.
- Preserve stale prompt diagnostics.
- Preserve structured errors for duplicate and non-contiguous shot ids.
- Add focused tests for `updateSceneShotVideoTakeGenerationShots`.

### Slice 4: Restore Studio Grouping UI

- Restore the pure cycle algorithm.
- Restore left rail grouped segment rendering.
- Restore the cycle group icon control.
- Restore review/apply/discard grouping flow.
- Persist only the open take generation's selected shot membership.
- Keep sibling draft groups local.
- Wire grouping save notifications into the scene save notification.

### Slice 5: Add Scene-Level Take Cards

- Add Core list read model for final take cards.
- Add final take file route.
- Add final take selected/unselected mutation.
- Add Studio service functions.
- Add route tests and service tests.

### Slice 6: Add Shots Review Tab And Takes Navigation

- Update selection contracts to support `narrative`, `shots`, and `takes`.
- Update `ScenePanel` tab labels and routing.
- Add the production scene number to the visible scene header.
- Add the review-only Shots tab grid and selected-shot detail pane.
- Remove old AI Production and take-generation entry points from the Shots tab.
- Add `Takes - Edit` and `Takes - New` label behavior.
- Add the close button in the scene tab header.
- Preserve take edit/new state when switching between Narrative, Shots, and
  Takes.

### Slice 7: Build List, Edit, New, And View-Only UI

- Build the take card grid.
- Build video preview play/stop behavior.
- Build pick/unpick behavior without post-toggle resorting.
- Build the create-new-take card.
- Build editable take workspace.
- Build view-only take workspace.
- Ensure every feature control uses local shadcn primitives.

### Slice 8: CLI, Skills, Verification, And Cleanup

- Add or update `renku studio current --json`.
- Add or update production scene-number CLI commands.
- Add or update `generation take create/list/show/update-shots`.
- Update shot-video generation commands so `--take-generation` is sufficient
  after the working take generation is established.
- Update source skills under
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills`.
- Add skill guidance for explicit production scene/shot/take references.
- Add skill guidance that Studio focus is a candidate that must be confirmed
  before mutation or paid generation.
- Add skill examples for `Scene 23, shots 1-3`, `Scene 23, Take 3`, and
  "this take".
- Run focused Core tests.
- Run focused Studio unit tests.
- Run focused Studio route/service tests.
- Run desktop browser verification only.
- Run package checks required by the touched packages.
- Search for obsolete AI Production behavior under the Shots tab.
- Search for obsolete `ShotVideoTakeRailGroup`,
  `ShotVideoTakeProductionGroup`, `productionGroupId`, old `--shot-list`,
  `--shots <shot-id>`, and production-group skill wording and remove invalid
  remnants.

## Validation Strategy

Focused Core tests:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/shot-video-take/take-generation-shot-membership.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/media-generation/shot-video-take --no-file-parallelism
pnpm --dir packages/core exec vitest run src/server/database --no-file-parallelism
```

Focused Studio tests:

```bash
pnpm --dir packages/studio exec vitest run src/features/movie-studio/scenes/shot-video-take-grouping.test.ts --no-file-parallelism
pnpm --dir packages/studio exec vitest run src/features/movie-studio/scenes --no-file-parallelism
pnpm --dir packages/studio exec vitest run src/services/studio-shot-video-takes-api.test.ts --no-file-parallelism
pnpm --dir packages/studio exec vitest run server/routes/screenplay-video-take-production.test.ts --no-file-parallelism
```

Final package checks:

```bash
pnpm build:core
pnpm --filter @gorenku/studio test
pnpm check
```

Desktop browser verification:

- Start Studio through the normal dev command if needed.
- Use a desktop viewport only.
- Verify the scene header has `Narrative`, `Shots`, and `Takes`.
- Verify the scene header prominently shows the production scene number.
- Verify the Shots tab shows the storyboard shot grid and selected-shot detail
  pane.
- Verify the Shots tab starts with the first shot selected.
- Verify clicking another shot card updates the right pane.
- Verify the Shots tab does not show grouping controls or AI Production.
- Verify the Takes list grid wraps horizontally first and then vertically.
- Verify video card play/stop does not open edit mode.
- Verify card background click opens `Takes - Edit`.
- Verify create card opens `Takes - New`.
- Verify switching to Narrative or Shots and back preserves edit/new workspace
  state.
- Verify close returns to the Takes list.
- Verify picked cards sort first only on initial list load.
- Verify pick/unpick does not move the card in the current rendered list.
- Verify editable takes show the shot rail and design tabs.
- Verify view-only takes show only video preview, notice, and optional
  read-only Description.

## Review Guidance

Reject an implementation if it:

- leaves the deleted grouping test coverage absent;
- replaces the old grouping cycle semantics with new logic;
- restores `videoTakeRailGroups` or `videoTakeProductionGroups` to Scene Shot
  List JSON;
- uses `productionGroupId` as a new compatibility bridge;
- lets the Shots tab create or edit take generations;
- shows grouping controls or AI Production in the Shots review tab;
- omits visible production scene numbers or shot/take numbers from the relevant
  Studio surfaces;
- exposes `act:sequence:scene` as the public take-generation addressing model;
- makes Studio focus the only way for agents to address takes;
- lists take generations instead of final video takes in the Takes card grid;
- creates a separate blank footer row under take cards;
- makes React infer editability instead of using Core compatibility state;
- resorts the grid immediately after a user picks or unpicks a take;
- exposes generation controls for view-only takes;
- uses raw browser interactive controls in feature code;
- adds route aliases, CLI aliases, compatibility wrappers, or re-export stubs.

Accept an implementation only if it:

- restores the old grouping unit tests before adding new tests;
- ports production carry semantics to `SceneShotVideoTakeGeneration`;
- persists only the open take generation's selected shot membership;
- keeps split sibling groups local unless the user explicitly creates another
  take in a future flow;
- keeps the Shots tab as a review-only shot-list surface;
- makes production scene numbering a Core-owned contract;
- supports explicit production scene/shot/take references in CLI and skills;
- uses Studio focus only as a candidate that agents confirm before mutation or
  paid generation;
- updates the source skills under
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills`;
- uses the existing overlay-card and selection-control visual language;
- implements `Takes`, `Takes - Edit`, and `Takes - New` as persistent UI state;
- keeps final take shot membership independent from the editable generation's
  current membership;
- verifies the desktop UI.

## Completion Checklist

### Review Area

- [ ] Confirm this plan supersedes the 0072 guidance that allowed grouping UI
      to disappear.
- [ ] Confirm the take-scoped ownership model from 0072 remains in force.
- [ ] Confirm no global Scene Shot List grouping fields are restored.
- [ ] Confirm the deleted grouping tests are the source material for restored
      behavior.
- [ ] Confirm no compatibility aliases, route shims, or re-export stubs are
      introduced.
- [ ] Confirm all UI controls use local shadcn primitives.
- [ ] Confirm no mobile viewport work is included.
- [ ] Confirm production scene numbering is a Core-owned contract, not a UI,
      CLI, or skill convention.
- [ ] Confirm public addressing uses scene, shot, and take terms instead of
      `act:sequence:scene`.
- [ ] Confirm Studio focus is available to agents but is only a candidate when
      the user did not provide an explicit production reference.
- [ ] Confirm source skills under
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills` are included in
      the implementation scope.

### Core Production Scene Numbering

- [ ] Add Core-owned production scene number data.
- [ ] Treat production scene numbers as strings.
- [ ] Add scene-number list operation.
- [ ] Add scene-number assign operation.
- [ ] Add scene-number lock operation.
- [ ] Add scene-number omit operation.
- [ ] Add scene-number resolve operation.
- [ ] Preserve locked scene numbers when screenplay order changes.
- [ ] Mark deleted locked scene numbers as omitted rather than reusable.
- [ ] Assign inserted scene numbers according to the chosen default production
      numbering standard.
- [ ] Add structured diagnostics for unknown scene numbers.
- [ ] Add structured diagnostics for omitted scene numbers.
- [ ] Add structured diagnostics for ambiguous scene numbers.
- [ ] Add structured diagnostics for explicit renumbering conflicts.
- [ ] Return production scene number data to Studio read models that need to
      display or resolve scene references.
- [ ] Add focused tests for reorder stability.
- [ ] Add focused tests for omitted number behavior.
- [ ] Add focused tests for inserted scene numbering.
- [ ] Add focused tests for scene-number resolution diagnostics.

### Core Shot And Take References

- [ ] Resolve visible shot numbers against an explicit production scene number
      and active/source Scene Shot List.
- [ ] Resolve shot number lists such as `1,2,3`.
- [ ] Resolve shot number ranges such as `1-3`.
- [ ] Preserve durable `shotIds` internally after resolving visible shot
      references.
- [ ] Return structured diagnostics for out-of-range shot numbers.
- [ ] Return structured diagnostics for non-contiguous shot ranges where
      contiguity is required.
- [ ] Add take-number projection for final shot-video takes.
- [ ] Ensure picking/unpicking a take does not change its take number.
- [ ] Return take number data to Studio take card and CLI show/list commands.

### Restored Test Coverage

- [ ] Restore `shot-video-take-grouping.test.ts` from git.
- [ ] Adapt Studio grouping tests to take-generation draft names.
- [ ] Preserve every old Studio grouping test scenario.
- [ ] Restore `production-groups.test.ts` from git.
- [ ] Rename the Core test file only if the new name reflects take-generation
      ownership.
- [ ] Adapt Core tests to `SceneShotVideoTakeGeneration`.
- [ ] Preserve every old Core grouping and production-carry scenario.
- [ ] Run the restored tests before behavior changes and record the expected
      failures.

### Core Grouping And Production Carry

- [ ] Add take-generation-owned production carry helper.
- [ ] Preserve input mode while carrying production.
- [ ] Preserve model choice while carrying production.
- [ ] Preserve parameter values while carrying production.
- [ ] Preserve custom prompt note while carrying production.
- [ ] Filter requested shot inputs for removed shots.
- [ ] Keep prepared inputs only when membership is unchanged.
- [ ] Drop prepared inputs when membership changes.
- [ ] Clone agent proposal data.
- [ ] Preserve or set stale `basedOnShotIds` on membership change.
- [ ] Update generation membership and carried production in one operation.
- [ ] Preserve structured duplicate-shot errors.
- [ ] Preserve structured non-contiguous-shot errors.
- [ ] Preserve compatibility snapshot updates after membership changes.

### Scene-Level Take Card Contracts

- [ ] Add `SceneShotVideoTakeCard` or equivalent public client contract.
- [ ] Include final take id.
- [ ] Include take generation id.
- [ ] Include production scene number.
- [ ] Include take number.
- [ ] Include file URL.
- [ ] Include shot ids captured by the final take.
- [ ] Include first shot title.
- [ ] Include shot number or shot number range label.
- [ ] Include selected/picked state.
- [ ] Include take-generation compatibility.
- [ ] Add Core service operation to list final take cards for a scene.
- [ ] Add Core service operation to update final take selected state.
- [ ] Preserve one selected final take per take generation.
- [ ] Add Studio route for final take list.
- [ ] Add Studio route for final take file response.
- [ ] Add Studio route for final take selection update.
- [ ] Add Studio service functions for the new routes.

### Scene Navigation And Tabs

- [ ] Change `ScenePanelTab` to `narrative | shots | takes`.
- [ ] Keep `shots` as the review-only shot-list tab.
- [ ] Ensure `shots` is not used as a compatibility alias for old AI Production
      behavior.
- [ ] Add take workspace mode to scene selection.
- [ ] Preserve shot id and shot detail tab state for editable take workspaces.
- [ ] Update route parsing/serialization callers directly.
- [ ] Update `ScenePanel` tab items to `Narrative`, `Shots`, and `Takes`.
- [ ] Show the production scene number prominently in the scene header.
- [ ] Show `Takes` in list mode.
- [ ] Show `Takes - Edit` in edit mode.
- [ ] Show `Takes - New` in new mode.
- [ ] Add rightmost close button for edit/new mode.
- [ ] Make close return to the Takes list.
- [ ] Preserve edit/new state when switching to Narrative or Shots and back.

### Shots Review Tab

- [ ] Render a storyboard shot grid for the active/source Scene Shot List.
- [ ] Lay out shot cards horizontally first and wrap to new rows.
- [ ] Select the first shot by default.
- [ ] Update the right details pane when a shot card is clicked.
- [ ] Render the latest storyboard image as the main card content.
- [ ] Use the same overlay-card visual language as other Studio cards.
- [ ] Render a bottom gradient overlay on each shot card.
- [ ] Render shot title in overlay row one.
- [ ] Render `Shot N` in overlay row two.
- [ ] Truncate both overlay rows.
- [ ] Do not show raw shot ids, asset ids, filenames, or generated role names.
- [ ] Show meaningful shot details in the right pane.
- [ ] Do not expose take-generation creation from the Shots tab.
- [ ] Do not expose grouping controls from the Shots tab.
- [ ] Do not expose AI Production from the Shots tab.
- [ ] Do not expose import or generation controls from the Shots tab.

### Takes List UI

- [ ] Build scene take card grid.
- [ ] Use movie aspect ratio for cards.
- [ ] Render as many cards as fit per row before wrapping.
- [ ] Make the grid grow vertically.
- [ ] Render final take video as the main card content.
- [ ] Add center play/stop button.
- [ ] Stop event propagation from play/stop.
- [ ] Stop the previous playing card when another card starts.
- [ ] Render bottom gradient overlay on each card.
- [ ] Render first shot title in overlay row one.
- [ ] Render shot number/range and take number in overlay row two, such as
      `Shots 1-3 / Take 2`.
- [ ] Truncate both overlay rows.
- [ ] Use `ImageSelectionControl` for lower-right pick/unpick.
- [ ] Stop event propagation from pick/unpick.
- [ ] Sort selected cards first on initial list load.
- [ ] Do not resort after a user toggles pick/unpick.
- [ ] Add same-size create-new-take card as the final grid card.
- [ ] Make the create card open `Takes - New`.
- [ ] Show only the create card when there are no takes.

### Editable Take Workspace

- [ ] Build or rename the take-owned edit surface.
- [ ] Load all shots for the active/source shot list.
- [ ] Show all shots in the left pane.
- [ ] Restore grouped segment backgrounds in the left rail.
- [ ] Restore grouping cycle icon in each shot row.
- [ ] Restore grouping draft state.
- [ ] Restore grouping review dialog.
- [ ] Restore apply/discard/cancel behavior.
- [ ] Persist only the open take generation's group.
- [ ] Keep split sibling groups local.
- [ ] Wire grouping save notifications.
- [ ] Reuse the current Description tab.
- [ ] Reuse the current Composition tab.
- [ ] Reuse the current Motion tab.
- [ ] Reuse the current Dialogs tab.
- [ ] Reuse the current References tab.
- [ ] Reuse the current AI Production tab.
- [ ] Bind AI Production by `takeGenerationId`.
- [ ] Show the final take video in edit mode.

### New Take Workspace

- [ ] Make the create card open `Takes - New`.
- [ ] Create a take-generation workspace from the active shot list.
- [ ] Seed the generic create-card workspace with the first shot in shot-list
      order.
- [ ] Show a clear notice instead of creating a hidden fallback when no active
      shot list or shots exist.
- [ ] Allow grouping controls to change the seeded membership immediately.
- [ ] Keep the tab label as `Takes - New` until the user closes or navigates.

### View-Only Workspace

- [ ] Use Core compatibility state to decide view-only mode.
- [ ] Show final take video preview.
- [ ] Show compatibility notice below the preview.
- [ ] Hide the shot left pane.
- [ ] Hide Composition.
- [ ] Hide Motion.
- [ ] Hide Dialogs.
- [ ] Hide References.
- [ ] Hide AI Production.
- [ ] Do not show new-generation actions.
- [ ] Show read-only Description only when meaningful current shot description
      data is available.
- [ ] Do not invent text for missing shots.

### CLI And Agent Skill Surface

- [ ] Add or update `renku studio current --json`.
- [ ] Return durable ids and production references from the Studio focus
      command.
- [ ] Return a structured diagnostic when Studio focus is unavailable.
- [ ] Add or update `renku screenplay scene-number list --json`.
- [ ] Add or update scene-number assignment by durable scene id and production
      scene number.
- [ ] Add or update `renku screenplay scene-number lock --json`.
- [ ] Add or update scene-number omit by durable scene id.
- [ ] Add or update scene-number resolution by production scene number.
- [ ] Add or update take creation by production scene number and visible shot
      number list or range.
- [ ] Add or update take listing by production scene number.
- [ ] Add or update take lookup by production scene number and take number.
- [ ] Add or update `renku generation take show --take <take-id> --json`.
- [ ] Add or update take lookup by take-generation id.
- [ ] Add or update take shot-membership updates by take-generation id and
      visible shot number list or range.
- [ ] Ensure generation context/model/production/preflight/input/import commands
      use `--take-generation` without requiring repeated `--shots`.
- [ ] Ensure `--scene-number` resolves production scene numbers.
- [ ] Ensure existing `--scene` continues to mean durable `sceneId`.
- [ ] Ensure `--shots` on take create/update-shots means visible shot numbers
      and ranges.
- [ ] Add an explicit `--shot-ids` flag only if durable shot ids need to be
      accepted directly.
- [ ] Update source skill `media-producer/SKILL.md`.
- [ ] Update source skill `media-producer/references/shot-video-take.md`.
- [ ] Update source skill
      `media-producer/references/shot-multi-shot-storyboard-sheet.md`.
- [ ] Update source skill
      `media-producer/references/shot-first-last-frame.md`.
- [ ] Update source skill
      `media-producer/references/shot-reference-images.md`.
- [ ] Update source skill
      `movie-director/references/workflow-playbooks.md`.
- [ ] Update source skill `movie-director/references/department-map.md`.
- [ ] Search source skills for old `--shot-list`, `--shots <shot-id>`, and
      production-group wording.
- [ ] Document that shot-video work starts by establishing the working
      `SceneShotVideoTakeGeneration`.
- [ ] Document explicit reference handling for commands like Scene 23, shots
      1-3.
- [ ] Document explicit take handling for commands like `Scene 23, Take 3`.
- [ ] Document focus handling for commands like "use this take".
- [ ] Document that focus-derived context must be confirmed before mutating
      project state or preparing paid generation.
- [ ] Add skill examples that continue with `takeGenerationId` after
      resolution.
- [ ] Add CLI tests for production scene/shot/take reference resolution.
- [ ] Add CLI tests proving `--take-generation` is sufficient after
      establishment.

### Cleanup And Verification

- [ ] Search for old AI Production behavior under the Shots tab and remove it.
- [ ] Search for stale code that treats `shots` as the take-generation tab and
      update it directly.
- [ ] Search for `ShotVideoTakeRailGroup` and remove invalid references.
- [ ] Search for `ShotVideoTakeProductionGroup` and remove invalid references.
- [ ] Search for `productionGroupId` and verify any remaining reference is
      unrelated to shot-video take ownership.
- [ ] Search for old `--shot-list` skill and CLI examples.
- [ ] Search for old `--shots <shot-id>` skill and CLI examples.
- [ ] Search for public `act:sequence:scene` addressing examples and remove
      them from this take-generation workflow.
- [ ] Run focused Core grouping tests.
- [ ] Run focused Core production scene numbering tests.
- [ ] Run focused Studio grouping tests.
- [ ] Run focused Studio scene tests.
- [ ] Run focused Studio service tests.
- [ ] Run focused Studio route tests.
- [ ] Run focused CLI reference-resolution tests.
- [ ] Run `pnpm build:core`.
- [ ] Run `pnpm --filter @gorenku/studio test`.
- [ ] Run `pnpm check`.
- [ ] Run desktop browser verification for the Shots review tab, Takes list,
      edit workspace, new workspace, view-only workspace, and grouping controls.
