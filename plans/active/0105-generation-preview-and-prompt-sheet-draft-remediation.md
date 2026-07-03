# 0105 Generation Preview And Prompt-Sheet Draft Remediation

Status: completed
Date: 2026-07-03

## Summary

This plan covers the non-estimate review issues from the same slice:

- preserve prompt-sheet metadata when dependency drafts become runnable specs;
- resolve logical preview media references into Studio-safe browser URLs before
  publishing preview events;
- replace raw durable ids in the Generation Preview Dialog with meaningful
  domain labels, or omit the row when labels cannot be resolved.

The estimate architecture is intentionally handled separately in:

```text
plans/active/0104-generation-cost-estimate-architecture-reset.md
```

This plan must not reintroduce estimate/readiness coupling. Prompt-sheet
metadata is required for prepare/generate. It must not become a cost-estimate
requirement unless a future pricing function explicitly depends on it.

## References Reviewed

- `AGENTS.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `plans/active/0099-generation-preview-dialog-and-video-prompt-image-styles.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-draft-specs.ts`
- `packages/core/src/server/media-generation/shot-video-take/input-specs.ts`
- `packages/studio/server/routes/studio-events.ts`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/studio/src/app/use-studio-coordination.ts`

## Relationship To The Estimate Reset

The estimate reset says cost calculation must not require generation readiness.

This plan says readiness still needs to be correct.

For `shot.video-prompt-sheet`, that means:

- cost estimation should not fail because prompt-sheet metadata is missing;
- prepare/generate should fail when a runnable prompt-sheet spec is missing
  required prompt-sheet metadata;
- authored dependency drafts must carry the metadata through to the runnable
  draft spec so valid agent-authored work does not fail at prepare/generate.

Those statements are not in conflict. They describe two different rails.

## Current Failure Modes

### 1. Prompt-Sheet Metadata Is Dropped From Dependency Draft Specs

`agentProposal.dependencyDrafts[]` can contain a valid
`shot.video-prompt-sheet` draft with:

```json
{
  "purpose": "shot.video-prompt-sheet",
  "promptSheetVisualStyleId": "cinematic-realistic",
  "promptSheetNotationModeId": "motion-annotation"
}
```

But `buildShotInputDependencyDraftSpec` rebuilds the draft spec and currently
does not copy those two fields into the generated spec.

The resulting spec can look like:

```json
{
  "purpose": "shot.video-prompt-sheet",
  "prompt": "Create a motion-control prompt sheet.",
  "modelChoice": "fal-ai/openai/gpt-image-2",
  "referenceMode": "movie-lookbook"
}
```

That spec is not runnable because prompt-sheet metadata is required for
prepare/generate.

Expected behavior:

- if the authored draft is for `shot.video-prompt-sheet`, preserve
  `promptSheetVisualStyleId` and `promptSheetNotationModeId`;
- if the authored draft is for another shot input purpose, reject or omit those
  fields through the existing readiness validation;
- missing-input placeholder work must not pretend to be a runnable
  prompt-sheet spec.

### 2. Preview Events Publish Logical References Without Browser URLs

The CLI preview contract correctly uses logical references:

```json
{
  "kind": "image",
  "assetId": "asset_style",
  "assetFileId": "asset_file_style",
  "label": "Storyboard Lookbook Sheet"
}
```

Logical ids are the safe agent/CLI contract. They avoid local path leaks and
provider upload URL leaks.

The Studio browser, however, needs a Studio-safe URL to render media. Today the
server appends the preview unchanged, and the dialog renders images/videos only
when `reference.browserUrl` exists. A valid preview can therefore open with
reference cards that show labels but no visual media.

Expected behavior:

- CLI sends logical references only;
- core validates that previews do not contain local paths or provider upload
  URLs;
- before publishing the event, server/core projection resolves
  `assetId + assetFileId` to a Studio-safe file URL;
- the browser receives a display projection that can render reference media.

### 3. Dialog Header Shows Raw Durable Ids

The dialog currently renders:

```text
Take scene_shot_video_take_9s23m97d
Scene scene_abc123
shot_001
```

Those ids are useful for storage and debugging, but they are not meaningful
visible UI copy.

Expected behavior:

- the preview dialog shows labels such as `Scene 4`, `Shot 2`, `Shots 2-4`, or
  a take title when available;
- raw ids are not rendered as user-facing copy;
- if a useful label cannot be resolved, the row is omitted instead of filled
  with ids.

## Target Architecture

### Logical Preview Request And Studio Display Projection

Separate the agent/CLI notification contract from the browser display
projection.

Proposed names:

- `GenerationPreviewRequest`: logical, safe notification payload supplied by
  CLI/agents.
- `StudioGenerationPreview`: display-ready preview payload published to the
  browser event stream.

The request uses logical project references:

```ts
interface GenerationPreviewRequestReference {
  kind: 'image' | 'audio' | 'video';
  role: string;
  label: string;
  providerToken?: string;
  assetId: string;
  assetFileId: string;
  selected: boolean;
}
```

The Studio display projection uses resolved browser media:

```ts
interface StudioGenerationPreviewReference
  extends GenerationPreviewRequestReference {
  browserUrl: string;
}
```

The projection also includes meaningful subject labels:

```ts
interface StudioGenerationPreviewSubject {
  projectLabel: string;
  sceneLabel?: string;
  takeLabel?: string;
  shotLabel?: string;
}
```

Do not keep duplicate compatibility fields for old preview shapes. Update
callers, tests, samples, and skills directly.

### Core-Owned Reference Resolution

Core must own the project metadata rule:

```text
Does this asset file exist in this project, and is it safe to expose through a
Studio asset-file route?
```

Resolution should verify:

- `assetId` exists;
- `assetFileId` belongs to `assetId`;
- asset and asset file are not discarded;
- asset file has a project-relative path;
- media kind is compatible with the preview reference kind;
- the reference does not carry a local path, provider URL, or secret-bearing URL.

Core should return a route-neutral access descriptor, for example:

```ts
interface GenerationPreviewReferenceFileAccess {
  assetId: string;
  assetFileId: string;
  mediaKind: 'image' | 'audio' | 'video';
  projectRelativePath: string;
}
```

The Studio server may then convert that descriptor into a browser URL.

This keeps domain ownership in core while letting the HTTP adapter own URL
formatting.

### Studio-Safe Asset File URL

Prefer adding a generic Studio asset-file route for preview rendering:

```text
GET /studio-api/projects/:projectName/assets/:assetId/files/:assetFileId
```

The route should be thin:

```text
read params
call core asset-file read service
return file response
translate structured errors
```

Do not make the route decide whether the asset belongs to a Cast Member,
Location, Lookbook, scene, dialogue, take, or dependency slot. The route serves
a concrete project asset file by id.

Existing owner-specific routes can remain for their current UI surfaces, but
the preview projection should use the generic asset-file route so preview
delivery does not need owner-specific branching.

### Preview Projection Flow

The notification route should become:

```text
read HTTP body
validate notification envelope
call core/server projection to resolve preview for Studio
append studio.generationPreviewRequested event with StudioGenerationPreview
return event id and preview id
```

The route should not:

- loop through references and infer owners;
- build URLs from raw ids inline;
- decide which missing files are acceptable;
- patch preview data after validation with ad hoc fields.

### Missing Reference Files

Default behavior should fail fast.

If a preview reference names an `assetId + assetFileId` pair that cannot be
resolved, the notification should fail with a structured error such as:

```text
CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND
```

The event should not be published with a silently missing visual reference.

If the product later wants partial previews, that must be a named preview state
with UI copy and tests. It should not be introduced as a fallback in this
remediation.

### Meaningful Subject Labels

Core should resolve labels from project context:

- project label from `project.title` or project name;
- scene label from scene ordering or scene title where available;
- take label from take title when it is meaningful;
- shot label from Scene Shot List order, such as `Shot 1` or `Shots 1-3`.

Rules:

- never render raw scene ids, take ids, or shot ids as visible dialog copy;
- do not put ids in badges, subtitles, or fallback labels;
- omit a label if no meaningful label is available;
- keep ids available in diagnostics or debug logs only when needed, not in
  visible product copy.

### Prompt-Sheet Metadata Carry-Through

Introduce a small purpose-owned metadata function for prompt-sheet specs.

Suggested file:

```text
packages/core/src/server/media-generation/shot-video-take/prompt-sheet-metadata.ts
```

Responsibilities:

- read `promptSheetVisualStyleId` and `promptSheetNotationModeId` from a
  `shot.video-prompt-sheet` draft;
- copy them into generated prompt-sheet draft specs;
- validate them in the readiness rail;
- reject them on non-prompt-sheet shot input purposes through existing
  readiness validation.

Do not use this file from cost projection unless a future accepted pricing
function explicitly uses one of these fields as a pricing input.

Missing-input placeholder dependency lines should remain non-runnable. They
should not invent prompt-sheet metadata merely to satisfy prepare/generate,
because no generation should happen until the user or agent authors the
concrete draft.

## Public Contract Changes

### Generation Preview Contracts

Update browser-safe core contracts so the event published to Studio carries
display-ready references and subject labels.

Do not rely on optional `browserUrl` for references in the browser display
contract. The Studio event should either include resolved URLs or not be
published.

The CLI request contract may still forbid `browserUrl` entirely. That is the
cleanest way to prevent path leaks:

```text
CLI/agent request: logical ids only
Studio event projection: browser URLs only after server-side resolution
```

### Studio Coordination Event

`studio.generationPreviewRequested` should carry the Studio display projection,
not the raw CLI request.

This keeps the browser as a projection consumer and prevents React from
performing domain resolution.

### Tests And Samples

Update:

- CLI preview fixture tests;
- Studio event route tests;
- generation preview validation tests;
- Generation Preview Dialog tests;
- any sister Studio Skills preview samples.

Do not keep tests for the old mixed shape except where a validation test proves
the CLI request rejects unsafe `browserUrl` input.

## Implementation Slices

### Slice 1: Prompt-Sheet Draft Metadata Preservation

Update `buildShotInputDependencyDraftSpec` so authored prompt-sheet dependency
drafts preserve:

- `promptSheetVisualStyleId`;
- `promptSheetNotationModeId`.

Add focused tests:

- a valid prompt-sheet dependency draft produces a runnable draft spec with both
  metadata fields;
- non-prompt-sheet shot input drafts do not accept prompt-sheet metadata;
- missing-input prompt-sheet dependencies are not presented as runnable specs.

This slice can land independently of the preview work.

### Slice 2: Split Preview Request And Studio Projection Types

Introduce explicit types for:

- logical generation preview request;
- Studio generation preview display projection;
- resolved preview reference;
- preview subject labels.

Update validation so CLI/agent requests remain safe and logical.

Do not preserve old optional `browserUrl` behavior in the Studio event contract.

### Slice 3: Core Reference Resolution

Add a core/server projection function that resolves preview reference files.

Suggested name:

```ts
resolveGenerationPreviewReferenceFiles
```

It should accept:

```ts
{
  projectName?: string;
  homeDir?: string;
  preview: GenerationPreviewRequest;
}
```

It should return route-neutral file access descriptors and structured
diagnostics or structured errors for missing/invalid references.

### Slice 4: Subject Label Projection

Add core/server label projection for the preview target.

Suggested name:

```ts
buildGenerationPreviewSubject
```

It should load the relevant project, scene, shot list, and take context through
existing core services.

It should return only meaningful labels, not ids.

### Slice 5: Studio Browser URL Projection

Add a Studio server projection module that composes:

- validated request;
- core reference-file access descriptors;
- core subject labels;
- Studio API URL builder.

Suggested server module:

```text
packages/studio/server/projections/generation-preview.ts
```

The route calls this module once and appends the returned display projection.

### Slice 6: Generic Asset File Route

Add the generic asset-file route if no equivalent project-wide route exists:

```text
GET /studio-api/projects/:projectName/assets/:assetId/files/:assetFileId
```

Use the existing file-response helper and core asset-file read service.

Tests should cover:

- serving a valid image file;
- serving a valid video file;
- rejecting missing asset id;
- rejecting missing file id;
- rejecting discarded asset/file;
- not leaking absolute paths in the response body.

### Slice 7: Dialog Copy And Rendering

Update the Generation Preview Dialog so it renders subject labels from the
display projection.

Remove visible raw ids from the header.

Reference cards should assume selected display references have `browserUrl` and
render the media. If a future partial-preview state exists, it should be added
explicitly with UI copy and tests. Do not quietly fall back to label-only cards
for selected visual references in this slice.

### Slice 8: CLI, Skills, And Documentation

Update CLI fixtures and samples to use the logical request contract.

Update Studio Skills samples if they include preview JSON.

Update documentation describing generation preview delivery and reference
resolution.

## Completion Checklist

### Review Area

- [x] Prompt-sheet metadata preservation is treated as readiness/generation
      correctness, not estimate correctness.
- [x] Preview reference resolution happens before event publication.
- [x] Studio route handlers stay thin.
- [x] React consumes a display projection and does not resolve project assets.
- [x] Raw durable ids are not visible in the Generation Preview Dialog.

### Architecture And Contracts

- [x] Logical preview request and Studio preview display projection are
      separate contracts.
- [x] CLI/agent preview requests use logical `assetId` and `assetFileId`
      references only.
- [x] Studio preview events carry resolved browser URLs for display references.
- [x] Preview references reject local paths and provider upload URLs.
- [x] Core owns asset/file existence and media-kind resolution.
- [x] Studio server owns URL string formatting only.
- [x] A generic project asset-file route is added or an existing equivalent is
      documented and reused.
- [x] Subject labels are resolved by core/server projection, not React.
- [x] No compatibility wrapper preserves the old mixed preview shape.

### Prompt-Sheet Metadata

- [x] `buildShotInputDependencyDraftSpec` copies
      `promptSheetVisualStyleId` for `shot.video-prompt-sheet`.
- [x] `buildShotInputDependencyDraftSpec` copies
      `promptSheetNotationModeId` for `shot.video-prompt-sheet`.
- [x] Non-prompt-sheet shot input specs still reject prompt-sheet metadata.
- [x] Missing-input prompt-sheet dependencies are not treated as runnable specs.
- [x] Prompt-sheet metadata helpers are not imported by cost projection modules.

### Preview Reference Resolution

- [x] Core resolves `assetId + assetFileId` to a project asset-file access
      descriptor.
- [x] Core rejects missing assets with structured diagnostics.
- [x] Core rejects missing asset files with structured diagnostics.
- [x] Core rejects discarded assets/files with structured diagnostics.
- [x] Core rejects media-kind mismatches with structured diagnostics.
- [x] Studio projection converts access descriptors into browser URLs.
- [x] Published preview events include browser URLs for image, video, and audio
      references when the reference kind is visual/playable.
- [x] The event route appends only the resolved display projection.

### Dialog Copy

- [x] The dialog header renders project label from the projection.
- [x] The dialog header renders scene label only when meaningful.
- [x] The dialog header renders take label only when meaningful.
- [x] The dialog header renders shot label only when meaningful.
- [x] The dialog no longer renders `sceneId`.
- [x] The dialog no longer renders `takeId`.
- [x] The dialog no longer renders raw `shotIds`.
- [x] Tests prove raw ids from fixtures do not appear in visible text.

### Tests

- [x] Core prompt-sheet dependency draft tests cover metadata preservation.
- [x] Core preview validation tests cover logical request safety.
- [x] Core preview reference resolution tests cover missing and valid files.
- [x] Studio event route tests prove appended events contain resolved URLs.
- [x] Studio event route tests prove unresolved references reject delivery.
- [x] Studio asset-file route tests cover valid and invalid file requests.
- [x] Generation Preview Dialog tests cover media rendering from `browserUrl`.
- [x] Generation Preview Dialog tests cover meaningful labels and no raw ids.
- [x] CLI preview show tests are updated for the logical request contract.

### Documentation And Skills

- [x] `docs/architecture/reference/studio-coordination-events.md` describes
      logical preview requests and resolved Studio display events.
- [x] `docs/architecture/reference/media-generation.md` describes
      prompt-sheet metadata carry-through for dependency drafts.
- [x] Studio Skills preview samples are updated if they include old fields.
- [x] Any plan or doc that says preview references may include direct browser
      URLs is removed or corrected.

### Final Verification

- [x] Focused core prompt-sheet draft tests pass.
- [x] Focused core generation preview tests pass.
- [x] Focused Studio event route tests pass.
- [x] Focused Generation Preview Dialog tests pass.
- [x] Focused asset route tests pass if a route is added.
- [x] `pnpm build:core` passes.
- [x] `pnpm test:core` passes.
- [x] `pnpm test:studio` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm check` passes.
