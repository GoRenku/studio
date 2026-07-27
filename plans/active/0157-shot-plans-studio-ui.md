# 0157 Shot Plans Studio UI

Status: proposed
Date: 2026-07-26

Plan 0159 and Decision 0064 are hard dependencies for the image portions of
this future UI. This plan consumes the common `Asset`, `Shot.images`,
`Shot.selectedImageId`, owner-based Asset pages, common Core selection, and
independent-copy contracts. It must not reintroduce a Shot-specific image
relationship or selection service. Decision 0065 is reserved for this plan's
future bounded-mosaic UI decision.

## Summary

This plan adds the Shot Plans inspection and selected-image curation
surface sketched in
`plans/exploration/shot-plans-ui.md` and the attached rough wireframe. It
replaces the current `Shots` placeholder with a `Shot Plans` tab, renders
scene-owned Shot Plans as image mosaics, and opens a desktop inspector with
covered Beats, a resizable Shot rail, five glanceable brief cards, and the
canonical Markdown Shot description. Each Shot rail card also opens a focused
candidate-image dialog where the user can select the selected image or
move any candidate to Trash.

This is deliberately the UI half of a two-plan feature:

- `0156-shot-plan-authoring-cli-and-agent-skills.md` owns the durable Shot Plan
  and Shot contracts, focused Core commands, Shot image ownership and
  lifecycle, `shot.image`, CLI authoring, and Studio Skills.
- this plan owns the browser-facing Core selection contract, thin Studio
  routes, browser service, cards, inspector, focused selected-image
  curation, shared visual vocabulary, and desktop interaction and
  accessibility behavior.

Plan 0156 is a hard dependency. This plan must not recreate its domain rules in
React or HTTP handlers and must not ship against the current whole-plan update
contract.

The design follows the current Studio system rather than treating the
wireframe as a literal component specification. It uses existing `LineTabs`,
`MediaCard`, `MediaCardGrid`, `Dialog`, `ResizablePanelGroup`, CodeMirror,
Lucide icons, amber selection language, and the existing Shot Design media.
New shared primitive work is limited to a bounded mosaic variant, a bounded
lower-corner `MediaCard` action, a choose-one `MediaCard` selection mode, and a
local shadcn-style Hover Card primitive.

## Requirement Ledger

| Requirement | Source | Owning outcome |
| --- | --- | --- |
| Replace the Scene `Shots` placeholder with `Shot Plans`. | Exploration brief and wireframe | Rename the stable scene tab contract and replace the placeholder feature |
| Keep `Generations` visible but disabled. | User answer 5 | Disabled `LineTabs` trigger with no selectable tab state, route, request, or content |
| Show existing Shot Plans in a three-column desktop card grid. | Exploration brief | Existing `MediaCardGrid` on the Scene panel |
| Do not add a `New Shot Plan` card or general Shot Plan/Shot authoring controls in this slice. | Exploration brief and accepted image-card clarification | Read-mostly list/inspector plus recoverable plan delete and focused selected-image curation |
| Each Shot Plan card uses its Shots' selected images in canonical Shot order. | Exploration brief and plan 0156 | Bounded `MediaCard` mosaic input derived from the Core list projection |
| Mosaic layout is deterministic: one full image, two split, three columns, four 2x2, five through nine in three columns, and more than nine as eight images plus a ninth `+N` tile. | User answer 7 | One reusable bounded mosaic algorithm and focused layout tests |
| A Shot Plan with no selected images remains quiet and meaningful. | Project UI-copy rule | Existing empty-media treatment with an image icon; no fabricated title, filename, or placeholder art |
| The card overlay shows the authored Shot Plan title and covered Beat numbers. | Exploration brief | Meaningful authored/domain copy only |
| Delete is recoverable and includes the plan's Shot images. | User answer 1 and plan 0156 | Confirmation states that the plan and its images move to Trash; route delegates to Core |
| Inspect opens a read-mostly modal with header, covered Beats, Shot rail, and Shot details. | Exploration brief and wireframe | Focused dialog feature, no generic inspector framework |
| The dialog initially selects the first Shot; selecting another Shot updates the detail area. | Exploration brief | URL-backed nested selection using canonical Shot order |
| Closing the inspector keeps the Scene on `Shot Plans`. | Exploration brief | Clear plan/Shot focus only, not the scene tab |
| Covered Beat images appear on hover and keyboard focus. | Wireframe and design audit | Local Hover Card using actual storyboard image files; text-only fallback when absent |
| The Shot rail shows one `MediaCard` per Shot, selected in amber and using the shared card hover/focus affordances. | User answer 6 and accepted image-card clarification | Card activation selects the Shot; amber border/background selection never uses green success language |
| Each Shot rail card exposes a bottom-right edit action on hover or keyboard focus. | Accepted image-card clarification | Bounded Pencil action opens the exact Shot's candidate-image dialog |
| Duration is intent only and appears as a bottom-left image badge with a duration icon and value. | User answer 2 and accepted image-card clarification | Timer badge avoids the lower-right edit action; no ranges, overlaps, track, timeline, or sequencing UI |
| The candidate-image dialog shows every active image candidate for the exact Shot as cards. | Accepted image-card clarification | Lazy focused Asset query, existing `MediaCardGrid`, and quiet loading/error/empty states |
| Candidate cards select through a bottom-right selection control and show the selected image persistently. | Accepted image-card clarification | Focused common Asset selection mutation; selecting does not clear or auto-close |
| Candidate cards expose top-right hover/focus delete. Deletion is recoverable. | Decision 0064 | Common Asset discard clears selection when the deleted candidate is selected. |
| Framing shows start/end shot size; Camera shows angle; Motion shows movement. | User answer 3 and Appendix | Shared Shot Design media where known, exact authored text as fallback |
| Optics and Lighting put creative intent before technical metadata. | User answer 3 and Appendix | Text-led brief cards; optional optics values are secondary |
| The full authored Shot description is the canonical detail. | Exploration brief and plan 0156 | Read-only CodeMirror Markdown surface preserving exact text |
| Visual and motion behavior remains accessible on desktop. | Product design audit | Keyboard equivalents, visible focus, reduced-motion handling, semantic labels, independent scrolling |
| The UI remains a projection consumer. | Architecture hard gate | No Beat, image ownership, copy, discard eligibility, duration, vocabulary, or selection eligibility rules in React |

There are no remaining product questions in this plan. The accepted answers
above are implementation constraints, not defaults that an implementer may
reinterpret.

## Product Behavior

### Scene tabs

The Scene panel tab row is:

1. `Narrative`
2. `Beats`
3. `Shot Plans`
4. `Generations` — visible and disabled

`Shot Plans` directly replaces the current stable `shots` selection value with
`shotPlans`. Renku Studio is pre-customer software, so callers and tests are
updated directly; no `shots` URL alias, compatibility parser, redirect, or
fallback is retained.

`Generations` is presentation-only in this slice. It is not included in
`ScenePanelTab`, cannot receive selection, cannot be deep-linked, and does not
mount hidden content or issue a data request.

### Shot Plan grid

The tab loads all active Shot Plans for the selected Scene through one focused
browser service request. It renders:

- a loading state in the content area without replacing the scene tabs;
- an inline structured-error state with retry;
- a quiet empty state when the Scene has no Shot Plans;
- a three-column `MediaCardGrid` at the supported desktop viewport;
- one `MediaCard` per Shot Plan.

Cards remain ordered by the Core list projection. React does not sort plans,
Shots, or covered Beats to repair server output.

Each card presents:

- the bounded selected-image mosaic;
- the authored Shot Plan title;
- a compact `Beat 1 · Beat 2 · …` coverage line using the covered Beat
  positions returned by Core;
- the existing bottom-right inspect action;
- the existing top-right destructive action with an accessible label.

There is no create card, Shot Plan-card edit action, status badge, generated
count, raw id, filename, asset role, or inferred label.

### Deterministic selected-image mosaic

Only selected images participate. Missing selections and all
unselected candidates are omitted. Images remain in canonical Shot order.

The visual contract is:

| Selected image count | Layout |
| --- | --- |
| 0 | Existing empty-media treatment |
| 1 | One full-bleed tile |
| 2 | Two equal vertical tiles |
| 3 | Three equal vertical tiles |
| 4 | Two-by-two grid |
| 5–9 | Three-column grid with natural row completion |
| 10+ | First eight images, followed by one `+N` overflow tile |

For 10 or more images, `N` is the number of images not displayed. For example,
10 selected images render the first eight and `+2`; 14 render the first eight
and `+6`. The overflow tile is not interactive and does not pretend to be an
Asset.

This becomes a bounded, reusable `MediaCard` variant rather than Shot Plan
layout code. The existing four-image `mosaic` variant remains unchanged for
the Visual Language surfaces that own its accepted 2x2 contract.

### Recoverable delete

Delete uses the current confirmation pattern. The copy explicitly says that
the Shot Plan and its Shot images will move to Trash and can be restored. The
browser sends only the Shot Plan id. Core owns:

- verifying that the active plan exists;
- finding its Shots and Shot-owned Assets;
- handling images shared by a copied plan;
- moving records and files to Trash;
- returning structured mutation and resource-key output.

On success the UI closes the inspector if it was showing the deleted plan,
clears the nested focus, invalidates the scene Shot Plans resource, and lets
the normal list projection remove the card. It does not optimistically invent
a partial deleted aggregate.

### Inspector focus and close behavior

Inspecting a card opens the Shot Plan dialog and sets:

- the selected Shot Plan id; and
- the first Shot id in canonical order when at least one Shot exists.

The dialog can also restore a valid URL-backed focus after reload. If the Shot
Plan has no Shots, it opens with the header and an empty Shot detail state, with
no fabricated selected id.

Selecting a Shot in the rail updates the selected Shot id. Closing the dialog
removes the plan and Shot query fields while leaving
`sceneTab=shotPlans`.

If the URL supplies an unavailable plan, a Shot from a different plan, or a
deleted Shot, the server-owned Studio coordination projection rejects or
normalizes that focus using the current structured selection mechanism. React
does not decide membership from stale list data.

### Inspector header and covered Beats

The header shows:

- the authored Shot Plan title;
- compact Beat chips in covered order;
- the Beat position and authored Beat title;
- a hover/focus preview of the Beat's selected storyboard image when one
  exists.

The preview uses the existing generic Asset file route. If a covered Beat does
not have a selected storyboard image, the chip remains useful text and no
placeholder artwork or fake preview is shown.

The hover behavior has an equivalent keyboard-focus trigger. The preview is
supplemental; no required information is available only on hover.

### Shot rail

The dialog body uses the existing horizontal resizable panel primitive:

- rail default: 24% of the dialog body;
- rail minimum: 20%;
- rail maximum: 30%;
- visible drag handle;
- independently scrollable rail and detail regions.

Each rail item is a shared `MediaCard`, not a one-off clickable panel. Whole-card
activation selects the Shot. The card contains:

- the Shot's selected image, or a quiet `ImageOff` state;
- a circular `Shot 1`, `Shot 2`, … number badge at the upper left;
- a bottom-left Timer badge only when `durationSeconds` exists;
- a value such as `5s` or `2.5s`, without a start time or range;
- an accessible label such as `Approximate duration 5 seconds`;
- a bottom-right Pencil action that appears on pointer hover or keyboard focus
  and is labelled `Manage images for Shot <position>`.

Shot numbers derive from canonical position. The selected item uses the
project's amber active treatment and a visible focus ring. Green is reserved
for success/readiness semantics and is not used for selection.

The number and duration badges are feature-owned, pointer-transparent overlays
around the shared card. They do not require arbitrary badge slots or
Shot-specific fields in `MediaCard`. The lower-right action uses a bounded
shared card action so it remains above whole-card activation and follows the
same focus, tooltip, icon-button, and event-isolation behavior as existing card
actions.

### Shot image candidate dialog

The rail-card Pencil action opens a second focused Dialog for that exact Shot.
It follows the current `ReferencePickerDialog` desktop geometry:

- `max-w-5xl`;
- a `max-h-[65vh]` independently scrollable card region;
- `MediaCardGrid` with a 220-pixel minimum card width;
- the authored Shot title in the dialog header;
- a concise description that selecting an image changes the selected
  image used by the rail and Shot Plan mosaic.

Only the top dialog traps focus. Closing it returns focus to the rail card's
Pencil action and leaves the inspector, selected Scene tab, selected Shot Plan,
and selected Shot unchanged. The dialog is transient UI state and is not added
to the URL-backed Studio selection contract.

The dialog lazily loads every active `shot_image` candidate owned by the exact
Shot in the order returned by Core. It does not sort by filename, infer
generation quality, or silently omit an eligible candidate. Loading keeps the
dialog frame stable; structured failure includes Retry; an empty Shot uses a
quiet image-empty state without a create or generate control.

Each candidate uses the existing `MediaCard` image treatment with:

- no fabricated title, filename, Asset id, role, or quality label;
- a bottom-right selection control;
- the current selected shown with the persistent selected/check state;
- unselected controls labelled `Use as selected image`;
- a persistent selected/check indicator labelled
  `Selected image`, not a browser clear command;
- a top-right delete action on hover or keyboard focus.

Selecting an unselected card's control calls the focused Core selection
command. The gallery remains open, matching the existing in-place media-card
selection pattern. After the returned Shot Plans resource invalidates, the
candidate state, Shot rail image, and Shot Plan mosaic all project the new
selection. React does not optimistically manufacture a replacement `Shot`.

Deleting a candidate uses the current confirmation pattern. The message says
the image moves to Trash and can be restored. Core verifies exact Shot
ownership and owns selection clearing, Asset membership, AssetFile, and
packaged-file lifecycle. On success the card disappears through the refreshed
candidate projection. If it was selected, the refreshed projection has no
selected image.

### Shot details

The detail region presents:

1. the authored Shot title;
2. the five-card brief grid;
3. the canonical Markdown description.

The brief card subjects and hierarchy are:

- **Framing** — start and end shot size, with an arrow when both exist;
- **Camera** — angle;
- **Motion** — movement;
- **Optics** — authored intent first, then optional focal length, depth of
  field, and focus target;
- **Lighting** — authored source, direction, quality, or mood intent.

Known framing, angle, and motion values use the existing Shot Design visual
catalog. Custom non-empty values remain exact text. Missing optional values
leave a quiet card; the UI does not invent `Auto`, `None`, or a generic pick
label.

Motion media may preview on hover or focus when the current catalog supplies a
clip. It must:

- remain muted;
- stop when not previewing;
- render a static poster when reduced motion is requested;
- retain the exact text label so the concept is never communicated by motion
  alone;
- use the text fallback for catalog entries such as Rack Focus that do not
  have a motion file.

Optics is intentionally not reduced to `85 mm`, and Lighting is intentionally
not reduced to a color-temperature label. Their intent text receives the
primary typographic treatment. Optional optics technical details are compact
secondary metadata.

### Canonical description

The description is rendered in a read-only CodeMirror Markdown surface using
the project's neutral editor treatment. It preserves the exact authored
Markdown and may syntax-highlight presentation tokens only.

The browser does not:

- require the prose to repeat the brief;
- compare optics or lighting intent with the brief cards;
- score Shot completeness;
- repair Markdown;
- parse creative meaning;
- rewrite missing content;
- decide whether the Shot is ready.

## Explicit Non-Goals

This plan does not add:

- Shot Plan, Shot, coverage, brief, description, or duration authoring in the
  browser;
- a `New Shot Plan` card;
- image generation controls or GenerationSpec inspection in this surface;
- candidate import, candidate creation, or a browser clear-selection command;
- deletion of the currently selected image;
- selectable Generations content;
- a timeline, time range, overlap, sequencing, track, clip, or edit decision;
- video generation, Shot video attachment, post-processing, or render state;
- plan or Shot status, approval, version, history, readiness, or progress;
- user-facing pagination, filtering, search, bulk delete, or bulk selection;
- arbitrary `MediaCard` layout configuration;
- a generic inspector framework;
- a semantic creative validator;
- mobile behavior or mobile verification.

## Context And Evidence

### Accepted decisions and current direction

- `docs/design-guidelines.md` establishes the dark neutral surface, amber
  active language, thin borders, compact controls, and restrained density.
- `docs/architecture/front-end-guidelines.md` requires feature-local React
  modules, thin service boundaries, direct use of local UI primitives, and
  intentional component names.
- Decision 0053 accepts a fixed 2x2 `MediaCard` mosaic for Visual Language.
  This feature needs a separate bounded adaptive mosaic while preserving that
  current variant.
- Decision 0041 and the repository hard gate keep descriptions, prompts, and
  generated media opaque to Studio runtime.
- Decisions 0061 and 0062 keep copied Shot Plans and generated media
  independently editable and keep Shot planning separate from video
  generation.
- Plan 0156 defines the exact Shot, brief, covered Beat, selected image, copy,
  Trash, generation, CLI, and resource-key contracts this UI projects.

### Current implementation

The current implementation evidence is:

- `scene-panel.tsx` renders `Narrative`, `Beats`, and `Shots`;
- `scene-shots-placeholder-tab.tsx` contains only a `New Shot` button;
- `ScenePanelTab` and the `shots` spelling are duplicated across Core
  selection, Studio route parsing, events, and tests;
- `LineTabs` has no disabled-item contract;
- `MediaCard` already owns single-image, video, and exact four-image mosaic
  rendering plus delete/inspect controls;
- `MediaCard` selection already supplies the accepted lower-right check/pick
  control, and its delete action already appears at the upper right on hover or
  focus;
- Cast and Location media collections already demonstrate in-place card
  selection and card-level deletion, while `ReferencePickerDialog` supplies the
  accepted large candidate-grid dialog geometry;
- the current lower-right card action is inspect-only and always visible, so the
  Shot rail needs one bounded icon/visibility generalization rather than a
  feature-local raw button;
- `MediaCardGrid` already supplies the three-column desktop layout;
- the Generation Request inspector already demonstrates the accepted
  large-dialog, resizable-panel, and independent-scroll treatment;
- the local `Dialog`, `Button`, `ResizablePanelGroup`, CodeMirror, Tooltip, and
  Lucide icon infrastructure is available;
- `radix-ui` is already a dependency, but there is no local shadcn-style
  `HoverCard` primitive;
- framing, camera-angle, and motion assets exist under the current
  Shot-authoring feature;
- Rack Focus has no motion file and therefore proves that a real text fallback
  is required;
- the generic Asset file endpoint can serve selected Shot and storyboard
  images; no Shot-specific file route is necessary.

### Wireframe design audit

The wireframe establishes the information architecture but leaves several
interaction and hierarchy details unresolved. This plan resolves them using
the current product system:

- the green selected Shot is changed to amber because selection is not success;
- the time-range labels are removed because duration is only intent;
- duration becomes a small lower-left Timer badge on the image rather than a
  timeline and stays clear of the new lower-right edit action;
- hover-only Beat images gain keyboard-focus access and meaningful text;
- the dialog uses a constrained resizable rail rather than a fixed oversized
  column;
- Optics and Lighting are text-led so creative intent is not visually
  subordinated to technical metadata;
- existing Shot Design media is shared instead of copied into a second feature;
- missing media remains quiet rather than receiving fabricated placeholder
  art;
- the design stays desktop-first, matching the product's supported surface.

### Real project evidence

`urban-basilica` currently contains Scenes, active Beat Sheets, and storyboard
image relationships but no persisted Shot Plans or Shots. The Bombardment
Scene has a ten-Beat active sheet with ten storyboard images, making it a
useful verification target for:

- covered Beat chip density;
- hover/focus storyboard previews;
- dialog width and header wrapping;
- the no-Shot and many-Shot states once a temporary fixture is created.

Any mutation-based verification uses a temporary clone of the real project.
This plan does not authorize modifying the user's active movie project.

### Overlapping active work

- Plan 0156 is the required domain/CLI/skill dependency and must land first or
  in the same coordinated change.
- Current active prompt, generation, and asset work must remain the owner of
  its own feature contracts. This plan reuses its public primitives and Asset
  file route; it does not move generation logic into Shot Plans.
- No historical plan is edited merely to sweep `shots` to `shotPlans`.

## Right-Sized Change Decision

Use a focused feature plus bounded shared primitive extensions:

- a feature-local Shot Plans tab and inspector;
- a feature-local Shot-image candidate dialog;
- a dedicated browser service and thin server routes;
- one bounded adaptive `MediaCard` mosaic variant;
- one bounded `MediaCard` lower-corner action contract for inspect/edit icon and
  always/hover-or-focus visibility;
- one choose-one mode alongside the existing toggle mode on the bounded
  `MediaCard` selection control;
- one local shadcn-style Hover Card primitive;
- one shared Shot Design media catalog consumed by both current Shot
  authoring and the new inspector;
- a small split of generic Markdown CodeMirror theme from prompt-specific
  presentation.

Do not turn this into literal one-file wireframe code or a generic
media-dashboard/inspector framework. Arbitrary mosaic rows/columns, render
slots, arbitrary card actions, and configuration-driven inspection are not
required by the accepted product behavior.

## Architecture Shape Gate

Implementation must stop at this gate until plan 0156's public contracts and
the following file ownership are accepted.

### Ownership

- `packages/core` owns browser-safe Studio selection and coordination
  validation. It verifies plan/Shot focus through the Project Data service.
- `packages/studio/server` owns HTTP parsing, Core calls, response
  serialization, and structured error translation.
- `packages/studio/src/services` owns the typed browser request/response
  boundary.
- `packages/studio/src/features/movie-studio/shot-plans` owns Shot Plans React
  projection and local display composition.
- `packages/studio/src/features/movie-studio/shot-design` owns shared
  vocabulary media lookup used by multiple Shot features.
- `packages/studio/src/ui` owns generic shadcn-style and card primitives.
- Core remains the only owner of plan membership, Shot order, covered Beat
  resolution, selected-image eligibility, selection clearing on discard,
  delete/restore behavior, and Asset ownership.

### Intended Core coordination layout

Update the current owners directly:

```text
packages/core/src/client/
  resources.ts
packages/core/src/server/resources/
  selection-context.ts
packages/core/src/server/studio-coordination/
  events.ts
  current-projection.ts
  focus-validation.ts
  resource-keys.ts
  index.ts
```

`client/resources.ts` remains the public browser-safe selection contract.
`resources/selection-context.ts` remains the database-backed owner of current
Scene, Beat, Shot Plan, and Shot focus validation. Extend it to validate
`shotPlanId` and `shotId`, and use that Core result in the focus-request route
instead of adding a route-local Shot Plan validator. Remove the existing
route-local Beat membership validator in the same slice and use the already
Core-owned selection-context validation for Beat focus as well.

The focused `studio-coordination` modules keep event parsing, current
projection, base Project focus validation, and resource keys in their current
owners. `index.ts` stays a thin public entrypoint. Do not create a second
selection model or a Shot Plan-specific state store.

`packages/studio/src/features/movie-studio/movie-studio-selection.ts` stops
declaring duplicate `StudioSelection` and `ScenePanelTab` types. Update Studio
callers to import those browser-safe contracts directly from Core. The module
may retain its runtime tab-value list and lookup/projection functions; it must
not re-export the Core types as a convenience facade.

### Intended Studio server layout

```text
packages/studio/server/
  routes/
    shot-plans.ts
    assets.ts
  http/
    shot-plan-responses.ts
    asset-request.ts
  routes/projects.ts
```

`shot-plans.ts` contains only focused route handlers and route registration.
`shot-plan-responses.ts` decorates browser-safe Asset file URLs and serializes
the accepted list/mutation response. It does not resolve Beat coverage, select
selected images, derive Shot order, or decide delete/discard scope.

`routes/projects.ts` mounts the focused route and contains no Shot Plan
behavior. The existing route project-data pick is extended with the exact
list/delete, selection, candidate-discard, and
selection-context Core entrypoints. The existing generic Asset page remains the
candidate-list boundary: `asset-request.ts` adds the `shot` target defined by
plan 0156, while `assets.ts` keeps delegating to `listAssetPage`. Do not add a
broad `shotPlanService` object or generic durable state patch method.

### Intended browser service layout

```text
packages/studio/src/services/
  studio-shot-plans-api.ts
  studio-shot-plans-contracts.ts
```

The API module performs requests and structured response handling. The
contracts module contains browser DTO types derived from the accepted Core
projection plus browser-only media URLs. Neither module owns React state or
domain validation.

### Intended feature layout

```text
packages/studio/src/features/movie-studio/
  shot-plans/
    scene-shot-plans-tab.tsx
    shot-plan-inspector-dialog.tsx
    shot-plan-beat-links.tsx
    shot-plan-shot-rail.tsx
    shot-image-candidates-dialog.tsx
    shot-plan-shot-content.tsx
    shot-brief-grid.tsx
    shot-description-viewer.tsx
    use-scene-shot-plans.ts
    use-shot-image-candidates.ts
    shot-plans.test.tsx
  shot-design/
    shot-design-media.ts
    generated/
      ...
```

`scene-shot-plans-tab.tsx` owns list-state composition only.
It maps the accepted list item directly into `MediaCard`; do not add a
pass-through Shot Plan card wrapper.
`shot-plan-inspector-dialog.tsx` owns the dialog frame, focus inputs, header,
and panel composition only. The rail, details, brief, Beat previews, and
description stay focused in the named modules.
`shot-image-candidates-dialog.tsx` owns only the transient dialog frame and
candidate-card composition. Its hook calls the focused browser service and
subscribes to the same Shot Plans resource key; it does not own image
eligibility or deletion rules.

The generated Shot Design files move from their current private
`shot-authoring` location to `shot-design/generated`. Existing Shot authoring
and the new Shot Plans feature import the shared catalog directly. Do not keep
an old-path re-export or wrapper.

### Intended shared UI layout

```text
packages/studio/src/ui/
  hover-card.tsx
  media-card/
    media-card-contract.ts
    media-card.tsx
    media-card-actions.tsx
    media-card-visual.tsx
    media-card-mosaic-grid.tsx
    media-card.test.tsx
  code-mirror-editor.tsx
  markdown-code-editor-theme.ts
```

`media-card-contract.ts` adds the bounded public union member.
`media-card-visual.tsx` keeps its shallow media-kind dispatch and delegates the
new branch to `media-card-mosaic-grid.tsx`. The mosaic renderer owns only
count-to-layout behavior.

Replace the current inspect-only lower action directly with a bounded
`MediaCardCornerAction` union for `inspect` and `edit`. The action owns its
Lucide icon and either `always` or `hover-or-focus` visibility; callers cannot
pass React nodes, CSS classes, or arbitrary positions. Update existing
inspection callers directly with no compatibility prop. Replace the existing
single selection shape with a bounded `toggle`/`choose` union. Current
Cast/Location pick controls use `toggle`; Shot-image candidates use `choose`,
which renders the selected state as a persistent indicator rather than a clear
action.

The current prompt editor theme keeps prompt mention and tooltip styles in its
feature. Only its genuinely generic Markdown editor base and highlight style
move to `markdown-code-editor-theme.ts`.

### Files expected to shrink or disappear

- Delete `scene-shots-placeholder-tab.tsx`.
- Remove the current private generated Shot Design asset folder after direct
  callers use the shared location.
- Remove the old `shots` scene-tab spelling from current selection, route,
  event, test, and E2E callers.
- Remove the duplicate Studio-owned `StudioSelection` and `ScenePanelTab`
  declarations and update callers to the Core owner directly.
- Do not leave forwarding components, compatibility parsers, re-export stubs,
  or dead placeholder tests.

### Explicitly forbidden code shape

- No plan membership, Beat coverage, selected-image eligibility,
  selection-on-discard rule, Shot ordering, or delete-scope rule in
  routes, services, hooks, or React.
- No raw `<button>`, `<dialog>`, or other raw interactive control in feature
  code.
- No `ShotPlanInspector` god component containing fetch, delete, URL selection,
  mosaic layout, rail, brief cards, motion preview, and CodeMirror setup.
- No arbitrary row/column/render-slot or caller-provided icon API on
  `MediaCard`.
- No new generic inspector shell for one consumer.
- No semantic parsing, completion scoring, or brief/description comparison.
- No local copy of Shot Design image or motion Assets.
- No raw filenames, ids, relationship roles, or generated placeholder labels
  in visible UI.
- No selectable disabled Generations route or hidden Generations request.
- No compatibility alias for `shots`.

### Stop conditions

Stop implementation and revise the shape if:

- plan 0156's model or report cannot supply canonical Shot order, covered Beat
  positions, or selected Assets;
- a route must query the database directly or infer ownership;
- React must read-modify-write the complete Shot Plan to delete or focus it;
- candidate deletion can bypass Core's selected-selected guard;
- `MediaCard` requires Shot Plan-specific fields or business copy;
- the adaptive mosaic API grows beyond bounded image inputs and overflow
  presentation;
- the lower-corner action grows beyond the accepted icon/visibility union or
  accepts arbitrary render content;
- the shared Shot Design module begins owning Shot Plan state or vocabulary
  validation;
- the inspector feature cannot be reviewed as focused files with a thin frame;
- an `index.ts` grows into an implementation switchboard;
- accessibility would require a parallel custom control instead of extending a
  local UI primitive;
- a checklist item can be completed only by accepting an oversized or
  cross-layer implementation.

## Public Contracts

### Scene panel selection

Replace the current stable scene tab union directly:

```ts
export type ScenePanelTab = "narrative" | "beats" | "shotPlans";
```

Replace the current `scene` branch of `StudioSelection` directly:

```ts
type SceneStudioSelection = {
  type: "scene";
  id: string;
  sceneTab?: ScenePanelTab;
  beatId?: string;
  shotPlanId?: string;
  shotId?: string;
};
```

The snippet names the branch for clarity only. Keep it inline in the existing
Core-owned `StudioSelection` union; do not introduce a parallel exported type.

Selection invariants are:

- `shotPlanId` is valid only for the selected Scene and
  `sceneTab: "shotPlans"`;
- `shotId` requires `shotPlanId`;
- `shotId` must belong to that active Shot Plan;
- a valid Shot Plan with no Shots has no `shotId`;
- changing away from `shotPlans` clears `shotPlanId` and `shotId`;
- closing the dialog clears only `shotPlanId` and `shotId`;
- Beat focus remains owned by the Beats tab and does not coexist as active
  selection with Shot Plan focus.

`readStudioSelectionContext` validates these database-backed relationships and
returns the existing `StudioSelectionContextResult`. Missing or inactive plan,
Shot, or cross-owner focus uses the current generic `PROJECT_DATA119`
selection-not-found diagnostic. Add:

- `STUDIO_COORDINATION039` when Shot Plan focus is requested outside
  `sceneTab: "shotPlans"`;
- `STUDIO_COORDINATION040` when Shot focus is requested without a Shot Plan.

The Studio focus-request endpoint calls Core's current base Project focus
validator and `readStudioSelectionContext`. Delete its local
`validateSceneBeatSelection`; do not replace it with
`validateSceneShotPlanSelection`.

Use the current URL-backed Studio selection machinery with:

```text
sceneTab=shotPlans
shotPlan=<shot-plan-id>
shot=<shot-id>
```

The browser parser recognizes only the current names. There is no `shots`
translation branch.

### Disabled `LineTabs` item

Extend the local primitive's public item contract:

```ts
interface LineTabsItem<Value extends string> {
  value: Value;
  label: string;
  disabled?: boolean;
}
```

A disabled item:

- renders through the local Tabs primitive as disabled;
- cannot call the selection callback;
- uses the existing subdued disabled styling and native/primitive semantics;
- does not require a corresponding content panel;
- remains visible in the tab row.

This is a generic primitive capability. It must not encode a `generations`
special case.

### Server routes

Add these focused Shot Plan routes:

```text
GET    /studio-api/projects/:projectName/screenplay/scenes/:sceneId/shot-plans
DELETE /studio-api/projects/:projectName/screenplay/shot-plans/:shotPlanId
POST   /studio-api/projects/:projectName/screenplay/shot-plans/:shotPlanId/shots/:shotId/selected-image/:assetId
DELETE /studio-api/projects/:projectName/screenplay/shot-plans/:shotPlanId/shots/:shotId/images/:assetId
```

Candidate listing reuses the current generic read-only Asset page:

```text
GET /studio-api/projects/:projectName/assets?ownerKind=shot&ownerId=:shotId&type=shot_image&mediaKind=image
```

Use the existing common owner parser; do not add a second candidate list route
or let the browser choose another Asset type or media kind.

The list route:

1. reads `projectName` and `sceneId`;
2. calls `listSceneShotPlans`;
3. serializes the accepted Core list report;
4. decorates selected Shot and Storyboard AssetFile ids with the
   existing browser Asset file URL;
5. returns structured Core warnings and failures.

The delete route:

1. uses the current Studio API token middleware;
2. reads `projectName` and `shotPlanId`;
3. calls `deleteShotPlan`;
4. serializes the recoverable mutation report and Shot Plans resource key;
5. translates structured errors.

There is no request-body delete scope, Scene id on the delete request,
`cascadeImages` flag, or server-side fallback.

The selection route:

1. uses the current Studio API token middleware;
2. reads `projectName`, `shotPlanId`, `shotId`, and `assetId`;
3. calls `selectAsset` with `{ kind: "shot", id: shotId }`;
4. serializes the accepted Shot Plan mutation result and resource keys;
5. translates structured errors without deciding image eligibility.

The candidate-delete route follows the same adapter shape and calls
`discardAsset`. It passes no fallback candidate, replacement selection,
cascade flag, file path, or ownership metadata. Core clears selection when the
discarded candidate is selected and returns the recoverable Trash mutation
report.

### Browser list response

The browser response is a transport projection, not another domain model:

```ts
interface StudioShotPlansResponse {
  sceneId: string;
  shotPlans: StudioShotPlanListItem[];
  warnings: DiagnosticIssue[];
}

interface StudioShotPlanListItem {
  shotPlan: StudioShotPlan;
  coveredBeats: StudioShotPlanCoveredBeat[];
}

interface StudioShotPlan extends Omit<ShotPlan, "shots"> {
  shots: StudioShot[];
}

interface StudioShot extends Omit<Shot, "images"> {
  images: StudioAssetResponse[];
}

interface StudioShotPlanCoveredBeat {
  beat: Beat;
  position: number;
  storyboardImage: StudioAssetResponse | null;
}
```

Use the repository's existing structured diagnostic and browser Asset media
types when they already express these fields. Do not create duplicate
convenience mirrors solely to rename current types.

The browser reuses the common Asset shape and derives owner-independent file
URLs from Asset and AssetFile ids. It does not expose provider upload URLs,
local absolute paths, prompts, or receipts.

The candidate service returns the common Asset page, preserves Core page order,
and resolves each `shot_image` Asset's primary image file for presentation.
Selected state comes from `AssetPage.selectedAssetId`, which must agree with
`Shot.selectedImageId`; it is not duplicated on each candidate.

### Browser API

The focused service exports:

```ts
listStudioSceneShotPlans(input: {
  projectName: string;
  sceneId: string;
  signal?: AbortSignal;
}): Promise<StudioShotPlansResponse>;

deleteStudioShotPlan(input: {
  projectName: string;
  shotPlanId: string;
}): Promise<RecoverableMutationReport>;

listStudioShotImageCandidates(input: {
  projectName: string;
  shotId: string;
  signal?: AbortSignal;
}): Promise<StudioShotImageCandidate[]>;

setStudioShotSelectedImage(input: {
  projectName: string;
  shotPlanId: string;
  shotId: string;
  assetId: string;
}): Promise<StudioShotPlanMutationResponse>;

deleteStudioShotImageCandidate(input: {
  projectName: string;
  shotPlanId: string;
  shotId: string;
  assetId: string;
}): Promise<RecoverableMutationReport>;
```

These are the accepted public browser-service names. Do not add a class,
repository, alias, or React-aware service.
`deleteStudioShotPlan` sends an authenticated `DELETE` request with no body.
Both image mutations are authenticated and send no body. Candidate listing
owns the fixed `shot_image`/`image` filters, follows the current Asset-page
cursor until completion, preserves Core order, and forwards its abort signal.

`StudioShotPlanMutationResponse` is the browser-safe serialization of the
accepted `ShotPlanReport`: it contains `valid`, `warnings`, `resourceKeys`, and
the updated browser-safe Shot Plan list item. It does not expose
`projectFolder`, project-relative paths, relationship records, prompts, or
receipts.

### Shot Plans resource key

Plan 0156 renames the resource to:

```text
surface:scene:<scene-id>:shot-plans
```

The Shot Plans and open candidate queries subscribe to that exact key through
the existing Studio resource invalidation mechanism. Plan delete,
selected selection, candidate discard/restore, and later CLI/agent
mutations refresh the relevant projections. This plan does not add an event bus
or a Shot-specific cache key.

### Bounded `MediaCard` mosaic

Extend the local card media union with a deliberate bounded variant:

```ts
interface MediaCardMosaicGridItem {
  key: string;
  imageUrl: string;
  alt: string;
}

interface MediaCardMosaicGrid {
  kind: "mosaic-grid";
  items: MediaCardMosaicGridItem[];
}
```

The public variant accepts ordered image items only. It owns the count-to-grid
layout and overflow tile. It does not accept:

- row or column counts;
- CSS class overrides per tile;
- arbitrary React nodes;
- Shot, Shot Plan, Asset, or Beat objects;
- overlay copy;
- a caller-provided overflow algorithm.

The variant accepts any count defensively, but displays at most nine cells
according to the accepted table. The existing single-image, video, and
four-image `mosaic` variants keep their current contracts.

Alt text is quiet and meaningful, for example `Selected image for Shot
3`. It must not expose file names or ids. The card's authored title and
coverage remain visible outside the individual image alt text.

### Bounded `MediaCard` corner and selection actions

Replace the current inspect-only prop directly:

```ts
type MediaCardCornerAction =
  | {
      kind: "inspect";
      label: string;
      visibility: "always" | "hover-or-focus";
      onAction: () => void;
    }
  | {
      kind: "edit";
      label: string;
      visibility: "always" | "hover-or-focus";
      onAction: () => void;
    };

type MediaCardSelection =
  | {
      kind: "toggle";
      selected: boolean;
      selectedLabel: string;
      unselectedLabel: string;
      onToggle: () => void | Promise<void>;
    }
  | {
      kind: "choose";
      selected: boolean;
      selectedLabel: string;
      unselectedLabel: string;
      onChoose: () => void | Promise<void>;
    };
```

`MediaCardProps.cornerAction` replaces `inspectionAction`; update every current
caller directly. `inspect` renders the current `FileSearch` affordance and
`edit` renders `Pencil`. The shared action renderer owns lower-right placement,
tooltip, local `Button`, event isolation above whole-card activation, and the
accepted visibility transition. It does not accept a caller icon, position,
variant, class name, or React node.

Update current Cast/Location selection callers directly with `kind: "toggle"`
and preserve their current clear behavior. Shot-image candidates use
`kind: "choose"`: an unselected candidate renders the current select `Button`
and calls `onChoose`, while a selected candidate renders the same lower-right
check treatment as a labelled, non-interactive state indicator. The choose mode
has no clear callback and does not pretend the selected state is disabled or
unavailable.

### Shared Shot Design media

`shot-design-media.ts` exposes presentation lookup by exact authored vocabulary
value:

```ts
interface ShotDesignStill {
  kind: "still";
  imageUrl: string;
}

interface ShotDesignMotion {
  kind: "motion";
  posterUrl: string;
  videoUrl: string;
}

getShotSizeMedia(value: string): ShotDesignStill | null;
getCameraAngleMedia(value: string): ShotDesignStill | null;
getShotMovementMedia(value: string): ShotDesignMotion | ShotDesignStill | null;
```

Use a typed record or focused lookup tables rather than a long conditional
chain. These are presentation lookups only:

- unknown custom values return `null`;
- values are not normalized, repaired, or rejected;
- the functions do not inspect prose or generated media;
- the UI always renders the exact authored label whether media exists or not.

### Hover Card

Add the local shadcn-style `HoverCard` primitive using the already-installed
Radix dependency. Export the conventional Root, Trigger, and Content wrappers
under the local naming pattern.

It must support:

- pointer hover;
- the primitive's keyboard-focus open/close behavior;
- portal positioning and collision handling;
- current dark surface, border, radius, and shadow tokens;
- caller-provided semantic trigger and content;
- no Shot Plan or Asset-specific API.

Feature code consumes this primitive instead of raw interactive HTML.
Hover Card content is a supplemental, non-interactive image preview. The Beat
position and title remain in the focusable trigger because Radix Hover Card
content is not a keyboard navigation surface.

### Markdown editor theme

Extract a generic read-only-capable Markdown CodeMirror base from the current
prompt-specific theme:

```ts
export const markdownCodeEditorTheme: Extension;
export const markdownCodeHighlightStyle: HighlightStyle;
```

Use the existing CodeMirror component's current read-only contract. The Shot
description viewer owns only Markdown language setup, the generic theme, exact
value, and accessibility label. Prompt mentions, provider styling, tooltips,
and prompt behaviors remain in the prompt feature.

## Visual And Interaction Specification

### Scene grid geometry

- Reuse the current Scene panel content width and page padding.
- Reuse `MediaCardGrid` rather than specifying a separate CSS grid.
- Preserve the current card aspect ratio, hover controls, overlay gradient,
  border radius, and focus behavior.
- Allow authored titles to truncate using the existing MediaCard policy.
- Keep the coverage line to one compact line; use a meaningful accessible
  title/label for full coverage when visual truncation occurs.
- Do not display raw Beat ids when coverage cannot be resolved. Core warnings
  remain diagnostics, while the overlay shows only resolved covered Beats.

### Mosaic visual treatment

- Tiles use `object-fit: cover`.
- Internal gaps use the current card border/background token, not an invented
  bright divider.
- The first eight images preserve canonical order at 10+ images.
- The `+N` tile uses the same neutral media surface with centered subdued text.
- The overflow tile has sufficient text contrast and an accessible label such
  as `2 more selected images`.
- Missing or failed browser images use the existing broken-media treatment; the
  browser does not substitute an unrelated Shot image.

### Dialog geometry

Use the Generation Request inspector's current
`h-[760px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)]`
Dialog geometry. This is a desktop layout, not a mobile breakpoint project.

The dialog structure is:

```text
Dialog
  Header
    Shot Plan title
    Covered Beat links
  Resizable body
    Shot rail
    Shot detail
      Shot title
      Five-card brief
      Markdown description
  Footer
    Close
```

Use one visible `Close` Button in the footer plus `DialogContent`'s current
upper-right accessible Close affordance. Do not add Save, Done, Previous, Next,
Generate, or general Shot/plan Edit controls. The rail-card image-management
action is the one accepted editing exception.

The candidate dialog uses the existing nested Radix Dialog behavior and the
`ReferencePickerDialog` geometry named above. Its scroll region, not the full
inspector, owns candidate overflow. The candidate dialog has no Save/Done
footer because selection and recoverable delete apply immediately through
focused commands; closing it uses the standard Dialog close affordance.

### Header and Beat preview

- Let Beat chips wrap within the header rather than forcing horizontal page
  overflow.
- Use compact neutral chips; amber is reserved for active selection, not every
  covered Beat.
- Include `Beat <position>` and the authored Beat title.
- Use an `Image` icon only where the current icon language needs to signal that
  a preview exists; do not show a false preview affordance when none exists.
- Hover Card content uses the selected storyboard image with a stable
  constrained preview size and meaningful alt text.
- Focus returns to the trigger when the preview closes according to the Radix
  primitive behavior.

### Rail item geometry

- The image occupies the visual majority of the item.
- The Shot-number badge is circular, upper-left, high-contrast, and concise.
- The Timer badge is lower-left and rendered only for an authored duration.
- The Pencil action is lower-right and appears on card hover or focus.
- The duration formatter preserves meaningful fractional seconds without
  manufacturing frame precision.
- The selected border/background is amber and does not obscure the image.
- The complete item uses `MediaCard` activation through the local `Button`
  primitive, not a raw button or clickable `div`.
- Focus, selected, hover, and disabled states remain visually distinct.

### Candidate-card geometry

- Reuse `MediaCardGrid` and the current card image framing; do not add a
  Shot-specific gallery layout.
- Keep candidate cards visually quiet: image, selection state, and available
  delete control carry the task without filenames or generated labels.
- The selection control is lower-right; the unselected-only delete control is
  upper-right.
- The selected state remains visible when the pointer leaves so the active
  selected is never hover-dependent.
- Delete is hover/focus-revealed, with a keyboard-reachable confirmation.

### Brief-card geometry

At the supported dialog width, use a five-column grid with equal-height cards.
Each card uses:

- a compact subject label and matching Lucide icon;
- a media region for Framing, Camera, and Motion when known media exists;
- exact authored value text;
- text-led content for Optics and Lighting;
- quiet neutral borders and no status color.

Framing may place start and end visuals side by side when both exist. If only
one exists, label it `Start` or `End` rather than pretending it represents
both. If start and end are equal, retain the authored relationship without
inventing camera movement.

Camera presents angle only. Shot size remains Framing; it is not duplicated
into the Camera card.

Optics order is:

1. `intent`;
2. focal length when provided;
3. depth of field when provided;
4. focus target when provided.

Lighting shows the intent text without trying to split it into direction,
source, softness, color, or time of day. Those concepts remain authored prose.

### Description geometry

- Place the description below the brief grid in the detail column.
- Give it the remaining vertical space with its own scroll area.
- Label it `Description`.
- Render exact Markdown in a read-only CodeMirror editor with
  `aria-readonly="true"` through the accepted component contract.
- Preserve selection and copying of text.
- Do not add editing chrome, line actions, AI controls, or completeness
  indicators.

### Motion and reduced motion

Known motion clips preview only while their brief card is hovered or focused.
The component checks the current reduced-motion preference:

- reduced motion: show poster only;
- normal motion: play muted inline video on hover/focus, then pause and reset;
- video failure: retain poster and text;
- no clip: retain still/text fallback.

No autoplaying motion runs when the dialog first opens.

### Loading, empty, and failure states

The feature explicitly covers:

- list loading;
- list request failure with structured message and retry;
- empty Scene;
- plan with no Shots;
- Shot with no selected image;
- plan with no selected images;
- covered Beat with no storyboard image;
- missing optional brief fields;
- custom brief vocabulary without catalog media;
- selected or storyboard browser image failure;
- candidate-list loading, structured failure/retry, and empty state;
- candidate image failure;
- candidate selected or discarded from another surface while the candidate
  dialog is open;
- plan deleted from another surface while the dialog is open;
- selected Shot removed from another surface while the dialog is open.

External mutation recovery uses a fresh list/selection projection. It does not
silently keep a stale aggregate or synthesize a replacement Shot locally.

## Implementation Slices

### Slice 1: record the UI decision and dependency

- Add Decision 0065 for the bounded adaptive `MediaCard` mosaic and explicitly
  preserve Decision 0053's Visual Language 2x2 variant.
- Add a concise narrowing notice to Decision 0053 pointing to Decision 0065;
  do not rewrite its historical content.
- Cross-link plans 0156 and 0157 and retain their ownership split.
- Do not begin UI implementation until plan 0156's browser-safe model and
  resource key are accepted.

### Slice 2: replace the scene selection and tab contract

- Replace `shots` with `shotPlans` in the Core Scene tab union, Studio URL
  parser/serializer, scene panel, current selection, events, tests, and E2E
  callers.
- Remove the duplicate Studio type declarations and import the Core-owned
  browser-safe selection types at each caller.
- Add `shotPlanId` and `shotId` to the current Studio focus contract and
  validate their invariants in Core coordination.
- Extend `readStudioSelectionContext` for plan/Shot membership and resource
  keys, then make the Studio focus-request route consume that Core result.
- Remove the existing route-local Beat membership validator; add no route-local
  Shot Plan equivalent.
- Add the generic disabled item capability to `LineTabs`.
- Render `Generations` as a visible disabled item without adding it to the
  selectable union.
- Delete the current Shot placeholder component and tests.

### Slice 3: add thin list and mutation HTTP/browser boundaries

- Extend the exact project-data pick with `listSceneShotPlans`,
  `deleteShotPlan`, common `selectAsset`, and common `discardAsset`.
- Add the four focused Shot Plan routes.
- Reuse the existing generic Asset owner parser with `shot` and reuse its
  page route for the fixed candidate query.
- Serialize selected and storyboard images with generic Asset file URLs.
- Add the typed browser contracts and focused plan/candidate request functions.
- Subscribe the list query to
  `surface:scene:<scene-id>:shot-plans`.
- Preserve structured warnings and error translation.

### Slice 4: add the bounded mosaic and Shot Plan grid

- Add the `mosaic-grid` MediaCard variant and deterministic layouts.
- Replace the inspect-only card action with the bounded inspect/edit
  corner-action union and replace selection with the bounded toggle/choose
  union.
- Update current card callers directly and keep current media/action behavior
  otherwise unchanged.
- Add the Shot Plans query hook, loading/error/empty states, and three-column
  scene tab.
- Map only selected images in canonical Shot order.
- Add meaningful title/coverage overlay, delete, and inspect actions.
- Add recoverable delete confirmation and post-success invalidation/focus
  cleanup.

### Slice 5: share Shot Design presentation media

- Move the existing generated Shot Design media to the shared feature domain.
- Add typed still/motion lookup functions for shot size, camera angle, and
  movement.
- Update current Shot authoring imports directly.
- Do not leave an old-path facade or duplicate generated files.
- Cover custom values and missing motion files with text-first fallbacks.

### Slice 6: add inspector focus, header, and rail

- Add URL-backed plan/Shot selection behavior.
- Add the focused large Dialog frame and header.
- Add the local Hover Card primitive and covered Beat image previews.
- Add the horizontal resizable body with constrained rail.
- Add accessible `MediaCard` Shot selection, image states, number badge,
  lower-left Timer duration badge, lower-right hover/focus Pencil action, amber
  selection, and independent scrolling.
- Add the focused candidate-image dialog, lazy candidate query, card selection,
  unselected-only recoverable delete, and resource invalidation.
- Cover no-Shot plans without creating a selected id.

### Slice 7: add brief and canonical description

- Add the five-card brief grid with accepted ownership of each value.
- Add known media, custom text, missing-field, and motion fallback behavior.
- Make Optics and Lighting intent primary and optics technical values
  secondary.
- Split only generic Markdown CodeMirror theme from prompt-specific theme.
- Add the exact read-only Markdown description surface.
- Add reduced-motion and motion failure behavior.

### Slice 8: verify integrated desktop behavior

- Add focused component, route, service, coordination, primitive, and E2E
  coverage.
- Create Shot Plan fixtures only in a temporary clone of `urban-basilica`.
- Exercise no images, 1, 2, 3, 4, 5, 9, 10, and more than 10 selected-image
  mosaics.
- Exercise a ten-Beat covered header and keyboard preview.
- Exercise multiple candidates for one Shot, in-dialog selected
  selection, unselected candidate delete/restore, and selected-delete
  rejection.
- Verify delete/restore/invalidation against plan 0156's real Core lifecycle.
- Inspect the dialog visually at the supported desktop viewport.
- Update current docs and run final architecture-shape review.

## Tests And Guardrails

Tests protect stable behavior and ownership boundaries. They must not inventory
private component or handler names as source-text needles.

### Core Studio selection tests

Cover:

- `shotPlans` round-trips through current selection parsing and serialization;
- the obsolete `shots` value is not a recognized current tab;
- valid Shot Plan focus belongs to the selected Scene;
- valid Shot focus belongs to the focused Shot Plan;
- `shotId` without `shotPlanId` is rejected or cleared through the one accepted
  coordination behavior;
- a Shot Plan with no Shots permits plan focus without Shot focus;
- leaving the Shot Plans tab clears nested focus;
- closing the dialog clears nested focus but keeps `shotPlans`;
- deleted or unavailable plans and Shots return the current structured
  selection diagnostic/normalization behavior;
- no Beat or image domain rule is reimplemented in selection parsing.

### Server route tests

Cover:

- the list route passes exact project and Scene ids to Core;
- the response preserves Core plan, Shot, and covered Beat order;
- only selected images receive browser file URLs;
- storyboard previews receive generic Asset file URLs;
- absent images remain `null`;
- provider URLs and local absolute paths are never serialized;
- Core warnings are retained;
- structured Core errors are translated through the current HTTP mechanism;
- delete passes only the Shot Plan id to Core;
- delete returns the recoverable mutation report and exact resource key;
- selected-image selection passes exact plan, Shot, and Asset ids to Core with
  no body;
- candidate delete passes the same exact ids to
  `discardAsset`;
- candidate delete returns the recoverable mutation report;
- `ownerKind=shot` maps to the exact Core `AssetOwner`;
- candidate query fixes `shot_image` and `image` in the browser service;
- routes contain no delete cascade, replacement candidate, ownership,
  membership, or eligibility branch.

### Browser service tests

Cover:

- exact method, path, and encoding for plan list/delete, candidate list,
  selected selection, and candidate delete;
- abort signal forwarding for plan and candidate lists;
- candidate pagination preserves Core order;
- structured non-success parsing;
- current browser contracts for selected and storyboard media;
- no React state or domain normalization in the service.

### `LineTabs` tests

Cover:

- disabled item is visible;
- disabled item exposes the primitive's disabled semantics;
- pointer and keyboard activation do not select it;
- enabled item behavior remains unchanged;
- a disabled item does not require selectable content.

### `MediaCard` mosaic tests

Use table-driven behavior for counts:

- 0 uses current empty media;
- 1 renders one full tile;
- 2 renders two equal tiles;
- 3 renders three columns;
- 4 renders 2x2;
- 5, 6, 7, 8, and 9 use the bounded three-column grid;
- 10 renders the first eight plus `+2`;
- 14 renders the first eight plus `+6`;
- input order remains display order;
- overflow has a useful accessible label;
- existing image, video, and four-image mosaic behavior does not change.

Protect the stable variant contract and runtime layout behavior. Do not assert
private CSS helper names or an inventory of internal render functions.

### `MediaCard` action tests

Cover:

- current inspect action retains its icon, label, click isolation, and always
  visible behavior after the direct contract replacement;
- edit action uses the Pencil icon and appears on pointer hover or focus;
- edit activation does not also trigger whole-card activation;
- choose mode renders an actionable control for an unselected card and a
  persistent labelled indicator for the selected card;
- choose mode has no clear path;
- current toggle selection and top-right delete behavior remain unchanged;
- the public contract accepts no caller icon, position, class, or React node.

### Shot Plans tab tests

Cover:

- loading, failure/retry, empty, and populated states;
- exactly one card per Core list item;
- three-column grid uses the existing grid primitive;
- card mosaic includes selected images only;
- canonical Shot order is preserved;
- title and covered Beat position copy is meaningful;
- raw ids, filenames, and relationship roles are absent;
- no create card or general Shot Plan/Shot authoring control appears;
- inspect sets plan and first-Shot focus;
- inspect on an empty plan sets plan focus only;
- delete confirmation describes recoverable plan/image Trash behavior;
- successful delete invalidates the exact Shot Plans resource and clears
  matching nested focus;
- failed delete retains the card and reports the structured error.

### Inspector tests

Cover:

- valid focused plan opens the dialog;
- close keeps the `shotPlans` tab;
- initial and changed Shot focus follow canonical order;
- externally removed focus resolves through refreshed coordination/list state;
- header uses authored title and covered Beat order;
- Beat trigger works with pointer and keyboard;
- storyboard preview appears only when real media exists;
- no-image Beat remains meaningful text;
- rail has independent scroll and the accepted resize bounds;
- rail items use shared card activation and actions;
- selected Shot uses amber, not green;
- missing selected image uses the quiet icon state;
- duration badge appears only when authored;
- duration badge is lower-left and Pencil action is lower-right;
- Pencil action is pointer- and keyboard-accessible and opens the exact Shot's
  candidate dialog;
- duration has no start/end/range UI;
- fractional duration formatting does not add false precision;
- no-Shot plan shows a deliberate empty detail state;
- footer has Close and no Save/general-edit/Generate action.

### Shot image candidate dialog tests

Cover:

- the dialog loads candidates only after opening and preserves Core order;
- loading, structured failure/retry, empty, and populated states keep a stable
  frame;
- every candidate is a `MediaCard` with meaningful image alt text and no raw
  filename, id, role, or fabricated quality label;
- the selected card has a persistent, labelled bottom-right selected
  indicator that does not look disabled;
- each unselected card has an actionable bottom-right selection control;
- selecting calls the exact focused mutation, leaves the gallery open, and
  refreshes candidate, rail, and plan mosaic projections through the Shot Plans
  resource key;
- every candidate card exposes top-right hover/focus delete;
- delete confirmation says the image moves to Trash and can be restored;
- delete calls the focused recoverable mutation and does not send a replacement
  or cascade scope;
- successful delete removes the candidate through refreshed Core state and
  clears selection when that candidate was selected;
- a concurrent delete failure retains the card, refreshes current
  state, and displays the structured diagnostic;
- candidate close restores focus to the rail Pencil action and leaves the
  inspector and URL-backed focus unchanged;
- keyboard focus reaches select, delete, confirmation, retry, and close;
- no clear, generate, import, or bulk controls appear.

### Brief and description tests

Cover:

- Framing owns start/end shot size and labels single-ended values accurately;
- Camera owns angle only;
- Motion owns movement and always renders exact text;
- known values use shared catalog media;
- unknown custom values render exact text without failure;
- missing Rack Focus motion media uses text/static fallback;
- Optics renders intent before optional technical metadata;
- Lighting renders exact intent without semantic tokenization;
- missing fields stay quiet and do not produce invented labels;
- reduced motion suppresses video playback;
- normal hover/focus preview is muted and resets;
- video failure preserves poster/text;
- description is exact, selectable, read-only Markdown;
- description is not semantically compared with brief values.

### E2E desktop journeys

At the supported desktop viewport:

1. open a Scene, select Shot Plans, and confirm Generations is visible but
   disabled;
2. inspect a plan with several Shots, switch rail selection, resize the rail,
   keyboard-focus a covered Beat preview, and close back to the grid;
3. open one Shot's candidate dialog, select another image, verify the rail and
   plan mosaic refresh, delete/restore one unselected image, and prove the
   selected image cannot be deleted;
4. reload a valid plan/Shot deep link and confirm focus;
5. inspect a plan with no Shots and a Shot with no image or optional brief
   fields;
6. delete a plan, confirm its card disappears through resource invalidation,
   restore through the existing Trash surface, and confirm it returns with its
   images;
7. exercise shared-image copy behavior from plan 0156 so deleting one plan
   does not break the active copy's selected image.

Do not add mobile viewport tests.

### Stable architecture guardrails

- Keep import-boundary tests broad: React feature code may import browser
  services, browser-safe Core/client contracts, and local UI, but not Core
  database or Studio server modules.
- Prove invalid plan/Shot focus fails in Core before React consumes it.
- Prove server delete cannot supply arbitrary cascade state.
- Protect the bounded `MediaCard` public union shape, not private renderer
  names.
- Do not add source-text tests that enumerate current component, route-handler,
  lookup-function, or local-variable names.
- Inspect indexes for thin public entrypoint behavior rather than banning one
  historic helper string.

## Documentation

Add Decision 0065 with:

- Context: `MediaCard` currently has an accepted Visual Language 2x2 mosaic,
  while Shot Plan cards need a deterministic ordered layout for variable
  selected-image counts.
- Decision: retain the exact current mosaic and add a separate bounded
  `mosaic-grid` variant with the accepted count table and overflow behavior.
- Boundaries: images only, no arbitrary grid configuration, no domain objects,
  no render slots, no interaction hidden in overflow.
- Consequences: consistent variable-count cards, accessible overflow, and a
  small shared primitive rather than plan-local layout.

Add only a concise narrowing notice to Decision 0053 pointing to 0065. Preserve
0053's historical decision and accepted Visual Language behavior.

Update current documentation where relevant:

- `docs/design-guidelines.md` with the amber selection, lower-left
  duration-badge/lower-right card-action separation, bounded-mosaic,
  candidate-card selection/delete, and intent-led brief patterns only if these
  are now durable reusable UI guidance rather than feature-local details;
- `docs/architecture/front-end-guidelines.md` only if the new browser service
  or shared presentation-media folder establishes a reusable accepted
  convention;
- current Studio surface/selection documentation for `shotPlans`,
  `shotPlanId`, and `shotId`;
- current API documentation for the four Shot Plan browser routes and reused
  Shot-target Asset query;
- current testing guidance with the desktop Shot Plans E2E journey.

Do not:

- copy the full feature specification into general design guidelines;
- rewrite Decisions 0041, 0053, 0061, or 0062;
- edit historical plans for a tab-name sweep;
- document a selectable Generations surface;
- describe mobile support;
- document old and new tab spellings as coexisting.

## Final Verification

Implementation is complete only after:

1. Plan 0156's Core model, selected-image, lifecycle, report, and resource-key
   contracts are implemented and its focused checks pass.
2. Focused Core Studio selection tests pass.
3. Focused Studio route, browser service, `LineTabs`, `MediaCard`, Shot Plans,
   candidate-dialog, and CodeMirror tests pass.
4. Current Shot authoring still renders all moved Shot Design media without an
   old-path facade.
5. Existing Visual Language cards still use and visually preserve the exact
   four-image mosaic.
6. Existing prompt editors preserve their Markdown and prompt-specific
   presentation after the generic theme split.
7. The full desktop E2E journeys pass.
8. A temporary `urban-basilica` clone verifies the ten-Beat header and
   selected-image mosaic edge counts without mutating the active project.
9. A visual inspection at the supported desktop viewport confirms:
   - tabs align with current Scene navigation;
   - Generations is visibly disabled;
   - card crops, gaps, radii, overlays, and focus states are correct;
   - the dialog does not crop header, rail, brief cards, or footer;
   - rail resizing keeps both columns usable;
   - amber selection is clear without appearing as success;
   - rail cards share the current card language, with edit lower-right and
     duration lower-left;
   - candidate selection is persistent and clear, while unselected-only delete
     remains discoverable on pointer hover and keyboard focus;
   - the candidate dialog layers and returns focus correctly over the
     inspector;
   - intent text is visually primary for Optics and Lighting;
   - duration reads as a small image badge, not a timeline;
   - empty and fallback states remain quiet and meaningful.
10. Keyboard-only inspection covers tabs, card controls, both dialogs, Beat
    preview, rail selection/edit, candidate select/delete, resize handle where
    supported, description selection, and Close.
11. Reduced-motion inspection confirms no unsolicited motion preview.
12. Run the repository's focused package commands and then:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

13. Inspect `git diff --stat` and the complete diff.
14. Inspect every new or heavily modified file for architecture shape.
15. Confirm `index.ts` files remain thin entrypoints unless this plan
    explicitly says otherwise.
16. Confirm there is no compatibility alias, re-export facade, route-local
    business rule, React-local domain validation, raw feature control, generic
    inspector framework, arbitrary mosaic API, or arbitrary card-action API.
17. Confirm no checklist item was satisfied by accepting code that is too
    large or cross-layer to review.

## Completion Checklist

### Review Area

- [ ] Confirm plan 0156 is accepted as the domain/CLI/skill dependency.
- [ ] Confirm this plan remains read-mostly apart from recoverable plan/image
      delete and focused selected-image selection.
- [ ] Confirm every user clarification is represented in the Requirement
      Ledger and product behavior.
- [ ] Confirm there are no unresolved product or interface-level questions.
- [ ] Confirm mobile, video, timeline, authoring, and selectable Generations
      work remain out of scope.
- [ ] Confirm the UI projects Core contracts rather than creating parallel
      Shot or image models.

### Architecture And Contracts

- [ ] Replace `shots` with `shotPlans` directly in the selectable scene-tab
      contract.
- [ ] Remove duplicate Studio selection/tab type declarations and update
      callers to import the Core owner directly.
- [ ] Add `shotPlanId` and `shotId` to the current Core-owned Studio focus.
- [ ] Enforce Scene/plan/Shot focus invariants in Core coordination.
- [ ] Extend `readStudioSelectionContext` and reuse it from the focus-request
      route for Beat, Shot Plan, and Shot membership.
- [ ] Remove the route-local Beat validator and add no route-local Shot Plan
      validator.
- [ ] Add no compatibility parser, alias, redirect, or fallback.
- [ ] Add exactly the plan list/delete and image select/delete HTTP routes.
- [ ] Reuse the generic Asset page for candidate listing and add only the
      `shot` target parser branch.
- [ ] Keep route handlers to parse, call, serialize, and translate.
- [ ] Add browser-safe image URLs without provider URLs or local paths.
- [ ] Add one focused browser API and contract boundary.
- [ ] Subscribe to the exact Shot Plans resource key from plan 0156.
- [ ] Add no generic patch API, server-side delete cascade flag, or React
      membership rule.
- [ ] Keep selection clearing on selected-candidate discard in Core.

### Scene Tabs And Grid

- [ ] Rename the visible tab to `Shot Plans`.
- [ ] Render `Generations` visible and disabled.
- [ ] Confirm disabled Generations cannot select, deep-link, mount content, or
      request data.
- [ ] Delete the current Shot placeholder and its stale tests.
- [ ] Reuse the current three-column `MediaCardGrid`.
- [ ] Cover loading, structured failure/retry, empty, and populated states.
- [ ] Render authored plan title and resolved covered Beat positions.
- [ ] Show no raw ids, filenames, roles, or fabricated card labels.
- [ ] Add no New Shot Plan card or general browser authoring control.

### MediaCard Mosaic

- [ ] Add the bounded `mosaic-grid` variant.
- [ ] Keep the existing exact four-image mosaic behavior unchanged.
- [ ] Implement 0, 1, 2, 3, 4, 5–9, and 10+ layouts exactly.
- [ ] Preserve canonical selected-image order.
- [ ] Render only selected images.
- [ ] Render first eight plus a ninth `+N` tile above nine.
- [ ] Give overflow and image tiles meaningful accessible labels.
- [ ] Add no arbitrary rows, columns, slots, domain inputs, or caller-provided
      overflow algorithm.
- [ ] Add Decision 0065 and only a narrowing notice to Decision 0053.

### MediaCard Actions

- [ ] Replace `inspectionAction` directly with the bounded
      `MediaCardCornerAction`.
- [ ] Support only `inspect`/`edit` icon kinds and
      `always`/`hover-or-focus` visibility.
- [ ] Keep lower-right placement, tooltip, shadcn `Button`, and click isolation
      inside the shared card.
- [ ] Replace selection with the bounded `toggle`/`choose` union.
- [ ] Preserve current toggle/clear behavior for existing callers.
- [ ] Render choose-mode selected state as a labelled non-interactive
      indicator, not a disabled button or clear action.
- [ ] Update current inspection callers directly with no compatibility prop.
- [ ] Add no caller-provided icons, positions, variants, class names, or React
      nodes.

### Delete And Resource Invalidation

- [ ] Use the local confirmation and Button primitives.
- [ ] State that the plan and its Shot images move to Trash and are restorable.
- [ ] Send only the Shot Plan id to the server.
- [ ] Delegate image ownership, shared-copy, and lifecycle rules to Core.
- [ ] On success, clear matching nested focus and invalidate the exact scene
      Shot Plans resource.
- [ ] On failure, retain the card and show the structured error.
- [ ] Verify delete/restore returns the plan and images.
- [ ] Verify deleting one copy does not break an active shared selected image.

### Shared Shot Design Media

- [ ] Move existing generated Shot Design media into the shared feature domain.
- [ ] Add typed presentation lookup for shot size, camera angle, and movement.
- [ ] Update current Shot authoring imports directly.
- [ ] Delete the old private asset location.
- [ ] Add no re-export stub, compatibility wrapper, or duplicated Asset files.
- [ ] Preserve exact authored custom vocabulary as text.
- [ ] Preserve text/static fallback for entries without motion media.

### Inspector Frame And Header

- [ ] Open a focused large read-mostly Dialog from Inspect.
- [ ] Select the first Shot when one exists.
- [ ] Support valid URL-backed plan/Shot focus after reload.
- [ ] Keep `shotPlans` selected when the dialog closes.
- [ ] Handle plans with no Shots without fabricating a Shot id.
- [ ] Render authored plan title and ordered covered Beat links.
- [ ] Add local shadcn-style Hover Card using the existing dependency.
- [ ] Provide equivalent pointer-hover and keyboard-focus Beat preview.
- [ ] Show no fake preview when the Beat has no selected storyboard image.
- [ ] Use generic Asset file URLs and meaningful alt text.
- [ ] Add no Save, general Edit, Done, Generate, Previous, or Next action.

### Shot Rail

- [ ] Use the current horizontal resizable-panel primitive.
- [ ] Set the rail to 24% default, 20% minimum, and 30% maximum.
- [ ] Keep rail and details independently scrollable.
- [ ] Use shared `MediaCard` activation, not raw interactive HTML or a one-off
      clickable panel.
- [ ] Render selected image or a quiet `ImageOff` state.
- [ ] Render canonical Shot-number badge.
- [ ] Render the Timer duration badge lower-left only when authored.
- [ ] Render the Pencil action lower-right on hover or focus.
- [ ] Ensure the Pencil action does not also select the rail card.
- [ ] Format fractional seconds without false frame precision.
- [ ] Render no range, start time, overlap, track, or sequencing hint.
- [ ] Use amber for selected and retain visible keyboard focus.
- [ ] Use no green selected state.

### Shot Image Candidate Dialog

- [ ] Open a feature-local Dialog for the exact Shot from the rail Pencil
      action.
- [ ] Follow the current `ReferencePickerDialog` `max-w-5xl`, `max-h-[65vh]`,
      220-pixel card-grid geometry.
- [ ] Keep candidate dialog state transient and out of URL-backed selection.
- [ ] Restore focus to the Pencil action on close without changing inspector
      focus.
- [ ] Load candidates lazily through the fixed Shot-target Asset query.
- [ ] Follow Asset-page cursors and preserve Core order.
- [ ] Cover stable loading, structured failure/retry, empty, and populated
      states.
- [ ] Render every candidate as a quiet `MediaCard` with no raw filename, id,
      role, or fabricated quality label.
- [ ] Show bottom-right selection on every candidate.
- [ ] Keep the selected candidate visibly checked as a labelled state
      indicator, not a clear action.
- [ ] Let unselected selection call the focused Core mutation and keep the
      dialog open.
- [ ] Refresh candidate cards, rail image, and plan mosaic through the exact
      Shot Plans resource key.
- [ ] Expose top-right hover/focus delete on every candidate.
- [ ] State that candidate delete moves the image to Trash and can be restored.
- [ ] Send no replacement candidate, relationship role, path, or cascade scope.
- [ ] Retain and refresh the card on concurrent delete failure.
- [ ] Add no clear, generate, import, search, pagination, or bulk controls.

### Brief And Description

- [ ] Render exactly Framing, Camera, Motion, Optics, and Lighting cards.
- [ ] Keep shot size under Framing and angle under Camera.
- [ ] Use known shared media and exact custom-text fallback.
- [ ] Keep Motion exact text even when a preview clip exists.
- [ ] Respect reduced motion and keep motion muted and user-triggered.
- [ ] Make Optics intent primary and optional technical fields secondary.
- [ ] Render Lighting intent as authored without semantic decomposition.
- [ ] Keep missing values quiet without `Auto`, `None`, or generic pick text.
- [ ] Split only generic Markdown editor theme from prompt-specific theme.
- [ ] Render exact Markdown in a selectable read-only CodeMirror surface.
- [ ] Add no completeness score, semantic comparison, repair, or rewrite.

### Accessibility And Design Quality

- [ ] Verify disabled, hover, focus, selected, loading, error, and empty states.
- [ ] Ensure required information is not available only on hover, color, image,
      or motion.
- [ ] Verify Beat preview, rail selection, dialog close, and card controls by
      keyboard.
- [ ] Verify candidate selection/delete/retry/close by keyboard.
- [ ] Verify useful accessible names for delete, inspect, edit, selection,
      duration, images, and overflow.
- [ ] Verify focus return and topmost-dialog focus trapping through local
      primitives.
- [ ] Verify reduced-motion behavior.
- [ ] Confirm card and dialog visuals use current tokens, radii, borders,
      typography, spacing, and amber selection language.
- [ ] Confirm Optics and Lighting intent remain visually primary.
- [ ] Perform desktop-only visual verification.

### Tests And Guardrails

- [ ] Add Core Studio selection and focus invariant tests.
- [ ] Add thin route and browser-service tests.
- [ ] Add generic disabled `LineTabs` tests.
- [ ] Add table-driven `MediaCard` count/overflow and bounded-action tests.
- [ ] Add Shot Plans list, delete, focus, candidate-dialog, and fallback
      component tests.
- [ ] Add inspector header, keyboard preview, rail, duration, brief, Markdown,
      and reduced-motion tests.
- [ ] Add supported desktop E2E journeys.
- [ ] Keep edge-case matrices at their owning layer.
- [ ] Use stable contract/runtime/import guardrails, not source-text
      implementation-name inventories.

### Documentation And ADR

- [ ] Add Decision 0065 with bounded adaptive mosaic ownership and limits.
- [ ] Add only a concise narrowing notice to Decision 0053.
- [ ] Keep Decisions 0041, 0053, 0061, and 0062 historically intact.
- [ ] Update current selection, route, design, frontend, and testing docs only
      where the feature establishes durable current guidance.
- [ ] Do not document old/new compatibility or selectable Generations.
- [ ] Do not edit historical plans for a naming sweep.

### Final Verification

- [ ] Confirm plan 0156's focused checks pass first.
- [ ] Run focused Core coordination and Studio checks.
- [ ] Confirm current Shot authoring still consumes moved shared media.
- [ ] Confirm current Visual Language mosaic remains unchanged.
- [ ] Confirm current prompt editor visuals remain unchanged.
- [ ] Complete temporary urban-basilica desktop journeys.
- [ ] Verify ten-Beat header, every mosaic edge count, delete/restore, and
      shared-copy image behavior.
- [ ] Verify candidate selection, unselected delete/restore, selected-delete
      rejection, and both-dialog focus behavior.
- [ ] Run root build, test, lint, and check.
- [ ] Inspect `git diff --stat` and the complete diff.
- [ ] Inspect new and heavily modified files for architecture shape.
- [ ] Confirm `index.ts` files remain thin entrypoints.
- [ ] Confirm no route-local business rule, React-local domain validation,
      raw feature control, compatibility layer, re-export facade, generic
      inspector framework, arbitrary mosaic/card-action API, or duplicated
      media exists.
- [ ] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [ ] Only then mark the plan complete.
