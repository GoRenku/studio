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

Engine e2e tests call real providers and can cost money. They stay behind
explicit environment flags, for example:

```bash
RUN_OPENAI_TEXT=1 pnpm --filter @gorenku/studio-engines test:e2e
```
