# 0114 Generation Preview Contract Verification Remediation

Status: completed
Date: 2026-07-06

## Summary

Finish the incomplete `0112` generation preview model-configuration contract
work by fixing the blocking verification failures reported in review.

This plan is not a new architecture direction. The architecture decision from
`plans/active/0112-generation-preview-model-configuration-contract.md` still
stands:

- generation preview `configuration` is the current sectioned object contract;
- old array-shaped `configuration` payloads are retired;
- Core owns generation preview validation and preview row shape;
- Studio and CLI callers must send the current Core contract directly;
- shot video input parameter values must match the selected model's supported
  parameters;
- tests must use the current reference bundle and parameter contracts without
  shims or compatibility aliases.

The prior plan was marked mostly complete, but the current patch still fails
verification. The work here is a focused completion sweep:

1. update remaining CLI preview fixtures/callers from array-shaped
   `configuration` to `{ sections: [...] }`;
2. fix the shot input test helper so TypeScript sees
   `parameterValues` as `ShotVideoTakeParameterValues`, not a union with
   optional `undefined` properties;
3. fix inline shot input reference bundle test data so it includes all required
   `ShotVideoInputReferenceBundle` fields.

The expected end state is boring in the best way: focused CLI preview tests,
Core provider-payload test type-checking, and the root verification command no
longer fail on these contract leftovers.

## Completion Result

Completed 2026-07-06. The remediation stayed in CLI/Core test data, kept Core
validation strict, and did not add compatibility adapters, fallback branches,
runtime contract widening, or Studio/CLI-local business rules.

Verification run:

- `rg -n "configuration:\s*\[|\"configuration\"\s*:\s*\[" packages`
  returned no stale package literals.
- `pnpm --filter @gorenku/studio-cli test -- generation-command-handlers.test.ts --run`
  passed.
- `pnpm --filter @gorenku/studio-cli test:typecheck` passed.
- `pnpm --filter @gorenku/studio-core test -- provider-payloads.test.ts --run`
  passed.
- `pnpm --filter @gorenku/studio-core test:typecheck` passed.
- `pnpm check` passed. It reported one existing lint warning in
  `packages/studio/server/bin.ts` for `no-console`, but no errors.

## Sources Reviewed

- `plans/active/0112-generation-preview-model-configuration-contract.md`
- `packages/core/src/client/generation-preview.ts`
- `packages/core/src/server/generation-preview/validation.ts`
- `packages/core/src/server/generation-preview/validation.test.ts`
- `packages/cli/src/commands/generation-command-handlers.test.ts`
- `packages/core/src/client/scene-shot-list.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/planning/shot-input-references.ts`
- `packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.test.ts`
- `package.json`
- `packages/core/package.json`
- `packages/cli/package.json`

## Current Blocking Failures

### 1. CLI Preview Fixtures Still Use The Retired Configuration Array

Current example in
`packages/cli/src/commands/generation-command-handlers.test.ts`:

```ts
configuration: [
  {
    key: 'image_size',
    label: 'Image size',
    value: '1024x768',
  },
],
```

This is no longer a valid generation preview payload. Core validation now
requires:

```ts
configuration: {
  sections: [
    {
      key: 'model-inputs',
      label: 'Model inputs',
      rows: [
        {
          key: 'image_size',
          label: 'Image size',
          value: '1024x768',
          source: 'spec',
        },
      ],
    },
  ],
},
```

Impact:

- `pnpm --filter @gorenku/studio-cli test -- generation-command-handlers.test.ts --run`
  fails in the preview-show path.
- The test fails before it reaches the Studio delivery behavior it is meant to
  exercise.
- The failure is correct from Core's point of view: callers are still sending
  the old shape.

Required correction:

- Update remaining CLI fixtures and callers directly to the current sectioned
  object contract.
- Search all packages for stale array-shaped `configuration` literals and JSON
  fixtures.
- Do not make Core accept arrays again.
- Do not add a CLI-side adapter that translates arrays to objects. That would
  be a compatibility layer for a retired contract.

### 2. Shot Input Parameter Helper Inference Produces Optional Undefined Keys

Current helper in
`packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.test.ts`:

```ts
function shotInputParameterValues(modelChoice: ShotInputModelChoice) {
  if (modelChoice === 'fal-ai/openai/gpt-image-2') {
    return { image_size: 'landscape_16_9', quality: 'low', output_format: 'png' };
  }
  if (modelChoice === 'fal-ai/nano-banana-2') {
    return {
      aspect_ratio: '16:9',
      resolution: '1K',
      output_format: 'png',
      seed: null,
    };
  }
  return { output_format: 'png' };
}
```

TypeScript infers this as a union of object literals. Properties that only
exist on one branch become absent on the others. When the return value is
assigned to `ShotVideoTakeInputGenerationSpec.parameterValues`, TypeScript can
interpret those absent properties as optional `undefined` values. The domain
type does not allow `undefined`:

```ts
export type ShotVideoTakeParameterValues = Record<
  string,
  ShotVideoTakeParameterValue
>;
```

Impact:

- `pnpm check` fails during Core test type-checking.
- The type failure is in test data, not in the production domain contract.
- Widening the production type to allow `undefined` would hide invalid
  parameter values instead of fixing the fixture.

Required correction:

- Import `ShotVideoTakeParameterValues` into the test.
- Annotate the helper return type:

```ts
function shotInputParameterValues(
  modelChoice: ShotInputModelChoice
): ShotVideoTakeParameterValues {
  ...
}
```

- Keep the returned objects as records of actual values.
- Do not add `undefined` to `ShotVideoTakeParameterValue`.
- Do not cast the failing assignment through `unknown` or `any`.

### 3. Inline Reference Bundle Fixture Omits Required Fields

Current failing test data creates an inline reference bundle like:

```ts
references: {
  purpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  referenceMode: 'movie-lookbook',
  continuityReferences: [],
},
```

The current `ShotVideoInputReferenceBundle` contract requires:

```ts
export interface ShotVideoInputReferenceBundle {
  purpose: ShotVideoTakeInputGenerationPurpose;
  referenceMode: ShotVideoInputReferenceMode;
  styleReference: ShotVideoInputResolvedReference | null;
  continuityReferences: ShotVideoInputResolvedReference[];
  promptNotes: string[];
}
```

Impact:

- `pnpm check` fails with a TypeScript error before the provider-payload tests
  can run.
- The fixture no longer represents a valid current reference bundle.
- The test is supposed to assert unsupported model parameters, not exercise a
  malformed reference-bundle shape.

Required correction:

- Reuse `shotInputReferences(...)` and override only the fields needed for the
  test, or add a focused test helper that returns a complete empty bundle.
- If the test needs "no selected image references", express that with a full
  bundle:

```ts
{
  purpose,
  referenceMode: 'movie-lookbook',
  styleReference: null,
  continuityReferences: [],
  promptNotes: [],
}
```

- Do not make `styleReference` or `promptNotes` optional in the production
  contract.
- Do not add runtime fallback logic for missing bundle fields.

## Architecture Rules For The Fix

### Keep Core Validation Strict

The right fix for stale preview callers is to update the callers. Core must keep
rejecting array-shaped `configuration` values. Accepting both shapes would
violate the repository's no-compatibility-layer rule and would make the current
contract ambiguous.

### Keep Test Fixtures On Current Domain Shapes

The failing provider-payload fixtures should be made valid current fixtures.
They should not use partial objects, `as any`, broad casts, or production type
widening to get past the compiler.

### Keep The Repair In The Owning Layer

The CLI fixture failure belongs in CLI test data and any CLI preview caller that
still serializes old preview events. The reference-bundle and parameter-value
failures belong in the Core test helpers. This plan should not move business
rules into Studio, CLI validation, or React feature code.

### Keep The Scope Narrow

This plan does not finish every unchecked item in `0112`. In particular, it
does not add the remaining Lookbook, Location, Cast Profile, Scene Storyboard,
or final `shot.video-take` preview config builders. Those are legitimate
remaining `0112` scope, but they are not the blocking verification failures
identified in this review.

## Implementation Plan

### Slice 1: Inventory Remaining Stale Preview Configuration Callers

Search for old configuration array usage:

```bash
rg -n "configuration:\\s*\\[" packages
rg -n "\"configuration\"\\s*:" packages/cli packages/core packages/studio
```

Expected findings:

- at least the CLI `previewFixture()` in
  `packages/cli/src/commands/generation-command-handlers.test.ts`;
- any additional generated fixture or snapshot-style object that still sends
  `configuration` as an array.

Correction:

- Replace each stale fixture with the sectioned object contract.
- Use meaningful current section and row fields:
  - section `key`;
  - section `label`;
  - section `rows`;
  - row `key`;
  - row `label`;
  - row `value`;
  - row `source`.
- Include optional row metadata only when the test needs it.

Acceptance check:

- `rg -n "configuration:\\s*\\[" packages` returns no stale preview contract
  literals.
- Core validation tests still reject array-shaped configuration.

### Slice 2: Update CLI Preview-Show Fixtures To The Current Contract

Edit `packages/cli/src/commands/generation-command-handlers.test.ts`.

The `previewFixture()` should become a valid `GenerationPreviewRequest` shape:

```ts
configuration: {
  sections: [
    {
      key: 'model-inputs',
      label: 'Model inputs',
      rows: [
        {
          key: 'image_size',
          label: 'Image size',
          value: '1024x768',
          source: 'spec',
        },
      ],
    },
  ],
},
```

The exact section label can follow the current UI/Core terminology, but the
fixture must represent the new contract directly.

Run:

```bash
pnpm --filter @gorenku/studio-cli test -- generation-command-handlers.test.ts --run
pnpm --filter @gorenku/studio-cli test:typecheck
```

Expected result:

- preview-show tests reach the Studio delivery assertions;
- no `CORE_GENERATION_PREVIEW_CONFIGURATION_INVALID` diagnostic is produced by
  the fixture.

### Slice 3: Type The Shot Input Parameter Helper Explicitly

Edit
`packages/core/src/server/media-generation/purposes/shot-video-take/provider/provider-payloads.test.ts`.

Correction:

- Import `ShotVideoTakeParameterValues` from the Core client exports.
- If useful, introduce a local `ShotInputImageModelChoice` alias so the helper
  signature is readable.
- Annotate `shotInputParameterValues(...)` as returning
  `ShotVideoTakeParameterValues`.

Preferred shape:

```ts
function shotInputParameterValues(
  modelChoice: ShotInputImageModelChoice
): ShotVideoTakeParameterValues {
  ...
}
```

Avoid:

- changing the production parameter-value type;
- adding `undefined` as an allowed parameter value;
- using `as any`;
- replacing model-specific values with a lossy generic record.

Run:

```bash
pnpm --filter @gorenku/studio-core test:typecheck
```

Expected result:

- TypeScript no longer reports optional `undefined` parameter keys from this
  helper.

### Slice 4: Make Reference Bundle Test Data Complete

Edit the same provider-payload test file.

For the unsupported-parameter test, choose the fixture shape based on the test's
intent:

- If the test should use normal selected references, use:

```ts
references: shotInputReferences(SHOT_FIRST_FRAME_GENERATION_PURPOSE),
```

- If the test should avoid selected references, use a small helper that returns
  a complete empty current bundle:

```ts
function emptyShotInputReferences(
  purpose: ShotVideoTakeInputGenerationPurpose
) {
  return {
    purpose,
    referenceMode: 'movie-lookbook' as const,
    styleReference: null,
    continuityReferences: [],
    promptNotes: [],
  };
}
```

The helper can be annotated with the current bundle type if that type is already
available in the test's import path. If importing the internal server-side type
would make the test noisier, reusing `shotInputReferences(...)` and overriding
fields is acceptable.

Run:

```bash
pnpm --filter @gorenku/studio-core test -- provider-payloads.test.ts --run
pnpm --filter @gorenku/studio-core test:typecheck
```

Expected result:

- the provider-payload test file compiles;
- the unsupported-parameter test still fails for
  `CORE_SHOT_VIDEO_INPUT_PARAMETERS_UNSUPPORTED`, not because the reference
  bundle is malformed.

### Slice 5: Reconcile The Prior Plan's Completion State

After the code fix is verified, update
`plans/active/0112-generation-preview-model-configuration-contract.md` so its
completion list no longer claims this verification sweep is complete if any
part remains failing.

The key rule is simple: checked boxes must match command output. If the CLI
preview fixture or Core type-check is still failing, `0112` should not imply the
contract sweep is done.

This reconciliation should be factual and small:

- mark only actually completed items as complete;
- leave unrelated unchecked future preview builders alone;
- do not edit historical plans just to rename or reframe the work.

### Slice 6: Final Verification

Run focused commands first:

```bash
pnpm --filter @gorenku/studio-cli test -- generation-command-handlers.test.ts --run
pnpm --filter @gorenku/studio-cli test:typecheck
pnpm --filter @gorenku/studio-core test -- provider-payloads.test.ts --run
pnpm --filter @gorenku/studio-core test:typecheck
```

Then run the root verification command:

```bash
pnpm check
```

If `pnpm check` fails for unrelated pre-existing work, capture the unrelated
failure separately and confirm these three review blockers are no longer
present.

## Non-Goals

- Do not restore or preserve the old array-shaped preview configuration
  contract.
- Do not add CLI-local conversion from array config to object config.
- Do not broaden `ShotVideoTakeParameterValue` to allow `undefined`.
- Do not make `ShotVideoInputReferenceBundle.styleReference` or
  `promptNotes` optional.
- Do not change Studio UI rendering for this remediation unless a stale preview
  fixture exists in Studio tests.
- Do not finish the remaining out-of-scope `0112` preview builders as part of
  this blocking-failure repair.

## Risks And Review Points

### Risk: Fixing The CLI Test By Weakening Core

The tempting shortcut is to make validation accept both arrays and objects.
That would make the test pass while violating the current contract. The review
should reject that. The current architecture requires caller updates.

### Risk: Type Casts Hide Bad Fixture Data

Casting the parameter helper or reference bundle through `any` would silence
TypeScript but keep invalid test data. The review should look for casts and
prefer typed helpers that produce the current domain shape.

### Risk: The Unsupported-Parameter Test Stops Testing The Intended Failure

When the reference bundle fixture is corrected, the test must still prove that
unsupported parameter names are rejected. If the setup changes the code path so
that a missing reference or provider route issue fires first, the test has lost
its purpose.

### Risk: 0112 Checklist Drift Continues

The old plan already contains checked boxes that did not match verification.
This remediation should not add another layer of optimistic status. The final
state must be tied to command output.

## Completion Checklist

### Review And Architecture

- [x] Confirm the fix keeps array-shaped preview configuration rejected in Core.
- [x] Confirm remaining preview callers and fixtures send the sectioned object
      contract directly.
- [x] Confirm no compatibility adapter, shim, fallback branch, or re-export is
      introduced.
- [x] Confirm the shot input parameter type remains strict and does not admit
      `undefined`.
- [x] Confirm the shot input reference bundle contract remains strict and keeps
      `styleReference` and `promptNotes` required.
- [x] Confirm the remediation stays in CLI/Core test data and does not move
      business rules into Studio or CLI validation.

### Preview Configuration Caller Sweep

- [x] Search for `configuration: [` across `packages`.
- [x] Update `packages/cli/src/commands/generation-command-handlers.test.ts`
      preview fixture to `{ sections: [...] }`.
- [x] Update any additional stale CLI/Core/Studio fixtures found by the search.
- [x] Keep Core validation test coverage that rejects the retired array shape.
- [x] Confirm no stale preview fixture produces
      `CORE_GENERATION_PREVIEW_CONFIGURATION_INVALID`.

### Shot Provider Payload Test Fixtures

- [x] Import or otherwise use `ShotVideoTakeParameterValues` for the shot input
      parameter helper.
- [x] Annotate `shotInputParameterValues(...)` with the explicit return type.
- [x] Keep model-specific parameter records for GPT Image 2, Nano Banana 2, and
      Grok Imagine.
- [x] Replace the incomplete inline reference bundle with a complete current
      bundle.
- [x] Preserve the unsupported-parameter assertion and expected
      `CORE_SHOT_VIDEO_INPUT_PARAMETERS_UNSUPPORTED` code.

### Plan Reconciliation

- [x] Revisit the `0112` completion checklist after the fix.
- [x] Correct any checked verification item that is not backed by passing
      command output.
- [x] Leave unrelated future-builder checklist items unchecked unless they are
      genuinely implemented and verified.

### Focused Verification

- [x] Run
      `pnpm --filter @gorenku/studio-cli test -- generation-command-handlers.test.ts --run`.
- [x] Run `pnpm --filter @gorenku/studio-cli test:typecheck`.
- [x] Run
      `pnpm --filter @gorenku/studio-core test -- provider-payloads.test.ts --run`.
- [x] Run `pnpm --filter @gorenku/studio-core test:typecheck`.
- [x] Confirm the CLI preview-show tests no longer fail with
      `CORE_GENERATION_PREVIEW_CONFIGURATION_INVALID`.
- [x] Confirm Core test type-checking no longer fails on
      `provider-payloads.test.ts`.

### Final Verification

- [x] Run `pnpm check`.
- [x] Confirm `pnpm check` passed without unrelated failures requiring a
      separate failure record.
- [x] Update this plan's checklist with actual results.
- [x] Do not mark this remediation complete until the focused commands pass.
