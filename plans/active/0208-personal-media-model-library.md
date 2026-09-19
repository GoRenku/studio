# 0208 Personal Media Model Library

Status: implemented; desktop and release acceptance pending
Date: 2026-09-18
Updated: 2026-09-19

## Summary

Let a user ask Renku to add or refresh a model from an existing media provider.
An agent researches the exact model and route, saves a lightweight personal
entry, and may retain useful prompting advice as optional Skill guidance.
Ordinary Media Producer requests then discover and use that entry through
the existing configuration, Preview, execution, and attachment workflow.

The user confirmed that this is a **personal library shared across Projects**.
It lives outside the installed Studio Skills plugin and outside the Studio
runtime. Updating either distribution must preserve the library.

This is an editorial model library, not a second execution registry. Provider
schemas, authentication, transport, uploads, polling, and output handling remain
in Engines. Creative research and prompt authorship remain in Skills.

## Design Criteria

The user's clarification is a hard constraint on this plan:

- A model addition is a display name and exact route under an existing provider.
- Provider schemas are retrieved and cached just in time through the existing
  mechanisms. Do not create, copy, maintain, or install a model-specific schema.
- Normal request preparation uses that schema for parameters and optional
  Markdown for prompting advice. Add no separate capability check or mandatory
  per-model transport/output compatibility audit.
- Prompting and provider-specific advice belong in optional Skill guidance.
  A model does not need a guide, guide registration, operation guide, research
  record, or completeness check to be added, selected, or used.
- Missing guides are ordinary absence of advice. Do not turn that absence into
  a validation error, warning, activation state, or request for approval.
- A route entry is a discovery convenience. Actual request validity remains
  with the provider integration, independent of library membership.
- Personal route additions and personal guidance must survive plugin updates.

## Review Attention

- New personal route records contain only `provider`, `apiId`, and `name`.
  Optional personal guidance is plain Markdown outside the plugin installation.
  No guide text, operation map, capability record, schema, or research metadata
  is embedded in the route record.
- Add a `model-researcher` Skill and focused `renku generation models` commands.
  Core owns safe global route storage; Skills own research and optional guidance.
  There is no new bundled manifest or replacement of the existing guide layout.
- Existing instructions and release checks that require a model guide must change.
  Adding a valid route with no guidance must work throughout the workflow.
- Exact personal route entries take precedence for discovery labels. Guidance
  has a separate rule: the latest bundled guidance supplies the curated default,
  while personal notes provide additional advice and explicit user preferences.
  A personal route or guide must not hide later bundled guidance. Plugin updates
  never overwrite either personal file.
- Selecting a model uses its live/cached schema and optional Markdown through
  normal request preparation. No separate capability system or compatibility
  audit is added. Explain an actual input mismatch from the selected schema or
  documentation; do not prefetch alternative schemas or store capability maps.
- Engines keeps its current schema/cache/execution contracts. Its existing
  protocol limits still apply, including ElevenLabs' fixed music path. A broader
  ElevenLabs refactor is outside this implementation; do not make it a
  prerequisite for personal discovery or add local schemas to conceal the limit.
- One initial CLI/plugin release enables this workflow. Subsequent additions
  within existing provider protocols require no runtime/plugin release.
- The existing configuration cache hashes the effective name/route choices.
  Its freshness policy, live final validation, Preview, confirmation, Settings,
  and Asset provenance remain unchanged.
- No database migration, Project rewrite, installed-plugin edits, new provider,
  or new Studio Settings/HTTP surface. Proposed scope remains the five ordinary
  media providers; World Labs' focused 3D workflow stays separate.
- Implementation was authorized on 2026-09-19, including personal label
  precedence. Desktop and packaged/native release acceptance remain pending;
  see Implementation Verification below.

## Requirement Ledger

| ID | Source | Required outcome | Owner and proof |
| --- | --- | --- | --- |
| R1 | User request | Add models for existing providers without a release for each model | Research Skill, effective library, existing Engines; unseen-model fixture |
| R2 | User request and 2026-09-19 clarification | Research useful advice without requiring guides or duplicating model facts | Optional Skill Markdown; no-guide preparation eval |
| R3 | User request | Existing media generation discovers and uses additions | Media Producer, all five provider Skills, inline configuration; end-to-end preparation |
| R4 | User request and explicit scope answer | Preserve personal changes across plugin updates, across Projects | Core personal storage and deterministic resolution; plugin A/B replacement test |
| R5 | User request | Account for CLI and Engines; add no providers | Focused CLI commands and existing protocol families; registration/transport tests |
| R6 | Current architecture, ADRs 0086–0088 | Keep creative content opaque and preserve generation review/provenance | Envelope-only library validation; unchanged generation and attachment contracts |
| R7 | Current architecture, ADR 0091 | Keep cached configuration truthful after model choices change | Effective route fingerprint; cache/selector regression |
| R8 | Data-integrity boundary | Preserve unrelated and concurrently changed personal route entries | Atomic route-document write with revision precondition; failure/concurrency tests |
| R9 | Explicit 2026-09-19 clarification | Keep name/route discovery separate from just-in-time provider schemas | Three-field personal entries; no schema/guide registration or completeness gate |
| R10 | Explicit user follow-up | Later bundled curation improves defaults even for a personally added model | Independent bundled guidance lookup; later-adoption and preference-preservation evals |
| R11 | Explicit user clarification and confirmation | Schema plus optional guidance is the normal flow; no per-model compatibility audit | Existing request preparation; selected-schema and no-audit acceptance coverage |

## Context And Current Evidence

### Current execution and selection path

1. Core's `generation context` supplies Project facts and workflow policy.
2. `studio-skills/skills/media-producer/SKILL.md` reads a provider's
   `references/supported-routes.json`, resolves its editorial `modelKey` through
   `references/model-guides/model-catalog.json`, then reads the canonical guide,
   operation guide, and provider adapter.
3. Both Media Producer and provider Skills currently stop on missing indexed
   routes or guides. The user's clarification removes guide existence as a
   prerequisite. That current behavior must change rather than be preserved.
4. The inline configuration reads all small route indexes for choices, but only
   the selected route's guides/schema. Its descriptor script hashes those
   bundled indexes. Personal choices currently have no discovery path.
5. CLI `generation schema show`, `validate`, `execute`, and `recover` use
   `createRenkuMediaEngine()` in
   `packages/cli/src/commands/generation/provider-registry.ts`.
6. `packages/engines/src/media/engine.ts` registers **providers**, not model IDs.
   `ProviderRequest.model` is already an exact string. Most provider modules
   fetch current metadata for that string.
7. Core persists only the safe review/provenance envelope and imports resulting
   media through focused domain commands. Model-library installation does not
   need to touch those contracts.

### Provider feasibility

| Provider | Current evidence | Model addition boundary |
| --- | --- | --- |
| Fal.ai | `providers/fal-ai/metadata.ts` requests exact endpoint metadata with OpenAPI expansion; execution uses the queue SDK | Existing queue protocol, upload representation, supported schema dialect, and recognized media output shape |
| Pika | `providers/pika/metadata.ts` resolves exact `api_id`, validates asynchronous media category and a same-origin `/v1/media/` POST path | Existing asynchronous media/catalog/job/upload protocol; not every API sold by the marketplace |
| Replicate | `providers/replicate/metadata.ts` supports `owner/model` and explicit `owner/model:version`; output normalization accepts URLs/files | Existing prediction protocol and downloadable media; official/versioned invocation must match provider documentation |
| WaveSpeed | `providers/wavespeed/metadata.ts` finds exact `model_id` and its `model_run` POST schema | Existing submit/poll/upload protocol and `data.outputs` response |
| ElevenLabs | `providers/elevenlabs/index.ts` special-cases sample retrieval and `music_v1`; everything else is sent to TTS. Schema inspection is available only for sample retrieval | Existing compatible TTS requests remain possible; arbitrary new music models are not enabled by a route entry. No schema/transport refactor in this plan |
| World Labs | `providers/world-labs/index.ts` embeds `marble-1.1` in the focused Location World implementation | Separate workflow; not silently included in the ordinary media library |
| Codex | Review/provenance lane only, absent from Engines registry | Keep current harness capability discovery; no user-defined Codex execution models |

Fal.ai, Pika, Replicate, and WaveSpeed already use common provider protocols.
Ordinary new media models using those protocols are routine route additions;
they do not require model-specific adapter code or a compatibility audit.

An input schema does not control how the installed adapter collects outputs.
For example, Fal output normalization presently recognizes `video`, `image`,
`audio`, `audio_file`, and `images`; an unusual response arrangement could need
provider code. Treat this as an exceptional integration limitation to investigate
when actually encountered, not a mandatory research or registration gate.
ElevenLabs is the concrete existing special case identified above.

### Distribution and persistence evidence

- `studio-skills/README.md` explicitly separates the plugin from the installed
  Renku runtime. Plugin manifests contain Skills, not provider SDKs.
- The inspected Codex plugin is installed beneath a versioned cache directory.
  Its path is installation state, not a durable user-content location.
- `studio-skills/scripts/release/release-contract.mjs` keeps the Codex and Claude
  plugin manifests at one plugin version, independent of the runtime's release.
  This plan does not combine releases,
  pin users to a fork, or modify host marketplace installation behavior.
- Core already owns platform-specific global paths through
  `packages/core/src/server/config/paths.ts`; use that resolver for the library.
- Core's `generation-configuration-visualizations` module provides an existing
  precedent for bounded global files, structural validation, and atomic writes.
  The personal library is durable user content, never part of its disposable cache.

### Real Project and documentation findings

Read-only inspection of Urban Basilica's current `project.sqlite` found Settings
version 6, image provider `codex`, video provider `fal-ai`, and audio provider
`elevenlabs`. Existing provenance includes Codex images, Fal images/video/audio,
ElevenLabs speech, and voice samples. These are useful regression cases; none
requires conversion or revalidation against a current model library.

Accepted references are `docs/architecture/media-generation.md`, its compact
reference, ADRs 0086–0088 and 0091, the opacity rule in ADR 0041, the naming/coding
rules, and `packages/engines/docs/adding-a-provider.md`.

Two documentation inconsistencies must be corrected in the affected current
reference: `docs/architecture/reference/studio-skills.md` still shows an older
prompt-guide directory layout and calls Engines a model allowlist. The current
code and provider-extension documentation use live protocol validation and
`model-guides/model-catalog.json`. Do not use those stale statements to recreate
an Engines model catalog. Root `catalog:update-*` package scripts also refer to
scripts absent from the current Engines package; they are not an existing
user-update mechanism and are not a reason to revive the removed catalog.

Relevant prior plans: 0190 and 0191 are complete; 0192 and 0193 implemented the
present generation boundaries and guides; 0194 implemented dialogue audio; 0195
implemented inline configuration with conversational spot checks pending; 0203
implemented preparation across model limits; 0207 implemented installation
guidance with native/released-plugin acceptance pending. Treat these as baseline
constraints, not unimplemented dependencies to redesign. Preserve their records.

### External research checked on 2026-09-18

- [Fal model search](https://fal.ai/docs/platform-apis/v1/models) exposes exact
  endpoint lookup and OpenAPI expansion. This supports live selected-model
  inspection rather than checked-in parameter schemas.
- [Replicate model schemas](https://replicate.com/docs/reference/openapi) expose
  model input/output schemas; its
  [official-model protocol](https://replicate.com/docs/topics/models/official-models)
  differs from explicit-version prediction invocation.
- [WaveSpeed model listing](https://wavespeed.ai/docs/list-models) includes exact
  identity and model-run schemas.
- [ElevenLabs model listing](https://elevenlabs.io/docs/api-reference/models/list)
  exposes TTS capability. Its
  [speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
  accepts a model ID; its
  [music API](https://elevenlabs.io/docs/api-reference/music/compose) has its own
  model selector. [Live OpenAPI](https://api.elevenlabs.io/openapi.json) is
  available for provider-local extraction. A read-only fetch confirmed that the
  music body's `model_id` references `MusicModelID`, while speech uses a string
  model ID with the documented TTS capability check. These are technical authorities,
  not substitutes for model-specific prompting research.
- Pika's public documentation URLs could not be retrieved by the research tool
  in this investigation. Pika feasibility here is grounded in its implemented
  metadata loader and tests. Implementation verification must check the live
  contract; this plan does not claim a successful live Pika probe.

The current Skill release validators also enforce guide existence, model-key
membership, and operation-guide coverage. Those checks contradict the clarified
optional-guidance rule and must be removed where they gate model availability.
Checks may still cover actual workflow behavior; they must not demand a guide
file, prescribed guide headings, or a guide for every route.

## Options Considered

1. **Use the existing contracts unchanged and edit installed Skills.** Fast for
   one developer, but no durable ownership boundary protects user edits from
   plugin replacement. A private plugin fork also interferes with ordinary updates.
2. **Extend existing discovery with a personal library. Recommended.** Reuse
   bundled indexes/guides and existing Engines; add one resolver and one durable
   personal document behind focused CLI commands. No provider executable lives
   in the plugin.
3. **Introduce executable model plugins or a generalized provider catalog.**
   This could cover arbitrary protocols, but adds distribution, executable-code,
   schema, and upgrade responsibilities beyond adding models for existing
   providers. It also recreates machinery explicitly removed by ADR 0086.

The new bounded concept is necessary because neither installed plugin content
nor disposable provider metadata has the ownership/lifetime of personal model
guidance. Reuse unchanged is insufficient; a new execution system is unnecessary.

## Intended User Workflow

### Add or refresh a model

1. Resolve the user's requested existing provider, exact API route, and useful
   display name. Distinguish an actual endpoint from a marketing name; preserve
   namespaces, variants, and explicit Replicate versions.
2. Research the official endpoint documentation and useful model-developer
   prompting advice. Inspect a live schema through the existing CLI when needed
   for request preparation. Do not require a complete research dossier or an
   authenticated network check simply to store a known name and route.
3. Add or update the three-field personal route through Core/CLI. Research may
   produce useful optional Markdown, but a route-only addition is complete.
4. If retaining guidance, write plain Markdown at the personal guidance path
   returned by CLI. Include sources and dates naturally in the prose when useful,
   distinguish direct guidance from inference, and preserve the user's edits.
   There are no prescribed sections or machine-validated research fields.
5. Verify the route appears in discovery. Report separately what was researched,
   whether guidance was saved, and whether any request was actually tested.

The user's add/refresh instruction authorizes this work. Do not invent another
approval ceremony, substitute a different model, or run paid generation just to
mark a model as available. An inaccessible prompting guide does not prevent an
addition. Unknown technical facts are researched when the selected request needs
them; they are not guessed or stored as a permanent capability definition.

Research and guidance authoring are agent work. Core does not read or judge their
creative meaning. Provider instructions may explain native reference notation
or prompting practices; they cannot install executable adapters or rewrite
provider transport.

### Normal generation

- Read Project context and workflow policy as today.
- Read the effective route list, including personal entries. An exact model
  explicitly selected by the user does not have to be in this list to execute.
- For the selected route, read available current bundled guidance as the curated
  default and consider personal notes independently. A personal discovery entry
  must not suppress the bundled lookup. Missing files, catalog keys, or
  operation guides simply mean no advice from that source. Do not emit a
  missing-guide diagnostic, stop, or ask whether to continue without one.
- Retrieve the selected route's schema from the existing cache or provider.
  Use its required fields, parameter types, allowed values, descriptions, and
  exposed constraints to prepare the request; use optional Markdown for prompting
  practices. When more explanation is needed, consult the provider's current
  documentation. Do not generate a local schema or fake bounds to fill a gap.
- Author the native request and continue through the existing inline
  configuration, Preview, confirmation policy, validation, execution, review,
  and attachment.
- Refreshing a guide affects later agent authorship. It does not alter a
  prepared request, force schema invalidation, or change an existing Asset.

Keep the existing staged reconfiguration interaction: selecting a model prepares
that route using its schema and available advice. If, for example, the user
wants to animate an image but the selected text-to-video route accepts no image
input, explain that mismatch from the schema or documentation during normal
request preparation. This is not a separate capability check, registration gate,
or approval step. Do not silently hide a personal route because it lacks a saved
media kind or operation list. No alternative-model schema prefetch is introduced.

Existing curated routing hints in bundled files need not be rewritten in this
slice, but they are advisory and must not become required personal fields.
The effective discovery result described below uses only names and identities.
Canonical model equivalence across providers remains an agent determination
from available guidance/documentation; a missing editorial key is not a blocker.
Preserve the user's creative intent during reconfiguration without substituting
an inferred executable identity.

## Personal Storage And Contracts

### Route metadata

Use the existing global config resolver:

```text
<resolveRenkuConfigDir()>/model-library/library.json
```

On macOS the root is `~/.config/renku`; on Windows it is
`%LOCALAPPDATA%/Renku/Studio`. The CLI returns actual paths. Skills never write
the route document directly or reconstruct platform paths.

```ts
interface PersonalMediaModelLibrary {
  formatVersion: 1;
  entries: MediaModelRoute[];
}

interface MediaModelRoute {
  provider: string;
  apiId: string;
  name: string;
}
```

This is one common storage envelope for route bookmarks, not a model or provider
request schema. Core checks well-formed JSON, the three string fields, duplicate
exact identities, file safety, and a bounded document size (1 MiB). It does not
require guidance, source records, capabilities, operations, parameters, defaults,
pricing, schema snapshots, or readiness state.

The exact `(provider, apiId)` pair is identity; `name` is only a display label.
Do not match partially, rewrite a provider namespace, or treat equivalent
marketing names as the same executable route. Different providers and pinned
versions remain independent.

### Optional personal guidance

Keep personal guidance as agent-authored Markdown:

```text
<resolveRenkuConfigDir()>/model-library/guides/<route-sha256>.md
```

The hash is SHA-256 of UTF-8 `JSON.stringify([provider, apiId])`. It identifies
a file safely across operating systems; it is not a model version, knowledge
record, or content validation mechanism. The CLI returns the path for the exact
route, so agents do not compute it themselves.

The path is a location where a guide **may** exist. Core does not check existence,
read its contents, maintain a guide registry, or require a file there. Skills
read/write this content using their normal file tools. An absent guide is normal.
An actual access failure is reported as an IO problem without classifying the
model as unsupported. No guide-only CLI mutation API is necessary.

Bundled guides stay in the installed Skills, in their current Markdown layout.
Personal guidance is an external, optional Skill reference so plugin replacement
cannot overwrite it. It may contain model prompting advice, provider-specific
notation, sources, or the user's own preferences in ordinary prose. It need not
snapshot or duplicate all bundled guidance. Any essential advice copied from
bundled files should be understandable without depending on an old installation
path; this is agent authorship guidance, never runtime Markdown validation.

### Resolution and updating

- Read current bundled route indexes supplied by the active Skill; extract their
  provider, exact route, and display name. Do not load a model-guide catalog or
  guide files to list routes.
- Merge personal route records by exact identity, with personal names/routes
  taking precedence. Preserve other bundled routes.
- Keep guidance resolution independent. A personal route entry without a guide
  can use available bundled advice. A personal guide can exist for a bundled
  route without copying that route into personal metadata.
- Use the latest bundled guidance as the default prompting advice when available.
  Personal research contributes useful additions; its local origin alone does
  not make it override newer curation. Explicit user preferences take priority
  over default advice. None overrides the actual provider contract.
- Plugin updates change bundled discovery/advice normally and never write into
  the personal directory. There is no automatic merge or replacement of personal
  Markdown.
- Removing a personal route returns to the current bundled route if present,
  otherwise removes the personal discovery entry. Preserve its optional guide;
  deleting user-authored guidance is a separate explicit user intent.
- Removing a personal guide simply leaves the model with whatever other advice
  is available. Discovery and execution continue without it.
- Provider withdrawal may cause live request failure. It never deletes personal
  content or invalidates historical provenance.

### When a personal model becomes bundled

For example, a user adds an exact provider route and researches its prompting
style. A later plugin release adds that same route with a curated guide.

1. Discovery still produces one choice for the exact provider/route pair. A
   personal display name may remain; this does not select the source of guidance.
2. On the next request, Media Producer reads the current bundled guide even
   though the effective route is marked personal. It follows the guide's current
   defaults and considers the existing personal Markdown as additional context.
3. Earlier agent-researched general advice does not automatically outweigh the
   curated default. An explicit preference such as “keep my prompts concise”
   remains user direction and still applies. If the user explicitly asks to use
   their own guide instead, that instruction also remains effective.
4. No file is overwritten, merged, deleted, or marked as migrated. The new
   curation takes effect through which advice the agent reads and uses.
5. If there is no bundled guide, personal advice remains useful on its own. If
   neither exists, the normal just-in-time preparation workflow still works.

The same behavior applies to later improvements of an already bundled guide.
Do not introduce guide versions, synchronization status, mandatory adoption
prompts, or a text-merging service. Whether prose expresses a deliberate user
preference is an agent judgment, not a runtime classifier or required Markdown
section. Ask only if a material conflict leaves the user's intent unclear.

No synchronization service, plugin update hook, fork, pinned plugin version, or
runtime copy of the Skills is introduced. A future unreadable storage document
must be preserved and reported, never silently reset. This does not require
maintaining old model formats or compatibility readers.

### Focused CLI

```text
renku generation models list [--route-index <bundled-index> ...] [--provider <id>] --json
renku generation models show --provider <id> --model <api-id> [--route-index <bundled-index> ...] --json
renku generation models import --file <route.json> --if-revision <sha256|absent> --json
renku generation models remove --provider <id> --model <api-id> --if-revision <sha256|absent> --json
```

These commands work without an active Project or running Studio. Repeated
`--route-index` points to the current provider Skills' existing
`supported-routes.json` files. Media Producer supplies all five for its complete
selector list; a provider Skill may supply its own. No new manifest, directory
scanner, installation-path persistence, or model-catalog format is needed.
Omitting the argument lists only personal entries.

`list` returns `{ revision, libraryPath, routeCatalogSha256, routes }`.
Each result route contains the three metadata fields and
`source: 'bundled' | 'personal'`, plus `hasBundledEntry: boolean`.
Sort deterministically by provider and exact API identity. The hash covers the
complete effective name/route list supplied to the call before the optional
provider filter. Media Producer passes its complete selector result to the cache.

`show` returns `{ revision, libraryPath, route, personalGuidePath }`.
`route` is the matching discovery result or `null` for an unlisted exact
identity. Returning its optional guide location does not require discovery
membership or guide existence. The provider Skill already knows where its
optional bundled references live; Core does not resolve that creative material.

Import input is one `MediaModelRoute`. Import/remove results are
`{ revision, libraryPath, provider, apiId }`. A removal of a nonexistent personal
entry fails clearly; it cannot remove a bundled entry. Import accepts existing
runtime provider identities only. This is provider membership, not per-model
approval, live availability verification, or a guide requirement.

Core exposes `listMediaModels`, `readMediaModel`,
`importPersonalMediaModel`, and `removePersonalMediaModel` from its server
boundary. Inputs use `RenkuConfigPathOptions`; list/read accept
`bundledRouteIndexPaths`; mutations accept `expectedRevision` and the route or
identity. Import receives the installed `providerIds` from CLI composition.
Core performs generic membership, not provider-specific branching.

Engines exposes `MediaEngine.providerIds: readonly string[]` derived from its
existing provider registry. This is the only new Engines production contract;
it avoids duplicating the provider inventory in Core or the model CLI.
Execute/recover remain independent of the discovery list.

### Safe route writes and diagnostics

An absent personal route document means an empty list. A malformed existing
route document is a storage problem and must not be silently reset. This rule
does not extend to optional guide existence or content.

Retain one document revision (SHA-256 of its bytes, `null` when absent). Under
an exclusive file lock, compare the caller's revision, update only the selected
route, and atomically replace the complete document through a temporary sibling.
Reject unsafe/symlinked storage paths. Concurrent stale writes fail without
automatic rebasing; a held lock returns an actionable busy diagnostic. Normal
release removes its lock; a crash preserves the previous complete document.
Document manual recovery of a stale lock after verifying no writer remains,
rather than silently stealing a potentially active lock.

Use structured Core errors for invalid route documents, unsafe paths, unsupported
provider identity, stale revisions, busy storage, missing personal removal
targets, and IO failures:

`CORE_MEDIA_MODEL_LIBRARY_INVALID`,
`CORE_MEDIA_MODEL_LIBRARY_PATH_INVALID`,
`CORE_MEDIA_MODEL_PROVIDER_UNSUPPORTED`,
`CORE_MEDIA_MODEL_LIBRARY_CONFLICT`,
`CORE_MEDIA_MODEL_LIBRARY_BUSY`,
`CORE_MEDIA_MODEL_NOT_FOUND`, and
`CORE_MEDIA_MODEL_LIBRARY_IO_FAILED`.

Do not add a missing-guide, missing-research, missing-local-schema, incomplete
model, or activation diagnostic. Existing provider request errors retain their
current Engines codes.

## Engines And Just-In-Time Schemas

Leave `readInputSchema`, `validate`, `execute`, `recover`, provider metadata
caching, and the 24-hour pre-review schema/template cache in their current owners.
Do not add a library schema cache, local schema generator, field map, new schema
contract, or schema-preparation prerequisite for installing a route.

For Fal.ai, Pika, Replicate, and WaveSpeed, add representative tests proving an
exact model absent from bundled/personal indexes can use the installed protocol.
Test fixtures are isolated provider responses, not shipped model definitions.

ElevenLabs is an identified existing limitation: its TTS path accepts a model
string, its music path selects `music_v1`, and generic schema inspection is
currently unavailable for speech/music. Personal discovery cannot fix that
transport behavior. A compatible TTS request may use the existing path; do not
invent a schema to make it participate in schema-driven configuration. Preserve
the existing explicit unavailable-schema behavior and explain the limitation
when that workflow needs the unavailable capability.

A new music model or another unsupported execution family requires separate
provider work. Do not automatically add that refactor, claim universal execution
support, or treat a guide as permission to bypass the installed client. This
plan enables additions within existing protocols; it does not certify every
future endpoint from a provider.

Live input validation still matters. Optional advice does not mean bypassing
authentication, request validation, upload safety, or output handling. A failure
there is a concrete technical failure, not absence of editorial completeness.

## Skill And Cache Changes

Add `skills/model-researcher/SKILL.md`, concise
`references/workflow.md` and `references/source-research.md`,
`agents/openai.yaml`, and `evals/personal-models.md` in Studio Skills.
No model-definition template or mandatory research schema is added.

Update:

- `media-producer/SKILL.md` and `references/inline-generation-configuration.md`;
- `references/shot-plan-video/index.md` and `workflow.md`;
- `references/model-guides/shared/image-prompting.md` and `reference-inputs.md`;
- all five provider Skills, especially “stop if absent” guide/index instructions;
- `scripts/validate-media-generation-skills.mjs`;
- `media-producer/scripts/validate-image-prompt-guides.mjs` and
  `validate-video-prompt-guides.mjs`;
- descriptor script/tests, affected purpose evals, and the README Skill map.

Remove validation that requires a route's guide, canonical guide key, operation
guide, guide coverage, prescribed headings, or required model-specific research
files. Do not replace it with a warning or an agent-side blocker. Tests should
prove both guided and unguided generation preparation work, while preserving
research already present. Remove rigid guide completeness assertions, not the
actual guide content.

Retain optional bundled links and existing shared/purpose guidance. Agents load
only useful advice for the selected route; they do not read every guide to list
models. A user explicitly naming an unlisted route can proceed through the
ordinary provider workflow and optionally add it for future discovery.

The descriptor script takes `--route-catalog-sha256 <digest>` from the effective
list instead of hashing only bundled `--route-index` files. Preserve Core's
`routeCatalogSha256` field and cache lifetime. Changing effective names/routes
updates selectors through the existing incompatibility behavior. Optional guide
changes or absence do not invalidate provider schemas or templates; Skills read
available advice when authoring.

## Architecture Shape Gate

| Location | Responsibility |
| --- | --- |
| `packages/core/src/server/media-model-library/contracts.ts`, `document.ts` | Common three-field route document and storage-envelope checks |
| Same folder: `resolution.ts` | Read bundled route indexes, project names/identities, exact precedence and hash |
| Same folder: `file-store.ts` | Global paths, route revisions/locks, atomic route writes; derive optional guide location without checking contents/existence |
| Same folder: `service.ts`, `index.ts` | Focused functions; index exports only |
| `packages/cli/src/commands/generation/models/queries.ts`, `mutations.ts` | Flag parsing, owner delegation, serialization |
| Existing generation command registration and CLI help/flags | Thin bounded handler registration |
| Engines `media/contracts.ts`, `media/engine.ts` | Existing registry's provider IDs only |
| Studio Skills researcher and current media/provider Skills | Research, optional Markdown, route discovery, request authorship |
| Existing descriptor script | Accept effective route hash for current configuration cache |

No Core model-guide loader, provider-specific schema module, new bundled
manifest, guide validator, or general model-management service is introduced.
Core cannot fetch provider documentation or parse prompting advice. Engines
cannot load Skills or personal route records. CLI cannot own precedence or
provider request interpretation. Studio UI receives no new API or Settings.

Existing provider Skill indexes remain authoring sources; validators and
instructions lose their mandatory guide/canonical-key coupling. No provider
execution files need refactoring in this slice.

Keep the small Core service and indexes thin. Stop if implementation starts
adding capability maps, per-provider record variants, static request fields,
guide state, arbitrary endpoint configuration, native-schema transformations,
or broad dispatch. Stable import and runtime boundary tests protect ownership,
not lists of helper names.

## Implementation Slices

1. **Personal route storage and resolution (R1, R4, R8, R9).** Implement the
   three-field metadata, global file handling, exact precedence, CLI reports,
   and optional guidance path. Prove a name/route-only entry works.
2. **CLI and registry composition (R3, R5).** Add the four focused commands and
   registry-derived provider IDs. Library reads need no Project or credentials.
   Discovery never becomes an execution allowlist.
3. **Research and optional guidance (R2, R6).** Add the Skill; update all named
   consumers and validators. Preserve existing guides, remove completeness
   requirements, and test research that finds no specialized prompting material.
4. **Configuration and plugin updates (R3, R4, R7, R10, R11).** Consume effective choices
   and hashes; use normal selected-schema preparation and optional guidance,
   without a separate compatibility audit. Prove replacing the bundled plugin
   leaves personal routes/guides intact and does not block normal updates.
5. **Documentation and release.** Update accepted direction after approval and
   release runtime/plugin independently through existing processes. Document the
   first supporting runtime version once known; do not invent a version, bundle
   the runtime into the plugin, or modify installed Skills as a workaround.

## Tests And Guardrails

Core owns route-store tests: empty document, three-field entry, exact collisions,
independent endpoint variants/providers, stable ordering/hash, stale concurrent
writes, IO failures, unsafe paths, invalid JSON, and preserved unrelated entries.
There is no Core guide-existence/content test because Core does not read guides.

CLI tests cover parsing, delegation, serialization, revision handling, and
no-Project usage. Engines tests cover registry agreement and representative
unindexed models through current protocols; do not repeat the whole persistence
matrix at the adapter layers.

Skill and integration acceptance must cover:

- Add a route with no guide and prepare a valid provider request.
- Use a route whose bundled guide key is absent or whose optional guide file
  is missing, without a warning, approval question, or generation blocker.
- Use an explicitly selected unlisted route without mandatory installation.
- Find no dedicated prompt guide during research and continue with available
  technical documentation and agent judgment.
- Save useful personal Markdown, refresh it deliberately without losing edits,
  and use it without creating a new model schema or operation matrix.
- Replace plugin fixture A with B: new bundled routes appear, personal collisions
  retain personal names, and personal guides remain byte-for-byte unchanged.
- Add bundled curation for a previously personal-only route: show one choice,
  use the new curated defaults, consider personal additions, and preserve an
  explicit user preference without rewriting personal Markdown. Repeat with a
  later revision of that bundled guide and with no guide in either source.
- Remove a personal route without deleting its Markdown; remove optional Markdown
  without invalidating the route or historical media.
- Select a personal route in desktop inline configuration and prepare its request
  from the live/cached schema and optional guidance, without a separate capability
  check or transport/output audit. Explain an actual input mismatch, such as an
  image reference requested for a route with no image input, during preparation.
- Change route choices and refresh the selector template; change or omit guide
  prose and reuse the technical cache normally.
- Preserve Project policy, exact references, Preview, final live validation,
  output review, and safe Asset provenance.
- Explain an actual unsupported Engines protocol without introducing an
  executable personal adapter, a schema copy, or a paid activation check.

Architecture tests protect import/capability boundaries. No source-text tests
enumerate model identities, guides, private helpers, or command inventories.

## Documentation

After acceptance, add a new ADR named `use-personal-media-model-libraries` using
the next available number. Record lightweight discovery, optional Skill guidance,
global personal ownership, separate route-label and guidance precedence, and
unchanged live provider schema
ownership. Add concise notices to the relevant prior ADRs, especially 0086 and
0091, without rewriting their history. No ElevenLabs schema exception is proposed.

Update `docs/architecture/media-generation.md`, its compact reference,
`docs/architecture/reference/studio-skills.md`,
`docs/architecture/reference/structured-diagnostics.md`,
`docs/cli/commands.md`, and `packages/engines/docs/adding-a-provider.md`.
Document the accepted storage/CLI contract in
`docs/architecture/media-model-library.md` after approval.

Correct statements that require guide presence, describe Engines as a model
allowlist, or imply optional advice authorizes execution. Preserve the already
researched guides and current provider protocols. Do not rewrite historical plans.

## Final Verification

During implementation:

```bash
pnpm test:core
pnpm test:cli
pnpm test:engines
pnpm build
pnpm check
pnpm test
pnpm --dir ../studio-skills test
```

Use focused checks during each slice and the cross-package checks once at the
end. No dependency installation or paid provider calls are required. Use isolated
home/plugin fixtures and an ephemeral Project with Urban Basilica-like Settings;
the real populated Project remains read-only unless separately authorized.

Verify packaged CLI operation and desktop configuration/Preview, including a
route with no guide. Test plugin root replacement deterministically and report
any unavailable native host update acceptance honestly.

Inspect complete diffs in both repositories, newly large files, and thin
`index.ts` entrypoints. Confirm no provider schema/guidance semantics moved into
Core or CLI, no unrelated formatting churn, and no database/Settings/provenance
change. Passing tests cannot waive the architecture-shape gate.

## Completion Checklist

### Requirements And Architecture

- [x] Preserve the user's name/route-only model addition and optional-guide rule.
- [x] Keep provider schemas just in time in the existing Engines/cache boundaries.
- [x] Add no static model schema, capability matrix, guide registry, research
      envelope, activation state, or guide completeness validation.
- [x] Keep personal content global and outside runtime/plugin installations.
- [x] Keep functions/handlers focused and indexes thin.

### Storage And CLI

- [x] Implement the three-field route document and exact personal precedence.
- [x] Implement route storage revisions, atomic updates, and structured IO errors.
- [x] Derive the optional Markdown path without checking or requiring its existence.
- [x] Implement list/show/import/remove with no active Project requirement.
- [x] Read current bundled route indexes without a new manifest or guide loader.
- [x] Derive existing provider IDs from the Engines registry.
- [x] Preserve unrelated entries and guides on route mutation/removal.
- [x] Leave direct execution independent of library membership.

### Skills And Configuration

- [x] Add the researcher workflow and optional plain-Markdown research output.
- [x] Update Media Producer, all five provider Skills, video/shared references,
      descriptor script, validators, evals, and README.
- [x] Remove missing-guide/model-key/operation-guide blockers from instructions
      and release validators without removing useful guide content.
- [x] Include personal choices without requiring saved capability metadata.
- [x] Prepare only the selected route from live/cached technical facts.
- [x] Use schema plus optional guidance without a separate capability check or
      per-model compatibility audit; explain actual input mismatches in preparation.
- [x] Fingerprint effective name/route choices and read optional guidance fresh.
- [x] Preserve current Settings, Preview, confirmation, references, and attachment.

### Verification

- [x] Cover Core's storage/concurrency/path/precedence matrix at its owning layer.
- [x] Cover thin CLI translation and existing Engines unindexed-route execution.
- [x] Prove route-only, missing-guide, and unlisted-explicit-route workflows work.
- [x] Prove plugin replacement preserves personal routes and Markdown.
- [ ] Prove later bundled adoption and guide improvements change default advice
      for a personal route while preserving explicit user preferences and files.
- [x] Prove personal route removal preserves guidance and guide absence preserves
      model usability.
- [x] Prove selector cache changes track discovery, not editorial completeness.
- [ ] Verify desktop configuration/Preview and packaged CLI behavior.
- [x] Explain unsupported protocols honestly without adding provider schema machinery.

### Documentation And Final Review

- [x] Add the accepted ADR and update current architecture/CLI/Skill documentation.
- [x] Preserve independent runtime/plugin distribution and document prerequisites.
- [x] Run focused and final checks; inspect complete diffs in both repositories.
- [x] Confirm no new god file, broad dispatcher, arbitrary patch API, or
      provider/model rules in the wrong layer.
- [x] Confirm no Project migration, user-content deletion, or provenance rewrite.
- [ ] Mark complete only after the required behavior and architecture checks pass.

## Planning Verification (before implementation)

This is a proposal only. The investigation from 2026-09-18 remains evidence;
the 2026-09-19 revision incorporates the user's explicit design criteria.
Only this plan was changed. No production code, installed Skill, schema cache,
personal content, or provider was modified. One bounded consistency pass was
performed; no automatic plan review was run.

## Implementation Verification — 2026-09-19

Implemented the Core library, four CLI commands, registry-derived provider IDs,
effective selector digest, Model Researcher Skill, optional advice workflows in
all five provider Skills, release-validator changes, and accepted ADR 0100.
No provider execution production code changed beyond exposing registry IDs.
No Project database, Settings, installed plugin, or user media was changed.
The pre-existing plan edits were retained.

Automated coverage includes route-only imports, exact collisions and variants,
concurrent/stale/busy writers, failed replacement preserving prior bytes,
malformed/oversized/unsafe files, structured IO failures, preserved personal
notes, plugin replacement and later adoption, and cache invalidation driven only
by effective name/route choices. Fal and Pika tests exercise unindexed identities;
existing Replicate and WaveSpeed fixtures already exercise future/unindexed routes.
Skill fixture tests remove optional guides/catalogs and add unguided routes,
then run the release validators successfully. Creative interpretation of later
curation and personal preferences is specified in the new evaluation scenarios;
that conversational acceptance remains unchecked above.

Validation completed: `pnpm build`, `pnpm check`, `pnpm test`, focused
Core/CLI/Engines tests, a separate typecheck of the new desktop test, and the
sister repository's `pnpm test`. A built-CLI smoke test in an isolated
home loaded all 48 bundled choices, imported an unguided personal route, and
returned 49 effective choices with a changed digest. This is built-output
verification, not a packaged-release or native plugin-update claim.

Desktop Preview coverage was added in
`packages/studio/e2e/tests/regression/personal-media-model.regression.spec.ts`.
Execution could not start because port 5174 is occupied by an existing process.
`packages/studio/e2e/README.md` requires failing rather than reusing that server;
the process was not stopped. Desktop inline configuration and native host/plugin
update acceptance still require a follow-up run. No paid generation or live
provider activation call was made.

Runtime/plugin publication and the first released supporting version remain
maintainer release steps. The implementation does not modify installed Skills,
run dependency installation, or claim that an unreleased version is available.
Both repository diffs were inspected; new Core/CLI modules are focused, indexes
remain exports only, and no schema or creative-guidance logic crossed ownership
boundaries. No unrelated formatting sweep was performed.
