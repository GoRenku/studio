# Media Generation

Date: 2026-05-26

Status: current

Role: reference

## Purpose

This reference defines the current persisted media generation and media import
contract.

Decision history:

- `../../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `../../decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `../../decisions/0026-use-thin-structured-cli-command-handlers.md`
- `../../decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
- `../../decisions/0036-use-unsliced-location-sheets.md`
- `../../decisions/0040-use-agent-media-execution-policy-for-external-built-in-image-generation.md`
- `../../decisions/0042-use-purpose-cost-projections-for-generation-estimates.md`
- `../../decisions/0043-use-single-generation-approval-tokens.md`

## Current Purposes

The implemented media generation purposes are:

```text
lookbook.image
lookbook.sheet
cast.character-sheet
cast.profile
cast.voice-sample
location.environment-sheet
location.hero
scene.dialogue-audio
scene.storyboard-sheet
shot.first-frame
shot.last-frame
shot.reference-image
shot.video-prompt-sheet
shot.video-take
```

Target formats:

```text
lookbook:<lookbook-id>
cast:<cast-member-id>
location:<location-id>
scene:<scene-id>
scene:<scene-id> --shot-list <shot-list-id>
scene:<scene-id> --take <take-id>
take:<take-id>
```

Core contract target shapes:

```ts
{
  kind: "lookbook";
  id: string;
}

{
  kind: "castMember";
  id: string;
}

{
  kind: "location";
  id: string;
}

{
  kind: "scene";
  id: string;
}

{
  kind: "sceneShotVideoTake";
  id: string;
  sceneId: string;
  takeId: string;
  shotIds: string[];
}
```

## Generation Commands

Current CLI surface:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation context --purpose lookbook.sheet --target lookbook:<id> --json
renku generation context --purpose cast.character-sheet --target cast:<id> --json
renku generation context --purpose cast.profile --target cast:<id> --json
renku generation context --purpose cast.voice-sample --target cast:<id> --json
renku generation context --purpose location.environment-sheet --target location:<id> --json
renku generation context --purpose location.hero --target location:<id> --json
renku generation context --purpose scene.dialogue-audio --target scene:<scene-id>:dialogue:<dialogue-id> --json
renku generation context --purpose scene.storyboard-sheet --target scene:<id> --shot-list <shot-list-id> --json
renku take create --scene <scene-id> --shot-list <shot-list-id> --shots <shot-id[,shot-id...]> --json
renku generation context --purpose shot.first-frame --target scene:<id> --take <take-id> --json
renku generation context --purpose shot.last-frame --target scene:<id> --take <take-id> --json
renku generation context --purpose shot.reference-image --target scene:<id> --take <take-id> --json
renku generation context --purpose shot.video-prompt-sheet --target scene:<id> --take <take-id> --json
renku generation context --purpose shot.video-prompt-sheet --target take:<take-id> --json
renku take authoring context --take <take-id> --json
renku take authoring context --take <take-id> --selected-shot <shot-id> --json

renku generation model list --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.sheet --target lookbook:<id> --json
renku generation model list --purpose cast.character-sheet --target cast:<id> --json
renku generation model list --purpose cast.profile --target cast:<id> --json
renku generation model list --purpose cast.voice-sample --target cast:<id> --json
renku generation model list --purpose location.environment-sheet --target location:<id> --json
renku generation model list --purpose location.hero --target location:<id> --json
renku generation model list --purpose scene.dialogue-audio --target scene:<scene-id>:dialogue:<dialogue-id> --json
renku generation model list --purpose scene.storyboard-sheet --target scene:<id> --shot-list <shot-list-id> --json
renku generation model list --purpose shot.first-frame --target scene:<id> --take <take-id> --json
renku generation model list --purpose shot.last-frame --target scene:<id> --take <take-id> --json
renku generation model list --purpose shot.reference-image --target scene:<id> --take <take-id> --json
renku generation model list --purpose shot.video-prompt-sheet --target scene:<id> --take <take-id> --json
renku generation model list --purpose shot.video-prompt-sheet --target take:<take-id> --json
renku generation model list --purpose shot.video-take --target scene:<id> --take <take-id> --intent <input-mode-id> --json

renku take authoring validate --file <scene-shot-video-take-authoring-json> --json
renku take authoring apply --file <scene-shot-video-take-authoring-json> --json
renku generation input list --purpose shot.video-take --target scene:<id> --take <take-id> --json
renku generation input list --purpose shot.video-take --target take:<take-id> --json
renku generation input select --purpose shot.video-take --target scene:<id> --take <take-id> --input <input-id> --json
renku generation input clear --purpose shot.video-take --target scene:<id> --take <take-id> --kind <input-kind> --subject-kind <subject-kind> --subject-id <subject-id> --json
renku generation input delete --purpose shot.video-take --target scene:<id> --take <take-id> --input <input-id> --json

renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
renku generation spec update --spec <spec-id> --file <spec-json> --json
renku generation spec show --spec <spec-id> --json

renku generation spec list --purpose lookbook.image --target lookbook:<id> --json
renku generation spec list --purpose lookbook.sheet --target lookbook:<id> --json
renku generation spec list --purpose cast.character-sheet --target cast:<id> --json
renku generation spec list --purpose cast.profile --target cast:<id> --json
renku generation spec list --purpose location.environment-sheet --target location:<id> --json
renku generation spec list --purpose location.hero --target location:<id> --json
renku generation spec list --purpose scene.dialogue-audio --target scene:<scene-id>:dialogue:<dialogue-id> --json
renku generation spec list --purpose scene.storyboard-sheet --target scene:<id> --shot-list <shot-list-id> --json
renku generation spec list --purpose shot.first-frame --target scene:<id> --take <take-id> --json
renku generation spec list --purpose shot.last-frame --target scene:<id> --take <take-id> --json
renku generation spec list --purpose shot.reference-image --target scene:<id> --take <take-id> --json
renku generation spec list --purpose shot.video-prompt-sheet --target scene:<id> --take <take-id> --json
renku generation spec list --purpose shot.video-prompt-sheet --target take:<take-id> --json
renku generation spec list --purpose shot.video-take --target scene:<id> --take <take-id> --json

renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --approve-unpriced-cost --json
renku generation run --spec <spec-id> --simulate --json
```

`renku take create --json` returns a `SceneShotVideoTakeCreateReport`.
Use `overview.take.takeId` as the durable take id for later `--take` commands.
`renku take list --json` returns `SceneShotVideoTakeOverview` entries, while
`renku take show --json` returns the raw `SceneShotVideoTake`.

For final `shot.video-take` work, `take authoring context` is the authoritative
agent read contract. It returns the editable authoring document, production
plan, reference sections, preflight readiness, estimate, structured diagnostics,
and provider payload preview. Agents validate and apply a full
`sceneShotVideoTakeAuthoring` document rather than patching take state directly.
The authoring document is a complete proposal for the take-owned authoring
fields. Validation returns `prior` for the persisted baseline and `current` for
the proposed state. Apply returns `prior` for the pre-write state and `current`
for the applied post-write state, plus top-level `project` and `resourceKeys`
metadata for Studio refresh events. These reports are for comparison only; core
does not merge stale agent proposals with newer Studio edits.

Final `shot.video-take` spec creation and generation read the persisted take
state, not a remembered apply response. This lets the user make final Studio
edits after an agent applies a proposal. Agents must re-read authoring context
immediately before paid generation and revise prompts when final persisted
model, input mode, route parameters, selected references, composition, or motion
no longer match the prompt assumptions.

Core never synthesizes generic shot-video dependency prompts. First-frame,
last-frame, ad hoc reference-image, and video prompt sheet dependency
lines use `missing-input` before the user or agent authors concrete
`agentProposal.dependencyDrafts[]` entries. Shot input specs and dependency
drafts must set `referenceMode`. The default is `movie-lookbook`, which uses
the selected Movie Lookbook sheet as the primary style reference and selected
Location Sheets and Character Sheets as continuity references. The explicit
`storyboard-lookbook` mode is opt-in only when the user asks for storyboard,
hand-drawn, sketch, animatic, or Storyboard Lookbook aesthetics for that shot
input image. Missing-input lines are not runnable generation specs, but they
can still be priced when the purpose, model, and route pricing facts are known.
`shot.reference-image` specs also require a title that names the reference
intent shown in Studio.

## Cost Estimates

Generation estimates are cost projections, not readiness checks.

Every media generation purpose is covered by the cost purpose registry under
`packages/core/src/server/media-generation/cost`. The projection converts the
purpose spec into a `GenerationPriceKey` and `GenerationPricingInputs`, then
calls the engine `estimateGenerationCost` API. The cost rail must not prepare
provider payloads, resolve project files, validate selected dependency
readiness, or inspect prompt or artifact contents. Persisted-spec estimate
commands live in lifecycle services: lifecycle reads the spec record, then
delegates the in-memory cost projection to `media-generation/cost`.

Estimate responses return:

```ts
{
  spec: MediaGenerationSpecRecord;
  estimate: GenerationCostEstimate;
}
```

For priced estimates, pass `estimate.costApprovalToken` to
`renku generation run --approval-token` for the same persisted spec. The token
approves one live generation run using the current pricing facts for that spec.
It is not a provider request hash.

Dependency plans may include cost estimates for every generated dependency line
and an aggregate workflow total. Those dependency line estimates are planning
data only. They do not include approval tokens, cannot be submitted as an
approval bundle, and do not permit automatic dependency generation.

Live generation approval is a typed core contract:

```ts
type MediaGenerationRunCostApprovalInput =
  | { kind: 'none' }
  | { kind: 'priced'; approvalToken: string }
  | { kind: 'unpriced-explicit-approval' };
```

Core accepts simulated runs without approval. Live priced runs require the
current priced token from the estimate. Live unpriced runs require explicit
unpriced approval, exposed in the CLI as `--approve-unpriced-cost`. Missing
pricing inputs fail before provider execution even when unpriced approval is
present. Purpose runners must not synthesize approval tokens from their current
estimate; the token is comparison data unless it came from the caller.

The approval check is for the exact generation spec being run. It does not walk
dependency plans, validate dependency readiness, or approve child dependency
generations. The accepted decision is
`../../decisions/0043-use-single-generation-approval-tokens.md`.

Cost states:

- `priced`: the model route has enough pricing facts for a dollar estimate.
- `missing-pricing-input`: the selected model route needs a pricing fact such
  as duration, resolution, aspect ratio, or character count.
- `unpriced`: no pricing is configured for the selected provider/model/route or
  no pricing row matches the provided pricing facts.

Dependency inventories and shot production plans may display cost lines, but
they are not the source of pricing truth. Readiness can be blocked while cost is
priced; for example, an unauthored first-frame dependency can show
`generationDraft.state: "missing-input"` and `pricing.state: "priced"`.

`shot.video-prompt-sheet` is a take-owned AI-video planning sheet for an
existing Shot Video Take. It is grounded in `renku take authoring context`, but
the generated sheet image is opaque to Studio. Core validates the generation
envelope and the selected logical references; it does not validate panel count,
panel numbers, panel ids, captions, annotation keys, source-shot coverage, or
visual conformity to prompt-sheet metadata.

Prompt-sheet specs default to `modelChoice: "fal-ai/openai/gpt-image-2"` and
must include two orthogonal metadata fields:

- `promptSheetVisualStyleId`: `cinematic-realistic` or
  `handdrawn-storyboard`;
- `promptSheetNotationModeId`: `none` or `motion-annotation`.

Motion annotation is a notation mode, not a visual style. It can combine with
either cinematic-realistic or hand-drawn prompt sheets. Agents may still write
prompts that ask for panels, arrows, timing maps, captions, diagrams, or any
other sheet strategy, but those choices remain agent/user-owned prompt content
instead of Studio runtime schema.

Agents must show a Generation Preview Dialog before generating
`shot.video-prompt-sheet` images and before final `shot.video-take` runs:

```bash
renku generation preview show --file <generation-preview-json> --json
```

The preview snapshot is validated by Core and delivered only to a running Studio
server. It is live UI coordination, not durable generation history; if Studio is
closed, the command fails instead of creating an offline backlog. References in
the preview must be logical project references (`assetId`, `assetFileId`, role,
provider token), never local absolute paths or provider upload URLs. Subsequent
feedback should revise the same `previewId` so the open dialog updates in
place.

When an agent authors `shot.video-prompt-sheet` as a dependency draft for a
Shot Video Take, the runnable draft spec must carry through both
`promptSheetVisualStyleId` and `promptSheetNotationModeId`. Missing dependency
draft placeholders remain non-runnable; they may be costed, but they must not
invent prompt-sheet metadata just to satisfy prepare/generate readiness.

Image-generation context and model-list reports include `agentMedia`. The
report exposes the configured image-generation default execution path and, for
image purposes that an agent can create outside Renku, the external built-in
capability `codex.gpt-image-2`. That external capability is not a Renku-managed
provider model: it has no engines estimate, no engines execution path, and no
Renku generation receipt. Agents use it only when policy and harness capability
allow, then import the resulting file through the media import contract.

The Studio shot References tab displays imported/generated `first-frame`,
`last-frame`, `reference-image`, and `video-prompt-sheet` inputs that
belong to the selected shot-video take.

The Studio shot Dialogs tab displays scene dialogue audio references for the
selected shot-video take. Dialogue audio reference dependencies
use dependency kind `reference-audio` and subject kind `scene-dialogue`. Their
dependency ids are stable by screenplay dialogue id, while preflight and final
generation resolve the shot-video direction's selected dialogue audio take to
the concrete audio asset file.

Shot Video Takes persist an explicit structure mode in
`SceneShotVideoTakeState.version: 2`. In `continuous` mode, grouped shot ids are
ordered beats or keyframes in one unbroken generated move, and Composition,
Motion, Dialogs, and References are stored in one `sharedDirection`. In
`multi-cut` mode, the grouped shot ids are separate cuts, and each shot id owns
one `SceneShotVideoTakeDirection` in `directionsByShotId`. Reference selections
are nested inside the direction whose scope they affect. AI Production settings
remain take-level in both modes, so model choice, input mode, route parameters,
prompt drafts, provider payload preview, estimate, approval, and prepared inputs
continue to apply to the whole generated take.

Dialogue audio pricing is based on the selected model and dialogue text.
Missing Cast Voice setup is reported as `missing-input` with the reason
`Assign a Cast Voice before generating dialogue audio.`, while the dependency
can remain priced. The production plan also reports the selected route's audio
reference capability and warns when selected dialogue audio is unsupported or
over the route limit. These warnings do not mutate selections.

The CLI command names are generic, and the spec lifecycle now routes through
the core shared generation service. The shared service resolves the purpose
definition from the media generation purpose registry, then runs the common
validate, dependency-plan, create, update, read, list, prepare, estimate, run,
and run-recording operations.

Purpose definitions keep purpose-specific behavior such as context building,
model options, provider payloads, output names, dependency declarations, draft
dependency specs, and media import behavior.

## Dependency Inventories And Estimates

`planMediaGenerationDependencies` is the shared read-only dependency inventory
path. It accepts a root generation spec, validates it through the purpose
registry, asks the root purpose for dependency slots, resolves existing assets,
plans missing generated dependencies, estimates every generated dependency
through engines pricing, estimates the root generation, and returns:

- `dependencyInventory.dependencies`;
- `dependencyInventory.rootGeneration`;
- `dependencyInventory.estimate`;
- `dependencyInventory.agentChecklist`;
- `lines`;
- `diagnostics`.

Dependencies are an inventory, checklist, and estimate contract. They are not
an automatic execution graph, and no dependency line is run automatically.

Dependency declarations may share ids only when they describe the same
dependency kind, target, selector, and user-visible label. The planner merges
the `requiredBy` reasons for identical duplicate declarations and rejects
conflicting duplicates with a structured dependency diagnostic. This keeps
purpose-owned slot declarations reviewable and prevents two different assets or
draft specs from silently occupying the same inventory line.

Dependency ids are owned by core. Shared dependency id helpers construct cast
character sheet, location environment sheet, Lookbook sheet, and shot-video
input ids. Shot-video ids include the input kind, subject id, subject kind, and
take when that ownership is part of the selected target. Studio
surfaces consume core-provided fields for mutations and must not parse
dependency id strings to infer behavior.

Scene dialogue audio shot-video ids intentionally use the dialogue id rather
than a take id or asset file id. This lets a user keep a dialogue reference
selected while changing the shot-video direction's selected dialogue audio take;
the final generation request snapshots the resolved asset file selected at
request creation time.

Selectors must name their selection policy:

- `selected-only`: use the exact selected asset or sheet; if it is absent, the
  dependency remains missing or invalid.
- `selected-or-default`: use the exact selected asset or sheet when present;
  otherwise use the purpose-owned default only when the selector has explicitly
  opted into that behavior.

Selector failures are structured diagnostics. Unknown selector kinds, malformed
shot-video selector requests, invalid purpose requests, invalid Lookbook sheet
ids, missing selected files, unavailable or stale selected sheet assets, and
missing primary image files must not be converted into quiet missing
dependencies.

Generated dependency prices come only from engines estimates. Existing assets
are represented as satisfied dependency lines priced at `$0.00`. Manual
attachments are not generation work and use `not-applicable` pricing.
Unselected product alternatives may also display quiet `not-applicable` card
pricing because they are not selected dependency work. Selected generated
dependencies never use `not-applicable`; they are either priced, explicitly
unpriced because a valid provider route lacks pricing metadata, or invalid with
structured diagnostics.

Draft dependency specs must declare their materialization state. A generated
dependency that can be created by the shared generation service uses
`generatable`. A dependency that needs user or agent setup before it can be run
uses `missing-input` with an actionable reason. Missing materialization state,
invalid draft specs, unsupported pricing routes, and root-estimate failures are
reported through dependency diagnostics instead of being hidden behind empty
diagnostic lists.

Estimate states:

- `complete`: the root generation and every generated dependency line are
  priced, with no required manual or invalid dependency blocking the total;
- `partial`: at least one generated dependency or root line is unpriced and
  requires explicit
  unpriced-cost approval;
- `unavailable`: at least one required manual dependency, invalid selected
  asset, invalid target, or invalid selector result prevents a trustworthy
  total.

The total for a complete plan is the sum of dependency inventory pricing,
including the root generation and generated dependencies. Studio must render
this value from the core report and must not calculate a separate total.

Root spec creation and update call the shared dependency planner when the root
purpose declares dependencies. They fail with
`CORE_MEDIA_DEPENDENCY_UNRESOLVED_REQUIRED_DEPENDENCIES` while any required
dependency is still a planned generation or external attachment. Generate or
import dependencies first, refresh the inventory, then create the root spec.

The first shared non-shot proof is `cast.profile`. It declares a
`cast-character-sheet:<castMemberId>` dependency, reuses an imported character
sheet at `$0.00`, plans a missing `cast.character-sheet` dependency when no
sheet exists, and includes that dependency in the profile inventory estimate.

## Lookbook Image Context

`generation context` returns factual project context. It does not choose a
model or infer provider parameters.

The context includes:

- purpose and target;
- project name, title, and aspect ratio;
- the Lookbook type and type-specific sections;
- source Inspiration folders;
- existing Lookbook images;
- images by Lookbook section;
- card image;
- defaults for take count, seed, image frame, detail, and output format;
- Studio resource keys.

It does not return generic model requirements, prompt instructions, provider
capability summaries, or an import contract.

## Cast Character Sheet Context

`cast.character-sheet` context is built for one cast member and requires a
selected Movie Lookbook. The context includes:

- project title, summary, aspect ratio, and languages;
- screenplay summary and major story signals when a screenplay exists;
- cast member facts such as handle, role, want, need, arc, voice notes, and
  description;
- active Cast Design summary when one is selected, including interpretation,
  appearance, costume, voice casting, continuity, and generation-guidance
  signals suitable for prompt authoring;
- time-period signals from screenplay history, cast-referenced scene settings,
  and referenced locations;
- the selected Movie Lookbook and its card image;
- selected cast assets and existing character sheet/profile takes;
- image file references for attached cast assets;
- defaults for take count, seed, image frame, detail, and output format.

Character sheet generation should create a full reusable design reference for
the character. It should account for the story, the character, the period, and
the selected movie visual language. The best current model choices are:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`

## Cast Profile Context

`cast.profile` context is built for one cast member. It can run text-to-image
without a source sheet, but edit models require `sourceAssetId`.

The profile context includes the same project, screenplay, cast member, active
Cast Design, time-period, Lookbook, and asset signals as character sheets. It
also returns:

- selected character sheets;
- character sheet takes;
- profile takes;
- `recommendedSourceAssetId`, which is the selected character sheet when one is
  available;
- a square `1:1` default image frame.

## Cast Voice Sample Context

`cast.voice-sample` context is built for one cast member. It generates an audio
sample for a Cast Voice, but it does not attach that voice to the Cast Member.
The durable mutation is a separate `renku cast voice attach` command using a
`kind: "castVoiceAttachment"` document.

The Cast Voice sample context includes:

- project title, summary, aspect ratio, and languages;
- screenplay summary and major story signals when a screenplay exists;
- cast member facts and active Cast Design voice-casting guidance;
- existing Cast Voices and their playable sample assets;
- existing cast audio assets with role `voice_sample`;
- defaults for direct ElevenLabs model choice, output format, and language code.

The only model choices for this purpose are direct ElevenLabs TTS models:

- `elevenlabs/eleven_v3`
- `elevenlabs/eleven_multilingual_v2`
- `elevenlabs/eleven_turbo_v2_5`

Do not use fal.ai or Wavespeed ElevenLabs wrapper models for Cast Voice
samples. Dialogue-audio generation reads the Cast Voice's ElevenLabs provider
registration with capability `dialogue-audio-tts`, maps its external provider
voice id to ElevenLabs `voice`, maps `voiceSettings.similarityBoost` to
`voice_settings.similarity_boost`, and maps `languageCode` to `language_code`.

Kling native-audio video voice control is not modeled as a durable Cast Voice
provider registration. When a shot-video spec selects generated dialogue audio
for a supported Kling route, Renku sends that audio to
`fal-ai/kling-video/create-voice` as an internal preparation step, injects the
returned transient `voice_id` into the in-memory final payload for a
video-backed Kling element, and records only the final video generation run.
Renku may reuse a matching transient `voice_id` from
`.renku/cache/kling-transient-voice-ids.json` for 24 hours when the selected
dialogue audio content fingerprint matches. This cache is an internal provider
artifact cache, not a reusable Cast Voice provider handle.

Seedance 2.0 reference-video audio is also not a durable voice registration.
Its `audio_urls` inputs are per-generation reference media for voice/style
conditioning. When selected dialogue audio exists, it is the normal reference
audio input for Seedance. Exact dialogue timing or waveform preservation belongs
in lipsync, talking-head, or composition workflows instead.

Profile images should usually be generated after a character sheet exists. When
using an edit model, the generated request carries a logical `image_urls` file
input. The engine resolves that project-relative source file immediately before
provider execution.

## Location Sheet Context

`location.environment-sheet` context is built for one Location and requires a
selected Movie Lookbook. The target Location must already exist in project
facts. When a requested historical location is missing, core returns a
structured error with a suggestion to add the Location first instead of
generating against free text.

The context includes:

- project title, summary, aspect ratio, and languages;
- screenplay overview, dramatic signals, historical basis, dramatized elements,
  research sources, and assumptions when available;
- target location name, handle, description, time period, and visual notes;
- active Location Design summary when one is selected, including spatial
  thesis, architecture, set dressing, materials, atmosphere, props, continuity,
  environment-sheet guidance, and generation-guidance signals suitable for
  prompt authoring;
- scene usage and compact setting/action signals for scenes that use the
  location;
- the selected Movie Lookbook and its card image when available;
- selected location assets, existing Location Sheet takes, reference assets,
  anti-reference assets, and image file references;
- fixed defaults for the generated sheet frame, detail, and output format.

Core returns factual context only. Prompt guardrails are written by the
media-producer skill from those facts. Historical prompts should include
concrete exclusions when the context calls for them, such as avoiding telegraph
poles, electrical wires, asphalt roads, or modern signage in a 1400s setting.

The generated provider image is one full Location Sheet. It is imported as one
image asset with one `primary` file. Core does not slice Location Sheets into
fixed views, store azimuth metadata, or infer shot references from the first
available sheet.

## Scene Storyboard Sheet Context

`scene.storyboard-sheet` context is built for one screenplay scene and one
Scene Shot List. The target scene must exist, the shot list must belong to
that scene, and a Storyboard Lookbook must be selected.

The context includes:

- project title, summary, and default aspect ratio;
- screenplay scene hierarchy, setting, story function, and ordered scene
  blocks;
- the selected Scene Shot List and its ordered shots;
- referenced cast and locations for the scene and shot list;
- active Cast Design summaries for referenced Cast Members;
- active Location Design summaries for referenced Locations;
- the selected Storyboard Lookbook definition;
- the selected Storyboard Lookbook sheet when one has been imported or
  generated;
- selected Movie Lookbook text guidance when available;
- defaults for visualization style, take count, seed, image frame, detail, and
  output format.

The selected Storyboard Lookbook sheet is a required `lookbook-sheet`
dependency. Dependency planning creates a `lookbook.sheet` draft when the
selected Storyboard Lookbook has no sheet. Final Scene storyboard sheet spec
creation is blocked until that dependency is imported or generated. Prepared
provider requests use the selected Storyboard Lookbook sheet as an image
reference when it exists. This Storyboard Lookbook default is specific to
`scene.storyboard-sheet`; shot input images default to the selected Movie
Lookbook unless their spec explicitly uses `referenceMode: "storyboard-lookbook"`.

The generated provider image is one temporary composite storyboard sheet for
one to four selected shots, not one provider call per shot. The media-producer
skill owns the grid generation spec, visual inspection, slicing, and per-shot
import mapping after scene-shot-designer has supplied a valid Scene Shot List.
Core does not store crop boxes, grid cells, extraction confidence, extraction
methods, or slicing diagnostics.

## Lookbook Image Spec

The generation spec is persisted before estimate or execution.

```json
{
  "purpose": "lookbook.image",
  "target": { "kind": "lookbook", "id": "lookbook_abc" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A horror hallway showing the Lookbook palette under dread lighting.",
  "focusSections": ["palette", "lighting"],
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Horror palette hallway"
}
```

Binding fields:

- `modelChoice`
- `takeCount`
- `seed`
- `imageFrame`
- `detail`
- `outputFormat`

Agents must not override these fields after the user selects them.

Supported model choices:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`
- `fal-ai/bytedance/seedream/v5/lite/text-to-image`

Supported image frames:

- `project`
- `1:1`
- `3:4`
- `4:3`
- `16:9`
- `9:16`
- `21:9`

Supported details:

- `draft`
- `standard`
- `high`

Supported output formats:

- `png`
- `jpeg`
- `webp`

Model-specific validation may reject a supported product option when the chosen
model cannot execute it. For example, some models reject `21:9` or seeds.

## Cast Character Sheet Spec

```json
{
  "purpose": "cast.character-sheet",
  "target": { "kind": "castMember", "id": "cast_ada" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A full character sheet for Ada, a determined investigator in late 1970s New York...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Ada character sheet"
}
```

## Cast Profile Spec

Text-to-image profile spec:

```json
{
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_ada" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A square profile portrait of Ada...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "1:1",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Ada profile"
}
```

Edit profile spec:

```json
{
  "purpose": "cast.profile",
  "target": { "kind": "castMember", "id": "cast_ada" },
  "modelChoice": "fal-ai/nano-banana-2/edit",
  "sourceAssetId": "asset_character_sheet",
  "prompt": "Create a square profile portrait derived from the attached character sheet...",
  "takeCount": 1,
  "seed": null,
  "imageFrame": "1:1",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Ada profile from sheet"
}
```

Profile text-to-image models must not include `sourceAssetId`. Profile edit
models must include `sourceAssetId`, and that asset must be an image attached to
the cast member with the `character_sheet` role.

## Location Sheet Spec

```json
{
  "purpose": "location.environment-sheet",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A full-image Location Sheet for the Constantinople sea walls...",
  "description": "Sea-wall material, gate, tower, field, and city-edge reference for shot planning.",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Constantinople sea walls Location Sheet"
}
```

Binding fields:

- `modelChoice`
- `seed`
- `sheetFrame`
- `detail`
- `outputFormat`
- `prompt`
- `description`
- `title`

`takeCount` is always `1` for this purpose.

Supported model choices:

- `fal-ai/openai/gpt-image-2`
- `fal-ai/nano-banana-2`
- `fal-ai/xai/grok-imagine-image`

Supported sheet frames:

- `4:3`

Location Sheets are direct text-to-image reference boards. Core does not create
or send a visual template, mask, fiducial markers, labeled cells, bottom
guideline strip, or fixed azimuth layout. The prompt should ask for the
Location-specific reference board the production needs.

## Location Hero Image Spec

```json
{
  "purpose": "location.hero",
  "target": { "kind": "location", "id": "location_sea_walls" },
  "sourceLocationSheetAssetId": "asset_sea_walls_sheet",
  "modelChoice": "fal-ai/nano-banana-2/edit",
  "prompt": "Create a wide representative hero image for the sea walls from the supplied Location Sheet...",
  "description": "Wide visual identity image grounded in the sea-wall Location Sheet.",
  "takeCount": 1,
  "seed": null,
  "heroFrame": "16:9",
  "outputFormat": "png",
  "title": "Constantinople sea walls hero"
}
```

Location Hero Images are generated from an explicit source Location Sheet asset
owned by the same Location. The source sheet must have a `primary` image file.
Hero images are display media for overview and detail surfaces; they never act
as hidden shot-generation defaults.

## Scene Storyboard Sheet Spec

```json
{
  "purpose": "scene.storyboard-sheet",
  "target": { "kind": "scene", "id": "scene_control_room" },
  "shotListId": "scene_shot_list_control_room_v1",
  "shotIds": ["shot_001", "shot_002", "shot_003", "shot_004"],
  "modelChoice": "fal-ai/nano-banana-2",
  "prompt": "A complete charcoal pencil storyboard sheet laid out as a clean grid...",
  "takeCount": 1,
  "seed": null,
  "sheetFrame": "4:3",
  "shotFrame": "project",
  "detail": "standard",
  "outputFormat": "png",
  "title": "Control room storyboard sheet"
}
```

Binding fields:

- `modelChoice`
- `shotListId`
- `shotIds`
- `takeCount`
- `seed`
- `sheetFrame`
- `shotFrame`
- `detail`
- `outputFormat`

`takeCount` is fixed to `1` for this purpose. `sheetFrame` is fixed to `4:3`.
`shotIds` selects one to four shots for the sheet, and `shotFrame` controls the
panel frame inside the sheet.

## Estimate And Run

Estimate and run both use the persisted spec.

The command sequence is:

1. Read the persisted spec.
2. Build current purpose context.
3. Validate the spec against that context.
4. Build the final provider payload.
5. Validate the provider payload against the model JSON Schema.
6. Estimate cost through engines.
7. Return the estimated cost and approval token for the exact request.
8. Require the approval token for live execution.

No live provider call should happen when the estimate is unknown or unapproved.
The approval token is bound to the exact generation policy and request. If the
model, prompt, parameters, bound input files, or output count change, callers
must estimate again before running.

User-facing approval should be calm and singular, such as "Generate image -
estimated $0.054" with provider details available nearby. Do not require a
second content-disclosure confirmation after the user has approved the cost.

Generation runs store:

- spec snapshot;
- provider and model;
- provider payload;
- estimate snapshot;
- approval token;
- simulation flag;
- status;
- outputs;
- diagnostics;
- start and completion timestamps.

For `location.environment-sheet`, run outputs contain the single provider image.
For `location.hero`, run outputs contain the single hero image derived from the
source Location Sheet. Generation does not import assets automatically.

## Persistence

Generation specs and runs use two common tables:

```text
media_generation_spec
media_generation_run
```

`media_generation_spec.spec_json` stores editable user choices.

`media_generation_run.spec_snapshot_json` and
`media_generation_run.provider_payload_json` make each run understandable later,
even after the spec is edited.

`media_generation_run.outputs_json` stores output paths, returned seeds,
revised prompts, imported asset ids, and per-take metadata for now. Do not add a
separate output table until a concrete UI or query needs it.

Location Sheet and Location Hero Image imports use ordinary asset rows, asset
file rows, and Location asset relationships. There are no purpose-specific
Location Sheet grouping tables.

## Media Import

Import is separate from generation.

```bash
renku media import \
  --purpose lookbook.image \
  --target lookbook:<lookbook-id> \
  --source <project-relative-path> \
  --sections palette,lighting \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

For Lookbook Images, import registers an asset, creates the Lookbook image
relationship, stores section placement, and emits Lookbook resource keys.
The `--sections` values must match the owning Lookbook type.
For Movie Lookbook images, `--sections thesis` places an image under The Thesis.
To also pin that same image beside a specific point, include the point-owning
section and `--anchor`, for example `--sections thesis,texture --anchor
texture-cannon-material-states`.
The Thesis placement is single-image: importing a new image with `--sections
thesis` replaces the previous Thesis placement without discarding that previous
image or removing its other placements. Other Movie section and point placements
append images until the placement slot has 10 images.

For Lookbook Sheets, import registers an asset with type `lookbook_sheet`,
attaches it to the Lookbook, and stores the file under
`visual-language/lookbook/`.

For Cast Character Sheets, import registers an image asset with type
`character_sheet`, attaches it to the cast member with role `character_sheet`,
stores the file under `cast/<handle>/character-sheets/`, and requires
relationship-scoped `--reference-name` and `--reference-purpose`.

For Cast Profiles, import registers an image asset with type `cast_profile`,
attaches it to the cast member with role `profile`, and stores the file under
`cast/<handle>/profiles/`.

For Location Sheets, import registers one image asset with type
`location_environment_sheet`, attaches it to the location with role
`environment_sheet`, stores the image under
`locations/<handle>/environment-sheets/<sheet-slug>/`, records one `primary`
asset file, and persists the required description as the asset summary.

```bash
renku media import \
  --purpose location.environment-sheet \
  --target location:<location-id> \
  --source generated/media/sea-walls-sheet.png \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

For Location Hero Images, import registers one image asset with type
`location_hero`, attaches it to the location with role `hero`, records one
`primary` asset file, and selects the newest hero image as the current display
image for the Location. Generated hero imports must pass the source sheet:

```bash
renku media import \
  --purpose location.hero \
  --target location:<location-id> \
  --source generated/media/sea-walls-hero.png \
  --source-sheet <location-sheet-asset-id> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

```bash
renku media import \
  --purpose cast.character-sheet \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --reference-name <renku-reference-name> \
  --reference-purpose <purpose> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json

renku media import \
  --purpose cast.profile \
  --target cast:<cast-member-id> \
  --source <project-relative-path> \
  --title <title> \
  --summary <one-line-summary> \
  --receipt <generation-run-json> \
  --json
```

Cast Voice sample generation output is attached with the Cast Voice command,
not `renku media import`:

```bash
renku cast voice attach --file <cast-voice-attachment-json> --json
```

The attachment document names the cast member, reference name, purpose, initial
ElevenLabs registration details, and sample source path. Generated attachments
may include a generation receipt; imported external samples may omit it.
Additional durable provider handles are managed through Cast Voice Provider
Registration commands so one Cast Voice can safely share one playable sample
across ElevenLabs TTS workflows. Kling video voice control uses selected
dialogue audio through transient shot-video preparation instead of a durable
Cast Voice registration.

Single-file imports expect a project-relative source path. Location Environment
Sheet imports expect JSON files whose entries are project-relative paths.
Scene Storyboard Sheet imports expect a JSON file that lists cropped per-shot
image files from the temporary sheet.

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --shot-list <shot-list-id> \
  --file scene-storyboard-images-import.json \
  --json
```

Scene Storyboard Sheet import file:

```json
{
  "kind": "sceneStoryboardImagesImport",
  "shotListId": "scene_shot_list_control_room_v1",
  "title": "Control room storyboard images",
  "shots": [
    {
      "shotId": "shot_001",
      "source": "generated/media/storyboards/control-room-shot-001.png",
      "title": "Shot 1",
      "sourcePurpose": "scene.storyboard-sheet"
    },
    {
      "shotId": "shot_002",
      "source": "generated/media/storyboards/control-room-shot-002.png"
    }
  ]
}
```

For Scene Storyboard Sheets, import registers one `scene_storyboard_image` asset
per shot, attaches each image to the Scene with role `storyboard_image`, stores
the files under `screenplay/storyboards/<scene-label>/<import-title>/`, and
writes direct `scene_shot_storyboard_image` rows keyed by `scene_id`,
`shot_list_id`, and `shot_id`. The temporary composite sheet is not imported as
an asset.

Shot video take input imports accept either the scene plus `--take` target
shape or the take shorthand. The shorthand resolves the take through core and
fills the owning scene id before import.

```bash
renku media import \
  --purpose shot.video-prompt-sheet \
  --target take:<take-id> \
  --source generated/media/take-video-prompt-sheet.png \
  --title <group-sheet-title> \
  --selection select \
  --json
```

When the source image was created outside Renku, stage it under the project
`generated/media/` directory first, then import that project-relative path
without a receipt. Core import remains the only attachment path.

`--replace-selected` is available for shot-video take input imports. It imports
and selects the new prepared input, then discards the previously selected input
in the same slot in the same core mutation. Use it when the user is correcting
an existing selected first frame, last frame, reference image, or video prompt
sheet, not when preserving alternatives for review.

After a tool writes no project mutation but Studio still needs to redraw known
resources, use a focused refresh notification:

```bash
renku studio notify-refresh \
  --project <project-name> \
  --resource scene-shot-video-take:<take-id> \
  --json
```

For generated Lookbook images, agents must inspect the generated image before
import and choose section tags based on what the image visibly demonstrates.
`focusSections` is generation intent, not placement truth.

## Adding Purpose Rule

When adding the next purpose, add a concrete core purpose definition and wire it
through the shared media-generation purpose registry. Keep purpose-specific
behavior in the owning core module, and keep CLI code to command parsing,
target parsing, output, and structured diagnostics.

Do not add model capability YAML, schema overlays, or inferred model support.
Provider model JSON Schemas validate final payloads only.
