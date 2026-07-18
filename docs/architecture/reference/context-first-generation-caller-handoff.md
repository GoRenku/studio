# Context-First Generation Caller Handoff

Date: 2026-07-12

Status: historical cutover evidence; superseded for Shot/Take callers by
Decision `0052`

Plan `0134` intentionally removed the old Core/Engines generation backend,
client contract families, broad `ProjectDataService` generation inventory,
Shot generation state APIs, purpose preview builders, and provider route layer.
The files below are the complete caller inventory found at the checkpoint.
Plan `0136` updated each surviving caller directly to the current generic or
focused Core contract, or deleted it when the capability itself was obsolete.
No compatibility export or temporary adapter was added.

## Direct Replacement Map

| Removed capability | Plan `0136` replacement |
| --- | --- |
| `MediaGenerationSpec`, purpose-specific spec unions, and model-choice unions | `GenerationSpec` plus the one purpose descriptor tree |
| purpose context/model methods on `ProjectDataService` | `buildGenerationContext`, `listGenerationModels`, and focused purpose context queries |
| `GenerationPreviewRequest` and purpose preview builders | `buildGenerationPreview` over the exact generic spec |
| purpose validate/estimate/run methods | `validateGenerationSpec`, `estimateGeneration`, and `runGeneration` |
| dependency slots, inventory, plans, recursive estimates, and preflight | purpose reference guides, exact selections, guide notices, and provider validation |
| Shot input mode/route/model mapping | direct provider/model endpoint and actual provider fields |
| Shot reference selection mutations in take state | generic spec reference selections whose presence means inclusion |
| Image Revision service contracts | the `image.edit` purpose through generic preview/estimate/run |
| purpose-specific import methods | focused domain attachment/import commands created in the owning purpose integration slice |
| singular generation Preview event | `studio.generationPreviewsRequested` with an ordered array of ordinary Preview resources |
| legacy take authoring/AI Production commands | Plan `0136` Shot purpose context plus generic spec commands; retain only focused take/media ownership operations |

## CLI Production Callers

- `packages/cli/src/commands/generation-command-handlers.ts`
- `packages/cli/src/commands/generation-command.ts`
- `packages/cli/src/commands/generation-purpose-command-registry.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/cli/src/commands/studio-notification-client.ts`
- `packages/cli/src/commands/take-command.ts`

## CLI Tests And Fixtures

- `packages/cli/src/commands/command-architecture.test.ts`
- `packages/cli/src/commands/generation-command-handlers.test.ts`
- `packages/cli/src/commands/media-import-command-handlers.test.ts`
- `packages/cli/src/commands/studio-command.test.ts`

## Studio Server Production Callers

- `packages/studio/server/http/scene-shot-direction-request.ts`
- `packages/studio/server/http/scene-shot-video-take-production-request.ts`
- `packages/studio/server/http/screenplay-responses.ts`
- `packages/studio/server/projections/generation-preview.ts`
- `packages/studio/server/projections/image-revision.ts`
- `packages/studio/server/routes/generation-preview.ts`
- `packages/studio/server/routes/image-revisions.ts`
- `packages/studio/server/routes/projects.ts`
- `packages/studio/server/routes/screenplay.ts`
- `packages/studio/server/routes/studio-events.ts`
- `packages/studio/server/routes/visual-language.ts`

## Studio Server Tests And Fixtures

- `packages/studio/server/architecture.test.ts`
- `packages/studio/server/routes/assets.test.ts`
- `packages/studio/server/routes/generation-preview.test.ts`
- `packages/studio/server/routes/screenplay-video-take-production.test.ts`
- `packages/studio/server/routes/studio-events.test.ts`
- `packages/studio/server/testing/fake-project-data-service.ts`

## Studio React And Service Production Callers

- `packages/studio/src/app/app.tsx`
- `packages/studio/src/app/use-studio-coordination.ts`
- `packages/studio/src/features/generation-preview/generation-preview-config-panel.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-diagnostics-banner.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-dialog.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-draft.ts`
- `packages/studio/src/features/generation-preview/generation-preview-estimate-footer.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-prompt-panel.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-reference-card.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-reference-grid.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-title.ts`
- `packages/studio/src/features/generation-preview/use-generation-preview-editor.ts`
- `packages/studio/src/features/generation-request-editor/generation-request-controls-panel.tsx`
- `packages/studio/src/features/generation-request-editor/generation-request-editor.tsx`
- `packages/studio/src/features/image-revision/use-image-revision-editor.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-input-mode-list.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-model-table.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-run-setup.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-dialogs-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-rail.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-reference-card.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-video-stage.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shots-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-takes-tab.tsx`
- `packages/studio/src/features/movie-studio/scenes/take-shot-design-context.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.ts`
- `packages/studio/src/features/movie-studio/scenes/use-take-shot-design.ts`
- `packages/studio/src/hooks/use-studio-resource-refresh.ts`
- `packages/studio/src/services/studio-current-contracts.ts`
- `packages/studio/src/services/studio-generation-preview-api.ts`
- `packages/studio/src/services/studio-image-revisions-api.ts`
- `packages/studio/src/services/studio-scene-dialogue-audio-api.ts`
- `packages/studio/src/services/studio-shot-video-takes-api.ts`

## Studio React, Service, And E2E Tests

- `packages/studio/src/features/generation-preview/generation-preview-dialog-host.e2e.test.tsx`
- `packages/studio/src/features/generation-preview/generation-preview-draft.test.ts`
- `packages/studio/src/features/generation-preview/generation-preview-title.test.ts`
- `packages/studio/src/features/movie-studio/scenes/scene-dialogue-audio-panel.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-panel.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-design-tabs.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail-save-notification.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-dialogs-tab.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-location-sheets.e2e.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-shots-tab.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-takes-tab.e2e.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/scene-takes-tab.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/shot-video-take-production-projection.test.ts`
- `packages/studio/src/features/movie-studio/scenes/shot-video-take-selection.test.ts`
- `packages/studio/src/features/movie-studio/scenes/take-shot-design-context.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.test.tsx`
- `packages/studio/src/features/movie-studio/scenes/use-take-shot-design.test.tsx`
- `packages/studio/src/hooks/use-studio-resource-refresh.test.ts`
- `packages/studio/src/services/scene-shot-video-take-state-persistence.e2e.test.ts`
- `packages/studio/src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts`
- `packages/studio/src/services/studio-generation-preview-api.test.ts`
- `packages/studio/src/services/studio-shot-video-takes-api.test.ts`
- `packages/studio/src/services/testing/shot-video-take-state-e2e.test-fixture.ts`

## Studio Skills Companion Callers

Plan `0137` completed the sister repository cutover after Plan `0136` landed
the runtime contract. The current companion surface is:

- `studio-skills/README.md` for the public skill inventory;
- `studio-skills/skills/media-producer/` for the generic lifecycle,
  purpose-specific guidance, direct provider endpoint guidance, samples,
  metadata, and forward-test cases;
- `studio-skills/skills/movie-director/` for coordination and exact
  `shot.video-take` handoff;
- `studio-skills/skills/casting-director/`,
  `studio-skills/skills/production-designer/`,
  `studio-skills/skills/scene-shot-designer/`, and
  `studio-skills/skills/lookbook-designer/` for specialist context and focused
  attachment handoffs.

Removed reference paths, dependency plans, speculative purpose instructions,
and obsolete samples were deleted directly. No alias file or compatibility
instruction preserves them.

## Resolution Evidence

- Core exposes one generic lifecycle plus focused Preview, Image Revision,
  Dialogue Audio, Shot Video Take, and attachment use cases.
- CLI exposes only the generic generation inventory and focused media import;
  the obsolete take command was deleted.
- Studio server routes call current Core commands and Studio features consume
  current projections without importing server or database modules.
- Studio Skills use `GenerationSpec`, stable guide placements, explicit
  provider-field assignments, pricing-only estimate approval, separate
  execution-readiness validation, Preview review, and focused attachment.
  Obsolete purpose samples and dependency-planning references were removed.
- Plan `0137` validated all touched skills, assembled every GenerationSpec
  sample against the current Engines descriptors, exercised the isolated CLI
  lifecycle without a provider call, and completed fresh-agent forward tests.
- The generation-42 migration and generated obsolete-table cleanup migration
  were replayed against a verified copy and applied to `urban-basilica`; final
  package and browser gates are recorded in Plan `0136`.
