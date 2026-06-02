# 0041 Shot AI Production Studio Server And UI

Date: 2026-06-02

Status: proposed

## Goal

Implement the Studio server adapters and Studio browser UI for shot AI
Production after the core/data/CLI foundation in
`plans/active/0040-shot-video-take-core-cli.md` is available.

This plan covers:

- thin Studio HTTP routes;
- request readers and structured error handling;
- browser service functions;
- shot rail group-selection UX;
- AI Production tab UI;
- intent gating;
- model table;
- run setup;
- preflight dialog;
- autosave and scoped resource refresh;
- React performance rules;
- Studio tests.

This plan deliberately does not implement core data model, core service
methods, CLI behavior, Drizzle migrations, media generation, media import, or
Studio Skill updates. Those belong to Plan 0040.

`plans/active/0039-shot-ai-production-tab.md` remains the broader design draft.
Do not overwrite it while implementing this split.

## References

- `plans/active/0039-shot-ai-production-tab.md`
- `plans/active/0040-shot-video-take-core-cli.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/naming-guidelines.md`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-rail.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shots-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-shot-specs.ts`
- `packages/studio/src/services/studio-screenplay-api.ts`
- `packages/studio/server/routes/screenplay.ts`

## Dependency On Plan 0040

This plan starts after Plan 0040 provides:

- browser-safe shot-video-take contracts;
- `SceneShotListDocument.videoTakeProductionGroups`;
- `ShotVideoTakeGenerationContext`;
- `ShotVideoTakeModelListReport`;
- `ShotVideoTakePreflightReport`;
- `ShotVideoTakeAvailableInput`;
- `ShotVideoTakeProductionGroup`;
- core service methods:
  - `buildShotVideoTakeContext`;
  - `listShotVideoTakeModels`;
  - `listShotVideoTakeInputs`;
  - `updateShotVideoTakeProductionGroup`;
  - `previewShotVideoTakeProduction`;
  - `selectShotVideoTakeInput`;
  - `clearShotVideoTakeInputSelection`;
- scoped resource keys:
  - `scene:<scene-id>`;
  - `surface:scene:<scene-id>:shots`;
  - `scene-shot-list:<shot-list-id>:video-take-production`;
  - `scene-shot-video-take-group:<production-group-id>`;
  - `scene-shot-video-take-input:<input-id>`;
  - `asset:<asset-id>`;
  - `media-generation-spec:<spec-id>`;
  - `media-generation-run:<run-id>`.

The Studio server and UI must call these contracts directly. Do not duplicate
model filtering, production-group validation, dependency planning, spec
construction, estimate logic, or media import rules in Studio code.

## Product Decisions

AI Production appears as a tab in the existing shot-detail lower panel. It does
not redesign the scene Shots layout, shot rail, video stage, timeline,
resizable divider, or generation activity footer.

The browser is a planning and preflight surface. It does not run paid
generation. It shows the plan, lets the user edit choices, opens preflight, and
copies an agent brief.

The browser may let the user choose whether a prerequisite input should be
reused or regenerated. Reuse/regenerate choices are saved through core-owned
production-group and dependency-input operations; the browser still does not
create specs, run models, or attach generated files.

Generation remains an agent/CLI workflow:

1. Studio edits and previews a production group.
2. User asks an external agent to act.
3. Agent uses CLI/core from Plan 0040.
4. Studio refreshes when core emits resource keys.

## Non-Goals

This plan does not:

- add provider adapters;
- add paid generation buttons;
- implement the take-comparison and selected-take review UX beyond showing
  existing take summary in preflight/final-take regions;
- mutate `.renku/project.sqlite` outside core;
- fetch broad project shell data to make this tab work;
- support mobile behavior;
- add raw browser form controls in feature code.

## Studio Server Routes

Add thin routes under the selected project screenplay API.

Read context and models:

```text
GET /screenplay/scenes/:sceneId/video-take-production?shotIds=:shotIds
```

Rules:

- `shotIds` is a comma-separated ordered list;
- omitting `shotIds` is an error;
- the server parses the URL and calls core;
- the server does not synthesize default groups by itself.

Response:

```ts
{
  context: ShotVideoTakeGenerationContext;
  models: ShotVideoTakeModelListReport;
}
```

Autosave production group:

```text
PATCH /screenplay/scenes/:sceneId/video-take-production
```

Request:

```ts
{
  productionGroup: ShotVideoTakeProductionGroup;
}
```

Response:

```ts
{
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}
```

Preview:

```text
POST /screenplay/scenes/:sceneId/video-take-production/preview
```

Request:

```ts
{
  productionGroup: ShotVideoTakeProductionGroup;
}
```

Response:

```ts
{
  preflight: ShotVideoTakePreflightReport;
}
```

The preview route does not run paid generation. It only delegates to core
preflight. Core may create or update concrete dependency specs and final video
specs according to Plan 0040.

Reusable input selection:

```text
POST /screenplay/scenes/:sceneId/video-take-production/inputs/select
```

Request:

```ts
{
  shotIds: string[];
  inputId: string;
}
```

Response:

```ts
{
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}
```

Reusable input clear/regenerate choice:

```text
POST /screenplay/scenes/:sceneId/video-take-production/inputs/clear
```

Request:

```ts
{
  shotIds: string[];
  kind: ShotVideoTakeInputKind;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
}
```

Response:

```ts
{
  resource: SceneShotListResourceResponse;
  resourceKeys: string[];
}
```

The input routes are thin adapters over Plan 0040 core methods. They do not
inspect asset tables, infer model requirements, or generate dependency specs.

## Studio Server Request Readers

Add:

```text
packages/studio/server/http/scene-shot-video-take-production-request.ts
packages/studio/server/http/scene-shot-video-take-input-request.ts
```

The production-group reader must:

- require exactly one top-level field, `productionGroup`;
- reject unknown top-level fields;
- reject malformed non-object JSON;
- delegate deep validation to core;
- return structured Studio server errors through the existing error mechanism.

The reusable-input reader must:

- accept only the exact request shapes listed above;
- reject unknown top-level fields;
- require non-empty `shotIds`;
- require `inputId` for select;
- require `kind` for clear;
- delegate subject-kind and subject-id requirements to core;
- return structured Studio server errors through the existing error mechanism.

Do not add request-reader branches for old field names or compatibility shapes.

## Studio Server Wiring

Extend the selected project data service type used by the Studio server with:

```ts
buildShotVideoTakeContext(input)
listShotVideoTakeModels(input)
updateShotVideoTakeProductionGroup(input)
previewShotVideoTakeProduction(input)
selectShotVideoTakeInput(input)
clearShotVideoTakeInputSelection(input)
```

The route handlers should be shaped like:

```text
parse HTTP request
read project/session inputs
call one core/project-data-service method
serialize returned contract
```

The route handlers must not:

- inspect provider model schemas;
- infer accepted inputs;
- build prompts;
- create media-generation specs;
- estimate costs;
- attach assets;
- change group membership rules.

## Browser Service

Add:

```text
packages/studio/src/services/studio-shot-video-takes-api.ts
```

Functions:

```ts
readShotVideoTakeProduction(projectName, sceneId, shotIds)
updateShotVideoTakeProduction(projectName, sceneId, productionGroup)
previewShotVideoTakeProduction(projectName, sceneId, productionGroup)
selectShotVideoTakeInput(projectName, sceneId, shotIds, inputId)
clearShotVideoTakeInput(projectName, sceneId, shotIds, inputSlot)
```

Rules:

- use resource verbs;
- own endpoint paths, fetch calls, Studio token headers, and API error
  conversion;
- do not call `fetch` from feature components;
- do not name the service `generationClient`, `aiProductionData`, `manager`, or
  other vague names.

## Frontend Files

Feature files live under:

```text
packages/studio/src/features/movie-studio/scenes/
```

Add:

```text
scene-shot-ai-production-tab.tsx
scene-shot-ai-production-intent-list.tsx
scene-shot-ai-production-model-table.tsx
scene-shot-ai-production-run-setup.tsx
scene-shot-ai-production-input-picker.tsx
scene-shot-ai-production-group-strip.tsx
scene-shot-ai-production-group-tag.tsx
scene-shot-video-take-preflight-dialog.tsx
use-shot-video-take-production.ts
shot-video-take-production-projection.ts
shot-video-take-grouping.ts
```

Naming rules:

- use `scene-shot-ai-production-*` for visible tab components;
- use `shot-video-take-*` for persisted domain/projection logic;
- do not add generic `detail`, `manager`, `helper`, `model-matrix`, or
  `ai-production-data` files;
- do not add re-export stubs.

All controls must use local shadcn-style primitives from
`packages/studio/src/ui`. Feature code must not add raw `<button>`, `<input>`,
`<select>`, `<textarea>`, or similar controls.

## Scene Shot Detail Integration

`scene-shot-detail.tsx` adds one tab item:

```ts
{ value: 'ai-production', label: 'AI Production' }
```

The existing lower-panel tab layout remains unchanged.

The tab bar should include a quiet group tag at the far right when the selected
shot belongs to a multi-shot group.

Example tag copy:

```text
GROUP SHOTS 3-4
```

Rules:

- the tag is informational in this slice;
- use meaningful shot labels, not raw shot ids;
- use a local badge or equivalent shadcn-style primitive;
- no generated role names, file names, or asset ids appear on the tag.

## Shot Rail Grouping UX

The shot rail owns multi-shot group selection. This is desktop-only.

Each shot row keeps its normal click behavior for selecting the current shot.
On hover, show a compact group button in the lower-right of the shot card.

Button rules:

- use local `Button`;
- use a lucide grouping/link-style icon;
- include a `Tooltip`;
- keep icon-button dimensions stable;
- do not use raw browser controls.

Group membership rules shown by the button:

- ungrouped shot with no grouped neighbor: click creates a new single-shot
  group; second click removes it;
- ungrouped shot adjacent to one group: click joins that group; second click
  creates a separate single-shot group next to it; third click removes it;
- ungrouped shot between two groups: click joins the group above; second click
  joins the group below; third click removes it;
- grouped shot at an edge: click removes it; next click can join the adjacent
  group or create a separate group according to adjacency;
- grouped shot in the middle of one group: click removes it and splits the
  group into two groups; second click joins the upper group; third click joins
  the lower group;
- grouped shot between two directly adjacent groups never merges both groups in
  one click. It cycles between upper group, lower group, and no group.

Visual feedback:

- all shots in one group share one continuous background rectangle behind their
  rail cards;
- adjacent groups have a visible gap or divider;
- selected shot inside a group uses a stronger tone than the group background;
- hover uses a stronger tone than selected state;
- optional treatment: alternate adjacent group backgrounds with two restrained
  token-based variants.

Pure grouping logic belongs in:

```text
shot-video-take-grouping.ts
```

It owns:

- grouping projection from active shot list plus `videoTakeProductionGroups`;
- adjacency calculation;
- contiguous range detection;
- next-state cycling;
- group splitting;
- stable display labels;
- group background variant selection.

It must not call React hooks, browser services, or fetch APIs.

## AI Production Tab

`SceneShotAiProductionTab` composes:

1. group strip;
2. intent list;
3. model table;
4. run setup;
5. preflight dialog.

The tab reads one production group at a time. If the selected shot is not in a
durable group, the hook may initialize an unsaved single-shot group using the
selected `shotId` and core-provided defaults.

The tab must avoid instructional filler text. The design should stay quiet and
operational.

## Group Strip

`scene-shot-ai-production-group-strip.tsx` shows which shots share the current
AI Production settings.

Rules:

- show meaningful labels such as `Shot 3` and `Shot 4`;
- do not show raw `shotId` values;
- keep the strip compact;
- show only the current group, not all groups in the scene;
- clicking a label may select that shot in the rail/detail surface if the
  surrounding selection API already supports it.

## Intent List

Allowed intent ids come from core contracts:

```text
text-only
first-frame
first-last-frame
reference
multi-shot
audio-to-video
extend-or-edit
```

Intent gating:

- single-shot group: disable `multi-shot`;
- multi-shot group: enable only `multi-shot`;
- disabled single-shot intent tooltip:
  `Multi-shot group selected. Split the group to use this intent.`;
- disabled multi-shot tooltip:
  `Select adjacent shots in the rail to use multi-shot generation.`;
- disabled intents stay visible;
- no dependency counts or badges appear in the intent list.

Core remains the source of truth. If the browser sends an incompatible intent,
core preflight returns diagnostics.

## Model Table

Columns:

```text
Model
Duration
Status
```

Rules:

- rows are selected directly;
- disabled rows remain visible;
- `Status` shows concise schema-derived unavailable reasons, such as
  `No first/last frame` or `No audio input`;
- no Fit, Inputs, Limits, Cost, marketing tags, or subjective quality columns;
- no second model dropdown in Run Setup.

## Run Setup

Run Setup renders controls from the selected core model report.

Rules:

- render only parameters valid for the current model and intent;
- preserve provider parameter names in persisted values;
- normalize visible labels for director readability;
- parameters live in a scrolling list;
- estimate and `Preview Take Plan` live in a fixed footer;
- estimate displays as a number only;
- no explanatory text under the estimate.

Use local shadcn-style controls for:

- selects;
- inputs;
- sliders;
- switches;
- checkboxes;
- textareas;
- buttons;
- tooltips.

## Preview Take Plan Dialog

`Preview Take Plan` calls `previewShotVideoTakeProduction`.

Dialog regions:

1. Prepared Inputs
2. Missing Inputs
3. Cost
4. Prompts
5. Final Take

Actions:

- `Close`
- `Copy Agent Brief`

The dialog shows:

- already available inputs;
- reusable dependency candidates from `preflight.availableInputs`;
- which dependency inputs are currently selected for reuse;
- a quiet `Reuse` versus `Generate new` choice for prerequisite input slots
  that have reusable candidates;
- missing required inputs from `preflight.inputsToCreate`;
- core-provided missing-input reasons verbatim enough for the user to
  understand what blocks final video generation;
- concrete dependency purposes, such as `shot.multi-shot-storyboard-sheet`, when
  core can create that dependency through a shot-video-take input spec;
- required external references without a generation purpose, such as missing
  cast character sheets, location sheets, Lookbook reference images, source
  videos, audio, or arbitrary reference images, as blockers that must be
  selected, imported, or generated through their owning workflow before final
  video generation can proceed;
- generated prompts;
- chosen source assets;
- dependency and final-take estimate lines when exact estimates are available;
- final video-take spec summary.

The dialog must not show:

- status tags such as `planned`, `ready`, or `approved`;
- per-row agent-task buttons;
- input mapping sections;
- reference token mapping sections;
- approval reminder copy;
- generic instructional text.

Missing-input behavior:

- if `preflight.inputsToCreate` is not empty, the dialog shows the Missing
  Inputs region and `preflight.finalTake.canCreateSpec` is false;
- every row uses `outputInputKind`, `subjectKind`, `subjectId`, `mediaKind`, and
  `reason` from core instead of inferring missing dependencies in Studio;
- rows with `purpose` are shown as agent-generatable dependency specs;
- rows without `purpose` are shown as required references that must be satisfied
  by selecting/importing an existing asset or by running the owning production
  workflow first;
- missing cast, location, and Lookbook references are shown with meaningful
  domain names from context when available, never raw ids as the primary label;
- the Final Take region shows why spec creation is blocked when required inputs
  are missing, using the same core dependency reasons rather than separate UI
  validation copy.

Reuse/regenerate controls:

- use local shadcn-style controls such as `Select`, `Button`, `Tooltip`, and
  `Badge`;
- do not show raw asset ids, asset file ids, media-generation run ids, or
  provider field names;
- choosing a reusable candidate calls
  `selectShotVideoTakeInput(projectName, sceneId, shotIds, inputId)`;
- choosing `Generate new` calls
  `clearShotVideoTakeInput(projectName, sceneId, shotIds, inputSlot)`;
- after either action, replace local production-group state with the refreshed
  shot-list resource and rerun preview when the dialog is still open;
- no dependency spec is created by these controls.

`Copy Agent Brief` copies `preflight.agentBrief`. It does not start generation.

## Autosave Hook

`use-shot-video-take-production.ts` owns:

- loading production context and model reports;
- local production group state;
- creating an unsaved single-shot group when needed;
- debounced autosave through `updateShotVideoTakeProduction`;
- selected intent;
- selected model row;
- parameter updates;
- requested input updates;
- reusable dependency input selection;
- reusable dependency regenerate/clear choices;
- preview action state;
- replacing local state with refreshed `SceneShotListResourceResponse` after
  save.

When intent, model choice, or shot membership changes:

- keep the user's visible selected values;
- treat `agentProposal` as stale until core accepts it;
- do not silently delete the proposal in the browser;
- show core diagnostics in preflight.

## Resource Refresh

`SceneShotsTab` and the AI Production hook refresh only when relevant scoped
resource keys arrive:

```text
scene:<scene-id>
surface:scene:<scene-id>:shots
scene-shot-list:<shot-list-id>:video-take-production
scene-shot-video-take-group:<production-group-id>
scene-shot-video-take-input:<input-id>
asset:<asset-id>
media-generation-spec:<spec-id>
media-generation-run:<run-id>
```

Do not expand the project shell or load broad asset maps just to make the tab
feel live.

## React Performance Rules

Apply the React best-practices guidance:

- avoid UI-driven waterfalls by reading production context and model reports
  together through `readShotVideoTakeProduction`;
- keep fetch calls in browser services and feature hooks;
- derive selected production group, selected model report, enabled parameters,
  intent gating, grouped shot labels, and group adjacency during render or in
  pure projection modules;
- build `Map` and `Set` indexes for repeated shot, asset, and model lookups;
- use primitive dependencies in effects;
- use stable callbacks for row selection, group-button cycling, parameter
  updates, and preview actions;
- use functional state updates for group membership transitions;
- use `startTransition` for non-urgent updates after model/intent changes or
  preview refreshes if the tab feels blocked;
- load heavy preview-only media components conditionally if image/video previews
  become expensive;
- do not define inline React components inside tab components;
- keep scoped resource refresh local.

## Implementation Checklist

- [ ] Add Studio server request reader.
- [ ] Add Studio server reusable-input request reader.
- [ ] Add Studio server routes.
- [ ] Extend Studio server project data service type/fake service.
- [ ] Add browser service `studio-shot-video-takes-api.ts`.
- [ ] Add AI Production tab entry in `scene-shot-detail.tsx`.
- [ ] Add group tag in the shot-detail tab bar.
- [ ] Add shot rail group button.
- [ ] Add group background and adjacent-group visual states.
- [ ] Add `shot-video-take-grouping.ts`.
- [ ] Add `shot-video-take-production-projection.ts`.
- [ ] Add `use-shot-video-take-production.ts`.
- [ ] Add group strip component.
- [ ] Add intent list component.
- [ ] Add model table component.
- [ ] Add run setup component.
- [ ] Add reusable input picker component.
- [ ] Add preflight dialog.
- [ ] Wire scoped resource refresh.
- [ ] Add Studio tests.

## Tests

Studio server tests:

- GET route requires `shotIds`;
- GET route calls core/project service and returns context plus model report;
- PATCH route rejects unknown top-level fields;
- PATCH route delegates deep validation to core;
- PATCH route returns refreshed shot-list resource and resource keys;
- preview route returns `ShotVideoTakePreflightReport`;
- input select route delegates to core and returns resource keys;
- input clear route delegates to core and returns resource keys;
- server routes serialize structured errors.

Browser service tests:

- `readShotVideoTakeProduction` builds the correct URL with comma-separated
  shot ids;
- `updateShotVideoTakeProduction` sends `{ productionGroup }`;
- `previewShotVideoTakeProduction` sends `{ productionGroup }`;
- `selectShotVideoTakeInput` sends `shotIds` and `inputId`;
- `clearShotVideoTakeInput` sends `shotIds`, input kind, and optional subject;
- services parse structured API errors.

UI tests:

- AI Production appears inside the existing lower shot tab region;
- Shots layout does not stretch or change;
- shot rail group button appears on hover;
- group button uses local UI controls;
- group selection creates only contiguous groups;
- removing a middle shot splits one group into two groups;
- adjacent groups are visually separated;
- selected shot in a group has stronger tone than group background;
- hover has stronger tone than selected state;
- group tag appears at the far right of the tab bar for multi-shot groups;
- group strip renders meaningful shot labels;
- single-shot group disables `multi-shot` with tooltip;
- multi-shot group disables single-shot intents with tooltip;
- intent list has no dependency counts or badges;
- model table columns are exactly `Model`, `Duration`, and `Status`;
- model table has no Fit, Inputs, Limits, or Cost columns;
- Run Setup has no model dropdown;
- estimate displays as a number only;
- Preview Take Plan opens the dialog;
- dialog shows concrete dependency purposes and cost lines;
- dialog shows reusable dependency input candidates when core returns them;
- dialog lets the user choose reuse or generate new for prerequisite slots;
- choosing reuse calls the reusable input select route;
- choosing generate new calls the reusable input clear route;
- dialog has no status tags, agent-task buttons, input mapping, reference token
  mapping, or approval reminder copy;
- editable choices autosave without a Save Spec action;
- scoped resource events refresh the selected shot group without broad project
  reload.

## Acceptance Criteria

- Studio server routes are thin adapters over core/project data service methods.
- Browser service owns all fetch calls for this feature.
- The AI Production tab is present in the existing shot-detail tab bar.
- The current Shots layout remains unchanged.
- The shot rail supports contiguous production group selection with clear
  visual feedback.
- Multiple production groups can exist in one shot list, including adjacent
  groups.
- The detail tab bar shows the group tag when appropriate.
- Intent availability follows group size.
- The model table and Run Setup render from core reports.
- Preview Take Plan renders core preflight reports and copies the agent brief.
- Preview Take Plan lets users choose whether prerequisite dependency inputs
  should be reused or regenerated, without running generation.
- The UI does not run paid generation.
- Feature code uses local shadcn-style controls only.
- React implementation follows the performance rules above.
