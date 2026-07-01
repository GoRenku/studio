# 0096 Dialogue Audio Authoring And Shot Selection

Status: proposed
Date: 2026-07-01

## Summary

Scene dialogue audio currently has two different "pick" concepts:

- a scene-level dialogue audio pick used by the Narrative audio authoring
  surface;
- a shot-video take dialogue audio selection used by the Dialogs tab and final
  shot-video generation.

That is technically explainable but product-confusing. The UI can say a
narrator take is `PICKED` in Narrative, then show `No selected take` for the
same narrator in the Dialogs tab. The user sees a contradiction because the app
uses the same product word for two different ownership layers.

This plan removes scene-level dialogue audio picking entirely.

The new product rule:

- Narrative is for authoring dialogue audio takes.
- Dialogs is for selecting which generated take a shot-video take uses.
- There is no scene-level default, picked, preferred, promoted, or active
  dialogue audio take.
- Shot-video generation resolves only the take-owned
  `selectedDialogueAudioTakeIds` state.

Narrative should let the user create, preview, inspect, and delete multiple
audio takes. It should not ask the user to pick one. The only visible `Pick`
action for scene dialogue audio appears in the shot-video Dialogs tab.

## Product Behavior

### Narrative Tab

Narrative is an audio authoring surface.

It must support:

- selecting a screenplay dialogue block;
- editing dialogue audio generation setup;
- estimating and generating audio takes;
- previewing generated takes;
- deleting unwanted takes;
- viewing take metadata such as take label, timestamp, model, and duration.

It must not show:

- `Pick` buttons for scene dialogue audio takes;
- `Picked` badges for scene dialogue audio takes;
- a scene-level selected/default/current take;
- inline screenplay-card playback that depends on a hidden scene-level pick.

Recommended Narrative preview behavior:

- preview audio from the right-side dialogue audio panel;
- if the screenplay card has an audio affordance, it should open/focus the
  dialogue audio panel rather than play a hidden default take.

This avoids reintroducing a silent "latest take" or "first take" fallback.

### Shot-Video Dialogs Tab

Dialogs is a shot-video production selection surface.

For each screenplay dialogue block, the Dialogs tab shows the dialogue audio
state for the current shot-video take direction:

- zero generated takes: show `Not generated`; no enabled pick action;
- one generated take and no selected take: show a direct `Pick` button;
- one generated take and selected: show the selected take label and playback;
- multiple generated takes and no selected take: show `Pick`; clicking opens a
  take picker dialog;
- multiple generated takes and selected: show the selected take label and allow
  changing it through the picker dialog.

The direct one-take `Pick` button must call the existing take-owned dialogue
audio selection mutation. It must not call any scene-level pick mutation.

The multiple-take picker dialog must:

- list all generated takes for that screenplay dialogue;
- provide playback controls for each take;
- show which take is currently selected for this shot-video take direction;
- let the user select exactly one take;
- close or refresh clearly after a successful selection.

The picker dialog must not:

- delete takes unless deletion is deliberately kept as a separate authored
  action for this surface;
- mutate scene dialogue audio authoring state;
- show Narrative-specific pick wording.

### Multi-Cut And Continuous Takes

Dialogue audio selection follows the same take direction ownership as other
shot-video references.

Rules:

- in `continuous` mode, selection writes to the shared take direction;
- in `multi-cut` mode, selection writes to the selected shot direction when the
  UI is scoped to a shot;
- generation aggregates selected dialogue audio from the generation direction
  set;
- unsupported route warnings and max-count warnings stay advisory until final
  spec creation, and they do not rewrite user selections.

## Architecture Decision

### Remove Scene-Level Dialogue Audio Pick State

`scene_dialogue_audio.picked_take_id` is obsolete under this product model.

The current scene-level pick state should be removed from:

- the Drizzle schema;
- generated SQL migrations using Drizzle Kit;
- core client contracts;
- database access helpers;
- scene dialogue audio services;
- Studio server routes;
- Studio API clients;
- CLI commands;
- tests;
- documentation.

Because Renku Studio is pre-customer software, do not preserve backwards
compatibility for the scene-level pick shape. Do not add aliases, shims,
fallback reads, or "if pickedTakeId exists" compatibility paths.

Existing generated audio takes remain valid. Only the obsolete scene-level
chosen-take relationship is removed.

### Keep Shot-Video Dialogue Audio Selection In Take State

The selected audio for shot-video generation is owned by
`SceneShotVideoTakeReferenceSelections.selectedDialogueAudioTakeIds`.

This remains the durable state for:

- Dialogs tab selection;
- shot-video production plans;
- preflight;
- final spec creation;
- provider payload construction;
- route capability validation;
- runnability diagnostics.

Core must continue to validate that a selected dialogue audio take:

- belongs to the requested screenplay dialogue;
- belongs to the current scene;
- has a resolvable asset file;
- is not discarded.

### Rename Shot-Video Reference Report Fields

The current shot-video dialogue reference projection uses names such as
`pickedTake` for the take selected by shot-video production. That name keeps the
old confusion alive.

Rename shot-video dialogue audio reference report fields directly:

- `pickedTake` -> `selectedTake`;
- `pickedTakeLabel` -> `selectedTakeLabel`;
- missing-file copy should say `Selected audio take file is missing`;
- diagnostics should use `selected` wording consistently.

Do not keep compatibility DTO properties with the old names. Update Studio,
tests, CLI consumers, and documentation directly.

UI copy may still use the button label `Pick` in the Dialogs tab, because that
is a visible action in the user workflow. Public and internal contracts should
use `selected` for the durable state.

## Current Code Areas

### Core Client Contracts

Likely affected files:

- `packages/core/src/client/scene-audio-generation.ts`
- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/server/project-data-service-contracts.ts`

Expected changes:

- remove `SceneDialogueAudio.pickedTakeId`;
- remove `SceneDialogueAudioTake.picked`;
- remove scene dialogue audio pick input/report contracts;
- rename shot-video reference report `pickedTake` fields to `selectedTake`.

### Core Database And Services

Likely affected files:

- `packages/core/src/server/schema/scene-dialogue-audio.ts`
- `packages/core/src/server/database/access/scene-dialogue-audio.ts`
- `packages/core/src/server/media-generation/scene-dialogue-audio.ts`
- `packages/core/src/server/media-generation/scene-dialogue-audio.test.ts`
- `packages/core/src/server/project-data-service-wiring/scene-dialogue-audio.ts`
- `packages/core/src/server/trash/trash-object-registry.ts`

Expected changes:

- delete `pickedTakeId` from the schema;
- generate a Drizzle migration that drops `scene_dialogue_audio.picked_take_id`;
- remove `pickSceneDialogueAudioTakeRecord`;
- stop marking generated takes as picked;
- stop promoting replacement takes after deletion;
- simplify trash snapshots so scene dialogue audio takes are restored as takes,
  not as scene-level picked choices;
- keep deletion behavior focused on removing or restoring takes and their
  associated assets.

### Shot-Video Dialogue Selection

Likely affected files:

- `packages/core/src/server/media-generation/shot-video-take/dialogue-audio-references.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-sections.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-sections.test.ts`
- `packages/core/src/server/media-generation/shot-video-take/preflight-inputs.ts`
- `packages/core/src/server/media-generation/shot-video-take/final-specs.ts`
- `packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`
- `packages/core/src/server/media-generation/shot-video-take/authoring.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection-mutations.ts`

Expected changes:

- resolve selection only through take-owned
  `selectedDialogueAudioTakeIds`;
- never fall back to scene-level pick state;
- keep structured diagnostics for missing selected takes and missing files;
- update naming and copy from picked to selected where the state is shot-video
  production state.

### Studio Server And API Client

Likely affected files:

- `packages/studio/server/routes/screenplay.ts`
- `packages/studio/server/http/scene-dialogue-audio-request.ts`
- `packages/studio/src/services/studio-scene-dialogue-audio-api.ts`
- `packages/studio/src/services/studio-shot-video-takes-api.ts`
- related tests under `packages/studio/server` and
  `packages/studio/src/services`.

Expected changes:

- delete
  `POST /screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId/pick`;
- delete `pickSceneDialogueAudioTake` from the Studio API client;
- keep
  `PATCH /screenplay/scenes/:sceneId/takes/:takeId/reference-selections/dialogue-audio`;
- ensure Dialogs tab uses only the take-owned route for audio selection.

### Studio Feature UI

Likely affected files:

- `packages/studio/src/features/movie-studio/scenes/use-scene-dialogue-audio.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-panel.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-takes-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-card.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-dialogs-tab.tsx`
- corresponding tests in the same folder.

Expected Narrative changes:

- remove `pickTake` behavior from `useSceneDialogueAudio`;
- remove `onPickTake` from `SceneDialogueAudioPanel`;
- remove Pick buttons and Picked badges from `SceneDialogueAudioTakesTab`;
- make playback work from explicit take rows, not from a scene-level picked
  take;
- remove or redesign screenplay-card inline playback so it does not depend on
  scene-level pick state.

Expected Dialogs changes:

- direct one-take `Pick` button selects the take immediately;
- multiple-take `Pick` opens the picker dialog;
- picker rows show selected state based on shot-video selection, not scene
  dialogue audio state;
- compact cards do not become a modal trigger unless multiple choices exist;
- no raw HTML controls are introduced. Use local shadcn-style controls from
  `packages/studio/src/ui`.

### CLI

Likely affected files:

- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/cli/src/commands/generation-command.test.ts`
- `packages/cli/src/commands/command-architecture.test.ts`
- `packages/cli/src/cli.test.ts`

Expected changes:

- remove `renku generation dialogue-audio pick`;
- keep dialogue audio plan/generate commands for authoring;
- keep shot-video take reference-selection commands if they exist or add only
  take-owned selection commands if the current CLI surface requires one;
- update CLI help and tests directly without aliases.

## Implementation Slices

### Slice 1: Lock The Product Contract

Update this plan if review changes any of these decisions before coding:

- Narrative has no scene-level dialogue audio pick.
- Dialogs is the only place where scene dialogue audio takes are selected for
  shot-video generation.
- One generated take uses a direct Pick button.
- Multiple generated takes use a picker dialog.
- No hidden default, latest-take fallback, first-take fallback, or scene-level
  promotion exists.

### Slice 2: Remove Core Scene-Level Pick Contract

Remove the scene dialogue audio pick contract from core client types, service
contracts, and database access.

Important rule: remove callers directly. Do not keep compatibility wrappers or
deprecated service methods.

### Slice 3: Generate Database Migration

Follow `docs/architecture/drizzle-migrations.md`.

The Drizzle TypeScript schema is the source of truth. Remove
`pickedTakeId` from `sceneDialogueAudio`, then generate the SQL migration with
Drizzle Kit.

Do not hand-write a TypeScript migration registry or copy generated SQL into
TypeScript files.

### Slice 4: Repair Scene Dialogue Audio Generation And Deletion

Generation should create a new take and return the updated context without
marking anything picked.

Deletion should remove the requested take and return the updated context
without promoting another take.

Trash restore should not restore scene-level picked state. It should restore
the take according to the recoverable discard architecture and leave shot-video
take selections to validate themselves through existing selected-take
diagnostics.

### Slice 5: Rename Shot-Video Dialogue Reference Projection

Rename shot-video report fields from picked to selected.

Update every caller in the same slice:

- core tests;
- Studio services;
- Dialogs tab;
- preflight/final-spec/provider logic;
- docs.

No compatibility fields.

### Slice 6: Rebuild Narrative Audio UI

Remove scene-level pick actions and badges from Narrative.

The Narrative audio panel becomes:

- Dialog;
- Takes;
- Advanced.

The Takes panel provides preview and delete only. If deleting from Narrative is
too destructive for this slice, keep the current delete behavior but ensure it
does not promote a replacement pick.

### Slice 7: Rebuild Dialogs Picker UI

Implement the final Dialogs behavior:

- zero takes: no enabled Pick;
- one take: direct Pick;
- multiple takes: Pick opens picker dialog;
- current selection is shown as selected;
- preview works before selecting;
- selection persists through the take-owned mutation;
- after selection, the plan and dialogue audio context refresh.

This replaces the temporary bridge behavior where the compact card itself can
open a modal for a single unselected take.

### Slice 8: Remove Scene-Level Pick Routes And CLI

Remove:

- Studio route for scene dialogue audio take pick;
- Studio API client function for scene dialogue audio take pick;
- project data service method for scene dialogue audio take pick;
- CLI command `generation dialogue-audio pick`;
- tests that only prove the obsolete command or route exists.

Keep only the take-owned shot-video selection route for production selection.

### Slice 9: Documentation And Architecture Cleanup

Update accepted docs so they describe the current model:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/recoverable-discard-and-trash.md`;
- any CLI or Studio docs that mention scene dialogue audio picks.

Historical plans may remain historical. Do not sweep old plans only to replace
terminology unless they are currently being used as implementation direction.

## Testing And Verification

### Core Tests

Add or update tests for:

- generating dialogue audio creates a take but no picked state;
- repeated generation creates multiple plain takes;
- deleting one take does not promote another take;
- discarding/restoring a scene dialogue audio take does not restore scene-level
  picked state;
- shot-video selection rejects a take from another dialogue;
- shot-video selection rejects a missing or discarded take;
- shot-video preflight reports missing selected take when a selected id becomes
  stale;
- final spec creation uses the selected take's asset file.

### Studio Unit Tests

Add or update tests for:

- Narrative Takes tab does not render Pick or Picked;
- Narrative audio generation refreshes the take list without selecting a take;
- Narrative delete refreshes without promoting a replacement;
- Dialogs tab shows direct Pick for exactly one generated unselected take;
- direct Pick calls
  `updateTakeDialogueAudioSelection(projectName, sceneId, takeId, { dialogueId, takeId })`;
- Dialogs tab opens picker only when there are multiple takes;
- picker rows preview audio and mark the shot-video selected take;
- no Dialogs card uses scene-level picked state.

### Studio Server And Service Tests

Add or update tests for:

- scene dialogue audio pick route is removed;
- scene dialogue audio API client no longer exports pick;
- take-owned dialogue audio selection route remains;
- fake project data service matches the new contract.

### CLI Tests

Add or update tests for:

- `generation dialogue-audio pick` is removed from help and dispatch;
- dialogue audio generation output no longer includes `pickedTakeId`;
- shot-video take selection CLI, if present, writes take-owned selection only.

### Rendered Verification

Use desktop verification only.

Validate against a real project route such as:

```text
http://localhost:5173/projects/urban-basilica/scenes/scene_djkfgf9p?sceneTab=takes&shot=shot_001&takeMode=edit&take=scene_shot_video_take_cdstd9w8&shotTab=dialogs
```

Checks:

- Narrative screen shows generated audio takes without Pick or Picked;
- multiple generated Narrative takes can be previewed;
- Dialogs row with one generated take shows a direct Pick button;
- clicking the direct Pick selects the take and refreshes the row;
- Dialogs row with multiple generated takes opens the picker dialog;
- choosing a take in the picker updates the selected take;
- no framework overlay appears;
- browser console has no relevant warnings or errors;
- text does not overlap at the desktop viewport.

## Completion Checklist

### Review And Product Contract

- [x] Confirm Narrative is strictly an audio authoring surface.
- [x] Confirm Dialogs is the only scene dialogue audio selection surface.
- [x] Confirm no hidden default take is allowed for Narrative playback.
- [x] Confirm direct Pick for exactly one generated take.
- [x] Confirm picker dialog only for multiple generated takes.
- [x] Confirm deletion from Narrative remains allowed, or explicitly defer
      deletion redesign to a separate plan.

### Architecture And Naming

- [x] Remove scene-level dialogue audio pick as a domain concept.
- [x] Keep shot-video dialogue audio selection take-owned.
- [x] Rename shot-video reference projection fields from picked to selected.
- [x] Remove obsolete picked/pick DTO fields without compatibility aliases.
- [x] Remove route-local, CLI-local, or React-local business rules that infer
      default selected audio.
- [x] Keep dependency ids core-owned and keyed by screenplay dialogue id.
- [x] Ensure all missing selected-take failures use structured diagnostics.

### Database And Core

- [x] Remove `pickedTakeId` from `SceneDialogueAudio`.
- [x] Remove `picked` from `SceneDialogueAudioTake`.
- [x] Remove `sceneDialogueAudio.pickedTakeId` from the Drizzle schema.
- [x] Generate the SQL migration with Drizzle Kit.
- [x] Remove `pickSceneDialogueAudioTakeRecord`.
- [x] Remove `pickSceneDialogueAudioTake`.
- [x] Stop auto-picking generated dialogue audio takes.
- [x] Stop promoting replacement takes after deletion.
- [x] Update trash snapshot/restore logic for scene dialogue audio takes.
- [x] Update project data service contracts and wiring.
- [x] Update resource keys only if needed by the new mutation reports.

### Shot-Video Selection

- [x] Keep
      `SceneShotVideoTakeReferenceSelections.selectedDialogueAudioTakeIds`.
- [x] Ensure reference resolution reads only take-owned selected ids.
- [x] Rename `pickedTake` to `selectedTake`.
- [x] Rename `pickedTakeLabel` to `selectedTakeLabel`.
- [x] Update missing-file copy to selected-take wording.
- [x] Verify preflight uses selected take asset files.
- [x] Verify final spec creation uses selected take asset files.
- [x] Verify provider payload construction uses selected take asset files.
- [x] Verify route capability warnings do not mutate selections.

### Studio Server And API

- [x] Delete scene dialogue audio pick route from
      `packages/studio/server/routes/screenplay.ts`.
- [x] Delete scene dialogue audio pick request parsing.
- [x] Delete `pickSceneDialogueAudioTake` from
      `studio-scene-dialogue-audio-api.ts`.
- [x] Keep take-owned dialogue audio selection in
      `studio-shot-video-takes-api.ts`.
- [x] Update server route tests.
- [x] Update service API tests.
- [x] Update fake project data service.

### Narrative UI

- [x] Remove pick handler from `useSceneDialogueAudio`.
- [x] Remove `onPickTake` from `SceneDialogueAudioPanel`.
- [x] Remove Pick buttons from `SceneDialogueAudioTakesTab`.
- [x] Remove Picked badges from `SceneDialogueAudioTakesTab`.
- [x] Ensure take preview playback still works from explicit take rows.
- [x] Remove scene-level picked playback from `SceneDialogueCard`.
- [x] Ensure audio generation refreshes the take list.
- [x] Ensure take deletion refreshes the take list without promotion.
- [x] Update Narrative UI tests.

### Dialogs UI

- [x] Show `Not generated` when no takes exist.
- [x] Show direct Pick when exactly one generated take exists and none is
      selected.
- [x] Direct Pick calls the take-owned selection mutation.
- [x] Show selected take label when a take is selected.
- [x] Open picker dialog only when multiple takes exist.
- [x] Picker dialog lists all generated takes for the dialogue.
- [x] Picker dialog supports preview before selection.
- [x] Picker dialog shows the current shot-video selected take.
- [x] Picker dialog selection persists via take-owned mutation.
- [x] Refresh production plan and dialogue audio context after selection.
- [x] Update Dialogs UI tests.
- [x] Use only local shadcn-style controls.

### CLI

- [x] Remove `generation dialogue-audio pick` dispatch.
- [x] Remove `generation dialogue-audio pick` help text.
- [x] Remove pick command tests.
- [x] Update dialogue audio generation output assertions.
- [x] Keep or add only take-owned selection CLI behavior if needed.

### Documentation

- [x] Update `docs/architecture/media-generation.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/architecture/data-model-and-storage.md`.
- [x] Update `docs/architecture/reference/recoverable-discard-and-trash.md`.
- [x] Update active implementation docs that still describe scene-level picks
      as current direction.
- [x] Do not sweep historical plans only for terminology cleanup.

### Final Verification

- [x] Run focused core tests for scene dialogue audio and shot-video dialogue
      references.
- [x] Run focused Studio tests for Narrative and Dialogs.
- [x] Run focused CLI tests for dialogue audio commands.
- [x] Run `pnpm --dir packages/studio exec eslint` on touched Studio files.
- [x] Run package typecheck or root `pnpm check` if the slice touches public
      client contracts broadly.
- [ ] Verify the desktop localhost flow in the browser.
- [ ] Confirm no framework overlay appears.
- [ ] Confirm no relevant browser console warnings/errors appear.
- [x] Confirm the implementation leaves unrelated dirty worktree files alone.

Rendered desktop verification note: `urban-basilica` was migrated to schema
generation 33 and the browser reached `http://localhost:5173`, but the existing
Studio dev server on the required port was stale and still expected schema
generation 32. The sandbox could not stop that process, so browser flow
verification remains blocked until the port-5173 Studio server is restarted.
