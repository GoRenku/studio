# 0018 Use Project-Native Visual Language Inspiration Analysis

Date: 2026-05-26

Status: accepted

## Context

Visual Language Inspiration folders let users collect image references inside a
Renku Studio project. Agents need to analyze those images as a coherent visual
system, but the analysis must become project-native state rather than a loose
sidecar file or a direct SQLite edit.

Earlier prototypes centered on external FilmGrab workflows. The accepted Studio
workflow is different: the user creates or fills an Inspiration folder in the
project, and an agent analyzes the stored folder contents through the Renku CLI.

## Decision

Inspiration folders are durable project objects. The image files inside an
Inspiration folder are plain filesystem content owned by that folder.

Renku stores Inspiration folder metadata and the persisted Inspiration Analysis
JSON in SQLite. Renku does not register each Inspiration image as an asset, does
not create per-image SQLite rows, and does not expose a CLI image manifest for
the folder.

Agents must use the CLI to discover the folder and write analysis:

```bash
renku inspiration show --folder <folder-id> --json
renku inspiration analysis validate --folder <folder-id> --file <analysis-json> --json
renku inspiration analysis write --folder <folder-id> --file <analysis-json> --json
```

`inspiration show` may return a resolved absolute folder path for agent
inspection. That path is command output only. SQLite continues to store
project-relative folder paths.

Agents inspect images with normal filesystem commands inside the returned
folder path. For example:

```bash
cd "<folder.absolutePath>"
find . -maxdepth 1 -type f
```

The analysis input is a tagged JSON document:

```json
{
  "kind": "inspirationAnalysis",
  "analysis": {}
}
```

The folder id comes from the command flag, not from the document. `imageFiles`
values inside the document are folder-local filenames only. Validation checks
the JSON schema and verifies that referenced filenames exist in the folder
before any write happens.

## Consequences

- Inspiration Analysis is reliable for Studio, CLI, and skills because core
  owns validation and persistence.
- Agents can use rich image folders without bloating SQLite with per-image rows.
- Folder names remain useful creative hints, but relationships are not inferred
  from names or paths.
- Skills must not write `.renku/project.sqlite` directly or register
  Inspiration images as assets.
- The old nested `visual-language inspiration ...` command shape and bare
  section JSON inputs are obsolete and are not kept as compatibility aliases.

