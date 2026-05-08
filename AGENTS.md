# Agent Rules for Renku Studio

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

## Top Instruction: No Shims, No Compatibility Layers

Renku Studio is pre-customer software and will be continuously iterated.

During this phase, do not preserve backwards compatibility in code, tests, file
structure, package exports, command behavior, schemas, or documentation.

That means:

- do not keep old names as aliases;
- do not add shims for prior APIs;
- do not add fallback branches for old structures;
- do not add compatibility layers;
- do not add convenience re-exports to avoid fixing callers;
- do not keep tests whose only purpose is to reject an obsolete format;
- do not keep old loaders after the model changes;
- do not mention obsolete names in new code unless a document is explicitly
  describing a historical decision.

When a name, owner package, API, folder structure, schema, route, command, or
file format changes, update callers directly to the new shape and delete the
obsolete code.

Tests should describe the current intended behavior only. They should not become
a museum of previous iterations.

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
- When a plan becomes accepted project direction, summarize the final decision
  in `docs/` instead of leaving the plan as the only source of truth.

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

For import YAML, unknown fields are warnings and must be ignored. They must
never drive database schema, DTO, or API shape changes. Required fields that are
missing or invalid are errors.

The accepted details live in
`docs/architecture/structured-diagnostics.md`.

## Very Important: Do Not Re-Export Another Package's API

Do not re-export types, functions, classes, or constants from another workspace
package as a convenience layer.

The default behavior should be:

- import from the package that owns the concept;
- add that package as an explicit dependency when needed;
- update callers directly when ownership changes;
- avoid barrels that make one package look like it owns another package's API.

Re-exporting is allowed only for a deliberately designed public facade that is
documented as such. Do not add facade exports as a shortcut to avoid fixing
callers.

## Coding Rules

- Keep package names product-scoped under `@gorenku/studio-*`.
- Keep local folder names short: `core`, `cli`, `studio`, and later `engines`.
- Do not introduce dependencies on the old `@gorenku/core`,
  `@gorenku/providers`, or `@gorenku/compositions` packages from the Studio app.
- Prefer straightforward TypeScript over speculative defensive code.
- Do not generate build artifacts into source directories.
- Never delete files, reset changes, or run destructive git commands without
  explicit user confirmation.
