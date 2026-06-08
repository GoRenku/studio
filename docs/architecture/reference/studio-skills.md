# Studio Skills

Date: 2026-05-26

Status: current

Role: reference

## Purpose

This reference defines how Renku Studio architecture relates to the external
Studio Skills project.

Decision history:

- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

## Skills Location

The current Studio Skills project lives outside this repository:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Architecture and CLI contracts live in this repository. Skill files are
operational companions that teach agents how to use those contracts.

## Current Skills

`inspiration-analyzer`

- Analyzes a Visual Language Inspiration folder from stored image files.
- Uses `renku inspiration show` to get folder context.
- Uses shell commands inside `folder.absolutePath` to inspect images.
- Writes validated `kind: "inspirationAnalysis"` JSON through the CLI.

`lookbook-designer`

- Creates or revises durable Visual Language Lookbooks.
- Uses Inspiration folders, existing analyses, named references, screenplay
  context, and user direction as source context.
- Writes validated `kind: "lookbook"` JSON through the CLI.
- Hands generated image requests to `media-producer`.

`screenplay-analyst`

- Analyzes the current screenplay through `renku screenplay analyze`.
- Reads ordered acts, sequences, scenes, cast, locations, and default analysis
  criteria from the CLI context command.
- Writes validated `kind: "screenplayAnalysis"` JSON through the CLI.
- Suggests scene additions or revisions as critique only; it does not mutate the
  screenplay graph.

`casting-director`

- Creates and revises Cast Member facts through `renku cast`.
- Writes validated `kind: "castDesign"` JSON through `renku cast design`.
- Owns casting interpretation, appearance, performance, costume continuity,
  voice casting notes, and cast media readiness.
- Hands `cast.character-sheet` and `cast.profile` generation to
  `media-producer`.

`production-designer`

- Creates and revises Location facts through `renku location`.
- Writes validated `kind: "locationDesign"` JSON through
  `renku production-design`.
- Owns spatial design, architecture, set dressing, materials, props,
  atmosphere, and continuity risks.
- Hands `location.environment-sheet` generation to `media-producer`.

`media-producer`

- Generates purpose-specific media from Renku context.
- Creates or updates persisted generation specs.
- Estimates cost and runs only approved specs.
- Imports finished files separately with `renku media import`.

`movie-director`

- Coordinates screenplay, analysis, visual language, cast, production design,
  shot design, media generation, and production readiness workflows.
- Starts broad or cross-department requests with `renku director context`.
- Dispatches durable artifact work to specialist skills instead of writing
  department documents directly.
- Routes cast work to `casting-director`, production-design/location work to
  `production-designer`, shot coverage to `scene-shot-designer`, and media
  generation to `media-producer`.

`scene-shot-designer`

- Designs and persists Scene Shot Lists for individual screenplay scenes.
- Uses `renku screenplay shot-list context` to read screenplay blocks,
  referenced cast, referenced locations, active Lookbook text, and active shot
  list history.
- Writes validated `kind: "sceneShotList"` JSON through the CLI.
- Hands storyboard image requests to `media-producer` after a valid Scene Shot
  List exists. The media-producer skill owns `scene.storyboard-sheet` generation
  specs, visual inspection, slicing, and per-shot storyboard image import.

## Skill Rules

Skills may inspect project files and media when those files are content. Skills
must call Renku commands for metadata mutations.

Skills must not:

- write directly to `.renku/project.sqlite`;
- invent IDs or relationships;
- use obsolete command aliases;
- register Inspiration folder images as assets;
- store absolute paths in authored JSON documents;
- run paid generation without an estimate and approval token;
- override user-selected generation controls.
- store generated storyboard image paths inside Scene Shot List JSON;
- add analog shooting logistics such as setup minutes, crew assignments, or
  call-sheet timing to Scene Shot List documents.
- mutate Cast Members or Locations through screenplay operation documents;
- store generated media paths inside Cast Design or Location Design JSON;
- treat costume variants, voice samples, props, or set dressing as media targets
  until those concepts have explicit durable media contracts.

## Reference Structure

Each skill should keep `SKILL.md` short and operational. Detailed CLI workflows,
JSON contracts, craft guidance, and samples belong in the skill's
`references/` and `samples/` folders.

When a Renku architecture contract changes, update the architecture/reference
docs and CLI docs in this repository first, then update the external skill
references to match the current contract.
