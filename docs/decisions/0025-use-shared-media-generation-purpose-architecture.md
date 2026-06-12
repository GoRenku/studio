# 0025 Use Shared Media Generation Purpose Architecture

Date: 2026-06-03

Status: accepted

## Context

Decision `0021` deferred a generic media-purpose framework because the first
media generation slice did not yet have enough concrete duplication to justify
one. That condition has changed.

Renku Studio now has multiple implemented media generation purposes with the
same lifecycle:

- build project-aware context;
- list supported models;
- validate and persist a user-editable generation spec;
- prepare a provider request;
- estimate cost;
- run live or simulated generation;
- record the run;
- import generated files into purpose-specific project metadata.

Shot-video take generation also introduced concrete dependency planning
contracts: `MediaGenerationDependencyInventory`,
`MediaGenerationDependencyPricing`, `MediaGenerationPlanLine`, and explicit
unpriced pricing state.

Keeping every purpose on direct, repeated lifecycle code would make CLI,
Studio, and agent behavior drift as new purposes are added.

## Decision

Renku Studio will use a shared media generation purpose architecture in
`packages/core`.

The accepted architecture has:

- a media generation purpose registry;
- explicit purpose definitions;
- a shared generation service for common lifecycle operations;
- shared persisted spec and run records;
- shared prepared-generation requests consumed by `@gorenku/studio-engines`;
- shared dependency-inventory, plan-line, and pricing-state contracts where
  planning needs dependency projection.

Purpose definitions keep purpose-specific behavior:

- context construction;
- target validation;
- model controls;
- spec normalization and validation;
- prompt and provider payload construction;
- output names;
- output path needs;
- media import and project attachment behavior;
- dependency declarations when a purpose participates in a generation plan.

The shared service owns common lifecycle behavior:

- purpose lookup;
- unsupported-purpose diagnostics;
- generic spec validation, creation, update, read, and list entry points;
- prepare, estimate, and run orchestration;
- run recording;
- unpriced estimate handling and explicit override enforcement;
- CLI-facing dispatch through the shared core contract.

Dependency inventories are part of the shared media generation architecture,
not a shot-video-only concern. When a purpose has downstream requirements,
those requirements are represented as inventory lines with `dependencyId`,
`dependencyKind`, `target`, `purpose`, availability, generation draft state,
and explicit pricing state. Plan lines are projections of those inventory
lines.

Draft dependency specs are estimated through the same purpose registry and
provider payload builders as persisted specs. Draft estimation must not persist
temporary spec records, must not create placeholder asset records, and must not
invent project-relative file paths for outputs that do not exist. If a final
generation truly requires a file produced by a dependency, root spec creation
remains blocked until a real asset exists; the dependency line itself is still
priced when its draft spec is valid.

Studio and CLI surfaces must use the inventory estimate as the total estimate
when an inventory is present. An inventory-backed preview must not fall back to
final-only pricing, legacy estimate lines, compatibility shims, or contextual
cards that are not backed by dependency lines.

This decision supersedes the deferral direction in
`0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`.
The old ADR remains historical context and should not be edited.

## Consequences

- CLI handlers should call shared core generation operations instead of adding
  nested purpose dispatch.
- Studio Skills and agents continue to use the same CLI/core contracts as the
  browser.
- Generated media remains separate from imported project metadata. A generation
  run never attaches assets by itself.
- Missing pricing is represented as explicit unpriced state where a current
  product flow permits an override.
- Invalid targets, invalid specs, missing required files, and invalid provider
  mappings remain fail-fast structured errors.
- Shot-video reference routes plan cast character sheets, location environment
  sheets, and Lookbook reference images as inventory dependencies. The
  reference route may still treat those inputs as optional engine inputs;
  planning them does not make them required final-spec inputs unless the
  selected engine route requires them.

## Implementation References

- `packages/core/src/server/media-generation/purpose-registry.ts`
- `packages/core/src/server/media-generation/shared-generation-service.ts`
- `packages/core/src/client/media-generation.ts`
- `packages/core/tests/integration/media-generation-registry-contract.test.ts`
- `packages/core/tests/integration/media-generation-purpose-lifecycle-matrix.test.ts`
- `packages/core/tests/integration/media-generation-dependency-inventory.test.ts`
