# 0154 Mutable Shot Plans And Frozen Video Assets In Core

Status: completed
Date: 2026-07-23
Completed: 2026-07-23

Implementation note: no dedicated UI, Studio route, CLI command, or agent-skill
workflow was added. Existing exhaustive generic purpose and Trash registries
received only the mechanical cases required by the new Core contracts.

## Summary

Add the first durable Core model for a Scene's Shot Plans, their ordered Shots,
one current GenerationSpec, and one final video Asset.

The lifecycle is deliberately small:

1. create and directly edit a Shot Plan;
2. run any number of simulations or failed Generations against it;
3. attach one successful or manual video output, which makes the Shot Plan
   read-only;
4. copy the frozen Shot Plan to start another editable iteration;
5. continue authoring with the copied mutable `GenerationSpec`, which preserves
   the prior prompt, model configuration, provider values, and exact
   references, then repeat.

There is no Shot Plan revision history, dependency graph, owned-reference
model, copy-on-write storage layer, selected output, status field, separate
Shot Plan output record, or generic lifecycle framework.

Generation prompt, model configuration, provider values, and references remain
in the existing `GenerationSpec`. First Frame, Last Frame, video-storyboard,
previs, Character Sheet, Location Sheet, Lookbook, dialogue-audio, and
arbitrary references are ordinary exact Generation references. Copying their
IDs or project-relative paths into a new Spec reuses the same media; Core does
not copy or claim ownership of it.

This plan changes `packages/core` and current architecture documentation. It
does not implement Studio UI, new CLI commands, or agent skills.

## Accepted Product Requirements

### Shot Plans and Shots

- A Shot Plan belongs to one Scene.
- A Scene may have any number of Shot Plans.
- A Shot Plan may contain zero Shots while it is being authored.
- A Shot belongs to one Shot Plan and has one canonical position.
- Beat coverage belongs to the Shot Plan, not to individual Shots.
- A Shot has `description` and `brief`; there is no `setup`.
- There is no Shot Plan status field.
- `Attempt` remains a glossary term only. It is not a table, field, type, or
  runtime discriminator.
- Traditional-film Takes are not defined in this plan.

### Direct authoring and copying

- An editable Shot Plan is updated in place. Core stores no authoring snapshots
  or history.
- Updating a Shot Plan replaces its current title, optional Beat coverage, and
  ordered Shot list in one transaction.
- A supplied existing Shot id is updated and reordered. A Shot without an id is
  created. An existing Shot omitted from the submitted list is deleted.
- Copying creates a new Shot Plan id and new Shot ids with the same current
  title, Beat coverage, Shot order, descriptions, and briefs.
- A Shot Plan identifies zero or one current `GenerationSpec`.
- Copying also creates a new mutable `GenerationSpec` when the source has one.
  The new Spec copies the source execution kind, title, model, provider values,
  prompt values, and exact references, with a new Spec id and the new Shot Plan
  target.
- The copied Spec's exact references continue pointing to the same Asset Files
  or project-relative files; reference media is not copied.
- Copying never transfers the final video Asset, its Asset File, or any
  Generation Run.
- A source plan with no current Spec remains copyable and produces a copy with
  no Spec. Core does not invent a synthetic Spec for a manual-only plan.
- Both editable and frozen Shot Plans may be copied.
- There is no automatic copy after a failed Generation.
- Concurrent editing and edit-conflict detection are not requirements.

### Beat coverage

- Coverage is either `null` or one exact Scene Beat Sheet id plus an ordered
  array of Beat ids.
- Coverage is optional context for a user or agent. It is not a validity,
  ownership, deletion, or Generation rule.
- Beat Sheet and Beat ids have no database foreign keys.
- A missing or non-current Beat Sheet, a Scene mismatch, or a missing Beat does
  not invalidate the Shot Plan.
- Full reads return any context that can still be resolved and structured
  warnings for the rest.
- An empty Beat-id array is valid.
- Core never interprets whether the Shots or generated video actually cover the
  referenced Beats.

### Shot description and brief

- `Shot.description` is stored directly as SQLite `TEXT`.
- It may contain Markdown for rendering, but Core treats it as opaque text.
- `Shot.brief` is stored as validated JSON text.
- Every brief field is optional.
- Unknown fields are rejected with `additionalProperties: false` at every
  object level.
- `durationSeconds` and `optics.focalLengthMm` are positive when present.
- Other brief values are non-empty strings. The schema does not invent a
  closed vocabulary.

### Generation and freeze

- Add `shot-plan.video` as a video `GenerationPurpose`.
- Add `{ kind: 'shotPlan'; id: string }` as a `GenerationTarget`.
- Continue using the existing `GenerationSpec` and `GenerationRun` tables and
  lifecycle.
- A Shot Plan has zero or one final video Asset.
- The video Asset represents the entire Shot Plan. There is no per-Shot or
  subset generation target.
- Simulations, failed runs, successful but unattached outputs, and supporting
  reference media do not freeze the Shot Plan.
- Attaching one video sets the Shot Plan's `video_asset_id`. Its presence is
  the only Shot Plan freeze condition.
- Once `video_asset_id` exists, Shot Plan update, current-Spec replacement, and
  second attachment fail before writes. Copy remains allowed.
- The plan has no mutable `frozen`, `produced`, `selected`, or `accepted`
  column.
- A managed attachment identifies one exact output path from the supplied Run.
  Core does not require the provider to have returned exactly one output and
  adds no simulation-specific attachment rule.
- An agent-external attachment uses the existing frozen, same-purpose,
  same-target Spec contract.
- Manual attachment creates no synthetic Spec or Run.
- Managed and agent-external attachments require the exact provenance Spec to
  be the Shot Plan's current `GenerationSpec`.
- Attachment stores the video as an ordinary Asset and Asset File, then sets
  the Shot Plan's direct one-to-one `video_asset_id`. It does not create a
  purpose-specific output table or a Project Asset relationship.
- The Asset File's existing managed-Run or agent-external-Spec provenance is
  the inspectable record of the generation configuration that produced it.
- Core treats prompts, references, and video bytes as opaque.

### Generation settings and references

- Model, provider values, prompt, and exact references stay exclusively in
  `GenerationSpec`.
- The Shot Plan stores only the id of its zero-or-one current Spec. Shot Plan
  and Shot rows contain no copied Generation settings or reference fields.
- The purpose reference guide reuses existing Production Lookbook, Storyboard
  Lookbook, Character Sheet, Location Sheet, and dialogue-audio candidate
  mechanisms.
- It adds optional First Frame, Last Frame, video-storyboard, and previs slots
  using the existing guide and exact-reference contracts.
- Arbitrary references continue to use
  `placement: { kind: 'additional' }`.
- `copyShotPlan` owns the seamless iteration transaction. It creates the new
  plan, Shots, and copied mutable Spec together instead of requiring a caller
  to reconstruct the request.
- Core adds no general-purpose public GenerationSpec `clone` or `fork`
  command. The Generation owner exposes only the internal copy operation needed
  by `copyShotPlan`.
- A failed live Generation leaves the Shot Plan editable. Its frozen Spec may
  be retried unchanged. To change the request after failure, the caller creates
  a new ordinary same-target Spec and makes it the plan's current Spec; this
  does not copy the Shot Plan.
- Generating a replacement First Frame or similar input means selecting that
  new exact file in the new draft Spec. The prior frozen Spec remains
  unchanged.
- No relationship is added between the Shot Plan and a selected reference.
- Generation receives no Beat, Shot, description, brief, or inferred coverage
  facts. The future caller reads the Shot Plan separately and authors the
  prompt.

### Direct Shot Plan deletion

- A Shot Plan can be deleted through the existing Trash mechanism.
- Deleting it discards the Shot Plan and makes its contained Shots unavailable.
- If `video_asset_id` is present, the same Trash operation discards that Asset
  and its Asset Files without deleting the files immediately.
- Restoring the Shot Plan restores the plan, its Shots, and the video
  Asset/Files discarded by that same operation.
- The associated GenerationSpec and Runs remain durable generation history;
  they are not separate Trash items.
- Generation reference Assets are not Shot Plan-owned and are never discarded
  by Shot Plan deletion.
- Scene, Sequence, and Act deletion behavior is intentionally deferred to a
  later plan.

## Explicit Simplification Consequences

These are accepted consequences of not building revisions or dependency
management:

- If a Shot Plan changes after a Generation Run finishes but before one of its
  outputs is attached, the attachment freezes the current Shot Plan. Core
  cannot reconstruct the earlier authored state because no revision exists.
  The intended caller flow is to attach the chosen output before further
  authoring.
- Reused Generation references are not retained by the Shot Plan. If an exact
  Asset File is discarded or a project-relative file disappears, existing
  preview behavior shows it as unresolved and execution readiness fails until
  the caller restores or replaces it.
- Copying a Shot Plan with a current Spec copies the exact authored request
  envelope but not any Run, output, Asset, or reference media.
- A manually attached video does not create a Spec. If the manual plan already
  has a current authored Spec, copying preserves it like any other current
  Spec; otherwise its copy also has no Spec.
- If the video Asset later becomes unavailable through the existing Asset
  lifecycle, `video_asset_id` remains and the Shot Plan stays frozen. Restoring
  the Asset restores availability; this plan adds no dependency guard.
- Current screenplay persistence may remove and recreate Scene rows. To avoid
  cascading destruction without redesigning screenplay persistence, the
  Shot Plan's `scene_id` is an indexed logical reference, not a database foreign
  key. Create and copy require the Scene to exist. If the Scene later
  disappears, Shot Plan rows and video Assets remain; restoring the same Scene
  id makes them discoverable from that Scene again.
- Scene/Sequence/Act aggregate Trash behavior, orphan garbage collection, and
  removal or replacement of a final video are not defined in this plan.

## Scope

### In scope

- Browser-safe Shot Plan, Shot, coverage, current-Spec, video, input, and report
  contracts.
- Two SQLite tables: `shot_plan` and `shot`.
- JSON Schemas and AJV validation for coverage and briefs.
- Core create, update, current-Spec association, read, list, copy, and direct
  Trash-delete commands.
- Soft Beat-context projection with warnings.
- `shot-plan.video` Generation purpose, target, and reference guide.
- Atomic managed, agent-external, and manual final-video attachment.
- Existing Trash integration for direct Shot Plan deletion and restoration.
- Drizzle migration 0064 and schema generation 50.
- Current ADR, vocabulary, generation, storage, and path documentation.

### Out of scope

- Shot Plan revisions or history APIs.
- Owned references, dependency tracking, reference retention, Asset copying,
  reference copying tables, or last-owner calculations.
- Target-revision capture or attachment lineage beyond existing Spec/Run
  provenance.
- Scene/Sequence/Act Trash behavior and garbage collection redesign.
- UI, Studio routes, new CLI commands, and agent skills.
- Traditional-film Take persistence.
- Prompt synthesis, semantic readiness, Beat analysis, video analysis, or
  generated-media quality checks.
- New image-generation or reference-attachment purposes.
- Compatibility aliases or readers for retired Shot Video Take and Clip
  contracts.

## Context And Evidence

- `GenerationSpec` already owns model identity, opaque provider values, prompt
  fields, and `GenerationReferenceSelection[]`.
- `GenerationRun.specSnapshot` already preserves the exact request executed by
  a managed Generation.
- `asset_file_generation` and
  `asset_file.source_generation_spec_id` already connect an attached Asset File
  to its managed Run or frozen external Spec.
- Exact Generation references already support an Asset/File id pair or a
  normalized project-relative path. Execution validation already reports an
  unavailable reference.
- Existing generated-image attachment does not create a universal
  purpose-output table. It persists the Asset/File, provenance, and the
  destination's existing relationship or singleton owner record.
- Existing singleton purpose records such as Lookbook media, Scene Beat
  Storyboard Images, and Cast Voice samples point directly to their Asset.
  Shot Plan's nullable `video_asset_id` follows that shape and avoids
  `shot_plan_output`.
- `persistGeneratedMediaAttachment` needs only a transaction-scoped internal
  seam that can persist an Asset/File and provenance for a direct singleton
  owner without inventing a second attachment pipeline.
- The existing Trash registry already provides recoverable aggregate discard,
  restore snapshots, Asset/File lifecycle helpers, and garbage-collection file
  collection. Direct Shot Plan deletion extends that registry rather than
  creating another lifecycle mechanism.
- Generation purpose descriptors and reference-guide slot helpers already own
  per-purpose target, output-media, and candidate composition.
- Decision 0041 requires prompts and media contents to remain opaque.
- Decision 0052 removed the obsolete Shot Video Take aggregate and deferred a
  new durable Shot model.
- Decision 0056 keeps each live Generation Spec permanently frozen. Shot Plan
  freeze is separate and begins only when `video_asset_id` is attached. The
  Shot Plan copy operation is the one accepted exception to its earlier
  no-clone direction: it creates a new mutable Spec as part of copying the
  complete editable iteration.
- Migration 0059 removed the old Shot/Take persistence. No compatibility
  migration or data conversion is required.
- The latest migration is 0063 and the current schema generation is 49.

## Architecture Shape Gate

### Ownership

- `packages/core/src/client/shot-plans.ts` owns browser-safe contracts.
- `packages/core/src/client/shot-plan-json-schemas.ts` owns plain JSON Schemas.
- `packages/core/src/server/schema/shot-plans.ts` owns the two Drizzle tables.
- `packages/core/src/server/database/access/shot-plans.ts` owns focused row
  reads and writes.
- `packages/core/src/server/shot-plans/validation.ts` owns title, Shot, coverage,
  and brief validation.
- `packages/core/src/server/shot-plans/beat-context.ts` resolves optional Beat
  context and warnings.
- `packages/core/src/server/shot-plans/authoring.ts` owns create, update, and
  current-Spec association.
- `packages/core/src/server/shot-plans/copying.ts` owns the atomic Shot Plan,
  Shot, and current-Spec copy transaction.
- `packages/core/src/server/shot-plans/projection.ts` assembles public reads.
- `packages/core/src/server/shot-plans/video-attachment.ts` owns the one-video
  check and sets `shot_plan.video_asset_id`.
- `packages/core/src/server/shot-plans/trash.ts` defines the focused Shot Plan
  discard/restore snapshot and delegates Asset/File lifecycle work to the
  existing Trash helpers.
- `packages/core/src/server/trash/asset-tree-lifecycle.ts` receives the existing
  internal Asset/File discard, restore, and file-collection helpers currently
  embedded in `trash-object-registry.ts`, so the Shot Plan definition reuses
  them without duplicating lifecycle code.
- `packages/core/src/server/generation/specs.ts` remains the GenerationSpec
  owner and gains `copyGenerationSpecToTarget`, an internal operation used only
  by Shot Plan copy.
- `packages/core/src/server/commands/shot-plan-commands.ts` exposes thin command
  entrypoints.
- `packages/core/src/server/generation/purposes/shot-plan-video.ts` owns the
  purpose descriptor.
- `packages/core/src/server/generation/reference-slots/shot-plan-video.ts`
  composes its optional slots from existing reference helpers.
- `packages/core/src/server/project-asset-files/destinations/shot-plan-video.ts`
  owns the durable video path.

`client/index.ts`, `server/index.ts`, `schema/index.ts`,
`generation/purposes.ts`, and the project-file destination registry receive
exports or registrations only.

`trash-object-registry.ts` remains a focused registry and should shrink when
the Asset-tree helpers move out; it must not absorb the Shot Plan discard and
restore implementation.

### Public entrypoints

Add these focused `ProjectDataService` methods:

```ts
createShotPlan(input: CreateShotPlanInput): Promise<ShotPlanReport>;
updateShotPlan(input: UpdateShotPlanInput): Promise<ShotPlanReport>;
setShotPlanGenerationSpec(
  input: SetShotPlanGenerationSpecInput
): Promise<ShotPlanReport>;
copyShotPlan(input: CopyShotPlanInput): Promise<ShotPlanReport>;
readShotPlan(input: ReadShotPlanInput): Promise<ShotPlanReport>;
listSceneShotPlans(input: ListSceneShotPlansInput): Promise<ShotPlanListReport>;
deleteShotPlan(input: DeleteShotPlanInput): Promise<RecoverableMutationReport>;
```

Extend existing Generation entrypoints for `shot-plan.video`; do not create a
parallel video-generation service.

### Required small refactor

Keep `persistGeneratedMediaAttachment` as the existing public persistence
operation. In the same file, extract one internal
`persistGeneratedMediaAssetInSession` function that writes the Asset, Asset
File, and provenance inside a caller-owned transaction and file write set.

The existing wrapper delegates to that seam and continues adding the existing
image destination relationship or membership. Shot Plan video attachment uses
the same seam and sets `shot_plan.video_asset_id` and `video_attached_at` before
commit. This is the only shared attachment refactor in this plan.

Add `shotPlan` to the existing Trash item registry. The Shot Plan definition
uses the existing operation, snapshot, Asset/File discard/restore, and file
collection helpers. Do not introduce a second Trash service or a generic
parent/child deletion framework.

### Forbidden shape

Stop and simplify if implementation starts adding any of these:

- `shot_plan_revision` or snapshot tables;
- a revision number, parent revision, expected revision, or edit token;
- a Shot Plan Asset target or generic owner union;
- a `shot_plan_output` or `shot_plan_asset` table;
- a Shot Plan reference table;
- dependency, last-owner, copy-on-write, reconciliation, or generic lifecycle
  services;
- a general public GenerationSpec clone/fork API or copied Run history;
- prompt or media-content inspection;
- Shot Plan business rules in CLI, Studio server, React, or skills;
- business logic in package `index.ts` files or registration-only modules.

## Contracts

### Browser-safe model

```ts
interface ShotPlanCoverage {
  beatSheetId: string;
  beatIds: string[];
}

interface ShotBrief {
  durationSeconds?: number;
  framing?: {
    start?: string;
    end?: string;
  };
  camera?: {
    angle?: string;
    movement?: string;
  };
  optics?: {
    focalLengthMm?: number;
    depthOfField?: string;
    focusTarget?: string;
  };
  lighting?: {
    key?: string;
    accent?: string;
  };
}

interface Shot {
  id: string;
  position: number;
  description: string;
  brief: ShotBrief;
}

interface ShotPlan {
  id: string;
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: Shot[];
  generationSpec: GenerationSpecRecord | null;
  videoAssetId: string | null;
  videoAssetFile: AssetFile | null;
  videoAttachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

`videoAssetId !== null` means the plan is frozen. `videoAssetFile: null` with a
non-null `videoAssetId` means the linked Asset/File is currently unavailable;
the durable id and freeze remain. The three flat projection fields avoid a
separate `ShotPlanOutput` contract.

### Authoring inputs

Every input includes the existing project selector:

```ts
interface ShotPlanProjectInput {
  projectName?: string;
  homeDir?: string;
}

interface ShotInput {
  id?: string;
  description: string;
  brief: ShotBrief;
}

interface CreateShotPlanInput extends ShotPlanProjectInput {
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: ShotInput[];
}

interface UpdateShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: ShotInput[];
}

interface SetShotPlanGenerationSpecInput extends ShotPlanProjectInput {
  shotPlanId: string;
  generationSpecId: string | null;
}

interface CopyShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

interface ReadShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
}

interface ListSceneShotPlansInput extends ShotPlanProjectInput {
  sceneId: string;
}

interface DeleteShotPlanInput extends ShotPlanProjectInput {
  shotPlanId: string;
}
```

The Shot array order is canonical; callers do not author `position`. Create
requires Shot inputs without ids. Update accepts ids belonging to that exact
plan and allocates ids for entries without them. Duplicate, foreign, or unknown
supplied Shot ids fail before writes.

### Read reports

```ts
interface ShotPlanReport {
  valid: true;
  project: {
    name: string;
    id: string;
    projectFolder: string;
  };
  shotPlan: ShotPlan;
  resolvedBeats: Beat[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}

interface ShotPlanListReport {
  valid: true;
  project: ShotPlanReport['project'];
  shotPlans: ShotPlan[];
  warnings: DiagnosticIssue[];
  resourceKeys: string[];
}
```

Use the existing `surface:scene:<sceneId>:shots` resource key. Lists order Shot
Plans by `createdAt, id`; Shots order by `position, id`.

Warnings are limited to:

- `CORE_SHOT_PLAN_BEAT_SHEET_MISSING`;
- `CORE_SHOT_PLAN_BEAT_SHEET_STALE`;
- `CORE_SHOT_PLAN_BEAT_SHEET_SCENE_MISMATCH`;
- `CORE_SHOT_PLAN_BEAT_MISSING`;
- `CORE_SHOT_PLAN_SCENE_MISSING`;
- `CORE_SHOT_PLAN_VIDEO_UNAVAILABLE`.

Warnings never reject authoring or reads. Malformed stored JSON remains a
structured storage error rather than a soft-reference warning.

Use focused structured errors for Shot Plan-owned invariants:

- `CORE_SHOT_PLAN_NOT_FOUND` for a missing or discarded plan;
- `CORE_SHOT_PLAN_FROZEN` for authoring or current-Spec changes after
  `video_asset_id` is set;
- `CORE_SHOT_PLAN_GENERATION_SPEC_INVALID` when an associated Spec is missing,
  has another purpose, or targets another plan;
- `CORE_SHOT_PLAN_VIDEO_EXISTS` for a second attachment.

Purpose/target, provider request, reference, source-path, and provenance
failures continue using the existing Generation diagnostics rather than
Shot Plan-specific duplicates.

### Authoring behavior

`createShotPlan` requires the Scene to exist, validates the complete input, and
inserts the plan and ordered Shots atomically with no current Spec or video.

Titles and stored ids must be non-empty after trimming. Shot descriptions may
be empty. Coverage ids are structural strings only; Core does not infer or
validate their creative meaning.

`updateShotPlan`:

- requires the Shot Plan to exist, be active, and have no `video_asset_id`;
- validates the complete replacement state;
- updates the plan row;
- updates/reorders supplied existing Shots;
- inserts id-less Shots;
- deletes omitted Shots;
- commits the complete current state atomically.

`setShotPlanGenerationSpec`:

- requires the Shot Plan to be active and have no `video_asset_id`;
- accepts `null` to leave an early or manual-only plan without a current Spec;
- otherwise requires the exact Spec to exist with purpose `shot-plan.video`
  and target the same Shot Plan;
- changes only `generation_spec_id`; it does not copy, freeze, or mutate the
  Spec.

This focused association allows an unchanged frozen Spec to be retried after a
failed live Run, or a newly authored same-target Spec to replace it while the
plan remains editable.

`copyShotPlan` requires the source plan and its Scene to exist. In one
transaction it:

- inserts a new editable Shot Plan and new Shot rows from the source's current
  state;
- creates a new mutable Spec when `generation_spec_id` is present;
- copies the source Spec's purpose, execution kind, title, model, values, and
  exact references;
- changes only the Spec id and target Shot Plan id;
- sets the copied plan's `generation_spec_id` to the new Spec id;
- leaves `video_asset_id` and `video_attached_at` null;
- copies no Run, Asset, Asset File, or reference media.

If the source has no current Spec, the copied plan also has none.

### Generation purpose

Extend:

```ts
type GenerationPurpose =
  | /* existing */
  | 'shot-plan.video';

type GenerationTarget =
  | /* existing */
  | { kind: 'shotPlan'; id: string };
```

The descriptor uses target kind `shotPlan`, output media kind `video`, no fixed
creative values, and no prompt synthesis.

The reference guide includes optional:

- Production Lookbook Sheet;
- Storyboard Lookbook Sheet;
- Character Sheet slots for Cast Members found structurally in the parent
  Scene;
- Location Sheet slots for Locations found structurally in the parent Scene;
- existing dialogue-audio candidates for that Scene;
- First Frame and Last Frame image slots;
- video-storyboard image slot;
- previs video slot.

Shot Plan purpose facts may contain only project aspect ratio and structural
Scene subject ids needed to build those candidates. They must not include Beat
Sheet content, Shot text, description, brief, or generated prompt text.

All slots are advisory and optional. Additional exact references remain
unrestricted.

### Final video attachment

Extend `attachGenerationMedia` for:

```ts
{
  purpose: 'shot-plan.video';
  target: { kind: 'shotPlan'; id: string };
  sourceProjectRelativePath: string;
  title?: string;
  receipt?: unknown;
  sourceSpecId?: string;
}
```

The attachment:

- requires the Shot Plan to be active and have no `video_asset_id`;
- validates the existing managed, external, or manual provenance envelope;
- for managed provenance, requires purpose/target match and the chosen path to
  be an exact output of the supplied Run, and requires that Run's Spec id to
  equal the plan's `generation_spec_id`;
- for external provenance, requires a frozen same-purpose, same-target Spec;
- for external provenance, also requires `sourceSpecId` to equal the plan's
  `generation_spec_id`;
- validates a video media envelope without inspecting content;
- copies the file to
  `shots/<sequence-name>/<scene-name>/<shot-plan-id>/video.<extension>`;
- creates one ordinary Asset with type `shot-plan-video`;
- creates one primary video Asset File and existing provenance;
- sets `shot_plan.video_asset_id` to that Asset id and records
  `video_attached_at`;
- commits the file, Asset rows, provenance, and Shot Plan update atomically;
- rolls back copied files and database rows together on failure.

The caller chooses one exact output. Attachment does not inspect Run status or
provider output count beyond the existing exact-path provenance match.

Draft Spec create/update, estimate, simulation, and live execution keep their
existing generic lifecycle. This plan does not add a separate rule that blocks
running against a frozen Shot Plan; the second output still cannot attach.
Future UI, CLI, and skills should follow the copy-first product flow.

### Direct deletion and restore

`deleteShotPlan` calls the existing Trash lifecycle with item kind `shotPlan`.
The Shot Plan Trash definition:

- requires one active Shot Plan;
- records its Scene as the Trash owner and snapshots the optional video Asset
  id plus whether this operation discarded that Asset;
- marks the Shot Plan discarded with the current Trash operation id;
- leaves its Shot rows in place behind the discarded parent;
- when the video Asset is active, marks that Asset and its Asset Files
  discarded with the same operation id;
- leaves the current Spec, Runs, and all Generation reference media unchanged.

Restoring that Trash item clears the Shot Plan discard fields and restores the
video Asset tree only when the same Shot Plan deletion operation discarded it.
This avoids resurrecting an Asset that was already in Trash before the plan was
deleted. The contained Shots require no separate restore records because they
were never removed.

Trash listing, restore, recoverable mutation reports, and garbage-collection
file discovery continue through the existing contracts. This plan does not
define Scene, Sequence, or Act deletion cascades.

## Database Schema And Migration

Add `packages/core/src/server/schema/shot-plans.ts`.

`shot_plan`:

- `id TEXT PRIMARY KEY`;
- `scene_id TEXT NOT NULL` with no foreign key;
- `title TEXT NOT NULL`;
- `coverage TEXT NULL`;
- `generation_spec_id TEXT NULL UNIQUE REFERENCES media_generation_spec(id)`;
- `video_asset_id TEXT NULL UNIQUE REFERENCES asset(id)`;
- `video_attached_at TEXT NULL`;
- `created_at TEXT NOT NULL`;
- `updated_at TEXT NOT NULL`;
- existing discard lifecycle columns: `discarded_at`,
  `discard_operation_id`, and `restored_at`;
- check that `video_asset_id` and `video_attached_at` are either both null or
  both present;
- index on `scene_id, discarded_at, created_at, id`.

`shot`:

- `id TEXT PRIMARY KEY`;
- `shot_plan_id TEXT NOT NULL REFERENCES shot_plan(id) ON DELETE CASCADE`;
- `position INTEGER NOT NULL`;
- `description TEXT NOT NULL`;
- `brief TEXT NOT NULL`;
- `created_at TEXT NOT NULL`;
- `updated_at TEXT NOT NULL`;
- unique index on `shot_plan_id, position`;
- check that `position >= 0`;
- index on `shot_plan_id, id`.

`coverage` and `brief` use their domain names rather than `_json` suffixes. They
are parsed and validated before writes and after reads.

Add `shot_plan` and `shot` entity-id prefixes. Reuse the existing
`media_generation_spec`, `asset`, and `asset_file` id families; there is no
output or Shot Plan Asset-relationship id.

Generate migration 0064 with Drizzle Kit, add
`PRAGMA user_version = 50`, and commit its journal/snapshot files. There is no
old Shot Plan data to migrate and no custom preservation SQL.

## Implementation Slices

### Slice 1: accept the simplified domain decision

- Add `docs/decisions/0061-use-mutable-copy-and-freeze-shot-plans.md`.
- Narrow Decisions 0052 and 0056 only through concise notices pointing to the
  new decision.
- Record that current Shot Plans have direct mutation, no history, no
  Shot-owned reference media, one optional current GenerationSpec, copied Spec
  authoring, and one direct video Asset freeze.

### Slice 2: add contracts, validation, and schema

- Add the client contracts and two JSON Schemas.
- Add server validation with the existing AJV 2020-12 configuration.
- Add the two Drizzle tables, direct Spec/video Asset columns, discard lifecycle
  columns, and entity-id prefixes.
- Generate migration 0064 and verify fresh and upgraded databases.

### Slice 3: add direct authoring

- Add focused data access, authoring, Beat-context, projection, commands, and
  service wiring.
- Implement create, update, current-Spec association, read, list, and atomic
  plan/Shot/Spec copy.
- Add the internal Generation-owned copy-to-target operation used by
  `copyShotPlan`.
- Keep the Scene reference non-cascading and Beat context warning-only.

### Slice 4: add video Generation

- Register `shot-plan.video` and the `shotPlan` target.
- Add structural Scene subject facts without Beat or Shot creative content.
- Compose the existing reference guide plus frame, storyboard, and previs
  slots.
- Keep all authored Generation state in `GenerationSpec`.

### Slice 5: add final video attachment

- Add the Shot Plan video destination.
- Extract the transaction-scoped attachment persistence seam.
- Add the focused Shot Plan branch to `attachGenerationMedia`.
- Persist the Asset/File, provenance, and direct `video_asset_id` atomically.
- Require managed/external provenance to use the plan's current Spec.
- Block plan/Spec association updates and second attachment when
  `video_asset_id` exists.

### Slice 6: add direct Shot Plan Trash behavior

- Add `shotPlan` to `TrashItemKind` and the existing Trash registry.
- Extract the existing internal Asset-tree lifecycle helpers from
  `trash-object-registry.ts` into `trash/asset-tree-lifecycle.ts`; update
  existing Trash definitions to use the extracted helpers without changing
  behavior.
- Implement one Shot Plan Trash definition using the current discard, restore,
  snapshot, Asset/File, and garbage-collection file helpers.
- Add `deleteShotPlan` as a thin Core command returning the standard
  recoverable mutation report.
- Keep Scene, Sequence, and Act deletion out of this slice.

### Slice 7: update documentation and verify

- Update only current documents that describe Shots, Generation references,
  SQLite text/JSON storage, shot video paths, and direct Shot Plan Trash.
- Run focused and root verification.
- Exercise the data model against a temporary copy of `urban-basilica`.

## Tests And Guardrails

### Authoring

- Create a zero-Shot plan and incrementally add, reorder, edit, and remove
  Shots.
- Round-trip Markdown description text unchanged.
- Reject unknown brief fields and non-positive numeric values.
- Accept custom non-empty brief strings.
- Reject update after video attachment.
- Associate, replace, and clear a current same-purpose/same-target Spec while
  the plan is editable; reject a foreign-target or wrong-purpose Spec.
- Copy editable and frozen plans with new plan/Shot ids and no video.
- Copy a source current Spec into a new mutable Spec with a new target while
  preserving execution kind, title, model, values, and exact references.
- Copy a manual-only plan with no current Spec without inventing one.
- Copy no Run, Asset, Asset File, or reference media.
- Confirm updates and copies create no history rows because no such table
  exists.

### Beat context

- Store `coverage: null` and an empty Beat-id array.
- Resolve available Beats in authored order.
- Preserve the plan and return warnings for missing, stale, mismatched, and
  partially missing context.
- Confirm Generation purpose construction and execution do not read coverage.

### Generation and references

- Register `shot-plan.video` as a video purpose targeting a Shot Plan.
- Return optional global and structural Scene reference candidates.
- Keep Beat and Shot creative fields out of Generation facts.
- Use `copyShotPlan` to recreate the draft Spec, rather than caller
  orchestration.
- Confirm the two Specs point to the same reference identities and no Asset or
  relationship is copied.
- After a failed live Run, retry the frozen current Spec unchanged, then
  replace the current association with a newly authored same-target Spec
  without copying the Shot Plan.
- Confirm an unavailable reused reference follows existing preview and
  execution-validation behavior.
- Preserve existing image and audio Generation regressions.

### Video attachment

- Attach one exact managed Run output, one frozen external Spec output, and one
  manual video in separate fixtures.
- Confirm each attachment creates one Asset, one primary Asset File, no Project
  Asset relationship, and sets the Shot Plan's `video_asset_id`.
- Reject managed or external attachment whose provenance Spec is not the plan's
  current Spec.
- Confirm arbitrary opaque video bytes attach successfully.
- Confirm a provider Run with several outputs allows the caller to choose one
  exact output path.
- Confirm attachment freezes authoring and rejects a second attachment.
- Confirm a successful unattached Run and a failed Run leave authoring open.
- Edit a plan after a Run but before attachment and confirm attachment freezes
  that current edited state without creating or resolving a historical state.
- Confirm file or database failure rolls back the entire attachment.
- Confirm an unavailable video Asset leaves `video_asset_id` and the freeze
  intact and produces a read warning rather than dependency machinery.

### Trash

- Delete and restore an editable zero-Shot plan with no video.
- Delete and restore a plan with Shots, confirming the contained rows remain
  intact and unavailable only through the discarded parent.
- Delete and restore a frozen plan, confirming the same video Asset/File and
  current Spec association return.
- Confirm deletion does not discard the current Spec, Runs, or any reference
  Asset/File copied into the Spec.
- Confirm restore does not resurrect a video Asset that was already discarded
  by an earlier operation.
- Confirm Trash listing, recoverable mutation reporting, and file collection
  use the existing contracts.

### Architecture

- No production table or type contains Shot Plan revision data.
- No `shot_plan_output`, Shot Plan Asset target, owned-reference table,
  dependency service, or reference-copy operation exists.
- The only GenerationSpec copy path added by this plan is internal to atomic
  `copyShotPlan`; no general public clone/fork API exists.
- Package index and registry files contain exports/registration only.
- Generation code does not inspect Beat, Shot, prompt, reference, or video
  contents.
- The existing image/audio attachment paths still pass after the small
  persistence refactor.

## Documentation

Create:

- `docs/decisions/0061-use-mutable-copy-and-freeze-shot-plans.md`

Update:

- `docs/decisions/0052-separate-scene-beats-from-shot-authoring.md` with a
  concise supersession notice;
- `docs/decisions/0056-freeze-generation-specs-at-live-execution.md` with a
  concise notice that Shot Plan copy creates a new mutable Spec without
  changing the original frozen record;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/project-storage-boundaries.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/json-storage-validation.md`.

Current documentation must state that:

- Shot Plans are mutable until one video Asset is attached and then copied for
  further iteration;
- no authoring revision history exists;
- a Shot Plan identifies zero or one current GenerationSpec;
- copying a Shot Plan copies that Spec into a new mutable same-purpose request
  targeting the new plan;
- Generation settings and references remain stored only in GenerationSpec;
- copying exact reference identities does not copy or retain media;
- Shot description is an accepted SQLite-text exception with Markdown rendering
  only;
- Beat coverage is optional warning-based context;
- final video is an ordinary Asset linked directly by
  `shot_plan.video_asset_id`, with no output table;
- direct Shot Plan deletion and recovery reuse the existing Trash lifecycle;
- Shot Plan media and prompts remain opaque;
- the retired Shot Video Take, generic AI Take, and Clip vocabulary is not the
  current Shot model.

Do not edit historical plans or add documentation for UI, CLI, skills,
traditional Takes, Scene/Sequence/Act deletion, or garbage collection redesign.

## Final Verification

Run:

```bash
pnpm --dir packages/core build
pnpm --dir packages/core test
pnpm --dir packages/core lint
pnpm --dir packages/core check
pnpm build
pnpm test
pnpm lint
pnpm check
```

Generate migration 0064 through Drizzle Kit, apply it to a fresh fixture and a
verified backup of a temporary `urban-basilica` copy, then run
`PRAGMA foreign_key_check` and `PRAGMA quick_check`.

Inspect `git diff --stat`, every new or heavily modified Core file, and the full
diff. Confirm the Architecture Shape Gate still matches the implementation,
package indexes remain thin, and the small attachment refactor did not become a
generic workflow or lifecycle framework.

## Completion Checklist

### Review Area

- [x] Implement only direct authoring, atomic plan/Spec copy, Generation
      integration, one final video freeze, and direct Shot Plan Trash.
- [x] Confirm revision history, owned references, dependency management, and
      Scene/Sequence/Act deletion remain absent.
- [x] Confirm UI, CLI, and skills remain out of scope.
- [x] Confirm the final file shape matches the Architecture Shape Gate.

### Architecture And Contracts

- [x] Add the seven focused Shot Plan service methods and browser-safe reports.
- [x] Add `shot-plan.video` and the `shotPlan` Generation target.
- [x] Keep Generation settings and exact references in `GenerationSpec`, with
      only its id stored on the Shot Plan.
- [x] Remove `ShotPlanOutput`; expose the direct video Asset id, primary file,
      and attachment time as flat Shot Plan projection fields.
- [x] Keep prompts, reference media, Shot text, Beat content, and output video
      opaque.
- [x] Keep package indexes and registries thin.
- [x] Add no compatibility aliases or generic mutation/lifecycle framework.

### Schema And Validation

- [x] Add only `shot_plan` and `shot`; add no output or Shot Plan Asset table.
- [x] Add nullable current-Spec and direct video-Asset foreign keys plus the
      paired video timestamp constraint.
- [x] Add existing discard lifecycle columns to `shot_plan`.
- [x] Keep `scene_id` non-cascading and Beat coverage free of foreign keys.
- [x] Add coverage and brief JSON Schemas with strict AJV validation.
- [x] Require positive optional numeric fields and non-empty optional strings.
- [x] Generate migration 0064 and advance schema generation to 50.
- [x] Verify fresh and upgraded database integrity.

### Authoring And Copy

- [x] Implement atomic create and full-state update.
- [x] Support zero Shots and canonical array ordering.
- [x] Create, update, reorder, and delete current Shot rows without snapshots.
- [x] Associate zero or one same-purpose/same-target current GenerationSpec
      while the plan is editable.
- [x] Copy current authored state to new plan and Shot ids.
- [x] Copy the current Spec, when present, into a new mutable Spec targeting the
      new plan.
- [x] Preserve exact prompt/model/value/reference configuration without copying
      reference media.
- [x] Never copy a video Asset, Asset File, or Generation Run.
- [x] Preserve null current-Spec state for manual-only copies.
- [x] Block plan and current-Spec updates after video attachment while keeping
      copy available.

### Beat Context

- [x] Persist optional Beat Sheet/Beat ids as soft context.
- [x] Resolve available context and return structured warnings.
- [x] Never reject authoring because optional Beat context is stale or missing.
- [x] Keep Beat coverage out of Generation.

### Generation And References

- [x] Reuse existing Spec, Run, slot, additional-reference, and provenance
      contracts.
- [x] Compose optional global, structural Scene, frame, storyboard, previs, and
      dialogue reference slots.
- [x] Keep Shot Plan rows free of Generation settings and references.
- [x] Prove `copyShotPlan` shallowly reuses the prior Spec's exact references
      with a new Spec and target id.
- [x] Support replacing the current Spec after a failed frozen request without
      copying the still-editable Shot Plan.
- [x] Add no public general Spec clone/fork command or reference-copy
      operation.
- [x] Preserve existing image/audio Generation behavior.

### Video Attachment

- [x] Add the durable Shot Plan video destination.
- [x] Extract only the transaction-scoped attachment persistence seam.
- [x] Support managed, frozen external, and manual attachment.
- [x] Require managed/external provenance to match the plan's current Spec.
- [x] Persist the Asset, Asset File, provenance, `video_asset_id`, and
      `video_attached_at`
      atomically.
- [x] Create no Project Asset relationship or `shot_plan_output` row.
- [x] Enforce one video Asset and derive freeze only from
      `video_asset_id`.
- [x] Add no Run-status, provider-output-count, content, dependency, or
      target-revision validation.
- [x] Keep the plan frozen when its video Asset is unavailable.

### Direct Trash

- [x] Add `shotPlan` to the existing Trash item registry.
- [x] Delete an active Shot Plan through the standard recoverable mutation
      contract.
- [x] Keep contained Shot rows behind the discarded parent rather than creating
      per-Shot Trash items.
- [x] Discard and restore the attached video Asset/File with the Shot Plan when
      that operation owns the discard.
- [x] Do not discard current Specs, Runs, or Generation reference media.
- [x] Reuse existing Trash snapshots, restore, Asset/File lifecycle, and file
      collection rather than adding a lifecycle service.
- [x] Keep Scene, Sequence, and Act deletion outside this plan.

### Documentation

- [x] Add Decision 0061 and concise notices in Decisions 0052 and 0056.
- [x] Update only the listed current architecture references.
- [x] Remove current Shot Video Take, generic AI Take, Clip, revision-history,
      and Shot-owned-reference direction.
- [x] Document the explicit simplification consequences.
- [x] Leave historical plans and out-of-scope surfaces unchanged.

### Final Verification

- [x] Run focused Core and root commands.
- [x] Verify migration 0064 on fresh and realistic temporary project data.
- [x] Inspect the complete diff and heavily modified files.
- [x] Confirm no revision, ownership, dependency, or generic lifecycle system
      entered the implementation.
- [x] Confirm no god file, broad dispatcher, catch-all helper, or business logic
      in an index or adapter.
- [x] Confirm no automatic plan review was run.
