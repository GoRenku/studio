# 0078 Pre-0077 Architecture Guardrails

Status: implemented
Date: 2026-06-18
Implementation order: before `0077-take-contract-quality-review-remediation.md`

## Summary

This plan adds the smallest set of architecture tests that must exist before
implementing `0077`. The purpose is to make the wrong remediation impossible:
Studio server routes must not fix take reference-selection bugs by adding more
route-local business logic or by writing durable take state through a generic
patch API.

This plan is intentionally narrow. It protects the architectural boundary that
0077 must repair, then 0077 performs the actual core-owned command and
validation work.

The guiding rule is:

> Add the boundary test before changing the boundary-sensitive code.

## Sequencing

The required implementation sequence is:

1. Implement this plan first.
2. Let the new focused architecture tests expose the current boundary breach if
   the current tree still breaches it.
3. Implement `0077`.
4. Make the guardrail tests pass by moving the domain mutation into focused
   core commands.
5. Implement `0079` for the broader test-hardening and maintenance system.

This plan is not a complete architecture-test hardening effort. It is the
blocking slice that prevents `0077` from being solved with another server-side
shortcut.

## Problem Being Guarded

The current failure mode is concrete:

- a stale browser tab posts a character-sheet asset id from another Cast
  Member;
- the Studio route accepts that id;
- the route writes it into SQLite as valid take state;
- later reference panels, preflight, or generation code have to interpret
  broken project data instead of rejecting the mutation at the boundary.

The architectural failure is that the Studio server route owns domain mutation
rules that belong in `packages/core`.

Correct direction:

- Studio server routes translate HTTP into typed core command inputs;
- `packages/core` prepares the take context;
- `packages/core` validates ownership, scene membership, and dependency scope;
- `packages/core` writes the durable take state only after validation;
- invalid ids return structured `PROJECT_DATA...` diagnostics before any
  SQLite write.

## Goals

- Add a Studio server architecture test that blocks route-local take reference
  selection mutation.
- Add a core contract architecture assertion that blocks adapter-facing generic
  take-state patching.
- Force `0077` to introduce focused core commands instead of server-owned map
  edits.
- Keep this slice small enough to implement before 0077 without refactoring
  unrelated CLI, frontend, or runtime test areas.

## Non-Goals

- Do not implement the focused core commands in this plan.
- Do not refactor the Studio routes in this plan except where required to wire
  the guardrail tests.
- Do not add the full architecture-test registry in this plan.
- Do not harden all CLI and frontend architecture rules in this plan.
- Do not add broad runtime regression coverage in this plan.
- Do not add compatibility wrappers, transitional aliases, or route-side
  validation shims.

## Implementation Result

Implemented on 2026-06-18.

Added:

- `packages/studio/server/architecture.test.ts`;
- `packages/core/src/server/architecture.test.ts` public contract guardrail for
  `packages/core/src/server/project-data-service-contracts.ts`.

Focused verification produced the intended pre-0077 failures:

- `Studio server architecture > keeps take reference-selection mutation out of
  route files`;
- `core server architecture > does not expose generic shot video take state
  patching through ProjectDataService`.

The Studio HTTP request-helper guardrail passed. The failing assertions are the
0077 handoff: 0077 must remove the route-local reference-selection state patching
and replace the public generic take-state patch contract with focused core
commands.

## Required Pre-0077 Guardrails

### Studio Server Route Guardrail

Add:

```text
packages/studio/server/architecture.test.ts
```

The test scans non-test route files under:

```text
packages/studio/server/routes
```

It may also scan HTTP request helper files under:

```text
packages/studio/server/http
```

HTTP request helpers are allowed to mention request field names when parsing
HTTP bodies. They are not allowed to assemble durable take state, build
`statePatch` payloads, or call project-data mutation methods.

Forbidden route capabilities:

- `updateSceneShotVideoTakeState`;
- `statePatch`;
- `context.take.state.referenceSelections`;
- `selectedCharacterSheetAssetIds`;
- `selectedLocationSheetAssetIds`;
- `selectedLocationViewIds`;
- `selectedLookbookSheetIds`;
- `selectedDialogueAudioTakeIds`;
- `dependencyInclusions`.

Exception policy:

- no exceptions for durable take reference-selection mutation in route files;
- test files may contain forbidden strings when asserting the guardrail;
- HTTP request readers may contain request field names only when translating
  incoming JSON to typed command input fields;
- no server file may use request parsing as a place to build durable state
  patches.

### Core Contract Guardrail

Extend:

```text
packages/core/src/server/architecture.test.ts
```

The test should assert that adapter-facing core contracts do not expose a broad
generic take-state patch operation.

The key contract to inspect is:

```text
packages/core/src/server/project-data-service-contracts.ts
```

Guardrail expectation:

- Studio server and CLI must not be able to call a generic
  `updateSceneShotVideoTakeState` contract method as a metadata escape hatch.
- Any remaining low-level state writer must be internal to core implementation
  modules.
- Public mutation contracts must be purpose-specific enough that callers cannot
  bypass ownership validation by constructing arbitrary state maps.

If this test fails before 0077, that is useful. 0077 should make it pass by
narrowing the public mutation surface and routing take reference selection
through focused core commands.

### Required 0077 Command Shape

This plan does not implement the commands, but the guardrails should force
0077 toward commands with this shape:

- `updateSceneShotVideoTakeCharacterSheetSelection`;
- `updateSceneShotVideoTakeLocationSheetSelection`;
- `updateSceneShotVideoTakeLocationViewSelection`;
- `updateSceneShotVideoTakeLookbookSheetSelection`;
- `updateSceneShotVideoTakeDialogueAudioSelection`;
- `updateSceneShotVideoTakeReferenceInclusion`.

Each command should validate against the prepared take context and return
structured `PROJECT_DATA...` diagnostics for invalid ids.

## Implementation Slices

### Slice 1: Add Studio Server Architecture Test

- Create `packages/studio/server/architecture.test.ts`.
- Add a small recursive TypeScript file scanner.
- Scan server route files.
- Scan server HTTP request helper files for generic patching behavior.
- Exclude test files and explicit fixtures.
- Fail on forbidden route-local take reference-selection mutation.

### Slice 2: Add Core Public Contract Guardrail

- Extend `packages/core/src/server/architecture.test.ts`.
- Read `project-data-service-contracts.ts`.
- Assert adapter-facing contracts do not expose generic take-state patching.
- Keep any internal core-only low-level writer out of the public service
  contract.

### Slice 3: Wire 0077 Handoff

- Add comments in the tests explaining that failures must be resolved by 0077
  through focused core commands.
- Do not add allowlists that normalize the current violation.
- Record the expected failing assertions if the tree is still pre-0077.

## Completion Checklist

### Review And Scope

- [x] Confirm this plan is strictly the pre-0077 guardrail slice.
- [x] Confirm broader CLI, frontend, runtime, and registry work remains in
      `0079`.
- [x] Confirm this plan aligns with the hard-gate architecture language in
      `AGENTS.md`.
- [x] Confirm this plan protects the specific route-local reference-selection
      failure called out in `0077`.
- [x] Confirm no compatibility layer, route-side validation shim, or public
      wrapper API is introduced.

### Studio Server Static Guardrail

- [x] Add `packages/studio/server/architecture.test.ts`.
- [x] Add a reusable recursive TypeScript scanner.
- [x] Exclude `.test.ts`, `.test.tsx`, fixture, and test-support files.
- [x] Scan `packages/studio/server/routes` for forbidden mutation capability.
- [x] Ban route calls to `updateSceneShotVideoTakeState`.
- [x] Ban route construction of `statePatch`.
- [x] Ban route inspection or construction of durable take
      `referenceSelections` maps.
- [x] Ban route writes of `selectedCharacterSheetAssetIds`.
- [x] Ban route writes of `selectedLocationSheetAssetIds`.
- [x] Ban route writes of `selectedLocationViewIds`.
- [x] Ban route writes of `selectedLookbookSheetIds`.
- [x] Ban route writes of `selectedDialogueAudioTakeIds`.
- [x] Ban route writes of `dependencyInclusions`.
- [x] Allow test files to mention forbidden strings only for guardrail
      assertions.

### HTTP Request Helper Guardrail

- [x] Scan `packages/studio/server/http` for `statePatch`.
- [x] Scan `packages/studio/server/http` for
      `updateSceneShotVideoTakeState`.
- [x] Scan `packages/studio/server/http` for durable
      `referenceSelections` assembly.
- [x] Allow request field names only when parsing typed HTTP request input.
- [x] Document the difference between request parsing and durable state
      mutation in the test failure message.

### Core Contract Guardrail

- [x] Extend `packages/core/src/server/architecture.test.ts`.
- [x] Inspect `packages/core/src/server/project-data-service-contracts.ts`.
- [x] Ban adapter-facing generic take-state patch contracts.
- [x] Confirm any low-level state writer, if still needed, is internal to core.
- [x] Confirm the failure message tells implementers to add focused core
      commands rather than server validation.

### 0077 Handoff

- [x] Confirm the new tests either fail for the current breach or pass because
      the breach has already been removed.
- [x] Record the exact failing test names for the 0077 implementation pass if
      they fail.
- [x] Confirm 0077 cannot be marked complete until these guardrail tests pass.
- [x] Confirm no allowlist entry is added for the current route-local mutation.

### Verification

- [x] Run the focused Studio server architecture test.
- [x] Run the focused core architecture test.
- [x] If tests fail before 0077, confirm the failures are the intended
      guardrail failures.
- [x] Do not run broad `pnpm check` as a completion signal for this isolated
      pre-0077 slice unless 0077 has already been implemented.
