# 0144 Scene Beats And Shot Authoring Reset

Status: completed
Date: 2026-07-16

## Summary

Correct the foundational modeling error that currently treats narrative Beats as
camera Shots and then groups those mislabeled Shots inside Shot Video Takes.

This is a cleanup and simplification pass before the new Shot authoring workflow
is designed.

The accepted outcome is:

1. The current Scene Shot List becomes a **Scene Beat Sheet**.
2. Its current entries become **Beats**.
3. Existing Beat text, history, active selection, storyboard images, storyboard
   status, storyboard generation/import behavior, and the current grid/detail UI
   are structurally preserved through migration.
4. The current **Shots** tab becomes **Beats**.
5. The current **Takes** tab becomes **Shots**.
6. The Shots tab contains only the existing add-card treatment relabeled
   **New Shot**. The control intentionally performs no action in this pass.
7. The existing Takes edit workspace is removed from the live product.
8. Shot grouping, grouped Beat selection, Continuous Move, Multi-Cut Sequence,
   and every durable Shot Video Take contract are removed rather than renamed.
9. The current Composition, Motion, Dialogs, AI Production, and optional video
   preview implementations are extracted into a clean, persistence-free Shot
   authoring module for reuse by the next plan.
10. The Shot References tab and its Shot-specific persistence, projections,
    routes, and components are removed. Shared generation-reference
    infrastructure used by Generation Preview and Image Revision remains.
11. The project schema contains Beat Sheet and Beat Storyboard tables only. It
    contains no Shot Video Take, Shot membership, Shot group, Take image/video,
    or Shot-owned generic-reference tables.
12. The real `urban-basilica` project preserves Beat Sheets and storyboard
    images while removing all current Shot Video Takes, Take generation records,
    Take-owned assets, Take trash items, and the retired `shots/` media tree.
13. After structural migration, the active `urban-basilica` Beat descriptions
    receive an agent-led content pass that removes Shot direction while
    preserving visual setting and narrative meaning.

This plan deliberately does **not** define the new durable Shot model, the
Beat-to-Shot relationship, Shot creation workflow, Shot persistence, Shot
generation target, Shot output/take semantics, Shot selection/export behavior,
or the next Shot editor composition. Those belong in the following design plan.

## Current State Evidence

The current code and real project confirm that this is not a copy-only rename.

### Mixed narrative and camera contract

`packages/core/src/client/scene-shot-list.ts` currently defines one `SceneShot`
with both narrative fields and camera fields:

- narrative: `storyBeat`, `narrativePurpose`, `description`, `subject`,
  `action`, dialogue coverage, cast, locations, and screenplay block coverage;
- camera: `shotType`, `cameraAngle`, `cameraMovement`, `framing`,
  `lensIntent`, and `aspectRatio`.

The current Scene Shots review UI displays the narrative subset. The current
Take editor uses the same objects as selectable/groupable camera units. That is
the core modeling error this plan removes.

### Current implementation size and coupling

The current implementation includes:

- a 1,042-line `scene-shot-list-commands.ts`;
- a 418-line combined Shot List and storyboard-image database access module;
- a 1,002-line Takes tab;
- a 454-line combined Shot/Take detail editor;
- a 454-line Shot References tab;
- a 400-line public Shot Video Take workspace contract;
- a multi-file Core Shot Video Take workspace with lifecycle, direction,
  generation, references, media, trash, and export behavior.

The cleanup must reduce and separate these responsibilities. Renaming files in
place while keeping the same module shape is not acceptable.

### Plan 0143 is the current-state baseline

The completed implementation of Plan 0143 is the current code, schema, and
product baseline from which this forward cleanup starts:

- migration `0058_flexible_generation_authoring.sql`;
- `scene_shot_reference_asset`;
- Shot-owned generic reference commands and trash behavior;
- expanded Take reference projections and UI;
- completed-Take and new-Take authoring behavior;
- new shared generation reference picker/API work.

Migration 0058 has already been applied to `urban-basilica`, whose current
`PRAGMA user_version` is `45`.

The implementation must therefore:

- accept the committed Plan 0143 result as the current state;
- treat migration 0058/schema generation 45 as the real migration baseline;
- remove the now-obsolete Shot-specific implementation through new forward code
  and migration changes;
- retain the shared generation-reference picker/API behavior used by Generation
  Preview and Image Revision;
- generate a new forward migration rather than rewriting 0058 as if it had
  never been applied;
- leave Plan 0143 and migration 0058 unchanged as historical implementation
  records.

### Real `urban-basilica` database inventory

The database is currently healthy:

- `PRAGMA user_version`: `45`;
- `PRAGMA quick_check`: `ok`;
- `PRAGMA foreign_key_check`: no issues.

Beat data to preserve through the structural migration:

| Current storage | Current count | Structural migration result |
| --- | ---: | --- |
| `scene_shot_list` | 8 | 8 `scene_beat_sheet` rows |
| Beat-like JSON entries under `shots[]` | 69 | 69 `beats[]` entries |
| `scene_shot_list_state` | 4 | 4 `scene_beat_sheet_state` rows |
| `scene_shot_storyboard_image` relationships | 35 | 35 `scene_beat_storyboard_image` rows |
| unique `scene_storyboard_image` assets/files | 20 | preserved |

The later agent-led description cleanup may add new Beat Sheet history rows for
the four active sheets. Those reviewed revisions are intentional current
history, not migration loss or duplicated compatibility state.

Retired data to remove:

| Current storage | Current count |
| --- | ---: |
| `scene_shot_video_take` | 30 |
| `scene_shot_video_take_shot` | 35 |
| `scene_shot_video_take_image` | 0 |
| `scene_shot_video_take_video` | 4 |
| `shot.video-take` Generation Specs | 13 |
| completed Take Generation Runs | 4 |
| `shot.input` assets | 6 |
| `shot.video-prompt-sheet` assets | 5 |
| `shot.video-take` assets | 4 |
| `sceneShotVideoTake` Trash Items | 25 |
| `scene_shot_reference_asset` | 0 |

The project also contains a top-level `shots/` tree with Take videos, first/last
frames, prompt images, duplicate intermediate outputs, and `.DS_Store` files.
That tree is retired with the Take model.

## Accepted Product Decisions

### Narrative Beats and camera Shots are different concepts

A Beat is a story object. It describes a meaningful viewer-state, information,
power, emotion, or action change inside a Scene.

A Beat also describes the visual situation in which that narrative development
occurs: setting, placement of people when important, spatial relationships,
significant objects, atmosphere, and other story-relevant visual facts. It does
not prescribe shot size, lens, framing, camera movement, cuts, coverage,
performance direction, or production execution.

A Shot is a camera/production object. Multiple Shots may realize one Beat, and
one Shot may bridge Beat boundaries when the future design explicitly allows
it.

This cleanup models Beats only. It does not guess the future Shot relationship.

### A Scene Beat Sheet remains a versioned scene-owned document

The current history model is useful and should remain:

- a Scene may have several Beat Sheet history rows;
- one Beat Sheet may be active;
- Beats remain ordered inside validated JSON;
- operations may derive a new Beat Sheet from an explicit base;
- storyboard images remain attached to an exact Beat Sheet and Beat;
- unchanged Beat storyboard images may be carried into a derived Beat Sheet.

This plan does not normalize every Beat into its own table. The versioned JSON
document remains the source of truth for the Beat Sheet.

### Storyboard sheets and storyboard images keep their product names

The generation purpose remains:

```text
scene.storyboard-sheet
```

The output remains a storyboard sheet that the agent may split into individual
Scene Storyboard Images.

The ownership changes from Shot to Beat:

```text
Scene Storyboard Image -> exact Scene Beat Sheet -> exact Beat
```

The asset type remains `scene_storyboard_image`, and the asset file role remains
`storyboard_image`.

### The legacy Take aggregate is deleted, not renamed

`SceneShotVideoTake` does not become `Shot`.

The current aggregate encodes assumptions that are now rejected:

- one Take selects one or several current “Shots,” which are actually Beats;
- those selected Beats form a group;
- the group is either Continuous Move or Multi-Cut;
- one shared or per-member direction object controls the group;
- AI Production belongs to the group-level Take;
- final video, supporting images, references, picks, trash, and export all hang
  off the Take.

Renaming that aggregate would preserve the wrong architecture. All of those
contracts are removed.

### The new Shots tab is intentionally empty

The Scene tab contract becomes:

```text
Narrative | Beats | Shots
```

The Shots tab shows the existing add-card visual treatment with the label
**New Shot**.

In this pass:

- the button makes no request;
- the button creates no database row;
- the button opens no editor;
- the button changes no URL state;
- no empty Shot record or placeholder Shot is persisted;
- no temporary compatibility Take is created.

### Reusable Shot editor code is retained without legacy persistence

The Composition, Motion, Dialogs, AI Production, and video-preview code is
retained as an isolated Shot authoring kit.

It is not mounted from the current Scene surface in this pass.

It must:

- contain no `SceneShotVideoTake` types;
- call no Take API;
- know nothing about Beat membership;
- contain no Continuous Move, Multi-Cut, grouped count, or group-strip behavior;
- contain no References tab;
- accept explicit controlled values and callbacks;
- remain covered by focused component and pure-projection tests.

This isolated module is the only intentional dormant production-code exception
in the cleanup. It exists because the user explicitly requested that these
designs and backing editor models be preserved for the next Shot authoring pass.

### Shared generation references remain

Removing the Shot References tab does not remove generic generation references.

Keep:

- Core Generation Spec reference envelopes;
- Generation Preview reference projection and editing;
- Image Revision reference editing;
- the media-generic generation-reference catalog;
- `packages/studio/src/features/reference-picker`;
- the shared Studio generation-references route and browser service.

Remove:

- the Shot References tab;
- Shot-specific reference card/layout wrappers;
- Take reference workspace projections;
- Take reference mutation routes;
- `scene_shot_reference_asset`;
- Shot-owned generic reference registration/discard behavior.

### Other Take concepts remain when they are real domain concepts

This plan removes **Shot Video Takes** only.

Scene Dialogue Audio Takes remain. They are real generated candidate outputs
owned by Scene Dialogue Audio and are not part of the rejected Beat/Shot group
model.

## Canonical Rename And Removal Map

| Current concept | Current name | New current contract |
| --- | --- | --- |
| scene narrative breakdown document | Scene Shot List | Scene Beat Sheet |
| ordered entry | `SceneShot` | `Beat` |
| entry id property/value | `shotId` / `shot_*` | `id` / `beat_*` |
| document collection | `shots` | `beats` |
| document strategy | `coverageStrategy` | `narrativeProgression` |
| narrative development | `storyBeat` | `narrativeDevelopment` |
| screenplay relationship | `coveredBlockIndexes` | `screenplayBlockIndexes` |
| entry subject | `subject` | removed |
| entry action | `action` | removed |
| entry dialogue coverage | `dialogue` | removed from Beat |
| entry sound direction | `audioNotes` | removed from Beat |
| entry production direction | `productionNotes` | removed from Beat |
| base history link | `baseShotListId` | `baseBeatSheetId` |
| primary table | `scene_shot_list` | `scene_beat_sheet` |
| active state table | `scene_shot_list_state` | `scene_beat_sheet_state` |
| storyboard relationship | `scene_shot_storyboard_image` | `scene_beat_storyboard_image` |
| UI tab | Shots | Beats |
| Beat selection query | `shot=<shot-id>` | `beat=<beat-id>` |
| UI tab | Takes | Shots |
| add action | New Take | New Shot, inert in this pass |
| Take workspace | `SceneShotVideoTake` | removed |
| Take member/group table | `scene_shot_video_take_shot` | removed |
| group mode | Continuous / Multi-Cut | removed |
| Shot References tab | References | removed |
| Shot generic reference table | `scene_shot_reference_asset` | removed |

There are no aliases, old command paths, old JSON kinds, dual fields, route
fallbacks, migration-at-read branches, or compatibility re-exports.

## Beat Sheet Contract

### `SceneBeatSheetDocument`

The browser-safe current document is:

```ts
export interface SceneBeatSheetDocument {
  kind: 'sceneBeatSheet';
  sceneId: string;
  title: string;
  summary: string;
  narrativeProgression: string;
  baseBeatSheetId?: string | null;
  lookbookInfluence?: string;
  beats: Beat[];
  openQuestions?: string[];
}
```

### `Beat`

The Beat contract is deliberately small and contains only Beat-owned narrative,
visual-setting, project-relationship, and screenplay-source facts:

```ts
export interface Beat {
  id: string;
  title: string;
  description: string;
  narrativeDevelopment: string;
  narrativePurpose: string;
  castMemberIds: string[];
  locationIds: string[];
  screenplayBlockIndexes: number[];
}
```

Field ownership is exact:

- `id` is the durable Beat identifier. The property is not named `beatId`
  because its owning object is already a `Beat`.
- `title` is the short human-readable Beat name.
- `description` describes the Beat's visual situation: setting, meaningful
  placement, spatial relationships, important elements, and atmosphere. It is
  not a camera or Shot description.
- `narrativeDevelopment` replaces `storyBeat`. It describes what physically,
  emotionally, relationally, or informationally develops in the Beat.
- `narrativePurpose` describes why that development matters to the Scene and
  wider narrative.
- `castMemberIds` reference actual project Cast Members.
- `locationIds` reference actual project Locations.
- `screenplayBlockIndexes` identify the current Scene screenplay blocks from
  which the Beat is derived.

Core validates every Cast Member id, Location id, and screenplay block index.
Persisted Beats contain ids rather than embedded Cast Member or Location
snapshots. Resources and UI projections resolve those ids to the actual project
records.

The following current fields are removed from Beat persistence:

- `subject`;
- `action`;
- `dialogue`;
- `audioNotes`;
- `productionNotes`;
- `shotType`;
- `cameraAngle`;
- `cameraMovement`;
- `framing`;
- `lensIntent`;
- `aspectRatio`.

`subject` is redundant with the deliberately defined Beat `description`.
`action`, `dialogue`, `audioNotes`, and `productionNotes` currently contain
Shot coverage, blocking, sound timing, performance, continuity, and generation
direction. Those concerns belong to future Shot authoring rather than Beat
persistence.

The structural migration preserves `description`, `narrativeDevelopment`, and
`narrativePurpose` values exactly. It does not attempt creative rewriting in
SQL or Studio runtime code. A separate agent-led sample-project content pass
after migration revises Shot-focused descriptions through the new Beat Sheet
command contract.

Concrete `urban-basilica` cleanup example:

```text
Current Shot-focused description:
Tight two-shot across the curve of the barrel, with Mara low and sharp-eyed
in the foreground while Urban answers from the other side of the bronze.

Accepted Beat description:
Mara and Urban stand on opposite sides of the heated bronze barrel. The weapon
physically divides them while the surrounding battlefield prepares for its use.
```

The associated narrative values remain distinct:

```text
Narrative Development:
Mara names the cannon's danger and Urban answers by turning danger into craft
language.

Narrative Purpose:
Define the moral argument of the scene: whether the violence belongs to metal
or to men.
```

### Beat Sheet operations

The current operation model is renamed directly:

```text
sceneBeatSheetOperations
beats.insert
beats.replace
beat.update
beats.delete
beatSheet.replace
```

Operation placement and target lists may use explicit `beatId` and `beatIds`
fields because those ids appear outside their owning `Beat` object. The Beat
object itself always uses `id`. The resulting full Beat Sheet must validate
against the same current Beat Sheet schema.

### Storyboard import

The import document remains `sceneStoryboardImagesImport` because it describes
the media package, not the former planning model.

Its fields become:

```ts
interface SceneStoryboardImagesImportDocument {
  kind: 'sceneStoryboardImagesImport';
  title?: string;
  beatSheetId: string;
  beats: Array<{
    beatId: string;
    source: string;
    title?: string;
    sourcePurpose?: 'scene.storyboard-sheet';
    sourceSpecId?: string;
    sourceRunId?: string;
  }>;
}
```

Reports use `beatSheetId`, `beatId`, `missingBeatIds`, `staleBeatIds`, and
`readyBeatIds`.

## Scope

### In scope

- Beat terminology and contract replacement across schema, Core, CLI, Studio
  server, browser, coordination events, resource keys, docs, tests, and skills.
- One-way preservation of Beat Sheet history and storyboard-image
  relationships.
- Replacement with the exact minimal `Beat` contract.
- Removal of Subject, Action, Dialogue Coverage, Audio Notes, Production Notes,
  and structured camera fields from Beat JSON.
- Agent-led cleanup of Shot-focused descriptions in the active
  `urban-basilica` Beat Sheets.
- Removal of every Shot Video Take and Shot group contract.
- Removal of Shot References.
- Extraction of reusable Shot authoring UI and editor-value types.
- A new inert Shots tab.
- Removal of take-driven production export until the real Shot/select model
  exists.
- Removal of obsolete Take media and database records from `urban-basilica`.
- Removal of active Shot Video Take skill workflows.

### Out of scope

- durable Shot rows;
- Beat-to-Shot relationships;
- Shot ordering;
- Shot creation dialog or workflow;
- Shot persistence/autosave;
- Shot reference design;
- Shot generation purposes or targets;
- Shot result/take model;
- Shot picks/selects;
- production export from the future Shot model;
- a replacement References tab;
- mobile behavior.

## Context

Accepted architecture and product references:

- `AGENTS.md`
- `plans/PLAN_TEMPLATE.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/naming-guidelines.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/reference/front-end-guidelines.md`
- `docs/architecture/json-storage-validation.md`
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`
- `docs/decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md`
- `docs/decisions/0015-use-feature-service-ui-layering-for-the-studio-frontend.md`
- `docs/decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`
- `docs/decisions/0041-keep-ai-artifacts-and-prompts-opaque.md`
- `docs/product/workflows.md`
- `plans/exploration/movie-organization.md`

Current plans and decisions whose Shot Video Take direction is superseded by
this plan:

- Plans 0032, 0033, 0040, 0042, 0045 through 0049, 0059 through 0065,
  0067 through 0077, 0081, 0085, 0087 through 0100, 0121, 0122, 0138,
  0142, and 0143 where they define Scene Shot Lists, grouped Shots, Shot Video
  Takes, Take-owned media, Take References, or Shot Video Take skills.
- Decisions 0038, 0039, 0049's Take-specific clauses, 0050, and 0051's
  Shot/Take-specific clauses.

Historical completed plans remain unchanged. Current architecture documents and
ADRs must be updated so they do not continue to present the superseded model as
accepted current direction.

Superseding a direction does not authorize editing Plan 0143 or any other
historical completed plan.

The Drizzle workflow was rechecked against the official current documentation:

- [Drizzle Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations)
- [Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)

## Architecture Shape Gate

### Ownership

`packages/core` owns:

- the Scene Beat Sheet contract;
- JSON Schema and AJV validation;
- Beat Sheet history, active state, operations, and semantic validation;
- Beat storyboard ownership and freshness;
- schema and migration;
- storyboard import and asset placement;
- resource projections and resource keys;
- deletion of the retired Shot Video Take domain from public contracts.

`packages/studio/server` remains a thin HTTP adapter:

- read route params;
- call Core Beat Sheet resources;
- add asset URLs;
- translate structured errors.

`packages/studio/src` owns:

- the live Beats review surface;
- the inert Shots placeholder;
- the isolated controlled Shot authoring UI kit;
- no durable Beat/Shot business rules.

`packages/cli` remains a thin adapter over Core Beat Sheet operations.

`studio-skills` owns the renamed agent workflow and creative Beat/storyboard
guidance.

### Intended Core module shape

Create:

```text
packages/core/src/client/
  scene-beat-sheet.ts
  scene-beat-sheet-json-schemas.ts
  shot-authoring.ts

packages/core/src/server/schema/
  scene-beat-sheets.ts

packages/core/src/server/database/access/
  scene-beat-sheets.ts
  scene-beat-storyboard-images.ts

packages/core/src/server/scene-beat-sheet/
  context.ts
  history.ts
  operations.ts
  storyboard-status.ts
  validator.ts

packages/core/src/server/resources/
  scene-beats.ts
  storyboard-overviews.ts
```

Responsibilities:

- `scene-beat-sheets.ts` under `client/` owns public JSON-safe contracts.
- `scene-beat-sheet-json-schemas.ts` owns browser-safe schema objects only.
- `shot-authoring.ts` owns persistence-free reusable Shot editor value types.
- schema `scene-beat-sheets.ts` owns only the three current Beat tables.
- database access `scene-beat-sheets.ts` owns Beat Sheet history/state rows.
- database access `scene-beat-storyboard-images.ts` owns storyboard
  relationship reads/writes and Beat content fingerprints.
- `context.ts` owns the agent-facing Beat Sheet context report.
- `history.ts` owns list/read/write/set-active commands.
- `operations.ts` owns operation application and storyboard carry-forward.
- `storyboard-status.ts` owns missing/stale/ready projection.
- `validator.ts` owns AJV parsing plus project-aware Beat semantics.
- `scene-beats.ts` owns the selected Scene Beats browser resource.
- `storyboard-overviews.ts` owns Act/Sequence storyboard summaries.

The existing 1,042-line command file must disappear. Its responsibilities must
not be moved into one renamed 1,000-line file.

### Intended Studio frontend shape

Live scene files:

```text
packages/studio/src/features/movie-studio/scenes/
  scene-panel.tsx
  scene-beats-tab.tsx
  scene-beats-empty.tsx
  scene-beat-labels.ts
  scene-shots-placeholder-tab.tsx
```

Retained Shot authoring kit:

```text
packages/studio/src/features/movie-studio/shot-authoring/
  shot-composition-tab.tsx
  shot-motion-tab.tsx
  shot-dialogs-tab.tsx
  shot-ai-production-tab.tsx
  shot-ai-production-input-mode-list.tsx
  shot-ai-production-model-table.tsx
  shot-ai-production-run-setup.tsx
  shot-ai-production-projection.ts
  shot-direction-context.tsx
  shot-design-controls.tsx
  shot-design-vocabulary.ts
  shot-video-preview.tsx
  shot-design-assets/
```

The retained module must not have a feature barrel or compatibility wrappers.
Callers in the next plan will import the real implementation files directly.

### Intended adapter shape

CLI:

```text
renku screenplay beat-sheet ...
renku media import --purpose scene.storyboard-sheet \
  --beat-sheet <beat-sheet-id> \
  --beats <beat-id>
```

Studio API:

```text
GET /studio-api/projects/:projectName/screenplay/scenes/:sceneId/beat-sheet
```

Scene URL:

```text
?sceneTab=beats&beat=<beat-id>
?sceneTab=shots
```

No Take or Shot editor HTTP routes remain.

### Files expected to disappear

At minimum:

```text
packages/core/src/client/scene-shot-list.ts
packages/core/src/client/scene-shot-list-json-schemas.ts
packages/core/src/client/shot-video-take-workspace.ts
packages/core/src/server/commands/scene-shot-list-commands.ts
packages/core/src/server/commands/scene-shot-reference-asset-commands.ts
packages/core/src/server/database/access/scene-shot-lists.ts
packages/core/src/server/database/access/scene-shot-reference-assets.ts
packages/core/src/server/database/access/shot-video-take-media.ts
packages/core/src/server/generation/shot-video-takes.ts
packages/core/src/server/generation/purposes/shot-first-frame.ts
packages/core/src/server/generation/purposes/shot-last-frame.ts
packages/core/src/server/generation/purposes/shot-video-prompt.ts
packages/core/src/server/generation/purposes/shot-video-take.ts
packages/core/src/server/generation/reference-slots/take-media.ts
packages/core/src/server/project-asset-files/destinations/shot-video-take.ts
packages/core/src/server/resources/scene-storyboard-ui.ts
packages/core/src/server/scene-shot-list-json/
packages/core/src/server/shot-video-take-workspace/
packages/core/src/server/schema/scene-shot-reference-assets.ts

packages/studio/src/services/studio-shot-video-takes-api.ts
packages/studio/src/features/movie-studio/scenes/scene-takes-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-take-card.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-detail.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-rail.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-rail-row.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-references-tab.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-reference-*.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-cast-reference-card.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-location-reference-row.tsx
packages/studio/src/features/movie-studio/scenes/shot-video-take-selection.ts
packages/studio/src/features/movie-studio/scenes/use-shot-video-take-production.ts
packages/studio/src/features/movie-studio/scenes/use-take-shot-design.ts
packages/studio/src/features/movie-studio/scenes/take-shot-design-context.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-group-strip.tsx
packages/studio/src/features/movie-studio/scenes/scene-shot-ai-production-take-tag.tsx
```

Associated tests, fixtures, Playwright pages, snapshots, routes, parsers, and
docs disappear with them.

### Current files expected to shrink

- `packages/core/src/server/project-data-service-wiring/generation.ts`
- `packages/core/src/server/project-data-service-contracts.ts`
- `packages/core/src/server/generation/purpose-context.ts`
- `packages/core/src/server/generation/purposes.ts`
- `packages/core/src/server/schema/media-generation.ts`
- `packages/core/src/server/schema/index.ts`
- `packages/core/src/server/trash/trash-object-registry.ts`
- `packages/core/src/server/resources/director-context.ts`
- `packages/core/src/server/studio-coordination/current-projection.ts`
- `packages/studio/server/routes/screenplay.ts`
- `packages/studio/server/http/screenplay-responses.ts`
- `packages/studio/server/routes/studio-events.ts`
- `packages/studio/src/app/use-project-session.ts`
- `packages/studio/src/features/movie-studio/movie-studio-selection.ts`
- `packages/studio/src/hooks/use-studio-resource-refresh.ts`
- `packages/cli/src/commands/screenplay-command.ts`
- `packages/cli/src/commands/media-import-command-handlers.ts`
- `packages/cli/src/cli.ts`

### Explicitly forbidden code shape

- Renaming `SceneShotVideoTake` to `Shot`.
- Keeping old tables with new TypeScript names.
- Adding `Beat` aliases for `SceneShot`.
- Naming the Beat entry type `SceneBeat` or its owned id property `beatId`.
- Adding generic summary, subject, action, dialogue coverage, audio-note,
  production-note, or camera fields to the accepted `Beat` contract.
- Moving removed Shot direction into `description` as an untyped catch-all.
- Adding runtime camera-word detection, creative-content scoring, or automatic
  rewriting for Beat descriptions.
- Adding old CLI/URL/JSON compatibility.
- Keeping Continuous/Multi-Cut logic in an unused module “for later.”
- Keeping Shot group selection utilities.
- Keeping Take routes that return empty results.
- Keeping Take export code with a temporary empty fallback.
- Creating a generic arbitrary Shot/Beat state patch command.
- Keeping Shot-specific reference wrappers merely because shared reference
  pickers remain.
- Moving all Beat commands into one new god file.
- Moving Take logic into generic Generation modules.
- Defining the future Shot database contract in this cleanup.
- Creating placeholder Shot rows when **New Shot** is clicked.

### Stop conditions

Stop and revise before implementation continues if:

- a proposed `Shot` table is needed to make this cleanup work;
- the Beat migration would lose storyboard relationships or authored Beat text;
- the retained Shot authoring kit still imports Take services or Take types;
- generic Generation Preview or Image Revision references are being deleted to
  remove the Shot References tab;
- the easiest route is to keep a compatibility alias;
- the new Beat command area is becoming another monolithic command file;
- production export is being kept through empty or guessed behavior;
- the migration cannot distinguish retired Take-owned assets from reusable
  project-owned assets without guessing.

## Public Contracts

### Core public types

Add and use:

- `SceneBeatSheetDocument`
- `Beat`
- `SceneBeatSheetOperationDocument`
- `SceneBeatSheetOperation`
- `SceneBeatSheetSummary`
- `SceneBeatSheetContextReport`
- `SceneBeatSheetListReport`
- `SceneBeatSheetReadReport`
- `SceneBeatSheetValidationReport`
- `SceneBeatSheetWriteReport`
- `SceneBeatSheetApplyReport`
- `SceneBeatSheetStoryboardStatus`
- `SceneBeatSheetResource`
- `ActStoryboardBeat`
- Beat-based sequence storyboard preview contracts

Retain as persistence-free Shot editor values:

- `ShotDirectionDraft`
- `ShotComposition`
- `ShotMotion`
- `ShotDialogueChoice`
- `ShotGenerationInputModeId`
- `ShotGenerationParameterValue`
- `ShotGenerationParameterValues`
- `ShotGenerationPromptDraft`
- `ShotGenerationParameterReport`
- `ShotGenerationModelReport`
- `ShotGenerationSetup`
- `selectShotGenerationModel`

Remove:

- `SceneShot`
- every `SceneShotList*` public type;
- every `SceneShotVideoTake*` public type;
- every `ShotVideoTake*` public type;
- structure/group types;
- Take reference workspace types;
- `ShotVideoTakeSummary`.

### ProjectDataService

Rename the Beat Sheet operations directly:

```text
readSceneBeatSheetContext
listSceneBeatSheets
readSceneBeatSheet
validateSceneBeatSheet
writeSceneBeatSheet
setActiveSceneBeatSheet
validateSceneBeatSheetOperations
applySceneBeatSheetOperations
readSceneBeatSheetStoryboardStatus
readSceneBeatSheetResource
attachSceneStoryboardImages
```

`attachSceneStoryboardImages` remains because the media operation name is still
correct. Its input uses `beatSheetId` and Beat import entries.

Remove every Shot Video Take and Shot generic-reference method from the service.

### Generation

Remove current purpose keys:

```text
shot.first-frame
shot.last-frame
shot.video-prompt
shot.video-take
```

Remove target kind:

```text
sceneShotVideoTake
```

Keep generic video models discoverable through the Engines-backed model catalog.
The future Shot design will add focused purposes only after the new Shot target
and ownership contract are accepted.

Remove the Take-specific uniqueness indexes from `media_generation_spec` and
`media_generation_run`.

### CLI

Current commands become:

```bash
renku screenplay beat-sheet context --scene <scene-id> --json
renku screenplay beat-sheet list --scene <scene-id> --json
renku screenplay beat-sheet show --active --scene <scene-id> --json
renku screenplay beat-sheet validate --file <beat-sheet.json> --json
renku screenplay beat-sheet validate-operations --file <operations.json> --json
renku screenplay beat-sheet apply --file <operations.json> --dry-run --json
renku screenplay beat-sheet apply --file <operations.json> --json
renku screenplay beat-sheet storyboard status \
  --scene <scene-id> \
  --beat-sheet <beat-sheet-id> \
  --json
renku screenplay beat-sheet write --file <beat-sheet.json> --json
renku screenplay beat-sheet set-active \
  --scene <scene-id> \
  --beat-sheet <beat-sheet-id> \
  --json
```

Storyboard import becomes:

```bash
renku media import \
  --purpose scene.storyboard-sheet \
  --target scene:<scene-id> \
  --beat-sheet <beat-sheet-id> \
  --beats <beat-id> \
  --source <project-relative-image> \
  --json
```

Remove Shot Video Take purpose routing and Shot Video Take target parsing.

Keep `--take` only where it means a current Scene Dialogue Audio Take. Update
the help text so it does not mention Shot Video Takes.

### Studio route and selection contract

Use:

```ts
type ScenePanelTab = 'narrative' | 'beats' | 'shots';

type StudioSelection =
  | /* existing non-scene selections */
  | {
      type: 'scene';
      id: string;
      sceneTab?: ScenePanelTab;
      beatId?: string;
    };
```

Remove:

- `shotId` from the current Scene selection;
- `takeWorkspaceMode`;
- `takeId`;
- `shotTab`;
- `SceneTakeWorkspaceMode`;
- `SceneShotDetailTab`.

The live route parser and Studio coordination event contract accept only the
new selection shape. They do not recognize old fields as deprecated input.

### Resource keys

Use:

```text
scene-beat-sheet
scene-beat-sheet:<beat-sheet-id>
scene-beat-sheet:<beat-sheet-id>:beat:<beat-id>
surface:scene:<scene-id>:beats
surface:scene:<scene-id>:shots
```

The Shots surface key is valid even though the current surface is static. It
must not subscribe to a fake Shot resource.

### Database schema

The current schema after this pass contains:

```text
scene_beat_sheet
scene_beat_sheet_state
scene_beat_storyboard_image
```

`scene_beat_sheet` columns:

```text
id
scene_id
title
document
created_at
updated_at
```

`scene_beat_sheet_state` columns:

```text
scene_id
active_beat_sheet_id
created_at
updated_at
```

`scene_beat_storyboard_image` columns:

```text
id
scene_id
beat_sheet_id
beat_id
asset_id
asset_file_id
source_purpose
beat_content_fingerprint
created_at
updated_at
discarded_at
discard_operation_id
restored_at
```

Remove:

```text
scene_shot_list
scene_shot_list_state
scene_shot_storyboard_image
scene_shot_reference_asset
scene_shot_video_take
scene_shot_video_take_shot
scene_shot_video_take_image
scene_shot_video_take_video
```

No new `shot`, `scene_shot`, `shot_group`, or `take` table is added.

## Migration And Data Cleanup Contract

### Migration identity

The expected migration is:

```text
0059_scene_beats_and_shot_authoring_reset.sql
```

The expected breaking project-store schema generation is:

```text
46
```

Finalize the TypeScript Drizzle schema first, then run from `packages/core`:

```bash
pnpm drizzle-kit generate \
  --config drizzle.config.ts \
  --name scene_beats_and_shot_authoring_reset
```

The generated snapshot and journal entry must remain paired with the SQL.

This migration needs a documented custom SQL preservation section because the
schema diff alone cannot:

- transform Beat Sheet JSON keys and remove camera fields;
- transform nested Beat ids;
- rewrite active Beat Sheet ids;
- recompute Beat content fingerprints;
- delete retired Take generation and asset records in safe dependency order.

The custom section remains inside the Drizzle migration flow. Do not add a
TypeScript migration registry or migration-at-read code.

### Beat history transformation

For every current Scene Shot List:

- preserve `scene_id`, title, summary, lookbook influence, open questions,
  timestamps, and history order;
- change the row id prefix from `scene_shot_list_` to `scene_beat_sheet_`;
- change `kind` from `sceneShotList` to `sceneBeatSheet`;
- change `coverageStrategy` to `narrativeProgression`;
- change `baseShotListId` to `baseBeatSheetId` and rewrite its id prefix;
- change `shots[]` to `beats[]`;
- change each entry property from `shotId` to `id`;
- change each entry id prefix from `shot_` to `beat_`;
- change `storyBeat` to `narrativeDevelopment`;
- change `coveredBlockIndexes` to `screenplayBlockIndexes`;
- preserve every retained field value byte-for-byte as JSON values;
- omit `subject`, `action`, `dialogue`, `audioNotes`, and `productionNotes`;
- omit the six retired structured camera fields.

For state rows:

- copy `scene_id`;
- rewrite `active_shot_list_id` to `active_beat_sheet_id`;
- preserve timestamps.

For storyboard relationships:

- change relationship ids from `scene_shot_storyboard_image_*` to
  `scene_beat_storyboard_image_*`;
- rewrite Beat Sheet ids and Beat ids;
- preserve asset ids, asset file ids, source purpose, lifecycle state, and
  timestamps;
- recompute `beat_content_fingerprint` from the new retained Beat contract.

Migration tests must prove that unchanged storyboard images are still `ready`
after migration rather than becoming falsely stale.

### Existing storyboard file paths

Do not rewrite existing `asset_file.project_relative_path` values merely because
older storyboard files use `shot-*` filenames.

Those paths are opaque registered content pointers:

- runtime code does not parse them for ownership;
- UI copy does not display them;
- rewriting every project file path would require a separate transactional
  filesystem migration that is not justified by this cleanup.

All **new** storyboard imports use Beat naming in destination code, for example:

```text
storyboards/<sequence>/<scene>/<iteration>/beat-01.png
```

This is not a compatibility layer. No current behavior branches on the old file
name.

### Retired Take database cleanup

Before dropping Take tables, the migration must identify and remove:

- all Generation Specs and Runs whose target is `sceneShotVideoTake`;
- all Generation Specs and Runs with the four retired Shot purpose keys;
- all `asset_file_generation` rows owned only by those deleted runs;
- all `sceneShotVideoTake` and `sceneShotReferenceAsset` Trash Items;
- all Shot Video Take image/video/reference relationship rows;
- all assets and files with retired types `shot.input`,
  `shot.video-prompt-sheet`, and `shot.video-take` when they have no
  non-retired owner;
- all Take and Shot reference rows;
- all Take-specific media-generation indexes.

If a retired-type asset has a non-retired active owner, migration must fail on
the copy before real-project application. It must not guess whether to preserve
or delete the asset.

### Real sample filesystem cleanup

Database migration does not delete arbitrary filesystem content.

For `urban-basilica`, after the migrated copy and real migrated database both
pass verification:

1. capture an exact manifest of files under the retired top-level `shots/`
   directory;
2. confirm no post-migration asset file references any manifest path;
3. retain the verified pre-migration database backup;
4. request the explicit destructive filesystem confirmation required by
   `AGENTS.md`;
5. delete the retired `shots/` tree and its `.DS_Store` files;
6. verify no current asset file path is missing;
7. leave the `storyboards/` tree intact.

Do not add a permanent cleanup command for the obsolete Take model.

## Production Export Consequence

The current Production Export implementation is entirely driven by picked Shot
Video Takes and their exact dialogue references.

Once the Take aggregate is removed, that export contract has no valid current
source.

This cleanup therefore removes:

- the current Core production-export service and Take-specific media query;
- the CLI production export command;
- the Studio server production-export route;
- the Studio sidebar export action;
- current take-driven export docs and tests.

Do not keep the feature through an empty export, a dialogue-only guess, or an
implicit fallback.

The next Shot/output design must reintroduce export only after it defines:

- what a completed Shot output is;
- how one output is selected;
- how Beat/Shot order becomes production order;
- how dialogue audio is attached to that output.

## Implementation Slices

### Slice 1: Record the accepted separation decision

Add ADR:

```text
docs/decisions/0052-separate-scene-beats-from-shot-authoring.md
```

The ADR must record:

- Beat vs Shot ownership;
- Scene Beat Sheet as the renamed current document;
- Beat storyboard ownership;
- deletion rather than rename of Shot Video Takes;
- no current durable Shot model;
- inert Shots tab;
- retained persistence-free Shot authoring kit;
- removal of Shot References;
- continued existence of shared generation references and Dialogue Audio Takes;
- temporary removal of take-driven production export.

Mark conflicting accepted ADRs superseded where appropriate. Do not rewrite
historical plans.

### Slice 2: Extract the reusable Shot authoring kit

Do this before deleting Take code so useful UI is not lost.

Core:

- move camera and lens vocabularies out of the Beat contract into
  `client/shot-authoring.ts`;
- rename Take-specific editor types to persistence-free Shot editor types;
- remove structure/group/reference workspace types;
- retain only composition, motion, dialogue, AI setup/model, and prompt draft
  values required by the preserved UI.

Studio:

- move Composition, Motion, Dialogs, AI Production, preview video, design
  controls, vocabulary, and generated design assets into
  `features/movie-studio/shot-authoring/`;
- replace `TakeShotDesignProvider` with a controlled
  `ShotDirectionProvider`;
- make the Dialogs surface consume explicit Scene Dialogue Audio and controlled
  Shot dialogue values rather than a Take reference workspace;
- make AI Production consume explicit model/setup/estimate/prompt props rather
  than a Take service hook;
- remove multi-shot badges, group strips, Take tags, create-Take actions, and
  Continuous/Multi-Cut state;
- keep Shadcn controls and current desktop visual design.

Tests:

- preserve component behavior tests for Composition and Motion values;
- preserve Dialogs rendering and audio-take selection presentation tests;
- preserve AI model/input/parameter projection tests;
- preserve video preview rendering tests;
- prove the retained module imports no Take API or Take type.

### Slice 3: Introduce the Beat Sheet Core contract

- add `SceneBeatSheetDocument`, `Beat`, operations, reports, and schemas;
- add the three Beat tables to the Drizzle schema;
- add new entity id prefixes:
  - `scene_beat_sheet`;
  - `scene_beat_storyboard_image`;
- split database access between Beat Sheet history and storyboard images;
- split context, history, operations, status, and validation into the module
  shape defined above;
- update storyboard content fingerprinting to the retained Beat fields only;
- preserve structured diagnostics with Beat terminology;
- update ProjectDataService wiring directly.

Delete the old Shot List modules in the same slice. Do not leave re-export
stubs.

### Slice 4: Update storyboard import and overview resources

- update `scene.storyboard-sheet` Scene facts to read active Beat Sheets;
- update storyboard import JSON and CLI parsing to Beat ids;
- rename project asset destination inputs and new filenames to Beat terminology;
- update Scene, Sequence, and Act storyboard resources to return Beats;
- update browser response adapters and asset URLs;
- update resource keys and refresh matching;
- preserve all current storyboard generation, visual inspection, slicing, and
  import behavior.

No runtime code may inspect storyboard image contents.

### Slice 5: Replace the live Scene tabs

- change `ScenePanelTab` to `narrative | beats | shots`;
- rename and simplify the current grid/detail review surface to
  `SceneBeatsTab`;
- preserve selected-card behavior, image cards, right-side Beat details, and
  current responsive desktop grid;
- change visible labels to Beat terminology;
- show only Description, Narrative Development, Narrative Purpose, Cast, and
  Locations in the Beat detail panel;
- remove Subject, Action, and Dialogue Coverage from the Beat detail panel;
- change route state to `sceneTab=beats&beat=<beat-id>`;
- add `SceneShotsPlaceholderTab`;
- render only the **New Shot** add card/button in the Shots tab;
- assert that clicking it causes no API call, mutation, route change, dialog, or
  toast;
- remove Take edit/list routing and all Take URL state.

Use local Shadcn controls only. Do not add explanatory filler copy to the empty
Shots surface.

### Slice 6: Remove Shot Video Take and Shot References

Core:

- remove Take tables, contracts, workspaces, generation purposes, target kind,
  media destinations, trash definitions, discard/restore handling, director
  readiness, focus projection, and current selection context;
- remove `scene_shot_reference_asset` and its catalog/ownership/trash behavior;
- remove Take-specific Image Revision branches while preserving generic Image
  Revision;
- remove Take-specific generation reference projections while preserving
  generic Generation Preview references;
- remove Take-specific indexes from media generation schema;
- remove Shot Video Take output attachment/import behavior.

Studio server:

- remove Take routes and request parsers;
- remove Take response projections;
- remove Shot reference mutation endpoints;
- keep the shared `/generation-references` route.

Studio browser:

- delete Take service, Takes cards/editor, Shot rail/group selection,
  References tab and wrappers, Take hooks, and Take tests;
- keep the shared reference picker and Generation Preview reference grid.

CLI:

- remove Shot Video Take purpose/target/attachment routing;
- remove obsolete Shot group and Take help text;
- preserve Dialogue Audio Take flags and commands.

### Slice 7: Remove take-driven production export

- delete current export Core modules, public contracts, server route, CLI
  command, Studio service/action, tests, and docs;
- remove the sidebar action rather than disabling it;
- remove export-specific architecture statements that say picked Shot Video
  Takes are the production source;
- retain no empty fallback.

### Slice 8: Generate and verify migration 0059

- finalize schema before generation;
- generate migration and snapshot with Drizzle Kit;
- add the documented custom SQL preservation/deletion section;
- set `PRAGMA user_version = 46`;
- add a focused migration fixture starting from generation 45/0058 shape;
- prove Beat counts, active ids, base ids, storyboards, lifecycle values, and
  fingerprints survive;
- prove Take tables, specs, runs, assets, trash items, and indexes are gone;
- prove shared Cast/Location/Lookbook/Storyboard assets survive;
- run `foreign_key_check` and `quick_check`.

Delete current runtime migration helpers and tests whose sole purpose is to
recognize or repair retired Shot Video Take shapes. Keep ordered historical SQL
migrations unchanged except for the new forward migration.

### Slice 9: Update Studio Skills

Work in:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills
```

Rename:

```text
skills/scene-shot-designer/
  -> skills/scene-beat-designer/
```

Use:

```text
name: scene-beat-designer
description: Design and persist Renku Studio Scene Beat Sheets...
```

Rename reference and sample files:

```text
scene-beat-sheet-json-contract.md
beat-sheet-cli-workflow.md
beat-design-guidelines.md
scene-beat-sheet.json
scene-beat-sheet-operations.json
```

Update:

- Beat Sheet contract guidance to use `Beat` with exactly `id`, `title`,
  `description`, `narrativeDevelopment`, `narrativePurpose`,
  `castMemberIds`, `locationIds`, and `screenplayBlockIndexes`;
- Beat design guidance to define `description` as visual setting, meaningful
  placement, spatial relationships, important elements, and atmosphere without
  camera or Shot execution;
- Beat design guidance to distinguish narrative development from narrative
  purpose;
- Beat examples to use actual Cast Member and Location ids;
- remove subject, action, dialogue coverage, audio notes, production notes, and
  camera fields from Beat examples and instructions;
- Media Producer `scene.storyboard-sheet` guidance to use Beat Sheets and Beats;
- Movie Director department map, production order, readiness, and handoffs;
- Casting and Production Design handoffs that currently say Shot List;
- README examples and installed skill names;
- all CLI examples and JSON examples;
- Storyboard Sheet guidance so its panels illustrate Beats without claiming
  that each Beat is a camera Shot.

Remove active Shot Video Take skill routing:

```text
skills/media-producer/references/shot-video-take/
skills/media-producer/samples/shot-video-take/
skills/media-producer/evals/shot-video-take/
```

Do not rename those workflows to the future Shot model. The next Shot design
must author new skill guidance from the accepted new contract.

Do not edit the installed Codex plugin cache directly. Refresh/reinstall the
plugin from the sister repository through its documented plugin workflow after
source validation.

### Slice 10: Clean and verify `urban-basilica`

On a database copy first:

- record the observed baseline counts above;
- apply migration 0059;
- validate exact Beat Sheet and storyboard preservation;
- validate complete Take data removal;
- open the project through CLI and Studio;
- verify all four active Beat Sheets and current storyboard cards.

Then perform a separate agent-led content cleanup against the migrated copy:

- inspect every Beat in the four active Beat Sheets;
- rewrite descriptions that still prescribe Shot size, lens, framing, camera
  movement, cuts, coverage, or production execution;
- preserve the Beat's visual setting, meaningful placements, spatial
  relationships, important elements, atmosphere, and narrative meaning;
- preserve `narrativeDevelopment`, `narrativePurpose`, Cast Member ids,
  Location ids, and screenplay block relationships unless the source data is
  factually wrong;
- write cleaned content through the new Core-owned Beat Sheet command rather
  than patching database JSON directly;
- create and activate a new Beat Sheet history revision for each active sheet
  that changes;
- visually inspect each existing storyboard image against its cleaned Beat;
- explicitly reattach the existing storyboard asset to the cleaned Beat when
  it remains suitable;
- leave an image missing for agent regeneration when the existing image no
  longer represents the cleaned Beat;
- review the complete cleaned Beat JSON and Studio detail projection before
  applying the same documents to the real project.

This cleanup is agent-owned creative review. Studio runtime, schemas,
validators, migrations, and UI code must not search descriptions for camera
words, score their quality, or rewrite their content.

On the real project:

- stop Studio processes that hold the database;
- run the package-owned migration command, which creates a verified backup;
- inspect the migration report and backup metadata;
- repeat all SQL checks;
- apply the reviewed Beat Sheet cleanup documents through Core commands;
- verify Studio Beats visually;
- build and review the retired `shots/` file manifest;
- obtain explicit filesystem deletion confirmation;
- delete the retired `shots/` tree;
- verify every remaining registered asset file exists.

## Tests And Guardrails

### Beat contract tests

- AJV accepts the current Beat Sheet shape.
- Unknown fields are rejected.
- `Beat.id`, `title`, `description`, `narrativeDevelopment`,
  `narrativePurpose`, `castMemberIds`, `locationIds`, and
  `screenplayBlockIndexes` are required.
- retired camera, subject, action, dialogue, audio-note, and production-note
  fields are rejected as unknown Beat fields.
- Beat `id` values are unique.
- Beat operation ids must exist in the explicit base Beat Sheet.
- screenplay block, Cast Member, and Location references retain current
  semantic validation.
- validation reports use Beat terminology and structured codes.
- write/list/read/set-active preserve history.
- operation apply preserves unchanged storyboard images.
- changed Beat content marks an image stale.
- removal of retired fields during structural migration does not mark preserved
  images stale.

### Storyboard tests

- import accepts `beatSheetId` and `beats[]`.
- import rejects duplicate Beat ids and duplicate sources.
- imported Beat ids must belong to the exact Beat Sheet.
- new destination filenames use `beat-*`.
- Scene, Sequence, and Act storyboard resources return Beat labels and ids.
- image assets, asset files, and relationships remain exact and current.

### UI and route tests

- Scene tabs render `Narrative`, `Beats`, and `Shots`.
- Beats tab preserves the current card grid and detail panel.
- Beat details show Description, Narrative Development, Narrative Purpose,
  Cast, and Locations.
- Beat details do not show Subject, Action, or Dialogue Coverage.
- Beat selection writes `sceneTab=beats&beat=<id>`.
- Shots tab renders **New Shot** only.
- clicking **New Shot** performs no request or navigation.
- no Takes Edit mode exists.
- no References tab exists.
- no group count, selection rail, Continuous Move, or Multi-Cut control exists.
- desktop screenshots cover Beats and the Shots placeholder.
- obsolete Take compatibility snapshots and Playwright pages are deleted.

### Preserved Shot authoring kit tests

- Composition controls update a controlled `ShotDirectionDraft`.
- Motion controls update the same controlled draft.
- Dialogs render current Scene dialogue/audio candidates through explicit props.
- AI Production input modes, models, parameters, prompt, and estimate render
  through explicit props.
- video preview accepts a nullable video source.
- the kit performs no fetch and imports no Take service.
- the kit contains no group-mode behavior.

### Shared generation regression tests

- Generation Preview reference editing still works.
- Image Revision reference editing still works.
- the shared reference picker still supports media-generic search.
- Cast, Location, Lookbook, Scene Storyboard, and Dialogue Audio generation
  purposes still validate, preview, estimate, run, and attach.
- Engines video model descriptors remain discoverable without a current Shot
  purpose.

### Migration tests

The focused generation-45 fixture must prove:

- 8 current history rows become 8 Beat Sheets;
- 69 current JSON entries become 69 Beats;
- 4 active state rows survive with rewritten ids;
- 35 storyboard relationship rows survive;
- 20 unique storyboard assets/files survive;
- base Beat Sheet links are rewritten;
- Beat ids are rewritten;
- `storyBeat` values survive under `narrativeDevelopment`;
- `coveredBlockIndexes` values survive under `screenplayBlockIndexes`;
- `description`, `narrativeDevelopment`, `narrativePurpose`, Cast Member ids,
  and Location ids retain their exact structural-migration values;
- subject, action, dialogue, audio-note, production-note, and camera fields are
  absent from every migrated Beat;
- all 30 Take rows and 35 Take membership rows disappear;
- all 13 Take specs and 4 Take runs disappear;
- all retired Shot asset types disappear when exclusively owned;
- all 25 Take Trash Items disappear;
- no retired table or Take-specific index exists;
- no shared reference or storyboard asset is deleted;
- `PRAGMA foreign_key_check` returns no rows;
- `PRAGMA quick_check` returns `ok`;
- `PRAGMA user_version` is `46`.

Migration tests may name the retired schema because one-way migration
verification is the explicit exception. Current runtime and current-contract
tests must not preserve obsolete names as recognized concepts.

### Architecture guardrails

Prefer stable boundary checks:

- `packages/studio/src` still cannot import `@gorenku/studio-core/server`;
- the retained Shot authoring module cannot import browser services;
- the generic reference picker remains feature-shared and does not import Scene
  Shot code;
- Studio server Beat routes call Core and do not inspect Beat ownership;
- CLI Beat handlers call ProjectDataService and do not parse domain rules;
- package `index.ts` files remain thin public entrypoints.

Do not add source-text tests that freeze private function names or enumerate all
allowed commands.

Use manual final scans, not compatibility tests, to confirm current production
code no longer contains:

```text
SceneShotList
scene_shot_list
SceneShotVideoTake
scene_shot_video_take
scene_shot_reference_asset
shot.video-take
shot.video-prompt
multi-cut
Continuous Move
sceneTab=takes
takeMode
shotTab
```

Historical SQL migrations, superseded ADRs, and historical plans are excluded
from that scan.

## Documentation

Add:

- `docs/decisions/0052-separate-scene-beats-from-shot-authoring.md`

Update:

- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/reference/media-generation.md`
- `docs/architecture/media-generation.md`
- `docs/architecture/project-asset-storage-conventions.md`
- `docs/architecture/reference/studio-skills.md`
- `docs/architecture/studio-coordination-events.md`
- `docs/architecture/reference/studio-coordination-events.md`
- `docs/cli/commands.md`
- current product/workflow docs that present Scene Shot Lists or Shot Video
  Takes as current implemented architecture;
- `packages/website/src/data/site.ts` and current website screenshots so the
  website does not advertise the retired Takes UI.

Delete or replace as current architecture:

- `docs/architecture/shot-video-take-owned-media.md`
- `docs/architecture/shot-video-take-structure-modes.md`
- Take-specific sections in generation preview/reference docs;
- current production export docs whose source is picked Shot Video Takes.

Keep:

- historical completed plans;
- superseded ADR history with explicit superseded status;
- generic AI artifact opacity guidance;
- generic generation reference and Preview guidance;
- Scene Dialogue Audio Take documentation.

## Final Verification

### Focused commands

```bash
pnpm build:core
pnpm test:core
pnpm test:cli
pnpm test:studio
pnpm --filter @gorenku/studio test:integration
pnpm test:e2e:studio:smoke
```

### Root commands

```bash
pnpm check
pnpm build
pnpm test
pnpm test:integration
```

### Database checks

On both the copied and real `urban-basilica` database:

```sql
PRAGMA user_version;
PRAGMA foreign_key_check;
PRAGMA quick_check;
```

Inspect:

- current tables and indexes;
- structural-migration Beat Sheet/history/storyboard counts before the
  agent-led content revisions;
- final Beat Sheet history counts after the reviewed content revisions;
- active Beat Sheet ids;
- Beat JSON for every history row and all four final active Beat Sheets;
- exact `Beat` field shape and absence of retired fields;
- storyboard asset/file existence;
- absence of retired Take specs, runs, assets, trash items, and tables.

### Desktop verification

- Open Bombardment.
- Confirm tabs are Narrative, Beats, Shots.
- Confirm Beats shows the current storyboard grid and detail copy.
- Confirm existing Beat images load.
- Confirm selecting a Beat updates the Beat query parameter and detail panel.
- Confirm the detail panel shows Description, Narrative Development, Narrative
  Purpose, Cast, and Locations only.
- Confirm cleaned descriptions describe Beat visual situations without
  carrying the current Shot framing and camera instructions.
- Confirm Shots shows only New Shot.
- Confirm New Shot has no effect.
- Confirm there is no route into the former Takes editor.
- Confirm no References tab or grouping controls remain.
- Confirm Generation Preview and Image Revision reference pickers still work on
  a non-Shot purpose.
- Confirm Scene Dialogue Audio Takes still work.

### Architecture-shape review

- inspect `git diff --stat` in Studio and Studio Skills;
- inspect the complete diff;
- inspect every newly large or heavily modified file;
- confirm the old 1,042-line command module was split rather than renamed;
- confirm `scene-beat-sheet` modules match the Architecture Shape Gate;
- confirm the retained Shot authoring kit is controlled and service-free;
- confirm the Takes removal did not push Take rules into generic Generation;
- confirm the shared reference picker remains independent;
- confirm `index.ts` files remain thin;
- confirm there are no compatibility aliases, re-export stubs, empty Take
  routes, fallback fields, or obsolete-schema runtime recognizers;
- confirm no checklist item was satisfied by accepting unreviewable code
  structure.

## Completion Checklist

### Review Area

- [x] Confirm Beats and Shots are separate product concepts.
- [x] Confirm the current Scene Shot List became a Scene Beat Sheet rather than
      receiving only visible copy changes.
- [x] Confirm the legacy Shot Video Take aggregate was deleted rather than
      renamed.
- [x] Confirm the new Shots tab is intentionally inert and persists nothing.
- [x] Confirm the implementation preserves accepted architecture boundaries.
- [x] Confirm centralized Core ownership did not become a monolithic
      implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.

### Architecture And Contracts

- [x] Add ADR 0052 with the accepted Beat/Shot separation.
- [x] Update conflicting ADR statuses.
- [x] Add the deliberate Scene Beat Sheet public contract.
- [x] Add the deliberate persistence-free Shot authoring value contract.
- [x] Remove all Scene Shot List public contracts.
- [x] Remove all Shot Video Take public contracts.
- [x] Remove structure/group contracts.
- [x] Remove Shot-specific reference workspace contracts.
- [x] Remove current Shot generation purposes and target kind.
- [x] Remove take-driven production export contracts.
- [x] Keep Scene Dialogue Audio Take contracts.
- [x] Keep generic Generation Preview and Image Revision reference contracts.
- [x] Keep package-boundary diagnostics structured.
- [x] Add no aliases, shims, fallbacks, dual fields, or old route readers.

### Beat Sheet Core

- [x] Add `scene-beat-sheet.ts`.
- [x] Add the canonical `Beat` interface with `id`, `title`, `description`,
      `narrativeDevelopment`, `narrativePurpose`, `castMemberIds`,
      `locationIds`, and `screenplayBlockIndexes`.
- [x] Do not add `SceneBeat` or a redundant `beatId` property.
- [x] Remove Subject, Action, Dialogue Coverage, Audio Notes, Production Notes,
      and structured camera fields from Beat persistence.
- [x] Add Beat Sheet JSON Schemas.
- [x] Add Beat Sheet AJV and semantic validation.
- [x] Add `scene_beat_sheet`.
- [x] Add `scene_beat_sheet_state`.
- [x] Add `scene_beat_storyboard_image`.
- [x] Split Beat Sheet history and storyboard database access.
- [x] Split context, history, operations, storyboard status, and validation.
- [x] Update ProjectDataService methods.
- [x] Update entity id prefixes.
- [x] Update resource keys.
- [x] Update Scene/Sequence/Act storyboard resources.
- [x] Update storyboard import to Beat ids.
- [x] Update new storyboard filenames to Beat naming.
- [x] Delete old Shot List files without re-export stubs.

### Preserved Shot Authoring Kit

- [x] Move camera/lens vocabularies out of Beat contracts.
- [x] Add persistence-free `ShotDirectionDraft`.
- [x] Preserve Composition UI.
- [x] Preserve Motion UI.
- [x] Preserve Dialogs UI and Scene Dialogue Audio presentation.
- [x] Preserve AI Production input/model/run-setup UI.
- [x] Preserve the optional video preview component.
- [x] Move Shot design assets with their owning feature.
- [x] Remove all Take service calls from the retained kit.
- [x] Remove all Beat membership assumptions from the retained kit.
- [x] Remove group counts, group strips, Take tags, and structure controls.
- [x] Keep Shadcn controls only.

### Studio UI And Routing

- [x] Change Scene tabs to Narrative, Beats, Shots.
- [x] Preserve the current Beat card grid.
- [x] Preserve the current Beat detail panel.
- [x] Show Description, Narrative Development, Narrative Purpose, Cast, and
      Locations in the Beat detail panel.
- [x] Remove Subject, Action, and Dialogue Coverage from the Beat detail panel.
- [x] Use Beat labels and Beat route state.
- [x] Add the inert New Shot add card.
- [x] Prove New Shot causes no action.
- [x] Remove Takes list/edit modes.
- [x] Remove Take URL state.
- [x] Remove Shot rail/group selection UI.
- [x] Remove the References tab.
- [x] Remove obsolete Take Playwright pages and snapshots.
- [x] Add desktop Beats and Shots placeholder coverage.

### Shot Video Take And References Removal

- [x] Delete Take schema tables.
- [x] Delete Shot reference schema table.
- [x] Delete Take workspace modules.
- [x] Delete Take generation purpose modules.
- [x] Delete Take project asset destination.
- [x] Delete Take trash ownership.
- [x] Delete Take output attachment.
- [x] Delete Take server routes and request parsers.
- [x] Delete Take browser service and hooks.
- [x] Delete Shot-specific reference UI wrappers.
- [x] Delete Shot-specific reference commands and projections.
- [x] Keep the shared generation reference picker/API.
- [x] Keep generic Generation Preview reference editing.
- [x] Keep generic Image Revision reference editing.
- [x] Remove take-driven production export end to end.

### CLI And Agent Surfaces

- [x] Add `renku screenplay beat-sheet`.
- [x] Add `--beat-sheet`.
- [x] Add `--beats`.
- [x] Update storyboard import documents and reports.
- [x] Remove Shot Video Take purpose/target parsing.
- [x] Keep `--take` only for current non-Shot domains.
- [x] Rename `scene-shot-designer` to `scene-beat-designer`.
- [x] Update Beat Sheet skill contracts and samples.
- [x] Update Media Producer storyboard guidance.
- [x] Update Movie Director routing and readiness.
- [x] Remove active Shot Video Take skill references, samples, and evals.
- [x] Refresh the installed plugin from source rather than editing its cache.

### Migration And Real Data

- [x] Confirm the committed Plan 0143 result is the implementation baseline.
- [x] Treat generation 45/0058 as the migration baseline.
- [x] Leave Plan 0143 and migration 0058 unchanged.
- [x] Finalize the TypeScript schema before generating migration 0059.
- [x] Generate SQL and snapshot with Drizzle Kit.
- [x] Add the documented custom data transformation.
- [x] Set schema generation 46.
- [x] Preserve all eight Beat Sheet history rows.
- [x] Preserve all 69 Beat entries.
- [x] Preserve all four active Beat Sheet state rows.
- [x] Preserve all 35 storyboard relationship rows.
- [x] Preserve all 20 unique storyboard assets/files.
- [x] Recompute Beat content fingerprints.
- [x] Review every Beat in the four active sample-project Beat Sheets.
- [x] Rewrite Shot-focused Beat descriptions through Core-owned Beat Sheet
      commands.
- [x] Preserve visual setting, placements, relationships, important elements,
      atmosphere, and narrative meaning in the cleaned descriptions.
- [x] Create and activate cleaned Beat Sheet revisions.
- [x] Visually review and explicitly reattach suitable existing storyboard
      images to cleaned Beats.
- [x] Leave unsuitable storyboard images missing for later regeneration.
- [x] Add no runtime camera-word detection, content scoring, or creative
      rewriting.
- [x] Remove all Take rows and membership rows.
- [x] Remove Take specs and runs.
- [x] Remove exclusively retired Shot assets/files.
- [x] Remove Take Trash Items.
- [x] Remove all retired schema objects and indexes.
- [x] Fail rather than guess when a retired asset has a non-retired owner.
- [x] Validate a database copy before the real project.
- [x] Create and verify a real-project pre-migration backup.
- [x] Run foreign-key and integrity checks.
- [x] Build and review the retired `shots/` filesystem manifest.
- [x] Obtain explicit confirmation before deleting the real `shots/` tree.
- [x] Hand deletion of the confirmed retired real-project `shots/` tree to the
      user, who explicitly chose to perform it themselves.
- [x] Verify every remaining registered asset file exists.

### Tests And Guardrails

- [x] Add Beat JSON/schema/semantic tests.
- [x] Add Beat operation/history tests.
- [x] Add storyboard freshness/carry-forward tests.
- [x] Add storyboard import tests using Beat ids.
- [x] Add migration generation-45 fixture coverage.
- [x] Add Beats UI and route tests.
- [x] Add inert New Shot tests.
- [x] Preserve controlled Shot authoring kit tests.
- [x] Preserve shared Generation Preview reference tests.
- [x] Preserve Image Revision reference tests.
- [x] Preserve Scene Dialogue Audio Take tests.
- [x] Remove obsolete Take/group/reference tests.
- [x] Add/update stable import-boundary guardrails.
- [x] Do not encode private helper names or implementation inventories in
      architecture tests.
- [x] Run the shape-review checks listed in Final Verification.

### Documentation

- [x] Update current data-model and vocabulary docs.
- [x] Update current generation and storyboard docs.
- [x] Update current Studio coordination docs.
- [x] Update CLI docs.
- [x] Remove current Shot Video Take architecture docs.
- [x] Remove current take-driven production export docs.
- [x] Update website copy/screenshots.
- [x] Keep historical plans unchanged.
- [x] Mark conflicting ADRs superseded rather than deleting decision history.

### Final Verification

- [x] Run focused Core, CLI, Studio, integration, and smoke E2E tests.
- [x] Run `pnpm check`.
- [x] Run `pnpm build`.
- [x] Run `pnpm test`.
- [x] Run `pnpm test:integration`.
- [x] Complete desktop verification with `urban-basilica`.
- [x] Review `git diff --stat` and complete diffs in both repositories.
- [x] Inspect every large or heavily modified file.
- [x] Confirm touched `index.ts` files remain thin entrypoints.
- [x] Confirm the Beat module is not monolithic.
- [x] Confirm the preserved Shot authoring kit has no Take/service coupling.
- [x] Confirm no old Take route, table, contract, reference tab, group mode, or
      production-export fallback remains.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code
      structure.
- [x] Only then mark the plan complete.
