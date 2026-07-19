# 0149 Image Generation Review And Model-Routed Prompt Authoring

Status: complete
Date: 2026-07-18

## Summary

Make image generation requests comfortable and safe to review while preserving
one exact provider-facing prompt and one exact `GenerationSpec`.

This plan implements three current product requirements:

1. Studio shows only the small, explicitly authored set of settings that Renku
   users may configure for the selected image model. Provider transport,
   storage, multiplicity, safety, and experimental fields do not automatically
   become UI controls.
2. Image Revision supports two distinct workflows:
   - **Regenerate** starts from the exact original request and lets the user edit
     its prompt, references, configuration, and model before creating a new
     request;
   - **Edit** starts a focused `image.edit` request whose required source image
     is the image being revised, while still allowing the user to choose another
     compatible image model.
3. The prompt editor is a rich document surface. It offers selected references
   as exact `@ReferenceN` completions and previews the referenced image when a
   known mention is hovered or entered by the caret.

The implementation keeps the existing architecture boundaries:

- provider schemas remain the source of field types, defaults, allowed values,
  numeric bounds, media fields, and media requiredness;
- one Engines-owned Studio image-model catalog adds only product policy: family
  grouping, model labels, route preference, and the exact parameters users may
  configure;
- Core owns route resolution, durable request mutation, reference mention
  allocation, and the Regenerate/Edit workflows;
- Studio renders Core projections and sends user intent;
- Studio Skills owns model-specific prompt guidance and prompt composition;
- runtime code never interprets, rewrites, scores, or validates prompt meaning.

The scope is limited to the current Studio image workflows and their installed
Studio Skills guidance.

## Product Outcome

After this plan is complete:

- Config displays one user-facing image-model family and only the parameters
  deliberately exposed for the resolved exact route;
- provider fields such as `num_images`, `sync_mode`, `output_format`, provider
  safety controls, storage switches, and experimental flags do not appear merely
  because they exist in a provider schema;
- parameter types, raw enum values, defaults, and bounds still come from the
  exact provider schema rather than being copied into product configuration;
- changing references or model family causes Core to resolve a compatible exact
  route and return that route's controls and estimate for review;
- Regenerate preserves the original request's purpose, target, prompt,
  references, and supported configuration as its starting point, without
  mutating the frozen source request;
- Edit creates a new `image.edit` draft with the current image as a required,
  locked source reference and allows any model family with a compatible
  image-input route;
- Prompt, References, Config, diagnostics, and estimate presentation are shared
  by Generation Preview and Image Revision;
- the prompt editor uses a readable neutral document surface in dark and light
  themes and preserves the exact authored string;
- every selected image reference has a stable optional `promptMention` such as
  `@Reference1`;
- typing `@` offers the request's selected image references, inserts the exact
  mention through normal editor history, and previews the real reference image
  on hover or caret entry;
- reference mentions remain presentation and authoring metadata only: they do
  not select references, route provider media, or validate prompt contents;
- model-specific image prompts are authored through the selected exact route's
  current Studio Skills guide.

## Scope

### Image purposes

The plan applies to the current image-output purposes:

- `image.create`;
- `image.edit`;
- `lookbook.image`;
- `lookbook.video-sheet`;
- `lookbook.storyboard-sheet`;
- `cast.character-sheet`;
- `cast.profile`;
- `location.sheet`;
- `location.hero`;
- `scene.storyboard-sheet`.

`lookbook.video-sheet` is included because its output is an image.

### Current image-model families

The Studio image-model catalog covers the current managed routes for:

- GPT Image 2;
- Nano Banana 2;
- Nano Banana Pro;
- Grok Imagine Image.

The Codex external GPT Image 2 workflow remains a distinct read-only execution
envelope. Studio Skills uses the GPT Image 2 guide for its prompt, but Studio
does not treat it as a managed configurable route. An image attached from a
frozen external source spec may still seed a new managed Regenerate draft.

### Dialogs and interactions

The UI work covers:

- mutable and frozen Generation Preview;
- multi-request Generation Preview navigation;
- Image Revision Regenerate;
- Image Revision Edit;
- shared Prompt, References, Config, diagnostics, and estimate presentation;
- dark and light themes;
- keyboard, focus, selection, scrolling, disabled, and pending states;
- selected-reference mention completion and image preview.

### Explicit non-goals

This plan does not:

- expose complete provider schemas as Config forms;
- create a generic provider-form schema or UI DSL;
- copy provider field types, requiredness, defaults, raw enum values, bounds, or
  descriptions into the Studio image-model catalog;
- maintain separate authored registries for route availability, image-input
  capability, and editable parameters;
- infer image-input capability from route suffixes such as `/edit` in Core,
  Studio server, React, or Studio Skills;
- treat provider fields such as `image_urls` as prompt-visible mentions;
- persist provider transport controls as hidden Studio user configuration;
- add prompt section schemas, required headings, quality scores, or runtime
  prompt-format validation;
- infer selected references from prompt contents or rewrite prompts when
  references change;
- render a second Markdown review value or switch representations on focus;
- automatically reformat existing prompts;
- create a general-purpose mention/autocomplete framework in `src/ui`;
- add mobile layout or verification;
- add compatibility aliases, re-export stubs, or old-contract shims.

## Context

### Accepted architecture

- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`;
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`;
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/decisions/0049-use-request-scoped-generation-reference-choices.md`;
- `docs/decisions/0053-use-one-configurable-studio-media-card.md`;
- `docs/decisions/0057-use-model-routed-human-readable-generation-prompts.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/product/design-guidelines.md`.

Decision 0057 is revised with this plan. It narrows Decision 0047 only for the
focused image authoring surfaces: React submits a family choice, Core resolves a
compatible exact route, and the persisted `GenerationSpec.model` remains the
exact provider/model identity. Generic spec creation and update do not acquire
automatic model switching.

### Current implementation

- `packages/engines/src/generation/studio-model-availability.ts` contains the
  current curated image routes;
- `packages/engines/src/generation/catalog/model-input-descriptors.ts` projects
  full provider schemas, including semantic media fields and cardinality;
- `packages/core/src/server/generation/purpose-contract.ts` uses the current
  `modelUse` filter;
- `packages/core/src/server/generation-preview-resource/` owns Preview
  projection and mutation;
- `packages/core/src/server/image-revision-workflow/` owns Image Revision source,
  Regenerate/Edit drafts, preview, estimate, and run behavior;
- `packages/studio/src/features/generation-request-editor/` is already the
  shared request-editor composition boundary, but several shared children still
  have Generation Preview ownership and names;
- `packages/studio/src/ui/syntax-text-editor.tsx` currently has no production
  caller outside generation prompt editing;
- `plans/active/0148-generation-spec-lifecycle-and-source-request-projection.md`
  is complete and its frozen-request rules must remain intact.

### Studio Skills ownership

`/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/`
owns Studio-specific image prompt authoring. It must contain the current guides
needed for every image route Studio exposes and must not depend on an optional
plugin being installed.

The skill combines:

```text
purpose ingredients
  + selected references and exact prompt mentions
  + exact provider/model route guide
  + generate or revise-source prompt intent derived from the purpose
  -> exact human-reviewable prompt
```

For current purposes, `image.edit` uses revise-source guidance and every other
image purpose uses generation guidance. Regenerate preserves the source request's
purpose, so regenerating an `image.edit` request remains revise-source authoring.

## Architecture Shape Gate

### Engines: one Studio image-model catalog

Engines owns one authored image-model catalog:

```text
packages/engines/src/generation/
  studio-image-model-catalog.ts
  studio-model-availability.ts
  catalog/
    model-input-descriptors.ts
```

`studio-image-model-catalog.ts` is the sole authored runtime inventory of Studio
image families and exact managed image routes. Each family declares:

- stable family id;
- user-facing family label;
- ordered exact routes, where order is the deterministic preference when more
  than one route is compatible;
- the ordered parameters users may configure on each route;
- product-facing parameter labels and optional enum-value labels.

It does not declare image-input availability. Engines derives `none`, `optional`,
or `required` from the exact route's semantic image-media field descriptors and
their cardinality. Provider schemas therefore remain the source of input
requiredness.

`studio-model-availability.ts` derives its image rows from this catalog. It does
not keep a second curated image array. Its existing video/audio behavior remains
out of scope except for any narrow typing changes required by the shared public
contract.

The Engines public functions are:

- `listStudioImageModelFamilies()`;
- `readStudioImageModelFamily(familyId)`;
- `readStudioImageModelRouteProfile({ provider, model })`;
- `deriveStudioImageInputAvailability(modelInputDescriptor)`.

The existing schema descriptor continues to own:

- field name and kind;
- authored-text and media semantics;
- requiredness;
- default value;
- raw allowed values;
- minimum and maximum;
- media kinds and cardinality;
- provider description.

### Core: focused image authoring and workflow rules

Core owns:

- resolving one exact route from a selected family and the current selected
  image references;
- projecting model families and controls for Generation Preview and Image
  Revision;
- accepting `modelFamilyId` from those focused browser authoring commands;
- persisting the resolved exact identity in `GenerationSpec.model`;
- accepting only declared user-configurable fields through browser authoring
  commands;
- rebuilding managed Studio-authored values from prompt fields plus the
  resolved route's declared user-configurable values;
- preserving the original purpose and target in Regenerate;
- requiring and locking the source image in Edit;
- allocating and validating stable prompt mentions on selected references;
- leaving frozen source requests immutable.

Shared image authoring logic lives in:

```text
packages/core/src/server/generation/
  image-model-authoring.ts       family lookup and compatible exact-route
                                 resolution
  image-configurable-values.ts  configurable-field validation, control
                                 projection, and managed-value rebuilding
```

Generation Preview and Image Revision call these shared Core modules. Neither
workflow reimplements route or configurable-field policy.

Core does not add a general model-family field to `GenerationSpec`. Family id is
focused authoring intent; exact route identity is the durable executable record.

Core does not add a general `ImageAuthoringIntent` field. Current prompt intent
is derived from the actual purpose: `image.edit` is revise-source and every
other current image purpose is generation. `ImageRevisionMode` remains the
workflow discriminator.

Remove `GenerationPurposeDescriptor.modelUse` and Engines
`StudioGenerationUse`. Those contracts encode provider route naming as product
intent and are no longer needed. Update all callers directly; do not translate
the old values into the family catalog.

### Studio request editor: shared product feature

All shared generation request presentation lives in:

```text
packages/studio/src/features/generation-request-editor/
  generation-request-editor.tsx
  generation-request-prompt-panel.tsx
  generation-request-prompt-editor.tsx
  generation-request-prompt-mentions.ts
  generation-request-reference-grid.tsx
  generation-request-reference-card.tsx
  generation-request-controls-panel.tsx
  generation-request-config-panel.tsx
  generation-request-diagnostics.tsx
  generation-request-estimate.tsx
```

`generation-request-editor.tsx` stays a thin Prompt / References / Config
composition component.

`generation-request-prompt-editor.tsx` owns the actual Prism editor integration,
document presentation, exact mention decoration, completion menu, image preview,
selection replacement, and keyboard behavior. It is a product component with
real generation meaning, not a pass-through wrapper.

Because the current `SyntaxTextEditor` has no other production use, move its
implementation into the feature-owned prompt editor and delete the unused
generic component. Do not retain speculative JSON, `code | document`, generic
mention, or generic preview APIs. A future unrelated editor can establish a
shared primitive after real reuse exists.

The existing Prism light/dark styles may remain shared style files. They must
not contain model- or purpose-specific branches.

### Studio dialog shells

`packages/studio/src/features/generation-preview/` owns only saved-preview
navigation, update, frozen state, title, and Close/Update actions.

`packages/studio/src/features/image-revision/` owns only source identity,
Regenerate/Edit mode selection, mode availability, run behavior, and
Cancel/Regenerate/Edit actions.

Both shells compose the same request editor and estimate component. Neither
shell owns prompt editor internals, reference cards, Config rendering, or model
route logic.

The visible Original Generation Request card is removed. Regenerate's shared
Prompt, References, and Config panels are the editable projection of that exact
request. If `sourceGenerationRequest` has no remaining consumer, delete its DTO,
projection, tests, and database reads directly.

### Studio Skills: exact-route guide mapping

The Studio Skills shape is:

```text
studio-skills/skills/media-producer/
  SKILL.md
  scripts/
    validate-image-prompt-guides.mjs
  references/
    workflow.md
    image-prompt-authoring.md
    image-model-guide-registry.json
    image-models/
      gpt-image-2.md
      nano-banana.md
      grok-imagine-image.md
    <existing image-purpose guides>
  samples/
    <current image-purpose samples>
  evals/
    image-prompt-routing/
      forward-test-cases.md
```

The registry maps exact provider/model route identity to one guide path. It does
not repeat image-input capability, family definitions, configurable parameters,
or runtime validation rules.

The checked-in validation command is:

```bash
node skills/media-producer/scripts/validate-image-prompt-guides.mjs \
  --project urban-basilica
```

It validates registry uniqueness, guide existence, sample references, and
coverage of the current image routes reported by the installed `renku` CLI for
`image.create` and `image.edit`. The required project argument supplies ordinary
Core context; the script does not parse TypeScript source or freeze private
implementation names.

### Public entrypoints

- `packages/engines/src/generation/index.ts` exports the focused catalog types
  and lookup/resolution functions; it remains a thin entrypoint;
- `packages/core/src/server/index.ts` continues to export focused Preview and
  Image Revision services; it remains thin;
- client DTOs remain under `packages/core/src/client/`;
- Studio imports shared request components from their owning feature files;
- no new `index.ts` is required in Studio feature folders;
- no compatibility barrel or re-export stub is added after component moves.

### Domain branches

- exact image families, route order, parameter allowlists, and product labels
  exist only in `studio-image-model-catalog.ts`;
- provider field mechanics and media requiredness exist only in provider schemas
  and their Engines descriptors;
- purpose-specific creative ingredients remain in Studio Skills purpose guides;
- exact-route prompt practices remain in Studio Skills model guides;
- Regenerate/Edit workflow branches remain in Core Image Revision modules;
- React branches only on projected mode and interaction state.

### Stop conditions

Stop and revise the implementation if it starts adding:

- another authored runtime inventory of Studio image routes;
- an authored image-input capability value that duplicates schema requiredness;
- a product UI schema that copies provider field mechanics;
- model-name, route-suffix, provider-field, or enum-token switches in React;
- family or route resolution in React or Studio server handlers;
- hidden user-authored provider values that affect execution but cannot be
  reviewed or changed;
- a generic patch API for GenerationSpec mutation;
- prompt parsing, prompt validation, prompt rewriting, or reference inference
  from prompt text;
- a generic mention/autocomplete/preview framework in `src/ui`;
- duplicated request-editor children under both dialog features;
- a large request-editor, dialog, catalog, or skill file that absorbs unrelated
  responsibilities;
- raw HTML interactive controls in Studio feature code;
- source-text architecture tests that freeze private implementation names.

## Contracts

### Studio image-model catalog

The Engines-owned contract is:

```ts
interface StudioImageModelFamily {
  id: string;
  label: string;
  routes: StudioImageModelRouteProfile[];
}

interface StudioImageModelRouteProfile {
  provider: string;
  model: string;
  userConfigurableParameters: StudioModelConfigurableParameter[];
}

interface StudioModelConfigurableParameter {
  field: string;
  label: string;
  valueLabels?: Record<string, string>;
}

type StudioImageInputAvailability = 'none' | 'optional' | 'required';
```

`StudioImageInputAvailability` is a derived result, not catalog data.

The values below are the current proposal. Edit the `Yes`/`No` cells directly
before implementation to define the Studio configuration surface for each exact
model route.

#### GPT Image 2 — `fal-ai/openai/gpt-image-2`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `image_size` | Yes |
| `quality` | Yes |
| `num_images` | No |
| `output_format` | No |
| `sync_mode` | No |

#### GPT Image 2 Edit — `fal-ai/openai/gpt-image-2/edit`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `image_urls` | No |
| `image_size` | Yes |
| `quality` | Yes |
| `num_images` | No |
| `output_format` | No |
| `sync_mode` | No |
| `mask_url` | No |

#### Nano Banana 2 — `fal-ai/nano-banana-2`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `num_images` | No |
| `seed` | No |
| `aspect_ratio` | Yes |
| `output_format` | No |
| `safety_tolerance` | No |
| `sync_mode` | No |
| `resolution` | Yes |
| `limit_generations` | No |
| `enable_web_search` | No |

#### Nano Banana 2 Edit — `fal-ai/nano-banana-2/edit`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `num_images` | No |
| `seed` | No |
| `aspect_ratio` | Yes |
| `output_format` | No |
| `safety_tolerance` | No |
| `sync_mode` | No |
| `image_urls` | No |
| `resolution` | Yes |
| `limit_generations` | No |
| `enable_web_search` | No |

#### Nano Banana Pro — `fal-ai/nano-banana-pro`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `num_images` | No |
| `aspect_ratio` | Yes |
| `output_format` | No |
| `sync_mode` | No |
| `resolution` | Yes |
| `limit_generations` | No |
| `enable_web_search` | No |

#### Nano Banana Pro Edit — `fal-ai/nano-banana-pro/edit`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `num_images` | No |
| `aspect_ratio` | Yes |
| `output_format` | No |
| `sync_mode` | No |
| `image_urls` | No |
| `resolution` | Yes |
| `limit_generations` | No |
| `enable_web_search` | No |

#### Grok Imagine Image — `fal-ai/xai/grok-imagine-image`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `num_images` | No |
| `aspect_ratio` | Yes |
| `resolution` | Yes |
| `output_format` | No |
| `sync_mode` | No |

#### Grok Imagine Image Edit — `fal-ai/xai/grok-imagine-image/edit`

| Schema property | Shown in Config tab? |
| --- | --- |
| `prompt` | No |
| `num_images` | No |
| `aspect_ratio` | Yes |
| `resolution` | Yes |
| `output_format` | No |
| `sync_mode` | No |
| `image_urls` | No |

The catalog supplies labels such as `Image size`, `Landscape · 16:9`, and
`Match source`, while raw values such as `landscape_16_9` and `auto` remain the
submitted schema values.

Engines validates the complete catalog against current schemas when the catalog
is read and in focused tests. An explicit empty array means the route has no
user-configurable parameters.

The old `StudioGenerationUse` and purpose `modelUse` contracts are removed
without aliases. Availability lists all catalog routes for the requested media
kind; focused family resolution decides which exact image route can represent
the current references.

### Schema-derived image-input capability

Engines derives route capability from semantic image-media fields:

- no image-media field -> `none`;
- one or more image-media fields and no required image count -> `optional`;
- one or more image-media fields with a required image count -> `required`.

Core never derives capability from `/edit`, endpoint names, or raw field names.
If Engines cannot classify an exact route from its schema descriptor, catalog
validation fails with a structured Engines diagnostic before the route becomes
selectable.

### Family route resolution

The focused Core resolver accepts:

```ts
interface ResolveStudioImageRouteInput {
  modelFamilyId: string;
  hasSelectedImageReferences: boolean;
}
```

Resolution uses the family's declared route order:

- without selected images, choose the first `none` or `optional` route;
- with selected images, choose the first `optional` or `required` route;
- if no compatible route exists, return a structured diagnostic;
- never silently drop selected references to make a route compatible.

Edit first enforces its required source selection, so it always resolves through
the selected-images branch.

### Focused browser authoring DTOs

Generation Preview authoring becomes:

```ts
interface GenerationPreviewAuthoring {
  selectedModelFamilyId: string;
  modelFamilies: Array<{
    familyId: string;
    label: string;
  }>;
  controls: GenerationEditorControl[];
}
```

The controls belong to the currently resolved exact route. Exact provider/model
identity remains available in the read-only Preview model projection for
diagnostics and reproducibility, but is not the Model select value.

The Preview update command accepts:

```ts
interface UpdateGenerationPreviewAuthoringInput {
  modelFamilyId: string;
  prompt: {
    authoredText: string;
    negativeText?: string | null;
  };
  parameterValues: Record<string, JsonValue>;
  slotSelections: GenerationReferenceSlotSelectionInput[];
}
```

Core applies slot selections, allocates or preserves prompt mentions, resolves
the exact route, validates parameter names against that route's catalog profile,
combines them with schema mechanics, rebuilds managed authored values, persists
the draft spec, and returns a fresh Preview with exact route, controls,
diagnostics, and estimate.

`ImageRevisionDraft` likewise carries `modelFamilyId` rather than asking React to
select a provider endpoint.

### Managed authored values

For a Studio-managed image request updated through Preview or Image Revision,
Core rebuilds `GenerationSpec.values` from:

- the exact prompt field;
- the exact negative-prompt field when the resolved schema supports it and a
  value is authored;
- the resolved route's submitted user-configurable parameters;
- Core-owned fixed product settings applied through the existing purpose
  settings contract.

It does not preserve undeclared provider values as invisible user configuration.
Transport and provider mechanics remain omitted or are supplied by the owning
request-assembly boundary. Model changes do not carry incompatible raw fields
from the previous route.

Agent-external requests remain read-only for model/config authoring and preserve
their existing arbitrary exact values.

### Regenerate contract

Regenerate starts from exact source provenance and:

- accepts a completed managed run snapshot or the exact frozen source spec
  attached to an externally generated image;
- preserves its purpose and target;
- copies its prompt, references, and supported user configuration into a new
  in-memory draft;
- derives the selected family from a currently cataloged managed source route;
- uses the current purpose's recommended managed family when the source route is
  external or no longer selectable;
- allows prompt, reference, family, and configuration changes;
- resolves a new exact route before preview/estimate/run;
- creates a new `renku-managed` GenerationSpec and run;
- never mutates or unfreezes the original spec or run snapshot.

If the source request purpose is `image.edit`, Regenerate remains an
`image.edit` request. Regenerate is not universally mapped to generation prompt
intent.

### Edit contract

Edit creates a new `image.edit` draft that:

- targets the source Asset;
- includes the source AssetFile in the existing source-image slot;
- locks that source selection in the UI;
- rejects a missing or changed source at the Core boundary;
- begins with a focused edit prompt value;
- allows selection of any image family with a compatible image-input route;
- allows supported configuration and any additional reference choices exposed
  by the current `image.edit` guide;
- creates a new GenerationSpec and run.

### Prompt mention envelope

Selected references may carry:

```ts
interface GenerationReferenceSelection {
  // existing placement, providerField, and reference
  promptMention?: string;
}

interface GenerationSpec {
  // existing request envelope
  nextPromptMentionNumber?: number;
}
```

`promptMention` is an exact Studio prompt alias such as `@Reference1`. It is
independent of `providerField`, asset title, filename, reference role, and
provider upload order.

`nextPromptMentionNumber` is request-owned allocation state. It prevents a
cleared mention that may still exist in the opaque prompt from being silently
reused for another reference. It is not provider input and is not shown in the
UI. For an existing request without the field, Core initializes it from the
largest numeric `promptMention` already present in reference metadata; Core
never scans prompt text.

Core owns these rules:

- mentions are optional for imported/external envelopes;
- when the focused Studio selection command selects a new image reference into
  a placement without a mention, allocate `@ReferenceN` from the request's
  monotonic `nextPromptMentionNumber` and increment it;
- replacing the reference in the same placement preserves its mention;
- clearing the reference removes it from completion choices but never edits the
  prompt string or decrements the mention counter;
- non-empty mentions must be unique within the request;
- `nextPromptMentionNumber`, when present, must be a positive integer greater
  than every numeric Studio mention already present in reference metadata;
- validation never requires the prompt to contain the mention;
- prompt scanning never creates or changes a mention.

The Preview reference projection exposes the same optional `promptMention` and
the existing safe `browserUrl`. The incorrect `providerToken` field is deleted;
no alias remains.

### Prompt editor interaction

The feature-owned prompt editor accepts selected image-reference mention data:

```ts
interface GenerationPromptReferenceMention {
  value: string;
  label: string;
  previewImageUrl: string;
}
```

The editor:

- preserves one exact string;
- opens completion after `@` at a text boundary;
- filters only selected image references with a projected mention;
- replaces the active `@...` query range with the exact mention;
- uses the installed editor's range insertion so the edit is one undoable
  operation;
- supports ArrowUp, ArrowDown, Enter, Tab, Escape, and pointer selection;
- previews the exact reference image on mention hover or caret entry;
- supports the same preview in editable and read-only prompts;
- leaves unknown or cleared-reference mention text unchanged and unstyled;
- never changes reference selection, provider routing, or request eligibility.

### Structured diagnostics

Use these package-boundary codes:

- `ENGINES_STUDIO_IMAGE_MODEL_CATALOG_INVALID` for duplicate families/routes,
  missing schema fields, invalid configurable declarations, incomplete enum
  labels, and unclassifiable image-media capability;
- `CORE_GENERATION_IMAGE_MODEL_FAMILY_INVALID` when focused authoring submits an
  unknown or unavailable family;
- `CORE_GENERATION_IMAGE_MODEL_ROUTE_UNAVAILABLE` when no route in that family
  can represent the current selected image references;
- `CORE_GENERATION_IMAGE_PARAMETER_INVALID` for submitted fields or values that
  are not user-configurable on the resolved route;
- the existing `CORE_GENERATION_SELECTION_INVALID` for empty or duplicate
  `promptMention` values;
- `CORE_IMAGE_REVISION_SOURCE_REQUIRED` when Edit cannot preserve the exact
  required source selection.

Diagnostics collect all actionable catalog, parameter, or selection issues
before failing and include exact field/reference locations where applicable.

## UX Specification

### Shared frame

- use the existing approved `1120px × 760px` desktop frame, limited to viewport
  width/height minus `6rem`;
- keep header, request tabs, content, and footer stable across tabs and modes;
- keep scrolling inside the active content or prompt document;
- use neutral graphite/near-white surfaces without the current brown/sepia
  editor tint;
- keep the selected model in Config rather than duplicating it in headers;
- use hidden `DialogDescription` copy where Radix requires a description.

### Prompt document

- centered maximum text width around `790px`;
- readable `15px` body type with approximately `1.7` line height;
- deliberate paragraph and heading spacing;
- exact Markdown source remains visible before and after focus;
- focus changes only the focus treatment, not layout;
- authored blank lines, indentation, punctuation, and order remain exact;
- word wrapping and spellcheck remain enabled;
- Markdown headings, lists, emphasis, links, code, and punctuation receive useful
  accessible syntax distinction in both themes;
- negative prompt, when supported, uses the same document language.

### Reference completion and preview

- each completion option shows the real thumbnail, meaningful asset title, and
  exact mention;
- no filename, asset id, provider field, raw role, or filler subtitle appears;
- completion keeps focus in the editor and exposes listbox/option semantics;
- pointer selection preserves the active replacement range until insertion;
- preview stays inside the dialog and does not cover the active mention;
- reference preview uses the Studio-safe URL and meaningful alt text.

### References

- reuse the existing configurable `MediaCard`;
- keep meaningful guide section labels;
- display meaningful asset titles only and keep cards quiet otherwise;
- Regenerate allows the original request's choices to be replaced or cleared;
- Edit shows the source image as a required locked reference;
- other Edit reference choices remain editable when the Core guide exposes them;
- frozen Preview remains read-only.

### Config

- remove the nested tinted card and use one compact centered form group;
- show one family label such as `GPT Image 2`, not duplicate provider routes;
- render only the resolved route's ordered `userConfigurableParameters`;
- use product-authored field and enum labels while submitting exact raw values;
- never derive labels in React by formatting provider tokens;
- omit undeclared provider fields completely;
- use local Shadcn `Select`, `Input`, and `Switch` controls;
- do not add repetitive helper descriptions.

### Image Revision shell

- show the meaningful source title without a source thumbnail in the header;
- use a compact Regenerate/Edit segmented control in the header;
- remove the visible explanatory subtitle and Original Generation Request card;
- keep the source image in Edit References;
- use the shared request editor and estimate;
- preserve run prevention, estimate debounce, approval, pending-close, refresh,
  and mode-draft behavior.

### Design references

The deterministic design source remains:

- `plans/active/assets/0149-image-generation-review-design/prototype.html`.

Its PNGs remain visual references for the shared frame, tabs, editor, reference
grid, Config, estimate, and mention interactions. The written requirement that
Image Revision has no header thumbnail supersedes the older thumbnail shown in
those assets.

## Implementation Slices

### Slice 0: conflict and source-of-truth audit

Inspect before editing:

- current plan 0148 implementation and frozen-spec behavior;
- exact current image routes and schema media descriptors;
- every consumer of `modelUse`, `providerToken`, `sourceGenerationRequest`, and
  `SyntaxTextEditor`;
- managed run snapshots and frozen attached external source specs used by Image
  Revision;
- current image-purpose samples and real Urban Basilica specs;
- current dialog and prompt-editor tests.

Confirm that every exact current image route can derive image-input capability
from its schema descriptor. If not, fix the owning Engines descriptor or schema
override rather than adding a duplicate capability registry.

### Slice 1: one Engines image-model catalog

Files:

- new `packages/engines/src/generation/studio-image-model-catalog.ts`;
- `packages/engines/src/generation/studio-model-availability.ts`;
- `packages/engines/src/generation/catalog/model-input-descriptors.ts` only if a
  current schema cannot project its real image-media capability;
- `packages/engines/src/generation/index.ts`;
- focused Engines tests.

Work:

- move the curated image routes into the single family catalog;
- add the per-route ordered user-configurable allowlists and product labels;
- derive flat availability from that catalog;
- derive input availability from schema descriptors;
- add deterministic family route resolution support;
- validate catalog fields and value labels against schemas;
- delete the old duplicate curated image array;
- remove `StudioGenerationUse` and derive image availability from the catalog;
- do not change video/audio product behavior.

### Slice 2: Core family authoring and managed value policy

Files:

- `packages/core/src/client/generation-preview-resource.ts`;
- `packages/core/src/client/image-revision-workflow.ts`;
- `packages/core/src/server/generation/purpose-contract.ts` and purpose wiring
  only as required to stop using create/edit route suffix semantics;
- `packages/core/src/server/generation-preview-resource/authoring.ts`;
- `packages/core/src/server/generation-preview-resource/configuration.ts`;
- `packages/core/src/server/generation-preview-resource/update.ts`;
- project-data service wiring and focused Core tests.

Work:

- project one family selector and resolved-route controls;
- remove `GenerationPurposeDescriptor.modelUse` and update all purpose callers;
- accept `modelFamilyId` in focused browser authoring commands;
- apply pending reference choices before route resolution;
- validate submitted parameter names against the selected route profile;
- rebuild managed authored values from prompt plus declared controls;
- persist exact route identity;
- return refreshed controls and estimate after resolution;
- preserve generic exact-model spec commands outside these focused workflows.

### Slice 3: Regenerate and Edit workflow correction

Files:

- `packages/core/src/server/image-revision-workflow/draft.ts`;
- focused Image Revision service modules and tests;
- `packages/core/src/client/image-revision-workflow.ts`;
- Studio Image Revision hook/service types.

Work:

- make Regenerate preserve the source request's purpose and target;
- seed Regenerate from either a completed managed run snapshot or a frozen
  attached external source spec;
- seed Regenerate from the original prompt, references, family, and supported
  configuration;
- choose the current recommended managed family when the source route is
  external or no longer selectable;
- allow Regenerate reference changes;
- make Edit create `image.edit` with the current image as a locked source;
- allow family/config changes in both modes;
- resolve and estimate the compatible exact route in Core;
- keep the original frozen request immutable;
- return structured diagnostics for unavailable provenance, family, route,
  source, or configuration.

### Slice 4: prompt mention envelope

Files:

- `packages/core/src/client/generation.ts`;
- `packages/core/src/client/generation-preview-resource.ts`;
- `packages/core/src/server/generation/spec-envelope.ts`;
- `packages/core/src/server/generation/references.ts`;
- `packages/core/src/server/generation-preview-resource/references.ts`;
- focused tests.

Work:

- add optional `promptMention` to selected references;
- add the optional request-owned `nextPromptMentionNumber` allocation state;
- allocate the next monotonic `@ReferenceN` for a newly selected image reference
  in focused Studio selection commands;
- preserve mentions on same-placement replacement;
- validate non-empty uniqueness before writes;
- project the exact mention with the safe preview URL;
- remove `providerToken` and update callers directly;
- prove prompt text is never scanned or rewritten.

### Slice 5: Studio Skills image prompt routing

Files:

- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`;
- the Studio Skills image authoring, registry, and model-guide files named in the
  Architecture Shape Gate;
- current image-purpose samples and focused forward evaluations.

Work:

- add the exact route-to-guide registry without capability duplication;
- add or refresh current GPT Image 2, Nano Banana, and Grok guidance from
  first-party sources;
- add `scripts/validate-image-prompt-guides.mjs` with the documented command;
- load one exact route guide and one relevant purpose guide before authoring;
- derive generation versus revise-source guidance from the purpose;
- assign the exact reference mentions used in the prompt;
- rewrite dense samples into readable source where model guidance supports it;
- remove obsolete provider values from Studio-managed samples;
- keep simple prompts concise;
- fail before authoring when an exposed exact route has no guide.

### Slice 6: shared prompt editor and request components

Files:

- `packages/studio/src/features/generation-request-editor/*`;
- current shared children under `generation-preview/`;
- `packages/studio/src/ui/syntax-text-editor.tsx` and its tests;
- Prism and theme styles;
- focused component tests.

Work:

- move shared request children into their true feature owner;
- replace the generic syntax editor with the feature-owned prompt editor;
- implement neutral document typography and Markdown token styling;
- implement completion, exact range insertion, undo/redo, hover preview, and
  caret preview;
- adapt projected selected image references into mention options;
- retain the shared `MediaCard` reference language;
- render only projected family/config controls;
- update direct imports and delete obsolete paths without re-exports.

### Slice 7: dialog shell redesign

Files:

- Generation Preview dialog/host/title/footer files;
- Image Revision dialog/mode/footer files;
- visible source-request component and its tests;
- Core source-request DTO/projection only if unused after the UI removal;
- focused E2E tests.

Work:

- adopt the stable frame and shared request components;
- preserve Preview navigation, Update, Close, and frozen behavior;
- move Image Revision mode selection into the header;
- remove the visible subtitle and duplicate source-request card;
- keep source title in the header and source image in Edit References;
- use one estimate treatment;
- delete unused source-request projection code if it has no consumer.

### Slice 8: real-project and visual verification

- verify the real Urban Basilica requests without modifying project data during
  automated tests;
- compare all written dialog states with the deterministic design references;
- verify long, short, generation, and source-edit prompts;
- verify all current model families, text-only routes, and image-input routes;
- verify dark/light themes and keyboard-only operation;
- correct visual mismatches without adding unrelated redesign work.

## Tests And Guardrails

### Engines

- every exact catalog route exists in the curated availability output;
- availability is derived from the single catalog rather than a second list;
- image-input capability matches schema media semantics and cardinality;
- every declared configurable field exists and is not prompt/media input;
- every declared value-label key exists in the schema enum;
- every exposed enum value has a non-empty product label;
- an explicit empty configurable array is valid;
- route resolution is deterministic for no-image and selected-image requests;
- missing compatible routes return structured diagnostics.

### Core authoring

- browser authoring accepts family id and persists the resolved exact route;
- pending reference choices affect route resolution before controls/estimate;
- undeclared parameter names fail before writes;
- managed updates contain prompt plus declared controls and no hidden provider
  configuration;
- model changes do not carry incompatible prior-route values;
- fixed/recommended settings retain their current Core ownership;
- generic exact-model spec commands do not acquire family auto-switching.

### Regenerate and Edit

- Regenerate preserves source purpose and target and never mutates the original;
- Regenerate accepts completed managed and frozen external source provenance;
- Regenerate permits prompt, reference, family, and configuration changes;
- regenerating an `image.edit` request remains `image.edit`;
- Edit requires and locks the exact source image;
- Edit can choose a different compatible family from the source model;
- incompatible families and missing sources fail with structured diagnostics;
- run, estimate, approval, pending-close, and refresh behavior remain correct.

### Prompt mentions

- new selected image references receive the next monotonic `@ReferenceN`;
- same-placement replacement preserves the mention;
- clearing a reference never changes prompt text or permits mention reuse;
- duplicate or empty mentions fail before writes;
- `providerField` is never projected or interpreted as a mention;
- prompt contents are never scanned to create, validate, or route references;
- unknown mention-like text remains valid opaque text.

### Studio editor and dialogs

- exact source text survives typing, paste, focus, remount, read-only state, and
  undo/redo;
- `@`, partial-query, and full-query completion replace exactly one range;
- Enter, Tab, pointer, and Escape behave as specified;
- insertion is one undoable edit and leaves the caret after the token;
- hover and caret preview show the correct safe image in editable and read-only
  prompts;
- clearing a reference removes its suggestion/preview without rewriting text;
- Prompt, References, Config, diagnostics, and estimate use one shared component
  path in both dialogs;
- Config renders only the projected declared controls and exact raw values;
- no React code formats provider names or resolves routes;
- frame geometry remains stable across tabs and modes;
- frozen Preview remains read-only;
- pending Image Revision cannot close through escape or outside click;
- dark/light contrast and keyboard behavior pass manual verification.

### Architecture guardrails

- Studio does not import Engines or Core server modules;
- only the Engines catalog contains the authored runtime image-route inventory;
- provider schemas remain the source of image-input requiredness and field
  mechanics;
- Studio Skills registry contains guide mapping only;
- no route suffix or raw field-name capability inference exists outside Engines;
- no runtime prompt semantics, formatting, or repair service is added;
- no raw HTML interactive controls appear in feature code;
- no compatibility re-export remains after component moves;
- architecture tests protect imports, public contract behavior, or write-boundary
  behavior rather than private implementation names.

## Documentation

- revise Decision 0057 to match the simplified catalog, route, workflow, and
  mention ownership;
- update current Studio Skills media-producer workflow and guide provenance;
- document the Studio Skills route-guide coverage validation command;
- update current product/design guidance only if the document editor treatment
  becomes an accepted repeated Studio pattern;
- do not edit historical plans.

## Final Verification

Run focused checks from `/Users/keremk/Projects/aitinkerbox/studio`:

```bash
pnpm test:engines
pnpm test:core
pnpm --filter @gorenku/studio test -- generation-request
pnpm --filter @gorenku/studio test -- generation-preview
pnpm --filter @gorenku/studio test -- image-revision
pnpm --filter @gorenku/studio check
pnpm --filter @gorenku/studio lint
```

Run the documented Studio Skills image-guide coverage and forward-evaluation
command from `/Users/keremk/Projects/aitinkerbox/studio-skills`:

```bash
node skills/media-producer/scripts/validate-image-prompt-guides.mjs \
  --project urban-basilica
```

Then run root checks:

```bash
pnpm check
pnpm lint
pnpm test
```

Manual verification:

- open Generation Preview for every current image purpose;
- verify each family resolves correctly with no references and with selected
  image references;
- verify only the declared parameters appear for every exact route;
- verify raw values are submitted while product labels are displayed;
- verify `num_images`, `sync_mode`, `output_format`, safety, storage, and
  experimental fields are absent from Studio-managed Config;
- Regenerate an ordinary generation request after changing prompt, reference,
  family, and configuration;
- Regenerate an externally generated image from its frozen attached source spec
  into a new managed request;
- Regenerate an `image.edit` request and confirm its purpose is preserved;
- Edit a GPT Image 2 result using another compatible family and the exact source
  image;
- test monotonic new-reference mention allocation, `@` completion, partial replacement,
  Enter, Tab, pointer, Escape, undo/redo, hover, caret preview, reference replace,
  and reference clear;
- compare the actual dialogs with the deterministic design references at the
  approved desktop viewport in dark and light themes;
- inspect the Urban Basilica Imperial Council Chamber request and images;
- inspect `git diff --stat` and the complete diff in Studio and Studio Skills;
- inspect every newly large or heavily modified file;
- confirm the catalog is the only authored runtime image-route inventory;
- confirm no `index.ts` became a logic owner;
- confirm no formatting churn, compatibility layer, or prompt semantic logic
  was added.

## Completion Evidence

- Engines now owns one validated four-family, eight-route Studio image catalog;
  Core resolves exact compatible routes and projects only declared controls.
- Core owns monotonic prompt-mention allocation and the complete Regenerate/Edit
  workflow, including managed/frozen provenance and the locked Edit source.
- Generation Preview and Image Revision use the same feature-owned request editor
  for Prompt, References, Config, diagnostics, estimates, and mention previews.
- Studio Skills validates exact prompt-guide coverage for all 8 managed image
  routes and all 10 image purposes against the real `urban-basilica` project.
- `pnpm check`, `pnpm lint`, and `pnpm test` pass. The full suite includes 2
  Diagnostics tests, 209 Core tests, 37 CLI tests, 710 Engines tests with 12
  provider todo cases, and 209 Studio tests. Lint has one existing non-blocking
  server console warning and no errors.
- Production browser QA passed at 1708×1251 in dark and light themes for all 18
  written Preview/Regenerate/Edit tab states, exact mention completion and undo,
  hover/caret image preview, locked-source behavior, estimates, and actions.
- Combined same-viewport source/implementation comparisons and the final QA
  record are in `design-qa.md`; the final result is passed.
- Final diff review covered Studio and Studio Skills, the largest modified files,
  the sole catalog inventory, thin entrypoints, formatting, Shadcn control use,
  prompt opacity, and absence of compatibility layers.

## Completion Checklist

### Review Area

- [x] Confirm all three explicit product requirements are implemented.
- [x] Confirm prompt opacity and provider-schema ownership remain intact.
- [x] Confirm the final file shape matches the Architecture Shape Gate.
- [x] Confirm centralized ownership did not create a catalog, editor, workflow,
      or dialog god file.
- [x] Confirm plan 0148 frozen-request behavior remains intact.

### Architecture And Contracts

- [x] Add one Engines-owned Studio image-model catalog.
- [x] Remove the duplicate curated image-route inventory.
- [x] Remove `StudioGenerationUse` and purpose `modelUse` without aliases.
- [x] Keep family grouping, route order, configurable field names, and product
      labels in the catalog.
- [x] Derive image-input capability from schema media descriptors.
- [x] Keep schema field mechanics out of the product catalog.
- [x] Project family choices and resolved-route controls through Core.
- [x] Accept family id only in focused browser authoring workflows.
- [x] Persist exact provider/model identity in `GenerationSpec`.
- [x] Reject undeclared browser-authored parameter names before writes.
- [x] Keep hidden provider mechanics out of managed user-authored values.
- [x] Add optional exact `promptMention` metadata separately from
      `providerField`.
- [x] Add request-owned monotonic mention allocation state.
- [x] Allocate stable non-reused mentions through Core reference-selection
      commands.
- [x] Remove `providerToken` without an alias.
- [x] Keep package-boundary diagnostics structured.
- [x] Use the diagnostic codes named in this plan.
- [x] Add no compatibility shims or convenience re-exports.

### Regenerate And Edit

- [x] Preserve source purpose and target in Regenerate.
- [x] Support completed managed and frozen external Regenerate provenance.
- [x] Seed Regenerate from the original prompt, references, family, and supported
      configuration.
- [x] Use the current recommended managed family when the source route is
      external or no longer selectable.
- [x] Allow Regenerate prompt, reference, family, and configuration changes.
- [x] Preserve `image.edit` when regenerating an image-edit request.
- [x] Create Edit as a new `image.edit` request.
- [x] Require and lock the exact source image in Edit.
- [x] Allow another compatible model family in Edit.
- [x] Preserve original frozen specs and run snapshots unchanged.
- [x] Preserve estimate, approval, run, pending, and refresh behavior.

### Studio Skills

- [x] Add exact route-to-guide mapping without capability duplication.
- [x] Add or refresh current GPT Image 2, Nano Banana, and Grok guidance.
- [x] Add and document `validate-image-prompt-guides.mjs`.
- [x] Route every image prompt through one exact model guide and one purpose
      guide.
- [x] Derive revise-source guidance from `image.edit` purpose.
- [x] Use exact prompt mentions for selected references.
- [x] Remove obsolete hidden provider values from managed samples.
- [x] Replace accidental walls of text while keeping simple prompts concise.
- [x] Add route coverage, purpose coverage, generation, reference-conditioned,
      revise-source, Codex external, and missing-guide evaluations.

### Shared Request Editor

- [x] Move shared request children into `generation-request-editor`.
- [x] Keep `GenerationRequestEditor` thin and compositional.
- [x] Replace the unused generic syntax editor with the feature-owned prompt
      editor.
- [x] Preserve exact text, wrapping, spellcheck, selection, and undo/redo.
- [x] Implement neutral document typography and accessible Markdown contrast.
- [x] Implement selected-reference completion and exact range replacement.
- [x] Implement hover and caret image preview in editable and read-only states.
- [x] Leave unknown and cleared-reference text unchanged.
- [x] Reuse the existing `MediaCard` and Shadcn controls.
- [x] Render only Core-projected family/config controls.
- [x] Add no generic editor extension framework or prompt wrapper in `src/ui`.

### Dialogs

- [x] Use one stable desktop frame and shared request editor.
- [x] Keep selected model identity in Config rather than headers.
- [x] Preserve Preview navigation, Update, Close, and frozen state.
- [x] Put Regenerate/Edit in the Image Revision header.
- [x] Remove the visible subtitle and duplicate source-request card.
- [x] Keep source title in the header and source image in Edit References.
- [x] Use one shared estimate treatment.
- [x] Delete source-request DTO/projection code if no consumer remains.

### Tests And Guardrails

- [x] Add catalog/schema consistency and route-resolution tests.
- [x] Add declared-control/raw-value round-trip tests.
- [x] Add rejection tests for undeclared browser-authored parameters.
- [x] Add managed-value reconstruction and model-change tests.
- [x] Add Regenerate purpose-preservation and Edit source-lock tests.
- [x] Add mention allocation, validation, preservation, completion, insertion,
      undo/redo, hover/caret preview, and clearing tests.
- [x] Prove mention behavior never changes provider routing or reference
      selection.
- [x] Add shared-path, stable-frame, frozen, and pending-close tests.
- [x] Add import/capability guardrails without private-name inventories.
- [x] Run the architecture-shape review in Final Verification.

### Documentation

- [x] Align Decision 0057 with the final implementation.
- [x] Update current Studio Skills workflow and guide provenance.
- [x] Document the Studio Skills guide-coverage command.
- [x] Do not edit historical plans for naming or screenshot sweeps.

### Final Verification

- [x] Run focused Engines, Core, Studio, and Studio Skills checks.
- [x] Run root check, lint, and test.
- [x] Verify every image purpose and current image-model family.
- [x] Verify no-reference, reference-conditioned, Regenerate, and Edit flows.
- [x] Verify Config exposes exactly the declared product controls.
- [x] Verify rich prompt mention behavior and exact text preservation.
- [x] Verify all written dialog states in dark and light desktop themes.
- [x] Review complete diffs in Studio and Studio Skills.
- [x] Inspect large and heavily modified files.
- [x] Confirm the image catalog is the only runtime route inventory.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
