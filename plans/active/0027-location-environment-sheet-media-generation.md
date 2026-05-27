# 0027 Location Environment Sheet Media Generation

Date: 2026-05-27

Status: implemented

## Goal

Add location image generation to the persisted media generation system.

The new media purpose is:

```text
location.environment-sheet
```

This purpose generates one composite image for a location. The composite image
contains four azimuth views of the same location:

```text
0   = front
90  = right
180 = back
270 = left
```

The generated composite must also include a bottom guideline strip that applies
the active Lookbook's texture and lighting direction to the location. After the
provider returns the composite image, Renku should keep the composite as the
primary paid generation result, then derive four generous azimuth crops from it
through a tolerant post-processing step. The derived crops should preserve as
much useful image information as possible, even when the model shifts or softens
the intended grid.

The implementation should follow the current cast image pattern:

- core builds factual purpose context;
- the media-producer skill writes a persisted generation spec;
- core validates the spec and maps it to a provider payload;
- engines validates the final provider payload against the real model JSON
  Schema before estimate and run;
- generation creates staged outputs;
- reusable image post-processing derives four staged azimuth views from the
  generated sheet when a four-panel structure can be found;
- media import attaches the composite and the four views to the location in one
  grouped asset afterward.

This should be the fourth concrete media generation slice. It should not
introduce a generic media-purpose framework.

## References Reviewed

- `plans/active/0026-cast-profile-and-character-sheet-media-generation.md`
- `plans/active/0025-generation-options-and-persisted-specs.md`
- `plans/active/0024-media-generation-definitions-and-engine-contract.md`
- `plans/active/0015-screenplay-cast-location-database-schema.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/workflow.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/cast-character-sheet.md`
- `packages/core/src/client/media-generation.ts`
- `packages/core/src/server/media-generation/lookbook-image.ts`
- `packages/core/src/server/media-generation/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/cast-profile.ts`
- `packages/core/src/server/media-generation/cast-image-common.ts`
- `packages/core/src/server/schema/assets.ts`
- `packages/core/src/server/schema/locations.ts`
- `packages/core/src/server/schema/media-generation.ts`
- `packages/core/src/server/database/access/asset-relationships/index.ts`
- `packages/core/src/server/resources/screenplay-ui.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/media-command.ts`
- `packages/studio/server/routes/assets.ts`
- `packages/studio/src/features/movie-studio/locations/location-panel.tsx`
- `packages/studio/src/features/movie-studio/cast/cast-member-visual-content-tab.tsx`

## Required Direction

- Keep generation and media import separate.
- Persist every generation spec before estimate or run.
- Treat user-selected model, seed, view frame, detail, output format, prompt,
  title, and source intent as binding.
- Generate exactly one provider image per run for this purpose. The four
  azimuth views are extracted from that one image.
- Do not blindly crop arbitrary generated grids. Automatic extraction should
  use a reusable tolerant sheet-extraction utility that detects the returned
  layout, produces generous crops, records extraction confidence, and preserves
  the composite even when extraction is imperfect.
- Require an active Lookbook because the output must apply the current visual
  language.
- Include screenplay overview, historical basis, research source fields, scene
  usage, target location information, existing location assets, and active
  Lookbook context in the generation context.
- Keep provider/model choices as plain TypeScript in the concrete purpose file.
- Use provider JSON Schemas only to validate final provider payloads.
- Do not expose raw provider parameters to users.
- Do not add compatibility aliases for explored or obsolete purpose names.
- Do not add a generic media-purpose registry, model capability YAML, schema
  overlays, adapter framework, or plugin-style purpose layer.
- Do not build the full Studio location asset UI in this slice. The UI for
  location overview and location details will be planned in the next iteration.

## Non Goals

This plan does not cover:

- location asset galleries in the Studio UI;
- location generation buttons or forms in the Studio UI;
- shot setup, shot planning, or camera blocking UI;
- scene image generation;
- generic continuity-reference generation for props, vehicles, symbols, or
  groups;
- historical research acquisition from the web;
- provider-side multi-image generation for the four angles;
- strict production-grade image registration. These azimuth images are
  reference inputs for later environment/world generation, so preserving visual
  information matters more than exact crop coordinates.

## Vocabulary

Add these terms to the current domain vocabulary if the implementation needs
the shared wording documented:

| Term                       | Meaning                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Location Environment Sheet | A grouped location image asset containing one composite sheet and four extracted azimuth view files.                                       |
| Azimuth View               | One direction-specific location image extracted from a Location Environment Sheet. The supported azimuths are 0, 90, 180, and 270 degrees. |

Use `environment_sheet` for the location asset relationship role. It is more
specific than the old broad continuity-reference role `sheet`, and it describes
the location-specific purpose without hiding the asset under a generic
"reference" label.

## Public Contract

### Purpose Key And Target

Supported purpose keys after this plan:

```text
lookbook.image
cast.character-sheet
cast.profile
location.environment-sheet
```

CLI target format for the location purpose:

```text
location:<location-id>
```

Core target shape:

```ts
{
  kind: "location";
  id: string;
}
```

The CLI parser may translate `location:<id>` to the core target shape directly.
Do not introduce a shared target registry.

### Output Contract

One generation run produces:

- one provider-generated composite sheet;
- four derived image files extracted from the composite sheet when a usable
  four-panel structure can be identified:
  - `azimuth_000`
  - `azimuth_090`
  - `azimuth_180`
  - `azimuth_270`

The composite sheet is a working design reference. The four extracted azimuth files
are the useful continuity inputs for later shot and location setup work.

The composite is never discarded solely because extraction confidence is low.
Extraction failures should mean "Renku could not safely derive four azimuth
files from this paid image," not "the generation has no value." Generation run
records should keep the composite and diagnostics even when media import cannot
yet create a complete grouped location asset.

The azimuth mapping is fixed:

| Azimuth | Direction Label | Asset File Role |
| ------- | --------------- | --------------- |
| 0       | front           | `azimuth_000`   |
| 90      | right           | `azimuth_090`   |
| 180     | back            | `azimuth_180`   |
| 270     | left            | `azimuth_270`   |

Do not infer the azimuth from filename text during reads. The relationship
between sheet, azimuth, and file belongs in SQLite.

Each derived azimuth view should also carry extraction metadata in the grouped
sheet records:

- extraction method;
- extraction confidence;
- crop rectangle in source-composite pixel coordinates;
- diagnostics or warnings when the crop is estimated.

### Location Environment Sheet Import Contract

`location.environment-sheet` imports one grouped asset:

```text
asset.type       = location_environment_sheet
asset.mediaKind  = image
location_asset.role = environment_sheet
```

The grouped asset has five image files:

```text
asset_file.role = composite
asset_file.role = azimuth_000
asset_file.role = azimuth_090
asset_file.role = azimuth_180
asset_file.role = azimuth_270
```

Destination folder:

```text
locations/<location-handle>/environment-sheets/<sheet-slug>/
  composite.<ext>
  azimuth-000.<ext>
  azimuth-090.<ext>
  azimuth-180.<ext>
  azimuth-270.<ext>
```

Folder names are readable project storage only. The location relationship and
the view grouping are stored in SQLite. Runtime code must not infer ownership,
azimuth, selection state, or grouping from the path.

## Persistence

### Existing Tables To Reuse

Reuse these current tables:

```text
asset
asset_file
location_asset
media_generation_spec
media_generation_run
```

`media_generation_spec` and `media_generation_run` remain sufficient for the
saved generation choices and execution record.

`asset`, `asset_file`, and `location_asset` remain the asset graph entrypoint
used by the CLI, server routes, and Studio asset APIs.

### New Grouping Tables

Add purpose-specific grouping tables so later location setup code can ask for
the four views without parsing asset file roles or paths.

```text
location_environment_sheet
  id text primary key
  location_id text not null references location(id)
  asset_id text not null references asset(id)
  composite_file_id text not null references asset_file(id)
  layout_template text not null
  view_frame text not null
  sheet_frame text not null
  grid_layout text not null
  extraction_confidence text not null
  extraction_method text not null
  extraction_diagnostics_json text
  created_at text not null
  updated_at text not null
```

Indexes and constraints:

```text
unique(asset_id)
index(location_id, created_at, id)
```

```text
location_environment_sheet_view
  id text primary key
  sheet_id text not null references location_environment_sheet(id)
  azimuth_degrees integer not null
  asset_file_id text not null references asset_file(id)
  crop_x integer not null
  crop_y integer not null
  crop_width integer not null
  crop_height integer not null
  extraction_confidence text not null
  extraction_method text not null
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Indexes and constraints:

```text
unique(sheet_id, azimuth_degrees)
index(sheet_id, sort_order, id)
```

Allowed `azimuth_degrees` values:

```text
0, 90, 180, 270
```

Allowed `grid_layout` values:

```text
two_by_two
four_by_one
```

Allowed `layout_template` values:

```text
four_azimuth_sheet_v1
```

Allowed `extraction_confidence` values:

```text
high
medium
low
```

Allowed `extraction_method` values:

```text
template_scaled
fiducial_markers
grid_separators
rough_quadrants
provided_slices
```

`provided_slices` is for imports that use already-staged azimuth files from a
generation run instead of re-extracting from the composite. It is not a
compatibility alias and should not be used to bypass missing slice data.

Allowed `view_frame` values:

```text
1:1
3:4
4:3
16:9
9:16
21:9
```

Allowed `sheet_frame` values:

```text
1:1
4:5
4:3
16:9
21:9
```

Use Drizzle Kit for this schema change:

1. edit the Drizzle TypeScript schema;
2. generate SQL with Drizzle Kit from `packages/core`;
3. include generated SQL, journal, and snapshot files;
4. increment `PROJECT_STORE_SCHEMA_GENERATION` because current runtime import
   and read paths will need the new tables;
5. set `PRAGMA user_version = 7` in the generated migration if the current
   runtime generation is still `6` when implementation starts;
6. update migration tests that assert the project database generation.

Do not hand-write a TypeScript migration registry or copy generated SQL into
runtime code.

### Entity IDs

Add entity id prefixes:

```ts
| 'location_environment_sheet'
| 'location_environment_sheet_view'
```

Do not reuse `location_asset` ids for environment sheet rows. The asset
relationship and the sheet grouping are separate concepts.

## Client Contracts

Update `packages/core/src/client/media-generation.ts`.

Add constant:

```ts
export const LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE =
  "location.environment-sheet" as const;
```

Widen unions:

```ts
export type MediaGenerationPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE
  | typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;

export type MediaGenerationTarget =
  | LookbookImageGenerationTarget
  | CastMediaGenerationTarget
  | LocationMediaGenerationTarget;

export type MediaGenerationSpec =
  | LookbookImageGenerationSpec
  | CastCharacterSheetGenerationSpec
  | CastProfileGenerationSpec
  | LocationEnvironmentSheetGenerationSpec;
```

Add location target:

```ts
export interface LocationMediaGenerationTarget {
  kind: "location";
  id: string;
}
```

Add model choices:

```ts
export type LocationEnvironmentSheetModelChoice =
  | "fal-ai/openai/gpt-image-2/edit"
  | "fal-ai/nano-banana-2/edit";
```

Add control types:

```ts
export type LocationEnvironmentViewFrame =
  | "project"
  | "1:1"
  | "3:4"
  | "4:3"
  | "16:9"
  | "9:16"
  | "21:9";

export type LocationEnvironmentSheetFrame =
  | "1:1"
  | "4:5"
  | "4:3"
  | "16:9"
  | "21:9";

export type LocationEnvironmentSheetDetail = "draft" | "standard" | "high";

export type LocationEnvironmentSheetOutputFormat = "png" | "jpeg" | "webp";
```

The user-facing control is `viewFrame`, not `sheetFrame`. The provider output
sheet frame is derived by core from `viewFrame` so the cropped azimuth views
match the movie aspect ratio when the project has one.

Add context types:

```ts
export interface LocationEnvironmentSheetGenerationContext {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  project: LocationGenerationProjectContext;
  screenplay: LocationGenerationScreenplayContext | null;
  location: Location;
  usage: LocationGenerationUsageContext;
  activeLookbook: LocationGenerationLookbookContext;
  selectedAssets: Asset[];
  environmentSheetTakes: Asset[];
  referenceAssets: Asset[];
  imageFiles: LocationGenerationAssetFileReference[];
  defaults: {
    takeCount: 1;
    seed: null;
    viewFrame: "project";
    resolvedViewFrame: LocationEnvironmentViewFrame | null;
    sheetFrame: LocationEnvironmentSheetFrame | null;
    gridLayout: "two_by_two" | "four_by_one" | null;
    detail: "standard";
    outputFormat: "png";
  };
  azimuths: Array<{
    azimuthDegrees: 0 | 90 | 180 | 270;
    direction: "front" | "right" | "back" | "left";
    fileRole: "azimuth_000" | "azimuth_090" | "azimuth_180" | "azimuth_270";
  }>;
  historicalGuardrailInputs: {
    timePeriod: string | null;
    historicalBasis: string[];
    dramatizedElements: string[];
    researchSources: string[];
    assumptionsMade: string[];
  };
  resourceKeys: string[];
}
```

Keep the context factual. It should not write prompt prose, choose a model, or
invent historical restrictions. The media-producer skill turns the facts into
prompt guardrails.

Add spec:

```ts
export interface LocationEnvironmentSheetGenerationSpec {
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  modelChoice: LocationEnvironmentSheetModelChoice;
  prompt: string;
  layoutTemplate?: "four_azimuth_sheet_v1";
  takeCount?: 1;
  seed?: number | null;
  viewFrame?: LocationEnvironmentViewFrame;
  detail?: LocationEnvironmentSheetDetail;
  outputFormat?: LocationEnvironmentSheetOutputFormat;
  title?: string;
}
```

Add model list report:

```ts
export interface LocationEnvironmentSheetModelChoiceReport {
  modelChoice: LocationEnvironmentSheetModelChoice;
  label: string;
  available: boolean;
  unavailableReason?: string;
  supportsSeed: boolean;
  takeCount: {
    min: 1;
    max: 1;
    default: 1;
  };
  supportedViewFrames: LocationEnvironmentViewFrame[];
  derivedSheetFrames: Record<string, LocationEnvironmentSheetFrame>;
  supportedDetails: LocationEnvironmentSheetDetail[];
  supportedOutputFormats: LocationEnvironmentSheetOutputFormat[];
}
```

Add import report:

```ts
export type LocationEnvironmentSheetExtractionConfidence =
  | "high"
  | "medium"
  | "low";

export type LocationEnvironmentSheetExtractionMethod =
  | "template_scaled"
  | "fiducial_markers"
  | "grid_separators"
  | "rough_quadrants"
  | "provided_slices";

export interface LocationEnvironmentSheetExtractedView {
  azimuthDegrees: 0 | 90 | 180 | 270;
  fileRole: "azimuth_000" | "azimuth_090" | "azimuth_180" | "azimuth_270";
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: LocationEnvironmentSheetExtractionConfidence;
  method: LocationEnvironmentSheetExtractionMethod;
  warnings: import("@gorenku/studio-diagnostics").DiagnosticIssue[];
}

export interface LocationEnvironmentSheetExtractionReport {
  template: "four_azimuth_sheet_v1";
  confidence: LocationEnvironmentSheetExtractionConfidence;
  method: LocationEnvironmentSheetExtractionMethod;
  diagnosticOverlayPath?: string;
  views: LocationEnvironmentSheetExtractedView[];
  warnings: import("@gorenku/studio-diagnostics").DiagnosticIssue[];
}

export interface LocationEnvironmentSheetMediaImportReport {
  valid: true;
  warnings: import("@gorenku/studio-diagnostics").DiagnosticIssue[];
  project: {
    name: string;
    id?: string;
    projectFolder?: string;
  };
  changes?: Array<{ type: string; [key: string]: string }>;
  purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE;
  target: LocationMediaGenerationTarget;
  imported: Asset;
  sheet: LocationEnvironmentSheet;
  views: LocationEnvironmentSheetView[];
  extraction: LocationEnvironmentSheetExtractionReport;
  receipt?: unknown;
  resourceKeys: string[];
}
```

If the concrete TypeScript names become too long during implementation, shorter
private helper names are fine. Public contract names should stay domain-clear.

## Core Context Builder

Add:

```text
packages/core/src/server/media-generation/location-environment-sheet.ts
```

This file owns context building, model choices, spec validation, provider
payload mapping, estimate/run preparation, purpose orchestration around
post-run extraction, run recording, and import for this purpose. Reusable image
decoding, template detection, crop-box selection, diagnostic overlay creation,
and file writing belong in `packages/core/src/server/image-processing/`, not in
the location-purpose module.

### Context Inputs

`buildLocationEnvironmentSheetContext` should gather:

- project id, project name, title, aspect ratio, logline, summary, and
  languages;
- screenplay-level context when screenplay data exists:
  - title;
  - intended audience;
  - genre and tone fields;
  - logline and summary;
  - premise overview;
  - central conflict;
  - dramatic question;
  - themes;
  - historical basis;
  - dramatized elements;
  - research sources;
  - assumptions made;
- target location:
  - id;
  - handle;
  - name;
  - time period;
  - description;
  - visual notes;
- scene usage:
  - scenes whose `setting.locationIds` includes the target location;
  - scenes whose action/dialogue blocks reference the target location;
  - scene title, setting, story function, and compact block excerpts when
    useful;
- active Lookbook:
  - the Lookbook document;
  - the card image when available;
  - image file reference for the card image when available;
- selected location assets;
- existing environment sheet takes;
- selected reference and anti-reference assets;
- project-relative and absolute paths for relevant image files;
- defaults for take count, seed, view frame, derived sheet frame, detail, and
  output format;
- resource keys for the location asset and location surface.

### Active Lookbook Rule

`location.environment-sheet` requires an active Lookbook.

If no active Lookbook exists, fail fast with a structured `PROJECT_DATA...`
error. The suggestion should tell the caller to create or set an active Lookbook
before generating location environment sheets.

### Location Existence Rule

The target location must exist in the screenplay location list.

If the target is missing, fail fast with a structured `PROJECT_DATA...` error.
The message should be useful to an agent, for example:

```text
Location environment sheet generation requires a screenplay location, but the
requested location was not found: <id>.
```

The suggestion should make the next action clear:

```text
Add the historical location to the screenplay locations list, including its
time period and visual notes, then generate the location environment sheet.
```

The media-producer skill must not invent an unlisted historical location and
generate against free text. The user or agent should add a Location first, then
generate against that durable Location id.

### Historical Context Rule

Core returns historical facts, but the skill writes the actual prompt
guardrails.

The context should make these fields easy for the skill to inspect:

```ts
historicalGuardrailInputs: {
  timePeriod: string | null;
  historicalBasis: string[];
  dramatizedElements: string[];
  researchSources: string[];
  assumptionsMade: string[];
}
```

If a project is historical and the target location lacks `timePeriod`, the first
implementation should warn in the context rather than fail. A location can still
be generated from its description, scene usage, and screenplay historical
basis. The skill should ask the user to improve the location only when the
missing period would materially change the output.

## Generation Specs

### Spec Shape

```json
{
  "purpose": "location.environment-sheet",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "modelChoice": "fal-ai/nano-banana-2/edit",
  "prompt": "A location environment sheet for the Constantinople sea walls...",
  "layoutTemplate": "four_azimuth_sheet_v1",
  "takeCount": 1,
  "seed": null,
  "viewFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Constantinople sea walls environment sheet"
}
```

Rules:

- `purpose` must be `location.environment-sheet`.
- `target.kind` must be `location`.
- target location must exist.
- active Lookbook must exist.
- `prompt` must be non-empty after trimming.
- `layoutTemplate` defaults to `four_azimuth_sheet_v1`.
- `layoutTemplate` must be `four_azimuth_sheet_v1` in this slice.
- `takeCount` defaults to `1`.
- `takeCount` must be exactly `1`.
- `seed` defaults to `null`.
- `viewFrame` defaults to `project`.
- `viewFrame: "project"` requires a supported project aspect ratio.
- derived `sheetFrame` must be supported by the chosen model.
- `detail` defaults to `standard`.
- `outputFormat` defaults to `png`.
- model-specific validation may reject a supported product option when the
  selected model cannot execute it.

### Binding Fields

Once selected by the user, the media-producer skill and CLI must treat these
fields as binding:

- `modelChoice`
- `layoutTemplate`
- `seed`
- `viewFrame`
- `detail`
- `outputFormat`
- `prompt`
- `title`

`takeCount` is always `1` for this purpose.

## Model Choices And Payload Mapping

Keep model choices in constants inside:

```text
packages/core/src/server/media-generation/location-environment-sheet.ts
```

Supported model choices:

```text
fal-ai/openai/gpt-image-2/edit
fal-ai/nano-banana-2/edit
```

Preferred creative guidance:

- GPT Image 2 and Nano Banana 2 are the primary model families for location
  environment sheets.
- Use the edit endpoints in the first implementation so core can provide a
  deterministic layout template as a source image. This keeps the generation a
  single provider image while giving the model a concrete sheet structure to
  preserve.
- Do not include Grok Imagine in this first location slice because the four-view
  sheet needs strong composition control and template-guided extraction.

### Sheet Layout Derivation

Core derives the provider sheet frame from the intended azimuth view frame.

The default `viewFrame` is `project`. When `project.aspectRatio` is present,
the four sliced location images should match that aspect ratio.

Use this first-slice derivation table:

| Resolved View Frame | Grid Layout   | Derived Sheet Frame |
| ------------------- | ------------- | ------------------- |
| `21:9`              | `two_by_two`  | `16:9`              |
| `16:9`              | `two_by_two`  | `4:3`               |
| `4:3`               | `two_by_two`  | `1:1`               |
| `1:1`               | `two_by_two`  | `4:5`               |
| `3:4`               | `four_by_one` | `21:9`              |
| `9:16`              | `four_by_one` | `16:9`              |

Why this works:

- landscape and square location views fit naturally as a two-by-two grid with a
  bottom guideline strip;
- portrait location views fit better as a four-up row with a bottom guideline
  strip;
- the cropped view cells can preserve the requested aspect ratio while the
  overall sheet remains in a provider-supported frame.

### Template-Guided Generation

`sharp` should not be used to guess panel positions from an unconstrained image
with fixed coordinates. It should be used by a reusable image-processing
utility to decode the generated image, inspect pixels, make generous crop
decisions, write derived files, and create a diagnostic overlay.

Core should create a deterministic source template for every location
environment sheet run:

```text
.renku/tmp/generation/<spec-id>/four-azimuth-sheet-v1.png
.renku/tmp/generation/<spec-id>/four-azimuth-sheet-v1-mask.png
.renku/tmp/generation/<spec-id>/four-azimuth-sheet-v1-layout.json
```

The template should contain:

- four empty view cells at exact crop coordinates;
- high-contrast gutters and outer borders;
- small fiducial markers outside the crop areas;
- compact angle labels outside or on the edge of each crop area;
- a dedicated bottom guideline strip;
- enough blank interior area for the edit model to paint the location views.

The mask should mark only the view-cell interiors as editable when the selected
provider endpoint supports masked editing. The gutters, labels, fiducial
markers, and bottom strip frame should be left unmasked so the edit model has a
strong chance of preserving the sheet structure.

The layout JSON is deterministic metadata for post-processing. It should include
the expected sheet dimensions, panel rectangles, marker positions, guideline
strip rectangle, grid layout, resolved view frame, and crop-safety margins. It
is an implementation artifact, not a public project asset.

The provider prompt should instruct the edit model to preserve the template
geometry, gutters, markers, labels, and bottom strip placement while filling the
four cells with the requested location views. The prompt should not ask the
model to invent its own grid.

The template is not a project asset. It is a deterministic generation input
derived from the persisted spec. Estimate should use the logical input URI for
that template, and run should regenerate or reuse the same project-local
template before invoking the provider.

Automatic extraction is best-effort and tolerant. The returned image does not need
to match the template exactly. The extractor should classify confidence and
prefer generous crops that preserve visual information. If the output still
resembles the requested four-view sheet, even with softened separators or mild
panel drift, core should create derived azimuth files and mark the extraction as
`high`, `medium`, or `low` confidence. Core should avoid slices only when it
cannot find four meaningful regions without creating misleading azimuth files.

### GPT Image 2 Mapping

GPT Image 2 should use explicit dimensions for this purpose rather than only
the preset image-size names used in earlier slices.

Payload:

```ts
{
  prompt: spec.prompt,
  image_urls: [layoutTemplateFile],
  mask_url: layoutTemplateMaskFile,
  num_images: 1,
  image_size: mappedExplicitSheetSize,
  quality: mappedQuality,
  output_format: spec.outputFormat,
  sync_mode: false,
}
```

Rules:

- reject `seed !== null`;
- reject `takeCount !== 1`;
- map `detail` to `quality`:
  - `draft` -> `low`
  - `standard` -> `medium`
  - `high` -> `high`
- choose explicit dimensions that are multiples of 16 and validate against the
  GPT Image 2 catalog schema;
- support the derived sheet frames in this slice, including `21:9`, as long as
  the explicit dimensions validate against the model schema.
- use the generated layout template as a logical `image_urls` file input;
- use the generated mask when the catalog schema supports `mask_url`, so only
  the four view-cell interiors are editable.

### Nano Banana 2 Mapping

Payload:

```ts
{
  prompt: spec.prompt,
  image_urls: [layoutTemplateFile],
  num_images: 1,
  seed: spec.seed,
  aspect_ratio: derivedSheetFrame,
  resolution: mappedResolution,
  output_format: spec.outputFormat,
  safety_tolerance: '4',
  limit_generations: true,
  enable_web_search: false,
  sync_mode: false,
}
```

Rules:

- reject `takeCount !== 1`;
- support seed;
- map `detail` to `resolution`:
  - `draft` -> `1K`
  - `standard` -> `2K`
  - `high` -> `4K`
- support the derived sheet frames from the table above;
- keep `enable_web_search: false` because the purpose context and prompt carry
  the project-approved research signals.
- use the generated layout template as a logical `image_urls` file input.
- do not assume provider-side masked editing for Nano Banana 2 unless the
  catalog schema explicitly grows a mask field later. The post-processing path
  must remain tolerant because this endpoint may preserve the template only by
  instruction-following.

## Reusable Sheet Extraction Utility

Sheet extraction is reusable image post-processing in core. It should not live
inside the engines runner, and it should not be a one-off private helper in the
location media purpose.

Add a deliberate reusable image-processing folder:

```text
packages/core/src/server/image-processing/
  sheet-extraction.ts
  sheet-template.ts
  crop-geometry.ts
  diagnostic-overlays.ts
```

This folder owns general utilities for template metadata, marker/grid
detection, generous crop-box selection, image decoding, cropping, and diagnostic
overlay writing. The location environment sheet module provides the
purpose-specific azimuth labels, layout template metadata, and output naming.

Use `sharp` as an explicit dependency of `@gorenku/studio-core`. The user will
install `sharp` before implementation begins, so this implementation slice
should verify the dependency is present rather than run package installation
itself.

### Extraction Inputs

The reusable extractor needs:

- absolute path to the composite image;
- expected layout metadata from `four-azimuth-sheet-v1-layout.json`;
- optional absolute path to the original layout template image;
- output folder;
- output format;
- resolved view frame;
- derived sheet frame;
- grid layout;
- crop policy.

The crop policy for location environment sheets should be intentionally
generous:

- preserve full panel content over tight cropping;
- allow a small amount of gutter, border, or label edge if that prevents losing
  location detail;
- avoid including large portions of neighboring azimuth views;
- never include the bottom Lookbook guideline strip inside an azimuth view when
  a grid boundary can be inferred;
- prefer a useful estimated crop over rejecting a paid generation for mild
  layout drift.

### Extraction Ladder

The extractor should try increasingly tolerant strategies. Each strategy returns
candidate crop rectangles, confidence, method, and diagnostics.

1. `template_scaled`

   Scale the expected layout metadata to the returned image size. This is the
   preferred path when masked editing preserves the template well.

2. `fiducial_markers`

   Search broad windows around expected marker locations. Use detected markers
   to estimate translation and scale, then transform the expected panel
   rectangles.

3. `grid_separators`

   Search for likely vertical and horizontal gutters by scanning contrast and
   edge strength near expected separator regions. This handles softened,
   shifted, or partially repainted borders.

4. `rough_quadrants`

   If the returned image still clearly resembles a two-by-two or four-by-one
   sheet, split the inferred grid area into generous quadrants or columns. This
   is acceptable for this purpose because the slices are reference inputs for a
   later world model, not final production frames.

5. no slices

   Use this only when the image no longer contains four meaningful regions. Keep
   the composite and return structured diagnostics explaining why azimuth views
   could not be derived.

### Two-By-Two Layout

For `two_by_two`:

```text
top-left     = azimuth 0
top-right    = azimuth 90
bottom-left  = azimuth 180
bottom-right = azimuth 270
bottom strip = Lookbook texture and lighting guideline
```

The expected geometry from the template is only the starting point. The final
crop boxes should come from the extraction ladder and should be expanded by the
configured safety margin before writing files.

### Four-By-One Layout

For `four_by_one`:

```text
column 1     = azimuth 0
column 2     = azimuth 90
column 3     = azimuth 180
column 4     = azimuth 270
bottom strip = Lookbook texture and lighting guideline
```

The expected geometry from the template is only the starting point. The final
crop boxes should come from the extraction ladder and should be expanded by the
configured safety margin before writing files.

### Extraction Diagnostics

The extractor should return a report rather than a simple pass/fail result:

```ts
interface SheetExtractionReport {
  template: "four_azimuth_sheet_v1";
  confidence: "high" | "medium" | "low";
  method:
    | "template_scaled"
    | "fiducial_markers"
    | "grid_separators"
    | "rough_quadrants";
  diagnosticOverlayPath?: string;
  crops: Array<{
    role: string;
    crop: { x: number; y: number; width: number; height: number };
    confidence: "high" | "medium" | "low";
    warnings: import("@gorenku/studio-diagnostics").DiagnosticIssue[];
  }>;
  warnings: import("@gorenku/studio-diagnostics").DiagnosticIssue[];
}
```

The diagnostic overlay should be a local image that draws the selected crop
rectangles over the composite. It is not a model generation and should not be
imported as a project asset by default.

### Extraction Errors

Fail fast with a structured error when:

- the composite file is missing;
- the composite file is not an image;
- the crop geometry would produce a zero-size image;
- the output format is unsupported;
- the extractor cannot find four meaningful regions and the caller requires a
  complete grouped location asset.

Do not fail merely because:

- the returned image dimensions differ from the requested template dimensions;
- a marker is shifted or repainted;
- a gutter is softened;
- a panel has mild drift;
- the best crop includes a little border or gutter.

Those cases should become warnings and confidence metadata.

### Staged Run Outputs

`runLocationEnvironmentSheetSpec` should:

1. estimate the persisted spec;
2. run generation through engines;
3. persist the provider composite output under `generated/media/`;
4. run tolerant sheet extraction against the returned composite;
5. write four staged azimuth images under `generated/media/` when the extractor
   finds four meaningful regions;
6. write a local diagnostic overlay when useful;
7. record the generation run with the composite, extraction report, diagnostic
   overlay path, and any extracted files in `outputs_json`.

Example staged output names:

```text
generated/media/constantinople-sea-walls-environment-sheet.png
generated/media/constantinople-sea-walls-environment-sheet-azimuth-000.png
generated/media/constantinople-sea-walls-environment-sheet-azimuth-090.png
generated/media/constantinople-sea-walls-environment-sheet-azimuth-180.png
generated/media/constantinople-sea-walls-environment-sheet-azimuth-270.png
```

`outputs_json` can remain purpose-specific JSON for now. Do not add a generic
media-generation output table. The run should still be valid when it has a
composite and diagnostics but no derived slices; import into a grouped
`location_environment_sheet` asset may require rerunning extraction, providing
manual slices, or regenerating.

## Media Import

Add:

```ts
importLocationEnvironmentSheetMedia(...)
```

Import should work for both:

- a generated composite with a generation run receipt;
- a manually supplied project-relative composite image.

### Import Steps

1. Parse `--purpose` and `--target` in CLI.
2. Validate target location exists.
3. Normalize and resolve the project-relative source path.
4. Fail if the source path is outside the project or not a file.
5. Infer view frame, sheet frame, layout, and template version from the
   generation receipt when a receipt is supplied.
6. If no usable receipt is supplied, infer `viewFrame: "project"` from project
   aspect ratio and use the default `four_azimuth_sheet_v1` geometry.
7. Use staged azimuth files from the generation receipt when all four are
   present and valid.
8. Otherwise, run the reusable tolerant sheet extractor against the source
   composite.
9. Create generous azimuth crops when the extractor finds four meaningful
   regions, even if confidence is `medium` or `low`.
10. Fail import with a structured error only when a complete grouped location
    asset cannot be created because four meaningful regions cannot be found. The
    original composite remains available as the generated run output; the import
    failure must not discard it.
11. Allocate a unique destination folder under:

```text
locations/<location-handle>/environment-sheets/<sheet-slug>/
```

12. Copy the composite and the four extracted files.
13. Hash every file.
14. Read image width and height for every file.
15. Insert one `asset` row.
16. Insert five `asset_file` rows.
17. Insert one `location_asset` row with role `environment_sheet`.
18. Insert one `location_environment_sheet` row with extraction summary
    metadata.
19. Insert four `location_environment_sheet_view` rows with azimuth, crop, and
    extraction metadata.
20. Return the imported `Asset`, sheet row, view rows, extraction report, and
    resource keys.
21. Emit location resource keys.

Resource keys:

```text
assets:location:<location-id>
surface:location:<location-id>
```

### Import Command

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --source generated/media/<file> \
  --title "Constantinople sea walls environment sheet" \
  --summary "Four azimuth views for the sea walls location." \
  --receipt <generation-run-json> \
  --json
```

The CLI remains a thin adapter. It should not know destination folders, file
roles, extraction behavior, asset type, relationship role, or grouping tables
beyond direct purpose dispatch.

## Location Overview Image Preference

Full Studio UI work is deferred, but the existing location overview and detail
surfaces already show a first image when a location has one.

Update the core projection so a selected `environment_sheet` asset can provide
the location's first image.

Preferred first image order for locations:

1. selected `environment_sheet` image, using `azimuth_000` when present;
2. any selected image;
3. first available image take.

This is a projection rule only. It must not change asset selection state.

## CLI Shape

Keep the current generic command names.

### Context And Model List

Add direct switches:

```bash
renku generation context \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --json

renku generation model list \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --json
```

### Spec Commands

Spec commands should parse the JSON file or stored spec, read `purpose`, and
dispatch directly:

```bash
renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json
renku generation spec list --purpose location.environment-sheet --target location:<location-id> --json
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
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --source generated/media/<file> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Update unsupported-purpose messages so they mention the new purpose.

## Project Data Service

Extend `ProjectDataService` with concrete methods:

```ts
buildLocationEnvironmentSheetContext(...)
listLocationEnvironmentSheetModels(...)
validateLocationEnvironmentSheetSpec(...)
createLocationEnvironmentSheetSpec(...)
updateLocationEnvironmentSheetSpec(...)
readLocationEnvironmentSheetSpec(...)
listLocationEnvironmentSheetSpecs(...)
prepareLocationEnvironmentSheetSpec(...)
estimateLocationEnvironmentSheetSpec(...)
runLocationEnvironmentSheetSpec(...)
recordLocationEnvironmentSheetRun(...)
importLocationEnvironmentSheetMedia(...)
```

Wire those methods through:

```text
packages/core/src/server/project-data-service-wiring/media-generation.ts
```

If local private helpers remove real duplication with cast image import, keep
them private to the media-generation folder. Do not create a public generic
media-purpose import framework.

## Media Producer Skill

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md
```

Add progressive disclosure files:

```text
references/location-environment-sheet.md
samples/location-environment-sheet-spec.json
```

Update `references/future-purpose-sketches.md` only if it mentions location
generation as future work.

### Skill Workflow Additions

The skill should say:

1. read location environment sheet context first;
2. list purpose-specific model choices;
3. verify the target location exists in the screenplay locations list;
4. ask the user to add a Location first when the intended historical location
   is not in the list;
5. ask for missing creative intent only when it materially changes the output;
6. create a persisted spec;
7. estimate cost;
8. run only after approval for paid generation;
9. inspect the generated composite and extracted azimuth views;
10. import the finished media separately.

It must repeat the binding rule:

- do not override model choice, seed, view frame, detail, output format, prompt,
  or title after the user has selected them.

### Location Prompting Guidance

The location reference should teach the agent to use:

- screenplay overview and story function;
- target location name, description, time period, and visual notes;
- scene usage and setting signals;
- active Lookbook palette, texture, lighting, composition, and camera rules;
- selected location reference assets and anti-reference assets when available;
- research sources and historical basis when present;
- four azimuth views in one composite image:
  - front, azimuth 0;
  - right, azimuth 90;
  - back, azimuth 180;
  - left, azimuth 270;
- one bottom guideline strip showing the active Lookbook's texture and lighting
  behavior as applied to this location.

The prompt should describe the sheet layout plainly. Example instruction:

```text
Create one location environment sheet by preserving the provided template. Do
not redraw, move, merge, or resize the grid, gutters, borders, labels, or bottom
guideline strip. Fill the four view cells with consistent views of the same
location: front 0, right 90, back 180, left 270. Keep scale, entrances, wall
breaks, landmarks, materials, and horizon logic consistent between views. The
bottom strip is a visual guideline for the active Lookbook's texture and
lighting, applied to this location.
```

### Historical Guardrails

The skill must include historical guardrails in the prompt when the context is
historical.

The guardrails should come from:

- `location.timePeriod`;
- `screenplay.historicalBasis`;
- `screenplay.dramatizedElements`;
- `screenplay.researchSources`;
- `screenplay.assumptionsMade`;
- scene setting and scene usage.

The guardrails should be concrete and relevant. For example, for a location set
around the 1400s, the prompt should explicitly exclude modern or later-period
objects such as:

- telegraph poles;
- electrical wires;
- asphalt roads;
- concrete utility poles;
- cars or tire marks;
- modern signage;
- glass curtain walls;
- industrial steel streetlights;
- steam-era railway infrastructure.

The agent should not dump a generic list of every possible anachronism into all
prompts. It should choose exclusions that match the time period, geography, and
type of location.

When the context is too thin to write meaningful historical guardrails, the
skill should ask for the missing location details or suggest adding them to the
Location record. It should not silently invent historical facts.

### Quality Bar

The generated sheet should be useful for later shot setup:

- all four views must depict the same location;
- major geometry should stay consistent across angles;
- the views should reveal entrances, exits, scale, skyline or horizon, dominant
  materials, and usable camera-facing surfaces;
- lighting and texture should come from the active Lookbook, not from generic
  stock-image atmosphere;
- period-specific architecture, materials, tools, signage, and infrastructure
  must match the historical context when provided;
- the bottom guideline strip should not replace one of the four required views.
- the template geometry should remain recognizable enough for tolerant
  extraction, but slight drift, softened gutters, or imperfect panel edges are
  acceptable when the four views remain useful.

If the generated image does not provide four usable views, the agent should not
import it automatically. It should explain the issue and ask whether to
regenerate, retry extraction with manual guidance when that exists, or keep the
composite as a flawed take for review.

## Documentation Updates

Update `docs/architecture/reference/media-generation.md`:

- list `location.environment-sheet` as a current purpose;
- document target format;
- document location context behavior;
- document active Lookbook requirement;
- document spec shape;
- document model choices;
- document four-azimuth sheet behavior;
- document tolerant extraction behavior, confidence metadata, and the reusable
  image-processing utility boundary under
  `packages/core/src/server/image-processing/`;
- document import behavior;
- keep the future purpose rule against generic frameworks.

Update `docs/architecture/reference/project-files-and-assets.md`:

- define Location Environment Sheet as a location asset;
- mention generated/imported files under
  `locations/<handle>/environment-sheets/<sheet-slug>/`;
- document that the composite and four views are grouped in SQLite, not inferred
  from folders.

Update `docs/architecture/reference/domain-vocabulary.md`:

- add Location Environment Sheet;
- add Azimuth View if it helps later shot setup discussions.

Update `docs/cli/commands.md` after implementation:

- add the new generation context/model/spec/list examples;
- add the new media import example.

Add a decision document only if the team decides the location environment sheet
grouping tables are architectural enough to preserve separately. A short ADR is
reasonable if the implementation establishes a pattern for future grouped
assets, but do not block this slice on that document.

## Studio UI Boundary

Do not build the full location visual content UI in this slice.

Allowed Studio-facing work:

- keep existing location asset routes working for multi-file location assets;
- serve composite and azimuth view files through the existing asset file route;
- refresh existing location asset and location surface resource keys after CLI
  import;
- update core first-image projection for selected `environment_sheet` assets.

Deferred to the next iteration:

- Locations overview layout for environment sheets;
- Location detail visual content tab;
- controls to select, preview, delete, or compare azimuth views;
- any in-app generation workflow for locations.

When the next UI slice starts, feature code in `packages/studio` must continue
to use local shadcn-style controls from `packages/studio/src/ui`. Do not add raw
browser controls.

## Tests

### Core Context Tests

- `location.environment-sheet` context includes project title, summary, aspect
  ratio, languages, screenplay overview, target location, scene usage, active
  Lookbook, selected assets, existing sheet takes, and image file references.
- context fails with a structured error when the target location does not
  exist.
- context fails with a structured error when no active Lookbook exists.
- historical context includes time period, historical basis, dramatized
  elements, research sources, and assumptions made.
- context returns derived layout defaults from the project aspect ratio.

### Core Spec And Payload Tests

- spec rejects unsupported purpose.
- spec rejects `target.kind` other than `location`.
- spec rejects missing location.
- spec rejects no-active-Lookbook state.
- spec rejects empty prompt.
- spec rejects `takeCount` other than `1`.
- spec resolves `viewFrame: "project"` from project aspect ratio.
- spec rejects `viewFrame: "project"` when the project aspect ratio is missing
  or unsupported.
- spec defaults `layoutTemplate` to `four_azimuth_sheet_v1`.
- prepare creates a deterministic layout template input file for edit models.
- GPT Image 2 rejects seed.
- GPT Image 2 uses explicit dimensions that validate against its catalog JSON
  Schema.
- Nano Banana 2 supports seed.
- Nano Banana 2 maps the derived sheet frame to `aspect_ratio`.
- every supported provider payload validates against its catalog JSON Schema.

### Extraction Tests

- reusable sheet extraction writes exactly four files in azimuth order for
  two-by-two layouts.
- reusable sheet extraction writes exactly four files in azimuth order for
  four-by-one layouts.
- `template_scaled` extraction succeeds for a generated image that closely
  preserves `four_azimuth_sheet_v1` geometry.
- `fiducial_markers` extraction succeeds when the sheet is shifted or scaled
  slightly.
- `grid_separators` extraction succeeds when markers are altered but gutters
  remain visible.
- `rough_quadrants` extraction succeeds when the sheet is recognizable but
  separators are imperfect.
- extraction expands crop boxes enough to avoid losing panel content.
- extraction avoids including the bottom guideline strip when a grid boundary
  can be inferred.
- extraction records confidence, method, crop rectangles, warnings, and a
  diagnostic overlay path.
- extraction preserves output format where supported.
- extraction rejects missing source file.
- extraction rejects crop geometry that would produce a zero-size image.
- extraction returns structured diagnostics or structured project data errors,
  not loose package-boundary `Error` values.

Use a deterministic image fixture with visibly distinct quadrants or columns so
the test can prove that azimuth 0, 90, 180, and 270 are cropped from the
expected positions.

### Run Tests

- simulated run creates a composite output and four extracted staged outputs.
- run records composite, extracted paths, extraction confidence, crop metadata, and
  diagnostic overlay path in `outputs_json`.
- run records extraction diagnostics and keeps the composite even when the
  extractor cannot create four slices.
- run does not call import automatically.
- approval token remains tied to the provider request, not the post-processing
  slices.

### Import Tests

- import creates one `asset` row with type `location_environment_sheet`.
- import creates five `asset_file` rows with roles `composite`,
  `azimuth_000`, `azimuth_090`, `azimuth_180`, and `azimuth_270`.
- import creates one `location_asset` row with role `environment_sheet`.
- import creates one `location_environment_sheet` row.
- import creates four `location_environment_sheet_view` rows with azimuths
  `0`, `90`, `180`, and `270`.
- import copies files under
  `locations/<handle>/environment-sheets/<sheet-slug>/`.
- import stores file hashes, sizes, widths, and heights.
- import stores extraction confidence, extraction method, and crop rectangles
  for each azimuth view.
- import rejects source files outside the project.
- import rejects source composites only when the reusable extractor cannot find
  four meaningful regions and no complete staged slices are available.
- import returns location resource keys.
- deleting the grouped asset deletes or cleans up the environment sheet grouping
  rows before removing asset file records, or relies on tested cascade behavior
  generated by Drizzle.
- location overview first image prefers selected `environment_sheet` and uses
  `azimuth_000` when present.

### CLI Tests

- `generation context` works for `location.environment-sheet`.
- `generation model list` works for `location.environment-sheet`.
- `generation spec validate` works for a location environment sheet spec.
- `generation spec create`, `estimate`, and `run --simulate` work for
  `location.environment-sheet`.
- `generation spec list` works for a location target.
- `media import` works for `location.environment-sheet`.
- unsupported purpose errors remain structured and mention the supported
  purpose list.
- missing location errors are clear enough for an agent to decide to create a
  Location before retrying.

### Studio Server Tests

- existing location asset routes serve all files on an imported grouped asset.
- location asset select/unselect still works for `environment_sheet` assets.
- location asset file URLs can serve the `azimuth_000` file.
- route tests do not require new UI controls.

## Verification

Run focused checks:

```bash
pnpm build:core
pnpm test:core
pnpm build:engines
pnpm test:engines
pnpm build:cli
pnpm test:cli
pnpm build:studio
pnpm test:studio
```

Then run the workspace check:

```bash
pnpm check
```

Because the user will install `sharp` before implementation begins, also verify
that `@gorenku/studio-core` has an explicit `sharp` dependency and that the
lockfile change is intentional and reviewed.

## Completeness Checklist

### Contracts

- [x] Add `location.environment-sheet` purpose constant.
- [x] Add location generation target contract.
- [x] Add location environment sheet context contract.
- [x] Add location environment sheet spec contract.
- [x] Add location environment sheet model list contract.
- [x] Add location environment sheet import report contract.
- [x] Widen media generation purpose, target, spec, run, and model-choice
      unions.
- [x] Export new browser-safe contracts through current package entrypoints.

### Schema And Persistence

- [x] Add `location_environment_sheet` Drizzle schema.
- [x] Add `location_environment_sheet_view` Drizzle schema.
- [x] Add entity id prefixes for sheet and view rows.
- [x] Add database access functions for inserting and reading grouped location
      environment sheets.
- [x] Store extraction confidence, method, diagnostics, and crop rectangles for
      grouped environment sheets.
- [x] Update asset deletion path for grouped sheet cleanup or tested cascade
      behavior.
- [x] Generate migration with Drizzle Kit.
- [x] Increment project store schema generation if current runtime reads or
      writes require the new tables.
- [x] Update migration tests.

### Core Context

- [x] Add `packages/core/src/server/media-generation/location-environment-sheet.ts`.
- [x] Build factual location environment sheet context.
- [x] Require active Lookbook with a structured error.
- [x] Require target location with a structured error and useful suggestion.
- [x] Include screenplay overview and historical fields.
- [x] Include scene usage for the target location.
- [x] Include selected/reference location assets and image file references.
- [x] Include derived default view frame, sheet frame, grid layout, and azimuths.

### Core Spec And Provider Mapping

- [x] List location environment sheet model choices.
- [x] Validate location environment sheet specs.
- [x] Derive sheet layout from resolved view frame.
- [x] Create deterministic `four_azimuth_sheet_v1` layout template inputs.
- [x] Build GPT Image 2 payloads with explicit sheet dimensions.
- [x] Build Nano Banana 2 payloads with derived `aspect_ratio`.
- [x] Bind layout templates through logical `image_urls` input files.
- [x] Bind layout masks through `mask_url` for GPT Image 2 when supported by
      the catalog schema.
- [x] Validate provider payloads against catalog JSON Schemas.
- [x] Estimate persisted location environment sheet specs.
- [x] Run persisted location environment sheet specs.
- [x] Record location environment sheet generation runs.

### Reusable Image Extraction

- [x] Add `packages/core/src/server/image-processing/` for reusable image
      post-processing utilities.
- [x] Add reusable sheet template metadata helpers.
- [x] Add reusable tolerant sheet extraction utility.
- [x] Add reusable crop geometry helpers.
- [x] Add reusable diagnostic overlay writer.
- [x] Verify `sharp` is installed as an explicit core dependency before
      implementation begins.
- [x] Generate deterministic template image, mask image, and layout JSON for
      `four_azimuth_sheet_v1`.
- [x] Implement `template_scaled` extraction.
- [x] Implement `fiducial_markers` extraction.
- [x] Implement `grid_separators` extraction.
- [x] Implement `rough_quadrants` extraction.
- [x] Use generous crop safety margins for location environment sheets.
- [x] Store staged azimuth files under `generated/media/`.
- [x] Record composite, extracted paths, crop metadata, extraction confidence,
      extraction method, warnings, and diagnostic overlay path in `outputs_json`.
- [x] Return structured errors only for invalid files, impossible crop geometry,
      unsupported formats, or inability to derive four meaningful regions when the
      caller requires a complete grouped asset.

### Import

- [x] Import generated or manually supplied location environment sheets.
- [x] Copy composite and four azimuth files into the location environment sheet
      folder.
- [x] Insert `asset`, `asset_file`, and `location_asset` rows.
- [x] Insert `location_environment_sheet` and view rows.
- [x] Store extraction confidence, method, diagnostics, and crop rectangles in
      the grouped sheet rows.
- [x] Store size, hash, width, and height for every imported file.
- [x] Return grouped sheet information in the import report.
- [x] Emit location resource refresh keys.
- [x] Update location first-image projection preference.

### CLI

- [x] Parse `location:<id>` generation targets.
- [x] Dispatch `generation context` for `location.environment-sheet`.
- [x] Dispatch `generation model list` for `location.environment-sheet`.
- [x] Dispatch spec validate/create/update/show/list by spec purpose.
- [x] Dispatch estimate and run by stored spec purpose.
- [x] Dispatch `media import` for `location.environment-sheet`.
- [x] Update unsupported-purpose messages.
- [x] Keep CLI as a thin adapter over core.

### Skill And Docs

- [x] Update media-producer `SKILL.md`.
- [x] Add `references/location-environment-sheet.md`.
- [x] Add sample location environment sheet spec JSON.
- [x] Add historical guardrail prompting guidance.
- [x] Update future purpose sketches if needed.
- [x] Update media generation architecture reference.
- [x] Update project files/assets reference.
- [x] Update domain vocabulary.
- [x] Update CLI command docs.

### Studio Boundary

- [x] Keep existing location asset routes working for grouped multi-file assets.
- [x] Add server tests for serving location environment sheet files.
- [x] Do not build the full Studio location visual content UI in this slice.
- [x] Leave location overview/detail UI design for the next iteration.

### Tests And Verification

- [x] Add core context tests.
- [x] Add core spec and provider payload tests.
- [x] Add reusable extraction tests.
- [x] Add run recording tests.
- [x] Add import and grouping tests.
- [x] Add location first-image preference test.
- [x] Add CLI end-to-end tests.
- [x] Add Studio server asset route tests.
- [x] Run `pnpm build:core`.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm build:engines`.
- [x] Run `pnpm test:engines`.
- [x] Run `pnpm build:cli`.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm build:studio`.
- [x] Run `pnpm test:studio`.
- [x] Run `pnpm check`.
