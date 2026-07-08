# 0123 Generic Image Edit Generation Purpose

Status: completed
Date: 2026-07-07
Completed: 2026-07-07

Completion note: the implementation and simulated verification are complete.
Live provider verification is intentionally recorded as requiring a separate
paid-generation approval before it is run.

## Summary

Add a first-class Renku-managed `image.edit` media generation purpose so agents
and Studio workflows can perform true source-image edits against an existing
project asset.

The immediate trigger is a failed Shot Video Take storyboard/reference image
correction workflow. A generated `shot.video-prompt-sheet` had Panels 3 and 4
with incorrect spatial continuity. The user explicitly wanted a localized edit:
feed the existing generated sheet back into an image edit model, change only
Panels 3 and 4, and preserve the rest of the sheet. The current CLI/spec
surface forced the agent toward regenerating `shot.video-prompt-sheet` through
`referenceMode`, which would resend Movie Lookbook, Location Sheet, and
Character Sheet references and risk introducing new errors in panels that were
already acceptable.

The fix is not a route-local Shot Video Take shortcut. The product needs a
generic image edit generation purpose whose source is a registered project
image asset. The edited output remains an unattached generated file until the
caller imports it through the destination purpose, such as
`renku media import --purpose shot.video-prompt-sheet --replace-selected`.

## Problem

Current Renku-managed image generation has three concepts in practice, but only
two are clearly exposed for Shot Video Take input work:

- text-to-image: create a new image from text;
- reference-to-image: create a new image conditioned by selected references;
- image-edit: modify a source image while preserving requested source traits.

The engine catalog and several purpose implementations already know how to call
edit-capable image models. For example, Cast Profile, Location Hero, and some
sheet-generation paths use edit routes with `image_urls` input files. Shot
input generation also maps reference-conditioned image requests to edit
endpoints internally.

What is missing is a generic, purpose-owned way to express:

```text
Edit this exact registered source image asset with these instructions.
```

Without that, agents either:

- regenerate the whole destination asset through its original purpose;
- manually write a temporary script against the engine layer;
- fabricate or hand-stitch generation receipts;
- import a corrected file without durable Renku generation provenance;
- confuse reference-conditioned new-image generation with source-image editing.

Those are all architecture smells. The runtime already has the engine
capability; Core needs to own the public contract.

## Architecture Decision

Introduce a new media generation purpose:

```text
image.edit
```

`image.edit` is a Renku-managed image generation purpose that targets an
existing project asset image. It validates and prepares a provider image-edit
request, runs through the normal persisted Media Generation Spec lifecycle, and
records a normal Media Generation Run.

`image.edit` does not attach, select, replace, discard, or mutate destination
domain media. It only creates generated output files and run records.

Destination ownership remains purpose-specific:

- Shot Video Take prompt sheet correction uses `media import --purpose
  shot.video-prompt-sheet --replace-selected`.
- Cast profile correction uses the Cast media import command.
- Location hero correction uses the Location Hero import command.
- Generic reference-image attachment uses `media import --purpose
  reference.image`.

This keeps generic editing useful without letting a generic command bypass
domain ownership rules.

## Public Contracts

### Purpose Constant

Add a client purpose constant:

```ts
export const IMAGE_EDIT_GENERATION_PURPOSE = 'image.edit' as const;
```

Add it to `MediaGenerationPurpose` and the shared purpose registry.

### Target

Add an asset media generation target:

```ts
export interface AssetMediaGenerationTarget {
  kind: 'asset';
  id: string;
}
```

Add `AssetMediaGenerationTarget` to `MediaGenerationTarget` and
`MediaGenerationRequestTarget`.

CLI target syntax:

```text
asset:<asset-id>
```

### Spec

Add an `ImageEditGenerationSpec` shape:

```ts
export type ImageEditModelChoice =
  | 'fal-ai/openai/gpt-image-2/edit'
  | 'fal-ai/nano-banana-2/edit'
  | 'fal-ai/xai/grok-imagine-image/edit';

export interface ImageEditGenerationSpec {
  purpose: typeof IMAGE_EDIT_GENERATION_PURPOSE;
  target: AssetMediaGenerationTarget;
  sourceAssetFileId?: string;
  modelChoice: ImageEditModelChoice;
  prompt: string;
  parameterValues: ImageEditParameterValues;
  title?: string;
}

export type ImageEditParameterValues = Record<string, unknown>;
```

`target.id` is the source asset id. `sourceAssetFileId` is optional only when
the source asset has exactly one active image file.

### Context

Add an `ImageEditGenerationContext` report:

```ts
export interface ImageEditGenerationContext {
  purpose: typeof IMAGE_EDIT_GENERATION_PURPOSE;
  target: AssetMediaGenerationTarget;
  sourceAsset: Asset;
  sourceImageFiles: AssetFile[];
  selectedSourceAssetFileId: string | null;
  recommendedModelChoice: ImageEditModelChoice;
  sourceGeneration?: {
    runId: string;
    provider: string;
    model: string;
    mappedEditModelChoice?: ImageEditModelChoice;
  };
  agentMedia: AgentMediaReport;
}
```

`recommendedModelChoice` should map from the source image's generation model
when Core can resolve it:

- `openai/gpt-image-2` or `openai/gpt-image-2/edit` maps to
  `fal-ai/openai/gpt-image-2/edit`;
- `nano-banana-2` or `nano-banana-2/edit` maps to
  `fal-ai/nano-banana-2/edit`;
- `xai/grok-imagine-image` or `xai/grok-imagine-image/edit` maps to
  `fal-ai/xai/grok-imagine-image/edit`;
- otherwise default to `fal-ai/openai/gpt-image-2/edit`.

This directly supports the user expectation that subsequent edit requests use
the same model family when possible.

### Model List

`renku generation model list --purpose image.edit --target asset:<asset-id>`
returns only edit-capable image models.

Each model entry should expose:

- model choice;
- label;
- availability;
- default parameter values;
- parameter rows;
- seed support when applicable;
- source-image count requirement.

The first implementation should support the three edit variants named in
`ImageEditModelChoice`. Additional edit models can be added later by expanding
this explicit union and model-list report directly; do not add a compatibility
alias or broad raw provider route escape hatch.

### Prepared Generation

Preparing an `image.edit` spec produces:

```ts
generation.policy.mode = 'image-edit'
generation.policy.mediaKind = 'image'
generation.request.inputFiles = [
  {
    field: 'image_urls',
    projectRelativePath: '<source file path>',
    mediaKind: 'image',
    asArray: true,
    required: true
  }
]
```

The provider payload includes logical source input URLs:

```ts
image_urls: ['renku-input://<project-relative-source-path>']
```

The spec never stores local absolute paths, provider upload URLs, or generated
provider payload fields.

### Preview

Generation Preview for `image.edit` must show:

- mode `image-edit`;
- the source image as a source image, not as a style reference;
- the final prompt;
- effective model parameters;
- the source asset id and asset file id in the preview contract;
- no absolute local paths or provider upload URLs.

Preview references should use a stable role:

```text
image-edit-source
```

The Studio dialog should remain a projection consumer. Core builds the preview
envelope; Studio renders it.

### Run Receipt

The existing `generation run --json` output is sufficient as a receipt for
purpose-specific import commands, because shot-video import already accepts
receipts containing either `{ run: { id } }` or `{ id }`.

Add a read command so agents can recover a run receipt without fabricating one:

```bash
renku generation run show --run <run-id> --json
```

Core should expose a focused read service for one Media Generation Run. The
command must be read-only and should not introduce run mutation APIs.

## Core Implementation Plan

### Client Contracts

Update client types:

- `packages/core/src/client/media-generation-purpose.ts`
- `packages/core/src/client/media-generation-target.ts`
- `packages/core/src/client/media-generation-lifecycle.ts`
- a new `packages/core/src/client/image-edit-media-generation.ts`
- `packages/core/src/client/index.ts`

The new file owns `ImageEditGenerationSpec`,
`ImageEditGenerationContext`, `ImageEditModelChoice`, and related report types.

No database migration should be needed. Media generation specs already store
JSON payloads and text target metadata. The implementation must still update
target-id serialization to understand `target.kind === 'asset'`.

### Core Purpose Module

Add a new purpose module:

```text
packages/core/src/server/media-generation/purposes/image-edit.ts
```

This module owns:

- context building;
- model listing;
- spec normalization;
- source asset/file validation;
- provider payload construction;
- preview construction;
- spec create/update/list/prepare/run/import lifecycle hooks where applicable.

It must not import Shot Video Take, Cast, Location, Lookbook, or Scene-specific
business logic. It may use shared asset and asset-file database accessors.

### Source Validation

Validation rules:

- target asset must exist and not be discarded;
- target asset media kind must be image, or at least one active source file
  must have `mediaKind: 'image'`;
- `sourceAssetFileId`, when supplied, must belong to the target asset and be an
  active image file;
- when `sourceAssetFileId` is omitted, there must be exactly one active image
  file on the asset;
- source image file must resolve to a project-relative path inside the project;
- prompt must be non-empty;
- model choice must be one of `ImageEditModelChoice`;
- parameter values must be supported for the selected edit model.

Use structured diagnostics with stable Core-owned codes, for example:

- `CORE_IMAGE_EDIT_SOURCE_ASSET_MISSING`
- `CORE_IMAGE_EDIT_SOURCE_FILE_MISSING`
- `CORE_IMAGE_EDIT_SOURCE_FILE_AMBIGUOUS`
- `CORE_IMAGE_EDIT_SOURCE_FILE_NOT_IMAGE`
- `CORE_IMAGE_EDIT_MODEL_UNSUPPORTED`
- `CORE_IMAGE_EDIT_PARAMETERS_UNSUPPORTED`
- `CORE_IMAGE_EDIT_PROMPT_REQUIRED`

Do not add diagnostics for obsolete shapes or compatibility aliases.

### Provider Payloads

Build model-specific payloads using the same conventions as current image
purposes:

- GPT Image 2 Edit:
  - model `openai/gpt-image-2/edit`;
  - mode `image-edit`;
  - `image_urls` as an array;
  - `prompt`;
  - supported `image_size`, `quality`, `output_format`, `num_images` controls;
  - `sync_mode: false`.
- Nano Banana 2 Edit:
  - model `nano-banana-2/edit`;
  - mode `image-edit`;
  - supported `aspect_ratio`, `resolution`, `output_format`, `seed`,
    `num_images` controls;
  - existing safety and generation-limit defaults only when already used by the
    current Nano Banana purpose implementation.
- Grok Imagine Edit:
  - model `xai/grok-imagine-image/edit`;
  - mode `image-edit`;
  - supported `output_format` and `num_images` controls.

Do not let the generic edit spec pass arbitrary provider fields.

### Cost Projection

Add `image.edit` to cost projection with the edit provider model as the price
key.

The cost projection should use the selected model's normalized parameters:

- GPT Image 2 Edit uses image size and quality when supplied;
- Nano Banana 2 Edit uses resolution when supplied;
- all models use output count when supplied;
- source image input count is one when the pricing model requires it.

This avoids the existing class of mistakes where an edit route is prepared but
priced as the base text-to-image model.

### Lifecycle Registry

Register `image.edit` in the shared purpose lifecycle registry with:

- media kind `image`;
- target kind `asset`;
- context;
- model list;
- validate;
- create;
- update;
- list;
- prepare;
- prepare draft;
- preview;
- run.

Do not add a generic import hook. Import remains destination-purpose-owned.

### Run Read Service

Add a read-only service for Media Generation Runs:

```ts
readMediaGenerationRun(input: ReadMediaGenerationRunInput): Promise<MediaGenerationRunReport>
```

The service should:

- require the run id;
- read the current project database;
- return the run in the same report shape used by `generation run`;
- fail with a structured error when not found.

Do not add update, retry, replay, or delete run commands in this slice.

## CLI Plan

### Purpose Registry

Update CLI generation purpose parsing:

- add `image.edit` to supported purposes;
- parse `asset:<asset-id>` targets for `image.edit`;
- keep existing target syntax unchanged for all other purposes.

### Commands

Existing lifecycle commands should work:

```bash
renku generation context --purpose image.edit --target asset:<asset-id> --json
renku generation model list --purpose image.edit --target asset:<asset-id> --json
renku generation preview show --file image-edit-spec.json --json
renku generation spec validate --file image-edit-spec.json --json
renku generation spec create --file image-edit-spec.json --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
```

Add:

```bash
renku generation run show --run <run-id> --json
```

Update help and docs so agents know that `image.edit` creates generated output
files only. It does not attach edited files to a destination.

### Shot Video Prompt Sheet Correction Workflow

Document the exact correction workflow:

```bash
renku generation input list \
  --purpose shot.video-take \
  --target take:<take-id> \
  --json
```

Find the selected `video-prompt-sheet` input and use its `assetId`.

Create and preview:

```bash
renku generation preview show --file image-edit-spec.json --json
```

Persist, estimate, and run after user approval:

```bash
renku generation spec create --file image-edit-spec.json --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
```

Inspect the generated edited image. Then attach the correction:

```bash
renku media import \
  --purpose shot.video-prompt-sheet \
  --target take:<take-id> \
  --source <edited-output-project-relative-path> \
  --receipt image-edit-run.json \
  --selection select \
  --replace-selected \
  --json
```

This import command remains the only mutation that changes the selected
Shot Video Take prompt sheet.

## Studio UI Plan

No dedicated Studio editing UI is required in this slice.

Generation Preview should already be able to render image-generation previews.
The only UI-facing contract change should be that preview references may include
the `image-edit-source` role and provider preview mode `image-edit`.

Studio must not inspect prompt text or generated image content to decide whether
localized edits were successful. The agent/user review loop owns that visual QA.

## Studio Skills Plan

Update the sister skills project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/
```

Files to update:

- `skills/media-producer/SKILL.md`
- `skills/media-producer/references/reference-visible-image-prompting.md`
- `skills/media-producer/references/shot-video-take/storyboard-reference-image.md`
- `skills/media-producer/references/workflow.md`
- `skills/media-producer/samples/image-edit-spec.json`

Guidance to add:

- use `image.edit` when the user asks to edit, revise, fix only part of,
  preserve most of, or keep everything else the same in an existing image;
- do not use `shot.video-prompt-sheet` regeneration with `referenceMode` for
  localized corrections of an already selected prompt sheet;
- do not resend Movie Lookbook, Location Sheet, or Character Sheet references
  unless the user asks for a new reference-conditioned image;
- use the current selected prompt sheet asset as the source asset;
- preview the edit spec before paid generation;
- inspect the edited image before import;
- import with `--replace-selected` only after the correction is accepted.

Add a sample based on the Bombardment Panel 3/4 correction:

```json
{
  "purpose": "image.edit",
  "target": { "kind": "asset", "id": "asset_current_prompt_sheet" },
  "modelChoice": "fal-ai/openai/gpt-image-2/edit",
  "prompt": "Edit this exact storyboard/reference image. Preserve Panels 1, 2, 5, and 6 exactly. Change only Panels 3 and 4. Panel 3 must continue from the city over the walls toward the battlefield. Panel 4 must show the battlefield after the wall crossing, with no wall visible, and the Ottoman encampment far in the distance. Preserve the sheet layout, panel borders, style, period look, labels, timing strip, and all unchanged panels.",
  "parameterValues": {
    "image_size": { "width": 1024, "height": 768 },
    "quality": "high",
    "output_format": "png",
    "num_images": 1
  },
  "title": "Bombardment prompt sheet Panels 3 and 4 correction"
}
```

The sample prompt is agent guidance only. Studio runtime must not parse or
validate panel numbers, unchanged panel claims, labels, timing strips, or visual
continuity.

## Documentation Plan

Update:

- `docs/architecture/reference/media-generation.md`
- `docs/cli/commands.md`
- `docs/architecture/generation-preview-purpose-bindings.md`
- `docs/architecture/reference/studio-skills.md` if the skill contract changes
  need an architecture cross-reference.

Documentation must state:

- `image.edit` edits a registered image asset;
- `image.edit` source images are project assets, not local paths;
- `image.edit` produces generated files and run records only;
- destination attachment is still purpose-owned import;
- preview must show source-image context before paid generation;
- agents must not fabricate receipts.

## Tests

### Core Unit Tests

Add tests for:

- target asset missing;
- source asset discarded;
- source asset has no image file;
- source asset has multiple image files and no `sourceAssetFileId`;
- supplied `sourceAssetFileId` is not on the source asset;
- supplied `sourceAssetFileId` is not an image;
- unsupported model choice;
- unsupported parameter values;
- empty prompt;
- draft spec preview includes `image-edit-source`;
- prepared generation uses mode `image-edit`;
- prepared generation includes one `image_urls` input file;
- provider payload uses logical `renku-input://` source URLs;
- cost projection prices the edit model route;
- run records provider/model/mode and outputs.

### CLI Tests

Add tests for:

- `image.edit` purpose parsing;
- `asset:<asset-id>` target parsing;
- `generation context` for `image.edit`;
- `generation model list` for `image.edit`;
- `generation preview show --file` for an edit spec;
- `generation run show --run`;
- unsupported targets still fail with structured CLI errors.

### Integration Tests

Add a focused integration test that simulates the Shot Video Take correction
workflow without a paid provider call:

1. Create a test Shot Video Take.
2. Import a selected `shot.video-prompt-sheet`.
3. Create an `image.edit` spec targeting that prompt sheet asset.
4. Run with `--simulate`.
5. Import the simulated output as `shot.video-prompt-sheet` with
   `--replace-selected`.
6. Assert the new prompt sheet is selected.
7. Assert the old selected prompt sheet input is discarded through the existing
   recoverable discard path.
8. Assert the new input links to the image edit run id through receipt metadata.

Do not add tests that inspect or assert panel contents.

### Architecture Tests

Architecture tests should protect stable boundaries:

- CLI must not build provider `image_urls` itself.
- Studio React must not import provider schemas or inspect raw edit payloads.
- `image.edit` must not import Shot Video Take, Cast, Location, Scene, or
  Lookbook mutation modules.
- destination replacement must remain in purpose-specific import commands.

Do not hard-code private helper names or command inventories as source-text
needles.

## Rollout And Compatibility

Renku Studio is pre-customer software. Do not add compatibility aliases,
fallback loaders, old spec shapes, or legacy target syntax.

Implementation should update all current callers and docs directly to the
current `image.edit` contract.

Existing generation specs are unaffected because this is an additive purpose.
No read-time migration or compatibility branch is needed.

## Non-Goals

- No generic command that imports or replaces destination media.
- No Studio UI drawing/masking editor in this slice.
- No runtime understanding of panels, labels, arrows, captions, or visual
  correctness.
- No local image processing workaround for edits.
- No raw provider route passthrough in CLI.
- No support for arbitrary local filesystem source paths.
- No mobile UI work.

## Completion Checklist

### Review Area

- [x] Confirm `image.edit` is the accepted public purpose name.
- [x] Confirm `asset:<asset-id>` is the accepted CLI target syntax.
- [x] Confirm `image.edit` targets registered project assets, not paths.
- [x] Confirm destination import/replacement remains purpose-owned.
- [x] Confirm the plan does not add a generic media mutation shortcut.
- [x] Confirm prompt and generated image contents remain opaque to Studio
      runtime.
- [x] Confirm no backwards-compatibility aliases or fallback spec shapes are
      introduced.

### Architecture And Contracts

- [x] Add `IMAGE_EDIT_GENERATION_PURPOSE`.
- [x] Add `AssetMediaGenerationTarget`.
- [x] Add `ImageEditGenerationSpec`.
- [x] Add `ImageEditGenerationContext`.
- [x] Add `ImageEditModelChoice`.
- [x] Add `ImageEditParameterValues`.
- [x] Add `image.edit` to `MediaGenerationPurpose`.
- [x] Add `ImageEditGenerationSpec` to `MediaGenerationSpec`.
- [x] Add image edit model choice types to `MediaGenerationSpecRecord` and
      `MediaGenerationRun`.
- [x] Update media generation target id serialization for `asset` targets.
- [x] Add structured diagnostic codes for source asset, source file, prompt,
      model, and parameter failures.
- [x] Confirm no database migration is required.

### Core Implementation

- [x] Add `packages/core/src/client/image-edit-media-generation.ts`.
- [x] Add `packages/core/src/server/media-generation/purposes/image-edit.ts`.
- [x] Implement image edit context building.
- [x] Implement recommended edit model mapping from source generation metadata.
- [x] Implement image edit model listing.
- [x] Implement spec normalization and validation.
- [x] Implement source asset and source file resolution.
- [x] Implement model-specific provider payload builders.
- [x] Implement draft and saved spec preparation.
- [x] Implement image edit preview building.
- [x] Implement image edit cost projection.
- [x] Register `image.edit` in the media generation lifecycle registry.
- [x] Ensure prepared runs pass source files through the shared
      `inputRoot`-backed runner path.
- [x] Add read-only Media Generation Run read service.

### CLI

- [x] Add `image.edit` to the generation purpose registry.
- [x] Add `asset:<asset-id>` parsing for `image.edit`.
- [x] Wire `generation context` for `image.edit`.
- [x] Wire `generation model list` for `image.edit`.
- [x] Confirm existing spec validate/create/update/show/list commands work for
      `image.edit`.
- [x] Confirm existing preview/estimate/run commands work for `image.edit`.
- [x] Add `generation run show --run <run-id> --json`.
- [x] Update CLI top-level help.
- [x] Update command docs with the prompt-sheet correction workflow.

### Studio Preview

- [x] Ensure preview mode `image-edit` is preserved in the preview contract.
- [x] Ensure preview references can show role `image-edit-source`.
- [x] Ensure Studio renders the source image through existing preview image
      components.
- [x] Ensure Studio does not display raw provider payload JSON as user-facing
      copy.
- [x] Ensure Studio does not inspect prompt text or generated image contents.

### Destination Workflows

- [x] Verify `media import --purpose shot.video-prompt-sheet --replace-selected`
      accepts `generation run --json` output as receipt.
- [x] Verify the imported corrected prompt sheet links to the `image.edit` run
      id.
- [x] Verify the old selected prompt sheet input is discarded only by the
      existing replace-selected import mutation.
- [x] Verify generic `image.edit` run by itself does not mutate Shot Video Take,
      Cast, Location, Lookbook, Scene, or reference-image relationships.

### Studio Skills

- [x] Update `skills/media-producer/SKILL.md` to route localized image
      corrections to `image.edit`.
- [x] Update `reference-visible-image-prompting.md` with concrete `image.edit`
      source-image guidance.
- [x] Update `shot-video-take/storyboard-reference-image.md` with the selected
      prompt-sheet correction workflow.
- [x] Update `workflow.md` with generic image edit lifecycle steps.
- [x] Add `samples/image-edit-spec.json`.
- [x] Add the Bombardment Panel 3/4 correction as an example without making
      panel validation a runtime rule.
- [x] Ensure skills tell agents not to regenerate `shot.video-prompt-sheet`
      with `referenceMode` for localized corrections.
- [x] Ensure skills tell agents never to fabricate Renku receipts.

### Documentation

- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/cli/commands.md`.
- [x] Update `docs/architecture/generation-preview-purpose-bindings.md`.
- [x] Update `docs/architecture/reference/studio-skills.md` if needed.
- [x] Document that `image.edit` creates generated files and run records only.
- [x] Document that destination import remains purpose-specific.
- [x] Document the exact Shot Video Take prompt-sheet correction sequence.

### Validation And Tests

- [x] Add Core validation tests for missing, discarded, ambiguous, and non-image
      source files.
- [x] Add Core validation tests for unsupported models and unsupported
      parameters.
- [x] Add Core prepare tests for provider payload, logical source URL, input
      files, and mode.
- [x] Add Core preview tests for `image-edit-source`.
- [x] Add Core cost projection tests for each supported edit model.
- [x] Add Core run tests using simulated generation.
- [x] Add CLI tests for purpose parsing, target parsing, preview, and run show.
- [x] Add the simulated Shot Video Take prompt-sheet correction integration
      test.
- [x] Add architecture tests for CLI, Studio UI, and generic-purpose ownership
      boundaries.
- [x] Run focused Core tests.
- [x] Run focused CLI tests.
- [x] Run focused Studio preview tests if preview rendering changes.
- [x] Run package/root checks appropriate to the final implementation slice.

### Final Verification

- [x] On the real `urban-basilica` project or an equivalent development copy,
      identify a selected `shot.video-prompt-sheet` asset.
- [x] Create an `image.edit` draft spec targeting that asset.
- [x] Verify the Generation Preview contract exposes the source image as the
      edit source for Studio rendering. The already-running local Studio server
      must be restarted to pick up this new purpose.
- [x] Estimate and run with `--simulate` first.
- [x] Confirm the simulated run can be read with `generation run show`.
- [x] Import the simulated edited output with `--replace-selected`.
- [x] Confirm the new prompt sheet input is selected.
- [x] Confirm the old selected prompt sheet input is discarded through Trash.
- [x] Record that live provider verification requires a separate small approved
      paid edit before generation and import.
