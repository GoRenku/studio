# 0039 Use Uniform Shot Video Take Sheet Reference Selection

Date: 2026-06-28

Status: accepted

## Context

Shot Video Take references currently treat Character Sheets and Location Sheets
as similar product concepts but different architecture concepts.

The intended product behavior is the same for both:

- a Cast Member can have many Character Sheets;
- a Location can have many Location Sheets;
- a Shot Video Take direction chooses the one sheet that is appropriate for
  that Cast Member or Location in that authored scene context;
- a different take, or a different shot direction in a `multi-cut` take, may
  choose a different sheet for the same Cast Member or Location;
- the selected sheet is a director or agent decision, not a hidden first-asset
  default.

Concrete examples:

- the same Cast Member may use a battlefield costume Character Sheet in one
  shot and a palace costume Character Sheet in another;
- the same Location may use a siege-facing Location Sheet in one shot and a
  night repair Location Sheet in another.

Current code does not fully model that rule.

Character Sheet take state is singular, while Location Sheet take state is
plural. Character Sheet dependency slots can produce selected asset-scoped ids
such as:

```text
cast-character-sheet:<cast-member-id>:<asset-id>
```

but selected Character Sheet reference cards can still emit the cast-scoped id:

```text
cast-character-sheet:<cast-member-id>
```

That breaks the dependency inventory contract. Inclusion mutations validate the
requested dependency id against the core-generated inventory, so a selected
card that uses a different id is correctly rejected as an unknown dependency.

Location Sheets already moved toward exact asset references in ADR 0036. This
decision proposes extending the same take-reference model to Character Sheets
and making the editor-direction selection cardinality explicit for both.

Related decisions:

- `0036-use-unsliced-location-sheets.md`
- `0038-use-scoped-shot-video-take-reference-projections.md`

Related plan:

- `plans/active/0091-uniform-take-reference-sheet-selection.md`

## Decision

Shot Video Take sheet references use one uniform model for Character Sheets and
Location Sheets.

### Direction State Is Singular

Each `SceneShotVideoTakeDirection` stores at most one selected sheet asset id
for each subject:

```ts
interface SceneShotVideoTakeReferenceSelections {
  dependencyInclusions: Record<string, "include" | "exclude">;
  selectedCharacterSheetAssetIds: Record<string, string>;
  selectedLocationSheetAssetIds: Record<string, string>;
  selectedLookbookSheetIds: string[];
  selectedDialogueAudioTakeIds: Record<string, string>;
}
```

The selected asset id is scoped to the direction that owns the reference
selection.

In `continuous` mode, the shared direction owns the selected sheets for the
whole continuous take.

In `multi-cut` mode, each shot direction owns its own selected sheets. The same
Cast Member or Location may therefore use different sheets in different shot
directions.

### Available Sheets Are Choices, Not Defaults

Core must not silently use the first available Character Sheet or Location
Sheet as a shot-video generation input.

The agent may propose a sheet by writing the normal selected asset id. The user
may choose a sheet in Studio. Until that selection is persisted, the dependency
is not satisfied.

If no selected sheet exists for a required visible Cast Member or referenced
Location, the dependency inventory should report a missing required sheet
selection. If suitable sheets exist, the user or agent can select one. If no
suitable sheet exists, the user or agent can generate or import one.

### Concrete Selected Dependencies Are Asset-Scoped

Selected concrete Character Sheet and Location Sheet dependencies use
asset-scoped dependency ids:

```text
cast-character-sheet:<cast-member-id>:<asset-id>
location-environment-sheet:<location-id>:<asset-id>
```

Reference cards, dependency inventory lines, inclusion mutations, preflight,
and provider payload preparation must use the same core-owned dependency id.

Studio UI code must not hand-build or reinterpret dependency id strings.

### Missing Sheet Dependencies Are Owner-Scoped

When a required Cast Member or Location has no selected sheet for the current
direction, the dependency inventory may use an owner-scoped placeholder id:

```text
cast-character-sheet:<cast-member-id>
location-environment-sheet:<location-id>
```

Those ids represent the missing selection requirement, not a concrete selected
asset. Once a sheet is selected, the concrete asset-scoped id becomes the
selected dependency identity.

### Generation Aggregates After Direction Resolution

Generation reads the generation direction set defined by ADR 0038.

The planner must:

1. resolve each generation direction;
2. read that direction's selected Character Sheet and Location Sheet assets;
3. apply that direction's inclusion state;
4. drop excluded sheet references for that direction;
5. aggregate included selected assets across the take;
6. de-duplicate repeated asset ids.

Whole-take aggregation must not treat "one direction excluded this dependency"
as "the asset is excluded from every direction" when another direction still
selects and includes the same asset.

### Slot Builders Require Explicit Selection Policy

Character Sheet and Location Sheet dependency slot builders should not infer
defaulting behavior from whether an asset id is present.

Shot-video take references use selected-only semantics. Other purposes may use
a purpose-owned default only when that fallback is explicitly passed, tested,
and documented for that purpose.

## Consequences

Benefits:

- Character Sheets and Location Sheets follow the same take-reference model.
- The user or agent can choose context-appropriate sheets per take or per
  multi-cut shot direction.
- The dependency inventory, reference cards, and inclusion mutations use the
  same canonical ids.
- Hidden first-asset defaulting no longer changes generation inputs without a
  director or agent choice.
- Multiple directions can select different sheets for the same Cast Member or
  Location, and generation can include each concrete selected asset.

Costs:

- Location Sheet take state changes from plural arrays to singular selected
  asset ids.
- Existing tests and fixtures must be updated directly to the current contract.
- Development databases may need a one-way migration or repair step.
- Dependency id parsing must represent asset scope instead of silently dropping
  it.
- Inclusion aggregation needs to apply per direction before de-duplicating
  selected assets.

## Alternatives Considered

### Direction-Scoped Dependency Ids

One alternative is to key dependencies by take direction and subject:

```text
cast-character-sheet:<take-id>:<direction-scope-id>:<cast-member-id>
location-environment-sheet:<take-id>:<direction-scope-id>:<location-id>
```

This keeps inclusion ids stable when the selected asset changes, but it changes
the current Location Sheet asset-scoped dependency direction, makes dependency
identity depend on take structure scope, and can duplicate dependency lines when
two directions use the same asset.

This remains architecturally valid, but it is a larger change than the product
rule requires.

### Generic Reference Sheet Dependency

Another alternative is to collapse Character Sheets and Location Sheets into a
generic reference-sheet dependency kind.

That is rejected because it erases useful domain vocabulary and weakens
purpose-specific generation, import, validation, and UI behavior.

## Documentation Updates After Acceptance

This ADR updates:

- `docs/architecture/shot-video-take-structure-modes.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/README.md`

ADR 0036 should remain as the accepted decision for unsliced Location Sheets.
ADR 0039 would amend the take-reference cardinality consequence by making
Location Sheet selection singular per editor direction.
