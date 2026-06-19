# 0080 Architecture Test Signal To Friction Rebalance

Status: implemented
Date: 2026-06-19
Implementation order: before treating `0079` architecture-test additions as a
long-term maintenance model

## Summary

This plan revises the architecture-test strategy introduced around `0078`,
`0079`, and the take-contract remediation work.

The goal is not to weaken Renku Studio's architecture boundaries. The goal is
to protect those boundaries with tests that are worth maintaining.

The current `0079` implementation added useful runtime coverage, but some of
the static architecture tests are too literal. They hardcode current function
names, helper names, and implementation details that are not themselves the
architecture contract. Those tests can create friction during legitimate
refactors and can grow into an inventory of every acceptable function in the
codebase. That is the wrong maintenance model.

The new guiding rule is:

> Architecture tests should fail when ownership boundaries are crossed, not
> when a valid implementation is renamed, split, merged, or refactored inside
> the owning layer.

## Implementation Result

Implemented on 2026-06-19.

Rebalanced the `0079` architecture-test additions by removing static checks
that depended on exact command names, validation helper names, broad CLI source
phrases, and dependency-id prefix inventories. Kept the runtime tests that prove
wrong-owner, wrong-scene, invalid dependency, and unchanged-state behavior.

Follow-up review also removed the hardcoded client domain contract file
inventory from the core architecture test. That check now scans the current
client contract directory and fails only when a non-index module is an empty or
re-export-only stub.

The remaining static tests focus on stable boundaries:

- browser feature code cannot import server-only, Node, or database APIs;
- Studio feature code must use local UI primitives instead of raw controls;
- Studio routes and CLI commands cannot import project database internals;
- adapters cannot call broad shot-video take-state patch escape hatches;
- low-level take-state writers stay inside core-owned media generation modules.

No ESLint rules were added in this slice. The current Vitest checks already
express the low-noise import and escape-hatch boundaries without introducing
identifier-name rules, large allowlists, or broad syntax bans.

## Problem Statement

Architecture rules are hard gates in this repository, but a hard gate must
still be a good gate.

A good architecture test:

- catches a boundary violation that would be easy to miss in ordinary unit
  tests;
- is stable across normal refactors inside the owning package;
- has a clear violation model: a reviewer can explain what bad code it blocks;
- does not require a central file to list every legitimate command, helper, or
  service method;
- has low false-positive risk;
- is paired with runtime tests when data integrity is the real concern.

A poor architecture test:

- asserts that a specific "good" function name exists;
- lists every acceptable implementation function;
- fails when code is moved or renamed inside the same architectural owner;
- scans for broad words without enough context;
- forces developers to update a static test for routine feature growth;
- blocks legitimate refactors for superficial reasons.

Several `0079` static tests are closer to the second category than they should
be. This plan replaces those tests with a lower-friction model.

## Goals

- Keep the real architecture boundary: adapters must not own durable project
  mutation rules.
- Remove or rewrite static tests that assert exact implementation function
  names, helper names, or command inventories.
- Keep runtime boundary tests for stale UI requests, wrong ownership, wrong
  scene, invalid dependency selections, and unchanged state after failure.
- Use static tests only where the forbidden capability is stable and cheaply
  detectable.
- Keep ESLint rules narrow and low-noise if they are used at all.
- Update the architecture-test registry so it does not require an ever-growing
  inventory of functions.
- Make future architecture-test additions justify their maintenance cost.

## Non-Goals

- Do not remove the hard architecture rule that `packages/core` owns durable
  metadata mutation.
- Do not move domain validation into Studio server routes, CLI commands, React
  feature code, or agent-local scripts.
- Do not add broad compatibility APIs or generic state patching to make tests
  easier.
- Do not replace brittle Vitest scans with equally brittle ESLint selectors.
- Do not require every new function or service method to be registered in a
  central architecture-test list.
- Do not hand-wave architecture testing away entirely; the result must still
  catch meaningful boundary regressions.

## Design Principles

### Refactor Neutrality

A valid refactor inside the owning package should not require architecture-test
edits.

Examples that should not fail architecture tests by themselves:

- renaming a focused core command;
- splitting one command module into multiple purpose-owned modules;
- merging validation helpers;
- moving implementation details between core modules that are both inside the
  accepted owner boundary;
- renaming CLI handler functions while the public CLI behavior remains the
  same.

### Forbidden Capability Over Required Shape

Static tests should usually say what must not happen, not which exact function
must exist.

Prefer:

- feature code must not import server-only core APIs;
- Studio server routes must not import database access modules;
- CLI command handlers must not import SQLite, Drizzle, or core database
  internals;
- raw browser controls must stay inside `src/ui`;
- adapter-facing contracts must not expose arbitrary durable take-state patch
  inputs.

Avoid:

- `these six command function names must exist`;
- `this validation helper must be named exactly X`;
- `this command file must not contain the word update`;
- `this source file must contain this exact implementation branch`.

### Runtime Tests Carry Behavioral Confidence

When the important property is data integrity, runtime tests are the strongest
guard.

For take reference selections, the durable behavior that matters is:

- wrong-owner ids fail with structured diagnostics;
- wrong-scene requests fail before writes;
- invalid dependency ids fail before writes;
- previous take state remains unchanged after failure.

Those tests should remain. They protect the behavior without constraining
internal function names.

### Static Tests Should Be Small

Each static architecture test should protect one stable boundary.

It should be acceptable for a developer to read the test name and know:

- the forbidden dependency or capability;
- the package or layer that owns the rule;
- the architecture doc that explains the rule;
- why a failure likely indicates real architectural drift.

### ESLint Rules Must Also Pass The Friction Test

ESLint can be a good place for import boundaries, but it can also become a
noisy local policy engine.

Use ESLint only for low-noise checks such as:

- restricted imports by directory scope;
- browser feature code cannot import Node/database modules;
- feature code cannot import server-only core entrypoints.

Avoid ESLint rules that:

- inspect arbitrary identifier names;
- ban common words;
- encode current implementation helper names;
- require large allowlists;
- need frequent updates for ordinary feature work.

## Proposed Test Model

### Keep: Runtime Boundary Regression Tests

Keep runtime tests that prove invalid requests fail before writes.

These tests should assert:

- structured error code prefix or specific stable code where that code is part
  of the package-boundary contract;
- useful issue location when the command intentionally reports one;
- unchanged durable state after the failed operation;
- no file path is returned or file is deleted before scene ownership is
  checked.

These tests may use concrete domain examples because the behavior is concrete.
They should not assert which helper function produced the failure.

### Keep: Stable Import And Layer Tests

Keep static tests or lint rules for stable layer boundaries:

- `packages/studio/src` feature code must not import
  `@gorenku/studio-core/server`;
- browser code must not import Node filesystem APIs, Drizzle, or
  `better-sqlite3`;
- Studio server routes must not import core database access, schema, Drizzle, or
  SQLite modules;
- CLI command handlers must not import database access, schema, Drizzle, or
  SQLite modules;
- React feature code must not use raw browser controls outside `src/ui`.

These are stable because they describe package ownership, not current function
names.

### Keep Or Rewrite: Adapter-Facing Contract Escape Hatches

It is valid to test that adapter-facing core contracts do not expose broad
escape hatches.

The test should not require specific focused replacement method names.

Acceptable checks:

- `ProjectDataService` should not expose a method whose input allows arbitrary
  partial mutation of a durable take-state object;
- adapter-facing input types should not accept a generic durable state patch for
  shot-video takes;
- Studio server and CLI should not import low-level take-state database writers.

Preferred implementation:

- inspect TypeScript AST or exported type text for broad input shapes;
- report the offending method/type name if found;
- do not assert that any specific replacement method name exists.

### Remove Or Rewrite: Positive Function Inventories

Remove static tests that assert exact implementation command names exist.

The architecture contract is:

- core owns the mutation;
- adapters call core;
- invalid state fails before writes;
- adapter-facing contracts do not expose broad mutation escape hatches.

The architecture contract is not:

- these six function names must continue to exist forever.

### Remove Or Rewrite: Validation Helper Name Checks

Remove static tests that assert validation helper names live in a specific
module.

The stable boundary is that broad wiring and adapters do not own domain
validation. The exact helper names are implementation details.

Use either:

- import/dependency tests that keep wiring shallow; or
- runtime tests proving invalid inputs fail before writes.

### Remove Or Rewrite: Broad CLI Source String Checks

Remove static checks that ban generic command words such as `update`.

The CLI can legitimately have update commands. The forbidden capability is a
raw arbitrary durable state patch, not the word "update".

Use runtime CLI tests for documented behavior, plus import/dependency checks for
forbidden layers.

### Remove Or Rewrite: Dependency Id String Scans

Avoid static tests that scan feature code for every possible dependency-id
prefix.

The intended boundary is valid, but string-prefix scans can become noisy as the
UI displays, logs, or tests dependency ids.

Preferred replacement:

- service tests confirm mutation DTOs pass dependency ids through without
  decomposing them;
- runtime core tests reject unknown ids and wrong-owner ids;
- code review checks parsing logic when new mutation workflows are introduced.

If a static test is kept, it must be narrow enough to detect actual parsing for
mutation decisions, not mere display or fixture data.

## Proposed Changes By Area

### Core

Revise `packages/core/src/server/architecture.test.ts`.

Keep:

- ProjectDataService facade size and shallow wiring tests where they protect
  layer shape;
- no re-export facade tests;
- database access boundary tests;
- adapter-facing contract tests that block broad durable mutation escape
  hatches.

Remove or rewrite:

- exact focused take reference-selection command name inventory;
- exact validation helper name assertions.

Replacement:

- add a contract-shape test that fails only if an adapter-facing service method
  accepts arbitrary durable take-state mutation input;
- keep runtime tests as the proof that focused core-owned mutation exists and
  validates correctly.

### CLI

Revise `packages/cli/src/commands/command-architecture.test.ts`.

Keep:

- command handler registry tests only where they protect public CLI command
  routing and are not forced to list every internal helper;
- deep import restrictions that keep CLI away from core internals;
- tests that CLI uses shared core services for generation lifecycle behavior.

Remove or rewrite:

- any check that bans the word `update`;
- any check that requires exact internal handler implementation text;
- dependency-id prefix string scans unless they are replaced with a narrow AST
  check for actual parsing in mutation handlers.

Replacement:

- use CLI runtime tests to prove take-scoped shot-video commands work without
  caller-supplied shot ids;
- use wrong-scene CLI tests to prove core scene ownership errors are surfaced;
- use import-boundary checks for forbidden database/server internals.

### Studio Frontend

Revise `packages/studio/src/architecture.test.ts`.

Keep:

- no direct resource-change event listeners outside the shared hook;
- no local resource-change detail type copies;
- no server-only core imports;
- no Node/database imports;
- raw browser controls only inside `src/ui`.

Remove or rewrite:

- dependency-id prefix scans in feature code;
- any future identifier-name scans that attempt to infer business logic from
  variable names.

Replacement:

- service tests for mutation DTOs;
- runtime core tests for invalid dependency ids and wrong ownership;
- targeted feature tests when a UI workflow sends a new mutation.

### Studio Server

Revise `packages/studio/server/architecture.test.ts`.

Keep:

- route modules must not import database access, schema, Drizzle, or SQLite;
- route modules must not call broad durable mutation escape hatches if such an
  escape hatch exists;
- HTTP helpers must remain request translation and structured validation code.

Remove or rewrite:

- field-by-field scans of every durable reference-selection map key if those
  scans create false positives.

Replacement:

- runtime route tests that assert core structured errors are serialized and
  returned;
- import-boundary tests that prevent route-local database access.

### Architecture Test Registry

Revise `docs/architecture/architecture-test-registry.md`.

Keep:

- boundary descriptions;
- owner docs;
- static and runtime test locations;
- forbidden capabilities.

Remove or rewrite:

- language implying that every new public core method or mutation workflow must
  add to a central function inventory;
- language that makes architecture tests an automatic checklist expansion for
  ordinary feature work.

Replacement:

- require an "Architecture Test Impact" note in relevant plans;
- allow the note to say "covered by existing import boundary and runtime tests"
  when true;
- require new tests only when the feature introduces a new boundary category or
  a new failure mode not covered by existing tests.

## Architecture Test Acceptance Criteria

Before adding or keeping an architecture test, answer these questions in the
test comment, registry, or nearby plan:

1. What specific boundary does this protect?
2. What bad code would this catch?
3. Would a normal refactor inside the owning layer make this fail?
4. Will adding a routine new command/helper/service require editing this test?
5. Is a runtime behavior test a better fit?
6. Is the forbidden pattern stable enough for a static test?
7. Can this be enforced by a narrow import rule instead of source text scans?

If the answer to question 3 or 4 is yes, the test should usually be redesigned
or removed.

## Implementation Slices

### Slice 1: Classify Current Architecture Tests

- Review `packages/core/src/server/architecture.test.ts`.
- Review `packages/cli/src/commands/command-architecture.test.ts`.
- Review `packages/studio/src/architecture.test.ts`.
- Review `packages/studio/server/architecture.test.ts`.
- Classify each assertion as one of:
  - stable boundary check;
  - runtime behavior better covered elsewhere;
  - brittle implementation inventory;
  - obsolete escape-hatch guard that needs a better expression;
  - candidate for narrow ESLint import rule.

### Slice 2: Remove Positive Inventories

- Remove exact focused core command function-name inventory tests.
- Remove exact validation helper-name tests.
- Remove broad CLI keyword bans.
- Remove dependency-id prefix scans that cannot distinguish parsing from display
  or fixture data.
- Keep runtime tests that prove the behavior those inventories were intended to
  protect.

### Slice 3: Replace With Stable Boundary Guards

- Add or keep import-boundary checks for browser/server/CLI/database layers.
- Add or keep contract-shape checks for broad adapter-facing mutation escape
  hatches.
- Keep raw browser control checks scoped to non-`src/ui` feature code.
- Keep resource-refresh subscription ownership tests if they remain low-noise.

### Slice 4: Preserve Runtime Regression Coverage

- Keep wrong-owner reference-selection tests.
- Keep wrong-scene production and shot-design tests.
- Keep wrong-scene input select, clear, delete, and file-resolution tests.
- Keep unknown dependency inclusion tests.
- Keep CLI wrong-scene shot-video command tests.
- Make sure these tests assert behavior and durable state, not implementation
  helper names.

### Slice 5: Update Documentation

- Update `docs/architecture/architecture-test-registry.md` with the
  signal-to-friction policy.
- Add architecture-test acceptance criteria to the registry.
- Clarify that feature plans need an Architecture Test Impact note, not a
  growing inventory update by default.
- Document when ESLint is appropriate and when it is too brittle.
- Update `0079` with a short note that `0080` supersedes the long-term static
  test maintenance model.

### Slice 6: Verification

- Run focused architecture tests.
- Run runtime boundary tests kept by this plan.
- Run `pnpm lint`.
- Run `pnpm test`.
- Run `pnpm build`.
- Run `pnpm check`.

If `pnpm test` fails under sandboxed localhost listener restrictions, rerun it
with approved escalation and record the sandbox-only failure.

## Completion Checklist

### Review And Scope

- [x] Confirm this plan is reviewed before implementation.
- [x] Confirm the goal is reducing brittleness, not weakening core ownership.
- [x] Confirm no implementation changes are made before review approval.
- [x] Confirm `0079` is treated as current baseline, not final policy.
- [x] Confirm this plan aligns with `AGENTS.md` architecture hard-gate rules.
- [x] Confirm this plan aligns with
      `docs/architecture/layers-of-responsibility.md`.
- [x] Confirm this plan aligns with
      `docs/architecture/reference/studio-server-hono.md`.
- [x] Confirm this plan aligns with
      `docs/decisions/0026-use-thin-structured-cli-command-handlers.md`.
- [x] Confirm this plan aligns with `docs/architecture/frontend.md`.

### Test Classification

- [x] Classify all current core architecture assertions.
- [x] Classify all current CLI architecture assertions.
- [x] Classify all current Studio frontend architecture assertions.
- [x] Classify all current Studio server architecture assertions.
- [x] Identify every assertion that hardcodes a required implementation
      function name.
- [x] Identify every assertion that scans broad source strings likely to appear
      in legitimate code.
- [x] Identify every assertion that would need edits for routine feature growth.
- [x] Identify every assertion that is better covered by runtime behavior tests.

### Core Static Tests

- [x] Remove exact focused command function-name inventory checks.
- [x] Remove exact validation helper-name checks.
- [x] Keep or rewrite adapter-facing escape-hatch checks so they detect broad
      durable mutation capability, not specific replacement names.
- [x] Keep shallow ProjectDataService wiring checks only where they protect
      stable layer boundaries.
- [x] Keep database access boundary checks that are stable across refactors.
- [x] Confirm core static tests do not require updates for routine new focused
      commands.

### CLI Static Tests

- [x] Remove broad bans on generic command words such as `update`.
- [x] Remove exact implementation text checks for take-scoped generation
      internals.
- [x] Keep deep import restrictions that prevent CLI from depending on core
      database/media-generation internals.
- [x] Keep public command registry tests only where the command list is a real
      CLI contract.
- [x] Confirm CLI static tests do not require updates for routine handler
      refactors.

### Studio Frontend Static Tests

- [x] Keep server-only core import restrictions.
- [x] Keep Node/database import restrictions.
- [x] Keep raw browser control restrictions outside `src/ui`.
- [x] Keep shared resource-refresh listener ownership tests if they remain
      low-noise.
- [x] Remove dependency-id prefix scans that cannot distinguish mutation logic
      from display, tests, or fixture data.
- [x] Confirm frontend static tests do not require updates for routine UI
      refactors.

### Studio Server Static Tests

- [x] Keep database/schema/Drizzle/SQLite import restrictions for route files.
- [x] Keep broad durable mutation escape-hatch restrictions only if expressed as
      capability checks.
- [x] Remove field-by-field durable map key scans if they are likely to create
      false positives.
- [x] Confirm server static tests do not require updates for routine route
      refactors that stay thin.

### Runtime Tests

- [x] Keep wrong Cast Member character-sheet selection regression coverage.
- [x] Keep wrong Location sheet selection regression coverage.
- [x] Keep wrong Lookbook sheet selection regression coverage.
- [x] Keep wrong dialogue audio take selection regression coverage.
- [x] Keep unknown dependency inclusion regression coverage.
- [x] Keep wrong-scene production update regression coverage.
- [x] Keep wrong-scene shot-design update regression coverage.
- [x] Keep wrong-scene input select regression coverage.
- [x] Keep wrong-scene input clear regression coverage.
- [x] Keep wrong-scene input delete regression coverage.
- [x] Keep wrong-scene input file-resolution regression coverage.
- [x] Keep CLI wrong-scene shot-video command regression coverage.
- [x] Confirm runtime tests assert durable behavior and structured diagnostics,
      not helper names.

### ESLint And Tooling

- [x] Decide whether any architecture checks should move to ESLint.
- [x] If ESLint is used, restrict it to low-noise import boundaries.
- [x] Do not add ESLint identifier-name rules for current helper names.
- [x] Do not add large allowlists.
- [x] Do not add no-restricted-syntax rules that ban common code patterns
      without a clear boundary violation.
- [x] Document why each ESLint rule is lower friction than the Vitest check it
      replaces.

### Documentation

- [x] Update `docs/architecture/architecture-test-registry.md`.
- [x] Add the architecture-test acceptance criteria to the registry.
- [x] Replace "update architecture tests for every new surface" language with
      an Architecture Test Impact note requirement.
- [x] Clarify that existing tests can cover new work without edits.
- [x] Document when a new architecture test is required.
- [x] Document when runtime tests are preferred over static tests.
- [x] Add a note to `0079` that `0080` supersedes the long-term maintenance
      model for static tests.

### Verification

- [x] Run focused core architecture tests.
- [x] Run focused CLI architecture tests.
- [x] Run focused Studio frontend architecture tests.
- [x] Run focused Studio server architecture tests.
- [x] Run runtime boundary tests affected by this plan.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run `pnpm check`.
- [x] Record any sandbox-only verification failures separately from product
      failures.
