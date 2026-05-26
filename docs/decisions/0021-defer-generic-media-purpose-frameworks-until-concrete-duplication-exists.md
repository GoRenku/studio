# 0021 Defer Generic Media Purpose Frameworks Until Concrete Duplication Exists

Date: 2026-05-26

Status: accepted

## Context

The first media generation design introduced a generic media-purpose registry,
media-purpose definition interface, generic import handler layer, generation
policy documents, and provider/model capability metadata. That structure was
useful exploration, but it arrived before Renku Studio had enough implemented
media purposes to prove the abstractions.

The implemented Lookbook Image slice replaced that generic framework with a
small direct vertical slice.

## Decision

Do not introduce a generic media-purpose framework until concrete duplication
exists across multiple implemented purposes.

Keep stable purpose keys such as `lookbook.image`, and keep the shared CLI
language of generation context, model list, generation specs, estimate, run, and
media import. Internally, implement each early purpose directly.

For the next purpose, add a concrete purpose file and direct switch cases. For
example:

```text
packages/core/src/server/media-generation/
  lookbook-image.ts
  character-sheet.ts
```

The CLI may stay generic at the command surface, but it should dispatch through
plain direct switches until repeated implementation proves that a smaller shared
abstraction would remove real complexity.

Do not add these structures for the next purpose:

- `media-purpose-registry`;
- generic media-purpose definition interfaces;
- generation option registries;
- model adapter interfaces;
- per-model option files;
- model capability YAML;
- schema overlays;
- plugin-style purpose frameworks.

## Consequences

- New media purposes remain reviewable because their project context,
  validation, provider payload mapping, persistence, and import behavior are
  visible in one concrete slice.
- The team can extract shared code after two or three real purposes reveal
  actual duplication.
- Provider model JSON Schemas remain validation contracts for final payloads,
  not product API generators.
- Documentation and skills should describe current direct implementation, not
  the superseded generic registry design.

