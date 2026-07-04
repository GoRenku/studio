# 0107 Single Generation Approval Token Simplification

Status: implemented
Date: 2026-07-04

## Summary

Generation approval has drifted into a larger mechanism than the product needs.

The product rule is simple:

```text
Estimate freely. Approve one live generation at a time.
```

Cost estimates are not generation. The cost rail may inspect the full dependency
to-do list, estimate every likely generation line, and show a full workflow
total. That is useful planning information.

Approval is different. Approval is only a last-mile guard immediately before one
live provider generation runs. Its purpose is to stop an agent, CLI command, or
Studio action from spending provider money without the user seeing and approving
the cost for that specific generation.

This plan simplifies approval back to that product shape.

## What Is Missing Now

The current implementation is close in some places, but it is missing a crisp
architecture boundary.

What is already okay:

- dependency plans do not currently expose approval tokens for each missing
  dependency;
- dependency estimates can price missing generated dependencies as plain cost
  lines;
- dependency estimates can aggregate a full to-do-list total;
- final generation runs still use a caller-provided approval token.

What is wrong or too complex:

- `packages/engines` recomputes an engine-side estimate during `runGeneration`
  and compares approval tokens again;
- that second approval check scans provider payload shape and media URL fields,
  which creates token mismatches with the core cost rail;
- the P1/P2 review comments are symptoms of the engine trying to reconstruct
  Studio-owned pricing facts from provider payloads;
- Kling transient `create-voice` is treated like a separately approved media
  generation, even though product direction says it is mechanical provider setup
  that should happen automatically when needed;
- current docs do not say plainly enough that full-list estimates are allowed
  while graph approvals and graph execution are forbidden.

The missing simplification is not "estimate less." The missing simplification is
"approve less broadly and in fewer layers."

## One Important Limitation

An approval token is a Studio workflow guard. It is not a security sandbox
against arbitrary code execution.

If an agent can run arbitrary local scripts with direct access to provider API
credentials, no in-app approval-token design can stop that agent from bypassing
Studio and calling the provider directly. That problem belongs to credential
access and tool execution policy, not to media-generation dependency planning.

This plan protects the Renku Studio generation surfaces: CLI, Studio server,
core generation services, and Studio-triggered live provider runs.

## Product Rules

### Estimates

The cost rail may:

- walk the full dependency to-do list;
- price every generated dependency line when pricing facts are available;
- price the final root generation line;
- aggregate a total estimated workflow cost;
- include unpriced and missing-pricing-input line states;
- display all of this to users and agents as planning information.

The cost rail must not:

- create approval tokens for dependency lines inside a parent plan;
- create approval bundles;
- imply that a full plan can be run automatically;
- validate generation readiness as part of approval;
- create or run specs.

### Approvals

The approval rail must:

- approve exactly one live generation run;
- use the estimate for the exact spec being run;
- require a caller-provided approval token for priced live generation;
- require an explicit unpriced approval intent for unpriced live generation;
- fail before provider execution when approval is missing or stale.

The approval rail must not:

- walk dependency plans;
- validate dependency readiness;
- approve every missing dependency in a graph;
- approve parent and child generations together;
- generate tokens locally during a run;
- ask `packages/engines` to rediscover Studio pricing facts from provider
  payloads.

### Mechanical Provider Setup

Mechanical provider setup is not user-facing media generation approval.

Current example:

- Kling transient `kling-video/create-voice` creates a short-lived provider
  `voice_id` so a final Kling video request can use selected dialogue audio.

This should happen automatically when needed, use the cache when possible, and
fail clearly when provider setup fails. It should not require a second approval
token and should not reuse the final shot-video approval token.

## Target Approval Contract

The public generation flow remains:

```bash
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
```

For unpriced routes:

```bash
renku generation run --spec <spec-id> --approve-unpriced-cost --json
```

Core owns the only token match:

```ts
const estimate = await estimateMediaGenerationSpec({ specId, projectName, homeDir });

const costApproval = requireMediaGenerationCostApproval({
  mode,
  purpose: estimate.spec.purpose,
  estimate: estimate.estimate,
  approval: parseMediaGenerationRunCostApproval({
    approvalToken: input.approvalToken,
    approveUnpricedCost: input.approveUnpricedCost,
  }),
});
```

After that check passes, the provider run may proceed.

The approval check must use the same cost projection path exposed by
`generation estimate`. It must not build or inspect dependency plans.

## Engine Simplification

`packages/engines` should stop owning approval-token semantics.

Remove from `runGeneration`:

- `GenerationRunCostApproval`;
- `costApproval`;
- `assertLiveCostApproved`;
- engine-side approval token comparison;
- approval-specific pricing input reconstruction from provider payloads;
- direct media URL counting that exists only to make approval hashes match.

`packages/engines` may still keep the standalone `estimateGenerationCost` API.
That API belongs to the cost rail and is called by core cost projections.

`runGeneration` should focus on:

- provider/model lookup;
- logical provider payload construction;
- provider payload validation;
- input file loading;
- live or simulated provider invocation;
- output persistence;
- receipt creation.

If receipt metadata needs `estimatedCostUsd`, core can record the approved
estimate in the media generation run record. The engine runner does not need to
recompute and enforce the approval token to protect that record.

## Review Comment Resolution

### P1: Preserve Zero Media Counts

Do not fix this by adding more normalization to the engine approval gate.

The simpler fix is to remove engine-side approval token matching. Core already
has the cost projection for the single spec being run. That is the approval
basis.

If a Studio purpose needs zero media counts to price correctly, that belongs in
the core cost projection for that purpose, not in an engine payload scanner.

### P2: Count Suffixed Media URL Fields

Do not expand engine URL scanning for approval-token correctness.

The mismatch exists because the engine is trying to derive Studio pricing facts
from provider payload field names. Once engine-side approval token matching is
removed, suffixed provider fields no longer reject a user-approved run.

Pricing accuracy for Studio-owned routes belongs in core purpose cost
projections.

### P2: Do Not Reuse The Shot Approval For Kling Create Voice

Remove approval from Kling transient voice creation.

Kling transient voice creation is mechanical provider setup for the final video
request. It should not validate against the final shot-video token and should
not ask the user for a separate token.

## Implementation Slices

### Slice 1: Add The ADR

Add:

```text
docs/decisions/0043-use-single-generation-approval-tokens.md
```

The ADR must state:

- full dependency estimates are allowed and expected;
- dependency plans are to-do lists, not execution plans;
- parent plans must not expose approval tokens for child dependency lines;
- approval tokens approve one live generation only;
- core is the approval authority for Studio generation surfaces;
- engines do not own approval token matching;
- mechanical provider setup such as Kling transient voice ids does not require
  user cost approval.

Update current architecture docs to point at the ADR:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`.

Do not rewrite old historical plans except where they are current architecture
references.

### Slice 2: Keep Core's Single-Run Approval Gate

Keep `packages/core/src/server/media-generation/cost-approval.ts` focused on the
single generation being run.

Core run paths should follow this shape:

1. read the persisted spec;
2. compute the current cost estimate for that exact spec;
3. validate caller approval against that estimate;
4. prepare provider payload;
5. run the provider;
6. record the run with the approved estimate and approval metadata.

Do not call dependency planning from the approval gate.

Do not create approval tokens inside run paths.

Do not pass child dependency approvals through parent generation runs.

### Slice 3: Remove Engine Approval Token Matching

Update `packages/engines/src/generation/runner.ts` and related contracts:

- remove `GenerationRunCostApproval`;
- remove `costApproval` from `RunGenerationOptions`;
- remove `assertLiveCostApproved`;
- remove approval-token mismatch errors from engine tests;
- remove approval-only payload URL counting tests.

Keep engine cost estimation as a separate exported cost API.

### Slice 4: Simplify Core Calls Into Engines

Update every core run path that calls `runGeneration`:

- keep the core approval check before live generation;
- stop passing `costApproval` into engines;
- keep recording priced approval tokens only when the caller supplied and core
  accepted that token;
- keep recording explicit unpriced approval as structured approval metadata.

Current target areas:

- shared media generation service;
- cast profile and character sheet;
- location hero and environment sheet;
- lookbook image and sheet;
- scene storyboard sheet;
- scene dialogue audio;
- shot-video input generation;
- final shot-video take generation.

### Slice 5: Make Kling Transient Voice Mechanical

Update `packages/core/src/server/media-generation/shot-video-take/kling-transient-voice.ts`:

- remove the `approval` input;
- remove create-voice cost estimation;
- remove `requireMediaGenerationCostApproval` from the transient voice path;
- keep cache lookup and cache write behavior;
- keep clear structured errors when no `voice_id` is produced;
- keep diagnostics that explain whether the cache hit, missed, expired, or was
  skipped.

The final shot-video run still requires normal approval for the final video
generation itself.

### Slice 6: Protect The Boundary With Focused Tests

Add only focused tests that protect the product rule.

Core tests:

- priced live generation without approval fails before provider execution;
- priced live generation with stale approval fails before provider execution;
- priced live generation with current approval reaches provider execution;
- unpriced live generation requires explicit unpriced approval;
- simulated generation does not require approval;
- parent dependency plans do not expose `costApprovalToken` on dependency lines;
- running a persisted spec validates approval for that spec only.

Engine tests:

- `runGeneration` no longer accepts `costApproval`;
- `runGeneration` no longer rejects based on approval-token mismatch;
- provider payload validation still happens before live provider invocation.

Kling tests:

- cached transient voice id does not call create-voice;
- cache miss calls create-voice without approval input;
- final shot-video approval token is not reused for create-voice;
- missing `voice_id` still fails clearly.

Static architecture tests:

- no source file passes `approvalToken: estimate.costApprovalToken` into a run;
- no dependency plan line contract includes `costApprovalToken`;
- no engine runner code imports or references `GenerationRunCostApproval`.

## Non-Goals

This plan does not:

- remove full dependency cost estimates;
- remove dependency to-do lists;
- remove dependency line pricing;
- remove total estimated workflow cost;
- create graph execution;
- create approval bundles;
- create per-dependency approval tokens inside parent plans;
- make estimates exact invoices;
- solve direct provider access by arbitrary local scripts;
- add compatibility aliases for old engine approval options.

## Completion Checklist

### Review And Product Boundary

- [x] Confirm estimates remain allowed to price the full dependency to-do list.
- [x] Confirm approval remains one live generation at a time.
- [x] Confirm no parent plan returns approval tokens for child dependency lines.
- [x] Confirm no parent run can generate missing dependencies.
- [x] Confirm Kling transient voice creation is treated as mechanical provider
      setup, not separately approved media generation.
- [x] Confirm the plan does not add dependency validation to the approval gate.

### ADR And Documentation

- [x] Add `docs/decisions/0043-use-single-generation-approval-tokens.md`.
- [x] Update `docs/architecture/media-generation.md`.
- [x] Update `docs/architecture/reference/media-generation.md`.
- [x] Clarify that full-list estimates are cost planning only.
- [x] Clarify that dependency inventory is a to-do list, not an execution plan.
- [x] Clarify that approval tokens are not graph artifacts.

### Core Approval Gate

- [x] Keep `requireMediaGenerationCostApproval` as the single core token matcher.
- [x] Ensure core approval checks estimate only the exact spec being run.
- [x] Ensure core approval checks do not call dependency planning.
- [x] Ensure run paths never synthesize approval tokens from fresh estimates.
- [x] Ensure run records store caller-approved priced tokens only after core
      validation.
- [x] Ensure unpriced approval remains explicit and single-run.

### Engine Simplification

- [x] Remove `GenerationRunCostApproval`.
- [x] Remove `RunGenerationOptions.costApproval`.
- [x] Remove engine-side approval token comparison.
- [x] Remove approval-only media URL count inference from `runGeneration`.
- [x] Keep standalone `estimateGenerationCost` for the cost rail.
- [x] Keep provider payload validation and file loading in `runGeneration`.

### Kling Transient Voice

- [x] Remove approval input from `resolveKlingTransientVoices`.
- [x] Remove create-voice cost approval checks.
- [x] Remove create-voice cost estimation from the transient voice path.
- [x] Keep cache hit behavior.
- [x] Keep cache miss provider setup behavior.
- [x] Keep clear failure when provider output lacks `voice_id`.

### Tests

- [x] Update core approval tests for missing, stale, current, unpriced, and
      simulated approval states.
- [x] Add a test proving dependency plan lines do not expose approval tokens.
- [x] Update engine runner tests after removing approval matching.
- [x] Update Kling transient voice tests to prove no approval is required.
- [x] Add static tests for forbidden self-approval patterns.

### Final Verification

- [x] Run `pnpm test:engines`.
- [x] Run `pnpm test:core`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm check`.
- [ ] Manually verify a priced run without approval fails before provider
      execution.
- [ ] Manually verify a priced run with the current single-spec token proceeds
      to provider readiness/execution.
- [ ] Manually verify a shot-video run with Kling transient voice does not ask
      for or validate a second create-voice approval token.
