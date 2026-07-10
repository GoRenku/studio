# 0130 Live Provider Approval Boundary

Status: complete
Date: 2026-07-09

## Summary

Generation approval has drifted back into a complicated estimate-token protocol.
That protocol makes drafts, persisted specs, request digests, raw engine cost
tokens, and exact-preview matching part of the approval contract. The result is
fragile behavior: valid live provider runs can fail because approval was minted
from the wrong estimate path, while direct purpose runners can still miss the
new request-approval data entirely.

The intended product rule is simpler:

```text
Estimates are display-only. A live provider request requires one explicit,
one-time approval immediately before Core sends work to the provider boundary.
```

This plan resets media generation approval to that rule.

The smallest useful scope is:

- remove approval tokens from estimate responses and skill instructions;
- replace cost-approval tokens with a simple explicit live-run approval intent;
- have `packages/core` generate an internal approval id only when recording the
  resulting live run in the existing media generation run table;
- route every Core live provider call through one small approval helper;
- update CLI, Studio server, Studio browser flows, and `studio-skills` guidance
  so agents approve live provider runs directly instead of treating estimates as
  approval artifacts.

This plan supersedes the direction in
`plans/active/0129-exact-request-generation-approval-tokens.md`. Plan 0129
should not be implemented as written.

## Context

Accepted references that constrain the work:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/coding-practices.md`
- `docs/decisions/0009-use-structured-diagnostics-at-package-boundaries.md`
- `docs/decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `docs/decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `docs/decisions/0043-use-single-generation-approval-tokens.md`
- `docs/decisions/0044-use-media-generation-module-boundaries.md`

Active plans this plan corrects or replaces:

- `plans/active/0106-generation-cost-approval-fail-fast-hardening.md`
- `plans/active/0107-single-generation-approval-token-simplification.md`
- `plans/active/0129-exact-request-generation-approval-tokens.md`

Relevant packages and companion projects:

- `packages/core` owns media generation domain policy, run orchestration,
  provider-boundary approval, generation run persistence, and structured errors.
- `packages/engines` owns provider adapters, provider request validation,
  simulation, provider invocation, output persistence, and receipts. It must not
  own Studio approval policy.
- `packages/cli` parses explicit run approval intent and calls Core.
- `packages/studio` gathers browser user intent and sends it to the Studio
  server. The server remains a thin adapter.
- `$HOME/Projects/aitinkerbox/studio-skills` owns agent-facing workflow
  instructions. Any approval contract change must update this repo in the same
  implementation slice.
- `$HOME/renku-movies/urban-basilica` is the realistic sample project for
  manual workflow verification.

Current failure examples motivating this reset:

- `estimateSceneDialogueAudioDraft` returns an estimate from a draft spec, then
  `generateSceneDialogueAudioTake` persists a different real spec before running
  it. Exact request tokens make that draft/persisted split user-visible.
- `generateLocationHeroFromSheet` creates a spec and calls a purpose-local live
  runner. That runner calls approval code without request-approval data, so
  priced live hero generation fails before provider execution.

## Architecture Shape Gate

### Owner

`packages/core` owns the live provider approval boundary.

The approval boundary is not owned by:

- estimates;
- `packages/engines`;
- Studio server routes;
- CLI handlers;
- React components;
- agent skills.

### Public Entrypoints

The public run flow becomes:

```bash
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approve-live-provider-run --json
renku generation run --spec <spec-id> --simulate --json
```

The estimate command remains useful for showing cost state, but it returns no
approval token.

The run command is the approval surface. `--approve-live-provider-run` means:

```text
The user approves this command invocation to contact the selected live provider
once for the prepared generation request Core is about to run.
```

Core-facing service inputs use explicit approval intent, not an approval token:

```ts
interface RunMediaGenerationSpecInput {
  specId: string;
  simulate?: boolean;
  approveLiveProviderRun?: boolean;
}
```

CLI passes `approveLiveProviderRun: true` when
`--approve-live-provider-run` is present. Studio browser flows pass the same
explicit intent after a user approval gesture. No approval id is exposed to CLI,
Studio, or agents.

No public command, Studio server request, or ProjectDataService method should
continue to use:

- `approvalToken`;
- `approveUnpricedCost`;
- `estimate.costApprovalToken`;
- `renku-request-approval:v1:*`;
- raw engine `sha256:*` approval tokens.

No compatibility aliases are allowed for those names.

### Internal Module Shape

Expected Core files:

- `packages/core/src/server/media-generation/lifecycle/live-provider-approval.ts`
  owns the single approval check and internal approval id creation for live
  provider runs.
- `packages/core/src/server/database/access/media-generation.ts`
  keeps the existing run insertion path that records the internal approval id on
  persisted live runs.
- `packages/core/src/server/media-generation/lifecycle/run-service.ts`
  prepares generic persisted specs, resolves output paths, and invokes the
  live-provider approval check immediately before provider execution.
- `packages/core/src/server/media-generation/purposes/shot-video-take/runs/generation-runs.ts`
  may keep shot-video specific run orchestration, but it must use the same
  live-provider approval check before any live provider setup or final provider
  run.
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
  keeps purpose lookup focused. This plan does not require a broad registry
  rewrite.
- `packages/core/src/server/media-generation/cost/*`
  owns pricing and estimate projection only. It must not own approval tokens.

Expected files to shrink or disappear:

- `packages/core/src/server/media-generation/cost/cost-approval.ts`
  should either disappear or shrink to non-approval pricing helpers. The
  approval policy moves to `live-provider-approval`.
- `packages/core/src/server/media-generation/cost/request-approval-tokens.ts`
  should be deleted.
- Purpose-local `run*Spec` implementations should not duplicate approval logic.
  Delete or route them through shared lifecycle code only when that is the
  smallest clean change for a touched flow.

Expected database shape:

- Do not add a new approval table.
- Reuse the existing `media_generation_run` table and its approval column as the
  durable record that a live run had explicit approval.
- The public contract should not expose that stored approval id. It is internal
  run metadata.
- No Drizzle migration is required solely for live provider approval.
- Do not store request digests, prompt hashes, provider payload hashes, estimate
  tokens, or approval bundles.

### Domain Branches

Approval branches are limited to:

- simulated run: no live provider approval required;
- live run with explicit approval intent: create an internal approval id and
  continue;
- live run without explicit approval intent: fail before provider execution.

Approval must not branch by:

- media generation purpose;
- provider;
- model;
- priced versus unpriced estimate state;
- draft versus persisted estimate source;
- prompt contents;
- provider payload shape.

Purpose-specific branches stay in purpose modules for validation, preparation,
preview, output placement, import, and shot-video orchestration. Any purpose
module that still calls the provider must call the shared live-provider approval
helper immediately before provider execution.

### Registry And Dispatcher Shape

The existing media generation purpose registry remains the bounded registry for
purpose lifecycle operations. This plan must not add a new broad approval
dispatcher.

If the registry keeps a run hook, that hook must not contain local approval
policy. It may route to purpose-specific orchestration only when that
orchestration still uses the shared live-provider approval helper.

Do not add a switch statement that maps every purpose to local approval logic.

### Forbidden Code Shape

Explicitly forbidden:

- estimate-issued approval tokens;
- request-digest approval tokens;
- approval token wrapping/unwrapping;
- raw engine approval token acceptance;
- draft-spec approval token handling;
- local purpose-runner approval checks for generic purposes;
- CLI-generated cost tokens;
- Studio server-generated business approval rules;
- React-only approval enforcement;
- agent-only approval conventions as the safety boundary;
- broad compatibility branches that accept old `approvalToken` or
  `approveUnpricedCost` inputs;
- provider-specific approval rules;
- prompt parsing, prompt scoring, provider payload hashing, or creative
  artifact inspection as part of approval;
- an approval table or ledger separate from `media_generation_run`;
- a catch-all helper that combines CLI parsing, estimate projection, provider
  execution, run persistence, and Studio notifications.

Stop and revise the plan before implementation continues if:

- the easiest fix is to mint another token from an estimate;
- a purpose module starts deciding approval validity;
- the live-provider gate starts inspecting prompts or provider payload details;
- a new table starts storing approval state, request digests, or estimate
  history;
- the run service grows into a god function that handles every purpose-specific
  concern inline;
- skills documentation still tells agents to use `estimate.costApprovalToken`.

## Contracts

### Estimate Contract

`renku generation estimate` and ProjectDataService estimate methods return cost
state only.

Allowed estimate responsibilities:

- show provider/model/media kind;
- show estimated cost when known;
- show unpriced or unavailable cost state;
- show warnings or missing pricing information when useful;
- support planning and review.

Forbidden estimate responsibilities:

- approving a run;
- returning an approval token;
- returning a reusable approval artifact;
- binding approval to a preview;
- starting provider execution.

`GenerationCostEstimate` should no longer expose `costApprovalToken` in the
Studio public contract. If `packages/engines` currently computes a deterministic
pricing hash for internal pricing tests, that value must not appear as a Studio
approval artifact.

### Run Contract

Live runs require `approveLiveProviderRun: true`.

Core behavior:

- `simulate: true` skips the live provider approval gate.
- `simulate: false` or omitted requires `approveLiveProviderRun: true`.
- Core creates an internal approval id immediately before live provider
  execution.
- Core records that internal id on the `media_generation_run` row when the run
  is persisted.
- No reusable approval artifact is returned to the caller.

The approval intent does not assert that the estimate is exact. It only proves
that the caller brought explicit approval for this live provider run attempt.

### CLI Contract

Replace:

```bash
renku generation run --spec <spec-id> --approval-token <token> --json
renku generation run --spec <spec-id> --approve-unpriced-cost --json
```

with:

```bash
renku generation run --spec <spec-id> --approve-live-provider-run --json
renku generation run --spec <spec-id> --simulate --json
```

CLI behavior:

- `--simulate` never requires live provider approval.
- A live run without `--approve-live-provider-run` fails before calling Core's
  provider execution path.
- When `--approve-live-provider-run` is present, CLI passes
  `approveLiveProviderRun: true` to Core.
- CLI output should not print live approval ids as reusable user artifacts.
- CLI must not continue to parse old approval flags.

### Studio Server And Browser Contract

Studio browser behavior:

- Preview remains a review surface.
- Estimate remains a cost display surface.
- The Generate action sends `approveLiveProviderRun: true` only after the user
  approves a live run.
- The browser should avoid duplicate in-flight submissions as ordinary UI
  pending-state behavior, not as an approval-token protocol.

Studio server behavior:

- Read the request body.
- Forward `approveLiveProviderRun` to Core.
- Serialize structured Core errors.
- Do not decide whether the provider request is approved.

### Dialogue Audio Contract

Dialogue audio generation no longer needs draft-estimate approval behavior.

Allowed flow:

- estimate the current setup for display;
- save or persist the current setup/spec through Core as needed;
- when the user clicks Generate, send the setup plus
  `approveLiveProviderRun: true`;
- Core prepares the actual request it will run and checks approval intent once
  before live provider execution.

The run does not fail merely because the estimate came from a draft. The
estimate is not approval.

### Location Hero Contract

`generateLocationHeroFromSheet` creates the current location hero spec and then
runs it through the shared media generation run path with
`approveLiveProviderRun: true`.

The local `runLocationHeroSpec` path must not own approval or provider
execution for public live runs.

### Diagnostics

Use structured Core-prefixed diagnostics.

Planned codes:

- `CORE_MEDIA_LIVE_PROVIDER_APPROVAL_REQUIRED`
  - live provider generation was requested without approval.

Remove or retire runtime use of exact-token approval diagnostics:

- `CORE_MEDIA_COST_APPROVAL_TOKEN_INVALID`
- `CORE_MEDIA_COST_APPROVAL_TOKEN_MISMATCH`
- `CORE_MEDIA_COST_APPROVAL_TOKEN_REUSED`

Do not add diagnostics that recognize obsolete token shapes by name. Runtime
validation should describe the current contract only.

## Implementation Slices

### Slice 1: Core Approval Boundary

Expected files:

- `packages/core/src/server/media-generation/lifecycle/live-provider-approval.ts`
- `packages/core/src/server/database/access/media-generation.ts`
- Focused Core tests for the live approval check.

Work:

- Add the explicit `approveLiveProviderRun` contract.
- Generate an internal approval id only for live run records that pass the
  approval check.
- Reuse the existing `media_generation_run` approval column to store that
  internal id.
- Add a structured error for missing live provider approval.
- Add one small approval helper that provider-boundary code calls immediately
  before live provider execution.
- Confirm the gate does not read estimates, request digests, prompts, provider
  payloads, or purpose-specific data beyond audit fields such as `specId` and
  `purpose`.

### Slice 2: Remove Estimate Approval Tokens

Expected files:

- `packages/core/src/client/media-generation-lifecycle.ts`
- `packages/core/src/server/media-generation/lifecycle/spec-estimates.ts`
- `packages/core/src/server/media-generation/cost/spec-estimates.ts`
- `packages/core/src/server/media-generation/cost/request-approval-tokens.ts`
- estimate tests under `packages/core/src/server/media-generation`.
- engine cost estimate types only if `costApprovalToken` leaks through the
  public Studio estimate contract.

Work:

- Remove `costApprovalToken` from public estimate responses.
- Delete exact-request token wrapping and request digest code.
- Keep estimates useful as pricing display only.
- Update tests to assert estimates do not carry approval artifacts.

### Slice 3: Shared Provider Execution Path

Expected files:

- `packages/core/src/server/media-generation/lifecycle/run-service.ts`
- `packages/core/src/server/media-generation/lifecycle/purpose-lifecycle-registry.ts`
- generic purpose modules under
  `packages/core/src/server/media-generation/purposes`.
- `packages/core/src/server/media-generation/purposes/shot-video-take/runs/generation-runs.ts`

Work:

- Route every Core call to `runGeneration` through the shared live approval
  helper.
- Do not remove purpose-local `run*Spec` implementations merely for cleanup.
  Remove or reroute one only when the touched flow becomes simpler.
- Keep `shot.video-take` specialized orchestration only where needed, and call
  the same approval helper before live provider setup/execution.
- Change `generateLocationHeroFromSheet` so its live provider call uses the
  shared approval helper. Route through the shared run path only if that is the
  smaller clean implementation.
- Ensure `generateSceneDialogueAudioTake` no longer depends on approval from a
  draft estimate.

### Slice 4: Public API, CLI, And Studio Server

Expected files:

- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/cli` generation run command files.
- Studio server HTTP request readers and routes that currently parse
  `approvalToken` or `approveUnpricedCost`.
- Studio services and hooks that currently store estimate approval tokens.
- Server and browser tests for generation run requests.

Work:

- Replace public `approvalToken` and `approveUnpricedCost` inputs with
  `approveLiveProviderRun`.
- Add CLI `--approve-live-provider-run`.
- Remove CLI parsing for old approval flags.
- Update Studio browser generation flows to send explicit live-run approval
  intent after a user approval gesture.
- Keep route handlers thin: parse request, call Core, serialize response.

### Slice 5: Skill Instructions And Agent Workflow

Expected files in `$HOME/Projects/aitinkerbox/studio-skills`:

- `skills/media-producer/SKILL.md`
- `skills/media-producer/references/workflow.md`
- `skills/media-producer/references/shot-video-take/renku-workflow.md`
- `skills/media-producer/references/shot-video-take/storyboard-reference-image.md`
- `skills/movie-director/SKILL.md`
- `skills/movie-director/references/specialist-handoff-checklists.md`
- `skills/movie-director/references/workflow-playbooks.md`
- any other skill reference found by searching for:
  - `approvalToken`
  - `costApprovalToken`
  - `approval token`
  - `--approval-token`
  - `--approve-unpriced-cost`

Work:

- Replace "estimate returns approval token" guidance with:

  ```text
  Estimate is pricing-only. Before a real provider-backed run, ask the user to
  approve the estimated cost or unknown-cost state and approve sending the
  current project-derived prompt/context to the selected provider. Then run once
  with `renku generation run --spec <spec-id> --approve-live-provider-run --json`.
  ```

- Keep preview and estimate review gates where they help users understand what
  will be sent.
- Remove instructions that agents must preserve or reuse estimate tokens.
- Remove instructions that changed prompts require a new approval token. The new
  rule is simpler: changed prompts require renewed user review and a fresh live
  run approval gesture before another provider call.
- Preserve the sandbox/network permission guidance for real provider-backed
  runs.
- Keep Codex built-in image generation guidance: no Renku spec, estimate, live
  provider approval, run receipt, or approval id.

### Slice 6: Documentation And ADR Correction

Expected files:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/decisions/0043-use-single-generation-approval-tokens.md`
- this plan, if implementation discovers necessary contract corrections.

Work:

- Update architecture docs to state that estimates do not approve runs.
- Amend or replace ADR 0043 so it no longer says priced estimates return exact
  request approval tokens.
- Document the current live-provider approval boundary and run-row approval
  recording.
- Mark plan 0129 as superseded only if the team wants active plan statuses kept
  mutually exclusive during implementation.

## Tests And Guardrails

Behavior tests:

- estimate responses for priced specs do not include approval tokens;
- live generic generation without `approveLiveProviderRun` fails before provider
  execution;
- live generic generation with `approveLiveProviderRun: true` reaches provider
  execution and records an internal approval id when the run is persisted;
- simulated generation does not require approval and does not record a live
  approval id;
- unpriced or unknown-cost live generation still requires the same live provider
  approval intent, not a separate unpriced flag;
- dialogue audio generation succeeds with explicit live approval regardless
  of whether the preceding estimate came from a draft flow;
- location hero from sheet creates the spec and reaches the shared run gate;
- shot video take live generation uses the same gate before provider setup or
  final provider execution.

CLI tests:

- `renku generation run --spec <spec-id>` fails for live runs with the new
  required-approval diagnostic;
- `renku generation run --spec <spec-id> --approve-live-provider-run --json`
  passes explicit approval intent to Core;
- `--simulate` does not require approval;
- old flags are not accepted.

Studio server/browser tests:

- server request parsing forwards `approveLiveProviderRun` only;
- browser generate actions do not store approval from estimate responses;
- browser sends explicit approval intent for a live Generate action;
- duplicate in-flight submissions are handled as ordinary pending-state UI
  behavior, not through approval-token reuse.

Architecture/static guardrails:

- production code outside the live-provider approval module and database access
  must not reference `costApprovalToken`;
- production code must not reference `renku-request-approval`;
- Core provider calls should go through the shared live approval helper rather
  than importing `runGeneration` directly in each purpose module;
- generic purpose modules must not import live approval internals;
- Studio server routes must not import database approval access;
- CLI code must not generate or parse estimate approval tokens;
- architecture tests should check boundaries by import path and forbidden
  capability names, not by private helper inventories.

Skill guardrails:

- `studio-skills` search for old approval terms returns no active instruction
  telling agents to use estimate approval tokens or `--approval-token`.
- media-producer workflow examples use `--approve-live-provider-run`.
- movie-director non-negotiables say paid provider generation requires estimate
  review when available and explicit live provider approval, not an estimate
  token.

## Documentation

Update:

- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/decisions/0043-use-single-generation-approval-tokens.md`
- CLI command help and command reference for `renku generation run`
- Studio server API request documentation if present
- `studio-skills` media-producer and movie-director workflows listed in Slice 5

Do not edit historical or archived plans merely to replace old terms.

## Final Verification

Focused commands:

```bash
pnpm build:core
pnpm test:cli
pnpm --dir packages/core test
pnpm --dir packages/studio test
```

Root commands when the slice touches CLI, Studio, Core, and shared contracts:

```bash
pnpm check
pnpm test
pnpm build
```

Manual verification:

- In a test project or `$HOME/renku-movies/urban-basilica`, run an estimate and
  confirm the JSON has no approval token.
- Run a simulated generation and confirm no approval is required.
- Attempt a live generation without `--approve-live-provider-run` and confirm it
  fails before provider network execution.
- Run a live generation with `--approve-live-provider-run` only when explicitly
  approved for real provider spend.
- Verify dialogue audio and location hero flows no longer depend on estimate
  approval tokens.
- Search `studio-skills` for old approval-token instructions.

Architecture-shape review:

- inspect `git diff --stat`;
- inspect any newly large or heavily modified files;
- confirm no new god file, catch-all module, or broad dispatcher was created;
- confirm `index.ts` files remain thin entrypoints unless this plan explicitly
  allowed otherwise;
- confirm generic purpose modules do not own provider approval;
- confirm behavior was not fixed by moving estimate-token complexity into a new
  helper with a simpler name.

## Completion Checklist

### Review Area

- [x] Confirm the implementation preserves accepted package boundaries.
- [x] Confirm estimates are display-only and no longer approve provider runs.
- [x] Confirm live provider approval is enforced in Core, not in CLI, Studio
      server, React, engines, or agent instructions.
- [x] Confirm centralized approval ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Replace public `approvalToken` and `approveUnpricedCost` contracts with
      `approveLiveProviderRun` or the CLI `--approve-live-provider-run` flag.
- [x] Remove `estimate.costApprovalToken` from public estimate responses.
- [x] Delete exact-request token wrapping, parsing, request digesting, and raw
      engine token acceptance from Studio runtime code.
- [x] Reuse the existing `media_generation_run` approval column for approval
      use records; do not add a separate approval table.
- [x] Keep package-boundary errors structured with the new Core diagnostic
      codes.
- [x] Keep durable approval recording behind Core-owned run persistence.
- [x] Keep provider execution approval separate from cost estimate projection.
- [x] Keep Studio server handlers thin.
- [x] Keep CLI handlers thin.

### Implementation Slices

- [x] Complete Slice 1: Core approval boundary.
- [x] Complete Slice 2: remove estimate approval tokens.
- [x] Complete Slice 3: shared provider execution path.
- [x] Complete Slice 4: public API, CLI, and Studio server/browser updates.
- [x] Complete Slice 5: `studio-skills` instructions and agent workflow.
- [x] Complete Slice 6: documentation and ADR correction.
- [x] Route remaining Core provider calls through the shared approval helper.
- [x] Update dialogue audio generation so draft estimates are not approval
      sources.
- [x] Update location hero from sheet so its provider call uses the shared
      approval helper.
- [x] Split implementation modules before adding more branches when a file
      starts collecting unrelated responsibilities.

### Tests And Guardrails

- [x] Add behavior tests for missing, approved, and simulated approval states.
- [x] Add dialogue audio regression coverage.
- [x] Add location hero from sheet regression coverage.
- [x] Add shot video take gate coverage.
- [x] Add CLI command tests for the new approval flag and removed old flags.
- [x] Add Studio server/browser tests for `approveLiveProviderRun`.
- [x] Add architecture/static tests for forbidden approval-token terms and
      provider execution imports.
- [x] Add or update skill-doc searches to catch old approval-token instructions.
- [x] Run the shape-review checks listed in Final Verification.

### Documentation

- [x] Update media generation architecture docs.
- [x] Amend or replace ADR 0043.
- [x] Update CLI help/reference.
- [x] Update `studio-skills` media-producer workflow.
- [x] Update `studio-skills` shot-video-take Renku workflow.
- [x] Update `studio-skills` movie-director handoff guidance.
- [x] Do not edit historical plans merely for naming sweeps.

### Final Verification

- [x] Run focused Core tests.
- [x] Run focused CLI tests.
- [x] Run focused Studio tests.
- [x] Run root checks when the full contract has changed.
- [x] Search Core, CLI, Studio, and `studio-skills` for obsolete approval-token
      terms.
- [x] Review `git diff --stat`.
- [x] Inspect large changed files.
- [x] Confirm `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
