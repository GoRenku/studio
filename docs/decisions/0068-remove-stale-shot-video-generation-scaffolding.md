# Remove Stale Shot Video Generation Scaffolding

Date: 2026-07-30

Status: accepted

## Context

Renku Studio retained an unreachable Shot AI Production presentation island,
a generic `video.create` product purpose, and a reverse Shot Plan pointer to a
GenerationSpec from an earlier failed iteration. Those contracts made dormant
UI and continuation behavior look like current architecture even though no
reachable product workflow used them.

The bundled Shot Design images and motion videos are different: current
Composition, Motion, and Shot Plan surfaces actively use those assets. Engines
also owns generic video model descriptors, schemas, pricing, simulation, and
provider adapters independently from Studio product purposes.

## Decision

Delete the dormant Shot AI Production and Shot video preview components rather
than migrating or salvaging them. Preserve all bundled Shot Design media and
their active consumers.

Remove `video.create` from the Studio GenerationPurpose contract and remove its
only Project-video attachment destination. Studio has no user-callable video
generation purpose until a specific product workflow is accepted. Generic
Engines video capability remains available and purpose-independent.

Shot Plans contain no GenerationSpec id, continuation state, reverse pointer,
copy behavior, or generation lifecycle command. Copying a Shot Plan copies its
authored plan, Shots, and selected Shot images only. Shot Plan deletion,
restoration, and permanent removal do not mutate GenerationSpecs, Runs, or
independent Assets.

`GenerationSpec.authoredFrom?: { kind: 'shotPlan'; id: string }` remains the
only weak source-context value. Its
`media_generation_spec.authored_from_shot_plan_id` column stays nullable,
indexed, one-way, and free of a foreign key. A missing or discarded source Shot
Plan does not invalidate the GenerationSpec, Run, attached Asset, provenance,
inspection, or deletion.

Migration `0068_remove_stale_shot_video_scaffolding.sql` removes the obsolete
Shot Plan column and unique index. Because Drizzle Kit's parent-table rebuild
can cascade-delete Shot rows when migrations run transactionally with foreign
keys enabled, the migration temporarily preserves and restores all active and
discarded Shots. It advances the project schema generation from 53 to 54.

No compatibility alias, retired-purpose diagnostic, old-field reader, wrapper,
or replacement generic video abstraction is provided.

## Consequences

- Current Shot Plan contracts are smaller and contain authoring state only.
- Generation requests may retain loose Shot Plan context without creating
  ownership or lifetime coupling.
- Studio purpose registries and CLI documentation advertise only workflows that
  currently exist.
- Current `media-producer` guidance covers current image and audio workflows;
  future Shot Plan video guidance must arrive with its accepted product
  purpose.
- Plan `0162-shot-plan-video-generation.md` must build on schema generation 54
  and must not restore the deleted UI, generic purpose, reverse pointer, or
  Take-era workflow.
- The separate machine-local `renku-create-video` skill remains outside this
  repository decision and is not modified.

## Supersedes

This decision supersedes Decision 0061's remaining Shot Plan-to-Spec pointer
and Spec-copy behavior. It supersedes Decision 0062's generic video purpose,
Project-video destination, and last-Spec continuation behavior while retaining
its independent Asset ownership, provenance, and one-way `authoredFrom`
direction. It narrows Decision 0063 only where that decision names the removed
generic video purpose.
