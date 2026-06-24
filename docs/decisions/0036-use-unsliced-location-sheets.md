# Use Unsliced Location Sheets

Date: 2026-06-23

Status: accepted

## Context

Location Sheets were previously modeled as a rigid grouped asset with one
composite image and fixed directional views. That made a production reference
look like a camera-orbit artifact, even when the useful reference was a map,
material board, elevation study, night variant, annotated overview, or another
single full-image board.

## Decision

Renku Studio treats a Location Sheet as one full-image asset attached to a
Location with role `environment_sheet`. The asset has one `primary` image file
and a persisted description. Studio and shot-video generation reference exact
Location Sheet asset ids when a shot or take needs that reference.

Location Sheets do not have a Location-level pick/default selection. They are
not sliced into fixed directional views, and runtime code does not store or read
Location Sheet azimuth metadata.

Location Hero Images are separate assets with type `location_hero`, Location
asset role `hero`, and one `primary` image file. The selected hero image is for
overview and detail display only; it is not a hidden shot-generation reference.

## Consequences

- Location Sheet import uses `--source` plus a required summary instead of a
  grouped import document.
- Shot/take state stores explicit referenced Location Sheet asset ids.
- Dependency ids include the sheet asset id when a referenced sheet is used.
- The old Location Sheet grouping tables are removed from the project schema.
- A Location can have multiple useful sheets without one of them becoming a
  default for generation.
