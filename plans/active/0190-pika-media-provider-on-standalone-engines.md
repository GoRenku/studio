# 0190 Pika Media Provider On Standalone Engines

Status: complete
Date: 2026-08-24
Updated: 2026-08-26
Completed: 2026-08-26

## Review Attention

- Plan 0189 is complete, and Plan 0192 has since extended the accepted provider
  seam. Implement Pika only against the current contracts; do not revive the
  removed Generation Spec/Run, simulation, pricing, catalog, or Core-owned
  execution architecture.
- Add Pika as the first new provider on the standalone Engines extension seam:
  one provider module, one CLI composition entry, one Core-owned write-only
  credential descriptor, existing Image/Video Settings options, one provider
  Skill, deterministic provider tests, and one manual-only paid E2E.
- Reuse the current `MediaProvider`, `MediaEngine`, `ProviderRequest`,
  annotated `LocalMediaFile`, `EngineError`, metadata cache, AJV, retry,
  polling, download, Preview, provenance, and `media import --provenance`
  contracts without another public-interface change. Pika must implement the
  existing optional `readInputSchema` capability so
  `renku generation schema show --provider pika --model ...` returns the exact
  raw live catalog `input_schema`.
- Keep `@gorenku/studio-engines` independent of every workspace package. Pika
  code imports no Core, CLI, Studio, diagnostics, Project, Asset, purpose,
  Settings, or Preview concept.
- Keep the CLI thin. It adds `createPikaMediaProvider()` to the existing
  `createRenkuMediaEngine()` provider list; it does not add another command,
  flag, endpoint, request field, upload rule, retry policy, polling rule, error
  rule, or executable.
- Use Pika's official [`llms.txt`](https://dev.pika.art/llms.txt), the selected
  operation's linked specification, and the live expanded catalog record in
  that precedence order. Never infer a request schema or endpoint from a model
  name and never keep a checked-in schema/catalog fallback.
- The Engines provider accepts any active asynchronous media operation exposed
  by Pika's live catalog. The initial Pika Skill automatically selects only the
  four explicitly documented image/video operations in this plan; that Skill
  curation is not an Engines allowlist.
- Add Pika to global write-only credentials as `PIKA_API_KEY`, Image provider
  choices, Video provider choices, and the existing workflow-policy provider
  union. Advance Project Settings from version 3 to version 4 with one
  data-only Drizzle migration that preserves every current value. Do not add
  Pika to Audio Settings, add a model picker, change defaults, or add
  provider-specific Settings controls.
- The Settings migration changes only the JSON document version. It adds no
  table/column/index, does not advance `PRAGMA user_version`, deletes no data,
  moves no files, and adds no compatibility reader or runtime fallback.
- Do not add generic pricing, estimate, simulation, approval-token, billing, or
  balance UI/contracts. The existing conversational Ask Before Generating rule
  remains the cost boundary; Pika rejection codes such as insufficient balance
  remain structured provider failures.
- Commit the paid E2E, fixture, and manual command using the restored shared
  Engines E2E credential/context helpers and cleanup behavior. Do not execute
  the test during implementation or through any automatic verification. The
  user will recheck the live contract/current price and run it manually.
- Plan 0190 supersedes unimplemented Plan 0188. Plan 0188 remains only as a
  clearly marked record of the rejected pre-refactor architecture.

## Summary

Plan 0189 created the provider-ready architecture and proved it with existing
providers plus a test-only fixture. Plan 0192 then added raw live-schema
inspection, exact request-reference annotations, restored manual provider E2E
conventions, and the thin `generation schema show` command. This plan uses that
current seam to add Pika without reopening either refactor.

The Pika provider is one model-agnostic asynchronous media adapter. It retrieves
the selected operation's live catalog record, validates the exact native input,
uploads local media, submits with idempotency, polls or recovers the known job,
downloads the completed artifact, and returns a safe provider receipt. Media
Producer and the Pika Skill choose a documented operation, inspect its raw live
input schema, author exact annotated local-media markers, and use the existing
Preview/provenance/attachment workflow.

The smallest product adoption is deliberate: Pika becomes available for Image
and Video generation, receives one managed credential, and has four initial
Skill guides. It does not introduce a model catalog in Studio, generic pricing,
provider billing UI, Pika Audio selection, a new CLI, or a new durable runtime
concept.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Implement Pika on the completed Plan 0189 seam as extended by Plan 0192, without reopening either foundation. | User-requested plan split and current repository state. | Implementation precondition and architecture gate. | Current-contract audit and absence of old Spec/Run contracts in the Pika diff. |
| R2 | Implement Pika from official current documentation and live operation metadata without inferred/copied schemas. | User request and Pika documentation precedence. | Engines Pika metadata boundary. | Scripted metadata tests and live read-only source check. |
| R3 | Keep Engines independent, implement current raw live-schema inspection, and preserve annotated local-media markers without interpreting their review metadata. | User architecture requirement, Decision 0088, and Plan 0192. | Engines Pika provider. | Manifest/import, schema-delegation, marker-substitution, and public-contract tests. |
| R4 | Support Pika asynchronous media validation, local uploads, idempotent submission, polling, recovery, content resolution, download, and structured errors. | Pika media API contract. | Engines Pika provider. | Owning-layer scripted protocol tests. |
| R5 | Keep the CLI a thin composition wrapper and use the existing `generation schema show`, validate, execute, and recover commands. | User architecture requirement and Decisions 0086/0088. | CLI provider composition. | Schema/validate/execute/recover one-delegation tests and provider-protocol import guard. |
| R6 | Add one write-only Pika credential and Image/Video provider choices through Settings version 4 without new Settings machinery or changed defaults. | Accepted product scope from Plan 0189 review. | Core credential/Settings owners and Studio projection. | Credential, data-only Settings migration, workflow-policy, and UI tests. |
| R7 | Add a Pika provider Skill that reads the exact live input schema, authors annotated request markers, and uses the existing Preview/provenance/attachment workflow. | Accepted Skill-owned model-selection boundary and Decision 0088. | `studio-skills`. | Skill validation and Media Producer routing/schema/reference evals. |
| R8 | Keep Pika out of Codex harness generation and never silently fall back between providers/models. | Existing architecture and Pika error guidance. | Media Producer and Engines provider. | Routing/failure evals and provider tests. |
| R9 | Create a real paid E2E but leave it skipped, unexecuted, and user-run only. | Explicit user request. | Engines E2E suite. | Test-command inventory and source inspection, not execution. |
| R10 | Do not reintroduce generic pricing, balance, simulation, Specs/Runs, approvals, or provider-specific UI/CLI contracts. | Simplification requirement and Plan 0189. | All touched packages. | Capability/import scans and contract review. |

## Context And Evidence

### Current foundation from Plans 0189, 0191, and 0192

The required foundation now exists:

- standalone `@gorenku/studio-engines` with no workspace dependency;
- public `MediaProvider`/`MediaEngine` schema-read, request, execution, recovery,
  artifact, metadata-cache, and closed `EngineErrorCode` contracts;
- optional `MediaProvider.readInputSchema`, required
  `MediaEngine.readInputSchema`, `ENGINE_INPUT_SCHEMA_UNAVAILABLE`, and the thin
  `renku generation schema show --provider --model --json` adapter;
- exact `LocalMediaFile { $file, mimeType?, reviewLabel?, promptMention? }`
  markers whose full object is replaced before provider validation/upload;
- shared AJV, local-file traversal, retry, polling, download, and safe logging;
- a CLI provider composition list and context builder that contain no provider
  protocol logic;
- Core-owned temporary Preview, Asset provenance, provider credentials, and
  Project generation Settings;
- Core-owned deterministic generation context from Plan 0191 and the exact
  reviewed-reference behavior from Plan 0192;
- the `renku generation validate/preview show/execute/recover` commands and
  `renku media import --provenance` attachment path;
- Engines-local `readOptInProviderTestCredential` and
  `createProviderTestContext` helpers used by restored provider E2Es;
- the Atlas-like test-only provider fixture; and
- the current `packages/engines/docs/adding-a-provider.md`, amended on
  2026-08-25 for raw schema inspection, annotated whole-marker substitution,
  live-catalog versus curated-Skill scope, CLI composition, and shared paid-E2E
  conventions.

If Pika requires another public Engines, Preview, provenance, attachment, or
CLI contract change beyond the product additions named here, stop and revise
this plan instead of patching the foundation inside the provider.

### Official Pika implementation authority

Pika's official [`llms.txt`](https://dev.pika.art/llms.txt) is the discovery and
provider-wide protocol index. For every initially supported Skill operation and
every operation used in tests, re-fetch sources in this order immediately before
implementation:

1. `GET https://api.dev.pika.art/catalog/apis/{api_id}?expand=inputs`, with the
   slashes in `api_id` sent literally, for current availability, category,
   concrete method/path, pricing metadata, and expanded `input_schema`;
2. the exact operation-specific `https://dev.pika.art/llms/...` page linked by
   `llms.txt` for examples, job/content behavior, uploads, idempotency, and
   error semantics; and
3. `llms.txt` only for discovery and stable provider-wide workflow.

If prose and the live catalog disagree about fields, requiredness, enums, or
defaults, the live `input_schema` wins. If an operation is missing/inactive or
its live detail is malformed, fail; do not use remembered data, a checked-in
snapshot, or another model.

The ordinary runtime does not fetch prose. It implements the stable Pika media
protocol once and fetches only the selected live machine-readable catalog
record. The 2026-08-25 live MiniMax H3 catalog check still publishes
`Cache-Control: no-store`, so it may be coalesced only by the existing in-flight
retrieval mechanism and must not enter the filesystem cache unless Pika later
publishes cacheable response directives.

The 2026-08-25 catalog index contains 136 operation entries: 118 media and 18
LLM. Of the media entries, 116 currently advertise the planned POST call shape
under `/v1/media/...`. `google/gemini-3-pro-image` and
`google/gemini-3.1-flash-image` expose image schemas but no `call` metadata, so
the provider must reject them until Pika publishes the required asynchronous
media call contract. These counts are time-stamped implementation evidence, not
a checked-in allowlist; exact-operation detail validation remains authoritative.

The implementation recheck on 2026-08-26 found 133 callable operations in the
current `llms.txt`. All four Skill-curated operations remained published. The
expanded MiniMax H3 image-to-video record still required `prompt` and
`first_frame_image`, accepted duration 4–15 and resolution `768P`/`2K`, exposed
the planned POST media call, and returned `Cache-Control: no-store`. Its linked
specification still documented 768P at $0.08 per second. The count change is
recorded as live-source drift only; no runtime count or allowlist was added.

### Superseded Pika plan

Plan 0188 is not an implementation source. Its operation allowlist, generic
Generation lifecycle, checked product catalog, price approval, balance preflight,
simulation, Core execution, and durable Run assumptions target architecture
removed by Plan 0189. Preserve only the provider facts that are independently
confirmed by the official current Pika sources named above.

## Product Behavior

### Provider identity and operation scope

The Engines and review/provenance provider id is exactly `pika`. The credential
is `PIKA_API_KEY`, sent as `X-API-Key` only to the fixed origin
`https://api.dev.pika.art`.

`ProviderRequest.model` is the exact Pika catalog `api_id`, including literal
slashes. Engines does not translate it and has no model allowlist. The provider
accepts only live operations whose catalog record has category `image`, `video`,
or `audio`, `call.method: 'POST'`, a normalized relative `/v1/media/...` path,
and a valid expanded JSON `input_schema`. Those are the current asynchronous
media families; it rejects category `llm`, synchronous chat operations, unknown
categories, and any later protocol family that has not been deliberately
implemented. It never switches model/provider after a failure.

The initial Pika Skill automatically selects from these four image/video
operation guides:

| Workflow | Exact `api_id` | Official specification |
| --- | --- | --- |
| Text to image | `bytedance/seedream-5.0-pro/text-to-image` | `https://dev.pika.art/llms/bytedance/seedream-5.0-pro/text-to-image` |
| Image editing | `bytedance/seedream-5.0-pro/image-to-image` | `https://dev.pika.art/llms/bytedance/seedream-5.0-pro/image-to-image` |
| Text to video | `minimax/h3/text-to-video` | `https://dev.pika.art/llms/minimax/h3/text-to-video` |
| Image to video | `minimax/h3/image-to-video` | `https://dev.pika.art/llms/minimax/h3/image-to-video` |

This is the smallest initial guide set that makes both accepted Settings choices
useful for reference-free and reference-based work, using Pika's recommended
starting families as of 2026-08-25. It does not claim these are the only or
permanently preferred Pika operations.

These entries are Skill curation, not an Engines restriction. Adding another
async media operation later requires an exact Pika Skill guide and live-schema
verification, but no Engines code change unless Pika changes the provider-wide
protocol.

### Exact Pika media flow

For `readInputSchema`, `validate`, `execute`, or `recover`, the provider follows
this flow:

1. Fetch the exact live catalog detail with `expand=inputs`. Require the
   returned `api_id` to match, an accepted async media category, POST method, a
   safe relative `/v1/media/...` call path, and a valid `input_schema`. Compile
   the schema through the shared AJV mechanism and obey response cache
   directives. `readInputSchema` returns that exact raw schema object without
   adding defaults, labels, controls, annotations, or a Pika-specific DTO.
2. Discover annotated `LocalMediaFile` values using the shared traversal. Pika
   treats `reviewLabel` and `promptMention` as opaque caller metadata. Before
   upload, use Pika's `media_kinds` annotation at that exact schema location to
   reject a mismatched file kind, then enforce Pika's documented limits: 20 MB
   for image/audio and 50 MB for video. This interpretation stays inside Pika;
   it does not become a shared field map. Validate the logical request after
   the shared whole-marker substitution has replaced file paths and review
   annotations with safe hosted-URL stand-ins; do not mutate the reviewed
   request.
3. For every local file, call `POST /v1/media/uploads` with exact
   `content_type` and `size_bytes`. Require HTTPS in the returned upload/hosted
   URLs. `PUT` raw bytes to the presigned `upload_url` using every returned
   signed header exactly. Send no Pika credential to the storage origin. Send
   authenticated Pika calls and signed PUTs with `redirect: 'error'` so secrets
   cannot cross origins.
4. Substitute the whole local marker with only the returned hosted `url` in the
   live submission copy and validate that final request against the same live
   schema. The reviewed request and stored provenance keep the durable annotated
   `LocalMediaFile` markers; Pika never sends `reviewLabel` or `promptMention`
   to its schema, upload service, or submit endpoint.
5. Submit to the validated catalog path with JSON content type, `X-API-Key`,
   and one stable `Idempotency-Key` for that exact body. Preserve the returned
   Pika job id as `requestId`.
6. Poll `GET /v1/media/jobs/{requestId}`. Accept only `queued` and `running` as
   nonterminal states and stop only at `completed` or `failed`. A known job is
   always polled/recovered and never resubmitted because a poll/download failed.
7. After completion, fetch `GET /v1/media/jobs/{requestId}/content`, require an
   HTTPS content URL, download through the shared download mechanism, validate
   MIME/size against the selected catalog media category, and write atomically
   under the caller's output directory.
8. Return a local artifact and secret-free receipt containing useful Pika job
   facts. Never return/store the API key, authorization data, presigned
   upload URL/header, hosted input URL, or temporary output URL.

`readInputSchema` and `validate` make no upload or paid submit.
`readInputSchema` returns the raw live schema; `validate` additionally validates
the request and local files. `recover` starts from the supplied Pika job id,
polls it, and resolves/downloads completed content without resubmitting.

### Idempotency, retries, and recovery

Pika owns its classification policy while the current shared Engines code owns
timing:

- replay an uncertain submit transport result with the same idempotency key and
  identical body;
- never reuse an idempotency key with a different body;
- after a documented terminal retryable failed job, allow at most one fresh-key
  retry of the same logical request within the operation deadline because Pika
  replays a failed job on its original key;
- honor a valid bounded `Retry-After` for 429/rate-limited failures;
- retry documented transient 503/provider-unavailable failures with bounded
  shared backoff;
- do not retry validation, authentication, insufficient balance, membership,
  content moderation, ordinary request rejection, or other nonretryable 4xx
  failures unchanged; and
- never change provider, model, prompt, reference, duration, resolution,
  quality, count, or another creative/cost input as recovery.

Every attempt remains under the injected request/operation deadlines and
`AbortSignal`. Timeout/exhaustion reports the known Pika job id so the existing
`renku generation recover` path can continue it.

### Structured error mapping

Map Pika failures at the provider boundary to the existing closed codes:

| Pika response | Existing `EngineErrorCode` |
| --- | --- |
| HTTP 401 | `ENGINE_AUTHENTICATION_FAILED` |
| Request-level HTTP 403 inactive-key `{"message": ...}` envelope | `ENGINE_AUTHENTICATION_FAILED` |
| Missing/unavailable catalog operation | `ENGINE_METADATA_UNAVAILABLE` |
| Malformed/mismatched catalog record or schema | `ENGINE_METADATA_INVALID` |
| HTTP 413/415 from upload setup | `ENGINE_LOCAL_MEDIA_INVALID` |
| HTTP 422 or failed-job `invalid_input` | `ENGINE_REQUEST_INVALID` |
| Failed-job `content_moderation`, `insufficient_balance`, `membership_required`, `cycle_limit_exceeded`, or `admission_suspended` | `ENGINE_REQUEST_REJECTED` |
| HTTP/failed-job 429 or `rate_limited` | `ENGINE_RATE_LIMITED` with bounded `Retry-After` |
| HTTP 503 or failed-job `provider_unavailable` | `ENGINE_PROVIDER_UNAVAILABLE` |
| Failed-job `provider_timeout` or `timed_out` | `ENGINE_OPERATION_TIMEOUT` |
| Failed-job `provider_error` or `internal` | `ENGINE_JOB_FAILED` |
| Upload grant/PUT failure | `ENGINE_UPLOAD_FAILED` |
| Submit transport/envelope failure | `ENGINE_SUBMIT_FAILED` |
| Poll failure after a known id | `ENGINE_POLL_FAILED` |
| Recovery of an unknown/invalid job | `ENGINE_RECOVERY_FAILED` |
| Missing/invalid content response or media | `ENGINE_OUTPUT_INVALID` or `ENGINE_DOWNLOAD_FAILED` |

Classify HTTP 403 by envelope, not status alone: the request-level message is an
inactive credential, while named failed-job business rejections use
`ENGINE_REQUEST_REJECTED`. Classify HTTP 404/409 by operation: catalog 404 is
metadata unavailable; unknown recovery job is recovery failure; premature
content or conflicting idempotency body is request rejection. Parse both
documented JSON envelopes: request-level `{ "message": "..." }` and terminal
failed jobs with `error.code`/`error.message`; normalize an unrecognized terminal
error code to the documented provider-error behavior and `ENGINE_JOB_FAILED`.
Preserve only safe HTTP status, retryability, retry delay, and job id in
`EngineError` details.

### Preview, provenance, and attachment

Pika uses the current Plans 0189/0191/0192 journey:

1. Media Producer reads the current Core generation context, selects Pika from
   Project Settings or explicit user direction, and invokes the Pika Skill.
2. The Pika Skill chooses an exact documented `api_id`, then calls
   `renku generation schema show --provider pika --model <api_id> --json` and
   uses the raw live schema as technical field authority. The checked-in Pika
   guide remains editorial prompt/reference guidance and contains no copied
   schema/default/bound/price facts.
3. The Skill authors a temporary review document with `provider: 'pika'`, the
   exact catalog `api_id`, media kind, prompt, and provider-native request.
   Every local reference uses the exact native field and includes a meaningful
   `reviewLabel`; it includes `promptMention` only when the selected operation's
   editorial guide requires an exact prompt token.
4. `renku generation validate` validates it before Preview; Preview remains
   schema-free, supports prompt Update/Close only, and returns to the normal
   conversation.
5. After confirmation, the Skill rereads the review file, rebuilds the native
   request from any edited prompt while preserving exact reference markers,
   validates it, and calls `generation execute`.
6. The Skill reviews the artifact and calls the existing focused
   `media import --provenance` path with the safe execution provenance.
7. Asset Inspection renders the same shared prompt/reference/configuration view.

No Pika field map, request editor, Generate action, app-to-agent callback,
Spec/Run/freeze state, provider output registry, or Pika-specific attachment
path is added.

### Credential and Settings adoption

Insert Pika after Fal.ai in the Core-owned ordered global credential catalog:

```text
Fal.ai       FAL_KEY
Pika         PIKA_API_KEY
Replicate    REPLICATE_API_TOKEN
WaveSpeed    WAVESPEED_API_KEY
ElevenLabs   ELEVENLABS_API_KEY
World Labs   WLT_API_KEY
```

Pika uses the existing global write-only replacement/storage/onboarding UI. Add
no source badge, balance display, key test button, remove action, or provider-
specific form. The CLI resolves the saved secret through Core and supplies only
the selected opaque value to `createPikaMediaProvider`.

Advance the Project Settings document from version 3 to version 4 and change
only these credential/Settings/workflow-policy contracts:

```ts
type ProviderCredentialId =
  | 'fal-ai'
  | 'pika'
  | 'replicate'
  | 'wavespeed-ai'
  | 'elevenlabs'
  | 'world-labs';

ProjectSettingsDocument.version: 4;
image.provider: 'codex' | 'fal-ai' | 'pika';
video.provider: 'fal-ai' | 'pika';
audio.provider: 'elevenlabs';
GenerationWorkflowPolicy.provider: 'codex' | 'fal-ai' | 'pika' | 'elevenlabs';
```

Generate the next Drizzle custom migration with name
`pika_provider_settings`; it updates the project-local singleton's JSON version
from 3 to 4 with `json_set(document, '$.version', 4)` rather than reconstructing
the document. A migration precondition aborts if an existing Settings row does
not contain the accepted version-3 document; new databases have no Settings row
at migration time and receive the version-4 default during Project creation.
This is a data-only migration: the Drizzle schema and `PRAGMA user_version`
remain unchanged. Its migration test proves exact before/after preservation for
every version-3 field, the invalid-version stop, and the empty-database path.
Fresh and migrated defaults remain Codex for Image, Fal.ai for Video, and
ElevenLabs for Audio. Studio adds `Pika` to the existing Image/Video Selects.
There is no Pika Audio option, model picker, Pika panel, pricing/balance UI, or
new control.

Media Producer may route Image/Video to the Pika Skill when Project Settings or
explicit user direction selects Pika. If Codex is selected in a harness without
the built-in image capability, it may offer Pika as an explicit alternative but
must wait for the user's choice; it never falls back automatically.

## Architecture Shape Gate

### Engines ownership

Add only this production module:

```text
packages/engines/src/providers/pika/
  index.ts
  provider.ts
  metadata.ts
  uploads.ts
  jobs.ts
  errors.ts
```

- `index.ts` exports `createPikaMediaProvider` only; it contains no behavior.
- `provider.ts` implements the `MediaProvider` orchestration using focused Pika
  modules and current shared mechanisms. Its `readInputSchema` delegates to the
  same metadata loader used by validation/execution and returns the raw schema.
  It contains no model-id branches.
- `metadata.ts` builds the fixed-origin catalog-detail URL, validates the live
  envelope/path/schema, obeys cache directives, returns the raw `input_schema`,
  and compiles that same schema for AJV validation.
- `uploads.ts` validates Pika media limits, requests upload grants, checks
  origins, and performs exact signed PUTs without logging temporary values. It
  consumes resolved marker bytes/MIME but never interprets `reviewLabel` or
  `promptMention`.
- `jobs.ts` owns idempotent submit, Pika job/status parsing, polling/recovery,
  content resolution, and safe job receipt facts.
- `errors.ts` parses Pika request/job envelopes and maps them to the existing
  closed `EngineErrorCode` union.

Reuse shared local-file traversal, cache, AJV runner, retry/poll timing,
downloads, atomic output writes, `EngineError`, and safe logger directly. Do not
add empty `client.ts`, `validation.ts`, `polling.ts`, or `outputs.ts` files merely
to mirror another provider; split only if an implemented file begins combining
distinct responsibilities.

The Engines package `src/index.ts` remains the only package entrypoint and adds
only the Pika factory export. It remains thin. `media/engine.ts` and shared
modules gain no `pika` branch or Pika field/status knowledge.

### CLI, Core, Studio, and Skills ownership

The non-provider production/document boundaries are:

```text
packages/cli/src/commands/generation/provider-registry.ts
packages/core/src/client/project-settings.ts
packages/core/src/server/project-settings/document.ts
packages/core/src/server/project-settings/generation-policy.ts
packages/core/src/server/provider-credentials/catalog.ts
packages/core/drizzle/<next>_pika_provider_settings.sql
packages/core/src/server/database/lifecycle/migration-<next>.test.ts
packages/studio/src/features/movie-studio/project-details/project-settings-fields.tsx
studio-skills/skills/pika-media-provider/
  SKILL.md
  agents/openai.yaml
  references/supported-models.json
  references/seedream-5.0-pro-text-to-image.md
  references/seedream-5.0-pro-image-to-image.md
  references/minimax-h3-text-to-video.md
  references/minimax-h3-image-to-video.md
```

- CLI adds `createPikaMediaProvider()` to the bounded provider list inside
  `packages/cli/src/commands/generation/provider-registry.ts`. Existing
  `context`, `schema show`, `validate`, `preview show`, `execute`, and `recover`
  handlers do not gain a Pika branch.
- Core adds the credential descriptor, Settings version-4/provider unions,
  workflow-policy union, and the data-only `pika_provider_settings` Drizzle
  migration. It does not import Engines or interpret a Pika request, schema,
  job, or receipt.
- Studio renders the new credential row and Image/Video options from existing
  Core projections using local shadcn controls. It adds no Pika component.
- `studio-skills/skills/pika-media-provider/` owns operation selection and exact
  guides; its `supported-models.json` entries contain exactly `id`, `name`,
  `inputModes`, and `guide`. Media Producer adds one routing entry. Skills call
  only existing `renku generation context`, `schema show`, `validate`,
  `preview show`, `execute`, `recover`, and focused `renku media import`
  commands.

### Forbidden shapes and stop conditions

Stop and revise before continuing if:

- Pika requires another public provider/review/provenance/attachment contract,
  another CLI command/flag, or another Engine error code beyond the current
  Plan 0192 seam;
- Engines imports a workspace package or a Renku Project/Asset concept;
- Pika transport/protocol logic enters shared Engines modules, CLI handlers,
  Core, routes, React, or Skills instead of the Pika provider;
- one Pika file accumulates metadata, uploads, jobs, error parsing, downloads,
  CLI mapping, and Skill behavior;
- a model-id allowlist or switch enters Engines;
- a schema/catalog snapshot, fallback endpoint, or inferred field/path is added;
- a Pika-specific CLI command, flag, executable, Preview renderer, Settings panel,
  Asset attachment path, billing surface, Spec, Run, simulation, estimate, or
  approval token appears;
- a synchronous LLM protocol enters the Pika provider;
- ordinary known-model generation makes the agent reconstruct auth/upload/job
  protocol from prose; or
- the paid E2E can run from an automatic command or is executed by the
  implementer.

## Public Contracts

Plan 0190 changes no Engines request/result/error/schema shape. It adds one
public factory and one production composition entry:

```ts
function createPikaMediaProvider(): MediaProvider;
```

The factory always uses the fixed Pika origin. Tests inject
`ProviderContext.fetch`; neither production nor tests can configure another
credential-bearing origin.

`createPikaMediaProvider` implements existing `readInputSchema`, `validate`,
`execute`, and `recover` methods. The schema method returns the exact catalog
`input_schema`; it does not create a normalized Pika schema contract.

The CLI composition uses provider id `pika`. The existing review/provenance
provider string carries `pika`; no provider enum/catalog is added to Engines.
The Core credential id/descriptor, Settings version/provider unions, and
`GenerationWorkflowPolicy.provider` union listed above are the only public
product-contract changes.

No new diagnostic code is planned. Pika maps to the current closed Engines
codes—including `ENGINE_INPUT_SCHEMA_UNAVAILABLE` at the engine boundary for a
provider lacking schema inspection—and the CLI performs the existing one-time
structured-diagnostic translation. Pika itself implements schema inspection,
so catalog/schema failures map to `ENGINE_METADATA_UNAVAILABLE` or
`ENGINE_METADATA_INVALID`. Stop if an official Pika failure cannot be expressed
accurately by the current union; revise this plan and the owning Engines
contract deliberately rather than adding a Pika-only CLI/Core code.

## Implementation Slices

### 1. Verify the current provider extension seam

- Confirm Plans 0189, 0191, and 0192 are complete and the current standalone
  consumer, Atlas-like test provider, public package exports, CLI provider
  composition, raw schema command, annotated marker handling, and shared E2E
  helpers pass.
- Re-fetch Pika `llms.txt`, the four initial operation specs, the representative
  E2E live catalog record, and current cache headers.
- Record any official-source change in this plan before coding; do not work
  around a changed provider family with local inference.

### 2. Implement Pika metadata and validation

- Add the focused Pika module shape and public factory.
- Fetch/validate exact live catalog records, fixed-origin POST paths, async media
  categories, and expanded schemas.
- Implement `readInputSchema` through the same metadata loader and return the
  exact raw live schema without normalization.
- Validate logical requests with safe local-file URL stand-ins and final hosted
  requests with the same schema; replace the whole annotated marker and do not
  mutate the reviewed request.
- Add deterministic metadata/cache/schema/local-file tests before submit work.

### 3. Implement upload, job, recovery, and output

- Add exact upload grants and signed PUT behavior with origin/redirect/secret
  protections.
- Add idempotent submit, bounded provider classification, polling, known-job
  recovery, content resolution, shared download, and safe receipt construction.
- Cover every error/idempotency/timeout/redaction invariant at the Engines Pika
  owning layer with scripted fetch responses and injected timing.

### 4. Register Pika through thin composition boundaries

- Export the provider factory from the thin Engines package entrypoint.
- Add `createPikaMediaProvider()` to CLI's existing provider list and prove
  `schema show`, validate, execute, and recover still delegate once through
  `MediaEngine`.
- Add no provider endpoint/field/status/error logic outside Engines Pika.

### 5. Add credential and Settings adoption

- Add `Pika`/`PIKA_API_KEY` to Core's ordered credential catalog and exercise the
  existing secret storage/onboarding/Studio row.
- Advance Settings from version 3 to 4 through the data-only
  `pika_provider_settings` Drizzle migration, preserve every existing
  value/default, extend the workflow-policy union, and add Pika to the existing
  Image/Video options only.
- Add focused Core and Studio tests; do not duplicate provider protocol tests.

### 6. Add Pika Skill guidance

- Create `studio-skills/skills/pika-media-provider/SKILL.md` and the four exact
  operation guides/links listed in Product Behavior.
- Keep selection/prompt/reference guidance in the Skill. Use existing
  `generation schema show` for live technical fields; keep auth/upload/submit/
  poll/recovery/download behavior in Engines.
- Update Media Producer routing, Codex-unavailable explicit-choice behavior,
  schema inspection, annotated reference authoring, Preview flow, artifact
  review, and provenance attachment instructions/evals.
- Validate the sister project without making it install an SDK or executable.

### 7. Add the manual-only paid E2E and documentation

- Add the guarded E2E and committed first-frame PNG fixture specified below.
- Reuse `readOptInProviderTestCredential` and `createProviderTestContext`, clean
  its temporary output through the shared helper, and add `RUN_PIKA_TEST=1` to
  the E2E README inventory.
- Typecheck and inspect the test; prove automatic commands skip it. Do not set
  its opt-in flag and do not execute `test:e2e` during implementation.
- Update current provider, credential, Settings, CLI, E2E, release, and Skill
  documentation without reviving Plan 0188 concepts.
- Verify the implementation follows the current generic adding-a-provider
  guide. Amend that guide again only if Pika reveals a reusable provider-seam
  rule rather than a Pika-specific protocol detail.

## Tests And Guardrails

### Pika owning-layer tests

Use scripted `fetch`, injected clock/sleep/random, temporary output directories,
and the current public Engines contracts. Cover:

- exact fixed-origin catalog URL with literal model slashes and `expand=inputs`;
- missing/unavailable/mismatched operation, nonmedia category, non-POST/unsafe path,
  malformed schema, AJV compile failure, `no-store`, and existing concurrent
  in-flight retrieval coalescing without a cache write;
- `readInputSchema` returning the exact unmodified `input_schema` through both
  provider and `MediaEngine`, using the same retrieval as validation;
- logical/final validation, recursive annotated local markers including arrays,
  schema-local `media_kinds`, MIME/20 MB/50 MB limits, whole-marker substitution,
  absence of review annotations from hosted validation/submission,
  reviewed-request immutability, and validation before upload/submit;
- upload grant body, exact signed headers/bytes, HTTPS/origin isolation,
  redirect rejection, multiple files, and 413/415 mapping;
- submit envelope, stable same-body idempotency retry, conflicting-body
  prevention, at-most-one fresh-key terminal retry, and no model fallback;
- queued/running/completed/failed polling, `Retry-After`, 503, cancellation,
  deadline, recovery without resubmit, premature content, and unknown job;
- content/download MIME/size/atomic-write behavior and recovery-safe redownload;
- every documented error mapping and both JSON error envelopes; and
- absence of credential, authorization data, signed headers/URLs, hosted input
  URLs, temporary output URLs, and absolute local paths from logs/errors/results.

### Boundary tests

- Engines manifest/import tests still prove no workspace dependency.
- The standalone built-package consumer imports and constructs Pika through the
  public entrypoint only.
- CLI composition tests prove `pika` delegates `schema show`, validate, execute,
  and recover once through `MediaEngine`; CLI handlers contain no Pika protocol
  behavior.
- Core tests cover credential id/order/write-only behavior, Settings version-4
  migration/default preservation, and the workflow-policy provider union.
- Studio tests cover the existing Pika credential row and Image/Video options
  using shared shadcn components, with no Pika Audio/model picker/panel.
- Preview/provenance/attachment regression tests use one representative Pika
  request but do not repeat provider error matrices.
- Skill evals cover Pika routing, four initial operation selections, exact raw
  schema inspection, annotated reference authoring, explicit user override,
  Codex unavailable/explicit Pika choice, no fallback, Preview, artifact review,
  and provenance attachment.
- Architecture tests protect imports/public capability, not private file or
  helper names.

### Manual-only paid Pika E2E

Create `packages/engines/tests/e2e/pika.e2e.test.ts`. It exercises
the standalone public Engines path against the real Pika API using
[`minimax/h3/image-to-video`](https://dev.pika.art/llms/minimax/h3/image-to-video).
That operation is a test fixture because it covers live metadata, JSON Schema,
local image upload, async submit, polling, content resolution, and MP4 download;
it is not an Engines allowlist.

The test:

- is guarded by `RUN_PIKA_TEST=1` and skipped otherwise, matching the restored
  provider E2E naming convention;
- reads `PIKA_API_KEY` through `readOptInProviderTestCredential` only after
  opt-in, fails clearly if missing, and never prints it;
- uses the committed
  `packages/engines/tests/e2e/fixtures/pika-first-frame.png`, below the current
  image limit, as a real `LocalMediaFile`;
- re-fetches the live catalog and, if its schema still agrees, uses exact model
  `minimax/h3/image-to-video` with input `{ prompt: '<short opaque motion
  prompt>', first_frame_image: { $file:
  'tests/e2e/fixtures/pika-first-frame.png', mimeType: 'image/png', reviewLabel:
  'Pika paid-test first frame' }, duration: 4, resolution: '768P' }`;
- treats the copied fields only as the current fixture, never as a fallback. On
  2026-08-25 the live schema requires `prompt`/`first_frame_image`, accepts
  duration 4–15 and resolution `768P`/`2K`, and the linked specification prices
  `768P` at $0.08/second ($0.32 for one successful four-second request). The
  user must recheck the current spec, price, and balance before running it;
- uses `createProviderTestContext`, calls public `MediaEngine.readInputSchema`,
  `MediaEngine.validate`, and `MediaEngine.execute`, creates exactly one normal
  successful job, and never manufactures a paid failure/retry;
- asserts a request id, one non-empty local `video/mp4` artifact, and a safe
  receipt with Pika job identity;
- proves the reviewed local marker is unchanged and no API key, presigned
  upload data, hosted input URL, or temporary output URL is serialized; and
- removes its temporary output through the shared context cleanup after
  assertions. No saved-artifact mode is added.

All automatic test/build/lint/check commands must skip this file. The
implementer must not set the opt-in flag or run the E2E command. Only the user
runs it manually:

```bash
RUN_PIKA_TEST=1 pnpm --dir packages/engines test:e2e -- pika
```

The E2E owns only one representative happy path. Scripted provider tests own the
complete error/retry matrix and incur no cost.

## Documentation And Decision Effects

No new architecture decision is required: Pika is the first production use of
the provider-addition boundary accepted by Decision 0086 and extended by
Decision 0088. Add a short application note to Decision 0086 linking the Pika
implementation and confirming that it used the current schema-read and
annotated-marker contracts without another Engines change. Do not rewrite the
decision body. Extend Decision 0084's current notice with one sentence that Pika
becomes the sixth Core-owned write-only provider credential under the same
storage contract; do not rewrite its historical three-provider body.

Update current documentation:

- `packages/engines/README.md` with Pika provider id, credential input, live
  metadata behavior, and no model allowlist;
- `packages/engines/docs/adding-a-provider.md` only if implementation reveals a
  further reusable provider-seam finding; keep Pika protocol and exact operation
  details out of the generic guide;
- `packages/engines/tests/e2e/README.md` with the exact opt-in/manual command,
  credential source, fixture, current-cost recheck, and artifact behavior;
- current provider-credential/onboarding and Project Settings references;
- `docs/architecture/media-generation.md` and its reference counterpart with
  Pika as an Engines provider using the current context/schema/review flow;
- `docs/cli/commands.md` with one Pika schema/review/validate/execute example
  using annotated provider-native request JSON and no Spec/Run/estimate
  commands;
- `docs/operations/distribution-and-release.md` to confirm Pika ships inside the
  existing runtime bundle with no separate executable; and
- Media Producer/Pika Skill indexes, exact operation guides, examples, and
  evals in `studio-skills`.

Keep Plan 0188 marked superseded. Do not copy its simulation, pricing,
balance-preflight, catalog allowlist, Generation Spec/Run, or Core-execution
instructions into current docs.

## Final Verification

Run automatic verification without the paid opt-in:

```bash
pnpm test:engines
pnpm test:core
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm build
pnpm test
pnpm lint
pnpm check
pnpm --dir ../studio-skills test:media-generation
pnpm --dir ../studio-skills test
```

Also:

1. Inspect the Pika and Media Producer validator/eval output from the two sister
   project commands above and confirm release packaging includes the new Skill.
2. Build Engines and run the standalone consumer with Pika constructed only from
   the public package.
3. Read-only fetch the official Pika index, four Skill operation specs, E2E live
   catalog record, and cache headers; compare them with this plan.
4. Manually verify desktop global credential Settings and Project Image/Video
   provider Selects; verify defaults and Audio remain unchanged.
5. Manually inspect one temporary Pika Preview fixture and one saved Pika
   provenance Inspection without making a paid request.
6. Confirm the paid Pika E2E is committed, typechecked, skipped by default, and
   excluded from every automatic command above. Do not execute it; hand the
   exact command and current documented cost inputs to the user.
7. Inspect `git diff --stat`, the full diff, and every large/heavily modified
   file. Confirm `index.ts` files remain thin and no Pika/shared/CLI/Core/Studio
   god file or broad switchboard was created.
8. Confirm the current Plans 0189/0192 public contracts were reused without
   another Engines/CLI interface change and Plan 0188 concepts did not return.

## Completion Evidence

- Added the focused Pika provider module, its single public factory export, and
  the thin CLI registry entry without changing the existing Engines or CLI
  request/result/error contracts.
- Added 34 scripted Pika owning-layer cases. The complete Engines suite passes
  61 tests; Core passes 362 tests, CLI passes 70 tests, and Studio passes 347
  tests. Root build, test, lint, check, architecture, test-partition, and release
  verification pass. The existing Studio `server/bin.ts` console warning remains
  non-failing and unchanged.
- Built Engines and constructed `pika` from `dist/index.js` in a consumer running
  outside the repository working directory.
- Generated migration 0081 with Drizzle Kit. Its seven migration cases prove
  exact value preservation, full version-3 contract guards, rollback, empty-DB
  behavior, and unchanged `PRAGMA user_version`. The migration was also applied
  to Urban Basilica through Core's migration command; its generated backup and
  a direct before/after comparison prove only version 3 to 4 changed.
- Browser QA verified the shared Pika credential row, unchanged Settings
  defaults, Image choices `Codex`/`Fal.ai`/`Pika`, Video choices
  `Fal.ai`/`Pika`, Audio choice `ElevenLabs`, and a temporary Pika Preview with
  prompt, reviewed first-frame reference, model, duration, and resolution. A
  focused Core/Studio regression verifies saved Pika provenance Inspection in
  the same shared desktop dialog without creating a paid artifact.
- Added and validated the Pika provider Skill, four exact operation guides,
  Media Producer routing/no-fallback guidance, and eval coverage. Both sister
  repository validation commands pass, including 21 purposes, 12 cross-cutting
  eval requirements, and seven release tests.
- Added the opt-in paid E2E and 640x360 PNG fixture. It typechecks and remains
  outside the automatic Vitest partition. `RUN_PIKA_TEST` was never set and the
  paid test was not executed.
- Rechecked official Pika sources and the current $0.32 four-second 768P fixture
  cost on 2026-08-26. The generic adding-a-provider guide required no change
  because implementation revealed no new provider-neutral seam rule.
- Inspected the complete main and sister-repository diffs, all Pika production
  files, generated migration metadata, test fixture, and Skill files. Package
  and provider `index.ts` files remain thin; no workspace dependency, model
  allowlist, compatibility layer, pricing/balance contract, Spec/Run concept,
  or provider protocol outside Engines Pika was added.

## Completion Checklist

### Review Area

- [x] Confirm Plans 0189, 0191, and 0192 are complete and inspect the current
      schema-read, annotated-marker, CLI composition, and E2E-helper contracts
      before Pika implementation begins.
- [x] Confirm this is one provider addition, not a reopening of the generation
      architecture refactor.
- [x] Keep Pika model-agnostic in Engines and four-operation curation in Skills.
- [x] Keep Codex harness behavior separate and prohibit silent fallback.
- [x] Keep pricing, billing/balance UI, simulations, Specs/Runs, approval tokens,
      provider-specific Preview, and another CLI outside scope.
- [x] Keep the paid E2E manual-only and unexecuted by the implementer.

### Architecture And Contracts

- [x] Reuse the current `MediaProvider`, `MediaEngine`, request, annotated
      local-file, raw schema, artifact, cache, error, Preview, provenance, and
      attachment contracts without another Engines/CLI interface change.
- [x] Keep Engines free of every workspace/Renku domain dependency.
- [x] Add only `createPikaMediaProvider` to the thin Engines entrypoint.
- [x] Implement existing `readInputSchema` through the same live metadata
      loader used by validate/execute and return the unmodified schema.
- [x] Keep provider id `pika` and exact Pika `api_id` model values.
- [x] Keep Pika protocol inside the focused provider folder.
- [x] Add only `createPikaMediaProvider()` to CLI's bounded provider list.
- [x] Keep CLI handlers to parsing, one public delegation, serialization, and
      existing structured error translation.
- [x] Add no diagnostic outside the existing closed `EngineErrorCode` union.
- [x] Match the Architecture Shape Gate and split files before responsibilities
      merge into one broad implementation.

### Pika Provider Implementation

- [x] Re-fetch official `llms.txt`, four selected specs, and live catalog data.
- [x] Enforce fixed origin, X-API-Key scope, async-media category, POST method,
      safe relative path, exact api id, and live schema.
- [x] Obey live cache directives; for `no-store`, use only existing concurrent
      in-flight retrieval coalescing and write no memory/filesystem cache entry.
- [x] Return the exact raw live schema without normalization or copied facts.
- [x] Validate logical and hosted requests without mutating annotated local
      markers; remove the entire marker, including review annotations, from
      provider validation/upload/submit payloads.
- [x] Enforce schema-local `media_kinds`, output category/MIME, and current 20 MB
      image/audio and 50 MB video limits inside Pika.
- [x] Implement exact upload-grant body, signed headers/bytes, HTTPS/origin and
      redirect safety.
- [x] Implement stable idempotency, bounded retries, polling, known-job
      recovery, content resolution, shared download, and atomic output.
- [x] Map all documented Pika request/job failures to existing Engine codes.
- [x] Keep receipts/logs/errors free of credentials and temporary URLs/headers.
- [x] Add no model allowlist, schema snapshot, fallback endpoint, LLM route,
      pricing estimator, billing client, or balance UI.

### Credential, Settings, CLI, And Skills

- [x] Add Pika/`PIKA_API_KEY` after Fal.ai in the Core credential catalog.
- [x] Reuse the existing write-only secret form/storage/onboarding behavior.
- [x] Advance Settings from version 3 to 4 with the data-only
      `pika_provider_settings` Drizzle migration, preserve all existing
      values/defaults, and leave schema `user_version` unchanged.
- [x] Extend `GenerationWorkflowPolicy.provider` for Pika.
- [x] Add Pika only to existing Image/Video provider choices.
- [x] Add no Pika Audio choice, model picker, Pika Settings panel, or new UI
      control/component.
- [x] Add the Pika CLI composition entry without protocol logic or another
      command/flag.
- [x] Create the Pika Skill and the four exact operation guides.
- [x] Update Media Producer routing, live schema inspection, annotated
      references, explicit overrides, Codex-unavailable choice, Preview,
      artifact review, and provenance attachment.
- [x] Keep Skills free of auth/upload/retry/poll/download implementation.

### Tests And Guardrails

- [x] Add complete scripted Pika metadata/schema/upload/job/recovery/output/error
      tests at the Engines owning layer.
- [x] Prove provider/engine `readInputSchema` returns the exact catalog schema
      and reuses the validation metadata path.
- [x] Prove annotation-bearing local markers are accepted but annotations never
      reach Pika validation, uploads, submissions, logs, errors, or results.
- [x] Add standalone package and no-workspace-import coverage.
- [x] Add thin CLI schema/validate/execute/recover delegation tests without
      repeating Pika protocol.
- [x] Add focused credential/Settings migration/workflow-policy/Studio option
      tests.
- [x] Add representative Preview/provenance/attachment regressions only.
- [x] Add Pika/Media Producer Skill routing and no-fallback evals.
- [x] Add stable architecture guardrails for imports/public capabilities, not
      private implementation names.
- [x] Add `pika.e2e.test.ts`, `RUN_PIKA_TEST=1`, the committed PNG fixture, and
      README/manual command using the shared E2E credential/context helpers.
- [x] Clean paid-test output through the shared context helper; add no saved-
      artifact mode.
- [x] Prove every automatic command skips the paid E2E; typecheck/inspect it but
      do not execute it.

### Documentation And Final Verification

- [x] Update Engines/provider/credential/Settings/CLI/release documentation.
- [x] Confirm the implementation follows the current generic provider guide and
      record only further reusable seam findings there; keep it provider-neutral.
- [x] Add the short Decision 0086 application note without rewriting history.
- [x] Extend Decision 0084's current notice for the sixth credential without
      rewriting its historical body.
- [x] Keep Plan 0188 visibly superseded and out of current documentation.
- [x] Run focused/root automatic checks without the paid opt-in.
- [x] Run sister Skill validation/evals.
- [x] Perform the read-only official-source comparison and desktop Settings/
      Preview/Inspection QA.
- [x] Hand the exact paid E2E command and current cost inputs to the user without
      running it.
- [x] Review `git diff --stat`, full diff, and large/heavily modified files.
- [x] Confirm thin `index.ts` entrypoints and no god file, catch-all, broad
      switchboard, duplicated mechanism, or provider logic outside Engines Pika.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark Plan 0190 complete.
