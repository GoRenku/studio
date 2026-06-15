# Kling V3/O3 Route Contracts, Provider Voice Registration, and Seedance Audio References

## Status

Implemented.

This plan proposes how Renku Studio should model fal.ai Kling V3 and Kling O3
video generation routes. It is intentionally a contract plan before
implementation: the current shot-video route layer is too flat for Kling's
element, reference, multi-shot, video-reference, and voice-control shapes.

The goal is not to add more model strings behind the current simple
`text-only`, `first-frame`, `first-last-frame`, and `reference` switches. The
goal is to make the model family contract honest enough that agents, Studio,
CLI, estimates, and provider payloads all understand what data is actually sent
to fal.ai.

## Provider Sources Reviewed

Fal.ai pages read on June 14, 2026:

- [Kling Video v3 Image to Video Pro](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video/llms.txt)
- [Kling Video v3 Text to Video Pro](https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video/llms.txt)
- [Kling Video v3 Image to Video Standard](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/llms.txt)
- [Kling Video v3 Text to Video Standard](https://fal.ai/models/fal-ai/kling-video/v3/standard/text-to-video/llms.txt)
- [Kling O3 Reference to Video Pro](https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video/llms.txt)
- [Kling O3 Reference to Video Standard](https://fal.ai/models/fal-ai/kling-video/o3/standard/reference-to-video/llms.txt)
- [Kling O3 Image to Video Pro](https://fal.ai/models/fal-ai/kling-video/o3/pro/image-to-video/llms.txt)
- [Kling O3 Image to Video Standard](https://fal.ai/models/fal-ai/kling-video/o3/standard/image-to-video/llms.txt)
- [Kling O3 Text to Video Pro](https://fal.ai/models/fal-ai/kling-video/o3/pro/text-to-video/llms.txt)
- [Kling O3 Text to Video Standard](https://fal.ai/models/fal-ai/kling-video/o3/standard/text-to-video/llms.txt)
- [Kling O3 Reference Video to Video Pro](https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/reference/llms.txt)
- [Kling O3 Edit Video Pro](https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/edit/llms.txt)
- [Kling O3 Reference Video to Video Standard](https://fal.ai/models/fal-ai/kling-video/o3/standard/video-to-video/reference/llms.txt)
- [Kling Video Create Voice](https://fal.ai/models/fal-ai/kling-video/create-voice/llms.txt)
- [Seedance 2.0 Reference to Video](https://fal.ai/models/bytedance/seedance-2.0/reference-to-video/llms.txt)
- [Seedance 2.0 Fast Reference to Video](https://fal.ai/models/bytedance/seedance-2.0/fast/reference-to-video/llms.txt)

Official vendor pages read on June 14, 2026:

- [ByteDance Seedance 2.0](https://seed.bytedance.com/en/seedance2_0)
- [Seedance 2.0 model card](https://arxiv.org/abs/2604.14148)
- [Kling VIDEO 3.0 User Guide](https://kling.ai/quickstart/klingai-video-3-model-user-guide)
- [Kling VIDEO 3.0 Omni User Guide](https://kling.ai/quickstart/klingai-video-3-omni-model-user-guide)
- [Kling Element Library 3.0 User Guide](https://kling.ai/quickstart/klingai-element-library-3-user-guide)
- [Kling Lip Sync Guide](https://kling.ai/quickstart/ai-lip-sync-guide)

Current local code checked:

- `packages/engines/catalog/models/fal-ai/fal-ai.yaml`
- `packages/engines/src/shot-video/shot-video-model-families.ts`
- `packages/engines/src/generation/estimates.ts`
- `packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`
- `packages/core/src/client/shot-video-take-generation.ts`
- `packages/core/src/client/cast-voices.ts`
- `packages/core/src/server/schema/cast-voices.ts`
- `packages/core/src/server/commands/cast-voice-commands.ts`
- `packages/core/src/server/media-generation/scene-dialogue-audio.ts`
- `packages/engines/src/sdk/elevenlabs/adapter.ts`

Studio skill files to update in the implementation slice:

- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/cast-voice-attachments.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/voice-casting.md`
- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/references/seedance-2-0.md`
- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/references/kling-3.md`
- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-write-prompts/references/model-prompt-selection.md`
- `/Users/keremk/Projects/aitinkerbox/skills/skills/renku-update-prompt-guides/references/prompt-guidance-sites.md`

## Current Renku Gap

Renku currently exposes one Kling shot-video model choice:

```ts
'fal-ai/kling-video/v3/pro'
```

That choice maps only to:

- `kling-video/v3/pro/text-to-video`
- `kling-video/v3/pro/image-to-video`

It supports basic text, first-frame, and first-last-frame routes. That is enough
for simple clips, but it loses the main distinctions in the current fal.ai
Kling surface:

- V3 has `standard` and `pro` levels.
- O3 has `standard` and `pro` levels.
- V3 and O3 do not use the same image-to-video field names.
- V3 image-to-video supports custom `elements`; O3 image-to-video does not.
- O3 reference-to-video has top-level `image_urls` and grouped `elements`.
- O3 video-to-video reference/edit are separate contracts with required
  `video_url`.
- Kling voice control is not an audio-reference upload to the video route. It is
  a separate `kling-video/create-voice` run that produces a `voice_id`, and that
  `voice_id` is later bound to a video-backed element.
- V3 publishes a distinct voice-control price when native audio is enabled.
- The current estimate function can price audio on/off, but not V3 voice
  control.
- The current shot-video final provider payload builder maps flat route input
  slots into flat `GenerationInputFile` fields. Kling needs nested element
  objects, ordered top-level references, and generated prompt labels.

## Provider Contract Analysis

### Kling V3

V3 is a generation family with text-to-video and image-to-video endpoints. It is
not the same as O3. It has `standard` and `pro` levels.

V3 text-to-video:

- exact models:
  - `kling-video/v3/standard/text-to-video`
  - `kling-video/v3/pro/text-to-video`
- inputs:
  - `prompt` or `multi_prompt`, but not both;
  - `duration` as string seconds `"3"` through `"15"`;
  - `generate_audio`, default `true`;
  - `shot_type`, default `"customize"`, options `"customize"` or
    `"intelligent"`;
  - `aspect_ratio`, default `"16:9"`, options `"16:9"`, `"9:16"`, `"1:1"`;
  - `negative_prompt`, default `"blur, distort, and low quality"`;
  - `cfg_scale`, default `0.5`, range `0` to `1`.
- no start frame;
- no top-level `image_urls`;
- no element references on the text endpoint.

V3 image-to-video:

- exact models:
  - `kling-video/v3/standard/image-to-video`
  - `kling-video/v3/pro/image-to-video`
- inputs:
  - `prompt` or `multi_prompt`, but not both;
  - required `start_image_url`;
  - optional `end_image_url`;
  - `duration` as string seconds `"3"` through `"15"`;
  - `generate_audio`, default `true`;
  - optional `elements`;
  - `shot_type`, `negative_prompt`, `cfg_scale`.
- no `aspect_ratio`; fal says aspect ratio is determined by the start image.
- `elements` can be image-set elements or video elements:
  - image-set element: `frontal_image_url` plus optional
    `reference_image_urls`;
  - video element: `video_url`;
  - `voice_id` is allowed only for a video element.
- fal schema says a request can only have one video element.

V3 price levels:

| Level | Audio off | Audio on | Audio on with voice control |
| --- | ---: | ---: | ---: |
| Standard | `$0.084/sec` | `$0.126/sec` | `$0.154/sec` |
| Pro | `$0.112/sec` | `$0.168/sec` | `$0.196/sec` |

### Kling O3

O3, described by fal as Kling O3 and O3 Omni on video-to-video pages, is a
separate family with text-to-video, image-to-video, reference-to-video, and
video-to-video contracts. It also has `standard` and `pro` levels.

O3 text-to-video:

- exact models:
  - `kling-video/o3/standard/text-to-video`
  - `kling-video/o3/pro/text-to-video`
- inputs:
  - `prompt` unless `multi_prompt` is provided;
  - `duration` as string seconds `"3"` through `"15"`;
  - `aspect_ratio`, default `"16:9"`, options `"16:9"`, `"9:16"`, `"1:1"`;
  - `generate_audio`, default `false`;
  - optional `multi_prompt`;
  - `shot_type`, default `"customize"`.
- no `negative_prompt`;
- no `cfg_scale`;
- no elements.

O3 image-to-video:

- exact models:
  - `kling-video/o3/standard/image-to-video`
  - `kling-video/o3/pro/image-to-video`
- inputs:
  - `prompt` or `multi_prompt`, but not both;
  - required `image_url`;
  - optional `end_image_url`;
  - `duration` as string seconds `"3"` through `"15"`;
  - `generate_audio`, default `false`;
  - `shot_type`, default `"customize"`.
- note the first-frame field is `image_url`, not V3's `start_image_url`.
- no `elements`;
- no top-level `image_urls`.

O3 reference-to-video:

- exact models:
  - `kling-video/o3/standard/reference-to-video`
  - `kling-video/o3/pro/reference-to-video`
- inputs:
  - `prompt` or `multi_prompt`, but not both;
  - optional `start_image_url`;
  - optional `end_image_url`;
  - optional top-level `image_urls`, referenced in prompt as `@Image1`,
    `@Image2`, and so on;
  - optional `elements`, referenced in prompt as `@Element1`, `@Element2`,
    and so on;
  - `generate_audio`, default `false`;
  - `duration` as string seconds `"3"` through `"15"`;
  - `shot_type`, default `"customize"`;
  - `aspect_ratio`, default `"16:9"`, options `"16:9"`, `"9:16"`, `"1:1"`.
- image-set elements use `frontal_image_url` and optional
  `reference_image_urls`;
- video elements use `video_url`;
- `voice_id` is present in the schema on combo elements and is documented as
  usable only with video elements;
- fal text says top-level reference images are for style/appearance and are
  referenced as `@ImageN`;
- fal text says there is a maximum of 4 total `elements + reference images`
  when using video.

O3 video-to-video reference:

- exact models:
  - `kling-video/o3/standard/video-to-video/reference`
  - `kling-video/o3/pro/video-to-video/reference`
- inputs:
  - required `prompt`;
  - required `video_url`, referenced as `@Video1`;
  - optional `image_urls`, referenced as `@ImageN`;
  - optional `elements`, referenced as `@ElementN`;
  - `keep_audio`, default `true`;
  - `shot_type`, default `"customize"`;
  - `aspect_ratio`, default `"auto"`, options `"auto"`, `"16:9"`,
    `"9:16"`, `"1:1"`;
  - optional `duration` as string seconds `"3"` through `"15"`.
- source video constraints from fal:
  - `.mp4` or `.mov`;
  - 3 to 10 seconds;
  - 720 to 2160 pixels;
  - max 200 MB.

O3 video-to-video edit:

- exact models:
  - `kling-video/o3/standard/video-to-video/edit`
  - `kling-video/o3/pro/video-to-video/edit`
- inputs:
  - required `prompt`;
  - required `video_url`, referenced as `@Video1`;
  - optional `image_urls`;
  - optional `elements`;
  - `keep_audio`, default `true`;
  - `shot_type`, default `"customize"`.
- no `duration` field in the fal llms text for edit, so the first
  implementation should not surface a duration control for edit until the local
  schema is re-checked.

O3 price levels:

| Route group | Level | Price |
| --- | --- | ---: |
| text/image/reference, audio off | Standard | `$0.084/sec` |
| text/image/reference, audio on | Standard | `$0.112/sec` |
| text/image/reference, audio off | Pro | `$0.112/sec` |
| text/image/reference, audio on | Pro | `$0.14/sec` |
| video-to-video reference/edit | Standard | `$0.126/sec` |
| video-to-video reference/edit | Pro | `$0.168/sec` |

The O3 reference schema includes `voice_id` on elements, but the reviewed O3
pricing pages do not publish a separate voice-control surcharge. Until fal
publishes otherwise, O3 estimates should not add a voice-control surcharge.

### Kling Voice Creation

`kling-video/create-voice` is a separate JSON-producing model:

- exact model: `kling-video/create-voice`;
- input: `voice_url`;
- accepted source media:
  - `.mp3`;
  - `.wav`;
  - `.mp4`;
  - `.mov`;
- source duration: 5 to 30 seconds;
- source content: clean, single-voice audio;
- output: `voice_id`;
- price: `$0.007` per run.

This is not the same as passing a dialogue audio reference to a video model.
The voice sample creates a provider-side Kling voice ID. Kling then uses that
voice ID to synthesize spoken text inside a native-audio video generation.

Official Kling guidance matches this interpretation. Kling's 3.0 and Omni
guides describe voice as a reusable subject/element voice tone. The element
voice is created from a recorded or uploaded voice/video sample, then the spoken
words are written in the video prompt with `@ElementN` references. The separate
Kling Lip Sync workflow is the route that consumes an actual voiceover or
singing track for synchronization. V3/O3 native voice control should therefore
receive a voice sample registration, not generated dialogue audio.

### Seedance Audio References

Seedance reference-to-video exposes `audio_urls`, but this is a different
contract from Kling voice creation:

- exact models:
  - `bytedance/seedance-2.0/reference-to-video`;
  - `bytedance/seedance-2.0/fast/reference-to-video`;
- input: `audio_urls`;
- provider labels: `@Audio1`, `@Audio2`, `@Audio3`;
- accepted source media: MP3 or WAV;
- maximum count: 3 files;
- combined duration: no more than 15 seconds;
- each file: no more than 15 MB;
- fal requires at least one reference image or video when audio is provided.

Fal describes `audio_urls` as reference audio that guides video generation.
ByteDance's official Seedance 2.0 page and model card also describe audio as a
multimodal reference input. They do not describe `audio_urls` as a durable voice
registration, provider voice ID, exact dialogue track, or muxed final audio.

Renku should therefore treat Seedance audio as per-generation reference media:

- default Seedance native-audio path:
  - pass a short, clean cast voice sample as `audio_urls`;
  - write the actual dialogue in the prompt;
  - tell the prompt drafter to reference the sample as `@Audio1` for voice
    style/tone.
- exact-dialogue path:
  - generate dialogue audio through the scene dialogue audio pipeline;
  - preserve or sync that audio in a route that explicitly consumes final
    dialogue audio, such as lipsync, talking-head, or composition;
  - do not rely on Seedance to preserve exact words, timing, waveform, or
    performance from `audio_urls`.
- advanced experimental path:
  - allow generated dialogue audio as a Seedance reference only with an explicit
    "best effort" warning;
  - continue to keep the prompt dialogue as the source of truth.

## Proposed Renku Contracts

### Model Choices

Replace the single Kling model choice with explicit level and family choices:

```ts
export type ShotVideoTakeModelChoice =
  | 'fal-ai/bytedance/seedance-2.0'
  | 'fal-ai/kling-video/v3/standard'
  | 'fal-ai/kling-video/v3/pro'
  | 'fal-ai/kling-video/o3/standard'
  | 'fal-ai/kling-video/o3/pro'
  | 'fal-ai/veo3.1'
  | 'fal-ai/xai/grok-imagine-video-1.5'
  | 'fal-ai/ltx-3.2'
  | 'fal-ai/alibaba/happy-horse';
```

Do not keep the old Kling choice as an alias. The current value
`fal-ai/kling-video/v3/pro` remains as the real Pro V3 choice, so no alias is
needed.

### Route Kinds

The current `ShotVideoTakeInputModeId` names can continue for the first
implementation, but the route metadata must become more expressive:

- `text-only`: no provider media inputs.
- `first-frame`: one required first-frame input.
- `first-last-frame`: required first and last frame inputs.
- `reference`: model-specific reference bundle.

For O3 video-to-video, add a new input mode only when the UI/CLI is ready to
support source video selection:

```ts
export type ShotVideoTakeInputModeId =
  | 'text-only'
  | 'first-frame'
  | 'first-last-frame'
  | 'reference'
  | 'source-video-reference'
  | 'source-video-edit';
```

Those names deliberately describe workflow intent. They are not generic
provider terms.

### Route Feature Flags

Add route metadata that describes payload capabilities instead of forcing every
Kling route into flat `providerField` slots:

```ts
export interface ShotVideoRouteReferenceContract {
  topLevelImages?: {
    providerField: 'image_urls';
    promptTokenPrefix: '@Image';
    maxCount?: number;
  };
  elements?: {
    providerField: 'elements';
    promptTokenPrefix: '@Element';
    supportsImageSet: boolean;
    supportsVideo: boolean;
    supportsVoiceId: boolean;
    maxVideoElementCount?: number;
    maxTotalWhenVideoPresent?: number;
  };
  sourceVideo?: {
    providerField: 'video_url';
    promptToken: '@Video1';
    mode: 'reference' | 'edit';
  };
}
```

This keeps the provider shape explicit and avoids hiding Kling-specific
behavior inside loosely named fields.

### Provider Payload Shapes

Create provider payload builders that branch by route family, not by model
string substring:

- `buildSeedanceShotVideoPayload`
- `buildKlingV3ShotVideoPayload`
- `buildKlingO3ShotVideoPayload`
- existing generic mapping can remain for routes that are genuinely flat.

The Kling builders should be small and data-driven from route metadata.

Seedance reference-to-video native-audio payload example:

```json
{
  "prompt": "@Image1 defines the character look. Use @Audio1 as a voice style reference. The character says, \"I never thought we would make it this far.\"",
  "image_urls": [
    "renku-input://generated/cast/lead-reference.png"
  ],
  "audio_urls": [
    "renku-input://generated/cast/lead-clean-voice-sample.mp3"
  ],
  "duration": "8",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "generate_audio": true
}
```

Generated dialogue audio can use the same `audio_urls` field only when the
request explicitly opts into best-effort reference behavior. It must not be
used as the default payload for exact dialogue delivery.

V3 image-to-video payload example:

```json
{
  "prompt": "@Element1 enters from the left and speaks softly.",
  "start_image_url": "renku-input://generated/images/start.png",
  "end_image_url": "renku-input://generated/images/end.png",
  "duration": "8",
  "generate_audio": true,
  "elements": [
    {
      "video_url": "renku-input://generated/video/actor-reference.mp4",
      "voice_id": "829877809978941442"
    }
  ],
  "shot_type": "customize",
  "negative_prompt": "blur, distort, and low quality",
  "cfg_scale": 0.5
}
```

O3 reference-to-video payload example:

```json
{
  "prompt": "@Element1 crosses the garden while @Image1 defines the warm evening style.",
  "start_image_url": "renku-input://generated/images/start.png",
  "image_urls": [
    "renku-input://generated/images/lookbook-style.png"
  ],
  "elements": [
    {
      "frontal_image_url": "renku-input://generated/cast/urban-front.png",
      "reference_image_urls": [
        "renku-input://generated/cast/urban-side.png"
      ]
    }
  ],
  "duration": "8",
  "generate_audio": false,
  "shot_type": "customize",
  "aspect_ratio": "16:9"
}
```

O3 video-to-video reference payload example:

```json
{
  "prompt": "Preserve the camera rhythm from @Video1 and replace the lead with @Element1.",
  "video_url": "renku-input://generated/video/source-motion.mp4",
  "elements": [
    {
      "frontal_image_url": "renku-input://generated/cast/urban-front.png",
      "reference_image_urls": [
        "renku-input://generated/cast/urban-side.png"
      ]
    }
  ],
  "keep_audio": false,
  "shot_type": "customize",
  "aspect_ratio": "auto",
  "duration": "5"
}
```

### Reference Data Projection

Add an intermediate projection object before provider payload construction:

```ts
export interface KlingReferenceBundle {
  topLevelImages: KlingTopLevelImageReference[];
  elements: KlingElementReference[];
  sourceVideo?: KlingSourceVideoReference;
}

export interface KlingTopLevelImageReference {
  inputId: string;
  projectRelativePath: ProjectRelativePath;
  promptToken: `@Image${number}`;
}

export type KlingElementReference =
  | KlingImageSetElementReference
  | KlingVideoElementReference;

export interface KlingImageSetElementReference {
  elementId: string;
  promptToken: `@Element${number}`;
  frontalImage: KlingReferenceFile;
  referenceImages: KlingReferenceFile[];
}

export interface KlingVideoElementReference {
  elementId: string;
  promptToken: `@Element${number}`;
  video: KlingReferenceFile;
  voiceRegistrationId?: string;
  providerVoiceId?: string;
}

export interface KlingSourceVideoReference {
  inputId: string;
  projectRelativePath: ProjectRelativePath;
  promptToken: '@Video1';
}
```

Projection rules:

- ordering determines provider labels;
- stable sort should use explicit user/agent selection order first, then
  persisted input creation order;
- top-level `image_urls` are for style/appearance or broad scene references;
- `elements` are for characters, objects, or identity-bearing subjects;
- V3 image-to-video may use `elements` but not top-level `image_urls`;
- O3 reference-to-video may use both top-level `image_urls` and `elements`;
- O3 image-to-video does not use `elements`;
- O3 video-to-video uses a required `sourceVideo`;
- do not infer element roles from filenames or asset IDs;
- prompt drafts must use the generated `@ImageN`, `@ElementN`, and `@Video1`
  labels exactly when those provider payload fields are populated.

### Provider Voice Registration

Renku already has `CastVoice`, and ElevenLabs already stores a reusable
provider voice ID there. The current implementation is too narrow, though:

- `CastVoice` mixes the editorial cast-member voice with one provider-specific
  handle;
- attachment validation only accepts ElevenLabs providers and TTS models;
- scene dialogue generation resolves a local `castVoiceId`, then sends
  `CastVoice.voiceId` as the ElevenLabs provider `voice` input;
- each dialogue audio take snapshots the provider voice ID used for the run.

That proves the current user-facing concept is right: a cast member should have
a reusable voice identity. It also shows why Kling should not be bolted onto
`CastVoice.voiceId` as another special case. A cast member voice may need
multiple provider registrations: one ElevenLabs voice for standalone dialogue
audio and one Kling voice for native video voice control.

Split the contract into two explicit layers:

```ts
export interface CastVoice {
  id: string;
  castMemberId: string;
  name: string;
  purpose: string;
  sample: Asset;
  sampleSource: CastVoiceSampleSource;
}

export interface CastVoiceProviderRegistration {
  id: string;
  castVoiceId: string;
  provider: 'elevenlabs' | 'fal-ai';
  registrationModel:
    | 'eleven_v3'
    | 'eleven_multilingual_v2'
    | 'eleven_turbo_v2_5'
    | 'kling-video/create-voice';
  externalVoiceId: string;
  capabilities: CastVoiceProviderCapability[];
  sourceSampleAssetId: string;
  createdAt: string;
  updatedAt: string;
}

export type CastVoiceProviderCapability =
  | 'dialogue-audio-tts'
  | 'kling-video-voice-control';
```

`CastVoiceProviderRegistration.externalVoiceId` is the common field for:

- ElevenLabs `voiceId`, sent as provider payload field `voice`;
- Kling `voice_id`, sent as `elements[].voice_id`;
- future provider voice handles with similar reusable semantics.

This is a direct schema/model update, not a compatibility layer. When
implemented, update current ElevenLabs callers to read the provider registration
directly and remove the old direct `CastVoice.provider/model/voiceId` ownership.

Add a dedicated generation path for registering a Kling voice:

```ts
export interface KlingVoiceRegistrationSpec {
  purpose: 'klingVoiceRegistration';
  castVoiceName: string;
  castMemberId: string;
  sourceCastVoiceId?: string;
  sourceProjectRelativePath: ProjectRelativePath;
}
```

The implementation can use the existing shared generation infrastructure
because `kling-video/create-voice` is already cataloged as a JSON model, but the
user-facing command/service should be named around the domain action:

- `registerKlingCastVoice`
- `estimateKlingCastVoiceRegistration`
- `runKlingCastVoiceRegistration`

Validation:

- source file must be audio or video accepted by fal;
- known source duration must be 5 to 30 seconds;
- if duration is unknown, fail with a structured diagnostic that asks for a
  file with readable media metadata;
- the sample must be a single clean voice; this cannot be proven locally, so
  present it as a preflight warning and let fal enforce it at run time;
- do not send a dialogue audio artifact directly to a Kling video route;
- only attach `voice_id` to a `KlingVideoElementReference`;
- fail fast if an image-set element has a selected Kling voice.

Registration selection rules:

- scene dialogue audio requires a registration with
  `capabilities: ['dialogue-audio-tts']`;
- Kling V3/O3 video voice control requires a registration with
  `capabilities: ['kling-video-voice-control']`;
- do not pick an arbitrary provider registration because it shares the same
  cast member;
- fail fast when a selected cast voice lacks the required provider capability.

Prompt rule for dialogue:

- The video prompt carries the spoken text.
- The Kling `voice_id` carries vocal identity.
- If the user needs separately reviewable dialogue audio, use the existing
  scene dialogue audio pipeline and a lipsync/talking-head route, not V3/O3
  native audio voice binding.

### Agent Prompt Semantics

The implementation must update both Studio-facing skills and model prompt
guides so agents know how to write prompts for the actual provider contracts.
Core validation can catch invalid payloads, but the skills must prevent bad
specs before they reach validation.

Seedance prompt rules for agent skills:

- use `@ImageN`, `@VideoN`, and `@AudioN` labels only when the corresponding
  provider fields are populated;
- treat `@AudioN` as a voice/style/performance reference, not a final dialogue
  audio track;
- write spoken dialogue directly in the video prompt when using native audio;
- default to a short clean cast voice sample for `audio_urls`;
- require explicit best-effort wording before using generated dialogue audio as
  an `@AudioN` reference;
- if exact generated dialogue must be preserved, route the work to
  scene-dialogue-audio plus lipsync/talking-head/composition instead of
  Seedance native audio.

Kling prompt rules for agent skills:

- use `@ElementN` only for elements that are actually projected into
  `elements[]`;
- use `@ImageN` only for O3 top-level `image_urls`;
- use `@Video1` only for O3 video-to-video source video routes;
- write spoken dialogue in the prompt as part of the referenced element action,
  for example `@Element1 says, "..."`;
- treat provider `voice_id` as voice identity/tone binding, not uploaded
  dialogue audio;
- select a Kling provider voice registration only for video-backed elements;
- never attach voice control to image-set elements.

Skill files under `/Users/keremk/Projects/aitinkerbox/studio-skills/skills`
must be updated in the same implementation slice as the core contract changes.
The `media-producer` shot-video instructions should explain how to read the
reference map returned by preflight/model context and how to use provider labels
in final prompt drafts. The `casting-director` voice references should describe
provider registrations as reusable voice handles and distinguish ElevenLabs TTS
registrations from Kling video voice-control registrations.

## Pricing Proposal

### Catalog Shape

Keep simple per-second routes on existing pricing functions where possible.
Add one new pricing function for V3 voice control:

```ts
function: costByVideoDurationAndAudioVoiceControl
inputs: [duration, generate_audio, uses_voice_control]
prices:
  - generate_audio: false
    uses_voice_control: false
    pricePerSecond: ...
  - generate_audio: true
    uses_voice_control: false
    pricePerSecond: ...
  - generate_audio: true
    uses_voice_control: true
    pricePerSecond: ...
```

`uses_voice_control` should be a derived pricing field. The provider payload
does not need to send it to fal. The pricing payload should set it to `true`
when all of these are true:

- the route is Kling V3;
- `generate_audio` is true;
- at least one element has a `voice_id`.

If `generate_audio` is false, any selected voice binding should be rejected
before pricing because fal says voice control is used while generating audio.

### Price Checks

Add focused estimate tests for the examples published by fal:

| Model | Payload | Expected estimate |
| --- | --- | ---: |
| V3 Standard T2V/I2V | `duration: "5"`, `generate_audio: false` | `$0.42` |
| V3 Standard T2V/I2V | `duration: "5"`, `generate_audio: true`, no voice | `$0.63` |
| V3 Standard T2V/I2V | `duration: "5"`, `generate_audio: true`, `uses_voice_control: true` | `$0.77` |
| V3 Pro T2V/I2V | `duration: "5"`, `generate_audio: false` | `$0.56` |
| V3 Pro T2V/I2V | `duration: "5"`, `generate_audio: true`, no voice | `$0.84` |
| V3 Pro T2V/I2V | `duration: "5"`, `generate_audio: true`, `uses_voice_control: true` | `$0.98` |
| O3 Standard T2V/I2V/RTV | `duration: "5"`, `generate_audio: false` | `$0.42` |
| O3 Standard T2V/I2V/RTV | `duration: "5"`, `generate_audio: true` | `$0.56` |
| O3 Pro T2V/I2V/RTV | `duration: "5"`, `generate_audio: false` | `$0.56` |
| O3 Pro T2V/I2V/RTV | `duration: "5"`, `generate_audio: true` | `$0.70` |
| O3 Standard V2V reference/edit | `duration: "5"` | `$0.63` |
| O3 Pro V2V reference/edit | `duration: "5"` | `$0.84` |
| Kling create voice | one run | `$0.007` |

Also add one negative estimate test:

- V3 payload with `uses_voice_control: true` and `generate_audio: false` must
  fail validation before estimate/run, not silently price as audio off.

### Defaults

Route normalization must materialize provider defaults into the pricing payload:

- V3 `generate_audio` default is `true`;
- O3 `generate_audio` default is `false`;
- V3/O3 `duration` default is `"5"`;
- V3/O3 `shot_type` default is `"customize"`;
- V3 text `aspect_ratio` default is `"16:9"`;
- O3 text/reference `aspect_ratio` default is `"16:9"`;
- O3 video-to-video reference `aspect_ratio` default is `"auto"`;
- V3 `cfg_scale` default is `0.5`;
- V3 `negative_prompt` default is `"blur, distort, and low quality"`.

Estimates should not depend on fal filling defaults after submission.

## Implementation Slices

### Slice 1: Engine Catalog and Estimate Accuracy

- Add V3 Standard and O3 Standard/Pro model choices in engine and core client
  types.
- Keep `fal-ai/kling-video/v3/pro` as the existing real choice.
- Add O3 route rows for text, image, reference, and later video-to-video.
- Add the V3 voice-control pricing function.
- Add estimate tests for all published five-second examples.
- Confirm `kling-video/create-voice` estimates `$0.007`.

### Slice 2: Route Contracts and Provider Payload Projection

- Add `ShotVideoRouteReferenceContract`.
- Add `KlingReferenceBundle` projection.
- Add `buildKlingV3ShotVideoPayload`.
- Add `buildKlingO3ShotVideoPayload`.
- Keep generic flat slot mapping only for families that remain flat.
- Add validation for prompt/multi-prompt exclusivity.
- Add validation for unsupported route inputs per exact model route.
- Add validation for video element count and voice binding rules.

### Slice 3: Kling Voice Registration

- Add `KlingVoiceRegistrationSpec`.
- Add service methods for estimate/run/register.
- Add `CastVoiceProviderRegistration` storage and move existing ElevenLabs
  provider voice IDs behind that registration contract.
- Store successful Kling `voice_id` as a provider registration with provider
  `fal-ai`, registration model `kling-video/create-voice`, and capability
  `kling-video-voice-control`.
- Connect selected voice registrations to Kling video elements only when the
  element is video-backed.
- Add CLI surface for registering a Kling cast voice from an existing project
  media file.
- Add Studio follow-up only after service and CLI contracts are stable.

### Slice 4: Shot Video UI and Agent Surfaces

- Update Studio model list to show V3 Standard, V3 Pro, O3 Standard, and O3 Pro
  as separate model choices.
- Add route-sensitive reference selection:
  - V3 I2V: first frame plus optional elements;
  - O3 RTV: optional start/end, top-level images, and elements;
  - O3 V2V: source video plus optional top-level images and elements.
- Show generated provider labels (`@Image1`, `@Element1`, `@Video1`) in the
  prompt drafting context, not as decorative card text.
- Do not expose raw filenames on visual cards unless they are meaningful user
  labels.
- Keep controls on local shadcn-style primitives only.

### Slice 5: Prompting and Agent Guidance

- Update shot-video prompt drafting to receive a structured reference map.
- Teach the prompt drafter:
  - V3 image prompts describe motion from the start image;
  - V3/O3 `multi_prompt` must be structured shot prompts, not a long paragraph
    pretending to be structured data;
  - O3 reference prompts must use `@ImageN` and `@ElementN` only for references
    actually present in the payload;
  - Kling native dialogue uses text in the prompt plus optional voice ID
    binding, not uploaded dialogue audio;
  - Seedance reference audio uses short cast voice samples by default, while
    actual dialogue text remains in the prompt;
  - generated dialogue audio may be sent to Seedance only as an explicit
    best-effort reference, never as an exact-dialogue guarantee.
- Update `docs/architecture/video-generation-model-capabilities.md` once the
  implementation lands.

### Slice 6: Studio Skills and Prompt Guide Updates

Update the agent-facing skill package in
`/Users/keremk/Projects/aitinkerbox/studio-skills/skills` so future Studio
agents choose the right prompt shape without rediscovering provider semantics.

Update `media-producer`:

- `media-producer/SKILL.md` should point shot-video work at the refreshed
  reference-token guidance;
- `media-producer/references/shot-video-take.md` should describe how to use
  the structured reference map returned by model context/preflight;
- shot-video instructions must tell agents to preserve user-selected model,
  input mode, references, voice registrations, and provider labels exactly;
- examples should include dialogue text inside the prompt for Seedance and
  Kling native-audio workflows.

Update `casting-director`:

- `casting-director/references/voice-casting.md` should continue to keep
  creative voice direction in Cast Design, while pointing provider handles to
  cast voice provider registrations;
- `casting-director/references/cast-voice-attachments.md` should describe
  reusable provider registrations instead of one direct provider/model/voice ID
  field on `CastVoice`;
- voice attachment guidance should distinguish:
  - ElevenLabs registrations for standalone dialogue TTS;
  - Kling registrations created from clean 5-30 second samples for video voice
    control;
  - Seedance audio references, which are per-generation references and not
    cast voice provider registrations.

Update model prompt guides:

- refresh Seedance 2.0 guidance so agents use `@AudioN` as reference audio,
  keep actual dialogue in the prompt, and avoid promising exact dialogue
  preservation;
- refresh Kling 3.0 guidance so agents use `@ElementN` for element-bound
  speech, `@ImageN` for O3 top-level image references, and `@Video1` for O3
  video-to-video source video;
- update model selection guidance so agents choose lipsync/talking-head or
  composition when exact generated dialogue audio must be preserved;
- update prompt-guide provenance with the official Seedance and Kling sources
  reviewed in this plan.

## Risks and Decisions

- O3 publishes `voice_id` in element schemas, but the reviewed O3 pages do not
  publish a voice-control surcharge. Decision: do not add a surcharge to O3
  estimates until fal documents one.
- V3 voice control price is clearly published. Decision: add a derived
  `uses_voice_control` pricing input and test fal's 5-second examples.
- V3 image-to-video has `elements`, but text-to-video does not. Decision: do
  not expose elements on V3 text routes.
- O3 image-to-video uses `image_url`, while V3 image-to-video uses
  `start_image_url`. Decision: route contracts must own provider field names;
  do not normalize these into one invented provider field.
- O3 video-to-video edit does not publish a duration field in the reviewed
  llms text, but local catalog pricing is per second. Decision: implement O3 V2V
  reference first, and verify edit schema/pricing before exposing edit in UI.
- Existing `CastVoice` storage currently holds ElevenLabs provider voice IDs,
  but that shape does not support one editorial cast voice with multiple
  provider registrations. Decision: split reusable provider handles into
  `CastVoiceProviderRegistration` and update ElevenLabs and Kling callers to use
  the same registration contract.
- The `CastVoiceProviderRegistration` migration needs custom SQL because
  Drizzle Kit can create the new table and remove old columns, but cannot infer
  that existing `cast_voice.provider`, `cast_voice.model`, and
  `cast_voice.voice_id` values must be backfilled into provider-registration
  rows before those columns are dropped. Decision: keep the migration in
  Drizzle's migration folder, generated through Drizzle Kit first, with an
  explicit one-time `INSERT ... SELECT` backfill and no runtime compatibility
  reader for the removed columns.
- Seedance `audio_urls` are reference media, not durable voice registrations and
  not exact dialogue tracks. Decision: use clean cast voice samples as the
  default Seedance audio reference, keep dialogue text in the prompt, and route
  exact generated dialogue audio through lipsync/composition workflows.

## Completion Checklist

### Review Area

- [x] Confirm this plan's exact model names still match
  `packages/engines/catalog/models/fal-ai/fal-ai.yaml`.
- [x] Confirm fal.ai docs still publish the same V3 and O3 prices before
  implementation begins.
- [x] Confirm O3 `voice_id` has no published voice-control surcharge in current
  fal docs.
- [x] Confirm O3 video-to-video edit schema before exposing edit mode.
- [x] Confirm no compatibility alias is planned for old Kling names.
- [x] Confirm official Kling 3.0 guidance still treats voice control as
  reusable voice-tone binding with dialogue text in the prompt.
- [x] Confirm official Seedance 2.0 guidance still treats audio inputs as
  multimodal references rather than exact dialogue audio tracks.

### Architecture and Contracts

- [x] Add explicit `ShotVideoTakeModelChoice` values for V3 Standard, V3 Pro,
  O3 Standard, and O3 Pro.
- [x] Add route metadata for V3 text, V3 image, O3 text, O3 image, O3
  reference, and O3 video-to-video reference.
- [x] Add `ShotVideoRouteReferenceContract` or an equivalent explicit route
  reference contract.
- [x] Add `KlingReferenceBundle`, `KlingTopLevelImageReference`,
  `KlingImageSetElementReference`, `KlingVideoElementReference`, and
  `KlingSourceVideoReference`.
- [x] Add `KlingVoiceRegistrationSpec`.
- [x] Add `CastVoiceProviderRegistration` as the explicit provider-handle
  contract for ElevenLabs and Kling.
- [x] Remove direct provider/model/voice ID ownership from `CastVoice` when the
  registration contract lands; update callers directly instead of keeping
  aliases.
- [x] Add provider registration capabilities for `dialogue-audio-tts` and
  `kling-video-voice-control`.
- [x] Add a Seedance audio-reference contract that distinguishes clean cast
  voice samples from generated dialogue audio references.
- [x] Decide whether `source-video-reference` and `source-video-edit` input
  modes ship in the first implementation slice or stay planned follow-up.
- [x] Update route validation so prompt/multi-prompt exclusivity is enforced.
- [x] Update route validation so V3 text cannot receive elements.
- [x] Update route validation so O3 image-to-video cannot receive elements.
- [x] Update route validation so `voice_id` is only attached to video-backed
  elements.
- [x] Update route validation so V3 voice control requires `generate_audio:
  true`.

### Engine Implementation

- [x] Add `costByVideoDurationAndAudioVoiceControl`.
- [x] Add V3 Standard prices:
  - [x] `$0.084/sec` audio off;
  - [x] `$0.126/sec` audio on;
  - [x] `$0.154/sec` audio on with voice control.
- [x] Add V3 Pro prices:
  - [x] `$0.112/sec` audio off;
  - [x] `$0.168/sec` audio on;
  - [x] `$0.196/sec` audio on with voice control.
- [x] Keep O3 Standard text/image/reference prices at `$0.084/sec` audio off
  and `$0.112/sec` audio on.
- [x] Keep O3 Pro text/image/reference prices at `$0.112/sec` audio off and
  `$0.14/sec` audio on.
- [x] Keep O3 video-to-video Standard at `$0.126/sec`.
- [x] Keep O3 video-to-video Pro at `$0.168/sec`.
- [x] Keep `kling-video/create-voice` at `$0.007/run`.
- [x] Materialize provider defaults before estimating.
- [x] Derive `uses_voice_control` for V3 pricing without sending it to fal.

### Core Implementation

- [x] Add `buildKlingV3ShotVideoPayload`.
- [x] Add `buildKlingO3ShotVideoPayload`.
- [x] Add reference bundle projection from selected/prepared shot-video inputs.
- [x] Map V3 first frame to `start_image_url`.
- [x] Map O3 first frame to `image_url`.
- [x] Map O3 reference top-level images to `image_urls`.
- [x] Map image-set elements to `elements[].frontal_image_url` and
  `elements[].reference_image_urls`.
- [x] Map video elements to `elements[].video_url`.
- [x] Map selected Kling provider registrations to `elements[].voice_id` only
  for video elements.
- [x] Map Seedance clean cast voice samples to `audio_urls` only on
  reference-to-video routes that also include at least one image or video
  reference.
- [x] Require explicit best-effort intent before mapping generated dialogue
  audio takes to Seedance `audio_urls`.
- [x] Add structured diagnostics for invalid voice binding, unsupported
  reference data, too many video elements, and missing source video.
- [x] Add structured diagnostics when Seedance audio references are requested
  without the required image/video reference.
- [x] Ensure pricing payloads include enough synthetic fields for accurate
  estimates without polluting provider payloads.

### CLI and Service Surfaces

- [x] Add provider registration read/list/create/remove service methods for
  cast voices.
- [x] Update existing ElevenLabs cast voice attachment and scene dialogue audio
  flows to use `CastVoiceProviderRegistration`.
- [x] Add Kling voice registration service methods.
- [x] Add CLI command or subcommand for estimating a Kling voice registration.
- [x] Add CLI command or subcommand for running a Kling voice registration.
- [x] Attach successful Kling voice registrations as provider registrations on
  the relevant `CastVoice`.
- [x] Add CLI output that reports the returned provider `voice_id`.
- [x] Ensure CLI failures serialize structured diagnostics.

### Studio UI

- [x] Show V3 Standard, V3 Pro, O3 Standard, and O3 Pro as separate model
  choices.
- [x] Show only route-supported controls for the selected model.
- [x] Use local shadcn-style controls for all interactive controls.
- [x] Add reference selection affordances for O3 top-level images and elements.
- [x] Add source-video selection only for O3 V2V routes when those routes ship.
- [x] Add Kling provider voice registration selection only where video-backed
  elements support it through the generation spec contract and validation; a
  dedicated Studio picker remains a follow-up after the stable CLI/service
  contract.
- [x] Add Seedance audio-reference selection that defaults to cast voice
  samples, not generated dialogue takes, through the generation spec contract;
  generated dialogue references require explicit best-effort intent.
- [x] Show a clear warning before allowing generated dialogue audio as a
  Seedance best-effort reference.
- [x] Keep visual reference cards quiet when no meaningful product/domain text
  exists.
- [x] Verify desktop behavior only unless mobile support is explicitly asked
  for.

### Studio Skills and Prompt Guides

- [x] Update
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
  to point shot-video generation at the refreshed reference-token guidance.
- [x] Update
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/shot-video-take.md`
  with Seedance and Kling provider-label rules.
- [x] Add shot-video skill examples where Seedance and Kling dialogue is written
  in the final prompt rather than represented as uploaded dialogue audio.
- [x] Update
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/voice-casting.md`
  so creative voice direction remains separate from provider registrations.
- [x] Update
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/cast-voice-attachments.md`
  for `CastVoiceProviderRegistration`, ElevenLabs TTS registrations, Kling
  voice-control registrations, and Seedance non-registration audio references.
- [x] Update Seedance 2.0 prompt guide references so `@AudioN` is described as
  voice/style conditioning and not exact dialogue preservation.
- [x] Update Kling 3.0 prompt guide references so `@ElementN`, `@ImageN`, and
  `@Video1` are used only for provider-populated reference fields.
- [x] Update model prompt selection guidance so exact generated dialogue audio
  routes to lipsync/talking-head/composition workflows instead of Seedance
  native audio references.
- [x] Update prompt-guide source provenance with the official Seedance and
  Kling source URLs and the June 14, 2026 review date.
- [x] Add skill-maintenance checks that prevent agents from using provider
  tokens such as `@Audio1`, `@Image1`, `@Element1`, or `@Video1` unless the
  corresponding logical input exists in the Renku spec/preflight context.

### Validation and Tests

- [x] Add engine model-family tests for V3/O3 route listings.
- [x] Add core payload tests for V3 image-to-video with start/end frames.
- [x] Add core payload tests for V3 image-to-video with image-set elements.
- [x] Add core payload tests for V3 image-to-video with one video element and
  voice ID.
- [x] Add core payload tests rejecting multiple V3 video elements.
- [x] Add core payload tests rejecting V3 image-set voice binding.
- [x] Add core payload tests rejecting Kling voice binding when the selected
  registration lacks `kling-video-voice-control`.
- [x] Add core payload tests for O3 reference-to-video with top-level
  `image_urls`.
- [x] Add core payload tests for O3 reference-to-video with image-set elements.
- [x] Add core payload tests for O3 video-to-video reference with `video_url`,
  `image_urls`, and elements.
- [x] Add estimate tests for every pricing row in the price-check table.
- [x] Add create-voice estimate test.
- [x] Add provider registration tests for ElevenLabs TTS and Kling voice
  control handles sharing the same `CastVoice`.
- [x] Add Seedance payload tests for clean sample audio references.
- [x] Add Seedance validation tests rejecting audio-only references.
- [x] Add Seedance validation tests requiring explicit best-effort intent for
  generated dialogue audio references.
- [x] Add validation tests for materialized defaults.
- [x] Add Studio service estimate matrix cases for V3 Standard, V3 Pro, O3
  Standard, and O3 Pro.

### Documentation

- [x] Update `docs/architecture/video-generation-model-capabilities.md` after
  implementation.
- [x] Add an accepted decision if the implementation introduces
  `source-video-reference` and `source-video-edit` input modes.
- [x] Update agent prompt/context docs so Kling voice control is described as
  provider voice ID binding, not direct audio upload.
- [x] Update agent prompt/context docs so Seedance audio references are
  described as voice/style conditioning, not exact dialogue preservation.
- [x] Document the O3 no-surcharge assumption for `voice_id` with source date.
- [x] Document the official Seedance/Kling audio semantics with source date.

### Final Verification

- [x] Run `pnpm --dir packages/engines test`.
- [x] Run `pnpm --dir packages/core test`.
- [x] Run `pnpm --dir packages/studio test` if Studio surfaces change.
- [x] Run `pnpm check` if public contracts change across packages.
- [x] Inspect provider payload examples in validation responses.
- [x] Confirm estimates shown in Studio and CLI match engine estimates.
- [x] Confirm no raw browser controls were added to `packages/studio`.
- [x] Confirm no compatibility wrappers, aliases, or re-export stubs were added.
