# 0054 Cast Voice References And Assets

Status: planned
Date: 2026-06-08

## Summary

This plan adds first-class voice support for Cast Members without turning Studio
into a voice-casting browser.

The intended workflow is:

1. The user browses or creates a voice in the external ElevenLabs website.
2. The user gives Renku Studio the provider-specific voice id.
3. `casting-director` records that voice id, its ElevenLabs provider/model
   identity, a deliberate Renku reference name, a purpose, and an audio sample.
4. Studio shows the sample inside the Cast Member Assets tab and lets the user
   preview the first sample directly from the Details header.

The initial provider for voice generation is the direct `elevenlabs` provider in
`packages/engines`, not the fal.ai ElevenLabs wrappers. Renku must always store
the provider and model alongside a voice id because the same opaque id string is
not meaningful across providers or even across provider model families.

This plan also cleans up the current Cast Member UI:

- remove the placeholder Voice Design tab;
- rename Visual Content to Assets;
- remove the Visual Anchor section from Details;
- keep Details focused on narrative facts;
- move Arc and Voice Notes into the narrative facts area;
- show Character Sheets as named assets with purposes instead of one selected
  yellow-checkbox pick;
- add Voice Samples below Character Sheets with audio playback cards.

## Existing State

### Cast Facts

Current public Cast Member facts include narrative and voice-note text:

```ts
export interface CastMember {
  id: string;
  handle: string;
  name: string;
  role?: string;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}
```

These fields live in `cast_member`. There is no durable voice-id table and no
provider/model-specific Cast Voice object.

### Cast Design

Plan `0053` added Cast Design documents and kept voice casting notes under the
`casting-director` skill. The external skill source currently says:

```text
Voice sample generation is not first-class yet.
```

That statement becomes obsolete after this plan. Voice casting notes can still
live in Cast Design, but provider voice ids and sample audio assets must not be
stored in Cast Design JSON.

### Assets

Cast images are regular assets attached to a Cast Member through `cast_asset`.

Implemented cast roles are:

- `profile`
- `character_sheet`

The generic asset contract has `title` and `oneLineSummary`, but there is no
relationship-scoped reference name or purpose. This matters because a reusable
cast asset can have a local use that is more specific than the file or generated
asset title.

Examples:

- `campaign-armor-sheet` for a Character Sheet used when the character is in
  campaign armor;
- `older-urban-sheet` for a Character Sheet used for later scenes;
- `whispering-voice` for a voice id and sample used when a character speaks
  quietly.

Those names should be Renku reference names, not raw filenames or asset ids.

### Media Generation

Current media purposes are image/video oriented:

```text
lookbook.image
lookbook.sheet
cast.character-sheet
cast.profile
location.environment-sheet
scene.storyboard-sheet
shot.first-frame
shot.last-frame
shot.reference-image
shot.multi-shot-storyboard-sheet
shot.video-take
```

There is no cast audio purpose yet.

The engine catalog already has direct ElevenLabs audio models:

```text
elevenlabs/eleven_v3
elevenlabs/eleven_multilingual_v2
elevenlabs/eleven_turbo_v2_5
elevenlabs/music_v1
```

The TTS schema uses these provider fields:

- `text`
- `voice`
- `voice_settings`
- `output_format`
- `language_code`

The ElevenLabs adapter maps `voice` to the actual ElevenLabs voice id and calls
`elevenlabs.textToSpeech.convert`.

Important: there are also fal.ai and Wavespeed audio models that mention
ElevenLabs or voice ids. This plan must not use those wrappers for Cast Voice
sample generation.

### Studio UI

`packages/studio/src/features/movie-studio/cast/cast-member-panel.tsx` currently
shows three tabs:

- Details
- Visual Content
- Voice Design

The Voice Design tab is placeholder copy. The Visual Content tab shows Profile
Images and Character Sheets. Character Sheet cards still show the yellow select
checkbox through `ImageSelectionControl`.

The Details tab currently has a Visual Anchor section that repeats the selected
Character Sheet. This is not working well for narrative reading because the
Character Sheet is visual asset content, not the Cast Member's narrative arc.

## Problems To Solve

### Voice IDs Are Provider/Model-Specific

ElevenLabs voice ids are opaque provider ids. A future OpenAI, Minimax, Kling,
or local voice provider may also have a field called `voice_id`, but that does
not mean the ids are interchangeable.

Renku must store the tuple:

```text
provider + model + voice id
```

The voice id alone must never be treated as a global voice identity.

### One Cast Member Can Need Several Voices

One Cast Member can need multiple voice ids or samples for different delivery
purposes:

- normal speech;
- whispering;
- shouting;
- old age;
- localized narration;
- stylized announcement voice.

The data model must support multiple named Cast Voices per Cast Member. A single
global Cast Member `voiceId` field would be wrong.

### Audio Samples Are Assets, But Cast Voice Is More Than An Asset

A sample file is an audio Asset. The voice id, provider, model, Renku reference
name, and purpose are Cast Voice metadata.

Those concepts should be connected, but not collapsed into one generic asset
title. The audio sample can be played in the UI. The Cast Voice record explains
what provider voice that sample represents and when to use it.

### Character Sheets Need Names And Purposes

Character Sheets are no longer a single visual anchor. A Cast Member can have
many sheets for wardrobe, age, state, or historical moment.

The Assets tab needs enough metadata to show a card footer:

```text
Campaign Armor
Use for battlefield scenes after the Ottoman camp sequence.
```

The footer must not show raw filenames, asset ids, or kebab-case labels.

### The Details Tab Is Doing Too Much

Details should be narrative:

- role;
- age;
- want;
- need;
- arc;
- voice notes;
- description.

Character Sheets and Voice Samples belong in Assets.

## Goals

1. Add a durable Cast Voice data model with reference name, provider, model,
   voice id, purpose, and sample asset.
2. Store provider and model alongside every provider voice id.
3. Add relationship-scoped asset reference names and purposes so Character Sheet
   cards can show useful footer copy.
4. Add a `cast.voice-sample` generation purpose that uses the direct
   `elevenlabs` provider only.
5. Add a CLI path for `casting-director` to attach a voice id and audio sample
   to a Cast Member.
6. Update `casting-director` skill docs so the agent knows how to attach voice
   ids and samples.
7. Update `media-producer` skill docs so the agent can generate a sample through
   ElevenLabs when the user wants Renku to generate one.
8. Rename the Cast Member Visual Content tab to Assets.
9. Remove the placeholder Voice Design tab.
10. Remove the Details tab Visual Anchor section.
11. Move Arc and Voice Notes under the existing narrative facts.
12. Show Character Sheets as smaller named cards with purposes and no yellow
    select checkbox.
13. Add Voice Samples under Character Sheets with audio card playback,
    progress, and hover delete confirmation.
14. Add a Details-header audio icon that plays the first available voice sample.

## Non-Goals

- Do not build an ElevenLabs voice browser inside Studio.
- Do not call ElevenLabs to list the user's voices.
- Do not validate a voice id by making a network call during attach.
- Do not add full voice-casting design UI.
- Do not add a voice design tab under another name.
- Do not move provider voice ids into Cast Design JSON.
- Do not add dubbing, localization, lip-sync, narration assembly, or full
  dialogue generation workflows.
- Do not use fal.ai or Wavespeed ElevenLabs wrapper models for Cast Voice
  samples.
- Do not preserve old UI names such as Visual Content or Voice Design after this
  slice ships.
- Do not add compatibility aliases for old command names or import shapes.

## Product Terms

### Cast Voice

A **Cast Voice** is a Cast Member-owned provider voice reference.

It stores:

- a Renku reference name, such as `normal-voice`;
- provider, such as `elevenlabs`;
- model, such as `eleven_v3`;
- provider voice id, such as an ElevenLabs voice id;
- purpose, such as "Default spoken dialogue and quiet technical explanation";
- a linked audio sample Asset.

### Cast Voice Sample

A **Cast Voice Sample** is the audio Asset linked to a Cast Voice. It is attached
to the Cast Member with role `voice_sample`, stored under
`cast/<handle>/voice-samples/`, and rendered as an audio card in Studio.

### Reference Name

A **reference name** is a stable Renku-local name for an asset or voice. It uses
slug-like lower-case text in persisted JSON and database rows, such as:

```text
normal-voice
whispering-voice
campaign-armor-sheet
older-urban-sheet
```

Studio humanizes reference names for card footers:

```text
normal-voice -> Normal Voice
whispering_voice -> Whispering Voice
```

The persisted reference name is still the source of truth. The humanized label is
display formatting only.

## Data Model

### Asset Relationship Metadata

Add relationship-scoped metadata columns to the asset relationship tables:

```text
reference_name text
purpose text
```

Tables:

- `project_asset`
- `cast_asset`
- `location_asset`
- `sequence_asset`
- `scene_asset`

The public `Asset` contract should include:

```ts
export interface Asset {
  assetId: string;
  relationshipId: string;
  target: AssetTarget;
  localeId: string | null;
  type: string;
  selection: AssetSelection;
  availability: AssetAvailability;
  mediaKind: string;
  title: string;
  oneLineSummary: string | null;
  origin: string;
  role: string;
  referenceName: string | null;
  purpose: string | null;
  sortOrder: number;
  files: AssetFile[];
  createdAt: string;
  updatedAt: string;
}
```

Why relationship-scoped:

- the same Asset can theoretically be attached to different targets with
  different local purposes;
- the local card footer belongs to the Cast Member relationship, not just the
  file;
- it keeps file names, generated titles, and card labels from being confused.

For this slice, `referenceName` and `purpose` are required for new
`cast.character-sheet` imports and Cast Voice samples. They may be null for
older assets or other roles. UI must stay quiet when either value is missing
rather than inventing fallback copy from filenames or ids.

### Cast Voice Table

Add a new table:

```text
cast_voice
  id text primary key
  cast_member_id text not null references cast_member(id)
  name text not null
  provider text not null
  model text not null
  voice_id text not null
  purpose text not null
  sample_asset_id text not null references asset(id)
  sort_order integer not null
  created_at text not null
  updated_at text not null
```

Indexes:

```text
cast_voice_cast_order_idx on cast_voice(cast_member_id, sort_order, id)
cast_voice_provider_model_voice_idx on cast_voice(provider, model, voice_id)
cast_voice_sample_asset_idx unique on cast_voice(sample_asset_id)
cast_voice_cast_name_idx unique on cast_voice(cast_member_id, name)
```

Rules:

- `name` is the Cast Voice reference name.
- `name` must be unique per Cast Member.
- `provider` and `model` must be stored exactly as provider/model catalog ids.
- `voice_id` is trimmed but otherwise kept as provided by the user.
- `purpose` is required and should explain when this voice should be used.
- `sample_asset_id` must point to an audio Asset attached to the same Cast
  Member with role `voice_sample`.
- A sample Asset can belong to only one Cast Voice.

### Entity IDs

Add an `EntityIdPrefix`:

```ts
| 'cast_voice'
```

Generated ids should look like:

```text
cast_voice_abcd2345
```

### File Storage

Cast Voice sample files should be copied into:

```text
cast/<cast-handle>/voice-samples/
```

The import path allocator should avoid collisions the same way cast image import
does.

Accepted sample media:

- `audio/mpeg` / `.mp3`
- `audio/wav` / `.wav`
- `audio/x-wav` / `.wav`
- `audio/mp4` / `.m4a` when the browser can play it

The first implementation does not need to calculate duration before import.
Studio can read duration from the browser audio element metadata. If duration is
available from a generation receipt or future media probe, store it on
`asset_file.duration_seconds`.

### Deletion

Deleting a Cast Voice should:

1. stop playback in Studio if the deleted sample is currently playing;
2. delete the `cast_voice` row;
3. delete the linked `cast_asset` relationship;
4. delete the linked `asset_file` row and sample file when no other Asset owns
   it;
5. delete the linked `asset` row when it has no remaining owner relationships;
6. emit the same cast asset and surface resource keys used by cast asset
   mutations.

Deleting the underlying sample asset through generic asset deletion should fail
with a structured error when a `cast_voice` row references it:

```text
Remove the Cast Voice first.
```

This prevents dangling voice metadata.

### Drizzle Migration

This is a runtime-read schema change because Cast Member resources and Cast
Voice commands will query `cast_voice` directly. The implementation must:

1. edit the Drizzle schema source in `packages/core/src/server/schema`;
2. generate SQL through Drizzle Kit from `packages/core`;
3. increment the project store schema generation from `14` to `15`;
4. add `PRAGMA user_version = 15;` to the migration;
5. update migration tests that assert the current generation;
6. apply the migration to development sample projects with
   `renku project migrate <projectName>`.

Do not hand-write TypeScript migration registries or copy generated SQL into
runtime code.

## Core Contracts

### Public Types

Add:

```ts
export interface CastVoice {
  id: string;
  castMemberId: string;
  name: string;
  provider: string;
  model: string;
  voiceId: string;
  purpose: string;
  sample: Asset;
  createdAt: string;
  updatedAt: string;
}
```

Add to `CastMemberResource`:

```ts
export interface CastMemberResource {
  castMember: CastMember;
  firstImage?: ScreenplayImageReference;
  voices: CastVoice[];
}
```

The resource should return Cast Voices sorted by `sortOrder`, then `name`, then
id. Only audio sample files should be included in `CastVoice.sample.files`.

### Cast Voice Attachment Document

Add a JSON document for agent-friendly attachment:

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

Validation rules:

- `kind` must be exactly `castVoiceAttachment`.
- `castMemberId` must reference an existing Cast Member.
- `name` must be a valid reference name:
  lower-case letters/numbers with single hyphen separators.
- `name` must be unique for the Cast Member.
- `provider` must be `elevenlabs` for this slice.
- `model` must be a direct ElevenLabs text-to-speech model in the engine
  catalog.
- `model` must not be `music_v1`.
- `voiceId` must be trimmed and non-empty.
- `purpose` must be trimmed and non-empty.
- `sample.sourceProjectRelativePath` must be project-relative and inside the
  project folder.
- the sample source file must exist and must be an audio file by extension or
  MIME detection.
- if a generation receipt is provided, its provider/model/mediaKind must match
  `provider`, `model`, and `audio`.

Unknown fields in this attachment document should be warnings only when this
document is treated as import-like agent input. They must not create schema
fields.

### Core Commands

Add focused core command modules rather than expanding existing large command
files:

```text
packages/core/src/server/commands/cast-voice-commands.ts
packages/core/src/server/database/access/cast-voices.ts
```

Service methods:

```ts
listCastVoices(input)
readCastVoice(input)
validateCastVoiceAttachment(input)
attachCastVoice(input)
removeCastVoice(input)
```

Reports:

```ts
CastVoiceListReport
CastVoiceReadReport
CastVoiceValidationReport
CastVoiceAttachmentReport
CastVoiceRemoveReport
```

Attachment should return:

- `valid`;
- `warnings`;
- `castMember`;
- `voice`;
- `changes`;
- `resourceKeys`.

### Structured Diagnostics

Use `ProjectDataError` and `@gorenku/studio-diagnostics`.

Reserve a focused code range:

```text
PROJECT_DATA340...PROJECT_DATA359 for Cast Voice validation/access/import
CLI120...CLI129 for Cast Voice command errors
```

Required failure cases:

- missing Cast Member;
- duplicate Cast Voice name;
- unsupported provider;
- unsupported model;
- missing voice id;
- missing purpose;
- missing sample file;
- sample file outside project;
- sample file is not audio;
- receipt provider/model mismatch;
- sample asset already belongs to another Cast Voice;
- attempt to delete a sample asset while a Cast Voice references it.

## ElevenLabs Voice Sample Generation

### Purpose Key

Add:

```ts
export const CAST_VOICE_SAMPLE_GENERATION_PURPOSE =
  'cast.voice-sample' as const;
```

Add it to `MediaGenerationPurpose`.

### Context

`renku generation context --purpose cast.voice-sample --target cast:<id> --json`
returns:

- purpose and target;
- project title and languages;
- Cast Member facts;
- active Cast Design summary when present;
- existing Cast Voices;
- existing Voice Sample assets;
- defaults:
  - modelChoice: `elevenlabs/eleven_v3`;
  - outputFormat: `mp3_44100_128`;
  - languageCode: base project locale language when obvious, otherwise null.

The context must not invent a voice id. The user or agent supplies it from the
external ElevenLabs site. The generation spec must carry explicit sample text;
core should not invent spoken lines for the Cast Member.

### Model List

`renku generation model list --purpose cast.voice-sample --target cast:<id> --json`
must return direct ElevenLabs TTS models only:

```text
elevenlabs/eleven_v3
elevenlabs/eleven_multilingual_v2
elevenlabs/eleven_turbo_v2_5
```

It must not return:

- `elevenlabs/music_v1`;
- any `fal-ai/*elevenlabs*` audio model;
- any `wavespeed-ai/*elevenlabs*` audio model.

### Spec

Add:

```ts
export type CastVoiceSampleModelChoice =
  | 'elevenlabs/eleven_v3'
  | 'elevenlabs/eleven_multilingual_v2'
  | 'elevenlabs/eleven_turbo_v2_5';

export interface CastVoiceSampleGenerationSpec {
  purpose: typeof CAST_VOICE_SAMPLE_GENERATION_PURPOSE;
  target: CastMediaGenerationTarget;
  modelChoice: CastVoiceSampleModelChoice;
  voiceId: string;
  text: string;
  referenceName: string;
  referencePurpose: string;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
    useSpeakerBoost?: boolean;
  };
  outputFormat?: string;
  languageCode?: string | null;
  title?: string;
}
```

Provider payload mapping:

```text
text -> text
voiceId -> voice
voiceSettings.stability -> voice_settings.stability
voiceSettings.similarityBoost -> voice_settings.similarity_boost
voiceSettings.style -> voice_settings.style
voiceSettings.speed -> voice_settings.speed
voiceSettings.useSpeakerBoost -> voice_settings.use_speaker_boost
outputFormat -> output_format
languageCode -> language_code
```

The generation policy should be:

```ts
{
  provider: 'elevenlabs',
  model: parsedModel,
  mediaKind: 'audio',
  mode: 'text-to-speech',
  outputCount: 1
}
```

The generation request should use `parameters`, not `prompt`, because the
ElevenLabs schema requires `text` rather than `prompt`.

### Import/Attach Relationship

Generation creates an output file. It does not automatically create a Cast
Voice.

After the user accepts the sample, `casting-director` should run
`renku cast voice attach --file <cast-voice-attachment-json> --json` using the
generated output path, provider/model, voice id, reference name, and purpose.

This keeps the provider generation path and the Cast Voice metadata mutation
separate while still giving agents a clear workflow.

## CLI

### Cast Voice Commands

Add:

```bash
renku cast voice list --cast <cast-member-id> --json
renku cast voice show --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
renku cast voice validate --file <cast-voice-attachment-json> --json
renku cast voice attach --file <cast-voice-attachment-json> --json
renku cast voice remove --cast <cast-member-id> --voice <cast-voice-id-or-name> --json
```

Do not add aliases such as `voice add` and `voice create` in the same slice. The
canonical mutation verb is `attach` because the command attaches an external
provider voice id and sample asset to a Cast Member.

### Media Import Flags

Add relationship metadata support to existing asset import/register paths:

```bash
--reference-name <name>
--reference-purpose <purpose>
```

For `renku media import --purpose cast.character-sheet`, these flags are
required.

For `renku asset register`, these flags are optional for most roles but should
be persisted when provided.

The command must not use `--purpose` for the asset's local purpose because
`--purpose` already means Media Purpose Key.

### Generation Commands

Add the new purpose to the existing generation command registry:

```bash
renku generation context --purpose cast.voice-sample --target cast:<cast-member-id> --json
renku generation model list --purpose cast.voice-sample --target cast:<cast-member-id> --json
renku generation spec validate --file <cast-voice-sample-spec-json> --json
renku generation spec create --file <cast-voice-sample-spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --simulate --json
```

The handler should be registered through the shared media generation purpose
registry, not through new nested purpose branches in CLI command files.

## Studio Server

Add Cast Voice routes under the existing project route:

```text
GET    /studio-api/projects/:projectName/cast/:castMemberId/voices
GET    /studio-api/projects/:projectName/cast/:castMemberId/voices/:voiceId
DELETE /studio-api/projects/:projectName/cast/:castMemberId/voices/:voiceId
```

The DELETE route requires the Studio token and uses the core `removeCastVoice`
command.

The existing cast asset file route remains the way to serve sample bytes:

```text
GET /studio-api/projects/:projectName/cast/:castMemberId/assets/:assetId/files/:assetFileId
```

No separate audio-byte route is needed.

## Studio UI

### Tab Changes

Update `CastMemberPanel`:

- tabs become `Details` and `Assets`;
- remove `Voice Design`;
- rename `CastMemberVisualContentTab` to `CastMemberAssetsTab`;
- update tests and any route/resource assumptions that refer to `visual`.

### Details Tab

Keep the profile image and narrative header, but remove:

- Visual Anchor section;
- Character Sheet feature image from Details.

Move these fields into the narrative facts grid below Want and Need:

- Arc;
- Voice Notes.

If a field is absent, omit it. Do not add placeholder copy.

### Header Voice Preview

When the Cast Member has at least one Cast Voice with a ready audio sample:

- show a small icon button to the right of the Cast Member name;
- use a local shadcn `Button`, not a raw button;
- use a lucide icon such as `Volume2`, `PlayCircle`, or `AudioLines`;
- align the button to the title baseline so it reads as an action attached to
  the name, not as a floating toolbar;
- on click, play the first sample by Cast Voice sort order;
- if playback is active, clicking again stops or pauses it;
- include a tooltip and accessible label such as `Play Urban voice sample`.

The title row should wrap cleanly on narrower desktop widths. Renku Studio is
desktop-first, so mobile-specific behavior is out of scope.

### Assets Tab Layout

Order:

1. Profile Images
2. Character Sheets
3. Voice Samples

Profile Images can keep the current select behavior because one profile image
still works as a compact avatar.

Character Sheets:

- keep the image-card grid;
- reduce the card minimum size by roughly 20 percent, from the current
  `minmax(480px, 1fr)` to about `minmax(384px, 1fr)`;
- keep `object-contain`;
- show footer title from `asset.referenceName`, humanized;
- show footer purpose from `asset.purpose`;
- remove `ImageSelectionControl` for role `character_sheet`;
- keep the hover delete action and `DeleteConfirmDialog`.

If a Character Sheet lacks `referenceName` and `purpose`, show no invented
footer copy. Do not fall back to raw filenames, ids, or kebab-case strings.

Voice Samples:

- render one card per Cast Voice;
- show the humanized Cast Voice `name` in the footer;
- show Cast Voice `purpose` under it;
- card click toggles playback;
- show a left-side play/pause or start/stop button;
- show a progress bar that updates during playback;
- do not use native `<audio controls>`;
- use a hidden or unmanaged `<audio>` element through React refs;
- use shadcn `Button`, `Tooltip`, and `DeleteConfirmDialog`;
- delete button appears in the upper-right on hover/focus, consistent with
  image cards;
- deleting a sample removes the Cast Voice, not only the asset.

The progress bar can be a non-interactive div with `role="progressbar"` for
this slice. Seeking can be added later if needed.

### Shared UI Components

Do not put audio-specific behavior into `ImageOverlayCard`.

Add a feature-local component first:

```text
packages/studio/src/features/movie-studio/cast/cast-voice-sample-card.tsx
```

If the same pattern is later needed for scene narration, dubbed audio, or
production audio, promote a domain-neutral audio card to `packages/studio/src/ui`
then.

## Skills

Update the external Studio Skills source:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

### casting-director

Update:

```text
casting-director/SKILL.md
casting-director/references/voice-casting.md
casting-director/references/cast-media-handoff.md
```

Add:

```text
casting-director/references/cast-voice-attachments.md
casting-director/samples/cast-voice-attachment.json
```

New guidance:

- voice casting notes remain in Cast Design;
- provider voice ids and audio samples are Cast Voices, not Cast Design JSON;
- user picks or creates voice ids in ElevenLabs externally;
- attach voice ids with `renku cast voice attach`;
- always provide `name`, `provider`, `model`, `voiceId`, `purpose`, and sample;
- use `elevenlabs` provider model ids, not fal.ai ids;
- after attachment, run `renku cast voice list --cast <id> --json` to verify.

### media-producer

Add:

```text
media-producer/references/cast-voice-sample.md
media-producer/samples/cast-voice-sample-spec.json
```

New guidance:

- use `cast.voice-sample` only when the user wants Renku to generate a sample;
- model choices must come from `renku generation model list`;
- do not override the user-provided voice id;
- estimate before paid ElevenLabs generation;
- request network approval before live generation;
- inspect or play the generated sample before asking `casting-director` to
  attach it;
- hand the generated output path, provider, model, voice id, reference name, and
  purpose back to `casting-director`.

## Documentation Updates

Update:

- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/cli/commands.md`

Add or update an ADR if reviewers accept Cast Voice as durable project data
rather than a Cast Design subfield.

## Risks And Mitigations

### Voice IDs Become Global By Accident

Risk:

Future code may pass around `voiceId` without provider/model.

Mitigation:

- make Cast Voice the public contract;
- keep provider/model required;
- test that attach fails without provider/model;
- avoid helper functions that accept only `voiceId` at package boundaries.

### The UI Invents Meaning From Filenames

Risk:

Character Sheet and Voice Sample cards may fall back to filenames when metadata
is missing.

Mitigation:

- require `referenceName` and `purpose` for new Character Sheet imports;
- require `name` and `purpose` for Cast Voice attachments;
- render quiet cards when legacy metadata is absent;
- add Studio tests that filenames and asset ids are not shown.

### Character Sheet Selection Disappears Too Early

Risk:

Current generation flows may expect one selected Character Sheet.

Mitigation:

- remove the UI checkbox for Character Sheets;
- keep explicit `sourceAssetId` requirements for flows that need a specific
  sheet;
- update context payloads so agents see all named Character Sheets and their
  purposes;
- do not silently choose a sheet for profile edit or shot-video dependencies
  when an explicit source is required.

### Voice Generation Expands Into Dubbing

Risk:

Adding one audio sample purpose could pull in full speech production.

Mitigation:

- keep this purpose scoped to Cast Voice samples;
- do not add scene dialogue, narration, dubbing, or localization generation in
  this plan;
- keep future speech generation as a separate plan with its own target model.

### Audio UI Uses Native Browser Controls

Risk:

Feature code may add `<audio controls>` or raw controls, violating the Studio UI
rule.

Mitigation:

- use a hidden/uncontrolled audio element and shadcn buttons;
- add tests or static checks where practical;
- review feature code for raw interactive controls before merge.

## Completion Checklist

### Review Area

- [x] Confirm the durable product term is Cast Voice.
- [x] Confirm Cast Voice records are Cast Member-owned, not Cast Design JSON.
- [x] Confirm the canonical sample role is `voice_sample`.
- [x] Confirm `cast.voice-sample` is the right media purpose key.
- [x] Confirm direct ElevenLabs provider models are required for this slice.
- [x] Confirm fal.ai and Wavespeed ElevenLabs wrapper models are intentionally
      excluded.
- [x] Confirm `renku cast voice attach` is the canonical attachment mutation.
- [x] Confirm Character Sheets no longer use a global select checkbox in the
      Cast Assets UI.
- [x] Confirm Profile Images keep select behavior for the compact avatar.

### Architecture And Contracts

- [x] Define `CastVoice` public contract.
- [x] Add `voices` to `CastMemberResource`.
- [x] Add `referenceName` and `purpose` to the public `Asset` contract.
- [x] Define `castVoiceAttachment` JSON Schema.
- [x] Define `CastVoiceSampleGenerationSpec`.
- [x] Define `CastVoiceSampleGenerationContext`.
- [x] Define `CastVoiceSampleModelChoiceReport`.
- [x] Define Cast Voice list/read/validation/attachment/remove reports.
- [x] Define structured diagnostic codes for Cast Voice validation and deletion.
- [x] Confirm generated sample attachments accept receipts and external sample
      attachments may omit receipts.
- [x] Define sample file MIME/extension validation.
- [x] Define resource keys emitted by Cast Voice mutations.

### Database And Migrations

- [x] Add `reference_name` to asset relationship Drizzle tables.
- [x] Add `purpose` to asset relationship Drizzle tables.
- [x] Add `cast_voice` Drizzle table.
- [x] Add `cast_voice` indexes and uniqueness constraints.
- [x] Add `cast_voice` to `packages/core/src/server/schema/index.ts`.
- [x] Add `cast_voice` to entity id prefixes.
- [x] Generate the SQL migration with Drizzle Kit from `packages/core`.
- [x] Increment project store schema generation to `15`.
- [x] Add `PRAGMA user_version = 15;` to the migration.
- [x] Update migration tests that assert current user version.
- [x] Apply migration to development sample projects.

### Core Implementation

- [x] Add `packages/core/src/server/database/access/cast-voices.ts`.
- [x] Add list/read helpers for Cast Voices.
- [x] Add sample asset relationship verification.
- [x] Add Cast Voice attachment validation.
- [x] Add Cast Voice sample file copy/path allocation.
- [x] Add Cast Voice attachment command.
- [x] Add Cast Voice removal command.
- [x] Prevent generic asset deletion when a Cast Voice references the sample.
- [x] Add relationship metadata persistence to `registerAsset`.
- [x] Add relationship metadata persistence to cast media import paths.
- [x] Require reference metadata for `cast.character-sheet` imports.
- [x] Update `listAssetRelationshipPage` to return relationship metadata.
- [x] Update cast resources to include Cast Voices.
- [x] Update cast image contexts to expose Character Sheet reference names and
      purposes.
- [x] Remove hidden reliance on selected Character Sheets where an explicit
      source asset is required.

### ElevenLabs Generation Purpose

- [x] Add `CAST_VOICE_SAMPLE_GENERATION_PURPOSE`.
- [x] Add `CastVoiceSampleGenerationSpec` to `MediaGenerationSpec`.
- [x] Add context builder for `cast.voice-sample`.
- [x] Add model list builder returning only direct ElevenLabs TTS models.
- [x] Add provider/model parser for `elevenlabs/<model>`.
- [x] Add validation for sample text, voice id, output format, language code,
      reference name, and reference purpose.
- [x] Map provider payload to ElevenLabs schema fields.
- [x] Set generation policy to direct `elevenlabs`.
- [x] Set media kind to `audio`.
- [x] Set mode to `text-to-speech`.
- [x] Add output name generation for mp3 samples.
- [x] Add estimate and run coverage through shared generation service.
- [x] Add tests proving fal.ai and Wavespeed wrappers are excluded.

### CLI

- [x] Add `renku cast voice list`.
- [x] Add `renku cast voice show`.
- [x] Add `renku cast voice validate`.
- [x] Add `renku cast voice attach`.
- [x] Add `renku cast voice remove`.
- [x] Keep the cast command entry point reviewable by dispatching nested voice
      commands through focused handlers.
- [x] Add `--reference-name` to asset register/media import flags.
- [x] Add `--reference-purpose` to asset register/media import flags.
- [x] Require `--reference-name` and `--reference-purpose` for
      `cast.character-sheet` media import.
- [x] Add `cast.voice-sample` to generation context/model/spec command
      registries.
- [x] Update CLI unsupported-purpose suggestions.
- [x] Add CLI JSON output tests for Cast Voice commands.
- [x] Add CLI tests for missing provider, model, voice id, name, purpose, and
      sample.

### Studio Server

- [x] Add Cast Voice list route.
- [x] Add Cast Voice read route.
- [x] Add Cast Voice delete route with token requirement.
- [x] Return structured HTTP errors for Cast Voice failures.
- [x] Confirm existing cast asset file route serves sample audio.
- [x] Emit Studio coordination events after Cast Voice removal.

### Studio UI

- [x] Rename `CastMemberVisualContentTab` to `CastMemberAssetsTab`.
- [x] Remove the Voice Design tab.
- [x] Rename tab label from Visual Content to Assets.
- [x] Remove Details Visual Anchor section.
- [x] Remove Character Sheet image from Details.
- [x] Move Arc into the Details narrative facts grid.
- [x] Move Voice Notes into the Details narrative facts grid.
- [x] Add Details header voice sample icon button.
- [x] Align the icon button with the Cast Member name.
- [x] Play the first available voice sample from the Details header.
- [x] Stop header playback cleanly when the Cast Member changes.
- [x] Reduce Character Sheet card minimum width by about 20 percent.
- [x] Add Character Sheet footer name and purpose.
- [x] Remove Character Sheet yellow selection checkbox.
- [x] Keep Character Sheet hover delete confirmation.
- [x] Add Voice Samples section below Character Sheets.
- [x] Add feature-local `cast-voice-sample-card.tsx`.
- [x] Implement audio play/pause or start/stop button with shadcn `Button`.
- [x] Implement progress bar without native audio controls.
- [x] Add Voice Sample footer name and purpose.
- [x] Add Voice Sample hover delete confirmation.
- [x] Ensure cards do not show filenames, asset ids, or raw kebab-case labels.
- [x] Ensure feature code uses local shadcn primitives for interactive controls.

### Skill Updates

- [x] Update `casting-director/SKILL.md`.
- [x] Update `casting-director/references/voice-casting.md`.
- [x] Update `casting-director/references/cast-media-handoff.md`.
- [x] Add `casting-director/references/cast-voice-attachments.md`.
- [x] Add a `cast-voice-attachment.json` sample.
- [x] Update `media-producer/SKILL.md` if it references current media purposes.
- [x] Add `media-producer/references/cast-voice-sample.md`.
- [x] Add a `cast-voice-sample-spec.json` sample.
- [x] Validate the updated skills with the Studio Skills validation workflow.
- [x] Update any skill index/manifest required by the external Studio Skills
      project.

### Documentation

- [x] Update domain vocabulary with Cast Voice and Cast Voice Sample.
- [x] Update data model/storage documentation.
- [x] Update project files/assets documentation with `cast/<handle>/voice-samples/`.
- [x] Update media-generation documentation with `cast.voice-sample`.
- [x] Update Studio skills architecture documentation.
- [x] Update CLI command documentation.
- [x] Add an ADR if Cast Voice is accepted as durable project data.

### Tests

- [x] Add core tests for Cast Voice attachment validation.
- [x] Add core tests for duplicate Cast Voice names.
- [x] Add core tests for provider/model validation.
- [x] Add core tests for generated receipt provider/model mismatch.
- [x] Add core tests for sample asset deletion protection.
- [x] Add core tests for Cast Voice removal deleting the linked sample asset.
- [x] Add core tests for relationship reference metadata projection.
- [x] Add media generation tests for ElevenLabs provider payload mapping.
- [x] Add media generation tests for `cast.voice-sample` estimate and simulate
      run.
- [x] Add CLI tests for `renku cast voice`.
- [x] Add CLI tests for required Character Sheet reference metadata.
- [x] Add Studio tests for Details tab narrative layout.
- [x] Add Studio tests for Assets tab label and removed Voice Design tab.
- [x] Add Studio tests for Character Sheet footer rendering.
- [x] Add Studio tests proving Character Sheet selection control is absent.
- [x] Add Studio tests for Voice Sample card playback state.
- [x] Add Studio tests for hover delete controls.
- [x] Add Studio tests proving filenames and ids are not rendered as card copy.

### Final Verification

- [x] Run focused core tests.
- [x] Run focused CLI tests.
- [x] Run focused Studio tests.
- [x] Run `pnpm build:core`.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm --filter @gorenku/studio test`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm check`.
- [x] Open the Urban Basilica Cast Member page on desktop.
- [x] Confirm Details shows narrative facts and no Visual Anchor section.
- [x] Confirm the header audio icon appears only when a sample exists.
- [x] Confirm Assets has Profile Images, Character Sheets, and Voice Samples.
- [x] Confirm Character Sheets are smaller and have no yellow checkbox.
- [x] Confirm Voice Sample cards play, stop, and update progress.
- [x] Confirm deleting a Voice Sample removes the Cast Voice and refreshes the
      UI.
- [x] Confirm no raw HTML form or interactive controls were added to feature
      code.
- [x] Confirm no compatibility aliases, wrapper commands, re-export stubs, or
      direct SQLite writes were added.
