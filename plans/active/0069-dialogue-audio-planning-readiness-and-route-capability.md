# 0069 - Dialogue Audio Planning Readiness And Route Capability

Status: active plan
Date: 2026-06-13
Owner: Renku Studio

## Purpose

Repair the shot-video dialogue audio planning path introduced by
`0068-shot-dialogue-audio-references-tab.md` so it communicates the right facts
to users and AI agents without mixing separate concepts.

The core product rule is:

- planning is advisory and read-only;
- pricing estimates should remain available whenever the data needed for
  pricing is known;
- generation readiness is separate from pricing;
- model route capability warnings should be visible in Studio and in the JSON
  plan;
- execution boundaries still fail fast before an invalid provider payload can
  be persisted or sent.

This plan focuses on dialogue audio references for shot-video generation, but it
also cleans up the shared dependency draft state names where the current
contract made pricing-only behavior look like runnable generation.

## Relationship To Existing Plans

This plan follows and refines:

- `plans/active/0068-shot-dialogue-audio-references-tab.md`
- `plans/active/0063-generation-dependency-inventory-rewrite.md`
- `plans/active/0042-shot-video-take-generation-plan-architecture.md`

Plan `0068` adds the Dialogs tab and dialogue audio reference dependency path.
This plan fixes the readiness, warning, count, and estimate semantics discovered
during review of that implementation.

It does not introduce automatic dependency generation. The AI agent and user
continue to decide which missing dependencies to generate, import, exclude, or
leave unresolved.

## Product Principles

### Planning Is Advisory

The production plan is not an execution engine. It should not silently generate
missing dependencies, silently remove selected references, or hide prices
because generation is not ready.

The plan should answer:

- Which dependencies exist?
- Which dependencies are selected?
- Which selected dependencies are already materialized?
- Which selected dependencies could be generated if the user and agent choose
  to do so?
- Which selected dependencies are missing an input before they can be generated?
- What would each generated dependency approximately cost?
- Can the currently selected final video route consume the selected inputs?

The plan should return enough structured detail for Studio and the AI agent to
explain the situation. It should not make the decision for them.

### Pricing Is Not Readiness

Dialogue audio pricing is based on known model pricing and known text length.
For the current ElevenLabs dialogue audio models, a missing Cast Voice does not
prevent a useful estimate because all supported dialogue audio models are priced
from text length.

Therefore:

- a dialogue audio dependency with no Cast Voice must still show a priced
  estimate;
- the same dependency must not be marked as generatable;
- the readiness reason should say what input is missing, for example
  `Assign a Cast Voice before generating dialogue audio.`;
- no fake provider voice id should be treated as a real runnable input.

### Route Capability Is Model-Specific

Dialogue audio reference support depends on the selected shot-video route.

Examples:

- Seedance 2.0 reference routes support up to 3 audio references through
  `audio_urls`.
- Other shot-video routes may support no audio references.

The Dialogs tab should make the selected route's audio capability obvious before
the user or agent creates a final generation request.

Planning must keep estimates for dialogue audio dependencies even when the
currently selected final video route cannot consume audio. The warning is about
final video input compatibility, not about whether the dialogue audio itself can
be priced.

## Current Problems

### Missing Voice Uses A Fake Estimate-Only Voice

Current code introduced internal values similar to:

```ts
estimate_only_cast_voice
estimate_only_provider_voice
```

These names are confusing and encode the wrong domain idea. The problem is not
that the voice is "estimate-only." The problem is that generation is missing an
input: a real Cast Voice/provider voice id.

This also creates a contract smell. A draft that contains a fake provider voice
can look like a normal generatable draft even though it should not be runnable.

### Planning Can Miss Route Warnings Before Audio Exists

The current route warning checks prepared audio inputs. That means a route that
does not support audio can fail to warn when dialogue audio is selected but not
generated yet.

Example:

1. A shot references two dialogue lines.
2. Those dialogue lines are default-included in the Dialogs tab.
3. Neither dialogue audio take exists yet.
4. The selected final video route does not support `audio_urls`.
5. Planning still needs to estimate the two missing dialogue audio dependencies.
6. Planning also needs to warn that the selected final video route will not use
   selected audio references.

The warning should be based on selected dialogue audio references, not only on
already prepared audio files.

### Max Audio Count Is A Capability Warning In Planning

Seedance 2.0 reference routes allow up to 3 audio references. The current route
catalog contains that `maxCount`, but the plan and UI do not expose it clearly.

The plan should not silently reject or deselect a fourth selected reference.
Instead, the Dialogs tab and JSON plan should say that the selected count is
over the selected model route's limit.

Final spec creation and provider payload creation must still fail fast if an
invalid final request is attempted.

### Dialogs Tab Can Keep Stale Audio URLs

The Dialogs tab loads scene dialogue audio context on mount and scene change.
If a take is generated or picked through another surface, the production plan
can refresh while the Dialogs tab's local audio context still lacks the current
take URL.

The visible result can be a card that knows about a picked take but cannot play
it until the tab remounts.

## Desired User Experience

### Dialogs Tab Capability Row

At the top of the Dialogs tab, reserve a stable row that describes the selected
final video route's dialogue audio capability.

For Seedance 2.0 reference routes:

```text
Seedance 2.0 allows up to 3 audio references per generation       2 / 3 selected
```

If selected references exceed the route limit:

```text
Seedance 2.0 allows up to 3 audio references per generation       4 / 3 selected
```

The over-limit state should use the existing warning/diagnostic visual language
from Studio. It should not deselect anything by itself.

For routes that do not use audio references:

```text
This model does not use audio references                          2 selected
```

If no references are selected:

```text
This model does not use audio references                          0 selected
```

The row should be visible even when there are no generated dialogue audio takes.
It describes model capability and selection count, not playback readiness.

### Card-Level Readiness

Each dialogue card should continue showing the dialogue audio state:

- ready: one picked take resolves to an audio file;
- not generated: no takes exist yet;
- no picked take: takes exist but none is picked;
- multiple picked takes: data is inconsistent;
- missing file: picked take points to a missing asset file;
- missing input: generation cannot be started because setup is incomplete.

For missing Cast Voice, the visible and agent-readable reason should be:

```text
Assign a Cast Voice before generating dialogue audio.
```

The card should still show the estimated cost if text length and model pricing
are known.

### Agent-Facing Plan

The JSON plan should expose the same facts:

- selected dialogue audio count;
- route support for audio references;
- route max count;
- model-specific warning message;
- dependency pricing estimate;
- dependency generation readiness state and reason.

The AI agent should not have to infer route support from provider schema names,
parse dependency ids, or inspect provider payload code.

## Contract Changes

### Dependency Draft Readiness

Replace the confusing `estimate-only` draft state with a generic
`missing-input` readiness state.

Current public shape:

```ts
export type MediaGenerationDependencyGenerationDraft =
  | { state: 'not-generated' }
  | { state: 'estimate-only'; reason: string }
  | { state: 'authored'; draftGenerationSpec: DraftMediaGenerationSpec }
  | { state: 'blocked'; reason: string };
```

New public shape:

```ts
export type MediaGenerationDependencyGenerationDraft =
  | { state: 'not-generated' }
  | { state: 'missing-input'; reason: string }
  | { state: 'authored'; draftGenerationSpec: DraftMediaGenerationSpec }
  | { state: 'blocked'; reason: string };
```

Meaning:

- `not-generated`: an existing asset selector is satisfied and no draft is
  needed, or this line represents a reusable existing asset.
- `missing-input`: the dependency can be priced, but it cannot be generated
  until the caller supplies an input named by `reason`.
- `authored`: the dependency has a runnable draft generation spec.
- `blocked`: the planner could not produce a coherent draft because of an
  invalid contract, missing required mapping, unsupported model, or other
  structured failure.

For dialogue audio missing a voice:

```ts
generationDraft: {
  state: 'missing-input',
  reason: 'Assign a Cast Voice before generating dialogue audio.'
}
```

The dependency line's `pricing` remains:

```ts
pricing: {
  state: 'priced',
  estimatedUsd: 0.03
}
```

### Dependency Materialization State

Update `MediaGenerationDependencyMaterializationState` so plan lines can carry
the same generic readiness idea:

```ts
export type MediaGenerationDependencyMaterializationState =
  | 'materialized'
  | 'generatable'
  | 'missing-input'
  | 'requires-external-input'
  | 'blocked-by-dependencies'
  | 'invalid-generation-draft';
```

Remove `needs-authored-draft` from current contracts and update callers
directly. Missing authored prompts and missing Cast Voices are both
`missing-input` with different reasons.

Examples:

- `Author a dependency prompt before generating this reference image.`
- `Assign a Cast Voice before generating dialogue audio.`

### Agent Checklist Action

Replace the narrow `author-generation-draft` checklist action with a generic
input action:

```ts
action: 'provide-missing-input'
```

The checklist item already has `reason`, so the action can stay generic while
the reason says what to do.

Examples:

- action: `provide-missing-input`
- reason: `Assign a Cast Voice before generating dialogue audio.`

### Dependency Draft Planning

The shared dependency planner needs to stop requiring every priced generated
dependency to have a runnable draft spec.

Introduce a purpose-owned dependency draft planning result with this shape:

```ts
export type MediaGenerationDependencyDraftPlan =
  | {
      materializationState: 'generatable';
      draftGenerationSpec: DraftMediaGenerationSpec;
    }
  | {
      materializationState: 'missing-input';
      materializationReason: string;
      pricing: MediaGenerationDependencyPricing;
      estimate: import('@gorenku/studio-engines').GenerationEstimate | null;
    };
```

The registry-owned function should be named:

```ts
planMediaGenerationDependencyDraft(...)
```

This replaces the current narrower `buildMediaGenerationDependencyDraftSpec`
contract. Update callers directly; do not add a compatibility wrapper.

For most generated dependencies, the purpose returns `generatable` with a draft
spec, and the shared planner estimates that draft through the existing shared
generation lifecycle.

For scene dialogue audio missing a Cast Voice, the purpose returns
`missing-input` plus a priced estimate computed from model choice and text
length. It does not return a fake runnable spec.

### Dialogue Audio Pricing Without A Voice

Add a purpose-owned pricing helper in
`packages/core/src/server/media-generation/scene-dialogue-audio.ts`:

```ts
estimateSceneDialogueAudioPricingOnly(...)
```

The helper should:

- validate purpose, target, model choice, and text;
- normalize text treatment enough to count priced characters;
- call or share the same engine pricing rules used by normal estimates;
- not require a Cast Voice;
- not produce provider payloads with fake voice ids;
- return structured diagnostics if model pricing cannot be read.

The helper must be used only for planning missing-input dialogue audio lines.
Normal persisted dialogue audio generation must still require a real Cast
Voice and provider voice id.

### Dialogue Audio Route Capability Report

Add a public client contract:

```ts
export interface ShotVideoTakeDialogueAudioCapabilityReport {
  state: 'ok' | 'unsupported' | 'over-limit';
  supported: boolean;
  selectedCount: number;
  maxCount: number | null;
  modelLabel: string;
  message: string;
  diagnostics: import('@gorenku/studio-diagnostics').DiagnosticIssue[];
}
```

Add it to the shot-video production plan report:

```ts
export interface ShotVideoTakeReferenceSectionsReport {
  general: ShotVideoTakeGeneralReferenceChoice[];
  lookbook: ShotVideoTakeLookbookReferenceChoice[];
  dialogueAudio: ShotVideoTakeDialogueAudioReferenceChoice[];
  dialogueAudioCapability: ShotVideoTakeDialogueAudioCapabilityReport;
  castMembers: ShotVideoTakeCastMemberReferenceGroup[];
  locations: ShotVideoTakeLocationReferenceGroup[];
}
```

The capability report should be built from:

- selected route input slots;
- `reference-audio` choices and their effective inclusion state;
- the selected model family label;
- the route audio slot `maxCount`.

It must not inspect provider schemas in Studio.

### Diagnostics

Use warning diagnostics during planning:

- `CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED`
- `CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED`
- `CORE_SCENE_DIALOGUE_AUDIO_MISSING_CAST_VOICE`

Use errors at final spec/provider boundaries:

- `CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED`
- `CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED`
- existing dialogue audio generation error for missing Cast Voice/provider voice
  id, with clearer wording if needed.

Planning warnings should not remove estimates from the dependency inventory.
Execution errors should prevent invalid persisted specs or provider payloads.

## Package-Level Implementation Plan

### Core Client Contracts

Update:

- `packages/core/src/client/media-generation-dependency.ts`
- `packages/core/src/client/shot-video-take-generation.ts`

Changes:

- replace `estimate-only` with `missing-input`;
- replace `needs-authored-draft` with `missing-input`;
- replace checklist action `author-generation-draft` with
  `provide-missing-input`;
- add `ShotVideoTakeDialogueAudioCapabilityReport`;
- add `dialogueAudioCapability` to the production plan references report.

### Core Dependency Planner

Update:

- `packages/core/src/server/media-generation/dependency-draft-specs.ts`
- `packages/core/src/server/media-generation/dependency-inventory.ts`
- `packages/core/src/server/media-generation/dependency-inventory-lines.ts`
- `packages/core/src/server/media-generation/purpose-registry.ts`

Changes:

- rename `buildMediaGenerationDependencyDraftSpec` to
  `planMediaGenerationDependencyDraft`;
- return either a generatable draft spec or a missing-input priced estimate;
- keep aggregate totals complete when a missing-input line has priced
  estimation;
- map `missing-input` to plan line `materializationState: 'missing-input'`;
- map `missing-input` checklist items to `provide-missing-input`;
- keep `blocked` for structural planner failures, not user-fillable missing
  setup.

### Scene Dialogue Audio Purpose

Update:

- `packages/core/src/server/media-generation/scene-dialogue-audio.ts`

Changes:

- remove `ESTIMATE_ONLY_CAST_VOICE_ID`;
- remove `ESTIMATE_ONLY_PROVIDER_VOICE_ID`;
- remove `normalizeSpecWithEstimateOnlyVoice`;
- keep normal generation spec validation strict about Cast Voice/provider voice
  id;
- add `estimateSceneDialogueAudioPricingOnly`;
- have the dependency draft planner return `missing-input` plus priced estimate
  when the dialogue has no Cast Voice or provider voice id;
- return `generatable` only when a real Cast Voice/provider voice id exists;
- make missing voice diagnostics say:
  `Assign a Cast Voice before generating dialogue audio.`

### Shot-Video Dialogue Audio Planning

Update:

- `packages/core/src/server/media-generation/shot-video-take/dependency-inventory.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-sections.ts`
- `packages/core/src/server/media-generation/shot-video-take/preflight-inputs.ts`
- `packages/core/src/server/media-generation/shot-video-take/final-specs.ts`
- `packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`
- `packages/core/src/server/media-generation/shot-video-take/route-settings.ts`

Changes:

- calculate selected dialogue audio count from effective reference inclusion,
  not from prepared audio files;
- build `ShotVideoTakeDialogueAudioCapabilityReport`;
- attach route warnings to the plan diagnostics as warnings;
- keep dialogue audio dependency estimates even when route warnings exist;
- validate final specs against route audio support;
- validate final specs against route `maxCount`;
- validate provider payload mapping against route `maxCount` as a final
  defensive check;
- keep current audio prepared input derivation from picked takes for runnable
  final specs.

### Studio Server And Services

Update:

- `packages/studio/server/testing/fake-project-data-service.ts`
- `packages/studio/src/services/studio-project-contracts.ts`

Changes:

- update fake production plan fixtures to include `dialogueAudioCapability`;
- update browser-facing response types after core contract changes;
- do not add Studio-side capability inference.

### Studio Dialogs Tab

Update:

- `packages/studio/src/features/movie-studio/scenes/scene-shot-dialogs-tab.tsx`
- related Dialogs-tab tests.

Changes:

- render a reserved capability row above dialogue cards;
- use `dialogueAudioCapability.message` for the left-side copy;
- render count as either:
  - `${selectedCount} / ${maxCount} selected` when `maxCount` is a number;
  - `${selectedCount} selected` when `maxCount` is `null`;
- style `unsupported` and `over-limit` as warnings;
- keep cards selectable unless the specific card is otherwise unavailable;
- do not silently clear or cap selected references;
- reload scene dialogue audio context when production plan dialogue choices
  change in a way that can affect playback URLs.

The reload key should be derived from stable plan data, for example:

```ts
choices.map((choice) =>
  [
    choice.dialogueId,
    choice.pickedTake?.takeId ?? 'none',
    choice.takeCount,
    choice.audioState,
  ].join(':')
).join('|')
```

This avoids depending on object identity while keeping playback data fresh after
generation, pick, or delete operations.

## Validation And Execution Boundaries

Planning should warn and price.

Final spec creation and provider payload construction should fail with
structured errors when the final request is invalid.

Required final validation:

- if any final spec input has `kind: 'audio'` and `subjectKind:
  'scene-dialogue'`, the selected route must have an audio slot;
- if the route audio slot has `maxCount`, the number of matching final audio
  inputs must be less than or equal to `maxCount`;
- route validation must use media-kind-aware matching;
- provider payload mapping should also assert max count before serializing
  `audio_urls`;
- dialogue audio generation must continue to require a real Cast Voice/provider
  voice id.

## Documentation Work

Update accepted documentation if contracts change:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`

Documentation should explicitly state:

- dependency pricing and generation readiness are separate;
- a missing-input dependency can still be priced;
- planning warnings do not automatically modify user selections;
- execution boundaries fail fast when selected inputs cannot be sent to a
  provider.

No ADR is required unless implementation changes the accepted dependency graph
architecture beyond the contract names described in this plan.

## Completion Checklist

### Review Area

- [x] Confirm the implementation keeps planning read-only and advisory.
- [x] Confirm no selected dialogue audio reference is silently dropped,
      deselected, capped, or generated by planning.
- [x] Confirm dialogue audio estimates remain visible when Cast Voice is
      missing.
- [x] Confirm missing Cast Voice affects generation readiness only, not
      priceability.
- [x] Confirm no fake voice id is exposed as a real draft generation input.
- [x] Confirm all new state names use generic contract language and actionable
      reason text.
- [x] Confirm Studio does not infer provider route capability locally.
- [x] Confirm no raw interactive HTML controls are added in Studio feature
      code.
- [x] Confirm no compatibility wrappers, alias states, re-export facades, or
      old contract shims are kept.

### Architecture And Contracts

- [x] Replace `estimate-only` with `missing-input` in
      `MediaGenerationDependencyGenerationDraft`.
- [x] Replace `needs-authored-draft` with `missing-input` in
      `MediaGenerationDependencyMaterializationState`.
- [x] Replace checklist action `author-generation-draft` with
      `provide-missing-input`.
- [x] Add `ShotVideoTakeDialogueAudioCapabilityReport`.
- [x] Add `dialogueAudioCapability` to the shot-video production plan report.
- [x] Rename the shared dependency draft planner contract to
      `planMediaGenerationDependencyDraft`.
- [x] Make the dependency draft planner return either a runnable draft spec or a
      missing-input priced estimate.
- [x] Update purpose registry types and purpose definitions directly to the new
      contract.
- [x] Update all callers and tests directly instead of preserving old names.

### Pricing And Readiness

- [x] Remove `ESTIMATE_ONLY_CAST_VOICE_ID`.
- [x] Remove `ESTIMATE_ONLY_PROVIDER_VOICE_ID`.
- [x] Remove `normalizeSpecWithEstimateOnlyVoice`.
- [x] Add `estimateSceneDialogueAudioPricingOnly`.
- [x] Price dialogue audio missing-input lines from model choice and text
      length.
- [x] Keep pricing state `priced` for missing Cast Voice when text and model
      pricing are available.
- [x] Return generation draft state `missing-input` for missing Cast Voice.
- [x] Use reason `Assign a Cast Voice before generating dialogue audio.`
- [x] Keep normal persisted dialogue audio generation strict about real Cast
      Voice/provider voice id.
- [x] Ensure aggregate dependency totals include priced missing-input lines.
- [x] Ensure aggregate totals become partial or unavailable only for genuinely
      unpriced or unavailable data.

### Route Capability Planning

- [x] Resolve the selected shot-video route in core.
- [x] Detect whether the route has an audio input slot.
- [x] Read the route audio slot `maxCount`.
- [x] Count effectively included dialogue audio references from reference
      inclusion state.
- [x] Build capability state `ok` when selected references fit the route.
- [x] Build capability state `unsupported` when selected references exist and
      the route has no audio slot.
- [x] Build capability state `over-limit` when selected count exceeds route
      `maxCount`.
- [x] Return a human-readable capability message for Studio and the agent.
- [x] Return warning diagnostics for unsupported and over-limit planning states.
- [x] Keep dependency lines and estimates present when capability warnings
      exist.

### Final Spec And Provider Validation

- [x] Add final spec validation for unsupported selected dialogue audio inputs.
- [x] Add final spec validation for route audio `maxCount`.
- [x] Add provider payload max-count validation as a defensive final check.
- [x] Ensure validation errors use structured diagnostics/error codes.
- [x] Ensure route warnings in planning do not become hard planning failures.
- [x] Ensure final spec creation cannot persist an invalid provider-bound audio
      input set.
- [x] Ensure provider payload creation cannot serialize more audio URLs than the
      selected route allows.

### Studio UI

- [x] Add the Dialogs tab capability row above the card list.
- [x] Render supported route copy, such as
      `Seedance 2.0 allows up to 3 audio references per generation`.
- [x] Render unsupported route copy, such as
      `This model does not use audio references`.
- [x] Render selected count on the right side.
- [x] Render `selectedCount / maxCount selected` when max count is known.
- [x] Render `selectedCount selected` when max count is not known.
- [x] Style `unsupported` and `over-limit` states as warnings.
- [x] Keep reference cards visible and selectable while warning state is shown.
- [x] Do not silently deselect over-limit or unsupported references.
- [x] Render missing-input reason text where generation readiness is shown.
- [x] Keep estimated cost visible on missing-input dialogue audio lines.
- [x] Reload scene dialogue audio context when plan dialogue take data changes.
- [x] Verify playback controls receive fresh URLs after generation, pick, and
      delete flows.

### Agent And JSON Surfaces

- [x] Ensure `dialogueAudioCapability` is included in the plan JSON returned to
      Studio.
- [x] Ensure dependency lines expose `pricing` and `generationDraft` separately.
- [x] Ensure missing-input lines include actionable reason text.
- [x] Ensure warning diagnostics are serialized for unsupported route and
      over-limit selected count.
- [x] Ensure checklist items use `provide-missing-input` with the same reason.
- [x] Ensure the AI agent can distinguish:
      - priced but missing input;
      - route unsupported for selected audio;
      - route over selected audio limit;
      - ready selected audio input;
      - invalid selected audio input.

### Tests

- [x] Add core tests for missing Cast Voice dialogue audio dependency pricing.
- [x] Add core tests that missing Cast Voice returns `missing-input`, not
      `authored`.
- [x] Add core tests that missing Cast Voice still contributes to total
      estimated cost.
- [x] Add core tests that no fake provider voice id appears in generatable
      drafts.
- [x] Add core tests for route capability `ok`.
- [x] Add core tests for route capability `unsupported`.
- [x] Add core tests for route capability `over-limit`.
- [x] Add core tests that unsupported route warnings are produced before audio
      is generated.
- [x] Add core tests that over-limit warnings are produced before final spec
      creation.
- [x] Add final spec tests for unsupported dialogue audio inputs.
- [x] Add final spec tests for audio input count exceeding route `maxCount`.
- [x] Add provider payload tests for audio input count exceeding route
      `maxCount`.
- [x] Update dependency inventory line tests for `missing-input`.
- [x] Update agent checklist tests for `provide-missing-input`.
- [x] Add Studio UI tests for capability row supported copy and count.
- [x] Add Studio UI tests for unsupported copy and warning styling.
- [x] Add Studio UI tests for over-limit copy and warning styling.
- [x] Add Studio UI tests that selected references are not silently changed by
      warning states.
- [x] Add Studio UI tests that dialogue audio context reloads when picked take
      data changes.
- [x] Update fake project data service fixtures and existing plan tests for the
      new `dialogueAudioCapability` contract.

### Documentation And Verification

- [x] Update `docs/architecture/media-generation.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Document that pricing and generation readiness are separate.
- [x] Document that `missing-input` can still be priced.
- [x] Document that route capability warnings do not mutate selections.
- [x] Document that final spec/provider boundaries fail fast for invalid input
      sets.
- [x] Run focused core tests for dependency inventory, dialogue audio, and
      shot-video final specs.
- [x] Run focused Studio tests for Dialogs tab behavior.
- [x] Run focused engines tests if route slot behavior changes.
- [x] Run `pnpm check` before final handoff because this touches shared
      contracts across packages.
- [x] Verify the Studio desktop UI shows the capability row in supported,
      unsupported, and over-limit states.
- [x] Verify estimates remain visible for missing Cast Voice dialogue audio.
- [x] Verify final generation cannot be created when selected dialogue audio is
      unsupported by the selected route.
- [x] Verify final generation cannot be created with more audio references than
      the selected route allows.
