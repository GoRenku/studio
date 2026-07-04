# 0044 Use Media Generation Module Boundaries

Date: 2026-07-04

Status: accepted

## Context

Media generation already had shared lifecycle behavior, purpose-specific
implementations, cost approval, dependency planning, and engine execution.
Those rules were difficult to protect because several ownership boundaries were
expressed only by convention or brittle source-text architecture tests.

## Decision

Renku Studio will express media generation ownership through stable module
folders:

- Core cost projection, approval parsing, dependency cost plans, and cost-only
  purpose coverage live under `packages/core/src/server/media-generation/cost`.
- Core lifecycle orchestration lives under
  `packages/core/src/server/media-generation/lifecycle`.
- Shared dependency ids, selectors, dependency inventory, dependency draft
  contracts, and dependency line projection live under
  `packages/core/src/server/media-generation/dependencies`.
- Purpose implementations live under
  `packages/core/src/server/media-generation/purposes`.
- Shot Video Take purpose behavior is split into `authoring`, `planning`,
  `selection`, `specs`, `provider`, `runs`, `imports`, `persistence`, and
  `shared` submodules.
- Engine model catalog, pricing, and execution live under
  `packages/engines/src/generation/catalog`,
  `packages/engines/src/generation/pricing`, and
  `packages/engines/src/generation/execution`.

Static architecture tests should protect folder and import boundaries. They
must not hard-code private helper names, local variable names, or current
implementation inventories.

When a file moves into a new owner module, callers must import the new owner
directly. No compatibility forwarding files, alias modules, or non-`index.ts`
re-export stubs should remain for old media-generation paths.

## Consequences

Cost code can project prices and approval state without importing readiness,
provider payload preparation, generation runs, imports, dependency selectors,
database access, or file resolution.

Lifecycle services can read persisted specs, call purpose implementations,
prepare readiness, plan dependencies, and run approved specs while keeping
adapter code thin.

Shot Video Take ownership is visible in the filesystem. Planning does not
import provider, run, import, or persistence writer modules; selection does not
import provider, run, or import modules; provider preparation does not import
selection mutations or persistence writers.

Engine pricing can depend on catalog facts without importing provider SDKs,
input-file loading, provider payload validation, output persistence, or
generation runners.
