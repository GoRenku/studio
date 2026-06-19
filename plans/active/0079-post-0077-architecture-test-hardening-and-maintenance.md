# 0079 Post-0077 Architecture Test Hardening And Maintenance

Status: implemented
Date: 2026-06-18
Implementation order: after `0077-take-contract-quality-review-remediation.md`

## Summary

This plan completes the broader architecture-test hardening work after `0077`
has moved take reference-selection mutation into focused core commands.

`0078` is the pre-0077 guardrail. `0077` is the architectural fix. This plan is
the follow-through: broaden the tests, add runtime boundary coverage, and make
architecture-test maintenance part of normal feature development.

The guiding rule is:

> Every hard boundary needs an enforcing test and a maintenance owner.

## Implementation Result

Implemented on 2026-06-18.

Added and hardened:

- core architecture tests for adapter-facing contract boundaries, private
  low-level take-state writers, and stable project-data-service ownership
  boundaries;
- CLI architecture tests blocking arbitrary take-state patching, deep imports
  of media-generation internals, and command-level database access;
- Studio frontend architecture tests blocking server/database imports, raw
  browser controls outside `src/ui`, and local resource-change listener
  ownership in feature code;
- runtime regressions for wrong-owner reference selections, unknown dependency
  inclusion ids, wrong-scene take production and shot-design updates,
  wrong-scene input select/clear/delete, wrong-scene input file resolution, and
  CLI wrong-scene shot-video production update;
- `docs/architecture/architecture-test-registry.md` as the maintenance registry
  for hard architecture boundaries.

The current frontend architecture guidance lives in
`docs/architecture/frontend.md` and
`docs/architecture/reference/front-end-guidelines.md`.

Follow-up note from `0080`: the runtime boundary coverage from this plan
remains the intended protection, but the long-term static-test maintenance
model has been revised. Static architecture tests should protect stable
ownership boundaries and broad escape hatches; they should not become a central
inventory of exact command names, helper names, or every legitimate mutation
function. Future plans should include an Architecture Test Impact note and add
new architecture tests only when existing guards do not cover the boundary or
failure mode.

## Prerequisites

Before implementing this plan:

- `0078` guardrail tests exist;
- `0077` has introduced focused core commands for take reference selections;
- Studio server routes call focused core commands instead of assembling durable
  take-state maps;
- route-local generic `statePatch` take mutation has been removed from the
  reference-selection path;
- focused 0078 architecture tests pass.

If any prerequisite is false, return to `0077` before starting this plan.

## Goals

- Harden CLI architecture tests so CLI remains a thin core-command adapter.
- Harden Studio frontend architecture tests so React feature code does not own
  server, database, resource-listener, or durable mutation rules.
- Add runtime boundary regression tests for stale UI requests, wrong ownership,
  wrong scene, and invalid dependency selection.
- Add a small architecture-test registry so tests are understandable and kept
  current.
- Define the update protocol for future feature work so architecture tests do
  not decay.

## Non-Goals

- Do not reintroduce broad take-state patching for convenience.
- Do not add compatibility aliases for the pre-0077 mutation shape.
- Do not preserve obsolete command names, DTO fields, or route behavior.
- Do not add route-local validation as a substitute for core ownership checks.
- Do not make architecture tests pass by expanding broad allowlists.

## Current Baseline After 0077

After 0077, the expected shape is:

- Studio server routes are HTTP adapters.
- Focused take reference-selection commands live in `packages/core`.
- Core validates ownership and scene membership against prepared take context.
- Invalid ids produce structured `PROJECT_DATA...` diagnostics before writes.
- Durable take state cannot be patched arbitrarily from Studio server routes.

This plan assumes that baseline and expands protection to the rest of the
system.

## Hardening Strategy

### Test Capabilities, Not Only File Names

Architecture tests should ban forbidden capabilities wherever they appear in an
adapter. File-name checks are still useful for preventing obsolete modules from
returning, but capability checks catch renamed shortcuts.

Examples:

- forbid CLI commands from exposing arbitrary take-state JSON patching;
- forbid adapters from inspecting durable take `referenceSelections` maps;
- forbid adapters from importing database access, schema, Drizzle, or core
  server internals outside accepted service boundaries.

### Pair Static Tests With Runtime Boundary Tests

Static architecture tests catch wrong ownership early. Runtime tests prove the
boundary actually protects project data.

For reference selection, both must exist:

- static test: adapters cannot assemble durable take reference-selection state;
- runtime test: wrong-owner ids fail with structured diagnostics before any
  SQLite write.

### Keep Tests Tied To Architecture Documents

Architecture tests should not feel like mysterious string scans. Each hard
boundary should map to:

- the owner package;
- the accepted architecture document or ADR;
- the static architecture test;
- the runtime regression tests;
- the forbidden adapter capabilities.

## Post-0077 Test Additions

### CLI Architecture Test Hardening

Extend:

```text
packages/cli/src/commands/command-architecture.test.ts
```

Forbidden CLI command capabilities:

- `updateSceneShotVideoTakeState`;
- `statePatch`;
- arbitrary `take update --file` raw state patching;
- direct imports of project database access, Drizzle schema, Drizzle, or SQLite
  drivers from command handlers.

Allowed CLI behavior:

- parse command flags;
- parse JSON files into typed current command inputs;
- call focused core commands and shared core generation services;
- format JSON or human output;
- deliver Studio resource-refresh notifications through the accepted server
  notification boundary.

### Core Contract Architecture Hardening

Extend:

```text
packages/core/src/server/architecture.test.ts
```

Assertions:

- generic take-state patch helpers, if retained internally, are not exported
  through adapter-facing service contracts;
- project-data-service wiring modules stay shallow;
- low-level durable take-state writers stay inside core-owned media generation
  modules.

### Frontend Architecture Test Hardening

Extend:

```text
packages/studio/src/architecture.test.ts
```

Assertions:

- feature code does not import `@gorenku/studio-core/server`;
- feature code does not import Node filesystem modules, Drizzle, or
  `better-sqlite3`;
- feature code does not use raw form controls outside `src/ui`;
- feature code does not assemble resource-key strings that should come from
  core-provided contracts or shared matchers.

The raw-control test should allow local `src/ui` primitives and block feature
files.

### Runtime Boundary Regression Tests

Add focused runtime tests for the most important hard boundaries.

Take reference selection:

- wrong Cast Member character-sheet selection fails before write;
- wrong Location sheet selection fails before write;
- wrong Lookbook sheet selection fails before write;
- wrong dialogue audio take selection fails before write;
- unknown dependency inclusion id fails before write.

Each failure must:

- return or throw a structured `PROJECT_DATA...` diagnostic;
- include a useful path pointing at the bad request field;
- leave previous take state unchanged.

Scene ownership:

- wrong-scene take production update fails before write;
- wrong-scene shot-design update fails before write;
- wrong-scene input select, clear, or delete fails before write;
- wrong-scene input file serving fails before streaming.

CLI contract:

- documented take-scoped shot-video commands work without caller-supplied
  `--shots`;
- wrong scene/take combinations fail with structured diagnostics;
- no public CLI command can write arbitrary take state JSON.

## Maintenance Model For Future Features

Architecture tests should be updated as part of normal feature work, not as a
rare cleanup pass.

### Feature Plan Requirement

Superseded by `0080`.

Future plans should include an Architecture Test Impact note, not a mandatory
architecture-test expansion checklist. The note should identify the owner
package, the adapter boundary, existing static or runtime protection, and
whether the feature introduces a new boundary category or failure mode.

If existing tests already protect the boundary, the plan should say that
explicitly. Routine feature growth should not require adding command names,
helper names, dependency-id prefixes, or every legitimate mutation function to a
central architecture-test inventory.

### Feature Development Update Protocol

Architecture Test Impact review is part of the definition of done for feature
work. Architecture tests are added only when that review shows a current guard
does not cover the boundary.

For every new feature branch or implementation slice:

1. Identify the owner package before implementation starts.
2. Check the architecture-test registry in the same slice.
3. Add or update static architecture tests only for new stable adapter
   boundaries or broad escape-hatch risks.
4. Add or update runtime boundary tests when invalid input, stale UI requests,
   wrong-scene ownership, wrong-project ownership, or invalid dependency
   selection reveal a new behavior gap.
5. Remove tests for superseded boundaries when the architecture changes.
6. Run the focused architecture and runtime boundary tests before calling the
   feature complete.

No feature that crosses an architectural boundary should be considered
complete until the Architecture Test Impact note explains how the intended
boundary is protected.

### Architecture Test Registry

Maintain a short registry near the architecture tests or in:

```text
docs/architecture/architecture-test-registry.md
```

Suggested registry shape:

```text
Boundary: Studio server routes are thin adapters.
Owner doc: docs/architecture/reference/studio-server-hono.md
Static test: packages/studio/server/architecture.test.ts
Runtime tests: packages/studio/server/routes/*test.ts
Forbidden capabilities: route-local durable metadata map assembly, generic state patching
```

This registry should be updated in the same slice that changes the boundary. It
should not become an inventory of every allowed implementation function.

### Review Gate

When reviewing a feature:

- if a new adapter method writes metadata, check for a focused core command;
- if a new route contains domain vocabulary from a durable state map, ask why
  that logic is not in core;
- if a new CLI command accepts raw JSON, check whether the JSON is a typed
  current contract for a focused core operation or an arbitrary metadata patch;
- if a new React workflow parses ids or resource keys, check whether core
  should return explicit mutation data instead;
- if a new exception is added to an architecture test, require the exception to
  name the owning architecture doc and why the boundary still holds.

### Updating Tests Without Making Them Brittle

Prefer tests that ban capabilities and imports over tests that depend on exact
line counts.

Good patterns:

- scan route files for forbidden service method calls;
- scan feature files for forbidden imports;
- scan CLI command files for forbidden raw patch fields;
- assert public service contracts do or do not expose specific methods;
- use small allowlists for legitimate infrastructure files.

Avoid:

- broad scans for common words such as `data`, `item`, or `view` without
  context;
- huge allowlists that normalize violations;
- line-count-only checks for complex areas;
- tests that preserve obsolete API names just to reject them at runtime.

### When A Boundary Changes

If a feature legitimately changes a boundary:

1. update the accepted architecture doc or create an ADR first;
2. update the architecture-test registry;
3. update static architecture tests in the same implementation slice;
4. update runtime boundary tests;
5. remove old tests that protect the superseded boundary.

Do not keep both old and new architecture tests as a compatibility period
unless the user explicitly asks for staged migration.

## Implementation Slices

### Slice 1: Consolidate Post-0077 Core Contract Tests

- Confirm adapter-facing contracts do not expose generic take-state patching.
- Keep any low-level state writer private to core internals.

### Slice 2: Harden CLI Architecture Tests

- Extend `command-architecture.test.ts`.
- Ban public arbitrary take-state patching.
- Ban command-handler database access.
- Ensure generation command handlers continue using shared core services.

### Slice 3: Harden Frontend Architecture Tests

- Extend `packages/studio/src/architecture.test.ts`.
- Ban server-core imports and Node/database imports from feature code.
- Ban raw controls outside `src/ui`.
- Keep shared resource-change listener ownership in the shared hook.

### Slice 4: Add Runtime Boundary Regression Tests

- Add invalid reference-selection tests.
- Add wrong-scene take mutation tests.
- Add wrong-scene input file serving tests.
- Add CLI command contract tests.

### Slice 5: Add Maintenance Documentation

- Add `docs/architecture/architecture-test-registry.md`.
- Link each enforced boundary to the owner document and test.
- Add active-plan guidance requiring architecture-test updates for new feature
  boundaries.
- Keep exception policy explicit and narrow.

## Completion Checklist

### Review And Scope

- [x] Confirm `0078` has been implemented.
- [x] Confirm `0077` has been implemented.
- [x] Confirm focused 0078 architecture tests pass after 0077.
- [x] Confirm this plan aligns with `AGENTS.md` architecture hard-gate
      language.
- [x] Confirm this plan aligns with
      `docs/architecture/layers-of-responsibility.md`.
- [x] Confirm this plan aligns with
      `docs/architecture/reference/studio-server-hono.md`.
- [x] Confirm this plan aligns with
      `docs/decisions/0026-use-thin-structured-cli-command-handlers.md`.
- [x] Confirm this plan aligns with
      `docs/architecture/frontend.md` and
      `docs/architecture/reference/front-end-guidelines.md`.

### Core Static Tests

- [x] Assert adapter-facing contracts do not expose generic take-state
      patching.
- [x] Confirm any low-level state writer is private to core internals.
- [x] Keep project-data-service wiring shallow.
- [x] Avoid exact focused command or helper-name inventories.

### CLI Static Tests

- [x] Ban `updateSceneShotVideoTakeState` in CLI command files.
- [x] Ban `statePatch` in CLI command files.
- [x] Remove or replace `renku take update --file` arbitrary state patching.
- [x] Ban command-handler database access.
- [x] Avoid dependency-id prefix inventories in static CLI tests.
- [x] Keep command handler registry tests current.

### Frontend Static Tests

- [x] Ban `@gorenku/studio-core/server` imports from `packages/studio/src`.
- [x] Ban Node filesystem/database imports from `packages/studio/src`.
- [x] Ban Drizzle and `better-sqlite3` imports from `packages/studio/src`.
- [x] Ban raw browser controls outside `packages/studio/src/ui`.
- [x] Avoid dependency-id prefix inventories in frontend static tests.
- [x] Keep resource-change subscription ownership in the shared hook.

### Runtime Boundary Tests

- [x] Add wrong Cast Member character-sheet selection regression test.
- [x] Add wrong Location sheet selection regression test.
- [x] Add wrong Lookbook sheet selection regression test.
- [x] Add wrong dialogue audio take selection regression test.
- [x] Add unknown dependency inclusion regression test.
- [x] Add wrong-scene take production update regression test.
- [x] Add wrong-scene shot-design update regression test.
- [x] Add wrong-scene input select regression test.
- [x] Add wrong-scene input clear regression test.
- [x] Add wrong-scene input delete regression test.
- [x] Add wrong-scene input file serving regression test.
- [x] Add CLI documented take-scoped shot-video command tests.
- [x] Assert invalid mutations leave previous take state unchanged.
- [x] Assert invalid mutations produce structured `PROJECT_DATA...`
      diagnostics.

### Maintenance Process

- [x] Add `docs/architecture/architecture-test-registry.md`.
- [x] Register the Studio server thin-adapter boundary.
- [x] Register the CLI thin-command boundary.
- [x] Register the React projection-consumer boundary.
- [x] Register the core-owned durable mutation boundary.
- [x] Add architecture-test requirements to active-plan guidance.
- [x] Require every new route, CLI command, React mutation workflow, durable
      metadata mutation, media-generation purpose, and public core method to
      declare which architecture tests protect its boundary.
- [x] Document how to update tests when an accepted ADR changes a boundary.
- [x] Keep exceptions small, named, and tied to accepted architecture docs.

### Verification

- [x] Run focused core architecture tests.
- [x] Run focused Studio server architecture tests.
- [x] Run focused Studio frontend architecture tests.
- [x] Run focused CLI architecture tests.
- [x] Run focused route/runtime regression tests added by this plan.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run `pnpm check`.
