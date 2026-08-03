# 0167 Scene-First Screenplay Studio UI

Status: proposed
Date: 2026-08-03

Canonical backend model:
[0166 — Scene-First Screenplay Data Model And Backend](0166-scene-first-screenplay-data-model-and-backend.md#canonical-data-model).

Canonical analysis model:
[0169 — Hierarchy-Independent Screenplay Analysis](0169-hierarchy-independent-screenplay-analysis.md#canonical-analysis-contract).

Cross-phase behavior and research context:
[Scene-First Screenplay And FDX Import — Shared Design Context](assets/0166-0168-screenplay/shared-design-context.md).

Delivery dependency: the pre-cutover evidence gate in Slice 0 runs before Plan
0166 changes production contracts. All implementation slices then wait for
Plans 0166 and 0169 to complete the coordinated backend cutover and real sample
migration. This plan updates the browser directly to those contracts; it must
not add a UI compatibility model.

## Summary

Restore the full Renku Studio browser against the scene-first backend while
preserving the current `urban-basilica` screenplay-reading and dialogue-audio
experience.

The visible changes are deliberately narrow:

- the sidebar group **Acts** becomes **Scenes**;
- flat Scenes and optional Act/Sequence Sections render in one tree;
- Acts and Sequences use the same disclosure/selection row behavior and
  geometry with distinct meaningful icons;
- the existing separate Act and Sequence detail implementations become one
  Section surface; and
- the Narrative can render the complete semantic block union, Dual Dialogue,
  Props, and screenplay opening content.

The screenplay remains read-only in Studio. This is not a screenplay editor or
an organization UI. The work is primarily a contract cutover and regression-
sensitive presentation refactor.

## Requirement Ledger

| Requirement | UI behavior | Owner |
| --- | --- | --- |
| Narrative parity | Migrated `01 - Bombardment` preserves current typography, rhythm, block treatments, dialogue cards, hover/focus behavior, and audio workflow. | Narrative feature |
| Scenes root | Sidebar copy, count, and disclosure root are **Scenes**. | Studio sidebar |
| Optional structure | Flat, root-Sequence, Act-direct-Scene, Act-with-Sequence, mixed root, and empty Section shapes render. | Sidebar structure tree |
| Standard Sections | Act and Sequence rows share selection/disclosure geometry and accessibility; icons communicate their different types. | Section row |
| Read-only organization | No create, rename, move, delete, drag/drop, context-menu, or organization form appears. | Studio feature boundary |
| Complete blocks | Every accepted block/discourse variant has an intentional app-owned presentation. | Narrative block module |
| Dual Dialogue | Two turns render as coordinated side-by-side dialogue on desktop and retain separate audio actions. | Narrative dialogue module |
| Opening | Non-empty opening content renders above the first Scene only and is not presented as Scene-owned. | Narrative opening component |
| Subject references | Exact Cast, Location, and Prop ranges are interactive; presence-only references enrich context without fabricated highlights. | Reference text/preview |
| No ScriptNotes | No annotation indicators, reports, panels, or copy appear. | Entire Studio UI |
| Dialogue regression safety | The separate audio text editor, live preview, Takes, Advanced, estimate/generate/playback, autosave, and keyboard behavior survive. | Dialogue audio feature |
| Remaining UI cutover | Scene header, Beats, Shot Plans, Generations, Story Arc, Project Information, section detail, navigation, counts, selection, and refresh use the new backend. | Movie Studio features |
| Desktop quality | The supplied 1440×900 product state is the primary visual baseline; no mobile scope is introduced. | Product Design QA |

## Product Behavior

### Preserve before changing

The current screenshot and running `urban-basilica` application are the design
source. Before Plan 0166 implementation changes the backend, capture a desktop
baseline in the local Project review archive outside this repository:

```text
urban-basilica/.renku/review-evidence/0167-scene-first-screenplay-studio-ui/baseline/
```

The baseline must include:

1. the full `01 - Bombardment` Scene at 1440×900 with sidebar and Narrative;
2. Scene Heading, Action, Shot, Transition, Title Card, Super, and Dialogue
   examples visible in the sample;
3. Cast and Location exact-name hover previews;
4. a dialogue card at rest, pointer hover, and keyboard focus;
5. the dialogue audio dialog with edited audio text and live card preview;
6. Takes and Advanced states plus generated-audio playback if available;
7. previous/next Scene navigation;
8. Act and Sequence rows selected, hovered, expanded, and collapsed; and
9. Beats, Shot Plans, Generations, Section detail, Story Arc, Cast, Locations,
   Props, Project Information, and footer counts.

Store an `interaction-matrix.md` beside the captures describing the trigger,
visible state, focus behavior, accessible name, persistence effect, and
resource refresh for each interaction. This is verification evidence, not a
new design specification or production asset.

Use the Product Design audit workflow and browser capture during implementation
to compare the coded result with this baseline. Do not ideate a replacement
visual direction unless the user separately asks for a redesign.

### Sidebar

The root row reads **Scenes**. Its secondary count reports the total Scene
count, not an Act count.

The tree renders the mixed backend structure recursively within the accepted
two-level Section rules. It does not rebuild hierarchy from Scene rows.

Section presentation is standardized:

- one disclosure affordance in the same location for Act and Sequence;
- one label/select affordance separate from disclosure;
- identical indentation, hover target, focus ring, selected treatment, count
  position, and collapse animation;
- Act icon `BookOpen` and Sequence icon `Layers3` from the existing Lucide
  dependency;
- Scene icon `FileText`; and
- root icon `Clapperboard`.

The different icons convey type; different interaction models do not.

Scene labels use production number plus title when both exist. With only one,
show the available value. With neither, show the meaningful Scene Heading
projection. Never render punctuation placeholders, raw IDs, or filenames.
`productionNumber` remains the exact Final Draft value in data and API
contracts. To preserve the sample's current visual treatment, the sidebar and
Scene header may left-pad a digits-only value shorter than two characters for
display (`"1" -> "01"`); alphanumeric and custom values such as `4A`, `A4`,
and `4aA` render exactly as stored. This is one shared presentation function,
never a persisted normalization or ordering rule.

Selecting a Section uses a single Section URL and screen. Expansion state is
local presentation state keyed by Section ID. No expansion/collapse state is
persisted as screenplay organization.

### Section detail

The existing Act and Sequence feature folders are replaced by one
`screenplay/sections` feature. It reads Section type, description, and current
descendant Scenes from Core projection.

The surface may preserve current storyboard/Scene-summary behavior, but it may
not treat the Section as owner of Scenes, Assets, Cast Design, Location Design,
Prop Design, or any production artifact. Empty Sections render a quiet empty
state. There are no editing or deletion controls.

Browser URL ownership becomes:

```text
/projects/:projectName/sections/:sectionId
/projects/:projectName/scenes/:sceneId
```

Old Act/Sequence URLs are removed, not redirected.

### Narrative

The Narrative renderer consumes semantic types and applies Renku's existing
visual conventions:

- Scene Heading: existing compact screenplay-heading treatment;
- Action: current reading rhythm and inline subject interaction;
- Transition: application-owned transition alignment/treatment;
- Shot and Special Heading: current heading emphasis;
- Title Card and Super: existing centered/emphasized treatment;
- Lyrics: intentional lyric line treatment without storing alignment;
- Cast List: readable cast-list treatment;
- visible Note: quiet screenplay-note treatment distinct from Action;
- Dialogue: current card, cue, extensions, parenthetical, speech, and audio
  affordances; and
- Dual Dialogue: two coordinated dialogue cards/columns showing simultaneity.

There is no formatting toolbar and no interpretation of persisted bold,
italic, alignment, page, or ScriptNote state because those fields do not exist.

`Screenplay.opening` is shown immediately above the first canonical Scene's
heading when it is non-empty. The opening uses the same text-block components,
but it has no Scene card, production number, Beats, Shot Plans, dialogue audio,
or Scene action menu. Reordering the first Scene changes which Scene follows
the opening; it does not move the opening into that Scene.

### References and hover behavior

`@handle` parsing is removed. The renderer receives validated reference targets
and ranges from the Scene resource.

- exact ranges use the same inline hover/focus interaction users already see;
- Cast Member preview retains profile image/name behavior;
- Location preview retains hero/name behavior;
- Prop preview uses Prop hero/name with the same interaction contract;
- missing optional media produces the existing quiet text-only preview; and
- presence-only references appear in downstream context/metadata where useful
  but never create an arbitrary highlighted phrase.

Reference slicing must preserve punctuation, whitespace, and Unicode. A
reference affects only its exact target element; the browser does not search
other blocks for matching words.

### Dialogue audio regression contract

Screenplay Dialogue text remains immutable in Narrative. The audio dialog's
editable text is a separate generation setup, as it is today.

The cutover from `dialogueId` to `DialogueTurnId` must preserve:

- card activation and close behavior;
- selected tab and keyboard focus;
- current audio setup loading;
- editable text and inline performance-direction behavior;
- live preview inside the original card;
- autosave/latest-only behavior;
- estimate and generation actions;
- Takes list, file playback, and Advanced settings;
- resource refresh after writes/generation; and
- existing error and loading states.

For Dual Dialogue, each left/right turn opens its own audio state by Turn ID.
The wrapper has no shared audio identity.

### Remaining surfaces

- Project Information reads and writes the direct Project metadata fields,
  including `logline`, `synopsis`, and `premise`.
- Scene header handles optional title and number without changing the URL ID.
- Beats resolve Block IDs and receive relevant Cast/Location/Prop context.
- Shot Plans and Generations remain Scene-owned and load with no Section path.
- Story Arc renders Act bands from
  `activeAnalysis.actSegments`, beats from `activeAnalysis.keyBeats`, and Scene
  scores/critique from `activeAnalysis.sceneAnalyses`; it never derives
  analytical structure from sidebar Sections.
- Story Arc preserves the current Basilica curve, Scene rail, tooltips/dialog,
  suggested-Scene cards, and Analysis Summary after Plan 0169 converts the
  active analysis. With no active analysis it shows the intentional empty state
  and no Scene-tag fallback.
- previous/next follows Core structure traversal.
- selection context and browser routing support Scene or Section without Act/
  Sequence ancestry.
- project/footer counts always include Scenes and conditionally report Act and
  Sequence counts where helpful; no count implies ownership.
- Cast, Locations, and Props remain independent top-level Project surfaces.
- Trash contains discarded owning entities, not deleted organizational
  wrappers.

## Explicit Non-Goals

- No screenplay prose editing.
- No formatting, page, or annotation UI.
- No Section create/update/delete/move/drag/drop UI.
- No FDX upload/import UI.
- No visual redesign of Narrative or the broader Movie Studio.
- No mobile/tablet optimization or verification.
- No new generic tree framework for unrelated sidebars.
- No browser-side reference inference, range repair, structure validation, or
  fallback hierarchy.
- No old response, route, selection, or service compatibility objects.

## Context And Evidence

Primary current code includes:

- `features/movie-studio/scenes/scene-narrative-tab.tsx` for block/dialogue
  rendering and audio interactions;
- `screenplay-entity-mentions.ts` and image preview components for current
  `@handle` Cast/Location behavior;
- `studio-sidebar/*` for the inconsistent Act/Sequence disclosure models;
- `features/movie-studio/acts` and `sequences` for hierarchy-specific screens;
- Story Arc, Scene design, Beats, Shot Plans, Generations, Project Information,
  selection, and resource-refresh consumers;
- `services/studio-screenplay-api.ts` for the flat browser adapter; and
- the Plan-0166 Studio server resource contract.

The frontend must follow:

- `docs/architecture/reference/front-end-guidelines.md`;
- shadcn-only interactive controls from `packages/studio/src/ui`;
- URL-owned selection;
- shared resource refresh;
- intentional copy and no raw IDs/filenames; and
- desktop-first verification.

## Right-Sized Change Decision

### Patch current components in place

Insufficient. The current Narrative file already handles several unrelated
block/dialogue/audio branches, while Act/Sequence and mention behavior are
split by obsolete domain assumptions. Adding more cases would make the UI
harder to verify.

### Refactor the existing Movie Studio owners

Accepted. Preserve the existing visual system and workflows while extracting
bounded screenplay Narrative, Section, sidebar-tree, and service modules.

### Build a reusable document renderer or tree platform

Rejected. The product needs screenplay semantics and one bounded sidebar tree,
not a rich-document framework or generic hierarchical UI system.

## Architecture Shape Gate

### Ownership and module layout

```text
packages/studio/src/
  services/
    screenplay/
      index.ts
      structure.ts
      scenes.ts
      dialogue-audio.ts
      story-arc.ts

  features/movie-studio/
    screenplay/
      narrative/
        narrative-tab.tsx
        scene-heading.tsx
        opening.tsx
        block.tsx
        text-block.tsx
        dialogue-block.tsx
        dual-dialogue-block.tsx
        reference-text.tsx
        subject-preview.tsx
      sections/
        section-screen.tsx
        section-scene-list.tsx

    studio-sidebar/
      screenplay/
        tree.tsx
        section-row.tsx
        scene-row.tsx
        use-expanded-sections.ts
```

- `services/screenplay/index.ts` is a thin public service entrypoint. Fetch and
  response adaptation live in the focused files.
- `narrative/block.tsx` is a small exhaustive union dispatcher. It delegates
  presentation and may not absorb reference slicing, audio state, or feature
  loading.
- dialogue audio state remains in the existing focused audio feature/hooks;
  Dialogue components receive narrow callbacks and status.
- `studio-sidebar.tsx` remains the overall Project navigation composition and
  delegates only the screenplay subtree.
- `section-screen.tsx` composes the shared Section surface and does not branch
  into separate Act/Sequence implementations.

Expected deletions after callers move:

- flat `services/studio-screenplay-api.ts`;
- `screenplay-entity-mentions.ts` and its regex tests;
- screenplay-specific preview files left flat at `movie-studio` root;
- obsolete `acts/` and `sequences/` feature implementations; and
- duplicated Act/Sequence sidebar rendering branches.

No old-path re-export or wrapper component remains.

### Public browser boundary

The browser imports Plan-0166 types from `@gorenku/studio-core/client` and uses
the Plan-0166 HTTP resources directly. Feature-local types may add HTTP media
URLs or view state only; they must not reproduce Screenplay, Scene, Section,
structure, block, or reference domain models.

All interactive controls use local shadcn primitives. Semantic layout elements
may remain plain HTML.

### Forbidden shapes and stop conditions

Stop and revise if:

- Narrative block dispatch, reference slicing, audio orchestration, data fetch,
  and dialog state collect in one component;
- Act and Sequence regain separate row interaction models or feature trees;
- the browser computes canonical order or validates Section containment;
- text matching or `@handle` parsing replaces Core reference ranges;
- a presentation component writes screenplay data;
- raw HTML interactive controls are introduced;
- old service/route DTOs survive to ease the cutover;
- baseline parity is waived because tests pass; or
- a formatting/annotation feature appears because FDX once carried the data.

## Implementation Slices

### Slice 0 — Capture the live baseline before Plan 0166 cutover

- Use the running real project and supplied screenshot to create the baseline
  capture set and interaction matrix.
- Record exact viewport, theme, selected Scene/tab, expanded Sections, and any
  required local test setup.
- Treat inability to reproduce an important current interaction as a blocker,
  not permission to omit it.

### Slice 1 — Cut over service, routing, and selection contracts

- Add the screenplay service folder and consume structure/Section/Scene/
  dialogue-turn resources.
- Update URL parsing, Movie Studio selection, refresh keys, project shell,
  counts, and previous/next navigation.
- Add the unified Section URL/screen and remove Act/Sequence routes and DTOs.

### Slice 2 — Build the Scenes sidebar subtree

- Replace the Acts group with Scenes.
- Render every accepted structure shape from Core entries.
- Add the standard Section row and distinct icons.
- Keep selection and disclosure separate, keyboard accessible, and read-only.
- Preserve existing sidebar spacing, amber selection, hover treatment, and
  collapse motion.

### Slice 3 — Refactor Narrative without visual drift

- Move the current presentation into the bounded Narrative folder.
- Implement every text-block type through intentional components.
- Render `opening` above the first Scene.
- Preserve current Dialogue cards and wire normal Dialogue by Turn ID.
- Add desktop Dual Dialogue without changing ordinary Dialogue geometry.

### Slice 4 — Replace handle parsing with subject references

- Render exact ranges from Core and preserve surrounding text exactly.
- Adapt the existing hover/focus preview interaction for Cast, Location, and
  Prop subjects.
- Use presence references only for context, never arbitrary inline links.
- Delete regex mention parsing after all callers move.

### Slice 5 — Preserve the dialogue audio workspace

- Cut setup/estimate/generate/Takes/files/Advanced endpoints to Turn ID.
- Preserve separate editable audio text, live preview, autosave, focus, loading,
  errors, and refresh behavior.
- Prove each side of Dual Dialogue opens independent audio state.

### Slice 6 — Cut over all remaining Movie Studio consumers

- Update Project Information to direct Project metadata.
- Update Scene header, Beats, Shot Plans, Generations, Scene design, Story Arc,
  Cast, Locations, Props, counts, footer, coordination, and Trash assumptions.
- Remove hierarchy-only props, hooks, render branches, and tests.

### Slice 7 — Product Design QA and regression correction

- Recapture every baseline state at the same desktop viewport.
- Compare side by side for spacing, typography, alignment, hierarchy,
  interaction affordances, focus, and hover.
- Correct regressions before accepting new block/Section behavior.
- Do not use mobile behavior as a completion criterion.

## Tests And Guardrails

### Component and feature behavior

- Exhaustive test fixtures render every `ScreenplayBlock` variant and fail the
  TypeScript build when a new variant lacks presentation.
- Dialogue tests cover ordered parentheticals/speech, cue extensions, ordinary
  cards, Dual Dialogue, and separate Turn audio actions.
- Opening tests prove it appears only above the first Scene and never gains
  Scene actions/counts.
- reference tests cover Cast, Location, Prop, punctuation, repeated names,
  UTF-16 ranges, adjacent ranges, presence-only references, focus, and missing
  optional media.
- sidebar tests cover every valid flat/mixed structure, empty Sections,
  separate selection/disclosure, icons, counts, keyboard control, and fallback
  Scene labels, including numeric display padding and unchanged custom Final
  Draft numbers.
- Section screen tests cover Act/Sequence variants without ownership behavior.
- Story Arc tests render analytical Act segments independently of sidebar
  Sections, preserve all Basilica analyzed curves/beats/Scene details/summary,
  and show the no-analysis state without fallback dramatic tags.
- Project Information, Scene header, previous/next, Beats, Shot Plans,
  Generations, selection, and refresh receive focused contract tests.

### Dialogue regression tests

Retain or add coverage for:

- open/close/focus behavior;
- live audio-text preview without screenplay mutation;
- latest-only save behavior;
- estimate/generation loading and errors;
- Takes, Advanced, playback, and refresh; and
- independent Dual Dialogue turns.

### Visual and accessibility verification

- Desktop screenshot comparisons use the captured baseline states.
- Manual audit covers hover/focus hit areas, contrast, disclosure labels,
  keyboard order, Dialog focus management, reduced-motion behavior already
  supported by the app, and meaningful empty/fallback copy.
- No raw HTML buttons, inputs, textareas, selects, or dialogs are added.

### Architecture guardrails

- UI imports browser-safe Core contracts only.
- Services own fetch paths; features do not issue route-local fetches.
- Feature code does not import Studio server or database modules.
- Architecture tests protect import boundaries and exhaustive public union
  handling without naming private helpers.

## Documentation

Update current Studio UI, navigation, frontend-architecture, and user-facing
screenplay documentation for:

- Scenes root and optional read-only Sections;
- unified Section routes/surface;
- semantic block rendering and app-owned formatting;
- Cast/Location/Prop references;
- opening presentation; and
- the absence of formatting, ScriptNote, organization, and FDX upload UI.

Store the interaction matrices as plan evidence. Keep binary baseline/after
screenshots in the local Project review archive outside this repository; do not
turn them into repository or bundled production assets.

## Final Verification

Run:

```bash
pnpm --dir packages/studio test
pnpm --filter @gorenku/studio check
pnpm build
pnpm test
pnpm lint
pnpm check
```

Then use the running desktop Studio with the migrated real project to verify
every baseline state and new representative fixtures for flat Scenes, mixed
Sections, opening content, Props, every block type, and Dual Dialogue.

Final architecture review must inspect `git diff --stat`, the full diff, all
newly large components, union dispatch, service entrypoints, and deleted old
paths. Plan 0168 is blocked until the full workspace gates and desktop
regression matrix pass.

## Completion Checklist

### Review Area

- [ ] Confirm every UI requirement and shared-contract behavior has an implementation and verification owner.
- [ ] Confirm the current product was preserved rather than visually approximated from memory.
- [ ] Confirm the module/file shape matches the Architecture Shape Gate.
- [ ] Confirm no broad renderer, service, sidebar, or route compatibility layer was added.

### Baseline And Design Quality

- [ ] Capture every required current desktop state before backend cutover.
- [ ] Complete the interaction/accessibility matrix.
- [ ] Preserve the existing Narrative and dialogue-audio visual/interaction language.
- [ ] Run side-by-side Product Design QA at the same 1440×900 viewport.
- [ ] Correct visual, focus, hover, spacing, and copy regressions before completion.

### Sidebar And Sections

- [ ] Rename the root to Scenes and report Scene count.
- [ ] Render every accepted flat/mixed structure shape from Core.
- [ ] Standardize Act/Sequence rows with separate disclosure and selection.
- [ ] Use accepted root, Act, Sequence, and Scene icons.
- [ ] Replace separate Act/Sequence screens and URLs with the read-only Section surface.
- [ ] Add no organization controls or ownership behavior.

### Narrative And References

- [ ] Render Scene Heading and every complete block-union variant intentionally.
- [ ] Render opening content above only the first Scene and outside Scene actions/counts.
- [ ] Preserve ordinary Dialogue cards and implement semantic Dual Dialogue.
- [ ] Render Cast, Location, and Prop exact references from validated ranges.
- [ ] Keep presence references out of inline highlighting.
- [ ] Remove `@handle` parsing and old mention DTOs completely.
- [ ] Add no formatting or ScriptNote UI.

### Dialogue Audio

- [ ] Cut every audio endpoint/state lookup to Dialogue Turn ID.
- [ ] Preserve separate editable audio text and live card preview.
- [ ] Preserve autosave, estimate, generation, Takes, playback, Advanced, focus, and refresh behavior.
- [ ] Support independent left/right Dual Dialogue audio actions.
- [ ] Prove screenplay text is never changed by audio editing.

### Remaining UI And Services

- [ ] Move browser adapters under `services/screenplay/` and delete the flat predecessor.
- [ ] Update Project Information to direct Project metadata.
- [ ] Update Scene header, previous/next, Beats, Shot Plans, Generations, selection, counts, and coordination.
- [ ] Render Story Arc exclusively from Plan 0169 analytical Act segments, key beats, Scene analyses, suggestions, and summary; preserve the Basilica baseline and remove Scene-tag fallback behavior.
- [ ] Use one presentation-only Scene-number formatter: pad short digits-only values for sample parity and preserve all custom Final Draft values exactly.
- [ ] Keep Cast, Locations, and Props as independent Project surfaces.
- [ ] Remove all ancestry-only props, hooks, DTOs, routes, and tests.
- [ ] Keep all interactive controls on local shadcn primitives.

### Tests And Guardrails

- [ ] Add exhaustive block rendering and focused Narrative tests.
- [ ] Add complete reference-range/subject and sidebar-shape tests.
- [ ] Retain and extend dialogue audio regression tests.
- [ ] Add focused remaining-surface contract tests.
- [ ] Verify service/feature/server import boundaries and exhaustive union handling.
- [ ] Run desktop visual and accessibility checks; do not add mobile scope.

### Documentation

- [ ] Update current Studio navigation, UI, frontend, and screenplay docs.
- [ ] Store baseline/after evidence without bundling it into the app.
- [ ] Keep historical plans and rejected visual alternatives out of current docs.

### Final Verification

- [ ] Run Studio-focused tests/checks and all root gates.
- [ ] Complete the real `urban-basilica` desktop journey and synthetic new-contract fixtures.
- [ ] Review `git diff --stat` and the complete diff.
- [ ] Inspect newly large/heavily modified components and split before completion when needed.
- [ ] Confirm module `index.ts` files remain thin and old paths are deleted, not wrapped.
- [ ] Confirm no checklist item was satisfied by accepting visual or architectural regression.
- [ ] Only then mark Plan 0167 complete and unblock Plan 0168.
