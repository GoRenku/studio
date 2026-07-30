# Use Thin Shot Documents And Shot-Owned Images

Date: 2026-07-26

Status: accepted

Decision 0068 supersedes only this decision's reference to the generic video
purpose. Thin Shot authoring and Shot-owned image behavior remain accepted.

Decision 0067 narrows the custom brief-language rule below for
`optics.depthOfField`: current Shot briefs accept only `shallow` or `deep`.
Description, Optics intent, focus target, and Lighting intent remain exact
opaque creative text. Decision 0067 also assigns the agent convention that
`focusTarget` names one primary optical subject, plane, or distance while
shared deep-focus legibility belongs in Optics intent.

Decision 0064 supersedes the Shot relationship table, representative naming,
shared-copy behavior, selected-Asset discard guard, and active-owner counting
described below. Thin Shot authoring and the `shot.image` purpose remain
accepted; Shot candidates now use exclusive membership and common selection.

## Context

Scene-owned mutable Shot Plans already separate cinematic Shot authoring from
narrative Beats and from independent generated video Assets. The existing Shot
shape lacked a title, intent-led glanceable summary, focused mutation commands,
and a durable relationship for representative planning imagery.

The CLI and agent workflow need incremental Shot changes without resubmitting
the whole aggregate. Representative imagery also needs ordinary GenerationSpec
provenance and recoverable Asset ownership without becoming a generated-video
selection model.

## Decision

A Shot stores a stable id, zero-based position, non-empty title, exact opaque
Markdown description, and an optional glanceable brief. The brief has
orthogonal Framing, Camera, Motion, Optics, Lighting, and approximate duration
fields. Core validates only the envelope. Custom non-empty filmmaking language
is valid, and Core never compares the brief with the description.

Shot Plan and Shot authoring use focused Core commands for plan details, Shot
add/update/move/recoverable remove, copy, and recoverable plan delete. The broad
whole-plan replacement command is removed.

`shot.image` targets one exact Shot and recommends the project aspect ratio. It
creates an ordinary image Asset related through `shot_asset` with role
`shot-image`. A Shot may retain several candidates. A separate
`shot_representative_display_asset` row selects zero or one candidate. Import
never selects or replaces that row.

An unselected candidate may enter Trash. Core rejects discarding the selected
candidate until the caller selects another candidate or clears the selection.
Removing a Shot or deleting a plan discards its active Shot image
relationships and discards the Asset tree only after the final active owner is
gone. Restore revives ownership and files. Copying a plan copies only each
Shot's selected representative relationship and selection; it shares the
existing Asset and fabricates no provenance or bytes.

When the user has not selected an execution route for `shot.image`, the
specialist agent proposes Codex built-in GPT-Image-2. The request is still
saved, previewed, explicitly approved, frozen before external execution,
inspected, accepted, imported with its real external Spec provenance, and
selected separately. A user-selected current Renku image model overrides this
preference. Codex remains outside Engines.

Decision 0062 remains authoritative for generated video: `video.create`
outputs are independent Project Assets and are not Shot-owned images.

## Consequences

- Shot Plans remain mutable and have no status, timeline, revision, or
  completion transition.
- SQLite remains the source of truth for Shot identity, order, image ownership,
  and representative selection.
- Core owns membership, position, selection, copy, and Trash invariants.
- CLI, Studio, and skills send intent and serialize structured diagnostics.
- Creative prose, brief coherence, prompts, and generated pixels remain
  user/agent-owned.
- The durable image path is
  `shot-plans/<shot-plan-id>/shots/<shot-id>/images/<asset-slug>.<ext>`, but
  runtime ownership is never inferred from that path.
