# 0012 Store Project File References As Project-Relative Paths

Date: 2026-05-12

Status: accepted

## Context

Renku Studio projects contain a SQLite database and project-owned files such as
Markdown, images, audio, video, transcripts, subtitles, and generated media.

Absolute paths are local-machine details. They make project databases hard to
move, copy, sync, or inspect on another machine. At the same time, file
references need enough structure for validation and safe resolution.

## Decision

SQLite must store project-owned file and folder references as normalized
project-relative paths.

The database column name for file references is:

```text
project_relative_path
```

The TypeScript public contract is `ProjectRelativePath`.

Project-relative paths are interpreted from the project folder, not from
`.renku/`, the process working directory, or the user's home directory. They
must not be absolute paths and must not escape the project folder.

Core owns path normalization, validation, and resolution. CLI, Studio server,
and UI callers should use core operations instead of implementing their own path
rules.

## Consequences

- Project databases remain portable across machines and storage roots.
- Code has one place to enforce path safety.
- File references are explicit in schema and contracts.
- External file renames are not silently guessed; the project graph should fail
  clearly until a deliberate repair flow exists.
