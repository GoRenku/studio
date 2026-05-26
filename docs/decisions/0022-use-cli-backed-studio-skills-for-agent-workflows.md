# 0022 Use CLI-Backed Studio Skills For Agent Workflows

Date: 2026-05-26

Status: accepted

## Context

Renku Studio agents need repeatable workflows for authoring project state:
analyzing Inspiration folders, designing Lookbooks, and producing media. These
workflows need enough craft guidance to produce good creative results, but they
must not bypass Renku Studio's metadata and validation boundaries.

The external Studio Skills project currently holds operational skills under:

```text
/Users/keremk/Projects/aitinkerbox/studio-skills/skills
```

## Decision

Studio skills are operational guides over Renku CLI and core contracts.

Skills may read project files and inspect media through normal filesystem
commands when those files are content. Skills must call Renku commands when they
create or mutate project metadata.

Current skill responsibilities:

- `inspiration-analyzer` analyzes an Inspiration folder and writes a validated
  `kind: "inspirationAnalysis"` document through `renku inspiration analysis`.
- `lookbook-designer` creates or revises durable Lookbooks through
  `renku lookbook`.
- `media-producer` creates persisted generation specs, estimates cost, runs
  approved generation, inspects outputs, and imports finished media separately.

Skills must use progressive disclosure. The main `SKILL.md` file stays
operational and short; detailed JSON contracts, CLI workflows, and craft
guidance live in `references/`.

Skills must not:

- write directly to `.renku/project.sqlite`;
- preserve obsolete command aliases;
- invent IDs or relationships;
- register Inspiration folder images as assets;
- mutate metadata by editing JSON sidecar files;
- run paid generation without estimate and approval;
- override user-selected generation controls.

## Consequences

- Agents and humans use the same CLI/core mutation paths.
- Skill docs can carry workflow and craft guidance without becoming alternate
  architecture sources of truth.
- New media purposes should update the shared `media-producer` skill references
  instead of creating one skill per purpose.
- Architecture docs should link to skills as operational companions, while
  current contracts remain in `docs/architecture/reference/` and CLI docs.

