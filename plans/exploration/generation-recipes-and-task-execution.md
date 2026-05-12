# Generation Recipes And Task Execution

Date: 2026-05-08

Status: exploration

Role: future architecture exploration

This document has not been accepted or implemented. It is preserved as
exploration, not current Renku Studio architecture.

## Purpose

This document defines a YAML-free architecture for Renku Studio generation.

The first implementation example is Cast image generation, but the architecture
is shared by Studio, CLI, and future agent workflows.

This document is not promoted to an ADR. The implementation has engine
catalog and provider infrastructure, but the shared task/request architecture is
still being proven.

The goal is:

- Studio UI is written in React and TypeScript, not defined by YAML files.
- CLI commands and Studio actions invoke the same core generation service.
- Generation definitions are code-owned, typed, tested modules.
- Model support is updated by changing the app/catalog code, not by asking users
  to author workflow YAML.
- The first v1 execution path is simple and immediate, while leaving room for a
  future queue, concurrency, retries, and cost approval.

## Core Direction

Renku Studio is not a generic user-extensible workflow builder.

Users should not need to write YAML to add forms, define UI bindings, map
provider fields, or teach Studio about new models. When new useful models arrive,
Renku Studio can be updated and shipped with new model definitions, mappings,
and UI affordances.

The architecture should therefore be code-first:

```text
Studio React UI
  renders product-specific generation panels

CLI
  exposes agent/human commands for the same generation types

studio-core
  owns generation definitions, input contracts, task records,
  domain resolution, and shared execution services

studio-engines
  owns provider/model catalogs, model schemas, SDK payload mapping,
  provider invocation, and output normalization
```

The first implementation can focus on `cast.image`, but `cast.image` should be
one registered generation definition inside the shared system, not a one-off
subsystem.

## What Is Not Dynamic

These are code-owned and shipped with the app:

- Studio UI components and forms;
- CLI command implementations;
- generation definitions;
- generation input validators;
- default model choices;
- supported model lists;
- provider payload mappers;
- output registration handlers.

This avoids a long-term split where half the UI is React and half is YAML
metadata with bindings. It also avoids creating a YAML grammar that must evolve,
validate, migrate, and preserve compatibility before the product has customers.

## What Is Dynamic

These are runtime data:

- current Project;
- current Cast Member, Clip, or Visual Language selection;
- user prompt text;
- uploaded reference images;
- selected model for a run;
- model parameter values for a run;
- number of takes;
- task records;
- generated assets and takes;
- selected/pinned assets.

Runtime data belongs in SQLite and project-owned asset storage, not in workflow
definition files.

## Shared Clients: Studio, CLI, Agents

Studio and CLI are different interfaces over the same generation system.

Studio is for users:

- visual form controls;
- uploaded image picker;
- model parameter controls;
- task list footer;
- take gallery;
- selection actions.

CLI is for agents and power users:

- explicit command arguments;
- JSON input/output when useful;
- structured diagnostics on stderr;
- scripting and automation.

Both should call `studio-core` generation services instead of implementing
generation logic separately.

Example Studio action:

```text
Cast Member -> Description tab -> Create New Image Takes
```

Example CLI command shape:

```bash
renku studio generate cast.image \
  --cast-member cast_mehmed_ii \
  --prompt "Young Ottoman ruler, severe but not villainous" \
  --reference-image ./mehmed-reference.png \
  --takes 4 \
  --model fal-ai/gpt-image-2 \
  --set quality=high
```

The CLI command is not a separate architecture. It builds the same core request
that Studio builds from the React form.

## Generation Definition

A **Generation Definition** is a TypeScript module that describes one supported
generation type.

It is code, not YAML.

It should define:

- stable recipe key;
- human label;
- supported focused object type;
- default output owner and asset type;
- input validation;
- default model;
- supported models;
- prompt enhancement behavior;
- task creation behavior;
- execution steps;
- output registration.

Example shape:

```ts
export interface GenerationDefinition<TInput, TResolvedInput, TOutput> {
  recipeKey: string;
  label: string;
  focusedObjectType: string;
  output: GenerationOutputDefinition;
  models: ProviderModelReference[];
  defaultModel: ProviderModelReference;
  validateInput(input: unknown): GenerationValidationResult<TInput>;
  resolveInput(context: GenerationResolutionContext, input: TInput): Promise<TResolvedInput>;
  createTasks(request: GenerationCreateRequest<TInput>): GenerationTaskDraft[];
  executeTask(context: GenerationExecutionContext, task: GenerationTask): Promise<TOutput>;
  registerOutput(context: GenerationRegistrationContext, output: TOutput): Promise<GenerationRecord[]>;
}
```

The exact interface can evolve, but the architectural point is that the compiler
and tests own the contract. We should not design a public grammar for users to
extend.

## Generation Registry

Core should expose a registry of generation definitions:

```ts
export const generationDefinitions = [
  castImageGenerationDefinition,
  castCharacterSheetGenerationDefinition,
  // future definitions
];
```

The registry supports:

- lookup by recipe key;
- CLI command validation;
- model option lookup;
- task execution dispatch;
- output registration dispatch.

Recipe keys are still stable strings, such as `cast.image` or
`cast.character_sheet`, but they are discovered from the registry. Shared
contracts should not hardcode them as narrow union types.

## Studio Action Binding

Studio action binding belongs in React code.

The Cast Description component already knows that its **Create New Image
Takes** button opens the Cast image generation panel. It should not ask core
which actions exist for `area=cast` and `tab=description`, and it should not
duplicate that same UI decision in a separate registry.

The binding can be direct and boring:

```ts
const recipeKey = castImageGenerationDefinition.recipeKey;
```

or, if importing core definitions into browser code is too heavy, through a
small browser-safe constant:

```ts
const CAST_IMAGE_RECIPE_KEY = 'cast.image';
```

The important boundary is execution, not UI discovery:

- React components decide which generation panel to show.
- React components compose the form.
- React components create the typed generation input from user state.
- Core validates the recipe key and input before creating tasks.

This keeps UI ownership in the UI. Core should not define Studio navigation,
tab actions, form layout, or button labels.

## Studio UI

Studio generation forms should be normal React components.

Reusability should happen through React composition, not through a data-driven UI
definition language.

For `cast.image`, the Cast Description panel opens a right-side generation
settings panel with:

- **Default** tab:
  - high-level prompt;
  - reference image uploads;
  - Visual Language reference choice;
  - size;
  - aspect ratio;
  - number of takes;
  - generate button.
- **Advanced** tab:
  - model selector;
  - enhanced prompt;
  - generate/regenerate enhanced prompt;
  - model-specific parameter controls.

The form component can be specialized because it is product UX. We do not need
to pretend every generation form is a generic schema-rendered form.

What should be shared are ordinary React components:

- `GenerationSettingsPanel`: the right-side shell with Default and Advanced
  tabs;
- `AdvancedGenerationSettings`: reusable model selector, enhanced prompt
  controls, and model parameter area;
- `GenerationModelSelect`: provider/model selection from the definition's model
  options;
- `GenerationModelParameterField`: one reusable field renderer for supported
  primitive parameter controls;
- `TakeCountSlider`: the standard number-of-takes control;
- `EnhancedPromptEditor`: enhanced prompt text area plus generate/regenerate
  actions;
- `ReferenceImageUploadList`: upload and thumbnail review for reference images;
- `GenerationTaskList`: task status display for the footer.

Those components receive normal TypeScript props from their parent form. They do
not inspect a UI schema, binding expression, or YAML field definition.

Example:

```tsx
<AdvancedGenerationSettings
  modelOptions={castImageGenerationDefinition.models}
  modelSchemas={modelSchemas}
  selectedModel={selectedModel}
  modelParameters={modelParameters}
  enhancedPrompt={enhancedPrompt}
  onModelChange={setSelectedModel}
  onModelParameterChange={setModelParameter}
  onEnhancedPromptChange={setEnhancedPrompt}
  onGenerateEnhancedPrompt={generateEnhancedPrompt}
/>
```

The parent `CastImageGenerationPanel` decides which controls belong in the
Default tab. The shared `AdvancedGenerationSettings` component handles the
repeatable advanced pattern.

This keeps the UI maintainable:

```text
Product-specific React form
  -> composed from reusable React controls
  -> backed by core-owned generation definitions for validation/execution
```

## CLI UI

CLI commands should be explicit, stable, and agent-friendly.

Recommended shape:

```bash
renku studio generate <recipe-key> [recipe-specific options]
```

For the first slice:

```bash
renku studio generate cast.image \
  --cast-member <id> \
  --prompt <text> \
  --reference-image <path> \
  --takes <n> \
  --model <provider/model> \
  --set <name=value>
```

The CLI should:

- resolve `recipe-key` through the core generation registry;
- parse command arguments into the same input shape Studio uses;
- pass the request to core;
- print task IDs and generated output IDs;
- use structured diagnostics for invalid inputs.

Later, recipe definitions can expose CLI option metadata in code if we want to
avoid hand-writing every command parser. That should be a TypeScript API, not
YAML.

## Input Validation

Each generation definition owns input validation.

For v1, explicit TypeScript validation functions are enough and match current
project patterns. They can collect multiple diagnostics and return a
`DiagnosticResult`.

Zod is not required right now.

Zod would be useful if we need:

- many nested input schemas;
- reusable runtime parsers across CLI and HTTP;
- automatic type inference from runtime schema definitions;
- clearer composition than hand-written validators.

But adding it now would be an extra dependency and a second validation style.
Since the repo already uses structured diagnostics and explicit validators, the
initial architecture should continue that approach. We can introduce Zod later
only if it solves a concrete validation complexity problem.

## Model Options

Supported model choices are code/catalog-owned.

The generation definition should only choose which provider/model pairs are
available for that generation type:

```ts
export const castImageModels: ProviderModelReference[] = [
  { provider: 'fal-ai', model: 'gpt-image-2' },
  { provider: 'fal-ai', model: 'nano-banana-2' },
  { provider: 'fal-ai', model: 'nano-banana-pro' },
  { provider: 'fal-ai', model: 'seedream-v5-lite' },
  { provider: 'fal-ai', model: 'seedream-v5' },
  { provider: 'fal-ai', model: 'grok-imagine-image' },
  { provider: 'fal-ai', model: 'grok-imagine-image-quality' },
];
```

The provider/model catalog in `@gorenku/studio-engines` remains the source of:

- display labels when available;
- default parameter values;
- valid parameter names;
- parameter types;
- enum values;
- required fields;
- field order and viewer hints;
- provider adapter behavior.

The Advanced tab should derive model parameter fields from the selected model's
JSON Schema and Renku schema extensions, such as the existing
`x-renku-viewer` annotations. This means adding a new supported model usually
requires:

1. adding or updating the model catalog entry and schema;
2. ensuring the schema has the right Renku annotations for Studio display;
3. adding the provider/model pair to the generation definition's allowed model
   list.

It should not require repeating labels, defaults, enum values, or advanced field
lists in the generation definition.

Studio should not display automatically resolved technical fields such as image
URL SDK fields. Those are populated by core/engines from domain references.

To support that, model schemas should have Renku extensions for Studio behavior
that the raw provider schema cannot express clearly. Examples:

- field visibility: visible, hidden, or Studio-resolved;
- field role: prompt, reference images, output count, aspect ratio, size, seed;
- user-facing grouping for Advanced fields;
- optional Studio label override when the provider title is poor;
- whether a field belongs in the product Default tab rather than Advanced.

For example, prompt and image reference fields should be present in the provider
schema for validation and payload construction, but hidden from Advanced because
Studio supplies them from the high-level prompt, enhanced prompt, and selected
domain references.

## Prompt Enhancement

Prompt enhancement is a shared system function.

It is not a workflow stage in every generation definition.

Each generation definition can declare prompt enhancement behavior in code:

```ts
promptEnhancement: {
  enabled: true,
  guideKey: 'cast.image',
  sourceInput: 'highLevelPrompt',
}
```

Prompt enhancement config is system-wide, not project-local, in v1:

```text
~/.config/renku/prompt-config/
  prompt-enhancement.toml or prompt-enhancement.json
  guides/
    cast.image.md
    cast.character_sheet.md
    clip.video_take.md
```

The exact file format can be decided later. It should be configuration for
system prompt behavior, not a UI or workflow definition language.

Vercel AI Gateway should be used for LLM access, including OpenAI models. Its
configuration is also system-wide in `~/.config/renku` and has no v1 Studio UI.

Behavior:

- Studio Advanced tab can generate/regenerate the enhanced prompt.
- CLI can request prompt enhancement implicitly or explicitly.
- If generation starts without an enhanced prompt, core creates an enhanced
  prompt task first.
- If the user/agent provides an edited enhanced prompt, the generation task uses
  that text.
- Enhanced prompt tasks appear in the same task list as generation tasks.

## Task List

The first task list is simple immediate execution. It is the first version of
future queue state, not a separate prototype mechanism.

It supports:

- creating tasks;
- listing tasks for a project;
- showing task status in Studio;
- reporting task IDs in CLI;
- showing elapsed time;
- cancelling tasks before dispatch;
- task dependencies;
- registering generated outputs through Generation Records.

It does not yet support:

- concurrency controls;
- pause/resume;
- retries;
- budget approval;
- cross-project scheduling;
- durable background workers after Studio exits.

The task model should still leave room for those capabilities.

```ts
type GenerationTaskStatus =
  | 'waiting'
  | 'ready'
  | 'running'
  | 'cancelled'
  | 'succeeded'
  | 'failed';

interface GenerationTask {
  id: string;
  projectName: string;
  recipeKey: string;
  kind: 'enhancePrompt' | 'runGeneration';
  title: string;
  status: GenerationTaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  dependsOnTaskIds: string[];
  cancellable: boolean;
  progressLabel?: string;
  elapsedMilliseconds: number;
  diagnosticIssues?: DiagnosticIssue[];
}
```

Cancellation is allowed only for `waiting` and `ready` tasks in v1. A task that
has been dispatched to a provider or LLM is `running` and cannot be cancelled
safely until provider-specific cancellation is deliberately implemented.

## Core Request Shape

Studio and CLI should both create a core request with the same conceptual
shape:

```ts
interface CreateGenerationRequest {
  projectName: string;
  recipeKey: string;
  focusedObject: {
    type: string;
    id: string;
  };
  input: unknown;
  selectedModel?: {
    provider: string;
    model: string;
  };
  modelParameters?: Record<string, unknown>;
  enhancedPrompt?: string;
}
```

The selected generation definition validates `input` and merges defaults.

The request shape is generic. The typed input shape is owned by the generation
definition:

```ts
interface CastImageGenerationInput {
  castMemberId: string;
  highLevelPrompt: string;
  referenceImages: GenerationImageReference[];
  visualLanguageReferenceId?: string;
  size?: string;
  aspectRatio?: string;
  numberOfTakes: number;
}
```

Studio’s Cast image panel and the CLI parser both construct this same input
shape before calling core.

## Domain-To-Technical Resolution

Studio form state and CLI arguments are domain requests, not provider payloads.

Shared resolution pipeline:

```text
Studio or CLI request
  -> generation definition lookup
  -> input validation
  -> domain reference resolution
  -> enhanced prompt task when needed
  -> Generation Packet
  -> model parameter validation
  -> provider SDK payload
  -> Provider Run
  -> output registration
```

Domain inputs include:

- Cast Member;
- Clip;
- selected Cast Assets;
- Visual Language reference;
- uploaded reference images;
- high-level prompt;
- movie aspect ratio;
- number of takes.

Technical inputs include:

- final prompt;
- image URLs or provider attachments;
- model parameters;
- output count;
- provider-specific enums.

The transformation from uploaded images, Cast Assets, or Visual Language Assets
to provider-ready image URLs belongs in core/engines. Studio and CLI should not
ask users to provide provider SDK fields such as `image_urls`.

## Generation Packet

The **Generation Packet** is a recipe-neutral execution snapshot created after
domain resolution and before provider execution.

```ts
interface GenerationPacket {
  id: string;
  projectName: string;
  recipeKey: string;
  focusedObject: {
    type: string;
    id: string;
  };
  selectedModel: {
    provider: string;
    model: string;
  };
  domainInputs: Record<string, unknown>;
  technicalInputs: Record<string, unknown>;
  modelParameters: Record<string, unknown>;
  numberOfTakes: number;
}
```

Recipe-specific data belongs inside `domainInputs` and `technicalInputs`. Add a
top-level field only when it is broadly useful across generation definitions.

## Provider Payload Mapping

Provider payload mapping should be code-owned.

Each generation definition can provide a mapper, or it can call a shared mapper
for common patterns such as image generation:

```ts
function buildImageGenerationPayload(input: {
  enhancedPrompt: string;
  imageReferences: ProviderImageReference[];
  modelParameters: Record<string, unknown>;
  model: ProviderModelReference;
}): Record<string, unknown>;
```

The mapper can use model catalog metadata from `@gorenku/studio-engines` to:

- validate required fields;
- drop unsupported optional fields only when intentionally designed;
- translate Studio-friendly values into provider-specific values;
- attach image references to the correct SDK field.

Missing required values and unknown parameters should fail with structured
diagnostics. They should not silently fall back.

## Output Registration

Generation definitions own output registration behavior.

Generic output registration needs:

- project name;
- recipe key;
- focused object type and ID;
- output owner type and ID;
- asset type;
- media type;
- generated files;
- task ID;
- provider run ID;
- Generation Packet ID.

For `cast.image`:

- owner type: `CastMember`;
- asset type: `cast.image`;
- media type: `image`;
- gallery: Description tab takes.

For `cast.character_sheet`:

- owner type: `CastMember`;
- asset type: `cast.character_sheet`;
- media type: `image`;
- gallery: Character Sheet takes;
- multiple selected assets are allowed later through explicit selection actions.

The mechanism is shared; the registration policy is definition-owned code.

## Studio Server API

Studio server routes should be generic resources:

```text
GET  /studio-api/projects/:projectName/generation/tasks
POST /studio-api/projects/:projectName/generation/tasks
POST /studio-api/projects/:projectName/generation/tasks/:taskId/cancel
```

The task creation endpoint receives the generic `CreateGenerationRequest`.

Studio server adapts HTTP requests to core services. It should not own
generation behavior or UI action discovery.

## CLI Surface

The CLI can start with one generic command:

```bash
renku studio generate <recipe-key>
```

It can then add domain-specific option helpers where useful:

```bash
renku studio generate cast.image --cast-member <id> --prompt <text>
```

The command should:

- resolve the project;
- resolve the generation definition;
- validate arguments through core;
- create tasks;
- optionally wait for completion later;
- print structured JSON when requested.

This keeps agents and users on the same generation path as Studio.

## Example: `cast.image`

The first implementation should use this architecture through one concrete
definition:

- recipe key: `cast.image`;
- Studio action: Cast Description tab, **Create New Image Takes**;
- CLI command: `renku studio generate cast.image`;
- focused object: `CastMember`;
- output: Cast image takes;
- Default Studio form:
  - high-level prompt;
  - reference image uploads;
  - Visual Language reference;
  - size;
  - aspect ratio;
  - number of takes;
- Advanced Studio form:
  - model selector;
  - enhanced prompt;
  - exposed model parameters.

Initial supported models can be defined in code:

- `fal-ai/gpt-image-2`;
- `fal-ai/nano-banana-2`;
- `fal-ai/nano-banana-pro`;
- `fal-ai/seedream-v5-lite`;
- `fal-ai/seedream-v5`;
- `fal-ai/grok-imagine-image`;
- `fal-ai/grok-imagine-image-quality`.

The first UI may use a hardcoded Visual Language reference while Visual
Language UX is being designed, but that should be runtime fixture data, not a
workflow definition.

## Structured Diagnostics

Use `@gorenku/studio-diagnostics` at package boundaries.

Suggested code prefixes:

- `GENERATION_DEFINITION001...` for registry and definition lookup errors;
- `GENERATION_INPUT001...` for input validation and domain resolution errors;
- `GENERATION_MODEL001...` for model option and parameter validation errors;
- `GENERATION_TASK001...` for task creation, cancellation, dependency, and
  execution state errors;
- `GENERATION_PROVIDER001...` for provider invocation and payload errors.

Unknown recipe keys, unsupported focused object types, missing domain
references, unknown model parameters, and missing provider credentials should
fail clearly. They should not fall back to nearby definitions or silently omit
fields.

## Initial Implementation Boundary

The first implementation should prove the shared code-owned architecture with
one generation definition:

1. Studio opens the Cast Description generation panel.
2. The user fills the React form for **Create New Image Takes**.
3. Studio calls the generic generation task endpoint.
4. CLI can call the same core service through `renku studio generate cast.image`
   once the CLI slice is added.
5. Core validates input through the `cast.image` generation definition.
6. Core creates an enhanced prompt task when needed.
7. Core creates a dependent generation task.
8. The executor builds a Generation Packet.
9. The engine maps resolved technical inputs to the selected provider payload.
10. Generated images are registered as Cast image takes.

This gives us one working vertical slice without YAML, without generic UI schema
rendering, and without making Cast image generation a special subsystem.
