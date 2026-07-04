# 0106 Generation Cost Approval Fail-Fast Hardening

Status: completed
Date: 2026-07-03
Completed: 2026-07-03

## Summary

Media generation cost approval has become too easy to bypass by accident.

The immediate bug is that some purpose-specific run paths can compute a fresh
cost approval token and pass that token into the engine as if the caller had
approved the paid live run. The larger architecture problem is that cost
approval is currently assembled locally in several run paths through loose
optional strings and fallback-style ternaries.

This plan makes cost approval a single fail-fast contract:

- estimates remain approximate product guidance, not exact invoices;
- live paid generation still requires explicit caller approval;
- unpriced live generation still requires explicit caller approval;
- missing pricing inputs fail before provider execution;
- no code may synthesize approval tokens or sentinel approval strings to make a
  run proceed;
- core owns the approval decision before provider execution;
- engines verify the typed approval contract as a second safety gate.

This plan is a follow-up to
`plans/active/0104-generation-cost-estimate-architecture-reset.md`. Plan 0104
separates cost estimates from readiness and says estimates should not pretend to
be exact generation validation. This plan hardens the approval rail without
reintroducing exact-estimate thinking.

## Product Rule

The product rule is:

```text
Estimates are estimates. They are ballparks, not exact invoices.
```

The approval system must not treat tiny estimate differences as correctness
failures. For example, an image estimate drifting by a fraction of a cent
because a project frame resolves from `project` to `4:3` instead of `16:9` is
not itself a user-facing correctness bug.

The approval system still must enforce explicit approval before live provider
spend. Approximate pricing does not mean implicit approval.

The right architecture is:

- cost estimates are approximate enough for user decision-making;
- approval tokens represent the intended cost approval scope;
- live generation fails fast if the caller did not provide that approval;
- provider execution never receives a locally invented approval token.

## Current Failure Modes

### Purpose Runners Can Self-Approve

Some purpose-specific run paths follow this shape:

```ts
approvalToken:
  estimate.state === 'priced'
    ? estimate.costApprovalToken
    : input.approvalToken ?? 'unpriced-cost-override'
```

For priced live runs, this can turn the freshly computed estimate token into
the run approval token.

Concrete example:

```ts
await generateLocationHeroFromSheet({
  projectName,
  homeDir,
  locationId,
  sourceLocationSheetAssetId,
  simulate: false,
});
```

Expected behavior:

- core computes the current estimate;
- core sees that the caller supplied no approval token;
- core throws a structured approval-required error;
- no provider request is made.

Broken behavior:

- core computes the current estimate;
- core passes `estimate.costApprovalToken` to `runGeneration`;
- engines see the expected token and allow the live request.

That is an approval bypass. The token is comparison data, not permission.

### Unpriced Overrides Use A Sentinel String

The same fallback pattern uses this synthetic value:

```ts
'unpriced-cost-override'
```

That string is not a user approval artifact. It is a local convenience value
that makes a lower-level optional token parameter look satisfied.

Unpriced live generation must be approved through an explicit typed state, not
through a magic fallback string.

### Approval Rules Are Duplicated

Approval behavior is currently distributed across:

- shared media generation run service;
- Location hero run path;
- Lookbook image run path;
- Lookbook sheet run path;
- Cast profile and character sheet run paths;
- Location environment sheet run path;
- scene storyboard sheet run path;
- shot-video take run helpers;
- engine `runGeneration`.

That duplication makes each new purpose runner responsible for reconstructing
cost approval policy. Every local reconstruction is an opportunity to add a
fallback, omit a state, or accidentally pass the computed token as caller
approval.

### Engine API Encourages Loose Approval Handling

`runGeneration` currently accepts loose options:

```ts
approvalToken?: string;
allowUnpricedCost?: boolean;
```

This shape allows callers to pass nothing, pass a freshly computed token, or
pass an invented string. The API does not communicate the domain difference
between:

- priced approval;
- unpriced explicit approval;
- simulated generation;
- missing approval.

The engine should receive a typed cost approval decision, not optional strings.

### Estimate Approximation And Approval Matching Are Conflated

Some review comments have treated small pricing input differences as if the
estimate must exactly match the provider payload. That conflicts with the
product rule.

The real issue is not that every estimate must be exact. The real issue is that
approval tokens should be derived from an intentional approval basis. That basis
should include meaningful cost dimensions and exclude product-irrelevant detail
that would make approved runs fail over tiny estimate drift.

## Non-Goals

This plan does not make estimates exact.

This plan does not require cost projection to mirror provider payload
construction.

This plan does not move project-specific meaning, such as the `project` image
frame, into `packages/engines`.

This plan does not add UI-side approval enforcement as the safety boundary.
Studio may request and pass approval tokens, but `packages/core` must enforce
the rule.

This plan does not preserve compatibility for old option names, sentinel
strings, or loose approval shapes.

This plan does not add generic fallback behavior for old approval tokens,
missing approval fields, or obsolete run options.

## Package Responsibilities

### Core

`packages/core` owns media generation approval policy:

- decides whether the request is simulated or live;
- computes the current cost estimate or cost plan;
- validates caller approval against the current approval basis;
- distinguishes priced approval from explicit unpriced approval;
- throws structured errors for missing, stale, mismatched, or invalid approval;
- records approval metadata in media generation run records;
- exposes the same approval behavior to CLI, Studio server, and agent flows.

Core must be the only layer that decides whether a user intent is allowed to
become live provider spend.

### Engines

`packages/engines` owns provider execution and the final provider-facing safety
gate:

- receives a typed cost approval state from core;
- derives the engine-side cost estimate from the generation request;
- rejects live execution when the typed approval state does not satisfy the
  estimate state;
- never accepts synthetic approval strings as unpriced overrides;
- never creates approval on behalf of callers.

Engines may protect itself from bad callers, but it does not own Studio's user
approval workflow.

### Studio Server

The Studio server remains a thin adapter:

- reads HTTP params and request body;
- forwards approval token or explicit unpriced approval intent to core;
- serializes structured core errors;
- does not decide whether a model can run without approval.

### CLI

The CLI remains a thin adapter:

- parses `--approval-token` for priced approval;
- parses an explicit unpriced approval flag when supported;
- calls core;
- prints structured diagnostics.

The CLI must not generate approval tokens during a run command.

### Studio Browser

The browser may display approximate estimates and ask the user to approve.

It must not be the enforcement layer. If the browser omits approval data or
passes stale approval data, core rejects the run.

## Approval Contract

Replace loose approval inputs with a typed contract.

Proposed core-facing input:

```ts
type MediaGenerationRunCostApprovalInput =
  | { kind: 'none' }
  | { kind: 'priced'; approvalToken: string }
  | { kind: 'unpriced-explicit-approval' };
```

Where current public APIs already expose optional fields, the first
implementation slice may parse them at the boundary into this typed shape:

```ts
function parseMediaGenerationRunCostApproval(input: {
  approvalToken?: string;
  approveUnpricedCost?: boolean;
}): MediaGenerationRunCostApprovalInput
```

That parser is temporary only as an internal implementation bridge inside the
same slice. Public callers should be updated directly to the typed or renamed
contract. Do not keep compatibility aliases.

Proposed validated core result:

```ts
type ValidatedMediaGenerationCostApproval =
  | { kind: 'simulated' }
  | { kind: 'priced'; approvalToken: string }
  | { kind: 'unpriced-explicit-approval' };
```

Core should produce this result through one function:

```ts
function requireMediaGenerationCostApproval(input: {
  mode: 'simulated' | 'live';
  purpose: MediaGenerationPurpose;
  estimate: GenerationCostEstimate;
  approval: MediaGenerationRunCostApprovalInput;
}): ValidatedMediaGenerationCostApproval
```

Rules:

- simulated generation returns `{ kind: 'simulated' }`;
- priced live generation requires `approval.kind === 'priced'`;
- priced live generation requires `approval.approvalToken` to match the current
  cost approval token;
- unpriced live generation requires
  `approval.kind === 'unpriced-explicit-approval'`;
- missing pricing input always fails for live generation;
- no branch returns a synthetic token;
- no branch accepts a missing approval because a fallback value exists.

## Engine Contract

Change `runGeneration` from loose approval options to a typed approval option.

Current shape:

```ts
approvalToken?: string;
allowUnpricedCost?: boolean;
```

Proposed shape:

```ts
costApproval?: GenerationRunCostApproval;
```

```ts
type GenerationRunCostApproval =
  | { kind: 'priced'; approvalToken: string }
  | { kind: 'unpriced-explicit-approval' };
```

Rules inside `runGeneration`:

- simulated mode must not require `costApproval`;
- live mode with a priced estimate requires
  `{ kind: 'priced', approvalToken: estimate.costApprovalToken }`;
- live mode with an unpriced estimate requires
  `{ kind: 'unpriced-explicit-approval' }`;
- live mode with missing pricing inputs fails;
- live mode with no `costApproval` fails;
- live mode with the wrong approval kind fails;
- no `allowUnpricedCost` flag remains;
- no sentinel approval string remains.

The engine still recomputes the cost estimate as a provider-execution safety
gate, but it does not create approval data.

## Approval Token Basis

Approval tokens should represent the product's cost approval scope, not exact
provider payload identity.

Use the cost rail from plan 0104 as the token source:

```text
price key
meaningful pricing inputs
output count
price row identity or price catalog version
estimate state
```

Meaningful pricing inputs are the inputs the price function actually uses, such
as:

- duration;
- character count;
- output count;
- input media counts;
- major quality, resolution, or image-size class when the price row uses it.

Do not include provider payload details whose only effect is tiny estimate
drift or readiness behavior.

Examples:

- Changing TTS text length should invalidate approval when the model charges by
  character count.
- Changing video duration should invalidate approval when the model charges by
  duration.
- Adding a billable input image should invalidate approval when the model
  charges per input image.
- Editing fixed-price prompt text should not invalidate approval.
- Changing a project image frame should invalidate approval only if that frame
  is a meaningful pricing dimension for that provider/model, not because the
  readiness payload happens to use a different token.

## Direct URL Input Counts

Direct media URL inputs are a separate engines issue that should be fixed as
part of this hardening when they affect material cost categories.

If a caller passes:

```ts
request: {
  parameters: {
    image_url: 'https://provider-upload.example/source.png',
  }
}
```

and the model charges per input image, the engine pricing gate should count one
input image unless `pricingInputCounts.image` explicitly overrides that count.

Rules:

- `pricingInputCounts` remains the explicit override;
- otherwise engines may count known media URL fields in the logical payload;
- the count should cover direct `image_url`, `image_urls`, `audio_url`,
  `audio_urls`, `video_url`, and `video_urls`;
- nested provider payload fields may be covered by a small generic walker when
  the field name clearly represents a media URL;
- core should still provide explicit counts for complex domain routes where it
  knows the intended billable input count better than payload shape can.

This is not an exact-estimate rule. It is a material billable-category rule.

## Run Record Metadata

Media generation run records must not store fake approval token strings.

For priced runs:

```ts
approval: {
  kind: 'priced',
  approvalToken: callerApprovalToken,
}
```

For unpriced explicit approval:

```ts
approval: {
  kind: 'unpriced-explicit-approval',
}
```

For simulated runs:

```ts
approval: {
  kind: 'simulated',
}
```

If the current database schema only has a flat `approvalToken` field, the
implementation may keep it temporarily for priced runs while adding a structured
field in the same schema update. Because Studio is pre-customer software, do
not add compatibility readers that preserve old sentinel values. Update current
callers and tests to the new shape.

## Structured Errors

Use stable core error codes for approval failures.

Proposed codes:

- `CORE_MEDIA_COST_APPROVAL_REQUIRED`
- `CORE_MEDIA_COST_APPROVAL_TOKEN_MISMATCH`
- `CORE_MEDIA_COST_UNPRICED_APPROVAL_REQUIRED`
- `CORE_MEDIA_COST_APPROVAL_KIND_INVALID`
- `CORE_MEDIA_COST_INPUT_MISSING`

Messages should distinguish:

- no approval was supplied;
- a stale or mismatched priced token was supplied;
- an unpriced route needs explicit unpriced approval;
- a priced route received unpriced approval instead of a priced token;
- a live run cannot proceed because pricing inputs are missing.

Suggestions should tell the caller how to fix the current run:

- estimate again and pass the returned token;
- explicitly approve unpriced generation;
- fill the missing pricing inputs;
- use simulation mode if they do not intend live provider spend.

## Forbidden Patterns

The following patterns are banned from media generation run paths:

```ts
estimate.state === 'priced' ? estimate.costApprovalToken : input.approvalToken
```

```ts
input.approvalToken ?? 'unpriced-cost-override'
```

```ts
allowUnpricedCost: true
```

```ts
approvalToken: estimate.costApprovalToken
```

Allowed pattern:

```ts
const costApproval = requireMediaGenerationCostApproval({
  mode,
  purpose,
  estimate,
  approval,
});
```

Then pass the validated typed result to the engine:

```ts
await runGeneration({
  ...generation,
  mode,
  costApproval: generationRunCostApproval(costApproval),
});
```

## Implementation Slices

### Slice 1: Add The Core Approval Gate

Add a focused core module for media generation cost approval.

Suggested file:

```text
packages/core/src/server/media-generation/cost-approval.ts
```

It should own:

- approval input and validated approval types;
- `requireMediaGenerationCostApproval`;
- structured approval errors;
- conversion from validated core approval to engine approval input.

Do not put purpose-specific logic in this module. Purpose-specific callers pass
the purpose only for error messages and locations.

### Slice 2: Change The Engine Run API

Update `packages/engines/src/generation/runner.ts` and contracts so live runs
use typed approval.

Remove:

- `approvalToken?: string`;
- `allowUnpricedCost?: boolean`;
- string sentinel handling.

Add tests that prove:

- live priced generation rejects no approval;
- live priced generation rejects stale approval;
- live priced generation accepts matching priced approval;
- live unpriced generation rejects no approval;
- live unpriced generation accepts explicit unpriced approval;
- live missing-pricing-input generation fails even with explicit unpriced
  approval;
- simulated generation does not require approval.

### Slice 3: Replace Purpose-Specific Approval Logic

Update every core run path to call the shared approval gate before
`runGeneration`.

Targets include:

- shared media generation service;
- Location hero;
- Location environment sheet;
- Lookbook image;
- Lookbook sheet;
- Cast profile image;
- Cast character sheet;
- scene storyboard sheet;
- scene dialogue audio;
- shot-video take generation run helpers;
- Kling transient voice helper if it runs live provider generation directly.

Each path should:

- compute the current cost estimate or cost plan;
- call `requireMediaGenerationCostApproval`;
- pass typed engine approval;
- record structured approval metadata;
- avoid local fallback ternaries.

### Slice 4: Rename Unpriced Approval Inputs

Rename public and internal inputs from:

```ts
allowUnpricedCost
```

to:

```ts
approveUnpricedCost
```

or:

```ts
approveUnpricedCostOverride
```

Choose one name during implementation and update callers directly.

Do not keep aliases. Do not accept both names. Do not add compatibility shims.

### Slice 5: Remove Sentinel Values

Remove all uses of:

```text
unpriced-cost-override
```

No production code, tests, docs, or plans for current behavior should preserve
that sentinel as a recognized runtime concept.

Tests may mention it only inside a regression test whose purpose is to prove
the sentinel is absent from current source.

### Slice 6: Harden Direct URL Pricing Counts

In `packages/engines`, derive billable input media counts from direct logical
payload URL fields when explicit `pricingInputCounts` are absent.

Keep this generic and provider-agnostic. Do not add a Grok-specific branch in
core.

### Slice 7: Add Static Regression Tests

Add focused static tests for forbidden approval fallback patterns.

Suggested assertions:

- no source file contains `'unpriced-cost-override'`;
- no core media generation run path passes `approvalToken:
  estimate.costApprovalToken`;
- no source file uses `allowUnpricedCost`;
- no engine run options expose `approvalToken?: string`;
- no engine run options expose `allowUnpricedCost?: boolean`.

Use narrow tests with clear failure messages. Avoid broad brittle scans outside
the relevant source roots.

## Validation Strategy

Focused package tests:

```bash
pnpm test:engines
pnpm test:core
```

Full verification when the slices are complete:

```bash
pnpm test
pnpm check
```

Manual verification should use a real project when possible:

```text
$HOME/renku-movies/urban-basilica
```

Manual scenarios:

- estimate a priced generation and run with no token: fails before provider
  execution;
- estimate a priced generation and run with stale token: fails before provider
  execution;
- estimate a priced generation and run with current token: succeeds or reaches
  the provider readiness path;
- run simulated generation with no token: succeeds without approval;
- choose an unpriced model and run live without explicit approval: fails;
- choose an unpriced model and run live with explicit unpriced approval:
  proceeds to readiness/provider execution;
- direct URL image-to-video request records a nonzero input image count when
  the price row charges for input images.

## Completion Checklist

### Review And Architecture

- [x] Confirm plan 0104 remains the source of truth for approximate cost
      estimates and cost/readiness separation.
- [x] Confirm this plan does not reintroduce exact provider-payload validation
      into cost estimates.
- [x] Confirm approval policy is owned by `packages/core`, not Studio routes,
      CLI handlers, React components, or agent workflows.
- [x] Confirm `packages/engines` receives typed approval only as a provider
      execution safety gate.
- [x] Confirm no new compatibility layer preserves old approval option names.

### Core Contracts

- [x] Add `MediaGenerationRunCostApprovalInput`.
- [x] Add `ValidatedMediaGenerationCostApproval`.
- [x] Add `requireMediaGenerationCostApproval`.
- [x] Add structured errors for missing, stale, invalid-kind, unpriced, and
      missing-pricing-input approval failures.
- [x] Add conversion from validated core approval to engine approval input.
- [x] Ensure simulated generation does not require approval.
- [x] Ensure priced live generation requires caller-supplied current approval.
- [x] Ensure unpriced live generation requires explicit unpriced approval.
- [x] Ensure missing pricing inputs fail fast before provider execution.

### Engine Contracts

- [x] Replace `approvalToken?: string` with typed `costApproval`.
- [x] Remove `allowUnpricedCost?: boolean`.
- [x] Update `assertLiveCostApproved` to discriminate typed approval.
- [x] Ensure engine live runs cannot be started with no cost approval.
- [x] Ensure engine live runs cannot satisfy unpriced approval through a string.
- [x] Ensure simulated engine runs remain approval-free.
- [x] Add direct URL media input count derivation when explicit counts are
      absent.
- [x] Preserve explicit `pricingInputCounts` as the highest-priority count.

### Purpose Run Paths

- [x] Update shared media generation service.
- [x] Update Location hero generation.
- [x] Update Location environment sheet generation.
- [x] Update Lookbook image generation.
- [x] Update Lookbook sheet generation.
- [x] Update Cast profile image generation.
- [x] Update Cast character sheet generation.
- [x] Update scene storyboard sheet generation.
- [x] Update scene dialogue audio generation.
- [x] Update shot-video take generation helpers.
- [x] Update Kling transient voice generation if it calls `runGeneration`
      directly.
- [x] Confirm every path records approval metadata from the validated approval
      result, not from a synthetic token.

### Naming And API Cleanup

- [x] Rename `allowUnpricedCost` to the chosen explicit approval name.
- [x] Update CLI flags, Studio server DTOs, core service inputs, tests, and UI
      callers directly.
- [x] Do not keep old option aliases.
- [x] Do not add compatibility warnings for the old name.
- [x] Remove all references to `'unpriced-cost-override'`.

### Regression Tests

- [x] Add core tests for priced live generation without approval.
- [x] Add core tests for priced live generation with stale approval.
- [x] Add core tests for priced live generation with current approval.
- [x] Add core tests for unpriced live generation without explicit approval.
- [x] Add core tests for unpriced live generation with explicit approval.
- [x] Add core tests for missing-pricing-input live generation.
- [x] Add purpose-specific regression coverage for Location hero self-approval.
- [x] Add engine tests for typed live approval behavior.
- [x] Add engine tests for direct `image_url` input image counts.
- [x] Add engine tests for direct `audio_url` and `video_url` counts if price
      rows exist or can be represented in the test catalog.
- [x] Add static tests for banned fallback patterns.

### CLI, Studio Server, And Browser

- [x] Update CLI run commands to pass typed or renamed approval inputs into
      core.
- [x] Update Studio server request DTOs to forward approval intent without local
      policy decisions.
- [x] Update browser calls to use the renamed unpriced approval field.
- [x] Confirm UI estimate copy continues to present estimates as approximate.
- [x] Confirm structured approval errors serialize through the existing server
      error path.

### Documentation

- [x] Update `docs/architecture/reference/media-generation.md` with the typed
      approval contract.
- [x] Document the durable approval contract in accepted architecture docs;
      no separate ADR was added for this slice.
- [x] Update CLI docs for the renamed unpriced approval flag.
- [x] Remove docs that describe sentinel approval strings as current behavior.

### Final Verification

- [x] Run `pnpm test:engines`.
- [x] Run `pnpm test:core`.
- [x] Run `pnpm test`.
- [x] Run `pnpm check`.
- [x] Manually verify priced approval failure against a real project; paid live
      success was covered by automated tests rather than provider execution.
- [x] Verify unpriced explicit approval behavior through core and engine tests.
- [x] Confirm no provider execution occurs before approval failures are thrown.
- [x] Confirm no current source file contains fallback approval token
      generation.
