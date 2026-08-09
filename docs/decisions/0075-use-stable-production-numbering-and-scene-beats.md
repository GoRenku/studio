# 0075 Use Stable Production Numbering And Scene Beats

Date: 2026-08-08

Status: accepted

## Context

Scenes, Shot Plans, Shots, and Beats need short human-facing references that
survive insertion, movement, deletion, collection, revision restore, and
Storyboard generation. The former model made Scene numbers optional, derived
Shot labels from mutable positions, left Plans and Beats unnumbered, and used
Beat Sheet terminology for an ordinary revisioned narrative aggregate.

This decision must preserve the existing FDX importer contract. FDX imports
continue to pass through their exact optional authored Scene numbers; this
numbering work adds no source mode, fallback allocator, mutation policy,
setting, flag, or provenance field.

## Decision

Core owns a browser-safe grammar for numbers Core generates:
`[1-9][0-9]*[A-Za-z]*`. Generated-number reservations are ASCII
case-insensitive within their owning scope, and generated suffixes use uppercase
bijective letters (`A` through `Z`, then `AA`). Durable ids and positions
continue to own identity and ordering.

Supplied and already-stored Scene numbers are opaque. Core preserves them
byte-for-byte and does not validate their grammar, trim them, case-fold them,
require them to be non-empty, or require them to be unique. The allocator may
avoid an exact occupied Scene value while choosing a new Renku-generated number,
but an existing value is never parsed or rejected by the generation rules.

Number persistence stays with each Renku-authored domain lifecycle:

- Renku-authored Scenes use durable reservations. Create, focused edits, and
  revision restore remain supported; insertion allocates suffixes and deletion
  never releases a generated reservation. The FDX importer preserves every
  optional authored Scene number exactly, including duplicate or otherwise
  non-generated values.
- Shot Plans use a Scene-local monotonic integer counter. Shots use per-Plan
  durable reservations, stable numbers, and explicit placement.
- `SceneBeats` replaces the Beat Sheet product aggregate. Core authors Beat ids
  and numbers. Create and reset start at `1..N`; focused operations create
  immutable revisions, preserve surviving numbers, and retain deleted-number
  reservations. `set-active` restores any retained revision without deleting
  the revision being left.

Runtime Scene Beats history is append-only. Reset creates and activates a new
revision, list/read retain all revisions, and changing the active revision is
non-destructive. Storyboard ownership remains `{ sceneId, beatId }`, while
Storyboard status/import and Shot Plan coverage retain the exact Scene Beats
revision id.

## Consequences

- CLI, Studio, and skills display and transport Core numbers but never allocate
  or reserve them.
- Numbers are not user-editable and are never used as database identities,
  ordering keys, ownership keys, or foreign keys.
- There is no universal numbering table, compatibility reader, FDX export or
  re-import merge, general screenplay editor UI, or Studio Scene Beats reset
  action.
- The renamed Scene Beats contracts replace old names directly; `Sheet` is
  reserved for visual artifacts such as Storyboard Sheets.
- Human-readable durable media paths are decided separately by Decision 0076.
