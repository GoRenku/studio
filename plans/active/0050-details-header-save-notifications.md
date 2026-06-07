# 0050 Details Header Save Notifications

Date: 2026-06-06

Status: complete

## Goal

Unify `Saving`, `Saved`, and save-failure feedback across the Studio app so all
save notifications appear in the top-right area of the Movie Studio details
header.

The implementation should also replace the current save-status badge with one
shared `src/ui` component so future save flows use the same visual treatment and
placement contract.

## Decision Reference

This plan implements ADR 0027:

- `docs/decisions/0027-use-details-header-for-save-notifications.md`

## Current State Inventory

### Shared Autosave Data And Badge

`packages/studio/src/hooks/use-debounced-autosave.ts`

- Owns debounced autosave timing.
- Uses `createLatestOnlySaveQueue`, which is the accepted latest-only save
  ordering primitive from ADR 0005.
- Returns `DebouncedAutosaveStatus` with `idle`, `saving`, `saved`, and `error`.
- Produces the visible messages `Saving` and `Saved`.
- Uses a Project Information-specific fallback message:
  `Project information could not be saved.`

Expected impact:

- The hook can continue to own timing and latest-only coordination.
- The fallback error message should become generic or caller-provided because
  this hook is now used by Project Information, Shot Specs, and AI Production.
- The hook should keep returning status data, but rendering must move to the
  details header path.

`packages/studio/src/ui/autosave-status.tsx`

- Renders the current compact autosave badge.
- Imports `DebouncedAutosaveStatus`, which ties a UI primitive directly to one
  autosave hook contract.
- Is used in both the desired header location and undesired nested locations.

Expected impact:

- Replace or rename this component as a shared save-notification component.
- The new shared component should live in `packages/studio/src/ui`.
- Delete `AutosaveStatus` after callers move. Do not keep a compatibility alias.

### Correct Existing Placement

`packages/studio/src/features/movie-studio/movie-studio-screen.tsx`

- Owns the Movie Studio details `PanelShell`.
- Keeps `projectInformationAutosave` state.
- Passes that state to `AutosaveStatus` inside the `PanelShell` `action` slot
  for the `projectInformation` selection.

`packages/studio/src/features/movie-studio/project-information/project-information-panel.tsx`

- Uses `useDebouncedAutosave`.
- Reports status upward through `onAutosaveStatusChange`.

Expected impact:

- This is the pattern closest to the desired result.
- Keep Project Information status in the details header, but render it through
  the new shared save-notification component and the final header trailing API.

### Incorrect Nested Autosave Placement

`packages/studio/src/features/movie-studio/scenes/scene-shot-design-controls.tsx`

- `CustomFieldRow` renders `AutosaveStatus` beside the custom text area.

`packages/studio/src/features/movie-studio/scenes/scene-shot-composition-tab.tsx`

- Reads `status` from `useShotSpecsContext`.
- Passes that status to `CustomFieldRow`.
- This means custom composition text displays save state beside the field.

`packages/studio/src/features/movie-studio/scenes/scene-shot-camera-motion-tab.tsx`

- Reads `status` from `useShotSpecsContext`.
- Passes that status to `CustomFieldRow`.
- This means custom camera/motion text displays save state beside the field.

`packages/studio/src/features/movie-studio/scenes/shot-specs-context.tsx`

- Creates one shared Shot Specs state per selected shot.
- Keeps Composition, Motion, Location, and related shot-spec editors on one
  shared autosave surface.

Expected impact:

- `CustomFieldRow` should stop accepting or rendering save status.
- Shot Specs autosave status should be routed from `ShotSpecsProvider` or
  `SceneShotDetail` up to the details header.
- The status should cover all Shot Specs edits, not only custom text fields.

### Incorrect Nested AI Production Placement

`packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.ts`

- Uses `useDebouncedAutosave` for AI Production setup changes.
- Exposes `autosave` in `UseShotVideoTakeProductionResult`.

`packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-tab.tsx`

- Passes `autosave` into `SceneShotAiProductionRunSetup`.

`packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-run-setup.tsx`

- Renders `AutosaveStatus` inside the Run Setup header.

Expected impact:

- AI Production autosave status should route up to the details header.
- Run Setup should keep parameter controls, estimate, prompt, and local
  diagnostics, but remove the save-status badge.

### Manual Save Or Apply Feedback

`packages/studio/src/features/movie-studio/scenes/scene-shots-tab.tsx`

- Uses the details header for the `Editing Groups` button while shot rail
  grouping edit mode is active.
- Uses `applyState: 'idle' | 'saving'` for the review dialog apply request.
- Shows `Applying...` on the dialog button.
- Shows `groupingApplyError` inside the review dialog.

Expected impact:

- Keep the dialog button disabled and text update if that is useful for the
  button itself, but also report manual apply progress and failure through the
  details header save-notification path.
- The `Editing Groups` command and save notification must coexist in the header
  trailing area. The notification should be the far-right item.
- On successful apply, show a short saved/success state in the details header.

### Related Non-Save Notifications

These are not part of the save-notification unification, but they should be
kept visible in the inventory so implementation does not accidentally broaden
the scope:

- `packages/studio/src/features/movie-studio/movie-studio-screen.tsx` uses
  Sonner toasts for production asset export progress, success, and failure.
- `packages/studio/src/features/movie-studio/visual-language/lookbooks-panel.tsx`
  uses Sonner success and error toasts for active lookbook changes and load
  failures.
- `packages/studio/src/features/movie-studio/visual-language/lookbook-panel.tsx`
  uses Sonner error toasts for lookbook load and media mutation failures.
- `packages/studio/src/features/movie-studio/visual-language/inspiration-panel.tsx`
  uses Sonner error toasts for inspiration load failures.
- `packages/studio/src/features/movie-studio/cast/cast-member-panel.tsx` and
  `packages/studio/src/features/movie-studio/locations/location-panel.tsx` use
  Sonner error toasts for select and delete failures.
- `packages/studio/src/app/app.tsx` renders the global Sonner toaster at
  `bottom-right`.

Expected impact:

- Leave these alone unless a specific operation is actually save feedback.
- Do not move every toast into the details header as part of this slice.

## Proposed Architecture

### Shared Save Notification Component

Create a domain-neutral shared component in `packages/studio/src/ui`, for
example:

```text
packages/studio/src/ui/save-notification.tsx
```

The component should render a compact header-safe notification for:

- `idle`, which renders nothing;
- `saving`, for autosave or manual apply progress;
- `saved`, for success confirmation;
- `error`, for save or apply failures.

The component should own:

- icons from `lucide-react`;
- compact pill styling;
- error versus non-error color rules;
- `role="status"` for saving/saved;
- `role="alert"` for errors;
- a max width and truncation behavior so long errors do not push header actions
  or titles out of view.

The component should not own:

- autosave timing;
- queueing;
- save execution;
- which selected detail surface is active;
- where the notification is placed.

### Details Header Placement

Update `PanelShell` so the header trailing area can consistently render both
commands and save notifications.

Current shape:

```tsx
<PanelShell title={...} action={...}>
```

Target shape:

```tsx
<PanelShell
  title={...}
  action={...}
  saveNotification={...}
>
```

The header trailing row should:

- keep the title on the left;
- keep command actions on the right side;
- render save notification as the far-right item;
- keep all controls vertically centered in the existing 45px header;
- avoid nesting cards or adding another header band.

This direct `PanelShell` API is preferred over a general global notification
store because the placement is tied to the selected details panel, not to the
whole application.

### Status Routing

Use explicit status routing from the active detail surface to `MovieStudioScreen`.

Project Information already routes status upward. Extend the same idea to scene
shot detail surfaces:

- `SceneShotDetail` should receive callbacks or status-change props needed to
  report Shot Specs and AI Production save states upward.
- `ShotSpecsProvider` or its immediate owner should surface the Shot Specs
  autosave status.
- `useShotVideoTakeProduction` should continue returning AI Production autosave
  status, and `SceneShotDetail` should report it upward when it is relevant.
- `SceneShotsTab` should convert shot rail grouping apply state and apply
  errors into the same save-notification status model.
- `ScenePanel` and `MovieStudioScreen` should carry the active status into the
  details header.

When more than one save surface exists under the same details page, the visible
header notification should choose the most actionable state:

1. error;
2. saving;
3. saved;
4. idle.

If two active nested save surfaces report the same priority, prefer the one
that most recently changed. This avoids showing stale `Saved` after a newer
surface starts saving.

### Error Messages

`useDebouncedAutosave` should support caller-owned fallback error messages.

Examples:

- Project Information: `Project information could not be saved.`
- Shot Specs: `Shot settings could not be saved.`
- AI Production: `AI Production settings could not be saved.`

When the thrown value is an `Error`, keep using the error message because it can
include structured server diagnostics that are more actionable than a generic
fallback.

### Scope Boundaries

In scope:

- Project Information autosave notification.
- Shot Specs autosave notification.
- AI Production setup autosave notification.
- Shot rail grouping apply progress, success, and failure.
- Shared save-notification UI primitive.
- Header placement API and tests.
- ADR and architecture documentation updates.

Out of scope:

- Moving export, delete, select, load, and non-save workflow toasts.
- Replacing Sonner globally.
- Mobile layout work.
- Database or service-contract changes.
- Backwards compatibility with `AutosaveStatus`.

## Implementation Slices

### Slice 1 - Shared UI Primitive

- Add `save-notification.tsx` under `packages/studio/src/ui`.
- Move the visual treatment from `AutosaveStatus` into the new component.
- Make the component independent from `DebouncedAutosaveStatus`.
- Add focused component tests if the current UI test setup has a nearby pattern
  for shared UI components.

### Slice 2 - Header Placement API

- Update `PanelShell` to accept save-notification data separately from command
  actions.
- Render the save notification at the far-right end of the header trailing row.
- Update Project Information to use the new placement API.
- Remove `AutosaveStatus` from `movie-studio-screen.tsx`.

### Slice 3 - Shot Specs Routing

- Remove the save-status prop from `CustomFieldRow`.
- Route `useShotSpecs` status from the shot detail owner to the details header.
- Ensure Composition and Camera Motion custom text fields no longer show local
  `Saving` or `Saved` badges beside the text area.
- Preserve Shot Specs autosave behavior and returned-resource refresh.

### Slice 4 - AI Production Routing

- Remove `AutosaveStatus` from `SceneShotAiProductionRunSetup`.
- Route `production.autosave` to the details header.
- Preserve AI Production parameter editing, estimate refresh, plan refresh, and
  resource refresh behavior.

### Slice 5 - Manual Grouping Apply Routing

- Convert shot rail grouping `applyState` and `groupingApplyError` into the
  shared save-notification state.
- Keep the `Editing Groups` header command visible during group editing.
- Ensure the save notification renders at the far right when `Editing Groups`
  is also visible.
- Show success briefly in the header after groups apply.

### Slice 6 - Cleanup

- Delete `packages/studio/src/ui/autosave-status.tsx`.
- Remove unused imports and props.
- Update or remove tests that asserted local save-status placement.
- Keep tests focused on current intended behavior only.

## Verification Plan

Use desktop-first verification only.

Run focused tests first:

```bash
pnpm --dir packages/studio test
```

Run broader workspace checks if the focused tests pass:

```bash
pnpm check
pnpm lint
pnpm test
```

Manual browser verification through `pnpm dev:studio` should cover:

- editing Project Information shows `Saving` and `Saved` in the details header;
- forcing a Project Information save failure shows the error in the details
  header;
- editing Shot Specs from Composition shows save feedback only in the details
  header;
- editing Shot Specs from Motion shows save feedback only in the details
  header;
- editing AI Production setup shows save feedback only in the details header;
- applying shot rail grouping shows progress and failure in the details header;
- the `Editing Groups` header command and save notification do not overlap;
- unrelated Sonner toasts still appear for non-save workflows.

## Completion Checklist

### Review Area

- [x] Confirm ADR 0027 remains the accepted decision for this slice.
- [x] Confirm the implementation scope is limited to save notifications.
- [x] Confirm no mobile behavior is introduced, optimized, or reported.
- [x] Confirm unrelated dirty worktree changes are not modified.

### Architecture And Contracts

- [x] Add the shared save-notification component under `packages/studio/src/ui`.
- [x] Keep the component domain-neutral and independent from one hook.
- [x] Keep autosave ordering in `createLatestOnlySaveQueue` and
      `useDebouncedAutosave`.
- [x] Add caller-owned fallback error messages to `useDebouncedAutosave`.
- [x] Update `PanelShell` so save notification placement is explicit.
- [x] Preserve the header title, command action, and content layout contracts.
- [x] Do not add compatibility aliases, re-export stubs, or pass-through
      wrappers for `AutosaveStatus`.

### Project Information Surface

- [x] Replace `AutosaveStatus` usage in `movie-studio-screen.tsx`.
- [x] Keep `ProjectInformationPanel` reporting autosave status upward.
- [x] Confirm Project Information save feedback appears at the details header
      top-right.
- [x] Confirm Project Information save errors keep actionable server messages.

### Scene Shot Specs Surface

- [x] Remove local save-status rendering from `CustomFieldRow`.
- [x] Update `SceneShotCompositionTab` after the `CustomFieldRow` prop change.
- [x] Update `SceneShotCameraMotionTab` after the `CustomFieldRow` prop change.
- [x] Route Shot Specs autosave status from `ShotSpecsProvider` or
      `SceneShotDetail` to the details header.
- [x] Confirm returned shot-list resources still refresh the selected scene
      state after save.
- [x] Confirm local field layout does not leave awkward empty space where the
      old badge was removed.

### AI Production Surface

- [x] Remove local save-status rendering from
      `SceneShotAiProductionRunSetup`.
- [x] Route `useShotVideoTakeProduction` autosave status to the details header.
- [x] Preserve Run Setup controls, final prompt display, estimates, and
      multi-shot badge.
- [x] Confirm AI Production save errors appear in the details header.

### Shot Rail Grouping Surface

- [x] Convert grouping apply progress into header save-notification state.
- [x] Convert grouping apply failure into header save-notification state.
- [x] Show a short success state after grouping apply succeeds.
- [x] Preserve the `Editing Groups` header command.
- [x] Confirm the header command and save notification fit in the 45px header.
- [x] Keep the review dialog's apply button disabled while saving.
- [x] Decide whether the dialog should also keep a local inline error for
      context; if it does, document why this is not the primary notification.
      The dialog keeps its inline error as immediate review-dialog context, while
      the details header remains the primary save notification placement.

### Tests

- [x] Update Project Information tests for the new shared component or header
      placement.
- [x] Update Shot Specs tests so they no longer expect local save badges.
- [x] Add or update tests for Shot Specs header save notification routing.
- [x] Add or update tests for AI Production header save notification routing.
- [x] Add or update tests for grouping apply error routing.
- [x] Add a focused test for header trailing ordering when both a command and a
      save notification are present.
- [x] Ensure no tests preserve obsolete `AutosaveStatus` behavior.

### Documentation

- [x] Keep ADR 0027 linked from frontend architecture documentation.
- [x] Update any frontend guideline text if implementation adds a reusable
      header notification pattern worth documenting.
- [x] Keep this plan updated as slices are completed.

### Final Verification

- [x] Run `pnpm --dir packages/studio test`.
- [x] Run `pnpm check`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Verify the desktop UI in the browser.
- [x] Confirm `rg -n "AutosaveStatus|autosave-status" packages/studio/src`
      returns no feature-code usage after cleanup.
- [x] Confirm `rg -n "Saving|Saved" packages/studio/src/features` does not
      reveal local feature-rendered save badges outside the details header path.
