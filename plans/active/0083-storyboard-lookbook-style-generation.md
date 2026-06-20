# 0083 Storyboard Lookbook Style Generation

Status: proposed
Date: 2026-06-20

## Summary

Storyboard images need their own first-class Lookbook. The current system uses
one project-level active Lookbook, and storyboard sheet generation partly relies
on a static hand-drawn style prompt. That gives useful default taste, but it is
not settable, not visible as a project artifact, not enforced through generation
dependencies, and not strong enough to keep storyboard batches consistent across
sequences.

This plan introduces typed Lookbooks:

- `Movie` Lookbooks define the film's visual language for production design,
  cast, locations, shot design, and final media.
- `Storyboard` Lookbooks define the graphic language for storyboard images:
  drawing medium, value range, accent color rules, panel/notation rules,
  continuity/readability rules, and guardrails.

The existing "active Lookbook" concept will be replaced with type-specific
Lookbook selection. A Lookbook card, resource, CLI report, and UI control should
identify its type instead of showing generic `Active` copy. Storyboard sheet
generation will require the selected `Storyboard` Lookbook and its default
Lookbook sheet as an explicit generation dependency.

This is not a compatibility migration. Runtime code should read as though
typed Lookbooks and typed selections are the only current model.

## Problem

The static storyboard style currently lives mostly in agent guidance and prompt
construction. The most important local sources found during the survey were:

- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/scene-storyboard-sheet.md`
- `plans/active/0035-scene-storyboard-sheet-aspect-ratio-and-style.md`
- `packages/core/src/server/media-generation/scene-storyboard-sheet.ts`
- `packages/core/src/client/scene-storyboard-media-generation.ts`
- `docs/architecture/reference/media-generation.md`

The current style direction is useful: hand-drawn graphite/light ink on warm
off-white paper, mostly black and white, subtle gray or beige washes, and
careful panel slicing. However, the current implementation has architectural
gaps:

- The style is not a durable project artifact that the user can author,
  inspect, revise, or select.
- The static prompt can drift away from a user's movie Lookbook or current
  project taste.
- Storyboard generation reads the project active Lookbook as optional text
  guidance, even though storyboard image style is its own concern.
- The `scene.storyboard-sheet` purpose does not declare a required Lookbook
  sheet dependency, so dependency planning cannot materialize or price the
  style reference before generation.
- The UI and CLI expose a single `active` Lookbook concept, which becomes
  ambiguous once a project needs both a movie visual language and a storyboard
  graphic language.

## External Research Reviewed

The external research supports treating storyboard consistency as a combination
of style, composition rules, annotation grammar, and continuity rules rather
than only an illustration aesthetic.

- [StudioBinder storyboard examples](https://www.studiobinder.com/blog/storyboard-examples-film/)
  emphasizes that storyboards align a production team before costly work begins,
  and highlights repeated spatial details, camera movement, directional arrows,
  lighting/shading notes, action direction, and visual continuity across complex
  scenes.
- [StudioBinder storyboard rules](https://www.studiobinder.com/blog/storyboard-rules/)
  emphasizes movement arrows, multiple panels when motion is extensive, screen
  direction, relative character sizes, relative positions, camera movement,
  character movement, the 180-degree rule, and legibility.
- [Boords: How to Storyboard](https://boords.com/how-to-storyboard)
  emphasizes rough/scamped drawings over polished art, choosing aspect ratio
  early, continuity, mood through framing/color/transitions, silhouette checks,
  unobtrusive staging/color, shot variety, camera move indicators, and clear
  shot labeling.
- [Camera Artist: Enhancing the Cinematic Language of Text-to-Video Models](https://arxiv.org/abs/2604.09195)
  describes how explicit cinematic language, prior visual context, hierarchical
  storyboard assets, shot descriptions, camera configuration, composition, and
  visual references can reduce drift in AI storyboard or video generation.

## Product Direction

### Storyboard Lookbook Definition

A `Storyboard` Lookbook should be a project-native visual language artifact for
storyboard images. It can be inspired by the selected `Movie` Lookbook, but it
must have its own sections because movie guidance and storyboard guidance do not
describe the same surface.

The initial `Storyboard` Lookbook sections should be smaller and more
actionable than the movie Lookbook sections. Each section should answer a
generation-facing question. If a field cannot meaningfully change the generated
image, it should not be a first-class section.

- `styleBrief`: the short, reusable style promise that can be prepended to
  storyboard prompts. This should say what a valid board from this project
  looks like in one concrete paragraph.
- `lineAndFinish`: the drawing medium and finish level. This covers line
  weight, mark-making, paper, roughness, face detail, architecture detail, prop
  detail, and how polished or scamped the panels should feel.
- `valueAndAccent`: the black-and-white, gray wash, shadow, highlight, and
  accent color rules. This is where the user decides whether accents are never
  used, used only for fire/blood/important props, or used as small directional
  emphasis.
- `panelAndNotation`: the frame, gutters, labels, captions, arrows, camera
  move symbols, action lines, and whether notes sit inside or outside the image
  area.
- `continuityAndClarity`: the practical readability rules that keep images
  coherent across a sequence: screen direction, relative character scale,
  recurring location anchors, prop continuity, silhouette readability, and
  repeated spatial relationships.
- `guardrails`: forbidden modes and common mistakes to avoid, such as
  photorealism, finished-film stills, heavy noir grading unless requested,
  modern UI text, random typography, crop marks inside panels, debug overlays,
  or over-rendered concept art.

The default taste can remain close to the current good style: expressive
graphite, ink, warm off-white paper, mostly black and white, restrained accents
only when they clarify story or movement. The important change is that this
style becomes user-authored, selectable, dependency-backed, and easy for an
agent to turn into prompt instructions.

### Movie Lookbook Definition

The existing movie visual language remains valuable. It should become a
`Movie` Lookbook type with sections for the film's production-facing look:

- `thesis`
- `palette`
- `toneMood`
- `composition`
- `lighting`
- `texture`
- `camera`

Current names can remain for this type because they describe the movie surface
well. The public contract should make it clear that these are `Movie` Lookbook
sections, not universal Lookbook sections.

### Selection Language

Replace `active` with explicit type selection:

- `selected Movie Lookbook`
- `selected Storyboard Lookbook`

The UI should show the Lookbook type under the name or as a small badge. A card
should not show `Active` as its generic status. For example:

- A movie Lookbook card can show `Movie`.
- A storyboard Lookbook card can show `Storyboard`.
- A selected movie Lookbook can expose an action such as `Use for movie
  generation`.
- A selected storyboard Lookbook can expose an action such as `Use for
  storyboard images`.

The sidebar should summarize type-specific selections, for example `Movie and
Storyboard selected` or `Storyboard missing`, instead of `Active look selected`.

### Definition And Visual Content Design

`Storyboard` Lookbooks should follow the same high-level design language as the
current movie Lookbook screen: a quiet dark production surface, large readable
section titles, source chips, strong image previews, and a distinction between
authored definition and visual evidence. It should not feel like a separate
tool bolted onto Visual Language.

The `Definition` tab should be the canonical written style contract. For a
Storyboard Lookbook it should show:

- Lookbook name, `Storyboard` type, selection state, source inspiration chips,
  and source Movie Lookbook chips when present.
- The six practical sections in a stable order:
  - `styleBrief`
  - `lineAndFinish`
  - `valueAndAccent`
  - `panelAndNotation`
  - `continuityAndClarity`
  - `guardrails`
- Each section as an editorial row similar to the current movie Lookbook
  definition rows: section number, section title, the authored text, and any
  attached visual examples for that section.
- No long educational helper copy in the main reading surface. Authoring
  guidance belongs in the agent skill references, prompts, and creation/editing
  affordances. The Definition tab should read like final art-direction notes,
  not a textbook.

The `Visual Content` tab should support experimentation, selection, and
evidence. For a Storyboard Lookbook it should group images by the same practical
sections rather than by movie visual-language sections. The expected content is:

- Section-attached sample storyboard frames for `lineAndFinish`,
  `valueAndAccent`, `panelAndNotation`, and `continuityAndClarity`.
- Optional sample images for `styleBrief` when the user wants a broad hero
  example.
- Optional guardrail examples only when they help the agent avoid a common
  mistake. The product should not encourage users to build a gallery of bad
  outputs by default.
- A canonical Storyboard Lookbook sheet, generated through `lookbook.sheet`,
  which becomes the dependency for `scene.storyboard-sheet`.
- A single card/hero image for navigation, set with the existing Lookbook card
  image concept.

The user should be able to work iteratively with an AI agent:

1. Author or revise the Storyboard Lookbook definition.
2. Generate one or more `lookbook.image` samples focused on a specific section.
3. Import the best sample images back into the Lookbook.
4. Attach each image to the relevant Storyboard Lookbook section.
5. Promote one image to the Lookbook card image when it represents the overall
   storyboard style.
6. Generate or regenerate the canonical `lookbook.sheet` after the samples and
   definition feel coherent.

The CLI workflow should use the same generation architecture as movie Lookbook
visual content. The planned agent-facing flow is:

```bash
renku generation context --purpose lookbook.image --target lookbook:<storyboard-lookbook-id>
renku generation spec create --file storyboard-lookbook-image-spec.json
renku generation run --spec <media-generation-spec-id>
renku media import --purpose lookbook.image --target lookbook:<storyboard-lookbook-id> --source <project-relative-output-path> --sections lineAndFinish,valueAndAccent --title "Graphite line and accent sample"
renku lookbook image set-sections --image <lookbook-image-id> --sections panelAndNotation,continuityAndClarity
renku lookbook card-image set --lookbook <storyboard-lookbook-id> --image <lookbook-image-id>
```

The sample spec should use `focusSections` with the same type-specific section
names. Core validation should reject movie sections on Storyboard Lookbooks and
Storyboard sections on Movie Lookbooks.

## Architecture

### Core Ownership

All durable Lookbook type, section, selection, validation, and dependency rules
belong in `packages/core`.

Server routes, CLI commands, Studio React components, and agent skills must not
implement their own business rules for which Lookbook can be selected, which
sections are valid, or whether storyboard generation can proceed. They should
call focused core commands and render the resulting typed reports.

### Data Model

Replace the single movie-shaped `lookbook` row model with typed Lookbooks.

Proposed database shape:

- `lookbook.type`: `movie` or `storyboard`.
- `lookbook.definition_json`: a type-specific JSON object validated by core.
- Existing lifecycle columns stay package-owned by core: `id`, `name`,
  timestamps, discard metadata, and related image/sheet/card image records.
- Existing Lookbook image and sheet records remain attached to a `lookbook_id`.
  They do not need separate movie/storyboard tables. Their meaning comes from
  the owning Lookbook's `type`.
- Replace `visual_language_state.active_lookbook_id` with a type-keyed
  selection model, such as `lookbook_selection` with:
  - `lookbook_type`
  - `lookbook_id`
  - `selected_at`
  - `updated_at`

The Drizzle TypeScript schema remains the source of truth. The SQL migration
must be generated through Drizzle Kit following
`docs/architecture/drizzle-migrations.md`. The one-way migration may read old
columns only to transform existing development data into the new current shape.
Runtime code must not preserve old column names, aliases, or compatibility
branches.

### TypeScript Contracts

Core client contracts should use a discriminated union:

```ts
type Lookbook = MovieLookbook | StoryboardLookbook;

type MovieLookbook = {
  id: string;
  name: string;
  type: "movie";
  definition: MovieLookbookDefinition;
};

type StoryboardLookbook = {
  id: string;
  name: string;
  type: "storyboard";
  definition: StoryboardLookbookDefinition;
};
```

Reports should avoid the old `isActive` and `activeLookbookId` vocabulary.
Use type-specific selection language instead:

- `selectedLookbookIdsByType`
- `isSelectedForType`
- `selectedMovieLookbookId`
- `selectedStoryboardLookbookId`

The exact report names should be chosen once in core and then used directly by
CLI, server, and Studio UI. Do not add adapter-level mirrors to make old names
easier to consume.

Lookbook image and sheet reports should include the owning Lookbook id and type
when they are returned outside a full Lookbook resource. That lets CLI output,
agent workflows, and Studio UI distinguish Movie Lookbook images/sheets from
Storyboard Lookbook images/sheets without parsing names, prompts, or file paths.

### JSON Authoring Contracts

Lookbook authoring files should become type-specific. Suggested current
contracts:

```json
{
  "kind": "movieLookbook",
  "movieLookbook": {
    "name": "Bronze Siege",
    "thesis": "...",
    "palette": "...",
    "toneMood": "...",
    "composition": "...",
    "lighting": "...",
    "texture": "...",
    "camera": "..."
  },
  "sourceInspirationFolderIds": ["inspiration_folder_..."]
}
```

```json
{
  "kind": "storyboardLookbook",
  "storyboardLookbook": {
    "name": "Graphite Siege Boards",
    "styleBrief": "...",
    "lineAndFinish": "...",
    "valueAndAccent": "...",
    "panelAndNotation": "...",
    "continuityAndClarity": "...",
    "guardrails": "..."
  },
  "sourceInspirationFolderIds": ["inspiration_folder_..."],
  "sourceMovieLookbookIds": ["lookbook_..."]
}
```

`sourceMovieLookbookIds` is a provenance relationship, not an inheritance
mechanism. A storyboard Lookbook can be inspired by a movie Lookbook, but the
storyboard definition remains complete on its own.

### Core Commands

Replace active-selection commands with typed selection commands:

- `selectLookbookForType(project, { lookbookId, type })`
- `clearLookbookSelection(project, { type })`

Core validation must enforce:

- The selected Lookbook exists.
- The selected Lookbook type matches the requested selection type.
- Discarded Lookbooks cannot be selected.
- A discarded selected Lookbook clears only its matching type selection.
- Lookbook image section names are valid for the owning Lookbook type.
- Storyboard generation cannot create or update a spec without a selected
  `Storyboard` Lookbook and a resolvable selected/default Storyboard Lookbook
  sheet dependency.

Structured diagnostics should use stable codes, for example:

- `CORE_LOOKBOOK_TYPE_REQUIRED`
- `CORE_LOOKBOOK_TYPE_MISMATCH`
- `CORE_LOOKBOOK_SELECTION_REQUIRED`
- `CORE_STORYBOARD_LOOKBOOK_SELECTION_REQUIRED`
- `CORE_STORYBOARD_LOOKBOOK_SHEET_REQUIRED`
- `CORE_LOOKBOOK_SECTION_INVALID_FOR_TYPE`

Names can be adjusted during implementation only if the chosen names are still
domain-specific and stable.

### Generation Purpose Names And Type Dispatch

Keep `lookbook.image` and `lookbook.sheet` as shared generation purposes. Do
not add parallel purposes such as `storyboard-lookbook.image` or
`movie-lookbook.sheet` unless the asset kind itself becomes different.

The discriminator is the generation target:

```bash
renku generation context --purpose lookbook.image --target lookbook:<movie-lookbook-id>
renku generation context --purpose lookbook.image --target lookbook:<storyboard-lookbook-id>
renku generation context --purpose lookbook.sheet --target lookbook:<movie-lookbook-id>
renku generation context --purpose lookbook.sheet --target lookbook:<storyboard-lookbook-id>
```

Core resolves the target Lookbook, reads `lookbook.type`, and then selects the
type-specific schema, section registry, prompt construction, model availability,
and report labels. This keeps the CLI and generation architecture compact while
still making the generated outputs unambiguous.

Required dispatch behavior:

- `LookbookImageGenerationContext` and `LookbookSheetGenerationContext` include
  `lookbook.type`.
- `focusSections` for `lookbook.image` are validated against the target
  Lookbook type.
- Imported `lookbook.image` assets and generated `lookbook.sheet` assets are
  stored against the target `lookbook_id`; UI and CLI labels derive movie vs.
  storyboard meaning from the owning Lookbook type.
- CLI and JSON reports include enough owner information for agents to display
  `Movie Lookbook image`, `Storyboard Lookbook image`, `Movie Lookbook sheet`,
  or `Storyboard Lookbook sheet` without guessing from a filename or prompt.
- Core rejects attaching Storyboard section ids to Movie Lookbook images and
  rejects Movie section ids to Storyboard Lookbook images.

### Generation Dependencies

`scene.storyboard-sheet` must declare required dependencies through the shared
generation dependency system.

Dependency behavior:

- Read the selected `Storyboard` Lookbook from core.
- Declare a required `lookbook-sheet` dependency for that Storyboard Lookbook.
- Use explicit selector policy for the Storyboard Lookbook's selected/default
  sheet, following the dependency inventory cleanup architecture.
- If the Storyboard Lookbook has no sheet, dependency planning should produce a
  `lookbook.sheet` draft for that same Storyboard Lookbook.
- Shared generation spec create/update should block unresolved required
  dependencies with structured diagnostics.

The storyboard generation context should include:

- Scene and shot storyboard requirements.
- Selected `Storyboard` Lookbook definition.
- Selected/default Storyboard Lookbook sheet dependency metadata.
- Optional selected `Movie` Lookbook summary only as source visual-language
  context, not as the storyboard image style owner.

Provider preparation must actually feed the Storyboard Lookbook sheet into the
model request for routes that support image or reference inputs. Do not claim a
dependency is "fed into generation" if it is only checked and ignored.

If a current `scene.storyboard-sheet` model route cannot accept a style
reference image, the model registry for that purpose should expose only routes
that can use the selected sheet, or the team must explicitly design and test a
named text-only route. A silent text-only fallback is not acceptable.

### Dependency Flow Into Storyboard Generation

The selected Storyboard Lookbook feeds storyboard image generation through a
concrete dependency chain:

1. The user or agent selects a `Storyboard` Lookbook for storyboard images:
   `renku lookbook select --type storyboard --lookbook <storyboard-lookbook-id>`.
2. The user or agent generates or imports a `lookbook.sheet` for that same
   Storyboard Lookbook.
3. The sheet selection policy chooses the selected/default sheet for the
   Storyboard Lookbook. The dependency selector must be explicit and must not
   accidentally use the selected Movie Lookbook sheet.
4. `scene.storyboard-sheet` declares a required `lookbook-sheet` dependency
   whose subject is the selected Storyboard Lookbook id.
5. Shared dependency planning resolves the dependency to the selected/default
   Storyboard Lookbook sheet. If none exists, the plan returns a
   `lookbook.sheet` draft targeted at that Storyboard Lookbook.
6. Shared spec create/update blocks unresolved required dependencies before any
   paid storyboard generation can run.
7. Run preparation resolves the dependency line to the actual Storyboard
   Lookbook sheet asset path or provider-ready reference input.
8. Provider payload construction passes the Storyboard Lookbook sheet as an
   image/reference input for supported routes and includes the Storyboard
   Lookbook definition as prompt text.
9. The storyboard prompt uses scene/shot content for what to draw, and the
   selected Storyboard Lookbook definition plus sheet for how the boards should
   look.

This means the Storyboard Lookbook sheet is not just a prerequisite artifact in
the UI. It is the reference asset that anchors the actual storyboard generation
request. Tests must prove the prepared provider payload includes that sheet for
reference-capable routes.

### Lookbook Sheet Generation

`lookbook.sheet` should branch by Lookbook type.

For a `Movie` Lookbook, sheet generation should continue to produce a visual
language sheet useful for production, shot, cast, location, and final media
work.

For a `Storyboard` Lookbook, sheet generation should produce a storyboard style
reference sheet. It should include:

- A `styleBrief` hero sample showing the overall board style.
- `lineAndFinish` samples for medium, paper, line weight, and finish level.
- `valueAndAccent` samples for grayscale range, wash behavior, highlights, and
  accent color policy.
- `panelAndNotation` samples for frames, gutters, shot labels, captions,
  arrows, camera move symbols, and action lines.
- `continuityAndClarity` samples for character scale, screen direction,
  silhouette readability, spatial anchors, and prop continuity.
- A small "avoid" area showing forbidden artifacts only if the provider route
  can handle that instruction without copying the forbidden content.

The sheet should not look like a film mood board. It should be a practical
reference for drawing consistent storyboard panels.

`lookbook.image` should also branch by Lookbook type. For a Storyboard
Lookbook, `focusSections` should accept only Storyboard Lookbook section names,
and provider prompt construction should treat the generated output as a sample
storyboard frame or small sample board rather than a cinematic still or movie
mood image.

### CLI Surface

Replace `active` language in the CLI.

Proposed commands:

```bash
renku lookbook select --type movie --lookbook lookbook_...
renku lookbook select --type storyboard --lookbook lookbook_...
renku lookbook clear-selection --type movie
renku lookbook clear-selection --type storyboard
```

`renku lookbook list` and `renku lookbook show` should print type and selection
state with the new vocabulary. They should not emit `Active` labels.

`renku lookbook validate`, `renku lookbook create`, and
`renku lookbook update` should validate the type-specific authoring contracts.

The CLI should expose enough dependency planning for agents to discover missing
Storyboard Lookbook sheets before paid generation. If the current generic
dependency planner is not reachable from the CLI, add a thin CLI command that
calls the core planner instead of implementing purpose logic locally.

### Studio UI

Studio UI should consume typed core reports and send typed user intent to the
server. It must not infer business rules locally.

Required UI updates:

- Lookbook cards show `Movie` or `Storyboard` under the Lookbook name.
- Replace generic `Active` status with type-specific selection state.
- Replace `Set active`, `Clear active`, and related toasts with copy such as:
  - `Use for movie generation`
  - `Movie Lookbook selected`
  - `Clear movie selection`
  - `Use for storyboard images`
  - `Storyboard Lookbook selected`
  - `Clear storyboard selection`
- Sidebar Visual Language detail summarizes selected Lookbook types.
- Lookbook creation/editing UI supports creating a `Movie` or `Storyboard`
  Lookbook and shows only the sections for that type.
- Lookbook image section editing uses the section list for the owning Lookbook
  type.
- The Storyboard Lookbook `Definition` tab uses the same editorial rhythm as
  movie Lookbooks while rendering the six practical storyboard sections.
- The Storyboard Lookbook `Visual Content` tab groups sample storyboard images
  by Storyboard Lookbook section and makes the canonical Storyboard Lookbook
  sheet visible as the generation dependency source.
- Existing image attachment concepts should remain recognizable: generated or
  imported `lookbook.image` assets can be attached to one or more sections, and
  one image can be promoted as the Lookbook card image.

All feature code must use local shadcn-style components from
`packages/studio/src/ui` for controls.

### UI Component Reuse

The Studio UI should share the same Lookbook surfaces for Movie and Storyboard
Lookbooks wherever the interaction pattern is the same. The type split should
come from data, section descriptors, and concise type-specific copy, not from
duplicated component trees.

Required reuse direction:

- Use one Lookbook list/card component family for both types. Cards receive the
  Lookbook type, selected state, card image, and action labels from typed
  reports or a small presentation descriptor.
- Use one Definition rendering surface that accepts ordered section descriptors
  and section values. Movie and Storyboard Lookbooks differ by the descriptors
  they receive, not by separate duplicated markup.
- Use one Visual Content surface that accepts section groups, images, sheets,
  and card-image state. Storyboard Lookbooks can group images by Storyboard
  sections while Movie Lookbooks group by Movie sections through the same
  component contract.
- Use one section-image attachment control that receives the valid section
  options for the owning Lookbook type from core-owned metadata or typed
  resource reports.
- Use one selection control that can render `Use for movie generation` or
  `Use for storyboard images` from the Lookbook type and selection state.
- Keep type-specific generation prompts, validation schemas, and dependency
  declarations in core, not in React components.

Implementation should avoid creating pairs like
`MovieLookbookDefinitionPanel` and `StoryboardLookbookDefinitionPanel` if their
structure is the same. A small type-specific leaf component is acceptable only
when the visual structure genuinely differs. Thin pass-through wrappers whose
main purpose is to rename or locally repackage a shared component are not
acceptable.

### Studio Server

Routes should remain thin:

- Parse HTTP params and request body.
- Call typed core commands.
- Serialize typed core reports.
- Translate structured diagnostics.

Replace active-selection routes with typed selection routes, for example:

- `PUT /visual-language/lookbooks/selection/:type`
- `DELETE /visual-language/lookbooks/selection/:type`

The final route names can differ if the implemented route table has a clearer
local pattern, but the route should express type-specific selection directly.

### Director And Readiness

Director context should distinguish readiness for movie visual language and
storyboard graphic language.

Suggested fields:

- `selectedMovieLookbookId`
- `selectedStoryboardLookbookId`
- `movieLookbookReadyForGeneration`
- `storyboardLookbookReadyForGeneration`

Readiness messages should be specific:

- Missing movie visual language: create or select a `Movie` Lookbook.
- Missing storyboard graphic language: create or select a `Storyboard`
  Lookbook, then generate/select its Lookbook sheet.

Storyboard-generation next steps should no longer tell agents only to inspect
the current active Lookbook. They should point to the selected Storyboard
Lookbook and dependency planning.

### Agent Skills

Update the Studio skills in `/Users/keremk/Projects/aitinkerbox/studio-skills`
so agents know how to use the new architecture.

Required skill updates:

- `lookbook-designer`
  - Teach `Movie` vs `Storyboard` Lookbooks.
  - Add a Storyboard Lookbook authoring contract.
  - Add design guidance based on the practical Storyboard Lookbook sections in
    this plan.
  - Teach agents to keep each section prompt-actionable rather than theoretical.
  - Replace `renku lookbook set-active` guidance with typed selection commands.
- `media-producer`
  - Update `scene-storyboard-sheet` guidance to require a selected Storyboard
    Lookbook and a resolved Storyboard Lookbook sheet dependency.
  - Replace static storyboard style as the source of truth with Storyboard
    Lookbook guidance.
  - Add a Storyboard Lookbook sample-image workflow using `lookbook.image`,
    `renku media import --purpose lookbook.image`, section attachment, and
    card-image promotion.
  - Keep panel slicing and inspection rules.
  - Explain how to run dependency planning before creating/running paid specs.
- `scene-shot-designer`
  - Keep shot-list design tied to movie visual language where relevant.
  - Update storyboard media handoff language to say media production uses the
    selected Storyboard Lookbook.
- `movie-director`
  - Update workflow playbooks and readiness triage so missing Movie Lookbook
    and missing Storyboard Lookbook are different next steps.

Do not update only the skills. The skills must describe the same core and CLI
contracts that the product actually implements.

### Documentation

Update accepted docs when implementation is complete:

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/media-generation.md`
- CLI documentation for Lookbooks and generation dependency planning.
- Any Visual Language or Lookbook docs that still describe a single active
  Lookbook.

If this plan becomes accepted project direction, summarize the final decision
in `docs/` rather than leaving this active plan as the only source of truth.

## Implementation Slices

### Slice 1: Core Typed Lookbooks

- Add `LookbookType`.
- Add `MovieLookbookDefinition` and `StoryboardLookbookDefinition`.
- Replace movie-shaped Lookbook contracts with a discriminated union.
- Add type-specific validation and section registries.
- Replace active selection with type-specific selection commands.
- Update resource reports and trash behavior.
- Generate and apply the Drizzle migration through Drizzle Kit.

### Slice 2: CLI And Studio Selection Surface

- Replace CLI active commands with typed selection commands.
- Update list/show/create/update/validate output and parsing.
- Update Studio server routes to call typed core commands.
- Update Studio UI copy, controls, cards, panels, and sidebar selection summary.
- Update tests for the new language and behavior.

### Slice 3: Storyboard Lookbook Sheet And Dependencies

- Update `lookbook.image` context, validation, and prompt construction for
  Storyboard Lookbook sample images.
- Update `lookbook.sheet` context and provider prompts for type-specific sheets.
- Add `scene.storyboard-sheet` dependency declaration for the selected
  Storyboard Lookbook sheet.
- Update dependency planning so a missing Storyboard Lookbook sheet creates a
  `lookbook.sheet` draft for that Storyboard Lookbook.
- Update storyboard provider preparation to pass the sheet reference image into
  supported model requests.
- Restrict or explicitly name routes that cannot use reference images.

### Slice 4: Skills And Documentation

- Update `studio-skills` for Lookbook design, media production, scene shot
  design handoff, and movie director readiness.
- Update architecture and media-generation documentation.
- Add examples for Movie Lookbook and Storyboard Lookbook JSON.
- Add examples for Storyboard Lookbook sample image generation, import,
  section attachment, and card-image promotion.

## Risks And Review Questions

- The database model should avoid spreading JSON parsing throughout callers.
  Keep validation and typed conversion in core-owned access/resource layers.
- Provider support for reference images must be verified purpose by purpose.
  A declared dependency is not enough; the prepared generation request must use
  the sheet.
- Storyboard Lookbook sections should be specific enough to steer generation
  but not academic. A section is only worth keeping if a user or agent can point
  to it and say how it changes a generated storyboard image.
- The selection model should support one selected Lookbook per type. Do not use
  a generic global `activeLookbookId`.
- Skills and CLI should ship in the same implementation arc. Otherwise agents
  will continue to use obsolete active-lookbook workflows.

## Completion Checklist

### Review Area

- [x] Confirm the implemented plan keeps Lookbook type, section validation,
      selection, and generation dependency rules in `packages/core`.
- [x] Confirm Studio server routes are thin adapters over core commands.
- [x] Confirm CLI handlers are thin adapters over core commands and core
      validation.
- [x] Confirm React feature code renders typed reports and sends typed user
      intent without enforcing Lookbook business rules locally.
- [x] Confirm no compatibility aliases, active-lookbook shims, old route
      fallbacks, or duplicate DTO fields remain in runtime code.

### Core Contracts And Storage

- [x] Add `LookbookType` with current values `movie` and `storyboard`.
- [x] Add `MovieLookbookDefinition` with movie visual-language sections.
- [x] Add `StoryboardLookbookDefinition` with `styleBrief`, `lineAndFinish`,
      `valueAndAccent`, `panelAndNotation`, `continuityAndClarity`, and
      `guardrails`.
- [x] Replace the public `Lookbook` contract with a discriminated union.
- [x] Replace `LookbookListItem.isActive` with type-specific selection fields.
- [x] Replace `LookbookListReport.activeLookbookId` with type-keyed selected
      Lookbook ids.
- [x] Replace `LookbookShowReport.isActive` with type-specific selection state.
- [x] Add a core-owned registry of valid section names per Lookbook type.
- [x] Validate Lookbook authoring files through type-specific schemas.
- [x] Validate image section assignments against the owning Lookbook type.
- [x] Replace `visual_language_state.active_lookbook_id` with type-specific
      Lookbook selection storage.
- [x] Keep Lookbook images and sheets attached to `lookbook_id` and derive
      movie/storyboard meaning from the owning Lookbook type.
- [x] Do not add separate movie/storyboard image or sheet tables unless a later
      accepted design changes the asset model.
- [x] Generate the schema migration with Drizzle Kit.
- [x] Apply or test the generated migration through the documented Drizzle
      workflow.
- [x] Ensure one-way migration code transforms existing development movie
      Lookbooks into `type: "movie"` definitions.
- [x] Ensure runtime code does not recognize obsolete active-lookbook storage
      shapes.

### Core Commands And Resources

- [x] Add `selectLookbookForType`.
- [x] Add `clearLookbookSelection`.
- [x] Remove or replace `setActiveLookbook` and `clearActiveLookbook` callers.
- [x] Enforce selected Lookbook type matches the selection type.
- [x] Enforce discarded Lookbooks cannot be selected.
- [x] Update discard/trash logic so discarding a selected Lookbook clears only
      the matching type selection.
- [x] Update restore behavior to keep selection explicit rather than silently
      reselecting restored Lookbooks.
- [x] Add structured diagnostics for missing type, type mismatch, missing
      storyboard selection, missing storyboard sheet, and invalid section names.
- [x] Update Director visual-language readiness to report movie and storyboard
      readiness separately.
- [x] Update media generation context resources to expose selected Storyboard
      Lookbook data where storyboard generation needs it.

### Generation Architecture

- [x] Keep `lookbook.image` and `lookbook.sheet` as shared purposes whose
      behavior is dispatched from the target Lookbook type.
- [x] Do not add parallel generation purposes such as
      `storyboard-lookbook.image` or `movie-lookbook.sheet`.
- [x] Update `lookbook.sheet` context to include the Lookbook type and
      type-specific definition.
- [x] Update `lookbook.image` context to include type-specific section names
      and reject invalid focus sections for the owning Lookbook type.
- [x] Update movie Lookbook sheet prompt construction to use only Movie
      Lookbook sections.
- [x] Add Storyboard Lookbook image prompt construction for focused sample
      storyboard frames and small sample boards.
- [x] Add Storyboard Lookbook sheet prompt construction with style brief, line
      and finish, value/accent, panel/notation, continuity/clarity, and
      guardrail guidance.
- [x] Add `scene.storyboard-sheet` dependency declaration.
- [x] Declare the selected Storyboard Lookbook sheet as a required
      `lookbook-sheet` dependency.
- [x] Ensure the `lookbook-sheet` dependency subject is the selected Storyboard
      Lookbook id, not the selected Movie Lookbook id.
- [x] Ensure dependency selection cannot accidentally resolve a Movie Lookbook
      sheet for storyboard generation.
- [x] Ensure dependency planning creates a `lookbook.sheet` draft when the
      selected Storyboard Lookbook has no sheet.
- [x] Ensure spec create/update blocks unresolved required Storyboard Lookbook
      sheet dependencies.
- [x] Update storyboard generation context to read the selected Storyboard
      Lookbook from core.
- [x] Keep optional selected Movie Lookbook context separate from Storyboard
      Lookbook style ownership.
- [x] Update provider request preparation so supported storyboard routes receive
      the Storyboard Lookbook sheet as an image/reference input.
- [x] Update storyboard provider prompt construction so scene/shot content
      controls what to draw and the Storyboard Lookbook definition/sheet
      controls how it should look.
- [x] Restrict or explicitly define any storyboard model route that cannot use
      the reference sheet.
- [x] Add tests proving the dependency is not merely validated but included in
      the prepared provider payload for supported routes.

### CLI Surface

- [x] Replace `renku lookbook set-active` with
      `renku lookbook select --type <movie|storyboard> --lookbook <id>`.
- [x] Replace `renku lookbook clear-active` with
      `renku lookbook clear-selection --type <movie|storyboard>`.
- [x] Update `renku lookbook list` output to show type and typed selection
      state.
- [x] Update `renku lookbook show` output to show type-specific definition
      sections.
- [x] Update `renku lookbook validate` for `movieLookbook` and
      `storyboardLookbook` documents.
- [x] Update `renku lookbook create` and `renku lookbook update` to use
      type-specific documents.
- [x] Add or expose a generic generation dependency planning CLI path if agents
      cannot currently plan `scene.storyboard-sheet` dependencies.
- [x] Ensure CLI context and generation reports expose the target Lookbook type
      so agents can distinguish Movie Lookbook images/sheets from Storyboard
      Lookbook images/sheets without guessing from names.
- [x] Add CLI tests for typed selection success, type mismatch errors, missing
      storyboard selection errors, and Storyboard Lookbook validation.

### Studio Server And UI

- [x] Replace active-selection HTTP routes with typed selection routes.
- [x] Update `studio-visual-language-api` to call typed selection endpoints.
- [x] Update fake project data services and server route tests.
- [x] Update Lookbook cards to show `Movie` or `Storyboard` under the name.
- [x] Replace card `Active` copy with type-specific selected copy.
- [x] Replace `Set active` and `Clear active` actions with type-specific
      selection actions.
- [x] Update toast copy for movie and storyboard selection changes.
- [x] Update the Visual Language sidebar summary to report selected types.
- [x] Update Lookbook detail panel actions to use type-specific selection copy.
- [x] Keep Studio free of Lookbook create/edit authoring forms; Lookbooks are
      created and revised through the CLI and AI agent workflow only.
- [x] Update Lookbook image section editing to use the section names for the
      owning Lookbook type.
- [x] Update Storyboard Lookbook Definition tab rendering to use the same
      editorial design language as movie Lookbooks while showing the practical
      storyboard sections.
- [x] Update Storyboard Lookbook Visual Content tab rendering so sample images
      are grouped by `styleBrief`, `lineAndFinish`, `valueAndAccent`,
      `panelAndNotation`, `continuityAndClarity`, and `guardrails`.
- [x] Surface the canonical Storyboard Lookbook sheet in Visual Content as the
      reference dependency for storyboard generation.
- [x] Support attaching generated/imported `lookbook.image` assets to one or
      more Storyboard Lookbook sections.
- [x] Support promoting a Storyboard Lookbook sample image to the Lookbook card
      image.
- [x] Reuse one Lookbook card/list component family for Movie and Storyboard
      Lookbooks.
- [x] Reuse one Definition rendering surface driven by ordered section
      descriptors.
- [x] Reuse one Visual Content rendering surface driven by section groups,
      images, sheets, and card-image state.
- [x] Reuse one section-image attachment control driven by valid section
      options for the owning Lookbook type.
- [x] Reuse one type-aware selection control for movie and storyboard
      selection actions.
- [x] Confirm the implementation does not duplicate nearly identical movie and
      storyboard Lookbook component trees.
- [x] Confirm all new controls use local shadcn-style components from
      `packages/studio/src/ui`.
- [x] Verify Studio Lookbook list, detail panel, and selection controls through
      focused Studio tests without adding a browser-only authoring flow.

### Agent Skills

- [x] Update `lookbook-designer/SKILL.md` to describe Movie and Storyboard
      Lookbooks.
- [x] Add or update Lookbook authoring contract references for both types.
- [x] Add Storyboard Lookbook design guidance for `styleBrief`,
      `lineAndFinish`, `valueAndAccent`, `panelAndNotation`,
      `continuityAndClarity`, and `guardrails`.
- [x] Teach skills to reject overly theoretical Storyboard Lookbook prose that
      cannot be turned into image-generation instructions.
- [x] Replace `set-active` skill guidance with typed selection commands.
- [x] Update `media-producer/references/scene-storyboard-sheet.md` so the
      selected Storyboard Lookbook is the style source of truth.
- [x] Update media-producer guidance for generating `lookbook.image` sample
      storyboard frames, importing them, attaching them to sections, and
      promoting a card image.
- [x] Update media-producer dependency planning guidance for storyboard sheets.
- [x] Update scene-shot-designer storyboard media handoff guidance.
- [x] Update movie-director workflow playbooks and readiness triage.
- [x] Verify skill examples match the implemented CLI command names exactly.

### Tests And Verification

- [x] Run focused core tests for Lookbook validation, resources, commands,
      trash behavior, and dependency planning.
- [x] Run focused CLI tests for Lookbook commands and dependency planning.
- [x] Run focused Studio tests for Visual Language UI and server routes.
- [x] Run generation purpose tests for `lookbook.sheet` and
      `scene.storyboard-sheet`.
- [x] Run generation purpose tests for `lookbook.image` Storyboard Lookbook
      focus sections and provider prompt construction.
- [x] Run `pnpm build:core`.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm --filter @gorenku/studio test` or the current focused Studio
      test command.
- [x] Run root `pnpm check` before review if the implementation touches all
      packages.
- [x] Manually verify that a storyboard generation without a selected
      Storyboard Lookbook fails with a structured diagnostic.
- [x] Manually verify that a selected Storyboard Lookbook without a sheet plans
      a `lookbook.sheet` dependency.
- [x] Manually verify that an agent can generate, import, attach, and promote a
      Storyboard Lookbook sample image using CLI commands.
- [x] Manually verify that a generated storyboard provider request includes the
      selected Storyboard Lookbook sheet where the route supports references.

### Documentation And Acceptance

- [x] Update media-generation architecture docs with Storyboard Lookbook
      dependencies.
- [x] Update data-model docs with typed Lookbooks and typed selections.
- [x] Update CLI docs with typed Lookbook commands.
- [x] Add examples for `movieLookbook` and `storyboardLookbook` authoring
      files.
- [x] Add examples for Storyboard Lookbook `lookbook.image` sample generation
      and section attachment.
- [x] Add a decision note if typed Lookbooks become accepted project direction.
- [x] Ensure this active plan is either completed or superseded once the
      implementation lands.
