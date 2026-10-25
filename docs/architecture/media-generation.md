# Media Generation

Decisions [0086](../decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md),
[0087](../decisions/0087-use-deterministic-advisory-media-generation-context.md),
and [0088](../decisions/0088-use-exact-request-references-and-source-derived-image-continuation.md),
with review routing in [0105](../decisions/0105-select-generation-review-by-preference-and-host-capability.md),
define the current media-generation architecture.

## Ownership

- Core deterministically projects current Project facts, target relationships,
  workflow policy, visual language, and relationship-derived reference
  suggestions for one purpose and target.
- Media Producer considers that evidence, makes creative reference choices,
  presents request-scoped provider/model/native controls through the shared
  generation review surface selected for the current host, and coordinates review.
- Provider Skills expose curated model identity/name/input modes, read current
  native operation facts from the provider, and author exact provider-native
  JSON.
- `packages/engines` owns standalone provider protocols: live metadata/schema
  validation, uploads, retry/poll/recovery, output normalization, and downloads.
- `packages/cli` composes providers, resolves one Core-owned credential, replaces
  local-file paths, delegates once to Engines, and serializes artifacts plus safe
  provenance. Execute/recover save import-ready provenance beside downloaded
  media and return its path. Validate returns the loaded request's byte hash;
  Execute can check that hash before provider work. These are file/serialization
  operations, not provider rules or creative interpretation.
- `packages/core` owns Project paths, credentials, deterministic generation
  context, the small review/provenance envelope, safety, per-media Settings,
  focused attachment, Asset provenance, copies, Inspection, and database
  migration.
- `packages/studio` projects Core resources. It neither imports provider SDKs nor
  validates provider fields.

```text
Core purpose + target context
        |
        | current facts + advisory suggestions
        v
Media Producer / provider Skill
        |
        | transient authored prompt + route schemas + exact references
        v
Route Chooser + purpose desk / conversational authoring
        |
        | editable prompt + exact request-scoped settings
        v
Media Producer / provider Skill
        |
        | temporary review JSON
        v
Core review projection ---> Codex panel or Studio Preview
        |
        | exact provider-native request
        v
CLI composition root ---> standalone Engines provider
        |
        | artifact paths + exact provenance
        v
focused Core attachment ---> Asset.generationProvenance
                                      |
                                      v
                           Studio read-only Inspection
```

## Generation lanes and stages

Project Settings are the single source of truth for generation defaults and
interruptions ([ADR 0115](../decisions/0115-use-project-generation-lanes-as-agent-defaults.md)).
A generation lane groups the defaults for generating new or editing existing
media: Image Generation, Image Editing, Video Generation and Audio Generation.
Core maps each purpose to its lane (`image.edit` to Image Editing; every other
purpose by output media kind) and projects the lane's `provider`, `model`,
`chooseRouteBeforeGenerating`, `askBeforeGenerating` and concurrency limit
through `generation context` `workflowPolicy`.

Every generation goes through the same stages:

1. **Target**: the image target chooser resolves an ambiguous image edit.
2. **Route choice**: when "Choose Provider and Model Each Time" is on, Codex
   shows the inline Route Chooser (`generation.route.choose`) preselected from
   the lane default; other harnesses ask one short question. A missing default
   opens the chooser even when the setting is off. The chooser lists the Skill's
   Default Model List copy
   ([ADR 0116](../decisions/0116-publish-the-skill-default-model-list-to-the-renku-state-directory.md)),
   marks providers without a key, and applies "Save as Project default" and
   "Don't ask again" only on Continue, through Core's focused lane command.
3. **Authoring**: the purpose desk (image edit or dialogue direction) when the
   route has a `## Codex panel` block; otherwise conversational authoring.
   Generate here is an authoring step, never approval.
4. **Review**: when "Ask Before Generating" is on, Codex opens the combined
   review panel; other harnesses use Studio Generation Preview, or text when
   Studio is not running. Both show the estimated cost.
5. **Execute, import, report**: always the agent, through the CLI.

Renku's confirmation is a consumed review Submit, or Ask off. Host approval is a
separate layer Renku does not control
([ADR 0118](../decisions/0118-separate-renku-generation-confirmation-from-host-approval.md)):
under the recommended Codex permission profile the CLI stays inside the sandbox
and no approval is requested.

## Review display and host capabilities

The global `codexGenerationReviewDisplayMode: inline | fullscreen`
setting defaults to `inline` and is projected through `workflowPolicy`.
It applies to the packaged review, not Studio Preview. The HTML
resource reads current validated Core config and advertises both modes through
`openai/ui`, with the configured `preferredDisplayMode`. This is an initial host
hint, not a forced transition; the host controls the actual mode as specified in
the [OpenAI display-mode contract](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md#display-modes).
The app advertises the same modes, follows host mode changes without replacing
drafts, bounds inline review height with scrolling, and fills the fullscreen
viewport. SDK size notifications avoid tying inline height to its own iframe
viewport. No display-mode tool argument, UI toggle or Project mutation is added.

Reference presentation reads only visible image thumbnails and audio through the
existing scoped MCP resources, sharing a three-read concurrency bound. Audio
shows a loading state and exposes native playback controls directly once bytes
are available; a card activation layer must not cover those controls. Full images
and video remain explicit preview reads. Object URLs are cached within the card
and revoked on teardown. This presentation never autoplays or changes references.

The local `renku studio mcp` runtime exposes `generation.review.capabilities`.
It reports initialized client identity and `panel.status: advertised | unavailable`.
The current eligible client is `codex-mcp-client` with MCP App UI MIME support.
The opening tool rejects unsupported connections before request reads. The
HTML app then verifies inline/fullscreen display and active-conversation messaging. Neither
tool registration nor a capability advertisement proves that a panel rendered.

In trusted Codex Desktop, the Skill probes the current Renku connection
when available. Advertised support selects the panel even when
`workflowPolicy.codexPluginInstalled` is false, as on a development machine
without an installer record. The panel combines prompt, exact reference
media and schema-described native controls. Skills Validate, open, yield,
consume Submit once, write accepted edits, Validate again and Execute with the
revised file hash. Prepare is excluded because it also delivers Studio Preview.
Model changes are agent-prepared updates to the same revision-bound review;
the panel never writes files, fetches provider schemas or executes generation.
The agent prepares and validates a replacement in a separate operation file,
leaving every currently bound file unchanged. Codex rechecks the current sources
and candidate bytes, then adopts the candidate file for only the selected request
after the complete update passes validation. Request identity and order remain
stable. Preparation failure preserves the prepared source and user drafts; model
selection allows retry or another choice while editing and Submit remain locked.
Returning to the unchanged prepared request preserves its draft edits. File reads,
path safety and envelope validation remain Core-owned; Codex owns the transient
review binding and revision checks.
Failures stop that review rather than silently swapping presentation surfaces.

Codex CLI, Claude and unidentified interfaces use conversational
configuration and deliver Studio Preview when "Ask Before Generating" is on, or a
text summary when Studio is not running. Presentation
selection belongs to Skills using trusted host context and the current connection
probe. The installation flag records installer verification; it does not veto a
working connection. A missing probe with installation recorded or an unavailable
or failed probe stops the workflow, as does a failed panel handshake;
the CLI does not guess its caller's interface from process environment.
Built-in image capability, provider permissions, validation, recovery, concurrency
and attachment retain their existing owners. Panel Submit supplies the single
review confirmation, including built-in images, with no duplicate question.

The plugin has no Studio sidebar launcher. Only the review UI is packaged as an
MCP resource; no certificate/trust installation or embedded Studio is required.

## Codex dialogue direction panels

Codex panels are purpose-owned and model-neutral
([ADR 0114](../decisions/0114-describe-models-as-skill-data-in-codex-panels.md)).
For `shot-plan.dialogue-audio` requests, and only when the Codex panel probe
advertises support and the selected route appears in a `## Codex panel` block
of its model guide, the Media Producer Skill opens the one fullscreen dialogue
direction panel instead of the conversational flow: `dialogue.direction.open`.
The panels are not generation reviews: they never read the review display
mode, and their UI resources declare fullscreen only.

The Skill describes the selected route as data in the opening input's `route`:
its labels, a Script Layout (`line-scripts`: one Direction Script per line, or
`range-prompt`: one for the selected range), a Voice Binding (`speaker-voices`
or `voice-references` with optional exact Voice Mentions), Max Voices, an
optional emphasis syntax for presentation-only highlighting, and its
Single-Line and optional Line-Range operations. Each operation carries the
exact route id, an advisory character limit, the Native Request Controls for
the few native settings the guide lists, and an optional Script Location that
lets earlier Takes be reopened. `packages/codex` validates the description
structurally and validates drafts against it; Studio renders it through the
closed vocabulary. Neither reads or branches on a provider or model id.

The agent pre-fills one consecutive line range with initial Direction Scripts
and the compatible Cast Voices per speaker, then ends its turn. `packages/codex`
keeps the session in the MCP connection's memory, projects lines, voices and
the route's Takes from Core reads, and serves media through opaque
`renku-direction://{sessionId}/media/{mediaId}` resources.

Generate is a message handoff, not execution. The panel records one action
through the app-only `dialogue.direction.generate` tool (validated against the
session's Route Description; at most one outstanding action) and posts a
neutral one-line notice naming the session and action. The notice carries no
approval; the disclosure beside Generate is information only. The image edit
panel's message follows the same rule. The agent consumes the action once with
`dialogue.direction.consume`, which returns the exact route id of the operation
the draft's range uses and the route-neutral draft: Direction Scripts, one voice
per speaker in order of first appearance, and native control values keyed by
JSON Pointer. Execution still runs through
the provider Skill and CLI: the agent authors the native request, opens the
generation review when Ask is on, validates, executes, imports with `--turns`, and reports the imported Asset File or a
failure message through `dialogue.direction.report`. No MCP tool executes
generation. Panel select and discard call Core Take commands and notify Studio
with the `agent` event source. Every generated Take keeps its exact request in
provenance; panel drafts are lost when the connection closes.

Successful reports retain `lastCompletedAction: { actionId, takeId } | null` in
the connection-local session, using the Take resolved from the reported Asset
File. Panels autoplay newly observed completions once, without inferring the
result from Take-list changes or replaying a completion on initial load.
Visible panels refresh the session every two seconds even while idle; refreshes
preserve local drafts, focus and playback. A saved Generate notification remains
retryable independently of errors from other panel operations.

## Codex image edit panels

The Image Editing lane decides the default `image.edit` route; an unset model
uses the Skill's recommendation for the lane provider. The Codex built-in image
tool is one route option (plan usage, no regions, a style
reference): the agent runs it with the built-in tool and imports the result with
`codex` provenance. For a route that appears
in a `## Codex panel` block, and only when the Codex panel probe advertises
support, the Media Producer Skill uses two Codex apps instead of the
conversational flow:

- **Image Edit Target Chooser** (`image.edit.target.choose`, inline only). When
  the request matches several images, the agent passes 2–24 active image Asset
  Files. Core's `readImageEditTargets` validates them and projects owner, type,
  take number (creation order among every file of that owner and type,
  discarded ones included) and selection state. The user answers once; the
  panel posts a message and the agent consumes the answer once with
  `image.edit.target.consume`.
- **Image edit panel** (`image.edit.open`, fullscreen only). The user adds a
  whole-image instruction and, when the route describes Region Modes, draws
  rectangular regions on the 0–1000 grid with one of the route's modes and an
  instruction each. When the route takes a style reference, the user may add a
  Production or Storyboard Lookbook sheet. The route's Native Request Controls
  render as output settings.

The Route Description carries the route's Region Modes in display order (the
first is the default; `null` when the route takes no regions), whether it takes
a style reference, and its controls. Region geometry, the route's mode ids,
instruction presence, the style reference rule and control values are envelope
data the runtime validates (`CODEX_IMAGE_EDIT_*`); the region and instruction
length limits, the 50-region limit and the minimum region side are
purpose-level bounds. Instruction text stays opaque (ADR 0041). Generate
follows the dialogue panels' handoff: one outstanding action, a conversation
message, `image.edit.consume` once, then the agent maps the route-neutral draft
into the route's native request using its model guide, resolves any project
items the user named into ordered reference images, executes through the CLI,
imports with `renku media import --purpose image.edit --target assetFile:<base>`
and reports through `image.edit.report`. No Codex tool writes prompts,
executes, imports, selects or deletes images.

Each import is a new version of the image beside its source. Under ADR 0113 it
becomes the selection when its type has one, so the panel's edit base is the
target's current Core selection and follows changes made in Studio; for sheets
and Shot Plan images it is the newest version in the lineage. The panel's
versions use Core's `readImageEditLineage`: the opening source and each base
used by the session, plus every active image of the same owner and type edited
from them, directly or through earlier edits. Core persists the exact validated
import target as the result's source in the attachment transaction; other
provider request references never establish parentage. Completion is checked
against the action's base, including an image selected outside the opening
source's lineage.
Versions therefore survive a failed report, an edit recovered in chat and a
later selection change. Sessions re-read Core on every projection and serve
media through `renku-image-edit://` and `renku-image-target://` resources.
Lookbook style choices are also refreshed on every projection. Generate and
consume resolve the chosen active Asset Files through Core. If a dependency
disappears before consume, the action fails clearly and permits another Generate.

Both panel families share `packages/codex/src/panel-sessions/` (the
one-action session store, media registry, resource registration and result
serialization) and, in Studio, `services/codex-panel.ts` and
`features/codex-panels/` (connection, messaging, session polling, media and
notices). There is one panel per purpose and no per-model code: model
knowledge lives only in Engines provider modules and Skills, and each panel's
variation is limited to the closed purpose-level vocabulary above (script
layout, voice binding, emphasis, region modes and control kind). Panel
controls reuse the generation review's Native Request Controls
(`packages/codex/src/native-request-controls/`) with a panel profile: scalar
kinds only, each with an initial value, never nullable.

## Review document and provenance

A temporary review document lives under
`tmp/operations/media-generation/*.json`:

```json
{
  "provider": "fal-ai",
  "model": "provider/model",
  "mediaKind": "image",
  "prompt": "Exact authored prompt",
  "request": { "prompt": "Exact provider-native request" }
}
```

Only these top-level fields are accepted. `prompt` may be `null`. `request` is
opaque JSON and may contain recursive exact local-media markers:

```json
{
  "$file": "media/reference.png",
  "mimeType": "image/png",
  "reviewLabel": "Council chamber — Location reference",
  "promptMention": "@Image1"
}
```

`reviewLabel` is required for every reviewed Renku marker. `promptMention` is
optional and is the exact provider/model-native text to insert; it may contain
spaces or omit `@`. Repeated use of one file remains separate by request JSON
Pointer. Studio completion uses only markers in this request and never all
context suggestions or all Project Assets.

Local references resolve through core to either an active registered AssetFile
or a direct image file in an active registered Inspiration folder. Inspiration
images remain filesystem-owned; using one as a reference does not create an
Asset or AssetFile. Preview and reference-byte loading use the same ownership
and file-safety checks, including the Inspiration trash ledger. Missing files,
discarded Inspiration folders/images, non-image or nested Inspiration files, and files
outside registered reference ownership are unavailable. Resolved paths must
remain inside the Project and, for Inspiration images, the declared folder;
symlinks cannot expose unrelated files. Image MIME types for Inspiration
references come from their supported file extensions.

Preview displays prompt, references, read-only configuration, and diagnostics.
It may atomically update only the top-level prompt. Update does not rebuild
provider-native request JSON; the provider Skill rereads the file and does that
work conversationally. Preview has no Generate action and no continuation event.

Preview and Inspection render through one complete Studio dialog owner. The
shared owner controls the DialogContent dimensions and grid, header, tabs,
content insets, loading/unavailable placement, footer, and Close action. Preview
adds only editable prompt state, Update, and optional multi-request navigation;
Inspection adds no parallel visual shell.

Configuration presentation is schema-free and read-only. The browser resource
remains `JsonValue`; Studio may project only exact JSON structure, insertion
order, array order, primitive types, values, and deterministic key humanization:

- strings and numbers use read-only shadcn Input controls;
- booleans use disabled shadcn Switch controls;
- null uses the same value surface with `Not set`;
- objects and arrays use ordered visual groups derived only from JSON nesting;
  and
- excessive depth or size uses a bounded formatted-JSON fallback.

Studio must not infer select options, slider constraints, units, provider
groups, model capabilities, or labels from provider/model ids, field names,
familiar values, or documentation. A value-only resource cannot truthfully
reconstruct those removed schema facts. Exact provider control semantics would
require a separately accepted presentation-metadata contract; they must not be
approximated through heuristics or one-option controls.

`MediaGenerationProvenance` uses the same envelope and may add an opaque safe
`receipt`. It is stored once on Asset, not AssetFile. Inspection projects the
same view without a document path and with `editable: false`.

Core rejects unknown envelope fields, non-JSON values, excessive size/depth,
absolute or traversing local paths, secret-bearing fields, signed URLs, and
temporary provider media URLs. It does not semantically inspect prompts,
provider-native fields, receipts, or media contents.

## Deterministic Project context

Every purpose-specific Media Producer workflow begins with:

```bash
renku generation context --purpose <purpose> --target <target>
```

Default output is a readable briefing. Choose `--json` before calling when the
next step parses fields or constructs requests programmatically. Both formats
contain the same Core-owned facts, with one complete Asset inventory and exact
identity links from reference roles, subjects, Shots, Lookbooks and voices.
The CLI formats those facts without pruning creative context. Refresh when
relevant state or scope changes, including after attaching a sheet needed by a
Hero request. See the [contract reference](reference/media-generation.md).

The generation briefing omits `generationProvenance` from candidates and typed
Assets throughout Lookbook, subject, Shot, voice-sample, and exact edit-source
context. Current creative documents, file identities, selection facts, and
opaque voice identities remain intact. Earlier recipes describe attempted
requests, not verified artifact contents or instructions for the next output.
Agents inspect references and apply current direction; Core does not parse
creative content or resolve contradictions. Full Asset resources and the
Inspector retain stored provenance for deliberate inspection, reuse, revision,
or debugging. No storage or attachment contract changes follow from this read
projection.

For `scene.storyboard-sheet`, `--revision` chooses the exact Scene Beats
revision and repeatable `--beat` narrows the report to a reviewed Beat batch.
Core validates only target identity and requested scope. Missing Lookbooks,
designs, Beats, voices, dialogue Takes, or related media are returned as empty
context or structured warnings; they do not make the request unauthorized.

The report includes current Project story facts and languages, effective
workflow policy, purpose-level output guidance, exact target/design context,
relevant Production or Storyboard Lookbooks, Scene/Beat/Shot/Shot Plan and
dialogue relationships, and exact relationship-derived AssetFiles.

**Context is evidence, not permission.** Suggestions are advisory and
non-exhaustive. Their stable order is not priority. A user or agent may ignore,
supplement, or replace them, including with an unrelated Project Asset or an
external reference. Canonical display selection is reported as a fact and is
never treated as generation selection. Core does not inspect creative content
or decide which reference should be sent to a provider.

The report is a fresh read projection. It is not persisted, hashed, frozen, or
copied into provenance. It contains no provider/model alternatives, native
request fields, provider schema, controls, prices, approval state, or execution
permission. It has no Studio route or model-selection dialog.

## CLI

The current provider execution commands are:

```bash
renku generation context --purpose <purpose> --target <target>
renku generation prepare --file tmp/operations/media-generation/request.json --json
renku generation execute --file tmp/operations/media-generation/request.json --output tmp/operations/media-generation/output --json
renku generation recover --file tmp/operations/media-generation/request.json --request-id <provider-job-id> --output tmp/operations/media-generation/output --json
renku media import --purpose <purpose> --target <target> --source <path> --provenance <provenance-json> --json
```

`shot-plan.dialogue-audio` additionally requires `--turns <N-or-N-M>` and a
`shot-plan:<id>` target. Core stores that one inclusive range with the attached
Take and exact provenance; it does not interpret the provider/model request.

Schema inspection returns the selected provider's live raw input schema. It is
technical field authority, not editorial prompting guidance. `image.create`
uses `--target shot-plan:<id>` and appears as a generic Reference Image in that
Plan's Assets tab. `image.edit` uses `--target assetFile:<id>`; Core derives the
same-place destination from the exact source AssetFile and accepts no separate
destination choice. Every active image AssetFile supports editing, including
Inspiration and research images. The edited output is a new unselected file in
the same owning collection; the original file and selection remain unchanged.
Inspiration edits stay in the same folder, and research edits stay beside their
source, including nested research directories.

Preview accepts `codex` because built-in image generation can share the review
envelope. Validate, execute, and recover reject `codex`; it is a harness-gated
Media Producer capability, never an Engines provider. World Labs Location World
generation remains under the focused `renku location world` command.

## Providers and Settings

Core owns credentials for Fal.ai, Pika, Replicate, WaveSpeed, ElevenLabs, and
World Labs. Engines receives only one opaque credential string. The generation
CLI registers Fal.ai, Pika, Replicate, WaveSpeed, and ElevenLabs. Pika resolves
exact operation ids through its live catalog and has no Engines allowlist;
Media Producer's Pika Skill curates the initial operation set. World Labs is
exposed by its focused location-world Engines API.

Project Settings version 6 has global Preview and provider prompt-expansion
preferences plus independent Image, Video, and Audio sections. The sanitized
credential status resource supplies keyed Fal.ai, Pika, Replicate, and
WaveSpeed choices to all three menus. Keyed ElevenLabs appears only in Audio;
World Labs appears in none of these menus because it serves Location World
generation. Image also always lists keyless ChatGPT Images 2.5 (Codex) first;
new Projects default to Codex for Image. These provider roles are the only
menu exceptions: Studio does not check media routes or models. A saved provider
value remains an opaque agent default even when its key is removed or its
provider is not offered in that menu; Studio explains the state without
rewriting the Project. The agent checks the selected request through Skills
and asks the user when the preferred provider cannot fulfill it.
Media Producer applies the expansion preference only when the selected live
schema unambiguously exposes such a control; runtime code has no native-field
map.
Each media kind owns Ask Before Generating, concurrent scheduling, and a retained
maximum. Effective concurrency is one while concurrent scheduling is off.
Replicate and WaveSpeed may be Project preferences when keyed; their presence
in a menu does not claim they support that media kind.

Provider Skill indexes contain the exact provider API id and human name, with
optional operation hints and editorial model-guide keys. Personal records contain
only provider, exact API id, and name. The API id is copied
verbatim into the temporary review document and Engines calls; the guide key is
never executable provider identity. The indexes do not duplicate request fields,
defaults, enums, ranges, durations, pricing, or capability summaries. Current
native request facts come from the selected provider operation.

## Removed concepts

There is no production Generation Spec, Generation Run,
approval token, freeze lifecycle, simulation, generic model catalog, persisted
reference selection, file-level generation identity, or Core-owned provider
execution. No compatibility reader or alias recognizes those concepts.

## Provider extension rule

A normal provider addition changes the standalone Engines provider module, CLI
registration, provider Skill guide/index, deterministic tests, and release
metadata. It does not change Core, Studio, the database, Preview, or a shared
request schema. Codex panel support is Skill data: a `## Codex panel` block in
the model's guide, with no code change, when the route fits the existing
interaction vocabulary. Credentials and Project Settings choices require
separate product decisions. See
[`packages/engines/docs/adding-a-provider.md`](../../packages/engines/docs/adding-a-provider.md).

## Personal model discovery

The [personal model library](media-model-library.md) adds global three-field route bookmarks
through `generation models`. Effective choices merge bundled indexes with personal
names by exact provider/API identity. Engines remains a provider protocol registry;
execution is independent of discovery membership. Skills use selected live/cached
schemas and optional bundled/personal guidance, without a separate capability audit.
Missing guides are ordinary absence. Current bundled defaults and explicit personal
preferences apply independently of label precedence.

## Execution-local Fal schema reuse

A Fal execution obtains one schema and uses it to validate both the native
request with validation URL placeholders and the request after local-media
upload substitution. Invalid input cannot upload; invalid substituted input
cannot submit. A subsequent schema, validate, or execute operation follows the
existing freshness rules, including immediately expired and no-store metadata.
No stale-schema fallback or longer-lived cache is introduced. Vendor SDKs load
only for operations that require them; ElevenLabs voice sample retrieval is
SDK-independent.

For a single Engines request in a Studio Preview path, `generation prepare` validates
and delivers the Core-owned Preview projection from the same loaded document.
Its digest is the Execute precondition. Standalone validation remains available
in the panel path or when "Ask Before Generating" is off;
Codex built-in and ordered multi-request Studio Preview use
`generation preview show`. Provider schemas and validation remain in Engines.

## Cost estimates

Prices are saved provider metadata owned by Engines
([ADR 0117](../decisions/0117-cache-provider-prices-with-schemas-and-estimate-before-review.md),
[ADR 0128](../decisions/0128-estimate-generation-cost-from-saved-prices.md)).
`estimateCost` uses the agent-recorded price, else the provider's API price,
and evaluates it with a closed unit and quantity vocabulary. Providers that
quote exact settings (Pika, WaveSpeed) are asked first, and the quote is saved
per set of settings like a price; Fal.ai token-billed routes use Fal.ai's
typical charge per call. While estimating, provider metadata and quotes are
reused for up to 30 days, an
older entry gets one refresh attempt with a 5 second timeout, and a failed
refresh keeps the saved copy. The CLI composes the only
`GenerationCostEstimator`, which returns plan usage for the Codex built-in
provider (Core's `generationRouteBilling`) and Core's `GenerationCostEstimate`
otherwise: `generation prepare` and `generation preview show` attach it to
Studio Preview, `generation estimate` prints it, and `renku studio mcp` injects
it into the Codex review, which also re-estimates edited controls through the
app-only `generation.review.estimate`, and the casting picker. A missing price
is never shown as zero.

Draft estimates omit cleared optional controls and preserve unrepresented native
fields. Control edits mark the displayed estimate outdated until the latest
draft's estimate returns. Prompt edits also mark it outdated; control-only
refreshes cannot clear that indication because native prompt fields remain
Skill-owned and are not bound by the estimate tool.
