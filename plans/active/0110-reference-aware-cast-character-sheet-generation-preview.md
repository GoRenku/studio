# 0110 Reference-Aware Cast Character Sheet Generation Preview

Status: implemented in current slice
Date: 2026-07-05

## Implementation Status

Implemented on 2026-07-05:

- Core reference-aware `cast.character-sheet` specs, dependency kind/slots,
  multiple image input payloads, spec-backed preview construction, and
  reference inclusion updates.
- Follow-up correction: arbitrary project images can now be imported as generic
  `reference.image` media attached to an asset target, then selected as
  `cast-reference-image` dependency options when attached to the relevant Cast
  Member.
- CLI `renku generation preview show --spec <spec-id>` delivery path.
- CLI `renku media import --purpose reference.image` path for user
  supplied project images such as `research/helmet.jpg`.
- Studio generation preview PATCH route, projected refreshed preview response,
  and editable include/exclude controls in the existing preview dialog.
- Skills guidance for reference-conditioned character sheets, multiple
  references, no local composites, no built-in Codex imagegen when real
  references need to be supplied, and the generic `reference.image` import
  route.

Verified with focused Core, CLI, and Studio test runs listed in the final
implementation notes. The completion checklist below is now updated as the
implementation ledger: checked items landed in this slice, and unchecked items
are explicit follow-up verification or coverage gaps.

## Summary

Add reference-aware generation for `cast.character-sheet` so character sheet
creation preserves continuity from existing character sheets and user-provided
reference images.

This changes the previous skills-only direction from
`0109-lean-cast-character-sheet-skill-guidance.md`. The lean sheet layout is
still agent-owned guidance, but the workflow now needs product support for
reference selection, preview, and provider input handling:

- Existing character sheets for the same Cast Member must be offered as
  continuity references for subsequent character sheet generation.
- User-collected cast references, such as accessory images, historical
  wardrobe references, or Wikipedia images, must be selectable as separate
  image references.
- GPT Image 2, Nano Banana, and other reference-capable image models must
  receive multiple image references as separate inputs, not as one
  ImageMagick-stitched contact sheet.
- The generation preview dialog used for shot takes should become the shared
  review surface for image generation previews, showing prompt, references,
  settings, model, sanitized provider payload, cost estimate, and diagnostics.
- Skill instructions must explicitly tell agents not to use built-in Codex
  image generation when references are needed, and not to confuse
  reference-conditioned creation with editing a single source image.

The implementation must keep AI artifacts opaque. Studio may validate and edit
the reference envelope it owns, but it must not inspect whether the generated
sheet visually contains a face close-up, ruler, accessories, text, or any other
creative content.

## References Reviewed

- `plans/active/0109-lean-cast-character-sheet-skill-guidance.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `packages/core/src/client/cast-media-generation.ts`
- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/client/media-generation-dependency.ts`
- `packages/core/src/client/media-generation-lifecycle.ts`
- `packages/core/src/client/media-generation-target.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet.ts`
- `packages/core/src/server/media-generation/purposes/cast-character-sheet-dependency-slots.ts`
- `packages/core/src/server/media-generation/purposes/cast-profile.ts`
- `packages/core/src/server/media-generation/purposes/cast-image-common.ts`
- `packages/core/src/server/media-generation/dependencies/dependency-slot-definitions.ts`
- `packages/core/src/server/media-generation/dependencies/dependency-kind-registry.ts`
- `packages/core/src/server/media-generation/dependencies/dependency-selectors.ts`
- `packages/core/src/server/media-generation/dependencies/dependency-identifiers.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/planning/dependency-slots.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/planning/reference-inclusions.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/planning/shot-input-references.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/generation-preview/projection.ts`
- `packages/engines/src/generation/contracts.ts`
- `packages/engines/src/generation/execution/input-file-payload.ts`
- `packages/engines/src/generation/execution/logical-provider-payload.ts`
- `packages/engines/src/generation/execution/runner.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/cli/src/commands/asset-command.ts`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/studio/src/services/studio-shot-video-takes-api.ts`
- `packages/studio/server/routes/screenplay.ts`
- `packages/studio/server/http/scene-shot-video-take-production-request.ts`
- `packages/studio/src/features/movie-studio/cast/cast-member-assets.ts`
- `packages/studio/src/features/movie-studio/cast/cast-member-assets-tab.tsx`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/SKILL.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/cast-character-sheet.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/references/character-images.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/samples/cast-character-sheet-spec.json`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/casting-director/references/cast-media-handoff.md`

## Current Behavior

`cast.character-sheet` is currently a text-to-image purpose:

- `CastCharacterSheetGenerationSpec` has prompt, model choice, image controls,
  and title, but no reference selection state.
- `buildCastCharacterSheetProviderPayload` sends only text-to-image payloads
  for GPT Image 2, Nano Banana, and Grok Imagine.
- `cast-character-sheet-dependency-slots.ts` declares no dependencies.
- `buildCastCharacterSheetContext` already exposes selected cast assets,
  character sheet takes, profile takes, and image file references, so the raw
  continuity material is available.
- `cast.profile` already has a single `sourceAssetId` edit flow. That is useful
  as a contrast, but it is not the right model for character sheet continuity:
  an existing character sheet should be a reference, not the edited canvas.

Shot video generation already has the shape this work should reuse:

- Shot references are declared as dependency slots and resolved to logical
  project assets/files.
- Optional references use inclusion overrides, while required references cannot
  be excluded.
- Provider payloads pass reference arrays such as `image_urls` using separate
  `renku-input://...` logical inputs.
- The engine runner and logical payload builder already support multiple
  `inputFiles` entries targeting the same array field with `asArray: true`.

The current generation preview dialog is useful but incomplete for this flow:

- It is shot-only in Core validation and subject projection.
- It is read-only in Studio.
- It shows `selected` badges for references but cannot include or exclude them.
- The CLI only supports `generation preview show --file`, so editable previews
  have no durable spec identity to mutate.

## Problems To Fix

### Agents Use The Wrong Image Path

When references are needed, built-in Codex image generation is the wrong tool
for Renku Studio character sheet continuity. It cannot be relied on to preserve
project-native reference identity, provider settings, cost approval, receipts,
or multiple separate image inputs through the Renku generation pipeline.

Agents need a hard instruction:

- If an existing character sheet or user-provided reference must condition the
  result, do not use built-in Codex imagegen.
- Use Renku managed generation with project assets as references.

### Agents May Collapse Multiple References Into One Image

The agent previously assumed only one image reference could be supplied, then
used ImageMagick to combine references into a single image. That loses provider
semantics and makes the model treat a contact sheet as one image rather than
multiple references.

Renku already has the correct engine-level primitive: multiple `inputFiles`
can target the same provider array field. The cast-sheet purpose needs to use
that primitive directly.

### Edit And Reference-Conditioned Creation Are Being Confused

`cast.profile` edit models use a source image as the base to modify. Character
sheet continuity is different: the model should create a new character sheet
while using existing sheets and ad hoc images as references.

The user-facing and agent-facing name for this mode should be
`reference-to-image`, even when a provider happens to expose the underlying
endpoint under an `/edit` model id.

### Users Cannot Review Or Adjust References Before Generation

Shot takes have a strong preview pattern: show the prompt, references, model,
settings, provider payload, and issues before generation. Character sheet
generation needs the same pattern, with editable reference inclusion controls.

The user should see:

- all existing character sheet continuity references for the Cast Member;
- all relevant ad hoc cast reference images;
- which references are currently included;
- model and provider settings;
- the final prompt and sanitized provider payload;
- diagnostics and cost information.

They should be able to include or exclude optional references before the agent
runs the spec.

## Target Behavior

### First Character Sheet

If no existing character sheet exists for the Cast Member:

- The agent may create a reference-free `cast.character-sheet` spec.
- The preview still opens and shows prompt, model, settings, and empty or
  optional references.
- Built-in Codex imagegen remains inappropriate for normal Studio generation
  unless the user explicitly asks for an external throwaway image outside the
  Renku managed workflow.

### Subsequent Character Sheets

If one or more existing character sheets exist for the Cast Member:

- They are listed as character sheet continuity references.
- They default to included for a new character sheet preview.
- The user can exclude one or more before generation.
- Included references are passed as separate provider image inputs.

### Ad Hoc Cast References

User-collected images should be attached to the Cast Member as ordinary project
assets with:

- `target: { kind: 'castMember', castMemberId }`
- `type: 'reference_image'`
- `role: 'reference'`
- `mediaKind: 'image'`
- `fileRole: 'primary'`

These assets become optional cast reference image candidates for character
sheet generation. They default to excluded unless the agent or user includes
them.

This avoids misusing `cast.character-sheet` import for raw reference material.
`cast.character-sheet` remains for finished sheet assets only.

## Architecture Decisions

### 1. Keep Visual Sheet Content Agent-Owned

Core, CLI, Studio, and Engines must not validate sheet internals such as:

- five views;
- front-facing face close-up;
- above-shoulder crop;
- height ruler;
- synopsis text;
- accessory cells;
- readable labels;
- character likeness quality.

Those remain in skill instructions, examples, user review, and optional agent
QA.

### 2. Add Slot-Backed Cast Sheet Reference Selection

Add a cast-specific reference selection model for `cast.character-sheet` specs:

```ts
export interface CastCharacterSheetReferenceSelections {
  dependencyInclusions: Record<string, 'include' | 'exclude'>;
}
```

Add this optional field to `CastCharacterSheetGenerationSpec`:

```ts
referenceSelections?: CastCharacterSheetReferenceSelections;
```

The default behavior is owned by Core dependency slots:

- existing character sheet references default to included;
- ad hoc cast reference images default to excluded;
- explicit inclusion overrides can include or exclude optional references.

This mirrors shot take `dependencyInclusions` without putting reference state
in React-only UI.

### 3. Add A Cast Reference Image Dependency Kind

Keep the existing `cast-character-sheet` dependency kind for finished sheet
continuity references.

Add a new dependency kind for ad hoc cast references:

```ts
type MediaGenerationDependencyKind =
  | ...
  | 'cast-reference-image';
```

Register it as:

- `mediaKind: 'image'`
- `cardinality: 'one'`
- `assetSelector: 'cast-reference-image'`
- `missingInputBehavior: 'require-attachment'`

Add `castReferenceImageDependencySlot(input)` beside
`castCharacterSheetDependencySlot(input)`.

The selector should use:

- target: the Cast Member;
- role: `reference`;
- mediaKind: `image`;
- fileRole: `primary`;
- asset id when declaring a specific candidate.

### 4. Resolve References From Project Assets

Add a Core resolver for character sheet reference options:

```ts
resolveCastCharacterSheetReferenceOptions(input): CastCharacterSheetReferenceOption[]
```

Each option should contain:

- `dependencyId`;
- `dependencyKind`;
- `label`;
- `assetId`;
- `assetFileId`;
- `projectRelativePath`;
- `referenceRole`;
- `required`;
- `defaultIncluded`;
- `inclusionOverride`;
- `included`.

Suggested `referenceRole` values:

- `character-sheet-continuity`
- `cast-reference-image`

These names describe the reference relationship, not image contents.

### 5. Use Reference-To-Image Mode For Reference-Conditioned Sheets

Extend Core's `PreparedMediaGeneration` policy mode union to include the
engine-supported `reference-to-image` mode.

For `cast.character-sheet`:

- no included references: keep `mode: 'text-to-image'`;
- one or more included references: use `mode: 'reference-to-image'`.

Provider model mapping may still call provider edit endpoints internally:

- `fal-ai/openai/gpt-image-2` with references -> `openai/gpt-image-2/edit`;
- `fal-ai/nano-banana-2` with references -> `nano-banana-2/edit`;
- `fal-ai/xai/grok-imagine-image` with references -> `xai/grok-imagine-image/edit`,
  subject to its reference and parameter limits.

The Studio preview should label the execution path as reference-conditioned
creation, not as editing a source image.

### 6. Pass Multiple References As Separate Inputs

For selected references, build provider payloads with separate logical inputs:

```ts
payload.image_urls = selectedReferences.map((reference) =>
  `renku-input://${encodeURI(reference.projectRelativePath)}`
);
```

Add matching `inputFiles` entries:

```ts
selectedReferences.map((reference) => ({
  field: 'image_urls',
  projectRelativePath: reference.projectRelativePath,
  mediaKind: 'image',
  asArray: true,
  required: false,
}))
```

Do not create composite reference images. Do not use ImageMagick as a workaround
for model input limits. If a provider has a real maximum reference count,
validate the count and return a structured error.

### 7. Generalize Generation Preview Beyond Shots

Extend `GenerationPreviewPurpose` with:

```ts
| 'cast.character-sheet'
```

Change `GenerationPreviewRequest.target` from `SceneShotVideoTakeTarget` to
`MediaGenerationTarget`, with validation that accepts:

- `sceneShotVideoTake` for existing shot preview purposes;
- `castMember` for `cast.character-sheet`.

Add:

```ts
generationSpecId?: string;
```

to the preview envelope. File-based previews without `generationSpecId` remain
read-only. Spec-backed previews are editable.

Extend preview references with slot-backed selection metadata:

```ts
export interface GenerationPreviewReferenceSelectionControl {
  dependencyId: string;
  required: boolean;
  defaultIncluded: boolean;
  inclusionOverride: 'include' | 'exclude' | null;
  editable: boolean;
}
```

Add `selectionControl?: GenerationPreviewReferenceSelectionControl` to each
preview reference shape. `selected` remains the resolved inclusion state.

### 8. Build Spec-Backed Cast Preview Snapshots In Core

Add a Core preview builder for media generation specs:

```ts
buildMediaGenerationPreviewForSpec(input: {
  projectName?: string;
  homeDir?: string;
  specId: string;
}): Promise<GenerationPreviewRequest>
```

For `cast.character-sheet`, it should:

- read the persisted spec;
- prepare or validate the spec;
- resolve cast reference options;
- include all current character sheet and cast reference image options;
- mark selected references using `referenceSelections`;
- include only selected references in sanitized provider preview payload;
- include model/provider/mode/configuration/estimate/diagnostics;
- include `generationSpecId`.

This should be purpose-owned in Core, not assembled in CLI or Studio routes.

### 9. Add A Spec-Backed Preview CLI Path

Extend the CLI:

```bash
renku generation preview show --spec <media-generation-spec-id> --json
```

Behavior:

- Build the preview snapshot from the persisted spec.
- Deliver it to Studio through the existing notification path.
- Return the same delivery report shape as `--file`.

Keep `--file` for external preview snapshots. `--file` previews should remain
read-only because Studio has no durable spec to mutate.

### 10. Add A Cast Sheet Reference Selection Mutation

Add a Core command:

```ts
updateCastCharacterSheetReferenceInclusion(input: {
  projectName?: string;
  homeDir?: string;
  specId: string;
  dependencyId: string;
  inclusion: 'include' | 'exclude' | null;
}): Promise<GenerationPreviewRequest>
```

Responsibilities:

- Read the persisted spec.
- Assert purpose is `cast.character-sheet`.
- Resolve current reference options.
- Reject unknown dependency ids with a structured error.
- Reject excluding a required reference if future models introduce required
  references.
- Persist `spec.referenceSelections.dependencyInclusions`.
- Return a refreshed preview snapshot.

Add a thin Studio server route:

```http
PATCH /studio-api/projects/:projectName/generation/specs/:specId/reference-inclusions
```

Request:

```json
{
  "dependencyId": "cast-character-sheet:cast_123:asset_456",
  "inclusion": "exclude"
}
```

Response:

```json
{
  "preview": { "...": "refreshed StudioGenerationPreview" },
  "resourceKeys": ["..."]
}
```

The route must only read HTTP params/body, call Core, project the preview for
Studio, and serialize the result.

### 11. Reuse The Generation Preview Dialog UI

Keep `GenerationPreviewDialogHost` as the shared shell.

Changes:

- Add `cast.character-sheet` to the purpose label.
- Add cast subject labels from `buildGenerationPreviewSubject`.
- Preserve the existing tabs: Prompt, References, Config, Issues.
- In the References tab, render editable include/exclude controls when
  `generationSpecId` and `selectionControl.editable` are present.
- Use existing local shadcn-style controls only. Do not add raw HTML controls.
- When a reference toggle succeeds, replace local preview state with the
  refreshed preview returned by the server.
- Keep file-based previews read-only.

The dialog should not run generation. It only lets the user inspect and adjust
the pending request. The agent still runs the approved spec through the CLI.

## CLI And Agent Workflow

### Recommended Agent Flow

1. Run context:

   ```bash
   renku generation context --purpose cast.character-sheet --target cast:<cast-member-id> --json
   ```

2. If reference images are needed, ensure they are project assets:

   - finished sheets: import with `--purpose cast.character-sheet`;
   - ad hoc images: register as Cast Member assets with
     `type=reference_image`, `role=reference`, `mediaKind=image`, and
     `fileRole=primary`.

3. Create or update a `cast.character-sheet` spec.

4. Show the spec-backed preview:

   ```bash
   renku generation preview show --spec <spec-id> --json
   ```

5. Wait for user review in Studio. If the user changes references, rerun the
   preview command if needed to confirm the final state.

6. Estimate and run the spec through Renku managed generation.

### Forbidden Agent Workarounds

Skill instructions must explicitly forbid:

- using built-in Codex imagegen when existing sheets or user references need to
  condition the output;
- using ImageMagick, screenshots, contact sheets, collages, or other composite
  images to collapse multiple references into one;
- storing local file paths, provider upload URLs, or temporary external URLs in
  generation preview references;
- treating an existing sheet as a `sourceAssetId` edit source for
  `cast.character-sheet`;
- importing raw user references as finished `cast.character-sheet` assets.

## Skill Instruction Changes

Update the `studio-skills` sister project after the Core/CLI/UI contracts are
implemented.

### `media-producer/SKILL.md`

Add a short cast-image generation guardrail:

- For `cast.character-sheet`, read
  `references/cast-character-sheet.md` before drafting prompts or choosing a
  generation route.
- If any existing sheet or user-supplied image reference should condition the
  output, use Renku managed generation and `generation preview show --spec`.
- Do not use built-in Codex imagegen for reference-conditioned character
  sheets.

### `media-producer/references/cast-character-sheet.md`

Add a Reference Handling section:

- Existing character sheets for the same Cast Member are continuity references
  and should be included by default for subsequent sheets.
- User-supplied accessory, costume, historical, or other image references must
  be attached as project assets and passed as separate references.
- Multiple references are supported by GPT Image 2, Nano Banana, and other
  reference-capable models; do not combine them into one image.
- `reference-to-image` means creating a new sheet from references.
  `image-edit` means editing one source image. Use the former for character
  sheet continuity.
- Always show the spec-backed Studio preview before running when references are
  present.

Keep the lean sheet prompt guidance from plan `0109`:

- front-facing face close-up above shoulders;
- synopsis/metadata below the face close-up;
- full-body front, back, left profile, right profile;
- visible height measure/ruler;
- optional accessory cells only when accessories are supplied or continuity
  critical.

### `media-producer/references/character-images.md`

Clarify routing:

- `cast.character-sheet` is the continuity sheet purpose.
- `cast.profile` edit models may use a single source character sheet.
- Reference-conditioned character sheet creation uses references, not
  `sourceAssetId`.

### `media-producer/samples/cast-character-sheet-spec.json`

Update the sample to include:

- a lean sheet prompt;
- `referenceSelections` example showing a character sheet continuity reference
  included and an ad hoc cast reference image excluded or included;
- no local paths or provider URLs.

### `casting-director/references/cast-media-handoff.md`

Add handoff language:

- Identify existing character sheets that should carry forward.
- List optional ad hoc references the user supplied.
- Preserve height as a binding prompt fact, but keep height/layout inspection
  advisory and agent-owned.

## Non-Goals

- Do not add runtime validation that character sheets visually contain the
  requested layout, labels, height ruler, close-up crop, or accessories.
- Do not add OCR, image parsing, visual scoring, panel detection, or model-sheet
  content validators.
- Do not introduce a Studio UI layout builder for character sheets in this
  slice.
- Do not add a `height` field to `CastMember` in this slice.
- Do not replace the existing shot take preview dialog with a separate cast-only
  dialog.
- Do not preserve obsolete spec shapes once the current contract is changed.
- Do not add compatibility aliases for old reference fields.
- Do not create contact-sheet or collage pre-processing for references.
- Do not run paid image generation as part of implementation verification.

## Implementation Plan

### Slice 1: Core Contracts

Update client contracts:

- Add `referenceSelections?: CastCharacterSheetReferenceSelections` to
  `CastCharacterSheetGenerationSpec`.
- Add `CastCharacterSheetReferenceSelections`.
- Add `supportsImageReferences` and `maxImageReferences` to
  `CastImageModelChoiceReport`.
- Add `reference-to-image` to Core `PreparedMediaGeneration` mode.
- Add `cast.character-sheet`, `generationSpecId`, and
  `selectionControl` support to generation preview types.
- Generalize preview target typing to `MediaGenerationTarget`.

### Slice 2: Core Dependency Slots And Reference Resolution

Update dependency infrastructure:

- Add `cast-reference-image` dependency kind and selector id.
- Add `castReferenceImageDependencyId`.
- Add `castReferenceImageDependencySlot`.
- Keep `castCharacterSheetDependencySlot` for finished sheet continuity.
- Implement cast character sheet reference option resolution.
- Use structured diagnostics for stale, missing, or invalid reference assets.

### Slice 3: Cast Character Sheet Provider Payloads

Update `cast-character-sheet.ts`:

- Resolve included references before provider payload construction.
- Use text-to-image payloads when no references are included.
- Use reference-to-image payloads when references are included.
- Map selected references to separate `image_urls` entries and matching
  `inputFiles`.
- Validate provider-specific reference limits.
- Include model report fields for reference support and limits.
- Keep `cast.profile` edit source behavior separate.

### Slice 4: Generation Preview Core Services

Add preview builders:

- `buildMediaGenerationPreviewForSpec`
- purpose-specific cast character sheet preview construction
- cast subject projection in `buildGenerationPreviewSubject`
- validation support for cast targets and purpose-specific prompt sheet
  metadata rules

Ensure provider payload preview stays sanitized:

- logical `renku-input://...` references are allowed;
- local paths and provider upload URLs remain forbidden.

### Slice 5: CLI

Update generation CLI:

- Add `generation preview show --spec <spec-id>`.
- Keep `generation preview show --file <path>` supported for read-only
  snapshots.
- Ensure `generation spec validate/create/update` accepts the new
  `referenceSelections` field.
- Confirm `generation run --spec` passes multiple image references as separate
  `inputFiles`.
- Update command help text.

### Slice 6: Studio Server

Add a thin generation spec reference route:

- Parse `dependencyId` and `inclusion`.
- Call Core `updateCastCharacterSheetReferenceInclusion`.
- Project the refreshed preview with browser URLs.
- Return the preview and resource keys.

Do not put purpose-specific reference rules in the route.

### Slice 7: Studio UI

Update `GenerationPreviewDialogHost`:

- Support `cast.character-sheet` purpose labels.
- Render cast subject metadata.
- Add reference include/exclude controls only for editable spec-backed
  references.
- Preserve read-only behavior for file previews and non-editable references.
- Show model mode as text-to-image, reference-to-image, image-edit, etc.
- Keep the existing tab layout and card pattern.

Add focused tests for:

- cast preview rendering;
- reference toggle calls;
- refreshed preview replacement;
- read-only file preview behavior.

### Slice 8: Skills

Update the `studio-skills` files listed above.

The skill changes should be concise and progressively disclosed:

- high-level guardrail in `SKILL.md`;
- operational details in `references/cast-character-sheet.md`;
- sample spec in `samples/`;
- handoff notes in casting director references.

## Completion Checklist

### Review Area

- [x] Confirm the scope change from plan `0109`: runtime work is needed for
      reference selection and preview, while visual sheet content remains
      skill-owned.
- [x] Confirm no Studio/Core validation parses or judges generated character
      sheet visual contents.
- [x] Confirm the workflow supports both first sheets and subsequent continuity
      sheets.
- [x] Confirm the workflow supports multiple existing sheet references.
- [x] Confirm the workflow supports ad hoc user-collected image references.

### Architecture And Contracts

- [x] Add `CastCharacterSheetReferenceSelections` to Core client contracts.
- [x] Add `referenceSelections` to `CastCharacterSheetGenerationSpec`.
- [x] Add `reference-to-image` to Core prepared generation policy mode.
- [x] Add image-reference capability fields to cast image model reports.
- [x] Add `cast-reference-image` dependency kind.
- [x] Add `cast-reference-image` selector id.
- [x] Add cast reference image dependency identifier helpers.
- [x] Add cast reference image dependency slot helper.
- [x] Add generic `reference.image` media import purpose for arbitrary project
      reference images.
- [x] Expose Core-owned generic reference image import through
      ProjectDataService.
- [x] Keep `reference.image` target-agnostic across project, cast, location,
      sequence, and scene asset targets.
- [x] Keep existing `cast-character-sheet` dependency semantics for finished
      sheet continuity.
- [x] Make `cast.character-sheet` generation independent from active Movie
      Lookbook presence.
- [x] Generalize generation preview target typing to `MediaGenerationTarget`.
- [x] Add `cast.character-sheet` generation preview purpose.
- [x] Add `generationSpecId` to spec-backed generation previews.
- [x] Add preview reference `selectionControl` metadata.
- [x] Ensure preview validation remains envelope-only.

### Core Implementation

- [x] Implement cast character sheet reference option resolution.
- [x] Include finished character sheets as continuity reference options.
- [x] Include Cast Member assets with `role: reference` as ad hoc reference
      options.
- [x] Default existing sheet continuity references to included.
- [x] Default ad hoc cast reference images to excluded.
- [x] Apply `referenceSelections.dependencyInclusions` consistently.
- [x] Validate stale dependency ids with structured diagnostics.
- [x] Reject invalid asset/file references with structured diagnostics.
- [x] Build text-to-image cast sheet payloads when no references are included.
- [x] Build reference-to-image cast sheet payloads when references are included.
- [x] Pass each selected image as a separate `image_urls` `inputFiles` entry.
- [x] Validate provider-specific reference limits.
- [x] Preserve separate `cast.profile` `sourceAssetId` edit behavior.
- [x] Add spec-backed `buildMediaGenerationPreview`.
- [x] Add cast character sheet preview construction.
- [x] Add cast subject labels to preview projection.
- [x] Add Core command to update cast character sheet reference inclusion.

### CLI

- [x] Add `renku generation preview show --spec <spec-id>`.
- [x] Add `renku media import --purpose reference.image`.
- [x] Parse `reference.image` targets through generic asset target syntax:
      `project`, `cast:<id>`, `location:<id>`, `sequence:<id>`, and
      `scene:<id>`.
- [x] Preserve `renku generation preview show --file <path>`.
- [x] Mark file previews read-only by omitting `generationSpecId`.
- [x] Ensure spec validate/create/update accept `referenceSelections`.
- [x] Ensure spec show/list output includes current reference selection state.
- [x] Ensure run/estimate paths account for selected reference input counts.
- [x] Update CLI help and unknown-command suggestions.
- [ ] Add CLI tests for multi-reference cast sheet specs.
- [x] Add CLI tests for spec-backed preview delivery.

### Studio Server

- [x] Add request reader for generation spec reference inclusion updates.
- [x] Add PATCH route for spec-backed reference inclusion updates.
- [x] Keep the route thin: params/body in, Core command, Studio projection out.
- [x] Return refreshed `StudioGenerationPreview`.
- [x] Return relevant resource keys.
- [ ] Add server route tests for success, unknown dependency, and read-only/file
      preview cases.

### Studio UI

- [x] Add cast character sheet purpose label.
- [x] Add cast subject display in preview header.
- [x] Render editable reference controls when `selectionControl.editable` is
      true.
- [x] Keep non-editable references read-only.
- [x] Disable or protect required references if future required refs exist.
- [x] Replace dialog state with refreshed preview after a toggle.
- [x] Show included/excluded state clearly.
- [x] Keep prompt/config/issues tabs from the existing dialog.
- [x] Use only local shadcn-style UI controls.
- [ ] Add React tests for editable cast references.
- [ ] Add React tests for read-only file previews.

### Skills

- [x] Update `media-producer/SKILL.md` with the reference-conditioned generation
      guardrail.
- [x] Update `media-producer/references/cast-character-sheet.md` with reference
      handling, multiple references, no built-in Codex imagegen when references
      are needed, no composites, and edit-vs-reference wording.
- [x] Preserve lean sheet layout guidance from plan `0109`.
- [x] Correct the sister skill docs to import arbitrary project images with
      `reference.image` before creating the character-sheet spec.
- [x] Update `media-producer/references/character-images.md`.
- [x] Update `media-producer/samples/cast-character-sheet-spec.json`.
- [x] Update `casting-director/references/cast-media-handoff.md`.
- [ ] Validate the changed skill files with the appropriate skill validation
      script if available.

### Verification

- [x] Run focused Core tests for cast character sheet references and preview.
- [x] Run focused Core architecture test after moving generic reference import
      off resource readers.
- [x] Run focused Core dependency inventory test after accounting for planned
      optional cast sheet lines in shot estimates.
- [x] Run focused CLI tests for generation preview/spec handling.
- [x] Run focused CLI tests for `reference.image` media import handling.
- [x] Run focused Studio tests for the preview dialog and server route.
- [x] Run the relevant package checks:
      `pnpm --dir packages/core test`,
      `pnpm --dir packages/cli test`, and
      `pnpm --filter @gorenku/studio test` as appropriate for touched files.
- [ ] Manually verify a simulated first-sheet spec has no required references.
- [ ] Manually verify a simulated subsequent-sheet spec includes existing
      character sheets as separate inputs.
- [ ] Manually verify a simulated ad hoc reference image can be included and
      excluded through the preview dialog.
- [x] Confirm no generated provider payload contains local filesystem paths or
      provider upload URLs.
- [x] Confirm no ImageMagick or composite-reference workaround appears in the
      skill instructions.
- [x] Confirm no runtime code validates generated image content.
