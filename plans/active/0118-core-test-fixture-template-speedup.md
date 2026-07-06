# 0118 Core Project Fixture Template Speedup

Status: completed
Date: 2026-07-06

## Summary

Core's test execution is still too slow even after
`plans/active/0117-test-execution-strategy-implementation.md` split fast,
integration, and e2e commands.

The immediate bottleneck is not Vitest itself and not the individual assertions.
It is repeated full project fixture creation. Many Core tests rebuild the same
SQLite-backed movie project from scratch in every test case. That path currently
pays the Drizzle Kit migration cost over and over.

The first version of this plan focused too narrowly on the shot-video-take
fixture. The broader timing evidence shows the same setup floor in command,
resource, media-generation, export, and coordination tests. The right first
iteration is therefore to optimize the shared Core testing fixture layer:

- create command-built blank and sample movie project templates once per test
  process;
- copy those templates into a fresh isolated home/project folder for each test;
- keep the existing `createBlankMovieProject()` and `createSampleMovieProject()`
  fixture contracts as the common fast path;
- add explicit command-built fixture helpers for tests that intentionally
  exercise project creation, migration, or corrupt-database behavior;
- continue using real Core commands to create the templates;
- keep every test's mutable SQLite database and project files isolated.

The target is not to squeeze every possible millisecond out of the suite. The
target is to remove the obvious repeated ~500ms setup floor while preserving the
coverage and isolation that make the tests valuable.

## Timing Evidence

The investigation after plan `0117` found this timing profile for the
shot-video-take fixture path:

```text
createShotVideoTakeTestProject: ~522ms
sampleIds: ~2ms
writeShotList + createTake: ~30ms
readShotVideoTakeProductionPlan: ~114ms
invalid reference mutation: ~81ms
```

The dominant setup cost is project creation:

```text
createMovieProject: ~507ms
migrate empty database directly: ~469ms
```

The relevant production path is:

- `packages/core/src/server/commands/create-movie-project.ts`
- `packages/core/src/server/database/lifecycle/migrator.ts`
- `packages/core/drizzle.project-migrate.config.ts`

`createMovieProject()` correctly runs Drizzle Kit migrations through the Core
database migration path. That is the right production behavior, but repeatedly
running it for every test fixture is expensive.

A probe using a template project copy showed the main opportunity:

```text
create template project: ~528ms
copy project 1: ~3ms
copy project 2: ~2ms
copy project 3: ~2ms
copy project 4: ~2ms
copy project 5: ~2ms
```

That suggests the first iteration can preserve test isolation while removing
most repeated setup time.

## Broader Runtime Evidence

The slow-test output shows the same rough floor outside shot-video-take:

```text
src/server/commands/screenplay-commands.test.ts              11 tests 4697ms
src/server/commands/visual-language-commands.test.ts          8 tests 3879ms
src/server/commands/scene-shot-list-commands.test.ts          9 tests 4580ms
src/server/commands/screenplay-analysis-commands.test.ts      9 tests 4375ms
src/server/commands/cast-voice-commands.test.ts               8 tests 5382ms
src/server/commands/register-asset.test.ts                    9 tests 3897ms
src/server/media-generation/purposes/location-environment... 10 tests 3349ms
src/server/media-generation/purposes/location-hero.test.ts     7 tests 3200ms
src/server/commands/department-design-commands.test.ts         6 tests 2862ms
src/server/media-generation/purposes/cast-image.test.ts       12 tests 2933ms
```

Many individual tests in these files report ~460-550ms even when the test body
is simple. That pattern is the signature of a per-test fixture setup floor.

Current call-site inspection confirms the common source:

- `screenplay-commands.test.ts` uses `createBlankMovieProject()`.
- `screenplay-analysis-commands.test.ts` uses `createBlankMovieProject()`.
- `department-design-commands.test.ts` uses both blank and sample project
  fixtures.
- `visual-language-commands.test.ts`, `scene-shot-list-commands.test.ts`,
  `cast-voice-commands.test.ts`, `register-asset.test.ts`,
  `project-information.test.ts`, `assets.test.ts`, `selection-context.test.ts`,
  `director-context.test.ts`, `project-library.test.ts`, and several
  media-generation tests use `createSampleMovieProject()`.
- `createShotVideoTakeTestProject()` wraps `createSampleMovieProject()`, so it
  is one high-volume beneficiary of the same fix.

Moving these files into an integration bucket would not solve the development
loop problem. The tests still need to run regularly. The better first move is to
remove repeated identical setup work.

## Current Slow Fixture Shapes

### Blank Movie Project Fixture

`packages/core/src/server/testing/project-data-fixtures.ts`

`createBlankMovieProject()` currently does this for every test:

1. Create or receive a fresh temp home directory.
2. Create a `ProjectDataService`.
3. Call `projectData.createMovieProject()`.
4. `createMovieProject()` runs Drizzle Kit migrations for a new SQLite project
   database.
5. Return the command report.

This is useful for tests that truly exercise project creation. It is wasteful
for tests that only need an empty valid movie project before testing screenplay,
analysis, department-design, resource, or media behavior.

### Sample Movie Project Fixture

`packages/core/src/server/testing/project-data-fixtures.ts`

`createSampleMovieProject()` currently does this for every test:

1. Create or receive a fresh temp home directory.
2. Create a `ProjectDataService`.
3. Call `projectData.createMovieProject()`.
4. `createMovieProject()` runs Drizzle Kit migrations for a new SQLite project
   database.
5. Seed project information locale rows.
6. Open the current project.
7. Apply cast operations.
8. Apply location operations.
9. Create the sample screenplay.
10. Return the command report.

This is the main source of repeated setup in sample-backed tests.

### Shot Video Take Fixture

`packages/core/src/server/testing/shot-video-take-fixtures.ts`

`createShotVideoTakeTestProject()` currently wraps the sample project fixture:

1. Create a fresh temp home directory.
2. Write Renku config.
3. Create a new `ProjectDataService`.
4. Run `createSampleMovieProject()`.
5. Return shot-video-take-specific helpers that mutate the project.

Optimizing the shared sample project fixture makes this fixture faster without
changing the shot-video-take helper's public contract.

## Goals

- Preserve test coverage and assertions.
- Preserve per-test isolation for mutable project state.
- Avoid repeated Drizzle Kit migrations for identical blank and sample fixture
  setup.
- Keep Drizzle Kit as the source of truth for project database migrations.
- Keep production project creation unchanged.
- Optimize the shared fixture helpers first because many slow files use them.
- Keep project creation and migration tests on the real command-built path.
- Measure before and after using file-level and command-level timings.
- Keep the implementation reviewable and domain-named.

## Non-Goals

- Do not optimize every Core test pattern in this first iteration.
- Do not change `createMovieProject()` production behavior.
- Do not replace Drizzle Kit migrations with hand-written test schema creation.
- Do not introduce raw database writes as the normal fixture construction path.
- Do not use one shared mutable SQLite database across tests.
- Do not add compatibility shims or fallback loaders.
- Do not move domain validation out of Core commands to make tests faster.
- Do not weaken assertions, skip tests, or remove coverage.
- Do not introduce transaction rollback fixtures in this slice.
- Do not introduce a broad generic fixture framework.
- Do not change Studio, CLI, Engines, or Playwright test behavior in this slice.

## Architecture Boundaries

### Core Commands Remain The Owner

The template projects must be built through Core-owned commands and services.
The sample template must continue to be created through the same command surface
used today:

- `createMovieProject`
- `openCurrentProject`
- `applyCastOperations`
- `applyLocationOperations`
- `createScreenplay`

The implementation must not insert rows directly into project tables to create
normal blank or sample fixture state.

### Drizzle Kit Remains The Migration Path

The template databases must be produced by the accepted Drizzle Kit migration
path. Tests may copy a database that was already produced by that path, but they
must not create an alternate test-only schema path.

This keeps the accepted rule intact:

- Drizzle TypeScript schema is the source of truth.
- Drizzle Kit generates and applies project database migrations.
- Runtime/project database creation still follows the production migration
  path.

### Fixture Helpers Are Test Support Only

The template-copying code belongs under:

```text
packages/core/src/server/testing/
```

It must not be exported from public package entrypoints. It must not become a
runtime API, CLI shortcut, Studio server shortcut, or database creation path.

### Isolation Is Per Test

Every test using the fast blank or sample fixture must still receive:

- a unique temp home directory;
- a unique storage root;
- a unique project folder;
- a unique SQLite database file;
- the same current-project behavior it receives today, with any descriptor
  generated for that specific home rather than copied from a template home.

Tests must not share a mutable project folder or SQLite connection.

### Templates Are Immutable By Convention

The command-built template projects are source artifacts for copying only.

Implementation should:

- keep templates under temp roots owned by the current test process;
- never hand a template home/project folder to tests;
- copy the relevant template before returning a fixture;
- fail fast if the template project cannot be located or copied;
- avoid mutating a template after it has been built.

### Creation And Migration Tests Stay Explicit

Tests that intentionally verify project creation, migration, backup, corrupt
database handling, or project-library behavior must not accidentally switch to a
template path.

Those tests should use deliberately named command-built helpers or direct
`createMovieProject()` calls so their intent is visible in the test.

## Proposed File And API Shape

Add a focused test support module:

```text
packages/core/src/server/testing/movie-project-template-fixtures.ts
```

Suggested exported test-support shapes:

```ts
export interface IsolatedBlankMovieProject {
  homeDir: string;
  projectName: string;
  projectFolder: string;
  databasePath: string;
}

export interface IsolatedSampleMovieProject {
  homeDir: string;
  projectName: 'constantinople';
  projectFolder: string;
  databasePath: string;
}
```

Suggested exported test-support helpers:

```ts
export async function createIsolatedBlankMovieProjectFromTemplate(input: {
  homeDir: string;
  projectData: ReturnType<typeof createProjectDataService>;
}): Promise<ProjectCreateReport | null>;

export async function createIsolatedSampleMovieProjectFromTemplate(input: {
  homeDir: string;
  projectData: ReturnType<typeof createProjectDataService>;
}): Promise<ProjectCreateReport | null>;
```

The return type should stay compatible with the existing fixture callers. If the
implementation needs internal path details, expose those through private
template records rather than changing every test.

Update the existing common helpers:

```ts
export async function createBlankMovieProject(...): Promise<ProjectCreateReport | null>
export async function createSampleMovieProject(...): Promise<ProjectCreateReport | null>
```

These should become the fast template-backed helpers because most tests import
them only to obtain a valid starting project.

Add deliberately named command-built helpers for tests that need the real setup
path:

```ts
export async function createCommandBuiltBlankMovieProject(
  input: BlankMovieProjectFixtureInput
): Promise<ProjectCreateReport | null>;

export async function createCommandBuiltSampleMovieProject(
  input: SampleMovieProjectFixtureInput
): Promise<ProjectCreateReport | null>;
```

This keeps test intent readable:

- `createSampleMovieProject()` means "give this test an isolated sample movie
  project quickly";
- `createCommandBuiltSampleMovieProject()` means "exercise the real command
  construction path".

The command-built helpers should contain the current implementation. The
template module should use those helpers to build each process-local template.

## Template Copy Behavior

For each template-backed fixture call:

1. Lazily build the relevant process-local template through the command-built
   helper.
2. Use the caller-provided `homeDir`.
3. Resolve the caller's configured storage root through the same project
   configuration path the current fixture already depends on.
4. Copy the template project folder into that storage root.
5. If the caller requested a custom blank project name or title, handle it only
   if the current fixture contract can support that without rewriting durable
   project identity by hand.
6. Preserve current-project behavior:
   `createSampleMovieProject()` should leave the sample project opened because
   it does today; `createBlankMovieProject()` should not start opening the blank
   project unless the existing command path already does.
7. Return a `ProjectCreateReport` compatible with existing callers.

The custom blank project-name case needs a careful implementation choice:

- If current call sites only use the default blank project name, keep the first
  iteration limited to the default and route custom blank project creation
  through `createCommandBuiltBlankMovieProject()`.
- If high-volume tests need a custom blank project name, add a separate named
  blank template per project identity rather than mutating copied durable
  project identity fields by hand.

The expected first slice should not invent a generic identity-rewrite mechanism.

## First Implementation Scope

### Convert The Shared Blank And Sample Fixture Helpers

Update:

```text
packages/core/src/server/testing/project-data-fixtures.ts
```

Implementation intent:

- move the existing `createBlankMovieProject()` implementation into
  `createCommandBuiltBlankMovieProject()`;
- move the existing `createSampleMovieProject()` implementation into
  `createCommandBuiltSampleMovieProject()`;
- make `createBlankMovieProject()` use the blank template copy path for the
  default blank project fixture;
- make `createSampleMovieProject()` use the sample template copy path;
- preserve existing return values closely enough that current tests do not need
  assertion changes.
- preserve existing current-project behavior: blank project tests should still
  open the project explicitly, while sample project tests should still receive
  the opened sample project behavior they have today.

This is the biggest first-iteration win because it improves many call sites at
once.

### Keep Project Creation And Migration Tests On The Real Path

Review and update intentional command-path tests, including:

```text
packages/core/src/server/commands/create-movie-project.test.ts
packages/core/src/server/commands/migrate-database.test.ts
packages/core/src/server/resources/project-library.test.ts
```

Use direct `projectData.createMovieProject()` or the new command-built fixture
helpers in those tests when the real creation/migration path is the behavior
under test.

Do not convert corrupt-database, backup, migration, or project-library edge case
tests by accident.

### Shot Video Take Benefits Through The Sample Fixture

Update only if needed:

```text
packages/core/src/server/testing/shot-video-take-fixtures.ts
```

Because `createShotVideoTakeTestProject()` already calls
`createSampleMovieProject()`, it should become faster once the shared sample
fixture helper is template-backed.

The shot-video-take helper should keep:

- the returned `ShotVideoTakeTestProject` contract;
- `sampleIds()` behavior;
- `writeShotList()` behavior;
- project-file helper behavior;
- all existing test assertions.

### Leave Deeper Optimizations For Later

Do not add transaction rollback, persistent templates across test commands,
database snapshot APIs, global Vitest setup, or a `test:contract` command in
this slice.

Those may become useful later, but the measured copy speed suggests a simple
template-copy approach is already enough for the first iteration.

## Template Lifetime And Cleanup

Use process-local module state:

```ts
let blankMovieProjectTemplatePromise:
  | Promise<MovieProjectTemplate>
  | undefined;

let sampleMovieProjectTemplatePromise:
  | Promise<MovieProjectTemplate>
  | undefined;
```

Templates should live under temp folders such as:

```text
<os.tmpdir()>/renku-blank-movie-template-<process.pid>-...
<os.tmpdir()>/renku-sample-movie-template-<process.pid>-...
```

Per-test clones should live under existing temp-home patterns, for example:

```text
<os.tmpdir()>/renku-screenplay-test-...
<os.tmpdir()>/renku-shot-video-take-test-...
```

Do not add aggressive cleanup in the first slice unless a safe existing cleanup
pattern already exists. Temporary test folders are already used throughout the
Core tests. If cleanup becomes necessary, add guarded cleanup that refuses to
remove paths outside the expected temp roots.

## Correctness Requirements

After conversion, each test must still be able to:

- mutate project information, screenplay, cast, location, lookbook, shot list,
  take, generation, and asset state without affecting another test;
- import files into its own project folder;
- read and write the current project through the normal Core service;
- rely on deterministic ids from the existing deterministic id generator;
- fail with the same structured diagnostics as before.

Each template copy must include:

- `.renku/project.sqlite`;
- any project metadata needed by current Core commands;
- the seeded fixture rows created by current commands.

After a sample project copy, `openCurrentProject()` should validate the copied
database path and write the home-local current project descriptor, matching the
current sample fixture behavior. A blank project copy should preserve the
current blank fixture behavior and leave explicit opening to the test unless the
underlying project creation contract already opens it.

## Measurement Plan

Before implementation, capture baseline timings for representative files across
both blank and sample fixture users:

```bash
pnpm --dir packages/core exec vitest run src/server/commands/screenplay-commands.test.ts
pnpm --dir packages/core exec vitest run src/server/commands/screenplay-analysis-commands.test.ts
pnpm --dir packages/core exec vitest run src/server/commands/visual-language-commands.test.ts
pnpm --dir packages/core exec vitest run src/server/commands/scene-shot-list-commands.test.ts
pnpm --dir packages/core exec vitest run src/server/commands/register-asset.test.ts
pnpm --dir packages/core exec vitest run src/server/media-generation/purposes/shot-video-take/planning/reference-sections.test.ts
```

Also capture fixture-level timing with a temporary local probe or Vitest output:

```text
createBlankMovieProject
createSampleMovieProject
createShotVideoTakeTestProject
createMovieProject
migrate empty database directly
```

After implementation, rerun the same commands and compare:

- per-file runtime;
- slowest individual test runtime;
- blank fixture setup timing;
- sample fixture setup timing;
- shot-video-take fixture setup timing;
- full Core fast suite runtime if practical.

Expected first-iteration result:

- template creation remains roughly ~500ms once per process per template;
- per-test fixture clone drops to roughly ~2-10ms;
- many currently ~460-550ms individual tests should drop close to their real
  behavior cost;
- files with additional generation, provider, file-import, or planning work may
  still have meaningful runtime, but should lose the repeated project-creation
  floor.

Do not block implementation on achieving an exact runtime target. The success
criterion is a clear, repeatable reduction in the repeated setup cost without
coverage loss.

## Risk Areas

### Hidden Cross-Test State

The main risk is accidentally sharing mutable state. The implementation must
copy the project folder and SQLite database for each test. It must not return
the template path directly.

### Current Project Descriptor Drift

The copied project lives at a different path than the template. Do not copy the
template home's current-project descriptor as-is. The sample fixture should call
`openCurrentProject()` for the new home so the descriptor points at the copied
project. The blank fixture should keep its existing explicit-open behavior and
let tests create that descriptor when they call `openCurrentProject()`.

### Project Path Assumptions Inside Stored Data

If any current database row stores an absolute project path, a copied template
could retain the template path by mistake. The implementation must inspect for
this before relying on copied templates broadly. If such absolute paths exist,
the first slice should either route those specific tests through command-built
helpers or change the fixture setup so durable project data remains
project-relative.

### Blank Project Identity

Blank project tests may occasionally pass a custom `projectName` or `title`.
The template-backed default must not rewrite durable identity fields by hand
unless that rewrite is owned by an existing Core command.

If custom identity matters for a test, use the command-built helper in the first
iteration.

### Template Staleness

If the schema or fixture setup changes, the template must be rebuilt in the same
test process. A module-scoped lazy promise naturally does this per process
execution. Do not persist templates across independent test commands in the
first iteration.

### Tests That Intentionally Exercise Creation Or Migration

Do not route migration, backup, corrupt-database, or project-creation tests
through the template helper. Those tests need the real creation path.

### Architecture Drift

A template helper is acceptable as test support because it copies a project that
was built through real commands. It would not be acceptable to use this as a
runtime shortcut, a CLI shortcut, or a replacement for Core project creation.

## Implementation Slices

### Slice 1: Baseline Timing And Call-Site Audit

- Record current runtimes for the representative blank and sample fixture files.
- Record current fixture setup timing.
- Audit `createBlankMovieProject()`, `createSampleMovieProject()`, and direct
  `createMovieProject()` test call sites.
- Identify tests that must remain on command-built project setup.
- Confirm current representative tests pass before changing fixture
  construction.

### Slice 2: Command-Built Helper Names

- Add `createCommandBuiltBlankMovieProject()` with the current blank fixture
  implementation.
- Add `createCommandBuiltSampleMovieProject()` with the current sample fixture
  implementation.
- Keep the existing deterministic fixture data and ids unchanged.
- Update creation/migration-focused tests to call the command-built helpers
  where appropriate.

### Slice 3: Template Fixture Module

- Add `packages/core/src/server/testing/movie-project-template-fixtures.ts`.
- Build the blank template with `createCommandBuiltBlankMovieProject()`.
- Build the sample template with `createCommandBuiltSampleMovieProject()`.
- Cache each template with a process-local lazy promise.
- Copy the relevant template into a fresh home/storage root per request.
- Use `openCurrentProject()` for the sample fixture copy to create the new
  home-local current project descriptor.
- Preserve the blank fixture's current explicit-open behavior.
- Return reports compatible with the existing fixture helper contracts.
- Add focused tests for template isolation.

### Slice 4: Shared Fixture Conversion

- Update `createBlankMovieProject()` to use the blank template path for default
  blank fixtures.
- Update `createSampleMovieProject()` to use the sample template path.
- Keep current callers unchanged unless they need the command-built path.
- Keep `createShotVideoTakeTestProject()` unchanged unless it needs minor path
  plumbing after the shared fixture conversion.

### Slice 5: Verification And Timing Comparison

- Run the representative blank fixture files.
- Run the representative sample fixture files.
- Run representative shot-video-take files.
- Run all current files that call `createBlankMovieProject()` or
  `createSampleMovieProject()` if runtime is acceptable.
- Run Core fast tests.
- Run Core integration tests if shared fixture support affects integration
  tests.
- Compare before and after timings in this plan's implementation result
  section.

### Slice 6: Decide Whether To Continue

After the first iteration, decide whether more fixture optimization is worth it.

Possible follow-up areas:

- selected direct `createMovieProject()` test callers that are not really
  testing project creation;
- additional named templates such as sample project with active lookbook;
- transaction rollback for database-only tests;
- persistent snapshot templates across independent test commands;
- a separate `test:contract` command if database-backed tests remain too heavy.

Do not implement these follow-ups in the first iteration unless the blank/sample
template conversion is insufficient or exposes a required shared abstraction.

## Implementation Result

Implemented on 2026-07-06.

The shared Core fixture helpers now use process-local command-built templates
for the default blank and sample movie projects:

- `createBlankMovieProject()` uses a copied blank template for the default
  `blank-movie` fixture.
- `createSampleMovieProject()` uses a copied `constantinople` sample template.
- `createCommandBuiltBlankMovieProject()` and
  `createCommandBuiltSampleMovieProject()` preserve the real command-built path
  for tests that intentionally exercise creation, migration, backup, corrupt
  database, project-library, or custom blank identity behavior.
- `packages/core/src/server/testing/movie-project-template-fixtures.ts` is
  test support only and is not exported from the package public API.
- `packages/core/src/server/commands/migrate-database.test.ts` and
  `packages/core/src/server/resources/project-library.test.ts` now use the
  command-built sample helper where that coverage is intentional.

The representative six-file timing run improved from 38.28s before the change
to 12.46s after the change:

| File | Before | After |
| --- | ---: | ---: |
| `screenplay-commands.test.ts` | 4941ms | 654ms |
| `screenplay-analysis-commands.test.ts` | 4414ms | 640ms |
| `visual-language-commands.test.ts` | 4059ms | 693ms |
| `scene-shot-list-commands.test.ts` | 4544ms | 679ms |
| `register-asset.test.ts` | 4035ms | 626ms |
| `reference-sections.test.ts` | 9336ms | 2556ms |

Focused fixture verification showed the expected template/copy behavior:

- first blank template-backed test, including template creation and two copies:
  498ms;
- follow-up blank mutation test, including two copied fixtures and a mutation:
  18ms;
- one additional blank copied fixture with current-project verification: 2ms;
- first sample template-backed test, including template creation and two copies:
  510ms;
- follow-up sample mutation test, including two copied fixtures and a mutation:
  11ms;
- one additional sample copied fixture with current-project verification: 4ms.

Verification completed successfully:

```bash
pnpm --dir packages/core exec vitest run src/server/testing/movie-project-template-fixtures.test.ts
pnpm --dir packages/core exec vitest run --reporter verbose src/server/testing/movie-project-template-fixtures.test.ts
pnpm --dir packages/core exec vitest run src/server/commands/screenplay-commands.test.ts src/server/commands/screenplay-analysis-commands.test.ts src/server/commands/visual-language-commands.test.ts src/server/commands/scene-shot-list-commands.test.ts src/server/commands/register-asset.test.ts src/server/media-generation/purposes/shot-video-take/planning/reference-sections.test.ts
pnpm --dir packages/core exec vitest run src/server/commands/migrate-database.test.ts src/server/resources/project-library.test.ts
pnpm --filter @gorenku/studio-core test:typecheck
pnpm --filter @gorenku/studio-core lint
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-core test:integration
```

The first iteration is sufficient for the current development-loop problem.
Further fixture work should stay out of this slice unless a new bottleneck is
measured and planned separately.

## Completion Checklist

### Review And Architecture

- [x] Confirm this plan follows the findings from the post-`0117` test runtime
      investigation.
- [x] Confirm the broader slow-test list is represented, not only the
      shot-video-take files.
- [x] Confirm no production project creation behavior is changed.
- [x] Confirm Drizzle Kit remains the path that creates each template database.
- [x] Confirm the template helper is test support only and is not exported as a
      package public API.
- [x] Confirm no raw project table inserts are added for normal fixture
      construction.
- [x] Confirm no test assertions are weakened, skipped, or deleted.
- [x] Confirm no compatibility shims, fallback loaders, or obsolete shape
      support are introduced.
- [x] Confirm command-built helper names make test intent clearer rather than
      hiding creation/migration coverage.

### Baseline Measurement

- [x] Capture baseline runtime for
      `screenplay-commands.test.ts`.
- [x] Capture baseline runtime for
      `screenplay-analysis-commands.test.ts`.
- [x] Capture baseline runtime for
      `visual-language-commands.test.ts`.
- [x] Capture baseline runtime for
      `scene-shot-list-commands.test.ts`.
- [x] Capture baseline runtime for
      `register-asset.test.ts`.
- [x] Capture baseline runtime for
      `reference-sections.test.ts`.
- [x] Capture baseline fixture setup timing for
      `createBlankMovieProject()`.
- [x] Capture baseline fixture setup timing for
      `createSampleMovieProject()`.
- [x] Capture baseline fixture setup timing for
      `createShotVideoTakeTestProject()`.
- [x] Capture the current `createMovieProject()` or migration setup timing if
      useful for comparison.

### Call-Site Audit

- [x] List current test files that call `createBlankMovieProject()`.
- [x] List current test files that call `createSampleMovieProject()`.
- [x] List current test files that call `projectData.createMovieProject()`
      directly.
- [x] Mark project creation tests that must keep direct command creation.
- [x] Mark migration and backup tests that must keep command-built setup.
- [x] Mark corrupt-database and project-library tests that must not accidentally
      rely on template copies.
- [x] Mark high-volume ordinary fixture tests that should benefit without
      assertion changes.

### Command-Built Helpers

- [x] Add `createCommandBuiltBlankMovieProject()`.
- [x] Add `createCommandBuiltSampleMovieProject()`.
- [x] Move the current `createBlankMovieProject()` implementation into the
      command-built blank helper.
- [x] Move the current `createSampleMovieProject()` implementation into the
      command-built sample helper.
- [x] Keep deterministic id generation unchanged.
- [x] Keep sample project title, logline, summary, aspect ratio, cast,
      locations, locale rows, and screenplay unchanged.
- [x] Update intentional creation/migration tests to use direct
      `createMovieProject()` or command-built helpers.

### Template Fixture Module

- [x] Add
      `packages/core/src/server/testing/movie-project-template-fixtures.ts`.
- [x] Define a domain-specific template record shape.
- [x] Define an isolated blank movie project copy path.
- [x] Define an isolated sample movie project copy path.
- [x] Build the blank template through
      `createCommandBuiltBlankMovieProject()`.
- [x] Build the sample template through
      `createCommandBuiltSampleMovieProject()`.
- [x] Cache the blank template with a process-local lazy promise.
- [x] Cache the sample template with a process-local lazy promise.
- [x] Create or use the caller's fresh temp home for every isolated project
      copy.
- [x] Resolve the caller's configured storage root without silently changing the
      fixture contract.
- [x] Copy the template project folder into the fresh storage root.
- [x] Use `openCurrentProject()` to write the fresh current-project descriptor
      for sample fixtures.
- [x] Preserve the blank fixture's current explicit-open behavior.
- [x] Fail fast if the template project folder, database path, or copied project
      cannot be resolved.
- [x] Avoid returning template paths to tests.
- [x] Avoid mutating template folders after template creation.

### Shared Fixture Conversion

- [x] Update `createBlankMovieProject()` to use the blank template helper for
      the default blank fixture case.
- [x] Route custom blank project identity cases through the command-built helper
      unless a safe Core-owned identity command already exists.
- [x] Update `createSampleMovieProject()` to use the sample template helper.
- [x] Preserve the existing `ProjectCreateReport | null` return contract.
- [x] Preserve existing `runCreateOrSkip()` native-binding skip behavior.
- [x] Preserve current-project behavior for blank and sample fixtures.
- [x] Keep existing test imports unchanged where tests only need a valid blank
      or sample project.
- [x] Keep `createShotVideoTakeTestProject()` contract unchanged.
- [x] Confirm project file helper behavior points at the isolated copied
      project.

### Template Isolation Tests

- [x] Add focused tests proving two blank fixture copies do not share project
      folders or SQLite database paths.
- [x] Add focused tests proving two sample fixture copies do not share project
      folders or SQLite database paths.
- [x] Add focused tests proving mutation in one blank copy does not affect
      another blank copy.
- [x] Add focused tests proving mutation in one sample copy does not affect
      another sample copy.
- [x] Add focused coverage for sample fixture current-project descriptor
      creation after a copy.
- [x] Add focused coverage that the blank fixture keeps explicit-open behavior.
- [x] Add focused coverage for fail-fast behavior when a template copy cannot be
      resolved, if practical without brittle filesystem mocking.

### Verification

- [x] Run
      `pnpm --dir packages/core exec vitest run src/server/commands/screenplay-commands.test.ts`.
- [x] Run
      `pnpm --dir packages/core exec vitest run src/server/commands/screenplay-analysis-commands.test.ts`.
- [x] Run
      `pnpm --dir packages/core exec vitest run src/server/commands/visual-language-commands.test.ts`.
- [x] Run
      `pnpm --dir packages/core exec vitest run src/server/commands/scene-shot-list-commands.test.ts`.
- [x] Run
      `pnpm --dir packages/core exec vitest run src/server/commands/register-asset.test.ts`.
- [x] Run
      `pnpm --dir packages/core exec vitest run src/server/media-generation/purposes/shot-video-take/planning/reference-sections.test.ts`.
- [x] Run all current files that call `createBlankMovieProject()` if runtime is
      acceptable.
- [x] Run all current files that call `createSampleMovieProject()` if runtime is
      acceptable.
- [x] Run all current files that call `createShotVideoTakeTestProject()`.
- [x] Run `pnpm --filter @gorenku/studio-core test`.
- [x] Run `pnpm --filter @gorenku/studio-core test:integration` if shared
      fixture support affects integration tests.
- [x] Run `pnpm --filter @gorenku/studio-core test:typecheck`.
- [x] Run `pnpm --filter @gorenku/studio-core lint`.

### Timing Result

- [x] Record after-runtime for `screenplay-commands.test.ts`.
- [x] Record after-runtime for `screenplay-analysis-commands.test.ts`.
- [x] Record after-runtime for `visual-language-commands.test.ts`.
- [x] Record after-runtime for `scene-shot-list-commands.test.ts`.
- [x] Record after-runtime for `register-asset.test.ts`.
- [x] Record after-runtime for `reference-sections.test.ts`.
- [x] Record after fixture setup timing for
      `createBlankMovieProject()`.
- [x] Record after fixture setup timing for
      `createSampleMovieProject()`.
- [x] Record after fixture setup timing for
      `createShotVideoTakeTestProject()`.
- [x] Compare the timing delta against the baseline.
- [x] Add an implementation result section to this plan with the final measured
      improvement.

### Follow-Up Decision

- [x] Decide whether the first iteration is sufficient for current development
      needs.
- [x] If sufficient, stop and avoid broader fixture churn.
- [x] If insufficient, create a separate follow-up plan for the next bottleneck,
      such as direct `createMovieProject()` call sites, transaction rollback, or
      a narrower contract-test command.
