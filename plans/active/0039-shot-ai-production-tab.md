# 0039 Shot AI Production Tab and Video Take Data Model

Date: 2026-06-01

Status: proposed

## Goal

Add an **AI Production** tab to the existing shot-detail surface so a director
and external agent can prepare one or more video takes for a shot, or for an
ordered group of shots, without changing the current Shots tab layout.

This plan specifies:

- the AI Production user experience;
- the persisted shot-group production draft;
- executable media-generation specs and runs;
- the core-owned logic that builds contexts, validates plans, filters model
  choices, estimates cost, and prepares preflight reports;
- the CLI and Studio Skill workflow an external agent uses to analyze
  dependencies, draft prompts, run approved generations, and import outputs;
- thin Studio server APIs;
- Studio frontend folder structure and naming.

The current video model capability analysis lives in
`docs/architecture/video-generation-model-capabilities.md`. That document is
the source for model-family research. This plan only names the persistence and
implementation contracts that need those capabilities.

## References

- `plans/active/0038-shot-composition-location-tabs.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/video-generation-model-capabilities.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/workflow.md`
- `packages/core/src/client/media-generation.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/server/schema/media-generation.ts`
- `packages/core/src/server/media-generation/scene-storyboard-sheet.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`

## Product Decisions

AI Production is a planning and preflight surface, not a direct paid-generation
button.

The user primarily works with an external AI agent such as Codex or Claude. The
Studio tab must make the intended run visible and editable, then let the user
preview the exact inputs, dependency generations, prompts, estimates, and final
video-take request the agent will prepare.

AI Production settings belong to a shot production group. A group may contain a
single shot or an ordered list of shots from the active Scene Shot List. Every
shot in the group shares the same intent, model choice, parameters, prepared
inputs, agent proposal, and final take list.

The tab sections are:

1. **Intent**
2. **Model Selection**
3. **Run Setup**

The primary action is:

```text
Preview Take Plan
```

There is no `Save Spec` action. Editable choices autosave.

There is no `Generate` or `Generate Take` button in the Studio UI for this
slice. Generation remains an agent/CLI action after the user reviews the
preflight dialog.

Cost approval remains tied to CLI/core estimates for exact persisted specs. The
Studio preview can show estimate lines and copied agent instructions, but it
must not store a broad "approved" state or imply that one approval token covers
later prompt, model, parameter, or input-file changes.

## Design Corrections From Agent Workflow Review

The broader agent workflow changes several earlier assumptions:

- A field on `SceneShot` cannot support multi-shot video without duplicating
  settings across shots. Store AI Production state as shot-list-owned
  production groups instead.
- A final-take relationship with one `shot_id` cannot represent a generated
  video that covers several shots. Use a take row plus a shot membership table.
- The preview dialog cannot be only a "copy brief" surface. It still stays lean,
  but it must show the planned dependency generations and estimate lines so the
  user can review the cost shape before asking the agent to run anything.
- Core should not invent model-specific creative prompts by itself. Core owns
  factual context, capability-derived requirements, validation, spec creation,
  estimates, imports, and diagnostics. The Studio Skill owns dependency
  reasoning and model-specific prompt drafting, then submits those drafts to
  core/CLI for validation.
- A separate one-purpose skill would conflict with ADR 0022's direction to keep
  media generation workflows in the shared `media-producer` skill. The
  corresponding skill work is a new `shot-video-take` reference inside that
  skill unless ADR 0022 is deliberately changed.
- A generic `shot.video-take-input` purpose would make the skill and CLI branch
  too broadly across unrelated dependency media. Use concrete dependency
  purposes, such as first frame, last frame, shot reference sheet, and
  multi-shot storyboard sheet, while sharing common shot-video-take input types.
- A model or intent change can make the agent's dependency analysis stale. The
  persisted agent proposal must record which intent and model it was built for,
  and preflight must fail fast when they no longer match.

## Layout Decision

AI Production must stay inside the existing shot-detail layout.

Do not stretch the tab across the bottom of the Shots page. Do not redesign the
shot rail, video stage, timeline, resizable divider, or surrounding scene
layout.

The tab is another `TabsContent` inside the same lower panel currently used by
Description, Composition, Camera Motion, and Location.

## Non-Goals

This plan does not:

- implement provider adapters for every listed video model;
- run paid video generation from a Studio button;
- design the full take-comparison and selected-take review UX;
- add a separate one-purpose Studio Skill outside `media-producer`;
- add model marketing tags such as "Best fit", "Dialogue", or "Many refs";
- add Fit, Inputs, Limits, or Cost columns to the model table;
- add instructional copy such as hover explanations or approval reminders;
- store generation-ready video inputs as loose files outside Studio asset and
  media-generation records;
- preserve compatibility with any older field names from draft plans.

## User Experience

### Shot Grouping

The AI Production tab opens from the current shot-detail surface, but the
underlying production plan may target one shot or an ordered group of shots.

Rules:

- a single-shot group is the default when no group exists for the selected shot;
- a multi-shot group contains two or more `shotId` values from the active Scene
  Shot List, stored in shot-list order;
- every multi-shot group must be contiguous in the active Scene Shot List;
- a shot may belong to at most one AI Production group in the active shot list;
- more than one AI Production group may exist in the same shot list;
- two groups may sit directly next to each other, but their visual group
  backgrounds must remain visibly separated;
- when the user opens any shot that belongs to a group, the tab shows and edits
  that group's shared settings;
- the tab shows a compact shot-group strip so the director can see that the
  current settings apply to several shots.

The group strip should use meaningful shot labels, such as the existing rail
labels, and should not fill visual cards with raw shot ids.

### Shot Rail Group Selection

The shot rail owns multi-shot group selection. This is a desktop-only workflow.

Each shot row keeps its normal click behavior for selecting the shot shown in
the detail surface. On hover, show a compact group button in the lower-right of
the shot card. Use a local shadcn `Button` with a lucide grouping/link-style
icon and a `Tooltip`; feature code must not use a raw `<button>`.

The group button edits AI Production group membership:

- ungrouped shot with no grouped neighbor: click creates a new single-shot
  production group; click again removes it;
- ungrouped shot adjacent to one group: click joins that group; second click
  creates a separate single-shot group next to it; third click removes it;
- ungrouped shot between two groups: click joins the group above; second click
  joins the group below; third click removes it again;
- grouped shot at an edge: click removes it from that group; click again joins
  the adjacent group; click again creates a separate single-shot group when the
  adjacent-group case is ambiguous;
- grouped shot in the middle of one group: click removes it and splits the
  group into two groups; second click joins the upper group; third click joins
  the lower group; the cycle repeats;
- grouped shot between two directly adjacent groups must never merge both
  groups in one click. It cycles between the upper group, lower group, and no
  group.

Core must validate the result after every autosave:

- each group is contiguous;
- no shot belongs to more than one group;
- empty groups are removed;
- when a group is split, the upper segment keeps the original
  `productionGroupId` and the lower segment gets a new core-generated id;
- group membership changes preserve user-facing `intentId`, `modelChoice`, and
  `parameterValues`, but mark `agentProposal` and generated group-scoped
  dependencies stale until preflight accepts a proposal for the new shot ids.

Visual feedback:

- all shots in one group share one continuous background rectangle behind their
  rail cards;
- adjacent groups must have a visible gap or divider so their rectangles do not
  touch;
- the selected shot within a group uses a slightly stronger tone than the group
  background;
- hover uses a stronger tone than the selected-shot tone;
- as an optional visual treatment, alternate adjacent group backgrounds with
  two restrained token-based variants so neighboring groups remain legible.

The shot detail tab bar should show a quiet tag at the far right when the
selected shot belongs to a multi-shot group. Example copy:

```text
GROUP SHOTS 3-4
```

The tag is informational in this slice. It should use a local shadcn-style
badge or equivalent local UI primitive and should not invent raw shot ids as
visible copy.

### Intent

Intent is a narrow vertical list on the left side of the tab content.

Allowed intent ids:

```ts
export type ShotVideoTakeIntentId =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'multi-shot'
  | 'audio-to-video'
  | 'extend-or-edit';
```

Intent determines what the agent must prepare before the final video model can
run:

| Intent | Preparation Meaning |
| --- | --- |
| `text-only` | Generate the video from shot, scene, Composition, Motion, Location, cast, and visual-language prompt context only. |
| `first-frame` | Generate or choose a first frame, then use it as the video model's start image. |
| `first-last-frame` | Generate or choose first and last frames, then use a model that supports start/end conditioning. |
| `reference` | Provide reference images, sheets, audio, and visual-language context directly when the model supports them. |
| `multi-shot` | Prepare a multi-shot storyboard sheet and other references, then run one final video generation for the ordered shot group. |
| `audio-to-video` | Provide an audio clip, voice, or sound reference when the selected model supports audio-conditioned video. |
| `extend-or-edit` | Use an existing take, frame, or video clip as the source for extension or controlled edit. |

Intent availability depends on the current production group size:

- when the group has one shot, `multi-shot` is disabled and all
  compatible single-shot intents may be selected;
- when the group has more than one shot, `multi-shot` is the only
  selectable intent and every single-shot intent is disabled;
- disabled single-shot intents in a multi-shot group use a tooltip such as
  `Multi-shot group selected. Split the group to use this intent.`;
- disabled multi-shot intent in a single-shot group uses a tooltip such as
  `Select adjacent shots in the rail to use multi-shot generation.`;
- if the group size changes, core preflight treats any now-incompatible intent
  as invalid instead of silently changing it.

The Intent area must not show dependency counts, badges, or explanatory filler
text. The full dependency list belongs in the preflight dialog.

### Model Selection

The model table shows the available model choices for the selected intent.

Columns:

```text
Model
Duration
Status
```

No other columns are allowed in this slice.

Model rows are selected directly. The Run Setup section must not include a
second model dropdown.

Filtering behavior:

- rows that do not support the selected intent are disabled;
- disabled rows remain visible so the director can see why a model is not
  selectable;
- `Status` shows a concise, schema-derived reason such as
  `No first/last frame` or `No audio input`;
- the row must not use vague fit labels or subjective quality tags.

The Duration column summarizes the model's supported duration options for the
selected intent. It is not a generic limits table.

### Run Setup

Run Setup shows the valid parameter controls for the selected model and intent.

Rules:

- no model dropdown;
- fields are generated from the core model report for the selected model;
- only valid parameters for the selected model and intent are rendered;
- parameter controls live in a scrolling list;
- the estimate and Preview Take Plan action live in a fixed footer below the
  scrolling parameter list;
- the estimate displays as a number only;
- no explanatory text under the estimate.

Parameter examples:

- duration;
- aspect ratio;
- resolution;
- quality or equivalent provider-specific quality field;
- seed if supported;
- audio generation toggle if supported;
- audio source choice if supported;
- source take or source frame when the intent needs one.

The UI label should be normalized for the director, but the persisted
generation spec must preserve the provider parameter names needed to run the
model.

### Preview Take Plan Dialog

`Preview Take Plan` opens a full dialog that shows what will be supplied to the
model.

The dialog is the place where the director reviews:

- already available inputs;
- missing inputs that the agent must generate;
- generated prompts;
- chosen source assets;
- selected dependency outputs;
- dependency and final-take estimate lines when exact estimates are available;
- final video-take spec summary.

The dialog must stay lean:

- no status tags such as `planned`, `ready`, or `approved`;
- no per-row agent-task buttons;
- no input mapping section;
- no reference token mapping section;
- no approval reminder copy;
- no generic instructional text.

The dialog should separate the work into clear regions:

1. Prepared Inputs
2. Inputs To Create
3. Cost
4. Prompts
5. Final Take

Actions:

- `Close`
- `Copy Agent Brief`

`Copy Agent Brief` copies a compact, structured brief that the user can paste
to Codex or Claude. It includes the production group target, current user
choices, stale-analysis warnings if any, and the exact CLI commands the agent
should run next. It does not start generation.

## Persistence Overview

AI Production has four kinds of persisted information:

1. shot-list-owned production groups and draft choices;
2. executable media-generation specs and runs for dependency inputs;
3. executable media-generation specs and runs for final video takes;
4. imported dependency assets and imported final video take assets attached to
   the production group.

These must not be collapsed into one object.

### Shot-Group Draft

The draft belongs to the active Scene Shot List document because it is authored
shot intent, not a run. Store it at the shot-list root, not on `SceneShot`, so a
single production plan can cover several shots without duplicated fields.

Add this field to `SceneShotListDocument`:

```ts
videoTakeProductionGroups?: ShotVideoTakeProductionGroup[];
```

Contract:

```ts
export interface ShotVideoTakeProductionGroup {
  productionGroupId: string;
  shotIds: string[];
  videoTakeProduction: ShotVideoTakeProductionPlan;
}

export interface ShotVideoTakeProductionPlan {
  intentId?: ShotVideoTakeIntentId;
  modelChoice?: ShotVideoTakeModelChoice;
  parameterValues?: ShotVideoTakeParameterValues;
  requestedInputs?: ShotVideoTakeRequestedInput[];
  preparedInputs?: ShotVideoTakePreparedInput[];
  agentProposal?: ShotVideoTakeAgentProposal;
  customPromptNote?: string;
}
```

Rules:

- `productionGroupId` is generated by core and is stable while the group exists;
- `shotIds` must be non-empty, unique, and present in the active Scene Shot
  List;
- persisted `shotIds` are ordered according to the Scene Shot List;
- the same `shotId` must not appear in more than one production group;
- a single-shot group is represented with one `shotId`, not a different object
  shape;
- context reads may return an unsaved default group for the requested `shotIds`;
  the group is not durable until Studio autosaves it or the CLI submits it to
  preflight/update;
- the shot-list JSON schema must validate this group shape and reject unknown
  fields.

`parameterValues` stores the director's current UI choices for the selected
model. It is allowed to be incomplete while the draft is being edited, but it
must only contain JSON scalar values and arrays of JSON scalar values.
Preview/spec creation validates the values against the selected model report
before any executable spec is written.

```ts
export type ShotVideoTakeParameterValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | boolean[];

export type ShotVideoTakeParameterValues = Record<
  string,
  ShotVideoTakeParameterValue
>;
```

Requested input references capture user or agent requirements such as "include
the character sheet for Ada." They are not enough by themselves to run a model;
preflight must resolve them into prepared inputs or dependencies to create.

```ts
export type ShotVideoTakeInputSubjectKind =
  | 'asset'
  | 'cast-member'
  | 'location'
  | 'lookbook'
  | 'shot';

export interface ShotVideoTakeRequestedInput {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  note?: string;
}
```

Prepared input references point at existing Studio assets and asset files:

```ts
export type ShotVideoTakeInputKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'shot-reference-sheet'
  | 'character-sheet'
  | 'location-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'source-video'
  | 'audio';

export interface ShotVideoTakePreparedInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId?: string;
}
```

The agent proposal is the skill-authored dependency and prompt draft. It is
stored with the production plan so Studio can show the same preview the agent
submitted through the CLI.

```ts
export interface ShotVideoTakeAgentProposal {
  basedOnIntentId: ShotVideoTakeIntentId;
  basedOnModelChoice: ShotVideoTakeModelChoice;
  dependencyDrafts: ShotVideoTakeDependencyDraft[];
  finalPromptDraft?: ShotVideoTakePromptDraft;
}

export interface ShotVideoTakeDependencyDraft {
  purpose: ShotVideoTakeInputGenerationPurpose;
  dependencyKind: ShotVideoTakeDependencyKind;
  outputInputKind: ShotVideoTakeInputKind;
  modelChoice?: ShotVideoTakeInputModelChoice;
  prompt: string;
  parameterValues?: ShotVideoTakeParameterValues;
  title?: string;
}

export interface ShotVideoTakePromptDraft {
  prompt: string;
  negativePrompt?: string;
  title?: string;
}
```

Preflight must return a structured error or invalid report when
`agentProposal.basedOnIntentId` or `agentProposal.basedOnModelChoice` no longer
matches the current selected intent/model. The agent must regenerate the
dependency analysis for the new model instead of relying on stale proposals.

### Executable Specs

Executable specs belong in the existing `media_generation_spec` table.

Add concrete shot-video-take purposes:

```ts
export const SHOT_FIRST_FRAME_GENERATION_PURPOSE =
  'shot.first-frame' as const;

export const SHOT_LAST_FRAME_GENERATION_PURPOSE =
  'shot.last-frame' as const;

export const SHOT_REFERENCE_SHEET_GENERATION_PURPOSE =
  'shot.reference-sheet' as const;

export const SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE =
  'shot.multi-shot-storyboard-sheet' as const;

export const SHOT_VIDEO_TAKE_GENERATION_PURPOSE =
  'shot.video-take' as const;
```

Extend `MediaGenerationPurpose` with all five purposes.

Dependency generation purposes:

| Purpose | Meaning |
| --- | --- |
| `shot.first-frame` | Generate a first frame for a single-shot video take. |
| `shot.last-frame` | Generate a last frame for a single-shot first/last-frame video take. |
| `shot.reference-sheet` | Generate a single-shot visual reference sheet that summarizes composition, continuity, and model-facing instructions. |
| `shot.multi-shot-storyboard-sheet` | Generate one storyboard-style reference sheet for an ordered contiguous shot group. |

These dependency purposes may share public TypeScript types such as
`ShotVideoTakeInputModelChoice`, `ShotVideoTakeParameterValues`,
`SceneShotMediaGenerationTarget`, and `ShotVideoTakeGenerationInput`, but each
purpose gets its own core validation, context handling, spec validation, CLI
switch branch, import behavior, and skill workflow section.

`shot.video-take` is for the final video provider request.

Add a scene-shot-group target:

```ts
export interface SceneShotMediaGenerationTarget {
  kind: 'sceneShotGroup';
  id: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  shotIds: string[];
}
```

`id` is an opaque storage key generated by core, for example through:

```ts
buildSceneShotMediaGenerationTargetId({
  sceneId,
  shotListId,
  productionGroupId,
  shotIds,
});
```

The structured `sceneId`, `shotListId`, `productionGroupId`, and `shotIds`
remain part of the target and the spec. Do not parse the opaque id to recover
relationships.

Add the dependency input spec:

```ts
export type ShotVideoTakeInputGenerationPurpose =
  | typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_LAST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_REFERENCE_SHEET_GENERATION_PURPOSE
  | typeof SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE;

export type ShotVideoTakeInputModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export interface ShotVideoTakeInputGenerationSpec {
  purpose: ShotVideoTakeInputGenerationPurpose;
  target: SceneShotMediaGenerationTarget;
  dependencyKind: ShotVideoTakeDependencyKind;
  outputInputKind: ShotVideoTakeInputKind;
  modelChoice: ShotVideoTakeInputModelChoice;
  prompt: string;
  parameterValues: ShotVideoTakeParameterValues;
  title?: string;
}
```

For image dependency purposes, the default model choice is
`fal-ai/openai/gpt-image-2` unless the user or model catalog selects a different
supported choice. The skill should not hide the concrete purpose behind a
generic "video take input" branch.

Add the executable spec:

```ts
export interface ShotVideoTakeGenerationSpec {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  prompt: string;
  negativePrompt?: string;
  parameterValues: ShotVideoTakeParameterValues;
  inputs: ShotVideoTakeGenerationInput[];
  title?: string;
}
```

Generation inputs:

```ts
export interface ShotVideoTakeGenerationInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId: string;
  role: string;
  mediaKind: 'image' | 'audio' | 'video';
  projectRelativePath: string;
}
```

Concrete dependency specs are created from `agentProposal.dependencyDrafts`
after core validates that each draft satisfies a required dependency slot for
the current intent/model.

The final video-take spec is created or updated by core logic when the
production plan validates and all required inputs are available. There is no
separate Save Spec button in Studio.

### Runs

Runs stay in `media_generation_run`.

Extend `PreparedMediaGeneration` to support:

- `mediaKind: 'video'`;
- video provider mode names;
- image, audio, and video input files;
- `outputNames` for final video files and optional audio sidecars;
- estimate snapshots from the engine.

The run record must keep:

- spec snapshot;
- provider payload;
- estimate snapshot;
- approval token when required by the engine;
- diagnostics;
- outputs.

### Imported Dependency Inputs And Video Takes

Generated dependency inputs must be imported as Studio assets, then referenced
from the production group through `videoTakeProduction.preparedInputs`.

Generated final video takes must be imported as Studio assets, then attached to
the production group through dedicated shot-video-take relationships.

Add Drizzle-owned tables through Drizzle Kit:

```text
scene_shot_video_take
scene_shot_video_take_shot
```

`scene_shot_video_take` columns:

```text
id
scene_id
shot_list_id
production_group_id
asset_id
media_generation_run_id
created_at
updated_at
is_selected
```

`scene_shot_video_take_shot` columns:

```text
take_id
shot_id
shot_order
```

Rules:

- `asset_id` references the imported video asset;
- `media_generation_run_id` is nullable so manually imported takes can be
  attached later without pretending they came from a run;
- `scene_shot_video_take_shot` records the ordered shot membership for the
  generated video take;
- at most one selected take per `scene_id`, `shot_list_id`, and
  `production_group_id`;
- deleting the asset must remove or invalidate the take relationship through
  the same asset-delete cleanup pattern used by storyboard sheets;
- final video files are not stored directly in the shot-list JSON.

The first UI slice may list available takes only as part of the preflight/final
take summary. A richer comparison and selection UI is a follow-up, but the data
model must not prevent multiple takes per production group.

## Core Ownership

Core owns the logic. Studio server routes only parse HTTP requests, call project
data service methods, and serialize responses.

Add core module:

```text
packages/core/src/server/media-generation/shot-video-take.ts
```

Responsibilities:

- read the active shot list for a scene;
- resolve the production group, its ordered shots, scene-scoped cast,
  scene-scoped locations, active lookbook summary, Composition, Camera Motion,
  and Location design;
- build the shot-video-take generation context;
- list model choices from the engine/catalog capability report;
- filter model choices by intent;
- validate the draft production plan;
- validate that an agent proposal matches the current intent and model choice;
- build the preflight report;
- build dependency requirements from the current intent and model capability;
- validate agent-authored dependency and prompt drafts against those
  requirements;
- create or update `media_generation_spec` records for valid concrete
  dependency specs;
- estimate validated dependency and final video specs when exact provider
  payloads can be built;
- create or update `media_generation_spec` records for valid final video-take
  specs;
- prepare provider payloads;
- record runs;
- import concrete dependency outputs and update prepared input references;
- import final video take outputs;
- attach imported takes to the production group and its shot memberships.

Do not put model filtering, dependency planning, or spec construction in the
Studio server route.

Do not perform provider calls, media imports, or long filesystem work inside an
open SQLite transaction. Follow the short-transaction pattern in
`docs/architecture/layers-of-responsibility.md`.

## Core Contracts

Add context report:

```ts
export interface ShotVideoTakeGenerationContext {
  purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  target: SceneShotMediaGenerationTarget;
  project: ShotVideoTakeProjectContext;
  scene: ShotVideoTakeSceneContext;
  shotList: ShotVideoTakeShotListContext;
  productionGroup: ShotVideoTakeProductionGroup;
  shots: SceneShot[];
  referencedCast: ShotVideoTakeCastReference[];
  referencedLocations: ShotVideoTakeLocationReference[];
  activeLookbook: ShotVideoTakeLookbookReference | null;
  storyboardImages: ShotVideoTakeStoryboardImageReference[];
  availableInputs: ShotVideoTakeAvailableInput[];
  existingTakes: SceneShotVideoTake[];
  defaults: ShotVideoTakeDefaults;
  resourceKeys: string[];
}
```

This context is intentionally scene-scoped. It must not return the whole movie
screenplay, all cast members, all locations, or project-wide asset collections.

Include only:

- project facts needed by provider prompts, such as title and aspect ratio;
- the selected scene and lightweight act/sequence labels for orientation;
- the active Scene Shot List summary;
- the selected production group and its ordered shots;
- cast members referenced by those shots;
- locations referenced by those shots;
- active Lookbook summary and selected visual-language reference assets, not the
  entire Lookbook/image collection;
- selected storyboard images for the requested shot ids;
- existing takes for this production group;
- existing asset files that can plausibly satisfy the selected model's accepted
  input roles.

If an agent needs broader movie context, it must ask through a separate command
or use a different skill step. The default shot-video-take context should stay
small enough to be directly useful for prompt drafting.

Add model report:

```ts
export interface ShotVideoTakeModelChoiceReport {
  modelChoice: ShotVideoTakeModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportedIntents: ShotVideoTakeIntentId[];
  duration: ShotVideoTakeDurationSupport;
  parameters: ShotVideoTakeParameterReport[];
  estimateInputs: ShotVideoTakeEstimateInputReport;
}
```

The UI may display only `Model`, `Duration`, and `Status`, but the report must
include enough parameter metadata for Run Setup.

Add preflight report:

```ts
export interface ShotVideoTakePreflightReport {
  valid: boolean;
  issues: DiagnosticIssue[];
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  inputsToCreate: ShotVideoTakePreflightDependency[];
  prompts: ShotVideoTakePreflightPrompt[];
  estimateLines: ShotVideoTakeEstimateLine[];
  finalTake: ShotVideoTakePreflightFinalTake;
  agentBrief: string;
  estimate: GenerationEstimate | null;
}

export interface ShotVideoTakeEstimateLine {
  purpose:
    | ShotVideoTakeInputGenerationPurpose
    | typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
  dependencyKind?: ShotVideoTakeDependencyKind;
  label: string;
  specId?: string;
  estimate: GenerationEstimate | null;
  issues: DiagnosticIssue[];
}
```

The report may contain `issues`, but package-boundary failures still use
structured diagnostics when the request cannot be fulfilled.

`estimate` is the final video-take estimate when it can be computed exactly.
`estimateLines` include dependency input estimates and the final estimate line.
When an exact estimate depends on not-yet-generated input files, that line uses
`estimate: null` and includes a diagnostic issue explaining which dependency
must be created first.

## Core Service Methods

Extend the project data service with concrete shot-video-take methods rather
than a generic purpose registry:

```ts
buildShotVideoTakeContext(input)
listShotVideoTakeModels(input)
updateShotVideoTakeProductionGroup(input)
previewShotVideoTakeProduction(input)

validateShotFirstFrameSpec(input)
createShotFirstFrameSpec(input)
updateShotFirstFrameSpec(input)
listShotFirstFrameSpecs(input)
estimateShotFirstFrameSpec(input)
runShotFirstFrameSpec(input)
validateShotLastFrameSpec(input)
createShotLastFrameSpec(input)
updateShotLastFrameSpec(input)
listShotLastFrameSpecs(input)
estimateShotLastFrameSpec(input)
runShotLastFrameSpec(input)
validateShotReferenceSheetSpec(input)
createShotReferenceSheetSpec(input)
updateShotReferenceSheetSpec(input)
listShotReferenceSheetSpecs(input)
estimateShotReferenceSheetSpec(input)
runShotReferenceSheetSpec(input)
validateShotMultiShotStoryboardSheetSpec(input)
createShotMultiShotStoryboardSheetSpec(input)
updateShotMultiShotStoryboardSheetSpec(input)
listShotMultiShotStoryboardSheetSpecs(input)
estimateShotMultiShotStoryboardSheetSpec(input)
runShotMultiShotStoryboardSheetSpec(input)

validateShotVideoTakeSpec(input)
createShotVideoTakeSpec(input)
updateShotVideoTakeSpec(input)
listShotVideoTakeSpecs(input)
estimateShotVideoTakeSpec(input)
runShotVideoTakeSpec(input)

importShotFirstFrame(input)
importShotLastFrame(input)
importShotReferenceSheet(input)
importShotMultiShotStoryboardSheet(input)
importShotVideoTake(input)
```

These methods may share private functions inside
`packages/core/src/server/media-generation/shot-video-take.ts`, but the public
service names should stay purpose-specific and readable at call sites.

## Dependency Planning

Dependency planning is based on intent, model capability, the selected shot
group, available assets, and any user-requested inputs.

Dependency kinds:

```ts
export type ShotVideoTakeDependencyKind =
  | 'first-frame'
  | 'last-frame'
  | 'shot-reference-sheet'
  | 'multi-shot-storyboard-sheet'
  | 'reference-audio'
  | 'source-video-extract';
```

Dependency purpose mapping:

| Dependency Kind | Generation Purpose | Prepared Input Kind |
| --- | --- | --- |
| `first-frame` | `shot.first-frame` | `first-frame` |
| `last-frame` | `shot.last-frame` | `last-frame` |
| `shot-reference-sheet` | `shot.reference-sheet` | `shot-reference-sheet` |
| `multi-shot-storyboard-sheet` | `shot.multi-shot-storyboard-sheet` | `multi-shot-storyboard-sheet` |

`reference-audio` and `source-video-extract` may be satisfied by existing
assets in this slice. Add concrete generation/extraction purposes for them only
when that workflow is accepted; do not hide them under a generic input purpose.

The preflight report separates:

- dependencies that already have selected assets;
- dependencies that need to be generated by the agent;
- agent-authored prompt text that will be used for each dependency;
- agent-authored prompt text that will be used for the final video take;
- exact or pending estimate lines for each planned generation.

Dependency outputs are imported as assets and referenced back in
`videoTakeProduction.preparedInputs`.

Core's dependency planner returns required input slots, but the Studio Skill
does the creative analysis that decides which character sheets, location
sheets, visual-language references, source takes, or generated reference sheets
best satisfy those slots. For example, if a Seedance first/last-frame workflow
needs a character to remain consistent, the skill should inspect the context,
find the relevant cast member, and include the selected character sheet as a
prepared input or requested dependency.

The default image dependency model for first frames, last frames, and reference
sheets is `fal-ai/openai/gpt-image-2`. The model can be changed by the user or
by the skill only before the dependency spec is persisted and estimated.

The planner must fail fast when:

- a requested cast member, location, source asset, or source take cannot be
  resolved;
- an agent proposal references an input kind the selected final model cannot
  accept;
- a dependency draft omits a prompt or required model parameter;
- a prepared asset file has the wrong media kind for the final provider input.

## Multi-Shot Storyboard Sheet Workflow

Multi-shot generation is for a contiguous shot group that should become one
video provider call. For example, the director may select Shot 3 and Shot 4 in
the rail, choose a model family that supports multi-shot generation, such as
Seedance or Kling when those provider modes are available, and ask the agent to
create one video that covers both shots instead of running one generation per
shot.

For this intent, preflight must require a generated
`multi-shot-storyboard-sheet` dependency unless an existing suitable sheet is
already prepared.

The `shot.multi-shot-storyboard-sheet` purpose produces a single reference
image with one panel per shot. It is a model-facing control sheet, not a normal
scene storyboard sheet. It should include:

- one image panel for each selected shot, in shot-list order;
- shot labels using meaningful rail labels, such as `SHOT 3` and `SHOT 4`;
- a concise action beat for each shot;
- composition notes from the Composition tab;
- camera move notes from the Camera Motion tab;
- location/view notes from the Location tab;
- cast and continuity anchors needed by the final video model;
- optional duration or pacing notes per panel when the final model supports
  multi-shot timing;
- a compact bottom or per-panel instruction area that the final video model can
  read as visual/text guidance.

The final `shot.video-take` spec for a multi-shot group then uses that
storyboard sheet as a prepared image input alongside other resolved references,
such as selected character sheets, location environment sheets, Lookbook
references, source takes, or audio references when the selected model accepts
them.

The agent proposal for a multi-shot group must include:

```ts
{
  purpose: SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE,
  dependencyKind: 'multi-shot-storyboard-sheet',
  outputInputKind: 'multi-shot-storyboard-sheet',
  prompt: string,
  parameterValues: ShotVideoTakeParameterValues
}
```

Core validates that:

- the production group has at least two shots;
- the shot ids are contiguous;
- the selected final model supports a multi-shot intent or reference input
  shape;
- the storyboard sheet dependency targets the same `productionGroupId` and
  ordered `shotIds` as the final video spec;
- stale storyboard sheets generated for a different shot order are not accepted
  as final inputs.

## Studio API

Add thin routes under the selected project API.

Read context:

```text
GET /screenplay/scenes/:sceneId/video-take-production?shotIds=:shotIds
```

`shotIds` is a comma-separated ordered list. When it is omitted, the request is
invalid. Studio should pass the selected shot id explicitly for a single-shot
group.

Response:

```ts
{
  context: ShotVideoTakeGenerationContext;
  models: ShotVideoTakeModelListReport;
}
```

Autosave draft:

```text
PATCH /screenplay/scenes/:sceneId/video-take-production
```

Request:

```ts
{
  productionGroup: ShotVideoTakeProductionGroup;
}
```

Response:

```ts
{
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}
```

Preview:

```text
POST /screenplay/scenes/:sceneId/video-take-production/preview
```

Request:

```ts
{
  productionGroup: ShotVideoTakeProductionGroup;
}
```

Response:

```ts
{
  preflight: ShotVideoTakePreflightReport;
}
```

The preview route does not run paid generation. It may create or update
concrete dependency specs, such as `shot.first-frame` or
`shot.multi-shot-storyboard-sheet`, when the agent proposal is valid. It may
create or update the final video-take spec only after the production plan is
valid and all required final inputs are available.

Add HTTP request readers under:

```text
packages/studio/server/http/
  scene-shot-video-take-production-request.ts
```

The request reader must:

- require exactly the expected top-level field;
- reject unknown top-level fields;
- reject malformed non-object values;
- delegate deep validation to core schema/validation.

If the submitted production group has no meaningful user choices, core may
remove the group instead of persisting an empty draft. That empty-state decision
belongs in core, not the browser hook.

## Browser Service

Add:

```text
packages/studio/src/services/studio-shot-video-takes-api.ts
```

Functions:

```ts
readShotVideoTakeProduction(projectName, sceneId, shotIds)
updateShotVideoTakeProduction(projectName, sceneId, productionGroup)
previewShotVideoTakeProduction(projectName, sceneId, productionGroup)
```

Use resource verbs. Do not name the service `fetchAiProduction`,
`generationClient`, or `manager`.

The service owns endpoint paths, fetch calls, Studio token handling, and API
error conversion. Feature components must not call `fetch` directly.

## Studio Frontend Structure

Feature files live under:

```text
packages/studio/src/features/movie-studio/scenes/
```

Add:

```text
scene-shot-ai-production-tab.tsx
scene-shot-ai-production-intent-list.tsx
scene-shot-ai-production-model-table.tsx
scene-shot-ai-production-run-setup.tsx
scene-shot-ai-production-group-strip.tsx
scene-shot-ai-production-group-tag.tsx
scene-shot-video-take-preflight-dialog.tsx
use-shot-video-take-production.ts
shot-video-take-production-projection.ts
shot-video-take-grouping.ts
```

Use `scene-shot-ai-production-*` for visible tab components because the product
tab is named AI Production.

Use `shot-video-take-*` for persisted domain logic because the domain object is
a video take for a shot.

Do not add a generic `model-matrix`, `detail`, `manager`, `helper`, or
`ai-production-data` file.

`scene-shot-detail.tsx` adds one tab item:

```ts
{ value: 'ai-production', label: 'AI Production' }
```

It must keep the existing resizable layout and lower tab region unchanged.

All controls must use local shadcn-style primitives from
`packages/studio/src/ui`. Feature code must not add raw browser controls.

`shot-video-take-grouping.ts` owns pure projection and transition functions for
rail grouping. It should calculate group adjacency, contiguous ranges, next
cycle state, selected-shot tone, and group background variants without touching
React state or fetch APIs.

### React Performance Rules

Apply the React best-practices skill to this feature:

- avoid UI-driven waterfalls by reading production context and model reports
  together through `readShotVideoTakeProduction`;
- keep fetch calls in the browser service and feature hook, not inside child
  components;
- derive the selected production group, selected model report, enabled
  parameter controls, and grouped shot labels during render or in
  `shot-video-take-production-projection.ts`, not through effects;
- derive shot rail group adjacency and cycle states through
  `shot-video-take-grouping.ts`, not through effect-driven local copies;
- build `Map` and `Set` indexes for repeated shot, asset, and model lookups;
- keep callbacks stable for table row selection, parameter updates, and preview
  actions;
- use `startTransition` for non-urgent updates after model/intent changes or
  preflight dialog refreshes if those updates make the tab feel blocked;
- load heavy preview-only media components conditionally if the preflight dialog
  starts adding expensive image/video previews;
- keep scoped resource refresh local to `SceneShotsTab` and this hook by using
  resource keys, not broad project-shell reloads;
- do not define inline React components inside `scene-shot-ai-production-tab`.

## Autosave Hook

`use-shot-video-take-production.ts` owns:

- local production group state initialized from
  `activeShotList.videoTakeProductionGroups`;
- creating a single-shot group for the selected shot when no group exists yet;
- debounced autosave through `updateShotVideoTakeProduction`;
- selected model row;
- selected intent;
- parameter updates;
- requested input updates when an agent or future UI supplies them;
- agent proposal replacement after CLI/Studio refresh;
- preview action state;
- replacing local state with the refreshed shot-list resource after save.

It should follow the existing `use-shot-specs.ts` pattern, but it is a
separate hook because video-take production is a separate persisted domain
object.

When intent, model choice, or shot membership changes, the hook must keep the
user's selected values but treat `agentProposal` as stale until core preflight
accepts a proposal built for the new intent/model. Do not silently delete the
proposal in the browser; let core diagnostics explain why the preview is
invalid.

## Agent Flow

Expected workflow:

1. User chooses one shot or a shot group.
2. User chooses an intent.
3. User selects a compatible model row.
4. User edits valid run parameters.
5. User copies the agent brief or asks an agent directly to create the take.
6. The agent reads context through the CLI.
7. The agent uses the `media-producer` shot-video-take reference to identify
   required existing inputs, missing dependency assets, and model-specific
   prompt drafts.
8. The agent saves the production group through the CLI, then runs preflight so
   core can validate the proposal and prepare exact spec/estimate data where
   possible.
9. Studio opens or refreshes `Preview Take Plan` and shows prepared inputs,
   inputs to create, prompts, estimate lines, and final take summary.
10. The user approves only the dependency generations they want the agent to
    run.
11. The agent creates dependency specs, estimates them, requests provider
    permission when needed, runs approved specs, inspects outputs, imports the
    accepted assets, and refreshes the production group.
12. The user previews dependency outputs in Studio.
13. After all required inputs are available, the agent re-runs preflight,
    estimates the final video spec, gets approval for that exact request, runs
    it, imports the final video output, and attaches it as a take.
14. Studio refreshes and shows the new take in the shot group.

The dialog should support this workflow without pretending the browser button
itself is the generating actor.

## Studio Skill Requirements

Update the existing external skill:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer
```

Add:

```text
references/shot-video-take.md
samples/shot-first-frame-spec.json
samples/shot-last-frame-spec.json
samples/shot-reference-sheet-spec.json
samples/shot-multi-shot-storyboard-sheet-spec.json
samples/shot-video-take-final-spec.json
samples/shot-video-take-production-group.json
```

The `SKILL.md` overview should list `shot.first-frame`, `shot.last-frame`,
`shot.reference-sheet`, `shot.multi-shot-storyboard-sheet`, and
`shot.video-take` as supported purposes, then point to the detailed reference.
Keep the main skill short.

The new reference must cover:

- resolving the current project, scene, active shot list, selected shot, and
  optional shot group;
- honoring user-selected `intentId`, `modelChoice`, `parameterValues`, and
  `shotIds` exactly;
- reading context with `renku generation context`;
- reading model reports with `renku generation model list`;
- deciding which existing cast sheets, location sheets, Lookbook images,
  storyboard images, source takes, audio files, or reference images should be
  used;
- deciding which concrete missing dependency purposes need generated assets;
- using `fal-ai/openai/gpt-image-2` as the default model for generated image
  dependency inputs unless the user chooses otherwise;
- for a multi-shot group, creating a `shot.multi-shot-storyboard-sheet` spec
  before the final video spec and treating that sheet as a prepared model input;
- writing `ShotVideoTakeAgentProposal` with dependency prompts and final prompt
  drafts;
- saving, validating, and previewing the proposal through CLI/core before
  running any provider call;
- estimating each persisted dependency spec and getting user approval before
  running it;
- inspecting generated dependency assets before import;
- importing dependency inputs with the concrete purpose that generated them,
  such as `renku media import --purpose shot.multi-shot-storyboard-sheet`;
- re-running preflight after dependency imports before estimating the final
  video request;
- estimating, approving, running, importing, and attaching the final
  `shot.video-take`;
- never writing `.renku/project.sqlite` directly;
- never overriding user-selected model, intent, parameters, or shot group after
  the user has chosen them.

Model-specific prompt guidance belongs in the skill reference or a small
reference file it links to, not in Studio frontend code. The prompt guidance
should use `docs/architecture/video-generation-model-capabilities.md` as the
model-capability source and should add concrete prompt rules for the supported
video models as those models become executable.

## CLI Requirements

The CLI remains a thin adapter over core. It parses flags, reads JSON files,
formats JSON output, and calls core methods. It must not own dependency
planning, model filtering, provider payload construction, asset registration,
or import attachment rules.

Add these exact commands and flags for the first implementation:

```bash
renku generation context \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --json

renku generation context \
  --purpose <shot-dependency-purpose> \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --json

renku generation model list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --intent <intent-id> \
  --json

renku generation model list \
  --purpose <shot-dependency-purpose> \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --json

renku generation production update \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --file <production-group-json> \
  --json

renku generation preflight \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --file <production-group-json> \
  --json
```

Allowed `<shot-dependency-purpose>` values:

```text
shot.first-frame
shot.last-frame
shot.reference-sheet
shot.multi-shot-storyboard-sheet
```

`generation production update` validates and saves the
`ShotVideoTakeProductionGroup` into the active Scene Shot List document. It does
not create specs or run generation.

`generation preflight` validates the `ShotVideoTakeProductionGroup`, returns the
same `ShotVideoTakePreflightReport` used by Studio, and may create/update
persisted specs exactly as described in the Studio preview route. It does not
run paid generation.

Concrete dependency specs use the existing spec commands:

```bash
renku generation spec validate --file <shot-dependency-spec-json> --json
renku generation spec create --file <shot-dependency-spec-json> --json
renku generation spec update --spec <spec-id> --file <shot-dependency-spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
```

Final video specs use the same spec, estimate, and run commands with a
`shot.video-take` spec.

Add media import support:

```bash
renku media import \
  --purpose <shot-dependency-purpose> \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --source <project-relative-path> \
  --receipt <generation-run-json> \
  --json

renku media import \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --source <project-relative-path> \
  --receipt <generation-run-json> \
  --json
```

Concrete dependency imports register the asset and update the matching
production group's `preparedInputs`. Core maps the purpose to the prepared input
kind:

```text
shot.first-frame -> first-frame
shot.last-frame -> last-frame
shot.reference-sheet -> shot-reference-sheet
shot.multi-shot-storyboard-sheet -> multi-shot-storyboard-sheet
```

`shot.video-take` import registers the final video asset, creates the
`scene_shot_video_take` row, creates `scene_shot_video_take_shot` memberships,
and emits scoped resource keys for the affected shot list and shot group.

Do not add aliases for experimental command names. If these names change during
implementation, update all callers and docs directly.

## Engine Catalog Follow-Up

The model-supporting engine work should use the architecture document as its
input:

- normalize model capability metadata;
- expose model reports to core;
- describe accepted input roles for video models, such as start image, end
  image, reference images, source video, and audio;
- describe which intents each model can satisfy;
- validate provider parameter names and values;
- estimate cost from concrete provider payloads;
- prepare provider payloads without Studio server logic knowing provider
  quirks.

This plan should not duplicate detailed model-family tables.

## Implementation Checklist

- [ ] Add `SceneShotListDocument.videoTakeProductionGroups` and related client
      contracts.
- [ ] Extend shot-list JSON schema for `videoTakeProductionGroups`.
- [ ] Add validation that shot ids are unique across production groups and
      ordered according to the active shot list.
- [ ] Add validation that every multi-shot group is contiguous.
- [ ] Add core validation for shot-video-take production drafts.
- [ ] Add stale-agent-proposal validation for intent/model changes.
- [ ] Add `SHOT_FIRST_FRAME_GENERATION_PURPOSE`.
- [ ] Add `SHOT_LAST_FRAME_GENERATION_PURPOSE`.
- [ ] Add `SHOT_REFERENCE_SHEET_GENERATION_PURPOSE`.
- [ ] Add `SHOT_MULTI_SHOT_STORYBOARD_SHEET_GENERATION_PURPOSE`.
- [ ] Add `SHOT_VIDEO_TAKE_GENERATION_PURPOSE`.
- [ ] Add `SceneShotMediaGenerationTarget`.
- [ ] Extend `MediaGenerationSpec`, `MediaGenerationSpecRecord`,
      `MediaGenerationRun`, and `PreparedMediaGeneration` for concrete shot
      dependency purposes and video takes.
- [ ] Add Drizzle schema and generated migration for
      `scene_shot_video_take` and `scene_shot_video_take_shot`.
- [ ] Add core database access for shot video takes.
- [ ] Add `packages/core/src/server/media-generation/shot-video-take.ts`.
- [ ] Extend project data service contracts and wiring.
- [ ] Extend CLI generation commands with `shot.first-frame`,
      `shot.last-frame`, `shot.reference-sheet`,
      `shot.multi-shot-storyboard-sheet`, `shot.video-take`, `--shots`,
      `--intent`, and `generation production update` /
      `generation preflight`.
- [ ] Extend CLI media import with the concrete dependency purposes,
      `shot.video-take`, and `--shots`.
- [ ] Update `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer`
      with the shot-video-take reference and samples.
- [ ] Add Studio HTTP request reader and routes.
- [ ] Add `studio-shot-video-takes-api.ts`.
- [ ] Add `use-shot-video-take-production.ts`.
- [ ] Add AI Production tab components.
- [ ] Add shot-group strip rendering.
- [ ] Add shot-rail group button, contiguous group cycling, and visual group
      background states.
- [ ] Add the group tag at the far right of the shot-detail tab bar.
- [ ] Add Preview Take Plan dialog.
- [ ] Add tests for draft persistence, model filtering, parameter validation,
      preflight reports, estimate lines, dependency imports, and imported take
      relationships.

## Tests

Core tests:

- shot-list schema accepts valid `videoTakeProductionGroups`;
- shot-list schema rejects unknown fields under `videoTakeProductionGroups`;
- shot-list schema rejects duplicate shot membership across production groups;
- shot-list schema rejects non-contiguous shot groups;
- shot-list schema stores shot group ids in active shot-list order;
- draft validation rejects unsupported intent/model combinations;
- draft validation rejects multi-shot intent for a single-shot group;
- draft validation rejects single-shot intents for a multi-shot group;
- preflight rejects a stale agent proposal after intent or model changes;
- preflight rejects a stale multi-shot storyboard sheet generated for different
  shot ids or order;
- draft validation rejects parameter keys absent from the selected model report;
- model list disables rows that do not support the selected intent;
- preflight report separates prepared inputs from inputs to create;
- preflight report includes dependency and final-take estimate lines;
- preview does not run paid generation;
- executable specs include target scene id, shot-list id, production group id,
  and ordered shot ids;
- `shot.multi-shot-storyboard-sheet` spec requires a multi-shot production
  group;
- concrete dependency imports update `preparedInputs` with the matching input
  kind;
- media-generation spec/run records round-trip video media kind;
- final take import creates `scene_shot_video_take` and
  `scene_shot_video_take_shot` rows;
- only one take can be selected per production group.

Studio tests:

- AI Production appears inside the existing lower shot tab region;
- current shot layout does not stretch or change;
- grouped shots render in the AI Production group strip;
- shot rail group button appears on hover and uses local shadcn controls;
- shot rail group selection only creates contiguous groups;
- removing a middle shot splits one group into two groups;
- adjacent groups have visibly separate backgrounds;
- selected shot in a group has a stronger tone than the group background;
- group hover has a stronger tone than selected state;
- multi-shot group disables single-shot intents with a tooltip;
- single-shot group disables multi-shot intent with a tooltip;
- the shot-detail tab bar shows the group tag at the far right when the
  selected shot belongs to a multi-shot group;
- Intent list has no dependency counts or badges;
- model table columns are exactly `Model`, `Duration`, and `Status`;
- model table has no Fit, Inputs, Limits, or Cost columns;
- Run Setup has no model dropdown;
- estimate displays as a number only;
- Preview Take Plan opens the dialog;
- dialog shows cost lines without adding a Studio-side generate button;
- dialog has no status tags, agent-task buttons, input mapping, reference token
  mapping, or approval reminder copy;
- editable choices autosave without a Save Spec action.

CLI and skill tests:

- `generation context --purpose shot.video-take` requires `--target`,
  `--shot-list`, and `--shots`;
- `generation context --purpose shot.multi-shot-storyboard-sheet` requires
  contiguous `--shots`;
- `generation model list --purpose shot.video-take` honors `--intent`;
- `generation production update --purpose shot.video-take` persists the
  submitted production group and emits scoped resource keys;
- `generation preflight --purpose shot.video-take` returns
  `ShotVideoTakePreflightReport`;
- `media import --purpose shot.multi-shot-storyboard-sheet` updates
  `preparedInputs` with `multi-shot-storyboard-sheet`;
- `media import --purpose shot.video-take` attaches the imported asset as a
  group take;
- the `media-producer` shot-video-take sample production group validates
  through the CLI.

## Acceptance Criteria

- The AI Production tab is present in the existing shot-detail tab bar.
- The overall Shots layout remains unchanged.
- AI Production choices persist on the active Scene Shot List document as
  `videoTakeProductionGroups`.
- A production group can target one shot or an ordered list of shots.
- Production groups are contiguous, and the shot rail provides clear grouping
  controls and visual feedback.
- Single-shot and multi-shot intents are gated by group size with tooltips.
- The context report is scoped to the selected scene and selected shot group; it
  does not include all movie cast, all locations, or broad project asset lists.
- Executable `shot.first-frame`, `shot.last-frame`, `shot.reference-sheet`,
  `shot.multi-shot-storyboard-sheet`, and `shot.video-take` specs persist in
  `media_generation_spec`.
- Runs persist in `media_generation_run`.
- Imported dependency inputs persist as assets and are referenced by
  `preparedInputs`.
- Multi-shot video preflight can require and validate a
  `shot.multi-shot-storyboard-sheet` dependency before the final video take.
- Imported final takes persist as assets and are attached through
  `scene_shot_video_take` and `scene_shot_video_take_shot`.
- Core owns model filtering, validation, dependency planning, preflight,
  estimate, spec preparation, and import attachment logic.
- The CLI exposes the exact concrete shot dependency purposes,
  `shot.video-take`, and `generation production update` /
  `generation preflight` surface needed by the external agent.
- The external `media-producer` Studio Skill has shot-video-take workflow
  guidance and samples.
- Studio server APIs are thin adapters.
- Studio feature code follows the front-end guidelines and shadcn-only control
  rule.
- The visible UI avoids the clutter explicitly rejected in the design review.
