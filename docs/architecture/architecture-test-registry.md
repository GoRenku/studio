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

- `packages/studio/server/routes/screenplay/index.test.ts`

Forbidden capabilities:

- route-local project database, schema, Drizzle, or SQLite access;
- route-local Beat validation or durable Scene Beats writes;
- route-local Shot persistence or production behavior;
- broad durable mutation escape hatches that let a route write arbitrary
  project state instead of calling focused Core behavior.

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

- arbitrary Scene Beats state patching;
- public raw Shot or Take state update commands;
- project database, schema, Drizzle, or SQLite access from command handlers;
- deep imports of core media-generation internals when the CLI should call the
  public core service contract.

Maintenance owner:

- CLI feature work must add command handlers through the focused registry, call
  core services, and keep command-boundary diagnostics structured. Runtime CLI
  tests should carry behavior such as Scene Beats commands preserving
  Core-owned validation and structured diagnostics.

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

- `packages/core/src/server/scene-beats/history.test.ts`

Forbidden capabilities:

- adapter-facing generic Scene Beats or Shot-state patch contracts;
- low-level durable Scene Beats writers imported outside the owning Core module;
- broad service wiring functions that directly own durable mutation rules;
- compatibility aliases for obsolete mutation shapes.

Maintenance owner:

- Core feature work that adds a durable mutation must add or update a focused
  core command, structured diagnostics, and invalid-input regression tests that
  prove bad state fails before a write. Static tests should protect the owner
  boundary, not require a central list of every focused command.

### Core Media Review And Provenance

Owner docs:

- `docs/decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`

Static tests:

- `packages/core/src/server/architecture.test.ts`
- `packages/studio/src/architecture.test.ts`

Runtime tests:

- `packages/core/src/server/media-generation-review/document.test.ts`
- `packages/core/src/server/media-generation-review/preview.test.ts`
- `packages/studio/src/features/media-generation-request/media-generation-request-view.test.tsx`

Forbidden capabilities:

- Core or Studio interpreting provider-native request fields or creative
  contents;
- routes or UI owning provenance, path, or attachment validation;
- Studio importing Engines or provider SDKs;
- Preview editing nested provider request fields or emitting execution intent;
- durable provider upload URLs, credentials, signed URLs, or unsafe paths;
- direct Drizzle schema imports outside database access and schema modules;
- compatibility routes, commands, or fields for removed request/job lifecycles.

Maintenance owner:

- Core owns the small review/provenance envelope, safety, local reference
  projection, prompt update, Asset provenance, and focused attachment. Studio
  renders Core projections. Tests protect behavior and import boundaries rather
  than private helper names.

### Standalone Media Engines Boundary

Owner docs:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`

Static tests:

- `packages/engines/src/media/engine.test.ts`
- `packages/core/src/server/architecture.test.ts`
- `packages/cli/src/commands/command-architecture.test.ts`

Runtime tests:

- `packages/engines/src/providers/supported-models.test.ts`
- `packages/engines/src/shared/metadata-cache.test.ts`
- `packages/engines/src/shared/retry.test.ts`

Forbidden capabilities:

- Engines depending on a Studio workspace package or Project concepts;
- Core or Studio importing Engines/provider SDKs;
- CLI handlers implementing provider validation, upload, polling, retry,
  recovery, normalization, or download;
- production registration of unindexed providers or models;
- generic catalog, pricing, simulation, Spec, Run, or approval lifecycle state.

Maintenance owner:

- Engines owns provider protocol execution behind `MediaProvider` and
  `MediaEngine`. Core owns review/provenance and focused attachment. CLI is the
  thin composition root. Static tests protect stable import/public boundaries;
  runtime tests prove execution, cache, retry, request, and error behavior.
