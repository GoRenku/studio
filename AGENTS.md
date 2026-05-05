# Agent Rules for Renku Studio

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

## Coding Rules

- Keep package names product-scoped under `@gorenku/studio-*`.
- Keep local folder names short: `core`, `cli`, `studio`, and later `engines`.
- Do not introduce dependencies on the old `@gorenku/core`,
  `@gorenku/providers`, or `@gorenku/compositions` packages from the Studio app.
- Do not add fallback logic to hide missing configuration or broken mappings.
  Fail clearly when a required value is missing.
- Prefer straightforward TypeScript over speculative defensive code.
- Do not generate build artifacts into source directories.
- Never delete files, reset changes, or run destructive git commands without
  explicit user confirmation.
