# Studio Browser E2E

Studio browser E2E tests use Playwright Test and follow ADR 0037.

## Commands

Install Playwright browser binaries before the first local run if they are not
already present:

```bash
sfw pnpm --dir packages/studio test:e2e:install-browsers
```

```bash
pnpm --dir packages/studio test:e2e:smoke
pnpm --dir packages/studio test:e2e
pnpm --dir packages/studio test:e2e:headed
pnpm --dir packages/studio test:e2e:ui
```

The suite starts a real Studio browser-test server on the fixed E2E port
`5174` and uses a temporary E2E Renku home under `tmp/studio-e2e/`. This keeps
tests isolated from the normal Studio dev server on `5173`. Playwright owns the
E2E server process and shuts it down after the run. If `5174` is already in use,
the run fails instead of reusing an existing server.

Playwright results and HTML reports are written under the same run directory:

```text
tmp/studio-e2e/<run-id>/
  playwright-results/
  playwright-report/
```

## Fixtures

Fixtures create project data through `@gorenku/studio-core/server` commands and
services. They must not write SQLite rows directly or create route-local
shortcuts.

Passing tests clean their project folders. Failed local tests keep project
folders unless cleanup is explicitly forced. Set this to keep all project
folders for inspection:

```bash
RENKU_STUDIO_E2E_KEEP_ARTIFACTS=1 pnpm --dir packages/studio test:e2e:smoke
```

## AI Assistance

AI tools may draft scenario specs, propose locators, inspect traces, and explain
failures. Committed tests must remain deterministic Playwright code with
explicit assertions. The default E2E gate must not depend on a live LLM deciding
clicks, assertions, or pass/fail status.
