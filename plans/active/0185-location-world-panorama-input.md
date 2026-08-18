# 0185 Location World Panorama Input

Status: complete
Date: 2026-08-18

## Review Attention

- Add one direct panorama-to-World source path. World Labs receives one uploaded
  equirectangular panorama through `world_prompt.type = "image"` with
  `is_pano = true`; Renku persists only the returned full-resolution SPZ.
- Preserve the existing two-to-eight-image Auto Layout reconstruction path.
  Do not add, remove, or call World Labs' separate panorama-generation API in
  this slice; it is simply not used for the Imperial Council Chamber.
- Change the pre-customer version-1 operation document to one discriminated
  `source` union. Add no compatibility reader for the prior top-level `images`
  field.
- Keep fixed `marble-1.1`, authored-prompt recaption disablement, polling,
  download, Asset persistence, selection, rollback, and the Studio viewer
  unchanged.
- Update only the Location World skill. Do not change Location Design, Cast
  Design, Prop Design, generic GenerationSpec, Studio UI, or project databases.
- No image generation and no paid World Labs request occur in this slice.

## Summary

The Imperial Council Chamber needs one reviewed GPT Image 2 equirectangular
panorama to be used directly as Marble's spatial input. The current Renku
adapter only emits a multi-image reconstruction prompt, causing World Labs to
generate an intermediate panorama before generating the World. Add the
documented single-image panorama request while retaining multi-image support.

## Context

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `docs/decisions/0082-use-location-owned-spz-world-assets.md`
- `plans/active/0184-location-world-reconstruction-inputs.md`
- World Labs public Quickstart and OpenAPI reviewed on 2026-08-18:
  `world_prompt.type = "image"`, uploaded `image_prompt`, `is_pano = true`
- `packages/core` owns the operation document and safe project-file validation.
- `packages/engines` owns the exact provider payload.
- `packages/cli` remains a thin JSON-document reader and Core caller.
- `../studio-skills/skills/location-world-producer` owns source preparation,
  visual review, and the paid confirmation gate.

## Architecture Shape Gate

- `packages/core/src/client/location-worlds.ts` owns the public source union:
  one panorama path or the existing multi-image set.
- `packages/core/src/server/location-worlds/input.ts` owns structural validation,
  project containment, supported extensions, and source-count validation.
- `packages/core/src/server/location-worlds/generation.ts` reads the validated
  source bytes and forwards the same source kind to Engines.
- `packages/engines/src/sdk/world-labs/contracts.ts` owns the provider-facing
  panorama/multi-image source union.
- `packages/engines/src/sdk/world-labs/location-world-generation.ts` owns the
  bounded two-case request construction, shared upload, polling, and SPZ
  download. A broad mode registry or generic World Labs platform is forbidden.
- `packages/cli` remains unchanged except for its exact-document fixture.
- Existing `index.ts` files remain thin exports.
- Stop and revise if implementation requires image semantic inspection,
  panorama generation endpoints, Draft/Create & Edit, database changes,
  provider-model selection, or Studio UI work.

## Contracts

Use this operation shape:

```ts
interface LocationWorldGenerationDocument {
  kind: 'locationWorldGeneration';
  version: 1;
  locationId: string;
  prompt?: string;
  source:
    | {
        kind: 'panorama';
        projectRelativePath: ProjectRelativePath;
      }
    | {
        kind: 'multiImage';
        images: Array<{ projectRelativePath: ProjectRelativePath }>;
      };
}
```

The panorama provider request is fixed to:

```text
model = marble-1.1
world_prompt.type = image
world_prompt.image_prompt = uploaded panorama media asset
world_prompt.is_pano = true
world_prompt.disable_recaption = true when text_prompt is present
output = assets.splats.spz_urls.full_res
```

The existing multi-image provider request remains:

```text
world_prompt.type = multi-image
world_prompt.reconstruct_images = true
multi_image_prompt entries omit azimuth
```

## Implementation Slices

1. Update the Core and Engines source unions and focused validators.
2. Add the exact panorama request branch and retain the exact multi-image branch.
3. Update focused Engines, Core, and CLI tests for both source kinds.
4. Update ADR 0082, media-generation architecture, and CLI documentation.
5. Update the source Location World skill, workflow reference, and sample to
   prefer one reviewed GPT Image 2 panorama for this workflow while documenting
   retained multi-image reconstruction as an alternative.

## Tests And Guardrails

- Engines proves a panorama uploads once and sends `type: "image"` with
  `is_pano: true`, the exact prompt, and recaption disabled.
- Engines retains the existing multi-image payload test and count failures.
- Core proves a panorama path is validated, read once, and reaches Engines as a
  panorama source before the normal SPZ persistence path.
- Core proves two-to-eight multi-image input still reaches Engines unchanged.
- Core rejects missing, unsupported, or malformed sources before provider
  invocation.
- CLI proves the current panorama document delegates unchanged.
- Runtime does not inspect image meaning or claim an image is visually a valid
  equirectangular panorama.

## Documentation

- Amend ADR 0082 and the current media-generation architecture description.
- Update the current CLI command contract.
- Update only `location-world-producer` in Studio Skills.
- Preserve historical plans except for this accepted correction record.

## Final Verification

- Run focused Engines, Core, and CLI tests.
- Run focused package checks and builds.
- Validate the source skill folder and run Studio Skills release tests.
- Run `git diff --check` in both repositories.
- Inspect complete diffs and diff stats without disturbing unrelated changes.
- Confirm no paid command, World Labs request, or GPT Image generation ran.

## Completion Checklist

### Review Area

- [x] Preserve the existing multi-image reconstruction path.
- [x] Add no behavior beyond direct panorama-to-World input.
- [x] Match the Architecture Shape Gate without a broad dispatcher or god file.
- [x] Keep existing World Assets, viewer, rollback, and persistence unchanged.

### Architecture And Contracts

- [x] Add the Core panorama/multi-image source union.
- [x] Add the matching Engines source union.
- [x] Keep package-boundary diagnostics structured.
- [x] Keep prompt and pixel content opaque to runtime validation.

### Implementation Slices

- [x] Send the exact documented panorama provider payload.
- [x] Retain the exact multi-image reconstruction payload.
- [x] Update Core forwarding and CLI fixtures.
- [x] Update the Location World source skill and sample only.

### Tests And Guardrails

- [x] Prove panorama upload and `is_pano: true` request behavior.
- [x] Prove multi-image behavior remains available.
- [x] Prove invalid sources fail before provider invocation.
- [x] Run focused package and skill validation.

### Documentation

- [x] Update ADR 0082, architecture overview, and CLI docs.
- [x] Keep unrelated and historical documentation unchanged.

### Final Verification

- [x] Inspect the full diff and changed-file sizes.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no catch-all World Labs abstraction was added.
- [x] Run `git diff --check` in both repositories.
- [x] Mark this plan complete only after all checks pass.
