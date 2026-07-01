# Recoverable Discard And Trash

Renku Studio uses recoverable discard for durable project content that a user or
agent expects to restore later. Ordinary discard commands write `trash_operation`
and `trash_item` rows, mark lifecycle columns, and keep media bytes in their
original project paths until Empty Trash runs.

Empty Trash is the only project-content path that stages discarded media files
into `.renku/trash/emptied/<operation-id>/`. Agents must not run Empty Trash
unless the user explicitly asks for it after reviewing `renku trash empty
preview`.

## Restore Conflicts

Restore must not silently take over a current active choice made after discard.
When a discarded selected or picked item is restored and another active item now
owns that selected or picked slot, the restore keeps the restored content but
leaves the newer active choice in place. The report includes a structured
warning so agents and Studio can tell the user what happened.

Current conflict examples:

- A restored Shot Video Take input that used to be selected is restored as a
  take when another active input is already selected for the same slot.
- A restored Scene Shot Video Take that used to be picked is restored as
  unpicked when another active take is already picked for the scene.
- A restored Scene Dialogue Audio take is restored as media only. Shot-video
  take dialogue selections are validated separately through selected-take
  diagnostics.

## Replacement Flow Audit

| Flow | Current behavior | Trash requirement |
| --- | --- | --- |
| Cast Member authoring replacement deletes | `castMember.delete` is a graph edit in the Cast authoring command. Core rejects the delete when assets or Cast Design documents still depend on the Cast Member. | No Trash item is created because no media artifact is discarded. Dependency-bearing Cast Members are blocked instead of detached or garbage-collected. |
| Location authoring replacement deletes | `location.delete` is a graph edit in the Location authoring command. Core rejects the delete when assets, Location Design documents, or scene references still depend on the Location. | No Trash item is created because no media artifact is discarded. Dependency-bearing Locations are blocked instead of detached or garbage-collected. |
| Screenplay document replacement | `screenplay create`, `screenplay apply`, scene revision, and screenplay revision restore write screenplay revision history. Replacement is revision-backed rather than Trash-backed. | No Trash item is required for screenplay graph edits because the revision log is the recovery mechanism. |
| Scene Shot List active/history updates | Writing or applying a Scene Shot List creates history rows and updates active state. Older shot lists remain readable as history, and active-state changes do not remove media bytes. | No Trash item is required for revision-backed shot-list replacement. Discarded Scene Shot Video Takes and take-owned media use the Trash lifecycle separately. |

If a future replacement flow removes durable media rows or user-visible generated
artifacts, it must use the central trash lifecycle rather than adding a
route-local, CLI-local, or React-local delete path.

## Garbage Collection Blockers

Garbage collection refuses to move files when the lifecycle state is unsafe.
Examples include:

- an active relationship still owns an asset that a Trash item is trying to
  collect;
- a file listed for staging is missing;
- a staged path escapes the project folder;
- any preflight blocker is found before file movement starts.

Shared active assets are not collected while any active owner remains. Their
discarded relationship can be garbage-collected without moving shared media
bytes.
