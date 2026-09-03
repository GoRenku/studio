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
- `../../decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`
- `../../decisions/0088-use-exact-request-references-and-source-derived-image-continuation.md`

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
  playable sample audio is ready.
- Keeps optional opaque provider identity and sample Assets in Cast Voice
  records, not Cast Design JSON.
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

- Begins every purpose-specific request with `renku generation context
  --purpose <purpose> --target <target> --json`.
- Treats the returned current facts and relationship-derived references as
  advisory evidence. It may ignore, supplement, or replace suggestions and
  never interprets their order or display selection as a creative choice.
- Reads the per-media Project generation policy from that report, including
  Preview, conversational confirmation, concurrency, and maximum concurrency.
- In Codex, prepares the initial authored prompt, exact references, and native
  values, then uses one shared transient Visualize configuration for every
  image, video, and audio purpose before authoring the review document.
- The inline configuration uses explicit direction or the matching Project
  provider only as its initial selection. It lists every compatible provider
  and all compatible indexed models, including advanced providers as explicit
  one-request choices. Alternative choices come only from their small route
  indexes; only the currently prepared provider/model's Skill, guide, adapter,
  and live schema are read.
- It renders one tab-free Configuration surface. Exact references are not shown
  inline; they remain available in the existing Generation Preview. Bounded
  purpose-owned reference choices, such as a Cast Voice selection, may appear
  as configuration controls. It returns the editable prompt followed by
  pretty-printed exact settings to the ordinary conversation.
- A canonical model change makes the agent re-author the prompt from the newly
  selected model and operation guides before Preview. A provider-only change
  for the same canonical model retains the prompt and applies the destination
  adapter's native notation.
- A provider/model selector change first shows that reconfiguration is required,
  hides the old route's controls, and sends a non-accepting follow-up. The agent
  reads only that selected route and updates the same request-scoped Visualize
  source path with its controls. It prefetches no alternative schemas and
  creates no global or cross-task cache.
- Keeps the component browser-local and request-scoped: it calls no Renku or
  provider API, persists no Project Setting or request state, and does not
  replace the existing Generation Preview.
- Uses the Codex image lane only when the active harness exposes the built-in
  image-generation capability; otherwise it reports unavailability and asks
  before choosing Fal.ai or Pika.
- Writes one temporary review document under
  `tmp/operations/media-generation/`, opens Preview when policy or the user
  requests it, pauses in the ordinary conversation, and rereads the document
  before generation.
- Delegates Fal.ai, Pika, Replicate, WaveSpeed, and ElevenLabs request
  authorship to their provider Skills. World Labs remains owned by
  `location-world-producer`.
- Gives every selected local-file marker a meaningful `reviewLabel`. Provider
  Skills preserve that label and add `promptMention` only when an existing
  model prompt guide defines an exact reference token for the request order.
  References without a prompt token remain visible in review but do not appear
  in prompt completion.
- Reviews returned artifacts, persists the exact safe provenance value, and
  attaches through the existing focused command with `renku media import
  --provenance` or another focused domain attachment.
- Keeps creative interpretation, Beat batching, reference choice, and artifact
  acceptance in the agent workflow. Studio runtime treats prompts, requests,
  receipts, and media as opaque.

Provider Skills

- `fal-ai-media-provider`, `pika-media-provider`, `replicate-media-provider`,
  `wavespeed-media-provider`, and `elevenlabs-media-provider` own supported-model
  indexes containing identity, human name, and input modes, plus internal links
  to model/operation guides. They read all other current request facts from the
  selected provider operation rather than duplicating request schemas.
- They author provider-native request JSON with local-file markers at the exact
  native media fields. In Codex they first inspect the Core-owned 24-hour
  generation configuration visualization cache. A fresh entry supplies the
  selected schema snapshot and reusable route template without a live request;
  a miss or expired entry uses `renku generation schema show --provider
  <provider> --model <model> --output <path> --json` once and stores or refreshes
  the template. They then call only the installed `renku generation`
  validate/execute/recover commands. Prompt guides provide editorial craft and
  exact prompt-reference notation; they never replace or reproduce the current
  provider schema.
- They contain no provider client or SDK. Engines owns upload, submission,
  polling, retry, recovery, normalization, download, and safe execution results.
- `location-world-producer` keeps the focused World Labs Location World flow.

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
- run generation without satisfying the current conversational confirmation
  policy;
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

The retained Media Producer prompt guides use this organization:

```text
skills/media-producer/references/prompt-guides/
├── shared/
├── image/
│   ├── guide-registry.json
│   ├── shared/
│   └── models/<existing-guided-model>/
└── video/
    ├── guide-registry.json
    ├── shared/
    └── models/<existing-guided-model>/
```

The registries route only models that already have curated guidance. Missing
models do not receive invented generic or provider-derived guidance. The
release contract validates the two registries, purpose coverage, structural
generation examples, and forward-evaluation scenarios. These validators are
agent-workflow checks; they do not move prompt interpretation into Studio
runtime code.

When a Renku architecture contract changes, update the architecture/reference
docs and CLI docs in this repository first, then update the external skill
references to match the current contract.

Provider/model activation belongs to each provider Skill's supported-model
index. A guide documents request authorship but cannot register a runtime model;
Engines remains the authoritative execution allowlist.
