# 0034 Use Transient Kling Voice IDs For Shot Video

## Status

Accepted.

Supersedes the Kling provider-registration portion of
`0033-use-explicit-kling-source-video-and-voice-registration-contracts.md`.
The source-video route decision from ADR 0033 remains accepted.

## Context

The fal.ai `fal-ai/kling-video/create-voice` endpoint returns a `voice_id` for
Kling voice control, but the reviewed provider page does not document permanent
or unbounded reuse for that ID. Kling V3/O3 route docs place `voice_id` under
element contracts and state that voice binding is supported for video elements,
not image elements.

Seedance 2.0 reference-to-video accepts audio references as per-generation
conditioning inputs. Generated scene dialogue audio can therefore be selected as
reference audio for Seedance, but the final prompt remains the source of spoken
words.

These provider docs were rechecked on June 15, 2026:

- [fal.ai Kling Create Voice](https://fal.ai/models/fal-ai/kling-video/create-voice)
- [fal.ai Kling V3 Pro Image to Video](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video)
- [fal.ai Kling O3 Pro Reference to Video](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video)
- [fal.ai Seedance 2.0 Reference to Video](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video)
- [Seedance 2.0 model card](https://arxiv.org/abs/2604.14148)

## Decision

Renku Studio keeps `CastVoiceProviderRegistration` for durable provider handles
that are documented as reusable, currently ElevenLabs TTS voice IDs with
capability `dialogue-audio-tts`.

Renku Studio does not expose Kling `fal-ai/kling-video/create-voice` as a Cast
Voice provider-registration workflow. A selected dialogue audio reference is
converted to a Kling `voice_id` inside the final `shot.video-take` run when the
selected Kling route has a valid video-backed element target. The returned
`voice_id` is injected only into the in-memory final provider payload at
`elements[].voice_id`.

Renku Studio stores short-lived transient Kling voice IDs in:

```text
.renku/cache/kling-transient-voice-ids.json
```

The cache key includes provider, create-voice model, and source audio content
fingerprint. The default TTL is
`KLING_TRANSIENT_VOICE_ID_CACHE_TTL_MS = 24 * 60 * 60 * 1000`. This TTL is a
Renku iteration cache policy, not a provider durability guarantee.

## Consequences

`renku cast voice kling-registration estimate` and
`renku cast voice kling-registration run` are not public commands.

Shot-video estimates include the internal create-voice miss-case cost in the
same approval token as the final video generation. Cache hits can avoid the
live create-voice call at run time, but estimates still include the miss-case
cost so an approval remains valid if a cache entry expires.

Kling dialogue audio binding fails fast when the selected input set has no
video-backed element target or when multiple audio references/elements make the
binding ambiguous.

Generated scene dialogue audio remains reference conditioning. Exact editorial
dialogue sync belongs to lipsync, talking-head, or composition workflows.
