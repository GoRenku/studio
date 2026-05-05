# Renku Studio

Renku Studio is the long-form creative workspace for planning and producing
professional AI-assisted movies, documentaries, series, and channel-scale video
projects.

This repository is intentionally separate from the existing Renku packages. It
starts with a focused monorepo:

- `packages/core` -> `@gorenku/studio-core`
- `packages/cli` -> `@gorenku/studio-cli`
- `packages/studio` -> `@gorenku/studio`

The AI engine integration package will be added in a later pass as
`@gorenku/studio-engines` once its dependency on the existing Renku core package
has been untangled.

## Common Commands

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Focused package commands are also available:

```bash
pnpm build:core
pnpm test:cli
pnpm dev:studio
```

## Documentation

- `docs/` contains accepted project knowledge.
- `plans/active/` contains current implementation plans.
- `plans/exploration/` contains drafts, examples, and exploratory thinking.
- `docs/decisions/` records durable product and architecture decisions.
