# 0042 Shot Video Take Generation Plan Architecture

Status: proposed
Date: 2026-06-02

## Summary

The AI Production pane needs a real generation planning architecture, not UI-side
guesswork and not model-specific patches.

The core idea in this plan is:

- `packages/engines` owns the explicit shot-video model family catalog, route
  capabilities, provider model ids, provider input mappings, run settings, and
  pricing support.
- `packages/core` owns the project-aware `ShotVideoTakeGenerationPlan` that
  decides what must be generated, what can reuse existing assets, what each step
  costs, and whether the total estimate is complete.
- `packages/studio` renders the plan and sends user selections back to core. It
  does not infer model capabilities, provider schemas, route parameters, or
  pricing.

This replaces the current broken shape where Studio can select a base model row
while estimates and payloads are built from incomplete model-wide parameter
tables. That model-wide approach sends unsupported fields to some provider
variants, leaks stale settings across model switches, and only considers the
final video estimate instead of the full dependency cost.

## Relationship To Existing Plans

This plan does not replace or edit:

- `plans/active/0040-shot-video-take-core-cli.md`
- `plans/active/0041-shot-ai-production-studio-ui.md`

Instead, this plan defines the missing shared architecture those plans need in
order to be reliable.

The existing image-generation architecture remains valid:

- generation and import stay separate;
- generation specs remain explicit project-owned records;
- cost estimates are produced before approval;
- runs are executed only after approval;
- each purpose keeps a purpose-specific context and spec contract.

This plan adds a bounded planning layer for shot video takes because a video take
can depend on other generated inputs. It does not introduce a broad generic
media-generation framework.

## Current Failure Modes

The visible UI failures are symptoms of deeper contract problems.

### Base Model Rows Are Mixed With Provider Variants

The UI correctly wants to show base model choices such as:

- Seedance 2.0
- Kling 3.0
- Veo 3.1
- XAI Grok Imagine Video 1.5
- LTX 3.2
- Alibaba Happy Horse

But each base model can route to different provider model ids depending on the
intent:

- text-only;
- first frame;
- first and last frame;
- reference;
- multi-shot.

Those routes do not share the same provider schema.

Concrete examples found while debugging the current implementation:

- Kling image-to-video rejects `aspect_ratio`, even though Kling text-to-video
  accepts it.
- Veo 3.1 image-to-video rejects `seed`.
- Alibaba Happy Horse image-to-video rejects `aspect_ratio`.
- LTX image-to-video duration must match the actual enum for the provider route,
  not the base-model display row.
- Grok Imagine Video 1.5 must be resolved to the v1.5 provider schema. Older or
  adjacent Grok schemas cannot be used to infer v1.5 behavior.

The fix is an explicit route catalog, not schema deduction from loose naming.

### Run Setup Is Model-Wide Instead Of Route-Specific

The current Run Setup can show and submit settings that belong to a different
route. That causes estimates and runs to fail even when the selected row says
`Ready`.

The settings must come from the selected route:

- route-supported fields only;
- route-specific defaults;
- route-specific allowed values;
- route-specific input slots;
- route-specific pricing requirements.

When the user changes model or intent, saved settings from the old route must not
leak into the new route's provider payload.

### Estimates Price Only The Final Model

The total estimate must include all planned generation steps, not only the final
video model.

For example, a first-frame video take may need:

1. a first-frame image asset;
2. the final image-to-video generation.

If the first-frame image already exists and is selected, that line costs `$0`.
If it does not exist, or if the user asks to regenerate it, its image generation
cost must be part of the total.

The same rule applies to:

- last-frame images;
- reference images;
- storyboard sheets;
- character or location images when a selected workflow requires them;
- any other project asset that must be generated before the final video route
  can run.

If a dependency cannot yet be priced exactly, the estimate should say that the
plan is partial. It should not silently show `-`.

## Non-Goals

This plan deliberately does not do these things:

- no Studio-side capability inference;
- no schema-based guessing of model families from provider ids;
- no compatibility layer for the current broken parameter shape;
- no generic plugin-style media-purpose framework;
- no paid generation from a browser estimate request;
- no hidden fallback when a required route, schema, mapping, or pricing function
  is missing.

Missing route data should fail fast with structured diagnostics.

## Package Responsibilities

### Engines

`packages/engines` owns provider-facing generation facts:

- provider model catalogs;
- provider schemas;
- shot-video model families;
- route capabilities;
- provider input mappings;
- provider parameter mappings;
- route default values;
- allowed route settings;
- pricing functions;
- estimate validation against provider schemas.

The engines package must be able to answer:

- Which base shot-video models are selectable?
- Which intent routes does each base model support?
- Which provider model id is used for a route?
- Which run settings are legal for that route?
- Which provider input fields are required for that route?
- Which pricing function estimates that route?
- Is the route fully configured and estimateable?

### Core

`packages/core` owns project-aware planning:

- selected scene, shot list, and production group;
- selected intent;
- selected base model;
- selected route;
- current user run settings;
- existing available assets;
- missing inputs;
- dependency generation steps;
- total estimate;
- structured plan diagnostics;
- materialization into persisted generation specs.

Core must be the only layer that decides whether a video take can reuse existing
assets or needs additional generated inputs.

### Studio Server

The Studio server is a thin adapter:

- receives the browser request;
- loads project context;
- calls core planning functions;
- serializes the plan response;
- reports structured diagnostics.

It does not contain model capability logic.

### Studio Browser

The Studio browser renders:

- model family rows;
- intent availability;
- route-specific run controls;
- plan line items;
- total estimate state;
- structured issues.

It does not inspect provider schemas or decide which provider fields are valid.

### CLI And Agent Skill Contract

The CLI and Renku media-producer skill use the same core plan as Studio. The CLI
is the agent-facing contract for this architecture, so the required outcome is
"the agent can read the same plan the Studio UI previews through a Renku
command."

This prevents a model from estimating in the browser but failing when the agent
creates the real generation spec, or vice versa.

The CLI must stay a thin wrapper over core, but "thin" does not mean one giant
function full of nested branches. The shot-video plan command must be read-only
and implemented through a small command handler. Do not add more nested purpose
branches to `packages/cli/src/commands/media-command.ts` or more nested purpose
ternaries to `packages/cli/src/commands/generation-command.ts`. The CLI
structure cleanup is tracked separately in
`plans/active/0044-cli-command-architecture-refactor.md`.

## Engine Model Family Catalog

Add an explicit shot-video model family catalog in `packages/engines`.

Proposed files:

- `packages/engines/src/shot-video/shot-video-model-families.ts`
- `packages/engines/src/shot-video/shot-video-route-validation.ts`
- `packages/engines/src/shot-video/shot-video-route-parameters.ts`
- `packages/engines/src/shot-video/shot-video-route-pricing.ts`

The catalog should describe base models and their route variants directly.

Proposed public types:

```ts
export type ShotVideoTakeIntent =
  | "text-only"
  | "first-frame"
  | "first-and-last-frame"
  | "reference"
  | "multi-shot";

export type ShotVideoTakeModelChoice =
  | "seedance-2"
  | "kling-3"
  | "veo-3-1"
  | "xai-grok-imagine-video-1-5"
  | "ltx-3-2"
  | "alibaba-happy-horse";

export interface ShotVideoModelFamily {
  choice: ShotVideoTakeModelChoice;
  label: string;
  version: string;
  provider: "fal-ai";
  routes: ShotVideoRoute[];
}

export interface ShotVideoRoute {
  intent: ShotVideoTakeIntent;
  providerModel: string;
  inputSlots: ShotVideoInputSlot[];
  parameters: ShotVideoRouteParameter[];
  pricing: ShotVideoRoutePricing;
}
```

Each route owns its parameters. The base model does not.

Example:

```ts
{
  choice: "kling-3",
  label: "Kling",
  version: "3.0",
  provider: "fal-ai",
  routes: [
    {
      intent: "text-only",
      providerModel: "fal-ai/kling-video/v3/pro/text-to-video",
      inputSlots: [],
      parameters: [
        { id: "duration", providerField: "duration", control: "duration" },
        { id: "aspect_ratio", providerField: "aspect_ratio", control: "select" },
        { id: "generate_audio", providerField: "generate_audio", control: "switch" },
        { id: "cfg_scale", providerField: "cfg_scale", control: "number" }
      ],
      pricing: { estimator: "fal-ai/kling-video/v3/pro/text-to-video" }
    },
    {
      intent: "first-frame",
      providerModel: "fal-ai/kling-video/v3/pro/image-to-video",
      inputSlots: [{ id: "first_frame", providerField: "start_image_url" }],
      parameters: [
        { id: "duration", providerField: "duration", control: "duration" },
        { id: "generate_audio", providerField: "generate_audio", control: "switch" },
        { id: "cfg_scale", providerField: "cfg_scale", control: "number" }
      ],
      pricing: { estimator: "fal-ai/kling-video/v3/pro/image-to-video" }
    }
  ]
}
```

That distinction prevents `aspect_ratio` from being sent to Kling image-to-video.

## Duration Contract

Durations need a deliberate display and payload contract.

Proposed type:

```ts
export type ShotVideoDurationDomain =
  | {
      kind: "continuous";
      minSeconds: number;
      maxSeconds: number;
      stepSeconds: number;
    }
  | {
      kind: "discrete";
      valuesSeconds: number[];
    };
```

Display rules:

- continuous durations render as `3-10s`;
- discrete durations render as `4, 8, 12s`;
- a single allowed value renders as `6s`;
- long slash-separated lists are not allowed in the model table.

Payload rules:

- each route defines how seconds are encoded for the provider;
- examples: `9`, `"9"`, `"9s"`, or provider-specific enum values;
- the encoding is validated against the provider schema before estimate or run.

Important rule:

The display row, run setup control, estimate payload, and run payload must all
come from the same route duration contract.

## Capability Contract

Capabilities should not be inferred from schema shape alone.

The route catalog is the source of truth for:

- whether a model supports text-only;
- whether it supports first frame;
- whether it supports first and last frame;
- whether it supports reference inputs;
- whether it supports multi-shot;
- whether it supports native audio generation;
- whether it supports a setting such as aspect ratio, resolution, seed, guidance
  scale, or safety checker.

Provider schemas are used to validate that the explicit catalog is true. They are
not used to invent capabilities.

If a route exists in the catalog but its provider schema does not match the
declared fields, engine validation fails.

## Route Validation

Add engine validation that runs in tests and can be called by core during
startup or diagnostics.

Validation must check:

- every route provider model exists in the provider catalog;
- every route input `providerField` exists in the provider input schema;
- every route parameter `providerField` exists in the provider input schema;
- every default value is valid for the provider schema;
- every discrete duration value is valid for the provider schema;
- every continuous duration range is valid for the provider schema;
- required provider fields are supplied by one of:
  - the prompt builder;
  - a declared input slot;
  - a declared parameter;
  - a documented route default;
- every selectable route has pricing support;
- model family labels and versions match the user-facing base model list.

Validation should return structured diagnostics, not loose thrown errors.

Proposed diagnostic code prefix:

- `ENGINES_SHOT_VIDEO_ROUTE_*`

Example codes:

- `ENGINES_SHOT_VIDEO_ROUTE_UNKNOWN_PROVIDER_MODEL`
- `ENGINES_SHOT_VIDEO_ROUTE_UNKNOWN_INPUT_FIELD`
- `ENGINES_SHOT_VIDEO_ROUTE_INVALID_DEFAULT`
- `ENGINES_SHOT_VIDEO_ROUTE_INVALID_DURATION`
- `ENGINES_SHOT_VIDEO_ROUTE_MISSING_REQUIRED_FIELD`
- `ENGINES_SHOT_VIDEO_ROUTE_MISSING_PRICING`

## Pricing Registry

The engines package should expose a pricing registry that can answer whether a
provider model is estimateable before it is shown as `Ready`.

Proposed file:

- `packages/engines/src/generation/generation-pricing-registry.ts`

Proposed public type:

```ts
export interface GenerationPricingSupport {
  provider: string;
  providerModel: string;
  estimateable: boolean;
  reason?: string;
}
```

The registry should be used by:

- engine route validation;
- core generation planning;
- Studio model row status;
- CLI plan output.

If a route cannot be priced, the UI should not show a plain `Ready` status. It
should show a short status such as `No price` and the plan should include a
structured issue. `No price` is still selectable; it means real generation
requires explicit unpriced-cost approval.

## Core Generation Plan Contract

Add a read-only computed plan contract in `packages/core`.

Proposed files:

- `packages/core/src/media-generation/media-generation-dependency-map.ts`
- `packages/core/src/media-generation/media-generation-dependency-resolver.ts`
- `packages/core/src/media-generation/media-generation-purpose-dependencies.ts`
- `packages/core/src/media-generation/shot-video-take-generation-plan.ts`
- `packages/core/src/media-generation/shot-video-take-generation-planner.ts`
- `packages/core/src/media-generation/shot-video-take-plan-materializer.ts`

Proposed public types:

```ts
export interface ShotVideoTakeGenerationPlanRequest {
  projectId: string;
  sceneId: string;
  shotListId: string;
  productionGroupId: string;
  intent: ShotVideoTakeIntent;
  modelChoice: ShotVideoTakeModelChoice;
  routeSettings: Record<string, unknown>;
  inputPolicy: ShotVideoTakeInputPolicy;
}

export interface ShotVideoTakeGenerationPlan {
  request: ShotVideoTakeGenerationPlanRequest;
  model: ShotVideoTakePlanModel;
  route: ShotVideoTakePlanRoute;
  dependencyMap: MediaGenerationDependencyMap;
  lines: MediaGenerationPlanLine[];
  estimate: ShotVideoTakeGenerationPlanEstimate;
  diagnostics: Diagnostic[];
}

export interface ShotVideoTakeGenerationPlanEstimate {
  state: "complete" | "partial" | "unavailable";
  estimatedTotalUsd: number | null;
  pricedLineCount: number;
  unpricedLineCount: number;
  missingLineCount: number;
  requiresPriceOverride: boolean;
}
```

The plan is computed. It does not mutate the database.

Persisted generation specs are created only after the user or agent accepts the
plan. A plan with unpriced lines can still be accepted and run, but only through
an explicit unpriced-cost override. The override must be visible in Studio,
printed by CLI plan output, and recorded by the agent workflow. Missing price
support is a development signal, not a hard product stop.

## Relationship To Existing Media Generations

This plan may reuse existing media generation purposes as concrete dependency
nodes, but it does not refactor every existing generation purpose into a shared
purpose registry.

This plan does own the new shot-video purpose architecture for:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-sheet` when the product keeps it as a shot-level purpose;
- `shot.multi-shot-storyboard-sheet`;
- `shot.video-take`.

Those purposes should be implemented in the new architecture during `0042`, not
left for the follow-up existing-generation refactor.

For example, a shot-video plan can say that a missing character reference should
be produced through `cast.character-sheet`. The implementation can materialize
that dependency through the current character-sheet generation flow for this
slice. It should not copy character-sheet prompt, context, provider-payload,
output naming, or import behavior into the shot-video planner.

The broader cleanup of existing media generation purposes belongs to the
follow-up plan:

- `plans/active/0043-existing-media-generation-purpose-architecture-refactor.md`

That follow-up plan should run after this shot-video plan is implemented, so the
new shot-video dependency behavior provides concrete requirements for the shared
generation-purpose architecture.

## Shared Dependency Map Service

The dependency map service is broader than a single video route because it can
represent dependency nodes for concrete media purposes such as
`cast.character-sheet`, `location.environment-sheet`, `lookbook.image`, selected
uploads, or future audio/video purposes. It is narrower than a full
generation-purpose registry because it does not write prompts, build provider
payloads, or run providers itself.

The shared part is:

- declaring dependency slots;
- resolving those slots against project assets;
- planning missing inputs;
- estimating the dependency graph;
- exposing the graph to Studio, CLI, and agent workflows.

The purpose-specific part remains purpose-specific:

- each purpose still owns its context builder;
- each purpose still owns its prompt/spec builder;
- each purpose still owns validation for its domain target.

Proposed public types:

```ts
export type MediaGenerationDependencyNodeKind =
  | "existing-asset"
  | "planned-generation"
  | "external-input-required"
  | "final-generation";

export type MediaGenerationDependencyNodeState =
  | "ready"
  | "planned"
  | "missing";

export type MediaGenerationDependencyPricing =
  | {
      state: "priced";
      estimatedUsd: number;
    }
  | {
      state: "unpriced";
      estimatedUsd: null;
      reason: string;
      overrideRequired: true;
    }
  | {
      state: "not-applicable";
      estimatedUsd: null;
    };

export interface MediaGenerationDependencyMap {
  rootPurpose: MediaGenerationPurpose;
  nodes: MediaGenerationDependencyNode[];
  edges: MediaGenerationDependencyEdge[];
  estimate: MediaGenerationDependencyEstimate;
  execution: MediaGenerationDependencyExecution;
  diagnostics: Diagnostic[];
}

export interface MediaGenerationDependencyNode {
  id: string;
  kind: MediaGenerationDependencyNodeKind;
  purpose: MediaGenerationPurpose | null;
  mediaKind: MediaKind;
  label: string;
  state: MediaGenerationDependencyNodeState;
  pricing: MediaGenerationDependencyPricing;
  slotId?: string;
  routeInputKind?: string;
  generationTarget?: MediaGenerationTarget;
  assetId?: string;
  assetFileId?: string;
  draftGenerationSpec?: DraftMediaGenerationSpec;
  diagnostics: Diagnostic[];
}

export interface MediaGenerationDependencyEdge {
  fromNodeId: string;
  toNodeId: string;
  slotId: string;
}

export interface MediaGenerationDependencyExecution {
  topologicalNodeIds: string[];
  levels: string[][];
  diagnostics: Diagnostic[];
}
```

The AI Production pane, Preview Take Plan dialog, CLI plan command, and
media-producer skill should all read the same `MediaGenerationDependencyMap`.

This is the contract that lets the Preview Take Plan dialog show everything that
will go into the shot video generation:

- which assets will be reused;
- which assets will be generated first;
- which required references are missing;
- which line items contribute to the total estimate;
- which line items have no estimate and require an explicit unpriced override.

`MediaGenerationDependencyMap` must support dependencies of any media kind:
image, audio, video, text, JSON, or any future media kind already represented by
the shared media model. A dependency can resolve to:

- a project asset created by a previous generation run;
- a project asset uploaded or attached manually;
- a planned generation node for a concrete media purpose;
- a required external input that must be attached before the dependent node can
  run.

The current implementation slice does not need to add audio generation purposes.
It must not, however, design dependency slots as image-only. Some future video
routes, such as audio-to-video routes with an `audio_url` provider input, need an
audio dependency node. Native video audio generation, such as a
`generate_audio` route setting, remains a route parameter and does not create an
audio dependency.

## Purpose Dependency Declarations

Each generation purpose can declare dependency slots.

Proposed type:

```ts
export interface MediaGenerationPurposeDependencyDeclaration {
  purpose: MediaGenerationPurpose;
  slots: MediaGenerationDependencySlot[];
}

export interface MediaGenerationDependencySlot {
  id: string;
  label: string;
  cardinality: "one" | "many";
  required: boolean;
  acceptedMediaKinds: MediaKind[];
  assetSelector: MediaGenerationAssetSelector;
  missingInputBehavior: "plan-generation" | "require-attachment" | "generate-or-attach";
  generationPurpose?: MediaGenerationPurpose;
}
```

Examples:

- `shot.video-take` can declare slots for first frame, last frame, reference
  images, reference audio, reference video, and storyboard context.
- `cast.character-sheet` can declare a dependency on the active visual-language
  lookbook.
- `location.environment-sheet` can declare a dependency on the active
  visual-language lookbook.

This keeps the system extensible while avoiding hidden Studio-side rules. Future
domains should be added by registering their own asset selectors, dependency
slots, and media purposes in the same contract. Do not add one-off future-domain
branches to the shot-video planner before those domains exist in the product
model.

## Dependency Depth And Ordering

The dependency map must support transitive dependencies, not just the immediate
inputs of the final video route.

Resolver behavior:

1. Start with the root purpose, target, selected model family, selected route,
   route settings, and input policy.
2. Add the root final-generation node.
3. Resolve the selected route's immediate input slots.
4. For each slot, reuse an existing project asset when the selector finds one
   and the input policy allows reuse.
5. If no valid asset exists and the slot has a concrete `generationPurpose`, add
   a planned-generation node for that purpose.
6. Resolve that planned node's own dependency declaration in the same way.
7. Continue until every leaf is an existing asset, a planned generation with no
   unresolved prerequisites, or a required attachment.
8. Detect cycles and invalid declarations with structured diagnostics.

The dependency resolver should return a topological execution order and grouped
execution levels. Independent planned-generation nodes in the same level can be
worked on concurrently by an agent workflow. A child node must not run until its
own prerequisites are resolved, imported, and visible as project assets.

The shared service owns graph resolution and ordering. Purpose-specific context
builders and spec builders still own the content of each planned generation.

## Reference Bundle Resolution

Reference intent is not one fixed input and not one generic `shot.reference`
image. It is a project-aware reference bundle whose nodes come from concrete
asset purposes and attachments.

For a selected scene shot, the dependency resolver should derive applicable
reference slots from the shot context:

- cast members present in the shot;
- locations present in the shot;
- selected lookbook or visual-language references;
- optional audio references when a selected route supports or requires them;
- optional video references when a selected route supports or requires them.

Each slot can resolve to zero, one, or many assets.

Examples:

- A two-character shot can produce two character-sheet reference nodes.
- A shot in an established location can reuse one selected location sheet.
- A route with native `generate_audio` does not require an audio asset; it uses a
  route parameter.
- A route that accepts audio conditioning, for example an audio-to-video route
  with an `audio_url` provider field, can declare an audio input slot. If the
  audio asset is missing, the dependency map shows `generate-or-attach` or
  `require-attachment` according to the slot declaration.
- A manually attached audio or video file can satisfy a route input the same way
  a generated image asset can satisfy an image input.

The final video route receives only resolved provider-compatible inputs. The
Preview Take Plan dialog receives the full dependency map so the user can inspect
why each input is included.

## Plan Lines

Plan lines are a UI, CLI, and agent-facing projection of dependency nodes. They
are not a separate shot-only dependency model.

Proposed type:

```ts
export type MediaGenerationPlanLineKind =
  | "reused-asset"
  | "dependency-generation"
  | "required-attachment"
  | "final-video-generation";

export interface MediaGenerationPlanLine {
  id: string;
  nodeId: string;
  kind: MediaGenerationPlanLineKind;
  label: string;
  purpose: MediaGenerationPurpose | null;
  mediaKind: MediaKind;
  slotId?: string;
  depth: number;
  state: MediaGenerationDependencyNodeState;
  pricing: MediaGenerationDependencyPricing;
  sourceAssetId?: string;
  draftGenerationSpec?: DraftMediaGenerationSpec;
  diagnostics: Diagnostic[];
}
```

Examples:

- Existing first frame:
  - kind: `reused-asset`
  - mediaKind: `image`
  - pricing: `{ state: "priced", estimatedUsd: 0 }`
  - state: `ready`
- Missing first frame that can be generated:
  - kind: `dependency-generation`
  - purpose: `shot.first-frame`
  - pricing: image estimate, or `unpriced` when the estimator is missing
  - state: `planned`
- Missing route audio reference that cannot yet be generated by the app:
  - kind: `required-attachment`
  - mediaKind: `audio`
  - pricing: `{ state: "not-applicable", estimatedUsd: null }`
  - state: `missing`
- Reference image from a cast member:
  - kind: `reused-asset` or `dependency-generation`
  - purpose: `cast.character-sheet`
  - mediaKind: `image`
- Final video:
  - kind: `final-video-generation`
  - purpose: `shot.video-take`
  - pricing: video route estimate, or `unpriced` when the estimator is missing
  - state: `planned`

There is no generic `shot.reference-image` purpose in this plan. Reference
inputs are satisfied by the concrete asset or generation purpose that owns the
reference: cast sheets, location sheets, lookbook images, manually attached
media files, future audio assets, future video assets, or another real purpose
when it is added throughout the product.

The total is the sum of priced lines. If one or more runnable generation lines
are unpriced, the plan is `partial`, the unpriced lines are listed explicitly,
and generation requires an explicit unpriced-cost override.

## Input Policy

The planner needs an explicit input policy so it does not guess whether to reuse
or regenerate assets.

Proposed type:

```ts
export interface ShotVideoTakeInputPolicy {
  defaultMode: ShotVideoInputPolicyMode;
  slotModes?: Record<string, ShotVideoInputPolicyMode>;
}

export type ShotVideoInputPolicyMode =
  | "reuse-selected"
  | "regenerate"
  | "auto";
```

Initial Studio behavior can use `auto`:

- reuse the selected asset when one exists and is valid for the route;
- plan generation when no valid asset exists;
- show a missing attachment line when the input must be attached manually.

Later UI work can expose more explicit user controls without changing the core
planning contract.

## Parameter Normalization

Core must normalize settings through the selected route before estimate,
materialization, or run.

Normalization rules:

1. Start with route defaults.
2. Apply project or Studio defaults only when the route declares that setting.
3. Apply saved user settings only when the route declares that setting.
4. Reject invalid setting values with structured diagnostics.
5. Drop stale settings from previous routes before building provider input.
6. Encode values using the route's provider encoding rules.
7. Validate the final provider input against the provider schema.

This solves the current failures where old settings such as `seed` or
`aspect_ratio` are submitted to provider variants that do not accept them.

This is not a compatibility layer. It is the current intended behavior for
switching model families and intents.

Proposed diagnostic code prefix:

- `CORE_SHOT_VIDEO_PLAN_*`

Example codes:

- `CORE_SHOT_VIDEO_PLAN_UNSUPPORTED_INTENT`
- `CORE_SHOT_VIDEO_PLAN_INVALID_SETTING`
- `CORE_SHOT_VIDEO_PLAN_STALE_SETTING_DROPPED`
- `CORE_SHOT_VIDEO_PLAN_MISSING_INPUT_ASSET`
- `CORE_SHOT_VIDEO_PLAN_UNPRICED_LINE`
- `CORE_SHOT_VIDEO_PLAN_REQUIRED_ATTACHMENT_MISSING`
- `CORE_SHOT_VIDEO_PLAN_UNPRICED_OVERRIDE_REQUIRED`

Warnings such as `CORE_SHOT_VIDEO_PLAN_STALE_SETTING_DROPPED` should be hidden
from the compact UI by default but available in debug output.

## One Provider Payload Builder

There must be one path from route plus normalized settings to provider payload.

The same payload builder must be used by:

- preview plan estimates;
- persisted spec validation;
- approval summaries;
- actual generation runs.

This prevents the browser estimate path from succeeding while the real run path
fails with a different payload.

Proposed files:

- `packages/core/src/media-generation/shot-video-take-provider-input.ts`
- `packages/core/src/media-generation/shot-video-take-estimate.ts`

## Dependency Estimates

The total estimate is a plan-level estimate, not a video-model-only estimate.

The planner must ask the shared dependency resolver for the selected purpose,
target, route, route settings, and input policy.

For each generation node:

1. Build the draft spec through the purpose-specific generation architecture.
2. Estimate that draft spec through the existing engines estimate path when an
   estimator exists.
3. If the estimator returns a price, mark the line `priced`.
4. If the estimator is missing or cannot price the current route, mark the line
   `unpriced` with a structured diagnostic.
5. Do not disable generation solely because the line is unpriced.

Final video estimate behavior:

- If all required inputs are reused assets, use their real file references.
- If required inputs are planned dependency outputs that do not exist yet, the
  final video estimate can be priced only when the route pricing function does
  not need real input-file data.
- If a required input is missing and has neither a selected asset nor a planned
  generation node, do not fabricate a final-video estimate. Show the missing
  attachment or missing generation line.

Plan estimate state:

- `complete`: every runnable generation line is priced and no required input is
  missing;
- `partial`: at least one runnable generation line is unpriced, or a downstream
  estimate waits for a dependency output;
- `unavailable`: the selected route, required schema mapping, required setting,
  or required purpose contract is invalid enough that the plan cannot build a
  provider-compatible draft.

This makes the displayed total honest without turning missing pricing support
into a hard stop.

## Unpriced Override

Unpriced lines must be highly visible because missing estimates are often a
development bug. They must not silently appear as `-`.

The approval summary should include:

- the sum of all priced lines;
- each unpriced line, with purpose, model, route, and reason;
- a statement that the actual provider cost is unknown for those lines;
- an explicit user approval or agent override record before a real run.

The run authorization contract should distinguish estimated approval from an
unpriced override. A possible shape is:

```ts
export type MediaGenerationRunAuthorization =
  | {
      kind: "estimated";
      approvalToken: string;
    }
  | {
      kind: "unpriced-override";
      overrideToken: string;
      approvedBy: "user" | "agent";
      reason: string;
    };
```

The exact token shape can be implemented in the engines package, but the rule is
fixed: unpriced generation can run only after the user or agent explicitly
accepts unknown cost for the exact spec and provider context.

## Image Dependency Purposes

Shot-video dependencies should use concrete existing purposes where those
purposes already exist.

For `cast.character-sheet`, the shot-video planner may discover that a video
take needs a character sheet and expose a missing or reused character-sheet node
in the dependency map. Materialization can then use the current character-sheet
generation flow. The shot-video planner must not rebuild character-sheet
context, prompt, provider-payload, output naming, or import logic inside
`shot-video-take.ts`.

For example:

- first-frame generation should use the `0042` `shot.first-frame` purpose;
- last-frame generation should use the `0042` `shot.last-frame` purpose;
- storyboard-sheet generation should use the `0042`
  `shot.multi-shot-storyboard-sheet` purpose when the route needs shot-level
  storyboard inputs, or the current `scene.storyboard-sheet` purpose when the
  dependency is truly scene-level.
- character-sheet generation can use the existing `cast.character-sheet`
  purpose.

If a new shot frame image purpose is required, it should be added as a real
purpose with its own context and spec contract, not as a hidden video-planner
subroutine.

Confirmed shot-video purposes:

- `shot.first-frame`
- `shot.last-frame`
- `shot.multi-shot-storyboard-sheet`
- `shot.video-take`

Do not add `shot.reference-image`. A reference bundle should resolve to concrete
assets and purposes such as `cast.character-sheet`,
`location.environment-sheet`, `lookbook.image`, selected uploads, or future
audio/video purposes when those purposes are added across the product.

`shot.reference-sheet` can remain a concrete shot-level sheet purpose when the
product explicitly needs one model-facing reference sheet for a shot. It is not
the generic representation of all reference images.

Non-shot generations can use the same dependency map mechanism later, after the
shot-video plan proves the dependency contract.

For example, a character-sheet generation request can declare:

- final purpose: `cast.character-sheet`;
- dependency slot: active lookbook reference;
- behavior: reuse selected lookbook asset if present, otherwise generate or
  require attachment depending on the current product decision.

The character-sheet purpose still owns its prompt and spec builder in this
slice. The follow-up existing-generation refactor plan should move standalone
purposes onto a shared lifecycle and purpose-definition architecture once this
shot-video dependency plan is implemented.

## Plan Materialization And Agent Execution

The read-only plan must be materialized node by node before generation runs.
Core should not automatically execute the full tree from a browser estimate
request.

Core materialization should:

1. validate that the selected dependency node is still current against the
   project state;
2. build or accept the purpose-specific draft spec for that node;
3. persist that node's generation spec;
4. estimate the spec when pricing support exists;
5. produce either estimated approval data or an explicit unpriced override
   requirement.

The Studio Skill execution workflow should live in:

- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`

Agent execution should:

1. read the plan through the CLI plan command;
2. inspect `dependencyMap.execution.levels`;
3. for each level, start one worker or subagent per independent planned
   generation node when parallel work is useful;
4. have each worker use the existing media generation flow for that node's
   concrete purpose;
5. estimate the node's spec and ask for user approval, or ask for an explicit
   unpriced override when the estimate is missing;
6. run the approved spec;
7. inspect the generated media when the purpose requires inspection;
8. import or attach the generated output as a project asset;
9. refresh the root plan after each completed level;
10. generate the final `shot.video-take` only after all required input assets
    exist and the refreshed plan validates.

The agent must not assume draft output slots are real assets. It must refresh the
plan after dependency imports so the final video route receives real
project-relative file references.

The plan id should be stored on generated specs and runs so the full cost of a
video take can be audited later. Actual costs should record whether each run was
priced or executed through an unpriced override.

## Studio API

Replace the current estimate-only browser behavior with a plan endpoint.

Proposed route:

```http
POST /api/projects/:projectId/scenes/:sceneId/shot-video-take/plan
```

Request:

```ts
export interface StudioShotVideoTakePlanRequest {
  shotListId: string;
  productionGroupId: string;
  intent: ShotVideoTakeIntent;
  modelChoice: ShotVideoTakeModelChoice;
  routeSettings: Record<string, unknown>;
  inputPolicy: ShotVideoTakeInputPolicy;
}
```

Response:

```ts
export interface StudioShotVideoTakePlanResponse {
  plan: ShotVideoTakeGenerationPlan;
}
```

The existing UI can continue to look visually similar, but the data source
changes:

- model rows come from engine model families;
- status comes from route availability and pricing support;
- run controls come from route parameters;
- estimate total comes from the plan;
- debug details come from plan diagnostics.

## Studio UI Behavior

The AI Production pane should render the plan state in compact product language.

Model row status should be short:

- `Ready`
- `No input`
- `No price`
- `Unavailable`

Long explanations belong in tooltips or debug details, not the table status
cell.

Estimated total display:

- complete: `$3.40`
- partial with unpriced lines: `$3.40 + unpriced`
- partial with pending dependency outputs: `$3.40 + pending`
- unavailable: `Needs plan`

The total area should also show line details when expanded:

- `First frame image: reused`
- `Final video: $3.40`
- `Dialogue guide audio: attach needed`
- `Location sheet: unpriced`

The compact UI should never silently show `-` when the planner has diagnostics.
If an estimate is missing, the UI should show that the line is unpriced and why.
`No price` should not prevent selecting a route; it warns that running requires
an explicit unpriced override.

## CLI Plan Surface

Add a CLI command that exposes the same core plan used by Studio. This is the
agent-facing contract for the media-producer skill.

Proposed command:

```bash
renku generation plan \
  --purpose shot.video-take \
  --scene <scene-id> \
  --shot-list <shot-list-id> \
  --production-group <production-group-id> \
  --intent <intent> \
  --model <model-choice> \
  --json
```

The plan surface should:

- print model and route information;
- print each plan line;
- print total estimate state;
- print topological execution levels;
- print required attachments;
- print unpriced lines and override requirements;
- print diagnostics;
- perform no generation;
- mutate no project state.

The existing `renku generation run --spec ...` flow remains the run surface after
spec materialization and approval.

CLI implementation rules:

- do not add this command to `packages/cli/src/commands/media-command.ts`;
- do not add another nested branch chain to `runMediaCommand`;
- do not extend `runGenerationCommand` with another large inline conditional
  block;
- route `generation plan` to a small handler module such as
  `packages/cli/src/commands/generation-plan-command.ts`, or complete the CLI
  command-architecture refactor from
  `plans/active/0044-cli-command-architecture-refactor.md` first;
- any purpose-specific CLI dispatch touched by this iteration should use an
  explicit handler map or typed registry.

## Implementation Phases

### Phase 1: Route Audit

Audit the provider schemas under:

- `packages/engines/catalog/models/fal-ai/video`

For each of the six requested base models, record:

- exact provider model ids for each supported route;
- exact supported intents;
- exact route parameters;
- exact input fields;
- exact duration domains;
- exact pricing support.

Output:

- engine route catalog first draft;
- notes for unresolved provider/version questions.

### Phase 2: Engine Route Catalog

Implement the shot-video route catalog and validation.

Acceptance criteria:

- base model rows are explicit and versioned;
- route support is explicit;
- parameter support is route-specific;
- route validation catches invalid provider fields;
- route validation catches invalid duration values;
- every selectable route has pricing support or is marked `No price`.

### Phase 3: Core Route Projection And Settings

Implement core functions that turn engine routes into project-safe UI
projections.

Acceptance criteria:

- switching model or intent cannot leak stale settings;
- unsupported settings are removed before provider payload building;
- invalid settings report structured diagnostics;
- run setup controls are generated from the selected route only.

### Phase 4: Plan Builder

Implement `ShotVideoTakeGenerationPlan`.

Acceptance criteria:

- reused input assets appear as `$0` lines;
- missing inputs appear as dependency lines;
- final video appears as a final generation line;
- total estimate state is `complete`, `partial`, or `unavailable`;
- missing required attachments prevent fabricated final-video estimates;
- unpriced generation lines remain runnable only through explicit override.

### Phase 5: Shared Dependency Map

Implement `MediaGenerationDependencyMap` and the dependency resolver.

Acceptance criteria:

- shot-video plans expose the dependency map used by the AI Production pane;
- Preview Take Plan dialog can render the same dependency map;
- dependency slots support one-to-one and one-to-many references;
- dependency resolution supports transitive dependencies;
- dependency resolution returns topological execution levels;
- reference intent can resolve cast, location, lookbook, audio, and video slots
  when the selected route declares them;
- non-shot image purposes can declare dependencies such as lookbook references
  only when the follow-up existing-generation refactor adds those declarations;
- dependency map output is stable enough for Studio, CLI, and agent workflows.

### Phase 6: Dependency Spec Builders

Add or confirm the purpose-specific builders needed by currently supported video
routes. The shot image and shot video purposes listed here are owned by this
plan and should be implemented in the new shot-video architecture, not deferred
to plan `0043`.

Acceptance criteria:

- first-frame dependencies can be planned and estimated through the `0042`
  `shot.first-frame`;
- last-frame dependencies can be planned and estimated through the `0042`
  `shot.last-frame`;
- multi-shot storyboard dependencies can be planned and estimated through the
  `0042`
  `shot.multi-shot-storyboard-sheet`;
- reference bundles use concrete purpose nodes such as cast sheets, location
  sheets, lookbook images, uploaded media, or route-declared audio/video slots;
- dependencies use the same engine estimate path as normal image generation;
- no hidden image-generation logic is embedded in Studio or the shot-video
  planner.

### Phase 7: Materialization, Override, And Agent Workflow

Implement node-by-node materialization, unpriced override support, and the
plan-driven media-producer skill workflow.

Acceptance criteria:

- dependency specs and final video specs share one plan id when they are part of
  the same root plan;
- approval summary includes all priced lines and all unpriced override lines;
- unpriced generation can run only after explicit user or agent override;
- the media-producer skill iterates dependency levels, can delegate independent
  nodes to subagents, imports completed dependency assets, refreshes the plan,
  and runs final video only after required inputs exist;
- recorded costs and override status can be traced back to the plan.

### Phase 8: Studio API, CLI, And UI Wiring

Replace estimate-only wiring with the plan endpoint.

Acceptance criteria:

- Studio model rows come from engine/core projections;
- Studio run setup comes from route parameters;
- Studio estimate total comes from plan total;
- Studio shows compact statuses that do not break layout;
- Studio can show structured diagnostics in debug details.
- CLI plan output prints the same plan used by Studio;
- CLI plan output includes dependency execution levels, missing attachments,
  unpriced lines, override requirements, and diagnostics;
- CLI plan output is implemented through a small command handler aligned with
  `plans/active/0044-cli-command-architecture-refactor.md`.

### Phase 9: Validation

Add focused validation at each layer.

Acceptance criteria:

- engine tests cover every model family route;
- core tests estimate every supported model and intent combination;
- core tests verify stale route settings do not leak;
- core tests verify dependency costs are included in totals;
- Studio tests verify rendering of complete, partial, and unavailable
  plan states;
- sample project smoke checks cover the current Urban Basilica shot scene.

## Completion Checklist

Use this checklist to track when the architecture is complete enough to replace
the current AI Production estimate and model-selection wiring.

### Design Review

- [X] Confirm the route catalog shape is the right balance between explicit
  provider truth and maintainability.
- [X] Confirm the dependency map is the shared service for AI Production,
  Preview Take Plan dialog, CLI, and agent workflows.
- [X] Confirm partially priced plans can be materialized and run only with an
  explicit unpriced-cost override.
- [ ] Decide the default input policy for shot video inputs:
  `reuse-selected`, `regenerate`, or `auto`.
- [ ] Decide whether current `shot.first-frame` and `shot.last-frame` purpose
  names remain, or whether they are directly renamed in the same implementation
  slice.
- [ ] Resolve the exact provider route that represents user-facing `LTX 3.2` for
  first-frame image-to-video.

### Engine Catalog

- [ ] Audit fal.ai video schemas for all six initial base models.
- [ ] Add explicit model families for Seedance 2.0, Kling 3.0, Veo 3.1,
  XAI Grok Imagine Video 1.5, LTX 3.2, and Alibaba Happy Horse.
- [ ] Add route declarations for each supported intent per model family.
- [ ] Add route-specific input slots.
- [ ] Add route-specific run settings.
- [ ] Add route-specific duration domains and provider duration encoders.
- [ ] Add route-specific pricing declarations.
- [ ] Add engine validation for unknown provider models, unknown fields, invalid
  defaults, invalid durations, missing required fields, and missing pricing.
- [ ] Ensure no selectable `Ready` route can fail schema validation before
  estimate or run.

### Core Planning

- [ ] Add `MediaGenerationDependencyMap`.
- [ ] Add dependency node and edge contracts.
- [ ] Add purpose dependency declarations.
- [ ] Add dependency resolver for existing assets, missing inputs, planned
  generations, and required attachments.
- [ ] Add transitive dependency resolution and cycle diagnostics.
- [ ] Add topological execution levels for agent workflows.
- [ ] Add reference bundle resolution for cast, locations, lookbooks, and
  route-declared audio or video references.
- [ ] Add `ShotVideoTakeGenerationPlan`.
- [ ] Add route-setting normalization through the selected route only.
- [ ] Add one provider payload builder shared by estimate, spec validation,
  approval, and run.
- [ ] Add plan-level estimate aggregation across reused assets, dependency
  generations, and final video generation.
- [ ] Ensure missing inputs and unpriced generation lines produce explicit
  plan lines instead of silent `-` totals.
- [ ] Add unpriced override requirements to the plan estimate.

### Generation Purposes

- [ ] Implement or align the `0042` purpose-specific spec builder for
  `shot.first-frame`.
- [ ] Implement or align the `0042` purpose-specific spec builder for
  `shot.last-frame`.
- [ ] Implement or align the `0042` purpose-specific spec builder for
  `shot.reference-sheet` if the product keeps it as a concrete shot-level
  purpose.
- [ ] Implement or align the `0042` purpose-specific spec builder for
  `shot.multi-shot-storyboard-sheet`.
- [ ] Implement or align the `0042` purpose-specific spec builder for
  `shot.video-take`.
- [ ] Confirm reference bundles resolve to concrete purposes or attached assets,
  not to a generic `shot.reference-image` purpose.
- [ ] Confirm dependency materialization can use existing media-generation flows
  for concrete purposes such as `cast.character-sheet` without moving
  prompt/spec ownership into the shot-video planner.
- [ ] Confirm audio and video dependency slots can be represented even before
  audio or video dependency generation purposes are implemented.

### Materialization And Run

- [ ] Materialize dependency generation specs and final video specs node by node
  from the same plan.
- [ ] Store a shared plan id on specs and runs.
- [ ] Include every priced and unpriced plan line in the approval summary.
- [ ] Support explicit unpriced-cost override before unestimated runs.
- [ ] Run dependency generations in dependency order before the final video
  route.
- [ ] Attach or import generated dependency assets before resolving final video
  input slots.
- [ ] Record actual costs so the final take can be audited against the plan.
- [ ] Update the media-producer shot-video-take reference in
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`
  with the plan-driven dependency execution workflow.

### Studio, CLI, And Agent Plan Access

- [ ] Replace estimate-only Studio wiring with the plan endpoint.
- [ ] Render model rows from engine/core route projections.
- [ ] Render Run Setup controls from selected route parameters only.
- [ ] Render compact model statuses: `Ready`, `No input`, `No price`,
  `Unavailable`.
- [ ] Render complete, partial, and unavailable estimate states.
- [ ] Render unpriced line details and missing-attachment details.
- [ ] Render the dependency map in the Preview Take Plan dialog.
- [ ] Add CLI plan output for `shot.video-take`, including execution levels and
  unpriced override requirements.
- [ ] Implement the CLI plan output through a small command handler and align
  with `plans/active/0044-cli-command-architecture-refactor.md`; do not add more
  nested branches to `runMediaCommand` or `runGenerationCommand`.
- [ ] Update the media-producer agent workflow to consume and materialize the
  same plan.

### Validation

- [ ] Add engine route matrix tests.
- [ ] Add core plan tests for every supported model and intent combination.
- [ ] Add core tests proving stale route settings do not leak.
- [ ] Add core tests proving dependency costs are included in total estimates.
- [ ] Add Studio tests for compact statuses and plan-state rendering.
- [ ] Add Preview Take Plan dialog tests for dependency map rendering.
- [ ] Add sample project smoke coverage for the current Urban Basilica scene and
  selected shot.
- [ ] Run `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` when the
  implementation work is complete and the user has approved running tests.

## Review Questions

These decisions need product or implementation review before coding:

1. Should `auto` input policy reuse existing selected assets by default, or
   should first-frame and last-frame routes default to regeneration?
2. Should the AI Production pane show dependency line items inline, or only in
   the Preview Take Plan dialog?
3. Should the current `shot.first-frame` and `shot.last-frame` purpose names
   remain, or should they be directly renamed in the implementation slice?
4. Which exact provider route should represent user-facing `LTX 3.2` for
   first-frame image-to-video if the available provider variant has a mismatched
   duration contract?

## Success Criteria

This plan is successful when:

- the AI Production pane can show all six base model rows with correct route
  availability;
- every displayed `Ready` route can actually estimate without provider schema
  diagnostics;
- run setup never shows settings unsupported by the selected route;
- total estimate includes required dependency generation costs;
- unpriced lines are visible and runnable only through explicit override;
- the same plan is used by Studio, CLI, and agent-driven generation;
- final generation runs use the same provider payload path as estimates;
- failures are reported as structured diagnostics instead of silent `-` totals.
