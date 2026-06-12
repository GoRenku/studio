# 0066 Low-Noise Lint And Architecture Checks

Status: implemented
Date: 2026-06-12

## Summary

Renku Studio already has strong architecture and code-quality rules in
`AGENTS.md`, architecture docs, ADRs, and the new
`renku-code-quality-review` skill. Those sources should remain the place for
judgment-heavy review: whether a name is domain-appropriate, whether a fallback
is product-sanctioned, whether a function is genuinely clearer when kept
together, and whether an abstraction is justified by current duplication.

This plan is narrower.

It makes the mechanical, low-noise parts of those rules consistent across all
packages and ensures architecture tests always run as part of the normal
project check.

The goal is not maximum strictness. The goal is predictable guardrails that
catch obvious regressions without creating day-to-day friction.

## Implementation Result

Implemented on 2026-06-12.

The implementation kept the plan's low-noise scope:

- `pnpm check` now includes `pnpm check:architecture`.
- `check:architecture` now runs the repo-wide forbidden re-export/import script,
  the Core architecture test, the CLI command architecture test, and the Studio
  architecture test.
- Engines now uses the same basic TypeScript-aware lint baseline as the other
  Node packages.
- CLI command complexity rules remain scoped to the already-refactored
  generation/media/studio-resource command surface because applying the rule to
  all command files surfaced existing legacy command families rather than a
  low-noise mechanical gap.
- Studio now rejects raw `button`, `input`, `select`, `textarea`, and `dialog`
  JSX elements in `src/app` and `src/features`, while keeping `src/ui` as the
  owner of raw shadcn-style primitive implementation.
- No global file-size, function-size, naming-deny-list, fallback-word, or broad
  `throw new Error` lint rule was added.

Focused verification during implementation:

- `pnpm --dir packages/cli lint`
- `pnpm --dir packages/engines lint`
- `pnpm --filter @gorenku/studio lint`
- `pnpm --dir packages/core lint`
- `pnpm --dir packages/diagnostics lint`
- `pnpm check:architecture`
- `pnpm check`

`packages/studio` still reports one existing `no-console` warning in
`packages/studio/server/bin.ts`. The warning does not fail lint and was left
unchanged because this plan intentionally avoids churny cleanup outside the
obvious mechanical gaps.

Final verification result: `pnpm check` passed.

## References Consulted

- `AGENTS.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/studio-server-hono.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/drizzle-first-project-data.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0026-use-thin-structured-cli-command-handlers.md`
- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`
- `docs/decisions/0031-use-studio-server-owned-coordination-delivery.md`
- `scripts/check-no-forbidden-reexports.mjs`
- `packages/core/src/server/architecture.test.ts`
- `packages/cli/src/commands/command-architecture.test.ts`
- `packages/studio/src/architecture.test.ts`

## Current State Audit

### Root Checks

`pnpm lint` runs all package lint scripts.

`pnpm check` currently runs:

```bash
pnpm type-check && pnpm test:typecheck && pnpm lint
```

It does not run `check:architecture`.

`check:architecture` currently runs:

```bash
node scripts/check-no-forbidden-reexports.mjs
pnpm --dir packages/core exec vitest run src/server/architecture.test.ts --no-file-parallelism
```

This means:

- the repo-wide forbidden re-export/import script is available;
- the Core architecture test is available;
- the CLI command architecture test runs only as part of the CLI test suite;
- the Studio frontend architecture test runs only as part of the Studio test
  suite;
- architecture checks are not part of the ordinary `pnpm check` path.

### Package Linting

`packages/core` has basic ESLint rules:

- `prefer-const`
- `no-var`
- `no-console` with `warn` and `error` allowed
- `eqeqeq`
- `curly`
- `no-eval`
- `no-implied-eval`
- `no-new-func`
- TypeScript unused-variable handling

It has no ESLint rules for command/function complexity, nesting, or nested
ternaries. Some Core-specific architecture constraints are enforced by
`packages/core/src/server/architecture.test.ts`.

`packages/cli` has the same basic ESLint rules as Core and additionally applies
these rules to a hand-picked list of command files:

- `complexity: max 8`
- `max-depth: 2`
- `no-nested-ternary`

This is the strongest current lint setup, but the file list can drift when new
command files are added.

`packages/engines` has a much lighter ESLint config:

- `@eslint/js` recommended rules;
- TypeScript parsing;
- package globals;
- base `no-unused-vars` disabled.

It does not replace the disabled base unused-variable rule with
`@typescript-eslint/no-unused-vars`, and it does not share the basic package
rules used by Core, CLI, and Diagnostics.

`packages/studio` uses ESLint 9 flat config with:

- JS recommended rules;
- TypeScript recommended rules;
- React hooks rules;
- React refresh rules;
- Tailwind CSS rules with several Tailwind v4-related noisy rules disabled.

It does not currently enforce the repo's strict rule that feature code must use
local shadcn-style controls instead of raw browser controls. A spot check found
raw `<button>`, `<input>`, and `<textarea>` only under `packages/studio/src/ui`,
which is the allowed owner for local primitives.

`packages/diagnostics` has the same basic ESLint rules as Core.

### Existing Architecture Tests And Scripts

The repo already uses static tests and scripts for rules that ESLint cannot
express cleanly:

- `scripts/check-no-forbidden-reexports.mjs` rejects non-index re-export stubs
  and specific deleted/moved imports across `packages/*/src`.
- `packages/core/src/server/architecture.test.ts` checks Core ownership
  boundaries such as:
  - no revived transitional paths;
  - `ProjectDataService` staying small and shallow;
  - no non-index re-export facades;
  - no runtime `session.sqlite.prepare` outside the store adapter;
  - direct schema imports staying in database access/schema modules.
- `packages/cli/src/commands/command-architecture.test.ts` checks command
  handler registry shape and prevents CLI command files from deep-importing
  Core media-generation internals.
- `packages/studio/src/architecture.test.ts` keeps
  `renku:studio-resource-changed` subscriptions in the shared refresh hook.

These are the right kind of checks for repo-aware architecture rules. They
should be part of the always-run verification path.

## Design Principles

### Prefer Low-Noise Mechanical Rules

Only add lint rules when violations are mechanically identifiable and expected
false positives are low.

Good lint candidates:

- raw Studio controls outside `src/ui`;
- CLI command file complexity and nesting;
- nested ternaries in command/control-flow-heavy areas;
- forbidden cross-layer imports;
- unsafe direct syntax such as direct `session.sqlite.prepare` in known
  disallowed folders.

Poor lint candidates:

- generic fallback words;
- generic naming words such as `item`, `data`, `view`, or `detail`;
- broad `throw new Error` bans;
- strict file size and function size numbers across the whole repo;
- all uses of `as any`;
- historical words such as `compatibility` when Engines legitimately speaks to
  external provider compatibility.

Those poor candidates should remain review concerns for the
`renku-code-quality-review` skill, focused architecture tests, or human review.

### Do Not Add Hard File-Size Or Function-Size Gates Yet

File size and function size are useful warning signals, but hard numbers are
misleading at this stage.

Sometimes one file is clearer because it owns one cohesive contract, schema, or
test matrix. Conversely, splitting a large file into vague `helpers.ts` or
`utils.ts` modules can make the architecture worse.

This plan therefore does not add `max-lines` or `max-lines-per-function` as
failing lint rules.

Instead, size pressure should be handled in two ways:

1. Keep the existing architecture tests that cap deliberately small facade or
   wiring files, such as `ProjectDataService`.
2. When a specific area has already been accepted for refactoring, add a
   focused architecture test or scoped lint rule for that area after the
   refactor lands.

This preserves the intent of `docs/architecture/coding-practices.md` without
turning file length into a noisy universal gate.

### Keep Architecture Tests First-Class

Architecture tests are not ordinary feature tests. They encode package
ownership, boundary, and drift-prevention rules.

The normal `pnpm check` command must run them.

The root `check:architecture` command should include all existing architecture
checks, not only the Core one.

### Keep Package Linting Consistent

Each package can have local additions, but the baseline should be consistent.

The shared package baseline should cover:

- `prefer-const`;
- `no-var`;
- `eqeqeq`;
- `curly`;
- `no-eval`;
- `no-implied-eval`;
- `no-new-func`;
- TypeScript-aware unused-variable handling;
- test-file console allowance;
- production `no-console` warning with `warn` and `error` allowed where
  appropriate.

Package-specific additions should be explicit:

- CLI command architecture rules for command files.
- Studio frontend rules for raw control ownership.
- Core architecture tests for storage, schema, and data-service boundaries.
- Engines rules for provider/runtime hygiene only where mechanical and
  low-noise.

## Target Architecture

### Root Commands

Update root scripts so:

```bash
pnpm check
```

runs:

```bash
pnpm type-check
pnpm test:typecheck
pnpm lint
pnpm check:architecture
```

Update `check:architecture` so it runs:

```bash
node scripts/check-no-forbidden-reexports.mjs
pnpm --dir packages/core exec vitest run src/server/architecture.test.ts --no-file-parallelism
pnpm --dir packages/cli exec vitest run src/commands/command-architecture.test.ts --no-file-parallelism
pnpm --dir packages/studio exec vitest run src/architecture.test.ts --no-file-parallelism
```

Do not add full package tests to `check:architecture`; those already belong to
`pnpm test`. The architecture command should stay fast and focused.

### Node Package ESLint Baseline

Make the Node package lint baseline identical across `core`, `cli`, `engines`,
and `diagnostics`.

Prefer the simplest implementation that is easy to review:

1. If a shared config file can own real baseline policy clearly, put it in a
   deliberate tooling location such as `scripts/eslint/node-package-config.mjs`.
2. If a shared config would create confusing package resolution behavior or read
   like a pass-through convenience layer, copy the same small baseline rule block
   into each package config instead.

Do not add a re-export barrel, compatibility wrapper, or package-local facade
just to avoid editing package configs. Consistency and reviewability matter more
than deduplicating a small rule block.

No new ESLint plugin package should be introduced unless implementation proves
the currently installed workspace dependencies are insufficient. Engines may
need to declare the same `@typescript-eslint/eslint-plugin` dev dependency as
Core, CLI, and Diagnostics if it imports that plugin directly.

### CLI Lint Rules

Keep CLI's existing command complexity guard, but reduce drift.

Replace the hand-picked command file list with a low-noise glob if it does not
fail existing code:

```text
src/commands/**/*.ts
```

If the broad glob is too noisy because of current legacy files, use two scoped
groups:

1. command router and handler files that must obey `complexity`, `max-depth`,
   and `no-nested-ternary`;
2. excluded command files with a comment naming the follow-up refactor or
   architecture reason.

Do not add `max-lines` or `max-lines-per-function` to CLI in this plan.

### Studio Lint Rules

Add a Studio ESLint override that forbids raw interactive controls in feature
code:

```text
packages/studio/src/features/**/*.{ts,tsx}
packages/studio/src/app/**/*.{ts,tsx}
```

Forbidden JSX elements:

- `button`
- `input`
- `select`
- `textarea`
- `dialog`

Allowed owners:

- `packages/studio/src/ui/**/*.{ts,tsx}`;
- focused tests when they intentionally render raw DOM in test fixtures;
- third-party generated declarations or build outputs, if any.

Expected lint message:

```text
Use the local shadcn-style primitive from packages/studio/src/ui instead of a raw browser control in feature code.
```

Do not add broad frontend naming restrictions. Terms such as `view`, `item`,
and `detail` are too common in React and domain contracts to lint without
noise.

### Studio Architecture Tests

Keep the existing resource-refresh architecture test and include it in
`check:architecture`.

Add a focused Studio architecture test only if ESLint cannot cleanly express a
low-noise rule. Candidate future checks:

- feature code does not import another feature's private child component for
  styling;
- feature code does not define a local `StudioResourceChangedDetail`;
- service files own API endpoint paths instead of feature components.

Those future checks are not part of this initial implementation unless a
current concrete regression is found.

### Core Architecture Tests

Keep Core architecture tests as the main enforcement surface for storage and
schema ownership.

This plan does not add broad Core complexity or file-size lint rules.

Potential low-noise additions after audit:

- keep direct `session.sqlite.prepare` restrictions in the existing
  architecture test;
- keep direct Drizzle schema import restrictions in the existing architecture
  test;
- add specific tests for newly refactored areas only when an accepted plan
  names a boundary that should not regress.

### Engines Lint Rules

Bring Engines up to the same baseline as the other Node packages:

- TypeScript-aware unused-variable handling;
- `prefer-const`;
- `no-var`;
- `eqeqeq`;
- `curly`;
- `no-eval`;
- `no-implied-eval`;
- `no-new-func`;
- production `no-console` behavior consistent with other Node packages unless
  provider tooling requires an explicit exception.

Do not ban provider compatibility language, fallback output modules, or
provider-specific `throw new Error` usage in this plan. Engines bridges external
provider contracts, and those terms can be legitimate there.

### Diagnostics Lint Rules

Keep Diagnostics on the same Node package baseline.

Do not add extra complexity gates unless the package grows enough to justify
them. Its current source shape is small and low-risk.

## Out Of Scope

This plan does not:

- introduce new lint tooling dependencies unless required to make existing
  package configs consistent;
- add hard `max-lines` or `max-lines-per-function` rules;
- add naming deny-lists for `data`, `item`, `view`, `detail`, `helper`, or
  similar terms;
- ban all `throw new Error` calls;
- ban all fallback-related words;
- ban all `as any` usage across the repo;
- enforce subjective architecture judgments through lint;
- refactor oversized files;
- change runtime behavior.

The `renku-code-quality-review` skill remains the enforcement surface for
judgment-heavy review.

## Implementation Slices

### Slice 1: Root Architecture Check Integration

Update root scripts:

- Add CLI architecture test to `check:architecture`.
- Add Studio architecture test to `check:architecture`.
- Add `pnpm check:architecture` to `pnpm check`.

Run the architecture command directly after updating it.

### Slice 2: Node Package ESLint Baseline Consistency

Normalize `core`, `cli`, `engines`, and `diagnostics` lint baselines.

Keep local package differences explicit:

- CLI keeps command complexity/depth/nested-ternary rules.
- Engines keeps provider/runtime globals.
- Tests keep relaxed console and warning-level unused-variable behavior where
  the package already allows it.

Run each package lint command after the package config changes.

### Slice 3: CLI Command Rule Drift Prevention

Audit `packages/cli/src/commands`.

Prefer applying command complexity/depth/nested-ternary rules to
`src/commands/**/*.ts`.

If the broad glob causes immediate noise, keep a scoped list but make it
deliberate:

- include all current generation/media/studio-resource command files;
- add a nearby comment explaining why the scope exists;
- rely on `packages/cli/src/commands/command-architecture.test.ts` for handler
  registry drift.

Do not refactor CLI files in this slice unless the lint rule reveals a small,
obvious local cleanup needed for the config to pass.

### Slice 4: Studio Raw Control Enforcement

Add a Studio ESLint override that rejects raw interactive controls in
`src/app` and `src/features`.

Keep `src/ui` as the explicit owner for raw control implementation.

Run:

```bash
pnpm --filter @gorenku/studio lint
```

If it fails, fix only true violations by replacing feature raw controls with
existing local `src/ui` primitives. If a needed primitive does not exist, add
that primitive first, then use it from feature code.

### Slice 5: Architecture Test Coverage Audit

Confirm that every existing architecture test is included in
`check:architecture`.

Do not add speculative tests. Add only low-noise tests for current known
mechanical gaps discovered while implementing the lint changes.

Candidate additions only if needed:

- a Studio test for feature-local `StudioResourceChangedDetail` variants if the
  existing test misses a real pattern;
- a root script check for raw controls if ESLint cannot express the rule cleanly
  enough;
- a package-boundary import check if `no-restricted-imports` is too package
  specific to keep readable.

### Slice 6: Final Verification

Run the focused commands during implementation:

```bash
pnpm lint:diagnostics
pnpm lint:core
pnpm lint:cli
pnpm lint:engines
pnpm lint:studio
pnpm check:architecture
```

Then run:

```bash
pnpm check
```

If `pnpm check` becomes too slow only because `check:architecture` is included,
keep the architecture command but inspect the slow test and make that test more
focused. Do not remove architecture checks from `pnpm check`.

## Review Notes

Reviewers should verify that this implementation keeps a low-noise philosophy.

Reject changes that:

- add broad naming lint rules;
- add hard global file/function-size gates;
- ban common words without context;
- create many lint disables;
- add compatibility wrappers around ESLint config ownership;
- move subjective review concerns out of the new review skill and into
  mechanical lint.

Accept changes that:

- make package lint baselines consistent;
- catch raw Studio controls in feature code;
- keep CLI command complexity guardrails from drifting;
- put architecture tests into the normal check path;
- keep all new checks fast, specific, and explainable.

## Completion Checklist

### Review Area

- [ ] Confirm the implementation covers only low-noise mechanical rules.
- [ ] Confirm judgment-heavy concerns remain assigned to
  `renku-code-quality-review` and human/code review.
- [ ] Confirm no broad fallback-word, naming-word, or `throw new Error` lint
  bans were added.
- [ ] Confirm no global hard file-size or function-size gates were added.
- [ ] Confirm any lint disable added during implementation has a specific,
  current architecture reason.

### Architecture And Contracts

- [ ] Update `pnpm check` so it always runs architecture checks.
- [ ] Update `check:architecture` so it runs the root forbidden re-export
  checker.
- [ ] Update `check:architecture` so it runs Core architecture tests.
- [ ] Update `check:architecture` so it runs CLI command architecture tests.
- [ ] Update `check:architecture` so it runs Studio architecture tests.
- [ ] Confirm `check:architecture` stays focused and does not run full package
  test suites.
- [ ] Confirm existing architecture tests remain the source of truth for
  repo-specific boundaries that ESLint cannot express cleanly.

### Package Lint Baseline

- [ ] Compare `core`, `cli`, `engines`, and `diagnostics` ESLint configs after
  changes and confirm their baseline rules match.
- [ ] Confirm Engines has TypeScript-aware unused-variable linting equivalent
  to the other Node packages.
- [ ] Confirm package-specific globals remain correct for Engines provider code.
- [ ] Confirm Studio keeps its React hooks, React refresh, TypeScript, and
  Tailwind rules.
- [ ] Confirm no new third-party lint tooling was introduced unless it was
  already needed and documented in the package config change.

### CLI

- [ ] Audit `packages/cli/src/commands` for the intended command-rule scope.
- [ ] Apply `complexity`, `max-depth`, and `no-nested-ternary` consistently to
  the accepted command-rule scope.
- [ ] Confirm new command files cannot silently bypass the intended CLI command
  architecture rules, or document the scoped list clearly if a broad glob is
  too noisy.
- [ ] Confirm `packages/cli/src/commands/command-architecture.test.ts` still
  verifies handler registries and prevents deep imports of Core media-generation
  internals.

### Studio

- [ ] Add an ESLint rule that forbids raw `button`, `input`, `select`,
  `textarea`, and `dialog` JSX elements in `src/app` and `src/features`.
- [ ] Confirm raw controls remain allowed in `src/ui` primitive
  implementations.
- [ ] Confirm tests and generated/build outputs are not accidentally caught by
  the raw-control rule.
- [ ] Confirm any true raw-control violations are fixed by using existing local
  shadcn-style primitives or by adding a local `src/ui` primitive first.
- [ ] Confirm Studio resource-refresh architecture tests are included in the
  root architecture check.

### Core

- [ ] Keep direct SQLite access enforcement in the existing Core architecture
  test.
- [ ] Keep direct schema import enforcement in the existing Core architecture
  test.
- [ ] Keep ProjectDataService facade/wiring size checks scoped to those
  deliberately small files.
- [ ] Do not add broad Core file-size or complexity gates in this implementation
  slice.

### Engines

- [ ] Bring Engines lint baseline in line with the other Node packages.
- [ ] Confirm provider compatibility and simulated fallback terminology is not
  banned mechanically.
- [ ] Confirm provider/runtime error handling is not forced into structured
  diagnostics by a broad lint rule where Engines is not a Studio package
  boundary.
- [ ] Run Engines lint after changes and inspect any failures for true low-noise
  fixes only.

### Diagnostics

- [ ] Keep Diagnostics on the shared Node package baseline.
- [ ] Avoid extra package-specific strictness unless the package grows or a
  concrete regression appears.

### Validation

- [ ] Run `pnpm lint:diagnostics`.
- [ ] Run `pnpm lint:core`.
- [ ] Run `pnpm lint:cli`.
- [ ] Run `pnpm lint:engines`.
- [ ] Run `pnpm lint:studio`.
- [ ] Run `pnpm check:architecture`.
- [ ] Run `pnpm check`.
- [ ] If a new check fails, fix the code or scope the rule only when the failure
  is a genuine false positive under this plan's low-noise principle.

### Documentation And Follow-Up

- [ ] Update `docs/architecture/coding-practices.md` only if the accepted
  enforcement policy changes, not just to restate this implementation plan.
- [ ] Add an ADR only if implementation chooses a new durable enforcement
  policy beyond this plan.
- [ ] Do not edit historical plans for naming or lint consistency.
- [ ] If specific oversize files need future refactors, create separate focused
  plans for those areas instead of adding global size gates here.

### Final Verification

- [ ] Confirm `git diff` contains only lint/check configuration, focused
  architecture-test updates if needed, and small direct fixes required by the
  new low-noise checks.
- [ ] Confirm no runtime behavior changed except true fixes needed to satisfy
  mechanical rules.
- [ ] Confirm the final implementation report names every command run and
  whether it passed.
