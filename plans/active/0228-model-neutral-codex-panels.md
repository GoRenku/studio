# 0228 Model-Neutral Codex Panels

Status: implemented (native Codex Desktop verification pending)
Date: 2026-10-11

## Summary

Plans 0226 and 0227 built the Codex dialogue direction and image edit panels
around specific models. The result is model-named tools, contracts, folders,
React panels, HTML builds and server options:
`dialogue.direction.eleven-v4.open`, `seed-audio/`, `flux-3-image-edit-panel.tsx`,
`ElevenV4VoiceSettings`, `ImageEditResolution = '1k' | '2k' | '4k'`, and so on.
Every additional model would add another set of code across `packages/codex`,
`packages/studio`, `packages/cli` and the skills. This breaks the accepted
provider extension rule: adding a model changes the Engines provider module and
the Skills, and nothing in Core, Studio or shared request contracts.

This plan makes both panel families **purpose-owned and model-neutral**:

- There is **one panel per purpose**: one dialogue direction panel and one
  image edit panel. Each has one opening tool, one UI resource and one HTML
  build.
- **The Skill describes the selected route as data** when it opens a panel. The
  description has three parts:
  1. route identity and display labels;
  2. a structural description drawn from a small, closed, purpose-level
     vocabulary of interaction shapes;
  3. the native settings the guide marks as relevant, as the existing
     schema-derived control descriptors, renamed `NativeRequestControls`.
- **Panel code grows only with interaction shapes, never with models.** Adding
  a model that fits an existing shape is a `## Codex panel` block in the
  model's Skill guide, and no code changes anywhere.

The approved panel layouts from plans 0226 and 0227 stay. The Eleven v4 desk
becomes the **Line Scripts** layout and the Seed Audio desk becomes the
**Range Prompt** layout. The FLUX 3 desk becomes the image edit panel, driven
by the route's region modes and controls.

## Review Attention

**Behavior added beyond the literal request (and why it is necessary):**

- **ElevenLabs speech and dialogue get Engines input schemas.** Today only the
  ElevenLabs voice-sample operation declares `inputSchema`. The ElevenLabs
  Skill says schema inspection for speech and dialogue is unavailable and
  forbids inventing a local schema. Model-neutral panels take native settings
  as schema-derived controls, so Eleven v4's stability and similarity sliders
  need a real schema. The only correct owner of that schema is the Engines
  ElevenLabs provider module.
  - `speech.ts` and `dialogue.ts` gain `inputSchema` and validate through the
    shared Engines JSON Schema validator.
  - Dialogue keeps its distinct-voice limit as the only rule the schema cannot
    express.
  - The hand-written field checks the schemas replace are deleted.
  - Speech requests with unknown fields now fail at validation, before any
    provider call. Today speech accepts them and silently drops them, while
    provenance still records them as if they were sent.
  - Every ElevenLabs request stored in the Urban Basilica database (six
    speech, one dialogue) uses only fields the new schemas accept.
- **The vocabulary covers the shapes of routes already in the Skills, not
  only today's three panel models.** More image edit and audio models are
  planned, and each should need only a Skill block. The shapes, checked
  against the Skills' supported routes and Fal.ai's live schemas on
  2026-10-11:
  - dialogue routes with no Line-Range operation and no emphasis syntax:
    MiniMax Speech 2.8 HD (Replicate) is single-line text-to-speech;
  - image edit routes with no regions: Nano Banana 2 and Pro, GPT Image 2,
    Seedream 5.0 Pro, Grok Imagine, FLUX Kontext Pro and Z-Image Turbo edit
    routes (Nano Banana 2.1 is planned and has the same shape);
  - image edit routes with no style reference: FLUX Kontext Pro and Z-Image
    Turbo edit on Fal.ai take a single `image_url`.
- **Panel blocks for the user's next image edit models (user-requested
  2026-10-11).** Slice 5 adds `## Codex panel` blocks, with no Studio code,
  for:
  - Nano Banana 2.1 Edit on Fal.ai (`fal-ai/nano-banana-2.1/edit`), new to the
    Skills;
  - Seedream 5.0 Pro Edit on Fal.ai, WaveSpeed and Pika, already in the
    Skills;
  - GPT Image 2.5 Flare Edit and Sunburst Edit on Fal.ai
    (`openai/gpt-image-2.5/flare/edit`, `openai/gpt-image-2.5/sunburst/edit`),
    new to the Skills, with a new canonical guide `gpt-image-2.5.md`.
    `chatgpt-images-2.5.md` stays the guide for Codex's built-in image tool.

  These blocks are the real-route proof of region-free editing. They are also
  why the block format lists routes as an array: Flare and Sunburst are two
  models on one provider.
- **MiniMax Speech 2.8 HD gets no block yet.** Its route takes only a
  MiniMax `voice_id`, and no Skill workflow gives Cast Voices a MiniMax voice
  identity, so its panel could not open for any current speaker. The
  single-line-only shape stays in the vocabulary and is covered by
  fictional-route tests. The block follows with the voice-identity work.
- **Eleven v4's 10-voice dialogue limit appears in the panel.** Every route
  declares one `maxVoices`, which Seed Audio's three references need anyway.
  Declaring Engines' existing limit of 10 shows "select fewer lines" before a
  wasted turn instead of failing after consume. Engines stays the enforcement
  authority.
- **"Edit from Take" works for every route with a declared script location.**
  It replaces the runtime's ElevenLabs-specific provenance parsing. As a
  result, Seed Audio Takes also gain Edit from Take.
- **Shared control validation collects every issue.** The generation review
  previously failed at the first invalid control. It now reports all issues,
  still under `CODEX_REVIEW_INVALID`.

**Visible copy and presentation changes:**

- Both panel headers show `{route label} · {provider label}`. The dialogue
  panels previously showed only the model label.
- Generate disclosure and approval sentences come from one template per
  purpose, filled with Skill-supplied labels, never hardcoded names. The
  dialogue sentences no longer vary by line count or voice binding, and the
  image edit approval no longer names the chosen resolution.
- Native setting sliders read out the native value, e.g. `0.50` instead of
  Eleven's `50`.
- FLUX 3's resolution control shows all five options in Fal.ai's live schema
  (`512sq`, `768sq`, `1k`, `2k`, `4k`, checked 2026-10-11), not today's three.
  It stays a segmented control because the segmented limit is five options.
- Suggested tag chips insert the exact suggestion text. The Skill supplies
  bracketed tags; the panel no longer adds brackets.

**New or changed contracts (all breaking, no aliases):**

- **MCP tools:**
  - `dialogue.direction.eleven-v4.open` and `dialogue.direction.seed-audio.open`
    become `dialogue.direction.open`;
  - `image.edit.flux-3.open` becomes `image.edit.open`;
  - `dialogue.direction.consume` and `image.edit.consume` keep their result
    envelopes; only the `draft` inside becomes route-neutral;
  - every other tool name is unchanged.
- **UI resources:** `ui://renku/dialogue-direction/{eleven-v4,seed-audio}`
  become `ui://renku/dialogue-direction`, and `ui://renku/image-edit/flux-3`
  becomes `ui://renku/image-edit`.
- **Studio packaging:** `codex-apps/dialogue-direction.html` and
  `codex-apps/image-edit.html` replace three per-model HTML builds.
  `@gorenku/studio` package exports, `build:codex` and `vite.codex.config.ts`
  change to match.
- **`CodexServerOptions`:** `dialogueDirectionHtml` and `imageEditHtml`
  replace `elevenV4DialogueDirectionHtml`, `seedAudioDialogueDirectionHtml` and
  `flux3ImageEditHtml`. `renku studio mcp` resolves the new files.
- **Codex package export:** new type-only `./native-request-controls`.
  `GenerationReviewField`, `GenerationReviewControls` and
  `GenerationReviewControlKind` are renamed `NativeRequestControl`,
  `NativeRequestControls` and `NativeRequestControlKind`. The JSON wire shape
  is identical.
- **Dialogue direction and image edit contracts:** open inputs, sessions,
  drafts and consume results are rewritten (see Contracts).
- **Engines:** ElevenLabs speech and dialogue routes now answer
  `renku generation schema show`.
- **Skills:** a new `## Codex panel` section format in canonical model guides,
  and new routing and authoring rules.
- **Unchanged:** no new diagnostic codes. No Core, database, Project Settings
  or CLI command changes.

**Deletions and difficult-to-reverse effects:**

- **Deleted from `packages/codex`:** `dialogue-direction/eleven-v4/`,
  `dialogue-direction/seed-audio/`, `image-edit/flux-3/` and
  `image-edit/draft-context.ts`.
- **Deleted from `packages/studio`:** `features/codex-dialogue-direction/eleven-v4/`,
  `.../seed-audio/`, `.../shared/direction-provider-label.ts`,
  `features/codex-image-edit/flux-3/`, the three per-model HTML files and the
  three per-model app entries.
- **Lockstep release:** the old tool names are removed with no aliases, so
  `studio` and `studio-skills` must release together.
- **No data migration:** panel drafts live only in connection memory, and
  provenance, Takes, selections and Asset Files are untouched.

**Existing behavior deliberately kept unchanged:**

- Core:
  - ADR 0112 (one selected dialogue Take per line);
  - ADR 0113 (imported edits become the selection);
  - `readImageEditTargets` and `readImageEditLineage`;
  - Take select and discard.
- Engines ElevenLabs operation routing and the `eleven_v4/text-to-dialogue`
  route id.
- The one-action Generate, message, consume and report lifecycle, including
  autoplay, two-second polling and notification retry.
- The generation review panel's behavior and wire format, the image edit
  target chooser, the media URI schemes, the panel capability probe and the
  fullscreen display mode.
- The approved panel layouts and today's panel settings (Eleven v4 stability
  and similarity, FLUX 3 resolution), apart from the copy and readout changes
  listed above.
- The Skill rule that FLUX 3 Image Edit is the default `image.edit` route when
  a Fal.ai key is saved.

**Deliberately not in this plan.** No route in the Skills has these shapes.
Each is a vocabulary addition made with the first real model that needs it,
and `model-researcher` records it as a Studio product gap until then:

- image edit routes without a whole-image instruction (every current edit
  route requires a prompt);
- mask-based image edit interactions.

**Assumptions that materially affect the implementation:**

- The route index `name` is a suitable panel label: "Eleven v4", "Seed Audio
  1.0", "FLUX 3 Image Edit". Provider labels come from the same source the
  generation review already uses for `GenerationReviewRoute.providerLabel`.
- Fal.ai's live schemas, checked 2026-10-11, give the new blocks their
  controls: FLUX 3 `resolution` (5-option enum), Nano Banana 2.1 Edit
  `resolution` (`1K`, `2K`, `4K`) and GPT Image 2.5 `quality` (6-option enum).
  Each route's default aspect setting (`auto`) keeps the source aspect, so no
  block lists an aspect or size control. Slice 5 rechecks the live schemas
  and checks WaveSpeed's and Pika's Seedream edit schemas for `image_urls`
  before writing those entries.
- ElevenLabs' documented ranges for the speech `voice_settings` and dialogue
  `settings` fields can be stated as JSON Schema bounds. Slice 1 verifies the
  exact ranges against the ElevenLabs API reference and the pinned SDK types.

**Decisions that need explicit approval:**

1. **Skill-supplied route descriptions.** Each panel-capable model gets a
   `## Codex panel` JSON block in its canonical model guide, rather than a
   capability catalog in Engines or Core. The block's short control list is
   what decides which native settings are relevant in the panel. Engines and
   Core stay catalog-free (media-generation.md: "no … generic model
   catalog").
2. **ElevenLabs input schemas.** Add Engines input schemas for ElevenLabs
   speech and dialogue, and delete the hand-written checks they replace.
3. **Rename the shared control types to `NativeRequest*`.** The wire format is
   unchanged.
4. **New ADR 0114 and a new AGENTS.md top instruction:** model knowledge lives
   only in Engines provider modules and Skills.

## Context

- `AGENTS.md`: Architecture Is A Hard Gate; AI Artifacts And Prompts Are
  Opaque; No Shims; Naming Is Architecture; Keep Code Structure Reviewable;
  Architecture Tests Must Not Encode Implementation Names; Use Shadcn UI
  Controls Only; Preserve Existing Formatting.
- `docs/architecture/media-generation.md`:
  - the provider extension rule (line 497);
  - "Studio must not infer select options, slider constraints … or labels from
    provider/model ids" (line 344);
  - "no generic model catalog";
  - line 225, which currently codifies "Model-specific code lives in per-model
    folders". This plan reverses that sentence.
- ADRs:
  - 0041 (opaque artifacts and prompts);
  - 0086 (Skill-directed provider engines). Its context names exactly the
    coupling this plan removes: "provider addition require[d] coordinated
    changes across Engines, Core, CLI, Studio …";
  - 0088 ("No model-specific schema is stored in Core, Studio, or Skills");
  - 0105 (review routing by host capability);
  - 0112 and 0113 (selection rules, unchanged).
- Plans 0226 (dialogue direction panels) and 0227 (FLUX 3 image edit panel).
  Both are committed (`16b422a1`, `fa61fbf8`); this plan supersedes their
  model-specific parts.
- Packages: `packages/codex`, `packages/studio`, `packages/cli` (packaging
  only), and `packages/engines` (ElevenLabs schemas only).
- Sister repository `$HOME/Projects/aitinkerbox/studio-skills` (committed
  `f036633`):
  - `media-producer` references and model guides;
  - the provider Skills' supported routes and adapters;
  - `model-researcher` authoring rules;
  - the evals and validation scripts.
- Sample project `$HOME/renku-movies/urban-basilica` for native verification.

## Problem Analysis

Model knowledge outside Engines and Skills, as of `fa61fbf8`:

| Kind | Where |
| --- | --- |
| Runtime parses provider-native request fields | `codex/src/dialogue-direction/eleven-v4/draft.ts:53` reads ElevenLabs `request.text` and `request.inputs[].text` from provenance |
| Studio infers labels from provider ids | `studio/.../codex-dialogue-direction/shared/direction-provider-label.ts` |
| Model identity as a type discriminator | `DialogueDirectionPanel = 'eleven-v4' \| 'seed-audio'`, `ImageEditPanel = 'flux-3'`, draft `panel` literals, `DRAFT_VALIDATORS` tables keyed by model in both `actions.ts` files |
| Model facts as constants (often in both Codex and Studio) | Seed Audio's 3 voices (`seed-audio/draft.ts:17` and `seed-audio-voice-references.tsx`), character limits 2000 and 2048, `ImageEditResolution`, Edit/Remove modes (`flux-3/draft.ts:9` and `flux-3-image-edit-panel.tsx`), stability/similarity 0..1 sliders, `@Audio${n}` assembly, bracket-tag regex and auto-bracketing |
| A provider operation split baked into a "generic" type | `DialogueDirectionRoute { speechModel, rangeModel }`, plus a Seed-only rule that the two must be equal (`seed-audio/open.ts:56`) |
| Hardcoded provider and model copy | the disclosure and approval sentences in all three panels |
| Model identity in packaging | tool names, UI URIs, HTML builds, Vite modes, `CodexServerOptions`, CLI `require.resolve`, React app entries, Studio package exports |
| Model identity in the skills' panel contract | route tables in `dialogue-direction-panels.md:61-66`, per-model open inputs, eval token checks |

Adding one more panel model today touches about 15 files across codex, CLI and
Studio, plus docs and skills.

**Root cause.** The generation review already had a model-neutral mechanism.
The Skill authors `GenerationReviewControls` from the live schema, keyed by
native JSON Pointer. Codex validates them structurally, and Studio renders them
generically. The panels bypassed that mechanism with fixed per-model inputs.

**Already correct (kept):**

- Core's panel support has no model knowledge.
- The Engines ElevenLabs operations are the right home for provider protocol
  code.
- `panel-sessions/` and the shared Studio components are generic: line rail,
  take list, editors, region canvas, version strip and target chooser.

## Design

### Principle

A panel is a purpose: dialogue direction or image edit. The Skill describes the
selected route when it opens the panel. Codex validates the description
structurally and validates drafts against it. Studio renders it through a
closed, purpose-level vocabulary.

None of these layers reads or branches on a provider id or a model id, apart
from:

- echoing the ids back to the agent on consume;
- matching Take provenance's envelope `provider` and `model` against the
  described route.

Creative text stays opaque (ADR 0041). Highlighting, mention coloring and
token insertion are presentation-only and preserve the exact authored text.
The runtime never validates direction content.

### Domain vocabulary

- **Route Description:** the Skill-supplied description of how the selected
  route is directed in a panel. It is the `route` object of an opening input.
- **Line Scripts:** a dialogue script layout with one direction text per
  screenplay line.
- **Range Prompt:** a dialogue script layout with one direction text for the
  selected line range.
- **Direction Script:** direction text for a line range. Line Scripts use one
  single-line script per line; Range Prompt uses one script for the whole
  range. The layout lives only on the route, never repeated in payloads.
- **Speaker Voices:** a voice binding where each speaker in the selection is
  performed by one Cast Voice, sent to the provider by its identity.
- **Voice References:** a voice binding with ordered reference samples, one
  per speaker in order of first appearance. The route may address them by
  exact **Voice Mentions** in the prompt.
- **Max Voices:** the most distinct voices one Generate may use, for either
  binding.
- **Single-Line and Line-Range operations:** the exact provider route ids that
  produce one-line and multi-line Takes. A route may have no Line-Range
  operation; its panel directs one line per Take.
- **Script Location:** where an operation's native request keeps its direction
  text, so an earlier Take's direction can be reopened.
- **Region Modes:** the image edit region actions the route accepts, such as
  FLUX 3's Edit and Remove, with their labels and instruction rules. A route
  that takes no regions has none.
- **Native Request Controls:** schema-derived control descriptors keyed by
  native JSON Pointer. These are the existing review controls, renamed.

### Dialogue direction

The Route Description carries, per operation:

- the exact model id;
- an advisory character limit;
- the operation's own Native Request Controls;
- an optional Script Location.

Controls are per operation because one setting can have different native names
across operations. Eleven's speech uses `voice_settings.similarity_boost`
while its dialogue uses `settings.similarity`.

Script layout and voice binding are separate route fields, so neither becomes
a disguised model discriminator. Studio picks the desk by layout and the voice
row by binding, and they compose without code for each pairing.

| Route | Layout | Binding | Operations |
| --- | --- | --- | --- |
| Eleven v4 | Line Scripts; `bracket-tags` emphasis | Speaker Voices, max 10 | Single-Line `eleven_v4`, Line-Range `eleven_v4/text-to-dialogue`; stability and similarity controls on each |
| Seed Audio 1.0 (Fal.ai, Pika) | Range Prompt; `quoted-spans` emphasis | Voice References, max 3, mentions `@Audio1–3` | the same route id for both, no controls |
| Seed Audio 1.0 (WaveSpeed) | Range Prompt; `quoted-spans` emphasis | Voice References, max 3, no mentions | the same route id for both, no controls |
| MiniMax Speech 2.8 HD (Replicate; block waits for MiniMax Cast Voice identities) | Line Scripts; no emphasis | Speaker Voices, max 1 | Single-Line `minimax/speech-2.8-hd` with `/emotion` and `/speed`; no Line-Range |
| A future route with these shapes | data only | data only | data only |

### Image edit

The image edit purpose always offers a whole-image instruction; every current
edit route requires a prompt. The agent maps the draft into the native
request. The Route Description carries what varies between routes:

- its Region Modes in display order, or `null` when the route takes no
  regions;
- whether it takes a style reference image;
- its Native Request Controls.

Box geometry stays the panel's own envelope: a 0–1000 grid with the origin at
top-left. The agent converts it to the model's native notation (identity for
FLUX 3). Region instruction length (2000), whole-image instruction length
(4000), the maximum of 50 regions and the minimum region side (15 grid units)
stay purpose-level envelope bounds, not model facts.

| Route | Region Modes | Style reference |
| --- | --- | --- |
| FLUX 3 Image Edit (Fal.ai) | `edit` (instruction required), `remove` (instruction optional) | yes (`image_urls`) |
| Nano Banana 2.1 Edit (Fal.ai) | none | yes (`image_urls`) |
| Seedream 5.0 Pro Edit (Fal.ai, WaveSpeed, Pika) | none | yes (`image_urls`) |
| GPT Image 2.5 Flare Edit and Sunburst Edit (Fal.ai) | none | yes (`image_urls`) |
| Nano Banana 2 and Pro Edit, GPT Image 2 Edit, Grok Imagine Edit (blocks added later) | none | yes (`image_urls`) |
| FLUX Kontext Pro Edit, Z-Image Turbo Edit on Fal.ai (blocks added later) | none | no (single `image_url`) |

Panel controls in this plan's blocks:

- FLUX 3: `/resolution`.
- Nano Banana 2.1 Edit: `/resolution`.
- GPT Image 2.5 Flare and Sunburst: `/quality`.
- Seedream 5.0 Pro Edit: none. Fal.ai's only size field, `image_size`, mixes
  aspect presets with auto sizes. Its default `auto_2K` keeps the source
  aspect, so the panel shows no setting.

Routes without a whole-image instruction, and mask-based models, are outside
this vocabulary (see Review Attention).

### Native settings in panels

**Which settings appear.** Only the native settings the model guide's
`## Codex panel` block lists in `controlPointers`. The panel never shows a
route's whole schema. The guide names the few settings that matter for this
application, usually two or three; everything else is left out of the panel.
The live schema supplies each listed control's kind, bounds and options, so
the guide never restates them.

Panels reuse Native Request Controls with a panel presentation profile that
`packages/codex` enforces when a panel opens:

- allowed kinds are `text`, `number`, `integer`, `boolean` and `enum`;
- every control needs an `initialValue`;
- `nullable` is not allowed.

Studio renders controls by shape, never by key or model:

- a number or integer with both bounds becomes a compact Slider with a
  native-value readout;
- other numbers and integers become a compact number Input;
- an enum with at most five options becomes a segmented button group;
- larger enums become a Select;
- a boolean becomes a Switch;
- text becomes an Input.

The dialogue panel renders the active operation's controls inline in the
Generate row. The image edit panel renders each control group as a section,
using the group label as its heading (FLUX: "Output").

### Generate copy

- **Dialogue disclosure:** `Generate sends this direction and the chosen
  voices to {providerLabel} and runs one paid {label} generation with your
  saved {providerLabel} key.` The approval sentence posted as the user is the
  first-person form: "I approve sending …".
- **Image edit disclosure:** `Generate uploads this image and any references it
  needs to {providerLabel} and runs one paid {label} with your saved
  {providerLabel} key.` The approval is the first-person form of the same
  sentence.
- **Voice-limit notice:** `{label} takes up to {n} voices. Select fewer lines.`

### Skills: `## Codex panel` sections

Each panel-capable canonical model guide gets a `## Codex panel` section. It
holds one fenced `json` block per panel purpose, plus prose:

- how to author the initial direction;
- how to map the consumed result into the native request (moved out of the
  panel references);
- which native fields are panel controls and why.

Dialogue example (Eleven v4, in `model-guides/audio/elevenlabs-speech.md`):

```json
{
  "purpose": "dialogue-direction",
  "scriptLayout": "line-scripts",
  "voiceBinding": { "kind": "speaker-voices" },
  "maxVoices": 10,
  "emphasis": "bracket-tags",
  "routes": [
    {
      "provider": "elevenlabs",
      "singleLine": {
        "model": "eleven_v4",
        "characterLimit": null,
        "controlPointers": ["/voice_settings/stability", "/voice_settings/similarity_boost"],
        "scriptLocation": { "kind": "text", "pointer": "/text" }
      },
      "lineRange": {
        "model": "eleven_v4/text-to-dialogue",
        "characterLimit": 2000,
        "controlPointers": ["/settings/stability", "/settings/similarity"],
        "scriptLocation": { "kind": "line-list", "listPointer": "/inputs", "textPointer": "/text" }
      },
      "voiceMentions": null
    }
  ]
}
```

`routes` is an array of provider route entries, so one guide can describe
several providers (Seed Audio) or several models on one provider (GPT Image
2.5 Flare and Sunburst).

Image edit example (FLUX 3, in `model-guides/image/flux-3-image.md`):

```json
{
  "purpose": "image-edit",
  "routes": [
    {
      "provider": "fal-ai",
      "model": "blackforestlabs/flux-3/edit-image",
      "regionModes": [
        { "id": "edit", "label": "Edit", "instructionRequired": true, "placeholder": "What should change here?" },
        { "id": "remove", "label": "Remove", "instructionRequired": false, "placeholder": "Optional: what should fill the space" }
      ],
      "styleReference": true,
      "controlPointers": ["/resolution"]
    }
  ]
}
```

Region-free example (GPT Image 2.5, in `model-guides/image/gpt-image-2.5.md`):

```json
{
  "purpose": "image-edit",
  "routes": [
    { "provider": "fal-ai", "model": "openai/gpt-image-2.5/flare/edit", "regionModes": null, "styleReference": true, "controlPointers": ["/quality"] },
    { "provider": "fal-ai", "model": "openai/gpt-image-2.5/sunburst/edit", "regionModes": null, "styleReference": true, "controlPointers": ["/quality"] }
  ]
}
```

To build the opening input, the agent:

1. reads the block entry for the selected provider and model, and copies its
   fields into the `route` object, putting the entry's `voiceMentions` into a
   Voice References binding as `mentions`;
2. takes `label` from the route index `name` (the Single-Line route for
   dialogue) and `providerLabel` from the same source as generation review
   routes;
3. builds each operation's controls from the live schema for the listed
   pointers, using the existing generation review control rules, and sets
   their initial values;
4. authors the initial Direction Scripts and voices.

**Routing rule.** The Skill opens the purpose panel when all of these hold:

- the host is trusted Codex Desktop;
- the panel probe advertises support;
- the purpose matches;
- the selected route appears in a `## Codex panel` block for that purpose.

Otherwise the existing flow runs. No route table lives in the panel
references. A model that needs an interaction shape outside the vocabulary
gets no block; `model-researcher` records it as a Studio product gap.

## Contracts

### MCP tools and resources

| Tool or resource | Visibility | Change |
| --- | --- | --- |
| `dialogue.direction.open` | model | replaces the two per-model opening tools |
| `dialogue.direction.generate`, `.take.select`, `.take.discard` | app | draft and session shapes change |
| `dialogue.direction.consume`, `.report` | model | the consume envelope is unchanged and carries the new draft; report is unchanged |
| `ui://renku/dialogue-direction` | fullscreen | replaces the two per-model URIs |
| `image.edit.open` | model | replaces `image.edit.flux-3.open` |
| `image.edit.generate` | app | the draft shape changes |
| `image.edit.consume`, `.report` | model | the consume envelope is unchanged and carries the new draft; report is unchanged |
| `ui://renku/image-edit` | fullscreen | replaces `ui://renku/image-edit/flux-3` |
| `image.edit.target.*`, `ui://renku/image-edit/target-chooser` | — | unchanged |
| `renku-direction://`, `renku-image-edit://`, `renku-image-target://` | — | unchanged |

### `@gorenku/studio-codex/native-request-controls` (type-only)

```ts
export type NativeRequestControlKind = 'text' | 'multiline' | 'number' | 'integer' | 'boolean' | 'enum' | 'multi-enum' | 'object' | 'array';

export interface NativeRequestControl {
  /** Root controls use exact native request JSON Pointers; object properties use native property names. */
  key: string;
  label: string;
  description?: string;
  kind: NativeRequestControlKind;
  initialValue?: JsonValue;
  required?: boolean;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: Array<{ value: JsonValue; label: string; description?: string }>;
  properties?: NativeRequestControl[];
  element?: NativeRequestControl;
}

export interface NativeRequestControlGroup {
  label: string;
  fields: NativeRequestControl[];
}

export interface NativeRequestControls {
  groups: NativeRequestControlGroup[];
}
```

`GenerationReviewRequest.controls` becomes `NativeRequestControls`. The
generation review wire format is unchanged.

### `@gorenku/studio-codex/dialogue-direction` (type-only)

```ts
export interface DialogueLineRange { start: number; end: number }

export type DialogueDirectionScriptLayout = 'line-scripts' | 'range-prompt';
export type DialogueDirectionEmphasis = 'bracket-tags' | 'quoted-spans';

export type DialogueDirectionVoiceBinding =
  | { kind: 'speaker-voices' }
  /** `mentions` holds the exact prompt text per reference position; null when the route has no mention syntax. */
  | { kind: 'voice-references'; mentions: string[] | null };

export type DialogueDirectionScriptLocation =
  | { kind: 'text'; pointer: string }
  | { kind: 'line-list'; listPointer: string; textPointer: string };

export interface DialogueDirectionOperation {
  /** Exact provider route id; opaque to Codex and Studio. */
  model: string;
  /** Advisory maximum characters of direction text per Generate; shown as a counter, never enforced. */
  characterLimit: number | null;
  controls: NativeRequestControls;
  scriptLocation: DialogueDirectionScriptLocation | null;
}

export interface DialogueDirectionRoute {
  provider: string;
  providerLabel: string;
  label: string;
  scriptLayout: DialogueDirectionScriptLayout;
  voiceBinding: DialogueDirectionVoiceBinding;
  /** Most distinct voices one Generate may use. */
  maxVoices: number;
  /** null when the route has no emphasis syntax worth highlighting. */
  emphasis: DialogueDirectionEmphasis | null;
  operations: {
    singleLine: DialogueDirectionOperation;
    /** null when the route directs one line per Take. */
    lineRange: DialogueDirectionOperation | null;
  };
}

/** Line Scripts: one single-line script per line. Range Prompt: one script for the whole range. */
export interface DialogueDirectionScript {
  turnRange: DialogueLineRange;
  text: string;
}

export interface DialogueDirectionSpeakerInput {
  castMemberId: string;
  castVoiceIds: string[];
  initialCastVoiceId: string;
}

export interface DialogueDirectionOpenInput {
  project: string;
  shotPlanId: string;
  route: DialogueDirectionRoute;
  turnRange: DialogueLineRange;
  initialSelection: DialogueLineRange;
  speakers: DialogueDirectionSpeakerInput[];
  /** Line Scripts: one per line in turnRange. Range Prompt: prefilled prompts for ranges within turnRange. */
  initialScripts: DialogueDirectionScript[];
  /** Inserted verbatim as chips; never validated. */
  suggestedTags: string[];
}

export interface DialogueDirectionTake {
  takeId: string;
  turnRange: DialogueLineRange;
  selected: boolean;
  durationSeconds: number | null;
  audioUri: string;
  createdAt: string;
  /** Provenance provider equals route.provider and provenance model is one of the route's operation models. */
  matchesRoute: boolean;
  /** Read through the operation's Script Location; null when unavailable. */
  scripts: DialogueDirectionScript[] | null;
}

export interface DialogueDirectionSession {
  sessionId: string;
  revision: number;
  route: DialogueDirectionRoute;
  shotPlan: { id: string; title: string; sceneHeading: string };
  lines: DialogueDirectionLine[];          // unchanged shape
  voices: Record<string, DialogueDirectionVoice[]>; // unchanged shape
  takes: DialogueDirectionTake[];
  action: DialogueDirectionAction | null;  // unchanged shape
  lastCompletedAction: { actionId: string; takeId: string } | null;
  initial: {
    selection: DialogueLineRange;
    scripts: DialogueDirectionScript[];
    voices: Record<string, string>;
    suggestedTags: string[];
  };
}

export interface DialogueDirectionDraft {
  turnRange: DialogueLineRange;
  /** Direction Scripts covering turnRange, by the route's layout. */
  scripts: DialogueDirectionScript[];
  /** One per speaker in the selected lines, in order of first appearance. The Skill maps position n to `mentions[n - 1]`. */
  voices: Array<{ castMemberId: string; castVoiceId: string }>;
  /** Values of every control of the operation the selection uses, keyed by JSON Pointer. */
  values: Record<string, JsonValue>;
}

/** Envelope unchanged; `model` is the operation the draft's range uses. */
export type DialogueDirectionConsumeResult =
  | {
      status: 'consumed';
      sessionId: string;
      actionId: string;
      project: string;
      shotPlanId: string;
      provider: string;
      model: string;
      draft: DialogueDirectionDraft;
    }
  | { status: 'alreadyConsumed'; sessionId: string; actionId: string };
```

The deleted types are `DialogueDirectionPanel`, `ElevenV4*`, `SeedAudio*`, the
old `DialogueDirectionRoute { speechModel, rangeModel }` and
`TakeActingScriptsReader`.

### `@gorenku/studio-codex/image-edit` (type-only)

```ts
export interface ImageEditRegionMode {
  id: string;
  label: string;
  instructionRequired: boolean;
  placeholder: string;
}

export interface ImageEditRoute {
  provider: string;
  providerLabel: string;
  model: string;
  label: string;
  /** Region actions in display order, the first being the default; null when the route takes no regions. */
  regionModes: ImageEditRegionMode[] | null;
  styleReference: boolean;
  controls: NativeRequestControls;
}

export interface ImageEditRegion {
  number: number;
  /** An `ImageEditRegionMode.id` of the session route. */
  mode: string;
  box: ImageEditRegionBox; // unchanged 0–1000 grid
  instruction: string;
}

export interface ImageEditOpenInput {
  project: string;
  sourceAssetFileId: string;
  route: ImageEditRoute;
  /** Prefill from the user request; empty when none. */
  initialWholeImageInstruction: string;
}

export interface ImageEditSession {
  sessionId: string;
  revision: number;
  route: ImageEditRoute;
  owner: ImageEditOwner;
  imageType: string;
  selectable: boolean;
  versions: ImageEditVersion[];
  editBaseAssetFileId: string | null;
  /** Empty when route.styleReference is false. */
  styleReferences: ImageEditStyleReference[];
  action: ImageEditAction | null;
  lastCompletedAction: { actionId: string; assetFileId: string } | null;
  initialWholeImageInstruction: string;
}

export interface ImageEditDraft {
  baseAssetFileId: string;
  wholeImageInstruction: string;
  styleReferenceAssetFileId: string | null;
  regions: ImageEditRegion[];
  values: Record<string, JsonValue>;
}

/** Envelope unchanged; only the draft shape changes. */
export type ImageEditConsumeResult =
  | {
      status: 'consumed';
      sessionId: string;
      actionId: string;
      project: string;
      provider: string;
      model: string;
      base: { assetFileId: string; projectRelativePath: string };
      styleReference: { assetFileId: string; projectRelativePath: string; name: string | null } | null;
      draft: ImageEditDraft;
    }
  | { status: 'alreadyConsumed'; sessionId: string; actionId: string };
```

The deleted types are `ImageEditPanel`, the old `ImageEditRegionMode` string
union, `ImageEditResolution`, `ImageEditInitial`, `Flux3ImageEditDraft` and
`Flux3ImageEditOpenInput`.

### Validation rules owned by Codex

- **Route Description, at open:**
  - non-empty labels and model ids;
  - `maxVoices` is at least 1;
  - `mentions`, when present, has exactly `maxVoices` distinct non-empty
    strings;
  - Script Location kinds agree with the layout: Line Scripts uses `text` for
    Single-Line and `line-list` for Line-Range; Range Prompt uses `text` for
    both;
  - pointers are valid JSON Pointers;
  - region mode ids are unique and non-empty, and at least one mode is
    present when the list is not null;
  - controls pass the native control rules plus the panel presentation
    profile.
- **Opening input, against Core context:**
  - the existing range, speaker and Cast Voice rules;
  - Line Scripts: `initialScripts` are single-line and cover every line in
    `turnRange` once, in order;
  - Range Prompt: `initialScripts` ranges lie within `turnRange` and do not
    repeat.
- **Draft, against the session:**
  - the turn range lies within the session lines;
  - a multi-line range needs a Line-Range operation;
  - the scripts follow the layout: Line Scripts has one single-line script per
    selected line, in order; Range Prompt has exactly one script whose range
    equals the draft's turn range;
  - voices list one entry per speaker, in order of first appearance, from the
    offered Cast Voices;
  - the selected lines have at most `maxVoices` distinct speakers;
  - `values` has exactly the active operation's control keys, each valid;
  - for image edit: the base equals the current edit base; regions are empty
    when `regionModes` is null; region mode ids belong to the route and
    instruction-required modes have an instruction; the style reference is
    null when the route takes none, and otherwise an available sheet; and
    there is at least one region or a non-empty whole-image instruction.

All failures use the existing `CODEX_DIALOGUE_DIRECTION_*` and
`CODEX_IMAGE_EDIT_*` codes and collect every issue.

### Engines

- `elevenLabsSpeechOperation.inputSchema` covers `text` (required), `voice`
  (required), `voice_settings { stability, similarity_boost, style, speed,
  use_speaker_boost }` and `output_format`, with `additionalProperties: false`
  and ranges verified in Slice 1.
- `elevenLabsDialogueOperation.inputSchema` covers `inputs[{ text, voice }]`
  (required, non-empty), `settings { stability, similarity }`,
  `output_format`, `language_code` and `seed` (0..4294967295), with
  `additionalProperties: false`.
- Both operations validate through `shared/json-schema-validation.ts` and keep
  `ENGINE_REQUEST_INVALID`. Dialogue keeps its at-most-10-distinct-voices rule.

## Architecture Shape Gate

### Ownership

- **Engines:** owns ElevenLabs field facts as input schemas inside the
  ElevenLabs provider module. Nothing else in Engines changes.
- **Core:** unchanged. It learns nothing about panels, routes, layouts or
  controls.
- **Codex runtime (`packages/codex`):**
  - `native-request-controls/` owns the control contract, its zod schema, its
    structural and value validation, and JSON Pointer helpers. It is shared by
    generation review and panels.
  - `panel-sessions/` additionally owns the panel presentation profile for
    controls.
  - `dialogue-direction/` and `image-edit/` each own one opening tool, Route
    Description validation, draft validation and the session lifecycle.
  - It never reads a provider or model id beyond echoing it and matching
    provenance envelopes.
- **Studio (`packages/studio`):**
  - owns two purpose panels and the compact control presentation;
  - picks a layout component by `route.scriptLayout` and renders bindings,
    modes and controls from session data;
  - holds no provider or model ids, limits or labels.
- **CLI:** resolves the four packaged HTML files. Nothing else changes.
- **Skills:** own every model fact: `## Codex panel` blocks, which settings
  are relevant in a panel, initial direction authoring, the mapping from
  consume results to native requests, and routing.

### Final file layout

`packages/codex/src/`:

```text
native-request-controls/
  contracts.ts        type-only control contract (package export ./native-request-controls)
  schemas.ts          nativeRequestControlsSchema (moved from generation-review-schemas.ts)
  validation.ts       nativeRequestControlIssues, nativeRequestValueIssues (moved from generation-review-contracts.ts)
  json-pointer.ts     jsonPointerSegments, readJsonPointer, nativeControlEnvelope
  validation.test.ts  control cases moved from generation-review-contracts.test.ts
panel-sessions/
  panel-controls.ts   panelControlIssues: the panel presentation profile
  (existing files unchanged)
dialogue-direction/
  contracts.ts            rewritten type-only contract
  schemas.ts              open, draft, select, discard, consume and report schemas
  opening.ts              registers dialogue.direction.open; opens a session
  route-validation.ts     Route Description consistency
  opening-validation.ts   opening input against Core context and the route
  draft-validation.ts     draft against the session route
  take-directions.ts      reads a Take's Direction Scripts through the operation's Script Location
  validation.ts           existing range and speaker helpers
  actions.ts              generate, consume and report (no dispatch table)
  session-state.ts, session-projection.ts, resources.ts, tools.ts,
  take-mutations.ts, diagnostics.ts, index.ts, dialogue-direction.test.ts
image-edit/
  contracts.ts            rewritten type-only contract
  schemas.ts              open, draft, consume and report schemas
  opening.ts              registers image.edit.open; opens a session
  route-validation.ts     Route Description consistency
  draft-validation.ts     draft against the session route
  region-validation.ts    box envelope plus mode rules from the route
  actions.ts, session-state.ts, session-projection.ts, resources.ts, tools.ts,
  diagnostics.ts, edit-base.ts, index.ts, image-edit.test.ts
  target-chooser/         unchanged
generation-review-contracts.ts   shrinks; delegates control checks to native-request-controls
generation-review-schemas.ts     imports nativeRequestControlsSchema
client.ts                        control types removed; imports NativeRequestControls
server.ts                        CodexServerOptions with purpose-named HTML options
```

Deleted: `dialogue-direction/eleven-v4/`, `dialogue-direction/seed-audio/`,
`image-edit/flux-3/` and `image-edit/draft-context.ts`.

`packages/studio/`:

```text
codex-apps/
  generation-review.html, image-edit-target-chooser.html   unchanged
  dialogue-direction.html, image-edit.html                 new
src/app/
  codex-dialogue-direction.tsx, codex-image-edit.tsx       new
src/features/codex-panels/
  panel-native-controls.tsx        PanelNativeControls: compact presentation by control shape
  panel-native-controls.test.tsx
  native-request-values.ts         initialNativeRequestValues(controls)
  (existing files unchanged)
src/features/codex-dialogue-direction/
  dialogue-direction-panel.tsx     session gate; picks the layout desk by route.scriptLayout
  dialogue-direction-panel.test.tsx
  line-scripts/
    line-scripts-desk.tsx            from eleven-v4-direction-panel.tsx
    single-line-script-editor.tsx    from eleven-v4/single-line-desk.tsx
    multi-line-script-editor.tsx     from eleven-v4/dialogue-desk.tsx
  range-prompt/
    range-prompt-desk.tsx            from seed-audio-direction-panel.tsx
  shared/
    speaker-voice-row.tsx            merges the dialogue-desk speaker row and seed-audio-voice-references.tsx; binding-aware
    suggested-tag-chips.tsx          from eleven-v4/acting-tag-chips.tsx; inserts verbatim
    direction-emphasis.ts            merges acting-script-highlight.ts and performance-prompt-highlight.ts
    direction-disclosure.ts          disclosure, approval and voice-limit text templates
    direction-generate-row.tsx       active-operation controls, character count, Generate
    (existing rail, take list, editor, frame, avatar, colour, voice select, ranges, speakers, session hook)
  testing/                           fixtures rewritten with fictional routes
src/features/codex-image-edit/
  image-edit-panel.tsx             from flux-3/flux-3-image-edit-panel.tsx; route-driven
  image-edit-panel.test.tsx
  shared/
    image-edit-disclosure.ts         disclosure and approval templates
    (existing; RegionList, readiness and region draft read modes from the route)
  testing/                         fixture rewritten with fictional routes
src/features/codex-generation-review/generation-review-controls.tsx   type rename only
```

Deleted from `packages/studio`:

- `features/codex-dialogue-direction/eleven-v4/`;
- `features/codex-dialogue-direction/seed-audio/`;
- `features/codex-dialogue-direction/shared/direction-provider-label.ts`;
- `features/codex-image-edit/flux-3/`;
- `codex-apps/{eleven-v4-dialogue-direction,seed-audio-dialogue-direction,flux-3-image-edit}.html`;
- `src/app/codex-{eleven-v4-dialogue-direction,seed-audio-dialogue-direction,flux-3-image-edit}.tsx`.

`packages/engines/src/providers/elevenlabs/operations/`:

- `speech-schema.ts` and `dialogue-schema.ts` hold the input schemas;
- `speech.ts` and `dialogue.ts` declare them and validate through the shared
  validator;
- `dialogue.ts` shrinks by its hand-written field checks.

### Public entrypoints

- `registerDialogueDirection(server, { html, homeDir })` and
  `registerImageEdit(server, { editHtml, targetChooserHtml, homeDir })`.
- `createCodexServer` and `startCodexServer` take `CodexServerOptions` with
  `generationReviewHtml`, `dialogueDirectionHtml`, `imageEditHtml` and
  `imageEditTargetChooserHtml`.
- Package exports:
  - `.` remains the runtime server entry;
  - `./client` remains the type-only generation review contract;
  - `./dialogue-direction`, `./image-edit` and `./native-request-controls`
    each point at one type-only `contracts.ts`.

### `index.ts` rules

- `dialogue-direction/index.ts` and `image-edit/index.ts` only create state,
  register the resource, the opening tool, the shared tools and the session
  resources, and chain `onclose`. Each has one resource registration and one
  opening registration.
- `native-request-controls/` has no `index.ts`. Callers import from the file
  that owns the concept.

### Where variation lives

There is no model registry or provider registry anywhere. Variation is
expressed only through these purpose-level discriminants, each with a closed
set of values:

- **Script layout.** Studio maps `route.scriptLayout` to `LineScriptsDesk` or
  `RangePromptDesk` with a two-entry `Record`. Codex draft validation
  branches on the same two layouts in two small functions.
- **Voice binding.** One `SpeakerVoiceRow` handles both kinds. The
  draft-validation limit check reads `maxVoices` for either kind.
- **Emphasis.** `direction-emphasis.ts` maps each emphasis value to one
  CodeMirror decoration source; `null` adds none.
- **Control kind.** `panel-native-controls.tsx` uses a renderer table keyed by
  kind and shape, mirroring `generation-review-controls.tsx`.

A new model never adds an entry to any of these tables. A new entry means a new
interaction shape, which needs a product decision and an ADR update.

### Forbidden shapes

- Any provider id, model id, model label, model limit or provider label in
  the Codex panel modules (`dialogue-direction/`, `image-edit/`,
  `panel-sessions/`, `native-request-controls/`, `server.ts`), the Studio
  Codex panel features and app entries, the Codex HTML files, or the CLI Codex
  wiring. This includes their tests, which use fictional routes such as
  `acme-audio` and `acme/voice-one`.
- Reading native request fields from provenance except through a
  Skill-declared Script Location.
- Per-model folders, files, components, tools, URIs, HTML builds, server
  options, Vite modes or fixtures.
- A "route kind", "model family" or "panel variant" enum, or any other
  disguised model discriminator.
- Validating or interpreting direction text, region instructions or mention
  usage beyond presentation.
- Studio enforcing route rules that Codex does not also enforce. Studio
  readiness may only explain the same rules.
- One component holding both layouts' state through conditionals. Layouts are
  separate desks that share components.

### Stop conditions

Stop and revise the plan if any of these happens:

- an implementation step needs a model or provider name to decide behavior;
- a desk or validation function starts branching on more than layout, binding
  kind or control kind;
- `dialogue-direction-panel.tsx`, `line-scripts-desk.tsx`,
  `range-prompt-desk.tsx` or `image-edit-panel.tsx` grows beyond about 180
  lines;
- `draft-validation.ts` or `route-validation.ts` grows beyond about 150 lines
  in either family;
- a current model cannot be expressed in the vocabulary without a new field.
  That is a product decision to bring back to the user, not a field to add
  quietly.

## Implementation Slices

Each slice keeps `pnpm build`, `pnpm test` and `pnpm lint` green. Slices 3 and
4 change Codex contracts that Studio consumes, so each spans the runtime, the
Studio panel and the packaging in one slice.

### Slice 1: ElevenLabs input schemas (Engines)

- Verify the exact ranges for `voice_settings` and dialogue `settings` against
  the ElevenLabs API reference and the pinned `@elevenlabs/elevenlabs-js` types.
- Add `speech-schema.ts` and `dialogue-schema.ts`, declare them as
  `inputSchema` on the two operations, and validate through
  `shared/json-schema-validation.ts`.
- Delete the dialogue hand-written field checks the schema replaces. Keep the
  distinct-voice limit.
- Tests:
  - `renku generation schema show` returns the schemas for `eleven_v4` and
    `eleven_v4/text-to-dialogue`;
  - unknown fields, out-of-range settings and missing required fields fail
    with `ENGINE_REQUEST_INVALID` before any SDK call;
  - existing dialogue tests still pass;
  - the stored Urban Basilica request shapes (six speech, one dialogue)
    validate.
- Update `packages/engines/docs/adding-a-provider.md` if it describes
  ElevenLabs operation validation.

### Slice 2: Shared Native Request Controls

- Move the control types into `native-request-controls/contracts.ts`, the zod
  schema into `schemas.ts`, and the structural and value validation into
  `validation.ts`. Validation now returns `DiagnosticIssue[]` through a
  caller-supplied issue factory. Move the pointer helpers into
  `json-pointer.ts` and add `readJsonPointer`.
- Rename the types to `NativeRequest*`. Update `client.ts`,
  `generation-review-contracts.ts`, `generation-review-schemas.ts`, the
  generation review tests, Studio's `generation-review-controls.tsx` and its
  test. Add the `./native-request-controls` package export.
- Add `panel-sessions/panel-controls.ts` with `panelControlIssues`.
- Add Studio `codex-panels/panel-native-controls.tsx` and
  `native-request-values.ts`, using only `src/ui` controls (Slider, Input,
  Select, Switch, Button).
- Tests:
  - the moved control validation cases;
  - the generation review reports every invalid control in one
    `CODEX_REVIEW_INVALID`;
  - `panelControlIssues` rejects disallowed kinds, a missing `initialValue`
    and nullable controls;
  - `PanelNativeControls` renders each shape (bounded number as slider with
    readout, small enum as segmented, large enum as Select, boolean, text) and
    reports changes.

### Slice 3: Model-neutral dialogue direction

Codex runtime:

- Rewrite `contracts.ts` and `schemas.ts`.
- Add `route-validation.ts`, `opening-validation.ts`, `draft-validation.ts`
  and `take-directions.ts`.
- Move the per-model `open.ts` registration into `opening.ts` as
  `dialogue.direction.open`.
- Rewrite `actions.ts` without a validator table. Consume keeps its envelope
  and picks `model` from the operation the draft's range uses.
- `session-projection.ts` matches routes on both operation models and reads
  Take Direction Scripts through `take-directions.ts`.
- Delete `eleven-v4/` and `seed-audio/`.

Studio panel:

- Add `dialogue-direction-panel.tsx`, `line-scripts/` and `range-prompt/`.
- Add the shared `speaker-voice-row.tsx`, `suggested-tag-chips.tsx`,
  `direction-emphasis.ts`, `direction-disclosure.ts` and
  `direction-generate-row.tsx`.
- `DirectionPanelFrame` takes `routeLabel`.
- `DialogueLineRail` disables range extension when `lineRange` is null.
- `DialogueTakeList` offers Edit from Take whenever the Take has `scripts`.
- Delete `eleven-v4/`, `seed-audio/` and `direction-provider-label.ts`.
- Rewrite the fixtures with fictional routes.

Packaging:

- Add `codex-apps/dialogue-direction.html` and
  `src/app/codex-dialogue-direction.tsx`.
- Update the Vite modes, `build:codex` and the package exports.
- Update `CodexServerOptions`, `server.ts` and `dialogue-direction/index.ts`,
  plus CLI `mcp-command.ts`.
- Delete the two per-model HTML files and app entries.

Tests: see Tests And Guardrails.

### Slice 4: Model-neutral image edit

Codex runtime:

- Rewrite `contracts.ts` and `schemas.ts`.
- Add `route-validation.ts` and `draft-validation.ts`.
- `region-validation.ts` takes modes from the route.
- `opening.ts` registers `image.edit.open`.
- Rewrite `actions.ts` without a validator table. Consume keeps its envelope.
- Delete `flux-3/` and `draft-context.ts`.

Studio panel:

- Add `image-edit-panel.tsx`, built from the FLUX desk, keeping its sections.
  The region canvas and region list render only when `regionModes` is not
  null, and the style reference picker only when `styleReference` is true.
- `RegionList`, `generate-readiness.ts` and `use-region-draft.ts` take
  `ImageEditRegionMode[]` from the route; the default mode is the first one.
- Output settings use `PanelNativeControls`.
- Add `image-edit-disclosure.ts`.
- Delete `flux-3/` and rewrite the fixture.

Packaging:

- Add `codex-apps/image-edit.html` and `src/app/codex-image-edit.tsx`.
- Update the Vite modes, `build:codex`, the package exports, `server.ts`,
  `image-edit/index.ts` and CLI `mcp-command.ts`.
- Delete `flux-3-image-edit.html` and its app entry.

### Slice 5: Skills (`studio-skills`)

- `skills/media-producer/references/dialogue-direction-panels.md`:
  - remove the route table and per-model inputs;
  - document the `## Codex panel` dialogue block format;
  - describe assembling the opening input (labels, live-schema controls for
    the listed pointers only, initial Direction Scripts, voices) and
    `dialogue.direction.open`;
  - describe the route-neutral draft in the consume result, including mapping
    voice position n to `mentions[n - 1]`.
- `skills/media-producer/references/image-edit-panels.md`: the same for image
  edit, with `image.edit.open`.
- `skills/media-producer/references/generation-review-routing.md` and
  `SKILL.md` (routing near lines 277–292): adopt the routing rule.
- `skills/media-producer/references/shot-plan-dialogue-audio.md`: update any
  panel tool names and per-model panel limits.
- `model-guides/audio/elevenlabs-speech.md`: add a `## Codex panel` block for
  Eleven v4 with bracketed `suggestedTags` guidance and the speech and
  dialogue mapping from the consume result.
- `model-guides/audio/seed-audio-1.0.md`:
  - add a `## Codex panel` block with Fal.ai, Pika and WaveSpeed entries,
    including `voiceMentions`;
  - add the Range Prompt mapping, with provider notation linked to the
    adapters.
- `fal-ai`, `pika` and `wavespeed` `references/adapters/seed-audio.md`: keep
  the notation and link to the model guide block.
- `model-guides/image/flux-3-image.md`: add a `## Codex panel` block and the
  region-row mapping moved from `image-edit-panels.md`.
- New image edit models and blocks. Recheck each route's live schema first
  (`image_urls`, the listed control, the default aspect setting):
  - `fal-ai-media-provider/references/supported-routes.json`: add
    `fal-ai/nano-banana-2.1/edit` ("Nano Banana 2.1 Edit"),
    `openai/gpt-image-2.5/flare/edit` ("GPT Image 2.5 Flare Edit") and
    `openai/gpt-image-2.5/sunburst/edit` ("GPT Image 2.5 Sunburst Edit"),
    following `model-researcher` bundled-authoring rules;
  - `model-guides/image/nano-banana.md`: cover Nano Banana 2.1 and add a
    `## Codex panel` block for its Fal.ai edit route (`regionModes: null`,
    `styleReference: true`, `/resolution`);
  - `model-guides/image/seedream-5.0-pro.md`: add a `## Codex panel` block
    for the Fal.ai, WaveSpeed and Pika edit routes (`regionModes: null`,
    `styleReference: true`, no controls);
  - new `model-guides/image/gpt-image-2.5.md` for the API family: prompting
    for edits, the Flare and Sunburst Fal.ai routes, and a `## Codex panel`
    block (`regionModes: null`, `styleReference: true`, `/quality`).
    `chatgpt-images-2.5.md` keeps covering Codex's built-in tool and links to
    it;
  - each block's prose maps the draft into the route's native request: the
    edit base first in `image_urls`, then the style reference, and the
    whole-image instruction as `prompt`. Provider placement and mention rules
    come from the provider adapters.
- `skills/elevenlabs-media-provider/SKILL.md`: schema inspection is now
  available for speech and dialogue routes.
- `skills/model-researcher/references/bundled-authoring.md`:
  - when to add a `## Codex panel` block;
  - how to choose its few relevant `controlPointers`;
  - how to record a Studio product gap when a model needs a shape outside the
    vocabulary.
- `skills/media-producer/evals/forward-test-cases.md`:
  - update the tool names;
  - add a case where a guide-declared route opens the panel;
  - add a case where a region-free route (GPT Image 2.5 Flare) opens the
    image edit panel and maps the draft without regions;
  - add a case where a personal route without a guide falls back to the
    conversational flow.
- `scripts/validate-media-purpose-evals.mjs`: require `dialogue.direction.open`
  and `image.edit.open`.
- `scripts/validate-media-generation-skills.mjs`: parse every `## Codex panel`
  block. Fail when:
  - the JSON is invalid;
  - the `purpose` is unknown;
  - a route entry's provider has no provider Skill;
  - a model id is missing from that Skill's `supported-routes.json`;
  - the same provider and model appear in more than one block for a purpose.

### Slice 6: Documentation and rules

- Add ADR `docs/decisions/0114-describe-models-as-skill-data-in-codex-panels.md`.
- Rewrite the "Codex dialogue direction panels" and "Codex image edit panels"
  sections of `docs/architecture/media-generation.md`. Replace the line 225
  sentence, and extend the provider extension rule with panel support as
  Skill data.
- Update `docs/development/codex-debugging.md` with the new build modes, HTML
  files and tool names.
- Add an `AGENTS.md` top instruction, "Model Knowledge Lives In Engines And
  Skills". The rule: provider and model ids, limits, labels and native field
  names belong only in `packages/engines` provider modules and studio-skills.
  Codex panels, Studio, CLI and Core consume Skill-supplied route descriptions
  and schema-derived controls.
- Add a status line to plans 0226 and 0227: "Model-specific panel parts
  superseded by plan 0228." No other edits to those plans.

### Slice 7: Verification and release

- Run the Final Verification commands and the native Codex Desktop checks.
- Release `studio` and `studio-skills` together.

## Tests And Guardrails

**Codex behavior tests (fictional routes only):**

- `dialogue-direction.test.ts`:
  - all four layout and binding pairings open, generate, consume and report,
    because new audio routes may combine them either way;
  - a single-line-only route rejects multi-line drafts;
  - Direction Scripts follow the layout's granularity in opening inputs and
    drafts;
  - consume returns the operation model for single-line and multi-line drafts;
  - `values` must match the active operation's controls exactly;
  - `maxVoices` is enforced for both bindings;
  - Script Location reopens Takes for `text` and `line-list`, and returns
    null when absent or when the list length does not match;
  - provenance from another route gives `matchesRoute: false`;
  - every Route Description inconsistency in the validation rules is reported
    together.
- `image-edit.test.ts`:
  - a fictional route with its own region modes; the first mode is the
    default;
  - a region-free route (`regionModes: null`) and a route without a style
    reference;
  - unknown mode ids, instruction-required modes and the
    "change or region required" rule;
  - control values;
  - the consume envelope carries the route-neutral draft;
  - the existing lineage, edit-base and report tests, unchanged.
- `server.test.ts`: the registered tool and resource names match the purpose
  contracts.

**Studio behavior tests (fictional routes only):**

- `dialogue-direction-panel.test.tsx`:
  - each layout renders its desk and each binding its voice row, with mention
    insertion, emphasis (including none) and chips;
  - a single-line-only route keeps the rail to one line;
  - the active operation's controls switch with the selection;
  - the character counter follows the active operation;
  - the voice-limit notice disables Generate;
  - Edit from Take works for both layouts;
  - disclosure and approval text come from the route labels;
  - the header label is correct.
- `image-edit-panel.test.tsx`:
  - a region-free route hides the region canvas and list, and a route without
    a style reference hides the picker;
  - mode labels and placeholders come from the route;
  - readiness messages are correct;
  - controls render through `PanelNativeControls`;
  - the approval text is correct.
- `panel-native-controls.test.tsx` and the updated generation review control
  tests.
- `codex-app-architecture.test.ts`: unchanged. It derives entries from
  `codex-apps/`, so the new HTML files are covered.

**Engines:** the ElevenLabs schema and validation tests from Slice 1.

**Architecture guardrails (no implementation-name needles):**

- Extend Codex `architecture.test.ts`. Every file named by a `package.json`
  subpath export other than the root `.` runtime entry, read from `exports`
  rather than hard-coded, must be type-only: no runtime imports, no `node:`
  imports, and no `@gorenku/studio-core/server`. This protects the
  browser-safe public contract boundary as exports change.
- The fictional-route behavior tests are the positive contract. They prove an
  unseen route needs no code, and they would fail if a model branch became
  required.
- The new `AGENTS.md` top instruction and ADR 0114 are the review rule.
  Reviewers treat model knowledge in these packages as a high-severity
  boundary violation.

## Documentation

- New ADR 0114: Describe Models As Skill Data In Codex Panels.
- `docs/architecture/media-generation.md`: both panel sections and the
  provider extension rule.
- `docs/development/codex-debugging.md`.
- `AGENTS.md`: the new top instruction.
- `packages/engines/docs/adding-a-provider.md`, if it describes ElevenLabs
  validation.
- Plans 0226 and 0227: one supersession status line each.
- The studio-skills documents listed in Slice 5.

## Final Verification

Run in `studio`:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
pnpm test:engines
pnpm --filter @gorenku/studio-codex test
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio build:codex
```

Run in `studio-skills`:

```bash
pnpm test
```

Model-knowledge scan. This should print nothing:

```bash
rg -n -i "eleven|elevenlabs|seed.?audio|flux|fal-ai|fal\.ai|wavespeed|pika|bytedance|blackforest" packages/codex/src/dialogue-direction packages/codex/src/image-edit packages/codex/src/panel-sessions packages/codex/src/native-request-controls packages/codex/src/server.ts packages/codex/src/server.test.ts packages/studio/src/features/codex-dialogue-direction packages/studio/src/features/codex-image-edit packages/studio/src/features/codex-panels packages/studio/src/app packages/studio/codex-apps packages/studio/vite.codex.config.ts packages/cli/src/commands/studio
```

The generation review tests (`packages/codex/src/generation-review*.test.ts`)
are deliberately excluded. Their runtime code is already model-neutral; their
realistic route ids are test data outside this plan's scope.

Architecture-shape review:

- inspect `git diff --stat` in both repositories, and the complete diff;
- inspect every new or heavily modified file against the Stop Conditions line
  budgets;
- confirm that `dialogue-direction/index.ts` and `image-edit/index.ts` remain
  thin, and that `native-request-controls/` has no `index.ts`;
- confirm no new dispatcher keyed by anything other than layout, binding kind,
  emphasis or control kind;
- confirm no formatting churn in untouched code;
- confirm Core shows no diff.

Native Codex Desktop verification against Urban Basilica, after a fresh
`renku studio mcp` build. The paid runs need the user's approval.

- **Eleven v4, one line:**
  - open the panel and edit a script;
  - Generate, then confirm that autoplay works and that the Take is selected
    in Studio;
  - use Edit from Take on an earlier Eleven v4 Take.
- **Eleven v4, a range:** stability and similarity controls appear, and the
  2000-character counter shows.
- **Seed Audio on Fal.ai:** `@Audio` mention chips insert into the prompt,
  and one Generate succeeds.
- **FLUX 3 edit:**
  - the chooser hands off to the panel;
  - Edit and Remove regions and the five-option Output resolution control
    appear;
  - one Generate creates a new selected version.
- **Nano Banana 2.1 Edit on Fal.ai:** the panel shows no region canvas, shows
  the style reference picker and the resolution control, and one Generate
  creates a new selected version.
- **GPT Image 2.5 Flare Edit on Fal.ai:** the quality control appears, and one
  Generate with a style reference creates a new selected version. Sunburst:
  the panel opens with the same sections (no paid run).
- **Seedream 5.0 Pro Edit on Fal.ai:** the panel shows no Output section, and
  one Generate creates a new selected version. WaveSpeed and Pika: the panel
  opens (no paid run).
- **Approval messages:** they read correctly in the conversation for each
  panel.

## Completion Checklist

### Review Area

- [ ] Confirm decisions 1–4 in Review Attention were approved before
      implementation.
- [ ] Confirm nothing from "Deliberately not in this plan" was built.
- [ ] Confirm no provider or model knowledge remains in the Codex panel
      modules, the Studio Codex panels, the app entries, the HTML files or
      the CLI Codex wiring (the scan in Final Verification).
- [ ] Confirm Core has no diff, and Engines changed only in the ElevenLabs
      operations, their schemas and tests.
- [ ] Confirm the final module and file shape matches the Architecture Shape
      Gate layout.
- [ ] Confirm no per-model or disguised-model discriminator was introduced.
- [ ] Confirm no new broad dispatcher, catch-all helper or god file.

### Architecture And Contracts

- [ ] `dialogue.direction.open` and `image.edit.open` are the only panel
      opening tools. The old names are deleted with no aliases.
- [ ] `ui://renku/dialogue-direction` and `ui://renku/image-edit` are the only
      panel UI resources, besides the unchanged target chooser.
- [ ] `CodexServerOptions` uses purpose-named HTML options, and the CLI
      resolves exactly the four packaged files.
- [ ] The `./native-request-controls` export is type-only, and the
      generation review wire format is unchanged.
- [ ] The Dialogue Direction and Image Edit contracts match the Contracts
      section exactly. The deleted types are gone.
- [ ] The consume result envelopes are unchanged and carry the route-neutral
      drafts, with no derived convenience fields.
- [ ] Every validation failure uses the existing structured codes and
      collects every issue.
- [ ] Direction text, instructions and mentions are never validated or
      interpreted. Highlighting is presentation-only.

### Engines: ElevenLabs Schemas

- [ ] The ranges are verified against the ElevenLabs reference and the pinned
      SDK types. The sources are noted in the schema files.
- [ ] `speech-schema.ts` and `dialogue-schema.ts` are added and declared as
      `inputSchema`.
- [ ] Both operations validate through the shared JSON Schema validator.
- [ ] The hand-written dialogue field checks are deleted, and the
      distinct-voice limit is kept.
- [ ] `renku generation schema show` returns both schemas.
- [ ] The Urban Basilica request shapes still validate.

### Shared Native Request Controls

- [ ] The control contract, schema, validation and JSON Pointer helpers live
      in `native-request-controls/`.
- [ ] Generation review callers import from the owner files, with no
      re-export stubs.
- [ ] `panelControlIssues` enforces the panel presentation profile.
- [ ] `PanelNativeControls` renders by control shape using only `src/ui`
      controls.
- [ ] `initialNativeRequestValues` is used by both panels.

### Dialogue Direction Runtime

- [ ] `contracts.ts` and `schemas.ts` are rewritten, and the per-model types
      are deleted.
- [ ] `route-validation.ts` covers every Route Description rule.
- [ ] `opening-validation.ts` covers the Core-context and initial Direction
      Script rules.
- [ ] `draft-validation.ts` covers layout granularity, coverage, voices,
      `maxVoices` and control values.
- [ ] `take-directions.ts` reads only through the declared Script Locations.
- [ ] `actions.ts` has no validator table. Consume picks the operation model
      from the draft's range.
- [ ] `eleven-v4/` and `seed-audio/` are deleted.

### Dialogue Direction Studio Panel

- [ ] `dialogue-direction-panel.tsx` picks the desk by `route.scriptLayout`.
- [ ] `LineScriptsDesk` preserves the approved single-line and multi-line
      Eleven layouts.
- [ ] `RangePromptDesk` preserves the approved Seed layout.
- [ ] `SpeakerVoiceRow` serves both bindings, with badges, mentions and the
      limit notice.
- [ ] Suggested tags insert verbatim, and emphasis is driven by
      `route.emphasis`.
- [ ] Disclosure, approval and voice-limit text come from one template each
      and route labels.
- [ ] Single-line-only routes disable range selection in the rail.
- [ ] Edit from Take works for both layouts when the Take has `scripts`.
- [ ] `eleven-v4/`, `seed-audio/` and `direction-provider-label.ts` are
      deleted.

### Image Edit Runtime

- [ ] `contracts.ts` and `schemas.ts` are rewritten, and the per-model types
      are deleted.
- [ ] `route-validation.ts` and `draft-validation.ts` cover every rule in the
      Contracts section.
- [ ] `region-validation.ts` takes modes from the route, and the envelope
      bounds are unchanged.
- [ ] `actions.ts` has no validator table, and the consume envelope is
      unchanged.
- [ ] `flux-3/` and `draft-context.ts` are deleted.

### Image Edit Studio Panel

- [ ] `image-edit-panel.tsx` keeps the approved FLUX desk sections, hiding
      regions when `regionModes` is null and the style reference picker when
      `styleReference` is false.
- [ ] Region modes, labels and placeholders come from the route.
- [ ] Readiness explains the same rules the runtime enforces.
- [ ] Output settings render through `PanelNativeControls`.
- [ ] `flux-3/` is deleted.

### Packaging And Wiring

- [ ] `dialogue-direction.html`, `image-edit.html` and the two app entries are
      added. The three per-model HTML files and app entries are deleted.
- [ ] `vite.codex.config.ts`, `build:codex` and the Studio package exports are
      updated.
- [ ] `server.ts`, both `index.ts` files and CLI `mcp-command.ts` are updated.

### Skills (studio-skills)

- [ ] The `## Codex panel` format is documented in both panel references.
- [ ] Eleven v4, Seed Audio 1.0 (three providers) and FLUX 3 Image Edit
      blocks are added with their mapping prose.
- [ ] Nano Banana 2.1 Edit and GPT Image 2.5 Flare and Sunburst Edit are in
      the Fal.ai `supported-routes.json`, and `gpt-image-2.5.md` exists.
- [ ] Nano Banana 2.1 Edit, Seedream 5.0 Pro Edit (Fal.ai, WaveSpeed, Pika)
      and GPT Image 2.5 Flare and Sunburst Edit blocks are added, region-free,
      with their mapping prose, after a live-schema recheck.
- [ ] Block `routes` are arrays of provider route entries.
- [ ] Each block lists only the few relevant `controlPointers`, and the
      settings of today's three panels are unchanged.
- [ ] No MiniMax Speech block is added.
- [ ] The panel references, `SKILL.md` and `generation-review-routing.md`
      contain no route tables or model names.
- [ ] The ElevenLabs provider Skill reflects the new schema inspection.
- [ ] `bundled-authoring.md` covers adding blocks, choosing
      `controlPointers` and recording product gaps.
- [ ] The evals and both validation scripts are updated, and `pnpm test`
      passes.

### Tests And Guardrails

- [ ] Codex dialogue direction and image edit tests use only fictional routes
      and cover every case listed.
- [ ] Studio panel and control tests use only fictional routes and cover
      every case listed.
- [ ] The extended Codex architecture test checks every exported contract
      file is type-only, derived from `package.json` exports.
- [ ] No architecture test hard-codes implementation names.

### Documentation

- [ ] ADR 0114 is added.
- [ ] `media-generation.md` is updated, including the line 225 replacement and
      the provider extension rule.
- [ ] `codex-debugging.md` is updated.
- [ ] The `AGENTS.md` top instruction is added.
- [ ] Plans 0226 and 0227 have their supersession status lines only.
- [ ] `adding-a-provider.md` is updated if relevant.

### Final Verification

- [ ] All commands in Final Verification pass in both repositories.
- [ ] The model-knowledge scan prints nothing.
- [ ] `git diff --stat` and the full diff are reviewed, large files checked
      against the line budgets, and there is no formatting churn.
- [ ] Native Codex Desktop verification is complete for Eleven v4 (single
      line and range), Seed Audio on Fal.ai, FLUX 3 edit, Nano Banana 2.1
      Edit, GPT Image 2.5 Flare and Sunburst, and Seedream 5.0 Pro Edit.
- [ ] No checklist item was satisfied by accepting unreviewable code
      structure.
- [ ] `studio` and `studio-skills` are released together.
- [ ] Only then mark this plan implemented.
