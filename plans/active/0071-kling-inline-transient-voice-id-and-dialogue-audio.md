# Kling Inline Transient Voice ID and Dialogue Audio References

## Status

Active planning.

This plan corrects the Kling voice-control direction from
`0070-kling-v3-o3-route-contracts-and-voice-binding.md`.

The core correction is:

- keep `CastVoiceProviderRegistration` for durable provider voice handles such
  as ElevenLabs, and future models that document durable provider voice IDs;
- stop treating Kling `voice_id` from `fal-ai/kling-video/create-voice` as a
  durable Cast Voice provider registration;
- make Kling `create-voice` an internal, transient preparation step inside the
  normal `shot.video-take` run when a selected dialogue audio reference needs to
  be converted into a Kling `voice_id`;
- cache those transient Kling `voice_id` values for a short, documented default
  expiration window so repeated runs against the same dialogue audio do not call
  the same provider endpoint unnecessarily;
- keep the actual spoken dialogue in the final video prompt, because Kling
  voice control appears to influence vocal tone/identity rather than enforce
  exact words or timing;
- use generated scene dialogue audio references for both Seedance and Kling
  native-audio workflows, while still treating the prompt text as the source of
  truth for spoken content.

This is not a compatibility plan. Renku Studio is pre-customer software, so the
implementation should remove the now-wrong Kling public registration surface
directly and update callers, tests, docs, and skills to the corrected contract.

## Provider Sources Reviewed

Reviewed on June 15, 2026:

- [fal.ai Kling create voice](https://fal.ai/models/fal-ai/kling-video/create-voice)
- [fal.ai Kling V3 Pro image-to-video](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video)
- [fal.ai Kling O3 Pro reference-to-video](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video)
- [fal.ai Seedance 2.0 reference-to-video](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video)
- [Seedance 2.0 model card](https://arxiv.org/abs/2604.14148)

Relevant observations:

- `fal-ai/kling-video/create-voice` is described as creating voices for Kling
  voice control and returns a `voice_id`, but the reviewed page does not state
  that this ID is durable or permanently reusable.
- The create-voice cost is small (`$0.007` per generation), but it adds
  end-to-end latency.
- Kling V3 image-to-video documents `Voice Id` under elements and says voice
  binding is supported for video elements, not image elements.
- Kling V3 voice-control pricing is still tied to native audio generation.
- Seedance reference-to-video accepts `audio_urls` as reference audio alongside
  image and video references.
- Seedance docs frame audio as multimodal reference input, not a durable
  provider voice registration.

## Current State To Correct

The `0070` implementation added useful foundations:

- V3/O3 route contracts;
- `source-video-reference`;
- Kling element and reference payload projection;
- V3 voice-control pricing;
- `CastVoiceProviderRegistration`;
- ElevenLabs scene dialogue audio reading provider registrations instead of
  direct `CastVoice.provider/model/voiceId` fields.

Those foundations should stay.

The over-modeled part is the Kling-specific provider registration path:

- `KlingVoiceRegistrationSpec`;
- `estimateKlingCastVoiceRegistration`;
- `runKlingCastVoiceRegistration`;
- `renku cast voice kling-registration estimate`;
- `renku cast voice kling-registration run`;
- storing `kling-video/create-voice` output as a durable
  `CastVoiceProviderRegistration`;
- skills that tell agents to pre-register Kling voice IDs before video
  generation.

Those should be removed or reworked so Kling voice IDs are created or reused
only as short-lived transient internal run data.

## Decision

### Keep Cast Voice Provider Registrations

`CastVoiceProviderRegistration` remains the right durable model for providers
that document reusable voice handles.

Current required use:

- ElevenLabs dialogue audio TTS:
  - provider: `elevenlabs`;
  - registration models: `eleven_v3`, `eleven_multilingual_v2`,
    `eleven_turbo_v2_5`;
  - capability: `dialogue-audio-tts`;
  - `externalVoiceId` is sent as the ElevenLabs `voice` input.

Future intended use:

- Minimax or another provider may later expose a documented durable voice ID.
  Add that provider/model deliberately when it is implemented.

Do not keep a Kling durable registration path unless provider documentation
later says Kling `voice_id` is stable enough for durable Cast Voice
registration or unbounded reuse.

### Make Kling Voice IDs Transient

For Kling V3/O3 shot-video generation:

- selected dialogue audio reference is an input to an internal create-voice
  preparation step;
- Renku sends that audio to `fal-ai/kling-video/create-voice` immediately before
  the final Kling video request;
- Renku reads the returned `voice_id`;
- Renku injects that `voice_id` into the final Kling payload where the selected
  route schema supports it;
- Renku does not create a public generation spec for this step;
- Renku does not expose a CLI command for this step;
- Renku does not store the returned `voice_id` as a
  `CastVoiceProviderRegistration`;
- Renku may record run-local diagnostic/provenance metadata that the final run
  used an internal transient voice conversion, but that metadata must not be
  presented as a reusable provider voice handle.

### Cache Transient Kling Voice IDs

Add a small project-local sidecar cache file for transient Kling create-voice
results in this slice.

This cache is not a Cast Voice provider registration. It is an internal
provider-artifact cache whose only purpose is avoiding repeated
`fal-ai/kling-video/create-voice` calls for the same selected dialogue audio
during normal iteration across Studio restarts and CLI invocations.

The cache file path is:

```text
.renku/cache/kling-transient-voice-ids.json
```

The owning implementation module must define a documented constant:

```ts
const KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
```

The default TTL is 24 hours. That window is intentionally conservative:

- it is long enough to avoid repeated create-voice latency during a same-day
  creative session;
- it is short enough that Renku is not pretending fal documents permanent Kling
  voice IDs;
- it gives future work a clear constant to revisit if fal documents durability
  or expiration behavior.

Cache rules:

- cache entries expire at `createdAt + KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS`;
- the cache key must include provider, create-voice model, and a source audio
  content fingerprint;
- include source audio file identity and project-relative path as metadata for
  debugging, but do not trust path alone for cache identity;
- read the sidecar file best-effort;
- if the sidecar file is missing, empty, corrupt, unreadable, or versioned with
  an unsupported schema, treat the lookup as a cache miss and continue;
- write the sidecar file atomically by writing a temporary file in the same
  directory and renaming it over the cache file;
- if the sidecar file cannot be written, continue the generation and report a
  structured cache warning rather than failing the final video run;
- if the source audio bytes cannot be fingerprinted, skip the cache and run
  create-voice rather than risking reuse of a stale ID;
- do not store simulated voice IDs in the sidecar cache file;
- expired entries are ignored and may be pruned opportunistically;
- cache misses simply run create-voice and write a fresh cache entry;
- cache hits inject the cached `voice_id` into the in-memory final provider
  payload exactly like a fresh create-voice result;
- cached `voice_id` values must never be exposed as durable voice identities in
  Studio, CLI, skills, or Cast Voice provider-registration APIs.

Recommended cache file shape:

```json
{
  "version": 1,
  "entries": [
    {
      "provider": "fal-ai",
      "model": "kling-video/create-voice",
      "sourceAudioFingerprint": "sha256:...",
      "sourceProjectPath": "media/dialogue/scene-001-line-001.wav",
      "voiceId": "...",
      "createdAt": "2026-06-15T10:30:00.000Z",
      "expiresAt": "2026-06-16T10:30:00.000Z"
    }
  ]
}
```

Do not add a project database table or Drizzle migration for this cache.

### Use Dialogue Audio, Not Only Cast Voice Samples

Native video audio workflows should use generated scene dialogue audio when the
user has produced and selected it.

Rules:

- the final video prompt contains the spoken words;
- selected dialogue audio is a voice/performance reference, not the source of
  exact words or timing;
- Seedance maps selected dialogue audio references to `audio_urls`;
- Kling maps selected dialogue audio references to internal create-voice
  requests, then maps the resulting transient `voice_id` into the final payload;
- Cast Voice samples can remain useful for standalone voice style or when no
  dialogue audio exists, but they should not be the default replacement for an
  available generated dialogue take.

### Respect Kling Route Limits

Kling documentation still places `voice_id` under element contracts and says
voice binding is for video-backed elements, not image elements.

Implementation must therefore:

- keep prompt text as the dialogue source on all Kling routes;
- create transient voice IDs only when a selected Kling route can actually send
  them;
- attach a transient `voice_id` only to a video-backed element supported by the
  selected route;
- fail fast with structured diagnostics when selected dialogue audio cannot be
  bound because the chosen Kling route/input set has no valid video-backed
  element target;
- avoid inventing unsupported payload shapes such as a top-level `voice_id` or
  image-set element voice binding.

If later provider docs show that V3/O3 support voice IDs outside video-backed
elements, update the route contract explicitly with source provenance and tests.

## Target Contract Changes

### Public Cast Voice Contract

Keep:

- `CastVoice`;
- `CastVoiceProviderRegistration`;
- provider registration read/list/create/remove service methods;
- CLI provider registration commands for durable handles;
- ElevenLabs attachment flow creating an ElevenLabs provider registration;
- scene dialogue audio resolving usable ElevenLabs provider registrations.

Remove from durable provider registration support in this slice:

- `KlingVoiceRegistrationSpec`;
- `KlingVoiceRegistrationEstimateReport`;
- `KlingVoiceRegistrationRunReport`;
- service methods:
  - `estimateKlingCastVoiceRegistration`;
  - `runKlingCastVoiceRegistration`;
- CLI paths:
  - `renku cast voice kling-registration estimate`;
  - `renku cast voice kling-registration run`;
- generated tests and docs that present Kling create-voice as an explicit
  Cast Voice registration workflow;
- `kling-video/create-voice` as a durable `CastVoiceProviderRegistrationModel`
  unless another active plan deliberately documents it as durable;
- `kling-video-voice-control` as a durable provider-registration capability
  unless it is needed by a documented durable provider handle.

Keep the database table and migration because the durable provider-registration
concept remains valid for ElevenLabs and future providers.

### Shot Video Generation Input Contract

Replace the current registration-oriented Kling binding with audio-reference
inputs:

- keep `ShotVideoTakeInputKind: 'audio'`;
- use scene dialogue audio takes as the primary `audio` prepared input;
- keep or rename `providerReferenceRole: 'audio-reference'` so it clearly means
  provider reference audio, not a durable provider registration;
- remove `providerVoiceRegistration` from `ShotVideoTakeGenerationInput`;
- add explicit mapping data for Kling only if required:
  - selected dialogue id;
  - target Kling `elementId`;
  - source audio asset/file id;
  - source audio project-relative path.

The implementation should not guess across ambiguous mappings. A reasonable
default is allowed only when there is exactly one selected dialogue audio input
and exactly one compatible video-backed element. Otherwise fail with a
structured diagnostic asking the agent/UI to provide the intended binding.

### Prompt Contract

Agent-authored final prompt remains mandatory.

Prompt rules:

- dialogue text is written in the final prompt;
- Seedance may reference selected dialogue audio as `@AudioN`;
- Kling may reference a video-backed element as `@ElementN`;
- Kling prompt should describe the line and tone, for example:
  `@Element1 says quietly, "We keep moving."`;
- never describe Kling `voice_id` as an exact-dialogue input;
- never ask the agent to run a separate Kling registration command.

## Run-Time Architecture

### Estimate Path

When estimating a `shot.video-take` spec:

1. Build and validate the final video provider plan as today.
2. Detect transient Kling voice conversions required by selected audio inputs.
3. Build cache keys for those conversions when source audio fingerprints are
   available.
4. Include the create-voice miss-case estimate in the approval total for each
   unique conversion, even if a fresh cache entry currently exists. The cost is
   small, and this keeps a run valid if a cache entry expires between estimate
   and execution.
5. Read `.renku/cache/kling-transient-voice-ids.json` best-effort to report
   cache hit/miss/skipped/expired state as internal estimate detail when useful.
   Do not expose a separate generation step.
6. Make the approval token cover the full estimated operation:
   - internal create-voice conversions;
   - final Kling video run.

Do not create separate user-visible media generation specs for the internal
create-voice calls.

### Run Path

`runShotVideoTakeSpec` should become the orchestration point for Kling
transient voice conversion.

Proposed flow:

1. Prepare the final spec.
2. Estimate the combined operation.
3. Validate approval against the combined estimate.
4. If the final route requires transient Kling voice conversion:
   - compute the source audio content fingerprint;
   - read `.renku/cache/kling-transient-voice-ids.json` best-effort;
   - look for a non-expired `KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS` entry;
   - use the cached `voice_id` on cache hit;
   - run `fal-ai/kling-video/create-voice` once per unique cache miss;
   - read each returned `voice_id`;
   - write fresh cache entries for live cache misses with an atomic temp-file
     rename;
   - update only the in-memory final provider payload with those voice IDs.
5. Run the final Kling video generation.
6. Record one user-facing media generation run for the final video take.
7. Include internal voice conversion metadata in run diagnostics or a bounded
   run provenance field, but do not create durable provider registration rows.

Simulated mode:

- generate deterministic simulated `voice_id` values from the source audio
  fingerprint when available, otherwise from the stable source audio file
  identity;
- still inject those IDs into the simulated final provider payload;
- do not write deterministic simulated IDs into the sidecar cache file;
- keep tests deterministic.

### Provider Payload Snapshots

The recorded run should preserve enough information for audit:

- final provider payload after transient `voice_id` injection;
- internal transient conversion summary:
  - provider/model;
  - source audio file id/path;
  - source audio content fingerprint;
  - target element id;
  - simulated/live flag;
  - cache file path;
  - cache result: hit, miss, skipped, or expired;
  - cache expiration time for live cached or freshly written entries;
  - returned voice id may be included only as run-local provider payload
    evidence, not as a reusable Cast Voice handle.

## Implementation Slices

### Slice 1: Contract Cleanup

- Remove `KlingVoiceRegistrationSpec` and Kling registration reports from
  client/server exports.
- Remove `estimateKlingCastVoiceRegistration` and
  `runKlingCastVoiceRegistration` from `ProjectDataService`.
- Remove Kling registration CLI handlers and command routing.
- Keep generic Cast Voice provider registration service and CLI commands.
- Keep ElevenLabs provider registration behavior unchanged.
- Update command architecture tests to expect no `kling-registration` command
  paths.

### Slice 2: Dialogue Audio Reference Contract

- Make selected scene dialogue audio the default prepared audio input for
  native-audio video references when the route supports audio/reference use.
- Update Seedance final spec creation so generated dialogue audio can be used as
  the normal selected audio reference, while the prompt text remains the spoken
  dialogue source.
- Remove wording and diagnostics that imply generated dialogue audio is only an
  exceptional best-effort path when the user has selected it for native video
  reference.
- Keep diagnostics that explain Seedance audio is reference conditioning, not
  exact audio preservation.
- Add or refine structured diagnostics for missing picked dialogue takes,
  multiple picked takes, missing audio files, or over-limit audio references.

### Slice 3: Kling Transient Voice Projection

- Add a projection from `ShotVideoTakeGenerationSpec` to
  `KlingTransientVoiceConversion[]`.
- Each conversion should identify:
  - source audio input;
  - source project-relative path;
  - target element id;
  - target final payload path, such as
    `['elements', elementIndex, 'voice_id']`.
- Remove `providerVoiceRegistration` usage from Kling reference bundle
  projection.
- Keep route validation that forbids voice binding on image-set elements.
- Add structured diagnostics when a dialogue audio input is selected for Kling
  but no valid video-backed element binding exists.

### Slice 4: Transient Voice ID Cache

- Add a small project-local sidecar cache file:
  `.renku/cache/kling-transient-voice-ids.json`.
- Store cache entries outside `CastVoiceProviderRegistration` and outside the
  project SQLite database.
- Define and document
  `KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000` in the owning
  Kling transient voice module.
- Do not add a Drizzle migration or project database table for this cache.
- Use a cache key based on:
  - provider;
  - create-voice model;
  - source audio content fingerprint.
- Store source audio file id/path as debugging metadata only.
- Store file entries with:
  - returned `voice_id`;
  - created timestamp;
  - expiration timestamp;
  - source audio fingerprint;
  - source project-relative path.
- Read missing, empty, corrupt, unreadable, or unsupported-version sidecar files
  as cache misses.
- Write updates atomically by writing a temporary file in `.renku/cache/` and
  renaming it over `kling-transient-voice-ids.json`.
- Continue generation with a structured cache warning when cache writes fail.
- Ignore and opportunistically prune expired entries.
- Skip cache lookup/write when the source audio bytes cannot be fingerprinted.
- Do not store deterministic simulated voice IDs.

### Slice 5: Combined Estimate and Run Orchestration

- Add combined estimate support for shot-video takes that require internal
  create-voice conversions.
- Include create-voice estimate cost in Studio and CLI approval totals even when
  a fresh cache entry may avoid the call at run time.
- Update approval-token handling so one approval covers the complete final
  operation.
- Update `runShotVideoTakeSpec` to resolve the transient voice cache and run
  internal create-voice conversions for cache misses before the final video
  request.
- Ensure final provider payload snapshots show the injected transient voice IDs.
- Ensure no `CastVoiceProviderRegistration` rows are written for Kling transient
  conversions.

### Slice 6: Documentation and Skills

- Add a new ADR superseding the Kling provider-registration part of
  `0033-use-explicit-kling-source-video-and-voice-registration-contracts.md`.
- Update existing docs that currently describe Kling registration:
  - `docs/architecture/reference/media-generation.md`;
  - `docs/architecture/video-generation-model-capabilities.md`;
  - `docs/architecture/reference/domain-vocabulary.md`;
  - `docs/cli/commands.md`.
- Keep docs that describe ElevenLabs provider registrations.
- Update Studio skill docs:
  - remove `renku cast voice kling-registration` guidance;
  - say Kling transient voice IDs are generated inside final shot-video runs;
  - say repeated Kling voice conversions reuse a short-lived 24-hour internal
    sidecar cache when the selected dialogue audio fingerprint matches;
  - say generated scene dialogue audio is the native-video reference input when
    selected;
  - keep the final prompt dialogue text as the source of spoken words.
- Update casting-director guidance:
  - Cast Design stores creative voice direction;
  - Cast Voice stores sample/provenance;
  - ElevenLabs durable provider handles live in provider registrations;
  - Kling does not require a pre-created provider registration.
- Update prompt-guide references:
  - Seedance `@AudioN` references selected dialogue audio;
  - Kling prompt text contains dialogue;
  - Kling create-voice is internal, transient, and may be served from the
    short-lived sidecar cache;
  - exact editorial audio sync still belongs to lipsync, talking-head, or
    composition workflows.

### Slice 7: Studio Surfaces

- Remove any Studio/agent-visible expectations that a Kling provider
  registration exists before final video generation.
- Keep Studio route-supported input controls.
- Ensure dialogue audio reference choices remain visible in the Dialogues tab.
- Ensure Studio estimates show the combined cost when Kling transient conversion
  is required.
- Keep desktop-only verification for Studio.

## Impact On ElevenLabs

This plan should not change the ElevenLabs generation behavior.

The implementation from `0070` intentionally moved ElevenLabs direct
provider/model/voice ID ownership out of `CastVoice` and into
`CastVoiceProviderRegistration`. That shape should remain:

- skills must know that ElevenLabs now resolves through provider registrations;
- scene dialogue audio should continue to require a usable ElevenLabs provider
  registration with `dialogue-audio-tts`;
- CLI attachment for an ElevenLabs provider voice should continue to create the
  initial provider registration;
- no Kling transient behavior should be mixed into ElevenLabs TTS.

The documentation/skill change is therefore:

- ElevenLabs: durable provider registration remains required.
- Kling: no durable registration; transient create-voice happens during final
  video generation.

## Risks And Open Questions

- Provider latency: inline create-voice adds latency to final video generation.
  The short-lived cache should avoid repeat latency for the same dialogue audio
  during normal iteration without turning Kling `voice_id` into a durable voice
  identity.
- Cache durability uncertainty: fal docs reviewed for this plan do not document
  Kling `voice_id` permanence. The 24-hour default TTL is a conservative
  product decision, not a provider guarantee.
- Cache identity: path-only cache keys are unsafe because a generated audio file
  can be replaced at the same path. Cache reuse must require a source audio
  content fingerprint.
- Approval accounting: combined estimate/approval must be explicit enough that
  users approve both the cheap create-voice miss-case call and the expensive
  final video call, even when a cache hit avoids the call at run time.
- Provider failure mode: if create-voice succeeds but final video generation
  fails, Renku should record the root run as failed and include structured
  diagnostics; it should not persist the transient voice ID as a reusable asset.
- Binding ambiguity: if multiple dialogue audio references and multiple
  video-backed elements are selected, Renku must fail fast instead of guessing.
- Route limitation: if Kling docs continue to require voice IDs on video-backed
  elements, Renku should not attach voice IDs to image-set elements or top-level
  payloads.

## Completion Checklist

### Review Area

- [ ] Confirm the current fal `kling-video/create-voice` docs still return
  `voice_id` without documenting permanence or expiration.
- [ ] Confirm the current Kling V3/O3 route docs still place `voice_id` under
  element contracts.
- [ ] Confirm current Kling docs still restrict voice binding to video-backed
  elements, or document any newly supported route shape before implementing it.
- [ ] Confirm Seedance reference-to-video still accepts `audio_urls` and
  provider labels `@AudioN`.
- [ ] Confirm the plan keeps `CastVoiceProviderRegistration` for ElevenLabs and
  future durable provider handles.
- [ ] Confirm the plan removes public Kling registration commands rather than
  preserving aliases.
- [ ] Confirm the 24-hour
  `KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS` default is documented as a Renku cache
  policy, not a fal durability guarantee.

### Architecture and Contracts

- [ ] Remove `KlingVoiceRegistrationSpec` and Kling registration reports from
  client exports.
- [ ] Remove Kling registration service inputs and methods from
  `ProjectDataService`.
- [ ] Remove public Kling registration command handlers and command routing.
- [ ] Keep generic Cast Voice provider registration read/list/create/remove
  methods.
- [ ] Keep ElevenLabs provider registration shape and `dialogue-audio-tts`
  capability.
- [ ] Remove Kling durable-registration capability/model entries unless a
  current durable provider contract justifies them.
- [ ] Remove `providerVoiceRegistration` from
  `ShotVideoTakeGenerationInput`.
- [ ] Add or clarify audio-reference input contract for selected dialogue audio.
- [ ] Add a route-aware transient Kling voice conversion projection.
- [ ] Add `.renku/cache/kling-transient-voice-ids.json` as an internal sidecar
  cache file, not a Cast Voice provider-registration shape.
- [ ] Define and document
  `KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000`.
- [ ] Confirm no project database table or Drizzle migration is added for the
  Kling transient voice ID cache.
- [ ] Ensure the cache key uses provider, create-voice model, and source audio
  content fingerprint.
- [ ] Ensure source file path/id are cache metadata only and cannot produce a
  cache hit without a content fingerprint.
- [ ] Ensure missing, empty, corrupt, unreadable, or unsupported-version sidecar
  files are treated as cache misses.
- [ ] Ensure sidecar cache writes use a same-directory temporary file and atomic
  rename.
- [ ] Ensure sidecar cache write failures produce structured warnings without
  failing the final video run.
- [ ] Add structured diagnostics for ambiguous or unsupported Kling audio to
  element binding.
- [ ] Ensure no compatibility aliases remain for removed Kling registration
  commands or types.

### Engine and Estimate Behavior

- [ ] Keep `kling-video/create-voice` catalog/pricing support for internal
  estimates and runs.
- [ ] Add combined shot-video estimate logic for transient Kling voice
  conversions.
- [ ] Include `$0.007` create-voice miss-case cost per required conversion in
  Studio and CLI approval totals.
- [ ] Surface cache hit/miss/skipped/expired state as internal estimate detail
  where the estimate report has an appropriate diagnostic/detail area.
- [ ] Keep V3 voice-control pricing when generated audio uses a transient
  `voice_id`.
- [ ] Ensure pricing payloads do not send synthetic estimate-only fields to the
  final provider.
- [ ] Ensure O3 still has no voice-control surcharge unless fal documents one.

### Core Implementation

- [ ] Build `KlingTransientVoiceConversion` from final shot-video specs.
- [ ] Deduplicate transient create-voice calls by selected source audio
  fingerprint within one final video run.
- [ ] Resolve the transient Kling voice cache before calling create-voice.
- [ ] Reuse non-expired cached `voice_id` values when fingerprints match.
- [ ] Write sidecar cache entries for live create-voice misses with `createdAt`
  and `expiresAt`.
- [ ] Ignore and opportunistically prune expired cache entries.
- [ ] Skip cache lookup/write when source audio cannot be fingerprinted.
- [ ] Generate deterministic simulated voice IDs for simulated runs.
- [ ] Ensure deterministic simulated voice IDs are not written to the sidecar
  cache file.
- [ ] Run create-voice before the final Kling video provider request in
  `runShotVideoTakeSpec`.
- [ ] Inject returned transient voice IDs into final provider payload paths.
- [ ] Record one user-facing final `MediaGenerationRun` for the video take.
- [ ] Do not insert `CastVoiceProviderRegistration` rows for Kling transient
  voice IDs.
- [ ] Preserve enough run-local provenance to debug transient voice conversion.
- [ ] Ensure create-voice failures return structured diagnostics.
- [ ] Ensure final provider payload validation happens after transient
  substitution.

### CLI and Service Surfaces

- [ ] Remove `renku cast voice kling-registration estimate`.
- [ ] Remove `renku cast voice kling-registration run`.
- [ ] Keep `renku cast voice registrations ...` for durable provider handles.
- [ ] Update CLI help and command architecture tests.
- [ ] Update CLI Cast Voice tests so Kling create-voice is not represented as a
  user-facing registration command.
- [ ] Add CLI estimate/run coverage showing a Kling shot-video take includes
  internal create-voice cost and final video cost.
- [ ] Confirm CLI failures serialize structured diagnostics for unsupported
  Kling dialogue audio binding.

### Studio UI

- [ ] Keep Studio model/input-mode controls route-sensitive.
- [ ] Keep dialogue audio reference selection in the Dialogues tab.
- [ ] Ensure Studio estimates include transient Kling create-voice cost when
  applicable.
- [ ] Ensure Studio does not require or display Kling provider registrations as
  a precondition for final video generation.
- [ ] Ensure visible copy says dialogue audio is reference/tone conditioning,
  not exact audio sync, where a warning is needed.
- [ ] Keep visual cards quiet when there is no meaningful product/domain text.
- [ ] Verify desktop behavior only.

### Documentation and ADRs

- [ ] Add an ADR superseding the Kling registration part of ADR 0033.
- [ ] Update `docs/architecture/reference/media-generation.md`.
- [ ] Update `docs/architecture/video-generation-model-capabilities.md`.
- [ ] Update `docs/architecture/reference/domain-vocabulary.md`.
- [ ] Update `docs/cli/commands.md`.
- [ ] Update `plans/active/0070-kling-v3-o3-route-contracts-and-voice-binding.md`
  with a short superseded-note for the Kling registration section, without
  pretending the old checklist is current direction.
- [ ] Document that ElevenLabs still uses durable provider registrations.
- [ ] Document that Kling create-voice is transient and internal.
- [ ] Document the Kling sidecar cache file path, TTL constant, and source
  fingerprint cache-key rule.

### Studio Skills and Prompt Guides

- [ ] Remove `renku cast voice kling-registration` instructions from
  `media-producer`.
- [ ] Update shot-video skill guidance so selected dialogue audio feeds
  Seedance `audio_urls` or Kling transient create-voice automatically.
- [ ] Update shot-video skill examples so dialogue text remains in the final
  prompt.
- [ ] Update casting-director voice docs so ElevenLabs provider registration is
  durable, while Kling does not require pre-registration.
- [ ] Update Seedance prompt references so `@AudioN` can be selected dialogue
  audio.
- [ ] Update Kling prompt references so create-voice is internal/transient,
  short-lived sidecar cache reuse may happen automatically, and `@ElementN`
  carries the dialogue action/tone text.
- [ ] Keep guidance that exact editorial audio sync belongs to lipsync,
  talking-head, or composition workflows.

### Validation and Tests

- [ ] Remove tests for public Kling registration estimate/run commands.
- [ ] Keep tests for generic provider registration CRUD and ElevenLabs usage.
- [ ] Add payload tests where Kling video-backed element voice IDs are injected
  from transient create-voice output.
- [ ] Add validation tests rejecting Kling audio binding to image-set elements.
- [ ] Add validation tests for ambiguous dialogue-audio-to-element binding.
- [ ] Add estimate tests for final Kling video plus transient create-voice cost.
- [ ] Add cache-hit run tests proving create-voice is not called for a fresh
  matching cache entry.
- [ ] Add cache-expiration tests proving expired entries are ignored and a fresh
  create-voice call is made.
- [ ] Add content-fingerprint tests proving changed audio bytes do not reuse a
  path-matching cache entry.
- [ ] Add tests proving un-fingerprintable audio skips the cache safely.
- [ ] Add corrupt/missing sidecar tests proving generation continues as a cache
  miss.
- [ ] Add cache-write-failure tests proving generation continues with a
  structured warning.
- [ ] Add run tests proving no Cast Voice Provider Registration row is created
  for Kling transient voice IDs.
- [ ] Add Seedance tests using generated dialogue audio as `audio_urls`.
- [ ] Add Studio estimate matrix cases for Kling transient create-voice cost if
  the matrix can represent selected dialogue audio inputs.
- [ ] Add CLI tests proving removed Kling registration commands are rejected as
  unknown commands.

### Final Verification

- [ ] Run `pnpm --dir packages/engines test`.
- [ ] Run `pnpm --dir packages/core test`.
- [ ] Run `pnpm --dir packages/cli test`.
- [ ] Run `pnpm --dir packages/studio test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm check`.
- [ ] Inspect representative provider payload examples for:
  - Seedance `audio_urls`;
  - Kling transient create-voice request;
  - Kling sidecar cache hit and miss cases;
  - final Kling payload with injected `elements[].voice_id`.
- [ ] Confirm no raw browser controls were added in `packages/studio`.
- [ ] Confirm no compatibility wrappers, aliases, or re-export stubs were added.
