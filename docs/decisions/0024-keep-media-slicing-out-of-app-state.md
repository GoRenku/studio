# 0024 Keep Media Slicing Out Of App State

Date: 2026-05-29

Status: accepted

Notice: Decision [0059](0059-use-location-sheet-as-the-only-current-contract.md)
supersedes current Environment Sheet naming clauses in this decision.

## Context

Renku Studio uses compound visual assets in several workflows. A model may
generate one larger sheet image, and an agent may then inspect that sheet and
slice it into smaller files for project use.

Examples:

- a Location Environment Sheet with one composite image and individual view
  files;
- a Scene Shot List storyboard sheet with one original sheet and one sliced
  image file per Shot;
- future contact sheets, reference boards, or generated planning sheets that
  need the same original-plus-slices structure.

The important ownership boundary is:

- the agent owns visual inspection, crop decisions, and slicing;
- Studio owns durable project identity, file registration, domain
  relationships, and display;
- the app must not pretend it knows how a sheet was visually sliced unless that
  becomes a deliberately designed image-processing feature.

Current Location Environment Sheet code still has remnants from a too-mechanical
model of slicing. The schema includes fields such as `crop_x`, `crop_y`,
`crop_width`, `crop_height`, `extraction_confidence`, `extraction_method`,
`extraction_diagnostics_json`, `layout_template`, and `grid_layout`. Those
fields should be treated as cleanup debt, not as a precedent for new sheet
features.

## Decision

Slicing is not app responsibility.

For generated sheets and their slices, Studio persists only:

- the compound Asset that represents the full sheet;
- the original sheet Asset File;
- the sliced Asset Files produced by the agent;
- domain relationships from those files to the project object they represent,
  such as a Location azimuth view or a Scene Shot List `shotId`;
- user-facing or domain-facing ordering where the UI needs stable display.

Studio must not persist:

- crop boxes;
- grid cell coordinates;
- extraction confidence;
- extraction method;
- extraction diagnostics;
- layout template names whose only purpose is to describe slicing mechanics;
- any other app-owned description of how the agent cut the sheet.

Validation should check project state, not image-processing internals. For
example:

- every required source file is a project-relative path inside the project;
- every expected domain slot has one sliced file, such as each required azimuth
  or each Shot in a Shot List;
- referenced domain ids exist;
- imported files are registered as Asset Files under the intended compound
  Asset.

Validation should not check where the crop came from, whether the crop rectangle
is correct, or whether the generated sheet had a particular grid geometry. The
agent is responsible for inspecting the sheet, choosing the slices, writing the
files, and importing the result.

## Consequences

- Future sheet-based features have a simple reusable storage rule:
  compound Asset plus original and sliced Asset Files.
- Studio display code can render original sheets and sliced files without
  knowing how they were cut.
- Skills can evolve better visual inspection and slicing procedures without
  database migrations.
- App code avoids stale or misleading slicing metadata.
- Location Environment Sheet schema follows this boundary by removing its old
  crop, extraction, layout, and diagnostic columns.
- New sheet-based features must not reintroduce app-owned slicing metadata.
