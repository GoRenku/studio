# 0025 Simple Lookbook Image Generation

Date: 2026-05-25

Status: implemented

## Goal

Implement the simplest useful media generation slice:

> Generate Lookbook images through persisted user choices, grounded in the real
> fal.ai model schemas, without building a generic media-purpose framework.

The first implementation should be concrete, direct, and easy to review. It
should support Lookbook Image generation well. Shared abstractions can be
extracted later only after two or three more media generation purposes exist and
the duplication is real.

## Required Direction

- Keep generation and media import/attachment separate.
- Persist user generation choices before execution.
- Treat user-selected model, take count, seed, frame, detail, and output format
  as binding.
- Validate the final provider payload against the existing model JSON schema
  before estimate or execution.
- Do not infer model support from schema field names or model names.
- Do not add model capability YAML.
- Do not add schema overlays.
- Do not add registries, adapters, generic media-purpose frameworks, or
  plugin-like abstractions for the first slice.
- Do not expose raw provider parameters to users.
- Do not keep two old/new code paths for the same behavior.

## What To Remove From The Previous Implementation

The current implementation from the previous plan created too much structure.
This plan replaces it.

Remove the generic media-purpose layer:

```text
packages/core/src/client/media-purpose.ts

packages/core/src/server/media-purpose/
  media-purpose-registry.ts
  media-purpose-targets.ts
  media-file-import.ts
  purposes/lookbook-image.ts

packages/core/src/server/project-data-service-wiring/media-purpose.ts
```

Do not replace it with equivalent generic files under different names.

Also remove the `media` blocks that were added to:

```text
packages/engines/catalog/models/fal-ai/fal-ai.yaml
```

Provider YAML should remain catalog/pricing metadata. Generation behavior should
be plain TypeScript in the Lookbook Image generation slice.

## Simple Code Shape

Use one small vertical slice.

```text
packages/core/src/client/
  media-generation.ts

packages/core/src/server/commands/
  media-generation/lookbook-image.ts

packages/core/src/server/database/access/
  media-generation.ts

packages/core/src/server/schema/
  media-generation.ts

packages/cli/src/commands/
  generation-command.ts
  media-command.ts
```

No folders for:

- `media-purpose-registry`
- `generation-option-registry`
- `image-generation`
- `model-adapters`
- per-model option files
- per-purpose registry files

### File Responsibilities

`packages/core/src/client/media-generation.ts`

- public JSON contracts;
- `LookbookImageGenerationContext`;
- `LookbookImageGenerationSpec`;
- `MediaGenerationRun`;
- CLI response types.

No behavior.

`packages/cli/src/commands/generation-command.ts`

- CLI-facing orchestration;
- parse `--purpose lookbook.image` and `--target lookbook:<id>` directly;
- call `lookbook-image.ts` functions directly;
- never call engines directly;
- use a plain `switch` when another purpose is added.

No registry.

`packages/core/src/server/media-generation/lookbook-image.ts`

Owns the first vertical slice:

- build Lookbook Image context;
- list supported Lookbook Image model choices;
- validate Lookbook Image specs;
- create provider payloads for the supported models;
- call engines for schema validation, estimate, simulation, and live execution;
- create run snapshots.

The CLI stays thin. Core owns the project-aware generation transaction because
it has the project context, persisted spec, provider payload, estimate, output
paths, and run snapshot in one place. Engines remains the package that executes
the provider-specific estimate/run mechanics.

This file may contain plain functions like:

```ts
function buildGptImage2Payload(...)
function buildNanoBanana2Payload(...)
function buildGrokImaginePayload(...)
function buildSeedreamV5Payload(...)
```

No adapter interface. No separate model files.

`packages/core/src/server/database/access/media-generation.ts`

- insert/read/update generation specs;
- insert/update generation runs;
- store run output JSON.

`packages/core/src/server/schema/media-generation.ts`

- two tables only for the first implementation:
  - `media_generation_spec`
  - `media_generation_run`

Do not add a separate output table yet. Multiple takes can live in
`media_generation_run.outputs_json` for the first implementation. Split outputs
into rows only when a concrete UI or query needs it.

## JSON Schemas Still Matter

The model catalog JSON schemas are still used.

They are not used to design the product API. They are used by engines to validate
the final provider payload.

Example:

1. Lookbook Image code builds:

```json
{
  "prompt": "...",
  "num_images": 2,
  "aspect_ratio": "16:9",
  "resolution": "2K",
  "output_format": "png",
  "sync_mode": false
}
```

2. Engines validates that payload against:

```text
packages/engines/catalog/models/fal-ai/image/nano-banana-2.json
```

3. If the schema rejects the payload, the command fails before any provider call.

The schemas answer questions like:

- is `prompt` required?
- is `num_images` within the allowed range?
- is `aspect_ratio` an allowed enum value?
- is `resolution` one of `1K`, `2K`, or `4K`?
- did the code accidentally send a field the provider schema does not accept?

The schemas do not:

- choose which models are shown for Lookbook Image;
- infer model suitability;
- generate UI controls;
- create mappings;
- override persisted user choices.

## Lookbook Image Context Builder

The context builder should be boring and factual.

It gathers the information an agent needs to write a good prompt and create a
spec. It does not choose a model or map provider parameters.

Function:

```ts
export async function buildLookbookImageContext(input: {
  projectName?: string;
  homeDir?: string;
  lookbookId: string;
}): Promise<LookbookImageGenerationContext>
```

Implementation shape:

```ts
export async function buildLookbookImageContext(input) {
  const resource = await readLookbookResource({
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: input.lookbookId,
  });

  const projectInformation = await readProjectInformationForGeneration(...);

  return {
    purpose: 'lookbook.image',
    target: {
      kind: 'lookbook',
      id: input.lookbookId,
    },
    project: {
      id: resource.project.id,
      name: resource.project.name,
      title: projectInformation.title,
      aspectRatio: projectInformation.aspectRatio ?? null,
    },
    lookbook: resource.lookbook,
    sourceInspirationFolders: resource.sourceInspirationFolders,
    existingImages: resource.images,
    imagesBySection: resource.imagesBySection,
    cardImage: resource.cardImage,
    defaults: {
      takeCount: 1,
      seed: null,
      imageFrame: 'project',
      resolvedAspectRatio: projectInformation.aspectRatio ?? null,
      detail: 'standard',
      outputFormat: 'png',
    },
  };
}
```

Expected JSON shape:

```json
{
  "purpose": "lookbook.image",
  "target": {
    "kind": "lookbook",
    "id": "lookbook_abc"
  },
  "project": {
    "id": "project_abc",
    "name": "cool-ads",
    "title": "Cool Ads",
    "aspectRatio": "16:9"
  },
  "lookbook": {
    "id": "lookbook_abc",
    "name": "Main Visual Language",
    "thesis": {},
    "palette": {},
    "toneMood": {},
    "composition": {},
    "lighting": {},
    "texture": {},
    "camera": {}
  },
  "sourceInspirationFolders": [],
  "existingImages": [],
  "imagesBySection": {
    "thesis": [],
    "palette": [],
    "tone_mood": [],
    "composition": [],
    "lighting": [],
    "texture": [],
    "camera": []
  },
  "cardImage": null,
  "defaults": {
    "takeCount": 1,
    "seed": null,
    "imageFrame": "project",
    "resolvedAspectRatio": "16:9",
    "detail": "standard",
    "outputFormat": "png"
  }
}
```

Things explicitly not returned:

- generic `modelRequirements`;
- generic `instructions`;
- generic `importContract`;
- provider/model capability summaries.

Model choices are returned by a separate function.

## Lookbook Image Generation Spec

The spec is the persisted, user-editable source of truth.

```json
{
  "purpose": "lookbook.image",
  "target": {
    "kind": "lookbook",
    "id": "lookbook_abc"
  },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A horror hallway showing the Lookbook palette under dread lighting.",
  "focusSections": ["palette", "lighting", "texture"],
  "takeCount": 2,
  "seed": 12345,
  "imageFrame": "project",
  "detail": "draft",
  "outputFormat": "png"
}
```

Rules:

- `purpose` must be `lookbook.image`.
- `target.kind` must be `lookbook`.
- `modelChoice` is binding.
- `takeCount` defaults to `1`.
- `seed` defaults to `null`.
- `imageFrame` is either `project` or an explicit project-supported aspect
  ratio: `1:1`, `3:4`, `4:3`, `16:9`, `9:16`, or `21:9`.
- `detail` is `draft`, `standard`, or `high`.
- `outputFormat` is `png`, `jpeg`, or `webp`, but default to `png`.
- `focusSections` must be valid Lookbook sections.

No `advancedSettings` in the first implementation. Add it later only when there
is a concrete UI and a concrete purpose-specific need.

## Model Choices

The first Lookbook Image slice supports these four model choices:

```text
fal-ai/openai/gpt-image-2
fal-ai/nano-banana-2
fal-ai/xai/grok-imagine-image
fal-ai/bytedance/seedream/v5/lite/text-to-image
```

`listLookbookImageModelChoices(context)` returns the choices for the current
target, including unavailable reasons.

Example:

```json
{
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "label": "GPT Image 2",
  "available": false,
  "unavailableReason": "GPT Image 2 is not available for 21:9 Lookbook images because the first implementation only uses priced preset image sizes.",
  "supportsSeed": false,
  "takeCount": {
    "min": 1,
    "max": 4,
    "default": 1
  },
  "supportedDetails": ["draft", "standard", "high"]
}
```

No model registry is needed. This can be a constant array plus a few direct
availability checks in `lookbook-image.ts`.

## Real Model Schema Facts

These are the concrete schema facts the implementation must honor.

| Model choice | Required input | Take count | Seed | Frame/size | Detail/cost field | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `fal-ai/openai/gpt-image-2` | `prompt` | `num_images`, 1-4 | unsupported | `image_size` preset or custom object | `quality`: `low`, `medium`, `high` | Use presets only in first slice so cost is known. |
| `fal-ai/nano-banana-2` | `prompt` | `num_images`, 1-4 | integer or null | `aspect_ratio` | `resolution`: `1K`, `2K`, `4K` | Keep `limit_generations: true`. |
| `fal-ai/xai/grok-imagine-image` | `prompt` | `num_images`, 1-4 | unsupported | `aspect_ratio` | none | Only `standard` detail is supported. Output includes `revised_prompt`. |
| `fal-ai/bytedance/seedream/v5/lite/text-to-image` | `prompt` | `num_images`, 1-6 | integer or null | `image_size` preset or custom object | none in pricing | Set `max_images: 1` so output count stays exact. Output includes used `seed`. |

## Provider Payload Mapping

All mapping lives in `lookbook-image.ts`.

Top-level shape:

```ts
function buildLookbookImageProviderPayload(spec, context) {
  switch (spec.modelChoice) {
    case 'fal-ai/openai/gpt-image-2':
      return buildGptImage2Payload(spec, context);
    case 'fal-ai/nano-banana-2':
      return buildNanoBanana2Payload(spec, context);
    case 'fal-ai/xai/grok-imagine-image':
      return buildGrokImaginePayload(spec, context);
    case 'fal-ai/bytedance/seedream/v5/lite/text-to-image':
      return buildSeedreamV5Payload(spec, context);
  }
}
```

### GPT Image 2

Payload:

```ts
{
  prompt: spec.prompt,
  num_images: spec.takeCount,
  image_size: mappedImageSize,
  quality: mappedQuality,
  output_format: spec.outputFormat,
  sync_mode: false,
}
```

Rules:

- reject `seed !== null`;
- reject `takeCount > 4`;
- map `detail`:
  - `draft` -> `low`
  - `standard` -> `medium`
  - `high` -> `high`
- map frame:
  - `1:1` -> `square`
  - `3:4` -> `portrait_4_3`
  - `4:3` -> `landscape_4_3`
  - `16:9` -> `landscape_16_9`
  - `9:16` -> `portrait_16_9`
- reject `21:9` in the first slice because custom GPT Image 2 sizes are not in
  the current pricing table.

### Nano Banana 2

Payload:

```ts
{
  prompt: spec.prompt,
  num_images: spec.takeCount,
  seed: spec.seed,
  aspect_ratio: mappedAspectRatio,
  resolution: mappedResolution,
  output_format: spec.outputFormat,
  safety_tolerance: '4',
  limit_generations: true,
  enable_web_search: false,
  sync_mode: false,
}
```

Rules:

- reject `takeCount > 4`;
- supports seed;
- map `detail`:
  - `draft` -> `1K`
  - `standard` -> `2K`
  - `high` -> `4K`
- supports all project aspect ratios currently used by Studio, including
  `21:9`.

### Grok Imagine

Payload:

```ts
{
  prompt: spec.prompt,
  num_images: spec.takeCount,
  aspect_ratio: mappedAspectRatio,
  output_format: spec.outputFormat,
  sync_mode: false,
}
```

Rules:

- reject `seed !== null`;
- reject `takeCount > 4`;
- only support `detail: "standard"`;
- support `1:1`, `3:4`, `4:3`, `16:9`, and `9:16`;
- reject `21:9`; do not guess from nearby values such as `20:9` or `19.5:9`;
- persist returned `revised_prompt` in the run snapshot when present.

### Seedream v5 Lite

Payload:

```ts
{
  prompt: spec.prompt,
  num_images: spec.takeCount,
  max_images: 1,
  seed: spec.seed,
  image_size: mappedImageSize,
  enhance_prompt_mode: 'standard',
  enable_safety_checker: true,
  sync_mode: false,
}
```

Rules:

- reject `takeCount > 6`;
- supports seed;
- set `max_images: 1` so `takeCount` remains exact;
- map frame:
  - `1:1` -> `square`
  - `3:4` -> `portrait_4_3`
  - `4:3` -> `landscape_4_3`
  - `16:9` -> `landscape_16_9`
  - `9:16` -> `portrait_16_9`
- reject `21:9` in the first slice unless explicit tested dimensions and cost
  behavior are added;
- only support `detail: "standard"` in the first slice, because the catalog
  pricing is per run and the schema does not expose a direct quality/resolution
  field comparable to GPT Image 2 or Nano Banana 2.

## Cost Estimate

Estimate from the final provider payload.

The command sequence should be:

1. read spec;
2. build Lookbook context;
3. validate spec against context;
4. build provider payload;
5. validate provider payload against model JSON schema;
6. estimate using engines pricing;
7. require approval token for live execution.

No live provider call should happen when the estimate is unknown.

Needed engines estimate work:

- keep `costByImageSizeAndQuality` for GPT Image 2;
- add or verify `costByImageAndResolution` for Nano Banana 2;
- verify `costByRun` behavior for Grok Imagine and Seedream v5 Lite;
- test the pricing semantics for `num_images` on each selected model.

## Persistence

Two tables:

```text
media_generation_spec
  id
  purpose
  target_kind
  target_id
  model_choice
  title
  spec_json
  created_at
  updated_at

media_generation_run
  id
  spec_id
  purpose
  target_kind
  target_id
  model_choice
  spec_snapshot_json
  provider
  model
  provider_payload_json
  estimate_snapshot_json
  approval_token
  simulated
  status
  outputs_json
  diagnostics_json
  started_at
  completed_at
```

`spec_json` stores the editable user choices.

`spec_snapshot_json` and `provider_payload_json` make each run understandable
later, even after the spec is edited.

`outputs_json` stores output URLs/files, returned seed, revised prompt, imported
asset ids, and per-take metadata for now.

## CLI Shape

Keep the CLI generic enough that it does not need one command per media type,
but implement it with direct switches internally.

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.image --target lookbook:<id> --json

renku generation spec validate --file spec.json --json
renku generation spec create --file spec.json --json
renku generation spec update --spec <spec-id> --file spec.json --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose lookbook.image --target lookbook:<id> --json

renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --simulate --json

renku media import --purpose lookbook.image --target lookbook:<id> --source <path> --json
```

Internal implementation can be:

```ts
switch (purpose) {
  case 'lookbook.image':
    return lookbookImageGeneration.context(...)
}
```

Do not create a registry to make this switch look generic.

## Media Import

Import remains separate from generation.

Lookbook does not care whether an image was:

- generated by Renku;
- generated elsewhere;
- downloaded;
- manually created.

For the first implementation, `renku media import --purpose lookbook.image`
should call direct Lookbook image attachment/import logic. It should not depend
on a generic media-purpose import framework.

Generation runs can store enough output metadata that `media import` can attach
the chosen output afterward, but generation itself should not be the attachment
API.

## Skill Update

Keep one reusable skill:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/
```

For Lookbook Image, the skill should instruct the agent to:

1. call `renku generation context --purpose lookbook.image`;
2. call `renku generation model list --purpose lookbook.image`;
3. ask the user for creative intent and any binding controls that are missing;
4. create or update a persisted spec;
5. estimate from the spec;
6. run only the approved spec;
7. import the chosen output separately with `renku media import`.

The skill must not suggest that the agent may override:

- model choice;
- take count;
- seed;
- image frame;
- detail;
- output format.

## Future Purpose Rule

When the next purpose is added, add a second concrete file:

```text
packages/core/src/server/media-generation/
  lookbook-image.ts
  character-sheet.ts
```

Then add direct switch cases in `packages/cli/src/commands/generation-command.ts`
and the project data service.

Do not extract common code at the second file unless the duplication is clearly
harmful. The preferred path is:

1. implement Lookbook Image concretely;
2. implement Character Sheet concretely;
3. implement one more purpose concretely;
4. extract only the pieces that are obviously shared.

## Implementation Checklist

### Cleanup

- [x] Delete `packages/core/src/client/media-purpose.ts`.
- [x] Delete `packages/core/src/server/media-purpose/media-purpose-registry.ts`.
- [x] Delete `packages/core/src/server/media-purpose/media-purpose-targets.ts`.
- [x] Delete `packages/core/src/server/media-purpose/media-file-import.ts`.
- [x] Delete `packages/core/src/server/media-purpose/purposes/lookbook-image.ts`.
- [x] Delete `packages/core/src/server/project-data-service-wiring/media-purpose.ts`.
- [x] Remove `media` blocks from `packages/engines/catalog/models/fal-ai/fal-ai.yaml`.
- [x] Remove callers/imports that depended on the deleted media-purpose layer.

### Contracts

- [x] Add `packages/core/src/client/media-generation.ts`.
- [x] Define `LookbookImageGenerationContext`.
- [x] Define `LookbookImageGenerationSpec`.
- [x] Define `LookbookImageModelChoice`.
- [x] Define `MediaGenerationRun`.
- [x] Export the new contracts through the current package entrypoint only if
  they are part of the public client API.

### Lookbook Image Slice

- [x] Add `packages/core/src/server/media-generation/lookbook-image.ts`.
- [x] Implement `buildLookbookImageContext`.
- [x] Reuse `readLookbookResource` for Lookbook data.
- [x] Add project title/aspect ratio to the context.
- [x] Implement `listLookbookImageModels`.
- [x] Implement `validateLookbookImageSpec`.
- [x] Implement `buildGptImage2Payload`.
- [x] Implement `buildNanoBanana2Payload`.
- [x] Implement `buildGrokImaginePayload`.
- [x] Implement `buildSeedreamV5Payload`.
- [x] Validate final provider payloads with engines JSON schema validation.

### Persistence

- [x] Add `media_generation_spec` and `media_generation_run` Drizzle tables.
- [x] Generate SQL migrations with Drizzle Kit.
- [x] Add `packages/core/src/server/database/access/media-generation.ts`.
- [x] Implement spec create/read/update/list.
- [x] Implement run record/read.
- [x] Store output metadata in `outputs_json`.

### Engines

- [x] Verify JSON schema validation rejects unknown provider payload fields.
- [x] Verify JSON schema validation is wired before estimate and run.
- [x] Implement or verify `costByImageAndResolution`.
- [x] Add estimate/schema-validation tests for GPT Image 2.
- [x] Add estimate/schema-validation tests for Nano Banana 2.
- [x] Add estimate/schema-validation tests for Grok Imagine.
- [x] Add estimate/schema-validation tests for Seedream v5 Lite.

### CLI

- [x] Wire `renku generation context`.
- [x] Wire `renku generation model list`.
- [x] Wire `renku generation spec validate`.
- [x] Wire `renku generation spec create`.
- [x] Wire `renku generation spec update`.
- [x] Wire `renku generation spec show`.
- [x] Wire `renku generation spec list`.
- [x] Wire `renku generation estimate`.
- [x] Wire `renku generation run`.
- [x] Keep `renku media import` separate from generation.

### Tests

- [x] Test Lookbook context JSON includes project aspect ratio and Lookbook sections.
- [x] Test invalid focus sections fail.
- [x] Test GPT Image 2 rejects seed and `21:9`.
- [x] Test Nano Banana 2 supports seed, `21:9`, and detail-to-resolution mapping.
- [x] Test Grok rejects seed, `21:9`, and non-standard detail.
- [x] Test Seedream maps `takeCount` to `num_images` and sets `max_images: 1`.
- [x] Test every provider payload validates against its catalog JSON schema.
- [x] Test run snapshots store spec, payload, estimate, and outputs JSON.

### Verification

- [x] `pnpm build:core`
- [x] `pnpm test:core`
- [x] `pnpm build:engines`
- [x] `pnpm test:engines`
- [x] `pnpm build:cli`
- [x] `pnpm test:cli`
- [x] `pnpm check`
