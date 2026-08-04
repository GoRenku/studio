# 0073 Keep Screenplay-Derived Artifacts Weak

Date: 2026-08-04

Status: accepted

## Context

Screenplay Analysis, Scene Beat Sheets, Shot Plans, and Dialogue Audio are
authored or generated from Screenplay context at a point in time. Treating
their stored Scene, Block, Dialogue Turn, Cast Member, Location, Prop, or Beat
ids as live reverse dependencies gives past production work veto power over
future Screenplay authoring. Cascading deletion also destroys useful history
when an upstream Scene is removed.

## Decision

The Screenplay is independently mutable. Its commands validate the
Screenplay's own schema, structure, and internal references, but do not inspect
downstream artifacts before committing an edit.

Screenplay-derived artifacts retain the exact ids and snapshots used when they
were authored. Those values are weak historical context:

- missing current context never makes a stored artifact corrupt;
- stored reads validate the artifact's self-contained schema, not whether every
  contextual id still resolves against the current Screenplay;
- validation and creation commands may compare a new artifact with current
  context, but missing Beat Sheet context is advisory rather than blocking;
- deleting a Scene does not cascade-delete Beat Sheet history, its active
  pointer, Dialogue Audio, Dialogue Audio Takes, Shot Plans, or their media; and
- explicit user deletion or a future garbage-collection workflow owns cleanup.

Commands that create new context-dependent work still require the relevant
current Scene, Block, Dialogue Turn, or other source context. Screenplay-owned
references remain strong inside the Screenplay aggregate and are removed when
their owning Scene is deleted.

## Consequences

- Users can revise or delete Screenplay content without first deleting prior
  analyses or production work.
- An active Analysis or Beat Sheet may describe an older Screenplay revision.
- Projections must tolerate unresolved contextual ids and may present warnings
  when a current-context comparison is useful.
- Historical artifacts remain individually readable and deletable through
  their durable identities.
- Project storage can accumulate obsolete artifacts until the user deletes
  them or an explicit garbage-collection feature is added.
- Scene foreign keys are intentionally absent from Beat Sheet history/state
  and Dialogue Audio persistence. Shot Plans already use the same weak Scene
  relationship.

This decision narrows Decisions 0071 and 0072: their current-context rules
apply when authoring new artifacts, not when reading immutable history or
mutating the Screenplay later.
