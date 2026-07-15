# 0142 Request-Scoped Generation References And Take Media

Status: complete
Date: 2026-07-14
Depends on: Plan 0141

## Summary

Complete the removal of origin-level asset selection and make continuity
references a property of each saved `GenerationSpec`.

For every generation purpose, Core declares the optional typed reference slots
and exposes all valid candidates. The agent inspects the candidates and authors
the most context-appropriate exact choice into a saved spec. Generation Preview
shows that choice as the current card; clicking it opens the same picker pattern
used by Shot Video Take references, with every alternative and an explicit
`None` choice. A user change replaces or clears the slot reference in that same
saved spec.

Preview renders only useful slot controls. If a slot has no candidates and no
saved choice—for example the first Character Sheet ever created for a Cast
Member—the slot is absent from the References section. The agent-facing
`GenerationContext` may still declare the empty slot so the purpose contract is
complete. Invalid saved references continue through the existing Core
validation/diagnostic path; this plan does not add a special stale-reference UI
state.

The implementation uses one generic reference-slot architecture for all listed
purposes. Purpose files compose small shared slot constructors; they do not copy
candidate queries or add purpose-specific Preview dialogs.

This plan also gives First Frame, Last Frame, and Video Prompt Image their own
purpose keys and correct Shot Video Take ownership. A Shot Video Take may contain
multiple Shots for authoring, but it represents one provider request and owns at
most one First Frame image, one Last Frame image, one Video Prompt image, and one
final generated video.

Finally, production export stops using generic origin asset selection. It
exports only the picked Shot Video Take videos and the exact Dialogue Audio Takes
included by those picked Takes. Storyboards, Lookbooks, Character Sheets,
Location Sheets, profiles, heroes, frames, and prompt images are not production
exports in this plan.

## Accepted Product Behavior

### Reference choice belongs to the request

There is no selected Character Sheet, selected Location Sheet, selected
Lookbook Sheet, or generic selected asset at its origin.

For example, Mehmed II may have Palace, Armored Siege, and Helmeted Battlefield
Character Sheets. A palace generation context exposes all three candidates. The
agent inspects them and writes the Palace sheet into that request's saved spec.
Preview displays Palace as the current choice and all three sheets in the picker.
Choosing Armored Siege replaces the Palace reference only in that spec.

The same rule applies while creating another Character Sheet. A new Mehmed II
Character Sheet request exposes all existing Mehmed II Character Sheets in its
optional Character Sheet continuity slot, in addition to the Production
Lookbook Sheet slot. The agent may use a prior sheet to preserve visually
inspected character continuity while authoring a new variant. Likewise, a new
Location Sheet request exposes all existing Location Sheets for that Location
in its optional Location Sheet continuity slot. These are ordinary request
choices, not recursive origin selections or automatic defaults.

Core validates candidate identity, ownership, role, media kind, slot placement,
and provider binding. Core does not inspect imagery, parse titles for setting or
costume meaning, rank creative suitability, or choose a default candidate.

### Agent creates the saved spec before Preview

The workflow is deliberately one-way and simple:

```text
GenerationContext with slots and candidates
        ↓
agent inspects candidates and creates one saved GenerationSpec
        ↓
Generation Preview reads that saved spec
        ↓
user replaces/clears slot choices and saves to the same spec
```

There is no transient Preview-save mode, Preview draft document, fallback
selection source, or second review domain. Multi-request Preview remains an
ordered array of independent saved specs.

### Every declared slot is optional

A slot with candidates may contain zero or one selected reference. `None` is a
valid explicit user choice. Missing creative continuity references do not make
the spec envelope invalid, although existing execution/model requirements may
still report provider-validity diagnostics.

Every purpose also accepts `placement.kind = 'additional'` references. These
adhoc references are opaque exact asset files or project files selected by the
agent/user; they are not forced into a typed slot.

### Purpose and slot matrix

After Plan 0141, `ProductionLookbook` and `StoryboardLookbook` are singular
project roles, while each can own multiple sheet candidates.

| Purpose | Target | Optional typed slots |
| --- | --- | --- |
| `lookbook.video-sheet` | Production Lookbook | none |
| `lookbook.storyboard-sheet` | Storyboard Lookbook | none |
| `lookbook.image` | Lookbook | one Production Lookbook Sheet |
| `cast.character-sheet` | Cast Member | one Production Lookbook Sheet; one existing Character Sheet for that same Cast Member |
| `cast.profile` | Cast Member | one Character Sheet for that Cast Member |
| `location.sheet` | Location | one Production Lookbook Sheet; one existing Location Sheet for that same Location |
| `location.hero` | Location | one Location Sheet for that Location |
| `scene.storyboard-sheet` | Scene | one Character Sheet per Scene Cast Member; one Location Sheet per Scene Location; one Storyboard Lookbook Sheet |
| `shot.first-frame` | Shot Video Take | one Character Sheet per unique Take Cast Member; one Location Sheet per unique Take Location; one Production Lookbook Sheet |
| `shot.last-frame` | Shot Video Take | same as `shot.first-frame` |
| `shot.video-prompt` | Shot Video Take | same as `shot.first-frame` |
| `shot.video-take` | Shot Video Take | one Character Sheet per unique Take Cast Member; one Location Sheet per unique Take Location; one Production Lookbook Sheet; one take-owned First Frame; one take-owned Last Frame; one take-owned Video Prompt Image; one Dialogue Audio Take per included dialogue |

All rows also allow additional references. The Cast and Location slot count is
derived from target context. For a Shot Video Take, Shots remain authoring input;
the generated request and reference choices belong to the Take, so duplicate
subjects across its Shots produce one Take-level subject slot.

For `cast.character-sheet` and `location.sheet`, “existing” means a current,
ready, exact asset file already available when Core builds the context. An
anticipated output is never a candidate. A prior output from an earlier run or
spec may be selected like any other valid candidate. When no prior same-owner
sheet exists, the continuity slot has no candidates and remains valid and empty.

### Empty slots stay out of Preview

The agent and Preview have different presentation needs:

- `GenerationContext.referenceGuide` keeps the purpose's declared slot even
  when `candidates` is empty, allowing agents to understand that the optional
  continuity input is currently unavailable.
- the browser-safe Preview projection omits a slot only when it has no
  candidates and no saved reference;
- if all slots are omitted and there are no additional references, the existing
  References empty state is shown;
- an invalid saved reference is not reclassified as an empty slot; existing
  Core validation handles it.

This filtering is presentation projection in Core, not purpose-specific React
logic.

### Purpose settings

- `shot.first-frame`: recommend the project's video aspect-ratio preference;
  do not recommend a model.
- `shot.last-frame`: recommend the project's video aspect-ratio preference;
  do not recommend a model.
- `shot.video-prompt`: recommend 16:9 and GPT Image 2; these are preferences,
  not fixed settings.
- no other model or setting changes are introduced by this plan.

### Focused display choices are not generation selections

The only retained origin-adjacent choice is UI presentation:

- one Cast Profile asset may be chosen as the Cast Member's displayed profile;
- one Location Hero asset may be chosen as the Location's displayed hero.

These use focused display tables and commands. They do not use generic
`Asset.selection`, do not affect generation candidate availability, and do not
become production exports.

## Context

This plan implements the product requirements in Plan 0139 after Plan 0141 and
supersedes the origin-selected reference behavior introduced by completed Plan
0138. It is constrained by:

- `AGENTS.md` architecture, shadcn, opaque artifact, migration, naming, and
  structured-diagnostic rules;
- ADR 0041, opaque AI artifacts and prompts;
- ADR 0044, generation module boundaries;
- ADR 0045, Preview purpose bindings;
- ADR 0047, context-first provider-valid generation;
- ADR 0048 from Plan 0141;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/reference/generation-specs.md` and current generation
  references;
- `docs/architecture/front-end-guidelines.md`;
- the current Shot Video Take workspace and shared image-card controls;
- `/Users/keremk/Projects/aitinkerbox/studio-skills`;
- `/Users/keremk/renku-movies/urban-basilica`.

The current implementation still contains:

- `selection` and `selectionOrder` on project, Cast, Location, Sequence, and
  Scene asset relationships;
- public `Asset.selection`, generic asset select commands, CLI actions, routes,
  ordering, and Director readiness checks;
- guide-owned `selections`, `selectedAssetFileIds`, and `initializeFirst`;
- selected-origin lookup in Scene Storyboard and Shot Video Take purposes;
- Preview references only for choices already stored in the spec, with boolean
  inclusion toggles but no alternative replacement;
- First/Last/Video Prompt identities mixed into Shot-scoped reference roles;
- generic production export driven by project/sequence/scene selected assets.

## Architecture Shape Gate

### Ownership and public entrypoints

`packages/core` owns:

- origin relationship shape and focused display-choice invariants;
- generation slot declarations and candidate envelope validation;
- saved spec reference replacement/clearing;
- purpose settings and target validation;
- Take-owned image/video cardinality and attachment;
- picked-Take production export projection;
- structured diagnostics for every failed write.

CLI and Studio server parse intent and call Core. React consumes projected
resources and sends replacement/clear intent. Skills inspect creative candidates
and choose references, but cannot bypass Core validation.

Public generation entrypoints added or changed by this plan are:

- `createGenerationSpec` and `updateGenerationSpec`, with slot candidate
  membership validation;
- the existing `updateGenerationPreviewResource(input)`, extended with one
  discriminated `replace`/`clear` reference-change collection rather than new
  public set/clear commands;
- `buildGenerationPreview` only for a saved spec id on the editable Preview
  path;
- the existing generation run/attach entrypoints with focused Take-media
  attachment behavior.

Focused display entrypoints are:

- `setCastProfileDisplayAsset` / `clearCastProfileDisplayAsset`;
- `setLocationHeroDisplayAsset` / `clearLocationHeroDisplayAsset`.

### Intended generation module shape

- keep `packages/core/src/server/generation/purpose-guide.ts` as the generic
  guide assembly owner and remove its origin selection reads/default-selection
  behavior. Do not rename it merely to create a new abstraction.
- `packages/core/src/server/generation/reference-slots/` contains three cohesive
  domain modules rather than one file per tiny constructor:
  - `domain-assets.ts` owns reusable Character Sheet and Location Sheet slot
    construction from explicit owner/subject inputs;
  - `lookbook-sheets.ts` owns Production and Storyboard Lookbook Sheet slot
    construction against the two Plan 0141 Lookbooks;
  - `take-media.ts` owns First/Last/Video Prompt and Dialogue Audio slot
    construction for a Shot Video Take.
- `domain-assets.ts` supports both downstream consumers and same-owner
  continuity purposes. It returns current ready candidates and never knows
  which purpose consumes the slot or chooses a candidate.
- each purpose module in `generation/purposes/` composes those constructors and
  owns only its purpose target/settings/slot declaration.
- the existing `generation-preview-resource/update.ts` remains the one Preview
  save transaction and delegates the pure replace/clear operation to the
  internal `generation/spec-reference-edits.ts`; that module does not open
  sessions, project resources, or transactions.
- move the existing Shot Take `bindReferenceFields` behavior into
  `generation/reference-field-binding.ts` and call it from both Shot Take and
  Preview. This is a generalization of existing behavior, not a second binding
  system.
- `generation/specs.ts` owns general spec-envelope and candidate-membership
  validation and must remain focused.
- the bounded purpose registry remains a thin registry of descriptors.

Do not add `reference-slots/index.ts` unless an actual bounded public entrypoint
is required. Current purpose modules may import the three owning files directly.

### Intended asset/display module shape

- remove selection columns from the five asset relationship tables in
  `server/schema/assets.ts`;
- add `cast_profile_display_asset` and `location_hero_display_asset` focused
  tables in their owning schema modules;
- `database/access/asset-relationships/` becomes relationship CRUD/listing
  without selection ordering;
- focused access and command files own the two display choices;
- generic asset command/service/CLI/route selection operations disappear.

### Intended Preview and shared picker shape

- directly replace the flat `GenerationPreviewResource.references` array with a
  small grouped `GenerationPreviewReferences` value containing `slots` and
  `additional`. Add only one slot projection shape and reuse the existing
  `GenerationPreviewResourceReference` for both candidate cards and additional
  references. Do not create a parallel browser copy of every guide section,
  slot, and catalog type.
- extend the existing `generation-preview-resource/references.ts` projection to
  group current choices with safe candidates and omit truly empty slots. Do not
  add a second reference-guide projection subsystem.
- candidate resources contain meaningful labels, safe image URLs/ids, and
  owner/subject presentation; never local paths or provider upload URLs.
- extract the existing Shot Take picker dialog and card grid directly into
  `packages/studio/src/features/reference-picker/`. Start with the smallest
  shared component set demonstrated by both callers; do not add wrapper layers
  or a general picker framework.
- Shot Take references and Generation Preview each map their resource into that
  component. Neither feature imports the other's domain state.
- `GenerationRequestEditor` remains the generic tab shell. The Preview
  references panel renders slot cards plus additional references and sends
  replace/clear intent.

Use local shadcn `Dialog`, `Button`, and selection controls only. Candidate cards
show meaningful asset/domain labels supplied by Core; they must not invent
`Sheet 1`, filenames, ids, or kebab-case roles.

### Intended Take-media and export shape

- add `scene_shot_video_take_image` with
  `role: 'first-frame' | 'last-frame' | 'video-prompt'`, exact asset/file ids,
  lifecycle columns, and unique `(take_id, role)`.
- retain `scene_shot_video_take_video.take_id` uniqueness for the one final
  video and add structured preflight rather than exposing a raw unique error.
- `project-asset-files/destinations/shot-video-take.ts` remains the only
  filesystem destination owner for Take media.
- add focused Take-media access/attachment modules; do not turn the general
  attachment dispatcher into persistence logic for every role.
- replace `database/access/production-export.ts` selected-relationship reads
  with focused picked-Take video and included Dialogue Audio projection.
- production export planning/copying remains shared after it receives the
  focused export rows.

### Bounded dispatch and registries

- Purpose-specific slot composition stays in the existing bounded purpose
  registry.
- Take output attachment may use a small purpose-to-role registry for exactly
  the three image purposes plus the final video purpose.
- Production export may use focused row projectors for `dialogue-audio` and
  `shot-video`, not a general asset-role switchboard.

### Reuse budget

Implementation must begin from the current contracts and remove obsolete state
before adding replacements. The expected additions are deliberately narrow:

- three new `GenerationPurpose` literals and their existing-style purpose
  descriptors;
- one Take-image persistence table because no current table can express one
  image per Take role;
- two focused display-choice tables because Profile/Hero UI display state must
  not reuse generation selection;
- one `providerRole` field on the existing guide slot, using the existing model
  media-role union;
- one grouped Preview references container, one Preview slot shape, and one
  replace/clear change union, all reusing existing reference/placement types;
- one directly extracted shared picker implementation.

Do not add a new generation planning domain, candidate type family, slot class,
slot registry object, Preview review model, repository layer, service facade,
or UI state framework. If implementation appears to require another public type
or abstraction beyond this list, stop and demonstrate why an existing contract
cannot represent the behavior before proceeding.

### Explicitly forbidden shape

- No generic origin `take`/`select` state or selection order.
- No default-first candidate selection in Core or React.
- No empty slot card in Preview when there are no candidates and no saved
  choice.
- No title/description/image semantic ranking in runtime code.
- No purpose-specific Preview picker implementations.
- No parallel Preview copies of the full guide/catalog type hierarchy.
- No separate public set-reference and clear-reference command families when
  the existing Preview update transaction owns both edits.
- No route-local or UI-local candidate validation/provider binding.
- No guide `selections`, `selectedAssetFileIds`, or `initializeFirst`.
- No alternatives duplicated into `GenerationSpec.references`; the spec stores
  only its current exact choices and additional references.
- No compatibility aliases for image.create `kind` values or removed asset
  selection commands.
- No shot-owned First/Last/Video Prompt media rows.
- No one-to-many final video relationship for a Take.
- No generic production-export inclusion flag.
- No semantic prompt or artifact inspection.

### Stop conditions

Stop and revise before continuing if:

- a purpose file performs raw database queries already owned by a slot module;
- adding a purpose requires a branch in Preview UI;
- implementing a slot requires another near-identical exported type or one-file
  constructor rather than extending the existing guide/resource vocabulary;
- Preview can select a file that Core did not expose as that slot's candidate;
- provider-field binding is calculated in the browser or HTTP route;
- a Take can acquire a second current image for a role or a second video;
- an authored Take with generated media can be mutated in place;
- production export still reads generic relationship selection;
- one generation, asset, Preview, attachment, or export file becomes a god
  module merely because Core owns the boundary.

## Contracts

### Reference guide versus saved choice

Keep the existing `GenerationReferenceGuideSlot` as the declaration. Remove
only its `selections` field and add one `providerRole` field typed from the
existing media semantic-role union already used by
`GenerationModelFieldDescriptor`. Do not introduce a separate
`GenerationReferenceMediaBinding` type hierarchy.

```ts
interface GenerationReferenceGuideSlot {
  id: string;
  label: string;
  cardinality: 'one';
  subject?: { kind: string; id: string };
  guidance?: string;
  providerRole: Extract<
    NonNullable<GenerationModelFieldDescriptor['semantic']>,
    { kind: 'media' }
  >['role'];
  candidates: GenerationReferenceCatalogItem[];
}
```

The implementation must reuse this existing semantic-role union rather than
create a second manually maintained string union.

Remove `selections` from the guide and remove `additionalReferences` from the
guide. Additional references are a universal `GenerationSpec` capability, not
purpose data.

The catalog item must carry meaningful envelope presentation such as asset
title, owner/subject label, relationship purpose/label when authored, media
metadata, and exact reference identity. It must not derive creative labels by
parsing media.

`GenerationSpec.references` remains the sole saved source of current request
choices. `placement.kind = 'slot'` is validated against the exact current slot
and candidates; `placement.kind = 'additional'` is validated as an available
exact reference but does not require slot membership.

Cardinality counts included slot references. Clearing a slot removes its slot
reference from the saved spec rather than leaving alternative/inactive choices
as parallel spec state.

The browser resource directly replaces its flat reference array with only the
grouping needed by the UI:

```ts
interface GenerationPreviewReferences {
  slots: GenerationPreviewReferenceSlot[];
  additional: GenerationPreviewResourceReference[];
}

interface GenerationPreviewReferenceSlot {
  label: string;
  placement: Extract<
    GenerationReferenceSelection['placement'],
    { kind: 'slot' }
  >;
  candidates: GenerationPreviewResourceReference[];
}
```

Candidate `selected` state comes from the saved spec. The existing
`GenerationPreviewResourceReference` supplies the exact asset/file ids, label,
media metadata, and browser URL. The slot is omitted when `candidates` is empty
and no saved reference occupies its placement. Invalid saved references remain
the responsibility of existing Core validation; no stale-reference DTO or
recovery UI is added. No full
`GenerationPreviewReferenceGuideResource` mirror is introduced.

### Preview mutation

Extend the existing Preview update input with one focused change union:

```ts
type GenerationPreviewReferenceChange =
  | {
      kind: 'replace';
      placement: Extract<
        GenerationReferenceSelection['placement'],
        { kind: 'slot' }
      >;
      reference: GenerationReference;
    }
  | {
      kind: 'clear';
      placement: Extract<
        GenerationReferenceSelection['placement'],
        { kind: 'slot' }
      >;
    };
```

`GenerationPreviewReferenceChange` is the only new public mutation shape needed;
it reuses the existing slot placement and reference contracts. The existing
Preview update performs one transaction: rebuild context, locate the exact
slot, prove a replacement is a current candidate, resolve its provider field
through the generalized existing binding logic, replace or clear the slot
choice, validate, persist, and return the refreshed Preview resource.

If the slot's `providerRole` cannot map unambiguously to the selected model,
fail with
`CORE_GENERATION_REFERENCE_BINDING_UNAVAILABLE`; do not guess or silently keep a
stale provider field.

Prompt edits and reference edits persist to the same spec. The Preview update
HTTP route sends Core-owned intent objects and translates structured errors.

### Purpose keys and Take ownership

Add these direct purposes and remove their former `image.create` kind usage:

- `shot.first-frame`;
- `shot.last-frame`;
- `shot.video-prompt`.

All target `sceneShotVideoTake`, output image media, use the shared slot set,
and attach to the one matching Take image role. Generic `image.create` remains
available for adhoc image generation and additional references; it does not
recognize the removed kinds.

The three image purposes and `shot.video-take` have one current spec per Take
and purpose. Add a focused database uniqueness constraint for these purpose /
target combinations. Do not make all generation purposes singleton because
Scene Storyboard and other workflows may intentionally have multiple specs.

Once any Take-owned generated image or final video is attached, authoring
changes must create a new Take through the existing Take regeneration/copy
workflow. Core rejects in-place mutation of the produced Take with structured
diagnostics. The new Take owns a new set of zero-or-one media outputs.

### Focused display contracts

Display tables store the owning Cast Member/Location id and a related asset id.
Core verifies the asset is a current ready relationship of role `profile` or
`hero` for that exact owner before writing. Clearing is valid. These choices are
project UI state only.

### Production export contract

The export source is:

1. each current `scene_shot_video_take` with `is_picked = true` and its one
   attached final video;
2. the included `dialogue-audio` slot reference for each dialogue in that
   picked Take's one current `shot.video-take` spec.

Core validates that every exported Dialogue Audio reference resolves to a
current `scene_dialogue_audio_take` owned by the referenced dialogue. Missing
optional dialogue selection is skipped; invalid/dangling state fails with
structured diagnostics. No other asset categories enter the export plan.

Update names such as `SelectedProductionAssetRow` to the current domain, for
example `ProductionExportMediaRow`, and remove generic selection ordering from
paths/manifests/docs.

## Migration Policy

Use Drizzle Kit for schema changes and a documented one-way migration.

- Before dropping relationship selection columns, migrate the first explicit
  selected `profile` relationship by `selectionOrder` into
  `cast_profile_display_asset` and the first explicit selected `hero`
  relationship into `location_hero_display_asset`.
- If no explicit display candidate exists, leave the focused display choice
  empty. Do not choose the first asset.
- Drop `selection` and `selection_order` from every generic relationship table.
- Migrate any current take-owned First/Last/Video Prompt relationships into
  `scene_shot_video_take_image` only when their Take owner and role are exact
  and unambiguous; fail preflight on duplicate role rows rather than choosing.
- Rewrite owned generation purpose/role envelope fields for the three new
  purpose keys without touching prompt text or arbitrary creative JSON.
- Add focused Take spec/media uniqueness constraints.
- Back up and apply the migration to `urban-basilica`, then verify integrity and
  exact counts against the backup.

## Implementation Slices

### Slice 1: accept architecture and migration design

- Add ADR
  `docs/decisions/0049-use-request-scoped-generation-reference-choices.md`.
- Update the asset and generation architecture references before code.
- Audit real databases for selected profiles/heroes, duplicate Take media roles,
  and multiple current Take purpose specs.

### Slice 2: remove generic origin selection

- Change schema and relationship access modules.
- Remove public `AssetSelection`/`Asset.selection` and selection ordering.
- Delete generic Core select/update/remove commands and service methods.
- Delete CLI select actions, Studio routes, React controls, readiness checks,
  tests, and current docs.
- Add focused Cast Profile and Location Hero display tables, commands,
  resources, routes, and UI actions.

### Slice 3: separate guide candidates from spec choices

- Add the three cohesive `reference-slots/` domain modules and reuse their
  constructors across purposes.
- Make guide assembly selection-free.
- Extend catalog presentation metadata without unsafe paths.
- Validate slot choices against exact candidates on create/update.
- Keep additional references universally available.
- Refactor each purpose through the matrix; do not batch this into one purpose
  switch.

### Slice 4: saved Preview replacement and shared picker

- Replace the flat Preview reference projection with the minimal browser-safe
  `slots`/`additional` grouping, omitting slots with no candidates and no saved
  choice.
- Extend the existing Preview update transaction with replace/clear changes and
  reuse the generalized existing reference-field binding.
- Remove editable transient-file Preview; editable Preview accepts saved
  `--spec` values only, including the existing repeated-spec array workflow.
- Extract the shared reference picker from the current Shot Take dialog.
- Reuse it in Shot Take and Preview with meaningful candidate labels and None.
- Keep additional reference cards and prompt editing in the same saved spec.

### Slice 5: new Take image purposes

- Add the three purpose descriptors/settings and registry entries.
- Add Take-level dynamic Cast, Location, and Production Lookbook slots.
- Add Take image storage/access/projection/attachment.
- Remove `first-frame`, `last-frame`, and `video-prompt-sheet` as Shot-scoped
  generic relationship roles where they represented owned outputs.
- Enforce one spec/output per Take purpose and one final video.
- Enforce new-Take-on-produced-authoring-change behavior.

### Slice 6: focused production export

- Replace generic selected-asset reads with picked Take video rows.
- Resolve included Dialogue Audio Takes from the picked Take spec.
- Update export paths, manifest vocabulary, CLI summaries, and tests only for
  audio/video.
- Do not add storyboard or other export categories.

### Slice 7: agent skills and real workflow

- Update Media Producer to inspect every slot candidate, inspect image files,
  choose contextually, create the saved spec, and then open Preview.
- Teach Character Sheet and Location Sheet generation to inspect same-owner
  prior sheets as continuity candidates when present, while allowing the agent
  to choose none or use an additional opaque reference.
- Remove all instructions to find or require selected origin sheets.
- Document that the agent's choice is a creative decision stored in the spec,
  while Core only validates the envelope.
- Update purpose guides/examples for all rows in the matrix and the three new
  purposes/settings.
- Update Casting Director, Production Designer, Scene Shot Designer, and Movie
  Director references that mention selected sheets.
- Verify Mehmed II palace context selects `mehmed-ii-palace-main` in an agent
  spec while Preview offers all three Character Sheets.

## Tests And Guardrails

### Origin selection and display tests

- Schema/API tests prove generic relationships have no selection fields.
- Removed Core/CLI/route selection capabilities have no current callers.
- Focused display commands reject wrong owner, role, discarded, or unavailable
  assets before writes and allow clear.
- Migration tests preserve explicit Profile/Hero display choice only.
- Director readiness reports availability, not selected sheets.

### Guide/spec tests

- Every purpose matrix row has a focused context test.
- `cast.character-sheet` tests expose every existing same-Cast Character Sheet
  alongside the Production Lookbook Sheet, without a default selection.
- `location.sheet` tests expose every existing same-Location Location Sheet
  alongside the Production Lookbook Sheet, without a default selection.
- Both same-owner continuity suites cover no prior sheets, one prior sheet,
  multiple prior sheets, discarded/unavailable sheets, and a prior output from
  an earlier spec/run.
- Dynamic Scene/Take tests prove one slot per unique subject and all owned
  candidates are present.
- Guide tests prove there are no saved/default selections in the guide.
- Spec tests prove optional empty slots, exact candidate membership, one choice
  per slot, additional references, and fail-before-write behavior.
- Opaque-artifact tests prove no creative text/image parsing or ranking.

### Preview/UI tests

- Projection tests reject local paths/provider URLs and expose all safe
  alternatives.
- Projection tests omit empty first-instance slots and preserve empty slots in
  agent context. Existing validation tests cover invalid saved references.
- Core mutation tests prove replace, clear, select-from-empty, stale candidate,
  wrong subject, and provider-binding failure behavior.
- Preview tests prove changes persist to the same spec and survive close/reopen
  and multi-request navigation.
- Desktop tests prove the current card opens one shared picker, all alternatives
  and None are visible, and meaningful labels replace numbered Sheet labels.
- Shared component tests prove Shot Take and Preview map to the same picker
  without cross-feature imports.

### Take media/export tests

- Database and command tests prove one image per Take role and one final video.
- Attachment tests fail with structured codes before duplicate writes.
- Multi-Shot Take tests prove all Shots author one request and do not create
  Shot-owned output rows.
- Produced-Take edit tests prove a new Take is required/created.
- Export tests include only picked Take video and its exact included Dialogue
  Audio Takes, prune stale exports, and exclude every non-audio/video category.

### Architecture guardrails

- Use import-boundary/runtime behavior tests, not source needles for private
  function names.
- Protect UI/server from database imports and provider-binding decisions.
- Protect purpose modules from direct relationship-table queries.
- Scan current runtime for generic asset selection fields/commands, excluding
  historical migrations and plans.

## Documentation

- Add ADR 0049.
- Update assets, domain vocabulary, generation specs, Preview, Shot Video Take,
  production export, CLI, server routes, and Studio Skills references.
- Update Plan 0139's status or link it to this accepted implementation plan;
  retain its raw product notes.
- Record migration and realistic workflow evidence in this plan.
- Do not edit historical plans to erase old terminology.

## Final Verification

Run focused package/suite tests throughout, then:

```bash
pnpm check
pnpm build
pnpm test
pnpm lint
```

Also:

- validate every changed Studio Skill and run fresh-agent forward tests;
- back up and migrate `urban-basilica` with Studio stopped;
- run SQLite foreign-key check and quick check;
- inspect the three Mehmed II alternatives and verify the palace spec/Preview
  override flow on desktop;
- create a multi-Shot Take and verify one First Frame, Last Frame, Video Prompt,
  and final video owner identity without paid generation where simulation is
  available;
- dry-run production export and verify only picked video/dialogue audio rows;
- inspect `git diff --stat` and complete diffs in both repositories;
- inspect all large/heavily modified files and every `index.ts` touched;
- confirm no checklist item was met by moving all behavior into a monolith.

## Implementation Evidence

Completed on 2026-07-14.

- Migration 0057 was generated through Drizzle Kit, tested against a copy of
  the real database, and then applied to `urban-basilica`. The automatic backup
  is
  `project-database-backups/project-before-migration-from-generation-44-to-44-20260714T180955652Z-d20f65.sqlite`.
  SQLite `foreign_key_check` returned no rows and `quick_check` returned `ok`.
  Five Cast Profile display choices and two Location Hero display choices were
  preserved; duplicate Take-purpose specs and legacy `video-prompt-sheet`
  placements are both zero after migration.
- Core behavior tests cover focused display validation, ready/unavailable and
  empty/multiple same-owner candidates, exact Preview replace/clear behavior,
  Take media/spec cardinality and immutable authoring, and the narrowed
  production export. The export test is a no-provider dry run and proves that
  only the picked final video and exact included Dialogue Audio Take are
  planned.
- Studio integration tests exercise saved prompt/reference edits on the same
  spec, exact Location Sheet choose/clear behavior, the shared picker, and
  model estimation. The Chromium desktop compatibility suite passes both
  locked tests after visual inspection of the intentional display and estimate
  changes.
- `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm lint` pass. Package totals
  include Core 194, CLI 34, Engines 707 passed with 12 todo, and Studio 268.
  Lint reports only the existing non-failing `console` warning in
  `packages/studio/server/bin.ts`.
- All five changed Studio skills pass `quick_validate.py`. A fresh-agent
  Mehmed II palace forward test inspected the available alternatives, chose the
  palace Character Sheet plus Production Lookbook Sheet explicitly, rejected
  automatic/default selection, preserved exact slot placements and provider
  fields, and described the saved-spec Preview replace/None workflow.
- Final scans found no current runtime or current-skill generic origin
  selection contract. References that remain in generated migration history
  and migration regression fixtures describe one-way historical transforms,
  not accepted runtime compatibility.
- The final diff audit found no new monolith: the largest materially changed
  production modules remain focused, new slot logic is split among the three
  planned domain modules, and touched `index.ts` files remain thin public
  entrypoints.

## Completion Checklist

### Review Area

- [x] Confirm all reference choices are request/spec scoped.
- [x] Confirm creative suitability remains agent/user owned.
- [x] Confirm the purpose/slot matrix is implemented without special-case UI.
- [x] Confirm existing guide, Preview update, Preview reference, Shot Take
      binding, and picker architecture was reused before adding new contracts.
- [x] Confirm the final code shape matches the Architecture Shape Gate.
- [x] Confirm no broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Add and accept ADR 0049.
- [x] Remove guide selections and generic origin selection contracts.
- [x] Add focused slot declarations and the minimal grouped Preview reference
      resource without mirroring the full guide/catalog hierarchy.
- [x] Extend the existing Preview update with one replace/clear change union;
      do not add separate public commands.
- [x] Keep new public contracts within the Reuse Budget; revise the plan before
      adding another type family, facade, registry, or workflow domain.
- [x] Keep provider binding and durable validation in Core.
- [x] Keep additional references universal and opaque.
- [x] Add the three direct Take image purpose keys with no aliases.
- [x] Keep package-boundary diagnostics structured.

### Origin Selection And Display Choices

- [x] Remove `selection`/`selectionOrder` from all generic relationship schemas.
- [x] Remove `AssetSelection` and `Asset.selection` from public contracts.
- [x] Delete generic Core selection commands/services.
- [x] Delete generic CLI actions, HTTP routes, UI controls, ordering, and tests.
- [x] Remove selected-sheet Director readiness.
- [x] Add focused Cast Profile display persistence/commands/UI.
- [x] Add focused Location Hero display persistence/commands/UI.
- [x] Prove display choices do not affect generation or export.

### Purpose Slots And Specs

- [x] Add the three cohesive reference-slot domain modules.
- [x] Keep guide assembly generic and selection-free.
- [x] Add meaningful safe candidate presentation metadata.
- [x] Implement every purpose/slot matrix row.
- [x] Give `cast.character-sheet` an optional same-Cast Character Sheet
      continuity slot as well as its Production Lookbook Sheet slot.
- [x] Give `location.sheet` an optional same-Location Location Sheet continuity
      slot as well as its Production Lookbook Sheet slot.
- [x] Expose every current ready same-owner sheet candidate without choosing a
      default and keep the slot valid when there are no candidates.
- [x] Derive dynamic Cast/Location slots from target facts.
- [x] Use Production sheets only for production-oriented slots.
- [x] Use Storyboard sheets only for Scene Storyboard slots.
- [x] Validate exact candidate membership and cardinality before writes.
- [x] Preserve empty slots in agent context, omit them from Preview when there
      are no candidates/saved choices, and support arbitrary additional
      references.
- [x] Remove first-candidate initialization and origin-selected reads.

### Preview And Shared Picker

- [x] Require saved specs for editable Preview.
- [x] Project every slot candidate and the current spec choice safely.
- [x] Omit truly empty slots from the References UI without adding a separate
      stale-reference UI model.
- [x] Implement replace/clear through the existing Preview update and shared
      provider-binding behavior.
- [x] Extract the existing Shot reference picker into a shared feature.
- [x] Reuse it from Shot Take and Preview without domain coupling.
- [x] Show meaningful candidate names, all alternatives, current choice, and
      None.
- [x] Persist prompt and reference edits to the same spec.
- [x] Preserve existing multi-request Preview navigation.
- [x] Use local shadcn controls only.

### Take-Owned Media Purposes

- [x] Add `shot.first-frame`, `shot.last-frame`, and `shot.video-prompt`.
- [x] Apply exactly the accepted setting/model recommendations.
- [x] Add `scene_shot_video_take_image` with unique Take/role ownership.
- [x] Attach each purpose only to its matching Take role.
- [x] Keep exactly one final video per Take with structured duplicate errors.
- [x] Enforce one current spec per Take-owned purpose.
- [x] Remove Shot-scoped owned-output identity.
- [x] Enforce new-Take behavior after generated media exists.

### Production Export

- [x] Remove generic selected-relationship export reads and vocabulary.
- [x] Export the one video for each picked Shot Video Take.
- [x] Export exact included Dialogue Audio Takes for those picked Takes.
- [x] Exclude storyboard, Lookbook, design, display, frame, and prompt media.
- [x] Preserve incremental copy/prune/manifest behavior for the narrowed rows.
- [x] Add structured diagnostics for invalid export state.

### Migration

- [x] Audit current real data before designing SQL.
- [x] Update Drizzle schema source of truth and generate through Drizzle Kit.
- [x] Document intentional custom migration logic.
- [x] Migrate only explicit Profile/Hero display selections.
- [x] Fail ambiguous duplicate Take media/spec state rather than choosing.
- [x] Rewrite only owned generation envelope fields, never prompts/artifacts.
- [x] Back up, migrate, and integrity-check `urban-basilica`.

### Agent Skills

- [x] Remove selected-origin sheet discovery from every current skill.
- [x] Teach Media Producer to inspect all candidates and author its exact choice
      into the saved spec.
- [x] Teach Character Sheet and Location Sheet workflows to consider prior
      same-owner sheets for continuity without requiring one.
- [x] Update all purpose references and the three new image purposes.
- [x] Verify the Mehmed II palace choice and Preview alternatives workflow.
- [x] Validate skills and run fresh-agent forward tests.

### Tests And Guardrails

- [x] Add origin removal and focused display behavior tests.
- [x] Add every purpose matrix context/spec test.
- [x] Cover empty, single, multiple, unavailable, and prior-run same-owner
      continuity candidates for Character Sheet and Location Sheet purposes.
- [x] Add Preview projection/mutation/shared-picker desktop tests.
- [x] Add Take cardinality/immutability/attachment tests.
- [x] Add focused production export tests.
- [x] Add stable architecture/import/runtime guardrails without private-name
      inventories.
- [x] Run the current-code forbidden-concept scans.

### Documentation

- [x] Update current architecture, CLI, server, UI, and Skills documentation.
- [x] Link Plan 0139 to the implemented direction.
- [x] Record real-project migration and workflow evidence.
- [x] Do not edit historical plans merely for terminology cleanup.

### Final Verification

- [x] Run focused Core, CLI, Engines, and Studio tests.
- [x] Run `pnpm check`, `pnpm build`, `pnpm test`, and `pnpm lint`.
- [x] Verify the full saved-spec picker flow on desktop.
- [x] Verify Take-owned media cardinality and production export dry run.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect large/heavily modified files and split unreviewable code.
- [x] Confirm all `index.ts` files remain thin entrypoints.
- [x] Confirm no checklist item was satisfied by accepting a monolithic shape.
- [x] Only then mark Plan 0142 complete.
