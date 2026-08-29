# 0189 Lean Provider Engines, Skills, And Asset Provenance

Status: complete
Date: 2026-08-24
Completed: 2026-08-24

## Review Attention

- Treat this as a refactor of the current Engines package, not a greenfield
  provider-client project. Preserve and reshape the proven Fal.ai, Replicate,
  WaveSpeed, ElevenLabs, and World Labs protocol code and tests.
- Remove generic Generation Specs, Generation Runs, approval tokens,
  simulations, provider-neutral request schemas, checked-in model schemas,
  generic pricing, generic model catalogs, and Core-owned provider execution.
  Remove all LLM/OpenAI/Vercel AI Gateway execution from Engines.
- Make `@gorenku/studio-engines` a standalone Node package with no dependency on
  another workspace package. It owns provider protocol, live metadata lookup and
  caching, validation, upload, retry, polling, recovery, output normalization,
  and download. It owns no Renku Project, Asset, purpose, Settings, Preview, or
  persistence concepts.
- Keep one installed `renku` CLI. Do not create a CLI or executable per provider.
  Provider Skills call `renku generation`, which delegates to Engines. The
  runtime release installs Engines and its SDK dependencies; the independent
  Skills release contains instructions and supported-model lists only.
- Keep Studio's Generation Preview, editable prompt, shared Inspection design,
  and Asset provenance. These use one deliberately small envelope around opaque
  provider-native request and receipt JSON; there is no provider/model field map,
  request transform, or presentation schema.
- Reopen the Configuration UI work. The first implementation preserved the
  values but replaced the prior rich control presentation with generic text
  rows. That is a UI regression and does not satisfy this plan's preservation
  requirement. Do not mark this plan complete until the Configuration tab has
  an accepted visual target, a truthful data contract, and screenshot evidence
  against the prior desktop implementation.
- Keep Preview conversational: `generation preview show` opens Studio and
  returns, the agent pauses, the user updates or closes the dialog and confirms
  in conversation, and the Skill rereads the temporary review document before
  generation. Do not add a Generate event, callback, resumable job, correlation
  protocol, or wait service.
- Keep the accepted Settings organization: Image offers Codex and Fal.ai; Video
  offers Fal.ai; Audio shows only ElevenLabs; execution policies are per media
  kind; Show Generation Previews is global. Replicate and WaveSpeed are
  supported by Engines and their Skills but are not added to Project Settings
  in this iteration. Explicit use remains possible.
- Move all World Labs API behavior into Engines while preserving its specialized
  Location World workflow, existing `renku location world` surface, and absence
  from Project provider Settings. Core continues to own Location World
  persistence and selection, not provider calls.
- Preserve WaveSpeed as another media provider. The final package supports
  Fal.ai, Replicate, WaveSpeed, ElevenLabs, and World Labs. Codex built-in image
  generation remains outside Engines. Media Producer offers the Codex path only
  when the active harness actually exposes the built-in image-generation Skill;
  another harness fails clearly and asks whether to use an available Engines
  provider rather than silently falling back.
- Preserve/add global write-only credentials for every executable provider:
  Fal.ai (`FAL_KEY`), Replicate (`REPLICATE_API_TOKEN`), WaveSpeed
  (`WAVESPEED_API_KEY`), ElevenLabs (`ELEVENLABS_API_KEY`), and World Labs
  (`WLT_API_KEY`). Replicate/WaveSpeed credentials being configurable does not
  add them to Project provider-preference Settings.
- Preserve attached generated Assets and migrate useful request/receipt
  provenance before deleting Specs/Runs. Unattached Specs/Runs are discarded;
  no media file or attached Asset is deleted.
- Reuse `renku media import` as the one attachment surface. Replace `--receipt`
  and `--source-spec` directly with optional `--provenance <json-file>`; provider
  Skills pass the exact safe provenance value, while ordinary external imports
  omit it. Add no attachment session, output registry, or durable job state.
- Add a provider-author guide beside Engines. Plan 0190 must be able to add the
  Pika protocol through one provider module, focused tests, CLI registration,
  and a provider Skill/model guide—not Core, Studio, database, Preview, or shared
  request-schema changes. Pika's separately accepted credential and Settings
  choices remain product-adoption work in Plan 0190, not provider protocol.
- Because Engines may not depend on Core, its manual paid E2E tests stop importing
  Core's saved-credential resolver and accept an explicit environment credential
  only after a `RUN_*` opt-in flag. This is test-only; the installed CLI still
  resolves the Core-owned saved credential for every production call.
- Pika implementation is deliberately excluded. Plan 0190 depends on this plan
  and adds the Pika provider, credential, Image/Video Settings choices, provider
  Skill, deterministic tests, and manual-only paid E2E after the standalone
  boundary is complete. Plan 0190, not this plan, supersedes unimplemented Plan
  0188.

## Reopened Configuration UI Analysis

### Finding

The prior Configuration UI was not reconstructed from request JSON. It received
explicit presentation metadata through `GenerationEditorControl` and related
model-family/input-mode projections:

- control kind: select, number, toggle, text, or read-only;
- select labels and allowed values;
- numeric minimum, maximum, and step;
- model families and model options;
- video input modes and capability-specific grouping; and
- user-facing labels and emphasis.

The replacement `MediaGenerationPreviewResource.configuration: JsonValue`
preserves only provider-native values. From that value Studio can know exact
object keys, order, nesting, arrays, primitive types, and values. It cannot know
whether a string was a select or free-text field, which alternatives a select
offered, whether a number was a slider, the number's bounds/step/unit, or the
provider-intended grouping that was not already represented by JSON nesting.

Therefore exact semantic reconstruction of the old selects, sliders, model
picker, and input-mode controls is impossible from JSON alone. Any implementation
that switches on field names/model ids, invents one-option selects, guesses
bounds, or silently fetches provider schemas from React would be a presentation
schema or heuristic under another name. This plan rejects those approaches.

### Options Considered

| Option | What it restores | Cost and architectural effect | Decision |
| --- | --- | --- | --- |
| Restore the old checked-in/generated rich schemas and model catalogs | Exact old control types, options, bounds, model families, and input modes | Reverses the accepted provider-skill simplification and makes Studio/provider addition depend on shared provider metadata again | Rejected |
| Infer controls from field names, provider/model ids, or familiar values | Superficial similarity for currently known requests | Creates an incomplete hidden presentation schema, fails for new providers, and lies when the guess is wrong | Rejected |
| Render one-option disabled selects or guessed sliders | Pixel similarity in screenshots | Misrepresents unavailable choices and constraints and is not a truthful control contract | Rejected |
| Fetch a live provider schema in Studio or Core | Can recover some enum and numeric metadata | Crosses the accepted package boundary, makes offline Asset inspection network-dependent, and still requires provider-specific schema interpretation | Rejected |
| Store or generate an ephemeral presentation descriptor beside each reviewed request | Can recover exact control semantics without a durable catalog | Introduces a new presentation-schema contract maintained by Engines/Skills and persisted or regenerated for Inspection | Not authorized; requires an explicit product/architecture decision |
| Reuse the prior control composition with a deterministic JSON-type projection | Restores spacing, typography, control chrome, disabled/read-only states, and grouping while keeping provider JSON opaque | Cannot honestly restore enum choices, sliders, model families, or input modes that are absent from the data | Recommended schema-free direction |

### Recommended Schema-Free Product Behavior

Keep the accepted read-only Configuration behavior and unchanged
`MediaGenerationPreviewResource.configuration: JsonValue`. Reuse the exact prior
`GenerationRequestControlsPanel` desktop composition as the visual source:

- centered `538px` control column;
- `38px` top padding, `48px` bottom padding, and `18px` row gap;
- `150px / 360px` label-control columns with a `28px` gap;
- the prior `text-xs font-medium text-muted-foreground` labels; and
- local shadcn Input and Switch controls in their disabled/read-only treatment.

Project only facts that JSON actually contains:

- provider and model use read-only text controls because no option set exists;
- strings use read-only text controls;
- numbers use read-only number controls without invented bounds, step, units, or
  slider behavior;
- booleans use disabled Switch controls;
- null uses the same read-only value surface with an explicit `Not set` value;
- objects use nested visual groups derived only from object nesting;
- arrays preserve order and use repeated groups/rows derived only from the array;
- empty values remain quiet and intentional; and
- excessive depth/size uses the existing safe formatted-JSON fallback inside
  the same centered composition.

This direction can match the prior dialog geometry and visual quality without
reintroducing schemas. It cannot claim exact semantic parity with the former
selects/sliders because the required information was deliberately removed.

### Approval Gate

Decision: option 1 was accepted on 2026-08-24. The completed implementation
keeps the no-schema architecture and restores the former visual system with
truthful JSON-type-driven read-only controls.

Implementation must not resume until the user accepts one of these mutually
exclusive product constraints:

1. Keep the no-schema architecture and accept exact visual-system parity with
   truthful JSON-type-driven read-only controls, but not exact select/slider
   semantics; or
2. Require exact former select/slider/model/input-mode semantics and explicitly
   approve a bounded presentation-metadata contract, which is a separate
   architecture decision and must be planned before implementation.

The recommended choice is option 1. The current generic text-row renderer is not
an acceptable fallback under either choice.

### Preview And Inspection Reuse Audit

The current implementation shares `MediaGenerationRequestView`, so Prompt,
References, Configuration, diagnostics, and the tab bar already have one render
owner. It does not yet share the whole dialog. Preview and Inspection separately
render `Dialog`, `DialogContent`, the 1120-by-760 grid, header, description, and
footer. Their class strings currently match, but duplicated shell markup leaves
the exact margins, rows, header/footer spacing, and loading/error placement free
to drift.

The remediation must use one shared `MediaGenerationRequestDialog` for the full
visual composition. Preview and Inspection remain separate controllers because
their behavior genuinely differs:

- Preview owns temporary-document loading, multi-request navigation, editable
  prompt draft state, dirty state, Update, pending, and update errors.
- Inspection owns Asset-provenance loading and unavailable/error state.
- The shared dialog owns DialogContent dimensions and grid, header, title,
  description, tabs, Prompt/References/Configuration content, diagnostics,
  loading/error placement, footer spacing, and Close.
- Preview supplies only its intentional additions: navigation in the shared tab
  bar and Update in the shared footer. Inspection supplies neither.

Sharing only the inner tab view is insufficient for the pixel-match requirement.
There must be no second copy of the dialog size, grid-row, header, content inset,
or footer class list.

## Summary

The repository already contains the valuable implementation. Fal.ai has tested
upload, asynchronous submission, request-id recovery, output normalization, and
API error handling. Replicate has tested output normalization and throttling/
retry behavior. WaveSpeed has working upload, task submission, polling, and
output normalization. ElevenLabs has focused client, binary output, retry, and
voice-sample behavior. World Labs already has a focused client and generation
state machine.

Those implementations are wrapped by a much larger system that makes Renku own
provider catalogs, downloaded schema files, mapping transforms, simulations,
price estimates, durable Specs/Runs, and provider-neutral request contracts. The
wrapper is the maintenance burden. Extract the proven provider behavior into a
small standalone Engines API, delete the obsolete wrapper, and prove the public
extension seam without adding a new production provider in this phase.

The agent chooses a supported provider/model recipe from Skills and authors that
provider's native request. Engines validates and executes it. Core stores the
media and provenance. Studio previews and inspects the request without trying to
understand every provider schema.

## Requirement Ledger

| ID | Requirement | Owner | Verification |
| --- | --- | --- | --- |
| R1 | Preserve and refactor existing Fal.ai, Replicate, WaveSpeed, ElevenLabs, and World Labs implementations rather than recreate them. | Engines provider modules. | Existing focused tests remain the regression baseline. |
| R2 | Support the existing Fal.ai, Replicate, WaveSpeed, ElevenLabs, and World Labs media behavior without LLM providers. | Engines. | Provider export/dependency inventory and tests. |
| R3 | Engines is reusable outside Studio and has no workspace-package dependencies. | Engines boundary. | Manifest/import tests and standalone consumer fixture. |
| R4 | Remove Specs, Runs, approval tokens, simulations, provider-neutral schemas, checked-in schemas, pricing, catalogs, and Core execution. | Core, Engines, CLI, Studio. | Database, export, command, and capability checks. |
| R5 | Skills contain model names and model-specific instructions per provider. | `studio-skills`. | Skill validation and routing evals. |
| R6 | One `renku generation` CLI calls Engines; no provider CLI is introduced. | CLI. | Thin delegation tests and release inventory. |
| R7 | Preview and Inspection remain one shared UI; Preview alone edits prompts and returns to the normal agent conversation rather than an app-to-agent execution protocol. | Core projection, Studio, and Skills. | Component, coordination, Skill, and desktop tests. |
| R8 | Assets retain safe provider request/receipt provenance without Run tracking, attached through `renku media import --provenance`. | Core Asset persistence and the existing focused import command. | Migration, attachment, copy, and Inspection tests. |
| R9 | Validation, retries, 429/`Retry-After`, polling, recovery, and downloads remain robust. | Engines shared mechanisms and provider policies. | Deterministic provider tests. |
| R10 | Settings remain organized by Image, Video, and Audio with accepted choices. | Core Settings and Studio. | Settings migration and UI tests. |
| R11 | World Labs is provider-owned by Engines but remains a specialized Location World flow. | Engines protocol; Core persistence. | World Labs and Location World regression tests. |
| R12 | Adding a provider is documented without reintroducing the deleted system. | Engines docs. | Fake-provider guide verification. |
| R13 | Every executable provider has one write-only Renku credential while only accepted providers appear in media preference Settings. | Core credential store and Studio global Settings. | Descriptor, secret-store, onboarding, and UI tests. |
| R14 | Codex built-in GPT Image 2 is offered as an execution path only in harnesses that expose the built-in image-generation Skill; it shares Preview, Asset provenance, attachment, and Inspection without entering Engines or using Spec/Run/freeze machinery. | Media Producer for capability routing; Core/Studio for review and provenance. | Codex-present/Codex-absent Skill evals and Preview/attachment/Inspection tests. |
| R15 | Public diagnostics and changed ADR effects are named in this plan rather than deferred to implementation. | Owning packages and documentation. | Contract tests and documentation inspection. |
| R16 | Finish a provider-ready architecture without implementing Pika; the separate Pika plan must be able to add one provider module through the public Engines contract without reopening this refactor. | Engines extension seam and Plan 0190 dependency. | Test-only provider fixture, standalone consumer, provider guide, and absence of production Pika code/configuration. |
| R17 | Restore the Configuration tab's prior desktop composition and rich read-only visual treatment without provider/model field maps, field-name inference, fake choices, or a new schema contract. | Studio shared Preview/Inspection UI. | Source comparison, focused component tests, and accepted desktop screenshots for representative flat and nested JSON. |

## Context And Existing Evidence

### Provider code to preserve

- `packages/engines/src/sdk/fal/adapter.ts`, `subscribe.ts`, `recovery.ts`,
  `fal-api-error.ts`, and `output.ts` own the hard Fal.ai protocol behavior.
- `packages/engines/src/sdk/replicate/adapter.ts`, `retry.ts`, and `output.ts`
  own Replicate invocation, throttling, and output handling.
- `packages/engines/src/sdk/wavespeed/adapter.ts`, `client.ts`, `polling.ts`, and
  `output.ts` own WaveSpeed upload, submit, polling, and output handling.
- `packages/engines/src/sdk/elevenlabs/` owns the official SDK client, binary
  audio, retry/error parsing, and voice-sample retrieval.
- `packages/engines/src/sdk/world-labs/` owns World Labs request, polling,
  artifact download, and recovery behavior.

These files are the implementation baseline. They may move and lose generic
runtime dependencies, but must not be replaced with parallel clients merely to
fit a new folder structure.

### Subsequent Pika plan

Plan 0190 owns all Pika-specific research and implementation. This plan supplies
only the standalone `MediaProvider`/`MediaEngine` contracts, shared mechanisms,
CLI registry seam, test-only provider fixture, provider-author guide, and
test-credential boundary that Plan 0190 consumes. No Pika provider id,
credential, Project setting, Skill, schema, catalog call, production registry
entry, fixture, or paid E2E is implemented here.

### Generic code to remove

- `packages/engines/src/generation/`, `catalog/`, schema update scripts, pricing,
  Studio model catalogs, and most of `src/sdk/unified/` serve the generic model.
- `packages/engines/src/producers/llm/`, `src/sdk/openai/`, Vercel AI Gateway,
  and `ai`/`@ai-sdk/openai` are outside the accepted media package.
- `packages/core/src/server/generation/`, generation tables, generic preview/
  model/purpose resources, and execution wiring make Core the orchestrator.
- The CLI exposes model, context, validation, Spec, estimate, Run, approval-token,
  and simulation concepts that disappear with the old model.

### Constraints to preserve

- Core owns Assets, Asset Files, project-relative paths, Settings, focused
  domain attachment, and durable provenance.
- Creative prompts/media remain opaque under Decision 0041. Runtime code may
  validate provider contracts and the Renku-owned safety envelope only.
- Refactor the current shared Preview/Inspection components; do not duplicate
  them or add provider-specific React renderers.
- Studio and Skills ship independently. Skills can invoke the installed `renku`
  runtime but cannot install provider dependencies or executables.
- Harness-owned generation capabilities are discovered by the Skill that invokes
  them. Studio does not gain harness detection, and Engines does not gain Codex.
- Urban Basilica is the migration fixture for generated Assets.

## Product Behavior

### Provider and model selection

Project Settings select the default provider by media kind. Explicit user
direction overrides it for the request. There is no provider/model fallback.

Each provider Skill owns its supported-model index and model instructions.
Engines accepts the supplied model identifier and has no product catalog or
allowlist. An unsupported model fails validation/provider execution; it is never
silently replaced.

The Engines provider ids in this phase are exact and stable: `fal-ai`,
`replicate`, `wavespeed-ai`, `elevenlabs`, and `world-labs`. Provider Skills and
the Engines CLI registry use these ids; visible labels may use Fal.ai,
Replicate, WaveSpeed, ElevenLabs, and World Labs. Core review/provenance also
accepts `codex` because Codex built-in generation shares Preview and Asset
provenance, but `codex` is never registered with Engines and `generation
execute` does not handle it.

Replicate and WaveSpeed are advanced and explicit in this iteration: their
Skills can be invoked, but they are absent from Image/Video Settings. World Labs
remains accessible only through the Location World flow.

### Engines provider request lifecycle

1. Media Producer reads Project policy and delegates to the selected provider
   Skill.
2. The provider Skill chooses a documented supported model and authors the exact
   provider-native request JSON.
3. Local media values use the Engines local-file marker at the exact native
   provider field. This is a value encoding, not a field map or request schema.
   Engines uploads the file and substitutes a provider URL only for the live call.
4. `renku generation validate --file <review-file>` loads/revalidates exact
   operation metadata and
   validates without submitting.
5. `renku generation preview show` opens Preview when policy or the user requests
   it and returns after delivery. The agent pauses; Prompt is editable while
   references/configuration are read-only.
6. After the user confirms in conversation, the Skill rereads the temporary
   review document, applies any edited prompt to the native request, validates,
   and replaces the document's request before calling `renku generation execute
   --file <review-file>`. Execute validates again before upload/submit.
7. Engines uploads, submits, polls, retries, recovers, normalizes output, and
   downloads artifacts to the requested temporary directory.
8. The Skill reviews the artifact, writes the returned exact
   `MediaGenerationProvenance` under `tmp/operations/media-generation/`, and calls
   `renku media import --provenance <provenance-file>` with the existing focused
   purpose/target/source arguments. No job or Run is persisted.

### Codex built-in image lifecycle

Codex GPT Image 2 is a harness capability, not an Engines provider:

1. Media Producer chooses the Codex lane only when Project policy or explicit
   user direction selects it and the active harness exposes the built-in
   `imagegen` Skill/capability.
2. When that capability is absent, Media Producer reports that Codex generation
   is unavailable in the current harness and asks whether to use Fal.ai. It
   never silently falls back and Studio gains no harness-detection API.
3. Media Producer writes the same temporary review shape with `provider:
   'codex'`, `model: 'gpt-image-2'`, `mediaKind: 'image'`, the exact prompt, and
   the opaque built-in invocation request. It calls `generation preview show`
   when Project policy or the user requests Preview, then pauses normally.
4. After conversational confirmation, Media Producer rereads the document,
   rebuilds the built-in invocation from the final prompt/references, and calls
   Codex `imagegen` directly. It does not call `generation validate`, `execute`,
   or `recover` and creates no Spec, Run, freeze marker, or approval artifact.
5. After artifact review, Media Producer writes the exact
   `MediaGenerationProvenance` with no invented receipt and uses the same `renku
   media import --provenance` attachment path as provider-generated media.
6. Asset Inspection reads that provenance through the same shared UI as every
   other generated Asset.

Ask Before Generating is conversational policy, never an approval token. When
Preview is shown, the user's subsequent “continue” confirmation satisfies that
policy; the Skill does not ask twice. When Preview is skipped and Ask Before
Generating is on, the Skill pauses once immediately before generation.
Concurrent scheduling is agent-owned by media kind; one Engines execution is one
logical provider request.

### Preview and Inspection

Both render one `MediaGenerationRequestView`:

- Prompt: exact authored prompt, editable only in Preview.
- References: local-file markers found recursively in the request, rendered by
  general media kind from registered file/MIME data.
- Configuration: opaque native request rendered recursively with humanized keys
  for presentation only.

The UI knows no Character Sheet, Lookbook, Cast, Location, Prop, provider schema,
JSON pointer, model variant, or provider control. Unknown structures fall back
to formatted JSON in the same design.

The detailed Preview workflow is:

1. The selected provider Skill writes one temporary review document under
   `tmp/operations/media-generation/<unique-name>.json`, then calls `generation
   validate` before Preview. Media Producer writes the same shape before Codex
   built-in generation without calling Engines. The unique filename prevents
   two simultaneous previews from overwriting each other; it is not a
   correlation token or coordination protocol. The document is ordinary Project
   temporary data, not a database record.
2. `generation preview show` validates the document path through Core, projects
   browser-safe reference URLs, and publishes the existing Studio coordination
   event. Ordered repeated `--file` values continue to open one navigable Preview
   session.
3. The dialog preserves the current desktop scale, title/header treatment,
   Prompt/References/Configuration tabs, prompt editor typography and keyboard
   behavior, reference-card treatment, diagnostics, previous/next request
   navigation, and footer hierarchy. The implementation keeps the current
   1120-by-760 desktop dialog target with the existing viewport maximums and
   header/tab/content/footer grid rather than shrinking it into a generic form.
4. Prompt Update writes only the top-level `prompt` value atomically. Core never
   searches or rewrites a prompt field inside opaque provider JSON. Update and
   Close do not wake or resume an agent. After the user confirms in the normal
   conversation, the Skill rereads the document, rebuilds the provider-native or
   Codex built-in request, validates it when Engines-owned, and replaces the
   document's `request` before generation.
5. Reference or configuration changes are requested conversationally. The agent
   changes them through the provider Skill, validates, and reopens/refocuses the
   same Preview. Studio provides no model, reference-selection, duration,
   resolution, aspect-ratio, or provider-parameter editor in this iteration.
6. Studio has Update and Close actions only; it emits no Generate intent and
   owns no callback, correlation, wait, or resumable-agent protocol.
7. Turning off Show Generation Previews skips automatic opening only. An explicit
   Preview request still opens it. Execution still validates immediately before
   provider submission.

In plain terms: the agent opens Preview and stops. The user can edit the prompt,
click Update, close the dialog, and say “continue” in the same conversation. The
agent sees that ordinary message, rereads the file, and continues. The dialog
does not need to find, wake, or send a special message to the agent.

The References tab recursively discovers every `LocalMediaFile` marker and
deduplicates repeated paths while preserving first occurrence order. Core:

- accepts normalized Project-relative paths only;
- rejects absolute paths, traversal, provider upload URLs, and files outside the
  active Project;
- resolves the registered file/MIME type to `image`, `video`, or `audio`;
- returns a browser-safe URL without Asset or AssetFile ids; and
- returns a quiet unavailable-reference diagnostic when an inspected historical
  Asset points to a file that has since been discarded, instead of breaking the
  whole Inspector.

The Configuration tab omits the duplicated editable prompt and local-file marker
objects, then renders the remaining exact request values recursively. It reuses
the former centered control composition and local shadcn control chrome rather
than replacing the controls with definition-list or bordered text rows:

- objects become visually grouped sections based only on JSON nesting;
- arrays preserve order and use repeated rows/groups based only on JSON order;
- strings use read-only text Input controls;
- numbers use read-only number Input controls without invented bounds, steps,
  units, or slider behavior;
- booleans use disabled Switch controls;
- null uses the same read-only value surface with an explicit `Not set` value;
- camelCase, snake_case, and kebab-case keys are humanized for labels without
  changing stored keys;
- large or unknown nested values fall back to formatted read-only JSON; and
- renderer tokenization is presentation-only and never validates, repairs,
  transforms, or interprets creative content.

The renderer must not infer select options, slider constraints, units, or groups
from field names, provider/model ids, familiar values, or documentation. It must
not render a one-option Select merely to imitate a removed schema-backed control.
If exact former control semantics become mandatory, stop at the Approval Gate
above and plan the required metadata contract explicitly.

Inspection opens from a generated Asset and reads its saved provenance. It uses
the same header, tabs, reference cards, configuration renderer, diagnostics, and
loading/empty states as Preview. Its prompt editor is focusable and selectable
but read-only, and it has no Update or Generate action. A compound Asset shows
its shared provenance once rather than repeating it for every AssetFile.

### Provenance

Core stores one nullable JSON value on Asset:

```ts
interface MediaGenerationProvenance {
  provider: string;
  model: string;
  mediaKind: 'image' | 'video' | 'audio';
  prompt: string | null;
  request: JsonValue;
  receipt?: JsonValue;
}
```

This is the irreducible Studio envelope, not a provider schema. `request` and
`receipt` remain opaque and provider-specific. Local-file markers remain in the
stored request so Inspection can display durable references; temporary upload
URLs, credentials, and headers are never stored there. The receipt may contain
provider request/job ids, unsigned provider output URLs, and other response facts,
but no Renku Run state. Those output URLs are opaque historical facts only: the
imported local AssetFile remains canonical, and runtime code does not fetch or
recover media from a receipt URL. Signed or credential-bearing URLs are never
stored in either request or receipt.

Copying a generated Asset copies immutable provenance JSON. Ordinary external
media imports have `null` provenance. The attachment boundary treats provenance
presence as the generated/imported distinction; it does not add a separate
generated flag or attempt to infer how an unprovenanced file was created.

For an Engines provider, the request stored in provenance is the exact validated
provider input except for one safety-preserving transport representation:
uploaded media values remain as durable `LocalMediaFile` markers rather than
temporary/signed provider URLs. For Codex, it is the exact final built-in
invocation authored by Media Producer. The receipt is the useful provider-native
response/job information returned by an Engines provider module; Codex does not
invent one. Before attachment, Core recursively rejects:

- credential values, authorization/cookie headers, and known secret field names;
- absolute local paths and Project traversal;
- provider upload/transport URLs in the request, plus credential-bearing URLs
  and signed query parameters in either request or receipt; and
- non-JSON, cyclic, over-depth, or over-size values.

These checks protect durable data and UI safety; they do not semantically inspect
the prompt, reference media, or provider configuration.

### Focused attachment

Keep the current `renku media import` user intent and replace its obsolete
provenance inputs directly:

```text
renku media import \
  --purpose <purpose> \
  --target <target> \
  --source <project-relative-file> \
  [--provenance <project-relative-json-file>] \
  [--title <title>] [--summary <summary>] [--select]
```

`--receipt` and `--source-spec` are deleted without aliases. `--provenance`
accepts one exact `MediaGenerationProvenance` JSON value, not a Run wrapper or
execution status document. Provider Skills write the `provenance` returned by
`generation execute`; Media Producer writes the same value after Codex built-in
generation. The existing Core `attachGenerationMedia` command is refactored in
place: its `receipt`/`sourceSpecId` inputs become optional
`generationProvenance`, and it continues to own purpose/target validity,
destination, Asset/AssetFile creation, selection, file movement, and the atomic
write.

Focused callers cut over directly:

- `SceneStoryboardImagesImportDocument.beats[]` replaces `sourceSpecId` and
  `sourceRunId` with optional `generationProvenance`, allowing every resulting
  Beat Asset to retain the exact request that produced its source image;
- `CastVoiceAttachmentDocument.sample` replaces `receipt` with optional
  `generationProvenance`; focused voice/model/sample checks remain owned by the
  Cast Voice command; and
- dialogue Take and Location World persistence keep their focused domain facts
  while any generated Asset they create receives the same Asset-level
  provenance value.

No attachment session, output registry, generated-file id, pending state, or
second import service is introduced. Domain purposes that already require a
generated source continue to require provenance; other external imports omit it.

### Settings

- Image: Codex or Fal.ai; Codex identifies GPT Image 2.
- Video: Fal.ai.
- Audio: ElevenLabs only in this iteration.
- Ask Before Generating, Run Generations Concurrently, and Max Concurrent
  Generations are independent for Image, Video, and Audio.
- Show Generation Previews is global.
- World Labs, Replicate, and WaveSpeed have no Project setting.

Codex built-in uses the same Preview and Inspection envelope in this plan while
remaining outside Engines. The Project setting is harness-independent: Studio
continues to show Codex, while Media Producer checks the active harness capability
at execution time. ElevenLabs stays supported now; additional Audio provider
choices remain hidden until implemented.

Project Settings advances to the next document version with this exact shape:

```ts
interface ProjectGenerationSettings {
  displayPreview: boolean;
  image: {
    provider: 'codex' | 'fal-ai';
    askBeforeGenerating: boolean;
    runGenerationsConcurrently: boolean;
    maxConcurrentGenerations: number;
  };
  video: {
    provider: 'fal-ai';
    askBeforeGenerating: boolean;
    runGenerationsConcurrently: boolean;
    maxConcurrentGenerations: number;
  };
  audio: {
    provider: 'elevenlabs';
    askBeforeGenerating: boolean;
    runGenerationsConcurrently: boolean;
    maxConcurrentGenerations: number;
  };
}
```

The current accepted maximum range remains unchanged. Effective concurrency is
`1` when its switch is off and the configured maximum when on. This is agent
scheduling policy; it does not create a queue or Run table.

The old settings migrate by preserving current effective behavior:

| Media | Provider mapping | Ask/concurrency/maximum mapping |
| --- | --- | --- |
| Image | Codex when `preferCodexImageGeneration` is true; otherwise Fal.ai. | Copy the currently selected Codex or Renku-managed lane values. |
| Video | Fal.ai. | Copy current Renku-managed values. |
| Audio | ElevenLabs. | Copy current Renku-managed values. |

Fresh defaults remain: global Preview on; Image Codex, ask off, concurrency on,
maximum 5; Video Fal.ai, ask on, concurrency off, maximum 1; Audio ElevenLabs,
ask on, concurrency off, maximum 1.

Studio renders four sections in this order: Generation, Image Generation, Video
Generation, Audio Generation. Audio shows ElevenLabs as the only choice, not
disabled alternatives. Replicate, WaveSpeed, and World Labs do not appear as
Project provider preferences in this iteration.

`Generation` contains only Show Generation Previews and its existing explanation
that automatic Preview can be disabled while explicit Preview remains available.
Each media section contains, in order: Provider, Ask Before Generating, Run
Generations Concurrently, and Max Concurrent Generations. The maximum control is
visibly disabled while concurrency is off but its configured value is retained.
Image provider copy identifies Codex as GPT Image 2; the UI does not add a second
model picker. Remove the old Renku-managed versus Codex execution-lane accordions
and duplicate policy controls after the migrated media sections are active.

### ElevenLabs and World Labs product behavior

ElevenLabs remains the current Audio provider. Dialogue audio generation moves
off generic Specs/Runs but preserves the current reviewed setup and focused Take
data:

- the provider Skill/CLI executes the exact ElevenLabs request through Engines;
- Preview uses the shared dialog with editable dialogue/provider text, no
  invented references, and read-only voice/model/format/language/settings;
- the final Asset stores the native request/receipt while the dialogue Take keeps
  the focused facts needed by dialogue editing and Cast voice continuity;
- Cast voice listing/sample retrieval and attachment remain supported through
  focused ElevenLabs methods and their existing focused provenance; and
- no public Take exposes a Generation Run id after migration.

When Preview is disabled, Audio Ask Before Generating still causes the agent to
pause immediately before execution. When both are disabled, an explicit user
Generate request may execute directly after validation. There is no approval
token in either path.

World Labs continues to accept the existing focused Location World generation
document, four ordered same-space images, prompt, and World Labs options. The
location-world Skill calls the existing command; the CLI uses Engines for all
provider work and Core only for successful Project persistence/selection.
Rollback, history/selection, temporary input image handling, downloaded world
artifacts, and the Spark viewer remain unchanged. Shared Preview/Inspection for
World Labs remains the already agreed later iteration.

### Error, retry, and recovery behavior

All provider operations fail with structured `EngineError`; the CLI converts
that error once to `@gorenku/studio-diagnostics`. Errors include provider, model,
safe message, stable code, HTTP status when known, retryability, `Retry-After`
when known, provider request/job id when known, and a secret-free cause chain.

Shared retry/polling mechanisms enforce these invariants:

- validation, authentication, authorization, balance/quota, content policy, and
  ordinary 4xx request failures are not retried unchanged;
- connection failures, HTTP 429, and provider-documented transient 5xx failures
  use bounded exponential backoff with jitter;
- a valid `Retry-After` header is honored within the operation deadline;
- a known asynchronous job is polled or recovered, never resubmitted merely
  because a poll or download failed;
- an ambiguous submit reuses provider idempotency when supported; provider code
  must not intentionally create a second paid job as transport recovery;
- provider, model, prompt, reference selection, duration, quality, count, or any
  other creative/cost setting is never changed as error recovery;
- every operation accepts `AbortSignal`, a bounded request timeout, a bounded
  polling deadline, and a bounded retry-attempt count; and
- timeout/exhaustion returns the known provider request id so the explicit
  `generation recover` command can continue when that provider supports it.

Each provider retains its tested classification rules, idempotency behavior,
default attempts, and terminal job states. The shared layer schedules retries;
it does not decide which provider errors are safe to retry. Tests use injected
clock/sleep/random functions and scripted HTTP/SDK clients, so ordinary test
runs never wait or make paid requests.

## Architecture Shape Gate

### Engines

```text
packages/engines/src/
  index.ts
  media/
    contracts.ts
    engine.ts
    local-files.ts
  providers/
    fal-ai/
    replicate/
    wavespeed/
    elevenlabs/
    world-labs/
  shared/
    metadata-cache.ts
    json-schema-validation.ts
    retry.ts
    polling.ts
    downloads.ts
    errors.ts
```

- `index.ts` exports public types, `createMediaEngine`, provider factories, cache
  factories, and focused World Labs API only; it contains no behavior.
- `media/engine.ts` dispatches through an injected provider map. It validates
  unique provider ids and delegates; it does not branch by model/media kind.
- Provider folders own SDK/client setup, identifiers, metadata extraction,
  validation, uploads, status/error classification, output, and recovery.
- World Labs exports dedicated `generateLocationWorld`; it is not forced through
  image/video model assumptions.
- Shared modules own mechanisms only: raw metadata cache, AJV execution, delay/
  backoff, polling timing, downloads, local-file traversal, structured errors.

Remove every `workspace:*` dependency and the `#core` alias. Engines defines its
own error/logger/artifact contracts. Callers pass API keys, cache, logger,
`AbortSignal`, and output directory. Engines never reads Renku state or secrets.

The same independence rule covers Engines E2E tests. Delete the current Core
build prerequisite and `tests/e2e/renku-provider-credentials.ts` dynamic Core
import. `packages/engines/tests/e2e/provider-test-credentials.ts` may read an
explicit environment credential only after that test's `RUN_*` opt-in flag is
set; this is test-only input, not a production credential resolver. Production
continues to receive the Core-owned saved credential through the CLI composition
root.

Each ordinary media provider folder uses the same reviewable internal shape
where the concern exists:

```text
client.ts       authenticated SDK/HTTP construction
metadata.ts     exact-operation metadata retrieval and schema extraction
validation.ts   native request validation
uploads.ts      LocalMediaFile to provider media conversion
execution.ts    submit and high-level provider flow
polling.ts      provider statuses and recovery
errors.ts       provider response classification
outputs.ts      response normalization and receipt sanitization
index.ts        provider factory exports only
```

Do not create empty files merely for symmetry. Existing Fal.ai/Replicate/
WaveSpeed files move into this shape only when it clarifies ownership; narrow
working modules may retain their current file split. A later provider follows
this shape without changing the public contracts. Provider `index.ts` files
export factories/types only.

The Engines package public surface deliberately excludes model enumeration,
price estimation, simulations, Renku credential descriptors, Preview resources,
Asset provenance storage, and generic Run recovery. `recover` is a provider job
operation that returns artifacts/receipt; it does not create durable state.

### Core

Core owns Asset provenance/migration/copy/Inspection; the small Preview document
and prompt update; project-relative path/provenance safety; per-media Settings;
and focused attachment commands. Core no longer imports Engines and never lists
models, fetches provider metadata, validates native fields, estimates, simulates,
executes, polls, retries, or recovers provider work.

The intended Core layout is:

```text
packages/core/src/client/media-generation-review.ts
packages/core/src/server/media-generation-review/
  document.ts
  local-media.ts
  safety.ts
  preview.ts
  prompt.ts
  inspection.ts
packages/core/src/server/assets/generation-provenance.ts
packages/core/src/server/project-settings/generation.ts
packages/core/src/server/provider-credentials/catalog.ts
```

- `document.ts` parses only the tiny review/provenance envelope, JSON limits,
  provider/model/media identity, and unknown top-level fields.
- `local-media.ts` resolves/deduplicates Project-relative markers and returns
  browser-safe general-media projections.
- `safety.ts` owns recursive secret/path/temporary-URL checks.
- `preview.ts` and `inspection.ts` build the same view resource from temporary
  review data or Asset provenance respectively.
- `prompt.ts` performs the one allowed atomic Preview mutation.
- `generation-provenance.ts` is called only by focused Asset attachment/copy
  commands; it is not a generic Asset JSON patch API. The existing
  `attachGenerationMedia` command remains the focused owner and replaces only
  its old receipt/source-Spec inputs with `generationProvenance`.
- `provider-credentials/catalog.ts` owns the five Renku credential descriptors
  and environment-variable names currently imported from Engines. Engines sees
  only the selected opaque credential string passed in `ProviderContext`.

Existing domain attachment owners continue to decide destination, ownership,
selection, filenames, dialogue Take linkage, and weak Shot Plan context. The new
generation boundary must not move those decisions into Engines, CLI, routes, or
Skills.

### CLI

CLI depends directly on Engines and Core and is the installed composition root:

```text
renku generation validate --file <review-file>
renku generation preview show --file <review-file> [--file ...]
renku generation execute --file <review-file> --output <dir>
renku generation recover --file <review-file> --request-id <id> --output <dir>
renku media import ... [--provenance <provenance-file>]
```

`validate`/`execute`/`recover` are Engines-provider commands. They parse the one
small review document through Core, resolve one credential and cache directory,
create the Engines registry, delegate once through the public `MediaEngine`
interface, and serialize. They reject `provider: 'codex'` as unsupported rather
than branching into a harness tool. Execute combines the unchanged review facts
with the opaque provider receipt into the final provenance handoff. `preview
show` delegates to Core and Studio coordination and supports both Engines and
Codex review documents. `media import` reads `--provenance` and delegates the
complete attachment to Core.

`renku location world generate/show` stays public; generate calls World Labs
Engines then one focused Core persistence command. Remove generation model,
context, reference, spec, estimate, run, `--simulate`, `--approval-token`, and
their handlers/tests without aliases.

The CLI module shape is:

```text
packages/cli/src/commands/generation/
  command.ts
  validate.ts
  preview.ts
  execute.ts
  recover.ts
  provider-registry.ts
  engine-context.ts
```

`provider-registry.ts` is the only Renku-installed list of provider factories.
It maps provider id to factory but contains no model ids or media rules.
`engine-context.ts` resolves the exact credential, platform cache directory,
logger, and cancellation/deadline inputs. Each handler parses one command,
delegates once, formats output, and translates structured errors. It does not
contain provider branches.

Successful Execute returns structured JSON containing downloaded artifact paths,
provider/model/request id, and a complete safe provenance value ready for a
focused attachment command. Recover returns the same result shape. Provider
receipt details stay opaque inside that result. The CLI owns no provider request
validation, upload, retry, polling, recovery, output normalization, or download
logic; those operations exist only behind Engines interfaces.

### Skills and release ownership

`studio-skills` contains no provider client or SDK:

```text
skills/
  media-producer/
  fal-ai-media-provider/
  replicate-media-provider/
  wavespeed-media-provider/
  elevenlabs-media-provider/
  location-world-producer/
```

Each provider Skill owns a supported-model index and one guide per supported
model/operation. Existing research is moved/revised, not discarded. Provider
Skills explain request fields, reference placement, prompting, output
expectations, and selection, then invoke only installed `renku` commands. Media
Producer routes Engines providers to those Skills; for Codex it checks the
active harness for the built-in `imagegen` capability and invokes that capability
directly after the shared conversational Preview.

The Studio runtime release bundles CLI, Engines, and dependencies. The Skills
release delivers instructions. No provider-specific executable is installed or
added to `PATH`.

### Studio

Refactor `generation-request-editor` into one shared Preview/Inspection module
using local shadcn controls. Studio receives Core browser-safe resources and
emits prompt-update/close intent only; it never imports Engines/SDKs and never
wakes or resumes an agent.

```text
packages/studio/src/features/media-generation-request/
  media-generation-request-dialog.tsx
  media-generation-request-view.tsx
  media-generation-prompt-panel.tsx
  media-generation-reference-grid.tsx
  media-generation-reference-card.tsx
  media-generation-configuration.tsx
  media-generation-configuration-projection.ts
  media-generation-configuration-control.tsx
  media-generation-diagnostics.tsx
  media-generation-preview-dialog.tsx
  media-generation-request-inspector-dialog.tsx
```

Move reusable prompt editor/theme, reference-card, tab/layout, diagnostics, and
dialog-navigation code from the existing editor/inspector directly. Delete old
model-family controls, provider-derived parameter controls, estimate UI,
reference-slot pickers, and domain-subject presentation when their callers are
gone. Do not retain wrapper components or compatibility re-exports. The module
entrypoint, if needed, exports the shared view and two dialogs only.

For the reopened Configuration remediation:

- `media-generation-configuration-projection.ts` owns one pure recursive
  projection from `JsonValue` to a Studio-local presentation tree. It may use
  only JSON type, object insertion order, array order, nesting, and deterministic
  key humanization. It contains no React, provider/model ids, known field names,
  option tables, numeric constraints, or domain interpretation.
- `media-generation-configuration-control.tsx` owns the scalar shadcn Input and
  Switch treatments and the bounded formatted-JSON fallback. Controls are
  read-only/disabled and emit no change intent.
- `media-generation-configuration.tsx` owns the former centered `538px`
  composition, label/control grid, recursive groups, empty states, and fallback
  placement. It remains focused on composition and does not parse provider
  semantics.
- `media-generation-request-view.tsx` remains the thin tab/content composition
  consumer and does not absorb Configuration projection logic.
- `media-generation-request-dialog.tsx` owns the complete common Dialog shell,
  including the sole `DialogContent` size/grid class list, header, shared request
  view, loading/unavailable placement, footer, and Close action. It exposes
  narrow slots for Preview navigation and Update only; it does not own loading,
  update, Asset, temporary-document, or multi-request state.
- `media-generation-preview-dialog.tsx` and
  `media-generation-request-inspector-dialog.tsx` become behavior controllers that
  prepare state and callbacks for the shared dialog. Neither renders
  `DialogContent`, `DialogHeader`, or `DialogFooter` directly.

Do not resurrect `GenerationEditorControl`, copy its schema-backed DTO under a
new name, or add a compatibility wrapper around the deleted editor. Reuse its
accepted layout measurements and local shadcn primitives directly in the new
owner. No `index.ts` change is required for this remediation.

Studio routes remain thin: validate HTTP input, call the focused Core Preview,
prompt-update, or Inspection function, serialize the response, and translate
diagnostics. They never read review JSON directly or enforce provider rules.

Replace the current Spec/File-id routes directly with:

```text
GET   /studio-api/projects/:project/generation-previews/files?path=<project-relative>
PATCH /studio-api/projects/:project/generation-previews/files?path=<project-relative>
GET   /studio-api/projects/:project/assets/:assetId/generation-request
```

GET/PATCH Preview address the temporary review file; PATCH accepts only
`{ prompt: string }`. Asset Inspection addresses the logical Asset because
provenance is Asset-level. Delete the old `/generation-previews/specs/:specId`
and `/assets/:assetId/files/:assetFileId/generation-request` routes/services and
update callers directly—no aliases.

### Metadata cache

Engines exposes cache abstraction plus memory/filesystem implementations. CLI
uses Renku's platform cache directory, not source control or the Project. Keys
include provider, exact model/operation, URL, and provider contract version where
available. Entries store unmodified response, fetch time, ETag, Last-Modified,
and cache directives.

Provider modules interpret their own metadata format. Shared cache never
normalizes schemas. Missing/stale metadata plus unavailable source is a
structured failure, not permission to guess.

Ordinary known-model execution never asks the agent to reread `llms.txt` or
reconstruct an API client. The provider module already knows its stable catalog/
operation-detail protocol and retrieves only the selected model's machine-
readable metadata. Skills use provider documentation when adding/updating a
supported model guide or investigating an unsupported operation, not for every
generation.

Respect provider HTTP caching semantics exactly:

- use fresh cached metadata without a network request when permitted;
- use `ETag`/`If-None-Match` and `Last-Modified`/`If-Modified-Since` when
  published;
- coalesce identical in-flight retrievals;
- use invocation-local memoization only for `no-store` responses;
- never serve stale metadata after a failed mandatory revalidation; and
- never copy cached metadata into package source, tests as a production
  fallback, or Skills as a maintained schema.

### Reusable services

Share only:

- metadata caching/conditional HTTP revalidation;
- AJV execution where a provider exposes JSON Schema;
- recursive local-file discovery and upload substitution;
- retry scheduling with jitter, deadline, and `Retry-After`;
- polling timing/cancellation with provider-owned status classification;
- URL download, MIME/size validation, atomic writes, recovery-safe redownload;
- structured `EngineError` and secret-safe logging.

Providers retain authentication, schema extraction, retry classification, job
states, endpoints, and response parsing. Do not duplicate mechanisms or
normalize provider contracts to make them look alike.

### Provider-specific refactor boundaries

- Fal.ai: preserve official client configuration, storage upload, subscribe/
  queue polling, request-id capture, timeout recovery, API error normalization,
  and response normalization. Replace the unified handler inputs with opaque
  native request plus live exact-model schema validation.
- Replicate: preserve official SDK invocation, `FileOutput` URL normalization,
  throttling/error parsing, and retry tests. Fetch the selected model/version
  input schema at runtime and cache only the unmodified response.
- WaveSpeed: preserve its current HTTP client, file upload, submit/poll/recovery,
  retry classification, and output normalization. Remove catalog/unified-handler
  coupling without reducing its supported media operations.
- ElevenLabs: preserve official SDK construction, text-to-speech binary stream
  collection, voice-id handling, voice sample retrieval, format/MIME behavior,
  concurrency/system-busy throttling, and focused error codes. It may expose
  focused audio/voice methods in addition to `MediaProvider`; do not force voice
  listing/sample retrieval through a fake generation model.
- World Labs: preserve its dedicated location-world request and result types,
  multi-image upload, operation polling, world artifact downloads, and recovery.
  It remains a focused API and is not made to pretend that a 3D World is an
  ordinary image/video artifact.

### Stop conditions

Stop and revise if:

- proven Fal/Replicate behavior is replaced with parallel clients;
- shared code learns model names, native fields, job states, pricing, Renku
  purposes, or Studio presentation;
- adding a model requires Engines changes when provider protocol did not change;
- Core/Studio imports an SDK or executes a provider;
- Engines imports a workspace package or reads Project state;
- Codex built-in generation enters Engines or Studio gains harness detection;
- CLI implements provider validation, upload, retry, polling, recovery, output
  normalization, or download instead of delegating through `MediaEngine`;
- Skills fetch full docs on every known-model request or recreate API clients;
- production Pika code, configuration, Skill guidance, fixtures, or paid tests
  enter this foundation phase instead of Plan 0190;
- a provider executable/release is introduced;
- Preview/Inspection gains provider-specific React or presentation schemas;
- Configuration rendering switches on provider/model ids or field names,
  invents option lists/bounds/units, or uses one-option selects to imitate
  unavailable metadata;
- the UI claims exact select/slider/model/input-mode parity while its resource
  contains only `JsonValue`;
- Preview and Inspection duplicate any part of the visual dialog shell or keep
  separate size/grid/header/footer class lists;
- Preview gains a Generate action or app-to-agent callback/wait protocol;
- attachment adds a job/session/output registry instead of reusing `media import`;
- Spec/Run/simulation/catalog code survives as compatibility.

## Public Contracts

### Engines

```ts
type JsonValue = null | boolean | number | string | JsonValue[] |
  { [key: string]: JsonValue };

interface LocalMediaFile { $file: string; mimeType?: string; }
interface ProviderRequest { model: string; input: JsonValue; }

interface ProviderRecoveryRequest extends ProviderRequest {
  requestId: string;
}

interface ProviderContext {
  credential: string;
  metadataCache: ProviderMetadataCache;
  fetch: typeof globalThis.fetch;
  logger?: EngineLogger;
  clock?: () => Date;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
  signal: AbortSignal;
  requestTimeoutMs: number;
  operationTimeoutMs: number;
}

interface ProviderExecutionContext extends ProviderContext {
  outputDirectory: string;
}

interface MediaProvider {
  readonly id: string;
  validate(request: ProviderRequest, context: ProviderContext): Promise<void>;
  execute(request: ProviderRequest, context: ProviderExecutionContext):
    Promise<ProviderExecutionResult>;
  recover?(request: ProviderRecoveryRequest,
    context: ProviderExecutionContext): Promise<ProviderExecutionResult>;
}

interface ProviderExecutionResult {
  provider: string;
  model: string;
  requestId?: string;
  artifacts: GeneratedMediaArtifact[];
  receipt?: JsonValue;
}

interface MediaEngine {
  validate(provider: string, request: ProviderRequest,
    context: ProviderContext): Promise<void>;
  execute(provider: string, request: ProviderRequest,
    context: ProviderExecutionContext): Promise<ProviderExecutionResult>;
  recover(provider: string, request: ProviderRecoveryRequest,
    context: ProviderExecutionContext): Promise<ProviderExecutionResult>;
}

interface GeneratedMediaArtifact {
  path: string;
  mimeType: string;
  byteLength: number;
  providerOutput?: JsonValue;
}

interface ProviderMetadataCache {
  read(key: ProviderMetadataCacheKey): Promise<CachedProviderMetadata | null>;
  write(key: ProviderMetadataCacheKey,
    entry: CachedProviderMetadata): Promise<void>;
  remove(key: ProviderMetadataCacheKey): Promise<void>;
}

interface ProviderMetadataCacheKey {
  provider: string;
  model: string;
  url: string;
  contractVersion?: string;
}

interface CachedProviderMetadata {
  body: JsonValue | string;
  contentType?: string;
  fetchedAt: string;
  expiresAt?: string;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
}

type EngineErrorCode =
  | 'ENGINE_PROVIDER_UNSUPPORTED'
  | 'ENGINE_AUTHENTICATION_FAILED'
  | 'ENGINE_METADATA_UNAVAILABLE'
  | 'ENGINE_METADATA_INVALID'
  | 'ENGINE_REQUEST_INVALID'
  | 'ENGINE_LOCAL_MEDIA_INVALID'
  | 'ENGINE_UPLOAD_FAILED'
  | 'ENGINE_SUBMIT_FAILED'
  | 'ENGINE_REQUEST_REJECTED'
  | 'ENGINE_RATE_LIMITED'
  | 'ENGINE_PROVIDER_UNAVAILABLE'
  | 'ENGINE_POLL_FAILED'
  | 'ENGINE_JOB_FAILED'
  | 'ENGINE_OPERATION_TIMEOUT'
  | 'ENGINE_CANCELLED'
  | 'ENGINE_RECOVERY_UNSUPPORTED'
  | 'ENGINE_RECOVERY_FAILED'
  | 'ENGINE_OUTPUT_INVALID'
  | 'ENGINE_DOWNLOAD_FAILED';
```

Context supplies credential, cache, logger, `fetch`, clock, `AbortSignal`, output
directory, and deadlines. Artifact contains local path, MIME, byte size, and
optional provider metadata—never Asset identity.

`EngineError` uses the closed `EngineErrorCode` union above and includes provider,
optional model/request id, HTTP status, retryable flag, retry delay, safe details,
and cause. CLI translates it once to a `StructuredError` with the same stable
code; Engines does not depend on `@gorenku/studio-diagnostics` or any other
workspace package.

The provider context fields are explicit:

- `credential: string`, supplied only to the selected provider factory;
- `metadataCache: ProviderMetadataCache`;
- injected `fetch`, logger, clock, sleep, and random functions;
- `signal: AbortSignal`;
- request and overall deadlines; and
- for execution/recovery, a caller-owned output directory.

There is no secret resolver, Project folder, Asset id, Run id, simulation mode,
price input, purpose, or target in Engines contracts.

`LocalMediaFile` is recognized only when an object has `$file`, optional
`mimeType`, and no other keys. `$file` may be any caller-readable local path in
the standalone library. The Renku CLI additionally requires a normalized
Project-relative path and resolves it to an absolute file before calling
Engines. Provider request validation occurs once with safe hosted-URL stand-ins
for these values and again with actual uploaded URLs before submission; neither
stand-in nor uploaded URL replaces the marker in review/provenance.

### Preview and provenance

```ts
interface MediaGenerationReviewDocument {
  provider: string;
  model: string;
  mediaKind: 'image' | 'video' | 'audio';
  prompt: string | null;
  request: JsonValue;
}

interface MediaGenerationExecutionReport {
  requestId?: string;
  artifacts: GeneratedMediaArtifact[];
  provenance: MediaGenerationProvenance;
}
```

`MediaGenerationExecutionReport` is the CLI's serialized success shape composed
from public Engines artifacts and the Core-owned provenance value. It is not a
Core contract, and Core never imports `GeneratedMediaArtifact` or Engines.

- `MediaGenerationPreviewResource` is the browser-safe projection with
  references discovered from local-file markers.
- `MediaGenerationProvenance` is the six-field Asset envelope above.
- `Asset.generationProvenance: MediaGenerationProvenance | null`.
- `renku generation execute/recover` return
  `MediaGenerationExecutionReport`; a provider Skill writes its exact
  `provenance` member to the file passed to `media import --provenance`.

No Asset/AssetFile id pair, purpose, target, domain role, field pointer, schema
annotation, price, approval, or Run field enters these contracts.

The review document is a temporary operation file used to carry one request
through Preview and either Engines validation/execution or Codex built-in
generation. It is not stored in the database, does not have an
id/lifecycle/status, and is not a renamed Generation Spec.

The browser resource contains:

```ts
interface MediaGenerationPreviewResource {
  kind: 'mediaGenerationPreview';
  documentPath?: string; // Preview only; Project-relative temporary path
  provider: string;
  model: string;
  mediaKind: 'image' | 'video' | 'audio';
  prompt: string | null;
  references: Array<{
    kind: 'image' | 'video' | 'audio';
    projectRelativePath: string;
    browserUrl?: string;
    available: boolean;
  }>;
  configuration: JsonValue;
  editable: boolean;
  diagnostics: DiagnosticIssue[];
}
```

Inspection omits `documentPath` and sets `editable: false`. Preview sets
`editable: true` only when a prompt exists. This resource is one presentation
projection shared by both dialogs; it is not persisted on Asset.

### Structured diagnostics

The exact new Core codes are:

- `CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID`;
- `CORE_MEDIA_GENERATION_REVIEW_INVALID`;
- `CORE_MEDIA_GENERATION_REVIEW_UNSAFE`;
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND`;
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT`;
- `CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED`;
- `CORE_MEDIA_GENERATION_PROVENANCE_INVALID`;
- `CORE_MEDIA_GENERATION_PROVENANCE_UNSAFE`;
- `CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED`; and
- `CORE_MEDIA_GENERATION_PROVENANCE_CONFLICT`.

`PROVIDER_CREDENTIALS004` means the selected Engines provider has no configured
credential. CLI input continues to use existing `CLI080`, `CLI082`,
`PROJECT_DATA201`, and `CLI090`; Preview delivery continues to use `CLI144`.
Studio HTTP validation reuses `STUDIO_SERVER010` and passes Core codes through.
The CLI maps the closed `EngineErrorCode` values above without inventing a second
CLI code for each provider failure. Codex capability absence is a Media Producer
conversation outcome, not a fake runtime diagnostic from Engines.

Obsolete Generation Spec/Run/approval/simulation codes are removed, not retained
as aliases. The ADR and CLI reference list these exact surviving/new codes.

## Implementation Slices

### 1. Lock the standalone Engines boundary

- Add Decision 0086 and the exact supersession/narrowing notices listed under
  Documentation And ADR Effects.
- Add Engines-local contracts/errors; remove workspace dependency and `#core`.
- Move Renku credential descriptors from Engines into Core's provider-credential
  catalog so Engines receives only one opaque credential string.
- Remove Engines E2E's Core build prerequisite/dynamic import and replace it
  with the explicit opt-in test credential helper; production credential
  resolution remains in Core/CLI.
- Add a standalone consumer fixture using only built Engines output.
- Inventory generic exports and Core callers before deletion.

### 2. Extract shared mechanisms

- Extract retry timing, polling, raw cache, AJV execution, local-file traversal,
  downloads, and logging only where retained providers share them.
- Keep provider policy beside providers; delete simulation-only media.

### 3. Refactor Fal.ai, Replicate, and WaveSpeed

- Move existing Fal.ai subscribe/recovery/error/output behind `MediaProvider` and
  preserve its focused tests.
- Move existing Replicate SDK/retry/output behind the contract and add live
  schema retrieval/cache without snapshots.
- Preserve and refactor the current WaveSpeed client, retry, polling, upload,
  and output behavior behind the same contract; remove only its generic runtime
  dependencies.
- Delete unified handler, mapping, pricing, simulation, and catalog dependencies
  only after equivalent provider tests pass.

### 4. Refactor ElevenLabs and World Labs

- Convert ElevenLabs audio/voice operations to Engines-local contracts; preserve
  error/retry tests and remove generic handler/Run assumptions.
- Move all World Labs request/upload/poll/recovery/download behavior into Engines.
- Split Core Location World generation into Project input/persistence and Engines
  execution while preserving Skill, CLI nouns, selection, rollback, and viewer.

### 5. Prove the provider extension seam

- Add one minimal test-only Atlas-like `MediaProvider` fixture outside the
  production registry. Exercise validation, one `LocalMediaFile`, execution,
  recovery, artifact normalization, structured failure, and cancellation only
  through the built Engines public surface.
- Inject the same fixture into the CLI registry in tests and prove the CLI
  parses, delegates once, serializes, and maps `EngineError` without learning
  provider protocol fields or branching on provider id.
- Use this proof and the standalone consumer to close every architectural gap
  before Plan 0190. Do not add a production provider, credential, Project
  setting, Skill, schema/catalog fixture, provider-specific CLI command, or paid
  request in this slice.

### 6. Replace CLI generation

- Add `validate`, `preview show`, `execute`, and `recover` exactly as specified.
- Keep provider registration in one CLI composition root.
- Resolve existing credentials in CLI and pass one secret to Engines.
- Replace `media import --receipt/--source-spec` with
  `media import --provenance`; refactor the existing Core attachment input and
  direct grouped Storyboard/Cast Voice callers without a second import path.
- Remove old generation commands/flags and Run-backed recovery state without
  compatibility aliases; keep only the stateless provider-job `recover` command
  defined by this plan.
- Refactor Location World generate to Engines plus focused Core persistence.

### 7. Preserve Preview, Inspection, and provenance

- Add tiny review/provenance and local-file projection in Core.
- Refactor existing UI onto one schema-free view; Preview alone edits prompt and
  exposes Update/Close only.
- Restore the Configuration tab from generic text rows to the accepted former
  desktop control composition using the schema-free JSON-type projection defined
  in Reopened Configuration UI Analysis. Keep the shared Preview/Inspection
  component and the unchanged Core resource.
- Store Asset provenance and use it for Inspection and Asset copy.
- Keep reference/configuration editing and Preview continuation in the normal
  agent conversation; add no app-to-agent execution coordination.
- Support Codex review/provenance/Inspection through the same envelope without
  registering Codex in Engines or adding freeze/status state.

### 8. Remove Specs/Runs and migrate provenance

- Generate schema changes with Drizzle Kit.
- Convert every attached managed/agent-external record into safe Asset
  provenance before removing tables/columns.
- Preserve focused ElevenLabs Take facts and weak Shot Plan context still needed
  by current domain behavior.
- Abort on conflicting Asset requests; report/discard unattached Specs/Runs.
- Drop Specs, Runs, approval/simulation state, file links, and last-Spec state.

### 9. Reorganize Settings

- Apply accepted Image/Video/Audio Settings and one-way migration.
- Rebuild Studio Settings with shadcn controls.
- Keep Fal.ai/ElevenLabs/World Labs credentials; keep Replicate and WaveSpeed
  credentials available for explicit Skill use without a Project preference.
- Update Media Producer context with per-media provider/policy.

### 10. Refactor Skills and document provider addition

- Preserve Media Producer's existing direct Codex `$imagegen` dispatch when that
  built-in Skill is available. Refactor only the surrounding workflow to use
  conversational Preview, Engines-backed provider Skills, artifact review, and
  `media import --provenance`; remove the old Codex Spec/freeze steps.
- Rehome current provider/model research; remove Spec/Run/model-list instructions
  without deleting useful prompt guidance.
- Add/refactor model indexes/guides for Fal.ai, Replicate, WaveSpeed, and
  ElevenLabs; retain World Labs in Location World Producer.
- Add `packages/engines/docs/adding-a-provider.md` covering module layout,
  contract, credentials, metadata/cache, validation, upload, retry/poll/recovery,
  output/download, exact error mapping, tests, CLI registration, Skill guide,
  release, and the rule that normal provider addition does not change Core,
  Studio, the database, Preview, or shared request schemas.
- Verify the guide with one minimal test-only Atlas-like provider fixture that
  uses the public package surface and an injected CLI registry in tests only;
  do not add Atlas to the production registry or implement a production provider
  client.

### 11. Delete obsolete package surface

- Delete LLM/OpenAI/Vercel implementations while preserving WaveSpeed media.
- Remove `ai`, `@ai-sdk/openai`, unused catalog/simulation dependencies, scripts,
  exports, and package files.
- Remove Core's Engines dependency and all Core-owned provider execution.
- Update current architecture/CLI/distribution/Settings/Asset/Skill docs. Add no
  shims and do not rewrite historical plan bodies.

## Data Migration And Destructive Effects

The one-way migration:

1. Adds nullable Asset provenance and accepted weak Shot Plan context needed
   after Specs disappear.
2. Converts every generation record reachable from an Asset.
3. Verifies one coherent request/receipt per Asset and safe local references.
4. Preserves focused dialogue Take data and Location World records.
5. Removes file-level links, Spec/Run tables, and last-Spec state.
6. Reports unattached Specs/Runs and deletes them.

Use a backed-up Urban Basilica copy. No generated Asset/media file is deleted.
Runtime code recognizes only the new shape.

The Drizzle TypeScript schema is the source of truth. Generate the SQL migration
with Drizzle Kit, then document the custom data-conversion portion required
before destructive drops. The final database shape:

- adds nullable `asset.generation_provenance`;
- adds or preserves only the accepted weak Asset-level Shot Plan authoring
  context needed by Scene Generations after Specs disappear;
- removes `asset_file.source_generation_spec_id`;
- removes `asset_file_generation`;
- removes `media_generation_run` and `media_generation_spec`;
- removes Shot Plan last-Spec continuation columns/relations; and
- removes `generationRunId` from dialogue/Shot/Asset public projections where it
  existed only to reach provider provenance.

Conversion precedence is explicit:

1. For an attached live managed Run, use its final provider/model, submitted
   provider payload, output/diagnostic receipt facts, and the Spec's reviewed
   prompt/references.
2. For an attached agent-external/frozen request with no Run, use its exact saved
   provider/model/request and no invented receipt.
3. For ElevenLabs dialogue audio, prefer focused Take snapshots for final text,
   voice, model, format, language, and voice settings when they are more precise
   than the generic Run projection.
4. Convert provider upload URLs back to the exact durable project-relative
   references already recorded by the Spec/File link; never preserve the signed
   transport URL.
5. When several AssetFiles belong to one Asset, require their source records to
   resolve to the same logical request. Abort before table drops on conflicts.
6. Preserve weak Shot Plan `authoredFrom` only for current grouping/reference/
   invalidation behavior. It is not displayed as generation provenance and does
   not create ownership or an FK lifecycle.

Migration tests capture before/after counts for Assets, AssetFiles, Specs, Runs,
file-generation links, agent-external Specs, dialogue Takes, and Shot Plan
outputs. They inspect representative Fal.ai, Codex-external, Replicate/
WaveSpeed where present, ElevenLabs, copied-image, compound-Asset, and Location
World records. Unattached Spec/Run counts are reported as deliberately discarded.

## Tests And Guardrails

### Engines owning layer

- Provider registration/delegation/cancellation/local-file/output/error tests.
- Shared retry tests for attempts, jitter, deadlines, `Retry-After`, cancellation;
  providers own retry classification.
- Cache tests for hit, refresh, expiry, no-store, corruption, concurrent fetch;
  providers own schema extraction.
- Fal.ai regression tests for configuration, upload, subscribe, request id,
  recovery, errors, output.
- Replicate regression tests for invocation, live schema validation, throttle,
  retry exhaustion, output.
- WaveSpeed regression tests for its current upload, invocation, polling,
  throttling, recovery, and output behavior.
- ElevenLabs tests for audio, voice, validation, 429/system busy, secret safety.
- World Labs tests for upload, generate, poll, error, timeout, recovery, download.
- The Atlas-like test-only fixture proves the public provider seam, including
  CLI injection, without a network request or production registration.
- Existing paid smoke tests remain explicit and are never required to prove the
  refactor; run none without separate user approval.

### Core, CLI, Studio, migration

- Core review tests accept the exact small envelope; enforce JSON depth/size and
  unknown top-level fields; reject absolute/traversing paths, unsafe URLs, secret
  material, and non-JSON values; accept Codex review documents without calling
  Engines; and never validate provider-native fields.
- Prompt-update tests prove only top-level prompt changes, the write is atomic,
  stale/missing documents fail clearly, and provider request JSON is untouched
  until the Skill supplies its rebuilt request. Coordination tests prove Preview
  delivery returns immediately and Update/Close emits no agent-resume event.
- Reference projection tests cover image/video/audio markers, recursive arrays/
  objects, deduplication/order, MIME inference, browser URLs, discarded files,
  and absence of Asset/AssetFile ids.
- Attachment/copy tests cover `media import --provenance`, Codex provenance with
  no receipt, provider provenance with an opaque receipt, direct grouped
  Storyboard/Cast Voice cutovers, required-provenance purposes, exact preservation,
  immutable copy, unsafe/conflicting provenance rejection before writes, and
  nullable external imports.
- Migration tests preserve all reachable Urban Basilica generated Assets and
  stop before drops on conflicts.
- CLI tests cover repeated ordered Preview files, one-call Engines delegation,
  exact credential/cache injection, no secret output, artifact/provenance result,
  recover support/unsupported errors, Studio-unavailable diagnostics, and
  obsolete-command absence. They prove `preview show` accepts Codex while
  `validate`/`execute`/`recover` do not and prove CLI contains no provider
  protocol behavior.
- Shared view tests prove Preview and Inspection render the same header/tabs/
  cards/config/diagnostics; prompt is editable only in Preview; References and
  Configuration are read-only in both; nested objects, arrays, primitives, null,
  empty/large values, and JSON fallback preserve exact content.
- Shared dialog tests render Preview and Inspection through the same
  `MediaGenerationRequestDialog` and prove identical DialogContent dimensions,
  grid rows, header, tab/content insets, footer, and Close placement. The only
  allowed structural differences are Preview navigation, Update, editable
  prompt state, pending/error state, and Inspection loading/unavailable state.
- Architecture coverage forbids `DialogContent`, `DialogHeader`, and
  `DialogFooter` imports in the two controller files so shell duplication cannot
  return. This protects an import boundary, not a private helper name.
- Configuration projection tests prove object and array order, exact primitive
  values, deterministic key humanization, null/empty behavior, bounded depth and
  size fallback, and absence of mutation. The fixture set includes unfamiliar
  keys and provider ids so a provider/field-name presentation map cannot satisfy
  the tests.
- Configuration component tests prove the former `538px`, `38px`, `48px`,
  `18px`, `150px / 360px`, and `28px` layout measurements; local shadcn Inputs
  for string/number values; disabled Switches for booleans; no raw HTML controls;
  and no Select/Slider semantics when no options or bounds exist in the resource.
- Desktop screenshot tests cover representative flat image configuration and
  nested/array configuration in the 1120-by-760 shared dialog. Compare the whole
  dialog—not a cropped field list—with the prior implementation and the
  surrounding Studio context before accepting the remediation.
- Dialog tests preserve current multi-request navigation, prompt editor keyboard
  behavior, Update/Close footer behavior, loading/empty/unavailable states, and
  desktop dimensions; they prove no Generate action is rendered. No mobile
  verification is planned.
- Settings tests cover the exact options/order/copy, fresh defaults, old-to-new
  migration mapping, concurrency-off effective limit, global Preview, hidden
  unsupported Audio options, and no Replicate/WaveSpeed/World Labs preference.
- ElevenLabs tests cover shared Preview, dialogue text update, direct execution
  policy, Take facts, Asset provenance, Cast voice operations, and removed Run
  identity. Location World regression tests cover the specialized command,
  persistence, selection/rollback, artifacts, and viewer.
- Media Producer evals cover Codex capability present, Codex capability absent,
  no silent provider fallback, conversational Preview pause/reread, direct
  `imagegen` invocation, provider-Skill routing, and common provenance attachment.

### Architecture guardrails

- Engines manifest/import/script tests forbid every workspace dependency,
  `@gorenku/studio-*`, `#core`, Core build prerequisite, and dynamic Core test
  import; the built-package consumer and minimal test-only provider fixture use
  only Engines public interfaces.
- Core import tests forbid Engines/provider SDKs.
- Studio frontend tests forbid server/provider imports.
- CLI boundary tests prove handlers call public `MediaEngine` methods once and
  do not own provider validation/upload/retry/poll/recovery/output/download.
- Capability checks prove no production Spec/Run/approval/simulation/pricing/
  catalog/schema persistence remains.
- Contract tests prove no presentation registry, JSON pointer map, domain role,
  Asset/AssetFile pair, price, or Run state.
- Architecture tests protect imports/public capability, not private names.

## Documentation And ADR Effects

Add
`docs/decisions/0086-use-skill-directed-provider-engines-and-asset-generation-provenance.md`.
It accepts the standalone Engines boundary, Skill-owned provider/model choice,
temporary conversational Preview, Asset-level generation provenance, the
focused `media import --provenance` attachment contract, harness-gated Codex
built-in generation, and removal of the generic Spec/Run/estimate/approval/
freeze runtime.

Update `docs/architecture/media-generation.md` to state the exact schema-free
Configuration presentation boundary: the resource remains `JsonValue`; Studio
may project JSON structure and primitive types into read-only shadcn controls;
and Studio must not infer choices, bounds, units, provider groups, or model
capabilities that the resource does not contain. Under the recommended option,
Decision 0086 and the public Core/CLI contracts do not change. If the user
chooses exact former control semantics instead, stop and write a separate ADR
for the new presentation-metadata owner before changing any runtime contract.

Only add a short notice at the top of each affected historical ADR; do not
rewrite its historical body. The notices have these exact effects:

| Decision | Effect of Decision 0086 |
| --- | --- |
| 0002 | Retains the Engines name and provider-adapter ownership, but narrows Engines to standalone asset-generation provider protocols with no workspace dependency or Studio/Core product concepts. |
| 0020 | Supersedes persisted Generation Specs and Runs. Retains explicit attachment through `renku media import`, now with optional Asset provenance instead of Spec/Run identity. |
| 0025 | Supersedes the shared generation lifecycle, purpose registry, dependency, pricing, and execution orchestration. Retains focused Core purpose/target validation and attachment ownership. |
| 0040 | Retains Codex as an external harness capability outside Engines and retains explicit normal media import. Replaces saved/frozen external Specs and approval machinery with temporary conversational Preview and Asset provenance; the invoking Skill must verify the capability exists. |
| 0042 | Supersedes purpose cost projections and generation estimates. |
| 0043 | Supersedes live-run approval flags, approval tokens, and estimate-bound run approval. Ask Before Generating remains only the Project workflow preference described by Decision 0074 and is satisfied through ordinary conversation. |
| 0044 | Supersedes the old Core lifecycle/dependency/cost and Engines catalog/pricing module layout. Retains the rule that architecture tests protect stable boundaries rather than private implementation names. |
| 0045 | Supersedes saved-Spec Preview bindings and provider-specific Preview builders. Retains Preview as a shared interaction, now projected from one temporary review document or Asset provenance. |
| 0047 | Supersedes the generic GenerationSpec authoring/runtime, pricing, catalog, and Run contracts. Retains context-first Skill authoring, Engines validation of exact provider-native requests, and focused post-generation attachment. |
| 0049 | Supersedes persisted GenerationSpec reference choices and Core-owned Preview selection commands. Retains the principle that the user/agent chooses exact references for one request; changes happen conversationally and the Skill rebuilds the request. |
| 0051 | Supersedes persisted incomplete-generation authoring, typed generation slots, and provider-field authoring in Core. Retains agent-owned creative/reference choices and provider validation at the Engines boundary. |
| 0055 | Supersedes agent-external Generation Specs. Codex provenance is stored directly on the attached Asset and has no invented Engines receipt. |
| 0056 | Supersedes Generation Spec freezing, `generation spec freeze`, and frozen-Spec attachment requirements for both provider and Codex paths. |
| 0057 | Retains exact opaque prompts and Skill-owned model-specific prompt guidance. Supersedes the Engines Studio model catalog, family-route resolution, Spec-backed Config authoring, and rich generation-request lifecycle described there; Preview configuration is read-only provider-native JSON. |
| 0058 | Retains agent-owned image editing, artifact inspection, output acceptance, and focused attachment. Replaces Spec/Run/freeze provenance with temporary review plus Asset provenance. |
| 0062 | Retains independent Project-owned video Assets, mutable Shot Plans, and weak `authoredFrom` context. Removes last-Spec continuation and frozen Spec/Run provenance; Asset provenance supplies the durable generation facts. |
| 0063 | Retains thin Shot documents, Shot-owned image candidates, and focused selection. Replaces the Codex saved/approved/frozen Spec workflow with capability-gated built-in generation, conversational Preview, and Asset provenance. |
| 0069 | Retains Shot Plan video purposes, weak one-way context, independent Assets, and Scene projection. Replaces the Core generation catalog/Spec/estimate/freeze lifecycle with Skill-authored provider requests, Engines execution, and Asset provenance. |
| 0074 | Retains the Core-owned versioned Project Settings document and agent-owned concurrency. Replaces its generation settings shape with the exact per-media shape in this plan and removes estimate/approval-token policy; Preview/Ask confirmation remains conversational. |
| 0076 | Retains the human-readable folder contract and Core path ownership. Shot Plan destinations derive from safe Asset provenance rather than a frozen Spec or Run. |
| 0080 | Retains Storyboard Lookbook authority, reference roles, Beat batching, composite/crop behavior, and agent visual review. Replaces the Codex saved/frozen Spec lane and old image setting with this plan's capability-gated conversational Preview, per-media setting, and Asset provenance. |
| 0084 | Retains global write-only production credential storage and Core secret-file ownership. Moves the ordered credential descriptor catalog from Engines to Core and expands it to the exact five provider credentials in this plan. Supersedes its requirement that standalone Engines paid E2E tests import the Core credential resolver; those manual-only package tests receive an explicit test environment credential after opt-in. |

Decision 0032 is already superseded and needs no new notice. Decisions 0041,
0064, 0082, 0083, and 0085 remain materially unchanged: creative opacity,
Asset ownership/selection, Location World product behavior, cover attachment,
and platform-config ownership continue to apply.

Rewrite these current documents to the final contracts:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/studio-coordination-events.md`;
- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`;
- `docs/operations/distribution-and-release.md`;
- `packages/engines/README.md`; and
- `packages/engines/tests/e2e/README.md`.

After moving any still-useful provider/model guidance into `studio-skills`,
delete obsolete current-architecture references that describe only the removed
runtime:

- `docs/architecture/generation-preview-purpose-bindings.md`;
- `docs/architecture/reference/context-first-generation-caller-handoff.md`;
- `docs/architecture/reference/context-first-generation-foundation-manifest.md`;
  and
- `docs/architecture/video-generation-model-capabilities.md`.

Update Media Producer/provider Skills, model indexes, examples, and evals.

Rewrite the Engines README and add
`packages/engines/docs/adding-a-provider.md`. That guide is a required product
artifact, not optional follow-up. It must walk through one minimal test-only
provider fixture using only Engines public interfaces: provider registration,
model metadata/schema loading and cache behavior, request validation, local
media upload, execute/poll/recover, output download, closed `EngineErrorCode`
mapping, deterministic tests, and package checks. It must explicitly state that
a provider addition does not add Core/Studio/database/Preview concepts, cannot
add a workspace dependency, and does not require CLI protocol logic or a new
CLI executable. Any new credential descriptor or Project Settings choice is a
separate Studio product decision.

## Final Verification

```bash
pnpm test:engines
pnpm test:core
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm build
pnpm test
pnpm lint
pnpm check
```

Also:

1. Run sister `studio-skills` validation/evals for Media Producer/provider Skills.
2. Build Engines and run standalone consumer with no workspace package.
3. Migrate backed-up Urban Basilica and compare Asset/provenance inventories.
4. Manually verify desktop Preview, prompt editing, generalized references,
   configuration, Inspection, Settings, ElevenLabs audio, Location World.
5. Compare Fal.ai/Replicate focused tests before/after and run the standalone
   consumer plus Atlas-like test-provider path.
6. Confirm no production Pika code, configuration, credential, setting, Skill,
   fixture, or E2E entered this plan's implementation.
7. Run any paid smoke test only with separate explicit user approval.
8. Inspect `git diff --stat`, full diff, and heavily modified files.
9. Confirm thin `index.ts`, provider-agnostic shared modules, and no broad
   registry/dispatcher.
10. Confirm unrelated dirty changes were not reformatted/overwritten.
11. Capture the reopened Configuration tab in Chrome at the real desktop scale
    for both Preview and Inspection. Compare spacing, typography, control sizes,
    tab/header/footer alignment, and surrounding dialog geometry with the former
    implementation. Do not accept generic text rows, definition-list styling,
    guessed controls, or filename-like raw keys as equivalent.

## Completion Checklist

### Review Area

- [x] Implement as refactor of proven provider code, not parallel rewrite.
- [x] Keep the five existing media providers, including WaveSpeed; remove LLM
      providers.
- [x] Preserve Preview, Inspection, prompt editing, provenance, Settings,
      ElevenLabs, and specialized World Labs.
- [x] Keep Codex built-in image generation important but harness-gated: use it
      only when the active harness exposes `imagegen`, never register it in
      Engines, and never silently fall back to a paid provider.
- [x] Keep Preview continuation conversational; add no Generate event, callback,
      correlation token, resumable job, or wait service.
- [x] Reuse the existing focused media import/attachment path with one optional
      provenance input; add no attachment session, output registry, or pending
      attachment state.
- [x] Keep Replicate explicit/Skill-only and World Labs outside Settings.
- [x] Lose no attached generated Asset or media file.

### Architecture And Contracts

- [x] Make Engines standalone with no workspace/Renku domain dependency.
- [x] Implement exact provider/request/result/artifact/cache/error contracts.
- [x] Keep the closed `EngineErrorCode` union and map those same codes at the CLI
      boundary without importing Studio diagnostics into Engines.
- [x] Keep provider request/receipt JSON opaque and envelope irreducible.
- [x] Remove Core's Engines dependency/provider execution.
- [x] Move the ordered provider credential descriptor catalog to Core; pass
      Engines only the one resolved opaque credential required for the call.
- [x] Remove Engines E2E's Core build/import dependency; keep explicit
      environment credentials test-only and opt-in.
- [x] Keep CLI the only installed composition root; add no provider CLI.
- [x] Keep every CLI generation handler to parsing, one public `MediaEngine`
      delegation, serialization, and structured error mapping.
- [x] Match Architecture Shape Gate and keep `index.ts` thin.

### Providers

- [x] Preserve/adapt Fal.ai subscribe, recovery, error, upload, output, tests.
- [x] Preserve/adapt Replicate SDK, retry, output, tests.
- [x] Preserve/adapt WaveSpeed client, retry, polling, output, tests.
- [x] Preserve/adapt ElevenLabs audio, voice, retry, tests.
- [x] Move all World Labs protocol to Engines; preserve product flow.
- [x] Prove provider addition through the public Engines surface and injected
      CLI registry with the Atlas-like test-only fixture.
- [x] Keep all production Pika implementation and adoption work in Plan 0190.
- [x] Share only cache, AJV execution, file traversal, timing, download, errors.

### CLI And Skills

- [x] Add generation validate/preview/execute/recover with thin handlers.
- [x] Make validate/execute/recover reject `provider: 'codex'`; make Preview
      accept the shared Codex review envelope without routing it to Engines.
- [x] Replace `media import --receipt`/`--source-spec` with the exact optional
      `media import --provenance <project-relative-json-file>` contract and no
      aliases.
- [x] Preserve location world generate/show.
- [x] Remove old generation commands/flags without aliases.
- [x] Preserve Media Producer's existing direct Codex `$imagegen` dispatch when
      that built-in Skill is available; refactor its surrounding provider,
      Preview, and common provenance-attachment instructions only.
- [x] Add/refactor model indexes/guides for the five existing Engines providers,
      retaining World Labs in its focused Location World Skill.
- [x] Keep Skills free of SDK/client/retry/poll code.

### Preview, Provenance, Settings, Migration

- [x] Refactor Preview/Inspection onto one shared component family.
- [x] Keep prompt editing only in Preview; references/config read-only.
- [x] Preserve the 1120-by-760 desktop composition, tabs, prompt-editor behavior,
      reference cards, diagnostics, multi-request navigation, and footer states.
- [x] Keep only Update and Close actions; return from Preview immediately and
      prove neither action emits an agent-resume or execution intent.
- [x] Replace Spec/File-id HTTP routes with temporary-file Preview and Asset-level
      Inspection routes without aliases.
- [x] Render recursive provider JSON and general image/video/audio references
      without model/provider presentation maps.
- [x] Persist the exact safe `MediaGenerationProvenance` in
      `asset.generation_provenance`, allowing Codex provenance with no receipt
      and provider provenance with its opaque receipt.
- [x] Refactor existing focused attachment commands in place, including grouped
      Scene Storyboard and Cast Voice documents; add no second import service.
- [x] Migrate all reachable legacy records; abort on conflicts.
- [x] Discard unattached Specs/Runs; remove obsolete tables/readers/links.
- [x] Implement accepted Image/Video/Audio Settings and global Preview.
- [x] Preserve/add all five write-only provider credentials, including WaveSpeed,
      while keeping Replicate/WaveSpeed/World Labs out of Project preferences.
- [x] Preserve ElevenLabs dialogue/voice behavior and specialized World Labs
      Location World behavior without generic Runs.

### Generic Runtime And LLM Removal

- [x] Remove neutral schemas/transforms, checked schemas, catalogs, pricing,
      simulation, schema scripts.
- [x] Remove Specs, Runs, estimates, approvals, and Run-backed recovery state;
      keep only the stateless provider-job recovery contract defined here.
- [x] Remove LLM/OpenAI/Vercel code, dependencies, exports, tests while
      preserving WaveSpeed media support.
- [x] Remove unused dependencies/files; add no shims/fallback readers.

### Tests, Documentation, Final Verification

- [x] Keep complete edge coverage at Engines/provider owning layers.
- [x] Add standalone/import/cache/file/CLI/Core/migration/UI/Settings/World tests.
- [x] Add Codex-present/Codex-absent Skill evals, no-fallback coverage, direct
      `imagegen` coverage, and common Preview/provenance/attachment coverage.
- [x] Add the Engines-local opt-in E2E credential input and update the E2E README
      without adding or executing a Pika E2E in this phase.
- [x] Assert every exact Core/CLI/Engine diagnostic named in this plan.
- [x] Add stable capability guardrails without private-name needles.
- [x] Add Decision 0086 and every exact supersession/narrowing notice listed in
      Documentation And ADR Effects; leave the named unchanged ADRs unchanged.
- [x] Update every current architecture/product/CLI/Settings/provenance/Skill
      document named in this plan.
- [x] Move useful model guidance to Skills and delete the four obsolete
      current-architecture references named in Documentation And ADR Effects.
- [x] Add and verify `packages/engines/docs/adding-a-provider.md` with the minimal
      test-only provider fixture and explicit standalone/CLI boundaries.
- [x] Run focused/root checks and sister Skill tests.
- [x] Migrate/inspect backed-up Urban Basilica and complete desktop QA.
- [x] Review diff/stat and split large mixed-responsibility files.
- [x] Confirm no god file, catch-all, broad switchboard, or duplicated mechanism.
- [x] Confirm no checklist item accepts unreviewable structure.
- [x] Only then mark plan complete.

### Reopened Configuration Remediation

- [x] Obtain explicit approval for the schema-free JSON-type-driven control
      direction, or stop and plan the presentation-metadata alternative.
- [x] Remove the generic definition-list/bordered text-row Configuration UI.
- [x] Restore the former centered control composition and exact desktop spacing,
      typography, control sizes, disabled/read-only states, and grouping.
- [x] Move the entire Preview/Inspection visual shell into one shared
      `MediaGenerationRequestDialog`; leave only behavioral state in the two
      controller files.
- [x] Prove the controller files do not import or render `DialogContent`,
      `DialogHeader`, or `DialogFooter`, and that Preview-only navigation/Update
      are narrow additions to the shared tab bar/footer.
- [x] Use only JSON type, order, nesting, exact values, and deterministic key
      humanization; add no provider/model/field-name presentation map.
- [x] Render strings and numbers as read-only Inputs, booleans as disabled
      Switches, null as `Not set`, and nested/array values as ordered groups.
- [x] Add pure projection coverage for unfamiliar keys, every JSON type, order,
      null/empty values, depth/size fallback, and exact value preservation.
- [x] Add component coverage for the exact former layout measurements and local
      shadcn controls, including absence of fake Select/Slider semantics.
- [x] Capture and compare full 1120-by-760 Preview and Inspection screenshots in
      Chrome against the prior implementation and surrounding Studio context.
- [x] Update `docs/architecture/media-generation.md` with the presentation
      boundary and confirm Decision 0086 needs no change under option 1.
- [x] Inspect the focused diff and large files; confirm the request view remains
      thin and no schema, heuristic, wrapper, or broad configuration component
      was introduced.
