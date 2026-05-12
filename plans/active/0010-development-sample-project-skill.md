# 0010 Development Sample Project Skill

Date: 2026-05-11

Status: draft

## Goal

Create a Codex skill for maintaining an external Renku Studio development sample
project repository.

The sample project is a real Renku project with its own `.renku/project.sqlite`
and file assets. It lives outside this Studio codebase and is the source of
truth for development sample content.

This is development tooling, not a product feature.

## Deliverable

A local Codex skill helps maintain the external sample project when Studio
changes.

The skill should guide Codex to:

- inspect the current Studio repo schema, migrations, and project services;
- inspect the external sample project repo;
- write temporary one-off scripts when needed;
- migrate or repair the sample SQLite for schema changes;
- import/register new sample assets for new features from a folder provided by
  the developer;
- infer likely asset ownership and roles from folder and file names;
- validate the updated sample project;
- leave the external sample project repo ready for the developer to review and
  commit.

## Source Of Truth

The external sample project repo is the durable artifact.

Do not create:

- a project import/export YAML format;
- a bootstrap manifest;
- a checked-in generic seeding framework;
- persistent migration scripts for one-off sample repairs;
- a second representation of the sample project's SQLite state.

One-off scripts are allowed and expected. They should normally be written in a
temporary location or left untracked only if the developer explicitly asks to
keep them.

## Skill Placement

Recommended local skill name:

```text
renku-sample-project-maintainer
```

Recommended location:

```text
~/.codex/skills/renku-sample-project-maintainer/SKILL.md
```

Optional reference file:

```text
~/.codex/skills/renku-sample-project-maintainer/references/asset-heuristics.md
```

Keep the skill concise. It should provide working rules and heuristics, not a
formal sample-project specification.

## Triggering Use Cases

The skill should apply when the developer asks Codex to:

- migrate the external sample project after Studio schema changes;
- update the sample project for a new feature;
- add a folder of new sample assets;
- register images, audio, video, text, or generated outputs into the sample
  project;
- repair missing asset records or broken project-relative paths;
- validate the sample project's SQLite and file references.

## Required Skill Behavior

When maintaining the sample project, Codex should:

1. Identify the Studio repo and external sample project repo.
2. Inspect current schema, migrations, and project service APIs.
3. Inspect the sample project's `.renku/project.sqlite`.
4. Inspect the provided asset folder when asset work is requested.
5. Prefer current project services and CLI commands when they exist and are
   practical.
6. Use direct SQLite edits only when the service layer does not yet support the
   required development operation.
7. Write the smallest one-off script that solves the current migration or asset
   import task.
8. Run the one-off script against the external sample project.
9. Validate the project after changes.
10. Report what changed and what the developer should review in the sample repo.

The skill should not stop at a proposal when the developer asks to update the
sample project. It should inspect, script, run, and validate unless blocked.

## Schema Migration Workflow

For schema changes, the skill should:

- inspect the current Drizzle schema and migrations;
- inspect the sample SQLite schema;
- run the normal migration path when available;
- if the normal migration path is insufficient, write a one-off repair script;
- keep the script focused on the sample project's actual current state;
- avoid preserving obsolete structures unless the current Studio schema requires
  them;
- validate that the migrated sample opens against the current code.

The one-off script does not need to be reusable. It only needs to safely move
the external sample project from its current state to the current Studio state.

## Asset Import Workflow

For new feature assets, the developer may provide a folder of files. The skill
should infer likely placement and ownership from paths and filenames.

General heuristics:

- folder names usually identify the owning domain object;
- `cast-member`, `cast`, character names, `portraits`, and
  `character-sheets` indicate cast-member assets;
- `visual-language`, `color`, `camera`, `lighting`, `texture`, and
  `production-design` indicate visual-language assets;
- `continuity`, `locations`, `props`, `costumes`, `vehicles`, and `symbols`
  indicate continuity reference assets;
- `sequence`, `scene`, and `clip` path segments indicate narrative-owned
  assets;
- filenames containing `selected`, `base`, `final`, or another clear canonical
  cue may become selected assets;
- alternates, variants, drafts, and non-canonical files usually become takes;
- when ownership or selection is ambiguous, ask the developer or choose the
  conservative take state and explain it.

The skill should copy files into the sample project using current project path
conventions and register them in SQLite through project services where
possible.

## Current Constantinople Asset Heuristics

The existing sample assets include cast-member images and visual-language
reference boards. These mappings are useful examples for the skill.

Mehmed II assets:

| Source pattern | Asset role | Default state |
| --- | --- | --- |
| `cast-member/member-1/character-sheets/character-sheet-16x9.png` | `character_sheet` | take |
| `cast-member/member-1/character-sheets/character-sheet-base.png` | `character_sheet` | select |
| `cast-member/member-1/character-sheets/character-sheet-campaign.png` | `character_sheet` | take |
| `cast-member/member-1/character-sheets/character-sheet-court.png` | `character_sheet` | take |
| `cast-member/member-1/portraits/full-body-9x16.png` | `portrait` | take |
| `cast-member/member-1/portraits/portrait-reference-1x1.png` | `portrait` | select |

Constantine XI Palaiologos assets:

| Source pattern | Asset role | Default state |
| --- | --- | --- |
| `cast-member/member-2/character-sheets/constantine-16x9.png` | `character_sheet` | select |
| `cast-member/member-2/character-sheets/constantine-9x16.png` | `character_sheet` | take |
| `cast-member/member-2/character-sheets/constantine-pose-gesture.png` | `pose_gesture_sheet` | take |
| `cast-member/member-2/portraits/constantine-9x16.jpg` | `portrait` | take |
| `cast-member/member-2/portraits/constantine-xi.png` | `portrait` | select |

Visual-language reference boards:

| Source pattern | Attach to | Asset role | Default state |
| --- | --- | --- | --- |
| `visual-language/camera/slow-observational-camera-grammar/camera-grammar.png` | Slow observational camera grammar | `reference` | select |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-2.png` | Muted earth, stone, bronze, and textile palette | `reference` | take |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-landscape.png` | Muted earth, stone, bronze, and textile palette | `reference` | take |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-portrait.png` | Muted earth, stone, bronze, and textile palette | `reference` | take |
| `visual-language/color/muted-earth-stone-bronze-and-textile-palette/color-palette-selected.png` | Muted earth, stone, bronze, and textile palette | `reference` | select |
| `visual-language/lighting/practical-source-low-key-interiors/lighting-sheet.png` | Practical-source low-key interiors | `reference` | select |

These are heuristics, not a manifest. The skill should inspect the actual
sample project and current feature needs before applying them.

## Validation Checklist

After changing the external sample project, the skill should verify:

- `.renku/project.sqlite` exists;
- the SQLite schema matches the current Studio code or expected migration
  state;
- all registered project-relative asset files exist;
- no registered asset file path escapes the project root;
- selected assets point to existing asset rows and files;
- newly imported files have expected metadata when the current asset system
  supports it, such as MIME type, dimensions, size, and content hash;
- the sample project can be read by current core project queries;
- feature-specific records added by the one-off script are present.

## Final Response Expectations

When the skill is used, Codex should report:

- which external sample project was changed;
- which one-off script was used and whether it was kept or discarded;
- which schema/data changes were made;
- which assets were copied or registered;
- validation results;
- any files in the external sample project repo that the developer should
  review and commit.

## Non-Goals

- No product-facing import/export format.
- No reusable seed framework unless the developer explicitly asks for one.
- No checked-in bootstrap manifest.
- No generic sample migration framework.
- No media asset import into user projects.
- No changes to `renku create`.
