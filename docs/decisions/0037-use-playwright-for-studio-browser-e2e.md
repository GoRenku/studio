# 0037 Use Playwright For Studio Browser E2E

Date: 2026-06-25

Status: accepted

## Context

Plan `0085-take-editor-persistence-and-save-status-plan.md` completed the
service/core E2E and component/hook coverage for take editor persistence, but
it deliberately deferred true browser E2E coverage until Renku Studio had
reusable UI test infrastructure.

Studio now needs a small browser test suite that proves the most important
product workflows still work from the user's point of view:

- opening the real Vite app in a browser;
- navigating with real sidebar, tab, dialog, and route behavior;
- exercising local shadcn-style controls;
- observing save notifications;
- closing, reopening, and reloading surfaces;
- confirming persisted choices remain visible after the UI workflow completes;
- confirming fixture files, asset URLs, local Hono routes, Vite, React, and
  browser behavior agree.

Research checked on 2026-06-24 showed that Playwright remains the strongest
base infrastructure for this work. The relevant current shift is AI-assisted
test authoring and debugging, not replacing deterministic tests with a live AI
agent in CI.

Relevant sources:

- Playwright Test documentation for
  [web servers](https://playwright.dev/docs/test-webserver),
  [fixtures](https://playwright.dev/docs/test-fixtures), and
  [trace viewer](https://playwright.dev/docs/trace-viewer-intro).
- Playwright
  [test agents](https://playwright.dev/docs/test-agents), which support
  AI-assisted planning, generation, and repair of Playwright tests.
- Playwright
  [MCP](https://playwright.dev/mcp/introduction), which lets AI agents inspect
  and operate browsers through structured accessibility snapshots.
- Browserbase [Stagehand](https://docs.stagehand.dev/) and Browser Use's
  [GitHub project](https://github.com/browser-use/browser-use), which represent
  a broader class of runtime natural-language browser agents.
- BrowserStack [Percy](https://www.browserstack.com/percy), which represents
  visual regression and AI-assisted visual review tooling.

The strongest current pattern is:

- use AI to draft scenario specs, draft locators, inspect running apps, explain
  traces, and propose repairs;
- keep committed CI-gating tests deterministic, source-controlled Playwright
  code with explicit locators and explicit assertions;
- avoid live model judgment in the default pass/fail gate.

Runtime natural-language browser agents can be useful for exploration, but they
introduce model availability, cost, latency, repeatability, privacy, and
debugging risks. They are not appropriate for Renku Studio's default E2E gate.

## Decision

Renku Studio uses Playwright Test as the browser E2E infrastructure for
`packages/studio`.

Browser E2E tests are owned by `packages/studio` because that package owns the
browser application, Vite integration, local Studio routes, and frontend
workflow behavior.

Use this package structure:

```text
packages/studio/
  playwright.config.ts

  e2e/
    README.md
    specs/
    tests/
    fixtures/
    pages/
```

Use Playwright as the deterministic runner, browser controller, local server
orchestrator, and failure-artifact recorder. The default suite must use
reviewable Playwright code with explicit assertions.

Use AI-assisted tooling only for authoring, exploration, and triage:

- Playwright test agents may help draft tests from scenario specs;
- Playwright MCP or similar tools may inspect a local app and help debug
  failures;
- generated tests must be reviewed and committed as normal deterministic test
  code;
- no CI-gating test may depend on a live LLM deciding clicks, assertions, or
  pass/fail status.

Stagehand, Browser Use, and similar natural-language browser agents are
reserved for future experimental or exploratory suites. They must not run in
the default E2E gate unless a later ADR accepts their tradeoffs.

Visual AI services such as Percy may be evaluated later for visual regression
coverage. They are not required for the first browser E2E infrastructure.

## Test Scope

Browser E2E is one tier in a larger testing strategy:

| Tier | Tooling | Purpose |
| --- | --- | --- |
| Unit and component | Vitest, Testing Library | Validate pure logic, components, hooks, projections, and UI control behavior. |
| Service/core E2E | Vitest with real core/server paths | Validate browser service request shapes through Hono/core/project storage without launching a browser. |
| Browser E2E | Playwright Test | Validate full user workflows in Chromium against a real Studio dev server and real project storage. |
| Exploratory AI assist | Playwright agents, Playwright MCP, optional future tools | Draft, inspect, repair, and triage tests under human review. |

Browser E2E must stay small and intentional. It protects product-critical user
workflows. It must not duplicate every lower-level matrix test.

The first suite should use desktop Chromium only. Renku Studio is
desktop-first, so mobile viewport coverage is out of scope unless explicitly
requested.

## Fixture And Isolation Rules

E2E project data must be created through core-owned commands and services.

Allowed setup paths include:

- `createProjectDataService()`;
- `createMovieProject`;
- `openCurrentProject`;
- focused core commands for cast, locations, screenplay, shot lists, takes,
  visual language, lookbooks, assets, dialogue audio, and trash;
- media import commands that register assets through core-owned validation.

Forbidden setup paths include:

- direct SQLite writes from Playwright fixtures;
- filesystem-only project mutation that bypasses core;
- Studio route-local business rules;
- React-local shortcuts;
- compatibility loaders or old-shape repair paths created only for tests;
- fake asset ids that core would reject in real use.

Each test should use:

- a fresh Playwright browser context;
- a unique project name;
- project data stored under a test-owned E2E home directory;
- a Renku config written into that E2E home;
- guarded cleanup that refuses to remove paths outside the E2E root.

Passing tests should clean their project folders. Failed local tests should be
able to keep project folders and Playwright artifacts for inspection.

The Studio dev server must run with E2E-owned environment:

- `HOME`: the E2E temporary home directory used by core config resolution;
- `RENKU_MOVIE_STUDIO_ROOT`: the E2E storage root so Vite allows project files
  to be served.

The initial suite should run one worker until current-project and Studio
coordination behavior are proven safe under parallel browser E2E.

## Selector And Assertion Rules

Prefer user-observable selectors:

- `getByRole`;
- `getByLabel`;
- durable product text;
- meaningful image alt text.

Use `data-testid` sparingly for repeated visual cards, icon-only controls,
visual tile grids, take shot cards, and similar surfaces where accessible
selectors are not stable enough.

Test ids must be domain-named. Do not add visible UI copy only to make tests
easier. Do not surface raw asset ids, filenames, generated role names, or
kebab-case identifiers as product copy for test convenience.

Tests should rely on Playwright's web-first assertions and state polling rather
than fixed sleeps.

Each test should fail on unexpected browser console errors and unexpected
failed network responses. Expected errors must be scoped to the action that
intentionally triggers them.

## Consequences

- `packages/studio` gains a Playwright configuration and `e2e/` test tree.
- Browser E2E runs separately from `pnpm test` and `pnpm check` until the smoke
  suite is stable.
- The smoke suite can become a CI merge gate after local and CI stability is
  proven.
- The fuller regression suite can remain manual or scheduled until runtime is
  acceptable.
- New E2E tests must create data through core-owned APIs rather than bypassing
  architecture boundaries.
- AI can accelerate test authoring and debugging, but it does not become the
  default test oracle.

## Related Decisions

- `0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `0017-use-scalable-studio-resource-loading.md`
- `0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `0027-use-details-header-for-save-notifications.md`
- `0030-use-unified-studio-resource-refresh-components.md`
- `0031-use-studio-server-owned-coordination-delivery.md`

