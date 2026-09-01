# 0194 Shot Plan Dialogue Audio And Seed Audio

Status: implemented
Date: 2026-08-31

## Review Attention

- Replace the current Scene/Dialogue-Turn-owned audio system with one
  Shot-Plan-owned **Dialogue Audio Take** system. The public purpose becomes
  `shot-plan.dialogue-audio`; `scene.dialogue-audio`, its saved setup document,
  its `dialogue-audio show/setup` CLI commands, the Narrative audio side panel,
  and the `scene_dialogue_audio*` tables are deleted in the same cutover. There
  is no compatibility alias or runtime reader for the removed model.
- Keep `cast.voice-sample` as the existing Cast Voice Sample purpose rather than
  introduce a duplicate purpose. Make the Cast Voice Core contract genuinely
  provider-neutral: it owns the playable sample Asset, default selection, and
  one opaque `voiceIdentity` JSON value only. Provider Skills own that value's
  shape and interpretation. Core owns no provider/model/capability union,
  provider registration, provider sample fetcher, or provider compatibility
  rule.
- Add Fal.ai as an Audio provider choice in Project Settings version 6. The
  Project setting supplies only the default provider shown in each Codex
  configuration component. Model, Cast Voice, and model-specific controls are
  transient choices for that one generation and never update Project Settings.
- Store a Dialogue Audio Take's consecutive inclusive turn range as two plain
  integers. Do **not** store Dialogue Turn ids, speaker links, a screenplay
  revision, range membership rows, or staleness metadata. Do not reject or
  repair a Take after screenplay changes. The user can play a stale Take and
  delete it.
- Keep provider and model strings only in the Take Asset's existing exact,
  provider-opaque generation provenance envelope. Core does not interpret or
  allowlist them. Do not duplicate them as new Take columns. The Take row stores
  only the Shot Plan relationship, Asset/File identities, inclusive turn range,
  multi-selection state, and lifecycle timestamps.
- Dialogue Audio selection is intentionally multi-select. A Shot Plan may have
  any number of selected Takes, including overlapping ranges. Core and Studio
  add no overlap, completeness, or “one Take per turn” rule. Generation Context
  reports every Take, its range, and its selected state so the agent can pass the
  selected exact audio files to a capable video route.
- The chosen Studio design is the approved third card direction revised on
  2026-08-31: **Shots / Assets / Audio**, full-width audio cards, turn or turn
  range, selected Cast Profile portraits, waveform playback, provider/model,
  generated date, normal Media Card selection control, and hover-only Trash.
  It contains no dialogue transcript, character names, right action column,
  duplicate duration, link action, section heading/subtitle, or New Take button.
- Cast portraits come only from the current selected Cast Profile. Missing
  profiles render an empty portrait cell. The card derives speakers from the
  current Scene turns at the stored numbers, de-duplicates them in first-
  appearance order, shows up to four cells, and for more than four shows the
  first three plus `+N speakers`. This is presentation only and creates no Take
  relationship to Cast Members or profiles.
- Seed Audio requests stop for user intervention rather than invent continuity:
  more than three distinct reference voices, more than 2,048 prompt characters,
  or a request likely to exceed the model's two-minute output limit requires the
  user to narrow or split the consecutive turn range. There is no text-only
  substitute for a missing reference voice.
- Generate a Drizzle Kit migration and advance project-store schema generation
  from 66 to 67. The migration deletes the old Scene Dialogue Audio schema,
  creates the new Take/default-voice schema, replaces typed Cast Voice provider
  registrations and provider-specific sample-source columns with opaque voice
  identity, upgrades Project Settings v5 to v6, and performs the exact one-time
  Urban Basilica reassignment below. It moves database ownership/context, not
  bytes: the five registered legacy files stay at their current safe
  Project-relative paths; newly attached Takes use the new Shot Plan audio
  destination.
- Exact Urban Basilica migration:
  - Narrator turn 1 Take `scene_dialogue_audio_take_x9j47jps` moves to Shot Plan
    1, `shot_plan_bm34r9be`.
  - Mara turn 2 Takes `scene_dialogue_audio_take_jrudpeny` and
    `scene_dialogue_audio_take_gm7cnaxq`, Urban turn 3 Take
    `scene_dialogue_audio_take_axxxsn8z`, and Mehmed II turn 4 Take
    `scene_dialogue_audio_take_4kznq7a8` move to Shot Plan 2,
    `shot_plan_sp24knrj`.
  - All five remain unselected, preserve their current Assets, Asset Files, exact
    provenance, timestamps, and playable media, and receive no speaker or turn-id
    associations.
- Existing ElevenLabs voice ids and downloaded samples remain usable, but the
  current ElevenLabs-specific Core residue is removed. The ElevenLabs
  Skill/Engine owns sample retrieval and interprets the provider-authored opaque
  `voiceIdentity`; Core performs the same provider-neutral file attachment used
  by Seed Audio. Direct TTS generation, generation Preview, exact Asset
  provenance, Project credential storage, and video-route live-schema checks
  remain. No paid provider run is authorized by this plan.

## Summary

Dialogue Audio currently belongs to individual Scene Dialogue Turns and carries
an ElevenLabs-specific setup model that Studio edits in Dialog and Advanced
tabs. That model cannot represent a single Seed Audio artifact spanning several
consecutive turns, puts provider controls in Core/Studio, and leaves Takes on the
wrong product surface.

This plan makes the smallest complete cutover:

1. Number current Dialogue Turns in Scene Narrative as lightweight human aids.
2. Generate one audio artifact for one requested consecutive turn range through
   the conversational Media Producer workflow.
3. Store each accepted artifact as one Shot Plan Dialogue Audio Take and show it
   in a new Shot Plan **Audio** tab.
4. Allow independent multi-selection of those cards for later video-reference
   use.
5. Add Fal.ai Seed Audio 1.0 alongside the existing ElevenLabs path without
   moving provider-native schemas or controls into Core or Studio.
6. Make Cast Voice samples provider-neutral, move the surviving ElevenLabs
   sample/voice-id behavior out of Core, add one default Cast Voice per Cast
   Member, and use that default only as the initial transient Codex choice.

The plan deliberately does not create a dialogue timeline, range-to-turn
membership model, audio assembly system, speaker binding table, scene revision
tracking, automatic staleness detection, or provider configuration persistence.

## Requirement Ledger

| ID | Requirement | Source | Owning boundary | Verification |
| --- | --- | --- | --- | --- |
| R1 | Support Fal.ai `bytedance/seed-audio-1.0` for direct audio generation. | User 1 | Fal provider Skill + existing Fal Engine | Live schema validation and focused Engine/Skill tests |
| R2 | Put model-level Seed Audio examples and reference-voice guidance in the canonical Media Producer guide rather than Fal-specific craft docs. | User 1-2 | `studio-skills` Media Producer model guides | Guide validator and evals |
| R3 | Preserve ElevenLabs voice-id/provider-sample behavior while removing provider/model/capability knowledge and provider execution from Core; generated Seed samples use the same provider-neutral attachment. | User 1-2, 15 and architecture correction | Core Cast Voice domain attachment + ElevenLabs Engine/Skill + Casting Director/Media Producer | Core opacity/import tests and provider workflow tests |
| R4 | Use Cast voice notes and direct user direction to author an approximately 30-second Seed Audio reference voice sample. | User 2, 11 | Agent Skills | Sample-generation evals |
| R5 | Support several Cast Voices per Cast Member and one user-selected default, with the first attached voice becoming the initial default. | User 2, answers 9-10 | Core Cast Voice + Cast Assets UI | Migration, Core, route, and Studio tests |
| R6 | Number Dialogue Turns in canonical Scene order at the top right of Narrative dialogue blocks. | User 3, 13 | Scene projection/UI | Component and desktop E2E tests |
| R7 | Generate Dialogue Audio for one consecutive inclusive turn range, with Seed Audio usable for single- or multi-turn work. | User 3, answers 4 and 6 | `shot-plan.dialogue-audio` + Media Producer | Core/CLI/Skill tests |
| R8 | Store only the range numbers; tolerate stale ranges after screenplay changes without ids, validation, repair, or metadata. | User answer 5 | Core Take schema/projection | Migration/schema tests and stale-range behavior test |
| R9 | Remove Narrative Dialog, Advanced, and Takes surfaces and all saved per-turn setup. | User 4, answer 3 and 13 | Core/CLI/Studio deletion slice | Static/import tests and desktop E2E |
| R10 | Always use an inline Codex configuration component for provider, model, compatible Cast Voice choices, and selected model controls; keep it transient. | User 4, answer 12 | Media Producer/provider Skills + Visualize host capability | Skill evals and manual conversational verification |
| R11 | Move Takes to a Shot Plan Audio tab right of Assets and implement the approved quiet card design. | User 5 and ten card corrections | Studio shared Media Card + Shot Plan feature | Component screenshots and desktop E2E |
| R12 | Allow multiple Audio cards to be selected and expose all candidates, ranges, exact file paths, and selected state to the agent. | User answer 7 | Core Take selection + Generation Context | Core context and video-reference evals |
| R13 | Stop and ask to split/narrow when Seed Audio reference, text, or duration limits are exceeded; never invent a voice. | User answer 8 | Seed Audio model guide and purpose workflow | Boundary evals |
| R14 | Use Project Settings Audio provider only as the component's initial provider; request-time switching does not save it. | User answer 12 | Project Settings v6 + Skills | Migration, settings UI, and Skill evals |
| R15 | Add the two workflows under Media Producer as `cast.voice-sample` and `shot-plan.dialogue-audio`, with provider/model references rather than standalone duplicate Skills. | User answer 15 | Media Producer routing | Purpose coverage and forward evals |
| R16 | Reassign the five populated Urban Basilica Takes exactly to Shot Plans 1 and 2. | User answers 14 and final clarification | One-way Drizzle migration | Exact migration fixture and backed-up real-project verification |

## Product Behavior

### Narrative turn numbers

- A Dialogue Turn is numbered `1, 2, 3...` from its current position among the
  Scene's Dialogue Turns in canonical screenplay order.
- The number appears in the top-right corner of each Narrative dialogue block.
  It is quiet read-only text, not a button, badge action, stored field, or link.
- Action, headings, transitions, and other screenplay blocks do not consume
  turn numbers.
- Dual Dialogue follows the existing canonical Dialogue Turn order; each turn
  receives one number.
- Reimporting or revising the screenplay may renumber or remove turns. Existing
  Audio Takes are not updated, invalidated, or annotated.
- Remove the current “open dialogue audio” action and the whole side panel. The
  screenplay remains immutable and no audio control appears in Narrative.

### Cast Voice samples and default selection

- A Cast Member can retain several named Cast Voices, each with one playable
  `cast_voice_sample` Asset.
- Exactly zero or one active Cast Voice is the default. Attaching the first
  active Cast Voice for a Cast Member selects it automatically. Later attachments
  remain unselected until the user chooses one in **Cast > Assets > Voice
  Samples**.
- Voice Sample cards use the shared Media Card selection icon. Selecting another
  card atomically replaces the prior default. There is no separate “Default”
  text control and no request-time generation button.
- Removing the default clears the default. Restoring it restores its old default
  state when no newer default exists. If another voice became the default after
  removal, restore keeps that newer choice and reports a structured warning.
  Attaching a new first active voice while none exists selects the new voice.
- Existing active Cast Voices migrate by selecting the earliest active voice in
  `sortOrder, id` order for each Cast Member. Urban Basilica therefore receives
  one default for each of its four current voice-owning Cast Members.
- The default is provider-independent. Core returns the Cast Voice's playable
  sample Asset and opaque `voiceIdentity` without interpreting either for a
  provider. The selected provider Skill determines whether the identity or
  sample is usable for the current route.
- The inline component lists only Cast Voices the selected provider Skill finds
  usable for the selected model. If the default is incompatible, the agent
  requires a compatible choice rather than silently substituting another voice.

### Seed Audio Cast Voice Sample generation

For `cast.voice-sample` with Seed Audio:

1. Read Generation Context for the Cast Member, including voice notes, active
   Cast Design, Project language, and existing Cast Voices.
2. Combine the direct user request and relevant voice notes into a descriptive
   single-speaker prompt. Creative wording remains agent-authored and opaque to
   runtime code.
3. Always show a transient Codex configuration component before generation.
   It begins with the Project Audio provider, allows provider/model switching,
   and exposes the selected live route's useful request controls.
4. Seed Audio sample creation uses text description only. It supplies no source
   audio, image, or existing sample conditioning in this release.
5. Target approximately 30 seconds and roughly 70-85 naturally paced words.
   Use one speaker, one stable emotion/timbre, no music or second voice, minimal
   background sound, and a consistent microphone perspective.
6. Validate, Preview when Project policy requires it, execute through the Fal
   provider Skill/Engine, review the audio, and attach the accepted file through
   the provider-neutral Cast Voice file attachment with `voiceIdentity: null`.
7. The playable sample itself is the future Seed Audio reference. Core creates
   no provider registration or Seed-specific metadata.

The existing ElevenLabs path remains distinct outside Core. The ElevenLabs
provider Skill invokes the existing Engines voice-sample retrieval, writes the
downloaded audio and exact safe retrieval provenance, and supplies an opaque
provider-authored `voiceIdentity` containing the reusable voice id to the same
Core attachment command. The ElevenLabs Skill later reads that identity and
places the voice id in the direct-TTS request. The selected TTS model is a
request-time provider choice and is not stored on Cast Voice.

### Shot Plan Dialogue Audio generation

The purpose is:

```text
purpose: shot-plan.dialogue-audio
target:  shot-plan:<shot-plan-id>
```

The workflow is:

1. Read Generation Context. It returns the target Shot Plan, owning Scene, and
   every current Dialogue Turn with `number`, speaker, Cast Member when known,
   and exact dialogue text.
2. Interpret the user's requested consecutive turn range. One turn uses `N`;
   several use `N-M`. Comma-separated or disjoint ranges are not accepted in one
   Take. The user can make separate Takes instead.
3. Always show a transient Codex configuration component before generation.
   It shows the requested range and exposes provider, model, and compatible Cast
   Voice choice per distinct speaker. Project Settings supplies only the initial
   provider.
4. For ElevenLabs, the range must contain one turn and the ElevenLabs Skill must
   find a usable voice id in the selected Cast Voice's opaque `voiceIdentity`.
   The provider request uses that voice id; the sample is still only for
   auditioning. Core does not decide compatibility or project a typed provider
   registration.
5. For Seed Audio, a one-turn or multi-turn consecutive range is valid. Each
   distinct speaker uses the selected Cast Voice sample as one exact audio
   reference and the prompt uses the route's documented `@AudioN` role syntax.
6. Stop and ask the user to split/narrow when the range needs more than three
   distinct reference samples, exceeds 2,048 prompt characters, or is likely to
   exceed two minutes. Never omit a speaker reference or synthesize an
   unconditioned substitute voice.
7. Validate and Preview the exact provider-native request, obtain normal
   conversational confirmation, execute one provider request, review one audio
   output, and attach one Take with exact provenance and the stored range.
8. A newly attached Take is unselected. The user selects it later in the Shot
   Plan Audio tab.

There is no automatic per-turn split, concatenation, combining, grouping, whole-
Scene artifact, replacement rule, or generation button. One user request plus
one provider request plus one accepted output equals one card.

### Transient Codex configuration components

Media Producer owns two inline configurations: Cast Voice Sample and Shot Plan
Dialogue Audio. They are generated in conversation through the available
Visualize capability and send the user's exact choices back to Codex as a
follow-up message. They do not call Renku or provider APIs themselves.

Shared behavior:

- render on every generation request, even when defaults are usable;
- show the Project Audio provider as the initial provider;
- allow a one-request provider and model switch;
- obtain model controls from the selected provider route and canonical guide,
  not from a Core or Studio control schema;
- show only compatible Cast Voice choices, preselecting the default when usable;
- include a single clearly labeled continuation action that returns the exact
  configuration to the conversation;
- keep all component state temporary; and
- run normal Generation Preview/confirmation afterward when policy requires it.

ElevenLabs exposes its current speed, stability, similarity, style, speaker
boost, language, and output controls when supported by the selected route. Seed
Audio exposes its current output format, sample rate, speed, volume, pitch,
multilingual, and reference choices when supported. The live schema remains the
executable authority, so the Skill must not show a control the current route no
longer accepts.

### Shot Plan Audio tab and card

- `ShotPlanDetailTab` becomes `shots | assets | audio`; the order and visible
  labels are **Shots**, **Assets**, **Audio**.
- Audio contains one full-width card column and no repeated section title,
  subtitle, count pill, toolbar, or New Take action.
- Each card shows:
  - `TURN N` or `TURNS N-M`;
  - a four-cell 2x2 speaker area;
  - the selected Cast Profile for each distinct current speaker in first-
    appearance order;
  - an empty cell when that speaker has no selected Cast Profile;
  - for more than four distinct speakers, the first three portraits/cells and a
    final `+N speakers` cell;
  - play/pause, a waveform-style scrubber, and one elapsed/total time display;
  - provider and model from the Take Asset's generation provenance; and
  - generated date.
- It never shows dialogue text, character names, `Whole Shot Plan`, `Single
  Turn`, `Multi-turn`, selection-count prose, a right action column, a second
  duration, link/inspect action, or provider request action.
- The normal Media Card selection control remains visible and supports toggle
  selection. Selected cards use the same selected border/ring as other Media
  Cards.
- Trash is the only destructive card action. It appears at top right on hover or
  keyboard focus, uses the shared confirmation behavior, moves the Take to
  Trash, and clears its selected state. Restore returns the Take unselected.
- The empty tab uses one restrained `No audio yet.` state. It does not offer a
  creation button; conversation is the creation surface.

The approved visual target is:

```text
/Users/keremk/.codex/generated_images/01a058d7-7467-7611-bcf2-5031bbd44374/exec-610c729f-e4be-488f-9e8c-2744f65e1642.png
```

The written rules above are authoritative where generated-image details are
ambiguous, especially the required Media Card selection icon.

### Selected Dialogue Audio as video context

- Generation Context for a Shot Plan video returns all active Dialogue Audio
  Takes weakly authored from that exact Shot Plan.
- Each candidate includes its exact Asset/File path, exact generation
  provenance, stored `dialogueTurnRange`, and `isWorkflowSelected` state.
- The agent uses every selected candidate whose range is relevant to the
  requested video. A selected multi-turn Seed Audio Take is one audio reference;
  selected single-turn Takes are separate references.
- The agent does not choose a sole unselected candidate, infer the latest, or
  prefer Seed/ElevenLabs. No selected candidate means no default audio reference.
- If several selected Takes overlap, exceed a live route limit, or otherwise
  make the request ambiguous, the agent asks the user to adjust selection or
  choose another route. Core does not reject the selection.
- A route without audio-reference input receives no invented field. Existing
  capability-aware switch-or-continue guidance remains.

## Explicit Non-Goals

- No Dialogue Turn id, Dialogue Part id, speaker id, screenplay revision,
  transcript snapshot, or range membership on a Take.
- No staleness badge, reimport listener, renumber migration, range repair,
  automatic deletion, or range-to-current-screenplay validation.
- No disjoint turn list, arbitrary turn set, overlap policy, completeness rule,
  one-Take-per-turn rule, grouping entity, timeline, edit decision list, mix,
  concatenation, or automatic split.
- No model/provider setup persisted on a Scene, Dialogue Turn, Shot Plan, Cast
  Member, or session beyond existing Project Audio provider default and Asset
  provenance.
- No provider-native request schema, control registry, model catalog, or form in
  Core or Studio.
- No Core provider-registration subsystem and no source-audio conditioning for
  Seed Cast Voice Sample creation in this release.
- No new standalone `dialogue-audio` or `voice-sample` Skill package; both are
  Media Producer purpose guides.
- No Studio audio-generation button, New Take button, or direct provider call.
- No migration fleet, runtime compatibility reader, old-purpose alias, or
  physical move of the five existing audio files.
- No mobile layout or verification.

## Context And Current Evidence

### Current implementation

- `packages/core/src/client/scene-dialogue-audio-workspace.ts` and
  `packages/core/src/server/scene-dialogue-audio-workspace/` model one setup and
  one selected Take per stable Dialogue Turn id. The model and settings are
  explicitly ElevenLabs-specific.
- `packages/core/src/server/schema/scene-dialogue-audio.ts` owns
  `scene_dialogue_audio`, `scene_dialogue_audio_take`, and
  `scene_dialogue_audio_take_selection`.
- `packages/cli/src/commands/dialogue-audio/` exposes `show` and `setup` and
  `packages/studio/server/routes/screenplay/dialogue-audio.ts` exposes setup,
  Take, selection, and file routes.
- `scene-dialogue-audio-panel.tsx` owns Dialog, Takes, and Advanced tabs in
  Narrative. `scene-dialogue-audio-takes-tab.tsx` uses a narrow custom Take row
  rather than the shared Media Card.
- `shot-plan-detail-page.tsx` currently exposes only Shots and Assets.
- `MediaCard` already owns shared selection and hover/focus Trash actions. Its
  current audio visual uses native browser controls and does not support the
  approved portrait/waveform composition.
- `cast_voice` already supports several Cast Voices per Cast Member, and each
  has one sample Asset. It has no default selection.
- The generic `castVoiceAttachment` currently requires ElevenLabs provider,
  model, and voice id and always inserts an ElevenLabs registration. Core also
  owns an ElevenLabs-only provider/model/capability union, provider-sample
  attachment kind, injected sample fetcher, provider compatibility validation,
  and provider-specific sample-source fields. These are residues from before
  Decision 0086 extracted provider generation and must not be preserved as a
  Cast Voice precedent.
- Project Settings v5 restricts `generation.audio.provider` to `elevenlabs`.
- The Fal Engine already performs live-schema validation, local-file upload,
  asynchronous execution/recovery, and audio output normalization for `audio`
  and `audio_file` response fields. Seed Audio therefore needs route/schema
  coverage and Skill guidance, not a second provider client or generic audio
  runtime.
- The Fal provider Skill currently advertises image/video only and its
  `supported-routes.json` omits Seed Audio. The canonical model catalog omits
  Seed Audio. `scene-dialogue-audio.md` explicitly forbids combined audio and
  restricts the workflow to ElevenLabs.

### Urban Basilica read-only evidence

Read-only inspection on 2026-08-31 found:

- schema generation 66;
- two active Shot Plans for Scene 01 and one for Scene 02;
- five active Dialogue Audio Takes, all in Scene 01;
- no selected Dialogue Audio Take;
- one Narrator turn-1 Take, two Mara turn-2 Takes, one Urban turn-3 Take, and one
  Mehmed II turn-4 Take;
- exact safe ElevenLabs generation provenance on all five Assets;
- four active Cast Voices, each with one ElevenLabs provider registration that
  must be converted once into provider-authored opaque `voiceIdentity` JSON; and
- no selected Cast Profile for Narrator, which should render the approved empty
  portrait state rather than a fallback image.

The two Scene 01 plans are identified by durable ids, not titles:

| Plan | Durable id | Current stored title |
| --- | --- | --- |
| 1 | `shot_plan_bm34r9be` | `The City Under Siege` |
| 2 | `shot_plan_sp24knrj` | `Doubt Before Fire` |

### Accepted constraints and changed decisions

- Decision 0041 keeps creative prompts and media opaque to runtime code.
- Decision 0029 already establishes Cast Voice and Cast Voice Sample as durable
  Cast-owned data.
- Decisions 0033 and 0034 retained reusable provider handles as typed Cast Voice
  Provider Registrations. The accepted provider extraction in Decision 0086 and
  this correction supersede that Core-owned registration shape: durable voice
  identity remains, but its provider-native JSON shape and interpretation belong
  to the provider Skill.
- Decisions 0086 and 0087 keep provider-native execution and interpretation in
  Engines/Skills, deterministic Project context and provider-opaque persistence
  in Core, and require a normal provider/model addition not to change Core.
- Decision 0089 currently requires per-turn `scene.dialogue-audio`, a single
  selected Take per turn, and Studio as the setup/selection surface. The new
  direction supersedes those Dialogue Audio clauses while leaving its video-
  edit and provider-prompt-expansion decisions intact.
- Decision 0069's weak Shot Plan context remains useful for independently owned
  media, but its Scene-derived dialogue references change to exact Shot Plan
  Dialogue Audio Takes.
- The repository requires Drizzle Kit code-first generation. Current official
  Drizzle documentation confirms `drizzle-kit generate` compares schema
  snapshots and that custom SQL belongs in a generated custom migration when a
  schema diff cannot express data transformation:
  - https://orm.drizzle.team/docs/drizzle-kit-generate
  - https://orm.drizzle.team/docs/kit-custom-migrations
- Seed Audio guidance reviewed on 2026-08-31:
  - model-level examples and reference-voice recommendations:
    https://fal.ai/learn/tools/how-to-use-seed-audio
  - current Fal route schema and limits:
    https://fal.ai/models/bytedance/seed-audio-1.0/api

### Right-sized change decision

1. **Reuse unchanged:** rejected. The current per-turn setup/Take model cannot
   represent one multi-speaker output, and its Studio/provider ownership is the
   behavior being removed.
2. **Refactor existing owners:** accepted. Reuse Media Purpose, exact Asset
   provenance, Fal Engine, Cast Voice/Sample, Project Settings, Shot Plan weak
   authorship, Generation Context, Media Card actions, resource invalidation,
   Trash, and conversational Preview.
3. **Add parallel Scene and Shot Plan systems:** rejected. Pre-customer cutover
   should delete the obsolete purpose, schema, routes, commands, hooks, and UI
   rather than synchronize two audio models.

## Architecture Shape Gate

### Core ownership and module layout

```text
packages/core/src/client/
  json.ts                          # generic JsonValue moved out of generation review
  shot-plan-dialogue-audio.ts      # public Take/range/resource contracts
  cast-voices.ts                   # domain facts, isDefault, opaque voiceIdentity, file attachment
  media-attachments.ts             # replaces purpose only
  media-generation-context.ts      # dialogue number/range candidate facts
  project-settings.ts              # version 6, opaque Audio provider preference

packages/core/src/server/
  schema/
    shot-plan-dialogue-audio.ts    # new Take table
    cast-voices.ts                 # opaque identity field, default table, registration removal

  shot-plan-dialogue-audio/
    attachment.ts                  # exact provenance, Asset/File, range, Take transaction
    projection.ts                  # active Takes, current speaker/profile presentation facts
    selection.ts                   # independent per-Take select/clear
    lifecycle.ts                   # Trash/restore selection behavior
    generation-context.ts          # range-aware dialogue-audio suggestions
    index.ts                       # thin public entrypoint only

  cast-voices/
    attachment.ts                  # provider-neutral sample Asset + opaque identity attachment
    default-selection.ts           # first/default selection rules
    lifecycle.ts                   # default clearing on removal/restore behavior
    projection.ts                  # CastVoice + isDefault
    voice-identity.ts              # bounded safe opaque JSON, no provider schema
    validation.ts                  # domain/file/provenance envelopes only
    index.ts                       # thin public entrypoint only

  project-asset-files/destinations/
    shot-plan-dialogue-audio.ts    # new human-readable plan audio path
```

`packages/core/src/server/commands/cast-voice-commands.ts` is expected to
disappear after its responsibilities move into the focused `cast-voices/`
module. Its provider-registration commands, ElevenLabs sample-fetcher injection,
model/capability validation, and provider-specific sample preparation are
deleted rather than moved. Do not add default selection or Seed branches to
that already broad file.

`packages/core/src/server/scene-dialogue-audio-workspace/`,
`packages/core/src/client/scene-dialogue-audio-workspace.ts`, and
`packages/core/src/server/schema/scene-dialogue-audio.ts` disappear.

The public Core `index.ts` files may export the new focused contracts and
operations. They may not contain validation, projection, provider, persistence,
or dispatch logic.

`JsonValue` moves from `media-generation-review.ts` to the generic client JSON
module so Cast Voice does not depend on a generation-review contract merely to
carry opaque domain metadata. Existing review/provenance callers update their
imports directly; no compatibility re-export remains in the old module.

### CLI layout

```text
packages/cli/src/commands/media-import/
  command.ts                       # parse shared flags and bounded dispatch
  generic.ts                       # existing generic attachments
  scene-storyboard.ts              # existing special attachment moved intact
  shot-plan-dialogue-audio.ts      # --turns parsing and focused Core delegation
```

Delete `packages/cli/src/commands/dialogue-audio/`. Do not replace it with a new
top-level command. Media Producer uses the existing `generation context`,
`generation validate/preview/execute`, and `media import` workflow.

The media-import dispatcher is bounded to purpose-specific attachment shapes;
it must not accumulate provider selection, native request fields, filesystem
copying, or Core validation.

`packages/cli/src/commands/cast-voice-command-handlers.ts` keeps only provider-
neutral list/show/validate/attach/remove behavior and delegates the file
document once. Delete its provider-registration subcommands, Engines import,
credential resolution, and attachment-kind branch.

### Engines provider layout

```text
packages/engines/src/providers/elevenlabs/
  index.ts                         # normal MediaProvider dispatch, including voice-sample-audio
  voice-samples.ts                 # existing focused provider protocol helper
```

The existing helper remains the ElevenLabs protocol owner, but
`voice-sample-audio` becomes a normal `MediaProvider` operation reachable
through the current generation CLI composition root. Engines validates the
provider-native request, retrieves/downloads the sample, returns the artifact
and receipt, and knows nothing about Cast Voice or Core attachment. No new
provider-specific CLI command is introduced.

### Studio server and browser layout

```text
packages/studio/server/routes/
  shot-plan-dialogue-audio.ts      # thin read/select/clear/delete/file routes
  cast-voices.ts                   # adds thin default-selection route

packages/studio/src/services/
  studio-shot-plan-dialogue-audio-api.ts

packages/studio/src/features/movie-studio/shot-plans/
  shot-plan-dialogue-audio.tsx          # resource mapping + thin UI mutation triggers
  use-shot-plan-dialogue-audio.ts

packages/studio/src/ui/
  audio-waveform-player.tsx        # shared play/pause/scrub/time presentation
  media-card/
    media-card-audio-take.tsx      # approved presentation variation
```

Delete the Scene Dialogue Audio service, hook, panel, Dialog tab, Advanced tab,
Takes tab, formatting helper, and screenplay audio routes/tests. Narrative owns
only the derived turn number presentation.

`MediaCard` remains the owner of selected styling, selection action placement,
hover/focus Trash, and confirmation. The audio-take variation owns only the
card's approved visual body. `ShotPlanDialogueAudio` maps the domain resource to
that shared contract and invokes the thin select/clear/delete service calls; it
contains no screenplay, range, selection-policy, or provider business rules.

All interactive controls in Studio use local shadcn primitives. A non-controls
`<audio>` element may back the player, but playback actions use local `Button`
and `Slider`; do not expose raw browser controls.

### Studio Skills layout

```text
studio-skills/skills/media-producer/references/
  cast-voice-sample.md                  # provider-neutral purpose workflow
  shot-plan-dialogue-audio.md           # new purpose workflow
  codex-audio-configuration.md          # shared transient component rules
  video-reference-continuity.md         # selected Shot Plan Take policy
  model-guides/
    model-catalog.json
    audio/
      seed-audio-1.0.md                 # provider-neutral model craft/limits
      elevenlabs-speech.md              # retained direct TTS guidance

studio-skills/skills/fal-ai-media-provider/
  SKILL.md                               # image, video, and audio scope
  references/supported-routes.json      # Seed Audio executable route

studio-skills/skills/casting-director/references/
  voice-casting.md
  cast-voice-attachments.md
  cast-media-handoff.md
```

Provider Skills continue to own exact route selection and transport. Media
Producer owns purpose flow and model-level craft. Casting Director owns durable
Cast Voice attachment. The ElevenLabs provider Skill owns the provider-authored
`voiceIdentity` shape and sample retrieval through its existing Engines
capability. No new Skill package or executable is introduced.

### Bounded dispatch and registries

- Replace `scene.dialogue-audio` with `shot-plan.dialogue-audio` in the existing
  exhaustive purpose/target/output maps and purpose-builder registry.
- Register `bytedance/seed-audio-1.0` in Fal's supported-route index and map it
  to canonical `seed-audio-1.0` / `text-to-speech` guidance.
- Add the new asset-file destination to the existing focused destination
  registry.
- Keep purpose-specific Take persistence out of generic
  `generation/attachment-persistence.ts` and provider-specific behavior out of
  `shot-plan-dialogue-audio/`.
- Remove existing Cast Voice provider/model/capability switches, provider
  registration projections, and provider fetcher contracts from Core. Do not
  add model-name switches in Core, Studio, or purpose-specific CLI adapters.
  Provider/model compatibility remains Skill/live-schema reasoning.

### Forbidden shapes and stop conditions

Stop and revise before implementation continues if:

- any Take stores a Dialogue Turn id, Cast Member id, speaker list, transcript,
  screenplay revision, or range membership rows;
- runtime code tries to detect, validate, repair, or warn about stale ranges;
- a range can contain disjoint turns or a service automatically splits/combines
  provider requests;
- `scene.dialogue-audio` survives as an alias, reader, purpose, route, command,
  setup shape, or test-only compatibility concept;
- Core or Studio gains a Seed/ElevenLabs native field schema or control map;
- Core retains or adds a typed Cast Voice provider, model, capability,
  registration, voice-id, or provider-sample retrieval contract;
- Core or a Studio route branches on provider/model identity to attach or read a
  Cast Voice;
- the inline Codex component writes Project Settings or calls a provider;
- a Shot Plan stores reverse Asset ids or a selected-Take list;
- selection overlap/completeness policy appears in Core or React;
- `generation/attachments.ts`, `media-import` command code,
  `shot-plan-detail-page.tsx`, `routes/shot-plans.ts`, or a public `index.ts`
  becomes the new god file;
- the Cast Voice refactor merely moves the existing large command body into one
  equally large file; or
- the card is declared complete without a full-window desktop comparison to the
  approved reference.

## Public Contracts

### Purpose, range, and target

```ts
type MediaPurpose =
  | /* retained purposes */
  | 'cast.voice-sample'
  | 'shot-plan.dialogue-audio';

interface DialogueTurnRange {
  start: number;
  end: number;
}
```

- `shot-plan.dialogue-audio` targets `{ kind: 'shotPlan'; id: string }` and
  outputs audio.
- Delete `sceneDialogue` from `MediaTarget` once all callers are removed.
- `DialogueTurnRange` is structurally valid only when both values are positive
  integers and `end >= start`. Core does not compare it with the current Scene.

### Shot Plan Dialogue Audio Take

```ts
interface ShotPlanDialogueAudioTake {
  id: string;
  shotPlanId: string;
  asset: Asset;
  turnRange: DialogueTurnRange;
  selected: boolean;
  speakers: ShotPlanDialogueAudioSpeaker[];
  createdAt: string;
  updatedAt: string;
}

interface ShotPlanDialogueAudioSpeaker {
  castMemberId: string | null;
  speakerName: string;
  selectedProfile: ScreenplayImageReference | null;
}

interface ShotPlanDialogueAudioResource {
  shotPlan: { id: string; sceneId: string; title: string };
  takes: ShotPlanDialogueAudioTake[];
  resourceKeys: string[];
}
```

`speakers` is a current presentation projection derived from the stored numbers
and current screenplay. It is never persisted. `speakerName` exists for
accessible labels and agent context; the approved card does not render it as
visible copy.

The durable table is `shot_plan_dialogue_audio_take`:

```text
id
shot_plan_id                 FK -> shot_plan.id
asset_id                     FK -> asset.id, unique
asset_file_id                FK -> asset_file.id
turn_start_number            positive integer
turn_end_number              integer >= start
selected_at                  nullable text
created_at / updated_at
discard lifecycle columns
```

Provider/model remain in `asset.generationProvenance`; the Take table does not
mirror them.

### Core commands

```ts
attachShotPlanDialogueAudio(input: {
  projectName?: string;
  homeDir?: string;
  shotPlanId: string;
  sourceProjectRelativePath: string;
  turnRange: DialogueTurnRange;
  generationProvenance: MediaGenerationProvenance;
  title?: string;
  assetMetadata?: AssetMetadataInput;
}): Promise<ShotPlanDialogueAudioMutationReport>

readShotPlanDialogueAudio(input: {
  projectName?: string;
  homeDir?: string;
  shotPlanId: string;
}): Promise<ShotPlanDialogueAudioResource>

selectShotPlanDialogueAudioTake(...)
clearShotPlanDialogueAudioTakeSelection(...)
discardShotPlanDialogueAudioTake(...)
```

Attachment requires one audio output, safe exact audio provenance, an active
Shot Plan, and a structurally valid range. It creates one Project-owned Asset
of type `shot_plan_dialogue_audio`, one primary audio Asset File, weak
`authoredFrom: { kind: 'shotPlan', id }`, and one focused Take row in a single
rollback-safe operation.

New files use:

```text
scenes/<scene-production-number>/<NN>-shot-plan/audio/turn-02-gxxx.<ext>
scenes/<scene-production-number>/<NN>-shot-plan/audio/turns-02-04-gxxx.<ext>
```

The registered path is never parsed to recover Scene, Shot Plan, or range.

### Selection and resource keys

- `selectShotPlanDialogueAudioTake` sets that active Take's `selectedAt` without
  clearing any peer.
- `clearShotPlanDialogueAudioTakeSelection` clears only the exact Take.
- Discard clears `selectedAt` in the same transaction; restore does not restore
  it.
- Resource key:

```text
surface:shotPlan:<shot-plan-id>:dialogue-audio
```

Attachment, selection, clear, discard, restore, and any source-derived update
emit this key plus existing exact owner/Shot Plan keys required by current
Generation Context consumers.

### Generation Context

- Add `number: number` to `MediaGenerationDialogueTurnContext`.
- Add optional `dialogueTurnRange: DialogueTurnRange` to
  `MediaGenerationReferenceCandidate`, populated only for Shot Plan Dialogue
  Audio Take candidates.
- For `shot-plan.dialogue-audio`, the Shot Plan target context includes the
  current numbered Scene dialogue list and existing Take suggestions.
- For `shot-plan.video-generation`, `dialogue-audio` suggestions come from the
  exact Shot Plan Take resource. Every candidate remains visible; `selectedAt`
  maps to `isWorkflowSelected`.
- Cast Voice context returns each voice's domain facts, sample Asset, default
  state, and opaque `voiceIdentity`. Delete typed provider-registration options;
  the selected provider Skill interprets compatibility after reading context.
- Delete the Scene Dialogue target context, setup, cast-voice-option shape, and
  prior per-turn Take projection.

### Cast Voice attachment and default

```ts
interface CastVoice {
  // retained fields
  isDefault: boolean;
  voiceIdentity: JsonValue | null;
}

interface CastVoiceFileAttachmentDocument {
  kind: 'castVoiceFileAttachment';
  castMemberId: string;
  name: string;
  purpose: string;
  voiceIdentity?: JsonValue;
  sample: {
    sourceProjectRelativePath: ProjectRelativePath;
    title: string;
    generationProvenance?: MediaGenerationProvenance;
  };
}
```

`voiceIdentity` is bounded safe opaque JSON. Core validates only that it is a
JSON value within the accepted size/depth and secret/URL safety envelope. Core
does not define required fields, recognize a provider/model/capability, extract
a voice id, or decide whether it is compatible with any route. The provider
Skill owns the JSON shape and interpretation. Generation Context returns it
unchanged as Cast Voice domain context.

The initial provider-owned ElevenLabs guide authors exactly:

```json
{ "provider": "elevenlabs", "voiceId": "<exact reusable voice id>" }
```

This example is a Skill contract, not a Core interface, validator, discriminated
union, or provider registry. A later provider may author another safe JSON shape
without a Core, database, CLI attachment, or Studio contract change.

Do not hide `voiceIdentity` inside `MediaGenerationProvenance`. Provenance
describes how the sample Asset was actually produced or retrieved; a reusable
external voice identity is a separate Cast Voice fact. Urban Basilica proves the
distinction: three current voices have imported/generated sample files plus an
external voice id, so manufacturing provider-generation provenance for those
samples would be false. Only the genuinely downloaded provider sample receives
retrieval provenance during migration.

Replace `CastVoiceAttachmentDocument` and
`CastVoiceElevenLabsSampleAttachmentDocument` directly with the single file
attachment above. A generated Seed sample supplies `voiceIdentity: null` or
omits it. The ElevenLabs provider Skill first retrieves the sample through the
generic Engines provider operation, then supplies the downloaded file, exact
retrieval provenance, and its provider-authored opaque voice identity to this
same Core command.

Delete from Core:

- `CastVoiceProvider`, `CastVoiceProviderRegistrationModel`, and
  `CastVoiceProviderCapability`;
- every Cast Voice Provider Registration public report and command;
- `CastVoiceSampleSource` and the ElevenLabs-specific sample retrieval report;
- `ElevenLabsVoiceSampleFetcher` and provider fetcher injection; and
- the `cast_voice_provider_registration` table plus provider-specific
  `cast_voice.sample_source_kind`, `sample_id`, `sample_fetched_at`, and
  `sample_api_base_url` columns.

The existing ElevenLabs Engines helper is folded into the normal ElevenLabs
`MediaProvider` as operation/model id `voice-sample-audio`. Its provider Skill
uses the same `generation validate`, Preview, `generation execute`, provenance,
and provider-neutral Cast Voice file attachment sequence as other provider
media. This adds no provider-specific Core or Studio command.

Add table `cast_voice_default`:

```text
cast_member_id                PK, FK -> cast_member.id
cast_voice_id                 unique, FK -> cast_voice.id
created_at / updated_at
```

Public operations:

```ts
selectDefaultCastVoice(...)
```

There is no public clear action in Studio. Removal clears the row internally.
The default relation validates exact active Cast Member/Voice membership in
Core.

### Project Settings version 6

```ts
interface ProjectSettingsDocument {
  version: 6;
  generation: {
    // retained fields
    audio: GenerationMediaSettings<string>;
  };
}
```

The v5-to-v6 migration changes only `version`; every existing audio provider
remains `elevenlabs`. New Project defaults remain ElevenLabs unless a separate
product decision changes them. Studio's existing provider setting gains Fal.ai
as the second Audio choice. This field is the explicitly requested Project
workflow preference retained by Decision 0086, not a Core provider catalog:
Core validates a bounded non-empty identifier, projects it unchanged, and does
not use it to select, validate, or execute a model. Studio's accepted Settings
surface and the provider Skills own the current visible choices.

### CLI

```bash
renku generation context \
  --purpose shot-plan.dialogue-audio \
  --target shot-plan:<shot-plan-id> \
  --json

renku media import \
  --purpose shot-plan.dialogue-audio \
  --target shot-plan:<shot-plan-id> \
  --turns <N|N-M> \
  --source <project-relative-audio-path> \
  --provenance <provenance.json> \
  --json
```

`--turns` accepts only one positive integer or one inclusive ascending range.
It parses to `DialogueTurnRange` and delegates to Core. Diagnostic `CLI164`
reports an absent or malformed range. CLI does not inspect the Scene, speakers,
provider, request, or audio contents.

### Studio HTTP routes

```text
GET    /screenplay/shot-plans/:shotPlanId/dialogue-audio
PUT    /screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId/selection
DELETE /screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId/selection
DELETE /screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId
GET    /screenplay/shot-plans/:shotPlanId/dialogue-audio/takes/:takeId/files/:assetFileId

PUT    /cast/:castMemberId/voices/:castVoiceId/default
```

Handlers read params/body, call the focused Project Data Service operation,
serialize the report, and map structured errors. They do not calculate range,
speaker, selection, default, or file-membership rules.

### Diagnostics

New Core diagnostics:

- `CORE_SHOT_PLAN_DIALOGUE_AUDIO_TURN_RANGE_INVALID`
- `CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_NOT_FOUND`
- `CORE_SHOT_PLAN_DIALOGUE_AUDIO_TAKE_INVALID`
- `CORE_SHOT_PLAN_DIALOGUE_AUDIO_FILE_INVALID`
- `CORE_CAST_VOICE_DEFAULT_INVALID`

Reuse existing safe-path, provenance, Asset/File, Shot Plan-not-found,
persistence, Trash, and rollback diagnostics. Do not add “stale turn range,” old
purpose, old table, or compatibility diagnostics.

## Data Migration And Destructive Effects

### Drizzle workflow

1. Change the TypeScript schema first.
2. From `packages/core`, run:

   ```bash
   pnpm drizzle-kit generate --config drizzle.config.ts --name shot_plan_dialogue_audio
   ```

3. Keep the generated snapshot/journal and generated DDL. Document and add only
   the required custom data-preservation/Urban mapping statements to the
   generated migration, following the repository's accepted custom-migration
   pattern.
4. The expected migration is
   `packages/core/drizzle/0083_shot_plan_dialogue_audio.sql`; the exact numeric
   prefix must be the next Drizzle-generated entry at implementation time.
5. Set `PRAGMA user_version = 67` because current runtime reads the new tables
   unconditionally and no longer reads the old tables.

### Migration behavior

The migration must:

1. Guard Project Settings so an existing singleton must be a valid version-5
   document with an accepted Audio provider before any mutation.
2. Create `shot_plan_dialogue_audio_take` and `cast_voice_default`, and add the
   nullable JSON `cast_voice.voice_identity` field from the Drizzle schema.
3. Guard the known pre-customer Cast Voice data before mutation: each active
   voice may have at most one active provider registration, every provider
   registration must belong to an active Cast Voice, and provider-specific
   sample-source facts must match the exact four populated Urban records.
4. Convert each current registration once to provider-authored opaque identity
   JSON containing only its exact provider id and external voice id. Deliberately
   discard the registration model and capability array: model is a transient
   request choice and capability interpretation belongs to the provider Skill.
5. For the one actual downloaded ElevenLabs sample, convert its existing
   voice/sample/fetch/base-URL facts into exact `voice-sample-audio` Asset
   generation provenance. Do not invent provenance for imported or generated
   sample files that were not retrieved by that operation.
6. Insert one default row per Cast Member with active voices, choosing the first
   active voice by `sort_order, id`.
7. Verify that every active legacy Dialogue Audio Take in the populated Project
   is one of the five accepted ids and that both target Shot Plan ids exist.
   Abort before mutation on any unexpected active Take; do not guess a plan.
8. Insert the five new Take rows with their confirmed Shot Plan/range mapping,
   preserved ids, Asset/File ids, timestamps, and unselected state.
9. Change those five Assets from Scene membership to Project membership and set
   `authored_from_shot_plan_id` to the mapped plan id. Change their Asset type to
   `shot_plan_dialogue_audio`. Preserve file rows, registered paths, exact
   generation provenance, locale, titles, metadata, tags, and origin.
10. Upgrade Project Settings to version 6 without changing provider or any other
   value.
11. Drop `cast_voice_provider_registration`, the four provider-specific Cast
    Voice sample-source columns, `scene_dialogue_audio_take_selection`,
    `scene_dialogue_audio_take`, and `scene_dialogue_audio` only after
    preservation succeeds.
12. Preserve unrelated Assets, Shot Plans, screenplay data, Cast Voices, sample
    Assets, Trash history, and files.
13. Succeed on a fresh database with no Project, Settings, Cast Voice, provider
    registration, or legacy Take rows.

The exact Urban Cast Voice identity conversion is:

| Cast Voice | Durable id | `voiceIdentity` |
| --- | --- | --- |
| narrator-main | `cast_voice_6rwp8wx4` | `{"provider":"elevenlabs","voiceId":"iUqOXhMfiOIbBejNtfLR"}` |
| mehmed-ii-sovereign | `cast_voice_t8wv3u67` | `{"provider":"elevenlabs","voiceId":"7squ7rvxEIZ2rYy7KYPP"}` |
| default-dialogue-voice | `cast_voice_h3tjb82r` | `{"provider":"elevenlabs","voiceId":"4qGY1svUBZLI7l8Ei9WW"}` |
| urban-primary | `cast_voice_dmespd7e` | `{"provider":"elevenlabs","voiceId":"Xq2dbIWNPChFB77imiDe"}` |

Only `narrator-main` receives reconstructed retrieval provenance. Its exact
stored facts are sample id `kD3H159cQN5vDGml2QJz`, fetched at
`2026-07-01T15:09:21.370Z`, API base URL `https://api.elevenlabs.io`, and the
voice id above. The other three sample Assets retain null provenance.

No runtime migration, file-copy task, compatibility view, or title-based
mapping is added. Apply the migration to Urban Basilica only through the normal
backed-up `renku project migrate urban-basilica` flow after tests pass.

## Implementation Slices

### Slice 1 — Record the changed decision and lock contracts

- Add ADR 0090 for Shot Plan Dialogue Audio, lightweight turn ranges, multi-
  selection, provider-neutral Cast Voice samples/defaults, and transient Codex
  configuration.
- Add concise supersession/update notices to ADRs 0089, 0069, 0074, 0034, 0033,
  and 0029 as listed under Documentation. Do not rewrite their original
  reasoning.
- Add the exact public purpose, range, Take, default voice, Settings v6, CLI,
  route, diagnostic, Asset type, and resource-key contracts above.

### Slice 2 — Replace the durable Scene audio model

- Add the new Drizzle tables and generate migration 0083 through Drizzle Kit.
- Add the exact guarded Urban data transformation and Settings v6 update.
- Replace Scene Dialogue Audio client/server contracts with focused Shot Plan
  Take projection, attachment, selection, and lifecycle modules.
- Add the Shot Plan audio destination and rollback-safe Asset/File/Take write.
- Delete the old schema/module after the migration and new callers are ready.

### Slice 3 — Refactor Cast Voice ownership and add defaults

- Split the broad Cast Voice command module according to the Architecture Shape
  Gate.
- Replace both attachment documents with the one provider-neutral file document
  plus optional opaque `voiceIdentity`.
- Delete the provider registration table/contracts/commands, typed sample-source
  projection, ElevenLabs fetcher injection, and provider/model/capability
  validation from Core.
- Fold the existing ElevenLabs voice-sample helper into the normal ElevenLabs
  `MediaProvider` operation so the provider Skill performs retrieval and writes
  exact provenance before generic Cast Voice attachment.
- Add default projection, first-attachment selection, explicit selection,
  removal clearing, and non-restoring restore behavior.
- Add the thin Studio route and wire Voice Sample cards to shared Media Card
  choose-selection.

### Slice 4 — Add numbered turns and remove Narrative audio UI

- Add current `number` to the dialogue projection used by Narrative and
  Generation Context.
- Render it at the top right of each dialogue block.
- Remove the audio action, side panel, Dialog/Takes/Advanced components, setup
  autosave, player hook, services, HTTP routes, and tests.
- Delete the CLI `dialogue-audio` command and help text.

### Slice 5 — Add the Shot Plan Audio resource and approved cards

- Add the Core resource projection, speaker/profile derivation, resource keys,
  thin server routes, browser API, and invalidation hook.
- Add `audio` to `ShotPlanDetailTab` and place it right of Assets.
- Add the shared waveform player and focused Media Card audio-take variation.
- Implement the exact card/empty-state/selection/Trash rules from Product
  Behavior without extra copy or actions.
- Compare the full Studio window to the approved selected visual, not an
  isolated component screenshot.

### Slice 6 — Expose Take ranges and selection to generation workflows

- Add `number` to Scene dialogue context and `dialogueTurnRange` to audio
  reference candidates.
- Replace Scene-derived per-turn Take suggestions with exact Shot Plan Take
  suggestions.
- Keep all active candidates visible and mark every selected Take as
  `isWorkflowSelected`.
- Update video-reference continuity guidance to use selected candidates only,
  with no sole/latest fallback and no overlap validation in Core.
- Add the focused `media import --turns` adapter and delete old target parsing.

### Slice 7 — Add Seed Audio and transient configuration guidance

- Extend the Fal provider Skill scope and route index with
  `bytedance/seed-audio-1.0`.
- Add canonical model key `seed-audio-1.0`, the provider-neutral model guide,
  current source links, reference syntax, limits, voice-library guidance, and
  one-turn/multi-turn examples.
- Rewrite `cast-voice-sample.md` and replace `scene-dialogue-audio.md` with
  `shot-plan-dialogue-audio.md`.
- Add shared transient Codex configuration instructions using the Visualize
  host's follow-up-message interaction.
- Update Casting Director attachment guidance, Movie Director routing, Media
  Producer purpose coverage, model-guide validators, and forward evals.
- Add focused Fal Engine tests proving live Seed schema validation, local audio
  reference upload, and normalized audio output without adding a Seed-specific
  provider adapter.

### Slice 8 — Documentation and realistic verification

- Update current architecture, UI, CLI, provider, and Skill docs.
- Run migration fixtures and all focused package/Skill tests.
- Migrate a backed-up Urban Basilica database and verify exact rows/files/
  provenance before opening Studio.
- Perform desktop-only end-to-end verification of Narrative numbers, Cast Voice
  default selection, Shot Plan Audio cards, selection persistence, playback,
  Trash/restore, and Generation Context.
- Do not execute a paid ElevenLabs or Fal generation without a separate explicit
  authorization.

## Tests And Guardrails

### Core owning-layer tests

- `DialogueTurnRange` accepts `N`/`N-M` equivalents after CLI parsing and rejects
  non-integers, zero/negative values, and descending ranges.
- Attachment accepts a structurally valid range even when current screenplay
  turns later differ or disappear; no staleness warning or repair occurs.
- Attachment rejects missing Shot Plan, non-audio source/provenance, unsafe path,
  wrong output media kind, duplicate Asset linkage, and persistence failure
  before leaving partial files/rows.
- Single- and multi-turn Takes persist one row and one Asset/File each, with
  exact range, weak Shot Plan authorship, and immutable provenance.
- Two or more peer Takes can be selected independently, including overlaps;
  clearing one leaves the others selected.
- New Takes are unselected. Discard clears selection atomically; restore remains
  unselected.
- Projection derives distinct speakers in first-appearance order from current
  range numbers, uses only current selected Cast Profiles, caps the visible
  speaker representation at first three plus remainder count, and tolerates
  missing/out-of-range turns.
- Generation Context returns all active Take candidates with exact file,
  provenance, range, and selected state for only the exact Shot Plan.
- `cast.voice-sample` context includes Cast voice notes and current Cast Voices
  without provider controls.
- Provider-neutral file attachment can create Seed-generated, provider-retrieved,
  and custom samples without branching on provider/model identity.
- Opaque `voiceIdentity` round-trips unchanged, is bounded/safe JSON, and is
  never parsed for provider/model/capability or voice-id fields by Core.
- Core's built public contracts and package imports expose no provider
  registration, typed provider sample source, Engines fetcher, or
  ElevenLabs/model-specific Cast Voice capability.
- First active voice becomes default; later attachment does not replace it;
  explicit selection replaces it; removal clears it; restore does not restore
  it; wrong-owner/discarded voice fails before write.
- Settings v6 preserves a bounded opaque Audio provider preference, preserves
  all other fields, and projects it through existing workflow policy without
  using it for Core model/provider behavior.

### Migration tests

- A fresh database reaches generation 67 with new tables/field, Settings
  behavior, and no old Scene Dialogue Audio or Cast Voice provider-registration
  schema.
- A realistic version-66 fixture with the five Urban Take ids maps exact plan and
  range values, preserves ids/Assets/Files/provenance/timestamps, changes
  membership/type/authoredFrom correctly, and leaves all Takes unselected.
- The two Mara Takes both remain independent turn-2 candidates.
- Unexpected active legacy Take, missing target plan, malformed/wrong-version
  Settings, or conflicting ownership aborts the transaction without mutation.
- Existing Cast Voices receive exactly one deterministic default per Cast
  Member; every current provider registration becomes the exact simplified
  opaque voice identity, samples remain unchanged, and the registration table
  plus provider-specific sample-source columns are absent.
- The existing downloaded provider sample receives exact reconstructed
  `voice-sample-audio` provenance from its known stored retrieval facts;
  imported/generated samples receive no invented provenance.
- Existing Project Settings v5 becomes v6 with every value identical except the
  version.
- `PRAGMA foreign_key_check` and `PRAGMA quick_check` pass after migration.

### CLI and server adapter tests

- `generation context` accepts the new purpose/Shot Plan target and rejects the
  removed purpose/Scene Dialogue target as unsupported current contracts.
- `media import --turns` parses `2` and `2-4`, reports `CLI164` for missing,
  comma-separated, malformed, zero, or descending values, and delegates the
  parsed range without inspecting current screenplay.
- Cast Voice `attach` accepts only the provider-neutral file document; provider
  registration subcommands and the ElevenLabs fetcher injection are removed.
- Studio Shot Plan Audio and Cast Voice default routes delegate exact ids,
  serialize Core reports, stream only the validated Asset File, and map
  structured errors without reimplementing domain rules.
- Removed Scene dialogue routes return the normal current-route not-found
  behavior; no compatibility-specific response is added.

### Studio component and desktop E2E tests

- Narrative displays canonical turn numbers top right and contains no audio
  action or side panel.
- Shot Plan tabs read Shots / Assets / Audio and preserve routing/reload for the
  selected plan.
- Empty Audio tab contains only the approved restrained empty state.
- Single-speaker, four-speaker, over-four-speaker, and missing-profile cards
  match the approved 2x2 presentation and never show dialogue or character
  names.
- Audio playback exposes one time display and scrubber; selection and hover/
  focus Trash remain keyboard accessible.
- Multi-select persists after tab/plan navigation and resource invalidation.
- Discard removes a card and clears selection; restore returns it unselected.
- Cast Voice Samples show one default using shared Media Card choose-selection,
  allow switching, and retain hover/focus Trash.
- Full-window screenshots at the current desktop viewport compare typography,
  spacing, card height, portrait grid, waveform, selected state, and surrounding
  Studio chrome with the approved visual. Do not test mobile.

### Engine, Skill, and guide tests

- Fal Engine reads/validates the live Seed Audio schema, substitutes up to three
  local audio markers, and normalizes an `audio` output through the existing
  generic Fal protocol.
- ElevenLabs `voice-sample-audio` runs through its normal Engines provider
  boundary and returns a downloaded artifact plus exact safe provenance; no
  provider callback enters Core.
- Cast Voice Sample guidance uses direct user direction plus voice notes,
  targets ~30 seconds/70-85 words, one speaker/emotion/timbre, quiet background,
  and no existing sample conditioning.
- Every Cast Voice Sample request shows the transient configuration component
  and does not persist its choices.
- One-turn ElevenLabs has its Skill interpret the selected Cast Voice's opaque
  identity and use its voice id; changing an ElevenLabs model requires no Core
  contract or schema change.
- One-turn Seed uses the selected sample reference and creates one Take.
- Multi-turn Seed uses one selected sample per distinct speaker and creates one
  Take for the full consecutive range.
- More than three distinct speakers, more than 2,048 prompt characters, or
  likely over-two-minute output stops with a split/narrow question; no voice or
  reference is omitted.
- Disjoint user turns are redirected to separate Takes rather than silently
  combined.
- The Project Audio provider initializes the component, a request-time switch
  affects only that request, and a later request again initializes from Project
  Settings.
- Video workflows use every selected exact Take reference, preserve a multi-turn
  range as one reference, do not choose a sole unselected Take, do not silently
  truncate a route-limit overflow, and invent no audio field for an incapable
  route.
- Purpose coverage contains `cast.voice-sample` and
  `shot-plan.dialogue-audio`; no retired purpose remains.

Architecture tests protect public import boundaries, target/purpose
exhaustiveness, schema/runtime behavior, absence of provider imports from
Core/Studio, and a provider-opaque Cast Voice public contract. They must not
freeze private helper names, ban one historical provider literal through source
text, or enumerate every internal function.

## Documentation And ADR Effects

### New ADR

Add:

```text
docs/decisions/0090-use-shot-plan-dialogue-audio-and-provider-neutral-cast-voices.md
```

It records:

- Shot Plan Dialogue Audio Take ownership;
- simple stored consecutive turn ranges without Dialogue Turn links;
- multi-selection and selected-reference projection;
- removal of Scene setup/UI;
- provider-neutral Cast Voice samples and one default Cast Voice;
- opaque provider-Skill-owned voice identity and removal of Core Cast Voice
  provider registrations/sample execution;
- transient Codex configuration;
- Fal Seed Audio support through provider Skill/live schema; and
- exact provenance as the provider/model source of truth.

### Concise notices on prior ADRs

- ADR 0089: ADR 0090 supersedes only per-turn `scene.dialogue-audio`, per-turn
  single selection, sole-Take fallback, Scene setup CLI, and Studio Narrative
  setup/selection clauses. Video editing and provider prompt expansion remain.
- ADR 0069: Shot Plan video context now uses selected Shot Plan Dialogue Audio
  Takes with stored ranges rather than Scene Dialogue Audio workspaces.
- ADR 0074: Project Settings advances to v6 and Audio provider allows Fal.ai;
  Project Settings still owns only an opaque default provider/policy preference,
  not provider semantics or request controls.
- ADR 0034: transient Kling behavior remains, but its retained typed ElevenLabs
  provider-registration clause is superseded by opaque Cast Voice identity.
- ADR 0033: source-video behavior remains, but its Cast Voice Provider
  Registration table/model/capability contract is superseded.
- ADR 0029: Cast Voice remains durable Cast-owned data; ADR 0090 adds one default
  relation, provider-neutral file attachment, and provider-opaque voice identity
  while removing typed provider registrations and provider sample fields.

### Current documentation

Update:

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/project-asset-storage-conventions.md`
- `docs/ui/studio-screenplay.md`
- Shot Plan/Studio UI documentation that enumerates detail tabs
- `docs/cli/commands.md`
- Project Settings/provider documentation
- Media Producer, Fal provider, Casting Director, and Movie Director Skills,
  references, catalogs, validators, and evals in `studio-skills`

Do not edit historical plans or migrations to replace old terminology. Delete
current docs/instructions that still direct users to Narrative Dialog, Takes,
Advanced, `dialogue-audio show/setup`, or `scene.dialogue-audio`.

## Final Verification

### Focused automated checks

```bash
pnpm --dir packages/core test -- shot-plan-dialogue-audio cast-voice project-settings media-generation-context migrate-database
pnpm --dir packages/cli test -- media-import generation cast-voice
pnpm --filter @gorenku/studio test -- shot-plan-dialogue-audio cast-voice-sample scene-narrative shot-plan-detail
pnpm --dir packages/engines test -- fal-ai elevenlabs
```

Run the sister repository's Media Producer/Fal/Casting Director guide validators
and forward evals. Validate a local Seed Audio review document against the live
schema without executing it.

### Root verification

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Run the corresponding root validation/test commands in
`/Users/keremk/Projects/aitinkerbox/studio-skills`.

### Urban Basilica migration rehearsal

1. Start from the populated version-66 database and let the supported migration
   command create/verify its backup.
2. Run `renku project migrate urban-basilica` only after migration tests pass.
3. Verify schema generation 67, Settings v6, foreign keys, and quick check.
4. Verify the exact five Take-to-Plan/range mappings from Review Attention.
5. Verify all five existing files remain readable at their registered paths and
   their hashes/provenance are unchanged.
6. Verify old Scene Dialogue Audio tables are absent and no runtime code reads
   them.
7. Verify one default Cast Voice for each current voice-owning Cast Member,
   exact opaque identity conversion, unchanged sample files, exact retrieval
   provenance on the downloaded sample, and absence of provider-registration/
   provider-specific sample-source schema.
8. Open Studio and verify Narrator's missing selected Cast Profile shows the
   empty cell rather than another image.

### Desktop Product Design verification

At the normal supported desktop viewport:

1. capture the full Scene Narrative screen with turn numbers and no side panel;
2. capture Shot Plan Audio with single-speaker, multi-speaker, selected, and
   unselected cards;
3. compare the full window against the approved reference for tab placement,
   card proportions, portrait grid, quiet metadata, waveform, and actions;
4. verify selection and Trash by mouse and keyboard focus;
5. verify no forbidden copy/actions from Product Behavior appear; and
6. verify Cast Voice default selection in Cast Assets.

Do not report mobile behavior.

### Conversational workflow verification

- Show, submit, and inspect one Cast Voice Sample configuration component and
  one Shot Plan Dialogue Audio component.
- Verify each returns the exact transient choices to the conversation and does
  not change Project Settings.
- Validate one single-turn Seed request, one multi-turn Seed request, and one
  ElevenLabs request without paid execution.
- Verify the selected Shot Plan Audio Take paths/ranges appear in video
  Generation Context.
- A paid ElevenLabs or Fal smoke generation requires a separate explicit user
  authorization.

### Architecture-shape review

- Inspect `git diff --stat` and the complete diffs in both repositories.
- Inspect every new or heavily modified Cast Voice, Dialogue Audio, media-
  import, Media Card, route, and Skill file.
- Confirm deleted Scene audio files have no surviving current imports or tests.
- Confirm `index.ts` files are thin public entrypoints.
- Confirm no god file, provider/model switchboard, catch-all attachment helper,
  duplicated provider schema, compatibility layer, or unrelated formatting
  churn was introduced.
- Confirm the built Core public surface and schema contain no Cast Voice
  provider/model/capability union, provider registration, provider-specific
  sample source, provider fetcher, or provider compatibility branch; provider
  Skills can add another safe voice-identity shape without a Core change.
- Confirm each checklist item was satisfied by the planned module shape rather
  than by moving the old complexity into one new owning-layer file.

## Completion Checklist

### Review Area

- [x] Confirm `shot-plan.dialogue-audio` fully replaces
      `scene.dialogue-audio` with no alias or parallel runtime.
- [x] Confirm Cast Voice Sample reuses `cast.voice-sample` rather than adding a
      duplicate purpose or Skill.
- [x] Confirm a Take stores only Shot Plan, Asset/File, range, selection, and
      lifecycle facts; provider/model remain in exact Asset provenance.
- [x] Confirm no turn ids, speaker links, transcript, revision, membership rows,
      staleness system, overlap policy, or automatic split/combine behavior was
      added.
- [x] Confirm the final Audio card matches every approved removal/addition and
      the selected visual target.
- [x] Confirm existing ElevenLabs provider-sample/voice-id behavior remains.
- [x] Confirm Core has no Cast Voice provider/model/capability union, typed
      provider registration, provider sample retrieval, or compatibility rule.
- [x] Confirm paid execution did not occur without separate authorization.
- [x] Confirm architecture boundaries remain accepted and centralized ownership
      did not become monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Public Contracts

- [x] Add `DialogueTurnRange`, Shot Plan Dialogue Audio resource/Take/speaker
      contracts, commands, reports, Asset type, destination, and resource key.
- [x] Replace the media purpose/target/output maps and delete the Scene Dialogue
      target/context contracts.
- [x] Add dialogue `number` and Take candidate `dialogueTurnRange` to Generation
      Context.
- [x] Add Cast Voice `isDefault`, opaque `voiceIdentity`, provider-neutral file
      attachment document, and default-selection command.
- [x] Move generic `JsonValue` out of the media-generation review module and
      update callers directly so Cast Voice has no generation-module dependency.
- [x] Add Project Settings v6 with a bounded opaque Audio provider preference;
      keep ElevenLabs/Fal.ai choice curation outside Core generation logic.
- [x] Add the exact CLI syntax, HTTP routes, and `CLI164`/Core diagnostics.
- [x] Keep package-boundary failures structured and durable business rules in
      Core.
- [x] Update callers directly without compatibility readers, aliases, wrappers,
      or convenience mirrors of retired state.

### Schema And Migration

- [x] Edit the Drizzle TypeScript schema first and generate migration 0083 with
      Drizzle Kit and its snapshot/journal.
- [x] Add only the documented custom preservation/mapping SQL required around
      the generated schema change.
- [x] Advance `PRAGMA user_version` from 66 to 67.
- [x] Create `shot_plan_dialogue_audio_take`, `cast_voice_default`, and nullable
      `cast_voice.voice_identity` with the exact constraints in this plan.
- [x] Guard Settings and unexpected legacy Take state before mutation.
- [x] Map Narrator turn 1 to `shot_plan_bm34r9be`.
- [x] Map both Mara turn 2 Takes plus Urban turn 3 and Mehmed II turn 4 to
      `shot_plan_sp24knrj`.
- [x] Preserve all five Take ids, Assets, Asset Files, paths, exact provenance,
      timestamps, and unselected state.
- [x] Move the five Assets to Project membership, new type, and exact weak Shot
      Plan authorship without moving file bytes.
- [x] Seed one default from the earliest active voice per Cast Member.
- [x] Convert each current registration to simplified opaque voice identity and
      discard model/capability fields.
- [x] Reconstruct exact `voice-sample-audio` provenance only for the known
      downloaded provider sample; invent none for imported/generated samples.
- [x] Upgrade Settings v5 to v6 without changing existing values.
- [x] Drop the provider-registration table, four provider-specific Cast Voice
      sample-source columns, and all three old Scene Dialogue Audio tables; leave
      no runtime reader.
- [x] Prove fresh-database, rollback, foreign-key, and quick-check behavior.

### Core Dialogue Audio Implementation

- [x] Implement rollback-safe single-output attachment and new human-readable
      Shot Plan audio destination.
- [x] Implement active Take projection ordered deterministically by creation/id.
- [x] Derive current speaker/profile presentation without persisting it.
- [x] Implement independent multi-selection with no peer clearing.
- [x] Clear selection on discard and keep restore unselected.
- [x] Emit exact Shot Plan Dialogue Audio resource invalidations.
- [x] Project all Takes, ranges, files, provenance, and selected states into
      Shot Plan generation context.
- [x] Delete the old setup, context, attachment, selection, Take, and schema
      modules.

### Cast Voice Implementation

- [x] Split the broad Cast Voice command file into the planned focused module.
- [x] Replace both attachment kinds with one provider-neutral sample-file
      attachment and optional opaque voice identity.
- [x] Delete provider registration commands/contracts/projection/storage,
      provider-specific sample-source projection, and Engines fetcher injection
      from Core.
- [x] Round-trip bounded safe `voiceIdentity` JSON without parsing provider,
      model, capability, or voice-id semantics.
- [x] Run ElevenLabs provider sample retrieval through the normal Engines
      provider operation and provider Skill before Core attachment.
- [x] Auto-select only the first active Cast Voice.
- [x] Implement exact default replacement, removal clearing, default restoration,
      and conflict-safe restore behavior.
- [x] Project `isDefault` through Core, server, services, and Cast Assets UI.

### CLI And Studio Server

- [x] Refactor media import into the bounded layout before adding the second
      purpose-specific attachment branch.
- [x] Add `--turns N|N-M` parsing and thin focused delegation.
- [x] Delete the `dialogue-audio` top-level command and help text.
- [x] Delete Cast Voice provider-registration subcommands and the
      ElevenLabs-specific `cast voice attach` fetcher branch.
- [x] Add thin Shot Plan Audio read/select/clear/delete/file routes.
- [x] Add the thin Cast Voice default route.
- [x] Delete screenplay Dialogue Audio routes and adapter tests.
- [x] Verify adapters do not resolve speakers, validate screenplay ranges, or
      implement provider rules.

### Studio Narrative And Audio UI

- [x] Render canonical turn numbers at the top right of Dialogue blocks.
- [x] Remove Narrative's audio action, panel, hook, services, Dialog tab, Takes
      tab, Advanced tab, and setup autosave.
- [x] Add Audio right of Assets in `ShotPlanDetailTab` and navigation state.
- [x] Add the focused Audio resource hook and refresh-key handling.
- [x] Add the shared waveform player using shadcn actions and one time display.
- [x] Add the Media Card audio-take presentation with normal selected styling,
      toggle selection, and hover/focus Trash.
- [x] Show the 2x2 selected-profile/empty/count speaker composition exactly.
- [x] Keep dialogue text, character names, right action column, duplicate
      duration, link/inspect action, heading/subtitle, count, and New Take absent.
- [x] Add only the restrained `No audio yet.` empty state.
- [x] Refactor Voice Sample cards to shared Media Card default selection without
      adding generation actions.

### Seed Audio, Inline Configuration, And Skills

- [x] Add the exact Seed Audio route/model key/operation to Fal and canonical
      model indexes.
- [x] Expand Fal provider Skill scope to audio without adding a Seed-specific
      transport client.
- [x] Add the provider-neutral Seed Audio model guide with current source links,
      reference syntax, examples, and reviewed limits.
- [x] Rewrite Cast Voice Sample guidance for ElevenLabs and Seed Audio paths.
- [x] Replace Scene Dialogue Audio guidance with Shot Plan range guidance.
- [x] Add the shared always-shown transient Codex configuration instructions.
- [x] Preselect Project provider and compatible default Cast Voice without
      persisting request-time switches.
- [x] Keep Seed Cast Voice Sample creation text-description-only and around 30
      seconds/70-85 words.
- [x] Stop and ask on >3 distinct references, >2,048 prompt characters, likely
      >2 minutes, missing compatible voice, or disjoint turns.
- [x] Update selected-audio video continuity with no sole/latest fallback.
- [x] Update Casting Director, Movie Director, catalogs, purpose coverage,
      validators, examples, and forward evals.

### Tests And Guardrails

- [x] Add complete owning-layer Take/range/selection/projection/attachment/
      rollback behavior tests.
- [x] Add complete Cast Voice file/opaque-identity/default lifecycle tests and
      ElevenLabs provider-operation tests at Engines/Skill ownership.
- [x] Add Settings v6 and exact migration preservation/abort tests.
- [x] Add thin CLI and HTTP delegation/error serialization tests.
- [x] Add Narrative, Audio tab/card, Voice Sample, and desktop E2E tests.
- [x] Add Fal live-schema/audio-output tests without duplicating the provider
      schema.
- [x] Add Skill evals for configuration, single/multi-turn generation, limits,
      and selected video references.
- [x] Protect stable imports/contracts/runtime boundaries rather than private
      implementation names.
- [x] Run all shape-review checks from Final Verification.

### Documentation And ADRs

- [x] Add ADR 0090 and concise notices to ADRs 0089, 0069, 0074, 0034, 0033,
      and 0029.
- [x] Preserve ADR 0033's source-video decision while superseding its typed
      Cast Voice provider-registration boundary.
- [x] Update current data model, domain vocabulary, files/assets, storage,
      generation, UI, CLI, Settings, and Skill docs.
- [x] Remove current instructions for the retired Scene panel, setup CLI, and
      purpose.
- [x] Leave historical plans and migrations unchanged.

### Final Verification

- [x] Run focused Core, CLI, Studio, Engines, and Skill tests.
- [x] Run root build, test, lint, and check in Studio and sister Skill repo.
- [x] Validate Seed requests/live schema without a paid generation.
- [x] Migrate backed-up Urban Basilica and verify exact mapping, files,
      provenance, Settings, defaults, foreign keys, and quick check.
- [x] Perform desktop-only Product Design comparison to the approved full-window
      visual.
- [x] Verify transient configuration returns exact choices and never changes
      Project Settings.
- [x] Verify selected single- and multi-turn Take references in video Generation
      Context.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect large/heavily modified files and confirm `index.ts` entrypoints
      remain thin.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete and summarize the accepted contract in
      current documentation.
