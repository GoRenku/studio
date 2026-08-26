# Adding A Media Provider

This guide describes the provider extension seam accepted by Decision 0086. A
normal provider addition stays inside the standalone Engines package, one CLI
composition registration, provider Skill guidance, tests, and release metadata.

It does not add Core/Studio/database/Preview concepts, cannot add a workspace
dependency, and does not require provider protocol logic or a new executable in
the CLI. A credential descriptor or Project Settings choice is a separate Studio
product decision.

## 1. Create the provider module

Use `src/providers/<provider>/`. Keep authentication, endpoints, schema
extraction, retry classification, provider job states, output parsing, and
recovery beside the provider. Its `index.ts` exports a factory and focused public
types only.

Implement the public `MediaProvider` contract:

```ts
const atlasProvider: MediaProvider = {
  id: 'atlas',
  async readInputSchema(model, context) {
    // Return the exact raw schema from the same loader used by validation.
    return loadAtlasInputSchema(model, context);
  },
  async validate(request, context) {
    // Load the exact-model schema and validate provider-native request.input.
  },
  async execute(request, context) {
    // Upload local markers, submit, poll, download, and normalize artifacts.
    return { provider: 'atlas', model: request.model, artifacts: [] };
  },
  async recover(request, context) {
    // Continue from request.requestId without persisted Renku run state.
    return { provider: 'atlas', model: request.model, requestId: request.requestId, artifacts: [] };
  },
};
```

Implement `readInputSchema` when the provider exposes a current machine-readable
input schema. Return that exact raw schema; do not normalize it into controls,
labels, defaults, or a Renku-owned field model. `MediaEngine.readInputSchema`
reports `ENGINE_INPUT_SCHEMA_UNAVAILABLE` when a provider does not implement the
optional capability.

Keep curated exact model ids and selection guidance in the provider Skill's
supported-model index. Engines does not maintain a model allowlist or product
catalog: the selected model remains the exact string authored by the provider
Skill, and the provider module validates it through the provider's live metadata
and implemented protocol family.

A provider marketplace may expose more operations than Renku initially guides.
Keep these three scopes distinct:

- the provider's live catalog is the external source of currently available
  operations and schemas;
- the Engines adapter accepts only the protocol families it deliberately
  implements and fails closed for unknown families; and
- the provider Skill curates the smaller set Renku can select automatically,
  with one guide per exact operation.

Do not copy a whole live catalog into Engines or a Skill, and do not claim every
marketplace operation is supported merely because it appears in discovery. A
new operation within an already implemented protocol family should normally
require Skill guidance and live-schema verification, not an Engines allowlist
change.

## 2. Retrieve and cache exact metadata

Fetch current metadata/schema for the selected model from the provider's
official endpoint. One provider-owned loader must serve `readInputSchema`,
`validate`, and `execute`; do not duplicate retrieval or schema extraction for
the inspection path. Cache the unmodified response with
`ProviderMetadataCache`. Honor `ETag`, `Last-Modified`, `Cache-Control`, expiry,
refresh, and `no-store` where the provider supports them. A `no-store` response
may coalesce only concurrent in-flight retrievals and must not be written to the
memory or filesystem cache. Do not bake provider schema interpretation into the
raw cache.

Schema extraction is provider-owned. Validate with the shared AJV executor only
after extracting the exact input schema. Metadata failures map to
`ENGINE_METADATA_UNAVAILABLE` or `ENGINE_METADATA_INVALID`; request failures map
to `ENGINE_REQUEST_INVALID` or the more precise closed code.

## 3. Resolve local media

Use `findLocalMediaFiles`, `replaceLocalMediaFilesWithValidationUrls`, or
`substituteLocalMediaFiles`. A marker has exactly these fields:

```ts
interface LocalMediaFile {
  $file: string;
  mimeType?: string;
  reviewLabel?: string;
  promptMention?: string;
}
```

`reviewLabel` and `promptMention` are opaque caller review metadata. Engines and
provider adapters must not interpret prompt syntax or require either annotation.
Read the file locally, upload through the provider's supported API, and replace
the entire marker object with the validation URL or provider transport value in
a copy of request JSON. The annotations must never reach provider schema
validation, upload metadata, or submission. Never mutate the caller's request.

Callers may impose stricter review-document requirements before Engines receives
the request. That policy does not belong in this generic marker contract.

Local read failures use `ENGINE_LOCAL_MEDIA_INVALID`; upload failures use
`ENGINE_UPLOAD_FAILED`. Do not place Project-relative policy in Engines—the CLI
and Core resolve that boundary before Engines receives absolute paths.

## 4. Submit, retry, poll, and recover

Use the shared timing mechanisms while keeping policy provider-local:

- the provider classifies authentication, rate limits, transient service errors,
  terminal job failures, and retryable statuses;
- honor provider `Retry-After` and the operation deadline;
- check `AbortSignal` before and during network waits;
- keep request timeout distinct from operation timeout;
- return a provider request/job id as soon as it is known;
- implement `recover` only when the provider protocol supports stateless job
  retrieval.

Map failures to the closed `EngineErrorCode` union. Include safe provider, model,
HTTP status, retryability, retry delay, and request id where known. Never include
credentials, authorization headers, signed URLs, or raw secret-bearing causes.

## 5. Normalize and download outputs

Provider code discovers output URLs/bytes and decides their semantic media kind.
Use shared download helpers for timeout, cancellation, MIME and size validation,
atomic writes, and recovery-safe redownload. Return only `GeneratedMediaArtifact`
records with local paths, MIME type, byte length, and optional safe opaque output
facts. The caller constructs Asset provenance; Engines never imports it.

## 6. Prove the seam before registration

Create a deterministic Atlas-like test provider using only exports from the built
package surface. Test:

1. registration and duplicate/unsupported ids;
2. exact raw schema inspection, unavailable capability, native validation, and
   structured rejection;
3. one recursive annotated `LocalMediaFile` whose entire marker is substituted;
4. execution and normalized artifact output;
5. recovery supported and unsupported behavior;
6. cancellation and timeout;
7. every provider error mapping without secret output;
8. cache hit, refresh, expiry, corruption, `no-store`, and concurrent fetch;
9. retry attempts, jitter, deadline, `Retry-After`, and cancellation.

Then add mocked protocol regression tests for authentication, submission,
polling, recovery, output shapes, and downloads. Network-free tests are
required. Paid tests are optional, manual, and explicitly approved.

When adding an approved paid E2E, use the Engines-local
`readOptInProviderTestCredential` and `createProviderTestContext` helpers. Give
the suite a short, provider-specific `RUN_<PROVIDER>_TEST=1` opt-in, keep it out
of automatic test commands, and let the shared context remove its temporary
output. The E2E must not import Core, inspect saved Renku credentials, or add a
saved-artifact mode merely for debugging.

The current `src/media/engine.test.ts` is the minimal public-seam example. It
registers a test-only `atlas` provider without adding it to production catalogs,
credentials, Settings, or Skills.

## 7. Compose and document

After Engines tests pass:

- export the provider factory from `src/index.ts`;
- add one provider instance to the existing list in the CLI media-engine
  composition root;
- add a provider Skill model index and operation guides;
- document credential configuration only if a separate product decision added
  the descriptor;
- update package/release notes.

The CLI must still call only `MediaEngine.readInputSchema`, `validate`,
`execute`, or `recover`. The existing `generation schema show` command exposes
the generic schema capability; do not add a provider-specific schema command or
branch. The CLI must not learn request fields, endpoints, upload formats, retry
rules, polling states, output shapes, or download behavior.

The Skill's supported-model index is curated selection data, not a mirror of the
provider catalog or schema. Keep volatile fields, enums, bounds, defaults,
prices, and availability in the provider's live metadata. Keep stable editorial
selection, prompt, and reference guidance in the exact-operation guide.

## 8. Run package checks and a standalone consumer

```bash
pnpm --dir packages/engines type-check
pnpm --dir packages/engines test:typecheck
pnpm --dir packages/engines test
pnpm --dir packages/engines build
pnpm --dir packages/engines lint
```

Finally import only `@gorenku/studio-engines` from a temporary consumer outside
the workspace source graph. Register the test provider and execute through the
built `dist/index.js`. The consumer must not install or resolve any
`@gorenku/studio-*` package other than Engines.
