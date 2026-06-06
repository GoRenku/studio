# 0049 Multi-Shot Storyboard Sheet Agent Context

Status: implemented
Date: 2026-06-06

## Summary

Renku Studio already stores enough shot-level design data for an agent to create
a useful multi-shot storyboard/reference sheet: each selected shot can carry
description, action, framing, shot type, camera angle, movement, lens intent,
cast, location, audio notes, production notes, and structured `shotSpecs` from
the Composition, Motion, Cast, Location, References, and AI Production surfaces.

The current skill instructions are too thin to reliably produce the kind of
shot-planning sheets we want. A strong sheet should show one panel per selected
shot, in order, with readable shot metadata and model-facing annotations such as
shot size, angle, movement, action, lens/focus, continuity, audio, and notes. The
existing `media-producer` skill says to create a readable sheet, but its sample
prompt is generic and does not teach the agent how to turn selected shot design
data into a structured sheet.

This plan updates the CLI documentation, core generation-spec authoring
requirements, and the external Studio skills in:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

The existing purpose `shot.multi-shot-storyboard-sheet` remains the concrete
generation purpose for one storyboard/reference sheet covering an ordered
contiguous shot group. This plan also removes the vague
`shot.reference-sheet` purpose and replaces it with a deliberate
`shot.reference-image` purpose for user- or agent-authored ad hoc reference
images, plus import/selection behavior for reference images created outside
Renku.

## Goals

- Make `shot.multi-shot-storyboard-sheet` generation reliably use the selected
  per-shot Composition, Motion, Cast, Location, References, and AI Production
  data.
- Make `shot.first-frame` and `shot.last-frame` generation require careful
  authored prompts derived from the selected shot design, existing references,
  continuity context, and final-video intent.
- Give agents a concrete sheet recipe that can produce panel sheets similar in
  structure to the provided examples:
  - one panel per shot;
  - shot number and image area;
  - shot type, camera angle, movement, rig, lens, and focus when available;
  - action and narrative beat;
  - dialogue or VO notes when available;
  - audio, SFX, music, ambience, and transition notes when available;
  - compact model-facing notes and camera arrows when useful.
- Preserve `shot.multi-shot-storyboard-sheet` as the ordered multi-shot group
  sheet purpose.
- Remove `shot.reference-sheet` as a concrete generation purpose because it is
  not a specific enough product format.
- Support multiple ad hoc `reference-image` shot dependencies that can be
  generated and/or attached only when the user/agent explicitly authors what
  each reference image is for.
- Make the Studio shot References tab show generated/imported dependency images
  as they become available, including first frames, last frames, and multiple
  ad hoc reference images.
- Make generated/imported `shot.multi-shot-storyboard-sheet` images appear in
  the shot References tab for every shot included in that ordered production
  group.
- Update stale skill examples from `intentId` to the current `inputModeId`
  contract.
- Document the current agent-critical CLI commands for shot video dependencies:
  - `renku generation production update`;
  - `renku generation preflight`;
  - `renku generation input list`;
  - `renku generation input select`;
  - `renku generation input clear`.

## Non-Goals

- Do not introduce a new `shot.storyboard-sheet` purpose.
- Do not keep `shot.reference-sheet` as a vague catch-all reference format.
- Do not let ad hoc reference image generation become "generate any reference
  that might help." Each reference image must have an authored purpose, prompt,
  target shot/group, and import/selection step.
- Do not change the project database schema unless implementation discovers a
  hard missing field that cannot be represented in current shot data.
- Do not store generated image paths, crop boxes, layout cells, or sheet
  extraction metadata in Scene Shot List JSON.
- Do not make `reference-image` attachment a substitute for concrete references
  such as cast character sheets, location environment sheets, lookbook sheets,
  first frames, last frames, or multi-shot storyboard sheets.
- Do not add compatibility aliases for `intentId`, `basedOnIntentId`, or any
  old contract names.
- Do not add wrapper modules, re-export facades, or compatibility loaders.
- Do not synthesize generic generation prompts when an agent has not authored a
  proper generation spec or dependency draft.
- Do not treat "generate something" as a valid generation goal. Missing prompt
  authorship is an error or blocking preflight condition, not an invitation to
  invent a request.
- Do not run paid generation as part of implementation or tests.

## Current State

### Existing Purpose And Context

Before implementation, the media generation purpose list included:

```text
shot.first-frame
shot.last-frame
shot.reference-sheet
shot.multi-shot-storyboard-sheet
shot.video-take
```

The previous `shot.reference-sheet` purpose is the part this plan deliberately
changes. It is too vague as a product contract. The useful concept is the input
kind `reference-image`, which already exists as a shot-video dependency kind of
thing an agent can select/import. This plan turns that into a clear
`shot.reference-image` generation/import workflow instead of preserving a
single-shot sheet purpose.

The core `ShotVideoTakeGenerationContext` returned by:

```bash
renku generation context \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --json
```

includes `shots: SceneShot[]`, `referencedCast`, `referencedLocations`,
`activeLookbook`, `availableInputs`, `existingTakes`, defaults, and the resolved
production group.

The current `SceneShot` prompt-facing fields include:

```ts
shotId
title
storyBeat
narrativePurpose
description
shotType
cameraAngle
cameraMovement
framing
lensIntent
subject
action
dialogue
audioNotes
productionNotes
shotSpecs
```

The structured `shotSpecs` can preserve richer selections such as shot size,
subject framing, camera angle, dutch angle, movement, movement directions, track
shape, rig, lens type, millimeters, focus, location view, cast references,
lookbook sheet references, custom reference images, custom composition, and
custom movement notes.

First-frame and last-frame generation currently has even less skill detail than
multi-shot storyboard sheets. The skill describes when to create these
dependencies, but it does not require the generated stills to be authored from
existing references, selected composition, selected motion, continuity, lens,
location view, lookbook, or final-video intent. Its sample prompts are generic:

```text
Create the first frame for Shot 3.
Create the last frame for Shot 3.
```

That is not enough for paid generation.

### Existing Skill Guidance

The current `media-producer` reference says:

```text
Create shot.multi-shot-storyboard-sheet. Prompt for one readable sheet with one
panel per shot, shot labels, action beats, composition notes, camera movement
notes, cast continuity, location/view notes, and compact model-facing
instructions.
```

That direction is useful but underspecified. The sample prompt is:

```json
"prompt": "Create one readable two-panel storyboard sheet for Shot 3 and Shot 4."
```

This is too weak for production-style shot-planning sheets.

### Existing Core Auto-Draft Prompt

When a dependency draft is missing, core currently auto-drafts a minimal prompt
through `dependencyPrompt(...)`. For multi-shot storyboard sheets, that prompt
only contains:

- scene title;
- shot ids and actions;
- input mode;
- shot group mode;
- a generic line asking for the required image.

This behavior is not acceptable for expensive generation. It can make a missing
agent-authored prompt look like a usable generation request. The correct behavior
is to fail the authoring/preflight path clearly: the system should report that a
proper dependency draft or generation spec has not been authored.

## Proposed Changes

### 1. Clarify Product Meaning

Keep the purpose meanings explicit:

| Purpose | Meaning |
| --- | --- |
| `shot.first-frame` | A carefully authored still image for the opening frame of a single-shot video take or first/last-frame workflow. |
| `shot.last-frame` | A carefully authored still image for the closing frame of a first/last-frame workflow. |
| `shot.reference-image` | A user/agent-authored ad hoc shot reference image, generated or imported only when a specific reference need has been named. |
| `shot.multi-shot-storyboard-sheet` | One ordered shot-group sheet with one panel per selected shot, used as a reusable dependency for a final multi-shot video take. |

Remove `shot.reference-sheet` from the active purpose list and update the skill
reference and CLI docs so agents use explicit ad hoc `reference-image` inputs
instead of a vague reference sheet.

`shot.reference-image` should map to:

- generation purpose: `shot.reference-image`;
- dependency/input kind: `reference-image`;
- subject kind: `shot`, `production-group`, or `asset` depending on the
  authored reference need;
- import selection: selectable as a prepared `reference-image` dependency for
  the current shot/group.

### 2. Update The Media Producer Skill

Update:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/shot-multi-shot-storyboard-sheet-spec.json
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/shot-video-take-production-group.json
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/shot-video-take-final-spec.json
```

The skill should instruct agents to build a multi-shot storyboard sheet prompt
from the returned `context.shots`, using these fields in priority order:

1. `shotSpecs` derived values when present;
2. prompt-facing fields already persisted on the shot:
   - `shotType`;
   - `cameraAngle`;
   - `cameraMovement`;
   - `framing`;
   - `lensIntent`;
3. shot story fields:
   - `storyBeat`;
   - `narrativePurpose`;
   - `description`;
   - `subject`;
   - `action`;
4. continuity fields:
   - `castMemberIds`;
   - `locationIds`;
   - `referencedCast`;
   - `referencedLocations`;
   - `activeLookbook`;
5. optional notes:
   - `audioNotes`;
   - `productionNotes`;
   - dialogue references, plus screenplay scene context when exact dialogue text
     is needed.

The skill should define a reusable prompt structure:

```text
Create a single storyboard planning sheet for this ordered shot group.

Layout:
- one panel per shot in exact order;
- each panel has a numbered image frame;
- each panel has compact readable metadata below or beside the image;
- include camera arrows or motion marks when movement is specified;
- keep text concise and legible.

Panel metadata:
- Shot / angle
- Camera / movement
- Lens / focus
- Action / description
- Dialogue / VO, if known
- Audio / SFX / music, if known
- Transition, only if provided
- Model-facing note
```

The skill should also tell agents not to invent transitions, exact durations,
or dialogue text when those are absent. If exact dialogue is important, the
agent should read the screenplay scene or shot-list context before drafting the
sheet prompt.

The skill should also add strict first-frame and last-frame authoring rules:

- Read `generation context` for the selected shot/group before drafting.
- Use selected Composition and Motion values as binding creative context.
- Use selected Cast, Location, Lookbook, and custom reference images as
  continuity context.
- If a required character sheet, location sheet, lookbook sheet, or custom
  reference image is missing, preflight should report the missing dependency
  instead of generating a loosely described first/last frame.
- A first frame prompt must specify the exact opening composition, subject,
  action state, camera height/angle, movement implication, lens/focus, visual
  continuity, and what the video model should begin from.
- A last frame prompt must specify the exact ending composition, subject/action
  state, camera result, continuity from the first frame, and what visual change
  must be achieved by the end of the take.
- Do not create first/last frame specs from generic prompts such as "Create the
  first frame for Shot 3."
- Do not use first/last frame generation as exploratory image generation. If the
  user wants exploration, create explicit ad hoc reference images first, then
  select the approved one as a dependency.

### 3. Add A Dedicated Skill Reference For Sheet Prompting

Add new external skill references:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-multi-shot-storyboard-sheet.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-first-last-frame.md
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-reference-images.md
```

The multi-shot storyboard sheet reference should include:

- purpose summary;
- required CLI context commands;
- per-shot data extraction checklist;
- recommended prompt template;
- guidance for sheet layouts like:
  - production grid;
  - clean storyboard strip;
  - annotated hand-drawn planning sheet;
- quality checks before import;
- common failure modes and corrections.

Common failure modes:

- the sheet ignores selected camera movement;
- panel order differs from `target.shotIds`;
- labels are too small to read;
- the sheet becomes a moodboard instead of one panel per shot;
- the model invents extra shots;
- exact dialogue, duration, music, or transition is invented despite missing
  source data;
- character or location continuity conflicts with `referencedCast` or
  `referencedLocations`.

The first/last-frame reference should include:

- when to use `shot.first-frame`;
- when to use `shot.last-frame`;
- how to author from `context.shots[0]`;
- how to use selected `shotSpecs`;
- how to use existing first frame, last frame, cast, location, lookbook, and
  custom reference-image inputs;
- how to preserve continuity between first and last frame;
- quality checks before import;
- explicit examples of acceptable and unacceptable prompts.

The ad hoc reference-image reference should include:

- how the user or agent names the reference need during the Codex/Claude flow;
- how multiple reference images can be generated or attached to the same shot or
  production group;
- how those images become `reference-image` inputs, not `shot-reference-sheet`
  inputs;
- how to select/import approved reference images;
- how to avoid replacing concrete dependencies with vague references.
- the required spec fields for `shot.reference-image`, including an authored
  `prompt`, `title`, and clear one-line reference intent.

### 4. Fix Stale Skill Contract Names

Update external skill samples and prose to use the current contract:

| Old | Current |
| --- | --- |
| `intentId` | `inputModeId` |
| `basedOnIntentId` | `basedOnInputModeId` |
| `--intent <intent-id>` prose when describing the stored plan field | `inputModeId` in JSON, while the CLI flag remains `--intent` |

Important distinction:

- The CLI flag remains `--intent` for model listing.
- Persisted production JSON and final specs use `inputModeId`.

### 5. Improve CLI Documentation

Update:

```text
docs/cli/commands.md
docs/architecture/reference/media-generation.md
```

Document the currently implemented shot-video agent workflow:

```bash
renku generation context \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --json

renku generation model list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --intent <input-mode-id> \
  --json

renku generation input list \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --json

renku generation production update \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --file <shot-video-production-json> \
  --json

renku generation preflight \
  --purpose shot.video-take \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --shots <shot-id[,shot-id...]> \
  --file <shot-video-production-json> \
  --json
```

Explain that `preflight.inputsToCreate`, `preflight.inputPlanItems`,
`preflight.plan.dependencyMap`, and `preflight.finalTake.canCreateSpec` are the
authoritative dependency checklist before final video generation.

Also document the purpose change:

- remove `shot.reference-sheet` from the active purpose list;
- add `shot.reference-image` as the generated ad hoc reference-image purpose;
- keep `reference-image` as an attachable/selectable shot-video input kind even
  when the file was generated outside Renku and imported later.

### 6. Enforce Authored Generation Specs

Update core so missing prompt/spec authorship is visible and blocking instead of
quietly replaced with generic prompt text.

Required behavior:

- For shot-video dependency purposes, core should only include a
  `draftGenerationSpec` when the production group has an explicit
  `agentProposal.dependencyDrafts[]` entry for that purpose and output input
  kind.
- If a required dependency is generatable but no explicit dependency draft
  exists, preflight should report a structured issue such as:
  `CORE_SHOT_VIDEO_DEPENDENCY_DRAFT_MISSING`.
- The issue should explain which dependency lacks an authored prompt, for
  example `shot.multi-shot-storyboard-sheet` for the selected production group.
- The dependency map may still show the missing/planned dependency, but it must
  not include a usable prompt or draft spec assembled from generic text.
- `preflight.finalTake.canCreateSpec` should remain `false` until required
  dependency media is selected/imported and the final spec can be authored from
  real prepared inputs.
- Final `shot.video-take` specs must continue to require explicit prompt,
  model, parameter values, and prepared inputs.
- `shot.first-frame` and `shot.last-frame` must require authored prompts and
  must not be auto-drafted from generic shot labels.
- The vague `shot.reference-sheet` purpose should be removed from purpose
  registries, CLI handlers, import handlers, schemas, docs, skills, and samples.
- Ad hoc reference images should be represented as explicit `reference-image`
  inputs.
- Add `shot.reference-image` as the explicit generated ad hoc reference-image
  purpose, with validation requiring authored prompt text and reference intent
  before estimate/run.

Context formatting can exist as a helper for diagnostics or agent-readable
briefs, but it must not be used to produce a substitute generation prompt.

### 7. Show Generated Dependencies In The References Tab

The shot References tab should be the user's visual inventory of reference
media that is relevant to the selected shot, not only a set of planned
placeholder cards.

Current UI behavior appears to render cards from `productionPlan.imageReferences`
through:

```text
packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card-grid.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card-images.ts
```

That is close, but this plan needs the UI and core report contract to guarantee
that generated/imported dependency media is visible after it exists.

Required behavior:

- Show generated/imported `first-frame` inputs for the selected shot in the
  References tab with a thumbnail and a clear product label such as "First
  frame".
- Show generated/imported `last-frame` inputs for the selected shot with a
  thumbnail and a clear product label such as "Last frame".
- Show every selected/generated/imported ad hoc `reference-image` input relevant
  to the selected shot or selected production group.
- Show generated/imported `multi-shot-storyboard-sheet` inputs when the selected
  shot belongs to that ordered production group.
- Support multiple ad hoc reference images at once. The UI must not collapse
  them into a single generic reference card.
- Show the reference intent/title authored by the user or agent when available.
  Do not show raw filenames, generated ids, or vague labels as primary card
  text.
- Keep planned-but-missing dependencies visually distinct from generated media.
  A missing/planned dependency can show cost and status, but it must not look
  like an image has already been generated.
- Use `shotVideoTakeInputFileUrl(...)` or the current equivalent file-serving
  path for persisted shot-video input images.
- Keep generation/import resource invalidation wired so cards appear after
  generation and import jobs complete. Existing invalidation keys such as
  `scene-shot-video-take-input:<input-id>` and
  `scene-shot-list:<shot-list-id>:video-take-production` should refresh the
  shot References tab data.
- Preserve the local shadcn UI rule. Feature code must continue to use local
  UI primitives such as `Button`; do not introduce raw interactive controls.

Core should expose enough report data for the UI to render this without
guessing from filenames or ids. If `productionPlan.imageReferences` is the
right contract, extend that report so it includes:

- `kind`: `first-frame`, `last-frame`, `reference-image`, or
  `multi-shot-storyboard-sheet` when relevant;
- `inputId` when generated/imported media exists;
- `title` or `label` from authored product metadata;
- `referenceIntent` for ad hoc reference images when available;
- `status`: missing, planned, selected, generated/imported, or blocked;
- `estimatedCostUsd` only for still-missing generatable dependencies.

The multi-shot storyboard sheet is a production-group dependency, but it should
still appear in the selected-shot References tab whenever the selected shot is
part of that group. Label it as a group sheet and show the included shot range
or ordered shot count when available, rather than pretending it is a single-shot
reference.

### 8. Validate Current Context Coverage Before Adding Schema

Before adding any new fields, inspect actual `generation context` output from a
sample project with selected Composition and Motion values.

Only add schema if there is a concrete missing product value that cannot be
represented today. Likely examples:

- per-shot intended duration;
- transition;
- explicit SFX/music split rather than broad `audioNotes`.
- named reference-image intent/label if the current `reference-image` input
  record cannot tell users and agents what an ad hoc reference image is for.

If such fields are needed, write a separate schema/data-model plan before
implementation. Do not smuggle new optional fields into Scene Shot Lists as an
unreviewed side effect of this plan.

## Testing And Validation Strategy

### Unit Tests

Add or update focused tests for core authored-spec enforcement:

- multi-shot context includes every selected shot in order;
- first-frame and last-frame missing authored drafts produce structured
  diagnostics when required as generated dependencies;
- missing `agentProposal.dependencyDrafts[]` for a required
  `shot.multi-shot-storyboard-sheet` produces a structured diagnostic;
- missing dependency drafts do not produce `draftGenerationSpec` prompt text;
- authored dependency drafts do produce draft specs using the authored prompt;
- `shot.reference-sheet` is no longer accepted as a generation/import purpose
  after implementation;
- ad hoc `reference-image` inputs remain selectable/importable.

### CLI Tests

Update CLI tests where useful to verify:

- `generation preflight` returns `inputsToCreate` for missing
  `multi-shot-storyboard-sheet` dependencies;
- `generation input list` exposes reusable `multi-shot-storyboard-sheet`
  candidates for the exact ordered group;
- final `shot.video-take` validation still rejects missing required storyboard
  sheet inputs.

### Studio UI Tests

Add focused Studio tests around the shot References tab:

- generated/imported `first-frame` inputs render as image cards for the selected
  shot;
- generated/imported `last-frame` inputs render as image cards for the selected
  shot;
- multiple ad hoc `reference-image` inputs render as separate cards with
  authored titles or reference intent;
- planned-but-missing dependencies remain visually distinct from generated
  inputs;
- raw filenames, generated ids, and vague role names are not used as primary
  card text;
- production-group storyboard sheets appear only when relevant to the selected
  shot's active production group and render as image cards once generated or
  imported.

### Skill Validation

Review the updated skill files against these examples:

- a two-shot group with rich composition and motion;
- a ten-shot action sequence;
- a dialogue sequence with over-the-shoulder and close-up beats;
- a family-friendly action/comedy scene with arrows and lens notes.
- a first-frame shot that must honor selected composition, movement, cast,
  location, and lookbook references;
- a first/last-frame shot where the last frame must preserve continuity while
  expressing the final action state;
- a shot where the user asks for two ad hoc reference images before deciding
  which one to attach.

For each example, confirm the agent instructions would produce:

- one panel per shot;
- readable metadata;
- no invented shot count;
- no invented exact dialogue, duration, music, or transition;
- selected camera/motion details included when available;
- cast/location continuity respected.
- first/last frame prompts are specific enough to estimate and approve as paid
  generation requests;
- ad hoc reference images have explicit authored purposes and are not generic
  reference sheets.

### Documentation Review

Confirm CLI docs and skill docs agree on:

- purpose names;
- target shape;
- `inputModeId` JSON field;
- `--intent` CLI flag;
- preflight as the authoritative dependency checklist;
- import remaining separate from generation.
- removal of `shot.reference-sheet`;
- generated/imported ad hoc `reference-image` dependency behavior.

## Completion Checklist

### Review Area

- [x] Confirm this plan is accepted before implementation begins.
- [x] Confirm `shot.reference-image` is the replacement generated ad hoc
      reference-image purpose.
- [x] Confirm `shot.multi-shot-storyboard-sheet` remains the multi-shot sheet
      purpose.
- [x] Confirm `shot.reference-sheet` should be removed as a generation/import
      purpose.
- [x] Confirm how multiple ad hoc reference images should be labeled and
      displayed after import.
- [x] Confirm whether exact dialogue text should be pulled from screenplay
      context during skill execution or left as optional when not already present.
- [x] Confirm whether per-shot duration and transition should stay out of scope
      for this slice.

### Architecture And Contracts

- [x] Keep `SceneShot` and `ShotSpecs` contracts unchanged unless a separate
      schema plan is approved.
- [x] Keep persisted final video specs using `inputModeId`.
- [x] Keep the CLI flag `--intent` mapped to `inputModeId` for model listing.
- [x] Keep generation and import separate.
- [x] Keep dependency selection based on exact ordered `shotIds` for multi-shot
      storyboard sheets.
- [x] Remove `shot.reference-sheet` directly rather than aliasing it.
- [x] Preserve `reference-image` as an explicit input kind for user/agent-authored
      ad hoc references.
- [x] Add `shot.reference-image` as an explicit generated/imported media purpose
      for ad hoc shot reference images.
- [x] Add `reference-image` as a dependency kind if the dependency graph needs a
      distinct kind for generated ad hoc references.
- [x] Do not add compatibility aliases for stale field names.

### Studio UI

- [x] Ensure `productionPlan.imageReferences` or its replacement includes
      generated/imported `first-frame`, `last-frame`, and ad hoc
      `reference-image` inputs relevant to the selected shot.
- [x] Ensure `productionPlan.imageReferences` or its replacement includes
      generated/imported `multi-shot-storyboard-sheet` inputs for every selected
      shot that belongs to the sheet's ordered production group.
- [x] Ensure the shot References tab displays generated/imported first-frame
      images with thumbnails.
- [x] Ensure the shot References tab displays generated/imported last-frame
      images with thumbnails.
- [x] Ensure the shot References tab displays multiple ad hoc reference images
      as separate cards.
- [x] Ensure the shot References tab displays generated/imported multi-shot
      storyboard sheets as image cards for included shots.
- [x] Ensure multi-shot storyboard sheet cards are labeled as group sheets and
      include the shot range or ordered shot count when available.
- [x] Ensure ad hoc reference-image cards use authored title/intent text instead
      of raw filenames or generated ids.
- [x] Ensure planned-but-missing dependencies are visually distinct from
      generated/imported media.
- [x] Ensure group storyboard sheets are shown for every shot in the production
      group and hidden for unrelated shots.
- [x] Ensure generation/import completion refreshes the References tab through
      the existing resource invalidation path or a deliberate replacement.
- [x] Keep feature code on local shadcn UI primitives; do not add raw
      interactive HTML controls.
- [x] Add focused Studio tests for generated/imported dependency cards and
      multiple ad hoc reference images.

### Core Implementation

- [x] Remove or bypass generic auto-draft prompt creation for shot-video
      dependency purposes when no explicit agent dependency draft exists.
- [x] Add a structured diagnostic for missing dependency draft authorship.
- [x] Ensure missing dependency drafts do not yield `draftGenerationSpec` prompt
      text in preflight dependency maps.
- [x] Ensure authored dependency drafts still produce draft specs with the
      authored prompt and parameters.
- [x] Enforce authored prompts for generated `shot.first-frame` and
      `shot.last-frame` dependencies.
- [x] Remove `shot.reference-sheet` from core purpose definitions and related
      validation paths.
- [x] Add `shot.reference-image` generation/import handling with authored prompt
      and reference-intent validation.
- [x] Preserve existing dependency map behavior and pricing behavior.
- [x] Preserve structured diagnostics for missing required inputs.
- [x] Add focused tests for missing-draft diagnostics, no generic prompt
      synthesis, and purpose separation.

### CLI Documentation

- [x] Update `docs/cli/commands.md` with `generation production update`.
- [x] Update `docs/cli/commands.md` with `generation preflight`.
- [x] Update `docs/cli/commands.md` with `generation input list`.
- [x] Update `docs/cli/commands.md` with `generation input select`.
- [x] Update `docs/cli/commands.md` with `generation input clear`.
- [x] Document `preflight.inputsToCreate`, `inputPlanItems`, `dependencyMap`,
      and `finalTake.canCreateSpec`.
- [x] Remove `shot.reference-sheet` from CLI purpose lists and examples.
- [x] Document ad hoc `reference-image` generation/import/selection behavior.
- [x] Update `docs/architecture/reference/media-generation.md` with the same
      agent-facing workflow summary.

### External Skill Updates

- [x] Update
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
      to point multi-shot work at the new detailed reference.
- [x] Update
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`
      with the multi-shot sheet workflow and quality gates.
- [x] Add
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-multi-shot-storyboard-sheet.md`.
- [x] Add
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-first-last-frame.md`.
- [x] Add
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-reference-images.md`.
- [x] Update
      `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/shot-multi-shot-storyboard-sheet-spec.json`
      with a realistic prompt template.
- [x] Update first-frame and last-frame samples with authored prompts that use
      selected shot design and references.
- [x] Delete the `shot-reference-sheet` sample or replace it with the accepted
      ad hoc reference-image sample.
- [x] Replace `intentId` with `inputModeId` in skill samples.
- [x] Replace `basedOnIntentId` with `basedOnInputModeId` in skill samples.
- [x] Make clear that exact dialogue, duration, music, and transition should not
      be invented when absent.
- [x] Make clear that first/last frame generation is not exploratory image
      generation.
- [x] Make clear that ad hoc reference images require an explicit user/agent
      reference need before generation.

### Validation

- [x] Run focused core tests for shot video take generation planning.
- [x] Run focused CLI tests for generation command behavior.
- [x] Run `pnpm --dir packages/core test` if the touched core surface is broader
      than one focused test file.
- [x] Run `pnpm --dir packages/cli test` if CLI tests or docs examples reveal
      command contract drift.
- [x] Run focused Studio tests for the shot References tab if UI code changes.
- [x] Inspect generated JSON samples for current contract names.
- [x] Inspect samples for removal of `shot.reference-sheet`.
- [x] Review skill instructions manually against the attached sheet examples.

### Documentation And Follow-Up

- [x] If per-shot duration or transition becomes required, create a separate
      active plan for Scene Shot List schema and UI changes.
- [x] If this plan becomes accepted project direction, summarize the final
      decision in `docs/architecture/reference/media-generation.md` or a focused
      ADR.
- [x] Leave old/historical plans unchanged unless they are directly being used
      as current implementation guidance.

## Completion Criteria

This plan is complete when:

- the `media-producer` skill can tell an agent exactly how to create a
  multi-shot storyboard planning sheet from `generation context`;
- the `media-producer` skill can tell an agent exactly how to author
  first-frame and last-frame specs from selected shot design and existing
  references;
- stale `intentId` skill examples are gone;
- `shot.reference-sheet` is removed from active purpose docs/samples/contracts;
- explicit ad hoc reference-image generation/attachment behavior is documented;
- the Studio shot References tab shows generated/imported first frames, last
  frames, multi-shot storyboard sheets, and multiple ad hoc reference images for
  the selected shot;
- CLI docs include the implemented shot-video preflight and input commands;
- core no longer synthesizes generic shot-video dependency prompts when no
  agent-authored dependency draft exists;
- tests cover missing-draft diagnostics and the no-generic-prompt behavior;
- no compatibility aliases or schema changes were added without a separate
  approved plan.
