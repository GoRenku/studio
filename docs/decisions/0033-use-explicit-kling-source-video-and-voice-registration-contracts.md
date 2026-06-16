# 0033 Use Explicit Kling Source-Video and Voice Registration Contracts

## Status

Accepted.

The Kling provider-registration decision in this ADR is superseded by
`0034-use-transient-kling-voice-ids-for-shot-video.md`. The source-video route
decision remains accepted.

## Context

Kling V3 and O3 expose different route contracts even when the product label
looks similar. V3 image-to-video uses `start_image_url`, optional
`end_image_url`, and optional `elements`. O3 image-to-video uses `image_url`.
O3 reference-to-video uses top-level `image_urls` plus optional `elements`.
O3 video-to-video reference/edit requires a source `video_url` and may also
accept top-level images and elements.

Kling native-audio voice control is also not the same contract as uploading an
audio reference to a video route. The fal.ai `kling-video/create-voice` endpoint
accepts a clean 5-30 second `.mp3`, `.wav`, `.mp4`, or `.mov` sample, costs
`$0.007` per run, and returns a reusable provider `voice_id`. Current Kling
guidance describes voice tone as a binding on a character element, while prompt
text carries the spoken words.

Seedance 2.0 exposes audio as one of several multimodal reference inputs. The
official model card says the open platform supports up to three audio clips as
references, but it does not describe those clips as durable provider voices,
exact dialogue tracks, or final muxed audio.

These provider docs were reviewed on June 14, 2026:

- [fal.ai Kling V3 Standard Image to Video](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/llms.txt)
- [fal.ai Kling V3 Pro Image to Video](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/llms.txt)
- [fal.ai Kling O3 Standard Reference to Video](https://fal.ai/models/fal-ai/kling-video/o3/standard/reference-to-video/llms.txt)
- [fal.ai Kling O3 Pro Reference to Video](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video/llms.txt)
- [fal.ai Kling O3 Standard Reference Video to Video](https://fal.ai/models/fal-ai/kling-video/o3/standard/video-to-video/reference/llms.txt)
- [fal.ai Kling O3 Standard Edit Video](https://fal.ai/models/fal-ai/kling-video/o3/standard/video-to-video/edit/llms.txt)
- [fal.ai Kling O3 Pro Edit Video](https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/edit/llms.txt)
- [fal.ai Kling Create Voice](https://fal.ai/models/fal-ai/kling-video/create-voice/llms.txt)
- [Kling VIDEO 3.0 Model User Guide](https://kling.ai/quickstart/klingai-video-3-model-user-guide)
- [Kling VIDEO 3.0 Omni Model User Guide](https://kling.ai/quickstart/klingai-video-3-omni-model-user-guide)
- [Seedance 2.0 model card](https://arxiv.org/abs/2604.14148)

## Decision

Renku Studio will model O3 video-to-video source media with a dedicated
`source-video-reference` input mode. That route mode is exposed only when a
selected shot-video model supports it, and provider payload construction maps it
to O3 `video_url`.

Renku Studio will store reusable provider voice handles in
`cast_voice_provider_registration`, not directly on `cast_voice`. A Cast Voice
owns the editorial voice reference, playable sample, and sample provenance.
Provider registrations own provider, registration model, external provider
voice id, capabilities, and source sample asset.

Kling voice-control registrations use provider `fal-ai`, registration model
`kling-video/create-voice`, and capability `kling-video-voice-control`.
ElevenLabs dialogue-audio registrations use provider `elevenlabs`, direct
ElevenLabs TTS models, and capability `dialogue-audio-tts`.

Seedance `audio_urls` remain per-generation reference inputs. Clean Cast Voice
samples are the default reference source. Generated dialogue audio may be used
only with explicit best-effort intent and must not be described as exact
dialogue preservation.

## Consequences

Route validation fails fast when source-video inputs, elements, or voice
registrations are selected for a model route that does not support them.

V3 voice-control pricing derives an internal `uses_voice_control` estimate
field only when native audio is enabled and a video-backed element has a Kling
voice registration. That derived field is not sent to fal.ai. O3 estimates do
not add a voice-control surcharge because the reviewed O3 pricing pages did not
publish one on June 14, 2026.

Existing ElevenLabs Cast Voice handles are migrated into
`cast_voice_provider_registration`; no compatibility alias remains on
`cast_voice`.
