# 0057 Scene Dialogue Audio Generation

Status: proposed
Date: 2026-06-10

## Summary

Scene Narrative should let users generate, review, play, and pick speech audio
for each screenplay dialogue block.

The intended workflow is:

1. The user opens a Scene and stays on the Narrative tab.
2. Dialogue cards highlight on hover.
3. Hovering the cast member name shows a small profile-image preview when the
   Cast Member has a usable profile/first image.
4. A playable audio icon appears beside the cast member name only while the
   dialogue card is hovered or focused, and only when that dialogue already has
   a picked audio take.
5. Clicking the cast member name selects that dialogue and opens a right-side
   panel inside the Narrative tab bounds. Clicking elsewhere on the dialogue
   card does not open the panel.
6. The panel lets the user edit the spoken text, choose an ElevenLabs model,
   choose one of the speaker's Cast Voices, adjust voice settings, estimate the
   generation cost, generate one new take per click, play takes, and choose the
   picked take.
7. The latest successful generation becomes the picked take by default. The user
   can change the pick from the Takes tab.

If the speaker has no usable ElevenLabs Cast Voice/provider voice id, the panel
opens in a blocked state with a top warning bar telling the user to ask the
agent to assign a voice id. Model, voice, text, advanced, estimate, and Generate
controls are disabled until a usable voice id exists.

This plan adds the durable core model and agent-facing CLI surface needed for
that workflow. The next implementation slice should build the model, server
routes, CLI command, and Studio UI together so the browser and agent use the same
contracts.

## Relationship To Existing Plans

This plan builds on:

- `plans/active/0054-cast-voice-references-and-assets.md`
- `plans/active/0056-elevenlabs-voice-sample-retrieval.md`
- the existing `cast.voice-sample` generation purpose
- the existing shared media generation spec/run tables
- the existing Scene Narrative tab in
  `packages/studio/src/features/movie-studio/scenes/scene-panel.tsx`

Cast Voice remains the source of provider voice identity:

- Cast Voice stores the provider, model, provider voice id, Renku reference name,
  purpose, and sample asset.
- Scene Dialogue Audio uses one Cast Voice to generate speech for a specific
  dialogue block.

Do not collapse those concepts. A Cast Voice answers "which voice identity is
this?" A Scene Dialogue Audio record answers "which generated speech takes exist
for this screenplay dialogue?"

## Current State

### Scene Narrative UI

`ScenePanel` currently renders the Narrative tab as a centered article. Dialogue
blocks render as compact cards through `DialogueBlockView`.

Current behavior:

- the cast member name is a link to the Cast Member surface;
- dialogue cards do not have selectable state;
- there is no right-side editor panel;
- there is no dialogue-level audio playback;
- there is no dialogue-level generation state.

The Narrative tab uses local shadcn-style controls where it has controls today,
especially `Button` for clickable inline references. The new implementation must
continue that rule and must not add raw browser controls in feature code.

### Screenplay Dialogue Blocks

The current public screenplay contract has:

```ts
export interface DialogueBlock {
  type: 'dialogue';
  castMemberReference?: Reference;
  castMemberId?: string;
  extension?: string;
  parenthetical?: string;
  lines: string[];
  castMemberReferences?: Reference[];
  locationReferences?: Reference[];
  castMemberIds?: string[];
  locationIds?: string[];
}
```

Dialogue blocks do not currently have stable IDs. The Narrative renderer uses
array position. That is not durable enough for generated audio because one scene
can have many dialogue blocks by the same cast member, and nearby action text can
be inserted or deleted later.

### Cast Voices

Cast Voices are already first-class project data:

- `CastVoice`
- `cast_voice`
- Cast Voice sample assets
- `renku cast voice ...`
- `cast.voice-sample` generation for sample audio

The Scene Dialogue Audio workflow should use the speaker's Cast Voices as the
Voice selector source. The selector must show the Cast Voice reference name and
make the purpose available on hover through `Tooltip`.

### Media Generation

Core already has:

- `MediaGenerationSpec`
- `MediaGenerationRun`
- audio media kind support
- direct ElevenLabs TTS payload support
- `estimateMediaGenerationSpec`
- `runMediaGenerationSpec`

This plan adds a new media purpose for scene dialogue speech. It does not
replace `cast.voice-sample`; it adds a scene-owned use of the same direct
ElevenLabs provider.

The existing engines adapter already uses the official ElevenLabs TypeScript
client through `@elevenlabs/elevenlabs-js` and
`elevenlabs.textToSpeech.convert`. New dialogue audio work must build on that
adapter path. Do not add hand-written REST calls for text-to-speech generation.

### ElevenLabs V3 Prompting Reference

Use the ElevenLabs V3 best-practices reference for the V3-specific editor and
generation behavior:

```text
https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices#prompting-eleven-v3
```

Relevant product constraints from that reference:

- Eleven v3 does not use SSML break tags for pacing; use audio tags,
  punctuation, ellipses, capitalization, and text structure instead.
- Voice choice is central to the delivery. Tags cannot reliably force a voice
  into a style that contradicts its inherent character.
- Stability affects expressiveness. More creative/natural settings are more
  responsive to tags, while robust settings can be less expressive.
- Audio tags such as `[laughs]`, `[whispers]`, and `[sighs]` are a V3 prompt
  affordance.

For this implementation slice, optimize only the Eleven v3 path. Older
ElevenLabs models get plain text-to-speech treatment, a clear UI warning, and no
attempt to translate, emulate, strip, or otherwise make V3 audio tags work.

## Problems To Solve

### Dialogue Needs A Stable Target

Generated speech must attach to one dialogue block, not to a scene-level ordinal
that can silently point at the wrong line after edits.

Concrete failure if this is not solved:

1. The user generates audio for block index `4`.
2. A new action line is inserted above it.
3. The old block index `4` now refers to another dialogue.
4. The UI plays the wrong voice over the wrong line.

The implementation needs a stable `dialogueId` before it can safely persist
takes.

### Scene Dialogue Audio Is Not Cast Voice Sample Audio

`cast.voice-sample` generates or attaches a representative sample for a Cast
Voice. It is not scene dialogue.

Scene Dialogue Audio differs because it is:

- scene-owned;
- tied to a specific dialogue block;
- generated from editable dialogue text;
- allowed to have multiple takes;
- allowed to have one picked take;
- expected to update as the user changes text, model, voice, language, and
  ElevenLabs settings.

### Audio Tags Are Model-Specific

ElevenLabs v3 supports delivery tags such as `[laughs]`. Older or adjacent TTS
models should stay on a plain text-to-speech path.

The default should be:

- Eleven v3 is the default model;
- V3 text may include audio tags and expressive punctuation;
- V3 tags are visually highlighted in the editor;
- older ElevenLabs models show a warning that audio tags and V3 delivery
  controls will not work;
- older ElevenLabs models generate from the plain dialogue text only;
- the implementation must not send V3 tag text to older models, must not convert
  tags into SSML, and must not try to emulate V3 tag behavior for older models.

The setup therefore stores both plain dialogue text and V3-optimized prompt
text. Core chooses the provider text from the selected model:

- `elevenlabs/eleven_v3` uses the V3 prompt text;
- older ElevenLabs TTS models use the plain text.

### Studio Must Not Build Provider Payloads

The browser should render model choices, voice choices, settings, estimates, and
take state. It should not decide which provider fields ElevenLabs supports.

Core and engines must own:

- model list and defaults;
- model-specific tag support;
- provider compatibility;
- voice setting ranges and defaults;
- output format values;
- language override handling;
- provider payload construction;
- estimate generation;
- run execution and output import.

Voice ids assigned through Cast Voice are treated as compatible across
ElevenLabs TTS models for this slice. The Voice selector filters by Cast Member
and provider, not by model.

### Picks Need Durable Semantics

Every successful generation is a take. One take is the pick for that dialogue.

Default behavior:

- a newly generated take becomes the pick;
- picking one take clears the previous pick for that dialogue;
- deleting a picked take promotes the newest remaining take;
- deleting the last remaining take leaves the dialogue without a picked take.

The UI must never infer the pick by "latest asset in the list." Core returns the
picked state.

## Goals

1. Add stable dialogue IDs for screenplay dialogue blocks.
2. Add a core Scene Dialogue Audio data model that supports one editable setup
   and many generated takes per dialogue block.
3. Add one picked take per dialogue.
4. Add a new `scene.dialogue-audio` media generation purpose using the direct
   `elevenlabs` provider.
5. Reuse Cast Voice records as the Voice selector source.
6. Estimate and run dialogue audio generation through the existing shared media
   generation path.
7. Store generated audio as normal audio Assets and link them to dialogue audio
   takes.
8. Extend Scene Narrative resources so Studio can render dialogue audio state
   without extra per-card waterfalls.
9. Add Studio API routes for reading dialogue audio state, estimating a draft,
   generating a take, picking a take, and serving take audio files.
10. Add an agent-facing CLI command that can plan and generate dialogue audio for
    one dialogue or all eligible dialogue in a scene.
11. Update the Narrative tab with hover, selection, playback, and a right-side
    generation panel inside the Narrative tab bounds.
12. Show Cast Member profile-image previews from the speaker name hover when a
    useful profile/first image exists.
13. Autosave dialogue audio setup edits through the existing latest-only
    autosave queue and details-header save notification path.
14. Keep all feature controls on local shadcn-style primitives.

## Non-Goals

- Do not build an ElevenLabs voice browser in Studio.
- Do not call ElevenLabs to list voices.
- Do not create new Cast Voices from the Scene Narrative panel.
- Do not use fal.ai, Wavespeed, or other ElevenLabs wrappers for dialogue audio.
- Do not add hand-written REST calls for ElevenLabs TTS. Use the existing
  engines adapter and the official ElevenLabs TypeScript client.
- Do not add dubbing, lip-sync, subtitles, word-level timing, transcripts, or
  export assembly in this slice.
- Do not build a full audio timeline.
- Do not add mobile behavior. Renku Studio is desktop-first.
- Do not preserve old names or add compatibility aliases.
- Do not silently attach generated audio to dialogue by block index alone.
- Do not show raw filenames, asset ids, provider ids, or generated role labels on
  dialogue cards or take rows.

## Product Terms

### Scene Dialogue

A **Scene Dialogue** is one screenplay dialogue block in a Scene.

The public screenplay contract should add a stable `dialogueId` to dialogue
blocks. The UI may still call the editor tab `Dialog` because that is the
requested compact label, but the code and data model should keep `dialogue`
because that is the existing screenplay block type.

### Scene Dialogue Audio

**Scene Dialogue Audio** is the editable generation setup for one Scene Dialogue.

It stores:

- scene id;
- dialogue id;
- speaker Cast Member id;
- selected Cast Voice id;
- selected model;
- plain spoken text;
- Eleven v3 prompt text with optional audio tags;
- language override;
- output format;
- ElevenLabs voice settings;
- current picked take.

### Scene Dialogue Audio Take

A **Scene Dialogue Audio Take** is one generated audio candidate for a Scene
Dialogue Audio record.

It stores:

- take id;
- Scene Dialogue Audio id;
- audio Asset id;
- audio Asset File id;
- Media Generation Run id;
- provider text snapshot;
- plain text snapshot;
- Eleven v3 prompt text snapshot;
- text treatment snapshot;
- model and Cast Voice snapshot;
- voice settings snapshot;
- output format and language snapshot;
- created time;
- picked state.

### Audio Tags

**Audio Tags** are bracketed delivery tokens inside dialogue text, such as
`[laughs]`, `[whispers]`, or `[sighs]`.

For this slice:

- tags are plain text stored in the Eleven v3 prompt text;
- tags receive subtle visual highlighting in the V3 editor;
- tags are used only by `elevenlabs/eleven_v3`;
- older ElevenLabs models use plain text and show a warning that audio tags,
  V3 delivery prompts, and expressive tag controls will not work.

## Confirmed Product Decisions

These decisions are part of the accepted product direction for this plan:

1. Hovering over the cast member name shows a small profile-image preview when
   the Cast Member has a usable profile/first image. Do not show a filler image
   when no image exists.
2. Clicking the cast member name opens the Scene Dialogue Audio panel. Clicking
   elsewhere on the dialogue card highlights/focuses the card but does not open
   the panel.
3. The inline cast member name is no longer the Cast navigation control on this
   surface. Cast navigation remains available through the Cast surface and other
   existing project navigation.
4. If the Cast Member has no usable ElevenLabs Cast Voice/provider voice id, the
   right panel shows a top warning bar telling the user to ask the agent to
   assign a voice id. Model, voice, text, advanced, estimate, and Generate
   controls are disabled until a usable voice id exists.
5. ElevenLabs voice ids are treated as compatible across all supported
   ElevenLabs TTS models. The Voice selector filters by speaker Cast Member and
   provider, not by model.
6. Deleting the picked take automatically promotes the newest remaining take. If
   no takes remain, `pickedTakeId` becomes `null`.
7. The first implementation generates exactly one take per Generate click. There
   is no take-count control.
8. Dialogue audio setup edits autosave with `useDebouncedAutosave` and
   `createLatestOnlySaveQueue`, matching ADR `0005`. Save feedback is routed to
   the Movie Studio details header, matching ADR `0027`; the dialogue audio
   panel must not render its own `Saving` or `Saved` badge.
9. Eleven v3 is the default and only optimized expressive path. Older ElevenLabs
   models show a warning that audio tags and V3 expression controls will not
   work and generate from plain text only.
10. Provider calls for dialogue TTS use the official ElevenLabs TypeScript
    client through the existing engines adapter. Do not introduce raw REST calls
    for the new generation path.

## Core Contracts

### Dialogue ID Contract

Add a stable id to dialogue blocks:

```ts
export interface DialogueBlock {
  dialogueId: string;
  type: 'dialogue';
  castMemberReference?: Reference;
  castMemberId?: string;
  extension?: string;
  parenthetical?: string;
  lines: string[];
  castMemberReferences?: Reference[];
  locationReferences?: Reference[];
  castMemberIds?: string[];
  locationIds?: string[];
}
```

Entity id prefix:

```ts
| 'scene_dialogue'
```

Generated ids should look like:

```text
scene_dialogue_abcd2345
```

Write paths that create or revise screenplay scenes must assign stable
`dialogueId` values before persistence. If a revision keeps an existing dialogue
block and its `dialogueId`, the id stays. If a revision creates a new dialogue
block, it receives a new id.

Use a Drizzle custom migration to backfill `dialogueId` values into existing
persisted `scene.blocks_json` dialogue blocks.

If Drizzle/SQLite cannot safely rewrite the JSON block array during migration,
stop and revise this plan before implementation continues. Do not replace the
migration with runtime guessing, lazy repair, or block-index attachment.

### Public Scene Dialogue Audio Types

Add to `packages/core/src/client`:

```ts
export const SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE =
  'scene.dialogue-audio' as const;

export interface SceneDialogueMediaGenerationTarget {
  kind: 'sceneDialogue';
  sceneId: string;
  dialogueId: string;
}

export interface SceneDialogueAudio {
  id: string;
  sceneId: string;
  dialogueId: string;
  castMemberId: string;
  castVoiceId: string | null;
  modelChoice: SceneDialogueAudioModelChoice;
  plainText: string;
  v3Text: string;
  voiceSettings: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
  pickedTakeId: string | null;
  takes: SceneDialogueAudioTake[];
  createdAt: string;
  updatedAt: string;
}

export interface SceneDialogueAudioTake {
  takeId: string;
  sceneDialogueAudioId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId: string;
  modelChoice: SceneDialogueAudioModelChoice;
  castVoiceId: string;
  castVoiceName: string;
  provider: 'elevenlabs';
  providerVoiceId: string;
  providerTextSnapshot: string;
  plainTextSnapshot: string;
  v3TextSnapshot: string;
  textTreatment: SceneDialogueAudioTextTreatment;
  voiceSettingsSnapshot: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
  picked: boolean;
  createdAt: string;
}
```

The browser response type should decorate take files with HTTP URLs the same way
Cast Voice sample files are decorated today.

### Generation Spec

Add:

```ts
export type SceneDialogueAudioModelChoice =
  | 'elevenlabs/eleven_v3'
  | 'elevenlabs/eleven_multilingual_v2'
  | 'elevenlabs/eleven_turbo_v2_5';

export type SceneDialogueAudioTextTreatment =
  | 'elevenlabs-v3-audio-tags'
  | 'plain-tts';

export interface SceneDialogueAudioVoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
}

export interface SceneDialogueAudioGenerationSpec {
  purpose: typeof SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE;
  target: SceneDialogueMediaGenerationTarget;
  modelChoice: SceneDialogueAudioModelChoice;
  castVoiceId: string;
  plainText: string;
  v3Text: string;
  voiceSettings?: SceneDialogueAudioVoiceSettings;
  outputFormat?: string;
  languageCode?: string | null;
  title?: string;
}
```

Validation rules:

- `target.kind` must be `sceneDialogue`.
- `target.sceneId` must reference an existing Scene.
- `target.dialogueId` must reference a dialogue block in that Scene.
- the dialogue block must have a `castMemberId`;
- `castVoiceId` must reference a Cast Voice owned by that Cast Member;
- Cast Voice provider must be `elevenlabs`;
- Cast Voice provider voice id must be trimmed and non-empty;
- selected model must be supported for Scene Dialogue Audio;
- Voice selector compatibility is provider-wide for ElevenLabs TTS models;
- `plainText` must be trimmed and non-empty;
- `v3Text` must be trimmed and non-empty when `modelChoice` is
  `elevenlabs/eleven_v3`;
- audio tags are applied only for `elevenlabs/eleven_v3`;
- non-v3 models must generate from `plainText`, even when `v3Text` contains
  tags;
- `outputFormat` defaults to `mp3_44100_128`;
- `languageCode` defaults to `null`, meaning auto;
- voice setting values must be inside model-supported ranges.

The provider payload should follow the existing ElevenLabs shape:

```ts
{
  text: providerText,
  voice: castVoice.voiceId,
  output_format,
  language_code,
  voice_settings: {
    stability,
    similarity_boost,
    style,
    speed,
    use_speaker_boost,
  },
}
```

Core must build this payload. Studio must not.

## Database Design

Add a focused schema module:

```text
packages/core/src/server/schema/scene-dialogue-audio.ts
```

Add it to:

```text
packages/core/src/server/schema/index.ts
```

### `scene_dialogue_audio`

```text
scene_dialogue_audio
  id text primary key
  scene_id text not null references scene(id) on delete cascade
  dialogue_id text not null
  cast_member_id text not null references cast_member(id)
  cast_voice_id text references cast_voice(id)
  model_choice text not null
  plain_text text not null
  v3_text text not null
  voice_settings_json text not null
  output_format text not null
  language_code text
  picked_take_id text
  created_at text not null
  updated_at text not null
```

Indexes:

```text
scene_dialogue_audio_scene_idx on scene_dialogue_audio(scene_id, updated_at, id)
scene_dialogue_audio_dialogue_idx unique on scene_dialogue_audio(scene_id, dialogue_id)
scene_dialogue_audio_cast_member_idx on scene_dialogue_audio(cast_member_id)
scene_dialogue_audio_cast_voice_idx on scene_dialogue_audio(cast_voice_id)
```

Rules:

- one Scene Dialogue Audio setup per `scene_id + dialogue_id`;
- `plain_text` starts from `DialogueBlock.lines.join('\n')` when no custom
  setup exists;
- `v3_text` starts from `plain_text` and may be edited with V3 audio tags;
- `cast_voice_id` may be null while the Cast Member has no usable ElevenLabs
  Cast Voice/provider voice id, but generation is blocked until a usable voice
  id is selected;
- `picked_take_id` points at one take for the same Scene Dialogue Audio record.

### `scene_dialogue_audio_take`

```text
scene_dialogue_audio_take
  id text primary key
  scene_dialogue_audio_id text not null references scene_dialogue_audio(id) on delete cascade
  asset_id text not null references asset(id) on delete cascade
  asset_file_id text not null references asset_file(id)
  media_generation_run_id text not null references media_generation_run(id)
  model_choice text not null
  cast_voice_id text not null references cast_voice(id)
  cast_voice_name text not null
  provider text not null
  provider_voice_id text not null
  provider_text_snapshot text not null
  plain_text_snapshot text not null
  v3_text_snapshot text not null
  text_treatment text not null
  voice_settings_snapshot_json text not null
  output_format text not null
  language_code text
  created_at text not null
  updated_at text not null
```

Indexes:

```text
scene_dialogue_audio_take_audio_idx on scene_dialogue_audio_take(scene_dialogue_audio_id, created_at, id)
scene_dialogue_audio_take_asset_idx unique on scene_dialogue_audio_take(asset_id)
scene_dialogue_audio_take_run_idx unique on scene_dialogue_audio_take(media_generation_run_id)
```

Picking a take updates `scene_dialogue_audio.picked_take_id`. The take table does
not need a second selected flag. Deleting a picked take sets `picked_take_id` to
the newest remaining take for the same Scene Dialogue Audio record, or `null`
when no takes remain.

### Asset Storage

Generated dialogue audio files should be regular audio Assets. Store generated
files under:

```text
generated/media/scene-dialogue-audio/
```

The asset relationship should attach the audio asset to the Scene with:

```text
role: dialogue_audio
mediaKind: audio
selection: take
referenceName: null
purpose: null
```

Do not display filenames or generated asset titles in the dialogue UI. The take
row can display meaningful generated labels such as `Take 1`, `Take 2`, and
timestamp/estimate metadata.

### Drizzle Migration

This is a runtime-read schema change. The implementation must:

1. edit the Drizzle schema source in `packages/core/src/server/schema`;
2. generate SQL with Drizzle Kit from `packages/core`;
3. increment the project store schema generation if runtime reads require the
   new tables or dialogue IDs;
4. add `PRAGMA user_version = <new generation>;` to the migration when the
   schema generation changes;
5. add a documented Drizzle custom migration step that backfills dialogue IDs
   into `scene.blocks_json`;
6. migrate development sample projects through `renku project migrate`.

Do not hand-write a TypeScript migration registry. Do not copy generated SQL
into runtime code.

## Core Service Design

Add focused modules:

```text
packages/core/src/server/database/access/scene-dialogue-audio.ts
packages/core/src/server/media-generation/scene-dialogue-audio.ts
packages/core/src/server/project-data-service-wiring/scene-dialogue-audio.ts
```

Use these Project Data Service method names:

```ts
readSceneDialogueAudioContext(input)
listSceneDialogueAudioModels(input)
validateSceneDialogueAudioSpec(input)
createSceneDialogueAudioSpec(input)
updateSceneDialogueAudioSpec(input)
listSceneDialogueAudioSpecs(input)
prepareSceneDialogueAudioSpec(input)
estimateSceneDialogueAudioDraft(input)
generateSceneDialogueAudioTake(input)
pickSceneDialogueAudioTake(input)
deleteSceneDialogueAudioTake(input)
```

Private helper names may follow implementation needs, but public service names
must keep the product concepts explicit: `SceneDialogueAudio`, `Take`, and
`Pick`.

### Context Builder

`readSceneDialogueAudioContext` should return:

- project identity and base language;
- scene title and setting;
- dialogue blocks with stable `dialogueId`;
- cast member labels;
- Cast Member profile/first image references decorated with browser-safe URLs
  for speaker-name hover previews;
- Cast Voices grouped by Cast Member;
- existing Scene Dialogue Audio records;
- existing takes and picked take IDs;
- model choices and defaults;
- resource keys.

Extend `SceneNarrativeResource` so the Narrative tab receives this context in
the same scene read that already returns screenplay blocks. The standalone
`GET /dialogue-audio` route returns the same context for focused refresh after
mutations. Do not add one request per dialogue card.

### Generate Take

`generateSceneDialogueAudioTake` should:

1. validate and persist the current Scene Dialogue Audio setup;
2. create or update the matching `scene.dialogue-audio` Generation Spec;
3. estimate the spec and require a valid approval token for live runs;
4. run through the shared media generation service;
5. register the generated audio output as an Asset and Asset File;
6. insert a `scene_dialogue_audio_take` row with immutable snapshots, including
   the provider text chosen for the selected model;
7. set the new take as `picked_take_id`;
8. return the refreshed Scene Dialogue Audio context and resource keys.

The Studio server can wrap this as one API action so the browser Generate button
does not need to orchestrate spec creation, run execution, asset registration,
take insertion, and picking.

### Structured Diagnostics

Reserve a focused code range:

```text
PROJECT_DATA380...PROJECT_DATA399 for Scene Dialogue Audio data and generation
CLI140...CLI159 for Scene Dialogue Audio command errors
STUDIO_SERVER120...STUDIO_SERVER139 for Scene Dialogue Audio HTTP adapter errors
```

Required failure cases:

- missing scene;
- dialogue block does not exist;
- dialogue block has no stable `dialogueId`;
- dialogue block has no Cast Member;
- Cast Member has no usable ElevenLabs Cast Voice/provider voice id;
- selected Cast Voice belongs to another Cast Member;
- unsupported model;
- empty `plainText`;
- empty `v3Text` for Eleven v3;
- invalid voice setting value;
- missing or stale approval token;
- generation run has no audio output;
- generated output is not a supported audio type;
- take belongs to another dialogue when picking or deleting.

## Studio API Design

Add request readers under:

```text
packages/studio/server/http/scene-dialogue-audio-request.ts
```

Add route handlers to the screenplay route:

```text
GET    /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio
PATCH  /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/setup
POST   /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/estimate
POST   /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/generate
POST   /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId/pick
DELETE /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId
GET    /studio-api/projects/:projectName/screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/takes/:takeId/files/:assetFileId
```

Mutation routes must use `requireToken`. The `setup` route is the autosave
surface for `modelChoice`, `castVoiceId`, `plainText`, `v3Text`,
`voiceSettings`, `outputFormat`, and `languageCode`. It returns the refreshed
Scene Dialogue Audio context plus resource keys so the latest-only autosave hook
can apply returned state only when the saved value is still current.

The file route should reuse the existing asset-file response patterns and must
verify that the requested file belongs to the requested dialogue take.

Resource keys:

```text
scene:<sceneId>
surface:scene:<sceneId>:dialogue-audio
scene-dialogue-audio:<sceneDialogueAudioId>
scene-dialogue-audio-take:<takeId>
```

Studio resource refresh should reload the Narrative tab when dialogue audio
changes for the active scene.

## CLI And Agent Contract

The agent needs a scene-level command, not only low-level spec commands.

Add a focused command under `generation`:

```bash
renku generation dialogue-audio plan --scene <scene-id> --json
renku generation dialogue-audio generate --scene <scene-id> --dialogue <dialogue-id> --approval-token <token> --json
renku generation dialogue-audio generate --scene <scene-id> --all --approval-token <token> --json
renku generation dialogue-audio pick --scene <scene-id> --dialogue <dialogue-id> --take <take-id> --json
```

The exact command handler should be a focused registry, similar in spirit to the
Cast Voice command handler registry. Do not add another long nested command body
to `generation-command.ts`.

Plan output should include:

- scene id and title;
- each eligible dialogue id;
- speaker Cast Member;
- selected/default Cast Voice;
- selected model;
- plain text length;
- V3 prompt text length;
- whether V3 audio tags are present;
- whether the selected model will use V3 prompt text or plain text;
- estimate state and approval token when available;
- existing take count;
- picked take id;
- diagnostics.

Generate output should include:

- created run id;
- created take id;
- picked take id;
- file metadata without raw audio bytes;
- resource keys.

Agent behavior:

- use `plan` first;
- do not generate dialogue with missing voices;
- treat non-v3 models as plain text-to-speech and report the V3 warning instead
  of trying to make tags work;
- use `generate --all` only after the user has approved the total estimate;
- verify with `plan` or Scene Narrative refresh after generation.

## Studio UI Design

### Narrative Tab Layout

Extract the Narrative tab out of `scene-panel.tsx` into focused components:

```text
packages/studio/src/features/movie-studio/scenes/scene-narrative-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-card.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-panel.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-dialog-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-takes-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-advanced-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-footer.tsx
packages/studio/src/features/movie-studio/scenes/scene-dialogue-tagged-text-editor.tsx
packages/studio/src/features/movie-studio/scenes/use-scene-dialogue-audio.ts
```

The Narrative tab should become a bounded flex surface:

```text
LineTabsContent value="narrative"
  SceneNarrativeTab
    Reading column: scrollable, centered article
    Dialogue Audio Panel: fixed width, right side, inside tab bounds
```

Rules:

- no page-level card around the panel;
- no card inside card;
- panel has `border-l border-border/40` or the local panel border token;
- panel is hidden until a dialogue is selected;
- Close icon dismisses the panel and clears selected dialogue state;
- panel stays within the Narrative tab and does not overlap the bottom
  Generation Activity footer.

### Dialogue Cards

Dialogue cards should:

- use the existing warm/amber selected treatment from the design guidelines;
- highlight on hover;
- show the selected treatment when selected;
- keep the card itself as a reading surface, not the panel-opening control;
- open the panel only from the cast member name control;
- show a small Cast Member profile-image preview when the cast member name is
  hovered and the Cast Member has a usable image;
- reserve space so the hover audio icon does not shift the cast member name;
- show the audio icon only on hover/focus and only when a picked take has a
  playable file;
- play/pause the picked take when the icon is clicked;
- stop playback when another dialogue or take starts playing;
- keep keyboard focus visible.

Use `Button`, `Tooltip`, and lucide icons such as `Volume2`, `Play`, and
`Pause`. Do not use raw `<button>`.

The cast member name control should use `Button` with a quiet/text-like variant
that matches the current inline reference styling. Its tooltip or hover preview
may include the Cast Member image and name. If no image exists, show the normal
text hover/focus treatment without a placeholder image.

### Right Panel Header

The top row contains:

- tab triggers: `Dialog`, `Takes`, `Advanced`;
- right-aligned Close icon button.

The panel top section takes roughly 80% of the panel height and scrolls its tab
content as needed.

The shared bottom section takes roughly 20% of the panel height and contains:

- estimate label and value;
- estimate loading/error state;
- Generate button;
- short structured issue summary when generation is blocked.

When the selected speaker has no usable ElevenLabs Cast Voice/provider voice id,
render a top warning bar above the tab content:

```text
This cast member is missing a voice id. Ask the agent to assign a voice id before generating dialogue audio.
```

While this warning is active, disable model, voice, text, advanced, estimate,
and Generate controls. Existing takes, if any, may still be playable and
pickable because they are already generated artifacts.

When the selected model is not `elevenlabs/eleven_v3`, render a warning section
above the Dialog tab content:

```text
Audio tags and V3 delivery controls only work with Eleven v3. This model will generate from plain text.
```

This is an informational warning, not an attempt to adapt tags for older
models.

### Dialog Tab

Controls:

- Model selector;
- Voice selector;
- tagged text editor.

Model selector:

- defaults to `Eleven v3`;
- identifies which models support audio tags;
- changing to a non-v3 model shows the older-model warning and switches the
  generation preview to plain text.

Voice selector:

- lists Cast Voices for the dialogue speaker;
- shows humanized reference name as the visible option label;
- shows Cast Voice purpose in a tooltip or select item description;
- does not show provider voice ids by default;
- shows an empty/blocked state when no usable ElevenLabs Cast Voice/provider
  voice id exists for the speaker.

Tagged text editor:

- compose a feature-local editor around local `Textarea`;
- in Eleven v3 mode, edit `v3Text` and use a noninteractive highlight layer to
  style `[tag]` tokens subtly;
- in older-model mode, edit `plainText` with simple text-to-speech treatment and
  no tag highlighting;
- keep the real editable control accessible as a textarea through the local
  `Textarea` primitive;
- no raw `<textarea>` in feature code;
- no contenteditable unless a local `src/ui` primitive is deliberately added
  and tested.

Autosave:

- use `useDebouncedAutosave` with the default 700 ms debounce unless the current
  Scene editor establishes a stricter local default before implementation;
- save setup changes through the `PATCH .../dialogue-audio/:dialogueId/setup`
  route;
- route the returned `DebouncedSaveStatus` through
  `onSaveNotificationChange` so the `PanelShell` details header renders
  `Saving`, `Saved`, and save errors;
- do not render a local saved badge inside the dialogue audio panel.

### Takes Tab

The Takes tab shows generated takes newest first or in explicit take order.

Each take row includes:

- take label such as `Take 3`;
- play/pause button;
- progress slider;
- duration when known from browser audio metadata;
- picked control;
- generated timestamp;
- concise diagnostics if the run completed with warnings.

Use the local `Slider` for progress display/scrubbing if scrubbing is supported.
If the first implementation only displays progress, use a read-only visual
progress primitive or a disabled `Slider` with clear semantics.

Picking a take:

- calls the Studio API;
- updates the local context from the response;
- changes the picked take used by the hover audio icon;
- does not regenerate audio.

Deleting a take:

- calls the Studio API;
- promotes the newest remaining take when the deleted take was picked;
- clears the pick when no takes remain;
- returns the refreshed context instead of requiring the browser to infer the
  next pick.

### Advanced Tab

The Advanced tab should render model-supported ElevenLabs controls:

- Speed;
- Stability;
- Similarity Boost;
- Style/Exaggeration if supported by the selected model;
- Speaker Boost if supported;
- Language Override, defaulting to Auto (`languageCode: null`);
- Output Format, defaulting to `mp3_44100_128`.

The screenshot reference suggests compact dark-panel controls with:

- label;
- left/right helper text;
- current numeric value;
- slider;
- select rows for language and output format.

Adapt this to Renku's local design tokens:

- amber primary accents;
- softened borders;
- compact uppercase section labels where appropriate;
- local `Slider`, `Switch`, `Select`, and `Button` primitives.

Do not expose unsupported provider parameters. The controls must come from the
core model report or a core-owned settings contract.

## Visual And Interaction Rules

Follow:

- `docs/product/design-guidelines.md`
- `docs/architecture/reference/front-end-guidelines.md`

Important rules for this slice:

- feature code must not use raw `button`, `input`, `select`, `textarea`, or
  similar controls;
- use local `Button`, `Select`, `Textarea`, `Slider`, `Switch`, `Tabs` or
  `LineTabs`, and `Tooltip`;
- use lucide icons for audio, close, play, pause, and reset actions;
- keep visible copy meaningful and sparse;
- do not show filenames, asset ids, provider ids, or generated role names on
  visual cards;
- use the app's amber selected/focus treatment;
- keep the panel and cards compact and information-dense;
- verify desktop behavior only unless mobile support is explicitly requested.

## Implementation Slices

### Slice 1: Contracts And Dialogue IDs

Add dialogue IDs and public contracts for Scene Dialogue Audio. Decide and
implement the migration/backfill path before any generated audio can be attached
to dialogue.

### Slice 2: Core Persistence And Generation Purpose

Add the schema, database access, generation purpose, validation, estimate, run,
take insertion, and pick behavior.

### Slice 3: Studio Server And Browser Services

Add Studio API routes, request readers, response decorators with audio URLs, and
browser service functions.

### Slice 4: Narrative UI

Refactor the Narrative tab into focused components. Add card hover/selection,
picked-take playback, the right panel, tabs, editor, takes list, advanced
settings, estimate, and Generate action.

### Slice 5: CLI And Agent Workflow

Add `generation dialogue-audio` plan/generate/pick commands and update
agent-facing workflow docs or skills if needed.

## Testing Strategy

Core tests:

- dialogue IDs are required in persisted blocks;
- Scene Dialogue Audio context returns all dialogue blocks and existing takes;
- validation rejects missing dialogue, missing Cast Member, missing usable
  ElevenLabs voice id, wrong Cast Voice owner, unsupported model, invalid
  settings, empty plain text, and empty V3 text when V3 is selected;
- estimate builds the expected ElevenLabs provider payload;
- V3 estimates/generation use `v3Text` and preserve audio tags;
- older ElevenLabs models use `plainText` and do not receive V3 tags;
- generate inserts a Generation Run, Asset, Asset File, take row, and picked
  take;
- generating a new take makes it the pick;
- picking a take clears the old pick;
- deleting a picked take promotes the newest remaining take;
- resource keys include scene and dialogue audio keys.

Studio server tests:

- routes require token for mutations;
- estimate and generate request parsing rejects malformed input;
- file route verifies take ownership before serving audio;
- responses decorate audio files with URLs;
- structured errors serialize correctly.

Studio UI tests:

- dialogue cards show hover/selected classes;
- cast member name hover shows a profile-image preview only when an image
  exists;
- hover audio icon appears only when a picked playable take exists;
- clicking the cast member name opens the panel inside the Narrative tab;
- clicking elsewhere on the dialogue card does not open the panel;
- Close button dismisses the panel;
- missing usable voice id shows the top warning bar and disables generation
  controls;
- model selector defaults to Eleven v3;
- Voice selector lists Cast Voice names and exposes purposes;
- V3 tags receive highlighted treatment in the editor;
- non-v3 model shows the older-model warning and uses plain text treatment;
- dialogue setup edits autosave through the details-header notification path;
- Takes tab can play/pause and pick takes;
- Generate button uses the latest estimate approval token;
- Generate creates one take per click;
- feature code uses local shadcn primitives only.

CLI tests:

- `generation dialogue-audio plan --scene ... --json` returns all eligible
  dialogue items;
- plan reports diagnostics for missing voices;
- plan reports whether each item will use V3 prompt text or plain text;
- generate one dialogue creates a take and picks it;
- generate all skips or fails invalid dialogue according to the confirmed batch
  policy;
- pick command changes the picked take;
- commands return structured JSON and do not print raw audio bytes.

Manual desktop verification:

- run `pnpm --filter @gorenku/studio-core test`;
- run `pnpm --filter @gorenku/studio-cli test`;
- run `pnpm --filter @gorenku/studio test`;
- run `pnpm --filter @gorenku/studio lint`;
- start Studio with `pnpm dev:studio`;
- open a scene Narrative tab in desktop Chrome;
- verify hover, selection, panel bounds, text fit, playback, estimate, generate,
  and pick behavior against the screenshot direction.

## Completion Checklist

### Review Area

- [ ] Verify the plan keeps `Dialog` as the visible tab label while using
      `dialogue` for code, schema, and domain contracts.
- [ ] Verify the speaker name, not the full dialogue card, is the
      panel-opening affordance.
- [ ] Verify Cast Voice selection filters by speaker Cast Member and
      ElevenLabs provider, not by selected model.
- [ ] Verify the V3-only audio-tag behavior follows the ElevenLabs prompting
      reference and does not try to make tags work for older models.
- [ ] Verify missing voice id behavior is blocked with a top warning bar and a
      clear agent-facing instruction.
- [ ] Verify autosave behavior follows ADR `0005` and save notification
      placement follows ADR `0027`.

### Architecture And Contracts

- [ ] Add `dialogueId` to `DialogueBlock`.
- [ ] Add `scene_dialogue` to the entity id prefix list.
- [ ] Update screenplay create/apply/revise write paths to preserve existing
      dialogue IDs and allocate new IDs for new dialogue blocks.
- [ ] Add `SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE`.
- [ ] Add `SceneDialogueMediaGenerationTarget`.
- [ ] Add `SceneDialogueAudioModelChoice`.
- [ ] Add `SceneDialogueAudioTextTreatment`.
- [ ] Add `SceneDialogueAudioVoiceSettings`.
- [ ] Add `SceneDialogueAudioGenerationSpec`.
- [ ] Add `SceneDialogueAudio`.
- [ ] Add `SceneDialogueAudioTake`.
- [ ] Model Scene Dialogue Audio setup with `plainText` and `v3Text`.
- [ ] Model Scene Dialogue Audio Take snapshots with provider text, plain text,
      V3 prompt text, and text treatment.
- [ ] Add `scene.dialogue-audio` to `MediaGenerationPurpose`.
- [ ] Add `sceneDialogue` to media generation target handling.
- [ ] Update media generation spec target-kind persistence to support
      `sceneDialogue`.
- [ ] Update public exports from `@gorenku/studio-core/client` and server
      entrypoints.

### Database And Migrations

- [ ] Add `packages/core/src/server/schema/scene-dialogue-audio.ts`.
- [ ] Add `scene_dialogue_audio` with `plain_text` and `v3_text` setup
      columns.
- [ ] Add `scene_dialogue_audio_take` with provider/plain/V3 text snapshots and
      `text_treatment`.
- [ ] Add indexes for scene lookup, dialogue uniqueness, take ordering, asset
      ownership, and run ownership.
- [ ] Implement the documented Drizzle custom migration for dialogue ID
      backfill.
- [ ] Generate the migration with Drizzle Kit.
- [ ] Add `PRAGMA user_version = <new generation>;` if runtime schema
      generation changes.
- [ ] Update migration tests and schema generation assertions.
- [ ] Migrate development sample projects.

### Core Implementation

- [ ] Add `packages/core/src/server/database/access/scene-dialogue-audio.ts`.
- [ ] Add read/list helpers for Scene Dialogue Audio and takes.
- [ ] Add insert/update helper for Scene Dialogue Audio setup.
- [ ] Add insert helper for generated takes.
- [ ] Add pick helper that enforces take ownership.
- [ ] Add delete helper that enforces take ownership, promotes the newest
      remaining take when needed, and clears the pick when no takes remain.
- [ ] Add `packages/core/src/server/media-generation/scene-dialogue-audio.ts`.
- [ ] Build Scene Dialogue Audio context from Scene, Cast Member, Cast Voice,
      existing setup, takes, and project language.
- [ ] Include Cast Member profile/first image references for speaker-name hover
      previews in the context.
- [ ] List supported ElevenLabs models with tag-support metadata.
- [ ] Normalize draft settings through core.
- [ ] Validate `plainText` for all models and `v3Text` for Eleven v3.
- [ ] Validate Cast Voice ownership and ElevenLabs provider compatibility.
- [ ] Select provider text from `v3Text` for Eleven v3 and `plainText` for
      older ElevenLabs models.
- [ ] Build the ElevenLabs provider payload in core.
- [ ] Use the existing engines adapter and official ElevenLabs TypeScript client
      path for TTS execution; do not add REST calls.
- [ ] Estimate draft specs through engines.
- [ ] Generate takes through the shared media generation runner.
- [ ] Register generated audio outputs as Assets and Asset Files.
- [ ] Store immutable generation snapshots on the take row.
- [ ] Set the latest successful take as picked.
- [ ] Return structured diagnostics for all validation failures.
- [ ] Emit scene and dialogue-audio resource keys on mutations.

### Studio Server

- [ ] Add `packages/studio/server/http/scene-dialogue-audio-request.ts`.
- [ ] Add route tests for read, setup autosave, estimate, generate, pick,
      delete, and file serving.
- [ ] Add `GET /screenplay/scenes/:sceneId/dialogue-audio`.
- [ ] Add `PATCH /screenplay/scenes/:sceneId/dialogue-audio/:dialogueId/setup`
      for autosaved setup changes.
- [ ] Add estimate route with token-free read behavior if it does not mutate.
- [ ] Add generate route protected by `requireToken`.
- [ ] Add pick route protected by `requireToken`.
- [ ] Add delete route protected by `requireToken`.
- [ ] Add take file route with ownership verification.
- [ ] Decorate take asset files with HTTP URLs.
- [ ] Serialize structured errors consistently.

### Studio Browser Services

- [ ] Add `packages/studio/src/services/studio-scene-dialogue-audio-api.ts`.
- [ ] Add read context function.
- [ ] Add save setup function for autosaved dialogue audio settings and text.
- [ ] Add estimate draft function.
- [ ] Add generate take function.
- [ ] Add pick take function.
- [ ] Add delete take function.
- [ ] Add service tests for URL construction, request bodies, token headers, and
      structured error parsing.

### Narrative UI

- [ ] Extract `SceneNarrativeTab`.
- [ ] Extract `SceneDialogueCard`.
- [ ] Extract `SceneDialogueAudioPanel`.
- [ ] Extract Dialog, Takes, Advanced, and footer panel sections.
- [ ] Add selected dialogue state scoped to the Narrative tab.
- [ ] Add hover and selected treatment to dialogue cards.
- [ ] Add speaker-name hover profile preview when the Cast Member has a usable
      image.
- [ ] Use the speaker name as the panel-opening control.
- [ ] Keep full dialogue card clicks from opening the panel.
- [ ] Add hover/focus-only picked-take audio icon.
- [ ] Add picked-take playback and stop competing playback.
- [ ] Add Close icon button in the panel header row.
- [ ] Keep the panel inside the Narrative tab bounds.
- [ ] Use `Button`, `Tooltip`, `Select`, `Textarea`, `Slider`, `Switch`, and
      tab primitives only.
- [ ] Add missing voice id warning bar and disable blocked controls.
- [ ] Add Model selector with Eleven v3 default.
- [ ] Add older-model warning when the selected model is not Eleven v3.
- [ ] Add Voice selector with Cast Voice name labels and purpose tooltips.
- [ ] Add V3 tagged text editor with subtle `[tag]` highlighting for `v3Text`.
- [ ] Add plain text treatment for older models through `plainText`.
- [ ] Autosave setup edits through `useDebouncedAutosave`.
- [ ] Route autosave status through the details-header `SaveNotification` path.
- [ ] Add Takes list with play/pause, progress, and pick control.
- [ ] Add take deletion behavior that relies on the server-returned next pick.
- [ ] Add Advanced controls for supported ElevenLabs settings.
- [ ] Add fixed bottom estimate and Generate section at roughly 20% panel
      height.
- [ ] Ensure Generate creates exactly one take per click.
- [ ] Show blocking validation issues without inventing filler copy.
- [ ] Avoid raw filenames, asset ids, provider ids, and generated labels on
      visual surfaces.

### CLI And Agent Workflow

- [ ] Add a focused `generation dialogue-audio` command handler module.
- [ ] Add `plan --scene <scene-id>`.
- [ ] Add `generate --scene <scene-id> --dialogue <dialogue-id>`.
- [ ] Add `generate --scene <scene-id> --all`.
- [ ] Add `pick --scene <scene-id> --dialogue <dialogue-id> --take <take-id>`.
- [ ] Require approval token for live generation.
- [ ] Support simulation only through the shared media generation run path.
- [ ] Print JSON reports without raw audio bytes.
- [ ] Return structured CLI errors for unsupported paths and invalid inputs.
- [ ] Update agent-facing docs or skills so agents plan before generating.

### Tests

- [ ] Add core tests for dialogue ID allocation and preservation.
- [ ] Add core tests for Scene Dialogue Audio context.
- [ ] Add core tests that context includes Cast Member profile-image preview
      references when available.
- [ ] Add core validation tests for missing/invalid dialogue, voice, model,
      text, settings, and approval.
- [ ] Add core tests proving V3 uses `v3Text` and older models use
      `plainText`.
- [ ] Add core generate-take tests for run, asset, take, and pick creation.
- [ ] Add core pick/delete tests, including newest-take promotion.
- [ ] Add Studio server route tests.
- [ ] Add browser service tests.
- [ ] Add Scene Narrative UI tests for hover, selected, panel, tabs, editor,
      missing voice warning, older-model warning, autosave notification path,
      takes, estimate, and generate states.
- [ ] Add CLI tests for plan/generate/pick.
- [ ] Add architecture/static tests if needed to keep generation command handlers
      focused and prevent raw controls in feature code.

### Documentation And Final Verification

- [ ] Update `docs/architecture/reference/domain-vocabulary.md` with Scene
      Dialogue Audio and Scene Dialogue Audio Take if the terms are accepted.
- [ ] Update `docs/architecture/reference/media-generation.md` if the new media
      purpose should be documented there.
- [ ] Update any Renku Studio agent skills that generate scene media.
- [ ] Run focused package tests for core, CLI, and Studio.
- [ ] Run focused lint/check commands for touched packages.
- [ ] Start Studio and verify the desktop Narrative workflow manually.
- [ ] Verify no mobile-specific work was added or reported.
- [ ] Verify no raw HTML controls were added in feature code.
- [ ] Verify no new ElevenLabs REST TTS calls were added.
- [ ] Verify generated audio can be played from both the dialogue card hover icon
      and the Takes tab.
- [ ] Verify the picked take survives reload.
- [ ] Verify the CLI can generate dialogue audio for a scene using the same core
      contracts as Studio.

## Expected Outcome

After this plan is implemented, Scene Narrative becomes the place where spoken
dialogue audio is created and curated:

- each dialogue block is selectable;
- each dialogue has an editable speech setup;
- each dialogue can have multiple generated audio takes;
- one take is picked;
- picked audio can be played directly from the Narrative card;
- users can tune ElevenLabs settings without seeing raw provider internals;
- agents can generate dialogue audio for a scene through CLI using the same core
  contracts as Studio.
