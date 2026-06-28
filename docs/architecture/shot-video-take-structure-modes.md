# Shot Video Take Structure Modes

Date: 2026-06-27

Status: current

Role: reference

## Context

Shot Video Takes can group multiple Scene Shots for one generated video. That
group has two distinct meanings:

- a continuous camera move where the grouped shots are keyframes, beats, or
  spatial anchors inside one unbroken generated move;
- a multi-cut sequence where each grouped shot is a separate edit inside one
  generated video.

Those are different authoring models. A continuous drone flyover should have
one shared Composition, Motion, Dialogs, and References direction for the whole
group. A multi-cut scene should have a separate direction per shot.

The UI is not the primary generation authoring surface. The agent is. Studio is
the visual review, override, and instruction surface:

- the agent prepares a complete proposal;
- Studio displays the proposal visually;
- the user may override it in Studio;
- the agent re-reads the current state before generation;
- final generation uses the user-reviewed state.

This means persistence must make the take structure explicit and deterministic.
The implementation must not use UI-side "apply to all" copying, synchronized
per-shot mirrors, generic take-state patches, or hidden adapter fallbacks.

## Decision

Persist the take structure as a discriminated union in
`SceneShotVideoTakeState`.

Use two stable modes:

```text
continuous
multi-cut
```

Use `SceneShotVideoTakeDirection` as the domain name for the authored state
that currently spans Composition, Motion, Dialogs, and References.

Public contract shape:

```ts
export type SceneShotVideoTakeStructureMode = "continuous" | "multi-cut";

export interface SceneShotVideoTakeState {
  version: 2;
  structure: SceneShotVideoTakeStructure;
  production: SceneShotVideoTakeProductionState;
  promptState?: SceneShotVideoTakePromptState;
}

export type SceneShotVideoTakeStructure =
  | {
      mode: "continuous";
      sharedDirection: SceneShotVideoTakeDirection;
    }
  | {
      mode: "multi-cut";
      directionsByShotId: Record<string, SceneShotVideoTakeDirection>;
    };
```

`SceneShotVideoTakeDirection` owns:

- Composition;
- Motion;
- Dialogs;
- visible Cast Members and Character Sheet references;
- Locations and Location Sheet references;
- Lookbook references;
- custom reference image inputs;
- explicit include/exclude choices.

AI Production remains outside the structure union. It is take-level in both
modes because the model, input mode, route parameters, dependency prompt drafts,
final prompt draft, provider payload preview, estimate, and approval apply to
the whole take.

The take's ordered `shotIds` remain the membership source. The Scene Shot List
remains the source of baseline shot descriptions, story beats, storyboard
images, cast, locations, and dialogue references.

## Continuous Mode

Continuous mode stores one `sharedDirection`.

Composition, Motion, Dialogs, and References tabs edit this shared direction.
Selecting another grouped shot changes visual context and keyframe/beat focus,
but it does not change which direction object is being edited.

There are no per-shot overrides in the first version of continuous mode.

Generation planning uses:

- the ordered grouped shots as keyframes or story beats;
- the shared direction as the user/agent-authored instruction;
- required references aggregated from all grouped shots;
- selected references and exclusions from the shared direction.

For the drone flyover example, this is the correct model: the shots describe
the city, wall, field, and cannon-mouth beats of one camera move, not four
separate cuts.

## Multi-Cut Mode

Multi-cut mode stores one `SceneShotVideoTakeDirection` per grouped shot id.

Composition, Motion, Dialogs, and References tabs edit the selected shot's
direction. Changing the selected shot changes which direction object is edited.

Generation planning uses:

- each grouped shot as a separate cut;
- that shot's direction as the authored instruction for the cut;
- dependencies aggregated across every shot direction;
- prompt and provider preview output that shows which direction and references
  attach to which shot.

## Mode Switching

Mode switching is a core-owned mutation.

Studio, CLI, and agents must not implement conversion by reading state, copying
values locally, and writing arbitrary JSON back.

Saving a take persists exactly the current mode's state shape. It does not keep
both modes in parallel. Toggling later is therefore a data conversion, not a
visual filter over hidden duplicated state.

### Saved Continuous State

A saved continuous take has one shared direction:

```ts
{
  mode: "continuous",
  sharedDirection: { ... }
}
```

If the user toggles this take to multi-cut, core expands that shared direction
into one direction per grouped shot. The conversion is non-lossy, and the
directions stop synchronizing after the conversion.

### Saved Multi-Cut State

A saved multi-cut take has one direction per grouped shot:

```ts
{
  mode: "multi-cut",
  directionsByShotId: {
    shot_001: { ... },
    shot_001b: { ... },
    shot_001c: { ... },
    shot_002: { ... }
  }
}
```

If the user toggles this take to continuous, core compares the directions. If
they are equivalent, core collapses them into one shared direction. If they
differ, the conversion is lossy and requires an explicit source shot choice.

### Continuous To Multi-Cut

When switching from `continuous` to `multi-cut`:

- core creates one direction for every shot id in the take;
- each new direction starts as a copy of `sharedDirection`;
- this is a one-time conversion to preserve user work;
- after conversion, directions are independent and no synchronization remains.

This is not a compatibility layer. It is the current-domain conversion from one
take structure to another.

### Multi-Cut To Continuous

When switching from `multi-cut` to `continuous`:

- if all shot directions are equivalent, core collapses them into one
  `sharedDirection`;
- if directions differ, core fails with a structured diagnostic unless the
  caller supplies a source shot id;
- when a source shot id is supplied, core uses that shot's direction as
  `sharedDirection` and discards the other per-shot directions.

Studio should present this lossy conversion through a focused confirmation
dialog. The Studio route should parse the user's selected source shot and call
core. It must not compare, merge, or mutate direction state itself.

## Shot Membership Changes

Changing grouped shot membership must preserve the structure invariant.

In continuous mode:

- `sharedDirection` remains intact;
- the new ordered `shotIds` become the keyframes/beats for the continuous take;
- AI Production shot metadata is carried through the existing production state
  carry path.

In multi-cut mode:

- directions for retained shot ids are kept;
- removed shot directions are deleted;
- added shot ids receive empty directions;
- persisted state must not contain directions for non-member shot ids.

## Reference Consistency

Location Sheets are required by default for referenced Locations.

Character Sheets are required by default for visible Cast Members.

Agents should auto-select the best available required references before
presenting the proposal. Users may override or explicitly exclude references in
Studio before final approval.

Core planning must respect the final reviewed state:

- selected references are included;
- explicit exclusions are not included;
- missing required references are blockers unless explicitly excluded;
- selected and excluded references must be visible in authoring context and
  provider payload preview.

### Reference Projection Scope

Reference reads use different scopes depending on the caller.

Editor projection resolves exactly one direction:

- in continuous mode, the editor reads `sharedDirection`;
- in multi-cut mode, the editor reads
  `directionsByShotId[selectedShotId]`;
- multi-cut editor reads require a selected shot id that belongs to the take;
- selected Character Sheets, selected Location Sheets, selected Lookbook
  Sheets, selected Dialogue Audio takes, and include/exclude card state must
  come from that one resolved editor direction.

Generation projection resolves the whole take:

- in continuous mode, generation reads `sharedDirection`;
- in multi-cut mode, generation reads one direction per grouped shot id in
  take order;
- dependency inventory, preflight input preparation, final provider payloads,
  estimates, and whole-take validation may aggregate references across that
  ordered generation direction set.
- selected Character Sheet and Location Sheet assets are singular in each
  editor direction, then aggregated and de-duplicated only after
  direction-scoped inclusion state is applied.

Core helpers must name this distinction directly. A helper that scans every
direction is a generation or whole-take dependency helper. A helper that
returns selected editor state is an editor-direction helper. Studio routes and
React components must not repair or reinterpret this scope locally.

Reference mutations use one validated write scope:

- continuous reference mutations must reject any provided shot id;
- multi-cut reference mutations must require a valid grouped shot id;
- mutation wrappers must not drop shot ids before calling the core state
  updater;
- mismatches fail through `CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH`.

Voice readiness is separate. Missing Cast Voice blocks dialogue audio
generation and should route the user to a casting or voice workflow with user
consent. Shot-video generation must not silently assign voices.

## Core API Direction

Add focused core commands for:

- reading the complete authoring context;
- validating a complete authoring document;
- applying a complete authoring document atomically;
- producing provider payload preview from the same path used for spec creation.

Do not add:

- a generic take-state patch command;
- a route-local or CLI-local conversion helper;
- a UI-only validation path;
- compatibility readers for the old take state shape.

Suggested command concepts:

```text
readSceneShotVideoTakeAuthoringContext
validateSceneShotVideoTakeAuthoringDocument
applySceneShotVideoTakeAuthoringDocument
previewSceneShotVideoTakeProviderPayload
```

Names can be adjusted during implementation only if the replacement is more
precise in the same domain vocabulary.

## CLI And Agent Contract

Expose one deterministic read command and one schema-first document apply path
for agents:

```bash
renku take authoring context --take <take-id> --json
renku take authoring validate --file <authoring-document.json> --json
renku take authoring apply --file <authoring-document.json> --json
```

The response should include:

- project, scene, shot list, take, and grouped shots;
- structure mode;
- shared or per-shot directions;
- required, selected, excluded, missing, and available references;
- dialogue audio readiness;
- AI Production state;
- dependency prompt drafts;
- final prompt draft;
- provider payload preview;
- preflight readiness;
- estimate and blocking diagnostics;
- current take revision/update token for stale-write protection.

The authoring document contains the target take, ordered shot ids, structure,
directions, references, and production state. The CLI should pass the document
to core and print structured diagnostics. It should not expose separate
commands for every current reference kind.

The old `generation plan` command shape should be replaced and removed. Do not
keep an alias or compatibility command.

## Studio UX Direction

Use the selected Option B control:

- a compact sliding icon toggle beside the grouped-shot count pill;
- one active icon state visible at a time;
- Continuous icon: one smooth path through keyframe dots;
- Multi-Cut icon: separated frame/cut marks on a timeline;
- tooltips: `Continuous Move` and `Multi-Cut Sequence`;
- no long explanatory copy in the tab row.

The control should use local shadcn-style primitives from
`packages/studio/src/ui`.

In continuous mode:

- non-AI-Production tabs edit shared direction;
- selecting a shot changes visual context but not the edited direction object.

In multi-cut mode:

- non-AI-Production tabs edit the selected shot direction.

AI Production remains take-level in both modes.

## Validation And Diagnostics

Core validation should reject:

- unknown structure mode values;
- continuous state without `sharedDirection`;
- continuous state with per-shot directions;
- multi-cut state without exactly one direction per take shot id;
- direction entries for shots outside the take;
- direction update calls with an invalid scope;
- missing required Location Sheet references unless explicitly excluded;
- missing required Character Sheet references unless explicitly excluded;
- dialogue audio generation when the referenced speaker has no Cast Voice.

Suggested diagnostic prefix:

```text
CORE_SHOT_VIDEO_TAKE_STRUCTURE_*
```

Example codes:

- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_UNKNOWN_MODE`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_INVALID_CONTINUOUS_STATE`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_INVALID_MULTI_CUT_STATE`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SOURCE_SHOT`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH`
- `CORE_SHOT_VIDEO_TAKE_STRUCTURE_REFERENCE_REQUIRED`

## Data Migration

This change should update the current data model directly.

Because Renku Studio is pre-customer software:

- do not keep runtime compatibility readers for the old state shape;
- do not keep aliases for old fields;
- do not keep tests that validate obsolete state;
- do not expose the old command shape as a fallback.

If existing development databases need repair, use a one-way migration or
explicit data repair step. That migration may mention old field names only to
transform existing development data into the current model. Runtime code should
recognize only the new structure.

For preserving existing development data, the least surprising one-way
transformation is:

- create `version: 2`;
- set `mode: "multi-cut"`;
- move existing per-shot design entries into `directionsByShotId`;
- create empty directions for selected shots with no previous entry;
- move existing take-level reference selections into the relevant direction
  scope only according to the migration decision made during implementation.

If reference selection ownership cannot be inferred safely, the migration should
fail loudly for manual repair rather than guessing.

## Consequences

Benefits:

- continuous and multi-cut takes become explicit instead of inferred;
- UI editing behavior follows persisted structure instead of synchronizing
  duplicated state;
- agents can reason deterministically about whether instructions apply to the
  group or a selected shot;
- provider payload preview can show the correct shared or per-shot mapping;
- user overrides in Studio become the state the agent re-reads before
  generation.

Costs:

- persisted take state needs a versioned shape change;
- current take editing code must be updated from `shotDesignByShotId` to the
  structure union;
- reference selection state must move into the same structure model so
  continuous and multi-cut modes do not drift;
- mode switching requires explicit core commands and lossy-conversion
  confirmation in Studio.

## Non-Goals

- No per-shot overrides inside continuous mode in the first version.
- No automatic merging of divergent multi-cut directions.
- No React-local business rules for mode conversion.
- No CLI-local JSON rewriting for conversion.
- No generic patch API for take state.
- No compatibility layer for the old `shotDesignByShotId` shape.
