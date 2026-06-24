# 0084 Flexible Location Sheets

Status: implemented
Date: 2026-06-23

## Summary

Location sheets should be a flexible production reference artifact, not a
hard-coded four-direction asset model.

The current implementation assumes every Location Sheet is a rigid set of
front, right, back, and left azimuth views. That assumption leaks into the
generation context, the import JSON contract, the database schema, the shot
reference picker, take state, docs, skills, and the `urban-basilica` sample
project.

This plan removes that rigidity.

The target behavior is:

- each Location can have many Location Sheets, each describing a different
  aspect, state, mood, time, or spatial read of the Location;
- each Location can also have a current Location Hero Image, similar in spirit
  to a Cast Profile image, used for navigation and the Location detail header;
- one Location Sheet is one full image asset attached to a Location;
- every Location Sheet has a persisted user-facing description;
- Location Hero Images are their own media assets, generated or imported from
  an explicitly chosen source Location Sheet when the user wants a compact
  representative image;
- the sheet layout is authored by the Location Design, the user request, and
  the generation prompt;
- Renku stores and feeds the full sheet image as the shot reference;
- Renku does not require, create, store, expose, or select pre-sliced
  `front/right/back/left` view files;
- there is no globally selected or picked Location Sheet for a Location;
- each shot/take references the specific Location Sheet assets it needs;
- the Locations overview and Location details pages show the current Location
  Hero Image, not an arbitrary picked sheet;
- shot video generation receives the explicitly referenced full Location
  Sheets, trusting the prompt to use the relevant part of each sheet for the
  shot;
- old four-azimuth code, data shape, docs, skills guidance, generated sample
  specs, and sample slice files are removed directly, without compatibility
  readers or staged migration behavior.

The `location.environment-sheet` purpose key can remain because it names the
media purpose, not a fixed layout. User-facing copy should generally say
`Location Sheet` unless the surrounding text specifically needs the longer
production-design phrase.

## Example Requirement

The `urban-basilica` sample project exposes the problem clearly.

For `Theodosian Walls`, a useful sheet is not a four-wall rotation. It may need:

- a siege-facing front view from the Ottoman field looking toward the walls;
- an establishing aerial or drone-like flyover that shows the field in front,
  the walls, and the city beyond the walls;
- optional production-reference details such as breaches, repaired masonry,
  defenders, smoke behavior, gate scale, camp distance, wall height, or city
  depth.

Those are shot- and story-specific spatial references. They should be expressed
in the Location Design and generation prompt, not hard-coded as application
views.

The same Location should also be able to carry multiple other sheets, such as:

- the walls before bombardment;
- the walls after visible destruction;
- dawn fog and powder-smoke behavior;
- night wall repair texture;
- city-side depth beyond the wall line;
- a gate-and-breach material reference.

Shots should reference the sheet or sheets that match their need. There should
not be a single Location-level pick that all shots inherit.

The same sample should also be able to derive a Location Hero Image from one of
those sheets. For example, after generating a `Theodosian Walls siege-facing
and flyover sheet`, the user should be able to generate a wide representative
hero image for the Location overview card and detail header. That hero image is
not the selected sheet. It is a compact visual identity image for the Location.

## References Reviewed

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/cli/commands.md`
- `plans/active/0027-location-environment-sheet-media-generation.md`
- `plans/active/0028-location-environment-sheet-redesign.md`
- `plans/active/0034-location-environment-sheet-slicing-cleanup.md`
- `packages/core/src/client/location-media-generation.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/server/media-generation/cast-profile.ts`
- `packages/core/src/server/schema/assets.ts`
- `packages/core/src/server/database/access/location-environment-sheets.ts`
- `packages/core/src/server/media-generation/location-environment-sheet.ts`
- `packages/core/src/server/media-generation/dependency-slot-definitions.ts`
- `packages/core/src/server/media-generation/dependency-selectors.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-card-plans.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-sections.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection-mutations.ts`
- `packages/cli/src/commands/media-import-documents.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/studio/server/http/scene-shot-video-take-production-request.ts`
- `packages/studio/server/routes/screenplay.ts`
- `packages/studio/src/features/movie-studio/cast/cast-member-assets.ts`
- `packages/studio/src/features/movie-studio/cast/cast-overview-panel.tsx`
- `packages/studio/src/features/movie-studio/locations/location-assets.ts`
- `packages/studio/src/features/movie-studio/locations/location-panel.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-location-assets.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-location-reference-row.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-environment-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/location-environment-sheet-spec.json`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/production-designer/references/media-and-shot-list-handoff.md`
- `/Users/keremk/renku-movies/urban-basilica`

## Current Problem

The fixed-view assumption appears in several layers.

Core public contracts include:

- `LocationAzimuthViewId = 'front' | 'right' | 'back' | 'left'`;
- `LocationEnvironmentSheetFileRole = 'composite' | 'view_front' |
  'view_right' | 'view_back' | 'view_left'`;
- `LocationEnvironmentSheetGenerationContext.azimuths`;
- `LocationEnvironmentSheetGenerationSpec.viewFrame`;
- `SceneShotVideoTakeShotDesign.location.viewIds`;
- `SceneShotVideoTakeReferenceSelections.selectedLocationSheetAssetIds`;
- `SceneShotVideoTakeReferenceSelections.selectedLocationViewIds`;
- `ShotVideoTakeLocationReferenceGroup.selectedViewIds`;
- `ShotVideoTakeEnvironmentSheetReferenceChoice.views`;
- `ShotVideoTakeLocationViewReferenceChoice`.

Core persistence includes:

- `location_environment_sheet`, whose only durable value after this redesign
  would duplicate the asset relationship and one file id;
- `location_environment_sheet_view`, which exists only to store azimuth view
  files;
- `asset_file.role` values `composite`, `view_front`, `view_right`,
  `view_back`, and `view_left` for Location Sheets.

Core behavior includes:

- grouped import validation that requires all five files;
- destination filenames `composite`, `front`, `right`, `back`, and `left`;
- dependency selection that asks specifically for file role `composite`;
- diagnostics that say the selected sheet is missing special metadata;
- one-sheet-per-location behavior through `selectedLocationSheetAssetIds`;
- shot reference projections that build view choices from azimuth rows;
- take mutation code that stores selected view ids.

Studio behavior includes:

- Location details previewing all five file roles;
- Location overview cards and Location detail headers using Location Sheet
  media as the only available visual identity image, which conflates production
  reference sheets with navigation/display imagery;
- shot References UI opening a dialog to select location views;
- Studio API calls and server request parsing for
  `/reference-selections/location-views`;
- tests that assert view selection behavior.

Agent and documentation behavior includes:

- media-producer instructions to crop four scenic blocks before import;
- prompt examples that require a 2x2 layout with `0 front`, `90 right`,
  `180 back`, and `270 left`;
- import examples that require `files.view_front`, `files.view_right`,
  `files.view_back`, and `files.view_left`;
- sample project specs and generated files that preserve the same shape.

This creates three product problems:

- Some Locations need spatial references that are not directional rotations.
  The Theodosian Walls example needs a siege-facing view and a flyover
  establishing reference, not four azimuth slices.
- The shot References UI encourages the user to pick a slice even though the
  final shot prompt can use the whole sheet as a richer visual reference.
- The current "selected sheet" shape implies one preferred Location Sheet per
  Location, but a Location can need many sheet aspects: time of day, weather,
  destruction state, city side, field side, aerial context, material close
  study, or story-specific staging.

## Product Direction

### Location Sheet Meaning

A Location Sheet is a single image reference board for a Location. It may show
one view, many panels, aerial context, interior circulation, material details,
scale callouts, lighting behavior, continuity anchors, or any other authored
location reference that helps downstream shot generation.

A Location can have many Location Sheets. Each sheet should have its own title
and concise description that explains what aspect it represents, for example
`Ottoman-field siege-facing view`, `foggy dawn flyover`, `after bombardment
breach state`, or `night repair wall-top texture`.

The application must not assume the sheet contains:

- four panels;
- cardinal or azimuth directions;
- crop-safe cell boundaries;
- a bottom guideline strip;
- a fixed view aspect ratio;
- one image per direction.

Those may still appear in a prompt when the user wants them. They are content
inside a generated image, not durable app structure.

### Many Sheets Per Location

There is no canonical selected Location Sheet for a Location.

All Location Sheets attached to a Location are available references. Shot and
take workflows choose which sheets to reference for the current shot need. A
wide establishing shot might reference a flyover sheet, while a close wall
repair shot might reference a night repair texture sheet for the same Location.

The existing generic asset `select` / `pick` concept should not be used for
Location Sheets. Location Sheet relationships should remain ordinary attached
assets, ordered for browsing only. No UI should ask the user to "pick" the
Location Sheet for the Location.

### Location Hero Image

A Location Hero Image is the compact representative image for a Location. It
is the Location equivalent of a Cast Profile image: useful for overview cards,
sidebar/detail identity, and fast visual recognition, but not the production
reference sheet that shot generation should inspect for spatial detail.

Location Hero Images are separate assets from Location Sheets.

The current model should add:

- media purpose `location.hero`;
- asset type `location_hero`;
- Location asset role `hero`;
- one primary image file per hero asset;
- a required source Location Sheet asset when generating a hero from Studio or
  the CLI.

The source Location Sheet gives the generation prompt the right environment
identity, mood, and spatial facts. The resulting hero image should usually be a
clean, readable, card-friendly image: wide enough for the Locations overview
card and detail header, not a multi-panel sheet.

The hero image must not become a hidden default shot reference. Shot/take
reference workflows continue to use explicit Location Sheet references.

The existing relationship `selection = select` can be used for `role = hero`
only to answer "which hero image represents this Location right now." This is
different from a Location Sheet pick:

- Location Sheets never use Location-level selection in this plan;
- hero selection affects navigation/display imagery only;
- UI copy should say `Set as hero image`, not `Pick`;
- if a Location has no selected hero, Studio shows a quiet empty visual state
  instead of silently using the first Location Sheet.

### Theodosian Walls Target Sheet

The sample project should be able to create a `Theodosian Walls` Location Sheet
whose prompt asks for something like:

- a primary siege-facing production reference from the Ottoman field toward the
  Theodosian Walls;
- a wide aerial/flyover establishing reference that carries field, walls, and
  city depth in one spatial read;
- optional smaller material/continuity studies for repaired masonry, breach
  dust, gates, defenders, wall-top scale, smoke layers, and city-side depth;
- visual language from the selected Movie Lookbook;
- historical guardrails for 1453 Constantinople.

The prompt can decide the layout. Renku should only store and feed the resulting
sheet image.

### Shot References

The shot References section should show all relevant Location Sheets for the
shot's Locations. The user can reference one or more sheets for the current
shot/take. Opening a card should preview the full sheet. It should not offer a
pre-sliced view selector or a Location-level pick UI.

Expected impact:

- The user chooses the best sheet or sheets for the shot.
- Shot prompts describe which part of that sheet matters for the shot.
- Video generation receives every referenced full sheet image.
- There is no stale `front` default and no hidden assumption that a missing
  slice makes the sheet unusable.
- There is no hidden first-sheet/default-sheet behavior.

## Public Contract

Keep the media purpose:

```text
location.environment-sheet
```

Keep the target shape:

```json
{ "kind": "location", "id": "location_abc" }
```

Keep the CLI target:

```text
location:<location-id>
```

Replace the grouped five-file import with the same single-source import style
used by other single-image media purposes:

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --source <project-relative-sheet-image-path> \
  --title <title> \
  --summary <sheet-description-for-overlay> \
  --receipt <generation-run-json> \
  --json
```

For Codex built-in image generation or manually supplied images, omit
`--receipt`.

The generated/persisted spec should become:

```json
{
  "purpose": "location.environment-sheet",
  "target": { "kind": "location", "id": "location_theodosian_walls" },
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "prompt": "Create one Location Sheet for the Theodosian Walls...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Theodosian Walls siege-facing and flyover sheet",
  "description": "Ottoman-field siege-facing wall reference plus aerial field-wall-city establishing context."
}
```

Remove from the public spec:

```text
viewFrame
layoutTemplate
azimuths
```

`sheetFrame` is the outer image frame only. It must not imply panel count or
view layout. The implementation may keep the current initial supported value
`4:3`, but the contract should allow adding other sheet frames later without
changing the data model.

Add a separate Location Hero media purpose:

```text
location.hero
```

It keeps the same target shape:

```json
{ "kind": "location", "id": "location_abc" }
```

Hero generation should require a source Location Sheet asset owned by the same
Location. The generated/persisted hero spec should be:

```json
{
  "purpose": "location.hero",
  "target": { "kind": "location", "id": "location_theodosian_walls" },
  "sourceLocationSheetAssetId": "asset_theodosian_walls_siege_sheet",
  "modelChoice": "fal-ai/openai/gpt-image-2/edit",
  "prompt": "Create a wide representative hero image for the Theodosian Walls from the supplied Location Sheet...",
  "takeCount": 1,
  "seed": null,
  "heroFrame": "16:9",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Theodosian Walls hero image",
  "description": "A wide visual identity image grounded in the siege-facing Location Sheet."
}
```

Hero import should use the same single-source style:

```bash
renku media import \
  --purpose location.hero \
  --target location:<location-id> \
  --source <project-relative-hero-image-path> \
  --source-sheet <location-sheet-asset-id> \
  --title <title> \
  --summary <hero-description> \
  --receipt <generation-run-json> \
  --json
```

For manually supplied hero images, omit `--receipt`. If the image was not
derived from a Location Sheet, omit `--source-sheet` only when the product
explicitly allows direct hero import. Studio-generated hero images should always
name their source sheet.

## Data Model

Use the normal Asset model as the durable source of truth.

Each imported Location Sheet should persist as:

```text
asset.type         = location_environment_sheet
asset.media_kind   = image
asset.title        = user-facing sheet name
asset.one_line_summary = user-facing sheet description
location_asset.role = environment_sheet
asset_file.role    = primary
```

`asset.one_line_summary` is the current database field for the concise Location
Sheet description shown on cards and shot reference overlays. If implementation
finds that Location Sheets need paragraph-length descriptions rather than
concise overlay copy, add a current-model `location_sheet.description` column
instead of hiding long text in a generic field. Do not create both fields for
the same meaning.

Do not use `location_asset.selection = select` or `selection_order` to mark a
preferred Location Sheet. Location Sheet ordering is browsing order only. Shot
references own shot-specific sheet usage.

The asset file path should be a single image:

```text
locations/<location-handle>/environment-sheets/<sheet-slug>/sheet.<ext>
```

Each imported Location Hero Image should persist as:

```text
asset.type         = location_hero
asset.media_kind   = image
asset.title        = user-facing hero image name
asset.one_line_summary = concise hero image description
location_asset.role = hero
location_asset.selection = select, for the current displayed hero image
asset_file.role    = primary
```

Hero image selection is display state only. It must never be interpreted as
the selected Location Sheet, and it must never drive shot reference inputs.

When a new hero image is generated or imported from Studio, it should become
the current hero for that Location by updating `location_asset.selection` for
other `hero` assets on that Location back to `take`. This mirrors the current
Cast Profile behavior while keeping Location Sheet assets unselected.

The hero asset file path should be:

```text
locations/<location-handle>/heroes/<hero-slug>/hero.<ext>
```

Remove these tables from the current runtime schema:

```text
location_environment_sheet
location_environment_sheet_view
```

Why:

- `location_asset` already stores the relationship between the Location and
  the sheet Asset.
- `asset_file` already stores the sheet image file.
- browsing order already belongs to the asset relationship.
- sheet description can be stored on the Asset for the current concise overlay
  use case.
- the view table only exists for the removed pre-slicing model.
- the remaining `composite_file_id` field would be a redundant pointer to the
  only image file.

Follow the Drizzle Kit workflow from
`docs/architecture/drizzle-migrations.md` for the schema update. This
should be a straight schema cleanup generated from the TypeScript schema, not a
custom data-preserving migration. Runtime code should not read old tables,
repair old files, or recognize old five-file import documents.

## Core Implementation Direction

### Location Generation Context

Update `LocationEnvironmentSheetGenerationContext`:

- remove `azimuths`;
- remove `defaults.viewFrame`;
- keep factual Location, Location Design, usage, existing Location Sheet
  assets, active Movie Lookbook, historical guardrails, and image files;
- make `activeLocationDesign.environmentSheetGuidance` the main authored place
  for sheet-specific direction.

The context should make it easy for an agent to write a flexible sheet prompt,
but it should not encode a layout.

### Location Generation Spec

Update `LocationEnvironmentSheetGenerationSpec`:

- remove `viewFrame`;
- keep `sheetFrame`, `detail`, `outputFormat`, `seed`, `takeCount`, `prompt`,
  `title`, `description`, `modelChoice`, `purpose`, and `target`;
- require `description` to be non-empty after trimming;
- keep `takeCount` fixed to `1`;
- reject extra shape through the current schema/validation style, without
  obsolete-field-specific compatibility branches or old-name diagnostics.

### Location Media Import

Replace `ImportLocationEnvironmentSheetMediaInput.files` with a single
`sourceProjectRelativePath`.

The import should:

- validate one project-relative image file;
- copy it to the Location Sheet destination folder;
- create one `asset` row;
- persist the sheet description on the asset;
- create one `asset_file` row with role `primary`;
- create one `location_asset` relationship with role `environment_sheet`;
- store Location Sheet relationships as ordinary attached assets, not selected
  assets;
- emit the same Studio resource keys as other Location asset changes.

Delete:

- `readLocationEnvironmentSheetImportDocument`;
- the location-specific grouped import document contract;
- file role maps for `composite` and `view_*`;
- insertion and read paths for `location_environment_sheet` and
  `location_environment_sheet_view`;
- special dependency selector code that checks `composite_file_id`.

### Location Hero Generation And Import

Add a new core-owned Location Hero media module rather than putting hero
business rules in the CLI or Studio server.

The Location Hero context should include:

- the target Location and active Location Design;
- all current Location Sheet assets for that Location;
- the required source Location Sheet asset when validating or preparing a spec;
- the active Movie Lookbook and relevant generation guidance;
- the source sheet image file path resolved through the normal asset file
  model.

The Location Hero spec should:

- use purpose `location.hero`;
- require `sourceLocationSheetAssetId`;
- validate that the source sheet asset belongs to the target Location;
- require that the source sheet asset has a `primary` image file;
- keep `takeCount` fixed to `1`;
- use `heroFrame`, initially `16:9`, as the outer image frame;
- store `title` and `description` for the generated hero asset.

Location Hero import should:

- validate one project-relative image file;
- optionally validate `sourceLocationSheetAssetId` for manual imports;
- require `sourceLocationSheetAssetId` for imports backed by generated specs;
- copy the image to `locations/<location-handle>/heroes/<hero-slug>/hero.<ext>`;
- create one `asset` row with type `location_hero`;
- create one `asset_file` row with role `primary`;
- create one `location_asset` relationship with role `hero`;
- mark the new hero relationship as selected and clear selection from other
  hero relationships for the same Location;
- emit Location resource keys so overview and detail surfaces refresh.

Do not add a `location.hero_asset_id` column to the Location row. The current
hero image belongs to the Location asset relationship model.

### Dependency Graph

Update Location Sheet dependency planning:

- keep `dependencyKind: 'location-environment-sheet'`;
- make dependencies address a specific referenced sheet asset, not a generic
  Location default;
- use dependency ids that can distinguish multiple sheets for the same
  Location, such as `location-environment-sheet:<locationId>:<assetId>`;
- remove `fileRole: 'composite'`;
- resolve each referenced Location Sheet through the normal image asset file
  path;
- do not auto-select the first Location Sheet when no sheet is referenced.

If a referenced sheet asset has no image file, report the standard missing
image-file diagnostic used by other asset dependencies. Do not create
special metadata diagnostics for old Location Sheet tables.

Add Location Hero dependency planning:

- declare the source Location Sheet as a required dependency for
  `location.hero`;
- use the same full-sheet image asset resolution as shot references;
- fail fast when `sourceLocationSheetAssetId` is missing, belongs to a
  different Location, is discarded, or has no `primary` image file;
- ensure the source sheet dependency is used only for hero generation and does
  not create a Location-level default sheet for shots.

### Shot Video Take State

Remove Location view selection from the current take model:

- delete `LocationAzimuthViewId`;
- delete `SceneShotVideoTakeShotDesign.location.viewIds`;
- delete `SceneShotVideoTakeReferenceSelections.selectedLocationSheetAssetIds`;
- delete `SceneShotVideoTakeReferenceSelections.selectedLocationViewIds`;
- delete `ShotVideoTakeLocationReferenceGroup.selectedViewIds`;
- delete `ShotVideoTakeEnvironmentSheetReferenceChoice.views`;
- delete `ShotVideoTakeLocationViewReferenceChoice`;
- delete `updateSceneShotVideoTakeLocationViewSelection`;
- delete the location view assertion helpers.

Replace one-sheet-per-location selection with explicit shot/take references:

- add a take-owned current-model field such as
  `referencedLocationSheetAssetIds: Record<string, string[]>`, keyed by
  `locationId`;
- or use an ordered array of `{ locationId, assetId }` records if ordering
  across all sheet references matters;
- allow multiple sheet asset ids for the same Location;
- validate that each referenced sheet asset belongs to the matching Location;
- remove `SceneShotVideoTakeShotDesign.location.environmentSheetAssetId` if it
  means one selected Location Sheet; keep only a plural current-model shape if
  shot design needs to project referenced sheets.

When old local development data contains `selectedLocationViewIds`, sample
project cleanup should remove that data by rebuilding or rewriting the sample
state to the current model. The same applies to `selectedLocationSheetAssetIds`.
Runtime code should not contain compatibility readers for either old field.

### Shot Reference Projection

Update `reference-sections.ts` and related card planning:

- build Location reference groups from all Location Sheet assets for each
  relevant shot Location;
- preview each full sheet image;
- expose whether each sheet is referenced by the current shot/take;
- support referencing and unreferencing specific sheet assets;
- omit view choices;
- remove any default/first sheet behavior;
- keep planned/missing Location Sheet affordances only for explicit generated
  sheet requests, not as a hidden default for every Location;
- keep inclusion/exclusion behavior, if still needed, at the specific sheet
  dependency level rather than the Location level.

The final provider input should include every explicitly referenced full
Location Sheet image resolved through the dependency graph.

## CLI Direction

Update `renku media import` behavior for `location.environment-sheet`:

- accept `--source`;
- accept `--receipt` for Renku-managed generated sheets, matching other
  single-file media imports;
- require a non-empty `--summary` or equivalent current CLI field for the
  Location Sheet description;
- remove the `--file` grouped JSON path for this purpose;
- remove location-specific grouped import suggestions;
- update CLI tests and docs.

Add `location.hero` to the generation and media-import command registry:

- include it in allowed generation purposes;
- parse `--source-sheet <asset-id>` for hero imports;
- require generated hero specs to carry `sourceLocationSheetAssetId`;
- call the core Location Hero generation/import commands;
- update purpose-specific help so users understand that a hero image is for
  Location overview/detail display, not a shot reference sheet.

The CLI should stay thin:

- parse flags;
- parse the `location:<id>` target;
- call the core import command;
- format the structured result.

Do not keep a wrapper command or alternate parser for the old five-file JSON
shape.

## Studio Direction

### Location Surfaces

Update Location asset helpers:

- add `LOCATION_HERO_ROLE = 'hero'`;
- remove `LOCATION_ENVIRONMENT_SHEET_FILE_ROLES`;
- remove `PREVIEW_FILE_LABELS` for sliced views;
- find the single `primary` image file;
- show one preview image for each Location Sheet asset.

The Locations overview should show the current Location Hero Image on each
Location card, matching the visual role of Cast Profile images on the Cast
overview. Card text should remain meaningful Location text, such as the
Location name and place/time, over the existing gradient treatment. When a
Location has no hero image, show a quiet empty visual state rather than falling
back to the first Location Sheet.

Location details should show the current Location Hero Image in the detail
header. The Location Sheet images belong in the visual/content asset area,
where the user can inspect each whole sheet. Each Location Sheet card should
overlay the persisted sheet description at the bottom of the image with a
gradient background directly over the sheet image, matching the existing image
overlay pattern. The UI should not show cards named `Front view`, `Right view`,
`Back view`, or `Left view`.

Location details should also let the user generate a hero image from one of
the Location Sheets. The user-facing action should name the specific sheet
being used, for example `Generate hero image from this sheet`. The generated
hero image becomes the current hero image for the Location.

Do not show a Location-level pick or selected-sheet control for Location
Sheets. Location surfaces can show browsing order and asset actions, but not a
global preferred sheet.

If multiple hero images exist, the UI may expose a hero-specific action named
`Set as hero image`. Do not use generic `Pick` copy for hero assets, and do not
show this control on Location Sheets.

### Shot References

Update the shot References tab:

- remove `SceneShotLocationReferenceRow` view dialog behavior or simplify that
  component into a full-sheet reference card;
- remove `onToggleView` and related API calls;
- clicking/opening the card should preview the full sheet;
- show all Location Sheets for the shot's Locations;
- overlay each sheet's persisted description at the bottom of the card image
  with a gradient background;
- the user can reference or unreference individual sheets for the current
  shot/take;
- the UI must not present this as picking one sheet for the Location;
- inclusion/exclusion remains on the specific Location Sheet dependency when
  inclusion state is still needed.

Use only local shadcn-style controls from `packages/studio/src/ui` for any new
interactive controls.

### Studio Server

Delete the route:

```text
PATCH /screenplay/scenes/:sceneId/takes/:takeId/reference-selections/location-views
```

Delete request parsing for location view ids.

Replace the one-sheet-per-location route:

```text
PATCH /screenplay/scenes/:sceneId/takes/:takeId/reference-selections/location-sheets
```

with a current contract that stores explicit sheet references for the current
take. The request should support multiple sheet asset ids per Location, and the
core command must validate ownership before persisting.

For Location Hero work, use the existing generation/spec/import HTTP patterns
where possible. Any new Studio server handler should only parse the target
Location, source sheet asset id, and request body, then call the core
`location.hero` command. It must not decide in route code whether the source
sheet belongs to the Location or which hero asset should become current.

## Skills Direction

Update the adjacent skills in:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

### `media-producer`

Update `SKILL.md`, `references/location-environment-sheet.md`, and samples:

- remove all instructions to crop four scenic blocks;
- remove all import JSON examples with `view_front`, `view_right`,
  `view_back`, and `view_left`;
- import Location Sheets with `renku media import --source`;
- always provide a concise sheet description for the persisted overlay;
- prompt for one flexible sheet image;
- use Location Design `environmentSheetGuidance` and the user's stated need to
  decide the sheet layout;
- include an example that matches the Theodosian Walls requirement: a
  siege-facing view plus a flyover establishing panel;
- keep inspection before import, but inspect the full sheet rather than
  slices.

Add Location Hero guidance to `media-producer`:

- document purpose `location.hero`;
- require the user or calling workflow to name the source Location Sheet asset;
- generate a clean representative Location image, usually `16:9`, rather than
  another multi-panel sheet;
- import with `renku media import --purpose location.hero --source ...`;
- include `--source-sheet <asset-id>` when the hero was generated from a sheet;
- explain that hero images are for overview/detail display and are not shot
  reference sheets.

### `production-designer`

Update the handoff language:

- `production-designer` prepares Location facts and Location Design;
- `media-producer` owns Location Sheet generation and import;
- `media-producer` also owns Location Hero generation from an approved source
  Location Sheet;
- no skill owns mandatory slicing for Location Sheets.

### Shot Media References

Update shot first/last frame and shot video guidance wherever it mentions
`location view`:

- refer to explicitly referenced full Location Sheets;
- when multiple sheets are referenced, name the specific sheet descriptions the
  prompt should use;
- tell the prompt writer to name the relevant part of the sheet when needed,
  such as `use the siege-facing wall panel` or `use the flyover establishing
  panel`;
- do not require a stored slice.

## Documentation Direction

Update current docs, not historical implemented plans:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/cli/commands.md`

Required documentation changes:

- describe Location Sheets as single full-image assets;
- describe that a Location can have many Location Sheets;
- document persisted Location Sheet descriptions and the Studio overlay;
- document Location Hero Images as separate display assets generated from a
  source Location Sheet;
- document purpose `location.hero`, asset type `location_hero`, Location asset
  role `hero`, and primary file role;
- document that Locations overview and Location details use the current hero
  image, not a picked Location Sheet;
- remove "four azimuth" as a product contract;
- remove "sliced view frame";
- remove grouped import JSON;
- update examples to use `--source`;
- add `location.hero` generation/import examples with `sourceLocationSheetAssetId`
  and `--source-sheet`;
- document that sheet layout belongs to Location Design and prompt authoring;
- document that shots reference specific Location Sheet assets and that there
  is no Location-level picked sheet;
- clarify that scene storyboard sheet slicing is unchanged by this plan.

Consider adding a short ADR if the implementation wants a durable decision
record for "Location Sheets are unsliced app assets." If an ADR is added, it
should describe the current decision only, not a compatibility period.

## Sample Project Cleanup

Clean up:

```text
/Users/keremk/renku-movies/urban-basilica
```

This project is development/sample data, not production customer data. Treat it
as if the obsolete sliced model never existed.

Current survey findings:

- Locations include `location_pvpc55we` / `theodosian-walls`.
- Registered Location Sheet assets currently exist for:
  - `asset_h4xzhj5q` / `Harbor Quarter environment sheet`;
  - `asset_68cyb3pc` / `Ottoman Siege Camp Environment Sheet`.
- Registered Location Sheet assets currently have `composite`, `view_front`,
  `view_right`, `view_back`, and `view_left` asset files.
- `location_environment_sheet` and `location_environment_sheet_view` rows exist
  for the registered sliced sheets.
- Generated loose media includes old slice files such as
  `*-environment-sheet-front.png`, `*-environment-sheet-right.png`,
  `*-environment-sheet-back.png`, `*-environment-sheet-left.png`,
  `*-azimuth-000.png`, `*-azimuth-090.png`, `*-azimuth-180.png`, and
  `*-azimuth-270.png`.
- Generated specs include old prompt text such as `layoutTemplate:
  four_azimuth_sheet_v1`, `front 0`, `right 90`, `back 180`, and `left 270`.

Cleanup direction:

- keep useful full sheet images as single Location Sheet assets when they are
  still visually useful;
- add persisted descriptions for every retained Location Sheet;
- create Location Hero Images for Locations that should show visual cards in
  the sample, starting with retained Harbor Quarter and Ottoman Siege Camp
  sheets and the new Theodosian Walls sheet;
- ensure the Locations overview and Location details pages use hero images
  rather than sheet images as their primary visual identity;
- remove any selected/picked Location Sheet state and replace shot usage with
  explicit references when the sample shots need sheets;
- remove registered `view_*` asset files from the sample project state;
- remove old `location_environment_sheet` and
  `location_environment_sheet_view` state as part of the schema cleanup;
- remove loose generated slice images and QA/crop overlay files that exist only
  for the obsolete slicing workflow;
- remove or rewrite old generated import JSON files that require `view_*`;
- remove or rewrite old generated specs that contain `layoutTemplate`,
  fixed-azimuth language, or edit-model/template language;
- add a current Theodosian Walls Location Sheet spec/example that uses the new
  flexible sheet contract;
- verify the sample opens in Studio and shot References show full Location
  Sheets only.

No special migration, compatibility loader, or old-shape repair command should
be added for this sample cleanup.

## Non Goals

This plan does not change:

- scene storyboard sheet slicing;
- cast character sheet layouts;
- Lookbook sheet generation;
- shot first-frame or last-frame generation contracts, except that their
  prompt guidance should reference full Location Sheets;
- provider model choices for Location Sheet generation;
- active Movie Lookbook requirements for Location Sheet generation;
- general asset selection architecture, beyond using existing relationship
  selection for the current Location Hero Image.

This plan does not introduce:

- arbitrary user-authored crop regions;
- named subregions inside Location Sheet metadata;
- a canvas editor for sheet panels;
- a generic sheet-layout schema;
- a global picked/default Location Sheet;
- a rule that makes the current Location Hero Image a shot generation
  reference;
- old-shape compatibility readers;
- a one-off migration path for the sample project.

If named sheet regions become useful later, they should be designed as a new
first-class current model, not as preservation of the old azimuth slice system.

## Review Questions

- Should the initial implementation keep `sheetFrame = '4:3'` as the only
  supported outer frame, or add `16:9` at the same time so wide establishing
  sheets feel more natural?
- Should shot/take Location Sheet references be modeled as
  `Record<locationId, assetId[]>` or as an ordered array of
  `{ locationId, assetId }` records?
- Should the persisted sheet description use current `asset.one_line_summary`
  for concise overlay text, or should implementation add a dedicated
  `location_sheet.description` column immediately?
- Should `heroFrame = '16:9'` be the only initial Location Hero frame, or
  should square hero images be allowed immediately for future alternate card
  designs?
- Should direct manual `location.hero` import without `--source-sheet` be
  allowed, or should every hero image be grounded in an existing Location Sheet
  from day one?
- Should a short ADR be added immediately, or are the updated architecture docs
  enough for this pre-customer cleanup?

## Completion Checklist

Use this checklist for implementation review and final signoff.

Completion audit on 2026-06-24:

- Code, contracts, docs, skills, focused tests, package builds, and root
  `pnpm check` have been completed for the flexible Location Sheets direction.
- A follow-up regression fix restores planned Location Sheet placeholders in
  shot/take References, keeps the estimate badge sourced from core dependency
  planning, previews a single sheet directly, and opens a sheet picker only
  when a Location has multiple generated/imported sheets.
- An end-to-end Studio regression now covers the route-shaped shot membership
  repair path: the browser-facing Studio API updates selected shots, plans
  dependencies through core, and renders the Location Sheet placeholder card.
- The `urban-basilica` repair was performed non-destructively. Existing legacy
  slice files and `view_*` rows were intentionally retained because the user
  explicitly forbade deleting anything; the retained Ottoman Siege Camp and
  Harbor Quarter sheets now have `primary` file rows and valid take state.
- Browser validation against the already-running user-started dev server now
  shows the repaired shot/take References route with the Location Sheets section
  and a visible `Theodosian Walls Location Sheet` card.

### Review Area

- [x] Confirm the implementation treats Location Sheets as full-image assets,
      not as four fixed views.
- [x] Confirm no business rule is added in Studio server, CLI, React, or skills
      that should live in core.
- [x] Confirm no compatibility aliases, re-export stubs, fallback readers,
      wrapper commands, or old-shape repair paths are introduced.
- [x] Confirm current docs and tests describe only the new current model.
- [x] Confirm scene storyboard sheet slicing remains intentionally unchanged.

### Architecture And Naming

- [x] Keep purpose key `location.environment-sheet`.
- [x] Use user-facing copy `Location Sheet` where the UI does not need the
      longer phrase.
- [x] Remove `LocationAzimuthViewId` from public client contracts.
- [x] Remove public contract fields that mention location `viewIds`.
- [x] Remove public contract fields that expose `views` under Location Sheet
      reference choices.
- [x] Remove `LocationEnvironmentSheetFileRole` values for `composite` and
      `view_*`.
- [x] Use `asset_file.role = primary` for imported Location Sheet images.
- [x] Persist a concise Location Sheet description for every imported Location
      Sheet.
- [x] Keep `asset.type = location_environment_sheet`.
- [x] Keep `location_asset.role = environment_sheet`.
- [x] Do not use `location_asset.selection = select` as a Location Sheet pick.
- [x] Ensure there is no Location-level selected or default sheet concept.
- [x] Add purpose key `location.hero`.
- [x] Use `asset.type = location_hero` for Location Hero Images.
- [x] Use `location_asset.role = hero` for Location Hero Images.
- [x] Use `asset_file.role = primary` for Location Hero Image files.
- [x] Use relationship selection only for the current Location Hero Image, not
      for Location Sheets.
- [x] Ensure UI copy says `Set as hero image` for hero assets and never uses
      generic `Pick` copy for Location Sheets.

### Data Model And Drizzle

- [x] Edit the Drizzle TypeScript schema to remove
      `location_environment_sheet`.
- [x] Edit the Drizzle TypeScript schema to remove
      `location_environment_sheet_view`.
- [x] Generate the SQL migration and snapshot with Drizzle Kit from the owning
      package workflow.
- [x] Do not hand-edit generated Drizzle snapshots.
- [x] Ensure the generated schema no longer contains
      `location_environment_sheet_view_azimuth_idx`.
- [x] Ensure the generated schema no longer contains `composite_file_id` for
      Location Sheets.
- [x] Confirm the chosen description storage is represented in the data model:
      either `asset.one_line_summary` for concise overlay text or one
      dedicated current-model `location_sheet.description` field.
- [x] Confirm Location Hero Images need no new Location row column and use
      `location_asset.selection` for the current displayed hero.
- [x] Increment any project-store schema generation/user version required by
      the accepted Drizzle workflow.
- [x] Delete `packages/core/src/server/database/access/location-environment-sheets.ts`
      if no current code needs it.

### Core Location Generation

- [x] Remove `LocationEnvironmentViewFrame`.
- [x] Remove `viewFrame` from Location Sheet generation defaults.
- [x] Remove `viewFrame` from Location Sheet generation specs.
- [x] Add `description` to Location Sheet generation specs.
- [x] Require non-empty Location Sheet descriptions.
- [x] Remove `azimuths` from Location Sheet generation context.
- [x] Update model list reports to stop advertising sliced view frames.
- [x] Update spec validation to validate the current spec shape only.
- [x] Update provider payload construction to use the full-sheet prompt and
      outer sheet frame only.
- [x] Keep generation output count fixed at one image.
- [x] Keep generated files unattached until explicit media import succeeds.

### Core Import

- [x] Replace grouped Location Sheet import input with
      `sourceProjectRelativePath`.
- [x] Copy one source image to
      `locations/<location-handle>/environment-sheets/<sheet-slug>/sheet.<ext>`.
- [x] Insert one `asset` row.
- [x] Persist the imported Location Sheet description.
- [x] Insert one `asset_file` row with role `primary`.
- [x] Insert one `location_asset` row with role `environment_sheet`.
- [x] Store Location Sheet relationships as ordinary attached assets, not
      selected assets.
- [x] Remove required-file validation for `view_front`, `view_right`,
      `view_back`, and `view_left`.
- [x] Remove destination basename logic for `composite`, `front`, `right`,
      `back`, and `left`.
- [x] Remove special structured diagnostics that exist only for missing
      Location Sheet metadata or missing composite file ids.

### Core Location Hero Generation

- [x] Add Location Hero generation client contracts.
- [x] Add Location Hero server contracts to `ProjectDataService`.
- [x] Add `location.hero` to the media generation purpose registry.
- [x] Build Location Hero context from the target Location, Location Design,
      active Movie Lookbook, and available Location Sheets.
- [x] Require `sourceLocationSheetAssetId` for generated hero specs.
- [x] Validate that the source Location Sheet belongs to the target Location.
- [x] Validate that the source Location Sheet has one `primary` image file.
- [x] Add provider payload construction for a single hero image.
- [x] Keep hero generation output count fixed at one image.
- [x] Add Location Hero import through core, not route-local logic.
- [x] Copy hero imports to
      `locations/<location-handle>/heroes/<hero-slug>/hero.<ext>`.
- [x] Insert hero assets with `asset.type = location_hero`.
- [x] Insert one hero `asset_file` row with role `primary`.
- [x] Insert one `location_asset` row with role `hero`.
- [x] Mark the newest generated/imported hero as the current hero image.
- [x] Clear current-hero selection from other hero assets for the same
      Location.
- [x] Ensure current hero selection never affects shot/take reference inputs.

### Dependency Graph And Shot Video Core

- [x] Remove `fileRole: 'composite'` from the Location Sheet dependency slot.
- [x] Make Location Sheet dependency ids distinguish multiple sheets for the
      same Location.
- [x] Resolve referenced Location Sheet dependency files through the normal
      image asset path.
- [x] Remove first-sheet/default-sheet fallback behavior.
- [x] Remove `selectedLocationSheetAssetIds` from take state.
- [x] Remove `selectedLocationViewIdsForTakeState`.
- [x] Remove location view selection mutation functions.
- [x] Remove location view assertion helpers.
- [x] Remove location view fields from take state initialization.
- [x] Remove location view fields from take state validation.
- [x] Add the current take-owned Location Sheet reference state, allowing
      multiple sheet asset ids for the same Location.
- [x] Validate that each referenced Location Sheet belongs to its Location.
- [x] Update shot reference sections to emit all Location Sheet choices without
      child view choices.
- [x] Project each sheet's persisted description into the reference card plan.
- [x] Update preflight/reference diagnostics to talk about full Location
      Sheets.
- [x] Verify final shot-video provider inputs include every explicitly
      referenced full sheet image.
- [x] Add Location Hero source-sheet dependency planning.
- [x] Fail fast when `location.hero` is missing a valid source sheet.
- [x] Confirm Location Hero source-sheet dependency lines do not create
      Location Sheet defaults for shot video generation.

### CLI

- [x] Remove `LocationEnvironmentSheetImportDocument`.
- [x] Remove `readLocationEnvironmentSheetImportDocument`.
- [x] Update `location.environment-sheet` import to accept `--source`.
- [x] Update `location.environment-sheet` import to accept `--receipt`.
- [x] Require or otherwise collect a non-empty Location Sheet description
      during import.
- [x] Remove grouped `--file` support for this purpose.
- [x] Update CLI tests for Location Sheet import.
- [x] Remove CLI tests that only assert old five-file JSON behavior.
- [x] Update CLI help and docs examples.
- [x] Add `location.hero` to generation purpose parsing.
- [x] Add `location.hero` to media import purpose parsing.
- [x] Add `--source-sheet` parsing for Location Hero imports.
- [x] Add CLI tests for Location Hero spec creation from a source sheet.
- [x] Add CLI tests for Location Hero import and current hero selection.

### Studio Server

- [x] Delete the location views reference-selection route.
- [x] Delete location view request parsing.
- [x] Delete tests for location view selection requests.
- [x] Replace the one-sheet-per-location selection route with a route that
      persists explicit Location Sheet references for the current take.
- [x] Ensure the request can carry multiple sheet asset ids per Location.
- [x] Ensure server handlers remain thin: parse request, call core, serialize
      response.
- [x] Add or wire any needed Location Hero generation/import handler through
      the existing generation HTTP pattern.
- [x] Ensure Studio server does not validate source-sheet ownership itself; it
      delegates that rule to core.

### Studio Frontend

- [x] Add Location asset helpers for `role = hero`.
- [x] Update Locations overview cards to show the current hero image.
- [x] Ensure Locations overview cards do not fall back to the first Location
      Sheet as a hero image.
- [x] Update Location details header to show the current hero image.
- [x] Add an empty visual state for Locations with no hero image.
- [x] Add UI to generate a Location Hero Image from a chosen Location Sheet.
- [x] Ensure generated hero images become the displayed current hero image.
- [x] Add a hero-specific `Set as hero image` action only if alternate hero
      assets are shown.
- [x] Ensure no generic `Pick` control appears for Location Sheets.
- [x] Update Location asset helpers to find one `primary` image file.
- [x] Remove fixed preview file labels for `Front view`, `Right view`,
      `Back view`, and `Left view`.
- [x] Update Location details tests to expect full sheet previews only.
- [x] Simplify or replace `SceneShotLocationReferenceRow` so it previews the
      full sheet instead of opening a view selector.
- [x] Remove `onToggleView` plumbing from the shot References tab.
- [x] Remove `updateTakeLocationViewSelection` from Studio services.
- [x] Remove tests that click/select location view cards.
- [x] Add or update tests that confirm Location Sheet cards preview the full
      sheet.
- [x] Add or update tests that confirm Location Sheet descriptions are
      overlaid at the bottom of the image card with a gradient background.
- [x] Add or update tests that confirm individual sheets can be referenced and
      unreferenced for the current shot/take.
- [x] Add or update tests that confirm there is no Location-level pick UI.
- [x] Add or update tests that confirm overview/detail surfaces use hero
      images rather than sheet images.
- [x] Add or update tests that confirm hero generation uses the chosen source
      Location Sheet.
- [x] Use local shadcn-style controls only for any changed interactive UI.

### Skills

- [x] Update `media-producer/SKILL.md` to remove Location Sheet slicing.
- [x] Update `media-producer/references/location-environment-sheet.md` to
      describe flexible full-sheet generation and import.
- [x] Update `media-producer/samples/location-environment-sheet-spec.json`.
- [x] Add a Theodosian Walls style example to the media-producer guidance or
      samples.
- [x] Ensure media-producer guidance always writes a concise Location Sheet
      description for import and overlay.
- [x] Add media-producer guidance for `location.hero`.
- [x] Add a Location Hero sample spec that references a source Location Sheet.
- [x] Ensure Location Hero guidance describes hero images as overview/detail
      display media, not shot references.
- [x] Update `production-designer/references/media-and-shot-list-handoff.md`.
- [x] Update shot first/last frame guidance that says `location view`.
- [x] Search `studio-skills/skills` for `view_front`, `view_right`,
      `view_back`, `view_left`, `azimuth`, `four scenic`, and `crop` to ensure
      no obsolete Location Sheet guidance remains.
- [x] Preserve storyboard sheet slicing guidance where it applies specifically
      to `scene.storyboard-sheet`.

### Documentation

- [x] Update `docs/architecture/media-generation.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/architecture/data-model-and-storage.md`.
- [x] Update `docs/architecture/reference/project-files-and-assets.md`.
- [x] Update `docs/architecture/reference/domain-vocabulary.md`.
- [x] Update `docs/cli/commands.md`.
- [x] Document that Location Sheet descriptions are persisted and shown on card
      overlays.
- [x] Document `location.hero` generation and import.
- [x] Document `sourceLocationSheetAssetId` and `--source-sheet`.
- [x] Document Location Hero Images as separate from Location Sheets.
- [x] Document that overview and detail surfaces use the current Location Hero
      Image.
- [x] Document that shots reference specific Location Sheet assets and can
      reference more than one sheet for the same Location.
- [x] Document that Location Sheets do not have a Location-level pick/default.
- [x] Add an ADR if the team wants a durable decision record.
- [x] Do not edit historical implemented plans just to replace old terms.

### Sample Project

- [x] Back up or recreate the `urban-basilica` sample project according to the
      normal development workflow before destructive cleanup.
- [x] Retain existing registered `view_*` asset files for Location Sheets in
      `urban-basilica` per the user no-delete instruction while ensuring the
      useful retained sheets have `primary` files.
- [x] Convert retained Location Sheet assets to one `primary` file each, or
      reimport retained sheet images through the new import command.
- [x] Add concise persisted descriptions to retained/reimported Location
      Sheets.
- [x] Create or import Location Hero Images from retained useful sheets.
- [x] Mark one `hero` asset as current for each sample Location that should
      have a visual overview card.
- [x] Ensure Location overview sample cards display hero images.
- [x] Ensure Location detail sample pages display hero images in the header.
- [x] Remove any selected/picked Location Sheet state from sample take data.
- [x] Add explicit shot/take Location Sheet references where sample shots need
      Location Sheet inputs.
- [x] Remove old `location_environment_sheet` and
      `location_environment_sheet_view` state through the current schema
      cleanup.
- [x] Preserve generated Location Sheet slice files that exist only for the old
      workflow because the user explicitly forbade deletion.
- [x] Preserve old crop QA and extraction overlay images that exist only for the
      old workflow because the user explicitly forbade deletion.
- [x] Preserve any old Location Sheet import JSON files with `view_*` unless
      they are rewritten in a future explicit cleanup pass.
- [x] Preserve any generated specs that contain `layoutTemplate`,
      fixed-azimuth instructions, or template/edit-model assumptions unless
      they are rewritten in a future explicit cleanup pass.
- [x] Create or update a Theodosian Walls Location Sheet spec using the
      flexible sheet contract.
- [x] Verify the sample project opens and shows full Location Sheets only.

### Verification

- [x] Run focused core tests for Location Sheet generation/import.
- [x] Run focused core tests for Location Hero generation/import.
- [x] Run focused core tests for dependency graph and shot-video references.
- [x] Run focused CLI tests for media import.
- [x] Run focused Studio tests for Location details and shot References.
- [x] Run an end-to-end Studio regression that goes through the Studio HTTP
      route, core dependency planning, and the rendered shot References tab for
      planned Location Sheet placeholders.
- [x] Run `pnpm --dir packages/core test` if the core blast radius is broad.
- [x] Run `pnpm --dir packages/cli test` if CLI import changed.
- [x] Run `pnpm --dir packages/studio test` or the focused Studio test target
      if frontend/server contracts changed.
- [x] Run root `pnpm check` before review if the implementation spans core,
      CLI, Studio, docs, and skills.
- [x] Run `rg -n "LocationAzimuth|selectedLocationSheetAssetIds|selectedLocationViewIds|view_front|view_right|view_back|view_left|location views|four azimuth|azimuth_degrees|composite_file_id" packages docs /Users/keremk/Projects/aitinkerbox/studio-skills/skills`
      and review every remaining match.
- [x] Run `rg -n "location.hero|location_hero|sourceLocationSheetAssetId|source-sheet|role = hero" packages docs /Users/keremk/Projects/aitinkerbox/studio-skills/skills`
      and confirm the new hero contract appears in every expected surface.
- [x] Run a targeted search in `urban-basilica` for `view_front`,
      `view_right`, `view_back`, `view_left`, `azimuth`, and
      `four_azimuth_sheet_v1`.
- [x] Verify desktop behavior against the existing Studio process; the
      repaired `urban-basilica` take now shows the Location Sheets section and
      a visible Location Sheet card without restarting the user-started server.
