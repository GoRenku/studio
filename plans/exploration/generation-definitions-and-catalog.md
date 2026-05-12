# Generation Definitions And Catalog Exploration

Date: 2026-05-10

Status: exploration

## Purpose

This note captures unresolved thinking about where system-owned generation
definitions should live.

It is intentionally exploration, not accepted architecture.

## Current Accepted Boundary

The accepted architecture is:

- generation definitions are code-owned system behavior;
- project folders do not contain editable generation definition folders;
- project files provide user-authored context and generated outputs;
- SQLite records generation keys, task records, provider runs, generation
  records, and output asset links.

## Open Question

Where should system-owned generation definitions live?

Possible options:

- inside `packages/core`;
- inside `packages/engines`;
- inside a catalog folder with providers and model schemas;
- inside a future generation runtime package;
- split between TypeScript orchestration and catalog metadata.

## Why The Old Catalog Section Was Confusing

The previous long draft included a "Catalog-Level Generation Definitions"
section that showed a possible folder layout:

```text
catalog/
  renku-studio/
    generation/
      cast.character-sheet/
      clip.video-take/
```

That was premature. It mixed an implementation packaging idea into a storage
document whose main job was to define project-local data boundaries.

The storage architecture only needs to decide that project folders do not own
editable generation definitions. The catalog/package layout can be decided when
generation implementation work starts.

## Questions To Answer Later

- Which package owns generation definition execution?
- Which package owns prompt templates and model defaults?
- Do generation definitions need JSON metadata, TypeScript modules, or both?
- How should generation definition versions be recorded in SQLite?
- How should provider/model schema validation connect to generation definitions?
- Which parts belong in `@gorenku/studio-core` versus
  `@gorenku/studio-engines`?
