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
the user's generation spec, estimates cost for display, and runs an approved
provider request. Estimates do not approve runs. A live provider run requires
explicit one-time approval immediately before Core sends work to the provider
boundary. The durable generation run records the execution facts, not a separate
approval marker.

Import attaches an existing file to a project domain target. The file may come
from a Renku generation run, an external tool, a manual upload, or a download.
The domain target does not care how the file was produced.

Existing ElevenLabs provider voice sample retrieval is not media generation.
When a user supplies an ElevenLabs `voiceId` for a Cast Voice, `renku cast voice
attach` can resolve a provider sample id, fetch the MP3 from ElevenLabs, store it
under `cast/<handle>/voice-samples/`, and attach it as a normal Cast Voice
Sample. That path does not create a media generation spec, estimate, live
provider approval, or media generation run. New spoken samples generated from
text still use the `cast.voice-sample` media generation purpose.

For all current purposes, the CLI surface is generic:

```bash
renku generation context --purpose lookbook.image --target lookbook:<id> --json
renku generation model list --purpose lookbook.image --target lookbook:<id> --json
renku generation spec create --file <spec-json> --json
renku generation estimate --spec <spec-id> --json
renku generation run --spec <spec-id> --approve-live-provider-run --json
renku generation run --spec <spec-id> --simulate --json
renku media import --purpose lookbook.image --target lookbook:<id> --source <path> --json
```

Internally, the common lifecycle is registry-backed and split by ownership.
Core lifecycle services live under
`packages/core/src/server/media-generation/lifecycle` and own purpose lookup,
context/model service entrypoints, spec persistence, readiness preparation,
dependency planning, run orchestration, and persisted-spec estimate reads.
Core cost behavior lives under `media-generation/cost` and owns cost
projection, cost approval, cost-line pricing states, and the cost-only purpose
registry. Shared dependency ids, dependency selectors, dependency inventory,
dependency draft contracts, and dependency line projection live under
`media-generation/dependencies`.

Purpose implementations live under
`packages/core/src/server/media-generation/purposes`. Purpose definitions still
own purpose-specific context construction, spec validation, provider payloads,
output names, dependency declarations, draft dependency specs, and import
behavior. Cost projection code belongs in `media-generation/cost`, not hidden
inside purpose readiness modules.

Saved-spec generation previews follow
`generation-preview-purpose-bindings.md`. Image generation previews share one
model-configuration path based on provider route schema descriptors and the
actual provider payload. Purpose-specific preview code is a binding layer for
current context, provider plan selection, target/title data, and durable
reference asset/file ids; it must not duplicate image model-parameter row
construction. Final `shot.video-take` previews use shot-video route metadata
because they target video models with route-specific parameters and media input
slots.

Saved previews expose prompt text as two deliberate values:
`finalPrompt.authoredText` is the exact persisted prompt that Studio may edit,
while `finalPrompt.providerText` is the provider-facing preview after any
accepted app-owned transform. `finalPrompt.negativeText` is present only when
the selected provider model schema exposes a negative-prompt field; it remains
present as an empty editable string when the saved spec has no negative prompt
yet. Studio updates a saved preview through the focused Core
`updateGenerationPreviewSpec` lifecycle service. That service updates the
authored prompt, delegates editable reference selections to the owning purpose,
persists through the purpose's existing `updateSpec` contract, and rebuilds the
preview. Purpose-specific reference storage never belongs in the Studio route
or browser draft model.

Browser-safe media generation contracts are split by ownership under
`packages/core/src/client`. Shared purpose, target, dependency, and lifecycle
contracts live in `media-generation-purpose.ts`,
`media-generation-target.ts`, `media-generation-dependency.ts`, and
`media-generation-lifecycle.ts`; each purpose keeps its context, spec, model
report, and import report shapes in its own client contract file. The public
browser entrypoint remains `packages/core/src/client/index.ts`.

Shot-video server behavior is split under
`packages/core/src/server/media-generation/purposes/shot-video-take`. The
submodules are `authoring`, `planning`, `selection`, `specs`, `provider`,
`runs`, `imports`, `persistence`, and `shared`. There is no local
`shot-video-take.ts` compatibility surface or shot-video index barrel; service
wiring and the lifecycle registry import the operation owner modules directly.
Read-only take-state projections and project media file helpers live in
`shared` when multiple submodules need them without crossing into persistence
or provider ownership.

Dependency planning is shared media-generation architecture, not a shot-video
special case. Core builds a read-only dependency inventory from purpose-owned
dependency declarations, resolves existing assets through deterministic asset
selectors, estimates planned dependency specs through the same shared lifecycle
used by persisted specs, and aggregates the inventory total from dependency
lines plus the root generation line.

The dependency inventory is a human and agent to-do list, not an execution plan.
It may show the likely full workflow cost, including generated dependencies that
do not exist yet, but it must not create approval artifacts for dependency lines,
approval bundles, or automatic generation schedules. Each live provider
generation is still run and approved one at a time.

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
keyed by dialogue id, not by a take asset id. Dialogs stores the selected
dialogue audio take in the shot-video take direction, and generation resolves
that selected take to the concrete audio file at request time.

Shot-video prompt sheets are opaque image dependencies for Scene Shot Video
Takes. Core validates the durable generation envelope: purpose, take target,
dependency kind, selected references, model, parameters, prompt presence, and
the deterministic metadata fields `promptSheetVisualStyleId` and
`promptSheetNotationModeId`. Studio does not validate prompt-sheet layout,
panel count, labels, captions, timing marks, shot coverage, or whether the
generated pixels match the selected metadata. GPT-Image-2 is the default
prompt-sheet image model.

Shot-video take-owned media must not be shared between active takes. Video
Prompt Sheets, first frames, last frames, shot-video reference images, and final
take videos are part of a take's production workspace. Creating a copied take
iteration must copy take-owned media into new asset/file ownership for the new
take. Deleting a take may discard only media that Core proves is exclusively
owned by that take. Non-owned references such as Cast Character Sheets,
Location Sheets, Lookbook Sheets, and Dialogue Audio remain shared project
references. The accepted rule is
`shot-video-take-owned-media.md`.

Generation previews are a live review surface before expensive generation. The
CLI/agent contract is a saved media generation spec id or a transient
`MediaGenerationSpec` JSON file. The CLI asks Core to build the
`GenerationPreviewRequest`, then delivers that Core-authored preview to a
running Studio server. The Studio event contract is `StudioGenerationPreview`,
which is created after Core resolves logical `assetId + assetFileId` references
to active project asset files and builds meaningful subject labels. The preview
dialog shows generator-bound prompt text, model identity, resolved references,
provider token order, configuration, diagnostics, prompt-sheet metadata when
present, and sanitized provider payloads. Preview events are not durable project
history and do not create offline backlogs when Studio is closed.

App-owned prompt transforms are allowed only for specific Studio product roles
or mechanical provider handoffs. Current classifications:

- `scene.storyboard-sheet` is an accepted batch-generation optimization: Studio
  asks for a strict composite so agents can crop per-shot storyboard images.
- Lookbook image and Lookbook sheet generation are accepted Lookbook artifact
  transforms: Core appends role-specific Movie Lookbook or Storyboard Lookbook
  framing to an authored prompt.
- Location environment sheet and Cast character sheet dependency drafts are
  accepted artifact-role transforms: Core can draft a purpose-specific prompt
  from selected project context, then agents/users may revise the authored spec.
- Location Hero Image is an accepted Studio overview-surface transform derived
  from a selected Location Sheet and location metadata.
- Shot-video reference-conditioning prose is mechanical provider mapping: Core
  names selected logical references and provider token order without validating
  reference contents or prompt semantics.

None of these classifications allow Studio to inspect generated media contents,
require prompt wording, or generalize a sheet layout into runtime validation.

Selectors must state their defaulting policy explicitly. `selected-only`
selectors use only a concrete selected asset or sheet. `selected-or-default`
selectors may fall back to the purpose-owned default only when that behavior is
part of the selector contract. Unknown selector kinds, wrong request shapes,
invalid selected targets, missing selected files, unavailable referenced
or selected sheet assets, and missing primary image files are structured
dependency diagnostics, not quiet missing states.

There is one pricing meaning. Generated node prices come from provider
estimates in `@gorenku/studio-engines`; reused existing assets contribute
`$0.00`; manual external attachments are not generation work and are not
priced. Studio and CLI surfaces render inventory totals and line items, but
they do not compute generation prices.

There is one approval meaning. Estimates are display-only. A live provider
request requires explicit one-time approval for the current run command or
browser action. Parent dependency plans do not return child
approval artifacts, and live runs do not walk dependency inventories. The
accepted decision is `../decisions/0043-use-explicit-live-provider-run-approval.md`.

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

Generated output roots and import destinations follow
`project-asset-storage-conventions.md`. Core chooses the purpose-specific
output folder, and current durable asset paths must not use `generated/media/`.
Temporary agent/debug specs, receipts, and QA files belong under top-level
`tmp/`, while temporary Scene Storyboard source sheets live under the scene's
`storyboards/<sequence>/<scene>/tmp/` folder.

Location Sheets are full-image production reference boards. Core asks the
selected image model for one Location Sheet, and import stores one image asset
with one `primary` file plus a concise persisted description. Location Sheets
do not have Location-level pick/default selection, fixed view files, or azimuth
metadata. Shot/take workflows reference exact Location Sheet asset ids when a
sheet is selected for a specific generation direction. Shot-video take
references do not use hidden first-sheet defaults; available sheets remain
choices until a take direction stores the selected asset id.

Location Hero Images are separate display assets generated or imported from an
explicit source Location Sheet. They use asset type `location_hero`, Location
asset role `hero`, and one `primary` file. The selected hero image drives
Location overview/detail display only; it is never a hidden shot-generation
reference.

## Related References

- `reference/media-generation.md`
- `reference/studio-skills.md`
- `generation-preview-purpose-bindings.md`
- `project-asset-storage-conventions.md`
- `visual-language.md`
- `../decisions/0020-use-persisted-media-generation-specs-and-separate-media-import.md`
- `../decisions/0021-defer-generic-media-purpose-frameworks-until-concrete-duplication-exists.md`
- `../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `../decisions/0025-use-shared-media-generation-purpose-architecture.md`
- `../decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
- `../decisions/0036-use-unsliced-location-sheets.md`
- `../decisions/0043-use-explicit-live-provider-run-approval.md`
- `../decisions/0045-use-generation-preview-purpose-bindings.md`
