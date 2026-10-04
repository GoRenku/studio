# 0222 Unified Asset Files And Reference Imports

Status: complete; implemented and verified
Date: 2026-10-04

## Summary

A retained Project file has one identity: `AssetFile`. Generated media, imported
media, Inspiration images, and research references use the same record, ownership,
file-serving, and lifecycle rules. Remove the separate logical `Asset` and its
one-to-many file collection. Importing a file creates its record as part of the
same operation; users do not perform a separate registration step.

When a user opens an existing Project, Core first upgrades its database, converts
existing relationships, and records eligible files already present in its
reference folders. The Project becomes available only after both the schema
upgrade and the content backfill succeed. Existing paths and file bytes remain
unchanged. Newly dropped Inspiration images immediately work in the folder,
generation review panel, and provider inputs.

### Review Attention

- **Review follow-up authorized by the user:** every active image AssetFile can
  be edited, retaining the original and its selection. The edit keeps the source
  owner, type, locale, and authorship; Inspiration edits stay in the same folder.
  Existing purpose-specific destinations keep their naming. Other images use a
  Core-owned `assetFile.imageEdit` destination derived from the exact source file.
  Repair filename allocation after Empty Trash and missing-reference previews;
  provide the planned unregistered-file import diagnostic. No schema changes,
  new user flags, replacement policy, or automatic filesystem discovery are added.
- **This includes a database migration.** Registering currently untracked files
  alone would not require merging the tables, but removing `Asset` does. Existing
  file IDs become the canonical IDs; selections, attachments, ownership, and
  Trash references are converted to those IDs. Core creates verified database
  backups before conversion. No retained files are moved or deleted by migration.
- **Imports retain and track files together.** Inspiration drag-and-drop and
  file-picker uploads do this automatically. A focused CLI import also covers
  research references and files supplied by agents. It can adopt a file already
  in the correct reference folder without copying it or requiring another
  registration command.
- **Existing Projects upgrade automatically on open.** The existing Drizzle
  upgrade path remains the schema owner. One completion marker additionally
  protects the filesystem backfill, including a retry after SQL migration has
  succeeded but backfill has failed. Normal reads and previews stay read-only.
- **Existing Inspiration lifecycle remains usable.** Backfill recognizes folders
  already collected by Empty Trash instead of blocking Project open on their
  missing directories. Folder rename moves registered image paths and live Trash
  restoration paths together, preserving file IDs and bytes. These corrections
  preserve existing operations as images gain records; they add no public command,
  setting, lifecycle state, or migration file move.
- **Public contracts change together.** CLI `asset` commands become `asset-file`
  commands; DTOs, HTTP file URLs, generation targets/context, attachments, and
  skill examples use one file ID. Callers change directly without aliases.
  Current generation-review Settings and inline/app display routing are retained.
- **The scope is retained Project content.** Operational JSON, staging outputs,
  QA images, caches, and scratch files remain temporary. Choosing one of those
  files for durable use imports it into its appropriate retained destination.
  Inspiration remains an image collection; other file types can be retained as
  research/supporting files without adding a new Inspiration UI or media browser.
- **Direct filesystem writes have an explicit boundary.** The initial upgrade
  discovers existing reference-folder content. Afterward, new agent/Finder files
  enter the collection through the same import operation. This plan adds no
  background watcher or mutation during a folder read.
- **Assumptions and approval scope:** current real Project data has one file per
  Asset. Migration rejects an ambiguous source rather than guessing. Accepting
  this plan accepts the single-file model, command/URL changes, automatic
  backfill, and this direct-filesystem import boundary. Implementation is authorized by the implementation request; release
  publication remains separate.

## Context And Evidence

### Starting implementation

- `packages/core/src/server/schema/assets.ts` splits metadata across `asset`,
  `asset_file`, and a one-owner `asset_membership`. Selection points to `asset`.
  `packages/core/src/client/assets.ts` consequently exposes `Asset.files[]`.
- Read-only checks of Urban Basilica, Sintel, and Big Fish found exactly one file
  per Asset, including discarded rows; no duplicate file paths, absent ownership
  rows, or mismatched parent/file discard states were found. Urban Basilica has
  196 Assets and 196 files. This is evidence for the current conversion, not a
  promise that arbitrary databases have that shape.
- `commands/inspiration-commands.ts` writes an image to disk without creating a
  file record. `resources/inspiration.ts` and `files/inspiration-images.ts` list
  filesystem images separately from the Asset collection. Image deletion has a
  filename-based Trash identity.
- The same command module physically moves an Inspiration directory on rename
  and currently updates only its folder row. `trash/trash-object-registry.ts`
  retains discarded folder rows; Empty Trash moves their directories into a
  Trash package and records collection in the existing ledger. Both operations
  must remain valid when images acquire their own file records.
- The reproduced Sintel request references existing Coco images under
  `visual-language/inspiration/coco/`. The initial availability check required a
  file record and reported `CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND`. The
  present shared resolver additionally recognizes active Inspiration images.
  The user confirmed the repaired panel works; this plan replaces that dual
  eligibility model with the common retained-file model.
- `project-asset-files/` already owns retained destinations, filename allocation,
  write-set cleanup, metadata, and file persistence. Its path guard currently
  forbids `research/`, despite documentation describing research references there.
- `database/lifecycle/store.ts` already invokes Drizzle migration when a valid
  existing Project has an older schema generation. Its cache checks schema
  readiness, not filesystem backfill completion. The migration reference still
  describes manual-only upgrades and must be corrected to match the accepted
  automatic open behavior.

### Accepted constraints

- `docs/architecture/data-model-and-storage.md`,
  `docs/architecture/project-asset-storage-conventions.md`, and
  `docs/architecture/reference/project-files-and-assets.md` constrain ownership
  and storage. Their distinction between retained Assets and untracked research
  references changes with this plan.
- ADR 0013 records the original media grouping; ADR 0018 explicitly keeps
  Inspiration images outside per-image database records; ADR 0064 defines owner
  collections and canonical selection. Their affected portions need a new ADR.
- ADR 0041 keeps creative artifacts opaque. Migration and runtime may validate
  file identity, path, MIME, ownership, and deterministic envelopes; they must
  not analyze prompts, images, audio, or document prose.
- ADR 0088 and ADR 0099 preserve precise edit sources and retained Shot Plan
  generation references. Changing identity must not change source selection,
  reference roles, or canonical display choices.
- Plans 0205, 0214, 0219, 0220, and 0221 constrain retained reference import,
  compact generation context, MCP serving, review forms, and plugin routing.
  Keep their implemented workflow behavior while replacing file identities.
- `docs/architecture/reference/drizzle-migrations.md` and
  `docs/architecture/project-database-distribution.md` own migration packaging,
  schema-generation checks, backups, and recovery.
- Studio Skills live in `/Users/keremk/Projects/aitinkerbox/studio-skills`.
  Changes cover shared workflows and their consumers, not only Lookbook Designer.

### Requirements ledger

| Requirement | Source | Owning behavior and verification |
| --- | --- | --- |
| One retained-file type and identity | User's explicit simplification | Unified schema/DTO; migration and selection tests |
| Inspiration and generic references work across purposes | User's reference complaint and broader-scope correction | Common Core resolution; image/audio/video/document coverage within supported consumers |
| Drop/picker import requires no registration step | User's explicit upload requirement | Core write plus record; desktop upload/review journey |
| Existing Projects automatically upgrade schema and contents | User's explicit migration requirement | Project-open readiness; backup, retry, and no-partial-open tests |
| Open Projects whose Inspiration folders were already collected by Empty Trash | Accepted review finding | Backfill checks existing folder Trash collection metadata; Core upgrade test |
| Rename populated Inspiration folders without breaking file access or image restoration | Accepted review finding | Core rename coordinates directory, file paths, and live Trash paths; preservation and rollback tests |
| Preserve file bytes, paths, relationships, selection, provenance, and Trash | Data-integrity boundary | One-way mapping and preservation tests on copied Projects |
| Temporary files remain operational until retained | Existing storage rules | Focused import promotion; no whole-Project scan or preview-side mutation |
| Core owns durable rules; artifacts remain opaque | Hard architecture rules | Owning-layer tests and thin adapter/import-boundary checks |

### Chosen approach

Keeping the current contract unchanged leaves filesystem references on a second
path. Extending it only to register Inspiration/research files would fix reference
availability but retain the grouping the user asked to remove. Refactor the
existing Core ownership and file-persistence modules around one `AssetFile`.
Reuse destinations, selections, and Trash rather than adding a parallel catalog.

Folders, Lookbooks, Shots, Takes, and other domain collections remain meaningful
organization. Removing the media wrapper does not remove those relationships or
make every file eligible for every selection target.

## Product Behavior

1. **Open an older Project:** create the existing verified SQLite backup; apply
   shipped Drizzle migrations; backfill retained reference folders; check database
   integrity and completion; then return/cache the usable Project. Failure reports
   structured issues and backup location without publishing a partial session.
   A directory absent because its discarded folder was already collected by Empty
   Trash does not block open or cause content to be recreated.
2. **Drop several Inspiration images or use the picker:** each successful file
   import writes bytes and creates one folder-owned record before reporting
   success. The existing batch UI reports individual failures, refreshes the
   folder, and shows successful images immediately. No extra user action follows.
3. **Import a research reference:** one command accepts a Project-relative source,
   retains it under `research/`, and returns its `AssetFile`. An already correctly
   located file is adopted in place. Supported file kinds include images, audio,
   video, models, text, JSON, documents, and opaque files; consumer/provider support
   still determines whether a particular file can be used as a generation input.
4. **Use a reference:** its unchanged Project-relative path works with the current
   local-file request envelope. Core resolves the active `AssetFile`, checks actual
   filesystem availability and containment, and supplies the same bytes to review,
   inspection, and provider preparation. Purpose and owner do not create special
   reference-source allowlists. Provider input-kind/count constraints still apply.
5. **Discard/restore:** a file uses common file Trash lifecycle. Discarding an
   Inspiration folder hides its records through owner lifecycle and restores them
   with the folder; individually discarded images stay discarded. Research files
   have the same file lifecycle. Selecting a file for one generation does not
   alter the owner's canonical display selection.
6. **Create an edit or another output:** the resulting file gets its own identity.
   Provenance and purpose relationships connect it to its source; it does not
   become another physical file inside a logical Asset. Cached thumbnails and
   transport uploads are operational derivatives, not extra retained records.
7. **Rename an Inspiration folder:** preserve the existing directory move and
   update its registered image paths, including individually discarded images
   still stored there. File IDs, bytes, and discard state remain unchanged;
   thumbnails, file serving, subsequent reference requests, and image restoration
   use the new paths. Saved authored requests and provenance remain unchanged.

No change to provider choice, approval policy, creative prompt ownership,
generation-review display mode, filename conventions for existing destinations,
or the image-only Inspiration interface is included.

## Architecture Shape Gate

### Ownership and module layout

All durable rules remain in `packages/core`. Existing modules are refactored,
not fronted by compatibility wrappers.

| Module | Responsibility and intended change |
| --- | --- |
| `core/src/client/asset-files.ts` | Unified public contracts; replaces `client/assets.ts` directly |
| `core/src/server/schema/asset-files.ts` | Unified file and selection schema; replaces `schema/assets.ts` |
| `core/src/server/asset-files/` | Refactor existing `server/assets/` into focused ownership, metadata, projection, resources, selection, owner-key, and selection-target modules |
| `core/src/server/database/access/asset-files.ts` | File queries with ownership on the file row; replace separate Asset/membership access and update selected-file access |
| `core/src/server/project-asset-files/` | Existing physical-file storage owner; retain write-set, persistence, path allocation, naming, and focused destinations |
| `core/src/server/project-asset-files/destinations/inspiration.ts` and `research.ts` | The two newly retained destinations, registered in the existing destination registry |
| `core/src/server/reference-files/` | `commands.ts` owns focused batch import; `sources.ts` classifies exact in-place versus copy inputs; `persistence.ts` commits reference records using existing file-write primitives; `index.ts` exposes this bounded API |
| `core/src/server/database/lifecycle/asset-file-backfill/` | `candidates.ts` discovers the bounded reference trees and uses existing Trash metadata to distinguish collected folders from missing required directories; `persistence.ts` commits rows and completion; `index.ts` composes this one-time lifecycle task |
| `core/src/server/database/lifecycle/store.ts` | Thin schema/backfill readiness orchestration; uses existing migrator and backup owner |
| `core/src/server/media-generation-review/reference-files.ts` | One active-file resolver; remove the filesystem-only Inspiration exception |
| `core/src/server/commands/inspiration-commands.ts` and `resources/inspiration.ts` | Delegate imports/lifecycle and project registered folder files; rename coordinates directory movement and focused folder/file/Trash path updates through Core database access modules; no independent filesystem catalog |
| `cli/src/commands/asset-file/` | Separate command parsing/handlers and formatting; replaces broad `asset-command.ts`, adds focused reference import |
| `studio/server/routes/asset-files.ts` | Thin file-list/serve adapters; replaces the relevant `routes/assets.ts` file contracts |
| `studio/server/routes/visual-language.ts` | Thin folder/upload adapters; calls Core for image import and lifecycle |

Paths above are relative to `packages/`. Existing purpose-specific attachment
modules stay in their domain folders. Do not collect Cast, Location, Lookbook,
Shot, dialogue, Previs, and provider cases in the file module.

### Public entrypoints and composition

- Review follow-up shape: `image-edit-attachments/continuation-registry.ts`
  retains existing destination resolvers and uses source-folder persistence for
  other image types. `project-asset-files/destinations/asset-file-image-edit.ts`
  owns that focused destination in the existing typed registry. The shared
  destination registry reserves discarded as well as active paths.
  `media-generation-review/reference-files.ts` distinguishes available, missing,
  and untracked references; `local-media.ts` projects warnings or serving errors.
  These rules stay in Core, with no adapter checks or new persistence abstraction.
- Existing intentional `core/client` and `core/server` package entrypoints export
  the new contracts and focused service functions directly. Public
  `ProjectDataService` remains the adapter entrypoint; its
  `project-data-service-wiring/asset-files.ts` only binds focused operations.
- Module `index.ts` files contain exports or shallow composition. Backfill's
  `index.ts` orchestrates discovery/transaction completion without embedding file
  scanning, SQL conversion, metadata extraction, or error-formatting logic.
- Extend the existing typed destination registry for two reference destinations.
  Owner validation stays in Core owner/selection modules. Preserve the existing
  purpose-specific attachment organization and CLI structured-command registry.
- The backfill is one named task, not a general filesystem migration registry.
  Drizzle remains the sole SQL migration runner. No historical model readers,
  arbitrary state-patch API, or runtime SQL migration strings are introduced.

### Required removals and stop conditions

Remove the logical `Asset` DTO/table/access functions, nested `files[]` projections,
membership table, parent-ID arguments, and filename-addressed Inspiration image
identity. Update callers directly, including fixtures and skill code. Retain no
old command aliases or re-export facade files. Migration SQL/tests and historical
decision records may mention the source schema solely for one-way conversion.

Stop and revise before continuing if a file becomes a cross-domain dispatcher,
if routes/CLI/React choose ownership or reference eligibility, if preview starts
registering files, or if SQL migration/backfill requires preserving two runtime
models. Passing tests does not waive this gate.

## Contracts

### Unified file record and relationships

`AssetFile` combines the current authored metadata and physical metadata:

- `id`, `owner: AssetFileOwner`, `localeId`, `type`, `availability`, `mediaKind`;
- nullable authored `title`, `oneLineSummary`, `referenceName`; required `tags`
  (`string[]`, default `[]`) and `origin` using the current values;
- `generationProvenance`, `authoredFrom`, `createdAt`, `updatedAt`;
- `projectRelativePath`, `mimeType`, `sizeBytes`, `contentHash`, `width`, `height`,
  `durationSeconds`.

There is no parent ID, nested file array, or collection-level `role`. Purpose
types and existing explicit domain reference roles keep their meaning. Titles
are nullable so new references do not require invented filename-derived card
copy. Preserve all current authored metadata exactly during conversion.

The `asset_file` table stores these fields, current discard lifecycle columns,
and required `owner_key` directly. Keep the weak Shot Plan/Previs links and locale
FK semantics. Add a unique normalized `project_relative_path` constraint across
active and discarded rows and owner/type/locale indexes for current list queries.
Use path identity, not content hashes, for deduplication: identical bytes at two
different retained paths are two files. A discarded path cannot be silently
reused or reactivated by import.

`AssetFileOwner` retains Project, Cast Member, Location, Prop, Scene, Scene Beat,
Lookbook, and Shot variants and adds `{ kind: 'inspirationFolder'; id: string }`.
General research references belong to Project. Types for newly tracked content
are `inspiration_image` and `research_reference`. `AssetFileSelectionTarget`
retains today's targets; Inspiration/research imports do not add display slots.

`selected_asset_file` maps existing `target_key` values to `asset_file_id`.
Remove `asset_membership` because its one-owner key now lives on the file.
Convert file relationships in Lookbook images/sheets, Cast voice samples,
supporting files, Shot images, dialogue audio, Clip Takes, Location Worlds,
Previs outputs, edit sources, and all existing selections to one `assetFileId`.
Rows currently carrying both IDs keep only the canonical file ID. Domain IDs
such as image placement IDs, Take IDs, and Shot Plan IDs remain distinct.

The concrete SQL relationship inventory is `lookbook_image.asset_id`,
`lookbook_sheet.asset_id`, `cast_voice.sample_asset_id`,
`shot_plan_previs_revision.asset_id`, and `selected_asset.asset_id`, which map
through the parent-to-file mapping. `shot_plan_clip_take`,
`shot_plan_dialogue_audio_take`, and `screenplay_import` already carry file IDs;
preserve those and remove their redundant parent-ID columns. Their owning schema
modules and unique indexes change in the same slice.

Trash uses `itemKind: 'assetFile'` for file-only records, including Inspiration
images. Keep domain attachment kinds such as Lookbook image and dialogue Take;
their restoration snapshots use `assetFileId` or `sampleAssetFileId`. Common file
Trash entries use the authored title when supplied and quiet empty title copy
otherwise; the existing original-path metadata remains available for inspection.

`PrevisDialogueAudio` contains `assetFileId` and optional `offsetSeconds`.
Current stored playback artifacts already contain that file ID. Playback resolves
it directly, without a parent lookup, while preserving source/playback bytes and
hashes. The decoder projects the fields of the current envelope only; it neither
rewrites the authored artifact nor recognizes an old parent field as a runtime
concept. New skill-authored playback examples use only the current envelope.

### Core reads, commands, and projections

- `listAssetFiles`, `listAssetFilePage`, `updateAssetFile`, `selectAssetFile`,
  `clearAssetFileSelection`, `discardAssetFile`, and `restoreAssetFile` replace
  the corresponding parent-Asset operations. `AssetFilePage` contains `items`,
  `nextCursor`, and `selectedAssetFileId`. Mutation reports return `assetFile`
  or `selectedAssetFileId` and existing resource invalidations.
- `resolveProjectAssetFileById` accepts only Project plus `assetFileId`.
  Path-addressed generation resolution uses the same file eligibility, owner
  lifecycle, actual-file, and realpath checks. Preserve safe byte/MIME serving,
  range behavior, and preview URL redaction.
- `ImportReferenceFilesInput` contains Project/config context,
  `destination: { kind: 'inspiration'; folderId: string } | { kind: 'research' }`,
  and `files: { sourceProjectRelativePath: string; title?: string }[]`.
  `importReferenceFiles` returns `ReferenceFilesImportReport` with `assetFiles`,
  warnings, Project identity, and resource keys. Source paths and destinations
  are validated by Core. It is a focused import, not arbitrary row registration.
- `writeInspirationImage` retains its upload intent and automatically persists
  an `AssetFile`. `deleteInspirationImage` addresses `assetFileId`; Core validates
  folder membership. `InspirationFolderResource.images` and `cardImage` use
  `AssetFile[]` and `AssetFile | null`; remove `InspirationImage`.
- Generation target `{ kind: 'asset'; assetId }` becomes
  `{ kind: 'assetFile'; assetFileId }`. `MediaGenerationContextReport.assetFiles`
  replaces `assets`, with `MediaGenerationAssetFile` omitting provenance as today.
  Reference candidates contain only `assetFileId`; subject collections use
  `assetFileIds`, voice samples use `sampleAssetFileId`, and Shot images use
  `imageAssetFileIds`. Keep reference roles and selection/availability flags.
- Attachment inputs use `assetFileMetadata`; reports return `assetFile` and
  domain attachment IDs. Edit-source destinations take `sourceAssetFileId` only.
  Current local `$file` paths and their exact authored labels remain unchanged;
  do not replace them with embedded media or parse provider creative payloads.

### Imports, collisions, and filesystem boundaries

Reuse existing filename allocation for new copies. Never overwrite an existing
file from an Inspiration upload: allocate a distinct safe name when required.
Registration uses the final committed path. A file already within its requested
reference destination is adopted in place; an active record with the same owner
and unchanged file facts is returned without duplicates. Changed bytes, a
different owner, or a discarded record produce a conflict, not implicit update
or restoration. This plan does not add a file replacement workflow.

The focused batch CLI import is atomic for its requested set. Stage new copies,
validate all envelopes, commit rows, and clean up only copies created by that
attempt if the transaction fails. Never remove an adopted source. The existing
Studio upload batch remains individual-file success/failure, because it invokes
one upload operation per file.

Inspiration imports accept the current supported image formats. Research
imports accept existing `ProjectMediaKind` variants, including opaque `file`,
without semantic document validation. Readiness/discovery is confined to stored
Inspiration folder paths and `research/`. Do not scan `.renku`, `tmp`, export
trees, or arbitrary Project directories; screenplay/analysis/design JSON stays
with its existing document owner. Do not follow symlinks or accept paths escaping
the Project or their requested destination. Gather actionable path issues before
failing. No MIME/extension restrictions beyond the existing destination/consumer
contracts are invented for generic retained files.

### Inspiration folder rename

Extend the existing `renameInspirationFolder` command without changing its public
input or report. Resolve the exact folder owner and affected file records through
Core; path suffixes determine relocated paths only after ownership is established.
Prepare and validate destination containment and normalized-path uniqueness before
moving the directory. Include active images and individually discarded images
whose files remain in that directory.

Move the directory outside the SQLite transaction, then commit the folder's
name/path, affected file paths, and live image Trash original-path/restoration
fields together in one short transaction. Preserve file IDs, metadata, bytes,
hashes, ownership, and discard state. Keep collected Trash package paths and
historical collected entries unchanged. Do not rewrite authored requests,
provenance, or creative documents to substitute new paths.

If the directory move fails, leave database metadata unchanged. If the database
transaction fails after the move, roll back that transaction and move the directory
back before reporting failure. Report any rollback failure through existing
structured diagnostics with the affected paths. Successful rename invalidates
the existing Inspiration folder/list resources so consumers read the new paths.

### CLI and HTTP adapters

The CLI uses these deliberate names, with ordinary human and `--json` output:

```text
renku asset-file list --project <name> --owner <owner> [--type/--media-kind/--locale/--limit/--cursor]
renku asset-file update <file-id> --project <name> [--title/--summary/--reference-name/--tag/--clear-tags/--locale]
renku asset-file select --project <name> --target <target> --asset-file <file-id>
renku asset-file clear-selection --project <name> --target <target>
renku asset-file import --project <name> --source <relative-path> --owner project|inspirationFolder:<id> [--title <title>]
renku asset-file import --project <name> --file <batch-import.json>
```

The batch document is the `destination` and `files` subset of
`ImportReferenceFilesInput`. `--file` is mutually exclusive with single-source
flags. Core owns destination eligibility; CLI only parses/translates input.
Keep `media import` and existing domain discard/restore operations; change their
IDs/results directly. Clip Take assignment requires only `--asset-file`, and
generation/edit targets use `assetFile:<id>`. Document every changed executable
example in the sister Skills project.

Under `/studio-api/projects/:projectName`:

- `GET /asset-files` replaces generic Asset listing; retain existing filters.
- `GET /asset-files/:assetFileId` serves the exact file without a parent ID.
- Existing Cast/Location/Prop collection and discard routes change their
  `assets` segments to `asset-files` and take one file ID; responses use
  `assetFiles` and the page contract. Their focused upload endpoints keep intent.
- Inspiration `POST /visual-language/inspiration/folders/:folderId/images`
  retains upload filename input. Image discard takes `:assetFileId`. Image GET
  URLs use the common file-serving route; delete the special filename GET path.

Do not add an unused generic HTTP import UI. Current upload routes remain thin
byte adapters. The Studio API, Codex MCP projections, panel cards, inspectors,
and application media URLs all use the canonical file contract.

### Structured diagnostics

Reuse existing Core path/source/destination-conflict errors and
`CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND`. Add only:

- `PROJECT_ASSET_FILE_REFERENCE_NOT_TRACKED`: an existing referenced file has not
  been imported into the retained collection; include its safe Project-relative
  path and focused import guidance. Missing/discarded files retain their existing
  availability diagnostics.
- `PROJECT_ASSET_FILE_BACKFILL_FAILED`: initial content backfill could not finish;
  include aggregated per-path issues and available backup context.

Source-schema ambiguity is reported as an existing migration failure, with
conversion issues and backup context. Do not introduce runtime diagnostics that
recognize historical Asset layouts. Package-boundary errors use
`@gorenku/studio-diagnostics`; adapters preserve structured codes/issues.

## Automatic Migration And Content Backfill

### Schema and relational conversion

Use Drizzle TypeScript schema changes and the existing package-owned Drizzle Kit
generation/application workflow. Consult the official
[generation documentation](https://orm.drizzle.team/docs/drizzle-kit-generate),
[custom migration documentation](https://orm.drizzle.team/docs/kit-custom-migrations),
and [migration documentation](https://orm.drizzle.team/docs/drizzle-kit-migrate).
Generated SQL, snapshots, and journal stay in `packages/core/drizzle/`.

This conversion requires a documented custom preservation step: a structural
diff alone cannot merge authored metadata and translate all existing references
before dropping the parent tables. Document that exception in the migration
reference before editing generated SQL. Preserve the generated final schema
snapshot; any extra custom data migration is created through `generate --custom`.
Do not put SQL strings or a second migration registry in TypeScript.

The one-way SQL conversion must:

1. Validate exactly one file and owner per source Asset, no duplicate normalized
   paths, consistent discard state, and unambiguous relationship mappings before
   destructive changes. Abort transactionally on a conflict; never choose a
   primary file, split a compound Asset, or drop an empty Asset silently.
2. Build the old-parent-ID to existing-file-ID mapping. Preserve file IDs and
   physical metadata; copy authored metadata, ownership, provenance, weak links,
   and lifecycle into the unified row. Use the source Asset's `created_at` and
   `updated_at` for authored-record history; file bytes, paths, and filesystem
   timestamps remain unchanged.
3. Convert all foreign keys and deterministic ID envelopes, including selected
   files, Lookbook placements, audio/Takes, edit sources, supporting files,
   resource keys, and Trash restoration snapshots. Translate parent-based keys
   only through exact mapping. Convert source Asset Trash IDs and snapshot
   `assetId`/`sampleAssetId` fields through that mapping. Convert filename-based
   Inspiration Trash identities through exact stored folder/path metadata, with
   one file ID per path across repeated historical operations. Create any needed
   discarded image file row with nullable physical metadata before disk backfill;
   even a missing or garbage-collected image retains its history. All recognition
   of source-schema Trash names stays in this one-way SQL conversion, not current
   runtime lifecycle handlers. Keep creative JSON, prompt text, provider request
   bodies, and historical external execution receipts untouched. Migration of
   application-owned document envelopes is limited to known ID fields, not a
   recursive search-and-replace of arbitrary JSON.
4. Preserve children during SQLite parent rebuilds with foreign keys enabled.
   Do not rely on `PRAGMA foreign_keys=OFF` inside Drizzle's transaction.
5. Drop retired parent/membership structures; add current indexes/constraints;
   advance `user_version` to the next generation derived from shipped migrations.
   Check `foreign_key_check` and `quick_check` before Project readiness.

If an application-owned persisted JSON envelope references a parent ID, include
its exact current schema in the conversion inventory before SQL generation.
Do not let a typed DTO rename imply that old persisted JSON automatically changed.
Any required filesystem envelope conversion must be documented with its owning
command/storage module and backed-up source; stop and revise this plan before
adding file rewrites, because this plan's migration preserves file bytes.

### Filesystem data completion

Add internal `project.asset_file_backfill_version` (integer, default `0`). Version
`1` means this bounded backfill completed. This is separate from schema generation
because a SQL migration cannot discover disk files and can succeed before disk
backfill finishes. New Project creation initializes completion after establishing
the empty retained collection. It is not a public setting or user-visible mode.

Extend `openProjectStore` readiness after schema validation and before session
publication/caching, including cached-session validation. The explicit
`renku project migrate <name>` operation finishes the same backfill as automatic
open. Keep the existing synchronous lifecycle contract; one-time discovery uses
focused filesystem/metadata functions, not an unrelated async lifecycle redesign.

When completion is pending:

1. Use the verified backup created for SQL conversion. If SQL is already current
   and a data-only retry is needed, use the same backup owner to create a new
   verified backup before new writes; preserve earlier backup artifacts. No
   automatic restore is added.
2. Discover regular files in registered Inspiration folders using their current
   flat image policy, including discarded folders, and recursively in `research/`.
   Exclude the known Inspiration analysis document, which stays a domain document.
   For a discarded folder whose current discard operation has a matching folder
   Trash entry marked garbage-collected, preserve the existing folder/history and
   skip discovery at its original path. Empty Trash already moved that directory;
   do not recreate it, scan its Trash package, or register its collected bytes as
   active content. An unrelated older collected operation is not sufficient.
   Missing/unreadable required directories for active or not-yet-collected folders
   still fail with located issues. An absent optional `research/` tree means an
   empty reference collection.
3. Resolve candidates safely and compute ordinary file facts with existing helpers.
   Reuse a matching file record instead of creating duplicates. Compare owner,
   path, and lifecycle against the mapped database data; fail on conflicts. Do not
   interpret image content, provider prompts, research prose, or analysis contents.
4. Include the canonical discarded image rows created by SQL conversion, even
   when no file is found on disk. Hydrate physical metadata only where bytes exist;
   preserve discard operation, original path, and restoration relationships.
   Newly discovered files under discarded folders remain hidden by owner lifecycle.
   Missing retained files keep their records and fail normal availability checks
   rather than being deleted or resurrected.
5. Commit all discovered records, physical metadata updates, and completion `1` in one
   transaction after rechecking completion under the SQLite write lock. On error,
   leave completion pending and expose no Project session. A retry is idempotent.

Use existing SQLite serialization/timeout behavior for concurrent opens; do not
invent a new lock service. Two openers recheck completion under transaction and
cannot create duplicate records. Schema succeeds/backfill fails is an explicitly
tested state: a later open retries backfill even at the latest `user_version`.
Completed Projects perform a cheap readiness check and no repeated filesystem
scan, hashing pass, backup, or content mutation.

## Implementation Slices

The implementation inventory is recorded in
[`0222-conversion-inventory.md`](./0222-conversion-inventory.md). Completed
discovery tests do not establish Project readiness: SQL conversion, atomic
record persistence/completion, and open-path integration remain required.

1. **Contracts and conversion inventory.** Map schema FKs, application-owned ID
   envelopes, DTOs, routes, resource notifications, CLI examples, and skill
   consumers. Establish the unified contracts and the Architecture Shape Gate.
   Document custom SQL necessity before generation. No fixture-only identities
   or unexamined parent references may survive the inventory.
2. **Unified file domain and schema.** Refactor `client/asset-files.ts`,
   `server/asset-files/`, schema/access/wiring, selection, metadata, attachment
   projections, and file persistence together. Generate the preservation-aware
   Drizzle migration and focused migration tests. Keep domain-specific attachments
   in their existing owners rather than moving them into a catch-all file service.
3. **Automatic readiness and backfill.** Add the bounded lifecycle folder and
   completion field; wire open/create/cache/explicit migration through readiness.
   Use existing folder Trash collection metadata to exclude already-collected
   directories while retaining failures for missing required directories.
   Reuse backups and structured errors. Verify interrupted upgrade, idempotence,
   integrity, and Trash preservation on copies before touching a populated Project.
4. **Reference ingestion and Inspiration lifecycle.** Add the two focused
   destinations and reference-import module. Make byte uploads automatically
   persist folder-owned records; project Inspiration from the file collection;
   use common discard/restore. Preserve existing upload batch and folder behavior.
   Extend folder rename with the coordinated path updates and rollback defined
   above, keeping that behavior in Core and preserving authored artifacts.
5. **Reference resolution and generation consumers.** Remove the direct-folder
   eligibility branch; wire preview, inspection, provider preparation, native
   Codex image references, generation context, and import/edit reports to one
   identity. Keep provider request envelopes and creative artifacts opaque.
6. **CLI, HTTP, Studio, and MCP adoption.** Change names/URLs/IDs directly. Update
   folder cards, gallery/detail panels, profile/hero/cover displays, Lookbook
   placements, Shot images, Clip Takes, dialogue audio, Previs, world files,
   supporting-file attachments, inspectors, selection controls, and Trash.
   Preserve review-panel tabs, thumbnails, approval/submission, inline/app routing,
   MIME serving, and exact source selection. No new Settings or general media UI.
7. **Skills and documentation.** Adopt shared file/reference workflow guidance
   across the sister repository, regenerate contract fixtures/evals, and add the
   new ADR with narrow notices on older decisions. Preserve provider-specific
   prompting research and unrelated skill edits.
8. **Built-runtime acceptance.** Complete required checks, rebuild all affected
   packages, and exercise a fresh CLI/MCP process plus the desktop panel. Source
   tests alone do not prove that the installed runtime is serving new contracts.

## Tests And Guardrails

### Core owns the full behavior matrix

- Migration preserves IDs, exact metadata/provenance, paths, selections, locale,
  authored links, attachments, discarded children, and Trash restore behavior;
  transactionally reject ambiguous cardinality, duplicate paths, and conflicting
  lifecycle/ownership. Test the generated/custom SQL with foreign keys enabled.
- Open old and already-current-but-pending databases; verify backup-before-write,
  SQL-success/backfill-failure retry, completed fast path, new Project creation,
  cached-session readiness, and concurrent-open deduplication. Report located
  failures without publishing a usable partial Project.
- Backfill active/discarded Inspiration files and mixed/nested research files;
  preserve bytes and paths; exclude owned analysis documents and temporary/internal
  trees. Verify missing known files keep identity but remain unavailable.
- Upgrade a Project after Inspiration folder discard and Empty Trash: its original
  directory is absent, history stays collected, backfill completes, and Project
  open succeeds without recreating content. Verify an older collected operation
  does not excuse a missing directory for the current discard; missing active or
  not-yet-collected required directories still fail with located issues.
- Rename a populated Inspiration folder with active and individually discarded
  images; preserve IDs, hashes, lifecycle, authored requests, and provenance.
  Verify file serving and subsequent reference resolution at the new paths,
  image restoration through updated live Trash paths, and unchanged collected
  history. Inject directory-move and database-commit failures and verify rollback
  leaves the original directory and metadata consistent; locate rollback failures.
- Import byte uploads, in-place sources, and temporary-source copies; verify
  collision allocation, same-path idempotence, changed-byte/owner/discard conflicts,
  invalid folder/type/path inputs, aggregate validation, and failure cleanup that
  never removes source files.
- Resolve retained images, audio, video, models/documents where consumers support
  them, across owners/purposes. Cover missing/untracked/discarded files, discarded
  owner folders, containment/symlink rejection, and exact review/execution bytes.
  Preserve provider constraints and side-effect-free previews.
- Selection rejects invalid owner/type/locale assignments before writes; generation
  reference selection leaves canonical display selection unchanged. Verify an edit
  creates a distinct file with its exact source relationship.

### Adapters, UI, and architecture

- CLI tests cover new command/flag parsing, batch-document envelope, formatting,
  resource events, single-ID targets, and structured failures. Server tests cover
  delegation, ID/URL projection, MIME/range serving, and error serialization.
  Do not repeat Core's invalid-state matrix at these layers.
- Studio tests cover upload success/partial failure, quiet image cards, refreshed
  counts/card images, selected media rendering, discard/restore, and reference
  thumbnails. A representative desktop journey verifies several newly dropped
  images appear immediately in generation review.
- MCP/installed-package tests exercise actual served review resources and reference
  bytes after opening a Project that required conversion/backfill.
- Keep architecture checks focused on import boundaries, absence of adapter DB
  mutations, read-only preview behavior, and invalid-before-write domain behavior.
  No source-string checks for private helper names or full command inventories.
- Sister-skill evals prove an agent can use Inspiration and generic references for
  multiple purposes, resolves a single file identity, imports chosen temporary
  derivatives once, and preserves review/approval/execution/attachment steps.

## Documentation And Skills

Add `docs/decisions/0107-unify-retained-project-media-as-asset-files.md` when this
direction is accepted. Add concise discoverability notices to ADRs 0013 and 0018
for grouping/filesystem-only Inspiration supersession, and narrow the affected
identity portions of ADRs 0064, 0088, and 0099 without rewriting historical bodies.

Update the current data/storage references named in Context, migration and
database-distribution docs, CLI usage/docs, generation-reference docs, and current
media/Trash/UI contracts. Correct the manual-only migration wording while naming
the Core open readiness owner. Document collected-folder backfill handling and
folder rename's stable IDs, coordinated paths, and unchanged authored artifacts
in the current storage and Inspiration/Trash contracts. Do not perform
historical-plan naming sweeps.

In `/Users/keremk/Projects/aitinkerbox/studio-skills`, update:

- `skills/media-producer/SKILL.md`, `references/workflow.md`, shared reference-input
  guides, generation-context scripts/fixtures, review request schemas/examples,
  image/edit/audio/video purpose guides, and contract evals;
- `skills/lookbook-designer` and `skills/inspiration-analyzer` for registered folder
  file enumeration and references, replacing the present Inspiration exception;
- `skills/casting-director`, `skills/production-designer`, and
  `skills/location-world-producer` for selection, edit, hero/profile/world IDs;
- `skills/shot-planner`, `skills/blender-shot-planner`, and their Shot Plan media
  guides for single-ID derivatives, dialogue audio, Previs, and Clip Take imports;
- `skills/screenplay-supporting-material-importer` and movie coordination guidance
  where attachment/import results are consumed;
- executable contracts/examples in provider skills that consume import results
  or reference identities. Retain researched provider/creative guidance unchanged.

Keep common ingestion/resolution instructions in Media Producer/shared references.
Purpose skills refer to that owner instead of reproducing the same eligibility
rules. Agent download/import workflows use one coarse import for a file set;
directly writing a folder is not presented as completing an import.

## Final Verification

Run from the Studio root after implementation:

```bash
pnpm build
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
```

Run `pnpm test:media-generation` from the sister Skills root. Use focused Core,
CLI, Studio, and Codex tests during slices; the final cross-package run is required
because schema, DTOs, routes, runtime packages, and skills all change.

Use isolated copies of `/Users/keremk/renku-movies/urban-basilica` for broad
relationship/selection/Trash verification and `/Users/keremk/renku-movies/sintel`
for the reproduced Coco references. Open each through the real automatic path;
verify backup artifacts, completion, exact paths/hashes, counts, and database
integrity. Reopen without new writes/backups. Inject a backfill failure on a copy,
then repair the cause and prove the next open resumes correctly.

Launch a newly built CLI and fresh `renku studio mcp` process using the product's
normal package/install path. Verify installed schema/SQL shipping. Open the
Sintel review with all three original reference paths and confirm actual image
content, not merely `available: true`. Drop a new image set through Studio and use
it immediately in another purpose's panel. Verify research image plus supported
audio/video reference preparation, and document unsupported preview kinds
according to the existing consumer contract. Rebuilding/restarting an old process
is a development acceptance step, not a user migration prerequisite.

Inspect `git diff --stat` and the complete diff across both repositories. Inspect
new/heavily changed modules, all `index.ts` files, migrations, and route/command
dispatchers. Confirm no formatting churn, compatibility facades, adapter-owned
business rules, monolithic Core implementation, or semantic artifact validation.
No release publication or destructive source-project cleanup is part of this plan.

## Completion Checklist

### Review Area And Architecture Shape

- [x] Accept the Review Attention choices and retained-versus-temporary boundary.
- [x] Complete the schema/FK/JSON-envelope/route/skill consumer inventory.
- [x] Confirm every implementation concept maps to the requirements ledger.
- [x] Verify module ownership/layout against the Architecture Shape Gate.
- [x] Keep entrypoints thin and split unrelated destination/domain branches.
- [x] Confirm Core owns persistence, lifecycle, eligibility, and selection rules.
- [x] Preserve opaque prompts/artifacts and existing provider/review policy.

### Unified Contracts And Relationships

- [x] Introduce the complete `AssetFile` and owner/page/mutation contracts.
- [x] Merge metadata/owner/lifecycle onto `asset_file`; remove parent and membership.
- [x] Add normalized-path uniqueness and required collection indexes.
- [x] Preserve existing selection-target semantics through `selected_asset_file`.
- [x] Convert every domain FK and deterministic envelope to canonical file IDs.
- [x] Update edit targets, attachment results, metadata inputs, and resource keys.
- [x] Resolve Previs audio by file ID while preserving stored playback/source bytes.
- [x] Flatten generation context/candidates/subject IDs without losing selection flags.
- [x] Remove obsolete DTOs, nested files, parent-ID inputs, and runtime import paths.

### Migration And Project Readiness

- [x] Document custom SQL preservation before generating migrations with Drizzle Kit.
- [x] Include generated SQL, journal, snapshots, and derived schema-generation advance.
- [x] Guard cardinality/path/owner/lifecycle conversion before destructive SQL.
- [x] Preserve children and relationships with foreign keys enabled.
- [x] Add the bounded completion field and empty-new-Project initialization.
- [x] Discover eligible reference folders without moving or changing existing bytes.
- [x] Exclude already-collected folders using their current discard's Trash entry;
      retain history without recreating content or ignoring missing required directories.
- [x] Convert filename-based image Trash entries without resurrecting discarded media.
- [x] Make backfill/marker commit atomic and retry idempotent.
- [x] Apply full readiness to automatic open, cached sessions, and explicit migration.
- [x] Verify backup-before-write, located failure reporting, and no partial-session exposure.
- [x] Preserve fast completed opens and existing manual backup recovery behavior.

### File Ingestion And Resolution

- [x] Add focused Inspiration/research destinations to the existing storage registry.
- [x] Persist every successful picker/drop upload as a folder-owned file automatically.
- [x] Implement atomic batch reference import and safe in-place adoption.
- [x] Preserve collision allocation, path containment, and write-set cleanup guarantees.
- [x] Reject changed/foreign/discarded-path conflicts without implicit replacement.
- [x] Project Inspiration/card counts from registered files and owner lifecycle.
- [x] Use common file discard/restore and exact folder membership validation.
- [x] Coordinate populated-folder rename with file paths and live image Trash paths,
      preserving IDs/bytes/lifecycle/authored artifacts and collected history.
- [x] Roll back the directory move if rename metadata cannot commit; report located failures.
- [x] Resolve preview, inspection, serving, and provider/native execution from one record.
- [x] Remove the filesystem-only Inspiration eligibility branch.
- [x] Retain read-only previews and explicit promotion of chosen temporary files.

### CLI, HTTP, Studio, And MCP

- [x] Adopt the named `asset-file` commands and batch import document/flags.
- [x] Update media/Clip Take/edit examples and outputs to one file ID.
- [x] Replace parent/filename file URLs with common canonical file serving.
- [x] Update collection/discard adapters and preserve structured diagnostics/events.
- [x] Update folder cards, galleries, inspectors, selectors, and Trash interactions.
- [x] Update cover/profile/hero/Lookbook/Shot/audio/Take/Previs/world/supporting consumers.
- [x] Preserve upload partial-success behavior and meaningful/quiet UI copy.
- [x] Preserve reference thumbnails, MIME/range behavior, review tabs and submission.
- [x] Preserve Settings, approval behavior, and inline/app routing in served MCP panels.

### Tests And Guardrails

- [x] Cover transactional SQL conversion and data-preservation/rejection cases in Core.
- [x] Cover historical Trash path mapping, missing/collected images, and Previs audio.
- [x] Cover pending/completed/create/cache/concurrent readiness and interrupted retry.
- [x] Cover mixed-file backfill, discarded content, bounded discovery, and missing files.
- [x] Cover upgrade after folder Empty Trash and rejection of missing required directories,
      including a nonmatching older collected operation.
- [x] Cover populated-folder rename, active/discarded file access and restoration,
      collected history preservation, and move/commit/rollback failures in Core.
- [x] Cover upload/import/adoption/collision/conflict/cleanup behavior at the owner.
- [x] Cover exact reference bytes, supported kinds, lifecycle, and safety at the owner.
- [x] Cover selection invariants and distinct edit-output identities before writes.
- [x] Cover adapter parsing/serialization/URLs instead of duplicating domain matrices.
- [x] Cover representative desktop upload-to-review and installed MCP reference serving.
- [x] Keep architecture tests on stable boundaries rather than implementation names.

### Documentation And Skills

- [x] Add ADR 0107 and narrow supersession notices without rewriting older decisions.
- [x] Update current data/storage/reference/migration/distribution/CLI/UI contracts.
- [x] Document collected-folder backfill and stable file identity across folder rename.
- [x] Update shared Media Producer ingestion, IDs, context scripts, and executable evals.
- [x] Update all named purpose/coordinator/provider skill consumers and examples.
- [x] Preserve provider research and unrelated sister-repository edits.
- [x] Remove stale direct-write-as-import guidance and the Inspiration special exception.

### Final Verification

- [x] Run Studio build/check/test/integration/desktop smoke and sister-skill checks.
- [x] Verify Urban Basilica and Sintel copies through automatic open and repeated open.
- [x] Verify backup artifacts, completion, exact hashes/paths, and database integrity.
- [x] Verify retry after injected backfill failure on a copied Project.
- [x] Exercise a newly built CLI/MCP runtime and inspect real Coco reference images.
- [x] Verify new dropped images and generic references in supported generation consumers.
- [x] Inspect full diffs/statistics and large/heavily modified modules in both repositories.
- [x] Confirm `index.ts` files remain thin and no dispatcher/catch-all file grew unchecked.
- [x] Confirm no formatting churn, compatibility shims, or adapter-local domain rules.
- [x] Confirm no checklist item was satisfied by accepting unreviewable code structure.
- [x] Mark complete only after implementation, data preservation, and runtime verification.

Verification completed on 2026-10-04: build and repository checks pass; 1,346
workspace unit tests, 111 integration tests, five desktop smoke tests, three
Visual Language desktop regressions, and 104 sister Skills tests pass. Skills
validation covers 22 purposes and 27 cross-cutting requirements. Copied-project
migration, installed CLI/MCP, exact-byte serving, retry, and architecture evidence
is recorded in [the conversion inventory](0222-conversion-inventory.md). Original
movie Projects were not upgraded or modified during acceptance verification.

### Post-Implementation Review Follow-Up

The user confirmed that image edits preserve the original and create a new,
unselected AssetFile in the same collection. Inspiration edits belong to the
source Inspiration folder. Explicit import remains required for Finder copies.

- [x] Extend source-derived image attachment to every valid image AssetFile,
      preserving existing domain-specific destinations and relationship checks.
- [x] Preserve the source owner, type, locale, metadata, original bytes, and current
      selection; permit independent deletion of the original and edited files.
- [x] Reserve retained database paths after Empty Trash so a repeated upload
      allocates a fresh filename instead of failing the unique-path constraint.
- [x] Show missing registered references as unavailable in generation previews.
- [x] Explain that unregistered files require import without registering them
      during read-only preview or serving.
- [x] Keep destination allocation and diagnostics in Core, using the existing
      destination registry without new tables, migrations, Settings, or flags.
- [x] Add public-command regression coverage for Inspiration/research edits,
      arbitrary image types, independent deletion, upload reuse, and references.
- [x] Update current architecture/decision documentation and Media Producer
      guidance in the sister Skills repository.
- [x] Complete final Core and HTTP verification and review the follow-up diff
      for formatting churn, ownership violations, and unnecessary abstractions.

Follow-up verification on 2026-10-04: all 580 Core tests, 30 focused Studio HTTP
tests, and 104 Media Producer Skills tests pass. Core build, source/test
typechecks, lint, and both repository diff-whitespace checks pass. Core was
rerun with an isolated temporary directory after concurrent suite cleanup
removed fixtures from the initial run. No production Project data was changed.
