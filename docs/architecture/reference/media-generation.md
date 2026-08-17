# Media Generation

Date: 2026-07-12

Status: current

Role: reference

## Accepted Contract

The browser-safe source is `packages/core/src/client/generation.ts`.

```ts
interface GenerationSpec {
  executionKind: "renku-managed" | "agent-external";
  purpose: string;
  target: GenerationTarget;
  authoredFrom?: { kind: "shotPlan"; id: string };
  model?: { provider?: string; model?: string };
  values: Record<string, JsonValue>;
  references: GenerationReferenceSelection[];
  title?: string;
}
```

Registered AssetFile candidates carry exact Asset metadata for deliberate
request-scoped choice:

```ts
interface GenerationReferenceCatalogItem {
  oneLineSummary: string | null;
  referenceName: string | null;
  tags: string[];
}
```

Safe project-file references use null, null, and `[]`. Metadata never changes
eligibility, ordering, or selection.

`values` contains actual non-media provider field names and authored values.
Optional provider-defaulted fields remain absent until explicitly authored.
Media fields are not stored in `values`; an exact reference may receive an
optional authored `providerField` assignment.

A reference is either an exact registered `assetId + assetFileId` pair or a
normalized project-relative file path. Resolution never chooses another file.

```ts
interface GenerationReferenceSelection {
  placement:
    | {
        kind: "slot";
        sectionId: string;
        slotId: string;
        subject?: { kind: string; id: string };
      }
    | { kind: "additional" };
  providerField?: string;
  reference: GenerationReference;
}
```

The stable target kinds are `project`, `asset`, `lookbook`, `castMember`,
`location`, `scene`, and `sceneDialogue`. Every target is
`{ kind, id }`; purpose descriptors own any additional context lookup.

For Scene and Shot targets, Generation Context facts include
`projectAspectRatio`, opaque `contextText`, `sceneCastMemberIds`,
`sceneLocationIds`, `scenePropIds`, and `sceneDialogueIds`. Prop ids come from
canonical Screenplay Scene references followed by active Scene Beat `propIds`,
preserve first-seen order, and are never inferred from prose. The Scene
Storyboard guide exposes one exact `prop/prop-sheet` slot per Prop after its
Storyboard Lookbook, Character, and Location slots.

`authoredFrom` is optional information-only workflow context. Its recognized
shape currently identifies a Shot Plan by non-empty id. Core does not require
that plan to exist, use it as a target or owner, resolve its current contents,
or couple its lifecycle to validation, execution, import, or inspection.

`renku-managed` specs use Engines for validation, estimate, and execution.
`agent-external` specs preserve a request executed by the agent, such as a
Codex image request. They are saved and previewed normally but do not create a
Renku estimate, run, receipt, provider payload, or approval token.

For Beat Storyboards, one Project setting chooses the image path: **Use Codex
for image generation**. It is on by default. The Codex request is a frozen
prompt-only external `codex/gpt-image-2` Spec. Logical image references remain in the Spec without
provider-field assignments and are supplied to the built-in tool. If the
setting is off, or the user explicitly chooses Renku, use
`fal-ai/openai/gpt-image-2/edit`. The purpose exposes no separate model
recommendation. Core keeps managed quality fixed high.

The Storyboard Lookbook alone controls Beat Storyboard appearance. Continuity
references preserve Character identity/design, Location geography, and Prop
construction/state while being re-rendered in the Storyboard Lookbook's visual
language. Storyboard-native continuity sheets reuse the existing subject-sheet
types and exact `storyboard` Asset tag; candidate metadata informs an agent's
request-scoped choice but never filters or selects in Core. This is an agent
prompt contract, not runtime semantic validation.
The agent authors any narrative-appropriate Beat count before partitioning only
requested image work into consecutive groups of at most four. It uses the
existing one-output composite and vision-guided crop path. Review-first shows
one result and waits for user direction. Explicit strict iteration creates a
new reviewed request after every creative change and retains all ordinary cost,
confirmation, freeze, concurrency, and provenance boundaries.

The persisted record adds `frozenAt: string | null`. Draft records are editable.
Live submission freezes the exact saved revision permanently. Managed run does
this automatically; external execution uses `freezeGenerationSpec`. Estimate
and simulation do not freeze.

## Editing And Validation

Create, update, freeze, and standalone validate share one Core-owned durable
envelope validator. Create and update accept partial state. The validator checks:

- purpose and target-kind agreement with the supplied purpose contract on
  creation and exact immutable purpose/target identity on update;
- JSON-safe authored values;
- normalized project-relative paths or complete exact asset/file ids;
- structurally complete slot placement and at most one current choice per exact
  slot.

They do not require provider/model identity, provider-required values, file
availability, provider-field assignments, current purpose-guide placement,
candidate membership, or typed domain ownership.

For a Renku-managed spec, `validateGenerationSpec` performs execution readiness. It resolves exact
provider-assigned references, verifies file availability, asks Engines
to assemble the provider request, and returns all predictable provider-schema
and media-envelope issues without executing or writing a run.

Presence means inclusion; inactive reference alternatives are not persisted.
Unassigned references do not enter the provider payload. Validation never reads
context, guide candidates, or slot occupancy.

## Provider Model Descriptors

Engines descriptors expose each actual provider field with:

- field name, label, scalar/schema kind, required state, provider default, enum,
  and numeric bounds;
- optional product-setting classification for aspect ratio or quality;
- optional media metadata: accepted media kinds, cardinality, count limits,
  MIME types, byte/dimension/duration/aspect-ratio limits.

There is no Renku route id, input-mode id, purpose model union, or inferred
model-mode contract.

## Preview, Estimate, And Run

`buildGenerationPreview` preserves the exact spec, resolves its references for
display, and includes a provider payload only when readiness validation
succeeds. Agent-external Preview displays the saved prompt, values, references,
provider, and model without invoking Engines.

`estimateGenerationCost` consumes pricing inputs only: provider, model, output
media kind, available authored/provider pricing facts, and intended input-media
counts. It does not
resolve files, require prompts or references, assemble a provider payload, or
invoke execution validation. `estimateGeneration` adds a price approval token
for generic run flows; the token is based on provider, model, and estimated
price rather than creative prompt or file contents.

Absent provider values remain absent. Studio presents absent duration as
`Unspecified`, never authors `Auto` or a default value, and returns price
unavailable when exact pricing facts are insufficient.

`runGeneration`:

1. estimates and compares the supplied token with the current price;
2. repeats full execution validation;
3. conditionally freezes the exact saved revision for a live run;
4. makes no provider call and writes no run for predictable validation or freeze failure;
5. executes once through Engines;
6. persists an immutable success, simulation, or provider-failure run with
   outputs, receipt, and diagnostics.

A provider failure after execution begins is a persisted failed run. A
predictable validation or approval failure is not.

## Video Capability And Shot Plan Context

Studio currently exposes no product video-generation purpose or focused video
attachment destination. Engines retains its generic video model descriptors,
provider schemas, validation, pricing, simulation, routing, and execution
adapters independently from the Studio purpose registry.

A GenerationSpec may retain optional
`authoredFrom: { kind: 'shotPlan', id }` context. This nullable, indexed value
has no foreign key and points only from the request to its source context. Shot
Plans store no GenerationSpec id or lifecycle state. Copying, deleting,
restoring, or permanently removing a Shot Plan never reads, copies, updates, or
invalidates a GenerationSpec, Run, Asset File, or Asset.

## Shot Images

`shot.image` is an image purpose targeting `{ kind: "shot", id }`. Core
resolves the exact Shot and owning Scene, projects opaque Shot facts, and
recommends the current project aspect ratio. It does not inspect Shot prose or
pixels.

Focused import writes a `shot_image` Asset, exclusive Shot membership, and the
Core-owned path
`scenes/<scene-number>/<plan-number>-shot-plan/shot-images/`. Import may
atomically select the candidate when `select` is explicit. Choosing an existing
candidate uses common Asset selection. Managed imports require an exact
matching Run; external Codex imports require the exact frozen agent-external
Spec.

Copying a Shot Plan copies only each source Shot's selected image. Core
allocates new Asset and AssetFile ids, copies bytes to new Shot-owned paths, and
preserves existing provenance links. The copied image and source image then
have independent ownership and Trash lifecycles.

## Database Generation 53

Migration `0067_unified_asset_ownership.sql` replaces relationship storage with
exclusive `asset_membership`, adds common `selected_asset`, preserves
Asset/File/provenance, Shot ownership and selection, and focused detail facts,
and advances the project database to generation 53. It aborts ambiguous
existing ownership rather than guessing. There is no compatibility reader or
creative-data rewrite.

## Database Generation 52

Migration `0066_concerned_the_fury.sql` adds Shot title and lifecycle columns
plus the Shot Asset and selected-image tables that migration 0067 converts into
the common ownership and selection model.

## Database Generation 51

`media_generation_spec` columns:

```text
id, purpose, target_kind, target_id, execution_kind, provider, model, title,
values_json, references_json, authored_from_shot_plan_id, frozen_at, created_at,
updated_at
```

`media_generation_run` columns:

```text
id, spec_id, purpose, target_kind, target_id, provider, model,
spec_snapshot_json, provider_payload_json, estimate_json, approval_token,
status, outputs_json, receipt_json, diagnostics_json, started_at, completed_at
```

Migration `0059_scene_beats_and_shot_authoring_reset.sql` removes the retired
Shot Video Take generation purposes, targets, specs, runs, provenance, and
Take-owned assets. The current generation runtime has no compatibility reader,
target parser, attachment route, or fallback for those contracts.

Migration `0065_detach_shot_plans_from_generated_video_assets.sql` removes Shot
Plan video ownership, adds the soft authored-from column, and advances the
database to generation 51. It performs no purpose translation, JSON rewrite,
Asset reassignment, or other data conversion because Shot Plans had no
persisted use.

`asset_file_generation` remains the Renku-run provenance record. An AssetFile
may separately link to the agent-external GenerationSpec that produced it.
Generation Request inspection reads the exact managed run snapshot or frozen
external source spec recorded for that AssetFile.

Generation Preview projects saved record context as
`generationSpec?: { id, frozenAt }`. File-only previews omit it. Frozen saved
previews are read-only. Generation Request inspection projects original request
context as read-only Prompt, selected References, and static Config tabs by
reusing the same resource. Image editing is an agent-owned new `image.edit`
request with the exact source AssetFile locked in `source/source-image`.

`prop.sheet` and `prop.hero` are focused image purposes targeting
`{ kind: "prop", id }`. Prop Sheets expose ready same-owner prior sheets as
optional candidates and retain only exact request selections. Prop Heroes use
canonical owner-scoped selection for overview/detail display.

Decision history is recorded in
`../../decisions/0047-use-context-first-provider-valid-generation.md` and
`../../decisions/0055-preserve-agent-external-generation-specs-on-images.md`.
The irreversible lifecycle is recorded in
`../../decisions/0056-freeze-generation-specs-at-live-execution.md`.
Mutable Shot Plans, last-Spec continuation, and independent generated video
Assets are recorded in
`../../decisions/0062-detach-shot-plans-from-generated-video-assets.md`.

The current specific replacement is Decision
`../../decisions/0069-use-shot-plan-video-generation-with-weak-context.md`.
It uses independent Project video Assets, one-way Shot Plan context, explicit
input mode, and the shared Preview lifecycle. It does not use last-Spec
continuation state.
