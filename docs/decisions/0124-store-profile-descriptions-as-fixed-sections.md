# 0124 Store Profile Descriptions As Fixed Sections

Date: 2026-10-20

Status: accepted

Applies [JSON Storage Validation](../architecture/json-storage-validation.md)
and [ADR 0041](0041-keep-ai-artifacts-and-prompts-opaque.md). Implemented by
plan 0239.

## Context

Cast Member, Location and Prop descriptions were free text. Agents improvised
their own capital-letter headings inside that text, so every project
structured descriptions differently. The Cast Details page also lost the line
breaks, which ran the headings into sentences. Studio could not show real
headings without guessing from capital letters.

## Decision

- `description` on Cast Members, Locations and Props is a JSON object of
  fixed, named sections. Core owns the keys, their order, and the JSON
  Schemas in `packages/core/src/client/profile-descriptions/`:
  - **Cast Member:** `overview`, `appearance`, `behavior`, `wardrobe`,
    `performance`, `sourceNotes`.
  - **Location:** `overview`, `storyUse`, `spaceAndLayout`,
    `statesAndChanges`, `sourceNotes`.
  - **Prop:** `overview`, `storyUse`, `formAndMaterials`,
    `statesAndContinuity`, `sourceNotes`.
- **Section values** are non-blank plain text, and blank lines separate
  paragraphs. Studio shows the text exactly as written, under Studio-owned
  headings. `overview` comes first with no heading, and `sourceNotes` is a
  footnote.
- **Validation:** AJV validates the object on every write (operation
  documents) and every read. Only the database access layer parses the
  stored value. Malformed stored data fails with
  `PROFILE_DESCRIPTION_STORED_INVALID`.
- **Opaque contents:** Studio validates only the envelope (allowed keys,
  non-blank strings). It never interprets the prose.
- **Existing projects:** existing free text moved word for word into
  `overview` (migration 0092). The updated skills rewrite it into sections.
- **Unchanged fields:** Want, Need, Arc, Voice notes, Visual notes and Time
  period stay plain text fields.

## Consequences

- Agents write descriptions into named sections instead of inventing
  headings. The casting-director and production-designer skills document what
  belongs in each section.
- Adding, renaming or removing a section is a contract change. It updates the
  schema, the Studio headings, the CLI docs and the skills together.
