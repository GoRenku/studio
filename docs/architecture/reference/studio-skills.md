# Studio Skills

Date: 2026-08-06

Status: current

Role: reference

## Purpose

This reference defines how Renku Studio architecture relates to the external
Studio Skills project.

Decision history:

- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `../../decisions/0071-use-scene-first-screenplay-and-direct-project-story-metadata.md`
- `../../decisions/0072-use-hierarchy-independent-screenplay-analysis.md`
- `../../decisions/0074-use-core-owned-project-workflow-settings.md`

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

- Creates or revises durable Production Lookbooks and Storyboard Lookbooks.
- Uses Inspiration folders, existing analyses, named references, screenplay
  context, and user direction as source context.
- Writes validated `kind: "productionLookbook"` or `kind: "storyboardLookbook"`
  JSON through the CLI.
- Hands generated image requests to `media-producer`.

`screenplay-drafter`

- Creates and revises the Scene-first Screenplay through `renku screenplay`.
- Imports and automatically refreshes FDX-backed Screenplays as flat,
  source-authoritative Scene lists; it never edits or partially merges them.
- Stores story/development metadata on direct Project fields through
  `renku info`, not in duplicate Screenplay metadata.
- Authors plain screenplay text and binds existing Cast Members, Locations,
  and Props with focused references.
- Treats Scenes as canonical and Acts/Sequences as optional non-owning
  Sections; uses stable IDs for Blocks and dialogue values.

`screenplay-analyst`

- Analyzes the current screenplay through `renku screenplay analyze`.
- Reads direct Project story fields, canonical ordered Scenes and stable Blocks,
  Cast Member/Location/Prop references, and default analysis criteria.
- Writes three-act Screenplay Analysis JSON through the CLI. Flat Screenplays
  use analysis-owned segments. FDX-backed Screenplays are always flat, and
  Final Draft planning markers never supply analysis Act membership. Exactly
  three canonical Renku-authored Acts may supply membership; other positive Act
  counts are unsupported.
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
- Hands `cast.character-sheet` and `cast.profile` generation to
  `media-producer`.
- Hands `cast.voice-sample` generation to `media-producer` when the user wants
  Renku to create the sample audio.

`production-designer`

- Creates and revises Location facts through `renku location`.
- Creates and revises Prop facts through `renku prop`.
- Writes validated `kind: "locationDesign"` JSON through
  `renku production-design`.
- Writes validated `kind: "propDesign"` JSON through
  `renku production-design prop`.
- Owns spatial design, architecture, set dressing, materials, props,
  atmosphere, and continuity risks.
- Hands `location.sheet` and `location.hero` generation to `media-producer`.
- Hands `prop.sheet` and `prop.hero` generation to `media-producer`.

`media-producer`

- Generates purpose-specific media from Renku context.
- Handles `project.cover` from the user's conversation, then progressively
  reads only missing Project Info and exact useful Production Lookbook or named
  subject context. It reads the Storyboard Lookbook only for an explicitly
  storyboard-like cover direction and imports retained candidates through the
  focused purpose.
- Reads the Project generation settings from Generation Context. Codex is the
  default image-generation choice; explicit user direction and a path already
  saved on the GenerationSpec take precedence. Preview, confirmation, and
  concurrency use their existing settings.
- Authors one generic `GenerationSpec` from Core context and Engines-owned
  provider field descriptors.
- Preserves exact guide placement and separately assigns every included
  exact reference to a real provider media field.
- Treats `facts.contextText` as opaque authored source context and keeps
  continuity relevance, Beat batching, and creative fallback decisions in the
  agent workflow.
- Uses exact registered `asset-file` references or normalized `project-file`
  references; it never invents asset identities or provenance.
- Creates or updates persisted generation specs only after the draft request is
  explicit enough to review.
- Estimates cost and runs only approved specs.
- Imports finished files only through current focused attachment purposes.
- Does not create Shot Video Takes, Take-owned media, or Shot video generation
  specs. Those contracts were removed by Decision 0052.
- Treats Lookbook Image import and Lookbook section/point placement as separate
  owning commands.
- Shows one or more ordinary requests in the Generation Preview Dialog with
  repeated `--file` values for transient specs or repeated `--spec` values for
  saved specs. Multi-request display never combines estimates, approvals, or
  runs.
- For `scene.storyboard-sheet`, reads the exact Scene Beats revision and current
  Storyboard Lookbook, requires one exact Storyboard Lookbook Sheet, then
  partitions only requested saved Beat image work into consecutive groups of
  up to four without changing the revision.
- Treats the Storyboard Lookbook as the sole appearance authority. Exact
  Character, Location, and Prop references preserve canonical subject facts
  while being re-rendered in that Lookbook's visual language.
- Reads reference-candidate summary, reference name, tags, pixels, and available
  provenance; prefers a suitable exact-`storyboard` same-owner sheet without
  automatic selection and uses a deliberate fallback when none is suitable.
- Uses one Project image-path setting, **Use Codex for image generation**. It
  is on by default. Turning it off selects the Renku-managed GPT Image 2 edit
  route;
  there is no second model recommendation.
- Synthesizes concrete visible panel direction from opaque narrative evidence
  and preserves the existing vision-guided crop path. Review-first shows one
  result and waits for accept/regenerate/discard. Strict iterative review
  requires explicit user opt-in and a changed, newly reviewed request after
  each creative failure. Findings remain advisory and add no runtime QA state.
- Generates `cast.voice-sample` audio with direct ElevenLabs models and hands
  the output to `casting-director` for `renku cast voice attach`.

`movie-director`

- Coordinates screenplay, analysis, visual language, cast, production design,
  Beat design, Shot planning, media generation, and production readiness
  workflows.
- Starts broad or cross-department requests with `renku director context`.
- Reads `projectSettings.screenplayImport` from Director Context after FDX
  import and coordinates enabled follow-up stages only when their prerequisites
  are ready. It preserves ambiguity handoff and does not mutate settings for a
  one-task override.
- Dispatches durable artifact work to specialist skills instead of writing
  department documents directly.
- Routes cast work to `casting-director`, production-design/location work to
  `production-designer`, Beat design to `scene-beat-designer`, Shot planning to
  `shot-planner`, and media generation to `media-producer`.

`shot-planner`

- Creates and revises director/cinematographer production camera plans through
  focused `renku shot-plan` commands; Beat Storyboard visualization remains a
  separate pre-production workflow.
- Resolves exact plan/Shot ids and one-based user-facing Shot numbers without
  whole-plan replacement.
- Authors readable opaque Markdown with only relevant sections, exact
  context-provided Cast Member, Location, and Prop `@handle` references, and strong
  emphasis for material known cinematography terms.
- Keeps briefs concise, uses only `shallow` or `deep` for depth of field, and
  uses `focusTarget` for one primary optical subject, plane, or distance.
  Shared deep-focus legibility belongs in `optics.intent`; status/timeline
  concepts stay out of the workflow.
- Hands `shot.image` generation to `media-producer`, which imports and selects
  the accepted image atomically when selection is the user's intent.

`scene-beat-designer`

- Designs and persists the narrative-appropriate number of Scene Beats without
  a four-Beat generation cap or image grouping.
- Uses `renku screenplay beats context` to read stable Screenplay Block
  ids, referenced Cast Members, Locations, and Props, Production Lookbook
  guidance, and active Scene Beats history.
- Writes validated closed Scene Beats JSON through the CLI.
- Hands Storyboard image requests to `media-producer` after a valid Scene Beats
  revision exists. Media Producer requires the current Storyboard Lookbook and
  one exact Sheet, and owns image-only batching, prompt synthesis,
  `scene.storyboard-sheet` specs, one-pass inspection, slicing, and per-Beat
  Storyboard image import.

## Skill Rules

Skills may inspect project files and media when those files are content. Skills
must call Renku commands for metadata mutations.

Skills must not:

- write directly to `.renku/project.sqlite`;
- invent IDs or relationships;
- use obsolete command aliases;
- register Inspiration folder images as assets;
- store absolute paths in authored JSON documents;
- run paid generation without the exact current Renku estimate and approval
  token required by the live-run contract;
- override user-selected generation controls.
- store generated storyboard image paths inside Scene Beats JSON;
- add framing, lens, camera movement, coverage, analog shooting logistics, or
  call-sheet timing to Scene Beats documents.
- mutate Cast Members, Locations, or Props through screenplay operation documents;
- embed Project subject facts or `@handle` tokens into authored screenplay text;
- use screenplay Block indexes in Scene Beats JSON;
- store generated media paths inside Cast Design or Location Design JSON;
- treat costume variants or location-local set dressing as media targets
  without explicit durable contracts.
- store generated Cast Voice sample paths inside Cast Design JSON. Cast Voice
  samples are attached through `renku cast voice attach`.

## Reference Structure

Each skill should keep `SKILL.md` short and operational. Detailed CLI workflows,
JSON contracts, craft guidance, and samples belong in the skill's
`references/` and `samples/` folders.

When a Renku architecture contract changes, update the architecture/reference
docs and CLI docs in this repository first, then update the external skill
references to match the current contract.

Shot Plan video workflow guidance lives separately from reusable provider
research. The media-producer route registry maps exactly the nine
Engines-activated Seedance routes to guide files and is checked against current
CLI JSON. Inactive Kling and Veo research stays outside that registry and
cannot activate runtime routes.
