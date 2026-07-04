# Project Database Distribution And Upgrades

Date: 2026-07-04

Status: current direction

Role: topic overview

## Purpose

This document explains how installed Renku Studio packages create and upgrade
project-local SQLite databases.

The important distribution rule is:

```text
project database lifecycle code and migrations are runtime package contents
```

Project database creation and upgrade are not source-checkout-only development
tasks. Users who install Renku Studio must receive the compiled core runtime,
the generated Drizzle migration files, and the package-owned migration config
needed to apply those migrations.

## Installed Package Boundary

`@gorenku/studio-core` owns project database lifecycle behavior.

The installed core package must include:

- `dist/`: compiled core runtime code, including database lifecycle code and the
  compiled Drizzle schema module;
- `drizzle/`: generated SQL migrations, Drizzle migration journal, and Drizzle
  schema snapshots;
- `drizzle.project-migrate.config.ts`: the package-owned Drizzle Kit config for
  applying migrations to one project database;
- `catalog/` and `README.md` when required by the package manifest.

The installed core package must not rely on `src/`.

Source files are implementation inputs. The published runtime contract is the
built package. Any file included in the published package, including
`drizzle.project-migrate.config.ts`, must import runtime code from files that
are also included in the package.

## What Users Install

For the CLI distribution, users install `@gorenku/studio-cli`.

That package provides the `renku` binary. Its direct and transitive runtime
install includes:

- `@gorenku/studio-core` for project data, migrations, validation, commands, and
  projections;
- `@gorenku/studio-engines` for provider catalogs and generation adapters used
  by core generation workflows;
- `@gorenku/studio-diagnostics` for structured diagnostics;
- runtime dependencies such as `better-sqlite3`, `drizzle-orm`, and
  `drizzle-kit` through the packages that own those concerns.

For a future packaged Studio application, the same rule applies. The app bundle
may additionally include the built browser UI and local Node server, but project
database creation and upgrade must still run through the installed core package.

The browser bundle must not contain SQLite or migration code. The Node side of
the installed app must contain core, the SQLite driver, Drizzle runtime
dependencies, Drizzle Kit, and the generated migration folder.

## Why Migrations Are Distributed

The migration files in `packages/core/drizzle/` are not development-only files.
They are part of the runtime project database contract.

They are needed for two installed-user paths:

- creating a new project database from zero;
- upgrading an existing project database from an earlier app release.

New database creation is just migration from an empty SQLite database to the
current schema. Renku Studio should not create tables through a second runtime
schema initializer because that would create two sources of truth.

Existing database upgrade is migration from the project's current Drizzle
migration state to the installed package's latest migration state.

In both cases, Drizzle Kit reads the installed package's migration journal and
SQL files from `@gorenku/studio-core/drizzle/`.

## First Public Release Baseline

Before the first public release, Renku Studio may compact the development
migration history into a public baseline migration.

This is allowed only because pre-public development migrations are not a user
upgrade contract. They describe private iteration history, not database states
that installed users need to migrate from.

The first public release should ship a compact baseline such as:

```text
drizzle/
  0000_public_project_database_baseline.sql
  meta/
    _journal.json
    0000_snapshot.json
```

That baseline migration should create the current schema directly and set the
first public project-store schema generation:

```sql
PRAGMA user_version = 1;
```

After the first public release, the rule changes. Any migration that has shipped
to users is durable public upgrade history and must not be rewritten, deleted,
renumbered, compacted, or replaced by a new baseline.

Post-public schema changes must append forward migrations:

```text
0001_add_current_feature.sql
0002_rename_current_concept.sql
```

When a post-public change is breaking for current runtime reads or writes, that
migration must advance `PRAGMA user_version`. Non-breaking migrations must not
advance it.

Internal development projects that predate the public baseline are not a reason
to ship private migration history. Before cutting the baseline, choose an
explicit internal handling path:

- recreate or import the project into a fresh database built from the baseline;
- run a one-time internal conversion outside the public runtime contract; or
- accept that pre-public development databases are not supported by the compact
  public release.

Do not add compatibility readers, fallback migrations, or obsolete-shape
recognition to preserve pre-public database states after the baseline is cut.

## New Project Creation In An Installed CLI

When a user runs:

```bash
renku create constantinople
```

the installed CLI flow is:

1. `@gorenku/studio-cli` parses the command.
2. The CLI calls `createProjectDataService().createMovieProject(...)` in
   `@gorenku/studio-core/server`.
3. Core validates the project name and creates:

   ```text
   <storageRoot>/<projectName>/.renku/
   ```

4. Core resolves the project database path:

   ```text
   <storageRoot>/<projectName>/.renku/project.sqlite
   ```

5. Core calls its project database migrator for that path.
6. The migrator resolves the installed `@gorenku/studio-core` package root.
7. The migrator resolves Drizzle Kit from core's installed dependency graph.
   The implementation should use package resolution rather than assuming a
   workspace-shaped `node_modules` folder.
8. Core starts Drizzle Kit with:

   ```text
   drizzle-kit migrate --config <corePackageRoot>/drizzle.project-migrate.config.ts
   ```

   and passes:

   ```text
   RENKU_PROJECT_DATABASE_PATH=<project sqlite path>
   ```

9. The migration config sees that the target database does not exist yet, or is
   empty, so no pre-migration backup is needed.
10. Drizzle Kit applies the installed SQL migrations from:

    ```text
    <corePackageRoot>/drizzle/
    ```

11. Drizzle creates the SQLite database, creates Drizzle's migration tracking
    table, applies all migrations, and sets the current project-store schema
    generation when a migration contains `PRAGMA user_version`.
12. Core opens the newly initialized project store and inserts the initial
    project records.
13. The CLI formats the core report for the user.

For this path, `preMigrationBackup` is `null` because there was no existing
non-empty user database to protect.

## Existing Project Upgrade In An Installed CLI

When a user installs a newer Renku Studio version, the new installed core
package may contain additional files in `drizzle/`.

An existing project may have an older database at:

```text
<storageRoot>/<projectName>/.renku/project.sqlite
```

There are two core-owned ways the upgrade can run:

- explicit CLI upgrade:

  ```bash
  renku project migrate <projectName>
  ```

- core-controlled automatic migration when opening a project database, only for
  cases core has explicitly classified as safe to auto-migrate.

The upgrade flow is:

1. Core resolves the project database path.
2. Core checks that the target database exists for explicit project migration.
3. Core creates a verified pre-migration backup before Drizzle Kit is allowed to
   mutate the existing non-empty database.
4. The backup is written beside the project database:

   ```text
   <projectFolder>/.renku/project-database-backups/
   ```

5. The backup database is created with SQLite `VACUUM INTO`.
6. Core opens the backup read-only and verifies it with `PRAGMA quick_check`.
7. Core writes a JSON sidecar with the source database path, backup path, source
   schema generation, target schema generation, file sizes, and verification
   result.
8. Core starts Drizzle Kit with the installed migration config and passes both:

   ```text
   RENKU_PROJECT_DATABASE_PATH=<project sqlite path>
   RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH=<backup sqlite path>
   ```

9. The migration config validates the supplied backup and sidecar metadata
   before it exposes the database URL to Drizzle Kit.
10. Drizzle Kit compares the existing database's migration state with the
    installed package's migration journal and applies the pending SQL files.
11. Core reopens the database and checks that the database schema generation now
    matches the installed runtime's expected generation.
12. The CLI or caller receives a migration report that includes the backup path.

If backup creation or backup verification fails, migration must not start.

If Drizzle Kit fails after the backup has been created, the structured error
must include the backup path and a recovery suggestion. Renku Studio does not
automatically restore the backup because automatic restore could hide the
partially failed migration state.

## Existing Project Upgrade In A Packaged Studio App

A packaged Studio app should use the same core operation.

The UI and local server may detect that a project database cannot be opened
because its schema generation is older than the installed runtime. The product
experience can show an explicit upgrade state, but the mutation must still be:

```text
Studio server -> core project database migrator -> Drizzle Kit -> core backup report
```

The local server must not implement its own migration planner, backup logic, or
schema compatibility readers. It should translate the core migration report and
structured errors for the UI.

## Direct Drizzle Config Path

The lower-level migration config remains useful for package-owned migration
operations and administrative debugging:

```bash
RENKU_PROJECT_DATABASE_PATH=/absolute/path/to/project.sqlite \
  drizzle-kit migrate --config drizzle.project-migrate.config.ts
```

This config is a distributed runtime entrypoint. Therefore:

- it must import backup lifecycle code from `dist/`, not from `src/`;
- it must refer to the compiled schema module in `dist/`, not to the source
  schema module;
- it must be able to run from an installed `@gorenku/studio-core` package;
- it must preserve the same backup gate as core's higher-level migrator.

The config may create a backup itself when it is run directly without
`RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH`. That keeps direct Drizzle
Kit migration protected. When core has already created a backup and passes the
backup path through the environment, the config should validate that backup
instead of creating another one.

## Migration Config Runtime Imports

A packaged migration config must not import source files. A config shaped like
this is invalid for installed packages:

```ts
} from './src/server/database/lifecycle/project-database-backups.ts';
```

That import works in the source checkout but fails in an installed package
because `src/` is not shipped.

The config must consume the built runtime that the package actually ships:

```ts
import {
  PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH_ENV,
  prepareProjectDatabaseMigrationTarget,
} from './dist/server/database/lifecycle/project-database-backups.js';
```

The config should also point Drizzle Kit at the built schema path:

```ts
schema: './dist/server/schema/index.js'
```

Do not fix this by shipping `src/`.

Do not fix this by adding a public re-export solely for the migration config.
The backup lifecycle helper is an internal core database lifecycle module. The
config is in the same package and can import the built internal file directly.

## Package Contract Checks

This area needs release-contract tests because ordinary workspace tests can pass
while installed packages fail.

Core package verification should cover:

- the package is built before packing;
- `npm pack` or `pnpm pack` output for `@gorenku/studio-core` includes:
  - `dist/server/database/lifecycle/project-database-backups.js`;
  - `dist/server/schema/index.js`;
  - `drizzle.project-migrate.config.ts`;
  - `drizzle/meta/_journal.json`;
  - all generated SQL migrations referenced by the journal;
- `drizzle.project-migrate.config.ts` has no `./src/` imports or source schema
  paths;
- an installed-package smoke test can create a new project database;
- an installed-package smoke test can migrate an older non-empty project
  database and leaves a verified backup beside it.

The migrator should also resolve Drizzle Kit through package dependency
resolution. It should not depend on a specific physical layout such as:

```text
<corePackageRoot>/node_modules/drizzle-kit/bin.cjs
```

Package managers may hoist or link dependencies differently. Core owns the
dependency on Drizzle Kit, so core should resolve Drizzle Kit as a dependency
from core's module context.

## Non-Goals

Do not add a second runtime schema initializer for new projects.

Do not add TypeScript migration registries or copy generated SQL into runtime
code.

Do not add Studio server, CLI, or React migration rules. Those layers are
adapters over core.

Do not keep compatibility readers for historical database shapes in normal
runtime paths.

Do not automatically restore a backup after a failed migration.

Do not ship source files as a shortcut around broken package-runtime imports.
