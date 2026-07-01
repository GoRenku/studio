# 0095 Shot Video Input Reference Conditioning

Status: implemented
Date: 2026-06-30

## Summary

Shot input images should default to the movie's visual language and the take's
selected reference sheets.

This applies to:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.reference-image` ad hoc reference images;
- `shot.video-prompt-sheet`.

The prompt sheet has a special visible failure mode because its panelled layout
can resemble a storyboard, but the underlying gap is shared: Renku-managed shot
input image generation can describe selected references in prompt text, yet the
provider request currently does not receive the selected reference image files.
That makes first frames, last frames, ad hoc reference images, and prompt sheets
all too easy to generate without the selected Movie Lookbook, Location Sheets,
and Character Sheets actually conditioning the image model.

This plan adds a Core-owned reference-conditioning contract for shot input image
generation:

- default reference mode is `movie-lookbook`;
- `movie-lookbook` mode uses the selected Movie Lookbook sheet as the primary
  style reference;
- `movie-lookbook` mode also uses the selected Location Sheet and Character
  Sheet images for the locations and cast members in the take;
- `storyboard-lookbook` mode is available only when the user explicitly asks for
  storyboard or hand-drawn aesthetics;
- `storyboard-lookbook` mode uses the selected Storyboard Lookbook sheet as the
  primary style reference while still using selected Location Sheet and
  Character Sheet images for content continuity;
- Core resolves and validates the reference image bundle;
- provider payload construction sends those references through image-edit /
  reference-capable routes where supported;
- agent guidance treats text-only external image generation as a fallback that
  must be disclosed when the tool cannot accept image references.

The key architectural point: the agent should not pick references from
filenames, newest assets, or visual guesswork. The relationships already exist
in Core and should be used directly for every shot input image purpose.

## Relationship To Prior Work

This plan builds on:

- `plans/active/0083-storyboard-lookbook-style-generation.md`, which established
  typed Movie Lookbooks and Storyboard Lookbooks and made the selected
  Storyboard Lookbook sheet the style dependency for `scene.storyboard-sheet`;
- `plans/active/0091-uniform-take-reference-sheet-selection.md`, which moved
  Shot Video Take reference choices into durable take direction state;
- `plans/active/0094-shot-video-prompt-sheet-guidance.md`, which improved agent
  guidance for authoring prompt-sheet briefs but intentionally avoided adding
  new Core contracts.

`0094` was enough to improve prompt-sheet wording and inspection. It is not
enough to guarantee visual conditioning, because Renku-managed shot input image
generation still prepares text-to-image requests with no selected reference
`inputFiles`.

This plan is the Core contract follow-up.

## Current Findings

The relationships needed for the default behavior already exist.

### Active Movie Lookbook

Shot Video Take context reads the selected Movie Lookbook through
`readSelectedMovieLookbookId`. It only returns `activeLookbook` when the selected
Lookbook is typed as `movie`. A selected Storyboard Lookbook does not satisfy
this field.

Relevant code:

- `packages/core/src/server/media-generation/shot-video-take/context.ts`
- `packages/core/src/server/database/access/lookbook.ts`

### Selected Cast And Locations

Shot Video Take context derives selected cast and selected locations from the
take's selected shots and the scene reference scope.

This means the shot input reference resolver should not scan every project Cast
Member or Location. It should use the take's selected shots, then include only
the selected references for those scoped cast members and locations.

Relevant code:

- `packages/core/src/server/media-generation/shot-video-take/context.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection.ts`

### Direction-Level Reference Selections

Take direction state already stores:

- `selectedLookbookSheetIds`;
- `selectedCharacterSheetAssetIds`;
- `selectedLocationSheetAssetIds`.

For continuous takes, the shared direction provides the reference selections.
For multi-cut takes, Core aggregates selections across generation directions for
the ordered shot ids.

Relevant code:

- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/server/media-generation/shot-video-take/reference-selection.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-state.ts`

### Selection Validation

Core already validates the selected reference relationships:

- selected Character Sheet assets must belong to the selected Cast Member;
- selected Location Sheet assets must belong to the selected Location;
- selected Lookbook sheets must belong to the active Movie Lookbook.

Relevant code:

- `packages/core/src/server/media-generation/shot-video-take/authoring.ts`

### Dependency Slots

Shot Video Take dependency slots already know how to describe:

- Movie Lookbook sheet references;
- Cast Character Sheet references;
- Location Environment Sheet references.

The current policies matter:

- Lookbook sheet uses `selected-or-default`;
- Character Sheet uses `selected-only`;
- Location Sheet uses `selected-only`.

That means Core may use the active Movie Lookbook's selected/default sheet, but
it must not guess Character Sheets or Location Sheets when the take has not
selected them.

Relevant code:

- `packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts`
- `packages/core/src/server/media-generation/dependency-slot-definitions.ts`
- `packages/core/src/server/media-generation/dependency-selectors.ts`

### Current Prompt-Sheet Provider Gap

`ShotVideoTakeInputGenerationSpec` currently has prompt and parameters, but no
reference-image contract.

`buildShotVideoTakeInputProviderPayload` currently returns:

```ts
inputFiles: []
```

for all shot input purposes, including `shot.video-prompt-sheet`.

Relevant code:

- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/server/media-generation/shot-video-take/input-specs.ts`
- `packages/core/src/server/media-generation/shot-video-take/provider-payloads.ts`

This is the direct cause of the observed style drift. The generation request can
say "follow the Movie Lookbook," but the provider does not receive the actual
Movie Lookbook sheet, Location Sheets, or Character Sheets. The failure is most
visible on prompt sheets, but the same missing conditioning can affect first
frames, last frames, and ad hoc shot reference images.

## Problem Statement

Shot input images are visual continuity assets. A first frame, last frame, ad
hoc `shot.reference-image`, or video prompt sheet should not be generated from
prompt text alone when the take already has selected Movie Lookbook, Location
Sheet, and Character Sheet references.

The current system treats these shot input images as text-to-image requests. It
does not yet send the selected reference images to the provider, so generated
inputs can miss:

- the selected Movie Lookbook's palette, lighting, texture, camera language, and
  overall finish;
- the selected Location Sheet's geography, material state, landmarks, and
  atmosphere;
- the selected Character Sheet's face, body, wardrobe, costume, and continuity
  rules.

`shot.video-prompt-sheet` has an additional style-source problem. Its panelled
layout can resemble a storyboard, but it still guides final AI video generation.
By default, it should look and feel like the movie, not like the selected
Storyboard Lookbook. Storyboard aesthetics are useful only when the user
explicitly asks for that hand-drawn or animatic look.

## Goals

- Make the default shot input image generation path use selected reference
  images, not only textual prompt guidance.
- Make the selected Movie Lookbook sheet the default primary style reference.
- Use selected Location Sheets and Character Sheets for the locations and
  non-voiceover cast members in the take.
- Preserve user flexibility through an explicit `storyboard-lookbook` reference
  mode.
- Keep reference selection and validation in `packages/core`.
- Avoid adding Studio, CLI, or agent-local business rules for choosing
  references.
- Avoid guessing from asset filenames, ids, recent generation order, folder
  paths, old sample projects, or visual similarity.
- Fail fast with structured diagnostics when the requested reference mode cannot
  be satisfied.
- Keep `scene.storyboard-sheet` and shot input images as distinct generation
  surfaces with distinct default visual language.
- Ensure Renku-managed generation uses reference-capable provider payloads when
  reference images exist.
- Ensure external/Codex image generation guidance is honest about whether the
  active tool can accept actual reference images.

## Non-Goals

- Do not change the default visual language of `scene.storyboard-sheet`.
- Do not make Storyboard Lookbooks a default dependency for shot input images.
- Do not select Location Sheets or Character Sheets by "first available" when
  the take did not select them.
- Do not add a compatibility alias for old shot input specs.
- Do not add duplicate reference selection fields in Studio UI state.
- Do not add a generic media-reference framework in this slice.
- Do not move provider capability logic into Studio browser code.
- Do not make the CLI parse prompts to infer whether storyboard mode was
  requested.
- Do not run paid media generation as part of implementation verification.

## Proposed Public Contract

Add an explicit shot input reference mode:

```ts
export type ShotVideoInputReferenceMode =
  | 'movie-lookbook'
  | 'storyboard-lookbook';
```

Add this field to the current shot input generation contract for
`shot.first-frame`, `shot.last-frame`, `shot.reference-image`, and
`shot.video-prompt-sheet` specs and dependency drafts:

```ts
referenceMode: ShotVideoInputReferenceMode;
```

Rules:

- `referenceMode` is required for every shot input image spec in this contract.
- Core-generated shot input dependency drafts use
  `referenceMode: 'movie-lookbook'`.
- Agent-authored shot input specs use `referenceMode: 'movie-lookbook'`
  unless the user explicitly asks for Storyboard Lookbook, storyboard drawing,
  hand-drawn, animatic, sketch, panel art, or equivalent storyboard aesthetics.
- `referenceMode: 'storyboard-lookbook'` is valid only when a selected
  Storyboard Lookbook and usable Storyboard Lookbook sheet exist.
- `storyboard-lookbook` mode should be especially rare for first-frame,
  last-frame, and reference-image generation, because those images usually feed
  final video generation. Use it there only when the user explicitly wants those
  shot input images, and likely the resulting video, to have storyboard or
  hand-drawn aesthetics.

Do not add separate public model choices for edit routes. Keep the current base
model choices:

- `fal-ai/openai/gpt-image-2`;
- `fal-ai/nano-banana-2`;
- `fal-ai/xai/grok-imagine-image`.

Provider payload construction should map those base choices to edit/reference
provider models when a reference bundle has image files, matching the existing
`scene.storyboard-sheet` pattern.

## Reference Modes

### `movie-lookbook`

This is the default.

Purpose:

- create shot input images that look and feel like the movie;
- preserve cinematic palette, lighting, lens language, texture, world detail,
  costume, location, and character continuity;
- avoid storyboard drawing language unless the Movie Lookbook itself explicitly
  contains drawn/illustrated aesthetics.

Core reference resolution:

- require a selected Movie Lookbook;
- resolve the selected/default Movie Lookbook sheet;
- include it as the primary style reference image;
- include selected Location Sheet images for locations in the take;
- include selected Character Sheet images for non-voiceover cast members in the
  take;
- honor existing take reference inclusion overrides;
- do not include the selected Storyboard Lookbook sheet as a provider image;
- do not use scene storyboard images as style references.

Prompt wording:

- "Use the Movie Lookbook sheet as the primary style reference."
- "Use Location Sheets and Character Sheets as continuity references."
- "Do not render this shot input image in Storyboard Lookbook drawing style."
- For prompt sheets: "A panelled layout is allowed; storyboard aesthetics are
  not the default."

### `storyboard-lookbook`

This is opt-in only.

Purpose:

- create a shot input image with hand-drawn or storyboard-like aesthetics
  because the user explicitly requested that look;
- for prompt sheets, keep the artifact take-owned and prompt-sheet-oriented,
  not a `scene.storyboard-sheet` import batch;
- still preserve selected cast and location continuity.

Core reference resolution:

- require a selected Storyboard Lookbook;
- require a usable Storyboard Lookbook sheet;
- include the Storyboard Lookbook sheet as the primary style reference image;
- include selected Location Sheet images for locations in the take;
- include selected Character Sheet images for non-voiceover cast members in the
  take;
- optionally include textual Movie Lookbook context for cinematic intent, but
  do not use the Movie Lookbook sheet as the primary style image in this mode.

Prompt wording:

- "Use the Storyboard Lookbook sheet as the primary drawing/style reference."
- For prompt sheets: "Keep the artifact a video prompt sheet for this take, not
  a scene storyboard sheet."
- "Use selected Location Sheets and Character Sheets for content continuity."

## Core Design

### 1. Add A Shot Input Reference Bundle Resolver

Add a focused module:

```text
packages/core/src/server/media-generation/shot-video-take/shot-input-references.ts
```

Primary exported function:

```ts
resolveShotVideoInputReferenceBundle(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  purpose: ShotVideoTakeInputGenerationPurpose;
  referenceMode: ShotVideoInputReferenceMode;
}): ShotVideoInputReferenceBundle
```

Proposed bundle shape:

```ts
export interface ShotVideoInputReferenceBundle {
  purpose: ShotVideoTakeInputGenerationPurpose;
  referenceMode: ShotVideoInputReferenceMode;
  styleReference:
    | ShotVideoInputResolvedReference
    | null;
  continuityReferences: ShotVideoInputResolvedReference[];
  promptNotes: string[];
}

export interface ShotVideoInputResolvedReference {
  role:
    | 'movie-lookbook-sheet'
    | 'storyboard-lookbook-sheet'
    | 'location-sheet'
    | 'character-sheet';
  dependencyId: string;
  label: string;
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: 'image';
  required: boolean;
}
```

The resolver should use existing dependency selectors where possible. It should
not perform raw asset scans except through existing Core-owned selectors and
database access helpers.

### 2. Add Shot Input Dependency Declarations

Add purpose-specific dependency declarations for shot input image generation.

Responsibilities:

- declare the Movie Lookbook sheet as required in `movie-lookbook` mode;
- declare the Storyboard Lookbook sheet as required in `storyboard-lookbook`
  mode;
- declare selected Character Sheet dependencies for non-voiceover selected cast
  members;
- declare selected Location Sheet dependencies for selected locations;
- surface missing selected-only Location Sheet and Character Sheet dependencies
  as actionable missing references;
- keep dependency ids stable and compatible with existing take reference
  inclusion overrides.

The declaration should live in Core, likely near the new shot input reference
resolver or in a focused companion module:

```text
packages/core/src/server/media-generation/shot-video-take/shot-input-dependencies.ts
```

Wire it into the `SHOT_FIRST_FRAME_GENERATION_PURPOSE`,
`SHOT_LAST_FRAME_GENERATION_PURPOSE`, `SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE`,
and `SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE` entries in
`purpose-registry.ts`.

### 3. Update Spec Normalization And Validation

`validateInputSpecAgainstContext` should enforce:

- shot input image specs require `referenceMode`;
- `movie-lookbook` mode requires an active Movie Lookbook and a usable Movie
  Lookbook sheet;
- `storyboard-lookbook` mode requires a selected Storyboard Lookbook and a
  usable Storyboard Lookbook sheet;
- selected Character Sheet and Location Sheet references must resolve when they
  are included by default or explicitly included;
- excluded optional references are not sent to the provider;
- required references cannot be excluded.

Use structured `ProjectDataError` diagnostics with stable Core-prefixed codes.

Suggested diagnostic codes:

- `CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_REQUIRED`;
- `CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_UNSUPPORTED`;
- `CORE_SHOT_VIDEO_INPUT_MOVIE_LOOKBOOK_MISSING`;
- `CORE_SHOT_VIDEO_INPUT_MOVIE_LOOKBOOK_SHEET_MISSING`;
- `CORE_SHOT_VIDEO_INPUT_STORYBOARD_LOOKBOOK_MISSING`;
- `CORE_SHOT_VIDEO_INPUT_STORYBOARD_LOOKBOOK_SHEET_MISSING`;
- `CORE_SHOT_VIDEO_INPUT_REFERENCE_FILE_MISSING`;
- `CORE_SHOT_VIDEO_INPUT_REFERENCE_LIMIT_EXCEEDED`.

### 4. Update Provider Payload Construction

Change:

```ts
buildShotVideoTakeInputProviderPayload(spec)
```

to accept the context and resolved shot input reference bundle when preparing
shot input specs:

```ts
buildShotVideoTakeInputProviderPayload(input: {
  spec: ShotVideoTakeInputGenerationSpec;
  context: ShotVideoTakeProductionContext;
  references: ShotVideoInputReferenceBundle;
})
```

For all shot input image purposes:

- if the resolved bundle has image references, send them through image-edit /
  reference image provider fields;
- set `inputFiles` to the exact project-relative image paths in the same order
  as `payload.image_urls`;
- keep the first image as the primary style reference;
- place continuity images after the style reference;
- include labels and roles in prompt text so the provider knows what each image
  is for.

Provider mapping should follow the existing `scene.storyboard-sheet` pattern:

- `fal-ai/openai/gpt-image-2` with references becomes provider model
  `openai/gpt-image-2/edit`, mode `image-edit`;
- `fal-ai/nano-banana-2` with references becomes provider model
  `nano-banana-2/edit`, mode `image-edit`;
- `fal-ai/xai/grok-imagine-image` with references becomes provider model
  `xai/grok-imagine-image/edit`, mode `image-edit`, only if its current schema
  supports the requested shot input settings.

If a provider route has a maximum reference-image count, encode that limit in
Core and fail fast with `CORE_SHOT_VIDEO_INPUT_REFERENCE_LIMIT_EXCEEDED`
instead of dropping references silently.

### 5. Update Preparation, Estimate, And Run Paths

All paths that prepare or estimate shot input specs must resolve shot input
references before building the provider request:

- `validateShotInputSpec`;
- `prepareShotInputSpec`;
- `prepareShotInputDraftSpec`;
- `estimateShotInputSpec`;
- `runShotInputSpec` if it has a separate preparation path.

The estimate and run paths must use the same provider payload builder. Do not
let estimate use text-to-image while run uses image-edit, or the approval token
will describe a different generation request from the one executed.

### 6. Update Dependency Drafts

`buildShotInputDependencyDraftSpec` should set:

```ts
referenceMode: 'movie-lookbook'
```

when it creates a draft for any shot input image purpose.

Agent-authored dependency drafts should be allowed to set:

```ts
referenceMode: 'storyboard-lookbook'
```

only when the user explicitly requests storyboard/hand-drawn aesthetics for the
generated shot input image.

Update:

- `SceneShotVideoTakeProductionState.agentProposal.dependencyDrafts`;
- JSON schema validation for take authoring documents;
- tests for authored and missing shot input dependency drafts.

### 7. Update Context Reports For Agents

The take authoring and generation context should expose enough information for
agents to explain what Core will use.

Add a compact shot input reference report to the relevant context surface:

```ts
shotVideoInputReferences: {
  defaultReferenceMode: 'movie-lookbook';
  availableReferenceModes: Array<{
    referenceMode: ShotVideoInputReferenceMode;
    available: boolean;
    unavailableReason?: string;
  }>;
  defaultReferenceBundle?: {
    styleReference?: { role: string; label: string; assetId: string };
    continuityReferences: Array<{ role: string; label: string; assetId: string }>;
  };
}
```

Keep this as a report/projection. Do not create a second durable selection
surface.

### 8. Update Agent Guidance

Update the sister `studio-skills` project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/
```

Required guidance updates:

- `media-producer/references/shot-video-prompt-sheet.md`;
- `media-producer/references/shot-first-last-frame.md`;
- `media-producer/references/shot-reference-images.md`;
- `media-producer/references/shot-video-take.md`;
- `media-producer/SKILL.md`;
- `movie-director` handoff guidance if it mentions prompt sheets.

The guidance must say:

- default shot input image visual style is the selected Movie Lookbook, not the
  Storyboard Lookbook;
- selected Location Sheets and Character Sheets are required continuity inputs
  when Core reports them for the take;
- Storyboard Lookbook style is opt-in and requires explicit user direction for
  whichever shot input image is being generated;
- if the current image-generation tool cannot accept actual image references,
  the agent must disclose that limitation and prefer a Renku-managed
  reference-capable route when the user wants the image to use selected
  references;
- storyboard images may inform shot intent only when Core context provides them,
  but they must not become the default shot input style source.

### 9. Update Documentation

Update:

- `docs/architecture/reference/media-generation.md`;
- `docs/cli/commands.md` if command examples include shot input spec JSON;
- any accepted decision doc only if the implementation creates a new durable
  architectural rule that should outlive this plan.

Documentation must distinguish:

- `scene.storyboard-sheet`: default style source is selected Storyboard Lookbook
  sheet;
- shot input images: default style source is selected Movie Lookbook sheet;
- shot input images with `storyboard-lookbook` reference mode: explicit
  user-requested hand-drawn/storyboard aesthetics.

## Agent Behavior Rules

Agents should use these rules after this plan is implemented:

1. For ordinary shot input image requests, create specs with
   `referenceMode: 'movie-lookbook'`.
2. Use `referenceMode: 'storyboard-lookbook'` only when the user explicitly asks
   for storyboard, hand-drawn, drawn panels, sketch, animatic, or Storyboard
   Lookbook aesthetics.
3. Do not infer storyboard mode merely because a Storyboard Lookbook exists or
   a scene storyboard sheet exists.
4. Do not infer Movie Lookbook, Location Sheet, or Character Sheet image paths
   from filenames.
5. If Core reports missing required references, stop and explain the missing
   relationship. Do not create a text-only substitute unless the user explicitly
   accepts that weaker route.
6. If using Codex built-in image generation and the active image tool cannot
   accept image inputs, tell the user that actual selected sheets cannot be used
   as image references through that path.
7. A panelled layout does not imply storyboard aesthetics. The prompt sheet may
   have panels while still rendering frames in the movie's cinematic look.

## Example Spec Shapes

Default first-frame movie lookbook mode:

```json
{
  "purpose": "shot.first-frame",
  "target": {
    "kind": "sceneShotVideoTake",
    "id": "scene_shot_video_take_example",
    "sceneId": "scene_example",
    "takeId": "take_example",
    "shotIds": ["shot_001"]
  },
  "dependencyKind": "first-frame",
  "outputInputKind": "first-frame",
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "referenceMode": "movie-lookbook",
  "prompt": "Create the first frame for shot_001 using the selected Movie Lookbook, Character Sheet, and Location Sheet references...",
  "parameterValues": {
    "image_size": "landscape_16_9",
    "detail": "high",
    "output_format": "png"
  },
  "title": "Shot 001 First Frame"
}
```

Default video prompt sheet movie lookbook mode:

```json
{
  "purpose": "shot.video-prompt-sheet",
  "target": {
    "kind": "sceneShotVideoTake",
    "id": "scene_shot_video_take_example",
    "sceneId": "scene_example",
    "takeId": "take_example",
    "shotIds": ["shot_001", "shot_002"]
  },
  "dependencyKind": "video-prompt-sheet",
  "outputInputKind": "video-prompt-sheet",
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "referenceMode": "movie-lookbook",
  "prompt": "Create one readable video prompt sheet for this existing Shot Video Take...",
  "parameterValues": {
    "image_size": "landscape_16_9",
    "detail": "high",
    "output_format": "png"
  },
  "title": "Shot Video Prompt Sheet"
}
```

Explicit storyboard lookbook mode:

```json
{
  "purpose": "shot.video-prompt-sheet",
  "target": {
    "kind": "sceneShotVideoTake",
    "id": "scene_shot_video_take_example",
    "sceneId": "scene_example",
    "takeId": "take_example",
    "shotIds": ["shot_001", "shot_002"]
  },
  "dependencyKind": "video-prompt-sheet",
  "outputInputKind": "video-prompt-sheet",
  "modelChoice": "fal-ai/nano-banana-2",
  "referenceMode": "storyboard-lookbook",
  "prompt": "Create one readable video prompt sheet for this existing Shot Video Take in the selected Storyboard Lookbook's hand-drawn aesthetic...",
  "parameterValues": {
    "image_size": "landscape_16_9",
    "detail": "standard",
    "output_format": "png"
  },
  "title": "Storyboard-Style Video Prompt Sheet"
}
```

## Implementation Slices

### Slice 1: Contract And Validation

- Add `ShotVideoInputReferenceMode`.
- Add `referenceMode` to shot input image specs and dependency drafts.
- Update client JSON schema validation.
- Update normalization to require the field for all shot input image purposes.
- Add focused validation tests.

### Slice 2: Reference Resolution

- Add the shot input reference bundle resolver.
- Resolve Movie Lookbook sheet, Storyboard Lookbook sheet, selected Character
  Sheets, and selected Location Sheets through existing Core selectors.
- Honor existing reference inclusion overrides.
- Add structured missing-reference diagnostics.
- Add focused resolver tests for continuous and multi-cut takes.

### Slice 3: Dependency Declarations

- Add shot input image dependency declarations.
- Wire them through `purpose-registry`.
- Ensure dependency planning reports missing Movie Lookbook sheet, Storyboard
  Lookbook sheet, Character Sheet, and Location Sheet references correctly.
- Add tests for missing and available dependencies.

### Slice 4: Provider Payloads

- Pass context/reference bundle into shot input provider payload construction.
- Map base image model choices to edit/reference provider routes when references
  exist.
- Add `inputFiles` for every reference image.
- Add provider payload tests for GPT Image 2, Nano Banana 2, and Grok Imagine
  where supported.

### Slice 5: Drafts, Estimates, And Runs

- Update dependency draft generation to set the default `movie-lookbook`
  reference mode.
- Ensure estimate and run preparation use identical payload construction.
- Update approval summaries if they show request mode or input file counts.
- Add focused estimate/prepare tests without running paid generation.

### Slice 6: Agent Skills And Docs

- Update `studio-skills` guidance for prompt sheets, first/last frames, and
  reference images.
- Update `media-generation.md`.
- Update CLI examples.
- Add clear wording for the explicit storyboard override.

## Test Strategy

Focused Core tests should prove:

- default shot input draft specs use `referenceMode: 'movie-lookbook'`;
- hand-written shot input specs without `referenceMode` fail validation;
- Movie mode resolves the active Movie Lookbook sheet;
- Movie mode does not use the selected Storyboard Lookbook sheet;
- Storyboard mode resolves the selected Storyboard Lookbook sheet;
- Storyboard mode still resolves selected Character Sheets and Location Sheets;
- first-frame, last-frame, reference-image, and video-prompt-sheet provider
  payloads all include selected reference images when available;
- selected-only Character Sheet and Location Sheet dependencies do not fall back
  to arbitrary assets;
- invalid selected references are reported through existing authoring
  validation;
- missing required shot input references produce structured diagnostics;
- provider payloads include `image_urls` and `inputFiles` in the expected order;
- provider payloads use the edit/reference provider route when references
  exist;
- estimate and run preparation use the same request mode and input files.

Focused CLI tests should prove:

- `generation spec validate` accepts the new default shot input spec shape;
- `generation spec validate` accepts explicit storyboard mode only when the
  selected Storyboard Lookbook sheet is available;
- `generation estimate` reports missing references without paid generation;
- command docs examples match the accepted JSON shape.

Skill/docs verification should prove:

- default wording says Movie Lookbook, not Storyboard Lookbook;
- explicit storyboard wording is opt-in;
- Codex/external image generation limitations are disclosed when actual image
  references cannot be supplied.

## Completion Checklist

### Review Area

- [x] Confirm this plan broadens the `0094` prompt-sheet reference gap into a
      shared shot input image conditioning contract.
- [x] Confirm `shot.first-frame`, `shot.last-frame`, `shot.reference-image`, and
      `shot.video-prompt-sheet` remain take-owned shot input purposes.
- [x] Confirm `scene.storyboard-sheet` remains the only purpose whose default
      style source is the selected Storyboard Lookbook.
- [x] Confirm default shot input image style source is the selected Movie
      Lookbook.
- [x] Confirm explicit storyboard mode is opt-in only.
- [x] Confirm no sample project, filename, newest-asset, or path-based
      selection rule is introduced.
- [x] Confirm no paid generation is required for verification.

### Architecture And Contracts

- [x] Add `ShotVideoInputReferenceMode` to the client contract.
- [x] Add `referenceMode` to shot input image spec validation.
- [x] Add `referenceMode` to shot input dependency drafts.
- [x] Reject missing `referenceMode` for shot input image specs.
- [x] Keep base image model choices unchanged.
- [x] Route reference-conditioned shot input payloads to provider edit routes
      inside Core.
- [x] Do not add Studio, CLI, or skill-local reference selection rules.
- [x] Do not add compatibility aliases or old-shape repair paths.
- [x] Use structured Core diagnostics for missing or invalid references.

### Reference Resolution

- [x] Add `shot-input-references.ts` or an equivalently focused Core module.
- [x] Resolve Movie Lookbook sheet for `movie-lookbook` mode.
- [x] Resolve Storyboard Lookbook sheet for `storyboard-lookbook` mode.
- [x] Resolve selected Location Sheet references for selected take locations.
- [x] Resolve selected Character Sheet references for selected non-voiceover
      cast members.
- [x] Honor existing dependency inclusion overrides.
- [x] Prevent required references from being excluded.
- [x] Fail fast when required reference files are missing.
- [x] Enforce provider reference-image count limits without silently dropping
      references.

### Dependency Planning

- [x] Add shot input image dependency declarations in Core.
- [x] Wire declarations into the first-frame, last-frame, reference-image, and
      video-prompt-sheet purpose registry entries.
- [x] Mark the Movie Lookbook sheet as required in default movie mode.
- [x] Mark the Storyboard Lookbook sheet as required in explicit storyboard
      mode.
- [x] Surface selected-only missing Character Sheets as missing dependencies,
      not arbitrary fallbacks.
- [x] Surface selected-only missing Location Sheets as missing dependencies, not
      arbitrary fallbacks.
- [x] Preserve stable dependency ids for existing inclusion controls.

### Provider Payloads

- [x] Pass context/reference bundle into shot input provider payload creation.
- [x] Update first-frame, last-frame, reference-image, and video-prompt-sheet
      payloads to use reference conditioning.
- [x] Use `openai/gpt-image-2/edit` for GPT Image 2 shot input images with
      references.
- [x] Use `nano-banana-2/edit` for Nano Banana 2 shot input images with
      references.
- [x] Use `xai/grok-imagine-image/edit` only where current schema support is
      valid.
- [x] Add `image_urls` and matching `inputFiles` for reference images.
- [x] Keep the primary style reference first in the provider image array.
- [x] Include continuity references after the primary style reference.
- [x] Ensure estimate and run preparation produce the same provider request.

### CLI And Agent Surfaces

- [x] Update shot input spec examples to include `referenceMode`.
- [x] Update dependency draft materialization to default to `movie-lookbook`.
- [x] Update CLI validation tests for default and storyboard modes.
- [x] Update `media-producer` prompt-sheet guidance in `studio-skills`.
- [x] Update `media-producer` first/last frame guidance in `studio-skills`.
- [x] Update `media-producer` reference-image guidance in `studio-skills`.
- [x] Update `shot-video-take` skill guidance in `studio-skills`.
- [x] Update `movie-director` handoff guidance if it mentions prompt sheets.
- [x] State that Codex built-in image generation may be text-only when the
      harness cannot accept image references.
- [x] State that Storyboard Lookbook mode requires explicit user direction.

### Documentation

- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Update `docs/cli/commands.md` examples where relevant.
- [x] Add or update an accepted decision only if implementation creates a new
      durable rule beyond this plan.
- [x] Document the difference between default shot input movie mode and explicit
      storyboard mode.
- [x] Document that selected Location Sheets and Character Sheets come from take
      reference selections.

### Tests

- [x] Add Core validation tests for `referenceMode`.
- [x] Add Core resolver tests for movie mode.
- [x] Add Core resolver tests for storyboard mode.
- [x] Add Core tests proving Storyboard Lookbook is not used by default.
- [x] Add Core tests proving selected-only character/location references do not
      fall back to arbitrary assets.
- [x] Add provider payload tests for referenced first frames, last frames,
      reference images, and prompt sheets.
- [x] Add estimate/prepare tests proving request mode and input files match.
- [x] Add CLI tests for shot input spec validation and estimate diagnostics.
- [x] Run focused `packages/core` tests.
- [x] Run focused `packages/cli` tests if CLI examples or validation paths
      change.
- [x] Run focused type-checks for touched packages.
- [x] Run focused lint for touched packages.

### Final Verification

- [x] Verify default first-frame, last-frame, reference-image, and prompt-sheet
      specs resolve Movie Lookbook, Location Sheet, and Character Sheet image
      files.
- [x] Verify default shot input specs do not resolve the selected Storyboard
      Lookbook sheet.
- [x] Verify an explicit storyboard shot input spec resolves the selected
      Storyboard Lookbook sheet.
- [x] Verify missing Movie Lookbook sheet produces a structured diagnostic.
- [x] Verify missing selected Location Sheet or Character Sheet references are
      reported instead of guessed.
- [x] Verify docs and skills tell agents not to wing reference selection.
- [x] Verify implementation report clearly states no paid media generation was
      run.
