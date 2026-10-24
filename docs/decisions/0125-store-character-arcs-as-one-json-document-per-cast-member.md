# 0125 Store Character Arcs As One JSON Document Per Cast Member

Date: 2026-10-20

Status: accepted

Status: accepted

[ADR 0127](0127-cast-looks-costumes-and-casting-rounds.md) removes the shared
arc (`characterArcReference`) and renames the turning point sheet field to
`characterSheetAssetFileId`: one person is one Cast Member at every age.

Applies [JSON Storage Validation](../architecture/json-storage-validation.md),
[ADR 0041](0041-keep-ai-artifacts-and-prompts-opaque.md) and
[ADR 0073](0073-keep-screenplay-derived-artifacts-weak.md). Implemented by plan
0240.

## Context

Studio had free-text Want, Need and Arc fields and a story-level Story Arc
chart, but no structured, scene-anchored record of how a main character
changes. The user asked for a Character Arc view built from screenplay
analysis. They also asked for a JSON document per Cast Member, not a set of
new tables.

## Decision

- **Storage.**
  - A Character Arc is one JSON document per Cast Member, stored in the
    nullable `cast_member.character_arc` column as `{ writtenAt, arc }`.
  - `arc` is either an own arc (`kind: "characterArc"`) or a reference from
    an age variant to the main Cast Member's arc
    (`kind: "characterArcReference"`).
  - There are no tables for beats, spine fields or turning points.
- **Contract.**
  - Core owns the JSON Schemas (`packages/core/src/client/character-arcs/`),
    validates on every write and read, and is the only reader and writer of
    the column.
  - `renku cast arc schema` prints the contract for agents.
- **Validation.**
  - Studio validates structure, arc-type spine rules, Scene ids and their
    order, reference targets, and that a turning point's
    `lookAssetFileId` is a character sheet of a Cast Member sharing the
    arc.
  - It never validates or interprets the arc's text.
- **Writes.**
  - `renku cast arc write` replaces the complete set in one transaction;
    Cast Members left out are cleared.
  - The `screenplay-analyst` skill writes arcs for protagonists and key
    supporting roles right after each Screenplay Analysis.
- **Weak references.** Arcs are weak screenplay-derived data. Scene ids are
  checked at write time. A later screenplay revision marks arcs
  `needsRefresh` but never makes them invalid.
- **Reads.**
  - The Arc tab reads one resource that resolves shared arcs. It combines the
    current scenes, scene presence from screenplay references, acts and key
    beats from the active analysis, and the character sheets named by
    turning points.
  - A referenced owner cannot be deleted while another Cast Member shares its
    arc (`CHARACTER_ARC_REFERENCE_IN_USE`).

## Consequences

- Re-analysis is the only way arcs change; Studio has no arc editor.
- Character sheets attached after the arcs were written appear on cards only
  after the arcs are rewritten with `lookAssetFileId`.
- Full support for one character at several ages, relationships between
  characters, and a per-scene "story world" (present day or flashback) are
  separate future decisions.
