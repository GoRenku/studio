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
Codex panel / Visualize / conversational configuration
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

## Review preference and host capabilities

Global Renku config owns `codexGenerationReview: auto | panel | visualize`, defaulting
to `auto` when omitted. Core validates it and includes it in the existing
generation context's `workflowPolicy`; it is not stored in Project Settings.
Skills read that CLI projection instead of reading the global YAML directly.

The independent global `codexGenerationReviewDisplayMode: inline | fullscreen`
setting defaults to `inline` and is also projected through `workflowPolicy`.
It applies to the packaged review, not Visualize or Studio Preview. The HTML
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

In trusted Codex Desktop, `auto` and `panel` probe the current Renku connection
when available. Advertised support selects the panel even when
`workflowPolicy.codexPluginInstalled` is false, as on a development machine
without an installer record. The panel combines prompt, exact reference
media and schema-described native controls. Skills Validate, open, yield,
consume Submit once, write accepted edits, Validate again and Execute with the
revised file hash. Prepare is excluded because it also delivers Studio Preview.
Model changes are agent-prepared updates to the same revision-bound review;
the panel never writes files, fetches provider schemas or executes generation.
Failures stop that review rather than silently swapping presentation surfaces.

Without a probe or installation record, Desktop uses Visualize even for a saved panel
preference. The explicit Visualize desktop choice retains the workflow below and Project
`displayPreview`. Codex CLI, Claude and unidentified interfaces use conversational
configuration and always deliver Studio Preview, even when that Project preference
is false. An unavailable Studio stops the mandatory Preview path. Presentation
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

## Transient Visualize configuration

When the Media Producer Skill selects `visualize` in Codex desktop, it
shows one transient inline configuration before authoring each image, video, or
audio review document. The component starts from explicit user direction or the
matching Project Setting, but that value only preselects the control. The
component lists effective bundled and personal choices, including advanced
providers. Personal routes need no capability metadata to appear. Choosing one
is an explicit one-request override and never changes Project Settings.
Selector choices come from `generation models list`; the agent does not read
alternative provider guides or schemas merely to populate them. Actual input
compatibility is established while preparing the selected request.

The component is one tab-free Configuration surface. It does not render exact
references, thumbnails, paths, labels, or marker objects; those remain available
in the existing Generation Preview. A purpose may retain a bounded reference
choice, such as a Cast Voice sample, as a configuration control. Configuration
uses the exact live schemas inspected by the agent for the currently prepared
provider/model only: finite choices use selects, truthful bounded numbers use
sliders with visible values, and unsupported or non-user-facing
transport/runtime fields are omitted. No schema or provider request is fetched
from the component itself.

Changing Provider or Model is a staged reconfiguration, not an in-browser model
catalog. The component hides the old route's controls, explains that the new
selection must prepare settings and may recreate the prompt, and sends a
follow-up. The agent then reads only the selected route's Skill, guide, adapter,
and live schema, verifies required references, and updates the same
request-scoped visualization source path with the newly prepared controls. No
alternative schemas are prefetched and no global or cross-task component cache
is introduced.

The continuation action returns the editable authored prompt followed by
pretty-printed JSON containing exact purpose, target, provider, model,
references, and provider-native raw values. This is temporary conversation
state. It is not a Core contract, saved request, Project Setting, provider
schema, or generation-resume event. A provider/model reconfiguration follow-up
updates the same pending component and does not author the review document. Only
**Continue with these settings** for the prepared selection advances to the
normal review document and existing validation and Preview behavior. A
canonical model change causes the agent to re-author the prompt using the
selected model and operation guides while preserving the user's creative
intent. A provider-only change that keeps the canonical model retains the prompt
and applies only adapter-required native notation.

This rich component does not change Studio's Configuration tab. Studio still
receives only the saved opaque request and renders it schema-free and read-only,
as described below. Generation Preview remains the larger prompt editor and
exact request review surface.

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

For requested Codex configuration or external-provider configuration, the
workflow inspects the Core-owned generation
configuration visualization cache. A fresh entry supplies its schema snapshot
and route template. A missing or expired entry performs one `renku generation
schema show --provider <provider> --model <model> --output <path> --json` and
stores or refreshes the cache. The fixed 24-hour freshness policy applies only
to pre-review configuration; final provider validation and execution remain
live boundaries.

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

There is no production Generation Spec, Generation Run, estimate, pricing,
approval token, freeze lifecycle, simulation, generic model catalog, persisted
reference selection, file-level generation identity, or Core-owned provider
execution. No compatibility reader or alias recognizes those concepts.

## Provider extension rule

A normal provider addition changes the standalone Engines provider module, CLI
registration, provider Skill guide/index, deterministic tests, and release
metadata. It does not change Core, Studio, the database, Preview, or a shared
request schema. Credentials and Project Settings choices require separate
product decisions. See
[`packages/engines/docs/adding-a-provider.md`](../../packages/engines/docs/adding-a-provider.md).

## Personal model discovery

The [personal model library](media-model-library.md) adds global three-field route bookmarks
through `generation models`. Effective choices merge bundled indexes with personal
names by exact provider/API identity. Engines remains a provider protocol registry;
execution is independent of discovery membership. Skills use selected live/cached
schemas and optional bundled/personal guidance, without a separate capability audit.
Missing guides are ordinary absence. Current bundled defaults and explicit personal
preferences apply independently of label precedence. Effective route hashes feed
existing configuration caches; guide changes do not invalidate schemas or templates.

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
in the panel path or when Preview is disabled in the Visualize desktop path;
Codex built-in and ordered multi-request Studio Preview use
`generation preview show`. Provider schemas and validation remain in Engines.
