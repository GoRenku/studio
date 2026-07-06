# 0115 Generation Preview Saved-Spec Builders Completion

Status: completed
Date: 2026-07-06

## Summary

Finish the remaining unchecked implementation scope from
`plans/active/0112-generation-preview-model-configuration-contract.md`, with a
simpler preview architecture.

The preview dialog has one job: let the user verify what will be sent before a
generation runs.

For image generations, the dialog should answer:

1. Which model and provider route will receive the request?
2. What prompt and reference images will be sent, if references exist?
3. What actual model/provider configuration parameters will be sent or relied
   on, such as aspect ratio, image size, quality, resolution, output format,
   seed, or number of images?

Core must not know or validate the creative contents of generated images. A
Lookbook image, Location sheet, Cast profile, and Storyboard sheet have
different creative intent, but that intent lives in opaque prompt text,
reference assets, and agent/skill guidance. From Core's preview perspective,
they are image generation requests with a purpose, target, prompt, optional
references, selected model, provider route, and model-specific parameters.

Final `shot.video-take` previews are different because they target video models
with route-specific video parameters and image/audio/video input slots. They
should use the shot-video route contract directly instead of trying to reuse
the image model configuration path.

## Background

`0112` established the current generation preview configuration contract:

- `GenerationPreviewRequest.configuration` is a sectioned object.
- Core owns row construction, row visibility, and value-source labeling.
- Studio renders `preview.configuration.sections` without provider-specific
  branching.
- Engines owns provider schema descriptors.
- Old array-shaped `configuration` payloads are retired.

`0114` cleared the blocking verification leftovers from that work:

- the stale CLI preview fixture now sends `{ sections: [...] }`;
- shot input provider-payload test fixtures use current parameter and
  reference-bundle shapes;
- focused CLI/Core verification and `pnpm check` passed.

After that remediation, `0112` still has real unchecked implementation items:

- saved-spec preview support for the remaining image purposes;
- final `shot.video-take` preview Config rows from selected video route
  parameters;
- tests proving the final video Config rows and saved-spec previews work.

This plan completes that scope without introducing per-purpose duplicated
configuration logic.

The durable architecture decision is recorded in:

- `docs/decisions/0045-use-generation-preview-purpose-bindings.md`
- `docs/architecture/generation-preview-purpose-bindings.md`

## Current Gaps

### Saved-Spec Preview Dispatch Is Too Narrow

Current `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
only dispatches saved-spec previews for `cast.character-sheet`:

```ts
switch (specRecord.purpose) {
  case CAST_CHARACTER_SHEET_GENERATION_PURPOSE:
    return buildCastCharacterSheetGenerationPreview(input);
  default:
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
      ...
    );
}
```

Saved specs for other valid image purposes and final `shot.video-take` still
fail at preview time.

### GenerationPreviewPurpose Is Too Narrow

Current `packages/core/src/client/generation-preview.ts` only allows:

```ts
export type GenerationPreviewPurpose =
  | 'shot.video-prompt-sheet'
  | 'shot.video-take'
  | 'cast.character-sheet';
```

The browser-safe preview contract should include exactly the saved-spec
purposes implemented by this plan.

### Image Preview Configuration Is Over-Specified In The Old Plan

The old `0112` checklist used wording like "Lookbook Image config" and
"Location Hero config", which can sound like Core should build separate
purpose-specific Config models.

That is not the intended architecture.

For image generations, Config should primarily be the selected image model's
actual provider/model parameters, derived from:

- the provider route schema descriptor from engines;
- the actual provider payload Core will send;
- schema defaults when Core deliberately relies on a provider default.

Examples of actual model/provider parameters:

- `image_size`;
- `aspect_ratio`;
- `quality`;
- `resolution`;
- `output_format`;
- `seed`;
- `num_images`.

Studio-level spec fields such as `imageFrame`, `sheetFrame`, `detail`,
`outputFormat`, or `takeCount` are not separate Config concepts by default.
They are inputs to the purpose provider-payload builder. If they matter to the
generation, they should appear as the effective provider/model parameter they
map to, such as `aspect_ratio`, `image_size`, `quality`, `output_format`,
`seed`, or `num_images`.

Do not duplicate them as separate product rows unless a future product decision
explicitly designs a separate "Studio controls" review section. That is not in
this plan.

### Final Shot Video Config Rows Are Missing

Final `shot.video-take` specs are validated and prepared through:

- `validateShotVideoTakeSpec(...)`;
- `prepareShotVideoTakeSpec(...)`;
- `buildShotVideoTakeProviderPayload(...)`.

But saved-spec preview rows do not yet summarize final video route
configuration. This should use the existing shot-video route helpers:

- `requireShotVideoTakeRoute(...)`;
- `parametersForRoute(...)`;
- `normalizeRouteSettingsForContext(...)`.

Do not create a second video route interpretation path for preview.

## Architecture Rules

### Core Owns Preview Construction

Saved-spec preview construction belongs in `packages/core`.

Allowed:

- a registry-owned preview hook for media generation purposes;
- a shared Core helper for saved image preview envelopes;
- purpose-owned reference resolvers that return real asset/file ids;
- a separate Core helper for final shot-video route configuration.

Forbidden:

- CLI conversion from specs to preview payloads;
- Studio route-local or React-local business rules;
- React inspecting `providerPreview.payload`;
- compatibility support for retired array-shaped `configuration`;
- broad state-patch APIs or fallback branches that compensate for missing Core
  preview builders.

### Image Content Stays Opaque

Core does not validate, score, inspect, parse, or repair the creative contents
of prompts, generated images, reference images, prompt sheets, storyboard
sheets, or location/cast/lookbook image artifacts.

For image purposes, Core may validate the envelope:

- purpose;
- target;
- selected model;
- provider route;
- provider parameter shape;
- prompt field presence/type;
- selected reference asset ids and asset file ids.

Agents, skills, and users own creative intent and prompt/reference strategy.

### References Are Not Config

Reference images are first-class preview references, not configuration rows.

Each purpose must build references from current durable asset/file ids. Do not
guess references from provider payload URLs or prepared project-relative paths.
If a purpose has no asset-backed references, return an empty `references`
array.

Config must not show:

- `Reference count`;
- image/audio/video URLs;
- local paths;
- provider upload URLs;
- raw provider payload JSON.

### Image Config Comes From Provider Schema Plus Payload

Image Config rows should be built by the shared image configuration helper from:

- provider;
- provider route/model;
- selected Renku model choice;
- route schema descriptor from engines;
- actual provider payload;
- schema defaults when no payload value is sent but a provider default is
  intentionally relied on.

The shared image helper should hide prompt and media input fields. It should
not need to know whether the purpose is Lookbook, Cast, Location, Scene
Storyboard, or shot input.

### Final Shot Video Uses Video Route Metadata

Final `shot.video-take` preview configuration should not be forced through the
image schema helper.

It should use the shot-video route contract:

- selected video model;
- selected input mode;
- selected provider route;
- route parameters;
- normalized route settings;
- final media inputs as References.

## Public Contract Changes

### GenerationPreviewPurpose

Update `GenerationPreviewPurpose` in
`packages/core/src/client/generation-preview.ts` to include the saved-spec
purposes implemented here:

```ts
export type GenerationPreviewPurpose =
  | typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE
  | typeof LOOKBOOK_SHEET_GENERATION_PURPOSE
  | typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE
  | typeof CAST_PROFILE_GENERATION_PURPOSE
  | typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE
  | typeof LOCATION_HERO_GENERATION_PURPOSE
  | typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE
  | typeof SHOT_FIRST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_LAST_FRAME_GENERATION_PURPOSE
  | typeof SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE
  | typeof SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE
  | typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE;
```

Do not include audio purposes unless audio preview builders are implemented in
the same slice. This plan completes image previews plus final shot-video
previews.

### MediaGenerationPurposeDefinition

Add a focused optional preview hook to
`packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`:

```ts
buildPreview?(
  input: ReadMediaGenerationSpecInput
): Promise<GenerationPreviewRequest>;
```

Then update `buildMediaGenerationPreview(...)` in
`packages/core/src/server/media-generation/lifecycle/spec-service.ts` to:

1. read the saved spec;
2. fetch the purpose definition;
3. call `definition.buildPreview(...)` when present;
4. keep the existing structured
   `CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED` failure for purposes
   without builders.

This keeps dispatch in the registry and avoids a growing service-level switch.

## Implementation Plan

### Slice 1: Registry-Owned Preview Dispatch

Files:

- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-service.test.ts`

Changes:

- Add `buildPreview?` to `MediaGenerationPurposeDefinition`.
- Wire existing `cast.character-sheet` preview through the registry hook.
- Update `buildMediaGenerationPreview(...)` to dispatch through the registry.
- Keep unsupported-purpose diagnostics structured and fail-fast.

Tests:

- Registered preview builders are called through the purpose definition.
- Purposes without a builder still fail with
  `CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED`.
- No CLI or Studio adapter translates preview shapes.

### Slice 2: Expand The Browser-Safe Preview Purpose Contract

Files:

- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/generation-preview/validation.test.ts`
- `packages/studio/server/routes/studio-events.test.ts`
- affected CLI/Studio preview fixtures.

Changes:

- Expand `GenerationPreviewPurpose` to the purposes implemented by this plan.
- Update validation for the expanded purpose list.
- Keep unknown preview purposes rejected.
- Update diagnostic text to name the current supported purposes.

Tests:

- Validation accepts current preview payloads for each implemented purpose.
- Validation rejects an unknown purpose string.

### Slice 3: Shared Saved Image Preview Helper

Files:

- `packages/core/src/server/generation-preview/configuration/model-input-configuration.ts`
- new `packages/core/src/server/generation-preview/saved-image-preview.ts`
  or a similarly named Core-owned module if this keeps purpose files small.
- focused tests under `packages/core/src/server/generation-preview/`.

Add a shared helper along these lines:

```ts
buildSavedImageGenerationPreview(input: {
  specRecord: MediaGenerationSpecRecord;
  project: { id?: string; name: string; title?: string };
  title: string;
  modelChoice: string;
  modelLabel?: string;
  provider: 'fal-ai';
  providerModel: string;
  mode: 'text-to-image' | 'reference-to-image' | 'image-edit';
  mediaKind: 'image';
  prompt: string;
  target: MediaGenerationTarget;
  references: GenerationPreviewRequestReference[];
  payload: Record<string, unknown>;
}): Promise<GenerationPreviewRequest>;
```

The helper should:

- call `buildImagePreviewConfiguration(...)`;
- build the common preview envelope;
- set `model`, `finalPrompt`, `references`, `configuration`, and
  `providerPreview`;
- keep Config rows limited to model/provider parameters from schema and
  payload/defaults.

It should not:

- build purpose-specific references;
- inspect prompt content;
- add purpose-specific product rows;
- show reference counts;
- expose raw payload as Config rows.

Purpose modules remain responsible for:

- reading current context;
- validating the saved spec;
- building the provider payload/plan;
- resolving real asset-backed references.

### Why Saved Image Purposes Still Need Purpose Bindings

The implementation should not create separate image model-configuration
builders for each purpose. Model configuration is shared and comes from the
provider route schema plus the actual provider payload.

The purpose-specific functions in the next slice are better understood as
purpose bindings, not independent Config builders. Their job is to bind a
purpose's existing domain contract to the shared saved-image preview helper.

Each purpose binding answers questions that a generic image helper cannot
answer safely:

- How do we read and validate this purpose's saved spec?
- Which current project context must the spec be checked against?
- Which existing provider payload builder owns the provider request?
- Which project assets are real references for this purpose?
- Which target shape and title should the preview use?

The difference is mostly reference and context ownership, not model parameter
ownership.

Examples:

| Purpose | Shared Preview Logic | Purpose Binding Responsibility |
| --- | --- | --- |
| `lookbook.image` | model, prompt, Config from provider payload | Read Lookbook context, call `buildLookbookImageProviderPayload(...)`, usually return no selected references unless real asset-backed references exist. |
| `cast.profile` | model, prompt, Config from provider payload | Validate Cast Member ownership, call `buildCastProfileProviderPayload(...)`, resolve selected/source cast image references. |
| `location.hero` | model, prompt, Config from provider payload | Validate Location ownership, call `buildLocationHeroProviderPayload(...)`, include the selected Location Sheet asset as a reference. |
| `scene.storyboard-sheet` | model, prompt, Config from provider payload | Validate Scene/Shot List context, call `buildSceneStoryboardSheetProviderPayload(...)`, resolve selected lookbook sheet references without inspecting sheet contents. |
| `shot.first-frame` and related shot input image purposes | model, prompt, Config from provider payload | Validate Shot Video Take context, call `buildShotVideoTakeInputProviderPayload(...)`, resolve the shot input reference bundle. |

This means a correct purpose binding should be small and boring:

```ts
return buildSavedImageGenerationPreview({
  specRecord,
  project: context.project,
  target: specRecord.target,
  title: specRecord.title,
  modelChoice: spec.modelChoice,
  modelLabel,
  provider: plan.provider,
  providerModel: plan.model,
  mode: plan.mode,
  prompt: spec.prompt,
  references: resolvedReferences,
  payload: plan.payload,
});
```

If a purpose binding starts hand-building rows for `aspect_ratio`, `quality`,
`image_size`, `resolution`, or other image model parameters, that is a review
smell. Those rows belong in the shared provider-schema/payload configuration
path.

### Slice 4: Saved Image Preview Purpose Bindings

Files:

- `packages/core/src/server/media-generation/purposes/lookbook-image.ts`
- `packages/core/src/server/media-generation/purposes/lookbook-sheet.ts`
- `packages/core/src/server/media-generation/purposes/cast-profile.ts`
- `packages/core/src/server/media-generation/purposes/location-environment-sheet.ts`
- `packages/core/src/server/media-generation/purposes/location-hero.ts`
- `packages/core/src/server/media-generation/purposes/scene-storyboard-sheet.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/input-specs.ts`
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`

Add saved-spec preview purpose bindings for:

- `lookbook.image`;
- `lookbook.sheet`;
- `cast.profile`;
- `location.environment-sheet`;
- `location.hero`;
- `scene.storyboard-sheet`;
- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-image`;
- `shot.video-prompt-sheet`.

Each builder should:

- read the saved spec;
- assert/validate the current spec type;
- build current context;
- use the existing provider payload builder for that purpose;
- resolve purpose-specific references from current asset relationships;
- call the shared saved image preview helper.

The bindings should stay focused. They should not duplicate model
configuration row logic and should not become per-purpose form builders.

Config expectations:

- Config rows come from actual image model/provider parameters:
  - examples: `image_size`, `aspect_ratio`, `quality`, `resolution`,
    `output_format`, `seed`, `num_images`.
- Studio spec fields like `imageFrame`, `sheetFrame`, `heroFrame`, `shotFrame`,
  `detail`, `outputFormat`, and `takeCount` should not appear as separate
  duplicate rows unless a provider schema field with the effective value exists.
- Prompt-sheet visual style and notation mode are deterministic prompt-sheet
  metadata, but they should not be added as image model configuration rows in
  this plan unless the UI explicitly designs a separate metadata section.

Reference expectations:

- Cast Profile edit/reference previews include selected source image assets
  when real asset/file ids exist.
- Location Hero previews include the selected source Location Sheet asset.
- Shot input previews use `resolveShotVideoInputReferenceBundle(...)`.
- Scene Storyboard previews include selected lookbook sheet references only
  when real asset/file ids exist.
- Purposes without selected references return `references: []`.

Tests:

- Each builder creates a valid `GenerationPreviewRequest`.
- Each builder uses the selected provider route and model.
- Config rows reflect model/provider parameters for the selected route.
- Prompt text appears in `finalPrompt.text`, not Config.
- Reference images appear in `references`, not Config counts.
- Config does not show `Reference count`.
- Config does not expose raw provider payload JSON.

### Slice 5: Final Shot Video Preview Builder

Files:

- new `packages/core/src/server/generation-preview/configuration/shot-video-configuration.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/final-specs.ts`
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
- final shot-video preview tests.

Add:

```ts
buildShotVideoTakeGenerationPreview(input: ReadMediaGenerationSpecInput)
buildShotVideoTakePreviewConfiguration(input: {
  spec: ShotVideoTakeOutputGenerationSpec;
  context: ShotVideoTakeProductionContext;
  plan: ShotVideoTakeProviderPlan;
}): GenerationPreviewConfiguration;
```

Configuration source of truth:

- route from `requireShotVideoTakeRoute(spec.modelChoice, spec.inputModeId,
  context.shotGroupMode)`;
- route parameter reports from `parametersForRoute(route)`;
- normalized settings from `normalizeRouteSettingsForContext({ context, route })`;
- provider payload from `buildShotVideoTakeProviderPayload(...)`.

Config should show:

- selected video model;
- selected input mode;
- selected provider route;
- final video route parameters such as duration, aspect ratio, resolution,
  audio-generation options, voice-control options, or other parameters exposed
  by the selected route.

References should show:

- image inputs;
- audio inputs;
- video inputs;
- real `assetId`, `assetFileId`, role, media kind, and provider-token meaning
  from `ShotVideoTakeOutputGenerationInput`.

Config must not show:

- media input counts;
- raw input URLs;
- local paths;
- provider upload URLs;
- raw provider payload JSON.

Tests:

- Text-only final video preview shows route parameter rows.
- Image/video/reference route previews keep prepared inputs in References.
- Normalized route settings supply effective values.
- Unsupported or dropped settings are not surfaced as active Config values.
- Config does not show `Reference count`.

### Slice 6: Studio And CLI Surface Verification

Files:

- `packages/cli/src/commands/generation-command-handlers.test.ts`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.test.tsx`
- `packages/studio/server/routes/studio-events.test.ts`
- fake project data service fixtures as needed.

Changes:

- Update fixtures for newly supported preview purposes.
- Keep CLI `generation preview show --spec ...` thin:
  - parse flags;
  - call Core `buildMediaGenerationPreview`;
  - validate the returned Core preview;
  - notify Studio.
- Keep Studio rendering generic:
  - render `preview.configuration.sections`;
  - do not branch on provider ids or generation purpose ids for Config rows;
  - do not inspect provider payload.

Tests:

- CLI saved-spec preview show succeeds for at least one newly supported image
  purpose.
- CLI saved-spec preview show succeeds for final `shot.video-take`.
- Studio event validation accepts the expanded preview purpose contract.
- Config tab remains data-driven.

### Slice 7: Documentation And Plan Reconciliation

Files:

- `docs/architecture/reference/media-generation.md`
- `docs/architecture/studio-coordination-events.md`
- `plans/active/0112-generation-preview-model-configuration-contract.md`
- this plan.

Changes:

- Document that saved image previews use a shared model-parameter path.
- Document that image purpose content remains prompt/reference-owned and opaque
  to Core runtime.
- Document that final shot-video previews use video route metadata, not the
  image schema helper.
- After implementation and verification, update the remaining unchecked `0112`
  boxes that this plan completes.

## Non-Goals

- Do not implement audio saved-spec previews unless explicitly added with tests.
- Do not redesign Studio preview editing.
- Do not add preview-time mutation controls.
- Do not parse prompt text or generated/reference media contents.
- Do not add compatibility support for retired array-shaped `configuration`.
- Do not add CLI or Studio adapters that compensate for missing Core preview
  builders.
- Do not show raw provider payload JSON as user-facing Config content.
- Do not add duplicate Config rows for Studio spec controls when the effective
  model/provider parameter already represents the value.

## Risks And Review Points

### Risk: Reintroducing Purpose-Specific Image Config Duplication

Image purposes have different creative content, but their model configuration
review is the same category of problem: selected image model, provider route,
prompt, references, and provider/model parameters.

Review point:

- Saved image previews should use the shared saved image helper.
- Purpose bindings should not each maintain their own copy of model-parameter
  row logic.
- Purpose bindings should stay limited to spec/context validation, provider
  plan selection, target/title data, and durable reference resolution.

### Risk: Hiding The Actual Model Parameters Behind Studio Controls

Rows like `imageFrame` or `detail` are Studio controls, not necessarily provider
fields. Showing those instead of the effective provider/model parameter can
hide the thing the user wants to verify, such as `aspect_ratio: 4:3`.

Review point:

- Config must show actual provider/model parameters from schema and payload.
- If a Studio control maps to a provider field, verify the provider field row.

### Risk: Generic Preview Builder Guesses References

Prepared generation input files do not carry enough durable asset metadata to
construct preview references safely.

Review point:

- The shared image helper must not infer references from paths.
- Purpose modules must supply real `assetId` and `assetFileId` references.

### Risk: Final Video Config Duplicates Route Logic

Final video routes already have route definitions, parameter reports, and
normalization helpers.

Review point:

- Preview rows must use `requireShotVideoTakeRoute(...)`,
  `parametersForRoute(...)`, and `normalizeRouteSettingsForContext(...)`.
- Do not create a preview-only route parameter map.

### Risk: Creative Artifact Rules Regress

Storyboard, prompt-sheet, location, cast, and lookbook image previews can tempt
runtime code toward checking panels, labels, captions, shot coverage, or visual
matching.

Review point:

- Runtime code validates envelope and deterministic metadata only.
- Core does not inspect prompt or media contents.

## Completion Checklist

### Review And Architecture

- [x] Confirm this plan completes only the remaining unchecked `0112` scope.
- [x] Confirm image preview Config is actual model/provider parameters, not
      duplicated Studio product controls.
- [x] Confirm final shot-video preview Config uses video route metadata, not
      the image schema helper.
- [x] Confirm preview construction remains Core-owned.
- [x] Confirm CLI and Studio remain thin consumers of Core preview payloads.
- [x] Confirm no compatibility adapter, shim, fallback branch, or retired
      array-shaped `configuration` support is added.
- [x] Confirm no Studio component imports engines or provider schemas.
- [x] Confirm no React component branches on provider model ids for Config.
- [x] Confirm no runtime code parses prompt text or generated/reference media
      contents.
- [x] Confirm references are built from current durable asset/file ids, not
      guessed from paths.

### Public Contracts

- [x] Expand `GenerationPreviewPurpose` to the implemented previewable saved
      spec purposes.
- [x] Update generation preview validation for the expanded purpose list.
- [x] Keep unknown preview purposes rejected with structured diagnostics.
- [x] Add `buildPreview?` to `MediaGenerationPurposeDefinition`.
- [x] Update `buildMediaGenerationPreview(...)` to dispatch through the purpose
      registry.
- [x] Keep `CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED` for registered
      purposes without builders.

### Shared Image Preview Path

- [x] Add a shared saved image preview helper.
- [x] Keep image Config rows derived from provider schema descriptors and
      actual provider payload/defaults.
- [x] Keep prompt fields out of image Config.
- [x] Keep media input fields out of image Config.
- [x] Keep reference counts out of image Config.
- [x] Ensure the shared helper does not build or guess references.
- [x] Ensure the shared helper validates provider payloads before building
      Config rows.

### Saved Image Preview Purpose Bindings

- [x] Add saved-spec preview purpose binding for `lookbook.image`.
- [x] Add saved-spec preview purpose binding for `lookbook.sheet`.
- [x] Add saved-spec preview purpose binding for `cast.profile`.
- [x] Add saved-spec preview purpose binding for `location.environment-sheet`.
- [x] Add saved-spec preview purpose binding for `location.hero`.
- [x] Add saved-spec preview purpose binding for `scene.storyboard-sheet`.
- [x] Add saved-spec preview purpose binding for `shot.first-frame`.
- [x] Add saved-spec preview purpose binding for `shot.last-frame`.
- [x] Add saved-spec preview purpose binding for `shot.reference-image`.
- [x] Add saved-spec preview purpose binding for `shot.video-prompt-sheet`.
- [x] Wire all saved image preview purpose bindings through the purpose registry.
- [x] Ensure each binding uses the current purpose context and existing
      provider payload builder.
- [x] Ensure each binding supplies only durable asset-backed references.
- [x] Ensure no binding hand-builds image model parameter rows already owned by
      the shared image configuration helper.

### Final Shot Video Preview

- [x] Add `buildShotVideoTakeGenerationPreview(...)`.
- [x] Add `buildShotVideoTakePreviewConfiguration(...)`.
- [x] Build model rows from selected final video model and provider route.
- [x] Build input mode row from `spec.inputModeId`.
- [x] Build route parameter rows from `parametersForRoute(route)`.
- [x] Use `normalizeRouteSettingsForContext(...)` for effective values.
- [x] Keep image/audio/video inputs in References.
- [x] Do not show media input counts in Config.
- [x] Wire final `shot.video-take` preview through the purpose registry.

### Studio And CLI Surfaces

- [x] Update CLI preview-show tests for at least one newly supported image
      saved-spec preview.
- [x] Update CLI preview-show tests for final `shot.video-take` saved-spec
      preview.
- [x] Update Studio event validation fixtures for expanded preview purposes.
- [x] Update Studio generation preview fixtures without adding provider-id
      branching in React.
- [x] Confirm Config tab still renders from `preview.configuration.sections`.
- [x] Confirm Config tab still does not render `providerPreview.payload`.

### Core Tests

- [x] Add registry dispatch tests for `buildPreview?`.
- [x] Add validation tests for expanded `GenerationPreviewPurpose`.
- [x] Add saved image preview tests covering the shared helper.
- [x] Add Lookbook Image saved-spec preview tests.
- [x] Add Lookbook Sheet saved-spec preview tests.
- [x] Add Cast Profile saved-spec preview tests.
- [x] Add Location Environment Sheet saved-spec preview tests.
- [x] Add Location Hero saved-spec preview tests.
- [x] Add Scene Storyboard Sheet saved-spec preview tests.
- [x] Add shot input saved-spec preview tests.
- [x] Add final `shot.video-take` Config row tests.
- [x] Add tests proving prompts stay out of Config.
- [x] Add tests proving references stay in References.
- [x] Add tests proving `Reference count` is not emitted.
- [x] Add tests proving Studio product controls are not duplicated as Config
      rows when provider/model parameter rows already represent the value.

### Documentation And Plans

- [x] Update media-generation architecture docs for saved-spec preview builder
      ownership.
- [x] Update Studio coordination events docs for expanded previewable purpose
      list.
- [x] Document that image content remains prompt/reference-owned and opaque to
      Core runtime.
- [x] Update `0112` checklist after implementation, not before.
- [x] Mark this plan complete only after all verification commands pass.

### Focused Verification

- [x] Run `pnpm --dir packages/core test -- generation-preview`.
- [x] Run `pnpm --dir packages/core test -- model-input-configuration`.
- [x] Run `pnpm --dir packages/core test -- lookbook`.
- [x] Run `pnpm --dir packages/core test -- cast-image`.
- [x] Run `pnpm --dir packages/core test -- location`.
- [x] Run `pnpm --dir packages/core test -- scene-storyboard`.
- [x] Run `pnpm --dir packages/core test -- shot-video-take`.
- [x] Run `pnpm --filter @gorenku/studio-cli test -- generation-command-handlers.test.ts --run`.
- [x] Run `pnpm --filter @gorenku/studio test -- generation-preview-dialog-host`.
- [x] Run `pnpm --filter @gorenku/studio-core test:typecheck`.
- [x] Run `pnpm --filter @gorenku/studio-cli test:typecheck`.
- [x] Run `pnpm --filter @gorenku/studio test:typecheck`.

### Final Verification

- [x] Run `pnpm check`.
- [x] Confirm `rg -n "configuration:\s*\[|\"configuration\"\s*:\s*\[" packages`
      returns no stale package preview contract literals.
- [x] Confirm `rg -n "Reference count" packages/core/src/server/generation-preview packages/core/src/server/media-generation`
      does not find emitted preview Config rows.
- [x] Confirm no new `as any` or `unknown as` casts were introduced for preview
      contracts.
- [x] Confirm `0112` remaining unchecked boxes are checked only after the
      implementation and tests are complete.
