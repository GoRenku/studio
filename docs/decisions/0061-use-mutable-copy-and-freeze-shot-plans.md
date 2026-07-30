# Use Mutable Copy-And-Freeze Shot Plans

Date: 2026-07-23

Status: accepted

Decision 0068 supersedes this decision's remaining Shot Plan-to-Spec pointer
and Spec-copy behavior. Shot Plans now contain authoring state only.

Decision 0062 supersedes this decision's final-video ownership,
attachment-driven freeze, and coupled Trash behavior. It retains durable
mutable Shot Plans, ordered Shots, soft Beat context, the last-Spec convenience
pointer, and Shot Plan duplication.

## Context

Decision 0052 removed the old Shot Video Take aggregate so the next Shot model
could be designed without inherited grouping, reference ownership, or output
selection assumptions. Renku Studio now needs a small durable model that can
support direct Shot authoring and final video generation without introducing a
revision, dependency, or generic lifecycle system.

GenerationSpec already owns the exact authored request: execution kind, model,
provider values, prompt values, and references. Asset and AssetFile already own
durable media and its managed-Run or agent-external-Spec provenance. Trash
already owns recoverable deletion.

## Decision

A Scene owns any number of Shot Plans. A Shot Plan owns one ordered list of
Shots, optional soft Beat coverage, zero or one current GenerationSpec, and zero
or one final video Asset.

Shot Plans are edited directly in place. Core stores no Shot Plan authoring
history, revision number, snapshot, edit token, or status. A Shot stores opaque
`description` text and a strictly validated JSON `brief`. Beat coverage is
optional context: missing, stale, mismatched, or partially unavailable Beat
context produces read warnings and never invalidates the Shot Plan.

The current GenerationSpec remains the only owner of generation settings and
exact references. Copying a Shot Plan atomically creates a new Shot Plan, new
Shot ids, and—when the source has a current Spec—a new mutable Spec with the
same authored request and exact reference identities targeting the new plan.
It copies no Run, Asset, AssetFile, or reference media.

`shot-plan.video` is a video Generation purpose targeting
`{ kind: 'shotPlan', id }`. Managed and agent-external attachments must use the
plan's current Spec. Manual attachment needs no synthetic Spec or Run. Attaching
the first final video creates an ordinary `shot-plan-video` Asset and primary
AssetFile, records existing provenance when applicable, and sets
`shot_plan.video_asset_id` plus `video_attached_at` in the same transaction.
The presence of `video_asset_id` is the only freeze condition.

A frozen Shot Plan cannot be edited, have its current Spec replaced, or receive
a second video. It can be copied to begin another editable iteration. If the
linked video later becomes unavailable, the id remains and the plan stays
frozen.

Direct Shot Plan deletion uses the existing Trash lifecycle. The plan and the
video Asset/File discarded by that operation can be restored together. Shots
remain stored behind their discarded parent. Generation Specs, Runs, and
reference media remain independent durable history.

## Consequences

- `shot_plan` and `shot` are the only new tables.
- There is no Shot Plan revision, output, owned-reference, dependency, or
  selected-output table.
- Shot Plan prompts, exact references, Shot text, Beat content, and video bytes
  remain opaque to runtime code.
- A Run can finish before later direct Shot Plan edits. Attaching one of its
  exact outputs freezes the current authored plan; Core does not reconstruct a
  historical authoring state.
- Reused exact references are not retained or copied. Existing preview and
  execution readiness report them as unavailable when their source file is no
  longer available.
- Scene ids and Beat ids are logical context references. Shot Plan persistence
  does not cascade with current screenplay row recreation.

## Supersedes

This decision replaces the “no durable Shot model” direction in Decision 0052.
It narrows Decision 0056 only for atomic Shot Plan copying: the original
GenerationSpec remains frozen, while the copied Shot Plan receives a new mutable
Spec.
