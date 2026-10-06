# 0223 Reliable Project Upgrades And Native Release Verification

Status: implemented locally — other-machine verification deferred by user
Date: 2026-10-06

## Summary

A Windows installation updated successfully but could no longer open its Project,
reporting `PROJECT_DATA046`, “Could not create a pre-migration backup.” Fix the
backup defect, prove data preservation through the complete upgrade, and add
native populated-project upgrade verification tooling without changing the default
local release workflow.

The user journey is: update Renku, reopen an existing Project, continue working
with the same saved work and media. When storage or migration fails, the Project
must remain recoverable and the error must explain the failed operation. A
successful installer or an empty-database smoke test does not prove this journey.

## Review Attention

- **Immediate repair:** Open the newly created backup with a writable,
  non-truncating handle before flushing it. Keep the backup requirement; never
  ignore a failed file flush just to let migration proceed.
- **Necessary hardening:** Preserve the original structured error when cleanup
  also fails, retain recovery context through post-SQL registration, and close
  cached Core sessions before explicit migration. These address concrete failure
  paths in the existing lifecycle, not new Project features.
- **Explicit user amendment (2026-10-06):** Local build and publication remain
  the default. GitHub Actions is maintained as an optional future path and must
  not be dispatched by `pnpm release` or `pnpm release:publish`. Local publication
  accepts host runtime smoke and cross-target structural reports. Verification
  on the user's other Windows and Linux machines is separate-session work, not
  a publication prerequisite. No Linux release target or remote runner is added.
- **Contracts:** Keep existing Project commands, HTTP routes, backup reports,
  backup folder/names, and error codes. Populate existing diagnostic issues with
  operation/path/cause details. Extend internal release evidence and its validator
  to validate archive-bound upgrade results when supplied. Ordinary local smoke
  reports remain valid. No new Settings or Project schema.
- **Data effects:** No real Project is modified by this implementation. The repair
  itself requires no SQL migration. Future verification uses disposable projects
  and retained backups. Do not rewrite shipped migration 0089 or earlier history;
  any subsequently demonstrated SQL defect needs a separately documented forward
  repair under the Drizzle Kit workflow. No automatic restore, pruning, or deletion
  of user backups is proposed.
- **Assumptions and remaining proof:** Repository HEAD is release `v0.1.25`.
  The reported installed version and precise OS error are not independently
  verified. The Windows handle defect is confirmed from source and platform
  documentation; the exact error was reproduced with a simulated Windows flush
  restriction on macOS. A native Windows reproduction remains unverified follow-up work.
- **Scope decisions:** The user explicitly rejected making GitHub Actions or
  full native evidence mandatory for local publication. There is no new updater,
  restore UI, compatibility reader, or migration engine. If concurrency testing
  demonstrates a need for new cross-process coordination, stop and amend this
  plan with its exact ownership and lifecycle before implementing that mechanism.
- **Necessary internal boundary adjustment:** Drizzle Kit loads its config as
  CommonJS, while shared diagnostics are ESM. A compiled internal Core backup-gate
  executable preserves the normal diagnostics entrypoint and direct-config
  backup protection. No compatibility package export was added. A focused Core
  module shares recovery context between schema readiness and registration.
- **Verification status:** Apple Silicon verification is available locally;
  Windows, Intel Mac, supported OS baselines and interactive desktop handoff
  are deferred follow-up work. Missing results are never described as passing.
  The optional CI workflow still requires its native matrix to pass. The planning skill explicitly excludes implementing an
  accepted plan; this document is maintained as the implementation progress record.

## Requirements Ledger

| ID | Source | Required outcome | Owner and verification |
| --- | --- | --- | --- |
| R1 | User incident | Diagnose and repair the backup failure on Windows; assess Mac exposure | Core backup lifecycle; native backup and open tests |
| R2 | User reliability request | Exercise real release upgrades and prevent recurrence | Local release tooling and optional native CI; other-machine verification deferred |
| R3 | Data-integrity boundary | No upgrade writes without a verified backup; preserve saved work and recovery evidence | Core lifecycle and Drizzle; fault and preservation tests |
| R4 | Accepted architecture | Core owns readiness and diagnostics; Drizzle owns SQL application; adapters remain thin | Existing entrypoints; runtime/import boundary tests |
| R5 | Existing distribution contract | Shipped history is append-only; verify exact installed artifacts | Release fixtures and archive-bound reports |
| R6 | Existing Plan 0222 contract | Reference registration must finish before publishing a usable session | Asset-file backfill and store; retry/idempotence tests |

## Diagnosis And Evidence

### Confirmed Windows defect

`packages/core/src/server/database/lifecycle/project-database-backups.ts` creates
the backup through SQLite `VACUUM INTO`, then calls `syncFile`. That helper uses:

```ts
const fd = openSync(filePath, 'r');
fsyncSync(fd);
```

Node 24.16.0's bundled libuv implements Windows `fsync` with `FlushFileBuffers`.
Microsoft requires write access on that handle. Opening it with `r` does not
provide that access. The resulting exception is caught by the backup-creation
branch and becomes `PROJECT_DATA046`. This happens before spawning Drizzle Kit.
Ordinary folder write permission does not fix the wrongly opened handle.

The code predates the latest release. Release `v0.1.25` adds migration
`0089_unified_asset_files.sql` and advances generation 70 to 71. That gives an
existing generation-70 Project a reason to traverse the faulty backup path.
This version transition is repository evidence, not a claim about the user's
unobserved previous installation version.

The same helper is used for pending reference registration after SQL migration.
Therefore the error code alone does not establish the entire historical state
of the user's database. In the usual automatic schema-upgrade path the backup
fails before SQL starts; a later registration-only attempt can also call it.
Do not promise that no earlier attempt changed anything without inspecting the
affected database.

Primary references checked on 2026-10-06:

- [Microsoft FlushFileBuffers access requirement](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)
- [Node v24.16.0 Windows filesystem implementation](https://github.com/nodejs/node/blob/v24.16.0/deps/uv/src/win/fs.c)
- [SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html)
- [Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)

### Experiments completed during diagnosis

| Experiment | Result | Limit |
| --- | --- | --- |
| Existing backup test file on macOS, Node 24.16.0 | 6/6 passed | Does not exercise Windows filesystem semantics |
| Existing migration-0089 test file on macOS | 5/5 passed | Narrow database fixtures; not an installed update journey |
| Real backup routine, disposable database, native Mac flush | Passed; source SHA-256 unchanged | One Mac host |
| Same routine with Windows read-only flush restriction injected | Exact `PROJECT_DATA046`; source SHA-256 unchanged | Controlled simulation, not native Windows execution |
| Same simulation with only the backup handle changed to `r+` in the experiment | Passed; source SHA-256 unchanged | Production code was not edited |
| Read-only Urban Basilica inspection | Generation 71, backfill complete, `quick_check=ok`, zero foreign-key issues; 278 AssetFiles and 51 selections | Already upgraded; not evidence for another Mac installation |

The local test command warned that installed dependencies and the lockfile are
out of sync. No dependencies were installed or changed. Final release proof must
use the pinned clean build and bundled runtime, not this workspace alone.

### Why existing checks missed it

1. `.github/workflows/release.yml` builds on Windows and both Mac architectures,
   but does not run the Core backup tests. Its runtime verifier creates a new
   Project. A missing/empty database deliberately skips pre-migration backup.
2. `scripts/release/verify-product.mjs` checks CLI creation and Studio module
   import. It explicitly records that Studio HTTP startup was not tested.
3. `scripts/release/verify-studio-update.mjs` is Mac-only and copies one build
   into versions `0.0.1` and `0.0.2`. It tests handoff but both versions have the
   same schema; it cannot establish database-upgrade safety.
4. `build-local-release.mjs` checks non-host targets structurally, and
   `publish-github-release.mjs` accepts either structural or runtime reports.
   Thus even the native build workflow is not a universal publication gate.
5. The backup suite has basic happy-path, supplied-backup and blocked-directory
   cases, but no file-flush failure, cleanup failure, WAL-content preservation,
   interruption, or native Windows assertions.

### Additional concrete weaknesses to address

- `cleanupPartialFile` can throw while handling another failure, replacing the
  original structured diagnostic with a raw deletion error.
- Initial `statSync` and final size inspection can escape backup-stage error
  wrapping. `ProjectDatabaseBackupError` lacks the shared diagnostic issue shape;
  backfill calls it directly, whereas the migrator translates it.
- Explicit migration closes the cached Project store **after** migration. Move
  that closure before the migration boundary and verify handles are released.
- SQL success and reference-registration success are separate boundaries.
  Backfill errors currently close the newly opened connection but can lose the
  previously created backup location. Retrying must finish registration without
  duplicate rows, lost selections, or rewriting file bytes.
- `syncDirectory` suppresses every error. Document the platform durability limit;
  distinguish a specifically unsupported directory-sync operation from a genuine
  I/O failure. Do not describe best-effort directory persistence as a universal
  power-loss guarantee.

Other causes of code 046, including inaccessible folders, disk exhaustion, path
limits and SQLite locks, remain possible. They belong in the fault matrix; they
are not independently diagnosed causes of this incident.

## Context And Chosen Scope

Accepted references: `AGENTS.md`, `docs/architecture/coding-practices.md`,
`docs/architecture/project-database-distribution.md`,
`docs/architecture/reference/drizzle-migrations.md`,
`docs/architecture/reference/structured-diagnostics.md`,
`docs/operations/distribution-and-release.md`, and ADRs 0011 and 0107.

Completed Plans 0102, 0212 and 0222 establish backups, update handoff and unified
AssetFiles respectively. Leave those implementation records intact. The migration
reference still has earlier paragraphs prohibiting runtime migration, alongside
its current “Shipped Project Upgrades” section allowing Core-owned automatic
upgrade. Reconcile that contradiction in current docs, preserving the implemented
Core boundary rather than adding migration behavior to HTTP handlers.

Options considered:

1. Keep all existing implementation unchanged and only add tests: insufficient;
   the Windows flush contract is violated.
2. Repair and harden the existing Core lifecycle and extend the existing release
   verifier: selected. Preserves the public Project model and the migration owner.
3. Replace the backup/update engine: unnecessary for the demonstrated failure.

No creative content interpretation belongs in runtime checks. Preservation tests
compare opaque text/JSON/file bytes and application-owned relationships. They do
not score images, rewrite prompts, or require creative content to match templates.

## Product And Failure Behavior

1. Existing valid Projects upgrade through the current Core automatic-open or
   explicit `renku project migrate <projectName>` path. Direct Drizzle invocation
   retains the same backup gate.
2. Existing nonempty database: create a SQLite-consistent backup, flush its file,
   verify it, and publish its metadata before upgrade writes. New Project creation
   continues to skip meaningless empty-database backups.
3. Backup/metadata failure: do not start migration or registration writes. Report
   the failed operation, native cause if present, relevant path and next action.
   Cleanup failures must not conceal the primary failure. Never remove a backup
   that has already passed verification merely because metadata publication fails.
4. SQL or post-SQL failure: do not return/cache a newly usable Project session.
   Preserve the verified backup and report its location. Distinguish “migration
   did not start” from “SQL may have run” and “reference registration failed.”
5. Successful reopen checks the target generation, migration completion and
   registration readiness. A subsequent ordinary open performs no migration,
   duplicate registration, or new backup. Explicit migrate retains its existing
   safety-backup behavior even when there are no pending SQL statements.
6. Failed operations can be retried after the cause is fixed. Interrupted SQL must
   recover through SQLite/Drizzle's tested transaction behavior; post-SQL work
   must be idempotent. Never infer success from exit code alone where readiness
   checks have not completed.
7. Recovery remains explicit. Instructions must stop all Project users, preserve
   the failed database and its WAL/SHM or journal files together, verify the backup,
   and restore into a clean database location. A stale WAL must never be replayed
   against a restored database. Test the procedure on disposable copies. The fix
   for a pre-SQL backup failure should ordinarily allow reopening without restore.

## Architecture Shape Gate

| File/module | Responsibility and intended change |
| --- | --- |
| `packages/core/src/server/database/lifecycle/project-database-backups.ts` | Existing internal backup entrypoints and report; correct file handle and focused error/cleanup handling. Keep backup-specific logic here. |
| `packages/core/src/server/database/lifecycle/migrator.ts` | Resolve packaged Drizzle, gate execution on backup, preserve structured failure context. No SQL interpreter or migration registry. |
| `packages/core/src/server/database/lifecycle/store.ts` | Readiness, connection ownership, session publication and post-upgrade recovery context. Keep domain conversion out of this file. |
| `packages/core/src/server/database/lifecycle/asset-file-backfill/persistence.ts` | Existing bounded reference registration transaction and completion marker. No migration orchestration added here. |
| `packages/core/src/server/commands/migrate-database.ts` | Existing Core command composition; close cached session before migration and complete readiness before success. |
| `packages/core/drizzle.project-migrate.config.ts` | Thin compiled-runtime backup gate for direct Drizzle usage. |
| `packages/core/src/server/database/lifecycle/project-database-migration-backup-gate.ts` | Internal ESM executable for the existing Core backup gate when Drizzle loads its CommonJS config; emits existing structured diagnostics, never applies SQL. |
| `packages/core/src/server/database/lifecycle/project-upgrade-errors.ts` | Core-owned recovery-context composition shared by store readiness and reference registration. |
| Lifecycle `project-database-backups.test.ts`, `project-database-backup-faults.test.ts`, `project-database-native-filesystem.test.ts`, `migrator-environment.test.ts`, `project-upgrade-readiness.test.ts` | Focused owning-layer backup, filesystem, supplied evidence, process failure, session and registration assertions. Mocked suites stay in the isolated test partition. |
| `scripts/release/upgrades/fixtures.mjs` | Test-only immutable source-release inventory, extraction and fixture identity checks. |
| `scripts/release/upgrades/preservation.mjs` | Test-only before/after observations and exact preservation assertions. |
| `scripts/release/upgrades/recipe.mjs`, `authored-documents.mjs` | Synthetic historical authoring; the genuine source SDK validates screenplay, analysis and Beats. Raw test rows populate the exact retained SQL relationship inventory. |
| `scripts/release/upgrades/process-lifecycle.mjs`, `sql-interruption.mjs` | Test-only explicit process milestones, contention, acknowledged writer, transaction interruption and clean-location recovery. No runtime locking protocol. |
| `scripts/release/upgrades/evidence.mjs`, `desktop-terminal.mjs` | Archive-bound evidence validation and native Terminal/PowerShell rehearsal launching. |
| `scripts/release/verify-release-upgrades.mjs` | Native archive extraction, required source fixture orchestration, evidence retention and final report composition. |
| `scripts/release/verify-project-upgrade.mjs` | Focused native packaged-CLI/HTTP upgrade verifier consuming fixture, preservation and process-lifecycle modules. |
| `scripts/release/verify-product.mjs`, `verify-studio-update.mjs` | Existing product smoke and handoff entrypoints; delegate upgrade assertions rather than accumulating fixture logic. |
| `scripts/release/publish.mjs`, `dispatch-release-workflow.mjs` | Keep local build/publication as default; explicit dispatch alone resumes and waits for the optional workflow. |
| `scripts/release/publish-github-release.mjs`, `build-local-release.mjs`, `.github/workflows/release.yml` | Accept local runtime/structural reports; strictly validate supplied native upgrade reports. The optional workflow runs the complete matrix. |
| `scripts/release/local-publication.test.mjs` | Exercise the local publish command and dry-run with process-boundary doubles; prove no Actions dispatch and preserve local staging/publication order. |

Public Project callers continue through `createProjectDataService()` and its
existing commands. No new package exports or re-export facades. Existing
`index.ts` entrypoints remain thin. The tests may have a bounded list of fixture
cases; runtime dispatch stays with existing owners. There is no new general
registry, coordinator, or platform abstraction in this plan.

Split test fixture construction from assertions; do not add another large mixed
command test file. In particular, new coverage belongs in focused lifecycle or
integration suites, not the already large `commands/migrate-database.test.ts`.
If backup error handling makes the existing module unreviewable, refactor the
bounded backup implementation before adding more cases; update this file map
before creating a new public boundary.

Stop if a solution needs adapter-owned readiness rules, arbitrary metadata patch
APIs, shipped-history rewrites, a new cross-process lock protocol, or a broad
store/command switchboard. Passing tests does not waive the ownership gate.

## Contracts

### Core and diagnostic contracts

Keep `createProjectDatabasePreMigrationBackup`,
`prepareProjectDatabaseMigrationTarget`,
`validateProjectDatabasePreMigrationBackup`, `migrateProjectDatabase`,
`openProjectStore`, existing reports, and the two existing migration environment
variables. Ensure the child environment cannot inherit an unrelated supplied
backup when the parent has no backup to pass.

Use `@gorenku/studio-diagnostics` for the backup error's structured shape and
preserve its issues through Core translation. Retain codes 046/047/048 for
creation/verification/metadata and 040–045 for their existing migration roles.
Use existing `DiagnosticIssue.location.filePath`, `path`, `context`, `message`
and `suggestion`; no new diagnostic DTO or Settings field is necessary. Messages
identify the operation and include available native error code/syscall. Cleanup
issues are secondary issues under the primary error, never a replacement error.

### Release verification contract

Add the development-only entrypoint:

```text
node scripts/release/verify-project-upgrade.mjs \
  --source-product <extracted-previous-product> \
  --target-product <extracted-candidate-product> \
  --report <upgrade-report.json>
```

The verifier must run on the target's actual platform/architecture, use the
candidate's bundled Node and dependencies, and validate both `RELEASE.json`
identities. Accept extracted products only from recorded checksum-verified
archives. Extend `verification.json` with `archiveSha256` and `projectUpgrades`.
Each upgrade entry records `sourceVersion`, `sourceArchiveSha256`,
`sourceSchemaGeneration`, `targetSchemaGeneration`, `fixtureId`, and
`result: 'passed'`. Existing `target`, `version`, `verifier`, and `verifiedAt`
identify the run. Per-entry `checks` and `processLifecycle` require every named
acceptance case. Set `studioHttpStartup: 'passed'` only after real startup and
successful Project loading. Failure produces evidence and a nonzero exit, never
a passing report with missing cases.

For a supplied full upgrade report, the publisher requires `level: 'runtime'`,
a matching native verifier target,
HTTP success, the required source-fixture set, and the exact candidate archive
checksum. Local smoke/structural reports remain eligible for publication and do
not claim full upgrade verification. Repackage/rebuild invalidates full upgrade
evidence. Invalid supplied reports block publication and channel promotion;
absence of full upgrade evidence does not block local releases. Reuse the existing
release diagnostic mechanism; invalid
evidence remains `RELEASE077`, verifier execution failures use `RELEASE020`.

## Implementation Slices

### 1. Reproduce and repair the backup contract

Run the existing populated backup test on Windows with bundled Node 24.16.0 and
retain the failure before changing code. Change only the generated backup's
flush handle to `r+`, which permits writing without truncating the file. Source
database and verification connections remain read-only. Add the focused native
regression and prove source contents and backup contents survive.

Then cover filesystem inspection, flush, verification, rename and metadata errors
with the existing structured diagnostics. Close handles on all paths; preserve
the primary error if close/unlink also fails. Define directory-sync handling
from supported native behavior; do not swallow unrelated EIO/ENOSPC failures.

### 2. Prove the complete Core readiness boundary

Close cached sessions before explicit migration. Preserve the verified backup
context through generation validation and backfill failures. Exercise automatic
open, explicit migrate and direct Drizzle config, including pending registration
with a current SQL schema. Keep conversion in the existing bounded backfill.

Add two-process contention and interruption tests before assuming a new lock is
needed. Required result: SQLite-consistent state, no falsely usable session, a
usable backup, and safe retry. A claim that all committed pre-upgrade work is
recoverable must include a writer racing the backup/migration boundary. If the
current boundary cannot guarantee this, block release and revise the coordination
design explicitly; do not merely mark the test flaky or add sleeps.

### 3. Create populated release fixtures and preservation assertions

Use genuine checksum-verified released archives to create synthetic Projects
under the old runtime, then upgrade using the candidate. Do not lower
`user_version` on a current database and call it an old-release fixture.

Keep `scripts/release/upgrades/fixtures.json` as a test-only inventory of fixture
ID, immutable source version/archive checksum per target, migration-journal
fingerprint, schema generation and creation recipe. It is not a runtime migration
registry. Initially require v0.1.24 -> candidate and v0.1.25 -> candidate, plus a
representative release for every distinct earlier shipped migration history.
Release pairs sharing identical history may share schema coverage, but retain
the immediate previous runtime's installed-update test. Missing artifacts or
fixtures are a gate failure. Never silently reduce the supported upgrade set.

Fixtures contain Project Settings, screenplay and analysis, Cast and Locations,
Lookbooks, Beats, Shots, Takes, selections, discarded/restorable work, Inspiration,
research references, Unicode/quoted opaque text, and actual small media files.
Use exact identities/relationships and byte hashes, not row counts alone. Preserve
the domain mapping inventory in Plan 0222 as the basis for 0089 assertions.
Production code must not retain old-shape readers; old shapes live only in
one-way migration fixtures and preservation expectations.

Urban Basilica is private evidence only. Do not put its database, screenplay or
media into fixtures, CI uploads or public archives. Optional local rehearsal
uses a SQLite-consistent copy and a copied Project folder, never the original.

### 4. Maintain optional native verification and preserve local releases

Run the backup/lifecycle suite on native `win32-x64`, `darwin-arm64`, and
`darwin-x64`. Package, extract into an isolated installation, verify the extracted
bytes with the bundled runtime, then bind reports to that archive checksum.
Run from outside the repository without access to workspace dependencies.

Extend the existing handoff rehearsal to accept genuinely distinct source and
candidate products and support native PowerShell as well as Mac Terminal.
Keep interactive installer behavior; the harness drives its existing prompts.
Use the existing local download-origin override, isolated configuration and
library paths. Check shutdown, launcher replacement, new process/version,
Project reopen, media access and repeat-open behavior. Record any necessary
desktop manual acceptance as unverified follow-up work until actually performed.

Wire native checks into the optional GitHub Actions workflow. Preserve the local
build, staging, publication and dry-run paths in `publish.mjs`. Local publication
accepts host runtime smoke and cross-target structural reports; it never dispatches
Actions. The explicit dispatcher can resume the immutable-tag workflow and wait
for completion. Full upgrade reports, when supplied, must be complete and bound
to the exact archive checksum. CI evidence uploads must include synthetic `.renku`
databases and backups. Preserve retries against the same tag and verified draft
artifacts. No new policy flags or public commands are needed.

## Comprehensive Test Plan

This is the full native acceptance inventory. Outstanding other-machine cases
are deferred by the user and do not block local publication. Each row is an
acceptance group. Put exhaustive invalid cases at the owning
layer; adapters and browser tests cover their own translation and user journey.

| Group / owner | Cases | Required assertions |
| --- | --- | --- |
| A. Backup / Core | Populated DB; missing/empty DB; generation metadata; repeated same-time backups; forced name collision; existing backup | Correct null behavior; consistent standalone backup; metadata matches; never overwrite earlier backup; source unchanged |
| B. Native filesystem / Core | Real Windows and both Macs; writable flush handle; paths with spaces, apostrophes and Unicode; long user-selected paths around native limits; read-only/denied destination; destination is a file; Windows held file handle | Native success on valid paths; structured actionable failure on invalid paths; no truncation; handle release; no migration |
| C. Backup faults / Core | Fail mkdir, source stat/open, VACUUM, flush/open/close, verification, size read, rename, metadata create/write/flush/rename; EACCES/EPERM, ENOSPC, EIO; secondary unlink failure | Correct existing error code and primary cause; no SQL/backfill writes; verified backup retained when appropriate; partial file never accepted as complete |
| D. SQLite snapshot / Core | DELETE journal and WAL mode; committed rows still in WAL; active reader; uncommitted writer; malformed/truncated database | Backup contains all committed snapshot data and no uncommitted rows; opens independently; integrity checks pass; failure does not damage source |
| E. Supplied backup / Core/config | Correct supplied backup; wrong source path or target generation; missing/truncated sidecar; mismatched size; corrupt backup; unrelated inherited environment | Child validates one intended backup; no duplicate in one migration run; invalid evidence blocks execution; no bypass |
| F. Upgrade lifecycle / Core | Actual prior populated generation; fresh creation; current generation; future generation; missing journal; missing packaged SQL/config/driver; child startup failure and nonzero exit | Correct readiness/rejection; no accidental creation on existing-project open; structured failure; backup precedes writes; journal and generation agree |
| G. Conversion preservation / SQL tests | Each shipped-history fixture; all affected relationship classes; populated parent rebuilds with foreign keys enabled; required conversion precondition failure; skipped releases | Stable identities or exact accepted mapping; preserved active/discarded relationships, selections and opaque values; zero foreign-key violations; integrity check passes |
| H. Reference registration / Core | Valid references; nested research; empty folders; missing/unreadable registered source; conflicting identity; hash/read error; current SQL with pending marker; failure inside transaction | Correct registrations and physical facts; media bytes unchanged; failures leave registration transaction pending; backup context present; successful retry sets marker once |
| I. Session lifecycle / Core | Cached session before explicit migrate; auto-open failure; readiness failure; close/reopen; two callers in one process | No stale or partially ready session returned; handles released; next open works after cause fixed; normal repeat open makes no extra backup/registration |
| J. Concurrency / process integration | Two CLI opens; Studio and CLI open; explicit migration competing with open; writer before/during backup and migration | Coherent migration history and data; no lost acknowledged writes; bounded busy/failure behavior; usable backup and retry; unsafe outcome blocks release |
| K. Interruption / process integration | Terminate during partial backup, after backup publication, metadata publication, during SQL, after SQL before registration, during registration, and immediately before session publication | Reopen fresh process; source/target state is explainable; SQLite recovery works; backup usable; retry preserves identities; no false ready state |
| L. Recovery / integration | Verify and restore pre-upgrade backup into disposable clean location; WAL-bearing failed database; metadata failure after valid backup | Recovery instructions actually restore the expected prior generation and data; failed evidence retained; no stale WAL replay; compatible old runtime can open restored copy |
| M. CLI and HTTP / adapters | Representative creation, verification, migration and registration failures; success | Existing code, message, issues, paths and suggestion survive serialization; CLI nonzero exit; no success payload/session on failure; no duplicated domain validators |
| N. Packaged app / native release | All declared targets; previous release, schema-changing baseline and skipped-release sources; isolated profile; bundled Node/dependencies; outside checkout | Real HTTP startup and populated Project load; media resolves; generation/journal/registration complete; installed backup independently verified; report tied to archive |
| O. Desktop update / E2E | Existing notice -> terminal/PowerShell -> stop -> install -> restart -> reopen Project; backup failure and retry; two browser tabs; closed browser during handoff | Correct version/process; error is understandable and retains recovery information; update notice alone is never success evidence; saved work visible; no duplicate handoff |
| P. Publication / release tooling | Local host runtime and cross-target structural reports; supplied native reports with failed/skipped tests, wrong version/target, stale archive checksum or absent fixtures | Local smoke reports qualify; invalid supplied native reports fail; default publication never dispatches Actions |

For faults that are difficult to provoke reliably (disk full and exact crash
boundaries), use deterministic test-only fault injection plus representative
real filesystem/process tests. Label simulated evidence accurately. Tests should
wait for explicit process milestones rather than timing guesses. A process kill
tests process-crash recovery, not literal power loss; evaluate filesystem
durability separately and document the supported guarantee.

Add a supported-OS acceptance pass on actual Windows 10/11 and the documented
minimum macOS baseline; CI runner success alone does not verify older OS support.
For network/removable/cloud-synced locations, first establish the existing support
contract. Do not silently claim support based on local NTFS/APFS results or add a
new storage restriction without review.

Every future schema-changing PR must include a populated source fixture,
preservation assertions for every affected table/relationship, success and
failure/retry checks, and the packaged upgrade result. Compare already shipped
SQL, journal entries and snapshots against immutable release history; additions
are permitted, modification/removal is a release failure. Data-only migrations
need coverage even when `user_version` does not change: test actual journal
completion and stop for a readiness-design correction if generation-only open
logic skips required work.

Architecture guardrails protect import boundaries and runtime behavior: browser
code cannot import SQLite/migration modules; adapters cannot write upgrade
metadata; invalid backup evidence prevents writes. Do not use source-text tests
listing private function names or every command in Core.

## Documentation

- Update `docs/architecture/reference/drizzle-migrations.md` for flush semantics,
  current Core-open ownership, failure stages and WAL-safe manual recovery.
- Update `docs/architecture/project-database-distribution.md` with populated
  upgrade requirements, fixture privacy and immutable migration history checks.
- Update `docs/operations/distribution-and-release.md` with native verification
  tooling, default local command behavior and report/archival evidence requirements.
- Update `docs/cli/commands.md` only for clarified migration failure/recovery
  output; command syntax remains unchanged.
- Record the explicit local-publication amendment in
  `docs/decisions/0108-require-native-project-upgrade-verification.md` after plan
  acceptance. Preserve ADR 0078's local-release policy and historical text.
- No agent workflow/CLI authoring contract changes are proposed; no sister Skills
  release is needed solely for this repair. Keep real Project evidence private.

## Final Verification

During implementation, run focused suites as they are completed, then:

```bash
pnpm build
pnpm check
pnpm test
pnpm test:integration
pnpm test:e2e:studio:smoke
```

Run the new focused lifecycle, fault and upgrade suites in addition to these
commands and register them in the repository's test partitions. Execute the
packaged verifier for every required source/target pair using the new command
above when explicitly running native verification. Other-machine and desktop
acceptance are deferred to a separate session. Test publisher rejection
without publishing an actual release. No dependency installation is implied by
this plan; use the existing toolchain and normal authorized CI setup.

Full native acceptance, deferred from this local implementation, requires evidence
for native Windows and both Mac architectures,
including versions, archive hashes, database generations/journal completion,
preservation assertions, independently readable backups and error-path results.
Missing native results are “not verified”; they do not block local publication.
The optional CI workflow requires its own native checks. Do not equate
coverage percentage with upgrade safety.

Inspect `git diff --stat` and the full diff; inspect heavily modified modules,
especially backup/store/release entrypoints. Confirm thin indexes, focused
functions, no format churn, no compatibility readers and no adapter-owned rules.
Any new failure revealed by the matrix must be fixed in its owner or documented
as a concrete blocker; the plan cannot be completed by waiving failing groups.

## Completion Checklist

### Review Area And Architecture

- [x] Apply the explicit user amendment: local releases remain default; Actions is optional.
- [x] Keep confirmed defect, incident inference and native reproduction distinct.
- [x] Confirm every slice traces to R1–R6 and the file map remains accurate.
- [x] Preserve Core/Drizzle ownership and thin CLI, HTTP and React consumers.
- [ ] Stop for an explicit design amendment if concurrency or data-only readiness
      requires a new lifecycle mechanism.

### Backup Repair And Contracts

- [ ] Reproduce the old handle failure natively on Windows; pass after repair.
- [x] Use a writable non-truncating backup flush handle on supported platforms.
- [x] Keep source reads and backup verification read-only.
- [x] Preserve codes, reports, backup location and direct-config safety gate.
- [x] Wrap source/final inspection failures and preserve primary/cleanup issues.
- [x] Define/test supported directory-sync behavior without swallowing real I/O errors.
- [x] Retain verified backups after metadata failure; never overwrite prior backups.
- [x] Prevent unrelated inherited supplied-backup environment from reaching the child.

### Readiness And Recovery

- [x] Close cached sessions before explicit migration.
- [x] Carry backup and failure-stage context through post-SQL registration errors.
- [x] Prove no new usable session is published until all readiness work finishes.
- [x] Verify idempotent retry and unchanged normal repeat-open behavior.
- [x] Prove actual journal completion, including data-only migrations.
- [x] Validate concurrency and crash recovery before adding coordination machinery.
- [x] Rehearse manual restore with failed WAL/journal evidence safely preserved.

### Test Implementation

- [ ] Complete A–E: backup, native filesystem, fault, WAL and supplied-backup cases.
- [ ] Complete F–I: lifecycle, conversion, registration and session cases.
- [ ] Complete J–L: concurrent processes, interruption milestones and recovery.
- [x] Complete M: CLI/HTTP serialization without duplicating Core's matrix.
- [ ] Complete N–O: genuine packaged upgrades and desktop handoff on native targets.
- [x] Complete P: accept local smoke/structural reports; reject invalid supplied native evidence.
- [x] Add synthetic immutable-release fixtures and exact preservation expectations.
- [x] Cover Plan 0222's relationship inventory, opaque values and media hashes.
- [x] Keep Urban Basilica out of committed fixtures, public archives and CI evidence.
- [x] Register new suites; prevent silent skips from producing passing release evidence.
- [x] Add stable boundary tests without implementation-name inventories.

### Release Integration And Documentation

- [ ] Run native lifecycle tests in the release target matrix.
- [x] Verify extracted candidate archives with their bundled runtime outside checkout.
- [x] Bind passing upgrade/HTTP evidence to exact archive hashes and required fixtures.
- [x] Validate supplied native evidence in publication; keep local smoke reports eligible.
- [x] Preserve local release command and prepare/publish retry semantics.
- [x] Restore local build/publication and local dry-run staging; keep workflow
      dispatch/resume available only through the explicit optional command.
- [x] Include hidden synthetic database folders in GitHub evidence uploads.
- [x] Replace same-build schema proof with genuine source/candidate handoff coverage.
- [x] Check shipped migration history remains append-only.
- [x] Update current migration, distribution, release and CLI recovery documentation.
- [x] Record the accepted verification decision without rewriting historical plans/ADRs.

### Final Verification

- [x] Run focused tests, root checks and integration/E2E verification.
- [ ] Save native Windows, Apple Silicon Mac and Intel Mac evidence.
- [ ] Verify supported OS baselines; state any unverified filesystem limitations.
- [x] Inspect complete diff, large files and thin `index.ts` entrypoints.
- [x] Confirm no unrelated formatting, product expansion or destructive changes.
- [x] Confirm no checklist item relies on unreviewable code or waived native tests.
- [ ] Complete deferred native acceptance in a separate session; do not claim it passed.
- [x] Keep deferred machine verification separate from local publication eligibility.

## Implementation Handoff

Core repair, diagnostics/readiness hardening, genuine release fixture tooling,
optional native CI gates, workflow waiting/retry, local publication and recovery/release
documentation are implemented. No shipped SQL, package public export, Project
schema, Settings, command syntax or real movie data was changed. No new concurrency
coordination mechanism was needed by the completed local process tests.

The source inventory represents five distinct released histories. Migration 0083's
published development IDs are used solely with synthetic text/media to exercise
its accepted conversion; its retired editable request state follows ADR 0090.
No private database or screenplay is imported. The preservation recipe covers
the Plan 0222 retained relationship and Trash-envelope inventory, including
current Clip selections/self-references and collected Inspiration identities.

Root build/check/unit/integration/browser smoke and native Apple Silicon archive
results are recorded during implementation. The user subsequently restored local
publication as the default and deferred other-machine verification to a separate
session. Native Windows/Intel Mac and desktop/OS baseline acceptance remain
unverified, not local-release blockers. No release was published and no native
result was claimed without evidence. No automatic plan review or reviewer
subagent was run.

### Verification Record — 2026-10-06

Local-release amendment verification: the full release suite passed 94 tests.
After adding two further publisher rejection cases, all 37 focused publication,
contract and evidence tests passed. Workflow YAML parsing and hidden-evidence
configuration checks passed. No release, workflow dispatch or other-machine
verification was performed. The earlier broad implementation results below
remain historical verification of the database repair.

| Check | Result and evidence |
| --- | --- |
| `pnpm build` | Passed with the existing bundle-size warning. |
| `pnpm check` | Passed, including 92 release tests. The pre-existing `server/bin.ts` console warning remains. |
| `pnpm test` | Passed across all packages. An overlapping independent Vitest run exposed shared temporary-directory cleanup; a sequential full rerun passed. |
| `pnpm test:integration` | Passed: Core 36, CLI 39 and Studio 36 tests. |
| `pnpm test:e2e:studio:smoke` | Passed all five desktop Chromium checks. |
| Focused upgrade suites | Passed 63 tests across backup, fault, native filesystem, migrator environment and readiness suites, including active WAL readers and native unreadable-reference recovery. Latest Core test typecheck and lint also passed. |
| Native Apple Silicon archived product | Passed all five genuine source releases with 13 required process cases each, preservation, journal completion, independently verified backups, repeat opens and actual HTTP/media serving. Final report: `release/upgrade-verification-0223-complete/final-evidence/verification.json`; synthetic database evidence is in its sibling `upgrade-evidence/`. |
| Native Windows and Intel Mac | Not verified in this environment. The release matrix requires their actual native lifecycle and packaged-upgrade results. |
| Native desktop update handoff | Harness implemented; operator acceptance not run. The five browser smoke tests do not substitute for this journey. |
| Supported OS and filesystem baselines | Windows 10/11 and minimum macOS not verified. No network/removable/cloud-synced or literal power-loss guarantee is claimed. |

The broad A–L and N–O completion groups stay open until their complete acceptance
matrix has evidence. Completed local examples do not waive outstanding native,
desktop or fault/readiness cases. The user deferred other-machine and desktop
verification; these open groups are not gates on the current local release path.

Apple Silicon acceptance ran on macOS 26.7.1 with the candidate's private Node
24.16.0. Source generations 64, 65, 67, 70 and 71 reached generation 71. Candidate
archive SHA-256 is
`95d2570f9c17d83dc692b7a9eb2c67eb78721cdcfcdfd1c244c242567a8aec5c`.
The completed report was independently revalidated against the exact archive and
the current required fixture/process inventory. Its packaged Core lifecycle files
also match the final compiled implementation. Earlier narrower reports fail the
full native-evidence validator and are not final native acceptance evidence.
