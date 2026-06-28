# 0091 Uniform Take Reference Sheet Selection

Status: implemented
Date: 2026-06-28

## Summary

Shot Video Take reference selection needs one product rule and one dependency
identity model for both Character Sheets and Location Sheets.

The product rule is:

- for each editor direction in a take, a visible Cast Member should have
  exactly one selected Character Sheet unless the reference is explicitly
  excluded;
- for each editor direction in a take, a referenced Location should have
  exactly one selected Location Sheet unless the reference is explicitly
  excluded;
- the selected sheet can differ by take and, in `multi-cut` mode, by shot
  direction;
- the director or agent chooses the sheet that fits the scene context, such as
  a battlefield costume sheet versus a palace costume sheet for the same Cast
  Member;
- available sheets are choices, not hidden defaults;
- final shot-video generation uses the selected concrete sheet assets after
  applying editor-direction inclusion state and aggregating the generation
  direction set.

The implementation currently violates that rule in two ways:

- Character Sheets and Location Sheets use different state shapes and default
  behavior.
- selected Character Sheet dependency slots can use asset-scoped dependency
  ids while reference cards still emit cast-scoped dependency ids.

This plan fixes the architecture rather than patching the symptoms.

The proposed ADR is:

- `docs/decisions/0039-use-uniform-shot-video-take-sheet-reference-selection.md`

If accepted, this plan should update the current architecture references:

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/shot-video-take-structure-modes.md`
- `docs/architecture/README.md`

## Product Behavior

### One Sheet Per Subject Per Editor Direction

A Shot Video Take direction chooses sheet references for the current authored
direction.

In `continuous` mode, there is one shared direction. A Cast Member or Location
therefore has one selected sheet for the whole continuous generated move.

In `multi-cut` mode, each grouped shot has its own direction. The same Cast
Member or Location can use one sheet in `shot_001` and another sheet in
`shot_002`.

Examples:

- Urban appears in a battlefield shot. The selected Character Sheet is his
  battle armor sheet.
- Urban appears in a palace shot. The selected Character Sheet is his palace
  costume sheet.
- Theodosian Walls appears in a siege-facing shot. The selected Location Sheet
  is a field-facing siege sheet.
- Theodosian Walls appears in a night repair shot. The selected Location Sheet
  is a torch-lit wall-top repair sheet.

Those are not Cast-level or Location-level picks. They are take-direction
authoring choices.

### No Hidden First-Asset Defaults

Core must not silently treat the first available sheet as selected for
shot-video generation.

Available sheets are options. The agent may propose one by writing the normal
core selection. The user may choose one in Studio. Once chosen, the selection is
durable take-direction state.

If a visible Cast Member or referenced Location has available sheets but no
selected sheet, the inventory should report a missing selection, not quietly use
the first asset.

If no sheet exists, the inventory should expose the missing generated
dependency or missing required input so the user or agent can generate, import,
or deliberately exclude the reference.

### Generation Aggregates Selected Assets

Generation planning works across the generation direction set defined by ADR
0038.

Rules:

- resolve each editor direction's selected sheets first;
- apply that direction's inclusion and exclusion state before whole-take
  aggregation;
- collect the selected concrete sheet assets that remain included;
- de-duplicate identical asset ids across the take;
- produce one dependency inventory line per concrete selected asset;
- keep missing sheet selections visible as missing required dependencies.

This allows a multi-cut take to include two different Character Sheets for the
same Cast Member when two shots need different costumes, while still de-duping
when multiple directions use the same sheet.

## Current Problems

### Character Sheet Dependencies Use Two Identities

`castCharacterSheetDependencySlot` accepts an optional `assetId` and builds an
asset-scoped dependency id when it is provided:

```text
cast-character-sheet:<cast-member-id>:<asset-id>
```

Shot-video dependency declaration now passes selected Character Sheet asset ids
into that slot.

But the reference editor still builds selected Character Sheet cards with:

```text
cast-character-sheet:<cast-member-id>
```

That breaks the core contract. The dependency inventory contains one id, the
editor card emits another id, and inclusion mutations correctly reject the
editor id as unknown.

### Locations And Characters Do Not Share A State Model

Character Sheets are stored as one selected asset id per Cast Member in
`SceneShotVideoTakeReferenceSelections`:

```ts
selectedCharacterSheetAssetIds: Record<string, string>;
```

Location Sheets are currently stored as an array:

```ts
referencedLocationSheetAssetIds: Record<string, string[]>;
```

That difference no longer matches the product rule. Both surfaces should mean:

```text
for this direction, this subject uses this one sheet
```

The generation planner may still aggregate to arrays after reading all
generation directions, but the durable editor-direction selection should be
singular.

### Existing Default Policy Is Too Implicit

`castCharacterSheetDependencySlot` currently chooses
`selected-or-default` when no `assetId` is provided. Location Sheets use a more
explicit selected-asset model.

For shot-video take references, `selected-or-default` is the wrong default. A
silent first sheet makes generation depend on an asset the director or agent did
not actually select for this scene.

Any fallback behavior must be an explicit product decision for a specific
purpose. It should not be baked into the shared Character Sheet slot helper.

## Architecture Options

### Option A: Singular Direction Selection Plus Asset-Scoped Dependencies

This is the recommended option.

Durable take-direction state stores singular selections for both subject types:

```ts
interface SceneShotVideoTakeReferenceSelections {
  dependencyInclusions: Record<string, "include" | "exclude">;
  selectedCharacterSheetAssetIds: Record<string, string>;
  selectedLocationSheetAssetIds: Record<string, string>;
  selectedLookbookSheetIds: string[];
  selectedDialogueAudioTakeIds: Record<string, string>;
}
```

Concrete selected sheet dependencies use asset-scoped ids:

```text
cast-character-sheet:<cast-member-id>:<asset-id>
location-environment-sheet:<location-id>:<asset-id>
```

Missing required sheet selections use owner-scoped placeholder ids only until a
concrete sheet is selected:

```text
cast-character-sheet:<cast-member-id>
location-environment-sheet:<location-id>
```

Core reference cards use the same dependency id as the inventory line. Studio
never builds or rewrites these ids.

Benefits:

- matches current Location Sheet asset-scoped dependency direction;
- makes Character Sheets and Location Sheets symmetrical;
- supports different sheets for the same subject across multi-cut directions;
- de-dupes the same selected asset across the generation direction set;
- keeps existing dependency inventory concepts intact;
- fixes the current review bug by aligning inventory ids and card ids.

Costs:

- location reference state changes from plural `referenced` arrays to singular
  `selected` records;
- inclusion aggregation must be direction-aware before de-duping selected
  assets;
- tests and fixtures must be updated directly to the new state shape;
- the parser for dependency ids must stop silently discarding asset scope.

### Option B: Direction-Scoped Dependency Slots

This option gives every required sheet reference a stable direction-scoped
dependency id, and stores the selected asset inside the selector:

```text
cast-character-sheet:<take-id>:<direction-scope-id>:<cast-member-id>
location-environment-sheet:<take-id>:<direction-scope-id>:<location-id>
```

Benefits:

- inclusion overrides remain stable when the selected asset changes;
- the dependency identity reads as "this direction needs this subject's sheet";
- missing and selected states use the same dependency id.

Costs:

- changes the existing Location Sheet dependency id model;
- duplicates dependency lines when two directions use the same asset;
- makes dependency ids depend on take structure scope instead of concrete
  media;
- requires broader inventory and provider-input de-duplication work;
- partially supersedes the Location Sheet ADR consequence that dependency ids
  include the sheet asset id.

This option is architecturally valid, but larger than the product need and less
aligned with the current inventory model.

### Option C: Generic Reference Sheet Abstraction

This option would introduce a single generic reference-sheet dependency kind
for both Cast Members and Locations.

Example:

```text
reference-sheet:<subject-kind>:<subject-id>:<asset-id>
```

This is not recommended.

Costs:

- erases useful domain vocabulary;
- makes purpose-specific generation and import behavior harder to review;
- weakens the current distinction between Character Sheets and Location Sheets;
- creates a generic abstraction before there is enough duplication to justify
  it.

## Recommended Decision

Use Option A.

The current domain vocabulary should remain:

- Character Sheet for Cast Member production reference assets;
- Location Sheet for Location production reference assets;
- selected Character Sheet asset id for a Cast Member in a take direction;
- selected Location Sheet asset id for a Location in a take direction;
- asset-scoped dependency ids for selected concrete sheets.

The important architecture rule is:

> Editor direction state is singular. Generation inventory input is aggregated.

That gives users and agents the right authoring model without making the
dependency inventory pretend a Cast Member or Location can only ever have one
useful sheet.

## Target Core Contract

### Direction State

Update `SceneShotVideoTakeReferenceSelections` so Character Sheets and Location
Sheets are symmetrical.

Proposed shape:

```ts
interface SceneShotVideoTakeReferenceSelections {
  dependencyInclusions: Record<string, "include" | "exclude">;
  selectedCharacterSheetAssetIds: Record<string, string>;
  selectedLocationSheetAssetIds: Record<string, string>;
  selectedLookbookSheetIds: string[];
  selectedDialogueAudioTakeIds: Record<string, string>;
}
```

Remove the plural `referencedLocationSheetAssetIds` field from current runtime
code, schemas, fixtures, and tests. If development databases need repair, use a
one-way migration to convert existing arrays to the selected single asset id
according to the accepted migration rule.

### Mutation Commands

Character and Location sheet selection mutations should have matching command
contracts:

```ts
updateSceneShotVideoTakeCharacterSheetSelection({
  sceneId,
  takeId,
  shotId,
  castMemberId,
  assetId,
});

updateSceneShotVideoTakeLocationSheetSelection({
  sceneId,
  takeId,
  shotId,
  locationId,
  assetId,
});
```

Both commands must:

- resolve the core mutation direction scope;
- assert the Cast Member or Location belongs to the scene reference scope;
- assert the asset belongs to that Cast Member or Location with the expected
  role and media kind;
- write the singular selected asset id;
- clear the selection when `assetId` is `null`;
- leave final generation blocked until a required visible/reference subject has
  a selected sheet or is explicitly excluded.

Studio server routes stay thin. React components call the server with user
intent and render the core projection.

### Dependency Slot Declaration

Separate editor-direction selected state from generation aggregated state.

The generation slot declaration input should use names that make aggregation
visible, for example:

```ts
selectedCharacterSheetAssetIdsByCastMember: Record<string, string[]>;
selectedLocationSheetAssetIdsByLocation: Record<string, string[]>;
```

Those arrays are not durable editor state. They are the result of reading the
generation direction set and collecting selected sheets after inclusion rules.

For each selected asset id, declare one selected-only asset-scoped slot:

```text
cast-character-sheet:<cast-member-id>:<asset-id>
location-environment-sheet:<location-id>:<asset-id>
```

If a visible Cast Member or referenced Location has no selected sheet and has
not been explicitly excluded, declare a missing required owner-scoped slot:

```text
cast-character-sheet:<cast-member-id>
location-environment-sheet:<location-id>
```

Do not omit the dependency merely because available assets exist. Available
assets mean the user or agent can satisfy the missing selection; they are not
the selected input.

### Selection Policies

Shared slot builders should not infer `selected-or-default` from the absence of
an asset id.

Preferred shape:

```ts
castCharacterSheetDependencySlot({
  castMemberId,
  castMemberName,
  assetId,
  selectionPolicy: "selected-only",
});
```

and similarly for Location Sheets.

If another purpose, such as `cast.profile`, deliberately wants a
purpose-owned default, that purpose should request `selected-or-default`
explicitly and tests should explain why that fallback is valid for that
purpose. Shot-video take references should use selected-only semantics.

### Dependency Identity Parsing

Dependency id parsing must represent the asset scope when present.

Current parsing recognizes:

```text
cast-character-sheet:<cast-member-id>:<asset-id>
```

but returns only the Cast Member subject. That is no longer acceptable once
asset-scoped Character Sheet ids are a first-class dependency identity.

The parser should either:

- return the parsed asset id in a clearly named field; or
- stop using the shot-video-input parser for asset-scoped Character Sheet and
  Location Sheet dependencies where the caller does not need that shape.

It must not silently discard meaningful identity.

### Inclusion Semantics

Inclusion state remains direction-scoped because it is stored inside
`SceneShotVideoTakeDirection`.

Generation planning should apply inclusion before aggregation:

1. Resolve each generation direction.
2. For each visible Cast Member and referenced Location, resolve the selected
   sheet for that direction.
3. Resolve that direction's inclusion override for the selected or missing
   dependency id.
4. Drop excluded references for that direction.
5. Aggregate and de-dupe the included selected asset ids for the whole take.

Do not use a whole-take "any exclude wins" rule for selected sheets. That rule
is too blunt once the same asset may appear in multiple directions with
different editor intent.

## Implementation Slices

### Slice 1: Architecture And Contract Names

- Add the proposed ADR.
- Keep the current architecture references unchanged until the ADR is accepted.
- Use the plan to review public names before implementation.
- Confirm whether the final accepted field should be
  `selectedLocationSheetAssetIds` or a more explicit
  `selectedLocationSheetAssetIdsByLocation`. The public contract should choose
  one name and update callers directly.

### Slice 2: Core State And Schemas

- Update `SceneShotVideoTakeReferenceSelections`.
- Update JSON Schemas for scene shot list / take state.
- Update take-state initialization.
- Update one-way development database migration if existing development data
  must be preserved.
- Remove runtime use of `referencedLocationSheetAssetIds`.

### Slice 3: Core Reference Selection Helpers

- Rename editor helpers to make singular direction state explicit.
- Add matching Character Sheet and Location Sheet editor helpers.
- Add generation helpers that aggregate selected sheets into arrays only after
  reading the generation direction set.
- Remove vague helper names that hide editor versus generation scope.

### Slice 4: Dependency Slot Declarations

- Make Character Sheet and Location Sheet slot declaration inputs symmetrical.
- Require callers to provide the selected-sheet aggregation records.
- Update every caller directly instead of adding optional fallback behavior.
- Declare selected concrete sheet dependencies with asset-scoped ids.
- Declare missing required sheet dependencies when no selected sheet exists.
- Ensure available-but-unselected assets do not satisfy the dependency.

### Slice 5: Dependency Selectors And Availability

- Make selection policy explicit in slot builder inputs.
- Remove implicit `selected-or-default` behavior from shot-video take
  Character Sheet dependencies.
- Add or reuse a dependency availability state for "selection required" when
  available assets exist but no sheet was selected.
- Keep generated-missing behavior for cases where no suitable sheet asset
  exists and the purpose can generate one.
- Return structured diagnostics for stale selected assets, unavailable assets,
  missing primary image files, and ambiguous selected state.

### Slice 6: Reference Sections And Cards

- Build Character Sheet cards the same way Location Sheet cards are built.
- Compute the dependency id per concrete asset choice.
- Look up the dependency line by that same id.
- Compute inclusion by that same id and the resolved editor direction.
- Use owner-scoped placeholder dependency ids only for missing selection cards.
- Remove hidden first-asset selected/default card behavior from shot-video
  references.

### Slice 7: Mutations And Service Contracts

- Make Character Sheet and Location Sheet selection mutation contracts
  symmetrical.
- Change Location Sheet mutation input from `assetIds` to singular `assetId`.
- Update Studio server request parsing without adding server-side business
  rules.
- Ensure mutation validation stays in core.
- Clean stale dependency inclusion overrides only through focused core behavior
  if selection changes make a previous concrete dependency id impossible to
  reach.

### Slice 8: Studio UI

- Render Character Sheet and Location Sheet choices as single-select choices.
- Keep visual cards quiet when no useful domain copy exists.
- Use local shadcn-style controls only.
- Do not use React-local logic to decide dependency identity, requiredness, or
  asset validity.
- Send selected `assetId` or `null` to the server and rely on core projection
  for selected state after refresh.

### Slice 9: CLI And Agent Surfaces

- Update CLI JSON contracts and examples that expose take reference selections.
- Update agent-facing context so Character Sheets and Location Sheets use the
  same selected-sheet language.
- Update Studio skill guidance in the sister `studio-skills` project if the
  authoring contract exposed to agents changes.

### Slice 10: Tests And Verification

- Add core unit tests for singular direction selections.
- Add core integration tests for selected Character Sheet dependency ids.
- Add matching tests for selected Location Sheet dependency ids.
- Add multi-cut tests where the same Cast Member uses different Character
  Sheets in different shot directions.
- Add multi-cut tests where the same Location uses different Location Sheets in
  different shot directions.
- Add inclusion mutation tests for asset-scoped selected dependencies.
- Add tests proving available-but-unselected sheets do not satisfy required
  dependencies.
- Update Studio service and component tests to expect singular Location Sheet
  selection.

## Migration Direction

Renku Studio is pre-customer software, so runtime compatibility readers are not
allowed.

If existing development databases need repair, add a one-way migration that
converts current Location Sheet arrays to singular selections.

Suggested one-way rule:

- if a Location has an array with exactly one asset id, store that id as the
  selected Location Sheet;
- if a Location has an empty array, omit the selection;
- if a Location has multiple asset ids, either:
  - fail migration with a structured diagnostic and ask for a manual choice; or
  - choose the first id only if that is explicitly accepted as development-data
    repair behavior before implementation.

The safer architectural choice is to fail on multiple ids because the new model
requires a director choice, and migration code should not invent one.

## Documentation Changes To Make After Acceptance

### `docs/architecture/shot-video-take-structure-modes.md`

Update `Reference Consistency` and `Reference Projection Scope` to say:

- selected Character Sheets and selected Location Sheets are singular per
  editor direction;
- available sheets are choices, not defaults;
- generation aggregates selected sheets after applying direction-scoped
  inclusion state.

### `docs/architecture/media-generation.md`

Update dependency identity language to say:

- selected concrete Character Sheet and Location Sheet dependencies use
  asset-scoped ids;
- owner-scoped ids represent missing required sheet selections;
- shot-video take references use selected-only sheet semantics.

### `docs/architecture/reference/media-generation.md`

Update the exact contract reference for:

- `SceneShotVideoTakeReferenceSelections`;
- dependency selector policy;
- Character Sheet and Location Sheet dependency ids;
- generation aggregation behavior.

### `docs/architecture/data-model-and-storage.md`

Update the Current Decisions section to say:

- Character Sheets and Location Sheets can have many assets per Cast Member or
  Location;
- a Shot Video Take direction stores one selected sheet asset per visible Cast
  Member and referenced Location;
- those selected assets can differ by take and by multi-cut shot direction.

### `docs/decisions/0036-use-unsliced-location-sheets.md`

Do not rewrite the historical ADR. If ADR 0039 is accepted, note that ADR 0039
extends or amends the take-selection consequences of ADR 0036 by making
Location Sheet take references singular per editor direction.

### `docs/architecture/README.md`

Add ADR 0039 to the related ADRs only after acceptance.

## Completion Checklist

### Review And Architecture

- [x] Review this plan with the product rule that Character Sheets and Location
  Sheets must use the same take-reference model.
- [x] Choose between Option A and Option B before implementation.
- [x] If Option A is accepted, confirm asset-scoped selected dependency ids and
  owner-scoped missing placeholder ids.
- [x] If Option B is accepted, revise this plan before implementation because
  direction-scoped dependency ids change the inventory model more broadly.
- [x] Accept, revise, or reject the proposed ADR.

### Core Contracts

- [x] Update `SceneShotVideoTakeReferenceSelections` to use singular
  Character Sheet and Location Sheet selected asset records.
- [x] Update browser-safe client contracts.
- [x] Update JSON Schemas.
- [x] Update take-state creation and normalization paths.
- [x] Remove runtime use of obsolete plural Location Sheet reference fields.
- [x] Update migration or development-data repair for current databases.

### Core Reference Scopes

- [x] Add or update editor-direction helpers for selected Character Sheet and
  selected Location Sheet asset ids.
- [x] Add or update generation-direction helpers that aggregate selected sheet
  ids after inclusion state is resolved.
- [x] Remove or rename helpers whose names hide editor-versus-generation scope.
- [x] Ensure continuous and multi-cut mode behavior follows ADR 0038.

### Dependency Inventory

- [x] Make Character Sheet and Location Sheet slot declaration inputs
  symmetrical.
- [x] Require selected-sheet aggregation records at every slot declaration
  call site.
- [x] Remove implicit defaulting from shot-video take sheet dependencies.
- [x] Ensure selected concrete sheet dependencies use asset-scoped ids.
- [x] Ensure missing required sheet selections produce visible missing
  owner-scoped dependencies.
- [x] Ensure available-but-unselected sheets do not satisfy dependencies.
- [x] Update dependency id parsing so asset scope is not discarded.
- [x] Update duplicate dependency handling tests for same asset selected in
  multiple generation directions.

### Mutation Boundaries

- [x] Make Location Sheet selection mutation singular.
- [x] Keep Character Sheet and Location Sheet validation in core.
- [x] Ensure Studio server routes remain thin.
- [x] Ensure React sends user intent and consumes refreshed core projections.
- [x] Add structured diagnostics for invalid selected assets and missing
  required selections where needed.

### Studio UI

- [x] Update Character Sheet and Location Sheet cards to use the same
  single-select interaction model.
- [x] Use local shadcn-style controls only.
- [x] Remove hidden first-sheet default selected state from shot-video
  references.
- [x] Ensure card dependency ids come from core projections.
- [x] Verify desktop behavior only unless mobile support is explicitly
  requested.

### CLI, Agents, And Skills

- [x] Update CLI JSON examples and tests for singular Location Sheet
  selections.
- [x] Update agent context output to expose available sheets and selected sheet
  consistently for Character Sheets and Location Sheets.
- [x] Check `$HOME/Projects/aitinkerbox/studio-skills/` for skill guidance that
  describes Location Sheet arrays or implicit defaults.
- [x] Update affected skill guidance in the sister project if the contract
  changes.

### Tests

- [x] Add core tests for selected Character Sheet asset-scoped dependency ids.
- [x] Add core tests for selected Location Sheet asset-scoped dependency ids.
- [x] Add tests for missing sheet selection with available assets.
- [x] Add tests for missing sheet selection with no assets.
- [x] Add tests for multi-cut directions selecting different sheets for the
  same Cast Member.
- [x] Add tests for multi-cut directions selecting different sheets for the
  same Location.
- [x] Add inclusion mutation tests that use selected asset-scoped dependency
  ids.
- [x] Update Studio service tests for singular Location Sheet selection.
- [x] Update component tests for single-select Location Sheet UI behavior.

### Documentation And Final Verification

- [x] Update current architecture references after ADR acceptance.
- [x] Add ADR 0039 to `docs/architecture/README.md` after acceptance.
- [x] Run focused core tests.
- [x] Run focused Studio tests for reference selection UI/service behavior.
- [x] Run `pnpm test` if the implementation touches shared contracts broadly.
- [x] Confirm no compatibility aliases, old runtime readers, or route-local
  business rules were added.
