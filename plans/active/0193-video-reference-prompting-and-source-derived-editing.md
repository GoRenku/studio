# 0193 Capability-Aware Video Continuity, Prompting, And Editing

Status: completed

Completed: 2026-08-30
Date: 2026-08-30

## Review Attention

- `video.edit` applies to **every active registered Asset with a current video
  file**, regardless of Asset type or owner. The earlier `shot_plan_video`
  restriction was an incorrect inference from the only video type currently
  populated in Urban Basilica.
- Dialogue Audio references are **capability-based, not Wan-specific**. For any
  video route whose live schema accepts audio reference media, the agent uses
  the selected Scene Dialogue Audio Take by default unless the user asks to omit
  it. It never invents an audio field for a route that does not expose one.
- The current branch does not actually persist a Scene Narrative Dialogue Take
  selection: migration `0043` removed it, the Narrative Takes tab never marks a
  Take selected, and the remaining Shot Dialogs selector is unused. Satisfying
  the requested default therefore requires a new Core-owned per-Dialogue
  selection relationship and Narrative UI action. This deliberately supersedes
  the “no Scene-level selection” product rule recorded in plan 0096.
- The existing `scene.dialogue-audio` purpose already is the correct per-turn
  purpose. This plan does **not** add a duplicate purpose or a thin parallel
  Skill. It completes the existing Media Producer workflow with a focused
  Dialogue Audio guide and agent-facing CLI setup/read commands so one request
  can generate one turn or every turn in a Scene as separate ElevenLabs files.
- Project Settings advances from version 4 to version 5 and adds
  `generation.enableProviderPromptExpansion`, defaulting to `true` for new and
  existing Projects. Studio adds the General Settings toggle “Enable prompt
  expansion at the provider level when available for a model.”
- Core, Studio, CLI, and Engines do not own a map from that setting to native
  provider field names. The agent reads the selected route's live schema and
  documentation, recognizes an unambiguous prompt-expansion control by meaning,
  and sets it to the Project preference only when available.
- Gemini Omni guidance changes source authority: Google's official Omni prompt
  guide becomes the canonical craft source; Fal route schemas remain the
  authority for fields exposed through the installed Fal provider. Wan craft
  remains sourced from Fal's detailed Wan 3 guide and live route schemas.
- Omni should be suggested for 360p exploration, 4K upscaled output, video
  references, conversational editing, and continuation. Execution still stops
  if the installed provider's live schema does not expose the requested
  capability. In particular, neither the official current Google API nor the
  checked Fal reference route accepts uploaded audio references.
- Existing image-edit behavior, Project provider choices, Preview/confirmation,
  provider execution, opaque prompt handling, and canonical Asset selection are
  kept unchanged. This plan adds no video-edit button, model picker, provider
  capability database, provider-native Settings fields, or durable generation
  chain.

## Summary

The failed Wan run came from two planning and guidance errors: Dialogue Audio
was treated as an optional Wan example instead of a continuity default for any
capable video route, and the only currently populated video Asset type was
mistaken for the valid scope of video editing. Prompt guidance also did not make
the Project's provider-side prompt-expansion preference explicit, and the Omni
guide predated Google's official prompt guide.

This plan makes video work capability-aware while preserving the current
architecture:

1. Core reports the user's exact selected Dialogue Take as deterministic
   Project evidence.
2. Media Producer applies a provider-neutral continuity policy against the
   selected route's live schema.
3. The existing ElevenLabs `scene.dialogue-audio` purpose becomes a complete
   agent workflow for one Dialogue Turn or a whole Scene, one output per turn.
4. Project Settings carries the provider prompt-expansion preference into every
   Generation Context report.
5. Wan and Omni guides gain source-backed examples and explicit route-selection
   advice.
6. `video.edit` accepts any video Asset and persists a separate source-derived
   candidate beside the source without parsing Asset type or filename for
   ownership.

## Product Behavior

### Dialogue Audio continuity for video generation

For every video-generation request whose target context contains Dialogue
Turns, the agent follows this order before authoring the provider request:

1. Read the complete `generation context` report.
2. Choose the provider/model/operation and inspect its live schema.
3. Determine whether the route accepts uploaded audio reference media. The
   field's exact spelling is provider-native and is not assumed from model name.
4. For each relevant Dialogue Turn:
   - if a Take is selected in Scene Narrative, use that Take;
   - if no Take is selected and exactly one active Take exists, use the sole
     Take;
   - if no Take is selected and several active Takes exist, stop and ask the
     user which Take to select, directing them to that Scene's **Narrative** tab,
     the Dialogue block, and its **Takes** tab;
   - if no active Take exists, stop and ask the user to create Dialogue Audio
     for that Dialogue in the Scene Narrative workflow.
5. Include the resolved Dialogue Audio references by default. Omit them only
   when the user explicitly asks to omit them.

If the selected route cannot receive audio reference media, the agent must not
silently fall back to native generated dialogue. It explains that exact
Dialogue Audio continuity cannot be supplied, suggests a capable model when one
is available, and asks whether to switch or continue without the reference.

If the number of resolved Dialogue Audio files exceeds the route's live limit,
the agent does not silently truncate the list. It asks the user to narrow the
dialogue scope or choose another capable route.

A Scene with no Dialogue Turns has no Dialogue Audio prerequisite. Audio
references condition the model; they are not represented as guaranteed final
mix replacement unless the selected provider explicitly documents that
behavior.

### Selecting Dialogue Takes in Scene Narrative

Every Scene Dialogue Audio workspace can have zero or one selected active Take
per Dialogue Turn.

- The Narrative Takes tab shows `Selected` on the selected Take.
- `Pick` selects another Take through a focused Core command.
- A visible `Clear selection` action returns the Dialogue to no selection.
- Generating or attaching a new Take does not auto-select it.
- Discarding the selected Take clears the selection atomically.
- Restoring a discarded Take restores only the Take, not its former selection.
- Existing Projects migrate with every current Take unselected; no “latest” or
  “first” Take is promoted during migration.

This selection is a user-authored continuity default for agent video workflows.
It is distinct from common Asset display selection and from provider request
provenance.

### Generating Dialogue Audio through the agent

The current `scene.dialogue-audio` purpose remains exact and per Dialogue Turn.
The Media Producer Skill supports two user intents:

- **One Dialogue:** generate a new Take for one exact Scene Dialogue Turn.
- **Whole Scene:** generate one independent Take for each Dialogue Turn in
  screenplay order. It never concatenates the Scene into one audio file.

ElevenLabs is the only supported provider for this workflow for now. For each
turn the agent uses its assigned Cast Member, current Cast Voice registration,
saved or newly authored Dialogue Audio setup, and the current ElevenLabs model
guide. Missing Cast membership, missing ElevenLabs voice registration, or an
ambiguous Cast Voice choice stops that turn with a clear user action.

For a whole-Scene request:

- the agent shows the Scene workspace first;
- if some turns already have Takes, it asks whether the user wants only missing
  turns or a new Take for every turn unless the user's request already answers
  that choice;
- each turn gets its own review document, provider request, output file,
  provenance, and `scene_dialogue_audio` Asset/Take attachment;
- independent turns may follow the Audio concurrency policy from Project
  Settings; and
- one failed turn does not get represented as a successful combined Scene
  result.

The removed Studio Generate button stays removed. Conversation plus the Media
Producer Skill is the generation surface; Narrative remains the setup, review,
playback, deletion, and selection surface.

### Provider-level prompt expansion

General Project Settings shows:

> Enable prompt expansion at the provider level when available for a model

The default is on. Generation Context returns the effective value as
`workflowPolicy.enableProviderPromptExpansion` for image, video, and audio
purposes.

After selecting the exact provider route, the agent reads its live schema and
field descriptions:

- if one field clearly controls provider prompt expansion or provider prompt
  rewriting, set it to the Project value;
- if the route exposes no such control, omit it;
- if the schema is ambiguous, consult the selected provider documentation and
  do not guess.

There is no checked-in cross-provider map of native field names. A model guide
may explain the behavioral consequence of expansion and cite a current example,
but the live schema remains authoritative for the executable field.

When expansion is enabled, the agent authors hard constraints explicitly enough
to survive rewriting and reviews a returned rewritten/actual prompt when the
provider supplies one. The authored prompt remains unchanged in the review
document and durable provenance.

### Wan prompt craft

The Wan 3.0 Prime guide retains Fal as its source and expands its examples to
cover the prompt shapes Fal documents:

- compact single-action exploration;
- labeled block briefs;
- timecoded multi-beat prompts;
- numbered clip/reference roles;
- start/end-frame continuity; and
- combined image, video, and audio references with one narrow role each.

Examples are concise paraphrases, not copied articles. Each example shows how
non-negotiable identity, camera, timing, sound, and exclusions survive provider
prompt expansion, and how to compare the provider's returned actual prompt with
the authored prompt.

### Gemini Omni recommendation and prompt craft

The official Google Omni guide becomes the canonical prompt-craft source. The
guide and route-selection instructions make the agent aware of:

- 360p as the cheap/fast preview choice when the live route exposes it;
- 4K as upscaled output, not native detail recovery;
- video references for likeness, objects, motion, or scene behavior;
- concise conversational edits with explicit preservation language;
- continuation in 10-second increments, bounded by the live route/model total;
  and
- role tags, timecoded events, native sound direction, readable text guidance,
  and explicit “single continuous shot/no cuts” language when one shot is
  required.

Media Producer should suggest Omni when those capabilities match the request,
while still respecting the Project's selected provider lane and asking before a
provider/model switch.

The guide distinguishes model capability from installed-route capability. For
example, Google's official API documents 3–10 second continuation and up to 40
seconds total, while the agent must still find a continuation input in the
current Fal schema before executing it. The checked current Google/Fal
reference routes do not accept uploaded audio references, so the general
Dialogue Audio policy must not create an audio field for Omni.

### Editing any video Asset

`video.edit` targets `asset:<asset-id>` and accepts any active registered Asset
that has a current video AssetFile. Asset type and owner are not allowlists.

Before execution, the source video appears as the exact source reference in
Generation Context and the reviewed provider-native request. Core attachment
then requires the exact current source AssetFile path to be present in the safe
provenance request.

An accepted output becomes a new, ready, unselected Asset that:

- keeps the source owner, Asset type, title/metadata defaults, locale, and weak
  `authoredFrom` context;
- contains one primary video file;
- stores the exact new generation provenance; and
- is placed beside the source file with a Core-owned generated name such as
  `edited-video-gxxx.mp4`.

The source's registered directory is used only as the destination root. Core
does not parse its filename or directory to infer ownership, type, selection,
or Shot Plan identity; those facts come from SQLite.

The same purpose covers a provider-native continuation of a video. Each
accepted continuation is a separate source-derived candidate, and another
increment targets the latest accepted candidate. Provider interaction ids stay
inside opaque receipt/provenance evidence; no durable edit-chain table is added.

If an Asset contains several current video files and the reviewed request does
not identify exactly one of them as the edit source, attachment fails before a
write. Non-video Assets, discarded Assets, missing files, unsafe paths, and
provenance that does not reference the target source also fail before a write.

## Explicit Non-Goals

- No Wan-only audio policy or model-name capability switch.
- No hardcoded prompt-expansion native-field map.
- No runtime interpretation or rewriting of creative prompts or media.
- No provider capability database, normalized provider request contract, or
  Studio model picker.
- No new Google provider integration; current execution remains through
  installed providers.
- No guarantee that every Omni model capability is exposed by every Fal route.
- No combined whole-Scene Dialogue Audio file.
- No Studio Generate button for Dialogue Audio or video editing.
- No automatic Dialogue Take selection after generation or migration.
- No mutation of the source video Asset and no automatic replacement of a
  canonical selection.
- No editing of arbitrary unregistered filesystem videos. They must first
  become a deliberately owned Project Asset through the existing import path.
- No compatibility alias for the version-4 Settings document or retired
  Dialogue Audio pick contracts.

## Requirement Ledger

| ID | Requirement | Source | Owner | Verification |
| --- | --- | --- | --- | --- |
| R1 | Edit any active video Asset without type/owner allowlisting. | User correction 1 | Core `video.edit` context/attachment | Core matrix over several owners/types |
| R2 | Use Dialogue Audio by default for every video route that accepts audio reference media. | User correction 2 | Media Producer + live schema | Cross-model Skill evals |
| R3 | Use selected Take, sole Take, ask on ambiguity, and direct missing work to Scene Narrative. | User correction 2 | Core selection/context + Skill | Core/UI tests and Skill evals |
| R4 | Generate one Dialogue or a whole Scene through ElevenLabs, one file per turn. | User correction 3 | Existing purpose + Media Producer + CLI | CLI/Skill integration cases |
| R5 | Persist a default-on provider prompt-expansion Project preference and return it in context. | User correction 4 | Core Settings/policy + Studio | Migration, Core, and UI tests |
| R6 | Map prompt-expansion preference through agent understanding of the live schema, not a field-name map. | User correction 4 | Media Producer/provider Skills | Skill evals and diff inspection |
| R7 | Add source-backed Wan prompt examples and expansion-aware craft. | User | Wan guide | Guide validator/evals |
| R8 | Use Google's official Omni prompt guide and surface 4K, 360p, video references, extension, and editing. | User | Omni guide + route selection | Guide validator/evals |
| R9 | Keep provider-native request facts in live schemas/adapters and prompts/media opaque at runtime. | Decisions 0041, 0086, 0087 | Engines/Skills boundary | Architecture review |
| R10 | Preserve safe, source-derived attachment, rollback, provenance, and human-readable storage. | Decisions 0076, 0088 | Core | Failure/rollback/path tests |

## Current Evidence And Constraints

### Implementation evidence

- `packages/core/src/client/media-attachments.ts` already defines
  `scene.dialogue-audio`, and `packages/core/src/server/generation/attachments.ts`
  already attaches one generated Take per exact Dialogue Turn.
- `packages/core/src/server/media-generation-context/purposes/shot-plan.ts`
  reports all active Dialogue Audio Take candidates but does not identify a
  workflow-selected Take.
- `packages/core/drizzle/0043_drop_scene_dialogue_audio_pick.sql` removed the
  prior Scene-level pick field. The current schema has no replacement.
- `scene-dialogue-audio-takes-tab.tsx` already has reusable `Pick`/`Selected`
  presentation props, but the panel always passes every Take as unselected and
  supplies no pick callback.
- `shot-dialogs-tab.tsx` contains an unused take picker and has no production
  caller. It must not become a second selection owner.
- Core exposes Dialogue Audio workspace/setup/attachment services to Studio,
  but the CLI exposes only generic `generation context` and `media import`; an
  agent cannot author initial Dialogue Audio setup through a focused command.
- Project Settings is one version-4 singleton JSON document. Generation Context
  already projects `GenerationWorkflowPolicy`, so the new preference fits the
  existing owner without a parallel settings service.
- `image.edit` already proves exact source-reference validation and separate
  source-derived candidate attachment, but its continuation registry is
  intentionally type-specific. Video editing needs a media-kind-wide sibling
  destination rather than copying the image type allowlist.
- The Project Asset model already accepts arbitrary `type` strings and every
  owner in `AssetOwner`; `mediaKind` is the correct video capability boundary.

### Urban Basilica evidence

Read-only inspection on 2026-08-30 found:

- a version-4 Project Settings document with Fal video and ElevenLabs audio;
- four Scene Dialogue Audio workspaces and five active Takes;
- one Dialogue Turn with two active Takes, proving the ambiguous-selection path
  is real rather than hypothetical; and
- three active `shot_plan_video` Assets, proving why the previous plan saw only
  that type while not justifying a product allowlist.

### Source provenance

| Guide | Canonical craft source | Executable route source |
| --- | --- | --- |
| Wan 3.0 Prime | Fal, `https://fal.ai/learn/tools/how-to-use-wan-3` | Selected Fal route's live schema/API page |
| Gemini Omni Flash 1.1 | Google, `https://ai.google.dev/gemini-api/docs/omni#prompt-guide` | Selected Fal route's live schema/API page and Fal adapter |

The prior Omni guide explicitly said no deep official guide was available when
it was written. That statement is now stale and must be replaced, not retained
as a fallback authority.

### Accepted architecture

- `packages/core` owns Project Settings, Dialogue Take selection, Asset
  ownership, source validation, attachment, storage, and resource keys.
- Studio routes and CLI commands remain thin delegates to Core.
- Engines owns provider protocol/schema validation but not Project policy or
  provider-neutral field mapping.
- Media Producer and provider Skills own provider/model/operation selection and
  creative request authorship from the live schema.
- Decision 0041 keeps prompts and media opaque to runtime code.
- Decisions 0074, 0076, 0086, 0087, and 0088 constrain Settings, storage,
  provider execution, context, and source-derived attachment.

## Options Considered

### Reuse unchanged

Rejected. The existing purpose and attachment are reusable for per-turn
Dialogue Audio, but there is no agent setup command, no current selected Take,
no prompt-expansion preference, and no video-edit purpose.

### Extend current owners

Accepted. Extend the existing Settings document/policy, Dialogue Audio
workspace, Generation Context suggestions, Media Producer Skill, provider
guides, Asset attachment pipeline, and destination registry.

### Add parallel model-specific systems

Rejected. A Wan audio policy, Omni command family, provider capability table,
new Dialogue Audio purpose, or standalone wrapper Skill would duplicate current
owners and make provider facts stale.

## Architecture Shape Gate

### Core ownership and module layout

```text
packages/core/src/server/
  scene-dialogue-audio-workspace/
    context.ts                 # projects selectedTakeId with workspace data
    selection.ts               # select/clear and exact Take membership checks
    setup.ts                   # existing per-turn setup
    attachments.ts             # existing one-file/one-turn attachment
    takes.ts                   # discard clears selection atomically

  video-edit-attachments/
    source.ts                  # exact active video Asset/File + provenance match
    attachment.ts              # new separate Asset and rollback-safe persistence
    resource-keys.ts           # owner/weak Shot Plan refresh keys
    index.ts                   # thin bounded public entrypoint only

  project-asset-files/destinations/
    asset-video-edit.ts        # source-sibling root and edited-video-gxxx naming

  media-generation-context/
    purposes/asset.ts          # image.edit and video.edit source projection
    purposes/shot-plan.ts      # selected Dialogue Audio candidate marking

  project-settings/
    document.ts                # version-5 schema/default
    generation-policy.ts       # effective prompt-expansion preference
```

The existing package public `index.ts` files may export the focused new Core
entrypoints and types only. They must not absorb selection validation, source
resolution, storage, or provider branches.

`ProjectAssetFileDestination` adds one destination:

```ts
{ kind: 'asset.videoEdit'; sourceAssetId: string; sourceAssetFileId: string }
```

Its resolver validates the exact registered source relationship, uses the
source AssetFile's safe parent directory, and allocates a fixed generated stem.
It does not switch on Asset type or owner.

### CLI shape

Add a focused command folder:

```text
packages/cli/src/commands/dialogue-audio/
  command.ts       # thin subcommand dispatch
  show.ts          # read Scene workspace
  setup.ts         # parse complete setup JSON and delegate
```

Public commands:

```bash
renku dialogue-audio show --scene <scene-id> --json
renku dialogue-audio setup --scene <scene-id> --dialogue <turn-id> --file <setup.json> --json
```

Generation and attachment continue through existing commands:

```bash
renku generation context --purpose scene.dialogue-audio --target scene:<scene-id>:dialogue:<turn-id> --json
renku media import --purpose scene.dialogue-audio --target scene:<scene-id>:dialogue:<turn-id> ...
```

There is no `dialogue-audio generate` command; generation remains provider-Skill
orchestration. `cli.ts` adds one thin top-level dispatch branch and help text.

### Studio shape

The existing screenplay Dialogue Audio route, API client, hook, panel, and Takes
tab are extended. Selection rules do not live in React or Hono. The Takes tab
renders the selected id returned by Core and calls focused select/clear routes.
The unused Shot Dialogs selector and its isolated test are removed so Narrative
is the only current selection surface.

### Skill shape

```text
studio-skills/skills/media-producer/references/
  scene-dialogue-audio.md
  video-reference-continuity.md
  model-guides/video/wan-3.0-prime/*
  model-guides/video/gemini-omni-flash-1.1/*
```

Media Producer remains the workflow owner. Provider Skills remain transport and
native-field owners. Model guides own model-specific craft; the Fal adapter owns
current Fal marker fields/mentions; live schemas own current capability.

### Bounded registries and dispatch

- Add `video.edit` to the existing exhaustive purpose/target/output maps and
  purpose-builder registry.
- Add `asset.videoEdit` to the focused destination resolver registry.
- Add the Dialogue Audio command to the CLI's existing top-level command
  dispatch.
- Do not add a provider/model switch in Core or a generic source-derived
  “handler” containing image and video business rules.

### Stop conditions

Stop and revise before implementation continues if:

- video acceptance depends on `shot_plan_video` or another Asset type list;
- Core/Studio/CLI starts recognizing native prompt-expansion field names;
- a provider guide becomes a second provider schema;
- Dialogue Audio selection is derived from first/latest Take rather than stored
  user intent or the explicit sole-Take rule in the Skill;
- whole-Scene audio is concatenated or represented by one attachment;
- video destination logic infers owner/type/authorship from a path;
- `generation/attachments.ts`, `cli.ts`, a Hono route, or a React hook absorbs
  the new business rules; or
- an `index.ts` grows beyond thin exports/registration.

## Public Contracts

### Media purpose and context

- Add `video.edit` to `MediaPurpose`.
- Map it to target kind `asset` and output kind `video`.
- Add reference role `source-video`.
- Add `isWorkflowSelected: boolean` to
  `MediaGenerationReferenceCandidate`. Existing `isDisplaySelected` remains an
  informational display fact; only the new field marks a user selection that a
  purpose guide treats as a workflow default.
- `buildAssetPurposeContext` emits `source-image` for `image.edit` and
  `source-video` for `video.edit`.

### Dialogue Audio selection

- Add table `scene_dialogue_audio_take_selection` with one row per
  `scene_dialogue_audio_id`, an exact `take_id`, timestamps, and foreign keys to
  both owning rows.
- Add `selectedTakeId: string | null` to `SceneDialogueAudio`.
- Add Core service methods:
  - `selectSceneDialogueAudioTake`
  - `clearSceneDialogueAudioTakeSelection`
- Add Studio routes:
  - `PUT /screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/selected-take/:takeId`
  - `DELETE /screenplay/scenes/:sceneId/dialogue-turns/:turnId/audio/selected-take`
- Selection validates that the active Take belongs to the exact Dialogue Audio
  workspace before writing.

### Project Settings

```ts
interface ProjectSettingsDocument {
  version: 5;
  // existing fields
  generation: {
    displayPreview: boolean;
    enableProviderPromptExpansion: boolean;
    image: GenerationMediaSettings<...>;
    video: GenerationMediaSettings<...>;
    audio: GenerationMediaSettings<...>;
  };
}

interface GenerationWorkflowPolicy {
  // existing fields
  enableProviderPromptExpansion: boolean;
}
```

The version-5 migration preserves every existing setting, adds the new field as
`true`, and advances only accepted version-4 documents. Invalid or unexpected
documents abort the migration without mutation.

### Dialogue Audio CLI setup document

`dialogue-audio setup` reads one complete current `SceneDialogueAudioSetup`
JSON document. It does not introduce a CLI-only shape, defaults, or voice
validation. Core remains the validator and returns the refreshed workspace and
resource keys.

### Video edit attachment

`attachVideoEditMedia` accepts only:

- purpose `video.edit`;
- target `{ kind: 'asset'; id: string }`;
- one output source path;
- optional title/Asset metadata;
- exact video generation provenance; and
- normal session/project/id-generator dependencies.

It returns the standard generated media attachment report. Diagnostics:

- `CORE_VIDEO_EDIT_SOURCE_INVALID`
- `CORE_VIDEO_EDIT_SOURCE_REFERENCE_MISSING`
- `CORE_VIDEO_EDIT_SOURCE_REFERENCE_AMBIGUOUS`
- existing safe-path, provenance, persistence, and rollback diagnostics where
  those owners already define the failure.

## Implementation Slices

### Slice 1 — Record the changed product decision

- Add ADR 0089 for capability-aware video continuity, Dialogue Take defaults,
  provider prompt-expansion preference, and media-kind-wide video editing.
- Add concise notices to Decisions 0074, 0087, and 0088 rather than rewriting
  their history.
- State that ADR 0089 supersedes plan 0096's “no Scene-level selection” rule;
  leave the historical plan unchanged.

### Slice 2 — Add version-5 Project Settings

- Extend client types, defaults, AJV schema, error copy, serialization tests,
  policy resolver, and context tests.
- Add the General Settings toggle with the exact approved label and a concise
  description of live-schema application.
- Generate the Drizzle migration for the new selection table. Add the narrowly
  documented custom JSON guard/update required for the Settings property bag,
  because Drizzle's table-schema diff cannot express a JSON document upgrade.
- Add migration tests for valid v4 preservation, invalid-document rollback,
  and an empty new database.

### Slice 3 — Restore Narrative Dialogue Take selection

- Add the selection table and focused Core select/clear module.
- Project `selectedTakeId` in the workspace.
- Clear selection inside selected-Take discard; keep restore unselected.
- Wire thin project-data service methods and Hono routes.
- Reuse the existing Takes tab `Pick`/`Selected` presentation and add clear
  behavior.
- Delete the unused Shot Dialogs selector/test so selection has one UI owner.

### Slice 4 — Expose Dialogue Audio setup to the agent

- Add `dialogue-audio show` and `dialogue-audio setup` CLI commands.
- Keep setup validation in the existing Core workspace service.
- Add a dedicated Media Producer `scene-dialogue-audio.md` guide for one-turn
  and whole-Scene orchestration.
- Update Movie Director/Media Producer routing and forward evals so natural
  language requests reach the existing purpose.
- Prove whole-Scene work emits one request and one attachment per Dialogue Turn.

### Slice 5 — Project workflow-selected Dialogue Audio references

- Mark the exact Asset for `selectedTakeId` as `isWorkflowSelected` in each
  `dialogue-audio` suggestion.
- Keep all active candidates visible and deterministically ordered.
- Do not make missing/ambiguous creative material a Core context error; the
  Skill owns the requested ask/direct behavior.
- Add the shared `video-reference-continuity.md` policy and require it for video
  workflows.
- Add evals across two audio-capable route schemas plus one incapable schema to
  prove behavior is capability-based rather than model-name-based.

### Slice 6 — Add media-kind-wide `video.edit`

- Add purpose maps, `source-video` context, and focused attachment dispatch.
- Add `video-edit-attachments/` source validation, attachment, and resource-key
  modules.
- Add `asset.videoEdit` destination and resolver.
- Preserve source owner/type/metadata/locale/authorship while creating a new
  unselected Asset.
- Reuse the existing safe provenance, write-set rollback, and generated-file
  persistence boundaries.

### Slice 7 — Refresh Wan guidance

- Expand Wan operation guides with paraphrased Fal examples for one-line,
  block, timecoded, numbered-clip, frame-bound, and multimodal prompts.
- Explain prompt expansion as provider rewriting governed by Project policy and
  live schema, not as an always-on hardcoded field.
- Add before/after actual-prompt review guidance without mutating the authored
  prompt.

### Slice 8 — Replace Omni guidance with the official guide

- Rewrite the Omni index/source section around Google's official prompt guide.
- Add single-shot, negative instruction, concise edit, preservation, audio
  direction, timing, text, role-tag, video-reference, and continuation examples.
- Update route-selection advice for 360p, 4K, video references, editing, and
  10-second continuation increments.
- Keep Fal adapter/schema facts separate and state current audio-reference and
  route limitations accurately.
- Use `video.edit` for accepted edit/continuation attachments from any video
  Asset.

### Slice 9 — Documentation and realistic verification

- Update architecture, CLI, UI, and Skill documentation listed below.
- Migrate a backed-up Urban Basilica database, verify Settings v5 and empty
  selection rows, then exercise one single-Take and one ambiguous-Take Scene.
- Use an inexpensive/validation-only provider workflow unless the user
  explicitly authorizes a paid smoke generation.

## Tests And Guardrails

### Core owning-layer tests

- Settings v5 default, validation, serialization, workflow policy, and context
  projection for all media lanes.
- Selection exact membership, replace, clear, selected discard, restore,
  cross-Scene/cross-Dialogue rejection, and no auto-selection.
- Dialogue suggestions with selected, sole-unselected, multiple-unselected, and
  zero-Take data; Core marks only explicit selection.
- `video.edit` over representative project-, cast-, scene-, and shot-owned video
  Assets with arbitrary types.
- Source path present/missing/ambiguous, non-video source, discarded source,
  unsafe path, wrong provenance media kind, persistence failure, and filesystem
  rollback.
- Source owner/type/metadata/locale/authorship preservation, separate Asset
  identity, unselected result, sibling destination, and resource keys.

### Migration tests

- A valid v4 Settings document becomes v5 with the new value `true` and every
  old value preserved.
- Invalid, partial, unknown-version, and malformed documents abort before
  mutation.
- Existing Dialogue Audio Takes remain active and unselected.
- New selection table foreign keys and singleton-per-dialogue behavior hold.
- Empty new database migration remains valid.

### CLI and route tests

- `dialogue-audio show/setup` parsing, thin delegation, JSON output, structured
  failures, and resource notification.
- `video.edit` purpose/target parsing through existing generation/media
  commands.
- Selection routes serialize Core reports and translate structured errors
  without duplicating membership rules.

### Studio tests

- General Settings renders the exact prompt-expansion label, defaults checked,
  saves the complete v5 document, and preserves neighboring fields.
- Narrative Takes shows one selected badge, changes selection, clears it,
  refreshes after CLI/agent resource events, and never auto-selects a new Take.
- Desktop E2E covers selection persistence after closing/reopening the panel.

### Skill and guide evals

- A selected Dialogue Take is included for a capable non-Wan route.
- A sole unselected Take is included.
- Multiple unselected Takes stop with the exact Narrative-tab direction.
- No Takes stops with the instruction to create Scene Narrative audio.
- Explicit user omission wins.
- A route without audio input triggers a model-switch/proceed question and no
  invented field.
- A live route limit smaller than the resolved audio set is not silently
  truncated.
- Prompt-expansion true/false is applied to semantically matching live-schema
  controls and omitted when absent, without a model/property map.
- Wan examples validate reference mentions after provider adapter ordering.
- Omni is recommended for 360p/4K/video-reference/edit/extend requests, but
  execution stops when the live route lacks the operation.
- Omni edit prompts stay concise and preserve unaffected content.
- Whole-Scene Dialogue Audio produces one ElevenLabs request/file/Take per turn.

Architecture tests protect import boundaries and public contract exhaustiveness,
not private helper names or a list of every implementation function.

## Documentation

- Add `docs/decisions/0089-use-capability-aware-video-continuity-and-editing.md`.
- Add update notices to:
  - `docs/decisions/0074-use-core-owned-project-workflow-settings.md`
  - `docs/decisions/0087-use-deterministic-advisory-media-generation-context.md`
  - `docs/decisions/0088-use-exact-request-references-and-source-derived-image-continuation.md`
- Update:
  - `docs/architecture/data-model-and-storage.md`
  - `docs/architecture/project-asset-storage-conventions.md`
  - `docs/architecture/reference/project-files-and-assets.md`
  - `docs/ui/studio-screenplay.md`
  - `docs/cli/commands.md`
- Update Media Producer, Fal provider adapter/route index where current schema
  evidence requires it, model catalog, guide validator, examples, and evals in
  `studio-skills`.
- Do not edit historical plan 0096 or old migration files.

## Final Verification

Run focused checks first:

```bash
pnpm --dir packages/core test -- project-settings scene-dialogue-audio media-generation-context video-edit
pnpm --dir packages/cli test -- dialogue-audio generation media
pnpm --filter @gorenku/studio test -- project-settings-fields scene-dialogue-audio
```

Run repository checks:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Run the sister Skill repository's guide validators and eval suite. Validate
provider requests and schemas without executing paid media; a paid Wan/Omni or
ElevenLabs smoke run requires explicit user authorization.

For Urban Basilica:

1. use the normal backed-up `renku project migrate` flow;
2. verify the exact prior Settings values plus the new default-on field;
3. verify all five current Takes remain and no Take is selected by migration;
4. select one Take in Narrative, reopen the panel, and verify context marks its
   exact Asset as workflow-selected;
5. clear selection on the current two-Take Dialogue and verify the agent asks
   rather than choosing first/latest;
6. validate a `video.edit` attachment simulation for an existing Shot Plan
   video and a fixture Asset with another owner/type; and
7. verify desktop Studio only; mobile is out of scope.

Finally inspect `git diff --stat`, the complete diff in both repositories, every
new/large file, and all `index.ts` changes. Confirm no provider-native
prompt-expansion map, video type allowlist, dead second selection surface,
monolithic dispatcher, catch-all helper, or unrelated formatting churn was
introduced.

## Completion Checklist

### Review Area

- [x] Confirm `video.edit` is media-kind-wide and not limited to
      `shot_plan_video` or a type allowlist.
- [x] Confirm audio continuity is capability-based and not Wan-specific.
- [x] Confirm selected/sole/ambiguous/missing Dialogue Take behavior matches the
      Product Behavior section exactly.
- [x] Confirm Scene-wide Dialogue generation creates separate per-turn files.
- [x] Confirm Omni recommendations remain honest about the installed live
      route's actual capabilities.
- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Add ADR 0089 and discoverable notices without rewriting decision history.
- [x] Add `video.edit`, `source-video`, and exact purpose/target/output maps.
- [x] Add `isWorkflowSelected` without changing the informational meaning of
      `isDisplaySelected`.
- [x] Add `scene_dialogue_audio_take_selection` with exact relational integrity.
- [x] Add `SceneDialogueAudio.selectedTakeId` and focused select/clear commands.
- [x] Add Project Settings version 5 and
      `generation.enableProviderPromptExpansion`.
- [x] Add `GenerationWorkflowPolicy.enableProviderPromptExpansion`.
- [x] Add `asset.videoEdit` and the focused video attachment contract.
- [x] Keep package-boundary diagnostics structured.
- [x] Keep durable business rules in Core and provider-native schema reasoning
      in Skills/Engines.
- [x] Update public callers directly with no aliases or compatibility readers.

### Project Settings And Migration

- [x] Update the single Core default, AJV schema, validation copy, and tests.
- [x] Generate the Drizzle selection-table migration and snapshots with Drizzle
      Kit.
- [x] Add and document only the required guarded custom JSON document update.
- [x] Preserve every v4 value and default the new field to true.
- [x] Abort malformed/unexpected Settings documents before mutation.
- [x] Add the exact General Settings toggle through the local shadcn `Switch`.
- [x] Return the preference in every Generation Context workflow policy.

### Dialogue Audio Selection And Generation

- [x] Implement Core select/clear with exact Scene/Dialogue/Take validation.
- [x] Clear selection atomically when the selected Take is discarded.
- [x] Keep restored and newly generated Takes unselected.
- [x] Wire thin project-data service and Studio routes.
- [x] Render Pick, Selected, and Clear selection in Narrative Takes.
- [x] Delete the unused Shot Dialogs selection component/test.
- [x] Add `dialogue-audio show` and `dialogue-audio setup` CLI commands.
- [x] Add the focused Media Producer Dialogue Audio guide.
- [x] Support one-turn and whole-Scene intents through the same existing
      `scene.dialogue-audio` purpose.
- [x] Keep ElevenLabs as the only current Dialogue Audio provider.
- [x] Prove one review/request/output/provenance/Take per Dialogue Turn.

### Capability-Based Audio Continuity

- [x] Mark only the selected Take candidate as workflow-selected.
- [x] Keep every active Take visible in deterministic context.
- [x] Add the shared video-reference continuity policy.
- [x] Use selected Take by default and sole Take when no selection exists.
- [x] Ask on multiple unselected Takes and direct the user to Scene Narrative.
- [x] Ask the user to create Narrative audio when no Take exists.
- [x] Respect explicit omission.
- [x] Never invent an audio field for an incapable route.
- [x] Never silently truncate references to a route limit.
- [x] Prove the policy with more than one capable model family.

### Video Edit

- [x] Validate the exact active video source Asset and current source AssetFile.
- [x] Require exactly one target source path in safe provenance.
- [x] Create a separate unselected Asset with inherited owner/type/metadata/
      locale/authorship and new provenance.
- [x] Resolve a source-sibling destination without path-based ownership/type
      inference.
- [x] Allocate `edited-video-gxxx` through the existing exclusive allocator.
- [x] Return the correct owner/Shot Plan resource keys.
- [x] Roll back files and rows on failure.
- [x] Cover arbitrary owner/type fixtures plus current Shot Plan videos.
- [x] Support accepted provider-native continuation through the same purpose
      without a durable edit-chain model.

### Prompt Expansion And Guides

- [x] Read the Project prompt-expansion preference before request authorship.
- [x] Apply it only through semantic inspection of the selected live schema.
- [x] Keep provider-native property names out of Core/Studio/CLI mappings.
- [x] Preserve authored prompt and inspect returned actual/re-written prompt
      evidence when available.
- [x] Add paraphrased Wan examples for every accepted prompt shape.
- [x] Replace stale Omni source/confidence text with Google's official guide.
- [x] Add Omni single-shot, edit-preservation, timing, sound, text, reference,
      360p, 4K, and continuation guidance.
- [x] Distinguish official model capability from current Fal route capability.
- [x] Update model catalog, adapter guidance, validator, and evals.

### Tests And Guardrails

- [x] Add the complete Core Settings, selection, suggestion, and video-edit
      behavior matrices.
- [x] Add migration rollback and preservation tests.
- [x] Add thin CLI/route delegation tests.
- [x] Add Studio interaction and desktop E2E tests.
- [x] Add cross-model Skill evals for audio and prompt expansion.
- [x] Add Wan/Omni guide validation and recommendation evals.
- [x] Protect stable imports/contracts rather than private implementation names.
- [x] Run the shape-review checks listed in Final Verification.

### Documentation

- [x] Update current architecture, storage, UI, and CLI docs.
- [x] Update current Skill sources and provenance dates.
- [x] Leave historical plans and migrations unchanged.
- [x] Keep official Google craft guidance separate from Fal-native route fields.

### Final Verification

- [x] Run focused Core, CLI, Studio, and Skill tests.
- [x] Run root build, test, lint, and check.
- [x] Migrate and inspect backed-up Urban Basilica through the supported flow.
- [x] Verify the real two-Take ambiguity path and selected-Take context path.
- [x] Validate current provider schemas without a paid run.
- [x] Obtain explicit authorization before any paid smoke generation.
- [x] Perform desktop Studio verification; do not report mobile behavior.
- [x] Review `git diff --stat` and the complete diffs in both repositories.
- [x] Inspect large/heavily modified files and confirm `index.ts` files remain
      thin.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.

## Completion Evidence

- Root `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check` passed. The
  existing Studio `server/bin.ts` `no-console` warning remains non-blocking.
- Focused Core, CLI, Studio, migration, Skill, and desktop Chromium E2E coverage
  passed. Desktop E2E ran at `1440x1000`; mobile behavior was not tested.
- Urban Basilica migrated through `renku project migrate` from generation 65 to
  66 with a supported pre-migration database backup. All five existing Takes
  remained active and unselected; foreign-key and quick checks passed.
- The real two-Take Dialogue Turn was selected and cleared through Core. Its
  Generation Context marked exactly the selected Asset as workflow-selected.
- Current Wan reference and Gemini Omni reference/edit schemas were inspected
  and local request documents validated. No paid provider generation was run;
  the explicit-authorization gate remains in force for any future paid smoke.
- Complete Studio and sister skill-repository diffs were reviewed. New
  `index.ts` files remain thin entrypoints, and no runtime native-field map,
  video-type allowlist, compatibility layer, or monolithic dispatcher was added.
