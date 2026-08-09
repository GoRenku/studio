# Detach Shot Plans From Generated Video Assets

Date: 2026-07-24

Status: accepted

Decision 0076 supersedes the historical `videos/` destination below. Shot Plan
video Assets remain Project-owned and detached from Plan lifecycle, but their
files now live in the exact provenance-derived Scene/Plan folder.

Decision 0068 supersedes this decision's generic video purpose, Project-video
destination, and last-Spec continuation behavior. Its independent Asset
ownership, exact provenance, and one-way non-FK `authoredFrom` direction remain
accepted.

## Context

A Shot Plan is an authoring surface that users continue to revise while trying
different video requests. Treating its generated video as a final owned output
made the plan immutable too early and coupled plan deletion, media lifecycle,
and generation history.

The existing generation model already preserves the exact request that produced
media. A live run permanently freezes its `GenerationSpec`; managed Asset File
provenance points to the exact Run snapshot, and agent-external provenance
points to the exact frozen Spec.

## Decision

A Shot Plan remains mutable regardless of generation, Run, or Asset history. It
owns ordered Shots and optional soft Beat coverage, but it owns no generated
video and has no frozen authoring state.

A Shot Plan may identify one `lastGenerationSpec`. This is the most recently
associated request configuration to continue from, regardless of whether it has
not run, failed, or succeeded. Run and Asset lifecycle events never move or
clear this pointer.

The last Spec is edited directly while mutable. Once live execution freezes it,
the same Spec can be retried unchanged. A changed request uses a new mutable Spec
copied from the frozen last Spec, and the Shot Plan atomically points to that
copy. Copying a Shot Plan remains available and copies its optional last Spec
into a new mutable Spec for the copied plan. Neither operation copies Runs,
Assets, Asset Files, provenance, or media.

`video.create` is a project-scoped generation purpose. Its generated outputs
are imported as independent Project Assets under `videos/` with the existing
exact managed-Run or frozen agent-external-Spec provenance.

A `GenerationSpec` may carry soft authoring context:

```ts
authoredFrom?: {
  kind: 'shotPlan';
  id: string;
}
```

This value is information for grouping and display. It is not a generation
target, ownership relationship, foreign key, execution requirement, or Shot
Plan snapshot. Generation, import, inspection, and deletion never resolve it
to current Shot Plan contents or require that the plan still exists.

Shot Plan Trash and Project Asset Trash are independent. Deleting or restoring
one never deletes, restores, or changes the other.

## Consequences

- The exact frozen `GenerationSpec` remains the explanation of what generated
  an Asset.
- A future Generations tab can project independent video Assets through
  provenance and optional `authoredFrom` context without adding a Generation,
  Attempt, selected-output, or Shot Plan-to-Asset entity.
- Multiple video Assets may come from the same Spec or from different Specs.
- There is no final or selected Shot Plan video.
- There is no Shot Plan reconstruction from generation history.
- The schema change contains no data conversion because Shot Plans had no
  persisted use before this decision.

## Supersedes

This decision supersedes the final-video ownership, attachment-driven freeze,
and coupled Trash behavior in Decision 0061. It retains mutable Shot Plans,
ordered Shots, soft Beat coverage, the last-Spec convenience pointer, and Shot
Plan duplication.
