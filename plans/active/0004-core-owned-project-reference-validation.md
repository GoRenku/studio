# 0004 Core-Owned Project Reference Validation

Date: 2026-05-07

Status: proposed

## Goal

Implement the first slice of
`docs/decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`.

The immediate product goal is to stop Studio from reporting stale project data
focus requests as successfully applied. The architectural goal is larger: create
one core-owned validation boundary for operation inputs that reference project
data, so the same class of stale-reference bug does not reappear in every new
agent-facing feature.

## References

- `docs/decisions/0006-use-sqlite-for-project-data-and-studio-events-for-ui-coordination.md`
- `docs/decisions/0007-use-core-owned-project-reference-validation-for-agent-coordination.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/studio-coordination-events.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `plans/active/0003-studio-coordination-events.md`

## Problem Statement

Studio coordination currently allows this flow:

1. An external caller appends `studio.focusRequested` for project data, such as
   `{ type: 'scene', id: 'deleted_scene' }`.
2. The browser Studio hook selects or refreshes the project.
3. The hook writes the requested selection directly into React state.
4. The hook later reports `studio.focusChanged` with `appliedRequestId`.
5. `renku studio current --json` enriches the focus from project data and can
   return the selected project with `context: null`.

The failure is not that the UI crashed. The failure is that Studio reported a
focus request as applied even though the referenced project data does not exist
in SQLite-backed project data.

This must be fixed at the data boundary, not as a browser-only entity check.

## Design Principles

- Project SQLite remains the source of truth for durable project data.
- Core owns validation of operation inputs that reference durable project data.
- Studio owns focus rendering and browser-only UI state.
- Coordination events may carry project data references, but they do not prove
  the referenced data exists.
- External focus requests must be strict: unresolved project data fails.
- Human-facing UI display may remain forgiving when local focus state becomes
  stale, as long as Studio does not report that stale state as an externally
  applied request.
- Do not model every UI tab or panel in core. Validate the operation inputs
  that agents, CLI commands, Studio server routes, or coordination events
  actually accept.
- Do not add a universal `ProjectEntityRef` abstraction for this slice.

## Proposed Package Shape

Move the shared Studio focus contract to core if needed, then add core
validation next to the coordination projection that already uses it:

```text
packages/core/src/node/studio-coordination/
  studio-coordination-events.ts
  studio-focus-validation.ts
  studio-focus-validation.test.ts
  studio-current-projection.ts
```

Responsibilities:

- `studio-coordination-events.ts`: continues to own
  `MovieStudioSelection`, `StudioFocusRequest`, `StudioFocus`, and
  `StudioCurrentContext`.
- `studio-focus-validation.ts`: validates `StudioFocusRequest` and
  `MovieStudioSelection` against a loaded `Project`; also builds
  `StudioCurrentContext` for valid Movie Studio selections.
- `studio-focus-validation.test.ts`: covers successful and missing validation
  for current selection kinds.
- `studio-current-projection.ts`: delegates focus context construction to
  `studio-focus-validation.ts` instead of walking the project tree itself.

This validation lives in `node/studio-coordination` because the operation being
validated is the Studio coordination focus contract. The validation itself must
only inspect the loaded `Project`; it must not consume coordination events as
project data.

For future non-coordination operations, place validators next to the core
service that owns that operation. For example, a future cast mutation service
should validate cast member ids inside the project data service boundary, not
inside Studio coordination.

## Initial Core Contract

Use the current focus operation shape. Do not add `ProjectEntityRef`.

```ts
export type MovieStudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'clip'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };

export type StudioFocusRequest =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: MovieStudioSelection };
```

Add validation/resolution results:

```ts
export type MovieStudioSelectionResolution =
  | {
      ok: true;
      selection: MovieStudioSelection;
      context: StudioCurrentContext;
    }
  | {
      ok: false;
      selection: MovieStudioSelection;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export function resolveMovieStudioSelectionForProject(
  project: Project,
  selection: MovieStudioSelection
): MovieStudioSelectionResolution;
```

The function validates directly against the `Project` model:

- `projectInformation`: always valid for a loaded project;
- `visualLanguage`: always valid for a loaded project;
- `storyboard`: always valid for a loaded project;
- `casting`: always valid for a loaded project;
- `sequence(id)`: valid only if `project.sequences` contains the id;
- `scene(id)`: valid only if a sequence contains the scene id;
- `clip(id)`: valid only if a scene contains the clip id;
- `cast(id)`: valid only if `project.cast` contains the cast member id.

Add a focus-level helper for coordination callers:

```ts
export type StudioFocusRequestValidation =
  | {
      ok: true;
      focus: StudioFocusRequest;
      context: StudioCurrentContext | null;
    }
  | {
      ok: false;
      focus: StudioFocusRequest;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export function validateStudioFocusRequestForProject(
  project: Project,
  focus: StudioFocusRequest
): StudioFocusRequestValidation;
```

Rules:

- `projectLibrary` focus does not require a project entity and returns
  `context: null`;
- `movieStudio` focus delegates to
  `resolveMovieStudioSelectionForProject`;
- missing data returns `ok: false`;
- ordinary missing-data cases return structured diagnostics instead of throwing.

## Structured Diagnostics

Use `@gorenku/studio-diagnostics` diagnostic issues.

Suggested codes:

- `STUDIO_COORDINATION030`: requested sequence was not found;
- `STUDIO_COORDINATION031`: requested scene was not found;
- `STUDIO_COORDINATION032`: requested clip was not found;
- `STUDIO_COORDINATION033`: requested cast member was not found;
- `STUDIO_COORDINATION034`: requested focus selection is unsupported.

Use locations that point at the operation input, for example:

```ts
location: {
  path: ['focus', 'selection', 'id'],
  context: 'studio.focusRequested'
}
```

The browser failure event should preserve these diagnostics when reporting
`studio.focusRequestFailed`.

## Concrete Implementation

### 1. Add `studio-focus-validation.ts`

Create:

```text
packages/core/src/node/studio-coordination/studio-focus-validation.ts
```

Expected implementation shape:

```ts
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { CastMember, Clip, Project, Scene, Sequence } from '../../project/index.js';
import type {
  MovieStudioSelection,
  StudioCurrentContext,
  StudioFocusRequest,
} from './studio-coordination-events.js';
```

The file should expose:

- `MovieStudioSelectionResolution`;
- `StudioFocusRequestValidation`;
- `resolveMovieStudioSelectionForProject`;
- `validateStudioFocusRequestForProject`.

It should also contain small private lookup helpers:

```ts
function findSequence(project: Project, id: string): Sequence | null;
function findScene(project: Project, id: string): { sequence: Sequence; scene: Scene } | null;
function findClip(project: Project, id: string): { sequence: Sequence; scene: Scene; clip: Clip } | null;
function findCastMember(project: Project, id: string): CastMember | null;
```

Do not export these helpers in the first slice. They can become shared project
lookup helpers later if another core operation needs them.

Missing-selection diagnostics should be `error` severity issues created with
`createDiagnosticError`. Do not use `studioCoordinationWarning` for rejected
focus requests; warnings are non-blocking, and these failures block applying the
external request.

### 2. Move Current Context Construction

Move the existing `buildContext(project, selection)` logic out of
`studio-current-projection.ts` and into `studio-focus-validation.ts`.

The new function should not return `null` for missing sequence, scene, clip, or
cast member selections. It should return:

```ts
{
  ok: false,
  reason: 'selectionNotFound',
  diagnostics: [...]
}
```

That is the key behavior change.

`storyboard`, `projectInformation`, `visualLanguage`, and `casting` should
still produce valid `StudioCurrentContext` values for a loaded project.

### 3. Refactor `studio-current-projection.ts`

Replace the local `buildContext(project, selection)` tree walk with:

```ts
const resolution = resolveMovieStudioSelectionForProject(project, selection);
```

If `resolution.ok` is true:

```ts
return {
  project: { ... },
  context: resolution.context,
  warnings,
};
```

If `resolution.ok` is false:

```ts
return {
  project: { ... },
  context: null,
  warnings: [...warnings, ...resolution.diagnostics],
};
```

The projection should still return the selected project because the project
reference itself resolved. It should not invent context for the missing
selection.

### 4. Validate Browser Focus Application Before Success

The browser cannot import `@gorenku/studio-core/node`, so there are two valid
implementation options.

Preferred first slice:

- expose a Studio server endpoint that validates a requested focus against the
  loaded project data using core validation;
- call that endpoint from `use-studio-coordination.ts` after project selection
  or refresh and before `setSelection`.

Endpoint:

```text
POST /studio-api/studio/events/focus-requests/validate
```

Request:

```ts
{
  projectName: string;
  focus: StudioFocusRequest;
}
```

Response:

```ts
{
  valid: true;
}
```

or:

```ts
{
  valid: false;
  reason: 'selectionNotFound' | 'unsupportedSelection';
  diagnostics: DiagnosticIssue[];
}
```

Implementation details:

- add `validateStudioFocusRequest` to `packages/studio/src/services/studio-events-api.ts`;
- add the HTTP response/request contract to
  `packages/studio/src/services/studio-current-contracts.ts`;
- implement the route in `packages/studio/server/routes/studio-events.ts`;
- the route loads the project through the existing project data service and
  calls `validateStudioFocusRequestForProject`.

Browser hook behavior:

```ts
const validation = await validateStudioFocusRequest({
  projectName: project.identity.name,
  focus: input.event.focus,
});

if (!validation.valid) {
  await reportStudioFocusRequestFailed({
    browserSessionId: input.browserSessionId,
    requestEventId: input.event.id,
    reason: validation.reason,
    diagnostics: validation.diagnostics,
  });
  return;
}
```

Only after validation succeeds may the hook set:

```ts
input.applyingRequestIdRef.current = input.event.id;
input.setSelection(input.event.focus.selection);
```

Alternative later slice:

- move a browser-safe subset of project validation into `packages/core/src`
  instead of `packages/core/src/node`;
- let the browser import that shared pure function directly.

Do not do both in this slice.

### 5. Preserve Human UI Fallback Separately

`packages/studio/src/features/movie-studio/movie-studio-selection.ts` currently
has display-oriented fallback behavior for stale local selections. Keep that
behavior for UI rendering if it remains useful.

Do not use that display resolver to decide whether an external focus request
succeeded.

The split should be clear:

- core validation answers whether an external operation input is valid against
  project data;
- browser display resolution answers what the human-facing UI should render for
  local state.

## Implementation Order

1. Rename this plan file and ADR references if needed after the ADR lands.
2. Add `studio-focus-validation.ts` in core.
3. Add `studio-focus-validation.test.ts`:
   - `projectInformation` resolves to project information context;
   - `visualLanguage` resolves to visual language context;
   - `storyboard` resolves to storyboard context;
   - `casting` resolves to casting context;
   - valid sequence resolves to sequence context;
   - valid scene resolves to scene context;
   - valid clip resolves to clip context with parent scene and sequence;
   - valid cast resolves to cast member context;
   - missing sequence returns `ok: false`;
   - missing scene returns `ok: false`;
   - missing clip returns `ok: false`;
   - missing cast returns `ok: false`.
4. Refactor `studio-current-projection.ts` to use
   `resolveMovieStudioSelectionForProject`.
5. Update `studio-current-projection` tests to cover missing selected entities
   through the new validation path.
6. Add the Studio server focus validation route.
7. Add browser API client support for the validation route.
8. Update `use-studio-coordination.ts` to validate focus requests before
   applying movie Studio selections.
9. Add browser/server tests for stale focus requests:
   - stale scene does not call `setSelection`;
   - stale clip does not call `setSelection`;
   - stale cast member does not call `setSelection`;
   - each stale request reports `selectionNotFound`;
   - valid selections still apply and later report `appliedRequestId`.
10. Run focused tests, then `pnpm check`.

## Current Bug Acceptance Criteria

Given a loaded project without `scene_deleted`, when Studio receives:

```json
{
  "type": "studio.focusRequested",
  "focus": {
    "screen": "movieStudio",
    "selection": { "type": "scene", "id": "scene_deleted" }
  }
}
```

Studio must:

- keep the previous browser selection unchanged;
- not set `applyingRequestIdRef.current`;
- append `studio.focusRequestFailed`;
- use `reason: "selectionNotFound"`;
- include diagnostics that point to the requested selection;
- not later report `studio.focusChanged` with the failed request id as
  `appliedRequestId`.

`renku studio current --json` must not show that failed request as applied.

## Design Notes For Future Agent Actions

This plan intentionally does not introduce a generic action bus or universal
entity reference type yet. The first slice should stay focused on operation
input validation and focus correctness.

When future agent-facing project mutation commands are added, they should
follow the same rule:

> Validate every durable project data reference in core before mutating data or
> reporting success.

Examples:

- updating a cast member validates `castMemberId` against `project.cast`;
- generating clip assets validates `clipId` against the project clip tree;
- binding a cast member to a clip validates both operation inputs;
- changing a future episode validates `episodeId` against the episode model once
  episodes exist.

Validators should grow with concrete operation contracts, not with every UI
control.

## Non-Goals For This Plan

- Do not redesign the whole Studio action architecture.
- Do not add a browser UI automation protocol.
- Do not add a universal `ProjectEntityRef` type.
- Do not add a representation of every Movie Studio tab or panel.
- Do not move durable project data into coordination events.
- Do not keep compatibility aliases for old selection names.
- Do not add fallback behavior for missing project data references.

## Verification

Use focused package commands first:

```bash
pnpm test:core
pnpm test:cli
```

If browser coordination tests live in `packages/studio`, also run the package's
available focused test command or the root test suite:

```bash
pnpm test
```

Before calling the work done, run:

```bash
pnpm check
```

If any command cannot run in the local environment, record the exact failure in
the implementation notes or final response.
