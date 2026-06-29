# 0092 Shot Video Take Authoring State Resolution

Status: completed
Date: 2026-06-29

## Summary

This plan resolves the Shot Video Take authoring review findings by making one
core-owned authoring report builder responsible for persisted, proposed, and
post-apply authoring reports.

It also records the product direction for how agent proposals, Studio UI edits,
and final generation state interact:

- Studio is the visual feedback, override, and instruction surface.
- Agents must read the current take state before proposing changes.
- The agent authoring document is a complete proposal for the current take
  authoring state, not a partial patch.
- Core validates the complete proposed state before applying it.
- Apply returns both the prior state and the current state so the agent can
  compare what changed.
- Final generation reads the persisted database state as the source of truth,
  giving users one last chance to tweak settings in Studio.
- Skills must teach agents to re-read the final take before generation and
  revise prompts when user-edited settings affect prompt intent.

This plan is a follow-up to:

- `plans/active/0088-shot-video-take-structure-modes.md`
- `plans/active/0089-agent-shot-video-take-cli-and-skills.md`
- `plans/active/0090-shot-video-take-reference-scope-remediation.md`
- `plans/active/0091-uniform-take-reference-sheet-selection.md`
- `docs/architecture/shot-video-take-structure-modes.md`

## Problem

The current authoring implementation has the right broad shape, but it does not
yet have one coherent state-resolution model.

Today validation partly builds a proposed take, but validation and apply reports
can fall back to id-based rereads of the persisted take. That creates drift
between:

- the take state the agent proposed;
- the take state that validation actually checked;
- the take state the report describes;
- the take state final generation will later use.

Concrete failures from review:

- A multi-cut authoring apply can write the database and then fail while
  building the return report because the reread lacks `selectedShotId`.
- Validation can return a report for the stored take instead of the proposed
  authoring document.
- Unsupported model, input mode, and shot-group combinations can throw a
  `ProjectDataError` without diagnostic issues, causing validation to report
  success.
- Validation can accept non-contiguous shot ids that apply later rejects.
- Authoring apply reports can omit top-level project metadata, so CLI Studio
  refresh notifications are skipped.

These are not separate caller bugs. They all point to one missing core concept:
a proposed Shot Video Take authoring state needs to be prepared, validated,
reported, and applied through the same domain path.

## Product Direction

### Studio Feedback Is Durable User Intent

Users are expected to give feedback through Studio while working with the
agent.

Examples:

- the preferred model;
- the input mode;
- route parameter choices;
- composition and motion intent;
- selected Character Sheets and Location Sheets;
- selected or excluded reference cards;
- final prompt draft edits.

Those Studio edits are not secondary UI state. Once saved through core, they
are durable take state and must be treated as user intent.

The agent must read that state before proposing a new authoring document. If
the agent wants to preserve a user choice, it must copy it into the complete
proposal. If the agent wants to change a user choice, it must do so explicitly
in the proposal.

Core should not infer merge intent from missing fields. The authoring document
is a complete replacement for the take-owned authoring fields it contains.

### Agent Proposal Becomes The Current Proposed State

The agent's authoring document should be treated as the current proposal during
validation and apply.

Validation should answer this question:

```text
If this authoring document became the current take, what would the context,
production plan, preflight, provider preview, diagnostics, and warnings be?
```

Apply should answer this question:

```text
What did the take look like immediately before this write, and what does it
look like now?
```

To make agent review more reliable, apply JSON should include both:

- `prior`: the persisted authoring report immediately before the write;
- `current`: the applied authoring report that is now persisted.

Validation JSON should include:

- `prior`: the persisted authoring report at validation time;
- `current`: the proposed authoring report built from the submitted document.

This gives the agent a deterministic second chance to compare the current
proposal against the previous state and repair accidental overwrites.

### Final Generation Uses Persisted State

Final generation must read the database state as the source of truth.

This is deliberate. After the agent applies a proposal, the user may still make
final edits in Studio before approving a paid generation run. Those user edits
must win because they are the latest persisted state.

Generation planning and spec creation should validate the final persisted take:

- required fields and required provider inputs produce errors;
- optional missing choices produce warnings when they affect readiness or
  quality;
- stale prompt drafts produce errors or warnings according to the existing
  preflight rules;
- unsupported route combinations produce structured errors.

Because model, input mode, route parameters, selected references, and
composition choices can affect prompt content, the source skills must require
agents to re-read the final take before generation. If the final persisted
state differs from the proposal in a way that affects the prompt, the agent
must warn the user and revise the prompt before creating or running generation
specs.

## State Model

Use these terms consistently in contracts, code, tests, and skills.

### Persisted Take

The durable `SceneShotVideoTake` stored in the project database.

This is the state Studio and final generation read.

### Prior Authoring State

The persisted take state immediately before validating or applying an agent
authoring document.

For validation, this is a comparison baseline.

For apply, this is the state that will be replaced if stale-write protection
passes.

### Proposed Authoring State

The in-memory take state created from the submitted
`SceneShotVideoTakeAuthoringDocument`.

It is not a patch. It replaces the authoring-owned fields in the prepared take:

- ordered `shotIds`;
- `SceneShotVideoTakeStructure`;
- `SceneShotVideoTakeProductionState`.

Non-authoring-owned durable fields, such as ids, scene ownership, source shot
list ownership, output media history, and existing prompt state that is not
owned by the document, remain core-owned.

### Current Authoring State

The state that callers should consider current in the response:

- for `read`: the persisted take;
- for `validate`: the proposed in-memory take;
- for `apply`: the persisted take after the write.

### Final Generation State

The persisted take state read immediately before final spec creation or
generation.

Agents must not generate from stale apply output if the user has continued
editing in Studio.

## Architecture Requirements

Core owns all state resolution, validation, report building, and durable
mutation.

Studio server handlers remain thin:

- parse HTTP params and request bodies;
- call core;
- serialize core reports and structured errors.

CLI handlers remain thin:

- parse flags and files;
- call core;
- print JSON or human output;
- emit Studio resource-change events from top-level mutation metadata.

React feature code remains a projection consumer:

- display core reports;
- send user intent to the server;
- do not decide authoring merge rules locally.

No implementation may:

- add a generic take-state patch API;
- add route-local, CLI-local, or React-local validation to compensate for
  missing core validation;
- merge authoring documents heuristically;
- preserve obsolete authoring shapes;
- add compatibility aliases for previous report fields;
- let validation and apply use different shot membership rules;
- let validation reports describe a different document than the submitted
  authoring document.

## Target Contracts

### Authoring Snapshot

Introduce a report concept for one authoring state snapshot.

Suggested name:

```text
SceneShotVideoTakeAuthoringSnapshot
```

Suggested shape:

```ts
interface SceneShotVideoTakeAuthoringSnapshot {
  document: SceneShotVideoTakeAuthoringDocument;
  context: ShotVideoTakeProductionContext;
  productionPlan: ShotVideoTakeProductionPlanReport;
  preflight: ShotVideoTakePreflightReport;
  providerPreview: ShotVideoTakeProviderPayloadPreview;
  resourceKeys: string[];
}
```

The exact type name can change if the implementation finds a clearer domain
name, but the concept must stay explicit.

This snapshot is the unit built by the shared report builder. It can be built
from persisted state or from a proposed in-memory take.

### Read Report

`readSceneShotVideoTakeAuthoringContext` should return the current persisted
authoring snapshot.

It may keep the existing top-level report name:

```text
SceneShotVideoTakeAuthoringContextReport
```

But internally it should be built through the shared snapshot builder.

### Validation Report

`validateSceneShotVideoTakeAuthoringDocument` should return both prior and
current state:

```ts
interface SceneShotVideoTakeAuthoringValidationReport {
  valid: true;
  document: SceneShotVideoTakeAuthoringDocument;
  prior: SceneShotVideoTakeAuthoringSnapshot;
  current: SceneShotVideoTakeAuthoringSnapshot;
  warnings: DiagnosticIssue[];
}
```

In validation, `current` means proposed current state.

Do not build `current` by rereading the take id from the database.

### Apply Report

`applySceneShotVideoTakeAuthoringDocument` should return both prior and current
state plus top-level mutation metadata:

```ts
interface SceneShotVideoTakeAuthoringApplyReport {
  valid: true;
  document: SceneShotVideoTakeAuthoringDocument;
  project: {
    id: string;
    name: string;
    projectFolder: string;
  };
  prior: SceneShotVideoTakeAuthoringSnapshot;
  current: SceneShotVideoTakeAuthoringSnapshot;
  resourceKeys: string[];
}
```

Use a top-level `project` report, not a top-level `projectName` convenience
field. This keeps the CLI notification adapter thin and matches other mutation
reports.

If the final implementation chooses a shared project report type, it should be
owned by core and imported by both CLI and Studio-facing contracts.

## State Resolution Rules

### Complete Replacement For Authored Fields

The authoring document is a complete replacement for the fields it owns.

It must include:

- target take identity;
- scene id;
- source shot list id;
- stale-write token;
- ordered shot ids;
- structure;
- production state.

Core does not merge missing direction fields, missing production fields, or
missing reference selections from the prior state. Missing required document
fields are validation errors.

Optional production fields may be absent only when the current domain contract
allows them to be absent. Their absence should flow into preflight warnings or
errors according to generation readiness rules.

### Stale Writes Reject

If `baseTakeUpdatedAt` does not match the current persisted take, apply must
reject with structured diagnostics.

This is the correct behavior when the user has edited the take in Studio after
the agent read context. The agent must re-read, incorporate the user's latest
feedback, and submit a fresh complete proposal.

### Prior And Current Comparison Is Informational

The prior/current response helps agents compare changes. It must not become an
implicit compatibility or merge layer.

Core should not return an automatic "repair" or "merged" document unless that
becomes an explicit future command with its own product decision.

### Selected Shot For Reports

Authoring reports need one editor scope for reference and production-plan
preview sections.

Rules:

- continuous reports must not require a selected shot;
- continuous reports should reject an explicit selected shot when the contract
  is an editor-scope read;
- multi-cut reports need a selected grouped shot for editor-scoped sections;
- when apply or validation needs to build a report for a multi-cut current
  state and the caller did not provide a selected shot, core should choose the
  first canonical grouped shot from the current/proposed `shotIds`.

The default selected-shot choice belongs in the core authoring report builder,
not in CLI or Studio adapters.

## Core Implementation Slices

### Slice 1: Shared Shot Membership Normalization

Move the take shot membership rule out of the database access implementation
into a focused core domain helper.

Suggested concept:

```text
normalizeSceneShotVideoTakeShotMembership
```

The helper should validate and canonicalize:

- at least one shot id;
- every shot id exists in the source Scene Shot List;
- no duplicates;
- selected shot ids are contiguous in source shot order;
- returned shot ids are canonical source shot order.

It should support structured diagnostics so authoring validation can collect
all useful issues before failing.

Database write paths may still use the helper, but they should not be the only
place where the rule exists.

### Slice 2: Proposed Take Preparation

Add one focused preparation path that turns a validated authoring document into
a proposed prepared take.

Suggested concept:

```text
prepareSceneShotVideoTakeAuthoringProposal
```

Responsibilities:

- assert the authoring document schema;
- read the persisted target take;
- validate scene and source shot list identity;
- validate stale-write token;
- normalize shot membership through the shared helper;
- build `SceneShotVideoTakeState` version 2;
- validate structure mode and directions against normalized shot ids;
- validate direction-scoped reference ownership;
- build a proposed `ShotVideoTakeProductionContext`;
- return prior persisted context and proposed current context.

This path should be used by both validation and apply.

### Slice 3: Context-Based Authoring Report Builder

Add one report builder that accepts a prepared authoring state instead of
rereading by take id.

Suggested concept:

```text
buildSceneShotVideoTakeAuthoringSnapshot
```

Responsibilities:

- build `SceneShotVideoTakeAuthoringDocument` from the supplied take;
- build production plan report from the supplied context;
- build preflight from the supplied context;
- build provider preview from the supplied context and preflight;
- resolve the report selected shot consistently;
- return resource keys from the supplied context.

`readSceneShotVideoTakeAuthoringContext` should call the builder after building
context from persisted state.

`validateSceneShotVideoTakeAuthoringDocument` should call the builder for both
prior and proposed state.

`applySceneShotVideoTakeAuthoringDocument` should call the builder for prior
and applied current state without using an id-only reread that can drift from
the proposal.

### Slice 4: Context-Based Preflight And Plan Reports

Keep production planning and preflight source-of-truth behavior in core.

Add or expose context-based builder functions where the current code only has
id-based readers.

Suggested concepts:

```text
previewShotVideoTakeProductionForContext
buildShotVideoTakeProductionPlanReport
```

`buildShotVideoTakeProductionPlanReport` already exists in the production-plan
module. The authoring builder should use context-based functions like that
instead of calling readers that reconstruct context from persisted state.

The preflight path should similarly support a context-based build so proposed
documents can be evaluated without pretending they are already persisted.

### Slice 5: Structured Route Compatibility Diagnostics

Unsupported route combinations are validation failures, not thrown empty
errors.

Add one route compatibility diagnostic path in the shot-video production domain.

Suggested concept:

```text
validateShotVideoTakeRouteCompatibility
```

It should produce a structured diagnostic when no route exists for:

- model choice;
- input mode;
- shot group mode.

The diagnostic should point at the production fields, for example:

- `production.modelChoice`;
- `production.inputModeId`.

`planShotVideoTakeProductionForContext` should not throw an empty-issue
`ProjectDataError` for route incompatibility. It should either:

- return diagnostics through the plan path and block validity; or
- throw a `ProjectDataError` with structured issues.

Authoring validation should then surface the route issue as part of the
document validation result.

### Slice 6: Apply Without Post-Mutation Report Failure

Apply should validate the complete proposed state before mutation.

The mutation should then be short and deterministic:

1. re-open the project session;
2. re-check stale-write token against the current persisted take;
3. write normalized shot membership and state;
4. read the written take metadata needed for updated timestamps;
5. close the transaction.

The returned current report should be built from the validated current state
plus the written metadata, or from a post-write context read that goes through
the same authoring snapshot builder and selected-shot resolver.

It must not call a read path that requires selected-shot data without supplying
or deriving that selected shot.

### Slice 7: Top-Level Mutation Metadata

Add top-level `project` and `resourceKeys` to the apply report.

The CLI should continue using its generic resource-change helper:

- read top-level `project`;
- read top-level `resourceKeys`;
- append Studio resource-changed event.

Do not update the CLI helper to inspect authoring-specific nested context
shapes. That would make the CLI aware of domain report internals.

## CLI And Skill Workflow

### CLI Workflow

The standard agent-facing workflow remains:

```bash
renku take authoring context --take <take-id> --json
renku take authoring validate --file <authoring-document.json> --json
renku take authoring apply --file <authoring-document.json> --json
```

After this plan:

- context output is the current persisted snapshot;
- validate output includes `prior` and proposed `current`;
- apply output includes `prior` and applied persisted `current`;
- apply emits Studio resource-change notifications because top-level project
  metadata is present.

### Skill Workflow

Update the sister skills project after the core and CLI contracts are accepted:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

The `media-producer` shot-video guidance should teach:

1. read authoring context before proposing changes;
2. treat Studio-edited state as user intent;
3. write a complete authoring document, carrying forward any user choices that
   should be preserved;
4. validate and inspect `prior` versus proposed `current`;
5. apply and inspect `prior` versus applied `current`;
6. ask for user review in Studio when appropriate;
7. re-read the final persisted take before generation;
8. compare final persisted settings to the prompt assumptions;
9. revise prompts or warn the user when final settings changed prompt-relevant
   intent;
10. run paid generation only from the final persisted state after approval.

The skill must not instruct agents to rely on memory from an earlier apply
response when the user may have continued editing in Studio.

## Diagnostics Direction

Use structured diagnostics from `@gorenku/studio-diagnostics`.

Suggested diagnostic areas:

- `CORE_SHOT_VIDEO_TAKE_AUTHORING_STALE_CONTEXT`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_TARGET_MISMATCH`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOT_UNKNOWN`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOT_DUPLICATE`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_SHOTS_NOT_CONTIGUOUS`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_ROUTE_UNSUPPORTED`
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_PROVIDER_PREVIEW_UNAVAILABLE`

Existing codes can be retained when they are already current-domain codes. Do
not create diagnostics for obsolete shapes.

Validation should collect all actionable issues where possible. Apply should
fail before mutation when validation finds blocking errors.

## Expected File Areas

Likely core files:

- `packages/core/src/client/shot-video-take.ts`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/core/src/server/media-generation/shot-video-take/authoring.ts`
- `packages/core/src/server/media-generation/shot-video-take/authoring.test.ts`
- `packages/core/src/server/media-generation/shot-video-take/production-plan.ts`
- `packages/core/src/server/media-generation/shot-video-take/preflight-report.ts`
- `packages/core/src/server/media-generation/shot-video-take/route-settings.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-context.ts`
- `packages/core/src/server/media-generation/shot-video-take/take-state.ts`
- `packages/core/src/server/database/access/scene-shot-video-takes.ts`

Likely CLI files:

- `packages/cli/src/commands/take-command.ts`
- `packages/cli/src/cli.test.ts`

Likely docs and skills:

- `docs/architecture/shot-video-take-structure-modes.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/reference/studio-skills.md`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer`
- `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/movie-director`

Do not edit historical plans solely to rename concepts.

## Non-Goals

- No generic take-state patch API.
- No partial authoring document merge semantics.
- No automatic conflict resolution between user Studio edits and agent
  proposals.
- No compatibility fields for old authoring report shapes.
- No CLI-specific business validation.
- No Studio-server-specific authoring merge behavior.
- No final generation from stale agent memory.

## Completion Checklist

Use this checklist for implementation review and final signoff.

### Review Area

- [x] Confirm this plan supersedes ad hoc fixes for the current authoring
      review findings.
- [x] Confirm the authoring document remains a complete proposal, not a patch.
- [x] Confirm Studio-edited persisted state is treated as user intent.
- [x] Confirm stale writes reject rather than merge.
- [x] Confirm final generation reads the persisted database state.
- [x] Confirm agents are instructed to re-read final state before generation.
- [x] Confirm no caller-side workaround replaces core-owned validation.

### Product Contract

- [x] Define prior, proposed, current, and final generation state in the
      public or architecture docs.
- [x] Define validation output as prior persisted state plus proposed current
      state.
- [x] Define apply output as prior persisted state plus applied current state.
- [x] Define that prior/current comparison is informational and not a merge
      layer.
- [x] Define that user edits after apply win because final generation reads
      persisted state.
- [x] Define skill guidance for prompt-relevant setting changes before
      generation.

### Core Report Builder

- [x] Add an authoring snapshot report type or equivalent focused contract.
- [x] Add one context-based authoring snapshot builder.
- [x] Make read authoring context use the shared builder.
- [x] Make validation use the shared builder for prior and proposed current
      state.
- [x] Make apply use the shared builder for prior and applied current state.
- [x] Resolve selected shot for multi-cut reports inside core.
- [x] Ensure continuous reports do not require selected shot state.
- [x] Ensure provider preview failures become preview issues, not unstructured
      report-builder crashes.

### Proposed State Preparation

- [x] Add a focused proposed-authoring preparation path.
- [x] Validate target scene id against the persisted take.
- [x] Validate source shot list id against the persisted take.
- [x] Validate stale-write token.
- [x] Build state version 2 from the document.
- [x] Preserve only core-owned non-document fields intentionally.
- [x] Reject invalid structure mode and direction mismatches.
- [x] Validate direction-scoped reference ownership.
- [x] Return both prior persisted context and proposed current context.

### Shot Membership

- [x] Extract shot membership normalization into a core domain helper.
- [x] Validate non-empty shot ids.
- [x] Validate all shot ids exist in the source Scene Shot List.
- [x] Validate no duplicate shot ids.
- [x] Validate contiguous grouped shot ids.
- [x] Return canonical source-order shot ids.
- [x] Use the same helper from authoring validation.
- [x] Use the same helper from database apply paths.
- [x] Add structured diagnostics for authoring validation failures.

### Production Plan And Preflight

- [x] Add or expose context-based preflight building.
- [x] Use context-based production plan report building for proposed state.
- [x] Ensure validation reports reflect proposed production changes.
- [x] Ensure route compatibility errors carry structured diagnostic issues.
- [x] Ensure unsupported model/input/shot-group combinations cannot validate
      as successful.
- [x] Ensure optional missing generation inputs produce warnings where the
      current generation contract expects warnings.
- [x] Ensure required missing generation inputs produce blocking errors.

### Apply Semantics

- [x] Validate the complete proposed state before mutation.
- [x] Re-check stale-write token inside the write session.
- [x] Keep the database mutation short and deterministic.
- [x] Avoid provider calls or long filesystem work inside the write
      transaction.
- [x] Return applied current state without an id-only report reread that can
      fail due to missing selected shot scope.
- [x] Include top-level `project`.
- [x] Include top-level `resourceKeys`.
- [x] Ensure CLI Studio resource-change notification fires after apply.

### CLI And Skills

- [x] Keep `take authoring context` as a thin core read adapter.
- [x] Keep `take authoring validate` as a thin core validation adapter.
- [x] Keep `take authoring apply` as a thin core mutation adapter.
- [x] Do not teach the CLI to inspect nested authoring report internals for
      project metadata.
- [x] Update source skills to compare validation `prior` and `current`.
- [x] Update source skills to compare apply `prior` and `current`.
- [x] Update source skills to re-read final persisted state before generation.
- [x] Update source skills to revise prompts when final settings changed
      prompt-relevant intent.
- [x] Remove any skill language that implies generation can run from stale
      apply output.

### Tests

- [x] Add core test: validation report uses proposed shot membership.
- [x] Add core test: validation report uses proposed production input mode.
- [x] Add core test: validation report uses proposed model choice.
- [x] Add core test: unsupported route combination fails validation with a
      structured issue.
- [x] Add core test: non-contiguous shot ids fail validation.
- [x] Add core test: apply of multi-cut authoring document returns a report
      without selected-shot failure.
- [x] Add core test: apply returns prior and current snapshots.
- [x] Add core test: apply rejects stale write after Studio/core mutation.
- [x] Add core test: final read after apply reflects applied state.
- [x] Add CLI test: authoring apply JSON includes top-level project and
      resource keys.
- [x] Add CLI test: authoring apply emits Studio resource-change event.
- [x] Add CLI test: validation JSON exposes proposed current state.
- [x] Add regression coverage for empty-issue `ProjectDataError` route
      failures.

### Documentation

- [x] Update architecture docs with the prior/proposed/current/final state
      model.
- [x] Update media-generation docs with final persisted-state generation
      behavior.
- [x] Update Studio skills architecture reference if the workflow contract
      changes.
- [x] Update source skills after repository contracts are accepted.
- [x] Do not update historical plans for naming churn.

### Final Verification

- [x] Run focused core authoring tests.
- [x] Run focused production-plan/preflight tests.
- [x] Run focused CLI take-command tests.
- [x] Run package checks required by touched packages.
- [x] Manually validate a two-shot multi-cut authoring apply returns prior and
      current reports.
- [x] Manually validate a Studio edit after apply is visible when the agent
      re-reads authoring context.
- [x] Manually validate generation planning uses the final persisted state, not
      stale apply output.

## Success Criteria

This plan is successful when Shot Video Take authoring has one core-owned path
for preparing, validating, reporting, and applying proposed take state.

Agents should be able to:

- read the current Studio-reviewed take state;
- submit a complete proposal;
- validate the exact proposed state;
- apply the proposal atomically;
- compare prior and current reports;
- let the user make final Studio edits;
- re-read the persisted final state;
- generate only after prompts and settings agree with that final state.

Reviewers should be able to confirm from contracts and function names whether a
report is built from persisted state, proposed state, or final generation state.
