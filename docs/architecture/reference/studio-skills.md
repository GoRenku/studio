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

- Creates or revises durable Movie Lookbooks and Storyboard Lookbooks.
- Uses Inspiration folders, existing analyses, named references, screenplay
  context, and user direction as source context.
- Writes validated `kind: "movieLookbook"` or `kind: "storyboardLookbook"`
  JSON through the CLI.
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
- Owns Cast Voice attachment guidance through `renku cast voice attach` when a
  provider voice id and sample audio are ready.
- Keeps provider voice ids and sample assets in Cast Voice records, not Cast
  Design JSON.
- Hands `cast.video-character-sheet`, `cast.storyboard-character-sheet`, and `cast.profile` generation to
  `media-producer`.
- Hands `cast.voice-sample` generation to `media-producer` when the user wants
  Renku to create the sample audio.

`production-designer`

- Creates and revises Location facts through `renku location`.
- Writes validated `kind: "locationDesign"` JSON through
  `renku production-design`.
- Owns spatial design, architecture, set dressing, materials, props,
  atmosphere, and continuity risks.
- Hands `location.sheet` and `location.hero` generation to `media-producer`.

`media-producer`

- Generates purpose-specific media from Renku context.
- Authors one generic `GenerationSpec` from Core context and Engines-owned
  provider field descriptors.
- Preserves stable guide placement ids and separately assigns every included
  exact reference to a real provider media field.
- Treats `facts.contextText` as opaque authored source context and keeps
  continuity relevance, Shot batching, and creative fallback decisions in the
  agent workflow.
- Uses exact registered `asset-file` references or normalized `project-file`
  references; it never invents asset identities or provenance.
- Creates or updates persisted generation specs only after the draft request is
  explicit enough to review.
- Estimates cost and runs only approved specs.
- Imports finished files only through current focused attachment purposes.
- For `shot.video-take`, reads the exact Core purpose context for `take:<id>`,
  places exact Shot/Lookbook/Cast/Location/dialogue references in stable guide
  slots, and assigns them to real provider fields before validation.
- For ad hoc Shot reference images, authors separate generic `image.create`
  specs and reuses the exact output path as a `project-file` reference until a
  current focused destination attaches it. External media uses the same exact
  file contract without a synthetic spec or receipt.
- Treats Lookbook Image import and Lookbook section/point placement as separate
  owning commands.
- Shows one or more ordinary requests in the Generation Preview Dialog with
  repeated `--file` values for transient specs or repeated `--spec` values for
  saved specs. Multi-request display never combines estimates, approvals, or
  runs.
- For `scene.storyboard-sheet`, reads the exact Scene Shot List, batches one to
  four Shots, inspects and includes the relevant selected Storyboard Lookbook,
  Cast, and Location references, and stops for user direction when needed
  continuity media is unavailable.
- Generates `cast.voice-sample` audio with direct ElevenLabs models and hands
  the output to `casting-director` for `renku cast voice attach`.

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
  referenced cast, referenced locations, selected Movie Lookbook guidance, and
  active shot list history.
- Writes validated `kind: "sceneShotList"` JSON through the CLI.
- Hands storyboard image requests to `media-producer` after a valid Scene Shot
  List exists and uses a selected Storyboard Lookbook when available. The
  media-producer skill owns
  non-blocking Storyboard Lookbook Sheet guidance, `scene.storyboard-sheet`
  generation specs, visual inspection, slicing, and per-shot storyboard image
  import.

## Skill Rules

Skills may inspect project files and media when those files are content. Skills
must call Renku commands for metadata mutations.

Skills must not:

- write directly to `.renku/project.sqlite`;
- invent IDs or relationships;
- use obsolete command aliases;
- register Inspiration folder images as assets;
- store absolute paths in authored JSON documents;
- run paid generation without estimate review and explicit live provider approval;
- override user-selected generation controls.
- store generated storyboard image paths inside Scene Shot List JSON;
- add analog shooting logistics such as setup minutes, crew assignments, or
  call-sheet timing to Scene Shot List documents.
- mutate Cast Members or Locations through screenplay operation documents;
- store generated media paths inside Cast Design or Location Design JSON;
- treat costume variants, props, or set dressing as media targets until those
  concepts have explicit durable media contracts.
- store generated Cast Voice sample paths inside Cast Design JSON. Cast Voice
  samples are attached through `renku cast voice attach`.

## Reference Structure

Each skill should keep `SKILL.md` short and operational. Detailed CLI workflows,
JSON contracts, craft guidance, and samples belong in the skill's
`references/` and `samples/` folders.

When a Renku architecture contract changes, update the architecture/reference
docs and CLI docs in this repository first, then update the external skill
references to match the current contract.
