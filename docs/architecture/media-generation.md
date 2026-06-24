# Media Generation Architecture

Date: 2026-05-26

Status: current

Role: topic overview

## Purpose

Media generation is the Renku Studio path for creating AI media from project
context while preserving user choices, cost approval, and project metadata
boundaries.

The implemented purposes are `lookbook.image`, `cast.character-sheet`,
`cast.profile`, `location.environment-sheet`, `location.hero`,
`scene.storyboard-sheet`, the shot-video input purposes, and `shot.video-take`.
Precise contracts live in `reference/media-generation.md`.

## Current Shape

Generation and import are separate.

Generation reads project context, lists supported models for a purpose, persists
the user's generation spec, estimates cost, and returns a structured approval
summary. That approval covers both the estimated cost and the provider transfer
needed to run the exact request. A live run then uses the approval token from
that estimate, creates staged outputs, and records a durable generation run.

Import attaches an existing file to a project domain target. The file may come
from a Renku generation run, an external tool, a manual upload, or a download.
The domain target does not care how the file was produced.

Existing ElevenLabs provider voice sample retrieval is not media generation.
When a user supplies an ElevenLabs `voiceId` for a Cast Voice, `renku cast voice
attach` can resolve a provider sample id, fetch the MP3 from ElevenLabs, store it
under `cast/<handle>/voice-samples/`, and attach it as a normal Cast Voice
Sample. That path does not create a media generation spec, estimate, approval
token, or media generation run. New spoken samples generated from text still use
the `cast.voice-sample` media generation purpose.

For all current purposes, the CLI surface is generic:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.image --target lookbook:<id> --json
renku generation spec create --file <spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approval-token <token> --json
renku media import --purpose lookbook.image --target lookbook:<id> --source <path> --json
```

Internally, the common lifecycle is registry-backed. Core owns a media
generation purpose registry and shared generation service for purpose lookup,
spec persistence, prepare, estimate, dependency planning, run, and run
recording. Purpose definitions still own context construction, spec validation,
provider payloads, output names, dependency declarations, draft dependency
specs, and import behavior.

Browser-safe media generation contracts are split by ownership under
`packages/core/src/client`. Shared purpose, target, dependency, and lifecycle
contracts live in `media-generation-purpose.ts`,
`media-generation-target.ts`, `media-generation-dependency.ts`, and
`media-generation-lifecycle.ts`; each purpose keeps its context, spec, model
report, and import report shapes in its own client contract file. The public
browser entrypoint remains `packages/core/src/client/index.ts`.

Shot-video server behavior is split under
`packages/core/src/server/media-generation/shot-video-take`. Context loading,
take production state updates, route settings, provider payloads, dependency
inventory, dependency draft specs, preflight reports, production plan reports,
reference projection, input selection, media import, spec lifecycle, run
recording, and project-relative file safety each have a purpose-named owner
module. There is no local `shot-video-take.ts` compatibility surface or
shot-video index barrel; service wiring and the purpose registry import the
operation owner modules directly.

Dependency planning is shared media-generation architecture, not a shot-video
special case. Core builds a read-only dependency inventory from purpose-owned
dependency declarations, resolves existing assets through deterministic asset
selectors, estimates planned dependency specs through the same shared lifecycle
used by persisted specs, and aggregates the inventory total from dependency
lines plus the root generation line.

Dependency pricing and generation readiness are separate facts. A generated
dependency can be priced while still reporting `missing-input` when the user or
agent must supply setup before generation is runnable. Planning stays advisory:
route capability warnings and missing-input reasons do not generate assets,
drop selected references, cap selections, or rewrite user choices.

Dependency ids are also a core contract. Purpose code and Studio UI code must
not hand-build or parse dependency ids locally. Core-owned dependency id helpers
name the domain kind, target, and shot-video input slot, and core returns any
mutation data the Studio UI needs, such as the exact input slot to clear for a
selected general reference.

Shot-video dialogue audio references use the public subject kind
`scene-dialogue` and the dependency kind `reference-audio`. The dependency id is
keyed by dialogue id, not by the currently picked take asset id, so changing the
picked dialogue take keeps the same user selection while generation resolves the
current picked audio file at request time.

Selectors must state their defaulting policy explicitly. `selected-only`
selectors use only a concrete selected asset or sheet. `selected-or-default`
selectors may fall back to the purpose-owned default only when that behavior is
part of the selector contract. Unknown selector kinds, wrong request shapes,
invalid selected targets, missing selected files, unavailable referenced
Location Sheet assets, and missing primary image files are structured
dependency diagnostics, not quiet missing states.

There is one pricing meaning. Generated node prices come from provider
estimates in `@gorenku/studio-engines`; reused existing assets contribute
`$0.00`; manual external attachments are not generation work and are not
priced. Studio and CLI surfaces render inventory totals and line items, but
they do not compute generation prices.

Execution boundaries still fail fast. Final spec creation and provider payload
construction must reject selected inputs that cannot be sent to the selected
provider route, including unsupported dialogue audio references or audio
reference counts above the route limit.

Generated dependency lines start as unpriced until their draft spec is
estimated. They must not fall back to `not-applicable` pricing. `not-applicable`
is reserved for manual attachment work and unselected non-dependency
alternatives in product surfaces. If a dependency draft is invalid, lacks an
explicit materialization state, cannot be priced by a supported route, or the
root generation estimate fails, the planner returns structured diagnostics and
marks the inventory estimate unavailable or partial as appropriate.

Root spec creation and update refuse to persist a spec while required
dependencies are still planned or missing. Callers generate or import the
dependency outputs, refresh the inventory, and then create the root spec once
every required provider input resolves to a real project asset.

A generated file still does not become project metadata until an explicit media
import succeeds.

Location Sheets are full-image production reference boards. Core asks the
selected image model for one Location Sheet, and import stores one image asset
with one `primary` file plus a concise persisted description. Location Sheets
do not have Location-level pick/default selection, fixed view files, or azimuth
metadata. Shot/take workflows reference exact Location Sheet asset ids when a
sheet is useful for a specific generation.

Location Hero Images are separate display assets generated or imported from an
explicit source Location Sheet. They use asset type `location_hero`, Location
asset role `hero`, and one `primary` file. The selected hero image drives
Location overview/detail display only; it is never a hidden shot-generation
reference.

## Related References

- `reference/media-generation.md`
- `reference/studio-skills.md`
- `visual-language.md`
- `../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `../decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `../decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
- `../decisions/0036-use-unsliced-location-sheets.md`
