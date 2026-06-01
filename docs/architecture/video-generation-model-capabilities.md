# Video Generation Model Capabilities

Date: 2026-06-01

Status: reference

## Purpose

This document records the current capability analysis for the video-generation
models Renku Studio plans to support for shot video takes.

It is deliberately separate from the active implementation plans:

- `plans/active/0038-shot-composition-location-tabs.md` specifies shot design
  tabs;
- `plans/active/0039-shot-ai-production-tab.md` specifies AI Production,
  persistence, and Studio/Core implementation;
- this document describes model capabilities and the normalized axes needed by
  future engine support.

The implementation must not hard-code UI assumptions from this document. The
engine catalog should expose normalized capability metadata, and Core should use
that metadata to filter models, validate parameters, estimate cost, and prepare
provider payloads.

## Model Families

The first supported set is:

- Seedance 2.0;
- Kling 3.0;
- Veo 3.1;
- xAI Grok Imagine Video 1.5;
- Alibaba Happy Horse;
- LTX 2.3.

The user-facing shorthand may mention "Seedream 2.0", but the video model
family is treated here as Seedance 2.0. Seedream is primarily an image model
family and should not be used as the video-take model identifier unless the
catalog provider explicitly exposes a video endpoint under that name.

## Sources

Capability details should be refreshed before implementation because provider
contracts change quickly.

Current source set:

- fal.ai Seedance 2.0 text-to-video:
  `https://fal.ai/models/bytedance/seedance-2.0/text-to-video`
- fal.ai Kling 3.0 API:
  `https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video/api`
- fal.ai Kling 3.0 prompting guide:
  `https://blog.fal.ai/kling-3-0-prompting-guide/`
- fal.ai Veo 3.1:
  `https://fal.ai/models/fal-ai/veo3.1`
- xAI Grok Imagine Video 1.5 Preview:
  `https://docs.x.ai/developers/models/grok-imagine-video-1.5-preview`
- xAI video generation modes:
  `https://docs.x.ai/developers/model-capabilities/video/generation`
- fal.ai Alibaba Happy Horse:
  `https://fal.ai/models/alibaba/happy-horse/image-to-video`
- fal.ai LTX 2.3:
  `https://fal.ai/models/fal-ai/ltx-2.3/text-to-video/api`
- LTX pricing:
  `https://docs.ltx.video/pricing`

## Normalized Capability Axes

The engine catalog should normalize every video model around these axes.

### Generation Modes

```ts
export type VideoGenerationMode =
  | 'text-to-video'
  | 'image-to-video'
  | 'first-last-frame'
  | 'reference-to-video'
  | 'multi-shot'
  | 'audio-to-video'
  | 'extend-video'
  | 'edit-video';
```

### Input Asset Support

```ts
export interface VideoModelInputSupport {
  textPrompt: boolean;
  firstFrame: boolean;
  lastFrame: boolean;
  referenceImages: {
    supported: boolean;
    min: number;
    max: number | null;
  };
  referenceAudio: boolean;
  sourceVideo: boolean;
  multiShotDefinition: boolean;
}
```

### Parameter Support

```ts
export interface VideoModelParameterSupport {
  duration:
    | { kind: 'fixed'; seconds: number[] }
    | { kind: 'range'; minSeconds: number; maxSeconds: number; stepSeconds: number };
  aspectRatios: string[];
  resolutions: string[];
  fps?: number[];
  qualityField?: {
    providerName: string;
    values: string[];
  };
  seed: boolean;
  generateAudio: boolean;
}
```

### Pricing Support

Pricing must be estimated from the concrete provider payload, not from a static
UI column.

The normalized engine metadata should identify the pricing dimensions used by
the provider:

```ts
export type VideoPricingDimension =
  | 'per-video'
  | 'per-second'
  | 'per-resolution'
  | 'per-quality'
  | 'per-audio'
  | 'provider-credit';
```

Core should ask the engine for an estimate after the user chooses intent, model,
and parameters.

## Capability Summary

This table is for architecture and engine design only. It is not the AI
Production UI table.

| Model family | Main modes | Inputs to model | Duration style | Audio | Notes for Renku |
| --- | --- | --- | --- | --- | --- |
| Seedance 2.0 | text-to-video, image-to-video, reference-to-video, edit, extend | prompt; start image; optional end image; reference images, video clips, and audio files on reference endpoint | text endpoint accepts `auto` or string seconds `4` through `15`; reference/edit endpoints need endpoint-specific checks | native audio on supported endpoints | Good candidate for reference-heavy and agent-prepared dependency workflows. Needs endpoint-level rows for text, image, reference, edit, and extend. |
| Kling 3.0 | text-to-video, image-to-video, multi-shot, first/last-frame on I2V variants, elements/references, lipsync variants | prompt or `multi_prompt`; `start_image_url`; optional `end_image_url`; `elements`; audio or voice ids on specific variants | V3 endpoints expose `3` through `15`; older Pro endpoints often expose `5` or `10` | native audio toggle on V3; voice/lipsync variants are separate contracts | Strong fit for multi-shot generation, but model catalog must distinguish V3 text, V3 image, 4K, Pro/Standard, and lipsync endpoints. |
| Veo 3.1 | text-to-video, image-to-video, first/last-frame interpolation, reference-based generation, extend-video | prompt; images on image/reference/first-last variants; source video for extend | up to 8 seconds per generation; extend mode adds shorter continuation steps | native audio toggle; pricing changes when audio is enabled | Strong candidate for high-quality first-frame, first/last, and dialogue/audio shots. Catalog must split standard/fast and mode-specific endpoints. |
| Grok Imagine Video 1.5 | text-to-video, image-to-video, reference-to-video, edit-video, extend-video | prompt; image; reference images; source video for edit/extend | API examples use explicit `duration`; options must be read from xAI model schema at implementation time | provider documentation prices output video by second/resolution; audio support must be verified per endpoint | Useful for xAI-native image/video workflows. Request modes are mutually exclusive, so catalog rows or validation must prevent mixing image and references. |
| Alibaba Happy Horse | image-to-video | required first-frame image plus prompt | integer seconds `3` through `15` | no separate audio-input contract in the current fal endpoint | Treat as specialized I2V. It can serve first-frame intent but not text-only or reference-heavy intent. |
| LTX 2.3 | text-to-video, image-to-video, audio-to-video, extend-video, retake/edit | prompt; start image; optional end image; audio URL; source video | standard T2V/I2V uses `6`, `8`, `10`; fast variants support `6` through `20` in two-second steps; extend supports float duration up to `20` | `generate_audio` on T2V/I2V; audio-to-video accepts audio input | Strong fit for fast iteration, audio-to-video, first/last, and edit/extend workflows. Catalog rows must separate Pro/Fast and text/image/audio/extend/retake endpoints. |

## Endpoint Notes

These details are implementation inputs for the engine catalog. They should be
updated from provider docs before adapter work begins.

### Seedance 2.0

Observed fal endpoint families:

- `bytedance/seedance-2.0/text-to-video`
- `bytedance/seedance-2.0/fast/text-to-video`
- `bytedance/seedance-2.0/image-to-video`
- `bytedance/seedance-2.0/fast/image-to-video`
- `bytedance/seedance-2.0/reference-to-video`
- `bytedance/seedance-2.0/fast/reference-to-video`

Text-to-video parameters currently include:

- `prompt`;
- `resolution`: `480p` or `720p`;
- `duration`: `auto`, or string seconds `4` through `15`;
- `aspect_ratio`: `auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`;
- `generate_audio`;
- `seed`;
- `end_user_id` for B2B access.

Image-to-video adds:

- `image_url` as required start frame;
- `end_image_url` as optional final frame.

Reference-to-video currently accepts multiple modalities: up to nine images,
three video clips, and three audio files. The prompt references them with
provider tokens such as `[Image1]`, `[Video1]`, and `[Audio1]`. The UI should
not expose token mapping directly; provider payload preparation should own that.

Pricing dimensions:

- resolution;
- duration seconds;
- audio inclusion;
- token-like output-size formula in fal pricing text.

### Kling 3.0

Observed fal V3 Pro text-to-video request fields include:

- `prompt` or `multi_prompt`, but not both;
- `duration`;
- `generate_audio`;
- `shot_type`: `customize` or `intelligent`;
- `aspect_ratio`: `16:9`, `9:16`, `1:1`;
- `negative_prompt`;
- `cfg_scale`.

V3 text endpoints currently expose durations `3` through `15`. Multi-shot
generation is represented by `multi_prompt`, where each prompt element has its
own prompt and duration. The catalog should model this as `multiShotDefinition`
support.

Image-to-video V3 variants add:

- `start_image_url`;
- optional `end_image_url`;
- optional `elements`, which can represent character/object examples and can be
  referenced in the prompt.

There are also lipsync-style variants with their own contracts:

- text-to-lipsync with `video_url`, text, voice id, language, and speed;
- audio-to-lipsync with `video_url` and `audio_url`.

These should not be collapsed into the same model choice as ordinary
text-to-video.

Pricing dimensions:

- endpoint family;
- duration;
- resolution/tier;
- native audio or lipsync variant where applicable.

### Veo 3.1

The fal Veo 3.1 page describes:

- text-to-video;
- image-to-video;
- first/last-frame interpolation;
- reference-based generation;
- video extension;
- standard and fast tiers;
- 720p, 1080p, and 4K;
- `16:9` and `9:16`;
- 24 FPS;
- native audio enabled or disabled per request.

The same page states that a single generation is up to eight seconds, while
extend-video can chain shorter extensions up to a much longer total output.

Pricing dimensions:

- duration seconds;
- resolution;
- audio enabled;
- standard versus fast endpoint.

### Grok Imagine Video 1.5

xAI lists `grok-imagine-video-1.5-preview` with text and image input modalities
and video output. The model card prices output video by second and shows
separate resolution pricing for 480p and 720p.

xAI video generation supports mutually exclusive request modes:

- text-to-video from `prompt`;
- image-to-video from `prompt` plus `image`;
- reference-to-video from prompt plus `reference_images`;
- edit-video through the edit endpoint and a source video;
- extend-video through the extension endpoint and a source video.

The API docs explicitly disallow mixing some modes, such as image input and
reference images in one request. Core validation must enforce that before a
provider payload is prepared.

Pricing dimensions:

- generated video seconds;
- resolution;
- input image pricing where applicable.

### Alibaba Happy Horse

The fal Happy Horse endpoint is image-to-video.

Current parameters:

- required `image_url`;
- `prompt` up to the provider limit;
- `resolution`: `720p` or `1080p`;
- integer `duration` from `3` through `15`;
- optional `seed`.

The source image is the first frame. This makes it compatible with the
`first-frame` intent, but not with `text-only`, `first-last-frame`, or
reference-heavy intents unless a future endpoint adds those inputs.

Pricing dimensions:

- duration seconds;
- resolution.

### LTX 2.3

Observed fal LTX 2.3 endpoint contracts include:

- text-to-video;
- image-to-video;
- audio-to-video;
- retake/edit;
- extend-video;
- fast variants.

Text-to-video Pro currently includes:

- `prompt`;
- `duration`: `6`, `8`, `10`;
- `resolution`: `1080p`, `1440p`, `2160p`;
- `aspect_ratio`: `16:9`, `9:16`;
- `fps`: `24`, `25`, `48`, `50`;
- `generate_audio`.

Fast text-to-video and fast image-to-video support `6`, `8`, `10`, `12`, `14`,
`16`, `18`, and `20`, with provider restrictions around longer durations,
FPS, and resolution.

Image-to-video accepts:

- `image_url`;
- optional `end_image_url`;
- prompt;
- duration;
- resolution;
- aspect ratio, including `auto`;
- fps;
- `generate_audio`.

Audio-to-video accepts:

- `audio_url`;
- optional `image_url`;
- prompt when needed;
- guidance and aspect ratio controls.

Extend-video accepts:

- `video_url`;
- optional prompt;
- float duration up to 20 seconds;
- mode `start` or `end`;
- context seconds.

Retake/edit accepts a source video plus prompt and retake controls.

Pricing dimensions:

- duration seconds;
- input audio duration for audio-to-video;
- source/context frame billing for extension;
- resolution;
- endpoint/tier.

## Engine Catalog Requirements

Each provider endpoint should be represented as a concrete model choice. Do not
collapse materially different endpoints into a single row if they accept
different inputs or parameter contracts.

For example:

- a Kling text-to-video endpoint and a Kling image-to-video endpoint should be
  separate catalog entries if they require different provider payloads;
- a Veo first/last-frame endpoint should be separate from a text-only endpoint
  when the input contract differs;
- an LTX edit or extend endpoint should be separate from a text-to-video
  endpoint when it requires source video.

Minimum catalog metadata:

```ts
export interface VideoModelCapabilityCatalogEntry {
  modelChoice: string;
  provider: 'fal-ai' | 'xai' | 'ltx' | 'other';
  providerModel: string;
  label: string;
  modes: VideoGenerationMode[];
  inputs: VideoModelInputSupport;
  parameters: VideoModelParameterSupport;
  pricingDimensions: VideoPricingDimension[];
  unavailableReason?: string;
}
```

## Intent Mapping

AI Production intents map to required model capabilities:

| Intent | Required capability |
| --- | --- |
| `text-only` | `text-to-video` and prompt input |
| `first-frame` | `image-to-video` or explicit first-frame mode |
| `first-last-frame` | first-frame and last-frame support |
| `reference` | reference image/audio support as needed by selected prepared inputs |
| `multi-shot-reference` | multi-shot definition or reference-to-video support |
| `audio-to-video` | reference audio or audio-conditioned generation support |
| `extend-or-edit` | source video plus extend or edit mode |

Core should use this mapping to disable unsupported model rows and provide a
specific status reason.

## Persistence-Relevant Fields

The AI Production draft and executable spec need these fields because they are
stable across providers:

- intent id;
- concrete model choice;
- normalized parameter values;
- provider parameter names;
- selected input assets and file ids;
- generated dependency asset ids;
- prompt for each dependency;
- final video prompt;
- estimate snapshot;
- final video asset id after import.

Provider-specific quirks belong in engine catalog metadata and provider payload
preparation, not in Studio UI components.

## Pricing Guidance

Do not show a static Cost column in the AI Production model table.

Reasons:

- many providers price by duration, resolution, quality, or audio settings;
- preview and production endpoints may differ;
- provider credit systems may not map cleanly to one number until payload time;
- discounts or provider routing may change independently of Studio UI.

The UI should show a live estimate only after intent, model, and concrete
parameters are known. The estimate should come from the engine.

## Prompting Guidance

The prompt builder should consider:

- Scene description and screenplay blocks;
- shot description;
- Composition selections;
- Camera Motion selections;
- Location selections and environment-sheet views;
- cast member context and character sheets;
- active Lookbook;
- visual-language reference sheets;
- audio notes;
- production notes.

Prompt text should be model-specific when the model requires it. For example,
multi-shot capable variants may need a structured shot sequence, while
first/last-frame models need image-preparation prompts for the dependency
frames plus a separate video-transition prompt.

Detailed model prompting guides belong in the engine or prompt-guide layer, not
inside the Studio tab component.

## Refresh Requirement

Before implementing provider adapters for this model set, refresh this document
against current provider documentation and update the catalog entries in the
same implementation branch.

Provider contracts, names, and pricing are not stable enough to rely on this
document indefinitely without verification.
