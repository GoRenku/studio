# 0143 Flexible Generation Authoring, Typed References, And Materialized Takes

Status: complete
Date: 2026-07-15
Depends on: Plan 0142

## Summary

Correct the rigid generation-reference rules added by Plan 0142 while retaining
the small amount of domain structure required to render trustworthy reference
authoring UI.

The central product rule is that a Shot Video Take is editable authoring intent
only until its first successful materializing generation. Failed provider runs
may remain on the same unmaterialized Take so the user or agent can correct the
request and retry. The first successful Take generation materializes and
freezes that Take. Any later edit or regeneration starts a new Take seeded from
the completed Take's authoring values and independent copies of its Take-owned
supporting images; it does not edit the completed Take and does not inherit its
final video, run history, receipt, or provenance. A Take has at most one
successful materializing generation.

Typed reference slots remain useful UI structure. While a Take is Draft, Studio
shows one Character Sheet slot for every Cast Member in the Scene, not only the
Cast Members in the Take's currently selected Shots. The same scene-level rule
applies to Location Sheet slots, and one Production Lookbook slot is always
shown. This keeps the reference workspace stable while Draft Take Shot
membership changes. Each slot may be empty or may contain an exact choice
authored by the agent or user. A slot picker lists only the domain assets
explicitly registered for that subject. Empty slots are expected and valid;
Studio never fills them, selects the first candidate, or substitutes another
asset.

The three Take-owned supporting roles—First Frame, Last Frame, and Video Prompt
Image—are fixed Draft Take UI slots. They remain visible whether empty or filled
and regardless of the selected provider model or its current input schema. The
provider contract may later accept or reject their use during payload assembly;
it must not decide whether the Draft authoring slots exist.

Generic references are separate from typed slots. A user- or agent-supplied
image may be registered as a Shot-owned generic reference without becoming a
Character Sheet, Location Sheet, or Lookbook Sheet. It becomes eligible for a
typed slot only after an explicit focused domain workflow creates that typed
asset and relationship. Studio never infers this promotion from creative
contents, filenames, titles, prompts, or ownership guesses.

Core validates only the minimum authoring/reference envelope shape required to
persist and render the UI. It does not validate current guide membership,
candidate membership, typed ownership, provider readiness, reference
completeness, or creative suitability; bind provider fields; insert defaults;
repair values; or invent fallbacks. Engines remains the sole authority for the
executable provider request when payload preview or execution is requested.
Estimation is a separate pricing-only rail and must remain available whenever
the available pricing facts are sufficient, even when the provider request is
incomplete.

This plan also resolves the remaining correctness findings in the reviewed
patch:

- Take-owned images participate fully in discard, restore, ownership, and
  garbage-collection behavior;
- production export fails with a structured diagnostic when any picked Take
  lacks one current ready video instead of silently omitting that Take;
- Image Revision references become genuinely editable rather than opening a
  picker whose callback does nothing;
- completed Take media remains immutable while new Takes may be seeded from a
  completed Take's authoring values and independent copies of Take-owned
  supporting images;
- the Shot Video Take References tab renders the complete Draft workspace and
  the exact successful-run references for a Completed Take instead of
  regenerating both views from the current purpose guide;
- Core removes candidate-membership and purpose-guide-placement rejection, so
  ordinary saved references cannot raise
  `CORE_GENERATION_SELECTION_INVALID` merely because a current guide projection
  differs;
- redundant validation-oriented types and mutation mini-languages are removed;
- duration becomes an ordinary optional provider value with no Studio default;
  the UI uses `Unspecified`, never `Auto`.

This is a focused correction of the current generation/Take slice. It does not
introduce a new workflow engine, a generic state-patching API, a second
validation framework, a reference-defaulting service, or an automatic Take
regeneration pipeline.

## Non-Negotiable Product Rules

1. A Draft Take is freely editable until its first successful materializing
   `shot.video-take` generation.
2. Failed materializing attempts do not freeze the Draft Take; the user or agent
   may correct and retry the same spec.
3. The first successful materializing generation freezes the Take and is the
   only successful materializing run that Take may ever have.
4. Editing/regenerating a Completed Take creates a completely new Draft Take
   with copied authoring inputs and independent copies of its Take-owned First
   Frame, Last Frame, and Video Prompt Image when present. It copies no final
   video, runs, receipts, approvals, provider payloads, diagnostics, generation
   provenance, or persisted Take lineage.
5. A spec's purpose and target never change.
6. Draft typed reference slots are optional. Studio projects Character and
   Location slots from the complete Scene context, always projects one
   Production Lookbook slot, and filters picker choices through explicit
   database relationships, but never fills, defaults, substitutes, or requires
   them.
7. Generic references remain separate. Only an explicit focused domain workflow
   can create a Character/Location/Lookbook asset that becomes eligible for a
   typed slot.
8. Core authoring accepts incomplete provider intent. It does not bind provider
   fields, validate provider compatibility/readiness, or repair/fill values.
9. Duration behaves like every other provider value: absent means
   `Unspecified`; Studio never writes `Auto` or another default.
10. Estimation is pricing-only. Provider payload preview/run is the separate
    execution-validation boundary.
11. No missing value, reference, slot choice, or media relationship is repaired
    with a guessed fallback.
12. The Draft References tab always renders First Frame, Last Frame, and Video
    Prompt Image slots, independent of selected-model capability. Provider
    compatibility is an Engines execution concern, not a slot-visibility rule.
13. A Completed Take renders only the exact references stored in its successful
    run snapshot. It does not render current scene candidates, empty suggestion
    slots, or editable selection controls.
14. Core never rejects authoring because a reference is not a current guide
    candidate, its typed owner cannot be confirmed, or its saved placement is
    absent from today's purpose-guide projection.

## Accepted Product Behavior

### A Take is mutable until success and immutable afterward

`GenerationSpec` represents the request currently being authored for one exact
purpose and target. Purpose and target are immutable from creation; a Character
Sheet never becomes a Location Sheet, a First Frame never becomes a Last Frame,
and a spec never moves from Take A to Take B.

Before the Take has a successful materializing generation, the user or agent
may edit its structure, direction, model, provider values, prompt, typed-slot
choices, and generic references. Incomplete values and empty reference slots
are valid during this authoring phase.

Failed provider attempts do not materialize or freeze the Take. Their
diagnostics may remain associated with the unmaterialized Take while the user
or agent corrects the same spec and retries.

The first successful materializing generation atomically:

1. stores the immutable `GenerationRun.specSnapshot`, provider payload,
   receipt, outputs, and provenance;
2. attaches the successful output to the Take;
3. marks the Take as materialized for authoring purposes;
4. prevents later spec, structure, direction, reference, model, or provider
   value changes on that Take;
5. prevents a second successful generation for that Take.

After success, an Edit or Regenerate action creates Take B. Take B is seeded
with a copy of Take A's current authoring values. When Take A owns a First
Frame, Last Frame, or Video Prompt Image, the command also creates a new Asset,
AssetFile, stored file, and focused ownership row for Take B with the same
starting bytes. The new supporting assets do not share mutable ownership with
Take A and do not inherit generation-run provenance. Take B has a new Take id
and new spec ids, no generation runs, no final video, no receipt, and no
inherited Take lineage. Take A remains unchanged and inspectable. The UI calls
this action **New Take**; it must never present the completed Take as directly
editable.

The Take-freezing rule applies to the successful generation that materializes
the Shot Video Take. Supporting reference assets such as First Frame, Last
Frame, and Video Prompt Image are authoring inputs. If their generation
workflows have their own take/run concepts, those outputs follow the same rule
within their own owning purpose; they must not create multiple successful
`shot.video-take` runs for one Shot Video Take.

The Take's run history means only materializing `shot.video-take` attempts for
that exact Take. Supporting image-generation runs remain provenance/history of
their generated assets; they are not displayed, counted, or copied as Shot
Video Take runs. The Take history may therefore contain failed materializing
attempts followed by exactly one success, and nothing after that success.

An externally attached final video is not a successful generation and must not
be made to look like one through a synthetic run or receipt. Under the accepted
“one Take equals one successful generation” rule, external video may be used as
generic/reference media but does not materialize a Shot Video Take. If imported
completed Takes become a desired product concept later, they require an
explicit separate decision rather than a fallback path in this slice.

### Typed slots are optional database-backed UI structure

For a Draft Shot Video Take, purpose projection declares typed slots from the
complete Scene context, not from the Take's current Shot membership. For
example, if the Scene contains Maria and John, Studio projects one Maria
Character Sheet slot and one John Character Sheet slot even when the Draft Take
currently contains a Shot featuring only Maria. The Draft may later add John's
Shot without changing the shape of the reference workspace. Location Sheet
slots follow the same complete-Scene rule. One Production Lookbook slot is
always present.

Each Draft typed slot has one optional current choice:

- empty when neither the user nor agent selected a sheet;
- filled with the exact Character Sheet selected for that Cast Member;
- replaceable while the Take remains unmaterialized;
- read-only after the Take has a successful materializing generation.

Clicking Maria's slot opens a picker containing only active Character Sheets
explicitly registered to Maria. Clicking John's slot shows John's Character
Sheets. A Location Sheet slot similarly shows sheets explicitly registered to
that Location. The Production Lookbook slot shows Production Lookbook sheets.
This filtering is a UI query and display rule. It is not Core authoring
validation and does not mean the slot is required for generation.

When a Draft slot has exactly one eligible candidate and no current selection,
Studio shows that candidate in the slot with its selection control unchecked.
The candidate is visible but is not selected until the user or agent chooses
it. When more than one candidate exists, clicking the empty or filled slot opens
the subject-filtered picker. Therefore `No Lookbook selected` must never replace
an available sole Lookbook candidate with a blank state.

Studio never chooses among these candidates. Having exactly one candidate does
not select it. Losing the selected asset does not select another candidate. An
empty slot remains empty until a user or agent authors an exact choice.

The AI Production References tab and Generation Preview must project the same
persisted slot selection and use the same picker behavior. There is no parallel
Preview-only or Take-only reference state.

Completed Takes use a different projection: they show only the exact references
from the successful materializing run's immutable `specSnapshot`. They do not
re-run the current Scene/purpose candidate query, show empty scene slots, or
offer pickers and selection controls. If no Character Sheet was actually used,
the completed References view shows no Character Sheet merely because a Cast
Member exists in the current Scene.

### Generic references remain separate

Every purpose also supports ordered generic references. Their picker and
catalog are media-generic: image, audio, and video filtering is supplied by the
calling experience rather than hard-coded into an image-only component.

For example, when a user gives the agent an image of Maria at age 21:

1. the agent registers the exact media as a Shot-owned asset and generic
   reference through focused Core commands;
2. the agent adds it to the spec's generic References section if desired;
3. the agent authors prompt text explaining the intended use, such as “Image 3
   is Maria when she was 21 years old”;
4. Studio does not place it in Maria's Character Sheet slot;
5. if the user later asks for a Character Sheet based on that image, the agent
   invokes the focused Character Sheet workflow;
6. only after the resulting asset is explicitly registered to Maria does it
   appear as a candidate in Maria's Character Sheet slot.

Studio never infers typed ownership or creative meaning from the media,
filename, title, prompt, provenance, or visual contents. A generic reference is
not promoted into a typed slot automatically.

### Provider fields are optional authored payload intent

`GenerationReferenceSelection.providerField` names the exact provider payload
field that receives the reference. Provider semantic roles are descriptive
catalog metadata; they are not an authorization system.

Authoring behavior is:

- preserve an explicitly authored `providerField` exactly;
- allow `providerField` to remain absent during incomplete authoring;
- never auto-bind a reference merely because one compatible field appears to
  exist;
- expose descriptor facts so an agent or user can author an exact field when
  useful;
- do not add a semantic-role fallback matrix;
- do not validate provider-field existence, media compatibility, cardinality,
  or requiredness in Core spec persistence.

For example, an agent may author `image_urls`, `source_image_url`, or
`first_frame_url` for a reference after inspecting the selected model contract.
Core preserves that exact string but does not decide whether it is correct. The
typed slot controls where a choice appears in Studio. The provider field states
the authored API intent. Those are intentionally independent axes.

Provider payload assembly remains fail-fast. If a selected field does not
exist, accepts a different media kind, exceeds cardinality, requires unavailable
metadata, or otherwise violates the schema, Engines returns structured payload
issues before execution.

### Duration is an ordinary provider value

Studio does not initialize duration. Duration follows the same authoring rule
as every other provider value:

- an absent duration remains absent;
- the UI displays `Unspecified`, never `Auto`;
- Studio does not choose the lowest enum, schema minimum, or schema default;
- Studio does not repair, clamp, normalize, or replace an authored value;
- when omission is accepted by the selected provider contract, the provider
  may apply its own default;
- when exact pricing requires a duration that is unavailable, estimation
  returns an ordinary price-unavailable diagnostic;
- when execution requires duration, Engines returns the provider-schema issue.

Delete Take-specific duration normalization/defaulting. Do not replace it with
a general model-initialization helper or another duration special case.

### Current Take media is editable only before materialization

A Take owns at most one current image for each focused role and one current
final video:

- First Frame;
- Last Frame;
- Video Prompt Image;
- final video.

Before the successful materializing Take generation, focused authoring commands
may set or replace supporting First Frame, Last Frame, and Video Prompt Image
relationships. The References tab always renders all three roles as visible
slots, including empty placeholders, without consulting selected-model fields.
The successful final-video attachment is insert-once for that Take and freezes
Take authoring. A completed Take's final video, supporting media, and authoring
spec are never replaced in place.

Creating a new Draft from a Completed Take copies authoring values and clones
each present Take-owned supporting image into a new independently owned
Asset/AssetFile/file relationship for the new Take. Reusable Cast, Location,
Lookbook, Shot-owned generic, and other domain reference assets are not cloned;
only their authored selections are copied. The final video and every generation
run remain exclusively on the Completed Take. Any copied spec selection that
pointed to a source Take-owned supporting image is deterministically rewritten
to the corresponding cloned Asset/AssetFile ids; it must not keep pointing to
the frozen source Take's owned media. The new successful output belongs to the
new Take.

The focused relationship tables express current UI placement and lifecycle
ownership. A generic spec reference expresses usage only. Referencing an asset
from a Take spec never silently transfers ownership of that asset to the Take.

### Image Revision uses the same flexible references

While the owning request remains unmaterialized, Regenerate and Edit authoring
surfaces show exact current references and let the user:

- replace a typed reference with an eligible exact domain asset;
- replace a generic reference with an available project media asset;
- clear any optional reference;
- add another generic reference;
- author or clear an exact provider field without Core deciding compatibility.

Image Revision submits the resulting exact reference collection through Core.
It does not maintain a separate reference-defaulting or provider-validation
model, and it does not render an interactive picker with a no-op callback. If
the revision applies to a completed Take, the action creates a new Take rather
than mutating the completed Take.

### Structural checks remain strict

Core owns and enforces only structural and lifecycle rules required for a safe,
coherent product:

- JSON/envelope shapes can be persisted and rendered without malformed UI
  state;
- purpose and target are known when created and immutable afterward;
- placement and reference envelopes have the minimal shape needed for safe
  persistence and rendering;
- empty typed slots are valid and expected;
- generic references remain separate and are not promoted into typed slots;
- browser projections expose no local path, secret, or provider upload URL;
- an unresolved or later-discarded authored reference is shown as unavailable,
  never replaced with a fallback;
- failed runs do not freeze a Take;
- the first successful materializing run freezes the Take and no second success
  is accepted;
- database ownership, discard, restore, garbage collection, picked-Take, and
  complete production export invariants remain intact.

Core authoring persistence does not validate reference completeness, provider
field existence or compatibility, provider cardinality, MIME/dimensions,
required provider inputs, prompt contents, execution readiness, candidate
membership, Cast/Location/Lookbook ownership, or whether a persisted placement
appears in the current purpose guide. Purpose guides drive Draft UI projection;
they are not a validity schema for saved authoring. Payload preview and run
resolve the current files without substitution and Engines validates the
complete selected-model request. Estimation remains separate and does not
perform that resolution or validation.

## Validation Boundary

| Concern | Owner | Accepted behavior |
| --- | --- | --- |
| Purpose and target identity | Core | Require a known identity on creation and reject every later purpose or target change. |
| Authoring envelope | Core | Accept incomplete JSON state while rejecting only malformed shapes that cannot be safely persisted or rendered. |
| Draft typed slot declaration | Core projection | Derive one optional Character Sheet slot per Scene Cast Member, one Location Sheet slot per Scene Location, and one Production Lookbook slot, independent of current Take Shot membership. |
| Typed slot candidate query | Core projection | List only explicitly registered matching domain assets; never select one automatically or require a choice. |
| Typed slot selection | User/agent intent persisted by Core | Persist `null` or one exact authored reference. The UI offers subject-filtered candidates, but Core does not reject candidate membership or ownership. |
| Draft Take supporting slots | Core projection | Always render First Frame, Last Frame, and Video Prompt Image roles; never hide them based on selected-model fields. |
| Completed Take reference projection | Core generation run | Project only exact successful `specSnapshot` references as read-only; do not recompute candidates from current Scene context or purpose guides. |
| Generic references | User/agent intent | Keep separate from typed slots; never infer typed ownership or promote them automatically. |
| Exact provider field | Authored spec | Preserve the optional exact string; never infer, repair, or validate compatibility in Core. |
| Reference resolution for execution | Core execution preparation | Resolve exact files without substitution for payload preview/run; report unavailable files without changing the spec. |
| Pricing estimate | Engines pricing | Use pricing facts only; do not require reference resolution or an executable payload. |
| Media kind, MIME, dimensions, duration, size, cardinality, required fields | Engines execution | Validate the complete selected-model request during provider payload assembly. |
| Prompt or image creative suitability | User/agent | Studio runtime treats creative content as opaque. |
| Take authoring state | Core | Allow edits before success; freeze the entire Take after its first successful materializing run. |
| New Take from completed Take | Core focused command | Copy authoring values and clone Take-owned supporting images into new exclusive assets; create new Take/spec ids with no runs or final output video. |
| Run history | Core generation run | Permit failed attempts before success and at most one successful materializing run per Take. |
| Production export completeness | Core | Fail preflight when any picked Take lacks its current ready video. |

## Review Finding Disposition

### 1. Downstream Take specs blocked after frame attachment

The reported failure is real because the current guard treats any supporting
Take media relationship as proof that the Shot Video Take itself has
materialized. A generated First Frame can therefore prevent the still-
unmaterialized Take from authoring its Last Frame, Video Prompt, or final video.

Proposed solution: freeze against the first successful materializing
`shot.video-take` run, not the mere presence of a supporting authoring asset.
Before that success, the Take remains editable. After that success, it is fully
immutable and every edit/regeneration creates a new Take with no run history.

### 2. Valid provider bindings rejected by semantic role

The reported `image.edit` / `image_urls` mismatch is one example of the broader
problem. Adding source/reference/first-frame role fallbacks would make the
current rigid classifier larger while still rejecting future valid provider
schemas.

Proposed solution: delete Core semantic binding and every fallback role. Core
preserves an optional exact authored field without deciding compatibility.
Engines validates the complete assembled request only for provider payload
preview and execution. An absent field is valid incomplete authoring state.

### 3. Persisted Take spec identity bypass

Purpose and target are resource identity, not editable creative values. A
generic retarget would allow one spec and its run history to span different
purposes or Takes even though no product UI supports that behavior.

Proposed solution: load the persisted spec on update and reject every purpose
or target change. A Character Sheet never becomes a Location Sheet and a Take A
spec never becomes Take B's spec. The focused **New Take** command copies
allowed authoring values and clones Take-owned supporting images into a newly
identified Draft Take without copying final output or run history.

### 4. Take images omitted from lifecycle ownership

The current trash definition snapshots and mutates final-video rows but not
First Frame, Last Frame, or Video Prompt Image rows. Discarding a Take can
therefore leave its current image relationship active while its parent is in
Trash, and garbage collection can later make restore inconsistent.

Proposed solution: treat explicit Take image and video relationships uniformly
across snapshot, discard, restore, file collection, shared-owner checks, owner
counts, and garbage collection. Do not infer ownership from generic spec
references.

### 5. Production export silently omits picked Takes

Starting export from an inner join means a picked Take without a current video
does not appear in the query result. If another picked Take is complete, export
can succeed with only that Take and produce an incomplete production tree.

Proposed solution: read picked Takes first, resolve exactly one current ready
video for every Take, collect structured preflight issues, and produce no export
rows until the complete set passes.

### 6. Image Revision exposes a no-op reference picker

The cards look editable and open a picker, but the selected value is delivered
to `onReferenceChoose={() => {}}`. The dialog closes without changing the
draft, which is misleading rather than merely read-only.

Proposed solution: use the generic exact-reference draft and shared picker so
replace, clear, additional reference, and exact provider-field changes update
the Image Revision draft. Core persists incomplete authoring; provider payload
preview/run invokes Engines validation without changing the draft.

### 7. Shot Video Take References projects the wrong state

The current Draft view builds Character/Location choices from only the Take's
currently selected Shots, omits the fixed First Frame, Last Frame, and Video
Prompt Image slots when no current selection was projected, and replaces an
available sole Lookbook candidate with `No Lookbook selected`. This makes the
authoring workspace change shape as Shot membership changes and hides valid
choices. The current Completed view repeats that candidate projection, so it
can omit references that were actually used and expose controls that imply the
frozen Take can still change.

Proposed solution: use an explicit Draft/Completed reference projection. Draft
uses complete Scene Cast/Location context, always includes one Production
Lookbook slot and the three fixed Take supporting-media slots, and shows a sole
candidate unchecked without selecting it. Completed reads only the successful
run's immutable `specSnapshot`, resolves those exact references for display,
and exposes no empty suggestion slots, candidate cards, checkboxes, pickers, or
model-dependent slot visibility.

### 8. Core rejects saved references against a transient purpose guide

The current `findGuideSlot` and candidate-membership checks can raise
`CORE_GENERATION_SELECTION_INVALID` when a saved placement such as
`cast/character-sheet` is absent from a newly projected guide. This is not a
provider error and does not prove the authored reference is malformed. It is
the exact candidate-membership validation this plan removes.

Proposed solution: purpose guides and focused database queries determine what
the Draft UI offers; they do not authorize or invalidate persisted authoring.
Delete guide-placement, candidate-membership, and typed-owner rejection from
Core create/update. Preserve structurally readable saved selections, project
unavailable exact references without substitution, and let Engines report only
real selected-model execution failures. Do not merely suppress the toast or
translate this into another warning; remove the invalid rejection at its
source.

## Context

This plan is constrained by:

- `AGENTS.md`, especially architecture ownership, opaque AI artifacts,
  structured diagnostics, Shadcn controls, migrations, naming, no compatibility
  layers, and reviewable code shape;
- ADR 0041, keep AI artifacts and prompts opaque;
- ADR 0047, context-first provider-valid generation, which must be amended to
  restate the independent pricing rail and prohibit Studio-inserted provider
  defaults;
- ADR 0049, which must be superseded because it conflates typed-slot candidate
  integrity with generation eligibility and freezes Takes against the wrong
  evidence;
- new ADR 0050, one successful materializing generation per Take;
- new ADR 0051, incomplete agent-directed generation authoring with optional
  database-backed typed reference slots and separate generic references;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- `docs/architecture/shot-video-take-owned-media.md`, which must be corrected to
  separate exact spec usage from explicit lifecycle ownership;
- `docs/architecture/media-generation.md` and
  `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/front-end-guidelines.md`;
- `docs/architecture/reference/drizzle-migrations.md`;
- `docs/architecture/coding-practices.md`;
- the current Plan 0142 implementation slice and review findings;
- `/Users/keremk/Projects/aitinkerbox/studio-skills`, especially the Media
  Producer reference-authoring contract;
- `/Users/keremk/renku-movies/urban-basilica` for realistic migration,
  lifecycle, authoring, and export verification.

Current implementation evidence motivating the plan includes:

- `requireShotVideoTakeAuthoringMutable` is called from generic spec writes and
  Take lifecycle, design, and generation commands;
- `reference-field-binding.ts` maps slot `providerRole` to provider semantics,
  auto-binds fields, and rejects incomplete authoring that Engines should judge
  only for execution;
- `specs.ts` validates slot selections against the current suggestion list;
- `GenerationPurposeEditingContract` carries the complete reference guide only
  to perform that whitelist validation;
- guide slots persist redundant `cardinality: 'one'`, `providerRole`, and unused
  `scope` structure;
- spec references persist inactive `included` state instead of using presence
  as inclusion;
- Preview infers the current selection by finding it inside candidate cards
  rather than projecting the exact persisted typed-slot choice;
- unfiltered reference catalog reads suppress imported/external assets;
- `normalizeShotVideoTakeParameterValues` can replace authored duration values
  and is Take-specific despite reading generic Engines descriptors;
- Take trash behavior handles `sceneShotVideoTakeVideos` but omits
  `sceneShotVideoTakeImages` in the corresponding discard/restore/ownership
  paths;
- production export starts from an inner join to the Take video table and can
  silently drop a picked Take;
- Image Revision sends picker choices to a no-op callback;
- Take ownership currently guesses that an unowned asset referenced by a
  `shot.video-take` spec is Take-owned, even though a reference is usage rather
  than ownership.

## Architecture Shape Gate

### Package ownership and public entrypoints

`packages/engines` owns provider model descriptors, pricing, provider request
assembly, and final payload validation.

No model-initialization API is added. Studio persists only values explicitly
authored by the user or agent. `assembleGenerationProviderRequest(input)`
remains the final validation and assembly authority for payload preview/run.
The existing pricing API remains independent and consumes only pricing facts.

`packages/core` owns pre-success spec persistence, immutable purpose/target
identity, typed-slot declarations and database candidate projections, generic
reference persistence, Take materialization/freeze rules, current Take-media
relationships, lifecycle ownership, and export preflight.

Public Core entrypoints remain focused:

- `createGenerationSpec` persists incomplete authoring intent after minimal
  structural checks;
- `updateGenerationSpec` preserves purpose/target and rejects completed-Take
  writes while leaving provider readiness to Engines;
- `buildGenerationPreviewResource` and
  `updateGenerationPreviewResource` project and save generic generation edits;
- `createSceneShotVideoTakeFromTake` creates a new Take and new specs from a
  completed Take's authoring values, clones Take-owned supporting images into
  independent new assets/files, and copies no final video, runs, receipts,
  provider payload, diagnostics, approval, or generation provenance;
- `registerSceneShotGenericReferenceAsset` creates the explicit Shot-to-Asset
  relationship used for user/agent-supplied generic reference media; it does
  not create a Cast/Location/Lookbook relationship or add the asset to a typed
  slot;
- Shot Video Take workspace commands update only unmaterialized Takes;
- typed-slot candidate queries use focused domain relationships;
- `listGenerationReferences` exposes a searchable/paginated media-generic
  catalog for generic references without typed promotion;
- `readProductionExportMediaRows` performs complete picked-Take preflight
  before returning export rows.

Studio server handlers and CLI commands remain thin adapters over those Core
entrypoints. React owns temporary form state and renders Core resources. It
does not fill empty slots, choose provider fields, validate media suitability,
or build provider payloads.

### Intended Engines module shape

```text
packages/engines/src/generation/
  setting-fields.ts
  catalog/
    model-input-descriptors.ts
  execution/
    provider-request-assembly.ts
    provider-payload-validation.ts
  index.ts
```

- `provider-request-assembly.ts` remains the final request-wide validation
  boundary, including cardinality and schema constraints.
- `generation/index.ts` contains exports only.
- `model-input-descriptors.ts` may continue to derive descriptive semantics
  from schema field names for presentation. Those semantics must not authorize
  reference bindings.

Do not add a model-initialization helper, second schema parser, provider-role
compatibility matrix, Take-only duration parser, or Core copy of descriptor
constraints.

### Intended Core generation module shape

```text
packages/core/src/server/generation/
  specs.ts
  references.ts
  reference-slots/
    domain-assets.ts
    lookbook-sheets.ts
    take-media.ts
  purposes/
    ...focused purpose descriptors

packages/core/src/server/generation-preview-resource/
  projection.ts
  references.ts
  configuration.ts
  update.ts
```

- `specs.ts` validates persistable JSON, immutable purpose/target identity,
  minimal placement shape, unique ids, and whether the owning Take remains
  open for authoring. It does not validate provider readiness.
- delete `reference-field-binding.ts`; no Core helper binds, guesses, or
  validates provider media fields.
- `reference-slots/*` declares Draft typed UI slots and lists subject-filtered
  domain candidates through focused relationships. A candidate means only “the
  UI may offer this choice here,” never “Core authorizes this reference” or
  “generation requires this choice.” Shot Video Take continuity slots use
  complete Scene Cast/Location context, not current Take Shot membership.
- a focused `setGenerationReferenceSlotSelection` command accepts `null` or one
  exact structurally readable authored reference. AI Production and Preview use
  this same command. It does not revalidate guide membership or typed ownership.
- generic reference commands accept ordered exact references separately and do
  not infer typed placement or ownership.
- `generation-preview-resource/references.ts` projects current exact choices
  separately from subject-filtered typed candidates and generic references. It
  merges persisted and suggested placements by exact placement identity,
  returns `current: null` for an empty Draft slot, and never drops a persisted
  choice merely because the current guide does not offer it.
- `generation-preview-resource/configuration.ts` projects absent values as
  `Unspecified`; it does not initialize or normalize any provider value.
- `generation-preview-resource/update.ts` persists authored prompt/provider
  values without resolving provider readiness. Typed slot changes delegate to
  the focused selection command; generic references remain an ordered authored
  collection.

The existing bounded purpose registry remains a thin list of purpose
descriptors. Purpose files may declare domain-backed typed slots, but they must
not branch by provider, fill a slot, inspect creative contents, or treat an
empty slot as invalid.

### Intended Take workspace and media shape

```text
packages/core/src/server/shot-video-take-workspace/
  generation-parameter-presentation.ts
  generation-session.ts
  generation-commands.ts
  design-commands.ts
  lifecycle-commands.ts
  references.ts

packages/core/src/server/database/access/
  shot-video-take-media.ts
  scene-shot-reference-assets.ts
  production-export.ts

packages/core/src/server/trash/
  trash-object-registry.ts

packages/core/src/server/schema/
  scene-shot-reference-assets.ts

packages/core/src/server/commands/
  scene-shot-reference-asset-commands.ts
```

- rename/split `generation-parameters.ts` to
  `generation-parameter-presentation.ts` and retain only Take UI field filtering
  and ordering there. Delete Take-specific duration defaulting and
  normalization.
- `generation-session.ts` and `generation-commands.ts` preserve absent and
  authored provider values exactly. Duration is projected as `Unspecified` and
  receives no special treatment.
- `design-commands.ts`, `lifecycle-commands.ts`, generation commands, and spec
  persistence call one Core-owned `requireSceneShotVideoTakeAuthoringOpen`
  boundary. That boundary checks successful materialization, not supporting
  image presence.
- `createSceneShotVideoTakeFromTake` copies allowed authoring state into a new
  Take/spec, uses the existing project-asset persistence boundary to clone each
  present Take-owned supporting image into a new Asset, AssetFile, durable file,
  and focused ownership row, and deliberately copies no final video, runs,
  receipt, provider payload, diagnostics, approval, or generation provenance.
- `scene-shot-reference-assets.ts` owns the focused
  `scene_shot_reference_asset` relationship and its lifecycle queries. The
  public registration command requires exact Shot identity and an existing
  asset/file, but does not inspect creative contents or create typed domain
  ownership.
- `shot-video-take-media.ts` owns focused pre-success set/replace operations for
  supporting image roles and an insert-once successful final-video attachment.
- durable finalization of a successful provider result stores the successful
  run and final-video attachment in one transaction so a Take cannot expose a
  successful run without its materialized output.
- Take image and video rows use the same discard/restore operation metadata and
  ownership checks.
- `trash-object-registry.ts` may remain the bounded trash registry, but Take
  behavior must delegate cohesive media collection/shared-ownership queries to
  focused access functions if adding images would make the existing Take block
  broader. Do not solve this finding by copying every video query and changing
  the table name inline.
- `production-export.ts` first reads the complete ordered set of picked Takes,
  then resolves one current ready video for each, then reads dialogue rows.

### Intended client and UI contract shape

Take workspace resources expose a Core-derived authoring state:

```ts
type SceneShotVideoTakeAuthoringState =
  | { kind: 'draft'; failedAttemptCount: number }
  | { kind: 'completed'; successfulRunId: string };
```

The UI displays **Draft Take** while authoring remains open and **Completed
Take** after successful materialization. Failed attempts remain Draft. Completed
resources expose no editable controls and provide only the focused create-new-
Take action. This state is projected from the constrained successful run and
final-video relationship; do not add a second mutable/frozen boolean column.
The Take history resource filters to materializing `shot.video-take` attempts;
supporting asset-generation histories remain with their assets.

The Shot Video Take References resource is state-specific rather than one
candidate-shaped response reused for both lifecycles:

```ts
type SceneShotVideoTakeReferenceWorkspace =
  | {
      kind: 'draft';
      general: {
        supportingMediaSlots: ShotVideoTakeSupportingReferenceSlot[];
        genericReferences: GenerationPreviewResourceReference[];
      };
      lookbook: GenerationPreviewReferenceSlot;
      castMembers: GenerationPreviewReferenceSlot[];
      locations: GenerationPreviewReferenceSlot[];
    }
  | {
      kind: 'completed';
      successfulRunId: string;
      usedReferences: ShotVideoTakeCompletedReference[];
    };

interface ShotVideoTakeSupportingReferenceSlot {
  role: 'first-frame' | 'last-frame' | 'video-prompt';
  currentOwnedMedia: GenerationPreviewResourceReference | null;
  selected: boolean;
}
```

The Draft `supportingMediaSlots` array always contains exactly the three roles
in product order. `currentOwnedMedia: null` renders an empty placeholder. A
filled supporting slot remains visible whether selected or not. The sole
Lookbook candidate is rendered unchecked when `lookbook.current` is `null`;
the UI does not replace it with `No Lookbook selected` and does not select it.

Draft `castMembers` and `locations` are based on complete Scene context. The
current Shot selection may change without adding or removing those slots.
Completed `usedReferences` is resolved solely from the successful immutable
`specSnapshot`; it contains no candidates and no empty placeholders.

Draft slot projection merges by exact placement: begin with structurally
readable persisted slot selections, then add the current Scene/purpose
suggested slots and candidate lists. A purpose guide may add empty suggestions
or candidate facts, but it cannot erase an authored current selection. A
persisted-only slot projects its exact current reference with no invented
candidate; if its asset is unavailable, the UI shows that exact unavailable
state without substitution. This is one generic merge rule, not a placement-
specific fallback.

In the Completed Take header/tab rail, the Continuous Move/Multi-Cut control and
every Shot membership, reference, model, prompt, and parameter editing control
are absent—not disabled. The control area instead exposes one **New Take**
action. The completed Shots remain visible as a static record, and the
References tab groups exact used references for inspection without checkboxes
or picker affordances.

The exact spec reference remains the durable contract:

```ts
interface GenerationReferenceSelection {
  id: string;
  placement:
    | {
        kind: 'slot';
        sectionId: string;
        slotId: string;
        subject?: { kind: string; id: string };
      }
    | { kind: 'additional' };
  providerField?: string;
  reference: GenerationReference;
}
```

Remove `included`; presence in `GenerationSpec.references` means the reference
is included. Remove placement/section `scope` because no current purpose uses a
second scope identity; `sectionId`, `slotId`, and optional `subject` fully place
current slots. If future product behavior genuinely needs another identity
axis, it must be designed then rather than carried speculatively now.

Guide slots are optional typed UI structure:

```ts
interface GenerationReferenceGuideSlot {
  id: string;
  label: string;
  subject?: { kind: string; id: string };
  guidance?: string;
  eligibleCandidates: GenerationReferenceCatalogItem[];
}
```

Remove guide `cardinality` because every guide slot is, by contract, one
optional current UI choice. Empty is always valid. Engines retains provider
field cardinality. Remove `providerRole` because typed slot meaning does not
bind or validate a provider field.

Delete `GenerationPurposeEditingContract`. Generic spec create/update receives
the existing small `GenerationPurposeContract`. Purpose descriptors build Draft
slot suggestions for projection only; ordinary persistence and the focused
slot-selection command do not call a guide-membership validator. Do not add
another public contract merely to pass a reference guide through callers.

Preview projects current state from the persisted spec:

```ts
interface GenerationPreviewReferenceSlot {
  label: string;
  placement: Extract<
    GenerationReferenceSelection['placement'],
    { kind: 'slot' }
  >;
  current: GenerationPreviewResourceReference | null;
  eligibleCandidates: GenerationPreviewResourceReference[];
}
```

Remove the generic multi-operation `GenerationPreviewReferenceChange` mutation
language and `generation/spec-reference-edits.ts`. Replace them with the single
focused intent `setGenerationReferenceSlotSelection({ specId, placement,
reference })`, where `reference` may be `null`. The command validates only the
minimal reference/placement shape required for persistence and that the Take
remains open. It does not validate current guide membership, candidate
membership, typed ownership, or provider compatibility.

`ImageRevisionDraft.referenceSelections` is replaced by the same typed-slot and
generic-reference contracts used by the generic generation editor. Image
Revision may keep revision mode and source-image presentation, but it may not
define parallel defaults, provider validation, or fallback behavior.

`ShotVideoTakeInputModeId` may remain only if it is a derived presentation
grouping that selects which controls/cards the Take UI shows. It must not be
persisted into generation specs or used for payload validation, binding, or
reference eligibility. Remove any other types introduced solely to encode
semantic-role or candidate-whitelist validation.

The shared picker stays in
`packages/studio/src/features/reference-picker/` and uses local Shadcn
primitives. It receives:

- slot kind: typed or generic;
- current exact reference or `null`;
- eligible candidates for a typed slot;
- media-generic paginated/searchable project results for a generic slot;
- callbacks that update draft intent.

It does not import Take, Preview, or Image Revision business commands. Those
features map their resources into the shared component directly.

### Ownership and lifecycle shape

Explicit focused relationships confer Take ownership:

- `scene_shot_video_take_image` for current First Frame, Last Frame, and Video
  Prompt Image;
- `scene_shot_video_take_video` for current final video.

`scene_shot_reference_asset` confers Shot ownership for explicitly registered
generic reference media. It is intentionally not a typed Character, Location,
or Lookbook relationship.

`media_generation_spec.references_json` records usage only. An asset with no
Cast, Location, Lookbook, Scene, Sequence, Project, Shot reference, Take image,
or Take video relationship is not implicitly owned merely because a Take spec
references it. It follows normal unowned project-asset policy.

Discarding a Take snapshots, discards, restores, collects, and counts its
explicitly owned current image and video rows. Shared-owner checks cover both
tables before asset/file state changes. Garbage collection counts both focused
relationships as active owners. Pre-success supporting-image replacement
updates lifecycle ownership atomically. Completed Take media is never replaced.
Shot reference relationships participate in the same ownership counts and are
discarded/restored with their owning Shot/Shot List according to the focused
lifecycle contract.

### Bounded dispatch and registries

- Keep the existing bounded purpose registry; no new provider/purpose
  switchboard is needed.
- Take attachment may keep a small output-purpose-to-current-role map for the
  three supporting image purposes plus final video. The map selects a focused
  relationship destination; it does not bind provider fields or classify
  creative suitability.
- Trash stays in the existing object-definition registry, with focused access
  functions preventing duplicated image/video ownership logic.
- Export uses focused picked-Take and dialogue projectors, not a generic asset
  role dispatcher.

### Explicitly forbidden shape

- No edits to a Take after its first successful materializing generation.
- No second successful materializing run for one Take.
- No copied final video, run, receipt, provider payload, diagnostic, approval,
  or generation provenance when creating a new Take from a completed Take.
- No shared Take-owned First/Last/Video Prompt asset/file ownership between the
  Completed source and the new Draft; those supporting inputs are copied into
  independent assets/files.
- No external final-video attachment masquerading as a successful Take and no
  synthetic generation run/receipt for imported media.
- No purpose or target retargeting on spec update.
- No requirement that any typed reference slot be filled.
- No automatic typed-slot selection when one or more candidates exist.
- No fallback typed-slot selection when a choice is unavailable.
- No automatic promotion of a generic reference into a Character Sheet,
  Location Sheet, Lookbook Sheet, or other typed slot.
- No all-project candidate list inside a typed domain slot; typed pickers use
  explicit focused relationships only.
- No semantic provider-role fallback/compatibility matrix.
- No automatic provider-field binding, including the “exactly one compatible
  field” case.
- No UI/server/CLI copy of Engines schema validation.
- No silent normalization, clamping, repair, or replacement of authored
  provider values.
- No Studio default for duration or any other provider value.
- No `Auto` duration option; absent duration is displayed as `Unspecified`.
- No provider request validation or file resolution on the pricing estimate
  rail.
- No hidden external/imported images in the general project reference picker.
- No image-only contract for the generic reference picker.
- No inferred Take ownership from generic spec references.
- No inactive references persisted with `included: false`.
- No no-op interactive reference controls.
- No broad arbitrary database patch API.
- No compatibility alias for removed guide/reference fields or obsolete
  mutability behavior.
- No semantic inspection of prompts or media contents.

### Stop conditions

Stop and revise the slice before implementation continues if:

- Core starts reproducing JSON Schema checks already available from Engines;
- a new reference type exists only to classify creative suitability;
- an empty Character Sheet, Location Sheet, Lookbook, or other typed slot is
  treated as invalid or not ready;
- Studio or Core chooses a reference for an empty typed slot;
- a generic reference appears in a typed slot without an explicit focused
  domain relationship;
- a typed slot picker shows assets that do not belong to its exact subject;
- a purpose or provider requires a new branch in Preview, Image Revision, the
  picker, or spec persistence;
- any model initialization/defaulting helper is introduced;
- estimate resolves project files or assembles an executable provider payload;
- a completed Take can be edited, rerun, or have its current media replaced;
- a new Take inherits run history, media, receipts, or provenance;
- a failed run freezes an otherwise unmaterialized Take;
- Take discard/restore logic treats generic usage as lifecycle ownership;
- lifecycle support is implemented by doubling a large block of image/video
  table-specific queries in `trash-object-registry.ts`;
- `generation-preview-resource/update.ts`,
  `shot-video-take-workspace/generation-commands.ts`, or a React container grows
  into a mixed validation/persistence/rendering dispatcher;
- a route or React component decides provider validity;
- passing tests requires retaining obsolete fields, aliases, fallbacks, or
  migration-at-read code.

## Contracts

### Pricing and execution contracts remain separate

No new Engines initialization contract is added.

`estimateGeneration` consumes only provider/model identity, output media kind,
explicitly authored pricing values, provider schema pricing defaults where the
provider contract already supplies them, and intended media counts. It does not
resolve files, require filled typed slots, bind provider fields, assemble a
payload, or decide execution readiness.

`assembleGenerationProviderRequest` remains the only complete selected-model
payload validator. Payload preview and run call it after resolving exact
references without substitution. Run repeats validation immediately before the
provider boundary.

### Core spec persistence contract

`createGenerationSpec` receives `GenerationPurposeContract`.
`updateGenerationSpec` loads the current record and requires the same purpose
and exact target. The focused typed-slot command resolves the persisted purpose
descriptor internally.

Generic create/update and focused slot-selection paths preserve authored
references without treating the current purpose guide as a validity schema. A
subject-filtered picker may offer only registered domain candidates, but Core
does not repeat candidate-membership, Character/Location/Lookbook ownership, or
guide-placement validation when persisting the exact selection. A later guide
change therefore cannot make an otherwise structurally readable Draft
unsavable or prevent a Completed Take snapshot from being inspected.

They validate:

- purpose and target kind match the supplied contract on creation;
- purpose and exact target equal the persisted identity on update;
- JSON values are persistable;
- reference ids are non-empty and unique;
- project-file paths are already normalized;
- slot placement identity is structurally complete;
- a current UI slot appears at most once;
- an authored provider field is either omitted or a non-empty string;
- the owning Take has no successful materializing generation.

They do not validate:

- whether any typed slot is filled;
- whether a slot placement exists in the current purpose guide;
- whether an exact reference is a current candidate for that slot;
- Character/Location/Lookbook candidate ownership or membership;
- generic-reference ownership against a typed slot;
- semantic provider role or provider field compatibility;
- provider field existence, cardinality, requiredness, or provider schema
  validity;
- current file availability during ordinary authoring save;
- creative prompt or media contents.

Provider-invalid, reference-incomplete, and pricing-incomplete drafts may be
saved. Preview projects missing/unavailable references without replacement.
Only provider payload preview/run resolves exact files and calls Engines
request assembly.

### No Core reference-field binding contract

Delete `bindGenerationReferenceFields` and its semantic-role diagnostics.
`providerField` is optional authored data. Core preserves it exactly and never
fills, repairs, or validates it. An agent may inspect Engines model descriptors
and author a field deliberately. If the selected model requires a binding that
is absent or invalid, Engines returns the actual payload issue during provider
preview/run. Estimation does not depend on that readiness result.

### Take current-media contract

Focused access commands distinguish supporting authoring media from the
insert-once successful Take output:

```ts
setSceneShotVideoTakeImage(input: {
  takeId: string;
  role: 'first-frame' | 'last-frame' | 'video-prompt';
  assetId: string;
  assetFileId: string;
  now: string;
}): void

attachSuccessfulSceneShotVideoTakeVideo(input: {
  takeId: string;
  generationRunId: string;
  assetId: string;
  assetFileId: string;
  now: string;
}): void
```

`setSceneShotVideoTakeImage` may replace a supporting authoring pointer only
while the Take remains unmaterialized.
`attachSuccessfulSceneShotVideoTakeVideo` fails if the Take already has a
successful materializing run or final video. It finalizes the successful run
and attachment in the same durable transaction. There are no compatibility
wrappers retaining insert-only/replacement names with different semantics.

### Create-new-Take contract

Add the focused command:

```ts
createSceneShotVideoTakeFromTake(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  sourceTakeId: string;
  idGenerator: ProjectIdGenerator;
  now: string;
}): SceneShotVideoTakeWorkspace
```

The source must be completed. The command copies only current authoring inputs:
Shot membership/structure, direction, model identity, explicitly authored
provider values, prompt text, typed-slot selections, and generic references. It
also clones each present Take-owned First Frame, Last Frame, and Video Prompt
Image into new independently identified Assets, AssetFiles, durable files, and
focused ownership rows for the new Take. The existing project-asset write-set
and cleanup boundary must make the database/file operation fail as one focused
command; no partially copied Take or orphan file may remain after failure.

It creates new Take/spec identities and copies no final video, generation runs,
approval token, receipt, provider payload, diagnostics, generation provenance,
or Take lineage. Reusable Cast, Location, Lookbook, Shot-owned generic, and
other domain assets are not duplicated; only their spec selections are copied.
Selections for cloned First/Last/Video Prompt media are rewritten to the exact
new Asset/AssetFile ids in the same command.
The command does not persist a compatibility alias, shared mutable spec, or
shared Take-owned supporting-media relationship between the Takes.

### Shot generic-reference ownership contract

Add the focused `scene_shot_reference_asset` table with deliberate Shot
identity and lifecycle columns:

```ts
interface SceneShotReferenceAssetRecord {
  id: string;
  sceneId: string;
  shotListId: string;
  shotId: string;
  assetId: string;
  assetFileId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
```

`registerSceneShotGenericReferenceAsset` creates this relationship through
Core. The relation makes the asset a reusable Shot-owned generic reference and
participates in discard/restore/garbage-collection ownership. It does not add
the asset to a `GenerationSpec` automatically, does not create a typed slot
selection, and does not make the asset a Character/Location/Lookbook asset.
Those later actions require separate explicit user/agent commands.

### Preview/reference resource contract

Preview and Take resources distinguish:

- Draft typed slots: exact current choice or `null`, plus subject-filtered UI
  candidates;
- Draft Take supporting-media slots: all three fixed roles, including empty
  placeholders, independent of selected-model fields;
- Completed Take references: exact successful `specSnapshot` selections only,
  with no candidate query or editable controls;
- generic references: ordered exact authored choices;
- generic project catalog search: arbitrary image/audio/video results filtered
  only by the calling UI's requested media kind;
- provider descriptor fields: factual model metadata, never a default or Core
  compatibility decision.

No browser resource exposes a local filesystem path or provider upload URL.
The server may add browser-safe URLs to Core-projected exact asset ids. It must
not drop an exact saved/snapshot reference because a current guide slot or
candidate query no longer contains it.

### Export preflight contract

`readProductionExportMediaRows` must read picked Takes first. For every picked
Take it requires its one schema-constrained active final-video relationship
whose Asset and AssetFile are also active, ready, and of video media kind. It
collects every missing/unready picked-Take issue before failing through
`@gorenku/studio-diagnostics` with locations identifying the Take.

Use stable codes:

- `CORE_PRODUCTION_EXPORT_TAKE_VIDEO_MISSING` when a picked Take has no current
  ready video.

Do not add an ambiguous-video runtime branch: the schema already makes one
final-video relationship per Take unique. Migration/database integrity checks
own uniqueness corruption.

Only after preflight succeeds may Core project video and included dialogue
audio export rows. A picked Take is never silently filtered by a join.

## Migration Policy

The schema remains the source of truth. Before implementation changes any
Drizzle schema or migration, re-read current Drizzle Kit documentation and
`docs/architecture/reference/drizzle-migrations.md`.

Plan 0142's migration 0057 is part of the current unshipped development slice.
Regenerate the affected migration from the final TypeScript schema through
Drizzle Kit rather than hand-editing generated SQL. Keep a documented custom
one-way data transformation only where preserving current development project
data cannot be expressed by the schema diff. Do not add runtime recognition,
repair, warnings, or compatibility branches for an intermediate spec shape.

The intended final persistence model keeps:

- one current spec per `(Take, purpose)` for the four Take generation purposes;
- `scene_shot_reference_asset` rows for explicitly registered Shot-owned generic
  reference media;
- one current Take image relationship per `(Take, role)`;
- one current Take final-video relationship;
- any number of failed/simulated attempts before materialization;
- at most one completed materializing `shot.video-take` run per Take, protected
  by the Core finalization command and the generated partial unique index
  `media_generation_run_take_success_idx` over purpose/target for completed
  `shot.video-take` runs;
- immutable successful run snapshots and provenance history.

It does not add a second mutable/frozen flag when successful materialization can
be derived from the constrained successful run/final-video relationship. It
does not persist provider role fallbacks, automatic reference choices, or
inactive reference alternatives.

Remove `scene_shot_video_take.regenerated_from_take_id`. Creating a new Take
uses a source Take only as command input; the new Take does not retain a lineage
link or inherited history. Update all callers directly and add no replacement
alias/metadata field.

Because migration 0057 has already been exercised against the real development
project, implementation must create a fresh verified backup before applying
the final migration state to `urban-basilica`. Never reset or delete the real
database without explicit user approval. Verify exact row counts, foreign keys,
and `quick_check` after migration.

## Implementation Slices

### Slice 1: accept the corrected architecture

Expected files:

- `docs/decisions/0050-use-one-successful-generation-per-take.md`;
- `docs/decisions/0051-keep-generation-authoring-incomplete-and-reference-slots-agent-directed.md`;
- `docs/decisions/0047-use-context-first-provider-valid-generation.md`;
- `docs/decisions/0049-use-request-scoped-generation-reference-choices.md`;
- `docs/architecture/shot-video-take-owned-media.md`;
- `docs/architecture/generation-preview-purpose-bindings.md`;
- current generation spec/reference architecture docs.

Work:

- write ADR 0050 before code changes: a Take remains editable through failed
  attempts, freezes on its first successful materializing run, allows at most
  one success, and can only be regenerated as a new Take with empty history;
- write ADR 0051 before code changes: typed slots are optional database-backed
  UI structure, Draft Shot Video Take slots use complete Scene context,
  Completed Takes show only successful-snapshot references, generic references
  are separate, agents own suggestions, empty Draft slots are expected, and
  Studio adds no reference/provider defaults or fallbacks;
- amend ADR 0047 so estimation remains pricing-only and no Studio provider
  default is inserted;
- supersede ADR 0049's conflicting Take-freeze and reference-eligibility text;
- record immutable purpose/target identity and minimal authoring validation;
- record that purpose guides filter Draft UI candidates but never validate
  persisted placement, candidate membership, or typed ownership;
- record explicit focused relationship ownership versus generic reference
  usage, including independent supporting-media copies for **New Take**;
- inventory the current 0057 migration/database state and take a verified
  pre-change backup.

Architecture boundary: accepted docs must match the intended code before
implementation begins.

### Slice 2: remove defaults and preserve the pricing-only rail

Expected files:

- `packages/core/src/server/shot-video-take-workspace/generation-parameters.ts`;
- `packages/core/src/server/generation/estimates.ts`;
- Generation Preview configuration projection;
- focused Core/Engines pricing and execution tests.

Work:

- remove duration default/normalization from the Take workspace;
- render absent duration as `Unspecified` and remove `Auto` from Studio-authored
  options without converting absence into a value;
- add no replacement initialization helper in Engines, Core, or React;
- keep provider schema defaults omitted from authored values;
- keep estimation dependent only on available pricing facts and intended media
  counts;
- return ordinary price-unavailable diagnostics when exact pricing inputs are
  absent;
- prove estimate never resolves references or calls provider request assembly.

Architecture boundary: providers own provider defaults; Engines owns pricing
and execution validation on separate rails; Studio only renders absence.

### Slice 3: simplify spec and guide contracts

Expected files:

- `packages/core/src/client/generation.ts`;
- `packages/core/src/server/generation/purpose-contract.ts`;
- `packages/core/src/server/generation/purpose-guide.ts`;
- `packages/core/src/server/generation/specs.ts`;
- `packages/core/src/server/generation/reference-slots/*`;
- focused purpose declarations and tests.

Work:

- remove `providerRole`, guide cardinality, unused scope, and `included`;
- delete `GenerationPurposeEditingContract`; focused typed-slot commands resolve
- keep one optional current selection per typed UI slot;
- delete `findGuideSlot`, reference/candidate equality membership checks, and
  every Core rejection based on current guide placement or typed ownership;
- keep subject-filtered candidate queries as Draft UI projection only;
- keep empty typed slots valid;
- store generic references separately from typed-slot choices;
- do not validate generic references against typed candidates or ownership;
- remove creative readiness/notices that describe Character Sheets, Location
  Sheets, Lookbooks, or other optional references as runtime requirements;
- keep only inventory facts in Director/Core resources and leave creative
  recommendations to skills/agents.

Architecture boundary: Core owns trustworthy typed UI placement and exact
focused relationships, not artistic suitability, slot completion, provider
readiness, or automatic suggestions.

### Slice 4: delete Core provider-field binding

Expected files:

- deletion of `packages/core/src/server/generation/reference-field-binding.ts`;
- `packages/core/src/server/generation/validation.ts`;
- Engines provider request assembly tests;
- Core Preview, Take, CLI, and service wiring callers.

Work:

- preserve an authored field string exactly;
- leave absent fields absent even when one compatible descriptor field exists;
- remove semantic role fallback/rejection behavior and its Core diagnostics;
- make save/update accept provider-incomplete drafts;
- keep request-wide Engines validation before provider payload preview/run;
- prove estimation remains available independently when pricing facts suffice.

Architecture boundary: the spec states payload intent; Engines decides whether
the selected model accepts that payload.

### Slice 5: make all reference editors flexible

Expected files:

- `packages/core/src/server/generation/references.ts`;
- `packages/core/src/client/generation-preview-resource.ts`;
- `packages/core/src/server/generation-preview-resource/references.ts`;
- `packages/core/src/server/generation-preview-resource/update.ts`;
- removal of `packages/core/src/server/generation/spec-reference-edits.ts`;
- `packages/core/src/server/shot-video-take-workspace/references.ts`;
- `packages/core/src/server/image-revision-workflow/draft.ts`;
- `packages/studio/src/features/reference-picker/*`;
- `packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx`;
- `packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx`;
- Preview, Take, and Image Revision feature callers.

Work:

- project one Draft Character Sheet slot per complete Scene Cast Member, one
  Draft Location Sheet slot per complete Scene Location, and one always-present
  Production Lookbook slot, independent of current Take Shot membership;
- project each typed slot as `current: null` or one exact persisted selection;
- open typed pickers with only eligible domain assets for their exact subject;
- show a sole typed candidate unchecked when the slot has no current selection;
  never replace that available candidate with `No Lookbook selected`;
- always project Draft First Frame, Last Frame, and Video Prompt Image slots,
  including empty placeholders and regardless of selected-model inputs;
- project Completed Take References solely from the successful immutable
  `specSnapshot`; resolve and show exact used references without candidates,
  empty suggestion slots, toggles, or picker controls;
- include external/imported assets in the separate generic media catalog;
- make generic browsing searchable/paginated and media-generic across image,
  audio, and video;
- replace Preview's generic change mini-language with the focused nullable
  typed-slot selection command plus ordered generic-reference authoring;
- make Take, Preview, and Image Revision use the same picker contract;
- replace the Image Revision no-op callback with draft updates;
- allow clearing every optional typed slot and adding/removing generic
  references without Core provider-cardinality checks;
- remove UI checks for non-empty edit instructions or provider controls when
  those checks duplicate Engines schema validation; render structured
  diagnostics instead;
- remove completed-Take reference controls rather than rendering a disabled
  form, and label the sole edit/setup action **New Take**;
- remove raw `CORE_GENERATION_SELECTION_INVALID` guide-placement failures by
  deleting the Core rejection, not by swallowing or downgrading the error in
  React;
- keep shadcn controls and intentional domain copy only.

Architecture boundary: Core projects safe resources and persists intent;
React edits drafts; Engines validates the resulting request.

### Slice 6: enforce successful materialization and create-new-Take editing

Expected files:

- replace the current broad mutability guard with the successful-
  materialization authoring boundary;
- `packages/core/src/server/generation/specs.ts`;
- `packages/core/src/server/shot-video-take-workspace/design-commands.ts`;
- `packages/core/src/server/shot-video-take-workspace/lifecycle-commands.ts`;
- `packages/core/src/server/shot-video-take-workspace/generation-commands.ts`;
- attachment and Take query modules;
- focused tests.

Work:

- keep one current spec per Take/purpose while unmaterialized;
- reject every purpose or target change;
- allow failed provider attempts to retain diagnostics and return to authoring;
- finalize the first successful `shot.video-take` run and final-video
  attachment atomically;
- reject every subsequent spec/design/reference/model update and run on that
  completed Take;
- add `createSceneShotVideoTakeFromTake`, copy authoring values, and clone each
  present Take-owned First/Last/Video Prompt image into a new Asset, AssetFile,
  durable file, and focused ownership row for the new Draft Take;
- rewrite copied spec references from each source supporting image to its exact
  cloned Asset/AssetFile ids;
- ensure the new Take has new Take/spec/supporting-media ids, no runs, no final
  video, no receipt, and no inherited generation provenance;
- keep reusable typed and Shot-owned generic assets shared as references while
  copying only their selection records;
- hide all Completed Take mutation controls, including Shot selection and the
  Continuous Move/Multi-Cut structure toggle, and replace that control area
  with **New Take**;
- make supporting First/Last/Video Prompt media replaceable only before final
  Take materialization;
- prove the original completed Take and successful snapshot never change.

Architecture boundary: Take workspace commands own authoring intent; focused
media access owns current relationships; generation runs own history.

### Slice 7: complete Take image lifecycle ownership

Expected files:

- `packages/core/src/server/database/access/shot-video-take-media.ts`;
- `packages/core/src/server/schema/scene-shot-reference-assets.ts`;
- `packages/core/src/server/database/access/scene-shot-reference-assets.ts`;
- `packages/core/src/server/commands/scene-shot-reference-asset-commands.ts`;
- focused trash ownership access modules if needed;
- `packages/core/src/server/trash/trash-object-registry.ts`;
- `packages/core/src/server/commands/discard-asset.ts`;
- garbage-collection ownership/count queries and tests.

Work:

- include Take images in snapshot, discard, restore, file collection, active
  owner counts, shared-media checks, and garbage collection;
- remove ownership inference from generic `shot.video-take` spec references;
- add focused Shot ownership, discard/restore, shared-owner, and garbage-
  collection behavior for `scene_shot_reference_asset`;
- treat image and video focused rows uniformly without duplicating registry
  blocks;
- verify pre-success supporting-pointer replacement transfers lifecycle
  ownership without changing run history;
- verify **New Take** supporting-media file copies use the existing project
  asset write-set/cleanup boundary and cannot leave a partial Take, Asset,
  AssetFile, ownership row, or orphan file;
- collect all shared-owner conflicts before durable changes;
- execute every lifecycle mutation in one transaction so failure leaves no
  durable changes.

Architecture boundary: explicit relationship tables own lifecycle. Specs only
record usage.

### Slice 8: make production export complete or fail

Expected files:

- `packages/core/src/server/database/access/production-export.ts`;
- production export command/service tests;
- CLI/server structured diagnostic translation only if existing generic
  translation is incomplete.

Work:

- read the full picked-Take set before joining media;
- resolve the schema-constrained current ready video per picked Take;
- collect and report every missing/unready Take video;
- proceed to dialogue resolution and export rows only after preflight succeeds;
- retain existing focused dialogue reference validation;
- prove no picked Take can disappear silently from the export tree.
- rely on the database uniqueness constraint instead of adding an impossible
  ambiguous-video runtime branch.

Architecture boundary: Core owns complete export projection; adapters do not
patch missing rows or infer fallbacks.

### Slice 9: migrations, skills, and real workflow verification

Expected areas:

- final Drizzle schema/migration artifacts, if the simplified persistence shape
  changes them;
- current architecture docs and ADRs;
- `/Users/keremk/Projects/aitinkerbox/studio-skills` generation/reference
  instructions;
- `/Users/keremk/renku-movies/urban-basilica` only through supported commands
  and explicit user-approved destructive operations.

Work:

- generate, never hand-author, ordinary schema migration SQL;
- add the TypeScript schema declaration for
  `media_generation_run_take_success_idx` before generating its migration;
- add the TypeScript schema and generated migration for
  `scene_shot_reference_asset`;
- remove `scene_shot_video_take.regenerated_from_take_id` and update callers
  directly without a lineage replacement field;
- validate/migrate a database copy before the real project;
- update Media Producer and related skills so the agent reads factual Take
  context, recommends exact typed-slot choices deliberately, and leaves slots
  empty when no recommendation has been authored;
- document the explicit workflow for registering a user-provided Shot-owned
  generic reference and separately creating a Cast Member Character Sheet when
  the user asks for that promotion;
- remove skill language that expects Studio defaults, fallbacks, semantic
  provider-role binding, or filled reference slots;
- exercise pre-success editing, failed-run correction, successful freeze,
  create-new-Take behavior, typed slot pickers, generic media references,
  Image Revision, unspecified duration, discard/restore, and incomplete export
  on realistic project data.

Architecture boundary: skills own creative recommendations; Studio runtime owns
the authoring envelope and typed UI integrity; Engines owns executable provider
validity.

## Required Product Use Cases

### Use case A: Scene Cast remains visible while Draft Shot membership changes

Given a Scene containing Maria and John and a Draft Shot Video Take currently
containing only a Shot featuring Maria:

1. AI Production and Generation Preview each show one Maria Character Sheet
   slot and one John Character Sheet slot from the same persisted spec;
2. either slot may be empty without a warning or readiness error;
3. an agent may deliberately select Maria Sheet A while leaving John empty;
4. clicking Maria opens a picker containing only Character Sheets explicitly
   registered to Maria;
5. clicking John opens a picker containing only Character Sheets explicitly
   registered to John;
6. adding or removing Shots from the Draft Take does not change this Scene-level
   Character Sheet slot set;
7. Studio never selects the first/only sheet and never replaces an unavailable
   selection.

### Use case B: user-provided generic image

Given a user-provided image of Maria at age 21:

1. the agent registers it as a Shot-owned generic media asset;
2. the agent may add it to Generic References and explain its intended meaning
   in the prompt;
3. it does not appear in Maria's Character Sheet slot or picker;
4. Studio performs no visual/title/prompt inference and creates no typed
   relationship;
5. generation may remain text-only or use the generic image according to the
   agent/user's authored request.

### Use case C: explicit promotion through a focused domain workflow

If the user asks the agent to create a Character Sheet for Maria from the age-21
image:

1. the agent invokes the Character Sheet generation/import workflow;
2. the resulting asset is explicitly registered as Maria's Character Sheet;
3. that new sheet becomes an eligible candidate in Maria's typed picker;
4. Studio still does not select it until the user or agent authors that choice.

### Use case D: incomplete text-only authoring

A new Take may have no selected Character, Location, Lookbook, or Generic
References. Its prompt and provider values may also be incomplete. The Draft
still renders all Scene-level typed slots and the three fixed supporting-media
slots as empty authoring UI. It saves and reopens. Estimate succeeds only when
pricing facts suffice. Provider payload preview/run returns Engines diagnostics
for genuine selected-model requirements. No layer fills missing references or
values.

### Use case E: failed attempts followed by one success

1. the agent runs an unmaterialized Take;
2. the provider returns a structured failure;
3. the same Take remains editable and retains the failed-attempt diagnostics;
4. the agent corrects the prompt, provider values, or references and retries;
5. the first successful materializing run stores the output and freezes the
   Take;
6. no second successful run or in-place edit is possible.

### Use case F: editing a completed Take

1. the user opens completed Take A;
2. the Shot list and successful final video remain visible as a static record;
3. Shot selection controls, reference controls, and the Continuous
   Move/Multi-Cut toggle are absent, and the UI offers **New Take**;
4. the focused command creates Draft Take B with copied authoring inputs;
5. each First Frame, Last Frame, or Video Prompt Image owned by Take A is copied
   into a new independently owned asset/file relationship for Take B;
6. reusable typed and generic reference selections are copied without cloning
   those domain-owned assets;
7. Take B has no final video, run, receipt, payload, approval, diagnostic,
   generation provenance, or Take lineage;
8. editing and generating Take B never changes Take A or its supporting files.

### Use case G: unspecified duration

1. a model exposes a duration field but the user/agent has not authored it;
2. Studio displays `Unspecified` and writes no value;
3. if provider/pricing defaults make an estimate possible, estimation may
   succeed without mutating the spec;
4. otherwise estimation reports price unavailable;
5. provider payload preview/run accepts omission or returns the actual Engines
   schema issue; Studio never inserts a duration.

### Use case H: Draft References with one Lookbook candidate

1. the Draft References tab renders General, Lookbook, Cast Character Sheets,
   and Location Sheets;
2. General always shows empty or filled First Frame, Last Frame, and Video
   Prompt Image slots plus the separate ordered Generic References collection;
3. the Scene has one Production Lookbook Sheet and the persisted Lookbook slot
   is empty;
4. Studio shows that sheet card with an unchecked selection control instead of
   `No Lookbook selected`;
5. selecting it persists the exact choice; Studio did not choose it merely
   because it was the sole candidate;
6. changing to a model that lacks a corresponding provider field does not hide
   any Draft slot or rewrite the selection; payload preview/run later returns
   any real Engines compatibility issue.

### Use case I: Completed References are the successful snapshot

1. Completed Take A has a playable final video and one successful
   materializing run;
2. the References tab reads only that run's immutable `specSnapshot`;
3. General, Lookbook, Character, and Location sections show the exact
   references used by that successful request;
4. a section with no used reference stays quiet rather than showing current
   Scene candidates or empty authoring slots;
5. the UI shows no checkbox, picker, clear, structure-mode, Shot-membership, or
   other mutation control;
6. later Scene, purpose-guide, or candidate changes do not alter this frozen
   reference record and do not raise a guide-placement diagnostic.

## Tests And Guardrails

### Engines pricing and payload tests

- An absent duration remains absent through create, update, reopen, Preview,
  and estimate.
- Studio configuration projects absent duration as `Unspecified` and never
  authors `Auto`, the lowest enum, a minimum, or a schema default.
- When the provider/pricing contract supplies enough facts without authored
  duration, estimation may succeed without Studio inserting a value.
- When exact pricing requires duration, estimation returns price unavailable
  without changing the spec.
- Estimate does not resolve project files, bind provider fields, assemble a
  payload, or return execution-readiness diagnostics.
- Provider request assembly rejects wrong kinds, invalid MIME/envelope values,
  cardinality overflow, missing required fields, and schema-invalid values.
- Provider request assembly reports absent/invalid provider fields during
  payload preview/run without repairing the spec.

### Spec/guide/reference tests

- A Scene with Maria and John projects exactly one optional Character Sheet
  slot for each Cast Member even when the Draft Take's current Shots contain
  only Maria.
- Draft Location slots likewise use complete Scene context, and exactly one
  Production Lookbook slot is always projected.
- An empty typed slot projects `current: null` and remains valid.
- Maria's slot lists only active Character Sheets explicitly registered to
  Maria; John's slot lists only John's sheets.
- Subject-filtered picker queries do not become Core candidate-membership,
  typed-owner, or purpose-guide-placement validation.
- A structurally readable authored choice saves even when it is absent from the
  current guide/candidate projection; no
  `CORE_GENERATION_SELECTION_INVALID` placement/candidate error is raised.
- Having one eligible candidate displays that candidate unchecked and does not
  select it automatically.
- A sole available Lookbook Sheet is displayed in the empty Lookbook slot;
  `No Lookbook selected` is not rendered in place of the candidate.
- Discarding the current candidate does not substitute another; Preview renders
  the authored choice as unavailable until the user/agent changes it.
- An unchanged unavailable typed choice does not block saving unrelated prompt
  or provider-value edits on an unmaterialized Take.
- External/imported image, audio, and video assets appear in media-generic
  searchable results for generic references.
- A Shot-owned generic image of Maria does not appear in Maria's Character
  Sheet picker until a focused Character Sheet workflow explicitly registers a
  resulting Character Sheet to Maria.
- `registerSceneShotGenericReferenceAsset` creates an explicit
  `scene_shot_reference_asset` row and never modifies a typed slot or spec.
- One UI slot cannot contain two current selections, while multiple additional
  references remain representable.
- Reference presence means inclusion; no inactive alternatives persist.
- Every purpose or target change fails before writes, including First Frame to
  Last Frame and Take A to Take B.
- Core never reads prompt text, filenames, labels, roles, or image contents to
  determine suitability.

### No Core provider-binding tests

- An absent provider field remains absent even when the descriptor exposes one
  compatible media field.
- An explicit provider field string is preserved byte-for-byte by Core.
- Changing model preserves authored bindings for draft visibility and surfaces
  Engines diagnostics during payload preview/run if the new model does not
  expose them; it does not silently rewrite the spec.
- A provider-incomplete spec saves, reopens, and estimates when pricing facts
  suffice.

### Take authoring and media tests

- Structure, Shot membership, direction, model, parameters, prompt, typed
  slots, and generic references remain editable before successful Take
  materialization.
- Failed provider attempts retain diagnostics and do not freeze authoring.
- Supporting First Frame, Last Frame, and Video Prompt assets do not count as a
  successful materializing `shot.video-take` run.
- Draft References always projects First Frame, Last Frame, and Video Prompt
  Image slots, including when empty and when the selected model exposes no
  matching provider input.
- Take run history shows only failed/successful materializing
  `shot.video-take` attempts; supporting generation history stays with its
  generated asset.
- Creating downstream authoring inputs after supporting media attachment
  succeeds while the Take remains unmaterialized.
- Replacing a current First Frame does not change Last Frame, Video Prompt, or
  final video pointers.
- The first successful final Take generation atomically records the successful
  run, attaches the video, and freezes the Take.
- Every later authoring mutation or run attempt on that Take fails before
  writes/provider execution.
- One Take cannot acquire a second successful materializing run or replacement
  final video.
- **New Take** copies authoring inputs and creates independent asset/file/owner
  copies of each present Take-owned supporting image, but produces new Take/spec
  ids and no final video, run, receipt, approval token, diagnostics, provider
  payload, or generation provenance history.
- Copied specs point at the cloned supporting Asset/AssetFile ids, not at the
  Completed source Take's owned files.
- Replacing or revising a copied supporting image on the new Draft Take does not
  change the Completed source Take's asset, file, reference display, or bytes.
- **New Take** rejects a source that is not completed; ordinary draft
  authoring does not need a copy/regeneration path.
- The new Take stores no `regeneratedFromTakeId` or replacement lineage field.
- Editing and successfully generating the new Take does not modify the source
  Take's spec snapshot, provider payload, receipt, output, or provenance.
- Focused commands keep their Take/purpose identity without an arbitrary patch
  API.

### Image Revision and desktop UI tests

- An empty typed slot and a filled typed slot both open the same shared picker.
- A typed picker shows only eligible domain assets for that exact subject.
- Choosing another eligible typed asset changes the persisted current
  selection in both AI Production and Generation Preview.
- Choosing `None` removes an optional reference.
- Generic reference search supports image, audio, and video and remains
  visually separate from typed slots.
- Additional references can be added/removed without Core provider-cardinality
  validation.
- Invalid drafts remain editable and show structured Engines diagnostics rather
  than being silently changed or blocked by React validation.
- Completed Take References resolves the exact successful `specSnapshot`
  selections and does not query/display current candidates or empty authoring
  slots.
- Completed-Take editing controls are absent, including reference toggles,
  pickers, Shot-membership actions, and the Continuous Move/Multi-Cut control;
  the sole setup action is **New Take**.
- Completed sections show only actual successful-request references, so an
  unused Character Sheet does not appear merely because its Cast Member belongs
  to the current Scene.
- Raw diagnostic codes are not the primary visible copy for genuine errors,
  while structured codes remain available to adapters/agents. The obsolete
  guide-membership error is removed rather than hidden.
- Existing request ordering/latest-response-wins behavior remains intact.
- Desktop Playwright coverage uses only local Shadcn controls; no mobile scope
  is added.

### Trash and garbage-collection tests

- Discarding a Take marks Take image and video ownership rows with the same
  operation and snapshots all explicitly owned current asset ids.
- Restoring reinstates all focused image/video rows and their exclusively owned
  assets/files.
- Empty Trash counts active Take image relationships as owners and does not
  collect their files.
- Asset discard rejects active Take image or video ownership before writes.
- Shared focused media conflicts are structured and leave durable state
  unchanged.
- A generic spec reference does not cause Take cascade ownership.
- A `scene_shot_reference_asset` row does confer Shot ownership and participates
  in discard/restore/garbage-collection counts.
- A reference shared by multiple specs remains ordinary usage, not an ownership
  error.
- Pre-success supporting-pointer replacement yields correct active owner counts
  for old and new assets without deleting run history.
- A failed lifecycle command leaves every ownership row unchanged.

### Export tests

- One picked Take without a current video fails with
  `CORE_PRODUCTION_EXPORT_TAKE_VIDEO_MISSING`.
- One valid picked Take plus one missing-video picked Take fails the whole
  export; it never exports a partial production tree.
- Multiple missing Takes are collected into one structured diagnostic report.
- Discarded/unready video, asset, or asset file counts as missing current media.
- With complete videos, export order and dialogue projection remain stable.
- Non-picked Takes and non-production image assets remain excluded.
- No ambiguous-video diagnostic/runtime branch is added because final-video
  uniqueness is a schema invariant.

### Architecture guardrails

- Prefer runtime boundary tests and import-boundary tests over source-text
  needles for helper/function names.
- Protect Studio feature code from database imports and Engines payload
  validation decisions.
- Protect Core purpose/slot modules from provider-specific branches.
- Protect Engines pricing and payload modules from Core purpose, typed-slot,
  and Take imports.
- Protect `GenerationRun.specSnapshot` from update paths.
- Protect completed Take specs/media from update paths and new Takes from source
  run-history copying.
- Scan current runtime—not historical plans or migrations—for removed
  `providerRole`, guide `cardinality`, placement `scope`, reference `included`,
  and output-based mutability capabilities using stable contract/import
  boundaries rather than private implementation inventories.
- Keep complexity and nesting within `docs/architecture/coding-practices.md`
  targets for changed exported functions and UI handlers.

## Documentation And Required ADRs

- Write `docs/decisions/0050-use-one-successful-generation-per-take.md` with
  explicit product rules and examples for pre-success editing, failed attempts,
  first successful materialization, completed-Take immutability, and creating a
  history-empty new Take from completed authoring values. It must define
  successful-snapshot-only Completed reference display, the **New Take** UI,
  independent copies of Take-owned supporting images, and the exclusion of the
  source final video/run/provenance. It must also state that imported media does
  not receive a synthetic successful run or materialize a Shot Video Take under
  this rule.
- Write
  `docs/decisions/0051-keep-generation-authoring-incomplete-and-reference-slots-agent-directed.md`
  with explicit rules and examples for complete-Scene Draft slots,
  always-visible First/Last/Video Prompt roles, sole-candidate unchecked
  presentation, optional typed slots, agent-authored choices, subject-filtered
  pickers, separate generic references, explicit Shot-owned
  `scene_shot_reference_asset` registration, explicit typed-asset creation, no
  guide-placement/candidate-membership/typed-owner/provider/default/fallback
  validation in Core, and Engines-only execution readiness.
- Amend ADR 0047 to preserve the independent pricing rail, remove any language
  that authorizes Studio-inserted provider defaults, and state that
  `Unspecified` is authored absence rather than an `Auto` value.
- Mark ADR 0049 superseded by ADRs 0050 and 0051 where its produced-Take and
  candidate-eligibility decisions conflict; retain only request-scoped exact
  choice principles that still apply.
- Update `docs/architecture/shot-video-take-owned-media.md` to define explicit
  focused relationship ownership, pre-success supporting media, insert-once
  successful final media, completed-Take immutability, successful-snapshot
  reference projection, and new Draft Takes with independently copied
  supporting images but no final video or generation history.
- Update `docs/architecture/generation-preview-purpose-bindings.md` for nullable
  complete-Scene Draft typed slots, subject-filtered UI candidates that are not
  Core validation, fixed supporting-media slots, separate media-generic
  references, successful-snapshot-only Completed projection, and shared AI
  Production/Preview state.
- Update generation spec/reference docs for immutable purpose/target identity,
  pre-success editable specs, presence-based inclusion, and the bounded typed
  slot contract.
- Document duration as an ordinary provider value: no Studio default, no
  `Auto`, `Unspecified` presentation, provider-owned omission behavior, and
  price-unavailable when required pricing facts are absent.
- Update production export docs to state the complete-or-fail picked-Take
  preflight.
- Update current CLI/server resource documentation only where public request or
  response shapes change.
- Update the sister Studio Skills project so agents deliberately author typed
  slot suggestions, may leave slots empty, register user-provided generic media
  without typed promotion, use focused workflows when the user asks to create a
  Character/Location/Lookbook asset, and create a new Take when editing a
  completed Take.
- Keep historical completed plans unchanged. Record implementation evidence in
  this plan and accepted docs.

## Final Verification

Run focused checks after each slice, including:

```bash
pnpm --dir packages/engines test
pnpm --dir packages/core test
pnpm --dir packages/studio test
pnpm check
pnpm build
pnpm test
pnpm lint
```

Before any migration work, verify the current Drizzle Kit command/documentation
and use the package-owned generation/apply flow. Then:

- migrate a copy of `urban-basilica` first;
- inspect exact spec/reference and Take image/video row counts;
- run SQLite `foreign_key_check` and `quick_check`;
- create the required verified backup before touching the real project;
- never delete/reset the real project database without explicit approval.

Manually verify on the supported desktop surface:

- a Take remains editable before success and after failed provider attempts;
- the first successful materializing run freezes every authoring control and
  leaves exactly one successful Take run;
- a Completed Take hides Shot membership and Continuous Move/Multi-Cut controls,
  shows exact successful-snapshot references only, and exposes **New Take**;
- **New Take** copies authoring inputs and independent Take-owned supporting
  images into a new history-empty Draft while leaving the completed source and
  its files unchanged;
- a Scene with two Cast Members shows two independently empty/filled Character
  Sheet slots even when the Draft Take currently contains a Shot for only one;
- the Draft General section always shows First Frame, Last Frame, and Video
  Prompt Image slots regardless of selected-model fields;
- one available unselected Lookbook Sheet is visible with an unchecked control,
  not replaced by `No Lookbook selected`;
- each Character Sheet picker shows only sheets explicitly registered to its
  Cast Member and never auto-selects one;
- the same typed choice is visible in AI Production and Generation Preview;
- a user-provided Shot-owned generic image appears only in Generic References;
- after the agent explicitly creates/registers a Character Sheet from that
  image, the new sheet appears in the appropriate Character Sheet picker;
- generic reference search works for image, audio, and video media;
- absent duration displays `Unspecified`, never `Auto`, and no value is written;
- estimate succeeds or reports unavailable solely from pricing facts without
  resolving references or requiring provider readiness;
- Image Revision typed-slot replace/clear and generic-reference changes work;
- saved references absent from a current guide projection remain inspectable
  and editable without `CORE_GENERATION_SELECTION_INVALID`;
- Take discard/restore preserves current images and video;
- export refuses a project when any picked Take lacks current ready video.

Final architecture-shape review:

- inspect `git diff --stat` and the complete diff in Studio and Studio Skills;
- inspect every newly large or heavily modified file;
- inspect `generation-preview-resource/update.ts`, Take generation commands,
  trash ownership code, and Image Revision containers for mixed
  responsibilities;
- confirm `packages/engines/src/generation/index.ts` and other touched
  `index.ts` files remain thin public entrypoints;
- confirm no new god file, catch-all helper, broad dispatcher, provider-role
  matrix, model initializer, reference defaulting service, or parallel
  validation subsystem was created;
- confirm behavior was not “fixed” by moving UI/adapter validation into one
  monolithic Core file;
- confirm every removed contract has direct caller updates and no aliases,
  shims, fallback fields, or migration-at-read recognition.

## Completion Checklist

### Review Area

- [x] Re-review all eight documented findings against the flexible authoring
      decision rather than preserving their rigid premises.
- [x] Confirm Take specs remain editable before success and through failed
      attempts, then freeze after the first successful materializing run.
- [x] Confirm every completed-Take edit/regeneration creates a new history-empty
      Draft with independent copies of Take-owned supporting images and no
      source final video or generation history.
- [x] Confirm imported media cannot masquerade as a completed Take through a
      synthetic run or receipt.
- [x] Confirm typed slots are optional, subject-specific, and never filled by
      Studio defaults.
- [x] Confirm Draft Shot Video Take Character/Location slots use complete Scene
      context and fixed supporting-media slots never depend on model fields.
- [x] Confirm Completed Take References comes only from the successful immutable
      snapshot and exposes no candidate/editing controls.
- [x] Confirm Core performs no purpose-guide placement, candidate-membership,
      or Character/Location/Lookbook ownership validation.
- [x] Confirm generic references remain separate and are never automatically
      promoted into typed slots.
- [x] Confirm Core preserves optional provider-field intent without binding or
      compatibility validation.
- [x] Confirm duration has no Studio default and renders as `Unspecified`.
- [x] Confirm estimation remains separate from provider request readiness.
- [x] Confirm implementation preserves accepted package ownership boundaries.
- [x] Confirm centralized ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Write ADR 0050 for one successful materializing generation per Take.
- [x] Write ADR 0051 for incomplete agent-directed authoring, optional typed
      slots, complete-Scene Draft projection, fixed supporting-media roles,
      successful-snapshot Completed projection, and separate generic
      references.
- [x] Amend ADR 0047 for pricing-only estimates and no Studio provider defaults.
- [x] Supersede conflicting ADR 0049 decisions before implementation.
- [x] Document pre-success editable specs, failed attempts, successful freeze,
      and history-empty new Takes.
- [x] Document typed candidate filtering as UI projection, never Core
      guide-membership/ownership validation or generation/provider validity.
- [x] Document explicit focused ownership versus generic reference usage and
      independent supporting-media copies created by **New Take**.
- [x] Add no model/provider-value initialization API.
- [x] Keep `assembleGenerationProviderRequest` as final provider validation.
- [x] Delete `GenerationPurposeEditingContract` and add no renamed replacement
      contract.
- [x] Remove `providerRole` from guide slots.
- [x] Remove redundant guide `cardinality`.
- [x] Remove unused section/placement `scope`.
- [x] Remove persisted reference `included`; presence means inclusion.
- [x] Replace Preview's generic change mini-language with a focused nullable
      typed-slot selection command and ordered generic-reference authoring.
- [x] Replace Image Revision's parallel/dead reference selection shape.
- [x] Keep package-boundary diagnostics structured.
- [x] Add no compatibility aliases, duplicate fields, or runtime repair paths.

### Pricing, Provider Values, And Execution Validation

- [x] Leave every absent provider value absent, including duration.
- [x] Render absent duration as `Unspecified` and remove `Auto` from Studio UI.
- [x] Insert no enum, minimum, or schema default into authored duration.
- [x] Remove Take-specific duration normalization/default helpers.
- [x] Ensure estimate uses only available pricing facts and intended media
      counts.
- [x] Return price unavailable without mutating the spec when pricing facts are
      insufficient.
- [x] Prove estimate does not resolve files or assemble a provider request.
- [x] Preserve explicit provider fields.
- [x] Leave absent provider fields absent even when one compatible field exists.
- [x] Delete Core reference-field binding and its diagnostics.
- [x] Remove semantic field fallback/rejection matrices.
- [x] Keep provider kind/MIME/cardinality/schema checks in Engines.

### Spec, Guide, And Reference Implementation

- [x] Keep purpose/target immutable after spec creation.
- [x] Keep JSON, safe shape, normalized path, and one-current-choice-per-typed-
      slot checks in Core.
- [x] Project one optional Character Sheet slot per complete Scene Cast Member,
      one Location Sheet slot per complete Scene Location, and one Production
      Lookbook slot for Draft Takes.
- [x] Delete Core purpose-guide placement, candidate-membership, and typed-owner
      validation, including the `findGuideSlot` rejection path.
- [x] Keep subject-filtered candidate queries as UI choice projection only.
- [x] Accept `null` for every empty typed slot.
- [x] Never auto-select or substitute a typed candidate.
- [x] Allow unavailable or currently unoffered exact choices to remain while
      unrelated Draft fields are edited; project them without substitution.
- [x] Persist AI Production and Generation Preview typed choices from the same
      spec state.
- [x] Keep generic references in a visually and structurally separate section.
- [x] Add `scene_shot_reference_asset` and
      `registerSceneShotGenericReferenceAsset` for explicit Shot-owned generic
      media.
- [x] Include external/imported image, audio, and video assets in generic media
      search.
- [x] Expose paginated/searchable media-generic selection.
- [x] Prove a generic asset enters a typed picker only after an explicit focused
      domain workflow creates the matching typed asset relationship.
- [x] Keep browser projections free of unsafe local/provider URLs.
- [x] Remove creative readiness requirements/notices from Core resources.
- [x] Keep Director resources factual and move creative advice to skills.
- [x] Update every purpose caller directly to the simplified contracts.

### Take Authoring And Current Media

- [x] Replace `requireShotVideoTakeAuthoringMutable` with the successful-
      materialization authoring boundary.
- [x] Keep one editable current spec per Take/purpose before success.
- [x] Allow supporting authoring media and failed runs without freezing the
      Shot Video Take.
- [x] Keep Take run history limited to materializing `shot.video-take` attempts;
      keep supporting generation history with its assets.
- [x] Finalize the first successful Take run and final-video attachment in one
      durable transaction.
- [x] Reject all completed-Take authoring changes and second run attempts.
- [x] Add `createSceneShotVideoTakeFromTake` with new Take/spec ids.
- [x] Copy authoring values and clone each present Take-owned supporting image
      into a new Asset, AssetFile, durable file, and focused owner row.
- [x] Rewrite copied First/Last/Video Prompt reference selections to the cloned
      Asset/AssetFile ids.
- [x] Copy no final video, run, approval token, receipt, payload, diagnostics,
      generation provenance, or Take lineage.
- [x] Use the project-asset write-set/cleanup boundary so failed supporting
      copies leave no partial Take, metadata, or files.
- [x] Remove `regeneratedFromTakeId` and persist no replacement lineage field.
- [x] Preserve the completed source Take and successful run snapshot exactly.
- [x] Keep supporting image pointer replacement pre-success only.
- [x] Keep focused commands fixed to their Take/purpose intent.
- [x] Avoid a broad arbitrary durable-state patch API.

### Image Revision And Studio UI

- [x] Replace the Image Revision reference picker no-op callback.
- [x] Reuse the shared reference picker in Take, Preview, and Image Revision.
- [x] Show nullable current typed choice separately from eligible domain
      candidates.
- [x] Always show Draft First Frame, Last Frame, and Video Prompt Image slots,
      including empty slots and models without matching inputs.
- [x] Show a sole typed/Lookbook candidate unchecked without selecting it.
- [x] Restrict typed pickers to their exact Cast Member, Location, Lookbook, or
      other focused subject.
- [x] Allow media-generic search, replace, clear, and additional generic
      references in the separate generic section.
- [x] Remove React validation that duplicates Engines schema rules.
- [x] Preserve invalid drafts and display structured diagnostics.
- [x] Render Completed Take References from the successful `specSnapshot` only.
- [x] Remove all completed-Take authoring controls, including Shot membership,
      reference toggles/pickers, and Continuous Move/Multi-Cut.
- [x] Label the completed-Take setup action **New Take**, never Edit in Place.
- [x] Keep structured codes available to adapters/agents but do not make raw
      codes the primary user-facing error copy; remove the obsolete guide-
      membership diagnostic at its source rather than hiding it.
- [x] Use local Shadcn controls only.
- [x] Keep visible copy intentional and domain-authored.
- [x] Verify desktop behavior only unless mobile scope is separately requested.

### Lifecycle And Export

- [x] Include `sceneShotVideoTakeImages` in Take trash snapshots.
- [x] Discard and restore focused Take image rows with the Take operation.
- [x] Include Take image assets/files in exclusive ownership collection.
- [x] Include Take images in shared-owner and garbage-collection counts.
- [x] Remove Take ownership inference from generic spec references.
- [x] Include explicit Shot generic-reference relationships in ownership,
      discard/restore, and garbage-collection behavior.
- [x] Verify pre-success supporting-pointer replacement updates lifecycle
      ownership safely.
- [x] Collect all ownership conflicts before writes and execute lifecycle
      changes transactionally.
- [x] Read all picked Takes before resolving export videos.
- [x] Fail export when any picked Take lacks a current ready video.
- [x] Collect all actionable picked-Take export issues.
- [x] Prove partial production trees cannot be emitted.
- [x] Add no ambiguous-video runtime branch beyond the schema uniqueness
      constraint.

### Migration And Real Data

- [x] Re-read current Drizzle Kit documentation before schema/migration edits.
- [x] Finalize the TypeScript schema before generating migration artifacts.
- [x] Add `media_generation_run_take_success_idx` to enforce at most one
      completed materializing Take run.
- [x] Add the `scene_shot_reference_asset` schema and generated migration.
- [x] Remove `regenerated_from_take_id` through the generated schema migration.
- [x] Regenerate affected unshipped migrations through Drizzle Kit.
- [x] Document any truly necessary custom one-way data transformation.
- [x] Add no runtime intermediate-shape recognition.
- [x] Create a verified database backup before applying to real project data.
- [x] Validate a database copy before `urban-basilica`.
- [x] Verify row counts, foreign keys, schema generation, and `quick_check`.
- [x] Perform no destructive real-project operation without explicit approval.

### Tests And Guardrails

- [x] Add pricing/execution-rail separation and no-default tests.
- [x] Add provider payload assembly tests in Engines.
- [x] Add Core typed-slot and generic-reference separation tests.
- [x] Add no-Core-provider-binding tests.
- [x] Add pre-success edit, failed-run retry, successful freeze, and new-Take
      tests.
- [x] Add Image Revision reference interaction tests.
- [x] Add Take image discard/restore/garbage-collection tests.
- [x] Add complete-or-fail production export tests.
- [x] Add/update stable import/runtime architecture guardrails.
- [x] Do not encode private helper names or complete implementation inventories
      in architecture tests.
- [x] Run the shape-review checks listed in Final Verification.

### CLI, Server, Agent, And Documentation Surfaces

- [x] Keep CLI handlers thin and update request/response callers directly.
- [x] Keep Studio server handlers thin and generic in structured error
      translation.
- [x] Update Media Producer reference guidance in Studio Skills.
- [x] Teach agents to author typed suggestions deliberately and leave slots
      empty when no choice is warranted.
- [x] Teach the generic-reference versus explicit typed-asset creation workflow.
- [x] Remove skill assumptions about Studio defaults, fallbacks, automatic
      provider fields, or required Character/Location/Lookbook slots.
- [x] Validate skill contracts and examples after public DTO changes.
- [x] Update current ADRs and architecture references.
- [x] Update current generation, Take, Image Revision, and export docs.
- [x] Do not edit historical plans merely to erase obsolete terminology.

### Final Verification

- [x] Run focused Engines, Core, and Studio tests.
- [x] Run `pnpm check`.
- [x] Run `pnpm build`.
- [x] Run `pnpm test`.
- [x] Run `pnpm lint`.
- [x] Complete desktop workflow verification with realistic project data.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect every large or heavily modified file.
- [x] Confirm touched `index.ts` files remain thin entrypoints.
- [x] Confirm no new god file, catch-all module, broad dispatcher, semantic-role
      matrix, model initializer, reference defaulting service, or parallel
      validator exists.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
