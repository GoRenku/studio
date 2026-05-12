# 0010 Use Domain Naming And Remove Obsolete Compatibility

Date: 2026-05-12

Status: accepted

## Context

Renku Studio is pre-customer software. The project is still shaping its core
domain model, storage layout, package boundaries, and UI surfaces.

At this stage, compatibility layers create more harm than value. Old names,
aliases, fallback loaders, and obsolete schema support make it unclear which
architecture is current. Vague placeholder names have the same problem: they
hide ownership and blur product concepts.

## Decision

Naming is an architecture boundary in Renku Studio.

Public contracts, schema names, service names, CLI commands, feature folders,
and docs must use deliberate domain vocabulary. Examples include `Project`,
`Episode`, `Sequence`, `Scene`, `Clip`, `CastMember`, `VisualLanguage`,
`Asset`, `AssetFile`, `take`, and `select`.

Avoid broad placeholder names such as `data`, `item`, `manager`, `helper`,
`detail`, `snapshot`, and `view` when a domain name exists.

Because the product is pre-customer, do not preserve obsolete APIs or formats:

- do not keep old names as aliases;
- do not add shims for prior APIs;
- do not add fallback branches for old structures;
- do not keep loaders for obsolete formats after a model changes;
- do not keep tests whose only purpose is to preserve obsolete behavior;
- rename callers directly when a name, API, schema, route, command, or file
  format changes.

## Consequences

- Current code and docs stay easier to read.
- Refactors can update callers directly instead of accumulating compatibility
  layers.
- Tests describe intended current behavior instead of preserving past designs.
- Historical context belongs in ADRs, plans, or exploration docs, not in active
  implementation paths.
