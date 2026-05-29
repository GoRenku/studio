# 0031 Story Arc Analysis Visualization UI

Date: 2026-05-28

Status: implemented

## Goal

Replace the current text-only Story Arc surface with a lean visualization that
renders the active Screenplay Analysis from
`plans/active/0030-screenplay-analysis-cli-and-skill.md`.

The v1 UI should:

- keep the page display-only;
- show a clean three-act dramatic arc chart;
- render the default criteria lines:
  - Dramatic Energy;
  - Stakes;
  - Character Agency;
- show critical screenplay points such as Hook, Inciting Incident, First Turn,
  Midpoint, Crisis, Climax, and Resolution;
- provide a scalable scene rail below the chart;
- show useful hover summaries for scenes;
- open a dialog when a scene is selected so the user can read evidence-backed
  critique in more detail.

The UI must not include AI chat controls, agent input boxes, export actions,
diagnosis sidebars, tabs, thumbnails, fake timing, page counts, runtime, or
post-production concepts.

## References

- `docs/product/design-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/architecture/reference/studio-server-hono.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`
- `docs/decisions/0023-use-domain-neutral-ui-primitives-for-shared-frontend-patterns.md`
- `plans/active/0029-location-surfaces-ui-redesign.md`
- `plans/active/0030-screenplay-analysis-cli-and-skill.md`

## Dependency

This plan depends on the data, CLI, and core resource work from plan `0030`.

The UI can be implemented after core exposes a Story Arc resource that includes:

- screenplay title and lead text;
- acts, sequences, and scenes in order;
- the active Screenplay Analysis document, or `null` when no active analysis
  exists.

The resource must not expose the removed `screenplay.storyArc` field.

## Current Baseline

The current `StoryArcPanel` lives at:

```text
packages/studio/src/features/movie-studio/story-arc/story-arc-panel.tsx
```

It reads:

```text
GET /studio-api/projects/:projectName/screenplay/story-arc
```

and renders:

- screenplay title and lead text;
- acts as cards;
- sequence titles as list items;
- sequence and scene counts.

That baseline is useful as a data-loading shell, but the page is visually flat
and does not make the story structure inspectable.

## Product Decisions

### Display Only

This page visualizes analysis. It does not communicate with agents directly.

Do not add:

- chat input;
- "Ask AI" buttons;
- agent controls;
- apply buttons;
- export buttons;
- analysis generation buttons.

Agents act through Codex and the Renku CLI. The browser reads saved project
data.

### No Tabs

The Story Arc page should have one focused surface.

Do not add tabs such as Beats, Scenes, Diagnosis, Revisions, or Notes. The
selected sidebar item already defines the page.

### Scene Rail Instead Of Thumbnail Strip

The screenplay may not have generated images yet, so the bottom area must not
depend on thumbnails or placeholders.

Use a compact scene rail:

- every scene is a small proportional block;
- blocks are grouped by act and sequence;
- sequence labels are not always visible;
- hover reveals the scene title, sequence title, act, synopsis, beat role, and
  current concern when analysis exists;
- click opens a detail dialog.

This keeps the rail scalable when a project has many scenes.

### Three-Act Model For V1

The v1 UI renders `structureModel: "threeAct"`.

It should not hard-code the visual code in a way that prevents future act
models, but it also should not implement generic structure-model switching in
this slice. The core resource can expose `structureModel`, and the UI can fail
with a clear unsupported-state message if a future model appears before the UI
supports it.

### Analysis Evidence Matters

The dialog should provide enough information for the user or a later agent to
act:

- scene synopsis;
- criterion scores;
- critique summary;
- strengths;
- concerns;
- evidence;
- suggestions;
- related suggested scene additions when relevant.

The dialog should not become an editor. Applying suggestions remains a separate
agent or screenplay operation workflow.

## Story Arc Resource Contract

Extend the browser-safe `StoryArcResource` from:

```text
packages/core/src/client/resources.ts
```

The resource should stay compact. It should include scene order and analysis
summaries, but not full block text.

Suggested shape:

```ts
export interface StoryArcResource {
  screenplay: Pick<
    Screenplay,
    | 'title'
    | 'logline'
    | 'dramaticQuestion'
    | 'premiseOverview'
    | 'centralConflict'
    | 'summary'
  >;
  acts: StoryArcActResource[];
  activeAnalysis: ScreenplayAnalysisDocument | null;
}

export interface StoryArcActResource extends ActNavigationRow {
  sequences: StoryArcSequenceResource[];
}

export interface StoryArcSequenceResource extends SequenceNavigationRow {
  scenes: StoryArcSceneResource[];
}

export interface StoryArcSceneResource {
  id: string;
  sequenceId: string;
  title: string;
  storyFunction?: string[];
}
```

Implementation notes:

- Do not include scene blocks in this resource. The analysis already stores the
  evidence text it needs for display.
- Continue exposing full scene narrative through the existing scene resource.
- Validate stored analysis JSON before returning it.
- Return `activeAnalysis: null` when no analysis exists yet.
- Keep the resource compatible with scoped refresh key `surface:story-arc`.
- Do not keep or reintroduce `screenplay.storyArc` as browser resource data.

## Route And Service Work

Keep the current route:

```text
/studio-api/projects/:projectName/screenplay/story-arc
```

Update server adapter contracts and browser services:

```text
packages/studio/src/services/studio-screenplay-api.ts
packages/studio/src/services/studio-project-contracts.ts
packages/core/src/server/resources/screenplay-ui.ts
packages/core/src/server/project-data-service-contracts.ts
```

The frontend service should remain a resource reader:

```ts
readStoryArcResource(projectName)
```

Do not add browser mutation APIs for this feature.

## UI Architecture

Keep the feature under:

```text
packages/studio/src/features/movie-studio/story-arc/
```

Suggested files:

```text
story-arc-panel.tsx
story-arc-chart.tsx
story-arc-chart-model.ts
story-arc-scene-rail.tsx
story-arc-scene-analysis-dialog.tsx
story-arc-empty-analysis.tsx
story-arc-panel.test.tsx
```

Responsibilities:

- `story-arc-panel.tsx`
  - loads the resource;
  - handles loading and error states;
  - composes the header, chart, rail, and dialog;
  - listens for `surface:story-arc` invalidation through existing Studio
    resource refresh mechanisms.

- `story-arc-chart-model.ts`
  - converts ordered acts, sequences, scenes, and active analysis into chart
    points;
  - maps scene order to x positions;
  - maps `0` to `100` scores to y positions;
  - extracts default criteria only for v1 chart rendering;
  - finds key beat markers.

- `story-arc-chart.tsx`
  - renders the three-act chart;
  - draws three criterion lines;
  - draws key beat markers;
  - renders a minimal legend.

- `story-arc-scene-rail.tsx`
  - renders compact scene blocks grouped by act and sequence;
  - shows hover tooltips;
  - uses local shadcn `Button` for clickable scene blocks, not raw `<button>`;
  - uses local shadcn `Tooltip`, not custom browser title attributes.

- `story-arc-scene-analysis-dialog.tsx`
  - uses local shadcn `Dialog`;
  - shows the selected scene's saved analysis;
  - shows evidence and suggestions;
  - does not edit or apply anything.

- `story-arc-empty-analysis.tsx`
  - explains that no screenplay analysis has been saved yet;
  - keeps the visual quiet;
  - should not include an in-app command line or AI prompt box.

## Visual Design

Follow `docs/product/design-guidelines.md`.

Required visual qualities:

- dark neutral gray surface hierarchy;
- warm amber as the primary story-energy line and selected state;
- compact Montserrat-style text;
- `text-[11px] uppercase tracking-[0.12em] font-semibold` section labels;
- soft borders, usually `border-border/40`;
- major panel radius using the existing panel radius;
- subtle card elevation by background level, not heavy shadows;
- no decorative orbs, hero art, or marketing composition.

Main panel structure:

```text
Header
  STORY ARC
  Basilica
  one short lead paragraph

Visualization
  three-act chart
  key beat markers
  three criterion lines
  compact legend

Scene rail
  scene blocks grouped by act and sequence
  hover summary
  click opens dialog
```

Do not show:

- tabs;
- scene thumbnails;
- raw filenames;
- asset ids;
- generated role names;
- page counts;
- timestamps;
- durations;
- runtime;
- fake cost numbers;
- "Normalize" toggles;
- export controls;
- AI diagnosis panes.

## Chart Behavior

The chart renders the default criteria only:

```text
dramaticEnergy -> amber
stakes -> muted blue-gray
characterAgency -> muted green-gray
```

The analysis schema can include additional criteria. V1 chart code should keep
those available in dialog details but not render every extra criterion in the
main chart.

X-axis:

- based on screenplay scene order;
- grouped into three act regions;
- sequence boundaries are subtle dividers;
- key beat markers attach to the referenced scene when present;
- if a key beat references only a sequence or act, place it at the midpoint of
  that sequence or act and show a muted "not scene-specific" state.

Y-axis:

- maps score `0` to low and `100` to high;
- labels can be minimal: Low, Mid, High;
- avoid large numeric axes unless they improve readability.

Line rendering:

- use SVG or CSS-supported drawing inside React;
- lines should be thin and calm;
- avoid chart libraries unless the implementation proves the custom SVG is
  becoming fragile;
- if a chart library is introduced, it must be justified by real complexity and
  match the design system without extra visual noise.

## Scene Rail Behavior

The scene rail appears below the chart.

Rules:

- one block per scene;
- grouped under act regions;
- sequence boundaries appear as subtle gaps or divider ticks;
- selected scene block uses amber border/fill;
- hover tooltip shows concise analysis;
- click opens dialog.

Tooltip content:

```text
Scene title
Act / Sequence
Synopsis
Beat role
Current concern
```

Use values from the active analysis when present. If no scene analysis exists
for that scene, fall back to scene title and story function, and show a quiet
"No analysis saved for this scene" message.

The rail should still render when no active analysis exists, using screenplay
structure only.

## Scene Analysis Dialog

Use local shadcn `Dialog`.

Dialog content:

- scene title;
- act and sequence placement;
- synopsis;
- beat role when present;
- visible scores for default criteria;
- additional criteria in a quiet secondary section when present;
- critique summary;
- strengths;
- concerns;
- evidence;
- suggestions;
- related suggested scene additions.

No mutation controls in v1.

Acceptable dialog actions:

- close;
- possibly copy text later, but not in this slice.

Do not add Apply, Rewrite, Ask AI, Export, or Generate controls.

## Empty And Partial States

### No Screenplay

Use the existing screenplay no-data behavior. Do not design a new screenplay
creation flow here.

### No Active Analysis

Render:

- title and lead text;
- act divisions;
- scene rail from screenplay structure;
- a quiet empty-state message that analysis has not been saved.

The message should not include a visible CLI recipe or agent prompt. The user is
already interacting through Codex.

### Partial Analysis

If some scenes have no analysis:

- chart points can be interpolated only when adjacent scene scores exist;
- missing points should not be silently scored as `0`;
- tooltip should say no analysis is saved for that scene;
- dialog should show screenplay context and no-analysis state.

If the active analysis fails validation on read, core should fail fast with a
structured project-data error. The browser should render the existing error
state rather than guessing around malformed data.

## Studio Refresh

The UI should refresh this resource when Studio receives:

```text
surface:story-arc
screenplay-analysis
```

If a specific key such as `screenplay-analysis:<analysisId>` is present, the
page may treat it as matching only when that analysis is active, but the first
implementation can simply refresh the Story Arc resource for all screenplay
analysis resource changes.

The UI must not read the Studio coordination event store directly. It should use
the existing Studio resource refresh mechanism.

## Accessibility

Scene rail blocks are interactive controls.

Because feature code may not use raw HTML controls, implement them with local
shadcn `Button`.

Each scene block should have an accessible label:

```text
Open analysis for scene: <scene title>
```

Key beat markers should be readable with assistive technology, either as
semantic text near the marker or through labelled elements.

The chart should include a short accessible summary of the active analysis, for
example:

```text
Dramatic Energy rises from Act I to the Midpoint, dips near Crisis, and peaks at
Climax.
```

This summary should come from the saved analysis document when possible.

## Tests

Add Studio service and route tests covering:

- Story Arc resource includes active analysis when present;
- Story Arc resource returns `activeAnalysis: null` when no analysis exists;
- Story Arc resource includes ordered scene rows without scene block text;
- invalid stored analysis produces a structured error;
- resource refresh keys cause the Story Arc panel to reload.

Add component tests covering:

- no tabs are rendered;
- no AI/chat/export/normalize controls are rendered;
- default criteria lines are rendered when analysis exists;
- additional criteria do not add extra main chart lines;
- key beat markers render;
- scene rail renders one block per scene;
- hover summary content is available through tooltip behavior;
- selecting a scene opens the analysis dialog;
- dialog shows critique evidence and suggestions;
- no-analysis state is quiet and display-only.

Add desktop browser verification:

- run the Studio dev server;
- open a project with active Screenplay Analysis;
- verify the chart is nonblank;
- verify the scene rail scales across a realistic number of scenes;
- verify hover tooltip placement does not overlap incoherently;
- verify dialog content fits in the desktop viewport;
- verify no mobile-specific work is reported.

## Implementation Checklist

- [x] Extend `StoryArcResource` with ordered scenes and `activeAnalysis`.
- [x] Remove `screenplay.storyArc` from `StoryArcResource`.
- [x] Update core Story Arc resource reads to include scene rows without block
      text.
- [x] Validate active analysis JSON on resource read.
- [x] Update Studio server route response typing.
- [x] Update frontend service contracts.
- [x] Replace the current text-card Story Arc panel with the visualization
      shell.
- [x] Add chart model projection code.
- [x] Add the three-act chart component.
- [x] Add key beat markers.
- [x] Add the compact scene rail.
- [x] Use local shadcn `Button` for interactive scene blocks.
- [x] Use local shadcn `Tooltip` for hover summaries.
- [x] Add the scene analysis dialog with local shadcn `Dialog`.
- [x] Add quiet no-analysis and partial-analysis states.
- [x] Wire resource refresh for `surface:story-arc` and screenplay analysis
      changes.
- [x] Add route/service tests.
- [x] Add Story Arc component tests.
- [x] Run `pnpm test:studio`.
- [x] Run `pnpm lint:studio`.
- [x] Run `pnpm build:studio`.
- [x] Verify in Browser at a desktop viewport.
- [x] Confirm there are no raw form or interactive controls in feature code.
- [x] Confirm there are no tabs, AI controls, export controls, fake timings,
      scene thumbnails, or invented metadata on the page.

## Resolved Decisions

- The Story Arc page has no tabs.
- The page is display-only.
- Agent interaction happens through Codex and CLI, not browser UI controls.
- V1 renders the three-act model only.
- V1 renders the default criteria only in the main chart.
- Additional criteria can appear in detail surfaces but should not clutter the
  chart.
- The bottom rail represents scenes, grouped by act and sequence.
- Selecting a scene opens a read-only critique dialog.
