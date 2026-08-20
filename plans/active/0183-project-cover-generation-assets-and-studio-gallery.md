# 0183 Project Cover Generation, Assets, And Studio Gallery

Status: implementation complete; rollout cleanup pending approval
Date: 2026-08-18
Updated: 2026-08-19

## Review Attention

- The product addition is one first-class Project Cover workflow: agents create
  cover candidates through a focused `project.cover` media purpose, Core stores
  them as Project-owned `project_cover` Assets under `covers/`, one candidate
  may be selected as the active cover, and Studio exposes all active candidates
  in a **Covers** tab after **Settings**.
- `project.cover` Generation Context deliberately stays small. It uses the
  existing Project-target facts envelope and an empty typed reference guide; it
  does **not** inject Project title, logline, synopsis, premise, screenplay,
  analyses, Lookbooks, Cast, Locations, Props, or all Project media into one
  response. The `media-producer` skill starts from the user's conversation and
  gathers only the sources that can materially affect that request.
- Lookbooks are optional, agent-chosen context rather than an automatic runtime
  dependency. The Production Lookbook is the appearance authority when the user
  asks to match the established movie look or when the agreed cover direction
  depends on it. The Storyboard Lookbook is used only when the user explicitly
  requests a storyboard, previs, or drawn-board treatment. The skill selects
  exact useful Lookbook media; it never loads both Lookbooks by default.
- The agent reads Project Info only when the conversation does not already
  supply enough story framing. It reads named Cast, Location, or Prop context
  only when those subjects are part of the agreed cover. It reads screenplay or
  analysis material only when the request depends on a specific Scene, image,
  theme, or motif. There is no blanket “load the whole Project” step.
- The existing root-level `cover.png`/`project.cover_file` contract is replaced,
  not mirrored. `Project.coverImage` becomes the compact identity of the
  selected Project Cover Asset File, the special `/cover` HTTP route and root
  file resolver are removed, and every browser surface uses the existing Asset
  File route. No compatibility reader, duplicate field, root-file fallback, or
  synchronization write remains.
- This is a breaking Project-database schema change. Plan 0182 and
  `0078_location_world_selection.sql` are complete, so this plan starts from
  schema generation 63, uses the next Drizzle migration (expected
  `0079_project_cover_assets.sql`), and advances the Project schema generation
  to 64. The generated migration drops `project.cover_file`. A documented
  migration precondition must abort rather than silently discard a non-null
  legacy value.
- Current local evidence makes the cutover non-destructive for the two
  user-approved rollout Projects: Big Fish and Urban Basilica are at schema
  generation 63, both have `cover_file = null`, neither has a root `cover.png`,
  and neither has a `project_cover` Asset. The migration therefore performs no
  cover data or file conversion. Existing unrelated Assets and files remain
  untouched.
- Big Fish and Urban Basilica are the exact live migration and verification
  scope. Free Willy is empty, is excluded from migration/rehearsal/QA, and will
  be deleted separately by the user; this plan must not delete or mutate it.
- Durable generated covers use `covers/cover-gxxx.<ext>`. The `gxxx` token is
  only a collision discriminator. External cover imports, if used through the
  same focused purpose, preserve their normalized source basename in `covers/`
  under the existing storage convention. Skills, CLI, HTTP, and React never
  construct or parse either path.
- Cover display is fixed to the current 16:9 Project Library/sidebar surface,
  independent of the movie's production aspect ratio. The generation purpose
  fixes 16:9, recommends medium quality and the current Nano Banana 2 managed
  model, while the existing Project setting keeps Codex GPT Image 2 as the
  default agent-external image path. The user may still explicitly choose a
  different current execution path.
- The Covers tab reuses the accepted `MediaCard`, `MediaCardGrid` through
  `MediaCollectionSection`, built-in image-preview Dialog activation, persistent
  lower-right selection action, and shared top-right delete confirmation. It
  does not add a new card variant, gallery framework, preview Dialog, raw HTML
  control, upload surface, or generation button.
- Selection and deletion remain Core-owned. Before writing selection, Core
  validates an active, ready, exact Project-owned `project_cover` with exactly
  one active `primary` image Asset File. Clearing is allowed; deleting moves the
  Asset to Trash and atomically clears it if selected through the existing
  common lifecycle. Restoring a discarded cover restores the candidate but does
  not silently make it active again.
- One small shared-hook refactor is required: the current selectable-Asset hook
  is generic behavior stored under the Continuity feature. Move it to a
  domain-neutral Studio hook and update its existing Location/Prop callers so
  Project Covers do not import from a domain they do not belong to or duplicate
  the same load/select/clear/discard state machine.
- Candidate-only mutations publish `surface:project:covers`. Mutations that
  change the active cover additionally publish `project-shell` and
  `project-library`. This refreshes only the surfaces whose projection changed
  and never treats another Project-owned Asset—such as a Shot Plan video—as a
  cover change.
- The shared attachment command resolves the optional canonical selection
  target once. A selected import passes that target into the existing atomic
  persistence path and composes its selection resource keys into the returned
  report; an unselected import retains candidate-only keys. This is generic
  attachment/selection coordination, not a `project.cover` persistence branch.
- Prompts, references, and generated pixels remain opaque. Runtime validates
  only purpose, target, selected Asset type/ownership, file media kind, provider
  envelope, and storage contract. It never checks for a title, face, subject,
  composition, readable text, Lookbook resemblance, or “cover quality.”
- Existing Project Info and Settings forms, autosave behavior, Project Settings,
  generic `image.create`, Project Library card anatomy, sidebar anatomy, Trash,
  generation Preview/approval/run behavior, and all non-cover media workflows
  remain unchanged. No product decision remains open inside this plan.

## Summary

Renku Studio already displays an optional Project cover in the Project Library
and Studio sidebar, but that cover is modeled as one special root file named
`cover.png`. There is no supported generation purpose that can durably attach a
cover, no candidate history, no active-cover selection, and no Studio surface
for reviewing alternatives. The nearest purpose, `image.create`, targets the
Project but intentionally has no focused attachment destination.

The smallest architecture-correct change is to make covers ordinary
Project-owned image Assets with one canonical selection, give them a focused
generation and storage destination, teach `media-producer` how to gather
creative context progressively from the conversation, and compose the existing
MediaCard interactions in a new Covers tab. This removes the special root-file
path instead of creating a second source of truth.

## Requirement Ledger

| ID | Requirement | Source | Planned result |
| --- | --- | --- | --- |
| R1 | Project covers need dedicated media-generation instructions. | User | Add `project.cover` routing, `references/project-cover.md`, a sample Spec, and focused eval cases to `media-producer`. |
| R2 | The agent must gather context from the conversation instead of receiving the whole Project in one call. | User clarification | Keep the Generation Context minimal and instruct the skill to read only missing, request-relevant sources in progressive steps. |
| R3 | The cover workflow should explain whether and how Lookbooks are used. | User question and clarification | Use the Production Lookbook only when matching the established visual language matters; use the Storyboard Lookbook only for an explicitly storyboard-like direction. |
| R4 | Covers must be stored in a proper Project location consistent with other assets. | User | Add the Core-owned `project.cover` file destination at `covers/cover-gxxx.<ext>` and never construct paths outside Core. |
| R5 | Generated covers must be durable media with history. | User | Attach each accepted output as a Project-owned `project_cover` Asset through the existing GenerationSpec/media-import workflow. |
| R6 | One cover can be active. | User | Add `{ kind: "project" }` to common Asset selection with canonical type `project_cover`; allow select and clear. |
| R7 | Add a Covers tab to the right of Settings in Project Details. | User | Add the third line tab in `ProjectDetailsPanel`, lazy-mounting its non-draft content. |
| R8 | Display covers in media cards. | User | Use `MediaCollectionSection` and existing 16:9 `MediaCard` overlay presentation, newest first. |
| R9 | A cover can be viewed large in a Dialog. | User | Use `MediaCard`'s existing `image-preview` activation and shared `ImagePreviewDialog`. |
| R10 | A user can pick the active cover. | User | Use the existing persistent lower-right toggle selection control backed by focused HTTP routes and Core selection. |
| R11 | A user can delete a cover through the reusable MediaCard behavior. | User | Use the shared top-right delete action and confirmation; call common Asset discard so the cover moves to Trash and selected state clears atomically. |
| R12 | The UI must use design skills and current UI patterns. | User | Treat the supplied Project Details screenshot and existing Studio UI as the visual source of truth; follow line-tab, MediaCard, shadcn, copy, spacing, and desktop verification guidance. |
| R13 | The selected cover must continue to drive Project Library and sidebar imagery. | Existing product behavior | Project and ProjectSummary project the selected Asset File; HTTP constructs the existing generic Asset File URL for `coverUrl`. |
| R14 | Do not preserve parallel cover contracts. | Repository pre-customer rule | Remove `cover_file`, root `cover.png` helpers, `resolveCoverImage`, and the special HTTP route in the same slice. |
| R15 | Creative content stays agent-owned and opaque. | Decision 0041 and repository hard rule | Runtime never semantically validates prompt/reference/image contents; skill guidance and user review own creative judgment. |
| R16 | Selecting a cover must not create a selected state that the Project projection cannot read. | Accepted plan-review finding and architecture hard gate | Before the selected row changes, Core requires exactly one active `primary` image Asset File; invalid candidates leave the prior selection unchanged, while projection keeps a defensive corruption check. |
| R17 | A selected focused import must refresh every changed browser projection. | Accepted plan-review finding | Resolve the canonical selection target once in the shared attachment command and merge exact selection resource keys into the successful attachment report when `select: true`. |
| R18 | Apply the breaking local migration to Big Fish and Urban Basilica, but not Free Willy. | User clarification | Rehearse and migrate exact generation-63 copies of Big Fish and Urban Basilica through the verified-backup command. Do not touch Free Willy; the user will delete it separately. |

## Product Behavior

### Conversation-directed agent workflow

`media-producer` handles a Project Cover request through this sequence:

1. Start with the user's words. Extract the requested subject, emotion, degree
   of abstraction, typography preference if any, and whether the cover should
   match an established Project look. Do not read more Project state merely
   because it exists.
2. Read the minimal `project.cover` Generation Context:

   ```bash
   renku generation context \
     --purpose project.cover \
     --target project \
     --project <project-name> \
     --json
   ```

   Context supplies the common generation envelope, fixed/recommended settings,
   available current models, workflow policy, and only the existing small
   Project-target facts. Its `referenceGuide.sections` is empty.
3. Decide what is missing from the conversation and read only those sources:

   - `renku info show --project <project-name> --json` when title, logline,
     premise, genre, or tone is needed to turn a vague request into a concrete
     cover concept;
   - `renku lookbook show --kind production --json` when the agreed direction
     should match the movie's established final-image visual language;
   - one or more exact Production Lookbook images/sheets only when they are
     useful visual references for the chosen concept, resolved with focused
     `renku asset list --owner lookbook:<id> --type <exact-type> --json` calls;
   - `renku cast show`, `renku location show`, or `renku prop show` plus focused
     owner/type Asset lists only for subjects explicitly included in the cover
     direction;
   - `renku screenplay scene show <scene-id> --json` or
     `renku screenplay analyze show --active --json` only when the user anchors
     the cover to that material;
   - `renku lookbook show --kind storyboard --json` only when the user explicitly
     wants a storyboard, previs, sketch-board, or related drawn treatment.

   Stop gathering as soon as the request can be authored. Never automatically
   load all Cast Members, Locations, Props, screenplay Scenes, analyses, both
   Lookbooks, or the complete reference catalog.
4. Assign creative roles explicitly in agent reasoning:

   - the user conversation owns the intended subject, hierarchy, mood, and
     composition;
   - a selected Production Lookbook reference owns rendering style, palette,
     lighting, texture, and finish;
   - selected Cast/Location/Prop references own identity, design, and spatial
     continuity;
   - Project Info supplies story framing, not visual proof;
   - the Storyboard Lookbook never silently overrides the Production Lookbook.
5. Author one explicit GenerationSpec per proposed cover variation. Add only
   the exact chosen media as ordered Additional References and assign them to
   real provider media fields when the selected route requires it. Do not add
   placeholder references or persist unchosen alternatives.
6. Follow the existing Preview, validation, freeze, estimate/approval, run, and
   one-successful-generation rules. Inspect the resulting image; do not
   automatically retry based on creative quality.
7. Import every user-accepted candidate through the focused purpose:

   ```bash
   renku media import \
     --purpose project.cover \
     --target project \
     --source <project-relative-output> \
     --title <human-readable-title> \
     --summary <optional-meaningful-card-summary> \
     --receipt <managed-run-json> \
     --project <project-name> \
     --json
   ```

   Use `--source-spec <frozen-spec-id>` for a Codex/agent-external result. Use
   `--select` only when the user has accepted that candidate as the active
   Project cover. When several candidates are retained, import them all and
   select only the explicitly chosen one.
8. Tell the user that Studio's **Project Details → Covers** tab contains the
   candidates and controls the active cover.

The detailed `project-cover.md` reference should include compact cover craft
guidance for the actual surface: 16:9 composition, one legible focal hierarchy
at Project Library thumbnail size, intentional edge/safe-area behavior, and no
assumption that generated typography will be reliable. These are agent-owned
recommendations, not runtime validators or mandatory prompt phrases.

### Cover candidates and active selection

Every imported cover is:

```ts
{
  type: 'project_cover';
  mediaKind: 'image';
  owner: { kind: 'project' };
  files: [{ role: 'primary', mediaKind: 'image', ... }];
}
```

The candidate remains an active Asset until discarded. The Project selection
target is:

```ts
{ kind: 'project' }
```

and accepts only an active, ready, exact Project-owned `project_cover` Asset
with exactly one active Asset File whose role is `primary` and media kind is
`image`. Core performs that file-envelope validation before changing the
selected row. Zero, multiple, discarded, or wrong-media primary files fail with
`CORE_ASSET_SELECTION_INVALID` and leave any prior selection unchanged. There
may be zero or one selected cover. Selection affects only Project display; it
does not become a default generation reference, alter another GenerationSpec,
or discard prior candidates.

Moving a selected cover to Trash uses the current Asset lifecycle, which clears
the individual selected-Asset record in the same transaction. Restoring that
Asset returns it to the Covers tab as an unselected candidate. A later explicit
selection is required to make it active.

### Durable storage

Core owns one new destination:

```ts
{ kind: 'project.cover' }
```

Generated examples:

```text
covers/cover-g7k3.png
covers/cover-g2n6.webp
```

The file extension follows the actual accepted output. Generated naming uses
the existing fixed stem plus three-character token. External focused imports
reuse the existing normalized-source-basename and numeric collision behavior.
The folder is intentionally shallow because the Project itself is the owner and
there is no subordinate handle or production number.

`tmp/media/` remains the staging location before focused import. Root
`cover.png` is no longer a recognized Project contract. Asset identity,
selection, provenance, and MIME/media metadata remain in SQLite; the path is
only a human-browsable label.

### Studio Covers tab

Project Details becomes:

```text
Project Info | Settings | Covers
```

The supplied desktop screenshot and the existing Project Details/MediaCard
implementation are the design source of truth. The Covers tab:

- is the third line tab, directly to the right of Settings;
- does not participate in Project Info/Settings autosave aggregation;
- lazy-mounts because it has no draft form state to preserve;
- uses the current panel background and a scrollable `px-4 py-5` media surface;
- uses `MediaCollectionSection` with title **Project Covers**, the existing
  image count badge, an empty message **No project covers yet.**, standard gap,
  and a minimum card width of 320 pixels;
- renders newest candidates first using the existing Core Asset-page order;
- renders each card in a fixed 16:9 frame with `fit: "cover"` and the existing
  hover zoom;
- keeps the card quiet when no meaningful summary exists—no filename, Asset id,
  generated role name, or filler label is shown on the image;
- opens the shared large image-preview Dialog when the card body is activated;
- shows the persistent selected control in the lower-right, using
  **Use as active Project cover** and **Clear active Project cover** accessible
  labels;
- shows the shared delete action in the top-right with intentional copy that
  says the cover will be moved to Trash;
- uses the selected card styling already owned by `MediaCard`;
- shows existing text-style loading and error states with a retry through the
  feature's data hook; and
- uses only local shadcn-style interactive controls through existing shared UI.

There is no Generate, Upload, Edit, or generic Add Media control in this tab.
Generation remains agent-owned. The plan also does not add a new generation-
request inspection action because the user requested preview, active selection,
and deletion only; the common Asset File provenance remains available through
existing generation tooling.

After a local mutation, the tab refreshes its Asset page. It reloads the Project
Shell through `readProject`/`onProjectChange` only when the returned report
contains `project-shell`, so selecting, clearing, or deleting the selected cover
updates the sidebar immediately without reloading it for an unselected
candidate change. Agent/CLI mutations emit the same exact resource keys; Studio
coordination refreshes the current shell and, when the Project Library is
visible, its Project summaries.

### Explicit non-goals

This plan does not add:

- a separate `project_cover` table, Cover Take, revision number, version field,
  or cover-specific history system;
- automatic generation, prompt editing, cost display, upload, or provider
  controls in Studio;
- a second Project setting for cover provider, style, aspect ratio, quality, or
  context depth;
- automatic Project-wide context hydration or a “cover context bundle” DTO;
- a Production or Storyboard Lookbook hard requirement;
- automatic visual-reference selection based on list order, current display
  selection, title, tags, filename, or image inspection;
- runtime text/pixel analysis, title detection, face matching, composition
  scoring, or Lookbook similarity checks;
- a generic Project-owned selection for Shot Plan videos or other Project
  Assets; `{ kind: "project" }` is deliberately mapped only to
  `project_cover`;
- a new Asset card, preview Dialog, grid, delete Dialog, toast framework, or
  raw browser control;
- mobile/tablet design work;
- a root-cover migration reader, old HTTP route alias, `cover_file` mirror, or
  root file cleanup command; or
- unrelated changes to Project creation/import, FDX import, Lookbook creation,
  Cast/Location/Prop media, or Project Library card layout.

## Context And Current Evidence

### Accepted project constraints

- `docs/architecture/media-generation.md` and
  `docs/architecture/reference/media-generation.md` define context-first,
  provider-valid generation, incomplete specs, exact references, and separate
  media import.
- Decision 0041 keeps prompts, references, and generated media opaque to Studio
  runtime code.
- Decisions 0049 and 0051 keep exact reference choice request-scoped and
  agent/user-directed rather than defaulted from guide candidates.
- Decision 0022 makes `media-producer` the shared operational skill for new
  media purposes and requires progressive disclosure into focused references.
- Decision 0064 owns exclusive Asset membership and common canonical selection.
- Decision 0076 and `docs/architecture/project-asset-storage-conventions.md`
  make `packages/core/src/server/project-asset-files/` the only durable-path
  owner and require human-readable shallow paths.
- Decisions 0053 and 0066 plus
  `docs/architecture/reference/front-end-guidelines.md` own the current
  MediaCard anatomy, semantic image preview, collection layout, action
  placement, and feature/service/UI boundaries.
- Plan 0171 established the current Project Details title band and Project
  Info/Settings line tabs. The new tab composes that accepted shell.
- Plan 0182 is implemented and committed. Its
  `0078_location_world_selection.sql` migration establishes the
  `selected_asset.target_key` model and schema generation 63 used as this
  plan's current baseline.
- The Drizzle schema remains the source of truth. The repository workflow and
  current official Drizzle documentation require generating SQL from the schema
  with `drizzle-kit generate` and applying it with `drizzle-kit migrate`:
  [generate](https://orm.drizzle.team/docs/drizzle-kit-generate) and
  [migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate).

### Current implementation evidence

- `ProjectDetailsPanel` renders only Project Info and Settings. Both use
  `forceMount` to preserve autosave state; a media-only Covers tab does not need
  that behavior.
- `MediaCard` already owns image preview activation, selected styling,
  lower-right toggle/choose controls, top-right delete, and action event
  isolation. `MediaCollectionSection` already owns count, grid, and empty state.
- `useContinuityAssets` already implements the reusable load/select/clear/
  discard state machine but is stored and named as a Continuity feature.
- generic Asset listing already supports `ownerKind=project`, `type`,
  `mediaKind`, cursor paging, newest-first order, and browser-safe Asset File
  URLs. It currently returns no Project selection because Project is not an
  `AssetSelectionTarget`.
- common Asset discard already clears the selected record for an individually
  discarded Asset before returning a recoverable mutation report. No cover-
  specific delete policy is required.
- `image.create` is a Project-target image purpose with no attachment builder;
  it is appropriate for generic staged media but cannot be the durable Project
  Cover contract.
- Project-target Generation Context currently carries only
  `projectAspectRatio` plus workflow/model/settings data and an empty reference
  guide. That existing small shape is the right baseline for `project.cover`;
  no new large facts builder is needed.
- current Project display reads `project.cover_file`, accepts only
  `cover.png`, resolves a root file, and serves it through
  `/studio-api/projects/:projectName/cover`. Project creation writes null and no
  current UI or focused media workflow sets the field.
- Big Fish currently has 202 Scenes and 34 Assets; Urban Basilica has 10 Scenes
  and 107 Assets. Both Project databases report schema generation 63, null
  `cover_file`, zero `project_cover` Assets, and no root `cover.png` file.
- Free Willy is an empty generation-63 Project. Per explicit user direction it
  is not part of this plan's rehearsal, migration, or QA scope and will be
  deleted separately by the user.
- the worktree contains no in-progress Plan 0182 implementation changes. The
  current Plan 0182 selection/schema contract is the committed baseline;
  implementation must still preserve and avoid reformatting unrelated work.

### Reuse, refactor, and new code

| Area | Decision | Reason |
| --- | --- | --- |
| Asset identity, membership, listing, selection, Trash | Reuse and extend | These contracts already own the exact domain rules needed by covers. |
| Generation lifecycle and focused media import | Reuse and extend | A new purpose/destination is sufficient; no Cover-specific run system is needed. |
| Durable file allocation | Add one focused destination module | Project covers need a new Project-root destination, but allocation/naming stays in the existing registry. |
| Project cover file eligibility and projection | Add one focused Core module with two small files | Selection must reject an unusable cover before writing, while Project reads defensively reject corrupt stored selection; `full-project.ts` should own neither rule. |
| Studio selectable-Asset state hook | Refactor existing owner | Moving the generic behavior out of Continuity avoids both a wrong dependency and duplicate hooks. |
| Media cards, grid, preview, selection, delete | Reuse unchanged | Existing shared contracts already satisfy the requested UI. |
| Studio cover feature | Add a small feature folder | Data orchestration and card projection are Project-cover-specific; they do not belong in shared UI. |
| Special root cover resolver/route | Delete | It would become a competing source of truth after Asset selection. |

## Architecture Shape Gate

### Ownership

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Agent workflow | `studio-skills/skills/media-producer/` | Conversation-first context gathering, cover prompt/reference authoring, Preview/run/review, focused import, and explicit active selection. |
| Generation purpose | `packages/core/src/server/generation/purposes/project-cover.ts` | Purpose identity, Project target, image output, 16:9 fixed setting, managed recommendations, and intentionally empty typed reference guide. |
| Cover primary-file invariant | `packages/core/src/server/project-covers/primary-image.ts` | Resolve exactly one active `primary` image Asset File, reject invalid selection before writes, and expose the same invariant to defensive Project projection. |
| Cover projection | `packages/core/src/server/project-covers/projection.ts` | Resolve and validate the selected Project-owned Cover Asset through the shared primary-file invariant for Project/summary projections. |
| Shared Asset selection | `packages/core/src/server/assets/` | Map Project selection to `project_cover`, invoke the focused cover-file eligibility check before writing, and report exact resource keys. |
| Durable file path | `packages/core/src/server/project-asset-files/destinations/project-cover.ts` | Allocate `covers/cover-gxxx.<ext>` or normalized external cover names. |
| Generation attachment | existing `packages/core/src/server/generation/attachments.ts`, `attachment-persistence.ts`, and `attachment-destinations.ts` | Register the focused destination, resolve one optional canonical selection target, pass it through generic atomic persistence, and compose exact report keys. |
| Project schema/projection | Core schema and resources | Remove `cover_file`; expose compact selected Asset/File identity through `Project.coverImage`. |
| CLI | existing generation/media/asset handlers | Parse the registered purpose and Project selection target through current generic commands; add no Cover command family. |
| HTTP | `packages/studio/server/routes/assets.ts` and project response projection | Expose focused select/clear/discard routes, generic cover listing/file delivery, and generic Asset File `coverUrl`. |
| Browser data | `packages/studio/src/services/studio-project-assets-api.ts` | Focused Project Cover requests over thin HTTP routes. |
| Browser feature | `packages/studio/src/features/movie-studio/project-covers/` | Load candidates, react to resource changes, map Assets to shared MediaCards, and refresh the Project Shell only when mutation keys say its active-cover projection changed. |
| Shared browser state | `packages/studio/src/hooks/use-selectable-asset-collection.ts` | Domain-neutral async collection/select/clear/discard state only. |

### Intended module shape

```text
packages/core/src/server/generation/purposes/
  project-cover.ts                 # purpose descriptor only

packages/core/src/server/project-covers/
  primary-image.ts                  # exact primary-file invariant and diagnostics
  projection.ts                    # selected cover -> compact ProjectCoverImage

packages/core/src/server/project-asset-files/destinations/
  project-cover.ts                 # root, file, and output-name resolution
  registry.ts                      # one typed registration

packages/studio/src/features/movie-studio/project-covers/
  project-covers-tab.tsx           # resource orchestration and mutation feedback
  project-cover-cards.tsx           # Asset -> MediaCard collection projection
  project-cover-cards.test.tsx
  project-covers-tab.test.tsx

packages/studio/src/hooks/
  use-selectable-asset-collection.ts
  use-selectable-asset-collection.test.tsx

studio-skills/skills/media-producer/
  references/project-cover.md
  samples/project-cover-spec.json
```

No `index.ts` is needed for the focused `project-covers` Core module or the
Studio feature; their current callers import the owning files directly. Existing
package `index.ts` files may export public contracts only. The media-producer
`SKILL.md` remains a concise router and links to the focused reference instead
of absorbing a long cover recipe.

### Public entrypoints

- `GenerationPurpose` accepts `project.cover`; existing `generation context`,
  `generation spec`, `generation preview`, `generation estimate`, `generation
  run`, and `media import` commands discover it through the current purpose
  registry.
- `ProjectAssetFileDestination` accepts `{ kind: "project.cover" }` through the
  current durable-destination resolver.
- `AssetSelectionTarget` accepts `{ kind: "project" }`; CLI accepts
  `renku asset select --target project` and
  `renku asset clear-selection --target project`.
- `Project.coverImage` remains nullable but changes to the selected Asset/File
  identity described in Contracts below.
- Studio uses the existing generic GET Asset page and Asset File routes plus
  three focused mutations:

  ```text
  POST   /studio-api/projects/:projectName/selected-cover/:assetId
  DELETE /studio-api/projects/:projectName/selected-cover
  DELETE /studio-api/projects/:projectName/covers/:assetId
  ```

### Bounded dispatch

- Add one purpose descriptor to the existing purpose registry. Do not add
  cover branches to generic validation, preview, estimate, or execution.
- Add one attachment builder/type entry to the existing typed attachment map.
- Add one destination resolver entry to the existing destination registry; the
  root/stem logic lives in `project-cover.ts`, not in the registry.
- Add one canonical selection target/type mapping. Because Project ownership is
  shared by other non-cover Assets, Asset-page selection projection must expose
  the Project selection only when the exact page filter is
  `type=project_cover`; it must not return a cover selection for Shot Plan video
  pages or unfiltered Project Asset pages.
- Add one focused Project Cover primary-file check to the common selection path.
  It must run before `writeSelectedAssetRecord`, require exactly one active
  `primary` image Asset File, and remain in Core. Project projection reuses the
  same invariant with `CORE_ASSET_STORAGE_INVALID` for impossible stored state;
  HTTP, CLI, React, and the skill do not repeat it.
- Add project-cover-specific resource keys by selected target/Asset type. Do not
  change `studioAssetOwnerSurfaceResourceKeys({ kind: "project" })` to refresh
  cover surfaces for every Project-owned Asset.
- Resolve the optional canonical selection target once in
  `attachGenerationMedia`. Pass that target into generic attachment persistence
  and into generic attachment resource-key composition. Do not infer selection
  again inside persistence or add a cover-specific branch there.

### Files expected to shrink, disappear, or stay thin

- Delete `packages/core/src/server/files/cover-image-files.ts`.
- Remove `PROJECT_COVER_IMAGE_FILE` and `resolveProjectCoverImagePath` from
  `project-paths.ts`.
- Remove `resolveCoverImage` and `ResolveProjectCoverImageInput` from the Core
  service contract/wiring and fake services.
- Delete the special GET `/cover` branch from `projects.ts`; that route module
  should become smaller.
- Update, rather than preserve, `project-cover-url.ts` so it builds the generic
  Asset File URL from `assetId` and `assetFileId`.
- Remove `coverFile` from the Project schema/access/create path and remove
  `coverPath` from `ProjectCreateReport` and callers.
- Delete the old Continuity-local selectable-Asset hook after moving its real
  implementation to `src/hooks`; do not leave a re-export or compatibility
  wrapper.
- `ProjectDetailsPanel` gains only the tab item/content composition; cover data
  and card mapping stay outside it.
- `assets.ts` gains only thin focused HTTP adapters; eligibility remains in
  Core.

### Forbidden shapes and stop conditions

Stop and revise before implementation continues if any of these occurs:

- a route, CLI handler, React component, or skill decides whether a candidate
  is a valid active Project Cover instead of Core selection;
- Core writes Project Cover selection before confirming exactly one active
  `primary` image Asset File, or relies on the later Project projection to catch
  a command-created invalid state;
- root `cover.png`, `cover_file`, and selected `project_cover` remain readable
  or writable in parallel;
- `Project.coverImage` mirrors a path or full Asset payload when two IDs are
  sufficient for the display projection;
- Generation Context starts embedding complete Project story/visual/subject
  documents or enumerating all reference media;
- runtime code chooses the Production or Storyboard Lookbook, interprets
  creative content, or validates generated pixels;
- `image.create` gains conditional cover attachment behavior instead of the
  explicit `project.cover` purpose;
- Project selection accidentally applies to every Project-owned Asset type;
- `studioAssetOwnerSurfaceResourceKeys(project)` broadcasts cover refresh for
  unrelated Shot Plan media;
- the Project Covers feature imports Continuity-domain code or duplicates the
  shared selectable-Asset state machine;
- `ProjectDetailsPanel`, `routes/assets.ts`, `attachment-destinations.ts`, or a
  package `index.ts` accumulates validation, persistence, rendering, and side
  effects in one body;
- a new MediaCard variant, caller-supplied action slot, preview Dialog, raw
  `<button>`, or raw form control is introduced for this tab;
- migration/runtime code adds a fallback reader, warning, or repair path for
  the obsolete root-cover contract; or
- implementation mutates Free Willy, applies either in-scope live migration
  without the verified backup flow, or creates formatting churn in touched
  files.

## Contracts

### Generation purpose and context

Add:

```ts
export type GenerationPurpose =
  | 'project.cover'
  // existing purposes remain unchanged
```

The descriptor is exact:

```ts
defineGenerationPurpose({
  purpose: 'project.cover',
  targetKind: 'project',
  outputMediaKind: 'image',
  settings: {
    fixed: [{ kind: 'aspect-ratio', value: '16:9' }],
    recommended: [{ kind: 'quality', value: 'medium' }],
    recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' },
  },
  async buildReferenceGuide(context) {
    return buildReferenceGuide({ context });
  },
})
```

`GenerationContext.facts` for this Project target remains the existing small
facts output (`projectAspectRatio` plus explicitly authored facts, if any).
There is no `projectCoverContext`, no Lookbook slot, no story metadata bundle,
and no subject inventory. The fixed 16:9 setting is the cover surface contract;
`projectAspectRatio` is informational common context and does not override it.

### Asset, file destination, and attachment

Add the canonical Asset type string `project_cover` at the existing
purpose/selection boundaries. Add:

```ts
type ProjectAssetFileDestination =
  | { kind: 'project.cover' }
  // existing destinations
```

`project-cover.ts` implements async/sync file resolution, root resolution, and
multi-output name allocation using:

```text
root: covers/
generated stem: cover
```

The attachment registry maps:

```ts
project.cover -> {
  owner: { kind: 'project' };
  assetType: 'project_cover';
  mediaKind: 'image';
  file: { kind: 'project.cover' };
  label: 'Project Cover';
  resourceKeys: ['surface:project:covers'];
}
```

Import with `select: true` uses the current atomic attachment + selection path.
`attachGenerationMedia` resolves
`assetSelectionTargetForOwnerType(attachment.owner, attachment.assetType)` once
when selection is requested, passes that exact target into generic persistence,
and supplies it to `generatedMediaAttachmentResourceKeys`. The resource helper
deduplicates the candidate keys with the common selection-target keys, so a
selected cover report contains `surface:project:covers`, `project-shell`, and
`project-library`; an unselected candidate reports only the Covers surface. No
cover-specific persistence transaction or report branch is added.

### Common selection

Extend:

```ts
export type AssetSelectionTarget =
  | { kind: 'project' }
  // existing targets
```

The canonical type map adds:

```ts
project: 'project_cover'
```

Target ownership and keys are exact:

```ts
selectionTargetOwner({ kind: 'project' }) === { kind: 'project' }
assetSelectionTargetKey({ kind: 'project' }) === assetOwnerKey({ kind: 'project' })
```

`assetSelectionTargetForOwnerType({ kind: 'project' }, 'project_cover')`
returns `{ kind: 'project' }`. Other Project-owned types remain unsupported for
selection. Project Cover Asset pages project the selected id only for the exact
`project_cover` filter.

Before `writeSelectedAssetRecord`, Project selection calls the focused
Project Cover primary-image invariant. It requires exactly one active Asset
File with `role = "primary"` and `mediaKind = "image"`. The same check runs
inside the atomic attachment transaction after the new file row exists and
before selection is written. Invalid file state fails with
`CORE_ASSET_SELECTION_INVALID` and preserves the prior selected row.

CLI target parsing adds the exact token `project`. Existing structured codes
remain authoritative:

- `CORE_ASSET_SELECTION_INVALID` for inactive, unavailable, wrong-type,
  wrong-owner, or invalid primary-file selection;
- `CORE_ASSET_SELECTION_UNSUPPORTED` when another Project-owned Asset type is
  presented as a canonical selection;
- `CLI046` for an invalid textual selection target.

### Project display projection

Replace the old shape with:

```ts
export interface ProjectCoverImage {
  assetId: string;
  assetFileId: string;
}
```

`readSelectedProjectCoverImage(session)`:

1. reads the `{ kind: "project" }` selected record;
2. returns null when there is no selection;
3. reads the active Project-owned Asset;
4. requires type `project_cover`, media kind `image`, and exactly one active
   Asset File whose role is `primary` and media kind is `image`; and
5. returns only `assetId` and `assetFileId`.

Impossible/corrupt selected storage fails with existing structured
`CORE_ASSET_STORAGE_INVALID`; it must not guess another candidate, use newest
order, or silently return a stale root file.

`readProjectFromSession` uses that focused projection. `ProjectSummary` and
`ProjectShell` continue to carry `Project.coverImage` through existing
projections. The Studio HTTP adapter derives:

```text
/studio-api/projects/<projectName>/assets/<assetId>/files/<assetFileId>
```

as `coverUrl`. No local path enters browser DTOs.

Remove from public/current contracts:

```ts
ProjectCoverImage.fileName
ProjectCreateReport.coverPath
ResolveProjectCoverImageInput
ProjectDataService.resolveCoverImage
```

### Studio resource keys

Add:

```ts
studioProjectCoversResourceKey() // 'surface:project:covers'
projectCoverCandidateResourceKeys() // covers only
projectCoverSelectionResourceKeys() // covers + shell + library
```

Selection/clear reports for `{ kind: "project" }` use the selection keys.
Project-cover attachment uses candidate keys unless `select: true`. Discard
uses selection keys only when the Asset was selected immediately before the
transaction; otherwise it uses candidate keys. Restore uses candidate keys and
does not recreate selection. Other Project-owned Assets retain their current
keys. The browser adds `matchesProjectCoversResource()` and reuses existing
shell/library matchers.

`use-studio-coordination.ts` must honor `project-library` on
`studio.projectResourcesChanged` even when no Project is currently open, so an
agent-imported/selected cover refreshes the visible Project Library. Current
Project shell refresh remains gated to the matching Project id.

### Studio HTTP and service contracts

Keep GET generic:

```text
GET /studio-api/projects/:projectName/assets
  ?ownerKind=project
  &type=project_cover
  &mediaKind=image
  &limit=200
  [&cursor=...]
```

Add the three focused mutations named in the Architecture Shape Gate. Route
handlers read params, call `selectAsset`, `clearAssetSelection`, or
`discardAsset` with exact Project intent, serialize the report, and translate
structured errors. No route validates type or ownership itself.

Add focused browser service functions:

```ts
readProjectCoverAssets(projectName): Promise<StudioAssetCollection>
selectProjectCoverAsset(projectName, assetId): Promise<AssetSelectionReport>
clearSelectedProjectCover(projectName): Promise<AssetSelectionReport>
deleteProjectCoverAsset(projectName, assetId): Promise<RecoverableMutationReport>
```

Do not add a second Project Cover DTO for the gallery; it consumes the existing
`StudioAssetResponse` collection.

The moved shared hook accepts mutation callbacks that return the existing
report shape `{ resourceKeys: string[] }`. Its toggle and remove functions
return that report after refreshing the collection. Existing Location/Prop
callers may ignore the return value; Project Covers inspects it to decide
whether `project-shell` also needs a local reload. Do not add a cover-specific
callback or boolean to the shared hook.

### Database migration

Starting from the completed Plan 0182 generation-63 baseline:

1. remove `coverFile` and its check from the Drizzle Project schema;
2. generate the next migration from `packages/core` with Drizzle Kit, expected:

   ```bash
   pnpm drizzle-kit generate \
     --config drizzle.config.ts \
     --name project_cover_assets
   ```

3. add one documented custom SQL precondition before the generated column drop,
   using the repository's temporary-table `CHECK` guard pattern because a
   schema diff cannot express this data condition; abort before schema change
   when `project.cover_file IS NOT NULL`;
4. set `PRAGMA user_version = 64` because current runtime removes a column it no
   longer reads;
5. add a focused migration test proving null-cover Project rows and unrelated
   Project/Asset/selection data survive, and a non-null legacy field aborts
   before writes;
6. rehearse this pending 0079 migration on isolated generation-63 copies of Big
   Fish and Urban Basilica; and
7. migrate live Big Fish and Urban Basilica only through
   `renku project migrate`, which owns verified pre-migration backups. Do not
   migrate or delete Free Willy as part of implementation.

The migration does not create Asset rows, select a cover, move/delete a file,
or recognize root `cover.png` at runtime.

## Implementation Slices

### Slice 1: Complete dependency gate and record the cover decision

Expected files:

- verify the committed Plan 0182 selection contract and migration 0078 baseline;
- add `docs/decisions/0083-use-project-owned-cover-assets-and-conversation-directed-generation.md`;
- add brief update notices to Decisions 0046, 0053, 0064, and 0076.

The new ADR records the cohesive cutover: focused purpose, selective
conversation-driven context gathering, Project-owned candidate Assets, common
selection, `covers/`, compact Project projection, and Covers-tab composition.
Historical ADR bodies remain intact; notices point to 0083 where it narrows or
extends them.

Stop if the committed Plan 0182 selection contract, current generation-63
databases, or Big Fish/Urban Basilica cover preconditions differ from the
evidence used here. Update this plan deliberately before generating another
migration.

### Slice 2: Add the focused generation and attachment contract

Expected files:

- `packages/core/src/client/generation.ts`;
- `packages/core/src/server/generation/purposes/project-cover.ts`;
- `packages/core/src/server/generation/purposes.ts`;
- `packages/core/src/server/generation/attachments.ts`;
- `packages/core/src/server/generation/attachment-persistence.ts`;
- `packages/core/src/server/generation/attachment-destinations.ts`;
- focused purpose/context/settings/attachment tests;
- CLI purpose/target registry tests that derive behavior from the Core
  descriptor rather than duplicating business rules.

Add `project.cover` with exact settings and no typed reference slots. Register
the focused attachment owner/type/file/resource keys. Resolve an optional
canonical selection target once in `attachGenerationMedia`, pass it into the
generic atomic persistence path, and compose its selection keys into the report.
Prove selected and unselected imports return exact keys and that `image.create`
remains unattached and unchanged.

### Slice 3: Add the Core-owned `covers/` destination

Expected files:

- `packages/core/src/server/project-asset-files/types.ts`;
- new `destinations/project-cover.ts`;
- `destinations/registry.ts`;
- path-allocation/destination tests;
- `docs/architecture/project-asset-storage-conventions.md`.

Implement both sync/async allocation and multi-output name prediction through
the existing allocators. Test generated PNG/WebP names, external source names,
collisions, root containment, and registry dispatch. Do not add path logic to
generation attachment or skill code.

### Slice 4: Extend Project selection and exact resource refresh

Expected files:

- `packages/core/src/client/assets.ts`;
- `packages/core/src/server/assets/selection-targets.ts`;
- `packages/core/src/server/assets/selection.ts`;
- `packages/core/src/server/assets/projection.ts`;
- `packages/core/src/server/assets/resource-keys.ts`;
- new `packages/core/src/server/project-covers/primary-image.ts`;
- `packages/core/src/server/commands/discard-asset.ts`;
- `packages/core/src/server/trash/trash-object-registry.ts`;
- `packages/core/src/server/studio-coordination/resource-keys.ts`;
- `packages/cli/src/commands/asset-command.ts`;
- focused Core/CLI/Trash tests.

Add the project target without making Project ownership generically selectable.
Require exactly one active `primary` image Asset File before writing Project
selection. Return selected id only on the filtered cover page. Add exact cover
keys to select/clear/attach/discard/restore. Preserve Shot Plan video keys and
every existing target. Prove wrong type/owner/discarded Asset and zero,
multiple, discarded, or wrong-media primary files fail before the selected row
changes.

### Slice 5: Replace the root cover projection and migrate schema

Expected files:

- new `packages/core/src/server/project-covers/projection.ts`;
- reuse `packages/core/src/server/project-covers/primary-image.ts` for the
  defensive stored-selection check;
- `packages/core/src/client/project/model.ts` and schema;
- `packages/core/src/server/resources/full-project.ts`;
- Project schema/access/create/service contracts and tests;
- generated `packages/core/drizzle/0079_project_cover_assets.sql` and metadata;
- focused migration test;
- delete `packages/core/src/server/files/cover-image-files.ts`;
- narrow `project-paths.ts`;
- Core service wiring/fakes/callers that currently expose `resolveCoverImage`;
- CLI/project-creation reports and tests that currently mention `coverPath`.

Make the selected Asset/File identity the only Project cover source. Remove the
field, resolver, and obsolete create-report property directly. Generate and
review the Drizzle migration, document its one precondition, and rehearse on
isolated Big Fish and Urban Basilica copies before migrating those two Projects.
Do not touch Free Willy.

### Slice 6: Replace the special HTTP route and add focused mutations

Expected files:

- `packages/studio/server/routes/projects.ts`;
- `packages/studio/server/routes/assets.ts`;
- `packages/studio/server/http/project-cover-url.ts`;
- `packages/studio/server/http/project-responses.ts`;
- Studio server fake service/fixtures and route tests.

Delete GET `/:projectName/cover`. Build `coverUrl` from the compact selected
Asset/File identity and the generic Asset File endpoint. Add thin Project Cover
selection/clear/discard routes. Test 200 reports, structured invalid-selection
responses, missing Asset File behavior through the generic route, and absence
of the special route from current API tests/docs.

### Slice 7: Add the Studio Covers feature by composing existing UI

Expected files:

- move `features/movie-studio/continuity/use-continuity-assets.ts` to
  `hooks/use-selectable-asset-collection.ts`, delete the old file, and update
  Location/Prop callers directly;
- `packages/studio/src/services/studio-project-assets-api.ts`;
- `packages/studio/src/hooks/use-studio-resource-refresh.ts`;
- `packages/studio/src/app/use-studio-coordination.ts`;
- new `features/movie-studio/project-covers/project-covers-tab.tsx`;
- new `features/movie-studio/project-covers/project-cover-cards.tsx`;
- `features/movie-studio/project-details/project-details-panel.tsx`;
- focused hook, service, card, tab, Project Details, coordination, sidebar,
  Project Library, and app tests.

The generic hook owns collection/error/loading/refresh/toggle/remove state and
passes the existing mutation report back to its caller; it owns no cover rules.
The cover feature filters only via its service query, projects MediaCard props,
owns toast/error handling, subscribes to cover keys, and reloads the shell only
when returned resource keys include `project-shell`. Project Details only
composes the lazy tab.
Do not change shared MediaCard contracts unless a failing requirement proves a
real gap; the current inspection shows none.

Use the Product Design workflow as a verification discipline during this slice:
compare the implementation against the supplied screenshot, current Project
Details source, MediaCard decision/guidelines, and adjacent asset galleries.
No separate generated mockup is required because the target surface and shared
component behavior are already specified.

### Slice 8: Add Project Cover media-producer guidance and evals

Expected files in `/Users/keremk/Projects/aitinkerbox/studio-skills`:

- `skills/media-producer/SKILL.md`;
- new `skills/media-producer/references/project-cover.md`;
- new `skills/media-producer/samples/project-cover-spec.json`;
- `skills/media-producer/evals/forward-test-cases.md`;
- image guide/sample validator inputs if required by its current registry;
- `README.md` only if its current purpose inventory is explicit.

Keep `SKILL.md` to purpose routing, target, and focused-reference disclosure.
The detailed reference owns the conversation-first source decision tree,
Lookbook rules, prompt/reference roles, 16:9 cover craft, generation lifecycle,
candidate import, and selection behavior.

Add eval cases for:

- a fully specified user request that needs no Project document reads;
- a vague “make a cover for this film” request that reads only enough Project
  Info and Production Lookbook context to resolve the direction;
- an established-look request that selects exact Production Lookbook media but
  never reads the Storyboard Lookbook;
- an explicit storyboard-style cover that may read the Storyboard Lookbook;
- a cover centered on named Cast/Location/Prop subjects that reads only those
  exact records/media;
- several accepted candidates where only the user-chosen one becomes active;
- a creative-quality miss that stops for user direction instead of retrying;
- confirmation that no eval expects Core to provide semantic cover context or
  validate the resulting image.

### Slice 9: Update current documentation and remove obsolete cover language

Expected current docs:

- `docs/architecture/media-generation.md`;
- `docs/architecture/reference/media-generation.md`;
- `docs/architecture/reference/studio-skills.md`;
- `docs/architecture/project-asset-storage-conventions.md`;
- `docs/architecture/reference/project-files-and-assets.md`;
- `docs/architecture/data-model-and-storage.md`;
- `docs/architecture/naming-guidelines.md`;
- `docs/architecture/reference/studio-server-hono.md`;
- `docs/architecture/reference/project-create-from-yaml.md`;
- `docs/architecture/reference/drizzle-migrations.md` for the documented
  migration precondition;
- `docs/architecture/frontend.md` or the front-end reference only if their
  surface inventory explicitly lists Project cover behavior.

Describe only the current selected-Asset contract. Remove current references to
`coverFile`, root `cover.png`, `resolveCoverImage`, `coverPath`, and the special
HTTP route. Do not edit historical plans for a naming sweep.

## Tests And Guardrails

### Core generation and attachment

- Purpose inventory includes `project.cover` with Project target, image output,
  fixed 16:9, recommended medium quality/Nano Banana 2, and no typed guide slots.
- Context does not add Project story documents or Asset candidates.
- Available model filtering honors fixed 16:9.
- focused import creates one Project-owned `project_cover` Asset and one primary
  image Asset File in `covers/`.
- `select: true` imports Asset/file/provenance/membership/selection atomically
  and reports covers/shell/library keys; an unselected import reports only the
  Covers key.
- failed attachment rolls back rows and copied files and leaves prior selection
  unchanged.
- `image.create` still reports unsupported focused attachment.

### Storage

- generated file names match `covers/cover-gxxx.<ext>` and use the actual
  extension/output hint;
- external names preserve the normalized source basename and add numeric
  collision suffixes only when needed;
- predicted multi-output names are unique and consistent with persistence;
- invalid paths and collision exhaustion fail with existing structured Project
  Asset File diagnostics;
- no code outside `project-asset-files` constructs the durable cover path.

### Selection and Trash

- a ready Project-owned `project_cover` with exactly one active `primary` image
  Asset File selects successfully;
- select rejects wrong owner, wrong type, discarded/unavailable Asset, zero or
  multiple active primary files, and a non-image primary file, and writes
  nothing or changes no prior selection;
- Project selection clear is idempotent under the current command contract;
- filtered Project Cover Asset page returns `selectedAssetId`;
- Project pages for Shot Plan video types and unfiltered Project Assets do not
  expose the cover selection;
- discarding the active cover clears selection and returns cover/shell/library/
  Trash keys, while discarding an unselected cover omits shell/library keys;
- restoring returns the cover candidate but does not recreate selection;
- existing Location World and every prior selected target retain exact keys and
  behavior.

### Project projection and migration

- no selection projects `coverImage: null` and `coverUrl: null`;
- selected valid cover projects exact `assetId`/`assetFileId` and generic URL;
- corrupt selected type/owner/missing, multiple, or wrong-media primary image
  files fail with
  `CORE_ASSET_STORAGE_INVALID`;
- generated project JSON schema accepts only the new compact shape;
- migration 0079 preserves Project fields, Asset history, memberships,
  selections, generation provenance, and unrelated files while dropping
  `cover_file`;
- non-null legacy `cover_file` aborts before schema mutation;
- fresh Project creation succeeds without `coverFile`/`coverPath` concepts;
- current runtime rejects pre-migration schema generation through the existing
  structured store-generation guard.

### HTTP and browser services

- Project/Project Shell/Project Library responses use the generic Asset File
  URL and never expose project-relative or absolute paths;
- the old `/cover` route is absent;
- focused select/clear/discard routes forward exact intent and structured
  reports without route-local eligibility rules;
- Project Cover list paginates through all pages and preserves newest-first
  order/selected id;
- the shared selectable-Asset hook refreshes the collection and returns the
  unchanged mutation resource keys to its caller;
- resource events containing `project-library` refresh the library even with no
  current Project, while unrelated events do not.

### Studio UI

- Project Details tab order is Project Info, Settings, Covers;
- Project Info and Settings stay force-mounted and retain autosave tests;
- Covers lazy-mounts and does not enter combined save status;
- empty, loading, error/retry, and populated states render intentionally;
- cards use existing 16:9 MediaCard rendering with no raw filename/id filler;
- card body opens the existing large image Dialog;
- lower-right selection toggles active state and refreshes the sidebar Project
  shell;
- top-right delete uses the shared confirmation, does not trigger preview, moves
  to Trash, and removes selected styling/cover display when applicable;
- selected action and delete action remain keyboard accessible with meaningful
  labels;
- no raw interactive HTML controls appear in the new feature;
- existing Location/Prop selectable-Asset behavior stays green after the hook
  move;
- Project Library and sidebar continue to render the selected generic
  `coverUrl`.

### Architecture/static guardrails

- existing import-boundary tests continue to prevent UI from importing server
  or Core server modules;
- add a stable capability guard, if needed, proving the current Project HTTP
  route no longer exposes a special cover-file resolver; do not freeze private
  helper names or a full service inventory;
- scan current production code/docs for root-cover public concepts:

  ```bash
  rg -n "cover_file|coverFile|coverPath|PROJECT_COVER_IMAGE_FILE|resolveCoverImage|/cover" \
    packages docs/architecture
  ```

  Review every remaining match. Generated migration history and explicit ADR
  history/update notices are allowed; runtime compatibility behavior is not.
- inspect for raw controls in the new feature and for durable `covers/` path
  construction outside the Core destination owner.

## Documentation

Create Decision 0083 and update the current architecture/reference documents
listed in Slice 9. The documentation must answer these user-facing architecture
questions directly:

- `media-producer` is the current skill responsible for Project Cover media;
- `project.cover` is the focused purpose and `project` is its target;
- Generation Context stays small and the skill gathers creative context from
  the conversation one relevant source at a time;
- Production Lookbook use is deliberate and optional; Storyboard Lookbook use
  requires an explicit storyboard-like direction;
- all candidates are Project-owned `project_cover` Assets;
- the active cover is common selected-Asset state;
- files live under `covers/`, not root `cover.png`;
- Studio's Covers tab is the review/selection/Trash surface; and
- Project Library/sidebar display the selected Asset File through the generic
  Asset URL.

Skill docs are operational companions, not a second contract source. Core/CLI
docs own purpose/target/settings/storage/selection semantics; the skill owns
the creative context-gathering and cover craft workflow.

## Final Verification

### Focused automated checks

Run from the Studio repository root unless noted:

```bash
pnpm --dir packages/core test
pnpm test:cli
pnpm --filter @gorenku/studio test
pnpm build:core
pnpm --filter @gorenku/studio build
```

Run the focused migration test directly while iterating. Separately, from
`/Users/keremk/Projects/aitinkerbox/studio-skills`, run:

```bash
node skills/media-producer/scripts/validate-image-prompt-guides.mjs \
  --project big-fish
```

Validate every new/changed media-producer Markdown link and JSON sample, and run
the applicable skill eval harness/current manual forward-test procedure.

### Root verification

After focused checks pass:

```bash
pnpm build
pnpm test
pnpm lint
pnpm check
```

### Migration rehearsal

1. Copy the current Big Fish and Urban Basilica Project folders to an isolated
   temporary root; never test a destructive schema migration first on a live
   folder. Do not copy, migrate, or delete Free Willy for this plan.
2. Confirm both copies start at schema generation 63, then apply the pending
   0079 migration through the current migration command and verified backup
   boundary.
3. Verify schema generation 64, `PRAGMA quick_check`, Project/Scene/Asset counts,
   existing selections, and representative Asset File reads.
4. Verify no cover data conversion was attempted and the copies contain no
   selected cover until a focused import/select is performed.
5. Create/import/select/discard/restore one cover in an isolated Project and
   verify `covers/` file persistence plus Trash/selection behavior.
6. Only after rehearsal, run `renku project migrate big-fish` and
   `renku project migrate urban-basilica`, retaining both reported backups.
   Free Willy remains untouched for the user's separate deletion.

### Desktop Product Design verification

Use the existing Chrome Renku Studio session at the current desktop viewport;
do not add mobile testing.

1. Open Big Fish Project Details and compare the title/tab band against the
   supplied screenshot.
2. Confirm **Covers** sits immediately after **Settings** and tab switching does
   not reset unsaved Project Info/Settings drafts.
3. Verify empty, one-card, several-card, selected, loading, error, and
   post-delete states in both dark and light themes.
4. Confirm a card opens the large shared Dialog, actions do not also open it,
   selection is persistent lower-right, delete is top-right, and focus/keyboard
   behavior matches existing MediaCards.
5. Confirm 16:9 cards remain useful at the supported narrow and wide desktop
   panel widths with no nested card shell or excessive copy.
6. Select a cover and verify the sidebar updates immediately; return to Project
   Library and verify the same selected cover appears there.
7. Trigger an agent/CLI cover import/select while Project Details or Project
   Library is visible and verify exact resource refresh without a full reload.
8. Confirm no filename, Asset id, project-relative path, provider URL, or filler
   copy appears on cards or in the preview.

### Architecture-shape review

- inspect `git diff --stat` and the complete diff in both Studio and
  Studio Skills repositories;
- compare touched selection/migration files against the committed Plan 0182
  baseline and confirm this slice did not incidentally change or reformat its
  Location World behavior;
- inspect `attachment-destinations.ts`, `assets.ts`, Project resources,
  `ProjectDetailsPanel`, and every new/heavily modified file for size,
  complexity, and mixed responsibilities;
- confirm `project-cover.ts` destination and Project Covers feature modules own
  their focused logic while registries/entrypoints remain thin;
- confirm no root-cover compatibility path, automatic context bundle, runtime
  creative validator, Project-wide selection shortcut, new MediaCard API, broad
  resource broadcast, or raw control entered the implementation;
- confirm `index.ts` files contain exports/composition only; and
- confirm no checklist item was satisfied by moving a monolith into Core or by
  accepting an unreviewable route/component.

## Completion Checklist

### Review Area

- [x] Confirm the committed Plan 0182 selection contract, migration 0078, and
      schema-generation-63 baseline remain green before this schema slice begins.
- [x] Confirm the implementation matches every requirement in the ledger.
- [x] Confirm the Review Attention decisions remain accurate, especially the
      minimal context contract and direct removal of root-cover behavior.
- [x] Confirm the implementation preserves accepted package and feature
      boundaries.
- [x] Confirm centralized ownership did not become a monolithic implementation.
- [x] Confirm the final module/file shape matches the Architecture Shape Gate.
- [x] Confirm no new broad dispatcher, catch-all helper, or god file was added.
- [x] Confirm no behavior outside Project Cover generation/storage/selection/
      display changed except the named shared-hook refactor and resource-key
      handling required by this feature.

### Architecture And Contracts

- [x] Add and record Decision 0083; add only brief supersession/extension
      notices to affected earlier ADRs.
- [x] Add `project.cover` with exact Project/image/settings/empty-guide
      contract.
- [x] Keep Generation Context free of automatic story, Lookbook, subject,
      screenplay, analysis, and reference-catalog hydration.
- [x] Add `project.cover` destination and `project_cover` attachment through
      existing Core owners.
- [x] Add `{ kind: "project" }` canonical selection only for
      `project_cover`.
- [x] Require exactly one active `primary` image Asset File in Core before a
      Project Cover selection write, preserving any prior selection on failure.
- [x] Replace `ProjectCoverImage.fileName` with exact Asset/File identity.
- [x] Remove `ProjectCreateReport.coverPath`, `resolveCoverImage`, and the
      root-file service contract directly.
- [x] Add exact covers/shell/library resource keys without broadcasting every
      Project-owned Asset mutation.
- [x] Keep package-boundary diagnostics structured and reuse current codes
      where their semantics already fit.
- [x] Keep prompts, references, and images opaque to runtime code.
- [x] Add no compatibility shim, alias, mirror, fallback, or obsolete-shape
      runtime diagnostic.

### Core And Storage Implementation

- [x] Register the purpose descriptor in the bounded generation registry.
- [x] Register attachment owner/type/file/resource keys without branching the
      generic persistence lifecycle.
- [x] Resolve the optional canonical selection target once in the shared
      attachment command, pass it into atomic persistence, and compose its
      exact keys into the attachment report.
- [x] Add the focused destination module and typed registry entry.
- [x] Verify generated and external cover naming through existing allocators.
- [x] Extend selection target/owner/key/type mapping and exact page projection.
- [x] Add the focused Project Cover primary-image invariant and reuse it for
      selection-time rejection and defensive stored-selection projection.
- [x] Extend select/clear/discard/restore resource reports.
- [x] Add the focused selected-cover Project projection.
- [x] Remove root cover file helpers and Project path constants.
- [x] Remove obsolete create/service fields and update all direct callers.

### Schema And Migration

- [x] Remove `project.cover_file` from the Drizzle TypeScript schema.
- [x] Generate 0079 through Drizzle Kit from the schema diff.
- [x] Document and test the non-null legacy-field precondition before any
      intentional custom migration SQL is accepted.
- [x] Advance schema generation from 63 to 64.
- [x] Preserve all unrelated Project, Asset, membership, selection, generation,
      and Trash rows.
- [x] Rehearse pending migration 0079 on isolated generation-63 Big Fish and
      Urban Basilica copies.
- [ ] Apply live Big Fish and Urban Basilica migrations only through the
      verified backup command; do not mutate or delete Free Willy.
- [x] Record both backup paths and confirm `PRAGMA quick_check`/generation 64.

### CLI, HTTP, And Coordination

- [x] Make CLI purpose parsing discover `project.cover` from Core.
- [x] Add `project` to Asset selection target parsing and current help/errors.
- [x] Keep media import/select behavior on existing commands; add no Cover
      command family.
- [x] Delete the special GET `/cover` route.
- [x] Build `coverUrl` through the generic Asset File route.
- [x] Add focused select/clear/discard HTTP routes with thin adapters.
- [x] Add focused Studio service functions and typed reports.
- [x] Refresh Project Library on exact resource events even when no Project is
      open.
- [x] Preserve current shell refresh behavior for the matching open Project.

### Studio UI

- [x] Move the generic selectable-Asset hook to `src/hooks`, update callers,
      and delete the old Continuity path without a re-export.
- [x] Preserve mutation reports through the shared hook so Project Covers can
      refresh the shell from exact resource keys without adding domain flags.
- [x] Add the Project Covers feature folder with separate orchestration and card
      projection files.
- [x] Add Covers after Settings without changing the title band or autosave
      aggregation.
- [x] Lazy-mount the Covers tab.
- [x] Reuse `MediaCollectionSection`, `MediaCard`, and shared preview/delete
      Dialogs without extending their public contracts.
- [x] Render fixed 16:9 cover cards newest first with quiet intentional copy.
- [x] Wire large preview, active-selection toggle, and Trash delete.
- [x] Refresh the tab after local mutations and the Project Shell only when
      returned keys say its active-cover projection changed.
- [x] Add meaningful empty/loading/error/retry behavior.
- [x] Use only local shadcn-style controls and preserve keyboard/focus behavior.
- [x] Verify sidebar and Project Library use the same selected cover URL.

### Studio Skills

- [x] Add `project.cover -> project` to the media-producer route inventory.
- [x] Add `references/project-cover.md` and keep `SKILL.md` concise.
- [x] Add a valid project-cover GenerationSpec sample.
- [x] Teach conversation-first, stop-when-sufficient context gathering.
- [x] Teach optional Production Lookbook and explicit-only Storyboard Lookbook
      use.
- [x] Teach exact subject/source reads and exact Additional References.
- [x] Teach Preview/run/review/import/select behavior and no automatic retry.
- [x] Add forward evals for minimal context, Lookbook choices, named subjects,
      multiple candidates, and active selection.
- [x] Run image guide/sample/link validation against the current CLI.

### Tests And Guardrails

- [x] Add/update purpose, settings, context, attachment, storage, selection,
      projection, Trash, migration, CLI, HTTP, service, coordination, hook, card,
      tab, sidebar, Project Library, and app tests described above.
- [x] Prove invalid selection and failed attachment write nothing/roll back.
- [x] Prove zero, multiple, discarded, and wrong-media primary Cover files fail
      before selection changes, while corrupt stored selection fails projection.
- [x] Prove selected attachment reports covers/shell/library keys and
      candidate-only attachment reports only the Covers key.
- [x] Prove non-cover Project Asset pages do not inherit cover selection.
- [x] Prove individual discard clears and restore does not recreate selection.
- [x] Prove the old special route and current root-cover runtime concepts are
      absent.
- [x] Preserve stable import/capability architecture tests; do not add source
      needles for private function/class names.
- [x] Run the root-cover concept scan and review every allowed historical match.
- [x] Run the shape-review checks listed in Final Verification.

### Documentation

- [x] Update current media-generation, skill, Asset/storage, data-model,
      naming, server, creation, migration, and frontend references.
- [x] Document the exact `covers/` tree and selected Asset/File projection.
- [x] Document clearly that the skill—not Generation Context—gathers creative
      context based on the conversation.
- [x] Remove current `coverFile`, root `cover.png`, `coverPath`, special route,
      and resolver guidance.
- [x] Keep historical plans unchanged except this active plan's own progress.

### Final Verification

- [x] Run focused Core, CLI, Studio server, React, migration, and skill checks.
- [x] Run root `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm check`.
- [x] Complete desktop dark/light visual and interaction QA in the supplied
      Project Details surface.
- [x] Verify an agent-imported/selected cover refreshes Studio and Project
      Library through exact resource events.
- [ ] Verify live rollout touched only Big Fish and Urban Basilica and retained
      both migration backup reports; confirm Free Willy remained untouched.
- [x] Review `git diff --stat` and the complete diffs in both repositories.
- [x] Inspect every new or heavily modified file for mixed responsibilities and
      split it before completion when needed.
- [x] Confirm `index.ts` files remain thin public entrypoints.
- [x] Confirm no checklist item is satisfied by accepting unreviewable code
      structure, a compatibility layer, or unrelated product expansion.
- [ ] Only then mark the plan complete and summarize the accepted contract in
      current docs/ADR.

## Completion Evidence

- Implemented the accepted Project Cover purpose, Project-owned Asset
  destination, canonical selection, compact selected-cover projection, exact
  resource events, generic Asset File URLs, Studio Covers gallery, and
  conversation-directed media-producer guidance in the Studio and
  studio-skills repositories.
- Generated migration 0079 with Drizzle Kit, added and tested the non-null
  legacy-cover precondition, and advanced Project databases to generation 64.
- Rehearsed generation 63 to 64 on isolated Big Fish and Urban Basilica copies.
  Both completed with `PRAGMA quick_check = ok` while preserving all
  pre-existing Project, Scene, Asset, Asset File, selection, generation, and
  Trash data.
- Live verified backups:
  - Big Fish:
    `/Users/keremk/renku-movies/big-fish/.renku/project-database-backups/project-before-migration-from-generation-63-to-64-20260819T113803240Z-194691.sqlite`
  - Urban Basilica:
    `/Users/keremk/renku-movies/urban-basilica/.renku/project-database-backups/project-before-migration-from-generation-63-to-64-20260819T113951884Z-f41216.sqlite`
- Big Fish and Urban Basilica both finished at generation 64 with
  `PRAGMA quick_check = ok`. During final Project Library QA, Studio's automatic
  database lifecycle also migrated Free Willy to generation 64 and created the
  verified generation-63 backup
  `/Users/keremk/renku-movies/free-willy/.renku/project-database-backups/project-before-migration-from-generation-63-to-64-20260819T115118335Z-f4b166.sqlite`.
  The QA server is stopped. Restoring this backup over the live database is the
  only remaining completion action and requires explicit user approval because
  it overwrites a database file.
- Desktop QA covered empty, one-card, large-preview, selected, delete-confirm,
  Project-shell, Project-Library, dark, and light states. The imported QA cover
  was returned to recoverable Trash, left unselected, and Urban Basilica was
  restored as the current Project.
- Focused Core, CLI, Studio server, React, migration, service, coordination,
  hook, and card/tab tests passed. Root `pnpm build`, `pnpm test`,
  `pnpm lint`, and `pnpm check` passed; lint retains one pre-existing
  warning in `packages/studio/server/bin.ts`.
- The media-producer image-purpose validator passed for 8 routes and 14 image
  purposes, including `project.cover`; the edited skill frontmatter and sample
  were also validated. The skill-creator Python quick validator could not run
  because the bundled Python environment does not include PyYAML, so equivalent
  frontmatter validation was completed with the available YAML runtime.
- Final root-cover, raw-control, architecture-shape, formatting, complete-diff,
  and `index.ts` reviews passed. Remaining root-cover terms are confined to
  historical migrations/snapshots, the migration precondition and its tests,
  explicit removal documentation, and the 404 regression test for the deleted
  special route.

## Success Criteria

The plan is complete when a user can ask `media-producer` for a Project cover,
the agent gathers only the conversation-relevant Project/Lookbook/subject
context, creates and imports one or more focused `project.cover` candidates,
and stores them as Project-owned Assets under `covers/`. Studio shows those
candidates in a Covers tab using existing MediaCards; the user can preview,
select/clear the active cover, and move candidates to Trash. The selected Asset
File drives both the Studio sidebar and Project Library through the generic
Asset File route. No root `cover.png`, `cover_file`, automatic Project context
bundle, parallel selection model, or new media-card framework remains. Core
rejects a Cover selection before writing unless the candidate has exactly one
active `primary` image Asset File, and selected imports publish exact
covers/shell/library keys. Big Fish and Urban Basilica finish at schema
generation 64 with verified backups; Free Willy remains untouched for the
user's separate deletion.
