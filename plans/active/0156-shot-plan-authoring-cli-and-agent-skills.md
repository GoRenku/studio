# 0156 Shot Plan Authoring CLI And Agent Skills

Status: complete
Date: 2026-07-26

## Summary

Renku Studio already has a scene-owned, mutable `ShotPlan` aggregate in Core,
but it cannot yet represent or support the requested authoring workflow:

- a Shot has no title;
- the current brief puts movement under Camera and has no intent-led Optics or
  Lighting summary;
- there is no Shot-owned representative-image relationship or `shot.image`
  generation purpose;
- the only general Shot Plan edit command replaces the complete ordered Shot
  list;
- the Renku CLI and Studio Skills have no first-class Shot Plan workflow.

This plan extends the existing Core owner rather than introducing a parallel
Shot document system. It adds focused Shot Plan and Shot commands, a thin
glanceable brief beside the canonical Markdown description, Shot-owned image
candidates with one explicit representative selection and recoverable
candidate cleanup, a purpose-specific `shot.image` generation and import path,
a human-first CLI command family, and the `shot-planner` Studio Skill.

The companion UI work is deliberately separate in
`0157-shot-plans-studio-ui.md`. This plan owns the durable model, generation,
CLI, and agent workflow that the UI consumes. Plan 0157 owns browser routes,
Studio selection, candidate cards, the inspector, and visual presentation.

## Requirement Ledger

| Requirement | Source | Owning outcome |
| --- | --- | --- |
| A user can create a Shot Plan for one Scene and optional selected Beats, with zero, one, or several initial Shots. | Exploration brief and user request | Core create contract, CLI `shot-plan create`, and `shot-planner` workflow |
| Shot planning remains iterative; there is no draft/ready/final workflow state. | Exploration brief | No Shot Plan or Shot status field, transition service, or completion validator |
| Each Shot has a stable id, canonical order, title, rich Markdown description, and lightweight brief. | Exploration brief and Appendix | `Shot`, authoring documents, schema migration, focused commands |
| The five UI brief subjects are Framing, Camera, Motion, Optics, and Lighting; duration is separate. | Exploration brief and user answer 3 | Current `ShotBrief` is replaced directly with the accepted shape |
| Framing summarizes opening and ending shot size; Camera summarizes angle; Motion summarizes movement. | Wireframe and user answer 3 | Known vocabulary-backed optional strings in `ShotBrief` |
| Optics and Lighting emphasize authored intent, with optional technical Optics details; the Markdown description states the intent explicitly. | User answer 3 and Appendix | Intent fields in the brief, agent writing guidance, no runtime semantic comparison |
| Known shot-size, camera-angle, and movement names are discoverable to agents, while custom non-empty values remain valid. | Exploration brief | JSON Schema catalog-or-custom fields and skill reference |
| Duration is approximate intent, not a timeline or edit decision. | User answer 2 | Optional positive `durationSeconds`; no start/end, overlap, timeline, or sequencing contract |
| CLI supports list, show, create, update title/coverage, add, edit, remove, reorder, copy, delete, and representative-image selection. | Exploration brief and user answer 4 | Focused Core commands and bounded CLI handler registry |
| The CLI must not implement Shot mutations by reading and resubmitting the whole aggregate. | Architecture hard gate | Remove `updateShotPlan`; use focused Core commands |
| The agent progressively discovers project, scene, Beats, Cast, Locations, Lookbooks, nearby scenes, and current Shot Plan state. | Exploration brief | Reuse current focused CLI reads; do not add a god context command |
| The new specialist is routed by Movie Director after Scene Beat work. | Exploration brief | `shot-planner` skill and Movie Director routing updates |
| A user may request one representative image for a Shot through normal GenerationSpec, Preview, approval, execution, inspection, and focused import. | Exploration brief | `shot.image`, Shot target, focused attachment, media-producer handoff |
| Shot images use the project aspect ratio. | Exploration brief | `shot.image` recommends the resolved project aspect ratio |
| When the user has not chosen an execution path, the Shot workflow prefers Codex built-in GPT-Image-2 but still permits Renku-managed image models. | Exploration brief | Purpose-specific agent workflow; Codex is not added to Engines |
| A Shot may retain several image candidates but has zero or one explicitly selected representative image. Import never silently replaces the selection. | Accepted clarification 1 | `shot_asset` candidates plus a focused representative selection record and commands |
| A user may discard and restore one unselected Shot image candidate without deleting the Shot. The selected representative must be replaced or cleared before it can be discarded. | Accepted image-card clarification | Focused Core candidate-discard command, selected-image guard, and existing relationship Trash lifecycle |
| Deleting/restoring a Shot or Shot Plan deletes/restores its Shot-owned images. | Accepted clarification 1 and remove workflow | Core Trash lifecycle owns relationship, Asset, AssetFile, and file restoration |
| Copying a Shot Plan copies only each Shot's selected representative image, not unselected candidates. | Accepted clarification 1 | Core copy command copies only selected Shot-image ownership |
| Copied plans remain independently editable. | Decisions 0061 and 0062 | New Shot ids, existing last-Spec copy behavior, separate representative selections |
| Studio runtime never semantically validates, rewrites, or scores the Markdown description, brief intent, prompt, or generated image. | Decision 0041 and repository hard gate | Envelope-only validation in Core; creative coherence remains agent/user-owned |

Every mechanism below traces to this ledger. This plan does not add future video
prompting, video execution, editorial sequencing, production scheduling, Shot
status, version history, or a general dependency graph.

## Product Behavior

### Shot Plans and focused iteration

A Shot Plan remains:

- owned by exactly one Scene;
- mutable before and after any generation attempts;
- optionally associated with one exact Scene Beat Sheet and ordered Beat ids as
  soft creative context;
- an ordered collection of individually addressable Shots;
- independent from generated video Assets.

The first create command may include no Shots, one Shot, or several initial Shot
proposals. Later changes use focused operations:

- update only the Shot Plan title and Beat coverage;
- add one Shot;
- update one Shot's title, Markdown description, and brief;
- move one Shot to a new one-based CLI position;
- remove one Shot through recoverable Trash;
- copy or delete the complete Shot Plan.

There is no saved completion state. A plan with zero Shots is valid so an agent
can create the container before working Shot by Shot.

### Canonical Shot document and glanceable brief

`description` is the canonical, model-neutral creative document. It remains an
opaque Markdown string to Studio runtime code. The agent writing convention
describes a coherent visual idea in temporal order, including only the creative
choices that are known:

1. dramatic or visual intent;
2. opening composition and visible subjects;
3. subject action and performance;
4. camera behavior;
5. the condition that ends the Shot;
6. material optics, lighting, continuity, or production constraints.

The brief is a small presentation summary for deterministic UI cards. It does
not replace the description and is not a second source of creative truth.

```ts
export interface ShotBrief {
  durationSeconds?: number;
  framing?: {
    start?: string;
    end?: string;
  };
  camera?: {
    angle?: string;
  };
  motion?: {
    movement?: string;
  };
  optics?: {
    intent?: string;
    focalLengthMm?: number;
    depthOfField?: string;
    focusTarget?: string;
  };
  lighting?: {
    intent?: string;
  };
}
```

Contract rules:

- `framing.start` and `framing.end` contain Shot-size language. The UI presents
  them as Framing, matching the wireframe's `MCU -> CU` treatment.
- `camera.angle` contains the camera-angle summary.
- `motion.movement` replaces the current `camera.movement`.
- `optics.intent` is the primary human-readable optics choice. Technical
  focal-length, depth-of-field, and focus values are optional secondary facts.
- `lighting.intent` is one human-readable lighting statement that may include
  direction, source, quality, time-of-day quality, contrast, or color intent,
  such as “soft morning light entering from the window.”
- `durationSeconds` is an optional positive estimate used only as a visible
  duration tag in plan 0157. Core performs no cumulative timing calculation.
- every group and field is optional. Core validates type, finite positive
  numbers, known JSON shape, and non-whitespace strings; it does not require
  all five subjects.
- Core does not require the Markdown description to mention the brief, compare
  the two values, or reject creative disagreement. The skill instructs the
  agent to state important Optics and Lighting intent in the description.

The current `ShotSizeId`, `CameraAngleId`, `ShotMovementId`, and their label
maps remain the preferred vocabulary. The JSON Schema exposes those exact
catalog values and a non-overlapping custom non-empty string branch. Custom
values are first-class authored values, not warnings or invalid fallbacks.

### Shot image candidates and selection

`shot.image` produces an image candidate owned by one exact Shot:

```ts
type GenerationPurpose = /* current purposes */ | "shot.image";

type GenerationTarget =
  | /* current targets */
  | { kind: "shot"; id: string };

type AssetTarget =
  | /* current targets */
  | { kind: "shot"; shotId: string };
```

The focused relationship role is `shot-image`. A Shot may own several active
image Assets through `shot_asset`. A separate
`shot_representative_display_asset` row selects zero or one of those Assets for
cards and the inspector.

Normal behavior is:

1. author a `shot.image` GenerationSpec for `shot:<shot-id>`;
2. save and show Preview;
3. wait for explicit request approval;
4. execute through Codex or Renku;
5. inspect the exact output;
6. wait for output acceptance;
7. import through `renku media import --purpose shot.image`;
8. explicitly select the attached Asset with the Shot command.

Import does not select or replace a representative image. Generating another
candidate does not discard the prior candidate.

An individual unselected candidate may be moved to Trash through the focused
Shot-image command and restored through the existing Trash surface. A selected
representative is not directly discardable: the caller must first select a
different candidate or explicitly clear the selection. Core enforces this
before any relationship or Asset state changes. Restoring an individually
discarded candidate returns it as an unselected candidate and does not silently
change the representative image.

`shot.image` recommends the current project aspect ratio. It does not make
aspect ratio a fixed provider invariant because the user may deliberately
choose another supported model or request after Preview. The descriptor has no
fake Codex provider. Codex execution remains an `agent-external` spec with the
actual `codex/gpt-image-2` identity reported by the harness; Renku-managed
execution uses a real Engines model descriptor.

### Copy and Trash lifecycle

Copying a Shot Plan:

- allocates a new Shot Plan id and new Shot ids;
- copies title, coverage, Shot title, description, brief, order, and existing
  last-GenerationSpec behavior;
- attaches only each source Shot's currently selected representative Asset to
  the corresponding copied Shot;
- writes that same Asset as the copied Shot's representative selection;
- does not copy any unselected Shot image relationship;
- does not create a new generated-output provenance claim or duplicate bytes.

The selected Asset is intentionally shared through a second owner relationship.
Asset lifecycle follows active ownership: deleting one plan removes that plan's
Shot relationships without making the shared Asset unavailable to an active
copy.

Removing a Shot and deleting a Shot Plan are recoverable Trash operations.
Their Trash snapshots include every active Shot-image relationship affected by
the operation and whether the underlying Asset tree was discarded because it
had no other active owner. Restore reactivates the Shot or plan, its exact
relationships, representative selection, Asset rows, AssetFile rows, and
packaged files. Garbage collection includes only AssetFiles whose Asset has no
remaining active owner.

The shared relationship lifecycle must handle this representative case:

1. copy a plan with a selected Shot image;
2. delete either plan;
3. the other plan continues to display the image;
4. delete the remaining plan;
5. the image becomes discarded;
6. restoring either plan restores an active owner and the image.

No universal dependency or revision system is introduced. This is the existing
Asset-relationship ownership rule applied to the new Shot target.

Discarding one unselected candidate is also a recoverable relationship
operation. It reuses the same active-owner count and file lifecycle rather than
adding a Shot-specific soft-delete model. The selected-image guard is a Shot
domain rule in Core, not a hidden-card rule in React or an HTTP-handler check.

## Explicit Non-Goals

- Studio Shot Plan cards, dialog layout, brief-card visuals, browser routes, and
  desktop visual verification; these belong to plan 0157.
- Generations-tab content.
- video prompting, video generation, camera takes, editing, post-production,
  timelines, transitions, or final assembly.
- explicit start/end timestamps, overlap, gap, or cumulative duration logic.
- Shot readiness/status, approval, finalization, or history.
- semantic validation of Markdown, brief intent, prompts, generated images, or
  correspondence between them.
- automatic extraction of the brief from Markdown.
- automatic representative-image selection.
- copying unselected image candidates.
- adding Codex to `packages/engines`.
- a new all-in-one context command.
- mobile behavior.

## Context And Evidence

### Accepted decisions and current documentation

- `docs/decisions/0040-use-agent-media-execution-policy-for-external-built-in-image-generation.md`
  keeps Codex outside Engines.
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md` prohibits
  runtime creative-content inspection.
- `docs/decisions/0046-use-generic-image-create-generation-purpose.md` permits
  a focused purpose when a real domain attachment exists.
- `docs/decisions/0052-separate-scene-beats-from-shot-authoring.md` keeps Beats
  narrative and Shots cinematic.
- `docs/decisions/0055-preserve-agent-external-generation-specs-on-images.md`
  preserves the real request behind Codex-created images.
- `docs/decisions/0056-freeze-generation-specs-at-live-execution.md` controls
  request mutability.
- `docs/decisions/0062-detach-shot-plans-from-generated-video-assets.md` is the
  current Shot Plan and generated-video ownership decision.
- `docs/architecture/project-asset-storage-conventions.md` keeps path allocation
  in Core and durable ownership in SQLite.
- `docs/architecture/reference/studio-skills.md` requires CLI-backed,
  progressively disclosed skills.
- `docs/architecture/reference/media-generation.md` defines the current
  GenerationSpec, Preview, managed/external execution, and focused-import
  contracts.

### Current implementation

- `packages/core/src/client/shot-plans.ts` already defines `ShotPlan`, `Shot`,
  coverage, reports, and create/update/copy/read/list/delete inputs.
- `packages/core/src/server/shot-plans/` already owns validation, Beat-context
  warnings, projection, copying, last-Spec continuation, and Trash.
- `packages/core/src/server/commands/shot-plan-commands.ts` exposes the current
  public operations, but its complete-replacement `updateShotPlan` is too broad
  for a thin CLI.
- `packages/core/src/server/schema/shot-plans.ts` stores `shot_plan` and ordered
  `shot` rows. A Shot currently has only `description` and `brief`.
- `packages/core/src/client/shot-authoring.ts`,
  `shot-spec-labels.ts`, and the Studio-generated Shot Design assets already
  provide preferred Shot-size, angle, and movement vocabulary.
- `packages/core/src/server/generation/` already supports purpose descriptors,
  dynamic project-aspect-ratio recommendations, external specs, Preview,
  managed execution, and focused attachment.
- `packages/core/src/server/database/access/asset-relationships/` already owns
  target-specific relationship tables and active-owner counting.
- Cast Profile and Location Hero already demonstrate a candidate relationship
  plus separate selected-display record.
- Trash already knows how to discard and restore an Asset relationship and
  discard the Asset tree only when its final active owner is removed.
- `packages/cli/src/commands/structured-command.ts` and the generation command
  family provide the accepted thin registry-and-handler structure.
- there is no `shot-plan` CLI command.
- `../studio-skills/skills/movie-director` currently marks Shot authoring as a
  future gap, and `media-producer` has no `shot.image` route.

### Real project evidence

`/Users/keremk/renku-movies/urban-basilica/.renku/project.sqlite` currently has:

- 10 Scenes;
- 12 Scene Beat Sheets;
- 52 current Beat storyboard-image rows;
- 0 Shot Plans;
- 0 Shots.

The `Bombardment` Scene has an active 10-Beat Sheet and 10 current Beat images.
It is the realistic verification case. Because there are no persisted Shot
Plans or Shots, the brief-shape replacement and required Shot columns need no
creative-data conversion or compatibility reader.

### Overlapping active plans

- Plan 0154 introduced the first current Core Shot Plan model and is completed.
- Plan 0155 corrected generated-video ownership and is completed; its contract
  remains authoritative.
- Plan 0144 retained the persistence-free Shot Design vocabulary and assets for
  future Shot authoring.
- Plan 0157 is the only planned browser/UI consumer of the contracts created
  here.

## Right-Sized Change Decision

Extend and split the existing Shot Plan owner. The aggregate, Beat coverage,
reports, generation continuation, copy, and Trash boundaries already exist.
The smallest architecture-correct change replaces the broad mutation with
focused commands and adds the missing Shot and Asset relationships inside
those owners. It does not introduce a separate Shot document store,
agent-owned durable files, or a parallel source of Shot identity and order.
Temporary authoring JSON may live under `tmp/operations/`, but it is never the
durable UI source.

## Architecture Shape Gate

### Ownership

| Boundary | Ownership |
| --- | --- |
| Shot Plan, Shot, coverage, order, brief envelope, and representative selection | `packages/core` |
| Shot/plan persistence and Drizzle schema | `packages/core/src/server/schema` and focused database-access modules |
| Shot and Shot Plan Trash, Asset owner counting, copy behavior | `packages/core/src/server/shot-plans` and existing Trash/Asset lifecycle |
| `shot.image` purpose, target facts, reference guide, attachment, and paths | Core generation and project-asset-file modules |
| provider schemas, estimates, and managed execution | existing `packages/engines`; unchanged conceptually |
| command parsing, file reading, human/JSON output, Studio notification | `packages/cli` |
| creative Shot writing and progressive context choices | `../studio-skills/skills/shot-planner` |
| image prompt authoring and managed/external execution | existing `media-producer` skill |

### Intended Core module layout

The current public command file must not grow into a large aggregate
switchboard. Replace it with focused command modules:

```text
packages/core/src/server/commands/
  shot-plan-authoring-commands.ts
  shot-plan-read-commands.ts
  shot-plan-generation-commands.ts
  shot-image-commands.ts
```

- `shot-plan-authoring-commands.ts` owns create, update metadata, add, update,
  move, recoverable remove, copy, and recoverable plan delete entrypoints. Each
  entrypoint opens one project operation and delegates.
- `shot-plan-read-commands.ts` owns list/read only.
- `shot-plan-generation-commands.ts` owns the unchanged last-Spec continuation
  operations.
- `shot-image-commands.ts` owns set/clear representative selection and
  recoverable discard of one unselected candidate.
- delete `commands/shot-plan-commands.ts`; do not leave a forwarding facade.

Split internal authoring by actual responsibility:

```text
packages/core/src/server/shot-plans/
  plan-authoring.ts
  shot-authoring.ts
  copying.ts
  projection.ts
  beat-context.ts
  validation.ts
  trash.ts
  shot-trash.ts
  image-lifecycle.ts
```

- `plan-authoring.ts` owns plan creation and title/coverage changes.
- `shot-authoring.ts` owns add/update/move and position normalization.
- `copying.ts` owns new ids, existing last-Spec copy behavior, and selected-only
  image ownership.
- `projection.ts` returns Shots, selected image, and covered-Beat context.
- `beat-context.ts` continues to own soft reference warnings and adds Beat
  positions and current storyboard-image identity.
- `validation.ts` owns all brief and authoring-envelope validation.
- `trash.ts` owns complete Shot Plan discard/restore.
- `shot-trash.ts` owns individual Shot discard/restore.
- `image-lifecycle.ts` coordinates only Shot-owned relationship and Asset
  discard/restore behavior, including one-candidate discard, by reusing the
  existing Asset lifecycle primitives.

The current database-access file is expected to grow past a reviewable boundary
if image, selection, and focused mutation persistence are added in place.
Replace it directly with:

```text
packages/core/src/server/database/access/shot-plans/
  plan-records.ts
  shot-records.ts
  image-records.ts
```

There is no compatibility `index.ts` or re-export stub. Owning server modules
import the focused internal file directly.

Generation additions stay purpose-specific:

```text
packages/core/src/server/generation/purposes/shot-image.ts
packages/core/src/server/project-asset-files/destinations/shot.ts
```

The existing private purpose switch in `generation/attachments.ts` is already
the growing point for attachment branches. Move that dispatch into a typed
registry in the current focused `generation/attachment-destinations.ts`; each
entry contains only target kind, Asset metadata, relationship role, resource
keys, and destination construction. It must not own validation, persistence,
provider logic, path allocation, or output selection. `attachments.ts` remains
the single workflow and provenance owner.

`packages/core/src/client/index.ts` and `packages/core/src/server/index.ts`
remain the only package entrypoints. They may export the deliberate public
contracts and commands; they must not contain implementation logic.

### Intended CLI module layout

```text
packages/cli/src/commands/
  shot-plan-command.ts
  shot-plan-command-handlers.ts
  shot-plan-plan-command-handlers.ts
  shot-plan-shot-command-handlers.ts
  shot-plan-image-command-handlers.ts
  shot-plan-command-documents.ts
```

- `shot-plan-command.ts` creates the service/runtime, dispatches, publishes
  returned resource keys, and formats one result.
- `shot-plan-command-handlers.ts` is a bounded typed registry only.
- plan, Shot, and image handler files parse their own flags/documents and call
  one Core method.
- `shot-plan-command-documents.ts` reads tagged JSON and reports structured CLI
  input errors; it does not validate creative content or mutate state.

Do not append Shot Plan branching to `screenplay-command.ts`.

The current `command-architecture.test.ts` must not gain another implementation
name. Remove its current handler-inventory and named-file source checks. Keep
the broad all-command import-boundary scan. Move uniqueness enforcement into
the generic structured-command boundary and test it with anonymous handler
fixtures so architecture tests protect capability rather than current handler
names.

### Intended Studio Skills layout

```text
../studio-skills/skills/shot-planner/
  SKILL.md
  references/
    shot-plan-cli-workflow.md
    shot-plan-json-contract.md
    shot-writing-guidelines.md
    shot-brief-vocabulary.md
    representative-image-workflow.md
  samples/
    shot-plan-create.json
    shot-plan-update.json
    shot.json
  evals/
    routing-and-context.md
    iterative-shot-authoring.md
    representative-image.md
```

`SKILL.md` stays short and loads references progressively. It delegates image
execution to `media-producer`; it does not copy the complete generation
workflow.

### Files expected to shrink or disappear

- delete `packages/core/src/server/commands/shot-plan-commands.ts`;
- delete `packages/core/src/server/database/access/shot-plans.ts`;
- remove the broad public `updateShotPlan` command and `UpdateShotPlanInput`;
- remove `camera.movement`, `lighting.key`, and `lighting.accent` from the
  current brief contract instead of retaining aliases;
- shrink the private attachment switch into the typed focused registry;
- remove Movie Director's “future Shot authoring” gap after the new specialist
  exists.

### Explicitly forbidden code shape

- CLI read-modify-write of a complete Shot Plan;
- a generic Core patch command or arbitrary durable-state mutation;
- one command function that parses files, validates domain rules, performs
  persistence, emits notifications, and formats output;
- a new all-project Shot context command;
- a second Asset store or image path chosen by CLI/skill code;
- automatic representative selection on import;
- adapter-owned rules for discarding the selected representative image;
- copying all image candidates;
- Codex represented as a Renku Engines provider;
- runtime inspection of Shot prose, prompts, or generated pixels;
- known-value-only enums that reject custom filmmaking language;
- compatibility aliases for `camera.movement` or the removed broad update;
- source-text architecture tests naming current handlers or private helpers.

### Stop conditions

Stop and revise before implementation continues if:

- any CLI handler must read a Shot Plan before it can mutate one Shot;
- `shot-plan-authoring-commands.ts` or a CLI handler file starts combining
  unrelated read, image, generation, and Trash workflows;
- attachment routing accumulates provider, filesystem, or persistence logic;
- copying representative images requires a general dependency graph;
- an agent instruction is being used to compensate for a missing Core
  invariant;
- runtime validation starts requiring creative terms or correspondence between
  description and brief;
- `index.ts` becomes an implementation file;
- a Shot or Shot Plan can be deleted while leaving active ownerless image files
  or a restore cannot revive the accepted image lifecycle;
- an HTTP, CLI, or React caller must decide whether a selected Shot image may be
  discarded.

## Public Contracts

### Browser-safe Shot Plan model

Replace the current shapes directly:

```ts
export interface Shot {
  id: string;
  position: number;
  title: string;
  description: string;
  brief: ShotBrief;
  representativeImage: Asset | null;
}

export interface ShotInput {
  title: string;
  description: string;
  brief: ShotBrief;
}

export interface ShotPlanCoveredBeat {
  beat: Beat;
  position: number;
  storyboardImage: {
    assetId: string;
    assetFileId: string;
  } | null;
}
```

`position` remains the zero-based persisted/domain order. Human CLI
`--position` is one-based. The UI renders `position + 1`.

`ShotPlanReport` keeps `shotPlan` and replaces `resolvedBeats` with
`coveredBeats: ShotPlanCoveredBeat[]`.

`ShotPlanListReport` returns:

```ts
shotPlans: Array<{
  shotPlan: ShotPlan;
  coveredBeats: ShotPlanCoveredBeat[];
}>;
```

This list contract is intentionally complete so the scene surface can open a
read-only inspector without a second read. It is not a new durable model.

### Focused Core commands

Public ProjectDataService entrypoints are:

```ts
createShotPlan(input: CreateShotPlanInput): Promise<ShotPlanReport>;
updateShotPlanDetails(
  input: UpdateShotPlanDetailsInput
): Promise<ShotPlanReport>;
addShotToPlan(input: AddShotToPlanInput): Promise<ShotPlanReport>;
updateShotInPlan(input: UpdateShotInPlanInput): Promise<ShotPlanReport>;
moveShotInPlan(input: MoveShotInPlanInput): Promise<ShotPlanReport>;
removeShotFromPlan(
  input: RemoveShotFromPlanInput
): Promise<RecoverableMutationReport>;

readShotPlan(input: ReadShotPlanInput): Promise<ShotPlanReport>;
listSceneShotPlans(
  input: ListSceneShotPlansInput
): Promise<ShotPlanListReport>;
copyShotPlan(input: CopyShotPlanInput): Promise<ShotPlanReport>;
deleteShotPlan(
  input: DeleteShotPlanInput
): Promise<RecoverableMutationReport>;

setShotRepresentativeImage(
  input: SetShotRepresentativeImageInput
): Promise<ShotPlanReport>;
clearShotRepresentativeImage(
  input: ClearShotRepresentativeImageInput
): Promise<ShotPlanReport>;
discardShotImageCandidate(
  input: DiscardShotImageCandidateInput
): Promise<RecoverableMutationReport>;
```

`CreateShotPlanInput.shots` accepts `ShotInput[]`.
`UpdateShotPlanDetailsInput` accepts exactly `shotPlanId`, `title`, and
`coverage`. `UpdateShotInPlanInput` accepts exact `shotPlanId`, `shotId`, and
one complete `ShotInput`. `MoveShotInPlanInput.position` is a zero-based target
position and Core clamps nothing: a negative or out-of-range position is a
structured validation error.

Set representative image requires:

- an active Shot;
- an active ready image Asset attached to that exact Shot;
- relationship role `shot-image`;
- an active primary image AssetFile.

The command does not accept a project path, arbitrary relationship role, or
foreign Shot Plan id.

`DiscardShotImageCandidateInput` accepts exactly `projectName`, `shotPlanId`,
`shotId`, and `assetId`. The command requires an active `shot-image`
relationship owned by that exact Shot and rejects the mutation when `assetId`
is the current representative. It delegates relationship, Asset, AssetFile,
packaged-file, owner-count, and restore behavior to the existing Trash
lifecycle. Selection, clear, candidate discard, and candidate restore publish
the exact owning Scene's Shot Plans resource key.

### Authoring JSON documents

The CLI accepts these tagged current documents:

```ts
interface ShotPlanCreateDocument {
  kind: "shotPlanCreate";
  sceneId: string;
  title: string;
  coverage: ShotPlanCoverage | null;
  shots: ShotInput[];
}

interface ShotPlanUpdateDocument {
  kind: "shotPlanUpdate";
  title: string;
  coverage: ShotPlanCoverage | null;
}

interface ShotDocument extends ShotInput {
  kind: "shot";
}
```

There is no `id`, `position`, `status`, image path, selected-image id, model,
prompt, or generated-media field inside these documents. The command target
flags own durable ids. The brief is stored in SQLite JSON; the source file is a
temporary authoring artifact, not a file the browser reads.

### CLI command family

```text
renku shot-plan list --scene <scene-id> --json
renku shot-plan show --shot-plan <shot-plan-id> --json
renku shot-plan validate --file <document.json> --json
renku shot-plan create --file <shot-plan-create.json> --json
renku shot-plan update --shot-plan <shot-plan-id> --file <shot-plan-update.json> --json
renku shot-plan copy --shot-plan <shot-plan-id> --json
renku shot-plan delete --shot-plan <shot-plan-id> --json

renku shot-plan shot add --shot-plan <shot-plan-id> --file <shot.json> --json
renku shot-plan shot update --shot-plan <shot-plan-id> --shot <shot-id> --file <shot.json> --json
renku shot-plan shot move --shot-plan <shot-plan-id> --shot <shot-id> --position <one-based-position> --json
renku shot-plan shot remove --shot-plan <shot-plan-id> --shot <shot-id> --json

renku asset list --target shot:<shot-id> --json
renku shot-plan shot image select --shot-plan <shot-plan-id> --shot <shot-id> --asset <asset-id> --json
renku shot-plan shot image clear --shot-plan <shot-plan-id> --shot <shot-id> --json
```

`validate` selects the Core validator from the required document `kind`; it
never writes. Mutation commands publish the returned
`surface:scene:<scene-id>:shot-plans` resource key through the existing Studio
notification path.

The new target spellings are:

```text
shot.image -> shot:<shot-id>
asset target -> shot:<shot-id>
```

### Structured diagnostics

Retain `CORE_SHOT_PLAN_INVALID`, `CORE_SHOT_PLAN_NOT_FOUND`,
`CORE_SHOT_PLAN_STORAGE_INVALID`, and the current soft Beat warnings where
their meanings remain accurate. Add:

- `CORE_SHOT_NOT_FOUND` for an unavailable active Shot;
- `CORE_SHOT_PLAN_SHOT_MISMATCH` when a command supplies a Shot that does not
  belong to the supplied plan;
- `CORE_SHOT_IMAGE_INVALID` when representative selection does not identify an
  active ready `shot-image` owned by the exact Shot;
- `CORE_SHOT_IMAGE_DISCARD_SELECTED` when a caller tries to discard the
  currently selected representative; the suggestion tells the caller to
  select another candidate or clear the selection first;
- `CLI151` for an unknown `shot-plan` command path;
- `CLI152` for an invalid one-based `--position`.

Validation collects all actionable document issues before failing. Adapters
serialize Core diagnostics; they do not define duplicate domain codes.

### Resource key

Rename the current public key directly:

```ts
studioSceneShotPlansResourceKey(sceneId)
// surface:scene:<sceneId>:shot-plans
```

Update current Core callers and tests. Do not preserve
`studioSceneShotsResourceKey` or the old `:shots` string as an alias. Plan 0157
updates the Studio selection and browser consumers.

## Database Schema And Migration

Use the Drizzle TypeScript schema as source of truth and generate migration
`0066` with the repository Drizzle Kit configuration. The expected project
database generation is 52.

Changes:

```text
shot
  + title text not null
  + discarded_at
  + discard_operation_id
  + restored_at

shot_asset
  id
  shot_id
  asset_id
  locale_id
  role
  reference_name
  purpose
  sort_order
  created_at
  updated_at
  discarded_at
  discard_operation_id
  restored_at

shot_representative_display_asset
  shot_id primary key
  asset_id
  created_at
  updated_at
```

`shot_asset` follows the current relationship-table indexes and foreign-key
shape. The selection table cascades when its Shot or Asset row is physically
removed. Soft discard is coordinated by Core commands rather than inferred
from those foreign keys.

No brief JSON rewrite, compatibility branch, or urban-basilica data conversion
is planned because the real current project has zero Shot rows. Do not add
defaults whose only purpose is to recognize an obsolete brief shape.

Add the canonical durable destination:

```text
shot-plans/<shot-plan-id>/shots/<shot-id>/images/<asset-slug>.<ext>
```

Core's project-asset-file destination owns this path. SQLite remains the source
of truth; runtime code must not infer Shot ownership from path segments.

## Implementation Slices

### Slice 1: record the accepted domain and workflow decision

- Add ADR 0063 for thin Shot documents, glanceable briefs, Shot-owned image
  candidates, explicit representative selection, selected-only copy, image
  Trash lifecycle, and the purpose-specific Codex preference.
- Add a concise notice to Decision 0040 that ADR 0063 narrows the default
  execution guidance for `shot.image`; leave the historical body unchanged.
- State explicitly that Decision 0062's generated-video independence remains
  unchanged.

### Slice 2: replace the public Shot and brief contracts

- Add Shot title and representative image to the browser-safe contract.
- Replace the brief shape directly.
- Make preferred vocabulary values discoverable while allowing custom values.
- Add covered-Beat positions and storyboard-image identities to list/read
  reports.
- Update validators and current tests without semantic content checks.

### Slice 3: generate the schema migration and split persistence

- Update Drizzle schema for Shot title/lifecycle, Shot Asset relationships, and
  representative selection.
- Generate migration 0066 through Drizzle Kit.
- Replace the current database-access file with the three focused modules.
- Update id allocation, schema exports, owner counting, and migration tests.

### Slice 4: add focused Shot Plan and Shot authoring

- Split the public commands and internal authoring files to the Architecture
  Shape Gate.
- Replace `updateShotPlan` with update-details, add, update, move, and
  recoverable remove.
- Keep all position and membership checks in Core.
- Update copy behavior for new title/brief fields before adding image copy.

### Slice 5: add Shot Asset ownership, selection, copy, and Trash

- Add `shot` AssetTarget and `shot_asset` persistence.
- Add set/clear representative commands and focused recoverable discard of one
  unselected candidate.
- Project the exact selected Asset or `null`.
- Copy only selected representative relationships.
- Extend plan and Shot Trash to cover every owned candidate and file.
- Refactor only the existing shared relationship lifecycle needed to handle
  active-owner counts and restore; do not create a general dependency system.
- Add the generic `Shot` label to the existing Trash panel's exhaustive
  `TrashItemKind` presentation as the one compile-required non-authoring UI
  edit in this plan. Do not add any Shot Plan surface here.

### Slice 6: add `shot.image`

- Add the purpose and target kinds.
- Resolve the exact Shot and its owning Scene for context/reference candidates.
- Recommend project aspect ratio.
- Add the focused attachment route and owner-aware durable path.
- Keep generation, Preview, managed/external provenance, output acceptance, and
  explicit selection as separate current steps.
- Add `shot:<id>` to generation, media-import, and asset-target parsers.

### Slice 7: add the thin CLI command family

- Add flags, top-level help, dispatch, focused handlers, document parsing, JSON
  output, human output, and resource notifications.
- Refactor the current CLI architecture test away from implementation
  inventories.
- Add `docs/cli/commands.md` examples and exact one-based position wording.

### Slice 8: add `shot-planner` and update routing

- Create the progressive skill, references, samples, and evals.
- Route Movie Director Shot Plan requests to `shot-planner`.
- Insert Shot planning after Scene Beat Sheets/storyboard context and before
  later video work in the department map and default production order.
- Update `media-producer` with `shot.image` routing, the external-Codex
  preference for this explicit purpose, a checked-in sample, and the exact
  focused import/select handoff.
- Keep image generation details in `media-producer`, not duplicated in
  `shot-planner`.

### Slice 9: realistic integration and documentation

- Exercise the full CLI/skill journey in a temporary clone of
  `urban-basilica`, using the real Bombardment Scene, active Beat ids, Cast,
  Locations, Lookbook, and storyboard context.
- Validate create, incremental edits, move/remove/restore, image candidate
  attachment/selection, copy, plan delete/restore, and readback.
- Update current architecture references and remove the current Shot-authoring
  gap.

## Agent Workflow Contract

### Progressive context

`shot-planner` starts with the least context needed and reads more only when the
creative decision requires it:

```bash
renku studio current --json
renku director context --selection '<current-scene-selection>' --json
renku screenplay beat-sheet context --scene <scene-id> --json
renku screenplay beat-sheet show --active --scene <scene-id> --json
renku shot-plan list --scene <scene-id> --json
renku shot-plan show --shot-plan <shot-plan-id> --json
```

For deeper questions it uses existing focused commands for Cast, Location,
Lookbook, Scene lists, and nearby Scene reads. It does not request all visual
files by default. It inspects exact visual assets only when a visual choice
requires them.

The companion UI plan extends current Studio scene selection with optional
`shotPlanId` and `shotId`. When present, the skill uses those exact ids. When
absent, it uses the user-supplied plan/Shot, resolves a one-based Shot number
against the current ordered report, or asks which plan is intended. It never
guesses from a title fragment.

### Iterative writing

- A first request may create an empty plan, one authored Shot, or an explicit
  multi-Shot proposal.
- The agent validates before every mutation and reads back after it.
- Focused changes use focused commands; the agent does not resubmit unchanged
  Shots.
- The description remains self-contained and model-neutral.
- The brief captures only the five glanceable summaries and duration intent.
- The agent does not invent technical choices the user has not made.
- There is no “mark done” step.

### Representative image handoff

When requested, `shot-planner` gives `media-producer`:

- purpose `shot.image`;
- target `shot:<shot-id>`;
- the exact current Shot Plan and Shot report;
- the selected Scene, Beat, Cast, Location, Lookbook, and visual references
  that the agent deliberately chose;
- the project aspect-ratio requirement.

If the user did not select an execution route, the agent proposes Codex
GPT-Image-2 and still shows the saved Preview before generation. A user choice
of Renku or another supported image model overrides that preference.

After the user accepts the output, the agent imports it and separately selects
it. Rejected output remains unattached. Imported but unselected output remains
a valid candidate.

## Tests And Guardrails

### Core contract and authoring tests

- create empty, one-Shot, and multi-Shot plans;
- preserve exact title, Markdown bytes, brief values, coverage, and order;
- accept preferred and custom Framing/Camera/Motion values;
- accept intent-led Optics and Lighting with or without technical Optics facts;
- reject malformed envelope fields and collect actionable issues;
- prove Core does not require creative terms in description or compare it with
  the brief;
- update title/coverage without changing Shots;
- add, update, move, and remove one exact Shot;
- reject cross-plan Shot ids and invalid positions before writes;
- preserve contiguous zero-based positions after move/remove;
- verify the removed broad update no longer exists in the public contract.

### Asset, copy, and lifecycle tests

- attach several `shot-image` candidates to one exact Shot;
- reject a missing, non-image, wrong-role, discarded, or differently owned
  representative Asset;
- set, replace, and clear selection without discarding candidates;
- discard and restore one unselected candidate without changing the
  representative;
- reject discard of the selected candidate before any write;
- copy only selected representative ownership and no unselected candidate;
- keep a shared selected Asset active while either copied owner remains;
- discard and restore every candidate for individual Shot removal;
- discard and restore every candidate for Shot Plan deletion;
- restore an Asset when any accepted owner is restored after the final owner
  had been deleted;
- collect files only when no active owner remains;
- retain current last-GenerationSpec copy and independence behavior.

### Generation tests

- `shot.image` reports target kind `shot`, output kind `image`, project aspect
  ratio recommendation, and no fake Codex Engines model;
- missing Shot target fails with a structured target error;
- context resolves the owning Scene and current reference candidates without
  semantically parsing description;
- managed receipt and frozen external source Spec must match exact purpose and
  Shot target;
- import creates a `shot-image` relationship and never selection;
- durable path allocation stays in the Shot destination module.

### Migration tests

- migration 0066 advances an empty current database from generation 51 to 52;
- new current databases contain the exact Shot, relationship, and selection
  columns/indexes;
- migration uses generated Drizzle SQL and has no hand-maintained registry;
- the real project's zero Shot count requires no JSON conversion.

### CLI adapter tests

- each command path parses its exact flags/document and delegates once;
- `--position 1` maps to Core position `0`, and zero/non-integer/out-of-range
  input reports `CLI152`;
- validate does not write;
- mutation output preserves Core warnings/recovery/resource keys;
- Studio notification failure does not rerun a successful mutation;
- generation, media, and asset parsers accept `shot:<id>`;
- generic command-registry uniqueness is protected without naming the current
  Shot Plan handlers in an architecture test;
- the broad all-command import scan proves no CLI database/schema/Drizzle
  access.

### Studio Skills evals

- Movie Director routes Shot Plan intent to `shot-planner`;
- the specialist resolves current selection/scene and reads focused context in
  progressive order;
- a first multi-Shot proposal validates and creates one plan;
- a later request updates only the selected or numbered Shot;
- the agent reorders and recoverably removes without whole-plan replacement;
- descriptions preserve coherent visual intent and explicitly state material
  Optics and Lighting choices;
- the brief stays concise, uses preferred terms when applicable, and permits
  custom language;
- representative image requests hand off to `media-producer`, stop at Preview,
  wait for approval, inspect output, import, and explicitly select;
- Codex is preferred only for this accepted workflow when the user did not
  choose another execution path;
- no eval expects a final/done state.

### Stable architecture guardrails

- keep the existing package import-boundary scan for CLI-to-Core ownership;
- test runtime rejection before writes rather than source-text helper names;
- test the public document and report shapes where they are stable contracts;
- do not add an architecture inventory of every Shot Plan command or file;
- keep `client/index.ts` and `server/index.ts` thin public entrypoints.

## Documentation

Add:

- `docs/decisions/0063-use-thin-shot-documents-and-shot-owned-images.md`.

Update:

- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/reference/domain-vocabulary.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/architecture/test-execution-strategy.md`;
- `docs/cli/commands.md`;
- Decision 0040 with a concise supersession/narrowing notice only;
- Movie Director and Media Producer current skill references, samples, and
  coverage/gap documents.

Do not rewrite Decisions 0052, 0061, or 0062. ADR 0063 should state how the new
Shot-owned planning image differs from the independent generated-video Assets
in Decision 0062.

## Final Verification

Run focused checks first:

```bash
pnpm build:core
pnpm test:cli
pnpm --dir packages/core test
pnpm --dir packages/studio test -- trash-panel
```

Run the Studio Skills validators/evals named by the sister repository and the
media-producer image-guide validator against `urban-basilica`.

Then run the root gates:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

Realistic acceptance uses a temporary clone of
`/Users/keremk/renku-movies/urban-basilica`, not the obsolete in-repository
sample:

1. migrate the clone to generation 52;
2. create a Bombardment Shot Plan covering selected current Beats;
3. add, update, move, and remove/restore Shots;
4. attach at least two image candidates to one Shot and select one;
5. discard/restore the unselected candidate and prove selected discard fails;
6. copy the plan and confirm only the selected image is copied;
7. delete/restore each plan and inspect Asset/file availability;
8. read every result through CLI JSON.

Before completion:

- inspect `git diff --stat`;
- inspect the complete diff, including generated migration and sister-skill
  changes;
- inspect every newly large or heavily modified file;
- confirm the old command/access files are deleted with no facade;
- confirm Core/CLI entrypoints remain thin;
- confirm the attachment registry is a shallow map rather than a god
  dispatcher;
- confirm no semantic creative validation or compatibility branch was added;
- confirm no checklist item was satisfied by accepting an unreviewable owning
  module.

## Completion Evidence

Implementation and verification completed on 2026-07-26.

- Drizzle Kit generated migration 0066, and the project database generation is
  52.
- Focused Core Shot Plan tests pass: 9 tests across the authoring and lifecycle
  suites.
- The full root suite passes: build, 1,234 executed tests, lint, type checks,
  architecture checks, and test-execution partition checks. Lint reports only
  the existing `packages/studio/server/bin.ts` console warning.
- The media-producer image prompt guide validator passes for `urban-basilica`.
  The shot-planner YAML and JSON artifacts also parse successfully. The
  skill-creator `quick_validate.py` entrypoint was invoked, but its Python
  environment lacks PyYAML; the same frontmatter, naming, YAML, and JSON checks
  were completed with the available Ruby YAML and JSON parsers.
- The realistic acceptance journey completed in an isolated
  `/private/tmp/renku-shot-plan-0156.oGhhI0` copy of `urban-basilica`: migration,
  current context reads, plan creation and validation, focused Shot mutations,
  image import/selection/discard/restore, selected-only copy, plan
  delete/restore, and final CLI JSON reads all succeeded. The source movie
  project was not mutated.
- Diff, architecture shape, deleted-file, entrypoint, attachment-registry,
  compatibility, and opaque-artifact reviews completed for this repository and
  the sister `studio-skills` repository.

## Completion Checklist

### Review Area

- [x] Confirm every implemented behavior maps to the requirement ledger.
- [x] Confirm the implementation extends the existing Shot Plan owner rather
      than adding a parallel Shot document system.
- [x] Confirm plan 0157 can consume the final contracts without adding durable
      rules in Studio.
- [x] Confirm there is no final/done state, timeline, or video-generation scope.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.

### Shot And Brief Contracts

- [x] Add non-empty Shot title to the public contract, authoring inputs,
      projection, persistence, copy, and tests.
- [x] Keep exact Markdown description as the canonical opaque creative
      document.
- [x] Replace the brief directly with Framing, Camera, Motion, Optics,
      Lighting, and separate duration.
- [x] Put Shot size under Framing and angle under Camera.
- [x] Make Optics and Lighting intent primary while keeping optional Optics
      technical facts.
- [x] Expose preferred Shot-size, angle, and movement names while accepting
      custom non-empty values.
- [x] Remove old brief fields without aliases or compatibility validation.
- [x] Keep description/brief semantic coherence agent-owned.
- [x] Add covered-Beat position and current storyboard-image identity to read
      reports.

### Architecture And Public Commands

- [x] Remove broad `updateShotPlan` and `UpdateShotPlanInput`.
- [x] Add update-details, add-Shot, update-Shot, move-Shot, and recoverable
      remove-Shot commands.
- [x] Keep membership, order, and validation rules in Core.
- [x] Split public command and internal authoring modules to the Architecture
      Shape Gate.
- [x] Replace the growing database-access file with focused plan, Shot, and
      image modules.
- [x] Keep `client/index.ts` and `server/index.ts` as thin entrypoints.
- [x] Use structured package-boundary diagnostics.

### Database And Storage

- [x] Add Shot title and recoverable lifecycle columns.
- [x] Add `shot_asset` and `shot_representative_display_asset`.
- [x] Add Shot Asset target and id allocation.
- [x] Add Core-owned `shot.image` durable destination.
- [x] Generate migration 0066 through Drizzle Kit.
- [x] Advance project database generation to 52.
- [x] Add no migration-at-read or obsolete brief compatibility.

### Representative Images, Copy, And Trash

- [x] Support multiple Shot-owned `shot-image` candidate Assets.
- [x] Support zero or one explicitly selected representative.
- [x] Keep import and selection as separate commands.
- [x] Reject representative Assets that are unavailable or not owned by the
      exact Shot.
- [x] Add focused recoverable discard for one unselected candidate.
- [x] Reject discard of the selected representative before any write.
- [x] Restore an individually discarded candidate without selecting it.
- [x] Copy only selected representative ownership.
- [x] Do not copy unselected candidates or fabricate generation provenance.
- [x] Delete/restore Shot images with individual Shot removal.
- [x] Delete/restore all Shot images with Shot Plan deletion.
- [x] Preserve shared selected images while any copied owner remains active.
- [x] Collect files only after the last active owner is gone.
- [x] Add the compile-required `Shot` label to the generic Trash panel without
      implementing the Shot Plans UI.

### Generation Purpose

- [x] Add `shot.image` and `shot` target to current contracts and parsers.
- [x] Resolve the exact Shot and owning Scene in Core.
- [x] Recommend the current project aspect ratio.
- [x] Keep Codex outside Engines and preserve real external Spec provenance.
- [x] Move focused attachment routing into a shallow typed registry in the
      current `generation/attachment-destinations.ts`.
- [x] Keep Preview, approval, execution, output acceptance, import, and
      selection as distinct steps.
- [x] Ensure import never auto-selects.

### CLI

- [x] Add the exact `renku shot-plan` commands and flags.
- [x] Use tagged current JSON authoring documents.
- [x] Treat CLI `--position` as one-based and Core position as zero-based.
- [x] Extend asset, generation, and media target parsing with `shot:<id>`.
- [x] Publish the renamed Shot Plans resource key after mutations.
- [x] Keep handlers as parse/delegate/serialize adapters.
- [x] Remove architecture tests that inventory current handler or file names.
- [x] Preserve the broad CLI-to-database import boundary.

### Agent Skills

- [x] Add the `shot-planner` skill, progressive references, samples, and evals.
- [x] Route Movie Director Shot Plan requests to the specialist.
- [x] Replace the future Shot-authoring gap in current routing docs.
- [x] Teach progressive project/scene/Beat/Cast/Location/Lookbook discovery.
- [x] Teach focused iterative commands and exact-id/one-based-number resolution.
- [x] Teach coherent Markdown Shot writing without mandatory creative sections.
- [x] Teach concise brief authoring and explicit Optics/Lighting prose.
- [x] Hand representative-image work to `media-producer`.
- [x] Prefer Codex GPT-Image-2 for this accepted workflow when the user has not
      selected another route.
- [x] Require Preview approval and separate output acceptance.
- [x] Add no final/done workflow.

### Tests And Guardrails

- [x] Add owning-layer authoring and invalid-state coverage.
- [x] Add Asset selection, copy, multi-owner, Trash, restore, and garbage
      collection coverage.
- [x] Add generation context, provenance, attachment, and path coverage.
- [x] Add migration 0066 tests.
- [x] Add thin CLI parsing/delegation/output tests.
- [x] Add skill routing, iterative authoring, writing, and image workflow evals.
- [x] Cover edge cases at their owning layer rather than copying the full
      matrix through CLI and skill tests.
- [x] Use stable contract/runtime guardrails, not source-text implementation
      names.

### Documentation And ADR

- [x] Add ADR 0063.
- [x] Add only a concise narrowing notice to Decision 0040.
- [x] Keep Decisions 0052, 0061, and 0062 historically intact.
- [x] Update current data model, vocabulary, media, asset, storage, skill, test,
      and CLI references.
- [x] Do not edit historical plans for a naming sweep.

### Final Verification

- [x] Run focused Core, CLI, Trash-panel, and Studio Skills checks.
- [x] Run root build, test, lint, and check.
- [x] Complete the temporary urban-basilica clone journey.
- [x] Inspect `git diff --stat` and the complete diff.
- [x] Inspect new or heavily modified files for architecture shape.
- [x] Confirm deleted files have no forwarding facade or re-export stub.
- [x] Confirm no broad switchboard, generic patch API, god context command, or
      semantic creative validator was introduced.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
