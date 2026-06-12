# 0063 Generation Dependency Inventory Rewrite

Status: proposed
Date: 2026-06-12

## Summary

The current dependency graph architecture is still too complicated for the
product behavior it needs to support.

The product need is simple:

- show which generated or imported references are required before a generation
  can be created;
- show a trustworthy cost estimate for the final generation plus the missing
  generated references;
- tell the agent and user what is missing so they can generate, inspect,
  iterate, import, or select those references deliberately;
- keep the same framework usable by other purposes, such as a character sheet
  that needs a Lookbook sheet.

The product does **not** need an automatic dependency executor. Missing
dependencies are not supposed to run themselves in graph order. Each missing
dependency is a creative artifact that the user or agent must inspect and
possibly regenerate before it becomes a real input.

This plan replaces the current graph implementation with a smaller dependency
inventory architecture. The inventory still supports recursive declarations,
deduplication, deterministic asset resolution, provider-backed estimates, and
reference-card projection. It removes the automatic-execution shape,
callback-heavy resolver contract, and mixed state model that are making
estimate behavior flaky.

This plan should supersede the dependency portions of:

- `plans/active/0061-shot-reference-dependency-estimate-repair-and-coverage.md`
- `plans/active/0062-shot-video-take-core-refactor.md`

`0062` can still be useful later as a file-structure cleanup, but file splitting
must follow the simpler dependency contract, not preserve the current complex
graph under smaller filenames.

## Current Diagnosis

The current implementation couples too many concerns in one shape:

- whether an asset already exists;
- whether a generated dependency can be estimated;
- whether a dependency generation prompt has been authored;
- whether a dependency can be materialized;
- whether the final video can be created;
- whether a dependency should appear in an execution level;
- whether a Reference tab card can show pricing.

That coupling makes the UI look inconsistent. A card may be visible because
shot scope or narrative scope says it should be visible, but the card may not
have a matching graph node. When that happens, the UI falls back to
`not-applicable` pricing, even when the missing dependency should have a normal
provider-backed estimate.

Concrete examples from the current code:

- `packages/core/src/server/media-generation/dependency-graph.ts` resolves
  existing assets, builds draft specs, estimates prices, assigns materialization
  state, collects diagnostics, creates edges, computes final-node readiness, and
  produces execution levels in one resolver.
- `packages/core/src/server/media-generation/dependency-plan-lines.ts` derives
  estimate availability from `node.state === "missing"`, while materialization
  readiness is a separate field. This makes it easy for an implementation detail
  about generation readiness to leak into estimate availability.
- `packages/core/src/server/media-generation/shot-video-take.ts` still builds
  Lookbook, cast, and location Reference tab sections from narrative scope and
  asset lists first, then optionally decorates cards with graph nodes.
- `referenceCardPlan` falls back to:

  ```ts
  { state: 'not-applicable', estimatedUsd: null }
  ```

  whenever a card has no line or node. That makes the UI quiet instead of
  failing a core invariant.
- The current public `MediaGenerationDependencyMap` exposes `execution.levels`
  and `topologicalNodeIds`, even though the product should not automatically
  execute dependencies.

The result is exactly the user-visible failure in the screenshots: some missing
cast or location references show estimates and some do not, even though they
are the same kind of product concept.

## Product Position

Dependencies are a planning and inspection tool, not a job scheduler.

The dependency system should answer these questions:

- What selected inputs does this generation need?
- Which selected inputs already exist?
- Which selected inputs are generated dependencies that can be priced?
- Which selected inputs are manual or invalid and therefore block a trustworthy
  total?
- Which dependency prompts still need to be authored before an agent can create
  a generation spec?
- What should the Reference tab show for every selected reference?
- What total cost should the AI Production tab show before the final video and
  missing references exist?

It should not answer:

- What jobs should automatically run?
- What is the execution level order?
- Can the system recursively create every dependency without user inspection?

The agent can still use the inventory as a checklist. The important distinction
is that checklist ordering is not an execution contract.

## Architecture Advice

Keep a small generalized framework, but do not build a generic workflow engine.

The right level of generalization is:

- each media generation purpose declares dependency slots from a dedicated,
  inspectable slot definition file;
- each dependency kind has one deterministic asset selector;
- each generated dependency kind maps to one purpose that can provide an
  estimate draft;
- the planner can expand dependency declarations recursively and dedupe them;
- the planner can produce inventory lines, estimates, diagnostics, and
  reference projections.

The wrong level of generalization is:

- arbitrary DAG execution;
- graph execution levels;
- automatic dependency materialization;
- callback-driven resolvers where shot video supplies half of the architecture;
- UI-side fallback pricing;
- compatibility aliases for old dependency ids;
- generic wrappers or barrels that hide ownership.

This is generalized enough for:

- `shot.video-take` depending on first frame, last frame, reference images,
  storyboard sheets, cast character sheets, location environment sheets, and
  Lookbook sheets;
- `cast.profile` depending on a cast character sheet;
- `cast.character-sheet` depending on a Lookbook sheet if the product decides
  that the selected Lookbook sheet is a required generated reference;
- future media purposes that need one or more generated or imported references.

It avoids overcomplication by making every dependency a line in an inventory,
not a runnable node in a scheduler.

## Target Contract

Replace the public graph-oriented contract with an inventory-oriented contract.
The names below are the proposed public contract names. If implementation
reveals a materially better domain name, update this plan for review before
using the new public name.

### `MediaGenerationDependencyInventory`

The inventory is the source of truth for dependencies and dependency estimates.

```ts
interface MediaGenerationDependencyInventory {
  rootPurpose: MediaGenerationPurpose;
  rootTarget: MediaGenerationTarget;
  dependencies: MediaGenerationDependencyLine[];
  rootGeneration: MediaGenerationRootGenerationLine;
  estimate: MediaGenerationDependencyInventoryEstimate;
  diagnostics: DiagnosticIssue[];
  agentChecklist: MediaGenerationDependencyChecklistItem[];
}
```

There is no `execution` field.

### `MediaGenerationRootGenerationLine`

The root generation is estimated with the same pricing language as dependency
lines, but it is not a dependency and does not appear in the dependency list.

```ts
interface MediaGenerationRootGenerationLine {
  id: string;
  purpose: MediaGenerationPurpose;
  target: MediaGenerationTarget;
  label: string;
  mediaKind: MediaKind;
  pricing: MediaGenerationDependencyPricing;
  canCreateSpec: boolean;
  blockedReason: string | null;
  estimate: GenerationEstimate | null;
  diagnostics: DiagnosticIssue[];
}
```

Rules:

- root pricing contributes to the inventory total;
- root spec creation is blocked until all required dependencies are satisfied;
- root blocked state does not change dependency line pricing.

### `MediaGenerationDependencyLine`

Each selected or required dependency appears exactly once.

```ts
interface MediaGenerationDependencyLine {
  id: string;
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  purpose: MediaGenerationPurpose | null;
  target: MediaGenerationTarget | null;
  label: string;
  mediaKind: MediaKind;
  required: boolean;
  requiredBy: string[];
  availability: MediaGenerationDependencyAvailability;
  pricing: MediaGenerationDependencyPricing;
  generationDraft: MediaGenerationDependencyGenerationDraft;
  selectedAsset: MediaGenerationDependencySelectedAsset | null;
  diagnostics: DiagnosticIssue[];
}
```

`requiredBy` is explanatory lineage for agents and UI. It is not an execution
edge.

### `MediaGenerationDependencySelectedAsset`

Selected assets are the concrete project files that satisfy a dependency.

```ts
interface MediaGenerationDependencySelectedAsset {
  assetId: string;
  assetFileId: string;
  projectRelativePath: ProjectRelativePath;
}
```

Rules:

- the selector must verify the asset file exists before returning this shape;
- the selector must verify the file has the dependency's required media kind;
- role-specific dependencies, such as location environment sheets, must verify
  the required file role before returning this shape.

### Availability

Availability is about whether a real project asset currently satisfies the
dependency.

```ts
type MediaGenerationDependencyAvailability =
  | { state: 'satisfied' }
  | { state: 'missing-generated' }
  | { state: 'missing-manual' }
  | { state: 'invalid-selection' };
```

Rules:

- `satisfied` means a concrete asset/file exists and pricing is `$0.00`.
- `missing-generated` means a generated dependency is needed and should be
  estimated through its owning purpose.
- `missing-manual` means no generated purpose exists; the user must attach or
  select a real asset.
- `invalid-selection` means the user or data model points at an ambiguous or
  broken asset selection. This must use structured diagnostics.

### Generation Draft State

Generation draft state is about agent/user readiness, not estimate
availability.

```ts
type MediaGenerationDependencyGenerationDraft =
  | { state: 'not-generated' }
  | { state: 'estimate-only'; reason: string }
  | { state: 'authored'; draftGenerationSpec: DraftMediaGenerationSpec }
  | { state: 'blocked'; reason: string };
```

Rules:

- `estimate-only` is valid for pricing but cannot be persisted or run.
- `authored` can be used by the agent to create a real spec after the user
  decides to generate that dependency.
- `blocked` means a generated dependency cannot even produce a valid estimate
  draft because required context is invalid or missing.
- Final/root spec creation remains blocked until all required dependencies are
  `satisfied`.

### Pricing

Keep the existing pricing union unless implementation proves a small rename is
needed:

```ts
type MediaGenerationDependencyPricing =
  | { state: 'priced'; estimatedUsd: number }
  | { state: 'unpriced'; estimatedUsd: null; reason: string; overrideRequired: true }
  | { state: 'not-applicable'; estimatedUsd: null };
```

Rules:

- existing project assets are `priced` at `0`;
- generated missing dependencies are estimated by
  `@gorenku/studio-engines`, never by Studio UI;
- manual missing dependencies are `not-applicable`;
- invalid selections are `not-applicable` and make the total unavailable;
- unpriced generated dependencies make the total partial and require explicit
  unpriced-cost approval before run.

### Estimate States

```ts
interface MediaGenerationDependencyInventoryEstimate {
  state: 'complete' | 'partial' | 'unavailable';
  estimatedTotalUsd: number | null;
  pricedDependencyCount: number;
  unpricedDependencyCount: number;
  unavailableDependencyCount: number;
  requiresPriceOverride: boolean;
}
```

Rules:

- `complete`: root generation and every generated dependency are priced; no
  required manual or invalid dependency blocks the total.
- `partial`: at least one generated dependency or root line is unpriced, but
  the set of required dependencies is otherwise known.
- `unavailable`: a required manual dependency, invalid selected asset, invalid
  target, or invalid selector result prevents a trustworthy total.
- `estimate-only` dependency drafts do **not** make the total unavailable.

### `MediaGenerationDependencyChecklistItem`

The checklist is for the agent and UI. It is a human-readable projection of
inventory lines, not a scheduler.

```ts
interface MediaGenerationDependencyChecklistItem {
  id: string;
  dependencyLineId: string;
  action:
    | 'inspect-existing-asset'
    | 'author-generation-draft'
    | 'generate-dependency'
    | 'import-or-select-asset'
    | 'fix-invalid-selection';
  label: string;
  reason: string;
  pricing: MediaGenerationDependencyPricing;
  diagnostics: DiagnosticIssue[];
}
```

Rules:

- checklist items can be sorted for readability;
- checklist order is not an execution order;
- no code should run checklist items automatically.

## Planner Shape

Replace `resolveMediaGenerationDependencyGraph` with a small inventory planner,
for example:

```ts
planMediaGenerationDependencyInventory(input)
```

The planner should have five focused steps.

### Step 1: Declare Slots

Ask the root purpose for dependency slots. Generated dependency purposes can
also declare their own dependency slots.

Rules:

- slot declarations live in dedicated purpose-owned files, not buried in the
  planner or React UI;
- declarations are purpose-owned;
- declarations are deterministic;
- declarations do not read UI state directly;
- declarations do not estimate;
- declarations do not resolve assets;
- declarations return stable dependency ids.

## Dependency Slot Definition Files

Dependency slots are a core architecture contract and must be easy to inspect.
Each purpose with dependencies gets a dedicated slot definition file. The
purpose registry wires the purpose definition to that file's exported
declaration function.

Requiredness belongs on the slot because it depends on the current purpose,
target, and intent. For example, `shot.video-take` requires a first-frame input
for the `first-frame` intent, but not for `text-only`.

### Slot Meaning

```ts
interface MediaGenerationDependencySlot {
  dependencyId: string;
  dependencyKind: MediaGenerationDependencyKind;
  label: string;
  dependencyTarget: MediaGenerationTarget;
  selector: MediaGenerationDependencySelectorInput;
  required: boolean;
  reason: string;
}
```

Rules:

- `dependencyId` is stable and domain-readable.
- `dependencyKind` chooses the generated purpose and validates that the slot
  uses a compatible selector shape.
- `dependencyTarget` names the asset owner that should satisfy or generate the
  dependency.
- `selector` carries the exact lookup parameters needed by the deterministic
  asset selector, so selectors do not parse meaning out of display labels or
  dependency ids.
- `required: true` means the parent generation spec cannot be created until
  this dependency is satisfied by a real project asset.
- `required: false` means the dependency is useful planned context. It can be
  priced and shown to the agent, but it does not block the parent spec when it
  is missing.
- generated slots are included in the estimate when declared, whether required
  or optional, because they represent planned work.
- optional manual or invalid slots produce diagnostics but do not make the
  inventory total unavailable unless the declaring purpose marks them required.

Selector input shapes:

```ts
type MediaGenerationDependencySelectorInput =
  | {
      kind: 'shot-video-input';
      inputKind: ShotVideoTakeInputKind;
      productionGroupId: string;
      shotIds: string[];
      subjectKind?: ShotVideoTakeInputSubjectKind;
      subjectId?: string;
    }
  | {
      kind: 'asset-relationship';
      target: AssetTarget;
      role: string;
      mediaKind: MediaKind;
      fileRole?: string;
    }
  | {
      kind: 'lookbook-sheet';
      lookbookId: string;
    }
  | {
      kind: 'manual-attachment';
      target: MediaGenerationTarget;
    };
```

This is where dependency slots can have different attributes without making the
planner branch on every purpose. A shot-video first frame needs shot-video input
lookup attributes. A cast character sheet needs asset-relationship attributes.
A Lookbook sheet needs Lookbook sheet lookup attributes.

### Shared Slot Constructors

Use very small domain-named constructors only when they make ids and labels
consistent. Do not hide intent branching inside generic helpers.

Example file:

```text
packages/core/src/server/media-generation/dependency-slot-definitions.ts
```

Example helpers:

```ts
export function castCharacterSheetDependencySlot(input: {
  castMemberId: string;
  castMemberName: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: `cast-character-sheet:${input.castMemberId}`,
    dependencyKind: 'cast-character-sheet',
    label: `${input.castMemberName} character sheet`,
    dependencyTarget: { kind: 'castMember', id: input.castMemberId },
    selector: {
      kind: 'asset-relationship',
      target: {
        kind: 'castMember',
        castMemberId: input.castMemberId,
      },
      role: 'character_sheet',
      mediaKind: 'image',
    },
    required: input.required,
    reason: input.reason,
  };
}

export function locationEnvironmentSheetDependencySlot(input: {
  locationId: string;
  locationName: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: `location-environment-sheet:${input.locationId}`,
    dependencyKind: 'location-environment-sheet',
    label: `${input.locationName} location sheet`,
    dependencyTarget: { kind: 'location', id: input.locationId },
    selector: {
      kind: 'asset-relationship',
      target: {
        kind: 'location',
        locationId: input.locationId,
      },
      role: 'environment_sheet',
      mediaKind: 'image',
      fileRole: 'composite',
    },
    required: input.required,
    reason: input.reason,
  };
}

export function lookbookSheetDependencySlot(input: {
  lookbookId: string;
  lookbookName: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: `lookbook-sheet:${input.lookbookId}`,
    dependencyKind: 'lookbook-sheet',
    label: `${input.lookbookName} Lookbook sheet`,
    dependencyTarget: { kind: 'lookbook', id: input.lookbookId },
    selector: {
      kind: 'lookbook-sheet',
      lookbookId: input.lookbookId,
    },
    required: input.required,
    reason: input.reason,
  };
}
```

These helpers are not a compatibility layer. They exist only to keep dependency
ids, labels, and targets consistent across purpose-owned slot files.

### Shot Video Slot Definitions

File:

```text
packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts
```

Purpose registry wiring:

```ts
{
  purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  declareDependencies: declareShotVideoTakeDependencySlots,
}
```

Example declaration shape:

```ts
export function declareShotVideoTakeDependencySlots(input: {
  target: SceneShotMediaGenerationTarget;
  inputModeId: ShotVideoTakeInputModeId;
  selectedCast: Array<{ id: string; name: string }>;
  selectedLocations: Array<{ id: string; name: string }>;
  activeLookbook: { id: string; name: string } | null;
  customReferenceInputs: Array<{ id: string; title: string }>;
}): MediaGenerationDependencySlot[] {
  return [
    ...shotVideoInputModeSlots(input),
    ...shotVideoReferenceContextSlots(input),
  ];
}
```

Shot input slot helper:

```ts
function shotInputDependencySlot(input: {
  kind:
    | 'first-frame'
    | 'last-frame'
    | 'reference-image'
    | 'multi-shot-storyboard-sheet';
  target: SceneShotMediaGenerationTarget;
  subjectKind?: ShotVideoTakeInputSubjectKind;
  subjectId?: string;
  label?: string;
  required: boolean;
  reason: string;
}): MediaGenerationDependencySlot {
  const subjectKey = input.subjectKind && input.subjectId
    ? `${input.subjectKind}:${input.subjectId}`
    : `production-group:${input.target.productionGroupId}`;

  return {
    dependencyId: `${input.kind}:${subjectKey}`,
    dependencyKind: input.kind,
    label: input.label ?? shotInputDependencyLabel(input.kind),
    dependencyTarget: input.target,
    selector: {
      kind: 'shot-video-input',
      inputKind: input.kind,
      productionGroupId: input.target.productionGroupId,
      shotIds: input.target.shotIds,
      ...(input.subjectKind ? { subjectKind: input.subjectKind } : {}),
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    },
    required: input.required,
    reason: input.reason,
  };
}
```

Intent-specific required slots:

```ts
function shotVideoInputModeSlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  if (input.inputModeId === 'text-only') {
    return [];
  }

  if (input.inputModeId === 'first-frame') {
    return [
      shotInputDependencySlot({
        kind: 'first-frame',
        target: input.target,
        required: true,
        reason:
          'The selected video model route requires a first-frame image input.',
      }),
    ];
  }

  if (input.inputModeId === 'first-last-frame') {
    return [
      shotInputDependencySlot({
        kind: 'first-frame',
        target: input.target,
        required: true,
        reason:
          'The selected video model route requires a first-frame image input.',
      }),
      shotInputDependencySlot({
        kind: 'last-frame',
        target: input.target,
        required: true,
        reason:
          'The selected video model route requires a last-frame image input.',
      }),
    ];
  }

  if (input.inputModeId === 'reference') {
    return [
      ...input.customReferenceInputs.map((reference) =>
        shotInputDependencySlot({
          kind: 'reference-image',
          target: input.target,
          subjectKind: 'reference-image',
          subjectId: reference.id,
          label: reference.title,
          required: true,
          reason:
            'The selected video model route requires selected reference images.',
        })
      ),
    ];
  }

  return [];
}
```

Selected cast, location, and Lookbook slots:

```ts
function shotVideoReferenceContextSlots(
  input: ShotVideoTakeDependencySlotInput
): MediaGenerationDependencySlot[] {
  const requiredForReferenceRoute = input.inputModeId === 'reference';
  const contextReason = requiredForReferenceRoute
    ? 'The selected reference-video route uses this selected reference image.'
    : 'This selected reference helps author and inspect planned shot inputs.';

  return [
    ...(input.activeLookbook
      ? [
          lookbookSheetDependencySlot({
            lookbookId: input.activeLookbook.id,
            lookbookName: input.activeLookbook.name,
            required: requiredForReferenceRoute,
            reason: contextReason,
          }),
        ]
      : []),
    ...input.selectedCast.map((castMember) =>
      castCharacterSheetDependencySlot({
        castMemberId: castMember.id,
        castMemberName: castMember.name,
        required: requiredForReferenceRoute,
        reason: contextReason,
      })
    ),
    ...input.selectedLocations.map((location) =>
      locationEnvironmentSheetDependencySlot({
        locationId: location.id,
        locationName: location.name,
        required: requiredForReferenceRoute,
        reason: contextReason,
      })
    ),
  ];
}
```

This makes requiredness explicit:

- `text-only`: no required image-input dependency slots.
- `first-frame`: first frame is required; selected cast/location/Lookbook
  context can still be declared as optional planned context.
- `first-last-frame`: first frame and last frame are required.
- `reference`: selected reference images are required; selected cast,
  location, and Lookbook sheets are also required if they are part of the
  selected reference bundle.

### Cast Profile Slot Definitions

File:

```text
packages/core/src/server/media-generation/cast-profile-dependency-slots.ts
```

Purpose registry wiring:

```ts
{
  purpose: CAST_PROFILE_GENERATION_PURPOSE,
  declareDependencies: declareCastProfileDependencySlots,
}
```

Example:

```ts
export function declareCastProfileDependencySlots(input: {
  castMemberId: string;
  castMemberName: string;
}): MediaGenerationDependencySlot[] {
  return [
    castCharacterSheetDependencySlot({
      castMemberId: input.castMemberId,
      castMemberName: input.castMemberName,
      required: true,
      reason:
        'A cast profile must be grounded in the selected character sheet.',
    }),
  ];
}
```

Here the character sheet is always required because the profile purpose cannot
produce the intended artifact without that visual identity reference.

### Cast Character Sheet Slot Definitions

File:

```text
packages/core/src/server/media-generation/cast-character-sheet-dependency-slots.ts
```

Purpose registry wiring:

```ts
{
  purpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  declareDependencies: declareCastCharacterSheetDependencySlots,
}
```

Example if the product makes the active Lookbook sheet a generated dependency
for character sheets:

```ts
export function declareCastCharacterSheetDependencySlots(input: {
  activeLookbook: { id: string; name: string } | null;
}): MediaGenerationDependencySlot[] {
  if (!input.activeLookbook) {
    return [];
  }

  return [
    lookbookSheetDependencySlot({
      lookbookId: input.activeLookbook.id,
      lookbookName: input.activeLookbook.name,
      required: true,
      reason:
        'A character sheet must use the active Lookbook sheet as its visual-language reference.',
    }),
  ];
}
```

This is the pattern for future non-shot dependencies: the purpose-specific slot
file decides whether a dependency exists and whether it is required. The shared
inventory planner does not know character-sheet product policy.

### Location Environment Sheet Slot Definitions

File:

```text
packages/core/src/server/media-generation/location-environment-sheet-dependency-slots.ts
```

Example if location sheets later require a Lookbook sheet:

```ts
export function declareLocationEnvironmentSheetDependencySlots(input: {
  activeLookbook: { id: string; name: string } | null;
}): MediaGenerationDependencySlot[] {
  return input.activeLookbook
    ? [
        lookbookSheetDependencySlot({
          lookbookId: input.activeLookbook.id,
          lookbookName: input.activeLookbook.name,
          required: true,
          reason:
            'A location environment sheet must match the active Lookbook sheet.',
        }),
      ]
    : [];
}
```

Do not add this dependency until the product wants that behavior. The file
example is included to show where the rule would live.

### Step 2: Resolve Assets

Resolve each dependency slot through one registered selector.

Rules:

- selectors return exactly one of `satisfied`, `missing`, or
  `invalid-selection`;
- selectors collect structured diagnostics;
- selectors never silently choose among multiple selected assets;
- selectors never use the first matching asset when the selected/default
  semantics are ambiguous;
- selectors verify required file roles, including location environment sheet
  composite files;
- selectors verify selected Lookbook sheets have an image file;
- shot-video input selection verifies production group, shot ids, input kind,
  subject kind, and subject id.

### Step 3: Build Estimate Drafts

For each missing generated dependency, ask the owning generated purpose for a
pricing draft.

Rules:

- pricing drafts may be estimate-only;
- estimate-only drafts are never exposed as runnable specs;
- authored drafts are exposed as agent checklist data;
- missing authored prompts are not estimate errors;
- draft-builder failure is a structured diagnostic and makes that dependency
  unpriced or unavailable depending on the failure.

### Step 4: Expand Dependencies

If a generated dependency purpose declares its own dependencies, add them to the
same inventory and dedupe by stable dependency id.

Rules:

- expansion records `requiredBy` for explanation;
- expansion does not produce execution levels;
- expansion has cycle detection with a structured error;
- expansion has a small hard maximum depth as a safety guard;
- duplicate dependencies are estimated once.

### Step 5: Aggregate Estimate

Estimate root generation and every missing generated dependency, then aggregate
one total.

Rules:

- total includes root generation;
- total includes each unique missing generated dependency once;
- total includes existing assets at `$0.00`;
- total excludes manual attachments;
- total is unavailable only for invalid/manual required blockers, not because a
  generated dependency still needs an authored prompt.

## Shot Video Reference Projection

The shot References tab must become a pure projection of the dependency
inventory plus available alternative assets.

### Required Invariants

For every selected Reference tab card that represents a generated dependency:

- `card.dependencyId` is present;
- `card.dependencyLineId` is present;
- `card.purpose` is present;
- `card.pricing` comes from the dependency inventory line;
- `card.diagnostics` comes from the dependency inventory line;
- a missing generated dependency card never falls back to
  `not-applicable` pricing.

If a selected generated reference cannot be matched to an inventory line, core
must emit a structured error. The UI should not quietly render it as an
unpriced card.

### General References

General references include:

- first frame;
- last frame;
- reference images;
- multi-shot storyboard sheets.

Rules:

- selected planned cards come from inventory lines;
- selected existing cards come from satisfied inventory lines;
- unselected available alternatives can be shown from available inputs;
- unselected alternatives do not affect the estimate;
- custom reference images use stable dependency ids that include their
  subject/intent identity.

### Lookbook

Rules:

- the active selected Lookbook sheet dependency is an inventory line;
- if no sheet exists, the selected planned Lookbook card comes from that line;
- if a selected sheet exists, it satisfies the line at `$0.00`;
- if a selected sheet record exists without an image file, the line is
  `invalid-selection`;
- unselected Lookbook sheet alternatives can be shown as alternatives without
  estimate pricing.

### Cast Character Sheets

Rules:

- selected cast members that the shot needs each produce a character-sheet
  dependency line;
- an existing selected/default character sheet satisfies the line at `$0.00`;
- a missing selected/default character sheet becomes a priced
  `missing-generated` line;
- multiple selected character sheets for one cast member are an
  `invalid-selection`;
- unselected cast members are visible only as selection context, not as priced
  dependencies.

### Location Sheets And Views

Rules:

- selected shot locations each produce a location-environment-sheet dependency
  line;
- an existing selected/default environment sheet satisfies the line at `$0.00`;
- a missing selected/default environment sheet becomes a priced
  `missing-generated` line;
- the selector must verify the composite image role;
- selected view cards are derived from the selected environment sheet asset and
  do not create separate generation dependency estimates unless a future purpose
  explicitly defines generated per-view dependencies.

## AI Production Estimate Behavior

The AI Production tab should render one number from core.

Expected behavior:

- when all missing dependencies are generated and priceable, show a numeric
  total before those dependencies exist;
- include first frame, last frame, reference images, storyboard sheets, cast
  sheets, location sheets, Lookbook sheets, and the final video once each;
- do not fall back to final-video-only pricing when the inventory exists;
- do not calculate prices in React;
- show unavailable only when core says a required manual/invalid dependency
  prevents a trustworthy total.

## API And Compatibility

This is pre-customer software. Do not preserve old graph contracts.

Required contract changes:

- replace `MediaGenerationDependencyMap` public usage with
  `MediaGenerationDependencyInventory`;
- remove `execution.levels`;
- remove `topologicalNodeIds`;
- replace `nodeId` card references with `dependencyLineId`;
- keep stable dependency ids where they describe the current domain correctly;
- update all callers directly;
- delete obsolete graph code instead of wrapping it.

Forbidden implementation shortcuts:

- no compatibility aliases;
- no re-export stubs;
- no UI-side price inference;
- no fake asset rows or fake files;
- no automatic dependency execution scheduler;
- no broad `utils.ts`, `helpers.ts`, or generic adapter modules.

## Proposed File Ownership

The new architecture should use a small number of focused files before any
broader `0062` file split.

Core shared media generation files:

```text
packages/core/src/server/media-generation/dependency-slot-definitions.ts
packages/core/src/server/media-generation/dependency-kind-registry.ts
packages/core/src/server/media-generation/dependency-selectors.ts
packages/core/src/server/media-generation/dependency-draft-estimates.ts
packages/core/src/server/media-generation/dependency-inventory.ts
packages/core/src/server/media-generation/dependency-inventory-lines.ts
```

Purpose-specific dependency slot files:

```text
packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts
packages/core/src/server/media-generation/cast-profile-dependency-slots.ts
packages/core/src/server/media-generation/cast-character-sheet-dependency-slots.ts
packages/core/src/server/media-generation/location-environment-sheet-dependency-slots.ts
```

Shot-video reference projection files:

```text
packages/core/src/server/media-generation/shot-video-take/reference-inventory.ts
packages/core/src/server/media-generation/shot-video-take/reference-sections.ts
```

If the broader `shot-video-take.ts` file still exists when this work starts,
extract only the dependency and reference projection code needed for this
rewrite. Do not perform a broad mechanical file split first.

## Implementation Plan

### Slice 1: Characterize The Current Failure

Add failing no-mock tests before replacing the implementation.

Required test scenarios:

- the screenshot-like Bombardment state: selected Lookbook, selected cast, and
  selected locations with missing generated sheets all show pricing;
- the screenshot-like First Patron state: selected cast sheets show pricing and
  selected missing location sheet also shows pricing;
- every selected planned Reference tab card has dependency line id, purpose,
  pricing, and diagnostics from core;
- no selected generated dependency card has `pricing.state:
  "not-applicable"`;
- AI Production total includes the same dependency prices shown in References.

These should start from real core/project data where possible, not handcrafted
React mocks.

### Slice 2: Add Inventory Client Types

Add the inventory contracts to `packages/core/src/client/media-generation.ts`.

Rules:

- remove graph execution concepts from the new contract;
- keep old graph types only temporarily while callers are being updated in the
  same implementation slice;
- do not expose both old and new contracts as long-lived alternatives;
- update accepted docs after implementation.

### Slice 3: Build Dependency Slot Definition Files

Create the dedicated slot files before replacing the planner.

Required files:

- `packages/core/src/server/media-generation/dependency-slot-definitions.ts`
- `packages/core/src/server/media-generation/shot-video-take/dependency-slots.ts`
- `packages/core/src/server/media-generation/cast-profile-dependency-slots.ts`
- `packages/core/src/server/media-generation/cast-character-sheet-dependency-slots.ts`
- `packages/core/src/server/media-generation/location-environment-sheet-dependency-slots.ts`

Rules:

- the shot-video slot file owns intent-specific requiredness;
- non-shot slot files own their own product policy;
- shared constructors only standardize ids, labels, and targets;
- slot files do not estimate, resolve assets, or build UI cards;
- purpose registry entries point directly at the slot declaration functions.

### Slice 4: Build Deterministic Selectors

Replace selector behavior with one result contract.

Required selectors:

- shot-video input;
- cast character sheet;
- location environment sheet;
- Lookbook sheet;
- manual attachment.

Required invalid-state coverage:

- multiple selected cast sheets;
- selected cast sheet with no image file;
- multiple selected location sheets;
- selected location sheet with no composite image file;
- selected location sheet with missing environment-sheet metadata;
- selected Lookbook sheet with no image file;
- ambiguous shot-video inputs for the same dependency;
- selected shot-video input with missing asset/file ids.

### Slice 5: Implement Inventory Planner

Implement `planMediaGenerationDependencyInventory`.

Rules:

- no callback-heavy public resolver contract;
- the planner owns declaration, selection, draft estimate, recursive expansion,
  dedupe, and total aggregation through focused internal functions;
- purpose definitions own purpose-specific declarations and draft specs;
- root estimation is purpose-owned through the existing shared generation
  lifecycle or a deliberately named purpose hook, not an ad hoc caller
  callback;
- root estimation must not affect dependency line availability;
- cycle detection emits `CORE_MEDIA_DEPENDENCY_CYCLE_DETECTED`;
- invalid declarations emit structured diagnostics with stable codes.

### Slice 6: Port Shot Video To Inventory

Update `shot.video-take` planning to use the inventory.

Required behavior:

- first frame dependencies price before authored prompts exist;
- last frame dependencies price before authored prompts exist;
- reference-image dependencies price before authored prompts exist;
- multi-shot storyboard dependencies price before authored prompts exist;
- cast sheets, location sheets, and Lookbook sheets price consistently whenever
  they are selected and missing;
- final video spec creation remains blocked until required dependencies are
  satisfied;
- dependency generation specs are created only when the agent/user explicitly
  works on that dependency.

### Slice 7: Rewrite Reference Projection

Make Reference tab data graph/inventory-first.

Rules:

- selected generated cards are built from inventory lines;
- selected existing cards are built from satisfied inventory lines;
- available alternatives are attached separately and do not drive estimates;
- card pricing is never filled with a fallback for selected generated
  dependencies;
- a missing inventory line is a core error, not a quiet card state;
- Studio components continue to use local shadcn controls only.

### Slice 8: Update Studio Service And UI Contracts

Update Studio service types and UI consumption.

Rules:

- React renders core pricing only;
- React does not calculate or infer dependency estimates;
- AI Production displays inventory total;
- Reference cards display line pricing;
- tests must cover rendering of priced selected planned cards and invalid
  dependency diagnostics.

### Slice 9: Delete Obsolete Graph Execution Code

Remove obsolete architecture after callers are updated.

Delete or rewrite:

- `resolveMediaGenerationDependencyGraph`;
- `plannedGenerationLevels`;
- public `execution.levels`;
- public `topologicalNodeIds`;
- graph-only tests whose only purpose is execution ordering.

Do not delete behavioral test coverage. Replace execution-order assertions with
inventory-line, checklist, readiness, and estimate assertions.

### Slice 10: Update Documentation

Update accepted documentation:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/decisions/0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
  or a new ADR that supersedes it.

The docs should say dependency planning is an inventory/checklist/estimate
contract, not an automatic execution graph.

## Test Strategy

Do not simplify tests. Strengthen them.

### Core Integration Tests

Add or replace tests under:

```text
packages/core/tests/integration/media-generation-dependency-slots.test.ts
packages/core/tests/integration/media-generation-dependency-inventory.test.ts
packages/core/tests/integration/shot-video-take/reference-inventory.test.ts
```

Required coverage:

- shot-video `text-only` declares no required frame-input slots;
- shot-video `first-frame` declares first frame as required;
- shot-video `first-last-frame` declares first frame and last frame as required;
- shot-video `reference` declares selected reference images as required;
- shot-video selected cast/location/Lookbook context slots have the expected
  requiredness for each intent;
- cast profile declares character sheet as required;
- cast character sheet declares Lookbook sheet as required only after that
  product dependency is accepted;
- complete priced inventory for shot video text-only route;
- complete priced inventory for first-frame route with no authored dependency
  prompt;
- complete priced inventory for first-last-frame route with no authored
  dependency prompts;
- complete priced inventory for reference route with missing cast, location,
  Lookbook, and custom reference dependencies;
- satisfied imported dependencies at `$0.00`;
- mixed satisfied and missing dependencies without duplicate prices;
- unpriced generated dependency makes estimate partial;
- manual missing dependency makes estimate unavailable;
- invalid selected asset makes estimate unavailable;
- duplicate declarations are deduped and priced once;
- recursive dependency expansion records `requiredBy`;
- dependency cycles fail with structured diagnostics;
- root spec creation fails while required dependencies are not satisfied.

### Studio Service E2E Tests

Keep and expand the existing real Hono/browser-service estimate matrix.

Required coverage:

- every current route/model still has a numeric estimate when all missing
  dependencies are generated and priceable;
- the serialized response contains inventory lines with pricing;
- no obsolete graph execution fields appear in the response;
- References plan route serializes the same inventory prices as the estimate
  route.

### Reference Projection Tests

Add no-mock projection tests at the core or service boundary.

Required coverage:

- selected missing cast sheet card is priced;
- selected missing location sheet card is priced;
- selected missing Lookbook sheet card is priced;
- selected missing first frame card is priced;
- selected missing last frame card is priced;
- selected existing sheet card is satisfied at `$0.00`;
- unselected alternatives do not contribute to total;
- every selected generated card has a dependency line id;
- no selected generated card has `not-applicable` pricing.

### React Tests

Keep React tests focused on rendering and interaction.

Required coverage:

- price badges render for selected planned cards from the service response;
- invalid dependency diagnostics render in the Reference Issues section;
- card selection still calls the correct shadcn-backed mutation controls;
- no raw HTML controls are introduced in feature code.

### Static Tests

Add architecture checks if normal lint cannot express the invariant.

Recommended static checks:

- no `execution.levels` in media generation client contracts;
- no `topologicalNodeIds` in media generation client contracts;
- no `not-applicable` fallback for selected generated reference cards;
- no imports from obsolete graph modules after deletion.

## Verification Commands

Focused verification during implementation:

```bash
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-slots.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/media-generation-dependency-inventory.test.ts --no-file-parallelism
pnpm --dir packages/core exec vitest run tests/integration/shot-video-take/reference-inventory.test.ts --no-file-parallelism
pnpm --filter @gorenku/studio exec vitest run src/services/shot-video-take-ai-production-estimate-matrix.e2e.test.ts --no-file-parallelism
pnpm --filter @gorenku/studio exec vitest run src/features/movie-studio/scenes/scene-shot-references-tab.test.tsx src/features/movie-studio/scenes/scene-shot-ai-production-tab.test.tsx --no-file-parallelism
```

Broader verification before completion:

```bash
pnpm test:core
pnpm test:studio
pnpm test:typecheck
pnpm lint
pnpm check
```

Desktop browser verification:

- run or reuse `pnpm dev:studio`;
- open the two screenshot scenes on desktop;
- verify missing selected cast, location, Lookbook, first-frame, and last-frame
  generated dependencies show consistent estimates;
- verify AI Production total matches the sum of final video plus visible
  selected missing generated dependencies;
- do not perform mobile viewport verification unless explicitly requested.

## Completion Checklist

Use this checklist to track implementation. The plan is not complete until each
item is checked or explicitly replaced by a reviewed plan update.

### Review Area

- [ ] Confirm this plan supersedes the dependency portions of `0061`.
- [ ] Confirm `0062` is deferred or revised so it does not preserve the current
  graph complexity in smaller files.
- [ ] Confirm no database schema change is required.
- [ ] Confirm no dependency installation is required.
- [ ] Confirm no backwards compatibility layer will be kept.
- [ ] Confirm no dependency execution scheduler will be implemented.
- [ ] Confirm current dirty worktree changes are not reverted.

### Architecture Contracts

- [ ] Add `MediaGenerationDependencyInventory`.
- [ ] Add `MediaGenerationDependencyLine`.
- [ ] Add `MediaGenerationRootGenerationLine`.
- [ ] Add `MediaGenerationDependencyInventoryEstimate`.
- [ ] Add inventory checklist item types for agent-facing missing work.
- [ ] Replace public dependency graph usage in current generation plans.
- [ ] Remove public `execution.levels`.
- [ ] Remove public `topologicalNodeIds`.
- [ ] Separate availability from pricing.
- [ ] Separate pricing from authored generation draft readiness.
- [ ] Keep dependency requiredness on purpose-owned slot declarations.
- [ ] Keep shot-video intent-specific requiredness in
  `shot-video-take/dependency-slots.ts`.
- [ ] Keep root spec creation blocked until required dependencies are
  satisfied.
- [ ] Keep estimate-only dependency drafts non-runnable.
- [ ] Preserve structured diagnostics at package boundaries.

### Dependency Slot Definitions

- [ ] Add `dependency-slot-definitions.ts` for shared domain-named slot
  constructors.
- [ ] Add `shot-video-take/dependency-slots.ts`.
- [ ] Add `cast-profile-dependency-slots.ts`.
- [ ] Add `cast-character-sheet-dependency-slots.ts`.
- [ ] Add `location-environment-sheet-dependency-slots.ts`.
- [ ] Wire `shot.video-take` purpose registration to
  `declareShotVideoTakeDependencySlots`.
- [ ] Wire `cast.profile` purpose registration to
  `declareCastProfileDependencySlots`.
- [ ] Wire `cast.character-sheet` purpose registration to
  `declareCastCharacterSheetDependencySlots` if character sheets require a
  Lookbook sheet.
- [ ] Wire `location.environment-sheet` purpose registration to
  `declareLocationEnvironmentSheetDependencySlots` only when that dependency is
  accepted product behavior.
- [ ] Cover `text-only` shot video slot declarations.
- [ ] Cover `first-frame` shot video slot declarations.
- [ ] Cover `first-last-frame` shot video slot declarations.
- [ ] Cover `reference` shot video slot declarations.
- [ ] Cover required and optional shot-video context slots.
- [ ] Confirm slot files do not estimate, resolve assets, or build UI cards.

### Shared Implementation

- [ ] Add `dependency-slot-definitions.ts`.
- [ ] Add `dependency-selectors.ts`.
- [ ] Add `dependency-draft-estimates.ts`.
- [ ] Add `dependency-inventory.ts`.
- [ ] Add `dependency-inventory-lines.ts`.
- [ ] Implement deterministic selector result contracts.
- [ ] Implement recursive inventory expansion.
- [ ] Implement dependency dedupe by stable dependency id.
- [ ] Implement cycle detection.
- [ ] Implement a small maximum expansion depth guard.
- [ ] Implement inventory total aggregation.
- [ ] Delete or replace `dependency-graph.ts`.
- [ ] Delete or replace graph execution ordering helpers.

### Selector Coverage

- [ ] Shot-video input selector resolves first frame.
- [ ] Shot-video input selector resolves last frame.
- [ ] Shot-video input selector resolves reference image.
- [ ] Shot-video input selector resolves multi-shot storyboard sheet.
- [ ] Cast selector resolves selected/default character sheet.
- [ ] Location selector resolves selected/default environment sheet.
- [ ] Location selector verifies composite image role.
- [ ] Lookbook selector resolves active selected/default Lookbook sheet.
- [ ] Manual selector reports required attachment.
- [ ] Ambiguous selected assets produce structured errors.
- [ ] Missing selected files produce structured errors.
- [ ] Invalid selected environment sheet metadata produces structured errors.

### Shot Video Implementation

- [ ] Declare shot-video dependencies through the shared inventory path.
- [ ] Price first-frame dependencies before authored prompts exist.
- [ ] Price last-frame dependencies before authored prompts exist.
- [ ] Price reference-image dependencies before authored prompts exist.
- [ ] Price multi-shot storyboard dependencies before authored prompts exist.
- [ ] Price selected missing cast character sheets consistently.
- [ ] Price selected missing location environment sheets consistently.
- [ ] Price selected missing Lookbook sheets consistently.
- [ ] Reuse imported/generated inputs at `$0.00`.
- [ ] Keep final video estimate separate from dependency availability.
- [ ] Keep final video spec creation blocked until required dependencies are
  satisfied.

### Reference Projection

- [ ] Build General selected cards from inventory lines.
- [ ] Build Lookbook selected cards from inventory lines.
- [ ] Build Cast selected cards from inventory lines.
- [ ] Build Location selected cards from inventory lines.
- [ ] Attach available alternatives separately from selected dependency lines.
- [ ] Remove selected generated card fallback to `not-applicable` pricing.
- [ ] Emit a structured error when a selected generated card has no inventory
  line.
- [ ] Preserve existing selection interactions.
- [ ] Preserve Reference Issues section behavior and add invalid dependency
  diagnostics.

### Studio Contracts

- [ ] Update Studio service response types.
- [ ] Update AI Production tab to read inventory estimate.
- [ ] Update References tab to read dependency line ids.
- [ ] Ensure React code does not compute prices.
- [ ] Ensure feature code uses local shadcn UI controls only.
- [ ] Remove obsolete graph field assumptions from Studio tests.

### Tests

- [ ] Add no-mock core inventory tests.
- [ ] Add no-mock shot reference inventory tests.
- [ ] Keep the route/model estimate matrix thorough.
- [ ] Extend service E2E tests to assert inventory line pricing.
- [ ] Add screenshot-state regression tests for inconsistent cast/location
  estimates.
- [ ] Add invalid selector tests for cast.
- [ ] Add invalid selector tests for location.
- [ ] Add invalid selector tests for Lookbook.
- [ ] Add invalid selector tests for shot-video inputs.
- [ ] Add duplicate declaration and cycle tests.
- [ ] Add static tests for removed execution fields.
- [ ] Do not delete any existing behavioral tests unless the behavior is
  genuinely obsolete under this plan.
- [ ] Replace execution-order assertions with inventory/checklist assertions.

### Documentation

- [ ] Update `docs/architecture/media-generation.md`.
- [ ] Update `docs/architecture/reference/media-generation.md`.
- [ ] Supersede or update ADR `0032`.
- [ ] Document that dependencies are an inventory/checklist/estimate contract.
- [ ] Document that dependency generation is agent/user-driven, not automatic.
- [ ] Document estimate-only drafts and why they are non-runnable.

### Final Verification

- [ ] Run focused dependency slot tests.
- [ ] Run focused core inventory tests.
- [ ] Run focused shot reference inventory tests.
- [ ] Run Studio estimate matrix E2E tests.
- [ ] Run Studio Reference tab tests.
- [ ] Run Studio AI Production tab tests.
- [ ] Run `pnpm test:core`.
- [ ] Run `pnpm test:studio`.
- [ ] Run `pnpm test:typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm check`.
- [ ] Verify the two screenshot scenes in desktop Chrome.
- [ ] Confirm all selected missing generated dependencies show consistent
  estimates.
- [ ] Confirm AI Production total matches core inventory total.
