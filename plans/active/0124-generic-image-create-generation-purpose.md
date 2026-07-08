# 0124 Generic Image Create Generation Purpose

Status: active
Date: 2026-07-08

## Summary

Add a first-class Renku-managed `image.create` media generation purpose for
new image creation from text and optional registered project image references.

The immediate motivation is Shot Video Take input work. Today first frames,
last frames, ad hoc shot reference images, and video prompt sheets are separate
media generation purposes even though their provider-facing generation behavior
is almost identical. The real product difference is where the generated image is
attached after generation, not how the image is created.

The new direction is:

- generic image creation uses `image.create`;
- source-image modification continues to use `image.edit`;
- destination attachment remains domain-owned through explicit import or
  selection commands;
- Shot Video Take first frames, last frames, reference images, and video prompt
  sheets become destination roles, not separate generation purposes.

This mirrors the architecture accepted for `image.edit`: generic generation
creates generated files and Media Generation Run receipts only. It must not
select, replace, attach, discard, or mutate domain media.

## Problem

Current image generation has too many product-specific purposes for workflows
that are mostly the same at the provider boundary.

These Shot Video Take purposes are separate today:

```text
shot.first-frame
shot.last-frame
shot.reference-image
shot.video-prompt-sheet
```

They differ in destination semantics:

- first frames and last frames are shot-level video inputs;
- reference images are shot-level auxiliary visual references;
- video prompt sheets are take-level prompt/reference artifacts;
- import may select or replace a prepared input;
- iteration, ownership, and trash behavior belong to Shot Video Take.

They do not need separate provider-facing generation purposes. Their shared
generation shape is:

- choose an image model;
- provide a prompt;
- optionally provide registered reference images;
- build either a text-to-image or reference-to-image provider request;
- estimate cost;
- run the request;
- record the Media Generation Run.

Keeping those as separate generation purposes causes several concrete problems:

- the media generation purpose registry is larger than the real generation
  model;
- model list, parameter defaults, provider payload code, cost projection,
  preview validation, and tests repeat Shot Video Take-specific purpose names;
- agents must choose a destination-specific generation purpose before they have
  done the generic image creation work;
- future image destinations would add more purpose names instead of reusing one
  image creation contract;
- the codebase blurs two separate axes: generation capability and destination
  attachment.

## Architecture Decision

Introduce a new media generation purpose:

```text
image.create
```

`image.create` is a project-scoped image creation purpose. It prepares and runs
new-image provider requests in one of two explicit modes:

```text
text-to-image
reference-to-image
```

The purpose creates generated output files and Media Generation Run records.
It does not attach those outputs to Cast, Location, Lookbook, Scene, Shot Video
Take, reference media, or any other destination-specific project metadata.

Destination ownership remains behind the destination's core-owned command or
service:

- Shot Video Take first frame import attaches as input kind `first-frame`;
- Shot Video Take last frame import attaches as input kind `last-frame`;
- Shot Video Take reference image import attaches as input kind
  `reference-image`;
- Shot Video Take video prompt sheet import attaches as input kind
  `video-prompt-sheet`;
- Cast, Location, Lookbook, Scene, and generic reference-image attachment
  continue to use their own import paths until those areas are deliberately
  redesigned.

This is not a generic mutation shortcut. `image.create` owns image creation
only. Domain-specific services still own the durable metadata write.

## Naming

Use `image.create` as the public purpose name.

Rationale:

- it pairs clearly with the existing `image.edit`;
- it describes the product intent: create a new image, not modify a source
  image;
- it is more precise than `image.generate`, because all media purposes are
  generation purposes;
- it avoids destination words such as `shot`, `frame`, `profile`, or `hero`.

Use `ImageCreateGenerationSpec`, `ImageCreateGenerationContext`,
`ImageCreateModelChoice`, and `ImageCreateReferenceImage` for public client
contracts.

Use `ProjectMediaGenerationTarget` for the persisted target. The target records
that a generic generated image belongs to a project, not to a specific
destination entity.

## Public Contracts

### Purpose Constant

Add:

```ts
export const IMAGE_CREATE_GENERATION_PURPOSE = 'image.create' as const;
```

Add it to `MediaGenerationPurpose`, purpose cost projection, preview purpose
validation, the lifecycle registry, CLI purpose parsing, and exported core
client/server contracts.

Remove the Shot Video Take input generation purposes from
`MediaGenerationPurpose` in the same implementation slice:

```text
shot.first-frame
shot.last-frame
shot.reference-image
shot.video-prompt-sheet
```

Those names may remain only as historical documentation in this plan and
one-way development-data migration notes if a migration is required. Runtime
code must not preserve them as generation purpose aliases.

### Project Target

Add a project-scoped media generation target:

```ts
export interface ProjectMediaGenerationTarget {
  kind: 'project';
  id: string;
}
```

Add it to `MediaGenerationTarget`.

Add a request-time project target for CLI context and model-list calls:

```ts
export interface ProjectMediaGenerationRequestTarget {
  kind: 'project';
  id?: string;
}
```

Add it to `MediaGenerationRequestTarget`.

The CLI target syntax is:

```text
--target project
```

Core resolves `--target project` to the current project identity when building
context or listing models. Persisted `ImageCreateGenerationSpec` files must use
the resolved target with `id` present:

```json
{
  "kind": "project",
  "id": "project_..."
}
```

Validation must fail fast when the spec target id does not match the resolved
project.

### Spec

Add:

```ts
export type ImageCreateMode = 'text-to-image' | 'reference-to-image';

export type ImageCreateModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export interface ImageCreateReferenceImage {
  assetId: string;
  assetFileId: string;
  role: string;
}

export interface ImageCreateGenerationSpec {
  purpose: typeof IMAGE_CREATE_GENERATION_PURPOSE;
  target: ProjectMediaGenerationTarget;
  mode: ImageCreateMode;
  modelChoice: ImageCreateModelChoice;
  prompt: string;
  referenceImages: ImageCreateReferenceImage[];
  parameterValues: ImageCreateParameterValues;
  title?: string;
}

export type ImageCreateParameterValues = Record<string, unknown>;
```

Envelope validation:

- `purpose` must be `image.create`;
- `target.kind` must be `project`;
- `target.id` must match the current project id;
- `mode` must be `text-to-image` or `reference-to-image`;
- `prompt` must be a non-empty string;
- `modelChoice` must be a supported `ImageCreateModelChoice`;
- `parameterValues` may contain only parameters supported by the selected
  model and mode;
- `referenceImages` must be empty for `text-to-image`;
- `referenceImages` must contain at least one registered project image for
  `reference-to-image`;
- every reference must resolve to an active project asset file whose media kind
  is `image`;
- provider reference image count limits must be enforced as envelope/provider
  capability validation.

Do not validate, parse, score, or repair prompt text or generated/reference
image contents. The prompt and images are opaque creative artifacts.

### Context

Add:

```ts
export interface ImageCreateGenerationContext {
  purpose: typeof IMAGE_CREATE_GENERATION_PURPOSE;
  target: ProjectMediaGenerationTarget;
  project: {
    id: string;
    name: string;
    title: string;
    aspectRatio: string | null;
  };
  recommendedModelChoice: ImageCreateModelChoice;
  modelDefaults: {
    textToImage: ImageCreateParameterValues;
    referenceToImage: ImageCreateParameterValues;
  };
  agentMedia: AgentMediaReport;
}
```

The context should not list every project image by default. Agents and Studio
surfaces can use existing asset/reference APIs to choose references. Keeping
context focused avoids turning `image.create` into a broad project media index.

### Model List

Add:

```ts
export interface ImageCreateModelChoiceReport {
  modelChoice: ImageCreateModelChoice;
  label: string;
  available: boolean;
  provider: 'fal-ai';
  textToImageModel: string;
  referenceToImageModel: string;
  mediaKind: 'image';
  modes: ImageCreateMode[];
  referenceImageCount: {
    min: number;
    max: number | null;
  };
  defaultParameterValues: {
    textToImage: ImageCreateParameterValues;
    referenceToImage: ImageCreateParameterValues;
  };
  parameterRows: {
    textToImage: ImageCreateParameterRow[];
    referenceToImage: ImageCreateParameterRow[];
  };
}

export interface ImageCreateModelListReport {
  purpose: typeof IMAGE_CREATE_GENERATION_PURPOSE;
  target: ProjectMediaGenerationTarget;
  models: ImageCreateModelChoiceReport[];
}
```

Provider route mapping:

```text
fal-ai/openai/gpt-image-2
  text-to-image      -> openai/gpt-image-2
  reference-to-image -> openai/gpt-image-2/edit

fal-ai/nano-banana-2
  text-to-image      -> nano-banana-2
  reference-to-image -> nano-banana-2/edit

fal-ai/xai/grok-imagine-image
  text-to-image      -> xai/grok-imagine-image
  reference-to-image -> xai/grok-imagine-image/edit
```

Reference-to-image uses edit-capable provider endpoints because the provider
catalog exposes reference-conditioned image generation through image-input
routes. Studio's product mode is still `reference-to-image`, not `image-edit`,
because the user is creating a new image conditioned by references rather than
editing one source image.

### Preview

`image.create` preview must show:

- purpose `image.create`;
- mode `text-to-image` or `reference-to-image`;
- model choice and provider model;
- prompt text;
- editable parameter rows;
- registered reference images when mode is `reference-to-image`;
- provider token order for reference images;
- payload preview.

Preview reference roles come from `ImageCreateReferenceImage.role`. Runtime
validation may require the role to be a non-empty string, but must not require
the role to match prompt text or image contents.

### Output Names

Default output names:

```text
image-create-<spec-id-or-target-id>.png
image-create-<spec-id-or-target-id>-2.png
```

The output naming helper should use model output format when it is known and
fall back to `png`. It must not derive filenames from prompt text.

## Shot Video Take Migration

The implementation should move Shot Video Take input generation to
`image.create`.

The domain-specific concepts that remain in Shot Video Take are:

- input kind: `first-frame`, `last-frame`, `reference-image`,
  `video-prompt-sheet`;
- subject kind and subject id;
- selected input state;
- take iteration;
- take-owned media copy/discard behavior;
- dependency inventory and readiness labels;
- prompt-sheet visual style and notation metadata when the destination is
  `video-prompt-sheet`;
- import, replacement, and selection.

The generation-specific concepts that move to `image.create` are:

- model list for image creation;
- text-to-image and reference-to-image route selection;
- image reference file resolution for provider inputs;
- parameter validation by model and mode;
- provider payload construction;
- cost projection for image creation;
- preview request construction for generic image creation;
- generated output naming.

### Shot Dependency Drafts

Shot Video Take dependency planning should build `ImageCreateGenerationSpec`
drafts instead of destination-specific shot input generation specs.

Each dependency line keeps its destination identity separately:

```ts
{
  dependencyKind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet';
  outputInputKind: 'first-frame' | 'last-frame' | 'reference-image' | 'video-prompt-sheet';
  destination: {
    kind: 'sceneShotVideoTakeInput';
    takeId: string;
    subjectKind: 'shot' | 'take';
    subjectId: string;
    inputKind: ShotVideoTakeInputKind;
  };
  draftGenerationSpec: {
    purpose: 'image.create';
    spec: ImageCreateGenerationSpec;
  };
}
```

This keeps pricing and generation generic while preserving the domain-specific
destination metadata that preflight and Studio need.

### Reference Resolution

Shot Video Take may keep a purpose-specific service that resolves selected
Movie Lookbook, Storyboard Lookbook, Location Sheet, and Character Sheet
references for a draft.

That service should return generic `ImageCreateReferenceImage[]` plus preview
labels, not a Shot Video Take input generation spec.

The service must stay in Core because it enforces project metadata rules:

- which references are selected;
- which selected references are required for the current take;
- whether the chosen reference mode is available;
- which asset/file ids are valid for generation.

The service must not inspect visual contents or require provider prompt text to
mention specific references.

### Agent-Facing Dependency Materialization

The main caller for this workflow is the Studio agent skill loop, not a human
hand-authoring every spec field. The implementation must therefore expose a
machine-facing way for agents to ask Core:

```text
For this take dependency, give me the ready-to-preview image generation spec.
```

The agent should not reconstruct Lookbook, Location, or Cast reference asset ids
by scraping Studio state or walking the database itself. It should author the
creative draft and destination intent, then let Core materialize the
`ImageCreateGenerationSpec`.

For a first-frame request that must use the Movie Lookbook sheet, the flow is:

1. Agent reads Shot Video Take authoring context for the take and selected shot.
2. Agent authors or updates a dependency draft with destination
   `inputKind: 'first-frame'`, `referenceMode: 'movie-lookbook'`, prompt,
   model choice, and parameter values.
3. Core validates that the selected Movie Lookbook and its usable sheet are
   available.
4. Core resolves the selected Lookbook sheet into an
   `ImageCreateReferenceImage` with role `movie-lookbook-sheet`.
5. Core returns a draft generation spec:

```ts
{
  purpose: 'image.create',
  target: { kind: 'project', id: '<project-id>' },
  mode: 'reference-to-image',
  modelChoice: 'fal-ai/nano-banana-2',
  prompt: '<agent-authored first-frame prompt>',
  referenceImages: [
    {
      assetId: '<lookbook-sheet-asset-id>',
      assetFileId: '<lookbook-sheet-asset-file-id>',
      role: 'movie-lookbook-sheet',
    },
  ],
  parameterValues: {
    output_format: 'png',
  },
  title: 'First frame',
}
```

6. Agent shows the generation preview, where the reference list visibly includes
   the `movie-lookbook-sheet` reference.
7. Agent creates, estimates, and runs the `image.create` spec.
8. Agent reads the run receipt with `generation run show`.
9. Agent imports the generated output through the Shot Video Take destination
   import command with `inputKind: 'first-frame'`.

If the requested Lookbook sheet is missing, stale, ambiguous, discarded, or not
an image, Core must return a structured missing/invalid dependency diagnostic.
The agent should then generate/import/select the required Lookbook sheet first,
not silently fall back to a prompt-only image or invent a local reference path.

The materialization report should include both:

- destination metadata for Studio and import, such as input kind, subject kind,
  subject id, and dependency label;
- the generic `ImageCreateGenerationSpec` that should be passed to preview,
  estimate, create, and run commands.

### Prompt Sheet Metadata

Prompt-sheet visual style and notation mode are destination metadata for
`video-prompt-sheet`, not generic `image.create` metadata.

Do not add `promptSheetVisualStyleId` or `promptSheetNotationModeId` to
`ImageCreateGenerationSpec`.

Instead, carry these values in the Shot Video Take dependency draft or
destination import context, and include them in generation preview only when the
preview is being shown from a Shot Video Take video-prompt-sheet dependency
line.

## CLI Changes

Add generic image creation commands through the existing generation surface:

```bash
renku generation context --purpose image.create --target project --json
renku generation model list --purpose image.create --target project --json
renku generation preview show --file image-create-spec.json --json
renku generation spec validate --file image-create-spec.json --json
renku generation spec create --file image-create-spec.json --json
renku generation spec update --spec <spec-id> --file image-create-spec.json --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose image.create --target project --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <approval-token> --json
renku generation run show --run <run-id> --json
```

Remove these generation command forms from current docs and runtime support:

```bash
renku generation context --purpose shot.first-frame ...
renku generation context --purpose shot.last-frame ...
renku generation context --purpose shot.reference-image ...
renku generation context --purpose shot.video-prompt-sheet ...
renku generation model list --purpose shot.first-frame ...
renku generation model list --purpose shot.last-frame ...
renku generation model list --purpose shot.reference-image ...
renku generation model list --purpose shot.video-prompt-sheet ...
renku generation spec list --purpose shot.first-frame ...
renku generation spec list --purpose shot.last-frame ...
renku generation spec list --purpose shot.reference-image ...
renku generation spec list --purpose shot.video-prompt-sheet ...
```

Do not keep compatibility aliases. If a caller asks the generation surface for
one of those old purpose names after the refactor, the current unsupported
purpose diagnostic should report the supported current purpose list.

### Shot Input Import CLI

Move Shot Video Take image attachment away from generation-purpose names.

Replace:

```bash
renku media import --purpose shot.first-frame --target take:<take-id> ...
renku media import --purpose shot.last-frame --target take:<take-id> ...
renku media import --purpose shot.reference-image --target take:<take-id> ...
renku media import --purpose shot.video-prompt-sheet --target take:<take-id> ...
```

with a destination-owned command shape:

```bash
renku media import --purpose shot.input --target take:<take-id> --kind first-frame ...
renku media import --purpose shot.input --target take:<take-id> --kind last-frame ...
renku media import --purpose shot.input --target take:<take-id> --kind reference-image ...
renku media import --purpose shot.input --target take:<take-id> --kind video-prompt-sheet ...
```

`shot.input` is an import destination purpose, not a media generation purpose.
It must not be added to `MediaGenerationPurpose`.

The Core service should expose this as a Shot Video Take input import command
that takes `inputKind`, not as `importMediaGenerationByPurpose` dispatch for
the old shot generation purposes.

## Core Implementation

### Client Contracts

Add:

```text
packages/core/src/client/image-create-media-generation.ts
```

This file owns:

- `ImageCreateMode`;
- `ImageCreateModelChoice`;
- `ImageCreateReferenceImage`;
- `ImageCreateGenerationSpec`;
- `ImageCreateGenerationContext`;
- `ImageCreateModelChoiceReport`;
- `ImageCreateModelListReport`;
- `ImageCreateParameterValues`;
- `ImageCreateParameterRow`.

Update:

- `packages/core/src/client/index.ts`;
- `packages/core/src/client/media-generation-purpose.ts`;
- `packages/core/src/client/media-generation-target.ts`;
- `packages/core/src/client/media-generation-lifecycle.ts`;
- `packages/core/src/client/generation-preview.ts`.

Remove `ShotVideoTakeInputGenerationPurpose` and
`ShotVideoTakeInputGenerationSpec` from public media generation spec unions.
Keep `ShotVideoTakeInputKind` and related destination/input state types.

### Server Purpose

Add:

```text
packages/core/src/server/media-generation/purposes/image-create.ts
```

This file owns:

- context building;
- model listing;
- spec normalization and validation;
- project target validation;
- reference asset/file resolution;
- provider payload building;
- draft and saved spec preparation;
- preview construction;
- cost projection support;
- run execution through the shared generation service.

Do not put Shot Video Take destination rules in this file.

### Lifecycle Registry

Add `image.create` to the media generation lifecycle registry.

Remove the four Shot Video Take input generation definitions from the registry.

Do not replace them with route-local checks in CLI or Studio. Shot Video Take
dependency planning must call the generic `image.create` definition through the
shared lifecycle/draft path.

### Cost Projection

Add `ImageCreateGenerationSpec` support to cost projection.

Cost projection must use:

- text-to-image provider model for `mode: 'text-to-image'`;
- reference-to-image provider model and image input counts for
  `mode: 'reference-to-image'`;
- output count from model parameters where supported;
- explicit unpriced state when the engines catalog does not have a current
  price for the selected route.

Remove the shot-input-specific cost branch once all draft and persisted specs
use `image.create`.

### Generation Preview

Add `image.create` to preview validation and preview title formatting.

Remove shot input generation purposes from generic preview purpose unions.

For Shot Video Take dependency previews, the preview may include destination
context supplied by Shot Video Take, but the underlying draft generation spec
must remain `image.create`.

### Database And Migrations

Schema changes may not be necessary because media generation specs already
store purpose, target kind, target id, and spec JSON.

Before deciding, inspect current persisted development data and the Drizzle
schema. If target kind validation or indexes need to include `project`, update
the Drizzle TypeScript schema first and generate SQL with Drizzle Kit.

Do not hand-write migration SQL unless the Drizzle migration architecture
explicitly requires a custom migration.

If existing development databases may contain saved specs or runs using the old
Shot Video Take input generation purposes, add a one-way migration only if
those rows are expected to remain useful. Otherwise document that pre-customer
development data should be discarded or regenerated. Do not add runtime
read-repair, compatibility readers, aliases, or warning paths for old spec
shapes.

## Studio Surface

Use `image.create` as the generic generation preview and run source for new
image creation.

Shot Video Take UI should continue to present domain-specific actions:

- generate first frame;
- generate last frame;
- generate reference image;
- generate video prompt sheet.

Those actions should create or request `image.create` draft specs behind the
scenes, then use the Shot Video Take input import/selection service after the
user approves and inspects the output.

Visible UI copy should stay destination-focused. Users should not need to see
the implementation distinction unless they are inspecting a generation preview
or run receipt.

All Studio feature code must continue to use local shadcn UI controls from
`packages/studio/src/ui`.

## Agent And Skill Surface

Updating the sister `studio-skills` project is a required part of this change,
not optional follow-up work. The primary supported image generation workflow is
the AI agent using Studio skills and CLI/Core reports.

`media-producer` must teach agents this sequence:

1. Read Shot Video Take authoring context or preflight for the target take.
2. Confirm the destination input kind the user wants, such as first frame or
   last frame.
3. Confirm the reference mode, such as `movie-lookbook` when the user wants the
   Movie Lookbook sheet used as a reference.
4. Author the destination dependency draft in the take authoring document.
5. Ask Core to materialize the dependency draft into an `image.create` spec.
6. Inspect the returned spec and preview references. For a Movie Lookbook style
   request, the returned references must include role `movie-lookbook-sheet`.
7. Show the Studio generation preview before paid generation.
8. Create, estimate, and run the `image.create` spec after approval.
9. Read the generation receipt with `generation run show`.
10. Import the generated output through the destination-owned Shot Video Take
    input import command.

Skill guidance must state:

- use `image.create` for new text-to-image and reference-to-image work;
- use `image.edit` only when modifying one exact registered source image;
- never hand-resolve Lookbook, Location, Cast, or Shot Video Take reference
  asset ids outside Core;
- never satisfy a missing Lookbook-sheet dependency by writing prompt text such
  as "use the lookbook" without an attached reference image;
- if Core reports the Lookbook sheet is missing, generate/import/select the
  Lookbook sheet first;
- after materialization, verify the generated preview contains the expected
  reference roles before running paid generation.

Update samples:

- add `image-create-text-spec.json`;
- add `image-create-reference-spec.json`;
- update Shot Video Take first-frame, last-frame, reference-image, and prompt
  sheet samples to use `image.create` specs plus destination import commands;
- remove samples that create specs with old shot input generation purposes.

Agents must not fabricate generation receipts. They must use
`generation run show --run <run-id> --json` before importing generated outputs
with receipt metadata.

## Documentation

Update:

- `docs/architecture/reference/media-generation.md`;
- `docs/cli/commands.md`;
- generation preview docs;
- shot-video-take-owned media docs if they mention generation purposes;
- any active plan that still describes Shot Video Take input image generation
  as destination-specific generation purposes.

Add an ADR after implementation if this direction is accepted:

```text
docs/decisions/0046-use-generic-image-create-generation-purpose.md
```

The ADR should record the boundary:

- `image.create` creates images and run receipts;
- `image.edit` edits one registered source image and creates run receipts;
- destination import/selection is separate and domain-owned;
- Shot Video Take image input roles are not media generation purposes.

## Test Strategy

Core tests:

- `image.create` context builds a project target from current project identity;
- model list reports text-to-image and reference-to-image route details;
- validation rejects missing prompt;
- validation rejects mismatched project target id;
- validation rejects unsupported model choices;
- validation rejects text-to-image specs with references;
- validation rejects reference-to-image specs without references;
- validation rejects missing or non-image reference asset files;
- validation enforces provider reference count limits;
- prepared text-to-image request uses the base provider model and no
  `inputFiles`;
- prepared reference-to-image request uses the edit/reference provider model,
  `image_urls`, and `inputFiles`;
- preview includes reference rows and provider token order;
- run simulation records purpose `image.create`;
- cost projection uses output count and reference image input counts correctly.

Shot Video Take tests:

- dependency inventory lines for first frame, last frame, reference image, and
  video prompt sheet produce `image.create` draft specs;
- missing authored dependency drafts still surface `missing-input`;
- reference mode availability remains enforced by Core;
- selected Lookbook, Location, and Character Sheet references resolve into
  `ImageCreateReferenceImage[]`;
- prompt-sheet visual style and notation mode remain destination metadata, not
  generic image-create spec fields;
- imported `image.create` output can attach as each Shot Video Take input kind;
- replacement discards the replaced selected input through existing trash
  behavior;
- take iteration and take-owned media copy behavior still work.

CLI tests:

- `--purpose image.create --target project` parses and dispatches context;
- model list and spec list work for `image.create`;
- unsupported generation purpose diagnostics no longer list the old shot input
  generation purposes;
- `media import --purpose shot.input --kind first-frame` dispatches to Shot
  Video Take input import;
- missing `--kind` for `shot.input` reports a structured diagnostic;
- invalid `--kind` reports the supported input kinds;
- old shot input generation purpose names are not accepted by generation
  commands.

Architecture tests:

- tests should protect import boundaries and public contract ownership;
- do not add source-text tests that hard-code private helper names;
- do not freeze the current purpose registry implementation inventory beyond
  stable public purpose names;
- verify that `image.create` does not import Shot Video Take modules;
- verify that Shot Video Take dependency planning calls shared media generation
  draft contracts instead of provider payload helpers directly.

Documentation tests or checks:

- command docs list `image.create`;
- command docs do not instruct users to create generation specs with old shot
  input purpose names;
- samples validate against current schemas.

## Rollout And Data Policy

This is pre-customer software. Do not preserve old runtime behavior.

The implementation should update callers directly and remove obsolete code in
the same slice:

- no alias purpose names;
- no fallback branches for old shot input spec shapes;
- no compatibility DTO fields;
- no read-repair paths for old shot input generation specs;
- no wrapper modules whose only job is to keep old imports working.

If development data with old saved specs is valuable, handle it with a one-way
database migration or a documented manual regeneration step. Runtime code must
recognize only the current contracts.

## Open Questions

These should be resolved before implementation starts:

- Should generic `image.create` allow multiple output images for all models, or
  only for models whose provider route exposes a stable output-count parameter?
- Should `ImageCreateReferenceImage.role` be free-form visible text, or a small
  envelope enum such as `style-reference`, `character-reference`,
  `location-reference`, and `composition-reference`?
- Should `media import --purpose shot.input` be the final CLI shape, or should
  Shot Video Take input import move under a more explicit command such as
  `renku take input import`?
- Should the first implementation migrate all existing domain image generation
  purposes to `image.create`, or only the Shot Video Take input generation
  family? This plan chooses only the Shot Video Take input family because Cast,
  Location, Lookbook, and Scene purposes still own substantial purpose-specific
  context and prompt scaffolding.

## Completion Checklist

### Review Area

- [x] Confirm `image.create` is the accepted public purpose name.
- [x] Confirm `--target project` is the accepted CLI target syntax.
- [x] Confirm `ProjectMediaGenerationTarget` is the accepted persisted target.
- [x] Confirm `mode` is explicit rather than inferred from references.
- [x] Confirm the plan removes Shot Video Take input generation purposes instead
      of preserving aliases.
- [x] Confirm `shot.input` or the selected replacement import command is the
      accepted destination import surface.
- [x] Confirm destination import remains core-owned and cannot be bypassed by
      `image.create`.
- [x] Confirm prompt and generated/reference image contents remain opaque to
      Studio runtime.
- [x] Confirm no backwards-compatibility aliases, fallback spec shapes, or
      runtime repair paths are introduced.

### Architecture And Contracts

- [x] Add `IMAGE_CREATE_GENERATION_PURPOSE`.
- [x] Add `ProjectMediaGenerationTarget`.
- [x] Add request-time project target handling for context/model-list commands.
- [x] Add `ImageCreateMode`.
- [x] Add `ImageCreateModelChoice`.
- [x] Add `ImageCreateReferenceImage`.
- [x] Add `ImageCreateGenerationSpec`.
- [x] Add `ImageCreateGenerationContext`.
- [x] Add `ImageCreateModelChoiceReport`.
- [x] Add `ImageCreateModelListReport`.
- [x] Add `ImageCreateParameterValues`.
- [x] Add `image.create` to `MediaGenerationPurpose`.
- [x] Add `ImageCreateGenerationSpec` to `MediaGenerationSpec`.
- [x] Add `ImageCreateModelChoice` to `MediaGenerationSpecRecord` and
      `MediaGenerationRun`.
- [x] Remove Shot Video Take input generation purposes from
      `MediaGenerationPurpose`.
- [x] Remove `ShotVideoTakeInputGenerationSpec` from `MediaGenerationSpec`.
- [x] Keep Shot Video Take input kind and destination state contracts.
- [x] Add structured diagnostics for project target, prompt, model, mode,
      reference image, parameter, and provider route failures.
- [x] Decide whether a Drizzle migration is required for `project` target kind.

### Core Implementation

- [x] Add `packages/core/src/client/image-create-media-generation.ts`.
- [x] Add `packages/core/src/server/media-generation/purposes/image-create.ts`.
- [x] Implement image create context building.
- [x] Implement image create model listing.
- [x] Implement model/mode-specific default parameter values.
- [x] Implement model/mode-specific allowed parameter validation.
- [x] Implement project target normalization and validation.
- [x] Implement registered reference image resolution.
- [x] Implement text-to-image provider payload construction.
- [x] Implement reference-to-image provider payload construction.
- [x] Implement provider reference image count validation.
- [x] Implement draft and saved spec preparation.
- [x] Implement image create preview building.
- [x] Implement image create output naming.
- [x] Implement image create cost projection.
- [x] Register `image.create` in the media generation lifecycle registry.
- [x] Register `image.create` in the cost purpose registry.
- [x] Register `image.create` in preview validation and preview titles.
- [x] Remove Shot Video Take input generation definitions from the lifecycle
      registry.
- [x] Remove shot-input-specific provider payload entry points that are
      replaced by `image.create`.
- [x] Remove shot-input-specific cost projection branches once no caller uses
      the old spec shape.

### Shot Video Take Implementation

- [x] Replace Shot Video Take input dependency draft specs with
      `ImageCreateGenerationSpec`.
- [x] Preserve destination metadata outside the generic generation spec.
- [x] Expose a machine-facing dependency materialization report that returns
      destination metadata plus the ready `ImageCreateGenerationSpec`.
- [x] Ensure agents do not need to query project asset relationships directly
      to construct reference image ids.
- [x] Convert selected Movie Lookbook references to `ImageCreateReferenceImage`.
- [x] Convert selected Storyboard Lookbook references to
      `ImageCreateReferenceImage`.
- [x] Convert selected Location Sheet references to `ImageCreateReferenceImage`.
- [x] Convert selected Character Sheet references to `ImageCreateReferenceImage`.
- [x] Keep reference mode availability validation in Core.
- [x] Keep `missing-input` behavior for unauthored dependency drafts.
- [x] Keep first-frame and last-frame readiness as distinct dependency lines.
- [x] Keep reference-image title/intent validation in the destination draft, not
      the generic generation spec.
- [x] Keep video prompt sheet visual style and notation mode out of
      `ImageCreateGenerationSpec`.
- [x] Update preflight reports to show `image.create` as the draft generation
      purpose and destination input kind separately.
- [x] Update final `shot.video-take` preflight to consume selected imported
      inputs exactly as before.
- [x] Update take iteration repair/copy paths only where old generation purpose
      names were used as asset types or source purposes.

### CLI

- [x] Add `image.create` to supported generation purposes.
- [x] Parse `--target project` for `image.create`.
- [x] Wire `generation context` for `image.create`.
- [x] Wire `generation model list` for `image.create`.
- [x] Confirm existing spec validate/create/update/show/list commands work for
      `image.create`.
- [x] Confirm existing preview/estimate/run/run-show commands work for
      `image.create`.
- [x] Remove generation support for old Shot Video Take input purpose names.
- [x] Add the selected Shot Video Take input import command shape.
- [x] Parse and validate `--kind first-frame`.
- [x] Parse and validate `--kind last-frame`.
- [x] Parse and validate `--kind reference-image`.
- [x] Parse and validate `--kind video-prompt-sheet`.
- [x] Update resource-change and focus events for the new import command.
- [x] Update CLI unknown/unsupported purpose suggestions.

### Studio

- [x] Update Shot Video Take generation actions to request `image.create` draft
      specs.
- [x] Keep user-facing actions destination-specific.
- [x] Update generation preview handling for `image.create`.
- [x] Update any local purpose lists or labels.
- [x] Ensure Studio feature code continues to use local shadcn UI primitives.
- [x] Verify no raw form controls are introduced.
- [x] Verify no generic generated filenames or ids are shown on visual cards
      unless supplied as meaningful product text.

### Skills And Samples

- [x] Treat the `studio-skills` update as required implementation work.
- [x] Update `studio-skills` media-producer guidance for `image.create`.
- [x] Document the agent-first first-frame workflow with
      `referenceMode: 'movie-lookbook'`.
- [x] Document that agents must use Core dependency materialization instead of
      manually resolving Lookbook, Location, Cast, or Shot input asset ids.
- [x] Document that agents must verify `movie-lookbook-sheet` appears in preview
      references before running paid first-frame generation when requested.
- [x] Document the missing Lookbook-sheet recovery path: generate, import, or
      select the Lookbook sheet before retrying the first-frame request.
- [x] Add text-to-image `image.create` sample.
- [x] Add reference-to-image `image.create` sample.
- [x] Update Shot Video Take first-frame workflow guidance.
- [x] Update Shot Video Take last-frame workflow guidance.
- [x] Update Shot Video Take reference-image workflow guidance.
- [x] Update Shot Video Take video-prompt-sheet workflow guidance.
- [x] Update receipt/import guidance to use `generation run show`.
- [x] Remove samples that author old Shot Video Take input generation specs.

### Documentation And Decisions

- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/cli/commands.md`.
- [x] Update generation preview documentation.
- [x] Update Shot Video Take owned-media documentation if purpose names appear
      there.
- [x] Add the accepted ADR for generic image create if implementation proceeds.
- [x] Keep historical references to old purpose names only in decision/plan
      context, not current runtime docs.

### Tests And Verification

- [x] Add focused Core tests for `image.create` validation.
- [x] Add focused Core tests for text-to-image provider payloads.
- [x] Add focused Core tests for reference-to-image provider payloads.
- [x] Add focused Core tests for image create previews.
- [x] Add focused Core tests for image create cost projection.
- [x] Update Shot Video Take dependency inventory tests.
- [x] Update Shot Video Take preflight tests.
- [x] Update Shot Video Take import/selection tests.
- [x] Update lifecycle registry tests.
- [x] Update media generation registry contract tests.
- [x] Update CLI generation command tests.
- [x] Update CLI media import command tests.
- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --dir packages/cli test`.
- [x] Run focused Studio tests if Studio surfaces are touched.
- [x] Run `pnpm check` before marking complete, or document why a narrower
      verification set is sufficient.

### Final Cleanup

- [x] Remove obsolete Shot Video Take input generation spec helpers.
- [x] Remove obsolete imports and exports.
- [x] Remove obsolete docs and samples.
- [x] Confirm `rg "SHOT_FIRST_FRAME_GENERATION_PURPOSE|SHOT_LAST_FRAME_GENERATION_PURPOSE|SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE|SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE"` finds only historical docs or intentionally migrated destination/import concepts.
- [x] Confirm `rg "ShotVideoTakeInputGenerationSpec|ShotVideoTakeInputGenerationPurpose"` finds no runtime code.
- [x] Confirm no compatibility aliases or fallback branches remain.
- [x] Confirm code reads as if `image.create` was the current model all along.
