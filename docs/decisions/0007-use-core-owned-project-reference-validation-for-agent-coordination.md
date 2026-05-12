# 0007 Use Core-Owned Project Reference Validation For Agent Coordination

Date: 2026-05-07

Status: accepted

## Context

Renku Studio is being designed for collaborative work between a person, the
browser Studio UI, the `renku` CLI, and AI agents. Agents should be able to act
on behalf of the user across a spectrum:

- a user asks an agent to make one focused change, such as updating a cast
  member;
- a user reviews step by step while the agent updates scenes, clips, cast, and
  generation settings;
- a user gives a larger goal and the agent builds or updates many movie assets
  while Studio shows progress and review surfaces.

That makes references to durable project data central to the product. Commands
and coordination events will frequently point at records stored in the project
database, such as a cast member, sequence, scene, clip, visual language entry,
asset, generation task, or future episode.

Renku Studio already has an accepted storage boundary:

- project SQLite is the source of truth for durable project data;
- the Studio coordination event store is only for UI coordination.

The bug that motivated this decision exposed a weak spot in that boundary. A
`studio.focusRequested` event can target a scene, clip, or cast member that no
longer exists in the project database. The browser currently accepts that stale
selection as React state and then reports the request as applied. Later,
`renku studio current --json` enriches the selected focus from project data and
can produce a selected project with `context: null`.

That is not a data corruption bug, but it is a contract bug. Studio has reported
that it applied a focus request for project data that core cannot resolve from
the source of truth.

The tempting local fix is to add selection checks inside the browser Studio
coordination hook. That would fix the immediate symptom, but it would put
project-data validity in the wrong package and create a pattern that future UI
features would have to remember to copy.

Another tempting fix is to introduce a universal type such as
`ProjectEntityRef`. That is also premature. It risks creating a second
addressing model that has to be kept in sync with both the project data model
and the UI model. Some targets, such as `projectInformation`, `visualLanguage`,
or `casting`, are not individual database rows. They are operation or Studio
surface concepts over the project data model.

The scalable boundary is:

> If a command, action, or coordination event references durable project data,
> `@gorenku/studio-core` must validate that operation input against the loaded
> project data before the operation can succeed.

## Decision

Use core-owned, operation-shaped validation for project data references.

Do not introduce a generic `ProjectEntityRef` abstraction for this slice.
Instead, each public operation shape that references project data gets a
core-owned validator or resolver that validates that operation directly against
the current `Project` model.

For the current focus coordination slice, core should validate the existing
Studio focus contract:

```ts
export type MovieStudioSelection =
  | { type: 'projectInformation' }
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'clip'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };

export type StudioFocusRequest =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: MovieStudioSelection };
```

Core should expose validation/resolution functions for those operation shapes:

```ts
export type MovieStudioSelectionResolution =
  | {
      ok: true;
      selection: MovieStudioSelection;
      context: StudioCurrentContext;
    }
  | {
      ok: false;
      selection: MovieStudioSelection;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
    };

export function resolveMovieStudioSelectionForProject(
  project: Project,
  selection: MovieStudioSelection
): MovieStudioSelectionResolution;
```

The resolver validates against the actual project data model:

- `sequence` selections are valid only if `project.sequences` contains the id;
- `scene` selections are valid only if a sequence contains the scene id;
- `clip` selections are valid only if a scene contains the clip id;
- `cast` selections are valid only if `project.cast` contains the cast member
  id;
- `projectInformation`, `visualLanguage`, `storyboard`, and `casting` are valid
  project-level selections for a loaded project.

The resolver can also return the current context used by
`renku studio current --json`, so callers do not validate once and then perform
a second independent tree walk to build context.

Future commands should follow the same pattern. For example:

- `updateCastMember` validates its `castMemberId` against `project.cast`;
- `generateClipAssets` validates its `clipId` against the project clip tree;
- a future episode command validates its operation input against the episode
  model once episodes exist.

The shape being validated is the operation input. Core validation should not
force all operations through a universal reference type unless a later concrete
need proves that abstraction is worth the cost.

## Scope Boundaries

### Core Owns Durable Data Validation

Core owns:

- validation of operation inputs that reference durable project data;
- tree lookup against the current `Project` shape loaded from SQLite;
- structured diagnostics for missing or unsupported data references;
- reusable project lookup helpers when they reduce duplication;
- context construction that is derived from project data, such as
  `StudioCurrentContext`.

Core must not consume Studio coordination events as input to project reads or
writes. It validates operation payloads against project data only.

### Studio Owns UI Focus And Rendering

Studio owns:

- browser-only local focus and selection state;
- mapping a valid operation result to the best current UI surface;
- choosing which tab, panel, or editor should be shown for a valid target;
- forgiving display behavior for stale local UI state when that behavior is
  deliberately useful for the human-facing UI.

Studio must not treat a React selection value as proof that project data exists.
If Studio reports that an external focus request was applied, every project data
reference in that focus request must have passed core validation.

### Coordination Events Remain UI Coordination

The Studio coordination event store may contain references to project data, but
those references are not project data. They are coordination payloads that must
be checked against SQLite-backed project data before they are treated as
actionable.

For example, this event requests focus:

```json
{
  "type": "studio.focusRequested",
  "focus": {
    "screen": "movieStudio",
    "selection": { "type": "scene", "id": "scene_deleted" }
  }
}
```

The event itself does not prove `scene_deleted` exists. Core validation decides
that by checking the current project data.

## Consequences

- Stale focus requests fail with `studio.focusRequestFailed` instead of being
  acknowledged as applied.
- `renku studio current --json` should not report an actionable context for an
  unresolved project data reference.
- CLI and agent commands that mutate or inspect project records can share core
  lookup and validation rules instead of reimplementing existence checks in UI
  code.
- Future project entities, such as episodes, visual language entries, assets,
  generation tasks, pins, bindings, or takes, become externally addressable when
  their operation contracts and core validators are added.
- Browser-only UI details do not become part of the durable agent contract by
  accident.
- Adding new externally addressable operation inputs requires updating core
  validation and tests. That is intentional because the agent/CLI contract
  changed.

## Non-Goals

This decision does not introduce:

- a full UI automation framework;
- a universal `ProjectEntityRef` addressing model;
- a data representation of every React tab, panel, accordion, modal, or scroll
  position;
- project event sourcing;
- a replacement for SQLite project reads;
- compatibility aliases for old focus or selection shapes;
- a generic command bus for all future Studio actions.

Those may be considered later if the product needs them. This decision only
establishes the project data validation boundary needed for reliable
agent/user coordination.

## Required Rules For Future Features

When a new CLI command, agent-facing action, Studio server route, or coordination
event references durable project data, the feature must add:

- a deliberately named operation input shape;
- core validation of that input against the current `Project` model;
- structured diagnostics for missing or unsupported references;
- tests for valid inputs and stale/missing references;
- any required context construction for `renku studio current --json`;
- browser UI mapping only if Studio needs to focus or display the result.

When a new UI tab or panel is added but it does not represent a new operation
input or durable project data reference, it does not need a new core validation
contract. The UI can choose how to display already validated project data.

## Future Feature Placement Examples

The validator should live with the core operation that owns the behavior. Do not
put all validation into Studio coordination just because the browser may later
show the result.

### Cast Member Mutations

If a future command updates a cast member:

```bash
renku cast update cast_123 --name "Mehmed II"
```

the operation input might be:

```ts
export interface UpdateCastMemberInput {
  projectName: string;
  castMemberId: string;
  patch: CastMemberPatch;
}
```

The validation should live with the core project data operation that performs
the mutation, for example:

```text
packages/core/src/node/project/
  project-data-service.ts
  project-cast-member-validation.ts
  project-cast-member-validation.test.ts
```

That validator checks `castMemberId` against `project.cast` before the mutation
succeeds. The Studio coordination system may receive a refresh or focus request
after the command succeeds, but it is not responsible for deciding whether the
cast member exists.

### Clip Asset Generation

If a future command or agent action generates assets for a clip:

```bash
renku clip generate-assets clip_456
```

the operation input might be:

```ts
export interface GenerateClipAssetsInput {
  projectName: string;
  clipId: string;
  recipeKey: string;
}
```

The validation should live with the core service that queues or creates the
generation task, for example:

```text
packages/core/src/node/generation/
  generation-task-service.ts
  clip-generation-validation.ts
  clip-generation-validation.test.ts
```

That validator checks `clipId` against the project sequence/scene/clip tree and
checks that `recipeKey` is valid for the requested generation operation. Studio
can later focus the clip or show task progress, but the generation operation is
validated in core before it is queued.

### Cast-To-Clip Bindings

If a future operation binds a cast member to a clip:

```bash
renku clip bind-cast clip_456 cast_123
```

the operation input might be:

```ts
export interface BindCastMemberToClipInput {
  projectName: string;
  clipId: string;
  castMemberId: string;
  referenceSetId?: string;
}
```

The validation should live with the core service that owns bindings, for
example:

```text
packages/core/src/node/project/
  project-binding-service.ts
  project-binding-validation.ts
  project-binding-validation.test.ts
```

That validator checks all durable references in the operation:

- `clipId` exists in the project clip tree;
- `castMemberId` exists in `project.cast`;
- `referenceSetId`, if supplied, belongs to that cast member.

This avoids validating one id in the CLI, another id in Studio, and a third id
inside the write path.

### Future Episode Operations

When series support adds episodes, a future operation might update an episode:

```bash
renku episode update episode_789 --title "The Second Siege"
```

the operation input might be:

```ts
export interface UpdateEpisodeInput {
  projectName: string;
  episodeId: string;
  patch: EpisodePatch;
}
```

The validation should live with the episode-owning core operation, for example:

```text
packages/core/src/node/project/
  project-episode-service.ts
  project-episode-validation.ts
  project-episode-validation.test.ts
```

The ADR does not require adding an episode reference type now. Episode
validation appears when the project model and the operation contract actually
exist.

### Studio Focus And Current Context

Studio focus is different from the mutation examples above because the operation
being validated is a Studio coordination operation:

```ts
export type StudioFocusRequest =
  | { screen: 'projectLibrary' }
  | { screen: 'movieStudio'; selection: MovieStudioSelection };
```

Therefore its validation belongs near the core Studio coordination projection:

```text
packages/core/src/node/studio-coordination/
  studio-focus-validation.ts
  studio-focus-validation.test.ts
  studio-current-projection.ts
```

That validator checks whether the focus request points at project data that
exists. It does not own cast updates, clip generation, bindings, or episode
updates. It only protects the coordination contract: Studio must not report that
it applied focus to missing project data.

## Regression Checks

Use tests and review checks to keep the boundary from regressing:

- core focus validation returns `ok: false` with diagnostics for missing
  sequence, scene, clip, and cast member selections;
- `studio-current-projection` uses core validation before returning context for
  project-data focus;
- browser focus application does not report `appliedRequestId` for unresolved
  project data;
- CLI/core commands that accept project record ids fail at the core boundary
  when the record does not exist;
- coordination events never become the source of truth for whether project data
  exists.
