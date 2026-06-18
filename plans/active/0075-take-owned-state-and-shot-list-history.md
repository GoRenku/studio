# 0075 Take-Owned State And Shot List History

Status: proposed
Date: 2026-06-18

## Summary

The current take model is product-wrong and architecturally muddy.

Plans `0072` and `0073` correctly moved shot grouping toward take ownership, but
they left most of the actual editable shot-production state inside the active
Scene Shot List. That creates the wrong user model:

- two takes over the same shot cannot safely have different composition,
  motion, cast, location, reference, dialogue, prompt, model, and input choices;
- editing a tab in one take silently edits the active shot list and therefore
  affects other takes;
- changing the active shot list can make a take `view-only`, even though the
  product expectation is that old takes remain editable against the shot list,
  storyboard images, and assets they were created with;
- "input" currently means too many different things: tab selections, reference
  picks, generated media artifacts, provider inputs, and final video inputs.

This plan corrects the ownership model:

- Scene Shot Lists own ordered shot coverage history and the storyboard images
  for each shot-list version.
- Shot Video Takes own the selected shot ids plus every editable tab value and
  every concrete reference/media selection used to produce that take.
- Generated/imported video outputs are candidates under a Shot Video Take, not
  the take-state owner itself.
- Asset records for storyboard images, character sheets, location sheets,
  Lookbook sheets, dialogue audio, and take media inputs are retained unless an
  explicit future prune/garbage-collection workflow removes unused history.
- Existing projects, especially
  `/Users/keremk/renku-movies/urban-basilica`, must be migrated instead of
  being reset.

This plan supersedes the ownership statement in `0072` that Scene Shot Lists
own shot design fields. Scene Shot Lists may provide initial shot coverage and
seed suggestions, but the editable values controlled in the Studio take tabs
belong to the take.

## Product Model

### Scene Shot List

A Scene Shot List is the scene's current coverage plan.

It owns:

- scene id;
- shot-list id;
- ordered shot ids;
- shot titles and narrative coverage intent;
- story beat, narrative purpose, description, subject, action, covered
  screenplay blocks, and baseline dialogue references;
- the complete historical shot-list document for that version;
- per-shot storyboard image links for that exact shot-list version.

It does not own:

- Composition tab values;
- Motion tab values;
- selected cast references for a take;
- selected location references for a take;
- selected character sheet assets for a take;
- selected location sheet assets or azimuth views for a take;
- selected Lookbook sheet assets for a take;
- reference include/exclude overrides for a take;
- selected dialogue audio takes for a take;
- AI Production input mode, model, parameters, prompts, or generated input
  choices for a take.

### Shot Video Take

A Shot Video Take is the editable take workspace.

It owns:

- scene id;
- source shot-list id;
- ordered shot ids selected for this take;
- per-shot Composition tab state;
- per-shot Motion tab state;
- per-shot Cast tab state;
- per-shot Location tab state;
- per-shot Reference tab state;
- per-shot Dialogue tab state;
- group-level reference include/exclude overrides;
- AI Production setup;
- generated prompt drafts and accepted prompt text;
- selected or generated media inputs;
- generated/imported video output candidates;
- selected output candidate, if any.

The take is editable by default as long as the take row can be loaded, its
state JSON validates, the project schema is supported, and the project is
writable. Changing the scene's active shot list must not lock the take.

When a referenced asset is missing, the take should stay editable and report a
structured readiness issue such as "selected character sheet asset no longer
exists." The user can then replace that reference. Missing dependencies should
not become a broad `view-only` lock.

### Shot Video Take Output

A Shot Video Take Output is a generated or imported video candidate under one
Shot Video Take.

It owns:

- take id;
- output asset id;
- output asset file id;
- optional media generation run id;
- ordered shot ids captured at output creation time;
- selected state;
- created and updated timestamps.

The output-time shot ids are still stored even though the parent take owns the
current editable shot membership. This preserves what a rendered output meant
when it was created.

## Take State Status Model

The old compatibility model mixed several different questions into one
`editable` versus `view-only` state. The new model separates them.

### Editable

Editable answers:

> Can the user open this take and change its take-owned state?

The answer should be yes unless one of these exceptional states applies:

- the take row no longer exists;
- the take state JSON is corrupt and cannot be repaired or migrated;
- the project database is on an unsupported schema version;
- the project or project database is opened read-only;
- a future explicit archive/prune workflow has intentionally frozen or removed
  the take.

Normal creative/history changes must not make a take non-editable.

These must not lock editing:

- active shot-list changes;
- regenerated shot lists;
- screenplay scene revisions;
- storyboard image changes;
- new character sheets, location sheets, Lookbook sheets, or dialogue audio
  takes;
- provider model catalog changes;
- missing or stale generated media inputs;
- prompt drafts based on older context.

### Resolvable

Resolvable answers:

> Do the take's concrete ids still resolve to database rows and files?

A take can be editable but not fully resolvable. Missing assets, missing asset
files, deleted dialogue audio takes, deleted storyboard images, or deleted
source shot-list rows should become structured readiness diagnostics. The user
should be able to clear, replace, or regenerate those references from the take
editor.

### Runnable

Runnable answers:

> Can the current take state create and run a valid shot-video generation plan?

A take can be editable and resolvable but not runnable. Examples:

- the selected model no longer supports the selected input mode;
- a required first frame, last frame, reference image, source video, or audio
  reference is missing;
- selected parameters are invalid for the selected model route;
- required generated dependencies have not been created yet;
- the accepted prompt or generated prompt draft needs regeneration.

Runnable failures should block generation, not editing.

### Archived Or Pruned

Archived or pruned answers:

> Has the user explicitly removed this take from normal editing history?

This is a future workflow. It must be explicit, reversible where practical, and
must not be confused with normal shot-list, screenplay, storyboard, or asset
iteration.

## Confirmed Current Behavior

The current database already retains old shot-list rows.

Current tables:

- `scene_shot_list` stores each shot-list document.
- `scene_shot_list_state.active_shot_list_id` points to the active row.
- Setting a different active shot list moves the pointer instead of replacing
  older rows.

The current operation-based shot-list workflow already creates a new shot-list
row for structural edits and can carry forward storyboard image rows for
unchanged shots.

Current storyboard storage:

- `scene_shot_storyboard_image.scene_id`
- `scene_shot_storyboard_image.shot_list_id`
- `scene_shot_storyboard_image.shot_id`
- `scene_shot_storyboard_image.asset_id`
- `scene_shot_storyboard_image.asset_file_id`
- `scene_shot_storyboard_image.shot_content_fingerprint`

This means storyboard links do not need to live inside the shot-list JSON. The
table is the durable link between a shot-list version and its per-shot images.
The read model should expose those links as part of the shot-list projection.

The major bug is that Studio tab edits currently call
`updateSceneShotListRecordDocument`, mutating the active shot-list document in
place. That is acceptable for neither history nor take ownership.

Examples of current global state that must move:

- `SceneShot.shotSpecs.shotSize`
- `SceneShot.shotSpecs.subjectFraming`
- `SceneShot.shotSpecs.cameraAngle`
- `SceneShot.shotSpecs.movement`
- `SceneShot.shotSpecs.lens`
- `SceneShot.shotSpecs.location`
- `SceneShot.shotSpecs.castReferences`
- `SceneShot.shotSpecs.lookbookReference`
- `SceneShot.shotSpecs.referenceImages`
- `SceneShot.shotSpecs.referenceInclusions`
- `SceneShot.shotSpecs.custom`

## Current `urban-basilica` Snapshot

The project database inspected at:

```text
/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite
```

Current counts:

- 3 `scene_shot_list` rows.
- 2 active scene shot lists.
- 15 `scene_shot_storyboard_image` rows.
- 9 `scene_shot_video_take_generation` rows.
- 14 `scene_shot_video_take_generation_shot` rows.
- 0 `scene_shot_video_take_input` rows.
- 0 final `scene_shot_video_take` output rows.
- 36 assets.
- 55 asset files.
- 31 media generation specs.
- 28 media generation runs.

Important migration facts:

- The project does not yet have the new
  `scene_shot_video_take_input_shot` table from migration `0029`, so its
  migration must first bring the DB to the latest baseline.
- `scene_shot_list_whqccbvq` has 8 shots and 4 shots with `shotSpecs`.
- `scene_shot_list_v9ypc3fy` has 7 shots and 1 shot with `shotSpecs`.
- Existing take generations cover single-shot and multi-shot groups.
- There are no take media inputs or final video outputs to salvage in this
  project, so the project-specific migration risk is mostly around moving
  `shotSpecs` and `production_json` into the new take-owned state.

## Naming Decision

Use these public domain names after this plan lands:

- `SceneShotList`: the ordered coverage plan for one scene.
- `SceneShotStoryboardImage`: a per-shot storyboard image attached to a specific
  shot-list version.
- `SceneShotVideoTake`: the editable take workspace.
- `SceneShotVideoTakeOutput`: a generated/imported video candidate under a take.
- `SceneShotVideoTakeMediaInput`: a generated/imported media artifact used as an
  input by a take.

Rename the current concepts directly:

- current `SceneShotVideoTakeGeneration` becomes `SceneShotVideoTake`;
- current final-output `SceneShotVideoTake` becomes
  `SceneShotVideoTakeOutput`;
- current `scene_shot_video_take_input` becomes
  `scene_shot_video_take_media_input`.

Do not keep aliases, compatibility wrappers, or re-export shims. This is
pre-customer software, and the old names are part of the confusion.

## Target Data Model

### `scene_shot_video_take`

This table owns the editable take workspace.

Columns:

```text
id text primary key
scene_id text not null references scene(id)
source_shot_list_id text not null references scene_shot_list(id)
title text not null
state_json text not null
created_at text not null
updated_at text not null
```

Use `source_shot_list_id`, not `active_shot_list_id`, because the take must
resolve against the shot-list version it was created from.

### `scene_shot_video_take_shot`

This table stores the take's ordered shot membership.

Columns:

```text
take_id text not null references scene_shot_video_take(id) on delete cascade
shot_id text not null
shot_order integer not null
storyboard_image_id text references scene_shot_storyboard_image(id)
storyboard_asset_file_id text references asset_file(id)
shot_content_fingerprint text not null
storyboard_content_fingerprint text not null
```

The snapshot columns are retained for audit/readiness reporting. They no longer
make the take view-only when the active shot list changes.

### `scene_shot_video_take_media_input`

This table stores concrete reusable media artifacts used by the take.

Columns:

```text
id text primary key
scene_id text not null references scene(id)
take_id text not null references scene_shot_video_take(id) on delete cascade
input_kind text not null
subject_kind text not null
subject_id text not null
asset_id text not null references asset(id)
asset_file_id text not null references asset_file(id)
media_generation_run_id text references media_generation_run(id) on delete set null
selection text not null
created_at text not null
updated_at text not null
```

### `scene_shot_video_take_media_input_shot`

This table stores durable shot membership for each media input.

Columns:

```text
input_id text not null references scene_shot_video_take_media_input(id) on delete cascade
shot_id text not null
shot_order integer not null
```

### `scene_shot_video_take_output`

This table stores generated/imported video candidates.

Columns:

```text
id text primary key
scene_id text not null references scene(id)
take_id text not null references scene_shot_video_take(id) on delete cascade
asset_id text not null references asset(id)
asset_file_id text not null references asset_file(id)
media_generation_run_id text references media_generation_run(id) on delete set null
is_selected integer not null
created_at text not null
updated_at text not null
```

### `scene_shot_video_take_output_shot`

This table stores the output-time ordered shot ids.

Columns:

```text
output_id text not null references scene_shot_video_take_output(id) on delete cascade
shot_id text not null
shot_order integer not null
```

## Unified Take State JSON

`scene_shot_video_take.state_json` is the single validated owner for editable
take state.

Initial public contract:

```ts
interface SceneShotVideoTakeState {
  version: 1;
  shotDesignByShotId: Record<string, SceneShotVideoTakeShotDesign>;
  referenceSelections: SceneShotVideoTakeReferenceSelections;
  production: SceneShotVideoTakeProductionState;
  promptState?: SceneShotVideoTakePromptState;
}
```

### Shot Design State

```ts
interface SceneShotVideoTakeShotDesign {
  composition?: {
    shotSize?: ShotSizeId;
    subjectFraming?: SubjectFramingId[];
    cameraAngle?: CameraAngleId;
    dutch?: 'left' | 'right';
    lens?: ShotLensSpecs;
    customComposition?: string;
  };
  motion?: {
    movement?: ShotMovementId;
    secondary?: ShotMovementId;
    directions?: MoveDirectionId[];
    track?: MoveTrackId;
    rig?: RigId;
    customMotion?: string;
  };
  cast?: {
    castMemberIds?: string[];
    characterSheetAssetIds?: Record<string, string>;
  };
  location?: {
    locationId?: string;
    environmentSheetAssetId?: string;
    viewIds?: LocationAzimuthViewId[];
  };
  lookbook?: {
    lookbookId?: string;
    lookbookSheetId?: string;
  };
  referenceImages?: {
    customMediaInputIds?: string[];
  };
  dialogue?: {
    dialogueId: string;
    inclusion: 'include' | 'exclude';
    sceneDialogueAudioTakeId?: string;
    assetId?: string;
    assetFileId?: string;
  }[];
}
```

The implementation must keep these public names and may only introduce smaller
private helper types when they make the validator or access code easier to read.
Do not reintroduce a generic `ShotSpecs` bag on `SceneShot`.

### Reference Selection State

```ts
interface SceneShotVideoTakeReferenceSelections {
  dependencyInclusions: Record<string, 'include' | 'exclude'>;
  selectedCharacterSheetAssetIds: Record<string, string>;
  selectedLocationSheetAssetIds: Record<string, string>;
  selectedLocationViewIds: Record<string, LocationAzimuthViewId[]>;
  selectedLookbookSheetIds: string[];
  selectedDialogueAudioTakeIds: Record<string, string>;
}
```

This state stores selected concrete asset or take ids. It must not resolve to
"the current selected character sheet" or "the current picked dialogue audio"
at generation time unless the user explicitly chooses that behavior.

### Production State

```ts
interface SceneShotVideoTakeProductionState {
  inputModeId?: ShotVideoTakeInputModeId;
  modelChoice?: ShotVideoTakeModelChoice;
  parameterValues?: ShotVideoTakeParameterValues;
  requestedInputs?: ShotVideoTakeRequestedInput[];
  preparedInputs?: ShotVideoTakePreparedInput[];
  agentProposal?: ShotVideoTakeAgentProposal;
  customPromptNote?: string;
}
```

This is the current `production_json` content moved under the unified take
state.

### Prompt State

```ts
interface SceneShotVideoTakePromptState {
  generatedPromptDraft?: ShotVideoTakePromptDraft;
  acceptedPrompt?: ShotVideoTakePromptDraft;
  lastGeneratedFrom?: {
    inputModeId?: ShotVideoTakeInputModeId;
    modelChoice?: ShotVideoTakeModelChoice;
    shotIds: string[];
    dependencyIds: string[];
  };
}
```

Prompt drafts must be owned by the take. They must not be inferred from active
shot-list state after they have been generated.

## Shot List And Storyboard History Rules

Structural shot-list changes must create a complete new shot-list row.

Examples:

- regenerate full shot list;
- expand one shot into several shots;
- add a shot;
- remove a shot;
- replace shots 2-4;
- revise a shot's narrative coverage.

The newly created row becomes active when the operation says to activate it.
Older shot-list rows remain in history.

Storyboard image rules:

- storyboard images are attached to `scene_shot_storyboard_image` rows;
- each row belongs to one `scene_id`, one `shot_list_id`, and one `shot_id`;
- applying operations should carry forward storyboard rows for unchanged shots;
- importing generated storyboard images should create new asset and asset-file
  rows instead of replacing old ones;
- old storyboard rows and files must remain because old shot lists and old takes
  may still reference them;
- deleting or pruning old storyboard image assets is out of scope for this
  plan.

`writeSceneShotList` currently writes a full new shot-list row and activates it.
That behavior can remain for full replacement. Operation-based editing should
remain the preferred path for expand/contract edits because it can carry
storyboard images forward for unchanged shots.

Direct UI edits must not call `updateSceneShotListRecordDocument` for take tab
values after this plan lands.

## Asset Retention Rules

The take can remain fully resolvable and runnable only if its referenced assets are retained.

Therefore:

- generating a new character sheet creates a new asset;
- importing a new character sheet creates a new asset;
- generating a new location environment sheet creates a new asset;
- generating a new Lookbook sheet creates a new asset;
- generating a new dialogue audio take creates a new audio take row and asset;
- generating a take media input creates a new take media input row and asset;
- selecting a different asset changes only the take state or selected
  relationship, not the historical asset row.

Retention means both metadata and bytes:

- the `asset` row must remain;
- every referenced `asset_file` row must remain;
- the project-relative file path stored by each `asset_file` row must continue
  to exist on disk;
- importing or generating a new reference must allocate a new asset id and a
  non-conflicting project-relative file path;
- take media imports must copy or move files into a durable take-owned project
  path instead of merely registering a temporary or generated source path;
- no take-owned mutation may overwrite an existing file path used by another
  asset file.

Current code paths that must be fixed or guarded:

- `deleteAsset` deletes asset rows and calls `fs.rm` for the asset files;
- Lookbook delete commands delete Lookbook image/sheet asset rows and files;
- Cast Voice removal deletes its sample asset rows and files;
- shot-video take input deletion deletes the registered project-relative file,
  then deletes the asset rows;
- current shot-video take media import registers the source path directly
  instead of copying to a durable allocated destination.

Deletion behavior must be audited before implementation:

- deleting an asset referenced by any take should fail with a structured
  diagnostic unless the user explicitly uses a future prune command;
- deleting a shot-list row should fail if any take references it;
- deleting storyboard image assets should fail if any shot-list or take
  references them;
- deleting a take media input should archive or unselect it unless no take state,
  generation plan, prompt draft, output, or history record references it;
- pruning old shot lists, storyboard images, and unused reference assets is a
  future feature and not part of this plan.

## Read Model

Add one Core-owned read model for the take editor:

```ts
interface SceneShotVideoTakeEditContext {
  take: SceneShotVideoTake;
  sourceShotList: SceneShotListSummary;
  sourceShots: SceneShotVideoTakeSourceShot[];
  storyboardImages: SceneShotVideoTakeStoryboardImage[];
  state: SceneShotVideoTakeState;
  mediaInputs: SceneShotVideoTakeMediaInput[];
  outputs: SceneShotVideoTakeOutput[];
  assetReadiness: SceneShotVideoTakeAssetReadiness;
  generationPlan?: ShotVideoTakeGenerationPlan;
  resourceKeys: string[];
}
```

The read model is the only object the Studio take editor should need to
reconstruct all tabs.

It must clearly separate:

- source shot-list fields;
- take-owned editable fields;
- retained media inputs;
- generated output candidates;
- derived generation plan;
- structured readiness diagnostics.

Studio should not rebuild take state by independently joining active shot list,
production JSON, reference sections, available inputs, and model reports.

## Write Model

Add take-owned mutation APIs in Core.

Required operations:

- create a take from active shot-list shot ids;
- create a take from an explicit source shot-list id and shot ids;
- update take shot membership;
- update take Composition state for one shot;
- update take Motion state for one shot;
- update take Cast state for one shot;
- update take Location state for one shot;
- update take Lookbook state for one shot;
- update take reference include/exclude state;
- update take dialogue audio selections;
- update take AI Production setup;
- select or clear a take media input;
- import or generate a take media input;
- create a take output spec;
- import or generate a take output;
- select or clear a take output.

Each operation must validate:

- take exists;
- route scene id matches take scene id;
- source shot-list id belongs to take scene;
- shot ids exist in the take's source shot list;
- take-controlled shot ids are contiguous when the video route requires
  contiguity;
- referenced assets exist;
- referenced assets belong to the referenced cast member, location, Lookbook,
  dialogue audio row, or take media input owner;
- referenced asset files exist and match expected media kind;
- no mutation writes to the active shot-list document for take tab state.

## Studio UI Rules

The Studio scene surfaces should resolve state as follows:

- `Shots` tab shows the active Scene Shot List as coverage and storyboard
  review.
- `Takes` tab lists and opens Shot Video Takes.
- Editing Composition, Motion, Location, Cast, References, Dialogs, and AI
  Production requires an open take.
- If the user starts editing from a shot card without an open take, Studio must
  create or choose a take explicitly before saving tab state.
- The open take id must be part of current focus.
- Agents reading current focus must receive scene id, source shot-list id, take
  id, and full take shot ids.

The UI must not show a broad `view-only` lock because the active shot list
changed. Instead, it can show readiness warnings when old source/storyboard or
asset references are missing.

No mobile-specific work is required.

## CLI And Agent Contracts

CLI and skills must address take-owned editing through take ids or
production-facing scene/shot/take references once those are available.

Initial commands should expose:

```bash
renku take list --scene <scene-id> --json
renku take show --take <take-id> --json
renku take create --scene <scene-id> --shot-list <shot-list-id> --shots <ids> --json
renku take update --take <take-id> --file <take-state-patch-json> --json
renku generation context --purpose shot.video-take --take <take-id> --json
renku generation plan --purpose shot.video-take --take <take-id> --json
```

These command names are the planned public CLI surface for this implementation
slice. Do not add compatibility command names for the old take-generation
contract.

Skills must stop instructing agents to mutate Scene Shot List `shotSpecs` for
take-tab edits.

## Migration Strategy

Follow the Drizzle Kit workflow documented in
`docs/architecture/drizzle-migrations.md`.

The migration must be explicit and tested. Do not hand-write a TypeScript
migration registry.

### General Migration

1. Generate new schema tables with Drizzle Kit.
2. Add any required custom SQL only after documenting why Drizzle cannot express
   the data transformation.
3. Rename or recreate current take-generation tables into the new take table.
4. Preserve existing ids where possible to reduce route and resource churn
   during the migration.
5. Copy current `scene_shot_video_take_generation.production_json` into
   `state_json.production`.
6. Copy current take-generation shot membership into
   `scene_shot_video_take_shot`.
7. For every selected shot in each existing take generation, copy the current
   source shot-list `shotSpecs` into `state_json.shotDesignByShotId`.
8. Copy reference inclusions from `shotSpecs.referenceInclusions` into
   `state_json.referenceSelections.dependencyInclusions`.
9. Copy character sheet, location sheet, Lookbook sheet, and custom reference
   selections from `shotSpecs` into the take state.
10. Resolve selected dialogue audio references to concrete
    `scene_dialogue_audio_take` ids and asset/file ids when possible.
11. Copy current take media input rows into
    `scene_shot_video_take_media_input`.
12. Copy current take media input shot membership into
    `scene_shot_video_take_media_input_shot`.
13. Copy current final video rows into `scene_shot_video_take_output`.
14. Copy current final video shot membership into
    `scene_shot_video_take_output_shot`.
15. For any active shot-list shot that has `shotSpecs` but no take contains
    that shot, create a single-shot migrated take so the user does not lose tab
    selections.
16. Remove `shotSpecs` from `scene_shot_list.document` after all take state has
    been created.
17. Replace old compatibility snapshot edit-lock behavior with editable,
    resolvable, runnable, and archived/pruned status reporting.
18. Replace old public types, route names, and tests directly.

### `urban-basilica` Migration

Project path:

```text
/Users/keremk/renku-movies/urban-basilica
```

Required migration order:

1. Create a fresh timestamped backup of `.renku/project.sqlite`.
2. Apply the current baseline migrations first, including the migration that
   adds durable media-input shot membership.
3. Apply the new take-owned-state migration.
4. Migrate the 9 current take generations into 9
   `SceneShotVideoTake` rows.
5. Migrate the 14 current take-generation shot membership rows into
   `scene_shot_video_take_shot`.
6. Copy the 5 existing `shotSpecs` entries into the relevant take state:
   - 4 from `scene_shot_list_whqccbvq`;
   - 1 from `scene_shot_list_v9ypc3fy`.
7. Preserve all 15 storyboard image rows.
8. Preserve all 36 asset rows and 55 asset-file rows.
9. Preserve both dialogue audio takes and store concrete selected audio take ids
   in migrated take state when referenced.
10. Verify that no take media inputs or final video outputs were expected,
    because the current project has zero rows in both old tables.
11. Strip `shotSpecs` from the shot-list JSON documents after migration.
12. Run a project validation command that reports:
    - every take resolves its source shot list;
    - every take shot id exists in that source shot list;
    - every take storyboard reference resolves or reports a structured warning;
    - every character sheet asset reference resolves;
    - every location sheet asset reference resolves;
    - every Lookbook sheet reference resolves;
    - every selected dialogue audio take resolves;
    - every take can open in the take edit context.

## Validation And Test Strategy

Core tests:

- creating two takes for the same shot allows different composition values;
- editing one take's Composition tab does not mutate another take;
- editing one take's Motion tab does not mutate the Scene Shot List;
- changing the active shot list does not make existing takes view-only;
- missing referenced assets do not make a take view-only;
- missing referenced assets produce resolvable/readiness diagnostics and block
  generation only when required by the plan;
- a take still opens against its source shot-list id after a new active shot
  list is created;
- old storyboard images resolve through source shot-list id and shot id;
- carried-forward storyboard image rows remain valid for unchanged shots;
- selected character sheet assets resolve by concrete asset id, not by current
  cast selection;
- selected location environment sheet views resolve by concrete asset/file ids;
- selected Lookbook sheet resolves by concrete sheet id;
- selected dialogue audio resolves by concrete audio take id;
- deleting an asset referenced by a take fails with a structured diagnostic;
- deleting a source shot-list referenced by a take fails with a structured
  diagnostic;
- media input shot membership is preserved independently of current take shot
  membership;
- output shot membership is preserved independently of current take shot
  membership.

Studio server tests:

- take edit context route returns the unified read model;
- take tab edit routes reject scene/take mismatches;
- Composition, Motion, Location, Cast, Reference, Dialogue, and Production
  routes mutate take state, not shot-list JSON;
- active shot-list changes do not lock take edit routes.

Studio UI tests:

- opening a take hydrates all tabs from take state;
- two takes over the same shot show different tab selections;
- saving one tab updates the open take only;
- current focus includes take id, source shot-list id, and all take shot ids;
- readiness warnings render for missing referenced assets without disabling the
  whole editor.

Migration tests:

- migrate a fixture with old take generations, shot specs, media inputs, and
  final outputs;
- migrate a fixture where one shot has `shotSpecs` but no take and confirm a
  single-shot migrated take is created;
- migrate a fixture with dialogue audio reference inclusions and confirm
  concrete audio take ids are stored;
- migrate a fixture with old storyboard rows and confirm they remain attached
  to the original shot-list id;
- validate the current `urban-basilica` database after migration.

## Completion Checklist

### Product Review

- [ ] Confirm that every Studio take tab value belongs to a take, not to the
      global Scene Shot List.
- [ ] Confirm that Scene Shot Lists remain the full ordered shot coverage
      history for a scene.
- [ ] Confirm that old takes should remain editable after active shot-list
      changes.
- [ ] Confirm that normal creative/history changes never make a take view-only.
- [ ] Confirm that missing referenced assets should produce readiness
      diagnostics instead of a broad view-only lock.
- [ ] Confirm that pruning old shot lists, storyboard images, and unused assets
      is out of scope for this implementation slice.

### Architecture And Naming

- [ ] Replace `SceneShotVideoTakeGeneration` with `SceneShotVideoTake` as the
      editable workspace concept.
- [ ] Replace current final-output `SceneShotVideoTake` with
      `SceneShotVideoTakeOutput`.
- [ ] Replace `ShotVideoTakeAvailableInput` naming with media-input-specific
      names where the object represents a concrete media artifact.
- [ ] Remove `ShotSpecs` from the public `SceneShot` contract.
- [ ] Add `SceneShotVideoTakeState` and focused subtypes for Composition,
      Motion, Cast, Location, Lookbook, References, Dialogue, Production, and
      Prompt state.
- [ ] Add `SceneShotVideoTakeEditContext` as the only read model used by the
      Studio take editor.
- [ ] Update domain vocabulary and media-generation architecture docs.

### Database And Migrations

- [ ] Update Drizzle schema for the new take, media input, and output tables.
- [ ] Generate migrations with Drizzle Kit.
- [ ] Add documented custom SQL for data migration where required.
- [ ] Preserve existing take-generation ids as take ids where possible.
- [ ] Migrate old production JSON into `state_json.production`.
- [ ] Migrate old `shotSpecs` into `state_json.shotDesignByShotId`.
- [ ] Migrate old reference selections into `state_json.referenceSelections`.
- [ ] Migrate old take media inputs and their shot memberships.
- [ ] Migrate old final video outputs and their shot memberships.
- [ ] Strip `shotSpecs` from shot-list JSON documents.
- [ ] Add foreign-key or delete-guard coverage so referenced assets and source
      shot lists cannot be silently removed.
- [ ] Add filesystem retention checks so referenced asset-file paths still exist
      after migration and after every relevant delete/import command.

### Core Implementation

- [ ] Add take creation from active shot list and explicit source shot list.
- [ ] Add take-owned shot membership updates.
- [ ] Add take-owned Composition mutation.
- [ ] Add take-owned Motion mutation.
- [ ] Add take-owned Cast mutation.
- [ ] Add take-owned Location mutation.
- [ ] Add take-owned Lookbook mutation.
- [ ] Add take-owned reference inclusion mutation.
- [ ] Add take-owned dialogue audio selection mutation.
- [ ] Add take-owned AI Production mutation.
- [ ] Update generation planning to read only from
      `SceneShotVideoTakeEditContext`.
- [ ] Replace compatibility locks with editable, resolvable, runnable, and
      archived/pruned status reporting.
- [ ] Update current focus projection to report take id, source shot-list id,
      and full take shot ids.

### Studio Server And UI

- [ ] Add or rename take edit context routes.
- [ ] Route all take tab saves through take-owned mutations.
- [ ] Remove shot-list `shotSpecs` save routes or repurpose them only for
      non-take structural shot-list edits.
- [ ] Update Takes tab to open the unified take editor.
- [ ] Ensure Composition and Motion tabs hydrate from take state.
- [ ] Ensure Cast, Location, Lookbook, References, and Dialogs hydrate from take
      state.
- [ ] Ensure AI Production hydrates from take state.
- [ ] Show readiness diagnostics without disabling the whole editor.
- [ ] Keep all `packages/studio` interactive controls on local shadcn UI
      components.

### CLI And Skills

- [ ] Add take list/show/create/update commands or update existing generation
      commands to address takes directly.
- [ ] Update shot-video generation context and plan commands to require
      `--take <take-id>`.
- [ ] Update Renku Studio skills so agents mutate take state, not shot-list
      `shotSpecs`.
- [ ] Add agent-facing examples for creating separate takes over the same shot
      with different creative settings.

### Project Migration

- [ ] Create a fresh backup of
      `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite`.
- [ ] Bring `urban-basilica` to the current migration baseline.
- [ ] Apply the new take-owned-state migration.
- [ ] Verify the 9 old take generations migrated to 9 takes.
- [ ] Verify the 14 old membership rows migrated.
- [ ] Verify all 15 storyboard image rows still resolve.
- [ ] Verify all referenced character sheet, location sheet, Lookbook sheet,
      and dialogue audio assets resolve.
- [ ] Verify every referenced asset-file row points to an existing file under
      `/Users/keremk/renku-movies/urban-basilica`.
- [ ] Verify no `shotSpecs` remain in shot-list JSON.
- [ ] Open the project in Studio and confirm existing takes are editable.

### Validation

- [ ] Add focused core tests for independent take state over the same shot ids.
- [ ] Add core tests for shot-list history and storyboard retention.
- [ ] Add core tests for concrete asset reference retention.
- [ ] Add migration fixture tests.
- [ ] Add Studio server route tests.
- [ ] Add Studio UI hydration/save tests.
- [ ] Run `pnpm --dir packages/core type-check`.
- [ ] Run `pnpm --dir packages/studio test:typecheck`.
- [ ] Run focused core and Studio tests for the changed areas.
- [ ] Run root `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` before
      calling the implementation complete.

## Success Criteria

This plan is successful when:

- a user can create two takes for the same shot or shot group and give them
  different Composition, Motion, Cast, Location, Reference, Dialogue, and AI
  Production settings;
- editing one take never mutates another take or the active Scene Shot List;
- old shot-list versions and their storyboard images remain resolvable;
- old character sheets, location sheets, Lookbook sheets, dialogue audio takes,
  media inputs, and final outputs remain resolvable through concrete ids;
- changing or regenerating the active shot list does not make existing takes
  view-only;
- the take editor hydrates from one unified take edit context;
- `urban-basilica` migrates without losing current take, shot-list, storyboard,
  or asset state.
