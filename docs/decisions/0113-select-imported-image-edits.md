# 0113 Select Imported Image Edits

Date: 2026-10-11

Status: accepted

## Context

[ADR 0058](0058-make-studio-image-editing-agent-owned.md) and
[ADR 0088](0088-use-exact-request-references-and-source-derived-image-continuation.md)
store an imported `image.edit` result beside its source as a separate,
unselected Asset. The user then has to select the edit before Studio and later
generation requests use it.

Directors iterate on one image: each edit builds on the previous result. The
Codex FLUX 3 Image Edit panel
([plan 0227](../../plans/active/0227-codex-flux-3-image-edit-panel.md)) starts
each new edit from the selected image, and the user decided that the latest
edit should be the selected one by default, changed in Studio when wanted.
[ADR 0112](0112-select-one-dialogue-audio-take-per-line.md) made the same
choice for dialogue Takes.

## Decision

- Importing an `image.edit` result selects it, in the same transaction, when
  its owner and type have a canonical selection: Project cover, Cast profile,
  Location hero, Prop hero, Lookbook image, Shot image and Scene Beat
  storyboard image.
- The import report then includes that selection's Studio resource keys as
  well as the candidate keys, so Studio refreshes the selection. This matters
  for covers, which previously returned only candidate keys.
- Types without a selection are unchanged: character, Location, Prop and
  Lookbook sheets, and the Shot Plan image roles (ADR 0064). Their result is
  stored beside the source as before.
- This applies to every `image.edit` import, including the conversational flow
  and other agents, not only the Codex panel.
- Discarding the selected edit leaves the target without a selection. Core does
  not reselect an older image, and restoring from Trash returns it unselected,
  as for every other selection.
- The source rule and source-derived destination from ADR 0088 are unchanged.
  ADR 0058's agent ownership and output review are unchanged; only its
  "unselected result" consequence is superseded.

## Consequences

- The newest edit is in use immediately in Studio and in generation contexts
  that read the selection.
- Undoing an edit means selecting the previous image in Studio or deleting the
  edit and selecting again.
- No schema change and no data migration. Existing unselected edits in Urban
  Basilica keep their current selection.

## Verification

Core tests cover selection for each selectable subject type, no selection for
sheets, Beat and Shot selection, cover selection resource keys, and no
reselection after discarding the selected edit.
