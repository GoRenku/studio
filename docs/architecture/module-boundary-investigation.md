# Module Boundary Investigation

Date: 2026-07-04

Status: accepted follow-up recorded

Role: architecture investigation

## Purpose

This investigation records module-boundary gaps exposed while cleaning up
architecture tests.

The immediate smell was a set of static tests that tried to protect real
architecture rules by scanning source text for current private file names,
function names, or partial path strings. That is not an acceptable architecture
test strategy. It makes ordinary refactors fail and hides the deeper problem:
some areas do not yet have stable module boundaries that can be checked cleanly.

Static architecture tests should be added only after the boundary exists as a
real package, folder, public contract, or runtime behavior.

## Findings

### 1. Media Generation Cost Rail Is Not A Stable Module Boundary

Current direction:

- Estimates are a separate cost rail.
- Estimates may price a full dependency to-do list.
- Estimates must not prepare provider payloads, validate generation readiness,
  resolve provider inputs, or run generation.

Current smell:

- Cost-related code lives under `packages/core/src/server/media-generation`, but
  the broader media-generation folder also owns readiness, provider payload
  construction, dependency inventory, media import, generation runs, and
  purpose-specific mutation code.
- Because those responsibilities are close siblings, a static test cannot cleanly
  say "cost rail cannot import execution rail" without naming today's files.

Missing boundary:

- A stable Core cost module, for example a cost-rail folder or package-owned
  module, whose public API is limited to pricing projection and estimate reports.

Desired shape:

- Cost rail may depend on browser-safe spec contracts, pricing facts, model/route
  pricing data, and the engine pricing API.
- Cost rail must not depend on provider payload construction, live generation,
  media import, file resolution, readiness/preflight validation, or durable
  mutation services.

Future enforceable check:

- Once the cost rail has an explicit folder boundary, add an import-boundary test
  for that folder. Do not add a source-text blacklist before the folder boundary
  exists.

### 2. Engines Pricing And Execution Are Intermixed In One Generation Folder

Current direction:

- Engine cost estimation is a pricing API.
- Engine live generation is an execution API.
- Execution may build provider payloads, validate provider schemas, read input
  files, invoke providers, and persist outputs.
- Pricing should use declared pricing inputs and catalog pricing facts.

Current smell:

- Pricing, request hashing, provider payload construction, provider payload
  validation, input-file payload handling, model discovery, and live runner code
  are all peers in `packages/engines/src/generation`.
- A test that tries to protect pricing purity has to know private file names
  because there is no pricing-vs-execution module boundary.

Missing boundary:

- A stable engines pricing module separated from execution/payload/provider
  modules.

Desired shape:

- `generation/pricing` owns estimates, approval-token hashing for estimates, and
  billable-unit normalization.
- `generation/execution` owns live/simulated execution, provider payload
  validation, SDK handoff, input file loading, and output persistence.
- Shared contracts stay in a deliberately named contract module.

Future enforceable check:

- Once pricing and execution are separate modules, add an import-boundary test
  that pricing cannot import execution, payload, SDK, or filesystem modules.

### 3. Shot Video Take Is A Large Sibling Folder Instead Of Bounded Submodules

Current direction:

- Shot Video Take has several distinct domains: authoring, production planning,
  dependency inventory, reference selection, input preparation, final spec
  creation, provider payload construction, media import, generation run
  recording, and durable take-state mutation.

Current smell:

- These responsibilities are split into many files, but they are still mostly
  peers in one folder.
- Because the folder does not express submodule ownership, architecture tests
  cannot tell whether an import crosses a domain boundary or is normal local
  collaboration.
- The result is temptation to write tests that ban today's file names instead of
  enforcing a real boundary.

Missing boundary:

- Explicit Shot Video Take submodules with named ownership and public entry
  points.

Candidate submodules:

- authoring and user-editable direction state;
- production planning and dependency inventory;
- reference and input selection;
- final spec preparation;
- provider payload preparation;
- live generation/run recording;
- media import;
- durable take persistence.

Future enforceable check:

- After submodules exist, use import-boundary checks between submodules. For
  example, planning should not import live generation, and HTTP/CLI adapters
  should call public core commands rather than submodule internals.

### 4. Purpose Lifecycle And Purpose Implementations Need Clearer Ownership

Current direction:

- Shared media-generation lifecycle should own context, model list, validation,
  spec persistence, estimate, run, and import orchestration.
- Purpose definitions should own purpose-specific context, provider payloads,
  dependency declarations, output naming, and import behavior.

Current smell:

- The registry, shared service, purpose-specific modules, and dependency helpers
  are close enough that boundaries are easy to blur.
- Some checks currently protect outcomes through runtime tests, but the module
  shape does not make ownership obvious from imports alone.

Missing boundary:

- A clearer split between lifecycle orchestration, purpose definitions, dependency
  inventory utilities, and purpose-specific implementations.

Future enforceable check:

- Once these are stable modules, architecture tests can check dependency
  direction, such as purpose implementations depending on lifecycle contracts but
  lifecycle orchestration not depending on purpose-private helpers except through
  registered definitions.

## Removed Static Checks

The cleanup removed static checks that tried to enforce these concerns by naming
current private implementation paths. Those checks were not wrong about the
desired architecture, but they were wrong as tests.

Until the module boundaries above exist, use runtime tests and focused code review
to protect the behavior:

- estimates remain cost projections, not generation preparation;
- pricing code does not execute providers;
- live generation remains one approved run at a time;
- invalid state fails before durable mutation;
- adapters call core-owned commands and services.

## Recommendation

The missing boundaries described in this investigation have been accepted as the
implementation direction in
`plans/active/0108-media-generation-module-boundary-refactor.md` and
`docs/decisions/0044-use-media-generation-module-boundaries.md`.

The follow-up refactor creates the missing modules so the boundary is visible in
the filesystem and public APIs. Narrow import-boundary tests should name those
module boundaries, not private implementation files or helper names.

The target is a codebase where architecture tests can say "this module must not
import that module" instead of "this file must not mention today's private
helper."
