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
- Reads all active supporting material before initial screenplay creation and
  for explicit source-driven revision of a Renku-authored Screenplay. It does
  not revise an FDX-backed Screenplay from those files or forward the raw files
  downstream.

`screenplay-supporting-material-importer`

- Imports any readable regular file unchanged through
  `renku screenplay supporting-material import`.
- Does not require an FDX-backed or non-empty Screenplay and never authors
  screenplay or continuity facts itself.
- Routes screenplay authoring to `screenplay-drafter` and description
  enrichment to `casting-director` and `production-designer`.
- Stops raw-source context at those authoring skills; analysis, media, sheets,
  Scene Beats, Shot Plans, Lookbooks, and storyboards continue from the
  canonical Screenplay plus durable facts and designs.

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
- In the same request, writes Character Arcs for the protagonists and key
  supporting roles through `renku cast arc write`, replacing the complete set.
  - It reads the contract from `renku cast arc schema`.
  - Age variants reference the main Cast Member's arc.
  - Turning points may name a character sheet (`lookAssetFileId`).

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
- Before initial Cast fact authoring, or for an explicit later source-driven
  refresh, reads the complete canonical Screenplay and all active supporting
  material to enrich Cast descriptions and `CastMember.arc`, then keeps raw
  files out of media handoffs.
- Writes Cast descriptions into the fixed description sections (decision
  0124), never as one block of text with improvised headings.

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
- Before initial Location/Prop fact authoring, or for an explicit later
  source-driven refresh, reads the complete canonical Screenplay and all active
  supporting material to enrich descriptions, then keeps raw files out of media
  handoffs.
- Writes Location and Prop descriptions into their fixed description sections
  (decision 0124).

`media-producer`

- Begins every purpose-specific request with `renku generation context
  --purpose <purpose> --target <target>`. Choose `--json` first for programmatic
  consumption or an explicit user format request; use readable text for direct
  preparation. Do not routinely read both formats.
- Reads the complete briefing once, optionally capturing it in a request-specific
  scratch file, and refreshes when relevant state or scope changes. Dependent hero
  context is read after sheet attachment. Reuses guides and final request reads
  within unchanged preparation.
- Uses references for their intended contribution under current direction.
  Prior recipes are absent from the briefing, including edit sources; history
  is retrieved deliberately for inspection, reuse, revision, or debugging.
- Treats the returned current facts and relationship-derived references as
  advisory evidence. It may ignore, supplement, or replace suggestions and
  never interprets their order or display selection as a creative choice.
- Reads the purpose's generation lane from that report: provider, model,
  "Choose Provider and Model Each Time", "Ask Before Generating" and the
  concurrency limit. An unset model uses the Default Model List recommendation
  for the lane provider; Settings change only at the user's direct request
  through `renku settings generation set`.
- Publishes `references/default-models.json` with `renku generation
  default-models sync` beside its credentials check.
- When the lane asks for a route, opens the Codex Route Chooser (or asks once
  in other harnesses) after the target and before authoring; a missing default
  opens it even when the setting is off.
- When "Ask Before Generating" is on, opens the combined review panel in Codex,
  or Studio Generation Preview elsewhere (text when Studio is not running), with
  the estimated cost; a consumed Submit, or Ask off, is Renku's confirmation.
  Host approval is separate: it asks once honestly, and once in chat if refused.
- Researches and records a price with `renku generation price record` only when
  a review estimate is missing or expired for a route without API pricing.
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
- treat filesystem downloads as retained references before `asset import`;
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

Media Producer retains optional advice in `references/model-guides/`, with
`shared/`, `image/`, `video/`, and `audio/` Markdown references. Agents find
relevant advice by filename or model name and follow useful Markdown links.
Provider Skills keep their `references/supported-routes.json` discovery indexes:
provider at the document root, and only `apiId` and `name` per route.
Skills invoke `generation models list` directly. Core owns discovery and matching;
the CLI does not interpret entries or model guidance.
`model-researcher` adds global personal three-field route records through
`generation models` and may save optional plain Markdown at the returned path.

Media Producer lists bundled and personal choices through Core. Personal labels
win exact collisions, while guidance lookup remains independent: current bundled
curation supplies defaults and explicit user preferences take priority. Missing
guides or operation advice never block preparation. Release
checks validate structural envelopes and actual workflow behavior, not guide
coverage or prescribed creative sections.

Engines registers providers and enforces their live protocol contracts. It is not
an execution allowlist of models. Explicit unlisted routes can execute; optional
advice cannot authorize an unsupported protocol. See
[the personal library contract](../media-model-library.md).

When a Renku architecture contract changes, update the architecture/reference
docs and CLI docs in this repository first, then update the external skill
references to match the current contract.


## Blender Previs authoring

`blender-shot-planner` in the sister skills repository authors a Scene Previs plan
from actual sheet visuals, then iterates camera, blocking and performance through
plan-specific Python and directing parameters. Shot List authoring remains with
`shot-planner`; Movie Director routes between them. Source lives at Core-provided
`previs/source/`, with registered source/render revisions. Temporary frames persist
until explicit Project Settings cleanup. The future Blender player is deferred.

Media Producer's `references/shot-plan-video/blender-previs.md` uses the reviewed
revision as video input, character/location sheets as appearance, and relevant
selected audio. H3 Max is this workflow's default, with explicit Seedance 2.5,
Seedance 2.0 and Wan 3.0 choices. Lookbook text may inform the prompt; this workflow
omits an additional Lookbook image. Existing native provider, Preview and attachment
contracts remain in force. These are agent-owned creative choices, not runtime
prompt or video validators.

## Task-local command efficiency

Resolve Project identity once per task, use the handler-verified targeting table
in `docs/cli/commands.md`, and pass exact context to specialists. Authoring
selection and Studio browser selection are distinct. Refresh relevant context
after intervening edits, revision conflicts, or user review.

Use a sufficient mutation report to confirm completion. Separate validate is
for validation-only requests or meaningful review; a write still validates in
Core. Missing detail or uncertain outcomes require a read. Keep screenplay
source/enrichment reads, generation configuration, Preview, confirmation,
concurrency limits, artifact review, and focused attachment. Batch related
operations with existing document formats and use repeated-file Preview when
appropriate; there is no new generic batch command.

A known-folder Inspiration Analysis update uses show, image inspection, and
write, consuming the returned analysis (two CLI calls). Known permission denials
require the host permission flow, not repeated attempts or disabled persistence.
CLI026 reports successful mutation with failed notification: never replay the
mutation just to refresh Studio. Installed skill caches are not changed by edits
to the sister source repository; releases remain independent.
