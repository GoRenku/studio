# 0102 Project Database Pre-Migration Backups

Status: completed
Date: 2026-07-02
Completed: 2026-07-04

## Summary

Add a core-owned pre-migration backup step for Renku Studio project SQLite
databases.

The immediate problem is practical: after a new migration runs, a development
project database can become unusable, and recovery is slow because the last good
database state is not reliably preserved. The fix should not live in CLI
handlers, Studio routes, React, or ad hoc agent instructions. The migration
operation is owned by `packages/core`, so the backup must be owned by the same
core migration lifecycle.

The accepted behavior should become:

1. Before an existing project database is passed to Drizzle Kit migration,
   Renku Studio creates a verified SQLite backup beside the project database.
2. Migration starts only after the backup is durable and can be opened.
3. Every supported migration path uses the same core backup contract.
4. A migration failure reports the backup path clearly so recovery is immediate.
5. New project creation does not create meaningless backups before the initial
   empty database is created.

This plan protects the project-local database:

```text
<project-folder>/.renku/project.sqlite
```

by writing pre-migration backups under:

```text
<project-folder>/.renku/project-database-backups/
```

## References Reviewed

- Current Drizzle Kit documentation through Context7:
  `/drizzle-team/drizzle-orm-docs`, query for SQLite migration commands and
  config fields.
- SQLite official `VACUUM INTO` documentation:
  `https://www.sqlite.org/lang_vacuum.html`.
- `docs/architecture/reference/drizzle-migrations.md`
- `docs/decisions/0011-use-drizzle-kit-for-project-sqlite-migrations.md`
- `docs/architecture/reference/project-storage-boundaries.md`
- `docs/architecture/reference/structured-diagnostics.md`
- `docs/architecture/coding-practices.md`
- `packages/core/src/server/database/lifecycle/migrator.ts`
- `packages/core/src/server/database/lifecycle/store.ts`
- `packages/core/src/server/commands/migrate-database.ts`
- `packages/core/drizzle.project-migrate.config.ts`
- `packages/cli/src/commands/project-selection-command.ts`
- `docs/cli/commands.md`

## Current Problem

Project database migration currently has no safety checkpoint.

The main core migrator is:

```text
packages/core/src/server/database/lifecycle/migrator.ts
```

It resolves the core package root and spawns:

```text
drizzle-kit migrate --config drizzle.project-migrate.config.ts
```

with:

```text
RENKU_PROJECT_DATABASE_PATH=/absolute/path/to/project.sqlite
```

This is architecturally good in one important way: Drizzle Kit still owns the
actual migration application. But it has one dangerous gap: the database is
handed to Drizzle Kit without first preserving the old file.

That means these cases are painful:

- A custom migration has a SQL mistake and partially changes the database.
- A migration succeeds structurally but corrupts an invariant that runtime code
  expects.
- A migration file was edited after a local project already applied an earlier
  version.
- The Studio dev server auto-migrates a project during open, and the failure
  appears later as a project load error.
- The user or agent has to manually inspect `__drizzle_migrations`,
  `PRAGMA user_version`, migration files, and project state to reconstruct what
  happened.

The recovery cost is high because there is no guaranteed "last known good"
database copy from immediately before migration.

## Goals

- Create a backup before every supported migration of an existing project
  database.
- Keep the backup operation in `packages/core`, the owner of project database
  lifecycle.
- Cover both explicit migration and auto-migration:
  - `renku project migrate <project-name>`
  - project-open auto-migration through `openProjectStore`
- Keep the lower-level Drizzle project-migrate config protected so direct
  `db:migrate:project` usage cannot silently bypass the backup.
- Keep Drizzle Kit as the migration engine.
- Return the backup path from the core migration report.
- Include the backup path in structured migration failures.
- Write a small metadata sidecar so a person can identify what each backup was
  created for.
- Keep recovery obvious even before a full restore command exists.
- Add tests that prove migration does not start when the backup cannot be
  created or verified.

## Non-Goals

- Do not replace Drizzle Kit with an application-owned SQL migration runner.
- Do not create a TypeScript migration registry.
- Do not copy generated migration SQL into runtime code.
- Do not add route-local, CLI-local, React-local, or agent-local migration
  backup rules.
- Do not auto-restore a failed migration in this first slice.
- Do not add compatibility readers for older schemas.
- Do not use the old in-repository `sample-project/` or `sample-project.yaml`.
- Do not optimize or test mobile behavior.

## Core Decision

The migration backup is a project database lifecycle concern.

It belongs under:

```text
packages/core/src/server/database/lifecycle/
```

The primary implementation module should be:

```text
packages/core/src/server/database/lifecycle/project-database-backups.ts
```

This module should own:

- deriving the backup directory from the database path;
- building deliberate backup filenames;
- creating the SQLite backup;
- verifying that the backup can be opened;
- writing backup metadata;
- returning a structured backup report;
- throwing `ProjectDataError` when backup creation or verification fails.

The existing migrator should call this module before it spawns Drizzle Kit:

```text
packages/core/src/server/database/lifecycle/migrator.ts
```

The Studio server and CLI must not implement their own backup logic. They should
only display or serialize the report returned by core.

## Backup Contract

Add a core server contract for migration backup metadata:

```ts
export interface ProjectDatabasePreMigrationBackupReport {
  backupPath: string;
  metadataPath: string;
  createdAt: string;
  sourceSchemaGeneration: number | null;
  targetSchemaGeneration: number;
  sourceDatabaseSizeBytes: number;
  backupDatabaseSizeBytes: number;
}
```

Update the existing migration report:

```ts
export interface ProjectDatabaseMigrationReport {
  projectName: string;
  projectPath: string;
  databasePath: string;
  preMigrationBackup: ProjectDatabasePreMigrationBackupReport | null;
}
```

`preMigrationBackup` is `null` only when no existing database file had to be
protected, such as the first migration during new project creation.

No compatibility alias should be added for the previous report shape. Renku
Studio is pre-customer software, and callers should be updated directly.

## Backup Location

Store backups beside the project database, inside the project-owned `.renku`
folder:

```text
<project-folder>/.renku/project-database-backups/
```

This keeps the backup with the project when the project folder is moved.

Use filenames that are useful during a stressful recovery session:

```text
project-before-migration-from-generation-34-to-35-20260702T132455123Z-8f31c2.sqlite
project-before-migration-from-generation-34-to-35-20260702T132455123Z-8f31c2.json
```

Rules:

- Use UTC timestamps.
- Include the source `PRAGMA user_version` when it can be read.
- Include the target schema generation from
  `currentProjectStoreSchemaGeneration()`.
- Include a short random suffix so repeated migrations in the same millisecond
  do not collide.
- Do not overwrite an existing backup file.
- Do not automatically prune backups in this slice.

## Backup Metadata

Write a sidecar JSON file next to each backup:

```json
{
  "kind": "projectDatabasePreMigrationBackup",
  "createdAt": "2026-07-02T13:24:55.123Z",
  "databasePath": "/absolute/project/.renku/project.sqlite",
  "backupPath": "/absolute/project/.renku/project-database-backups/project-before-migration-from-generation-34-to-35-20260702T132455123Z-8f31c2.sqlite",
  "sourceSchemaGeneration": 34,
  "targetSchemaGeneration": 35,
  "sourceDatabaseSizeBytes": 1048576,
  "backupDatabaseSizeBytes": 983040,
  "verification": {
    "opened": true,
    "quickCheck": "ok"
  }
}
```

This sidecar is intentionally filesystem metadata, not a database table. The
backup exists to recover the database when the database itself may be broken.

## SQLite Backup Method

Use SQLite `VACUUM INTO` through `better-sqlite3` for this slice.

Reasoning:

- It is synchronous, which fits the current synchronous project store lifecycle.
- It creates a consistent snapshot of the source database.
- It works through the existing `better-sqlite3` dependency.
- It avoids changing `openProjectStore` and all database read paths to async.
- It avoids a plain `fs.copyFile` of `project.sqlite`, which can be risky if
  SQLite journal behavior changes later.

Implementation shape:

```ts
const sqlite = new Database(databasePath, { readonly: true });
sqlite.prepare('vacuum main into ?').run(partialBackupPath);
sqlite.close();
```

Then:

1. Open the backup read-only.
2. Run `PRAGMA quick_check`.
3. Verify the result is `ok`.
4. Read `PRAGMA user_version` from the backup and confirm it matches the source
   value when the source value was readable.
5. Rename the partial backup to the final backup path only after verification.
6. Write the sidecar metadata.

If `VACUUM INTO` fails, migration must not start.

## Migration Hook Points

### Core Migrator

Update:

```text
packages/core/src/server/database/lifecycle/migrator.ts
```

Current shape:

```ts
export function migrateProjectDatabase(databasePath: string): void
```

Planned shape:

```ts
export function migrateProjectDatabase(
  databasePath: string
): ProjectDatabaseMigrationRunReport
```

`ProjectDatabaseMigrationRunReport` should include:

- `databasePath`
- `preMigrationBackup`

The function should:

1. Resolve the core package root.
2. Validate the Drizzle project-migrate config.
3. Validate the Drizzle Kit executable.
4. Create a pre-migration backup if `databasePath` already exists and is
   non-empty.
5. Spawn Drizzle Kit only after the backup succeeds.
6. Pass the backup path to the child process in an environment variable:

   ```text
   RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH=/absolute/path/to/backup.sqlite
   ```

7. Include the backup path in `PROJECT_DATA042` failures.

### Drizzle Project-Migrate Config Safety Net

Update:

```text
packages/core/drizzle.project-migrate.config.ts
```

This config should remain the only Drizzle Kit config used to apply migrations
to a project-local database.

Add a small safety gate:

```ts
prepareProjectDatabaseMigrationTarget(databasePath);
```

The safety gate should:

- do nothing when `RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH` points to
  an existing verified backup for the same database;
- validate the matching sidecar metadata before trusting that environment
  value;
- do nothing when the target database does not exist yet;
- create a backup itself when the target database exists and the caller invoked
  Drizzle Kit directly;
- write a plain stderr line with the created backup path when it had to create
  the backup itself.

This keeps the lower-level command protected:

```bash
RENKU_PROJECT_DATABASE_PATH=/absolute/path/to/project.sqlite \
  pnpm --filter @gorenku/studio-core db:migrate:project
```

The config hook must not inspect feature tables, repair domain data, or make
schema decisions. Its only job is to ensure the database file is backed up
before Drizzle Kit starts applying migrations.

### Explicit CLI Migration

Update:

```text
packages/core/src/server/commands/migrate-database.ts
packages/cli/src/commands/project-selection-command.ts
```

`renku project migrate <project-name>` should display:

```text
Renku project database migrated: constantinople
Project: /path/to/constantinople
Database: /path/to/constantinople/.renku/project.sqlite
Pre-migration backup: /path/to/constantinople/.renku/project-database-backups/project-before-migration-from-generation-34-to-35-...
```

JSON output should include the `preMigrationBackup` object from core.

### Auto-Migration On Project Open

Update:

```text
packages/core/src/server/database/lifecycle/store.ts
```

The existing auto-migration path already calls `migrateProjectDatabase` after
closing the invalid-generation SQLite connection.

That is the right architecture. Once `migrateProjectDatabase` owns backup
creation, auto-migration gets backups automatically.

If auto-migration fails, the thrown structured error should include the backup
path and a suggestion such as:

```text
A pre-migration backup was created at <path>. Stop Studio before restoring it over project.sqlite.
```

## Error Codes

Keep migration errors in the `PROJECT_DATA...` namespace.

Use focused codes for backup failures:

- `PROJECT_DATA046`: pre-migration backup could not be created.
- `PROJECT_DATA047`: pre-migration backup could not be verified.
- `PROJECT_DATA048`: pre-migration backup metadata could not be written.

Existing migration process failures can remain:

- `PROJECT_DATA040`: migration config or executable missing.
- `PROJECT_DATA041`: Drizzle Kit command failed to start.
- `PROJECT_DATA042`: Drizzle Kit migration failed.
- `PROJECT_DATA043`: core package root resolution failed.
- `PROJECT_DATA044`: project database schema generation mismatch.
- `PROJECT_DATA045`: migration journal or schema-generation metadata invalid.

Every backup-related error should include:

- the source database path;
- the attempted backup path when one exists;
- whether migration was skipped;
- a concrete suggestion.

## Recovery Runbook

Add a short recovery section to:

```text
docs/architecture/reference/drizzle-migrations.md
docs/cli/commands.md
```

Recovery should be explicit and conservative:

1. Stop Studio and any CLI process using the project.
2. Locate the backup path from the failed command output or
   `.renku/project-database-backups/`.
3. Move the broken `project.sqlite` aside with a timestamped name.
4. Copy the selected backup to `.renku/project.sqlite`.
5. Re-run the migration only after the migration code has been fixed.

Do not implement automatic restore in the first slice. Automatic restore sounds
friendly but can hide whether the migration changed anything before failing.
The first slice should make recovery easy without silently mutating the
database again.

## Why This Is Not A Compatibility Layer

This plan does not preserve old database shapes.

The backup is a recovery snapshot of the current project database before a
one-way migration. Runtime code still supports only the current schema
generation. If a migration exposes an invalid older state, the fix remains a
new forward migration or a corrected current migration path, not a reader for
old table shapes.

The backup mechanism is lifecycle safety, not schema compatibility.

## Documentation Updates

Update:

```text
docs/architecture/reference/drizzle-migrations.md
```

Add:

- every existing project database is backed up before migration;
- backup location and filename pattern;
- report shape;
- recovery runbook;
- direct Drizzle Kit migration through `drizzle.project-migrate.config.ts`
  remains protected by the config safety gate;
- new project creation does not create a pre-migration backup for an empty
  database.

Update:

```text
docs/cli/commands.md
```

Add:

- human output includes `Pre-migration backup`;
- JSON output includes `preMigrationBackup`;
- how to find backups after a failed migration.

Consider adding an ADR:

```text
docs/decisions/0041-use-core-owned-pre-migration-database-backups.md
```

Use the ADR if reviewers want this backup behavior recorded as accepted
architecture rather than only reference documentation.

## Architecture Test Impact

No new adapter boundary should be necessary if the implementation stays in
core.

Existing boundaries still apply:

- CLI calls `ProjectDataService.migrateProjectDatabase`.
- Studio server routes do not call Drizzle Kit.
- React does not read project files, SQLite, Drizzle, or backup directories.

Add or update static tests only if implementation introduces a new bypass risk,
for example:

- a CLI command importing `better-sqlite3`;
- a Studio server route importing the backup module directly;
- feature code reading `.renku/project-database-backups`.

The expected implementation should not need those imports.

## Validation Strategy

### Focused Core Tests

Add tests near:

```text
packages/core/src/server/database/lifecycle/project-database-backups.test.ts
packages/core/src/server/commands/migrate-database.test.ts
```

Required coverage:

- Missing database path returns `preMigrationBackup: null` and allows initial
  migration for new project creation.
- Existing database creates a backup before migration.
- Backup can be opened read-only after migration.
- Backup preserves the old `PRAGMA user_version`.
- Backup preserves a known row that the migration later changes or removes.
- Backup metadata sidecar is written.
- Backup filename includes source generation, target generation, timestamp, and
  suffix.
- Backup creation failure prevents Drizzle Kit from running.
- Backup verification failure prevents Drizzle Kit from running.
- Migration failure includes the backup path in the structured error.
- Auto-migration through `openProjectStore` creates a backup.
- Direct use of `drizzle.project-migrate.config.ts` creates or validates a
  backup before Drizzle Kit applies migrations.

### CLI Tests

Update:

```text
packages/cli/src/cli.test.ts
```

Required coverage:

- `renku project migrate <project-name> --json` includes
  `preMigrationBackup`.
- Human output includes `Pre-migration backup:`.
- No stderr noise appears on a successful JSON migration.
- When migration fails after a backup is created, stderr includes the structured
  error and backup path.

### Manual Verification

Use the real development project only after tests pass:

```text
/Users/keremk/renku-movies/urban-basilica
```

Manual verification should:

- run `renku project migrate urban-basilica`;
- confirm a new file appears under
  `.renku/project-database-backups/`;
- open the backup with SQLite and confirm `PRAGMA quick_check` returns `ok`;
- confirm the command output shows the backup path;
- confirm Studio can still open the project after migration.

Do not use the stale in-repository `sample-project/` or `sample-project.yaml`.

## Implementation Slices

### Slice 1: Core Backup Module

- Add `project-database-backups.ts`.
- Add backup report types.
- Implement backup directory derivation.
- Implement backup filename generation.
- Implement `VACUUM INTO` backup creation.
- Implement backup verification.
- Implement sidecar metadata writing.
- Add focused backup unit tests.

### Slice 2: Core Migrator Integration

- Change `migrateProjectDatabase` to return a migration run report.
- Create backup before spawning Drizzle Kit.
- Pass the backup path into the child environment.
- Include backup path in migration failure errors.
- Update `createMovieProject` to ignore `preMigrationBackup: null` for the
  initial database migration.
- Update auto-migration tests.

### Slice 3: Drizzle Config Safety Gate

- Update `drizzle.project-migrate.config.ts`.
- Ensure direct Drizzle project migrations create a backup when core did not
  already create one.
- Ensure core-spawned Drizzle does not create a duplicate backup.
- Add tests for the direct lower-level command.

### Slice 4: Service And CLI Report Shape

- Update `ProjectDatabaseMigrationReport`.
- Update `migrateProjectDatabaseForProject`.
- Update CLI human output.
- Update CLI JSON tests.
- Update any fake project-data service fixtures that need the new report field.

### Slice 5: Documentation And Recovery Runbook

- Update Drizzle migration reference documentation.
- Update CLI command documentation.
- Add ADR if reviewers want the behavior promoted to a decision record.
- Include the exact backup directory and restore steps.

### Slice 6: Final Verification

- Run focused core tests.
- Run focused CLI tests.
- Run `pnpm --filter @gorenku/studio-core test` if the focused suite is stable.
- Run `pnpm test:cli`.
- Run `pnpm check` if the worktree is stable enough for a full check.
- Manually verify with `urban-basilica` only after automated tests pass.

## Completion Checklist

### Review Area

- [x] Confirm the plan protects the real failure mode: corruption after new
      migrations.
- [x] Confirm the backup is created before Drizzle Kit starts mutating an
      existing database.
- [x] Confirm the design covers explicit `renku project migrate`.
- [x] Confirm the design covers auto-migration during project open.
- [x] Confirm the design covers the lower-level Drizzle project-migrate config.
- [x] Confirm new project creation does not create empty, misleading backups.
- [x] Confirm no route-local, CLI-local, React-local, or agent-local backup
      rule is introduced.

### Architecture And Ownership

- [x] Keep backup creation under `packages/core`.
- [x] Keep Drizzle Kit as the migration application engine.
- [x] Do not add a TypeScript migration registry.
- [x] Do not copy generated migration SQL into runtime code.
- [x] Do not add compatibility readers for old schemas.
- [x] Do not add generic state patch APIs or broad lifecycle escape hatches.
- [x] Keep CLI as a thin caller of `ProjectDataService`.
- [x] Keep Studio server routes away from SQLite, Drizzle, and backup files.
- [x] Keep React feature code away from filesystem and database lifecycle.

### Contracts And Naming

- [x] Add `ProjectDatabasePreMigrationBackupReport`.
- [x] Add `preMigrationBackup` to `ProjectDatabaseMigrationReport`.
- [x] Use deliberate backup directory name:
      `.renku/project-database-backups/`.
- [x] Use deliberate backup metadata kind:
      `projectDatabasePreMigrationBackup`.
- [x] Use focused error codes for backup creation, verification, and metadata
      failures.
- [x] Update all callers directly to the new report shape.
- [x] Do not add report aliases for the old shape.

### Core Implementation

- [x] Add `packages/core/src/server/database/lifecycle/project-database-backups.ts`.
- [x] Derive backup folder from the canonical database path.
- [x] Create the backup directory recursively.
- [x] Build collision-resistant backup filenames.
- [x] Read source `PRAGMA user_version` when available.
- [x] Read target generation from the current project-store migration metadata.
- [x] Create backups with SQLite `VACUUM INTO`.
- [x] Use a partial path before publishing the final backup path.
- [x] Verify the backup opens read-only.
- [x] Run `PRAGMA quick_check` against the backup.
- [x] Write sidecar metadata after verification.
- [x] Return a structured backup report.
- [x] Fail before migration if backup creation fails.
- [x] Fail before migration if backup verification fails.
- [x] Fail before migration if metadata cannot be written.

### Migrator Integration

- [x] Update `migrateProjectDatabase` to return a migration run report.
- [x] Create backup before spawning Drizzle Kit.
- [x] Pass `RENKU_PROJECT_DATABASE_PRE_MIGRATION_BACKUP_PATH` to Drizzle Kit.
- [x] Include backup path in `PROJECT_DATA042` migration failures.
- [x] Preserve existing config and executable validation behavior.
- [x] Keep `spawnSync` migration behavior unless there is a separate accepted
      reason to make project-store opening async.
- [x] Ensure `createMovieProject` still works for first-time database creation.
- [x] Ensure `openProjectStore` auto-migration remains core-owned and thin.

### Drizzle Config Safety

- [x] Update `packages/core/drizzle.project-migrate.config.ts`.
- [x] Require `RENKU_PROJECT_DATABASE_PATH` as today.
- [x] Validate an existing pre-migration backup path when core supplied one.
- [x] Validate the sidecar metadata for the supplied backup path.
- [x] Create a backup when Drizzle Kit is invoked directly without the core
      migrator's environment marker.
- [x] Do not create duplicate backups for core-spawned migrations.
- [x] Do not put domain table repair logic in the Drizzle config.
- [x] Do not make the config inspect feature-specific project data.

### CLI Surface

- [x] Update human output for `renku project migrate`.
- [x] Update JSON output for `renku project migrate --json`.
- [x] Ensure successful JSON output stays on stdout.
- [x] Ensure errors and suggestions stay on stderr.
- [x] Include the backup path in migration failure diagnostics.
- [x] Update CLI tests for the new report shape.

### Documentation

- [x] Update `docs/architecture/reference/drizzle-migrations.md`.
- [x] Update `docs/cli/commands.md`.
- [x] Document backup location.
- [x] Document filename pattern.
- [x] Document when `preMigrationBackup` is `null`.
- [x] Document manual recovery steps.
- [x] ADR not added because no separate decision record was requested; the
      accepted behavior is recorded in the migration reference documentation.

### Tests

- [x] Add core backup module tests.
- [x] Add explicit migration backup tests.
- [x] Add auto-migration backup tests.
- [x] Add direct Drizzle project-migrate config backup tests.
- [x] Add backup failure prevents migration test.
- [x] Add backup verification failure prevents migration test.
- [x] Add migration failure reports backup path test.
- [x] Update CLI JSON migration test.
- [x] Update CLI human migration test.
- [x] Confirm no fake project-data service fixture updates were needed.

### Final Verification

- [x] Run focused core migration and backup tests.
- [x] Run focused CLI migration tests.
- [x] Run `pnpm --filter @gorenku/studio-core test` if focused tests pass.
- [x] Run `pnpm test:cli`.
- [x] Run `pnpm check` when the local worktree is stable enough.
- [x] Verify `urban-basilica` creates a backup before migration.
- [x] Verify the created backup opens and `PRAGMA quick_check` returns `ok`.
- [x] Verify the migrated `urban-basilica` project opens through the core
      project read path used by Studio.
