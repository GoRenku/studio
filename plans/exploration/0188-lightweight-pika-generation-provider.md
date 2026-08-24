# 0188 Lightweight Pika Generation Provider

Status: superseded by Plan 0190
Date: 2026-08-22

> Superseded on 2026-08-24. This draft targets the Generation Spec/Run,
> simulation, pricing, and Core execution architecture removed by Plan 0189.
> Plan 0189 now owns the standalone provider-ready refactor; Plan 0190 owns the
> Pika implementation on that completed architecture. Do not implement this
> plan.

## Review Attention

- Add Pika as a fourth managed credential (`PIKA_API_KEY`) and as a new
  Renku-managed Engines provider. This visible Settings/onboarding expansion is
  necessary because Core's accepted credential store is the sole production
  secret source; a hidden environment-variable bypass would violate Decisions
  0084 and 0085.
- Prove the provider with exactly two Pika-hosted MiniMax H3 operations:
  `minimax/h3/text-to-video` and `minimax/h3/image-to-video`. They overlap an
  existing fal.ai model family and expose enough live pricing metadata for an
  exact pre-submit estimate. Adding Pika's full catalog is not part of this
  slice.
- Add a small internal `GenerationProviderRuntime` boundary in
  `packages/engines`. Pika implements the new lightweight path; existing
  bundled providers, including fal.ai, continue through their present catalog,
  schema files, unified handler, uploads, simulation, retries, and SDK adapter.
  The fal.ai implementation and its checked-in schemas do not change here.
- Deliberately change the public Engines model summary/descriptor contracts by
  adding required `supportsSimulation`, and add two offline Pika identity
  summaries to `listGenerationModels`/`readGenerationModel`. The curated Studio
  video picker remains unchanged and does not acquire a live Pika dependency.
- Do not commit Pika schemas, add a Pika schema download/update script, add
  schema overrides, or copy Pika pricing into YAML. Each Pika operation is
  resolved from the live public catalog when it is described, estimated, or
  run.
- The live Pika catalog response currently sends `Cache-Control: no-store`.
  The implementation must therefore reuse one immutable operation snapshot
  only within the current Engines call and may coalesce identical in-flight
  fetches; it must not keep a TTL cache, disk cache, checked-in snapshot, or
  stale-on-error fallback. A longer-lived schema cache requires Pika to publish
  a cache-permitting contract and is not silently authorized by this plan.
- Pika models do not implement Renku's synthetic simulated-run path. Validation,
  exact pricing, balance checks, and request preview remain available; an
  attempted simulated Pika run fails before freezing a Spec, creating a Run, or
  calling Pika.
- Add bounded transport and provider retries, including Pika's distinct
  idempotency rules. An uncertain submit retries with the same key; a terminal
  retryable failed job uses a fresh key. The implementation never switches
  models or providers after failure.
- Add no database migration, new CLI command, HTTP route, provider preference,
  automatic fal.ai fallback, Studio video-model picker entry, audio/LLM Pika
  support, or paid verification without separate user approval.

## Summary

The current Engines media-provider path assumes a repository-owned catalog of
downloaded schemas. For fal.ai this means a large checked-in schema tree,
fetch/normalization/update scripts, viewer annotations, schema overrides, a
schema-first unified handler, simulated output generation, and an adapter
contract broad enough to serve several provider formats. That investment is
already in production use and remains unchanged, but it is too expensive to
repeat for every new provider.

Pika exposes a different and considerably simpler provider contract. A public
operation-detail endpoint returns the current operation id, output category,
concrete call path, expanded JSON input schema, and pricing metadata. Its media
API then uses one upload flow, one asynchronous submit/job/content lifecycle,
one API key, and stable error codes. The smallest useful implementation is to
resolve that provider-native operation contract at runtime, convert only the
information Renku's existing generic generation lifecycle needs, and call Pika
with native `fetch` rather than importing another provider SDK or reproducing
fal.ai's schema-maintenance machinery.

The implementation introduces one internal provider-runtime seam because the
existing public Engines functions already need the same four provider-owned
capabilities: describe an exact model, validate its payload, estimate its exact
price, and execute it. Existing callers continue using
`describeGenerationModelInputs`, `assembleGenerationProviderRequest`,
`estimateGenerationProviderRequest`, and `runGeneration`; they do not receive
Pika schema formats or transport details.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Add a Pika-backed Renku-managed generation path without changing fal.ai behavior. | User request. | Engines provider runtime and Core credential injection. | Existing fal.ai tests remain unchanged and Pika integration tests pass. |
| R2 | Do not download, commit, normalize, annotate, override, or manually maintain Pika schemas. | User request. | Pika catalog client. | Repository scan and tests prove no Pika schema/catalog update files exist. |
| R3 | Keep the new provider implementation substantially lighter than the fal.ai schema-first stack. | User request. | Focused Pika modules using native `fetch`; no SDK, simulation generator, schema updater, or generic recovery subsystem. | Architecture-shape inspection and dependency diff. |
| R4 | Preserve provider-valid request assembly and fail before submit on predictable invalid input. | Decision 0047 and package-boundary safety. | Engines generic assembly plus Pika schema adapter. | AJV and media-assignment tests, including final hosted-URL validation. |
| R5 | Preserve exact price approval and prevent a catalog price change between estimate and run from bypassing approval. | Decisions 0043 and 0047; Pika live pricing behavior. | Engines Pika pricing and Core-to-Engines run input. | Estimate/run price-change test proves no balance or submit call occurs. |
| R6 | Follow Pika's balance, upload, asynchronous job, content, idempotency, 429, and 503 contracts. | Pika API documentation and operational safety. | Pika HTTP, upload, job, and media orchestration modules. | Scripted HTTP integration tests cover each state transition and retry key. |
| R7 | Keep errors structured and useful after they cross Engines into the durable Core Run report. | Repository structured-diagnostics rule. | Pika error normalization and Core run error mapping. | Tests assert stable codes, suggestions, request ids, and secret redaction. |
| R8 | Do not implement synthetic Pika simulations or fake output media. | User concern about dry-run complexity. | Provider capability descriptor and Core pre-run gate. | A simulated Pika run fails before freeze, Run insertion, secret resolution, or network. |
| R9 | Make Pika's credential available through the accepted global credential source of truth. | Necessary consequence of R1 plus Decisions 0084/0085. | Engines credential catalog; existing Core/Studio credential flow. | Descriptor/store/UI/onboarding tests include Pika and never expose the key. |
| R10 | Keep the first provider proof narrow and exactly priceable. | Scope discipline and current Pika evidence. | Pika operation allowlist. | Only the two accepted MiniMax H3 operation ids resolve. |

## Product Behavior

### Initial supported operations

Use provider identity `pika` and preserve the Pika `api_id` as the exact model
identity:

```text
pika + minimax/h3/text-to-video
pika + minimax/h3/image-to-video
```

This keeps gateway identity separate from the underlying model vendor. It also
avoids translating Pika ids into fal.ai ids or pretending the same upstream
model has the same request schema on both providers.

The first route accepts prompt-only video generation. The second accepts an
exact required first-frame image and an optional exact last-frame image through
the existing GenerationSpec reference-to-provider-field assignments. Both use
the live Pika schema for requiredness, types, bounds, enum values, and defaults.

An agent or CLI caller can author either exact Pika identity in the existing
generic GenerationSpec contract, preview it, estimate it, approve it, and run
it. This plan does not add the routes to the curated Studio Shot Plan model
family picker. That later presentation decision needs an offline/unavailable-
catalog UX and a deliberate way to distinguish the same MiniMax family across
providers; it is not required to prove the Engines provider boundary.

`listGenerationModels` and exact `readGenerationModel` expose the two stable
allowlist summaries without a network request. A summary contains identity,
output kind/MIME, and the factual no-simulation capability; it does not claim a
price or input shape. Exact description, assembly, estimation, and execution
still require the live operation record. This keeps ordinary model discovery
and the early simulation gate usable when Pika is offline without treating a
copied schema or price as current, and the existing curated Studio video
availability remains unchanged.

### Schema and operation freshness

For each top-level describe, assembly, estimate, or run operation (but not the
fixed allowlist-only model listing):

1. Engines fetches
   `GET /catalog/apis/{api_id}?expand=inputs` from the fixed Pika API origin.
2. It validates the response envelope and confirms the returned `api_id`,
   category, method, relative call path, input schema, and pricing shape match
   the requested supported operation.
3. It creates one immutable request-local operation snapshot.
4. Descriptor extraction, payload validation, pricing, and—during run—submit
   use that exact snapshot.

Concurrent identical fetches may share one in-flight Promise. Once the fetch
settles, its response is not retained for a later top-level operation while the
provider response remains `no-store`. A network or malformed-catalog failure
never falls back to an older snapshot.

### Validation and preview

Pika's `input_schema` is an ordinary JSON Schema object rather than fal.ai's
repository wrapper containing `input_schema`, `output_schema`, definitions,
and Renku annotations. Pika also marks file-backed fields with `media_kinds`
and an HTTP URL pattern rather than fal.ai's `format: uri` and `x-fal`
metadata.

The Pika schema adapter must:

- project scalar type, enum, default, numeric bounds, description, requiredness,
  and nullable unions into the existing `GenerationModelInputDescriptor`;
- interpret Pika `media_kinds` only as provider-envelope media metadata;
- classify `first_frame_image` and `last_frame_image` as first/last-frame image
  fields and `ratio` as the provider aspect-ratio field;
- attach Pika's documented 20 MB image-upload ceiling to those media
  descriptors so an oversized reference fails during ordinary Core/Engines
  validation, before secret resolution or upload;
- preserve the authored prompt and every scalar value exactly;
- validate the logical preview payload by temporarily substituting safe
  `https://renku.invalid/...` validation values for Renku's internal
  `renku-input://...` placeholders; and
- validate the final payload again after uploads, using the actual hosted Pika
  URLs, immediately before submit.

The substitution is validation-only. It is not persisted, displayed, hashed as
the provider request, or sent to Pika.

### Exact pricing and balance

The initial Pika estimator supports only the pricing contract actually needed
by both MiniMax H3 operations:

- one output component;
- unit type exactly `second`;
- unit quantity `1` and included quantity `0`;
- a unique tier selected by the effective `resolution` value; and
- quantity derived from the effective `duration` value.

Provider schema defaults may be read for pricing without being inserted into
the authored GenerationSpec or provider payload. The estimate is:

```text
duration seconds × selected tier micro_usd
```

`starting_at` is display metadata and must not be treated as an exact price
when no unique tier matches. An unknown unit, ambiguous tier, absent effective
duration or resolution after applying valid schema defaults, malformed
micro-USD value, or changed pricing shape returns the existing
price-unavailable contract and prevents live approval.

At live execution, Engines resolves a fresh operation snapshot, repeats the
exact estimate, and compares it with `approvedEstimatedCostUsd` passed from the
already-approved Core estimate. A mismatch returns
`ENGINES_PIKA_PRICE_CHANGED` before secret resolution, balance lookup, upload,
or submit.

Immediately before each new-idempotency-key paid job attempt, Pika reads
`GET /billing/balance`. Prepaid accounts compare the estimate in micro-USD with
`balance_micro_usd`; active postpaid accounts compare it with
`postpaid.cycle.remaining_micro_usd`. A shortfall returns a structured
diagnostic and does not submit.

### Live execution

Pika live execution uses native `fetch` and the current Core-injected
`SecretResolver`:

1. resolve `PIKA_API_KEY` without copying it into `process.env`;
2. revalidate the fresh operation and approved price;
3. check the current balance;
4. for each local image, request one presigned upload, validate its response,
   and PUT the exact bytes with every returned signed header unchanged;
5. replace only that assigned provider field with the returned hosted URL;
6. validate the final JSON body against the same live input schema;
7. submit to the validated relative operation path on the fixed
   `https://api.dev.pika.art` origin with a per-Run idempotency key;
8. retain the returned job id and poll the fixed job endpoint to `completed` or
   `failed`;
9. request content only after completion, require an HTTPS output URL, download
   the bytes, and return one video artifact to the existing common output
   persistence code; and
10. include provider/model, Pika job id, attempt count, and retry history in
    non-secret diagnostics and the receipt.

The Pika client never accepts an absolute submit/poll/content endpoint from the
catalog. `call.method` must be `POST`; `call.path` must be a normalized relative
`/v1/media/...` path matching the requested operation id. Authentication is
sent only to the fixed Pika API origin. Presigned upload headers are sent only
to the returned HTTPS upload URL and are never logged or persisted.

### Retry and timeout policy

Use one fixed internal policy, not Project Settings or CLI flags:

- maximum three new-job attempts total, identified by at most three
  idempotency-key ordinals;
- maximum three HTTP tries for any one logical Pika request, including a
  same-key submit replay;
- exponential backoff starting at one second and capped at thirty seconds,
  with jitter;
- honor a valid `Retry-After` value, capped at sixty seconds;
- a thirty-second timeout per HTTP try and a two-minute total budget for
  describe/assembly/estimate catalog resolution;
- a twenty-minute overall job deadline;
- retry catalog, balance, upload-grant, signed PUT, job poll, content, and
  output-download transport failures only for HTTP 429/503 or a connection
  failure where replaying that exact logical request is safe;
- set `redirect: 'error'` on authenticated Pika API requests and signed PUTs so
  API keys or signed headers cannot be forwarded to a redirected origin;
- poll a known job id without resubmitting it; transient poll failures use the
  same bounded backoff inside the overall deadline;
- an uncertain submit transport failure reuses the same idempotency key so Pika
  can replay the original job rather than create a duplicate;
- a submit HTTP 429 or 503 received before a job id is known retries with the
  same idempotency key and does not repeat the balance check or uploads;
- a terminal `rate_limited` or `provider_unavailable` failed job may start the
  next bounded attempt with a fresh idempotency key, because Pika replays the
  failed job when the old key is reused;
- request validation, content moderation, authentication, insufficient
  balance, membership/cycle/admission errors, unknown operation, and ordinary
  provider failures are not retried unchanged; and
- reaching the overall deadline reports the known Pika job id and stops. It
  does not silently submit another job.

The `Idempotency-Key` header is a fixed-length lowercase SHA-256 digest of a
Pika namespace, the Core-generated Run id, request hash, and bounded job-attempt
ordinal. Transport retries keep it unchanged; a new terminal retry attempt
changes only the ordinal. Another explicit Renku Run receives another Run id
and therefore cannot accidentally replay an older completed Pika job.

### Simulation behavior

Add `supportsSimulation: boolean` to the existing Engines model summary and
input descriptor contracts. Existing bundled models report `true`; Pika models
report `false`.

Before estimate or validation, Core uses exact `readGenerationModel` to inspect
the fixed summary only when the requested mode is simulated. If a known model
reports `false`, Core returns `CORE_GENERATION_SIMULATION_UNSUPPORTED`. It makes
no Pika catalog request, creates no synthetic media, freezes no Spec, inserts
no durable failed Run, resolves no secret, and makes no provider call. Unknown
models and all currently bundled models continue through the existing path.
This capability is factual execution metadata, not a provider fallback or
product setting.

### Explicit non-goals

- no fal.ai schema, catalog, adapter, retry, polling, simulation, or output
  behavior changes;
- no deletion or deprecation of the existing schema-first provider stack;
- no Pika SDK dependency;
- no committed Pika input/output schemas, catalog snapshots, viewer
  annotations, overrides, or schema-maintenance commands;
- no full Pika catalog discovery or automatic activation of new Pika models;
- no Pika MiniMax H3 reference-to-video route in this slice, because its input
  video/image component pricing needs a broader exact quantity contract;
- no Pika image, audio, speech, transcription, music, dubbing, upscaling, or
  LLM support;
- no provider selection preference, provider health UI, automatic fallback, or
  fal.ai-to-Pika id translation;
- no synthetic Pika run, fake output, or Pika-specific dry-run command;
- no persistent schema cache while Pika publishes `Cache-Control: no-store`;
- no database schema or Project-data migration; and
- no live paid generation during ordinary tests or plan implementation without
  a separate explicit approval.

## Context And Current Evidence

### Accepted architecture

- `docs/decisions/0002-use-engines-for-ai-integrations.md` keeps concrete
  provider adapters inside `packages/engines`.
- `docs/decisions/0043-use-explicit-live-provider-run-approval.md` requires one
  reviewed exact price and explicit approval before a live provider request.
- `docs/decisions/0047-use-context-first-provider-valid-generation.md` makes
  provider schemas the source of execution requirements while keeping Core's
  creative context separate.
- `docs/decisions/0056-freeze-generation-specs-at-live-execution.md` freezes a
  managed Spec immediately before live execution; estimate and simulation do
  not freeze.
- `docs/decisions/0084-use-global-renku-provider-credential-storage.md` and
  `0085-use-platform-config-paths-and-first-run-setup.md` make the Core-owned
  Renku credential file the only production credential source and currently
  enumerate three visible providers.
- `docs/architecture/media-generation.md` keeps provider schemas, payload
  validation, pricing, uploads, execution, outputs, and receipts in Engines.

### Current Engines evidence

- `packages/engines/catalog/models/fal-ai` contains the maintained fal.ai YAML
  catalog, schema override manifest, and a large per-operation JSON schema
  tree.
- `scripts/fetch-fal-schema.mjs` downloads OpenAPI, identifies primary
  input/output schemas, rewrites references and URI formats, applies viewer
  annotations and overrides, and writes normalized files.
- `scripts/update-fal-catalog.mjs` compares, fetches, validates, and updates the
  maintained schema tree.
- `src/generation/catalog/model-input-descriptors.ts` is a 600-plus-line module
  coupled to the bundled `LoadedModelCatalog` and fal-shaped `SchemaFile`.
- `src/generation/execution/runner.ts` loads the same bundled schema, constructs
  a legacy `ProviderJobContext`, generates synthetic output for simulation, and
  sends live work through `createProviderRegistry`.
- `src/sdk/unified/schema-first-handler.ts` parses the repository schema wrapper,
  builds a provider SDK payload, uploads files, validates input/output, invokes
  a provider adapter, normalizes URLs, downloads output, emits notifications,
  and handles simulation.
- `src/sdk/fal` adds SDK configuration, queue subscription, timeout recovery,
  fal-specific errors, output normalization, and model-name heuristics.
- Core currently catches every Engines exception in
  `packages/core/src/server/generation/runs.ts` and replaces it with one generic
  `CORE_GENERATION_EXECUTION_FAILED` issue, which would discard Pika's stable
  error classification and job id.

### Pika evidence reviewed on 2026-08-22

- [Pika API index](https://dev.pika.art/llms.txt) declares the live catalog and
  per-operation specifications as the runtime source of truth.
- The public detail endpoint returns `api_id`, category, display pricing,
  concrete method/path, and expanded `input_schema` without an API key.
- [MiniMax H3 text-to-video](https://dev.pika.art/llms/minimax/h3/text-to-video)
  and [image-to-video](https://dev.pika.art/llms/minimax/h3/image-to-video)
  both price output per second by resolution and use the shared asynchronous
  media job lifecycle.
- H3 image-to-video uses Pika's `media_kinds` schema annotation on
  `first_frame_image` and nullable `last_frame_image`.
- Local read-only HTTP inspection showed the current catalog-detail response
  sends `Cache-Control: no-store` and no ETag or positive freshness lifetime.
- Pika documents a 20 MB image upload cap, five-minute presigned upload URLs,
  exact signed upload headers, stable job error codes, `Retry-After` for 429,
  and different idempotency-key behavior for uncertain transport retries versus
  terminal failed-job retries.
- The Pika catalog contains richer pricing units for other operations,
  including input media and output-token pricing. Those are not treated as
  exact merely because a `starting_at` price exists.

### Right-sized change decision

1. **Reuse the existing schema-first contract unchanged:** rejected. It would
   require Pika schema downloads, schema wrapper conversion, checked-in model
   files, update scripts, output-schema simulation, and adapter machinery the
   user explicitly wants to avoid.
2. **Refactor the existing owner through a small provider-runtime boundary:**
   selected. The four shared provider capabilities already exist in the public
   Engines workflow, while each provider remains free to own its schema shape,
   pricing interpretation, and transport.
3. **Build a universal dynamic provider/OpenAPI framework:** rejected. Pika has
   only two accepted operations in this slice, and no current requirement
   justifies generic OpenAPI ingestion, provider discovery, cache persistence,
   arbitrary pricing units, or a provider plugin API.

## Architecture Shape Gate

### Ownership and public entrypoints

`packages/engines` owns all Pika catalog, schema, pricing, upload, polling,
retry, error, and output behavior. Core continues to own durable Specs/Runs,
exact-price approval, reference-file resolution, freeze timing, output path
allocation, and credential-file access.

Existing package entrypoints remain the caller surface:

- `listGenerationModels`;
- `readGenerationModel`;
- `describeGenerationModelInputs`;
- `assembleGenerationProviderRequest`;
- `estimateGenerationProviderRequest`; and
- `runGeneration`.

Do not export Pika catalog records, schemas, clients, retry helpers, or provider
runtime internals from `packages/engines/src/index.ts`.

### Intended Engines module shape

```text
packages/engines/src/generation/
  providers/
    contracts.ts
    registry.ts
    bundled-provider.ts
    pika/
      operations.ts
      http.ts
      catalog-client.ts
      schema.ts
      pricing.ts
      errors.ts
      uploads.ts
      jobs.ts
      media-client.ts
      index.ts
  catalog/
    model-discovery.ts
    model-input-descriptors.ts
    json-schema-input-descriptors.ts
  execution/
    provider-request-assembly.ts
    runner.ts
```

- `providers/contracts.ts` owns the internal
  `GenerationProviderRuntime`/`ResolvedGenerationProviderModel` interfaces and
  provider execution input/result shapes.
- `providers/registry.ts` is a bounded exact-provider registry. It selects one
  registered runtime by provider id and contains no schema, pricing, retry, or
  transport logic.
- `providers/bundled-provider.ts` adapts the existing local catalog and current
  Provider Registry execution path to the new internal contract without
  changing provider behavior.
- `providers/pika/operations.ts` contains only the two accepted Pika operation
  ids, stable output kind/MIME declarations, and fixed no-simulation summary
  data used by model listing. It contains no field schema or price.
- `providers/pika/catalog-client.ts` owns the fixed-origin catalog GET,
  response-envelope validation, request-local snapshot, and identical in-flight
  request coalescing.
- `providers/pika/http.ts` owns the small fixed-origin JSON request primitive,
  retry/backoff/`Retry-After` mechanics, redirect rejection, safe response-size
  limits, and redaction. It is not a provider-agnostic recovery framework.
- `providers/pika/schema.ts` owns Pika `input_schema` descriptor projection,
  `media_kinds` interpretation, logical-placeholder validation, and final
  hosted-URL validation.
- `providers/pika/pricing.ts` owns the exact H3 per-second pricing projection
  and approved-price/balance comparison inputs. It imports no execution client,
  filesystem, output, or upload code.
- `providers/pika/errors.ts` owns Pika HTTP/job-error normalization into stable
  structured diagnostics.
- `providers/pika/uploads.ts` owns upload grants and same-target signed PUT
  replay using exact returned headers, byte length, and MIME.
- `providers/pika/jobs.ts` owns idempotency-key derivation, submit, known-job
  polling, content lookup, and output-byte download.
- `providers/pika/media-client.ts` is the shallow execution orchestrator. It
  resolves the secret, verifies approved price and balance, delegates uploads
  and the job lifecycle, and returns the provider result; it contains no schema
  parser or retry loop.
- `providers/pika/index.ts` is a thin internal module entrypoint that constructs
  the Pika runtime from those focused modules.
- `catalog/json-schema-input-descriptors.ts` receives the existing pure JSON
  Schema-to-descriptor mechanics extracted from the oversized current module.
  It accepts provider-supplied media annotations but knows no Pika HTTP or
  pricing behavior.
- `catalog/model-input-descriptors.ts` retains the public types and becomes a
  thin resolver/delegator through the provider runtime registry.
- `execution/provider-request-assembly.ts` keeps generic exact-reference
  assignment and asks the resolved provider model to validate the logical
  payload.
- `execution/runner.ts` keeps common request hashing, project-contained file
  reads, and output persistence. It delegates provider handoff through the
  resolved model and must shrink by moving legacy ProviderJobContext creation
  into `bundled-provider.ts`.

### Internal provider contract

Use this internal shape; it is not a package export:

```ts
interface GenerationProviderRuntime {
  readonly provider: string;
  listModels(): Promise<GenerationModelSummary[]>;
  readModel(model: string): Promise<GenerationModelSummary | null>;
  resolveModel(model: string): Promise<ResolvedGenerationProviderModel | null>;
}

interface ResolvedGenerationProviderModel {
  readonly summary: GenerationModelSummary;
  readonly descriptor: GenerationModelInputDescriptor;
  validatePayload(payload: Record<string, unknown>): GenerationProviderPayloadIssue[];
  estimateRequest(input: GenerationPricingInputs): GenerationCostEstimate;
  execute(input: GenerationProviderExecutionInput): Promise<GenerationProviderExecutionResult>;
}
```

The bundled runtime lists and reads its current catalog entries. The Pika
runtime lists and reads only the two fixed summaries from `operations.ts`; it
does not contact the catalog until `resolveModel` needs the exact schema and
price. Therefore a Pika catalog outage cannot break model listing, exact model
summary lookup, or the simulation capability gate, while exact work still
fails fast rather than using stale provider data.

A resolved model is request-local and immutable. For Pika it closes over one
validated live operation snapshot, so validation, price, and submit path cannot
drift within one run. It does not expose `unknown providerData`, a mutable
generic property bag, or a raw schema to Core.

`GenerationProviderExecutionInput` deliberately contains only:

- Core Run id (`executionId`);
- exact model identity and request hash;
- final logical payload plus exact input-file bytes/MIME assignments;
- expected output count and MIME;
- approved estimated cost for live execution;
- the injected `SecretResolver`; and
- an optional abort signal when the caller has one.

It does not contain Project database handles, purpose/target business rules,
Settings readers, CLI flags, HTTP request objects, or UI state.

### Bounded dispatch

The registry contains explicit entries for the new Pika runtime and the
existing bundled runtime's current provider ids. It must not use “unknown
provider means bundled,” wildcard provider fallback, provider-name substring
matching, or a switch that accumulates model-specific cases.

Provider/model branching stays inside the provider module. Pika's two supported
operation ids are a small allowlist in `operations.ts`, not branches in the
common runner.

### Existing files that remain unchanged or shrink

- `catalog/models/fal-ai/**`, `scripts/fetch-fal-schema.mjs`,
  `scripts/update-fal-catalog.mjs`, `src/sdk/fal/**`, and
  `src/sdk/unified/**` remain behaviorally unchanged.
- `src/registry-generator.ts` remains the existing bundled-provider factory and
  does not gain a Pika adapter.
- `model-input-descriptors.ts` and `runner.ts` must shrink or remain near their
  current size after responsibilities move. Adding Pika branches directly to
  either large file fails the gate.
- `generation/index.ts` and package `index.ts` remain thin exports.
- `package.json` adds no Pika SDK or other runtime dependency.

### Forbidden shapes and stop conditions

Do not implement:

- a Pika adapter inside `sdk/unified`;
- one Pika file that owns catalog parsing, pricing, uploads, retries, polling,
  schema validation, output download, and diagnostics;
- a generic OpenAPI downloader, schema converter, provider plugin loader, or
  arbitrary pricing expression language;
- raw Pika schema parsing in Core, CLI, server, or React;
- a generic `Record<string, unknown>` escape hatch passed between Core and a
  provider runtime for provider-private state;
- source-text architecture tests that freeze private function or class names;
- stale schema fallback after catalog failure;
- automatic provider/model fallback; or
- a second run persistence or approval lifecycle in Engines.

Stop and revise before implementation continues if:

- Pika cannot be integrated without committing its schema;
- exact H3 pricing cannot be derived from the live catalog response alone;
- the catalog must be available offline for a new Studio picker;
- Pika requires a new durable queue/recovery table or background worker;
- Core begins interpreting Pika fields or job states;
- the bundled provider adapter starts changing fal.ai behavior; or
- a common file becomes a provider switchboard or combines provider execution
  with output persistence and Core rules.

## Contracts

### Public Engines model capability

Add one factual field:

```ts
interface GenerationModelSummary {
  // existing fields
  supportsSimulation: boolean;
}

interface GenerationModelInputDescriptor {
  // existing fields
  supportsSimulation: boolean;
}
```

No optional compatibility form is retained. Existing bundled model projections
set the field explicitly to `true`; Pika sets it to `false`. Update every
current constructor and test fixture directly.

### Engines run input

Extend `RunGenerationOptions` with:

```ts
interface RunGenerationOptions {
  // existing fields
  executionId: string;
  approvedEstimatedCostUsd: number;
  signal?: AbortSignal;
}
```

Core passes the Run id it already allocated and the exact estimate it already
validated against the approval token. Existing bundled execution ignores the
approved cost because its local price snapshot remains unchanged; Pika compares
it with a fresh live price before any paid action.

### Pika operation declaration

`operations.ts` declares no schemas or prices:

```ts
interface SupportedPikaOperation {
  apiId:
    | 'minimax/h3/text-to-video'
    | 'minimax/h3/image-to-video';
  mediaKind: 'video';
  mime: readonly ['video/mp4'];
}
```

The catalog response must agree with this stable product allowlist. A category,
method, call-path, or operation-id mismatch is a catalog contract error, not a
reason to guess.

### Pika catalog response

Validate only the envelope Renku consumes:

```ts
interface PikaOperationSnapshot {
  apiId: string;
  category: string;
  call: { method: string; path: string };
  inputSchema: JSONSchema7;
  displayPricing: PikaDisplayPricing;
}

interface PikaDisplayPricing {
  components: Array<{
    role: string;
    unit: { type: string; quantity: number; included: number };
    startingAt?: PikaPricingTier;
    priceTiers?: PikaPricingTier[];
  }>;
}

interface PikaPricingTier {
  spec: Record<string, string | number | boolean>;
  microUsd: number;
}
```

The client validates Pika's snake-case `display_pricing`, `starting_at`,
`price_tiers`, and `micro_usd` fields before normalizing them into this internal
camel-case snapshot. `sell_usd` and unknown unused catalog fields are ignored;
required consumed fields with the wrong type fail with
`ENGINES_PIKA_CATALOG_INVALID`. Operation availability is established by the
exact detail lookup succeeding; the current detail envelope does not expose a
separate active flag.

### Diagnostics

Use stable structured codes:

| Code | Meaning |
| --- | --- |
| `ENGINES_PIKA_CATALOG_UNAVAILABLE` | The live public operation record could not be fetched. |
| `ENGINES_PIKA_OPERATION_UNAVAILABLE` | The requested id is not in the accepted allowlist or its exact detail no longer resolves. |
| `ENGINES_PIKA_CATALOG_INVALID` | The returned operation/schema/path/pricing envelope is malformed or inconsistent. |
| `ENGINES_PIKA_PRICE_UNAVAILABLE` | The current exact request cannot be priced from the accepted per-second contract. |
| `ENGINES_PIKA_PRICE_CHANGED` | The live run price differs from the approved estimate. |
| `ENGINES_PIKA_AUTH_INVALID` | The Pika key is missing, invalid, or inactive. |
| `ENGINES_PIKA_BALANCE_INSUFFICIENT` | Prepaid or active postpaid remaining balance cannot cover the exact request. |
| `ENGINES_PIKA_REQUEST_REJECTED` | Pika rejected schema, content, membership, cycle/admission, or another non-retryable request. |
| `ENGINES_PIKA_RATE_LIMITED` | Bounded 429/rate-limit retries were exhausted. |
| `ENGINES_PIKA_PROVIDER_UNAVAILABLE` | Bounded 503/provider-unavailable retries were exhausted. |
| `ENGINES_PIKA_JOB_FAILED` | A known job reached a non-retryable failed state. |
| `ENGINES_PIKA_JOB_TIMEOUT` | The overall deadline expired; include the known job id. |
| `ENGINES_PIKA_MEDIA_TRANSFER_FAILED` | Upload grant, signed PUT, content URL, or output download failed. |

Pika request/job ids may appear in issue context and persisted Run diagnostics.
API keys, authorization headers, presigned upload URLs, signed headers, hosted
input URLs, and output URLs must not appear in error messages, logs, receipts,
or browser-safe diagnostics.

Core's `runs.ts` must preserve a thrown `StructuredError` code/issues/suggestion
when creating the failed Run report. Unknown errors retain the current generic
`CORE_GENERATION_EXECUTION_FAILED` mapping. This is the minimum shared-boundary
change needed to keep Pika diagnostics structured; it does not reinterpret fal
errors or add provider rules to Core.

### Credential catalog

Change the exact ordered managed list to:

```text
fal.ai       FAL_KEY
Pika         PIKA_API_KEY
ElevenLabs   ELEVENLABS_API_KEY
World Labs   WLT_API_KEY
```

Pika uses the existing write-only replacement, atomic file, `0600`, no-store
HTTP, reusable onboarding, and per-operation secret-resolution behavior. This
plan adds no remote key test in Settings, deletion action, provider status
badge, balance display, or provider preference.

## Implementation Slices

### Slice 1: Record the provider-runtime and credential decision

- Add `docs/decisions/0086-use-provider-native-runtime-contracts-for-pika.md`
  for the Pika H3 proof, no maintained Pika schemas, no simulation, exact
  pricing, and the Pika credential addition.
- Add concise notices to `docs/decisions/0084-*` and `0085-*` stating that
  Decision 0086 extends the exact provider list with Pika; do not rewrite their
  historical bodies.
- Update `docs/architecture/media-generation.md`, its reference page, and
  `docs/architecture/layers-of-responsibility.md` to distinguish bundled
  maintained schemas from provider-native live operation schemas.

### Slice 2: Introduce the bounded internal provider runtime

- Add `generation/providers/contracts.ts`, `registry.ts`, and
  `bundled-provider.ts`.
- Move current bundled model resolution, validation, pricing, ProviderJobContext
  construction, registry invocation, and simulation delegation behind the
  bundled runtime without changing observable behavior.
- Split pure JSON Schema descriptor extraction from
  `model-input-descriptors.ts` into `json-schema-input-descriptors.ts`.
- Route existing public Engines operations through one exact resolved provider
  model per call.
- Keep fal.ai, Replicate, Wavespeed, ElevenLabs, OpenAI, and Vercel behavior and
  catalog data unchanged.

### Slice 3: Add live Pika operation resolution and validation

- Add the two-operation allowlist.
- Implement the fixed-origin public catalog client with response-envelope and
  call-path validation.
- Add request-local snapshots and in-flight de-duplication only.
- Project Pika JSON Schema and `media_kinds` into existing descriptors.
- Validate logical placeholder payloads safely and final hosted-URL payloads
  exactly.
- Register the Pika runtime explicitly; do not add it to
  `registry-generator.ts` or `sdk/unified`.

### Slice 4: Add exact Pika pricing and live media execution

- Implement the narrow H3 per-second estimator from live pricing components.
- Add approved-price comparison and prepaid/postpaid balance checks.
- Implement presigned image upload, final submit, polling, content retrieval,
  output download, idempotency, bounded retries, and overall timeout through
  the focused Pika HTTP/upload/job modules using native `fetch`.
- Return one ordinary Engines video artifact to the existing common output
  persistence path.
- Preserve Pika job identity and safe retry facts in diagnostics/receipt.

### Slice 5: Integrate Core capability and structured failure preservation

- Update `packages/core/src/server/generation/runs.ts` and the Engines run
  option contract so Core passes the Run id and approved price into Engines.
- At the start of `packages/core/src/server/generation/runs.ts`, use the exact
  offline `readGenerationModel` summary to reject simulated Pika execution
  before estimate, validation, Spec freeze, Run insertion, secret resolution,
  or provider invocation.
- In `packages/core/src/server/generation/runs.ts`, preserve Engines
  `StructuredError` issues in failed Run diagnostics while retaining generic
  mapping for unknown failures.
- Do not add Pika business rules to CLI, server, or React.

### Slice 6: Add Pika to global credentials and current documentation

- Add Pika to `packages/engines/src/provider-credentials/catalog.ts`.
- Update existing Core store/resolver, Settings editor, and onboarding tests
  that intentionally assert the exact provider set; reuse all existing UI and
  HTTP code without a new route or component.
- Update Engines README, CLI generation examples, operations/setup docs, and
  accepted architecture references.
- Do not update Studio Skills model selection or prompt guides because no Pika
  route is added to a curated product model family in this slice.

## Tests And Guardrails

### Engines provider-runtime coverage

- Existing bundled model discovery, descriptor, assembly, pricing, simulation,
  and live-adapter tests pass without changed expected provider payloads.
- Registry tests prove exact Pika dispatch and exact bundled provider dispatch;
  unknown providers fail rather than falling back.
- Model-list/read tests prove the two Pika summaries are discoverable without a
  catalog call and do not enter curated Studio video availability.
- Stable import-boundary tests prove pricing does not import execution/upload
  code and Pika does not import `sdk/unified`, `sdk/fal`, or schema update
  scripts.
- Architecture tests protect module imports/capabilities, not private helper or
  function names.

### Pika catalog and schema coverage

- Accept representative H3 text and image catalog records.
- Reject missing/mismatched `api_id`, unsupported operation, non-video category,
  non-POST method, absolute/cross-origin/dot-segment call paths, malformed
  schema, missing pricing, and non-JSON responses.
- Prove one Engines call reuses one immutable operation snapshot and concurrent
  identical fetches coalesce.
- Prove a settled response is not reused by the next top-level call while
  `no-store` remains the provider contract.
- Derive required prompt, duration, resolution, ratio, first-frame, and optional
  last-frame descriptors from Pika's schema without a checked-in production
  schema.
- Reject missing/invalid values, media cardinality, and an image larger than 20
  MB before secret resolution or submit.
- Prove logical placeholder substitution is validation-only and the actual
  hosted URL body is revalidated before submit.

### Pika pricing and approval coverage

- Derive 768P and 2K per-second prices for explicit duration/resolution.
- Use schema defaults for pricing only when duration/resolution are omitted.
- Never persist or insert those defaults into authored values or provider
  preview payloads.
- Reject a duration/resolution that remains missing after schema-default
  resolution, non-numeric duration, unmatched or ambiguous tier, unknown unit,
  malformed micro-USD value, and multiple unsupported components.
- Reject a price change between estimate and run before credentials, balance,
  upload, or submit.
- Check prepaid balance and active postpaid remaining balance; report exact
  dollar shortfall and do not submit when insufficient.

### Pika execution and retry coverage

Use scripted/injected `fetch`, clock, random, and sleep dependencies in focused
tests; do not wait real backoff intervals.

- Catalog, balance, upload-grant, signed PUT, poll, content, and download 429/
  503 responses honor bounded retry timing; their non-retryable 4xx responses
  stop immediately.
- Authenticated API calls and signed PUTs reject redirects before forwarding
  the API key or signed headers.
- Missing key fails before balance/upload/submit.
- Upload grant uses exact MIME and byte length; signed PUT sends returned
  headers verbatim and no API authorization header.
- The hosted URL, never the presigned upload URL or local path, enters the model
  field.
- Submit sends the exact live call path, body, API header, content type, and
  per-Run idempotency key.
- Queued/running/completed polling requests content only after completion and
  returns the downloaded MP4 bytes.
- An uncertain submit transport retry reuses one idempotency key.
- A terminal `rate_limited` or `provider_unavailable` retry uses a fresh key,
  honors bounded `Retry-After`, and never exceeds three attempts.
- A submit HTTP 429/503 before a job id reuses the same key and does not repeat
  uploads or the balance call.
- No logical request exceeds three HTTP tries, no generation exceeds three
  new-job keys, and all retries stop at the overall deadline.
- Poll transport retries never submit a second job.
- 401, 403, 404, 409, 413, 415, 422, content moderation, membership/cycle/
  admission failures, and non-retryable provider errors stop immediately with
  the correct structured code.
- Timeout and exhausted retry diagnostics include the safe job id when known.
- Tests scan logs, diagnostics, receipts, and thrown messages to prove secrets,
  authorization headers, signed upload URLs/headers, and hosted input URLs do
  not leak.
- No test makes a paid call unless it is under the existing opt-in live-provider
  E2E configuration and separately approved.

### Core and adapter coverage

- Core passes the allocated Run id and exact approved cost to Engines.
- Simulated Pika run returns `CORE_GENERATION_SIMULATION_UNSUPPORTED` before
  estimate, catalog access, validation, Spec freeze, or Run insertion.
- Live Pika success follows the existing freeze, output persistence, receipt,
  and Run record path.
- Pika `StructuredError` diagnostics survive the Core boundary and persist on a
  failed Run.
- Unknown thrown values still use `CORE_GENERATION_EXECUTION_FAILED`.
- CLI and server tests cover only unchanged delegation/serialization; do not
  repeat the Pika HTTP/error matrix outside Engines.

### Credential coverage

- The exact credential catalog order is fal.ai, Pika, ElevenLabs, World Labs.
- Pika replacement uses `PIKA_API_KEY`, remains write-only, and is available to
  the next live Engines operation without restart.
- Settings and onboarding reuse the existing generated fields/controller and
  add no Pika-specific component, key test, balance UI, or deletion action.
- Unknown providers remain rejected by the managed credential update command.

## Documentation And ADR Effects

### New decision

Add `docs/decisions/0086-use-provider-native-runtime-contracts-for-pika.md` to
record:

- the internal resolved-provider runtime boundary;
- live provider-native operation/schema/pricing resolution;
- request-local/no-store behavior;
- no Pika simulation;
- the two MiniMax H3 operations;
- exact pricing/balance/approval behavior;
- Pika idempotency/retry rules; and
- extension of the global credential list.

### Historical notices

Add concise Decision 0086 notices near the top of Decisions 0084 and 0085.
Leave their original reasoning and three-provider state intact as history.
Decision 0047 remains current and needs no supersession notice because live
Pika schemas still remain the source of provider execution requirements.

### Current references

Update:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/layers-of-responsibility.md`;
- `docs/cli/commands.md` with one exact Pika GenerationSpec example and the
  explicit no-simulation behavior;
- `docs/operations/local-development.md` with the optional Pika live E2E gate;
- `packages/engines/README.md` with provider-runtime ownership and
  `PIKA_API_KEY`; and
- current Settings/onboarding documentation that enumerates the managed
  credential fields.

Do not edit historical plans, fal.ai prompt guides, or Studio Skills model
registries merely to mention Pika.

## Final Verification

### Automated verification

Run focused checks first:

```bash
pnpm --dir packages/engines test
pnpm --dir packages/engines type-check
pnpm --dir packages/engines lint
pnpm --dir packages/core test
pnpm --dir packages/core type-check
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio type-check
```

Then run the root gates because public Engines/Core contracts and shared
credential projections changed:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

### Read-only live-contract verification

Without a key or paid request:

- fetch both accepted Pika catalog detail records;
- confirm operation ids, call paths, schemas, and per-second pricing still match
  the implemented contract;
- inspect response cache headers and confirm the implementation still obeys the
  current `no-store` policy;
- verify malformed/unavailable catalog fixtures fail without stale fallback;
  and
- verify no `PIKA_API_KEY` value is printed.

### Optional paid verification

Only after separate explicit approval and with a saved Pika key:

- estimate one short 768P MiniMax H3 text-to-video request;
- confirm the exact Pika balance check covers it;
- run exactly one approved request through the generic Core lifecycle;
- verify the Spec freezes, one Run completes, the Pika job id is retained, the
  MP4 is written through normal output persistence, and no additional job is
  submitted; and
- do not run the image-to-video route or a retry scenario as additional paid
  requests merely for final verification.

### Architecture and diff review

- Inspect `git diff --stat` and the complete diff while preserving unrelated
  working-tree changes.
- Inspect `model-input-descriptors.ts`, `runner.ts`, and every new provider file
  for size and responsibility.
- Confirm no Pika schema JSON, update script, SDK dependency, simulation media,
  stale cache, provider fallback, or model-id translation was added.
- Confirm `generation/index.ts`, provider `index.ts`, and package `index.ts`
  remain thin entrypoints.
- Confirm the bundled provider path did not change fal.ai payloads, errors,
  retries, outputs, or simulation.
- Confirm no checklist item is satisfied by accepting a broad switchboard,
  catch-all helper, or monolithic provider file.
- Run `git diff --check`.

## Completion Checklist

### Review Area

- [ ] Confirm every behavior maps to R1-R10.
- [ ] Confirm Pika is limited to the two MiniMax H3 video operations.
- [ ] Confirm the Settings/onboarding provider-list expansion is visible and
      necessary, not an incidental repository-integration leak.
- [ ] Confirm fal.ai behavior and maintained schema workflow remain unchanged.
- [ ] Confirm no persistent schema cache is used while Pika returns `no-store`.
- [ ] Confirm no Studio model-picker, automatic fallback, or full-catalog scope
      entered the implementation.
- [ ] Confirm the final module shape matches the Architecture Shape Gate.
- [ ] Confirm centralized ownership did not become a monolithic implementation.

### Architecture And Contracts

- [ ] Add the internal `GenerationProviderRuntime` and resolved-model contracts.
- [ ] Add exact provider registry entries with no wildcard/default fallback.
- [ ] Keep Pika model listing and exact summary lookup fixed, offline, and
      limited to identity/output/capability; require live catalog for exact
      description, assembly, estimation, and execution.
- [ ] Adapt the existing bundled path without changing current provider behavior.
- [ ] Add `supportsSimulation` explicitly to every model summary/descriptor
      constructor and fixture.
- [ ] Add `executionId`, approved cost, and optional signal to Engines run input.
- [ ] Keep public Core generation ownership and existing Engines public
      entrypoints.
- [ ] Keep provider schemas and private snapshots out of Core, CLI, server, and
      React contracts.
- [ ] Keep package-boundary failures structured.
- [ ] Add no compatibility shim, duplicate API, or broad provider property bag.

### Pika Catalog And Schema Slice

- [ ] Declare only the two accepted Pika operation ids, media kind, and MIME.
- [ ] Fetch the live detail record from the fixed Pika origin.
- [ ] Validate operation id, successful detail resolution, category, method,
      normalized relative path, input schema, and pricing envelope.
- [ ] Reuse one immutable snapshot within one Engines call.
- [ ] Coalesce identical in-flight catalog reads without retaining settled
      no-store responses.
- [ ] Project Pika scalar and nullable fields into existing descriptors.
- [ ] Project `media_kinds`, first frame, last frame, duration, and ratio
      semantics without copying the operation schema.
- [ ] Project the documented 20 MB Pika image transport limit into both H3
      media descriptors.
- [ ] Validate logical placeholders with validation-only HTTPS substitutes.
- [ ] Revalidate actual hosted-URL payloads immediately before submit.
- [ ] Add no production Pika schema fixture, downloader, updater, annotation,
      or override manifest.

### Pricing And Approval Slice

- [ ] Parse only the accepted H3 per-second output pricing contract.
- [ ] Match exactly one resolution tier and derive quantity from duration.
- [ ] Use schema defaults only for estimate calculation.
- [ ] Return price unavailable for unsupported/ambiguous pricing shapes.
- [ ] Compare the fresh live run estimate with the approved estimate.
- [ ] Stop before credentials/network when the price changed.
- [ ] Check prepaid balance or active postpaid remaining balance before every
      new-idempotency-key paid job attempt.
- [ ] Report exact shortfall without submitting when balance is insufficient.

### Pika Execution Slice

- [ ] Resolve `PIKA_API_KEY` only through the injected SecretResolver.
- [ ] Request presigned uploads with exact MIME and byte length.
- [ ] PUT exact bytes with every signed header and no leaked API authorization.
- [ ] Submit only to the validated fixed-origin operation path.
- [ ] Derive idempotency from Run id, request hash, and bounded attempt ordinal.
- [ ] Poll one known job through queued/running to a terminal state.
- [ ] Request content only after completion and download one HTTPS MP4 output.
- [ ] Reuse the same key for uncertain transport retry.
- [ ] Use a fresh key only for a bounded terminal rate-limit/provider-
      unavailable retry.
- [ ] Honor bounded `Retry-After`, backoff, jitter, attempt count, and overall
      deadline.
- [ ] Apply the retry matrix to catalog, balance, upload grant/PUT, submit,
      poll, content, and output download without a generic recovery framework.
- [ ] Reject authenticated API and signed-upload redirects before forwarding
      credentials or signed headers.
- [ ] Never retry non-retryable request, auth, payment, moderation, or provider
      failures unchanged.
- [ ] Never switch to fal.ai or another model after failure.
- [ ] Preserve safe Pika job/retry facts without secret or URL leakage.

### Core And Credential Integration

- [ ] Pass Run id and exact approved cost from Core to Engines.
- [ ] Reject Pika simulation from the fixed summary before estimate, catalog
      access, validation, freeze, Run insertion, secret resolution, or network.
- [ ] Persist structured Pika failure diagnostics on the ordinary failed Run.
- [ ] Preserve generic Core mapping for unknown provider errors.
- [ ] Add Pika/`PIKA_API_KEY` to the exact Engines credential catalog order.
- [ ] Reuse existing Core credential storage/resolution and Studio fields/
      onboarding composition.
- [ ] Add no provider-specific route, component, key validation, deletion,
      balance UI, or preference.

### Tests And Guardrails

- [ ] Keep comprehensive catalog/schema/pricing/retry/error tests in Engines.
- [ ] Keep Core tests focused on approval data, simulation gate, persistence,
      and structured-error preservation.
- [ ] Keep CLI/server/Studio tests focused on delegation and the generated
      credential field.
- [ ] Prove existing bundled/fal.ai behavior with current regression tests.
- [ ] Prove unknown providers do not fall back.
- [ ] Prove no secret, signed upload data, or provider URL leaks.
- [ ] Add stable import/capability guardrails without private-name needles.
- [ ] Keep paid Pika tests outside default commands and approval-gated.

### Documentation And ADR Work

- [ ] Add Decision 0086 with the accepted lightweight provider boundary.
- [ ] Add concise Decision 0086 notices to Decisions 0084 and 0085 without
      rewriting their history.
- [ ] Update current media-generation and layer ownership references.
- [ ] Update Engines README, CLI example, provider credential docs, and local
      live-test guidance.
- [ ] Keep historical plans and unrelated provider/skill guidance unchanged.

### Final Verification

- [ ] Run focused Engines, Core, and Studio checks.
- [ ] Run root build, test, lint, and check gates.
- [ ] Re-fetch both live Pika operation records and cache headers read-only.
- [ ] Perform no paid request without separate explicit approval.
- [ ] If approved, run exactly one short Pika text-to-video acceptance request.
- [ ] Inspect `git diff --stat`, the complete diff, and all large/heavily
      modified files.
- [ ] Confirm `index.ts` files remain thin and no broad dispatcher, catch-all
      helper, or god file was added.
- [ ] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [ ] Run `git diff --check`.
- [ ] Only then mark this plan complete.
