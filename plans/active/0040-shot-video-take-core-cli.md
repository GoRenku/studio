# 0040 Shot Video Take Core, Data Model, CLI, And Skill Contracts

Date: 2026-06-02

Status: implemented

## Goal

Implement the core-owned foundation for shot video takes so Studio and external
agents can prepare, validate, estimate, run, import, and attach AI-generated
video takes for one shot or for an ordered contiguous group of shots.

This plan covers:

- browser-safe core contracts;
- Scene Shot List production-group persistence;
- media-generation purposes, specs, runs, and imports;
- final video take persistence;
- scene-scoped generation context;
- model reports and intent validation;
- preflight and dependency planning;
- multi-shot storyboard-sheet support;
- core project data service methods;
- CLI commands and flags;
- `media-producer` Studio Skill updates.

This plan deliberately does not implement the Studio UI or Studio server routes.
Those are covered by `plans/active/0041-shot-ai-production-studio-ui.md`.

`plans/active/0039-shot-ai-production-tab.md` remains the broader design draft.
Do not overwrite it while implementing this split.

## References

- `plans/active/0039-shot-ai-production-tab.md`
- `plans/active/0041-shot-ai-production-studio-ui.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/video-generation-model-capabilities.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `packages/core/src/client/media-generation.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/server/media-generation/lookbook-image.ts`
- `packages/core/src/server/media-generation/cast-image-common.ts`
- `packages/core/src/server/media-generation/scene-storyboard-sheet.ts`
- `packages/engines/src/generation/contracts.ts`
- `packages/engines/src/generation/estimates.ts`
- `packages/engines/src/generation/runner.ts`
- `packages/engines/src/generation/input-file-payload.ts`
- `packages/engines/src/generation/provider-payload-validation.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/media-command.ts`

## Product Decisions

AI Production state belongs to a shot production group, not to an individual
`SceneShot`.

A production group may target:

- one shot, for single-shot generation;
- two or more contiguous shots, for one multi-shot video generation call.

The group owns the shared AI Production choices:

- intent;
- final video model choice;
- final video parameter values;
- requested inputs;
- prepared inputs;
- agent proposal;
- prompt notes.

Generation and import stay separate:

- persisted specs live in `media_generation_spec`;
- runs live in `media_generation_run`;
- generated files become Studio assets only after `renku media import`;
- final video take rows attach imported video assets back to the production
  group and its member shots.

Core owns factual context, validation, diagnostics, preflight, model filtering,
spec construction, engine request preparation, estimate orchestration, run
recording, import registration, dependency reuse relationships, and final take
attachment.

The external Studio Skill owns creative dependency analysis and model-specific
prompt drafting. It submits proposals to core/CLI; core validates those
proposals before any specs are persisted or estimated.

## Non-Goals

This plan does not:

- add Studio React components;
- add Studio HTTP routes;
- run paid generation from the browser;
- implement provider adapters for every researched video model;
- design the take-comparison UI;
- add compatibility aliases for old purpose names or old draft fields;
- preserve a generic `shot.video-take-input` purpose.

## Production Group Persistence

Add `videoTakeProductionGroups` to `SceneShotListDocument`.

```ts
export interface SceneShotListDocument {
  kind: 'sceneShotList';
  sceneId: string;
  title: string;
  summary: string;
  coverageStrategy: string;
  lookbookInfluence?: string;
  shots: SceneShot[];
  videoTakeProductionGroups?: ShotVideoTakeProductionGroup[];
  openQuestions?: string[];
}
```

Production group contract:

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

Validation rules:

- `productionGroupId` is core-generated and stable while the group exists;
- `shotIds` must be non-empty;
- every `shotId` must exist in the active Scene Shot List;
- persisted `shotIds` are stored in active shot-list order;
- a shot may belong to at most one production group;
- a group with two or more shots must be contiguous in the active shot list;
- empty groups are removed by core during update;
- unknown fields under `videoTakeProductionGroups` are schema errors;
- single-shot groups and multi-shot groups use the same object shape.

When a group is split by the UI:

- the upper segment keeps the original `productionGroupId`;
- the lower segment gets a new core-generated `productionGroupId`;
- `intentId`, `modelChoice`, and `parameterValues` may be preserved;
- `agentProposal` and generated group-scoped dependencies become stale until
  preflight accepts a proposal for the new shot ids.

## Intent Contract

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

Core validation:

- single-shot groups may use compatible single-shot intents;
- single-shot groups must not use `multi-shot`;
- multi-shot groups must use `multi-shot`;
- multi-shot groups must not use single-shot intents;
- if group membership changes and the current intent is no longer valid,
  preflight returns structured diagnostics instead of silently changing intent.

## Input And Parameter Contracts

Parameter values:

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

Prepared input kinds:

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
```

Requested inputs:

```ts
export type ShotVideoTakeInputSubjectKind =
  | 'asset'
  | 'cast-member'
  | 'location'
  | 'lookbook'
  | 'production-group'
  | 'shot';

export interface ShotVideoTakeRequestedInput {
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  fulfillmentMode?: 'reuse-existing' | 'generate-new';
  note?: string;
}
```

Prepared inputs:

```ts
export interface ShotVideoTakePreparedInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId?: string;
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
}
```

Core must resolve prepared inputs to concrete asset files before building the
final provider payload. A prepared input with the wrong media kind is a
preflight error.

Reuse rules:

- `preparedInputs` are the exact existing asset files the final video take may
  use;
- if the user wants to reuse an input from a prior take, core adds that asset
  file to `preparedInputs`;
- if the user wants to regenerate an input, core removes the old prepared input
  for that slot and records a requested input with
  `fulfillmentMode: 'generate-new'`;
- preflight may show reusable candidates, but it must not auto-reuse a
  candidate the current plan did not select.

## Agent Proposal Contract

The agent proposal records skill-authored dependency and prompt drafts. It is
stored on the production plan so Studio and CLI preflight show the same plan.

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

Preflight fails when:

- `basedOnIntentId` does not match the current production plan intent;
- `basedOnModelChoice` does not match the current final model choice;
- a dependency draft uses a purpose that does not match its dependency kind;
- a dependency draft omits a required prompt or required parameter;
- a dependency draft targets stale shot ids or shot order.

## Media Generation Purposes

Add concrete media-generation purposes:

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

Extend `MediaGenerationPurpose` with all five.

Do not add `shot.video-take-input`. It is too broad and would force the skill,
CLI, and core service layer to branch on unrelated dependency behaviors. The
concrete purposes may share types and private implementation code, but each
purpose needs an explicit switch branch, validation path, and import behavior.

Purpose meanings:

| Purpose | Meaning |
| --- | --- |
| `shot.first-frame` | Generate a first frame for a single-shot video take. |
| `shot.last-frame` | Generate a last frame for a single-shot first/last workflow. |
| `shot.reference-sheet` | Generate a single-shot visual reference sheet with composition, continuity, and model-facing notes. |
| `shot.multi-shot-storyboard-sheet` | Generate one storyboard-style reference sheet for an ordered contiguous shot group. |
| `shot.video-take` | Generate the final video take. |

Shared dependency spec type:

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

The default image dependency model is `fal-ai/openai/gpt-image-2` unless the
user or model report selects another supported model.

Final video spec:

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

export interface ShotVideoTakeGenerationInput {
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId: string;
  role: string;
  mediaKind: 'image' | 'audio' | 'video';
  projectRelativePath: string;
}
```

## Generation Target

Add the scene-shot-group target:

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

`id` is an opaque storage key generated by core. The structured `sceneId`,
`shotListId`, `productionGroupId`, and ordered `shotIds` remain part of the
target and spec. Callers must not parse `id` to recover relationships.

## Dependency Planning

Dependency planning is based on:

- current intent;
- selected final model capability;
- selected shot group;
- available scene-scoped assets;
- user-requested inputs;
- agent proposal drafts.

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

Purpose mapping:

| Dependency Kind | Generation Purpose | Prepared Input Kind |
| --- | --- | --- |
| `first-frame` | `shot.first-frame` | `first-frame` |
| `last-frame` | `shot.last-frame` | `last-frame` |
| `shot-reference-sheet` | `shot.reference-sheet` | `shot-reference-sheet` |
| `multi-shot-storyboard-sheet` | `shot.multi-shot-storyboard-sheet` | `multi-shot-storyboard-sheet` |

`reference-audio` and `source-video-extract` may be satisfied by existing
assets in this slice. Add concrete generation or extraction purposes for them
only when that workflow is accepted.

Core's dependency planner returns required input slots. The Studio Skill decides
which existing character sheets, location sheets, Lookbook images, storyboard
images, source takes, audio files, or generated reference sheets best satisfy
those slots.

## Dependency Input Persistence And Reuse

Generated prerequisite dependencies are stored in two layers:

1. the generated file is imported as a normal Studio `asset` plus `asset_file`;
2. core records a shot-video-take input relationship that says which
   production group, shot ids, input kind, subject, and generation run produced
   or selected that asset file.

This keeps generated first frames, last frames, single-shot reference sheets,
and multi-shot storyboard sheets reusable across later takes without embedding
files in Scene Shot List JSON.

Add Drizzle-owned tables through Drizzle Kit:

```text
scene_shot_video_take_input
scene_shot_video_take_input_shot
```

`scene_shot_video_take_input` columns:

```text
id
scene_id
shot_list_id
production_group_id
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

`scene_shot_video_take_input_shot` columns:

```text
input_id
shot_id
shot_order
```

Rules:

- `asset_id` references the imported dependency asset;
- `asset_file_id` references the concrete file used by the final provider
  payload;
- `media_generation_run_id` is nullable for manually imported or externally
  prepared inputs;
- `subject_kind` and `subject_id` are required for relationship rows. Use
  `shot` for shot-scoped first/last frames, `production-group` for group-scoped
  sheets, `cast-member` for character sheets, `location` for location sheets,
  `lookbook` for Lookbook references, and `asset` when the asset itself is the
  subject;
- `selection` uses the current Studio asset relationship vocabulary: `select`
  or `take`;
- at most one `select` input is allowed per `scene_id`, `shot_list_id`,
  `production_group_id`, `input_kind`, `subject_kind`, and `subject_id`;
- generated dependency files initially land under the normal generation output
  root, such as `generated/media`, and become reusable only after `renku media
  import` creates asset and input relationship records;
- `scene_shot_video_take_input_shot` records ordered shot membership so core can
  reject a multi-shot storyboard sheet generated for a stale shot range;
- generated dependency assets are not deleted or overwritten when a later take
  asks to regenerate the same slot;
- regenerating creates a new media-generation spec/run/import and a new input
  relationship row;
- reusing an existing dependency copies the selected asset file into
  `preparedInputs` for the current production plan;
- final video take specs must reference selected `preparedInputs`, not scan
  historical runs to infer what to use.

Context and preflight must expose both:

- `availableInputs`: reusable shot-video-take dependency candidates from these
  tables;
- `preparedInputs`: the current selected inputs that will be mapped into the
  final video provider request.

Compatible existing cast, location, Lookbook, scene storyboard, source take,
and audio assets remain available through the scene-scoped context fields that
own those relationships. They are added to `preparedInputs` by production-group
update or by the skill-authored proposal; they do not need a
`scene_shot_video_take_input` row unless the user selects them as reusable
shot-video-take inputs for this production group.

## Multi-Shot Storyboard Sheet

Multi-shot generation is for one final provider call that covers a contiguous
shot group. For example, the director may group Shot 3 and Shot 4, choose a
model family that supports multi-shot generation, such as Seedance or Kling
when provider modes are available, and ask the agent to create one video that
covers both shots.

For `multi-shot`, preflight requires a `multi-shot-storyboard-sheet` prepared
input unless a suitable existing sheet is already prepared.

The `shot.multi-shot-storyboard-sheet` purpose creates one model-facing
reference image with:

- one panel per selected shot, in shot-list order;
- meaningful labels such as `SHOT 3` and `SHOT 4`;
- concise action beats;
- composition notes;
- camera movement notes;
- location/view notes;
- cast and continuity anchors;
- optional per-panel duration or pacing notes when the final model supports it;
- compact visual/text instructions readable by the final video model.

Core validates that:

- the production group has at least two shots;
- the shot ids are contiguous;
- the selected final model supports `multi-shot`;
- the storyboard-sheet spec targets the same `productionGroupId` and ordered
  `shotIds` as the final video spec;
- stale sheets generated for a different shot order are rejected.

## Scene-Scoped Context

Add a scene-scoped context report:

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

export interface ShotVideoTakeAvailableInput {
  inputId: string;
  kind: ShotVideoTakeInputKind;
  assetId: string;
  assetFileId: string;
  mediaKind: 'image' | 'audio' | 'video';
  subjectKind: ShotVideoTakeInputSubjectKind;
  subjectId: string;
  productionGroupId?: string;
  shotIds: string[];
  mediaGenerationRunId?: string;
  selected: boolean;
  createdAt: string;
}
```

This context must not include:

- the full screenplay;
- all cast members;
- all locations;
- broad project asset collections.

Include only:

- project title and aspect ratio;
- selected scene and lightweight act/sequence labels;
- active Scene Shot List summary;
- selected production group and ordered shots;
- cast referenced by those shots;
- locations referenced by those shots;
- active Lookbook summary and selected visual-language reference assets;
- selected storyboard images for the shot ids;
- reusable shot-video-take dependency inputs for the selected production group;
- existing takes for the production group;
- available asset files that can satisfy the selected model's accepted input
  roles, scoped to the selected shots and their referenced cast, locations, and
  visual-language assets.

If an agent needs broader movie context, it must ask through another command or
skill step. The default shot-video-take context should stay small enough to be
directly useful for prompt drafting.

## Model And Preflight Reports

Model report:

```ts
export interface ShotVideoTakeModelChoiceReport {
  modelChoice: ShotVideoTakeModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportedIntents: ShotVideoTakeIntentId[];
  duration: ShotVideoTakeDurationSupport;
  inputRoles: ShotVideoTakeModelInputRoleReport[];
  parameters: ShotVideoTakeParameterReport[];
  estimateInputs: ShotVideoTakeEstimateInputReport;
}

export interface ShotVideoTakeModelInputRoleReport {
  kind: ShotVideoTakeInputKind;
  required: boolean;
  minCount: number;
  maxCount: number | null;
  mediaKind: 'image' | 'audio' | 'video';
}
```

Preflight report:

```ts
export interface ShotVideoTakePreflightReport {
  valid: boolean;
  issues: DiagnosticIssue[];
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  intentId: ShotVideoTakeIntentId;
  modelChoice: ShotVideoTakeModelChoice;
  preparedInputs: ShotVideoTakePreflightInput[];
  availableInputs: ShotVideoTakeAvailableInput[];
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

`estimate` is the exact final video-take estimate when it can be computed.
`estimateLines` include dependency estimates and final estimate status. When an
exact estimate depends on not-yet-generated inputs, that estimate line is
`null` and includes diagnostics.

## Engine Execution Boundary

Shot video takes must use the same persisted-spec execution architecture
accepted in ADR 0020 and already used by Lookbook, cast, location, and scene
storyboard media generation.

Existing pattern to follow:

- core validates and persists a purpose-specific spec in
  `media_generation_spec`;
- core rebuilds current bounded context before estimate or run;
- core builds a purpose-specific provider plan;
- core converts that plan into engine-owned `GenerationPolicy` and
  `GenerationRequest`;
- `@gorenku/studio-engines` builds the logical provider payload, validates it
  against the bundled provider model JSON schema, estimates cost, and returns
  an approval token based on the exact policy plus request hash;
- live runs call `runGeneration` with the same policy, request, input root,
  output root, and approval token;
- engines resolve `GenerationInputFile` entries to local file blobs only at
  execution time, after the logical payload has already passed schema
  validation;
- core records the run snapshot, provider payload, estimate snapshot, outputs,
  diagnostics, and approval token in `media_generation_run`;
- media import is a separate core operation that registers generated files as
  assets and attaches them to their domain relationship.

Shot video take implementation should mirror the call shape in
`packages/core/src/server/media-generation/lookbook-image.ts` and reuse the
file-input conversion pattern exposed by
`packages/core/src/server/media-generation/cast-image-common.ts`.

Final video estimate and run flow:

```text
read persisted shot.video-take spec
rebuild scene-scoped shot-video-take context
validate target, intent, model, parameters, prompt, and prepared inputs
resolve prepared inputs to asset files and project-relative paths
buildShotVideoTakeProviderPayload(spec, context)
toShotVideoTakeGenerationRequest(providerPlan, spec)
load @gorenku/studio-engines
estimateGeneration({ policy, request })
runGeneration({ policy, request, inputRoot, outputRoot, approvalToken })
record media_generation_run
```

Dependency image purposes use the same flow with media kind `image`. Final
video take uses media kind `video`.

Core must pass `inputRoot` when a final video request has file inputs. The
input root is the project folder, and every `GenerationInputFile` uses an
already-validated project-relative path from `asset_file.project_relative_path`.

Live generation must fail if any of these fields changed after approval:

- provider;
- provider model;
- generation mode;
- prompt or negative prompt;
- provider parameters;
- output count or output names;
- input file field names;
- input file project-relative paths;
- input file `asArray` flags.

This prevents a user-approved estimate for one dependency set from being reused
for a different final video request.

## Model-Specific Provider Mapping

The Studio Skill and Studio UI do not build raw provider JSON.

They choose:

- intent;
- model choice;
- provider parameter values exposed by core reports;
- prepared input asset files;
- prompt drafts.

Core owns the mapping from logical shot-video-take inputs to provider fields.
The engines package owns schema validation, file upload/runtime resolution, and
provider invocation.

Add a purpose-specific provider plan type:

```ts
export interface ShotVideoTakeProviderPlan {
  provider: string;
  model: string;
  mode: GenerationMode;
  outputCount: number;
  payload: Record<string, unknown>;
  inputFiles: GenerationInputFile[];
}
```

The mapping function lives in core:

```ts
buildShotVideoTakeProviderPayload(
  spec: ShotVideoTakeGenerationSpec,
  context: ShotVideoTakeGenerationContext
): ShotVideoTakeProviderPlan
```

Rules:

- switch directly on concrete `modelChoice` values;
- validate the selected intent against the concrete model endpoint before
  mapping;
- map normalized `parameterValues` to provider fields exactly as exposed by the
  engine catalog/model report;
- map each `ShotVideoTakeGenerationInput` to one or more
  `GenerationInputFile` entries;
- use `asArray: true` only when the provider schema field is an array;
- fail with structured diagnostics when a selected input role has no mapping
  for the selected model;
- never let Studio server, React components, or the Studio Skill provide raw
  provider payload fragments.

Examples of logical-to-provider mapping:

| Intent/model shape | Logical input | Provider request shape |
| --- | --- | --- |
| image-to-video / first frame | `first-frame` | scalar image field such as `image_url` or `start_image_url` |
| first/last-frame | `first-frame`, `last-frame` | scalar start and end image fields such as `start_image_url` and `end_image_url` |
| reference-to-video | `reference-image`, `character-sheet`, `location-sheet`, `shot-reference-sheet` | provider reference image array, using `asArray: true` |
| multi-shot | `multi-shot-storyboard-sheet` plus optional character/location/lookbook references | provider multi-shot prompt definition and/or reference image array, depending on endpoint |
| audio-to-video | `audio` plus optional `first-frame` | scalar or array audio/image fields according to endpoint schema |
| extend/edit | `source-video` plus optional reference inputs | source video field plus endpoint-specific controls |

Kling/Omni-style complex models need explicit mapping entries, not ad hoc skill
logic. For example, if an endpoint accepts `multi_prompt`, `start_image_url`,
`end_image_url`, `image_urls`, and nested `elements[]` reference fields, core
builds those from the selected shot group, prepared inputs, and prompt draft.
Engines then validate the resulting logical payload against the provider schema
and resolve file inputs through the existing file-input runtime.

The model report should expose enough normalized metadata for preflight:

- supported intents;
- accepted logical input roles;
- min/max counts for each repeated input role;
- required input roles;
- provider parameter names, labels, allowed values, and defaults;
- duration support;
- whether the final provider payload can be estimated before dependency inputs
  exist.

Exact provider field names belong in the core mapping and engine catalog, not
in the Studio UI. If the catalog does not yet describe a model endpoint enough
to map `ShotVideoTakeGenerationInput[]`, the model row should be unavailable
with a concrete reason.

## Final Take Persistence

Generated final video takes are imported as Studio assets and attached to the
production group.

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
asset_file_id
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
- `asset_file_id` references the concrete imported video file;
- `media_generation_run_id` is nullable for manually imported takes;
- `scene_shot_video_take_shot` records ordered shot membership;
- a multi-shot final video is one `scene_shot_video_take` row with multiple
  ordered `scene_shot_video_take_shot` rows, not one duplicated take row per
  shot;
- at most one selected take per `scene_id`, `shot_list_id`, and
  `production_group_id`;
- deleting an asset must remove or invalidate the take relationship through the
  same cleanup pattern used by storyboard sheets;
- final video files are not stored directly in Scene Shot List JSON.

## Core Service Methods

Add concrete project data service methods:

```ts
buildShotVideoTakeContext(input)
listShotVideoTakeModels(input)
listShotVideoTakeInputs(input)
updateShotVideoTakeProductionGroup(input)
previewShotVideoTakeProduction(input)
selectShotVideoTakeInput(input)
clearShotVideoTakeInputSelection(input)

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

Private code may share private functions inside
`packages/core/src/server/media-generation/shot-video-take.ts`, but public
service names should stay purpose-specific.

`updateShotVideoTakeProductionGroup` is the primary save path for the Studio
tab. `selectShotVideoTakeInput` and `clearShotVideoTakeInputSelection` are
purpose-built command/service operations for CLI and future focused UI actions
that only change reusable dependency selection. They must update the durable
input relationship table and the production plan's `preparedInputs` together.

Core must emit scoped resource keys that Plan 0041 can use to refresh UI:

```text
scene:<scene-id>
surface:scene:<scene-id>:shots
scene-shot-list:<shot-list-id>:video-take-production
scene-shot-video-take-group:<production-group-id>
scene-shot-video-take-input:<input-id>
asset:<asset-id>
media-generation-spec:<spec-id>
media-generation-run:<run-id>
```

## CLI Requirements

The CLI remains thin. It parses flags, reads JSON files, formats output, maps
structured diagnostics to stdout/stderr, and calls core methods. It must not own
dependency planning, model filtering, provider payload construction, asset
registration, or import attachment rules.

Context:

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
```

Model list:

```bash
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
```

Production group update and preflight:

```bash
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

Reusable dependency inputs:

```bash
renku generation input list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --json

renku generation input select \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --input <shot-video-take-input-id> \
  --json

renku generation input clear \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --kind <input-kind> \
  --subject-kind <subject-kind> \
  --subject-id <subject-id> \
  --json
```

Rules:

- `input list` returns the same reusable candidates exposed in
  `context.availableInputs`;
- `input select` records `selection: 'select'` on the dependency input row and
  updates the production group's `preparedInputs`;
- `input clear` records `selection: 'take'` for the matching slot and removes
  that slot from `preparedInputs`;
- `input clear` must require `--subject-kind` and `--subject-id` when the input
  kind can have more than one subject in the same group, such as character
  sheets or reference images;
- these commands call core service methods and must not inspect asset tables or
  rewrite Scene Shot List JSON directly.

Allowed `<shot-dependency-purpose>` values:

```text
shot.first-frame
shot.last-frame
shot.reference-sheet
shot.multi-shot-storyboard-sheet
```

Concrete dependency and final specs use existing commands:

```bash
renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
renku generation run --spec <spec-id> --simulate --json
```

Media import:

```bash
renku media import \
  --purpose <shot-dependency-purpose> \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id>[,<shot-id>...] \
  --source <project-relative-path> \
  --receipt <generation-run-json> \
  --selection select|take \
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

Import purpose mapping:

```text
shot.first-frame -> first-frame
shot.last-frame -> last-frame
shot.reference-sheet -> shot-reference-sheet
shot.multi-shot-storyboard-sheet -> multi-shot-storyboard-sheet
```

Dependency imports must:

- register the generated file as a normal Studio asset and asset file;
- create a `scene_shot_video_take_input` relationship row;
- create ordered `scene_shot_video_take_input_shot` rows for the target shot
  ids;
- default the imported dependency to `selection: 'select'` unless the import
  request explicitly says `--selection take`;
- update the production group's `preparedInputs` only when the imported
  dependency is selected;
- leave previous dependency inputs available as `take` candidates instead of
  deleting or overwriting them.

Do not add aliases for experimental command names.

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
`shot.video-take`, then point to the detailed reference.

The reference must cover:

- resolving current project, scene, shot list, selected shot, and optional
  group;
- reading context and model reports through CLI;
- honoring user-selected intent, model, parameters, and shot ids;
- choosing existing cast sheets, location sheets, Lookbook images, storyboard
  images, source takes, audio files, or reference images;
- deciding concrete dependency purposes;
- using `fal-ai/openai/gpt-image-2` as the default image dependency model unless
  the user chooses otherwise;
- creating `shot.multi-shot-storyboard-sheet` before final multi-shot video;
- writing `ShotVideoTakeAgentProposal`;
- running CLI preflight before provider calls;
- estimating every persisted spec and getting approval before live runs;
- inspecting generated dependency assets before import;
- importing dependency assets with their concrete purpose;
- re-running preflight after dependency imports;
- estimating, approving, running, importing, and attaching `shot.video-take`;
- never writing `.renku/project.sqlite` directly;
- never overriding user-selected model, intent, parameters, or shot group.

Model-specific prompt guidance belongs in the skill reference, not in Studio UI
code. Use `docs/architecture/video-generation-model-capabilities.md` as the
capability source.

## Skill Reference Flow Examples

`references/shot-video-take.md` must include at least these two complete
examples. The examples should use placeholder ids, but the command order and
handoff points must be exact.

### Example 1: Single Shot, First/Last Frame Take

Scenario:

- user asks for a take for Shot 3;
- intent is `first-last-frame`;
- user selects a first/last-frame capable video model;
- no suitable first frame or last frame is currently selected.

Skill flow:

1. Read bounded context.

```bash
renku generation context \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --json
```

2. Read model choices for the selected intent.

```bash
renku generation model list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --intent first-last-frame \
  --json
```

3. Read reusable dependency candidates.

```bash
renku generation input list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --json
```

4. If the user wants reuse and compatible `first-frame` and `last-frame`
   candidates exist, select them.

```bash
renku generation input select \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --input <existing-first-frame-input-id> \
  --json

renku generation input select \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --input <existing-last-frame-input-id> \
  --json
```

5. If the user wants fresh prerequisites, create concrete dependency specs:
   one `shot.first-frame`, then one `shot.last-frame`. Use
   `fal-ai/openai/gpt-image-2` unless the user selected another image
   dependency model.

6. Validate, create, estimate, approve, and run each dependency spec through the
   existing generic spec commands.

```bash
renku generation spec validate --file shot-first-frame-spec.json --json
renku generation spec create --file shot-first-frame-spec.json --json
renku generation estimate --spec <first-frame-spec-id> --json
renku generation run --spec <first-frame-spec-id> \
  --approval-token <first-frame-approval-token> \
  --json
```

Repeat the same spec lifecycle for `shot.last-frame`.

7. Import each dependency output with its concrete purpose. Import defaults to
   selecting the new dependency for the current production group.

```bash
renku media import \
  --purpose shot.first-frame \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --source generated/media/<first-frame-output>.png \
  --receipt <first-frame-run-json> \
  --selection select \
  --json
```

Repeat for `shot.last-frame`.

8. Update the production group with the selected intent, video model,
   parameters, selected prepared inputs, and final prompt draft.

```bash
renku generation production update \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --file shot-video-take-production-group.json \
  --json
```

9. Run preflight. Preflight must show no missing first/last-frame inputs before
   the final video estimate is trusted.

```bash
renku generation preflight \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --file shot-video-take-production-group.json \
  --json
```

10. Create, estimate, approve, and run the final `shot.video-take` spec.
    Core maps the selected first and last frames into the provider fields for
    the selected model. The skill must not write raw provider field names into
    the final spec unless they are ordinary provider parameters from the model
    report.

11. Import the final video.

```bash
renku media import \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003 \
  --source generated/media/<shot-video-output>.mp4 \
  --receipt <shot-video-run-json> \
  --json
```

Expected result:

- dependency assets are reusable for later Shot 3 takes;
- final video take is attached to Shot 3 through `scene_shot_video_take` and
  `scene_shot_video_take_shot`;
- the approval token used for the final run matches the exact prompt,
  parameters, and first/last-frame files.

### Example 2: Multi-Shot Group With Storyboard Sheet

Scenario:

- user groups Shot 3 and Shot 4;
- intent is `multi-shot`;
- selected video model is a Seedance, Kling, or Kling Omni-style endpoint that
  can consume a multi-shot definition and references;
- the final generation should be one provider call, not one call per shot.

Skill flow:

1. Read context for the ordered shot group.

```bash
renku generation context \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003,shot_004 \
  --json
```

2. Confirm only `multi-shot` is valid for this group and list model choices.

```bash
renku generation model list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003,shot_004 \
  --intent multi-shot \
  --json
```

3. Read reusable input candidates. The input list may include prior
   multi-shot storyboard sheets and other shot-video-take dependency inputs for
   the same ordered shot group. The broader context includes selected character
   sheets for the referenced cast, location sheets, Lookbook images, and scene
   storyboard images.

```bash
renku generation input list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003,shot_004 \
  --json
```

4. If the user wants reuse and a compatible
   `multi-shot-storyboard-sheet` candidate exists for exactly
   `shot_003,shot_004`, select it. Otherwise clear that slot and generate a
   fresh one.

```bash
renku generation input clear \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003,shot_004 \
  --kind multi-shot-storyboard-sheet \
  --subject-kind production-group \
  --subject-id <production-group-id> \
  --json
```

5. Create a `shot.multi-shot-storyboard-sheet` dependency spec. The prompt
   should ask the image model to produce one readable sheet with one panel per
   shot, shot labels, action beats, composition notes, camera movement notes,
   cast continuity, location/view notes, and compact model-facing instructions.

6. Validate, create, estimate, approve, run, and import the storyboard sheet.

```bash
renku generation spec validate --file shot-multi-shot-storyboard-sheet-spec.json --json
renku generation spec create --file shot-multi-shot-storyboard-sheet-spec.json --json
renku generation estimate --spec <storyboard-sheet-spec-id> --json
renku generation run --spec <storyboard-sheet-spec-id> \
  --approval-token <storyboard-sheet-approval-token> \
  --json

renku media import \
  --purpose shot.multi-shot-storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots shot_003,shot_004 \
  --source generated/media/<storyboard-sheet-output>.png \
  --receipt <storyboard-sheet-run-json> \
  --selection select \
  --json
```

7. Select any additional reusable references the chosen model report accepts,
   such as character sheets, location sheets, or Lookbook reference images. The
   skill may mention provider reference tokens in the prompt only when the
   model guidance requires it, but it must still submit logical prepared inputs
   rather than raw provider payload JSON.

8. Write the production group proposal. The final prompt should describe the
   ordered shot progression as one continuous generated video while preserving
   the shot boundaries:

```text
Shot 3: Urban reads the bronze barrel by touch, smoke sliding behind him.
Shot 4: Mara and Urban are divided by bronze, their eyelines separated by the
weapon's mass.
```

9. Run preflight. For a Kling Omni-style complex endpoint, preflight is where
   core maps:

- the ordered shot group to `multi_prompt` or the endpoint's equivalent
  multi-shot definition;
- the storyboard sheet to the model's reference image field;
- selected character/location references to array or nested element fields;
- duration, audio, resolution, and other parameters to provider fields.

Engines validate the resulting logical payload against the provider schema. If
core cannot map one of the selected logical inputs, preflight returns a
structured diagnostic and the skill must revise the proposal or choose a
different model.

10. Create, estimate, approve, and run one final `shot.video-take` spec. There
    must be one final provider run for the group, not separate runs for Shot 3
    and Shot 4.

11. Import the final video. Core attaches the same video asset to the
    production group and records both ordered shot memberships.

Expected result:

- the prerequisite storyboard sheet is reusable for later takes of the same
  ordered group;
- final video take has one asset and two ordered shot links;
- Studio can later show the take as belonging to the Shot 3-4 group;
- changing the model after this point requires a new preflight because the
  logical-to-provider input mapping may change.

## Engine Catalog Requirements

The engine/model catalog needs enough metadata for core reports:

- supported final video intents;
- accepted input roles, such as start image, end image, reference image, source
  video, audio, and multi-shot storyboard sheet;
- provider field mapping metadata for every accepted input role, including
  scalar versus array file inputs;
- supported duration options by intent;
- valid provider parameter names and values;
- estimate support for concrete provider payloads;
- provider payload preparation without Studio server logic knowing provider
  quirks.

Do not introduce a generic purpose registry. Use direct purpose switching until
multiple implemented purposes prove a shared abstraction is useful.

## Implementation Checklist

- [x] Add `SceneShotListDocument.videoTakeProductionGroups`.
- [x] Add browser-safe shot-video-take contracts.
- [x] Extend shot-list JSON schema for production groups.
- [x] Validate group uniqueness, existence, ordering, and contiguity.
- [x] Add intent validation by group size.
- [x] Add stale `agentProposal` validation.
- [x] Add concrete generation purpose constants.
- [x] Extend `MediaGenerationPurpose`, spec unions, run support, and prepared
      generation support.
- [x] Add `SceneShotMediaGenerationTarget`.
- [x] Add Drizzle schema and generated migration for
      `scene_shot_video_take_input`, `scene_shot_video_take_input_shot`,
      `scene_shot_video_take` and `scene_shot_video_take_shot`.
- [x] Add database access for reusable dependency inputs.
- [x] Add database access for final video takes.
- [x] Add `packages/core/src/server/media-generation/shot-video-take.ts`.
- [x] Add scene-scoped context builders.
- [x] Add model list reports.
- [x] Add preflight report builders.
- [x] Add shot-video-take provider payload mapping.
- [x] Convert shot-video-take provider plans to engine `GenerationPolicy` and
      `GenerationRequest`.
- [x] Validate final video logical provider payloads through engines before
      estimates and runs.
- [x] Add concrete dependency spec validation/create/update/list/estimate/run.
- [x] Add final video spec validation/create/update/list/estimate/run.
- [x] Add concrete dependency imports.
- [x] Add dependency input list/select/clear service methods.
- [x] Add final video take import and attachment.
- [x] Add scoped resource keys.
- [x] Extend project data service wiring.
- [x] Extend CLI generation commands.
- [x] Extend CLI media import commands.
- [x] Update `media-producer` skill references and samples.

## Tests

Core tests:

- shot-list schema accepts valid `videoTakeProductionGroups`;
- schema rejects unknown production-group fields;
- schema rejects duplicate shot membership;
- schema rejects non-contiguous multi-shot groups;
- schema stores shot ids in active shot-list order;
- draft validation rejects unsupported intent/model combinations;
- draft validation rejects `multi-shot` for a single-shot group;
- draft validation rejects single-shot intents for a multi-shot group;
- preflight rejects stale agent proposals;
- preflight rejects stale multi-shot storyboard sheets;
- parameter validation rejects keys absent from selected model report;
- model list disables rows that do not support the selected intent;
- preflight separates prepared inputs from inputs to create;
- context exposes reusable dependency inputs from
  `scene_shot_video_take_input`;
- selecting a reusable dependency updates both the input relationship and
  production plan `preparedInputs`;
- clearing a reusable dependency removes it from `preparedInputs`;
- preflight includes dependency and final-take estimate lines;
- preview/preflight does not run paid generation;
- concrete dependency specs include scene id, shot-list id, production group id,
  and ordered shot ids;
- `shot.multi-shot-storyboard-sheet` requires a multi-shot group;
- dependency imports create reusable input relationship rows;
- dependency imports update `preparedInputs` only when imported with
  `selection: 'select'`;
- regenerating a dependency creates a new reusable input without deleting the
  previous one;
- final video estimate validates the logical provider payload through engines;
- final video run rejects stale approval tokens after prompt, parameter, or
  input file changes;
- final video run passes file inputs through `GenerationInputFile` and
  `inputRoot`;
- model-specific mapping rejects unsupported logical input roles with
  structured diagnostics;
- media-generation run records round-trip video media kind;
- final take import creates `scene_shot_video_take` and
  `scene_shot_video_take_shot` rows;
- only one take can be selected per production group.

CLI and skill tests:

- `generation context --purpose shot.video-take` requires `--target`,
  `--shot-list`, and `--shots`;
- `generation context --purpose shot.multi-shot-storyboard-sheet` requires
  contiguous `--shots`;
- `generation model list --purpose shot.video-take` honors `--intent`;
- `generation production update --purpose shot.video-take` persists the group
  and emits scoped resource keys;
- `generation preflight --purpose shot.video-take` returns
  `ShotVideoTakePreflightReport`;
- `generation input list --purpose shot.video-take` returns reusable
  dependency inputs;
- `generation input select --purpose shot.video-take` selects a reusable input
  and updates `preparedInputs`;
- `generation input clear --purpose shot.video-take` clears a selected reusable
  input slot;
- `media import --purpose shot.multi-shot-storyboard-sheet` updates
  reusable inputs and, by default, `preparedInputs` with
  `multi-shot-storyboard-sheet`;
- `media import --purpose shot.video-take` attaches the imported asset as a
  group take;
- skill reference includes exact single-shot first/last-frame flow;
- skill reference includes exact multi-shot storyboard-sheet-to-video flow;
- skill sample JSON files validate through CLI.

## Acceptance Criteria

- Production groups persist on active Scene Shot List documents.
- Production groups support one shot or contiguous ordered shot ranges.
- Core exposes scene-scoped context only.
- Core exposes final model reports and preflight reports needed by Studio.
- Concrete dependency purposes and final video take purpose persist specs and
  runs through existing media-generation tables.
- Core builds engine `GenerationPolicy` and `GenerationRequest` objects for
  dependency and final video runs, and engines validate provider payloads before
  estimates and runs.
- Imported dependency assets are stored as reusable shot-video-take inputs.
- Users and agents can choose to reuse or regenerate prerequisite dependency
  assets for later takes.
- Imported selected dependency assets update prepared inputs.
- Imported final videos attach through final video take tables.
- CLI exposes context, model list, production update, preflight, spec,
  estimate, run, reusable input selection, and media import commands for the
  new purposes.
- `media-producer` has operational guidance, samples, and complete single-shot
  and multi-shot flow examples for shot video takes.
- Plan 0041 can implement Studio server and UI without adding business logic
  outside core.
