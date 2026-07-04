# Renku Studio Architecture Test Registry

Date: 2026-06-19

Status: current

Role: topic overview

## Purpose

Architecture tests are part of Renku Studio's architecture contract, but they
must earn their maintenance cost. Their job is to protect ownership boundaries
that would otherwise be easy to bypass from an adapter.

The preferred model is signal over inventory:

- static tests protect stable boundaries such as forbidden imports, raw browser
  controls, and broad adapter-facing mutation escape hatches;
- runtime tests prove concrete data-integrity behavior such as wrong-scene or
  wrong-owner mutations failing before writes;
- architecture tests should not list every legitimate command, helper, or
  service method in the codebase;
- a valid refactor inside the owning package should not require architecture
  test edits.

Hard rule: static architecture tests must not hard-code current implementation
function names, class names, private helper names, local variable names, or
command/service inventories as source-text strings. If the boundary is real,
write the test against the import boundary, public contract shape, package layer,
or runtime behavior instead of the current helper name that happens to implement
it.

When a feature changes a boundary, update this registry and the relevant tests
in the same implementation slice. Routine feature growth that stays inside an
already-protected boundary should usually need only an Architecture Test Impact
note in the plan.

## Registered Boundaries

### Studio Server Routes Are Thin Adapters

Owner docs:

- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/studio-server-hono.md`
- `docs/architecture/structured-diagnostics.md`

Static tests:

- `packages/studio/server/architecture.test.ts`

Runtime tests:

- `packages/studio/server/routes/screenplay-video-take-production.test.ts`

Forbidden capabilities:

- route-local project database, schema, Drizzle, or SQLite access;
- generic shot-video take state patching;
- route-local inspection of durable take `referenceSelections`;
- broad durable mutation escape hatches that let a route write arbitrary take
  state instead of calling focused core behavior.

Maintenance owner:

- Studio server route work that adds or changes a metadata mutation must verify
  the route calls core-owned behavior and returns structured core errors
  unchanged. Add new static tests only when the route introduces a new boundary
  category that existing import and escape-hatch checks do not cover.

### CLI Commands Are Thin Core Adapters

Owner docs:

- `docs/architecture/layers-of-responsibility.md`
- `docs/decisions/0026-use-thin-structured-cli-command-handlers.md`

Static tests:

- `packages/cli/src/commands/command-architecture.test.ts`

Runtime tests:

- `packages/cli/src/cli.test.ts`

Forbidden capabilities:

- arbitrary shot-video take state patching;
- public raw take-state JSON update commands;
- project database, schema, Drizzle, or SQLite access from command handlers;
- deep imports of core media-generation internals when the CLI should call the
  public core service contract.

Maintenance owner:

- CLI feature work must add command handlers through the focused registry, call
  core services, and keep command-boundary diagnostics structured. Runtime CLI
  tests should carry behavior such as take-scoped commands not requiring
  caller-owned shot ids.

### React Feature Code Is A Projection Consumer

Owner docs:

- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md`

Static tests:

- `packages/studio/src/architecture.test.ts`

Runtime tests:

- feature tests beside the changed React surface;
- service tests in `packages/studio/src/services/*test.ts` when HTTP DTOs
  change.

Forbidden capabilities:

- importing `@gorenku/studio-core/server`;
- importing Node filesystem APIs, Drizzle, or `better-sqlite3`;
- raw browser controls outside `packages/studio/src/ui`;
- direct resource-change event listeners outside the shared refresh hook;
- local copies of the Studio resource-change detail type.

Maintenance owner:

- React feature work that sends mutations must call a service API with the
  current DTO shape and let core/server decide domain validity. Shared
  invalidation matching belongs in `src/hooks/use-studio-resource-refresh.ts`.
  Prefer service or runtime tests over source-text scans when the concern is
  whether a mutation DTO preserves dependency ids correctly.

### Core Owns Durable Metadata Mutation

Owner docs:

- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/structured-diagnostics.md`

Static tests:

- `packages/core/src/server/architecture.test.ts`

Runtime tests:

- `packages/core/src/server/media-generation/shot-video-take/reference-selection-mutations.test.ts`
- `packages/core/src/server/media-generation/shot-video-take/input-selection.test.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-shot-membership.test.ts`

Forbidden capabilities:

- adapter-facing generic take-state patch contracts;
- low-level durable take-state writers imported outside core-owned media
  generation command modules;
- broad service wiring functions that directly own durable mutation rules;
- compatibility aliases for obsolete mutation shapes.

Maintenance owner:

- Core feature work that adds a durable mutation must add or update a focused
  core command, structured diagnostics, and invalid-input regression tests that
  prove bad state fails before a write. Static tests should protect the owner
  boundary, not require a central list of every focused command.

## Feature Plan Requirement

Every active implementation plan that adds or changes one of these surfaces
must include an `Architecture Test Impact` note:

- new Studio server route module;
- new CLI command family or subcommand;
- new durable metadata mutation;
- new media-generation purpose or dependency selector;
- new React feature workflow that sends mutations;
- new SQLite table, JSON column, or migration;
- new resource-refresh event or matcher;
- new public core service method.

The note must answer:

- Which package owns the domain rule?
- Which adapter is allowed to call it?
- Which existing static boundary check, if any, already prevents the rule from
  moving into the adapter?
- Which runtime boundary test proves invalid state fails before write?
- Does the feature introduce a new boundary category or failure mode that needs
  a new architecture test?
- Would the proposed test fail on a normal refactor inside the owning layer?

If no architecture test needs to change, the plan must say that explicitly and
explain why existing tests already protect the new surface. Silent omission is
not acceptable. A new architecture test is expected only when the feature
introduces a boundary or failure mode that current tests do not already cover.

## Architecture Test Acceptance Criteria

Before adding or keeping a static architecture test, answer these questions in
the plan, test comment, or this registry:

1. What specific boundary does this protect?
2. What bad code would this catch?
3. Would a normal refactor inside the owning layer make this fail?
4. Will adding a routine new command, helper, or service require editing this
   test?
5. Is a runtime behavior test a better fit?
6. Is the forbidden pattern stable enough for a static test?
7. Can this be enforced by a narrow import rule instead of a source-text scan?

If the answer to question 3 or 4 is yes, redesign or remove the test unless
there is an explicit accepted architecture decision saying the exact public
shape is the contract.

## ESLint Policy

ESLint may be used for low-noise import boundaries, especially where an import
restriction is clearer than a Vitest source scan.

Good ESLint candidates:

- browser feature code cannot import server-only core entrypoints;
- browser feature code cannot import Node, database, Drizzle, or SQLite APIs;
- package or directory scopes cannot import another layer's private internals.

Avoid ESLint rules that:

- inspect arbitrary identifier names;
- ban common words or helper names;
- encode current implementation function names;
- require large allowlists;
- use broad syntax bans where the violation is not a clear boundary crossing.

## Updating Tests When A Boundary Changes

When an accepted ADR or architecture document changes a boundary:

1. Update the owner doc or ADR first.
2. Update this registry in the same slice.
3. Update static architecture tests only when the changed boundary needs a
   static guard.
4. Update runtime boundary tests for concrete data-integrity behavior.
5. Remove tests for superseded boundaries.

Do not keep old and new architecture tests as a compatibility period unless the
user explicitly asks for a staged migration.

Exceptions must stay small, named, and tied to an accepted architecture doc. An
allowlist entry should explain why the boundary still holds.
