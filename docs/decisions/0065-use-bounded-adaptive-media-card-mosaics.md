# 0065: Use Bounded Adaptive MediaCard Mosaics

Date: 2026-07-27

Status: accepted

## Context

`MediaCard` already owns an exact four-cell mosaic used by Visual Language.
Shot Plan cards also need to summarize selected Shot images, but their image
count varies while canonical Shot order must remain visible. Reusing the fixed
2x2 contract would silently omit images, while a caller-configurable grid would
turn the shared card into an unbounded layout framework.

## Decision

Retain the exact current `mosaic` contract and add a separate bounded
`mosaic-grid` media variant.

The adaptive variant accepts only an ordered array of image URL, alt text, and
stable key values. It uses deterministic layouts:

- one image: one cell;
- two images: two columns;
- three images: three columns;
- four images: 2x2;
- five or six images: three columns by two rows;
- seven through nine images: three columns by three rows;
- ten or more images: the first eight images followed by a labelled overflow
  cell.

The overflow cell reports the exact hidden count, such as `+2`, and exposes an
accessible label. It is presentation only and is not interactive.

The contract does not accept domain objects, arbitrary row or column settings,
render slots, caller-supplied layout classes, or hidden interaction in the
overflow cell.

## Consequences

- Variable selected-image collections have one consistent shared card
  treatment.
- Canonical caller order is preserved without moving Shot Plan rules into UI
  primitives.
- Visual Language keeps its accepted exact 2x2 mosaic behavior.
- Overflow remains visible and accessible without making hidden images
  selectable from the summary card.
- A new layout requirement outside these cases needs a deliberate contract
  decision rather than a caller configuration escape hatch.
