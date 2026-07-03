# Renku Code Quality Review Rubric

Use this rubric after reading `SKILL.md` and the relevant project docs. It
captures repeated Renku Studio correction patterns that ordinary correctness
review tends to miss.

## Source Map

Use these as source-of-truth anchors:

- `AGENTS.md`: top-level repo rules.
- `docs/architecture/coding-practices.md`: complexity, branching, and command
  shape rules.
- `docs/architecture/naming-guidelines.md`: domain naming, US English,
  no obsolete names, no placeholder terms, and suffix rules.
- `docs/architecture/layers-of-responsibility.md`: package ownership.
- `docs/architecture/core-design-principles.md`: source of truth, fail fast,
  metadata mutation, package boundaries, generation principles.
- `docs/architecture/reference/front-end-guidelines.md`: `packages/studio`
  folder responsibilities, UI primitives, resource refresh, and visual card
  contracts.
- `docs/architecture/reference/media-generation.md`: current shared generation
  lifecycle, dependency inventory, pricing, selectors, and import separation.
- `docs/decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`:
  naming and no-compatibility policy.
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`:
  current media-generation shared purpose architecture.
- `docs/decisions/0026-use-thin-structured-cli-command-handlers.md`: CLI shape.
- `docs/decisions/0030-use-unified-studio-resource-refresh-components.md` and
  `docs/decisions/0031-use-studio-server-owned-coordination-delivery.md`:
  resource refresh and live coordination boundaries.

Important history:

- `docs/decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
  is historical for media generation. `0025` supersedes the deferral after
  duplication justified a shared purpose architecture.
- `docs/decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
  is superseded. Current code should follow the dependency inventory/checklist
  direction in `docs/architecture/reference/media-generation.md` and the
  implemented `plans/active/0064-generation-dependency-inventory-cleanup.md`.

## Review Categories

### 1. Layering And Ownership

Check whether each package owns the correct responsibility.

- `packages/core` owns domain types, validation, mutations, projections,
  storage, project-relative paths, resource keys, media-generation purpose
  lifecycle, dependency inventories, and metadata writes.
- `packages/cli` owns argument parsing, command help, terminal output,
  process exit behavior, JSON/human formatting, and CLI-specific structured
  diagnostics. It must call core for business behavior.
- `packages/studio/server` owns HTTP routing, request extraction, response
  decoration, static/file streaming after safe core resolution, and structured
  HTTP error responses. It must not duplicate core data rules.
- `packages/studio/src` consumes projections, renders UI, calls Studio API
  services, and keeps only local ephemeral UI state. It must not import
  `@gorenku/studio-core/server`, Node filesystem modules, Drizzle drivers, or
  `better-sqlite3`.
- Agents and skills may inspect files, but metadata mutations must go through
  Renku commands. Direct `.renku/project.sqlite` writes are boundary violations.

Flag quick fixes such as:

- moving domain validation into React because it was convenient;
- adding CLI purpose-specific branching instead of calling the shared core
  generation service;
- making the server infer project relationships from folders;
- letting UI calculate pricing totals that core already reports;
- duplicating resource-key strings at CLI/server/browser boundaries.

### 2. Fail Fast And Structured Diagnostics

Default to fail fast when configuration, mappings, files, schema data, provider
routes, dependency selectors, or required inputs are missing or invalid.

Review questions:

- Does invalid state produce a structured diagnostic with a stable code,
  location, and useful suggestion?
- Does validation collect actionable issues when the caller benefits from the
  full set?
- Does package-boundary code avoid loose `throw new Error(...)`?
- Does code avoid silent defaults that hide broken setup?
- Does it avoid guessing from old names, folder positions, partial matches, or
  first rows?

Fallbacks are allowed only when they are current product behavior with a named
owner and tests. Examples of allowed fallback-like states in current generation
work include:

- cost estimates using documented conservative defaults when exact pricing facts
  are unavailable;
- selector `selected-or-default` behavior when explicitly declared;
- satisfied dependency pricing at `$0.00`;
- manual attachment `not-applicable` pricing because it is not generation work;
- unselected Reference tab alternatives using quiet `not-applicable` card
  pricing;
- valid provider routes returning explicit `unpriced` when pricing metadata is
  genuinely unavailable.

Flag fallback behavior such as:

- treating unknown selector kinds as missing;
- converting malformed requests into quiet missing dependencies;
- picking the first asset or Lookbook sheet without an explicit selector policy;
- swallowing planner, root-generation, or unexpected estimate failures behind
  empty diagnostics instead of returning documented estimate states/defaults;
- falling back to final-generation-only pricing when an inventory exists;
- using compatibility readers for old schema or command shapes.

### 3. No Compatibility Layers Or Re-Export Stubs

Renku Studio is pre-customer software. Current code should update callers
directly and delete obsolete surfaces.

Flag:

- aliases for old names or commands;
- shim functions for prior APIs;
- fallback branches for obsolete structures;
- compatibility loaders or tests preserving old formats;
- wrapper components/functions/modules whose main job is to rename or preserve
  another API;
- non-index re-export facades;
- index re-exports used as a shortcut to avoid fixing callers.

Allowed re-exporting is narrow: intentional `index.ts` public entrypoints for a
bounded module API, not compatibility barrels.

### 4. Complexity, Function Shape, And File Shape

Complexity is an architecture issue, not a style preference.

Default targets from `coding-practices.md`:

- exported command entry points: complexity `3` or lower;
- command handlers and UI event handlers: complexity `8` or lower;
- nesting depth: generally `2` or lower.

Flag functions that mix several responsibilities, such as command routing, flag
parsing, JSON parsing, validation, service calls, persistence, provider calls,
event emission, and output formatting in one body.

Prefer:

- command-handler maps;
- typed registries;
- focused parsers;
- purpose-specific modules;
- small validation functions;
- table-driven explicit domain cases.

Do not accept hidden complexity moved into anonymous callbacks, render helper
functions, nested ternaries, or giant files split into generic `helpers.ts` and
`utils.ts` modules. The recurring shot-video cleanup lesson is that file
splitting must follow a simpler current contract, not preserve a complex graph
or resolver under smaller filenames.

### 5. Naming

Names are architecture.

Check that public contracts, files, functions, commands, route modules, schema
fields, and tests use current domain vocabulary. Prefer plain domain names for
public contracts, such as `Project`, `Scene`, `Clip`, `CastMember`,
`VisualLanguage`, `Asset`, `AssetFile`, `take`, and `select`.

Flag broad placeholders unless the surrounding context makes them precise:

- `data`
- `item`
- `manager`
- `helper`
- `util`
- `detail`
- `snapshot`
- `view`
- `workspace`
- one-off verb filenames such as `create.ts` or `open.ts`

Also flag names that are too mechanically verbose. Avoid repeating owner words
already supplied by the folder, package, route, or feature boundary.

Boundary suffix rules:

- Use plain names for public browser-safe contracts.
- Use `Setup` for one-time setup input objects.
- Use `Record` for persistence-facing row shapes.
- Do not use `Dto` for the main public contracts.
- Use US English: `analyze`, `color`, `canceled`, not British spellings.

Frontend service functions should use resource verbs, such as `readProject` and
`updateProjectInformation`, instead of generic `fetchData`, `load`, or `open`.

### 6. Frontend Architecture And UI Controls

In `packages/studio`, feature code must use local shadcn-style primitives from
`packages/studio/src/ui`.

Flag raw browser controls in feature code:

- `<button>`
- `<input>`
- `<select>`
- `<textarea>`
- `<dialog>`

Raw controls are acceptable inside local `src/ui` primitive implementations.
If a primitive is missing, the expected fix is to add the local `src/ui/*`
component first and consume it from feature code.

Check frontend layer ownership:

- `src/app`: app shell and providers.
- `src/features`: product surfaces and feature-specific composition.
- `src/services`: Studio HTTP API clients and frontend API errors.
- `src/hooks`: reusable browser/app-state hooks.
- `src/lib`: small browser-safe utilities.
- `src/ui`: domain-neutral shadcn-style primitives.

Flag:

- feature code importing another feature's private component just for styling;
- domain-neutral reusable visual patterns kept in a feature folder;
- pass-through wrappers that only rename a shared UI primitive;
- noisy visual-card copy such as raw filenames, asset ids, generated role names,
  producer identifiers, or kebab-case labels;
- direct `window.addEventListener('renku:studio-resource-changed', ...)` in
  feature code;
- feature-local copies of `StudioResourceChangedDetail`;
- local revision counters replacing the shared refresh hook.

### 7. Data, Storage, And Migrations

SQLite owns durable project metadata and relationships. The filesystem owns
content files and generated media. Do not duplicate durable metadata in
Markdown frontmatter.

Review data access:

- Runtime project reads/writes should use Drizzle through `session.db`.
- Keep `better-sqlite3` details inside the project store adapter.
- Do not call `session.sqlite.prepare(...)` from commands, projections, server
  routes, CLI commands, or UI-facing resource code.
- Use raw SQL only for the documented infrastructure escape hatches.
- Store project-owned file references as project-relative paths and resolve
  them through core-owned path APIs.

Review migrations:

- Drizzle TypeScript schema is the source of truth.
- Generate and apply SQL migrations with Drizzle Kit.
- Do not hand-write TypeScript migration registries.
- Do not copy generated SQL into TypeScript files.
- Do not manually edit generated SQL unless a documented custom migration is
  part of the current architecture.

### 8. Media Generation And Dependency Inventory

Current architecture uses the shared media generation purpose registry and
shared generation service. Purpose definitions own purpose-specific context,
targets, model controls, spec validation, provider payloads, output naming,
media import, and dependency declarations.

Generated media is not attached to project metadata until an import command
succeeds.

Dependency inventories are the reference and pricing source of truth. They are
not automatic execution graphs.

Cost estimates are product guidance, not execution truth. They should give the
user a useful ballpark or conservative upper-bound estimate without turning the
estimate path into validation, preparation, provider payload construction, or
generation execution. Small differences from the eventual provider receipt are
acceptable when the estimate remains safe and understandable. A slightly high
estimate is usually better than no estimate.

When reviewing estimate changes, flag attempts to make estimates exact by
pulling in active generation behavior. Estimate code may use passive pricing
facts, static route/model metadata, spec fields, selected dependency counts, and
documented conservative defaults. It must not validate run-readiness, require
files to exist, prepare provider payloads, enforce creative or dependency
content correctness, or call generation/run services just to compute a price.
If a pricing fact is needed, prefer an estimate-owned approximation or
conservative default over importing the active run path.

Do not report estimate-only defaults as bugs merely because they are not exact.
For example, an unresolved image frame can use an intentional default rather
than failing the estimate. Report it only when the default is clearly unsafe,
systematically underprices a known paid path, or bypasses the cost approval
contract.

Keep the approval-token contract separate from estimate exactness. It is still a
high-severity issue if live paid generation accepts arbitrary, stale, or
mismatched approval tokens. Direct provider-call boundaries must verify priced
tokens against the estimate they actually compute, while keeping an explicit
unpriced override path.

Flag:

- UI-side pricing totals when core reports an inventory estimate;
- final-only estimate fallback when an inventory exists;
- validation, preparation, provider-payload, or run-service behavior pulled into
  estimates for exactness;
- estimate findings that demand failure or validation where a conservative
  default is the intended product behavior;
- live paid generation paths that accept any non-empty approval token instead of
  verifying the current priced estimate token;
- selected generated dependencies with `not-applicable` pricing;
- public graph execution fields such as execution levels for dependencies;
- React parsing dependency id strings to infer mutation behavior;
- duplicated shot-video dependency slot/id systems;
- dependency ids built in multiple places instead of core-owned helpers;
- selectors without explicit selection policy;
- root spec creation that persists while required generated dependencies are
  still missing or only planned;
- generated dependency draft specs that invent placeholder asset records or
  project-relative output paths for files that do not exist.

### 9. Resource Refresh And Coordination

Resource refresh is a live invalidation system, not durable project history.

Check that:

- core owns resource-key vocabulary;
- durable mutations return resource keys from core;
- CLI notifies the running Studio server after successful visible mutations
  instead of writing coordination JSONL directly;
- Studio server validates the notification and appends coordination events;
- browser surfaces subscribe through the shared refresh hook or matcher module;
- mutation routes preserve resource keys returned by core.

Flag:

- resource-key literals assembled outside the accepted core catalog, tests, or
  focused matcher code;
- CLI direct writes to Studio coordination files;
- browser feature-level raw event listeners;
- broad project reloads used because selected-resource ownership is unclear;
- offline backlogs of stale refresh hints.

## Finding Checklist

Before sending findings, verify:

- Every finding cites the file and line.
- Every finding gives a concrete scenario, not just a rule name.
- Every finding explains expected impact.
- Every finding proposes a practical solution.
- Findings are ordered by severity.
- Non-issues and historical context are not reported as findings.
- If no issues are found, the response says that clearly and names residual
  test or verification gaps.
