# 0112 Generation Preview Model Configuration Contract

Status: draft
Date: 2026-07-05

## Summary

Rewrite the Generation Preview Config tab around a real model-configuration
contract instead of loose key/value cards.

The current implementation is too weak in three ways:

- Core sends a flat `configuration` array with only `key`, `label`, and `value`.
  That lets meaningless rows such as `Reference count` appear beside actual
  generator settings.
- Studio renders whatever rows it receives and keeps the cost estimate inside
  the Config tab, even though the estimate is a dialog-level approval concern.
- Several image model reports and preview rows do not clearly distinguish:
  product spec fields, provider schema fields, provider defaults, Renku-fixed
  values, and the actual payload values that will be sent.

The replacement must make the Config tab answer this exact user question:

```text
Which model route will run, what parameters does that route expose, and what
exact values will Renku send or rely on for this generation?
```

The Config tab must not become a raw payload dump. It must be a typed,
Core-authored review projection derived from:

- the selected Renku generation purpose and spec;
- the effective provider plan and payload Core is about to submit;
- the provider model JSON Schema owned by `@gorenku/studio-engines`;
- the purpose's model-list report and normalized defaults;
- Core's knowledge of which fields are prompt content, reference media,
  product controls, provider settings, or fixed execution plumbing.

Model-parameter rows in the Preview dialog must share the same Studio control
presentation already used by the AI Production Run Setup section. The existing
drop-down, switch, number, and text controls should be moved into a neutral
generation-parameter control component and consumed by both surfaces. Preview
can pass the controls in read-only/disabled mode, but it must not invent a
second visual language for the same model settings.

The user-facing estimate belongs in the dialog footer, not in Config.

## References Reviewed

Architecture and product documents:

- `AGENTS.md`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/studio-coordination-events.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `plans/active/0111-generation-preview-dialog-redesign.md`

Current preview contract and UI:

- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/studio/src/features/generation-preview/generation-preview-dialog.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-config-panel.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-run-setup.tsx`
- `packages/studio/src/features/movie-studio/scenes/run-setup-controls.tsx`

Image purpose model reports and provider payload builders:

- `packages/core/src/client/lookbook-media-generation.ts`
- `packages/core/src/client/cast-media-generation.ts`
- `packages/core/src/client/location-media-generation.ts`
- `packages/core/src/client/scene-storyboard-media-generation.ts`
- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/server/media-generation/purposes/lookbook-image.ts`
- `packages/core/src/server/media-generation/purposes/lookbook-sheet.ts`
- `packages/core/src/server/media-generation/purposes/cast-image-common.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/purposes/cast-profile.ts`
- `packages/core/src/server/media-generation/purposes/location-environment-sheet.ts`
- `packages/core/src/server/media-generation/purposes/location-hero.ts`
- `packages/core/src/server/media-generation/purposes/scene-storyboard-sheet.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/model-list.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/input-specs.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/shared/purpose-config.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/shared/route-settings.ts`

Engine catalog and schema helpers:

- `packages/engines/src/model-catalog.ts`
- `packages/engines/src/generation/catalog/model-discovery.ts`
- `packages/engines/src/generation/execution/provider-payload-validation.ts`
- `packages/engines/src/sdk/unified/schema-file.ts`
- `packages/engines/catalog/models/fal-ai/fal-ai.yaml`
- `packages/engines/catalog/models/fal-ai/image/openai-gpt-image-2.json`
- `packages/engines/catalog/models/fal-ai/image/openai-gpt-image-2-edit.json`
- `packages/engines/catalog/models/fal-ai/image/nano-banana-2.json`
- `packages/engines/catalog/models/fal-ai/image/nano-banana-2-edit.json`
- `packages/engines/catalog/models/fal-ai/image/xai-grok-imagine-image.json`
- `packages/engines/catalog/models/fal-ai/image/xai-grok-imagine-image-edit.json`
- `packages/engines/catalog/models/fal-ai/image/xai-grok-imagine-image-quality-edit.json`
- `packages/engines/catalog/models/fal-ai/image/bytedance-seedream-v5-lite-text-to-image.json`
- `packages/engines/catalog/models/fal-ai/image/bytedance-seedream-v5-lite-edit.json`

## Current Defects

### Config Rows Are Too Loose

Current contract:

```ts
export interface GenerationPreviewConfigurationItem {
  key: string;
  label: string;
  value: string | number | boolean | null | string[] | number[] | boolean[];
}
```

Validation only requires `key` and `label`. It does not require a real value,
does not know where the value came from, does not know provider fields, and
does not know whether the row is a model setting, a project setting, a fixed
execution flag, or a made-up summary.

Expected impact:

- A fake or accidental `Reference count` row looks just as legitimate as
  `quality` or `output_format`.
- Studio has no way to render defaults, allowed values, ranges, or effective
  provider fields.
- React can only make generic cards, which encourages a debug-card layout
  instead of a review surface.

### Estimate Is In The Wrong Place

`GenerationPreviewConfigPanel` currently renders `Estimated total` below
configuration cells. Cost is not a model configuration property. It is a
generation approval summary for the whole preview.

Required correction:

- Move estimate rendering into `GenerationPreviewDialog` footer.
- Keep the Config tab focused on model route and parameter values.
- Keep warnings attached to the estimate in the footer, not inside Config.

### Schema Defaults And Renku Effective Values Are Different

The provider JSON Schema default is often not the value Renku sends.

Concrete examples:

- GPT Image 2 schema default:
  - `quality: "high"`
  - Renku default product setting `detail: "standard"` maps to
    `quality: "medium"`.
- Grok Imagine schema default:
  - `output_format: "jpeg"`
  - Renku currently sends `output_format: "png"` unless the spec says
    otherwise.
- GPT Image 2 edit schema default:
  - `image_size: "auto"`
  - Renku often sends a concrete frame such as `landscape_16_9` or
    `landscape_4_3`.

The Config tab must show the effective value and may show the schema default
as supporting metadata. It must not pretend schema defaults are what Renku
will send.

### Shot Input Image Model Parameters Are Currently Wrong

`shotInputModelChoices()` currently reports the same parameters for GPT Image 2,
Nano Banana 2, and Grok Imagine:

```ts
image_size
quality
```

That matches GPT Image 2 but not the other schemas:

- Nano Banana 2 uses `aspect_ratio` and `resolution`.
- Grok Imagine uses `aspect_ratio` and `resolution`.
- Both use `output_format`.
- Nano Banana 2 supports `seed`; GPT and Grok do not.

Expected impact:

- Agents and Studio can author shot input `parameterValues` that do not match
  the selected provider model.
- Provider payloads can contain fields irrelevant to the model schema.
- A correct Config tab would expose the mismatch instead of solving it.

Required correction:

- Model-list reports for shot input image generation must become
  model-specific.
- Defaults for shot input image specs must be selected from the chosen model's
  parameter report, not from one GPT-shaped shared default.
- Provider payload construction and validation must reject unsupported
  image-model parameters before preview or generation.

### Preview Config Would Duplicate Existing Run Setup Controls

The AI Production Run Setup section already renders model parameters with
purpose-built controls:

- enum parameters use the local `Select` primitive;
- boolean parameters use the local `Switch` primitive;
- numeric parameters use the local `Input` primitive with min/max;
- text-like parameters use the local `Input` primitive.

The current preview Config plan must not replace those with unrelated card or
table widgets for the same settings. Doing so would create two UI treatments
for one domain concept and make future parameter changes harder to reason
about.

Required correction:

- Move the current run-setup parameter controls into a neutral Studio feature
  component, not a scene-specific module.
- Update AI Production Run Setup to use the shared component.
- Update Generation Preview Config to use the same component for model
  parameter rows.
- Keep the Preview dialog controls read-only in this slice unless a separate
  product decision makes preview-time editing explicit.
- Do not keep a wrapper or compatibility re-export at the old path.

## Scope

This plan covers the Core-listed image model choices currently used by Renku
Studio purposes. It does not cover every image model in the engine catalog.

Catalog-only models stay out of scope until a Core purpose exposes them in a
model-list report.

Covered model choices and provider routes:

| Renku model choice | Provider route(s) used today | Notes |
| --- | --- | --- |
| `fal-ai/openai/gpt-image-2` | `fal-ai/openai/gpt-image-2`, `fal-ai/openai/gpt-image-2/edit` | Edit route is used when references or a source image are attached. |
| `fal-ai/openai/gpt-image-2/edit` | `fal-ai/openai/gpt-image-2/edit` | Direct edit choice for Cast Profile and Location Hero. |
| `fal-ai/nano-banana-2` | `fal-ai/nano-banana-2`, `fal-ai/nano-banana-2/edit` | Edit route is used when references or a source image are attached. |
| `fal-ai/nano-banana-2/edit` | `fal-ai/nano-banana-2/edit` | Direct edit choice for Cast Profile and Location Hero. |
| `fal-ai/xai/grok-imagine-image` | `fal-ai/xai/grok-imagine-image`, `fal-ai/xai/grok-imagine-image/edit`, `fal-ai/xai/grok-imagine-image/quality/edit` | `quality/edit` is used for high-detail Cast Character Sheet reference generation. |
| `fal-ai/xai/grok-imagine-image/edit` | `fal-ai/xai/grok-imagine-image/edit` | Direct edit choice for Cast Profile and Location Hero. |
| `fal-ai/bytedance/seedream/v5/lite/text-to-image` | `fal-ai/bytedance/seedream/v5/lite/text-to-image` | Currently exposed for Lookbook Image and Lookbook Sheet. |

Purposes affected by the image model configuration contract:

| Purpose | Current image model choices | Notes |
| --- | --- | --- |
| `lookbook.image` | GPT Image 2, Nano Banana 2, Grok Imagine, Seedream v5 Lite | Supports `takeCount`, `seed`, `imageFrame`, `detail`, `outputFormat`. |
| `lookbook.sheet` | GPT Image 2, Nano Banana 2, Grok Imagine, Seedream v5 Lite | Same model family as Lookbook Image, but `sheetFrame` naming. |
| `cast.character-sheet` | GPT Image 2, Nano Banana 2, Grok Imagine | May route through edit models when reference images are included. |
| `cast.profile` | GPT Image 2, Nano Banana 2, Grok Imagine, plus their edit choices | Edit choices require a source character sheet asset. |
| `location.environment-sheet` | GPT Image 2, Nano Banana 2, Grok Imagine | Single 4:3 sheet output. |
| `location.hero` | GPT Image 2 Edit, Nano Banana 2 Edit, Grok Imagine Edit | Single 16:9 hero image derived from a Location Sheet. |
| `scene.storyboard-sheet` | GPT Image 2, Nano Banana 2, Grok Imagine | Single 4:3 composite sheet; `shotFrame` is prompt/planning metadata, not a provider size field. |
| `shot.first-frame` | GPT Image 2, Nano Banana 2, Grok Imagine | Shot input image purpose. |
| `shot.last-frame` | GPT Image 2, Nano Banana 2, Grok Imagine | Shot input image purpose. |
| `shot.reference-image` | GPT Image 2, Nano Banana 2, Grok Imagine | Shot input image purpose. |
| `shot.video-prompt-sheet` | GPT Image 2, Nano Banana 2, Grok Imagine | Shot input image purpose with visual-style and notation metadata. |

`shot.video-take` itself is a video model purpose, not an image model purpose.
The Config tab rewrite must still support it by rendering existing final-video
route parameters, but the detailed schema inventory in this plan is for image
models.

## Provider Schema Inventory

### GPT Image 2 Text-To-Image

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/openai-gpt-image-2.json
```

Provider route:

```text
fal-ai/openai/gpt-image-2
```

Schema inputs:

| Field | Required | Schema default | Allowed/range | Config treatment |
| --- | --- | --- | --- | --- |
| `prompt` | yes | none | string, min 2 | Prompt tab, not Config. |
| `image_size` | no | `landscape_4_3` | preset enum or dimensions object | Primary Config row. |
| `quality` | no | `high` | `low`, `medium`, `high` | Primary Config row. |
| `num_images` | no | `1` | integer `1..4` | Primary Config row. |
| `output_format` | no | `png` | `jpeg`, `png`, `webp` | Primary Config row. |
| `sync_mode` | no | `false` | boolean | Advanced/fixed row when sent. |

Renku effective values:

- `num_images` comes from `takeCount`, or is fixed to `1` for fixed-output
  purposes.
- `image_size` comes from the purpose frame field:
  - `imageFrame`, `sheetFrame`, or `heroFrame`;
  - `project` is resolved against the current project aspect ratio before
    mapping to provider presets.
- `quality` comes from the Renku detail setting:
  - `draft -> low`;
  - `standard -> medium`;
  - `high -> high`.
- `output_format` comes from `outputFormat`, defaulting to `png`.
- `sync_mode` is fixed to `false`.
- Seed is unsupported.

### GPT Image 2 Edit

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/openai-gpt-image-2-edit.json
```

Provider route:

```text
fal-ai/openai/gpt-image-2/edit
```

Schema inputs:

| Field | Required | Schema default | Allowed/range | Config treatment |
| --- | --- | --- | --- | --- |
| `prompt` | yes | none | string, min 2 | Prompt tab, not Config. |
| `image_urls` | yes | none | string URI array | References tab, not Config. |
| `image_size` | no | `auto` | preset enum, `auto`, or dimensions object | Primary Config row. |
| `quality` | no | `high` | `low`, `medium`, `high` | Primary Config row. |
| `num_images` | no | `1` | integer `1..4` | Primary Config row. |
| `output_format` | no | `png` | `jpeg`, `png`, `webp` | Primary Config row. |
| `mask_url` | no | none | URI or null | Omit unless Renku actually sets it. |
| `sync_mode` | no | `false` | boolean | Advanced/fixed row when sent. |

Renku effective values:

- Same `num_images`, `quality`, and `output_format` behavior as text route.
- `image_size` is usually not provider default `auto`; Renku sends the
  purpose's resolved frame preset.
- `image_urls` comes from selected references or a required source asset and is
  visible in References, not as a count.
- `mask_url` is not a current Renku product control and should not appear
  unless a future purpose sets it.

### Nano Banana 2 Text-To-Image

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/nano-banana-2.json
```

Provider route:

```text
fal-ai/nano-banana-2
```

Schema inputs:

| Field | Required | Schema default | Allowed/range | Config treatment |
| --- | --- | --- | --- | --- |
| `prompt` | yes | none | string, min 3 | Prompt tab, not Config. |
| `aspect_ratio` | no | `1:1` | `auto`, `21:9`, `16:9`, `3:2`, `4:3`, `5:4`, `1:1`, `4:5`, `3:4`, `2:3`, `9:16`, null | Primary Config row. |
| `resolution` | no | `1K` | `1K`, `2K`, `4K` | Primary Config row. |
| `num_images` | no | `1` | integer `1..4` | Primary Config row. |
| `output_format` | no | `png` | `jpeg`, `png`, `webp` | Primary Config row. |
| `seed` | no | none | integer or null | Primary row only when supported by purpose/model. |
| `safety_tolerance` | no | `4` | `1..6` as strings | Advanced/fixed row. |
| `limit_generations` | no | `true` | boolean | Advanced/fixed row. |
| `enable_web_search` | no | `false` | boolean | Advanced/fixed row. |
| `sync_mode` | no | `false` | boolean | Advanced/fixed row. |

Renku effective values:

- `aspect_ratio` comes from the purpose frame field after resolving `project`.
- `resolution` comes from the Renku detail setting:
  - `draft -> 1K`;
  - `standard -> 2K`;
  - `high -> 4K`.
- `seed` comes from the spec and defaults to `null`.
- `safety_tolerance` is fixed to `"4"`.
- `limit_generations` is fixed to `true`.
- `enable_web_search` is fixed to `false`.
- `sync_mode` is fixed to `false`.

### Nano Banana 2 Edit

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/nano-banana-2-edit.json
```

Provider route:

```text
fal-ai/nano-banana-2/edit
```

Schema inputs are the same as text-to-image plus `image_urls`.

Additional behavior:

- `image_urls` is required by the provider route and comes from selected
  references or a required source asset.
- The provider schema default for `aspect_ratio` is `auto`, but Renku usually
  sends a concrete aspect ratio unless a purpose deliberately allows auto.

### Grok Imagine Text-To-Image

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/xai-grok-imagine-image.json
```

Provider route:

```text
fal-ai/xai/grok-imagine-image
```

Schema inputs:

| Field | Required | Schema default | Allowed/range | Config treatment |
| --- | --- | --- | --- | --- |
| `prompt` | yes | none | string, max 8000 | Prompt tab, not Config. |
| `aspect_ratio` | no | `1:1` | `2:1`, `20:9`, `19.5:9`, `16:9`, `4:3`, `3:2`, `1:1`, `2:3`, `3:4`, `9:16`, `9:19.5`, `9:20`, `1:2` | Primary Config row when sent or when provider default applies. |
| `resolution` | no | `1k` | `1k`, `2k` | Primary Config row when sent or when provider default applies. |
| `num_images` | no | `1` | integer `1..4` | Primary Config row. |
| `output_format` | no | `jpeg` | `jpeg`, `png`, `webp` | Primary Config row. |
| `sync_mode` | no | `false` | boolean | Advanced/fixed row when sent. |

Renku effective values:

- `output_format` defaults to Renku `png`, not provider `jpeg`.
- `aspect_ratio` is sent for text-to-image paths where the purpose has a frame.
- `resolution` is currently sent by Cast Character Sheet for Grok and maps:
  - `draft -> 1k`;
  - `standard -> 1k`;
  - `high -> 2k`.
- Some other Grok text-to-image paths rely on provider default
  `resolution: 1k`; the Config tab should mark that as provider default when
  it is not sent in the payload.
- Seed is unsupported.

### Grok Imagine Edit

Schema files:

```text
packages/engines/catalog/models/fal-ai/image/xai-grok-imagine-image-edit.json
packages/engines/catalog/models/fal-ai/image/xai-grok-imagine-image-quality-edit.json
```

Provider routes:

```text
fal-ai/xai/grok-imagine-image/edit
fal-ai/xai/grok-imagine-image/quality/edit
```

Schema inputs:

| Field | Required | Schema default | Allowed/range | Config treatment |
| --- | --- | --- | --- | --- |
| `prompt` | yes | none | string, max 8000 | Prompt tab, not Config. |
| `image_urls` | schema does not mark required, but Renku edit paths provide it | none | URI array | References tab, not Config. |
| `aspect_ratio` | no | `auto` | `auto` plus Grok aspect enum | Primary row when sent or provider default applies. |
| `resolution` | no | `1k` | `1k`, `2k` | Primary row when sent or provider default applies. |
| `num_images` | no | `1` | integer `1..4` | Primary Config row. |
| `output_format` | no | `jpeg` | `jpeg`, `png`, `webp` | Primary Config row. |
| `sync_mode` | no | `false` | boolean | Advanced/fixed row when sent. |

Renku effective values:

- Cast Character Sheet reference generation may use:
  - `xai/grok-imagine-image/edit` for draft/standard;
  - `xai/grok-imagine-image/quality/edit` for high.
- Cast Character Sheet sends `aspect_ratio` and `resolution`.
- Cast Profile Grok edit does not support `imageFrame`; it relies on provider
  default `aspect_ratio: auto`.
- Location Hero Grok edit relies on the source image route and does not send
  `aspect_ratio` or `resolution`.
- Shot input Grok reference mode currently allows only `num_images` and
  `output_format`; the plan must make this route-specific constraint explicit
  in model-list reports and preview rows.
- Seed is unsupported.

### Seedream v5 Lite Text-To-Image

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/bytedance-seedream-v5-lite-text-to-image.json
```

Provider route:

```text
fal-ai/bytedance/seedream/v5/lite/text-to-image
```

Schema inputs:

| Field | Required | Schema default | Allowed/range | Config treatment |
| --- | --- | --- | --- | --- |
| `prompt` | yes | none | string | Prompt tab, not Config. |
| `image_size` | no | `auto_2K` | `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`, `auto_2K`, `auto_3K`, or dimensions object | Primary Config row. |
| `num_images` | no | `1` | integer `1..6` | Primary Config row. |
| `max_images` | no | `1` | integer `1..6` | Advanced/fixed row. |
| `seed` | no | none | integer or null | Primary row when supported by purpose/model. |
| `enhance_prompt_mode` | no | `standard` | `standard`, `fast` | Advanced/fixed row. |
| `enable_safety_checker` | no | `true` | boolean | Advanced/fixed row. |
| `sync_mode` | no | `false` | boolean | Advanced/fixed row. |

Renku effective values:

- `num_images` comes from `takeCount` and can be up to `6`.
- `max_images` is fixed to `1`.
- `image_size` comes from the purpose frame field. `21:9` is not supported in
  this slice.
- `seed` comes from the spec and defaults to `null`.
- `enhance_prompt_mode` is fixed to `standard`.
- `enable_safety_checker` is fixed to `true`.
- `sync_mode` is fixed to `false`.
- Output format is not an input schema field for this provider route. Renku
  validates Seedream v5 Lite output as `png` because the catalog MIME support
  for this route is `image/png`; Config should show `Output format: png` as a
  Renku model constraint, not as a provider input field.

### Seedream v5 Lite Edit

Schema file:

```text
packages/engines/catalog/models/fal-ai/image/bytedance-seedream-v5-lite-edit.json
```

This provider route is in the catalog but is not currently exposed as a Renku
model choice for the image purposes covered by this plan. The descriptor helper
should work for it naturally, but no user-facing Config rows are required until
a Core purpose lists it.

## Architectural Proposal

### Ownership Rules

The implementation must preserve these boundaries:

- `packages/engines` owns provider model catalogs, JSON Schemas, schema
  parsing, schema-derived field descriptors, and provider payload validation.
- `packages/core` owns purpose specs, model choices, defaults, parameter
  normalization, provider payload construction, generation preview contracts,
  and the decision of which config rows are user-facing.
- `packages/studio` renders the preview projection it receives. It must not
  infer provider settings, parse provider schemas, inspect raw payload JSON, or
  decide whether a model supports a field.
- Studio server routes stay thin: receive preview requests, call Core, resolve
  browser-safe asset URLs, and serialize events.
- Prompt text and media artifacts remain opaque. Config rows describe envelope
  and provider parameters, not creative prompt content or visual correctness.

### Engine Schema Descriptor

Add a schema descriptor helper in `@gorenku/studio-engines`.

Proposed module:

```text
packages/engines/src/generation/catalog/model-input-descriptors.ts
```

Proposed public API:

```ts
export interface GenerationModelInputDescriptor {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
  fields: GenerationModelInputFieldDescriptor[];
}

export type GenerationModelInputScalarValue = string | number | boolean;

export type GenerationModelInputValue =
  | GenerationModelInputScalarValue
  | null
  | { kind: 'dimensions'; width: number; height: number };

export type GenerationModelInputFieldKind =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'enum'
  | 'dimensions'
  | 'union';

export interface GenerationModelInputFieldDescriptor {
  name: string;
  label: string;
  kind: GenerationModelInputFieldKind;
  required: boolean;
  defaultValue?: GenerationModelInputValue;
  allowedValues?: GenerationModelInputScalarValue[];
  minimum?: number;
  maximum?: number;
  description?: string;
}

export async function describeGenerationModelInputs(input: {
  provider: string;
  model: string;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationModelInputDescriptor | null>;
```

Important details:

- The helper reads the bundled catalog with existing `loadBundledGenerationCatalog`
  and `loadModelSchemaFile`.
- It derives field labels from schema `title`, falling back to a humanized
  field name only inside engines.
- It extracts:
  - `required`;
  - `default`;
  - enum values from `enum` and enum-bearing `anyOf` variants;
  - numeric `minimum` and `maximum`;
  - dimensions unions such as schema `ImageSize` plus preset enum.
- It does not decide Studio visibility. It reports schema facts.
- It does not validate creative prompt content.
- It does not introduce schema overlays or inferred model support. The schema
  file and current purpose model list remain the source of truth.
- It does not import Core preview types. Core maps engine descriptor values
  into `GenerationPreviewConfigurationValue` when it builds preview rows.

Tests:

- GPT Image 2 descriptor includes `image_size`, `quality`, `num_images`,
  `output_format`, and `sync_mode`.
- Nano Banana 2 descriptor includes `aspect_ratio`, `resolution`, `seed`,
  `safety_tolerance`, `limit_generations`, and `enable_web_search`.
- Grok descriptor shows `output_format` default `jpeg`.
- Seedream descriptor shows `image_size`, `max_images`, `enhance_prompt_mode`,
  and no `output_format` input field.

### Core Preview Configuration Contract

Replace the flat `GenerationPreviewConfigurationItem[]` with a typed,
sectioned contract. This is a breaking contract change. Do not keep aliases,
fallbacks, or compatibility loaders.

Proposed client contract in `packages/core/src/client/generation-preview.ts`:

```ts
export type GenerationPreviewConfigurationValue =
  | string
  | number
  | boolean
  | null
  | { kind: 'dimensions'; width: number; height: number }
  | Array<string | number | boolean>;

export type GenerationPreviewConfigurationValueSource =
  | 'spec'
  | 'context-default'
  | 'renku-fixed'
  | 'provider-default'
  | 'derived'
  | 'model-capability'
  | 'provider-route';

export type GenerationPreviewConfigurationRowPresentation =
  | 'static'
  | 'parameter-control';

export interface GenerationPreviewConfiguration {
  sections: GenerationPreviewConfigurationSection[];
}

export interface GenerationPreviewConfigurationSection {
  key: string;
  label: string;
  rows: GenerationPreviewConfigurationRow[];
}

export interface GenerationPreviewConfigurationRow {
  key: string;
  label: string;
  value: GenerationPreviewConfigurationValue;
  valueLabel?: string;
  providerField?: string;
  schemaDefault?: GenerationPreviewConfigurationValue;
  schemaDefaultLabel?: string;
  allowedValues?: GenerationPreviewConfigurationValue[];
  minimum?: number;
  maximum?: number;
  required?: boolean;
  source: GenerationPreviewConfigurationValueSource;
  emphasis?: 'primary' | 'secondary';
  presentation?: GenerationPreviewConfigurationRowPresentation;
}
```

`GenerationPreviewRequest.configuration` becomes:

```ts
configuration: GenerationPreviewConfiguration;
```

Validation changes:

- `configuration` must be an object.
- `configuration.sections` must be a non-empty or empty array.
- Every section must have `key`, `label`, and `rows`.
- Every row must have `key`, `label`, `value`, and `source`.
- Optional schema metadata must use scalar, dimensions, array, boolean, number,
  string, or null values only.
- `presentation` defaults to `static` when omitted.
- `parameter-control` rows must be renderable from the row's value,
  `allowedValues`, `minimum`, `maximum`, `required`, and schema-default
  metadata. They must not require Studio to know the provider model id.
- Unknown object properties on sections and rows are rejected through
  structured preview diagnostics. Row `key` values are authored by Core
  builders and should not be frozen into architecture tests.

### Core Configuration Builder Flow

Create a Core-owned preview configuration builder.

Proposed folder:

```text
packages/core/src/server/generation-preview/configuration/
  configuration-values.ts
  model-input-configuration.ts
  image-model-configuration.ts
  shot-video-configuration.ts
```

Flow for every previewable generation:

1. Normalize the purpose spec through the existing purpose validator.
2. Build the provider plan and payload through the existing purpose provider
   payload builder.
3. Identify the actual provider route from the provider plan:
   - example: `fal-ai/openai/gpt-image-2/edit`, not only
     `fal-ai/openai/gpt-image-2`.
4. Ask engines for the provider route's schema descriptor.
5. Validate the provider payload against that schema before building preview
   rows.
6. Build display rows by merging:
   - the provider payload value, when Renku sends a field;
   - schema default, when Renku deliberately relies on provider default;
   - purpose model-list capability metadata;
   - normalized purpose spec values and context-derived values such as
     resolved project frame.
7. Return a typed `GenerationPreviewConfiguration`.

This makes the preview display a projection of the same provider plan used for
estimation and generation.

### Field Visibility Policy

Core owns field visibility. Studio only renders sections and rows.

The default policy for image model previews:

- Show `prompt` in the Prompt tab, not Config.
- Show `negativePrompt` in the Prompt tab, not Config.
- Show `image_urls`, `image_url`, `start_image_url`, `end_image_url`, and other
  media-input fields through References, not Config.
- Never show raw provider upload URLs or local file paths.
- Show actual model route and provider route in Config because they explain
  which JSON Schema and route will run.
- Show primary provider parameters that affect generated media:
  - `num_images`;
  - `image_size`;
  - `aspect_ratio`;
  - `quality`;
  - `resolution`;
  - `output_format`;
  - `seed`;
  - purpose metadata such as prompt-sheet visual style and notation mode.
- Show Renku-fixed provider controls as secondary rows:
  - `sync_mode`;
  - `safety_tolerance`;
  - `limit_generations`;
  - `enable_web_search`;
  - `max_images`;
  - `enhance_prompt_mode`;
  - `enable_safety_checker`.
- Omit provider fields that are not set, not exposed, and not relied on:
  - example: GPT Image 2 `mask_url` while no purpose uses masks.
- Do not show `Reference count`.
- Do not show a raw JSON payload.

### How Values Are Set

The Config tab is read-only. Values must be set upstream through the same
Core-owned contracts used for generation:

- persisted generation specs set product controls such as:
  - `modelChoice`;
  - `takeCount`;
  - `imageFrame`, `sheetFrame`, `heroFrame`, or `shotFrame`;
  - `detail`;
  - `outputFormat`;
  - `seed`;
  - prompt-sheet metadata;
  - shot input `parameterValues`.
- model-list reports expose allowed controls and defaults to Studio, CLI, and
  agents.
- spec create/update validation normalizes missing values and rejects values
  unsupported by the selected model.
- provider payload builders map normalized spec values into provider fields.
- preview config rows read from the resulting provider payload and schema
  descriptor.

No React component may patch or reinterpret these settings locally.

### Shared Studio Parameter Controls

Move the current AI Production parameter controls out of the scene-specific
module:

```text
packages/studio/src/features/movie-studio/scenes/run-setup-controls.tsx
```

Proposed new module:

```text
packages/studio/src/features/generation-parameters/generation-parameter-control.tsx
```

Proposed component names:

```ts
export interface GenerationParameterControlReport {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  allowedValues?: Array<string | number | boolean>;
  minimum?: number;
  maximum?: number;
}

export interface GenerationParameterControlProps {
  parameter: GenerationParameterControlReport;
  value: string | number | boolean | null | undefined;
  onChange?: (value: string | number | boolean | null) => void;
  disabled?: boolean;
}

export function GenerationParameterControl(props: GenerationParameterControlProps): JSX.Element;
```

Implementation rules:

- This is a real move/rename of the existing control implementation, not a
  wrapper around the old scene-specific file.
- AI Production Run Setup imports `GenerationParameterControl` directly.
- Generation Preview Config imports `GenerationParameterControl` directly.
- The shared control uses only local UI primitives from `packages/studio/src/ui`.
- The control dispatches by stable parameter shape:
  - `allowedValues` -> `Select`;
  - boolean value/default -> `Switch`;
  - numeric value/default -> number `Input`;
  - otherwise text `Input`.
- Preview passes `disabled: true` and omits `onChange` in this slice.
- AI Production passes `disabled` according to its current editing state and
  keeps `onParameterChange`.
- The shared component may accept a className or density prop if needed, but it
  must not know generation purpose ids, provider model ids, or payload field
  names.

### Shot Input Image Parameter Correction

Replace shared shot-input image parameters with model-specific parameters.

Proposed Core changes:

```ts
function shotInputParameters(
  modelChoice: ShotVideoTakeInputModelChoice,
  routeKind: 'text-to-image' | 'reference-to-image'
): ShotVideoTakeInputModelChoiceReport['parameters']
```

Proposed defaults:

| Model | Text/no-reference defaults | Reference-conditioned defaults |
| --- | --- | --- |
| GPT Image 2 | `image_size: { width: 1024, height: 768 }`, `quality: "low"`, `output_format: "png"` | same, using edit schema |
| Nano Banana 2 | `aspect_ratio: "16:9"` or project frame, `resolution: "1K"`, `output_format: "png"`, `seed: null` | same, using edit schema |
| Grok Imagine | `aspect_ratio: "16:9"` or project frame, `resolution: "1k"`, `output_format: "png"` | route-constrained: `output_format: "png"` plus provider defaults for `aspect_ratio: "auto"` and `resolution: "1k"` unless Core explicitly supports them |

The exact project-frame default should come from the shot-video context where
available. If a shot input model list cannot resolve the project frame, it must
return a documented fixed default or require the caller to pass context. It
must not use GPT-shaped defaults for all models.

Validation:

- `validateShotInputSpec` must reject parameter ids not included in the
  selected model's parameter report for the effective route.
- Provider payload builders must not forward arbitrary `parameterValues`
  without checking them against the selected model descriptor.
- Tests must prove Nano and Grok no longer advertise GPT-only parameter names.

## Config Tab Display Specification

### Layout

Rewrite `GenerationPreviewConfigPanel` as a dense read-only configuration
summary:

- fixed tab body, scrolls internally;
- sections rendered in order from Core;
- small uppercase section labels;
- model parameter rows rendered as compact label/value rows;
- static rows, such as provider route and generation route, rendered as compact
  label/value rows;
- metadata such as provider field, schema default, allowed values, range, and
  source retained in the typed row contract but not rendered as visible
  explanatory text;
- no disconnected config cards.

The Config tab is not editable in this slice. Values must be set upstream; the
preview surface should summarize the effective configuration with minimal
visible text.
If preview-time editing is later designed, changes must flow through the same
Core/server spec-update path as the rest of Studio.

Example parameter row shape:

```text
Quality
medium
```

Studio rendering rules:

- Render `preview.configuration.sections`.
- Do not inspect `providerPreview.payload`.
- Do not calculate estimate.
- Do not calculate reference counts.
- Do not derive provider model ids from top-level model fields.
- Do not special-case image model ids in React.
- Use local UI primitives only.
- Use the shared generation-parameter control for rows with
  `presentation: "parameter-control"`.

### Footer Estimate

Move estimate summary into `GenerationPreviewDialog` footer.

Footer layout:

- left side: estimate summary when present;
- right side: Close button;
- estimate states:
  - `estimated`: formatted USD;
  - `unpriced`: `Unpriced`;
  - `not-estimated`: `Not estimated`;
- warnings show as a small badge next to the estimate.

Config tab must not render `Estimated total`.

### Universal Config Sections

Every preview should include a model section:

| Row | Value |
| --- | --- |
| Model | Product model label when known, plus Renku model choice as metadata |
| Provider route | Actual provider/model route from the provider plan |
| Generation route | Plain label for provider mode, such as `Text to image`, `Image edit`, or `Reference-conditioned image` |

Do not use a raw, unexplained `Mode` row. The row label should be
`Generation route` so the value is understandable.

Image previews then include:

- `Model inputs` section for primary schema-backed rows;
- `Fixed provider settings` section for secondary rows that Renku sends but
  the user does not normally adjust.

Shot video final previews include:

- `Model inputs` section built from existing video route parameter reports;
- `Inputs` or `References` remain in the References tab, not as counts.

### Purpose-Specific Rows

#### Cast Character Sheet

Rows:

- Model;
- Provider route;
- Generation route;
- Images to generate (`num_images`);
- Frame, with resolved project aspect ratio when `imageFrame: "project"`;
- provider size field:
  - GPT/Seedream-style routes: `image_size`;
  - Nano/Grok-style routes: `aspect_ratio`;
- Quality or Resolution:
  - GPT: `quality`;
  - Nano: `resolution`;
  - Grok: `resolution` when sent or provider default applies;
- Output format;
- Seed only for models that support it or when non-null;
- Fixed provider settings.

Forbidden rows:

- Reference count;
- voice reference;
- raw roles/tokens;
- raw provider payload.

#### Shot Video Prompt Sheet

Rows:

- Model;
- Provider route;
- Generation route;
- Image size/aspect ratio/resolution rows based on the selected image model;
- Quality or resolution rows based on the selected image model;
- Output format;
- Seed when supported;
- Reference mode;
- Visual style (`promptSheetVisualStyleId`);
- Notation mode (`promptSheetNotationModeId`);
- Fixed provider settings.

Do not validate or describe panel count, arrows, motion map quality, captions,
or any visual contents of the prompt-sheet image.

#### Shot First Frame, Last Frame, And Reference Image

Rows:

- Model;
- Provider route;
- Generation route;
- model-specific image parameters from the corrected shot input model report;
- Reference mode;
- Fixed provider settings.

Do not show shot count or reference count.

#### Lookbook Image And Lookbook Sheet

Rows:

- Model;
- Provider route;
- Generation route;
- Images to generate;
- Image frame or sheet frame with resolved project aspect ratio;
- provider image size/aspect ratio;
- Quality or resolution;
- Output format;
- Seed when supported;
- fixed provider settings.

Seedream v5 Lite rows:

- Image size;
- Images to generate;
- Seed;
- Output format as model output constraint `png`;
- Fixed rows: `max_images`, `enhance_prompt_mode`,
  `enable_safety_checker`, `sync_mode`.

#### Cast Profile

Rows:

- Model;
- Provider route;
- Generation route;
- Images to generate;
- Frame and provider size/aspect row when the route supports it;
- Quality or resolution;
- Output format;
- Seed when supported;
- Source image is shown in References, not as a count.

For Grok Imagine Edit:

- Do not show an `imageFrame` row if Core rejects `imageFrame` for that model.
- Show provider default `aspect_ratio: auto` only if Core deliberately relies
  on the provider default.

#### Location Environment Sheet

Rows:

- Model;
- Provider route;
- Generation route;
- Images to generate: `1`;
- Sheet frame: `4:3`;
- provider size/aspect row;
- Quality or resolution;
- Output format;
- Seed when supported;
- Fixed provider settings.

#### Location Hero

Rows:

- Model;
- Provider route;
- Generation route;
- Images to generate: `1`;
- Hero frame: `16:9`;
- provider size/aspect row when sent;
- Quality or resolution when sent or provider default applies;
- Output format;
- Seed when supported;
- Source Location Sheet appears in References, not as a count.

#### Scene Storyboard Sheet

Rows:

- Model;
- Provider route;
- Generation route;
- Images to generate: `1`;
- Sheet frame: `4:3`;
- Shot frame, with resolved project aspect ratio when `shotFrame: "project"`;
- provider size/aspect row for the generated sheet;
- Quality or resolution;
- Output format;
- Seed when supported;
- Fixed provider settings.

Important distinction:

- `sheetFrame` is a provider output frame for the generated sheet.
- `shotFrame` is deterministic prompt/planning metadata for panels inside the
  generated sheet. It is not the provider output aspect ratio.

## Implementation Plan

### Slice 1: Engine Schema Descriptor

- Add `model-input-descriptors.ts` in `packages/engines/src/generation/catalog`.
- Export the descriptor API through `packages/engines/src/generation/index.ts`
  and `packages/engines/src/index.ts`.
- Use existing catalog/schema loaders.
- Derive descriptors from schema facts only.
- Add focused engine tests for the covered image schemas.

### Slice 2: Core Preview Configuration Contract

- Replace `GenerationPreviewConfigurationItem[]` with
  `GenerationPreviewConfiguration`.
- Update generation preview validation for the new section/row contract.
- Update projection tests and preview validation fixtures.
- Do not keep legacy array support.

### Slice 3: Core Configuration Builder Helpers

- Add shared value-format helpers for scalar, array, and dimensions values.
- Add helper to merge payload values with schema descriptors.
- Add helper to mark value source:
  - `spec`;
  - `context-default`;
  - `renku-fixed`;
  - `provider-default`;
  - `derived`;
  - `model-capability`;
  - `provider-route`.
- Add image-model field visibility policy in Core.
- Add tests that provider payload values and config rows match for each image
  model family.

### Slice 4: Purpose Integration For Image Specs

- Update Cast Character Sheet preview builder first because it is the currently
  visible dialog path.
- Add/prepare config builders for:
  - Lookbook Image;
  - Lookbook Sheet;
  - Cast Profile;
  - Location Environment Sheet;
  - Location Hero;
  - Scene Storyboard Sheet;
  - Shot input image specs.
- Even where a purpose does not yet expose a Generation Preview Dialog, add
  reusable purpose config builders so later preview support does not duplicate
  logic.
- Ensure every builder consumes the actual provider plan and payload.

### Slice 5: Shot Input Model Parameter Correction

- Replace `shotInputParameters()` with model-specific parameters.
- Replace `defaultShotInputParameterValues()` with model-specific defaults.
- Update shot input model-list reports.
- Update shot input spec validation to reject unsupported parameter ids.
- Update shot input provider payload tests for GPT, Nano, and Grok.
- Update dependency draft spec generation so generated prompt-sheet/input
  drafts use model-specific defaults.

### Slice 6: Shot Video Final Preview Configuration

- Reuse existing video route parameter reports for `shot.video-take`.
- Build preview configuration from:
  - selected final video model;
  - selected input mode;
  - selected route parameters;
  - normalized route settings from `normalizeRouteSettingsForContext`;
  - provider payload values.
- Keep references and media inputs in the References tab, not as counts.

### Slice 7: Studio Config Tab Rewrite

- Move and rename the existing AI Production run-setup controls into the shared
  `GenerationParameterControl` component.
- Update AI Production Run Setup to import the shared component directly.
- Rewrite `GenerationPreviewConfigPanel` to render configuration sections and
  rows.
- Remove estimate rendering from Config.
- Remove card-grid treatment for config rows.
- Render model-parameter rows as compact label/value rows.
- Render static rows as compact label/value rows.
- Keep row metadata in the typed contract without rendering it as visible
  explanatory text.
- Keep the component generic and data-driven.
- Do not import engines into Studio.
- Do not inspect `providerPreview.payload`.

### Slice 8: Dialog Footer Estimate

- Add a small estimate component in `features/generation-preview`.
- Render it in `GenerationPreviewDialog` footer.
- Keep Close as the only footer control unless generation approval actions are
  separately designed later.
- Add tests proving Config does not render `Estimated total` and footer does.

### Slice 9: Documentation

- Update `docs/architecture/reference/media-generation.md`:
  - generation preview config is Core-authored;
  - schema defaults and effective values are distinct;
  - estimate belongs to dialog footer.
- Update `docs/architecture/studio-coordination-events.md`:
  - `configuration` is a typed sectioned review projection;
  - low-level raw payload remains hidden from Studio dialog.
- Update product/design guidance only if the final row/table pattern becomes a
  reusable UI pattern.

## Testing Strategy

Core and engines tests are required. Browser testing is not required for this
plan and should not be run unless explicitly requested.

Engine tests:

- `describeGenerationModelInputs` returns expected fields for each covered
  image route.
- It extracts enum values from direct `enum` and enum-bearing `anyOf`.
- It extracts numeric min/max from `num_images`.
- It preserves schema defaults such as Grok `output_format: jpeg`.

Core tests:

- Preview validation rejects old array configuration.
- Preview validation accepts sectioned configuration with row metadata.
- Cast Character Sheet GPT preview shows:
  - product model;
  - provider route;
  - `num_images`;
  - `image_size`;
  - `quality`;
  - `output_format`;
  - no `Reference count`.
- Cast Character Sheet Nano preview shows:
  - `aspect_ratio`;
  - `resolution`;
  - `seed`;
  - fixed Nano settings.
- Cast Character Sheet Grok reference preview shows:
  - provider route `xai/grok-imagine-image/edit` or
    `xai/grok-imagine-image/quality/edit`;
  - `aspect_ratio`;
  - `resolution`;
  - no seed row.
- Seedream Lookbook preview/config builder shows:
  - `image_size`;
  - `num_images`;
  - `max_images`;
  - `enhance_prompt_mode`;
  - `enable_safety_checker`;
  - output format as model output constraint `png`.
- Shot input model reports are model-specific:
  - GPT includes `image_size` and `quality`;
  - Nano includes `aspect_ratio`, `resolution`, `seed`, and `output_format`;
  - Grok includes route-compatible parameters and rejects unsupported
    reference-route fields.
- Provider payload validation runs before preview configuration is accepted.

Studio tests:

- Config tab renders section labels and row values from
  `preview.configuration.sections`.
- Config tab renders parameter-control rows as minimal read-only values.
- AI Production Run Setup imports the shared control directly.
- Config tab does not render `Estimated total`.
- Dialog footer renders estimate when `preview.estimate` exists.
- Config tab does not render `providerPreview.payload`.
- Config tab does not render `Reference count`.
- The dialog still uses the shared line-tab style from `LineTabBar`.
- The Config component does not contain model-id branching.

Command examples:

```bash
pnpm --dir packages/engines test -- model-input
pnpm --dir packages/core test -- generation-preview
pnpm --dir packages/core test -- cast-character-sheet
pnpm --dir packages/core test -- shot-video-take
pnpm --filter @gorenku/studio test -- generation-preview-dialog-host
pnpm --filter @gorenku/studio lint
```

## Risks And Review Points

### Risk: Showing Too Many Provider Fields

Some provider fields are real but low-value for users, such as `sync_mode`.
Hiding them entirely can make Config feel incomplete; showing them as primary
rows can make Config noisy.

Resolution:

- Primary rows show model-affecting media settings.
- Secondary rows show fixed provider settings in a quieter section.
- Prompt/reference fields stay in their own tabs.

### Risk: Generic Schema UI Becomes A Form Builder

This plan must not turn Studio preview into a provider schema editor.

Resolution:

- Engines extracts schema descriptors.
- Core decides display rows.
- Studio renders read-only rows.
- Editing remains in existing model/spec surfaces.

### Risk: Purpose-Specific Product Fields Get Lost

Not every important row is a provider schema field. Examples:

- `promptSheetVisualStyleId`;
- `promptSheetNotationModeId`;
- Scene Storyboard `shotFrame`;
- reference mode.

Resolution:

- Core config rows support provider-backed rows and product metadata rows.
- Product metadata rows use `source: "spec"` or `source: "derived"` and omit
  `providerField`.

### Risk: Shot Input Fix Expands Scope

The shot input parameter mismatch is real and should be fixed, but it touches
model-list reports, dependency draft specs, provider payloads, tests, and
possibly Studio controls.

Resolution:

- Treat it as an architecture blocker for accurate Config.
- Keep the fix focused on image input model parameters.
- Do not redesign final video parameter controls in this slice.

## Completion Checklist

Update 2026-07-05: completed items below reflect the implemented/current
preview surface. Items for saved-spec preview builders that are not currently
wired through `buildMediaGenerationPreview`, plus final `shot.video-take`
Config rows, remain unchecked.

Update 2026-07-06: `0114` cleared the remaining verification blockers from
review. The stale CLI preview fixture now sends the sectioned configuration
contract, the shot input provider-payload fixtures use current parameter and
reference-bundle shapes, focused CLI/Core verification passed, and `pnpm check`
passed. The unrelated future-builder items below remain unchecked.

Update 2026-07-06 checklist verification: the remaining unchecked items were
re-checked against the implementation and must stay unchecked. Saved-spec
generation previews are still only wired for `cast.character-sheet` in
`packages/core/src/server/media-generation/lifecycle/spec-service.ts`; the
other image purpose preview builders listed below have not been added. Final
`shot.video-take` saved-spec previews also do not yet build Config rows from
selected route parameters or normalized route settings. This plan should not be
marked fully complete until those implementation slices and tests exist.

### Review And Architecture

- [x] Confirm the plan covers only Core-listed image model choices, not every
      catalog image model.
- [x] Confirm no Studio component imports provider schemas or engines.
- [x] Confirm Core owns row visibility and value-source labeling.
- [x] Confirm engines owns schema descriptor extraction.
- [x] Confirm prompt and media artifact opacity rules are preserved.
- [x] Confirm no compatibility array contract is kept for old
      `configuration`.
- [x] Confirm estimate is treated as dialog footer state, not Config state.

### Engine Schema Descriptor

- [x] Add schema descriptor module in `packages/engines`.
- [x] Export descriptor API from package public entrypoints.
- [x] Extract labels from schema titles.
- [x] Extract required fields.
- [x] Extract schema defaults.
- [x] Extract enum values from direct `enum`.
- [x] Extract enum values from enum-bearing `anyOf`.
- [x] Extract numeric min/max.
- [x] Represent dimensions unions without losing preset enums.
- [x] Add descriptor tests for GPT Image 2 text route.
- [x] Add descriptor tests for GPT Image 2 edit route.
- [x] Add descriptor tests for Nano Banana 2 text route.
- [x] Add descriptor tests for Nano Banana 2 edit route.
- [x] Add descriptor tests for Grok text route.
- [x] Add descriptor tests for Grok edit and quality edit routes.
- [x] Add descriptor tests for Seedream v5 Lite text route.

### Core Contract

- [x] Replace `GenerationPreviewConfigurationItem[]` with
      `GenerationPreviewConfiguration`.
- [x] Update all preview fixtures.
- [x] Update preview validation for sections and rows.
- [x] Reject unsupported configuration object properties.
- [x] Validate value shapes.
- [x] Validate value source ids.
- [x] Validate row presentation ids.
- [x] Validate `parameter-control` rows contain enough metadata to render
      without provider-specific React branching.
- [x] Update Studio coordination event validation as needed.
- [x] Update client exports.

### Core Configuration Builders

- [x] Add shared config value helpers.
- [x] Add schema/payload merge helper.
- [x] Add model section builder.
- [x] Add image model primary-row builder.
- [x] Add fixed provider settings builder.
- [x] Add purpose metadata row helper.
- [x] Validate provider payload before building preview rows.
- [x] Ensure provider defaults are marked separately from Renku-sent values.
- [x] Ensure schema defaults do not overwrite effective payload values.

### Image Purpose Integration

- [x] Update Cast Character Sheet preview config.
- [x] Add tests for Cast Character Sheet GPT rows.
- [x] Add tests for Cast Character Sheet Nano rows.
- [x] Add tests for Cast Character Sheet Grok text rows.
- [x] Add tests for Cast Character Sheet Grok reference rows.
- [x] Add reusable builders for Lookbook Image config.
- [x] Add reusable builders for Lookbook Sheet config.
- [x] Add reusable builders for Cast Profile config.
- [x] Add reusable builders for Location Environment Sheet config.
- [x] Add reusable builders for Location Hero config.
- [x] Add reusable builders for Scene Storyboard Sheet config.
- [x] Ensure no config builder returns `Reference count`.

### Shot Input Image Parameters

- [x] Replace shared shot input parameter report with model-specific reports.
- [x] Replace shared shot input defaults with model-specific defaults.
- [x] Update GPT shot input defaults.
- [x] Add Nano shot input defaults.
- [x] Add Grok shot input defaults.
- [x] Add Grok reference-route parameter restrictions.
- [x] Update shot input spec validation for selected model parameter ids.
- [x] Update shot input dependency draft specs to use model-specific defaults.
- [x] Update provider payload tests for model-specific image parameters.

### Shot Video Final Preview

- [x] Build `shot.video-take` config rows from selected route parameters.
- [x] Use normalized route settings for effective values.
- [x] Keep prepared inputs in References, not Config counts.
- [x] Add tests for final video Config rows.

### Studio UI

- [x] Move run-setup parameter controls into
      `features/generation-parameters/generation-parameter-control.tsx`.
- [x] Rename `RunSetupParameter` to `GenerationParameterControl`.
- [x] Update AI Production Run Setup to import the shared control directly.
- [x] Rewrite `GenerationPreviewConfigPanel` around sections and rows.
- [x] Remove config card grid.
- [x] Remove estimate rendering from Config.
- [x] Render model parameter rows as minimal read-only values.
- [x] Render static configuration rows as compact label/value rows.
- [x] Add footer estimate component.
- [x] Render estimate in `GenerationPreviewDialog` footer.
- [x] Keep Close button in footer.
- [x] Render row metadata without raw JSON.
- [x] Do not branch on provider model ids in React.
- [x] Do not show `Reference count`.
- [x] Do not show `providerPreview.payload`.
- [x] Keep shared `LineTabBar` tabs.

### Documentation

- [x] Update media-generation architecture reference.
- [x] Update studio coordination events reference.
- [x] Document schema default vs effective Renku value distinction.
- [x] Document estimate footer placement.
- [x] Document shot input model-specific parameter reports.

### Verification

- [x] Run focused engine descriptor tests.
- [x] Run focused core generation preview tests.
- [x] Run focused core image purpose tests.
- [x] Run focused shot-video input tests.
- [x] Run focused Studio generation preview tests.
- [x] Run Studio lint.
- [x] Do not run browser verification unless explicitly requested.
- [x] Confirm checklist items are complete before marking this plan completed.
