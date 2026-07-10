# 0129 Exact-Request Generation Approval Tokens

Status: proposed
Date: 2026-07-09

## Summary

Renku currently treats priced generation approval tokens as deterministic cost
hashes. That means a token can still match after an agent changes a prompt or
parameters that do not affect price. In practice, the user approves the request
that was previewed: model, route, prompt, parameters, selected inputs, and the
provider request body that Renku is about to send.

The intended fix is deliberately small and pragmatic:

- do not add a SQLite table;
- do not add a migration;
- do not build a durable approval ledger;
- do not write approval state to temp files;
- do not use process-local memory as the cross-CLI correctness mechanism;
- do bind approval to the exact prepared generation request that was estimated
  and previewed;
- do treat the preview dialog/estimate as approval for the request body Renku is
  about to send, including the final prompt text;
- do reject the token when the prompt, provider payload, parameters, model,
  inputs, or output shape change;
- do allow retrying the same exact request when the provider rejects it before a
  successful completed generation;
- do use the existing `media_generation_run` records to detect already
  consumed successful approvals.

This is not a malicious-user security system. It is a guard against the real
workflow failure: an agent estimates, spends or attempts a run, changes the
spec/prompt, and then accidentally reuses the old approval instead of showing
the revised request to the user.

## Context

Accepted references:

- `docs/decisions/0043-use-single-generation-approval-tokens.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/structured-diagnostics.md`
- `docs/architecture/coding-practices.md`

Relevant packages and workflows:

- `packages/core` owns generation approval decisions.
- `packages/engines` owns deterministic cost estimation and provider
  execution.
- `packages/cli` passes approval intent to core and must stay thin.
- `renku generation estimate --spec <spec-id> --json`
- `renku generation run --spec <spec-id> --approval-token <token> --json`
- `shot.video-take` final video generation, including Kling prompt-length
  failures before a usable provider result exists.

The user-facing rule is simple: approval is for the exact request body that was
shown and estimated. If the agent changes the prompt or any other request input,
the old token must fail and the user must see and approve the changed request.
If the same exact request fails mechanically before producing a completed
generation, the same token may be retried.

## Architecture Shape Gate

`packages/core` owns the behavior. Studio server handlers, CLI handlers, React
components, and agents must not independently decide whether a token is fresh.

Public entrypoints stay unchanged:

- `ProjectDataService.estimateMediaGenerationSpec`
- `ProjectDataService.runMediaGenerationSpec`
- `renku generation estimate`
- `renku generation run`

Internal module shape:

- `packages/core/src/server/media-generation/cost/cost-approval.ts`
  continues to parse approval intent and enforce priced/unpriced/simulated
  approval rules.
- Add one focused module,
  `packages/core/src/server/media-generation/cost/request-approval-tokens.ts`,
  that owns:
  - wrapping the deterministic engine cost token into an exact-request approval
    token;
  - canonicalizing the prepared generation request into an approval digest;
  - extracting the embedded engine cost token, spec id, request digest, and
    nonce;
  - checking whether an existing completed non-simulated `media_generation_run`
    already consumed the token.
- `packages/core/src/server/media-generation/lifecycle/spec-estimates.ts`
  issues the exact-request token for persisted spec estimates after preparing
  the same request that the preview/run path will use.
- `packages/core/src/server/media-generation/lifecycle/run-service.ts`
  validates the token against the current prepared request before live provider
  setup/execution and records the token on the completed run.
- `packages/core/src/server/media-generation/purposes/shot-video-take/runs/generation-runs.ts`
  uses the same core request-approval helper before Kling transient setup or
  final provider execution.
- `packages/core/src/server/database/access/media-generation.ts` may add a
  focused query that asks whether a completed non-simulated run already exists
  for an approval token. It must not become a general approval ledger.

No `index.ts` changes are expected. If an export is required, it must be a thin
public entrypoint only and must not contain token logic.

Domain-specific branches:

- The token guard is purpose-agnostic and belongs in media generation cost
  approval.
- Purpose-specific code must only call the shared approval helper before live
  provider work.
- Provider-specific behavior, such as Kling transient voice setup, must not get
  its own approval-token rules.

Explicitly forbidden for this plan:

- no SQLite approval table;
- no Drizzle migration;
- no durable ledger of all issued approvals;
- no temp-file marker;
- no filesystem-backed token state;
- no process-memory token consumption rule as the cross-CLI correctness
  mechanism;
- no CLI-local business rule that core does not enforce;
- no React-local approval rule;
- no agent-only convention as the only protection;
- no broad dispatcher for every generation purpose;
- no compatibility path that accepts old deterministic engine tokens as live
  approval tokens;
- no time-window rule that accepts or rejects a token because enough time has
  passed;
- no automatic prompt compression, prompt rewriting, parameter change, or input
  selection change after approval without producing a fresh preview/estimate.

Stop and revise before implementation if the fix starts needing a new storage
table, temp files, cross-project approval history, provider-specific token
rules, or a new command surface.

## Contracts

Public command shape does not change.

Estimate response contract changes:

- For priced persisted specs, `estimate.costApprovalToken` becomes a
  Renku-owned exact-request approval token rather than the raw deterministic engine
  cost token.
- The token is unique per estimate call even when the spec and cost are
  unchanged.
- The token embeds enough data for core to validate the current run without a
  new approval table:
  - token format version;
  - spec id;
  - approval request digest;
  - engine cost approval token;
  - random nonce.
- The approval request digest is a stable hash of the prepared request Renku is
  approving, including:
  - purpose and target;
  - model/provider/route;
  - prompt text after all deterministic Studio scaffolding;
  - provider payload/request parameters that will be sent;
  - selected input file identities and request roles;
  - output count/names or other output-shape fields that affect the request.
- The digest must not parse, grade, or understand creative prompt content. It
  only fingerprints the prepared request as opaque data.

Run contract changes:

- Live priced runs require the new exact-request token format.
- Core unwraps the token, verifies:
  - the token is well formed;
  - the token spec id matches the persisted spec being run;
  - the token request digest matches the current prepared request;
  - the embedded engine cost token matches the current cost estimate;
  - no completed non-simulated `media_generation_run` already exists with that
    approval token.
- Core records the approval token on the completed non-simulated run.
- A provider validation error, provider rejection, or CLI interruption before a
  successful completed generation does not consume the token.
- Retrying the same exact request with the same token is allowed until a
  completed non-simulated run consumes it.
- Changing the prompt, model, parameters, selected input files, or prepared
  provider request changes the request digest and requires a fresh
  preview/estimate/approval.

Preview and approval contract:

- The Studio preview dialog and CLI estimate are the approval surfaces. They
  must show the final prompt, model/route, settings, selected inputs, and cost
  that correspond to the approval request digest.
- The approval token represents approval of that prepared request body, not a
  generic permission to spend the same amount or use the same model later.
- Agents must not change prompt text, model choice, parameters, selected inputs,
  or any other request-body field after approval and then reuse the old token.
- Agents must not silently rewrite, compress, expand, or otherwise modify a
  prompt after the preview dialog approval and before `renku generation run`.
  Any such change must produce a new preview/estimate and a new approval token.
- If an agent needs to compress a prompt after a provider prompt-length failure,
  that is a changed request. The agent must update the spec, show the new
  preview/estimate, and get a new approval token.
- User-facing UI still does not need to show raw provider JSON when product
  guidance says not to; the approval digest binds to the prepared provider
  request internally, while the user sees the meaningful prompt/settings/input
  projection.

Structured diagnostics:

- `CORE_MEDIA_COST_APPROVAL_TOKEN_INVALID`
- `CORE_MEDIA_COST_APPROVAL_TOKEN_REUSED`
- Existing `CORE_MEDIA_COST_APPROVAL_TOKEN_MISMATCH` remains appropriate when
  request digest or current pricing facts no longer match.

## Implementation Slices

1. Token envelope and request digest helper

   Files:

   - `packages/core/src/server/media-generation/cost/request-approval-tokens.ts`
   - `packages/core/src/server/media-generation/cost/request-approval-tokens.test.ts`

   Work:

   - Add token wrapping and unwrapping.
   - Add canonical request digest calculation from the prepared generation
     request.
   - Add validation that compares the token digest with the current prepared
     request digest.
   - Add validation that rejects tokens already present on completed
     non-simulated generation runs.

2. Persisted estimate issuance

   Files:

   - `packages/core/src/server/media-generation/lifecycle/spec-estimates.ts`
   - purpose prepare/preview helpers if needed to expose the same prepared
     request used by run.
   - existing focused tests for spec estimates.

   Work:

   - Keep the pure cost projection unchanged.
   - Prepare the generation request for the persisted spec.
   - Hash that prepared request into the approval request digest.
   - Wrap priced persisted estimates with a fresh exact-request token.
   - Do not issue exact-request tokens for draft-only cost projections unless
     that workflow is explicitly updated in a separate slice.

3. Run-time consumption before provider work

   Files:

   - `packages/core/src/server/media-generation/cost/cost-approval.ts`
   - `packages/core/src/server/media-generation/lifecycle/run-service.ts`
   - `packages/core/src/server/media-generation/purposes/shot-video-take/runs/generation-runs.ts`
   - `packages/core/src/server/database/access/media-generation.ts`

   Work:

   - Parse and validate the exact-request token before accepting priced live
     runs.
   - Rebuild the current prepared request immediately before provider work and
     compare its digest to the token.
   - Check existing completed non-simulated runs for the same approval token.
   - Record the approval token on the completed run.
   - Do not mark failed pre-acceptance/provider-rejection attempts as consumed.
   - For `shot.video-take`, validate the token before Kling transient provider
     setup.
   - Keep simulated and explicit unpriced flows unchanged.

4. Documentation and agent guidance

   Files:

   - `docs/architecture/reference/media-generation.md`
   - `docs/decisions/0043-use-single-generation-approval-tokens.md`
   - relevant Studio skill guidance in `studio-skills` if it tells agents to
     reuse approval tokens or run immediately after changing a spec.

   Work:

   - Document that approval tokens are exact-request tokens.
   - Document that any changed prompt, model, settings, selected inputs, or
     provider request body requires a fresh preview/estimate and user approval.
   - Keep the docs clear that this is a pragmatic accidental-reuse guard, not a
     malicious-code security boundary.

## Tests And Guardrails

Behavior tests:

- Estimating the same persisted priced spec twice returns two different
  approval tokens.
- Both tokens unwrap to the same deterministic engine cost token and same
  approval request digest.
- Running with a token succeeds and records that approval token on the completed
  non-simulated run.
- Running again with the same token after a completed non-simulated run fails
  before provider execution with `CORE_MEDIA_COST_APPROVAL_TOKEN_REUSED`.
- Changing the persisted prompt after estimate changes the prepared request
  digest and makes the old token fail before provider execution.
- Changing model, parameters, selected inputs, or output shape after estimate
  changes the prepared request digest and makes the old token fail before
  provider execution.
- A provider validation or prompt-length rejection before successful completion
  does not consume the token; retrying the same exact request can reuse the
  token.
- Simulated runs still do not require approval.
- Explicit unpriced approval still works as before.
- `shot.video-take` validates approval before Kling transient provider setup.
- Shot-video prompt compression after a provider rejection invalidates the old
  token because the request digest changes.

Guardrails:

- Add or update a focused architecture/static test only if needed to prevent CLI
  from owning token consumption logic.
- Do not add tests that hard-code private helper names.
- Do not add a test that lists every generation purpose or every service method.

## Documentation

Update current docs only:

- `docs/architecture/reference/media-generation.md`
- `docs/decisions/0043-use-single-generation-approval-tokens.md`
- current agent/skill instructions that describe paid generation approval, if
  they exist outside this repository.

Do not edit historical plans just to rename old approval-token wording.

## Final Verification

Run focused checks:

```bash
pnpm --dir packages/core test -- media-generation
pnpm --dir packages/core type-check
```

If the focused suite touches shared lifecycle behavior heavily, also run:

```bash
pnpm --dir packages/core test
```

Manual inspection:

- Inspect `git diff --stat`.
- Inspect the full diff for `cost-approval.ts`,
  `request-approval-tokens.ts`, `run-service.ts`, and shot-video generation
  runs.
- Confirm no SQLite schema, Drizzle migration, or migration journal changed.
- Confirm no temp-file, filesystem, or other persistent approval-token state was
  added.
- Confirm the only persistent consumption signal is the already-existing
  completed non-simulated `media_generation_run` record.
- Confirm CLI command handlers still only parse flags and call core.
- Confirm no React feature code enforces token freshness locally.
- Confirm approval is bound to the prepared request digest, not just price.
- Confirm the prompt shown in the preview dialog is part of the approved request
  and cannot be silently changed before run.
- Confirm no broad purpose dispatcher or provider-specific token rule was
  introduced.

## Completion Checklist

### Review Area

- [x] Confirm the implementation preserves `packages/core` ownership of
      generation approval.
- [x] Confirm approval is bound to the exact prepared request, including prompt
      text.
- [x] Confirm preview-dialog approval covers the request body to be sent, not
      merely the current price.
- [x] Confirm token reuse is rejected only after a completed non-simulated run
      has consumed that token.
- [x] Confirm no SQLite table, Drizzle migration, or durable approval ledger was
      added.
- [x] Confirm no temp files or filesystem-backed token markers were added.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Keep public CLI command shape unchanged.
- [x] Replace raw deterministic engine approval tokens in persisted estimate
      responses with exact-request approval tokens.
- [x] Reject old deterministic engine tokens for live priced runs.
- [x] Reject approval tokens when the prepared request digest no longer matches.
- [x] Keep simulated and explicit unpriced approval behavior unchanged.
- [x] Keep package-boundary diagnostics structured.
- [x] Keep durable business rules out of CLI, React, and agent-only guidance.

### Implementation Slices

- [x] Add focused exact-request approval token wrapping/unwrapping.
- [x] Add focused prepared-request digest calculation.
- [x] Add focused query for completed non-simulated runs by approval token.
- [x] Issue fresh exact-request tokens from persisted priced estimates.
- [x] Validate exact-request tokens before shared live provider execution.
- [x] Validate exact-request tokens before shot-video Kling transient setup and
      final provider execution.
- [x] Record approval tokens on completed non-simulated runs.
- [x] Leave failed pre-completion provider rejection attempts retryable with the
      same token when the request is unchanged.
- [x] Avoid changing draft estimate approval behavior unless a separate current
      workflow explicitly requires it.

### Tests And Guardrails

- [x] Test unique tokens for repeated estimates of the same spec.
- [x] Test repeated successful use of the same token fails before provider
      execution.
- [x] Test changed prompt invalidates the previous token.
- [x] Test an agent-like prompt rewrite after preview approval cannot run with
      the old token.
- [x] Test changed model/parameters/inputs invalidate the previous token.
- [x] Test provider prompt-length rejection does not consume the token.
- [x] Test prompt compression after rejection requires a new token.
- [ ] Test `shot.video-take` validates approval before Kling transient setup.
- [x] Add a focused architecture/static guard only if implementation drifts
      toward CLI-local token logic.

### Documentation

- [x] Update media-generation reference docs.
- [x] Update ADR 0043 to describe exact-request approval tokens and retry
      semantics.
- [x] Check current Studio skill guidance for token reuse instructions.
- [x] Do not edit historical plans merely for wording cleanup.

### Final Verification

- [x] Run focused core tests.
- [x] Run `pnpm --dir packages/core type-check`.
- [x] Run broader core tests if focused tests show lifecycle coupling.
- [x] Review `git diff --stat` and inspect large changed files.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Confirm the final fix specifically prevents the failed workflow: token was
      approved for one prompt, agent changes the prompt, old token cannot run
      the revised request.
- [x] Confirm the final fix preserves same-request retry after a provider
      prompt-length rejection.
