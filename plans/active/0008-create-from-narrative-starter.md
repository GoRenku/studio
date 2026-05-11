# 0008 Create From Narrative Starter

Date: 2026-05-10

Status: draft

## Goal

Add a user-facing project creation path that creates a new Renku Studio project
from a validated authored narrative starter YAML file.

This is a product feature, not a development sample import/export format. The
narrative starter describes the initial story structure only. It must not become
a second representation of the full project database.

This plan builds on:

- `0005-project-storage-foundation.md`
- `0009-studio-text-asset-editing.md`
- `docs/architecture/structured-diagnostics.md`

## Deliverable

A user or AI agent can run:

```bash
renku create --from-narrative <path>
```

The command validates the narrative starter YAML and creates a fresh project
with:

- project metadata;
- languages;
- initial narrative spine;
- sequences;
- scenes;
- clips;
- direct short text fields;
- optional Markdown-backed narrative text files.

The command reports structured diagnostics that are useful to both humans and
AI agents generating the YAML.

## Product Boundary

The narrative starter is intentionally narrow.

It may define:

- project title, name, type, aspect ratio, logline, and summary;
- language configuration;
- sequence, scene, and clip titles;
- short titles;
- summaries;
- visual intent text;
- optional Markdown files for longer authored narrative prose.

It must not define:

- media assets;
- cast portrait or character-sheet assets;
- visual-language reference boards;
- continuity reference images;
- takes;
- selects;
- production assets;
- arbitrary database relationships;
- a project import/export manifest.

If a future feature needs richer generated project setup, add that feature
deliberately instead of expanding this format into a full project clone format.

## Command Shape

Initial CLI:

```bash
renku create --from-narrative narrative.yaml
```

Supported flags:

```text
--from-narrative <path>
--storage-root <path>
--force
--json
```

Rules:

- `--from-narrative` points to a YAML file with
  `kind: renku.narrativeStarter`.
- `project.name` is always read from the narrative starter YAML.
- Relative Markdown file references are resolved against the narrative YAML
  file directory.
- Referenced Markdown files must stay inside the narrative file directory or a
  documented child folder.
- The generated project folder must stay inside `--storage-root`.
- `--force` may remove an existing target only when the target is clearly
  recognized as generated output for the same project.
- `--json` prints the same result as structured machine-readable output.

## Narrative Starter YAML Spec

Initial file identity:

```yaml
kind: renku.narrativeStarter
version: 0.1.0
```

Initial complete shape:

```yaml
kind: renku.narrativeStarter
version: 0.1.0

project:
  name: constantinople
  title: Preparation of the Siege of Constantinople
  type: standaloneMovie
  aspectRatio: "16:9"
  logline: A historical documentary about how Mehmed II prepared the siege.
  summary: >
    A young sultan turns inherited ambition into policy, studies a city that
    has survived centuries of attacks, cuts the Bosphorus, embraces gunpowder,
    and moves an impossible weapon toward ancient walls.

languages:
  - localeTag: en-US
    displayName: English
    isBase: true
    supportsAudio: true
    supportsSubtitles: true

sequences:
  - title: The Young Sultan's Obsession
    shortTitle: Ambition
    summary: Mehmed II becomes the new Ottoman ruler and turns the conquest of Constantinople into immediate policy.
    scenes:
      - title: A Throne Facing an Ancient City
        summary: Mehmed's accession is framed against the old imperial prize waiting across the water.
        clips:
          - title: The New Sultan
            summary: Mehmed is introduced as young, controlled, ambitious, and underestimated.
            visualIntent: Quiet court staging around a ruler already looking beyond the room.
```

Supported Markdown-backed fields in this slice:

```yaml
project:
  summaryFile: narrative/project-summary.md

sequences:
  - summaryFile: narrative/sequences/ambition.md
    scenes:
      - summaryFile: narrative/scenes/throne-facing-city.md
        clips:
          - summaryFile: narrative/clips/new-sultan-summary.md
            visualIntentFile: narrative/clips/new-sultan-visual-intent.md
```

Rules:

- Direct scalar text and `*File` forms are mutually exclusive for the same
  field.
- A missing referenced Markdown file is an error.
- Unknown YAML fields are warnings and ignored, following the structured
  diagnostics guidance for agent-authored project inputs.
- Required fields that are missing or invalid are errors.
- The first implementation should support direct scalar text everywhere and
  Markdown file references for project summaries, sequence summaries, scene
  summaries, clip summaries, and clip visual intent.
- Markdown files become project-local Markdown-backed text assets during project
  creation.

## Validation Rules

Project rules:

- `project.name` is required.
- `project.name` must be a valid project folder name according to current
  project-name validation.
- `project.title` is required.
- `project.type` must be one of the supported project types.
- `project.aspectRatio` must be one of the supported aspect ratios.
- `project.logline` is required.
- exactly one of `project.summary` or `project.summaryFile` may be provided.

Language rules:

- at least one language is required;
- exactly one language must have `isBase: true`;
- locale tags must be valid BCP 47 locale tags according to the current project
  validation approach;
- duplicate locale tags are errors.

Narrative rules:

- at least one sequence is required;
- every sequence requires `title`;
- every scene requires `title`;
- every clip requires `title`;
- ordering is declaration order;
- empty `scenes` arrays are allowed only if the current project model allows
  sequence-only planning;
- empty `clips` arrays are allowed only if the current project model allows
  scene-only planning;
- if empty arrays are not supported by current storage commands, validation
  should reject them with a clear suggestion.

File reference rules:

- file references are relative paths;
- absolute paths are errors;
- parent-directory escapes are errors;
- referenced files must exist;
- referenced files must have `.md` extension;
- referenced files are copied into the generated project as Markdown text assets
  using normal project path allocation.

## Structured Diagnostics

Use `@gorenku/studio-diagnostics` for all validation failures and warnings.

Initial diagnostic code families:

```text
NARRATIVE_STARTER001 invalid YAML
NARRATIVE_STARTER002 unsupported kind
NARRATIVE_STARTER003 unsupported version
NARRATIVE_STARTER010 missing required field
NARRATIVE_STARTER011 invalid field value
NARRATIVE_STARTER012 unknown field warning
NARRATIVE_STARTER020 duplicate locale
NARRATIVE_STARTER021 missing base language
NARRATIVE_STARTER022 multiple base languages
NARRATIVE_STARTER030 invalid Markdown file reference
NARRATIVE_STARTER031 missing Markdown file
NARRATIVE_STARTER032 conflicting scalar and file fields
NARRATIVE_STARTER040 invalid narrative hierarchy
NARRATIVE_STARTER050 project target already exists
```

Diagnostics should include:

- severity;
- stable code;
- path inside the YAML document;
- file path when relevant;
- concise message;
- actionable suggestion when possible.

The JSON error format should be suitable for an AI agent to repair and retry
the YAML without scraping human prose.

Example diagnostic:

```json
{
  "severity": "error",
  "code": "NARRATIVE_STARTER032",
  "path": ["sequences", 0, "scenes", 0, "clips", 0, "summaryFile"],
  "message": "Clip summary cannot be provided as both summary and summaryFile.",
  "suggestion": "Remove either summary or summaryFile for this clip."
}
```

## Core And CLI Shape

Recommended implementation shape:

```text
packages/core/src/narrative-starter/
  contracts.ts

packages/core/src/node/narrative-starter/
  read-narrative-starter.ts
  validate-narrative-starter.ts
  create-project-from-narrative-starter.ts

packages/cli/src/commands/create-command.ts
```

The CLI command should:

1. parse flags;
2. call the core/node narrative starter service;
3. render diagnostics;
4. render a creation summary or JSON result.

The core/node service should:

1. read YAML;
2. validate structure and file references;
3. collect all actionable diagnostics before failing;
4. create the project through existing project storage services;
5. create narrative records in declaration order;
6. create Markdown-backed text assets where `*File` fields are used;
7. return a structured summary.

## Future User-Facing Skill

Later, ship a user-facing `Skill.md` that helps AI agents generate valid
`renku.narrativeStarter` YAML.

That skill should include:

- the current schema;
- examples;
- diagnostics and repair guidance;
- narrative writing guidance;
- constraints that prevent media/import-manifest behavior.

The skill should generate narrative starter YAML only. It should not generate
sample project maintenance scripts or development-only asset registration code.

## Verification

- `pnpm test:core`
- `pnpm test:cli`
- `pnpm check`
- Tests cover:
  - valid minimal narrative starter creates a project;
  - valid Markdown file references create Markdown-backed text assets;
  - missing required fields produce structured errors;
  - unknown fields produce warnings and are ignored;
  - invalid kind/version produce structured errors;
  - duplicate locale tags fail;
  - missing or multiple base languages fail;
  - scalar plus `*File` conflict fails;
  - missing Markdown file fails;
  - parent-directory path escape fails;
  - declaration order is preserved for sequences, scenes, and clips;
  - `--json` emits machine-readable diagnostics and summary.

## Non-Goals

- No media asset import.
- No cast image setup.
- No visual-language reference-board setup.
- No continuity reference image setup.
- No takes or selects.
- No production asset materialization.
- No general project import/export manifest.
- No support for updating an existing project in this slice.
