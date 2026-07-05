# 0111 Generation Preview Dialog Redesign

Status: completed
Date: 2026-07-05

## Summary

Redesign the Studio Generation Preview Dialog as a stable, quiet, shared review
surface for `cast.character-sheet`, `shot.video-prompt-sheet`, and
`shot.video-take` previews.

The current dialog exposes too much implementation machinery. It changes size
between tabs, duplicates context in the header, renders prose prompts as code,
shows provider token internals, uses one-off reference cards instead of the
Studio media selection card language, and keeps an always-visible Issues tab
even when there are no diagnostics.

The replacement must be deliberately small:

- one fixed-size dialog frame;
- one simple header line;
- the shared Studio line-tab treatment;
- readable prompt text;
- reference cards that reuse the same media-card and include/exclude controls
  used elsewhere in Studio;
- a compact Config tab that shows only user-relevant generator settings that
  are actually being sent;
- no visible provider token table, provider payload JSON, empty Issues tab,
  revision badge, provider badge stack, or subject metadata clutter.

This plan supersedes the visible dialog direction in the completed
`0099-generation-preview-dialog-and-video-prompt-image-styles.md` plan and the
preview-dialog UI notes in
`0110-reference-aware-cast-character-sheet-generation-preview.md`. It does not
remove the core preview contract, the CLI preview workflow, or the agent
requirement to show a preview before generation.

## References Reviewed

- User screenshots of the current `cast.character-sheet` preview dialog on
  `localhost:5173/projects/urban-basilica/cast/cast_cwdyy6ec`.
- `docs/product/design-guidelines.md`
- `docs/architecture/frontend.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/studio-coordination-events.md`
- `docs/architecture/reference/media-generation.md`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-run-setup.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card.tsx`
- `packages/studio/src/ui/dialog.tsx`
- `packages/studio/src/ui/tabs.tsx`
- `packages/studio/src/ui/image-overlay-card.tsx`
- `packages/studio/src/ui/image-selection-control.tsx`
- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/authoring/authoring.ts`

## Current Design Critique

### The Header Is Not Doing One Job

The current header combines the spec title, project label, purpose badge,
provider badge, model badge, revision badge, subject labels, and updated time.
For the character sheet screenshot, that creates a noisy header before the user
even reaches the actual review task.

Expected impact:

- The user has to parse implementation labels before understanding the preview.
- Technical identifiers compete with the content that matters.
- The same project and model information appears again in other tabs, so the
  header feels repetitive instead of clarifying.

Required correction:

- The visible header must be a single title line only.
- For `cast.character-sheet`, the exact visible title is
  `Character Sheet Generation Preview`.
- For `shot.video-prompt-sheet`, the exact visible title is
  `Shot Prompt Sheet Generation Preview`.
- For `shot.video-take`, the exact visible title is
  `Shot Video Generation Preview`.
- Any accessibility-only description can live in a visually hidden
  `DialogDescription`, but no additional visible header metadata is allowed.

### The Dialog Frame Is Content-Driven

The current `DialogContent` uses `max-h-[88vh]` with no stable height. The
Prompt, References, Config, and Issues tabs have very different content
heights, so the outer dialog changes when the user switches tabs.

Expected impact:

- The user's spatial memory breaks every time they switch tabs.
- The Close button and tab row jump relative to the viewport.
- Dense content feels even more chaotic because the frame itself is unstable.

Required correction:

- Use one fixed desktop dialog size:
  `w-[1120px] h-[720px] max-w-[calc(100vw-6rem)] max-h-[calc(100vh-6rem)]`.
- Keep the frame stable across every tab.
- Put all overflow inside the selected tab body, never on the outer dialog.
- Do not add mobile-specific behavior in this slice.

### The Tabs Do Not Feel Like Studio Tabs

The current tab row is nested inside a padded wrapper and visually floats
between the header and content. It does not read as the same structural line-tab
band used in Studio detail panels.

Expected impact:

- The dialog looks like an invented one-off surface.
- The active indicator does not feel connected to the app's established tab
  anatomy.
- The preview surface is harder to trust because it does not speak the same UI
  language as the rest of Studio.

Required correction:

- Use the local `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent`
  primitives.
- Use `TabsList variant="line"` as its own structural band directly below the
  dialog header.
- Match the app's line-tab pattern: fixed-height band, border bottom,
  `bg-sidebar-header-bg`, uppercase 11px tab labels, active bottom indicator.
- Keep the tab row flush with the dialog content edge. Do not wrap it in a
  padded card or centered container.

### The Prompt Is Treated Like Debug Output

The current Prompt tab puts the final prompt in a bordered monospace `pre`.
The prompt is prose. Rendering it as code makes long sentences harder to read
and gives the surface a debug-console feeling. The tab also adds a Provider
Tokens section, which is internal provider plumbing rather than useful review
copy.

Expected impact:

- The user's main review object is visually downgraded.
- Prompt scanning is slower because line length, font, and spacing are wrong
  for prose.
- Provider tokens make the preview look like an adapter dump.

Required correction:

- Render the final prompt as readable prose:
  `text-sm leading-6 text-foreground whitespace-pre-wrap`.
- Use a calm scrollable panel with Studio border and surface treatment.
- Remove the Provider Tokens section completely.
- Render a negative prompt only when it exists, because it is generator-bound
  content. Do not add any token or role mapping beside it.

### References Use The Wrong Card Language

The current References tab uses a local `ReferenceCard` inside the preview
dialog. It shows `IMAGE 1`, raw labels, Included/Excluded badges, Include or
Exclude text buttons, Role cells, and Token cells.

Expected impact:

- The user sees adapter concepts instead of visual reference choices.
- The cards do not match the reference cards in Shot References, Cast assets,
  Lookbooks, or other media surfaces.
- The duplicated include/exclude text competes with the image.

Required correction:

- Delete the preview-local card treatment.
- Use the shared media-card language: `ImageOverlayCard` for visual media and
  `ImageSelectionControl` for include/exclude state.
- Optional references use the same lower-right circular selection control used
  elsewhere in Studio.
- Required references stay visually selected and do not show a toggle.
- Excluded references are simply unselected. Do not show a large visible
  `EXCLUDED` badge.
- Do not show provider tokens, roles, source purposes, asset ids, file ids, raw
  filenames, or generated technical labels on the cards.
- Show a card title only when the preview provides meaningful product copy. If
  the label is not meaningful, keep the card quiet.
- Use the same grid behavior for cast and shot preview references.

### Config Is An Implementation Dump

The current Config tab is assembled in React from provider, model, route,
execution path, plus `preview.configuration`, then appends the full
`providerPreview.payload` JSON.

Expected impact:

- Provider route internals overwhelm the actual generation settings.
- Some values are duplicated or misleading. In the screenshot, `MODEL` appears
  twice.
- Raw payload JSON makes the dialog look like a developer debug panel rather
  than a user review surface.

Required correction:

- The visible Config tab reads from `preview.configuration` only.
- Core preview builders own which generator-bound settings belong in
  `configuration`.
- React must not add provider, route, execution path, or payload fields just to
  fill space.
- The raw provider payload is not visible in the dialog.
- The config layout should match the compact AI Production property style:
  small uppercase property labels, text-xs values, soft borders, subtle
  `bg-card/40` or `bg-panel-header-bg`, and no nested debug box.
- If an estimate exists in the preview contract, render it in the same compact
  estimated-total treatment used by AI Production.

### The Issues Tab Creates Noise

The current dialog always shows an Issues tab, then renders a success alert
when no diagnostics exist.

Expected impact:

- A permanent Issues tab implies that something may be wrong even when nothing
  is wrong.
- The empty success state is filler text.
- Users are asked to inspect a tab that usually has no useful content.

Required correction:

- Remove the always-visible Issues tab.
- If Core reports diagnostics, render a compact diagnostics banner above the
  tab body or at the top of the active tab content.
- Do not render a `No Issues` success state.
- Do not rename or reinterpret diagnostics in React. Core still owns the
  structured diagnostic issue content.

### One Component Owns Too Much

`generation-preview-dialog-host.tsx` currently owns event subscription, dialog
state, title rendering, tabs, prompt rendering, reference cards, config cells,
token rows, issues, formatting, and purpose labels.

Expected impact:

- The next preview purpose will encourage more branching in the same file.
- Shot and cast previews can drift even though they should share one design.
- It is hard to test visual rules independently.

Required correction:

- Keep `GenerationPreviewDialogHost` as the event and update coordinator.
- Extract named child components inside `features/generation-preview`.
- Use existing `src/ui` primitives for controls and media surfaces.
- Add or extend `src/ui` only for genuinely domain-neutral behavior that
  multiple Studio surfaces can use.

## Goals

- Replace the current generation preview dialog with a stable, desktop-first
  modal surface.
- Apply the same dialog layout, tabs, prompt display, reference card behavior,
  and config styling to character sheet previews and shot previews.
- Keep the header to one visible line.
- Remove visible provider tokens and raw provider payload JSON from the dialog.
- Remove the permanent Issues tab.
- Reuse Studio's local shadcn-style primitives and shared media controls.
- Keep Studio frontend code as a projection consumer. Core owns preview
  validity, configuration content, diagnostics, references, and provider data.
- Keep Studio server handlers thin. Do not add server-side UI formatting logic.
- Keep the AI artifact opacity rule intact. The UI may display prompt text and
  reference images; it must not parse, score, validate, or inspect creative
  artifact content.

## Non-Goals

- Do not change provider payload construction.
- Do not remove `providerPreview` from the core or CLI contract in this slice.
  The raw payload can remain available to CLI, tests, agents, or future
  developer tooling, but it is not visible in the Studio dialog.
- Do not add a fallback compatibility dialog.
- Do not keep old preview cards or old header metadata as aliases.
- Do not add mobile-specific layout or test coverage.
- Do not run paid generation.
- Do not add React-local validation for whether references are valid or
  whether prompt contents mention expected elements.
- Do not add route-local business rules for reference ownership or generation
  readiness.

## Target User Interface Contract

### Dialog Frame

Use:

```tsx
<DialogContent className="h-[720px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] p-0 gap-0 overflow-hidden">
```

The exact implementation may use the existing `DialogContent` base styles, but
the rendered frame must stay the same size while switching between Prompt,
References, and Config.

### Header

Visible copy is exactly one line:

- `Character Sheet Generation Preview`
- `Shot Prompt Sheet Generation Preview`
- `Shot Video Generation Preview`

No visible project name, cast member name, shot name, model badge, provider
badge, revision badge, updated timestamp, or purpose badge is allowed in the
header.

### Tabs

Use exactly these tabs:

- `Prompt`
- `References`
- `Config`

No `Issues` tab.

The tab row is always present and keeps the same height. Tab content scrolls
inside a fixed body region.

### Prompt Tab

Visible content:

- final prompt text;
- negative prompt text only when present;
- diagnostics banner only when diagnostics exist.

Forbidden content:

- Provider Tokens;
- provider token order;
- reference roles;
- provider payload;
- generated adapter labels.

### References Tab

Visible content:

- visual media cards for image and video references;
- compact audio rows for audio references;
- lower-right include/exclude control for editable optional references;
- selected visual state for included references;
- no control for required references;
- diagnostics banner only when diagnostics exist.

Forbidden content:

- `IMAGE 1`, `IMAGE 2`, or similar generated labels;
- `INCLUDED` or `EXCLUDED` status badges;
- raw `Include` or `Exclude` text buttons;
- Role fields;
- Token fields;
- asset ids;
- asset file ids;
- source purpose ids;
- provider tokens.

### Config Tab

Visible content:

- items from `preview.configuration`;
- estimate summary when `preview.estimate` exists;
- diagnostics banner only when diagnostics exist.

Forbidden content:

- `providerPreview.payload`;
- `Provider Payload`;
- provider token order;
- React-invented provider, route, execution path, or duplicate model fields.

If a generator setting should be visible, Core should include it in
`preview.configuration` with a meaningful label.

## Component Architecture

Keep the feature folder:

```text
packages/studio/src/features/generation-preview/
  generation-preview-dialog-host.tsx
  generation-preview-dialog.tsx
  generation-preview-title.ts
  generation-preview-tabs.tsx
  generation-preview-prompt-panel.tsx
  generation-preview-reference-grid.tsx
  generation-preview-reference-card.tsx
  generation-preview-config-panel.tsx
  generation-preview-diagnostics-banner.tsx
```

Responsibilities:

- `generation-preview-dialog-host.tsx`
  - subscribes to `renku:generation-preview-requested`;
  - owns open/closed state;
  - owns current preview state;
  - calls the reference inclusion update service when Core marks a reference
    editable;
  - passes preview data to `GenerationPreviewDialog`.

- `generation-preview-dialog.tsx`
  - owns the fixed dialog frame;
  - renders the one-line header;
  - owns selected tab state;
  - renders footer actions.

- `generation-preview-title.ts`
  - maps `GenerationPreviewPurpose` to the exact visible dialog title.
  - This file is not a re-export or compatibility shim; it owns title copy.

- `generation-preview-tabs.tsx`
  - owns the shared Prompt, References, Config tab structure.
  - It must not know how references are toggled beyond receiving callbacks.

- `generation-preview-prompt-panel.tsx`
  - renders prompt text and optional negative prompt as prose.
  - It must not parse prompt content.

- `generation-preview-reference-grid.tsx`
  - lays out all preview references with one shared grid behavior.
  - It handles image, video, and audio reference presentation consistently.

- `generation-preview-reference-card.tsx`
  - adapts one `StudioGenerationPreviewReference` to the shared media-card
    primitives.
  - It must not render role, token, asset id, or source purpose.

- `generation-preview-config-panel.tsx`
  - renders `preview.configuration` and `preview.estimate`.
  - It must not read `providerPreview.payload`.

- `generation-preview-diagnostics-banner.tsx`
  - renders Core diagnostics only when present.
  - It must not render success filler when diagnostics are empty.

Use existing UI primitives:

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`,
  `DialogDescription`, `DialogFooter`;
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`;
- `Button`;
- `Alert`;
- `ImageOverlayCard`;
- `ImageSelectionControl`;
- `VideoPreview`;
- `AudioPreview`.

Allowed `src/ui` work:

- Extend `ImageSelectionControl` with optional `disabled` and `busy` props if
  the preview reference update flow needs to prevent duplicate clicks while a
  toggle is pending.
- Add a domain-neutral media selection helper only if it removes real
  duplication between existing Shot References and the new Generation Preview
  references. Do not add a thin pass-through wrapper or re-export facade.

## Core And Contract Boundaries

Core already owns the preview contract:

- `GenerationPreviewRequest`
- `StudioGenerationPreview`
- `GenerationPreviewConfigurationItem`
- `StudioGenerationPreviewReference`
- `DiagnosticIssue`

This redesign should not move business rules into React.

Rules:

- React renders `preview.configuration`; it does not decide which provider
  settings are important.
- React renders diagnostics from Core; it does not invent readiness errors.
- React toggles references only when `selectionControl.editable` is true and
  the existing service route supports the update.
- React does not validate reference ownership, target kind, provider input
  counts, or model support.
- Studio server continues to resolve logical project references to browser-safe
  URLs and serialize the Core response.
- CLI and agent workflows can still inspect raw provider payload data through
  their existing contracts if needed. The Studio dialog simply does not show it.

## Documentation Changes

Update architecture docs so they no longer imply that the visible Studio dialog
must show every low-level provider field.

Required docs updates:

- `docs/architecture/studio-coordination-events.md`
  - clarify that generation preview events carry prompt, model, resolved
    references, provider preview data, configuration, diagnostics, and metadata;
  - clarify that the user-facing dialog intentionally renders only prompt,
    references, user-relevant configuration, estimate, and diagnostics when
    present.

- `docs/architecture/reference/media-generation.md`
  - keep the agent requirement to show a preview before generation;
  - update visible-dialog expectations to remove provider token tables and raw
    payload JSON.

- `docs/product/design-guidelines.md`
  - no new design-system direction is required unless implementation discovers
    a missing reusable pattern.
  - If `ImageSelectionControl` gains `busy` or `disabled`, document that
    generic state in the UI component pattern.

## Implementation Slices

### Slice 1: Dialog Shell And Copy

- Extract `GenerationPreviewDialog`.
- Add `generation-preview-title.ts`.
- Apply fixed desktop dialog dimensions.
- Replace the visible header with the one-line title.
- Move all other subject/model/revision metadata out of visible header chrome.
- Keep `DialogDescription` only as visually hidden accessibility text if
  needed.

### Slice 2: Shared Tabs

- Extract the Prompt, References, and Config tab composition.
- Remove the Issues tab.
- Make the tab row a structural band with the Studio line-tab treatment.
- Keep the tab content region fixed and scrollable.

### Slice 3: Prompt Panel Cleanup

- Replace monospace prompt rendering with readable prose typography.
- Remove `TokenRows`.
- Remove Provider Tokens.
- Keep optional negative prompt rendering only when present.

### Slice 4: Reference Card Replacement

- Delete the preview-local technical `ReferenceCard`.
- Render image/video references through the shared media-card language.
- Render audio references through a compact Studio audio preview row.
- Reuse `ImageSelectionControl` for optional editable include/exclude state.
- Extend `ImageSelectionControl` only if needed for disabled or busy state.
- Remove visible Role and Token fields.
- Remove Included/Excluded badges and text Include/Exclude buttons.

### Slice 5: Config Panel Cleanup

- Render only `preview.configuration`.
- Render estimate when present.
- Remove provider/model/route/execution path fields currently invented in
  React unless Core includes them in `preview.configuration`.
- Remove visible provider payload JSON.

### Slice 6: Diagnostics Banner

- Add a compact diagnostics banner that appears only when diagnostics exist.
- Use `Alert` variants based on diagnostic severity.
- Do not render a success state when diagnostics are empty.

### Slice 7: Tests And Docs

- Update component tests for the new visible copy contract.
- Add coverage for stable tab structure and removed debug text.
- Update architecture docs listed above.

### Slice 8: Desktop Visual Verification

- Run Studio locally.
- Use the real `urban-basilica` cast preview route shown in the screenshots.
- Verify the character sheet preview across Prompt, References, and Config.
- Verify a shot preview across Prompt, References, and Config.
- Confirm the dialog frame dimensions do not change between tabs.
- Capture desktop screenshots before final handoff.
- Do not run mobile viewport verification unless separately requested.

## Test Plan

Focused tests:

- `pnpm --filter @gorenku/studio test -- generation-preview-dialog-host`
- Any new focused component tests under
  `packages/studio/src/features/generation-preview`.

Assertions to add or update:

- Opening a `cast.character-sheet` preview shows
  `Character Sheet Generation Preview`.
- Opening a `shot.video-prompt-sheet` preview shows
  `Shot Prompt Sheet Generation Preview`.
- Opening a `shot.video-take` preview shows
  `Shot Video Generation Preview`.
- The header does not render provider, model, revision, project, cast member,
  shot, take, or updated-time visible text.
- The tab list contains exactly Prompt, References, and Config.
- No Issues tab is rendered when diagnostics are empty.
- No `No Issues` success state is rendered when diagnostics are empty.
- Prompt tab renders final prompt text and does not render Provider Tokens.
- References tab does not render Role or Token cells.
- References tab uses include/exclude controls for editable optional
  references.
- Config tab renders `preview.configuration`.
- Config tab does not render Provider Payload or raw payload JSON.
- Updating an editable cast reference still calls the existing service and
  updates the open preview in place.
- Dismissing and receiving a later preview still reopens the dialog.

Browser verification:

- Current desktop viewport in Chrome.
- One additional desktop viewport close to the screenshot proportions.
- Prompt, References, and Config tabs for a character sheet preview.
- Prompt, References, and Config tabs for a shot preview.
- `getBoundingClientRect()` or screenshot comparison confirms fixed outer
  dialog size across tabs.

## Completion Checklist

### Review Area

- [x] Confirm the final UI follows the user-requested copy contract.
- [x] Confirm the redesign applies to both cast character sheet previews and
  shot previews.
- [x] Confirm the dialog does not expose provider tokens, provider payload JSON,
  Role fields, Token fields, or empty Issues states.
- [x] Confirm the dialog frame does not resize when switching tabs.

### Architecture And Contracts

- [x] Keep Core as the owner of generation preview validation.
- [x] Keep Core as the owner of `preview.configuration` content.
- [x] Keep Core as the owner of diagnostics.
- [x] Keep Studio server handlers thin.
- [x] Keep React as a projection consumer.
- [x] Avoid route-local, React-local, or CLI-local generation business rules.
- [x] Do not change provider payload construction.
- [x] Do not remove raw provider payload data from CLI or Core contracts in
  this slice.
- [x] Do not add compatibility shims or re-export facades.

### Studio UI Implementation

- [x] Extract `GenerationPreviewDialog` from the current host.
- [x] Add `generation-preview-title.ts` with the three exact dialog titles.
- [x] Apply fixed dialog width and height with viewport caps.
- [x] Render one visible header line only.
- [x] Keep accessibility description hidden if required.
- [x] Extract shared Prompt, References, and Config tab composition.
- [x] Remove the always-visible Issues tab.
- [x] Restyle the tab row as the Studio line-tab structural band.
- [x] Ensure tab content scrolls without resizing the outer dialog.

### Prompt Panel

- [x] Render final prompt text as prose, not monospace code.
- [x] Remove Provider Tokens.
- [x] Remove token order display.
- [x] Render negative prompt only when present.
- [x] Avoid parsing or validating creative prompt contents.

### References Panel

- [x] Delete the preview-local technical reference card.
- [x] Reuse `ImageOverlayCard` for image references.
- [x] Reuse `VideoPreview` inside the shared visual card treatment for video
  references.
- [x] Reuse `AudioPreview` or a matching compact audio row for audio
  references.
- [x] Reuse `ImageSelectionControl` for editable optional include/exclude
  state.
- [x] Extend `ImageSelectionControl` with generic `disabled` or `busy` props if
  needed.
- [x] Do not render Role fields.
- [x] Do not render Token fields.
- [x] Do not render asset ids or asset file ids.
- [x] Do not render generated `IMAGE 1` labels.
- [x] Do not render Included/Excluded badges.
- [x] Do not render text Include/Exclude buttons.
- [x] Keep card titles quiet when labels are not meaningful product copy.

### Config Panel

- [x] Render only `preview.configuration` items as visible settings.
- [x] Render estimate when `preview.estimate` exists.
- [x] Remove React-invented provider, route, execution path, and duplicate model
  cells.
- [x] Remove visible Provider Payload JSON.
- [x] Match the compact AI Production property style.

### Diagnostics

- [x] Add diagnostics banner rendering only when diagnostics exist.
- [x] Preserve Core diagnostic code, message, severity, and suggestion.
- [x] Do not render a `No Issues` success state.
- [x] Do not turn diagnostics into React-local validation rules.

### Tests

- [x] Update `generation-preview-dialog-host.test.tsx`.
- [x] Add focused tests for the extracted dialog components where useful.
- [x] Assert exact header title mapping by preview purpose.
- [x] Assert only Prompt, References, and Config tabs render.
- [x] Assert removed debug copy does not render.
- [x] Assert editable reference toggling still works.
- [x] Run the focused Studio tests.

### Documentation

- [x] Update `docs/architecture/studio-coordination-events.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/product/design-guidelines.md` only if a shared UI primitive
  gains a documented state.

### Final Verification

- [x] Run `pnpm --filter @gorenku/studio test -- generation-preview-dialog-host`
  or the current focused equivalent.
- [x] Run `pnpm --filter @gorenku/studio lint` if UI files are touched and the
  focused lint path is available.
- [x] Verify in desktop Chrome against the real `urban-basilica` character
  sheet preview.
- [x] Verify a shot preview in the same shared dialog.
- [x] Capture desktop screenshots for Prompt, References, and Config.
- [x] Confirm visually that a design reviewer would not flag tab drift, dialog
  resizing, debug payload clutter, prompt readability, or inconsistent reference
  cards.
