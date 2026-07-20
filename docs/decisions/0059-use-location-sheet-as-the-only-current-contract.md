# 0059 Use Location Sheet As The Only Current Contract

Date: 2026-07-19

Status: accepted

## Context

The product already called this artifact a Location Sheet, while current
runtime and storage contracts still mixed `environment_sheet`,
`location_environment_sheet`, `environmentSheet*`, and
`environment-sheets/`. The mixed vocabulary obscured ownership and made agents,
the CLI, Core, Studio, and project data describe one domain concept differently.

Renku Studio is pre-customer software, and the only current development project
can be corrected directly. Preserving both vocabularies would create exactly
the compatibility layer the project architecture forbids.

## Decision

Location Sheet is the only current name and contract:

- product copy is `Location Sheet`;
- generation purpose is `location.sheet`;
- relationship role and Asset type are `location-sheet`;
- Location Design uses `locationSheetGuidance`;
- resource, helper, and key families use `locationSheet*` or
  `location-sheet:*`;
- durable files use `locations/<location-handle>/location-sheets/`.

Core, CLI, Studio, current tests, current documentation, and source skills use
these names directly. The Urban Basilica development project is backed up and
updated in place, including its database values, Location Design JSON keys,
AssetFile paths, and files.

## Consequences

- Current code and guidance contain one unambiguous Location Sheet vocabulary.
- No runtime converter, fallback, alias, obsolete-name diagnostic, Drizzle
  migration, or schema-version mechanism is added.
- Historical decision reasoning remains intact, with short supersession notices
  where its naming clauses are no longer current.
- This decision supersedes current Environment Sheet naming clauses in
  Decisions 0024, 0032, 0036, 0039, and 0041.
