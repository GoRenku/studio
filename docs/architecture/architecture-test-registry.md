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


Runtime tests:

- `packages/core/src/server/media-generation/purposes/shot-video-take/selection/mutations/reference-selections.test.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/selection/input-selection.test.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/persistence/take-shot-membership.test.ts`

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

### Context-First Generation Foundation

Owner docs:

- `docs/decisions/0047-use-context-first-provider-valid-generation.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/context-first-generation-foundation-manifest.md`

Static tests:

- `packages/core/src/server/generation/architecture.test.ts`
- `packages/core/src/server/architecture.test.ts`
- `packages/engines/src/generation/architecture.test.ts`

Runtime tests:

- `packages/core/src/server/generation/specs.test.ts`
- `packages/core/src/server/generation/validation.test.ts`
- `packages/engines/src/generation/catalog/model-input-descriptors.test.ts`
- `packages/engines/src/generation/execution/provider-request-assembly.test.ts`

Forbidden capabilities:

- provider validation importing context, purpose guide, candidate, slot, or
  dependency-planning modules;
- Core or adapters guessing provider media fields or duplicating provider
  schemas;
- provider defaults being copied into authored values or assembled payloads;
- validation substituting files, assigning fields, switching models, clamping
  values, or repairing requests;
- generation services importing Studio code or provider SDK adapters;
- direct Drizzle schema imports outside database access and schema modules;
- a compatibility CLI, HTTP, or Studio runtime between the Plan `0134` backend
  replacement and Plan `0135` product integration.

Maintenance owner:

- Generic generation work must keep persistence, reference projection,
  validation, preview, pricing, and execution in focused modules. Runtime tests
  prove partial-save and provider-validity behavior. Static tests protect stable
  package/import boundaries and must not inventory function or helper names.

The older cost/lifecycle/dependency registrations below describe the
pre-replacement backend. Plan `0134` removes them; they are not boundaries for
new foundation code. Plan `0135` must not recreate them for old callers.

### Engines Generation Pricing Rail

Owner docs:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `plans/active/0108-media-generation-module-boundary-refactor.md`

Static tests:

- `packages/engines/src/generation/architecture.test.ts`

Runtime tests:

- `packages/engines/src/generation/pricing/estimate-generation-cost.test.ts`
- `packages/engines/src/generation/execution/runner.test.ts`
- `packages/engines/src/generation/execution/provider-payload-validation.test.ts`

Forbidden capabilities:

- importing generation execution modules;
- importing provider SDK modules;
- reading or writing provider input/output files;
- building or validating provider payloads;
- loading generation input files;
- importing generation runners.

Maintenance owner:

- Engine pricing work must stay inside
  `packages/engines/src/generation/pricing` and depend only on generation
  pricing contracts, catalog facts, and deterministic cost hashing. Execution
  work belongs in `packages/engines/src/generation/execution`. Static tests
  should protect those module folders, while runtime tests prove pricing math,
  payload validation, and runner behavior.
