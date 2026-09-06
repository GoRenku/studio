# Protect Retained Screenplay Sources

Date: 2026-09-06

Status: accepted

## Decision

All retained `screenplay_source` Assets are protected from deletion, including
earlier FDX imports. Core enforces this through the shared Asset lifecycle with
`SCREENPLAY_FDX_SOURCE_PROTECTED`. The Supporting Files tab projects that rule
and offers no delete action for these files.

The user explicitly chose to preserve retained FDX files when adding Project
Supporting Files. Source history remains available for inspection and exact-byte
reuse. This expands the prior guard, which protected only the current import
pointer, without changing FDX authority, refresh, or canonical screenplay content.

Opaque `screenplay_supporting_material` Assets remain independently recoverable
through normal Studio Trash. Their deletion does not alter the external original
or previously authored screenplay, Cast, Location, or Prop content.

No source-policy setting, migration, existing-file cleanup, or authoring override
is introduced.
