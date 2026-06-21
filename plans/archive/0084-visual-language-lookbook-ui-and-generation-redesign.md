# 0084 Visual Language Lookbook UI And Generation Redesign

Status: proposed
Date: 2026-06-20

## Summary

The current Lookbook experience fails the product promise.

A Lookbook that opens as mostly text is not a Lookbook. It is a style memo. The
current storyboard Lookbook detail screen makes the artifact feel abstract,
unfinished, and embarrassingly unvisual. The left sidebar also fails basic
orientation: a user can be on a concrete storyboard Lookbook route while the
Lookbooks sidebar summary still reads as though the storyboard Lookbook is
missing, and the current sidebar treatment can hide the actual Lookbook row
behind collapsed navigation.

This plan redesigns Lookbooks as **visual packages** instead of text reports.
Text remains important, but only as direction attached to visible proof:
generated samples, a canonical sheet, section evidence, and a card image. A
Lookbook is not ready for selection or downstream generation until core can
verify that its visual package exists.

This is a full redesign. Existing code may be deleted or rewritten when it
conflicts with the new product contract. Do not preserve compatibility layers
for the text-first model.

## Research Reviewed

The revised model is based on storyboard and visual-development practice rather
than a one-off reaction to the current bad screen.

- [StudioBinder's storyboard rules](https://www.studiobinder.com/blog/storyboard-rules/)
  emphasize that boards must communicate story beats economically, choose an
  aspect ratio early, account for camera and character movement with arrows,
  preserve continuity, and respect screen direction and the 180-degree rule.
- [StudioBinder's storyboard examples](https://www.studiobinder.com/blog/storyboard-examples-film/)
  show that professional boards vary heavily by project: some rely on
  atmosphere, negative space, anime influence, repeated spatial anchors,
  detailed notes, or color and shading to communicate lighting and intention.
- [Boords' storyboarding guide](https://boords.com/how-to-storyboard)
  separates rough scamping from later visual refinement. It calls out aspect
  ratio, continuity, mood through framing and color, silhouette checks, shot
  variety, layering, and camera movement indicators.
- [Traditional animation production](https://en.wikipedia.org/wiki/Traditional_animation)
  separates storyboards from downstream design work such as model sheets,
  background styling, color styling, layouts, lighting, and timing. That
  supports treating storyboard style as a system, not as a single paragraph.
- [Pixar color-script coverage in Wired](https://www.wired.com/story/how-pixar-uses-hyper-colors-to-hack-your-brain/)
  describes color scripts as roadmaps for scene emotion and narrative, and
  highlights that luminance can carry emotion when hue range is broad. This is
  important: color and value are related, but they are not the same contract.
- [Hatching and cross-hatching](https://en.wikipedia.org/wiki/Hatching)
  are line-based value systems. For graphite or ink boards, line density,
  thickness, spacing, direction, and form-following marks are core style rules.
  They cannot be reduced to a generic color palette.

## Current Failure Critique

The current screen is not merely rough. It violates the object it is trying to
represent.

- The first viewport is dominated by huge text and long paragraphs. For a
  visual-language product surface, that is backwards: the image system should
  be the first thing the user understands.
- The typography has no editorial control. The section titles are oversized,
  body copy is dense and heavy, and the page creates accidental visual
  collisions where headings compete with paragraph blocks instead of guiding
  the eye.
- The layout reads like a raw generated report dumped into an app shell. There
  is no production-board rhythm, no gallery, no proof image, no section-level
  visual evidence, and no sense of craft.
- The tab order makes the wrong promise. `Definition` as the first tab tells
  the user the Lookbook is a document; `Visual Content` as the second tab makes
  imagery feel optional.
- The selection action is visually tiny and semantically weak. A storyboard
  Lookbook should clearly say whether it is ready to drive storyboard images,
  what visual proof it will use, and what is missing.
- The left sidebar does not respect the user's current location. If a route is
  `/visual-language/lookbooks/:lookbookId`, the Lookbooks subsection and the
  exact Lookbook row must be visible, highlighted, and understandable.
- The sidebar summary can say `Storyboard missing` while a storyboard Lookbook
  detail page is open. That indicates a contract or refresh bug around
  typed Lookbook listing and selection state. It must be fixed in core/service
  behavior or resource refresh, not patched with route-local UI guessing.

## Product Principle

**A Lookbook is a generated visual package with supporting direction.**

The user-facing artifact must include:

- a type: `movie` or `storyboard`;
- a name;
- a type-specific written definition;
- a medium and mark-making system;
- a value and tonal system;
- a color and chroma system;
- a card image used for navigation and quick recognition;
- section-attached visual samples;
- a canonical Lookbook sheet;
- readiness information showing whether the Lookbook can be selected and used
  by downstream generation.

For storyboard Lookbooks, the visuals are not decoration. They are the product.
They must show what the storyboard style actually looks like: line quality,
medium, mark-making, value structure, color/chroma strategy, material finish,
panel notation, continuity
anchors, and readability. A storyboard style is not assumed to be hand-drawn,
monochrome, graphite, or rough. It can be black-and-white production boards,
full-color comic panels, realistic previs frames, painterly keyframes, anime
boards, collage boards, or another deliberate visual mode.

## Hard Product Gates

### No Text-Only Finished Lookbooks

Core must distinguish a Lookbook draft from a ready Lookbook.

A Lookbook may temporarily exist while an agent is assembling it, but Studio
must not present that draft as a complete usable Lookbook. It should appear as
an assembly state with missing visual requirements, or not appear in the main
ready list until the product chooses to expose drafts there.

A Lookbook is ready only when core can verify:

- required definition sections are present and non-empty;
- required medium, mark-making, value, and color/chroma data is present when
  the Lookbook type requires it;
- a card image exists;
- a canonical Lookbook sheet exists;
- required section visual samples exist for the Lookbook type;
- all attached images and sheets belong to the same Lookbook and match its
  type-specific section vocabulary.

### Selection Requires Visual Readiness

`selectLookbookForType` must refuse unready Lookbooks.

The rule belongs in `packages/core`, because selection determines durable
project state and downstream generation behavior. Studio server routes, CLI
commands, React components, and agent skills must call the core command and
render the structured result.

### Generation Requires Visual Readiness

Storyboard image generation must require the selected `storyboard` Lookbook and
its canonical sheet. Movie-facing generation that depends on movie visual
language must require the selected `movie` Lookbook and its visual package.

Do not let downstream generation silently proceed from prose alone.

### Lookbook Creation Means Assembly

When an agent is asked to generate a Lookbook, the workflow must assemble the
whole visual package:

1. Author the type-specific written definition.
2. Generate section-focused sample images.
3. Import those images as Lookbook images and attach them to sections.
4. Generate the canonical Lookbook sheet.
5. Set the card image.
6. Verify readiness through core.
7. Select the Lookbook for its type only after readiness passes, when selection
   was requested.

The agent-facing flow must not stop after writing JSON.

## Target User Experience

### Lookbooks Index

The Lookbooks index should become a visual command center, not a plain card
grid.

Expected layout:

- a compact header summarizing selected Movie and Storyboard Lookbooks;
- separate lanes for `Movie Lookbooks`, `Storyboard Lookbooks`, and
  `Assembling`;
- each Lookbook row/card uses the card image or sheet preview as the dominant
  surface;
- readiness and selection state are visible without opening the detail page;
- missing visual requirements are shown as concise structured state, not
  generic empty copy;
- the primary action for an unready Lookbook is to continue visual assembly;
- the primary action for a ready unselected Lookbook is to select it for its
  type;
- the primary action for a selected Lookbook is to inspect or replace it.

The index should not use filler labels, raw ids, generated role names, or
technical filenames on visual cards.

## Visual Proposal

This plan has a concrete desktop visual proposal:

![Storyboard Lookbook visual package proposal](assets/0084-storyboard-lookbook-visual-package-proposal.png)

The proposal is intentionally not an infographic. Every visible region maps to
an implementable Studio surface:

- the left sidebar shows typed Lookbook navigation with the selected Storyboard
  Lookbook visible under `Lookbooks`;
- the header shows compact title, type, readiness, and the selected action;
- the main canvas is the canonical Lookbook sheet, not prose;
- the proof filmstrip shows section-attached generated images for
  `visualIntent`, `mediumAndMark`, `valueSystem`, `colorSystem`,
  `panelAndCameraGrammar`, and `continuitySystem`;
- the right rail shows product components for medium/mark samples, value ramp,
  role-based color system, panel/camera grammar, and assembly status;
- the bottom action is package-level regeneration, not a decorative control.

For the graphite example, the right rail shows why `Color System` is not a
generic palette bucket. It is a role palette:

- `Paper`
- `Line`
- `Midtone`
- `Shadow`
- `Sepia Accent`

The visual representation also shows the separate `Value System` ramp and the
separate `Medium And Mark` samples. That separation is the product model: a
graphite Lookbook needs a material palette, tonal ramp, and mark vocabulary,
not just a paragraph saying "graphite."

## Visual Package Production

Lookbook visuals should be produced during Lookbook assembly, before the
Lookbook can be selected.

The planned production sequence is:

1. Core creates or updates the Lookbook definition as an assembling artifact.
2. The agent requests a `lookbook.image` generation context for the Lookbook.
3. The agent generates a focused sample pack. The prompt is derived from the
   Storyboard Lookbook definition and asks for proof images for:
   `visualIntent`, `mediumAndMark`, `valueSystem`, `colorSystem`,
   `panelAndCameraGrammar`, and `continuitySystem`.
4. The agent imports generated samples as Lookbook images and attaches each
   image to one or more sections through core-owned section validation.
5. The agent requests a `lookbook.sheet` generation context after section
   samples exist.
6. The agent generates the canonical Lookbook sheet. This sheet is a compact
   proof board that synthesizes the accepted section samples into the reference
   image downstream generation should depend on.
7. The agent imports the canonical sheet as a Lookbook sheet.
8. The agent sets the card image from a generated sample or from the canonical
   sheet crop.
9. Core calculates readiness. Only then can `selectLookbookForType` succeed.

The Studio UI should render this assembly state directly. If samples or the
canonical sheet are missing, the screen should show a useful assembly status
and regeneration action. It should not show a text-only Lookbook as complete.

### Lookbook Detail

The detail page should be rewritten from scratch if the current report renderer
cannot support a visual-first design.

Default view:

- first viewport opens on the visual package, not the prose definition;
- a large canonical sheet or selected sample is the visual anchor;
- a side or lower filmstrip shows section samples;
- the Lookbook name, type, readiness, selection state, and source context sit
  in compact app chrome, not oversized marketing typography;
- section text appears as supporting notes beside or below the relevant visual
  sample;
- long prose can expand into a `Definition` or `Spec` view, but it must not be
  the default reading experience;
- empty visual areas are treated as assembly tasks, not as acceptable final
  content.

For storyboard Lookbooks, the default detail experience should feel like a
visual proof wall:

- `Visual Intent`: broad sample or sheet overview that shows the storyboard
  mode at a glance.
- `Medium And Mark`: proof of the chosen medium, finish, surface, line weight,
  edge behavior, hatching or brush system, texture, construction marks, and
  detail density.
- `Value System`: proof of tonal range, contrast, shadow logic, silhouette
  readability, focal hierarchy, and how value separates figures, props, and
  environments.
- `Color System`: visible swatches and image proof showing chroma mode, hue
  range, saturation, color temperature, material/skin/wardrobe/environment
  roles, accent rules, and scene-to-scene variation.
- `Panel And Camera Grammar`: proof of aspect ratio, gutters, captions,
  arrows, camera marks, frame borders, movement notation, and shot-to-shot
  screen direction.
- `Continuity System`: proof of recurring character, prop, and location
  recognition across panels.
- `Guardrails`: concise forbidden modes; visual examples are optional and
  should not encourage a gallery of bad outputs.

This structure is deliberately not a synonym swap. Graphite needs all of these
sections too:

- `Medium And Mark` describes graphite grade, line pressure, contour hierarchy,
  visible construction marks, smudge, paper tooth, eraser highlights, hatching,
  and cross-hatching.
- `Value System` describes the paper-white to darkest-graphite ramp, whether
  the board uses two, three, five, or full tonal steps, how shadows are built,
  and how silhouettes stay readable.
- `Color System` describes the chromatic limits of the graphite board: paper
  warmth, graphite temperature, optional wash, optional colored pencil or sepia
  accent, and the rule for when an accent is allowed.

So a graphite storyboard is not "no palette." It is a monochrome or
limited-chroma storyboard with a precise material palette, tonal ramp, and mark
system.

### Sidebar

The Visual Language sidebar must behave like navigation for real artifacts.

Required behavior:

- selecting or routing to a Lookbook auto-expands `Visual Language` and
  `Lookbooks`;
- the exact Lookbook row is visible and highlighted;
- rows should group or visually distinguish Movie and Storyboard Lookbooks;
- rows should include a tiny thumbnail or visual mark when practical, because
  visual identity matters for Lookbooks;
- the Lookbooks parent summary must be derived from the core list resource and
  must correctly report selected or missing Movie and Storyboard Lookbooks;
- if the detail route can read a Lookbook, the list resource must include it
  unless core says it is discarded or outside the current project.

The sidebar must not invent selection state from the URL. If the summary is
wrong, fix the core resource, route refresh, or client service contract.

## Design Direction

This is a desktop-first production tool surface.

Use a restrained, cinematic, image-led app design:

- dark Studio shell remains acceptable, but the main panel needs better visual
  rhythm, contrast, and spacing;
- images should provide the drama, not giant type;
- typography should be editorial but controlled: compact labels, readable
  section headings, moderate body text, and deliberate control text;
- use stable split-pane or proof-wall geometry instead of nested card piles;
- avoid large rounded decorative wrappers, marketing-page hero sections,
  generic dashboards, and text-heavy report dumps;
- use local shadcn-style primitives from `packages/studio/src/ui` for all
  controls;
- use lucide icons only when they clarify actions and match the Studio icon
  system;
- do not optimize or test for mobile unless explicitly requested.

Before implementation, generate visual concepts for:

- Lookbooks index with selected Movie and Storyboard states;
- ready graphite/monochrome storyboard Lookbook detail;
- ready color or realistic storyboard Lookbook detail;
- assembling storyboard Lookbook detail with missing visual requirements;
- sidebar state with visible typed Lookbook rows.

Those concepts become the implementation spec. The implementation must be
verified against them with browser screenshots and `view_image`.

## Architecture

### Core Ownership

`packages/core` owns:

- Lookbook type rules;
- readiness requirements;
- valid section vocabularies;
- selection eligibility;
- dependency requirements for downstream generation;
- structured diagnostics for unready or invalid Lookbooks;
- resource projections consumed by Studio and CLI.

Studio React code must not decide whether a Lookbook is ready. It only renders
the core readiness report and calls core-owned commands through thin services.

### Proposed Core Contracts

Add this core-owned readiness projection:

```ts
interface LookbookReadiness {
  state: 'assembling' | 'ready';
  missingRequirements: LookbookReadinessRequirement[];
}

type LookbookReadinessRequirement =
  | 'definition'
  | 'cardImage'
  | 'canonicalSheet'
  | 'sectionSamples';
```

These are the planned public names for this slice. If review rejects a name,
update this plan before implementation instead of introducing an implementation
local rename, alias, or wrapper.

Add readiness to:

- `LookbookResource`;
- `LookbooksResource` list items;
- CLI show/list reports;
- selection command reports when selection fails.

The readiness calculation should be deterministic and tested in core.

Replace the current storyboard section model with this planned public shape:

```ts
type StoryboardFinishLevel =
  | 'thumbnail'
  | 'scamp'
  | 'productionBoard'
  | 'styleFrame'
  | 'technicalPrevis';

type StoryboardColorMode =
  | 'monochrome'
  | 'monochromeWithAccent'
  | 'limitedColor'
  | 'fullColor'
  | 'productionColor'
  | 'realisticGrade';

interface StoryboardLookbookDefinition {
  visualIntent: StoryboardLookbookTextSection;
  mediumAndMark: StoryboardMediumAndMarkSection;
  valueSystem: StoryboardValueSystemSection;
  colorSystem: StoryboardColorSystemSection;
  panelAndCameraGrammar: StoryboardPanelAndCameraGrammarSection;
  continuitySystem: StoryboardLookbookTextSection;
  guardrails: StoryboardLookbookTextSection;
}

interface StoryboardMediumAndMarkSection {
  finishLevel: StoryboardFinishLevel;
  media: string[];
  description: string;
  lineRules: string[];
  textureRules: string[];
  surfaceRules: string[];
  detailRules: string[];
}

interface StoryboardValueSystemSection {
  valueRange: 'twoValue' | 'threeValue' | 'fiveValue' | 'fullRange';
  contrast: 'low' | 'medium' | 'high';
  description: string;
  shadowRules: string[];
  silhouetteRules: string[];
  focalHierarchyRules: string[];
}

interface StoryboardColorSystemSection {
  mode: StoryboardColorMode;
  description: string;
  swatches: StoryboardColorSwatch[];
  usageRules: string[];
  variationRules: string[];
}

interface StoryboardColorSwatch extends ColorSwatch {
  role:
    | 'substrate'
    | 'line'
    | 'midtone'
    | 'shadow'
    | 'highlight'
    | 'skin'
    | 'wardrobe'
    | 'environment'
    | 'accent'
    | 'effect'
    | 'grade';
  required: boolean;
}

interface StoryboardPanelAndCameraGrammarSection {
  aspectRatio: string;
  panelRules: string[];
  notationRules: string[];
  movementRules: string[];
  continuityRules: string[];
}
```

`StoryboardColorSwatch` should extend the existing core-owned
visual-language `ColorSwatch` shape so palette colors still have stable names,
hex values, and meanings. The added `role` and `required` fields make the
palette actionable for generation: graphite can name substrate, line, midtone,
shadow, highlight, and accent roles; full-color boards can name skin, wardrobe,
environment, effect, and grade roles.

Storyboard section names should describe the current product model directly and
should not be kept through runtime aliases. Update callers and tests directly
when section names change.

### Required Visual Evidence By Type

Movie Lookbook readiness should require:

- card image;
- canonical Lookbook sheet;
- at least one image attached to `thesis` or `toneMood`;
- at least one image attached to one of `composition`, `lighting`, `texture`,
  or `camera`.

Storyboard Lookbook readiness should require:

- card image;
- canonical Lookbook sheet;
- `mediumAndMark.media` is non-empty and its rules are non-empty enough to
  drive prompt construction;
- `valueSystem` declares value range, contrast, shadow rules, silhouette rules,
  and focal hierarchy rules;
- `colorSystem` declares a `mode`, swatches, usage rules, and variation rules;
- at least one image attached to `visualIntent` or `mediumAndMark`;
- at least one image attached to `valueSystem`;
- at least one image attached to `colorSystem`;
- at least one image attached to `panelAndCameraGrammar`;
- at least one image attached to `continuitySystem`;
- for `monochrome` and `monochromeWithAccent`, `colorSystem.swatches` includes
  required substrate, line, midtone, shadow, and highlight roles, plus accent
  when the mode allows accent;
- for `limitedColor`, `fullColor`, `productionColor`, and `realisticGrade`,
  `colorSystem.swatches` includes enough required roles to guide foreground,
  character, environment, shadow, highlight, and accent behavior.

`guardrails` visual evidence is optional.

These requirements are intentionally strict enough to prevent text-only
Lookbooks, but not so strict that every section must have separate bespoke
art before the user can evaluate the artifact.

### Generation And Agent Workflow

The agent-facing Lookbook generation workflow should be redesigned around
assembly.

Planned command flow:

```bash
renku lookbook draft create --file storyboard-lookbook.json
renku generation context --purpose lookbook.image --target lookbook:<lookbook-id>
renku generation spec create --file storyboard-lookbook-samples-spec.json
renku generation run --spec <media-generation-spec-id>
renku media import --purpose lookbook.image --target lookbook:<lookbook-id> --sections mediumAndMark,valueSystem,colorSystem,panelAndCameraGrammar,continuitySystem --source <project-relative-path>
renku generation context --purpose lookbook.sheet --target lookbook:<lookbook-id>
renku generation spec create --file storyboard-lookbook-sheet-spec.json
renku generation run --spec <media-generation-spec-id>
renku media import --purpose lookbook.sheet --target lookbook:<lookbook-id> --source <project-relative-path>
renku lookbook card-image set --lookbook <lookbook-id> --image <lookbook-image-id>
renku lookbook readiness --lookbook <lookbook-id>
renku lookbook select --type storyboard --lookbook <lookbook-id>
```

These are the planned public command names for this slice. If current CLI
commands conflict with this flow, rename them directly and update callers. Do
not add aliases or compatibility wrappers.

The `renku:lookbook-designer` skill must be updated so "create a Lookbook"
means "assemble the visual package and verify readiness." It should not claim
completion while only the definition JSON exists.

### Studio Server

Studio server routes stay thin:

- read params and body;
- call project data service methods;
- return the core resource or structured error;
- do not compute readiness, selection eligibility, or section validity.

### Studio React

Rewrite the Lookbook surfaces around these feature-local components:

```text
packages/studio/src/features/movie-studio/visual-language/
  lookbooks-panel.tsx
  lookbook-panel.tsx
  lookbook-readiness.tsx
  lookbook-visual-package.tsx
  lookbook-section-proof.tsx
  lookbook-proof-filmstrip.tsx
  lookbook-sidebar-summary.ts
```

Promote only genuinely reusable, domain-neutral primitives to `src/ui`.

`VisualLanguageReport` should be split or replaced if it keeps forcing
Inspiration Analysis and Lookbooks into the same text-report layout. Shared
rendering is useful only when it preserves the product meaning of each surface.

## Implementation Slices

### Slice 1: Readiness Contract

- Add core readiness calculation for Movie and Storyboard Lookbooks.
- Add tests that text-only Lookbooks are `assembling`.
- Add tests that ready Lookbooks require card image, canonical sheet, and
  required section samples.
- Add tests that invalid section attachments are rejected by core.
- Add readiness to list/show resources.

### Slice 2: Selection And Dependency Enforcement

- Update `selectLookbookForType` to reject unready Lookbooks with structured
  diagnostics.
- Update generation dependency planning so storyboard generation requires a
  selected ready Storyboard Lookbook and canonical sheet.
- Update movie-facing generation purposes that require visual language to use
  a selected ready Movie Lookbook.
- Add focused tests for missing selected Lookbook, unready selected Lookbook,
  and missing canonical sheet.

### Slice 3: Agent And CLI Assembly Flow

- Rename or reshape CLI commands around draft creation, readiness inspection,
  visual import, sheet import, card-image assignment, and selection.
- Update `renku:lookbook-designer` guidance so Lookbook creation includes
  image generation, import, sheet generation, readiness verification, and
  optional selection.
- Update docs and command help to remove any text-only completion path.

### Slice 4: Visual Concepts

- Generate desktop concepts for the Lookbooks index, ready graphite/monochrome
  storyboard detail, ready color or realistic storyboard detail, assembling
  storyboard detail, and sidebar state.
- Review concept fidelity against the product requirements in this plan.
- Reject concepts that make prose the dominant first-viewport object.
- Reject concepts that cannot clearly show medium/mark, value, and color as
  related but separate style dimensions.
- Accept one concept set before coding.

### Slice 5: Studio UI Rewrite

- Rewrite `LookbooksPanel` as a visual index with typed lanes and readiness.
- Rewrite `LookbookPanel` as a visual-package detail surface.
- Replace or split `VisualLanguageReport` where it conflicts with the
  visual-first Lookbook design.
- Update `LookbookVisualContentTab` so it supports assembly and proof review
  instead of feeling like an optional afterthought.
- Keep all controls on local shadcn-style primitives.
- Avoid raw form controls in feature code.

### Slice 6: Sidebar Repair

- Auto-expand `Visual Language` and `Lookbooks` when a Lookbook is selected.
- Render typed Lookbook rows under the Lookbooks subsection.
- Highlight the current Lookbook row.
- Show correct selected/missing state from `LookbooksResource`.
- Add a regression test proving a readable detail Lookbook also appears in the
  list resource and sidebar projection.

### Slice 7: Browser Verification

- Run the Studio app.
- Verify the current desktop viewport in Browser/IAB first.
- Capture screenshots for the accepted concepts and implementation.
- Use `view_image` on both concept and implementation screenshots.
- Compare at least:
  - first viewport visual hierarchy;
  - sidebar visibility and selected row;
  - typed selected/missing summary;
  - visual package dominance over prose;
  - readiness and selection actions;
  - section sample layout;
  - control typography and icon treatment.
- Do not report completion while material visual mismatches remain.

## Completion Checklist

### Review Area

- [ ] Confirm this plan replaces the text-first Lookbook UI direction.
- [ ] Confirm text-only finished Lookbooks are not an acceptable product state.
- [ ] Confirm readiness and selection eligibility belong in `packages/core`.
- [ ] Confirm no compatibility aliases or fallback text-only runtime paths are
      being preserved.
- [ ] Confirm desktop-first verification scope.

### Core Contracts

- [ ] Add `LookbookReadiness` or the accepted final equivalent to core client
      contracts.
- [ ] Add readiness to `LookbookResource`.
- [ ] Add readiness to `LookbooksResource` list items.
- [ ] Add type-specific readiness requirements for Movie Lookbooks.
- [ ] Add type-specific readiness requirements for Storyboard Lookbooks.
- [ ] Replace graphite-first storyboard section names with `visualIntent`,
      `mediumAndMark`, `valueSystem`, `colorSystem`,
      `panelAndCameraGrammar`, `continuitySystem`, and `guardrails`.
- [ ] Add first-class `mediumAndMark`, `valueSystem`, and `colorSystem`
      sections for Storyboard Lookbooks.
- [ ] Extend the existing core `ColorSwatch` contract with storyboard-specific
      `role` and `required` fields through `StoryboardColorSwatch`.
- [ ] Add explicit monochrome, monochrome-with-accent, limited-color,
      full-color, production-color, and realistic-grade color modes.
- [ ] Add structured diagnostics for unready selection attempts.
- [ ] Ensure diagnostics mention current requirements only, not obsolete
      text-only behavior.
- [ ] Add tests for text-only Lookbooks being unready.
- [ ] Add tests for ready Movie Lookbooks.
- [ ] Add tests for ready Storyboard Lookbooks.
- [ ] Add tests for missing card image.
- [ ] Add tests for missing canonical sheet.
- [ ] Add tests for missing required section samples.
- [ ] Add tests for missing Storyboard Lookbook medium and mark rules.
- [ ] Add tests for missing Storyboard Lookbook value-system rules.
- [ ] Add tests for missing Storyboard Lookbook color-system swatches and
      usage rules.
- [ ] Add tests for graphite Storyboard Lookbooks using deliberate substrate,
      line, midtone, shadow, highlight, and optional accent swatches rather
      than an absent palette.

### Generation Dependencies

- [ ] Require ready selected Storyboard Lookbook for storyboard sheet
      generation.
- [ ] Require canonical Storyboard Lookbook sheet as a dependency for
      storyboard sheet generation.
- [ ] Require ready selected Movie Lookbook for movie visual-language-dependent
      generation purposes.
- [ ] Update dependency inventory tests.
- [ ] Update purpose lifecycle matrix tests.
- [ ] Verify no downstream generation path silently uses prose-only Lookbook
      guidance.

### CLI And Agent Workflow

- [ ] Define accepted command names for draft creation, readiness inspection,
      image import, sheet import, card image assignment, and selection.
- [ ] Update CLI handlers while keeping them thin over core.
- [ ] Update CLI tests for the new assembly flow.
- [ ] Update command docs.
- [ ] Update `renku:lookbook-designer` so it generates and imports visuals
      before calling a Lookbook complete.
- [ ] Remove or rewrite any skill guidance that treats Lookbook JSON alone as
      completion.
- [ ] Remove or rewrite any skill guidance that assumes storyboard Lookbooks
      are always graphite, hand-drawn, monochrome, or production-board styled.

### Visual Concepts

- [ ] Generate Lookbooks index concept.
- [ ] Generate ready graphite/monochrome storyboard Lookbook detail concept.
- [ ] Generate ready color or realistic storyboard Lookbook detail concept.
- [ ] Generate assembling storyboard Lookbook detail concept.
- [ ] Generate sidebar concept with typed visible Lookbook rows.
- [ ] Accept one cohesive visual system before implementation.
- [ ] Record design tokens, typography, spacing, container model, icon
      treatment, and allowed visible copy from the accepted concepts.

### Studio UI

- [ ] Rewrite `LookbooksPanel` around visual typed lanes.
- [ ] Rewrite `LookbookPanel` around the visual package.
- [ ] Replace or split `VisualLanguageReport` where needed.
- [ ] Render canonical sheet prominently.
- [ ] Render Storyboard Lookbook medium/mark, value, and color systems
      prominently near the visual proof, not buried in prose.
- [ ] Render graphite palettes with substrate, line, midtone, shadow,
      highlight, and accent roles when applicable.
- [ ] Render section samples as the primary detail surface.
- [ ] Move long prose into supporting notes or a secondary spec view.
- [ ] Render readiness state and missing requirements from core.
- [ ] Render selection actions only when core says the Lookbook is ready.
- [ ] Use only local shadcn-style controls from `packages/studio/src/ui`.
- [ ] Avoid raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`,
      and similar controls in feature code.
- [ ] Avoid visible raw filenames, ids, generic generated role names, and
      filler labels on visual cards.

### Sidebar

- [ ] Auto-expand `Visual Language` for Lookbook routes.
- [ ] Auto-expand `Lookbooks` for Lookbook routes.
- [ ] Render Movie and Storyboard Lookbook rows with clear type identity.
- [ ] Highlight the active Lookbook row.
- [ ] Show correct selected/missing summary from core list resource.
- [ ] Add regression coverage for list/detail consistency.
- [ ] Add regression coverage for selected Lookbook row visibility.

### Verification

- [ ] Run focused core tests.
- [ ] Run focused Studio tests.
- [ ] Run `pnpm --dir packages/studio` checks required by the touched package.
- [ ] Run Studio locally.
- [ ] Verify with Browser/IAB at desktop size.
- [ ] Capture implementation screenshots.
- [ ] Use `view_image` on accepted concept screenshots.
- [ ] Use `view_image` on implementation screenshots.
- [ ] Write a fidelity ledger comparing concept and implementation.
- [ ] Confirm no material visual mismatches remain.
- [ ] Confirm the primary Lookbook assembly and selection path works end to
      end.

## Non-Goals

- Do not design mobile behavior in this slice.
- Do not add compatibility aliases for old text-first commands or fields.
- Do not move generation business rules into Studio React code.
- Do not make `VisualLanguageReport` a generic dumping ground for unrelated
  report shapes.
- Do not accept a finished Lookbook surface with no generated images.
