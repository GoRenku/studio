# 0028 Location Environment Sheet Redesign

Status: active plan

## Decision

Keep the Location Environment Sheet feature, but replace the broken
template/crop implementation.

The target product behavior is:

- one provider generation call returns one polished 2x2 sheet image;
- the sheet includes `0 front`, `90 right`, `180 back`, and `270 left` views;
- the sheet includes a bottom texture/material/lighting strip;
- the sheet is attached to the screenplay Location as one grouped asset;
- four clean scenic view files are cropped locally from the generated sheet;
- the bottom texture strip stays only in the composite sheet and is not cropped
  or imported as a separate file.

The implementation must not use provider-facing templates, masks, red marker
dots, debug overlays, feature-detection crop recovery, or a separate
content-disclosure approval.

## Ownership Boundary

This plan has three separate responsibility areas. Keep them separate in the
implementation.

### Media-Producer Skill And Agent

The skill owns the agent workflow and final creative prompt.

The skill must:

- read Renku generation context and model choices;
- create the persisted `location.environment-sheet` spec;
- write the final provider prompt itself;
- estimate cost before a paid run;
- ask only for cost approval;
- run exactly one provider generation request through Renku;
- inspect the returned composite with vision;
- identify the four scenic image blocks with vision;
- crop only those four scenic blocks;
- inspect the four slices before import;
- create an explicit five-file import JSON;
- import the grouped asset only when the composite and four slices are good.

If clean crop boxes cannot be found by looking at the composite, the skill must
tell the user that the generation is not good enough, show the composite anyway,
and ask whether to regenerate. It must not silently import the bad result.

The skill must not:

- ask the provider to preserve a template;
- mention uploaded grids, masks, marker dots, or red crop indicators;
- create multiple provider generations for one sheet;
- crop or import the bottom texture strip separately;
- use marker detection, border detection, OCR, rough quadrants, or repair
  heuristics;
- ask for a content-disclosure approval.

### Renku Core And CLI

Renku owns the product contracts, persistence, provider call, cost estimate, and
import validation.

Renku must:

- expose context for `location.environment-sheet`;
- list text-to-image models for this purpose;
- accept a direct sheet-generation spec;
- reject obsolete template fields such as `layoutTemplate`;
- estimate exactly one provider image;
- make exactly one provider request with `num_images: 1`;
- save the provider result as the composite image;
- support explicit grouped import of one composite plus four view files;
- store the imported result as one grouped Location asset;
- report failures through structured diagnostics.

Renku must not:

- generate or upload provider templates;
- generate or upload masks;
- write red marker dots or diagnostic overlays;
- keep old template readers, aliases, shims, wrappers, or compatibility layers;
- infer roles from filenames;
- run image feature detection to discover panels;
- crop view files as part of Core generation;
- preserve old crop/extraction database tables;
- ask a second user-facing content-transfer question.

The crop step belongs to the media-producer agent. Renku Core receives the
already-created view files during explicit grouped import. Do not add a Core
crop framework, facade, compatibility adapter, wrapper command, or image
processing pipeline for this purpose.

### Studio UI

Studio owns display and interaction.

Studio should:

- show the composite sheet as the primary visual artifact;
- expose individual view files when useful;
- keep labels and controls in Studio UI, not baked into cropped view files;
- use local shadcn-style controls only;
- avoid raw browser controls in feature code.

## User Flow

The intended agent flow is:

```bash
renku generation context --purpose location.environment-sheet --target location:<id> --json
renku generation model list --purpose location.environment-sheet --target location:<id> --json
renku generation spec create --file location-environment-sheet-spec.json --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
```

Then the media-producer agent:

1. Shows or inspects the returned composite.
2. Uses vision to identify the four scenic view blocks.
3. Crops `view_front`, `view_right`, `view_back`, and `view_left`.
4. Inspects the four slices.
5. Creates `location-environment-sheet-import.json`.
6. Imports the grouped asset:

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<id> \
  --file location-environment-sheet-import.json \
  --json
```

Source-only import is not valid for this purpose.

Receipt import is not part of this redesigned path. Use explicit grouped import
JSON so the agent-reviewed composite and four slices are named deliberately.
Old template/crop receipts must be rejected, not adapted.

## Approval Contract

Renku approval is cost approval only.

The estimate binds:

- provider;
- model;
- prompt;
- output count of `1`;
- generation parameters;
- estimated cost;
- approval token.

Keep only:

```ts
estimatedCostUsd
approvalToken
```

Remove these engine contract types:

```ts
GenerationApprovalSummary
GenerationExternalTransferSummary
GenerationExternalTransferDataCategory
```

Remove this field from `GenerationEstimate`:

```ts
approval
```

Allowed approval copy:

```text
Generate this location environment sheet with fal-ai/openai/gpt-image-2 for
about $0.054?
```

Forbidden approval copy:

```text
Do you approve sending prompt content to fal-ai?
Do you approve sending generation parameters to fal-ai?
Do you approve transferring bound input files?
```

## Spec Contract

Replace the template-oriented spec with a direct sheet-generation spec:

```json
{
  "purpose": "location.environment-sheet",
  "target": { "kind": "location", "id": "location_abc" },
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "prompt": "Final one-call sheet prompt written by the media-producer skill...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "viewFrame": "16:9",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Edirne test field environment sheet"
}
```

Validation rules:

- `purpose` must be `location.environment-sheet`;
- `target.kind` must be `location`;
- target Location must exist;
- active Lookbook must exist;
- `prompt` must be non-empty after trimming;
- `takeCount` must be exactly `1`;
- `seed` defaults to `null`;
- `sheetFrame` defaults to `4:3`;
- `viewFrame` defaults to `16:9`;
- `detail` defaults to `standard`;
- `outputFormat` defaults to `png`;
- `layoutTemplate` is rejected;
- provider template inputs are rejected;
- provider mask inputs are rejected.

Initial supported frames:

```text
sheetFrame = 4:3
viewFrame  = 16:9
```

## Provider Contract

Use text-to-image models for this purpose:

```text
fal-ai/openai/gpt-image-2
fal-ai/nano-banana-2
fal-ai/xai/grok-imagine-image
```

Default model:

```text
fal-ai/openai/gpt-image-2
```

Remove edit-model choices for this purpose:

```text
fal-ai/openai/gpt-image-2/edit
fal-ai/nano-banana-2/edit
```

The provider request includes:

- one prompt;
- `num_images: 1`;
- sheet-sized frame / aspect ratio;
- detail / quality;
- output format.

The provider request must not include:

- template image URL;
- mask URL;
- red marker bitmap;
- generated grid bitmap.

## Prompt Contract

The persisted spec prompt is the final provider prompt. Core executes it; Core
does not rewrite the creative prompt later.

The media-producer skill prompt must include these conceptual blocks:

```text
LOCATION CONTENT
The location, period, story, active Lookbook, materials, weather, lighting,
continuity anchors, and exclusions.

SHEET LAYOUT CONTRACT
One finished 4:3 location environment sheet. Four 16:9 scenic panels arranged
2x2. A bottom texture/material/lighting strip. Labels live only in panel header
areas or sheet margins, never inside scenic image content.

SLICE SAFETY
No red dots, crop marks, debug overlays, marker circles, construction marks,
heavy extraction borders, or labels inside the scenic panels. Keep the panel
image content clean enough to crop into standalone references.
```

Required direction labels in the sheet:

```text
0 front
90 right
180 back
270 left
```

The prompt can describe the layout in words. It must not reference an uploaded
template, mask, grid, or red marker image.

## Vision-Guided Cropping

Crop discovery is an agent/skill responsibility, not a Renku Core image
processing responsibility.

The agent looks at the returned composite and chooses four crop boxes:

```text
view_front
view_right
view_back
view_left
```

Each crop must include:

- only scenic image content;
- enough edge content to stand alone as a reference;
- no label/header text.

Each crop must exclude:

- direction labels;
- azimuth text;
- gutters;
- decorative sheet background;
- panel borders;
- red dots or debug markers if the model produced them;
- bottom texture-strip content.

If clean crop boxes cannot be found by looking at the composite:

- show the composite to the user;
- say the generation is not good enough for a location sheet;
- ask whether to regenerate;
- do not import the generated sheet;
- do not attempt recovery.

No marker detection.

No border detection.

No text detection.

No OCR.

No rough-quadrant fallback.

No diagnostic overlay.

No texture-strip crop.

No correction heuristics.

For the current Edirne Test Field composite, visual inspection found these
example crop boxes. These numbers are only an example for that specific image,
not a reusable contract:

```json
{
  "view_front": { "x": 56, "y": 96, "width": 688, "height": 374 },
  "view_right": { "x": 790, "y": 96, "width": 688, "height": 374 },
  "view_back": { "x": 56, "y": 556, "width": 688, "height": 344 },
  "view_left": { "x": 790, "y": 556, "width": 688, "height": 344 }
}
```

## File Roles And Storage

Use these direct file roles:

```text
composite
view_front
view_right
view_back
view_left
```

Generated staging paths:

```text
generated/media/<slug>-sheet.png
generated/media/<slug>-front.png
generated/media/<slug>-right.png
generated/media/<slug>-back.png
generated/media/<slug>-left.png
```

Imported project paths:

```text
locations/<location-handle>/environment-sheets/<sheet-slug>/
  composite.png
  front.png
  right.png
  back.png
  left.png
```

The composite is the first-class preview image. The four view files are reusable
references derived from the composite. The bottom texture strip is not a file
role.

Manual grouped import JSON:

```json
{
  "title": "Edirne test field environment sheet",
  "files": {
    "composite": "incoming/edirne-sheet.png",
    "view_front": "incoming/edirne-front.png",
    "view_right": "incoming/edirne-right.png",
    "view_back": "incoming/edirne-back.png",
    "view_left": "incoming/edirne-left.png"
  }
}
```

Import validation:

- all five roles are required;
- every source path must resolve inside the project;
- every source must be an image;
- duplicate source paths are rejected;
- unknown roles are structured errors;
- source-only import is rejected for this purpose.

## Database Plan

Use the existing general asset model:

- `assets`
- `asset_files`
- `asset_relationships` for the location target

Store the sheet as:

```text
asset.type       = location_environment_sheet
asset.mediaKind  = image
asset_file.role  = composite
asset_file.role  = view_front
asset_file.role  = view_right
asset_file.role  = view_back
asset_file.role  = view_left
location_asset.role = environment_sheet
```

Keep the purpose-owned grouping tables and access code:

```text
location_environment_sheet
location_environment_sheet_view
packages/core/src/server/database/access/location-environment-sheets.ts
```

The grouped import writes one `location_environment_sheet` row and four
`location_environment_sheet_view` rows after the agent provides clean view
files. Runtime code must read the composite-to-view relationship from SQLite,
not from filenames.

Remove Core image-processing code and public contracts that only support crop
recovery:

- extraction diagnostics;
- diagnostic overlay path.

Before changing schema or migrations, follow
`docs/architecture/drizzle-migrations.md` and use Drizzle Kit.

## Implementation Steps

### 1. Skill Source

Update `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer`:

- final prompt responsibility;
- one provider call;
- cost approval only;
- vision-guided crop selection;
- show bad composite and ask for regeneration when clean crops cannot be found;
- five-file grouped import JSON;
- no texture-strip crop.

### 2. Contracts

Update `packages/core/src/client/media-generation.ts`:

- keep `LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE`;
- remove `layoutTemplate`;
- add `sheetFrame`;
- keep `viewFrame` narrowed to `16:9`;
- expose file roles `composite`, `view_front`, `view_right`, `view_back`,
  `view_left`.

### 3. Provider Generation

Rewrite `packages/core/src/server/media-generation/location-environment-sheet.ts`:

- use text-to-image model choices;
- execute the persisted skill-authored prompt;
- make one provider request with `num_images: 1`;
- save the provider image as `composite`;
- estimate and charge for one provider image;
- do not generate templates, masks, markers, or overlays.
- do not crop, detect panels, or create view files in Core.

### 4. Grouped Import

Update `packages/cli/src/commands/media-command.ts` and Core import handling:

- accept explicit `--file` grouped import JSON for this purpose;
- copy five role files into the Location environment sheet folder;
- create one grouped asset with five `asset_file` rows;
- reject source-only imports for this purpose;
- reject old template/crop receipts;
- do not add compatibility aliases or adapters.

### 5. Delete Old Code

Delete the provider-template and feature-detection crop-recovery pipeline:

```text
packages/core/src/server/image-processing/sheet-layout.ts
packages/core/src/server/image-processing/sheet-extraction.ts
packages/core/src/server/image-processing/sheet-extraction.test.ts
packages/core/src/server/image-processing/diagnostic-overlays.ts
```

Delete code that:

- writes template images;
- writes mask images;
- writes red marker dots;
- detects panel borders;
- detects marker positions;
- writes diagnostic overlays;
- falls back to rough quadrants;
- stores crop metadata.

### 6. Studio UI

Update Location detail UI:

- render the composite as the primary card;
- expose individual view files when useful;
- keep labels and controls in Studio UI;
- use local shadcn-style controls only;
- avoid raw browser controls in feature code.

## Documentation Updates

Update:

```text
docs/architecture/media-generation.md
docs/architecture/reference/media-generation.md
docs/architecture/reference/project-files-and-assets.md
docs/cli/commands.md
```

Remove descriptions of:

- provider-facing four-azimuth templates;
- provider masks;
- red marker dots;
- feature-detection crop extraction;
- crop confidence;
- diagnostic overlays;
- edit models for location sheets;
- Renku content-transfer approval.

Add descriptions of:

- one model-native generated sheet;
- agent vision-guided local slicing;
- media-producer skill final prompt ownership;
- visual review gate before import;
- grouped five-file import;
- cost-only approval.

## Tests

Core tests:

- context requires an existing Location and active Lookbook;
- spec rejects missing Location;
- spec rejects missing active Lookbook;
- spec defaults to `sheetFrame: "4:3"`;
- spec defaults to `viewFrame: "16:9"`;
- spec rejects `layoutTemplate`;
- model list returns text-to-image models;
- estimate reports the price for one provider image;
- run simulation writes one composite output;
- run simulation proves only one provider request is represented;
- grouped import creates one asset with five files;
- grouped import rejects missing roles;
- grouped import rejects duplicate source files;
- grouped import rejects source paths outside the project;
- source-only location sheet import is rejected;
- old template/crop receipts are rejected.

CLI tests:

- `generation context`;
- `generation model list`;
- `generation spec create`;
- `generation estimate`;
- `generation run --simulate`;
- `media import --file`;
- structured rejection of source-only location sheet import;
- structured rejection of old `layoutTemplate` specs.

Studio tests:

- location environment sheet assets render from the composite file;
- selected sheet appears before unselected takes;
- toggling selection works on the grouped asset;
- deleting a grouped location sheet uses the existing delete confirmation flow.

## Acceptance Criteria

- One location sheet generation makes exactly one provider generation call.
- The estimate is for exactly one provider image.
- Renku approval is cost-only.
- No Renku content-disclosure approval remains.
- No provider request uses a template image.
- No provider request uses a mask image.
- No code writes red marker dots or diagnostic overlays.
- No code uses marker, border, OCR, or rough-quadrant crop recovery.
- The skill owns the final prompt and vision crop decision.
- The skill shows the composite and asks for regeneration when clean crops cannot
  be found.
- The bottom texture strip is not cropped or imported separately.
- A successful import creates one grouped Location asset with five files.
- Old template spec fields are rejected, not tolerated.
- Old template/crop receipts are rejected, not adapted.
- No fallbacks, shims, wrappers, aliases, compatibility readers, or compatibility
  import paths are added.
- Focused core, CLI, Studio, and skill checks pass.

## Cleanup After Implementation

The existing template-generated Edirne Test Field assets are not acceptable
quality. After the redesign is implemented, clean the project deliberately:

- delete the bad template-generated environment sheet assets;
- delete generated template composites and rough crops if no longer needed;
- regenerate Edirne Test Field with the new single-call sheet flow;
- select the new grouped asset.

Do not do this cleanup silently during implementation. It changes project media
and should be a deliberate command.

## Checklist

- [x] Update the source media-producer skill.
- [x] Remove Renku content-transfer approval summary from engine contracts.
- [x] Replace location sheet template spec fields with `sheetFrame` and
      `viewFrame`.
- [x] Remove provider edit models from the location environment sheet model list.
- [x] Generate exactly one sheet image from exactly one provider request.
- [x] Save that image as `composite`.
- [x] Add explicit grouped five-file import.
- [x] Reject source-only location sheet import.
- [x] Reject old template/crop receipts.
- [x] Delete template/extraction/overlay modules.
- [x] Remove crop database tables and access code.
- [x] Update asset deletion paths for the simplified asset-only model.
- [x] Update Studio location UI to render the composite sheet cleanly.
- [x] Update CLI help and architecture docs.
- [x] Replace tests for the old template/recovery behavior.
- [x] Run focused core, CLI, Studio, and skill checks.
