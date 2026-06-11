# 0059 Shot References Narrative Scoped Tabs

Status: completed
Date: 2026-06-11
Completed: 2026-06-11

## Summary

The shot detail tabs currently expose separate Lookbook, Cast, Location, and
References tabs. That made sense while each reference family was being brought
online, but the tab bar is now too crowded and the cards are visually
inconsistent.

This plan changes the shot detail surface so:

- Narrative remains the source of truth for which cast members, locations, and
  future dialogue audio are available to the scene.
- The References tab lets the user choose which scene-available cast members and
  locations participate in the selected shot, then choose the visual sheets and
  views that represent them.
- The shot References tab becomes the single place for image reference
  selection.
- Lookbook, Cast, and Location become collapsible sections inside References
  instead of top-level tabs.
- Cast and Location reference choices are prefiltered to the scene narrative
  context, not to generated shot data and not to the full project catalog.
- The same reusable card component renders all reference cards in this area.
- Cards match the Cast overview visual treatment: image-led cards with a bottom
  gradient text overlay, human-readable labels, correct aspect handling,
  generation-only top right cost estimates, and the shared lower-right selected
  control.

This is a cleanup plan, not the dialogue-audio implementation. The next
iteration can add dialogue audio into the same narrative-owned reference model.

## Design Brief Playback

The requested product behavior is clear enough to plan without another design
question round:

- Product area: Renku Studio shot detail tabs, specifically the lower shot
  detail panel under the video stage.
- Visual source: the existing Cast overview card style in Studio, using local
  shadcn-style UI primitives from `packages/studio/src/ui`.
- Interactivity: fully working selection states, collapsible sections, previews,
  autosave/resource refresh behavior, and graph-backed generation estimates.

Desktop is the target. Mobile behavior is out of scope unless explicitly
requested later.

## Relationship To Existing Plans

This plan supersedes the top-level Lookbook, Cast, and Location tab decisions in:

- `plans/active/0046-shot-video-inline-reference-tabs.md`

Plan `0046` remains useful for its core idea that shot reference choices should
come from a graph-backed production-plan report rather than browser-side
guesswork. This plan changes the information architecture:

- `0046` proposed top-level tabs for Lookbook, Cast, Location, and References.
- This plan keeps only `References` and moves the other three families into
  collapsible sections inside it.

This plan also builds on:

- `plans/active/0036-shot-design-tabs.md`
- `plans/active/0038-shot-composition-location-tabs.md`
- `plans/active/0039-shot-ai-production-tab.md`
- `plans/active/0042-shot-video-take-generation-plan-architecture.md`
- `plans/active/0045-shot-video-reference-dependency-graph-estimates.md`
- `plans/active/0057-scene-dialogue-audio-generation.md`

Dialogue audio from plan `0057` stays scene/narrative-owned. This plan only
prepares the shot References architecture so audio can be added later without
creating another crowded tab.

## Current Problems

### The Tab Bar Has Outgrown The Surface

The shot detail tab bar currently includes:

```text
Description
Lookbook
Composition
Motion
Cast
Location
References
AI Production
```

The screenshot shows the predictable result: the tab bar is dense, hard to scan,
and forced to carry several closely related reference choices as separate
navigation destinations.

Reference choice belongs in one tab. The user should not have to remember
whether a visual input is in Lookbook, Cast, Location, or References.

### Cast And Location Choices Ignore Narrative Scope

The current production-plan report builds Cast and Location choices from the
full screenplay catalog:

- `packages/core/src/server/media-generation/shot-video-take.ts` maps
  `screenplay.cast` into `castReferences`.
- The same file maps `screenplay.locations` into `locationReferences`.

That means a shot can show every project cast member and every project location
even when the current scene narrative only makes a few of them available.

For example, if the scene narrative only has Urban and Mara at the Ottoman Siege
Camp, the shot reference picker should let the user choose from Urban, Mara, and
the scene's locations. It should not invite the user to choose every project
location and every cast member from the whole movie.

### Shot Specs Can Drift Away From Narrative

The screenplay scene is the durable narrative source. `SceneShot` also carries
agent-generated shot-list reference hints:

```ts
castMemberIds: string[];
locationIds: string[];
dialogue: SceneShotDialogueReference[];
```

These generated fields are meaningful and should be used as the initial
shot-level defaults:

- `castMemberIds` defaults which scene-available cast members appear in the
  shot.
- `locationIds` defaults which scene-available location is selected for the
  shot.
- `dialogue` defaults which scene dialogue references are relevant when dialogue
  audio is added in the next iteration.

`shotSpecs` then stores user-edited shot-detail selections:

```ts
location?: ShotLocationSpecs;
castReferences?: ShotCastReferenceSpecs;
lookbookReference?: ShotLookbookReferenceSpecs;
referenceImages?: ShotReferenceImageSpecs;
```

Today the mutation APIs validate that chosen cast and location ids exist in the
project, but they do not enforce that the ids are available from the scene
narrative context. That allows a shot detail reference override to become its
own source of truth.

The intended product model is different:

- Narrative says who and where can appear in this scene.
- Generated shot-list reference hints provide initial shot-level defaults, but
  they are not the source of truth for eligibility.
- References choose which scene-available cast members and locations appear in
  the selected shot, then which visual sheet or generated reference represents
  those entities for production.

### Cards Use Multiple Visual Systems

The Cast overview uses `ImageOverlayCard`, which gives the desired treatment:

- image fills the card;
- title and description sit over a bottom gradient;
- card proportions are stable;
- missing image state is quiet;
- the card feels like the rest of Studio.

The shot reference area currently mixes:

- `SceneShotReferenceCardGrid`, with small bordered buttons and footer text;
- `ImageCollectionSection`, which uses `ImageOverlayCard` but without the same
  cost treatment as the other shot reference cards;
- separate card mapping logic in Lookbook, Cast, Location, and References tabs.

The result is exactly what the screenshots show:

- Lookbook sheets can expose raw or file-like labels.
- Some cards put text under the image instead of on the image.
- Aspect ratios vary by source instead of by intended card role.
- Cost badges are not applied consistently.
- The first-frame placeholder has no useful label and does not show the planned
  generation estimate.

### Location Views Need A Better Layout

The current Location tab separates:

- Shot Location cards;
- Environment Sheet Views cards.

The requested model is one location reference group:

- default collapsed state shows the selected location sheet;
- a full-height chevron on the right expands the card row;
- expanded state exposes one or more selectable views from that sheet;
- if the expanded row is wider than the available panel, it scrolls
  horizontally rather than squeezing cards into unreadable sizes.

This needs a deliberate component shape, not a simple grid of all views.

## Goals

1. Keep Narrative as the source of truth for scene cast, location, and future
   dialogue audio eligibility.
2. Prefilter Cast and Location reference choices to the current scene narrative
   context, while allowing shot-level selection from that scene-scoped set.
3. Remove Lookbook, Cast, and Location from the top-level shot detail tab bar.
4. Move General, Lookbook, Cast Character Sheets, and Location Sheets/Views
   into the References tab.
5. Render References tab sections as collapsible sections using the local
   shadcn `Collapsible` component.
6. Create one reusable shot reference card component for this whole area.
7. Use human-readable labels only. Do not show raw filenames, ids, kebab-case
   strings, or generated role names as visible card copy.
8. Show selection with the shared lower-right selected control style.
9. Show graph-backed cost estimates in the top right only when a reference does
   not exist yet and requires generation.
10. Generate and price the First Frame reference card through the same
    production-plan graph as other reference cards, with visible cost only when
    the first frame is missing and needs generation.
11. Keep Studio browser code thin: no provider inference, no pricing logic, no
    asset role guessing, and no fallback to the full project catalog.

## Non-Goals

This plan does not:

- add dialogue audio UI yet;
- add audio reference generation to the References tab;
- change the Narrative tab design;
- change the shot video stage;
- change AI Production model selection or route settings;
- add mobile-specific behavior;
- preserve Lookbook, Cast, or Location as hidden aliases in the tab route;
- introduce compatibility redirects for old `shotTab` values;
- add wrapper components whose main purpose is preserving old component names;
- add paid generation execution from the References tab;
- invent placeholder text just to fill empty image cards.

## Product Decisions

### Final Top-Level Shot Detail Tabs

The shot detail tab order becomes:

```text
Description
Composition
Motion
References
AI Production
```

Rules:

- `Lookbook` is removed as a top-level tab.
- `Cast` is removed as a top-level tab.
- `Location` is removed as a top-level tab.
- `References` stays immediately before `AI Production`.
- Existing callers should be updated directly. Do not keep compatibility
  aliases for removed tabs.

### References Section Order

The References tab renders these sections in order:

```text
General
Lookbook
Cast Character Sheets
Location Sheets And Views
```

Section meanings:

- `General`: First Frame, Last Frame, custom references, and any future
  non-entity image references that belong to the shot/video take rather than a
  cast member, lookbook, or location.
- `Lookbook`: active Lookbook sheet choices.
- `Cast Character Sheets`: one group per scene-available cast member, with
  all character-sheet choices for that member.
- `Location Sheets And Views`: one group per scene-available location, with
  the location sheet collapsed by default and expandable view choices.

### Collapsible Sections

References sections must use the local shadcn `Collapsible` primitive.

Current state:

- `packages/studio/src/ui/collapsible.tsx` already exists.

Required implementation:

- import `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` from
  `packages/studio/src/ui/collapsible.tsx`;
- do not use raw browser controls for expand/collapse triggers;
- do not invent a custom collapse primitive;
- do not use Accordion for this plan;
- keep the section header typography consistent with the current shot design
  micro-heading style from `DesignSection`;
- use a chevron icon to communicate expanded/collapsed state.

### Default Collapsed State

Recommended defaults:

- `General`: expanded by default.
- `Lookbook`: expanded by default when it has choices, collapsed when empty.
- `Cast Character Sheets`: expanded by default when the scene has eligible cast.
- `Location Sheets And Views`: expanded by default when the scene has eligible
  locations.

This keeps the most important references visible without making the user open
every section on first visit.

### Card Visual Treatment

All cards in the References tab must use one reusable card component.

Visual requirements:

- image fills the card;
- text is overlaid on the image with a bottom gradient;
- text is human-formatted;
- no footer strip under the image;
- no raw filenames, ids, kebab-case, or asset role strings;
- cost appears in the top right only for missing references that need generation;
- selected state appears in the lower right using the same style as
  `ImageSelectionControl`;
- missing images use the quiet missing-image treatment from `ImageOverlayCard`;
- cards have stable dimensions and do not jump when images load;
- aspect ratio comes from the card purpose and real image metadata where
  appropriate.

The reusable card can compose `ImageOverlayCard`, but the shot References area
should consume a shot-specific component that owns:

- card state mapping;
- cost badge display;
- selection control placement;
- preview click behavior;
- accessible labels;
- missing/planned image treatment.

Proposed file:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card.tsx
```

Possible companion layout files:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card-grid.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-section.tsx
```

These are allowed because they own real shot-reference behavior. They must not
be thin compatibility wrappers around old tab components.

### Card Labels

Core should provide display labels wherever possible. Studio may apply a final
humanization helper only for legacy asset titles that are already user-visible
elsewhere.

Examples:

- `first-frame` becomes `First Frame`.
- `location_environment_sheet` becomes `Location Sheet`.
- `view_front` becomes `Front View`.
- a Lookbook sheet title such as `urban-basilica-stone-light.png` becomes a
  human title or falls back to `Lookbook Sheet`.
- a missing first frame card should say `First Frame`, not only show a black
  placeholder.

If no meaningful label exists, prefer a quiet card with a domain fallback such
as `Reference Image`, not raw data.

### Cost Badges

Cost badge rules:

- Use `MediaGenerationDependencyPricing` from the core production-plan report.
- Show a top-right cost badge when `pricing.state === 'priced'` and
  `estimatedUsd > 0` and the reference has no existing image/input to reuse.
- Show an `Unpriced` badge, using a subdued warning style, when
  `pricing.state === 'unpriced'` and the reference still needs generation.
- Never show cost on cards for already-existing references, including references
  that were originally generated in a previous run.
- Do not show `$0.00` badges.
- Do not fabricate an estimate in the browser.

The first-frame card must show the same estimated cost as its dependency graph
node only when it has no generated image yet.

### Selection Semantics

Selection state should remain explicit and persisted through core APIs.

Rules:

- General reference images can be selected or cleared through the existing
  shot-video input selection APIs when the card has a selectable input.
- Lookbook selection is single-select.
- Cast member eligibility is scene-narrative-owned. The user selects which
  scene-available cast members appear in the shot and which character sheet to
  use for each selected cast member.
- Location eligibility is scene-narrative-owned. The user selects which
  scene-available location appears in the shot and which sheet and views to use
  for that selected location.
- Location views are multi-select when the sheet is expanded.

This preserves Narrative as the eligibility source while still giving the user
shot-level production control. If the needed cast member or location is missing
from the scene narrative, the fix is to update Narrative first, not to pick from
the full project catalog here.

## Narrative Source Of Truth

### Scene Narrative Inputs And Shot Defaults

The current shot document has useful generated defaults:

```ts
export interface SceneShot {
  dialogue: SceneShotDialogueReference[];
  castMemberIds: string[];
  locationIds: string[];
  shotSpecs?: ShotSpecs;
}
```

Those fields are generated from the narrative and other agent context. They are
the default shot-level reference selections:

- `castMemberIds` defaults selected cast for the shot.
- `locationIds` defaults selected location for the shot.
- `dialogue` defaults selected dialogue references for the shot, which matters
  for the later dialogue-audio iteration.

They are not the narrative source of truth and they must not define the complete
eligibility set.

For eligibility, the implementation should use the existing screenplay scene
context:

- scene setting location ids;
- block-level location ids;
- block-level cast member ids;
- scene dialogue and cast member references;
- scene dialogue audio records when audio is added in the next iteration.

The production-plan report should expose both:

- the scene-available cast and locations;
- the current shot's selected cast and location references, using generated shot
  hints as defaults when the user has not made an explicit selection.

### Production Group Scope

Shot video takes can target one shot or a production group.

For a production group:

- Cast choices should still come from the scene narrative, not from the union of
  generated shot hints.
- Location choices should still come from the scene narrative, not from the union
  of generated shot hints.
- Generated shot hints across the target shots can influence default selected
  cast and location references.
- Dialogue audio, in the future, should come from the scene narrative and then
  be selected for the grouped take as needed.

The eligible scene set should preserve a stable order:

1. first appearance in the scene screenplay flow;
2. scene setting order for locations when applicable;
3. domain object order as a final deterministic fallback.

### Invalid Stored Overrides

If existing `shotSpecs` contains a cast member or location outside the scene narrative
scope:

- the production-plan report should include a structured diagnostic;
- the UI should not silently show the out-of-scope entity as a valid option;
- mutation APIs should reject new out-of-scope selections;
- implementation should remove obsolete out-of-scope state when the user saves a
  corrected selection.

Recommended diagnostic codes:

```text
CORE_SHOT_REFERENCE_CAST_OUTSIDE_NARRATIVE
CORE_SHOT_REFERENCE_LOCATION_OUTSIDE_NARRATIVE
CORE_SHOT_REFERENCE_AUDIO_OUTSIDE_NARRATIVE
CORE_SHOT_REFERENCE_UNKNOWN_CAST_MEMBER
CORE_SHOT_REFERENCE_UNKNOWN_LOCATION
CORE_SHOT_REFERENCE_UNKNOWN_INPUT
CORE_SHOT_REFERENCE_MISSING_ASSET_FILE
CORE_SHOT_REFERENCE_PLAN_UNAVAILABLE
```

Do not add fallback behavior that treats out-of-scope ids as valid because they
exist in the project.

## Core Contract Changes

### Production Plan Report Shape

Current report shape:

```ts
export interface ShotVideoTakeProductionPlanReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  finalPrompt: ShotVideoTakePromptDraft | null;
  plan: ShotVideoTakeGenerationPlan;
  castReferences: ShotVideoTakeCastReferenceChoice[];
  locationReferences: ShotVideoTakeLocationReferenceChoice[];
  lookbookReferences: ShotVideoTakeLookbookReferenceChoice[];
  imageReferences: ShotVideoTakeImageReferenceChoice[];
  diagnostics: DiagnosticIssue[];
}
```

Recommended shape for this cleanup:

```ts
export interface ShotVideoTakeProductionPlanReport {
  target: SceneShotMediaGenerationTarget;
  productionGroup: ShotVideoTakeProductionGroup;
  finalPrompt: ShotVideoTakePromptDraft | null;
  plan: ShotVideoTakeGenerationPlan;
  references: ShotVideoTakeReferenceSectionsReport;
  diagnostics: DiagnosticIssue[];
}

export interface ShotVideoTakeReferenceSectionsReport {
  general: ShotVideoTakeGeneralReferenceChoice[];
  lookbook: ShotVideoTakeLookbookReferenceChoice[];
  castMembers: ShotVideoTakeCastMemberReferenceGroup[];
  locations: ShotVideoTakeLocationReferenceGroup[];
}
```

This is an intentional contract change. Update callers directly. Do not keep
`castReferences`, `locationReferences`, `lookbookReferences`, and
`imageReferences` as compatibility aliases.

### General References

General references replace the current `imageReferences` browser section.

```ts
export type ShotVideoTakeGeneralReferenceKind =
  | 'first-frame'
  | 'last-frame'
  | 'reference-image'
  | 'multi-shot-storyboard-sheet';

export interface ShotVideoTakeGeneralReferenceChoice {
  id: string;
  kind: ShotVideoTakeGeneralReferenceKind;
  title: string;
  selected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}
```

Rules:

- First Frame must appear as a card when the selected video route or agent
  proposal needs it.
- Planned first-frame generation must have a card label and cost estimate when
  no reusable first-frame image exists.
- Custom references appear only when they exist or when a real add/import
  interaction is implemented.
- No fake empty custom-reference card.

### Lookbook References

Lookbook remains single-select:

```ts
export interface ShotVideoTakeLookbookReferenceChoice {
  id: string;
  lookbookId: string;
  lookbookSheetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}
```

Rules:

- choices come from the active Lookbook;
- labels are human readable;
- missing or planned Lookbook images show graph-backed pricing only when no
  existing Lookbook reference image can be reused;
- the browser does not fetch and sort Lookbook assets itself.

### Cast Character Sheet Groups

Cast must show all scene-available cast members and the character-sheet choices
for each member.

```ts
export interface ShotVideoTakeCastMemberReferenceGroup {
  castMemberId: string;
  name: string;
  role: string | null;
  selectedForShot: boolean;
  defaultSelectedForShot: boolean;
  selectedCharacterSheetAssetId: string | null;
  defaultCharacterSheetAssetId: string | null;
  characterSheets: ShotVideoTakeCharacterSheetReferenceChoice[];
  diagnostics: DiagnosticIssue[];
}

export interface ShotVideoTakeCharacterSheetReferenceChoice {
  id: string;
  castMemberId: string;
  assetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}
```

Rules:

- each scene-available cast member gets a group;
- the user can select or clear whether that scene-available cast member appears
  in the shot;
- all character-sheet assets for that cast member are shown;
- the default selected sheet is the first character sheet for the member unless
  an explicit selection exists;
- profile images and other cast assets do not appear here;
- missing character sheets produce a planned/missing card with cost only when
  the cast member is selected for the shot, the dependency graph can estimate
  generation, and no usable sheet exists.

Recommended persistence:

- Add a shot/video-take reference selection that records the selected character
  sheet asset for a cast member.
- `ShotCastReferenceSpecs.castMemberIds` may remain the explicit shot-level
  subset of scene-available cast members.
- Do not overload `ShotCastReferenceSpecs.castMemberIds` for sheet asset
  selection.

### Location Sheet And View Groups

Locations should be grouped as one expandable row per scene-available location.

```ts
export interface ShotVideoTakeLocationReferenceGroup {
  locationId: string;
  name: string;
  selectedForShot: boolean;
  defaultSelectedForShot: boolean;
  selectedEnvironmentSheetAssetId: string | null;
  defaultEnvironmentSheetAssetId: string | null;
  selectedViewIds: LocationAzimuthViewId[];
  environmentSheets: ShotVideoTakeEnvironmentSheetReferenceChoice[];
  diagnostics: DiagnosticIssue[];
}

export interface ShotVideoTakeEnvironmentSheetReferenceChoice {
  id: string;
  locationId: string;
  assetId: string | null;
  title: string;
  selected: boolean;
  defaultSelected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
  views: ShotVideoTakeLocationViewReferenceChoice[];
}

export interface ShotVideoTakeLocationViewReferenceChoice {
  id: string;
  viewId: LocationAzimuthViewId;
  label: string;
  selected: boolean;
  card: ShotVideoTakeReferenceCardPlan;
}
```

Rules:

- each scene-available location gets a group;
- the user can select which scene-available location appears in the shot;
- all environment-sheet assets for each scene-available location are available
  as sheet choices;
- default selected sheet is the first environment sheet unless an explicit
  selection exists;
- the collapsed row shows the selected sheet;
- expanding the row shows the sheet plus view cards in a horizontal scroll
  container;
- view selection is multi-select;
- view cards use the same reusable card component, with labels like `Front`,
  `Right`, `Back`, and `Left`;
- a missing environment sheet has a planned/missing card with cost only when the
  location is selected for the shot, graph pricing exists, and no usable sheet
  exists.

Recommended persistence:

- Keep `ShotLocationSpecs.locationId` as the explicit selected scene-available
  location for the shot.
- Add explicit reference selection for environment sheet asset id and selected
  view ids.
- Do not store selected views as a single `azimuthView` if the UI supports
  multi-select.
- If this changes `ShotLocationSpecs`, update callers directly and remove old
  tests that only preserve the obsolete shape.

## Studio Server And Service APIs

### Read API

The existing production-plan endpoint should return the new report shape:

```text
POST /studio-api/projects/:projectName/screenplay/scenes/:sceneId/video-take-production/plan
```

Response:

```ts
{
  report: ShotVideoTakeProductionPlanReport;
}
```

Rules:

- unknown top-level request fields are rejected;
- core owns reference filtering, defaulting, pricing, and diagnostics;
- Studio server serializes structured diagnostics through the existing API error
  path.

### Mutation APIs

Existing APIs should be renamed or reshaped only when the contract genuinely
changes. Do not keep aliases.

Required mutations:

```text
PATCH /screenplay/scenes/:sceneId/shots/:shotId/lookbook-reference
PATCH /screenplay/scenes/:sceneId/shots/:shotId/reference-images
PATCH /screenplay/scenes/:sceneId/shots/:shotId/cast-references
PATCH /screenplay/scenes/:sceneId/shots/:shotId/cast-character-sheet-reference
PATCH /screenplay/scenes/:sceneId/shots/:shotId/location-sheet-reference
PATCH /screenplay/scenes/:sceneId/shots/:shotId/location-view-references
```

Suggested request shapes:

```ts
{ lookbookSheetId: string | null }
{ customReferenceInputIds: string[] }
{ castMemberIds: string[] }
{ castMemberId: string; assetId: string | null }
{ locationId: string; assetId: string | null }
{ locationId: string; assetId: string; viewIds: LocationAzimuthViewId[] }
```

Rules:

- each mutation validates scene, active shot list, shot id, and narrative scope;
- each mutation validates that referenced assets belong to the specified cast
  member or location;
- each mutation returns the refreshed shot-list resource and resource keys;
- out-of-scope cast or location ids fail with structured diagnostics;
- unknown request fields are rejected.

### Browser Service Layer

Update:

```text
packages/studio/src/services/studio-shot-video-takes-api.ts
```

Required service functions:

```ts
readShotVideoTakeProductionPlan(...)
updateShotLookbookReference(...)
updateShotCustomReferenceImages(...)
updateShotCastReferences(...)
updateShotCastCharacterSheetReference(...)
updateShotLocationSheetReference(...)
updateShotLocationViewReferences(...)
```

Remove or update functions that preserve the old UI contract:

- `updateShotCastReferences` should validate the requested shot cast subset
  against scene narrative scope rather than the full project catalog;
- `updateShotLocationReference` if it only stores one selected location and one
  `azimuthView`;
- any client-side mapper that reassembles the old top-level tab sections.

## Studio Browser Implementation

### Scene Shot Detail

Update:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx
```

Required changes:

- remove imports and mounts for:
  - `SceneShotLookbookTab`;
  - `SceneShotCastTab`;
  - `SceneShotLocationTab`;
- remove `lookbook`, `cast`, and `location` from `DESIGN_TABS`;
- keep `SceneShotReferencesTab`;
- pass the production plan report and mutation handlers needed by the expanded
  References tab;
- update route/focus state types so removed `shotTab` values are not accepted
  as current behavior.

Do not keep hidden `<LineTabsContent>` blocks for removed tabs.

### Scene Shot References Tab

Replace the current General-only implementation in:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx
```

Responsibilities:

- render collapsible sections in the required order;
- render General references;
- render Lookbook sheet choices;
- render Cast Character Sheet groups;
- render Location Sheet and View groups;
- own preview dialog state for reference images;
- call service mutations and refresh the production plan after saves;
- display structured diagnostics from the report in a compact, useful way.

The component must not:

- fetch cast assets directly;
- fetch location assets directly;
- fetch Lookbook resources directly;
- infer dependency costs;
- render raw filenames or ids;
- use raw HTML buttons, inputs, checkboxes, or similar controls.

### Reusable Shot Reference Card

Create:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card.tsx
```

Recommended props:

```ts
interface SceneShotReferenceCardProps {
  title?: string;
  description?: string;
  imageUrl: string | null;
  imageAlt: string;
  card: ShotVideoTakeReferenceCardPlan;
  selected?: boolean;
  selectable?: boolean;
  aspectRatio: number;
  aspectClassName: string;
  onOpen?: () => void;
  onToggleSelected?: () => Promise<void>;
}
```

Implementation rules:

- compose `ImageOverlayCard`;
- use `ImageSelectionControl` for selectable cards;
- use `Badge` or a small local cost badge for top-right pricing only on
  missing references that require generation;
- use `ImagePreviewDialog` through the parent tab, not inside every card;
- keep hover and focus states aligned with `ImageOverlayCard`;
- use `Button` from `packages/studio/src/ui/button` for interactive behavior;
- avoid raw `<button>`, `<input>`, or checkbox markup in feature code.

### Reference Card Layout

Create or update:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card-grid.tsx
```

Rules:

- standard card grid uses `repeat(auto-fill, minmax(...))`;
- General and Lookbook can use wider cards, roughly `220px` minimum;
- Cast groups can use square or 4:5 cards depending on character-sheet image
  dimensions;
- Location collapsed cards should keep a stable sheet card size;
- expanded location views use a horizontal scroll row with fixed card widths;
- no nested UI cards inside cards.

### Location Expandable Row

Create a focused component, for example:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-location-reference-row.tsx
```

Behavior:

- collapsed state shows the selected environment sheet card;
- right edge has a full-height chevron action using `Button` and a lucide
  chevron icon;
- expanded state shows the selected sheet plus available view cards;
- expanded content scrolls horizontally when it exceeds available width;
- view cards support multi-select;
- clicking the sheet selects the sheet;
- clicking a view toggles that view;
- opening preview images remains available without fighting selection clicks.

Accessibility:

- chevron action has an `aria-label` such as `Show location views` or
  `Hide location views`;
- collapsible content is tied to the trigger state through the local shadcn
  primitive;
- selected view controls use `aria-pressed` through `ImageSelectionControl`.

### Removed Components

Delete obsolete feature components when no current callers remain:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-lookbook-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-cast-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-location-tab.tsx
```

Do not keep these files as pass-through wrappers into `SceneShotReferencesTab`.

## Core Implementation Notes

### Reference Projection Builder

The projection logic currently lives inside:

```text
packages/core/src/server/media-generation/shot-video-take.ts
```

This file is already large. If the implementation grows the reference
projection, split it into a focused module such as:

```text
packages/core/src/server/media-generation/shot-video-take-reference-report.ts
```

Responsibilities:

- collect scene-available cast, locations, and future dialogue ids for the
  current scene;
- apply generated shot hints only as defaults for selected shot references;
- project General, Lookbook, Cast, and Location reference sections;
- resolve existing assets and asset files;
- attach dependency graph pricing;
- attach diagnostics;
- expose stable display labels;
- preserve deterministic ordering.

The module must not:

- build provider payloads;
- perform paid generation;
- read browser-only URLs;
- infer pricing outside the dependency graph.

### Asset Resolution

Core owns:

- all character-sheet assets for a cast member;
- default character-sheet selection;
- selected character-sheet validation;
- all environment-sheet assets for a location;
- default environment-sheet selection;
- selected view validation;
- preview descriptors for composite sheet and view files;
- Lookbook sheet preview descriptors;
- first-frame and other generated-reference preview descriptors;
- missing asset-file diagnostics.

Studio owns:

- turning preview descriptors into browser URLs through existing asset URL
  helpers;
- rendering cards;
- opening image previews;
- sending explicit mutation requests.

### Human Labels

Add focused label helpers in core or reuse existing shared label helpers where
appropriate.

Existing useful browser helpers include:

- `readableCastImageTitle`;
- `readableLocationSheetTitle`;
- `LOCATION_AZIMUTH_VIEW_LABELS`.

For the production-plan report, prefer core-provided labels so tests can assert
the contract independently of the browser.

## Test Plan

### Core Contract Tests

Add or update tests for:

- `ShotVideoTakeProductionPlanReport` returns `references.general`;
- `ShotVideoTakeProductionPlanReport` returns `references.lookbook`;
- `ShotVideoTakeProductionPlanReport` returns `references.castMembers`;
- `ShotVideoTakeProductionPlanReport` returns `references.locations`;
- old top-level report fields are removed from current contract tests;
- First Frame cards have a human label and graph-backed pricing only when the
  image does not already exist;
- General references do not invent custom-reference placeholders;
- Lookbook choices use human labels and hide raw asset ids;
- missing planned references carry dependency graph pricing;
- unpriced references carry `pricing.state === 'unpriced'`.

### Narrative Scope Tests

Add tests for:

- cast choices include only cast members from the scene narrative;
- generated shot cast hints become default selected shot references;
- grouped shot cast hints can influence default selection, but not eligibility;
- location choices include only locations from the scene narrative;
- generated shot location hints become default selected shot references;
- grouped shot location hints can influence default selection, but not
  eligibility;
- out-of-scope cast selections produce structured diagnostics;
- out-of-scope location selections produce structured diagnostics;
- mutation APIs reject cast ids outside the narrative scope;
- mutation APIs reject location ids outside the narrative scope.

### Cast Reference Tests

Add tests for:

- a cast member with multiple character sheets returns all sheet choices;
- default character sheet is the first available sheet when no explicit
  selection exists;
- explicit character-sheet selection is preserved;
- profile images do not appear in Cast Character Sheets;
- missing character sheet returns a planned/missing card with cost only when the
  cast member is selected for the shot, the graph contains that dependency, and
  no existing sheet is available.

### Location Reference Tests

Add tests for:

- a location with multiple environment sheets returns all sheet choices;
- default environment sheet is the first available sheet when no explicit
  selection exists;
- explicit environment-sheet selection is preserved;
- selected view ids can contain more than one view;
- view choices include Front, Right, Back, and Left when files exist;
- missing environment sheet returns a planned/missing card with cost only when
  the location is selected for the shot, the graph contains that dependency, and
  no existing sheet is available;
- invalid view ids produce structured diagnostics.

### Studio Server Tests

Add or update tests for:

- production-plan endpoint returns the new `references` report shape;
- production-plan endpoint rejects unknown top-level fields;
- Lookbook mutation rejects unknown top-level fields;
- custom reference mutation rejects unknown top-level fields;
- cast character-sheet mutation rejects unknown top-level fields;
- location sheet mutation rejects unknown top-level fields;
- location view mutation rejects unknown top-level fields;
- mutations return refreshed shot-list resources and resource keys;
- structured diagnostics serialize through the Studio API error path.

### Studio UI Tests

Add or update tests for:

- shot detail tab order is `Description`, `Composition`, `Motion`,
  `References`, `AI Production`;
- `Lookbook`, `Cast`, and `Location` no longer render as top-level tabs;
- References renders sections in this order: General, Lookbook, Cast Character
  Sheets, Location Sheets And Views;
- sections use collapsible triggers with accessible labels;
- First Frame renders as a labeled card;
- First Frame shows a cost badge only when planned, priced, and not already
  available;
- Lookbook cards use overlay text, not footer text;
- cast character sheet cards use overlay text and selection controls;
- location sheet cards use overlay text and selection controls;
- location view cards can be selected independently;
- expanded location rows horizontally scroll instead of compressing all cards;
- cards do not show raw filenames, ids, kebab-case, or asset role strings;
- clicking preview image opens `ImagePreviewDialog`;
- selection calls the correct service mutation and refreshes the plan.

### Static Search Checks

After implementation:

```bash
rg "Lookbook.*value|value: 'lookbook'|value='lookbook'" packages/studio/src/features/movie-studio/scenes
rg "value: 'cast'|value='cast'" packages/studio/src/features/movie-studio/scenes
rg "value: 'location'|value='location'" packages/studio/src/features/movie-studio/scenes
rg "scene-shot-lookbook-tab|scene-shot-cast-tab|scene-shot-location-tab" packages/studio/src
rg "castReferences:" packages/studio/src/features/movie-studio/scenes
rg "azimuthView" packages/studio/src/features/movie-studio/scenes
```

Expected result:

- no current feature-code top-level tab entries for removed tabs;
- no remaining imports of removed tab components;
- no browser-side narrative cast membership toggling from References;
- no single-view-only `azimuthView` UI if multi-select views are implemented.

### Desktop Visual Verification

Use the in-app browser or Playwright on the running Studio app.

Verify at desktop viewport:

- the tab bar has fewer tabs and no wrapping/overcrowding;
- References is readable in the existing shot detail panel height;
- all section headers match the intended micro-heading style;
- collapsible open/close states are smooth and accessible;
- cards match the Cast overview visual language;
- labels sit over the image gradient and remain legible;
- generation-only cost badges do not collide with selection controls;
- expanded location view rows scroll horizontally when needed;
- no text overlaps or escapes card boundaries.

## Documentation Updates

Update accepted documentation if implementation changes the current contract:

- `docs/architecture/data-model-and-storage.md` if shot reference persistence
  changes;
- `docs/architecture/front-end-guidelines.md` only if a new reusable pattern
  should be documented broadly;
- `docs/architecture/structured-diagnostics.md` if new public diagnostic codes
  need listing;
- relevant CLI or agent docs if the production-plan report shape is exposed to
  agents.

Do not edit historical plan files just to rename old tab decisions.

## Open Questions And Recommended Answers

### Should Users Select Which Scene Cast Members Appear In A Shot?

Recommended answer: yes.

The scene narrative is the eligibility boundary, but a shot does not
automatically include every scene cast member. The References tab should let the
user select which scene-available cast members appear in the current shot and
then choose character sheets for those selected members. If a needed cast member
is not available in the scene, the user should update Narrative first.

### Should Users Select Which Scene Location Appears In A Shot?

Recommended answer: yes.

The scene narrative is the eligibility boundary, but a shot can focus on one
scene-available location or setting area. The References tab should let the user
select the location from the scene-scoped set and then choose its sheet and
views. If a needed location is not available in the scene, the user should
update Narrative first.

### Should Location References Let Users Pick Project Locations Outside The Scene?

Recommended answer: no.

The request says location options should come prefiltered by narrative
availability. Showing all project locations repeats the current problem.

### Should Cast Character Sheet Selection Be Persisted In `shotSpecs.castReferences`?

Recommended answer: no.

`ShotCastReferenceSpecs.castMemberIds` describes cast-member inclusion, not the
selected character-sheet asset. Use a new explicit reference-selection shape or
shot-video input selection record instead of overloading the old field.

### Should Location View Selection Continue To Use `azimuthView`?

Recommended answer: no if the product requires one or more selected views.

`azimuthView` is single-select. The requested behavior says the user can pick
one or more views. Use a plural `viewIds` style contract and update callers
directly.

### Should Lookbook Stay Active-Lookbook Only?

Recommended answer: yes for this slice.

The request does not ask for choosing among all Lookbooks. Keep Lookbook choices
scoped to the active Lookbook, matching the current Studio model.

### Should The Location Section Be Called `Location Character Sheets And Views`?

Recommended answer: no.

The request lists `Location Character Sheets and Views`, but the current domain
language uses character sheets for cast members and environment/location sheets
for places. The clearer section title is `Location Sheets And Views` unless the
product language intentionally wants locations to use the phrase `character
sheet`.

### What Should Empty Sections Show?

Recommended answer:

- keep empty states terse and factual;
- do not add filler copy;
- do not show raw ids;
- use section-level empty states only when they help explain missing narrative
  context or missing generated assets.

Examples:

- `No scene cast available.`
- `No scene location available.`
- `No Lookbook selected.`

### Should First Frame Be Generated Automatically?

Recommended answer: no.

The card should show the planned generation and estimate only when the first
frame does not already exist. Actual paid generation still happens through the
existing approved generation flow.

## Implementation Slices

### Slice 1: Core Reference Scope And Report Shape

- Add scene narrative scope collection for cast, locations, and future dialogue
  audio.
- Replace full-project Cast and Location projection with narrative-scoped
  projection.
- Use generated shot-list cast and location hints only as default selected
  references.
- Reshape production-plan report around `references`.
- Add labels, pricing, previews, and diagnostics to the new section shape.
- Update core tests.

### Slice 2: Persistence And Mutations

- Add or reshape persistence for selected character sheets, location sheets, and
  multi-selected views.
- Add focused mutation handlers.
- Validate narrative scope and asset ownership in core.
- Update Studio server routes and service functions.
- Update server tests.

### Slice 3: Reusable UI Components

- Use the existing local shadcn `Collapsible` primitive.
- Create the reusable shot reference card.
- Create reference section and layout helpers.
- Create the expandable location row.
- Add focused UI tests for component behavior.

### Slice 4: References Tab Consolidation

- Remove Lookbook, Cast, and Location from `DESIGN_TABS`.
- Move their content into `SceneShotReferencesTab`.
- Delete obsolete tab components when no callers remain.
- Update route/focus state types and tests.
- Verify the current browser route behavior for old query-string tab values and
  remove compatibility behavior.

### Slice 5: Visual And Interaction QA

- Run focused package tests.
- Start Studio.
- Verify the desktop UI in browser.
- Check card styling against Cast overview.
- Check collapse, selection, preview, generation-only cost badges, and
  horizontal scrolling.
- Run static searches for removed tabs and obsolete code paths.

## Completion Notes

The implementation is complete as of 2026-06-11.

Key verification points:

- The top-level shot detail tabs are now `Description`, `Composition`, `Motion`,
  `References`, and `AI Production`.
- The References tab owns General, Lookbook, Cast Character Sheets, Location
  Sheets And Views, and bottom-collapsed Reference Issues sections.
- Scene narrative scope is used for visible cast and location references.
- Shot-level location overrides that point outside the scene narrative are
  diagnosed without hiding the scene's real narrative location.
- The Urban Basilica `Bombardment` scene now shows `Theodosian Walls Location
  Sheet` with a planned generation estimate when the sheet has not been
  generated yet.
- The final shot video prompt requirement is no longer reported as a reference
  issue and is not required for cost estimation.
- Async-loaded collapsible reference sections open when their data arrives,
  unless the user has manually changed the section state.

## Completion Checklist

### Review Area

- [x] Confirm this plan supersedes the top-level tab decisions from
  `0046-shot-video-inline-reference-tabs.md`.
- [x] Confirm Narrative is the source of truth for cast, location, and future
  dialogue audio eligibility.
- [x] Confirm References is the only top-level shot tab for Lookbook, Cast,
  Location, and general reference images.
- [x] Confirm the implementation should not preserve compatibility aliases for
  removed shot tabs.
- [x] Resolve open questions before implementation starts if any recommended
  answer is wrong.

### Architecture And Contracts

- [x] Define scene narrative scope collection for cast, locations, and future
  dialogue audio.
- [x] Use generated shot-list cast and location hints only as default selected
  references.
- [x] Replace full-project Cast projection with narrative-scoped Cast
  projection.
- [x] Replace full-project Location projection with narrative-scoped Location
  projection.
- [x] Reshape `ShotVideoTakeProductionPlanReport` to expose
  `references.general`.
- [x] Reshape `ShotVideoTakeProductionPlanReport` to expose
  `references.lookbook`.
- [x] Reshape `ShotVideoTakeProductionPlanReport` to expose
  `references.castMembers`.
- [x] Reshape `ShotVideoTakeProductionPlanReport` to expose
  `references.locations`.
- [x] Remove old top-level report fields instead of keeping aliases.
- [x] Add explicit contract for cast character-sheet choices.
- [x] Add explicit contract for location environment-sheet choices.
- [x] Add explicit contract for multi-selected location view choices.
- [x] Keep dialogue audio out of UI scope while preserving a future-ready
  narrative-owned extension point.
- [x] Add structured diagnostics for out-of-scope cast references.
- [x] Add structured diagnostics for out-of-scope location references.
- [x] Add structured diagnostics for missing or invalid reference assets.

### Core Implementation

- [x] Split reference projection into a focused module if
  `shot-video-take.ts` would become too large.
- [x] Implement stable ordering for narrative-scoped cast groups.
- [x] Implement stable ordering for narrative-scoped location groups.
- [x] Resolve all character-sheet assets for each scene-available cast member.
- [x] Resolve the default character sheet as the first available sheet.
- [x] Resolve selected character-sheet overrides.
- [x] Resolve all environment-sheet assets for each scene-available location.
- [x] Resolve the default environment sheet as the first available sheet.
- [x] Resolve selected environment-sheet overrides.
- [x] Resolve all available location view files for the selected sheet.
- [x] Resolve selected multi-view overrides.
- [x] Provide human-readable labels for General references.
- [x] Provide human-readable labels for Lookbook cards.
- [x] Provide human-readable labels for Cast character-sheet cards.
- [x] Provide human-readable labels for Location sheet and view cards.
- [x] Attach graph pricing to planned/missing First Frame references.
- [x] Attach graph pricing to missing character-sheet references.
- [x] Attach graph pricing to missing location-sheet references.
- [x] Attach graph pricing to missing Lookbook references.
- [x] Do not attach visible cost display requirements to already-existing
  reference cards.
- [x] Preserve structured diagnostics on card plans.

### Persistence And Mutations

- [x] Decide final persistence shape for selected cast character sheets.
- [x] Decide final persistence shape for selected location sheets.
- [x] Decide final persistence shape for selected location view ids.
- [x] Add or update core mutation for Lookbook reference selection.
- [x] Add or update core mutation for custom reference image selection.
- [x] Add or update core mutation for scene-scoped shot cast selection.
- [x] Add core mutation for cast character-sheet selection.
- [x] Add core mutation for location sheet selection.
- [x] Add core mutation for location view multi-selection.
- [x] Validate mutation ids against narrative scope.
- [x] Validate selected assets belong to the requested cast member or location.
- [x] Return refreshed shot-list resources and scoped resource keys.
- [x] Remove obsolete mutation paths that only preserve old tab behavior.

### Studio Server

- [x] Update the production-plan endpoint response shape.
- [x] Reject unknown fields in production-plan requests.
- [x] Add or update Lookbook reference route.
- [x] Add or update custom reference image route.
- [x] Add or update scene-scoped cast reference route.
- [x] Add cast character-sheet reference route.
- [x] Add location sheet reference route.
- [x] Add location view reference route.
- [x] Serialize structured diagnostics through the existing API error path.
- [x] Update Studio service functions in
  `studio-shot-video-takes-api.ts`.
- [x] Remove old service aliases after callers are updated.

### UI Components

- [x] Use `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent` from
  `packages/studio/src/ui/collapsible.tsx`.
- [x] Create reusable `SceneShotReferenceCard`.
- [x] Compose `ImageOverlayCard` for the shared visual treatment.
- [x] Use `ImageSelectionControl` for lower-right selection.
- [x] Add a shared top-right cost badge treatment for missing references that
  require generation.
- [x] Add `Unpriced` display only for missing references that require
  generation but cannot be priced.
- [x] Create reference section wrapper with collapsible header.
- [x] Create reusable reference card grid or row layout.
- [x] Create expandable location reference row.
- [x] Ensure feature code uses local shadcn controls only.
- [x] Ensure no raw filenames, ids, kebab-case, or generated role names appear
  on cards.

### References Tab UI

- [x] Remove Lookbook, Cast, and Location from top-level shot tabs.
- [x] Render References sections in the required order.
- [x] Render General cards from `references.general`.
- [x] Render First Frame as a labeled card with planned cost only when it needs
  generation.
- [x] Render Lookbook cards from `references.lookbook`.
- [x] Render Cast Character Sheets grouped by cast member.
- [x] Let the user select which scene-available cast members appear in the
  shot.
- [x] Render all character sheets for each scene-available cast member.
- [x] Select the first character sheet by default when no explicit selection
  exists.
- [x] Render Location Sheets And Views grouped by location.
- [x] Let the user select which scene-available location appears in the shot.
- [x] Show only the selected location sheet in collapsed location rows.
- [x] Expand location rows with a full-height right-side chevron action.
- [x] Render location views inside a horizontal scroll row.
- [x] Support selecting one or more location views.
- [x] Open image previews through `ImagePreviewDialog`.
- [x] Refresh the production-plan report after reference mutations.
- [x] Render compact diagnostics when the report contains reference issues.

### Removed UI And Route State

- [x] Delete `scene-shot-lookbook-tab.tsx` if no current caller remains.
- [x] Delete `scene-shot-cast-tab.tsx` if no current caller remains.
- [x] Delete `scene-shot-location-tab.tsx` if no current caller remains.
- [x] Remove removed tab values from `SceneShotDetailTab`.
- [x] Update route/focus parsing to the new tab set.
- [x] Remove tests that only assert obsolete top-level tab behavior.
- [x] Add tests for the new route/focus behavior.
- [x] Verify old query-string values do not remain as compatibility aliases.

### Tests

- [x] Add core contract tests for the new references report shape.
- [x] Add core narrative-scope tests for cast choices.
- [x] Add core narrative-scope tests for location choices.
- [x] Add core tests for character-sheet defaults and explicit selections.
- [x] Add core tests for location-sheet defaults and explicit selections.
- [x] Add core tests for multi-selected location views.
- [x] Add server route tests for new mutations.
- [x] Add Studio UI tests for tab order.
- [x] Add Studio UI tests for collapsible section order.
- [x] Add Studio UI tests for First Frame label and generation-only cost.
- [x] Add Studio UI tests for card overlay labels.
- [x] Add Studio UI tests for cast sheet selection.
- [x] Add Studio UI tests for location row expansion and horizontal scroll.
- [x] Add static search checks for removed tabs and obsolete imports.

### Documentation And ADR Work

- [x] Update architecture docs if shot reference persistence changes.
- [x] Update structured diagnostics docs if new public codes are added.
- [x] Update frontend guidelines only if the reusable card or collapsible
  section pattern becomes a broader Studio convention.
- [x] Do not edit historical plans just to replace old tab names.

### Verification

- [x] Run focused core tests for shot-video production planning.
- [x] Run focused Studio tests for scene shot tabs.
- [x] Run focused Studio server tests for reference routes.
- [x] Run `pnpm --dir packages/studio test:typecheck`.
- [x] Run `pnpm --dir packages/studio lint`.
- [x] Start Studio through the existing dev command.
- [x] Verify the References tab in the Urban Basilica sample project.
- [x] Verify the tab bar is no longer crowded at desktop width.
- [x] Verify all reference cards visually match the Cast overview card style.
- [x] Verify no card text overlaps with generation-only cost badges or
  selection controls.
- [x] Verify expanded location views scroll horizontally when needed.
- [x] Verify generation estimates appear for planned missing references only.
- [x] Verify no mobile-specific work was added or reported.
