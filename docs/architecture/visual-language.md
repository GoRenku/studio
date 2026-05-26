# Visual Language Architecture

Date: 2026-05-26

Status: current

Role: topic overview

## Purpose

Visual Language is Renku Studio's project direction system for look, tone,
camera, lighting, texture, and reference synthesis.

The current implementation has two project-native authoring surfaces:

- Inspiration Analysis, which analyzes user-provided reference image folders.
- Lookbooks, which turn references and user direction into durable project
  visual direction.

Precise contracts live in `reference/visual-language.md`.

## Current Shape

Inspiration folders are project objects, but the image files inside them are
plain filesystem content. Renku stores folder metadata and analysis JSON.
Agents inspect images with shell commands inside the folder path returned by
`renku inspiration show`.

Inspiration Analysis is a schema-validated tagged JSON document written through
the CLI. The document may cite folder-local image filenames. Renku validates
those filenames against files in the folder before writing.

Lookbooks are durable project direction. They are schema-validated tagged JSON
documents with source Inspiration relationships. They do not embed image
filenames. Example images are registered assets attached through Lookbook image
relationships and placed in sections by relationship rows.

Studio refresh uses scoped resource keys returned by mutations, matching the
resource loading architecture.

## Agent And Skill Workflows

Visual Language workflows are CLI-backed:

- `inspiration-analyzer` analyzes folder images and writes Inspiration Analysis.
- `lookbook-designer` creates or revises Lookbooks.
- `media-producer` handles generated Lookbook images through persisted specs
  and separate media import.

Skills must not write SQLite directly or preserve obsolete command shapes.

## Related References

- `reference/visual-language.md`
- `reference/studio-skills.md`
- `media-generation.md`
- `../decisions/0018-use-project-native-visual-language-inspiration-analysis.md`
- `../decisions/0019-use-durable-lookbooks-as-project-visual-direction.md`
- `../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

