# 0163 Remove Stale Shot Video UI And Generation Scaffolding

Status: complete
Date: 2026-07-30
Completed: 2026-07-30

## Summary

Renku Studio still contains a dormant Shot AI Production interface and several
Core, CLI, documentation, and agent-skill contracts from an earlier failed
video-generation iteration. The UI is not reachable from the current product,
but leaving it in the repository risks making new work inherit obsolete
presentation contracts, a generic `video.create` purpose with no product use,
and an unnecessarily strong Shot Plan-to-GenerationSpec relationship.

This plan removes that stale slice before Plan
`0162-shot-plan-video-generation.md` is implemented.

The cleanup has four deliberate outcomes:

- delete the unused Shot AI Production and Shot video preview components,
  tests, projections, and client-only generation presentation contracts;
- remove the generic user-callable `video.create` purpose and its only
  Project-video attachment/file-destination path;
- remove `ShotPlan.lastGenerationSpec`, the `shot_plan.generation_spec_id`
  foreign key and unique index, the continuation commands, and spec-copying
  behavior from Shot Plan copy; and
- remove current `video.create`, last-spec, and Take-era Shot video guidance
  from the `media-producer` skill.

This is a deletion and boundary-restoration plan, not the new Shot Plan video
feature. It deliberately preserves:

- the generic video provider catalogs, descriptors, schemas, validation,
  simulation, pricing, execution adapters, and capability APIs in
  `packages/engines`;
- the generic GenerationSpec, GenerationRun, Preview, approval, freeze,
  provenance, and Asset infrastructure used by valid current purposes;
- `GenerationSpec.authoredFrom` and
  `media_generation_spec.authored_from_shot_plan_id` as a nullable, indexed,
  non-foreign-key source-context value;
- all current Shot Plan, Shot, Shot image, Composition, Motion, Dialogs, and
  direction-authoring behavior; and
- every bundled Shot Design image and motion video used by the current
  Composition/Motion and Shot Plan UI.

Although this plan has the later plan number, it is a hard prerequisite to Plan
`0162`. Implement and verify `0163` first. Plan `0162` must build its new
`shot-plan.video-generation` workflow from the cleaned architecture rather
than adapting or salvaging the failed implementation.

## Requirement Ledger

| ID | Requirement and source | Owning implementation | Acceptance evidence |
| --- | --- | --- | --- |
| C1 | Remove the earlier failed video-generation UI completely. Accepted user direction. | Studio Shot authoring feature deletion plus Core client presentation-contract cleanup. | Repository search and Studio tests prove the dormant components, projections, exports, and callers are absent. |
| C2 | Preserve the composition-rule images and motion demonstration videos because current/new UI uses them. Accepted user direction. | Existing `shot-design` asset catalog and active Composition/Motion/Shot Plan consumers remain unchanged. | Diff inspection shows no asset deletion; focused UI tests and desktop smoke verification still render representative image and motion media. |
| C3 | Remove generic `video.create`; it has no real application purpose. Accepted user direction. | Core GenerationPurpose registry, purpose module, attachment handling, Project video destination, CLI fixtures, Studio titles, docs, and current skill guidance. | Purpose/model/context listings omit the removed purpose, ordinary unknown-purpose validation applies at untyped boundaries, and no compatibility alias remains. |
| C4 | Keep generic Engines video-model support. Accepted user qualification and package architecture. | `packages/engines` video descriptors/catalogs/provider adapters remain generic and purpose-independent. | Engines tests stay green and the cleanup diff contains no deletion of generic video capability/provider modules. |
| C5 | Remove all formal Shot Plan-to-GenerationSpec lifetime coupling. Accepted user direction. | Core client contract, Drizzle schema/migration, access layer, projection, copy flow, commands, service contract/wiring, Studio transport types, and tests. | Shot Plan schema/report/service contracts contain no spec id or record; copying and deleting plans never reads, copies, updates, or invalidates a GenerationSpec. |
| C6 | Keep only the loose generation-to-Shot-Plan context value for future grouping and authoring. Accepted user direction. | Existing `GenerationSpec.authoredFrom` and non-FK `authored_from_shot_plan_id`. | Schema and lifecycle tests prove the field remains nullable/indexed with no FK and missing Shot Plan rows do not invalidate GenerationSpecs. |
| C7 | A deleted source Shot Plan must not affect a generated Asset or request. Accepted user direction. | Absence of reverse pointer/cascade/dependency behavior; future projection is deferred to Plan `0162`. | Deletion/Trash tests show Shot Plan lifecycle has no generation or Asset side effects. |
| C8 | Remove stale current agent guidance without touching the machine-local old `renku-create-video` skill. Accepted user direction. | Sister `studio-skills` `media-producer` cleanup only. | Structural validation and searches show current Studio skill routing no longer advertises `video.create`, last-spec continuation, or Shot video Take workflows. |
| C9 | Perform cleanup before new functionality to prevent stale concepts from contaminating the design. Accepted user sequencing. | This plan, Decision `0068`, and Plan `0162` prerequisite gate. | Plan `0162` implementation does not begin until this checklist and migration verification are complete. |
| C10 | Make the cleanup architecturally direct: no shims, aliases, generic replacements, or source-text implementation-name tests. Hard repository rules. | Owning packages delete obsolete contracts and update callers directly. | Diff and architecture review show no compatibility surface or replacement abstraction was added. |

## Product Behavior After Cleanup

### What disappears

There is no Shot AI Production tab, projection, model table, input-mode list,
run-setup component, or Shot video preview component in the current Studio
source tree. Because the surface is already unreachable, this changes no
reachable user workflow.

There is no public generation purpose named `video.create`. It does not appear
in:

- `GenerationPurpose`;
- the Core purpose registry;
- purpose-scoped model/context commands;
- attachment destination resolution;
- Preview titles;
- CLI fixtures or current command documentation; or
- current `media-producer` guidance, samples, or eval cases.

There is no generic `project.video` durable file destination left solely to
support that removed purpose. Plan `0162` later introduces a deliberately
purpose-specific Shot Plan video destination and Asset type.

There is no Shot Plan field or service operation that points to a GenerationSpec.
The following concepts disappear together:

- `ShotPlan.lastGenerationSpec`;
- `SetShotPlanLastGenerationSpecInput`;
- `CreateNextShotPlanGenerationSpecInput`;
- `setShotPlanLastGenerationSpec`;
- `createNextShotPlanGenerationSpec`;
- `setShotPlanLastGenerationSpecId`;
- the dedicated Shot Plan generation command/authoring modules;
- spec copying during `copyShotPlan`; and
- `shot_plan.generation_spec_id` plus
  `shot_plan_last_generation_spec_unique_idx`.

These names are listed here to identify deletion targets in the plan. They must
not survive in current runtime code as rejected aliases, compatibility
diagnostics, deprecated exports, or sentinel tests.

### What remains

Shot Plans remain authoring documents with:

- id, Scene ownership, title, coverage, Shots, selected/candidate Shot images,
  timestamps, and Trash lifecycle;
- normal create, validate, update, Shot editing, copy, read, list, delete,
  restore, and image-selection behavior; and
- no generation state.

GenerationSpec remains independently capable of storing:

```ts
authoredFrom?: { kind: 'shotPlan'; id: string };
```

Its database column remains
`media_generation_spec.authored_from_shot_plan_id`, with the current index and
without a foreign key. This value points one way from a request to authoring
context. Core does not require the referenced plan to exist merely because the
field is present.

The generic Engines package remains able to describe and call video models.
Removing a Studio product purpose must not delete provider schemas, model
descriptors, route discovery, request validation, simulation, price
calculation, execution adapters, or generic capability documentation that
accurately describes Engines.

### Bundled visual assets that must survive

The cleanup must not delete, relocate, rename, or regenerate:

```text
packages/studio/src/features/movie-studio/shot-design/generated/images/**
packages/studio/src/features/movie-studio/shot-design/generated/motion/**
packages/studio/src/features/movie-studio/shot-design/shot-design-media.ts
packages/studio/src/features/movie-studio/shot-design/shot-design-media.test.ts
```

These are active Shot Design assets, not stale AI Production assets. Current
consumers include:

- `shot-authoring/shot-composition-tab.tsx`;
- `shot-authoring/shot-motion-tab.tsx`;
- `shot-plans/shot-brief-grid.tsx`;
- `shot-plans/shot-brief-media.tsx`; and
- `shot-plans/shot-design-glossary-dialog.tsx`.

Also preserve the active Shot authoring components:

```text
shot-composition-tab.tsx
shot-motion-tab.tsx
shot-dialogs-tab.tsx
shot-design-controls.tsx
shot-direction-context.tsx
```

The deletion boundary is determined by current imports and ownership, not by
whether a filename contains `shot`, `video`, `motion`, or `generation`.

## Explicit Non-goals

This plan does not:

- implement `shot-plan.video-generation` or any replacement video purpose;
- add the Scene Generations tab, video Config UI, model selector, input-mode
  selector, Setup controls, reference guide, or video player dialog;
- move useful-looking code from the failed UI into a new folder;
- rename the old UI to make it look current;
- introduce temporary purpose aliases or “unsupported legacy purpose”
  diagnostics;
- convert old `video.create` specs into a new purpose;
- add a migration reader, fallback, or compatibility DTO for
  `lastGenerationSpec`;
- delete or semantically inspect generated/reference media;
- delete generic video support from Engines;
- delete the general `videos/` project storage root merely because its old
  resolver is removed;
- change Asset ownership, GenerationSpec freeze behavior, managed run
  provenance, Preview behavior, or current non-video purposes;
- alter the creative contents of prompts, images, or videos;
- modify historical migration SQL or completed plans merely for a naming
  sweep;
- uninstall or edit the user’s machine-local `renku-create-video` skill; or
- perform mobile verification.

## Context And Current Evidence

### Failed Studio UI

The following files form one self-contained dormant island with no production
caller:

```text
packages/studio/src/features/movie-studio/shot-authoring/
  shot-ai-production-input-mode-list.tsx
  shot-ai-production-model-table.tsx
  shot-ai-production-projection.ts
  shot-ai-production-projection.test.ts
  shot-ai-production-run-setup.tsx
  shot-ai-production-tab.tsx
  shot-ai-production-tab.test.tsx
  shot-video-preview.tsx
  shot-video-preview.test.tsx
```

Their supporting generation-only presentation types are in
`packages/core/src/client/shot-authoring.ts`:

- `ShotGenerationInputModeId`;
- `ShotGenerationParameterValue`;
- `ShotGenerationParameterValues`;
- `ShotGenerationPromptDraft`;
- `ShotGenerationParameterReport`;
- `ShotGenerationModelReport`;
- `ShotGenerationSetup`; and
- `selectShotGenerationModel`.

Those types do not belong to the active Shot direction contract and are not
needed by the current Composition, Motion, Dialogs, or Shot Plan UI.

Plan `0144-shot-authoring-direction-data-foundation.md` intentionally preserved
these dormant files as a temporary exception. This plan supersedes only that
preservation decision. It does not supersede Plan `0144`’s active Shot
direction, Composition, Motion, Dialogs, or bundled-asset work.

### Generic video purpose

The current user-callable surface is rooted in:

```text
packages/core/src/client/generation.ts
packages/core/src/server/generation/purposes/video-create.ts
packages/core/src/server/generation/purposes.ts
packages/core/src/server/generation/attachment-destinations.ts
packages/core/src/server/generation/attachments.ts
```

Its only durable output destination is rooted in:

```text
packages/core/src/server/project-asset-files/types.ts
packages/core/src/server/project-asset-files/destinations/project-video.ts
packages/core/src/server/project-asset-files/destinations/registry.ts
```

Current tests, Studio title projection, CLI fixtures, and accepted docs mention
the purpose because it is in the registry. The generic CLI command framework
does not need video-specific removal; once the public purpose and registry
entry disappear, the CLI can no longer author it.

The `project_video` string may remain inside historical generated migration SQL
or a focused migration test that proves a historical one-way migration. It
must not remain as a current registered purpose, attachment mapping, file
destination, preview title, sample, or current architectural recommendation.

### Shot Plan coupling

The strong relationship currently spans:

```text
packages/core/src/client/shot-plans.ts
packages/core/src/server/schema/shot-plans.ts
packages/core/src/server/database/access/shot-plans/plan-records.ts
packages/core/src/server/shot-plans/generation-spec.ts
packages/core/src/server/commands/shot-plan-generation-commands.ts
packages/core/src/server/shot-plans/projection.ts
packages/core/src/server/shot-plans/copying.ts
packages/core/src/server/project-data-service-contracts.ts
packages/core/src/server/project-data-service-wiring/shot-plans.ts
packages/studio/src/services/studio-shot-plans-contracts.ts
packages/studio/server/http/shot-plan-responses.ts
```

Focused Core and Studio route tests currently assert the old field,
association commands, continuation rules, and copy behavior. Those assertions
must be deleted or rewritten to prove the current intended Shot Plan contract;
they must not be retained as tests that recognize obsolete names.

Repository caller tracing found that `copyGenerationSpecForAuthoring` is used
only by Shot Plan copy and the dedicated Shot Plan continuation module. Delete
the helper and its focused copy tests with those callers rather than preserving
an unused convenience API.

### Real project and migration baseline

Read-only inspection of `/Users/keremk/renku-movies/urban-basilica` found:

- schema generation `53`, ending at migration `0067`;
- Shot Plan `shot_plan_37a3r9yz`;
- a null current last-spec value; and
- no `video.create` GenerationSpecs.

This evidence means the representative project has no useful relationship or
legacy video request to preserve. The migration still must be correct for any
valid generation-53 database: rebuild `shot_plan` without the nullable foreign
key and unique index while preserving all Shot Plan rows, coverage, timestamps,
discard metadata, Shot rows, Shot image ownership, and other constraints.

### Sister skill

Current stale guidance exists in:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills/media-producer/
  SKILL.md
  references/workflow.md
  evals/forward-test-cases.md
  samples/video-create-spec.json
  references/shot-video-take/**
  samples/shot-video-take/**
  evals/shot-video-take/**
```

This plan removes Shot video creation and continuation guidance from the
current `media-producer` contract. Until Plan `0162` lands, the skill should
describe its valid image/audio/current-purpose scope and must not claim that a
Studio Shot Plan video workflow exists.

The separate old `renku-create-video` skill installed from another local
project is outside both repositories and outside this plan.

## Architecture Decisions

### Decision 0068

Add:

```text
docs/decisions/0068-remove-stale-shot-video-generation-scaffolding.md
```

Decision `0068` records:

- the failed dormant Shot AI Production UI is deleted, not migrated;
- bundled Shot Design assets and their active consumers are distinct and
  preserved;
- generic `video.create` is not a valid Studio product purpose;
- its unused Project-video destination is removed with it;
- generic Engines video support remains;
- Shot Plans carry no GenerationSpec id or lifecycle state;
- `GenerationSpec.authoredFrom` is the only allowed weak source-context value;
  it remains non-FK and one-way; and
- future Shot Plan video work must use a specific product purpose and must not
  restore the removed contracts.

Add concise supersession notices near the top of:

- Decision `0061`, for the remaining Shot Plan last-spec pointer;
- Decision `0062`, for generic `video.create` and last-spec continuation while
  preserving its independent Project Asset ownership and provenance direction;
  and
- Decision `0063`, only where it names the generic video purpose.

Do not rewrite their historical bodies.

### Deletion ownership

Each owning layer removes its own obsolete public surface:

- Core removes domain types, purpose registration, commands, projection state,
  storage contracts, and schema coupling;
- Studio removes unreachable presentation files and adjusts thin transport
  DTOs to the smaller Core Shot Plan;
- CLI removes only fixtures/help/docs that explicitly advertise the retired
  purpose;
- the sister skill removes current routing, examples, and evals for nonexistent
  behavior; and
- Engines is not asked to know that a Studio purpose was deleted.

No caller receives a replacement facade. Current callers are updated directly.

### Failure behavior

After cleanup, `video.create` is not a recognized value in the public
GenerationPurpose contract. Runtime code does not add a special
`VIDEO_CREATE_RETIRED` diagnostic, deprecated alias, purpose translation, or
fallback. Ordinary input validation treats any unknown purpose according to
the current generic contract.

Likewise, current Shot Plan DTOs and commands contain no obsolete field to
reject. Unknown import fields continue to follow the repository’s normal
unknown-field policy; no last-spec-specific warning or repair is added.

## Architecture Shape Gate

This gate must pass before implementation begins.

### Intended file and module shape

Files deleted in full:

```text
packages/studio/src/features/movie-studio/shot-authoring/
  shot-ai-production-input-mode-list.tsx
  shot-ai-production-model-table.tsx
  shot-ai-production-projection.ts
  shot-ai-production-projection.test.ts
  shot-ai-production-run-setup.tsx
  shot-ai-production-tab.tsx
  shot-ai-production-tab.test.tsx
  shot-video-preview.tsx
  shot-video-preview.test.tsx

packages/core/src/server/generation/purposes/video-create.ts
packages/core/src/server/project-asset-files/destinations/project-video.ts
packages/core/src/server/shot-plans/generation-spec.ts
packages/core/src/server/commands/shot-plan-generation-commands.ts

studio-skills/skills/media-producer/
  samples/video-create-spec.json
  references/shot-video-take/**
  samples/shot-video-take/**
  evals/shot-video-take/**
```

Existing files narrow in place:

```text
packages/core/src/client/generation.ts
packages/core/src/client/shot-authoring.ts
packages/core/src/client/shot-plans.ts
packages/core/src/server/schema/shot-plans.ts
packages/core/src/server/database/access/shot-plans/plan-records.ts
packages/core/src/server/generation/purposes.ts
packages/core/src/server/generation/attachment-destinations.ts
packages/core/src/server/generation/attachments.ts
packages/core/src/server/project-asset-files/types.ts
packages/core/src/server/project-asset-files/destinations/registry.ts
packages/core/src/server/shot-plans/projection.ts
packages/core/src/server/shot-plans/copying.ts
packages/core/src/server/project-data-service-contracts.ts
packages/core/src/server/project-data-service-wiring/shot-plans.ts
packages/studio/src/services/studio-shot-plans-contracts.ts
packages/studio/server/http/shot-plan-responses.ts
```

One generated migration and one focused migration test are added:

```text
packages/core/drizzle/0068_remove_stale_shot_video_scaffolding.sql
packages/core/drizzle/meta/<generated snapshot and journal update>
packages/core/src/server/database/lifecycle/migration-0068.test.ts
```

The exact generated SQL filename suffix may differ if Drizzle Kit chooses a
generated name, but the migration ordinal is `0068` and
`PRAGMA user_version` advances from `53` to `54`.

### Public entrypoints after cleanup

The accepted public contract has:

- no `video.create` member in `GenerationPurpose`;
- no public Shot generation setup/presentation types;
- no `lastGenerationSpec` member on `ShotPlan`;
- no last-spec inputs or methods on `ProjectDataService`;
- unchanged `GenerationSpec.authoredFrom`;
- unchanged ordinary GenerationSpec/Run/Asset services; and
- unchanged generic Engines video exports.

Package and bounded-module `index.ts` files remain thin. This cleanup must not
create a new “legacy video,” “Shot Plan generation manager,” or generic
replacement module.

### Forbidden shapes

Stop and revise the slice if implementation starts to add:

- a replacement generic video purpose;
- a deprecated alias or purpose translator;
- a Shot Plan spec-id field under another name;
- a generic Shot Plan metadata patch command;
- a side table that recreates the reverse relationship;
- a compatibility DTO that still projects the removed field as null;
- a wrapper/re-export preserving a removed import path;
- an architecture test that searches for current private helper/function
  names;
- a UI barrel that keeps the failed components importable;
- reuse or relocation of failed UI code into the future Generation Preview;
- deletion of `shot-design/generated/images/**` or
  `shot-design/generated/motion/**`;
- provider/video capability deletion in Engines; or
- semantic inspection of prompts or media.

### Stop conditions

Pause and resolve the plan before proceeding if:

- a supposedly stale file has a current production caller outside the failed
  island;
- removing the Project video destination would break a current purpose other
  than `video.create`;
- removing the last-spec commands reveals a current product workflow that
  cannot use ordinary GenerationSpec creation;
- Drizzle Kit proposes data loss beyond
  `shot_plan.generation_spec_id` and its unique index;
- the migration changes Shot, Asset, selected-image, or Trash semantics;
- a bundled Shot Design asset appears unused only because its consumer is
  dynamically discovered through `import.meta.glob`; or
- Plan `0162` functionality is required to make the cleanup compile.

The cleanup must leave a valid product on its own.

## Public Contract And Schema Changes

### Generation purpose

Delete `video.create` directly from `GenerationPurpose` and the purpose
registry. Delete its purpose module, Preview title case, attachment builder,
no-provenance special case, CLI test fixture, and current documentation.

Do not replace it in this plan. The next plan introduces:

```text
shot-plan.video-generation
```

only after this cleanup is complete.

### Project video destination

Delete:

```ts
{ kind: 'project.video'; titleHint?: string }
```

from `ProjectAssetFileDestination`, delete its registry entry/resolver module,
and delete `projectVideoAttachmentDestination`; repository tracing shows
`video.create` is its only current caller.

Keep the generic `VIDEOS_ROOT` path and file utilities because a project may
legitimately store video media and Plan `0162` will add a focused destination.
Do not add the future destination in this cleanup.

### Shot Plan client and service

The resulting client shape is:

```ts
export interface ShotPlan {
  id: string;
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: Shot[];
  createdAt: string;
  updatedAt: string;
}
```

Remove the generation record import made unnecessary by this change.

`ProjectDataService` keeps the current Shot Plan authoring/read/lifecycle
methods but removes the two generation-specific methods and inputs. Studio
response types stop omitting `lastGenerationSpec`; they consume the smaller
Core contract directly.

`copyShotPlan` copies:

- Shot Plan title and coverage;
- Shot rows and briefs; and
- current selected Shot images according to the existing asset-copy contract.

It does not read, allocate, copy, or associate a GenerationSpec.

### Drizzle schema

The Drizzle TypeScript schema is the source of truth. Remove:

```text
shot_plan.generation_spec_id
shot_plan_last_generation_spec_unique_idx
```

and the now-unused `mediaGenerationSpecs` schema import.

Use the repository Drizzle Kit workflow to generate migration `0068`. Inspect
the generated SQLite table rebuild carefully. The migration must preserve:

- every Shot Plan id, Scene id, title, coverage value, timestamp, and discard
  field;
- the active Scene ordering index;
- every Shot row and its foreign key to Shot Plan;
- Shot image membership/selection and all unrelated Asset rows;
- all GenerationSpecs, including any spec whose `authoredFrom` contains a Shot
  Plan id; and
- the non-FK `authored_from_shot_plan_id` column and index.

The migration intentionally discards only the nullable reverse pointer values.
There is no runtime migration model or compatibility reader.

## Implementation Slices

### Slice 1 — Record the cleanup decision and freeze scope

Files:

- add Decision `0068`;
- add concise notices to Decisions `0061`, `0062`, and `0063`;
- update Plan `0162` to name this prerequisite and the clean baseline.

Acceptance:

- ownership, preservation, and deletion boundaries are explicit;
- Decision `0068` distinguishes generic Engines capability from Studio product
  purposes;
- no historical ADR body is rewritten; and
- new feature implementation is explicitly out of scope.

### Slice 2 — Delete the failed Studio presentation island

Work:

- re-run caller searches for every dormant component/projection;
- delete the nine failed UI/test files;
- remove the eight obsolete `ShotGeneration*` client contracts/helpers;
- update any affected bounded entrypoint or test import directly;
- retain active Shot direction types and components; and
- retain the entire Shot Design asset catalog and generated asset folders.

Acceptance:

- Studio typecheck/test compiles without a replacement presentation layer;
- current Shot Plans, Composition, Motion, and Dialogs tests stay green;
- no failed component name remains in current source or tests; and
- no asset file was deleted or moved.

### Slice 3 — Remove the generic Studio video purpose

Work:

- remove `video.create` from the public purpose union and purpose registry;
- delete `video-create.ts`;
- remove its attachment/provenance special cases;
- delete the unused `project.video` destination and resolver;
- update focused Core purpose, attachment, spec, and file-destination tests;
- remove Studio preview-title support and tests for the purpose;
- remove CLI fixtures/help assertions that advertise it; and
- update current documentation to say Studio has no product video generation
  purpose until Plan `0162`.

Acceptance:

- generic generation commands still work for all current registered purposes;
- `video.create` is absent rather than specially rejected;
- generic Engines video descriptors/adapters remain available and tested; and
- no current attachment path produces `project_video`.

### Slice 4 — Remove Shot Plan reverse generation state

Work:

- remove last-spec types and `ShotPlan.lastGenerationSpec`;
- remove generation-spec imports from the Shot Plan client and projection;
- delete the generation command and authoring modules;
- remove record setters, service methods, wiring, and Studio omit-workarounds;
- simplify `copyShotPlan` to plan/Shot/selected-image behavior only;
- delete the now-uncalled `copyGenerationSpecForAuthoring` helper and its
  focused copy tests;
- rewrite focused tests to assert the smaller current contract and independence
  from generation state; and
- retain `GenerationSpec.authoredFrom` unchanged.

Acceptance:

- no Shot Plan read/write/copy/delete path reads or writes a GenerationSpec;
- no ProjectDataService API exposes a last-spec operation;
- Shot Plan copy preserves its valid current content without a spec copy;
- deleting/restoring a Shot Plan has no generation or Asset side effect; and
- missing Shot Plan rows do not invalidate independently stored authored-from
  metadata.

### Slice 5 — Generate and verify migration 0068

Work:

- update `packages/core/src/server/schema/shot-plans.ts`;
- run the repository-owned Drizzle Kit generation command;
- inspect generated SQL and metadata;
- add `migration-0068.test.ts`;
- update schema-generation expectations that follow the latest migration; and
- migrate a disposable copy of `urban-basilica`.

Acceptance:

- schema generation advances `53` to `54`;
- only the obsolete Shot Plan column/index disappear;
- current constraints/indexes and all unrelated rows remain;
- SQLite `quick_check` and `foreign_key_check` pass; and
- no migration SQL is hand-edited unless a custom migration is first justified
  and documented.

### Slice 6 — Clean the current media-producer skill

Work in `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- remove `video.create` routing/examples from `media-producer/SKILL.md`;
- remove last-spec continuation language from `references/workflow.md`;
- remove the stale Shot Plan Video Continuation case from
  `evals/forward-test-cases.md`;
- delete `samples/video-create-spec.json`;
- delete `references/shot-video-take/**`;
- delete `samples/shot-video-take/**`;
- delete `evals/shot-video-take/**`; and
- update structural manifests/indexes if they explicitly enumerate those
  files.

Acceptance:

- the current skill advertises only workflows that exist after cleanup;
- no Take-era or generic video creation route remains;
- general Preview/approval/freeze/attachment guidance used by current purposes
  remains; and
- the machine-local `renku-create-video` skill is untouched.

### Slice 7 — Align current documentation and tests

Update current accepted docs:

```text
docs/architecture/media-generation.md
docs/architecture/reference/media-generation.md
docs/architecture/video-generation-model-capabilities.md
docs/architecture/data-model-and-storage.md
docs/architecture/project-asset-storage-conventions.md
docs/cli/commands.md
docs/architecture/test-execution-strategy.md
```

Also update current test fixtures and architectural descriptions that still
treat the failed UI, generic purpose, Project video destination, or last-spec
relationship as current.

Do not edit:

- generated historical migration SQL;
- historical completed plans merely for terminology;
- handoff/status documents whose purpose is to record past work; or
- generic Engines documentation that accurately describes video capability
  independent of a Studio purpose.

Acceptance:

- current docs describe the cleaned baseline;
- Decision `0068` is the accepted source of truth;
- current CLI docs do not advertise `video.create`;
- docs distinguish absent Studio product workflow from retained Engines
  capability; and
- no obsolete contract is preserved by a “legacy” section.

## Tests And Guardrails

### Core purpose and attachment tests

- every remaining GenerationPurpose resolves through the focused registry;
- purpose enumeration contains no `video.create`;
- attachment resolution has no generic Project-video builder;
- provenance rules for remaining purposes are unchanged;
- `ProjectAssetFileDestination` contains no `project.video`;
- current image/audio/Shot image destinations still allocate exact paths; and
- unknown purposes follow ordinary structured validation with no retired-name
  special case.

### Core Shot Plan tests

- create/read/list reports contain no generation field;
- update, Shot add/update/move/remove, and image selection remain unchanged;
- copy duplicates plan/Shot/selected-image state and no GenerationSpec;
- copy of a plan whose id appears in some GenerationSpec `authoredFrom` still
  does not copy or rewrite that spec;
- delete, restore, and permanent deletion have no generation or Project Asset
  cascade;
- ProjectDataService exposes no last-spec commands; and
- client and server DTOs use the same smaller Shot Plan contract directly.

### Migration tests

Construct a valid generation-53 database containing:

- active and discarded Shot Plans;
- null and non-null legacy reverse pointer values;
- Shots, coverage, timestamps, and active Scene ordering;
- ordinary GenerationSpecs;
- a GenerationSpec with `authored_from_shot_plan_id`; and
- representative Shot image Asset ownership/selection.

After migration:

- `PRAGMA user_version` is `54`;
- `shot_plan.generation_spec_id` is absent;
- `shot_plan_last_generation_spec_unique_idx` is absent;
- all preserved columns and rows match;
- Shot foreign keys and active Scene index remain;
- GenerationSpecs and weak authored-from ids remain;
- Asset/selection rows remain; and
- `quick_check` and `foreign_key_check` pass.

### Studio tests

- the dormant UI files and tests are gone;
- reachable Shot Plans UI tests remain green;
- Composition still renders a representative bundled image;
- Motion still renders a representative bundled MP4;
- Dialogs and Shot direction editing remain green;
- Studio Shot Plan transport types no longer contain an omit workaround for the
  deleted field; and
- Preview titles for current purposes remain unchanged.

### Engines tests

Run the existing Engines suite to prove:

- generic video model descriptors remain discoverable;
- video request schemas and validation remain;
- simulation/pricing/provider routing remain; and
- the cleanup did not make Engines depend on a Studio purpose.

Do not add an Engines test that mentions `video.create`; the architecture
boundary is purpose independence, not preservation of the old name.

### Skill validation

- structural links and manifests resolve after directory deletion;
- remaining `media-producer` workflows use current purposes;
- generic Preview/approval/freeze guidance remains available;
- no current eval asks the agent to continue a Shot Plan’s last spec; and
- no current sample contains `video.create`.

### Stable architecture guardrails

Guard stable boundaries:

- Core client contract shape has no reverse Shot Plan generation field;
- Studio feature code imports no deleted presentation module;
- Engines has no dependency on Core GenerationPurpose;
- current purpose registries contain only current purpose modules; and
- runtime behavior proves Shot Plan lifecycle independence.

Do not add source-text tests that enumerate deleted private function names or
freeze the current command/module inventory. Repository searches belong in
final cleanup verification, not as brittle implementation-name architecture
tests.

## Documentation

Decision `0068` and current architecture docs must explain:

- why the failed UI is deleted rather than reused;
- why visual Shot Design assets are active product assets and remain;
- why a generic user-callable video purpose is misleading;
- why Engines video capability and Studio product purposes are separate;
- why Shot Plans carry no GenerationSpec lifecycle state;
- why `GenerationSpec.authoredFrom` is sufficient weak context;
- why no FK, cascade, reverse pointer, selected video, continuation command, or
  dependency system exists;
- why a missing source plan does not invalidate a request or generated Asset;
- why Plan `0162` must introduce its specific workflow only after cleanup; and
- why no compatibility layer is provided in this pre-customer product.

Historical ADRs receive concise supersession notices only. Historical plans
and generated migration SQL remain historical evidence, not current contracts.

## Final Verification

### Generated migration and representative project

1. Generate migration `0068` through the repository-owned command:

   ```text
   pnpm --dir packages/core db:generate -- --name remove_stale_shot_video_scaffolding
   ```

2. Inspect the generated SQL, snapshot, and journal completely.
3. Run the focused generation-53-to-54 migration test.
4. Back up and migrate a disposable copy of
   `/Users/keremk/renku-movies/urban-basilica`.
5. Run SQLite `quick_check`, `foreign_key_check`, and focused row/column/index
   queries.
6. Confirm the real Shot Plan and Shots remain and the reverse spec column is
   gone.

### Focused automated verification

Run:

```text
pnpm --dir packages/core test
pnpm test:engines
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm --filter @gorenku/studio test:typecheck
```

Run the sister-skill structural validator. Then run:

```text
pnpm check
pnpm test
pnpm build
```

### Repository absence and preservation audit

Search current production code, current tests, current docs, and the
`media-producer` skill for:

```text
video.create
lastGenerationSpec
createNextShotPlanGenerationSpec
setShotPlanLastGenerationSpec
project.video
shot-ai-production
shot-video-take
```

Classify any remaining hit. Accept only deliberately historical occurrences in
generated one-way migrations, their focused migration tests, completed plans,
or supersession notices. Current runtime, current public contracts, current
product tests, current docs, and current skill guidance must be clean.

Inspect `git diff --name-status` in both repositories and confirm there is no
deleted or renamed file under:

```text
packages/studio/src/features/movie-studio/shot-design/generated/images/
packages/studio/src/features/movie-studio/shot-design/generated/motion/
```

Also confirm the Shot Design catalog and active Composition/Motion/Shot Plan
consumers remain.

### Desktop smoke verification

At the supported desktop viewport:

- open a current Shot Plan;
- confirm Composition tiles render their bundled images;
- confirm Motion tiles/previews render their bundled videos;
- confirm Dialogs and direction editing still work;
- confirm Shot image selection and plan copy remain functional; and
- confirm there is no reachable or orphan-linked Shot AI Production surface.

Do not perform or report mobile verification.

### Architecture-shape review

Before completion:

- inspect `git diff --stat` and the complete diff in both repositories;
- inspect every deleted and heavily modified file in context;
- verify public entrypoints and registries remain thin;
- verify no new file replaces or wraps a deleted concept;
- verify Core owns all durable schema/contract changes;
- verify CLI, HTTP, React, and skills contain no domain workaround;
- verify Engines generic video support is intact and purpose-independent;
- verify Shot Plan copy/read/delete no longer touches GenerationSpecs;
- verify `authoredFrom` remains non-FK and one-way;
- verify no bundled Shot Design asset was deleted, moved, or regenerated;
- verify formatting changes are limited to intentional lines; and
- verify no checklist item was satisfied by accepting an unreviewable
  structure or compatibility layer.

## Completion Checklist

Completion evidence:

- focused Core, CLI, Studio, migration, and sister-skill checks pass;
- `pnpm test:core`, `pnpm test:engines`, `pnpm test:cli`, and
  `pnpm test:studio` pass;
- root `pnpm check`, `pnpm test`, and `pnpm build` pass;
- the Chromium desktop smoke project passes all three scenarios;
- migration `0068` preserves active and discarded plans, Shots, generation
  context, Assets, memberships, and selections with clean SQLite integrity
  checks;
- a disposable copy of `urban-basilica` migrates from generation `53` to `54`
  with its real project database left untouched; and
- repository and sister-skill searches confirm the retired current contracts
  are absent while historical handoff, ADR, plan, and migration evidence stays
  unchanged where required.

### Review Area

- [x] Confirm requirements C1–C10 are implemented and verified.
- [x] Confirm this cleanup is complete before Plan `0162` implementation starts.
- [x] Confirm the cleanup restores package ownership rather than adding a
      replacement abstraction.
- [x] Confirm the final file/module shape matches the Architecture Shape Gate.
- [x] Confirm no current workflow depended on the deleted dormant UI.
- [x] Confirm no requirement broadened into new video functionality.

### Decisions And Sequencing

- [x] Add Decision `0068` with the accepted cleanup and weak-context boundary.
- [x] Add concise supersession notices to Decisions `0061`, `0062`, and `0063`.
- [x] Preserve historical ADR bodies.
- [x] Mark Plan `0162` as dependent on this plan and schema generation `54`.
- [x] Record that the failed UI is deleted, not migrated or salvaged.
- [x] Record that generic Engines video support remains.
- [x] Record that the user’s separate machine-local old skill is out of scope.

### Failed Studio UI

- [x] Reconfirm the failed component/projection island has no production caller.
- [x] Delete all nine `shot-ai-production-*` and `shot-video-preview` files and
      focused tests listed in the plan.
- [x] Remove obsolete `ShotGeneration*` presentation contracts/helpers from
      Core client code.
- [x] Update current callers/imports directly with no re-export or wrapper.
- [x] Preserve active Composition, Motion, Dialogs, design controls, and
      direction context components.
- [x] Preserve the Shot Design asset catalog and its tests.
- [x] Preserve every generated Shot Design image and motion MP4.
- [x] Prove reachable Shot Plan authoring behavior remains green.

### Generic Video Purpose And Destination

- [x] Remove `video.create` from `GenerationPurpose`.
- [x] Delete its purpose module and registry entry.
- [x] Remove its attachment builder and provenance special case.
- [x] Remove its Preview title and focused tests.
- [x] Remove CLI fixtures/help assertions that advertise it.
- [x] Remove `project.video` from the durable destination union and registry.
- [x] Delete the unused Project video resolver and destination helper.
- [x] Keep the generic `VIDEOS_ROOT` and media file utilities.
- [x] Keep generic Engines video catalogs, descriptors, schemas, simulation,
      pricing, and provider adapters.
- [x] Add no retired-purpose alias, translator, or special diagnostic.

### Shot Plan Contract And Coupling

- [x] Remove `ShotPlan.lastGenerationSpec`.
- [x] Remove the two generation-specific Shot Plan input contracts.
- [x] Remove the two ProjectDataService methods and service wiring.
- [x] Delete the dedicated Shot Plan generation command/authoring modules.
- [x] Remove the database record setter and projection lookup.
- [x] Remove GenerationSpec copying and reverse association from Shot Plan copy.
- [x] Delete the now-uncalled generic spec-copy helper and its focused copy
      tests.
- [x] Remove Studio response/type omit-workarounds for the deleted field.
- [x] Rewrite current tests around the smaller intended contract.
- [x] Prove Shot Plan lifecycle has no generation/Asset side effects.
- [x] Preserve `GenerationSpec.authoredFrom` unchanged.

### Drizzle Migration

- [x] Remove `generation_spec_id` and its unique index from the Drizzle Shot
      Plan schema source of truth.
- [x] Remove the now-unused schema import.
- [x] Generate migration `0068` with Drizzle Kit.
- [x] Inspect the generated table rebuild, snapshot, and journal.
- [x] Advance `PRAGMA user_version` from `53` to `54`.
- [x] Add focused migration tests with null/non-null old pointers.
- [x] Preserve Shot Plan/Shot/coverage/timestamp/discard data and indexes.
- [x] Preserve all GenerationSpecs and weak authored-from ids.
- [x] Preserve Shot image Assets, memberships, and selections.
- [x] Pass SQLite `quick_check` and `foreign_key_check`.
- [x] Add no runtime fallback or compatibility reader.

### CLI, Studio Transport, And Skills

- [x] Keep generic CLI generation handlers thin and valid for remaining
      purposes.
- [x] Update Studio Shot Plan response contracts directly.
- [x] Remove current `video.create` and last-spec guidance from
      `media-producer`.
- [x] Delete `samples/video-create-spec.json`.
- [x] Delete the retired `references/shot-video-take`, sample, and eval trees.
- [x] Update current structural indexes/manifests.
- [x] Preserve general Preview/approval/freeze guidance for valid purposes.
- [x] Do not modify the user’s separate machine-local `renku-create-video`
      skill.

### Tests And Guardrails

- [x] Add/update Core purpose, attachment, destination, Shot Plan, copy,
      lifecycle, and migration tests.
- [x] Keep the invalid matrix at the owning Core layer.
- [x] Run existing Engines video capability tests.
- [x] Run representative CLI and Studio adapter tests.
- [x] Run Studio Shot Plan, Composition, Motion, Dialogs, and asset-catalog
      tests.
- [x] Run sister-skill structural validation.
- [x] Protect stable contracts/import boundaries rather than private
      implementation names.
- [x] Add no source-text command/helper inventory test.
- [x] Prove runtime code does not inspect creative prompts or media.

### Documentation

- [x] Update all current architecture and CLI documents named in Slice 7.
- [x] Distinguish retained Engines capability from absent Studio video purpose.
- [x] Document the smaller Shot Plan contract and one-way weak authored context.
- [x] Document asset preservation and prerequisite sequencing.
- [x] Add no legacy compatibility section.
- [x] Leave historical plans and generated migrations unchanged except for
      concise ADR supersession notices where planned.

### Final Verification

- [x] Run focused Core, Engines, CLI, Studio, migration, and skill verification.
- [x] Run `pnpm check`, `pnpm test`, and `pnpm build`.
- [x] Verify a migrated disposable `urban-basilica` copy at generation `54`.
- [x] Complete the repository absence/preservation audit.
- [x] Confirm no Shot Design image or motion asset was deleted or renamed.
- [x] Complete supported desktop smoke verification.
- [x] Inspect `git diff --stat` and the complete diff in both repositories.
- [x] Inspect every deleted and heavily modified file.
- [x] Confirm package and module `index.ts` files remain thin.
- [x] Confirm no wrapper, alias, compatibility layer, broad dispatcher, raw
      feature control, or prompt/media content validator was introduced.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark this plan complete and allow Plan `0162` implementation to
      begin.
