# Use One Production And One Storyboard Lookbook Per Project

Date: 2026-07-14

Status: accepted

## Decision

Each project owns at most one `ProductionLookbook` and at most one
`StoryboardLookbook`. The role is the identity: Lookbooks are permanent, are
not a repeatable collection, and have no selected, active, default, or
last-opened state.

The Production Lookbook directs final-video visual language. The Storyboard
Lookbook directs storyboard drawing language. Either role may be unauthored,
and Studio still presents both fixed destinations. Each authored Lookbook may
own multiple generated sheet assets.

Storyboard authoring may inspect the project Production Lookbook, but no
durable Storyboard-to-Production pointer is stored.

## Ownership

Core owns the singleton invariant, role-specific document validation and
writes, role reads, generation-target validation, and structured diagnostics.
Lookbook owner rows are permanent: they cannot be discarded, restored, or
deleted. The database enforces one row per `lookbook.kind` with an unconditional
unique index. CLI, HTTP, and React code only forward role intent and project
Core resources.

## Migration

Migration `0055_project_lookbook_roles.sql` contains an intentional custom data
contraction before the Drizzle-generated rename, table drops, and unique index.
For each legacy role it keeps the explicitly selected current row. When no
selection exists, a sole current row is unambiguous; multiple current rows make
the migration fail before any mutation. Legacy `movie` becomes `production`,
and the selection and Storyboard-source tables are removed.

This custom SQL is necessary because a schema diff cannot express the required
data winner policy or its fail-fast preflight. Retained Lookbook ids keep their
owned images, sheets, card image, and Inspiration relationships.

Migration `0056_permanent-project-lookbooks.sql` removes the Lookbook owner
discard lifecycle columns and replaces the partial current-row index with an
unconditional unique index on `lookbook.kind`. Owned Lookbook Images and
Lookbook Sheets keep their independent recoverable discard lifecycle.

## Consequences

- Public document kinds are `productionLookbook` and `storyboardLookbook`.
- Project resources expose explicit nullable Production and Storyboard roles.
- Commands show and apply by role rather than list, create, update, select,
  discard, or clear selection.
- Generation callers read role-owned sheets directly.
- A role may be unauthored before its first apply. Later applies replace its
  document without changing the permanent owner row or its owned media.
