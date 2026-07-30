# Use Shot Plan Video Generation With Weak Context

Date: 2026-07-30

Status: accepted

## Context

Decision 0068 removed an unreachable Shot-video product island, a generic
video purpose, and reverse Shot Plan generation state. Renku still needs a
specific, reachable workflow that can author videos from the current creative
context of a Shot Plan without restoring ownership or lifecycle coupling.

Engines already owns broader provider discovery. Studio needs a smaller,
deliberate activation boundary and one shared Preview editor that can expose
video input strategy, model family, and configurable values without parsing
creative prompts or media.

## Decision

Add purpose `shot-plan.video-generation` and auxiliary image purposes
`shot-plan.video-first-frame`, `shot-plan.video-last-frame`, and
`shot-plan.video-storyboard`. All target Project and structurally require
`authoredFrom: { kind: 'shotPlan', id }`. The association is weak: it is not a
foreign key, Asset owner, dependency, selected video pointer, snapshot,
cascade, or readiness rule.

The video purpose additionally requires one `shotPlanVideoInputMode`:
`text-only`, `first-frame`, `first-last-frame`, or `reference`. Image purposes
forbid the field. Migration 0069 adds its nullable storage column and advances
schema generation from 54 to 55.

Engines owns one Studio video activation catalog with three Seedance 2.0
families—standard, Mini, and Fast—and their exact text-to-video,
image-to-video, and reference-to-video fal routes. Studio availability is a
derived flattening of that catalog. Generic provider discovery may retain
inactive Kling, Veo, and other implementations.

Core owns route selection, input-mode media routing, provider-schema value
validation, reference guide construction, input-mode-aware Preview reference
projection, attachment provenance, and the Scene Generations projection. The
product starts resolution at editable `480p`; this is catalog authoring
initialization, not a fixed Core setting.

Accepted videos become independent Project-owned `shot_plan_video` Assets
under `videos/`. Auxiliary images are independent Project Assets under
`videos/references/`. No dependency graph or reverse Shot Plan pointer is
created.

Scene Generations groups active videos by the current title and normal order of
their source Shot Plan. A trashed but restorable plan contributes only Scene
context, so its videos appear in a final `Miscellaneous` group. Once Empty
Trash permanently collects that plan's Trash item, its weak id supplies no
Scene context and its videos disappear from scene-scoped projections while
remaining valid Project Assets.

The exact invalidation key is
`surface:scene:<scene-id>:video-generations`. Video attach/discard/restore,
Shot Plan rename/Trash/restore, and successful Empty Trash emit it when exact
provenance still resolves the Scene. There is no generic Project Assets key.

Shared Preview authoring is discriminated as image, video, or none. The video
strategy owns only catalog-backed input/model/config projection and updates.
Core projects only the unselected typed slots usable by the saved video input
mode: first/last-frame authoring shows only its frame slots, while reference
mode shows compatible available optional media and named Cast/Location
placeholders. Empty Dialogue Audio slots are omitted. Exact persisted
selections remain visible for removal after an input-mode change.
Prompt and generated/reference media contents remain opaque. Provider-visible
mentions preserve exact `@ImageN`, `@VideoN`, and `@AudioN` values supplied by
the agent-authored request.

## Consequences

- Shot Plans remain authoring-only and copy/delete independently from video
  requests and Assets.
- CLI and Studio adapters pass intent to Core and do not resolve plans, routes,
  candidates, or provenance.
- Studio exposes only the activated Seedance catalog while provider research
  and generic Engines discovery can remain broader.
- Saved Preview, estimate, live freeze, request inspection, and provenance use
  the shared current generation architecture.
- Missing optional references and unavailable current Shot Plan context are
  structured guide notices, not write or execution failures.
- Skill workflow guidance, reusable video prompt craft, provider research, and
  active route mappings are separate so inactive research cannot activate a
  runtime model.

## Supersedes

This decision supersedes Decision 0045 only where it required a separate
shot-video Preview route and helper path. It builds on Decision 0068's cleanup
and does not restore the removed generic purpose, reverse pointer, Take model,
or dormant UI.
