# 0085 Take Editor Persistence And Save Status Plan

Status: completed
Date: 2026-06-24

## Summary

The take editor currently has several user-editable surfaces that all feel like
one workflow to the user, but they do not all travel through the same save
path:

- Composition and Motion choices update `take.state.shotDesignByShotId`.
- References and Dialogs choices update `take.state.referenceSelections`.
- AI Production choices update `take.state.production`.
- Grouping changes update take grouping and must not erase any of the above.

The user expectation is simple: every choice made inside a take is durable,
reopening the take shows the same choices, and grouping changes preserve all
shot-level and take-level edits. The implementation and tests need to make that
expectation true across all tabs, not only Composition.

This plan covers the Tier 2 and Tier 3 work for this persistence bug. Tier 1,
the true browser UI end-to-end workflow, is deliberately deferred because it
needs reusable UI test infrastructure rather than a one-off Playwright script.

## Problem Statement

The visible failure is that the UI reports a successful save, but reopening the
take loses user changes. The deeper risk is that different tabs save through
different paths and report save status inconsistently.

Concrete examples that must be protected:

- A user changes Shot Size in Composition, adds custom Composition text, closes
  the take, reopens it, and expects the same values.
- A user changes Motion choices, then adds or removes shots from a group, and
  expects the Motion choices to remain attached to the shot.
- A user chooses References for cast, locations, lookbook sheets, reference
  images, or dialogue audio, then reopens the take and expects those choices.
- A user changes Dialogs choices, including selected dialogue audio and
  inclusion behavior, then reopens the take and expects those choices.
- A user changes AI Production input mode, model choice, or parameters, then
  reopens the take and expects those choices.
- A user sees a Saved notification only after the saved state has been accepted
  by the persistence path that owns that data.

## Current Persistence Surfaces

| Surface | Durable State | Expected Save Behavior | Grouping Requirement |
| --- | --- | --- | --- |
| Composition | `take.state.shotDesignByShotId[shotId].composition` | Debounced save, flush on unmount, update local take from persisted result | Must survive group add/remove |
| Motion | `take.state.shotDesignByShotId[shotId].motion` | Debounced save, flush on unmount, update local take from persisted result | Must survive group add/remove |
| References | `take.state.referenceSelections` | Immediate mutation, update or refresh local take from persisted result, report save status | Must survive group add/remove |
| Dialogs | `take.state.referenceSelections.dialogue` and related dialogue audio choices | Immediate mutation, update or refresh local take from persisted result, report save status | Must survive group add/remove |
| AI Production | `take.state.production` | Debounced save, flush on unmount, update local take from persisted result, report save status | Must survive group add/remove |

## Goals

1. Cover all take editor tabs that contain persisted user choices:
   Composition, Motion, References, Dialogs, and AI Production.
2. Confirm persistence through the actual Studio service/API path into the
   project database, then reload the take from storage.
3. Confirm grouping changes do not delete or reset unrelated take edits.
4. Make save notifications consistent across all take editor mutation paths.
5. Refactor duplicated save-status and test-fixture logic so new tabs can be
   added without copy-pasting persistence plumbing.
6. Keep business rules in `packages/core`; Studio feature code sends user
   intent and displays the resulting state.

## Non-Goals

- Do not implement Tier 1 browser UI end-to-end tests in this slice.
- Do not add compatibility aliases, old field support, or migration-at-read
  behavior.
- Do not move domain validation into React components or Studio HTTP handlers.
- Do not add broad generic patch APIs for arbitrary take state.
- Do not test or optimize mobile behavior.
- Do not introduce raw HTML controls in Studio feature code.

## Architecture Boundaries

`packages/core` remains the owner of take metadata validation, grouping
behavior, and durable state mutation contracts. If the tests expose missing core
commands or validation, the fix belongs in core first.

`packages/studio/server` remains a thin adapter:

- read HTTP params and request bodies;
- call the focused core command or service;
- serialize the persisted result;
- translate structured diagnostics.

`packages/studio/src/services` remains the browser-facing API client layer.
It may shape request and response DTOs, but it must not decide domain validity.

`packages/studio/src/features/movie-studio` remains the UI projection and
intent layer. It may debounce, flush, refresh, and display save state. It must
not enforce project metadata rules that core does not enforce.

## Refactor Direction

### Save Notification Slots

Add a small UI-layer save-status coordinator in:

`packages/studio/src/features/movie-studio/detail-save-notification-slots.ts`

Planned public names:

- `DetailSaveNotificationSlotId`
- `useDetailSaveNotificationSlots`
- `setDetailSaveNotificationSlot`

The slot ids are:

- `shot-design`
- `ai-production`
- `references`
- `dialogs`

`SceneShotDetail` will use this hook instead of keeping separate local state
for each save source. The hook will combine slots through the existing
`chooseDetailSaveNotification` behavior so the top-right notification reports
one coherent status.

### Immediate Take Mutation Status

Add a hook for immediate, non-debounced take mutations in:

`packages/studio/src/features/movie-studio/scenes/use-take-editor-mutation-status.ts`

Planned public names:

- `useTakeEditorMutationStatus`
- `runTakeEditorMutation`
- `TakeEditorMutationStatus`

This hook will be used by References and Dialogs. It will report:

- `saving` when the mutation starts;
- `saved` only after the mutation resolves successfully;
- `error` when the mutation rejects;
- `idle` after the existing saved/error display timeout.

It will not know what References, Dialogs, assets, dialogue audio, or grouping
mean. It only coordinates UI save status around a caller-provided mutation.

### Debounced Take Autosave Parity

Composition and Motion already use the take shot design autosave path. AI
Production must have the same persistence guarantees:

- changes are debounced;
- pending edits flush on unmount;
- the persisted mutation result updates local take state;
- save notification status comes from the same notification-slot system.

The planned test target is:

`packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.test.tsx`

If the existing AI Production hook has a different name, the implementation will
update that existing hook directly rather than adding a wrapper alias.

### Shared Tier 2 Test Fixture

Move repeated service e2e setup into:

`packages/studio/src/services/testing/shot-video-take-state-e2e-fixture.ts`

Planned public test helpers:

- `createShotVideoTakeStateE2eFixture`
- `createShotVideoTakeReferenceSelectionFixture`
- `readPersistedShotVideoTake`
- `updateShotVideoTakeGrouping`

The fixture must create valid project state through existing core and Studio
service paths. It must not fake invalid asset ids or bypass core validation.

### Tier 2 Test File Shape

Rename the current narrow persistence test file to:

`packages/studio/src/services/scene-shot-video-take-state-persistence.e2e.test.ts`

This name matches the broader contract: the test covers take editor state, not
only shot design state.

No compatibility test file will remain under the old name.

## Tier 2 API/Core E2E Matrix

Tier 2 tests run below the browser but through the real Studio service/API/core
persistence path. They are the main regression net for this bug.

| Area | Choices Covered | Assertions |
| --- | --- | --- |
| Composition | `shotSize`, `subjectFraming`, `cameraAngle`, `dutch`, `lens.type`, `lens.millimeters`, `lens.focus`, `customComposition` | Save, reload persisted take, verify values, change grouping, reload again, verify values remain |
| Motion | `movement`, `secondary`, `directions`, `track`, `rig`, `customMotion` | Save, reload persisted take, verify values, change grouping, reload again, verify values remain |
| Shot Design References | `cast`, `location`, `lookbook`, `referenceImages`, `dialogue` entries inside `shotDesignByShotId` | Save, reload persisted take, verify values, change grouping, reload again, verify values remain |
| Reference Selections | cast sheet selections, location sheet selections, lookbook sheet selections, reference image selections, include/exclude overrides | Save through reference-selection API, reload persisted take, verify values, change grouping, reload again, verify values remain |
| Dialogs | dialogue audio selection, dialogue clear behavior, dialogue reference inclusion choice | Save through dialogue/reference-selection API, reload persisted take, verify values, change grouping, reload again, verify values remain |
| AI Production | `inputModeId`, `modelChoice`, `parameterValues` | Save, reload persisted take, verify values, change grouping, reload again, verify values remain |
| Clear/Prune | clear one shot's design, remove shot from take | Cleared values become absent, removed shot design is pruned, unrelated shot state remains |
| Error Path | invalid reference id or invalid production choice, using the current core contract | Structured error is returned, no Saved notification is emitted by caller-level tests |

## Tier 3 Component And Hook Matrix

Tier 3 tests run at the React component and hook layer. They verify that every
tab sends the correct user intent, propagates persisted results back into local
state, and reports save status consistently.

| Test File | Coverage |
| --- | --- |
| `scene-shot-design-tabs.test.tsx` | Composition controls and Motion controls call the shot design context with the expected patch shape; paired values such as rack focus and focus clearing behave correctly |
| `use-take-shot-design.test.tsx` | Debounced shot design save forwards the persisted take result, flushes on unmount, and reports saving/saved/error |
| `scene-shot-references-tab.test.tsx` | Cast, location, lookbook, reference image, and inclusion choices call the focused reference-selection API, refresh or update the take, and report saving/saved/error |
| `scene-shot-dialogs-tab.test.tsx` | Dialogue audio choose/clear and dialogue inclusion choices call the focused dialogue/reference-selection API, refresh or update the take, and report saving/saved/error |
| `scene-shot-ai-production-tab.test.tsx` | AI Production input mode, model choice, and parameter controls call the production hook with the expected patch shape and show consistent save status |
| `use-shot-video-take-production.test.tsx` | Debounced production save forwards the persisted take result, flushes on unmount, and reports saving/saved/error |
| `use-take-editor-mutation-status.test.tsx` | Immediate mutation save state transitions are consistent for success, error, and latest mutation behavior |
| `detail-save-notification-slots.test.tsx` | Multiple save sources combine into one detail notification without duplicated state logic in `SceneShotDetail` |

## Tier 1 Browser E2E Direction

Tier 1 is deferred for this implementation slice. The later Tier 1 plan should
define reusable infrastructure before adding the first test.

The intended future browser workflow is:

1. Open a real Studio project in the browser.
2. Open a take.
3. Edit Composition, Motion, References, Dialogs, and AI Production choices.
4. Observe save notifications.
5. Close and reopen the take.
6. Verify all choices remain visible in the UI.
7. Change grouping.
8. Reopen the take and verify the choices still remain visible.

The Tier 1 infrastructure should include:

- a deterministic project fixture creator;
- a stable Studio dev-server bootstrap;
- browser helpers for opening scene, shot, and take surfaces;
- tab-specific page objects for the take editor;
- screenshot or DOM assertions for visible saved state;
- a fast default smoke suite and an opt-in fuller regression suite.

## Implementation Slices

### Slice 1: Consolidate Existing Persistence Coverage

- Rename the broad persistence e2e test to
  `scene-shot-video-take-state-persistence.e2e.test.ts`.
- Extract repeated project and take setup into
  `shot-video-take-state-e2e-fixture.ts`.
- Keep existing Composition, Motion, shot design references, clear/prune, and
  AI Production persistence coverage passing after the fixture extraction.

### Slice 2: Add References And Dialogs Tier 2 Coverage

- Build valid reference-selection fixtures through core-owned setup paths.
- Add cast, location, lookbook, reference image, dialogue audio, and inclusion
  selection cases.
- Assert save, reload, grouping change, and reload again for each case.

### Slice 3: Refactor Save Notification Plumbing

- Add `detail-save-notification-slots.ts`.
- Replace separate save notification state in `SceneShotDetail`.
- Add `use-take-editor-mutation-status.ts`.
- Wire References and Dialogs through the immediate mutation status hook.

### Slice 4: Bring AI Production To Parity

- Ensure AI Production uses debounced save behavior with unmount flush.
- Ensure persisted production mutation results update local take state.
- Route AI Production notification state through the shared slots.

### Slice 5: Complete Tier 3 Tab And Hook Tests

- Expand References, Dialogs, and AI Production component tests.
- Add direct hook tests for the new save status primitives.
- Keep Composition and Motion coverage table-driven where practical to reduce
  test duplication.

### Slice 6: Verification And Cleanup

- Run the focused Studio test set.
- Run Studio typecheck.
- Run Studio lint.
- Remove obsolete local duplication introduced by previous narrow tests.
- Update this plan checklist before marking the work complete.

## Completion Checklist

### Review And Architecture

- [x] Confirm all durable take metadata mutations are still owned by
      `packages/core`.
- [x] Confirm Studio server handlers remain thin adapters with no new domain
      validation.
- [x] Confirm Studio React code sends intent and displays persisted results
      without deciding whether metadata is valid.
- [x] Confirm no generic arbitrary take-state patch API was added.
- [x] Confirm no compatibility aliases, old field support, or migration-at-read
      logic was added.
- [x] Confirm no raw HTML form or interactive controls were introduced in
      `packages/studio` feature code.

### Refactor And Duplication

- [x] Add `detail-save-notification-slots.ts` with the planned slot ids.
- [x] Update `SceneShotDetail` to use save notification slots.
- [x] Add `use-take-editor-mutation-status.ts` for immediate mutations.
- [x] Wire References through `useTakeEditorMutationStatus`.
- [x] Wire Dialogs through `useTakeEditorMutationStatus`.
- [x] Keep Composition and Motion on the shot design autosave path.
- [x] Bring AI Production autosave behavior to parity with shot design.
- [x] Extract shared Tier 2 fixture setup into
      `shot-video-take-state-e2e-fixture.ts`.
- [x] Remove duplicated fixture setup from the broad persistence e2e test.

### Tier 2 API/Core E2E Coverage

- [x] Rename the broad e2e file to
      `scene-shot-video-take-state-persistence.e2e.test.ts`.
- [x] Cover Composition choices and reload persistence.
- [x] Cover Composition choices after grouping changes.
- [x] Cover Motion choices and reload persistence.
- [x] Cover Motion choices after grouping changes.
- [x] Cover shot design reference fields and reload persistence.
- [x] Cover shot design reference fields after grouping changes.
- [x] Cover reference-selection cast sheet choices.
- [x] Cover reference-selection location sheet choices.
- [x] Cover reference-selection lookbook sheet choices.
- [x] Cover reference image choices.
- [x] Cover include/exclude reference overrides.
- [x] Cover dialogue audio selection.
- [x] Cover dialogue audio clear behavior.
- [x] Cover dialogue inclusion choices.
- [x] Cover AI Production input mode choices.
- [x] Cover AI Production model choices.
- [x] Cover AI Production parameter values.
- [x] Cover clearing a shot design field.
- [x] Cover pruning removed-shot design state.
- [x] Cover at least one structured error path where the UI must not report
      Saved.

### Tier 3 Component And Hook Coverage

- [x] Keep `scene-shot-design-tabs.test.tsx` covering Composition controls.
- [x] Keep `scene-shot-design-tabs.test.tsx` covering Motion controls.
- [x] Keep `use-take-shot-design.test.tsx` covering persisted-result forwarding.
- [x] Keep `use-take-shot-design.test.tsx` covering unmount flush.
- [x] Expand `scene-shot-references-tab.test.tsx` for all reference choices.
- [x] Expand `scene-shot-references-tab.test.tsx` for save notification status.
- [x] Expand `scene-shot-dialogs-tab.test.tsx` for dialogue choices.
- [x] Expand `scene-shot-dialogs-tab.test.tsx` for save notification status.
- [x] Expand `scene-shot-ai-production-tab.test.tsx` for production choices.
- [x] Add or expand `use-shot-video-take-production.test.tsx` for persisted
      result forwarding.
- [x] Add or expand `use-shot-video-take-production.test.tsx` for unmount flush.
- [x] Add `use-take-editor-mutation-status.test.tsx`.
- [x] Add `detail-save-notification-slots.test.tsx`.

### UI Behavior

- [x] Saved notification appears only after the relevant mutation succeeds.
- [x] Saving status appears while a debounced or immediate mutation is pending.
- [x] Error status appears when a mutation fails.
- [x] Reopening a take shows persisted Composition choices.
- [x] Reopening a take shows persisted Motion choices.
- [x] Reopening a take shows persisted References choices.
- [x] Reopening a take shows persisted Dialogs choices.
- [x] Reopening a take shows persisted AI Production choices.
- [x] Changing grouping does not erase any persisted tab choices.

### Verification

- [x] Run focused Studio vitest files for take persistence, take editor tabs,
      save notification slots, and autosave hooks.
- [x] Run `pnpm --dir packages/studio test:typecheck`.
- [x] Run `pnpm --dir packages/studio lint`.
- [x] Report any pre-existing lint warnings separately from new failures.

### Deferred Tier 1 Follow-Up

These items remain intentionally deferred because this implementation slice
covered Tier 2 service/core E2E and Tier 3 component/hook coverage only.

- [ ] Create a separate active plan for reusable browser UI e2e
      infrastructure.
- [ ] Define deterministic project fixture setup for browser tests.
- [ ] Define page objects for scene, shot, take, and take-editor tabs.
- [ ] Define fast smoke and fuller regression tiers.
- [ ] Add the real browser workflow only after the infrastructure plan is
      accepted.
