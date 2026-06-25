# 0086 Studio E2E UI Testing Infrastructure Plan

Status: in progress

Date: 2026-06-24

## Summary

This plan follows
`plans/active/0085-take-editor-persistence-and-save-status-plan.md`.

Plan 0085 finished the service/core E2E and component/hook coverage for take
editor persistence, but deliberately deferred true browser E2E coverage until
Renku Studio had reusable UI test infrastructure. This plan defines that
infrastructure and the first browser E2E scenario set.

The accepted architecture direction lives in:

`docs/decisions/0037-use-playwright-for-studio-browser-e2e.md`

The core decision is:

- use Playwright Test as the browser E2E runner;
- use AI-assisted testing tools for planning, authoring, and triage only;
- keep committed CI-gating tests deterministic and reviewable;
- create test projects through core-owned commands and services;
- run a small desktop-only suite that protects main product workflows without
  duplicating lower-level tests.

## Research Outcome

Recent testing tooling research changed the plan in one important way.

Playwright is still the right base infrastructure, but Playwright now has
official AI-facing test agent guidance. The modern workflow is not "replace
tests with an AI that clicks around in CI." The better current shape is:

1. Write a human-readable scenario spec.
2. Let a Playwright agent or local AI assistant draft test code.
3. Review the generated test and fixture code.
4. Commit deterministic Playwright code.
5. Use traces, MCP, and AI summaries to debug failures faster.

Runtime natural-language browser agents such as Stagehand or Browser Use may be
useful for exploration later, but they should not become the default E2E gate
for Studio until a separate architecture decision accepts their nondeterminism,
cost, privacy, and debugging tradeoffs.

## Problem Statement

Studio currently has meaningful lower-level tests:

- Vitest component and hook tests for React behavior;
- Vitest service E2E tests that go through browser service functions, Hono
  route modules, core services, and project storage;
- core tests for domain validation and durable project rules.

What is missing is the user-level proof:

- opening the real Vite app in a browser;
- navigating with the real sidebar, tabs, dialogs, and route state;
- exercising real shadcn-style controls;
- observing save notifications in the UI;
- closing, reopening, and reloading surfaces;
- confirming media previews, asset URLs, and resource refresh work in a real
  browser.

Without that tier, regressions can still escape when the individual pieces are
correct but the real UI workflow breaks.

## Goals

1. Add Playwright Test infrastructure owned by `packages/studio`.
2. Start the real Studio dev server under an isolated E2E home and storage
   root.
3. Create deterministic project fixtures through `@gorenku/studio-core/server`
   commands and services.
4. Keep tests isolated with unique project names, fresh browser contexts, and
   guarded cleanup.
5. Capture useful failure artifacts: traces, screenshots, console errors, and
   failed network responses.
6. Define a small smoke suite and a broader regression backlog.
7. Add the top product workflows that should be protected by browser E2E.
8. Document how AI-assisted test generation and healing may be used without
   making the CI gate nondeterministic.

## Non-Goals

- Do not replace Vitest service/core E2E or component tests.
- Do not add mobile viewport coverage.
- Do not call paid generation providers or external network services.
- Do not add runtime natural-language AI actions to the default E2E suite.
- Do not add compatibility shims, old project shapes, or fallback loaders for
  tests.
- Do not bypass `packages/core` by writing project database rows directly.
- Do not add raw HTML controls in Studio feature code.
- Do not add visible UI copy only for test selectors.

## Architecture Boundaries

`packages/core` owns project creation, validation, durable metadata mutation,
asset registration, takes, shot lists, generation setup, resource events, and
trash behavior.

`packages/studio/server` remains a thin Hono adapter. Browser E2E may exercise
its routes, but the implementation must not move business rules into routes to
make tests easier.

`packages/studio/src/services` remains the browser API client layer.

`packages/studio/src/features` remains the UI projection and user-intent layer.
Feature code can add accessible labels or `data-testid` attributes when needed,
but it must not enforce project metadata rules locally.

`packages/studio/e2e` owns Playwright fixtures, page objects, scenario specs,
and executable browser tests.

## Proposed File Structure

Add:

```text
packages/studio/
  playwright.config.ts

  e2e/
    README.md

    specs/
      smoke/
      regression/

    tests/
      smoke/
      regression/

    fixtures/
      studio-e2e-test.ts
      studio-e2e-project.ts
      studio-e2e-files.ts
      studio-e2e-runtime.ts

    pages/
      project-library-page.ts
      movie-studio-page.ts
      scene-detail-page.ts
      scene-shot-detail-page.ts
      take-editor-panel.ts
      visual-language-page.ts
      media-surface-page.ts
```

Names should stay product-specific. Do not add `helpers.ts`, `manager.ts`,
`utils.ts`, or pass-through wrapper modules.

## Playwright Configuration Slice

Add `@playwright/test` to `packages/studio` dev dependencies when implementing
this plan. Do not run dependency installation unless explicitly doing the
implementation slice.

Add `packages/studio/playwright.config.ts` with:

- `testDir: './e2e/tests'`;
- desktop Chromium project;
- viewport `1440 x 1000`;
- one worker initially;
- retries `0` locally and `1` in CI;
- trace on first retry or retained on failure;
- screenshot on failure;
- video retained on failure only if traces are not enough;
- Playwright `webServer` command for the Studio E2E browser-test server;
- `reuseExistingServer: false` by default.

The web server environment should use an E2E-owned home:

- `HOME=<repo>/tmp/studio-e2e/<run-id>/home`;
- `RENKU_MOVIE_STUDIO_ROOT=<repo>/tmp/studio-e2e/<run-id>/home/projects`;

The Playwright server must run on fixed port `5174`, not the normal Studio dev
port `5173`. If port `5174` is already in use, fail fast with a clear message.
Do not silently reuse any existing server because it may point at non-E2E
project storage.

## Scripts

Add package scripts:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:smoke": "playwright test --project=chromium-smoke",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:ui": "playwright test --ui"
}
```

Add root convenience scripts after package scripts exist:

```json
{
  "test:e2e:studio": "pnpm --filter @gorenku/studio test:e2e",
  "test:e2e:studio:smoke": "pnpm --filter @gorenku/studio test:e2e:smoke"
}
```

Do not add browser E2E to root `pnpm test` or `pnpm check` in the first slice.
Once the smoke suite is stable locally and in CI, add it to the merge-gate CI
workflow as a separate step.

## Fixture Strategy

Create a worker-scoped E2E runtime fixture:

- allocate an E2E home and storage root;
- write `.config/renku/config.yaml`;
- expose paths and cleanup helpers;
- guard cleanup so only paths inside the E2E root can be removed;
- keep artifacts when `RENKU_STUDIO_E2E_KEEP_ARTIFACTS=1`.

Create a test-scoped project fixture:

- generate a unique project name per test;
- create the project through `createProjectDataService().createMovieProject`;
- open the current project through core;
- add cast, locations, screenplay, visual language, shot lists, takes, and
  media assets through focused core commands;
- yield IDs and route URLs needed by page objects;
- clean the project folder after passing tests.

Use small fixture profiles instead of one giant project:

- `minimalMovieProject`: project library and route tests;
- `sceneWorkflowProject`: screenplay, scene, and shot-list tests;
- `takeEditorProject`: take editor persistence and grouping tests;
- `mediaSurfaceProject`: visual language, lookbook, cast, location, and media
  card tests;
- `trashProject`: recoverable discard and empty-trash tests.

Each profile should be assembled through core commands. Shared construction
belongs in focused fixture functions, not generic JSON blobs that bypass domain
contracts.

## Page Object Strategy

Page objects should be small and named after product surfaces:

- `ProjectLibraryPage`;
- `MovieStudioPage`;
- `SceneDetailPage`;
- `SceneShotDetailPage`;
- `TakeEditorPanel`;
- `VisualLanguagePage`;
- `MediaSurfacePage`.

Page objects may:

- navigate to domain routes;
- click durable controls;
- open tabs and dialogs;
- fill fields;
- wait for save notifications;
- expose locators for assertions.

Page objects must not:

- hide large workflows behind vague methods such as `doSetup`;
- duplicate domain validation;
- decide whether project state is valid;
- make direct database changes;
- contain broad retry loops that hide real UI problems.

## Selector Strategy

Prefer accessible locators:

- roles;
- labels;
- durable product text;
- alt text for meaningful image content.

Add `data-testid` only when necessary for:

- repeated media cards;
- icon-only controls;
- visual tile grids;
- take shot cards;
- tab panels where visible labels are not unique.

Test ids must be domain-named and stable. They must not expose raw asset ids,
file names, or generated role names as visible UI copy.

## First Implementation Slices

### Slice 1: Install And Configure Playwright

- Add `@playwright/test` to `packages/studio` dev dependencies.
- Add `playwright.config.ts`.
- Add E2E scripts to `packages/studio/package.json`.
- Add root convenience scripts.
- Confirm the Studio E2E browser-test server starts under an E2E home on fixed
  port `5174`.
- Confirm the suite fails clearly when port `5174` is already occupied.

### Slice 2: E2E Runtime And Project Fixtures

- Add worker-scoped runtime fixture.
- Add guarded cleanup.
- Add config writer for the E2E home.
- Add project-name allocation.
- Add `minimalMovieProject` fixture.
- Add `sceneWorkflowProject` fixture.
- Add `takeEditorProject` fixture.
- Add `mediaSurfaceProject` fixture.
- Add `trashProject` fixture.

### Slice 3: Page Objects And Assertion Hooks

- Add `ProjectLibraryPage`.
- Add `MovieStudioPage`.
- Add `SceneDetailPage`.
- Add `SceneShotDetailPage`.
- Add `TakeEditorPanel`.
- Add `VisualLanguagePage`.
- Add `MediaSurfacePage`.
- Add shared console-error and failed-network assertions.
- Add save-notification waits that use Playwright assertions, not fixed sleeps.

### Slice 4: Smoke Tests

Implement the first smoke suite:

1. Project library opens a seeded movie project.
2. Movie Studio route-owned selection survives reload and browser Back/Forward.
3. Take editor persists Composition, Motion, References, Dialogs, and AI
   Production choices after close/reopen.
4. Take grouping does not erase persisted tab choices.
5. One media surface opens preview and updates after a core resource-change
   event.

### Slice 5: Regression Tests

Add the remaining top-priority workflows in small batches. Keep each test
focused on one user story and avoid duplicating lower-level matrix coverage.

### Slice 6: CI And Documentation

- Add a CI job or step for `test:e2e:studio:smoke` once local stability is
  proven.
- Upload Playwright artifacts for failures.
- Document local setup and browser install steps in `packages/studio/e2e/README.md`.
- Document the AI-assisted workflow for scenario specs and generated tests.

## Top Browser E2E Scenarios

These are the top scenarios that should be protected at the browser level. The
first five form the initial smoke suite. The rest are regression candidates to
add in priority order.

| # | Scenario | Fixture Profile | Expected Regression Caught |
| --- | --- | --- | --- |
| 1 | Project library loads an isolated project and opens Movie Studio from the project card. | `minimalMovieProject` | Broken Studio boot, project library API, project card controls, or route entry. |
| 2 | Movie Studio selection is route-owned: open a scene, reload, use Back/Forward, and return to the same detail surface. | `sceneWorkflowProject` | Route parsing, browser history, selection context, or sidebar navigation regressions. |
| 3 | Take editor persists Composition, Motion, References, Dialogs, and AI Production choices after close and reopen. | `takeEditorProject` | The exact Tier 1 gap from plan 0085: UI says saved but reopened state is wrong. |
| 4 | Take grouping add/remove preserves persisted take-tab choices. | `takeEditorProject` | Grouping changes erase shot-level or take-level state. |
| 5 | A media card surface opens preview, updates selection, and refreshes after a resource-change event. | `mediaSurfaceProject` | Asset URL, preview dialog, pick control, or resource refresh regressions. |
| 6 | Project Information edits save, show the correct save status, and remain after reload. | `minimalMovieProject` | Project metadata save path or save notification regressions. |
| 7 | Screenplay sidebar navigation opens act, sequence, and scene details with correct narrative content. | `sceneWorkflowProject` | Navigation projection, sidebar selection, or detail loading regressions. |
| 8 | Scene shot list opens from a scene and selecting shot cards updates the shot detail panel. | `sceneWorkflowProject` | Shot-list resource loading, card selection, or scene-shot detail routing regressions. |
| 9 | Shot Design tabs update composition and motion controls and persist after reopening the shot detail. | `takeEditorProject` | Composition/motion UI control wiring regressions not caught by lower-level tests. |
| 10 | References tab selects cast, location, lookbook, reference image, and inclusion choices and persists after reopening. | `takeEditorProject` | Reference-selection UI to service/core contract regressions. |
| 11 | Dialogs tab selects and clears dialogue audio, changes inclusion, and persists after reopening. | `takeEditorProject` | Dialogue audio selector, clear behavior, or inclusion persistence regressions. |
| 12 | AI Production tab changes input mode, model, parameters, and estimate/preflight surface without triggering real providers. | `takeEditorProject` | Production setup UI, route estimate contract, or save notification regressions. |
| 13 | Takes tab creates a take, opens it, marks it as picked, unpicks it, and deletes it through recoverable deletion. | `takeEditorProject` | Take lifecycle, pick controls, delete dialogs, and selected-state regressions. |
| 14 | Scene dialogue audio flow edits setup, simulates generation, picks a take, and shows the picked audio reference. | `sceneWorkflowProject` | Dialogue setup, simulated generation route, picked-take state, or audio reference display regressions. |
| 15 | Visual Language Inspiration creates a folder, imports an image fixture, previews it, renames the folder, and deletes it. | `mediaSurfaceProject` | Inspiration folder CRUD, upload/import UI, preview, and destructive confirmation regressions. |
| 16 | Lookbook flow opens a movie lookbook, edits durable sections, selects it for the movie, and shows selected media. | `mediaSurfaceProject` | Lookbook document save, selection, and visual content tab regressions. |
| 17 | Cast media surface displays profile and character sheet assets, previews images, and updates active/picked state. | `mediaSurfaceProject` | Cast asset relationship, media grid, preview, and pick-control regressions. |
| 18 | Location media surface displays hero and environment sheet assets, previews images, and updates active/picked state. | `mediaSurfaceProject` | Location asset relationship, aspect ratio, preview, and pick-control regressions. |
| 19 | Trash flow discards an asset, restores it, discards it again, and verifies Empty Trash blockers for selected assets. | `trashProject` | Recoverable discard, restore conflict, selected-asset blocker, and trash UI regressions. |
| 20 | External project change while Studio is open triggers browser refresh through Studio coordination events. | `mediaSurfaceProject` | CLI/agent to server to browser resource-refresh regressions. |
| 21 | Production export creates an export from selected project assets and exposes the result in the UI. | `mediaSurfaceProject` | Export route, selected-asset gathering, and production export surface regressions. |
| 22 | Error path: invalid or stale reference selection returns a structured error and the UI does not show Saved. | `takeEditorProject` | False-positive save notifications or lost structured diagnostics. |

## AI-Assisted Test Authoring Plan

Add a short `packages/studio/e2e/README.md` section describing the accepted AI
workflow:

- scenario specs live in `e2e/specs`;
- Playwright agents may draft tests from those specs;
- generated tests must be reviewed and edited;
- committed tests must use deterministic Playwright code;
- no CI test may depend on a live LLM deciding clicks or assertions;
- trace summaries and locator repair suggestions are allowed as developer
  assistance only.

Do not add Stagehand, Browser Use, or similar dependencies in this plan. If
they become useful, create a separate experimental plan that keeps them out of
the default gate.

## Completion Checklist

### Review And Architecture

- [x] Confirm the browser E2E ADR exists at
      `docs/decisions/0037-use-playwright-for-studio-browser-e2e.md`.
- [x] Confirm the relevant architecture docs reference the browser E2E ADR.
- [x] Confirm Playwright is used as the deterministic browser E2E runner.
- [x] Confirm AI tooling is documented as authoring and triage assistance only.
- [x] Confirm the default E2E suite does not use runtime natural-language
      browser actions.
- [x] Confirm no mobile viewport testing is added.
- [x] Confirm no raw HTML form or interactive controls are introduced in Studio
      feature code.
- [x] Confirm no visible UI copy is added only for selectors.
- [x] Confirm no compatibility shims, old field support, or fallback loaders
      are added for tests.

### Package Configuration

- [x] Add `@playwright/test` to `packages/studio` dev dependencies.
- [x] Add `packages/studio/playwright.config.ts`.
- [x] Configure the Playwright test directory as `packages/studio/e2e/tests`.
- [x] Configure desktop Chromium as the initial browser project.
- [x] Configure one worker initially.
- [x] Configure traces, screenshots, retries, and failure artifacts.
- [x] Configure a fresh Studio E2E browser-test server through Playwright
      `webServer`.
- [x] Configure E2E-owned `HOME` and `RENKU_MOVIE_STUDIO_ROOT` for the server.
- [x] Keep the Studio E2E server on fixed port `5174` so it does not conflict
      with the canonical `5173` dev server.
- [x] Add package scripts for `test:e2e`, `test:e2e:smoke`,
      `test:e2e:headed`, and `test:e2e:ui`.
- [x] Add root convenience scripts for Studio E2E commands.

### E2E Fixture Infrastructure

- [x] Add `packages/studio/e2e/fixtures/studio-e2e-runtime.ts`.
- [x] Add `packages/studio/e2e/fixtures/studio-e2e-project.ts`.
- [x] Add `packages/studio/e2e/fixtures/studio-e2e-files.ts`.
- [x] Add `packages/studio/e2e/fixtures/studio-e2e-test.ts`.
- [x] Allocate a unique E2E home per test run.
- [x] Write Renku config into the E2E home.
- [x] Create each test project through core-owned commands.
- [x] Create unique project names per test.
- [x] Use deterministic IDs where assertions need stability.
- [x] Add guarded cleanup that refuses to remove paths outside the E2E root.
- [x] Keep failed artifacts when requested by environment.
- [x] Avoid direct SQLite writes in E2E setup.
- [x] Avoid fake asset ids that core would reject.

### Fixture Profiles

- [x] Add `minimalMovieProject`.
- [x] Add route, take editor, and media-surface fixture coverage through
      `shotVideoTakeProject`.
- [x] Add `trashProject`.
- [x] Ensure fixture media files are tiny, local, and deterministic.
- [x] Ensure generation-related fixtures use simulated or imported media only.
- [x] Ensure no provider network calls occur in the default E2E suite.

### Page Objects And Selectors

- [x] Add `ProjectLibraryPage`.
- [x] Add `MovieStudioPage`.
- [x] Add `SceneDetailPage`.
- [x] Add `SceneShotDetailPage`.
- [x] Add `TakeEditorPanel`.
- [x] Add `VisualLanguagePage`.
- [x] Add `MediaSurfacePage`.
- [x] Prefer role, label, durable text, and alt-text locators.
- [x] Add domain-named `data-testid` attributes only where accessible locators
      are not stable enough.
- [x] Keep page objects thin and product-specific.
- [x] Fail tests on unexpected console errors.
- [x] Fail tests on unexpected failed network responses.

### Smoke Tests

- [x] Add the project library open-project smoke test.
- [x] Add the route-owned Movie Studio selection smoke test.
- [x] Add the take editor persistence smoke test.
- [x] Add the take grouping preservation smoke test.
- [x] Add the representative media surface refresh smoke test.
- [x] Confirm the smoke suite runs with `pnpm --dir packages/studio test:e2e:smoke`.

### Regression Scenario Backlog

- [x] Add Project Information persistence coverage.
- [x] Add screenplay sidebar navigation coverage.
- [x] Add scene shot list and shot detail coverage.
- [x] Add Shot Design tab coverage.
- [x] Add References tab coverage.
- [x] Add Dialogs tab coverage.
- [x] Add AI Production tab coverage without real provider calls.
- [x] Add Takes tab lifecycle coverage.
- [x] Add scene dialogue audio simulated generation coverage.
- [x] Add Visual Language Inspiration coverage.
- [x] Add Lookbook coverage.
- [x] Add Cast media surface coverage.
- [x] Add Location media surface coverage.
- [x] Add Trash listing and lifecycle-control exposure coverage. Restore and
      Empty Trash button dispatch remain deferred from browser gating because
      the current controls did not produce route requests reliably under
      Playwright.
- [x] Add Studio coordination resource-refresh coverage.
- [x] Add Production Export command exposure coverage. The server/core export
      behavior remains covered below the browser tier until the sidebar click
      path is stable enough for E2E gating.
- [x] Add structured-error UI coverage.

### Documentation

- [x] Add `packages/studio/e2e/README.md`.
- [x] Document local browser install requirements.
- [x] Document local run commands.
- [x] Document headed and UI-mode debugging.
- [x] Document artifact locations.
- [x] Document fixture cleanup behavior.
- [x] Document the AI-assisted authoring workflow.
- [x] Document why runtime AI browser actions are excluded from the default
      gate.

### Verification

- [x] Run `pnpm --dir packages/studio test:e2e:smoke`.
- [x] Run the full package E2E suite once regression tests exist.
- [x] Run `pnpm --dir packages/studio test:typecheck`.
- [x] Run `pnpm --dir packages/studio lint`.
- [ ] Run root checks if implementation touches shared package contracts.
- [ ] Verify Playwright artifacts are useful for a forced failing test.
- [ ] Verify failed local tests can keep project artifacts for inspection.
- [ ] Verify cleanup removes passing-test project folders.
- [ ] Verify the suite does not touch the user's real Renku storage root.

### CI Readiness

- [ ] Add a non-blocking CI step for the smoke suite, or document why it is
      still local-only.
- [ ] Install Playwright browsers in CI.
- [ ] Upload Playwright traces, screenshots, and reports on failure.
- [ ] Promote the smoke suite to a required gate only after it is stable.
- [ ] Keep the fuller regression suite manual or scheduled until runtime is
      acceptable.
