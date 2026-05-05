# 0001 First-Pass Repo Split

Date: 2026-05-05

Status: in progress

## Goal

Create a clean Renku Studio monorepo with the packages that can move now:

- `packages/core`
- `packages/cli`
- `packages/engines`
- `packages/studio`

The legacy providers package is intentionally not copied wholesale. Only the
pure AI engine layer is extracted.

## Current Outcome

- Root workspace commands target only the Studio packages.
- Package names use the new `@gorenku/studio-*` family.
- The Studio app no longer depends on old `@gorenku/core`,
  `@gorenku/providers`, or `@gorenku/compositions`.
- `@gorenku/studio-engines` owns provider-organized model catalogs,
  schema-first validation, simulation, and provider adapters.
- Accepted docs and plans have a clean home under `docs/` and `plans/`.

## Follow-Up

- Hydrate the new workspace with `pnpm install` when ready.
- Run `pnpm build`, `pnpm test`, and `pnpm lint` after dependencies are
  installed.
- Design the Studio app/server interface to engines around Studio asset tasks,
  not old Renku execution plans.
