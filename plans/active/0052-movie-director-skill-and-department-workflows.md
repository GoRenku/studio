# 0052 Movie Director Skill And Department Workflows

Status: implemented
Date: 2026-06-07

## Summary

Renku Studio has several strong department skills, but it does not yet have a
top-level sidekick that helps the user make a movie across departments.

The proposed new skill is:

```text
movie-director
```

The `movie-director` skill should sit above the existing Renku Studio skills and
act like a creative director and production coordinator for agent workflows. It
should:

- understand where the user is in the movie-making process;
- choose the right specialist skill for the next concrete step;
- keep the project moving without pretending every department is already fully
  supported;
- explain dependencies and approvals in plain language;
- avoid writing department-specific artifacts directly when a specialist skill
  owns that workflow;
- identify when a requested department needs new CLI coverage before it can be
  reliable.

This is not a generic "do everything" skill. It is a routing and continuity
skill for Renku Studio movie creation.

## What Was Inspected

Existing external Studio Skills under:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Read skill definitions:

- `screenplay-drafter/SKILL.md`
- `screenplay-analyst/SKILL.md`
- `inspiration-analyzer/SKILL.md`
- `lookbook-designer/SKILL.md`
- `scene-shot-designer/SKILL.md`
- `media-producer/SKILL.md`

Read supporting local architecture and CLI surfaces:

- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/screenplay-command.ts`
- `packages/cli/src/commands/inspiration-command.ts`
- `packages/cli/src/commands/lookbook-command.ts`
- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/cli/src/commands/generation-purpose-command-registry.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`
- `packages/core/src/client/resources.ts`
- `packages/core/src/client/cast-members.ts`
- `packages/core/src/client/locations.ts`
- `packages/core/src/server/resources/selection-context.ts`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/architecture/reference/visual-language.md`

External role references used:

- [StudioBinder, Ultimate Guide to Film Crew Positions](https://www.studiobinder.com/blog/film-crew-positions/)
- [StudioBinder, What Does a Director Do?](https://www.studiobinder.com/blog/what-does-a-director-do/)
- [StudioBinder, What is a Shot List?](https://www.studiobinder.com/blog/what-is-a-shot-list-example/)
- [StudioBinder, Shot List vs Storyboard](https://www.studiobinder.com/blog/shot-list-vs-storyboard/)
- [StudioBinder, What is a Casting Director?](https://www.studiobinder.com/blog/what-is-a-casting-director-job-description/)
- [StudioBinder, What is Production Design in Film?](https://www.studiobinder.com/blog/what-is-production-design-in-film/)
- [StudioBinder, Three Act Structure](https://www.studiobinder.com/blog/three-act-structure/)

## Skill-Creator Guidance Applied

The user explicitly requested use of the `skill-creator` guidance. The important
takeaways for this plan are:

- The new skill should have a clear trigger description in YAML frontmatter,
  because that metadata is the primary activation mechanism.
- The main `SKILL.md` should stay lean and operational. It should not copy all
  specialist skill instructions into one giant file.
- Department maps, workflow recipes, CLI coverage, and gap notes should live in
  `references/` files that the director skill loads only when needed.
- The skill should be initialized through the skill-creator script during
  implementation, not created by hand from scratch.
- `agents/openai.yaml` should be generated from the final `SKILL.md` instead of
  guessed manually.
- The skill should be validated with `quick_validate.py`.
- Because this skill is an orchestrator, it should be forward-tested with
  realistic user prompts after implementation.

## Accepted Review Decisions

The first review pass resolved these choices:

- The top-level skill name is `movie-director`.
- The top-level skill should follow the same naming convention as the existing
  external Studio Skills.
- `renku director context --json` is part of this plan, not a deferred open
  question.
- `casting-director` and `production-designer` should be planned as follow-up
  specialist skills with their own CLI and core backing.
- The detailed plan for `casting-director`, `production-designer`, and their
  backing commands lives in
  `plans/active/0053-casting-director-and-production-designer.md`.
- The production-design skill name is `production-designer`, not
  `location-staging-designer`.
- Future voice casting, voice notes, voice samples, and voice variants stay
  under `casting-director` until a later architecture decision separates them.

## Production Role Framing

The user's proposed role map is directionally right, but the movie-making
workflow needs a few clearer boundaries.

### Screenwriting

Screenwriting owns story and screenplay truth:

- premise, format, genre, tone, audience, and boundaries;
- acts, sequences, scenes, action, dialogue, narration, and formal screenplay
  blocks;
- cast and location records when they are part of the screenplay source of
  truth;
- screenplay critique and revision planning.

Existing Renku coverage:

- `screenplay-drafter`
- `screenplay-analyst`

Current CLI coverage is good for screenplay-level work:

```bash
renku screenplay status --json
renku screenplay show --json
renku screenplay validate --file <json> --json
renku screenplay create --file <json> --json
renku screenplay apply --file <json> --json
renku screenplay scene revise --scene <scene-id> --file <json> --json
renku screenplay analyze context --json
renku screenplay analyze validate --file <json> --json
renku screenplay analyze write --file <json> --json
```

### Cinematography And Visual Language

Cinematography should mean the movie's visual grammar, not only camera settings.
It includes:

- collecting and analyzing references;
- deciding palette, tone, lighting, texture, composition, camera behavior, and
  lens feel;
- making a Lookbook that downstream generation can follow;
- translating visual language into shot design.

Existing Renku coverage:

- `inspiration-analyzer`
- `lookbook-designer`
- `scene-shot-designer`
- `media-producer` for Lookbook images, Lookbook sheets, storyboard sheets, shot
  reference images, first/last frames, and final video takes.

Current CLI coverage is good for Inspiration, Lookbooks, and shot lists:

```bash
renku inspiration list --json
renku inspiration show --folder <folder-id> --json
renku inspiration analysis validate --folder <folder-id> --file <json> --json
renku inspiration analysis write --folder <folder-id> --file <json> --json

renku lookbook list --json
renku lookbook validate --file <json> --json
renku lookbook create --name <name> --file <json> --json
renku lookbook update --lookbook <lookbook-id> --file <json> --json
renku lookbook set-active --lookbook <lookbook-id> --json

renku screenplay shot-list context --scene <scene-id> --json
renku screenplay shot-list validate --file <json> --json
renku screenplay shot-list write --file <json> --json
```

### Casting

Casting is broader than adding names to the screenplay. It should own:

- character interpretation from the script;
- cast member facts and dramatic function;
- physical design, face, body language, age, and presence;
- costume direction and scene/sequence-specific variants;
- character sheets and profile images;
- future voice casting, voice samples, voice variants, and locale-specific voice
  continuity.

Existing Renku coverage is partial:

- `screenplay-drafter` can add or revise cast records through screenplay
  operations.
- `media-producer` can generate `cast.character-sheet` and `cast.profile` media
  after a cast member exists.
- Studio/core can read cast design resources and attached assets.

Main gap:

There is no dedicated `casting-director` skill and no first-class cast authoring
CLI. Cast mutations currently go through `renku screenplay apply` using
`castMember.add`, `castMember.update`, `castMember.delete`, or
`castMember.move`. That works, but it makes casting feel like a screenplay
side-effect instead of a department workflow.

### Location, Staging, And Production Design

The user's "Location/Staging" category should be treated as a production design
department, with location work as one major part of it.

It should own:

- choosing and refining story locations;
- location visual notes, time period, and practical constraints;
- environment sheets and selected location views;
- set dressing, props, surfaces, signage, furniture, vehicles, and atmosphere;
- scene-specific staging configurations;
- blocking constraints that affect shots;
- continuity references for objects, costumes, symbols, and recurring spaces.

Existing Renku coverage is partial:

- `screenplay-drafter` can add or revise location records through screenplay
  operations.
- `media-producer` can generate `location.environment-sheet` media after a
  location exists.
- Shot design can reference locations and azimuth views.
- Studio/core can read location resources and selected location assets.

Main gap:

There is no dedicated `production-designer` skill, and no first-class
production-design authoring CLI. Location mutations currently go through
`renku screenplay apply` using `location.add`, `location.update`,
`location.delete`, or `location.move`. Scene-specific staging, set dressing,
prop continuity, and blocking constraints are not durable first-class project
data yet.

### Directing

Directing should be the top-level creative decision layer for scenes and shots.
It includes:

- reading the screenplay scene as dramatic action;
- deciding what the audience must know, feel, and notice;
- shaping performance, blocking, coverage, rhythm, and camera emphasis;
- splitting scenes into shot lists;
- coordinating shot-list iteration, storyboard images, shot references, and
  video takes;
- making tradeoffs between story clarity, visual language, continuity, and
  generation cost.

Existing Renku coverage:

- `scene-shot-designer` for scene-owned coverage plans.
- `media-producer` for storyboard sheets, first/last frames, reference images,
  multi-shot storyboard sheets, and final shot video takes.
- Plan `0051` covers iterative shot-list operations and per-shot storyboard
  images.

Main gap:

There is no top-level director skill that tells the user when to revise the
script, when to change the Lookbook, when to refine cast/location design, when
to update shots, and when it is safe to generate media.

### Missing Or Future Departments

The director sidekick should acknowledge these departments even if it cannot
fully execute them yet:

- **Producer / production coordinator**: dependency order, approvals, cost
  estimates, selects, production exports, and scope control.
- **Production designer / art department**: set dressing, props, costume
  coordination, graphic elements, and location treatment.
- **Costume designer**: cast-specific and sequence-specific wardrobe continuity.
- **Voice director / sound**: voice casting, voice samples, narration, dialogue,
  localization, dubbing, and future sound/music work.
- **Editor / post**: final clip sequencing, selects, trims, timing, continuity,
  sound, captions, and production export.
- **Continuity supervisor**: visual consistency across cast, locations, shots,
  generated references, and final takes.

The first `movie-director` skill does not need to implement all of these. It
does need to name them clearly so it can tell the user what is supported today
and what needs a future implementation slice.

## Proposed Skill Shape

Create this skill in the external Studio Skills project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director
```

Use the skill-creator initializer during implementation:

```bash
/Users/keremk/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  movie-director \
  --path /Users/keremk/Projects/aitinkerbox/studio-skills/skills \
  --resources references
```

Proposed folder shape:

```text
movie-director/
  SKILL.md
  agents/
    openai.yaml
  references/
    department-map.md
    workflow-playbooks.md
    cli-coverage-and-gaps.md
    specialist-handoff-checklists.md
```

Do not add scripts in the first slice. Routing and planning are judgment-heavy,
and the deterministic work already belongs to the CLI and specialist skills.

### Frontmatter

Proposed `SKILL.md` frontmatter:

```yaml
---
name: movie-director
description: Coordinate Renku Studio movie-making workflows across screenplay, analysis, visual language, casting, locations/staging, scene shot design, media generation, and production readiness. Use when the user wants a top-level filmmaking sidekick, asks what to do next, wants to make or revise a movie across multiple departments, needs help choosing which Renku Studio skill to use, or asks for director-like guidance that dispatches to specialist skills such as screenplay-drafter, screenplay-analyst, inspiration-analyzer, lookbook-designer, scene-shot-designer, and media-producer.
---
```

### Main SKILL.md Responsibilities

Keep `SKILL.md` short and operational:

1. Resolve the current project and Studio selection when the user refers to the
   selected project item.
2. Classify the user's request by department.
3. Check prerequisites before dispatching.
4. Load only the relevant reference file.
5. Invoke or hand off to the right specialist skill.
6. Preserve explicit user choices, especially generation model choices,
   parameters, selected assets, costs, and approvals.
7. Report unsupported department gaps honestly and propose the next concrete
   supported action.

### Reference Files

`references/department-map.md`

- Map user intent to departments and specialist skills.
- Include current Renku commands for each department.
- Include "unsupported today" notes for casting, production design, voice, and
  post.

`references/workflow-playbooks.md`

- Give end-to-end workflow recipes.
- Examples:
  - idea to first screenplay;
  - screenplay critique to revision;
  - references to active Lookbook;
  - cast member to character sheet and profile;
  - location to environment sheet and selected views;
  - scene to shot list to storyboard images;
  - storyboard references to shot video take;
  - scene rewrite to updated shots.

`references/cli-coverage-and-gaps.md`

- Record current supported CLI commands.
- List hard gaps and proposed command shapes.
- Make it clear when a workflow must use `screenplay-drafter` as a temporary
  route because no department-specific command exists.

`references/specialist-handoff-checklists.md`

- Define what context the director skill should pass to each specialist.
- Define what to read back after each specialist completes work.
- Include approval gates for paid generation.

## Proposed Director Workflow

The director skill should follow this loop:

1. **Orient**
   - Read or confirm the current project.
   - If the user refers to "selected", "current", or "this", read Studio focus.
   - Read only the minimum current state needed for the request.

2. **Diagnose**
   - Decide whether the user is asking for story, analysis, visual language,
     casting, location/staging, shot design, media generation, or production
     readiness.
   - Identify prerequisites.
   - Identify unsupported or partially supported department surfaces.

3. **Dispatch**
   - Use the specialist skill that owns the artifact.
   - Do not directly write screenplay, analysis, Lookbook, shot-list, or media
     generation JSON when a specialist skill owns that work.
   - For casting and location/staging, use the current fallback only when it is
     the best available path and explain the limitation.

4. **Verify**
   - Read back durable state through the CLI.
   - Confirm the active analysis, Lookbook, shot list, selected cast/location
     asset, generation spec, or imported media as appropriate.

5. **Advance**
   - Suggest the next department step.
   - Do not force a linear process if the user wants to jump into a specific
     area.
   - Keep paid generation behind explicit estimate and approval.

## End-To-End Production Ladder

The director skill should use this as the default mental model, while allowing
the user to enter at any point:

1. Project brief and constraints.
2. Screenplay draft.
3. Screenplay analysis and targeted revisions.
4. Cast and location foundation.
5. Inspiration folders and Inspiration Analysis.
6. Active Lookbook.
7. Cast character sheets, cast profiles, and location environment sheets.
8. Scene Shot Lists.
9. Per-shot storyboard images.
10. Shot reference images, first/last frames, and multi-shot storyboard inputs.
11. Shot video takes.
12. Selects, production export, and future post/editorial work.

Expected behavior example:

If the user says, "Make this scene cinematic and generate it," the director
skill should not jump straight to `shot.video-take`. It should check:

- Does the scene exist?
- Is the screenplay scene final enough?
- Is there an active Lookbook?
- Are referenced cast and locations visually established?
- Does the scene have an active Scene Shot List?
- Are storyboard/reference inputs available?
- Has the user approved cost for paid generation?

Then it should dispatch to the missing next specialist.

## Current Skill Dispatch Map

| User intent | Primary specialist | Current CLI status | Notes |
| --- | --- | --- | --- |
| Create or revise screenplay | `screenplay-drafter` | Strong | Uses `renku screenplay create/apply/scene revise`. |
| Critique screenplay | `screenplay-analyst` | Strong | Uses `renku screenplay analyze`. |
| Analyze visual reference folders | `inspiration-analyzer` | Strong | Uses `renku inspiration analysis`. |
| Create or revise Lookbook | `lookbook-designer` | Strong | Uses `renku lookbook`. |
| Generate Lookbook media | `media-producer` | Strong | Uses `lookbook.image` and `lookbook.sheet`. |
| Create or revise cast facts | Planned `casting-director`; fallback `screenplay-drafter` | Partial | Current mutation path is `screenplay apply` with `castMember.*` operations. |
| Generate cast visuals | `media-producer` | Strong after cast exists | Uses `cast.character-sheet` and `cast.profile`. |
| Create or revise locations, staging, set dressing, props, or production design | Planned `production-designer`; fallback `screenplay-drafter` for location facts only | Partial | Current durable mutation path is `screenplay apply` with `location.*` operations. Broader production design needs 0053. |
| Generate location visuals | `media-producer` | Strong after location exists | Uses `location.environment-sheet`. |
| Create scene shot list | `scene-shot-designer` | Strong | Uses `renku screenplay shot-list`. |
| Iterate shot list | `scene-shot-designer` | Planned/active in 0051 | Operation support exists in current code, but skills/docs need alignment. |
| Generate storyboard images | `media-producer` with `scene-shot-designer` handoff | Strong but skill ownership needs alignment | Core treats `scene.storyboard-sheet` as temporary sheet generation and durable per-shot import. |
| Generate final shot video take | `media-producer` | Strong in current media-purpose architecture | Requires explicit generation spec, estimate, approval token, run, inspection, and import. |
| Voice casting, sound, music, edit | Future skills | Weak or absent | The director skill should name the gap and avoid pretending it is solved. |

## CLI Coverage And Gaps

### Strong Existing Coverage

Screenplay:

- `renku screenplay status`
- `renku screenplay show`
- `renku screenplay validate`
- `renku screenplay create`
- `renku screenplay apply`
- `renku screenplay scene revise`
- `renku screenplay revision list/show/restore`
- `renku screenplay cast list/show`
- `renku screenplay location list/show`
- `renku screenplay act list/show`
- `renku screenplay sequence list/show`
- `renku screenplay scene list/show`

Screenplay Analysis:

- `renku screenplay analyze context`
- `renku screenplay analyze list/show/validate/write/set-active`

Scene Shot Lists:

- `renku screenplay shot-list context/list/show/validate/write/set-active`
- `renku screenplay shot-list validate-operations/apply`
- `renku screenplay shot-list storyboard status`

Visual Language:

- `renku inspiration list/create/show/rename/reorder/delete`
- `renku inspiration analysis show/validate/write`
- `renku lookbook list/show/validate/create/update/rename/delete`
- `renku lookbook set-active/clear-active`
- `renku lookbook inspiration list/set`
- `renku lookbook image set-sections/delete`
- `renku lookbook card-image set/clear`

Media Generation:

- `renku generation context`
- `renku generation model list`
- `renku generation spec validate/create/update/show/list`
- `renku generation estimate`
- `renku generation run`
- `renku generation preflight`
- `renku generation input list/select/clear`
- `renku generation production update`

Media Import:

- `renku media import --purpose lookbook.image`
- `renku media import --purpose lookbook.sheet`
- `renku media import --purpose cast.character-sheet`
- `renku media import --purpose cast.profile`
- `renku media import --purpose location.environment-sheet`
- `renku media import --purpose scene.storyboard-sheet`
- `renku media import --purpose shot.first-frame`
- `renku media import --purpose shot.last-frame`
- `renku media import --purpose shot.reference-image`
- `renku media import --purpose shot.multi-shot-storyboard-sheet`
- `renku media import --purpose shot.video-take`

### Required: Top-Level Director Context Command

The director skill can read many separate surfaces, but there is no single
agent-facing command that answers:

- What project is open?
- What Studio surface is selected?
- Does a screenplay exist?
- Is there an active Screenplay Analysis?
- Is there an active Lookbook?
- How many cast members and locations have selected visual references?
- Which selected scene has an active shot list?
- Which shots are missing storyboard images or required shot-video inputs?
- What is the next best supported step?

Add this command in the `movie-director` implementation slice:

```bash
renku director context --json
```

This should be read-only and core-owned. It should not be a compatibility alias
or a thin re-export of several commands. It should produce one deliberate
director-readiness projection.

Proposed CLI surface:

```bash
renku director context --json
renku director context --selection <studio-selection-json> --json
```

The base command reads the current authoring project and current Studio focus
when available. The `--selection` form is optional and useful for tests,
automation, and future agent workflows that need deterministic target discovery.
It should accept the same selection shape used by Studio selection context.

Proposed core report shape:

```ts
export interface DirectorContextReport {
  project: {
    name: string;
    id: string;
    title: string;
    aspectRatio: string;
  };
  currentSelection: StudioSelectionContextResult | null;
  screenplay: DirectorScreenplayReadiness;
  visualLanguage: DirectorVisualLanguageReadiness;
  cast: DirectorCastReadiness;
  productionDesign: DirectorProductionDesignReadiness;
  selectedScene: DirectorSceneReadiness | null;
  nextSteps: DirectorNextStep[];
  resourceKeys: string[];
}
```

Readiness sections should summarize state without duplicating full resources:

- `screenplay`: whether a screenplay exists, active Screenplay Analysis id, and
  open critique status when available.
- `visualLanguage`: Inspiration folder count, Lookbook count, active Lookbook
  id, and whether visual direction is ready for generation.
- `cast`: cast count and whether every cast member has selected character-sheet
  or profile media.
- `productionDesign`: location count and whether every location has selected
  environment-sheet media.
- `selectedScene`: selected scene id, active shot-list id, storyboard status,
  missing storyboard shots, and shot-video preflight availability when the
  selected surface is a scene or shot.
- `nextSteps`: ordered agent-readable recommendations such as
  `draft-screenplay`, `analyze-screenplay`, `create-lookbook`,
  `design-cast`, `design-production`, `design-shot-list`,
  `generate-storyboards`, or `generate-shot-video`.

Package responsibilities:

- `packages/core` owns the projection, readiness rules, and structured
  diagnostics.
- `packages/cli` exposes `renku director context` as a thin command handler.
- `packages/studio` does not need to call the command in this slice, but the
  report should use existing resource keys so Studio refresh behavior remains
  consistent if the projection is later exposed in the UI.
- The `movie-director` skill uses this command as its first preflight when the
  user asks "what next?", "make this scene", "continue", or anything that
  spans more than one department.

The command must fail fast when there is no current project. It should return
structured diagnostics for stale Studio focus, missing screenplay state, missing
active Lookbook, missing active shot list, or missing selected media. It should
not infer old project shapes or silently fall back to obsolete names.

### Gap 2: No First-Class Cast Authoring Command

Current route:

```bash
renku screenplay apply --file <screenplay-operations-json> --json
```

with operations such as:

- `castMember.add`
- `castMember.update`
- `castMember.delete`
- `castMember.move`

This is valid but awkward for a casting workflow. It also pushes casting agents
to read the full screenplay operation contract even when they only need to
refine one cast member.

Planned command family in
`plans/active/0053-casting-director-and-production-designer.md`:

```bash
renku cast list --json
renku cast show <cast-member-id> --json
renku cast context --cast <cast-member-id> --json
renku cast validate --file <cast-operations-json> --json
renku cast apply --file <cast-operations-json> --json
```

The contract should be a real cast-specific authoring contract, not an alias
that exists only to avoid `screenplay apply`. It should own cast-specific
diagnostics, resource keys, and context. It may share persistence internals with
screenplay operations as long as the public command shape is deliberate.

This enables `casting-director` to own:

- cast member interpretation;
- cast sheet readiness;
- costume notes;
- visual continuity;
- future voice notes and voice variants.

### Gap 3: No First-Class Production Design Authoring Command

Current route:

```bash
renku screenplay apply --file <screenplay-operations-json> --json
```

with operations such as:

- `location.add`
- `location.update`
- `location.delete`
- `location.move`

This is valid but too narrow for production design. It cannot yet represent
scene-specific staging, set dressing, props, or blocking constraints as durable
department work.

Planned location fact command family in
`plans/active/0053-casting-director-and-production-designer.md`:

```bash
renku location list --json
renku location show <location-id> --json
renku location context --location <location-id> --json
renku location validate --file <location-operations-json> --json
renku location apply --file <location-operations-json> --json
```

Planned production-design command families in
`plans/active/0053-casting-director-and-production-designer.md`:

```bash
renku production-design location context --location <location-id> --json
renku production-design location validate --file <location-design-json> --json
renku production-design location write --file <location-design-json> --json

renku production-design staging context --scene <scene-id> --json
renku production-design staging validate --file <scene-staging-json> --json
renku production-design staging write --file <scene-staging-json> --json
```

Do not add production-design commands until the domain contracts are real. A
command that only wraps location notes would violate the goal of explicit,
reviewable contracts.

### Gap 4: No Dedicated Casting Skill

Create a future external skill:

```text
casting-director
```

It should handle:

- cast member creation and revision;
- role interpretation from screenplay context;
- character sheet brief creation;
- costume and appearance direction;
- continuity across scenes and sequences;
- handoff to `media-producer` for `cast.character-sheet` and `cast.profile`;
- future voice casting, voice samples, and locale-specific voice variants.

Until the CLI gap is closed, the skill can use `screenplay-drafter` for durable
cast mutations and `media-producer` for generated cast media.

Detailed implementation planning for this skill and its backing CLI/core work
lives in `plans/active/0053-casting-director-and-production-designer.md`.

### Gap 5: No Dedicated Production Designer Skill

Create a future external skill:

```text
production-designer
```

It should handle:

- location creation and revision;
- production design treatment for spaces;
- set dressing, prop, and atmosphere notes;
- scene-specific stage configuration;
- handoff to `media-producer` for `location.environment-sheet`;
- handoff to `scene-shot-designer` when staging changes affect coverage.

Until the CLI gap is closed, the skill can use `screenplay-drafter` for durable
location mutations and `media-producer` for generated location media.

Detailed implementation planning for this skill and its backing CLI/core work
lives in `plans/active/0053-casting-director-and-production-designer.md`.

### Gap 6: Costume And Voice Are Not First-Class Yet

Current cast fields include:

- `role`
- `age`
- `want`
- `need`
- `arc`
- `voiceNotes`
- `description`

That is enough for basic cast facts, but not enough for:

- scene/sequence costume variants;
- wardrobe continuity;
- costume reference sets;
- voice samples;
- locale-specific voice variants;
- casting comparison options.

The director skill should keep these under the casting department. It can
capture lightweight notes in current cast descriptions or voice notes only when
that is useful and honest. It should not propose a separate `voice-director`
skill unless a future audio/localization plan deliberately splits that work out
of casting.

### Gap 7: Post, Sound, And Editorial Are Not Covered

Current workflows can generate and import media, select assets, and export
production assets. They do not yet provide a full editor, sound designer, music,
captioning, dubbing, or final assembly skill.

The director skill should:

- avoid promising final edit behavior that does not exist;
- use production export only when the user asks for handoff-ready assets;
- identify future skill needs such as `editor` or `sound-director`.

### Gap 8: Skill Ownership Needs Alignment Around Storyboard Sheets

`scene-shot-designer/SKILL.md` says storyboard media should hand off to
`media-producer`. `docs/architecture/reference/studio-skills.md` still says
`scene-shot-designer` optionally creates one `scene.storyboard-sheet` generation
spec and handles slicing/import.

The accepted direction from current media architecture and plan `0051` is:

- Scene Shot Lists store coverage, not generated image paths.
- `scene.storyboard-sheet` can generate a temporary composite.
- Durable storage keeps per-shot storyboard images.
- The operational slicing/import owner should be stated consistently across
  the skill docs and architecture reference.

The `movie-director` skill should not paper over this discrepancy. The
implementation should align the docs before forward-testing the director skill.

## Proposed Implementation Slices

### Slice 1: Create The Movie Director Skill

Create:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director
```

Use `skill-creator/scripts/init_skill.py`, then replace the template content.

The first version should:

- classify user requests by department;
- know the current specialist skill map;
- know the current CLI-backed workflow ladder;
- ask only for missing choices that materially change the next action;
- dispatch to existing skills;
- report cast/location/staging/voice/post gaps clearly.

### Slice 2: Add CLI Coverage Reference And Update Existing Skill Docs

Update external skill references so the director skill and specialist skills
agree on:

- current CLI commands;
- media generation ownership;
- storyboard sheet slicing and import ownership;
- cast/location fallback through screenplay operations;
- unsupported department gaps.

Update `docs/architecture/reference/studio-skills.md` if the accepted ownership
language is stale.

### Slice 3: Add Director Readiness Projection

Add the core-owned read-only projection:

```bash
renku director context --json
```

The projection should summarize readiness, not mutate data. It should become
the preferred first read for the `movie-director` skill.

### Slice 4: Plan Casting And Production Design Separately

Use `plans/active/0053-casting-director-and-production-designer.md` for:

- `casting-director`;
- `production-designer`;
- cast-specific CLI/core authoring;
- production-design CLI/core authoring;
- durable staging and prop/set-dressing contract questions;
- voice casting under the casting department.

Do not implement cast or production-design commands inside the first
`movie-director` slice except where the director context projection needs a
read-only readiness summary.

## Example Director Skill Behaviors

### Idea To First Movie Draft

User:

```text
I have an idea for a 7 minute paranoid thriller in a train station. Help me make
it into a movie.
```

Expected director behavior:

1. Gather missing brief details only if they materially affect the screenplay.
2. Dispatch to `screenplay-drafter`.
3. Read back screenplay status.
4. Recommend `screenplay-analyst` for critique.
5. Recommend Inspiration/Lookbook work before generating cast/location/shot
   media.

### Existing Scene To Shot Video

User:

```text
Generate the selected scene.
```

Expected director behavior:

1. Read Studio current selection.
2. Confirm a valid scene.
3. Check active Lookbook and active Scene Shot List.
4. If no shot list exists, dispatch to `scene-shot-designer`.
5. If storyboard or shot-video dependencies are missing, dispatch to
   `media-producer` in dependency order.
6. Stop before paid generation unless the user approves the spec and estimate.

### Cast Refinement

User:

```text
Make Ada feel more severe, older, and less polished. Update the character sheet.
```

Expected director behavior today:

1. Explain that cast authoring is currently routed through screenplay
   operations.
2. Dispatch durable cast fact changes through `screenplay-drafter`.
3. Dispatch visual generation through `media-producer` with
   `cast.character-sheet`.
4. Read back the cast member and imported/selectable assets.

Expected behavior after future gap closure:

1. Dispatch cast fact changes to `casting-director`.
2. Use cast-specific CLI context and validation.
3. Dispatch visual media to `media-producer`.

### Location And Staging Refinement

User:

```text
The control room should feel cramped and ceremonial. Stage it for a tense
two-person confrontation.
```

Expected director behavior today:

1. Separate location description from scene staging.
2. Use `screenplay-drafter` only for durable location or scene text changes.
3. Use `media-producer` for `location.environment-sheet` if a location exists
   and an active Lookbook exists.
4. Use `scene-shot-designer` for coverage and blocking implied by the staging.
5. Explain that durable staging documents are not first-class yet.

## Risks

### Orchestrator Skill Becomes Too Broad

If `movie-director/SKILL.md` copies specialist instructions, it will become too
large and stale.

Mitigation:

- Keep `SKILL.md` focused on routing and coordination.
- Put department maps and playbooks in references.
- Link to specialist skills instead of duplicating their contracts.

### Director Skill Masks Unsupported Work

The biggest product risk is making the user think casting, production design,
voice, or editing are fully supported when they are not.

Mitigation:

- Include explicit gap language.
- Provide supported fallback routes.
- Prefer "we can update the cast record and generate a character sheet" over
  "we have a full casting department" until the gaps are closed.

### Cast And Location Commands Become Wrappers

Adding `renku cast apply` or `renku location apply` could accidentally become a
thin alias over screenplay operations.

Mitigation:

- Design cast/location command documents as real domain contracts.
- Give them cast/location-specific context, validation, diagnostics, resource
  events, and tests.
- Share internal persistence only where the ownership is clear.

### Paid Generation Gets Triggered Too Early

A top-level director skill may be tempted to "make the movie" by jumping to
generation.

Mitigation:

- Keep the media-producer estimate and approval gate non-negotiable.
- Require generation specs before cost estimates and approval tokens before
  runs.
- Inspect generated media before import.

### Skill Dispatch Is Ambiguous

Some requests genuinely cross departments.

Mitigation:

- Let the director skill choose a sequence of specialists.
- Use screenplay as source of narrative truth.
- Use active Lookbook as source of visual direction.
- Use shot lists as source of scene coverage.
- Use media generation only after the source artifact exists.

## Resolved Review Questions

1. The top-level skill is named `movie-director`.
2. `casting-director` and `production-designer` are planned as follow-up
   specialist skills in plan `0053`.
3. `renku director context --json` belongs in this plan.
4. The location/staging department skill is named `production-designer`.
5. Future voice work remains under `casting-director`.

## Completion Checklist

### Review Area

- [x] Confirm the skill name: `movie-director`.
- [x] Confirm that the skill belongs in
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills`.
- [x] Confirm that the first implementation creates the director skill,
  references, and director context planning, not cast/production-design mutation
  commands.
- [x] Confirm the department vocabulary: Screenwriting, Cinematography, Casting,
  Production Design, Directing, Production Coordination, Voice/Sound, Editorial.
- [x] Decide that location/staging work is named Production Design in
  user-facing skill language.

### Existing Skill Alignment

- [x] Re-read `screenplay-drafter/SKILL.md` and confirm cast/location fallback
  wording matches the current screenplay operation contract.
- [x] Re-read `scene-shot-designer/SKILL.md` and `media-producer/SKILL.md` and
  settle storyboard sheet handoff ownership.
- [x] Update `docs/architecture/reference/studio-skills.md` if its storyboard
  ownership language is stale.
- [x] Confirm every existing specialist skill still validates after any wording
  update.
- [x] Avoid duplicating specialist JSON contracts inside the director skill.

### Movie Director Skill Implementation

- [x] Run `skill-creator/scripts/init_skill.py` for `movie-director` with
  `--resources references`.
- [x] Write `movie-director/SKILL.md` with frontmatter that clearly triggers for
  top-level movie-making coordination.
- [x] Add `references/department-map.md`.
- [x] Add `references/workflow-playbooks.md`.
- [x] Add `references/cli-coverage-and-gaps.md`.
- [x] Add `references/specialist-handoff-checklists.md`.
- [x] Generate or refresh `agents/openai.yaml` from the final skill content.
- [x] Keep `SKILL.md` lean enough for progressive disclosure.
- [x] Do not create scripts unless a deterministic repeated operation appears
  during implementation.

### Director Routing Behavior

- [x] Document how the director skill resolves the current project.
- [x] Document how the director skill uses `renku studio current --json` or
  Studio selection context when the user says "selected" or "current".
- [x] Document how it chooses `screenplay-drafter`.
- [x] Document how it chooses `screenplay-analyst`.
- [x] Document how it chooses `inspiration-analyzer`.
- [x] Document how it chooses `lookbook-designer`.
- [x] Document how it chooses `scene-shot-designer`.
- [x] Document how it chooses `media-producer`.
- [x] Document the current fallback for cast authoring.
- [x] Document the current fallback for location authoring.
- [x] Document unsupported voice, sound, music, editing, and final assembly
  work.

### CLI Gap Planning

- [x] Decide to plan `renku director context --json` in this plan.
- [x] Define the read-only director readiness report shape in enough detail for
  implementation.
- [x] Add the core-owned director context projection.
- [x] Add the CLI `director context` command handler.
- [x] Add structured diagnostics for missing current project, stale focus, and
  missing department prerequisites.
- [x] Move `renku cast context/validate/apply` planning to plan `0053`.
- [x] Move production-design authoring command planning to plan `0053`.
- [x] Ensure any new CLI command is a real domain contract, not a wrapper or
  compatibility alias.
- [x] Use structured diagnostics for missing prerequisites and invalid
  department state.

### Future Specialist Skills

- [x] Decide to create `casting-director` in a follow-up plan.
- [x] If creating it, define its relationship to `screenplay-drafter` and
  `media-producer`.
- [x] Decide to create `production-designer` in a follow-up plan.
- [x] If creating it, define how location facts, set dressing, props, blocking,
  and environment sheets are separated.
- [x] Decide that voice casting remains under casting.
- [x] Decide not to name editorial/post yet; revisit `editor` versus
  `post-producer` after final assembly exists.

### Validation And Forward Testing

- [x] Run `quick_validate.py` on `movie-director`.
- [x] Run `quick_validate.py` on any specialist skills touched during alignment.
- [x] Forward-test the director skill with an "idea to movie" prompt.
- [x] Forward-test the director skill with a "selected scene to shot video"
  prompt.
- [x] Forward-test the director skill with a cast refinement prompt.
- [x] Forward-test the director skill with a location/staging refinement prompt.
- [x] Confirm the skill does not trigger paid generation without an estimate and
  approval token.
- [x] Confirm the skill does not directly write department JSON when a
  specialist skill owns that artifact.

### Documentation And Final Verification

- [x] Update this plan status when implementation begins.
- [x] If implementation changes accepted architecture, summarize the decision in
  `docs/` rather than leaving only this active plan.
- [x] Run focused tests for any CLI/core code touched by later gap work.
- [x] Run focused skill validation after external skill edits.
- [x] Confirm no package-management commands were needed.
- [x] Confirm no obsolete compatibility aliases or re-export stubs were added.
- [x] Confirm all final commands and file paths in skill docs match current CLI
  behavior.
