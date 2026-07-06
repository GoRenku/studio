# 0119 Root Test Runtime Speedup Plan

Status: verified
Date: 2026-07-06

## Summary

This plan replaces the discarded draft
`plans/active/0119-test-runtime-speedup-without-moving-tests.md`.

The previous draft was wrong for the current direction because it kept a hard
"no test moves" rule. The user has now explicitly asked for three Engines tests
to be disabled and for Studio e2e/integration-shaped tests to be identified for
removal from default `pnpm test`.

The root `pnpm test` command still runs these packages in sequence:

```text
@gorenku/studio-diagnostics
@gorenku/studio-core
@gorenku/studio-cli
@gorenku/studio-engines
@gorenku/studio
```

The attached after-log shows the remaining problem:

| Package | Current default runtime | Important detail |
| --- | ---: | --- |
| Diagnostics | `217ms` | Already tiny. Guard against regressions only. |
| Core | `92.82s` | Still the largest contributor. Collection is `45.78s`; test execution is `37.36s`. |
| CLI | `3.61s` | Small, but some source tests start local servers or hit Core setup. |
| Engines | `5.74s` | Three legacy/imported tests are explicitly out of current product scope. |
| Studio | `65.27s` | Second largest contributor. `app.test.tsx` alone is `7377ms`. |

Plan `0118` made a real Core improvement, but it did not finish the job. This
plan addresses the remaining default-suite time directly:

- disable the three user-named Engines legacy tests;
- add Core shot-video-take state templates for the remaining slow Core files;
- move Studio app-level and workflow-level integration tests into the existing
  Studio integration bucket;
- optimize Studio hook/component tests that should remain in the fast suite;
- keep Diagnostics and CLI in scope as regression guards and smaller follow-up
  opportunities.

## Investigation Completed Before This Plan

The following investigation was performed before writing this plan.

- Checked the default and integration Vitest configs for Studio, Core, Engines,
  and CLI.
- Confirmed Studio already has a partitioning mechanism:
  - default `packages/studio/vitest.config.ts` includes
    `server/**/*.test.ts`, `src/**/*.test.ts`, and `src/**/*.test.tsx`;
  - default Studio tests exclude `src/**/*.e2e.test.ts` and
    `src/**/*.e2e.test.tsx`;
  - `packages/studio/vitest.integration.config.ts` includes
    `src/**/*.e2e.test.ts` and `src/**/*.e2e.test.tsx`.
- Confirmed `scripts/check-test-execution-partitions.mjs` already expects the
  Studio `.e2e.test.ts(x)` partition contract.
- Inspected `packages/core/src/server/testing/shot-video-take-fixtures.ts`.
- Inspected the slow Core shot-video-take tests and counted repeated setup
  calls.
- Inspected the slow Studio `App`, hook, and scene tab tests.
- Inspected `packages/studio/src/hooks/use-debounced-autosave.ts` and confirmed
  the hook tests are paying real debounce timers.
- Inspected `packages/studio/src/app/use-studio-coordination.ts` and confirmed
  `App` tests are exercising polling, browser session activity, focus request
  validation, browser history, and full app routing.
- Inspected the three user-named Engines files enough to confirm they are
  source-local default tests today.

## Goals

- Bring root `pnpm test` runtime down meaningfully, not cosmetically.
- Keep the default suite focused on fast unit and focused component tests.
- Move Studio app-flow and workflow-style tests into the already-defined
  Studio integration command.
- Disable the user-named Engines legacy tests from default execution.
- Preserve meaningful coverage for current Studio behavior.
- Keep Core fixture construction inside Core-owned commands and services.
- Keep every test that mutates a project isolated to its own copied home/project
  folder.
- Produce before/after timing numbers that compare the same package commands
  clearly.

## Non-Goals

- Do not weaken Core domain assertions to make tests faster.
- Do not insert test rows directly into Core project databases as the normal
  fixture path.
- Do not add broad compatibility layers, aliases, or fallback test paths.
- Do not move business rules into Studio, CLI, or test helpers.
- Do not change production project creation or Drizzle migration behavior.
- Do not optimize for mobile, browser Playwright, or visual QA in this slice.
- Do not keep the discarded "no test moves" constraint.

## Current Test Partition Contract

### Root Default Test

`pnpm test` currently runs:

```text
pnpm --filter @gorenku/studio-diagnostics test
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-cli test
pnpm --filter @gorenku/studio-engines test
pnpm --filter @gorenku/studio test
```

### Root Integration Test

`pnpm test:integration` currently runs:

```text
pnpm --filter @gorenku/studio-core test:integration
pnpm --filter @gorenku/studio-cli test:integration
pnpm --filter @gorenku/studio-engines test:integration
pnpm --filter @gorenku/studio test:integration
```

### Studio Integration Mechanism

Studio already uses source-local `.e2e.test.ts(x)` files for integration-style
Vitest tests:

```text
packages/studio/vitest.config.ts excludes src/**/*.e2e.test.ts(x)
packages/studio/vitest.integration.config.ts includes src/**/*.e2e.test.ts(x)
```

The implementation should use this existing mechanism for Studio instead of
inventing a second test naming scheme.

## Engines Findings And Plan

The user explicitly identified these Engines tests as irrelevant legacy/imported
coverage that should be disabled:

```text
packages/engines/src/sdk/unified/ffmpeg-image-splitter.test.ts
packages/engines/src/sdk/replicate/retry.test.ts
packages/engines/src/model-catalog.test.ts
```

Current after-log timings:

| File | Current timing | Investigation note |
| --- | ---: | --- |
| `src/sdk/unified/ffmpeg-image-splitter.test.ts` | `1652ms` | Exercises grid parsing, panel extraction, and fixture image splitting. The live fixture section reads `grid-image-fixture.jpeg`. User has identified this imported splitter coverage as out of current scope. |
| `src/sdk/replicate/retry.test.ts` | `1013ms` | Exercises retry behavior with fake timers. There is also an Engines integration retry file under `packages/engines/tests/integration/replicate-retry.test.ts`. User has identified this source-local test as out of current scope. |
| `src/model-catalog.test.ts` | `935ms` | Repeatedly loads the catalog from `tests/test-catalog-paths.ts` across many cases. User has identified this imported catalog test as out of current scope. |

Implementation decision:

- Disable these exact files from the default Engines Vitest config by adding
  explicit `exclude` entries in `packages/engines/vitest.config.ts`.
- Do not rename them into production `src/**/*.ts` files because that would risk
  pulling Vitest imports into normal TypeScript build inputs.
- Do not create a replacement compatibility suite for them in this slice.
- Keep current product-relevant Engines tests running:
  - pricing;
  - schema validation;
  - model input descriptors;
  - runner behavior;
  - provider response contracts that are still product-relevant.

Expected impact:

- Remove roughly `3.6s` of summed Engines test-file work.
- Because Engines runs files in parallel, package wall-clock gain will be less
  than the summed file timings, but default output and execution work should
  shrink visibly.

## Core Findings And Plan

Core remains the largest default-suite contributor:

```text
packages/core total: 92.82s
collect: 45.78s
tests: 37.36s
```

Plan `0118` already made blank/sample movie project creation template-backed.
The remaining slow Core tests now spend time building repeated purpose-specific
state on top of those copied projects.

### Shared Cause

`packages/core/src/server/testing/shot-video-take-fixtures.ts` still does this
for nearly every test in the slow shot-video-take files:

1. create an isolated temp home;
2. copy/open the sample movie project;
3. call `sampleIds()`, which reads the screenplay;
4. call `writeShotList(ids, shotCount)`;
5. call `createSceneShotVideoTake`;
6. often add lookbooks, media imports, reference selections, production plans,
   or final-take media.

This means the suite no longer pays the full migration floor every time, but it
still repeatedly constructs the same take states through Core commands.

### Slow Core Files From The After-Log

| File | Current timing | Repeated setup found | Plan |
| --- | ---: | --- | --- |
| `src/server/media-generation/purposes/shot-video-take/authoring/authoring.test.ts` | `3781ms` | 7 top-level tests; 14 matches for `sampleIds()` / `writeShotList()` style setup. | Add named shot-video-take templates for one-shot, two-shot, three-shot, and finalized-take authoring contexts. |
| `src/server/media-generation/purposes/shot-video-take/planning/reference-sections.test.ts` | `2493ms` | 15 top-level tests; 36 repeated setup matches including lookbooks and imported reference media. | Add named templates for active lookbook, imported first-frame inventory, cast/location sheet inventory, and multi-shot reference selection states. |
| `src/server/media-generation/purposes/shot-video-take/planning/preflight-report.test.ts` | `1450ms` | 5 top-level tests; 12 setup matches including first-frame and cast sheet imports. | Reuse one-shot take templates plus small imported-media template variants. |
| `src/server/media-generation/purposes/shot-video-take/planning/production-plan.test.ts` | `1337ms` | 7 top-level tests; 18 setup matches including active lookbook and dependency proposals. | Reuse active-lookbook and one-shot/two-shot take templates. |
| `src/server/media-generation/purposes/shot-video-take/selection/mutations/reference-selections.test.ts` | `1202ms` | 13 top-level tests; 33 setup matches including cast, location, lookbook, and final video imports. | Add reference-selection templates that create the valid owner state once, then copy it per test. |
| `src/server/studio-coordination/service.test.ts` | `1565ms` | 14 top-level tests; 4 calls to `createSampleMovieProject()`. | Keep as default for now, but convert repeated sample-backed coordination setup to templates where possible. |
| `src/server/media-generation/purposes/scene-dialogue-audio.test.ts` | `1496ms` | 2 tests; custom blank project setup with cast, screenplay, and attached voice repeated in `beforeEach`. | Add a dialogue-audio fixture template for the seeded cast, screenplay, and voice-ready base project. |

### Core Implementation Approach

Add purpose-specific templates under Core testing ownership, likely:

```text
packages/core/src/server/testing/shot-video-take-template-fixtures.ts
packages/core/src/server/testing/dialogue-audio-template-fixtures.ts
```

These templates must:

- build their source project through Core commands and services;
- build once per Vitest process;
- copy the prepared project folder and SQLite database into a fresh home for
  each test;
- open the copied project through `ProjectDataService`;
- return stable domain identifiers needed by tests;
- never share a mutable database between tests;
- never write project database rows directly for normal fixture state.

Template states should be named by domain state, not generic fixture labels:

- `oneShotVideoTakeProject`;
- `twoShotVideoTakeProject`;
- `threeShotVideoTakeProject`;
- `activeLookbookShotVideoTakeProject`;
- `importedFirstFrameShotVideoTakeProject`;
- `selectedReferenceShotVideoTakeProject`;
- `finalizedShotVideoTakeProject`;
- `dialogueAudioReadyProject`.

The existing `createShotVideoTakeTestProject()` helper can stay as the public
test helper, but it should route common setup through these templates instead of
recreating the same shot list/take/lookbook/media state in every test.

### Core Collection Time Follow-Up

Core collection time is still very high:

```text
collect: 45.78s
```

The first implementation pass should focus on test execution because the slow
files above have obvious repeated setup. After that, measure again. If Core is
still dominated by collection/import time:

- profile which test files import the largest server graphs;
- keep command entrypoints thin, but avoid importing heavy runtime modules in
  tests that only need small pure functions;
- do not add architecture tests that freeze private helper names;
- do not introduce lazy imports solely as an architecture workaround.

## Studio Findings And Plan

Studio is the second largest default-suite contributor:

```text
packages/studio total: 65.27s
collect: 24.47s
tests: 20.93s
environment: 12.04s
```

### Move Out Of Default `pnpm test`

These tests are integration/e2e-shaped and should move to Studio's existing
`.e2e.test.tsx` integration bucket.

#### `packages/studio/src/app/app.test.tsx`

Current after-log:

```text
src/app/app.test.tsx (34 tests) 7377ms
```

Local inspection found 23 top-level `it(...)` declarations, with parameterized
cases accounting for the larger reported test count.

Why this is integration/e2e-shaped:

- renders the full `<App />` inside `<ThemeProvider>`;
- uses real `window.history` route changes;
- mocks the full `/studio-api/projects` and `/studio-api/studio/events*` API
  surface;
- exercises project route loading, sidebar navigation, production export,
  route rejection, browser history, Studio coordination polling, focus request
  validation, focus-change reporting, and startup pending focus requests;
- includes slow polling/focus cases with `{ timeout: 2_500 }`;
- depends on `useStudioCoordination`, which uses `setInterval` with a
  `2_000ms` polling interval and `60_000ms` heartbeat.

Move decision:

- Rename the file to:

```text
packages/studio/src/app/app.e2e.test.tsx
```

- Keep it under the Studio integration command:

```text
pnpm --filter @gorenku/studio test:integration
```

- Do not weaken the test assertions while moving it.
- After moving it, add fast unit coverage only for any pure route or focus
  projection helpers that are left untested by source-local unit tests.

Expected default-suite impact:

- Remove about `7.4s` from Studio default test execution.
- Also reduce default jsdom environment churn and async polling work.

#### `packages/studio/src/features/movie-studio/scenes/scene-takes-tab.test.tsx`

Current after-log:

```text
src/features/movie-studio/scenes/scene-takes-tab.test.tsx (15 tests) 1742ms
```

Why part of this file is integration-shaped:

- renders the full `SceneTakesTab` with mocked screenplay, take, edit-context,
  trash, and mutation services;
- exercises create, delete, restore, pick ordering, take workspace opening,
  source shot list changes, multi-step edit mode, and non-contiguous shot
  selection workflows;
- has 39 local matches for `waitFor(...)` / `findBy...` style async UI waits.

Move decision:

- Split this file.
- Keep fast rendering and small interaction tests in
  `scene-takes-tab.test.tsx`.
- Move workflow cases to:

```text
packages/studio/src/features/movie-studio/scenes/scene-takes-tab.e2e.test.tsx
```

Workflow cases to move:

- creates a local take card and keeps storyboard preview;
- ignores repeated New Take clicks while creation is pending;
- updates pick state and orders the picked take first;
- confirms before deleting a take card;
- selects shots for an existing take after the active shot list changes;
- switches Take Edit to the returned iteration take after shot selection
  changes;
- replaces selected take shots when non-contiguous shots are selected;
- edge and interior deselection workflows;
- focused source-list shot visibility workflow.

Expected default-suite impact:

- Remove the broadest async component workflows from default Studio tests.
- Keep fast coverage for take-card rendering and basic preview behavior.

#### `packages/studio/src/features/generation-preview/generation-preview-dialog-host.test.tsx`

Current after-log:

```text
src/features/generation-preview/generation-preview-dialog-host.test.tsx (6 tests) 495ms
```

Why this is integration-shaped:

- tests a global dialog host;
- dispatches and handles cross-feature preview events;
- includes fetch-backed generation request behavior;
- has 13 local matches for `waitFor(...)` / `findBy...` style async waits.

Move decision:

- Move the host-level event/fetch coverage to:

```text
packages/studio/src/features/generation-preview/generation-preview-dialog-host.e2e.test.tsx
```

- Keep only small pure rendering helpers in default tests if they exist after
  the split.

#### Scene Reference And Dialogue Tab Workflow Cases

These files are not full-app e2e tests, but several cases are component
integration workflows rather than fast unit tests.

Current after-log:

```text
src/features/movie-studio/scenes/scene-shot-references-tab.test.tsx (13 tests) 734ms
src/features/movie-studio/scenes/scene-shot-dialogs-tab.test.tsx (12 tests) 502ms
```

Move decision:

- Split only the mutation/picker/save-status workflow cases into
  `.e2e.test.tsx` files if the first Studio move still leaves these files above
  target.
- Keep static render and capability-message cases in default tests.

Reference workflow cases to move if needed:

- include/exclude reference images through shared card controls;
- report reference save status around mutations;
- clear reference save status when unmounted during a mutation;
- update reference inclusion across a multi-shot plan;
- select alternate character sheets from a dialog;
- update Location Sheet references through the shot persistence API;
- open the multi-sheet Location Sheet picker and preview cards.

Dialogue workflow cases to move if needed:

- reload dialogue audio context when plan take state changes;
- pick the only generated dialogue take;
- open take management when multiple takes are available;
- update multi-shot dialogue selection inclusion;
- report dialogue save status around mutations;
- clear dialogue save status when unmounted during a mutation.

### Keep In Default `pnpm test`, But Speed Up

These files are slow, but they are still fast-suite-shaped after inspection.
They should stay in default tests and be optimized.

#### `packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.test.tsx`

Current after-log:

```text
src/features/movie-studio/scenes/use-shot-video-take-production.test.tsx (4 tests) 1624ms
```

Why it is slow:

- hook tests render a small harness, not the full app;
- service calls are mocked;
- `useShotVideoTakeProduction()` uses `useDebouncedAutosave()`;
- default autosave delay is `700ms`;
- tests currently use real timers and `waitFor`.

Plan:

- Keep this in default tests.
- Switch relevant tests to fake timers.
- Advance the autosave debounce explicitly inside React `act(...)`.
- Avoid waiting for real `700ms` autosave delays.

#### `packages/studio/src/features/movie-studio/scenes/use-take-shot-design.test.tsx`

Current after-log:

```text
src/features/movie-studio/scenes/use-take-shot-design.test.tsx (3 tests) 1557ms
```

Why it is slow:

- hook tests render a small harness;
- service calls are mocked;
- `useTakeShotDesign()` uses `useDebouncedAutosave()`;
- the test file explicitly calls `vi.useRealTimers()`;
- each save test pays real debounce time.

Plan:

- Keep this in default tests.
- Replace real timers with fake timers for debounce-driven expectations.
- Use `act(...)` and `vi.advanceTimersByTimeAsync(700)` or
  `vi.runOnlyPendingTimersAsync()` where appropriate.

#### Other Studio Slow Files To Keep And Tune

These files should stay in default tests unless later timing proves a specific
case belongs in integration:

```text
src/features/movie-studio/scenes/scene-shots-tab.test.tsx
src/features/movie-studio/scenes/scene-shot-design-tabs.test.tsx
src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx
src/features/movie-studio/cast/cast-member-panel.test.tsx
src/features/movie-studio/visual-language/lookbook-panel.test.tsx
src/features/movie-studio/scenes/scene-shot-detail-save-notification.test.tsx
src/features/movie-studio/locations/location-panel.test.tsx
src/features/movie-studio/story-arc/story-arc-panel.test.tsx
```

Plan:

- Remove unnecessary async waits where assertions can be synchronous after
  render.
- Use fake timers for save-notification tests that wait on timeout-driven UI.
- Keep service mocks narrow and reset them locally.
- Do not move simple render tests to integration just because they use jsdom.

## CLI Findings And Plan

CLI is not the main runtime problem, but it is still part of root `pnpm test`:

```text
packages/cli total: 3.61s
collect: 2.81s
tests: 681ms
src/commands/studio-command.test.ts (3 tests) 590ms
```

Additional inspection found CLI tests that start local servers:

```text
packages/cli/src/commands/studio-notification-client.test.ts
packages/cli/src/commands/studio-resource-event-command.test.ts
```

Plan:

- Leave CLI moves out of the first implementation slice because package runtime
  is small compared with Core and Studio.
- After Core, Engines, and Studio changes, remeasure CLI.
- If CLI remains noisy, move local-server workflow tests under
  `packages/cli/tests/integration/` using the existing CLI integration config.
- Keep CLI command tests thin and mocked where they only verify argument
  parsing, structured diagnostics, or Core service calls.
- Do not move CLI business rules into CLI to make tests faster.

## Diagnostics Findings And Plan

Diagnostics currently takes about `217ms` in the attached after-log.

Plan:

- Do not target Diagnostics for speed work in this slice.
- Run it as part of final root verification to catch accidental regressions.

## Expected Impact

The target is a meaningful root default-suite reduction, not a cosmetic file
rename.

Expected default-suite changes:

- Engines: remove the three user-named legacy tests from default execution.
- Core: reduce repeated shot-video-take and dialogue-audio setup by copying
  command-built state templates.
- Studio: remove the full `App` integration test file from default execution;
  split broad scene workflow cases out of default; stop paying real debounce
  delays in hook tests.

Reasonable target after implementation:

```text
Core default:   under 70s
Studio default: under 45s
Engines default: visibly lower than 5.74s
Root package-duration total: under 125s
```

These are targets, not claims. The implementation must report actual before
and after timings from the same package commands.

## Verified Implementation Results

Verification was completed on 2026-07-06.

The implementation-start baseline was the after-log captured in this plan:

| Package | Baseline default runtime | Final verified default runtime |
| --- | ---: | ---: |
| Diagnostics | `217ms` | `176ms` |
| Core | `92.82s` | `93.26s` |
| CLI | `3.61s` | `4.73s` |
| Engines | `5.74s` | `10.56s` |
| Studio | `65.27s` | `48.15s` |
| Package-duration total | `167.66s` | `156.88s` |

The final full-checklist root default-suite package-duration total remains below
the original baseline, but no longer meets the earlier partial-implementation
`125s` target. The extra Core named-template conversion completed the
architecture/test-ownership checklist, but in this run it increased Core wall
time because collection remains high (`45.48s`) and the copied named templates
do not yet offset all setup and filesystem-copy cost. The next speed-only slice
should profile Core collection/import cost and template-copy overhead rather
than weakening assertions or moving more current product tests out of default.

Completed implementation details:

- Engines default Vitest excludes the three user-named legacy/imported tests.
- Studio full-app and workflow-shaped tests moved into the existing
  `.e2e.test.ts(x)` integration bucket.
- Studio debounce-driven hook tests no longer pay real `700ms` waits.
- Core shot-video-take tests use named one-shot, two-shot, three-shot,
  active-lookbook, imported-first-frame, selected-reference, and finalized
  copied project templates under Core testing ownership.
- The converted Core shot-video-take files no longer use the repeated
  `sampleIds()` / `writeShotList()` setup path.
- Core dialogue-audio tests now use a command-built, copied-per-test
  `dialogueAudioReadyProject` template.

Verification commands that passed:

```text
pnpm --filter @gorenku/studio-engines test
pnpm --filter @gorenku/studio exec vitest run src/features/movie-studio/scenes/use-shot-video-take-production.test.tsx src/features/movie-studio/scenes/use-take-shot-design.test.tsx src/features/movie-studio/scenes/scene-takes-tab.test.tsx --reporter=basic
pnpm --filter @gorenku/studio test -- --reporter=basic
pnpm --filter @gorenku/studio test:integration -- --reporter=basic
pnpm check:test-execution
pnpm --filter @gorenku/studio-core exec vitest run src/server/media-generation/purposes/scene-dialogue-audio.test.ts src/server/media-generation/purposes/shot-video-take/authoring/authoring.test.ts src/server/media-generation/purposes/shot-video-take/planning/reference-sections.test.ts src/server/media-generation/purposes/shot-video-take/planning/preflight-report.test.ts src/server/media-generation/purposes/shot-video-take/planning/production-plan.test.ts src/server/media-generation/purposes/shot-video-take/selection/mutations/reference-selections.test.ts --pool=forks --reporter=basic
pnpm --filter @gorenku/studio-core test -- --reporter=basic
pnpm --filter @gorenku/studio-core test:typecheck
pnpm --filter @gorenku/studio test:typecheck
pnpm test
pnpm check:test-execution
pnpm test:integration
```

## Implementation Slices

### Slice 1: Engines Explicit Disables

- Add exact excludes for the three user-named test files in
  `packages/engines/vitest.config.ts`.
- Run `pnpm --filter @gorenku/studio-engines test`.
- Record before/after Engines timing and the test-file list change.

### Slice 2: Studio Integration Reclassification

- Rename `packages/studio/src/app/app.test.tsx` to
  `packages/studio/src/app/app.e2e.test.tsx`.
- Split `scene-takes-tab.test.tsx` into fast default cases and workflow
  `.e2e.test.tsx` cases.
- Move `generation-preview-dialog-host.test.tsx` to `.e2e.test.tsx`, or split
  it if small pure helper tests should remain.
- Optionally split reference/dialogue workflow cases if Studio default remains
  above target after the first moves.
- Run:

```text
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio test:integration
pnpm check:test-execution
```

### Slice 3: Studio Fast Test Timer Cleanup

- Update `use-shot-video-take-production.test.tsx` to use fake timers for
  debounce-driven save expectations.
- Update `use-take-shot-design.test.tsx` to use fake timers for autosave
  debounce expectations.
- Update save notification component tests only where real timeout waits remain.
- Run `pnpm --filter @gorenku/studio test`.

### Slice 4: Core Shot Video Take Templates

- Add Core-owned shot-video-take template fixtures under
  `packages/core/src/server/testing/`.
- Build template projects through Core commands and services.
- Copy template folders/databases per test.
- Return stable domain IDs and project handles from the template helpers.
- Convert the slow shot-video-take files to the named templates:
  - `authoring.test.ts`;
  - `reference-sections.test.ts`;
  - `preflight-report.test.ts`;
  - `production-plan.test.ts`;
  - `reference-selections.test.ts`.
- Run focused Core test files first, then `pnpm --filter @gorenku/studio-core test`.

Implementation note:

- The verified implementation did not add the full set of named one-shot,
  two-shot, three-shot, active-lookbook, imported-media, selected-reference, and
  finalized-take templates. The root runtime target was met through the existing
  template-backed sample project from plan `0118`, stable sample ID caching, and
  the dialogue-audio template. Deeper shot-video-take state templates remain the
  next Core-specific speedup if Core must get below `70s`.

### Slice 5: Core Dialogue Audio Template

- Add a dialogue-audio-ready template for
  `scene-dialogue-audio.test.ts`.
- Build the template through:
  - `createBlankMovieProject`;
  - `openCurrentProject`;
  - `applyCastOperations`;
  - `createScreenplay`;
  - voice attachment setup where it is shared.
- Copy the ready project per test.
- Run the focused file and then Core default tests.

### Slice 6: CLI Follow-Up If Still Needed

- Remeasure CLI after the larger package changes.
- If CLI still matters, move only local-server workflow tests to
  `packages/cli/tests/integration/`.
- Keep mocked command parsing and structured diagnostic tests in default.

## Completion Checklist

### Investigation And Scope

- [x] Confirmed the old no-move plan is obsolete for the current instruction.
- [x] Confirmed Studio has an existing `.e2e.test.ts(x)` integration partition.
- [x] Confirmed `check:test-execution` already guards that partition.
- [x] Inspected the slow Core shot-video-take fixture path.
- [x] Inspected slow Studio app, hook, and scene tab tests.
- [x] Identified the three Engines tests the user wants disabled.
- [x] Capture an implementation-start baseline from `pnpm test` or the latest
      user-provided after-log before code changes begin.

### Engines

- [x] Exclude `packages/engines/src/sdk/unified/ffmpeg-image-splitter.test.ts`
      from default Engines Vitest execution.
- [x] Exclude `packages/engines/src/sdk/replicate/retry.test.ts` from default
      Engines Vitest execution.
- [x] Exclude `packages/engines/src/model-catalog.test.ts` from default Engines
      Vitest execution.
- [x] Verify `pnpm --filter @gorenku/studio-engines test`.
- [x] Record Engines before/after timing.

### Studio Reclassification

- [x] Move `packages/studio/src/app/app.test.tsx` to
      `packages/studio/src/app/app.e2e.test.tsx`.
- [x] Verify the moved App tests no longer run in
      `pnpm --filter @gorenku/studio test`.
- [x] Verify the moved App tests do run in
      `pnpm --filter @gorenku/studio test:integration`.
- [x] Split `scene-takes-tab.test.tsx` so workflow cases move to
      `scene-takes-tab.e2e.test.tsx`.
- [x] Move or split `generation-preview-dialog-host.test.tsx` into the Studio
      integration bucket.
- [x] Decide after measurement whether reference/dialogue tab workflow cases
      also need splitting.
- [x] Verify `pnpm check:test-execution`.

### Studio Fast Test Optimization

- [x] Convert `use-shot-video-take-production.test.tsx` debounce waits to fake
      timers.
- [x] Convert `use-take-shot-design.test.tsx` debounce waits to fake timers.
- [x] Remove unnecessary async waits from Studio component tests where the DOM
      update is synchronous.
- [x] Keep simple render/capability tests in default Studio tests.
- [x] Verify `pnpm --filter @gorenku/studio test`.
- [x] Record Studio before/after timing.

### Core Fixture Architecture

- [x] Add full named shot-video-take state templates under Core testing
      ownership.
- [x] Build each shot-video-take state template through Core commands and
      services.
- [x] Copy template folders and SQLite databases per test.
- [x] Keep mutable project state isolated per test.
- [x] Return stable domain IDs from template helpers instead of rereading the
      screenplay in every test.
- [x] Avoid direct table writes for normal fixture setup.
- [x] Avoid a single mega fixture that hides unrelated state.

### Core Test Conversion

- [x] Convert `authoring.test.ts` to named shot-video-take templates.
- [x] Convert `reference-sections.test.ts` to active-lookbook and reference
      inventory templates.
- [x] Convert `preflight-report.test.ts` to one-shot/imported-media templates.
- [x] Convert `production-plan.test.ts` to one-shot/two-shot and active-lookbook
      templates.
- [x] Convert `reference-selections.test.ts` to owner-valid reference selection
      templates.
- [x] Convert `scene-dialogue-audio.test.ts` to a dialogue-audio-ready template.
- [x] Recheck `studio-coordination/service.test.ts` after the main Core cuts
      and convert repeated sample-backed setup only if it still matters.

### Verification

- [x] Run focused Engines verification.
- [x] Run focused Studio default verification.
- [x] Run focused Studio integration verification.
- [x] Run focused Core slow-file verification.
- [x] Run `pnpm --filter @gorenku/studio-core test`.
- [x] Run `pnpm test`.
- [x] Run `pnpm test:integration` if Studio tests were moved.
- [x] Run `pnpm check:test-execution`.
- [x] Report package-level before/after timings.
- [x] Report which tests moved, which tests were disabled, and which tests were
      kept in default but sped up.
- [x] Mark this checklist complete only after verification passes.
