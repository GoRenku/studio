# 0048 Scene Shot Tab Route And Focus State

Status: implemented
Date: 2026-06-06

## Summary

Scene and shot-detail tab state should become part of the Studio route and
Studio focus contract.

The current browser UI forgets two important tab choices:

- the scene-level tab (`Narrative` vs `Shots`);
- the shot-detail tab inside `Shots` (`Description`, `Lookbook`,
  `Composition`, `Motion`, `Cast`, `Location`, `References`,
  `AI Production`).

This is visible in the current shot workflow. For example:

1. Open a scene.
2. Select the `Shots` tab.
3. Open `Composition`.
4. Select another shot in the rail.
5. The detail surface returns to `Description` instead of staying on
   `Composition`.

The tab state should be URL-backed so browser back/forward works naturally and
agent coordination can describe the same surface the user is looking at.

The selected values inside a tab, such as `Medium Close-Up`, `Single`,
`Low Angle`, or selected reference cards, must **not** be stored in the URL.
Those values can be multi-select, can autosave independently, and already belong
to project data. The URL granularity stops at tab level.

## Goals

- Remember the scene-level tab in browser history.
- Remember the shot-detail tab in browser history.
- Preserve the active shot-detail tab while switching between shots in the shot
  rail.
- Keep shot-spec selections and other tab-internal selections out of the URL.
- Extend Studio focus/current reporting so CLI and agent callers can read:
  - the current scene tab;
  - the current shot-detail tab when the scene is on `Shots`;
  - the current shot when one is selected;
  - a human-readable summary of the selected values inside the current tab,
    derived from persisted project data.
- Keep the implementation aligned with the existing route, Studio selection,
  Studio coordination event, and structured validation patterns.

## Non-Goals

- Do not add a database table, local storage key, or per-user preference store
  for tab state.
- Do not put tile selections, reference selections, AI Production settings,
  lens millimeters, custom text, grouping drafts, or other tab-internal state in
  the URL.
- Do not introduce compatibility aliases for older tab names.
- Do not add wrapper/facade modules for route state.
- Do not optimize or test mobile viewport behavior.
- Do not redesign the visual tab components.
- Do not change the shot rail grouping behavior from `0047`.

## Current Architecture

### Browser Route Ownership

The route state is owned by:

- `packages/studio/src/app/use-project-session.ts`

This hook:

- reads `window.location.pathname` and `window.location.search`;
- maps the browser route into a `StudioSelection`;
- validates selections through `readStudioSelectionContext` when the current
  project shell cannot resolve the target locally;
- pushes browser history entries through `window.history.pushState`;
- listens to `popstate`.

Scene routes currently use this shape:

```text
/projects/:projectName/scenes/:sceneId
/projects/:projectName/scenes/:sceneId?shot=:shotId
```

The route parser already reads the `shot` query parameter and maps it into:

```ts
{ type: 'scene', id: sceneId, shotId }
```

The route builder already writes the same query parameter for a scene selection
that has `shotId`.

### Studio Selection Contract

The browser-side selection type lives in:

- `packages/studio/src/features/movie-studio/movie-studio-selection.ts`

The server/core coordination selection type lives in:

- `packages/core/src/server/studio-coordination/events.ts`

The scene selection currently has only:

```ts
{ type: 'scene'; id: string; shotId?: string }
```

This means the focus contract can report which scene and maybe which shot are in
focus, but it cannot report whether the user is on `Narrative`, `Shots`,
`Composition`, or `AI Production`.

### Scene-Level Tabs

The scene-level tabs are owned by:

- `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`

Important current behavior:

- `ScenePanelTab = 'narrative' | 'shots'`;
- `userActiveTab` is local React state;
- `shotId` forces the effective tab to `shots`;
- changing the tab calls only `setUserActiveTab`.

Because this is local state, the selected top-level tab is lost across route
changes, reloads, and focus events.

### Shot-Detail Tabs

The shot-detail tabs are owned by:

- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`

Important current behavior:

- `DESIGN_TABS` defines the public tab values;
- `LineTabs` is rendered with `defaultValue='description'`;
- `SceneShotDetail` is rendered below the selected shot;
- `ShotSpecsProvider` is keyed by `shot.shotId` so shot specs state resets when
  the selected shot changes.

Because `LineTabs` is uncontrolled and defaults to `description`, switching
shots returns the detail panel to `Description`.

### Shot Selection

The shot rail selection is owned by:

- `packages/studio/src/features/movie-studio/scenes/scene-shots-tab.tsx`

Important current behavior:

- `userSelectedShotId` is local React state;
- selection falls back to the `shotId` route query parameter;
- selection falls back again to the first shot;
- clicking a rail row only calls `setUserSelectedShotId`;
- the route is not updated when the user clicks another shot in the rail.

The existing URL support for `shot` is useful for deep links and focus requests,
but the current rail click path does not yet use it.

### Studio Coordination And CLI Current

Studio focus/current state is owned by:

- `packages/studio/src/app/use-studio-coordination.ts`
- `packages/studio/src/services/studio-current-contracts.ts`
- `packages/studio/server/routes/studio-events.ts`
- `packages/core/src/server/studio-coordination/events.ts`
- `packages/core/src/server/studio-coordination/event-validation.ts`
- `packages/core/src/server/studio-coordination/focus-validation.ts`
- `packages/core/src/server/studio-coordination/current-projection.ts`
- `packages/cli/src/commands/studio-current-command.ts`

The browser reports focus by sending a `studio.focusChanged` event containing:

```ts
{
  screen: 'movieStudio',
  selection
}
```

The CLI command:

```text
renku studio current --json
```

reads `StudioCurrent` from the coordination service and prints it.

Today, `current-projection.ts` enriches a scene focus from `readProject()`.
That can return the scene and parent sequence, but it does not include active
shot-list details or structured shot specs. To report tab-internal selections
such as `Medium Close-Up` or `Single`, current-focus enrichment must read the
active scene shot list when the current focus is a scene on the `Shots` surface.

## Desired Route Contract

Scene routes should remain path-based with query parameters for scene-local UI
state:

```text
/projects/:projectName/scenes/:sceneId
/projects/:projectName/scenes/:sceneId?sceneTab=shots
/projects/:projectName/scenes/:sceneId?sceneTab=shots&shot=:shotId
/projects/:projectName/scenes/:sceneId?sceneTab=shots&shot=:shotId&shotTab=composition
```

### Query Parameters

Use these exact query parameter names:

| Parameter | Values | Meaning |
|-----------|--------|---------|
| `sceneTab` | `narrative`, `shots` | selected top-level scene tab |
| `shot` | shot id | selected shot in the active scene shot list |
| `shotTab` | `description`, `lookbook`, `composition`, `motion`, `cast`, `location`, `references`, `ai-production` | selected shot-detail tab |

`sceneTab` and `shotTab` are deliberate route-level names. Avoid a generic
`tab` parameter because this scene surface has two tab levels.

### Canonical Defaults

The canonical default scene route is:

```text
/projects/:projectName/scenes/:sceneId
```

It means:

```ts
{
  type: 'scene',
  id: sceneId,
  sceneTab: 'narrative'
}
```

Default values may be omitted from the URL when building routes:

- omit `sceneTab=narrative`;
- omit `shotTab=description`;
- omit `shot` when no explicit shot has been selected.

This is a route canonicalization rule, not a compatibility alias. It keeps URLs
short while preserving one current meaning for omitted tab state.

### Implied Shots Surface

If either `shot` or `shotTab` is present, the scene selection should be treated
as the `Shots` surface.

Examples:

```text
/projects/urban-basilica/scenes/scene_djkfgf9p?shot=shot_003
```

means:

```ts
{
  type: 'scene',
  id: 'scene_djkfgf9p',
  sceneTab: 'shots',
  shotId: 'shot_003'
}
```

```text
/projects/urban-basilica/scenes/scene_djkfgf9p?shotTab=composition
```

means:

```ts
{
  type: 'scene',
  id: 'scene_djkfgf9p',
  sceneTab: 'shots',
  shotTab: 'composition'
}
```

When route building writes a `shot` or `shotTab`, it must also write
`sceneTab=shots`. This keeps every shot-detail URL readable and avoids making
callers infer the active top-level tab from a lower-level parameter.

### Invalid Route Values

Unsupported query values should fail fast:

- unknown `sceneTab` values make the route invalid;
- unknown `shotTab` values make the route invalid;
- a `shot` value is valid only when the scene's active shot list contains that
  shot;
- a `shotTab` value is valid only for scene selections on the `Shots` surface.

The browser route loader can keep using its existing `routeError` path for
malformed route state. The Studio server/core focus validation path should
return structured diagnostics.

## Desired Selection Contract

Extend the scene selection in both Studio browser and core/server contracts:

```ts
export type ScenePanelTab = 'narrative' | 'shots';

export type SceneShotDetailTab =
  | 'description'
  | 'lookbook'
  | 'composition'
  | 'motion'
  | 'cast'
  | 'location'
  | 'references'
  | 'ai-production';

export type StudioSelection =
  // existing cases...
  | {
      type: 'scene';
      id: string;
      sceneTab?: ScenePanelTab;
      shotId?: string;
      shotTab?: SceneShotDetailTab;
    };
```

Rules:

- `sceneTab` defaults to `narrative` when absent.
- `shotTab` defaults to `description` when the effective `sceneTab` is `shots`.
- `shotId` still points at a shot id, not a production group id.
- `shotTab` should not be accepted for non-scene selections.
- `shotTab` should not be accepted independently on other surfaces.

The same public values should be used in:

- browser route parser/builder;
- browser `StudioSelection`;
- core/server `StudioSelection`;
- Studio event validation;
- Studio focus request validation;
- CLI JSON output.

Do not add aliases such as `camera-framing`, `aiProduction`, or `shot-design`.

## Desired UI Behavior

### ScenePanel

`ScenePanel` should become controlled by route selection rather than local tab
memory.

Expected behavior:

- opening `/projects/:p/scenes/:scene` shows `Narrative`;
- clicking `Shots` pushes a route with `sceneTab=shots`;
- clicking `Narrative` pushes the scene route without shot-detail params;
- a scene selection with `shotId` or `shotTab` opens `Shots`;
- browser back/forward moves between `Narrative` and `Shots`.

Implementation direction:

- pass the full scene selection, or explicit `sceneTab`/`shotTab` fields, from
  `MovieStudioScreen` into `ScenePanel`;
- replace `userActiveTab` with the effective tab from selection;
- call `onSelect` with an updated scene selection from `onValueChange`;
- keep using local `LineTabs`; do not add raw controls.

### SceneShotsTab

`SceneShotsTab` should update route selection when the user changes shot rows.

Expected behavior:

- if the user opens `Composition` on Shot 3 and clicks Shot 4, the UI stays on
  `Composition`;
- the URL updates to the new shot id and current `shotTab`;
- browser back returns to the previous shot and tab state;
- a direct `shot` URL still pre-selects that shot;
- if the URL references a missing shot, route validation fails instead of
  silently selecting the first shot.

Implementation direction:

- pass the current `sceneSelection` or a focused route update callback into
  `SceneShotsTab`;
- remove or reduce `userSelectedShotId` so route state becomes the owner of
  explicit shot selection;
- keep the existing first-shot fallback only for rendering when no explicit
  `shotId` exists;
- do not write that fallback shot id into the URL automatically on first render;
- clicking a shot row should call `onSelect` with:

```ts
{
  type: 'scene',
  id: sceneId,
  sceneTab: 'shots',
  shotId: clickedShotId,
  shotTab: currentShotTab
}
```

### SceneShotDetail

`SceneShotDetail` should become controlled by the route-selected shot-detail
tab.

Expected behavior:

- if `shotTab` is absent, the detail surface shows `Description`;
- clicking a shot-detail tab updates the route query parameter;
- switching shots preserves the current `shotTab`;
- browser back/forward moves between shot-detail tabs;
- `ShotSpecsProvider` remains keyed by `shot.shotId` so shot specs editing
  state still resets correctly when the shot changes.

Implementation direction:

- export or colocate a typed `SCENE_SHOT_DETAIL_TABS` constant;
- render `LineTabs` with `value={activeShotTab}` instead of
  `defaultValue='description'`;
- update `LineTabs` through the existing shadcn/Radix `onValueChange`;
- call a provided `onShotTabChange` callback that updates the route selection.

### Grouping Drafts

Shot rail grouping edit mode from `0047` should remain local draft state.

The grouping draft is not a tab selection and should not enter the URL. If the
user switches shots or shot-detail tabs while a grouping draft is active, the
existing grouping draft behavior should remain unchanged unless the future
implementation finds a concrete data-loss issue.

## Desired Studio Current Context

Extend `StudioCurrentContext` for scene focus so agents can understand the
visible shot surface.

Proposed shape:

```ts
export type StudioCurrentContext =
  // existing cases...
  | {
      kind: 'scene';
      id: string;
      title: string;
      summary?: string;
      parentSequence: {
        id: string;
        number: number;
        title: string;
        summary?: string;
      };
      sceneTab: {
        id: ScenePanelTab;
        label: 'Narrative' | 'Shots';
      };
      shot?: StudioCurrentShotContext;
    };

export interface StudioCurrentShotContext {
  id: string;
  index: number;
  label: string; // "Shot 3"
  title: string;
  activeTab: {
    id: SceneShotDetailTab;
    label: string;
  };
  currentTabSelections: StudioCurrentShotTabSelections;
}
```

`currentTabSelections` should describe only the active shot-detail tab.

For `composition`, use labels from
`packages/core/src/client/shot-spec-labels.ts`:

```ts
{
  kind: 'composition';
  shotSize?: { id: ShotSizeId; label: string };
  subjectFraming: { id: SubjectFramingId; label: string }[];
  cameraAngle?: { id: CameraAngleId; label: string };
  dutch?: 'left' | 'right';
  lens?: {
    type?: { id: LensId; label: string };
    millimeters?: number;
    focus?: { id: FocusId; label: string };
  };
  customComposition?: string;
}
```

For `motion`, report the selected movement, secondary movement, directions,
track, rig, and custom motion using existing labels.

For `location`, report the selected shot location reference when present and
the visible location ids/names from the shot resource or production plan if
available. If only the shot's screenplay location ids are available, report
those rather than guessing a selected location sheet.

For `cast`, report selected cast ids/names from the shot specs override when
present, otherwise from `SceneShot.castMemberIds`.

For `lookbook`, `references`, and `ai-production`, start with a compact
structured summary that is truthful with available resource data:

- active tab id and label;
- shot id, label, and title;
- selected production group id and shot ids when available;
- available diagnostics when enrichment cannot load the active shot list.

Do not invent product copy for missing selections. If a tab has no meaningful
selected values, return an empty array or omit the optional field.

## Current-Focus Enrichment Rules

`packages/core/src/server/studio-coordination/current-projection.ts` should keep
using `readProject()` for the project and scene hierarchy, but add a focused
shot-list read only for scene selections that need shot detail:

- effective `sceneTab` is `shots`;
- `shotId` is present; or
- `shotTab` is present.

The enrichment path should:

1. read the active scene shot list through the existing project data service;
2. find the selected shot by `shotId`, or use the first shot only when no
   explicit shot id is in the selection;
3. if the explicit `shotId` is missing, return structured diagnostics and no
   `shot` context;
4. derive labels from shared core label maps, not from Studio UI constants;
5. include warnings when shot-list enrichment fails after the scene itself was
   found.

This keeps `renku studio current --json` useful even when the browser is focused
on a shot tab.

## Focus Request Validation

Update focus validation in:

- `packages/core/src/server/studio-coordination/focus-validation.ts`
- `packages/core/src/server/studio-coordination/event-validation.ts`
- `packages/studio/server/routes/studio-events.ts`
- `packages/studio/server/http/movie-studio-selection-request.ts`

Validation should check:

- supported `sceneTab` values;
- supported `shotTab` values;
- `shotTab` is used only for scene selections;
- explicit `shotId` exists in the active scene shot list;
- `shotTab` without `shotId` is allowed, because the UI can show the first shot
  on that tab;
- scene selections without shot state still validate through the existing scene
  check.

Use these structured diagnostics for invalid focus requests:

- `STUDIO_COORDINATION036` for unsupported scene tab;
- `STUDIO_COORDINATION037` for unsupported shot-detail tab;
- `STUDIO_COORDINATION038` for a missing shot id in a scene focus request.

## CLI Behavior

`renku studio current --json` should return the new selection and context fields
without needing a new command.

Example output fragment:

```json
{
  "selection": {
    "type": "scene",
    "id": "scene_djkfgf9p",
    "sceneTab": "shots",
    "shotId": "shot_003",
    "shotTab": "composition"
  },
  "context": {
    "kind": "scene",
    "sceneTab": {
      "id": "shots",
      "label": "Shots"
    },
    "shot": {
      "id": "shot_003",
      "index": 2,
      "label": "Shot 3",
      "title": "Urban reads the metal",
      "activeTab": {
        "id": "composition",
        "label": "Composition"
      },
      "currentTabSelections": {
        "kind": "composition",
        "shotSize": {
          "id": "medium-close-up",
          "label": "Medium Close-Up"
        },
        "subjectFraming": [
          {
            "id": "single",
            "label": "Single"
          }
        ],
        "cameraAngle": {
          "id": "low-angle",
          "label": "Low Angle"
        }
      }
    }
  }
}
```

The non-JSON `renku studio current` output can remain compact, but should include
the active scene and tab when available, for example:

```text
Current Studio project: urban-basilica
Focus: Scene Bombardment > Shots > Shot 3 > Composition
```

Do not add a separate `renku studio focus` command in this slice unless it
already exists by the time implementation starts. Existing commands that append
`studio.focusRequested` events should be able to include the new selection
fields when their workflows need to target a scene tab.

## Testing Strategy

### Browser Route Tests

Update `packages/studio/src/app/app.test.tsx`.

Cover:

- direct scene route defaults to `Narrative`;
- `?sceneTab=shots` opens `Shots`;
- `?sceneTab=shots&shot=shot_002` selects the requested shot;
- `?sceneTab=shots&shot=shot_002&shotTab=composition` opens Composition;
- `popstate` moves between `Narrative`, `Shots`, and shot-detail tabs.

### Scene UI Tests

Update:

- `packages/studio/src/features/movie-studio/scenes/scene-panel.test.tsx`
  if a focused test exists or add one if needed;
- `packages/studio/src/features/movie-studio/scenes/scene-shots-tab.test.tsx`;
- `packages/studio/src/features/movie-studio/scenes/scene-shot-specs-tabs.test.tsx`.

Cover:

- clicking the top-level `Shots` tab calls the route update callback;
- clicking `Narrative` calls the route update callback and drops shot-detail
  query state;
- clicking a rail shot preserves the active shot-detail tab;
- clicking a shot-detail tab calls the route update callback;
- switching shots no longer returns the active shot-detail tab to
  `Description`;
- shot-spec tile selections still save through the existing autosave path and
  do not alter the route.

### Coordination Tests

Update:

- `packages/core/src/server/studio-coordination/focus-validation.test.ts`;
- `packages/core/src/server/studio-coordination/service.test.ts`;
- `packages/studio/server/routes/studio-events.test.ts`;
- `packages/cli/src/cli.test.ts`.

Cover:

- focus events accept a scene selection with `sceneTab` and `shotTab`;
- invalid `sceneTab` is rejected with structured diagnostics;
- invalid `shotTab` is rejected with structured diagnostics;
- missing explicit `shotId` is rejected when validating against a project with
  an active shot list;
- `readStudioCurrent()` returns the active tab and current tab selection labels
  for a composition-focused scene shot;
- `renku studio current --json` includes `selection.sceneTab`,
  `selection.shotTab`, and `context.shot.currentTabSelections`.

### Focused Verification Commands

Use focused package commands first:

```bash
pnpm --dir packages/studio test
pnpm --dir packages/core test
pnpm --dir packages/cli test
```

Before final implementation is called complete, run root verification:

```bash
pnpm lint
pnpm test
pnpm check
```

## Implementation Notes

- Keep all feature controls on local shadcn-style primitives. This work should
  only change how existing `LineTabs` are controlled.
- Keep route helpers inside the current route-owning module unless a focused
  module is genuinely needed. Do not add a re-export stub.
- Prefer literal union constants for tab ids so route parsing, UI tabs, and
  validation share one deliberate vocabulary.
- Do not pull Studio UI files into core. Core can own the tab id union and label
  maps if they are part of the focus/current contract.
- Use existing shot-spec label maps for selected values.
- Keep route updates explicit; do not mutate `window.history` from deeply nested
  components.
- Preserve the current resource refresh behavior in `SceneShotsTab`.

## Completion Checklist

### Review Area

- [x] Confirm this plan is accepted as the current direction for scene and shot
      tab state.
- [x] Confirm the public URL parameter names: `sceneTab`, `shot`, and
      `shotTab`.
- [x] Confirm the public tab values exactly match current UI values:
      `narrative`, `shots`, `description`, `lookbook`, `composition`, `motion`,
      `cast`, `location`, `references`, `ai-production`.
- [x] Confirm tab-internal selections remain out of URL and browser history.
- [x] Confirm browser history should include shot rail selection changes.

### Architecture And Contracts

- [x] Add shared scene tab and shot-detail tab union types in the owning
      contract location.
- [x] Extend browser `StudioSelection` scene shape with `sceneTab` and
      `shotTab`.
- [x] Extend core/server `StudioSelection` scene shape with `sceneTab` and
      `shotTab`.
- [x] Extend Studio current scene context with `sceneTab`, optional `shot`, and
      `currentTabSelections`.
- [x] Add or update tab label maps for CLI/current output.
- [x] Keep label maps domain-owned and avoid importing Studio UI modules from
      core.

### Browser Routing

- [x] Update `readStudioRoute()` to parse `sceneTab`, `shot`, and `shotTab`.
- [x] Update `studioSelectionRoutePath()` to write canonical scene query
      parameters.
- [x] Update `studioSelectionKey()` behavior if needed so tab changes report
      focus changes.
- [x] Reject unsupported `sceneTab` and `shotTab` values through the existing
      route error path.
- [x] Preserve existing project, cast, location, visual-language, act, sequence,
      and scene base routes.
- [x] Confirm browser `popstate` restores the scene and shot tabs.

### Studio UI

- [x] Make `ScenePanel` controlled by route tab state.
- [x] Make top-level `Narrative`/`Shots` clicks call `onSelect` with a new scene
      selection.
- [x] Pass route-selected `sceneTab` and `shotTab` from `MovieStudioScreen` into
      scene components.
- [x] Make `SceneShotsTab` use route state for explicit shot selection.
- [x] Make rail row clicks update route state and preserve current `shotTab`.
- [x] Keep first-shot fallback render-only when no explicit shot is selected.
- [x] Make `SceneShotDetail` controlled by `shotTab`.
- [x] Make shot-detail tab clicks update route state.
- [x] Confirm `ShotSpecsProvider` remains keyed by `shot.shotId`.
- [x] Confirm shot-spec selection changes do not update the URL.
- [x] Confirm grouping draft state remains local and unaffected by tab route
      updates.

### Studio Coordination

- [x] Update Studio event validation for scene tab and shot-detail tab fields.
- [x] Update Studio server focus-request reading to preserve `shotId`,
      `sceneTab`, and `shotTab`.
- [x] Update movie-studio selection context request parsing to preserve tab
      fields.
- [x] Update focus request validation for invalid tab ids and missing explicit
      shot ids.
- [x] Update current-focus projection to read active scene shot-list details
      when the effective scene tab is `Shots`.
- [x] Return composition selection labels from `ShotSpecs` using shared label
      maps.
- [x] Return motion selection labels from `ShotSpecs` using shared label maps.
- [x] Return cast/location/reference/AI Production summaries only when data is
      actually available.
- [x] Include structured diagnostics when shot-list enrichment fails.

### CLI

- [x] Update `renku studio current --json` snapshots/expectations for the new
      selection and context fields.
- [x] Improve non-JSON `renku studio current` output to include active scene tab
      and shot tab when available.
- [x] Update any command that appends a scene `studio.focusRequested` event if
      it needs to target a scene tab in the current workflow.
- [x] Do not add new compatibility command names or aliases.

### Tests

- [x] Add browser route tests for scene tab query parameters.
- [x] Add browser route tests for shot-detail tab query parameters.
- [x] Add browser history tests for top-level and shot-detail tab changes.
- [x] Add UI tests proving the shot-detail tab is preserved across shot rail
      selection.
- [x] Add UI tests proving tile selections do not change the URL.
- [x] Add core focus-validation tests for valid scene tab focus.
- [x] Add core focus-validation tests for invalid `sceneTab`.
- [x] Add core focus-validation tests for invalid `shotTab`.
- [x] Add current-projection tests for composition selection summaries.
- [x] Add Studio server route tests for focus request parsing/validation.
- [x] Add CLI tests for `renku studio current --json` and non-JSON output.

### Documentation

- [x] Update `docs/architecture/reference/studio-coordination-events.md` with
      the scene tab and shot-detail tab focus fields.
- [x] Confirm no `front-end-guidelines.md` update is needed because this change
      follows the existing route-state pattern instead of introducing a new one.
- [x] Add a short note to the final implementation summary explaining why
      tab-internal selections are not in the URL.

### Final Verification

- [x] Run `pnpm --dir packages/studio test`.
- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --dir packages/cli test`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm check`.
- [x] Manually verify on desktop that:
      - `Narrative`/`Shots` survive reload through the URL;
      - `Composition` survives switching from Shot 3 to Shot 4;
      - browser back/forward walks through tab and shot changes;
      - changing `Medium Close-Up`, `Single`, or another tile does not change
        the URL;
      - `renku studio current --json` reports the active tab and current
        tab-selection labels.

### Completion Notes

- Desktop browser verification was performed against
  `localhost:5173/projects/urban-basilica/scenes/scene_djkfgf9p`.
- The live manual `renku studio current --json` read was affected by another
  active Chrome Studio session changing focus at the same time; the coordination
  event tail confirmed this implementation emitted `sceneTab`, `shotId`, and
  `shotTab` for the tested scene, and the CLI test suite now covers the isolated
  JSON and non-JSON current-output contract.
- Tab-internal selections stay out of the URL because they are persisted project
  data, can be multi-select, and would create noisy browser history entries if
  represented as query parameters.
