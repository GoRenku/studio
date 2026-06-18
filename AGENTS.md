# Agent Rules for Renku Studio

## Top Instruction: Architecture Is A Hard Gate

Do not make or accept a fix that is architecturally incorrect, even when it
appears to solve the immediate bug.

Renku Studio architecture rules are hard boundaries, not preferences. A change
is not complete, acceptable, or review-ready if it fixes behavior by putting
business logic in the wrong layer, bypassing the package that owns the domain
rule, duplicating validation in an adapter, or creating a shortcut around the
current contract.

The default behavior must be:

- fix the ownership boundary first, then fix the bug inside that boundary;
- stop and redesign the slice when the obvious patch would cross a package,
  storage, schema, command, or UI ownership line;
- reject route-local, CLI-local, React-local, or agent-local business rules
  when the rule belongs in `packages/core`;
- reject broad escape-hatch APIs that let adapters write arbitrary domain state
  instead of calling focused core commands;
- reject "temporary" server, CLI, or UI validation whose real purpose is to
  compensate for missing core validation;
- keep durable metadata mutations behind core-owned commands and services;
- keep Studio server handlers thin: read HTTP params/body, call core, serialize
  the core response, and translate structured errors;
- keep CLI handlers thin: parse flags/files, call core, format output, and
  report structured diagnostics;
- keep React feature code as a projection consumer that sends user intent to the
  server instead of enforcing project metadata rules locally.

If a bug exposes a missing core command, missing domain validator, weak service
contract, or vague ownership boundary, add or correct that architecture as part
of the fix. Do not patch around it in the caller.

Concrete examples of forbidden fixes:

- adding Studio server route logic that decides whether an asset belongs to a
  Cast Member, Location, Lookbook, dialogue, take, or dependency slot;
- allowing HTTP or CLI code to call a generic state patch API to mutate durable
  take metadata;
- adding React checks that decide whether generated media can be used as a
  selected dependency when core does not enforce the same rule;
- adding CLI-specific purpose or provider business logic instead of using the
  shared core generation service;
- accepting invalid project state and relying on a later panel, preflight, or
  render path to interpret or repair it.

When reviewing code, treat architectural boundary violations as high-severity
issues even if tests pass and the UI appears to work.

## Top Instruction: Use Shadcn UI Controls Only

In `packages/studio`, it is strictly forbidden to use raw HTML form or
interactive controls in feature code. Always use the local shadcn-style
components from `packages/studio/src/ui`, with no exceptions.

That means:

- do not write raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`,
  or similar browser controls in feature components;
- use `Button`, `Input`, `Select`, `Textarea`, `Dialog`, `Slider`, `Tabs`, and
  other local shadcn primitives instead;
- if a needed shadcn primitive does not exist yet, add a local `src/ui/*`
  component first, then consume that component from feature code;
- feature code may use semantic non-control HTML such as `section`, `fieldset`,
  `legend`, `div`, `span`, and `p` for structure and copy.

## Top Instruction: Keep UI Copy Intentional

Do not invent visible UI text just to fill space. In particular, do not show raw
filenames, kebab-case identifiers, asset ids, generated role names, or generic
pick labels on visual cards unless that copy is meaningful product/domain text
that the user or current data model actually supplies.

If a visual surface does not have useful text to show, keep the surface quiet
and let the image, controls, and surrounding section title carry the interface.

## Top Instruction: Desktop-First Verification

Renku Studio is not intended for mobile use. Do not test, optimize, or report
mobile viewport behavior unless the user explicitly asks for mobile support.

## Top Instruction: No Shims, No Compatibility Layers

Renku Studio is pre-customer software and will be continuously iterated.

During this phase, do not preserve backwards compatibility in code, tests, file
structure, package exports, command behavior, schemas, or documentation.

That means:

- do not keep old names as aliases;
- do not add shims for prior APIs;
- do not add fallback branches for old structures;
- do not add compatibility layers;
- do not add duplicate convenience fields, convenience DTO properties, derived
  mirrors, or parallel state whose purpose is to make an old or intermediate
  model easier to keep using;
- do not add wrapper components, wrapper functions, adapter files, facade
  modules, or thin pass-through helpers whose main purpose is to preserve,
  rename, or locally repackage another API, component, command, route, schema,
  or import path;
- do not add convenience re-exports to avoid fixing callers;
- do not keep tests whose only purpose is to reject, warn about, repair,
  translate, or otherwise recognize an obsolete format;
- do not keep old loaders after the model changes;
- do not add warnings, errors, diagnostics, repair paths, migration-at-read
  paths, or special validation branches whose purpose is to recognize an
  obsolete shape by name;
- do not mention obsolete names in new code unless a document is explicitly
  describing a historical decision or a one-way database migration is converting
  already-existing development data to the current shape.

When a name, owner package, API, folder structure, schema, route, command, or
file format changes, update callers directly to the new shape and delete the
obsolete code.

Tests should describe the current intended behavior only. They should not become
a museum of previous iterations.

Current code should read as if obsolete models never existed. One-way database
migrations may mention old table names, column names, ids, or JSON fields only
to transform existing development data into the current model. Runtime code
must not preserve those names as recognized concepts.

When working in this repository, prioritize clarity, explicit contracts, and
small focused changes.

## Project Shape

Renku Studio is a pnpm monorepo with these initial packages:

- `packages/core` (`@gorenku/studio-core`) owns Studio domain types, validation,
  workflow primitives, and shared non-UI logic.
- `packages/cli` (`@gorenku/studio-cli`) owns the `renku-studio` command-line
  surface.
- `packages/engines` (`@gorenku/studio-engines`) owns model-provider catalogs,
  schema-first validation, simulation, and AI provider adapters.
- `packages/studio` (`@gorenku/studio`) owns the browser Studio application.

`packages/engines` should stay focused on asset generation engines. Do not add
legacy Renku timeline/export producers, Remotion, FFmpeg final-render producers,
or old execution-plan bridge code unless the user explicitly decides to redesign
those concepts for Studio.

## Build and Test Commands

Use root commands for the new Studio workspace only:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Use focused commands when touching one package:

```bash
pnpm build:core
pnpm test:engines
pnpm test:cli
pnpm dev:studio
```

Do not run `pnpm install`, `pnpm add`, or other package-management commands
unless the user explicitly asks for dependency installation.

## Documentation Rules

- Use `docs/` for accepted project documentation.
- Use `plans/active/` for current implementation plans and open design work.
- Use `plans/exploration/` for rough product, UI, story, and workflow
  exploration.
- Use `docs/decisions/` for accepted technical or product decisions.
- During naming sweeps, do not edit old or historical plan files just to replace
  names. Update only the currently used plan when the naming change affects the
  active implementation direction.
- When a plan becomes accepted project direction, summarize the final decision
  in `docs/` instead of leaving the plan as the only source of truth.
- Write plans for the current pre-customer iteration model. Do not describe
  long-lived coexistence, migration periods, compatibility aliases, fallback
  command paths, or "until the new path exists" behavior unless the user
  explicitly asks for a staged migration. When a plan changes an API, command,
  schema, file structure, or workflow, plan to update callers directly and
  remove the old path in the same implementation slice.
- Plans must be reviewable before implementation. Name public commands,
  contracts, folders, files, package responsibilities, and domain concepts
  deliberately in the plan. Do not defer interface-level naming with phrases
  such as "names can be refined during implementation"; only low-level local
  variable or private helper naming may be left to implementation.
- Every active implementation plan must include a detailed, comprehensive
  completion checklist near the end of the document, similar in depth to
  `plans/active/0042-shot-video-take-generation-plan-architecture.md`. Group
  checklist items by review area, architecture/contracts, implementation slices,
  UI/CLI/agent surfaces when relevant, validation/tests, documentation/ADR work,
  and final verification. The checklist should be specific enough that a reviewer
  can track implementation progress without rereading the full plan.

## Very Important: Fail Fast With Structured Errors

Do not add fallback behavior unless there is a very good reason for a valid,
explicitly specified case.

The default behavior should be:

- fail fast when required configuration, mappings, files, schema data, or inputs
  are missing or invalid;
- report failures through a systematic error mechanism with clear error codes;
- avoid loose `throw new Error(...)` usage at package boundaries;
- avoid silent defaults that hide broken setup or incomplete data;
- avoid guessing user intent from old names, old folder structures, or partial
  matches.

Fallbacks are allowed only when the behavior is deliberately designed,
documented, and tested as part of the current architecture. They must not be used
to preserve obsolete behavior or paper over invalid state.

## Very Important: Naming Is Architecture

Naming is a core architecture concern in Renku Studio. Never create generic
placeholder names when a domain name exists.

The default behavior should be:

- use deliberate names from the domain vocabulary in
  `docs/architecture/data-model-and-storage.md`;
- follow the detailed naming rules in `docs/architecture/naming-guidelines.md`;
- use plain domain names for public contract objects, such as `Project`,
  `Episode`, `Sequence`, `Scene`, `Clip`, `CastMember`, and `VisualLanguage`;
- reserve suffixes such as `Setup` and `Record` for internal boundary-specific
  shapes;
- avoid broad placeholder names such as `data`, `item`, `manager`, `helper`,
  `detail`, `snapshot`, `view`, and one-off verb filenames such as `create.ts`
  or `open.ts`;
- rename callers directly when names change instead of adding aliases.

If a name feels temporary or vague, stop and choose a clearer domain name before
writing code.

For `packages/studio` frontend structure, component naming, service boundaries,
hooks, and React conventions, follow the progressive guidance in
`docs/architecture/front-end-guidelines.md`.

## Very Important: Drizzle Migrations Use Drizzle Kit

Before changing database schemas or migrations, look up the current Drizzle
migration documentation and follow the documented Drizzle Kit workflow.

For Renku Studio project databases:

- the Drizzle TypeScript schema is the source of truth;
- generate SQL migrations with the `drizzle-kit` CLI;
- apply SQL migrations with the `drizzle-kit` CLI;
- do not hand-write TypeScript migration registries;
- do not copy generated SQL into TypeScript files;
- do not manually edit generated migration SQL unless the current architecture
  explicitly calls for a custom migration;
- keep generated migration files in the package-owned migrations folder;
- document any intentional custom migration before adding it.

The accepted details live in
`docs/architecture/drizzle-migrations.md`.

## Very Important: Structured Diagnostics At Package Boundaries

Use `@gorenku/studio-diagnostics` for package-boundary errors, validation
issues, and agent-readable command failures.

The default behavior should be:

- report structured errors with stable domain-prefixed codes;
- collect all actionable validation issues before failing;
- distinguish warnings from errors;
- include locations and suggestions when they help the caller fix the problem;
- serialize structured errors consistently in CLI and Studio HTTP responses.

Do not create structured diagnostics specifically for obsolete schemas,
commands, fields, aliases, or compatibility shapes. Once a model is replaced,
runtime validation should describe only the current contract; obsolete shapes
should not get named warnings, repair suggestions, compatibility errors, or
agent-readable guidance.

For import YAML, unknown fields are warnings and must be ignored. They must
never drive database schema, DTO, or API shape changes. Required fields that are
missing or invalid are errors.

The accepted details live in
`docs/architecture/structured-diagnostics.md`.

## Very Important: No Re-Export Stubs Or Compatibility Barrels

Do not add files whose purpose is to re-export types, functions, classes,
constants, components, commands, resources, or database access helpers from
another module. This rule applies both across workspace packages and inside a
single package.

The default behavior should be:

- import from the package that owns the concept;
- add that package as an explicit dependency when needed;
- update callers directly when ownership changes;
- avoid barrels that make one package, folder, or layer look like it owns
  another module's API;
- delete obsolete import paths instead of preserving them through re-export
  files;
- move the implementation to the owning module if ownership has genuinely
  changed, then update callers to import from that owner.

Re-exporting is allowed only in `index.ts` files when the index is an
intentional public entrypoint for a package or clearly bounded module API. Even
then, it must not be used as a shortcut to avoid fixing callers after a rename,
move, or ownership change. Non-index files must not be re-export facades.

## Very Important: Keep Code Structure Reviewable

Follow `docs/architecture/coding-practices.md`.

Do not write large exported functions that route many unrelated command paths,
dispatch many purposes, parse files, call services, format output, and emit side
effects in one body.

The default behavior should be:

- keep functions focused and shallow;
- avoid nested ternary dispatch;
- avoid long `if` / `else if` command and purpose chains;
- use command handlers, dispatch tables, typed registries, focused parsers, or
  purpose-specific modules when code branches by command, purpose, provider,
  route, or media kind;
- keep exported command entry points thin but properly structured;
- add lint rules or focused static tests when refactoring a complex command area
  so the complexity does not return.

The CLI is a crucial human-facing and agent-facing contract. It must remain a
thin wrapper over core, but thin code is not allowed to be a single tangled
function.

## Coding Rules

- Keep package names product-scoped under `@gorenku/studio-*`.
- Keep local folder names short: `core`, `cli`, `studio`, and later `engines`.
- Do not introduce dependencies on the old `@gorenku/core`,
  `@gorenku/providers`, or `@gorenku/compositions` packages from the Studio app.
- Prefer straightforward TypeScript over speculative defensive code.
- Do not generate build artifacts into source directories.
- Never delete files, reset changes, or run destructive git commands without
  explicit user confirmation.
