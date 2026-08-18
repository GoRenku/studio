# 0184 Location World Reconstruction Inputs

Status: complete
Date: 2026-08-18

## Review Attention

- Replace the four fixed-azimuth direction-control contract with a two-to-eight
  image reconstruction set. This is required because World Labs documents
  direction control as a creative environment-connection mode and Auto Layout
  as the single-space reconstruction mode.
- Send `reconstruct_images: true` and omit per-image azimuths so Marble owns
  Auto Layout. When an authored prompt is present, send
  `disable_recaption: true` so provider recaptioning cannot rewrite spatial
  facts.
- Change the version-1 operation document directly; Renku is pre-customer and
  no compatibility alias, legacy validator, or translation path is added.
- Keep the fixed `marble-1.1` model, full-resolution SPZ persistence, explicit
  paid approval, provider polling, rollback, and Studio viewer unchanged.
- Update the source skill and current product documentation. Existing saved
  Worlds and Project databases are unchanged; there is no migration, deletion,
  or paid provider call in this implementation.
- Panorama input and Marble's staged Create & Edit/Draft workflow remain
  outside this correction. They require separate product and command contracts.

## Summary

The first real Location World exposed a mismatch between Renku's request and
World Labs' documented behavior. Renku forced `reconstruct_images: false`,
assigned four azimuths, allowed provider recaptioning, and instructed the skill
to create four independent opposing views. Marble consequently treated the
images as directional environments and creatively connected them instead of
reconstructing one room.

Correct the reusable workflow before another paid generation. Runtime remains
responsible only for the provider envelope and safe project files. Geometric
continuity, overlap, shared capture position, and landmark review remain in the
agent/user skill workflow because prompts and pixels are opaque to Studio.

## Context

- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `docs/decisions/0082-use-location-owned-spz-world-assets.md`
- `plans/active/0182-location-world-generation-and-spark-viewer.md`
- World Labs multi-image guidance and public OpenAPI schema reviewed on
  2026-08-18
- `packages/core` owns the operation document and source-file validation
- `packages/engines` owns the exact World Labs request
- `packages/cli` remains a thin document reader and Core caller
- `../studio-skills/skills/location-world-producer` owns visual/capture review

## Architecture Shape Gate

- `packages/core/src/client/location-worlds.ts` owns the public
  `LocationWorldGenerationDocument` shape.
- `packages/core/src/server/location-worlds/input.ts` validates two-to-eight
  project-contained supported image files and the optional prompt envelope.
- `packages/core/src/server/location-worlds/generation.ts` reads validated
  bytes and forwards them without adding provider-specific layout metadata.
- `packages/engines/src/sdk/world-labs/contracts.ts` owns the provider adapter's
  azimuth-free image input.
- `packages/engines/src/sdk/world-labs/location-world-generation.ts` owns the
  fixed reconstruction and recaption request flags.
- Existing `index.ts` files remain thin exports. No new dispatcher, provider
  platform, generic reconstruction abstraction, image parser, or semantic
  content validator is allowed.
- Stop and revise if the correction requires panorama branching, model
  selection, runtime pixel inspection, or a compatibility path for the old
  azimuth document.

## Contracts

Use this current operation shape:

```ts
interface LocationWorldGenerationDocument {
  kind: 'locationWorldGeneration';
  version: 1;
  locationId: string;
  prompt?: string;
  images: Array<{
    projectRelativePath: ProjectRelativePath;
  }>;
}
```

Require two through eight images. Preserve the existing supported extensions
and project-containment checks. Do not accept or expose layout-mode flags in the
document.

The Engines request is fixed to:

```text
model = marble-1.1
world_prompt.type = multi-image
reconstruct_images = true
multi_image_prompt entries = content only, without azimuth
disable_recaption = true when text_prompt is present
output = assets.splats.spz_urls.full_res
```

## Implementation Slices

1. Update Core and Engines contracts, validation, provider payload, and focused
   tests.
2. Update the CLI delegation fixture to the current azimuth-free document.
3. Update ADR 0082 and current CLI documentation. Mark plan 0182's input
   strategy as corrected by this plan rather than rewriting unrelated viewer
   history.
4. Update `location-world-producer`, its workflow reference, sample document,
   discovery metadata if needed, README routing, Production Designer routing,
   and Movie Director routing.
5. Validate the skill and run focused Core, Engines, and CLI tests without any
   World Labs credentials or paid request.

## Tests And Guardrails

- Engines payload test proves reconstruction is true, azimuths are absent, and
  authored prompts disable recaptioning.
- Engines tests reject fewer than two and more than eight images before secret
  resolution.
- Core generation test proves two-to-eight inputs reach the provider without
  azimuth metadata and an invalid count fails before provider invocation.
- CLI test proves the exact current document is delegated unchanged.
- Skill validation checks frontmatter and folder structure.
- Tests must not inspect prompt meaning or image pixels.

## Documentation

- Amend ADR 0082's temporary-input and provider-request decision.
- Update `docs/cli/commands.md`.
- Add a correction pointer to plan 0182.
- Update the source skill instructions and sample in `studio-skills`.

## Final Verification

- Run focused Engines, Core, and CLI tests.
- Run package type/check commands required by the touched packages.
- Run the Skill Creator quick validator on `location-world-producer`.
- Run `git diff --check` in both repositories.
- Inspect complete diffs and `git diff --stat` without disturbing pre-existing
  user changes.
- Confirm no `index.ts` grew beyond thin exports and no paid command ran.

The installed Skill Creator validator could not import its undeclared PyYAML
dependency. Its complete frontmatter checks were replicated with Ruby's YAML
parser, and the Studio Skills release tests also passed.

## Completion Checklist

### Review Area

- [x] Preserve Engines/Core/CLI/skill ownership boundaries.
- [x] Match the Architecture Shape Gate without a new broad abstraction.
- [x] Keep existing saved Worlds, selection, rollback, and viewer behavior.
- [x] Add no panorama, Draft, Settings, pricing, or generation UI scope.

### Architecture And Contracts

- [x] Replace fixed azimuth entries with two-to-eight reconstruction images.
- [x] Remove azimuth from the Core-to-Engines contract and provider request.
- [x] Keep reconstruction and recaption policy fixed in Engines.
- [x] Add no compatibility shim for the old operation shape.
- [x] Keep prompts and pixels opaque in runtime code.

### Implementation Slices

- [x] Update Core contracts and validation.
- [x] Update Engines request construction and validation.
- [x] Update CLI fixtures without adding CLI business rules.
- [x] Update source skill, workflow, sample, and specialist routing.

### Tests And Guardrails

- [x] Prove the exact World Labs reconstruction payload.
- [x] Prove invalid image counts fail before credentials/provider calls.
- [x] Run focused package tests and checks.
- [x] Validate the updated skill folder.

### Documentation

- [x] Update ADR 0082 and CLI docs.
- [x] Mark plan 0182's input strategy as corrected by this plan.
- [x] Keep historical and unrelated documentation unchanged.

### Final Verification

- [x] Inspect full diffs and diff stats in both repositories.
- [x] Confirm `index.ts` files remain thin.
- [x] Confirm no god file, catch-all helper, or broad dispatcher was added.
- [x] Run `git diff --check` in both repositories.
- [x] Mark this plan complete only after all checks pass.
