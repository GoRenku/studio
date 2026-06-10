# 0056 ElevenLabs Voice Sample Retrieval

Status: planned
Date: 2026-06-09

## Summary

This plan adds a no-generation path for attaching an existing ElevenLabs voice
sample to a Cast Voice.

ElevenLabs exposes an endpoint that returns the audio bytes for a provider-owned
voice sample:

```text
GET /v1/voices/{voice_id}/samples/{sample_id}/audio
```

That endpoint requires a `sample_id`. A voice-id-only workflow therefore needs
two ElevenLabs calls:

```text
GET /v1/voices/{voice_id}
GET /v1/voices/{voice_id}/samples/{sample_id}/audio
```

The first call retrieves voice metadata, including the voice's `samples` list.
Renku selects a sample id from that list, then uses the second call to retrieve
the MP3 bytes.

ElevenLabs references:

- [Get voice](https://elevenlabs.io/docs/api-reference/voices/get)
- [Get voice sample audio](https://elevenlabs.io/docs/api-reference/voices/samples/get)

Renku Studio already supports Cast Voices and custom audio sample attachments
through `renku cast voice attach`. It also supports generated Cast Voice samples
through the `cast.voice-sample` media generation purpose. This plan adds the
third source:

```text
ElevenLabs voice id -> voice metadata samples -> sample id -> MP3 bytes -> Cast Voice sample asset
```

The important product behavior is:

1. The user or agent chooses a voice in ElevenLabs.
2. The user or agent provides the ElevenLabs `voiceId`.
3. Renku reads the ElevenLabs voice metadata and selects a sample id from the
   returned `samples` list.
4. Renku fetches that provider-owned sample MP3 directly from ElevenLabs.
5. Renku stores that MP3 under the Cast Member's `voice-samples` folder.
6. Renku attaches the Cast Voice using the same durable Cast Voice model as
   custom MP3 and generated sample attachments.

This does not run text-to-speech generation, does not create a
`media_generation_spec`, does not create a `media_generation_run`, and does not
require a generation estimate or approval token.

The custom MP3 attachment path remains supported. The new ElevenLabs sample
path is additive and uses the same Cast Voice record and audio card behavior
after attachment.

## Existing State

### Cast Voice Support

Plan `0054` introduced first-class Cast Voices. The current implementation has:

- `CastVoice` and `CastVoiceAttachmentDocument` client contracts;
- `cast_voice` persistence records;
- `cast/<handle>/voice-samples/` file storage;
- core commands for listing, reading, validating, attaching, and removing Cast
  Voices;
- CLI commands under `renku cast voice`;
- `cast.voice-sample` generation support for ElevenLabs text-to-speech.

The current file-backed attachment document is:

```json
{
  "kind": "castVoiceAttachment",
  "castMemberId": "cast_urban",
  "name": "normal-voice",
  "provider": "elevenlabs",
  "model": "eleven_v3",
  "voiceId": "JBFqnCBsd6RMkjVDRZzb",
  "purpose": "Default spoken dialogue and calm technical explanation.",
  "sample": {
    "sourceProjectRelativePath": "generated/media/urban-normal-voice.mp3",
    "title": "Urban normal voice sample",
    "receipt": null
  }
}
```

That document assumes the sample audio already exists inside the project
folder. It is still the right contract for:

- user-supplied custom MP3, WAV, or M4A files;
- generated Cast Voice sample outputs from `cast.voice-sample`;
- any future tool that materializes an audio file first and then attaches it.

### ElevenLabs Engine Support

`packages/engines` already has a direct ElevenLabs provider adapter:

- `packages/engines/src/sdk/elevenlabs/client.ts`
- `packages/engines/src/sdk/elevenlabs/adapter.ts`
- `packages/engines/src/sdk/elevenlabs/handler.ts`
- `packages/engines/src/sdk/elevenlabs/retry.ts`
- `packages/engines/src/sdk/elevenlabs/output.ts`

The adapter currently handles generation-like calls:

- text-to-speech models such as `eleven_v3`;
- music generation through `music_v1`;
- simulated audio output for dry-runs and tests;
- structured retry/error mapping for ElevenLabs API errors.

The adapter does not yet expose a reusable operation for resolving and fetching
an existing voice sample by `voiceId`.

### CLI Shape

The current CLI supports:

```bash
renku cast voice list --cast <cast-member-id> --json
renku cast voice show --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
renku cast voice validate --file <cast-voice-attachment-json> --json
renku cast voice attach --file <cast-voice-attachment-json> --json
renku cast voice remove --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
```

`attach` is the right domain verb: Renku is attaching a provider voice identity
and a representative sample asset to a Cast Member. The new functionality should
keep that verb and make the document kind explicit.

## Problems To Solve

### Existing Provider Samples Are Not Generation

The user wants to hear what a voice sounds like without generating new audio.
Treating the ElevenLabs sample endpoint as `cast.voice-sample` generation would
be misleading because:

- there is no prompt text;
- there is no model execution;
- there is no generation estimate;
- there is no generated output receipt;
- the endpoint retrieves existing provider-owned audio.

The implementation needs a separate provider sample retrieval path.

### The Agent Should Not Need A Manual Download Step

Today, if a user wants to attach an existing ElevenLabs sample, the likely
workflow is:

1. download the MP3 from ElevenLabs manually;
2. put it in the Renku project folder;
3. ask the agent to attach that file with `renku cast voice attach`.

The new workflow should let the agent go straight from:

```text
voiceId + Cast Voice metadata
```

to:

```text
durable Cast Voice with sample asset
```

without asking the user to provide the MP3 file.

### Custom MP3 Attachments Must Stay First-Class

Provider-owned samples are useful for quickly auditioning a voice, but they are
not the only valid sample source. Users may still want to attach:

- a hand-picked custom MP3;
- a recorded actor reference;
- a generated sample they already approved;
- a localized or edited sample file.

The new contract must not remove or weaken the file-backed attachment document.

### Source Provenance Should Be Explicit

An attached voice sample can now come from three current sources:

- a custom local file;
- a generated Cast Voice sample;
- an existing ElevenLabs provider sample.

Those sources should not be guessed from filenames. The Cast Voice and asset
metadata should preserve enough provenance to explain where the sample came
from and to support future UI/reporting.

## Goals

1. Add an ElevenLabs engine operation that retrieves voice metadata by
   `voiceId`, selects a sample id, and retrieves that sample's audio file.
2. Reuse the existing ElevenLabs API key loading, retry, and structured provider
   error patterns where they apply.
3. Add a provider-sample Cast Voice attachment document for ElevenLabs.
4. Keep the current file-backed `castVoiceAttachment` document supported for
   custom MP3/WAV/M4A attachments.
5. Persist provider sample provenance so Renku can distinguish custom files,
   generated samples, and ElevenLabs provider samples.
6. Hook the new document into core validation and attachment.
7. Hook the new document into `renku cast voice validate` and
   `renku cast voice attach`.
8. Keep the retrieved sample stored as a normal Cast Voice sample asset under
   `cast/<handle>/voice-samples/`.
9. Keep Studio UI behavior unchanged after attachment: the sample appears and
   plays like any other Cast Voice sample.
10. Update docs and agent-facing workflow guidance so agents know when to fetch
    a provider sample and when to ask for a custom file.

## Non-Goals

- Do not build an ElevenLabs voice browser in Studio.
- Do not add an ElevenLabs voice list/search command in this slice.
- Do not add voice cloning, instant voice creation, dubbing, lip sync, or
  narration assembly.
- Do not treat provider sample retrieval as media generation.
- Do not add a generation estimate, generation approval token, or
  `media_generation_run` for provider sample retrieval.
- Do not remove or rename the custom file attachment workflow unless the
  implementation explicitly replaces all callers in the same slice.
- Do not use fal.ai or Wavespeed ElevenLabs wrapper models.
- Do not add compatibility aliases such as `voice add`, `voice create`, or
  `sample download`.
- Do not infer Cast Voice metadata from raw filenames, provider ids, or
  generated labels.

## Product Terms

### Cast Voice

A **Cast Voice** remains a Cast Member-owned provider voice reference. It stores
the provider, model, provider voice id, Renku reference name, purpose, and sample
asset.

### Cast Voice Sample

A **Cast Voice Sample** remains an audio Asset attached to a Cast Member with
role `voice_sample` and linked from exactly one Cast Voice record.

### ElevenLabs Provider Voice Sample

An **ElevenLabs Provider Voice Sample** is an existing sample attached to an
ElevenLabs voice in the provider account. It is identified by:

```text
voiceId + sampleId
```

Renku does not create this sample. Renku resolves `sampleId` through the
ElevenLabs voice metadata response, retrieves the sample audio bytes, and stores
them as a Cast Voice Sample asset.

### Cast Voice Sample Source

A **Cast Voice Sample Source** records how the sample asset entered Renku.

Current source kinds:

```text
custom_file
generated_sample
elevenlabs_voice_sample
```

`custom_file` means the user or agent supplied a project-local audio file.

`generated_sample` means the sample was generated through Renku's
`cast.voice-sample` media generation workflow and attached afterward.

`elevenlabs_voice_sample` means Renku fetched an existing sample from
ElevenLabs by resolving a sample id from the supplied `voiceId`.

## User Workflows

### Attach A Custom MP3

This existing workflow remains valid:

```bash
renku cast voice attach --file cast-voice-attachment.json --json
```

The JSON document stays file-backed:

```json
{
  "kind": "castVoiceAttachment",
  "castMemberId": "cast_urban",
  "name": "normal-voice",
  "provider": "elevenlabs",
  "model": "eleven_v3",
  "voiceId": "JBFqnCBsd6RMkjVDRZzb",
  "purpose": "Default spoken dialogue and calm technical explanation.",
  "sample": {
    "sourceProjectRelativePath": "references/audio/urban-normal.mp3",
    "title": "Urban normal voice sample"
  }
}
```

Core copies the file into:

```text
cast/<handle>/voice-samples/
```

and records the sample source as `custom_file`, unless a generation receipt is
present.

### Attach A Generated Sample

The existing generated workflow remains valid:

1. create a `cast.voice-sample` generation spec;
2. estimate and run the generation;
3. inspect or play the generated output;
4. attach the generated audio file with `renku cast voice attach`;
5. include the generation receipt in `sample.receipt`.

Core records the sample source as `generated_sample`.

### Attach An Existing ElevenLabs Provider Sample

The new workflow uses the same `attach` command with a provider-sample document:

```bash
renku cast voice validate --file cast-voice-elevenlabs-sample.json --json
renku cast voice attach --file cast-voice-elevenlabs-sample.json --json
```

Example document:

```json
{
  "kind": "castVoiceElevenLabsSampleAttachment",
  "castMemberId": "cast_urban",
  "name": "normal-voice",
  "provider": "elevenlabs",
  "model": "eleven_v3",
  "voiceId": "JBFqnCBsd6RMkjVDRZzb",
  "purpose": "Default spoken dialogue and calm technical explanation.",
  "sample": {
    "title": "Urban normal ElevenLabs voice sample"
  }
}
```

Validation checks project-local metadata and database constraints. Attachment
performs the live provider calls, writes the MP3 file, and creates the Cast
Voice.

The command does not need:

- `sample.sourceProjectRelativePath`;
- `sample.receipt`;
- generation estimate;
- generation approval token.

## Engine Design

### New Module

Add a focused module:

```text
packages/engines/src/sdk/elevenlabs/voice-samples.ts
```

This module owns the provider-specific sample retrieval operation. It should not
be implemented in core, CLI, or the generic generation runner.

### Public Engine Contract

Add an exported function from `packages/engines/src/sdk/elevenlabs/index.ts` and
the package root:

```ts
export interface ElevenLabsVoiceSampleAudioRequest {
  voiceId: string;
  apiBaseUrl?: string;
  secretResolver?: SecretResolver;
  logger?: ProviderLogger;
  signal?: AbortSignal;
}

export interface ElevenLabsVoiceSampleAudio {
  provider: 'elevenlabs';
  voiceId: string;
  sampleId: string;
  voiceName: string | null;
  sampleFileName: string | null;
  mimeType: 'audio/mpeg';
  audioBytes: Buffer;
  fetchedAt: string;
  apiBaseUrl: string;
  contentLength: number;
}

export async function fetchElevenLabsVoiceSampleAudio(
  request: ElevenLabsVoiceSampleAudioRequest
): Promise<ElevenLabsVoiceSampleAudio>;
```

The exact `Buffer` import can follow local TypeScript conventions, but the
returned shape must be binary bytes plus provider provenance. Do not return a
temporary file path from engines. Core owns project file storage.

### API Requests

Live mode first sends:

```text
GET {apiBaseUrl}/v1/voices/{voiceId}
xi-api-key: <ELEVENLABS_API_KEY>
```

The response must include a `samples` list with at least one object containing a
non-empty `sample_id`.

Then live mode sends:

```text
GET {apiBaseUrl}/v1/voices/{voiceId}/samples/{sampleId}/audio
xi-api-key: <ELEVENLABS_API_KEY>
```

Default `apiBaseUrl`:

```text
https://api.elevenlabs.io
```

The function may also accept an explicit `apiBaseUrl` or read
`ELEVENLABS_API_BASE_URL` after loading provider env files. This supports the
documented US, EU, and India residency hosts without adding Studio UI in this
slice.

Accepted base URLs:

```text
https://api.elevenlabs.io
https://api.us.elevenlabs.io
https://api.eu.residency.elevenlabs.io
https://api.in.residency.elevenlabs.io
```

If a different base URL is needed later, add it deliberately and test it. Do not
silently accept arbitrary URLs.

### Voice Metadata Handling

On `GET /v1/voices/{voiceId}`:

- parse the response as JSON;
- require `voice_id` to match the requested `voiceId` when present;
- require `samples` to be a non-empty array;
- require at least one `sample_id`;
- select the first sample with a non-empty `sample_id` in provider response
  order;
- keep `voice.name` and `sample.file_name` as optional provenance, not as
  visible card copy.

Do not call the list/search voices endpoint in this slice. The user supplies the
specific `voiceId`.

### Audio Response Handling

The OpenAPI excerpt describes an empty JSON schema for the `200` response, but
the endpoint purpose and user workflow are audio retrieval. The implementation
should treat the endpoint as a binary audio response.

On `2xx`:

- read the response as `arrayBuffer`;
- fail if the response is empty;
- require an audio content type when present;
- persist the output as `audio/mpeg`;
- return the bytes to core.

If ElevenLabs returns `application/json` on a successful response, fail fast with
a provider error instead of writing JSON as an MP3.

On non-`2xx`:

- parse JSON error bodies when available;
- preserve HTTP status and provider error details in metadata;
- reuse `parseElevenlabsError`, `createElevenlabsProviderError`, and
  `runWithRetries` where practical;
- map 401 to `SdkErrorCode.INVALID_API_KEY`;
- map missing or invalid voice/sample cases to `SdkErrorCode.INVALID_VOICE`;
- map 429 and system busy responses to `SdkErrorCode.RATE_LIMITED`;
- map unexpected provider responses to
  `SdkErrorCode.PROVIDER_PREDICTION_FAILED`.

### Simulation Policy

Provider sample retrieval must not have a persisted simulation mode.

This operation is cheap and does not generate new media, but a persisted Cast
Voice sample must always represent one of these real sources:

- a user-supplied file;
- a generated sample with a generation receipt;
- a live ElevenLabs sample retrieved from the provider.

Tests should use mocked HTTP responses or an injected in-memory fetch operation
to exercise file writing and database insertion. They should not create
database rows that pretend a simulated provider sample was fetched from
ElevenLabs.

### Engine Tests

Add tests under:

```text
packages/engines/src/sdk/elevenlabs/voice-samples.test.ts
```

Coverage:

- trims and validates `voiceId`;
- rejects unsupported `apiBaseUrl`;
- sends `GET /v1/voices/{voiceId}` with the expected `xi-api-key` header;
- selects the first usable `sample_id` from the voice metadata response;
- sends `GET /v1/voices/{voiceId}/samples/{sampleId}/audio` with the expected
  `xi-api-key` header;
- returns MP3 bytes and provenance on a successful mocked response;
- fails fast when the voice metadata response has no usable sample id;
- fails fast on empty response bodies;
- fails fast on successful JSON responses;
- maps 401, 404/422, and 429 responses to structured provider errors;
- retries retryable ElevenLabs rate-limit errors through the existing retry
  function;
- supports mocked HTTP responses without live provider credentials.

## Core Design

### Public Contracts

Keep the existing file-backed document:

```ts
export interface CastVoiceAttachmentDocument {
  kind: 'castVoiceAttachment';
  castMemberId: string;
  name: string;
  provider: string;
  model: string;
  voiceId: string;
  purpose: string;
  sample: {
    sourceProjectRelativePath: ProjectRelativePath;
    title: string;
    receipt?: unknown;
  };
}
```

Add an ElevenLabs provider-sample document:

```ts
export interface CastVoiceElevenLabsSampleAttachmentDocument {
  kind: 'castVoiceElevenLabsSampleAttachment';
  castMemberId: string;
  name: string;
  provider: 'elevenlabs';
  model: 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5';
  voiceId: string;
  purpose: string;
  sample: {
    title: string;
  };
}
```

Add a union for command input:

```ts
export type CastVoiceAttachmentCommandDocument =
  | CastVoiceAttachmentDocument
  | CastVoiceElevenLabsSampleAttachmentDocument;
```

Do not use a loose `unknown` document beyond the validation boundary.

### Cast Voice Sample Source Contract

Add:

```ts
export type CastVoiceSampleSource =
  | {
      kind: 'custom_file';
    }
  | {
      kind: 'generated_sample';
    }
  | {
      kind: 'elevenlabs_voice_sample';
      sampleId: string;
      fetchedAt: string;
      apiBaseUrl: string;
    };
```

Add to `CastVoice`:

```ts
sampleSource: CastVoiceSampleSource;
```

The source belongs to the Cast Voice contract because the Cast Voice explains
why this audio asset represents a provider voice. The file and asset still carry
the playable bytes, MIME type, hash, size, role, reference name, and purpose.

### Database Changes

Add nullable provenance columns to `cast_voice`:

```text
sample_source_kind text not null
sample_id text
sample_fetched_at text
sample_api_base_url text
```

Rules:

- `sample_source_kind` is one of `custom_file`, `generated_sample`, or
  `elevenlabs_voice_sample`.
- `sample_id`, `sample_fetched_at`, and `sample_api_base_url` are required when
  `sample_source_kind` is `elevenlabs_voice_sample`.
- sample-specific fields are null for `custom_file` and `generated_sample`.
- existing rows are migrated to `generated_sample` when the linked Asset origin
  is `generated`; otherwise they are migrated to `custom_file`.

This is a project database schema change. The implementation must follow the
accepted Drizzle Kit workflow in
`docs/architecture/reference/drizzle-migrations.md`:

1. edit the Drizzle schema source;
2. generate SQL through `drizzle-kit`;
3. increment the project store schema generation;
4. include `PRAGMA user_version = <new-generation>;`;
5. update migration tests;
6. migrate development sample projects.

Do not hand-write TypeScript migration registries. Do not add compatibility
loaders for the old shape.

### Asset Origin

Use deliberate asset origins:

```text
imported
generated
elevenlabs_sample
```

File-backed custom attachments continue to create audio assets with
`origin: 'imported'`.

Generated sample attachments continue to create audio assets with
`origin: 'generated'`.

ElevenLabs provider sample attachments create audio assets with
`origin: 'elevenlabs_sample'`.

The `sampleSource` contract is the structured source of truth. `origin` remains
a compact asset-level summary.

### Validation Rules

For both attachment document kinds:

- `castMemberId` must reference an existing Cast Member.
- `name` must be a valid Cast Voice reference name.
- `name` must be unique for the Cast Member.
- `provider` must be `elevenlabs` for this slice.
- `model` must be a direct ElevenLabs TTS model:
  - `eleven_v3`
  - `eleven_multilingual_v2`
  - `eleven_turbo_v2_5`
- `model` must not be `music_v1`.
- `voiceId` must be trimmed and non-empty.
- `purpose` must be trimmed and non-empty.
- `sample.title` must be trimmed and non-empty.

For file-backed attachments:

- `sample.sourceProjectRelativePath` must be project-relative.
- the resolved file must stay inside the project folder;
- the file must exist;
- the file must be an accepted audio type by extension or MIME detection;
- if `sample.receipt` is present, receipt provider/model/voice must match the
  attachment metadata;
- `sampleSource.kind` becomes `generated_sample` when a matching generation
  receipt is present, otherwise `custom_file`.

For ElevenLabs provider-sample attachments:

- `sample.sourceProjectRelativePath` is not allowed;
- `sample.receipt` is not allowed;
- validation does not call ElevenLabs;
- attachment calls ElevenLabs to resolve `sampleId` from voice metadata and then
  retrieve that sample audio;
- attachment fails if the voice metadata has no usable sample id or the sample
  audio cannot be retrieved;
- `sampleSource.kind` becomes `elevenlabs_voice_sample`.

Unknown fields in agent-facing JSON input should remain warnings only, following
the existing import-style diagnostics rule. Unknown fields must not create
database columns, DTO fields, or fallback behavior.

### Core Command Structure

Keep command code focused. Do not grow a long mixed-purpose function.

Split Cast Voice attachment logic into focused modules:

```text
packages/core/src/server/commands/cast-voice-commands.ts
packages/core/src/server/commands/cast-voice-file-attachment.ts
packages/core/src/server/commands/cast-voice-elevenlabs-sample-attachment.ts
```

`cast-voice-commands.ts` should remain the public command surface and small
orchestrator for:

- list;
- read;
- validate;
- attach;
- remove;
- delete protection.

The file-backed and ElevenLabs-backed attachment modules should each own their
document validation and source preparation. Shared insertion should live in a
purposeful internal function with a domain name, such as:

```ts
insertCastVoiceWithSampleAsset(...)
```

That function should not be a compatibility wrapper. It should represent the
single core operation of creating the Cast Voice, sample Asset, Asset File, and
Cast Asset relationship after a source-specific validator has produced audio
bytes or an existing source file.

### Core Service Methods

Update service contracts so the existing command names accept the document
union:

```ts
validateCastVoiceAttachment(input: {
  projectName?: string;
  homeDir?: string;
  document: CastVoiceAttachmentCommandDocument;
  filePath?: string;
}): Promise<CastVoiceValidationReport>;

attachCastVoice(input: {
  projectName?: string;
  homeDir?: string;
  document: CastVoiceAttachmentCommandDocument;
  filePath?: string;
  idGenerator?: ProjectIdGenerator;
  elevenLabsVoiceSampleFetcher?: ElevenLabsVoiceSampleFetcher;
}): Promise<CastVoiceAttachmentReport>;
```

`elevenLabsVoiceSampleFetcher` is a test seam for core tests only. CLI and
Studio server use the default live engine operation. The injected test fetcher
must still return bytes shaped like a real provider retrieval. It must not add a
simulation field, simulation source kind, or any other persisted marker that
pretends simulated provider audio belongs in the project database.

### File Storage

For fetched ElevenLabs samples, allocate the destination path directly from the
Cast Voice reference name:

```text
cast/<handle>/voice-samples/<name>.mp3
```

Use the existing collision behavior:

```text
normal-voice.mp3
normal-voice-2.mp3
normal-voice-3.mp3
```

Core owns:

- creating the destination folder;
- writing bytes;
- calculating `sizeBytes`;
- calculating `contentHash`;
- creating the Asset row;
- creating the Asset File row;
- creating the Cast Asset relationship row;
- creating the Cast Voice row.

If database insertion fails after writing bytes, clean up the newly written file
before rethrowing the structured error.

### Reports

Keep the existing attachment report shape, but include source provenance in the
returned `voice`.

For provider-sample attachments, also include a concise retrieval section:

```ts
export interface CastVoiceAttachmentReport {
  valid: true;
  warnings: unknown[];
  project: {
    id?: string;
    name: string;
  };
  castMember: {
    id: string;
    handle: string;
    name: string;
  };
  voice: CastVoice;
  sampleRetrieval?: {
    provider: 'elevenlabs';
    voiceId: string;
    sampleId: string;
    mimeType: 'audio/mpeg';
    sizeBytes: number;
    fetchedAt: string;
    apiBaseUrl: string;
  };
  changes: Array<{ type: 'castVoice.attached'; castMemberId: string; voiceId: string }>;
  resourceKeys: string[];
}
```

Do not add a separate change type unless Studio resource invalidation needs it.
The durable mutation is still `castVoice.attached`.

### Structured Diagnostics

Continue using `ProjectDataError` and
`@gorenku/studio-diagnostics` at package boundaries.

Extend the Cast Voice code range from plan `0054` if needed:

```text
PROJECT_DATA340...PROJECT_DATA369 for Cast Voice validation/access/import/fetch
CLI120...CLI139 for Cast Voice command errors
```

Required failure cases:

- missing Cast Member;
- duplicate Cast Voice reference name;
- unsupported provider;
- unsupported model;
- missing voice id;
- missing purpose;
- missing sample title;
- missing sample id in the ElevenLabs voice metadata response;
- file-backed sample points outside the project;
- file-backed sample is missing;
- file-backed sample is not audio;
- file-backed receipt provider/model/voice mismatch;
- provider sample document includes `sourceProjectRelativePath`;
- provider sample document includes `receipt`;
- ElevenLabs API key is missing or invalid;
- ElevenLabs voice id or resolved sample id is invalid;
- ElevenLabs returns empty audio;
- ElevenLabs returns JSON instead of audio;
- ElevenLabs rate limit retries are exhausted;
- sample asset already belongs to another Cast Voice.

## CLI Design

### Command Surface

Keep the canonical command:

```bash
renku cast voice attach --file <cast-voice-attachment-json> --json
```

`--file` may point to either:

- `castVoiceAttachment`;
- `castVoiceElevenLabsSampleAttachment`.

Keep validation on the same command:

```bash
renku cast voice validate --file <cast-voice-attachment-json> --json
```

Do not add a separate `fetch-sample` command in this slice. The product action
is attaching a Cast Voice; fetching the provider sample is the source-specific
implementation detail selected by the document kind.

### CLI Command Structure

`packages/cli/src/commands/cast-command.ts` is already handling several command
families. Before adding more Cast Voice branching, move the Cast Voice command
family into a focused handler module:

```text
packages/cli/src/commands/cast-voice-command-handlers.ts
```

Use a small handler registry similar to the generation command handlers:

```ts
export const castVoiceCommandHandlers = [
  { path: ['list'], run: runList },
  { path: ['show'], run: runShow },
  { path: ['validate'], run: runValidate },
  { path: ['attach'], run: runAttach },
  { path: ['remove'], run: runRemove },
] satisfies CliCommandHandler<CastVoiceCommandFlags>[];
```

`runCastCommand` should delegate `cast voice ...` to the focused Cast Voice
handler. Do not add another long nested branch chain.

### CLI Output

Successful provider-sample attachment output should show the normal voice report
plus retrieval metadata:

```json
{
  "valid": true,
  "warnings": [],
  "castMember": {
    "id": "cast_urban",
    "handle": "urban",
    "name": "Urban"
  },
  "voice": {
    "name": "normal-voice",
    "provider": "elevenlabs",
    "model": "eleven_v3",
    "voiceId": "JBFqnCBsd6RMkjVDRZzb",
    "sampleSource": {
      "kind": "elevenlabs_voice_sample",
      "sampleId": "sample_01jz9br9f2m36md5s6v3q3r6n4",
      "fetchedAt": "2026-06-09T10:00:00.000Z",
      "apiBaseUrl": "https://api.elevenlabs.io"
    }
  },
  "sampleRetrieval": {
    "provider": "elevenlabs",
    "voiceId": "JBFqnCBsd6RMkjVDRZzb",
    "sampleId": "sample_01jz9br9f2m36md5s6v3q3r6n4",
    "mimeType": "audio/mpeg",
    "sizeBytes": 12345,
    "fetchedAt": "2026-06-09T10:00:00.000Z",
    "apiBaseUrl": "https://api.elevenlabs.io"
  }
}
```

Do not print raw audio bytes to stdout.

### CLI Tests

Add focused tests for:

- `cast voice validate` accepts the provider-sample document without network;
- `cast voice attach` creates a Cast Voice from the provider-sample document
  when the core fetch operation is mocked;
- `cast voice attach` still accepts the current custom file-backed document;
- unknown Cast Voice command paths still return structured CLI errors;
- Cast Voice command paths are registered in one handler registry.

## Studio Server And UI

No Studio UI change is required in this slice.

After attachment, an ElevenLabs provider sample is a normal Cast Voice sample
asset:

- it has role `voice_sample`;
- it has media kind `audio`;
- it is linked from a Cast Voice;
- it is stored under `cast/<handle>/voice-samples/`;
- it appears in the Cast Member Assets tab;
- it can be played by the existing voice sample card and Details-header audio
  preview.

If Studio already shows `CastVoice.sampleSource` in developer-facing JSON or
resource inspectors, it should render the new field by virtue of the updated
resource contract. Do not add new visible card copy just to show
`sampleId`.

## Agent And Skill Guidance

Update the Renku Studio skill guidance so agents can choose the right path:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer
```

### casting-director

Add guidance:

- use `castVoiceAttachment` when the user provides or approves a project-local
  custom audio file;
- use `castVoiceElevenLabsSampleAttachment` when the user provides an
  ElevenLabs voice id;
- keep provider voice ids and sample attachment metadata out of Cast Design
  JSON;
- always provide `name`, `provider`, `model`, `voiceId`, `purpose`, and
  `sample.title` for provider sample attachments;
- run `renku cast voice validate --file ... --json` before live attachment;
- run `renku cast voice attach --file ... --json` to retrieve and attach the
  sample;
- verify with `renku cast voice list --cast <id> --json`;
- ask for user/network approval before live provider fetches when operating in
  environments that require it.

### media-producer

Clarify that `cast.voice-sample` generation is only for generating new speech
from text. It is not required when the user wants to attach an existing
ElevenLabs provider sample.

The media producer should route existing provider sample requests back to
`casting-director` rather than creating a generation spec.

## Documentation Updates

Update accepted docs after implementation:

- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/media-generation.md`

Required doc points:

- Cast Voice samples can come from custom files, generated samples, or
  ElevenLabs provider samples.
- Existing provider sample retrieval is not media generation.
- Provider sample audio is stored under `cast/<handle>/voice-samples/`.
- `CastVoice.sampleSource` is the structured provenance contract.
- `renku cast voice attach` accepts both file-backed and ElevenLabs
  provider-sample documents.

## Implementation Slices

### Slice 1: Engine Helper

Add `fetchElevenLabsVoiceSampleAudio` to engines with the two-call
voice-metadata and sample-audio flow.

This slice should be independently testable in `packages/engines`.

### Slice 2: Core Contract And Persistence

Add the provider-sample attachment document, sample source contract, database
columns, migration, and resource mapping.

This slice should keep existing file-backed Cast Voice tests passing.

### Slice 3: Core Attachment Path

Refactor Cast Voice attachment into source-specific validators and shared
insertion. Add provider-sample attachment by calling the engine function, writing
the MP3, and inserting the Cast Voice rows.

This slice should prove:

- custom file attachment still works;
- generated sample attachment still works;
- provider sample validation does not call the network;
- provider sample attachment resolves the sample id before fetching audio;
- provider sample live errors map to structured diagnostics.

### Slice 4: CLI Hookup

Move Cast Voice CLI handling into a focused handler registry and pass
provider-sample documents through `validate` and `attach`.

This slice should keep the CLI command surface small and intentional.

### Slice 5: Docs And Skills

Update accepted docs and external skills so agents use the new path correctly.

## Completion Checklist

### Review Area

- [ ] Confirm the implementation keeps `castVoiceAttachment` for custom
      project-local audio files.
- [ ] Confirm the implementation adds
      `castVoiceElevenLabsSampleAttachment` for provider-owned ElevenLabs
      samples.
- [ ] Confirm provider sample retrieval is not routed through
      `cast.voice-sample` generation.
- [ ] Confirm no generation estimate, approval token, `media_generation_spec`,
      or `media_generation_run` is created for provider sample retrieval.
- [ ] Confirm no ElevenLabs voice browser, voice listing, or voice search is
      added.
- [ ] Confirm fal.ai and Wavespeed ElevenLabs wrapper models are not used.

### Architecture And Contracts

- [ ] Add `CastVoiceElevenLabsSampleAttachmentDocument`.
- [ ] Add `CastVoiceAttachmentCommandDocument` as the current attachment input
      union.
- [ ] Add `CastVoiceSampleSource`.
- [ ] Add `sampleSource` to `CastVoice`.
- [ ] Add `sampleRetrieval` to `CastVoiceAttachmentReport` for provider-sample
      attachments.
- [ ] Add deliberate asset origin handling for `elevenlabs_sample`.
- [ ] Keep public names domain-specific and avoid placeholder names such as
      `data`, `item`, `helper`, or `manager`.
- [ ] Avoid re-export facade files outside intentional `index.ts` public
      entrypoints.

### Engine Implementation

- [ ] Add `packages/engines/src/sdk/elevenlabs/voice-samples.ts`.
- [ ] Export `fetchElevenLabsVoiceSampleAudio` from the ElevenLabs SDK module
      and package root.
- [ ] Validate `voiceId` before network calls.
- [ ] Resolve `ELEVENLABS_API_KEY` through the same provider env loading
      behavior as other engine calls.
- [ ] Support the documented ElevenLabs API base URLs deliberately.
- [ ] Send `GET /v1/voices/{voiceId}` before fetching audio.
- [ ] Parse `samples` from the voice metadata response.
- [ ] Fail fast when the voice metadata response has no usable `sample_id`.
- [ ] Select the first usable `sample_id` in provider response order.
- [ ] Send `GET /v1/voices/{voiceId}/samples/{sampleId}/audio`.
- [ ] Send `xi-api-key` in live mode.
- [ ] Read successful responses as binary audio bytes.
- [ ] Fail fast on empty successful responses.
- [ ] Fail fast when a successful response is JSON instead of audio.
- [ ] Reuse ElevenLabs retry/error parsing for rate limits and provider errors.

### Core Persistence

- [ ] Add `sample_source_kind`, `sample_id`, `sample_fetched_at`, and
      `sample_api_base_url` to the Drizzle `cast_voice` schema.
- [ ] Generate the SQL migration through Drizzle Kit.
- [ ] Increment project store schema generation.
- [ ] Set `PRAGMA user_version` in the generated migration according to the
      accepted migration workflow.
- [ ] Migrate existing Cast Voice rows to `generated_sample` or `custom_file`
      based on the linked sample asset origin.
- [ ] Update migration tests.
- [ ] Update sample project databases after the schema change.

### Core Validation

- [ ] Validate shared Cast Voice fields for both document kinds.
- [ ] Validate file-backed sample paths remain inside the project folder.
- [ ] Validate file-backed sample files exist and are supported audio files.
- [ ] Validate file-backed generation receipts still match provider/model/voice.
- [ ] Reject `sample.sourceProjectRelativePath` in provider-sample documents.
- [ ] Reject `sample.receipt` in provider-sample documents.
- [ ] Ensure provider-sample validation does not call ElevenLabs.
- [ ] Preserve unknown-field warnings for agent-facing documents without
      letting unknown fields change the contract.

### Core Attachment

- [ ] Split source-specific attachment validation into focused modules.
- [ ] Add a shared insertion operation for Cast Voice plus sample Asset rows.
- [ ] Attach custom file samples with `sampleSource.kind: custom_file`.
- [ ] Attach generated samples with `sampleSource.kind: generated_sample`.
- [ ] Attach ElevenLabs provider samples with
      `sampleSource.kind: elevenlabs_voice_sample`.
- [ ] Store fetched provider samples under
      `cast/<handle>/voice-samples/<name>.mp3`.
- [ ] Preserve collision-safe file allocation.
- [ ] Calculate and persist `sizeBytes`.
- [ ] Calculate and persist `contentHash`.
- [ ] Clean up newly written fetched sample files when database insertion fails.
- [ ] Return `sampleRetrieval` metadata in provider-sample attachment reports.
- [ ] Keep Cast Voice deletion behavior unchanged for all sample sources.

### CLI

- [ ] Add a focused Cast Voice command handler registry.
- [ ] Delegate `renku cast voice ...` from `cast-command.ts` to that registry.
- [ ] Keep `renku cast voice validate --file ... --json`.
- [ ] Keep `renku cast voice attach --file ... --json`.
- [ ] Support both attachment document kinds in `validate`.
- [ ] Support both attachment document kinds in `attach`.
- [ ] Append Studio resource changed events after successful provider-sample
      attachment.
- [ ] Do not print or serialize raw audio bytes in CLI output.

### Tests

- [ ] Add engine unit tests for successful provider sample audio retrieval.
- [ ] Add engine unit tests for invalid voice/sample input.
- [ ] Add engine unit tests for unsupported API base URLs.
- [ ] Add engine unit tests for 401, 404/422, 429, empty response, and JSON
      response failures.
- [ ] Add engine unit tests for missing or empty voice metadata samples.
- [ ] Add core tests for provider-sample document validation without network.
- [ ] Add core tests for provider-sample attachment with an injected fake fetch
      operation.
- [ ] Add core tests proving custom file attachment still works.
- [ ] Add core tests proving generated sample receipt attachment still works.
- [ ] Add core tests for sample source persistence and resource mapping.
- [ ] Add CLI tests for provider-sample `validate`.
- [ ] Add CLI tests for provider-sample `attach` with mocked core behavior.
- [ ] Add CLI tests for file-backed `attach`.
- [ ] Add CLI architecture tests for the Cast Voice command handler registry.

### Documentation And Skills

- [ ] Update project file and asset documentation.
- [ ] Update domain vocabulary documentation.
- [ ] Update data model documentation.
- [ ] Update media generation documentation to clarify that provider sample
      retrieval is not media generation.
- [ ] Update `casting-director` skill guidance.
- [ ] Update `media-producer` skill guidance.
- [ ] Add a sample provider-sample attachment JSON document for the
      `casting-director` skill.

### Final Verification

- [ ] Run `pnpm --dir packages/engines test`.
- [ ] Run `pnpm --dir packages/core test`.
- [ ] Run `pnpm --dir packages/cli test`.
- [ ] Run root `pnpm lint`.
- [ ] Run root `pnpm check`.
- [ ] Manually verify a live or mocked provider-sample attachment writes a
      playable MP3 under `cast/<handle>/voice-samples/`.
- [ ] Manually verify `renku cast voice list --cast <id> --json` returns the
      new `sampleSource` contract.
- [ ] Manually verify a custom MP3 attachment still works after the new document
      union is introduced.

## Completion Criteria

This plan is complete when:

- agents can attach an existing ElevenLabs provider sample using only
  `voiceId` and Cast Voice metadata;
- Renku stores the fetched MP3 as a normal Cast Voice sample asset;
- custom MP3 attachment remains supported;
- generated Cast Voice sample attachment remains supported;
- provider sample retrieval uses the direct ElevenLabs provider path in
  `packages/engines`;
- core persists structured sample provenance;
- CLI exposes the workflow through the existing `cast voice validate` and
  `cast voice attach` commands;
- tests cover live-mocked, validation, persistence, and CLI paths;
- docs and skills explain when to fetch an ElevenLabs provider sample versus
  when to generate or attach a custom sample.
