# 0027 Use Details Header For Save Notifications

Date: 2026-06-06

Status: accepted

## Context

Renku Studio already uses a latest-only queue for autosave ordering, but the
visible save feedback has drifted across surfaces.

Current examples:

- Project Information autosave reports `Saving`, `Saved`, and save errors in
  the Movie Studio details header.
- Shot design custom fields report the same autosave states beside the edited
  text area.
- AI Production setup reports autosave state inside the Run Setup panel.
- Shot rail grouping reports manual apply progress and apply failures inside
  the review dialog, while its edit-mode control already appears in the details
  header.

This makes the same product event feel different depending on where the user is
working. A user changing Project Information learns to look at the top-right
details header, but a user editing shot specs or AI Production must scan inside
the active tab. On save failure, this increases the chance that an error is
missed because the message can be visually far away from the app-level surface
that owns the current detail page.

The details header already acts as the selected-surface command area. It is the
right stable location for save feedback because it remains visible while a
detail surface changes its inner tabs and controls.

## Decision

All save notifications in `packages/studio` must render in the top-right area
of the Movie Studio details header.

For this decision, save notifications include:

- autosave progress;
- autosave success;
- autosave failure;
- manual save or apply progress for persisted detail-surface changes;
- manual save or apply failure for persisted detail-surface changes.

Feature content must not render its own `Saved`, `Saving`, or save-failure badge
beside individual controls or inside nested tab panels. Feature content may keep
local validation, loading, empty-state, and domain-specific diagnostic messages
when those messages are not save feedback.

Use one shared UI component from `packages/studio/src/ui` to display save
notification state. The shared component owns:

- the compact visual treatment;
- success, pending, and error icons;
- accessible `status` and `alert` roles;
- consistent spacing and color rules;
- truncation rules for long error text.

The details header owns placement. The save notification appears at the far
right of the header's trailing area. Other header commands, such as an add
button or an edit-mode action, sit to the left of the notification when both are
present.

`AutosaveStatus` should not continue as a separate visual primitive after this
refactor. Rename or replace it with the shared save-notification component and
update callers directly. Do not add compatibility aliases, pass-through
wrappers, or re-export stubs.

`useDebouncedAutosave` may continue to own autosave timing and latest-only save
queue coordination. It should expose status data that can be passed to the
details-header notification path, but it should not decide where the message is
rendered.

Non-save toasts remain separate. Export progress, destructive-action failures,
resource load failures, and other workflow notices can continue to use their
current UI patterns until a separate notification architecture decision changes
them.

## Consequences

- Users get one predictable place to check whether detail-surface edits have
  saved.
- Nested editors no longer need one-off save badges near controls.
- Save failures are easier to notice because they appear in the persistent
  details header instead of inside whichever tab or dialog happens to own the
  operation.
- The header trailing area becomes a small coordination point for selected
  surface actions and save state.
- Implementation must route save status upward from nested editors, especially
  Scene Shot specs and AI Production, instead of rendering it locally.
- Tests should assert placement by checking that save status appears in the
  details header and no longer appears beside the edited field or inside the
  nested setup panel.
