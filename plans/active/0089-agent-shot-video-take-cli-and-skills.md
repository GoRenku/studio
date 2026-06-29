# 0089 Agent Shot Video Take Authoring Document, CLI, And Skills

Status: proposed
Date: 2026-06-27
Revisited: 2026-06-28

## Summary

This plan covers the agent-facing authoring contract for Shot Video Takes after
the structure-mode work and the uniform reference-selection work in:

- `plans/active/0088-shot-video-take-structure-modes.md`
- `plans/active/0091-uniform-take-reference-sheet-selection.md`
- `docs/decisions/0039-use-uniform-shot-video-take-sheet-reference-selection.md`

Plan `0088` owns the take data model, Studio UX, structure conversion, and
mode-aware editing behavior.

Plan `0091` and ADR `0039` own the current sheet-reference selection model:
Character Sheets and Location Sheets are singular per editor direction, selected
sheet dependency ids are asset-scoped, missing sheet selections are
owner-scoped placeholders, and generation aggregates selected assets after
resolving the full direction set.

This plan owns:

- one deterministic authoring-context read command;
- one schema-first authoring document for applying the take proposal;
- validation and atomic application of that document through core;
- provider payload preview;
- obsolete CLI command removal;
- dialogue audio CLI bug fixes;
- source skill updates in the sister skills repository.

The important correction from the first draft is that the CLI should not expose
a large set of granular reference and direction commands. That would hard-code
today's dependency vocabulary into the CLI surface and force agents to perform
many small mutations for one coherent proposal.

Instead, the agent should produce one validated JSON document:

```text
SceneShotVideoTakeAuthoringDocument
```

Core validates the whole document, returns structured diagnostics, and applies
it atomically when valid.

## Current Codebase Revisit

The plan is still needed, but several assumptions have changed since the first
draft.

Current implemented facts:

- `SceneShotVideoTakeState.version: 2` and `SceneShotVideoTakeStructure` are
  implemented in core.
- `SceneShotVideoTakeReferenceSelections` now lives inside each
  `SceneShotVideoTakeDirection`.
- Character Sheet and Location Sheet selections are both singular maps:
  `selectedCharacterSheetAssetIds` and `selectedLocationSheetAssetIds`.
- Studio reference-selection routes already accept an optional `shotId`, so
  they update the current editor direction rather than whole-take reference
  state.
- Core and Studio now support deleting a prepared shot-video take input through
  `deleteShotVideoTakeInput`; the CLI still does not expose that command.
- `generation dialogue-audio` handlers expect `--scene`, `--dialogue`, and
  `--all`, but the top-level CLI dispatch still does not pass those flags into
  `runGenerationCommand`.
- `generation plan` still exists as a separate special-case command in
  `packages/cli/src/cli.ts` and `generation-plan-command.ts`.
- Core can build final provider payloads through shot-video spec
  validation/preparation, but the current production plan and preflight reports
  do not expose a first-class provider-payload preview for authoring review.
- The source `media-producer` skill still references nonexistent
  `renku take update` guidance and the obsolete `shotDesignByShotId` shape.

Plan changes from this revisit:

- The authoring document must use the current `SceneShotVideoTakeStructure`
  shape directly.
- The authoring document must not add a separate top-level reference-selection
  model. References belong inside each `SceneShotVideoTakeDirection`.
- The document contract must name the current singular sheet-selection fields
  and must reject old plural Location Sheet fields.
- Prepared input deletion is now a CLI exposure and notification problem, not a
  new core-domain problem.
- Dialogue-audio work should specifically fix CLI dispatch flag pass-through,
  then add end-to-end CLI tests that prove those flags reach the handlers.

## Product Direction

The agent is the primary generation authoring surface. Studio is the visual
review, override, and instruction surface.

Agent workflow should be:

1. read the current take authoring context;
2. prepare one complete authoring document;
3. validate the document;
4. apply it atomically;
5. show the result in Studio tabs and provider preview;
6. let the user override or deselect anything in Studio;
7. re-read the current approved state;
8. generate only after approval.

The CLI should keep this deterministic and simple for agents. The agent should
not need to call a dozen mutation commands to make one proposal real.

## Dependency On Current Take Contracts

This plan assumes the take state has the structure model from plan `0088`:

```text
continuous -> one shared SceneShotVideoTakeDirection
multi-cut  -> directionsByShotId
```

The authoring document uses that same model. Do not implement this plan against
the old `shotDesignByShotId` shape.

This plan also assumes the reference-selection model from ADR `0039`:

```ts
interface SceneShotVideoTakeReferenceSelections {
  dependencyInclusions: Record<string, "include" | "exclude">;
  selectedCharacterSheetAssetIds: Record<string, string>;
  selectedLocationSheetAssetIds: Record<string, string>;
  selectedLookbookSheetIds: string[];
  selectedDialogueAudioTakeIds: Record<string, string>;
}
```

These selections are nested in `SceneShotVideoTakeDirection`.

Do not implement this plan against:

- `referencedLocationSheetAssetIds`;
- plural per-direction Location Sheet selections;
- Cast-level or Location-level hidden defaults;
- route-local reference id building in CLI or Studio;
- a separate top-level `references` block that duplicates direction state.

## Research Findings Preserved From Initial Audit

The initial codebase and source-skill audit found that core and Studio are
close to the desired behavior, but the CLI and skills are not.

### Existing Core Coverage

Core already owns most of the important domain operations:

- read/list/create/delete Shot Video Takes;
- update take production state;
- update grouped shot membership;
- update structure mode and direction state in the current model;
- update character, Location Sheet, Lookbook, dialogue audio, and dependency
  inclusion selections for the resolved editor direction;
- build shot-video take context;
- read Studio edit context;
- list models and inputs;
- estimate, plan, preflight, and preview production;
- select, clear, and delete shot-video take inputs;
- build final shot-video provider payloads through the spec
  validate/prepare path.

The important architecture point is that CLI should call core. It should not
duplicate business rules in command handlers.

### Existing Studio Coverage

Studio already edits much of the same state through focused API calls:

- Composition and Motion edit take-owned state;
- Dialogs edit dialogue audio selection and inclusion;
- References edit character sheets, Location Sheets, Lookbook sheets, and
  inclusion;
- AI Production edits production state and reads planning/preflight data.
- Inputs can be selected, cleared, and deleted from Studio through core-owned
  commands.

Studio is evidence that the missing surface is primarily CLI/agent contract,
not browser-only business logic.

### Current CLI Read Coverage

The CLI can read pieces of the current take through:

- `renku studio current --json`;
- `renku take show --json`;
- `renku generation context --purpose shot.video-take`;
- `renku generation model list`;
- `renku generation input list`;
- `renku generation preflight`;
- `renku director context --json`.

That is too fragmented for the standard agent workflow. It is easy for an
agent to miss one required follow-up call or combine stale results.

### Current CLI Write Gaps

The current CLI cannot cleanly write the full shot-defining take state.

Known gaps:

- no current-model authoring document apply command;
- no complete authoring-context read that mirrors the Studio review surface;
- no first-class provider payload preview in authoring context/apply output from
  the same path used for spec creation;
- no way to apply grouped shot membership, direction, references, and AI
  Production as one coherent proposal;
- no CLI delete for prepared take inputs, even though core and Studio already
  support deletion;
- top-level `generation` dispatch currently drops dialogue-audio flags such as
  `--scene`, `--dialogue`, and `--all` before the handler sees them;
- existing `generation plan` is a lower-level obsolete shape and should be
  replaced directly. It still has special-case dispatch in `cli.ts`;
- source skills reference nonexistent or incomplete commands, including
  `renku take update`, and still describe the obsolete `shotDesignByShotId`
  state shape.

### Current Studio Coordination Gap

`renku studio current --json` is useful as a pointer to the visible take, but it
is not a complete authoring state source:

- Composition and Motion projections can include values, but they are scoped to
  the visible Studio selection rather than one stable authoring snapshot;
- Dialogs and References have richer core-backed reports now, including
  direction-scoped reference selections, but Studio current is still only focus
  coordination;
- AI Production planning/preflight reports include dependency inventory,
  references, estimate, and readiness, but not one atomic authoring proposal
  document;
- grouped shot membership must be read elsewhere;
- the focused tab can drift while the user keeps using Studio.

The agent should use Studio current to locate the take, then use the
authoring-context command as the complete source.

### Source Skills Gap

The source `media-producer` skill already describes the right high-level
workflow:

- establish the current take;
- read context;
- inspect models and inputs;
- write proposal state;
- preflight;
- preview before paid generation.

But it references missing or incomplete CLI surfaces and predates the
continuous versus multi-cut structure model. The skill should become simpler
after this plan because it can teach one document contract instead of many
small commands.

### Historical Urban Basilica Findings

The live sample take used during the initial audit was:

```text
scene_shot_video_take_cdstd9w8
```

It groups:

- `shot_001`;
- `shot_001b`;
- `shot_001c`;
- `shot_002`.

Observed state:

- only `shot_002` had take-owned visual design in the current model;
- Composition included `customComposition: Drone Flyover`,
  `shotSize: establishing-shot`, and wide lens;
- Motion included drone rig;
- Reference selections were empty;
- AI Production had `inputModeId: reference`;
- Seedance 2.0 was the default Reference route model;
- Lookbook sheet was ready;
- multi-shot storyboard sheet was missing;
- Narrator dialogue audio was needed;
- Narrator dialogue audio was blocked because Narrator had no Cast Voice;
- Theodosian Walls Location Sheet readiness was visible as a consistency gap.

This is the motivating workflow the new document contract must support. Re-read
the current Urban Basilica project before using these exact facts for
implementation verification, because the project is being edited alongside
Studio.

## Authoring Document Direction

Add one schema-first document owned by `packages/core`:

```text
SceneShotVideoTakeAuthoringDocument
```

The document should represent the whole editable shot-video take proposal that
an agent or user-reviewed UI state wants to apply.

Proposed shape:

```ts
export interface SceneShotVideoTakeAuthoringDocument {
  kind: "sceneShotVideoTakeAuthoring";
  takeId: string;
  sceneId: string;
  sourceShotListId: string;
  baseTakeUpdatedAt?: string;
  shotIds: string[];
  structure: SceneShotVideoTakeStructure;
  production: SceneShotVideoTakeProductionState;
}
```

Field intent:

- `kind` makes the file self-describing and validates against the right schema;
- `takeId`, `sceneId`, and `sourceShotListId` protect against applying the
  document to the wrong target;
- `baseTakeUpdatedAt` lets core detect stale agent proposals when the user has
  changed the take since the authoring context was read;
- `shotIds` declares grouped shot membership;
- `structure` carries `continuous` shared direction or `multi-cut`
  directions by shot id from plan `0088`;
- each direction in `structure` carries the current
  `SceneShotVideoTakeReferenceSelections` shape from ADR `0039`;
- `production` carries take-level AI Production setup.

The exact stale-write guard can be `baseTakeUpdatedAt`, a revision, or another
core-owned version token. The important behavior is that the apply command can
fail clearly instead of overwriting newer user review edits.

The authoring document should not introduce a separate reference DTO unless a
real core boundary requires it. Duplicating references outside
`SceneShotVideoTakeDirection` would create two sources of truth for the same
direction-scoped selection.

Reference-selection requirements inside each direction:

- `selectedCharacterSheetAssetIds` maps Cast Member id to one Character Sheet
  asset id;
- `selectedLocationSheetAssetIds` maps Location id to one Location Sheet asset
  id;
- selected concrete sheet dependencies use the asset-scoped ids returned by
  core, such as `cast-character-sheet:<cast-member-id>:<asset-id>` and
  `location-environment-sheet:<location-id>:<asset-id>`;
- missing sheet selections remain visible through owner-scoped placeholder ids
  in the authoring context;
- `dependencyInclusions` is keyed only by dependency ids returned by core in the
  authoring context or production plan;
- no caller may hand-build dependency ids, infer the first available sheet as a
  selection, or submit obsolete plural Location Sheet state.

## Document Validation

Add core validation for the authoring document.

Validation should collect all actionable issues before failing.

Validate:

- document `kind`;
- target take exists;
- `sceneId` and `sourceShotListId` match the take;
- optional base revision/update timestamp is current;
- `shotIds` belong to the source shot list;
- `shotIds` are valid for the take's history/editability rules;
- structure mode invariants from plan `0088`;
- direction payloads against JSON Schema;
- direction reference selections use the current ADR `0039` shape;
- no obsolete `shotDesignByShotId`, `referencedLocationSheetAssetIds`, plural
  Location Sheet selections, or compatibility aliases are accepted;
- reference ownership:
  - Character Sheets belong to referenced Cast Members;
  - Location Sheets belong to referenced Locations;
  - Lookbook sheets belong to selected Lookbook context;
  - dialogue audio takes belong to referenced scene dialogue;
- required-by-policy Location Sheet and visible Character Sheet selections are
  either selected, missing with clear authoring diagnostics, or deliberately
  excluded when current core policy allows exclusion;
- provider-route hard-required inputs cannot be excluded;
- explicit reference exclusions only use dependency ids returned by core;
- dialogue audio readiness and missing Cast Voice blockers;
- production state model/input-mode compatibility;
- route parameter compatibility;
- dependency prompt draft shape;
- final prompt draft shape.

Use structured diagnostics. Do not throw loose errors at package boundaries.

Suggested diagnostic prefix:

```text
CORE_SHOT_VIDEO_TAKE_AUTHORING_*
```

Example codes:

- `CORE_SHOT_VIDEO_TAKE_AUTHORING_STALE_CONTEXT`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_TARGET_MISMATCH`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_STRUCTURE`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_REFERENCE`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_REQUIRED_REFERENCE_MISSING`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_CAST_VOICE_MISSING`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_INVALID_PRODUCTION_ROUTE`;
- `CORE_SHOT_VIDEO_TAKE_AUTHORING_PROVIDER_PREVIEW_UNAVAILABLE`.

## Document Application

Applying the document should be atomic:

- validate the whole document;
- if validation has errors, persist nothing;
- if valid, update grouped shot membership, structure/directions, references,
  and production state in one core-owned operation;
- return the updated authoring context and resource keys for Studio refresh.

The public command is one document apply, but core can still be internally
well-factored. The implementation should use focused internal functions for:

- shot membership carry;
- structure conversion;
- direction pruning;
- direction-scoped reference selection validation;
- asset-scoped dependency id resolution;
- production state normalization;
- provider preview construction.

Do not expose those internal steps as a large CLI surface.

## CLI Direction

Use a small schema-first CLI surface:

```bash
renku take authoring context --take <take-id> --json
renku take authoring validate --file <authoring-document.json> --json
renku take authoring apply --file <authoring-document.json> --json
```

Optional review question:

- Should `apply` also accept `--take <take-id>` as a safety cross-check, or
  should the document `takeId` be the only target? If accepted, `--take` must
  match the document and should not replace the document target.

The CLI should not provide separate subcommands for each current reference kind.
Reference details belong inside the JSON document and schema.

The CLI should only:

- parse `--file`;
- call core validation/apply/context;
- print structured diagnostics and reports.

Implementation note from the current CLI:

- `take` currently supports only `list`, `show`, and `create` through
  `take-command.ts`.
- Add the authoring subcommands as focused structured handlers rather than a
  long local switch.
- Do not add `renku take update` or any generic state patching command.
- When the authoring apply command mutates a take, emit the same Studio
  resource-change notification shape used by existing take/generation
  mutations.

## Authoring Context

The authoring context command should give the agent everything needed to write
one valid authoring document.

Expected response:

- project, scene, shot list, and take;
- grouped shots in order;
- current structure mode;
- shared or per-shot directions;
- selected editor direction context when the caller asks for one;
- available references;
- required-by-policy references;
- selected Character Sheet and Location Sheet asset ids per editor direction;
- selected Lookbook sheets and dialogue audio takes per editor direction;
- explicit inclusions/exclusions by core-returned dependency id;
- missing Character Sheet and Location Sheet selections, including whether
  suitable assets exist;
- dialogue audio readiness;
- Cast Voice blockers;
- AI Production state;
- available model routes and route parameters;
- dependency prompt drafts;
- final prompt draft;
- provider payload preview;
- preflight readiness;
- estimate;
- structured blockers and warnings;
- current take revision/update token for stale-write protection.

`renku studio current --json` remains useful to locate the visible take. It does
not replace authoring context.

## Provider Payload Preview

Provider payload preview belongs in core/engines, not CLI formatting.

The current core implementation builds provider payloads through shot-video spec
validation/preparation. The authoring workflow needs a first-class preview that
uses that same path without forcing the agent to persist a final spec just to
review what will be sent.

The authoring context should include provider preview when the current state has
enough authored final-prompt and prepared-input data to construct one. The apply
report should also include the new preview after the document is applied.

The preview should be produced by the same path that later creates the
generation spec.

The preview should report:

- provider;
- provider model id;
- route/input mode;
- route parameters;
- final prompt;
- negative prompt if present;
- dependency prompts;
- selected image, audio, or video inputs;
- selected references;
- explicit exclusions;
- generated-audio setting;
- estimated cost;
- whether final spec creation is possible.

## Obsolete CLI Surface Cleanup

Replace and remove the old `generation plan` command shape directly.

Do not keep:

- aliases;
- compatibility command paths;
- fallback behavior for old plan output;
- tests whose purpose is preserving the obsolete command contract.

If a current command name is reused, its implementation and tests should reflect
only the new authoring-context/document contract.

Current code to remove/update:

- the `input[0] === 'plan'` special case in `packages/cli/src/cli.ts`;
- `packages/cli/src/commands/generation-plan-command.ts`;
- CLI tests that assert `renku generation plan` succeeds for
  `shot.video-take`;
- docs that still describe `generation plan` as a supported shot-video
  planning surface.

## Remaining CLI Fixes

### Dialogue Audio Flags

Fix top-level `generation` dispatcher flag pass-through for:

- `--scene`;
- `--dialogue`;
- `--all`.

The handler code already reads those fields. The current failure is that
`packages/cli/src/cli.ts` does not pass them into `runGenerationCommand`.

Add tests that run through `runRenkuCli`, not only handler-unit tests, for:

- `generation dialogue-audio plan --scene ...`;
- `generation dialogue-audio generate --scene ... --dialogue ...`;
- `generation dialogue-audio generate --scene ... --all --simulate`;
- `generation dialogue-audio pick --scene ... --dialogue ... --take ...`.

### Prepared Input Delete

Core and Studio already support prepared input deletion. Add the CLI surface if
agents still need to discard obsolete prepared inputs outside the authoring
document apply flow:

```bash
renku generation input delete --purpose shot.video-take --target scene:<scene-id> --take <take-id> --input <input-id> --json
```

If the authoring document can express removal of obsolete prepared inputs
cleanly, prefer the document contract and avoid adding another standalone CLI
command. If the standalone command is kept, it should be a thin adapter over the
existing `deleteShotVideoTakeInput` core service and should emit Studio
resource-change notification metadata.

## Agent Workflow Direction

The intended current-take workflow is:

1. `renku studio current --json` to find the visible take when needed.
2. `renku take authoring context --take <take-id> --json`.
3. Agent writes one `SceneShotVideoTakeAuthoringDocument`.
4. `renku take authoring validate --file <document.json> --json`.
5. Agent repairs validation issues if needed.
6. `renku take authoring apply --file <document.json> --json`.
7. User reviews Studio tabs and provider payload preview.
8. Agent re-reads authoring context after user approval.
9. Agent creates/runs generation specs only if the latest approved state is
   still valid.

No paid generation runs from stale agent memory.

## Source Skills Direction

Update the sister skills project:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

### `media-producer`

Update:

- `skills/media-producer/SKILL.md`;
- `skills/media-producer/references/shot-video-take.md`;
- `skills/media-producer/references/shot-multi-shot-storyboard-sheet.md`.

Required changes:

- replace nonexistent `renku take update` guidance;
- use `renku take authoring context` as the canonical current-take read;
- teach one `SceneShotVideoTakeAuthoringDocument` schema;
- explain continuous versus multi-cut structure mode;
- require agents to respect the current mode when writing direction;
- replace all `shotDesignByShotId` guidance with `structure.sharedDirection`
  and `structure.directionsByShotId`;
- document that Character Sheet and Location Sheet choices are singular
  per editor direction through `selectedCharacterSheetAssetIds` and
  `selectedLocationSheetAssetIds`;
- remove any guidance that implies first available Character Sheets or Location
  Sheets are hidden defaults;
- document that missing Character Sheet and Location Sheet selections must stay
  visible for user review;
- document explicit user inclusions/exclusions by core-returned dependency id;
- document Cast Voice as a blocker for dialogue audio generation;
- require provider payload preview before approval;
- require re-reading current state after user review and before generation;
- remove guidance that requires many granular reference commands.

### `movie-director`

Update:

- `skills/movie-director/references/workflow-playbooks.md`;
- `skills/movie-director/references/cli-coverage-and-gaps.md`.

Required changes:

- route current-take shot-video generation requests to media-producer;
- document that director context is broad readiness context, while authoring
  context is the exact current-take contract;
- document the dependency on take structure mode;
- document the one-document apply workflow.

### `scene-shot-designer`

Keep its boundary intact.

Scene-shot-designer owns scene shot list design. It should not own take
direction, AI Production settings, selected references, or generated media
paths.

Update only handoff language if needed.

## Documentation Direction

Update current docs after CLI contracts are accepted:

- `docs/cli/commands.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/studio-skills.md`;
- source skills docs in the sister repository.

Do not update historical plans solely to replace names.

The current architecture docs already include the structure-mode and uniform
sheet-selection direction. This plan's documentation work should focus on the
new authoring document, the final CLI command surface, provider preview
semantics, and source skill workflow changes.

## Completion Checklist

Use this checklist for implementation review and final signoff.

### Review Area

- [x] Confirm plan `0088` has accepted take structure contracts.
- [x] Confirm plan `0091` and ADR `0039` are the accepted sheet-reference
      selection contracts.
- [x] Confirm one authoring document is the accepted write contract.
- [x] Confirm CLI commands are thin adapters over core.
- [x] Confirm the CLI does not expose separate commands per reference kind.
- [x] Confirm no CLI command writes arbitrary take state outside the schema.
- [x] Confirm old `generation plan` shape is removed directly.
- [x] Confirm no `renku take update` or generic take-state patch command is
      introduced.
- [x] Confirm source skills do not instruct agents to use Studio routes or edit
      project data directly.

### Authoring Document Contract

- [x] Add `SceneShotVideoTakeAuthoringDocument`.
- [x] Add JSON Schema for the document.
- [x] Include target identity fields.
- [x] Include stale-write protection.
- [x] Include ordered `shotIds`.
- [x] Include `SceneShotVideoTakeStructure`.
- [x] Include `SceneShotVideoTakeProductionState`.
- [x] Validate direction payloads.
- [x] Preserve reference selections inside each
      `SceneShotVideoTakeDirection`.
- [x] Use singular `selectedCharacterSheetAssetIds` records.
- [x] Use singular `selectedLocationSheetAssetIds` records.
- [x] Reject obsolete `shotDesignByShotId` state.
- [x] Reject obsolete `referencedLocationSheetAssetIds` state.
- [x] Validate reference ownership.
- [x] Validate required-by-policy reference selections and visible missing
      selections.
- [x] Validate explicit inclusions/exclusions by core-returned dependency id.
- [x] Reject exclusions for provider-route hard-required inputs.
- [x] Validate production route compatibility.
- [x] Validate dependency prompt drafts and final prompt draft.

### Core Behavior

- [x] Add authoring-context core service.
- [x] Add authoring document validation service.
- [x] Add atomic authoring document apply service.
- [x] Return structured diagnostics for all validation failures.
- [x] Apply grouped shot membership through core.
- [x] Apply structure/directions through core.
- [x] Apply direction-scoped references through core.
- [x] Apply production state through core.
- [x] Return updated authoring context after apply.
- [x] Add provider payload preview through the spec creation path.
- [x] Reuse existing `deleteShotVideoTakeInput` behavior if standalone input
      deletion remains in scope.

### CLI Implementation

- [x] Add `renku take authoring context`.
- [x] Add `renku take authoring validate`.
- [x] Add `renku take authoring apply`.
- [x] Remove obsolete `generation plan` shape.
- [x] Remove the `generation plan` special case from `packages/cli/src/cli.ts`.
- [x] Delete `packages/cli/src/commands/generation-plan-command.ts`.
- [x] Fix `generation dialogue-audio` top-level flag pass-through for
      `--scene`, `--dialogue`, and `--all`.
- [x] Decide whether prepared input deletion belongs in the authoring document
      or `renku generation input delete`.
- [x] If `generation input delete` is added, wire it to
      `deleteShotVideoTakeInput`.
- [x] Emit Studio resource-change notifications for authoring apply and any
      retained input-delete command.
- [x] Keep command handlers focused and shallow.

### Provider Preview

- [x] Include provider and provider model id.
- [x] Include route/input mode.
- [x] Include final prompt and dependency prompts.
- [x] Include selected image/audio/video inputs.
- [x] Include selected references.
- [x] Include explicit exclusions.
- [x] Include route parameters.
- [x] Include estimate and readiness.
- [x] Confirm preview matches spec creation payload path.

### Skills

- [x] Update media-producer skill instructions.
- [x] Update media-producer shot-video-take reference.
- [x] Update media-producer multi-shot storyboard reference.
- [x] Remove `renku take update` from source skills.
- [x] Remove `shotDesignByShotId` from source skills.
- [x] Teach singular Character Sheet and Location Sheet selection by editor
      direction.
- [x] Teach that missing sheet selections remain visible choices, not hidden
      first-asset defaults.
- [x] Update movie-director workflow playbooks.
- [x] Update movie-director CLI coverage and gaps.
- [x] Confirm scene-shot-designer handoff remains bounded.

### Tests

- [x] Add core tests for authoring document validation.
- [x] Add core tests for atomic apply.
- [x] Add core tests for stale-write protection.
- [x] Add CLI tests for authoring context.
- [x] Add CLI tests for authoring validate.
- [x] Add CLI tests for authoring apply.
- [x] Add CLI tests for validation diagnostics.
- [x] Add CLI tests for provider preview output.
- [x] Add CLI tests for obsolete `generation plan` removal.
- [x] Add run-through CLI tests for dialogue-audio flag pass-through.
- [x] Add CLI or core tests for singular Location Sheet selection rejection of
      obsolete plural state.
- [x] Add CLI or core tests for selected Character Sheet and Location Sheet
      asset-scoped dependency ids in authoring context.
- [x] Add CLI tests for prepared input delete if that command remains.
- [x] Add source skill fixture or smoke validation if available.

### Final Verification

Automated core and CLI coverage exercises the authoring context, validation,
apply, stale-write protection, provider-preview presence, obsolete
`generation plan` rejection, and retained input deletion command. The manual
Urban Basilica workflow remains a follow-up because this implementation pass did
not mutate the local sample movie project.

- [ ] Open the Urban Basilica drone flyover take.
- [ ] Read authoring context.
- [ ] Write one authoring document for continuous drone flyover setup.
- [ ] Validate the document.
- [ ] Apply the document.
- [ ] Confirm Studio reflects the applied state.
- [ ] Confirm provider payload preview is present.
- [ ] Make a user override in Studio.
- [ ] Re-read authoring context.
- [ ] Confirm provider payload respects the override.
- [x] Confirm missing Cast Voice blocks dialogue audio generation.
- [x] Run focused package tests.
- [x] Run root checks required by the implementation scope.

## Success Criteria

This plan is successful when a Codex agent can use one schema-first authoring
document to prepare a Shot Video Take proposal that exactly matches the current
Studio-reviewed state, including structure mode, direction, references, AI
Production settings, provider payload preview, blockers, and estimate.

The workflow must not rely on:

- many granular mutation commands;
- direct database edits;
- Studio route shortcuts;
- generic state patching;
- obsolete command aliases;
- skill-side business-rule guesses.
