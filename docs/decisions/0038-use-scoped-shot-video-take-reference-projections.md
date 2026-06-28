# 0038 Use Scoped Shot Video Take Reference Projections

Date: 2026-06-28

Status: accepted

## Context

Shot Video Takes now have an explicit structure mode:

- `continuous`: one shared direction for the whole take;
- `multi-cut`: one direction per grouped shot id.

`SceneShotVideoTakeDirection` owns Composition, Motion, Dialogs, and
References. AI Production remains take-level.

The third review of the structure-mode implementation found that reference
mutations write multi-cut selections with a `shotId`, but several read helpers
still scan every direction in the take and return aggregate selected state.

That creates a mismatch:

- the editor writes to one shot direction;
- the editor reads from all shot directions;
- generation also reads from all shot directions, but for a different reason.

For example, if `shot_001` selects Character Sheet `A` and `shot_002` selects
Character Sheet `B`, the References tab for `shot_002` can still render `A`
because the read helper returns the first matching value from the take.

The same ambiguity affects Location Sheets, Lookbook Sheets, Dialogue Audio
takes, and include/exclude reference choices.

The mutation path also currently drops `shotId` for continuous takes before it
reaches the core state updater. That lets a stale shot-scoped request silently
mutate the shared continuous direction instead of failing with the existing
scope diagnostic.

## Decision

Shot Video Take reference reads and writes must use explicit core-owned
direction scopes.

Use three distinct scope concepts.

### Editor Direction Scope

Editor projection resolves to exactly one direction.

Rules:

- continuous mode resolves to `sharedDirection`;
- continuous editor projection does not accept a selected shot id as an
  ownership scope;
- multi-cut editor projection requires a valid grouped selected shot id;
- multi-cut editor projection reads
  `directionsByShotId[selectedShotId]`;
- missing or foreign selected shot ids fail with
  `CORE_SHOT_VIDEO_TAKE_STRUCTURE_SCOPE_MISMATCH`.

This scope is used by user-facing editor reads for:

- Composition;
- Motion;
- Dialogs;
- References;
- selected Character Sheet state;
- referenced Location Sheet state;
- selected Lookbook Sheet state;
- selected Dialogue Audio Take state;
- include/exclude card state.

### Generation Direction Set

Generation projection resolves to the ordered set of directions used by the
whole generated take.

Rules:

- continuous mode returns one direction: `sharedDirection`;
- multi-cut mode returns one direction per grouped shot id in take order;
- generation helpers may aggregate references across those directions, but
  they must be named as generation or whole-take dependency helpers;
- editor projection must not call aggregate generation helpers for selected
  state.

This scope is used by:

- dependency inventory;
- preflight inputs;
- final provider payload creation;
- estimate and validation paths that reason about the whole generated take.

### Mutation Direction Scope

Mutation projection resolves one write target before reading current
reference selections and before persisting updates.

Rules:

- continuous mutations reject any provided `shotId`;
- multi-cut mutations require `shotId`;
- multi-cut mutations reject a shot id outside the take;
- wrappers must not drop `shotId` to make a request fit the current mode;
- the core state updater remains the authority for structure-scope mismatch
  diagnostics.

## Implementation Rules

Core must expose or own focused helpers for:

- resolving one editor direction;
- resolving one mutation direction;
- resolving ordered generation directions;
- reading editor-scoped reference selections;
- reading generation-scoped reference selections.

Names must make scope obvious. Avoid names that hide the distinction, such as a
generic `ForTakeState` helper returning selected editor state.

Studio server routes must only parse request params and bodies, call core, and
serialize responses. They must not decide whether a reference belongs to a
shared or selected-shot direction.

React feature code must consume core projections and send user intent. It may
pass the currently selected shot id to core, but it must not become the source
of truth for direction-scope validation.

CLI and agent paths must use the same core scope helpers or core commands. They
must not rewrite take-state JSON locally.

## Consequences

Benefits:

- selected reference state in Studio matches the selected shot in multi-cut
  mode;
- generation can still aggregate dependencies across the whole take;
- stale shot-scoped requests against continuous takes fail instead of mutating
  shared state;
- function names and service contracts make editor versus generation reads
  reviewable;
- future CLI and agent authoring work can reuse the same scope model.

Costs:

- some current helpers need to be renamed or split;
- production-plan reads may need a selected-shot input or a separate editor
  reference read command;
- tests must cover shot 1 and shot 2 separately instead of relying on first
  shot behavior.

## Related Plans

- `plans/active/0088-shot-video-take-structure-modes.md`
- `plans/active/0090-shot-video-take-reference-scope-remediation.md`

## Related Decisions

- `0009-use-structured-diagnostics-at-package-boundaries.md`
- `0010-use-domain-naming-and-remove-obsolete-compatibility.md`
- `0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `0025-use-shared-media-generation-purpose-architecture.md`
- `0032-use-shared-generation-dependency-graph-as-reference-and-pricing-source.md`
