# 0226 Codex Dialogue Direction Panels

Status: proposed
Date: 2026-10-09

## Summary

Directors need to control voice acting for Shot Plan dialogue, not just accept
an agent's one-shot audio. This plan does three things:

1. Adds Eleven v4 (`eleven_v4`) for both single-speaker speech and
   multi-speaker dialogue through the ElevenLabs provider Skill.
   - Single-speaker speech needs no Engines change.
   - Multi-speaker dialogue adds a focused ElevenLabs Text to Dialogue
     operation in Engines.
2. Adds two model-specific fullscreen Codex Desktop panels for directing
   dialogue Takes. Both handle one line or one continuous range of lines:
   - **Eleven v4 Dialogue Direction**: a free-form bracket-tag acting script
     per line. One line uses Text to Speech; a range uses Text to Dialogue,
     with one acting script per line and one voice per speaker.
   - **Seed Audio Dialogue Direction**: one scene performance prompt. It works
     on every Seed Audio 1.0 provider route (Fal.ai, WaveSpeed, Pika).

   The agent pre-fills both panels with its best direction. The user edits
   it, clicks **Generate**, and plays each new Take in place.
3. Makes Dialogue Audio Take selection unambiguous: at most one selected Take
   covers each line, and every newly attached Take becomes selected. The Studio
   Audio tab regroups Takes into **By line** and **Multi-line**.

Generation still runs through the agent's existing Skill and CLI path. A
panel's Generate click records the user's direction and posts a short message
to the Codex conversation. The agent consumes that action, authors the native
request, executes and imports it, then reports the outcome to the panel. Core
stays free of provider and model knowledge. No generation execution becomes an
MCP tool.

The approved visual target is the published mockup
https://claude.ai/artifact/X5QKd9x6xEbfgzs6N4g8nh (version 8): the Eleven v4
panel (single line and range), the Seed Audio panel and the Studio · Audio tab
views. It is a design reference only, not code to port.

## Review Attention

**Review fixes:** preserve the current panel layout, styling and interactions.
Line selection uses the existing local Button with its default appearance
overridden to match the rail. Notification retry remains available while its
receipt is pending. Visible sessions refresh every two seconds, including when
idle, without resetting editor or playback state. The Codex session retains
`lastCompletedAction: { actionId, takeId } | null` so autoplay uses the successful
report's exact Take, even when import appears in an earlier poll. This is
connection-local state; no database schema or agent report input changes.

**Behavior added beyond the literal request:**

- **Selection changes for every dialogue Take, not only panel Takes.**
  - Attaching a Take, including `renku media import` in the ordinary chat flow,
    now selects it.
  - Selecting a Take clears the selection of any other active Take in the same
    Shot Plan whose line range overlaps it.
  - Deleting the selected Take leaves those lines unselected. No older Take is
    reselected automatically.
  - Why: the user asked that each line have exactly one selection so video
    generation knows which reference to use, and that "the last generation is
    the selected one by default".
  - This narrows ADR 0090 ("every Take starts unselected; multi-select") through
    a new ADR 0112.
  - Urban Basilica currently has no overlapping selected Takes, so no data
    cleanup or migration is needed.
- **One visible user message per Generate.** Codex has no silent channel that
  starts an agent turn. Each Generate click posts a one-line message such as
  "Generate dialogue Take · Shot Plan 02-01 · Lines 7–9". The agent's reply is
  visible in the conversation.
- **Generate is the execution approval.** A panel Generate click authorizes one
  generation without the usual review or confirmation step, as the user decided
  that audio needs no extra approval.
- **One outstanding Generate per panel.** Generate is disabled until the agent
  reports the previous action attached or failed. This keeps the line-to-Take
  association unambiguous.
- **Studio refresh notifications move out of the CLI.** The Codex runtime must
  refresh Studio after panel select and delete. `notifyStudioProjectResourcesChanged`
  therefore moves from `packages/cli` into Core `studio-coordination`, and CLI
  callers update directly. Panel-originated events use the existing `agent`
  event source.

**New or changed contracts:**

- **Engines (ElevenLabs only):**
  - adds a Text to Dialogue operation, selected by the new route id
    `eleven_v4/text-to-dialogue` (model `eleven_v4`);
  - its native input is
    `{ inputs: [{ text, voice }], settings?: { stability, similarity }, output_format?, language_code?, seed? }`;
  - Engines enforces at most 10 distinct voices;
  - the existing ElevenLabs provider file is split into per-operation modules
    so this does not add another inline branch.
  - `@elevenlabs/elevenlabs-js` is upgraded to `^2.71.0` (user-approved,
    with a one-version `minimumReleaseAgeExclude` entry), because 2.45.0
    silently stripped `settings.similarity` from dialogue requests.
- **Codex MCP runtime:**
  - two UI resources;
  - two model-visible opening tools;
  - three app-only tools;
  - two model-only tools;
  - one resource URI scheme;
  - a new `./dialogue-direction` package export of type-only contracts.
- **Core:**
  - `ShotPlanDialogueAudioResource` gains `lines` (number, speaker and text of
    each line that has Takes);
  - selection and attachment semantics change as described above.
- **Studio packaging:** two new single-file Codex app HTML builds, which
  `renku studio mcp` resolves.
- **Skills (studio-skills):**
  - adds the `eleven_v4` and `eleven_v4/text-to-dialogue` routes, v4 speech and
    dialogue guidance, and a new dialogue-direction reference;
  - updates generation review routing and the shot-plan dialogue audio
    reference.
- **New diagnostics:** `CODEX_DIALOGUE_DIRECTION_INVALID`,
  `CODEX_DIALOGUE_DIRECTION_NOT_FOUND`, `CODEX_DIALOGUE_DIRECTION_BUSY`,
  `CODEX_DIALOGUE_DIRECTION_UNSUPPORTED`. Engines reuses its existing input
  validation code for dialogue input errors.

**Routing:**

- The panels open only when all of these hold:
  - the request is `shot-plan.dialogue-audio`;
  - the route is ElevenLabs `eleven_v4` or `eleven_v4/text-to-dialogue`, or
    Seed Audio 1.0 on any supported provider (Fal.ai
    `bytedance/seed-audio-1.0`, WaveSpeed `bytedance/seed-audio-1.0`, Pika
    `bytedance/seed-audio-1.0/text-to-audio`);
  - the existing Codex panel probe advertises support.
- The panels are not generation reviews. They do not read or depend on
  `codexGenerationReview` or `codexGenerationReviewDisplayMode`. They always
  open fullscreen, never inline, and add no setting.
- Every other host and route keeps today's flow unchanged. That includes
  Claude, Codex CLI and Eleven v3.
- **Voice mentions differ by provider, and the panel takes them as given.**
  - Fal.ai and Pika address reference clips in the prompt as `@Audio1–3`.
  - WaveSpeed has no documented prompt mention syntax.
  - The opening input declares this as `promptMentions: 'audio-tags' | 'none'`.
    The Skill sets it from the route's adapter guide; the panel never infers it.

**Existing behavior deliberately unchanged:**

- Engines single-speaker speech: `eleven_v4` already passes through
  `textToSpeech.convert`.
- Core's provider- and model-free contracts and the dialogue Take table schema.
- Turn-number ranges and the existing combined generation review panel.
- The conversational audio flow, Studio Preview and other hosts.

**Assumptions to verify natively in Codex Desktop:**

- The host opens these resources fullscreen in the right-side pane.
- A `send: true` message starts a turn when the agent is idle and is queued
  when it is busy.
- The panel can read audio blobs through MCP resources.

Panel drafts live in the MCP connection's memory and are lost when it closes.
Every generated Take keeps its exact request in provenance.

**Eleven v4 dialogue limits from ElevenLabs:**

- at most 10 distinct voices (enforced by Engines);
- a recommended maximum of 2,000 characters across all lines, which the panel
  shows as a warning counter and does not enforce;
- the API default model is still `eleven_v3`, so requests always send
  `model_id: eleven_v4`.

**Decisions approved by the user (2026-10-09):**

- the selection rule above, including auto-selecting new Takes from chat
  imports;
- moving the Studio notification client into Core;
- the new ElevenLabs route id `eleven_v4/text-to-dialogue` and the split of the
  ElevenLabs provider file.

## Product Behavior

Both panels open fullscreen in Codex's right pane for the Shot Plan's dialogue
lines. The agent chooses those lines from the Shot Plan's coverage and passes
them as one consecutive line range. There is no Done or close control; Codex
owns panel dismissal.

### Shared panel structure

- **Header:** Shot Plan title, scene location and a quiet model label
  (`Eleven v4` or `Seed Audio 1.0`). At the far right sits a secondary
  (`outline`) **Select all** button, disabled when every line is already
  selected.
- **Line list (left), the shared Dialogue Line Rail:**
  - Each row shows the line number, speaker avatar, speaker name and a one-line
    text excerpt. On the right are the count of this panel's model's Takes
    covering that line, and a green dot when any selected Take covers it.
  - **Click** selects only that line.
  - **Shift-click** an unselected line extends the selection through it,
    filling the gap.
  - **Shift-click** the first or last selected line removes it.
  - **Shift-click** an inner line trims back to it from the anchor line.
  - **Hovering a line number** shows a `+` (unselected line) or `−` (first or
    last selected line) gutter button that applies the same rule.
  - Selected lines render as one connected band.
  - Only one continuous range or one single line can be selected; separate
    pieces are impossible.
- **Controls row:** model-specific controls, then **Generate** (primary).
  ⌘/Ctrl+Enter in any editor also generates.
- **Takes for the exact selection, newest first.** Each row has:
  - a selection radio;
  - a `Take N` label;
  - a play button and waveform (click to seek);
  - the duration;
  - Delete, with inline Delete/Keep confirmation.
- **While generating:** a dashed placeholder row shows the next Take number,
  and Generate shows `Generating…` and is disabled.
- **When the agent reports success:** the new Take appears selected and starts
  playing.
- **When the agent reports failure:** the placeholder is replaced by the
  reported message, and Generate is enabled again.

### Eleven v4 Dialogue Direction panel

**One line selected (Text to Speech):**

1. **Speaker row:** avatar, upper-case speaker name, a voice `Select` listing
   the agent-supplied Cast Voices for that speaker, and a play button for the
   voice sample.
2. **Screenplay line:** in the screenplay face, exact and read-only, with no
   label.
3. **Acting script editor.** It starts with the agent's draft for that line.
   - Bracketed spans are coloured with the existing `--dialogue-audio-tag`
     token. This is presentation-only tokenization.
   - One row of agent-suggested tag chips inside the editor footer inserts a
     tag at the cursor.
   - A quiet **Revert** link appears after editing and restores the agent's
     draft for the line.
   - Tags are free-form and never validated.

**A range selected (Text to Dialogue):**

1. **Voices row:** one voice `Select` and sample button per distinct speaker.
2. **Stacked line blocks** in screenplay order. Each block has:
   - avatar, upper-case speaker name and the line number;
   - the exact screenplay line;
   - a compact acting script editor, with **Revert** shown only after editing.
3. **One shared tag-chip row** below the stack. It inserts into the editor
   that last had focus.

Acting scripts are kept per line for the session, so the same line shows the
same script whether it is directed alone or inside a range.

**Controls and Takes:**

- Stability and Similarity sliders. Range mode adds a `n / 2,000` total
  character counter, which turns destructive above 2,000 and is a warning
  only.
- Take rows add **Edit from this take**. It loads that Take's acting scripts
  from its Eleven v4 provenance into the corresponding line editors.

### Seed Audio Dialogue Direction panel

- **Line list:** selected speakers' avatars carry a small `1`, `2` or `3`
  badge, giving their reference order (order of first appearance).
- **Desk:**
  1. **Voices row:** for each distinct speaker, the badged avatar, speaker name,
     a voice `Select` and a sample play button.
     - When `promptMentions` is `audio-tags`, clicking the avatar inserts
       `@AudioN` into the prompt.
     - More than three speakers replaces the row with one notice: "Seed Audio
       takes up to three voices. Select fewer lines." Generate is disabled in
       that case.
  2. **Selected screenplay lines:** speaker and text for each line, read-only.
  3. **Performance prompt editor.**
     - Quoted spans are emphasized. With `audio-tags`, each `@AudioN` takes
       that speaker's colour. This is presentation-only.
     - A `n / 2,048` character counter turns destructive when over the limit;
       it is a warning, and Generate stays enabled.
     - **Revert** restores the agent's draft for this exact range.
     - Prompt drafts are kept per exact range for the session. Choosing a range
       that has no draft keeps the current editor text.
- Take rows have no Edit from this take.

### Studio · Audio tab

The Shot Plan Audio tab regroups the existing Media Cards:

- **By line:** one row per line that has single-line Takes. Each row shows the
  line number, speaker portrait, speaker name and line text, then its Takes.
- **Multi-line:** one row per exact range that has multi-line Takes from any
  model, labelled `Lines N–M` with the speakers' portraits, then its Takes.

Selection is a toggle, but the Core rule keeps at most one selected Take per
line: selecting a Take clears any overlapping selection. Delete keeps the
existing Trash confirmation. Line text comes from `lines` in the Core resource.
Lines whose number no longer exists in the current screenplay show the number
and the Take's speaker names without text.

### Unchanged flows

The chat-driven dialogue audio flow, Studio Preview, Visualize, the combined
generation review panel and every non-Codex host behave as today. The only
change they see is that newly imported Takes become selected. The chat flow can
also use `eleven_v4/text-to-dialogue` for multi-line ElevenLabs Takes.

### Non-goals

- Claude Desktop or Claude Code panels.
- Audio-only black video.
- Splitting a multi-line Take into per-line Takes using ElevenLabs timestamps.
- Eleven v4 Turbo and the Text to Dialogue WebSocket.
- Playing a whole Shot Plan's selected Takes in sequence.
- Switching models inside a panel.
- Asking the agent to redraft from a panel.

## Requirement Ledger

| Requirement | Source | Owner |
| --- | --- | --- |
| `eleven_v4` usable for single-speaker speech | User request | studio-skills ElevenLabs Skill and model guide |
| `eleven_v4` multi-speaker dialogue, directed like Seed Audio ranges | User decision after research | Engines ElevenLabs dialogue operation, ElevenLabs Skill, Eleven v4 panel |
| Fullscreen Codex panel for directing dialogue, agent-prefilled, editable, generate and play | User request | Codex runtime, Studio Codex apps, Media Producer Skill |
| Always fullscreen, no setting, independent of generation review preferences | User decision | Codex UI resource metadata, Skill routing |
| Model-specific panels (no generic audio panel) | User decision | Separate Studio feature folders and Codex opening tools |
| Seed Audio authors one prompt for one line or one continuous range, on every Seed Audio provider | User decision | Seed Audio panel, provider Skills |
| One shared line selection component, single line or one continuous range | User decision | `DialogueLineRail` |
| Voice choice per speaker | User decision | Panels; agent supplies compatible Cast Voices |
| Free-form tags, suggestions shown, no validation | User decision; ADR 0041 | Panel editors (presentation only) |
| New Take selected by default; one selection per line | User decision | Core dialogue Take selection |
| Select/delete Takes in panel and Studio Audio tab, single vs multi-line clearly separated | User decision | Core commands, Codex app tools, Studio Audio tab |
| Generate via chat message; Skill runs the existing CLI | User decision | Panel message, Codex consume/report tools, Skill |
| No extra approval for audio | User decision | Media Producer Skill |
| No Done button; changes reflected in Studio context | User decision | Core persistence and Studio notification |
| Chat-only generation keeps working | User decision | Unchanged Skill and CLI path |
| Core holds no provider or model knowledge; CLI stays thin | Architecture | All slices |

## Context And Evidence

- **ADR 0090** (Shot Plan dialogue audio, provider-neutral Cast Voices):
  - Takes are `shot_plan_dialogue_audio_take` rows with a consecutive Turn
    range, `selected_at` and lifecycle fields.
  - Selection is currently multi-select, and Takes start unselected.
  - Cast Voice `voiceIdentity` is opaque to Core.
  - Multi-Turn generation currently uses Seed Audio only.
- **ADR 0105 / 0106** (generation review routing): the Codex panel probe,
  consume-once panel actions, and "no generation execution becomes an MCP
  tool". The review preferences in these ADRs do not apply to the new panels.
- **ADR 0086** (engines boundary): Engines alone executes provider protocols,
  and the CLI is the composition root that calls Engines. Core never executes
  providers.
- **ADR 0041** (opaque AI artifacts): prompts and tags are opaque, and
  highlighting must be presentation-only.
- **Plan 0220** (implemented): the combined review panel pattern this plan
  mirrors.
  - `packages/codex/src/server.ts` registers app resources and tools.
  - `packages/studio/src/services/codex-app.ts` connects the panel and sends
    the conversation message.
  - `use-codex-generation-review.ts` handles `ontoolresult` and polls
    `readServerResource`.
  - `vite.codex.config.ts` builds the single-file HTML.
- **Codex host facts** (research 2026-10-09):
  - `ui/message` with `openai/message {target:'active', send:true}` is the
    documented way to post into the thread; there is no silent variant.
  - OpenAI "MCP Events" are cloud/webhook-only, and codex-rs rejects them for
    local servers.
  - A later model tool call mounts a new iframe rather than updating an open
    one, so the panel polls an app-visible resource for results.
- **Engines ElevenLabs adapter**
  (`packages/engines/src/providers/elevenlabs/provider.ts`, 323 lines):
  - it branches on `request.model`: `voice-sample-audio`, `music_v1`, and
    otherwise `textToSpeech.convert` with `modelId: request.model`;
  - `readInputSchema` is unavailable except for voice samples;
  - local-media markers are rejected.
- **Eleven v4 facts** (ElevenLabs docs, 2026-10-09):
  - `eleven_v4` takes free-form inline `[tags]`. There is no SSML or
    `<break>`.
  - Voice settings are only stability and similarity; style and speed are
    removed.
  - Pronunciation uses IPA between slashes.
  - The limit is 10,000 characters per Text to Speech request.
  - **Text to Dialogue (`POST /v1/text-to-dialogue`):**
    - available on v4 and recommended over v3;
    - SDK call `client.textToDialogue.convert({ inputs: [{ text, voiceId }], modelId, settings: { stability, similarity }, outputFormat, languageCode, seed })`;
    - at most 10 unique voices;
    - a recommended maximum of 2,000 characters in total;
    - the API default `model_id` is still `eleven_v3`.
- **Seed Audio provider adapters (studio-skills):**
  - Fal.ai and Pika: ordered `audio_urls` with `@Audio1–3` prompt mentions.
  - WaveSpeed: ordered `audios`, with no documented mention syntax (plain
    descriptions).
- **Core reads reused:**
  - `readMediaGenerationContext`: purpose `shot-plan.dialogue-audio`, giving
    `dialogueTurns` and `castVoicesByCastMemberId`.
  - `readShotPlanDialogueAudio`: Takes, with
    `assetFile.generationProvenance` and speakers.
  - `readMediaGenerationReferenceProjectFile`: authorized project file bytes.
  - `selectShotPlanDialogueAudioTake`,
    `clearShotPlanDialogueAudioTakeSelection` and
    `discardShotPlanDialogueAudioTake` on `ProjectDataService`.
- **Studio reuse:**
  - `src/ui/code-mirror-editor.tsx`, `audio-waveform-player.tsx`, `select.tsx`,
    `slider.tsx`, `button.tsx`;
  - `DIALOGUE_PERFORMANCE_TAG_PATTERN` in
    `features/movie-studio/scenes/dialogue-performance-tags.tsx`;
  - the `--dialogue-audio-tag` theme token;
  - `MediaCardAudioTake`.
- **studio-skills:**
  - `elevenlabs-media-provider/references/supported-routes.json` currently
    lists v3, multilingual v2 and turbo v2.5;
  - `media-producer/references/model-guides/audio/elevenlabs-speech.md`;
  - `media-producer/references/shot-plan-dialogue-audio.md`, which says
    "Selection is multi-select" and "Multi-Turn generation uses Seed Audio";
  - `media-producer/references/generation-review-routing.md`;
  - `docs/bundled-media-models.md`.
- **Urban Basilica** (read-only): 8 dialogue Takes across 3 Shot Plans, with no
  overlapping selected Takes.

## Architecture Shape Gate

### Ownership

- **Core:**
  - owns the Take selection rule, attach-selects, and the new `lines`
    projection, inside `packages/core/src/server/shot-plan-dialogue-audio/`;
  - owns the Studio notification client in
    `packages/core/src/server/studio-coordination/`;
  - learns nothing about panels, providers or models.
- **Engines:** owns the ElevenLabs Text to Dialogue protocol: input
  validation, SDK call and output.
- **Codex runtime (`packages/codex`):**
  - owns ephemeral direction sessions, panel actions, resource projection, and
    thin calls to Core for reads and Take mutations;
  - owns the per-panel draft contracts. They are model-specific by product
    decision and live in per-panel folders;
  - never imports Engines, the CLI or Studio React; the existing
    `architecture.test.ts` stays as is.
- **Studio (`packages/studio`):**
  - owns the two Codex panel apps and the shared panel components under one
    feature folder;
  - owns the regrouped Audio tab.
- **CLI:** `renku studio mcp` only resolves two more HTML files. Media import
  keeps calling Core and now imports the moved notification client.
- **Skills (studio-skills):** own native request authoring from a consumed
  panel draft, the route-specific `promptMentions` choice, execution, import
  and outcome reporting.

### Module layout

```text
packages/engines/src/providers/elevenlabs/
  index.ts                  # unchanged public export
  provider.ts               # thin MediaProvider: credential check, resolve operation, delegate (shrinks)
  client.ts                 # SDK client creation, retry classification, error normalization (moved from provider.ts)
  audio-output.ts           # output format, stream collection, artifact write (moved from provider.ts)
  operations/
    registry.ts             # resolveElevenLabsOperation(model): bounded table, see Shapes
    speech.ts               # Text to Speech (existing behavior moved)
    dialogue.ts             # Text to Dialogue (new)
    music.ts                # music_v1 (existing behavior moved)
    voice-sample.ts         # voice-sample-audio (wraps existing voice-samples.ts)
  voice-samples.ts          # unchanged

packages/core/src/server/shot-plan-dialogue-audio/
  selection.ts            # exclusive per-line selection (changed)
  attachment.ts           # attach selects the new Take (changed)
  projection.ts           # adds lines projection (changed)
packages/core/src/server/studio-coordination/
  notification-client.ts  # moved from packages/cli/src/commands/studio-notification-client.ts

packages/codex/src/
  server.ts                         # adds registerDialogueDirection(...) call and HTML options only
  dialogue-direction/
    index.ts                        # registerDialogueDirection(server, options): composition only
    contracts.ts                    # type-only public contracts (package export ./dialogue-direction)
    schemas.ts                      # zod schemas for shared app/model tools
    session-state.ts                # DialogueDirectionState: sessions, revisions, one action lifecycle
    session-projection.ts           # Core reads -> lines, voices, takes, media ids
    media-resources.ts              # renku-direction://{sessionId}/media/{mediaId} blobs
    take-mutations.ts               # select/clear/discard via Core + Studio notification
    actions.ts                      # generate, consume, report
    eleven-v4/
      open.ts                       # opening schema + session creation
      draft.ts                      # draft validation + acting scripts from provenance
    seed-audio/
      open.ts
      draft.ts                      # range + ordered voice reference validation

packages/studio/
  codex-apps/                       # all Codex app HTML entries; built to codex-apps-dist/codex-apps/
    generation-review.html          # moved from packages/studio/codex-generation-review.html
    eleven-v4-dialogue-direction.html
    seed-audio-dialogue-direction.html
  vite.codex.config.ts              # one entry per build mode
  src/app/codex-eleven-v4-dialogue-direction.tsx
  src/app/codex-seed-audio-dialogue-direction.tsx
  src/services/codex-dialogue-direction.ts     # bridge calls + Generate conversation message
  src/features/codex-dialogue-direction/
    shared/
      dialogue-line-rail.tsx        # DialogueLineRail (one line or one continuous range)
      dialogue-line-range.ts        # pure range adjustment rule
      dialogue-take-list.tsx        # DialogueTakeList
      direction-panel-frame.tsx     # header (incl. Select all) + rail/desk layout
      direction-editor.tsx          # CodeMirrorEditor + caller highlight extension + footer slot
      speaker-voice-select.tsx
      character-count.tsx           # warning-only counter
      use-dialogue-direction-session.ts
      use-direction-media.ts        # MCP blob -> object URL, revoke on unmount
    eleven-v4/
      eleven-v4-direction-panel.tsx
      single-line-desk.tsx
      dialogue-desk.tsx             # stacked per-line editors, shared chips
      acting-script-highlight.ts
      voice-settings-controls.tsx
    seed-audio/
      seed-audio-direction-panel.tsx
      performance-prompt-highlight.ts
      seed-audio-voice-references.tsx
  src/features/movie-studio/shot-plans/
    shot-plan-dialogue-audio.tsx    # regrouped By line / Multi-line (changed)
```

### Shapes

- `index.ts` files only compose registration or re-export intentional public
  entrypoints.
- **ElevenLabs operation registry** (`resolveElevenLabsOperation`) is a bounded
  table:
  - `voice-sample-audio` → voice sample;
  - `music_v1` → music;
  - `<model>/text-to-dialogue` → dialogue, with `modelId` set to `<model>`;
  - any other model → speech.

  Each operation exports `validate` and `execute`. The table replaces the
  model ternaries in `provider.ts` and grows only when ElevenLabs adds an
  operation kind, not per model.
- **Codex opening tools** are registered from their own panel folders. There is
  no `panel` switch dispatcher. Shared tools validate drafts through a
  two-entry `Record<'eleven-v4' | 'seed-audio', DraftValidator>` map in
  `actions.ts`. It is bounded because adding a panel is a deliberate product
  change.
- **React panels** compose the shared components. Model-specific behavior stays
  in `eleven-v4/` and `seed-audio/`, and shared components receive
  model-specific parts as props: highlight extension, chips, controls.
- **Forbidden:**
  - a generic configurable "audio direction panel" driven by model metadata;
  - provider or model branches in Core;
  - generation execution or Engines imports in `packages/codex`;
  - an MCP tool that executes generation;
  - tag or prompt validation;
  - re-export facades for the moved notification client;
  - another inline model branch in the ElevenLabs `provider.ts`.

**Stop conditions:**

- `actions.ts` or `session-state.ts` starts handling model-specific fields
  inline.
- A shared React component gains `if (panel === …)` branches.
- `server.ts` grows dialogue-direction logic beyond one registration call.
- An ElevenLabs operation module starts handling another operation's input.

## Contracts

### Engines (ElevenLabs)

- **Route id:** `eleven_v4/text-to-dialogue`. The provider receives it as
  `request.model`.
- **Native input:**

  ```json
  {
    "inputs": [{ "text": "[cold, quiet] Then the empire is suffocating.", "voice": "<voice id>" }],
    "settings": { "stability": 0.45, "similarity": 0.75 },
    "output_format": "mp3_44100_128",
    "language_code": "en",
    "seed": 12345
  }
  ```

  `inputs` is required and non-empty. Each entry needs non-empty `text` and
  `voice`. `settings`, `output_format`, `language_code` and `seed` are
  optional.
- **Validation:** Engines rejects these with its existing input-validation
  error and collects every issue:
  - more than 10 distinct `voice` values;
  - unknown top-level fields;
  - local-media markers.

  It does not enforce the 2,000-character recommendation.
- **Execution:**
  - calls `client.textToDialogue.convert({ inputs: inputs.map(({ text, voice }) => ({ text, voiceId: voice })), modelId: 'eleven_v4', settings, outputFormat, languageCode, seed })`;
  - writes one audio artifact through `audio-output.ts`;
  - the result `model` is the route id, matching the existing provenance
    behavior.
- **Unchanged:** speech, music and voice-sample behavior. Only the file
  structure changes.

### Core

- **`selectShotPlanDialogueAudioTake`:** in one transaction, sets `selected_at`
  on the Take and clears `selected_at` on every other active Take in the same
  Shot Plan whose `[turn_start_number, turn_end_number]` overlaps it.
- **`clearShotPlanDialogueAudioTakeSelection`:** unchanged.
- **`attachShotPlanDialogueAudio`:** stores the new Take with
  `selected_at = now` and clears overlapping selections in the same
  transaction.
- **Discard:** clears selection, as today. **Restore:** comes back unselected,
  as today.
- **`ShotPlanDialogueAudioResource.lines: ShotPlanDialogueAudioLine[]`:**
  `{ number: number; speakerName: string; castMemberId: string | null; plainText: string }`.
  It contains every current screenplay line number covered by an active Take
  in this Shot Plan, computed with `listNumberedDialogueTurns`. Numbers that
  no longer exist are omitted.
- **Notification client move:**
  - `notifyStudioProjectResourcesChanged(input)` moves to
    `@gorenku/studio-core/server` (`studio-coordination/notification-client.ts`).
  - Its `source` becomes the existing `StudioEventSource`.
  - The CLI file and its test are deleted, and callers import from Core.

### Codex MCP surface

| Name | Kind | Visibility | Purpose |
| --- | --- | --- | --- |
| `ui://renku/dialogue-direction/eleven-v4` | UI resource | — | Eleven v4 panel HTML. `openai/ui`: `preferredDisplayMode: 'fullscreen'`, `availableDisplayModes: ['fullscreen']`; CSP `blob:` |
| `ui://renku/dialogue-direction/seed-audio` | UI resource | — | Seed Audio panel HTML, same metadata |
| `dialogue.direction.eleven-v4.open` | app tool | model | Open a session; returns `{ session }`, text "end the turn and wait" |
| `dialogue.direction.seed-audio.open` | app tool | model | Same for Seed Audio |
| `dialogue.direction.generate` | tool | app | Record one Generate action with the panel draft; fails `CODEX_DIALOGUE_DIRECTION_BUSY` when an action is pending or running |
| `dialogue.direction.take.select` | tool | app | `{ sessionId, takeId, selected: boolean }` → Core select/clear, Studio notification, returns session |
| `dialogue.direction.take.discard` | tool | app | `{ sessionId, takeId }` → `discardShotPlanDialogueAudioTake` (Trash), Studio notification, returns session |
| `dialogue.direction.consume` | tool | model | `{ sessionId, actionId }` → returns `{ route, draft }` once; status → `running`; repeated call returns `alreadyConsumed` |
| `dialogue.direction.report` | tool | model | `{ sessionId, actionId, outcome: { status: 'attached'; assetFileId } \| { status: 'failed'; message } }` (assetFileId from the import report) |
| `renku-direction://{sessionId}` | resource | app | Current `DialogueDirectionSession` JSON (Takes re-read from Core) |
| `renku-direction://{sessionId}/media/{mediaId}` | resource | app | Take audio, voice samples, speaker profiles as blobs |

- Both opening tools call the existing `assertGenerationReviewCapability`
  (Codex client plus MCP App UI) before any read.
- Neither reads review preferences.
- If the host connects in any mode other than fullscreen, the panel shows
  `CODEX_DIALOGUE_DIRECTION_UNSUPPORTED` and does nothing.

### Opening inputs (zod, in each panel's `open.ts`)

```ts
interface DialogueDirectionSpeakerInput {
  castMemberId: string;
  castVoiceIds: string[];        // compatible voices chosen by the provider Skill
  initialCastVoiceId: string;    // must be in castVoiceIds
}
interface DialogueDirectionRoute {
  provider: string;              // opaque; echoed back on consume
  speechModel: string;           // exact route id, e.g. 'eleven_v4' or 'bytedance/seed-audio-1.0'
  rangeModel: string;            // route id for multi-line Takes, e.g. 'eleven_v4/text-to-dialogue'
}
interface ElevenV4DialogueDirectionOpenInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;
  turnRange: { start: number; end: number };              // lines shown in the rail
  initialSelection: { start: number; end: number };       // within turnRange
  lines: Array<{ number: number; actingScript: string }>; // agent draft for every line in turnRange
  speakers: DialogueDirectionSpeakerInput[];
  voiceSettings: { stability: number; similarity: number }; // 0..1
  suggestedTags: string[];                                // shown as chips, never validated
}
interface SeedAudioDialogueDirectionOpenInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;                          // speechModel === rangeModel for Seed Audio
  promptMentions: 'audio-tags' | 'none';
  turnRange: { start: number; end: number };
  initialSelection: { start: number; end: number };
  prompts: Array<{ turnRange: { start: number; end: number }; prompt: string }>;
  speakers: DialogueDirectionSpeakerInput[];
}
```

The runtime validates the following before creating a session, and fails with
`CODEX_DIALOGUE_DIRECTION_INVALID`, collecting every issue:

- the Project resolves;
- the Shot Plan exists;
- every line number exists in the current screenplay context;
- every speaker in range has a `speakers` entry;
- every `castVoiceId` belongs to that Cast Member;
- ranges lie within `turnRange`;
- Eleven `lines` cover `turnRange` exactly once.

Route ids are opaque to the runtime; it echoes them back on consume.

### Session and drafts (`contracts.ts`, type-only)

```ts
type DialogueDirectionPanel = 'eleven-v4' | 'seed-audio';
interface DialogueDirectionSession {
  sessionId: string;
  revision: number;
  panel: DialogueDirectionPanel;
  route: DialogueDirectionRoute;
  shotPlan: { id: string; title: string; sceneHeading: string };
  lines: Array<{ number: number; castMemberId: string | null; speakerName: string; isVoiceOver: boolean; plainText: string; profileUri: string | null }>;
  voices: Record<string, Array<{ castVoiceId: string; name: string; sampleUri: string }>>;
  takes: Array<{ takeId: string; turnRange: { start: number; end: number }; selected: boolean; durationSeconds: number | null; audioUri: string; createdAt: string; actingScripts: Record<number, string> | null }>;
  action: { actionId: string; turnRange: { start: number; end: number }; status: 'pending' | 'running' | 'failed'; message?: string } | null;
  lastCompletedAction: { actionId: string; takeId: string } | null;
  initial: ElevenV4DirectionInitial | SeedAudioDirectionInitial; // agent drafts, suggestions, settings, initial voices, initial selection, promptMentions
}
interface ElevenV4DirectionDraft {
  panel: 'eleven-v4';
  turnRange: { start: number; end: number };            // start === end → speechModel, otherwise rangeModel
  lines: Array<{ number: number; actingScript: string }>; // every line in turnRange, screenplay order
  voices: Array<{ castMemberId: string; castVoiceId: string }>; // one per distinct speaker
  voiceSettings: { stability: number; similarity: number };
}
interface SeedAudioDirectionDraft {
  panel: 'seed-audio';
  turnRange: { start: number; end: number };
  prompt: string;
  voiceReferences: Array<{ position: 1 | 2 | 3; castMemberId: string; castVoiceId: string }>;
}
```

- **`takes[].actingScripts`** is set only in Eleven v4 sessions, by
  `eleven-v4/draft.ts`, and never read by Core. Otherwise it is `null`.
  - For a Take with `eleven_v4` provenance, it is `{ [line]: input.text }`.
  - For a Take with `eleven_v4/text-to-dialogue` provenance, `input.inputs[i].text`
    maps to the Take's lines in order.
- **`voiceReferences`** must:
  - list each distinct speaker in the range once;
  - be in order of first appearance;
  - use sequential positions;
  - contain at most 3 entries.

  This is an envelope input-count rule owned by `seed-audio/draft.ts`. The
  Skill maps positions to `@AudioN` mentions or plain ordered references
  according to the route.
- **`action`:** the status `attached` is not stored. A successful report clears
  `action` and records `lastCompletedAction` using the Take resolved from the
  reported Asset File. Resource reads retain that completion until the next
  successful report. The panel autoplays each newly observed completion once;
  its initial session establishes a baseline without replaying an old result.

### Generate message

`src/services/codex-dialogue-direction.ts` sends this text:

```text
Generate dialogue Take · <shot plan title> · <Line N | Lines N–M>. Session <id>, action <id>. Consume it with dialogue.direction.consume once.
```

It uses `_meta: { 'openai/message': { target: 'active', send: true } }`.

### Skills (studio-skills)

- **`skills/elevenlabs-media-provider/references/supported-routes.json`:** add
  `{ "apiId": "eleven_v4", "name": "Eleven v4" }` and
  `{ "apiId": "eleven_v4/text-to-dialogue", "name": "Eleven v4 Dialogue" }`.
- **`skills/elevenlabs-media-provider/SKILL.md`:** document the dialogue input
  shape from the Engines contract. Voices come only from Cast Voice identities.
- **`skills/media-producer/references/model-guides/audio/elevenlabs-speech.md`:**
  add an Eleven v4 section:
  - free-form bracket tags that carry forward until replaced;
  - one tag per clause;
  - no SSML or `<break>`;
  - only stability and similarity;
  - IPA pronunciation between slashes;
  - a 10,000-character speech limit;
  - v3 scripts work unchanged;
  - stage directions outside brackets may be spoken aloud;
  - **dialogue:**
    - one input per screenplay line, with tags inside each line;
    - at most 10 voices;
    - keep the total under 2,000 characters;
    - an interruption is shown only by cutting a line off with punctuation.
- **`docs/bundled-media-models.md`:** add Eleven v4 and Eleven v4 Dialogue rows.
- **New `skills/media-producer/references/dialogue-direction-panels.md`:** the
  full panel workflow:
  1. read the context;
  2. pick the Shot Plan line range and the provider route;
  3. author drafts, suggestions and compatible voices, and set
     `promptMentions` for Seed Audio from the provider adapter guide
     (`audio-tags` for Fal.ai and Pika, `none` for WaveSpeed);
  4. open the panel and end the turn;
  5. on each Generate message:
     - consume the action;
     - author the native request from the draft:
       - Eleven, one line: `text`, `voice`, `voice_settings`;
       - Eleven, range: `inputs[{text, voice}]`, `settings`;
       - Seed Audio: `prompt` plus the provider's ordered reference field
         (`audio_urls` or `audios`), following `voiceReferences`;
     - validate and execute without further confirmation;
     - import with `--turns`;
     - call `dialogue.direction.report`;
  6. report failures with a user-readable message.
- **`skills/media-producer/references/generation-review-routing.md`:** add the
  dialogue direction rule from Review Attention. State that it does not depend
  on review preferences.
- **`skills/media-producer/references/shot-plan-dialogue-audio.md`:**
  - replace "Selection is multi-select" with the one-selection-per-line rule
    and auto-selection on import;
  - replace "Multi-Turn generation uses Seed Audio" with "Seed Audio or Eleven
    v4 Dialogue";
  - link the panel reference for eligible Codex requests.

## Implementation Slices

1. **Eleven v4 speech (studio-skills).** The `eleven_v4` route, the v4 guide
   section and the bundled models row, with the existing skill validators
   passing. This can ship independently.
2. **Engines ElevenLabs operations.**
   - Split `provider.ts` into `client.ts`, `audio-output.ts` and `operations/`
     with the bounded registry, with no behavior change. Existing tests pass
     unchanged.
   - Add `operations/dialogue.ts`.
   - Then add the `eleven_v4/text-to-dialogue` route, the Skill input shape,
     the dialogue guide and the bundled row in studio-skills.
3. **Core selection rule.**
   - Change `selection.ts` and `attachment.ts` as specified, with transactional
     clears.
   - Add `lines` in `projection.ts` and to the client type in
     `client/shot-plan-dialogue-audio.ts`.
   - Add ADR 0112 and the ADR 0090 notice.
4. **Notification client move.**
   - Move the file to Core `studio-coordination/notification-client.ts`,
     export it from Core server, and update `studio-resource-event-command.ts`
     and other CLI callers.
   - Delete the CLI file and move its test.
5. **Studio Audio tab.** Regroup `shot-plan-dialogue-audio.tsx` into By line
   and Multi-line using `lines`. Keep `MediaCardAudioTake`, and reload after
   select or delete.
6. **Codex dialogue-direction runtime.** Create the
   `packages/codex/src/dialogue-direction/` modules:
   - the two resources and seven tools;
   - the session resource and media resources;
   - the `./dialogue-direction` package export;
   - `server.ts` gains `elevenV4DialogueDirectionHtml` and
     `seedAudioDialogueDirectionHtml` options and one registration call.
7. **Shared panel components and the Eleven v4 app.**
   - `shared/` components, the session hook and media hook.
   - The `eleven-v4/` panel with its single-line and dialogue desks,
     `src/app/codex-eleven-v4-dialogue-direction.tsx` and
     `codex-apps/eleven-v4-dialogue-direction.html`.
   - Move the existing `codex-generation-review.html` to
     `codex-apps/generation-review.html`, and delete the old root file.
   - `vite.codex.config.ts` builds one entry per mode, and `build:codex` runs
     three builds into `codex-apps-dist/codex-apps/`.
   - In `package.json`, the existing `./codex-apps/generation-review.html`
     export now points to `./codex-apps-dist/codex-apps/generation-review.html`.
     A new `./codex-apps/eleven-v4-dialogue-direction.html` export is added. The
     export names stay the same, so `mcp-command.ts` needs no path change for
     the review panel.
8. **Seed Audio app.** The `seed-audio/` panel, its entry,
   `codex-apps/seed-audio-dialogue-direction.html` and its export.
9. **CLI packaging.** `mcp-command.ts` resolves the two new HTML files with the
   same `CODEX_REVIEW_UNSUPPORTED` failure when they are missing.
10. **Skill workflow (studio-skills).** Add the panel reference, routing and
    dialogue audio reference updates, with evals for routing and the
    consume/report ordering.

## Tests And Guardrails

- **Engines** (ElevenLabs, mocked SDK):
  - the existing speech, music and voice-sample tests pass unchanged after the
    split;
  - the dialogue operation maps `inputs`, `voice` → `voiceId`, `settings`,
    `modelId: 'eleven_v4'` and `outputFormat` correctly;
  - dialogue validation collects every issue: empty `inputs`, a missing
    text/voice, more than 10 distinct voices, unknown fields, local-media
    markers;
  - the registry resolves each route id to the expected operation.
- **Core** (`shot-plan-dialogue-audio.test.ts`):
  - attach selects the new Take and clears overlapping selected Takes, but not
    adjacent ones;
  - select clears overlaps in the same Shot Plan only;
  - clear leaves the others untouched;
  - discard and restore keep their current behavior;
  - `lines` covers active Take numbers and omits missing numbers.
- **Core:** notification client tests, moved from the CLI unchanged in
  behavior.
- **Codex runtime:**
  - opening validation collects every issue;
  - the capability gate;
  - the Generate → busy → consume (once, then `alreadyConsumed`, with the
    route echoed) → report attached or failed lifecycle;
  - select and discard delegate to Core and notify Studio;
  - unknown session or media ids fail with `CODEX_DIALOGUE_DIRECTION_NOT_FOUND`;
  - Eleven draft validation: lines cover the range, one voice per speaker;
  - Seed `voiceReferences` validation;
  - Eleven `actingScripts` from speech and dialogue provenance, and `null`
    otherwise;
  - the existing `architecture.test.ts` continues to forbid Engines, CLI and
    Studio imports.
- **Studio:**
  - `dialogue-line-range.ts` unit tests for click, shift-extend with fill,
    edge removal, inner trim and single-line no-op;
  - `DialogueLineRail` interaction tests for gutter `+`/`−`, the band and
    the count/dot;
  - Eleven panel tests (mocked bridge):
    - switching between the single-line and dialogue desks;
    - per-line drafts persisting across both;
    - chip insertion into the last-focused editor;
    - per-speaker voice select;
    - the 2,000 counter warning;
    - Edit from this take for single and dialogue Takes;
  - Seed panel tests:
    - avatar insertion only with `audio-tags`;
    - over three speakers disabling Generate;
    - the 2,048 counter warning;
    - per-range drafts;
  - shared tests:
    - Select all disabled state;
    - Generate sending the tool call then the message;
    - the generating placeholder;
    - the failed message;
    - select and delete confirmation;
  - Audio tab grouping tests;
  - the existing `codex-app-architecture.test.ts` extended by import rule to
    the new entries: no server, hono, react-router or `node:` imports.
- **Skills:**
  - `validate-media-generation-skills.mjs` passes;
  - routing evals cover:
    - eligible Codex with `eleven_v4` → Eleven panel;
    - Seed Audio on Fal.ai, WaveSpeed or Pika → Seed panel, with `promptMentions`
      `audio-tags` only for Fal.ai and Pika;
    - `codexGenerationReview: visualize` → panels still open;
    - CLI, Claude and Eleven v3 → unchanged flow;
  - handoff evals cover consume → request → execute → import → report, for
    one-line Eleven, ranged Eleven and Seed.

## Documentation

- New ADR `docs/decisions/0112-select-one-dialogue-audio-take-per-line.md`,
  plus a one-line notice at the top of ADR 0090. The notice also records that
  multi-line Takes may now come from Eleven v4 Dialogue.
- `docs/architecture/media-generation.md`: Codex dialogue direction panels,
  the generate-by-message handoff, and the unchanged execution owner.
- `packages/engines/docs/` provider notes: the ElevenLabs operation registry
  and the dialogue route.
- `docs/architecture/studio-coordination-events.md`: notification client now
  in Core, and the panel `agent` source.
- `docs/development/codex-debugging.md`: how to open each panel against Urban
  Basilica.
- The studio-skills docs listed under Contracts.

## Final Verification

- `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm check`.
- In studio-skills, run its validators and evals.
- **Native Codex Desktop acceptance** with Urban Basilica, Scene 02, Shot Plan
  02-01, lines 4–9:
  - both panels open fullscreen in the right pane;
  - edits, chips, voice change, sliders and range selection work;
  - paid generations of one `eleven_v4` line, one `eleven_v4/text-to-dialogue`
    range (lines 7–9) and one Seed Audio range each:
    - post the message;
    - are consumed once;
    - attach;
    - appear selected;
    - play;
  - select and delete work, and the Studio Audio tab refreshes;
  - Generate while the agent is mid-turn is queued and handled;
  - record screenshots and compare them with mockup version 8 at desktop size.
- Chat-only regression: generate one dialogue Take conversationally with
  `visualize`. It imports and is selected.
- **Architecture-shape review:**
  - inspect `git diff --stat`, the new `dialogue-direction` folders and the
    ElevenLabs `operations/`;
  - confirm `provider.ts`, `server.ts` and every `index.ts` stay thin;
  - confirm there are no model branches in Core or the shared components.

## Completion Checklist

### Review Area

- [x] Selection rule, auto-selection on import, and deletion behavior approved by the user.
- [x] Notification client move approved.
- [x] `eleven_v4/text-to-dialogue` route id and ElevenLabs provider split approved.
- [ ] Implementation matches the Architecture Shape Gate layout; no generic audio panel.
- [ ] No new god file, broad dispatcher, or catch-all helper.

### Architecture And Contracts

- [ ] Core contains no provider, model, or panel knowledge.
- [ ] `packages/codex` imports no Engines, CLI, or Studio React; no tool executes generation.
- [ ] Panels never read `codexGenerationReview` or its display mode; resources declare fullscreen only.
- [ ] ElevenLabs operations resolved only through the bounded registry; `provider.ts` thin.
- [ ] Tool names, visibilities, resources, and URI schemes match the Contracts table.
- [ ] `./dialogue-direction` export is type-only and browser-safe.
- [ ] New diagnostics use the four named `CODEX_DIALOGUE_DIRECTION_*` codes.
- [ ] Notification client lives only in Core; CLI file deleted, no re-export.

### Implementation Slices

- [x] Slice 1: `eleven_v4` route, v4 speech guide section, bundled row.
- [x] Slice 2: ElevenLabs split with unchanged behavior; dialogue operation; dialogue route, Skill input shape, guide, bundled row.
- [x] Slice 3: exclusive selection, attach-selects, `lines` projection, client type, ADR 0112.
- [x] Slice 4: notification client moved; CLI callers updated.
- [x] Slice 5: Audio tab By line / Multi-line grouping with line text.
- [x] Slice 6: Codex session state, projection, media resources, take mutations, actions, both opening tools.
- [x] Slice 7: shared rail, range rule, take list, editor, frame, counter, hooks; Eleven v4 panel with single-line and dialogue desks; build modes.
- [x] Slice 8: Seed Audio panel and entry.
- [x] Slice 9: `renku studio mcp` resolves both new HTML files.
- [x] Slice 10: dialogue direction Skill reference, routing rule, dialogue audio reference update.

### Product Behavior

- [ ] Shared: header with model label and outline Select all (top right, disabled when all selected); rail with click, shift-extend with fill, edge removal, inner trim, gutter `+`/`−`, band, count/dot; one continuous selection only.
- [ ] Eleven single line: speaker row with voice select and sample, exact line, tag-highlighted editor with chips at cursor and Revert.
- [ ] Eleven range: per-speaker voices row, stacked per-line blocks with compact editors and Revert, shared chip row into last-focused editor, 2,000 counter; per-line drafts shared with single-line mode.
- [ ] Eleven controls and Takes: Stability, Similarity, Generate and ⌘/Ctrl+Enter; take rows with radio, play/seek, duration, Edit from this take, inline delete confirmation.
- [ ] Seed: badged avatars, voices row, `@AudioN` insertion and colouring only with `audio-tags`, three-speaker notice, selected lines, prompt highlighting, 2,048 counter, per-range drafts.
- [ ] Generating placeholder; new Take selected and auto-played on success; failure message on failure; Generate disabled while an action is outstanding.
- [ ] Audio tab shows By line and Multi-line groups; select toggle and Trash delete work.
- [ ] Chat-only flow unchanged except imported Takes are selected and ElevenLabs dialogue is available.

### Tests And Guardrails

- [ ] Engines ElevenLabs split regression, dialogue mapping, validation, and registry tests.
- [ ] Core selection, attachment, projection, and notification client tests.
- [ ] Codex runtime lifecycle, validation, provenance, delegation, and architecture tests.
- [ ] Studio range rule, rail, Eleven, Seed, shared panel, Audio tab, and Codex entry import tests.
- [ ] Skill validators, routing evals, and handoff evals.

### Documentation

- [ ] ADR 0112 added; ADR 0090 notice added without rewriting it.
- [ ] Media generation, Engines provider notes, studio coordination, and Codex debugging docs updated.
- [ ] studio-skills docs updated as listed.

### Final Verification

- [x] `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm check` pass.
- [ ] Native Codex acceptance completed with Urban Basilica, including Eleven single, Eleven dialogue, and Seed range generations; screenshots compared with mockup version 8.
- [ ] Mid-turn Generate behavior observed and recorded.
- [ ] `git diff --stat` reviewed; large files inspected; `index.ts`, `server.ts`, and `provider.ts` remain thin.
- [ ] No checklist item satisfied by accepting unreviewable structure; only then mark complete.
