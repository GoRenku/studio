# 0001 First-Pass Repo Split

Date: 2026-05-05

Status: in progress

## Goal

Create a clean Renku Studio monorepo with the packages that can move now:

- `packages/core`
- `packages/cli`
- `packages/studio`

The legacy providers package is intentionally excluded from this first pass.

## Current Outcome

- Root workspace commands target only the three Studio packages.
- Package names use the new `@gorenku/studio-*` family.
- The Studio app no longer depends on old `@gorenku/core`,
  `@gorenku/providers`, or `@gorenku/compositions`.
- Accepted docs and plans have a clean home under `docs/` and `plans/`.

## Follow-Up

- Hydrate the new workspace with `pnpm install` when ready.
- Run `pnpm build`, `pnpm test`, and `pnpm lint` after dependencies are
  installed.
- Migrate providers into a future `packages/engines` package after removing or
  isolating its old core and compositions dependencies.
