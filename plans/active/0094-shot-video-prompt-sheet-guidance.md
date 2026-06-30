# 0094 Shot Video Prompt Sheet Guidance

Status: implemented
Date: 2026-06-30

## Summary

This plan defines a sample-independent solution for improving
`shot.video-prompt-sheet` guidance.

The immediate failure mode was not only routing. After routing an existing
Shot Video Take to `media-producer`, the agent still needs enough guidance to
author a useful prompt sheet for video generation. A useful prompt sheet must
preserve shot order, spatial continuity, motion continuity, visual continuity,
and timed spoken material without becoming a sample-project-specific checklist.

This plan keeps the prompt-sheet guidance solution lightweight:

- improve the `media-producer` and `movie-director` skill guidance;
- clarify the expected authoring flow in Studio docs;
- use existing Core-owned take authoring context and readiness reports as the
  source of truth;
- add a general fail-fast screen-context gate for user requests that refer to
  "current", "this", "the selected", or "the open" project object;
- avoid adding a Codex image import helper, provider-specific shortcut, or new
  durable prompt-sheet schema unless implementation discovers a core contract
  gap that cannot be solved through the existing context.

This plan also folds in two review fixes from the same slice:

- fix `renku studio notify-refresh` so it resolves the requested project
  through Core and appends refresh events with the durable project identity id,
  not the project name;
- fix Shot Video Take readiness reporting so route-required missing inputs are
  blockers, while optional missing references are still reported to agents as
  non-blocking missing inputs.

## Context

The prior implementation in
`plans/active/0093-agent-take-video-prompt-routing-and-codex-image-defaults.md`
fixed the major ownership mistake: active take work should route to
`media-producer`, not `scene-shot-designer`.

The remaining guidance gap is different. It concerns what an agent should put
into a `shot.video-prompt-sheet` request and how it should judge whether the
result is good enough to import.

The bad outcome to prevent is a prompt sheet that is structurally valid but
creatively misleading. Examples of misleading results include:

- panels are in the wrong order;
- motion direction is reversed;
- location geography drifts between panels;
- ungrounded landmarks, water, props, or characters appear;
- narration, dialogue, or other spoken text is attached to the wrong panel;
- a moodboard is generated instead of one panel per selected shot;
- labels are too small to read, so downstream video prompting loses the useful
  planning signal.

The proper solution should be reusable for any project. It should not encode
Urban Basilica details, Constantinople geography, cannon-specific movement, or
the exact narration from the post-mortem.

Two implementation review findings also need to be handled here:

- `renku studio notify-refresh --project <name>` can currently report success
  while Studio ignores the notification if the event payload uses the project
  name instead of the durable project identity id. For example, a command using
  `--project constantinople` must append an event for the resolved
  `project_...` identity id, because the Studio client invalidates resources by
  comparing the event project id to `currentProject.identity.id`.
- Shot Video Take readiness can hide a required `video-prompt-sheet` for
  Seedance reference or multi-shot routes. The dependency inventory may list
  the prompt sheet as an optional reference, but final spec validation requires
  it for those routes. Readiness must therefore distinguish route-required
  missing inputs from optional missing references.

## Correction To Prior Gap Report

Do not add a dedicated Codex image import command or helper as part of this
work.

That idea created too much of a special case and bloated the implementation.
The correct boundary remains:

- Renku owns project context, durable metadata, purpose-specific imports,
  selections, and resource refresh notifications.
- External image-generation tools, including Codex built-in image generation
  when available, produce files outside Renku.
- Agents stage finished files under project `generated/media/` and attach them
  through the existing purpose-specific `renku media import` command.

This plan may improve skill wording around that existing flow only where it
helps prompt-sheet work. It must not reintroduce a new special-case import
surface.

## Problem Statement

`shot.video-prompt-sheet` is an AI-video planning artifact. It is not a Scene
Shot List, not a scene storyboard import batch, and not a moodboard.

The current skill guidance says the sheet should preserve order, continuity,
motion, and known dialogue or voiceover. That is directionally correct, but it
is still too loose for agents. The guidance needs to describe the concrete
authoring steps an agent should follow before prompting an image model and the
inspection gate it should apply before importing the sheet.

The missing middle layer is an agent-authored prompt-sheet brief:

- derived from `renku take authoring context --take <take-id> --json`;
- scoped to the current take and its ordered shot ids;
- explicit about geography, movement, visual continuity, and spoken timing;
- useful whether the actual image is produced by Renku-managed generation,
  Codex built-in image generation, or another approved external image tool;
- disposable and non-durable unless a future core contract requires otherwise.

## Goals

- Make `shot.video-prompt-sheet` authoring guidance concrete enough that an
  agent can draft a better image prompt without guessing.
- Keep the guidance project-neutral and reusable across genres, locations, and
  visual styles.
- Require agents to derive continuity from Core-owned take context rather than
  from memory, filenames, or assumptions.
- Require agents to verify that Studio current context matches the user's
  deictic request before using ids or taking action.
- Provide a reusable prompt structure for one-panel-per-shot sheets.
- Provide a reusable quality gate before import.
- Separate required facts from creative choices that should be asked of the
  user.
- Preserve the current architecture: Core owns take state, prepared input
  validity, route readiness, and media imports; skills own agent workflow and
  prompt drafting.
- Ensure take readiness gives agents a complete missing-input report: blockers
  for route-required missing inputs, and non-blocking report entries for
  optional missing references.
- Ensure Studio refresh notifications use durable project identity ids so the
  browser invalidates the intended project resources.
- Keep `scene-shot-designer` out of take-owned video prompt sheet work.
- Keep `media-producer` as the owner for prompt-sheet creation, inspection, and
  import.

## Non-Goals

- Do not add a Codex image import helper command.
- Do not add a new Codex provider to `packages/engines`.
- Do not add a new durable database table or JSON document for prompt-sheet
  briefs in this slice.
- Do not preserve or mention obsolete purpose names in runtime code.
- Do not add route-local, CLI-local, or React-local business rules that decide
  whether a take input is valid. Core already owns those rules.
- Do not create a sample-project-specific checklist.
- Do not require a specific image provider. The guidance should work for
  Renku-managed image generation and external image generation paths.
- Do not ask the user for every possible creative preference before acting.
  Ask only when the required continuity cannot be derived from current context
  or when the user explicitly wants creative control.
- Do not continue by guessing a likely take, shot, scene, cast member,
  location, lookbook, or other project object when the user asked for the
  current or selected object and Studio current context does not identify it.
- Do not hide optional missing references just because they are not blockers.
  Optional references should remain visible to agents so they can improve
  quality, ask for direction, or decide whether to proceed.
- Do not make the CLI responsible for guessing project ids from event payload
  fallbacks. Resolve the project through the Core-owned project lookup before
  appending Studio refresh notifications.

## Current Sources Of Truth

Agents must start from these current contracts:

```bash
renku studio current --json
renku take authoring context --take <take-id> --json
```

When needed for media-purpose context:

```bash
renku generation context --purpose shot.video-prompt-sheet --target take:<take-id> --json
renku generation model list --purpose shot.video-prompt-sheet --target take:<take-id> --json
```

The take authoring context is authoritative for:

- take id;
- scene id;
- source shot list id;
- take structure mode;
- ordered selected shot ids;
- shared direction for continuous takes;
- per-shot direction for multi-cut takes;
- selected cast, locations, lookbook references, and media inputs;
- production plan;
- preflight inputs;
- take generation readiness.

The skills must not reconstruct these facts from screen copy, filenames, old
plan files, or stale sample project paths.

## Proposed Solution

### 1. Add An Intent-Context Fit Gate

When the user uses deictic language such as "this", "current", "the open",
"the selected", "the take I am working on", "this scene", or "the thing on
screen", the agent must treat Studio current context as a required input, not
as optional convenience.

The general rule:

```text
If the user asks about the current/open/selected project object, first verify
that `renku studio current --json` returns that object kind and the durable id
needed for the next command. If it does not, stop and ask for the user to
navigate to the object or provide the id. Do not infer the object from nearby
project data.
```

For `shot.video-prompt-sheet` work on an existing take, that means:

- run `renku studio current --json`;
- verify Studio is focused on a scene/takes surface or another current context
  that explicitly includes a Shot Video Take id;
- verify the take workspace is editing an existing take, not just showing a
  scene, shot list, new-take form, or unrelated tab;
- extract the durable `takeId`;
- then run:

```bash
renku take authoring context --take <take-id> --json
```

If any of those expectations fail, the agent should not continue by looking at
the active Scene Shot List, the most recent take, the first take in a list, or a
take id remembered from prior context.

Preferred response shape:

```text
You asked me to look at the current Shot Video Take, but Studio current does not
identify an open take. I can see <actual surface/object>, so I cannot tell which
take you mean. Please open the take in Studio or give me the take id.
```

This is not take-specific. The same gate applies to other current-object
requests:

- "this scene" requires a current Scene id;
- "this cast member" requires a current Cast Member id;
- "this location" requires a current Location id;
- "this lookbook" requires a current Lookbook id;
- "the selected shot" requires a current Scene Shot List shot id;
- "this dialogue" requires a current dialogue id when the next command needs
  one.

Agents may use broader project context only after the current object has been
identified, or when the user did not refer to the current/open/selected object.

### 2. Add A Prompt-Sheet Brief Step To `media-producer`

Before prompting any image model for `shot.video-prompt-sheet`,
`media-producer` should create a short internal authoring brief from the take
context.

This brief is not a persisted Renku document. It is an agent working step that
helps the model prompt stay grounded.

The brief should have these sections:

```text
Take scope
- takeId
- take mode
- ordered shot ids
- selected input mode and model if already chosen

Panel plan
- one panel per ordered shot id
- panel number
- shot id
- story role
- visual frame
- action
- model-facing note

Spatial continuity
- location anchor
- start spatial state
- end spatial state
- screen direction or travel direction when known
- required landmarks or zones from selected location context
- forbidden geography that would contradict context

Motion continuity
- camera movement
- subject movement
- speed or energy when known
- direction that must not be reversed
- transition or continuity link between panels when known

Visual continuity
- selected cast references
- selected location sheets
- selected lookbook sheets
- storyboard images or prepared inputs that should influence the sheet
- costume, prop, palette, lighting, or texture constraints when present

Audio and spoken timing
- exact narration, dialogue, or voiceover text only when known
- panel number where each spoken phrase belongs
- timing cue such as starts before panel, during panel, after panel, or
  bridges panels
- explicit unknowns that should not be invented

Negative constraints
- no extra shots
- no extra characters
- no ungrounded landmarks, vehicles, props, water, weather, signage, or era
  details
- no invented dialogue, narration, subtitles, music, or sound effects
- no provider labels unless the target model prompt contract requires them
```

This structure is intentionally generic. It works for a drone move, a dialogue
exchange, a handheld chase, a tabletop insert, a product shot, or an abstract
visual take.

### 3. Make Geography Guidance Practical But Not Sample-Specific

The skill should treat geography as a continuity system, not as a fixed list of
sample-project facts.

For every prompt sheet, the agent should identify:

- where the take begins;
- where it ends;
- what must stay on the same side of frame or line of action;
- what physical zones or landmarks are allowed by the selected location;
- which location details are mandatory because the user named them or because
  they appear in the selected location sheet;
- which details are forbidden because they would change the meaning of the
  take.

When context is incomplete, the agent should ask a targeted question instead of
inventing geography.

Useful question examples:

```text
Which side of the room should the camera travel toward by the final panel?
Should the subject move deeper into the location, toward the camera, or across frame?
Which selected Location Sheet should anchor the prompt sheet?
Is there any geography the sheet must avoid showing?
```

The guidance should avoid project-specific examples such as a named wall,
field, cannon, city, sea, or historical location unless those facts come from
the current take context or the user supplies them during the task.

### 4. Make Audio And Spoken Timing A First-Class Prompt Section

The current guidance says to include dialogue or voiceover only when known.
That is not enough. Agents also need to place known spoken material in the
right panel.

Use a generic "audio and spoken timing" section rather than a
sample-specific `perPanelNarration` concept.

The section should support:

- narration;
- dialogue;
- voiceover;
- on-screen text only when the user or project context asks for it;
- sound effects or music cues only when present in take context;
- explicit unknowns.

Recommended internal shape:

```text
Audio and spoken timing
- panel: <number>
  shotId: <shot-id>
  kind: narration | dialogue | voiceover | on-screen-text | sound | music
  exactText: <known text, omitted if unknown>
  timing: before-panel | during-panel | after-panel | bridges-next-panel
  source: user-direction | screenplay-dialogue | take-direction | production-notes
  instruction: <short model-facing instruction>
```

The image prompt should never invent exact spoken words. If the exact text is
not known, the prompt can say "leave spoken text blank" or "show a small empty
audio cue row" depending on the requested layout.

### 5. Add A Prompt Template That Agents Can Reuse

The `shot-video-prompt-sheet.md` reference should include a provider-neutral
prompt template based on the brief.

Template:

```text
Create one readable video prompt sheet for this existing Shot Video Take.

Purpose:
- make one planning panel per selected shot;
- preserve shot order, spatial continuity, motion continuity, and known spoken
  timing;
- support downstream AI video prompting.

Layout:
- <N> panels in exact order: <shot ids>;
- each panel has one image frame and compact metadata;
- labels must be large enough to read;
- include camera arrows or motion marks only where movement is specified;
- do not make a moodboard or collage.

Take scope:
<take-scope-brief>

Spatial continuity:
<spatial-continuity-brief>

Motion continuity:
<motion-continuity-brief>

Visual continuity:
<visual-continuity-brief>

Audio and spoken timing:
<audio-and-spoken-timing-brief>

Panel details:
<one block per panel>

Negative constraints:
<negative-constraints-brief>
```

The template should instruct agents to omit a section when no reliable context
exists, except for negative constraints. Negative constraints should always be
present because they prevent common image-generation drift.

### 6. Add A Pre-Import Quality Gate

Before importing a generated `shot.video-prompt-sheet`, the agent must inspect
the image and compare it against the brief.

The quality gate should reject the sheet when:

- the panel count differs from the ordered shot count;
- panel order differs from the take;
- the take mode is misrepresented;
- motion direction is reversed or missing;
- spatial geography contradicts the take context;
- required location/cast/lookbook references are absent or contradicted;
- exact spoken text appears in the wrong panel;
- invented narration, dialogue, subtitles, music, or sound effects appear;
- ungrounded landmarks, props, water, weather, signage, vehicles, or characters
  appear;
- labels are too small to read;
- the output is a moodboard, poster, or concept collage instead of a prompt
  sheet.

When a sheet fails, the agent should not import it automatically. It should
report:

- what failed;
- why that failure matters for downstream video generation;
- whether the likely fix is prompt revision, more user direction, or accepting
  the sheet with caveats.

### 7. Clarify What Core Does And Does Not Need To Add

No new Core mutation is planned.

Core already owns the durable rules for:

- take membership;
- take structure mode;
- prepared input validity;
- input selection;
- replace-selected behavior;
- import attachment;
- route readiness;
- structured diagnostics.

Implementation should first try to solve the prompt-sheet guidance gap in
skills and docs. The readiness review fix is different: it is a correction to
existing Core-owned readiness reporting, not a new mutation or persistence
feature.

Only add Core contract fields if implementation proves that required facts are
not available from `take authoring context`. Candidate additions, if needed:

- richer labels for selected location sheets inside take context;
- selected lookbook sheet summaries in the prompt-facing reference section;
- a clearer readiness question when selected geography exists but no selected
  location sheet is available;
- a prompt-facing "known spoken text" projection for selected dialogue or
  narration sources if those facts already exist in Core.

Any such addition must be a current contract, not a compatibility shim, and
must be owned in `packages/core`.

### 8. Keep Movie Director Routing Short And Decisive

`movie-director` should keep routing simple:

- if Studio is focused on an existing take, start with
  `renku studio current --json`;
- if the user asked for the current take and Studio current does not include a
  durable existing take id, stop and explain that the current screen does not
  identify the take;
- read `renku take authoring context --take <take-id> --json`;
- route `shot.video-prompt-sheet` work to `media-producer`;
- pass any user-supplied continuity constraints, spoken timing, forbidden
  geography, or provider preference to `media-producer`;
- do not send take prompt-sheet work to `scene-shot-designer`.

The handoff example should include the required `--purpose` flag when showing
media import commands.

Correct example:

```bash
renku media import \
  --purpose shot.video-prompt-sheet \
  --target take:<take-id> \
  --source generated/media/<sheet>.png \
  --selection select \
  --json
```

Use `--replace-selected` only when the user is correcting a previously selected
prompt sheet and wants the old selected input discarded.

### 9. Fix Studio Refresh Project Identity Resolution

`renku studio notify-refresh` must append events for the durable project
identity id that Studio uses at runtime.

The command may accept a human project name such as `constantinople`, but the
event payload must use the resolved identity id such as `project_...`. Studio
resource invalidation compares the event `projectRef.id` to
`currentProject.identity.id`; an event that carries the project name can be
written successfully but ignored by the browser.

Implementation direction:

- keep the CLI handler thin;
- resolve the `--project` value through the Core-owned project lookup before
  appending the Studio resource changed event;
- pass the resolved project identity id into
  `appendStudioResourceChangedEvent`;
- fail fast with a structured diagnostic if the project cannot be resolved;
- do not rely on `appendStudioResourceChangedEvent` substituting
  `project.name` when `project.id` is absent for this command path.

Example behavior:

```bash
renku studio notify-refresh --project constantinople --resource media --json
```

If `constantinople` resolves to identity id `project_abc123`, the appended
event must contain `project_abc123`. It must not contain `constantinople` as
the project id.

### 10. Fix Take Readiness Missing Input Reporting

Shot Video Take readiness must report all missing inputs that agents need to
know about, but it must distinguish blocking requirements from optional quality
references.

The bug to prevent:

- a Seedance reference or multi-shot take has a selected route that requires a
  `video-prompt-sheet`;
- dependency inventory lists the prompt sheet as an optional reference because
  the slot can be optional for other routes;
- the take has a model, input mode, and final prompt but no prompt sheet;
- readiness returns `blocked` or `needs-user-direction` without a
  `missing-video-prompt-sheet` blocker;
- the agent cannot tell that it must create or import the prompt sheet before
  final spec validation can succeed.

Implementation direction:

- build readiness from route-required missing inputs, not only from the
  inventory entry's generic `required` flag;
- carry selected-route requiredness into preflight/readiness where that is the
  clean Core-owned contract;
- treat route-required missing `video-prompt-sheet` entries as blockers for
  routes that need them;
- continue reporting optional missing references as non-blocking missing input
  entries so agents can see quality-improving references without treating them
  as mandatory work;
- keep the rule in `packages/core`; do not patch this in CLI formatting, Studio
  React code, or skill prose.

Expected readiness shape:

- route-required missing input:
  `blocking: true`, included in blockers, with a clear code such as
  `missing-video-prompt-sheet`;
- optional missing reference:
  `blocking: false`, included in a non-blocking missing/optional section or
  equivalent existing readiness field, and not counted as a blocker.

The exact field names should follow the current Core readiness contract. Do
not add compatibility mirrors or duplicate convenience fields just to preserve
an intermediate response shape.

## Skill Updates

### `media-producer/SKILL.md`

Add a short rule:

- for `shot.video-prompt-sheet`, draft an internal prompt-sheet brief before
  image generation;
- use the brief to prompt the image model;
- inspect the output against the brief before import.

Keep the existing execution-path policy but do not add a Codex-specific import
helper.

### `media-producer/references/shot-video-prompt-sheet.md`

Replace the current loose prompt guidance with the full authoring flow:

1. Read take authoring context.
2. Build the prompt-sheet brief.
3. Ask only for missing required continuity.
4. Prompt the image model with the reusable template.
5. Inspect with the pre-import quality gate.
6. Import only after inspection.

### `media-producer/references/shot-video-take.md`

Update the multi-shot workflow so the video prompt sheet step points to the new
brief and quality gate.

### `movie-director/references/specialist-handoff-checklists.md`

Fix the shot-video take input import example to include `--purpose`.

### `scene-shot-designer/SKILL.md`

No major change expected. Keep the existing boundary statement that existing
take `shot.video-prompt-sheet` work routes to `media-producer`.

## Documentation Updates

Update `docs/architecture/reference/media-generation.md` to describe
`shot.video-prompt-sheet` as:

- a take-owned AI-video planning sheet;
- one panel per ordered take shot;
- grounded in take authoring context;
- inspected before import;
- not a scene-owned storyboard sheet.

Update `docs/cli/commands.md` only if command examples need clarification.
Do not document a new Codex image import command.

## Validation Strategy

This plan should not require paid generation or live project mutation to
validate.

Validation should include:

- static review of the updated skill references;
- command-example checks where the repository has tests for skill or docs
  command snippets;
- focused CLI tests proving `renku studio notify-refresh --project <name>`
  appends events with the resolved durable project identity id;
- focused Core readiness tests proving route-required missing
  `video-prompt-sheet` inputs become blockers;
- focused Core readiness tests proving optional missing references are reported
  to agents without becoming blockers;
- focused `rg` checks that no new `import-codex-image` or similar helper has
  been introduced;
- focused `rg` checks that the movie-director handoff import example includes
  `--purpose shot.video-prompt-sheet`;
- optional dry-run review using a tiny synthetic take context copied into a
  scratch note, not the real sample project, to verify that the guidance is
  project-neutral.

If implementation touches TypeScript contracts, run focused tests for the
owning package. If implementation only touches docs and skills, run the
available documentation or lint checks that apply to those files.

## Open Design Questions

- Should the prompt-sheet brief remain purely prose guidance, or should the
  skill use a small JSON-like scratch structure in its reference docs?
- Should Core expose richer prompt-facing spoken-text projections, or is the
  current dialogue/audio context enough?
- Should `take authoring context` include a clearer warning when geography is
  under-specified for a multi-shot or continuous take?
- Should the pre-import quality gate require visual inspection every time, or
  may agents import a user-supplied sheet without inspection when the user
  explicitly says it is final?
- Should `--replace-selected` with `--selection take` fail fast, or is the
  current "only replace when selecting" behavior acceptable once documented?

## Completion Checklist

### Review Area

- [x] Confirm this plan deliberately supersedes only the prompt-quality gap
      from the post-mortem review.
- [x] Confirm this plan includes the Studio refresh project identity review
      finding.
- [x] Confirm this plan includes the Shot Video Take readiness review finding.
- [x] Confirm no Codex image import helper is part of this plan.
- [x] Confirm `shot.video-prompt-sheet` remains the current take-owned purpose
      name.
- [x] Confirm the plan does not rely on Urban Basilica, historical siege
      geography, or any other sample-project-specific facts.
- [x] Confirm the plan keeps `scene.storyboard-sheet` and
      `shot.video-prompt-sheet` separate.

### Architecture And Contracts

- [x] Verify the current `take authoring context` includes enough facts to
      build the prompt-sheet brief.
- [x] Identify any missing Core-owned facts needed by the brief before editing
      skills.
- [x] Confirm no focused Core contract fields were needed because the current
      authoring context exposes enough prompt-sheet brief facts.
- [x] Verify Shot Video Take readiness can tell the difference between
      route-required missing inputs and optional missing references.
- [x] Ensure route-required missing prompt sheets are represented as blockers
      through Core-owned readiness logic.
- [x] Ensure optional missing references remain visible in readiness output but
      are not counted as blockers.
- [x] Ensure any new readiness codes or fields are current contract fields, not
      compatibility mirrors.
- [x] Do not add durable prompt-sheet brief storage unless a separate accepted
      architecture decision requires it.
- [x] Do not add compatibility names, aliases, or wrappers.
- [x] Do not add React or Studio server validation for prompt-sheet correctness.

### CLI And Studio Coordination

- [x] Resolve `renku studio notify-refresh --project <value>` through the
      Core-owned project lookup before appending the event.
- [x] Pass the resolved project `identity.id` as the event project id.
- [x] Fail fast with a structured diagnostic when the project cannot be
      resolved.
- [x] Add a focused CLI test where a project name such as `constantinople`
      resolves to a `project_...` id and the appended event uses that id.
- [x] Add a focused CLI test for the unknown-project failure path.
- [x] Confirm Studio resource invalidation can match the notification event to
      `currentProject.identity.id`.

### Core Readiness Implementation

- [x] Update preflight/readiness so selected route requiredness controls which
      missing inputs become blockers.
- [x] Add or update a test for a Seedance reference or multi-shot take that has
      model, input mode, and final prompt but lacks `video-prompt-sheet`; the
      readiness report must include a blocking `missing-video-prompt-sheet`
      style issue.
- [x] Add or update a test proving optional missing references are still
      surfaced to agents as non-blocking missing inputs.
- [x] Confirm final spec validation and readiness agree about whether
      `video-prompt-sheet` is required for the selected route.
- [x] Confirm the fix lives in `packages/core`, not in CLI formatting, Studio
      React code, server route logic, or skill-only guidance.

### Skill Implementation

- [x] Update `movie-director` guidance so deictic requests such as "this",
      "current", "selected", and "open" require a matching
      `renku studio current --json` result before specialist dispatch.
- [x] Update `media-producer/SKILL.md` with the prompt-sheet brief rule.
- [x] Update `media-producer` guidance so current-take prompt-sheet work stops
      when Studio current does not identify an existing take id.
- [x] Update `media-producer/references/shot-video-prompt-sheet.md` with:
      take scope, panel plan, spatial continuity, motion continuity, visual
      continuity, audio and spoken timing, negative constraints, prompt
      template, and pre-import quality gate.
- [x] Update `media-producer/references/shot-video-take.md` so multi-shot and
      continuous take workflows point to the new prompt-sheet guidance.
- [x] Confirm `media-producer/references/workflow.md` did not need a separate
      update because the purpose-specific guidance now owns the inspection flow.
- [x] Update `movie-director/references/specialist-handoff-checklists.md` so
      shot-video input import examples include
      `--purpose shot.video-prompt-sheet`.
- [x] Leave `scene-shot-designer` focused on Scene Shot Lists and scene
      storyboard image handoffs.

### Documentation

- [x] Update `docs/architecture/reference/media-generation.md` with the current
      `shot.video-prompt-sheet` definition and quality expectations.
- [x] Update `docs/cli/commands.md` only for current command examples.
- [x] Ensure documentation does not describe a Codex-specific import helper.
- [x] Ensure documentation describes external images as ordinary
      purpose-specific imports through existing `renku media import`.

### Validation And Tests

- [x] Run `rg` for forbidden helper names such as `import-codex-image` and
      confirm none were introduced.
- [x] Run `rg` for `shot.video-prompt-sheet` skill references and confirm they
      point to take-owned media work.
- [x] Verify skill guidance contains a fail-fast path for user requests that
      depend on current Studio focus but where current focus does not identify
      the expected object.
- [x] Verify movie-director handoff examples include `--purpose`.
- [x] Run focused CLI tests for `studio notify-refresh`.
- [x] Run focused Core tests for Shot Video Take readiness and final spec
      validation.
- [x] Confirm the docs-only validation path was not applicable because
      TypeScript Core and CLI contracts changed in this slice.
- [x] If TypeScript contracts changed, run focused package tests for the owning
      package.
- [x] If Core readiness or context fields changed, add focused tests that prove
      agents receive route-required and optional-reference readiness facts.

### Final Verification

- [x] Review the updated guidance against at least two generic take shapes:
      continuous multi-shot movement and multi-cut dialogue coverage.
- [x] Confirm the guidance tells agents when to ask for missing geography or
      spoken timing.
- [x] Confirm the guidance tells agents not to infer a take, scene, cast
      member, location, lookbook, shot, or dialogue when the user asked for the
      current one and Studio current does not provide the needed id.
- [x] Confirm the quality gate prevents wrong order, reversed motion, invented
      geography, and misplaced spoken text.
- [x] Confirm the final implementation report clearly states that no paid media
      generation and no live project mutation were required for verification.
