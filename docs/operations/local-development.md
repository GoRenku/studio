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
pnpm test:cli
pnpm dev:studio
```

The Studio app uses `RENKU_STUDIO_STORAGE_ROOT` when set. Otherwise it uses the
default local project folder:

```text
~/renku-studio-projects
```
