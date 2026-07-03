# 0104 Generation Cost Estimate Architecture Reset

Status: completed
Date: 2026-07-03

## Summary

Generation estimates have drifted back into generation validation. This is now
a recurring architecture failure, not an isolated prompt-sheet metadata bug.

The required direction is a hard split between:

- the **cost rail**, which calculates price from pricing inputs only; and
- the **readiness rail**, which validates, prepares, and runs real generation.

The cost rail must never call prepare, provider-payload construction, provider
payload validation, asset-file resolution, prompt validation, prompt-sheet
metadata validation, target freshness validation, or dependency materialization
validation. If the selected provider/model has price information and the
pricing inputs required by that price function are present, the estimate must
return a numeric cost.

The only accepted non-numeric estimate states are:

- price information is missing for the provider/model/price row;
- a pricing input required by the price function is missing or unreadable.

Everything else belongs to readiness, not cost.

This plan deliberately proposes a deeper architecture reset rather than the
smallest local fix. The current problem has repeated because the existing
default path makes estimate a side effect of preparing generation. That default
must be removed.

## References Reviewed

- `AGENTS.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/coding-practices.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `plans/active/0042-shot-video-take-generation-plan-architecture.md`
- `plans/active/0063-generation-dependency-inventory-rewrite.md`
- `plans/active/0064-generation-dependency-inventory-cleanup.md`
- `plans/active/0103-opaque-ai-artifacts-and-prompts.md`
- `packages/core/src/server/media-generation/shared-generation-service.ts`
- `packages/core/src/server/media-generation/estimation/cost-projection.ts`
- `packages/core/src/server/media-generation/estimation/dependency-draft-estimates.ts`
- `packages/core/src/server/media-generation/estimation/spec-estimates.ts`
- `packages/core/src/server/media-generation/dependency-inventory.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-draft-specs.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-inventory.ts`
- `packages/core/src/server/media-generation/shot-video-take/final-specs.ts`
- `packages/core/src/server/media-generation/shot-video-take/input-specs.ts`
- `packages/engines/src/generation/estimates.ts`

## Problem Statement

The current implementation uses prepare/run-oriented objects to calculate cost.
That lets validation rules leak into estimate behavior.

The clearest current path is:

```text
estimateDraftMediaGenerationSpec
  -> prepareDraftMediaGenerationSpec
    -> purpose prepareDraftSpec
      -> purpose validation
      -> context validation
      -> provider payload construction
  -> engines estimateGeneration
    -> logical provider payload construction
    -> provider payload validation
    -> price calculation
```

That means a price can fail because a generation request is not runnable, even
when the price function would have had everything it needed.

Concrete current examples:

- `shot.video-prompt-sheet` dependency estimates can fail because
  `promptSheetVisualStyleId` or `promptSheetNotationModeId` is missing from a
  generated draft spec. Those fields matter for prepare/generate, but the
  image price normally depends on model, size, quality, and output count.
- A dependency that is missing an authored prompt can become unpriced, even for
  fixed-price image generation where prompt text is not a pricing dimension.
- A missing selected reference file can block a final video estimate, even when
  the price only needs duration, resolution, output count, and input image
  count.
- Engine-level `estimateGeneration` currently validates provider payload shape
  unless `pricingInputCounts` is present. That means a provider schema issue can
  block a cost estimate.
- Catch-all estimate wrappers convert arbitrary errors into `unpriced`, hiding
  the difference between "price info missing" and "readiness validation leaked
  into cost."

The repeated regression happens because the dependency inventory tries to be
both a readiness model and a pricing source. As it expands dependency slots, it
builds dependency draft specs, tries to estimate those specs, validates enough
of the graph to decide readiness, and then uses the same line state for the
visible estimate. That makes the next feature naturally add one more validation
inside a path that pricing later reuses.

## Non-Negotiable Estimate Rule

The product rule is:

```text
If price information exists and the estimate inputs required by that price
function are present, the estimate returns a number.
```

The estimate must not fail because:

- prompt text is empty;
- prompt text is creatively wrong;
- prompt-sheet metadata is missing;
- a generated dependency is not materialized yet;
- a selected reference asset cannot currently be resolved for generation;
- target shot ids are stale;
- a route is not runnable;
- provider payload validation would fail;
- provider input file paths are missing;
- the generation spec would fail prepare;
- the user or agent has not authored enough data to run generation.

Those states can and should appear in readiness diagnostics, but they must not
change whether a priceable route has a numeric estimate.

## Naming Decisions

Use **cost** for the price-calculation rail and **readiness** for the
generation-validity rail.

Approved names for this plan:

- `GenerationCostRequest`
- `GenerationCostEstimate`
- `GenerationCostLine`
- `MediaGenerationCostPlan`
- `MediaGenerationCostProjection`
- `GenerationPriceKey`
- `GenerationPricingInputs`
- `GenerationCostApprovalToken`
- `MediaGenerationReadinessInventory`

Avoid using `validation` in cost-rail names. Cost code may check whether a
pricing input is present or readable, but those checks are not generation
validation.

Avoid using `graph` in cost-rail names. Cost planning can have line lineage for
explanation, but it is not an execution graph and not a dependency validator.

## Target Architecture

### Two Parallel Rails

Generation work has two parallel rails.

The readiness rail:

```text
validateMediaGenerationSpec
prepareMediaGenerationSpec
runMediaGenerationSpec
planMediaGenerationReadiness
```

The readiness rail owns:

- purpose-specific domain validation;
- target and context validation;
- prompt presence and prompt-sheet metadata validation;
- asset/file existence checks;
- selected dependency validity;
- provider payload construction;
- provider payload validation;
- run approval and run recording;
- diagnostics for anything that blocks real generation.

The cost rail:

```text
buildMediaGenerationCostProjection
estimateMediaGenerationSpecRecordCost
buildPurposeCostProjection
estimateGenerationCost
```

The cost rail owns only:

- identifying the provider/model price key;
- reading pricing inputs from the current spec, draft, or production setup;
- counting selected or planned generated inputs when the price function needs
  counts;
- calling the engine price function;
- returning priced, unpriced, or missing-pricing-input states;
- producing a cost approval token from the pricing facts.

The cost rail must not depend on the readiness rail.

The readiness rail may display or embed cost results by id. That dependency is
one-way:

```text
cost rail -> no readiness imports
readiness rail -> may consume cost-line results
```

### Engine Pricing API

Replace estimate-by-generation-request with a pricing-only engine API.

Proposed engine contract:

```ts
interface GenerationPriceKey {
  provider: string;
  model: string;
  mediaKind: GenerationMediaKind;
}

interface GenerationPricingInputs {
  outputCount?: number;
  inputImageCount?: number;
  inputAudioCount?: number;
  inputVideoCount?: number;
  durationSeconds?: number;
  characterCount?: number;
  imageSize?: string | { width: number; height: number };
  resolution?: string;
  aspectRatio?: string;
  quality?: string;
  generateAudio?: boolean;
  usesVoiceControl?: boolean;
}

type GenerationCostEstimate =
  | {
      state: 'priced';
      estimatedCostUsd: number;
      billableUnits: Record<string, unknown>;
      costApprovalToken: string;
    }
  | {
      state: 'unpriced';
      estimatedCostUsd: null;
      reason: string;
      costApprovalToken: string | null;
    }
  | {
      state: 'missing-pricing-input';
      estimatedCostUsd: null;
      missingInputs: string[];
      costApprovalToken: null;
    };

async function estimateGenerationCost(input: {
  priceKey: GenerationPriceKey;
  pricingInputs: GenerationPricingInputs;
  catalog?: LoadedModelCatalog;
}): Promise<GenerationCostEstimate>;
```

`estimateGenerationCost` must not accept:

- prompt text;
- provider payloads;
- generation input files;
- output file names;
- provider upload URLs;
- project-relative paths;
- generation mode payloads.

It may read the bundled price catalog and the exact pricing fields required by
the selected price function.

### Remove The Current Default Estimate Path

`estimateMediaGenerationSpec` and `estimateDraftMediaGenerationSpec` must stop
calling `prepareMediaGenerationSpec` or `prepareDraftMediaGenerationSpec`.

The purpose registry should require an explicit cost projection from every
generation purpose:

```ts
interface MediaGenerationPurposeDefinition {
  buildCostProjection(input: MediaGenerationCostProjectionInput):
    Promise<MediaGenerationCostProjection>;

  validateSpec(input: ValidateMediaGenerationSpecInput): Promise<...>;
  createSpec(input: CreateMediaGenerationSpecInput): Promise<...>;
  updateSpec(input: UpdateMediaGenerationSpecInput): Promise<...>;
  prepareSpec(input: ReadMediaGenerationSpecInput): Promise<...>;
  prepareDraftSpec(input: PrepareDraftMediaGenerationSpecInput): Promise<...>;
}
```

There should be no generic fallback that says, "if the purpose did not provide
a cost projection, prepare the spec and estimate the prepared generation."

Missing a cost projection is an implementation error discovered by architecture
tests, not a runtime fallback.

### Cost Projection Is Not Spec Validation

A purpose cost projection may read fields from a spec or draft, but it must not
validate the spec for generation.

Allowed cost projection checks:

- the model/provider price key is present or resolvable;
- the price function requires duration and duration is present/readable;
- the price function requires character count and the relevant text length is
  present/readable;
- the price function requires input image count and the count is present;
- the price function requires resolution, image size, quality, aspect ratio,
  audio mode, or voice-control mode and that pricing field is present/readable.

Forbidden cost projection checks:

- prompt is non-empty, except counting characters when character count is a
  pricing input;
- prompt-sheet metadata is valid;
- reference mode is valid;
- dependency kind matches purpose;
- target shot ids match current take shot ids;
- selected assets exist;
- selected asset files have correct media kind;
- route can actually run with selected inputs;
- provider payload matches provider schema;
- local files exist on disk;
- project-relative paths resolve.

If a purpose cannot resolve a provider/model price key without running readiness
logic, the route contract is wrong. The selected setup must store or expose a
price key directly enough for cost projection to use.

### Cost Approval Token

The current approval token is derived from a generation request. That keeps
cost approval tied to prepare and provider payload construction.

Replace it with a cost approval token derived from pricing facts:

```text
price key
pricing inputs
output count
price catalog version or price row identity
estimated cost state
```

At run time:

1. Core prepares the generation through the readiness rail.
2. Core rebuilds the cost projection from the persisted spec and current route
   setup.
3. Core recomputes the cost approval token.
4. The run proceeds only if the provided token matches the current cost
   projection, or if the user supplied an explicit unpriced-cost override for
   an unpriced route.

This keeps cost approval tied to cost, not to unrelated provider payload shape.

Examples:

- Changing an image prompt for a fixed-price image model should not invalidate
  the cost approval token.
- Changing TTS text length should invalidate the cost approval token when the
  price function uses character count.
- Changing video duration should invalidate the cost approval token when the
  price function uses duration.
- Adding an image reference should invalidate the cost approval token only when
  the price function charges for input images or the route's input-image count
  changes a selected cost line.

### Dependency Cost Plan

Create `MediaGenerationCostPlan` as the cost source of truth.

It replaces cost calculation inside dependency readiness inventory.

Proposed shape:

```ts
interface MediaGenerationCostPlan {
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  lines: GenerationCostLine[];
  total: MediaGenerationCostTotal;
  diagnostics: DiagnosticIssue[];
}

interface GenerationCostLine {
  id: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget | null;
  label: string;
  source:
    | { kind: 'root-generation' }
    | { kind: 'generated-dependency'; dependencyId: string }
    | { kind: 'selected-existing-asset'; dependencyId: string };
  estimate: GenerationCostEstimate;
}
```

Rules:

- selected existing assets produce a priced `$0.00` line;
- generated dependencies produce a line even when the dependency draft is not
  runnable yet;
- missing prompt, missing prompt-sheet metadata, and missing selected files do
  not remove the line;
- if a generated dependency is selected for regeneration, it is priced from the
  dependency purpose cost projection, not from a prepared draft spec;
- if a dependency would require user-authored text only for generation, not for
  pricing, the line remains priced;
- if a dependency's price function needs a prompt character count and the prompt
  is missing, the line becomes `missing-pricing-input` for `characterCount`;
- the readiness inventory can reference cost lines by `dependencyId`, but cost
  plan construction must not inspect readiness availability.

### Readiness Inventory

Rename or reshape the current dependency inventory so it is no longer treated
as the price source.

The readiness inventory answers:

- is this dependency satisfied by a concrete asset;
- is the selected asset valid for generation;
- can the dependency draft be materialized into a generation spec;
- can the root generation spec be created;
- what user or agent work remains before generation can run.

It may include `costLineId` or `costEstimate` copied from the cost plan for UI
convenience, but it does not calculate cost.

### Shot Video Take Example

For a Seedance route that requires a prompt sheet:

```text
cost rail
  root final video line:
    provider/model: Seedance route price key
    pricing inputs: duration 9s, resolution 1080p, input image count 1
    result: $2.7216

  prompt-sheet dependency line:
    provider/model: GPT-Image-2 price key
    pricing inputs: image size, quality, output count 1
    result: $0.127
```

The cost rail does not care whether:

- the prompt-sheet draft prompt is empty;
- the prompt-sheet draft is missing `promptSheetVisualStyleId`;
- the prompt-sheet image has not been generated;
- the prompt-sheet asset file does not exist yet;
- the final video prompt mentions the sheet correctly.

The readiness rail cares about those things and reports them separately.

### Scene Dialogue Audio Example

For a TTS audio route priced per character:

```text
cost rail
  provider/model: ElevenLabs voice route price key
  pricing inputs: character count, output count
```

If text exists, estimate returns a number even if the selected Cast Voice is not
ready for generation.

If text is missing, estimate returns:

```text
missing-pricing-input: characterCount
```

It does not return prompt validation errors.

### Final Video Missing Reference Example

For an image-to-video route with one required image input:

- if the image input already exists, dependency cost line is `$0.00`;
- if the image input is planned for generation, dependency cost line uses that
  dependency purpose price;
- if the image file is missing but the route still has one input image slot,
  final video cost uses `inputImageCount: 1`.

The readiness rail may block final run because the file is missing. The cost
rail still estimates.

## Structured Diagnostics

Cost rail diagnostics are limited to cost states.

Approved cost diagnostic codes:

- `CORE_MEDIA_COST_PRICE_INFO_MISSING`
- `CORE_MEDIA_COST_PRICE_ROW_MISSING`
- `CORE_MEDIA_COST_INPUT_MISSING`
- `CORE_MEDIA_COST_INPUT_UNREADABLE`
- `CORE_MEDIA_COST_PROJECTION_MISSING`

Readiness diagnostics keep their current purpose-specific codes, such as:

- `CORE_VIDEO_PROMPT_SHEET_METADATA_INVALID`
- `PROJECT_DATA416`
- `PROJECT_DATA368`
- `CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED`

Those readiness codes must not appear as the reason a cost estimate is
non-numeric.

## Regression Prevention

This plan is not complete unless enforcement exists.

### Static Import Boundaries

Add static architecture tests that fail if cost modules import readiness
modules.

Examples of forbidden imports from cost modules:

```text
prepare*
validate*Spec
provider-payloads
generation-runs
spec-records
project-session path/file resolution helpers
provider-payload-validation
input-file-payload
runGeneration
```

Examples of forbidden imports inside engine pricing modules:

```text
provider-payload-validation
input-file-payload
runner
provider adapters
filesystem helpers
```

The test should scan source imports directly. It should fail loudly with a
message that says estimates must use the cost rail.

### No Readiness Dependencies In Estimation

Add a focused static test over `packages/core/src/server/media-generation/estimation`
that rejects imports or calls to readiness-only code such as:

```text
prepareMediaGenerationSpec
prepareDraftMediaGenerationSpec
prepareShotInputSpec
prepareShotVideoTakeSpec
prepareShotInputProviderPlan
buildShotVideoTakeProviderPayload
validateInputSpecAgainstContext
validateFinalSpecAgainstContext
```

Cost projections may call route catalog readers and pure pricing input
normalizers, but not generation preparation.

This test must be module-boundary based, not a hardcoded list of public
estimate function names. The useful invariant is that estimation modules cannot
depend on readiness preparation, provider payload construction, provider
payload validation, generation runs, project-relative file resolution, or
dependency selection internals.

### No Catch-All Error To Unpriced

Remove catch-all estimate wrappers that turn arbitrary `Error.message` values
into `unpriced`.

The engine and core cost rail should return typed states. A truly unexpected
implementation error should fail as an implementation error, not become a fake
missing-price condition.

Tests should assert that `CORE_VIDEO_PROMPT_SHEET_METADATA_INVALID` and other
readiness codes cannot appear inside cost-plan `unpriced.reason`.

### Invalid-But-Priceable Fixture Tests

Add one shared test matrix with intentionally generation-invalid but
priceable inputs.

Cases:

- fixed-price image spec with empty prompt estimates;
- `shot.video-prompt-sheet` draft missing prompt-sheet metadata estimates;
- `shot.reference-image` draft without title estimates when title is not a
  pricing input;
- final shot-video route with missing required image file estimates from input
  counts;
- final shot-video route with stale target shot ids estimates when pricing
  inputs are present;
- provider payload would fail schema validation but cost projection estimates;
- TTS route with valid text but invalid voice readiness estimates;
- TTS route with missing text returns `missing-pricing-input: characterCount`.

### Naming Enforcement

New files under the cost rail should live under:

```text
packages/core/src/server/media-generation/estimation/
```

Use `cost`, `pricing`, or `estimate` in file and type names when that is the
clearest domain term.

Do not add new estimate code inside:

```text
dependency-inventory.ts
provider-payloads.ts
input-specs.ts
final-specs.ts
generation-runs.ts
```

If a purpose needs pricing behavior, add a purpose-owned cost projection module
under the estimation folder with an explicit name, such as:

```text
estimation/shot-video-take-estimates.ts
estimation/shot-input-dependency-estimates.ts
estimation/scene-dialogue-audio-estimates.ts
```

### Review Checklist Gate

Any future PR touching generation estimates must answer these questions in the
PR description:

- Does this change call prepare, validate, provider payload construction, or
  asset-file resolution from the cost rail?
- Which pricing inputs does the price function require?
- Which tests prove generation-invalid but priceable inputs still estimate?
- Which static test prevents the new code path from drifting into readiness?

## Implementation Slices

### Slice 1: Add Failing Architecture Tests

Add the static import and call-boundary tests first.

They should initially fail against current code because the current estimate
path calls prepare.

This makes the regression visible before the refactor starts.

### Slice 2: Add Engine Cost API

Add `estimateGenerationCost` and the pricing-only contracts in
`packages/engines`.

Move price calculation away from provider payload validation.

The implementation may reuse pure price-row math, but it must not reuse the
provider-payload-building API.

Update engine tests so every pricing function can be exercised from explicit
pricing inputs.

### Slice 3: Add Core Cost Contracts

Add browser-safe/client contracts for cost plans and cost estimates if they are
rendered by Studio or CLI.

Add server-only purpose cost projection input contracts in core.

Update the purpose registry so every current purpose declares a cost projection.

Do not keep a prepare-based fallback.

### Slice 4: Implement Purpose Cost Projections

Implement cost projections for all current media purposes:

- `lookbook.image`
- `lookbook.sheet`
- `cast.character-sheet`
- `cast.profile`
- `cast.voice-sample`
- `location.environment-sheet`
- `location.hero`
- `scene.dialogue-audio`
- `scene.storyboard-sheet`
- `shot.first-frame`
- `shot.last-frame`
- `shot.reference-image`
- `shot.video-prompt-sheet`
- `shot.video-take`

Each projection must document its pricing inputs in tests.

### Slice 5: Split Shot Video Cost Planning From Readiness

Create a shot-video cost plan builder that uses dependency slots only to
enumerate selected/planned cost lines.

It must not call dependency draft preparation.

The existing dependency/readiness inventory can then attach cost lines by
dependency id.

### Slice 6: Update CLI And Studio Estimate Surfaces

Update:

- `renku generation estimate --spec`
- Studio AI Production estimate calls
- shot-video production plan responses
- agent-facing authoring context

They should read the cost plan result and readiness diagnostics as separate
sections.

The UI may show both, but it must not infer estimate availability from
readiness state.

### Slice 7: Delete The Old Estimate Coupling

Delete or rename the old prepare-based estimate functions.

Do not keep aliases.

Do not keep compatibility wrappers that preserve `estimateDraftMediaGenerationSpec`
as a prepare-based path.

Update callers directly.

### Slice 8: Documentation And ADR

Add an accepted decision after implementation, or promote this plan into a
decision before implementation if reviewers want the rule locked first.

Update:

- `docs/architecture/reference/media-generation.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/layers-of-responsibility.md`
- any Studio skill contract that describes estimate behavior.

## Completion Checklist

### Review Area

- [x] The implementation explicitly separates cost rail and readiness rail.
- [x] Reviewers can identify all cost entrypoints by name and file path.
- [x] Reviewers can identify all readiness entrypoints by name and file path.
- [x] No estimate behavior is described as "prepare then estimate."
- [x] No public plan or doc tells agents that missing generation readiness makes
      an estimate unavailable.

### Architecture And Contracts

- [x] `GenerationPriceKey` is defined without prompt, files, paths, or provider
      payload fields.
- [x] `GenerationPricingInputs` contains only pricing dimensions.
- [x] `GenerationCostEstimate` has explicit `priced`, `unpriced`, and
      `missing-pricing-input` states.
- [x] Cost approval tokens are derived from pricing facts, not full generation
      requests.
- [x] The purpose registry requires explicit cost projection for every purpose.
- [x] There is no generic prepare-based estimate fallback.
- [x] Cost modules do not import readiness modules.
- [x] Readiness modules may consume cost results, but cost modules do not
      consume readiness results.
- [x] Dependency readiness inventory is no longer the source of cost truth.
- [x] The cost plan has stable line ids that readiness and UI can reference.

### Engine Implementation

- [x] `estimateGenerationCost` exists in `packages/engines`.
- [x] Engine pricing code does not import provider payload validation.
- [x] Engine pricing code does not construct logical input-file payloads.
- [x] Every existing price function is covered by explicit pricing-input tests.
- [x] Missing model price returns `unpriced`, not a thrown generic error.
- [x] Missing price-row match returns `unpriced`, not a thrown generic error.
- [x] Missing required pricing input returns `missing-pricing-input`.

### Core Implementation

- [x] `buildMediaGenerationCostProjection` and
      `estimateMediaGenerationSpecRecordCost` are the shared cost entrypoints.
- [x] `estimateMediaGenerationSpec` uses the cost rail or is replaced directly.
- [x] `estimateDraftMediaGenerationSpec` uses the cost rail or is replaced
      directly.
- [x] No current estimate entrypoint calls `prepareMediaGenerationSpec`.
- [x] No current estimate entrypoint calls `prepareDraftMediaGenerationSpec`.
- [x] No current estimate entrypoint builds provider payloads.
- [x] No current estimate entrypoint validates provider payloads.
- [x] All current media generation purposes implement cost projections.
- [x] Shot-video final generation cost uses pricing inputs, not prepared
      provider requests.
- [x] Shot-video dependency cost uses pricing inputs, not dependency draft
      preparation.
- [x] Prompt-sheet metadata validation remains in readiness only.

### CLI, Studio, And Agent Surfaces

- [x] `renku generation estimate --spec --json` returns cost states from the
      cost rail.
- [x] Shot-video AI Production shows cost and readiness as separate concepts.
- [x] Authoring context reports cost plan and readiness diagnostics separately.
- [x] Studio does not hide numeric cost because readiness is blocked.
- [x] CLI output does not label readiness failures as unpriced cost.
- [x] Agent skill docs explain that estimates are based only on pricing inputs.

### Regression Tests

- [x] Static import boundary tests fail if cost modules import readiness modules.
- [x] Static tests protect the estimation module boundary without hardcoded
      public estimate function names.
- [x] Static tests fail if engine pricing imports provider payload validation.
- [x] Tests prove empty fixed-price prompts still estimate.
- [x] Tests prove prompt-sheet drafts missing metadata still estimate.
- [x] Tests prove missing generated dependencies can still produce dependency
      cost lines.
- [x] Tests prove missing selected reference files do not block final route
      cost when input counts are known.
- [x] Tests prove stale shot ids do not block cost when pricing inputs are
      present.
- [x] Tests prove TTS missing text returns `missing-pricing-input`, not
      readiness validation.
- [x] Tests prove readiness diagnostic codes do not appear as unpriced reasons.

### Documentation

- [x] `docs/architecture/reference/media-generation.md` describes the cost rail.
- [x] `docs/architecture/core-design-principles.md` states that estimates do
      not run generation validation.
- [x] `docs/architecture/layers-of-responsibility.md` names core and engine
      ownership for cost projection and pricing.
- [x] A decision document records the separation if this plan is accepted.
- [x] Sister Studio Skills instructions are updated if agent estimate workflow
      changes.

### Final Verification

- [x] Focused engine pricing tests pass.
- [x] Focused core cost projection tests pass.
- [x] Focused shot-video cost plan tests pass.
- [x] Focused invalid-but-priceable estimate matrix passes.
- [x] Focused static architecture tests pass.
- [x] `pnpm build:core` passes.
- [x] `pnpm test:core` passes.
- [x] `pnpm test:engines` passes.
- [x] `pnpm test:studio` passes if Studio estimate surfaces changed.
- [x] `pnpm lint` passes.
- [x] `pnpm check` passes.
