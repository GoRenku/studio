---
name: renku-sample-project-maintainer
description: Maintain the external Renku Studio development sample project repository for the local Studio repo at /Users/keremk/Projects/aitinkerbox/studio only. Use only when Codex is working in that repo and needs to migrate or repair the sample project's .renku/project.sqlite after Studio schema changes, add or register a folder of sample assets, infer asset ownership and selected/take state, fix broken project-relative asset paths, validate the sample project against current Studio code, or leave the external sample repo ready for developer review and commit.
---

# Renku Sample Project Maintainer

## Purpose

Maintain an external Renku Studio development sample project for the local Studio repo at `/Users/keremk/Projects/aitinkerbox/studio`. The skill lives under the user's home directory, but it is project-specific and should not be used for other repositories.

Treat the sample project as a real project, not as generated fixture data. The external repo and its `.renku/project.sqlite` are the durable artifact and source of truth.

Do the work end to end when asked to update the sample project: inspect, script, run, validate, and report. Stop only when the sample project path is unknown, a destructive operation would be required, or an ambiguity would change project meaning.

## Boundaries

Do not create or preserve a second source of truth for the sample project.

- Do not create import/export YAML, bootstrap manifests, reusable seed frameworks, generic sample migration systems, or checked-in migration registries.
- Do not add compatibility layers for obsolete Studio schemas or names.
- Do not change product commands such as `renku create` unless the user explicitly asks.
- Do not commit changes in the external sample repo unless the user explicitly asks.
- Do not delete, reset, or overwrite external sample files without explicit confirmation.

One-off scripts are allowed and expected. Prefer writing them in a temporary directory. Leave a script untracked in the sample repo only if the developer asks to keep it.

## Initial Orientation

1. Identify both repositories:
   - Studio repo: `/Users/keremk/Projects/aitinkerbox/studio`.
   - Sample project repo: ask for the path if the user did not provide it and it cannot be inferred safely.
2. Confirm the current task belongs to `/Users/keremk/Projects/aitinkerbox/studio`. If the current workspace is a different repo, do not use this skill unless the user explicitly says they are maintaining this Studio repo's sample project.
3. Inspect the Studio repo before editing the sample project:
   - Drizzle schema and generated migrations.
   - project services under `packages/core/src/node/project`.
   - CLI commands under `packages/cli/src`.
   - relevant architecture docs under `docs/architecture`.
4. Inspect the sample project:
   - confirm `.renku/project.sqlite` exists;
   - inspect its schema with SQLite introspection;
   - inspect relevant rows before modifying them;
   - check the external repo git status so user changes are not mistaken for your own.

Use `rg`, `rg --files`, `sqlite3`, and current package scripts where practical. Prefer Studio's current service APIs and CLI commands when they support the operation. Use direct SQLite edits only for development-only repairs that the service layer does not yet expose.

## Schema Migration Workflow

Use this workflow when Studio schema, storage, service, or migration code changed.

1. Compare the current Studio schema and migrations with the sample SQLite schema.
2. Try the normal migration path first when it exists and is practical.
3. If the normal path is missing or insufficient, write the smallest one-off repair script for the sample project's actual current state.
4. Keep the script explicit:
   - check the existing schema before mutating;
   - fail fast on unexpected tables, columns, or missing source data;
   - use transactions;
   - avoid preserving obsolete structures unless the current Studio schema requires them.
5. Run the script against the external sample project.
6. Validate that the migrated sample opens through current Studio/core project reads.

The script only needs to move this sample project from its current state to the current Studio state. It does not need to handle arbitrary historical databases.

## Asset Import Workflow

Use this workflow when the developer provides a folder of new sample assets.

1. Inspect the folder tree and file names before copying anything.
2. Inspect the sample database records that might own the assets, such as cast members, visual language records, sequences, scenes, clips, continuity records, and existing asset rows.
3. Infer likely placement, owner, role, and state from paths and names. Read `references/asset-heuristics.md` when mapping asset folders or Constantinople-style sample assets.
4. Copy files into the sample project using current project-relative path conventions.
5. Register copied files through current project services when available. Use direct SQLite only when the current service layer cannot perform the development operation.
6. Preserve metadata expected by the current asset system, such as MIME type, dimensions, size, and content hash, when supported.
7. Use conservative state when selection is ambiguous:
   - clear `selected`, `base`, `final`, or canonical naming can become selected;
   - alternates, drafts, variants, and unclear files should become takes;
   - ask the developer before making an ambiguous file the selected asset.

When ownership is ambiguous but a safe take record can be created without changing user-facing selection, do that and explain the assumption.

## Validation Checklist

After every change, validate the sample project before reporting completion.

- `.renku/project.sqlite` exists.
- SQLite schema matches the current Studio schema or expected migration state.
- All registered project-relative asset files exist.
- No registered asset path escapes the project root.
- Selected asset pointers reference existing asset rows and existing files.
- Newly imported files have expected metadata when supported.
- Current core project queries can read the sample project.
- Feature-specific records added by the one-off script are present.
- External sample repo `git status` shows only expected changes.

Use focused project/package tests when they directly cover the changed service behavior. Avoid running expensive or unrelated generation.

## Reporting

In the final response, report:

- external sample project path changed;
- one-off script path and whether it was discarded or left for review;
- schema/data changes made;
- assets copied or registered;
- validation commands and results;
- external sample repo files the developer should review and commit;
- any assumptions or follow-up decisions needed.

Keep the explanation concrete. Include examples of ambiguous files or records when they affected decisions.
