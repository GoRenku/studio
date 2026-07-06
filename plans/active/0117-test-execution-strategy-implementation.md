# 0117 Test Execution Strategy Implementation

Status: implemented with local browser-smoke blocker
Date: 2026-07-06

## Implementation Result

Implemented on 2026-07-06.

The implementation split the default fast test suites from deterministic
integration suites without deleting or weakening protected tests:

- Core integration tests now run through `@gorenku/studio-core`
  `test:integration`.
- Studio source-local `.e2e.test.*` files now run through `@gorenku/studio`
  `test:integration`.
- The named Studio estimate matrix command now uses the Studio integration
  config.
- The broad CLI workflow suite moved to
  `packages/cli/tests/integration/cli-workflows.test.ts`.
- The Engines unified simulation flow moved to
  `packages/engines/tests/integration/unified-simulation-flow.test.ts`.
- Root `pnpm test` now stays on package fast suites.
- Root `pnpm test:integration`, `pnpm test:final`, and
  `pnpm check:test-execution` were added.
- `docs/architecture/test-execution-strategy.md` now documents the implemented
  command model.

Verification passed for `pnpm check`, `pnpm test`, `pnpm test:integration`, the
package-level fast and integration commands, and the named Studio estimate
matrix command.

`pnpm test:e2e:studio:smoke` was attempted but blocked before any app assertion
ran because local Chromium failed to launch with
`MachPortRendezvousServer ... Permission denied`. Because `pnpm test:final`
includes that smoke command, it was not rerun after the same blocker was
identified. Engines live-provider e2e was not run because this implementation
did not touch provider-facing behavior.

## Summary

This plan implements the test execution model described in
`docs/architecture/test-execution-strategy.md`.

The goal is faster development feedback without losing coverage. The current
test suite has valuable slow tests, especially Core integration tests, Studio
in-process e2e tests, Studio Playwright tests, and Engines provider e2e tests.
Those tests should remain. The fix is to run them through explicit final
verification commands instead of pulling them into ordinary package test loops.

The target result is:

- focused fast tests while editing;
- fast package suites in the default `pnpm test` path;
- explicit local integration suites for cross-layer deterministic coverage;
- existing browser and live-provider e2e suites kept as final opt-in gates;
- no deleted, skipped, weakened, or orphaned tests as a speed tactic.

This is a test planning and command-shaping change. It does not change Studio
runtime behavior, project data rules, generation contracts, or package
ownership boundaries.

## Source Investigation

This plan follows the investigation in:

`docs/architecture/test-execution-strategy.md`

Important findings from that document:

- Root `pnpm test` currently runs Diagnostics, Core, CLI, Engines, and Studio
  package tests.
- Core default Vitest currently includes `packages/core/tests/integration/**`
  through `tests/**/*.test.ts`.
- Studio default Vitest currently includes source-local in-process e2e tests
  because `src/**/*.e2e.test.*` also matches `src/**/*.test.*`.
- Engines already has separate `test`, `test:integration`, and `test:e2e`
  commands, but one source-local file is named and shaped like integration:
  `packages/engines/src/sdk/unified/simulation-integration.test.ts`.
- Studio browser e2e is already separate through Playwright commands.
- CLI has a very broad `packages/cli/src/cli.test.ts` workflow contract suite
  inside the default CLI test command.

The investigation's key principle is the rule for slow tests:

> If a slow test is valuable, keep it. Then add fast owner-layer coverage so the
> slow test only needs to run at the end.

## Coverage Preservation Contract

Coverage preservation is a hard requirement for this plan.

Implementation must obey these rules:

- Do not delete any current test merely to speed up `pnpm test`.
- Do not replace a slow test with `it.skip`, `it.todo`, looser assertions, or a
  smaller assertion set as part of this split.
- Do not move a test out of the default suite unless it is included in an
  explicit integration or e2e command.
- Preserve assertions when moving or renaming test files.
- If a test is split into several files, every existing behavior it checked
  must be represented by either the new fast owner-layer tests, the moved
  integration test, or both.
- If implementation finds a test is obsolete because the product contract has
  changed, handle that as a separate review. Do not hide that decision inside
  this speed-up work.
- If a slow test catches a bug during this work, add or update the smallest
  owning-layer fast test before fixing the bug, then keep the slow test as final
  verification.

Protected slow tests explicitly include:

- `packages/studio/src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts`
- `packages/studio/src/services/scene-shot-video-take-state-persistence.e2e.test.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-location-sheets.e2e.test.tsx`
- `packages/core/tests/integration/media-generation-dependency-inventory.test.ts`
- `packages/core/tests/integration/media-generation-purpose-lifecycle-matrix.test.ts`
- `packages/core/tests/integration/media-generation-registry-contract.test.ts`
- Studio Playwright specs under `packages/studio/e2e/tests/**`
- Engines live-provider e2e tests under `packages/engines/tests/e2e/**`

These tests may be moved into better execution buckets when needed, but they
must not be weakened or dropped.

## Test Tier Model

### Tier 1: Focused Fast Tests

These are individual files run during active editing:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/cost/cost-projection.test.ts
pnpm --dir packages/studio exec vitest run src/features/movie-studio/scenes/shot-video-take-production-projection.test.ts
pnpm --dir packages/cli exec vitest run src/commands/generation-command-handlers.test.ts
pnpm --dir packages/engines exec vitest run src/sdk/replicate/retry.test.ts
```

Tier 1 owns the repeated edit loop. It should cover pure domain functions,
command handlers, serializers, projections, hooks, and mocked adapter behavior.

### Tier 2: Package Fast Suites

These commands are the normal package-level development checkpoint:

```bash
pnpm --filter @gorenku/studio-diagnostics test
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio-engines test
pnpm --filter @gorenku/studio test
```

Root `pnpm test` should remain the composition of package fast suites. It must
not include Core integration tests, Studio in-process e2e tests, Studio browser
e2e, or Engines live-provider e2e.

### Tier 3: Local Integration Suites

These commands are deterministic local final checks:

```bash
pnpm --filter @gorenku/studio-core test:integration
pnpm --filter @gorenku/studio-cli test:integration
pnpm --filter @gorenku/studio-engines test:integration
pnpm --filter @gorenku/studio test:integration
```

Root integration should be:

```bash
pnpm test:integration
```

Tier 3 may use real project databases, cross-layer service wiring, route stacks,
and broad workflow contracts. It should not require a browser, provider
credentials, external network calls, or paid generation.

### Tier 4: Browser And Live-Provider E2E

These remain final opt-in gates:

```bash
pnpm test:e2e:studio:smoke
pnpm test:e2e:studio
pnpm --dir packages/engines test:e2e
```

Studio browser e2e is used when the browser workflow changed. Engines
live-provider e2e is used when provider adapters, provider payloads, provider
schemas, live request/response contracts, pricing, or execution behavior
changed.

## Target Command Model

After this plan is implemented, the root scripts should have these meanings:

```json
{
  "test": "package fast suites only",
  "test:integration": "deterministic local integration suites",
  "test:e2e:studio:smoke": "existing Playwright smoke suite",
  "test:e2e:studio": "existing full Studio browser suite",
  "test:final": "check, fast tests, integration tests, and Studio smoke e2e"
}
```

The concrete root script additions should be:

```json
{
  "test:integration": "pnpm --filter @gorenku/studio-core test:integration && pnpm --filter @gorenku/studio-cli test:integration && pnpm --filter @gorenku/studio-engines test:integration && pnpm --filter @gorenku/studio test:integration",
  "test:final": "pnpm check && pnpm test && pnpm test:integration && pnpm test:e2e:studio:smoke"
}
```

Do not add Engines live-provider e2e to `test:final`. That suite can require
credentials, network access, time, and cost. It remains an explicit provider
verification command.

Do not replace `pnpm check` with `pnpm test:final`. `check` remains the
mechanical type, lint, test-typecheck, and architecture gate. `test:final` is a
developer convenience for the complete local confidence path.

## Package Changes

### Core

Current issue:

- `packages/core/vitest.config.ts` includes both source-adjacent tests and
  `packages/core/tests/integration/**`.

Target changes:

- Keep `packages/core/src/**/*.test.ts` in the default Core fast suite.
- Add `packages/core/vitest.integration.config.ts`.
- Include `packages/core/tests/integration/**/*.test.ts` only in the Core
  integration config.
- Copy the current Core Vitest alias for `@gorenku/studio-engines` into the
  integration config.
- Preserve the current single-worker behavior unless profiling proves a safe
  package-local parallelism improvement.
- Add a Core package script:

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts --pool=forks"
}
```

The default Core `test` script remains fast. The integration files stay under
`packages/core/tests/integration/**` because that directory already names the
right tier.

### Studio

Current issue:

- `packages/studio/vitest.config.ts` includes
  `packages/studio/src/**/*.e2e.test.ts` and
  `packages/studio/src/**/*.e2e.test.tsx` through broad source test globs.

Target changes:

- Keep server route tests, service unit tests, React component tests, hooks, UI
  primitive tests, and architecture tests in the default Studio fast suite.
- Exclude `src/**/*.e2e.test.ts` and `src/**/*.e2e.test.tsx` from
  `packages/studio/vitest.config.ts`.
- Add `packages/studio/vitest.integration.config.ts`.
- Include only `src/**/*.e2e.test.ts` and `src/**/*.e2e.test.tsx` in the Studio
  integration config.
- Copy the current Studio Vitest aliases for `@`, `@gorenku/studio-core/client`,
  and `@gorenku/studio-core/server` into the integration config.
- Add a Studio package script:

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts"
}
```

- Keep the named estimate matrix command, but point it at the integration
  config so it still runs after the default config excludes e2e files:

```json
{
  "test:shot-video-estimates": "vitest run --config vitest.integration.config.ts src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts"
}
```

The Studio Playwright suite under `packages/studio/e2e/tests/**` remains
separate and continues to use `test:e2e`, `test:e2e:smoke`, `test:e2e:headed`,
and `test:e2e:ui`.

### CLI

Current issue:

- `packages/cli/src/cli.test.ts` is a broad workflow contract suite. It creates
  temporary projects, exercises full CLI flows, and validates human and
  agent-facing behavior inside the default CLI test command.

Target changes:

- Move `packages/cli/src/cli.test.ts` to
  `packages/cli/tests/integration/cli-workflows.test.ts`.
- Preserve all assertions and helpers from the current file during the move.
- Update imports from the moved file to reference the CLI source directly.
- Add `packages/cli/vitest.integration.config.ts` with the same aliases as the
  default CLI Vitest config.
- Keep focused command, notification, architecture, parsing, formatting, and
  handler tests under `packages/cli/src/**/*.test.ts` in the fast CLI suite.
- Update `packages/cli/tsconfig.vitest.json` so moved integration tests remain
  typechecked.
- Update `packages/cli` lint coverage to include `tests` if the moved file
  should remain linted.
- Add a CLI package script:

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts --pool=threads --poolOptions.threads.singleThread"
}
```

Do not subdivide the CLI workflow suite in the first implementation slice
unless the move itself requires it. Preserving coverage takes priority. A later
cleanup may split it into domain-named workflow files, but this plan only needs
to move the broad workflow contract out of the fast package command.

### Engines

Current status:

- Engines already has `test`, `test:integration`, and `test:e2e` commands.
- `packages/engines/tests/integration/**` and
  `packages/engines/tests/e2e/**` are already outside the default fast suite.

Current issue:

- `packages/engines/src/sdk/unified/simulation-integration.test.ts` lives under
  `src`, matches the default fast suite, and describes itself as a full
  pipeline integration test.

Target changes:

- Move `packages/engines/src/sdk/unified/simulation-integration.test.ts` to
  `packages/engines/tests/integration/unified-simulation-flow.test.ts`.
- Preserve all assertions and helpers during the move.
- Update imports from the moved file to reference source modules explicitly.
- Keep the existing `packages/engines/vitest.integration.config.ts` command as
  the integration runner.
- Confirm `packages/engines/tsconfig.vitest.json` continues to typecheck the
  moved file through its existing `tests/**/*.ts` include.

Do not move live-provider e2e files into integration. Provider e2e remains
credential-gated and explicit.

### Diagnostics

Diagnostics has no separate integration bucket in the current investigation.

Target changes:

- Leave `@gorenku/studio-diagnostics` package tests in the default fast suite.
- Do not create a no-op Diagnostics `test:integration` script merely for
  symmetry.

## Fast Coverage Audit For Protected Slow Tests

Before treating the protected slow tests as final-only checks, confirm that the
rules they protect have fast owner-layer coverage.

For the Studio AI Production estimate matrix, fast coverage should exist around:

- Core cost projection arithmetic.
- Purpose lifecycle estimate behavior.
- Dependency inventory line materialization.
- Dependency draft estimate behavior.
- Route coverage key generation.
- Studio API serialization and deserialization.
- Studio React projection formatting for estimate lines.
- AI Production tab rendering for supplied DTOs without real providers.

Existing likely fast coverage includes, but is not limited to:

- `packages/core/src/server/media-generation/cost/cost-projection.test.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-estimates.test.ts`
- `packages/core/src/server/media-generation/lifecycle/shot-video-take-production-estimates.test.ts`
- `packages/core/src/server/media-generation/dependencies/dependency-inventory-lines.test.ts`
- `packages/core/src/server/media-generation/dependencies/dependency-draft-specs.test.ts`
- `packages/studio/src/services/studio-shot-video-takes-api.test.ts`
- `packages/studio/src/features/movie-studio/scenes/shot-video-take-production-projection.test.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx`

Implementation should audit these tests against the matrix's protected behavior.
If a rule is only protected by the matrix, add a fast owner-layer test for that
rule before relying on the matrix only as a final integration check.

The same pattern applies to the CLI workflow suite and Core dependency planner
integration tests: keep the broad final test, but add or keep focused tests at
the owning layer for regressions discovered there.

## Test Execution Guardrail

Add a small execution-partition audit if the split starts to drift.

Preferred file:

`scripts/check-test-execution-partitions.mjs`

The script should inspect broad path patterns, not implementation helper names.
It should report:

- Core integration tests under `packages/core/tests/integration/**` are not
  matched by Core fast config.
- Studio source e2e tests matching `packages/studio/src/**/*.e2e.test.*` are
  not matched by Studio fast config.
- CLI workflow integration tests under `packages/cli/tests/integration/**` are
  not matched by CLI fast config.
- Engines integration tests under `packages/engines/tests/integration/**` are
  not matched by Engines fast config.
- Each integration bucket has a corresponding package `test:integration`
  command.

The script must avoid listing every allowed test file or freezing private test
helper names. Its job is to protect execution buckets, not to become a test
inventory that ordinary refactors must edit.

Add a root script only if the implementation can keep it low-noise:

```json
{
  "check:test-execution": "node scripts/check-test-execution-partitions.mjs"
}
```

If this script is added and proves stable, include it in `pnpm check` after the
architecture checks. If it is too noisy, skip the script and rely on package
scripts plus the completion checklist for this implementation slice.

## Implementation Slices

### Slice 1: Baseline Inventory

Create a temporary implementation note or command output capture with:

- current test files under `packages/**`;
- current slow/protected files;
- current package script names;
- current default fast-suite candidates;
- current integration/e2e-suite candidates.

This inventory is implementation support only. Do not commit generated inventory
files unless they become an intentionally maintained document.

### Slice 2: Core Split

- Add `packages/core/vitest.integration.config.ts`.
- Update `packages/core/vitest.config.ts` to exclude integration tests from the
  default suite.
- Add `packages/core` `test:integration`.
- Run Core fast tests and Core integration tests separately.
- Confirm all Core integration files still run.

### Slice 3: Studio Vitest Split

- Add `packages/studio/vitest.integration.config.ts`.
- Update `packages/studio/vitest.config.ts` to exclude source e2e tests.
- Add `packages/studio` `test:integration`.
- Update `test:shot-video-estimates` to use the integration config.
- Run Studio fast tests, Studio integration tests, the estimate matrix command,
  and the existing Playwright smoke suite.

### Slice 4: CLI Workflow Split

- Move `packages/cli/src/cli.test.ts` to
  `packages/cli/tests/integration/cli-workflows.test.ts`.
- Add `packages/cli/vitest.integration.config.ts`.
- Add `packages/cli` `test:integration`.
- Update CLI test typecheck and lint coverage for moved tests.
- Run CLI fast tests and CLI integration tests separately.

### Slice 5: Engines Integration Classification

- Move `packages/engines/src/sdk/unified/simulation-integration.test.ts` to
  `packages/engines/tests/integration/unified-simulation-flow.test.ts`.
- Update imports after the move.
- Run Engines fast tests and Engines integration tests separately.
- Do not change Engines live-provider e2e execution.

### Slice 6: Root Scripts And Documentation

- Add root `test:integration`.
- Add root `test:final`.
- Update `docs/architecture/test-execution-strategy.md` from investigation
  status to implemented command guidance once the split lands.
- Document which final suites are expected for common change types.
- Add the low-noise execution-partition check only if it proves useful and does
  not freeze implementation details.

### Slice 7: Final Verification

- Run fast package suites through root `pnpm test`.
- Run root `pnpm test:integration`.
- Run root `pnpm test:e2e:studio:smoke`.
- Run `pnpm check`.
- Run full Studio browser e2e only if this implementation changes browser e2e
  infrastructure or if smoke surfaces an issue that needs wider browser
  verification.
- Do not run Engines live-provider e2e unless the implementation touches
  provider adapters, provider request/response contracts, pricing, schemas, or
  execution behavior.

## Expected Developer Workflow After Implementation

For a Core cost projection change:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/cost/cost-projection.test.ts
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-core test:integration
```

For a Studio React projection change:

```bash
pnpm --dir packages/studio exec vitest run src/features/movie-studio/scenes/shot-video-take-production-projection.test.ts
pnpm --filter @gorenku/studio test
pnpm test:e2e:studio:smoke
```

For a CLI command-handler change:

```bash
pnpm --dir packages/cli exec vitest run src/commands/generation-command-handlers.test.ts
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio-cli test:integration
```

For an Engines provider adapter change:

```bash
pnpm --dir packages/engines exec vitest run src/sdk/replicate/retry.test.ts
pnpm --filter @gorenku/studio-engines test
pnpm --filter @gorenku/studio-engines test:integration
pnpm --dir packages/engines test:e2e
```

The final provider e2e command is only for provider-facing changes and requires
the appropriate credentials and cost awareness.

## Non-Goals

- Do not remove valuable slow tests.
- Do not make the test suite faster by weakening assertions.
- Do not add runtime fallback behavior or compatibility paths to satisfy tests.
- Do not move business rules into Studio routes, CLI handlers, React components,
  or test fixtures.
- Do not add browser e2e to root `pnpm test`.
- Do not add Engines live-provider e2e to root `pnpm test` or `pnpm test:final`.
- Do not optimize mobile viewport behavior as part of this plan.
- Do not run `pnpm install`, `pnpm add`, or dependency update commands for this
  split unless a separate implementation step explicitly requires it.

## Completion Checklist

### Review And Architecture

- [x] Confirm `docs/architecture/test-execution-strategy.md` is the source
      investigation for this implementation.
- [x] Confirm the implementation preserves all existing test assertions or
      documents an explicit replacement mapping for any split test.
- [x] Confirm no slow test is deleted, skipped, converted to `todo`, or weakened
      as a speed tactic.
- [x] Confirm package boundaries are unchanged: Core owns domain rules, Studio
      routes stay thin, CLI stays a command adapter, and React stays a projection
      and user-intent layer.
- [x] Confirm no compatibility shims, fallback loaders, obsolete shape support,
      or test-only business rules are added.
- [x] Confirm the implementation does not add mobile viewport testing.

### Baseline Inventory

- [x] List current Core fast and integration test files before changing Core
      config.
- [x] List current Studio fast, in-process e2e, and Playwright test files before
      changing Studio config.
- [x] List current CLI fast and workflow test files before moving the broad CLI
      workflow suite.
- [x] List current Engines fast, integration, and live-provider e2e files before
      moving the unified simulation flow test.
- [x] Record current package scripts so the final command model can be reviewed
      against the starting point.

### Core Package

- [x] Add `packages/core/vitest.integration.config.ts`.
- [x] Keep `packages/core/src/**/*.test.ts` in the default Core fast config.
- [x] Remove `packages/core/tests/integration/**/*.test.ts` from the default
      Core fast config.
- [x] Include `packages/core/tests/integration/**/*.test.ts` in the Core
      integration config.
- [x] Preserve Core Vitest aliases in the integration config.
- [x] Add `packages/core` `test:integration`.
- [x] Confirm `packages/core/tsconfig.vitest.json` still typechecks Core
      integration tests.
- [x] Run Core fast tests.
- [x] Run Core integration tests.

### Studio Package

- [x] Add `packages/studio/vitest.integration.config.ts`.
- [x] Keep server tests, route tests, services tests, React tests, hooks tests,
      UI tests, and architecture tests in the default Studio fast config.
- [x] Exclude `packages/studio/src/**/*.e2e.test.ts` and
      `packages/studio/src/**/*.e2e.test.tsx` from the default Studio fast
      config.
- [x] Include Studio source e2e tests in the Studio integration config.
- [x] Preserve Studio Vitest aliases in the integration config.
- [x] Add `packages/studio` `test:integration`.
- [x] Update `packages/studio` `test:shot-video-estimates` to use the Studio
      integration config.
- [x] Confirm `packages/studio/tsconfig.vitest.json` still typechecks Studio
      source e2e tests.
- [x] Run Studio fast tests.
- [x] Run Studio integration tests.
- [x] Run the named estimate matrix command.
- [ ] Run Studio Playwright smoke. Blocked locally by Chromium launch failure:
      `MachPortRendezvousServer ... Permission denied`.

### CLI Package

- [x] Move `packages/cli/src/cli.test.ts` to
      `packages/cli/tests/integration/cli-workflows.test.ts`.
- [x] Preserve all assertions and helper behavior from the existing CLI workflow
      test.
- [x] Update moved test imports to reference CLI source modules correctly.
- [x] Add `packages/cli/vitest.integration.config.ts`.
- [x] Keep focused CLI command and handler tests in the default CLI fast config.
- [x] Include `packages/cli/tests/integration/**/*.test.ts` in the CLI
      integration config.
- [x] Add `packages/cli` `test:integration`.
- [x] Update `packages/cli/tsconfig.vitest.json` so CLI integration tests remain
      typechecked.
- [x] Update `packages/cli` lint coverage for moved tests if linting those files
      remains desired.
- [x] Run CLI fast tests.
- [x] Run CLI integration tests.

### Engines Package

- [x] Move `packages/engines/src/sdk/unified/simulation-integration.test.ts` to
      `packages/engines/tests/integration/unified-simulation-flow.test.ts`.
- [x] Preserve all assertions and helper behavior from the existing unified
      simulation flow test.
- [x] Update moved test imports to reference Engines source modules correctly.
- [x] Confirm the existing Engines integration config includes the moved file.
- [x] Confirm Engines live-provider e2e stays under
      `packages/engines/tests/e2e/**`.
- [x] Run Engines fast tests.
- [x] Run Engines integration tests.
- [x] Do not run Engines live-provider e2e unless provider-facing behavior was
      changed.

### Root Scripts

- [x] Add root `test:integration`.
- [x] Add root `test:final`.
- [x] Confirm root `pnpm test` runs fast package suites only.
- [x] Confirm root `pnpm test:integration` runs Core, CLI, Engines, and Studio
      deterministic integration suites.
- [x] Confirm root `pnpm test:final` is scripted to run `pnpm check`,
      `pnpm test`, `pnpm test:integration`, and
      `pnpm test:e2e:studio:smoke`.
- [x] Confirm root `pnpm test:final` does not run Engines live-provider e2e.

### Fast Coverage Audit

- [x] Audit fast coverage for Core cost projection arithmetic.
- [x] Audit fast coverage for purpose lifecycle estimate behavior.
- [x] Audit fast coverage for dependency inventory line materialization.
- [x] Audit fast coverage for dependency draft estimate behavior.
- [x] Audit fast coverage for route coverage key generation.
- [x] Audit fast coverage for Studio API serialization and deserialization.
- [x] Audit fast coverage for Studio React estimate projection formatting.
- [x] Add missing fast owner-layer tests for any behavior currently protected
      only by the AI Production estimate matrix. No missing owner-layer coverage
      was identified during this split.
- [x] Audit CLI workflow failures against focused command-handler or Core tests.
- [x] Audit Core integration failures against focused Core tests.

### Optional Execution Guardrail

- [x] Decide whether `scripts/check-test-execution-partitions.mjs` is worth
      adding after the package split is implemented.
- [x] If added, ensure the script checks broad execution buckets instead of
      hardcoding individual implementation helper names.
- [x] If added, ensure the script reports slow tests leaking into fast configs.
- [x] If added, ensure the script reports integration buckets with no
      `test:integration` command.
- [x] If added and stable, add root `check:test-execution`.
- [x] If added and stable, include `check:test-execution` in root `pnpm check`.

### Documentation

- [x] Update `docs/architecture/test-execution-strategy.md` with the implemented
      command model.
- [x] Document that root `pnpm test` is the fast suite, not the complete final
      verification gate.
- [x] Document `pnpm test:integration` as the deterministic local integration
      gate.
- [x] Document `pnpm test:final` as the default local final confidence command.
- [x] Document when to run full Studio browser e2e.
- [x] Document when to run Engines live-provider e2e.
- [x] Document the slow-test bug loop: reproduce once, add fast owner-layer
      regression, fix, rerun fast test, then rerun slow final check once.

### Final Verification

- [x] Run `pnpm test`.
- [x] Run `pnpm test:integration`.
- [ ] Run `pnpm test:e2e:studio:smoke`. Attempted, but blocked locally by
      Chromium launch failure before app assertions ran:
      `MachPortRendezvousServer ... Permission denied`.
- [x] Run `pnpm check`.
- [ ] Run `pnpm test:final` once the script exists. Not rerun because its first
      three commands passed separately and its final browser smoke command is
      blocked by the same local Chromium launch failure.
- [x] Run full Studio browser e2e if the implementation changes browser e2e
      setup or if smoke exposes a browser workflow issue. Not applicable: this
      implementation did not change browser e2e setup, and smoke failed before
      reaching browser workflow assertions.
- [x] Run Engines live-provider e2e only if provider-facing behavior changed and
      credentials/cost are intentionally accepted. Not applicable: no
      provider-facing behavior changed.
- [x] Compare final executed test buckets against the baseline inventory and
      confirm no current test file became unreachable.
