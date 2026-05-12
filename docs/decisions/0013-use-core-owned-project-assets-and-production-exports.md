# 0013 Use Core-Owned Project Assets And Production Exports

Date: 2026-05-12

Status: accepted

## Context

Renku Studio projects mix durable metadata with project files. Assets can belong
to the project as a whole or to specific domain targets such as visual language,
cast members, sequences, scenes, and clips.

The implementation has a core-owned asset graph with asset records, asset file
records, relationship tables, take/select state, and production export
operations. The CLI and Studio surfaces call core instead of editing these
relationships independently.

## Decision

`studio-core` owns the project asset graph and production export behavior.

Core owns:

- asset and asset-file records;
- asset relationship records for project, visual language, cast, sequence,
  scene, and clip targets;
- take versus select state;
- validation for asset targets and project-relative file paths;
- production export summaries and manifest behavior;
- the copy/prune/skip rules used by production export commands.

Working assets and production assets are different views of project files.
Working assets remain available inside the project graph. Production assets are
selected deliverables exported into a stable production folder shape.

Files do not define relationships by themselves. SQLite owns asset identity,
ownership, ordering, availability, and selection state.

## Consequences

- CLI, Studio server, UI, and agents share one asset contract.
- Production export is repeatable and inspectable instead of being a separate
  filesystem convention.
- Future generation tasks can register outputs through the same asset graph.
- Docs and code should use `select` for chosen assets and avoid ambiguous terms
  such as generic "materialization" unless describing implementation mechanics.
