# Test Execution Strategy

Date: 2026-07-05

Status: implemented guidance

Role: architecture guidance

## Purpose

Renku Studio needs two things at the same time:

- a fast development loop that catches most mistakes while a feature is being
  built;
- high-confidence integration and e2e coverage that runs at the end, when the
  feature is ready for final verification.

The answer is not to delete valuable slow tests. The answer is to separate test
responsibilities, keep high-value slow tests in an explicit final gate, and make
sure the fast tests cover the domain rules that those slow tests usually expose.

The default development habit should be:

1. Run the smallest relevant fast tests while editing.
2. Add or update fast tests at the owning layer when a slow test exposes a bug.
3. Run integration and e2e suites once near the end, not repeatedly during every
   small code change.

## Implementation Status

Implemented on 2026-07-06 through
`plans/active/0117-test-execution-strategy-implementation.md`.

The repository now uses explicit fast, integration, browser e2e, and
live-provider e2e execution buckets. The implementation preserved protected
slow tests and moved them behind explicit commands instead of deleting or
weakening coverage.

## Current Status

The original investigation found about 220 test files under `packages/`.

Original test-file shape:

| Bucket | Count | Notes |
| --- | ---: | --- |
| Unit-ish and local contract tests | 127 | Source-adjacent Vitest tests, many with some filesystem setup. |
| React feature tests | 36 | jsdom component, hook, and projection tests. |
| Studio service tests | 4 | API client parsing and service-level DTO tests. |
| Studio route tests | 12 | Hono route tests, generally using fake project services. |
| Architecture tests | 5 | Static boundary and ownership checks. |
| Engines schema tests | 2 | Catalog/schema validation tests. |
| Integration tests | 8 | Core integration tests, Engines integration tests, and one source-file test that was named `simulation-integration`. |
| E2E-shaped tests | 26 | Studio Playwright specs, live provider e2e tests, and Studio in-process `.e2e.test.*` suites. |

The important issue is not merely the number of tests. The important issue is
which suites are pulled into ordinary development commands.

### Root Commands

Root `pnpm test` runs package fast suites:

- Diagnostics tests.
- Core tests.
- CLI tests.
- Engines tests.
- Studio tests.

Root `pnpm check` runs type checks, test type checks, lint, architecture
checks, and the test-execution partition check. It does not run browser e2e.

Root `pnpm test:integration` runs deterministic local integration suites for
Core, CLI, Engines, and Studio.

Root `pnpm test:final` runs:

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
```

Provider e2e remains separate and explicit.

### Core

`packages/core/vitest.config.ts` includes the fast source-adjacent suite:

```text
src/**/*.test.ts
```

Core integration tests run through:

```bash
pnpm --filter @gorenku/studio-core test:integration
```

The Core integration bucket includes high-signal files such as:

- `packages/core/tests/integration/context-first-generation-lifecycle.test.ts`
- `packages/core/tests/integration/focused-generation-workspaces.test.ts`

These tests exercise the generic lifecycle and focused Studio use cases through
real temporary project databases. They verify exact references, direct
estimates, attachment/provenance, take state, and structured failure boundaries
without a live provider call.

### Studio

`packages/studio/vitest.config.ts` includes fast server, service, React, hook,
UI, and architecture tests:

```text
server/**/*.test.ts
src/**/*.test.ts
src/**/*.test.tsx
```

The fast Studio config explicitly excludes `src/**/*.e2e.test.*`.

The in-process e2e-style files under `src/` now run through:

```bash
pnpm --filter @gorenku/studio test:integration
```

That integration bucket includes:

- `packages/studio/src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts`
- `packages/studio/src/services/scene-shot-video-take-state-persistence.e2e.test.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-location-sheets.e2e.test.tsx`

These tests are not useless. The estimate matrix test is particularly valuable:
it protects the AI Production pricing matrix, route coverage, route
serialization, direct-request estimates, and model/input-mode permutations.
It should be treated as protected final coverage. It should not be deleted to
make development feel faster.

The named estimate matrix command remains available:

```bash
pnpm --filter @gorenku/studio test:shot-video-estimates
```

### Studio Browser E2E

Studio browser e2e uses Playwright under `packages/studio/e2e/tests`.

This suite is already separate from root `pnpm test`:

```bash
pnpm --dir packages/studio test:e2e:compat
pnpm --dir packages/studio test:e2e:smoke
pnpm --dir packages/studio test:e2e
```

The suite starts a real Studio test server, uses an isolated E2E Renku home, and
runs with one worker. That is appropriate for final browser verification, not
for routine inner-loop development.

`test:e2e:compat` compares the final desktop experience with locked screenshots
captured from the isolated pre-work checkout. It is required for backend
replacements that preserve UI behavior. Keep dynamic masks narrow and pair
every approved visible change with DOM/accessibility assertions.

### Engines

Engines already has separate commands for unit, integration, and live-provider
e2e tests:

```bash
pnpm --dir packages/engines test
pnpm --dir packages/engines test:integration
pnpm --dir packages/engines test:e2e
```

The live provider e2e tests under `packages/engines/tests/e2e` are correctly
outside the default Engines test command. They require provider credentials and
may spend money or time. They should remain opt-in final checks.

The former source-local unified simulation integration test now lives under
`packages/engines/tests/integration/unified-simulation-flow.test.ts`, so it runs
through Engines `test:integration` instead of the default fast suite.

### CLI

The CLI has focused command-handler tests in the fast suite. The large full
workflow contract test now lives at
`packages/cli/tests/integration/cli-workflows.test.ts` and runs through:

```bash
pnpm --filter @gorenku/studio-cli test:integration
```

That coverage is important because the CLI is a major contract. It remains in
the repository, but no longer mixes workflow-level checks into the normal CLI
fast test command.

## Test Tiers

Renku Studio should use four explicit tiers.

### Tier 1: Focused Fast Tests

Use during active editing.

These tests should usually finish in seconds and should be the first thing run
after a code change.

Examples:

```bash
pnpm --dir packages/core exec vitest run src/server/media-generation/cost/cost-projection.test.ts
pnpm --dir packages/studio exec vitest run src/features/movie-studio/scenes/shot-video-take-production-projection.test.ts
pnpm --dir packages/cli exec vitest run src/commands/generation-command-handlers.test.ts
pnpm --dir packages/engines exec vitest run src/sdk/replicate/retry.test.ts
```

Tier 1 tests should own most bug-catching during development.

Good Tier 1 tests:

- test pure domain functions directly;
- use mocked services at adapter boundaries;
- use fake timers instead of real sleeps;
- test DTO parsing and serialization without starting a real server;
- test React projections and hooks with mocked services;
- test CLI command handlers without invoking the whole CLI process;
- fail fast with clear assertions.

Tier 1 tests should avoid:

- Playwright;
- live provider calls;
- real generated-media provider routes;
- repeated full project creation when a pure input object is enough;
- real-time waits;
- broad matrix loops unless the matrix is cheap and local;
- testing a whole workflow when the bug belongs to one core function.

### Tier 2: Package Fast Suites

Use after the focused tests pass, before switching to another area.

Target commands:

```bash
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio-engines test
pnpm --filter @gorenku/studio test
```

These package commands run fast tests only.
They should not include Core integration tests, Studio in-process e2e tests, or
browser e2e tests.

Core and Studio now meet that target:

- Core package tests exclude `packages/core/tests/integration/**`.
- Studio package tests exclude `packages/studio/src/**/*.e2e.test.*`.

Those suites remain covered by explicit integration commands.

### Tier 3: Integration Suites

Use at the end of a feature, or when the current change directly touches the
integrated behavior.

Integration tests are still local and deterministic. They may use real project
databases, realistic project fixtures, Hono route stacks, in-process `fetch`,
and cross-layer service wiring. They should not require a browser or live
provider credentials.

Examples of Tier 3 coverage:

- Core context-first generation lifecycle integration.
- Core focused Preview, Image Revision, Dialogue Audio, and Shot workspace
  integration.
- Studio in-process AI Production estimate matrix.
- Studio take-state persistence through service/API paths.
- Studio route plus React integration where a route response is rendered by a
  real component.
- Engines provider retry behavior that intentionally validates retry timing or
  SDK integration, if it cannot be represented as a fast fake-timer unit test.

Target commands should be explicit, for example:

```bash
pnpm --filter @gorenku/studio-core test:integration
pnpm --filter @gorenku/studio-cli test:integration
pnpm --filter @gorenku/studio test:integration
pnpm --filter @gorenku/studio-engines test:integration
```

Root `pnpm test:integration` runs the local deterministic integration gate.

### Tier 4: E2E Suites

Use at the final verification point, before declaring the work complete.

Studio browser e2e:

```bash
pnpm --dir packages/studio test:e2e:smoke
pnpm --dir packages/studio test:e2e
```

Engines live provider e2e:

```bash
pnpm --dir packages/engines test:e2e
```

Tier 4 tests may be slow, use a real browser, use live provider credentials, or
depend on external service behavior. They should never be part of the default
development loop.

Live provider e2e should run only when the change touches provider adapters,
provider request/response contracts, model catalogs, schema mappings, pricing,
or generation execution behavior that cannot be proven with local simulation.

## Protected Slow Tests

Slow tests must earn their cost, but high-signal slow tests are assets. Do not
delete them merely to speed up development.

Protected examples:

- `packages/studio/src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts`
- `packages/studio/src/services/scene-shot-video-take-state-persistence.e2e.test.ts`
- `packages/core/tests/integration/media-generation-dependency-inventory.test.ts`
- `packages/studio/e2e/tests/smoke/*.spec.ts`
- provider e2e tests under `packages/engines/tests/e2e` when provider behavior
  is being changed intentionally.

The correct optimization for these tests is:

1. Keep the slow test as final verification.
2. Identify which domain rules it protects.
3. Add fast owner-layer tests for those rules.
4. Run the slow test once at the end, or when its exact integration surface is
   changed.

For example, the AI Production estimate matrix should remain the final
end-to-end guard for model/input-mode pricing behavior. Fast coverage around it
should include:

- Core cost projection arithmetic.
- Purpose lifecycle estimate behavior.
- Dependency line materialization states.
- Studio API serializer/deserializer behavior.
- Route coverage key generation.
- React projection formatting for estimate lines.

When one of those fast tests fails, the estimate matrix usually does not need to
be re-run until the final gate.

## When A Slow Test Finds A Bug

When a slow integration or e2e test finds a bug, do not make the slow test the
only regression coverage.

Use this loop:

1. Reproduce the failure in the slow test once.
2. Locate the owning layer for the rule.
3. Add or update a fast test at that layer.
4. Fix the bug in the owning layer.
5. Run the fast test repeatedly while editing.
6. Run the slow test again once after the fast test passes.

Example:

If the estimate matrix finds that `first-last-frame` pricing is wrong, the
repeatable development loop should not be the full 2,000-line matrix test. The
fast regression should usually live in Core pricing, dependency line planning,
or Studio API serialization, depending on where the incorrect value was
introduced. The full matrix remains the final proof that the route, service,
and catalog still agree.

## Current Risk Areas

### Integration Tests In Default Core Test

Core's default test command previously included `tests/**/*.test.ts`. That
pulled Core integration tests into ordinary
`pnpm --filter @gorenku/studio-core test` and root `pnpm test`.

Expected impact:

- small Core edits can trigger database-backed integration checks;
- agents may rerun the same slow integration suite several times during one
  feature;
- integration failures become the first feedback instead of a final confidence
  check.

Implemented direction:

- make source-adjacent Core tests the default fast suite;
- keep `packages/core/tests/integration/**` under an explicit
  `test:integration` command;
- keep the integration tests themselves unless a separate review proves a test
  has no meaningful contract.

### Studio In-Process E2E In Default Studio Test

Studio's default Vitest config previously included `src/**/*.e2e.test.ts` and
`src/**/*.e2e.test.tsx` because they matched `src/**/*.test.*`.

Expected impact:

- ordinary Studio tests include the estimate matrix and take-state persistence
  flows;
- expensive, valuable final checks run too often;
- the slowest tests become the development loop instead of the final gate.

Implemented direction:

- keep the in-process e2e tests;
- exclude `src/**/*.e2e.test.*` from the fast Studio Vitest config;
- add a Studio integration command that explicitly includes those files;
- keep `test:shot-video-estimates` as a named targeted command for the estimate
  matrix.

### CLI Workflow Tests Mixed With Fast CLI Tests

The CLI's former top-level `cli.test.ts` is a broad workflow contract test. It
is valuable, but it is too broad to be the only default feedback mechanism for
many CLI changes.

Implemented direction:

- keep focused command handler tests in the fast suite;
- keep full command-line flows in the separate CLI workflow/integration suite;
- when a CLI workflow test fails, add a focused handler or core test for the
  owning rule.

### Real Sleeps And Placeholder Tests

Tests that wait on real time, such as retry tests that measure actual delay,
make the suite slower than necessary when fake timers can prove the same rule.

Skipped tests and `it.todo` entries do not slow the suite much, but they make
coverage status harder to read. They should be tracked as product or test debt,
not counted as coverage.

Recommended direction:

- prefer fake timers for retry and debounce behavior;
- keep skipped or todo tests only when they are an intentional marker tied to a
  current plan;
- do not remove placeholder tests as a speed tactic without owner approval.

## Recommended Command Model

Use this command model.

### Fast Development

Run the focused file first:

```bash
pnpm --dir packages/<package> exec vitest run path/to/file.test.ts
```

Then run the package fast suite:

```bash
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio-engines test
pnpm --filter @gorenku/studio test
```

Root fast suite:

```bash
pnpm test
```

Root `pnpm test` must remain fast. It should not
include Core integration, Studio in-process e2e, Studio browser e2e, or Engines
live provider e2e.

### Final Local Verification

Run once near the end:

```bash
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
```

Use full browser regression when the UI workflow changed materially:

```bash
pnpm test:e2e:studio
```

Use Engines live provider e2e only for provider-facing changes:

```bash
pnpm --dir packages/engines test:e2e
```

### Full Release Or PR Gate

The highest-confidence local gate should be:

```bash
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio
```

Provider e2e remains separate because it may require credentials, network, and
cost approval.

## Coverage Expectations By Layer

### Core

Fast Core tests should catch most domain mistakes before integration tests run.

Fast coverage should exist for:

- the complete purpose/settings/model inventory;
- stable guide placements, exact candidates, and initial selections;
- fixed setting enforcement and untouched provider defaults;
- generic spec, preview, validation, direct estimate, approval, and run behavior;
- focused attachment ownership and provenance;
- Preview, Image Revision, Dialogue Audio, and Shot Video Take use cases;
- structured diagnostics for invalid state;
- shot video take persistence rules where a real database is not essential.

Core integration should remain for:

- end-to-end lifecycle behavior through `ProjectDataService`;
- interactions between exact reference selections, provider validation, direct
  pricing, focused attachment, Trash, and structured diagnostics.

### Studio Server

Fast route tests should keep handlers thin:

- parse HTTP input;
- call core or a fake project service;
- serialize the response;
- translate structured errors.

Route tests should not become domain-rule tests. If a route test needs real
project state to prove a domain invariant, the invariant probably belongs in a
Core fast test plus a smaller route serialization test.

### Studio React

Fast React tests should cover:

- projection and formatting functions;
- component rendering from supplied DTOs;
- service-call intent;
- save state and error rendering;
- hooks with mocked services.

Browser e2e should cover:

- navigation;
- real browser event behavior;
- end-to-end project selection;
- critical user workflows where route, React, browser, and storage all need to
  agree.

### CLI

Fast CLI tests should cover:

- argument parsing;
- command handler dispatch;
- structured diagnostics formatting;
- calls into core service contracts using mocks.

CLI integration should cover:

- full command flows against a real temporary project;
- JSON output contracts;
- agent-facing command behavior that is hard to prove through handler tests
  alone.

### Engines

Fast Engines tests should cover:

- schema validation;
- provider payload mapping;
- pricing estimate calculation;
- retry policy with fake timers;
- simulated output handling;
- provider adapter contracts using mocked SDK responses.

Integration and e2e should cover:

- provider SDK integration that cannot be represented locally;
- live provider request/response contracts;
- credential-gated generation behavior.

## Agent And Developer Rules

During feature development:

- Do run the narrowest relevant fast test first.
- Do run package fast tests after focused tests pass.
- Do not repeatedly run Core integration, Studio in-process e2e, Studio
  Playwright, or Engines live provider e2e during small edits.
- Do not delete high-value slow tests to improve loop time.
- Do add fast owner-layer coverage when a slow test catches a bug.
- Do run relevant integration/e2e suites once at the end.
- Do explain which final suites were skipped when a change is not relevant to
  them.

For example:

- A Core cost projection change should run focused Core cost tests repeatedly,
  then Core package tests, then the estimate-related integration/final checks
  once.
- A Studio React formatting change should run the component/projection tests
  repeatedly, then Studio package tests, then browser smoke only if the rendered
  workflow changed.
- A provider adapter change should run fast adapter tests repeatedly, then
  Engines package tests, then provider integration/e2e with credentials at the
  end.

## Implementation Checklist For The Split

- [x] Add explicit Core integration config and command for
  `packages/core/tests/integration/**`.
- [x] Keep Core default tests focused on source-adjacent fast tests.
- [x] Add explicit Studio integration config and command for
  `packages/studio/src/**/*.e2e.test.*`.
- [x] Keep Studio default tests focused on server route tests, service unit tests,
  React feature tests, and local utility tests.
- [x] Preserve `packages/studio/src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts`
  as a protected final check.
- [x] Audit fast tests around the highest-value rules protected by the estimate matrix
  so developers do not need to run the matrix repeatedly.
- [x] Split CLI broad workflow tests from fast command-handler tests when the CLI
  test suite becomes a development-loop bottleneck.
- [x] Move `packages/engines/src/sdk/unified/simulation-integration.test.ts`
  to Engines integration.
- [x] Add root `test:integration` and `test:final` scripts only after package-level
  split commands exist.
- [x] Document which final suites are required for each kind of change.

## Summary

The suite has good coverage, and its execution boundaries are now explicit.
Core integration tests, CLI workflow tests, Studio in-process e2e tests, Studio
browser e2e tests, and Engines live-provider e2e tests are all available through
named commands instead of leaking into every ordinary package test command.

The target model is:

- fast tests during development;
- explicit integration suites at the end;
- browser and live-provider e2e only as final verification;
- no deletion of valuable slow tests as a substitute for better fast coverage.

The most important practical rule is:

> If a slow test is valuable, keep it. Then add fast owner-layer coverage so the
> slow test only needs to run at the end.
