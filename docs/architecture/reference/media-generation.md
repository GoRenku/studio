# Media Generation

Date: 2026-05-26

Status: current

Role: reference

## Purpose

This reference defines the current persisted media generation and media import
contract.

Decision history:

- `../../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

## Current Purposes

The implemented media generation purposes are:

```text
lookbook.image
cast.character-sheet
cast.profile
location.environment-sheet
scene.storyboard-sheet
```

Target formats:

```text
lookbook:<lookbook-id>
cast:<cast-member-id>
location:<location-id>
scene:<scene-id>
```

Core contract target shapes:

```ts
{
  kind: "lookbook";
  id: string;
}

{
  kind: "castMember";
  id: string;
}

{
  kind: "location";
  id: string;
}

{
  kind: "scene";
  id: string;
}
```

## Generation Commands

Current CLI surface:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation context --purpose cast.character-sheet --target cast:<id> --json
renku generation context --purpose cast.profile --target cast:<id> --json
renku generation context --purpose location.environment-sheet --target location:<id> --json
renku generation context --purpose scene.storyboard-sheet --target scene:<id> --shot-list <shot-list-id> --json

renku generation model list --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose cast.character-sheet --target cast:<id> --json
renku generation model list --purpose cast.profile --target cast:<id> --json
renku generation model list --purpose location.environment-sheet --target location:<id> --json
renku generation model list --purpose scene.storyboard-sheet --target scene:<id> --shot-list <shot-list-id> --json

renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json

renku generation spec list --purpose lookbook.image --target lookbook:<id> --json
renku generation spec list --purpose cast.character-sheet --target cast:<id> --json
renku generation spec list --purpose cast.profile --target cast:<id> --json
renku generation spec list --purpose location.environment-sheet --target location:<id> --json
renku generation spec list --purpose scene.storyboard-sheet --target scene:<id> --shot-list <shot-list-id> --json

renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --simulate --json
```

The CLI command names are generic. The implementation uses direct purpose
switching rather than a generic purpose registry.

## Lookbook Image Context

`generation context` returns factual project context. It does not choose a
model or infer provider parameters.

The context includes:

- purpose and target;
- project name, title, and aspect ratio;
- the Lookbook sections;
- source Inspiration folders;
- existing Lookbook images;
- images by Lookbook section;
- card image;
- defaults for take count, seed, image frame, detail, and output format;
- Studio resource keys.

It does not return generic model requirements, prompt instructions, provider
capability summaries, or an import contract.

## Cast Character Sheet Context

`cast.character-sheet` context is built for one cast member and requires an
active Lookbook. The context includes:

- project title, summary, aspect ratio, and languages;
- screenplay summary and major story signals when a screenplay exists;
- cast member facts such as handle, role, want, need, arc, voice notes, and
  description;
- time-period signals from screenplay history, cast-referenced scene settings,
  and referenced locations;
- the active Lookbook and its card image;
- selected cast assets and existing character sheet/profile takes;
- image file references for attached cast assets;
- defaults for take count, seed, image frame, detail, and output format.

Character sheet generation should create a full reusable design reference for
the character. It should account for the story, the character, the period, and
the active visual language. The best current model choices are:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`

## Cast Profile Context

`cast.profile` context is built for one cast member. It can run text-to-image
without a source sheet, but edit models require `sourceAssetId`.

The profile context includes the same project, screenplay, cast member,
time-period, Lookbook, and asset signals as character sheets. It also returns:

- selected character sheets;
- character sheet takes;
- profile takes;
- `recommendedSourceAssetId`, which is the selected character sheet when one is
  available;
- a square `1:1` default image frame.

Profile images should usually be generated after a character sheet exists. When
using an edit model, the generated request carries a logical `image_urls` file
input. The engine resolves that project-relative source file immediately before
provider execution.

## Location Environment Sheet Context

`location.environment-sheet` context is built for one screenplay location and
requires an active Lookbook. The target location must already exist in the
screenplay location list. When a requested historical location is missing, core
returns a structured error with a suggestion to add the Location first instead
of generating against free text.

The context includes:

- project title, summary, aspect ratio, and languages;
- screenplay overview, dramatic signals, historical basis, dramatized elements,
  research sources, and assumptions when available;
- target location name, handle, description, time period, and visual notes;
- scene usage and compact setting/action signals for scenes that use the
  location;
- the active Lookbook and its card image when available;
- selected location assets, existing environment sheet takes, reference assets,
  anti-reference assets, and image file references;
- fixed defaults for the generated sheet frame, sliced view frame, detail, and
  output format;
- the fixed view file roles: `view_front`, `view_right`, `view_back`, and
  `view_left`.

Core returns factual context only. Prompt guardrails are written by the
media-producer skill from those facts. Historical prompts should include
concrete exclusions when the context calls for them, such as avoiding telegraph
poles, electrical wires, asphalt roads, or modern signage in a 1400s setting.

The generated provider image is one composite sheet, not four provider calls.
The media-producer agent inspects that composite with vision and slices the four
scenic view images locally before import.

## Scene Storyboard Sheet Context

`scene.storyboard-sheet` context is built for one screenplay scene and one
Scene Shot List. The target scene must exist, and the shot list must belong to
that scene.

The context includes:

- project title, summary, and default aspect ratio;
- screenplay scene hierarchy, setting, story function, and ordered scene
  blocks;
- the selected Scene Shot List and its ordered shots;
- referenced cast and locations for the scene and shot list;
- active Lookbook text guidance when available;
- defaults for visualization style, take count, seed, image frame, detail, and
  output format.

The generated provider image is one composite storyboard sheet for the full
shot list, not one provider call per shot. The scene-shot-designer skill owns
the grid prompt, visual inspection, slicing, and per-shot import mapping. Core
does not store crop boxes, grid cells, extraction confidence, extraction
methods, or slicing diagnostics.

## Lookbook Image Spec

The generation spec is persisted before estimate or execution.

```json
{
  "purpose": "lookbook.image",
  "target": { "kind": "lookbook", "id": "lookbook_abc" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A horror hallway showing the Lookbook palette under dread lighting.",
  "focusSections": ["palette", "lighting"],
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Horror palette hallway"
}
```

Binding fields:

- `modelChoice`
- `takeCount`
- `seed`
- `imageFrame`
- `detail`
- `outputFormat`

Agents must not override these fields after the user selects them.

Supported model choices:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`
- `fal-ai/bytedance/seedream/v5/lite/text-to-image`

Supported image frames:

- `project`
- `1:1`
- `3:4`
- `4:3`
- `16:9`
- `9:16`
- `21:9`

Supported details:

- `draft`
- `standard`
- `high`

Supported output formats:

- `png`
- `jpeg`
- `webp`

Model-specific validation may reject a supported product option when the chosen
model cannot execute it. For example, some models reject `21:9` or seeds.

## Cast Character Sheet Spec

```json
{
  "purpose": "cast.character-sheet",
  "target": { "kind": "castMember", "id": "cast_ada" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A full character sheet for Ada, a determined investigator in late 1970s New York...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Ada character sheet"
}
```

## Cast Profile Spec

Text-to-image profile spec:

```json
{
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_ada" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A square profile portrait of Ada...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "1:1",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Ada profile"
}
```

Edit profile spec:

```json
{
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_ada" },
  "modelChoice": "fal-ai/nano-banana-2/edit",
  "sourceAssetId": "asset_character_sheet",
  "prompt": "Create a square profile portrait derived from the attached character sheet...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "1:1",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Ada profile from sheet"
}
```

Profile text-to-image models must not include `sourceAssetId`. Profile edit
models must include `sourceAssetId`, and that asset must be an image attached to
the cast member with the `character_sheet` role.

## Location Environment Sheet Spec

```json
{
  "purpose": "location.environment-sheet",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A four-view environment sheet for the Constantinople sea walls...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "viewFrame": "16:9",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Constantinople sea walls environment sheet"
}
```

Binding fields:

- `modelChoice`
- `seed`
- `sheetFrame`
- `viewFrame`
- `detail`
- `outputFormat`
- `prompt`
- `title`

`takeCount` is always `1` for this purpose.

Supported model choices:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`

Supported sheet frames:

- `4:3`

Supported sliced view frames:

- `16:9`

Location environment sheets are direct text-to-image contact sheets. Core does
not create or send a visual template, mask, fiducial markers, labeled cells, or
bottom guideline strip. Instead, the provider prompt asks for one cinematic
four-panel location sheet with panels ordered by azimuth.

### Agent-Sliced Views

Core does not crop the generated composite. After generation, the
media-producer agent uses vision to identify the four scenic image blocks in the
composite and writes local sliced files for `view_front`, `view_right`,
`view_back`, and `view_left`.

If the generated composite does not have four clean scenic view blocks, the
agent shows the composite to the user, says the generation is not good enough to
slice cleanly, and asks for regeneration instead of importing a broken grouped
asset.

## Scene Storyboard Sheet Spec

```json
{
  "purpose": "scene.storyboard-sheet",
  "target": { "kind": "scene", "id": "scene_control_room" },
  "shotListId": "scene_shot_list_control_room_v1",
  "shotIds": ["shot_001", "shot_002", "shot_003", "shot_004"],
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A complete charcoal pencil storyboard sheet laid out as a clean grid...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "shotFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Control room storyboard sheet"
}
```

Binding fields:

- `modelChoice`
- `shotListId`
- `shotIds`
- `takeCount`
- `seed`
- `sheetFrame`
- `shotFrame`
- `detail`
- `outputFormat`

`takeCount` is fixed to `1` for this purpose. `sheetFrame` is fixed to `4:3`.
`shotIds` selects one to four shots for the sheet, and `shotFrame` controls the
panel frame inside the sheet.

## Estimate And Run

Estimate and run both use the persisted spec.

The command sequence is:

1. Read the persisted spec.
2. Build current purpose context.
3. Validate the spec against that context.
4. Build the final provider payload.
5. Validate the provider payload against the model JSON Schema.
6. Estimate cost through engines.
7. Return the estimated cost and approval token for the exact request.
8. Require the approval token for live execution.

No live provider call should happen when the estimate is unknown or unapproved.
The approval token is bound to the exact generation policy and request. If the
model, prompt, parameters, bound input files, or output count change, callers
must estimate again before running.

User-facing approval should be calm and singular, such as "Generate image -
estimated $0.054" with provider details available nearby. Do not require a
second content-disclosure confirmation after the user has approved the cost.

Generation runs store:

- spec snapshot;
- provider and model;
- provider payload;
- estimate snapshot;
- approval token;
- simulation flag;
- status;
- outputs;
- diagnostics;
- start and completion timestamps.

For `location.environment-sheet`, run outputs contain the single provider
composite image. Generation does not import the asset automatically.

## Persistence

Generation specs and runs use two common tables:

```text
media_generation_spec
media_generation_run
```

`media_generation_spec.spec_json` stores editable user choices.

`media_generation_run.spec_snapshot_json` and
`media_generation_run.provider_payload_json` make each run understandable later,
even after the spec is edited.

`media_generation_run.outputs_json` stores output paths, returned seeds,
revised prompts, imported asset ids, and per-take metadata for now. Do not add a
separate output table until a concrete UI or query needs it.

Location Environment Sheet imports also use purpose-specific grouping tables:

```text
location_environment_sheet
location_environment_sheet_view
```

Those rows connect the imported composite to its four direction-specific view
files. The current import path uses agent-provided slices, so Core stores the
grouping, azimuth ownership, and display order without running image extraction
or storing crop/extraction metadata itself.

## Media Import

Import is separate from generation.

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source <project-relative-path> \
  --sections palette,lighting \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

For Lookbook Images, import registers an asset, creates the Lookbook image
relationship, stores section placement, and emits Lookbook resource keys.

For Cast Character Sheets, import registers an image asset with type
`character_sheet`, attaches it to the cast member with role `character_sheet`,
and stores the file under `cast/<handle>/character-sheets/`.

For Cast Profiles, import registers an image asset with type `cast_profile`,
attaches it to the cast member with role `profile`, and stores the file under
`cast/<handle>/profiles/`.

For Location Environment Sheets, import registers one image asset with type
`location_environment_sheet`, attaches it to the location with role
`environment_sheet`, stores the composite and four azimuth view files under
`locations/<handle>/environment-sheets/<sheet-slug>/`, and records those files
with explicit asset-file roles: `composite`, `view_front`, `view_right`,
`view_back`, and `view_left`. Import also writes the purpose-owned grouping
rows in `location_environment_sheet` and `location_environment_sheet_view` so
runtime code can read the composite-to-view relationship from SQLite instead of
inferring it from filenames.

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --file location-environment-sheet-import.json \
  --title <title> \
  --summary <one-line-summary> \
  --json
```

Location Environment Sheet import file:

```json
{
  "title": "Constantinople sea walls environment sheet",
  "files": {
    "composite": "generated/media/sea-walls-sheet.png",
    "view_front": "generated/media/sea-walls-front.png",
    "view_right": "generated/media/sea-walls-right.png",
    "view_back": "generated/media/sea-walls-back.png",
    "view_left": "generated/media/sea-walls-left.png"
  }
}
```

```bash
renku media import \
  --purpose cast.character-sheet \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json

renku media import \
  --purpose cast.profile \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Single-file imports expect a project-relative source path. Location Environment
Sheet import expects a JSON file whose `files` entries are project-relative
paths.

For generated Lookbook images, agents must inspect the generated image before
import and choose section tags based on what the image visibly demonstrates.
`focusSections` is generation intent, not placement truth.

## Future Purpose Rule

When adding the next purpose, add another concrete implementation file and
direct switch cases. Do not introduce a registry or adapter framework until
multiple concrete purposes prove that shared code would remove real complexity.

Do not add model capability YAML, schema overlays, or inferred model support.
Provider model JSON Schemas validate final payloads only.
