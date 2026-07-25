# 0155 Detach Shot Plans From Generated Video Assets

Status: completed
Date: 2026-07-24

## Summary

Replace the Shot Plan output model added by Plan 0154 with a smaller boundary:

- a Shot Plan is mutable authoring context for an ordered set of Shots;
- a Shot Plan may keep one `lastGenerationSpec` as a reusable authoring
  starting point;
- a saved `GenerationSpec` remains a mutable draft until live execution freezes
  it through the existing generic lifecycle;
- generated videos are ordinary project Assets whose existing Asset File
  provenance identifies the exact frozen Spec or Run that produced them;
- a Shot Plan does not own, freeze because of, delete, restore, select, or
  otherwise govern those Assets.

Retire `shot-plan.video` and its `shotPlan` generation target. Add the
project-scoped `video.create` purpose, parallel to `image.create`. A
`video.create` Spec may carry:

```ts
authoredFrom?: {
  kind: 'shotPlan';
  id: string;
}
```

`authoredFrom` is soft workflow context. It allows a future Generations tab to
find and order video Assets that were prompted from one Shot Plan, but it is not
an ownership relationship, foreign key, execution requirement, deletion rule,
or Shot Plan snapshot.

Keep Shot Plan duplication. Copying a Shot Plan creates new Shot ids and, when
the source has a last Spec, a new mutable `video.create` Spec with the same
request configuration and exact references. The copied Spec points its
`authoredFrom` context at the copied plan. No Run, Asset, Asset File, or media
is copied.

This plan changes Core, the generic generation and media-import adapters that
already expose purpose/target names, current documentation, and the
`media-producer` purpose guide. It does not build the Shot Plan or Generations
tabs.

## Accepted Product Requirements

### Requirement ledger

| Id | Requirement | Source |
| --- | --- | --- |
| R1 | Shot Plans remain directly editable after any number of video generations. | User request |
| R2 | Generation configuration remains frozen in the existing `GenerationSpec`; Shot Plan state is never snapshotted into an Asset or Run. | User request and Decision 0056 |
| R3 | A frozen Spec can be retried unchanged. A changed request starts as a new mutable Spec copied from the last frozen Spec. | User request |
| R4 | Each Shot Plan keeps one `lastGenerationSpec` pointer solely as the configuration to continue from, regardless of whether its Runs have failed, succeeded, or have not started. | User request |
| R5 | Generated videos are independent project Assets and are never attached to or owned by a Shot Plan. | User request |
| R6 | Asset inspection resolves only existing GenerationSpec/Run provenance; it does not open or reconstruct the Shot Plan. | User request |
| R7 | A soft Shot Plan origin marker may support future grouping, ordering, and display without referential validation or lifecycle coupling. | User request |
| R8 | Generated video deletion and recovery use ordinary Asset relationship Trash; Shot Plan deletion and recovery do not affect media. | User request |
| R9 | Shot Plan duplication remains available as an independent authoring convenience. | User request |
| R10 | Add no data migration or data-conversion logic because the feature has not been used and `urban-basilica` contains no Shot Plans, Shot Plan Specs, or Shot Plan Runs. | User direction and repository evidence |
| H1 | Prompts, references, Shot text, and generated media remain opaque to runtime code. | Decision 0041 and repository architecture |
| H2 | Durable rules and mutations remain Core-owned; CLI, Studio routes, React, and skills remain adapters. | Repository architecture |
| H3 | The schema remains Drizzle-first and package-boundary failures remain structured diagnostics. | Repository architecture |

Every implementation slice, test group, documentation change, and checklist
item below maps back to this ledger. No revision framework, output aggregate, or
dependency system is required by it.

### Shot Plan behavior

- A Shot Plan remains Scene-owned and directly mutable.
- Attaching, discarding, restoring, or permanently deleting an Asset never
  changes whether the plan can be edited.
- `updateShotPlan` never checks generation or Asset state.
- A Shot Plan keeps zero or one last Spec.
- “Last” means the most recently associated request configuration the user or
  agent should continue from. It does not mean a successful request, selected
  output, latest Asset, accepted video, active Run, or frozen Shot Plan
  revision.
- An early Shot Plan may have no last Spec.
- A mutable last Spec is edited through the existing generic Spec update
  operation.
- A frozen last Spec is retried unchanged through the existing generic Run
  operation.
- Starting a changed attempt copies the frozen last Spec into a new mutable
  Spec and atomically replaces the plan's last pointer.
- Starting or finishing a Run does not move or clear the last pointer.
- A failed Run caused by a network, provider, or other execution error leaves
  the exact frozen last Spec available for a later retry.
- A successful Run and resulting Asset also leave the same last pointer in
  place.
- Direct plan editing never mutates, refreshes, or invalidates the last Spec.
  The user or agent decides which prompt, model values, and exact references
  should change for the next request.

### Generation and Asset behavior

- `video.create` is a project-scoped video-generation purpose.
- It creates provider outputs and durable Runs through the existing generic
  lifecycle.
- Live execution freezes the exact saved Spec immediately before provider
  execution, exactly as Decision 0056 already requires.
- Failed Runs remain retryable against that frozen Spec.
- A changed request uses a copied mutable Spec; no Spec is unfrozen.
- An accepted managed or agent-external output is imported as an ordinary
  project Asset.
- `video.create` import requires exact managed-Run or frozen
  agent-external-Spec provenance. It is not a manual video-import purpose.
- The Project Asset relationship, Asset, Asset File, and existing provenance
  records are the complete durable media model.
- Multiple video Assets may originate from the same or different Specs. Core
  adds no one-output, one-Asset, selected-output, or final-output invariant.
- Assets can participate in other explicit Asset relationships later without
  changing or consulting the originating Shot Plan.
- The existing Generation Request inspector continues to read the Asset File's
  managed Run snapshot or agent-external frozen Spec. It does not resolve
  `authoredFrom` into Shot Plan content.

### Soft authoring context

`GenerationSpec.authoredFrom` is optional and initially has one supported
shape:

```ts
export type GenerationSpecAuthoredFrom = {
  kind: 'shotPlan';
  id: string;
};
```

The envelope validates only that the optional value has a recognized `kind`
and a non-empty `id`. Core does not:

- require the referenced Shot Plan to exist;
- add a database foreign key;
- reject a Spec, preview, estimate, execution, import, or inspection when the
  plan is missing, discarded, restored, edited, or copied;
- compare current Shot content with the frozen Spec;
- copy Shot Plan title, coverage, Shots, descriptions, briefs, or timestamps
  into the Spec;
- emit a stale-context warning;
- discard Specs, Runs, or Assets when the referenced plan is deleted.

The Shot Plan last-Spec command is allowed to require that the associated Spec
says it was authored from that exact plan. That is a focused consistency rule
for setting the last pointer, not global referential validation of
`authoredFrom`.

Future Shot Plan Generations UI may use `authoredFrom` plus existing Asset File
provenance to filter and order independent video Assets. This plan persists the
necessary context but does not add a durable Generation entity or implement the
tab.

### Shot Plan duplication

`copyShotPlan` remains a supported Core operation.

It copies:

- title;
- soft Beat coverage;
- Shot order, descriptions, and briefs into new Shot ids;
- the source last Spec's execution kind, title, model, opaque values, and exact
  references into a new mutable Spec when a last Spec exists.

For the copied Spec:

- purpose remains `video.create`;
- target remains the current Project;
- `authoredFrom` becomes `{ kind: 'shotPlan', id: <copied-plan-id> }`;
- `frozenAt` is `null`;
- no Run, output, Asset, Asset File, receipt, or provenance row is copied.

A source plan with no last Spec produces a copy with no last Spec.

## Explicit Non-Goals

This plan does not add:

- a `Generation`, `ShotPlanGeneration`, `Attempt`, output, candidate, or
  selected-video entity;
- Shot Plan revisions, snapshots, version numbers, edit conflicts, or history;
- a Shot Plan-to-Asset relationship, owner kind, join table, or foreign key;
- a Shot Plan Asset list stored on the plan;
- a selected, accepted, current, or final video;
- automatic Shot Plan last-Spec updates when a Run succeeds or fails, or when
  an Asset is imported, discarded, restored, or deleted;
- Shot Plan reconstruction from a frozen Spec;
- prompt synthesis, semantic Shot readiness, coverage analysis, or media
  inspection;
- automatic comparison between current Shot Plan authoring and a prior Spec;
- a generic provenance framework or a second Asset File provenance path;
- a general public Spec clone/fork API;
- manual import under the `video.create` purpose;
- the Shot Plan UI, Generations tab, Studio routes for those tabs, or complete
  Shot Plan CLI/agent authoring;
- any data migration, data conversion, preservation SQL, compatibility aliases,
  fallback readers, or diagnostics for `shot-plan.video`.

## Context And Evidence

### Current implementation

Plan 0154 is completed and introduced the current Core model:

- `shot_plan.generation_spec_id`;
- `shot_plan.video_asset_id`;
- `shot_plan.video_attached_at`;
- a one-video pair check and unique Asset index;
- `CORE_SHOT_PLAN_FROZEN`;
- `CORE_SHOT_PLAN_VIDEO_EXISTS`;
- `CORE_SHOT_PLAN_VIDEO_UNAVAILABLE`;
- `shot-plan.video` targeting `{ kind: 'shotPlan', id }`;
- a purpose-specific Shot Plan video attachment path;
- Shot Plan Trash ownership of the attached video;
- plan copying as the only way to continue after attachment.

Those pieces are internally consistent with Decision 0061, but the accepted
product requirement has changed. The output ownership and freeze behavior now
create the exact coupling this plan must remove.

### Existing contracts to reuse

- `GenerationSpecRecord.frozenAt` already defines the mutable-to-frozen
  lifecycle.
- `runGeneration` already freezes a managed Spec before a live provider call
  and permits exact frozen retries.
- `freezeGenerationSpec` already provides the external-execution handoff.
- `GenerationRun.specSnapshot` already retains the exact managed request.
- `asset_file_generation` already links one Asset File to the exact managed Run
  output.
- `asset_file.source_generation_spec_id` already links an agent-external Asset
  File to its frozen Spec.
- `readAssetFileGenerationRequest` already provides the read-only request
  inspector without needing a domain snapshot.
- `project_asset` already represents project-owned reusable Assets and supplies
  ordinary relationship Trash behavior.
- `persistGeneratedMediaAttachment` already persists an Asset, Asset File,
  provenance, and Asset relationship atomically.
- `image.create` already establishes the product naming and project-target
  precedent for generation capability that is independent from a destination.
- `copyGenerationSpecToTarget` is already an internal Generation-owned copying
  seam used by Shot Plan copying. It can be narrowed into the two focused Shot
  Plan authoring flows rather than exposed publicly.

### Repository and real-project evidence

- Migration `0064_shot_plans.sql` is the latest Drizzle migration.
- The current project-store schema generation is 50.
- `/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` is at
  generation 50 and contains:
  - zero `shot_plan` rows;
  - zero `shot-plan.video` Specs;
  - zero `shot-plan.video` Runs.
- The Shot Plan model has no current Studio route, dedicated UI, CLI command
  family, or Studio skill workflow.
- The only current Studio-purpose surface for `shot-plan.video` is the generic
  Preview title mapping.
- The sister `media-producer` skill currently has no active Shot Plan purpose
  workflow, so it needs only the new generic `video.create` declaration and
  future-handoff guidance; there is no used Shot Plan workflow to preserve.

### Accepted decisions

- Decision 0041 keeps creative artifacts and prompts opaque.
- Decision 0046 establishes `image.create` as project-scoped capability
  generation separated from destination attachment. `video.create` follows
  that same naming and ownership split.
- Decision 0049 keeps exact reference choices request-scoped in
  `GenerationSpec`.
- Decision 0052 separates narrative Beats from camera-authored Shots and
  rejects the former Shot Video Take aggregate.
- Decision 0056 freezes saved Specs at live execution and never unfreezes
  them.
- Decision 0061 currently defines one final Shot Plan video and Shot Plan
  freezing. The new decision in this plan supersedes those clauses while
  retaining the durable Shot Plan, Shot, Beat-context, direct-authoring,
  last-Spec convenience, and plan-copy contracts.

## Architecture Shape Gate

### Ownership

`packages/core` remains the sole owner of the changed durable contracts and
rules.

The intended module shape is:

```text
packages/core/src/client/
  generation.ts
    GenerationSpecAuthoredFrom, video.create purpose, project target,
    authoredFrom on GenerationSpec
  shot-plans.ts
    mutable Shot Plan with one last Spec and no video fields

packages/core/src/server/schema/
  media-generation.ts
    nullable authored_from_shot_plan_id column and lookup index
  shot-plans.ts
    lastGenerationSpecId property over the existing generation_spec_id column,
    no video columns or video check

packages/core/src/server/generation/
  specs.ts
    existing spec lifecycle plus internal authoring-copy operation
  spec-envelope.ts
    structural authoredFrom envelope validation only
  purposes/video-create.ts
    project-scoped video purpose
  purposes.ts
    registration only
  purpose-context.ts
    no Shot Plan target branch
  attachments.ts
    video.create Project Asset import through existing provenance validation
  attachment-destinations.ts
    focused project generated-video destination declaration

packages/core/src/server/shot-plans/
  authoring.ts
    plan mutation and last-Spec association, with no freeze guard
  generation-spec.ts
    create-next orchestration over the Generation-owned internal copy operation
  copying.ts
    plan/Shot copy plus optional last-Spec copy
  projection.ts
    last Spec projection, no video projection or warning
  trash.ts
    plan-only discard/restore, no Asset lifecycle

packages/core/src/server/project-asset-files/
  destinations/project-video.ts
    collision-safe durable project video paths
  destinations/registry.ts
    registration only
```

Delete:

```text
packages/core/src/server/generation/purposes/shot-plan-video.ts
packages/core/src/server/generation/reference-slots/shot-plan-video.ts
packages/core/src/server/project-asset-files/destinations/shot-plan-video.ts
packages/core/src/server/shot-plans/video-attachment.ts
```

### Public entrypoints

Keep:

```ts
createShotPlan(input: CreateShotPlanInput): Promise<ShotPlanReport>;
updateShotPlan(input: UpdateShotPlanInput): Promise<ShotPlanReport>;
copyShotPlan(input: CopyShotPlanInput): Promise<ShotPlanReport>;
readShotPlan(input: ReadShotPlanInput): Promise<ShotPlanReport>;
listSceneShotPlans(
  input: ListSceneShotPlansInput
): Promise<ShotPlanListReport>;
deleteShotPlan(
  input: DeleteShotPlanInput
): Promise<RecoverableMutationReport>;
```

Rename the last-Spec association deliberately:

```ts
setShotPlanLastGenerationSpec(
  input: SetShotPlanLastGenerationSpecInput
): Promise<ShotPlanReport>;
```

Add the focused convenience operation:

```ts
createNextShotPlanGenerationSpec(
  input: CreateNextShotPlanGenerationSpecInput
): Promise<ShotPlanReport>;
```

The input contains the project selector and `shotPlanId`. It does not accept a
generic patch, target override, Asset id, or provider values. Core reads the
last frozen Spec, copies it through the Generation owner, and atomically
updates the plan's last pointer.

The existing generic generation entrypoints continue to own create, update,
preview, validate, estimate, freeze, run, read, list, and media import.

### Internal ownership split

`generation/specs.ts` owns one internal:

```ts
copyGenerationSpecForAuthoring(input: {
  sourceSpecId: string;
  newSpecId: string;
  authoredFrom: GenerationSpecAuthoredFrom;
  session: DatabaseSession;
  now: string;
}): GenerationSpecRecord;
```

It copies the exact request envelope, replaces `authoredFrom`, resets
`frozenAt`, and creates no Run or Asset. It does not know about Shot Plan rows
or transactions beyond the supplied session.

`shot-plans/generation-spec.ts` owns the Shot Plan-specific transaction:

1. require the active Shot Plan;
2. require its last Spec;
3. require that Spec to be frozen;
4. call `copyGenerationSpecForAuthoring`;
5. replace the Shot Plan's `lastGenerationSpecId` property;
6. return the normal Shot Plan projection through the command layer.

`shot-plans/copying.ts` reuses the same internal Generation operation while
copying the plan. It does not call the public create-next operation and does not
duplicate Spec-copy logic.

### Purpose and target shape

Replace:

```ts
'shot-plan.video'
{ kind: 'shotPlan'; id: string }
```

with:

```ts
'video.create'
{ kind: 'project'; id: string }
```

Remove `shotPlan` from `GenerationTarget` because no remaining purpose uses it.
`GenerationSpecAuthoredFrom` is a separate soft-context type and must not be
added to `GenerationTarget` or `AssetTarget`.

`video.create`:

- has output media kind `video`;
- recommends the Project aspect ratio through the existing setting mechanism;
- lists available video models through the existing Engines catalog;
- accepts ordinary exact Spec references;
- has no Shot Plan facts, target resolver, Cast/Location inference, Beat
  context, prompt synthesis, or Shot-specific reference-slot registry.

The agent reads the mutable Shot Plan separately and authors the request. Core
does not copy Shot text into purpose facts.

### Project Asset attachment

Add one focused attachment destination for `video.create`:

- target: `{ kind: 'project' }`;
- Asset type: `generated-video`;
- relationship role: `generated-video`;
- Asset File role: `primary`;
- media kind: `video`;
- origin: `generated`;
- durable root: `videos/`;
- collision-safe file naming based on the meaningful supplied title or
  `generated-video`, preserving the source extension.

The attachment uses the existing `persistGeneratedMediaAttachment` transaction.
It requires one exact managed receipt or one frozen agent-external source Spec.
It creates no Shot Plan row update, Shot Plan relationship, special output
record, or second provenance record.

### Files expected to shrink or remain thin

- `shot-plans/authoring.ts` loses `assertShotPlanEditable` and all video-state
  checks.
- `shot-plans/projection.ts` loses Asset reads and video warnings.
- `shot-plans/trash.ts` becomes a small plan-only Trash definition and no
  longer imports Asset-tree lifecycle helpers.
- `generation/attachments.ts` replaces the Shot Plan branch with one ordinary
  project-video destination case; it must not absorb Shot Plan logic.
- `generation/purpose-context.ts` loses the Shot Plan target fact builder.
- package `index.ts` files remain export-only.
- purpose, destination, command, and service wiring registries remain bounded
  registrations rather than implementations.

### Forbidden implementation shape

Stop and revise the implementation if it starts adding:

- a Shot Plan generation/output/attempt table or public entity;
- any Shot Plan-to-Asset id, relationship, owner kind, or join table;
- Shot Plan snapshots in Specs, Runs, Assets, or provenance;
- a new generation provenance table;
- a selected/current/final video field;
- Asset-driven Shot Plan mutability or status;
- Shot Plan existence validation for `GenerationSpec.authoredFrom`;
- a resolver that injects current Shot Plan content into frozen request
  inspection;
- automatic Spec rewriting when a Shot Plan changes;
- a general public Spec clone/fork service;
- a generic lifecycle, owner, dependency, or reconciliation framework;
- purpose business rules in CLI, Studio routes, React, or skills;
- a large purpose switch, destination switch, or transaction function combining
  validation, persistence, filesystem work, and response formatting;
- implementation logic in package `index.ts` files;
- source-text architecture tests that freeze helper or command names.

## Contracts

### Generation contracts

Update:

```ts
export type GenerationPurpose =
  | 'image.create'
  | 'video.create'
  | /* current remaining purposes */;

export type GenerationTarget =
  | { kind: 'project'; id: string }
  | /* current remaining targets, without shotPlan */;

export type GenerationSpecAuthoredFrom = {
  kind: 'shotPlan';
  id: string;
};

export interface GenerationSpec {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  authoredFrom?: GenerationSpecAuthoredFrom;
  executionKind: 'renku-managed' | 'agent-external';
  model?: GenerationModelIdentity;
  values: Record<string, JsonValue>;
  references: GenerationReferenceSelection[];
  nextPromptMentionNumber?: number;
  title?: string;
}
```

`authoredFrom` is persisted with the Spec and copied into managed
`GenerationRun.specSnapshot` through the existing structured clone. It is not
added separately to `GenerationRun`, Asset, Asset File, or provenance rows.

Extend `listGenerationSpecs` with an optional exact filter:

```ts
authoredFrom?: GenerationSpecAuthoredFrom;
```

This is a lookup aid for future adapters and agent workflows. The Shot Plan
read continues to return its direct last Spec, so normal authoring does not
need to search by timestamp.

### Shot Plan contracts

Replace the current public projection with:

```ts
export interface ShotPlan {
  id: string;
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: Shot[];
  lastGenerationSpec: GenerationSpecRecord | null;
  createdAt: string;
  updatedAt: string;
}
```

Remove:

```ts
videoAssetId
videoAssetFile
videoAttachedAt
```

Use:

```ts
export interface SetShotPlanLastGenerationSpecInput
  extends ShotPlanProjectInput {
  shotPlanId: string;
  lastGenerationSpecId: string;
}

export interface CreateNextShotPlanGenerationSpecInput
  extends ShotPlanProjectInput {
  shotPlanId: string;
}
```

`setShotPlanLastGenerationSpec` associates the first or a deliberately selected
replacement Spec. The Spec must:

- exist;
- have purpose `video.create`;
- target the current Project;
- contain `authoredFrom: { kind: 'shotPlan', id: shotPlanId }`.

It may be mutable or frozen. The operation changes only the convenience
pointer; it never changes the Spec, any Run, or any Asset.

There is no public operation to clear an established last Spec. A newly created
Shot Plan remains nullable until its first Spec is associated. Run failure,
success, retry, or Asset lifecycle changes never clear or replace it.

`createNextShotPlanGenerationSpec` requires:

- an active Shot Plan;
- a non-null last Spec;
- a frozen last Spec.

It creates a new mutable copy and replaces `lastGenerationSpec` atomically.
That copy is now the last Spec even before it runs. Later Run failures,
successes, retries, and Asset lifecycle operations do not alter the pointer.

Use structured diagnostics:

- retain `CORE_SHOT_PLAN_NOT_FOUND`;
- retain `CORE_SHOT_PLAN_GENERATION_SPEC_INVALID` for a pointer association
  whose purpose, Project target, or `authoredFrom` context does not match;
- add `CORE_SHOT_PLAN_GENERATION_SPEC_MISSING` when create-next has no source;
- add `CORE_SHOT_PLAN_GENERATION_SPEC_MUTABLE` when the caller asks for a next
  Spec while the last draft can still be edited;
- remove `CORE_SHOT_PLAN_FROZEN`;
- remove `CORE_SHOT_PLAN_VIDEO_EXISTS`;
- remove `CORE_SHOT_PLAN_VIDEO_UNAVAILABLE`.

### Persistence

Keep these `shot_plan` columns:

```text
id
scene_id
title
coverage
generation_spec_id
created_at
updated_at
discarded_at
discard_operation_id
restored_at
```

The Drizzle property and all public contracts name this field
`lastGenerationSpecId` / `lastGenerationSpec`. The existing physical
`generation_spec_id` column remains because it already stores exactly this
single nullable pointer; renaming storage would add schema churn without
changing the model.

Drop:

```text
video_asset_id
video_attached_at
shot_plan_video_asset_unique_idx
shot_plan_video_attachment_pair_check
```

Add one nullable column to `media_generation_spec`:

```text
authored_from_shot_plan_id
```

Add an index on
`(purpose, authored_from_shot_plan_id, created_at, id)`.

There is no foreign key from `authored_from_shot_plan_id` to `shot_plan`.
Because `shotPlan` is the only accepted public `authoredFrom.kind`, a separate
kind column and pair check would add no information while forcing a rebuild of
the existing generation-spec table.

### Schema evolution only; no data migration

Generate migration `0065` through Drizzle Kit and set:

```sql
PRAGMA user_version = 51;
```

This generated migration is the DDL required to move the database to the new
schema; it is not a data migration. It contains only schema changes generated
from the Drizzle source of truth plus the required schema-generation statement.
It contains no:

- `shot-plan.video` data translation;
- Spec or Run JSON rewriting;
- Asset reassignment;
- Shot Plan row preservation logic beyond Drizzle's normal table rebuild;
- compatibility table, alias, reader, or fallback;
- custom data-conversion SQL.

This is accepted because the feature has not been used and the real development
project contains no affected rows. Apply the migration only to a verified
temporary copy during implementation verification.

## Implementation Slices

### Slice 1: accept the corrected ownership decision

- Add
  `docs/decisions/0062-detach-shot-plans-from-generated-video-assets.md`.
- Add a concise supersession notice near the top of Decision 0061 stating that
  Decision 0062 removes final-video ownership and Shot Plan freezing while
  retaining durable mutable Shot Plans, ordered Shots, soft Beat context, the
  last-Spec convenience pointer, and plan duplication.
- Update the notice in Decision 0056 so both copy-last and plan-duplication
  paths are recognized as focused ways to create new mutable Specs without
  changing the frozen source.
- Leave the historical bodies of Decisions 0061 and 0056 intact.

### Slice 2: change the Spec envelope and generic video purpose

- Add `GenerationSpecAuthoredFrom` and optional `authoredFrom` to the
  browser-safe generation contract.
- Persist and round-trip the nullable authored-from Shot Plan id.
- Extend the shared Spec envelope validator with structural validation only.
- Extend Spec listing with the optional exact authored-from filter.
- Replace `shot-plan.video` with `video.create`.
- Replace its Shot Plan target with the current Project target.
- Delete Shot Plan purpose facts and Shot Plan reference-slot composition.
- Register `video.create` using the existing purpose and video-model machinery.
- Remove `shotPlan` from generic generation target parsing and runtime unions.

### Slice 3: make Shot Plans permanently mutable and preserve the last Spec

- Remove video fields from Shot Plan contracts, projections, database access,
  schema, warnings, and tests.
- Remove the authoring freeze guard.
- Rename the last-Spec public command and input deliberately.
- Add `shot-plans/generation-spec.ts` for create-next orchestration.
- Refactor the Generation-owned internal copy function into
  `copyGenerationSpecForAuthoring`.
- Rename the Drizzle property and public contract to
  `lastGenerationSpecId` / `lastGenerationSpec`; retain the existing physical
  `generation_spec_id` column as the one last configuration pointer.
- Validate focused pointer association without introducing global
  `authoredFrom` referential validation.

### Slice 4: retain independent Shot Plan duplication

- Keep `copyShotPlan`.
- Continue copying the plan and ordered Shots to new ids.
- Copy the optional last Spec into a new mutable Spec.
- Keep the target Project unchanged and replace only `authoredFrom` with the
  copied plan id.
- Copy no Runs, Assets, Asset Files, or media.

### Slice 5: make generated videos ordinary Project Assets

- Delete the Shot Plan video attachment implementation and path resolver.
- Add the project generated-video destination and collision-safe `videos/`
  storage path.
- Add the `video.create` attachment destination using
  `persistGeneratedMediaAttachment`.
- Require exact managed or frozen external provenance for this purpose.
- Create one Project Asset relationship per imported output.
- Keep Asset inspection on the existing Run/Spec provenance path.
- Allow ordinary Asset relationship discard, restore, and later attachment
  without consulting the Shot Plan.

### Slice 6: simplify Shot Plan Trash

- Remove Asset ids and Asset lifecycle flags from the Shot Plan Trash snapshot.
- Discard and restore only the Shot Plan row; contained Shots remain behind the
  discarded parent as today.
- Leave the last Spec, historical Specs, Runs, Project Assets, Asset Files,
  provenance, and referenced media unchanged.
- Remove Shot Plan-specific Asset file collection from garbage collection.

### Slice 7: generate the schema migration

- Edit the Drizzle schemas first.
- Generate migration 0065 and its journal/snapshot through Drizzle Kit.
- Add schema generation 51.
- Add no data migration, data conversion, or custom preservation SQL.
- Verify fresh database creation and generation-50-to-51 schema upgrade on
  empty Shot Plan state.

### Slice 8: update adapters, skills, and current documentation

- Update generic CLI purpose/target parsing from
  `shot-plan.video + shot-plan:<id>` to `video.create + project`.
- Update `renku media import` behavior and command documentation for a
  provenance-backed `video.create` Project Asset.
- Update the Studio Generation Preview title mapping to `video.create`;
  add no Shot Plan UI branch.
- Update the sister `media-producer` purpose/target matrix, sample Spec, and
  workflow guidance to use `video.create`, `project`, and optional
  `authoredFrom`.
- Document that the future Shot Plan Generations tab is a projection over
  independent Assets and provenance, not a Shot Plan-owned collection.
- Run focused and root verification.

## Tests And Guardrails

### GenerationSpec lifecycle and context

- Round-trip absent and present `authoredFrom`.
- Reject malformed authored-from envelopes structurally.
- Accept a missing, discarded, edited, restored, or unknown Shot Plan id in an
  otherwise valid Spec.
- Confirm preview, validation, estimate, run, and request inspection do not
  resolve Shot Plan content through `authoredFrom`.
- Filter Spec listing by exact `authoredFrom`.
- Freeze `video.create` at live execution and retry the same frozen Spec after
  a failed Run.
- Confirm a new changed attempt uses a new mutable Spec and leaves the frozen
  source unchanged.

### Mutable Shot Plans and last Spec convenience

- Edit title, coverage, Shot order, descriptions, and briefs before and after
  any generated video Asset exists.
- Associate a matching last `video.create` Spec.
- Reject association of the wrong purpose, non-Project target, or mismatched
  `authoredFrom`.
- Create-next from a frozen last Spec and verify:
  - new Spec id;
  - `frozenAt: null`;
  - same purpose, Project target, execution kind, title, model, values, and
    exact references;
  - same Shot Plan `authoredFrom`;
  - atomic replacement of the last pointer;
  - no copied Run or Asset.
- Reject create-next when the last Spec is absent.
- Reject create-next when the last Spec is still mutable and can be edited
  directly.
- Confirm Shot Plan edits do not mutate the last Spec.
- Confirm a failed managed Run leaves `lastGenerationSpec` unchanged and the
  same frozen Spec remains retryable.
- Confirm a successful managed Run leaves `lastGenerationSpec` unchanged.
- Confirm managed and agent-external Asset import, discard, restore, and
  deletion leave `lastGenerationSpec` unchanged.

### Shot Plan duplication

- Copy a plan with no last Spec.
- Copy a plan with a mutable last Spec.
- Copy a plan with a frozen last Spec.
- Verify new plan and Shot ids, copied authoring, no media, and a new mutable
  Spec whose `authoredFrom.id` is the copied plan id.
- Confirm the source plan, source Spec, Runs, and Assets are unchanged.

### `video.create` and Project Assets

- Register `video.create` as project-scoped video generation.
- List video models through the existing catalog.
- Keep ordinary exact references available without Shot Plan slot inference.
- Confirm purpose context contains no Beat, Shot, description, brief, or Shot
  Plan facts.
- Import one exact managed output and one frozen agent-external output in
  separate fixtures.
- Reject import without generated provenance.
- Confirm import creates:
  - one Asset;
  - one primary video Asset File;
  - one Project Asset relationship;
  - existing managed-Run or external-Spec provenance;
  - no Shot Plan mutation or relationship.
- Import multiple outputs from the same or different Specs without one-video
  or selected-output rejection.
- Confirm durable path collision handling under `videos/`.
- Confirm the Generation Request inspector shows only the frozen request and
  does not fetch the Shot Plan.

### Independent Trash behavior

- Discard and restore one generated Project video through ordinary Asset
  relationship Trash.
- Confirm the originating Shot Plan and its last Spec pointer are unchanged.
- Delete and restore a Shot Plan with last and historical Specs and several
  generated video Assets.
- Confirm every Spec, Run, Asset, Asset File, and provenance row remains
  unchanged and available according to its own lifecycle.
- Confirm Shot Plan garbage-collection discovery returns no Asset files.

### Migration

- Create a fresh generation-51 project and inspect the exact current columns,
  constraints, and indexes.
- Upgrade a generation-50 fixture with zero Shot Plans and verify:
  - schema generation 51;
  - no video columns or video-pair check;
  - `generation_spec_id` remains present and nullable as the physical last-Spec
    pointer;
  - the authored-from Shot Plan id column and index are present;
  - `PRAGMA foreign_key_check` passes;
  - `PRAGMA quick_check` returns `ok`.
- Assert that migration 0065 contains no purpose translation, JSON rewrite,
  Asset reassignment, or other data-conversion statements.

### Stable architecture guardrails

- Protect the public contract shape: Shot Plan has one last Spec and no
  video fields.
- Protect the runtime boundary: Asset operations never control Shot Plan
  mutability.
- Protect the import boundary: `video.create` persists to a Project Asset
  relationship, not a Shot Plan relationship.
- Protect the context boundary: `authoredFrom` is not a generation target,
  Asset target, or foreign key.
- Protect package import boundaries and keep `index.ts` files thin.
- Do not add source-text needles for private functions, helper names, registry
  inventories, or retired implementation names.
- Preserve existing image, audio, preview, Run, Asset, and Trash regressions.

## Documentation

Create:

- `docs/decisions/0062-detach-shot-plans-from-generated-video-assets.md`

Add concise notices only:

- `docs/decisions/0061-use-mutable-copy-and-freeze-shot-plans.md`;
- `docs/decisions/0056-freeze-generation-specs-at-live-execution.md`.

Update current references:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/cli/commands.md`;
- the relevant `media-producer` references, purpose matrix, sample Spec, and
  eval expectations under
  `/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/`.

Current documentation must state:

- Shot Plans are mutable regardless of generation or Asset history;
- `lastGenerationSpec` is the most recently associated reusable request
  configuration, regardless of Run success or failure;
- Run and Asset lifecycle events never move or clear `lastGenerationSpec`;
- frozen Specs are retried unchanged and copied into new mutable Specs for
  changed attempts;
- plan duplication remains available and may copy the last Spec;
- `video.create` is project-scoped and independent from destination ownership;
- generated videos are Project Assets with existing exact provenance;
- `authoredFrom` is soft information-only context;
- Asset inspection does not reconstruct a Shot Plan;
- Shot Plan and Asset Trash lifecycles are independent;
- there is no Generation/Attempt/output entity, final video, selected video,
  Shot Plan Asset relationship, or data conversion.

Do not rewrite the historical bodies of older ADRs or completed plans. Do not
edit the user's untracked
`plans/exploration/shot-plan-explorations.md`.

## Final Verification

Run focused verification:

```bash
pnpm --dir packages/core build
pnpm --dir packages/core test
pnpm --dir packages/core lint
pnpm --dir packages/core check
pnpm --dir packages/cli build
pnpm --dir packages/cli test
pnpm --dir packages/cli lint
pnpm --dir packages/cli check
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio check
```

Validate the touched `media-producer` skill with its repository-owned
validation commands.

Run root verification:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Generate migration 0065 through Drizzle Kit, apply it to:

- a fresh temporary project database;
- a verified temporary copy of the generation-50 `urban-basilica` database.

Do not mutate the real project. On both temporary databases, inspect
`PRAGMA user_version`, `PRAGMA table_info`, `PRAGMA foreign_key_check`, and
`PRAGMA quick_check`.

Perform the final architecture-shape review:

- inspect `git diff --stat` and the complete diff;
- inspect every new or heavily modified Core file;
- confirm `shot-plans/authoring.ts`, `shot-plans/trash.ts`,
  `generation/attachments.ts`, and `generation/purpose-context.ts` became
  smaller or stayed focused;
- confirm deleted Shot Plan media modules were not replaced by a catch-all;
- confirm `index.ts` files remain thin entrypoints;
- confirm there is no Shot Plan-to-Asset relationship or snapshot;
- confirm `authoredFrom` is never used to validate execution or resolve creative
  context;
- confirm no checklist item was satisfied by accepting a god file, broad
  dispatcher, or adapter-owned business rule.

## Completion Checklist

### Review Area

- [x] Confirm every implementation concept maps to R1-R10 or H1-H3.
- [x] Confirm Shot Plan authoring remains mutable after any generation or Asset
      lifecycle event.
- [x] Confirm generated videos are independent Project Assets.
- [x] Confirm the implementation preserves accepted package ownership
      boundaries.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Replace `shot-plan.video` with project-scoped `video.create` directly,
      with no alias.
- [x] Remove `shotPlan` from `GenerationTarget`.
- [x] Add structurally validated, referentially soft
      `GenerationSpecAuthoredFrom`.
- [x] Persist and list-filter the optional authored-from context.
- [x] Keep `authoredFrom` out of `GenerationTarget`, `AssetTarget`, and foreign
      keys.
- [x] Remove Shot Plan video fields from browser contracts and projections.
- [x] Keep one nullable `lastGenerationSpec` pointer on Shot Plan.
- [x] Rename the public association command to
      `setShotPlanLastGenerationSpec`.
- [x] Add `createNextShotPlanGenerationSpec`.
- [x] Keep the last pointer unchanged across failed and successful Runs,
      retries, and every Asset lifecycle operation.
- [x] Keep package-boundary diagnostics structured.
- [x] Remove obsolete freeze, second-video, and unavailable-video diagnostics.
- [x] Keep durable mutation and validation rules in Core.
- [x] Add no compatibility shims, fallback readers, or obsolete purpose
      recognition.

### GenerationSpec And Purpose Implementation

- [x] Add `video.create` in a focused purpose module.
- [x] Reuse the project target, video model catalog, settings, preview,
      estimate, freeze, and Run lifecycle.
- [x] Remove Shot Plan purpose facts and reference-slot inference.
- [x] Keep exact references request-scoped and opaque.
- [x] Add the internal `copyGenerationSpecForAuthoring` operation without
      exposing a public generic clone API.
- [x] Preserve exact source Specs and Runs when creating a next draft.
- [x] Ensure Spec inspection never reads Shot Plan content.

### Shot Plan Implementation

- [x] Remove the Shot Plan authoring freeze guard.
- [x] Remove all video reads and warnings from Shot Plan projection.
- [x] Implement focused last-Spec association validation.
- [x] Implement atomic create-next from the last frozen Spec.
- [x] Keep direct plan editing independent from last Spec contents.
- [x] Keep `copyShotPlan`.
- [x] Copy the optional last Spec into a new mutable Spec for the copied
      plan.
- [x] Copy no Run, Asset, Asset File, receipt, provenance, or media.

### Project Assets And Trash

- [x] Delete the Shot Plan video attachment and destination modules.
- [x] Add the focused project generated-video destination under `videos/`.
- [x] Import `video.create` outputs as Project Assets through the existing
      attachment transaction.
- [x] Require exact managed or frozen external provenance.
- [x] Create no Shot Plan Asset relationship or output record.
- [x] Allow multiple independent generated video Assets.
- [x] Keep Generation Request inspection on existing Asset File provenance.
- [x] Simplify Shot Plan Trash to plan-only discard and restore.
- [x] Confirm Asset deletion and recovery use ordinary relationship Trash.
- [x] Confirm Shot Plan deletion never affects media or generation history.

### Schema And Drizzle DDL

- [x] Remove `video_asset_id`, `video_attached_at`, their unique index, and
      their pair check from the Drizzle Shot Plan schema.
- [x] Expose the existing nullable unique `generation_spec_id` through the
      deliberate Drizzle/public name `lastGenerationSpecId`.
- [x] Add the nullable authored-from Shot Plan id column and lookup index to the
      Drizzle Generation Spec schema.
- [x] Generate migration 0065 and Drizzle journal/snapshot files.
- [x] Set schema generation 51.
- [x] Add no data migration, data conversion, preservation SQL, JSON rewrite,
      or Asset reassignment.
- [x] Verify fresh and empty generation-50 upgrade paths.

### CLI, Studio, And Agent Surfaces

- [x] Update generic generation purpose/target parsing to
      `video.create + project`.
- [x] Update generic media import for provenance-backed Project video Assets.
- [x] Update Studio Preview title mapping without adding Shot Plan business
      logic.
- [x] Update the `media-producer` purpose matrix and guidance for
      `video.create` and optional `authoredFrom`.
- [x] Add no Shot Plan or Generations tab in this implementation slice.
- [x] Leave future UI projection over Assets and provenance possible without
      adding a durable Generation entity.

### Tests And Guardrails

- [x] Cover authored-from structural validation, soft missing-reference
      behavior, persistence, and filtering at the Generation owner.
- [x] Cover last-Spec association and create-next behavior at the Shot Plan
      owner.
- [x] Cover failed, successful, and retried Runs without last-pointer changes.
- [x] Cover mutable Shot Plan authoring after generated Asset creation.
- [x] Cover retained plan duplication with and without a last Spec.
- [x] Cover managed and external `video.create` Project Asset imports.
- [x] Cover independent Shot Plan and Asset Trash lifecycles.
- [x] Cover generation-51 fresh and upgrade schemas without data conversion.
- [x] Preserve existing generation, preview, Asset, Trash, image, and audio
      regressions.
- [x] Add stable runtime/import/contract guardrails without private-name source
      needles.
- [x] Run the architecture-shape checks listed in Final Verification.

### Documentation And Decisions

- [x] Add Decision 0062.
- [x] Add concise supersession notices to Decisions 0061 and 0056 without
      rewriting their historical bodies.
- [x] Update current data-model, vocabulary, generation, Asset, storage, CLI,
      and skill documentation.
- [x] State explicitly that no data migration or data conversion exists because
      the feature has no persisted use.
- [x] Do not edit completed historical plans.
- [x] Do not modify the user's untracked Shot Plan exploration.

### Final Verification

- [x] Run focused Core, CLI, Studio, and skill validation.
- [x] Run root build, test, lint, and check.
- [x] Apply migration 0065 only to fresh or temporary copied databases.
- [x] Run `foreign_key_check` and `quick_check`.
- [x] Review `git diff --stat` and the complete diff.
- [x] Inspect every new or heavily modified file.
- [x] Confirm deleted focused modules were not replaced by a monolith.
- [x] Confirm package `index.ts` files remain thin.
- [x] Confirm no new Shot Plan Asset ownership, snapshot, output entity, or
      dependency system exists.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
