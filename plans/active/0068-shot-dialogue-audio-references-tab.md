# 0068 - Shot Dialogue Audio References Tab

Status: active plan  
Date: 2026-06-12  
Owner: Renku Studio

## Purpose

Add a new shot-detail tab named **Dialogs** between **Motion** and
**References**. This tab lets users select dialogue audio references for a shot
or a multi-shot video group.

The selected dialogue audio references become part of the shot-video generation
input set so models that support audio references can use the same picked
dialogue takes during video generation. This supports shots where cast members
speak, narrate, shout, or otherwise need voice-consistent audio aligned with the
generated video.

The implementation must also confirm and repair the multi-shot reference path:
multi-shot video generation should receive the union of selected references
from the shots in the group, both for the existing **References** tab and the
new **Dialogs** tab.

## Product Behavior

### New Shot Tab

The shot detail tabs become:

1. Description
2. Composition
3. Motion
4. Dialogs
5. References
6. AI Production

The visible tab label is **Dialogs** because that is the user-facing wording in
the requested interface. Internal domain names should continue using
`DialogueAudio` where the concept is specifically scene dialogue audio, because
the existing project model already uses `SceneDialogueAudioContext`,
`SceneDialogueAudioTake`, and `dialogueId`.

### Dialog Cards

The **Dialogs** tab shows dialogue audio reference cards for the selected shot
or selected multi-shot group.

Each card represents one scene dialogue id that is relevant to the shot group.
The card should include:

- the speaker or narrator profile image, spanning the visual height of the
  take label and date lines;
- the picked take label, such as `Take 1`;
- the picked take creation date;
- an audio play/pause control;
- a playback slider;
- the dialogue text below the slider;
- the same selected/unselected control style used by the existing References
  tab.

The compact reference card must not include:

- a Pick button;
- a trash/delete button;
- raw browser controls such as `<button>`, `<input>`, or `<textarea>` in feature
  code.

When `takeCount > 1`, clicking the non-control area of the compact card opens a
take-management dialog for that dialogue. When `takeCount` is `0` or `1`, the
compact card must not show an open-dialog affordance and clicking the card body
must not open a dialog. The play button, playback slider, and select/unselect
control must never open the dialog.

Cards should use a one-column or two-column responsive grid depending on the
available desktop width. Renku Studio is desktop-first, so this plan does not
include mobile-specific behavior.

### Dialogue Take Management Dialog

Dialogue reference cards with more than one take should provide a dialog entry
point similar to the existing cast and location reference dialogs.

The dialog shows all audio takes for that dialogue and lets the user change the
picked take without returning to the Narrative tab. This is an alternate entry
point to the existing Narrative > Dialog > Takes workflow, not a replacement for
that workflow.

The dialog should not be available when the dialogue has zero or one take. In
those cases, there is nothing to choose between from the compact card, and the
card should remain a simple reference/playback surface.

The dialog should use the same take-card presentation shown in the existing
Takes panel:

- take label, such as `Take 1`;
- `PICKED` badge for the current pick;
- created date;
- play/pause control;
- playback slider;
- Pick button;
- the same existing take actions that are already available in the Takes panel,
  if that reusable take card includes them.

The compact Dialogs-tab reference card remains a reference selector and does
not show the Pick button. The dialog is where pick changes happen.

Implementation must avoid nested interactive controls. For cards with
`takeCount > 1`, the dialog trigger should be a local shadcn-style interactive
region for the non-control card surface, with play, scrub, and selection
controls implemented as separate local controls outside that trigger region. For
cards with `takeCount <= 1`, do not render that trigger region.

### Empty And Unavailable States

If the shot or shot group has no dialogue references, the tab should show a
quiet empty state that explains there are no dialogue audio references for the
current shot selection.

If a dialogue exists but has no picked audio take, the card should be visible
but unavailable for selection. The unavailable state should make the issue clear
without inventing generic filler text. The generation plan should also expose a
structured issue so AI Production can explain why the reference cannot be sent
to a model.

### Selection Semantics

Users can select and unselect dialogue audio references for:

- a single shot;
- a multi-shot group.

For a single shot, selection updates that shot's `referenceInclusions`.

For a multi-shot group, selection must behave as a group-level decision. The
current data model stores `referenceInclusions` on shot specs, so the clean
implementation is to apply the same inclusion override to every shot in the
current production group instead of relying on whichever shot happens to be read
first.

The effective generation input set for a multi-shot group is:

- every default-included reference required or selected by any shot in the
  group;
- plus every explicitly included optional reference from any shot in the group;
- minus references explicitly excluded for the whole group.

This same union policy applies to existing visual references and new dialogue
audio references.

## Investigation Summary

### Existing Shot Detail UI

Relevant files:

- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`
- `packages/studio/src/features/movie-studio/movie-studio-selection.ts`
- `packages/studio/src/app/use-project-session.ts`

`SceneShotDetail` owns the current shot-detail tab list. The tab union and URL
query parsing are centralized through `SceneShotDetailTab` and
`SCENE_SHOT_DETAIL_TABS`.

The new tab needs to be added to both the UI tab list and the route-safe tab
parsing list so `?shotTab=dialogs` is stable and shareable.

### Existing References Tab

Relevant files:

- `packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card-grid.tsx`

The References tab already uses a production-plan report from
`useShotVideoTakeProduction`. Reference cards use `ImageSelectionControl` for
the consistent include/exclude UI. The Dialogs tab should use the same selection
control instead of creating a parallel control style.

The current reference selection endpoint updates one shot:

`PATCH /screenplay/scenes/:sceneId/shots/:shotId/reference-inclusions`

For group selection, a domain-specific group update route is preferable to
making the frontend loop over multiple single-shot calls. It keeps the
shot-video production group behavior explicit and testable.

### Existing Dialogue Audio UI

Relevant files:

- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-panel.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-takes-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-card.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-scene-dialogue-audio.ts`
- `packages/studio/src/services/studio-scene-dialogue-audio-api.ts`

Scene dialogue audio already has:

- dialogue ids;
- picked takes;
- take asset ids and file ids;
- browser URLs for playback;
- cast member image support in narrative dialogue cards;
- a reusable audio player hook with progress, duration, play/pause, and seek.

The Dialogs tab should reuse this existing scene dialogue audio behavior where
possible. Its compact reference card should adapt the take row anatomy while
omitting Pick and Delete actions and adding the selection control. Its
take-management dialog should reuse or extract the existing take card so the
Pick flow stays consistent with the Narrative tab.

### Existing Core Contracts

Relevant files:

- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/client/scene-audio-generation.ts`
- `packages/core/src/client/scene-shot-list-json-schemas.ts`

The shot-video contract already contains useful pieces:

- `ShotVideoTakeInputKind` includes `audio`;
- `ShotVideoTakeDependencyKind` includes `reference-audio`;
- `ShotSpecs.referenceInclusions` can store arbitrary dependency ids mapped to
  `include` or `exclude`;
- scene dialogue audio takes already carry `assetId`, `assetFileId`, `picked`,
  `plainTextSnapshot`, and `createdAt`.

The missing contract is a stable way to identify a dialogue audio reference as a
shot-video input dependency. The plan should add a public subject kind for scene
dialogue references, rather than tying selection to a specific take asset id.
That keeps the reference stable if the picked take changes later.

Proposed public subject kind:

`scene-dialogue`

The dependency means:

> Use the current picked audio take for this scene dialogue id as an audio
> reference input.

### Existing Shot-Video Production Path

Relevant files:

- `packages/core/src/server/media-generation/shot-video-take/context.ts`
- `packages/core/src/server/media-generation/shot-video-take/production-plan.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-sections.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-inventory.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-inclusions.ts`
- `packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`
- `packages/core/src/server/media-generation/shot-video-take/preflight-inputs.ts`

The shot-video production plan is the right source of truth for this feature.
It already produces the reference card report consumed by the Studio UI and the
dependency inventory used for pricing and generation input preparation.

Current gaps:

- there is no dialogue audio reference section in the production-plan report;
- selected dialogue ids are not derived from `SceneShot.dialogue`;
- picked scene dialogue audio takes are not turned into shot-video prepared
  inputs;
- `filterPreparedInputsByReferenceInclusions` does not treat `audio` as a
  reference-prepared input;
- `preparedInputMatchesSlot` currently assumes shot-video input slots are image
  inputs;
- multi-shot inclusion lookup currently uses the first non-null override it
  finds, which is not an explicit union policy.

### Existing Engine And Provider Path

Relevant files:

- `packages/engines/src/shot-video/shot-video-model-families.ts`
- `packages/engines/src/sdk/unified/file-input-resolution.test.ts`

The engine route type already supports audio input slots:

`mediaKind: 'image' | 'audio' | 'video'`

The unified file-input resolver has test coverage for flattening audio URI array
fields such as `audio_urls`, so the upload layer can carry audio arrays when a
route declares them.

The current route catalog does not expose a reusable audio reference slot for
shot-video routes. Implementation must add audio slots only to model routes
whose provider schema supports reference audio. If a selected model route does
not support audio reference input, the system should report that limitation
clearly instead of silently dropping selected dialogue references.

## Architecture Decisions

### Source Of Truth

Dialogue audio selections are reference inclusion decisions. They belong to the
same dependency graph used by visual references, pricing, and generation
preflight.

Do not create a separate dialogue-selection table or a parallel selection model.

### Stable Dependency Identity

Dialogue audio dependencies should be keyed by scene dialogue id, not by picked
take id.

Reason:

- the user is selecting a dialogue line as an audio reference;
- the picked take can change over time;
- generation should use the currently picked take when it runs;
- stale take ids would create confusing behavior after a new take is picked.

### Multiple Takes And Pick Changes

Scene dialogue audio can have multiple takes, but a shot-video dialogue
reference points to the dialogue id, not to a specific take id.

The exact lifecycle is:

1. A dialogue card represents `dialogueId`.
2. The card displays the current picked take for that dialogue, if exactly one
   picked take exists.
3. The card selection state is stored through the dialogue dependency id in
   shot `referenceInclusions`.
4. The selected dependency does not store `takeId`, `assetId`, `assetFileId`, or
   a playback URL.
5. Every production-plan read resolves the selected dialogue id to the current
   picked take from scene dialogue audio state.
6. Every generation request resolves the selected dialogue id again and
   snapshots the current picked take's asset file into the prepared inputs for
   that request.

This means changing the picked take does not require any shot-spec mutation. The
selected reference remains selected because the dependency id is still the same
dialogue id. The next production-plan read and the next generation request will
use the newly picked take.

The existing scene dialogue audio Takes panel remains one place where users pick
among multiple takes. The new **Dialogs** tab also provides a take-management
dialog as a faster entry point from the shot-video reference workflow. Both
entry points mutate the same scene dialogue audio picked-take state.

Pick-change behavior:

- when a user picks a different take, the server must persist the new picked
  state so exactly one take is picked for that dialogue;
- the Studio pick mutation must invalidate the scene dialogue audio query and
  the shot-video production-plan query for the same scene;
- the Dialogs tab should then show the newly picked take label, date, playback
  URL, and slider state;
- the take-management dialog should update its take list so the `PICKED` badge
  moves to the newly picked take;
- selected dialogue references should remain selected after the pick changes;
- the next generation request should use the newly picked take's asset file.

Invalid take states must fail clearly:

- zero picked takes: the card is visible but unavailable for selection; if the
  dialogue reference is effectively included, preflight reports a structured
  blocking diagnostic and does not silently omit the audio;
- more than one picked take: preflight reports a structured blocking diagnostic
  because the current picked take is ambiguous;
- picked take missing an asset file: preflight reports a structured blocking
  diagnostic;
- picked take deleted after selection: selection remains attached to the
  dialogue id, but the card becomes unavailable until another take is picked.

Generated requests are snapshots. If a user changes the picked take after a
generation request has already been created, that in-flight request should keep
using the take asset file captured when the request was created. Future
production-plan reads and future requests should use the newer pick.

### No Expected Database Migration

This implementation should not require a SQL schema migration.

Existing storage already has:

- scene dialogue audio take records;
- picked take state;
- shot specs JSON;
- `referenceInclusions` in shot specs.

If implementation discovers a durable schema change is truly required, pause and
follow the accepted Drizzle Kit workflow in
`docs/architecture/drizzle-migrations.md` before changing migrations.

### Group Selection Route

Add a group-aware reference inclusion route for shot-video production groups.

The route should accept:

- `sceneId`;
- the production group shot ids;
- `dependencyId`;
- `inclusion`.

The route should validate that the shot ids belong to the scene and update the
same inclusion override for every shot in the group.

This is a current-domain endpoint, not a compatibility wrapper around the old
single-shot endpoint.

### Fail Fast Diagnostics

Use structured diagnostics for invalid generation states:

- dialogue reference points to a missing scene dialogue block;
- dialogue reference resolves to a dialogue id with no picked audio take;
- selected dialogue audio cannot be mapped to an asset file;
- current model route does not support selected audio reference inputs.

Do not silently ignore these cases.

### Multi-Shot Union Policy

The production plan and final generation request must use the same union policy.

For a multi-shot group:

- candidate references are collected from every shot in the group;
- selected optional references are included if any shot in the group includes
  them or the group-level override includes them;
- default references are included unless the group-level override excludes them;
- the final provider payload receives one deduplicated set of files.

The References tab should display the same effective state that generation will
use.

## Implementation Slices

### 1. Add Dialogue Audio Reference Contracts

Add or extend core client contracts so a shot-video input can identify a scene
dialogue audio reference.

Expected changes:

- add `scene-dialogue` to the shot-video input subject kind union;
- update JSON schemas for prepared shot-video inputs if required;
- add a dependency id helper for dialogue audio references;
- add a typed report shape for dialogue audio reference choices in the
  shot-video production plan.

Suggested report shape:

```ts
export type ShotVideoTakeDialogueAudioReferenceChoice = {
  dependencyId: string;
  dialogueId: string;
  castMemberId: string | null;
  speakerName: string;
  plainText: string;
  pickedTake: {
    takeId: string;
    takeLabel: string;
    createdAt: string;
    assetId: string;
    assetFileId: string;
  } | null;
  takeCount: number;
  defaultIncluded: boolean;
  included: boolean;
  required: boolean;
  unavailableReason: string | null;
};
```

The exact field names can change during implementation, but public names should
stay domain-specific and avoid placeholders such as `item`, `data`, or
`detail`.

The production-plan report should carry the current picked-take summary because
that state affects generation readiness and compact card display. The
take-management dialog can read all takes for the dialogue through the existing
scene dialogue audio context and mutations, then invalidate the production plan
after a pick changes.

### 2. Resolve Dialogue References For Shot Groups

Add a core resolver that maps shot dialogue references to scene dialogue ids.

Inputs:

- the current screenplay scene;
- the selected shot or shot group;
- scene dialogue audio context;
- cast member labels and image metadata where needed by the Studio report.

Outputs:

- deduplicated dialogue choices for the group;
- structured issues for missing dialogue ids, missing picked takes, or missing
  asset files;
- structured issues for ambiguous dialogue state when more than one take is
  marked picked for the same dialogue.

Important detail:

`SceneShot.dialogue` currently stores block indexes and optional line indexes,
not `dialogueId`. The resolver must map those references through the screenplay
scene blocks and fail clearly when the mapping is invalid.

### 3. Extend Production Plan References

Extend `readShotVideoTakeProductionPlan` and
`buildShotVideoTakeProductionPlanReport` so the frontend receives dialogue audio
reference choices together with existing visual reference sections.

The report should make it easy for the UI to render:

- available dialogue cards;
- selected/unselected state;
- the current picked take label, date, and playback target;
- total take count for the dialogue;
- disabled state when no picked take exists or the picked take is ambiguous;
- structured warnings or errors that should also appear in AI Production.

### 4. Add Dialogue Audio Prepared Inputs

Extend the shot-video preflight input path to derive prepared audio inputs from
picked scene dialogue audio takes.

Expected behavior:

- if a dialogue reference is effectively included and has exactly one picked
  take, create a prepared input with `kind: 'audio'`;
- use `subjectKind: 'scene-dialogue'` and `subjectId: dialogueId`;
- point to the picked take asset file;
- deduplicate by dialogue id and asset file id;
- snapshot the picked take asset file when the generation request is created;
- fail with a structured issue if the asset file cannot be resolved.
- fail with a structured issue if no take is picked or multiple takes are
  marked picked.

This should be implemented beside existing derived inputs such as lookbook sheet
inputs, not by duplicating scene dialogue audio files into shot-video input
records.

### 5. Add Audio Reference Dependency Slots

Extend the dependency inventory so selected dialogue audio inputs participate in
the same dependency graph as visual references.

Expected changes:

- create `reference-audio` dependency slots for dialogue audio references;
- make `preparedInputMatchesSlot` media-kind aware so audio inputs can satisfy
  audio slots;
- update `isReferencePreparedInput` so audio reference inputs are filtered by
  reference inclusion overrides;
- ensure required, default-included, included, and excluded states are computed
  consistently for audio and visual references.

### 6. Repair Multi-Shot Reference Union

Audit and fix existing multi-shot reference handling.

Areas to verify:

- cast character sheet references;
- location sheet and view references;
- lookbook sheet references;
- general reference images;
- first frame, last frame, and multi-shot storyboard references;
- custom shot reference images;
- new dialogue audio references.

The current code already unions several candidate sets, but inclusion override
resolution uses a first non-null value. Replace that implicit behavior with a
named group policy and tests.

Lookbook handling needs special attention because the current reference section
builder uses the first selected lookbook sheet id in some paths. Multi-shot
generation should either union all selected lookbook sheet ids or intentionally
declare a single-lookbook policy with validation. For this feature, prefer union
unless a route constraint proves otherwise.

The implementation must include a comprehensive union-policy test matrix. The
matrix should assert both visible production-plan state and final generation
input state so a reference cannot appear selected in the UI while being omitted
from the model payload.

### 7. Add Provider Route Audio Support

Add route input-slot metadata for audio references only where the current engine
catalog and provider schema support it.

Expected changes:

- add a reusable optional reference-audio route slot where appropriate;
- map final audio inputs into the provider payload field expected by that
  route, such as an audio URI array field;
- update provider payload tests to prove selected dialogue audio becomes
  provider input;
- report a structured limitation when selected dialogue audio is present but the
  selected route cannot accept audio references.

Do not add speculative audio fields to routes that do not support them.

### 8. Add Group Reference Inclusion API

Add a Studio/core route and service method for group reference inclusion.

Expected behavior:

- validate the project, scene, and shot ids;
- validate the dependency id against the current production plan where possible;
- apply the same inclusion override to every shot in the group;
- return the updated production plan or enough invalidation data for the Studio
  query cache to refresh;
- keep the existing single-shot endpoint available for single-shot behavior.

### 9. Add Dialogs Tab UI

Add new feature components under the movie studio scenes feature area.

Suggested components:

- `SceneShotDialogsTab`
- `SceneShotDialogueAudioReferenceCard`
- `SceneShotDialogueAudioReferenceCardGrid`
- `SceneShotDialogueAudioTakesDialog`

The card should follow existing visual language:

- local shadcn `Button`, `Slider`, and any existing local primitives;
- no raw browser form or interactive controls;
- restrained card styling consistent with the current dark Studio interface;
- profile image on the left of the take/date lines;
- playback control and slider below the take header;
- dialogue text below the slider;
- selection control matching References.

The tab should receive production-plan dialogue choices, cast member image URLs,
the current production group shot ids, and scene dialogue audio context from
`SceneShotDetail` or a focused hook.

When `takeCount > 1`, the take-management dialog should follow the existing
dialog pattern used by:

- `SceneShotCastReferenceCard`;
- `SceneShotLocationReferenceRow`.

The dialog contents should reuse or extract the existing take-card presentation
from `SceneDialogueAudioTakesTab` so the Pick button, `PICKED` badge, play
control, slider, and existing take actions stay consistent with the Narrative
tab.

The compact card open behavior should be tested and implemented carefully:

- cards with `takeCount > 1` render a non-control open-dialog region;
- cards with `takeCount <= 1` do not render an open-dialog region;
- clicking the non-control card surface opens the take-management dialog only
  when `takeCount > 1`;
- clicking play/pause does not open the dialog;
- scrubbing the slider does not open the dialog;
- clicking the selected/unselected reference control does not open the dialog;
- keyboard focus order reaches the open-dialog region only when it exists, then
  reaches playback control, slider, and selection control predictably.

### 10. Wire Cache Invalidation And Playback

The Dialogs tab should update the same production-plan query cache used by the
References tab after inclusion changes.

Scene dialogue audio pick mutations should also invalidate the shot-video
production-plan query for the same scene, because dialogue cards and prepared
inputs resolve the current picked take dynamically from scene dialogue audio
state.

Pick mutations from the new take-management dialog and pick mutations from the
existing Narrative > Dialog > Takes panel must call the same scene dialogue
audio service path. Both entry points should update the same cache keys.

Playback should reuse `useSceneDialogueAudioPlayer` or a closely related hook so
playback state, progress, duration, and seek behavior stay consistent with the
existing dialogue audio panel.

The take file URL helper should be owned by the Studio dialogue audio service,
not reimplemented through ad hoc string construction in the component.

## UX Details

### Card Layout

Recommended desktop layout:

- grid with `minmax(280px, 1fr)` or similar, allowing one or two columns based
  on panel width;
- compact header row with profile image, take label, date, and selection
  control;
- playback row with play/pause icon button and slider;
- dialogue text in a quiet body area.

When `takeCount > 1`, the compact card should communicate that details are
available without adding visible instructional copy. Use normal hover/focus
affordances that match cast and location reference cards. When `takeCount <= 1`,
do not show those open-dialog affordances.

### Take Management Dialog Layout

The take-management dialog should be a focused modal, not a full right-side
scene panel.

Recommended layout:

- dialog header with speaker name and a short dialogue text preview;
- profile image or neutral avatar near the speaker identity when available;
- vertically stacked take cards matching the existing Takes panel card from the
  screenshot;
- Pick button visible on each unpicked take;
- `PICKED` badge visible on the current picked take;
- playback controls and slider inside each take card;
- existing delete/take actions only if they are already part of the reused take
  card behavior.

The dialog should not introduce a separate take-selection model. Pick state
comes from scene dialogue audio and is persisted through the same service used
by the Narrative tab.

### Profile Image

Use the cast member profile image when `castMemberId` is present and an image is
available.

Fallback behavior:

- narrator or non-cast dialogue can use a neutral avatar surface;
- missing cast image should not block generation;
- missing cast image should not invent a filename or id as visible text.

### Copy

Keep copy sparse and domain-specific.

Good examples:

- `No picked audio take`
- `Audio references are not supported by this model`
- `No dialogue references for this shot`

Avoid showing raw ids such as:

- `dialogue_abc123`
- `cast_member_mara`
- generated role names
- filenames

## Testing Plan

### Core Tests

Add tests for:

- resolving shot dialogue block references into dialogue ids;
- deduplicating dialogue references across a multi-shot group;
- including picked dialogue audio takes as prepared audio inputs;
- excluding dialogue audio when the group override excludes it;
- including dialogue audio when the group override includes it;
- reporting missing dialogue ids as structured issues;
- reporting missing picked takes as structured issues;
- reporting multiple picked takes for one dialogue as a structured issue;
- reporting missing asset files as structured issues;
- keeping dialogue reference selection stable when the picked take changes;
- snapshotting the current picked take asset file when a generation request is
  created;
- unioning existing visual references across multi-shot groups;
- preserving existing single-shot reference behavior.

### Multi-Shot Union Policy Test Matrix

The core test suite should include table-driven tests for the effective
reference set of a multi-shot production group. Each test should assert:

- the reference choices reported to the Studio UI;
- the effective `included` state for each choice;
- the dependency inventory entries;
- the final prepared inputs after reference inclusion filtering;
- the provider payload inputs for routes that support the reference media kind;
- the structured diagnostics for unavailable or unsupported references.

Use a small fixture group with three shots:

- `shotA`
- `shotB`
- `shotC`

Use stable fixture reference ids:

- visual cast reference `castUrbanSheet`
- visual location reference `wallLocationView`
- visual lookbook reference `lookbookSmokeSheet`
- custom visual reference `customSmokePlate`
- dialogue reference `dialogueUrbanLine`
- dialogue reference `dialogueMaraLine`

#### Candidate Collection Matrix

| Case | Shot A candidates | Shot B candidates | Shot C candidates | Expected group candidates |
| --- | --- | --- | --- | --- |
| Candidate only on one shot | `castUrbanSheet` | none | none | `castUrbanSheet` |
| Same candidate on two shots | `castUrbanSheet` | `castUrbanSheet` | none | one deduped `castUrbanSheet` |
| Distinct candidates on two shots | `castUrbanSheet` | `wallLocationView` | none | `castUrbanSheet`, `wallLocationView` |
| Distinct candidates on all shots | `castUrbanSheet` | `wallLocationView` | `lookbookSmokeSheet` | all three references |
| Custom visual reference on one shot | `customSmokePlate` | none | none | `customSmokePlate` |
| Dialogue reference on one shot | `dialogueUrbanLine` | none | none | `dialogueUrbanLine` |
| Same dialogue on two shots | `dialogueUrbanLine` | `dialogueUrbanLine` | none | one deduped `dialogueUrbanLine` |
| Distinct dialogues across shots | `dialogueUrbanLine` | `dialogueMaraLine` | none | both dialogue references |
| Visual and dialogue mixed | `castUrbanSheet`, `dialogueUrbanLine` | `wallLocationView`, `dialogueMaraLine` | none | all four references |

#### Inclusion Override Matrix

The same override matrix should be run for every reference family:

- cast character sheet;
- location sheet/view;
- lookbook sheet;
- custom visual reference image;
- first frame;
- last frame;
- multi-shot storyboard;
- dialogue audio.

| Case | Default included | Shot A override | Shot B override | Shot C override | Expected group state | Expected final input |
| --- | --- | --- | --- | --- | --- | --- |
| No overrides, default included | yes | none | none | none | included | present |
| No overrides, default optional | no | none | none | none | not included | absent |
| Include optional on one shot | no | `include` | none | none | included | present |
| Include optional on later shot | no | none | `include` | none | included | present |
| Include optional on all shots | no | `include` | `include` | `include` | included | one deduped input |
| Exclude default on one shot through group update | yes | `exclude` | `exclude` | `exclude` | excluded | absent |
| Exclude optional after include through group update | no | `exclude` | `exclude` | `exclude` | excluded | absent |
| Clear override after exclude | yes | none | none | none | included | present |
| Clear override after include | no | none | none | none | not included | absent |
| Conflicting legacy shot overrides | yes | `include` | `exclude` | none | structured conflict diagnostic, deterministic policy result | matches documented deterministic policy |

The conflicting legacy override case exists to protect the transition from the
old first-non-null lookup behavior. New group updates should write the same
override to every shot in the group, but the resolver should still behave
deterministically if it reads older or manually edited data with conflicting
shot-level overrides. The test must assert the exact documented policy instead
of allowing array order to decide the result.

#### Availability Matrix

| Case | Reference kind | Candidate exists | Asset file exists | Picked take exists | Route supports media | Expected UI state | Expected final input | Expected diagnostic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Visual reference ready | visual | yes | yes | not applicable | yes | selectable, included by policy | present when included | none |
| Visual reference missing file | visual | yes | no | not applicable | yes | unavailable | absent | missing asset file |
| Dialogue ready | dialogue audio | yes | yes | yes | yes | selectable, included by policy | present when included | none |
| Dialogue has no picked take | dialogue audio | yes | no | no | yes | unavailable | absent | no picked audio take |
| Dialogue has multiple picked takes | dialogue audio | yes | yes | ambiguous | yes | unavailable | absent | ambiguous picked audio take |
| Dialogue picked take missing file | dialogue audio | yes | no | yes | yes | unavailable | absent | missing audio asset file |
| Dialogue selected but route lacks audio slot | dialogue audio | yes | yes | yes | no | selected with route limitation visible | absent from provider payload | unsupported audio reference route |
| Dialogue excluded and route lacks audio slot | dialogue audio | yes | yes | yes | no | unselected | absent | none |

#### Pick Lifecycle Matrix

| Case | Initial take state | User action | Expected stored selection | Expected UI after refresh | Expected next generation request |
| --- | --- | --- | --- | --- | --- |
| Single take | `take1` picked | click compact card body | dependency id remains `dialogueUrbanLine` | card shows `take1`, no take dialog opens | prepared audio input uses `take1` asset file |
| Multiple takes, one picked | `take1` picked, `take2` unpicked | none | dependency id remains `dialogueUrbanLine` | card shows `take1`, take dialog is available | prepared audio input uses `take1` asset file |
| Pick changes from Dialogs tab | `take1` picked, `take2` unpicked | open take dialog and pick `take2` | dependency id remains `dialogueUrbanLine` | card and dialog show `take2` after cache invalidation | prepared audio input uses `take2` asset file |
| Pick changes from Narrative tab | `take1` picked, `take2` unpicked | pick `take2` in Narrative > Dialog > Takes | dependency id remains `dialogueUrbanLine` | card shows `take2` after cache invalidation | prepared audio input uses `take2` asset file |
| Pick cleared with no alternate takes | `take1` picked | unpick or delete `take1` without another pick | dependency id remains `dialogueUrbanLine` | card unavailable with no picked take, no take dialog opens | blocking diagnostic, no silent omission |
| Pick cleared with alternate takes | `take1` picked, `take2` unpicked | unpick or delete `take1` without another pick | dependency id remains `dialogueUrbanLine` | card unavailable with no picked take, take dialog is available | blocking diagnostic until a new pick is chosen |
| Picked take deleted and replacement picked | `take1` picked, `take2` unpicked | delete `take1`, pick `take2` | dependency id remains `dialogueUrbanLine` | card shows `take2` | prepared audio input uses `take2` asset file |
| Duplicate picked takes | `take1` picked, `take2` picked | none | dependency id remains `dialogueUrbanLine` | card unavailable with ambiguous pick state | blocking diagnostic |
| Generation request already created | `take1` picked | create request, then pick `take2` | dependency id remains `dialogueUrbanLine` | future plan shows `take2` | existing request uses captured `take1`; future request uses `take2` |

These tests should prove that pick changes update the resolved audio file
without rewriting shot reference selections, while already-created generation
requests remain reproducible snapshots.

#### Deduplication Matrix

| Case | Input shape | Expected production-plan choices | Expected prepared inputs | Expected provider payload |
| --- | --- | --- | --- | --- |
| Same visual dependency appears on two shots | two shot references to same dependency id | one choice | one prepared input | one file URL |
| Same dialogue id appears on two shots | two shot references to same dialogue id | one choice | one prepared audio input | one audio URL |
| Same asset file backs two different visual dependencies | two dependency ids, one file id | two choices | two dependency entries, one uploaded file reference where resolver supports reuse | no duplicate upload if file resolver dedupes |
| Same picked take reused by two dialogue ids | two dialogue ids, one asset file id | two choices | two dependency entries keyed by dialogue id | one or two payload entries according to provider semantics, explicitly asserted |
| Same dependency included and excluded in legacy data | one dependency id, conflicting shot overrides | one choice with deterministic state | matches deterministic state | matches deterministic state |

#### Required Reference Matrix

| Case | Reference kind | User attempts exclusion | Expected behavior |
| --- | --- | --- | --- |
| Required first frame | first frame | exclude | validation rejects exclusion |
| Required last frame | last frame | exclude | validation rejects exclusion |
| Required multi-shot storyboard | storyboard | exclude | validation rejects exclusion when route requires it |
| Optional multi-shot storyboard | storyboard | exclude | exclusion accepted |
| Optional dialogue audio | dialogue audio | exclude | exclusion accepted |
| Dialogue audio required by future route | dialogue audio | exclude | validation rejects exclusion and reports required audio reference |

#### UI Report And Generation Consistency Matrix

For every case above, assert this invariant:

| UI report state | Dependency inventory state | Final prepared input state | Provider payload state |
| --- | --- | --- | --- |
| included and available | active dependency | input present | payload present when route supports media kind |
| included but unavailable | active dependency with issue | input absent | payload absent with diagnostic |
| excluded | inactive dependency | input absent | payload absent |
| unsupported by route | dependency choice visible with limitation | input may be prepared but blocked before unsupported payload use | payload absent with diagnostic |

This invariant is the main guard against the bug class where a reference appears
selected in the Studio UI but does not actually reach generation, or reaches
generation while the UI shows it as excluded.

### Engine Tests

Add tests for:

- route metadata accepting optional audio reference inputs where supported;
- provider payload creation including audio URI arrays;
- provider payload creation deduplicating repeated dialogue audio inputs;
- selected dialogue audio producing a clear unsupported-route diagnostic when
  the selected route has no audio slot.

### Studio Server Tests

Add tests for:

- group reference inclusion route validation;
- applying inclusion to every shot in the group;
- rejecting shot ids outside the scene;
- rejecting malformed dependency ids;
- cache-friendly response shape.

### Studio UI Tests

Add tests for:

- the **Dialogs** tab appears between **Motion** and **References**;
- `?shotTab=dialogs` opens the new tab;
- cards render picked take label, date, profile image, playback slider, and
  dialogue text;
- cards do not render Pick or Delete actions;
- cards with one total take do not open the take-management dialog;
- cards with zero total takes do not open the take-management dialog;
- clicking the non-control card surface opens the take-management dialog only
  when the dialogue has more than one take;
- clicking play/pause does not open the take-management dialog;
- scrubbing the playback slider does not open the take-management dialog;
- clicking the selected/unselected control does not open the take-management
  dialog;
- the take-management dialog renders all takes for the dialogue;
- the take-management dialog renders the Pick button and `PICKED` badge in the
  same style as the existing Takes panel;
- changing the picked take from the dialog updates the compact card after query
  invalidation;
- changing the picked take from the Narrative tab updates the compact card after
  query invalidation;
- selection and unselection call the group-aware inclusion service for
  multi-shot groups;
- unavailable cards cannot be selected;
- existing References tab behavior still works after the union policy changes.

### Manual Desktop Verification

Run the Studio app and verify on the existing desktop scene route:

`/projects/urban-basilica/scenes/scene_djkfgf9p?sceneTab=shots`

Check:

- tab order and tab styling;
- one-column and two-column card behavior by resizing the desktop panel;
- playback starts, seeks, and stops cleanly;
- selection updates card state and production-plan data;
- multi-shot generation preview includes the union of selected visual and audio
  references;
- model routes without audio support report the limitation clearly.

Do not perform mobile viewport verification unless specifically requested.

## Documentation Work

Update accepted documentation only if the implementation changes public
architecture.

Likely documentation updates:

- `docs/architecture/media-generation.md` if audio references become a standard
  shot-video dependency type;
- `docs/architecture/data-model-and-storage.md` if `scene-dialogue` becomes a
  documented shot-video input subject kind;
- `docs/architecture/front-end-guidelines.md` only if the new tab introduces a
  reusable pattern worth documenting.

No ADR is required unless implementation needs a larger route support decision,
such as declaring which model families officially support audio reference input.

## Completion Checklist

### Review Area

- [x] Confirm the implementation uses the existing production-plan and
      dependency graph instead of a parallel selection model.
- [x] Confirm the visible tab is named **Dialogs** and internal contracts use
      deliberate dialogue-audio domain names.
- [x] Confirm no raw interactive HTML controls are added in feature code.
- [x] Confirm no compatibility shim, alias, or re-export facade is introduced.
- [x] Confirm no filenames, raw ids, or generated role labels are surfaced on
      cards as filler text.
- [x] Confirm desktop behavior is verified and mobile behavior is not reported
      unless explicitly requested.

### Architecture And Contracts

- [x] Add `scene-dialogue` as the subject kind for dialogue audio shot-video
      references.
- [x] Add a stable dependency id helper for scene dialogue audio references.
- [x] Add typed production-plan report data for dialogue audio reference cards.
- [x] Map shot dialogue block references to scene dialogue ids through the
      screenplay scene.
- [x] Add structured diagnostics for invalid dialogue references.
- [x] Add structured diagnostics for missing picked dialogue audio takes.
- [x] Add structured diagnostics for multiple picked takes on the same dialogue.
- [x] Add structured diagnostics for missing dialogue audio asset files.
- [x] Add structured diagnostics for routes that cannot accept selected audio
      references.
- [x] Confirm no SQL migration is needed, or follow Drizzle Kit workflow before
      changing schema.

### Core Implementation

- [x] Extend shot-video production context with dialogue audio reference data.
- [x] Extend production-plan report building with dialogue audio choices.
- [x] Add picked dialogue audio takes as derived prepared audio inputs.
- [x] Resolve dialogue audio prepared inputs from the current picked take at
      production-plan and generation-request time.
- [x] Keep dialogue reference selections keyed by dialogue id when the picked
      take changes.
- [x] Snapshot the picked take asset file when a generation request is created.
- [x] Add `reference-audio` dependency slots for dialogue audio choices.
- [x] Make prepared input matching media-kind aware.
- [x] Include audio prepared inputs in reference inclusion filtering.
- [x] Deduplicate dialogue audio prepared inputs by dialogue id and file id.
- [x] Ensure final generation specs include selected audio references.
- [x] Ensure final pricing/dependency reporting includes audio references where
      relevant.

### Multi-Shot Reference Union

- [x] Define the multi-shot group inclusion policy in a named function.
- [x] Replace first-non-null override behavior where it affects group
      generation.
- [x] Implement the candidate collection matrix for visual and dialogue
      references.
- [x] Implement the inclusion override matrix for every reference family.
- [x] Implement the availability matrix for visual and dialogue references.
- [x] Implement the deduplication matrix for repeated dependencies and repeated
      files.
- [x] Implement the required-reference matrix for required and optional
      references.
- [x] Assert UI report, dependency inventory, prepared inputs, and provider
      payloads remain consistent for every matrix case.
- [x] Verify cast character sheet references union across grouped shots.
- [x] Verify location sheet and view references union across grouped shots.
- [x] Verify lookbook sheet references union across grouped shots or document
      and validate a single-lookbook constraint.
- [x] Verify general reference images union across grouped shots.
- [x] Verify first frame, last frame, and multi-shot storyboard references still
      behave correctly.
- [x] Verify dialogue audio references union across grouped shots.
- [x] Verify the References tab displays the same effective state that
      generation uses.

### Engine And Provider Implementation

- [x] Add optional audio reference route slots only for supported model routes.
- [x] Map selected dialogue audio inputs to provider audio URI array fields.
- [x] Deduplicate provider audio input URLs.
- [x] Keep unsupported routes fail-fast and diagnostic-driven.
- [x] Update file-input and provider payload tests for audio references.

### Studio Server And Services

- [x] Add a group-aware reference inclusion route.
- [x] Validate project, scene, and shot ids for group updates.
- [x] Validate dependency ids through the current production plan where
      practical.
- [x] Apply group inclusion updates to every shot in the production group.
- [x] Add Studio service methods for group selection and unselection.
- [x] Invalidate or refresh shot-video production queries after updates.
- [x] Invalidate shot-video production queries when a scene dialogue audio pick
      changes.

### Studio UI

- [x] Add `dialogs` to `SceneShotDetailTab` and URL query parsing.
- [x] Insert the **Dialogs** tab between **Motion** and **References**.
- [x] Add `SceneShotDialogsTab`.
- [x] Add dialogue audio reference card/grid components.
- [x] Add `SceneShotDialogueAudioTakesDialog`.
- [x] Reuse or extract the existing dialogue audio take-card presentation for
      the dialog contents.
- [x] Ensure compact card body clicks open the take-management dialog only when
      `takeCount > 1`.
- [x] Ensure compact cards with `takeCount <= 1` do not render an open-dialog
      affordance.
- [x] Ensure play, scrub, and select controls do not open the take-management
      dialog.
- [x] Reuse the existing References selection control style.
- [x] Reuse existing dialogue audio playback behavior.
- [x] Render profile image, take label, date, slider, and dialogue text.
- [x] Omit Pick and Delete actions from compact dialogue reference cards.
- [x] Show Pick and `PICKED` state inside the take-management dialog.
- [x] Render unavailable states for missing picked takes.
- [x] Render unavailable states for ambiguous multiple-picked-take state.
- [x] Refresh the visible take label, date, playback URL, and slider after a
      picked take changes.
- [x] Keep layout consistent with the existing dark Studio shot-detail UI.

### Tests

- [x] Add core unit tests for dialogue reference resolution.
- [x] Add core unit tests for picked take input preparation.
- [x] Add core unit tests for pick-change lifecycle and request snapshot
      behavior.
- [x] Add core unit tests for missing dialogue/take/file diagnostics.
- [x] Add core unit tests for ambiguous multiple-picked-take diagnostics.
- [x] Add table-driven core unit tests for the full multi-shot visual reference
      union matrix.
- [x] Add table-driven core unit tests for the full multi-shot dialogue audio
      union matrix.
- [x] Add consistency assertions that compare production-plan UI state,
      dependency inventory state, prepared input state, and provider payload
      state.
- [x] Add engine tests for audio route slots and provider payloads.
- [x] Add Studio server tests for group reference inclusion.
- [x] Add Studio UI tests for tab order, card rendering, playback controls, and
      selection behavior.
- [x] Add Studio UI tests for take-management dialog availability at
      `takeCount > 1`, no dialog availability at `takeCount <= 1`, non-opening
      controls, all-takes rendering, and pick changes.
- [x] Update or add regression tests for the existing References tab multi-shot
      generation path.

### Documentation And Verification

- [x] Update media-generation documentation if audio references become an
      accepted dependency type.
- [x] Update data model documentation if `scene-dialogue` becomes a public
      shot-video input subject kind.
- [x] Run focused package tests for touched packages.
- [x] Run `pnpm check` before final handoff if the implementation scope touches
      multiple packages.
- [x] Run the Studio app and verify the desktop UI in the browser.
- [x] Verify a multi-shot generation request receives the union of selected
      visual references.
- [x] Verify a multi-shot generation request receives the union of selected
      dialogue audio references when the route supports audio.
- [x] Verify unsupported routes report a clear limitation instead of silently
      dropping selected dialogue audio.
