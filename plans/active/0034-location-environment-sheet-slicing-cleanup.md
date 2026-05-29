# 0034 Location Environment Sheet Slicing Cleanup

Date: 2026-05-29

Status: implemented

## Goal

Remove app-owned slicing metadata from the Location Environment Sheet data
model, schema, code, tests, and documentation.

Location Environment Sheets should follow the boundary accepted in:

```text
docs/decisions/0024-keep-media-slicing-out-of-app-state.md
```

The corrected model is:

- the media-producer agent generates one composite sheet;
- the agent visually inspects that sheet;
- the agent crops four view files;
- the agent imports the original composite plus four already-sliced files;
- Studio stores the compound Asset, Asset Files, azimuth relationships, and
  display order;
- Studio does not store crop boxes, grid layout, extraction confidence,
  extraction method, or extraction diagnostics.

This is a focused cleanup plan. It should not redesign location generation,
change model choices, add UI generation controls, or introduce a generic media
purpose framework.

## References

- `docs/decisions/0024-keep-media-slicing-out-of-app-state.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/cli/commands.md`
- `plans/active/0028-location-environment-sheet-redesign.md`
- `plans/active/0032-scene-shot-list-cli-skill-and-data-model.md`
- `packages/core/src/server/schema/assets.ts`
- `packages/core/src/server/database/access/location-environment-sheets.ts`
- `packages/core/src/server/media-generation/location-environment-sheet.ts`
- `packages/core/src/client/media-generation.ts`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-environment-sheet.md`

## Current Problem

The current location tables still persist slicing mechanics that Studio should
not own.

Current `location_environment_sheet` columns to remove:

```text
layout_template
grid_layout
extraction_confidence
extraction_method
extraction_diagnostics_json
sheet_frame
view_frame
```

Current `location_environment_sheet_view` columns to remove:

```text
crop_x
crop_y
crop_width
crop_height
extraction_confidence
extraction_method
```

Current code also hard-codes these slicing details:

```text
AGENT_SLICED_LAYOUT_TEMPLATE = 'agent_sliced_location_sheet_v1'
TWO_BY_TWO_GRID_LAYOUT = 'two_by_two'
PROVIDED_SLICES_EXTRACTION_METHOD = 'provided_slices'
PROVIDED_SLICES_EXTRACTION_CONFIDENCE = 'high'
```

These values do not describe durable project state. They describe how an agent
or an old app-side extractor produced files. That belongs outside the app data
model.

The generated Drizzle SQL and snapshot metadata also still contain these
columns:

```text
packages/core/drizzle/0013_location_environment_sheets.sql
packages/core/drizzle/meta/0013_snapshot.json
packages/core/drizzle/meta/0014_snapshot.json
```

Those files should be treated as generated artifacts. Do not hand-edit the
snapshot metadata. Update the Drizzle TypeScript schema, then use Drizzle Kit to
produce the next migration and snapshot.

## Corrected Data Model

Keep the grouped asset model:

```text
asset
asset_file
location_asset
location_environment_sheet
location_environment_sheet_view
```

The corrected `location_environment_sheet` table should be:

```text
location_environment_sheet
  id text primary key
  location_id text not null references location(id)
  asset_id text not null references asset(id) on delete cascade
  composite_file_id text not null references asset_file(id)
  created_at text not null
  updated_at text not null
```

The corrected `location_environment_sheet_view` table should be:

```text
location_environment_sheet_view
  id text primary key
  sheet_id text not null references location_environment_sheet(id) on delete cascade
  azimuth_degrees integer not null
  asset_file_id text not null references asset_file(id)
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Keep:

- `location_environment_sheet.asset_id`, because one compound Asset represents
  the grouped sheet;
- `location_environment_sheet.composite_file_id`, because Studio needs the
  original sheet file;
- `location_environment_sheet_view.azimuth_degrees`, because this is the domain
  relationship between a sliced file and a direction;
- `location_environment_sheet_view.asset_file_id`, because each azimuth view is
  one already-sliced Asset File;
- `sort_order`, because UI display order is app-owned.

Remove:

- crop coordinates;
- grid layout;
- layout templates;
- extraction confidence;
- extraction method;
- extraction diagnostics;
- sheet/view frame fields from the domain table.

The generation spec can still store generation choices such as `sheetFrame` and
`viewFrame` in `media_generation_spec.spec_json`, because those are persisted
generation choices. They must not be duplicated into the durable Location
Environment Sheet domain tables.

## Migration

Follow the Drizzle Kit workflow:

1. Edit the Drizzle schema in:

   ```text
   packages/core/src/server/schema/assets.ts
   ```

2. Generate SQL with Drizzle Kit from `packages/core`.
3. Remove the obsolete columns through the generated migration.
4. Increment the project-store schema generation because this removes runtime
   columns from existing project tables.

This cleanup is a breaking schema change because current runtime code reads and
writes the old columns today. The implementation should increment the schema
generation and set `PRAGMA user_version` in the migration according to
`docs/architecture/reference/drizzle-migrations.md`.

Do not add compatibility readers, aliases, fallback branches, or old-column
loaders. Renku Studio is pre-customer software; update the runtime directly to
the new shape.

## Core Code Changes

Update:

```text
packages/core/drizzle/*
packages/core/src/server/schema/assets.ts
packages/core/src/server/database/access/location-environment-sheets.ts
packages/core/src/server/media-generation/location-environment-sheet.ts
packages/core/src/client/media-generation.ts
packages/core/src/server/media-generation/location-environment-sheet.test.ts
packages/cli/src/cli.test.ts
```

Required changes:

- remove obsolete Drizzle fields;
- remove obsolete constants for layout template, grid layout, extraction method,
  and extraction confidence;
- remove `sheetFrame`, `viewFrame`, and `extractionDiagnostics` from
  `InsertLocationEnvironmentSheetRecord`;
- remove optional `crop` from `InsertLocationEnvironmentSheetViewRecord`;
- insert sheet rows with only durable identity and file relationships;
- insert view rows with only azimuth, file, and ordering relationships;
- keep explicit grouped import of one composite plus four view files;
- keep validation that all required files are supplied;
- keep validation that files are project-relative and inside the project;
- keep validation that each required azimuth role has exactly one file;
- update generated project database artifacts through the accepted Drizzle Kit
  workflow, not by editing metadata JSON by hand;
- do not infer azimuths from filenames;
- do not add any app-side crop detection or image processing.

## CLI And Import Behavior

Keep the current explicit grouped import shape:

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --file location-environment-sheet-import.json \
  --json
```

The import JSON should continue to provide:

```json
{
  "files": {
    "composite": "generated/media/location-sheet.png",
    "view_front": "generated/media/location-front.png",
    "view_right": "generated/media/location-right.png",
    "view_back": "generated/media/location-back.png",
    "view_left": "generated/media/location-left.png"
  }
}
```

The CLI/core import should:

- copy all five files into the location environment sheet asset folder;
- create one compound Asset;
- create one Asset File for the composite;
- create one Asset File for each view;
- create one Location Asset relationship with role `environment_sheet`;
- create one `location_environment_sheet` row;
- create four `location_environment_sheet_view` rows.

The CLI/core import should not:

- accept crop coordinates;
- accept extraction metadata;
- store crop coordinates;
- store extraction metadata;
- infer view roles from filenames;
- run crop or image-detection logic.

## Documentation Cleanup

Update current docs so they match the ADR:

```text
docs/architecture/reference/project-files-and-assets.md
docs/architecture/media-generation.md
docs/architecture/reference/media-generation.md
docs/architecture/reference/domain-vocabulary.md
docs/cli/commands.md
```

Remove or rewrite current statements that say SQLite stores:

- extraction confidence;
- extraction method;
- crop coordinates;
- grid layout;
- import method;
- extraction diagnostics.

Keep statements that say SQLite stores:

- compound sheet identity;
- original composite file reference;
- each azimuth view's Asset File relationship;
- azimuth degree and display order.

Do not update old or historical implemented plans just to rewrite history. If a
plan is referenced by current implementation work and contains obsolete
direction, add a short note in this new plan or current docs instead.

## Skill Alignment

Update the external `media-producer` skill references only as needed:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-environment-sheet.md
```

The skill should continue to say:

- inspect the composite with vision;
- decide crop regions as an agent;
- create the four view files;
- inspect those slices;
- import the explicit five-file JSON.

The skill should not say:

- Core stores crop boxes;
- Core stores extraction confidence;
- Core stores extraction diagnostics;
- Core can recover a bad sheet through image-processing heuristics.

## Tests

Update core tests to cover:

- schema access functions insert sheet rows without slicing metadata;
- schema access functions insert view rows without crop/extraction metadata;
- import creates one compound Asset;
- import creates five Asset Files under that Asset;
- import creates one `location_environment_sheet` row;
- import creates four `location_environment_sheet_view` rows;
- view rows preserve azimuth degree and sort order;
- import rejects missing composite file;
- import rejects any missing view file;
- import rejects duplicate file paths;
- import rejects source files outside the project;
- deleting the compound Asset cascades sheet rows;
- no runtime code reads `crop_x`, `extraction_confidence`, `layout_template`,
  or related obsolete fields;
- migrated databases no longer expose the removed columns through SQLite schema
  introspection.

Update CLI tests to cover:

- `renku media import --purpose location.environment-sheet --file <json> --json`
  still works with explicit five-file JSON;
- import report still returns the imported grouped Asset and file roles;
- no crop/extraction fields appear in JSON reports.

Run focused verification:

```bash
pnpm test:core
pnpm test:cli
pnpm lint
pnpm check
```

Use narrower test commands during implementation when available.

## Implementation Checklist

- [x] Remove Location Environment Sheet slicing metadata from Drizzle schema.
- [x] Generate a Drizzle migration.
- [x] Increment project-store schema generation and set `PRAGMA user_version`.
- [x] Confirm generated Drizzle snapshot metadata no longer includes removed
      columns.
- [x] Remove obsolete constants from location environment sheet database access.
- [x] Remove obsolete insert input fields from database access types.
- [x] Update sheet insertion to persist only identity and file relationships.
- [x] Update view insertion to persist only azimuth, file, and order.
- [x] Update media import code to stop passing sheet/view frame or extraction
      diagnostics into sheet persistence.
- [x] Keep explicit five-file import validation.
- [x] Ensure generation specs may still persist generation choices without
      duplicating them into domain tables.
- [x] Update client/server contracts that expose obsolete metadata.
- [x] Update tests that expected crop/extraction metadata.
- [x] Add tests proving no crop/extraction fields are returned by import
      reports.
- [x] Add a migration/schema assertion that the removed columns are absent.
- [x] Update current architecture and CLI docs.
- [x] Review the media-producer location environment sheet reference; no
      changes were needed because it already describes agent-owned visual
      slicing and five-file import.
- [x] Run focused core and CLI tests.
- [x] Run lint and type checks.

## Resolved Decisions

- Slicing is agent responsibility, not app responsibility.
- Location Environment Sheets use one compound Asset.
- The composite and four sliced view files are Asset Files under that Asset.
- SQLite stores azimuth relationships and display order, not crop mechanics.
- Existing crop/extraction columns are cleanup debt and must be removed.
- Do not preserve old table columns or readers for compatibility.
