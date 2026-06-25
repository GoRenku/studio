# Studio Browser E2E

Studio browser E2E tests use Playwright Test and follow ADR 0037.

## Commands

Install Playwright browser binaries before the first local run if they are not
already present:

```bash
pnpm --dir packages/studio exec playwright install chromium
```

```bash
pnpm --dir packages/studio test:e2e:smoke
pnpm --dir packages/studio test:e2e
pnpm --dir packages/studio test:e2e:headed
pnpm --dir packages/studio test:e2e:ui
```

The suite starts a real Studio dev server on the canonical Studio dev port and
uses a temporary E2E Renku home under `tmp/studio-e2e/`.

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
