# 0012 Core Client/Server Naming And Database Structure Refactor

Date: 2026-05-13

Status: draft

## Goal

Refactor `packages/core` so its folders, files, public contracts, server-only
code, SQLite schema, and database access modules match the Renku Studio domain
language.

This is the first cleanup pass for core. It is a naming and structure refactor,
not a behavior rewrite. The point is to make the package readable enough that
deeper duplicate removal and service rewrites can happen deliberately.

The refactor must:

- use `client` for browser-safe public contracts;
- use `server` for filesystem, SQLite, Drizzle, coordination, and service code;
- keep `schema` as the name for the SQLite/Drizzle schema;
- separate database lifecycle code from table access code;
- remove the broad `node/project` wrapper that makes every internal file look
  project-prefixed;
- avoid noisy suffixes such as `*-tables.ts`;
- avoid weak folder names such as `records`, `data`, `manager`, `helper`, and
  `utils`;
- keep `ProjectDataService` as the server-side facade name;
- update callers directly with no aliases, shims, or compatibility re-exports.

## Non-Goals

This pass should not change durable behavior.

Do not:

- rename SQLite tables or columns;
- generate Drizzle migrations;
- change setup YAML shape;
- change project folder layout;
- rewrite production export behavior;
- change asset selection semantics;
- preserve old `node` imports through compatibility exports;
- preserve old file paths through forwarding modules.

Any behavior bug found during the refactor should be recorded for the next
rewrite pass unless the bug blocks the naming refactor itself.

## Source Documents

This plan is grounded in:

- `docs/architecture/naming-guidelines.md`
- `docs/architecture/reference/domain-vocabulary.md`
- `docs/architecture/data-model-and-storage.md`
- `docs/architecture/drizzle-first-project-data.md`
- `docs/architecture/layers-of-responsibility.md`
- `docs/architecture/core-design-principles.md`
- `docs/architecture/reference/project-files-and-assets.md`
- `docs/architecture/reference/project-relative-paths.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/decisions/0010-use-domain-naming-and-remove-obsolete-compatibility.md`
- `docs/decisions/0017-use-scalable-studio-resource-loading.md`

## Current Problems

`packages/core` currently makes too many different concepts look like "project
data".

That is misleading because one project-local SQLite database contains one
top-level project row plus many real domain objects: project locales, visual
language entries, cast members, continuity references, episodes, sequences,
scenes, clips, assets, asset files, and asset relationships.

The current shape also mixes runtime boundaries:

- browser-safe contracts live in `src/project`, but Drizzle schema currently
  lives beside them in `src/schema`;
- server-only code lives under `src/node`, but the requested runtime boundary
  is clearer as `src/server`;
- almost all server code is nested under `node/project`, even when the actual
  responsibility is config, database access, navigation, production export, or
  asset file handling;
- database lifecycle, table access, read resources, commands, and tests are
  mixed under `node/project/data`.

Examples of unclear names:

- `project-target-repository.ts` validates an `AssetTarget` and maps it to the
  matching asset relationship table. It is not a project repository.
- `project-page-cursors.ts` handles opaque cursors for paginated resources. It
  is not specific to the project row.
- `project-asset-paths.ts` contains working and production asset roots. It is
  not a project table/path module.
- `project-session.ts` opens a project-local database session. It is database
  lifecycle code.
- `records/` would be a bad target folder name. `Record` is useful as a type
  suffix for row-shaped values, but a folder named `records` does not describe
  what the code does.

There are also public names that drift from the accepted vocabulary:

- `ProjectIdentity` should be `ProjectInfo`.
- `StoryStructureNavigation` should be `NarrativeNavigation`.
- `MovieStudioSelection*` should be `StudioSelection*`.

## Boundary Decisions

### `client`

`src/client` contains browser-safe public contracts exported from
`@gorenku/studio-core`.

It must not import:

- `node:fs`;
- `node:path`;
- `better-sqlite3`;
- `drizzle-orm`;
- server-only config, file, database, or migration modules.

The package root entry point stays browser-safe:

```text
@gorenku/studio-core
  -> dist/index.js
  -> src/index.ts
  -> src/client/index.ts
```

### `server`

`src/server` contains code that is valid on the Studio server, CLI, and local
agent/server runtime. It can use filesystem APIs, Drizzle, SQLite, and server
coordination files.

The server entry point should replace the old `node` entry point:

```text
@gorenku/studio-core/server
  -> dist/server/index.js
  -> src/server/index.ts
```

Do not keep `@gorenku/studio-core/node` as a compatibility export. Update CLI,
Studio server, docs, tsconfig path aliases, and tests directly.

### `schema`

`src/server/schema` contains the SQLite/Drizzle schema. The name `schema` is
correct because these files literally define the project-local SQLite schema.

No `*-tables.ts` suffix. The folder already supplies the boundary.

### `database/lifecycle`

`src/server/database/lifecycle` contains database connection, session lifetime,
and migration concerns.

It is not table access. It answers questions like:

- where is the project database path?
- how is the SQLite store opened?
- how are connection pragmas applied?
- how is schema generation checked?
- how are long-lived project sessions cached and closed?
- how are Drizzle migrations run?

### `database/access`

`src/server/database/access` contains Drizzle-backed reads and writes for the
tables defined in `server/schema`.

It is not lifecycle code. It answers questions like:

- insert or read the one `project` row;
- replace project locales;
- list cast members;
- insert sequences/scenes/clips;
- read asset files;
- update asset relationship selection;
- count navigation children.

Types exported from this folder may still use the `Record` suffix when they are
row-shaped values, such as `CastMemberRecord`. The folder itself should not be
called `records`.

## Naming Rules

### Use `Project` Only Where It Names The Project Boundary

Keep `Project` when the name refers to:

- the public `Project` contract;
- project identity/top-level metadata;
- the `project` table;
- `project_locale`, because `Project Locale` is canonical;
- the project folder or project-local SQLite database;
- the public `ProjectDataService` facade;
- `ProjectRelativePath`, because it is an accepted contract name.

Avoid `project` when the real concept is more specific.

Examples:

| Current name | Target name | Reason |
| --- | --- | --- |
| `project-target-repository.ts` | `database/access/asset-relationships/targets.ts` | It maps asset targets to relationship tables. |
| `project-page-cursors.ts` | `resources/cursors.ts` | It handles resource pagination cursors. |
| `project-asset-paths.ts` | `files/asset-paths.ts` | It contains working/production asset roots. |
| `project-session.ts` | `database/lifecycle/active-session.ts` | It owns project-lifetime database session lookup. |
| `ProjectDataSession` | `DatabaseSession` | The type is a database session, not all project data. |

### Use Concrete Domain Objects Instead Of `Story`

Do not introduce a `story` folder, `Story` type, or `StoryStructure` contract.

Use:

- `Episode`
- `Sequence`
- `Scene`
- `Clip`
- `Narrative` only when naming the collection/hierarchy across those objects,
  matching the "Narrative Structure" heading in the vocabulary document.

Concrete changes:

| Current name | Target name |
| --- | --- |
| `StoryStructureNavigation` | `NarrativeNavigation` |
| `storyStructure` property on `ProjectShellNavigation` | `narrative` |
| `assertProjectStoryType` | `assertProjectType` |

### Keep Production Export Vocabulary Explicit

`Asset` and `Production Asset` are different accepted terms.

Use:

- `Asset` for a registered content item in SQLite metadata;
- `AssetFile` for a concrete file belonging to an asset;
- `AssetRelationship` for rows such as `clip_asset`, `cast_asset`, and
  `project_asset`;
- `ProductionExport` for the job that exports selected assets;
- `ProductionAsset` only for selected assets placed in the clean handoff tree
  or manifest.

Do not rename production export modules to generic asset modules.

## Target Package Shape

```text
packages/core/
  package.json
  drizzle.config.ts
  drizzle.project-migrate.config.ts
  README.md

  catalog/
    visual-language/
      ...

  drizzle/
    ...

  src/
    index.ts

    client/
      index.ts
      package-info.ts
      project.ts
      project-library.ts
      project-languages.ts
      visual-language.ts
      visual-language-catalog.ts
      cast-members.ts
      continuity-references.ts
      narrative.ts
      resources.ts
      assets.ts
      production-export.ts
      diagnostics.ts

    server/
      index.ts
      renku-config.ts
      project-data-service.ts
      project-data-service-contracts.ts
      project-data-error.ts
      entity-ids.ts

      schema/
        index.ts
        project.ts
        project-locales.ts
        visual-language.ts
        cast-members.ts
        continuity-references.ts
        narrative.ts
        assets.ts

      database/
        lifecycle/
          store.ts
          active-session.ts
          migrator.ts

        access/
          project.ts
          project-locales.ts
          visual-language.ts
          cast-members.ts
          continuity-references.ts
          narrative.ts
          assets.ts
          asset-files.ts
          rich-text-asset-links.ts

          asset-relationships/
            index.ts
            targets.ts
            project.ts
            visual-language.ts
            cast-members.ts
            continuity-references.ts
            narrative.ts

      commands/
        create-project-from-setup.ts
        create-project-from-narrative-starter.ts
        migrate-database.ts
        update-project-information.ts
        update-markdown-asset-content.ts
        register-asset.ts
        change-asset-selection.ts

      resources/
        full-project.ts
        project-library.ts
        project-shell.ts
        project-information.ts
        navigation.ts
        cursors.ts
        assets.ts
        asset-page.ts
        cast-design.ts
        clip-design.ts
        markdown-asset-content.ts
        selection-context.ts

      setup/
        contracts.ts
        reader.ts
        validation.ts
        writer.ts
        markdown-assets.ts

      narrative-starter/
        contracts.ts
        reader.ts
        validation.ts
        to-project-setup.ts

      files/
        project-paths.ts
        project-relative-paths.ts
        asset-paths.ts
        markdown-asset-files.ts
        cover-image-files.ts

      production-export/
        export-production-assets.ts
        export-plan.ts
        selected-production-assets.ts
        production-asset-paths.ts
        manifest.ts
        tree-hash.ts
        file-sync.ts

      catalog/
        visual-language/
          index.ts
          reader.ts
          paths.ts
          errors.ts

      studio-coordination/
        index.ts
        service.ts
        events.ts
        errors.ts
        event-store.ts
        event-validation.ts
        event-cursors.ts
        focus-validation.ts
        current-projection.ts
        resource-keys.ts
        runtime-descriptor.ts
```

## Current File Inventory And Target Mapping

This section accounts for every current tracked core source file plus the
untracked exploratory files currently visible in the working tree.

### Package Root

| Current file | Target | Notes |
| --- | --- | --- |
| `packages/core/package.json` | update | Export `.` and `./server`; remove `./node`. |
| `packages/core/drizzle.config.ts` | update | Drizzle schema path becomes `./src/server/schema/index.ts`. |
| `packages/core/drizzle.project-migrate.config.ts` | update | Same schema path update. |
| `packages/core/README.md` | update | Document client/server entry points. |
| `packages/core/tsconfig.json` | keep | No source naming issue. |
| `packages/core/tsconfig.vitest.json` | keep | No source naming issue. |
| `packages/core/vitest.config.ts` | keep | Update only if path aliases are needed. |
| `packages/core/eslint.config.mjs` | keep | No source naming issue. |
| `packages/core/drizzle/**` | keep | Generated migrations remain in package-owned migrations folder. |
| `packages/core/catalog/visual-language/**` | keep | System catalog content is not TypeScript source. |
| `packages/core/dist/**` | ignore | Build output, not source. Do not edit as part of refactor. |
| `packages/core/node_modules/**` | ignore | Dependency install output, not source. |

### Client Contracts

| Current file | Target | Notes |
| --- | --- | --- |
| `src/index.ts` | `src/index.ts` | Browser-safe package root. Re-export `src/client/index.ts`. Remove obsolete `WORKFLOW_KIND` and `TASK_KIND` if they are not accepted current contracts. |
| `src/index.test.ts` | `src/client/index.test.ts` | Test browser-safe package root behavior. Remove tests for obsolete names. |
| `src/project/contracts.ts` | split into `src/client/*.ts` | Split by domain contract, not by implementation. |
| `src/project/index.ts` | `src/client/index.ts` | Client contract aggregation. |
| `src/project/errors.ts` | `src/server/project-data-error.ts` and `src/client/diagnostics.ts` | Server gets the `StructuredError` class; client gets serialized diagnostic/error contracts. |
| `src/visual-language-catalog/contracts.ts` | `src/client/visual-language-catalog.ts` | Browser-safe catalog contracts. |
| `src/visual-language-catalog/index.ts` | `src/client/index.ts` aggregation | No separate folder needed unless the catalog contract grows. |
| `src/schema/index.ts` | `src/server/schema/*` | Move out of browser-safe source area. |

Client contract split:

| Target file | Owns |
| --- | --- |
| `client/package-info.ts` | `StudioCorePackageInfo`, `getStudioCorePackageInfo`, accepted package constants. |
| `client/project.ts` | `Project`, `ProjectInfo`, `ProjectType`, `ProjectCoverImage`, `ProjectCounts`, `ProjectCreateReport`. |
| `client/project-library.ts` | `ProjectLibrary`, `ProjectSummary`. |
| `client/project-languages.ts` | `ProjectLanguage`. |
| `client/visual-language.ts` | `VisualLanguage`, `VisualLanguageCategory`, priority/source types. |
| `client/visual-language-catalog.ts` | `VisualLanguageCatalog`, catalog entry/read contracts. |
| `client/cast-members.ts` | `CastMember`. |
| `client/continuity-references.ts` | `ContinuityReference`. |
| `client/narrative.ts` | `Episode`, `Sequence`, `Scene`, `Clip`. |
| `client/resources.ts` | `PageResponse`, `ProjectShell`, navigation rows, `NarrativeNavigation`, `CastDesignResource`, `ClipDesignResource`, `ProjectInformationResource`, `StudioSelection*`. |
| `client/assets.ts` | `Asset`, `AssetFile`, `AssetTarget`, `AssetReference`, `AssetSelection`, `AssetAvailability`, `RichTextAssetLink`, `MarkdownAssetContent`, `RegisterAssetInput`. |
| `client/production-export.ts` | `ProductionExportInput`, `ProductionExportVariant`, `ProductionExportSummary`, `ProductionExportVariantSummary`. |
| `client/diagnostics.ts` | Serialized project data error/diagnostic contracts used in client-facing payloads. |

Required public renames:

| Current public name | Target public name |
| --- | --- |
| `ProjectIdentity` | `ProjectInfo` |
| `StoryStructureNavigation` | `NarrativeNavigation` |
| `MovieStudioSelection` | `StudioSelection` |
| `MovieStudioSelectionContext` | `StudioSelectionContext` |
| `MovieStudioSelectionContextResult` | `StudioSelectionContextResult` |

### Server Entry, Config, Facade, IDs

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/index.ts` | `src/server/index.ts` | Server package entry point. Export server-only APIs. |
| `src/node/config.ts` | `src/server/renku-config.ts` | Global Renku config reader/writer. Avoid generic `config.ts`. |
| `src/node/config.test.ts` | `src/server/renku-config.test.ts` | Same behavior, clearer name. |
| `src/node/project/index.ts` | fold into `src/server/index.ts` | Remove unnecessary project wrapper. |
| `src/node/project/project-data-service.ts` | `src/server/project-data-service.ts` | Keep facade name. |
| `src/node/project/project-data-service-contracts.ts` | `src/server/project-data-service-contracts.ts` | Service contract for the facade. |
| `src/node/project/ids/project-id-generator.ts` | `src/server/entity-ids.ts` | ID prefixes cover many domain entities, not only project. |

### Server Schema

| Current file | Target | Notes |
| --- | --- | --- |
| `src/schema/index.ts` | `src/server/schema/index.ts` plus split files | Drizzle schema aggregation moves under server. |

Schema split:

| Target file | Owns |
| --- | --- |
| `server/schema/project.ts` | `projects`. |
| `server/schema/project-locales.ts` | `projectLocales`. |
| `server/schema/visual-language.ts` | `visualLanguageCategories`, `visualLanguage`. |
| `server/schema/cast-members.ts` | `castMembers`. |
| `server/schema/continuity-references.ts` | `continuityReferences`. |
| `server/schema/narrative.ts` | `episodes`, `sequences`, `scenes`, `clips`. |
| `server/schema/assets.ts` | `assets`, `assetFiles`, all asset relationship tables. |

### Database Lifecycle

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/data/sqlite-project-store.ts` | `src/server/database/lifecycle/store.ts` | Opens/closes database, applies pragmas, checks schema generation. |
| `src/node/project/project-session.ts` | `src/server/database/lifecycle/active-session.ts` | Resolves storage root/project folder and opens project-lifetime sessions. |
| `src/node/project/data/project-database-migrator.ts` | `src/server/database/lifecycle/migrator.ts` | Runs Drizzle migrations and schema generation checks. |
| `src/node/project/data/sqlite-project-store.test.ts` | `src/server/database/lifecycle/store.test.ts` | Store/lifecycle tests. |

Type renames:

| Current type | Target type |
| --- | --- |
| `ProjectDataSession` | `DatabaseSession` |
| `SqliteProjectDataSession` | `SqliteDatabaseSession` |
| `ProjectStoreLifetime` | `DatabaseSessionLifetime` |

Function names such as `openProjectStore`, `closeProjectStore`, and
`resolveProjectDatabasePath` may keep `Project` because they refer to the
project-local database boundary.

### Database Access

These modules use Drizzle table objects from `server/schema` to read and write
rows. They are database access modules, not lifecycle modules.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/data/project-records.ts` | `src/server/database/access/project.ts` | `project` table access. |
| `src/node/project/data/project-locale-records.ts` | `src/server/database/access/project-locales.ts` | Project Locale is canonical. |
| `src/node/project/data/visual-language-records.ts` | `src/server/database/access/visual-language.ts` | Visual language row access. |
| `src/node/project/data/visual-language-category-records.ts` | `src/server/database/access/visual-language.ts` | Merge category and entry access unless file size argues otherwise. |
| `src/node/project/data/cast-member-records.ts` | `src/server/database/access/cast-members.ts` | Cast member table access. |
| `src/node/project/data/continuity-reference-records.ts` | `src/server/database/access/continuity-references.ts` | Continuity reference table access. |
| `src/node/project/data/narrative-records.ts` | `src/server/database/access/narrative.ts` | Episode, sequence, scene, and clip table access. |
| `src/node/project/data/asset-records.ts` | `src/server/database/access/assets.ts` | Asset table access. |
| `src/node/project/data/asset-file-records.ts` | `src/server/database/access/asset-files.ts` | Asset file table access. |
| `src/node/project/data/rich-text-asset-links.ts` | `src/server/database/access/rich-text-asset-links.ts` | Rich text asset lookup from asset files and relationships. |

Asset relationship access needs its own subfolder because there are several
relationship tables and duplicated current helpers:

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/data/asset-relationship-records.ts` | `src/server/database/access/asset-relationships/index.ts` | Shared relationship paging, selection updates, counts, owner target reads. |
| `src/node/project/data/project-target-repository.ts` | `src/server/database/access/asset-relationships/targets.ts` | Asset target to table mapping and target validation. |
| `src/node/project/data/project-asset-records.ts` | `src/server/database/access/asset-relationships/project.ts` | `project_asset` table-specific insert/list. |
| `src/node/project/data/visual-language-asset-records.ts` | `src/server/database/access/asset-relationships/visual-language.ts` | `visual_language_asset` table-specific insert/list. |
| `src/node/project/data/cast-asset-records.ts` | `src/server/database/access/asset-relationships/cast-members.ts` | `cast_asset` table-specific insert/list. |
| `src/node/project/data/continuity-reference-asset-records.ts` | `src/server/database/access/asset-relationships/continuity-references.ts` | `continuity_reference_asset` table-specific insert/list. |
| `src/node/project/data/narrative-asset-records.ts` | `src/server/database/access/asset-relationships/narrative.ts` | `sequence_asset`, `scene_asset`, and `clip_asset` table-specific insert/list. |

The table-specific asset relationship files are current behavior modules, not
compatibility shims. They can move in this pass. A later duplicate-removal pass
should replace them with a type-safe relationship implementation if that can be
done cleanly.

### Server Resources

Resources are server-side read models returned to CLI, Studio server, or the
browser through HTTP adapters. They may use database access modules and file
reads, but they do not own durable mutations.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/data/project-reader.ts` | `src/server/resources/full-project.ts` | Full `Project` contract reader. |
| `src/node/project/data/project-library-reader.ts` | `src/server/resources/project-library.ts` | Project library/listing reader. |
| `src/node/project/data/navigation-pages.ts` | `src/server/resources/navigation.ts` | Navigation pages and project-type assertions. Rename `Story` usage to `Narrative`/`ProjectType`. |
| `src/node/project/data/project-page-cursors.ts` | `src/server/resources/cursors.ts` | Opaque resource cursor utilities. |
| `src/node/project/projections/project-shell-projection.ts` | `src/server/resources/project-shell.ts` | `ProjectShell` resource. |
| `src/node/project/projections/project-information-resource.ts` | `src/server/resources/project-information.ts` | Editable project information resource. |
| `src/node/project/projections/cast-design-resource.ts` | `src/server/resources/cast-design.ts` | Cast design surface resource. |
| `src/node/project/projections/clip-design-resource.ts` | `src/server/resources/clip-design.ts` | Clip design surface resource. |
| `src/node/project/projections/movie-studio-selection-context.ts` | `src/server/resources/selection-context.ts` | Studio selection context. Rename exported `MovieStudioSelection*` names. |
| `src/node/project/assets/asset-service.ts` | split into `commands/*` and `resources/assets.ts` | See commands section. |
| `src/node/project/queries/project-read-operations.ts` | remove after moving functions | It is a wrapper created in the rejected exploratory pass. |
| `src/node/project/queries/project-resource-operations.ts` | remove after moving functions | It is a wrapper created in the rejected exploratory pass. |

### Server Commands

Commands mutate durable metadata and/or write project-owned files. They are the
only place service-level mutations should be implemented.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/commands/project-creation-command.ts` | split | Created in exploratory pass; keep only if folded intentionally. |
| `src/node/project/commands/project-creation-command.ts` | `src/server/commands/create-project-from-setup.ts` | Setup YAML creation path. |
| `src/node/project/commands/project-creation-command.ts` | `src/server/commands/create-project-from-narrative-starter.ts` | Narrative starter creation path. |
| `src/node/project/commands/project-creation-command.ts` | `src/server/commands/migrate-database.ts` | Service-level migration command. |
| `src/node/project/commands/project-information-command.ts` | `src/server/commands/update-project-information.ts` | Update/patch project info and languages. |
| `src/node/project/commands/markdown-asset-content-command.ts` | `src/server/commands/update-markdown-asset-content.ts` and `src/server/resources/markdown-asset-content.ts` | Split read from mutation. |
| `src/node/project/assets/asset-service.ts` | `src/server/commands/register-asset.ts` | Asset registration mutation. |
| `src/node/project/assets/asset-service.ts` | `src/server/commands/change-asset-selection.ts` | Select/take mutation commands. |
| `src/node/project/assets/asset-service.ts` | `src/server/resources/assets.ts` | `listAssets` and `listAssetSelects`. |

### Setup And Narrative Starter

Setup YAML and narrative starter YAML are server-only inputs. They should never
be imported by client/browser code.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/setup/project-setup-reader.ts` | split into `server/setup/contracts.ts`, `reader.ts`, `validation.ts` | Large file: contracts, parsing, validation, normalization. |
| `src/node/project/setup/project-setup-validator.ts` | `server/setup/validation.ts` | Merge wrapper into real validation module. |
| `src/node/project/setup/project-setup-writer.ts` | `server/setup/writer.ts` | Created in exploratory pass; fold intentionally or discard. |
| `src/node/project/setup/project-setup-markdown-assets.ts` | `server/setup/markdown-assets.ts` | Created in exploratory pass; fold intentionally or discard. |
| `src/node/project/narrative-starter/narrative-starter-reader.ts` | split into `server/narrative-starter/contracts.ts`, `reader.ts`, `validation.ts` | Large file: contracts, parsing, validation, Markdown reference resolution. |
| `src/node/project/narrative-starter/project-setup-from-narrative-starter.ts` | `server/narrative-starter/to-project-setup.ts` | Created in exploratory pass; conversion is server-only. |
| `src/node/project/narrative-starter/index.ts` | `server/narrative-starter/index.ts` | Aggregation only if useful internally. |

### Server Files

Filesystem modules stay server-only and separate from database access.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/files/project-paths.ts` | `src/server/files/project-paths.ts` | Keep project name: project folder/database path boundary. |
| `src/node/project/files/project-relative-paths.ts` | `src/server/files/project-relative-paths.ts` | Keep project name: `ProjectRelativePath` is canonical. |
| `src/node/project/files/project-asset-paths.ts` | `src/server/files/asset-paths.ts` | Asset roots and Markdown asset path allocation. |
| `src/node/project/files/markdown-asset-files.ts` | `src/server/files/markdown-asset-files.ts` | Markdown asset file IO. |
| `src/node/project/files/cover-image-files.ts` | `src/server/files/cover-image-files.ts` | Cover image copy/resolve. |

### Production Export

`production-export-service.ts` is too large, but this naming pass should split
by responsibility without changing export behavior.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/production-export/production-export-service.ts` | `src/server/production-export/export-production-assets.ts` | Public export command orchestration. |
| same | `src/server/production-export/export-plan.ts` | Plan assembly. |
| same | `src/server/production-export/selected-production-assets.ts` | Selected exportable asset queries. |
| same | `src/server/production-export/production-asset-paths.ts` | Target path calculation. |
| same | `src/server/production-export/manifest.ts` | Manifest read/write. |
| same | `src/server/production-export/tree-hash.ts` | Tree hash calculation. |
| same | `src/server/production-export/file-sync.ts` | Copy, skip, prune, unmanaged-file handling. |

### Visual Language Catalog

Catalog content remains under `packages/core/catalog`. Server-side catalog
readers move under `server/catalog`.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/visual-language-catalog/visual-language-catalog-reader.ts` | `src/server/catalog/visual-language/reader.ts` | Reads bundled catalog files. |
| `src/node/visual-language-catalog/visual-language-catalog-paths.ts` | `src/server/catalog/visual-language/paths.ts` | Catalog root resolution. |
| `src/node/visual-language-catalog/visual-language-catalog-errors.ts` | `src/server/catalog/visual-language/errors.ts` | Server-side catalog error class. |
| `src/node/visual-language-catalog/index.ts` | `src/server/catalog/visual-language/index.ts` | Server catalog exports. |
| `src/node/visual-language-catalog/visual-language-catalog-reader.test.ts` | `src/server/catalog/visual-language/reader.test.ts` | Reader tests. |

### Studio Coordination

Studio coordination is server-side runtime state and event handling. The folder
name supplies the `studio-coordination` context, so file names can be shorter.

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/studio-coordination/studio-coordination-service.ts` | `src/server/studio-coordination/service.ts` | Coordination service facade. |
| `src/node/studio-coordination/studio-coordination-events.ts` | `src/server/studio-coordination/events.ts` | Event contracts. |
| `src/node/studio-coordination/studio-coordination-errors.ts` | `src/server/studio-coordination/errors.ts` | Error helpers. |
| `src/node/studio-coordination/studio-event-store.ts` | `src/server/studio-coordination/event-store.ts` | JSONL event store IO. |
| `src/node/studio-coordination/studio-event-validation.ts` | `src/server/studio-coordination/event-validation.ts` | Event validation. |
| `src/node/studio-coordination/studio-event-cursors.ts` | `src/server/studio-coordination/event-cursors.ts` | Event cursor parse/format. |
| `src/node/studio-coordination/studio-focus-validation.ts` | `src/server/studio-coordination/focus-validation.ts` | Focus reference validation. |
| `src/node/studio-coordination/studio-current-projection.ts` | `src/server/studio-coordination/current-projection.ts` | `renku studio current` projection. |
| `src/node/studio-coordination/studio-resource-keys.ts` | `src/server/studio-coordination/resource-keys.ts` | Resource invalidation keys. |
| `src/node/studio-coordination/studio-runtime-descriptor.ts` | `src/server/studio-coordination/runtime-descriptor.ts` | Runtime descriptor heartbeat/claim/release. |
| `src/node/studio-coordination/index.ts` | `src/server/studio-coordination/index.ts` | Server coordination exports. |
| `src/node/studio-coordination/studio-coordination-service.test.ts` | `src/server/studio-coordination/service.test.ts` | Coordination service tests. |
| `src/node/studio-coordination/studio-focus-validation.test.ts` | `src/server/studio-coordination/focus-validation.test.ts` | Focus validation tests. |

### Tests To Split Or Move

| Current file | Target | Notes |
| --- | --- | --- |
| `src/node/project/project-data-service.test.ts` | split by behavior | Currently covers creation, setup validation, narrative starter, assets, export, migration, information, Markdown content. |
| `src/node/project/project-data-architecture.test.ts` | `src/server/architecture.test.ts` | Update guardrails to new client/server/database layout. |

Target behavior test files:

- `server/commands/create-project-from-setup.test.ts`
- `server/commands/create-project-from-narrative-starter.test.ts`
- `server/commands/update-project-information.test.ts`
- `server/commands/update-markdown-asset-content.test.ts`
- `server/commands/register-asset.test.ts`
- `server/commands/change-asset-selection.test.ts`
- `server/resources/project-library.test.ts`
- `server/resources/project-shell.test.ts`
- `server/resources/navigation.test.ts`
- `server/resources/asset-page.test.ts`
- `server/resources/cast-design.test.ts`
- `server/resources/clip-design.test.ts`
- `server/production-export/export-production-assets.test.ts`
- `server/database/lifecycle/migrator.test.ts`

## Implementation Order

### Phase 0 - Clean Baseline

There are uncommitted exploratory core edits in the working tree from an
earlier rejected refactor pass.

Before implementing this plan, decide explicitly whether those edits are:

- reverted to the accepted baseline; or
- folded intentionally into this plan's structure.

Do not let the current dirty tree silently define the architecture.

### Phase 1 - Entry Points And Folder Boundary

1. Create `src/client` and move browser-safe contracts there.
2. Keep `src/index.ts` as the root browser-safe entry point.
3. Create `src/server` and move the old `src/node` public entry there.
4. Change package exports from `./node` to `./server`.
5. Update CLI, Studio server, tests, tsconfig path aliases, docs, and plans
   that import or mention `@gorenku/studio-core/node`.
6. Do not keep a `./node` export.

Verification:

```bash
pnpm --filter @gorenku/studio-core type-check
```

### Phase 2 - Client Contracts

1. Split the current public contract file into focused `src/client` files.
2. Rename public contracts:
   - `ProjectIdentity` to `ProjectInfo`;
   - `StoryStructureNavigation` to `NarrativeNavigation`;
   - `MovieStudioSelection*` to `StudioSelection*`.
3. Keep root exports browser-safe.
4. Remove obsolete public names and tests that only preserve them.

Verification:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm test:core
```

### Phase 3 - Schema And Database Lifecycle

1. Move Drizzle schema into `src/server/schema`.
2. Split schema by table family without renaming tables, columns, or indexes.
3. Update Drizzle config files to `./src/server/schema/index.ts`.
4. Move database open/close, session cache, and migrator code into
   `server/database/lifecycle`.
5. Rename session types to database names.

Verification:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm test:core
```

### Phase 4 - Database Access

1. Move table access files into `server/database/access`.
2. Merge visual language category access with visual language access if it
   stays readable.
3. Move asset relationship table access into
   `server/database/access/asset-relationships`.
4. Keep behavior the same; duplicate removal is a follow-up unless a duplicate
   can be removed mechanically without changing behavior.

Verification:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm test:core
```

### Phase 5 - Resources, Commands, Files

1. Move read models into `server/resources`.
2. Move mutation handlers into `server/commands`.
3. Split `asset-service.ts` into asset commands and asset resources.
4. Move filesystem helpers into `server/files`.
5. Keep `ProjectDataService` as a small facade over commands and resources.

Verification:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm test:core
```

### Phase 6 - Setup, Narrative Starter, Catalog, Coordination

1. Split setup reader contracts/reader/validation/writer modules.
2. Split narrative starter contracts/reader/validation/conversion modules.
3. Move visual language catalog server readers to `server/catalog/visual-language`.
4. Move Studio coordination to `server/studio-coordination` with shorter file
   names.

Verification:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm test:core
```

### Phase 7 - Tests And Architecture Guardrails

1. Split the oversized project data service test by behavior.
2. Update architecture tests to enforce:
   - root entry point imports no server modules;
   - server schema imports no client contracts;
   - database lifecycle does not import resources or commands;
   - database access does not import commands;
   - commands may import database access, files, and resources only through
     deliberate boundaries;
   - no `src/node` folder remains;
   - no `@gorenku/studio-core/node` import remains;
   - no old public names are exported.

Full verification:

```bash
pnpm build:core
pnpm test:core
pnpm lint:core
pnpm test:typecheck:core
pnpm check
```

## Follow-Up Rewrite Targets

These are intentionally outside the naming-only pass, but the refactor should
make them easier.

1. Shared structured document validation
   - `ProjectSetup`, narrative starter, visual language catalog, global config,
     and Studio coordination event validation repeat record readers, required
     string readers, unknown-field warnings, path diagnostics, and issue
     collection.
   - Target a small validation module with explicit domain-specific wrappers,
     not a loose `utils` folder.

2. Asset relationship consolidation
   - The current table-specific relationship files duplicate insert/list logic.
   - The target is a type-safe `AssetRelationship` implementation driven by
     `AssetTarget`, without broad `as any` table writes.

3. Production export decomposition and rewrite
   - `production-export-service.ts` currently mixes selected asset queries,
     export planning, path calculation, manifest IO, tree hashing, copying,
     skipping, pruning, and reporting.
   - The naming pass should split files; behavior-level cleanup should happen
     in a dedicated production export rewrite.

4. Narrative navigation and selection correctness
   - Navigation, selection context, focus validation, and full project reading
     should share one canonical traversal of `Episode -> Sequence -> Scene ->
     Clip`.
   - Series projects must not be treated as standalone movies with synthetic or
     ignored episodes.

5. Full project reader retirement path
   - ADR 0017 says Studio runtime should use `ProjectShell` and lazy resources.
   - Keep `readProject` for CLI/inspection needs, but do not let new Studio
     surfaces grow the full `Project` payload.

## Acceptance Criteria

This refactor is complete when:

- `src/client` contains the browser-safe contracts;
- `src/server` contains server-only code;
- `src/node` no longer exists;
- package export `./server` replaces `./node`;
- Drizzle schema lives under `src/server/schema`;
- database lifecycle code lives under `src/server/database/lifecycle`;
- database table access code lives under `src/server/database/access`;
- there is no `records` folder;
- there is no `data` folder for mixed database/resource/command code;
- there is no broad `node/project` wrapper;
- `Project` is not used as a reflexive prefix for every internal module;
- `Story*`, `ProjectIdentity`, and `MovieStudioSelection*` are gone from public
  contracts;
- production export names still distinguish `Asset` from `ProductionAsset`;
- there are no old-name re-export modules or compatibility aliases;
- core type-checks, tests, lint, and package checks pass.
