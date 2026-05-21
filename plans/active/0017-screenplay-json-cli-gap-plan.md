# 0017 Screenplay JSON CLI Implementation Gap Plan

Date: 2026-05-20

Status: implemented for screenplay/current-project scope; adjacent screenplay-projection
asset test failures remain outside this plan's scope

## Scope

Track the remaining work needed to finish
`plans/active/0016-screenplay-json-cli-commands.md` after reviewing the current
screenplay JSON CLI implementation.

This gap plan assumes the amended current-project decision in plan 0016:

- CLI screenplay commands do not keep a shared SQLite connection alive across
  invocations.
- `renku project open <project-name>` records a persisted current authoring
  project.
- Each `renku screenplay ...` CLI invocation reads that current project,
  opens the project database for the duration of the command, and closes it
  before exiting.
- Studio UI/runtime code must still use project-lifetime database ownership and
  must not reopen SQLite for every UI request.

## Implementation Checklist

- [x] Replace the active session concept in code with persisted current
      authoring project semantics.
- [x] Keep `renku project open/current/close --json`, but make them manage a
      current-project pointer, not a live connection or session host.
- [x] Ensure screenplay CLI commands never require `--project` and always
      resolve the target through the persisted current authoring project.
- [x] Open and close the project database inside each CLI screenplay command
      invocation.
- [x] Keep Studio UI/database access on the existing project-lifetime connection
      path.
- [x] Export screenplay public contract types and schema constants from the
      browser-safe core client entrypoint when they are intended for client use.
- [x] Move validation, normalization, ID allocation, relationship resolution,
      and transaction planning out of ad hoc command logic and into dedicated
      core modules.
- [x] Make `screenplay validate --json` validate the current database state.
- [x] Make `screenplay validate --file ... --json` run the full create/apply
      validation pipeline without writing.
- [x] Implement duplicate durable ID checks for all screenplay table scopes.
- [x] Implement duplicate `localKey` checks with stable, path-specific
      diagnostics.
- [x] Resolve `localKey` references across operation documents, not only whole
      screenplay documents.
- [x] Validate unknown durable IDs and unresolved `localKey` references before
      any write.
- [x] Normalize unknown fields by dropping them from the write plan after
      emitting `PROJECT_DATA214` warnings.
- [x] Normalize duplicate relationship refs and emit `PROJECT_DATA215`
      warnings.
- [x] Decide whether string trimming is desired. Current behavior does not trim
      input strings; no `PROJECT_DATA216` warning is emitted.
- [x] Implement all first-pass operation families:
      `castMember`, `location`, `act`, `sequence`, and `scene` add/update/delete/move.
- [x] Honor placement for add and move operations.
- [x] Reject placement targets outside the valid parent with `PROJECT_DATA212`.
- [x] Keep `scene.update` as a full scene document update, including all
      blocks.
- [x] Keep `act.update` and `sequence.update` as full aggregate updates,
      including required child arrays.
- [ ] Prevent nested child ID changes during aggregate update operations with
      `PROJECT_DATA218`; top-level unknown update IDs already fail before write.
- [x] Protect deletes that would orphan screenplay relationships or asset
      relationships with `PROJECT_DATA213`.
- [x] Keep writes atomic and short, with no partial writes when one operation
      in a batch is invalid.
- [x] Wrap validated transaction failures in `PROJECT_DATA219` with useful
      context.
- [ ] Return consistent command reports for all read and mutation commands,
      including `valid`, `warnings`, `project`, and relevant resource keys.
- [x] Make read commands that require existing screenplay data fail with
      `PROJECT_DATA205` instead of returning misleading empty or `null` data.
- [ ] Add scoped resource keys for mutations instead of always returning only
      `screenplay`.
- [ ] Append Studio refresh/resource events after successful CLI mutations.
- [ ] Add CLI tests for stdin and unreadable files; missing flags, JSON
      diagnostic stderr behavior, and current-project resolution are covered.
- [ ] Add core tests for protected deletes, failed batches, dry runs, and
      transaction behavior; semantic validation, placements, duplicate IDs, and
      duplicate relationship warnings are covered.
- [x] Add architecture tests that ensure CLI code does not import Drizzle,
      database access modules, or SQLite directly.
- [x] Remove non-index re-export stubs introduced by the screenplay work and
      update callers to import directly from the modules that own the
      implementation.
- [x] Add or extend architecture tests so `export ... from` and `export * from`
      are rejected outside intentional `index.ts` public entrypoints.

## Reviewed Gaps And Outcomes

### Resolved: Current Project State Was Modeled As A Session

The reviewed implementation used
`packages/core/src/server/database/lifecycle/active-project-session.ts` and
stores an `active-project-session.json` descriptor. It includes `sessionId`,
`openedAt`, and `updatedAt`, and `openActiveProjectSessionHandle` opens a
project-lifetime store.

Implemented behavior after the plan amendment:

- the persisted file describes a current authoring project, not a live
  session;
- command reports do not imply that a SQLite handle is being kept open;
- CLI command handlers open the database for one invocation and close it
  in a `finally` block;
- `project close` clears the current-project pointer, not promise to
  release a long-lived CLI-owned handle.

Impact:

Agents get the desired workflow of not passing `--project` repeatedly, without
the complexity of a long-lived CLI session host.

### Resolved: Validation Did Not Run The Full Pipeline

`validateScreenplayJson` previously performed AJV structural validation only when
a document is supplied. It does not validate the current database state when
called without `--file`, and it does not run semantic validation for file input.

Implemented behavior:

- a file with `locationRefs: [{ "localKey": "missing-location" }]` fails
  `screenplay validate --file` with
  `PROJECT_DATA210`;
- a persisted screenplay with malformed relationship rows is reported by
  `screenplay validate --json`;
- duplicate relationship references are normalized with `PROJECT_DATA215`
  warnings.

### Open: Boundaries Can Be Split Further

The implementation now has dedicated screenplay validation and persistence
modules, but the persistence module still combines ID allocation, relationship
normalization, replacement writes, and transaction guards. That is acceptable
for this slice, but future work should split these into smaller modules such as:

- `screenplay-id-allocation.ts`;
- `screenplay-relationship-resolution.ts`;
- `screenplay-write-plan.ts`.
- duplicate durable IDs are not collected before write planning.

Expected fix:

Use the same validation pipeline for validate/create/apply, stopping before the
write for validate and dry-run paths.

### Apply Operations Do Not Honor Placement

The current apply code appends added entities and moves entities to the end of
their collection. It ignores placement objects such as:

```json
{
  "beforeSceneId": "scene_existing"
}
```

Expected fix:

Implement placement resolution per parent collection:

- add/move before a sibling;
- add/move after a sibling;
- append only when add omits placement;
- reject placement outside the allowed parent with `PROJECT_DATA212`.

Impact:

Without this, agents can ask Renku to insert or move a scene in a precise place
and receive a valid-looking report while the scene lands elsewhere.

### Apply Replaces The Whole Screenplay

The current apply path builds a full in-memory screenplay draft and then calls a
replacement writer that deletes and reinserts the screenplay tables.

Expected behavior:

Focused operations should write only the affected records and relationship rows
inside a short transaction, after validation has proven the complete operation
batch is safe.

Impact:

The whole-replace approach can collide with asset relationship foreign keys and
turn a small scene edit into a broad destructive rewrite. It also makes
protected-delete diagnostics harder to report before the transaction.

### Partially Resolved: Protected Deletes Need More Precision

Delete operations are validated before write, and screenplay writes now fail
with `PROJECT_DATA213` if existing screenplay asset relationships would be
orphaned by the replacement writer.

Remaining expected behavior:

Before writing, collect dependency information for the specific operation and
fail with `PROJECT_DATA213` only when deleting a cast member, location, act,
sequence, or scene would orphan references or registered assets.

Example:

Deleting a scene with a registered scene asset should fail before any database
mutation and should identify the blocking asset relationship.

### Partially Resolved: ID Validation Still Needs Nested Update Guards

The allocator now checks duplicate `localKey` values and duplicate supplied
durable IDs within table scopes. Updates still do not fully protect against ID
changes in nested aggregate replacements.

Expected behavior:

- duplicate durable IDs fail with `PROJECT_DATA209`;
- duplicate `localKey` values fail with `PROJECT_DATA209`;
- update operations that attempt to change an existing object's durable ID fail
  with `PROJECT_DATA218`;
- newly created nested blocks inside a full scene update get IDs only when they
  are genuinely new.

### Read Reports Are Inconsistent

Some read commands return raw arrays instead of command reports with `valid`,
`warnings`, `project`, and resource keys.

Examples:

- `screenplay cast list --json` returns only an array;
- `screenplay location list --json` returns only an array;
- `screenplay show --json` now fails with `PROJECT_DATA205` when no screenplay
  row exists.

Expected fix:

Make all screenplay CLI JSON outputs follow the same command-report shape, or
document the exact exceptions and test them. The plan currently expects
command-report consistency.

### Resource Keys And Studio Refresh Are Too Coarse

Create returns several resource keys, but apply currently returns only
`["screenplay"]`, and CLI mutation commands do not append Studio coordination
events after successful writes.

Expected behavior:

- return scoped resource keys such as `screenplay:cast`,
  `screenplay:scene:<scene-id>`, and
  `screenplay:sequence:<sequence-id>:scenes`;
- append Studio refresh/resource events after successful CLI mutations so an
  open Studio window can refresh affected surfaces.

### Open: File Structure Can Be Split Into More Planned Boundaries

The implementation currently has the main validation code in
`screenplay-json/validator.ts`, but the planned dedicated modules are missing:

- `diagnostics.ts`;
- `normalization.ts`;

The current implementation keeps this logic centralized while the command
surface stabilizes.

### Resolved: Non-Index Re-Export Stubs Had To Be Removed

Renku Studio should not add re-export files as compatibility layers or import
path shortcuts. If a caller imports through a file that only re-exports another
module, update the caller to import from the implementation owner directly.

Reviewed example:

- `packages/core/src/server/resources/screenplay.ts` was a re-export
  facade over `database/access/screenplay-resource.ts`.

Implemented behavior:

- non-index files own implementation or define local contracts;
- `export ... from` and `export * from` are reserved for intentional
  `index.ts` public entrypoints only;
- callers were updated directly when files moved or ownership changed;
- architecture tests make this rule mechanical so new re-export stubs do
  not creep back in.

## Verification Snapshot

Commands run during the gap review:

```bash
pnpm --filter @gorenku/studio-core type-check
pnpm --filter @gorenku/studio-cli type-check
pnpm --filter @gorenku/studio-core build
pnpm --filter @gorenku/studio-core lint
pnpm --dir packages/core exec vitest run src/server/commands/screenplay-commands.test.ts
pnpm --dir packages/cli exec vitest run src/cli.test.ts
pnpm --filter @gorenku/studio-core test
pnpm --filter @gorenku/studio-cli test
pnpm check
```

Results:

- core type-check passed;
- CLI type-check passed;
- core build passed;
- core lint passed after removing stale screenplay/navigation lint issues;
- root `pnpm check` passed;
- screenplay-specific core tests passed: 6 tests;
- CLI tests passed: 21 tests;
- broader core tests currently fail in adjacent screenplay-projection/asset areas:
  continuity references are not projected, episode summaries are absent from the
  screenplay-backed movie shape, Markdown clip summary assets are absent, and
  several tests still register assets against hard-coded `clip_test0001`
  targets that no longer exist in the current screenplay data model.

The failing adjacent tests are important for branch health, but they are not
evidence of the current-project/screenplay CLI implementation regressing. The
remaining unchecked items above are the known follow-up work if the plan is
extended from the screenplay CLI slice into complete Studio refresh integration
and stricter aggregate-update semantics.
