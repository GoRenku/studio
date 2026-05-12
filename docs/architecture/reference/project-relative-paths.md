# Project Relative Paths

Date: 2026-05-10

Status: current

Role: reference

## Purpose

This document defines how Renku Studio stores project-owned file and folder
references.

Decision history:

- `../../decisions/0012-store-project-file-references-as-project-relative-paths.md`

## Current Contract

SQLite must store project-owned file references as normalized
`project_relative_path` values.

Do not store absolute local filesystem paths in project metadata.

Runtime code may resolve a project-relative path against the project folder, but
that resolution should happen through one core-owned helper.

## TypeScript Contract

Core should define a first-class `ProjectRelativePath` contract.

The contract should enforce:

- no absolute paths;
- no `..` traversal outside the project folder;
- normalized `/` separators;
- no empty path segments;
- no relationship inference from path segments;
- stable serialization for SQLite and JSON contracts.

Node-side core should own helpers for:

- validating a candidate path;
- normalizing a candidate path;
- joining safe path segments;
- resolving a project-relative path against a project folder;
- reporting structured diagnostics when a path is invalid.

## Database Columns

Use explicit column names:

```text
asset_file.project_relative_path
```

If a future schema truly needs to store a project-relative folder reference, use
a similarly explicit name such as:

```text
<purpose>_project_relative_path
```

Do not add folder path columns just to remember where a cast member, clip, or
visual language entry usually lives. Folder allocation is core behavior; durable
file locations live on `asset_file.project_relative_path`.

Avoid vague columns such as:

```text
path
file_path
folder_path
default_folder_path
```

## Path Meaning

Folder names are user-facing labels, not identity.

File names are user-facing labels, not identity.

The database owns identity and relationships through opaque IDs and explicit
relationship rows.

The system must not infer owners, languages, cast members, clips, selects, or
bindings from path segments.

## External Renames

Renames should go through Renku commands so SQLite can update the stored
`project_relative_path`.

If a user externally renames or moves a file, validation should report the
missing path clearly. The system should not silently search for a similar file
and guess that it is the same asset.
