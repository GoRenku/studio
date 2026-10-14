# Local Development

Run dependency installation only when intentionally hydrating this workspace:

```bash
pnpm install
```

After dependencies are installed, the main verification commands are:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Focused package commands are available from the repository root:

```bash
pnpm build:core
pnpm test:engines
pnpm test:cli
pnpm dev:studio
```

Studio reads the normal Core-owned config. On this macOS development machine,
that remains `$HOME/.config/renku/config.yaml`; existing configured Project
Libraries are not moved or rewritten. Use `renku init <storage-root>` in an
isolated test home when testing a custom location, or use the first-run browser
flow when testing missing configuration.

Provider e2e tests call real providers and can cost money. They live in the CLI
package, stay behind explicit run flags, and use the provider keys saved in
Renku Settings, for example:

```bash
RUN_FAL_TEST=1 pnpm --filter @gorenku/studio-cli test:e2e -- fal
```

The tests read keys through the same CLI lookup that `renku generation` uses.
If an opted-in test has no saved key, it fails with the CLI's missing-credential
error rather than silently skipping. See `packages/cli/tests/e2e/README.md` for
the provider flags, selected models, and paid-test guidance.
