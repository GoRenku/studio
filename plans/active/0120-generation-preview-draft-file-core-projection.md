# 0120 Generation Preview Draft File Core Projection

Status: draft
Date: 2026-07-06

## Summary

Fix the generation preview path that lets CLI and agent-authored preview JSON
files bypass Core-owned preview construction.

The immediate bug is visible in the Shot Video Generation Preview dialog: the
Config tab shows `Video settings` rows such as duration, aspect ratio,
resolution, and generated audio, but it does not show the selected model,
input mode, or provider route. Image generation previews show model information
because Core builds their `configuration.sections` with a dedicated `Model`
section. Final `shot.video-take` saved-spec previews now do the same.

The broken path is different: `renku generation preview show --file
<generation-preview-json>` validates a caller-authored
`GenerationPreviewRequest` and forwards it to Studio as-is. That file can be
valid at the envelope level while still missing the Core-authored model
configuration projection. Studio then faithfully renders the incomplete
`preview.configuration.sections` it receives.

The proper fix is not a React fallback that reads top-level `preview.model`.
That would move generation preview projection rules into the browser and hide
incomplete payloads. The proper fix is to stop treating complete generation
preview payloads as agent-authored files for normal workflows. Agents and CLI
should provide either a saved spec id or a draft media generation spec; Core
should build the preview snapshot from that spec, validate it, resolve its
current project context, and deliver the resulting preview to Studio.

## Investigation Evidence

The live Studio dialog renders only what the preview config contains:

- `packages/studio/src/features/generation-preview/generation-preview-config-panel.tsx`
  reads `preview.configuration.sections` and maps each section without
  purpose-specific branching.

The current faulty event came from CLI file mode:

- `/Users/keremk/.config/renku/studio-events.jsonl`
  contains a `studio.generationPreviewRequested` event with
  `source.kind: "cli"` and `source.command: "generation preview show"`.
- The event's `preview.configuration.sections` has only
  `key: "video-settings"`.
- The corresponding generated file,
  `/Users/keremk/renku-movies/urban-basilica/generated/specs/bombardment-continuous-aerial-opening-sheet-guided-take2-preview.json`,
  has top-level `model`, but its `configuration` only includes the
  `video-settings` section.

The Core-owned final shot-video saved-spec preview path already includes the
missing rows:

- `packages/core/src/server/media-generation/purposes/shot-video-take/specs/final-specs.ts`
  calls `buildShotVideoTakePreviewConfiguration(...)`.
- `packages/core/src/server/generation-preview/configuration/shot-video-configuration.ts`
  emits a `Model` section with `model`, `inputMode`, and `providerRoute`, then
  emits route parameter rows from the selected shot-video route.

The CLI currently has two behaviors:

- `generation preview show --spec <spec-id>` calls
  `projectDataService.buildMediaGenerationPreview(...)`, so Core builds the
  preview.
- `generation preview show --file <generation-preview-json>` reads a complete
  preview JSON file, validates the envelope, and forwards it unchanged.

That second behavior is the architectural hole.

## Architecture Direction

### Core Owns Preview Projection

Generation preview projection is domain logic. It belongs in
`packages/core`, not in Studio React code, Studio server routes, CLI
formatting code, or agent-authored JSON templates.

Core owns:

- purpose validation;
- target and current project context validation;
- selected model and provider route resolution;
- provider payload construction;
- provider schema and route parameter projection;
- reference rows backed by durable asset ids and asset file ids;
- generation preview configuration sections and row metadata;
- structured diagnostics for malformed previewable specs.

Studio owns only:

- receiving a valid `StudioGenerationPreview` event;
- rendering `preview.configuration.sections`;
- rendering resolved references, prompt text, diagnostics, and footer estimate
  data without provider-specific branching.

CLI owns only:

- parsing flags;
- reading the requested JSON file when a draft spec file is supplied;
- calling Core;
- validating/delivering the Core-built preview event;
- formatting the command result.

### Draft Specs Are The File Contract

Replace normal `generation preview show --file <generation-preview-json>` usage
with `generation preview show --file <media-generation-spec-json>`.

The file should contain the same purpose-specific `MediaGenerationSpec` shape
accepted by:

```bash
renku generation spec validate --file <spec-json> --json
renku generation spec create --file <spec-json> --json
```

The preview command should build a transient preview from that draft spec
without persisting it. The file is not a complete preview snapshot; it is the
generation request Core can understand.

This intentionally removes the raw preview-payload bypass. Renku Studio is
pre-customer software, so this should be a direct contract correction, not a
compatibility layer.

### Saved Specs And Draft Specs Share Preview Builders

Saved-spec previews and draft-file previews must use the same purpose-owned
preview construction logic.

The implementation should avoid parallel saved/draft code paths such as:

```text
saved preview builder
draft preview builder with copied rows
```

Instead, each previewable purpose should expose one focused Core path that can
build a preview from a current `MediaGenerationSpecRecord`-like value. Saved
specs read that record from SQLite. Draft specs create a transient draft record
with a generated draft id and no durable write.

The final `shot.video-take` preview must keep using the existing shot-video
route helpers:

- `requireShotVideoTakeRoute(...)`;
- `parametersForRoute(...)`;
- `normalizeRouteSettingsForContext(...)`;
- `buildShotVideoTakeProviderPayload(...)`;
- `buildShotVideoTakePreviewConfiguration(...)`.

Image previews must keep using the shared image preview configuration helper
from provider schema plus actual provider payload/defaults.

### Do Not Make Top-Level Model A UI Fallback

`GenerationPreviewRequest.model` is useful envelope metadata, but it is not a
replacement for the Config tab's Core-authored configuration projection.

Do not update `GenerationPreviewConfigPanel` to synthesize a missing model
section from `preview.model`.

That would:

- duplicate Core projection rules in React;
- make incomplete preview files look correct;
- hide missing `inputMode` and `providerRoute` details;
- encourage more agent-authored preview snapshots instead of Core-built
  previews.

## Public Contract Changes

### ProjectDataService

Add a Core service method:

```ts
buildDraftMediaGenerationPreview(input: {
  projectName?: string;
  homeDir?: string;
  spec: MediaGenerationSpec;
}): Promise<GenerationPreviewRequest>;
```

Naming notes:

- Use `Draft` because the spec is not persisted.
- Use `MediaGenerationPreview` because the output is the existing preview
  contract.
- Do not call this `previewFromFile`; file parsing is a CLI concern.

### Media Generation Purpose Definition

Refactor the preview hook shape so saved and draft previews share the same
purpose implementation.

One acceptable shape:

```ts
buildPreview(input: {
  projectName?: string;
  homeDir?: string;
  specRecord: MediaGenerationSpecRecord;
}): Promise<GenerationPreviewRequest>;
```

Then:

- `buildMediaGenerationPreview({ specId })` reads the saved spec record and
  calls the purpose preview hook.
- `buildDraftMediaGenerationPreview({ spec })` validates/normalizes the draft
  spec, wraps it in a transient draft spec record, and calls the same purpose
  preview hook.

If implementation reveals a cleaner shape, it must still preserve the same
boundary: one Core-owned preview projection path per purpose, with saved and
draft inputs converging before rows are built.

### CLI Preview Show

Change `generation preview show` to support exactly these inputs:

```bash
renku generation preview show --spec <media-generation-spec-id> --json
renku generation preview show --file <media-generation-spec-json> --json
```

Behavior:

- `--spec` calls `buildMediaGenerationPreview(...)`.
- `--file` reads a draft `MediaGenerationSpec` JSON file and calls
  `buildDraftMediaGenerationPreview(...)`.
- `--spec` and `--file` remain mutually exclusive.
- The CLI validates the Core-built preview before notifying Studio.
- The CLI no longer accepts caller-authored `GenerationPreviewRequest` files
  as normal input.

Do not add `--preview-file`, `--raw-preview-file`, or a fallback branch that
keeps old preview snapshots working. If a low-level debug tool is ever needed,
it should be designed separately and not be the agent/user workflow.

## Documentation Changes

Update current docs that still describe preview JSON file delivery:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/studio-coordination-events.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/cli/commands.md`;
- any active plan text that still tells agents to write complete
  `generation-preview-json` files as the preferred workflow.

The revised docs should say:

- agents show saved previews with `--spec`;
- agents show unsaved draft previews with `--file <media-generation-spec-json>`;
- Studio receives a Core-built preview event;
- raw preview snapshots are not a durable or agent-authored project artifact;
- references in draft specs remain logical project references through the
  existing purpose-specific spec contracts;
- prompt and media contents remain opaque.

When this change affects Studio agent skills, update the sister project:

- `/Users/keremk/Projects/aitinkerbox/studio-skills/`

In particular, remove guidance that tells skills to hand-author full
`GenerationPreviewRequest` files with custom `configuration.sections`.

## Implementation Slices

### Slice 1: Core Draft Preview Service

Files:

- `packages/core/src/server/project-data-service-contracts.ts`;
- `packages/core/src/server/media-generation/lifecycle/spec-service.ts`;
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`;
- purpose preview builder files under
  `packages/core/src/server/media-generation/purposes/**`.

Work:

- Add `BuildDraftMediaGenerationPreviewInput`.
- Add `ProjectDataService.buildDraftMediaGenerationPreview(...)`.
- Refactor purpose preview hooks so saved and draft specs converge before
  preview rows are built.
- Use the existing `draftMediaGenerationSpecRecord(...)` helper or an
  equivalent Core-owned transient record shape.
- Ensure draft preview validation uses the same purpose-specific validation as
  spec creation/update.
- Ensure unsupported preview purposes fail fast with structured diagnostics.

Expected impact:

- Draft final `shot.video-take` previews include the same `Model` and
  `Model inputs` sections as saved final `shot.video-take` previews.
- Draft image previews include the same model/provider configuration sections
  as saved image previews.

### Slice 2: CLI Contract Correction

Files:

- `packages/cli/src/commands/generation-command-handlers.ts`;
- `packages/cli/src/commands/generation-command-handlers.test.ts`;
- possibly `packages/cli/src/commands/generation-command.ts` if help text is
  command-specific enough to mention preview file semantics.

Work:

- Change `readPreviewShowRequest(...)` so `--file` reads a
  `MediaGenerationSpec`, not a `GenerationPreviewRequest`.
- Call `projectDataService.buildDraftMediaGenerationPreview(...)` for `--file`.
- Keep `--spec` on `buildMediaGenerationPreview(...)`.
- Update structured error messages and suggestions to say draft spec file.
- Add a test proving raw `kind: "generationPreview"` files are not delivered.
- Keep the command handler thin; do not branch by purpose in CLI.

Expected impact:

- Agents can preview unsaved work by writing a normal generation spec file.
- CLI no longer forwards incomplete preview snapshots.

### Slice 3: Tests For The Exact Regression

Core tests:

- Add or update draft preview tests for final `shot.video-take`.
- Assert the returned config contains rows with keys:
  - `model`;
  - `inputMode`;
  - `providerRoute`;
  - a representative route parameter such as `duration`.
- Add or update draft preview tests for at least one image purpose.
- Assert image draft preview config contains the `model` section and at least
  one provider/model parameter row from schema or payload.

CLI tests:

- `generation preview show --file <draft-spec-json>` calls
  `buildDraftMediaGenerationPreview(...)`.
- `generation preview show --spec <spec-id>` still calls
  `buildMediaGenerationPreview(...)`.
- `--file` and `--spec` together still fail.
- raw preview JSON files are rejected before Studio delivery.

Studio tests:

- No React fallback should be added.
- Existing data-driven Config tab tests should continue to prove Studio renders
  whatever Core sends.
- If fixtures are updated, keep them on the current sectioned contract with a
  real model section.

### Slice 4: Documentation And Skill Guidance

Files:

- docs listed in the Documentation Changes section;
- relevant Studio skill files in
  `/Users/keremk/Projects/aitinkerbox/studio-skills/`.

Work:

- Replace `generation preview show --file <generation-preview-json>` examples.
- Add draft-spec preview examples.
- Remove instructions for agent-authored preview configuration rows.
- State that Core owns preview config projection.
- Keep opaque-artifact language intact: prompts and media contents are not
  inspected or validated.

### Slice 5: Real Project Verification

Use the real project that exposed the bug:

- `/Users/keremk/renku-movies/urban-basilica`.

Verification shape:

1. Use the existing final video spec JSON file as a draft preview input:

   ```bash
   renku generation preview show \
     --project urban-basilica \
     --file /Users/keremk/renku-movies/urban-basilica/generated/specs/bombardment-continuous-aerial-opening-sheet-guided-take2-final-video-spec.json \
     --json
   ```

2. Confirm the Studio dialog Config tab shows:

   - `Model`;
   - selected model label/id;
   - `Input mode`;
   - `Provider route`;
   - route parameter rows such as duration, aspect ratio, resolution, and
     generated audio where supported by the selected route.

3. If a saved spec exists for the same generation, run the `--spec` path and
   confirm the same model/config structure.

This verification should not require mobile testing. Renku Studio is
desktop-first.

## Non-Goals

- Do not add React-side fallback model rows.
- Do not make Studio inspect `providerPreview.payload` to build Config rows.
- Do not keep raw preview JSON files as a supported normal workflow.
- Do not add compatibility aliases for old preview file semantics.
- Do not validate prompt wording, prompt-sheet contents, image panels, labels,
  audio words, or video content.
- Do not persist draft preview specs just to show a preview.
- Do not hand-edit generated media artifacts or generated preview JSON files as
  the fix.

## Implementation Notes

Implemented in this slice:

- Core now exposes `buildDraftMediaGenerationPreview(...)`.
- Saved and draft preview paths both project a normalized
  `MediaGenerationSpecRecord` through the same purpose preview hook.
- `generation preview show --file` now accepts a draft `MediaGenerationSpec`
  JSON file and asks Core to build the preview envelope.
- `generation preview show --spec` still uses saved specs.
- The Studio Config tab remains a generic renderer of
  `GenerationPreviewRequest.configuration.sections`; no React fallback was
  added.

Verification completed:

- `pnpm --dir packages/core exec vitest run src/server/generation-preview/saved-image-preview.test.ts --pool=forks`
- `pnpm --dir packages/core exec vitest run src/server/media-generation/lifecycle/spec-service.test.ts --pool=forks`
- `pnpm --dir packages/core exec vitest run src/server/media-generation/purposes/shot-video-take/specs/spec-validation.test.ts --pool=forks`
- `pnpm --dir packages/cli test -- src/commands/generation-command-handlers.test.ts`
- `pnpm --dir packages/core type-check`
- `pnpm --dir packages/core test:typecheck`
- `pnpm --dir packages/core lint`
- `pnpm --dir packages/core build`
- `pnpm --dir packages/cli build`
- `pnpm --dir packages/cli type-check`
- `pnpm --dir packages/cli test:typecheck`
- `pnpm --dir packages/cli lint`

Real-project verification against Urban Basilica:

- Core built the draft final-video preview from
  `/Users/keremk/renku-movies/urban-basilica/generated/specs/bombardment-continuous-aerial-opening-sheet-guided-take2-final-video-spec.json`.
- The resulting Config sections were `model` followed by `model-inputs`.
- The `model` section included model, input mode, and provider route rows:
  `Seedance 2.0 Mini`, `reference`, and
  `bytedance/seedance-2.0/mini/reference-to-video`.
- The `model-inputs` section included duration, aspect ratio, resolution, and
  generate audio rows.
- The real CLI command delivered the draft preview to the running Studio server:
  `node packages/cli/dist/cli.js generation preview show --project urban-basilica --file /Users/keremk/renku-movies/urban-basilica/generated/specs/bombardment-continuous-aerial-opening-sheet-guided-take2-final-video-spec.json --json`.

Known verification caveats:

- A broad Core test run accidentally invoked unrelated shared-context suites and
  failed on existing temporary project/template setup issues. The touched Core
  tests listed above pass when run directly.
- Root `pnpm check` currently fails in unrelated Studio lint errors in
  `packages/studio/src/features/movie-studio/scenes/scene-takes-tab.test.tsx`
  for unused helpers `configureFiveShotEditTake` and
  `selectedForEditLabels`. Core also reports two unrelated lint warnings in
  shot-video tests.
- The sister `studio-skills` project was not edited in this implementation
  slice because the current writable workspace is the Studio repo. The in-repo
  Studio skill reference was updated.

## Completion Checklist

### Review Area

- [x] Confirm the failing preview came from CLI file mode, not saved-spec mode.
- [x] Confirm the current Studio Config panel remains data-driven.
- [x] Confirm all proposed changes keep Core as the preview projection owner.
- [x] Confirm no UI-side fallback is introduced for missing model sections.

### Architecture And Contracts

- [x] Add `BuildDraftMediaGenerationPreviewInput` to Core contracts.
- [x] Add `buildDraftMediaGenerationPreview(...)` to the project data service.
- [x] Refactor preview purpose hooks so saved and draft specs share row
      construction.
- [x] Keep unsupported preview purposes failing with structured diagnostics.
- [x] Retire raw `GenerationPreviewRequest` file delivery from the normal CLI
      workflow.
- [x] Keep `GenerationPreviewRequest.configuration` on the current sectioned
      contract only.

### Core Implementation

- [x] Build draft previews from transient spec records without SQLite writes.
- [x] Reuse image preview configuration helpers for image purposes.
- [x] Reuse shot-video route helpers for final `shot.video-take`.
- [x] Preserve reference resolution through durable asset ids and asset file
      ids.
- [x] Preserve provider payload safety checks against local paths, secrets, and
      provider upload URLs.

### CLI Surface

- [x] Update `generation preview show --file` to accept draft
      `MediaGenerationSpec` JSON.
- [x] Keep `generation preview show --spec` behavior intact.
- [x] Update mutual-exclusion and missing-input diagnostics.
- [x] Reject raw `kind: "generationPreview"` input files.
- [x] Keep CLI handler code thin and free of purpose-specific projection logic.

### Studio Surface

- [x] Leave `GenerationPreviewConfigPanel` as a renderer of Core-provided
      sections.
- [x] Update fixtures only to represent current Core-built preview payloads.
- [x] Do not branch on preview purpose, provider id, or model id in React for
      Config rows.

### Agent And Documentation Surfaces

- [x] Update architecture docs for draft-spec preview file semantics.
- [x] Update CLI command docs.
- [x] Update Studio coordination event docs.
- [x] Update in-repo Studio skill guidance where preview JSON hand-authoring is
      currently documented.
- [x] Remove examples that tell agents to author `configuration.sections`
      themselves.

### Validation And Tests

- [x] Add Core tests for draft final `shot.video-take` preview configuration.
- [x] Add Core tests for draft image preview configuration.
- [x] Add CLI tests for `--file` draft spec preview delivery.
- [x] Add CLI tests rejecting raw preview JSON files.
- [x] Run focused Core tests for generation preview and shot-video preview
      configuration.
- [x] Run focused CLI generation command handler tests.
- [x] Run package type checks for Core and CLI.
- [x] Run `pnpm check` or record any known unrelated blockers.

### Real Project Verification

- [x] Use the Urban Basilica final video spec file to open a draft preview.
- [x] Confirm the Config tab includes model, input mode, provider route, and
      route parameter rows.
- [x] Confirm no generated-media content validation or prompt-content parsing
      is involved.
- [x] Confirm saved-spec preview still opens with the same configuration shape
      when a saved spec id is available.

### Final Review

- [x] Review for no shims, no compatibility aliases, and no broad re-export
      stubs.
- [x] Review naming against the current domain vocabulary.
- [x] Review structured diagnostics at package boundaries.
- [x] Update this plan with completion notes and exact verification commands
      after implementation.
