# 0026 Cast Profile And Character Sheet Media Generation

Date: 2026-05-26

Status: proposed

## Goal

Add cast image generation to the current persisted media generation system.

The new media purposes are:

```text
cast.character-sheet
cast.profile
```

The implementation should reuse the working Lookbook Image generation pattern:

- core builds factual purpose context;
- the media-producer skill writes a persisted generation spec;
- core validates the spec and maps it to a provider payload;
- engines validates the final provider payload against the real model JSON
  Schema before estimate and run;
- generation creates staged outputs only;
- media import attaches an existing file to the cast member afterward.

This should be the second and third concrete media generation slices. It should
not introduce a generic media-purpose framework yet.

## References Reviewed

- `plans/active/0025-generation-options-and-persisted-specs.md`
- `plans/active/0024-media-generation-definitions-and-engine-contract.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `docs/decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `packages/core/src/client/media-generation.ts`
- `packages/core/src/server/media-generation/lookbook-image.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/media-command.ts`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`

## Required Direction

- Keep generation and media import separate.
- Persist every generation spec before estimate or run.
- Treat user-selected model, take count, seed, image frame, detail, output
  format, prompt, title, and source asset as binding.
- Use provider JSON Schemas only to validate final provider payloads.
- Keep provider/model choices as plain TypeScript in each concrete purpose
  slice.
- Do not add model capability YAML, schema overlays, registries, adapter
  interfaces, generic media-purpose definitions, or plugin-like purpose
  frameworks.
- Do not expose raw provider parameters to users.
- Do not add compatibility aliases for old or explored purpose names.
- Do not restore `cast.portrait`. The accepted public purpose name for this
  slice is `cast.profile`.
- Do not hard-code character sheet style as a product enum. Sheet style belongs
  in skill guidance and in the agent-authored prompt.

## Public Contract

### Purpose Keys And Targets

Supported purpose keys after this plan:

```text
lookbook.image
cast.character-sheet
cast.profile
```

CLI target format for the cast purposes:

```text
cast:<cast-member-id>
```

Core target shape:

```ts
{
  kind: 'castMember';
  id: string;
}
```

The CLI parser may translate `cast:<id>` to the core target shape directly. Do
not introduce a shared target registry.

### Cast Character Sheet Import Contract

`cast.character-sheet` imports image files as cast assets:

```text
asset.type       = character_sheet
asset.mediaKind  = image
asset_file.role  = primary
cast_asset.role  = character_sheet
```

Destination folder:

```text
cast/<cast-member-handle>/character-sheets/
```

### Cast Profile Import Contract

`cast.profile` imports image files as cast assets:

```text
asset.type       = cast_profile
asset.mediaKind  = image
asset_file.role  = primary
cast_asset.role  = profile
```

Destination folder:

```text
cast/<cast-member-handle>/profiles/
```

Folder names are readable project storage only. The cast member relationship is
stored in `cast_asset`; no runtime code may infer ownership from the path.

### Profile Dependency Rule

Profile images should prefer the character sheet first, but they must not
require one in every case.

The first implementation should:

- include selected character sheets in `cast.profile` context;
- return `recommendedSourceAssetId` when a selected `character_sheet` image
  exists;
- support profile text-to-image generation without a source sheet;
- support profile edit generation only when `sourceAssetId` is present;
- store `sourceAssetId` in the persisted profile spec when an edit model is
  chosen.

Do not dynamically resolve "the current selected sheet" at run time for an edit
spec. If a spec is intended to edit from a sheet, the sheet asset id must be
captured in the persisted spec so estimate and run refer to the same logical
input.

## Client Contracts

Update `packages/core/src/client/media-generation.ts`.

Add constants:

```ts
export const CAST_CHARACTER_SHEET_GENERATION_PURPOSE =
  'cast.character-sheet' as const;

export const CAST_PROFILE_GENERATION_PURPOSE = 'cast.profile' as const;
```

Add shared unions:

```ts
export type MediaGenerationPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE;

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget;

export type MediaGenerationSpec =
  | LookbookImageGenerationSpec
  | CastCharacterSheetGenerationSpec
  | CastProfileGenerationSpec;
```

Add cast target:

```ts
export interface CastMediaGenerationTarget {
  kind: 'castMember';
  id: string;
}
```

Add model choices:

```ts
export type CastCharacterSheetModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type CastProfileModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image'
  | 'fal-ai/openai/gpt-image-2/edit'
  | 'fal-ai/nano-banana-2/edit'
  | 'fal-ai/xai/grok-imagine-image/edit';
```

Use the existing image control vocabulary:

```ts
export type CastImageFrame = LookbookImageFrame;
export type CastImageDetail = LookbookImageDetail;
export type CastImageOutputFormat = LookbookImageOutputFormat;
```

Do not rename the existing Lookbook-specific control types in this slice unless
the implementation becomes confusing. If shared names are introduced, update
callers directly and do not keep aliases.

## Cast Context Builders

Add two concrete files:

```text
packages/core/src/server/media-generation/cast-character-sheet.ts
packages/core/src/server/media-generation/cast-profile.ts
```

These files should mirror the direct shape of `lookbook-image.ts`. They own
context building, model choices, spec validation, provider payload mapping,
estimate/run preparation, output naming, and import for their purpose.

### Shared Cast Context Inputs

Both cast contexts should gather:

- project id, project name, title, aspect ratio, logline, summary, and
  languages;
- screenplay-level context when screenplay data exists:
  - title;
  - genre and tone fields when present;
  - logline and summary;
  - premise overview;
  - central conflict;
  - dramatic question;
  - themes;
  - historical basis;
- target cast member:
  - id;
  - handle;
  - name;
  - role;
  - age;
  - want;
  - need;
  - arc;
  - voice notes;
  - description;
- active Lookbook when available;
- selected cast image assets;
- character sheet takes and profile takes;
- project-relative and absolute paths for relevant cast image files, so the
  media-producer skill can inspect them before prompting.

The context builder should be factual. It should not choose a model, write prompt
instructions, infer provider parameters, or return generic model requirements.

### Time Period Context

The character sheet context needs enough time-period information for the skill
to write a useful prompt.

Use the available current data sources:

- `screenplay.historicalBasis`;
- location `timePeriod` values from locations referenced by scenes involving
  the target cast member;
- scene setting and scene title/blocks involving the target cast member when
  useful and not too large.

Keep the returned shape compact. A useful first shape is:

```ts
timePeriod: {
  historicalBasis: string[];
  locationTimePeriods: string[];
  sceneSignals: Array<{
    sceneId: string;
    title: string;
    setting?: SceneSetting;
  }>;
}
```

Do not invent a new durable time-period schema in this slice.

### Active Lookbook Rule

`cast.character-sheet` requires an active Lookbook.

If no active Lookbook exists, fail fast with a structured `PROJECT_DATA...`
error. The suggestion should tell the caller to create or set an active Lookbook
before generating a character sheet.

`cast.profile` should include the active Lookbook if one exists, but it does not
need to fail when there is no active Lookbook because it may be generated from a
selected character sheet.

## Generation Specs

### Character Sheet Spec

Shape:

```json
{
  "purpose": "cast.character-sheet",
  "target": { "kind": "castMember", "id": "cast_abc" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "Detailed character sheet prompt...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Mehmed base character sheet"
}
```

Rules:

- `purpose` must be `cast.character-sheet`.
- `target.kind` must be `castMember`.
- target cast member must exist.
- active Lookbook must exist.
- `prompt` must be non-empty after trimming.
- `takeCount` defaults to `1`.
- `seed` defaults to `null`.
- `imageFrame` defaults to `project`.
- `detail` defaults to `standard`.
- `outputFormat` defaults to `png`.
- model-specific validation may reject a supported product option when the
  selected model cannot execute it.

### Profile Spec

Shape:

```json
{
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_abc" },
  "modelChoice": "fal-ai/nano-banana-2/edit",
  "prompt": "Create a square cast profile image from the character sheet...",
  "sourceAssetId": "asset_sheet_abc",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "1:1",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Mehmed profile"
}
```

Rules:

- `purpose` must be `cast.profile`.
- `target.kind` must be `castMember`.
- target cast member must exist.
- `prompt` must be non-empty after trimming.
- `sourceAssetId` is optional for text-to-image models.
- `sourceAssetId` is required for edit models.
- when present, `sourceAssetId` must refer to an image asset attached to the
  same cast member with `cast_asset.role = character_sheet`;
- the source asset must have at least one image file;
- `takeCount`, `seed`, `imageFrame`, `detail`, and `outputFormat` follow the
  same defaulting rules as character sheets.

## Model Choices And Payload Mapping

Keep model choices in constants inside the concrete purpose files. Do not add a
model registry.

### Character Sheet Models

Supported choices:

```text
fal-ai/openai/gpt-image-2
fal-ai/nano-banana-2
fal-ai/xai/grok-imagine-image
```

Preferred creative guidance:

- GPT Image 2 and Nano Banana 2 are the primary character sheet models.
- Grok Imagine is a cheaper exploratory option.

The model list report should include:

- `modelChoice`;
- label;
- availability;
- unavailable reason when unavailable;
- whether seed is supported;
- take count range;
- supported frames;
- supported details;
- supported output formats;
- whether the model uses a source asset.

### Profile Models

Supported choices:

```text
fal-ai/openai/gpt-image-2
fal-ai/nano-banana-2
fal-ai/xai/grok-imagine-image
fal-ai/openai/gpt-image-2/edit
fal-ai/nano-banana-2/edit
fal-ai/xai/grok-imagine-image/edit
```

Text-to-image profile models do not use `sourceAssetId`.

Edit profile models require `sourceAssetId` and build `image_urls` from the
source character sheet file.

### Text-To-Image Mapping

Reuse the Lookbook Image mapping rules.

GPT Image 2:

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
- map `detail` to `quality`:
  - `draft` -> `low`
  - `standard` -> `medium`
  - `high` -> `high`
- reject `21:9` in the first slice.

Nano Banana 2:

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
- support seed;
- map `detail` to `resolution`:
  - `draft` -> `1K`
  - `standard` -> `2K`
  - `high` -> `4K`
- support `21:9`.

Grok Imagine:

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
- support only `detail: "standard"`;
- reject `21:9`;
- persist returned revised prompt in run outputs when present.

### Edit Mapping For Profile Images

GPT Image 2 edit:

```ts
{
  prompt: spec.prompt,
  image_urls: [sourceFile],
  num_images: spec.takeCount,
  image_size: mappedImageSizeOrAuto,
  quality: mappedQuality,
  output_format: spec.outputFormat,
  sync_mode: false,
}
```

Nano Banana 2 edit:

```ts
{
  prompt: spec.prompt,
  image_urls: [sourceFile],
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

Grok Imagine edit:

```ts
{
  prompt: spec.prompt,
  image_urls: [sourceFile],
  num_images: spec.takeCount,
  output_format: spec.outputFormat,
  sync_mode: false,
}
```

For edit payload construction, `sourceFile` should be represented as a logical
generation file input before provider upload. See the engine file input section.

## Engine File Inputs

Profile edit generation needs a character sheet file to become a provider
`image_urls` URI. The current engine generation contracts define
`GenerationRequest.inputFiles`, but the runner does not yet use it to build
provider payloads.

Add a minimal file input path to `packages/engines/src/generation`.

### Contract Shape

Use a logical input that binds a project file to a provider field:

```ts
export interface GenerationInputFile {
  field: string;
  projectRelativePath: string;
  mediaKind: GenerationMediaKind;
  asArray?: boolean;
  required?: boolean;
}
```

This replaces or extends the current unused `name` shape. Update callers
directly; do not keep a compatibility alias.

### Estimate Behavior

Estimate must not upload files.

For schema validation and approval-token hashing, the estimate path should build
a deterministic logical payload:

```ts
image_urls: [
  'renku-input://cast/mehmed/character-sheets/base.png'
]
```

Rules:

- logical input URIs must be deterministic;
- they must validate as URIs against provider schemas;
- approval tokens must hash the logical request, not temporary provider upload
  URLs;
- missing required file input binding should fail before cost estimate.

### Run Behavior

Run should:

1. rebuild the same logical request that estimate used;
2. verify approval token against that logical request for live runs;
3. resolve project-relative input files against the current project folder;
4. reject paths outside the project;
5. read the files into blob-like values with a MIME type;
6. let the existing provider adapter upload path convert blob-like URI fields
   into provider URLs;
7. validate the resolved provider payload against the model JSON Schema;
8. invoke the provider.

Simulated runs should use the existing simulated upload URL path.

This keeps provider upload URLs out of persisted specs and approval tokens while
still allowing edit models to use project-local source images.

## Persistence

Do not add new media generation tables for this slice.

The current tables are sufficient:

```text
media_generation_spec
media_generation_run
```

Required changes:

- widen TypeScript access types to handle Lookbook, character sheet, and profile
  spec unions;
- list specs by any supported purpose/target pair;
- store cast specs in the existing `spec_json`;
- store cast run snapshots in the existing run columns;
- keep output metadata in `outputs_json`.

No Drizzle migration should be needed unless implementation discovers a missing
column that is required for the current behavior. If a schema change becomes
necessary, follow `docs/architecture/reference/drizzle-migrations.md` and
generate it with Drizzle Kit.

## Media Import

Cast media import should be implemented in the cast purpose files or in a small
private helper if it removes real duplication with Lookbook Image import. Do not
create a public generic media-purpose import framework.

### Import Steps

For both cast purposes:

1. parse `--purpose` and `--target` in CLI;
2. validate target cast member exists;
3. normalize and resolve the project-relative source path;
4. fail if the source path is outside the project or not a file;
5. allocate a unique destination file path under the cast member folder;
6. copy the source file when source and destination differ;
7. hash the file;
8. insert `asset`;
9. insert `asset_file`;
10. insert `cast_asset`;
11. return the imported `Asset`;
12. emit cast resource keys.

Resource keys:

```text
assets:castMember:<cast-member-id>
surface:castMember:<cast-member-id>
```

### Cast Overview Image Preference

Update cast overview image selection so `cast.profile` can actually behave like
the cast member's profile image.

Preferred first image order:

1. selected `profile` image;
2. selected `character_sheet` image;
3. any selected image;
4. first available image take.

This should be a projection rule only. It must not change asset selection state.

## CLI Shape

Keep the current generic command names.

### Context And Model List

Add direct switches:

```bash
renku generation context --purpose cast.character-sheet --target cast:<id> --json
renku generation context --purpose cast.profile --target cast:<id> --json

renku generation model list --purpose cast.character-sheet --target cast:<id> --json
renku generation model list --purpose cast.profile --target cast:<id> --json
```

### Spec Commands

Spec commands should parse the JSON file or stored spec, read `purpose`, and
dispatch directly:

```bash
renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose cast.character-sheet --target cast:<id> --json
renku generation spec list --purpose cast.profile --target cast:<id> --json
```

Do not require a purpose flag on `spec validate`, `spec create`, `spec update`,
`estimate`, or `run`; the spec itself is the source of truth.

### Estimate And Run

```bash
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --simulate --json
```

### Media Import

```bash
renku media import \
  --purpose cast.character-sheet \
  --target cast:<cast-member-id> \
  --source generated/media/<file> \
  --title "Mehmed base character sheet" \
  --summary "Base continuity sheet for Mehmed II." \
  --receipt <generation-run-json> \
  --json
```

```bash
renku media import \
  --purpose cast.profile \
  --target cast:<cast-member-id> \
  --source generated/media/<file> \
  --title "Mehmed profile" \
  --summary "Square profile image derived from the selected character sheet." \
  --receipt <generation-run-json> \
  --json
```

The CLI remains a thin adapter. It should not know the asset type, relationship
role, destination folder, or context rules beyond direct dispatch.

## Project Data Service

Extend `ProjectDataService` with concrete methods:

```ts
buildCastCharacterSheetContext(...)
listCastCharacterSheetModels(...)
validateCastCharacterSheetSpec(...)
createCastCharacterSheetSpec(...)
updateCastCharacterSheetSpec(...)
readCastCharacterSheetSpec(...)
listCastCharacterSheetSpecs(...)
prepareCastCharacterSheetSpec(...)
estimateCastCharacterSheetSpec(...)
runCastCharacterSheetSpec(...)
recordCastCharacterSheetRun(...)
importCastCharacterSheetMedia(...)

buildCastProfileContext(...)
listCastProfileModels(...)
validateCastProfileSpec(...)
createCastProfileSpec(...)
updateCastProfileSpec(...)
readCastProfileSpec(...)
listCastProfileSpecs(...)
prepareCastProfileSpec(...)
estimateCastProfileSpec(...)
runCastProfileSpec(...)
recordCastProfileRun(...)
importCastProfileMedia(...)
```

If this list becomes too noisy during implementation, a small media-generation
service wiring file is acceptable, but avoid a purpose registry. The service
surface should still expose concrete methods.

## Media Producer Skill

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md
```

Add progressive disclosure files:

```text
references/cast-character-sheet.md
references/cast-profile.md
samples/cast-character-sheet-spec.json
samples/cast-profile-spec.json
```

Update `references/future-purpose-sketches.md` to remove the cast purposes from
"future" status once implemented.

### Skill Workflow Additions

The skill should say:

1. read context first;
2. list purpose-specific model choices;
3. ask for missing creative intent only when it materially changes the output;
4. create a persisted spec;
5. estimate cost;
6. run only after approval for paid generation;
7. inspect generated images;
8. import the chosen outputs separately.

It must repeat the binding rule:

- do not override model choice, take count, seed, image frame, detail, output
  format, prompt, title, or source asset after the user has selected them.

### Character Sheet Prompting Guidance

The character sheet reference should teach the agent to use:

- story function and dramatic role;
- age, build, posture, gesture language, and emotional register;
- want, need, and arc as visible character design pressure;
- time period and material culture;
- costume layers, textile, armor, accessories, hair, makeup, and grooming;
- silhouette, body language, hands, expression range, and movement tendencies;
- active Lookbook palette, lighting, texture, composition, and camera rules;
- selected profile or existing character sheet references when available;
- sheet style descriptions in prose.

Examples of sheet style descriptions should be allowed, but not encoded as a
schema enum:

- all-in-one continuity sheet;
- turnaround model sheet;
- expression sheet;
- costume and outfit sheet;
- pose and gesture sheet;
- focused detail sheet for face, hands, accessories, or texture.

The guidance should prefer concrete visual instructions over abstract mood
words. For example, "sleep-deprived eyes, court-trained posture, hand resting
near a scroll tube" is better than "intense and strategic."

### Profile Prompting Guidance

The profile reference should teach the agent to:

- prefer a selected character sheet as visual source when one exists;
- use edit models for profile images when the sheet is strong;
- use text-to-image when no sheet exists or when the user explicitly wants a
  fresh interpretation;
- keep the profile image readable at small cast-card size;
- favor clear face, silhouette, costume signal, and Lookbook-consistent light;
- avoid full multi-panel sheet language in profile prompts.

Preferred models:

- GPT Image 2 and Nano Banana 2 for quality;
- Grok Imagine for cheaper exploratory profile drafts.

## Documentation Updates

Update `docs/architecture/reference/media-generation.md`:

- list the two new current purposes;
- document target format;
- document cast context behavior;
- document cast spec shapes;
- document source asset behavior for profile edit specs;
- document cast import behavior;
- keep the future purpose rule against generic frameworks.

Update `docs/architecture/reference/project-files-and-assets.md`:

- mention generated/imported cast media paths under `cast/<handle>/`.

Update `docs/architecture/reference/domain-vocabulary.md` only if needed:

- add `Cast Profile` as the profile image purpose for a cast member;
- keep `Cast Asset` as the underlying asset relationship concept.

Add a decision document only if engine file-input approval-token behavior is
considered architectural enough to preserve separately. If added, keep it short
and focused on logical file inputs versus provider upload URLs.

## Tests

### Core Context Tests

- `cast.character-sheet` context includes project, screenplay, cast member,
  active Lookbook, time-period signals, selected assets, and take assets.
- `cast.character-sheet` context fails when no active Lookbook exists.
- `cast.profile` context includes selected character sheets and existing
  profiles.
- `cast.profile` context returns `recommendedSourceAssetId` when a selected
  character sheet image exists.
- `cast.profile` context still succeeds without a selected sheet.

### Core Spec And Payload Tests

- character sheet spec rejects a non-existent cast member.
- character sheet spec rejects no-active-Lookbook state.
- profile edit spec rejects missing `sourceAssetId`.
- profile edit spec rejects a source asset attached to another cast member.
- profile edit spec rejects a source asset with the wrong role.
- profile edit spec rejects a non-image source asset.
- GPT Image 2 rejects seed and `21:9`.
- Nano Banana 2 supports seed and `21:9`.
- Grok Imagine rejects seed, `21:9`, and non-standard detail.
- edit model payloads contain logical file input bindings for `image_urls`.
- every supported provider payload validates against its catalog JSON Schema.

### Engine Tests

- estimate validates a logical `image_urls` file input without upload.
- approval token hashes the logical request, not provider upload URLs.
- simulated run resolves logical file inputs through simulated provider upload.
- live path test uses a fake adapter upload hook and validates the resolved
  provider payload.
- missing required project file input fails before provider invocation.

### Import Tests

- `cast.character-sheet` import creates `asset`, `asset_file`, and `cast_asset`
  with the expected type, role, file role, origin, and destination path.
- `cast.profile` import creates `asset`, `asset_file`, and `cast_asset` with
  the expected type, role, file role, origin, and destination path.
- import rejects source files outside the project.
- import returns cast resource keys.
- cast overview first image prefers selected `profile` over selected
  `character_sheet`.

### CLI Tests

- `generation context` works for both cast purposes.
- `generation model list` works for both cast purposes.
- `generation spec create`, `estimate`, and `run --simulate` work for
  `cast.character-sheet`.
- `generation spec create`, `estimate`, and `run --simulate` work for
  `cast.profile`.
- `media import` works for both cast purposes.
- unsupported purpose errors remain structured and clear.

## Verification

Run focused checks:

```bash
pnpm build:core
pnpm test:core
pnpm build:engines
pnpm test:engines
pnpm build:cli
pnpm test:cli
```

Then run the workspace check:

```bash
pnpm check
```

## Completeness Checklist

### Contracts

- [x] Add `cast.character-sheet` and `cast.profile` purpose constants.
- [x] Add cast generation target contracts.
- [x] Add cast character sheet context/spec/model contracts.
- [x] Add cast profile context/spec/model contracts.
- [x] Widen media generation spec/run records to support all current purposes.
- [x] Export new browser-safe contracts through current package entrypoints.

### Core Character Sheet Slice

- [x] Add `packages/core/src/server/media-generation/cast-character-sheet.ts`.
- [x] Build factual character sheet context.
- [x] Require active Lookbook with a structured error.
- [x] List character sheet model choices.
- [x] Validate character sheet specs.
- [x] Build GPT Image 2 payloads.
- [x] Build Nano Banana 2 payloads.
- [x] Build Grok Imagine payloads.
- [x] Estimate and run persisted character sheet specs.
- [x] Record character sheet generation runs.
- [x] Import character sheet media as cast assets.

### Core Profile Slice

- [x] Add `packages/core/src/server/media-generation/cast-profile.ts`.
- [x] Build factual profile context.
- [x] Return `recommendedSourceAssetId` when a selected sheet exists.
- [x] List profile model choices.
- [x] Validate profile specs.
- [x] Build profile text-to-image payloads.
- [x] Build profile edit payloads with logical file inputs.
- [x] Estimate and run persisted profile specs.
- [x] Record profile generation runs.
- [x] Import profile media as cast assets.
- [x] Update cast overview image preference for selected profile images.

### Engines

- [x] Extend generation file input contracts.
- [x] Build deterministic logical file input URIs for estimate.
- [x] Resolve project-relative file inputs for run.
- [x] Upload file inputs through provider adapter upload hooks.
- [x] Validate resolved provider payloads before invocation.
- [x] Keep approval tokens tied to logical requests.
- [x] Add engine tests for estimate, simulated run, and upload resolution.

### CLI

- [x] Parse `cast:<id>` generation targets.
- [x] Dispatch `generation context` for both cast purposes.
- [x] Dispatch `generation model list` for both cast purposes.
- [x] Dispatch spec validate/create/update/show/list by spec purpose.
- [x] Dispatch estimate and run by stored spec purpose.
- [x] Dispatch `media import` for both cast purposes.
- [x] Emit Studio resource refresh events for cast imports.

### Skill And Docs

- [x] Update media-producer `SKILL.md`.
- [x] Add `references/cast-character-sheet.md`.
- [x] Add `references/cast-profile.md`.
- [x] Add sample cast character sheet spec JSON.
- [x] Add sample cast profile spec JSON.
- [x] Update future purpose sketches.
- [x] Update media generation architecture reference.
- [x] Update project files/assets reference.
- [x] Update domain vocabulary if `Cast Profile` needs an explicit entry.

### Tests And Verification

- [x] Add core context tests.
- [x] Add core spec and provider payload tests.
- [x] Add cast import tests.
- [x] Add cast overview profile preference test.
- [x] Add CLI end-to-end tests.
- [x] Run `pnpm build:core`.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm build:engines`.
- [x] Run `pnpm test:engines`.
- [x] Run `pnpm build:cli`.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm check`.
