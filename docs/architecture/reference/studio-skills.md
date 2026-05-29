# Studio Skills

Date: 2026-05-26

Status: current

Role: reference

## Purpose

This reference defines how Renku Studio architecture relates to the external
Studio Skills project.

Decision history:

- `../../decisions/0022-use-cli-backed-studio-skills-for-agent-workflows.md`

## Skills Location

The current Studio Skills project lives outside this repository:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

Architecture and CLI contracts live in this repository. Skill files are
operational companions that teach agents how to use those contracts.

## Current Skills

`inspiration-analyzer`

- Analyzes a Visual Language Inspiration folder from stored image files.
- Uses `renku inspiration show` to get folder context.
- Uses shell commands inside `folder.absolutePath` to inspect images.
- Writes validated `kind: "inspirationAnalysis"` JSON through the CLI.

`lookbook-designer`

- Creates or revises durable Visual Language Lookbooks.
- Uses Inspiration folders, existing analyses, named references, screenplay
  context, and user direction as source context.
- Writes validated `kind: "lookbook"` JSON through the CLI.
- Hands generated image requests to `media-producer`.

`screenplay-analyst`

- Analyzes the current screenplay through `renku screenplay analyze`.
- Reads ordered acts, sequences, scenes, cast, locations, and default analysis
  criteria from the CLI context command.
- Writes validated `kind: "screenplayAnalysis"` JSON through the CLI.
- Suggests scene additions or revisions as critique only; it does not mutate the
  screenplay graph.

`media-producer`

- Generates purpose-specific media from Renku context.
- Creates or updates persisted generation specs.
- Estimates cost and runs only approved specs.
- Imports finished files separately with `renku media import`.

## Skill Rules

Skills may inspect project files and media when those files are content. Skills
must call Renku commands for metadata mutations.

Skills must not:

- write directly to `.renku/project.sqlite`;
- invent IDs or relationships;
- use obsolete command aliases;
- register Inspiration folder images as assets;
- store absolute paths in authored JSON documents;
- run paid generation without an estimate and approval token;
- override user-selected generation controls.

## Reference Structure

Each skill should keep `SKILL.md` short and operational. Detailed CLI workflows,
JSON contracts, craft guidance, and samples belong in the skill's
`references/` and `samples/` folders.

When a Renku architecture contract changes, update the architecture/reference
docs and CLI docs in this repository first, then update the external skill
references to match the current contract.
