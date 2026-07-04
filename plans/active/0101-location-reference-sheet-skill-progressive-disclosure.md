# 0101 Location Reference Sheet Skill Progressive Disclosure

Status: implemented except independent forward-testing
Date: 2026-07-02

Implementation note, 2026-07-04: skill docs, sample spec, and static
validation are complete. Independent subagent forward-testing is still pending
because this Codex session did not have explicit user permission to spawn
subagents for delegation.

## Summary

Improve the Renku Studio skill documentation for generating Location Sheets so
agents create useful production reference boards instead of broad, pretty, but
under-informative collages.

The user-provided reference image sets a better quality bar. It is a clean
Location Reference Sheet for a neutral studio. It does not merely show one nice
room render. It gives a production team multiple ways to understand and reuse
the place:

- a large hero establishing view;
- eye-level, reverse, high-angle, low-angle, and corner perspectives;
- an empty staging view;
- material and texture swatches;
- lighting studies;
- a top-down layout map;
- color palette references;
- scale references;
- key landmarks;
- environmental props.

Not every Location needs every section. An exterior battlefield, a palace hall,
a street corner, a forest path, a vehicle interior, and a tiny neutral studio
all need different reference emphasis. The skill docs should teach agents how
to choose the sections that matter from the current Location Design, scene
usage, Movie Lookbook, references, and user request.

This plan is a skill-documentation improvement plan. It does not change the
Renku Core data model, generation purpose keys, Studio UI, CLI import
contracts, or the flexible full-image Location Sheet architecture accepted in
`0084-flexible-location-sheets.md`.

## References Reviewed

- User-provided Gumvue Studio Location Reference Sheet screenshot.
- `/Users/keremk/.codex/skills/.system/skill-creator/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-environment-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/workflow.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/location-environment-sheet-spec.json`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/production-designer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/production-designer/references/media-and-shot-list-handoff.md`
- `plans/active/0027-location-environment-sheet-media-generation.md`
- `plans/active/0028-location-environment-sheet-redesign.md`
- `plans/active/0034-location-environment-sheet-slicing-cleanup.md`
- `plans/active/0084-flexible-location-sheets.md`
- `plans/active/0097-seedance-prompt-sheet-skill-remediation.md`

## Current Problem

The current skill docs correctly say that Location Sheets are full-image
reference boards and must not be sliced into mandatory front/right/back/left
views.

That was the right architectural fix, but the current guidance is too open:

- `location-environment-sheet.md` says a sheet can contain maps, elevations,
  material samples, details, establishing context, or multiple views, but it
  does not teach the agent which sections to choose.
- The sample spec asks for broad concepts such as wall massing, gate damage,
  field approach, city-edge context, stone material, and scale, but it does not
  establish a repeatable board structure.
- The inspection gate only says to inspect the full image as one production
  reference board and confirm it matches the persisted description.
- `production-designer` handoff guidance names existing sheets and Location
  Design context, but it does not ask the designer to hand off the intended
  board sections or production questions the sheet must answer.

The expected failure mode is predictable:

- An agent prompts for "one polished Location Sheet."
- The model returns a nice collage or single cinematic image.
- The result looks plausible at a glance but does not answer practical shot
  planning questions.
- Later shot generation receives a full sheet image, but the sheet lacks
  usable spatial, scale, material, lighting, landmark, or prop continuity
  information.

The sample reference sheet is valuable because it is operational. It lets a
downstream user answer questions such as:

- What is the room's dominant camera-facing view?
- What does the room look like from the opposite side?
- Where are the windows, walls, stool, floor, and entrance?
- How does light behave at different setups?
- What materials and palette should be preserved?
- How large are the main props and openings relative to a person?
- Which visual landmarks must stay consistent across shots?

The skill docs should push agents toward that level of usefulness.

## Goals

- Make Location Sheet generation guidance concrete enough that agents produce
  useful production reference boards.
- Preserve the accepted flexible full-image Location Sheet model.
- Use progressive disclosure: keep `media-producer/SKILL.md` lean and put
  board-design detail in a one-level reference file.
- Teach adaptive section selection by location type, scene usage, and current
  production need.
- Give agents a reusable Location Sheet quality rubric.
- Add prompt-building guidance that converts Location Design context into
  board sections.
- Add an inspection gate that rejects weak boards before import.
- Update the sample spec so it demonstrates a useful board, not only a broad
  descriptive prompt.
- Update `production-designer` handoff guidance so Location Design work can
  pass clear sheet intent to `media-producer`.
- Keep generated Location Sheets as one imported full-image asset with a
  concise persisted description.

## Non-Goals

- Do not reintroduce mandatory front/right/back/left slicing.
- Do not create or import directional slice files.
- Do not change the `location.environment-sheet` purpose key.
- Do not change the `location.hero` purpose.
- Do not change Core validation, database schema, CLI import shape, or Studio
  UI in this slice.
- Do not create a generic media-purpose framework.
- Do not add compatibility aliases, shims, wrappers, or old format recognition.
- Do not make the Gumvue neutral-studio layout mandatory for every Location.
- Do not require generated image text labels to be perfect or critical for
  import. Labels can help when rendered cleanly, but the stored title and
  summary must carry the durable meaning.
- Do not run paid provider generation as part of validating this docs change.

## Architecture Boundary

This plan must respect the existing ownership boundaries:

- `packages/core` owns purpose contracts, context, validation, import behavior,
  and durable metadata.
- `packages/cli` stays a thin adapter over Core.
- `packages/studio` is not part of this docs-only slice.
- `production-designer` owns Location facts, Location Design, and handoff
  context.
- `media-producer` owns Location Sheet generation specs, prompt authoring,
  inspection, advisory regeneration decisions, and import.

The skill docs may guide agents to make better creative decisions. They must
not compensate for missing Core validation by inventing durable state rules in
the skill layer.

## Progressive Disclosure Direction

Follow the `skill-creator` progressive-disclosure model:

- Keep `media-producer/SKILL.md` as the small routing and workflow file.
- Keep `references/location-environment-sheet.md` as the operational reference
  for purpose keys, context commands, generation paths, import commands, hero
  workflow, and historical guardrails.
- Add one new one-level reference file:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-sheet-board-design.md
```

`location-environment-sheet.md` should link to this new file only for Location
Sheet prompt writing and QA:

```text
When writing or inspecting a `location.environment-sheet` prompt, read
`references/location-sheet-board-design.md` to choose adaptive board sections
and apply the Location Sheet quality rubric.
```

Do not move operational CLI examples into the board-design file. Do not put
the full board taxonomy in `SKILL.md`.

## Proposed Skill File Responsibilities

### `media-producer/SKILL.md`

Keep the Location Sheet section short:

- point to `references/location-environment-sheet.md`;
- state that Location Sheets are full-image reference boards;
- state that Location Sheet prompt and QA details live behind the Location
  Sheet reference;
- keep the no-slicing guardrail.

Do not paste the neutral-studio section list into `SKILL.md`.

### `references/location-environment-sheet.md`

Keep this file as the operational entrypoint:

- purpose keys;
- target format;
- context/model/spec/import workflow;
- Codex built-in image generation path;
- full-image import command;
- no directional slice files;
- Location Hero workflow;
- historical guardrails.

Add a prompt/QA subsection that tells agents to load
`references/location-sheet-board-design.md` when generating or reviewing a
Location Sheet.

### `references/location-sheet-board-design.md`

Add the detailed board design reference.

Suggested table of contents:

1. When to read this file
2. Location Sheet quality bar
3. Board section taxonomy
4. Adaptive section selection by location type
5. Prompt-building recipe
6. Layout and hierarchy guidance
7. Inspection and rejection checklist
8. Common weak outputs and fixes

Keep the file concise enough for agents to actually use. It can be longer than
`SKILL.md`, but it should be a practical checklist and pattern guide, not a
large visual-design essay.

### `samples/location-environment-sheet-spec.json`

Update the sample prompt to demonstrate a board structure. It should still be a
valid `location.environment-sheet` spec and should not contain obsolete fields.

The sample should ask for a Location Sheet that includes a selected subset of:

- primary establishing view;
- secondary perspective or reverse angle;
- high-angle or top-down spatial read;
- material/texture swatches;
- lighting studies;
- key landmarks;
- environmental props;
- scale references;
- color palette;
- concise no-modern/anachronism exclusions when context calls for them.

For the current sample, a Theodosian/sea-walls style sheet should adapt the
neutral-studio idea into historical exterior terms: siege-facing establishing
view, field-to-wall reverse, high-angle wall/field/city layout, gate and breach
landmarks, stone material swatches, scale references, smoke/weather lighting
studies, siege props, and period exclusions.

### `production-designer/references/media-and-shot-list-handoff.md`

Update the handoff guidance so `production-designer` summarizes the intended
sheet's production job before handing to `media-producer`.

The handoff should include:

- location type and whether it is interior, exterior, threshold, landscape,
  urban, vehicle-like, abstract, or mixed;
- story function and scene usage;
- production questions the sheet must answer;
- required or suggested board sections;
- state/time variants such as day, night, damaged, crowded, empty, before,
  after, seasonal, or weather-specific;
- key landmarks, entrances, windows, sightlines, props, and scale anchors;
- materials, palette, and lighting behavior;
- any historical, geographic, or genre guardrails.

The handoff should not contain generated media paths or durable asset ids in
Location Design JSON.

## Board Section Taxonomy

The new board-design reference should define a menu of possible sections.
Agents choose from this menu. They do not ask for every section by default.

### Core Spatial Sections

- **Hero establishing view**: the largest, clearest read of the place.
- **Eye-level perspective**: a human-height view useful for shot continuity.
- **Reverse angle**: the opposite side of the main axis, useful when scenes
  move through the space.
- **High-angle overview**: a spatial orientation view, useful for geography,
  blocking, or large spaces.
- **Low-angle view**: useful for scale, power, threat, monuments, walls,
  ceilings, and verticality.
- **Corner or diagonal perspective**: useful for interiors and rooms where two
  wall planes need to stay consistent.
- **Empty staging view**: a clean version without heavy action, useful when the
  place must host many shots.
- **Threshold view**: a doorway, gate, corridor, bridge, window, or transition
  point that matters to movement.

### Continuity And Detail Sections

- **Top-down layout map**: a simple spatial map, not a technical floor plan
  unless the context needs it.
- **Material and texture swatches**: wall, floor, stone, wood, glass, fabric,
  vegetation, dirt, metal, water, signage, or other dominant surfaces.
- **Color palette reference**: the location palette, separated from pure
  Lookbook style when possible.
- **Lighting studies**: time-of-day, weather, practical light, window light,
  firelight, smoke, fog, or shadow behavior.
- **Key landmarks**: entrances, gates, windows, statues, signs, ruins,
  machinery, altars, counters, towers, or distinctive silhouettes.
- **Environmental props**: objects that must remain consistent and help define
  use, class, period, occupation, or story function.
- **Scale references**: human silhouette, doorway height, stool/chair/vehicle,
  wall height, street width, room size, or distance markers.
- **Camera/lens notes**: optional, only when camera emulation or previs-style
  continuity matters. Do not invent technical camera metadata for every sheet.

## Adaptive Section Selection

The board-design reference should teach agents to select sections from the
location's actual need.

### Interior Rooms And Sets

Prefer:

- hero establishing view;
- eye-level and reverse views;
- corner/diagonal perspective;
- empty staging view;
- top-down layout map;
- material swatches;
- lighting studies;
- props, landmarks, and scale references.

Skip or downplay:

- distant aerial context unless the room connects to a larger geography;
- multiple exterior approaches unless windows, entrances, or exterior relation
  drive the scene.

### Exterior Architecture And Streets

Prefer:

- hero establishing view;
- approach view;
- reverse view from the important opposite side;
- high-angle or map-like spatial read;
- low-angle scale view when vertical mass matters;
- landmarks, entrances, signage, gates, towers, or thresholds;
- materials, weathering, ground surface, and lighting/weather studies;
- human or vehicle scale.

For historical exteriors, include period-specific exclusions instead of a
generic anachronism dump.

### Landscapes And Natural Locations

Prefer:

- wide establishing view;
- path or movement route;
- high-angle geography or terrain map;
- horizon/silhouette reference;
- ground texture, vegetation, water, rock, mud, snow, or weather swatches;
- scale anchors;
- light and atmospheric studies.

Skip:

- architectural floor-plan conventions unless there are built structures;
- prop panels unless story objects matter.

### Thresholds And Transitional Spaces

Prefer:

- both sides of the threshold;
- axis of movement;
- reverse angle;
- key doorway, gate, bridge, window, stair, tunnel, corridor, or boundary;
- scale and material changes across the boundary;
- lighting contrast across sides.

This applies to gates, alleys, stage doors, bridges, tunnels, windows, walls,
shorelines, and border crossings.

### Abstract, Empty, Or Minimal Locations

For sparse spaces such as the neutral studio example, usefulness comes from
subtle continuity:

- clean empty staging view;
- perspective variations;
- window/wall/floor relationships;
- material swatches;
- lighting studies;
- scale references;
- a simple layout map;
- the few environmental props that define the space.

Do not overfill a minimal place with invented furniture or decoration.

## Prompt-Building Recipe

The new reference should give agents a repeatable prompt-building sequence:

1. State the target as one finished full-image Location Sheet.
2. Name the location, story period, scene usage, and production job.
3. Define the largest hero section first.
4. Select 4 to 8 supporting sections from the taxonomy.
5. Explain why each supporting section matters for continuity.
6. Bind materials, palette, lighting, and atmosphere to the active Movie
   Lookbook and active Location Design.
7. Add historical, genre, or story guardrails only when they are grounded in
   context.
8. Keep labels in margins or captions if labels are requested; never place text
   over important visual content.
9. Ask for a clean, readable board with clear hierarchy, not a chaotic collage.
10. Persist a concise `description` that names the board's real production
   purpose.

Example prompt skeleton:

```text
Create one polished 4:3 Location Sheet for <location>. The sheet is a
production reference board for <scene usage / production job>, not a poster.

Make the largest panel a <hero establishing view>. Add supporting panels for
<selected sections>. Keep all panels consistent with the same place, period,
materials, palette, lighting behavior, landmarks, and scale anchors.

Use the selected Movie Lookbook for palette, texture, lens feel, lighting, and
atmosphere. Preserve these concrete Location Design facts: <facts>.

Exclude <grounded exclusions>. Keep any labels small and outside important
image content. Do not include debug marks, crop guides, UI, fake software
panels, or decorative poster typography.
```

The implementation should adapt this skeleton. It should not force agents to
paste it unchanged into every spec.

## Inspection Gate

Before import, `media-producer` should inspect the generated full image and
answer these questions:

- Does the sheet clearly represent the target Location?
- Does the hero section provide a strong readable overview?
- Do the supporting sections answer the intended production questions?
- Are multiple views consistent with the same geography?
- Are materials, palette, and lighting grounded in the active Location Design
  and Movie Lookbook?
- Are scale, landmarks, entrances, props, and movement paths readable when they
  matter?
- Is the sheet useful as one full image without slicing?
- Are labels, if present, outside key visual content and non-critical?
- Are anachronisms, modern artifacts, or genre-breaking details absent?
- Is the result more useful than a single pretty image?

Reject or ask for revision when:

- the sheet is mostly a poster, mood board, or generic collage;
- the panels depict different unrelated places;
- the generated text labels dominate or corrupt important imagery;
- the layout is too dense to inspect;
- the board omits the Location's key spatial or continuity facts;
- the sheet contradicts user corrections or Location Design constraints;
- historical or genre guardrails are visibly violated;
- the image works only as a hero image, not as a Location Sheet.

For paid Renku-managed generation, the agent should explain the concrete issue
and ask whether the user wants to import with caveats, revise the spec, or pay
for regeneration. For Codex built-in image generation, the agent can iterate
through the built-in image workflow, but still must not import weak media
automatically.

## Implementation Plan

### 1. Update Media-Producer Routing

Edit:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md
```

Keep the existing Location Sheet section, but make it clear that detailed
Location Sheet prompt and QA guidance lives in the purpose reference.

Do not expand the top-level skill body with the full board taxonomy.

### 2. Update Operational Location Sheet Reference

Edit:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-environment-sheet.md
```

Add a short "Board Design Guidance" section that links to:

```text
references/location-sheet-board-design.md
```

Keep this file focused on workflow, commands, import, hero images, and
historical guardrails.

### 3. Add Board-Design Reference

Create:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/location-sheet-board-design.md
```

Include:

- when to read;
- quality bar based on production usefulness;
- board section taxonomy;
- adaptive section selection;
- prompt-building recipe;
- inspection gate;
- common weak outputs and fixes.

Use the neutral-studio sample as a quality benchmark without making its exact
sections mandatory.

### 4. Update Location Sheet Sample Spec

Edit:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/location-environment-sheet-spec.json
```

Revise the prompt so it demonstrates selected board sections and a production
purpose.

Keep the current valid contract:

- `purpose`;
- `target`;
- `modelChoice`;
- `prompt`;
- `description`;
- `takeCount`;
- `seed`;
- `sheetFrame`;
- `detail`;
- `outputFormat`;
- `title`.

Do not add obsolete `viewFrame`, `layoutTemplate`, directional slice roles, or
compatibility fields.

### 5. Update Production-Designer Handoff

Edit:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/production-designer/references/media-and-shot-list-handoff.md
```

Add a concise handoff checklist for intended Location Sheet sections and
production questions.

Do not make `production-designer` responsible for generation specs, paid runs,
or imports.

### 6. Audit Duplicated Guidance

Search the skills repository for duplicated Location Sheet guidance:

```bash
rg -n "Location Sheet|location.environment-sheet|environment sheet|view_front|view_right|view_back|view_left|azimuth|slice|crop" /Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Update only current guidance that would conflict with this plan. Preserve
storyboard sheet slicing guidance where it applies specifically to
`scene.storyboard-sheet`.

### 7. Validate Skill Structure

Run the generic skill validator for changed skill folders:

```bash
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer
python /Users/keremk/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/keremk/Projects/aitinkerbox/studio-skills/skills/production-designer
```

Then run static link and reference checks:

```bash
rg -n "location-sheet-board-design.md|location-environment-sheet.md|media-and-shot-list-handoff.md" /Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

### 8. Forward-Test Without Paid Generation

Forward-test the revised skill guidance on at least two dry tasks:

- a minimal interior or studio-like Location similar to the user-provided
  reference sheet;
- a historical exterior Location from `urban-basilica`, such as a wall, gate,
  camp, church, street, or harbor location.

The forward test should ask an independent agent to prepare a
`location.environment-sheet` spec only. It must not run paid generation.

Good prompt shape:

```text
Use the Renku media-producer skill at
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer to
prepare a Location Sheet generation spec for this Location. Do not run paid
generation. Focus on making the sheet useful for shot planning.
```

Pass raw Location context and user intent, not this plan's expected answer.

## Validation Plan

### Static Validation

- Confirm every new reference file is one level under `references/`.
- Confirm `media-producer/SKILL.md` stays concise.
- Confirm `location-environment-sheet.md` links to the board-design reference
  only for prompt writing and QA.
- Confirm the new board-design file has a table of contents.
- Confirm the sample spec remains valid JSON.
- Confirm no obsolete Location Sheet fields are added.
- Confirm no guidance says to slice Location Sheets.
- Confirm no guidance asks for mandatory front/right/back/left sections.
- Confirm storyboard-specific slicing guidance remains scoped to storyboard
  sheets.

### Dry Spec Review

For a generated dry-run Location Sheet spec, verify:

- the prompt names one full-image Location Sheet;
- the prompt identifies the production job;
- the prompt has a hero view and selected supporting board sections;
- the selected sections match the Location type;
- the prompt includes grounded materials, palette, lighting, landmarks, scale,
  and guardrails;
- the prompt avoids irrelevant sections;
- the `description` explains the board's useful purpose;
- the spec does not contain obsolete fields.

### Human Review

Ask whether the updated docs would have led an agent toward a sheet like the
sample reference: useful views, material/detail studies, spatial layout,
lighting, scale, landmarks, and props, adapted to the target Location.

## Acceptance Criteria

- The media-producer skill uses progressive disclosure for Location Sheet
  board design.
- A new board-design reference exists and is linked from the operational
  Location Sheet reference.
- Agents have clear guidance for choosing useful board sections by Location
  type.
- The neutral-studio sample is captured as a quality bar without becoming a
  mandatory layout.
- The Location Sheet sample spec demonstrates a structured board prompt.
- Production-designer handoff guidance carries sheet intent and production
  questions to media-producer.
- The inspection gate would reject a pretty but under-informative collage.
- The guidance preserves full-image Location Sheets and does not reintroduce
  slicing.
- The revised docs pass skill validation and static reference checks.
- At least two no-cost forward tests produce useful draft specs.

## Open Questions

- Should the new board-design reference include one compact visual-section
  matrix as Markdown tables, or stay as short bullets for lower token load?
- Should the sample spec stay focused on the historical sea-walls example, or
  should a second minimal interior sample be added later?
- Should `production-designer` ask the user to choose a sheet type before
  handoff, or should it infer a recommended sheet type and let
  `media-producer` ask only when the decision materially changes generation?
- Should future Core context expose a structured `recommendedBoardSections`
  hint, or should this remain agent-only guidance until repeated failures prove
  the need for product-owned fields?

## Completion Checklist

Use this checklist for implementation review and final signoff.

### Review Area

- [x] Confirm the change is limited to skill docs and samples.
- [x] Confirm no `packages/core`, `packages/cli`, or `packages/studio` code
      changes are introduced by this slice.
- [x] Confirm no compatibility aliases, shims, wrappers, fallback readers, or
      obsolete field recognition are added.
- [x] Confirm current docs continue to describe only the flexible full-image
      Location Sheet model.
- [x] Confirm generated Location Sheets remain one imported full-image asset.

### Progressive Disclosure

- [x] Keep `media-producer/SKILL.md` concise.
- [x] Keep operational command details in
      `references/location-environment-sheet.md`.
- [x] Add
      `references/location-sheet-board-design.md` as a one-level reference.
- [x] Link the new reference from `location-environment-sheet.md` with clear
      routing conditions.
- [x] Do not add deeply nested references.
- [x] Do not duplicate the full taxonomy in `SKILL.md`.
- [x] Include a table of contents in the new reference.

### Board Design Guidance

- [x] Define the Location Sheet quality bar.
- [x] Include the user-provided neutral-studio sheet as an example quality
      benchmark.
- [x] Explain that the benchmark is not a mandatory universal layout.
- [x] Define the board section taxonomy.
- [x] Include hero establishing view guidance.
- [x] Include perspective/reverse/high/low/corner view guidance.
- [x] Include empty staging view guidance.
- [x] Include top-down layout/map guidance.
- [x] Include material and texture swatch guidance.
- [x] Include color palette guidance.
- [x] Include lighting study guidance.
- [x] Include key landmark guidance.
- [x] Include environmental prop guidance.
- [x] Include scale reference guidance.
- [x] Include optional camera/lens note guidance only when relevant.

### Adaptive Selection

- [x] Add guidance for interior rooms and sets.
- [x] Add guidance for exterior architecture and streets.
- [x] Add guidance for landscapes and natural locations.
- [x] Add guidance for thresholds and transitional spaces.
- [x] Add guidance for abstract, empty, or minimal locations.
- [x] Add guidance for historical or genre-specific guardrails.
- [x] Explain when to skip irrelevant board sections.
- [x] Explain when to ask the user for missing creative intent.
- [x] Explain how state variants such as day/night, damaged/intact, empty/crowded,
      or before/after should affect sheet planning.

### Prompt Authoring

- [x] Add a prompt-building recipe.
- [x] Require the prompt to state the production job of the sheet.
- [x] Require a chosen hero section.
- [x] Require selected supporting sections grounded in the Location Design.
- [x] Require material, palette, lighting, landmark, prop, and scale guidance
      when relevant.
- [x] Require grounded exclusions instead of generic negative lists.
- [x] Warn against chaotic collage prompts.
- [x] Warn against relying on generated labels as the only source of meaning.
- [x] Keep labels out of important visual content when labels are requested.
- [x] Require a concise persisted `description` that names the sheet's actual
      use.

### Inspection Gate

- [x] Add a Location Sheet QA checklist.
- [x] Require inspection before import.
- [x] Reject sheets that are only posters, hero images, or generic mood boards.
- [x] Reject sheets where panels depict unrelated places.
- [x] Reject sheets that omit key spatial or continuity facts.
- [x] Reject sheets where labels corrupt important image content.
- [x] Reject sheets with visible anachronisms or genre-breaking details.
- [x] Explain paid-generation regeneration decisions clearly.
- [x] Explain Codex built-in image iteration behavior without bypassing import.

### Production-Designer Handoff

- [x] Update `production-designer/references/media-and-shot-list-handoff.md`.
- [x] Ask for location type in the handoff.
- [x] Ask for production questions the sheet must answer.
- [x] Ask for required or suggested board sections.
- [x] Ask for state/time variants when relevant.
- [x] Ask for landmarks, entrances, sightlines, props, scale, materials,
      palette, lighting, and guardrails.
- [x] Keep generated media paths and durable media ids out of Location Design
      JSON.
- [x] Keep generation specs, estimates, runs, and imports owned by
      `media-producer`.

### Sample Spec

- [x] Update `samples/location-environment-sheet-spec.json`.
- [x] Keep the sample valid JSON.
- [x] Keep the sample on the current `location.environment-sheet` contract.
- [x] Add board-section structure to the sample prompt.
- [x] Keep the sample description concise and user-facing.
- [x] Do not add `viewFrame`, `layoutTemplate`, `view_front`, `view_right`,
      `view_back`, `view_left`, `azimuth`, or old grouped-import fields.

### Static Validation

- [x] Run `quick_validate.py` for `media-producer`.
- [x] Run `quick_validate.py` for `production-designer`.
- [x] Run a targeted `rg` check for new reference links.
- [x] Run a targeted `rg` check for obsolete slicing guidance.
- [x] Review any remaining `slice` or `crop` matches to confirm they belong to
      storyboard sheets or other valid workflows.
- [x] Confirm no `.env` or denied files are touched.

### Forward Testing

- [ ] Prepare a dry no-cost Location Sheet spec for a minimal interior/studio
      Location.
- [ ] Prepare a dry no-cost Location Sheet spec for a historical exterior
      `urban-basilica` Location.
- [ ] Confirm both dry specs choose different board sections appropriate to the
      Location type.
- [ ] Confirm both dry specs have useful persisted descriptions.
- [ ] Confirm neither dry spec asks for directional slice files.
- [ ] Confirm neither dry spec requires paid generation.

### Documentation Signoff

- [x] Confirm the plan's accepted direction is reflected in the skill docs.
- [x] Confirm no active plan or docs update describes a coexistence period or
      compatibility path.
- [x] Confirm the implementation summary names every changed skill file.
- [x] Confirm remaining open questions are either answered or carried forward
      intentionally.
